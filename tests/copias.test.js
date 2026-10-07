'use strict';
// S4/E12: restoring a backup reports years that could not be written; guardar() recovers hayLS.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

function storage(rechaza){
  var d = {};
  return {d: d, setItem: function(k, v){ if(rechaza(k)) throw new Error('QuotaExceededError'); d[k] = String(v); }, getItem: function(k){ return d.hasOwnProperty(k) ? d[k] : null; }};
}
var VARS_CLAVES = ['PREF', 'LSANIO', 'LSCOPIA', 'LSOCULTO', 'LSBIENV', 'LSHIST', 'LSTRAB', 'LSVISTA', 'LSR4', 'LSAVCIERRE', 'CLAVES_PROPIAS'];
function copia(anios){ var o = {}; anios.forEach(function(a){ o[a] = {anio: a, meses: []}; }); return o; }

test('escribirAnios stores every year when storage works', function(){
  var ls = storage(function(){ return false; });
  var app = loadApp({funcs: ['escribirAnios', 'anioValido', 'claveMia', 'normalizar', 'revGuardada'], vars: VARS_CLAVES, globals: {localStorage: ls}});
  var r = app.plain(app.escribirAnios(copia([2024, 2025, 2026]), ['2024', '2025', '2026']));
  assert.deepEqual(r, {ultimo: 2026, fallaron: [], saltados: []});
  assert.deepEqual(Object.keys(ls.d).sort(), ['kibo.datos.2024', 'kibo.datos.2025', 'kibo.datos.2026']);
});

test('escribirAnios reports the years whose write failed and never counts them as restored', function(){
  var ls = storage(function(k){ return k === 'kibo.datos.2025' || k === 'kibo.datos.2026'; });
  var app = loadApp({funcs: ['escribirAnios', 'anioValido', 'claveMia', 'normalizar', 'revGuardada'], vars: VARS_CLAVES, globals: {localStorage: ls}});
  var r = app.plain(app.escribirAnios(copia([2024, 2025, 2026]), ['2024', '2025', '2026']));
  assert.deepEqual(r.fallaron, [2025, 2026]);
  assert.equal(r.ultimo, 2024);   // the last year that really got written
  assert.deepEqual(Object.keys(ls.d), ['kibo.datos.2024']);
});

test('escribirAnios: when nothing could be written there is no year to open', function(){
  var ls = storage(function(){ return true; });
  var app = loadApp({funcs: ['escribirAnios', 'anioValido', 'claveMia', 'normalizar', 'revGuardada'], vars: VARS_CLAVES, globals: {localStorage: ls}});
  var r = app.plain(app.escribirAnios(copia([2026]), ['2026']));
  assert.deepEqual(r, {ultimo: 0, fallaron: [2026], saltados: []});
});

function avisoApp(){
  var g = {toasts: [], alertas: []};
  g.toast = function(t){ g.toasts.push(t); };
  g.alerta = function(t, c){ g.alertas.push({t: t, c: c}); };
  var app = loadApp({funcs: ['avisarRestauro'], globals: g});
  app.g = g;
  return app;
}

test('avisarRestauro says "Restauré N años" only when every year was written', function(){
  var a = avisoApp();
  a.avisarRestauro(2, [], false);
  assert.deepEqual(a.g.toasts, ['Restauré 2 años']);
  assert.deepEqual(a.g.alertas, []);
  var b = avisoApp();
  b.avisarRestauro(1, [], false);
  assert.deepEqual(b.g.toasts, ['Restauré 1 año']);
});

test('avisarRestauro shows which years failed and does not claim success', function(){
  var a = avisoApp();
  a.avisarRestauro(3, [2025, 2026], false);
  assert.deepEqual(a.g.toasts, []);
  assert.equal(a.g.alertas.length, 1);
  assert.ok(a.g.alertas[0].c.indexOf('<b>2025, 2026</b>') >= 0, a.g.alertas[0].c);
  assert.ok(a.g.alertas[0].c.indexOf('Se guardó 1 año') >= 0, a.g.alertas[0].c);
  assert.ok(!/Restauré/.test(a.g.alertas[0].t + a.g.alertas[0].c));
  var b = avisoApp();
  b.avisarRestauro(1, [2026], false);
  assert.ok(b.g.alertas[0].c.indexOf('No se guardó ningún año') >= 0);
  var c = avisoApp();
  c.avisarRestauro(1, [], true);   // only the Trabajo data failed
  assert.equal(c.g.toasts.length, 0);
  assert.ok(c.g.alertas[0].c.indexOf('datos de trabajo') >= 0);
});

// ── guardar(): hayLS recovers ──
function guardarApp(ls){
  var g = {localStorage: ls, estados: [], pildoras: [], ultPild: 0, avisos: {textContent: 'Este navegador no está guardando los cambios.', innerHTML: 'x'}};
  g.estado = function(r){ g.estados.push(r); };
  g.quitarAvisoVacia = function(){};
  g.pildora = function(t, mal){ g.pildoras.push([t, !!mal]); };
  g.document = {getElementById: function(id){ return id === 'avisos' ? g.avisos : null; }};
  var app = loadApp({funcs: ['guardar', 'revGuardada', 'escribirConRev'], vars: ['PREF', 'sucio', 'arrancado', 'obsoleta'], globals: g});
  app.g = g; app.arrancado = true; app.D = {anio: 2026};
  return app;
}

test('guardar reports false when nothing was written: before start-up or with no open year (N3a review)', function(){
  var ls = storage(function(){ return false; });
  var app = guardarApp(ls);
  app.arrancado = false; app.sucio = true;
  assert.equal(app.guardar(), false, 'not started: false, never undefined (callers test !== false)');
  assert.equal(ls.getItem('kibo.datos.2026'), null, 'nothing written');
  app.arrancado = true; app.D = null;
  assert.equal(app.guardar(), false, 'no open year: false');
  app.D = {anio: 2026};
  assert.equal(app.guardar(), true, 'guard: a real save still reports true');
});

test('guardar: a failed save turns hayLS off and tells the user', function(){
  var app = guardarApp(storage(function(){ return true; }));
  app.sucio = true; app.guardar();
  assert.equal(app.hayLS, false);
  assert.deepEqual(app.g.pildoras, [['No se pudo guardar', true]]);
});

test('guardar: a later successful save sets hayLS back to true and refreshes the indicator', function(){
  var ok = false;
  var app = guardarApp(storage(function(){ return !ok; }));
  app.sucio = true; app.guardar();
  assert.equal(app.hayLS, false);
  ok = true;
  app.sucio = true; app.guardar();
  assert.equal(app.hayLS, true);
  assert.equal(app.sucio, false);
  assert.equal(app.g.estados[app.g.estados.length - 1], true);       // indicator refreshed as "just saved"
  assert.equal(app.g.avisos.innerHTML, '');                            // the "no está guardando" banner is gone
  assert.deepEqual(app.g.pildoras[app.g.pildoras.length - 1], ['Cambios guardados', false]);
});
