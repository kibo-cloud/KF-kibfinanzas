'use strict';
// 1.35 cash / digital split, screen and money flows (T3 of odd/tasks/cash-digital-split.md): the hero row Digital / Efectivo, the
// Efectivo/Digital toggle of each line, the quick expense with its medio (and Undo restoring the line medio), copying a month, the
// one-time "¿Cuánto efectivo tenés hoy?" question and its write. Every number shown comes from the engine (disponiblePorMedio).
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
var SRC = la.SRC_FOR_TESTS;
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function existe(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); }
function ef(x){ x.medio = 'efectivo'; return x; }
var HOY = C.hoy('2026-10-15');

// ── month view: the same function list as tests/p3a.vista.test.js, plus the hero row ──
var FUNCS_VISTA = ['estadoHero', 'claseHero', 'subHero', 'chipT', 'chipsHero', 'etiquetaHero', 'htmlHero', 'barra', 'fPct', 'botonOjo', 'fARS', 'grupos', 'esc',
  'lineasSaldo', 'seccion', 'notaVence', 'diaVence', 'abierta', 'filaTope', 'textoDeuda', 'cuotaAdelantada', 'esProgramado', 'gastadoVista', 'gastadoConApartes', 'baseAparte', 'esGastoAparte', 'datosRealizados', 'cobroTxt',
  'faltaSeccion', 'textoFalta', 'textoDelTrabajo', 'filasVer', 'secAhorro', 'notaCompra', 'notaRetiro', 'fUSD', 'htmlMedios', 'mediosDelMes'].filter(existe);
var VARS_VISTA = ['MESES', 'oculto', 'PUNTOS', 'ICOSEC', 'MARCABLE', 'TOPEABLE', 'SECS', 'verFilas', 'SUB_APAGADO'];
function appMes(d, T, j){ var a = H.appVista(d, T, null, null, {funcs: FUNCS_VISTA, vars: VARS_VISTA}); if(j !== undefined) a.mes = j; return a; }
function modelo(filas, extra){ var d = C.arrastre(C.vacio(2026), 9, 100000, 'declarado', extra); C.mes(d, 9, filas); return d; }

test('hero row: Digital and Efectivo from the engine; the big number stays the total; without the row the hero is unchanged', function(){
  var a = appMes(modelo({ingresos: [C.it('Sueldo', 500000, true), ef(C.it('Feria', 30000, true))], gastosVariables: [ef(C.it('Super', 10000, true))]}, {aperturaEfectivo: 5000}), null, 9);
  var vm = a.vistaModelo(a.D, a.hoy), c = H.tiles(a, 9), med = a.htmlMedios(a.D, 9, vm, a.hoy);
  var v = plain(M.disponiblePorMedio(a.D, 9, a.hoy, vm.ctx));
  assert.deepEqual([v.total, v.efectivo, v.digital], [620000, 25000, 595000]);
  assert.equal(c.disponibleFinal, v.total, 'the card total is the engine total');
  assert.ok(med.indexOf('<b id="heroDig">' + a.fARS(595000) + '</b>') > 0, med);
  assert.ok(med.indexOf('<b id="heroEfe">' + a.fARS(25000) + '</b>') > 0, med);
  assert.ok(med.indexOf('data-act="efectivoHoy"') > 0, 'the current year can declare its cash');
  assert.ok(med.indexOf('data-act="traspaso"') > 0 && med.indexOf('aria-label="Pasar efectivo ↔ digital"') > 0);
  var con = a.htmlHero(a.D, 9, vm, a.hoy, c, '', false, med), sin = a.htmlHero(a.D, 9, vm, a.hoy, c, '', false);
  assert.ok(con.indexOf('id="heroMedios"') > 0);
  assert.equal(sin.indexOf('heroMedios'), -1);
  assert.equal(con.replace(med, ''), sin, 'the row is only added');
});

test('hero row: a negative cash pocket is shown as it is, in red (never clamped)', function(){
  var a = appMes(modelo({gastosVariables: [ef(C.it('Super', 30000, true))]}), null, 9), vm = a.vistaModelo(a.D, a.hoy);
  var med = a.htmlMedios(a.D, 9, vm, a.hoy);
  assert.ok(med.indexOf('<b id="heroEfe" class="mal">' + a.fARS(-30000) + '</b>') > 0, med);
  assert.ok(med.indexOf('<b id="heroDig">' + a.fARS(100000) + '</b>') > 0, med);
});

