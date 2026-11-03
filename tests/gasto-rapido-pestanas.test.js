'use strict';
// 1.35.2 (feature gasto-rapido-pestanas): the quick expense sheet splits its chips into two tabs, Variables and Fijos (`.seg`,
// role tablist/tab, aria-selected). Default Variables (Fijos when the month has no variables); each tab lists all its rows, most used
// this month first; switching re-renders only the chips, keeps the typed amount and the chosen medium, and clears the selected chip.
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var VARS = ['Super', 'Verdulería', 'Farmacia', 'Nafta'];
var FIJOS = ['Alquiler', 'Luz', 'Gas'];

function fakeBtn(attrs){
  var cls = {};
  return {
    attrs: attrs,
    getAttribute: function(n){ return Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null; },
    setAttribute: function(n, v){ attrs[n] = String(v); },
    classList: {toggle: function(c, on){ cls[c] = on === undefined ? !cls[c] : !!on; }, remove: function(c){ cls[c] = false; }, add: function(c){ cls[c] = true; },
      contains: function(c){ return !!cls[c]; }}
  };
}
// The tab buttons of the rendered sheet as fake elements.
function pestanas(html){
  var re = /<button data-act="grTab" data-v="(\w+)" role="tab" aria-selected="(true|false)" aria-controls="grChips"( class="on")?>([^<]*)<\/button>/g, m, r = [];
  while((m = re.exec(html))){ var b = fakeBtn({'data-v': m[1], 'aria-selected': m[2]}); if(m[3]) b.classList.add('on'); b.texto = m[4]; r.push(b); }
  return r;
}
function chips(html){
  var re = /<button data-act="chip" data-sec="(\w+)" data-i="(\d+)">([^<]*)<\/button>/g, m, r = [];
  while((m = re.exec(html))) r.push([m[3], m[1], +m[2]]);
  return r;
}

function abrir(vars, fijos, movs){
  var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado');
  C.mes(d, 9, {gastosVariables: vars.map(function(n){ return C.it(n, 0, false); }), gastosFijos: fijos.map(function(n){ return C.it(n, 0, false); })});
  var hojas = [], input = {value: '', focus: function(){}, addEventListener: function(){}};
  var dom = {grChips: {innerHTML: ''}, tabs: [], medio: [fakeBtn({'data-v': 'digital'}), fakeBtn({'data-v': 'efectivo'})]};
  var app = H.appVista(d, null, null, null, {funcs: ['gastoRapido', 'grFilas', 'grChipsHtml', 'grPestana', 'grVerPestana', 'esc'], vars: ['gr', 'MESES'],
    globals: {tab: 'mes', irATab: function(){}, abrirHoja: function(h){ hojas.push(h); dom.tabs = pestanas(h); },
      document: {
        getElementById: function(id){ return id === 'grMonto' ? input : id === 'grChips' ? dom.grChips : null; },
        querySelectorAll: function(sel){ return sel === '#grTabs button' ? dom.tabs : sel === '#grMedio button' ? dom.medio : []; }
      }}});
  app.mes = 9;
  app.D.meses[9].movimientos = movs || [];
  app.gastoRapido();
  assert.equal(hojas.length, 1);
  return {app: app, html: hojas[0], dom: dom, input: input};
}

test('the sheet opens on the Variables tab, with counts in both tab labels and only variable chips', function(){
  var s = abrir(VARS, FIJOS);
  assert.match(s.html, /<div class="seg gr-tabs" id="grTabs" role="tablist" aria-label="Tipo de gasto">/);
  assert.match(s.html, /<div class="chips" id="grChips" role="tabpanel">/);
  assert.equal(s.dom.tabs.length, 2, 'two tabs');
  assert.deepEqual(s.dom.tabs.map(function(t){ return t.texto; }), ['Variables (4)', 'Fijos (3)']);
  assert.deepEqual(s.dom.tabs.map(function(t){ return t.attrs['aria-selected']; }), ['true', 'false']);
  assert.ok(s.dom.tabs[0].classList.contains('on') && !s.dom.tabs[1].classList.contains('on'));
  var cs = chips(s.html);
  assert.deepEqual(cs, VARS.map(function(n, i){ return [n, 'gastosVariables', i]; }), 'only variables, stable order without usage');
  assert.equal(s.app.gr.sec, 'gastosVariables');
  assert.equal(s.app.gr.cat, null);
});

