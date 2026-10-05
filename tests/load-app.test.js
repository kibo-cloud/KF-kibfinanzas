'use strict';
// The source extractor must skip regex literals when matching braces.
var test = require('node:test');
var assert = require('node:assert/strict');
var vm = require('vm');
var la = require('./load-app');

function load(name){
  var ctx = vm.createContext({String: String, isFinite: isFinite, parseFloat: parseFloat, Math: Math});
  vm.runInContext(la.extractFunction(name), ctx);
  return ctx;
}

test('extractFunction(esc) survives the /"/g and /\'/g regex literals', function(){
  var src = la.extractFunction('esc');
  assert.ok(src.startsWith('function esc'));
  assert.ok(src.trimEnd().endsWith('}'));
  assert.equal(src.split('\n').length, 1, 'esc is a one-liner in index.html');
  var esc = load('esc').esc;
  var out = esc('<a href="x">\'&');
  assert.equal(typeof out, 'string');
  assert.ok(out.indexOf('&lt;a href=&quot;x&quot;&gt;') === 0);
  assert.ok(out.indexOf('&amp;') > 0);
});

test('grupos, the number parsers and fARS are extractable and run', function(){
  var ctx = load('grupos');
  assert.equal(ctx.grupos('1234567'), '1.234.567');
  var p = la.loadApp({funcs: ['sinSigno', 'cerosFuera', 'parseMonto']});
  assert.equal(p.parseMonto('1.234,56'), 1234.56);   // its regex literals hold braces and quantifiers
  var c = la.loadApp({funcs: ['grupos', 'fARS'], globals: {oculto: false, PUNTOS: '..'}});
  assert.equal(c.fARS(1500), '$1.500');
  assert.equal(c.fARS(-1234567), '($1.234.567)');
});

test('a regex containing braces and quotes does not break brace matching', function(){
  var real = la.extractFunction('esc');
  assert.ok(real.length > 40);
  // exercise the scanner on synthetic source through the exported helper
  var m = la.matchBrace;
  var src = 'function f(s){ var a = s.replace(/[{}"\'\/]/g, "x"); var b = /\{+/.test(s); return a + (b ? "}" : "{"); }\nfunction g(){}';
  var end = m(src, src.indexOf('{'));
  assert.equal(src.slice(0, end), src.split('\nfunction g')[0]);
  var r = 'function h(x){ return x / 2 / 4; }';
  assert.equal(m(r, r.indexOf('{')), r.length, 'division is not a regex');
  var k = 'function q(x){ return /}/.test(x) ? 1 : 0; }';
  assert.equal(m(k, k.indexOf('{')), k.length, 'regex after return keyword');
});
