'use strict';
// Loads selected top-level functions/vars from index.html (extracted by name,
// not by line number) into an isolated node:vm context.
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// The financial engine lives in its own inline block (<script id="motor">, global TGMotor). Its functions sit at column 0 like the
// app's, so extractFunction/extractVar find them in SRC too; loadApp/loadMotor evaluate the block itself, as a whole.
var MOTOR_RE = /<script id="motor">([\s\S]*?)<\/script>/;
var MOTOR_SRC = (MOTOR_RE.exec(SRC) || [])[1];
if(!MOTOR_SRC) throw new Error('<script id="motor"> block not found in index.html');

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


// Everything the engine owns comes from the motor block (see loadApp); only app-level names are extracted by name.
var DEFAULT_FUNCS = [];
var DEFAULT_VARS = [];

function newContext(opts){
  var today = new Date((opts.today || '2026-06-15') + 'T12:00:00');
  var RealDate = Date;
  var FakeDate = class extends RealDate {
    constructor(){ var a = Array.prototype.slice.call(arguments); if(a.length === 0) super(today.getTime()); else super(...a); }
    static now(){ return today.getTime(); }
  };
  var ctx = vm.createContext({Date: FakeDate, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, isFinite: isFinite, parseFloat: parseFloat});
  return {ctx: ctx, today: today};
}

// The motor evaluated as a whole in a bare context (no DOM, no storage, no app globals): real unit loading, no regex extraction.
// The engine never reads the clock (R4.1), so by default Date is POISONED here: any leak throws. Pass {today} to install a fake
// system clock instead (the determinism test does, to prove the clock is ignored).
function loadMotor(opts){
  opts = opts || {};
  var c = newContext(opts);
  if(!opts.today){
    c.ctx.Date = class { constructor(){ throw new Error('the motor must not read the system clock'); } static now(){ throw new Error('the motor must not read the system clock'); } };
  }
  vm.runInContext(MOTOR_SRC, c.ctx);
  return c.ctx.TGMotor;
}

// opts: {today:'YYYY-MM-DD', funcs:[...extra], vars:[...extra], globals:{name:value} injected before the code runs}
// The motor block is evaluated first and every TGMotor member becomes a context global, so extracted app functions keep
// resolving calc, serie, suma... by name. Names the motor provides are never extracted again from the app.
function loadApp(opts){
  opts = opts || {};
  var c = newContext(opts), ctx = c.ctx, today = c.today;
  vm.runInContext(MOTOR_SRC, ctx);
  var motor = ctx.TGMotor;
  Object.keys(motor).forEach(function(k){ ctx[k] = motor[k]; });
  Object.keys(opts.globals || {}).forEach(function(k){ ctx[k] = opts.globals[k]; });
  var propios = function(n){ return !Object.prototype.hasOwnProperty.call(motor, n); };
  var funcs = DEFAULT_FUNCS.concat(opts.funcs || []).filter(propios);
  var vars = DEFAULT_VARS.concat(opts.vars || []).filter(propios);
  var code = 'var D = null, mes = ' + today.getMonth() + ';\n';
  vars.forEach(function(v){ code += extractVar(v) + '\n'; });
  funcs.forEach(function(f){ code += extractFunction(f) + '\n'; });
  vm.runInContext(code, ctx);
  // vm arrays/objects belong to another realm: round-trip through JSON for deepStrictEqual
  ctx.hoyApp = function(){ return motor.hoyDe(new ctx.Date()); };   // the app helper (extracted app functions call it): reads the fake system clock, like the real app
  ctx.hoy = motor.hoyDe(today);   // the explicit `hoy` of this context's fake today, for tests that call temporal engine functions
  ctx.plain = function(x){ return JSON.parse(JSON.stringify(x)); };
  return ctx;
}

module.exports = {loadApp: loadApp, loadMotor: loadMotor, MOTOR_SRC: MOTOR_SRC, SRC_FOR_TESTS: SRC, matchBrace: matchBrace, extractFunction: extractFunction, extractVar: extractVar};
