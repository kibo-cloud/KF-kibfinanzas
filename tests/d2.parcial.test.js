'use strict';
// D2 (owner-decisions-closure, L3 partial payment, option b): a quick expense answered "Sí" with an amount SMALLER than the pending row
// can be recorded as a partial payment: the typed part becomes a ticked row "<row> (pago parcial)" (marked aparte: spent money, never
// copied to the next month) and the planned row keeps the rest, still pending. "Dejar" and "Cambiar a" stay as they were. Undo puts both
// rows back exactly.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function filas(l){ return plain(l).map(function(it){ return [it.nombre, it.monto, it.pagado]; }); }
var FUNCS = ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'pagoParcial',
  'filaDelGasto', 'anotarMov', 'renglonLibre', 'esGastoAparte'];
function modelo(ls){ var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado'); C.mes(d, 9, {gastosVariables: ls}); return d; }
function app(raw){
  var hojas = [], toasts = [];
  var a = H.appVista(raw, null, null, null, {funcs: FUNCS, vars: ['gr'],
    globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
      abrirHoja: function(h){ hojas.push(h); }, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){}, toast: function(t, ac, act, id){ toasts.push([t, ac, act, id]); }}});
  a.hojas = hojas; a.toasts = toasts;
  return a;
}
function gasto(a, monto, cat){ a.gr = {monto: monto, cat: cat || 0, sec: 'gastosVariables'}; a.sumarGasto(); }
function flujo(d){ var f = plain(M.flujosMes(M.normalizar(C.copy(plain(d)), HOY), 9, HOY, {})); return [f.gastosReal, f.gastosPend]; }

test('D2 the amount question offers the partial payment only when the typed amount is smaller than the row', function(){
  var a = app(modelo([C.it('Super', 50000, false)]));
  gasto(a, 20000); a.gastoEsPago();
  var h = a.hojas[1];
  assert.match(h, /data-act="pagoParcial">Pagué una parte: quedan \$30\.000 pendientes</);
  assert.match(h, /data-act="pagoMonto" data-v="fila">Dejar \$50\.000</, 'Dejar kept');
  assert.match(h, /data-act="pagoMonto" data-v="gasto">Cambiar a \$20\.000</, 'Cambiar a kept');
  var b = app(modelo([C.it('Super', 50000, false)]));
  gasto(b, 60000); b.gastoEsPago();
  assert.doesNotMatch(b.hojas[1], /pagoParcial/, 'a bigger amount is not a partial payment');
});

test('D2 partial payment: the typed part is a ticked row, the rest stays pending in the planned row; the month money follows', function(){
  var a = app(modelo([C.it('Super', 50000, false), C.it('Nafta', 30000, false)])), antes = plain(a.D.meses[9]);
  assert.deepEqual(flujo(a.D), [0, 80000]);
  gasto(a, 20000); a.gastoEsPago(); a.pagoParcial();
  assert.deepEqual(filas(a.D.meses[9].gastosVariables), [['Super', 30000, false], ['Nafta', 30000, false], ['Super (pago parcial)', 20000, true]]);
  assert.equal(a.D.meses[9].gastosVariables[2].aparte, true, 'spent money: never copied to the next month');
  assert.equal(a.esGastoAparte(a.D.meses[9].gastosVariables[2]), true);
  assert.deepEqual(flujo(a.D), [20000, 60000], 'paid 20.000, still pending 30.000 + 30.000');
  var mv = plain(a.D.meses[9].movimientos[0]);
  assert.deepEqual([mv.nombre, mv.monto, mv.tipo, mv.nueva, mv.rn, mv.rfo, mv.rfn], ['Super (pago parcial)', 20000, 'parcial', true, 'Super', 0, 1]);
  assert.deepEqual(a.toasts[0].slice(0, 3), ['Anoté $20.000 como pago parcial de Super. Quedan $30.000 pendientes', 'Deshacer', 'quitarMov']);
  a.quitarMov(mv.id);
  assert.deepEqual(plain(a.D.meses[9]), antes, 'undo: both rows exactly as before, the created row removed');
});

test('D2 a second partial payment adds to the same ticked row; undo gives each part back', function(){
  var a = app(modelo([C.it('Super', 50000, false)]));
  gasto(a, 20000); a.gastoEsPago(); a.pagoParcial();
  var medio = plain(a.D.meses[9]);
  gasto(a, 25000); a.gastoEsPago(); a.pagoParcial();
  assert.deepEqual(filas(a.D.meses[9].gastosVariables), [['Super', 5000, false], ['Super (pago parcial)', 45000, true]]);
  assert.equal(a.D.meses[9].movimientos[1].nueva, false);
  a.quitarMov(a.D.meses[9].movimientos[1].id);
  assert.deepEqual(plain(a.D.meses[9]), medio, 'the reused row keeps the first part');
});

test('D2 undo refuses when the planned row is gone or renamed: nothing changes', function(){
  var a = app(modelo([C.it('Super', 50000, false)]));
  gasto(a, 20000); a.gastoEsPago(); a.pagoParcial();
  a.D.meses[9].gastosVariables[0].nombre = 'Supermercado';
  var antes = plain(a.D.meses[9]);
  a.quitarMov(a.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(a.D.meses[9]), antes);
  assert.equal(a.toasts[a.toasts.length - 1][0], 'No encontré el renglón para deshacer');
});

test('D2 the answer refuses when the row changed meanwhile (U6) and when the amount is not smaller', function(){
  var a = app(modelo([C.it('Super', 50000, false)]));
  gasto(a, 20000); a.gastoEsPago();
  a.D.meses[9].gastosVariables[0].pagado = true;
  var antes = plain(a.D.meses);
  a.pagoParcial();
  assert.deepEqual(plain(a.D.meses), antes);
  assert.equal(a.toasts[0][0], 'Super cambió mientras respondías: no anoté nada. Volvé a sumar el gasto.');
  var b = app(modelo([C.it('Super', 50000, false)]));
  gasto(b, 50000); b.gr.monto = 50000;
  var antesB = plain(b.D.meses);
  b.pagoParcial();
  assert.deepEqual(plain(b.D.meses), antesB, 'same amount: not a partial payment, nothing written');
});

test('D2 a stored partial movement keeps what undo needs (normalizar); junk is dropped', function(){
  var d = modelo([C.it('Super', 30000, false), C.it('Super (pago parcial)', 20000, true)]);
  d.meses[9].movimientos = [{id: 'a', fecha: '', sec: 'gastosVariables', nombre: 'Super (pago parcial)', monto: 20000, pp: false, tipo: 'parcial', nueva: true, rn: 'Super', rfo: 0, rfn: 1},
    {id: 'b', fecha: '', sec: 'gastosVariables', nombre: 'X', monto: 1, tipo: 'parcial', nueva: 'si', rn: 5, rfo: -1, rfn: 0}];
  var n = plain(M.normalizar(C.copy(d), HOY).meses[9].movimientos);
  assert.deepEqual([n[0].tipo, n[0].nueva, n[0].rn, n[0].rfo, n[0].rfn], ['parcial', true, 'Super', 0, 1]);
  assert.deepEqual([n[1].tipo, n[1].nueva, n[1].rn, n[1].rfo, n[1].rfn], ['parcial', undefined, undefined, undefined, undefined]);
});
