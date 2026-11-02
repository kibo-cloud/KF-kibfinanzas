'use strict';
// 1.35 cash / digital split, engine (T2 of odd/tasks/cash-digital-split.md): cadenaMedios / disponiblePorMedio return
// {efectivo, digital, total} per month with total === the month card (calc().disponibleFinal in a legacy month, cierre / a hoy /
// proyectado of cadena in a model month) and digital + efectivo === total. The existing engine outputs never change with `medio`.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var R4 = require('./fixtures/motor-corpus-r4');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function cerca(a, b, msg){ assert.ok(Math.abs(a - b) < 1e-6, msg + ': ' + a + ' vs ' + b); }
// the month card total, read from the existing engine only (what tilesMes shows as Disponible final)
function tarjeta(d, hoy, ctx){
  var cad = M.cadena(d, hoy, ctx);
  return cad.meses.map(function(e, j){ return e.legacy ? M.calc(d.meses[j]).disponibleFinal : e.estado === 'pasado' ? e.cierre : e.estado === 'actual' ? e.cierreCalc : e.proyectado; });
}
function corpus(){
  return R4.datasets().map(function(e){ var hoy = C.hoy(e.iso); return {nombre: e.nombre, d: M.normalizar(C.copy(e.raw), hoy), hoy: hoy, ctx: C.copy(e.ctx)}; });
}
// marks some rows cash, adds transfers and turns the pases into cash ones, deterministically
function conEfectivo(x){
  var d = C.copy(x.d), n = 0, ctx = C.copy(x.ctx);
  d.meses.forEach(function(m, j){
    M.SECS.forEach(function(s){ m[s.k].forEach(function(it){ if(n++ % 2 === 0) it.medio = 'efectivo'; }); });
    if(j % 3 === 0){ m.extraccionARS = 12345 + j; m.depositoARS = 2000; }
  });
  Object.keys(ctx.pasesTrabajo || {}).forEach(function(k){ ctx.pasesTrabajo[k].forEach(function(p, i){ if(i % 2 === 0) p.forma = 'efectivo'; }); });
  if(d.arrastre) d.arrastre.inicial.aperturaEfectivo = 3333;
  return {nombre: x.nombre, d: M.normalizar(d, x.hoy), hoy: x.hoy, ctx: ctx};
}

test('old data (whole R4 corpus): cash is 0, digital is the total and the total is the month card, every month', function(){
  corpus().forEach(function(x){
    var t = tarjeta(x.d, x.hoy, x.ctx), cm = M.cadenaMedios(x.d, x.hoy, x.ctx);
    assert.equal(cm.length, 12);
    cm.forEach(function(v, j){
      assert.equal(v.total, t[j], x.nombre + ' month ' + j + ' total');
      assert.equal(v.efectivo, 0, x.nombre + ' month ' + j + ' cash');
      assert.equal(v.digital, t[j], x.nombre + ' month ' + j + ' digital');
    });
    assert.equal(M.usaMedios(x.d), false, x.nombre);
  });
});

test('with cash marks the existing engine outputs and the month totals do not move; digital + cash === total', function(){
  corpus().forEach(function(x){
    var y = conEfectivo(x), t = tarjeta(x.d, x.hoy, x.ctx), cm = M.cadenaMedios(y.d, y.hoy, y.ctx), j;
    assert.deepEqual(plain(M.cadena(y.d, y.hoy, y.ctx)), plain(M.cadena(x.d, x.hoy, x.ctx)), x.nombre + ': cadena unchanged');
    for(j = 0; j < 12; j++) assert.deepEqual(plain(M.flujosMes(y.d, j, y.hoy, y.ctx)), plain(M.flujosMes(x.d, j, x.hoy, x.ctx)), x.nombre + ': flujosMes ' + j);
    assert.deepEqual(plain(M.pasivos(y.d, y.hoy)), plain(M.pasivos(x.d, x.hoy)), x.nombre + ': pasivos');
    assert.deepEqual(plain(M.patrimonioNeto(y.d, y.hoy, y.ctx)), plain(M.patrimonioNeto(x.d, x.hoy, x.ctx)), x.nombre + ': patrimonioNeto');
    cm.forEach(function(v, k){
      assert.equal(v.total, t[k], x.nombre + ' month ' + k + ' total');
      cerca(v.digital + v.efectivo, v.total, x.nombre + ' month ' + k + ' digital + cash');
      assert.deepEqual(plain(M.disponiblePorMedio(y.d, k, y.hoy, y.ctx)), plain(v), x.nombre + ' month ' + k + ' disponiblePorMedio');
    });
  });
});

