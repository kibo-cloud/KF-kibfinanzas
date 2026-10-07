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

test('APPVER is the first changelog entry of LEEME.md (v1.32.0 = R4 + R5)', function(){
  var primero = /## CHANGELOG\s+v([\d.]+) · /.exec(LEEME);
  assert.ok(primero, 'changelog entry found');
  assert.equal(primero[1], APPVER);
  assert.equal(APPVER, '1.32.0');
});

test('the service-worker cache name moved with the release (v44 was v1.31.4)', function(){
  var v = /var VERSION = 'kibfinanzas-offline-v(\d+)'/.exec(SW);
  assert.ok(v, 'cache name found');
  assert.equal(+v[1], 45);
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
