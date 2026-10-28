'use strict';
// Last native-review fixes (X2, review-8f5130ab7b3ab443; odd/tasks/stabilization-quick-sales.md "Final audit fixes"). Each block pins one
// finding. No money rule changes: the motor goldens stay byte-identical.
var test = require('node:test');
var assert = require('node:assert/strict');
var H = require('./fixtures/r45-harness');
var C = require('./fixtures/r4-casos');
var V = require('./fixtures/anio-vistas');
var la = require('./load-app');

var M = la.loadMotor(), SRC = la.SRC_FOR_TESTS;

// ── X2-1 (WARNING, money): a pase into a year without the month-to-month balance (legacy) counts only if no later stored year has it.
// inicioDelSaldo let it through when the first later model year starts in January from 'arrastre', but that year follows December live
// only when the previous year itself has the balance: the pase left Trabajo and reached no Disponible (bruto -300.000) ──
var FUNCS1 = V.FUNCS.concat(['resumenTrab', 'paseAlModelo', 'trabajoDisponible', 'patrimonioPantalla', 'tieneTrab', 'hoyISO', 'esISO', 'utcDe', 'sumarDias',
  'diasEntre', 'ganancia', 'saldoFac', 'venceFac', 'sinAsignar', 'repartoTrabajo', 'pasesDelMes', 'tieneTilde', 'previoEnVivo', 'arrastreVivo',
  'carryDiciembre', 'desdeDelSaldo', 'avisoPaseAntes', 'fDiaLargo', 'inicioDelSaldo', 'aniosGuardados'])
  .filter(function(n, i, a){ return a.indexOf(n) === i && new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); });
var VARS1 = ['PREF', 'MESES', 'CORTOS', 'oculto', 'PUNTOS', 'ICOSEC', 'MAS_QUE_LO_NORMAL', 'TOP_CATEGORIAS', 'FORMAS', 'CATS', 'COLCARP'];
function dosD(n){ return (n < 10 ? '0' : '') + n; }
// anios: {AAAA: null (legacy) | {desde, origen}}; the pase of 300.000 goes to dest (its "Del trabajo" row holds it when conPase)
function escenario(anios, dest, conPase){
  var store = {}, fecha = dest.anio + '-' + dosD(dest.mes + 1) + '-10';
  Object.keys(anios).forEach(function(y){
    var d = C.vacio(+y), m = anios[y];
    if(m) C.arrastre(d, m.desde, 100000, m.origen);
    if(conPase && +y === dest.anio) d.meses[dest.mes].ingresos = [C.it('Del trabajo', 300000, true)];
    store['kibo.datos.' + y] = JSON.stringify(M.normalizar(C.copy(d), C.hoy('2026-10-15')));
  });
  var a = la.loadApp({today: '2026-10-15', funcs: FUNCS1, vars: VARS1, globals: {localStorage: H.fakeStorage(store), document: {getElementById: function(){ return null; }}}});
  a.T = H.trab(conPase ? [{fecha: fecha, monto: 300000}] : [], 1000000); a.D = a.leerAnio(2026); a.tieneTrab = function(){ return true; };
  var p = a.plain(a.patrimonioPantalla(a.D, a.hoy)).modelo;
  return {bruto: p ? p.bruto : null, aviso: a.avisoPaseAntes({fecha: fecha, anio: dest.anio, mes: dest.mes}), inicio: a.plain(a.inicioDelSaldo(dest.anio, dest.mes))};
}
var MES = {0: 'Enero', 9: 'Octubre'};
var DIC25 = {anio: 2025, mes: 11}, JAN26 = {anio: 2026, mes: 0};
// [name, years, destination, expected start of the balance (null: allowed)]
var CASOS = [
  ['legacy 2025, then 2026 declared from January', {2025: null, 2026: {desde: 0, origen: 'declarado'}}, DIC25, JAN26],
  ['legacy 2025, then 2026 omitted from January', {2025: null, 2026: {desde: 0, origen: 'omitido'}}, DIC25, JAN26],
  ['legacy 2025, then 2026 from the December carry (arrastre)', {2025: null, 2026: {desde: 0, origen: 'arrastre'}}, DIC25, JAN26],
  ['same, a June 2025 pase', {2025: null, 2026: {desde: 0, origen: 'arrastre'}}, {anio: 2025, mes: 5}, JAN26],
  ['legacy 2024, no 2025, then 2026 arrastre (gap of 2 years)', {2024: null, 2026: {desde: 0, origen: 'arrastre'}}, {anio: 2024, mes: 11}, JAN26],
  ['legacy 2024 and 2025, then 2026 arrastre', {2024: null, 2025: null, 2026: {desde: 0, origen: 'arrastre'}}, {anio: 2024, mes: 11}, JAN26],
  ['legacy 2025, then 2026 declared from October', {2025: null, 2026: {desde: 9, origen: 'declarado'}}, DIC25, {anio: 2026, mes: 9}],
  ['the model year itself, from January (arrastre)', {2025: null, 2026: {desde: 0, origen: 'arrastre'}}, JAN26, null],
  ['the model year itself, a month from desde', {2026: {desde: 9, origen: 'declarado'}}, {anio: 2026, mes: 9}, null],
  ['the model year itself, a month before desde', {2026: {desde: 9, origen: 'declarado'}}, {anio: 2026, mes: 8}, {anio: 2026, mes: 9}]
];
test('X2-1: case table: every pase that is allowed keeps Trabajo + Disponible (bruto) unchanged; every other one is refused', function(){
  CASOS.forEach(function(c){
    var sin = escenario(c[1], c[2], false), con = escenario(c[1], c[2], true);
    assert.deepEqual(con.inicio, c[3], c[0] + ': start of the balance');
    if(c[3] === null){
      assert.equal(con.aviso, '', c[0] + ': allowed');
      assert.equal(con.bruto - sin.bruto, 0, c[0] + ': nothing appears or disappears');
    } else {
      assert.match(con.aviso, new RegExp('es anterior a ' + MES[c[3].mes] + ' ' + c[3].anio + ', desde cuando llevás el saldo mes a mes'), c[0] + ': refused');
      assert.notEqual(con.bruto - sin.bruto, 0, c[0] + ': (why) it would change the bruto');
    }
  });
});
test('X2-1: with no later year that has the month-to-month balance (pure legacy), a pase into a legacy year is allowed as before', function(){
  [{2025: null, 2026: null}, {2024: null, 2025: null, 2026: null}].forEach(function(anios){
    var con = escenario(anios, DIC25, true);
    assert.equal(con.inicio, null);
    assert.equal(con.aviso, '');
  });
});
