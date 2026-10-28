'use strict';
// N2-B repair (S1, user-initiated, reversible): legacy data saved by the old matcher can hold [variant "Dél trabajo" unticked, exact
// "Del trabajo" ticked] in one month; flujosMes used to allocate the month's pases to the "Del trabajo" rows IN ORDER, so the variant
// absorbed the pase and the user's unticked amount counted as realized (L-03d). Since owner-decisions-closure D1 (N2-B option b) the
// engine gives the pases to the single exact row first, so ordering changes no total; the repair stays to tidy the stored order. It only
// REORDERS the rows (the exact row first, nothing renamed, no amount or tick changed), after the user saw a preview, keeps a copy of the
// months for «Deshacer», and refuses in a stale tab.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var H = require('./fixtures/r45-harness');
var C = require('./fixtures/r4-casos');

var M = la.loadMotor();
var Y = 'kibo.datos.2026', REP = 'kibo.reparoTrabajo.2026';
function plain(x){ return JSON.parse(JSON.stringify(x)); }

// 2026 with the month-to-month balance from October; today 2026-10-15
//   Mar (2, before desde): variant then exact -> orderable (no money effect: not month-to-month)
//   Jun (5): exact already first -> nothing to do
//   Aug (7): two exact rows -> ambiguous, listed, never touched
//   Oct (9): variant 100.000 unticked, exact 300.000 ticked, a 300.000 pase -> orderable, the money changes
function datos(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 2, {ingresos: [C.it('Dél trabajo', 1000, false), C.it('Sueldo', 5000, true), C.it('Del trabajo', 2000, true)]});
  C.mes(d, 5, {ingresos: [C.it('Del trabajo', 2000, true), C.it('Dél trabajo', 700, false)]});
  C.mes(d, 7, {ingresos: [C.it('del trabajo ', 1000, true), C.it('DEL TRABAJO', 2000, true)]});
  C.mes(d, 9, {ingresos: [C.it('Dél trabajo', 100000, false), C.it('Del trabajo', 300000, true)]});
  return d;
}
var FUNCS = ['mesesTrabajoDoble', 'avisoTrabajoDoble', 'exactoTrabajo', 'planOrdenTrabajo', 'conOrdenTrabajo', 'efectoOrdenTrabajo', 'abrirOrdenTrabajo',
  'ordenarTrabajo', 'leerReparo', 'deshacerOrdenTrabajo', 'olvidarOrdenTrabajo', 'guardar', 'copiaDelSiguiente', 'escribirConRev', 'revGuardada', 'blobAlDia', 'esc', 'listaY', 'copiaJSON', 'mesDelModelo', 'ctxModelo'];
function app(store){
  var d = datos(), ls = H.fakeStorage(store || {}), g = {hojas: [], toasts: [], alertas: [], otra: 0, renders: 0, pild: []};
  if(!store) ls.d[Y] = JSON.stringify(Object.assign(M.normalizar(C.copy(d), C.hoy('2026-10-15')), {rev: 1}));
  var a = H.appVista(JSON.parse(ls.d[Y]), H.trab([{fecha: '2026-10-05', monto: 300000}]), null, '2026-10-15', {funcs: FUNCS, vars: ['MESES', 'LSREPARO', 'LSCUAR', 'LSTRAB', 'LSDIARIO'],
    globals: {localStorage: ls, arrancado: true, tGuardar: null, obsoleta: false, releerDic: 0, sucio: false, hayLS: true, ultPild: 0,
      estado: function(){}, quitarAvisoVacia: function(){}, pildora: function(t){ g.pild.push(t); }, avisoCuarentena: function(){},
      avisoOtraPestana: function(){ g.otra++; }, toast: function(t, l, act){ g.toasts.push([t, l || '', act || '']); }, alerta: function(t, c){ g.alertas.push([t, c]); },
      abrirHoja: function(h){ g.hojas.push(h); }, cerrarHoja: function(){}, renderTrabajo: function(){ g.renders++; },
      fARS: function(n){ return '$' + Math.round(n); }, document: {getElementById: function(){ return null; }}}});
  a.D.rev = 1;
  a.g = g; a.ls = ls;
  return a;
}
function flujo(d, j){
  var a = H.appVista(d, H.trab([{fecha: '2026-10-05', monto: 300000}]), null, '2026-10-15'), vm = a.vistaModelo(a.D, a.hoy);
  var f = plain(M.flujosMes(a.D, j, a.hoy, vm.ctx));
  return [f.ingresosReal, f.trabajoRealizado, f.ingresosPend];
}
function filas(d, j){ return plain(d.meses[j].ingresos).map(function(x){ return [x.nombre, x.monto, x.pagado]; }); }

