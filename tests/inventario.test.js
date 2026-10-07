'use strict';
// D13 guard: the set of functions that consume money amounts must equal the documented inventory.
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var la = require('./load-app');
var data = require('./inventario.data');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var CONSUMER = /\.monto\b|\b(suma|sumaPagado|calc|serie)\s*\(/;
// where the app script starts: `<script>` then `(function(){` on the next line, whatever the line ending of the checkout (LF or CRLF)
function inicioApp(src){ return src.search(/<script>\r?\n\(function\(\)\{/); }

function scan(){
  var re = /^function (\w+)\s*\(/gm, m, found = [];
  while((m = re.exec(SRC))){
    var body = la.extractFunction(m[1]).replace(/^function \w+/, '');
    if(CONSUMER.test(body)) found.push(m[1]);
  }
  return found.sort();
}

test('every inventory entry has a valid semantic and a reason', function(){
  Object.keys(data.INVENTORY).forEach(function(n){
    var e = data.INVENTORY[n];
    assert.ok(data.SEMANTICS.indexOf(e[0]) >= 0, n + ': semantic must be one of ' + data.SEMANTICS.join('|'));
    assert.ok(typeof e[1] === 'string' && e[1].length > 5, n + ': needs a one-line reason');
  });
});

test('money consumers in index.html match the documented inventory', function(){
  var found = scan(), known = Object.keys(data.INVENTORY).sort();
  var nuevas = found.filter(function(n){ return known.indexOf(n) < 0; });
  var quitadas = known.filter(function(n){ return found.indexOf(n) < 0; });
  assert.deepEqual(nuevas, [], 'New function(s) read monto/suma/calc/serie: classify them in tests/inventario.data.js ' +
    '(registrado|realizado|mixto|otro + reason) and in the feature doc: ' + nuevas.join(', '));
  assert.deepEqual(quitadas, [], 'Function(s) no longer consume money (removed, renamed or rewritten): update tests/inventario.data.js: ' + quitadas.join(', '));
});

test('the scan covers both inline blocks: the engine (<script id="motor">) and the app script', function(){
  var found = scan();
  var motorAt = SRC.indexOf('<script id="motor">'), appAt = inicioApp(SRC);
  assert.ok(motorAt > 0 && appAt > motorAt, 'motor block precedes the app script');
  ['calc', 'serie', 'suma', 'sumaPagado', 'ranking', 'gastadoTope', 'hayDatos'].forEach(function(n){
    var at = SRC.search(new RegExp('^function ' + n + '\\s*\\(', 'm'));
    assert.ok(at > motorAt && at < appAt, n + ' is defined in the motor block');
    assert.ok(found.indexOf(n) >= 0, n + ' is scanned');
  });
  ['renderMes', 'seccion', 'serieVista'].forEach(function(n){
    var at = SRC.search(new RegExp('^function ' + n + '\\s*\\(', 'm'));
    assert.ok(at > appAt, n + ' stays in the app script');
    assert.ok(found.indexOf(n) >= 0, n + ' is scanned');
  });
});

test('the app script start is found with LF and with CRLF line endings (native review follow-up, night range T3)', function(){
  var lf = SRC.replace(/\r\n/g, '\n'), crlf = lf.replace(/\n/g, '\r\n');
  [lf, crlf].forEach(function(src, i){
    var motorAt = src.indexOf('<script id="motor">'), appAt = inicioApp(src), nombre = i ? 'CRLF' : 'LF';
    assert.ok(motorAt > 0 && appAt > motorAt, nombre + ': motor block precedes the app script');
    assert.ok(src.slice(appAt).search(/^function renderMes\s*\(/m) > 0, nombre + ': the app functions follow it');
  });
});

// R4.6: one semantic source per concept; the owner lives in the motor block and the feature doc table says the same
test('every model concept has exactly one owner in the motor, and the feature doc table "Semantic sources (R4.6)" matches', function(){
  var motorAt = SRC.indexOf('<script id="motor">'), appAt = inicioApp(SRC);
  var doc = fs.readFileSync(path.join(__dirname, '..', 'odd', 'tasks', 'repair-sprint-1.md'), 'utf8');
  var at0 = doc.indexOf('Semantic sources (R4.6)');
  assert.ok(at0 > 0, 'the table exists in the feature doc');
  var tabla = doc.slice(at0);
  var conceptos = Object.keys(data.SOURCES);
  assert.equal(conceptos.length, 11);
  conceptos.forEach(function(c){
    var f = data.SOURCES[c][0], at = SRC.search(new RegExp('^function ' + f + '\\s*\\(', 'm'));
    assert.ok(at > motorAt && at < appAt, c + ': owner ' + f + ' is a motor function');
    assert.ok(tabla.indexOf('| ' + c + ' | `' + f + '`') >= 0, c + ': doc row names ' + f);
  });
});
