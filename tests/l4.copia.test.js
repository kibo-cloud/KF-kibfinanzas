'use strict';
// L4 backup reminder: one compact notice when the last backup is older than 30 days, or there was never one and this phone has had
// data for 7 days or more. "Más tarde" snoozes it for 7 days (device key). Never for an empty phone, never downloads by itself.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');

var DIA = 86400000;
var AHORA = new Date('2026-10-15T12:00:00').getTime();
function hace(dias, extraMs){ return new Date(AHORA - dias * DIA - (extraMs || 0)).toISOString(); }

function fakeStorage(init){
  var d = Object.assign({}, init || {});
  return {d: d, getItem: function(k){ return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function(k, v){ d[k] = String(v); }, removeItem: function(k){ delete d[k]; }};
}
function app(ls, conDatos){
  var avisos = {innerHTML: ''};
  var g = {localStorage: ls, document: {getElementById: function(id){ return id === 'avisos' ? avisos : null; }},
    hayDatos: function(){ return conDatos; }, tieneTrab: function(){ return false; }, sinTaparCuarentena: function(){ return ''; },
    aniosGuardados: function(){ return []; }, leerAnio: function(){ return null; }};
  var a = la.loadApp({today: '2026-10-15', funcs: ['recordatorioCopia', 'revisarCopia', 'posponerCopia', 'ultimaCopia', 'hayDatosEnElTelefono'],
    vars: ['LSCOPIA', 'LSDATOSDESDE', 'LSCOPIAPOS', 'DIAS_COPIA', 'DIAS_SIN_COPIA', 'DIAS_POSPONER'], globals: g});
  a.avisos = avisos;
  return a;
}

test('L4 thresholds: a backup older than 30 days reminds, 30 days or less does not', function(){
  var a = app(fakeStorage(), true);
  assert.equal(a.recordatorioCopia(AHORA, hace(30), '', '', true), null, 'exactly 30 days: not older than 30');
  assert.deepEqual(a.plain(a.recordatorioCopia(AHORA, hace(30, 60000), '', '', true)), {dias: 30, nunca: false}, 'just over 30 days');
  assert.deepEqual(a.plain(a.recordatorioCopia(AHORA, hace(45), hace(400), '', true)), {dias: 45, nunca: false});
  assert.equal(a.recordatorioCopia(AHORA, hace(2), hace(400), '', true), null);
});

test('L4 thresholds: never backed up reminds only after 7 days with data on this phone', function(){
  var a = app(fakeStorage(), true);
  assert.equal(a.recordatorioCopia(AHORA, '', '', '', true), null, 'no record of when the data appeared: not yet');
  assert.equal(a.recordatorioCopia(AHORA, '', hace(6), '', true), null);
  assert.deepEqual(a.plain(a.recordatorioCopia(AHORA, '', hace(7), '', true)), {dias: 7, nunca: true});
  assert.deepEqual(a.plain(a.recordatorioCopia(AHORA, 'basura', hace(9), '', true)), {dias: 9, nunca: true}, 'an unreadable date counts as never');
});

test('L4 empty phone: never reminds, whatever the dates', function(){
  var a = app(fakeStorage(), false);
  assert.equal(a.recordatorioCopia(AHORA, hace(90), hace(400), '', false), null);
  assert.equal(a.recordatorioCopia(AHORA, '', hace(400), '', false), null);
});

test('L4 snooze: "Más tarde" hides it for 7 days, then it comes back', function(){
  var a = app(fakeStorage(), true);
  var hasta = new Date(AHORA + 7 * DIA).toISOString();
  assert.equal(a.recordatorioCopia(AHORA, hace(45), '', hasta, true), null);
  assert.equal(a.recordatorioCopia(AHORA + 7 * DIA - 1, hace(45), '', hasta, true), null);
  assert.deepEqual(a.plain(a.recordatorioCopia(AHORA + 7 * DIA, hace(45), '', hasta, true)), {dias: 52, nunca: false});
});

test('L4 revisarCopia: shows one compact notice with both buttons; "Más tarde" stores the snooze and hides it', function(){
  var ls = fakeStorage({'kibo.ultimaCopia': hace(40)}), a = app(ls, true);
  a.revisarCopia();
  var h = a.avisos.innerHTML;
  assert.equal((h.match(/class="aviso/g) || []).length, 1, 'one notice');
  assert.match(h, /data-av="copia"/);
  assert.match(h, /Hace <b>40 días<\/b> que no hacés una copia de seguridad\. Tus datos viven solo en este dispositivo\./);
  assert.match(h, /data-act="copia">Hacer copia ahora</);
  assert.match(h, /data-act="posponerCopia">Más tarde</);
  a.posponerCopia();
  assert.equal(a.avisos.innerHTML, '');
  assert.equal(ls.d['kibo.copiaPospuesta'], new Date(AHORA + 7 * DIA).toISOString());
  a.revisarCopia();
  assert.equal(a.avisos.innerHTML, '', 'snoozed: nothing on the next start');
});

test('L4 revisarCopia: records the first day this phone had data; an empty phone gets nothing and forgets that day', function(){
  var ls = fakeStorage(), a = app(ls, true);
  a.revisarCopia();
  assert.equal(ls.d['kibo.datosDesde'], new Date(AHORA).toISOString(), 'first day with data is recorded');
  assert.equal(a.avisos.innerHTML, '', 'day 0 with data and no backup: no notice yet');
  ls.d['kibo.datosDesde'] = hace(8);
  a.revisarCopia();
  assert.match(a.avisos.innerHTML, /Hace <b>8 días<\/b> que cargás datos y todavía no hiciste ninguna copia de seguridad\. Tus datos viven solo en este dispositivo\./);
  var vacio = fakeStorage({'kibo.datosDesde': hace(30)}), b = app(vacio, false);
  b.revisarCopia();
  assert.equal(b.avisos.innerHTML, '');
  assert.equal(vacio.d['kibo.datosDesde'], undefined);
});
