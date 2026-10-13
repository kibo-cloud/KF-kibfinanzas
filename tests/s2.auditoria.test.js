'use strict';
// S2: end-to-end financial audit fixes (odd/tasks/stabilization-quick-sales.md, "S2 — Financial audit"). Each block reproduces one
// finding (the scratchpad probe turned into a test) and pins the fixed behavior. No money rule changes here: the fixes make the screens
// say what §1 already defines.
var test = require('node:test');
var assert = require('node:assert/strict');
var H = require('./fixtures/r45-harness');
var C = require('./fixtures/r4-casos');
var la = require('./load-app');

// ── H2: "Patrimonio neto a hoy" is computed on the year that contains today, whichever year is open ──
// 2026-12-10: the user creates 2027 (duplicar). With 2027 open, iHoy = -1 dropped the 2026 Disponible (3.980.000 -> 2.700.000).
function dosAnios(hoyIso){
  var M = la.loadMotor(), HOY = C.hoy('2026-12-10');
  var y26 = M.normalizar(C.copy(C.seccion2(true, true)), HOY);
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, '2026-12-10');
  H.cargarEn(app, ls, 2026); app.duplicar();
  var raw26 = ls.d['kibo.datos.2026'], raw27 = ls.d['kibo.datos.2027'], T = H.trab([], 500000);
  var extra = {funcs: ['htmlHeroPatri'], globals: {fARS: function(n){ return '$' + Math.round(n); }, fUSD: function(n){ return 'US$' + Math.round(n); }}};
  return {
    abierto: function(anio){
      var a = anio === 2026 ? H.appVista(JSON.parse(raw26), T, {'kibo.datos.2027': raw27}, hoyIso, extra)
                            : H.appVista(JSON.parse(raw27), T, {'kibo.datos.2026': raw26}, hoyIso, extra);
      return {a: a, p: a.plain(a.patrimonioPantalla(a.D, a.hoy))};
    }
  };
}
test('H2: Patrimonio neto a hoy is the same with 2026 or 2027 open (today 2026-12-10)', function(){
  var y = dosAnios('2026-12-10'), p26 = y.abierto(2026).p, p27 = y.abierto(2027).p;
  assert.equal(p26.patrimonioARS, 3980000);
  assert.equal(p27.patrimonioARS, p26.patrimonioARS);
  assert.deepEqual(p27.modelo, p26.modelo);
  assert.equal(p27.anio, 2026); assert.equal(p27.cierre, false);
});
test('H2: the hero says "a hoy" for the current year and "al cierre de <año>" for a past year', function(){
  var y = dosAnios('2026-12-10'), v = y.abierto(2027);
  assert.match(v.a.htmlHeroPatri(v.p), /Patrimonio neto a hoy/);
  var z = dosAnios('2027-02-10'), w = z.abierto(2026);
  assert.equal(w.p.cierre, true); assert.equal(w.p.anio, 2026);
  assert.match(w.a.htmlHeroPatri(w.p), /Patrimonio neto al cierre de 2026/);
  assert.doesNotMatch(w.a.htmlHeroPatri(w.p), /a hoy/);
});

