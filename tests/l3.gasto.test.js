'use strict';
// L3 (R7, rule D8): a quick expense on a pending row with an amount asks whether it is that payment. The guard, the paths around it,
// and undo restoring exactly the previous state. Money rules are the R4 contract's; D16-15 (tests/r4.matriz.test.js) runs the chain.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function filas(l){ return plain(l).map(function(it){ return {nombre: it.nombre, monto: it.monto, pagado: it.pagado}; }); }
var FUNCS = ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'filaDelGasto', 'anotarMov'];
// a model year from October (desde 9); today 2026-10-15: September past, October current, November future
function modelo(filas, j){
  var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado'); C.mes(d, j === undefined ? 9 : j, filas); return d;
}
function legacy(filas, j){ var d = C.vacio(2025); C.mes(d, j, filas); return d; }
function app(raw, mes){
  var hojas = [], toasts = [];
  var a = H.appVista(raw, null, null, null, {funcs: FUNCS, vars: ['gr'],
    globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
      abrirHoja: function(h){ hojas.push(h); }, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){}, toast: function(t, ac, act, id){ toasts.push([t, ac, act, id]); }}});
  a.hojas = hojas; a.toasts = toasts;
  if(mes !== undefined) a.mes = mes;
  return a;
}
function gasto(a, monto, cat, sec){ a.gr = {monto: monto, cat: cat || 0, sec: sec || 'gastosVariables'}; a.sumarGasto(); }

test('L3 guard: asks only for a pending row with an amount, in a current, past or legacy month; never in a future month of the model', function(){
  var hoy = C.hoy('2026-10-15'), a = app(modelo({gastosVariables: [C.it('Super', 50000, false)]}));
  var d = a.D, it = function(n, p){ return {nombre: 'X', monto: n, pagado: p}; };
  assert.equal(a.preguntaPago(d, 9, it(50000, false), hoy), true, 'current month, pending with amount');
  assert.equal(a.preguntaPago(d, 9, it(50000, true), hoy), false, 'already ticked: plain sum (as before)');
  assert.equal(a.preguntaPago(d, 9, it(0, false), hoy), false, 'empty row: the quick expense ticks it (as before)');
  assert.equal(a.preguntaPago(d, 10, it(50000, false), hoy), false, 'future month of the model: N4 I-1 (programado, no tick)');
  var p = app(modelo({gastosVariables: [C.it('Super', 50000, false)]}, 9));
  p.D.arrastre.desde = 8;
  assert.equal(p.preguntaPago(p.D, 8, it(50000, false), hoy), true, 'past month of the model');
  var l = app(legacy({gastosVariables: [C.it('Super', 50000, false)]}, 11), 11);
  assert.equal(l.preguntaPago(l.D, 11, it(50000, false), hoy), true, 'legacy month: D8 is about the row, not the model');
});

test('L3 the question does not change anything; Cancelar leaves the month as it was', function(){
  var a = app(modelo({gastosVariables: [C.it('Super', 50000, false)]})), antes = plain(a.D.meses[9]);
  gasto(a, 20000);
  assert.equal(a.hojas.length, 1);
  assert.match(a.hojas[0], /data-act="gastoEsPago">Sí, marcarlo como pagado</);
  assert.match(a.hojas[0], /data-act="gastoAparte">No, es otro gasto</);
  assert.match(a.hojas[0], /data-act="cerrarHoja">Cancelar</);
  assert.deepEqual(plain(a.D.meses[9]), antes);
  assert.deepEqual(a.toasts, []);
});

test('L3 the row name is escaped in the question', function(){
  var a = app(modelo({gastosVariables: [C.it('<img src=x onerror=1>', 50000, false)]}));
  gasto(a, 20000);
  assert.equal(a.hojas[0].indexOf('<img'), -1);
  assert.match(a.hojas[0], /&lt;img/);
});

