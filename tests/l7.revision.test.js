'use strict';
// L7 review fixes on "Qué vence": the per-payment amounts of a row add up exactly to the row (the rounding remainder goes to the last
// payment), and in "Del trabajo" the pases cover the earliest collection dates first, so a covered date is never listed as overdue.
// No money rule changes: the dates and the row amounts are the ones the user loaded; the uncovered total is repartoTrabajo's exceso.
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

function plain(x){ return JSON.parse(JSON.stringify(x)); }
var F_VENCE = ['vencimientos', 'montosPorFecha', 'diasCobro', 'isoDe', 'diasDelMes', 'cuandoVence', 'detalleVence', 'fARS', 'grupos', 'esc', 'fDia', 'cuantosPagos', 'esRenglonTrabajo'];
function vence(raw, today, T){
  return H.appVista(raw, T || null, null, today, {funcs: F_VENCE, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX'], globals: {oculto: false, PUNTOS: '..'}});
}
function resumen(l){ return plain(l).map(function(x){ return [x.atrasado ? 'atrasado' : 'semana', x.nombre, x.monto, x.fecha]; }); }
function ing(n, m, p, frec, dias){ var x = C.it(n, m, p); x.frec = frec; x.dias = dias; return x; }

test('L7 review: the amounts of each collection date add up exactly to the row (100.000 on the 1st, 10th and 20th)', function(){
  var raw = C.vacio(2026); C.arrastre(raw, 8, 0);
  C.mes(raw, 9, {ingresos: [ing('Cliente', 100000, false, 'dias', [1, 10, 20])]});
  var a = vence(raw, '2026-10-22'), l = a.vencimientos(a.D, 9, a.hoy, []), tot = 0;
  l.forEach(function(x){ tot += x.monto; });
  assert.deepEqual(resumen(l), [['atrasado', 'Cliente', 33333, '2026-10-01'], ['atrasado', 'Cliente', 33333, '2026-10-10'], ['atrasado', 'Cliente', 33334, '2026-10-20']]);
  assert.equal(tot, 100000, 'before the fix: 99.999');
});

test('L7 review: "Del trabajo" weekly, pases cover the earliest Fridays first; only the uncovered dates are listed', function(){
  var raw = C.vacio(2026); C.arrastre(raw, 8, 0);
  C.mes(raw, 9, {ingresos: [ing('Del trabajo', 400000, false, 'semanal', [5])]});   // Fridays of October 2026: 2, 9, 16, 23, 30 (80.000 each)
  var T = H.trab([{fecha: '2026-10-03', monto: 100000}, {fecha: '2026-10-10', monto: 100000}]);
  var a = vence(raw, '2026-10-20', T), l = a.vencimientos(a.D, 9, a.hoy, []);
  assert.deepEqual(resumen(l), [['atrasado', 'Del trabajo', 40000, '2026-10-16'], ['semana', 'Del trabajo', 80000, '2026-10-23']],
    'the 2nd and the 9th are covered (before the fix both were overdue with 40.000 each)');
  var raw2 = C.copy(raw), T2 = H.trab([{fecha: '2026-10-03', monto: 400000}]), b = vence(raw2, '2026-10-20', T2);
  assert.deepEqual(resumen(b.vencimientos(b.D, 9, b.hoy, [])), [], 'fully covered: nothing to collect');
});

test('L7 review: montosPorFecha splits, puts the remainder last and takes the covered part from the earliest dates', function(){
  var a = vence(C.vacio(2026), '2026-10-20');
  assert.deepEqual(plain(a.montosPorFecha(100000, 3, 0)), [33333, 33333, 33334]);
  assert.deepEqual(plain(a.montosPorFecha(400000, 5, 200000)), [0, 0, 40000, 80000, 80000]);
  assert.deepEqual(plain(a.montosPorFecha(1000.5, 2, 0)), [500, 500.5], 'cents stay on the last payment');
  assert.deepEqual(plain(a.montosPorFecha(50000, 1, 0)), [50000]);
});
