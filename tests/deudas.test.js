'use strict';
// E9(b) an installment counts as paid only when ticked AND monto > 0; E14 the last installment absorbs the rounding remainder.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var app = loadApp({
  today: '2026-06-15',
  funcs: ['mesesCorridos', 'planDe', 'totalConRecargo', 'repartoCuotas', 'valorCuota', 'cuotaPaga', 'pagadasHasta', 'pendientesDesde', 'planDeCarga', 'cargarCuotas', 'estadoDeuda', 'estaPagado']
});

function freshD(plan){
  var meses = [];
  for(var i = 0; i < 12; i++) meses.push(app.mesVacio());
  var d = {anio: 2026, meses: meses, planDeudas: {}};
  if(plan) d.planDeudas.Tarjeta = plan;
  return d;
}
function fila(d, j){   // the Tarjeta row of month j (created when missing)
  var f = d.meses[j].deudas.filter(function(x){ return x.nombre === 'Tarjeta'; })[0];
  if(!f){ f = {nombre: 'Tarjeta', monto: 0, pagado: false}; d.meses[j].deudas.push(f); }
  return f;
}
function montos(d, desde, n){ var o = []; for(var j = desde; j < desde + n; j++) o.push(fila(d, j).monto); return o; }
function suma(a){ return a.reduce(function(x, y){ return x + y; }, 0); }

// ── E14 ──
test('cargarCuotas E14: the last installment absorbs the rounding remainder (100000 / 3)', function(){
  app.D = freshD({total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0});
  var pc = app.cargarCuotas(app.D, 'Tarjeta', 6, app.hoy);
  assert.equal(pc.poner, 3);
  assert.deepEqual(montos(app.D, 6, 3), [33333, 33333, 33334]);
  assert.equal(suma(montos(app.D, 6, 3)), 100000);
});

test('cargarCuotas E14: with recargo the sum is exactly the rounded total with recargo', function(){
  app.D = freshD({total: 100000, recargo: 10, cuotas: 3, pagadasAntes: 0});
  app.cargarCuotas(app.D, 'Tarjeta', 0, app.hoy);
  assert.deepEqual(montos(app.D, 0, 3), [36667, 36667, 36666]);
  assert.equal(suma(montos(app.D, 0, 3)), 110000);
});

test('cargarCuotas E14: only the plan\'s final installment is adjusted, not the last one that fits in the year', function(){
  app.D = freshD({total: 100000, recargo: 0, cuotas: 12, pagadasAntes: 0});
  var pc = app.cargarCuotas(app.D, 'Tarjeta', 6, app.hoy);
  assert.equal(pc.poner, 6);
  assert.equal(pc.sobran, 6);
  assert.deepEqual(montos(app.D, 6, 6), [8333, 8333, 8333, 8333, 8333, 8333]);   // installments 1..6 of 12: all regular
});

test('cargarCuotas E14: installment numbers follow pagadasAntes and paid months before desde', function(){
  app.D = freshD({total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 2});
  app.cargarCuotas(app.D, 'Tarjeta', 0, app.hoy);                                 // only installment #3 is left: it is the last one
  assert.deepEqual(montos(app.D, 0, 1), [33334]);
  app.D = freshD({total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0});
  fila(app.D, 5).monto = 33333; fila(app.D, 5).pagado = true;       // installment #1 paid in June
  var pc = app.cargarCuotas(app.D, 'Tarjeta', 6, app.hoy);
  assert.equal(pc.poner, 2);
  assert.deepEqual(montos(app.D, 6, 2), [33333, 33334]);            // #2 and #3
});

test('cargarCuotas E14: a single installment is the whole rounded total', function(){
  app.D = freshD({total: 12345.6, recargo: 0, cuotas: 1, pagadasAntes: 0});
  app.cargarCuotas(app.D, 'Tarjeta', 3, app.hoy);
  assert.deepEqual(montos(app.D, 3, 1), [12346]);
});

