'use strict';
// The motor has no clock: its temporal functions take `hoy` as a required argument. Unit tests and
// the golden call the motor directly, and the E2E loads already-migrated data, so a page call site
// that forgets `hoy` would only throw on rare paths (e.g. the legacy migration). This static check
// reads the app script and requires every bare-name call of a temporal motor function to pass at
// least the expected number of top-level arguments.
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var TEMPORALES = {normalizar: 2, mesTope: 2, mesesCorridos: 2, estadoDeuda: 4, cargarCuotas: 4, proyeccionDeudas: 2,
                  estadoMes: 3, flujosMes: 3, cadena: 2, pasivos: 2, patrimonioNeto: 2, iniciarArrastre: 3};

function codigoApp(src){
  var a = src.indexOf('<script id="motor">'), b = src.indexOf('</script>', a);
  if(a < 0 || b < 0) throw new Error('motor block not found');
  return src.slice(b).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}
// number of top-level arguments inside the parentheses that start at `i` (just after '(')
function contarArgs(code, i){
  var d = 1, n = 0, hay = false, c;
  for(; i < code.length && d > 0; i++){
    c = code[i];
    if(c === '(' || c === '[' || c === '{') d++;
    else if(c === ')' || c === ']' || c === '}') d--;
    else if(c === ',' && d === 1) n++;
    if(d > 0 && !/\s/.test(c)) hay = true;
  }
  return hay ? n + 1 : 0;
}
function llamadasCortas(src){
  var code = codigoApp(src), malas = [];
  Object.keys(TEMPORALES).forEach(function(f){
    var re = new RegExp('(?<![.\\w$])' + f + '\\s*\\(', 'g'), m;
    while((m = re.exec(code))){
      var antes = code.slice(Math.max(0, m.index - 9), m.index);
      if(/function\s+$/.test(antes)) continue;   // a definition, not a call
      var n = contarArgs(code, m.index + m[0].length);
      if(n < TEMPORALES[f]) malas.push(f + ' with ' + n + ' args');
    }
  });
  return malas;
}

test('every app call of a temporal motor function passes hoy', function(){
  assert.deepEqual(llamadasCortas(SRC), []);
});

test('the check detects a call that forgets hoy', function(){
  var roto = SRC.replace(/normalizar\(([^,()]+), hoyApp\(\)\)/, 'normalizar($1)');
  assert.notEqual(roto, SRC, 'fixture mutation must apply');
  assert.deepEqual(llamadasCortas(roto), ['normalizar with 1 args']);
});
