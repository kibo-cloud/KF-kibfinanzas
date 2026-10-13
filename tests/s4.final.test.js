'use strict';
// Final audit fixes (sprint closure, odd/tasks/stabilization-quick-sales.md "Final audit fixes"). Each block turns one audit probe
// (scratchpad fin/ and sec2/) into a test and pins the fixed behavior. No money rule changes: the motor goldens stay byte-identical.
var test = require('node:test');
var assert = require('node:assert/strict');
var H = require('./fixtures/r45-harness');
var C = require('./fixtures/r4-casos');
var la = require('./load-app');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }

// 2026 (model year) and 2027 created from it by the real duplicar
function creado(raw26, hoyIso){
  var y26 = M.normalizar(C.copy(raw26), C.hoy(hoyIso));
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, hoyIso);
  app.D = app.leerAnio(2026); app.duplicar();
  return ls;
}
// what the Patrimonio tab shows for the stored year `anio` (opened as the app opens it: leerAnio)
function patrimonio(store, anio, hoyIso, T){
  var a = H.appVista(null, T || null, store, hoyIso);
  a.D = a.leerAnio(anio);
  var p = a.plain(a.patrimonioPantalla(a.D, a.hoy)).modelo;
  return {disp: p.disponible, ahorro: p.ahorroARS, bruto: p.bruto, campo: a.D.ahorroAnioAnterior};
}

// ── 1 (HIGH): a 2027 created by 1.32/1.33 has no stored copiaDiciembre. leerAnio adopts December as the copy in memory only, so after a
// December edit the stored field looked user-edited and froze while the Disponible followed live (bruto -100.000, no notice) ──
function anioSinCopia(){
  var ls = creado(C.seccion2(true, true), '2026-12-20');
  var y27 = JSON.parse(ls.d['kibo.datos.2027']); delete y27.copiaDiciembre; ls.d['kibo.datos.2027'] = JSON.stringify(y27);
  return ls;
}
test('1: open 2027 (no stored copy), switch to 2026, edit December, back to 2027: nothing appears or disappears (I4)', function(){
  var ls = anioSinCopia(), antes = patrimonio(ls.d, 2027, '2027-01-10');
  var app = H.appAlmacen(ls, '2027-01-10');
  app.D = app.leerAnio(2027);                       // opened: the copy is adopted in memory, nothing saved
  app.D = app.leerAnio(2026);                       // the user switches to 2026
  app.D.meses[11].ahorroMesARS = 100000; app.sucio = true;
  assert.equal(app.guardar(), true);
  app.D = app.leerAnio(2027);                       // back to 2027
  var despues = patrimonio(ls.d, 2027, '2027-01-10');
  assert.equal(despues.bruto, antes.bruto, 'bruto unchanged');
  assert.equal(despues.ahorro, 900000);
  assert.equal(app.D.ahorroAnioAnterior, 900000, 'the field follows December');
  assert.equal(JSON.parse(ls.d['kibo.datos.2027']).copiaDiciembre.ahorro, 800000, 'the copy of the pre-edit December was stored');
});
test('1: the stored copy is written only when missing; a year that already has one, or does not follow December, is not rewritten', function(){
  var ls = creado(C.seccion2(true, true), '2026-12-20'), y27 = ls.d['kibo.datos.2027'];
  var app = H.appAlmacen(ls, '2027-01-10');
  app.D = app.leerAnio(2026); app.D.meses[11].ahorroMesARS = 100000; app.sucio = true;
  assert.equal(app.guardar(), true);
  assert.equal(ls.d['kibo.datos.2027'], y27, 'a year with its stored copy is untouched');
  var leg = creado(H.sinModelo(C.seccion2(true, true)), '2026-12-20'), l27 = JSON.parse(leg.d['kibo.datos.2027']);
  delete l27.copiaDiciembre; leg.d['kibo.datos.2027'] = JSON.stringify(l27);
  var b = H.appAlmacen(leg, '2027-01-10'), txt = leg.d['kibo.datos.2027'];
  b.D = b.leerAnio(2026); b.D.meses[11].ahorroMesARS = 100000; b.sucio = true;
  assert.equal(b.guardar(), true);
  assert.equal(leg.d['kibo.datos.2027'], txt, 'a legacy year does not follow December: untouched');
});
test('1: if the copy of the next year cannot be written, the December edit is not saved either (no silent drift)', function(){
  var ls = anioSinCopia(), d26 = ls.d['kibo.datos.2026'];
  var falla = H.fakeStorage(ls.d, function(k){ return k === 'kibo.datos.2027'; });
  var app = H.appAlmacen(falla, '2027-01-10');
  app.D = app.leerAnio(2026); app.D.meses[11].ahorroMesARS = 100000; app.sucio = true;
  assert.equal(app.guardar(), false);
  assert.equal(falla.d['kibo.datos.2026'], d26, 'December not written');
  assert.equal(app.sucio, true, 'the edit stays pending, as any failed save');
  assert.equal(JSON.parse(falla.d['kibo.datos.2027']).copiaDiciembre, undefined);
});
test('1: a pase written into 2026 (year + Trabajo together) stores the copy of 2027 first, too', function(){
  var ls = anioSinCopia(), app = H.appAlmacen(ls, '2027-01-10');
  app.D = app.leerAnio(2026); app.D.meses[11].ahorroMesARS = 100000;
  assert.equal(app.escribirJuntos([{clave: 'kibo.datos.2026', obj: app.D}, {clave: 'kibo.trabajo', obj: app.T}], 'pase'), 'ok');
  assert.equal(JSON.parse(ls.d['kibo.datos.2027']).copiaDiciembre.ahorro, 800000);
  assert.equal(patrimonio(ls.d, 2027, '2027-01-10').ahorro, 900000);
});

