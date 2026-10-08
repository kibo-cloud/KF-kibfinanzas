'use strict';
// L5/L6 review fixes: "Qué vence" lists the uncovered part of "Del trabajo" (a), shows the amount of each collection (b);
// the separate quick-expense rows carry a flag (c); undo says when nothing could be reverted (d). No money rule changes: every amount
// is one the chain already counts (cadena.resumen) or the per-payment amount the row already shows (cobroTxt).
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

function plain(x){ return JSON.parse(JSON.stringify(x)); }
var F_VENCE = ['vencimientos', 'diasCobro', 'isoDe', 'diasDelMes', 'cuandoVence', 'detalleVence', 'fARS', 'grupos', 'esc', 'fDia', 'cuantosPagos', 'esRenglonTrabajo'];
function vence(raw, today){
  return H.appVista(raw, null, null, today, {funcs: F_VENCE, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX'], globals: {oculto: false, PUNTOS: '..'}});
}
function resumen(l){ return plain(l).map(function(x){ return [x.atrasado ? 'atrasado' : 'semana', x.nombre, x.monto, x.fecha]; }); }
function ing(n, m, p, frec, dias){ var x = C.it(n, m, p); x.frec = frec; x.dias = dias; return x; }

test('L5 review a: an unticked past "Del trabajo" with no pases is overdue; the listing adds up to what the chain counts', function(){
  var raw = C.vacio(2026);
  C.arrastre(raw, 8, 0);
  C.mes(raw, 8, {ingresos: [C.it('Del trabajo', 500000, false)], gastosFijos: [C.it('Luz', 20000, false)]});
  var a = vence(raw, '2026-10-15'), l = a.vencimientos(a.D, 9, a.hoy, []), res = a.vistaModelo(a.D, a.hoy).cad.resumen, tot = 0;
  l.forEach(function(x){ tot += x.monto; });
  assert.deepEqual(resumen(l), [['atrasado', 'Del trabajo', 500000, '2026-09-30'], ['atrasado', 'Luz', 20000, '2026-09-30']]);
  assert.equal(tot, res.vencidos + res.vencidosIngresos);
});

test('L5 review a: "Del trabajo" lists only the part the pases do not cover; fully covered or ticked, nothing', function(){
  var raw = C.vacio(2026);
  C.arrastre(raw, 8, 0);
  C.mes(raw, 8, {ingresos: [C.it('Del trabajo', 500000, false)]});
  var T = H.trab([{fecha: '2026-09-20', monto: 300000}]);
  var a = H.appVista(raw, T, null, '2026-10-15', {funcs: F_VENCE, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX'], globals: {oculto: false, PUNTOS: '..'}});
  var l = a.vencimientos(a.D, 9, a.hoy, []), res = a.vistaModelo(a.D, a.hoy).cad.resumen;
  assert.deepEqual(resumen(l), [['atrasado', 'Del trabajo', 200000, '2026-09-30']]);
  assert.equal(200000, res.vencidosIngresos, 'the same 200.000 the chain counts as not collected');
  var raw2 = C.copy(raw); raw2.meses[8].ingresos[0].monto = 300000;
  var b = H.appVista(raw2, T, null, '2026-10-15', {funcs: F_VENCE, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX'], globals: {oculto: false, PUNTOS: '..'}});
  assert.deepEqual(resumen(b.vencimientos(b.D, 9, b.hoy, [])), [], 'covered by the pases');
  var raw3 = C.copy(raw); raw3.meses[8].ingresos[0].pagado = true;
  var c = vence(raw3, '2026-10-15');
  assert.deepEqual(resumen(c.vencimientos(c.D, 9, c.hoy, [])), [], 'ticked');
});

