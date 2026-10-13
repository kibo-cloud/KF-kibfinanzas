'use strict';
// Release bookkeeping (Q11: the version moves only when R5 lands): APPVER, the service-worker cache name and the LEEME changelog move
// together, and every local file the page needs is in the service-worker precache list (so the installed app opens offline).
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var RAIZ = path.join(__dirname, '..');
function leer(n){ return fs.readFileSync(path.join(RAIZ, n), 'utf8'); }
var HTML = leer('index.html'), SW = leer('sw.js'), LEEME = leer('LEEME.md');
var APPVER = /var APPVER\s*=\s*'([^']+)'/.exec(HTML)[1];

test('APPVER is the first changelog entry of LEEME.md (v1.33.0 = the L1 to L8 product surface)', function(){
  var primero = /## CHANGELOG\s+v([\d.]+) · /.exec(LEEME);
  assert.ok(primero, 'changelog entry found');
  assert.equal(primero[1], APPVER);
  assert.equal(APPVER, '1.33.0');
});

test('the service-worker cache name moved with the release (v45 was v1.32.0), keeping its prefix', function(){
  var v = /var VERSION = 'kibfinanzas-offline-v(\d+)'/.exec(SW);
  assert.ok(v, 'cache name found');
  assert.equal(+v[1], 46);
  assert.match(SW, /var PREFIJO = 'kibfinanzas-offline-';/);
});

test('every local file the page and the manifest reference is precached, and every precached file exists', function(){
  var base = JSON.parse(/var BASE = (\[[\s\S]*?\]);/.exec(SW)[1].replace(/'/g, '"'));
  base.forEach(function(f){ if(f !== './') assert.ok(fs.existsSync(path.join(RAIZ, f)), f + ' exists'); });
  var refs = [], re = /(?:href|src)="(\.?\/?[\w-]+\.(?:png|webmanifest|html|js|css|svg|ico))"/g, m;
  while((m = re.exec(HTML))) refs.push(m[1]);
  var man = JSON.parse(leer('manifest.webmanifest'));
  (man.icons || []).forEach(function(i){ refs.push(i.src); });
  assert.ok(refs.length >= 3, 'non-vacuous: ' + refs.join(', '));
  refs.forEach(function(r){
    var n = './' + r.replace(/^\.?\//, '');
    if(/^\.\/sw\.js$/.test(n)) return;   // the worker itself is never in its own cache
    assert.ok(base.indexOf(n) >= 0, n + ' is precached');
  });
});

// ── L9: the update notice says the new version once per version, only in the installed app (served by its worker) ──
var loadApp = require('./load-app').loadApp;
function versionApp(init, controlada){
  var d = Object.assign({}, init || {});
  var ls = {d: d, get length(){ return Object.keys(d).length; }, key: function(i){ var k = Object.keys(d)[i]; return k === undefined ? null : k; },
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function(k, v){ d[k] = String(v); }, removeItem: function(k){ delete d[k]; }};
  var nav = controlada === undefined ? {} : {serviceWorker: {controller: controlada ? {} : null}};
  var app = loadApp({funcs: ['versionNueva', 'aniosGuardados', 'claveMia'], vars: ['APPVER', 'PREF', 'LSVERVISTA', 'CLAVES_PROPIAS', 'LSANIO', 'LSCOPIA', 'LSOCULTO', 'LSBIENV', 'LSHIST', 'LSTRAB', 'LSVISTA', 'LSR4', 'LSAVCIERRE', 'LSDATOSDESDE', 'LSCOPIAPOS'],
    globals: {localStorage: ls, navigator: nav}});
  app.ls = ls;
  return app;
}
test('L9 update notice: a phone that used 1.32 (no version noted, years saved) sees it once; the version is noted', function(){
  var app = versionApp({'kibo.datos.2026': '{}'}, true);
  assert.equal(app.versionNueva(), true);
  assert.equal(app.ls.d['kibo.versionVista'], APPVER);
  assert.equal(app.versionNueva(), false, 'once');
});
test('L9 update notice: a noted older version shows it; the same version, a new install or a page without its worker do not', function(){
  assert.equal(versionApp({'kibo.versionVista': '1.32.0'}, true).versionNueva(), true);
  assert.equal(versionApp({'kibo.versionVista': APPVER, 'kibo.datos.2026': '{}'}, true).versionNueva(), false);
  assert.equal(versionApp({}, true).versionNueva(), false, 'a new install with nothing saved');
  var pc = versionApp({'kibo.versionVista': '1.32.0', 'kibo.datos.2026': '{}'}, false);
  assert.equal(pc.versionNueva(), false, 'not served by the worker (a plain tab, the PC file)');
  assert.equal(pc.ls.d['kibo.versionVista'], APPVER, 'noted anyway, so a later start does not announce it');
  assert.equal(versionApp({'kibo.datos.2026': '{}'}).versionNueva(), false, 'no service worker support at all');
});
test('L9 kibo.versionVista is a device key like kibo.esquema: not an own key, so no backup or rollback carries or deletes it', function(){
  var app = versionApp({});
  assert.equal(app.LSVERVISTA, 'kibo.versionVista');
  assert.equal(app.claveMia('kibo.versionVista'), false);
  assert.match(HTML, /var nuevaVersion = versionNueva\(\);[^\n]*\nif\(actualizado130 \|\| nuevaVersion\) setTimeout\(avisoActualizado, 500\);/, 'noted at every start, announced once');
});