// ── 2 (HIGH): a backup WITH Trabajo restores 2026 only; this phone's Trabajo passed money to 2025, which the phone keeps. The restored
// Trabajo has no pase into 2025 while the 2025 "Del trabajo" row stays: the money counted twice (Trabajo disponible 700.000 -> 1.000.000) ──
function hojaRestaurar(copia, pasesTel, aniosTel){
  var guardados = {};
  (aniosTel || []).forEach(function(y){ guardados['kibo.datos.' + y] = JSON.stringify(C.vacio(y)); });
  var ls = H.fakeStorage(guardados), a = H.appAlmacen(ls, '2026-10-15', {tieneTrab: function(){ return !!pasesTel; }}, ['avisoCopiaTrabajo', 'mezclaTrabajo', 'aniosDePases', 'descTrabajo', 'fARS', 'esc']);
  a.D = a.normalizar(C.vacio(2026), a.hoy);
  if(pasesTel) a.T.pases = pasesTel.map(function(f, i){ return {id: 'p' + i, fecha: f, monto: 300000, anio: +f.slice(0, 4), mes: +f.slice(5, 7) - 1, creada: f + 'T00:00:00.000Z'}; });
  var antes = JSON.stringify(ls.d), tAntes = JSON.stringify(a.T);
  a.pendiente = null;
  a.restaurarTexto(JSON.stringify(copia));
  return {hoja: a.g.hojas[a.g.hojas.length - 1] || '', alertas: a.g.alertas, a: a, ls: ls, intacto: JSON.stringify(ls.d) === antes && JSON.stringify(a.T) === tAntes};
}
function copiaDe(anios, tr){ var o = {app: 'TuGasto', version: 1, anios: {}}; anios.forEach(function(y){ o.anios[y] = C.vacio(y); }); if(tr) o.trabajo = tr; return o; }
test('2: a backup with Trabajo that would drop this phone\'s pases into a year the phone keeps is refused; nothing written', function(){
  var r = hojaRestaurar(copiaDe([2026], H.trab([], 1000000)), ['2025-12-20'], [2025, 2026]);
  assert.equal(r.hoja, '', 'no confirmation sheet');
  assert.equal(r.a.pendiente, null);
  assert.equal(r.intacto, true);
  assert.deepEqual(r.alertas, [['No restauré la copia', 'El Trabajo de este teléfono pasó plata a lo personal en 2025, que la copia no trae y este teléfono conserva, pero el Trabajo de la copia no tiene eso: los renglones «Del trabajo» y Trabajo dejarían de coincidir. Restaurá una copia completa (con todos esos años), o hacé primero una copia de seguridad de lo que tenés en este teléfono. No cambié nada.']]);
});
test('2: restores without that conflict are still offered (the year comes in the backup; the phone does not have it; pases only into replaced years)', function(){
  var tr = H.trab([{fecha: '2025-12-20', monto: 300000}], 1000000);
  [[copiaDe([2025, 2026], tr), ['2025-12-20'], [2025, 2026]],    // the backup brings 2025 too
   [copiaDe([2026], H.trab([], 1000000)), ['2025-12-20'], [2026]],   // the phone does not keep 2025: no row to count twice
   [copiaDe([2026], H.trab([], 1000000)), ['2026-03-10'], [2025, 2026]]   // the phone's pases go to the year the backup replaces
  ].forEach(function(c, i){
    var r = hojaRestaurar(c[0], c[1], c[2]);
    assert.equal(r.alertas.length, 0, 'case ' + i);
    assert.equal(typeof r.a.pendiente, 'function', 'case ' + i);
    assert.match(r.hoja, /Va a <b>reemplazar<\/b>/);
  });
});

