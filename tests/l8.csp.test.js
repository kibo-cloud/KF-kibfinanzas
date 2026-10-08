'use strict';
// L8: strict script CSP. index.html runs two inline scripts (the motor and the app); script-src lists their sha256 hashes instead of
// 'unsafe-inline', so an injected inline script or handler never runs. The JSON data block is not executable and needs no hash, which is
// why "Versión para PC" (same file, only that block replaced) keeps a matching CSP. Any edit of a script changes its hash: this test fails
// and prints the CSP to paste.
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function csp(src){ var m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(src); return m ? m[1] : null; }
function directivas(c){ var d = {}; c.split(';').forEach(function(p){ var t = p.trim().split(/\s+/); if(t[0]) d[t[0]] = t.slice(1); }); return d; }
// the hash a browser computes: over the element text after the HTML parser turned CRLF / CR into LF (so a CRLF checkout matches too)
function hashes(src){
  var re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g, m, out = [];
  while((m = re.exec(src))){
    if(/type="application\/json"/.test(m[1] || '')) continue;   // data, never executed
    out.push("'sha256-" + crypto.createHash('sha256').update(m[2].replace(/\r\n?/g, '\n'), 'utf8').digest('base64') + "'");
  }
  return out;
}

test('L8 CSP: script-src has no unsafe-inline and lists exactly the hash of every inline script of index.html', function(){
  var d = directivas(csp(HTML)), esperado = ["'self'"].concat(hashes(HTML));
  assert.equal(hashes(HTML).length, 2, 'the motor and the app');
  assert.equal(d['script-src'].indexOf("'unsafe-inline'"), -1);
  assert.deepEqual(d['script-src'], esperado, 'stale hash: set script-src to: ' + esperado.join(' '));
  assert.equal(/\son[a-z]+\s*=/i.test(HTML.replace(/<script[\s\S]*?<\/script>/g, '')), false, 'no inline event handler attribute in the markup');
});

test('L8 CSP: the check really measures (one changed character changes the hash; CRLF and LF give the same hash)', function(){
  var otra = HTML.replace('var TGMotor = (function(){', 'var TGMotor = (function(){ ');
  assert.notDeepEqual(hashes(otra), hashes(HTML));
  assert.deepEqual(hashes(HTML.replace(/\n/g, '\r\n')), hashes(HTML));
});

test('L8 CSP: "Versión para PC" keeps a matching CSP (only the non-executable data block changes)', function(){
  var M1 = '/*DATOS_' + 'INICIO*/', M2 = '/*DATOS_' + 'FIN*/', i = HTML.indexOf(M1), j = HTML.indexOf(M2);
  assert.ok(i > 0 && j > i);
  var pc = HTML.slice(0, i + M1.length) + JSON.stringify({anio: 2027, meses: [], raro: '<\\/script> */'}).replace(/</g, '\\u003c') + HTML.slice(j);
  assert.equal(csp(pc), csp(HTML));
  assert.deepEqual(hashes(pc), hashes(HTML), 'the exported file runs under the same hashes');
});
