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
  var r = {hoyVentas: 3, hoyVendido: 100000, hoyForma: {efectivo: 30000}, hayCosto: false, hoyGanancia: 0};
  assert.equal(a.lineaHoy(r), 'Hoy: 3 ventas · efectivo $30000 · a plazo, sin cobrar $70000');
  r = {hoyVentas: 1, hoyVendido: 30000, hoyForma: {efectivo: 30000}, hayCosto: false, hoyGanancia: 0};
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

// ── H1 (OWNER_DECISION_REQUIRED, interim notice only): the new year keeps a SNAPSHOT of December's savings / dollars / a reponer /
// installments; when the previous year changes later, the Patrimonio tab says so (no automatic re-sync) ──
function anioCreado(cambiar){
  var M = la.loadMotor(), HOY = C.hoy('2026-12-10');
  var y26 = M.normalizar(C.copy(C.seccion2(true, true)), HOY);
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, '2026-12-10');
  H.cargarEn(app, ls, 2026); app.duplicar();
  var raw26 = JSON.parse(ls.d['kibo.datos.2026']);
  if(cambiar) cambiar(raw26);
  var a = H.appVista(JSON.parse(ls.d['kibo.datos.2027']), null, {'kibo.datos.2026': JSON.stringify(raw26)}, '2027-01-10', {funcs: ['derivaAnioPrevio', 'avisoDerivaPrevio', 'esc']});
  return a;
}
test('H1: no notice while December still gives what the new year copied', function(){
  var a = anioCreado();
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), []);
  assert.equal(a.avisoDerivaPrevio(a.D, a.hoy), '');
});
test('H1: December savings and installments changed after creating the year: a visible notice, the copied values untouched', function(){
  var a = anioCreado(function(d){ d.meses[11].ahorroMesARS = 99000; d.meses[11].deudas = [{nombre: 'Préstamo', monto: 100000, pagado: true}]; });
  var antes = [a.D.ahorroAnioAnterior, a.D.planDeudas['Préstamo'].pagadasAntes];
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), ['ahorro', 'cuotas']);
  var h = a.avisoDerivaPrevio(a.D, a.hoy);
  assert.match(h, /Diciembre 2026 cambió después de crear 2027: el ahorro y las cuotas que pasaron al año nuevo pueden no coincidir\./);
  assert.deepEqual([a.D.ahorroAnioAnterior, a.D.planDeudas['Préstamo'].pagadasAntes], antes);
});
