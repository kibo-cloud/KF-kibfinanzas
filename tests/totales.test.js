'use strict';
// Realized totals: only paid/collected items count; pending is exposed separately.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var app = loadApp({today: '2026-06-15'});

function mes(){
  var m = app.mesVacio();
  m.ingresos = [{nombre: 'Sueldo', monto: 0, pagado: false}, {nombre: 'Otros', monto: 0, pagado: false}];
  m.gastosFijos = [{nombre: 'Alquiler', monto: 0, pagado: false}];
  m.gastosVariables = [{nombre: 'Super', monto: 0, pagado: false}];
  m.deudas = [{nombre: 'Prestamo', monto: 0, pagado: false}];
  return m;
}

test('pending income does not add to realized; collected income does', function(){
  var m = mes();
  m.ingresos[0].monto = 1000;
  var c = app.calc(m);
  assert.equal(c.totalIngresos, 0);
  assert.equal(c.pendienteIngresos, 1000);
  assert.equal(c.disponibleFinal, 0);
  m.ingresos[0].pagado = true;
  c = app.calc(m);
  assert.equal(c.totalIngresos, 1000);
  assert.equal(c.pendienteIngresos, 0);
  assert.equal(c.disponibleFinal, 1000);
});

test('pending expenses do not subtract; paid fijos, variables and deudas do', function(){
  var m = mes();
  m.ingresos[0].monto = 1000; m.ingresos[0].pagado = true;
  m.gastosFijos[0].monto = 300;
  m.gastosVariables[0].monto = 200;
  m.deudas[0].monto = 100;
  var c = app.calc(m);
  assert.equal(c.totalGastos, 0);
  assert.equal(c.totalDeudas, 0);
  assert.equal(c.disponibleFinal, 1000);
  assert.equal(c.pendienteFijos, 300);
  assert.equal(c.pendienteVariables, 200);
  assert.equal(c.pendienteGastos, 500);
  assert.equal(c.pendienteDeudas, 100);
  m.gastosFijos[0].pagado = true;
  c = app.calc(m);
  assert.equal(c.subtotalFijos, 300);
  assert.equal(c.totalGastos, 300);
  assert.equal(c.disponibleFinal, 700);
  m.gastosVariables[0].pagado = true;
  c = app.calc(m);
  assert.equal(c.subtotalVariables, 200);
  assert.equal(c.totalGastos, 500);
  assert.equal(c.disponibleFinal, 500);
  m.deudas[0].pagado = true;
  c = app.calc(m);
  assert.equal(c.totalDeudas, 100);
  assert.equal(c.disponibleLibre, 500);
  assert.equal(c.disponibleFinal, 400);
});

test('derived metrics follow realized income and expenses', function(){
  var m = mes();
  m.metaAhorroPct = 0.1;
  m.ahorroMesARS = 50;
  m.ingresos[0].monto = 1000;
  m.gastosFijos[0].monto = 400; m.gastosFijos[0].pagado = true;
  var c = app.calc(m);   // income still pending
  assert.equal(c.pctGastos, 0);
  assert.equal(c.ahorroSugerido, 0);
  m.ingresos[0].pagado = true;
  c = app.calc(m);
  assert.equal(c.pctGastos, 0.4);
  assert.equal(c.pctAhorro, 0.05);
  assert.equal(c.ahorroSugerido, 100);
});

test('toggling pending -> paid applies impact once; paid -> pending reverts', function(){
  var m = mes();
  m.gastosFijos[0].monto = 300;
  var it = m.gastosFijos[0];
  assert.equal(app.calc(m).totalGastos, 0);
  assert.equal(app.alternarPago(2, it), true);
  assert.equal(app.calc(m).totalGastos, 300);
  assert.equal(app.calc(m).totalGastos, 300);   // stateless: recomputing does not double-apply
  assert.equal(app.alternarPago(2, it), false);
  assert.equal(app.calc(m).totalGastos, 0);
});

test('repeated paid->paid and pending->pending do not double-apply', function(){
  var m = mes();
  m.gastosFijos[0].monto = 300;
  m.gastosFijos[0].pagado = true;
  m.gastosFijos[0].pagado = true;
  for(var i = 0; i < 3; i++) assert.equal(app.calc(m).totalGastos, 300);
  m.gastosFijos[0].pagado = false;
  m.gastosFijos[0].pagado = false;
  for(i = 0; i < 3; i++) assert.equal(app.calc(m).totalGastos, 0);
  // an even number of toggles returns to the starting state
  var it = m.gastosFijos[0];
  for(i = 0; i < 4; i++) app.alternarPago(0, it);
  assert.equal(app.calc(m).totalGastos, 0);
});

test('editing the amount while pending leaves realized unchanged', function(){
  var m = mes();
  m.gastosFijos[0].monto = 300;
  m.gastosFijos[0].monto = 450;
  assert.equal(app.calc(m).totalGastos, 0);
  assert.equal(app.calc(m).pendienteGastos, 450);
});

