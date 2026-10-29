'use strict';
// D7 (owner-decisions-closure), N4-B (b): the quarantine copies (kibo.cuarentena.*) are listed in Ajustes → Dónde viven tus datos.
// Each one can be downloaded (D6 descargarCuarentena) or deleted, and deleting happens only after the user confirms. Nothing is ever
// deleted automatically, and only kibo.cuarentena.* keys can be deleted by this feature.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var H = require('./fixtures/r45-harness');

function appCuar(store){
  var ls = H.fakeStorage(store), pedidos = [], toasts = [], render = [], nombres = {};
  var a = la.loadApp({today: '2026-10-15', funcs: ['clavesCuarentena', 'nombreCuarentena', 'pesoCuarentena', 'pedirBorrarCuarentena', 'borrarCuarentena', 'revGuardada', 'revValida'],
    vars: ['LSCUAR', 'LSTRAB', 'LSDIARIO', 'PREF'],
    globals: {localStorage: ls, tab: 'ajustes',
      document: {getElementById: function(id){ return id === 'cuarBorrarNom' ? (nombres[id] = {textContent: ''}) : null; }},
      confirmar: function(t, cuerpo, etiqueta, accion){ pedidos.push({t: t, cuerpo: cuerpo, etiqueta: etiqueta, accion: accion}); },
      toast: function(t){ toasts.push(t); }, renderAjustes: function(){ render.push(1); }}});
  a.ls = ls; a.pedidos = pedidos; a.toasts = toasts; a.render = render; a.nombres = nombres;
  return a;
}

test('D7 N4-B every quarantine key is listed, sorted, and nothing else', function(){
  var a = appCuar({'kibo.cuarentena.trabajo': 't', 'kibo.datos.2026': '{}', 'kibo.cuarentena.2026.2': 'b', 'kibo.cuarentena.2026': 'a', 'kibo.trabajo': '{}', 'kibo.cuarentena.diario': 'd'});
  assert.deepEqual(a.plain(a.clavesCuarentena()), ['kibo.cuarentena.2026', 'kibo.cuarentena.2026.2', 'kibo.cuarentena.diario', 'kibo.cuarentena.trabajo']);
  assert.deepEqual(a.plain(appCuar({'kibo.datos.2026': '{}'}).clavesCuarentena()), [], 'no copies: empty list');
});

test('D7 N4-B each copy has a readable name and size', function(){
  var a = appCuar({});
  assert.equal(a.nombreCuarentena('kibo.cuarentena.2026'), 'Datos de 2026');
  assert.equal(a.nombreCuarentena('kibo.cuarentena.2026.3'), 'Datos de 2026 · copia 3');
  assert.equal(a.nombreCuarentena('kibo.cuarentena.trabajo'), 'Trabajo');
  assert.equal(a.nombreCuarentena('kibo.cuarentena.trabajo.2'), 'Trabajo · copia 2');
  assert.equal(a.nombreCuarentena('kibo.cuarentena.diario'), 'Diario');
  assert.equal(a.nombreCuarentena('kibo.cuarentena.<raro>'), '<raro>', 'anything else: the key as is (painted with textContent)');
  assert.equal(a.pesoCuarentena('abc'), 'Menos de 1 KB');
  assert.equal(a.pesoCuarentena(new Array(3073).join('x')), '3 KB');
});

test('D7 N4-B deleting asks first; cancel keeps the copy, confirm deletes only that copy', function(){
  var a = appCuar({'kibo.cuarentena.2026': 'a', 'kibo.cuarentena.2026.2': 'b', 'kibo.datos.2026': '{}'});
  assert.equal(a.pedirBorrarCuarentena('kibo.cuarentena.2026'), true);
  assert.equal(a.ls.d['kibo.cuarentena.2026'], 'a', 'asking deletes nothing (cancel = the action is never run)');
  assert.equal(a.pedidos.length, 1);
  assert.equal(a.pedidos[0].etiqueta, 'Borrar');
  assert.match(a.pedidos[0].cuerpo, /<b id="cuarBorrarNom"><\/b>/, 'the name goes in by textContent, not in the HTML');
  assert.equal(a.nombres.cuarBorrarNom.textContent, 'Datos de 2026');
  a.pedidos[0].accion();
  assert.equal('kibo.cuarentena.2026' in a.ls.d, false);
  assert.equal(a.ls.d['kibo.cuarentena.2026.2'], 'b', 'the other copy stays');
  assert.equal(a.ls.d['kibo.datos.2026'], '{}');
  assert.deepEqual(a.toasts, ['Texto apartado borrado']);
  assert.equal(a.render.length, 1, 'Ajustes is painted again');
});

test('D7 N4-B only kibo.cuarentena.* keys can ever be deleted; a missing copy is said', function(){
  var a = appCuar({'kibo.datos.2026': '{}', 'kibo.trabajo': '{}', 'kibo.cuarentenaX': 'x'});
  ['kibo.datos.2026', 'kibo.trabajo', 'kibo.cuarentenaX', ''].forEach(function(k){
    assert.equal(a.pedirBorrarCuarentena(k), false, k);
    assert.equal(a.borrarCuarentena(k), false, k);
  });
  assert.deepEqual(Object.keys(a.ls.d).sort(), ['kibo.cuarentenaX', 'kibo.datos.2026', 'kibo.trabajo']);
  assert.equal(a.pedidos.length, 0);
  assert.equal(a.pedirBorrarCuarentena('kibo.cuarentena.2025'), false);
  assert.deepEqual(a.toasts, ['Ese texto apartado ya no está en este teléfono']);
});
