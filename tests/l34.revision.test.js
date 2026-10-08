'use strict';
// L3/L4 review fixes (independent review of ae166a3..a113e68):
//  1. undoing an L3 "Sí" reverses only that payment (later quick expenses or manual edits of the same row survive, in any undo order);
//  2. "Copiar los montos de <mes>" skips the one-off "<fila> (otro gasto)" rows (money already spent, not a plan);
//  3. the backup reminder counts data in any stored year, not only the open one.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

function plain(x){ return JSON.parse(JSON.stringify(x)); }
function filas(l){ return plain(l).map(function(it){ return [it.nombre, it.monto, it.pagado]; }); }
var FUNCS = ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte',
  'filaDelGasto', 'anotarMov', 'copiarAnterior', 'esGastoAparte'];
function app(raw, mes){
  var toasts = [];
  var a = H.appVista(raw, null, null, null, {funcs: FUNCS, vars: ['gr', 'MESES'],
    globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
      abrirHoja: function(){}, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){},
      toast: function(t, ac, act, id){ toasts.push([t, id]); }}});
  a.toasts = toasts; a.mes = mes;
  return a;
}
function gasto(a, monto){ a.gr = {monto: monto, cat: 0, sec: 'gastosVariables'}; a.sumarGasto(); return a.toasts.length; }
function ultimoId(a){ return a.toasts[a.toasts.length - 1][1]; }
function octubre(monto){ var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado'); C.mes(d, 9, {gastosVariables: [C.it('Super', monto, false)]}); return d; }
function fila(a){ return filas(a.D.meses[9].gastosVariables); }

[['first', [0, 1]], ['second', [1, 0]]].forEach(function(caso){
  test('L3 review 1: "Sí" (Dejar) then another quick expense on the same row; undo the ' + caso[0] + ' one first ends at the plan, pending', function(){
    var a = app(octubre(50000), 9), ids = [];
    gasto(a, 50000); a.gastoEsPago(); ids.push(ultimoId(a));
    assert.deepEqual(fila(a), [['Super', 50000, true]]);
    gasto(a, 10000); ids.push(a.D.meses[9].movimientos[1].id);
    assert.deepEqual(fila(a), [['Super', 60000, true]]);
    a.quitarMov(ids[caso[1][0]]);
    assert.deepEqual(fila(a), caso[1][0] === 0 ? [['Super', 60000, false]] : [['Super', 50000, true]], 'only that movement is reversed');
    a.quitarMov(ids[caso[1][1]]);
    assert.deepEqual(fila(a), [['Super', 50000, false]]);
    assert.equal(a.D.meses[9].movimientos.length, 0);
  });
  test('L3 review 1: "Sí" + "Cambiar a" then another quick expense; undo the ' + caso[0] + ' one first ends at the plan, pending', function(){
    var a = app(octubre(50000), 9), ids = [];
    gasto(a, 20000); a.gastoEsPago(); a.marcarPago(true); ids.push(ultimoId(a));
    assert.deepEqual(fila(a), [['Super', 20000, true]]);
    gasto(a, 5000); ids.push(a.D.meses[9].movimientos[1].id);
    assert.deepEqual(fila(a), [['Super', 25000, true]]);
    a.quitarMov(ids[caso[1][0]]);
    assert.deepEqual(fila(a), caso[1][0] === 0 ? [['Super', 55000, false]] : [['Super', 20000, true]]);
    a.quitarMov(ids[caso[1][1]]);
    assert.deepEqual(fila(a), [['Super', 50000, false]]);
  });
});

test('L3 review 1: a manual amount edit after "Sí" survives its undo (only the payment is reversed)', function(){
  var a = app(octubre(50000), 9);
  gasto(a, 50000); a.gastoEsPago();
  a.D.meses[9].gastosVariables[0].monto = 45000;   // the user corrects the row by hand
  a.quitarMov(ultimoId(a));
  assert.deepEqual(fila(a), [['Super', 45000, false]]);
  var b = app(octubre(50000), 9);
  gasto(b, 20000); b.gastoEsPago(); b.marcarPago(true);
  b.D.meses[9].gastosVariables[0].monto = 22000;
  b.quitarMov(ultimoId(b));
  assert.deepEqual(fila(b), [['Super', 52000, false]], 'the +2.000 edit stays on top of the restored plan');
});

test('L3 review 2: copying the previous month skips the one-off "(otro gasto)" rows', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado');
  C.mes(d, 9, {gastosVariables: [C.it('Super', 50000, false), C.it('Super (otro gasto)', 20000, true), C.it('Super (otro gasto 2)', 7000, true),
    C.it('Ropa (otro gasto) extra', 3000, true)]});
  var a = app(d, 10);
  a.copiarAnterior('gastosVariables');
  assert.deepEqual(filas(a.D.meses[10].gastosVariables), [['Super', 50000, false], ['Ropa (otro gasto) extra', 3000, false]],
    'only the exact suffixes L3 creates are one-off; a name that merely contains the words is copied');
  assert.equal(a.esGastoAparte('Super (otro gasto 12)'), true);
  assert.equal(a.esGastoAparte('Super (otro gasto)'), true);
  assert.equal(a.esGastoAparte('(otro gasto)'), false, 'no row name before it: not something L3 creates');
  assert.equal(a.esGastoAparte('Super (otro gasto 1)'), false, 'L3 numbers from 2');
});

test('L4 review 3: the backup reminder counts data stored in another year (the open one is empty)', function(){
  var DIA = 86400000, AHORA = new Date('2026-10-15T12:00:00').getTime();
  var store = {'kibo.datosDesde': new Date(AHORA - 10 * DIA).toISOString()};
  var ls = {getItem: function(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
  var avisos = {innerHTML: ''}, abierto = {anio: 2026}, otro = {anio: 2025};
  var g = {localStorage: ls, document: {getElementById: function(id){ return id === 'avisos' ? avisos : null; }},
    hayDatos: function(d){ return d === otro; }, tieneTrab: function(){ return false; }, sinTaparCuarentena: function(){ return ''; },
    aniosGuardados: function(){ return [2025, 2026]; }, leerAnio: function(y){ return y === 2025 ? otro : abierto; }};
  var a = la.loadApp({today: '2026-10-15', funcs: ['recordatorioCopia', 'revisarCopia', 'ultimaCopia', 'hayDatosEnElTelefono'],
    vars: ['LSCOPIA', 'LSDATOSDESDE', 'LSCOPIAPOS', 'DIAS_COPIA', 'DIAS_SIN_COPIA', 'DIAS_POSPONER'], globals: g});
  a.D = abierto;
  a.revisarCopia();
  assert.ok(store['kibo.datosDesde'], 'the first day with data is kept');
  assert.match(avisos.innerHTML, /Hace <b>10 días<\/b> que cargás datos/);
  g.hayDatos = function(){ return false; };
  var b = la.loadApp({today: '2026-10-15', funcs: ['recordatorioCopia', 'revisarCopia', 'ultimaCopia', 'hayDatosEnElTelefono'],
    vars: ['LSCOPIA', 'LSDATOSDESDE', 'LSCOPIAPOS', 'DIAS_COPIA', 'DIAS_SIN_COPIA', 'DIAS_POSPONER'], globals: g});
  b.D = abierto; avisos.innerHTML = '';
  b.revisarCopia();
  assert.equal(avisos.innerHTML, '', 'no year with data: nothing');
  assert.equal(store['kibo.datosDesde'], undefined);
});