// ── 3 (MEDIUM): re-saving the plan sheet in 2027 offers to load installments without the shift duplicar applies (the ones December 2026
// still schedules unpaid already have their month): «poner 3», then cuotasDeMas flagged 2 extra ──
function anioConPlan(){
  var ls = creado(C.seccion2(false, false), '2026-10-15'), g = {preguntas: [], alertas: [], toasts: []};
  var a = H.appVista(null, null, ls.d, '2026-10-20', {funcs: ['ofrecerCarga', 'conCuotasDeDiciembre', 'cuotasDeMas', 'esc'], vars: ['MESES'],
    globals: {preguntar: function(t, c, b, fn){ g.preguntas.push(c); fn(); }, alerta: function(t, c){ g.alertas.push([t, c]); }, tocar: function(){}, renderMes: function(){},
      toast: function(t){ g.toasts.push(t); }, fARS: function(n){ return '$' + Math.round(n); }}});
  a.D = a.leerAnio(2027); a.g = g;
  return a;
}
function filasPrestamo(d){ return d.meses.filter(function(m){ return m.deudas.some(function(r){ return r.nombre === 'Préstamo' && r.monto > 0; }); }).length; }
test('3: loading installments from the plan sheet counts what December still schedules: one more, none extra', function(){
  var a = anioConPlan();
  assert.equal(a.cuotasProgramadas(a.leerAnio(2026), 'Préstamo'), 2, 'December 2026 still schedules 2 unpaid');
  a.ofrecerCarga('Préstamo', 0);
  assert.equal(a.g.toasts.length, 1);
  assert.match(a.g.toasts[0], /^Cargué 1 cuota de /);
  assert.equal(filasPrestamo(a.D), 1);
  assert.deepEqual(a.plain(a.cuotasDeMas(a.D)), []);
  assert.equal(a.D.planDeudas['Préstamo'].pagadasAntes, 3, 'pagadasAntes keeps saying what was PAID');
});
test('3: a year that does not follow December live loads as before (no shift)', function(){
  var a = anioConPlan();
  delete a.D.arrastre;   // legacy year
  a.ofrecerCarga('Préstamo', 0);
  assert.match(a.g.toasts[0], /^Cargué 3 cuotas de /);
  assert.equal(a.D.planDeudas['Préstamo'].pagadasAntes, 3);
});

