'use strict';
// L2 microcopy: the words index.html can show. The extraction method is documented in tests/ui-textos.js (string literals and
// markup text, comments and one-word identifiers excluded). The rendered-DOM side lives in tests/e2e/run.mjs ("L2 ...").
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var ui = require('./ui-textos.js');

var TEXTOS = ui.textosUI();
var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('L2 the extractor reads the app texts (sanity: it finds known screen words, from markup and from scripts)', function(){
  assert.ok(TEXTOS.length > 800, 'found ' + TEXTOS.length);
  var todo = TEXTOS.map(function(t){ return t.text; });
  ['Tenés hoy', 'Al cierre (estimado)', 'Hacer copia de seguridad', 'Lo que pasaste a lo personal', 'Sumar un gasto', 'Patrimonio']
    .forEach(function(w){ assert.ok(todo.some(function(t){ return t.indexOf(w) >= 0; }), w); });
});

test('L2 the extractor ignores comments, identifiers and markup but catches prose, attributes and escaped text', function(){
  var src = '<body><button title="Borrar el pase">x</button><script>\n'
    + '// los pases se guardan en la cadena\n/* el modelo de arrastre */\n'
    + "var a = d.arrastre, k = 'arrastre', c = '<div class=\"modelo\" data-act=\"tjPases\">' + 'Lo que pasaste' + '</div>';\n"
    + "toast('Pase borrado');\nalerta('No sab\\u00e9s', 'Lo del bolsillo');\nh += '<b aria-label=\"Cadena\">';\n</script></body>";
  var t = ui.textosUI(src), malas = t.filter(function(x){ return ui.jerga(x.text); }).map(function(x){ return x.line + ':' + x.text; });
  assert.deepEqual(malas, ['5:Pase borrado', '6:Lo del bolsillo', '7:Cadena', '1:Borrar el pase']);
  assert.ok(t.some(function(x){ return x.text === 'No sabés'; }), 'unicode escapes decoded');
  assert.ok(t.some(function(x){ return x.text === 'Lo que pasaste'; }), 'prose inside markup kept');
});

test('L2 no internal jargon in any UI string (pases, bolsillos, arrastre, modelo, cadena, LAB, R4/R5, legacy)', function(){
  var malas = TEXTOS.filter(function(t){ return ui.jerga(t.text); }).map(function(t){ return 'index.html:' + t.line + ' [' + ui.jerga(t.text) + '] ' + t.text.slice(0, 90); });
  assert.deepEqual(malas, []);
});

test('L2 no English or programming words in any UI string', function(){
  var malas = TEXTOS.filter(function(t){ return ui.ingles(t.text); }).map(function(t){ return 'index.html:' + t.line + ' [' + ui.ingles(t.text) + '] ' + t.text.slice(0, 90); });
  assert.deepEqual(malas, []);
});

test('L2 privacidad.html shows no jargon and no English UI words either', function(){
  var p = fs.readFileSync(path.join(__dirname, '..', 'privacidad.html'), 'utf8');
  var t = ui.textosUI(p).filter(function(x){ return ui.jerga(x.text) || ui.ingles(x.text); }).map(function(x){ return x.line + ':' + x.text; });
  assert.deepEqual(t, []);
});

// U5 review: the text of a call's second argument (from just after its first top-level comma, at most 600 characters), scanning from
// `desde` (just after the opening parenthesis). Strings ('', "", ``, with escapes) are skipped whole however long they are: the scan
// is not limited to a window, so a closing quote far away is found instead of restarting the scan (which looped). '' when the call
// ends before a second argument or the source ends inside a string.
function segundoArgumento(src, desde){
  var dep = 0, i, c, q;
  for(i = desde; i < src.length; i++){
    c = src[i];
    if(c === "'" || c === '"' || c === '`'){
      for(q = i + 1; q < src.length && src[q] !== c; q++) if(src[q] === '\\') q++;
      if(q >= src.length) return '';
      i = q; continue;
    }
    if(c === '(' || c === '[' || c === '{') dep++;
    else if(c === ')' || c === ']' || c === '}'){ if(dep === 0) return ''; dep--; }
    else if(c === ',' && dep === 0) return src.slice(i + 1, i + 601).trim();
  }
  return '';
}

test('U5 the confirmation scanner skips long strings, escapes and nesting, and never loops on a quote it cannot close', function(){
  var largo = 'x'.repeat(700);
  assert.equal(segundoArgumento("confirmar('" + largo + "', 'Se borra todo', 'Borrar', f)", 10).slice(0, 15), "'Se borra todo'", 'a first argument longer than 600 characters');
  assert.equal(segundoArgumento("confirmar('It\\'s, ok' + g(a, b), \"cuerpo\", 'x')", 10).slice(0, 8), '"cuerpo"', 'escaped quote, comma inside a string and inside a call');
  assert.equal(segundoArgumento('confirmar(`a, ${b}`, [1, 2], 3)', 10).slice(0, 6), '[1, 2]');
  assert.equal(segundoArgumento("confirmar('sin cerrar", 10), '', 'an unterminated string ends the scan');
  assert.equal(segundoArgumento('confirmar(solo)', 10), '', 'no second argument');
});

test('L2 every destructive confirmation states its consequence (a non-empty body after the title)', function(){
  var re = /confirmar\(/g, m, n = 0, vacias = [];
  while((m = re.exec(SRC))){
    var desde = m.index + m[0].length, resto = SRC.slice(desde, desde + 600);
    if(/^\s*[a-z]+\s*,\s*[a-z]+\s*,/i.test(resto) && SRC.slice(m.index - 9, m.index) === 'function ') continue;   // the definition
    if(/^\s*\)/.test(resto) || SRC.slice(m.index - 1, m.index) === '"' || SRC.slice(m.index - 1, m.index) === '=') continue;
    n++;
    var cuerpo = segundoArgumento(SRC, desde);
    if(!cuerpo || /^''/.test(cuerpo)) vacias.push(SRC.slice(m.index, m.index + 60));
  }
  assert.ok(n >= 9, 'found ' + n + ' confirmations');
  assert.deepEqual(vacias, []);
});

test('L2 El año: the estimated heading is not repeated on each of its rows', function(){
  var t = TEXTOS.map(function(x){ return x.text; });
  assert.ok(t.indexOf('Al cierre del año (estimado)') >= 0);
  assert.ok(t.indexOf('Disponible en diciembre') >= 0);
  assert.ok(t.indexOf('Ahorro en diciembre (con lo programado)') >= 0);
  assert.ok(t.indexOf('Disponible al cierre de diciembre (estimado)') < 0);
});
