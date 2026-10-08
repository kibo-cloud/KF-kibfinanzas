'use strict';
// L8: a pase writes two blobs (the year row and Trabajo). A write-ahead journal (kibo.diario) holds the full new text of both and
// their revisions before the first write; a fresh start finishes a pase cut between the writes, never applies it twice, and never
// replays it over blobs another tab changed in the meantime.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var H = require('./fixtures/r45-harness');
var C = require('./fixtures/r4-casos');

var PASE_FUNCS = ['renglonTrabajo', 'blobAlDia', 'aplicarPase', 'quitarPase', 'reponerPase', 'guardarPase', 'resumenTrab', 'hoyISO', 'esISO', 'utcDe', 'sumarDias', 'diasEntre', 'ganancia',
  'saldoFac', 'venceFac', 'sinAsignar', 'paseAlModelo', 'mesDelModelo', 'pasesDelMes'];
var Y = 'kibo.datos.2026', TR = 'kibo.trabajo', DI = 'kibo.diario';

function inicial(){
  return {[Y]: JSON.stringify(Object.assign(C.vacio(2026), {rev: 4})), [TR]: JSON.stringify(Object.assign(H.trab([]), {rev: 2}))};
}
// a storage that "dies" (the tab is killed) on the first write of key `k`: that write and every later operation throw
function almacenQueMuere(init, k){
  var ls = H.fakeStorage(init), muerto = false, set = ls.setItem, rm = ls.removeItem;
  ls.matar = k;
  ls.setItem = function(key, v){ if(muerto) throw new Error('dead'); if(key === ls.matar){ muerto = true; throw new Error('crash'); } return set(key, v); };
  ls.removeItem = function(key){ if(muerto) throw new Error('dead'); return rm(key); };
  return ls;
}
function app(ls, toasts, errores){
  toasts = toasts || []; errores = errores || [];
  var a = H.appAlmacen(ls, '2026-10-15', {
    leerMonto: function(){ return {ok: true, v: 100000}; },
    destinoPase: function(){ return {fecha: '2026-10-10', anio: 2026, mes: 9}; },
    errorEn: function(id, msg){ errores.push(msg); }, anioExiste: function(){ return true; }, cerrarHoja: function(){}, renderTrabajo: function(){},
    MESES: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], tjId: function(){ return 'nuevo'; }, fARS: function(n){ return String(n); },
    tjAntes: null, paseQuitado: null, tieneTrab: function(){ return true; }, toast: function(m){ toasts.push(m); }
  }, PASE_FUNCS);
  a.toasts = toasts; a.errores = errores;
  return a;
}
function abrir(a, ls){ H.cargarEn(a, ls, 2026); a.T = a.leerTrab(); return a; }
// what the stored pair says: the row amount, the pases in Trabajo and both revisions
function estado(ls){
  var y = JSON.parse(ls.d[Y]), t = JSON.parse(ls.d[TR]), r = y.meses[9].ingresos.filter(function(x){ return x.nombre === 'Del trabajo'; });
  return {fila: r.length ? r[0].monto : 0, pases: t.pases.length, revY: y.rev, revT: t.rev, diario: DI in ls.d};
}

test('L8 a pase writes both blobs and leaves no journal behind', function(){
  var ls = H.fakeStorage(inicial()), a = abrir(app(ls), ls);
  a.guardarPase();
  assert.deepEqual(estado(ls), {fila: 100000, pases: 1, revY: 5, revT: 3, diario: false});
  assert.deepEqual([a.D.rev, a.T.rev, a.sucio, a.toasts.length], [5, 3, false, 1], 'memory follows the stored revisions');
  assert.equal(ls.log.indexOf(DI) < ls.log.indexOf(Y) && ls.log.indexOf(Y) < ls.log.indexOf(TR), true, 'journal first, then the year, then Trabajo');
});