// ── M2: quick-expense undo reverts the exact row it changed, even with two rows of the same name ──
var FUNCS_GASTO = ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'filaDelGasto', 'anotarMov'];
function appGasto(raw){
  var t = [];
  var a = H.appVista(raw, null, null, null, {funcs: FUNCS_GASTO, vars: ['gr'], globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
    abrirHoja: function(){}, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){},
    toast: function(x, ac, act, id){ t.push([x, ac, act, id]); }}});
  a.mes = 9; a.t = t; return a;
}
function mesCon(rows){ var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado'); C.mes(d, 9, {gastosVariables: rows}); return d; }
function filas(a){ return a.plain(a.D.meses[9].gastosVariables); }
test('M2: "Sí, es ese pago" on the second of two "Super" rows, then Deshacer: the month is exactly as before', function(){
  var a = appGasto(mesCon([C.it('Super', 30000, true), C.it('Super', 50000, false)])), antes = filas(a);
  a.gr = {monto: 50000, cat: 1, sec: 'gastosVariables'}; a.sumarGasto(); a.gastoEsPago();
  a.quitarMov(a.t[a.t.length - 1][3]);
  assert.deepEqual(filas(a), antes);
  assert.equal(a.D.meses[9].movimientos.length, 0);
});
test('M2: a plain quick expense on the second "Super" row, then Deshacer: the month is exactly as before', function(){
  var a = appGasto(mesCon([C.it('Super', 30000, true), C.it('Super', 0, false)])), antes = filas(a);
  a.gr = {monto: 20000, cat: 1, sec: 'gastosVariables'}; a.sumarGasto();
  a.quitarMov(a.t[a.t.length - 1][3]);
  assert.deepEqual(filas(a), antes);
});
test('M2: the row identity survives normalizar; old movements without it still undo by name', function(){
  var a = appGasto(mesCon([C.it('Super', 30000, true), C.it('Super', 0, false)]));
  a.gr = {monto: 20000, cat: 1, sec: 'gastosVariables'}; a.sumarGasto();
  var mv = a.plain(a.D.meses[9].movimientos[0]);
  assert.equal(mv.fi, 1);
  var n = a.normalizar(C.copy(a.D), a.hoy);
  assert.equal(n.meses[9].movimientos[0].fi, 1);
  var b = appGasto(mesCon([C.it('Luz', 5000, true)]));
  b.D.meses[9].movimientos.push({id: 'viejo', fecha: '', sec: 'gastosVariables', nombre: 'Luz', monto: 5000});
  b.quitarMov('viejo');
  assert.equal(b.D.meses[9].gastosVariables[0].monto, 0);
});

// ── L4: Deshacer from the toast after moving to another month undoes in the movement's own month, never silently nothing ──
test('L4: undo after switching month reverts the movement in its own month', function(){
  var a = appGasto(mesCon([C.it('Super', 0, false)])), antes = filas(a);
  a.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; a.sumarGasto();
  var id = a.t[a.t.length - 1][3];
  a.mes = 3;   // the user went to April before tapping Deshacer
  a.quitarMov(id);
  assert.deepEqual(filas(a), antes);
  assert.equal(a.D.meses[9].movimientos.length, 0);
  assert.equal(a.t[a.t.length - 1][0], 'Deshecho');
});
test('L4: an undo that finds nothing (another year open) says so', function(){
  var a = appGasto(mesCon([C.it('Super', 0, false)])), n = a.t.length;
  a.quitarMov('no-existe');
  assert.equal(a.t.length, n + 1);
  assert.match(a.t[a.t.length - 1][0], /no pude deshacer/i);
});

// ── L1: "Te quedan" in El año is income − expenses − installments, the §1 Resultado (it used to leave the installments out) ──
test('L1: El año "Te quedan" subtracts the installments (model year; a year without the model stays byte-identical)', function(){
  var V = require('./fixtures/anio-vistas'), d = C.vacio(2026), j;
  C.arrastre(d, 0, 0, 'declarado');
  for(j = 0; j < 3; j++) C.mes(d, j, {ingresos: [C.it('Sueldo', 100000, true)], gastosFijos: [C.it('Alquiler', 30000, true)], deudas: [C.it('Préstamo', 10000, true)]});
  var a = V.appAnio(d, {}, null, '2026-10-15'), html = a.anio();
  var m = /Te quedan <b>([^<]*)<\/b>/.exec(html);
  assert.ok(m, 'the sentence is there');
  assert.equal(m[1], a.fARS(60000));
});

// ── L2: the Trabajo CSV summary adds up: Cobrado − Gastos − Pasado (ya) = Disponible, with the scheduled pases on their own line ──
function csvResumen(T){
  var salida = '';
  var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
  var a = H.appVista(d, T, null, '2026-10-15', {funcs: ['csvTrabajo', 'csvTexto', 'pasesPersonal'], globals: {MESES: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    fDiaLargo: function(x){ return x; }, nombreForma: function(f){ return f; }, nombrePeriodo: function(){ return ''; }, largoPeriodo: function(){ return 7; },
    nomFac: function(f){ return f.cliente; }, facPorId: function(){ return null; }, nombreCat: function(){ return 'Otros'; }, fechaArchivo: function(){ return 'x'; },
    descargar: function(t){ salida = t; }}});
  a.tieneTrab = function(){ return true; };
  a.csvTrabajo();
  var r = {};
  salida.replace('﻿', '').split('\r\n').slice(salida.split('\r\n').indexOf('RESUMEN AL 2026-10-15')).forEach(function(l){ var p = l.split(';'); if(p.length === 2) r[p[0]] = Number(p[1].replace(',', '.')); });
  return r;
}
test('L2: Trabajo CSV summary splits the scheduled pases and adds up to Disponible', function(){
  var T = H.trab([{fecha: '2026-09-01', monto: 300000}, {fecha: '2026-11-01', monto: 200000}], 1000000);
  var r = csvResumen(T);
  assert.equal(r['Disponible del trabajo'], 700000);
  assert.equal(r['Pasado a lo personal'], 300000);
  assert.equal(r['Programado para pasar a lo personal'], 200000);
  assert.equal(r['Cobrado hasta hoy'] - r['Gastos hasta hoy'] - r['Pasado a lo personal'], r['Disponible del trabajo']);
});

// ── L3: "Hoy vendiste" counts every sale of today (a-plazo invoices too); the line under it says which part is not collected ──
test('L3: the "Hoy" line separates the a-plazo part from what was collected today', function(){
  var a = la.loadApp({funcs: ['lineaHoy'], globals: {fARS: function(n){ return '$' + Math.round(n); }, nombreForma: function(f){ return f === 'efectivo' ? 'Efectivo' : f; }}});
  var r = {hoyVentas: 3, hoyVendido: 100000, hoyAPlazo: 70000, hoyForma: {efectivo: 30000}, hayCosto: false, hoyGanancia: 0};
  assert.equal(a.lineaHoy(r), 'Hoy: 3 ventas · efectivo $30000 · a plazo, sin cobrar $70000');
  r = {hoyVentas: 1, hoyVendido: 30000, hoyAPlazo: 0, hoyForma: {efectivo: 30000}, hayCosto: false, hoyGanancia: 0};
  assert.equal(a.lineaHoy(r), 'Hoy: 1 venta · efectivo $30000');
});

// ── L5: a debt plan with no rows in any month still counts as a liability and had no way out; "Quitar plan" removes it (with a confirmation) ──
function appPlan(d){
  var g = {conf: [], toasts: [], renders: 0};
  var a = H.appVista(d, null, null, '2026-10-15', {funcs: ['quitarPlanSuelto', 'planSinRenglones', 'htmlPatrimonio', 'filasPatrimonio', 'esc'],
    globals: {fARS: function(n){ return '$' + Math.round(n); }, fUSD: function(n){ return 'US$' + n; }, hARS: function(n){ return '$' + Math.round(n); }, fechaCorta: function(x){ return x; },
      confirmar: function(t, c, e, fn){ g.conf.push([t, c, e]); fn(); }, tocar: function(){}, render: function(){ g.renders++; }, toast: function(t){ g.toasts.push(t); }}});
  a.g = g; return a;
}
test('L5: a plan without rows shows "Quitar plan"; removing it (after confirming) removes only that liability', function(){
  var d = C.vacio(2026);
  d.planDeudas = {'Préstamo': {total: 600000, recargo: 0, cuotas: 6, pagadasAntes: 2}, 'Tarjeta': {total: 120000, recargo: 0, cuotas: 4, pagadasAntes: 0}};
  C.mes(d, 9, {deudas: [C.it('Tarjeta', 30000, false)]});
  var a = appPlan(d), antes = a.plain(a.pasivos(a.D, a.hoy));
  var p = a.plain(a.patrimonioPantalla(a.D, a.hoy));
  if(p.modelo){ var html = a.htmlPatrimonio(p); assert.match(html, /data-act="quitarPlanSuelto" data-n="Préstamo"/); assert.doesNotMatch(html, /data-n="Tarjeta"/); }
  assert.equal(a.planSinRenglones(a.D, 'Préstamo'), true);
  assert.equal(a.planSinRenglones(a.D, 'Tarjeta'), false);
  a.quitarPlanSuelto('Tarjeta');   // has rows: nothing happens
  assert.equal(a.g.conf.length, 0);
  a.quitarPlanSuelto('Préstamo');
  assert.equal(a.g.conf.length, 1);
  assert.match(a.g.conf[0][1], /sigue contando como deuda/);
  var despues = a.plain(a.pasivos(a.D, a.hoy));
  assert.deepEqual(Object.keys(a.D.planDeudas), ['Tarjeta']);
  assert.deepEqual(despues.detalle, antes.detalle.filter(function(x){ return x.nombre !== 'Préstamo'; }));
});
test('L5: the composition of a model year offers "Quitar plan" for a plan without rows', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
  d.planDeudas = {'Préstamo': {total: 600000, recargo: 0, cuotas: 6, pagadasAntes: 2}};
  var a = appPlan(d), p = a.plain(a.patrimonioPantalla(a.D, a.hoy));
  assert.ok(p.modelo);
  assert.match(a.htmlPatrimonio(p), /<button[^>]*data-act="quitarPlanSuelto" data-n="Préstamo"[^>]*>Quitar plan<\/button>/);
});

