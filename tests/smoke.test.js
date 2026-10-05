'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

test('loads engine and computes a basic month', function(){
  var app = loadApp({today: '2026-06-15'});
  var m = app.mesVacio();
  m.ingresos[0].monto = 1000;
  m.gastosFijos[0].monto = 300;
  m.ingresos[0].pagado = true;
  m.gastosFijos[0].pagado = true;
  var c = app.calc(m);
  assert.equal(c.totalIngresos, 1000);
  assert.equal(c.totalGastos, 300);
  assert.equal(app.serie(app.normalizar({anio: 2026})).length, 12);
});

test('mesTope uses the injected today', function(){
  var app = loadApp({today: '2026-06-15'});
  app.D = {anio: 2026};
  assert.equal(app.mesTope(), 5);
  app.D = {anio: 2025};
  assert.equal(app.mesTope(), 11);
  app.D = {anio: 2027};
  assert.equal(app.mesTope(), -1);
});
