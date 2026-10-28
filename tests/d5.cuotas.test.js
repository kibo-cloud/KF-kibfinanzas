'use strict';
// D5 (owner-decisions-closure, N1-B): creating next year before December must not count installments ticked AHEAD (in months of the
// model that have not arrived) as paid. H1's live carry re-reads December of the stored previous year, but it counted every ticked
// installment of the 12 months (estadoDeuda up to December), so it did NOT resolve N1-B. Option (b): in a model year only the realized
// months count (a ticked future month is "programado", as everywhere else in the model); legacy years count the 12 months as before.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var H = require('./fixtures/r45-harness');
var C = require('./fixtures/r4-casos');
var V = require('./fixtures/anio-vistas');

var M = la.loadMotor();
var SRC = la.SRC_FOR_TESTS;
var FUNCS = V.FUNCS.concat(['resumenTrab', 'paseAlModelo', 'trabajoDisponible', 'patrimonioPantalla', 'tieneTrab', 'hoyISO', 'esISO', 'utcDe',
  'sumarDias', 'diasEntre', 'ganancia', 'saldoFac', 'venceFac', 'sinAsignar', 'repartoTrabajo', 'pasesDelMes', 'tieneTilde', 'modoApertura',
  'derivaAnioPrevio', 'avisoDerivaPrevio', 'previoEnVivo', 'arrastreVivo', 'carryDiciembre', 'cuotasProgramadas', 'cuotasDeMas', 'cuotasRealizadas', 'esProgramado', 'mesDelModelo'])
  .filter(function(n, i, a){ return a.indexOf(n) === i && new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); });
var VARS = ['PREF', 'MESES', 'CORTOS', 'oculto', 'PUNTOS', 'ICOSEC', 'MAS_QUE_LO_NORMAL', 'TOP_CATEGORIAS', 'FORMAS', 'CATS', 'COLCARP'];

function vista(store, today){
  var app = la.loadApp({today: today, funcs: FUNCS, vars: VARS,
    globals: {localStorage: H.fakeStorage(store), document: {getElementById: function(){ return null; }}, descargar: function(){}}});
  app.T = C.copy(H.TRAB_VACIO);
  app.D = app.leerAnio(2027);
  return app;
}
function crear(raw26, creado){
  var y26 = M.normalizar(C.copy(raw26), C.hoy(creado));
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, creado);
  H.cargarEn(app, ls, 2026); app.duplicar();
  return ls.d;
}
// seccion2: a 6-installment plan, 3 paid by October; here November's installment is ticked AHEAD (data from before the N3b-A block)
function conAdelantada(raw){ raw.meses[10].deudas.forEach(function(x){ if(x.nombre === 'Préstamo') x.pagado = true; }); return raw; }

test('D5 2027 created in October from a model year: the installment ticked ahead in November is not counted as paid', function(){
  var store = crear(conAdelantada(C.seccion2(false, false)), '2026-10-15'), n = JSON.parse(store['kibo.datos.2027']);
  assert.equal(n.planDeudas['Préstamo'].pagadasAntes, 3, 'before D5: 4 (the ticked-ahead November counted)');
  assert.equal(n.copiaDiciembre.cuotas['Préstamo'], 3, 'the December snapshot says the same');
  assert.equal(n.meses.filter(function(m){ return m.deudas.some(function(x){ return x.nombre === 'Préstamo' && x.monto > 0; }); }).length, 1,
    'the ticked-ahead November is scheduled in 2026 (cuotasProgramadas): 6 - 3 paid - 2 still in 2026 = 1 row in 2027, as before D5');
  var a = vista(store, '2026-10-20');
  assert.equal(a.D.planDeudas['Préstamo'].pagadasAntes, 3, 'H1 live carry before November: still 3');
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), [], 'no "Diciembre cambió" notice');
  var b = vista(store, '2027-01-10');
  assert.equal(b.D.planDeudas['Préstamo'].pagadasAntes, 4, 'once November is realized, the tick counts (live carry)');
  assert.deepEqual(b.plain(b.derivaAnioPrevio(b.D, b.hoy)), [], 'following December is not a user change: no notice');
  assert.deepEqual([a.plain(a.cuotasDeMas(a.D)), b.plain(b.cuotasDeMas(b.D))], [[], []], 'no installment named as loaded twice');
});

test('D5 legacy years are unchanged: a year created from a legacy December counts every ticked installment, as before', function(){
  var store = crear(H.sinModelo(conAdelantada(C.seccion2(false, false))), '2026-10-15'), n = JSON.parse(store['kibo.datos.2027']);
  assert.equal(n.planDeudas['Préstamo'].pagadasAntes, 4);
});

test('D5 cuotasRealizadas: the 12 months in a legacy year; only realized months in a model year', function(){
  var hoy = C.hoy('2026-10-15');
  var mod = M.normalizar(C.copy(conAdelantada(C.seccion2(false, false))), hoy), leg = M.normalizar(C.copy(H.sinModelo(conAdelantada(C.seccion2(false, false)))), hoy);
  var a = vista({'kibo.datos.2026': JSON.stringify(mod)}, '2026-10-15');
  assert.deepEqual([a.cuotasRealizadas(mod, 'Préstamo', hoy), a.cuotasRealizadas(leg, 'Préstamo', hoy), a.cuotasRealizadas(mod, 'No existe', hoy)], [3, 4, null]);
  assert.equal(a.cuotasRealizadas(mod, 'Préstamo', C.hoy('2026-11-02')), 4, 'November arrived');
});