// ── 4 (MEDIUM): 2025 has no month-to-month balance (legacy) and 2026 declares it from October. A pase dated 2025-12-20 left Trabajo and
// never reached the 2026 Disponible (bruto -300.000): desdeDelSaldo said -1 for a year without arrastre. Refused like M1, pointing to
// where the balance starts; deleting such a pase is refused too ──
function appPaseAnios(fecha, conModelo){
  var y25 = C.vacio(2025), y26 = C.vacio(2026);
  y25.meses[11].ingresos = [C.it('Del trabajo', 0, true)];
  if(conModelo !== false) C.arrastre(y26, 9, 100000, 'declarado');
  var store = {'kibo.datos.2025': JSON.stringify(M.normalizar(C.copy(y25), C.hoy('2026-10-15'))), 'kibo.datos.2026': JSON.stringify(M.normalizar(C.copy(y26), C.hoy('2026-10-15')))};
  var g = {campos: {psFecha: fecha, psMonto: '1000'}, notas: [], aplicados: [], alertas: [], escritos: 0, boton: {textContent: 'Pasar'}, nota: {className: '', innerHTML: ''}};
  var a = H.appVista(JSON.parse(store['kibo.datos.2026']), H.trab([], 500000), store, '2026-10-15', {funcs: ['guardarPase', 'notaPase', 'destinoPase', 'anioExiste', 'avisoPaseAntes', 'desdeDelSaldo', 'inicioDelSaldo', 'aniosGuardados', 'quitarPase', 'sacarPaseT', 'tjId', 'sumarPaseT', 'fDiaLargo'], vars: ['MESES'],
    globals: {val: function(id){ return g.campos[id] || ''; }, leerMonto: function(id){ var v = Number(g.campos[id]); return {ok: true, v: v, vacio: !g.campos[id]}; },
      errorEn: function(id, t){ g.notas.push(t); }, aplicarPase: function(p, signo, cambiarT){ g.aplicados.push(p); cambiarT(); return true; }, alerta: function(t, c){ g.alertas.push([t, c]); },
      guardarTrab: function(){ g.escritos++; }, paseQuitado: null, confirmar: function(t, c, b, fn){ fn(); },
      cerrarHoja: function(){}, renderTrabajo: function(){}, toast: function(){}, fARS: function(n){ return '$' + n; }, tjAntes: null, obsoleta: false, RENGLON_TRABAJO: 'Del trabajo',
      document: {getElementById: function(id){ return id === 'psNota' ? g.nota : {focus: function(){}}; }, querySelector: function(){ return g.boton; }}}});
  a.resumenTrab = function(){ return {paraPasar: 500000}; };
  a.g = g; return a;
}
var NO_ANTES_ANIO = 'Esa fecha (20/12/2025) es anterior a Octubre 2026, desde cuando llevás el saldo mes a mes: pasarlo con esa fecha haría aparecer o desaparecer plata. Elegí una fecha desde Octubre 2026.';
test('4: a pase into a year without the month-to-month balance, before a later year that declares it, is refused', function(){
  var a = appPaseAnios('2025-12-20');
  assert.equal(a.avisoPaseAntes(a.destinoPase()), NO_ANTES_ANIO);
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 0, 'not saved');
  assert.deepEqual(a.g.notas, [NO_ANTES_ANIO]);
});
test('4: deleting a pase into such a year is refused; nothing changes', function(){
  var a = appPaseAnios('2026-10-10'), viejo = {id: 'p1', fecha: '2025-12-20', monto: 300000, anio: 2025, mes: 11, creada: '2025-12-20T00:00:00.000Z'};
  a.T.pases = [viejo];
  var antes = JSON.stringify(a.T);
  a.quitarPase('p1', true);
  assert.equal(JSON.stringify(a.T), antes);
  assert.equal(a.g.aplicados.length, 0);
  assert.deepEqual(a.g.alertas, [['No se puede borrar', 'Lo que pasaste el 20/12/2025 es anterior a Octubre 2026, desde cuando llevás el saldo mes a mes: el saldo con el que arrancaste ya la tiene en cuenta, así que borrarlo haría aparecer plata en Trabajo. No cambié nada.']]);
});
test('4: still allowed: a date from where the balance starts, and any date when no later year has the month-to-month balance', function(){
  var a = appPaseAnios('2026-10-10');
  assert.equal(a.avisoPaseAntes(a.destinoPase()), '');
  a.guardarPase(); assert.equal(a.g.aplicados.length, 1);
  var b = appPaseAnios('2025-12-20', false);
  assert.equal(b.avisoPaseAntes(b.destinoPase()), '');
  b.guardarPase(); assert.equal(b.g.aplicados.length, 1);
});