test('repartoCuotas E14: the sum is exact for many totals, installments and recargos', function(){
  var totales = [1, 7, 999, 1000, 100000, 123457, 99999.5, 250000], cuotas = [1, 2, 3, 6, 7, 9, 10, 12, 18, 24, 36, 48, 60], rec = [0, 5, 10.5, 21];
  totales.forEach(function(t){ cuotas.forEach(function(n){ rec.forEach(function(r){
    var p = {total: t, recargo: r, cuotas: n, pagadasAntes: 0}, rp = app.repartoCuotas(p);
    var tot = Math.round(t * (1 + r / 100));
    assert.equal(rp.valor * (n - 1) + rp.ultima, tot, JSON.stringify(p));
    assert.ok(rp.valor >= 0 && rp.ultima >= 0, 'no negative installments ' + JSON.stringify(p));
  }); }); });
});

test('valorCuota keeps the regular installment (what the editor shows)', function(){
  assert.equal(app.valorCuota({total: 100000, recargo: 0, cuotas: 3}), 33333);
  assert.equal(app.valorCuota({total: 100000, recargo: 10, cuotas: 3}), 36667);
  assert.equal(app.valorCuota(null), 0);
  assert.equal(app.valorCuota({total: 100, recargo: 0, cuotas: 0}), 0);
});

test('estadoDeuda E14: saldo is the sum of the installments still to pay (last one adjusted)', function(){
  app.D = freshD({total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0});
  fila(app.D, 0).monto = 33333; fila(app.D, 0).pagado = true;
  assert.equal(Math.round(app.estadoDeuda(app.D, 'Tarjeta', 0, app.hoy).saldo), 66667);       // 33333 + 33334
  fila(app.D, 1).monto = 33333; fila(app.D, 1).pagado = true;
  assert.equal(Math.round(app.estadoDeuda(app.D, 'Tarjeta', 1, app.hoy).saldo), 33334);       // only the last one is left
  fila(app.D, 2).monto = 33334; fila(app.D, 2).pagado = true;
  assert.equal(app.estadoDeuda(app.D, 'Tarjeta', 2, app.hoy).saldo, 0);
});

// ── E9(b) ──
test('[R2 fixed] estadoDeuda E9: a ticked month with monto 0 is not a paid installment', function(){
  app.D = freshD({total: 30000, recargo: 0, cuotas: 3, pagadasAntes: 0});
  app.D.meses[0].deudas = [{nombre: 'Tarjeta', monto: 0, pagado: true}];
  var e = app.estadoDeuda(app.D, 'Tarjeta', 0, app.hoy);
  assert.equal(e.pagadas, 0);
  assert.equal(e.restantes, 3);
  assert.equal(e.esteMes, false);
});

test('estadoDeuda E9: ticked with monto > 0 counts; unticked with monto does not', function(){
  app.D = freshD({total: 30000, recargo: 0, cuotas: 3, pagadasAntes: 0});
  app.D.meses[0].deudas = [{nombre: 'Tarjeta', monto: 10000, pagado: true}];
  app.D.meses[1].deudas = [{nombre: 'Tarjeta', monto: 10000, pagado: false}];
  app.D.meses[2].deudas = [{nombre: 'Tarjeta', monto: 0, pagado: true}];
  var e = app.estadoDeuda(app.D, 'Tarjeta', 2, app.hoy);
  assert.equal(e.pagadas, 1);
  assert.equal(e.restantes, 2);
});

test('pagadasHasta E9: ignores ticked rows without amount', function(){
  app.D = freshD({total: 30000, recargo: 0, cuotas: 3, pagadasAntes: 0});
  app.D.meses[0].deudas = [{nombre: 'Tarjeta', monto: 0, pagado: true}];
  app.D.meses[1].deudas = [{nombre: 'Tarjeta', monto: 5, pagado: true}];
  assert.equal(app.pagadasHasta(app.D, 'Tarjeta', 3), 1);
  assert.equal(app.pendientesDesde(app.D, 'Tarjeta', 3), 2);
});

test('estadoDeuda E9: a ticked zero month does not move the projection start', function(){
  app.D = freshD({total: 30000, recargo: 0, cuotas: 3, pagadasAntes: 0});
  app.D.meses[8].deudas = [{nombre: 'Tarjeta', monto: 0, pagado: true}];   // far in the future, empty
  var e = app.estadoDeuda(app.D, 'Tarjeta', 8, app.hoy);
  assert.equal(e.fin.mes, 8);   // starts after the current month (June = 5): 3 left => July, August, September (index 8)
});
