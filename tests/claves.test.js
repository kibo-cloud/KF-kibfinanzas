'use strict';
// S3: the pre-1.30 snapshot and its restore only touch the app's own localStorage keys.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

// ── S3 own keys only ──
function fakeStorage(init){
  var d = {}; Object.keys(init || {}).forEach(function(k){ d[k] = init[k]; });
  var s = {
    d: d,
    get length(){ return Object.keys(d).length; },
    key: function(i){ return Object.keys(d)[i] === undefined ? null : Object.keys(d)[i]; },
    getItem: function(k){ return d.hasOwnProperty(k) ? d[k] : null; },
    setItem: function(k, v){ d[k] = String(v); },
    removeItem: function(k){ delete d[k]; }
  };
  return s;
}
var VARS = ['PREF', 'LSANIO', 'LSCOPIA', 'LSOCULTO', 'LSBIENV', 'LSHIST', 'LSTRAB', 'LSVISTA', 'LSESQ', 'LSR4', 'LSAVCIERRE', 'CLAVES_PROPIAS', 'LSCUAR'];
function s3App(ls, extra){
  var g = {localStorage: ls, pildora: function(){}, location: {reload: function(){ g.recargado = true; }}, confirmar: function(t, c, e, fn){ fn(); }};
  Object.keys(extra || {}).forEach(function(k){ g[k] = extra[k]; });
  var app = loadApp({funcs: ['claveMia', 'seguroActualizacion', 'respaldoPrevio', 'volverAntesDe130', 'cuarentenaAntesDeBorrar', 'revGuardada', 'claveCuarentena', 'ponerEnCuarentena'], vars: VARS, globals: g});
  app.g = g;
  return app;
}
var PROPIAS = {'kibo.datos.2026': '{"a":1}', 'kibo.datos.2025': '{"a":2}', 'kibo.anio': '2026', 'kibo.ultimaCopia': '2026-01-01', 'kibo.oculto': '0',
               'kibo.bienvenida': '1', 'kibo.historial': '[]', 'kibo.trabajo': '{"t":1}', 'kibo.vistaProd': 'compacta'};

test('claveMia knows the app keys and nothing else', function(){
  var app = s3App(fakeStorage());
  Object.keys(PROPIAS).forEach(function(k){ assert.equal(app.claveMia(k), true, k); });
  assert.equal(app.claveMia('kibo.modeloSaldos'), true, 'R4.3 marker (this phone already started the balance model)');
  assert.equal(app.claveMia('kibo.avisoCierre'), true, 'R5 device flag: dismissed start-of-month notice');
  ['kibo.otraApp', 'kibo.datos.test', 'kibo.datos.20266', 'kibo.datos.', 'otro.anio', 'kibo.respaldo.pre130', 'kibo.respaldo.pre-r4', 'kibo.esquema', '', null, undefined]
    .forEach(function(k){ assert.equal(app.claveMia(k), false, String(k)); });
});

test('pre-1.30 snapshot copies only the app keys (S3)', function(){
  var init = Object.assign({}, PROPIAS, {'kibo.otraApp': 'ajeno', 'kibo.datos.test': 'x'});
  var ls = fakeStorage(init);
  var app = s3App(ls);
  assert.equal(app.seguroActualizacion(), true);
  var r = JSON.parse(ls.d['kibo.respaldo.pre130']);
  assert.deepEqual(Object.keys(r.datos).sort(), Object.keys(PROPIAS).sort());
  assert.equal(r.datos['kibo.otraApp'], undefined);
  assert.equal(ls.d['kibo.otraApp'], 'ajeno');
  assert.equal(ls.d['kibo.esquema'], '1.30');
});

test('volverAntesDe130 deletes and restores only the app keys; a foreign kibo.* key survives (S3)', function(){
  var ls = fakeStorage(Object.assign({}, PROPIAS, {'kibo.otraApp': 'ajeno'}));
  var app = s3App(ls);
  app.seguroActualizacion();
  // later edits: change an own key, add a new own key, drop another, add a foreign key
  ls.d['kibo.datos.2026'] = '{"a":99}'; ls.d['kibo.datos.2030'] = 'nuevo'; delete ls.d['kibo.vistaProd']; ls.d['kibo.otraApp2'] = 'tambien ajeno';
  app.volverAntesDe130();
  assert.equal(app.g.recargado, true);
  assert.equal(ls.d['kibo.datos.2026'], '{"a":1}');       // restored
  assert.equal(ls.d['kibo.datos.2030'], undefined);       // own key added later is removed
  assert.equal(ls.d['kibo.vistaProd'], 'compacta');       // own key removed later is back
  assert.equal(ls.d['kibo.otraApp'], 'ajeno');            // foreign keys untouched
  assert.equal(ls.d['kibo.otraApp2'], 'tambien ajeno');
  assert.equal(ls.d['kibo.respaldo.pre130'], undefined);  // the snapshot itself is consumed, as before
});

test('restore ignores foreign keys that an older snapshot (wildcard era) may contain', function(){
  var ls = fakeStorage({'kibo.datos.2026': 'actual', 'kibo.otraApp': 'valor vivo'});
  ls.d['kibo.respaldo.pre130'] = JSON.stringify({version: 'anterior a 1.30', fecha: '2026-01-01T00:00:00.000Z',
    datos: {'kibo.datos.2026': 'viejo', 'kibo.otraApp': 'valor del respaldo', 'otro.suelto': 'x'}});
  var app = s3App(ls);
  app.volverAntesDe130();
  assert.equal(ls.d['kibo.datos.2026'], 'viejo');
  assert.equal(ls.d['kibo.otraApp'], 'valor vivo');   // not overwritten by the snapshot
  assert.equal(ls.d['otro.suelto'], undefined);       // not written
});