test('line rows: an Efectivo/Digital toggle on each row (none on a "Del trabajo" row filled by Trabajo)', function(){
  var T = H.trab([{fecha: '2026-10-05', monto: 20000}]);
  var a = appMes(modelo({ingresos: [C.it('Del trabajo', 20000, false), ef(C.it('Feria', 3000, true))], gastosVariables: [C.it('Super', 1000, true)]}), T, 9);
  var S = function(k){ return a.SECS.filter(function(s){ return s.k === k; })[0]; };
  var ing = a.seccion(S('ingresos'), a.D.meses[9]), gv = a.seccion(S('gastosVariables'), a.D.meses[9]);
  assert.ok(/data-act="medio" data-k="ingresos" data-i="1" aria-pressed="true" aria-label="En efectivo\. Tocá para pasarlo a digital">💵</.test(ing), 'cash row');
  assert.equal(/data-act="medio" data-k="ingresos" data-i="0"/.test(ing), false, 'Del trabajo with pases: no toggle');
  assert.ok(/data-act="medio" data-k="gastosVariables" data-i="0" aria-pressed="false" aria-label="Digital\. Tocá para pasarlo a efectivo">💳</.test(gv), 'digital row');
});

// ── quick expense: the same function list as tests/l3.gasto.test.js, plus the other-medio path and copying a month ──
var FUNCS_GASTO = ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'renglonLibre', 'pagoParcial', 'filaDelGasto', 'anotarMov',
  'gastoEnOtroMedio', 'copiarAnterior', 'esGastoAparte'];
function appGasto(raw, j){
  var toasts = [];
  var a = H.appVista(raw, null, null, null, {funcs: FUNCS_GASTO, vars: ['gr', 'MESES'],
    globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }}, abrirHoja: function(){}, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){},
      toast: function(t, ac, act, id){ toasts.push([t, ac, act, id]); }}});
  a.toasts = toasts; a.mes = j === undefined ? 9 : j;
  return a;
}
function gasto(a, monto, cat, medio, sec){ a.gr = {monto: monto, cat: cat || 0, sec: sec || 'gastosVariables', medio: medio || null}; a.sumarGasto(); return a.toasts[a.toasts.length - 1][3]; }
function totales(a){ return plain(M.cadenaMedios(a.D, a.hoy, a.ctxModelo(a.D, a.hoy))[9]); }

test('quick expense in cash on an empty digital line: the line becomes cash; Undo puts everything back', function(){
  var a = appGasto(modelo({gastosVariables: [C.it('Super', 0, false)]}));
  var id = gasto(a, 5000, 0, 'efectivo'), it = a.D.meses[9].gastosVariables[0], mv = plain(a.D.meses[9].movimientos[0]);
  assert.deepEqual([it.monto, it.pagado, it.medio], [5000, true, 'efectivo']);
  assert.deepEqual([mv.medio, mv.mp], ['efectivo', 'digital']);
  assert.deepEqual([totales(a).efectivo, totales(a).total], [-5000, 95000]);
  a.quitarMov(id);
  assert.deepEqual(plain(a.D.meses[9].gastosVariables[0]), {nombre: 'Super', monto: 0, tope: 0, frec: '', dias: [], pagado: false});
  assert.deepEqual([totales(a).efectivo, totales(a).total], [0, 100000]);
});

test('quick expense in the other medio than a line with an amount: a separate "(en efectivo)" row, reused, removed by Undo', function(){
  var a = appGasto(modelo({gastosVariables: [C.it('Super', 20000, true)]}));
  var id1 = gasto(a, 3000, 0, 'efectivo'), ls = a.D.meses[9].gastosVariables;
  assert.deepEqual(plain(ls).map(function(x){ return [x.nombre, x.monto, x.pagado, x.medio || 'digital', !!x.aparte]; }),
    [['Super', 20000, true, 'digital', false], ['Super (en efectivo)', 3000, true, 'efectivo', true]]);
  gasto(a, 2000, 0, 'efectivo');
  assert.equal(ls.length, 2, 'the cash row is reused');
  assert.equal(ls[1].monto, 5000);
  assert.deepEqual([totales(a).efectivo, totales(a).digital, totales(a).total], [-5000, 80000, 75000]);
  a.quitarMov(a.D.meses[9].movimientos[1].id); a.quitarMov(id1);
  assert.equal(ls.length, 1, 'Undo removes the row it created');
  assert.deepEqual([totales(a).efectivo, totales(a).total], [0, 80000]);
});

