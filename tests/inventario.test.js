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