// October 2026 starts the model with 100000 available, 20000 of it in cash
function escenario(iso){
  var d = C.arrastre(C.vacio(2026), 9, 100000, 'declarado', {aperturaEfectivo: 20000});
  function ef(x){ x.medio = 'efectivo'; return x; }
  C.mes(d, 8, {ingresos: [ef(C.it('Feria', 9000, true))]});   // a legacy month (before arrastre.desde)
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 500000, true), ef(C.it('Feria', 30000, true)), C.it('Del trabajo', 11000, false)],
    gastosFijos: [C.it('Alquiler', 200000, true)], gastosVariables: [ef(C.it('Super', 10000, true)), ef(C.it('Verdulería', 5000, false))],
    ahorroMesARS: 50000, extraccionARS: 15000, depositoARS: 3000});
  C.mes(d, 10, {ingresos: [C.it('Sueldo', 500000, false)], gastosVariables: [ef(C.it('Super', 8000, false))], extraccionARS: 10000});
  var hoy = C.hoy(iso || '2026-10-15');
  return {d: M.normalizar(d, hoy), hoy: hoy, ctx: {pasesTrabajo: {'2026-10': [{fecha: '2026-10-05', monto: 7000, forma: 'efectivo'}, {fecha: '2026-10-06', monto: 4000}]}}};
}

test('a worked month: cash rows, cash pases, ATM withdrawal and deposit; savings and the digital pase stay digital', function(){
  var x = escenario(), cm = plain(M.cadenaMedios(x.d, x.hoy, x.ctx));
  assert.deepEqual(cm[9], {efectivo: 59000, digital: 322000, total: 381000, cierreEfectivo: 59000}, 'October today: 20000 + 30000 - 10000 + 7000 + 15000 - 3000');
  assert.deepEqual(cm[10], {efectivo: 56000, digital: 812000, total: 868000, cierreEfectivo: 59000}, 'November projected: 59000 - 5000 pending - 8000 + 10000');
  assert.deepEqual(cm[8], {efectivo: 9000, digital: 0, total: 9000}, 'September is legacy: the month result, all of it cash');
});

test('a confirmed real closing corrects the total; the difference goes to digital and the cash chain goes on', function(){
  var x = escenario('2026-11-15');
  x.d.meses[9].cierreReal = {valor: 400000, calculadoAlConfirmar: 381000, confirmadoEl: '2026-11-01'};
  var cm = M.cadenaMedios(x.d, x.hoy, x.ctx);
  assert.deepEqual([cm[9].total, cm[9].efectivo, cm[9].digital], [400000, 59000, 341000]);
  assert.deepEqual([cm[10].total, cm[10].efectivo, cm[10].digital], [400000, 69000, 331000], 'November today: unticked rows are pending, the withdrawal is realized');
});

test('aperturaEfectivoPara: the cash opening that makes today equal what you declare (like iniciarArrastre)', function(){
  var x = escenario(), ap = M.aperturaEfectivoPara(x.d, x.hoy, x.ctx, 80000);
  assert.equal(ap, 41000, '80000 - (59000 - 20000)');
  x.d.arrastre.inicial.aperturaEfectivo = ap;
  assert.equal(M.disponiblePorMedio(x.d, 9, x.hoy, x.ctx).efectivo, 80000);
  assert.equal(M.disponiblePorMedio(x.d, 9, x.hoy, x.ctx).total, 381000, 'the total never changes');
  var sin = C.copy(x.d); delete sin.arrastre;
  assert.equal(M.aperturaEfectivoPara(sin, x.hoy, x.ctx, 1), null, 'no arrastre');
  assert.equal(M.aperturaEfectivoPara(x.d, C.hoy('2027-01-10'), x.ctx, 1), null, 'not this year');
  assert.equal(M.aperturaEfectivoPara(x.d, C.hoy('2026-09-10'), x.ctx, 1), null, 'the model has not started yet');
  assert.equal(M.aperturaEfectivoPara(x.d, x.hoy, x.ctx, NaN), null);
  assert.equal(M.aperturaEfectivoPara(x.d, x.hoy, x.ctx, '5'), null, 'only a number');
});