test('switching to Fijos re-renders only the chips with the fixed rows, most used first; amount and medium stay; the chip is cleared', function(){
  var s = abrir(VARS, FIJOS, [{nombre: 'Gas'}, {nombre: 'Gas'}, {nombre: 'Luz'}]);
  s.input.value = '1.500'; s.app.gr.monto = 1500; s.app.gr.medio = 'efectivo'; s.app.gr.cat = 2; s.app.gr.sec = 'gastosVariables';
  s.app.grVerPestana('gastosFijos');
  assert.deepEqual(chips(s.dom.grChips.innerHTML), [['Gas', 'gastosFijos', 2], ['Luz', 'gastosFijos', 1], ['Alquiler', 'gastosFijos', 0]]);
  assert.deepEqual(s.dom.tabs.map(function(t){ return t.attrs['aria-selected']; }), ['false', 'true']);
  assert.ok(!s.dom.tabs[0].classList.contains('on') && s.dom.tabs[1].classList.contains('on'));
  assert.equal(s.app.gr.cat, null, 'the selected chip is cleared');
  assert.equal(s.app.gr.monto, 1500, 'the amount stays');
  assert.equal(s.input.value, '1.500', 'the typed amount is not touched');
  assert.equal(s.app.gr.medio, 'efectivo', 'the chosen medium stays');
  s.app.grVerPestana('gastosVariables');
  assert.deepEqual(chips(s.dom.grChips.innerHTML).map(function(c){ return c[0]; }), VARS, 'back to the variables');
});

test('every variable and fixed row is reachable through its tab', function(){
  var vars = ['Super', 'Verdulería', 'Farmacia', 'Nafta', 'Salidas', 'Regalos', 'Peluquería', 'Mascota', 'Kiosco', 'Ropa', 'Libros', 'Cine', 'Taxi', 'Bar'];
  var s = abrir(vars, FIJOS);
  var todos = chips(s.html);
  s.app.grVerPestana('gastosFijos'); todos = todos.concat(chips(s.dom.grChips.innerHTML));
  vars.forEach(function(n, i){ assert.ok(todos.some(function(c){ return c[0] === n && c[1] === 'gastosVariables' && c[2] === i; }), n); });
  FIJOS.forEach(function(n, i){ assert.ok(todos.some(function(c){ return c[0] === n && c[1] === 'gastosFijos' && c[2] === i; }), n); });
  assert.equal(todos.length, vars.length + FIJOS.length);
});

test('with no variables the sheet opens on Fijos; an empty tab shows a short hint', function(){
  var s = abrir([], FIJOS);
  assert.deepEqual(s.dom.tabs.map(function(t){ return t.texto; }), ['Variables (0)', 'Fijos (3)']);
  assert.deepEqual(s.dom.tabs.map(function(t){ return t.attrs['aria-selected']; }), ['false', 'true']);
  assert.deepEqual(chips(s.html).map(function(c){ return c[1]; }), ['gastosFijos', 'gastosFijos', 'gastosFijos']);
  assert.equal(s.app.gr.sec, 'gastosFijos');
  s.app.grVerPestana('gastosVariables');
  assert.equal(chips(s.dom.grChips.innerHTML).length, 0);
  assert.match(s.dom.grChips.innerHTML, /No tenés gastos variables este mes\./);
  var f = abrir(VARS, []);
  f.app.grVerPestana('gastosFijos');
  assert.match(f.dom.grChips.innerHTML, /No tenés gastos fijos este mes\./);
});

test('user names in chips are escaped', function(){
  var s = abrir(['<b>x</b>'], []);
  assert.doesNotMatch(s.html, /<b>x<\/b>/);
  assert.match(s.html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('the click delegation routes data-act="grTab" to grVerPestana with the tab data-v', function(){
  var SRC = require('./load-app').SRC_FOR_TESTS;
  assert.match(SRC, /if\(a === 'grTab'\)\{ grVerPestana\(b\.getAttribute\('data-v'\)\); return; \}/);
});
