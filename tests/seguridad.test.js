'use strict';
// S1 toast escaping, S6 esc, S2 CSV formula neutralization.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

// ── S6 esc ──
test('esc escapes single quotes too (S6)', function(){
  var app = loadApp({funcs: ['esc']});
  assert.equal(app.esc("'"), '&#39;');
  assert.equal(app.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
  assert.equal(app.esc("it's"), 'it&#39;s');
});

// ── S1 toast ──
function toastApp(){
  var el = {innerHTML: '', _on: false, classList: {add: function(){ el._on = true; }, remove: function(){ el._on = false; }}};
  var app = loadApp({funcs: ['esc', 'toast'], vars: ['tToast'], globals: {
    document: {getElementById: function(id){ return id === 'toast' ? el : null; }},
    setTimeout: function(){ return 1; }, clearTimeout: function(){}
  }});
  app.el = el;
  return app;
}

test('toast escapes its text by default (S1): an invoice number cannot inject markup', function(){
  var app = toastApp();
  var numero = '<img src=x onerror=alert(1)>12';
  app.toast('Copié la factura al 04/11 con el número ' + numero, 'Deshacer', 'tjDeshacer');
  assert.ok(app.el.innerHTML.indexOf('<img') < 0, 'no raw tag in the markup: ' + app.el.innerHTML);
  assert.ok(app.el.innerHTML.indexOf('&lt;img src=x onerror=alert(1)&gt;12') > 0);
  assert.ok(app.el.innerHTML.indexOf('<button data-act="tjDeshacer"') > 0, 'the action button is still rendered');
  assert.equal(app.el._on, true);
});

test('toast escapes quotes and ampersands, and the action label', function(){
  var app = toastApp();
  app.toast('a & "b" \'c\'', '<b>x</b>', 'act', 'i"d');
  assert.equal(app.el.innerHTML, '<span>a &amp; &quot;b&quot; &#39;c&#39;</span><button data-act="act" data-id="i&quot;d">&lt;b&gt;x&lt;/b&gt;</button>');
});

test('toast without action renders only the text', function(){
  var app = toastApp();
  app.toast('Listo');
  assert.equal(app.el.innerHTML, '<span>Listo</span>');
});

// ── S2 CSV ──
test('csvTexto neutralizes spreadsheet formulas in text cells (S2)', function(){
  var app = loadApp({funcs: ['csvTexto']});
  ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '\r=1'].forEach(function(s){
    assert.equal(app.csvTexto(s)[0], "'", JSON.stringify(s));
  });
  assert.equal(app.csvTexto('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.equal(app.csvTexto('Juan'), 'Juan');
  assert.equal(app.csvTexto('a=b'), 'a=b');           // only a leading trigger matters
  assert.equal(app.csvTexto('a;b\nc'), 'a b c');      // separators and newlines still become spaces
  assert.equal(app.csvTexto(null), '');
  assert.equal(app.csvTexto(0), '0');
});

test('year CSV: numeric cells (possibly negative) are never prefixed', function(){
  var salida = null;
  var app = loadApp({funcs: ['csvTexto', 'exportarCSV', 'serieVista', 'vistaModelo'], globals: {   // a year without arrastre: serieVista is serie() itself (R4.5)
    MESES: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    descargar: function(t, n){ salida = {t: t, n: n}; }
  }});
  var meses = []; for(var i = 0; i < 12; i++) meses.push(app.mesVacio());
  meses[0].gastosFijos = [{nombre: 'Alquiler', monto: 1000, pagado: true}];   // disponible final -1000
  app.D = {anio: 2026, meses: meses, ahorroAnioAnterior: 0, usdAnioAnterior: 0, aReponerAnterior: 0, cotizacionUSD: 1000};
  app.exportarCSV();
  var filas = salida.t.replace('﻿', '').split('\r\n');
  assert.equal(filas.length, 13);
  var enero = filas[1].split(';');
  assert.equal(enero[0], 'Enero');
  assert.ok(enero.indexOf('-1000') > 0, 'the negative number stays a plain number: ' + filas[1]);
  filas.forEach(function(f){ f.split(';').forEach(function(c){ assert.ok(c.charAt(0) !== "'", 'unexpected prefix in ' + c); }); });
});

test('Trabajo CSV: user text cells are neutralized, numeric cells are not', function(){
  var salida = null;
  var T = {
    tope: 0,
    facturas: [{id: 'f1', tipo: 'factura', cliente: '=HYPERLINK("http://x")', numero: '-0012', concepto: '@cmd', fuente: '+1', periodo: '', desde: '', fecha: '2026-06-01',
                cantidad: 1, precio: 100, costo: 0, monto: 100, contado: false, plazo: 30, forma: 'transferencia'}],
    cobros: [{id: 'c1', cliente: '=2+2', monto: 50, forma: 'transferencia', fecha: '2026-06-02', aplic: [{f: 'f1', m: 50, r: 0}]}],
    gastos: [{fecha: '2026-06-03', cat: 'otros', concepto: '-cmd|calc', monto: 70, moneda: 'ARS', usd: 0, cotiz: 0}],
    pases: [], productos: []
  };
  var app = loadApp({funcs: ['csvTrabajo', 'csvTexto'], globals: {
    T: T, MESES: ['Enero'], hoyISO: function(){ return '2026-06-15'; }, fDiaLargo: function(x){ return x; },
    resumenTrab: function(){ return {cobrado: -5, gastado: 70, gastoFuturo: 0, aAcreditar: 0, pasado: 0, disponible: -20, porCobrar: 50, facturado12: 100}; },
    nombreForma: function(){ return 'Transferencia'; }, nombrePeriodo: function(){ return ''; }, largoPeriodo: function(){ return 6; },
    sumarDias: function(d){ return d; }, venceFac: function(){ return '2026-07-01'; }, saldoFac: function(){ return -7; }, ganancia: function(){ return 0; },
    nomFac: function(f){ return f.cliente; }, facPorId: function(id){ return T.facturas[0]; }, sinAsignar: function(){ return -3; },
    nombreCat: function(){ return 'Otros'; }, fechaArchivo: function(){ return '2026-06-15'; },
    descargar: function(t, n){ salida = t; }
  }});
  app.csvTrabajo();
  var lineas = salida.replace('﻿', '').split('\r\n');
  var fila = lineas.filter(function(l){ return l.indexOf('HYPERLINK') >= 0 && l.indexOf('0012') >= 0; })[0].split(';');
  assert.equal(fila[2], '\'=HYPERLINK("http://x")');
  assert.equal(fila[3], "'-0012");
  assert.equal(fila[4], "'@cmd");
  assert.equal(fila[5], "'+1");
  assert.ok(fila.indexOf('-7') > 0, 'negative saldo is a number, not prefixed: ' + fila.join('|'));
  assert.ok(lineas.some(function(l){ return l.indexOf("'=2+2") >= 0; }), 'cobro cliente neutralized');
  assert.ok(lineas.some(function(l){ return l.indexOf("'-cmd|calc") >= 0; }), 'gasto concepto neutralized');
  assert.ok(lineas.indexOf('Cobrado hasta hoy;-5') >= 0, 'negative summary number untouched');
  assert.ok(lineas.indexOf('Disponible del trabajo;-20') >= 0);
});
