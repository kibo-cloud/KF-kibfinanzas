'use strict';
// D4 (owner-decisions-closure, L5 due day, option b): an optional "vence el día N" on fixed-expense rows and on debt plans (the plan's
// installment rows). Additive stored field, read with fallback: rows and plans without it behave exactly as before (due with the month,
// listed only in its last 7 days). With a day, "Qué vence esta semana" lists the row from 7 days before that day, and as overdue once the
// day passed. No amount is computed: each amount is the row's own.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');

var M = la.loadMotor();
var FUNCS = ['vencimientos', 'diaVence', 'leerDiaVence', 'montosPorFecha', 'diasCobro', 'isoDe', 'dos', 'diasDelMes', 'mesDelModelo', 'diasEntre', 'utcDe', 'esISO', 'cuandoVence', 'detalleVence',
  'htmlVence', 'fARS', 'grupos', 'esc', 'fDia', 'cuantosPagos', 'repartoTrabajo', 'ctxModelo', 'cierreAnioAnterior', 'leerAnio', 'previoEnVivo', 'carryDiciembre', 'cuotasRealizadas', 'esProgramado', 'mesDelModelo', 'arrastreVivo', 'cuotasProgramadas', 'hoyISO', 'sumarDias',
  'parseEntero', 'sinSigno'];
function app(today){
  return la.loadApp({today: today, funcs: FUNCS, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX', 'venceL', 'oculto', 'PUNTOS'], globals: {T: null}});
}
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function conDia(it, dia){ it.vence = dia; return it; }
function resumen(l){ return plain(l).map(function(x){ return [x.atrasado ? 'atrasado' : 'semana', x.tipo, x.nombre, x.monto, x.fecha]; }); }

test('D4 normalizar keeps a valid due day on rows and plans and drops anything else; rows without it are unchanged', function(){
  var raw = C.vacio(2026), H = C.hoy('2026-10-15');
  C.mes(raw, 9, {gastosFijos: [conDia(C.it('Alquiler', 1, false), 10), conDia(C.it('A', 1, false), 0), conDia(C.it('B', 1, false), 32), conDia(C.it('C', 1, false), 2.5),
    conDia(C.it('D', 1, false), '7'), C.it('Sin día', 1, false), conDia(C.it('Fin', 1, false), 31)]});
  raw.planDeudas = {Tarjeta: {total: 100, cuotas: 2, pagadasAntes: 0, recargo: 0, vence: 18}, Moto: {total: 100, cuotas: 2, vence: 'x'}};
  var d = plain(M.normalizar(C.copy(raw), H));
  assert.deepEqual(d.meses[9].gastosFijos.map(function(x){ return x.vence; }), [10, undefined, undefined, undefined, undefined, undefined, 31]);
  assert.equal('vence' in d.meses[9].gastosFijos[5], false, 'no key added to a row without a day (stored shape unchanged)');
  assert.equal(d.planDeudas.Tarjeta.vence, 18);
  assert.equal('vence' in d.planDeudas.Moto, false);
});

test('D4 the sheet field accepts an empty value (no day) or a whole day 1..31', function(){
  var a = app('2026-10-15');
  assert.deepEqual([a.leerDiaVence(''), a.leerDiaVence(' 5 '), a.leerDiaVence('31')], [0, 5, 31]);
  assert.ok([a.leerDiaVence('32'), a.leerDiaVence('0'), a.leerDiaVence('x'), a.leerDiaVence('2,5'), a.leerDiaVence('-3')].every(function(v){ return isNaN(v); }));
});

test('D4 a fixed expense with a day: listed from 7 days before it, overdue after it; ticked or later rows are not; undated rows as before', function(){
  var a = app('2026-10-15'), raw = C.vacio(2026);
  C.arrastre(raw, 9, 0);
  C.mes(raw, 9, {gastosFijos: [conDia(C.it('Alquiler', 300000, false), 10), conDia(C.it('Luz', 20000, false), 22), conDia(C.it('Gas', 15000, false), 23),
    conDia(C.it('Pagado', 5000, true), 16), C.it('Internet', 30000, false), conDia(C.it('Hoy', 1000, false), 15)]});
  var l = a.vencimientos(a.normalizar(raw, a.hoy), 9, a.hoy, []);
  assert.deepEqual(resumen(l), [
    ['atrasado', 'pagar', 'Alquiler', 300000, '2026-10-10'],
    ['semana', 'pagar', 'Hoy', 1000, '2026-10-15'],
    ['semana', 'pagar', 'Luz', 20000, '2026-10-22']
  ], 'Gas (8 days ahead), the ticked row and Internet (no day, month end 16 days away) are not listed');
  assert.deepEqual(plain(l).map(function(x){ return [a.cuandoVence(x, a.hoy), a.detalleVence(x)]; }),
    [['Atrasado', 'A pagar · era el día 10'], ['Hoy', 'A pagar'], ['Día 22', 'A pagar']]);
});

test('D4 a debt plan with a day dates its installment rows; a day past the month end means its last day', function(){
  var a = app('2026-11-26'), raw = C.vacio(2026);
  C.arrastre(raw, 10, 0);
  C.mes(raw, 10, {deudas: [C.it('Tarjeta', 50000, false), C.it('Moto', 40000, false), C.it('Sin plan', 10000, false)], gastosFijos: [conDia(C.it('Seguro', 9000, false), 31)]});
  raw.planDeudas = {Tarjeta: {total: 100000, cuotas: 2, pagadasAntes: 0, recargo: 0, vence: 20}, Moto: {total: 80000, cuotas: 2, pagadasAntes: 0, recargo: 0, vence: 31}};
  var l = a.vencimientos(a.normalizar(raw, a.hoy), 10, a.hoy, []);
  assert.deepEqual(resumen(l), [
    ['atrasado', 'pagar', 'Tarjeta', 50000, '2026-11-20'],
    ['semana', 'pagar', 'Moto', 40000, '2026-11-30'],
    ['semana', 'pagar', 'Sin plan', 10000, '2026-11-30'],
    ['semana', 'pagar', 'Seguro', 9000, '2026-11-30']
  ]);
  assert.equal(a.cuandoVence(plain(l)[1], a.hoy), 'Día 30', 'a dated row is not "Fin de mes"');
  assert.equal(a.cuandoVence(plain(l)[2], a.hoy), 'Fin de mes', 'an undated row keeps "Fin de mes"');
});
