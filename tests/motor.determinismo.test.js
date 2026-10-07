'use strict';
// I7 (R4.1): same data + same explicit `hoy` => same outputs, whatever the system clock says.
// The motor is evaluated in two vm contexts whose fake system clocks differ; every temporal function must agree.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var corpus = require('./fixtures/motor-corpus');

var A = la.loadMotor({today: '2020-01-01'});
var B = la.loadMotor({today: '2030-06-15'});
var HOY = {anio: 2026, mes: 9, dia: 4, iso: '2026-10-04'};
function copy(x){ return JSON.parse(JSON.stringify(x)); }

function run(m, raw){
  var hoy = m.hoyDe(new Date(2026, 9, 4, 12, 0, 0));
  var d = m.normalizar(copy(raw), hoy), out = {norm: copy(d)};
  out.serie = m.serie(d, hoy);
  out.patrimonio = m.patrimonio(d, hoy);
  out.proyeccion = m.proyeccionDeudas(d, hoy);
  out.estado = {};
  Object.keys(d.planDeudas).forEach(function(n){
    out.estado[n] = [0, 3, 6, 9, 11].map(function(i){ return m.estadoDeuda(d, n, i, hoy); });
    out.cargar = out.cargar || {};
    out.cargar[n] = [0, 4, 9].map(function(desde){ var c = copy(d), pc = m.cargarCuotas(c, n, desde, hoy); return [pc, c.meses.map(function(x){ return x.deudas; })]; });
  });
  out.mesTope = [2024, 2025, 2026, 2027, 2028].map(function(a){ return m.mesTope(a, hoy); });
  out.mesesCorridos = [2024, 2025, 2026, 2027, 2028].map(function(a){ return m.mesesCorridos(a, hoy); });
  return out;
}

['mixed2026', 'mixed2025', 'mixed2027', 'legacy2026', 'legacy2025', 'legacy2027'].forEach(function(nombre){
  test('determinism: ' + nombre + ' is identical under two different system clocks', function(){
    var raw = corpus.datasets().filter(function(e){ return e[0] === nombre; })[0][1];
    assert.equal(corpus.canon(run(A, raw)), corpus.canon(run(B, raw)));
  });
});

test('determinism: the output follows hoy, not the clock', function(){
  var raw = corpus.datasets()[3][1];   // legacy2026
  var h1 = A.hoyDe(new Date(2026, 2, 10, 12)), h2 = A.hoyDe(new Date(2026, 8, 10, 12));
  var d1 = A.normalizar(copy(raw), h1), d2 = A.normalizar(copy(raw), h2);
  assert.notEqual(corpus.canon(d1), corpus.canon(d2));
  // the hoy used by run() is exactly the documented evaluation date
  assert.deepEqual(copy(A.hoyDe(new Date(2026, 9, 4, 12, 0, 0))), HOY);
});
