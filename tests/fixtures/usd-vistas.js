'use strict';
// Dólares tab harness (R5 N3b): renders the REAL renderUSD (Cotización, Dólares mes a mes, Cripto, Patrimonio total) of an open year,
// with a fake localStorage and a Trabajo store. No engine or view logic lives here: only stubs for the DOM node and the clock-dependent
// date label (fechaCorta reads the local time zone; the stub keeps the bytes machine-independent).
var la = require('../load-app');
var H = require('./r45-harness');
var C = require('./r4-casos');
var base = require('./motor-corpus');

var SRC = la.SRC_FOR_TESTS;
var FUNCS = ['renderUSD', 'plegable', 'abiertaDef', 'hARS', 'hUSD', 'fARS', 'fUSD', 'grupos', 'esc', 'crudo', 'filasPatrimonio', 'htmlPatrimonio']
  .filter(function(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); });   // filasPatrimonio / htmlPatrimonio exist only after R5 N3b
var VARS = ['MESES', 'ICOSEC', 'oculto', 'PUNTOS'];

// d: raw open year; T: Trabajo store; otros: {key: value} stored in the fake localStorage
function appUSD(d, T, otros, today){
  var nodo = {innerHTML: ''};
  var g = {document: {getElementById: function(id){ return id === 'v-usd' ? nodo : null; }},
    fechaCorta: function(iso){ return 'F(' + iso + ')'; }, contar: function(){}};
  var app = H.appVista(d, T, otros, today, {funcs: FUNCS, vars: VARS, globals: g});
  app.usd = function(){ nodo.innerHTML = ''; app.renderUSD(); return nodo.innerHTML; };
  return app;
}
// the "Patrimonio total" section of the rendered tab (from its data-sec to the end of the tab)
function seccionPatrimonio(html){ var i = html.indexOf('data-sec="usdPatri"'); return i < 0 ? null : html.slice(html.lastIndexOf('<div', i)); }

// every motor-corpus dataset (no arrastre: legacy years) plus the contract section 2 data without its model fields, with Trabajo pases
// and cash (a legacy year must ignore Trabajo in Patrimonio, R4.4)
function legacy(){
  var out = base.datasets().map(function(ds){
    var raw = ds[1] && typeof ds[1] === 'object' && !Array.isArray(ds[1]) ? ds[1] : {};
    return {nombre: ds[0], d: raw};
  });
  var s2 = H.sinModelo(C.seccion2(false, false));
  s2.cripto = [{activo: 'BTC <b>', cantidad: 0.01, precioUSD: 60000}];
  out.push({nombre: 's2-sin-modelo-con-cripto', d: s2});
  var sc = H.sinModelo(C.seccion2(false, false)); sc.cotizacionUSD = 0;
  out.push({nombre: 's2-sin-modelo-sin-cotizacion', d: sc});
  return out;
}
function TRAB(){ return H.trab([{fecha: '2026-10-05', monto: 300000}, {fecha: '2026-11-05', monto: 200000}], 1000000); }

module.exports = {appUSD: appUSD, seccionPatrimonio: seccionPatrimonio, legacy: legacy, TRAB: TRAB, FUNCS: FUNCS};
