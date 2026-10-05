'use strict';
// E4 / D9: explicit Argentine number parsing per field type. NaN = not understood; empty = 0.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var app = loadApp({
  funcs: ['sinSigno', 'cerosFuera', 'parseMonto', 'parseCantidad', 'parsePct', 'parseEntero', 'crudo', 'marcarErr', 'parcial', 'valorDe', 'aplicarInput'],
  globals: {
    tab: 'mes',
    tocar: function(){ app.tocado = (app.tocado || 0) + 1; },
    refrescar: function(){}, renderUSD: function(){}, conScroll: function(f){}, render: function(){},
    toast: function(t){ app.toasts.push(t); }
  }
});
app.toasts = [];

function tabla(fn, casos, extra){
  casos.forEach(function(c){
    var got = extra === undefined ? fn(c[0]) : fn(c[0], extra);
    if(Number.isNaN(c[1])) assert.ok(Number.isNaN(got), JSON.stringify(c[0]) + ' should be NaN, got ' + got);
    else assert.equal(got, c[1], JSON.stringify(c[0]));
  });
}

test('parseMonto: Argentine money rules', function(){
  tabla(app.parseMonto, [
    ['1234', 1234], ['1.234', 1234], ['1.234.567', 1234567], ['1.234,56', 1234.56], ['1234,5', 1234.5], ['1,5', 1.5],
    ['0,5', 0.5], [',5', 0.5], ['0.001', 0.001], ['0.5', 0.5], ['1.5', 1.5], ['12.3456', 12.3456], ['$ 1.500', 1500], ['$1500', 1500],
    ['  7  ', 7], ['', 0], ['   ', 0], ['$', 0], ['999.999', 999999]
  ]);
});

test('parseMonto: ambiguous or exotic input is rejected, never guessed', function(){
  ['1e3', '1E3', '12.5,3', '1,2,3', '1.23.4', '-5', '-', '1-2', 'abc', '1234.567', '01.234', '1.', '1,', '.', ',', '1.2.3', '12,5.3', '1 2 3x', '(500)', '1.234,5,6', '00.5']
    .forEach(function(s){ assert.ok(Number.isNaN(app.parseMonto(s)), JSON.stringify(s)); });
});

test('parseMonto: negatives only where the field allows them', function(){
  tabla(app.parseMonto, [['-5', -5], ['-1.234,5', -1234.5], ['-0,5', -0.5], ['-', NaN], ['--5', NaN], ['5-', NaN]], true);
  assert.ok(Object.is(app.parseMonto('-0', true), 0));   // no negative zero
});

test('parseCantidad: single separator is the decimal point, any number of decimals', function(){
  tabla(app.parseCantidad, [
    ['0.001', 0.001], ['0,001', 0.001], ['1234.5678', 1234.5678], ['1234,5678', 1234.5678], ['1.234,5', 1234.5], ['1.234.567', 1234567],
    ['1.234', 1.234], ['5', 5], ['0.00000001', 1e-8], [',5', 0.5], ['', 0], [' 2 ', 2]
  ]);
  ['1,234.5', '1e3', '1e-8', '-1', '1.2.3', '1,2,3', '12.5,3', 'abc', '1.', '1.234.5'].forEach(function(s){
    assert.ok(Number.isNaN(app.parseCantidad(s)), JSON.stringify(s));
  });
});

test('parsePct: decimal comma or dot, optional percent sign, same rejections', function(){
  tabla(app.parsePct, [['10', 10], ['12,5', 12.5], ['12.5', 12.5], ['10%', 10], ['10 %', 10], ['', 0], ['0,5', 0.5]]);
  ['-5', '1e2', 'diez', '1,2,3', '1.', '12,5.3'].forEach(function(s){ assert.ok(Number.isNaN(app.parsePct(s)), JSON.stringify(s)); });
  tabla(app.parsePct, [['-5', -5], ['-12,5', -12.5], ['-', NaN]], true);
});

test('parseEntero: digits only (valid thousands dots allowed), negatives only when allowed', function(){
  tabla(app.parseEntero, [['12', 12], ['1.000', 1000], ['', 0], [' 3 ', 3], ['1 000', 1000], ['0', 0]]);
  ['1.0', '3,5', '-3', 'x', '1e3', '12.5', '1.00', '1.', '--1'].forEach(function(s){ assert.ok(Number.isNaN(app.parseEntero(s)), JSON.stringify(s)); });
  tabla(app.parseEntero, [['-3', -3], ['-1.000', -1000], ['-', NaN]], true);
});

test('crudo never writes exponent notation (it is read back by the parsers)', function(){
  assert.equal(app.crudo(0), '');
  assert.equal(app.crudo(1234.5), '1234,5');
  assert.equal(app.crudo(0.00000001), '0,00000001');
  assert.equal(app.crudo(0.001), '0,001');
  assert.ok(Number.isNaN(app.parseCantidad(app.crudo(1e-7))) === false);
  assert.equal(app.parseCantidad(app.crudo(0.00000001)), 1e-8);
});