test('N2-B repair: the plan lists every month with two "Del trabajo" rows; only an unambiguous misordered month is ordered', function(){
  var a = app(), p = plain(a.planOrdenTrabajo(a.D));
  assert.deepEqual(p.map(function(x){ return [x.mes, x.ordenar, x.ambiguo]; }), [[2, true, false], [5, false, false], [7, false, true], [9, true, false]]);
  assert.deepEqual(plain(a.conOrdenTrabajo(a.D.meses[9].ingresos, p[3])).map(function(x){ return x.nombre; }), ['Del trabajo', 'Dél trabajo']);
  assert.deepEqual(plain(a.conOrdenTrabajo(a.D.meses[2].ingresos, p[0])).map(function(x){ return x.nombre; }), ['Del trabajo', 'Dél trabajo', 'Sueldo'],
    'the exact row moves to where the first "Del trabajo" row was; the other rows keep their order');
  assert.match(a.avisoTrabajoDoble(a.D), /Lo que pasás desde Trabajo cuenta primero en el renglón llamado exactamente «Del trabajo»: revisalos en Mes/,
    'D1: the notice no longer says the money is split among the rows');
});
test('N2-B repair: the preview shows the rows, amounts, ticks and what changes in cobrado / sin cobrar; nothing is written', function(){
  var a = app(), antes = JSON.stringify(a.ls.d);
  assert.deepEqual(plain(a.efectoOrdenTrabajo(a.D, a.planOrdenTrabajo(a.D)[3], a.hoy)), {antes: {cobrado: 300000, pendiente: 100000}, despues: {cobrado: 300000, pendiente: 100000}},
    'D1: the engine already gives the pase to the exact row, so ordering changes no total');
  assert.equal(a.efectoOrdenTrabajo(a.D, a.planOrdenTrabajo(a.D)[0], a.hoy), null, 'a month before the month-to-month balance: no total changes');
  a.abrirOrdenTrabajo();
  var h = a.g.hojas[0];
  assert.match(h, /Octubre: «Dél trabajo» \$100000 \(sin cobrar\), «Del trabajo» \$300000 \(cobrado\)/);
  assert.match(h, /Octubre: [^<]*Queda primero «Del trabajo»\. No cambia ningún total de ese mes\./, 'no before → after when nothing changes');
  assert.doesNotMatch(h, /Cobrado: /);
  assert.match(h, /Marzo: «Dél trabajo» \$1000 \(sin cobrar\), «Del trabajo» \$2000 \(cobrado\)\. Queda primero «Del trabajo»\. No cambia ningún total de ese mes\./);
  assert.match(h, /Agosto: hay más de un renglón llamado exactamente «Del trabajo»: no lo ordeno, revisalo en Mes\./);
  assert.doesNotMatch(h, /Junio/, 'a month already in order is not offered');
  assert.match(h, /data-act="tjDobleOrdenar"/);
  assert.match(h, /No cambio nombres, montos ni tildes/);
  assert.equal(JSON.stringify(a.ls.d), antes, 'the preview writes nothing');
});
test('N2-B repair: ordering changes only the order of the rows, keeps a copy first, and the money follows the intended semantics', function(){
  var a = app(), antes = plain(a.D);
  assert.deepEqual(flujo(antes, 9), [0, 300000, 100000], 'before: since D1 the unticked 100.000 already stays pending (L-03d)');
  assert.equal(a.ordenarTrabajo(), true);
  var guardado = JSON.parse(a.ls.d[Y]);
  [2, 9].forEach(function(j){
    var x = filas(guardado, j), y = filas(antes, j);
    assert.deepEqual(x.slice().sort(), y.slice().sort(), 'same rows (names, amounts, ticks), month ' + j);
    assert.notDeepEqual(x, y, 'reordered, month ' + j);
  });
  assert.deepEqual(filas(guardado, 9), [['Del trabajo', 300000, true], ['Dél trabajo', 100000, false]]);
  for(var j = 0; j < 12; j++) if(j !== 2 && j !== 9) assert.deepEqual(guardado.meses[j], antes.meses[j], 'month ' + j + ' untouched (ambiguous or in order included)');
  assert.deepEqual(flujo(guardado, 9), [0, 300000, 100000], 'after: the pase on the exact row, the variant pending');
  var rep = JSON.parse(a.ls.d[REP]);
  assert.deepEqual(Object.keys(rep.meses), ['2', '9']);
  assert.deepEqual(rep.meses[9].antes, antes.meses[9].ingresos, 'the copy holds the months as they were');
  assert.equal(a.ls.log.indexOf(REP) < a.ls.log.lastIndexOf(Y), true, 'the copy is written before the year');
  assert.equal(guardado.rev, 2);
  assert.deepEqual(a.g.toasts[0], ['Ordené los renglones «Del trabajo» de Marzo y Octubre', 'Deshacer', 'tjDobleDeshacer']);
  assert.match(a.avisoTrabajoDoble(a.D), /data-act="tjDobleDeshacer"/, 'the undo stays in the notice after the toast');
});
test('N2-B repair: «Deshacer» puts back the previous order: every month byte-identical, the copy removed', function(){
  var a = app(), antes = JSON.stringify(a.D.meses), guardadoAntes = JSON.stringify(JSON.parse(a.ls.d[Y]).meses);
  a.ordenarTrabajo();
  assert.equal(a.deshacerOrdenTrabajo(), true);
  assert.equal(JSON.stringify(a.D.meses), antes);
  assert.equal(JSON.stringify(JSON.parse(a.ls.d[Y]).meses), guardadoAntes, 'stored months byte-identical to before the repair');
  assert.equal(REP in a.ls.d, false);
  assert.deepEqual(flujo(JSON.parse(a.ls.d[Y]), 9), [0, 300000, 100000], 'the unrepaired order reads the same since D1');
});
test('N2-B repair: a stale tab is refused, nothing written; undo is refused if the month changed after ordering', function(){
  var a = app(), antes = JSON.stringify(a.ls.d), mem = JSON.stringify(a.D);
  var otro = JSON.parse(a.ls.d[Y]); otro.rev = 5; a.ls.d[Y] = JSON.stringify(otro); antes = JSON.stringify(a.ls.d);   // another tab saved
  assert.equal(a.ordenarTrabajo(), false);
  assert.equal(JSON.stringify(a.ls.d), antes, 'nothing written, no copy');
  assert.equal(JSON.stringify(a.D), mem, 'memory untouched');
  assert.equal(a.g.otra, 1);
  assert.equal(a.obsoleta, true);
  var b = app();
  b.ordenarTrabajo();
  b.D.meses[9].ingresos[1].monto = 120000; b.guardar();   // the user edits October after ordering
  var st = JSON.stringify(b.ls.d);
  assert.equal(b.deshacerOrdenTrabajo(), false);
  assert.equal(JSON.stringify(b.ls.d), st, 'nothing undone');
  assert.deepEqual(b.g.alertas[0], ['No deshice el orden', 'Cambiaste Octubre después de ordenar: deshacerlo ahora borraría ese cambio. No cambié nada.']);
  var c = app();
  c.ordenarTrabajo();
  var o2 = JSON.parse(c.ls.d[Y]); o2.rev = 9; c.ls.d[Y] = JSON.stringify(o2); st = JSON.stringify(c.ls.d);
  assert.equal(c.deshacerOrdenTrabajo(), false, 'stale tab: undo refused too');
  assert.equal(JSON.stringify(c.ls.d), st);
});
test('N2-B repair: the notice offers the repair only when a month can be ordered; «Listo» forgets the copy', function(){
  var a = app();
  assert.match(a.avisoTrabajoDoble(a.D), /data-act="tjDobleVer"/);
  var d = C.vacio(2026); C.mes(d, 7, {ingresos: [C.it('del trabajo ', 1000, true), C.it('DEL TRABAJO', 2000, true)]});
  a.D = a.normalizar(d, a.hoy);
  assert.match(a.avisoTrabajoDoble(a.D), /hay más de un renglón/);
  assert.doesNotMatch(a.avisoTrabajoDoble(a.D), /tjDobleVer/, 'only ambiguous months: no repair offered');
  var b = app();
  b.ordenarTrabajo();
  b.olvidarOrdenTrabajo();
  assert.equal(REP in b.ls.d, false);
  assert.doesNotMatch(b.avisoTrabajoDoble(b.D), /tjDobleDeshacer/);
});
