'use strict';
// E9(a): undoing a quick expense restores the item's previous pagado.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var hojas = [];
var app = loadApp({
  funcs: ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'mesDelModelo', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'filaDelGasto', 'anotarMov'],
  vars: ['gr'],
  globals: {
    oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
    abrirHoja: function(h){ hojas.push(h); }, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(f){}, renderMes: function(){}, toast: function(){}
  }
});

function nuevo(it){
  var m = app.mesVacio();
  m.gastosVariables = [it];
  var meses = []; for(var i = 0; i < 12; i++) meses.push(i === app.mes ? m : app.mesVacio());
  app.D = {anio: 2026, meses: meses};
  return m;
}
function gastar(monto){ app.gr = {monto: monto, cat: 0, sec: 'gastosVariables'}; app.sumarGasto(); }
function ultimoMov(m){ return m.movimientos[m.movimientos.length - 1]; }

test('E9: undo of a quick expense on an empty item restores pagado=false', function(){
  var m = nuevo({nombre: 'Super', monto: 0, pagado: false});
  gastar(100);
  assert.equal(m.gastosVariables[0].pagado, true);          // the quick expense ticks an empty item
  assert.equal(ultimoMov(m).pp, false);                     // and remembers what it was
  app.quitarMov(ultimoMov(m).id);
  assert.equal(m.gastosVariables[0].monto, 0);
  assert.equal(m.gastosVariables[0].pagado, false);
  assert.equal(m.movimientos.length, 0);
});

test('E9: undo on an item that already had a pending amount keeps it pending with its amount (L3: it asks first; both answers)', function(){
  var m = nuevo({nombre: 'Super', monto: 500, pagado: false});
  hojas.length = 0; gastar(100);
  assert.equal(hojas.length, 1, 'D8: a pending row with an amount asks');
  assert.deepEqual([m.gastosVariables[0].monto, m.gastosVariables[0].pagado, m.movimientos.length], [500, false, 0], 'nothing changes while asking');
  app.gastoAparte();
  assert.equal(m.gastosVariables[0].pagado, false);
  app.quitarMov(ultimoMov(m).id);
  assert.deepEqual([m.gastosVariables.length, m.gastosVariables[0].monto, m.gastosVariables[0].pagado], [1, 500, false]);
  gastar(100); app.gastoEsPago(); app.marcarPago(true);
  assert.deepEqual([m.gastosVariables[0].monto, m.gastosVariables[0].pagado], [100, true]);
  app.quitarMov(ultimoMov(m).id);
  assert.deepEqual([m.gastosVariables[0].monto, m.gastosVariables[0].pagado, m.movimientos.length], [500, false, 0]);
});

test('E9: undo on a paid item keeps it paid', function(){
  var m = nuevo({nombre: 'Super', monto: 500, pagado: true});
  gastar(100);
  assert.equal(ultimoMov(m).pp, true);
  app.quitarMov(ultimoMov(m).id);
  assert.equal(m.gastosVariables[0].monto, 500);
  assert.equal(m.gastosVariables[0].pagado, true);
});

test('E9: undoing the first of two quick expenses does not un-tick the item', function(){
  var m = nuevo({nombre: 'Super', monto: 0, pagado: false});
  gastar(100); var primero = ultimoMov(m).id;
  gastar(50);
  app.quitarMov(primero);
  assert.equal(m.gastosVariables[0].monto, 50);
  assert.equal(m.gastosVariables[0].pagado, true);          // the remaining 50 is still money already spent
});

test('E9: old movement entries without pp keep the previous behavior (pagado untouched)', function(){
  var m = nuevo({nombre: 'Super', monto: 100, pagado: true});
  m.movimientos.push({id: 'viejo', fecha: '', sec: 'gastosVariables', nombre: 'Super', monto: 100});
  app.quitarMov('viejo');
  assert.equal(m.gastosVariables[0].monto, 0);
  assert.equal(m.gastosVariables[0].pagado, true);
});

test('normalizar keeps pp on movements and drops non-boolean values', function(){
  var a = loadApp({funcs: ['normalizar'], vars: [], globals: {}});
  var d = a.normalizar({anio: 2026, pagoExplicito: true, meses: [{movimientos: [
    {id: 'a', monto: 5, pp: false}, {id: 'b', monto: 5, pp: true}, {id: 'c', monto: 5}, {id: 'd', monto: 5, pp: 'x'}]}]}, a.hoy);
  var mv = d.meses[0].movimientos;
  assert.strictEqual(mv[0].pp, false);
  assert.strictEqual(mv[1].pp, true);
  assert.equal('pp' in mv[2], false);
  assert.equal('pp' in mv[3], false);
});