// ── H1: the new year keeps a SNAPSHOT of what it copied from December (copiaDiciembre). A MODEL year read by the app (leerAnio) follows the
// live December for every copied field the user did not change (I4, R4.3; tests/h1.cruce.test.js); a LEGACY year never follows: the
// Patrimonio tab says December changed and the copied values stay as they are ──
function anioCreado(cambiar, legacy){
  var M = la.loadMotor(), HOY = C.hoy('2026-12-10');
  var raw = C.seccion2(true, true), y26 = M.normalizar(C.copy(legacy ? H.sinModelo(raw) : raw), HOY);
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, '2026-12-10');
  H.cargarEn(app, ls, 2026); app.duplicar();
  var raw26 = JSON.parse(ls.d['kibo.datos.2026']), raw27 = ls.d['kibo.datos.2027'];
  if(cambiar) cambiar(raw26);
  var a = H.appVista(JSON.parse(raw27), null, {'kibo.datos.2026': JSON.stringify(raw26), 'kibo.datos.2027': raw27}, '2027-01-10', {funcs: ['derivaAnioPrevio', 'avisoDerivaPrevio', 'cuotasDeMas', 'esc'], vars: ['MESES']});
  a.D = a.leerAnio(2027);   // as the app opens it
  return a;
}
test('H1: no notice while December still gives what the new year copied', function(){
  [false, true].forEach(function(legacy){
    var a = anioCreado(null, legacy);
    assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), []);
    assert.equal(a.avisoDerivaPrevio(a.D, a.hoy), '');
  });
});
test('H1: December savings and installments changed after creating a MODEL year: the year follows December; the January row now extra is named', function(){
  var a = anioCreado(function(d){ d.meses[11].ahorroMesARS = 99000; d.meses[11].deudas = [{nombre: 'Préstamo', monto: 100000, pagado: true}]; });
  assert.deepEqual([a.D.ahorroAnioAnterior, a.D.planDeudas['Préstamo'].pagadasAntes], [899000, 6]);
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), []);
  // the 6th installment was paid in December 2026: the January 2027 row duplicar loaded is now one too many (kept, D14; named)
  assert.equal(a.avisoDerivaPrevio(a.D, a.hoy), '<div class="aviso" data-av="cuotasDeMas" role="status"><p>Préstamo: en 2027 hay 1 cuota cargada de más (cargadas en enero): son más que las que le quedan al plan después de diciembre 2026. No borré nada: revisalas antes de pagarlas.</p></div>');
});
test('H1: December changed after creating a LEGACY year: a visible notice, the copied values untouched (byte-identical legacy)', function(){
  var a = anioCreado(function(d){ d.meses[11].ahorroMesARS = 99000; d.meses[11].deudas = [{nombre: 'Préstamo', monto: 100000, pagado: true}]; }, true);
  assert.deepEqual([a.D.ahorroAnioAnterior, a.D.planDeudas['Préstamo'].pagadasAntes], [800000, 5]);
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), ['ahorro', 'cuotas']);
  var h = a.avisoDerivaPrevio(a.D, a.hoy);
  assert.match(h, /Diciembre 2026 cambió después de crear 2027: el ahorro y las cuotas que pasaron al año nuevo pueden no coincidir\./);
});

