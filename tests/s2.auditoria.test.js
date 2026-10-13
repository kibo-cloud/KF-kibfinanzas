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
