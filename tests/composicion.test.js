'use strict';
// Composition views (yearly ranking and monthly pie) count only realized money: pagado === true.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var app = loadApp({today: '2026-06-15', funcs: ['ranking', 'datosTorta'], vars: ['TORTA_MAX']});

function anio(){
  var d = {anio: 2026, meses: []};
  for(var i = 0; i < 12; i++){
    var m = app.mesVacio();
    m.gastosFijos = [{nombre: 'Alquiler', monto: 0, pagado: false}];
    m.gastosVariables = [{nombre: 'Super', monto: 0, pagado: false}];
    m.deudas = [{nombre: 'Prestamo', monto: 0, pagado: false}];
    d.meses.push(m);
  }
  return d;
}
function rk(d){ return app.plain(app.ranking(d)); }
function torta(m){ return app.plain(app.datosTorta(m, app.mes)).map(function(x){ return [x.n, x.v]; }); }

test('ranking: a pending expense does not appear', function(){
  var d = anio();
  d.meses[0].gastosVariables[0].monto = 5000;
  assert.deepEqual(rk(d), []);
});

test('ranking: ticking adds it, unticking removes it again', function(){
  var d = anio(), it = d.meses[0].gastosVariables[0];
  it.monto = 5000;
  app.alternarPago(0, it);
  assert.deepEqual(rk(d), [{nombre: 'Super', monto: 5000}]);
  app.alternarPago(0, it);
  assert.deepEqual(rk(d), []);
});

test('ranking: mixed paid and pending across months sums only paid', function(){
  var d = anio();
  d.meses[0].gastosFijos[0].monto = 30000; d.meses[0].gastosFijos[0].pagado = true;
  d.meses[1].gastosFijos[0].monto = 30000;                                           // pending
  d.meses[2].gastosFijos[0].monto = 32000; d.meses[2].gastosFijos[0].pagado = true;
  d.meses[0].gastosVariables[0].monto = 8000;                                         // pending
  d.meses[1].gastosVariables[0].monto = 9000; d.meses[1].gastosVariables[0].pagado = true;
  assert.deepEqual(rk(d), [{nombre: 'Alquiler', monto: 62000}, {nombre: 'Super', monto: 9000}]);
});

test('ranking: repeated toggles never double count', function(){
  var d = anio(), it = d.meses[3].gastosFijos[0];
  it.monto = 1000; it.pagado = true;
  var antes = rk(d);
  for(var n = 0; n < 6; n++) app.alternarPago(3, it);
  assert.deepEqual(rk(d), antes);
  it.pagado = true; it.pagado = true;
  assert.deepEqual(rk(d), [{nombre: 'Alquiler', monto: 1000}]);
});

test('ranking: editing a pending amount keeps it out; editing a paid amount updates it', function(){
  var d = anio(), it = d.meses[0].gastosFijos[0];
  it.monto = 1000;
  it.monto = 4000;
  assert.deepEqual(rk(d), []);
  it.pagado = true;
  it.monto = 7000;
  assert.deepEqual(rk(d), [{nombre: 'Alquiler', monto: 7000}]);
});

test('pie: a pending item does not appear; ticked items do', function(){
  var m = anio().meses[5];
  m.gastosFijos[0].monto = 30000;
  m.gastosVariables[0].monto = 8000;
  m.deudas[0].monto = 10000;
  assert.deepEqual(torta(m), []);
  app.alternarPago(5, m.gastosFijos[0]);
  app.alternarPago(5, m.deudas[0]);
  assert.deepEqual(torta(m), [['Alquiler', 30000], ['Prestamo', 10000]]);
});

test('pie: unticking excludes again and toggling does not accumulate', function(){
  var m = anio().meses[5], it = m.gastosVariables[0];
  it.monto = 8000;
  app.alternarPago(5, it);
  assert.deepEqual(torta(m), [['Super', 8000]]);
  app.alternarPago(5, it);
  assert.deepEqual(torta(m), []);
  for(var n = 0; n < 5; n++) app.alternarPago(5, it);   // odd count: ends paid
  assert.deepEqual(torta(m), [['Super', 8000]]);
});

test('pie: editing pending keeps it out; editing paid updates the slice', function(){
  var m = anio().meses[5], it = m.gastosFijos[0];
  it.monto = 1000; it.monto = 2500;
  assert.deepEqual(torta(m), []);
  it.pagado = true; it.monto = 4000;
  assert.deepEqual(torta(m), [['Alquiler', 4000]]);
});

test('pie total matches calc realized gastos + deudas', function(){
  var m = anio().meses[5];
  m.gastosFijos[0].monto = 30000; m.gastosFijos[0].pagado = true;
  m.gastosVariables[0].monto = 8000;                              // pending
  m.deudas[0].monto = 10000; m.deudas[0].pagado = true;
  var total = app.plain(app.datosTorta(m)).reduce(function(t, x){ return t + x.v; }, 0);
  var c = app.calc(m);
  assert.equal(total, c.totalGastos + c.totalDeudas);
});