test('L8 crash between the two writes: the next start finishes Trabajo (both), and a second start changes nothing (never twice)', function(){
  var init = inicial(), ls = almacenQueMuere(init, TR), a = abrir(app(ls), ls);
  a.guardarPase();   // the year was written, the tab dies on the Trabajo write
  assert.equal(JSON.parse(ls.d[Y]).meses[9].ingresos[0].monto, 100000, 'precondition: the year row was written');
  assert.equal(ls.d[TR], init[TR], 'precondition: Trabajo was not');
  assert.ok(ls.d[DI], 'precondition: the journal is there');
  var vivo = H.fakeStorage(ls.d), b = app(vivo);
  assert.equal(b.recuperarDiario(), 'completado');
  assert.deepEqual(estado(vivo), {fila: 100000, pases: 1, revY: 5, revT: 3, diario: false}, 'the pase is in both pockets exactly once');
  var antes = JSON.stringify(vivo.d), c = app(vivo);
  assert.equal(c.recuperarDiario(), '');
  assert.equal(JSON.stringify(vivo.d), antes, 'no double apply');
});

test('L8 crash after the journal, before any blob: the next start writes both', function(){
  var ls = almacenQueMuere(inicial(), Y), a = abrir(app(ls), ls);
  a.guardarPase();
  assert.deepEqual([JSON.parse(ls.d[Y]).rev, JSON.parse(ls.d[TR]).rev, !!ls.d[DI]], [4, 2, true], 'precondition: nothing written but the journal');
  var vivo = H.fakeStorage(ls.d);
  assert.equal(app(vivo).recuperarDiario(), 'completado');
  assert.deepEqual(estado(vivo), {fila: 100000, pases: 1, revY: 5, revT: 3, diario: false});
});

test('L8 crash after both writes, before the journal is deleted: the next start only deletes it', function(){
  var ls = almacenQueMuere(inicial(), null), a = abrir(app(ls), ls);
  var rm = ls.removeItem;
  ls.removeItem = function(k){ if(k === DI) throw new Error('crash'); return rm(k); };
  a.guardarPase();
  var y = ls.d[Y], t = ls.d[TR];
  ls.removeItem = rm;
  assert.ok(ls.d[DI], 'precondition');
  assert.equal(app(ls).recuperarDiario(), 'hecho');
  assert.deepEqual([ls.d[Y] === y, ls.d[TR] === t, DI in ls.d], [true, true, false]);
});

test('L8 a stale journal is not replayed: another tab changed Trabajo after the crash, so nothing is written and the journal goes to quarantine', function(){
  var ls = almacenQueMuere(inicial(), TR), a = abrir(app(ls), ls);
  a.guardarPase();
  var vivo = H.fakeStorage(ls.d), otra = app(vivo);
  otra.T = otra.leerTrab(); otra.T.tope = 5; assert.equal(otra.guardarTrab(true), true, 'another tab saves Trabajo (rev 3)');
  var y = vivo.d[Y], t = vivo.d[TR], diario = vivo.d[DI];
  assert.equal(app(vivo).recuperarDiario(), 'apartado');
  assert.deepEqual([vivo.d[Y] === y, vivo.d[TR] === t], [true, true], 'no blob is touched (the other tab\'s save survives)');
  assert.equal(vivo.d['kibo.cuarentena.diario'], diario, 'the journal is kept as is, in quarantine');
  assert.equal(DI in vivo.d, false);
});

test('L8 a journal that is not ours (unreadable, or naming a key that is not a data blob) is quarantined and never written', function(){
  ['{roto', JSON.stringify({version: 1, blobs: [{clave: 'kibo.anio', hay: true, rev: 0, roto: false, texto: '{"x":1}'}]})].forEach(function(txt){
    var ls = H.fakeStorage(Object.assign(inicial(), {[DI]: txt, 'kibo.anio': '2026'})), antes = [ls.d[Y], ls.d[TR], ls.d['kibo.anio']];
    assert.equal(app(ls).recuperarDiario(), 'apartado');
    assert.deepEqual([ls.d[Y], ls.d[TR], ls.d['kibo.anio']], antes);
    assert.equal(ls.d['kibo.cuarentena.diario'], txt);
  });
});