/// ── M1 (owner's preference, 2026-10-13 brief: block the ambiguous operation rather than alter the balance): a pase dated in a month
// before arrastre.desde of a model year would make money appear or disappear (scratchpad/s2/p2-backpase.js); the sheet refuses it and
// says which date to pick. No confirmation: changing the date to a valid one is enough. Existing pases before desde are not modified,
// and deleting one is refused too (it would bring back to Trabajo money the declared balance already holds) ──
function appPase(fecha){
  var d = C.vacio(2026); C.arrastre(d, 8, 100000, 'declarado');
  var g = {campos: {psFecha: fecha, psMonto: '1000'}, notas: [], aplicados: [], alertas: [], toasts: [], escritos: 0, boton: {textContent: 'Pasar'},
    nota: {className: '', innerHTML: ''}};
  var a = H.appVista(d, H.trab([], 500000), null, '2026-10-15', {funcs: ['guardarPase', 'notaPase', 'destinoPase', 'anioExiste', 'avisoPaseAntes', 'desdeDelSaldo', 'inicioDelSaldo', 'aniosGuardados', 'quitarPase', 'sacarPaseT', 'tjId', 'sumarPaseT', 'fDiaLargo'], vars: ['MESES'],
    globals: {val: function(id){ return g.campos[id] || ''; }, leerMonto: function(id){ var v = Number(g.campos[id]); return {ok: true, v: v, vacio: !g.campos[id]}; },
      errorEn: function(id, t){ g.notas.push(t); }, aplicarPase: function(p, signo, cambiarT){ g.aplicados.push(p); cambiarT(); return true; }, alerta: function(t, c){ g.alertas.push([t, c]); },
      guardarTrab: function(){ g.escritos++; }, paseQuitado: null,
      cerrarHoja: function(){}, renderTrabajo: function(){}, toast: function(t){ g.toasts.push(t); }, fARS: function(n){ return '$' + n; }, tjAntes: null, obsoleta: false, RENGLON_TRABAJO: 'Del trabajo',
      document: {getElementById: function(id){ return id === 'psNota' ? g.nota : {focus: function(){}}; }, querySelector: function(){ return g.boton; }}}});
  a.resumenTrab = function(){ return {paraPasar: 500000}; };
  a.g = g; return a;
}
var NO_ANTES = 'Esa fecha (10/03/2026) es anterior a Septiembre 2026, desde cuando llevás el saldo mes a mes: pasarlo con esa fecha haría aparecer o desaparecer plata. Elegí una fecha desde Septiembre 2026.';
test('M1: a pase dated before the month-to-month balance starts is refused with the date, the period and the consequence', function(){
  var a = appPase('2026-03-10');
  assert.equal(a.avisoPaseAntes(a.destinoPase()), NO_ANTES);
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 0, 'not saved');
  assert.deepEqual(a.g.notas, [NO_ANTES]);
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 0, 'a second tap does not save either: there is no confirmation');
  assert.equal(a.g.boton.textContent, 'Pasar', 'the button never becomes «Pasar igual»');
  a.notaPase();
  assert.equal(a.g.nota.className, 'nota mal', 'the sheet shows the refusal before tapping');
  assert.ok(a.g.nota.innerHTML.indexOf(NO_ANTES) >= 0);
});
test('M1: a pase dated from the first month-to-month month is saved at once, with no notice', function(){
  ['2026-09-01', '2026-10-10'].forEach(function(f){
    var a = appPase(f);
    assert.equal(a.avisoPaseAntes(a.destinoPase()), '');
    a.guardarPase();
    assert.equal(a.g.aplicados.length, 1, f);
    assert.equal(a.g.notas.length, 0, f);
  });
});
test('M1: changing the date to a valid one unblocks the sheet (no leftover state); an early date is refused again', function(){
  var a = appPase('2026-03-10');
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 0);
  a.g.campos.psFecha = '2026-09-15'; a.notaPase();
  assert.equal(a.g.nota.className, 'nota', 'the refusal is gone from the sheet');
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 1, 'saved with the valid date');
  assert.equal(a.plain(a.g.aplicados[0]).fecha, '2026-09-15');
  a.g.campos.psFecha = '2026-08-31'; a.guardarPase();
  assert.equal(a.g.aplicados.length, 1, 'the last day before desde is refused');
});
test('M1 test gap (W4): reopening the sheet starts unblocked: no confirmation exists after M1, only the date decides', function(){
  assert.equal(/\bpaseOk\b/.test(la.SRC_FOR_TESTS), false, 'the two-tap confirmation state was removed');
  var a = appPase('2026-03-10');
  a.guardarPase(); a.guardarPase();
  a.g.campos.psFecha = '2026-10-01';   // the sheet reopened with the default date
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 1);
});
test('M1: a year without the month-to-month balance (legacy) takes any date as before', function(){
  var a = appPase('2026-03-10');
  delete a.D.arrastre;
  assert.equal(a.avisoPaseAntes(a.destinoPase()), '');
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 1);
});
test('M1: deleting a pase that went to a month before desde is refused with an explanation; nothing is written or changed', function(){
  var a = appPase('2026-10-10'), viejo = {id: 'p1', fecha: '2026-03-10', monto: 300000, anio: 2026, mes: 2, creada: '2026-03-10T00:00:00.000Z'};
  a.T.pases = [viejo];
  var antes = JSON.stringify(a.T);
  a.quitarPase('p1', true);
  assert.equal(JSON.stringify(a.T), antes, 'Trabajo untouched');
  assert.equal(a.g.aplicados.length, 0, 'no row changed');
  assert.equal(a.g.escritos, 0, 'nothing written');
  assert.equal(a.g.alertas.length, 1);
  assert.equal(a.g.alertas[0][0], 'No se puede borrar');
  assert.equal(a.g.alertas[0][1], 'Lo que pasaste el 10/03/2026 es anterior a Septiembre 2026, desde cuando llevás el saldo mes a mes: el saldo con el que arrancaste ya la tiene en cuenta, así que borrarlo haría aparecer plata en Trabajo. No cambié nada.');
});
test('M1: deleting a pase from the month-to-month months still works', function(){
  var a = appPase('2026-10-10'), p = {id: 'p2', fecha: '2026-09-10', monto: 1000, anio: 2026, mes: 8, creada: '2026-09-10T00:00:00.000Z'};
  a.T.pases = [p];
  a.quitarPase('p2', false);
  assert.equal(a.g.aplicados.length, 1);
  assert.equal(a.T.pases.length, 0);
  assert.equal(a.g.alertas.length, 0);
});
// the M1 audit probe as numbers: with desde = Oct (declared), a Sep-30 pase leaves Trabajo and never reaches the Disponible (-300.000);
// deleting it later gives the 300.000 back to Trabajo while the declared Disponible already holds them (+300.000)
test('M1 probe p2-backpase: a pase into a month before desde moves the total; one from desde does not', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado');
  function pat(T, sepTrab){
    var x = C.copy(d); if(sepTrab) x.meses[8].ingresos = [{nombre: 'Del trabajo', monto: sepTrab, pagado: true}];
    var a = H.appVista(x, T, null, '2026-10-15'), p = a.plain(a.patrimonioPantalla(a.D, a.hoy).modelo); return p.bruto;
  }
  var sin = pat(H.trab([], 1000000));
  assert.equal(pat(H.trab([{fecha: '2026-09-30', monto: 300000}], 1000000), 300000) - sin, -300000, 'why it is refused');
  assert.equal(pat(H.trab([{fecha: '2026-10-10', monto: 300000}], 1000000)) - sin, 0);
});

