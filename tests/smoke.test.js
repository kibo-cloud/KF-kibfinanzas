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
  assert.equal(app.serie(app.normalizar({anio: 2026}, app.hoy)).length, 12);
});

test('mesTope uses the injected today', function(){
  var app = loadApp({today: '2026-06-15'});
  assert.equal(app.mesTope(2026, app.hoy), 5);
  assert.equal(app.mesTope(2025, app.hoy), 11);
  assert.equal(app.mesTope(2027, app.hoy), -1);
});
