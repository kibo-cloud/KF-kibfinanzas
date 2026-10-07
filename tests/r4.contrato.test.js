'use strict';
// R4.2: the numeric cases of the approved contract (odd/tasks/repair-sprint-1-r4-design.md sections 2, 4, 5, 7) against the NEW pure
// functions estadoMes / flujosMes / cadena / pasivos / patrimonioNeto. Nothing here touches the UI or the pinned golden.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function armar(raw, iso, ctx){
  var h = C.hoy(iso), d = M.normalizar(C.copy(raw), h);
  return {d: d, h: h, ctx: ctx, cad: plain(M.cadena(d, h, ctx)), pat: plain(M.patrimonioNeto(d, h, ctx)), pas: plain(M.pasivos(d, h)), flu: function(j){ return plain(M.flujosMes(d, j, h, ctx)); }};
}

test('estadoMes: past, current and future by month; whole years by year', function(){
  var h = C.hoy('2026-10-15');
  assert.equal(M.estadoMes(2026, 8, h), 'pasado');
  assert.equal(M.estadoMes(2026, 9, h), 'actual');
  assert.equal(M.estadoMes(2026, 10, h), 'futuro');
  assert.equal(M.estadoMes(2025, 11, h), 'pasado');
  assert.equal(M.estadoMes(2027, 0, h), 'futuro');
});

test('s2 (a,b,d): September, with a declared opening and a confirmed real closing', function(){
  var r = armar(C.seccion2(false, false), '2026-10-15'), s = r.cad.meses[8];
  assert.equal(s.apertura, 50000);
  assert.equal(s.resultado, 300000);
  assert.equal(s.pasesNetos, -150000);
  assert.equal(s.cierreCalc, 200000);
  assert.equal(s.cierreReal, 175000);
  assert.equal(s.diferencia, -25000);
  assert.equal(s.reconfirmar, false);   // confirmed at 200.000 and still 200.000
  assert.equal(s.cierre, 175000);
  assert.equal(r.flu(8).gastosPend, 20000);   // Luz: pending, outside the closing
  assert.equal(r.flu(8).dAhorroARS, 150000);
});

test('s2 (b again, e): October is the current month; November is only a projection', function(){
  var r = armar(C.seccion2(false, false), '2026-10-15'), o = r.cad.meses[9], n = r.cad.meses[10];
  assert.equal(o.apertura, 175000);
  assert.equal(o.resultado, 600000);
  assert.equal(o.pasesNetos, 50000);
  assert.equal(o.cierreCalc, 825000);
  assert.equal(r.cad.resumen.disponibleActual, 825000);
  assert.equal(o.proyectado, 580000);   // 825.000 - 120.000 - 25.000 - 100.000
  assert.equal(r.cad.resumen.proyectadoAlCierre, 580000);
  assert.equal(r.cad.resumen.vencidos, 20000);   // Sep Luz, shown apart (Q8)
  assert.equal(n.apertura, 825000);
  assert.equal(n.cierreCalc, 825000);   // nothing future is realized: flat
  assert.equal(n.resultado, 0);
  assert.equal(n.proyectado, 1280000);   // 580.000 + 1.000.000 - 100.000 - 200.000
  assert.equal(r.cad.resumen.sinDisponible, false);
});

test('s2: ahorro a hoy 600.000, aReponer 50.000, patrimonio bruto 2.925.000, pasivos 300.000, neto 2.625.000', function(){
  var r = armar(C.seccion2(false, false), '2026-10-15');
  assert.equal(r.pat.ahorroARS, 600000);
  assert.equal(M.serie(r.d, r.h)[9].aReponer, 50000);
  assert.equal(r.pat.usd, 1000);
  assert.equal(r.pat.usdARS, 1500000);
  assert.equal(r.pat.disponible, 825000);
  assert.equal(r.pat.criptoARS, 0);
  assert.equal(r.pat.bruto, 2925000);
  assert.equal(r.pat.pasivos, 300000);
  assert.equal(r.pat.neto, 2625000);
  assert.equal(r.pat.estimado, true);
  assert.equal(r.pas.total, 300000);
  assert.deepEqual(r.pas.detalle, [{nombre: 'Préstamo', saldo: 300000, conPlan: true}]);
});