// ── M3 (owner's preference, 2026-10-13 brief: keep the data and block): a restore that would leave the "Del trabajo" rows of a year and
// the Trabajo ledger from two different sources is refused before anything is written, naming the years and what to do. Every other
// restore proceeds as before (with the notice when the backup brings no Trabajo) ──
function hojaRestaurar(copia, pasesTel, aniosTel){
  var guardados = {};
  (aniosTel || []).forEach(function(y){ guardados['kibo.datos.' + y] = JSON.stringify(C.vacio(y)); });
  var ls = H.fakeStorage(guardados), a = H.appAlmacen(ls, '2026-10-15', {tieneTrab: function(){ return !!pasesTel; }}, ['avisoCopiaTrabajo', 'mezclaTrabajo', 'aniosDePases', 'descTrabajo', 'fARS', 'esc']);
  a.D = a.normalizar(C.vacio(2026), a.hoy);
  if(pasesTel) a.T.pases = pasesTel.map(function(f, i){ return {id: 'p' + i, fecha: f, monto: 1000, anio: +f.slice(0, 4), mes: +f.slice(5, 7) - 1, creada: f + 'T00:00:00.000Z'}; });
  var antes = JSON.stringify(ls.d), tAntes = JSON.stringify(a.T);
  a.pendiente = null;
  a.restaurarTexto(JSON.stringify(copia));
  return {hoja: a.g.hojas[a.g.hojas.length - 1] || '', alertas: a.g.alertas, a: a, ls: ls, intacto: JSON.stringify(ls.d) === antes && JSON.stringify(a.T) === tAntes};
}
function copia(anios, tr){ var o = {app: 'kibFinanzas', version: 1, anios: {}}; anios.forEach(function(y){ o.anios[y] = C.vacio(y); }); if(tr) o.trabajo = tr; return o; }
test('M3: a backup without Trabajo, restoring a year this phone\'s Trabajo passed money to, is refused; nothing written', function(){
  var r = hojaRestaurar(copia([2026]), ['2026-03-01', '2025-11-01'], [2025, 2026]);
  assert.equal(r.hoja, '', 'no confirmation sheet');
  assert.equal(r.a.pendiente, null, 'nothing to confirm');
  assert.equal(r.intacto, true, 'storage and Trabajo untouched');
  assert.deepEqual(r.alertas, [['No restauré la copia', 'La copia no trae Trabajo, y el Trabajo de este teléfono pasó plata a lo personal en 2026, que la copia reemplaza: los renglones «Del trabajo» y Trabajo dejarían de coincidir. Restaurá una copia completa (con Trabajo), o hacé primero una copia de seguridad de lo que tenés en este teléfono. No cambié nada.']]);
});
test('M3: a backup whose Trabajo passed money to a year it does not bring, while this phone has that year, is refused', function(){
  var tr = H.trab([{fecha: '2025-12-20', monto: 1000}, {fecha: '2026-03-01', monto: 2000}], 5000);
  var r = hojaRestaurar(copia([2026], tr), null, [2025, 2026]);
  assert.equal(r.hoja, '');
  assert.equal(r.intacto, true);
  assert.deepEqual(r.alertas, [['No restauré la copia', 'El Trabajo de la copia pasó plata a lo personal en 2025, pero la copia no trae 2025 y este teléfono sí lo tiene: los renglones «Del trabajo» y Trabajo dejarían de coincidir. Restaurá una copia completa (con todos esos años), o hacé primero una copia de seguridad de lo que tenés en este teléfono. No cambié nada.']]);
});
test('M3: no conflict -> the restore is offered as before (Trabajo kept notice; old backup on a phone without Trabajo; complete backup)', function(){
  var r = hojaRestaurar(copia([2026]), ['2025-11-01'], [2025, 2026]);   // this phone's pases go to a year the backup does not replace
  assert.match(r.hoja, /La copia no trae Trabajo: se mantiene el Trabajo de este teléfono/);
  assert.equal(r.alertas.length, 0);
  r = hojaRestaurar(copia([2026]), null, [2026]);   // an old backup, a phone without Trabajo
  assert.match(r.hoja, /Va a <b>reemplazar<\/b>/);
  assert.doesNotMatch(r.hoja, /Trabajo/);
  assert.equal(r.alertas.length, 0);
  var tr = H.trab([{fecha: '2025-12-20', monto: 1000}, {fecha: '2026-03-01', monto: 2000}], 5000);
  r = hojaRestaurar(copia([2025, 2026], tr), ['2026-01-05'], [2025, 2026]);   // complete
  assert.match(r.hoja, /También trae tus datos de trabajo/);
  assert.doesNotMatch(r.hoja, /no trae/);
  assert.equal(r.alertas.length, 0);
  r = hojaRestaurar(copia([2026], tr), null, [2026]);   // the backup's Trabajo goes to 2025, which neither the backup nor this phone has
  assert.match(r.hoja, /Ese Trabajo pasó plata a lo personal en 2025, pero ni la copia ni este teléfono tienen 2025/);
  assert.equal(r.alertas.length, 0);
});
test('M3: the confirmation sheet writes nothing until «Reemplazar» (Cancelar leaves storage as it was)', function(){
  var r = hojaRestaurar(copia([2026]), null, [2026]);
  assert.equal(typeof r.a.pendiente, 'function', 'waiting for the user');
  assert.equal(r.intacto, true, 'nothing written while the sheet is open');
  r.a.pendiente = null;   // cerrarHoja (Cancelar) drops it
  assert.equal(r.intacto, true);
});
// ── N2-B (a) (interim, no data change): months of the open year with more than one "Del trabajo" row (legacy data from the old matcher) are
// listed so the user can review and merge them ──
test('N2-B: a notice lists the months with more than one "Del trabajo" row; none when every month has at most one', function(){
  var d = C.vacio(2026);
  C.mes(d, 2, {ingresos: [C.it('Dél trabajo', 1000, false), C.it('Del trabajo', 2000, true)]});
  C.mes(d, 5, {ingresos: [C.it('Del trabajo', 2000, true), C.it('Sueldo', 5000, true)]});
  C.mes(d, 7, {ingresos: [C.it('del trabajo ', 1000, true), C.it('DEL TRABAJO', 2000, true)]});
  var a = H.appVista(d, null, null, '2026-10-15', {funcs: ['mesesTrabajoDoble', 'avisoTrabajoDoble', 'esc', 'listaY', 'leerReparo', 'planOrdenTrabajo', 'exactoTrabajo'], vars: ['MESES', 'LSREPARO']});
  assert.deepEqual(a.plain(a.mesesTrabajoDoble(a.D)), [2, 7]);
  var h = a.avisoTrabajoDoble(a.D);
  assert.match(h, /En Marzo y Agosto de 2026 hay más de un renglón «Del trabajo»/);
  assert.deepEqual(a.plain(a.D.meses[2].ingresos.map(function(x){ return x.nombre; })), ['Dél trabajo', 'Del trabajo'], 'no data change');
  var b = H.appVista(C.vacio(2026), null, null, '2026-10-15', {funcs: ['mesesTrabajoDoble', 'avisoTrabajoDoble', 'esc', 'listaY', 'leerReparo', 'planOrdenTrabajo', 'exactoTrabajo'], vars: ['MESES', 'LSREPARO']});
  assert.equal(b.avisoTrabajoDoble(b.D), '');
});

