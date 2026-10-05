'use strict';
// Loads selected top-level functions/vars from index.html (extracted by name,
// not by line number) into an isolated node:vm context.
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Returns the index just past the end of a string/comment/template/regex starting at i, or i if none starts there.
function skipLiteral(s, i){
  var c = s[i], j;
  if(c === '"' || c === "'" || c === '`'){
    for(j = i + 1; j < s.length; j++){
      if(s[j] === '\\'){ j++; continue; }
      if(s[j] === c) return j + 1;
    }
    throw new Error('unterminated string');
  }
  if(c === '/' && s[i + 1] === '/'){ j = s.indexOf('\n', i); return j < 0 ? s.length : j; }
  if(c === '/' && s[i + 1] === '*'){ j = s.indexOf('*/', i + 2); return j + 2; }
  if(c === '/' && regexAllowed(s, i)){
    var inClass = false;
    for(j = i + 1; j < s.length; j++){
      var d = s[j];
      if(d === '\\'){ j++; continue; }
      if(d === '\n') throw new Error('unterminated regex literal');
      if(inClass){ if(d === ']') inClass = false; continue; }
      if(d === '[') inClass = true;
      else if(d === '/'){
        j++;
        while(j < s.length && /[a-z]/i.test(s[j])) j++; // flags
        return j;
      }
    }
    throw new Error('unterminated regex literal');
  }
  return i;
}

var REGEX_PREV = '(,=:[!&|?{};+-*%~^<>';
var REGEX_KEYWORDS = ['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw'];

// Heuristic: a '/' at i starts a regex literal when the previous significant token is an
// operator/punctuation, one of the keywords above, or when there is none (start of input).
// Known limits: `)` `]` identifiers and numbers before '/' mean division, so `if(x) /re/.test(y)`
// and `a++ / b` are misread; comments between the token and '/' are not skipped.
function regexAllowed(s, i){
  var j = i - 1;
  while(j >= 0 && /\s/.test(s[j])) j--;
  if(j < 0) return true;
  var p = s[j];
  if(REGEX_PREV.indexOf(p) >= 0) return true;
  if(/[A-Za-z_$]/.test(p)){
    var e = j + 1;
    while(j >= 0 && /[\w$]/.test(s[j])) j--;
    return REGEX_KEYWORDS.indexOf(s.slice(j + 1, e)) >= 0;
  }
  return false;
}

// Index just past the matching close of the bracket opened at `open`.
function matchBrace(s, open){
  var depth = 0, i = open;
  while(i < s.length){
    var k = skipLiteral(s, i);
    if(k !== i){ i = k; continue; }
    var c = s[i];
    if(c === '{' || c === '(' || c === '[') depth++;
    else if(c === '}' || c === ')' || c === ']'){ depth--; if(depth === 0) return i + 1; }
    i++;
  }
  throw new Error('unbalanced braces');
}

function extractFunction(name){
  var re = new RegExp('^function ' + name + '\\s*\\(', 'm');
  var m = re.exec(SRC);
  if(!m) throw new Error('function not found: ' + name);
  var open = SRC.indexOf('{', m.index + m[0].length);
  // the parameter list holds no braces in this codebase
  return SRC.slice(m.index, matchBrace(SRC, open));
}

function extractVar(name){
  var re = new RegExp('^var ' + name + '\\s*=', 'm');
  var m = re.exec(SRC);
  if(!m) throw new Error('var not found: ' + name);
  var i = m.index + m[0].length, depth = 0;
  while(i < SRC.length){
    var k = skipLiteral(SRC, i);
    if(k !== i){ i = k; continue; }
    var c = SRC[i];
    if(c === '{' || c === '(' || c === '[') depth++;
    else if(c === '}' || c === ')' || c === ']') depth--;
    else if(c === ';' && depth === 0) return SRC.slice(m.index, i + 1);
    i++;
  }
  throw new Error('unterminated var: ' + name);
}

var DEFAULT_FUNCS = ['num', 'mesVacio', 'normalizar', 'suma', 'calc', 'serie', 'mesTope', 'estaPagado', 'sumaPagado', 'esRenglonTrabajo', 'clave', 'alternarPago', 'sumarAItem'];
var DEFAULT_VARS = ['SECS', 'MARCABLE', 'RENGLON_TRABAJO'];

// opts: {today:'YYYY-MM-DD', funcs:[...extra], vars:[...extra], globals:{name:value} injected before the code runs}
function loadApp(opts){
  opts = opts || {};
  var today = new Date((opts.today || '2026-06-15') + 'T12:00:00');
  var RealDate = Date;
  var FakeDate = class extends RealDate {
    constructor(){ var a = Array.prototype.slice.call(arguments); if(a.length === 0) super(today.getTime()); else super(...a); }
    static now(){ return today.getTime(); }
  };
  var ctx = vm.createContext({Date: FakeDate, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, isFinite: isFinite, parseFloat: parseFloat});
  Object.keys(opts.globals || {}).forEach(function(k){ ctx[k] = opts.globals[k]; });
  var funcs = DEFAULT_FUNCS.concat(opts.funcs || []);
  var vars = DEFAULT_VARS.concat(opts.vars || []);
  var code = 'var D = null, mes = ' + today.getMonth() + ';\n';
  vars.forEach(function(v){ code += extractVar(v) + '\n'; });
  funcs.forEach(function(f){ code += extractFunction(f) + '\n'; });
  vm.runInContext(code, ctx);
  // vm arrays/objects belong to another realm: round-trip through JSON for deepStrictEqual
  ctx.plain = function(x){ return JSON.parse(JSON.stringify(x)); };
  return ctx;
}

module.exports = {loadApp: loadApp, matchBrace: matchBrace, extractFunction: extractFunction, extractVar: extractVar};