test('s2 (g): consecutive months with every pending row paid, and the telescoping sum', function(){
  var r = armar(C.seccion2(true, true), '2026-11-20'), c = r.cad.meses;
  assert.deepEqual([c[8].apertura, c[8].resultado, c[8].pasesNetos, c[8].cierreCalc, c[8].cierreReal, c[8].diferencia], [50000, 300000, -150000, 200000, 175000, -25000]);
  assert.deepEqual([c[9].apertura, c[9].resultado, c[9].pasesNetos, c[9].cierreCalc, c[9].cierreReal, c[9].diferencia], [175000, 355000, 50000, 580000, null, null]);
  assert.deepEqual([c[10].apertura, c[10].resultado, c[10].pasesNetos, c[10].cierreCalc], [580000, 900000, -200000, 1280000]);
  assert.equal(r.cad.resumen.disponibleActual, 1280000);
  var suma = c[8].apertura + c[8].resultado + c[9].resultado + c[10].resultado + c[8].pasesNetos + c[9].pasesNetos + c[10].pasesNetos + c[8].diferencia;
  assert.equal(suma, 1280000);   // every peso is a result, a transfer or a visible difference
});

test('s2: the same data one month earlier already shows October as future (nothing moves a hoy)', function(){
  var r = armar(C.seccion2(false, false), '2026-09-15'), s = r.cad.meses[8];
  assert.equal(s.estado, 'actual');
  assert.equal(r.cad.meses[9].estado, 'futuro');
  assert.equal(r.cad.meses[9].resultado, 0);
  assert.equal(r.cad.meses[9].pasesNetos, 0);
  assert.equal(r.cad.resumen.disponibleActual, 200000);   // calculated so far; the confirmation of a non-closed month is not used
  assert.equal(r.pat.ahorroARS, 650000);   // October's withdrawal is scheduled, not realized
});

// ---- section 4: transfers ----
test('s4: savings in the same month, USD purchase, scheduled savings', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
  C.mes(d, 8, {compraARS: 300000, compraUSD: 200});
  C.mes(d, 9, {ahorroMesARS: 150000});
  C.mes(d, 10, {ahorroMesARS: 200000});
  var r = armar(d, '2026-10-15'), s = r.flu(8), o = r.flu(9), n = r.flu(10);
  assert.deepEqual([s.dDisp, s.dAhorroARS, s.dUSD], [0, -300000, 200]);   // the purchase never touches Disponible
  assert.deepEqual([o.dDisp, o.dAhorroARS, o.dUSD], [-150000, 150000, 0]);
  assert.deepEqual([n.dDisp, n.dAhorroARS, n.pasesNetos, n.pasesNetosProg], [0, 0, 0, -200000]);   // scheduled: only the projection
  assert.equal(r.cad.meses[10].proyectado, r.cad.meses[9].proyectado - 200000);
  assert.equal(r.pat.ahorroARS, -150000);   // start 0, Sep -300.000, Oct +150.000 (November is not realized)
  assert.equal(r.pat.usd, 200);
});

test('s4: ahorroMesUSD is an external USD inflow: it only touches the USD pocket (Q13)', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 1000, 'declarado'); C.mes(d, 9, {ahorroMesUSD: 25});
  var r = armar(d, '2026-10-15'), o = r.flu(9);
  assert.deepEqual([o.dDisp, o.dAhorroARS, o.dUSD], [0, 0, 25]);
  assert.equal(r.pat.usd, 25);
  assert.equal(r.pat.disponible, 1000);
});

test('s4: a past transfer edited in an unconfirmed month changes that closing and the next opening; in a confirmed month the opening holds', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 100000, 'declarado');
  C.mes(d, 8, {ahorroMesARS: 40000});
  var antes = armar(d, '2026-10-15').cad.meses;
  d.meses[8].ahorroMesARS = 10000;
  var despues = armar(d, '2026-10-15').cad.meses;
  assert.equal(antes[8].cierreCalc, 60000); assert.equal(despues[8].cierreCalc, 90000);
  assert.equal(antes[9].apertura, 60000); assert.equal(despues[9].apertura, 90000);
  // confirmed at 60.000: editing keeps the opening, updates the difference and asks to reconfirm (D6)
  d.meses[8].ahorroMesARS = 40000;
  d.meses[8].cierreReal = {valor: 60000, calculadoAlConfirmar: 60000, confirmadoEl: '2026-10-01'};
  var c1 = armar(d, '2026-10-15').cad.meses[8];
  assert.deepEqual([c1.diferencia, c1.reconfirmar], [0, false]);
  d.meses[8].ahorroMesARS = 10000;
  var c2 = armar(d, '2026-10-15').cad.meses;
  assert.equal(c2[9].apertura, 60000);
  assert.equal(c2[8].diferencia, -30000);
  assert.equal(c2[8].reconfirmar, true);
});