// ── review fix (M2): Deshacer finds the row by its place AMONG ROWS OF THE SAME NAME, not by its position in the list ──
// rows [Luz, Super 0, Super 70000 ✓]: +20000 to the first Super, the user deletes Luz, Deshacer used to take 20000 from the second Super
function appOrden(raw, orden){
  var t = [];
  var a = H.appVista(raw, null, null, null, {funcs: FUNCS_GASTO.concat(['aplicarOrden']), vars: ['gr'], globals: {oculto: false, PUNTOS: '..', ordenL: orden || [],
    document: {getElementById: function(){ return null; }}, abrirHoja: function(){}, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){},
    renderMes: function(){}, toast: function(x, ac, act, id){ t.push([x, ac, act, id]); }}});
  a.mes = 9; a.t = t; return a;
}
function resumen(a){ return filas(a).map(function(r){ return [r.nombre, r.monto, r.pagado]; }); }
test('M2-R deleting ANOTHER row before Deshacer: the same Super is reverted', function(){
  var a = appGasto(mesCon([C.it('Luz', 1000, true), C.it('Super', 0, false), C.it('Super', 70000, true)]));
  a.gr = {monto: 20000, cat: 1, sec: 'gastosVariables'}; a.sumarGasto(); var id = a.t[a.t.length - 1][3];
  assert.equal(a.plain(a.D.meses[9].movimientos[0]).fo, 0, 'the first of the two Super');
  a.D.meses[9].gastosVariables.splice(0, 1);   // the user deletes Luz
  a.quitarMov(id);
  assert.deepEqual(resumen(a), [['Super', 0, false], ['Super', 70000, true]]);
  assert.equal(a.t[a.t.length - 1][0], 'Deshecho');
  assert.equal(a.D.meses[9].movimientos.length, 0);
});
test('M2-R reordering the rows (Ordenar) before Deshacer: the same Super is reverted', function(){
  var a = appOrden(mesCon([C.it('Luz', 1000, true), C.it('Super', 0, false), C.it('Super', 30000, true)]), ['Super', 'Super', 'Luz']);
  a.gr = {monto: 20000, cat: 1, sec: 'gastosVariables'}; a.sumarGasto(); var id = a.t[a.t.length - 1][3];
  a.D.meses[9].gastosVariables = a.aplicarOrden(a.D.meses[9].gastosVariables);   // [Super 20000, Super 30000, Luz]: place 1 is now the OTHER Super
  a.quitarMov(id);
  assert.deepEqual(resumen(a), [['Super', 0, false], ['Super', 30000, true], ['Luz', 1000, true]]);
  assert.equal(a.t[a.t.length - 1][0], 'Deshecho');
});
test('M2-R deleting the target row itself: Deshacer changes nothing and says it did not find the row', function(){
  var a = appGasto(mesCon([C.it('Super', 0, false), C.it('Super', 70000, true)]));
  a.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; a.sumarGasto(); var id = a.t[a.t.length - 1][3];
  a.D.meses[9].gastosVariables.splice(0, 1);   // the user deletes the Super that got the 20000
  var antes = filas(a);
  a.quitarMov(id);
  assert.deepEqual(filas(a), antes, 'the other Super keeps its 70000');
  assert.equal(a.t[a.t.length - 1][0], 'No encontré el renglón para deshacer');
  assert.equal(a.D.meses[9].movimientos.length, 1, 'the expense stays recorded');
});
test('M2-R the same-name place survives normalizar (non-negative integers only)', function(){
  var a = appGasto(mesCon([C.it('Super', 30000, true), C.it('Super', 0, false)]));
  a.gr = {monto: 20000, cat: 1, sec: 'gastosVariables'}; a.sumarGasto();
  var n = a.normalizar(C.copy(a.D), a.hoy);
  assert.equal(n.meses[9].movimientos[0].fo, 1);
  var d = C.copy(a.D); d.meses[9].movimientos[0].fo = -1; d.meses[9].movimientos.push({id: 'x', nombre: 'Super', monto: 1, fo: 1.5});
  n = a.normalizar(d, a.hoy);
  assert.equal('fo' in n.meses[9].movimientos[0], false);
  assert.equal('fo' in n.meses[9].movimientos[1], false);
});