test('quick expense without choosing follows the line: a cash line takes cash expenses', function(){
  var a = appGasto(modelo({gastosVariables: [ef(C.it('Verdulería', 1000, true))]}));
  gasto(a, 500, 0, null);
  assert.equal(a.D.meses[9].gastosVariables.length, 1);
  assert.equal(a.D.meses[9].gastosVariables[0].monto, 1500);
  assert.equal(a.D.meses[9].movimientos[0].medio, 'efectivo');
  assert.equal('mp' in a.D.meses[9].movimientos[0], false, 'the line medio did not change');
});

test('"Sí, marcarlo como pagado" in cash marks the pending line paid in cash; Undo restores digital', function(){
  var a = appGasto(modelo({gastosFijos: [C.it('Alquiler', 200000, false)]}));
  a.gr = {monto: 200000, cat: 0, sec: 'gastosFijos', medio: 'efectivo'}; a.sumarGasto();
  a.gr.fila = {mes: 9, anio: 2026, nombre: 'Alquiler'}; a.marcarPago(false);
  var it = a.D.meses[9].gastosFijos[0];
  assert.deepEqual([it.pagado, it.medio], [true, 'efectivo']);
  assert.deepEqual([totales(a).efectivo, totales(a).total], [-200000, -100000]);
  a.quitarMov(a.D.meses[9].movimientos[0].id);
  assert.deepEqual([it.pagado, 'medio' in it], [false, false]);
});

test('"No, es otro gasto" and a partial payment in cash put the paid part in a cash row', function(){
  var a = appGasto(modelo({gastosVariables: [C.it('Super', 50000, false)]}));
  a.gr = {monto: 8000, cat: 0, sec: 'gastosVariables', medio: 'efectivo', fila: {mes: 9, anio: 2026, nombre: 'Super'}}; a.gastoAparte();
  var ls = a.D.meses[9].gastosVariables;
  assert.deepEqual([ls[1].nombre, ls[1].monto, ls[1].medio], ['Super (otro gasto)', 8000, 'efectivo']);
  a.gr = {monto: 10000, cat: 0, sec: 'gastosVariables', medio: 'efectivo', fila: {mes: 9, anio: 2026, nombre: 'Super'}}; a.pagoParcial();
  var p = ls.filter(function(x){ return x.nombre === 'Super (pago parcial)'; })[0];
  assert.deepEqual([p.monto, p.medio, p.pagado, ls[0].monto, 'medio' in ls[0]], [10000, 'efectivo', true, 40000, false]);
  assert.equal(totales(a).efectivo, -18000);
});

test('Undo keeps a medio you changed after the expense', function(){
  var a = appGasto(modelo({gastosVariables: [C.it('Super', 0, false)]}));
  var id = gasto(a, 5000, 0, 'efectivo'), it = a.D.meses[9].gastosVariables[0];
  M.ponerMedio(it, 'digital');   // the user toggled the row back by hand
  a.quitarMov(id);
  assert.equal('medio' in it, false);
  assert.equal(it.monto, 0);
});

test('copying the previous month copies each line medio', function(){
  var d = modelo({}); C.mes(d, 8, {gastosFijos: [ef(C.it('Alquiler', 200000, true)), C.it('Luz', 9000, true)]}); C.mes(d, 9, {gastosFijos: [C.it('Luz', 0, false)]});
  var a = appGasto(d); a.copiarAnterior('gastosFijos');
  assert.deepEqual(plain(a.D.meses[9].gastosFijos).map(function(x){ return [x.nombre, x.monto, x.medio || 'digital']; }), [['Luz', 9000, 'digital'], ['Alquiler', 200000, 'efectivo']]);
});