// ── UI behavior of aplicarInput with a fake element ──
function fakeEl(clases, attrs, value){
  var set = {}; clases.forEach(function(c){ set[c] = true; });
  return {
    value: value, classList: {
      contains: function(c){ return !!set[c]; }, add: function(c){ set[c] = true; }, remove: function(c){ delete set[c]; },
      toggle: function(c, on){ if(on === undefined) on = !set[c]; if(on) set[c] = true; else delete set[c]; return on; }
    },
    getAttribute: function(a){ return attrs.hasOwnProperty(a) ? attrs[a] : null; }
  };
}
function nuevoD(){
  var meses = []; for(var i = 0; i < 12; i++) meses.push(app.plain({ingresos: [], gastosFijos: [{nombre: 'Alquiler', monto: 500, pagado: true}], gastosVariables: [], deudas: [], metaAhorroPct: 0.1}));
  app.D = {anio: 2026, meses: meses, cripto: [{activo: 'BTC', cantidad: 0.5, precioUSD: 100}], cotizacionUSD: 1000, ahorroAnioAnterior: 0, usdAnioAnterior: 0, cotizacionFecha: ''};
  app.toasts.length = 0; app.tocado = 0;
}
var ALQ = function(v){ return fakeEl(['monto'], {'data-k': 'gastosFijos', 'data-i': '0'}, v); };

test('aplicarInput: invalid text while typing keeps the last valid value and marks the field', function(){
  nuevoD();
  var t = ALQ('1e3');
  app.aplicarInput(t, false);
  assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 500);
  assert.equal(t.classList.contains('err'), true);
  assert.deepEqual(app.toasts, []);   // no message until blur
  t.value = '1500'; app.aplicarInput(t, false);
  assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 1500);
  assert.equal(t.classList.contains('err'), false);
});

test('aplicarInput: transient partial input ("1." / "1,") does not flash an error while typing', function(){
  nuevoD();
  ['1.', '1,', '12.5.'].forEach(function(s){
    var t = ALQ(s); app.aplicarInput(t, false);
    assert.equal(t.classList.contains('err'), false, s);
    assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 500, s);
  });
  assert.deepEqual(app.toasts, []);
});

test('aplicarInput: committing invalid text shows a message and writes nothing', function(){
  nuevoD();
  var t = ALQ('1e3'); app.aplicarInput(t, true);
  assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 500);
  assert.deepEqual(app.toasts, ['No entendí «1e3» como número']);
  assert.equal(t.classList.contains('err'), false);
  app.toasts.length = 0;
  var p = ALQ('1.'); app.aplicarInput(p, true);   // a dangling separator is also an error once committed
  assert.equal(app.toasts.length, 1);
  assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 500);
});

test('aplicarInput: valid Argentine money is stored; negatives are rejected', function(){
  nuevoD();
  app.aplicarInput(ALQ('1.234,5'), true);
  assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 1234.5);
  app.aplicarInput(ALQ('-5'), true);
  assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 1234.5);
  assert.equal(app.toasts.length, 1);
  app.aplicarInput(ALQ(''), true);   // empty still means 0, as before
  assert.equal(app.D.meses[app.mes].gastosFijos[0].monto, 0);
});

test('aplicarInput: crypto quantity keeps small decimals (0.001) and rejects 1,234.5', function(){
  nuevoD();
  var q = function(v){ return fakeEl(['monto', 'cant'], {'data-cripto': '0', 'data-campo': 'cantidad'}, v); };
  app.aplicarInput(q('0.001'), true);
  assert.equal(app.D.cripto[0].cantidad, 0.001);
  app.aplicarInput(q('1,234.5'), true);
  assert.equal(app.D.cripto[0].cantidad, 0.001);
  assert.equal(app.toasts.length, 1);
  var p = fakeEl(['monto', 'usd'], {'data-cripto': '0', 'data-campo': 'precioUSD'}, '1.234,56');
  app.aplicarInput(p, true);
  assert.equal(app.D.cripto[0].precioUSD, 1234.56);
});

test('aplicarInput: percent field and cotizacion by type', function(){
  nuevoD();
  var pct = function(v){ return fakeEl(['monto', 'pct'], {'data-campo': 'metaAhorroPct'}, v); };
  app.aplicarInput(pct('12,5'), true);
  assert.equal(app.D.meses[app.mes].metaAhorroPct, 0.125);
  app.aplicarInput(pct('1e2'), true);
  assert.equal(app.D.meses[app.mes].metaAhorroPct, 0.125);
  var cot = function(v){ return fakeEl(['monto'], {'data-campo': 'cotizacionUSD'}, v); };
  app.aplicarInput(cot('1.499,5'), true);
  assert.equal(app.D.cotizacionUSD, 1499.5);
  app.aplicarInput(cot('12.5,3'), true);
  assert.equal(app.D.cotizacionUSD, 1499.5);
});
