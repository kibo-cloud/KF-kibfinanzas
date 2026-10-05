'use strict';
// Characterization of the behaviors R2 changed. They were written as "[R2 will change]" pins of the
// known-buggy behavior (R1) and renamed "[R2 fixed]" with the new expectation when each fix landed
// (RED before, GREEN after).
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var app = loadApp({
  today: '2026-06-15',
  funcs: ['sinSigno', 'cerosFuera', 'parseMonto', 'esc', 'hayDatos', 'cargarCuotas', 'planDeCarga', 'pendientesDesde', 'pagadasHasta', 'planDe',
          'valorCuota', 'totalConRecargo', 'estadoDeuda', 'mesesCorridos', 'repartoCuotas', 'cuotaPaga', 'estaPagado'],
  globals: {tieneTrab: function(){ return false; }}
});

function freshD(){
  var meses = [];
  for(var i = 0; i < 12; i++) meses.push(app.mesVacio());
  return {anio: 2026, meses: meses, planDeudas: {}};
}

test('[R2 fixed] parseMonto E4: ambiguous and exotic input is rejected, not guessed', function(){
  assert.equal(app.parseMonto('0.001'), 0.001);    // was 1 (dot treated as thousands)
  assert.ok(Number.isNaN(app.parseMonto('1e3')));  // was 13 (letters stripped)
  assert.ok(Number.isNaN(app.parseMonto('12.5,3'))); // was 125.3
  assert.equal(app.parseMonto('1.234'), 1234);     // grouped thousands, unchanged
  assert.equal(app.parseMonto('1,5'), 1.5);
  assert.equal(app.parseMonto('1.234,56'), 1234.56);
});

test('[R2 fixed] esc S6: single quote is escaped', function(){
  assert.equal(app.esc("'"), '&#39;');
  assert.equal(app.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
});

test('[R2 fixed] hayDatos E1: registered data counts even when nothing is ticked', function(){
  app.D = freshD();
  assert.equal(app.hayDatos(app.D, false), false);
  app.D.meses[5].ingresos = [{nombre: 'Sueldo', monto: 100000, pagado: false}];
  app.D.meses[5].gastosFijos = [{nombre: 'Alquiler', monto: 30000, pagado: false}];
  assert.equal(app.hayDatos(app.D, false), true);
  app.D.meses[5].ingresos[0].pagado = true;   // ticking does not change it
  assert.equal(app.hayDatos(app.D, false), true);
});

test('[R2 fixed] hayDatos E1: any month flow field is registered data', function(){
  ['ahorroMesARS', 'ahorroMesUSD', 'compraARS', 'compraUSD', 'retiroARS', 'ventaUSD', 'ventaARS', 'reposicionARS'].forEach(function(f){
    app.D = freshD();
    app.D.meses[3][f] = 5;
    assert.equal(app.hayDatos(app.D, false), true, f);
  });
});

test('[R2 fixed] hayDatos E1: empty year and zero amounts are not data', function(){
  app.D = freshD();
  app.D.meses[2].ingresos = [{nombre: 'Sueldo', monto: 0, pagado: true}];   // ticked but zero
  assert.equal(app.hayDatos(app.D, false), false);
});

test('[R2 fixed] hayDatos E1: Trabajo data counts', function(){
  var a = loadApp({today: '2026-06-15', funcs: ['hayDatos'], globals: {tieneTrab: function(){ return true; }}});
  a.D = {meses: []};
  assert.equal(a.hayDatos(a.D, true), true);
});

test('[R2 fixed] cargarCuotas E14: 100000 in 3 installments loads 33333, 33333, 33334 (sum 100000)', function(){
  app.D = freshD();
  app.D.planDeudas.Tarjeta = {total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0};
  var pc = app.cargarCuotas(app.D, 'Tarjeta', 6, app.hoy);
  assert.equal(pc.poner, 3);
  var vals = [6, 7, 8].map(function(j){ return app.D.meses[j].deudas.filter(function(x){ return x.nombre === 'Tarjeta'; })[0].monto; });
  assert.deepEqual(app.plain(vals), [33333, 33333, 33334]);
  assert.equal(vals[0] + vals[1] + vals[2], 100000);
});

test('[R2 fixed] estadoDeuda E9: a ticked month with monto 0 does not count as a paid installment', function(){
  app.D = freshD();
  app.D.planDeudas.Tarjeta = {total: 30000, recargo: 0, cuotas: 3, pagadasAntes: 0};
  app.D.meses[0].deudas = [{nombre: 'Tarjeta', monto: 0, pagado: true}];
  var e = app.estadoDeuda(app.D, 'Tarjeta', 0, app.hoy);
  assert.equal(e.pagadas, 0);
  assert.equal(e.restantes, 3);
});
