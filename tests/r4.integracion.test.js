'use strict';
// R4.4 integration: what the SCREEN shows (month card, Trabajo available, net worth) once a year has the balance model.
// Contract: odd/tasks/repair-sprint-1-r4-design.md sections 1, 4, 6, 7 and Q2/Q3/Q4; D4/I6: a year WITHOUT `arrastre`
// (every user before R5) must show exactly what it showed before R4.4.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var base = require('./fixtures/motor-corpus');

var FUNCS = ['dos', 'leerAnio', 'ctxModelo', 'cierreAnioAnterior', 'vistaModelo', 'tilesMes', 'mesDelModelo', 'tieneTilde', 'repartoTrabajo', 'pasesDelMes',
  'hoyISO', 'esISO', 'utcDe', 'sumarDias', 'diasEntre', 'ganancia', 'saldoFac', 'venceFac', 'sinAsignar', 'tieneTrab', 'resumenTrab',
  'paseAlModelo', 'trabajoDisponible', 'patrimonioPantalla'];
function fakeStorage(init){
  var d = {};
  Object.keys(init || {}).forEach(function(k){ d[k] = init[k]; });
  return {d: d, getItem: function(k){ return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function(k, v){ d[k] = String(v); }, removeItem: function(k){ delete d[k]; }};
}
function trab(pases, cobrado){   // a Trabajo store with one collected payment and the given pases ({fecha, monto})
  return {facturas: [], cobros: [{id: 'c1', cliente: '', monto: cobrado || 1000000, fecha: '2026-01-01', forma: 'transferencia', aplic: [], creada: ''}],
    gastos: [], productos: [], tope: 0,
    pases: (pases || []).map(function(p, i){ return {id: 'p' + i, fecha: p.fecha, monto: p.monto, anio: +p.fecha.slice(0, 4), mes: +p.fecha.slice(5, 7) - 1}; })};
}
function nuevaApp(d, T, otros, today){
  var ls = fakeStorage(otros || {});
  var app = la.loadApp({today: today || '2026-10-15', funcs: FUNCS, vars: ['PREF'], globals: {localStorage: ls}});
  app.T = T || {facturas: [], cobros: [], pases: [], gastos: [], productos: [], tope: 0};
  app.D = d ? app.normalizar(C.copy(d), app.hoy) : null;
  return app;
}
function tiles(app, j){ return app.plain(app.tilesMes(app.D, j, app.vistaModelo(app.D, app.hoy))); }
var CAMPOS = ['totalIngresos', 'totalGastos', 'ahorroMesARS', 'disponibleFinal', 'pctGastos', 'pctAhorro', 'ahorroSugerido'];
function pick(o){ var r = {}; CAMPOS.forEach(function(k){ r[k] = o[k]; }); return r; }

// ── legacy isolation (D4, I6): no arrastre -> the card is calc() itself, the net worth is the old patrimonio() ──
test('legacy year: no model view, every month card equals calc() byte for byte, net worth equals the old patrimonio()', function(){
  var n = 0;
  base.datasets().forEach(function(ds){
    var d = ds[1]; if(!d || typeof d !== 'object' || !Array.isArray(d.meses)) return;
    n++;
    var app = nuevaApp(d, trab([{fecha: '2026-10-05', monto: 300000}, {fecha: '2026-11-05', monto: 200000}]));
    assert.equal(app.vistaModelo(app.D, app.hoy), null, ds[0] + ': no model view');
    for(var j = 0; j < 12; j++) assert.deepEqual(tiles(app, j), app.plain(app.calc(app.D.meses[j])), ds[0] + ' month ' + j);
    assert.deepEqual(app.plain(app.patrimonioPantalla(app.D, app.hoy)), app.plain(app.patrimonio(app.D)), ds[0] + ': patrimonio');
  });
  assert.equal(n, 6, 'guard: the 6 year datasets of the corpus were compared (the others are not year blobs)');
});
test('legacy year: "Del trabajo" keeps no checkbox, every other marcable row keeps it', function(){
  var d = C.vacio(2026);
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 50000, false), C.it('Sueldo', 100, true)], gastosFijos: [C.it('Alquiler', 10, true)]});
  var app = nuevaApp(d);
  assert.equal(app.tieneTilde(app.D, 9, 'ingresos', app.D.meses[9].ingresos[0]), false);
  assert.equal(app.tieneTilde(app.D, 9, 'ingresos', app.D.meses[9].ingresos[1]), true);
  assert.equal(app.tieneTilde(app.D, 9, 'gastosFijos', app.D.meses[9].gastosFijos[0]), true);
  assert.equal(app.tilesMes(app.D, 9, null).totalIngresos, 50100, 'legacy "Del trabajo" is always realized (unchanged)');
});
test('legacy destination: a future Trabajo pase still leaves Trabajo available at once (unchanged, it is already income of a legacy month)', function(){
  var d = C.vacio(2026);
  var app = nuevaApp(d, trab([{fecha: '2026-10-05', monto: 300000}, {fecha: '2026-11-05', monto: 200000}]));
  var r = app.resumenTrab();
  assert.equal(r.disponible, 500000);
  assert.equal(r.paraPasar, 500000);
  assert.equal(r.pasadoProgramado, 0);
});

