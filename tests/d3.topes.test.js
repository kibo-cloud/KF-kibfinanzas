'use strict';
// D3 (owner-decisions-closure, "(otro gasto)" vs topes, option b): a quick expense recorded apart as "<row> (otro gasto)" (L3) or as a
// partial payment "<row> (pago parcial)" (D2) is spent in the same category, so it counts toward the tope of <row>. Budget alerts only:
// no balance, total or stored value changes.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

function plain(x){ return JSON.parse(JSON.stringify(x)); }
function fila(n, monto, pagado, tope, aparte){ var o = {nombre: n, monto: monto, tope: tope || 0, frec: '', dias: [], pagado: pagado}; if(aparte) o.aparte = true; return o; }
function app(gv, gf, j){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, j === undefined ? 9 : j, {gastosVariables: gv, gastosFijos: gf || []});
  var a = H.appVista(d, null, null, '2026-10-15', {funcs: ['gastadoVista', 'esProgramado', 'filaTope', 'pasadas', 'textoTopes', 'fARS', 'grupos', 'esc', 'esGastoAparte', 'baseAparte', 'gastadoConApartes'],
    vars: ['TOPEABLE'], globals: {oculto: false, PUNTOS: '..'}});
  if(j !== undefined) a.mes = j;
  return a;
}
function barra(a, i){ var h = a.filaTope('gastosVariables', i, a.D.meses[a.mes].gastosVariables[i]); return /<small[^>]*>([^<]*)<\/small>/.exec(h)[1]; }

test('D3 "(otro gasto)" and "(pago parcial)" rows count toward the tope of their row', function(){
  var a = app([fila('Super', 40000, true, 50000), fila('Super (otro gasto)', 20000, true, 0, true), fila('Super (pago parcial)', 5000, true, 0, true)]);
  assert.equal(a.gastadoConApartes(a.D.meses[9].gastosVariables, a.D.meses[9].gastosVariables[0], 9), 65000);
  assert.equal(barra(a, 0), 'Te pasaste por $15.000 del tope de $50.000');
  assert.deepEqual(plain(a.pasadas(a.D.meses[9])), ['Super']);
});

test('D3 only ticked one-off rows of that exact row name, in the same section, count', function(){
  var a = app([fila('Super', 10000, true, 50000), fila('Super (otro gasto)', 20000, false, 0, true), fila('Supermercado (otro gasto)', 30000, true, 0, true),
    fila('Super (otro gasto 2)', 7000, true, 0, true), fila('Super (pago parcial)', 3000, true, 0, false)], [fila('Super (otro gasto)', 90000, true, 0, true)]);
  assert.equal(a.gastadoConApartes(a.D.meses[9].gastosVariables, a.D.meses[9].gastosVariables[0], 9), 17000,
    'pending one-off: no; another row name: no; "(otro gasto 2)": yes; "(pago parcial)" without the aparte mark (typed by hand): no; other section: no');
  assert.deepEqual(plain(a.pasadas(a.D.meses[9])), []);
});

test('D3 an old "(otro gasto)" row saved before the aparte mark still counts (same name rule as esGastoAparte)', function(){
  var a = app([fila('Luz', 0, false, 10000), fila('Luz (otro gasto)', 12000, true)]);
  assert.equal(barra(a, 0), 'Te pasaste por $2.000 del tope de $10.000');
});

test('D3 a future (programado) month consumes nothing, as before', function(){
  var a = app([fila('Super', 40000, true, 50000), fila('Super (otro gasto)', 20000, true, 0, true)], null, 10);
  assert.equal(a.gastadoConApartes(a.D.meses[10].gastosVariables, a.D.meses[10].gastosVariables[0], 10), 0);
});
