'use strict';
// R4.1: the engine never reads the system clock. `hoy` is injected ({anio, mes, dia, iso}); hoyDe(date) only reads
// getters from a Date it is GIVEN, so the motor block must not construct or reference Date at all.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');

var CODE = la.MOTOR_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('motor block: no new Date(), Date.now or any Date reference', function(){
  assert.ok(!/new\s+Date\b/.test(CODE), 'new Date');
  assert.ok(!/\bDate\s*\.\s*now\b/.test(CODE), 'Date.now');
  assert.ok(!/\bDate\b/.test(CODE), 'Date identifier');
});

test('motor block: no other time sources (performance, timers, getTimezoneOffset)', function(){
  assert.ok(!/\bperformance\b|\bsetTimeout\b|\bsetInterval\b|getTimezoneOffset/.test(CODE));
});

test('hoyDe builds {anio, mes, dia, iso} (mes 0-based) from the Date it is given', function(){
  var m = la.loadMotor();
  var h = m.hoyDe(new Date(2026, 9, 4, 12, 0, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(h)), {anio: 2026, mes: 9, dia: 4, iso: '2026-10-04'});
  var e = m.hoyDe(new Date(2027, 0, 1, 0, 0, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(e)), {anio: 2027, mes: 0, dia: 1, iso: '2027-01-01'});
});

test('the bare motor context has no usable system clock: a leak would throw', function(){
  var m = la.loadMotor();
  // the Date seen by code inside the motor's context must be unusable without an explicit value
  var CtxDate = m.hoyDe.constructor('return Date')();
  assert.throws(function(){ return new CtxDate(); }, 'new Date() inside the motor context must throw');
  assert.throws(function(){ return CtxDate.now(); }, 'Date.now() inside the motor context must throw');
  var h = m.hoyDe(new Date(2026, 5, 15, 12));
  assert.equal(m.mesTope(2026, h), 5);
  assert.equal(m.mesTope(2025, h), 11);
  assert.equal(m.mesTope(2027, h), -1);
  assert.equal(m.mesesCorridos(2026, h), 5);
  assert.equal(m.mesesCorridos(2025, h), 12);
  assert.equal(m.mesesCorridos(2027, h), 0);
});