// review advisory (W3): the refusal branch (exacto = -2). When the rows of that name are no longer the same set (one added or renamed into
// the name), Deshacer cannot know which row it was: nothing moves, the expense stays recorded, and it says so
function rehusa(a, id, antes){
  a.quitarMov(id);
  assert.deepEqual(filas(a), antes, 'no money moved');
  assert.equal(a.t[a.t.length - 1][0], 'No encontré el renglón para deshacer');
  assert.equal(a.D.meses[9].movimientos.length, 1, 'the expense stays recorded');
}
test('M2-R adding a new row with the same name before Deshacer: refuses, no money moved', function(){
  var a = appGasto(mesCon([C.it('Super', 0, false), C.it('Super', 70000, true)]));
  a.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; a.sumarGasto(); var id = a.t[a.t.length - 1][3];
  assert.equal(a.plain(a.D.meses[9].movimientos[0]).fn, 2);
  a.D.meses[9].gastosVariables.unshift({nombre: 'Super', monto: 5000, tope: 0, frec: '', dias: [], pagado: true});
  rehusa(a, id, filas(a));
});
test('M2-R renaming another row to the same name before Deshacer: refuses, no money moved', function(){
  var a = appGasto(mesCon([C.it('Luz', 1000, true), C.it('Super', 0, false)]));
  a.gr = {monto: 20000, cat: 1, sec: 'gastosVariables'}; a.sumarGasto(); var id = a.t[a.t.length - 1][3];
  assert.deepEqual(resumen(a), [['Luz', 1000, true], ['Super', 20000, true]]);
  a.D.meses[9].gastosVariables[0].nombre = 'Super';   // Luz renamed to Super
  rehusa(a, id, filas(a));
});
test('M2-R a stored fo without fn (older data shape): the fo-th row of that name is reverted; out of range refuses', function(){
  var a = appGasto(mesCon([C.it('Super', 0, false), C.it('Super', 70000, true)])), antes = filas(a);
  a.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; a.sumarGasto(); var id = a.t[a.t.length - 1][3];
  delete a.D.meses[9].movimientos[0].fn;
  a.D.meses[9].gastosVariables.push({nombre: 'Super', monto: 9000, tope: 0, frec: '', dias: [], pagado: true});   // without fn, a new row does not refuse
  antes.push(a.plain(a.D.meses[9].gastosVariables[2]));
  a.quitarMov(id);
  assert.deepEqual(filas(a), antes, 'the first Super (fo 0) is reverted, the others keep their money');
  assert.equal(a.t[a.t.length - 1][0], 'Deshecho');
  var b = appGasto(mesCon([C.it('Super', 0, false), C.it('Super', 70000, true)]));
  b.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; b.sumarGasto(); var id2 = b.t[b.t.length - 1][3];
  delete b.D.meses[9].movimientos[0].fn; b.D.meses[9].movimientos[0].fo = 5;
  rehusa(b, id2, filas(b));
});

