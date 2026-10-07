'use strict';
// Payment status data model: explicit flags, legacy migration, cuotas, duplicar.
var test = require('node:test');
var assert = require('node:assert/strict');
var loadApp = require('./load-app').loadApp;

var EXTRA = ['mesesCorridos', 'planDe', 'totalConRecargo', 'valorCuota', 'pagadasHasta', 'pendientesDesde', 'planDeCarga', 'cargarCuotas', 'repartoCuotas'];
var KEYS = ['ingresos', 'gastosFijos', 'gastosVariables', 'deudas'];

function legacyBlob(anio){
  // blob as saved by v1.30.x: no pagado flags, no marker
  var meses = [];
  for(var i = 0; i < 12; i++){
    meses.push({
      ingresos: [{nombre: 'Sueldo', monto: 1000}, {nombre: 'Otros', monto: 0}],
      gastosFijos: [{nombre: 'Alquiler', monto: 300}],
      gastosVariables: [{nombre: 'Super', monto: 100}],
      deudas: [{nombre: 'Prestamo', monto: 50}]
    });
  }
  return {anio: anio, meses: meses};
}

test('mesVacio writes explicit pagado:false on every item', function(){
  var app = loadApp();
  var m = app.mesVacio();
  KEYS.forEach(function(k){
    assert.ok(m[k].length > 0);
    m[k].forEach(function(it){ assert.strictEqual(it.pagado, false, k + '/' + it.nombre); });
  });
});

test('estaPagado is strict: undefined is not paid', function(){
  var app = loadApp({today: '2026-06-15'});
  app.D = {anio: 2026};
  assert.equal(app.estaPagado(2, {monto: 100}), false);
  assert.equal(app.estaPagado(2, {monto: 100, pagado: false}), false);
  assert.equal(app.estaPagado(2, {monto: 0, pagado: true}), true);
  assert.equal(app.estaPagado(2, null), false);
});

test('legacy migration: infers only undefined flags, past/current with amount -> true', function(){
  var app = loadApp({today: '2026-06-15'});   // current month index 5
  var d = app.normalizar(legacyBlob(2026), app.hoy);
  assert.equal(d.pagoExplicito, true);
  [0, 3, 5].forEach(function(j){   // past and current month
    assert.strictEqual(d.meses[j].ingresos[0].pagado, true, 'ingreso con monto, mes ' + j);
    assert.strictEqual(d.meses[j].gastosFijos[0].pagado, true);
    assert.strictEqual(d.meses[j].gastosVariables[0].pagado, true);
    assert.strictEqual(d.meses[j].deudas[0].pagado, true);
    assert.strictEqual(d.meses[j].ingresos[1].pagado, false, 'monto 0 -> false');
  });
  [6, 11].forEach(function(j){   // future months
    assert.strictEqual(d.meses[j].ingresos[0].pagado, false);
    assert.strictEqual(d.meses[j].gastosFijos[0].pagado, false);
  });
});

test('legacy migration uses the blob year, not the open year', function(){
  var app = loadApp({today: '2026-06-15'});
  app.D = {anio: 2030};   // a different year is open while another blob is loaded
  var past = app.normalizar(legacyBlob(2025), app.hoy);
  assert.strictEqual(past.meses[11].gastosFijos[0].pagado, true);
  var future = app.normalizar(legacyBlob(2027), app.hoy);
  assert.strictEqual(future.meses[0].gastosFijos[0].pagado, false);
});

test('legacy migration never changes explicit flags', function(){
  var app = loadApp({today: '2026-06-15'});
  var b = legacyBlob(2026);
  b.meses[1].gastosFijos[0].pagado = false;   // explicit unticked in a past month
  b.meses[8].gastosFijos[0].pagado = true;    // explicit ticked in a future month
  var d = app.normalizar(b, app.hoy);
  assert.strictEqual(d.meses[1].gastosFijos[0].pagado, false);
  assert.strictEqual(d.meses[8].gastosFijos[0].pagado, true);
});

test('migration is one-time: second normalize is a no-op and the marker blocks re-inference', function(){
  var app = loadApp({today: '2026-06-15'});
  var d1 = app.normalizar(legacyBlob(2026), app.hoy);
  var snap = app.plain(d1);
  var d2 = app.normalizar(JSON.parse(JSON.stringify(d1)), app.hoy);
  assert.deepEqual(app.plain(d2), snap);
  var d3 = JSON.parse(JSON.stringify(d1));
  delete d3.meses[2].gastosFijos[0].pagado;
  var n3 = app.normalizar(d3, app.hoy);
  assert.strictEqual(n3.meses[2].gastosFijos[0].pagado, undefined);
  assert.equal(app.estaPagado(2, n3.meses[2].gastosFijos[0]), false);
});

