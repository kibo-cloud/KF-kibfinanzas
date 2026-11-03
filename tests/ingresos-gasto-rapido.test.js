'use strict';
// 1.35.1 (feature ingresos-gasto-rapido): two user-reported screen bugs, each reproduced here (RED) before its fix.
// (1) refrescar() rewrote every `.dinfo` button with the debt text, so income rows (their `.dinfo` is the "cobro" button) showed
//     "Cuota N de M ..." after an inline edit. Only the debt plan buttons (`data-act="plan"`) carry the debt text.
// (2) gastoRapido() offered only the 12 most used categories, so variable expenses past the 12th never got a chip.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var SRC = la.SRC_FOR_TESTS;
function existe(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); }
var FUNCS = ['refrescar', 'seccion', 'notaVence', 'diaVence', 'abierta', 'fARS', 'grupos', 'esc', 'filaTope', 'textoDeuda', 'cuotaAdelantada', 'repartoTrabajo', 'esProgramado',
  'gastadoVista', 'gastadoConApartes', 'baseAparte', 'esGastoAparte', 'datosRealizados', 'pasadas', 'textoTopes', 'faltaSeccion', 'textoFalta', 'textoDelTrabajo', 'filasVer'].filter(existe);
var VARS = ['ICOSEC', 'MARCABLE', 'TOPEABLE', 'MESES', 'oculto', 'PUNTOS', 'SECS', 'verFilas'].filter(function(v){ return new RegExp('^var ' + v + '\\s*=', 'm').test(SRC); });

// A fake element for every `.dinfo` button of the rendered HTML; querySelectorAll honors `.dinfo` and `.dinfo[data-act="..."]`.
function botones(html){
  var re = /<button class="dinfo[^"]*" data-act="(\w+)" data-i="(\d+)">([\s\S]*?)<\/button>/g, m, r = [];
  while((m = re.exec(html))){
    (function(act, i, txt){
      r.push({act: act, textContent: txt, getAttribute: function(n){ return n === 'data-act' ? act : n === 'data-i' ? i : null; }});
    })(m[1], m[2], m[3]);
  }
  return r;
}
function documento(els){
  return {
    getElementById: function(){ return null; },
    querySelectorAll: function(sel){
      var m = /^\.dinfo(?:\[data-act="(\w+)"\])?$/.exec(sel);
      if(!m) return [];
      return els.filter(function(e){ return !m[1] || e.act === m[1]; });
    }
  };
}

test('refrescar keeps the income «cobro» buttons and updates only the debt plan buttons', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {
    ingresos: [C.it('Sueldo', 500000, true), C.it('Alquiler cobrado', 200000, false), C.it('Changas', 50000, false)],
    deudas: [C.it('Préstamo', 100000, false), C.it('Tarjeta', 80000, false), C.it('Moto', 60000, false)]
  });
  d.planDeudas = {'Préstamo': {total: 600000, recargo: 0, cuotas: 6, pagadasAntes: 2},
    'Tarjeta': {total: 480000, recargo: 0, cuotas: 6, pagadasAntes: 1}, 'Moto': {total: 360000, recargo: 0, cuotas: 6, pagadasAntes: 4}};
  var doc = {}, app = H.appVista(d, null, null, null, {funcs: FUNCS, vars: VARS,
    globals: {tab: 'mes', document: doc, estadoHero: function(){ return {modo: ''}; }, pintarTorta: function(){}, puntual: function(){}}});
  app.mes = 9;
  function sec(k){ return app.seccion(app.SECS.filter(function(s){ return s.k === k; })[0], app.D.meses[9]); }
  var ing = botones(sec('ingresos')), deu = botones(sec('deudas'));
  assert.equal(ing.length, 3, 'non-vacuous: one cobro button per income row');
  assert.equal(deu.length, 3, 'non-vacuous: one plan button per debt row');
  ing.forEach(function(b){ assert.equal(b.act, 'cobro'); });
  var antes = ing.map(function(b){ return b.textContent; });
  assert.doesNotMatch(antes.join('|'), /Cuota/, 'income rows start without debt text');
  deu.forEach(function(b){ b.textContent = 'viejo'; });
  Object.assign(doc, documento(ing.concat(deu)));
  app.refrescar();
  assert.deepEqual(ing.map(function(b){ return b.textContent; }), antes, 'before: income rows showed «Cuota N de M ...» after an inline edit');
  deu.forEach(function(b, i){ assert.equal(b.textContent, app.textoDeuda(app.D.meses[9].deudas[i].nombre, 9), 'the debt plan button is refreshed'); });
  assert.match(deu[0].textContent, /^Cuota \d de 6/);
});

test('gastoRapido offers a chip for every variable and fixed expense of the month, most used first (no 12-chip cap)', function(){
  var vars = ['Super', 'Verdulería', 'Farmacia', 'Nafta', 'Salidas', 'Regalos', 'Peluquería', 'Mascota'];
  var fijos = ['Alquiler', 'Luz', 'Gas', 'Internet', 'Celular', 'Gimnasio'];
  var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado');
  C.mes(d, 9, {gastosVariables: vars.map(function(n){ return C.it(n, 0, false); }), gastosFijos: fijos.map(function(n){ return C.it(n, 0, false); })});
  var hojas = [], input = {value: '', focus: function(){}, addEventListener: function(){}};
  var app = H.appVista(d, null, null, null, {funcs: ['gastoRapido', 'esc'], vars: ['gr', 'MESES'],
    globals: {tab: 'mes', irATab: function(){}, abrirHoja: function(h){ hojas.push(h); },
      document: {getElementById: function(id){ return id === 'grMonto' ? input : null; }}}});
  app.mes = 9;
  app.D.meses[9].movimientos = [{nombre: 'Mascota'}, {nombre: 'Mascota'}, {nombre: 'Gimnasio'}];   // usage counts for the order
  app.gastoRapido();
  assert.equal(hojas.length, 1);
  var chips = [], re = /<button data-act="chip" data-sec="(\w+)" data-i="(\d+)">([^<]*)<\/button>/g, m;
  while((m = re.exec(hojas[0]))) chips.push([m[3], m[1], +m[2]]);
  assert.equal(chips.length, vars.length + fijos.length, 'before: only the first 12 got a chip');
  vars.forEach(function(n, i){ assert.ok(chips.some(function(c){ return c[0] === n && c[1] === 'gastosVariables' && c[2] === i; }), n + ' has a chip'); });
  fijos.forEach(function(n, i){ assert.ok(chips.some(function(c){ return c[0] === n && c[1] === 'gastosFijos' && c[2] === i; }), n + ' has a chip'); });
  assert.deepEqual(chips.slice(0, 3).map(function(c){ return c[0]; }), ['Mascota', 'Gimnasio', 'Super'], 'most used first, then the stable order');
});
