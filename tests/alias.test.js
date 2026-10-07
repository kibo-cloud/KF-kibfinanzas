'use strict';
// The test harness exposes every TGMotor member as a global, so a missing alias in the app IIFE
// would never fail a unit test but would throw a ReferenceError in the real page ('use strict').
// This static check reads index.html: every motor name the app script uses by bare name must be
// aliased from TGMotor.
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function sinComentarios(s){ return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }

// returns the motor names used by the app script without an alias
function faltantes(src){
  var a = src.indexOf('<script id="motor">'), b = src.indexOf('</script>', a);
  if(a < 0 || b < 0) throw new Error('motor block not found');
  var motor = src.slice(a, b), app = sinComentarios(src.slice(b));
  var ret = motor.slice(motor.lastIndexOf('return {'));
  var nombres = Array.from(ret.matchAll(/(\w+)\s*:/g), function(m){ return m[1]; });
  var alias = new Set(Array.from(app.matchAll(/(\w+)\s*=\s*TGMotor\.(\w+)/g), function(m){ return m[1]; }));
  return nombres.filter(function(n){
    if(alias.has(n)) return false;
    return new RegExp('(?<![.\\w$])' + n + '\\b').test(app);
  });
}

test('every motor name used by the app script is aliased from TGMotor', function(){
  assert.deepEqual(faltantes(SRC), []);
});

test('the check detects a missing alias', function(){
  var roto = SRC.replace(/\n\s*calc = TGMotor\.calc,/, '\n');
  assert.notEqual(roto, SRC, 'fixture mutation must apply');
  assert.deepEqual(faltantes(roto), ['calc']);
});