test('JSON round-trip through normalizar keeps true/false', function(){
  var app = loadApp({today: '2026-06-15'});
  var d = app.normalizar({anio: 2026}, app.hoy);
  d.meses[0].ingresos[0].pagado = true;
  d.meses[0].ingresos[0].monto = 10;
  var back = app.normalizar(JSON.parse(JSON.stringify(d)), app.hoy);
  assert.strictEqual(back.meses[0].ingresos[0].pagado, true);
  assert.strictEqual(back.meses[0].ingresos[1].pagado, false);
  assert.strictEqual(back.pagoExplicito, true);
});

test('historical totals of a legacy past-year blob equal the pre-fix plain sums', function(){
  var app = loadApp({today: '2026-06-15'});
  var d = app.normalizar(legacyBlob(2025), app.hoy);   // whole year is in the past
  var s = app.serie(d);
  for(var j = 0; j < 12; j++){
    assert.equal(s[j].totalIngresos, 1000);
    assert.equal(s[j].totalGastos, 400);
    assert.equal(s[j].totalDeudas, 50);
  }
});

test('mesesCorridos: months strictly before the current one', function(){
  var app = loadApp({today: '2026-06-15', funcs: EXTRA});
  assert.equal(app.mesesCorridos(2025, app.hoy), 12);
  assert.equal(app.mesesCorridos(2026, app.hoy), 5);
  assert.equal(app.mesesCorridos(2027, app.hoy), 0);
});

function appConPlan(anio){
  var app = loadApp({today: '2026-06-15', funcs: EXTRA});
  app.D = app.normalizar({anio: anio, planDeudas: {Prestamo: {total: 1200, recargo: 0, cuotas: 12, pagadasAntes: 0}}}, app.hoy);
  return app;
}
function cuota(app, j){ return app.D.meses[j].deudas.filter(function(x){ return x.nombre === 'Prestamo'; })[0]; }

test('cargarCuotas: before current month -> paid, current and future -> pending', function(){
  var app = appConPlan(2026);
  app.cargarCuotas(app.D, 'Prestamo', 0, app.hoy);
  for(var j = 0; j < 12; j++){
    assert.ok(cuota(app, j), 'cuota mes ' + j);
    assert.equal(cuota(app, j).monto, 100);
    assert.strictEqual(cuota(app, j).pagado, j < 5, 'mes ' + j);
  }
});

test('cargarCuotas keeps an existing explicit flag', function(){
  var app = appConPlan(2026);
  app.D.meses[1].deudas.push({nombre: 'Prestamo', monto: 0, pagado: false});   // past month, explicit unpaid
  app.D.meses[7].deudas.push({nombre: 'Prestamo', monto: 0, pagado: true});    // future month, explicit paid
  app.cargarCuotas(app.D, 'Prestamo', 0, app.hoy);
  assert.strictEqual(cuota(app, 1).pagado, false);
  assert.strictEqual(cuota(app, 7).pagado, true);
  assert.equal(cuota(app, 1).monto, 100);
});

test('cargarCuotas in a past year marks every month paid, in a future year none', function(){
  var past = appConPlan(2025);
  past.cargarCuotas(past.D, 'Prestamo', 0, past.hoy);
  for(var j = 0; j < 12; j++) assert.strictEqual(cuota(past, j).pagado, true);
  var fut = appConPlan(2027);
  fut.cargarCuotas(fut.D, 'Prestamo', 0, fut.hoy);
  for(j = 0; j < 12; j++) assert.strictEqual(cuota(fut, j).pagado, false);
});

test('duplicar resets pagado to false, zeroes amounts and keeps the marker', function(){
  var calls = {};
  var app = loadApp({
    today: '2026-12-15',
    funcs: EXTRA.concat(['estadoDeuda', 'duplicar']),
    globals: {
      sucio: false, arrancado: false, obsoleta: false, hayLS: true,
      guardar: function(){}, PREF: 'kibo.datos.', blobAlDia: function(){ return true; }, leerAnio: function(){ return null; }, revGuardada: function(){ return {hay: false, rev: 0}; }, recordarAnio: function(){}, render: function(){},
      alerta: function(t){ calls.alerta = t; }
    }
  });
  var d = app.normalizar(legacyBlob(2026), app.hoy);
  d.meses[0].gastosFijos[0].pagado = true;
  d.meses[3].ingresos[0].pagado = true;
  app.D = d;
  app.duplicar();
  assert.equal(app.D.anio, 2027);
  assert.equal(app.D.pagoExplicito, true);
  var filas = 0;
  app.D.meses.forEach(function(m){
    KEYS.forEach(function(k){
      m[k].forEach(function(it){ assert.strictEqual(it.pagado, false); assert.equal(it.monto, 0); filas++; });
    });
  });
  assert.ok(filas >= 2, 'guard: the copied rows (incl. the two ticked ones) were checked, not an empty year');
  assert.match(calls.alerta, /Listo el 2027/);
});
