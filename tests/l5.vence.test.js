'use strict';
// L5 "Qué vence esta semana": what is due in the next 7 days and what is overdue, on the current month only, from dated data the app
// already has (income collection days, the month end for rows without a day, Trabajo invoices by due date, past-month pending rows of
// the model). No date is invented and no amount is computed: each amount is the row's amount or the invoice's open balance.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');

var FUNCS = ['vencimientos', 'montosPorFecha', 'diasCobro', 'isoDe', 'dos', 'diasDelMes', 'mesDelModelo', 'diasEntre', 'utcDe', 'esISO', 'cuandoVence', 'detalleVence',
  'htmlVence', 'fARS', 'grupos', 'esc', 'fDia', 'cuantosPagos', 'repartoTrabajo', 'ctxModelo', 'cierreAnioAnterior', 'leerAnio', 'hoyISO', 'sumarDias'];
function app(today){
  return la.loadApp({today: today, funcs: FUNCS, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX', 'venceL', 'oculto', 'PUNTOS'], globals: {T: null}});
}
function ing(n, m, p, frec, dias){ var x = C.it(n, m, p); x.frec = frec; x.dias = dias; return x; }
function anio(a, raw){ return a.normalizar(raw, a.hoy); }
function resumen(l){ return JSON.parse(JSON.stringify(l)).map(function(x){ return [x.atrasado ? 'atrasado' : 'semana', x.tipo, x.nombre, x.monto, x.fecha]; }); }

test('L5 only the current month has the card (past and future months: nothing)', function(){
  var a = app('2026-10-15'), raw = C.vacio(2026);
  C.arrastre(raw, 8, 0);
  C.mes(raw, 8, {gastosFijos: [C.it('Luz', 20000, false)]});
  C.mes(raw, 10, {ingresos: [ing('Sueldo', 900000, false, 'mensual', [1])]});
  var d = anio(a, raw);
  assert.deepEqual(resumen(a.vencimientos(d, 8, a.hoy, [])), []);
  assert.deepEqual(resumen(a.vencimientos(d, 10, a.hoy, [])), []);
  assert.equal(a.vencimientos(d, 9, a.hoy, []).length, 1, 'the current month lists September\'s Luz');
});

test('L5 window: income collection days in the next 7 days, a passed day is overdue, later days wait', function(){
  var a = app('2026-10-15'), raw = C.vacio(2026);
  C.arrastre(raw, 9, 0);
  C.mes(raw, 9, {ingresos: [ing('Sueldo', 900000, false, 'mensual', [20]), ing('Alquiler cobrado', 300000, false, 'mensual', [25]),
    ing('Changas', 80000, false, 'dias', [5]), ing('Feria', 40000, false, 'semanal', [5]), ing('Bono', 50000, false, 'mensual', [22]),
    ing('Cobrado ya', 10000, true, 'mensual', [16]), ing('Sin día', 70000, false, '', [])],
    gastosFijos: [C.it('Expensas', 60000, false)]});
  var d = anio(a, raw);
  assert.deepEqual(resumen(a.vencimientos(d, 9, a.hoy, [])), [
    ['atrasado', 'cobrar', 'Feria', 8000, '2026-10-02'],     // weekly on Fridays: 2, 9, 16, 23, 30 -> 5 collections of 8.000 (L5 review)
    ['atrasado', 'cobrar', 'Changas', 80000, '2026-10-05'],
    ['atrasado', 'cobrar', 'Feria', 8000, '2026-10-09'],     // every passed Friday is overdue; the next one is the 16th
    ['semana', 'cobrar', 'Feria', 8000, '2026-10-16'],
    ['semana', 'cobrar', 'Sueldo', 900000, '2026-10-20'],
    ['semana', 'cobrar', 'Bono', 50000, '2026-10-22']        // exactly 7 days ahead: inside
  ], 'the 25th (10 days), ticked rows and rows without a day (month end is 16 days away) are not listed');
});

test('L5 rows without a day are due with the month: listed only in its last 7 days, marked "Fin de mes"', function(){
  var raw = C.vacio(2026);
  C.arrastre(raw, 9, 0);
  C.mes(raw, 9, {gastosFijos: [C.it('Expensas', 60000, false)], deudas: [C.it('Tarjeta', 120000, false)], ingresos: [C.it('Alquiler', 300000, false)]});
  var a = app('2026-10-24'), d = anio(a, raw), l = a.vencimientos(d, 9, a.hoy, []);
  assert.deepEqual(resumen(l), [['semana', 'cobrar', 'Alquiler', 300000, '2026-10-31'], ['semana', 'pagar', 'Tarjeta', 120000, '2026-10-31'],
    ['semana', 'pagar', 'Expensas', 60000, '2026-10-31']], '31 - 24 = 7 days: inside; same date, bigger amount first');
  assert.equal(a.cuandoVence(l[0], a.hoy), 'Fin de mes');
  assert.equal(a.detalleVence(l[1]), 'A pagar · vence con el mes');
  var b = app('2026-10-23');
  assert.deepEqual(resumen(b.vencimientos(anio(b, raw), 9, b.hoy, [])), [], '8 days to the month end: not yet');
});

test('L5 overdue from past months of the model = the rows the hero chip "Atrasado" adds up; legacy months are not overdue', function(){
  var a = app('2026-10-15'), raw = C.vacio(2026);
  C.arrastre(raw, 7, 0);
  C.mes(raw, 6, {gastosFijos: [C.it('Antes del modelo', 5000, false)]});
  C.mes(raw, 7, {gastosFijos: [C.it('Luz', 20000, false), C.it('Gas', 9000, true)], ingresos: [C.it('Del trabajo', 50000, false), C.it('Sueldo', 900000, false)]});
  C.mes(raw, 8, {gastosVariables: [C.it('Super', 30000, false)], deudas: [C.it('Préstamo', 100000, false)]});
  var d = anio(a, raw), l = a.vencimientos(d, 9, a.hoy, []);
  assert.deepEqual(resumen(l), [
    ['atrasado', 'cobrar', 'Sueldo', 900000, '2026-08-31'], ['atrasado', 'cobrar', 'Del trabajo', 50000, '2026-08-31'], ['atrasado', 'pagar', 'Luz', 20000, '2026-08-31'],
    ['atrasado', 'pagar', 'Préstamo', 100000, '2026-09-30'], ['atrasado', 'pagar', 'Super', 30000, '2026-09-30']]);
  var res = a.cadena(d, a.hoy, {pasesTrabajo: {}}).resumen, pagar = 0, cobrar = 0;
  l.forEach(function(x){ if(x.tipo === 'pagar') pagar += x.monto; else cobrar += x.monto; });
  assert.equal(pagar, res.vencidos, 'the overdue rows to pay add up to cadena.resumen.vencidos');
  assert.equal(cobrar, res.vencidosIngresos, 'income: the same rows, "Del trabajo" included (no pases cover it; L5 review)');
  assert.equal(a.detalleVence(l[2]), 'A pagar · de agosto');
  var leg = C.vacio(2026);
  C.mes(leg, 8, {gastosFijos: [C.it('Luz', 20000, false)]});
  assert.deepEqual(resumen(a.vencimientos(anio(a, leg), 9, a.hoy, [])), [], 'a year without the month-to-month balance has no "Atrasado"');
});

test('L5 Trabajo invoices: open balance by due date; overdue, inside 7 days, outside, paid', function(){
  var a = app('2026-10-15'), d = anio(a, C.vacio(2026));
  var f = [{id: 'a', nombre: 'Ana · Factura 1', saldo: 30000, vence: '2026-10-10'}, {id: 'b', nombre: 'Beto · Factura 2', saldo: 45000, vence: '2026-10-22'},
    {id: 'c', nombre: 'Caro · Factura 3', saldo: 9000, vence: '2026-10-23'}, {id: 'e', nombre: 'Eva · Factura 5', saldo: 0, vence: '2026-10-16'},
    {id: 'g', nombre: 'Gus · Factura 6', saldo: 12000, vence: '2026-10-15'}];
  var l = a.vencimientos(d, 9, a.hoy, f);
  assert.deepEqual(resumen(l), [['atrasado', 'cobrar', 'Ana · Factura 1', 30000, '2026-10-10'], ['semana', 'cobrar', 'Gus · Factura 6', 12000, '2026-10-15'],
    ['semana', 'cobrar', 'Beto · Factura 2', 45000, '2026-10-22']]);
  assert.deepEqual([l[0].id, l[1].id, l[2].id], ['a', 'g', 'b'], 'each one keeps its invoice id (the tap opens it)');
  assert.deepEqual([a.cuandoVence(l[0], a.hoy), a.cuandoVence(l[1], a.hoy), a.cuandoVence(l[2], a.hoy)], ['Atrasado', 'Hoy', 'El 22/10']);
  assert.equal(a.detalleVence(l[0]), 'Trabajo · a cobrar · venció el 10/10');
});

test('L5 card: nothing due -> no card at all; names are escaped; more than six rows are summarized', function(){
  var a = app('2026-10-26'), raw = C.vacio(2026);
  C.arrastre(raw, 9, 0);
  assert.equal(a.htmlVence(a.vencimientos(anio(a, raw), 9, a.hoy, []), a.hoy), '', 'empty: no card, no empty message');
  var filas = [C.it('<img src=x onerror=alert(1)>', 9000, false)];
  for(var i=0;i<7;i++) filas.push(C.it('Gasto ' + i, 2000 + i, false));
  C.mes(raw, 9, {gastosVariables: filas});
  var h = a.htmlVence(a.vencimientos(anio(a, raw), 9, a.hoy, []), a.hoy);
  assert.match(h, /<b>Qué vence esta semana<\/b><small>8 cosas<\/small>/);
  assert.equal((h.match(/data-act="irVence"/g) || []).length, 6);
  assert.match(h, /Y 2 más: los ves en sus secciones\./);
  assert.ok(h.indexOf('<img') < 0 && h.indexOf('&lt;img src=x onerror=alert(1)&gt;') > 0, 'the row name is escaped');
});
