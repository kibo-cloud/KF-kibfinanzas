'use strict';
// Extracts the user-facing text of index.html, so tests can scan the words the app shows without matching code identifiers or
// comments. Method:
//  - Static markup (outside <style> and <script>): every text node and every title / aria-label / placeholder / alt value.
//  - Every executable <script> block (the JSON data block is skipped): every string literal, found with a small tokenizer that
//    skips comments (// and /* */) and regex literals, so commented words never count. Escapes (\n, á) are decoded.
//  - A literal is prose only when it contains whitespace: one-word literals ('arrastre', 'cadena', 'legacy') are keys,
//    identifiers, CSS classes or ids. Markup inside a literal is removed first (complete tags, the tail of a tag the literal
//    closes, and the head of a tag it opens), so class names, data-act values and ids are not read as words.
//  - title / aria-label / placeholder / alt values written inside literals count too, even when they are one word.
// Known limit: a one-word UI literal ('Borrar') is not scanned; the rendered-DOM walk in tests/e2e/run.mjs covers those.
// Returns [{line, text}] with `text` reduced to the words a person would read.

var fs = require('fs');
var path = require('path');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

var LINEAS = {src: null, inicios: null};
function lineAt(s, i){
  if(LINEAS.src !== s){ LINEAS.src = s; LINEAS.inicios = [0]; for(var k = 0; k < s.length; k++) if(s.charCodeAt(k) === 10) LINEAS.inicios.push(k + 1); }
  var a = LINEAS.inicios, lo = 0, hi = a.length - 1;
  while(lo < hi){ var mid = (lo + hi + 1) >> 1; if(a[mid] <= i) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

function regexAllowed(s, i){
  var j = i - 1;
  while(j >= 0 && /\s/.test(s[j])) j--;
  if(j < 0) return true;
  var p = s[j];
  if('(,=:[!&|?{};+-*%~^<>'.indexOf(p) >= 0) return true;
  if(/[A-Za-z_$]/.test(p)){
    var e = j + 1;
    while(j >= 0 && /[\w$]/.test(s[j])) j--;
    return ['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw'].indexOf(s.slice(j + 1, e)) >= 0;
  }
  return false;
}

// String literals of one script body; `base` turns an index of the body into a line of the whole source.
function literales(body, base){
  var out = [], i = 0, j, c, d;
  while(i < body.length){
    c = body[i];
    if(c === '/' && body[i + 1] === '/'){ j = body.indexOf('\n', i); i = j < 0 ? body.length : j; continue; }
    if(c === '/' && body[i + 1] === '*'){ i = body.indexOf('*/', i + 2) + 2; continue; }
    if(c === '"' || c === "'" || c === '`'){
      var v = '';
      for(j = i + 1; j < body.length; j++){
        d = body[j];
        if(d === '\\'){
          var e = body[j + 1];
          if(e === 'u'){ v += String.fromCharCode(parseInt(body.substr(j + 2, 4), 16)); j += 5; }
          else { v += e === 'n' ? '\n' : e; j++; }
          continue;
        }
        if(d === c) break;
        v += d;
      }
      out.push({at: base(i), text: v});
      i = j + 1; continue;
    }
    if(c === '/' && regexAllowed(body, i)){
      var inClass = false;
      for(j = i + 1; j < body.length; j++){
        d = body[j];
        if(d === '\\'){ j++; continue; }
        if(inClass){ if(d === ']') inClass = false; continue; }
        if(d === '[') inClass = true; else if(d === '/') break;
      }
      i = j + 1; continue;
    }
    i++;
  }
  return out;
}

function sinMarcado(t){
  return t.replace(/<[^>]*>/g, ' ')          // complete tags
          .replace(/^[^<]*?"\s*>/, ' ')       // the tail of a tag opened in a previous literal: '" data-id="x">Texto'
          .replace(/<[^>]*$/, ' ')            // the head of a tag closed in the next literal: '<span class="chip '
          .replace(/&[a-z]+;|&#\d+;/g, ' ');
}

var ATTR = /\b(title|aria-label|placeholder|alt)="([^"]*)"/g;

function textosUI(src){
  src = src === undefined ? SRC : src;
  var out = [], m, a;
  var reS = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  while((m = reS.exec(src))){
    if(/application\/json/.test(m[1])) continue;
    var off = m.index + m[0].indexOf('>') + 1;
    literales(m[2], function(i){ return off + i; }).forEach(function(l){
      var line = lineAt(src, l.at);
      if(/\s/.test(l.text)){
        var t = sinMarcado(l.text).replace(/\s+/g, ' ').trim();
        if(t) out.push({line: line, text: t});
      }
      var r = new RegExp(ATTR.source, 'g');
      while((a = r.exec(l.text))) if(/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(a[2])) out.push({line: line, text: a[2]});
    });
  }
  // static markup of the body, scripts blanked out (same length, so positions keep their lines)
  var b = src.indexOf('<body');
  if(b >= 0){
    var html = src.slice(b).replace(/<script[\s\S]*?<\/script>/g, function(x){ return x.replace(/[^\n]/g, ' '); });
    var reA = new RegExp(ATTR.source, 'g');
    while((m = reA.exec(html))) out.push({line: lineAt(src, b + m.index), text: m[2]});
    var reT = />([^<]+)</g;
    while((m = reT.exec(html))){ var t = m[1].replace(/\s+/g, ' ').trim(); if(t) out.push({line: lineAt(src, b + m.index), text: t}); }
  }
  return out;
}

// Internal words that must not reach the screen. Word-bounded and accent-aware ("Pasé" is a verb, not "pase").
var JERGA = [/\bpases?\b/i, /\bbolsillos?\b/i, /\barrastres?\b/i, /\bmodelos?\b/i, /\bcadenas?\b/i, /\bLAB\b/, /\bR[0-9](\.[0-9])?\b/, /\blegacy\b/i];
// English or programming words that must never be shown.
var INGLES = [/\bSave\b/, /\bCancel\b/, /\bDelete\b/, /\bLoading\b/, /\bError:/, /\bundefined\b/, /\bNaN\b/, /\bnull\b/];

function primero(lista, t){ for(var i = 0; i < lista.length; i++){ var m = lista[i].exec(t); if(m) return m[0]; } return null; }
function jerga(t){ return primero(JERGA, t); }
function ingles(t){ return primero(INGLES, t); }

module.exports = {textosUI: textosUI, jerga: jerga, ingles: ingles, JERGA: JERGA, INGLES: INGLES, sinMarcado: sinMarcado};