// ---- section 5: debts ----
test('s5 A: reposicion = / < / > aReponer: no money is created, the excess is labeled as savings (D11)', function(){
  [[100000, 0, 0], [60000, 40000, 0], [150000, 0, 50000]].forEach(function(c){
    var d = C.vacio(2026); C.arrastre(d, 8, 500000, 'declarado');
    C.mes(d, 8, {retiroARS: 100000}); C.mes(d, 9, {reposicionARS: c[0]});
    var r = armar(d, '2026-10-15'), o = r.flu(9);
    assert.equal(o.dDisp, -c[0]); assert.equal(o.dAhorroARS, c[0]);
    assert.equal(M.serie(r.d, r.h)[9].aReponer, c[1]);
    assert.equal(o.reposicionExcedente, c[2]);
    assert.equal(o.dDisp + o.dAhorroARS, 0);
  });
});

function plan3(extra){
  var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
  d.planDeudas = {'Tarjeta': {total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0}};
  C.mes(d, 8, {ingresos: [C.it('Sueldo', 1000000, true)], deudas: [C.it('Tarjeta', 33333, false)]});
  C.mes(d, 9, {deudas: [C.it('Tarjeta', 33333, false)]});
  C.mes(d, 10, {deudas: [C.it('Tarjeta', 33334, false)]});
  if(extra) extra(d);
  return d;
}

test('s5 B: partial plan, cuota 0, future installment', function(){
  var r = armar(plan3(), '2026-10-15');
  assert.equal(r.pas.total, 100000);   // nothing paid: 33.333 + 33.333 + 33.334, overdue and future included
  r = armar(plan3(function(d){ d.meses[8].deudas[0].pagado = true; }), '2026-10-15');
  assert.equal(r.pas.total, 66667);   // 33.333 + 33.334
  assert.equal(r.flu(8).resultado, 1000000 - 33333);
  r = armar(plan3(function(d){ d.meses[8].deudas[0].pagado = true; d.meses[8].deudas[0].monto = 0; }), '2026-10-15');
  assert.equal(r.pas.total, 100000);   // cuota 0 ticked is not a payment
  assert.equal(r.flu(8).resultado, 1000000);
  var rf = armar(plan3(function(d){ d.meses[10].deudas[0].pagado = true; }), '2026-10-15');
  assert.equal(rf.pas.total, 100000);   // a future tick realizes nothing
  assert.equal(rf.flu(10).cuotasReal, 0);
});

test('s5 B: an overdue installment paid later is booked in its own month; chain or reconfirmation follows (Q7)', function(){
  var r0 = armar(plan3(), '2026-10-15');
  assert.equal(r0.cad.meses[8].cierreCalc, 1000000);   // the overdue installment stays out of the closing
  assert.equal(r0.cad.resumen.vencidos, 33333);
  var pagada = function(d){ d.meses[8].deudas[0].pagado = true; };
  var r1 = armar(plan3(pagada), '2026-10-15');
  assert.equal(r1.cad.meses[8].cierreCalc, 1000000 - 33333);
  assert.equal(r1.cad.meses[9].apertura, 1000000 - 33333);   // unconfirmed: the next opening follows
  assert.equal(r1.cad.resumen.vencidos, 0);
  var r2 = armar(plan3(function(d){ d.meses[8].cierreReal = {valor: 1000000, calculadoAlConfirmar: 1000000, confirmadoEl: '2026-10-01'}; pagada(d); }), '2026-10-15');
  assert.equal(r2.cad.meses[9].apertura, 1000000);   // confirmed: the opening holds
  assert.equal(r2.cad.meses[8].diferencia, 33333);
  assert.equal(r2.cad.meses[8].reconfirmar, true);
});