// ── a year with arrastre: the card shows the chain (section 2 of the contract, hoy 2026-10-15) ──
test('section 2: Sep (past) shows its confirmed closing, Oct (current) the available money so far, Nov (future) the projected closing', function(){
  var app = nuevaApp(C.seccion2(false, false));
  assert.deepEqual(pick(tiles(app, 8)), {totalIngresos: 1000000, totalGastos: 600000, ahorroMesARS: 150000, disponibleFinal: 175000,
    pctGastos: 0.6, pctAhorro: 0.15, ahorroSugerido: 100000});
  assert.deepEqual(pick(tiles(app, 9)), {totalIngresos: 1000000, totalGastos: 400000, ahorroMesARS: 0, disponibleFinal: 825000,
    pctGastos: 0.4, pctAhorro: 0, ahorroSugerido: 100000});
  assert.deepEqual(pick(tiles(app, 10)), {totalIngresos: 1000000, totalGastos: 0, ahorroMesARS: 200000, disponibleFinal: 1280000,
    pctGastos: 0, pctAhorro: 0.2, ahorroSugerido: 100000});
  assert.equal(tiles(app, 9).modelo, true);
  assert.equal(app.D.meses[9].metaAhorroPct, 0.1, 'ahorroSugerido = realized income x the default 10% goal');
});
test('a month before arrastre.desde inside a model year keeps calc() (legacy month, I6)', function(){
  var d = C.seccion2(false, false);
  C.mes(d, 7, {ingresos: [C.it('Sueldo', 700000, true), C.it('Del trabajo', 1000, false)], gastosFijos: [C.it('Alquiler', 400000, true)], ahorroMesARS: 10});
  var app = nuevaApp(d);
  for(var j = 0; j < 8; j++) assert.deepEqual(tiles(app, j), app.plain(app.calc(app.D.meses[j])), 'month ' + j);
  assert.equal(app.tieneTilde(app.D, 7, 'ingresos', app.D.meses[7].ingresos[1]), false);
});
test('ticking a pending row of the current month moves the card by exactly that amount', function(){
  var app = nuevaApp(C.seccion2(false, false));
  app.D.meses[9].gastosFijos[1].pagado = true;   // Luz 25.000
  assert.equal(tiles(app, 9).disponibleFinal, 800000);
  assert.equal(tiles(app, 9).totalGastos, 425000);
});

// ── "Del trabajo" (section 7, Q3, Q4) ──
function conTrabajo(){
  var d = C.vacio(2026);
  C.arrastre(d, 9, 100000, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 300000, true), C.it('Sueldo', 500000, true)], gastosFijos: [C.it('Alquiler', 200000, true)]});
  C.mes(d, 10, {ingresos: [C.it('Del trabajo', 200000, true)]});
  return d;
}
var PASES = [{fecha: '2026-10-05', monto: 300000}, {fecha: '2026-11-05', monto: 200000}];
test('Q4: a future Trabajo pase does not leave Trabajo available until its date, and does not raise the current available money', function(){
  var app = nuevaApp(conTrabajo(), trab(PASES));
  var r = app.resumenTrab();
  assert.equal(r.pasadoProgramado, 200000);
  assert.equal(r.disponible, 700000, 'Trabajo keeps the scheduled 200.000');
  assert.equal(r.paraPasar, 500000, 'what can still be passed: the scheduled pase is already committed');
  assert.equal(r.pasado, 500000, 'the pases list total is unchanged');
  var oct = tiles(app, 9), nov = tiles(app, 10);
  assert.equal(oct.totalIngresos, 800000, 'Oct: Sueldo + the realized pase');
  assert.equal(oct.disponibleFinal, 700000, 'Oct: 100.000 + 800.000 - 200.000; the Nov pase is not in it');
  assert.equal(nov.totalIngresos, 200000, 'Nov (scheduled): the pase as programmed income');
  assert.equal(nov.disponibleFinal, 900000, 'Nov projection includes the scheduled pase');
});
test('Q4: a pase dated later in the CURRENT month is scheduled on both sides too', function(){
  var d = conTrabajo(); d.meses[10].ingresos = [];
  d.meses[9].ingresos[0].monto = 500000;
  var app = nuevaApp(d, trab([{fecha: '2026-10-05', monto: 300000}, {fecha: '2026-10-25', monto: 200000}]));
  assert.equal(app.resumenTrab().disponible, 700000);
  assert.equal(tiles(app, 9).disponibleFinal, 700000, 'the Oct 25 pase is not available yet');
  assert.equal(tiles(app, 9).totalIngresos, 800000);
});
test('Q4: a pase into a month BEFORE arrastre.desde of a model year is legacy: it leaves Trabajo at once', function(){
  var app = nuevaApp(conTrabajo(), trab([{fecha: '2026-10-05', monto: 300000}]), {}, '2026-08-15');
  app.D.arrastre.desde = 10;   // Oct becomes a legacy month; hoy is in August, so the pase is future-dated
  assert.equal(app.resumenTrab().disponible, 700000);
  assert.equal(app.resumenTrab().pasadoProgramado, 0);
});
test('Q4: the destination year is read from storage when it is not the open year', function(){
  var otro = conTrabajo(); otro.anio = 2027; otro.arrastre.desde = 0;
  var app = nuevaApp(C.vacio(2026), trab([{fecha: '2027-01-10', monto: 150000}]), {'kibo.datos.2027': JSON.stringify(otro)});
  assert.equal(app.resumenTrab().pasadoProgramado, 150000);
  assert.equal(app.resumenTrab().disponible, 1000000);
  var legacy = nuevaApp(C.vacio(2026), trab([{fecha: '2027-01-10', monto: 150000}]), {'kibo.datos.2027': JSON.stringify(C.vacio(2027))});
  assert.equal(legacy.resumenTrab().disponible, 850000);
});
test('Q3: in a model month a "Del trabajo" row WITHOUT pases is ordinary income with a checkbox; with pases it stays locked', function(){
  var d = conTrabajo();
  d.meses[9].ingresos[0].pagado = false;
  var sinPases = nuevaApp(d, trab([]));
  var row = sinPases.D.meses[9].ingresos[0];
  assert.equal(sinPases.tieneTilde(sinPases.D, 9, 'ingresos', row), true);
  assert.equal(tiles(sinPases, 9).totalIngresos, 500000, 'unticked: pending, not realized');
  row.pagado = true;
  assert.equal(tiles(sinPases, 9).totalIngresos, 800000, 'ticked: realized');
  var conPases = nuevaApp(d, trab(PASES));
  assert.equal(conPases.tieneTilde(conPases.D, 9, 'ingresos', conPases.D.meses[9].ingresos[0]), false);
  assert.equal(tiles(conPases, 9).totalIngresos, 800000, 'with pases the row is the projection of the pases (always realized up to them)');
});