test('editing the amount while paid updates realized by the difference', function(){
  var m = mes();
  m.gastosFijos[0].monto = 300; m.gastosFijos[0].pagado = true;
  var antes = app.calc(m).totalGastos;
  m.gastosFijos[0].monto = 450;
  assert.equal(app.calc(m).totalGastos - antes, 150);
});

test('deleting a pending item leaves realized unchanged; deleting a paid one changes it', function(){
  var m = mes();
  m.gastosFijos = [{nombre: 'A', monto: 100, pagado: true}, {nombre: 'B', monto: 70, pagado: false}];
  assert.equal(app.calc(m).totalGastos, 100);
  m.gastosFijos.splice(1, 1);   // pending
  assert.equal(app.calc(m).totalGastos, 100);
  m.gastosFijos.splice(0, 1);   // paid
  assert.equal(app.calc(m).totalGastos, 0);
});

test('sueldo collected / not collected', function(){
  var m = mes();
  m.ingresos[0].monto = 500;
  assert.equal(app.calc(m).totalIngresos, 0);
  app.alternarPago(0, m.ingresos[0]);
  assert.equal(app.calc(m).totalIngresos, 500);
});

test('Del trabajo income always counts, regardless of its flag', function(){
  var m = mes();
  m.ingresos.push({nombre: 'Del trabajo', monto: 300, pagado: false});
  m.ingresos.push({nombre: 'del  TRABAJO', monto: 20});   // no flag at all, other spelling
  var c = app.calc(m);
  assert.equal(c.totalIngresos, 320);
  assert.equal(c.pendienteIngresos, 0);
});

test('suma stays the registered total (paid or not)', function(){
  var m = mes();
  m.gastosFijos = [{nombre: 'A', monto: 100, pagado: true}, {nombre: 'B', monto: 70, pagado: false}];
  assert.equal(app.suma(m.gastosFijos), 170);
});

test('MARCABLE covers ingresos, fijos, variables and deudas', function(){
  ['ingresos', 'gastosFijos', 'gastosVariables', 'deudas'].forEach(function(k){ assert.equal(app.MARCABLE[k], true, k); });
});

test('serie accumulations use realized values', function(){
  var d = app.normalizar({anio: 2027}, app.hoy);
  d.meses[0].ingresos[0].monto = 1000;
  d.meses[0].gastosFijos[0].monto = 200;
  d.meses[0].ahorroMesARS = 100;
  var s = app.serie(d);
  assert.equal(s[0].totalIngresos, 0);   // pending
  assert.equal(s[0].totalGastos, 0);
  assert.equal(s[0].pendienteIngresos, 1000);
  assert.equal(s[0].ahorroAcumulado, 100);   // saving is not tied to the checkbox
  d.meses[0].ingresos[0].pagado = true;
  d.meses[0].gastosFijos[0].pagado = true;
  s = app.serie(d);
  assert.equal(s[0].totalIngresos, 1000);
  assert.equal(s[0].totalGastos, 200);
  assert.equal(s[0].disponibleFinal, 1000 - 200 - 100);
});

test('gasto rapido: empty target becomes paid, pending positive target keeps its status', function(){
  var vacio = {nombre: 'Super', monto: 0, pagado: false};
  app.sumarAItem(vacio, 50);
  assert.equal(vacio.monto, 50);
  assert.strictEqual(vacio.pagado, true);
  var pendiente = {nombre: 'Luz', monto: 300, pagado: false};
  app.sumarAItem(pendiente, 50);
  assert.equal(pendiente.monto, 350);
  assert.strictEqual(pendiente.pagado, false);
  var pagado = {nombre: 'Gas', monto: 100, pagado: true};
  app.sumarAItem(pagado, 20);
  assert.equal(pagado.monto, 120);
  assert.strictEqual(pagado.pagado, true);
});

test('legacy blob keeps its pre-fix totals through normalizar + calc (past and current months)', function(){
  var meses = [];
  for(var i = 0; i < 12; i++) meses.push({ingresos: [{nombre: 'Sueldo', monto: 1000}], gastosFijos: [{nombre: 'Alquiler', monto: 300}], gastosVariables: [{nombre: 'Super', monto: 100}], deudas: [{nombre: 'P', monto: 50}]});
  var s = app.serie(app.normalizar({anio: 2026, meses: meses}, app.hoy));   // today = June 2026
  for(var j = 0; j <= 5; j++){
    assert.equal(s[j].totalIngresos, 1000, 'mes ' + j);
    assert.equal(s[j].totalGastos, 400);
    assert.equal(s[j].totalDeudas, 50);
  }
  for(j = 6; j < 12; j++){   // future months: loaded amounts are now pending
    assert.equal(s[j].totalIngresos, 0);
    assert.equal(s[j].pendienteIngresos, 1000);
  }
});
