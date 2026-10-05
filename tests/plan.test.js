'use strict';
// Debt-plan form: text still being typed ("100000,") may preview as 0, but saving must reject it.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

function formulario(valores){
  var els = {};
  Object.keys(valores).forEach(function(id){
    els[id] = {value: valores[id], classList: {add: function(){}, remove: function(){}}};
  });
  return {getElementById: function(id){ return els[id] || null; }};
}
function app(valores){
  return loadApp({funcs: ['sinSigno', 'cerosFuera', 'parseMonto', 'parseCantidad', 'parseEntero', 'parsePct', 'parcial', 'marcarErr', 'leerPlan'],
                  globals: {document: formulario(valores)}});
}
var base = {plTotal: '100.000', plCuotas: '3', plRec: '10', plAntes: '0'};
function con(id, v){ var o = Object.assign({}, base); o[id] = v; return o; }

test('preview treats a trailing separator as 0 while typing', function(){
  var r = app(con('plTotal', '100000,')).plain(app(con('plTotal', '100000,')).leerPlan());
  assert.equal(r.mal, undefined);
  assert.equal(r.total, 0);
});

test('saving rejects a trailing separator instead of storing 0', function(){
  ['100000,', '100.000.'].forEach(function(t){
    var a = app(con('plTotal', t));
    assert.equal(a.plain(a.leerPlan(true)).mal, t, 'total ' + t);
  });
  var a2 = app(con('plRec', '10,'));
  assert.equal(a2.plain(a2.leerPlan(true)).mal, '10,');
  var a3 = app(con('plAntes', '2.'));
  assert.equal(a3.plain(a3.leerPlan(true)).mal, '2.');
});

test('saving accepts complete valid values', function(){
  var a = app(base);
  assert.deepEqual(a.plain(a.leerPlan(true)), {total: 100000, cuotas: 3, recargo: 10, antes: 0});
});