test('L3 "Sí" with the same amount ticks the row directly: no second question, no new row; undo restores it', function(){
  var a = app(modelo({gastosVariables: [C.it('Super', 50000, false)]})), antes = plain(a.D.meses[9]);
  gasto(a, 50000); a.gastoEsPago();
  assert.equal(a.hojas.length, 1, 'no amount question');
  assert.deepEqual(filas(a.D.meses[9].gastosVariables), [{nombre: 'Super', monto: 50000, pagado: true}]);
  var mv = plain(a.D.meses[9].movimientos[0]);
  assert.deepEqual([mv.nombre, mv.monto, mv.pp, mv.tipo, mv.ma], ['Super', 50000, false, 'pago', 50000]);
  assert.equal(a.toasts[0][0], 'Marqué Super como pagado'); assert.equal(a.toasts[0][2], 'quitarMov');
  a.quitarMov(mv.id);
  assert.deepEqual(plain(a.D.meses[9]), antes);
});

test('L3 "No, es otro gasto" reuses its separate row when it is ticked; a pending one is never mixed in', function(){
  var a = app(modelo({gastosVariables: [C.it('Super', 50000, false), C.it('Super (otro gasto)', 10000, true)]})), antes = plain(a.D.meses[9]);
  gasto(a, 20000); a.gastoAparte();
  assert.deepEqual(filas(a.D.meses[9].gastosVariables), [{nombre: 'Super', monto: 50000, pagado: false}, {nombre: 'Super (otro gasto)', monto: 30000, pagado: true}]);
  a.quitarMov(a.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(a.D.meses[9]), antes, 'undo subtracts from the reused row and keeps it');
  var b = app(modelo({gastosVariables: [C.it('Super', 50000, false), C.it('Super (otro gasto)', 10000, false)]})), antesB = plain(b.D.meses[9]);
  gasto(b, 20000); b.gastoAparte();
  assert.deepEqual(filas(b.D.meses[9].gastosVariables).slice(1), [{nombre: 'Super (otro gasto)', monto: 10000, pagado: false}, {nombre: 'Super (otro gasto 2)', monto: 20000, pagado: true}]);
  b.quitarMov(b.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(b.D.meses[9]), antesB);
});

test('L3 gastosFijos too; the movement keeps its section', function(){
  var a = app(modelo({gastosFijos: [C.it('Luz', 30000, false)]})), antes = plain(a.D.meses[9]);
  gasto(a, 32000, 0, 'gastosFijos'); a.gastoEsPago(); a.marcarPago(true);
  assert.deepEqual(filas(a.D.meses[9].gastosFijos), [{nombre: 'Luz', monto: 32000, pagado: true}]);
  a.quitarMov(a.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(a.D.meses[9]), antes);
});

test('L3 future month of the model keeps N4 I-1: amount added, no tick, no question', function(){
  var a = app(modelo({gastosVariables: [C.it('Super', 50000, false)]}, 10), 10);
  gasto(a, 20000);
  assert.equal(a.hojas.length, 0);
  assert.deepEqual(filas(a.D.meses[10].gastosVariables), [{nombre: 'Super', monto: 70000, pagado: false}]);
});

test('L3 a stored movement keeps what undo needs (normalizar): tipo and the previous amount', function(){
  var d = modelo({gastosVariables: [C.it('Super', 50000, true)]});
  d.meses[9].movimientos = [{id: 'a', fecha: '2026-10-10T10:00:00.000Z', sec: 'gastosVariables', nombre: 'Super', monto: 50000, pp: false, tipo: 'pago', ma: 30000},
    {id: 'b', fecha: '2026-10-10T10:00:00.000Z', sec: 'gastosVariables', nombre: 'Super (otro gasto)', monto: 1, pp: false, tipo: 'aparte'},
    {id: 'c', fecha: '', sec: 'gastosVariables', nombre: 'Super', monto: 1, tipo: 'raro', ma: 'x'}];
  var n = plain(M.normalizar(C.copy(d), C.hoy('2026-10-15')).meses[9].movimientos);
  assert.deepEqual([n[0].tipo, n[0].ma, n[1].tipo, n[1].ma, n[2].tipo, n[2].ma], ['pago', 30000, 'aparte', undefined, undefined, undefined]);
});
