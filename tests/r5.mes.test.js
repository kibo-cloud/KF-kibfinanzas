'use strict';
// R5 part 2 (night run N3b): the month screen of a model year.
// (1) "Del trabajo" above its pases (R4.2 interpretation 4, design §7, L-02): what the row keeps beyond its pases is ordinary income with its
//     own tilde; the part the pases cover stays always realized. flujosMes already implements the money rule; this is presentation only.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
var SRC = la.SRC_FOR_TESTS;
function existe(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); }
var FUNCS = ['seccion', 'abierta', 'fARS', 'grupos', 'esc', 'filaTope', 'textoDeuda', 'repartoTrabajo', 'esProgramado', 'gastadoVista', 'datosRealizados',
  'htmlTorta', 'pasadas', 'textoTopes'].filter(existe);
var VARS = ['ICOSEC', 'MARCABLE', 'TOPEABLE', 'MESES', 'oculto', 'PUNTOS', 'TORTA_MAX', 'SECS'].filter(function(v){ return new RegExp('^var ' + v + '\\s*=', 'm').test(SRC); });

// the month screen of `d` with Trabajo store T; j = the month shown
function appMes(d, T, j, today){
  var app = H.appVista(d, T, null, today, {funcs: FUNCS, vars: VARS});
  if(j !== undefined) app.mes = j;
  return app;
}
function sec(app, k){ var S = app.SECS.filter(function(s){ return s.k === k; })[0]; return app.seccion(S, app.D.meses[app.mes]); }
function vm(app){ return app.vistaModelo(app.D, app.hoy); }
function excesoOct(monto, pagado){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); C.mes(d, 9, {ingresos: [C.it('Del trabajo', monto, !!pagado)]});
  return appMes(d, H.trab([{fecha: '2026-10-10', monto: 300000}]), 9);
}

// ── (1) "Del trabajo" above its pases ──
test('Del trabajo above its pases: the excess gets its own tilde; ticking it realizes exactly the excess (flujosMes)', function(){
  var app = excesoOct(400000), row = app.D.meses[9].ingresos[0];
  assert.equal(app.tieneTilde(app.D, 9, 'ingresos', row), true, 'a checkbox for the excess');
  assert.deepEqual(app.plain(app.repartoTrabajo(app.D, 9, row)), {pases: 300000, exceso: 100000});
  var f = M.flujosMes(app.D, 9, app.hoy, vm(app).ctx);
  assert.deepEqual([f.trabajoRealizado, f.ingresosReal, f.ingresosPend, vm(app).cad.resumen.disponibleActual], [300000, 0, 100000, 300000], 'unticked: the excess is pending');
  row.pagado = true;
  f = M.flujosMes(app.D, 9, app.hoy, vm(app).ctx);
  assert.deepEqual([f.trabajoRealizado, f.ingresosReal, f.ingresosPend, vm(app).cad.resumen.disponibleActual], [300000, 100000, 0, 400000], 'ticked: realized, the pase part unchanged');
  assert.equal(H.tiles(app, 9).totalIngresos, 400000, 'card Ingresos = pases + ticked excess');
});

test('Del trabajo covered by its pases (row = pases or below): no tilde, as before; a legacy month never has one', function(){
  [300000, 250000].forEach(function(m){
    var app = excesoOct(m), row = app.D.meses[9].ingresos[0];
    assert.equal(app.tieneTilde(app.D, 9, 'ingresos', row), false, m + ': covered by pases');
    assert.equal(app.repartoTrabajo(app.D, 9, row).exceso, 0);
  });
  var leg = C.vacio(2026); C.mes(leg, 9, {ingresos: [C.it('Del trabajo', 400000, false)]});
  var a = appMes(leg, H.trab([{fecha: '2026-10-10', monto: 300000}]), 9);
  assert.equal(a.tieneTilde(a.D, 9, 'ingresos', a.D.meses[9].ingresos[0]), false, 'legacy month: unchanged');
});

test('Del trabajo with two rows: the pases cover them in order, like flujosMes; only the uncovered part of each row is tickable', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 200000, false), C.it('Sueldo', 50000, true), C.it('Del Trabajo ', 250000, false)]});
  var app = appMes(d, H.trab([{fecha: '2026-10-10', monto: 300000}]), 9), ls = app.D.meses[9].ingresos;
  assert.deepEqual(app.plain(app.repartoTrabajo(app.D, 9, ls[0])), {pases: 200000, exceso: 0});
  assert.deepEqual(app.plain(app.repartoTrabajo(app.D, 9, ls[2])), {pases: 100000, exceso: 150000});
  assert.deepEqual([app.tieneTilde(app.D, 9, 'ingresos', ls[0]), app.tieneTilde(app.D, 9, 'ingresos', ls[2])], [false, true]);
  ls[2].pagado = true;
  var f = M.flujosMes(app.D, 9, app.hoy, vm(app).ctx);
  assert.equal(f.ingresosReal, 50000 + 150000, 'the ticked excess is exactly what flujosMes realizes');
  assert.equal(f.ingresosPend, 0);
});

test('Del trabajo above its pases on screen: checkbox, the row stays read-only, and the split is said in plain words', function(){
  var app = excesoOct(400000), h = sec(app, 'ingresos');
  assert.match(h, /<button class="chk" data-act="pagar" data-k="ingresos" data-i="0" aria-label="Marcar como cobrado">/);
  assert.match(h, /class="nombre" data-k="ingresos" data-i="0" value="Del trabajo" aria-label="Nombre" readonly>/, 'still read-only (Trabajo changes it)');
  assert.match(h, /De esto, \$300\.000 vino de pases del trabajo; el resto, \$100\.000, lo marcás vos\./);
  app.D.meses[9].ingresos[0].pagado = true;
  assert.match(sec(app, 'ingresos'), /<div class="item pago deltrab">.*<button class="chk on" data-act="pagar"/);
  var cub = excesoOct(300000), hc = sec(cub, 'ingresos');
  assert.doesNotMatch(hc, /data-act="pagar"/, 'covered row: no checkbox');
  assert.doesNotMatch(hc, /lo marcás vos/);
  assert.match(hc, /Viene de Trabajo: lo que pasaste a lo personal este mes/);
});