test('L8 the journal does not fit (quota): the pase is refused cleanly, nothing written, memory as before', function(){
  var init = inicial(), ls = H.fakeStorage(init, function(k){ return k === DI; }), a = abrir(app(ls), ls);
  a.guardarPase();
  assert.deepEqual([ls.d[Y], ls.d[TR], DI in ls.d], [init[Y], init[TR], false]);
  assert.deepEqual([a.T.pases.length, a.D.meses[9].ingresos.length, a.toasts.length, a.errores.length, a.obsoleta], [0, 0, 0, 1, false]);
  assert.ok(a.g.pildoras.some(function(p){ return p[0] === 'No se pudo guardar' && p[1]; }));
});

test('L8 the Trabajo write fails while the tab lives: the year goes back to what it was, no journal, memory as before', function(){
  var init = inicial(), ls = H.fakeStorage(init, function(k){ return k === TR; }), a = abrir(app(ls), ls);
  a.guardarPase();
  assert.deepEqual([ls.d[Y], ls.d[TR], DI in ls.d], [init[Y], init[TR], false], 'neither pocket has the pase');
  assert.deepEqual([a.T.pases.length, a.D.meses[9].ingresos.length, a.D.rev, a.T.rev, a.obsoleta], [0, 0, 4, 2, false]);
});

test('L8 removing a pase and undoing it go through the journal too', function(){
  var ls = H.fakeStorage(inicial()), a = abrir(app(ls), ls);
  a.guardarPase(); a.quitarPase('nuevo', true);
  assert.deepEqual(estado(ls), {fila: 0, pases: 0, revY: 6, revT: 4, diario: false});
  a.reponerPase();
  assert.deepEqual(estado(ls), {fila: 100000, pases: 1, revY: 7, revT: 5, diario: false});
  var c = almacenQueMuere(ls.d, TR), b = abrir(app(c), c);
  b.quitarPase('nuevo', true);   // dies between the writes of a removal
  var vivo = H.fakeStorage(c.d);
  assert.equal(app(vivo).recuperarDiario(), 'completado');
  assert.deepEqual(estado(vivo), {fila: 0, pases: 0, revY: 8, revT: 6, diario: false}, 'the money is in neither pocket only after both writes: removed from both');
});

test('L8 kibo.diario is a device key: not an own key, never in a backup, a rollback does not delete it', function(){
  var a = app(H.fakeStorage(inicial()));
  assert.equal(a.claveMia(DI), false);
  assert.equal(a.claveMia('kibo.cuarentena.diario'), false);
  var ls = H.fakeStorage(Object.assign(inicial(), {[DI]: 'x'})), b = abrir(app(ls), ls);
  assert.equal(JSON.stringify(b.armarCopia()).indexOf('diario'), -1, 'not in the backup');
});

test('L8 start-up order: the journal is recovered before anything is read or saved, its notice after the screen is built', function(){
  var src = la.SRC_FOR_TESTS, base = src.indexOf('14 · arranque'), i = src.indexOf('var diario = hayLS ? recuperarDiario()');
  assert.ok(base > 0 && i > base);
  ['var actualizado130 = seguroActualizacion();', 'T = leerTrab();', 'var abonosNuevos = generarAbonos();', '\ncargar();'].forEach(function(s){
    assert.ok(src.indexOf(s, base) > i, s + ' comes after the recovery');
  });
  assert.ok(src.indexOf("if(diario === 'apartado' || diario === 'pendiente') avisoDiario(diario);") > src.indexOf('\ncargar();'));
  assert.match(src, /if\(diario === 'pendiente'\) obsoleta = true;/);
});