// ── net worth (D7, Q2) ──
test('net worth of a model year: the D7 net in pesos (Trabajo cash included), shown in dollars at the stored cotizacion', function(){
  var app = nuevaApp(C.seccion2(false, false), trab([], 300000));
  var p = app.plain(app.patrimonioPantalla(app.D, app.hoy));
  assert.equal(p.patrimonioARS, 2625000 + 300000);
  assert.equal(p.patrimonioUSD, (2625000 + 300000) / 1500);
  assert.equal(p.ahorroARS, 600000, 'savings a hoy, not at year end');
  assert.equal(p.usd, 1000);
  assert.equal(p.criptoUSD, 0);
  assert.equal(app.trabajoDisponible(), 300000);
});
test('net worth without Trabajo data counts no Trabajo pocket', function(){
  var app = nuevaApp(C.seccion2(false, false));
  assert.equal(app.trabajoDisponible(), 0);
  assert.equal(app.patrimonioPantalla(app.D, app.hoy).patrimonioARS, 2625000);
});

// ── Q4 guard through the real pase sheet validation (review advisory R3-pase-validation-untested) ──
test('Q4: the pase sheet rejects passing money already committed to a scheduled pase (paraPasar, not disponible)', function(){
  var hechos = {errores: [], aplicados: [], monto: 0};
  var g = {
    leerMonto: function(){ return {ok: true, v: hechos.monto}; },
    destinoPase: function(){ return {fecha: '2026-10-20', anio: 2026, mes: 9}; },
    errorEn: function(id, msg){ hechos.errores.push(msg); },
    aplicarPase: function(p){ hechos.aplicados.push(p.monto); return true; },
    anioExiste: function(){ return true; }, guardarTrab: function(){ return true; }, cerrarHoja: function(){}, renderTrabajo: function(){},
    toast: function(){}, MESES: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], tjId: function(){ return 'nuevo'; }, fARS: function(n){ return String(n); },
    document: {getElementById: function(){ return {focus: function(){}}; }}
  };
  var ls = fakeStorage();
  g.localStorage = ls;
  var app = la.loadApp({today: '2026-10-15', funcs: FUNCS.concat(['guardarPase']), vars: ['PREF'], globals: g});
  app.T = trab(PASES);
  app.D = app.normalizar(C.copy(conTrabajo()), app.hoy);
  var r = app.resumenTrab();
  assert.equal(r.disponible, 700000); assert.equal(r.paraPasar, 500000);
  hechos.monto = 600000;   // above paraPasar, at or below disponible: the scheduled 200.000 would be passed twice
  app.guardarPase();
  assert.equal(hechos.aplicados.length, 0, 'nothing is passed');
  assert.equal(app.T.pases.length, 2, 'no pase is recorded');
  assert.match(hechos.errores[0], /Es más de lo que tenés disponible \(500000\)/);
  hechos.monto = 500000; hechos.errores = [];
  app.guardarPase();
  assert.deepEqual(hechos.aplicados, [500000], 'exactly paraPasar can still be passed');
  assert.equal(hechos.errores.length, 0);
});