// ── the one-time cash question and its write (storage harness of tests/r5.saldos.test.js) ──
var R5 = ['vistaModelo', 'tilesMes', 'mesDelModelo', 'pasesDelMes', 'lineasSaldo', 'textoOrigen', 'muestraPrimerUso', 'claveAvisoCierre', 'avisoCierreDescartado', 'avisoCierrePendiente',
  'htmlAvisosSaldo', 'fARS', 'grupos', 'esc', 'guardarModelo', 'fijarEfectivoHoy', 'tieneTilde', 'repartoTrabajo'].filter(existe);
function almacen(raw, today){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(raw)});
  var a = H.appAlmacen(ls, today || '2026-10-15', {oculto: false, PUNTOS: '..', MESES: la.loadApp({vars: ['MESES']}).MESES, LSAVCIERRE: 'kibo.avisoCierre'}, R5);
  H.cargarEn(a, ls, 2026); a.ls = ls;
  return a;
}
function vmA(a){ return a.vistaModelo(a.D, a.hoy); }

test('the cash question shows once, in the hero Efectivo cell (no extra notice): a model year of today without a cash opening', function(){
  var a = almacen(modelo({ingresos: [C.it('Sueldo', 1000, true)]}));
  assert.equal(M.muestraPreguntaEfectivo(a.D, a.hoy), true);
  assert.equal(a.htmlAvisosSaldo(a.D, 9, vmA(a), a.hoy), '', 'one notice at a time: the question is not a notice');
  var v = appMes(modelo({ingresos: [C.it('Sueldo', 1000, true)]}), null, 9), med = v.htmlMedios(v.D, 9, v.vistaModelo(v.D, v.hoy), v.hoy);
  assert.ok(med.indexOf('id="preguntaEfectivo"') > 0 && med.indexOf('Efectivo · ¿cuánto tenés?') > 0, med);
  var b = almacen(modelo({}, {aperturaEfectivo: 0}));
  assert.equal(M.muestraPreguntaEfectivo(b.D, b.hoy), false, 'answered (0 = Omitir)');
  var w = appMes(modelo({}, {aperturaEfectivo: 0}), null, 9);
  assert.equal(w.htmlMedios(w.D, 9, w.vistaModelo(w.D, w.hoy), w.hoy).indexOf('preguntaEfectivo'), -1);
  var c = almacen(C.arrastre(C.vacio(2026), 9, 1000, 'arrastre'));
  assert.equal(M.muestraPreguntaEfectivo(c.D, c.hoy), false, 'a year that follows December brings its cash');
  assert.equal(M.muestraPreguntaEfectivo(a.D, C.hoy('2027-01-05')), false, 'only the year of today');
});

test('declaring cash today writes the opening so today shows it; Omitir writes 0; the total never changes', function(){
  var a = almacen(modelo({ingresos: [ef(C.it('Feria', 30000, true))], gastosVariables: [C.it('Super', 10000, true)]}));
  var antes = plain(M.cadenaMedios(a.D, a.hoy, a.ctxModelo(a.D, a.hoy))[9]);
  assert.equal(a.fijarEfectivoHoy(45000), true);
  var g = H.guardado(a.ls, 2026), v = plain(M.cadenaMedios(a.D, a.hoy, a.ctxModelo(a.D, a.hoy))[9]);
  assert.equal(g.arrastre.inicial.aperturaEfectivo, 15000, 'saved: 45000 - 30000 of cash income this month');
  assert.deepEqual([v.efectivo, v.total], [45000, antes.total]);
  assert.ok(a.ls.d['kibo.modeloSaldos'], 'the R4 pre-model snapshot rule still applies (guardarModelo)');
  var b = almacen(modelo({}));
  assert.equal(b.fijarEfectivoHoy(null), true);
  assert.equal(H.guardado(b.ls, 2026).arrastre.inicial.aperturaEfectivo, 0);
  assert.equal(M.muestraPreguntaEfectivo(b.D, b.hoy), false, 'asked once');
});

test('a stale tab cannot declare cash: nothing written, memory unchanged', function(){
  var a = almacen(modelo({}));
  a.obsoleta = true;
  assert.equal(a.fijarEfectivoHoy(1000), false);
  assert.equal('aperturaEfectivo' in a.D.arrastre.inicial, false);
  assert.equal('aperturaEfectivo' in H.guardado(a.ls, 2026).arrastre.inicial, false);
});
