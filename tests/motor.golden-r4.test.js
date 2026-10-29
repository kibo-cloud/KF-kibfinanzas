'use strict';
// R4.2 golden: the outputs of the NEW functions over tests/fixtures/motor-corpus-r4.js must match tests/fixtures/motor-golden-r4.json.
// The old fixture (motor-golden.json) is pinned separately by motor.golden.test.js and is never edited by R4.2.
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var corpus = require('./fixtures/motor-corpus-r4');
var api = require('./fixtures/motor-api').build();

var F = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'motor-golden-r4.json'), 'utf8'));
var obtenido = JSON.parse(corpus.canon(corpus.compute(api)));

test('r4 golden: metadata carries a reason, a base commit and a hash of the data', function(){
  assert.ok(typeof F.meta.razon === 'string' && F.meta.razon.trim().length > 5, 'meta.razon must be a non-empty reason');
  assert.match(F.meta.baseCommit, /^[0-9a-f]{7,40}$/);
  assert.equal(F.meta.hash, crypto.createHash('sha256').update(JSON.stringify(F.data)).digest('hex'), 'meta.hash must match the stored data');
});

test('r4 golden: covers the intended datasets', function(){
  assert.deepEqual(Object.keys(F.data), corpus.datasets().map(function(e){ return e.nombre; }));
  assert.ok(Object.keys(F.data).length >= 25);
});

Object.keys(F.data).forEach(function(n){
  ['estados', 'flujos', 'cadena', 'pasivos', 'patrimonioNeto'].forEach(function(campo){
    test('r4 golden ' + n + ' / ' + campo, function(){ assert.deepEqual(obtenido[n][campo], F.data[n][campo]); });
  });
});

test('r4 golden: the whole output is byte-identical to the fixture data', function(){
  assert.equal(JSON.stringify(obtenido), JSON.stringify(F.data));
});

test('both generators refuse to write without TUGASTO_GOLDEN_RAZON and leave the fixtures untouched', function(){
  var cp = require('child_process'), env = Object.assign({}, process.env); delete env.TUGASTO_GOLDEN_RAZON;
  var fx = path.join(__dirname, 'fixtures'), antes = ['motor-golden.json', 'motor-golden-r4.json'].map(function(n){ return fs.readFileSync(path.join(fx, n), 'utf8'); });
  ['generar-golden.js', 'generar-golden-r4.js'].forEach(function(g){
    var r = cp.spawnSync(process.execPath, [path.join(fx, g)], {env: env, encoding: 'utf8'});
    assert.equal(r.status, 1, g + ' must exit 1 without a reason');
    assert.match(r.stderr, /TUGASTO_GOLDEN_RAZON/);
  });
  var despues = ['motor-golden.json', 'motor-golden-r4.json'].map(function(n){ return fs.readFileSync(path.join(fx, n), 'utf8'); });
  assert.deepEqual(despues, antes);
});
