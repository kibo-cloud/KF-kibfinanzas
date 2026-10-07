'use strict';
// N7 (final verification, night run): the three last fixes. Each test failed before its fix (recorded in odd/tasks/repair-sprint-1.md).
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');

// ── N7-1: a fresh "Versión para PC" file opens the year it carries, not the calendar year ──
var M1 = '/*DATOS_' + 'INICIO*/', M2 = '/*DATOS_' + 'FIN*/';
function semilla(){ var d = M.normalizar(C.vacio(2026), HOY); d.actualizado = ''; return d; }   // what the app ships: a 2026 year, never saved, nothing loaded
function exportado(anio){   // what versionPC embeds: the open year as it was saved
  var d = M.normalizar(C.vacio(anio), HOY);
  d.meses[9].ingresos = [C.it('Sueldo', 900000, true)]; d.actualizado = '2027-01-20T10:00:00.000Z'; d.rev = 4;
  return d;
}
function appCargar(ls, embebido, today){
  var avisos = {innerHTML: ''}, datos = {textContent: '\n' + M1 + JSON.stringify(embebido) + M2 + '\n'};
  var g = {localStorage: ls, arrancado: false, T: null, navigator: {},
    document: {getElementById: function(id){ return id === 'datos' ? datos : id === 'avisos' ? avisos : null; }},
    aplicarTema: function(){}, render: function(){}, avisoSinGuardado: function(){}, vioBienvenida: function(){ return true; }, bienvenida: function(){},
    avisoPrimeraVez: function(){}, revisarCopia: function(){}, avisoCuarentena: function(){}, tieneTrab: function(){ return false; }};
  var app = la.loadApp({today: today || '2026-10-15', funcs: ['cargar', 'anioActivo', 'recordarAnio', 'leerAnio', 'aniosGuardados', 'leerEmbebido', 'hayDatos',
    'revGuardada', 'revValida', 'claveCuarentena', 'ponerEnCuarentena', 'semillaExportada', 'anioValido'].filter(function(n){ return la.SRC_FOR_TESTS.indexOf('function ' + n + '(') >= 0; }),
    vars: ['PREF', 'LSANIO', 'M1', 'M2', 'LSCUAR', 'LSTRAB', 'sucio'], globals: g});
  return app;
}

test('N7-1 a fresh PC file of 2027 opens 2027 (calendar 2026), remembers it, and an edit saves under kibo.datos.2027', function(){
  var ls = H.fakeStorage({});
  var app = appCargar(ls, exportado(2027));
  app.cargar();
  assert.equal(app.D.anio, 2027, 'the embedded year, not the calendar year');
  assert.equal(app.D.meses[9].ingresos[0].monto, 900000);
  assert.equal(ls.d['kibo.anio'], '2027', 'remembered as the open year in that file\'s storage');
  // reopening the same file: the remembered year is read back (nothing stored yet), still 2027
  var otra = appCargar(ls, exportado(2027)); otra.cargar();
  assert.equal(otra.D.anio, 2027);
});

test('N7-1 a PC file whose own storage has a stale kibo.anio still opens the embedded year when nothing is stored', function(){
  var ls = H.fakeStorage({'kibo.anio': '2025'});
  var app = appCargar(ls, exportado(2027));
  app.cargar();
  assert.deepEqual([app.D.anio, ls.d['kibo.anio']], [2027, '2027']);
});

test('N7-1 the normal app is unchanged: the shipped seed takes the remembered or calendar year; stored data still wins', function(){
  var a = appCargar(H.fakeStorage({}), semilla(), '2027-03-01'); a.cargar();
  assert.equal(a.D.anio, 2027, 'calendar year with the shipped seed');
  var ls = H.fakeStorage({'kibo.anio': '2028'});
  var b = appCargar(ls, semilla()); b.cargar();
  assert.equal(b.D.anio, 2028, 'remembered year with the shipped seed');
  var ls2 = H.fakeStorage({'kibo.anio': '2026', 'kibo.datos.2026': JSON.stringify(M.normalizar(C.vacio(2026), HOY))});
  var c = appCargar(ls2, exportado(2027)); c.cargar();
  assert.equal(c.D.anio, 2026, 'a stored year always wins over the embedded one');
});