test('s5 B: a debt without a plan: unticked rows of past/current months count, future rows do not', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
  C.mes(d, 7, {deudas: [C.it('Amigo', 5000, false)]});
  C.mes(d, 8, {deudas: [C.it('Amigo', 7000, true), C.it('Tienda', 3000, false)]});
  C.mes(d, 9, {deudas: [C.it('Amigo', 1000, false)]});
  C.mes(d, 10, {deudas: [C.it('Amigo', 9999, false)]});
  var r = armar(d, '2026-10-15');
  assert.equal(r.pas.total, 5000 + 3000 + 1000);
  assert.deepEqual(r.pas.detalle.map(function(x){ return [x.nombre, x.saldo, x.conPlan]; }), [['Amigo', 6000, false], ['Tienda', 3000, false]]);
});

// ---- section 7: "Del trabajo" ----
function trab(monto, pagado, pases, hoyIso){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', monto, pagado)]});
  C.mes(d, 10, {ingresos: [C.it('Del trabajo', 300000, false)]});
  return armar(d, hoyIso || '2026-10-15', {pasesTrabajo: pases || {}});
}

test('s7: a pase dated <= hoy is realized income into Disponible; the row is only its projection', function(){
  var r = trab(300000, false, {'2026-10': [{fecha: '2026-10-10', monto: 300000}], '2026-11': [{fecha: '2026-11-05', monto: 300000}]}), f = r.flu(9);
  assert.deepEqual([f.trabajoRealizado, f.trabajoProgramado, f.resultado, f.pasesNetos, f.reconciliar], [300000, 0, 0, 300000, false]);
  assert.equal(r.cad.resumen.disponibleActual, 300000);
  var n = r.flu(10);   // future pase: scheduled on the Disponible side; nothing a hoy
  assert.deepEqual([n.trabajoRealizado, n.trabajoProgramado, n.pasesNetos], [0, 300000, 0]);
  assert.equal(r.cad.meses[10].proyectado, 600000);
  assert.equal(r.pat.disponible, 300000);
});

test('s7: a pase later in the current month is scheduled, not realized', function(){
  var r = trab(300000, false, {'2026-10': [{fecha: '2026-10-20', monto: 300000}]}), f = r.flu(9);
  assert.deepEqual([f.trabajoRealizado, f.trabajoProgramado, f.pasesNetos], [0, 300000, 0]);
  assert.equal(r.cad.resumen.disponibleActual, 0);
  assert.equal(r.cad.resumen.proyectadoAlCierre, 300000);
});

test('s7: no pases: the row is ordinary income with its own checkbox (Q3)', function(){
  var f = trab(300000, true, {}).flu(9);
  assert.deepEqual([f.resultado, f.pasesNetos, f.trabajoRealizado], [300000, 0, 0]);
  var p = trab(300000, false, {}), g = p.flu(9);
  assert.deepEqual([g.resultado, g.ingresosPend], [0, 300000]);
  assert.equal(p.cad.resumen.proyectadoAlCierre, 300000);
  var s = armar(C.vacio(2026), '2026-10-15');   // a year without arrastre is legacy: no Disponible
  assert.equal(s.cad.resumen.sinDisponible, true);
});

test('s7: row larger than the pases: the excess is ordinary income with its own flag', function(){
  var pases = {'2026-10': [{fecha: '2026-10-10', monto: 300000}]};
  var a = trab(400000, false, pases).flu(9), b = trab(400000, true, pases).flu(9);
  assert.deepEqual([a.resultado, a.ingresosPend, a.pasesNetos, a.reconciliar], [0, 100000, 300000, false]);
  assert.deepEqual([b.resultado, b.ingresosPend, b.pasesNetos, b.reconciliar], [100000, 0, 300000, false]);
});

test('s7: row smaller than the pases: the pases win and the month is flagged for reconciliation', function(){
  var r = trab(200000, true, {'2026-10': [{fecha: '2026-10-10', monto: 300000}]}), f = r.flu(9);
  assert.deepEqual([f.trabajoRealizado, f.resultado, f.pasesNetos, f.reconciliar], [300000, 0, 300000, true]);
  assert.deepEqual(r.cad.resumen.reconciliar, [9]);
});