// ── review fix (H2): the "Dólares mes a mes" table is the OPEN year's, even when "a hoy" comes from the year that contains today ──
// today 2026-11-10, 2027 created: 2027's table subtracted 2027's usdAnioAnterior (1300) from 2026's dollars a hoy (1100): "Entraron" (US$ 200,00)
function usdDosAnios(){
  var U = require('./fixtures/usd-vistas'), M = la.loadMotor(), HOY = C.hoy('2026-11-10');
  var y26 = M.normalizar(C.copy(C.seccion2(true, true)), HOY);
  y26.meses[11].compraUSD = 200; y26.meses[11].compraARS = 300000; y26.meses[10].compraUSD = 100; y26.meses[10].compraARS = 150000;
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, '2026-11-10');
  H.cargarEn(app, ls, 2026); app.duplicar();
  var raw26 = ls.d['kibo.datos.2026'], raw27 = ls.d['kibo.datos.2027'], T = H.trab([], 500000);
  return {
    a26: U.appUSD(JSON.parse(raw26), T, {'kibo.datos.2027': raw27}, '2026-11-10'),
    a27: U.appUSD(JSON.parse(raw27), T, {'kibo.datos.2026': raw26}, '2026-11-10')
  };
}
function seccion(html, k){ var i = html.indexOf('data-sec="' + k + '"'), j = html.indexOf('data-sec="', i + 1); return html.slice(html.lastIndexOf('<div', i), j < 0 ? html.length : html.lastIndexOf('<div', j)); }
function totales(html){ return (seccion(html, 'usdMeses').match(/<tr class="tot[^>]*>.*?<\/tr>/g) || []).map(function(r){ return r.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|'); }); }
test('H2-R with 2027 open (today in 2026) the dollars table and its subtitle are 2027\'s own: no negative "Entraron", no 2026 dollars', function(){
  var y = usdDosAnios(), h27 = y.a27.usd(), h26 = y.a26.usd();
  var p27 = y.a27.plain(y.a27.patrimonioPantalla(y.a27.D, y.a27.hoy, true));
  assert.equal(p27.anio, 2027, 'the open year\'s own model');
  totales(h27).forEach(function(r){ assert.doesNotMatch(r, /\(US\$/, 'no negative total: ' + r); });
  assert.notDeepEqual(totales(h27), totales(h26), 'not 2026\'s table');
  var sub = /data-sec="usdMeses"[\s\S]*?<\/button>/.exec(seccion(h27, 'usdMeses'));
  assert.ok(sub, 'the section header is there');
  var de26 = y.a27.fUSD(1100);   // 2026's dollars a hoy
  assert.equal(sub[0].indexOf(de26), -1, 'the subtitle is not 2026\'s dollars a hoy');
  assert.ok(sub[0].indexOf(y.a27.fUSD(p27.usd)) >= 0, 'the subtitle is 2027\'s own dollars a hoy');
  // the hero and the composition stay "a hoy" from the year that contains today (H2)
  var comp = seccion(h27, 'usdPatri');
  assert.match(comp, /Sale de 2026/);
  assert.ok(comp.indexOf(de26) >= 0, 'the composition keeps 2026\'s dollars a hoy');
});

// ── review fix (H1): the December notice compares the previous year against what duplicar COPIED (a snapshot kept in the new year),
// not against the editable starting fields: editing them on purpose is not "December changed" ──
function anioCreado2(cambiar26, cambiar27){
  var M = la.loadMotor(), HOY = C.hoy('2026-12-10');
  var y26 = M.normalizar(C.copy(C.seccion2(true, true)), HOY);
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, '2026-12-10');
  H.cargarEn(app, ls, 2026); app.duplicar();
  var raw26 = JSON.parse(ls.d['kibo.datos.2026']), raw27 = JSON.parse(ls.d['kibo.datos.2027']);
  if(cambiar26) cambiar26(raw26);
  if(cambiar27) cambiar27(raw27);
  return H.appVista(raw27, null, {'kibo.datos.2026': JSON.stringify(raw26)}, '2027-01-10', {funcs: ['derivaAnioPrevio', 'avisoDerivaPrevio', 'cuotasDeMas', 'esc'], vars: ['MESES']});
}
function aMano(d){ d.ahorroAnioAnterior = 1; d.usdAnioAnterior = 5000; d.aReponerAnterior = 7; d.planDeudas['Préstamo'].pagadasAntes = 0; }
test('H1-R editing the starting savings, dollars, a reponer or paid installments on purpose shows no notice', function(){
  var a = anioCreado2(null, aMano);
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), []);
  assert.equal(a.avisoDerivaPrevio(a.D, a.hoy), '');
});
test('H1-R a real December change still shows the notice, even after editing the starting fields', function(){
  var a = anioCreado2(function(d){ d.meses[11].ahorroMesARS = 99000; d.meses[11].compraUSD = 50; d.meses[11].deudas = [{nombre: 'Préstamo', monto: 100000, pagado: true}]; }, aMano);
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), ['ahorro', 'dolares', 'cuotas']);
  assert.deepEqual(a.plain(a.cuotasDeMas(a.D)), [{nombre: 'Préstamo', sobran: 1, meses: [0]}], 'December paid the installment 2027 loaded for January: named, not removed');
  assert.match(a.avisoDerivaPrevio(a.D, a.hoy), /Diciembre 2026 cambió después de crear 2027/);
});
test('H1-R the copied snapshot survives normalizar; a year without it (created before) shows no notice', function(){
  var a = anioCreado2();
  var n = a.normalizar(C.copy(a.D), a.hoy);
  assert.deepEqual(a.plain(n.copiaDiciembre), a.plain(a.D.copiaDiciembre));
  assert.equal(typeof n.copiaDiciembre.usd, 'number');
  var viejo = anioCreado2(function(d){ d.meses[11].ahorroMesARS = 99000; }, function(d){ delete d.copiaDiciembre; });
  assert.deepEqual(viejo.plain(viejo.derivaAnioPrevio(viejo.D, viejo.hoy)), []);
  var raro = a.normalizar({anio: 2027, copiaDiciembre: {ahorro: 'x', usd: 3, cuotas: {'constructor': 2, 'A': -1, 'B': 1.5}}}, a.hoy);
  assert.deepEqual(a.plain(raro.copiaDiciembre), {ahorro: 0, aReponer: 0, usd: 3, cuotas: {'constructor': 2, A: 0, B: 2}});
  assert.equal('copiaDiciembre' in a.normalizar({anio: 2027}, a.hoy), false, 'never invented');
  assert.equal('copiaDiciembre' in a.normalizar({anio: 2027, copiaDiciembre: 'x'}, a.hoy), false, 'junk is dropped, not kept');
});
