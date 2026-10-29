'use strict';
// L7 accessibility, static side: the color roles of the P3a tokens are readable (WCAG AA: 4.5:1 for text) in light and dark,
// the forced themes (data-tema claro/oscuro) repeat exactly the values of the system themes, and the page declares what a screen
// reader and a keyboard need (lang, dialog, tabs, live regions, focus ring, reduced motion). The rendered behavior is in tests/e2e/run.mjs.
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var CSS = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));

// every token block, in source order: plain :root (light), :root inside the dark media query, and the two forced themes
function bloques(){
  var re = /(@media \(prefers-color-scheme: dark\)\{\s*)?(:root|html\[data-tema="(claro|oscuro)"\])\{([^}]*)\}/g, m, out = [];
  while((m = re.exec(CSS))){
    var decl = {}, d = /--([\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g, x;
    while((x = d.exec(m[4]))) decl[x[1]] = x[2].trim();
    out.push({tipo: m[3] || (m[1] ? 'dark' : 'light'), decl: decl});
  }
  return out;
}
function temas(){
  var b = bloques(), light = {}, dark = {}, claro = {}, oscuro = {};
  b.forEach(function(x){ if(x.tipo === 'light') Object.assign(light, x.decl); });
  Object.assign(dark, light);
  b.forEach(function(x){ if(x.tipo === 'dark') Object.assign(dark, x.decl); });
  b.forEach(function(x){ if(x.tipo === 'claro') Object.assign(claro, x.decl); if(x.tipo === 'oscuro') Object.assign(oscuro, x.decl); });
  return {light: light, dark: dark, claro: claro, oscuro: oscuro};
}
function valor(t, k, n){
  var v = t[k]; n = n || 0;
  assert.ok(v !== undefined, 'token --' + k + ' is defined');
  var m = /^var\(--([\w-]+)\)$/.exec(v);
  return m && n < 10 ? valor(t, m[1], n + 1) : v;
}
function color(s){
  var m = /^#([0-9a-f]{6})$/i.exec(s);
  if(m) return [0, 2, 4].map(function(i){ return parseInt(m[1].substr(i, 2), 16); }).concat(1);
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if(m){ var p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('not a color: ' + s);
}
function sobre(c, base){ return [0, 1, 2].map(function(i){ return c[i] * c[3] + base[i] * (1 - c[3]); }).concat(1); }
function lum(c){
  var v = c.slice(0, 3).map(function(x){ x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
// a failed match names the pattern only (the page is 400 kB)
function tiene(s, re){ assert.ok(re.test(s), 'missing: ' + re); }
function contraste(a, b){ var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// text roles: the P3a state colors plus the base text, secondary text, accent (realizado), problem and the digital-money blue
var ROLES = ['txt', 'txt2', 'acc', 'neg', 'dig', 'c-real', 'c-pend', 'c-atras', 'c-prog', 'c-proy', 'c-deuda', 'c-trab', 'c-prob'];
// state chips: the role text on its own soft background, which sits on a card
var CHIPS = [['c-real', 'c-real-bg'], ['c-pend', 'c-pend-bg'], ['c-atras', 'c-atras-bg'], ['c-prog', 'c-prog-bg'], ['c-trab', 'c-trab-bg']];

function fallas(t){
  var out = [], card = color(valor(t, 'card')), bg = color(valor(t, 'bg')), card2 = color(valor(t, 'card2'));
  ROLES.forEach(function(r){
    var c = color(valor(t, r));
    [['card', card], ['bg', bg], ['card2', card2]].forEach(function(f){
      var k = contraste(c, f[1]); if(k < 4.5) out.push(r + ' on ' + f[0] + ' ' + k.toFixed(2));
    });
  });
  CHIPS.forEach(function(p){
    var k = contraste(color(valor(t, p[0])), sobre(color(valor(t, p[1])), card));
    if(k < 4.5) out.push(p[0] + ' on ' + p[1] + ' ' + k.toFixed(2));
  });
  return out;
}

test('L7 contrast: every text role reaches 4.5:1 on cards and on the page, light theme', function(){
  assert.deepEqual(fallas(temas().light), []);
});
test('L7 contrast: every text role reaches 4.5:1 on cards and on the page, dark theme', function(){
  assert.deepEqual(fallas(temas().dark), []);
});
test('L7 contrast: the text on a green button (Guardar, Gasto, the selected month) reaches 4.5:1 in both themes', function(){
  var T = temas();
  ['light', 'dark'].forEach(function(k){
    var c = contraste(color(valor(T[k], 'on-acc')), color(valor(T[k], 'acc')));
    assert.ok(c >= 4.5, k + ' ' + c.toFixed(2));
  });
  // white on the dark theme's light green was 2.3:1: every green fill uses --on-acc for its text
  assert.equal(/background:var\(--acc\);color:#fff/.test(CSS), false);
});
// L7 review: the destructive sheet button (text on --neg) and the neutral chip (12 px text on --fill) reach 4.5:1 in both themes
test('L7 contrast: the red "Borrar" button and the neutral chip reach 4.5:1 in both themes', function(){
  var T = temas(), out = [];
  ['light', 'dark'].forEach(function(k){
    var card = color(valor(T[k], 'card'));
    [['on-neg', 'neg'], ['on-fill', 'fill']].forEach(function(p){
      var c = contraste(color(valor(T[k], p[0])), sobre(color(valor(T[k], p[1])), card));
      if(c < 4.5) out.push(k + ' ' + p[0] + ' on ' + p[1] + ' ' + c.toFixed(2));
    });
  });
  assert.deepEqual(out, []);
  tiene(CSS, /\.hoja \.fila button\.pri\.mal\{background:var\(--neg\);color:var\(--on-neg\)\}/);
  tiene(CSS, /\.chip\{[^}]*background:var\(--fill\);color:var\(--on-fill\)/);
});
test('L7 the forced themes repeat the system themes value by value (Ajustes > Tema shows the same colors)', function(){
  var T = temas(), dif = [];
  Object.keys(T.claro).forEach(function(k){ if(T.claro[k] !== T.light[k]) dif.push('claro --' + k + ' ' + T.claro[k] + ' != ' + T.light[k]); });
  Object.keys(T.oscuro).forEach(function(k){ if(T.oscuro[k] !== T.dark[k]) dif.push('oscuro --' + k + ' ' + T.oscuro[k] + ' != ' + T.dark[k]); });
  assert.deepEqual(dif, []);
  assert.ok(Object.keys(T.claro).length >= 20 && Object.keys(T.oscuro).length >= 20);
});
test('L7 the contrast check really measures: the old light secondary gray (#8a8a8e) fails on the page background', function(){
  assert.ok(contraste(color('#8a8a8e'), color('#f2f2f7')) < 4.5);
  assert.ok(Math.abs(contraste([0, 0, 0, 1], [255, 255, 255, 1]) - 21) < 1e-9);
});

test('L7 markup: language, dialog, tabs, live regions', function(){
  tiene(HTML, /<html lang="es-AR">/);
  tiene(HTML, /<div class="hoja" id="hoja" role="dialog" aria-modal="true"[^>]*>/);
  tiene(HTML, /<div class="toast" id="toast" role="status" aria-live="polite"><\/div>/);
  tiene(HTML, /<div class="pild" id="pild" role="status" aria-live="polite"><\/div>/);
  var nav = /<nav id="nav"[^>]*>([\s\S]*?)<\/nav>/.exec(HTML);
  assert.ok(nav, 'nav');
  // L7 review: the buttons sit in the order they are seen (Gasto third, also for Tab); the tablist gathers the five tabs with aria-owns
  var lista = /<div[^>]*role="tablist"[^>]*aria-owns="([^"]+)"[^>]*><\/div>/.exec(nav[1]);
  assert.ok(lista, 'a tablist inside the tab bar that owns the tabs');
  assert.deepEqual(lista[1].split(' '), ['tab-mes', 'tab-anio', 'tab-usd', 'tab-trabajo', 'tab-ajustes']);
  var botones = nav[1].match(/<button[^>]*>/g);
  assert.deepEqual(botones.map(function(b){ return (/data-t="(\w+)"/.exec(b) || [0, 'gasto'])[1]; }), ['mes', 'anio', 'gasto', 'usd', 'trabajo', 'ajustes'], 'document order = visual order');
  assert.equal(/order:\d/.test(/\.tabs\{display:contents\}[^\n]*\n[^\n]*/.exec(CSS)[0]), false, 'no CSS order reshuffles the bar');
  var tabs = botones.filter(function(b){ return /role="tab"/.test(b); });
  tabs.forEach(function(b){
    var t = /data-t="(\w+)"/.exec(b)[1];
    assert.match(b, /role="tab"/); assert.match(b, /aria-selected="(true|false)"/);
    assert.match(b, new RegExp('aria-controls="v-' + t + '"'));
    tiene(HTML, new RegExp('<section class="vista[^"]*" id="v-' + t + '" role="tabpanel" aria-labelledby="tab-' + t + '"'));
  });
  // the Gasto action is a plain button of the tab bar, outside the tablist (it is an action, not a tab)
  tiene(nav[1], /<button class="nav-gasto" id="fab" data-act="gastoRapido" aria-label="Sumar un gasto">/);
  assert.equal(tabs.length, 5);
  assert.ok(lista[1].indexOf('fab') < 0, 'Gasto is not owned by the tablist');
});
test('L7 CSS: a visible keyboard focus ring, reduced motion, a desktop layout from 1024 px', function(){
  tiene(CSS, /:focus-visible\{outline:2px solid/);
  tiene(CSS, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}/);
  tiene(CSS, /@media screen and \(min-width:1024px\)\{/);   // screen only: printing keeps the single column
});
