'use strict';
// Year views harness (R4.5, owner decision 2026-10-06): renders the REAL "El año" tab (renderAnio, incl. "Los doce meses" and
// "Año por año") and the REAL year CSV (exportarCSV) of a year, with a fake localStorage holding the other stored years.
// No engine or view logic lives here: only stubs for the DOM node, the download and storage.
var la = require('../load-app');
var H = require('./r45-harness');
var C = require('./r4-casos');
var base = require('./motor-corpus');

var SRC = la.SRC_FOR_TESTS;
var FUNCS = ['renderAnio', 'resumenAnio', 'mesesCargados', 'anillo', 'plegable', 'abiertaDef', 'hARS', 'fARS', 'hUSD', 'fUSD', 'grupos', 'esc',
  'lineas', 'barras', 'corto', 'aniosGuardados', 'leerAnio', 'exportarCSV', 'csvTexto',
  'dos', 'ctxModelo', 'cierreAnioAnterior', 'vistaModelo', 'tilesMes', 'mesDelModelo', 'serieVista', 'mesesTranscurridos', 'mesEnRojo', 'datosRealizados']
  .filter(function(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); });   // serieVista exists only after the change
var VARS = ['PREF', 'MESES', 'CORTOS', 'oculto', 'PUNTOS', 'ICOSEC'];

// d: raw open year; otros: {anio: raw blob} stored years; T: Trabajo store
function appAnio(d, otros, T, today){
  var ls = {}, nodo = {innerHTML: ''}, csv = [];
  Object.keys(otros || {}).forEach(function(a){ ls['kibo.datos.' + a] = JSON.stringify(otros[a]); });
  var g = {localStorage: H.fakeStorage(ls), document: {getElementById: function(id){ return id === 'v-anio' ? nodo : null; }},
    descargar: function(t){ csv.push(t); }};
  var app = la.loadApp({today: today || '2026-10-15', funcs: FUNCS, vars: VARS, globals: g});
  app.T = T || C.copy(H.TRAB_VACIO);
  app.D = app.normalizar(C.copy(d), app.hoy);
  app.anio = function(){ nodo.innerHTML = ''; app.renderAnio(); return nodo.innerHTML; };
  app.csv = function(){ csv.length = 0; app.exportarCSV(); return csv[0]; };
  return app;
}

// "Los doce meses" rows of the rendered HTML: [[Mes, Ingresos, ..., Acumulado] x 12, Total]; "Año por año" rows: [[Año, ...]]
function celdas(tr){ return (tr.match(/<td>([\s\S]*?)<\/td>/g) || []).map(function(td){ return td.replace(/<[^>]+>/g, ''); }); }
function tabla(html, k){
  var i = html.indexOf('data-sec="' + k + '"'); if(i < 0) return null;
  var t = html.slice(i, html.indexOf('</table>', i)), filas = t.split('<tr').slice(1);
  return filas.map(celdas).filter(function(r){ return r.length; });
}
function csvFilas(txt){ return txt.replace(/^﻿/, '').split('\r\n').map(function(l){ return l.split(';'); }); }

// every motor-corpus dataset as an open year, with the other corpus years stored (so "Año por año" renders)
function corpus(){
  var all = base.datasets(), con = all.filter(function(ds){ return ds[1] && typeof ds[1] === 'object' && Array.isArray(ds[1].meses); });
  return all.map(function(ds){
    var raw = ds[1] && typeof ds[1] === 'object' && !Array.isArray(ds[1]) ? ds[1] : {}, otros = {};
    con.forEach(function(o){ if(o[0] !== ds[0] && o[1].anio !== (raw.anio || 2026)) otros[o[1].anio] = o[1]; });
    return {nombre: ds[0], d: raw, otros: otros};
  });
}

// a realized and a future Trabajo pase: a legacy year must ignore both (they matter only to a model year, Q4)
function TRAB_PASES(){ return H.trab([{fecha: '2026-10-05', monto: 300000}, {fecha: '2026-11-05', monto: 200000}]); }

module.exports = {appAnio: appAnio, tabla: tabla, csvFilas: csvFilas, corpus: corpus, TRAB_PASES: TRAB_PASES, FUNCS: FUNCS};
