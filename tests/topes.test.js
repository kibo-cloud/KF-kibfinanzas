'use strict';
// Budget caps (topes) are consumed only by paid items: pagado === true.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var app = loadApp({today: '2026-06-15', funcs: ['gastadoTope', 'gastadoVista', 'esProgramado', 'mesDelModelo', 'filaTope', 'pasadas', 'textoTopes', 'fARS', 'grupos', 'esc'],
                   vars: ['TOPEABLE', 'PUNTOS'], globals: {oculto: false}});

// Rendered bar: {txt, pct, mal} parsed from filaTope's HTML
function barra(it){
  var h = app.filaTope('gastosVariables', 0, it);
  var txt = /<small[^>]*>([^<]*)<\/small>/.exec(h)[1];
  var pct = +/width:([\d.]+)%/.exec(h)[1];
  return {txt: txt, pct: pct, mal: /<i [^>]*class="mal"/.test(h)};
}
function mes(){
  var m = app.mesVacio();
  m.gastosFijos = [{nombre: 'Alquiler', monto: 0, tope: 0, pagado: false}];
  m.gastosVariables = [{nombre: 'Super', monto: 0, tope: 10000, pagado: false},
                       {nombre: 'Salidas', monto: 0, tope: 5000, pagado: false}];
  return m;
}

test('pending expense does not consume the budget', function(){
  var it = {nombre: 'Super', monto: 8000, tope: 10000, pagado: false};
  assert.equal(app.gastadoTope(it, app.mes), 0);
  assert.deepEqual(barra(it), {txt: '— de $10.000', pct: 0, mal: false});
});

test('paid expense consumes the budget', function(){
  var it = {nombre: 'Super', monto: 8000, tope: 10000, pagado: true};
  assert.equal(app.gastadoTope(it, app.mes), 8000);
  assert.deepEqual(barra(it), {txt: '$8.000 de $10.000', pct: 80, mal: false});
});

test('untick stops consuming; re-tick consumes exactly once', function(){
  var it = {nombre: 'Super', monto: 8000, tope: 10000, pagado: true};
  app.alternarPago(5, it);
  assert.deepEqual(barra(it), {txt: '— de $10.000', pct: 0, mal: false});
  app.alternarPago(5, it);
  assert.deepEqual(barra(it), {txt: '$8.000 de $10.000', pct: 80, mal: false});
});

test('repeated toggles never double count', function(){
  var it = {nombre: 'Super', monto: 8000, tope: 10000, pagado: true};
  for(var n = 0; n < 6; n++) app.alternarPago(5, it);
  assert.equal(app.gastadoTope(it, app.mes), 8000);
  assert.deepEqual(barra(it), {txt: '$8.000 de $10.000', pct: 80, mal: false});
  it.pagado = true; it.pagado = true;
  assert.equal(app.gastadoTope(it, app.mes), 8000);
});

test('mixed paid and pending: only paid rows are over the cap', function(){
  var m = mes();
  m.gastosVariables[0].monto = 15000;                                  // pending, would be over
  m.gastosVariables[1].monto = 6000; m.gastosVariables[1].pagado = true; // paid, over 5000
  assert.deepEqual(app.plain(app.pasadas(m)), ['Salidas']);
  assert.equal(app.textoTopes(m), 'Te pasaste del tope en <b>Salidas</b>.');
});

test('editing a pending amount does not move the bar; editing a paid amount does', function(){
  var it = {nombre: 'Super', monto: 3000, tope: 10000, pagado: false};
  it.monto = 50000;
  assert.deepEqual(barra(it), {txt: '— de $10.000', pct: 0, mal: false});
  it.pagado = true; it.monto = 4000;
  assert.deepEqual(barra(it), {txt: '$4.000 de $10.000', pct: 40, mal: false});
  it.monto = 9000;
  assert.deepEqual(barra(it), {txt: '$9.000 de $10.000', pct: 90, mal: false});
});

test('exact limit is full but not over', function(){
  var m = mes(), it = m.gastosVariables[0];
  it.monto = 10000; it.pagado = true;
  assert.deepEqual(barra(it), {txt: '$10.000 de $10.000', pct: 100, mal: false});
  assert.deepEqual(app.plain(app.pasadas(m)), []);
  assert.equal(app.textoTopes(m), '');
});

test('over the limit only when paid', function(){
  var m = mes(), it = m.gastosVariables[0];
  it.monto = 12500;
  assert.deepEqual(app.plain(app.pasadas(m)), []);
  it.pagado = true;
  assert.deepEqual(barra(it), {txt: 'Te pasaste por $2.500 del tope de $10.000', pct: 100, mal: true});
  assert.deepEqual(app.plain(app.pasadas(m)), ['Super']);
});

test('deleting a paid over-cap expense clears the warning; deleting a pending one changes nothing', function(){
  var m = mes();
  m.gastosVariables[0].monto = 12000; m.gastosVariables[0].pagado = true;  // paid, over
  m.gastosVariables[1].monto = 9000;                                        // pending, would be over
  assert.deepEqual(app.plain(app.pasadas(m)), ['Super']);
  m.gastosVariables.splice(1, 1);                                           // delete pending
  assert.deepEqual(app.plain(app.pasadas(m)), ['Super']);
  m.gastosVariables.splice(0, 1);                                           // delete paid
  assert.deepEqual(app.plain(app.pasadas(m)), []);
});

test('only TOPEABLE sections are checked', function(){
  var m = mes();
  m.deudas = [{nombre: 'Prestamo', monto: 99999, tope: 1, pagado: true}];
  assert.deepEqual(app.plain(app.pasadas(m)), []);
});
