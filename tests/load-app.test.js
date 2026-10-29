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

test('loadMotor evaluates the <script id="motor"> block as a whole and exports the engine', function(){
  var m = la.loadMotor({today: '2026-10-04'});
  ['calc', 'serie', 'patrimonio', 'ranking', 'datosTorta', 'gastadoTope', 'estadoDeuda', 'cargarCuotas', 'hayDatos', 'normalizar', 'parseMonto', 'mesTope'].forEach(function(n){
    assert.equal(typeof m[n], 'function', n);
  });
  assert.equal(m.mesTope(2026, m.hoyDe(new Date(2026, 9, 4, 12))), 9, 'mesTope follows the explicit hoy');
  assert.equal(m.RENGLON_TRABAJO, 'Del trabajo');
});

test('the motor block is self-contained: no DOM, storage or app globals', function(){
  var code = la.MOTOR_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ['document', 'window', 'localStorage', 'navigator', 'sessionStorage', 'fetch', 'setTimeout'].forEach(function(n){
    assert.ok(!new RegExp('\\b' + n + '\\b').test(code), n + ' must not appear in the motor');
  });
  assert.ok(!/(^|[^\w.$'])(D|T|mes|tab)\.|(^|[^\w.$'])(D|T|mes|tab)\s*(\[|=[^=>])/m.test(code.replace(/'[^'\n]*'/g, "''")), 'no app state (D, T, mes, tab) in the motor');
  assert.ok(!/DATOS_/.test(la.MOTOR_SRC), 'the motor must not hold the data markers used by "Versión para PC"');
});

// harness check only: loadApp copies TGMotor members onto the context, so this cannot prove the
// real page's alias block is complete; tests/alias.test.js covers that statically.
test('the harness exposes every motor member and no app function duplicates a motor name', function(){
  var motor = la.loadMotor();
  var app = la.loadApp({funcs: ['fARS', 'grupos'], globals: {oculto: false, PUNTOS: '..'}});
  Object.keys(motor).forEach(function(n){
    assert.ok(app[n] !== undefined, n + ' missing as app global');
    var re = new RegExp('^function ' + n + '\\s*\\(', 'gm');
    assert.equal((la.SRC_FOR_TESTS.match(re) || []).length <= 1, true, n + ' is defined more than once in index.html');
  });
});