test('January of a chained year starts from the live December cash; a declared cash opening wins', function(){
  var d = C.arrastre(C.vacio(2027), 0, 500000, 'arrastre'), hoy = C.hoy('2027-01-10');
  d = M.normalizar(d, hoy);
  var ctx = {cierrePrevio: 600000, cierrePrevioEfectivo: 45000};
  assert.deepEqual(plain(M.disponiblePorMedio(d, 0, hoy, ctx)), {efectivo: 45000, digital: 555000, total: 600000, cierreEfectivo: 45000});
  d.arrastre.inicial.aperturaEfectivo = 1000;
  assert.equal(M.disponiblePorMedio(d, 0, hoy, ctx).efectivo, 1000);
  delete d.arrastre.inicial.aperturaEfectivo;
  assert.equal(M.disponiblePorMedio(d, 0, hoy, {cierrePrevio: 600000}).efectivo, 0, 'no December cash known: 0');
});

test('legacy Del trabajo: the part a cash pase covers is cash, the rest follows the line medio', function(){
  var d = C.vacio(2026), hoy = C.hoy('2026-10-15');
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 11000, false)]});
  d = M.normalizar(d, hoy);
  var ctx = {pasesTrabajo: {'2026-10': [{fecha: '2026-10-05', monto: 7000, forma: 'efectivo'}, {fecha: '2026-10-06', monto: 4000}]}};
  assert.deepEqual(plain(M.disponiblePorMedio(d, 9, hoy, ctx)), {efectivo: 7000, digital: 4000, total: 11000});
  d.meses[9].ingresos[0].medio = 'efectivo';
  assert.deepEqual(plain(M.disponiblePorMedio(d, 9, hoy, ctx)), {efectivo: 11000, digital: 0, total: 11000});
});

test('cash can go negative when the data says so (never clamped); the engine does not mutate its input', function(){
  var d = C.arrastre(C.vacio(2026), 9, 100000, 'declarado'), hoy = C.hoy('2026-10-15');
  C.mes(d, 9, {gastosVariables: [Object.assign(C.it('Super', 30000, true), {medio: 'efectivo'})]});
  d = M.normalizar(d, hoy);
  var antes = plain(d), v = plain(M.disponiblePorMedio(d, 9, hoy, {}));
  assert.deepEqual(v, {efectivo: -30000, digital: 100000, total: 70000, cierreEfectivo: -30000});
  assert.deepEqual(plain(d), antes);
  assert.equal(M.usaMedios(d), true);
});

test('usaMedios: any cash line, quick expense, transfer or a non-zero cash opening', function(){
  var hoy = C.hoy('2026-10-15');
  function n(f){ var d = C.vacio(2026); f(d); return M.usaMedios(M.normalizar(d, hoy)); }
  assert.equal(n(function(){}), false);
  assert.equal(n(function(d){ C.mes(d, 2, {deudas: [Object.assign(C.it('Tarjeta', 1, false), {medio: 'efectivo'})]}); }), true);
  assert.equal(n(function(d){ C.mes(d, 2, {movimientos: [{id: 'a', sec: 'gastosVariables', nombre: 'X', monto: 1, medio: 'efectivo'}]}); }), true);
  assert.equal(n(function(d){ C.mes(d, 2, {depositoARS: 5}); }), true);
  assert.equal(n(function(d){ C.arrastre(d, 9, 0, 'declarado', {aperturaEfectivo: 0}); }), false, 'an answered 0 is not cash use');
  assert.equal(n(function(d){ C.arrastre(d, 9, 0, 'declarado', {aperturaEfectivo: 10}); }), true);
});
