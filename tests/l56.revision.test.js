'use strict';
// L5/L6 review fixes: "Qué vence" lists the uncovered part of "Del trabajo" (a), shows the amount of each collection (b);
// the separate quick-expense rows carry a flag (c); undo says when nothing could be reverted (d). No money rule changes: every amount
// is one the chain already counts (cadena.resumen) or the per-payment amount the row already shows (cobroTxt).
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

function plain(x){ return JSON.parse(JSON.stringify(x)); }
var F_VENCE = ['vencimientos', 'montosPorFecha', 'diasCobro', 'isoDe', 'diasDelMes', 'cuandoVence', 'detalleVence', 'fARS', 'grupos', 'esc', 'fDia', 'cuantosPagos', 'esRenglonTrabajo'];
function vence(raw, today){
  return H.appVista(raw, null, null, today, {funcs: F_VENCE, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX'], globals: {oculto: false, PUNTOS: '..'}});
}
function resumen(l){ return plain(l).map(function(x){ return [x.atrasado ? 'atrasado' : 'semana', x.nombre, x.monto, x.fecha]; }); }
function ing(n, m, p, frec, dias){ var x = C.it(n, m, p); x.frec = frec; x.dias = dias; return x; }

test('L5 review a: an unticked past "Del trabajo" with no pases is overdue; the listing adds up to what the chain counts', function(){
  var raw = C.vacio(2026);
  C.arrastre(raw, 8, 0);
  C.mes(raw, 8, {ingresos: [C.it('Del trabajo', 500000, false)], gastosFijos: [C.it('Luz', 20000, false)]});
  var a = vence(raw, '2026-10-15'), l = a.vencimientos(a.D, 9, a.hoy, []), res = a.vistaModelo(a.D, a.hoy).cad.resumen, tot = 0;
  l.forEach(function(x){ tot += x.monto; });
  assert.deepEqual(resumen(l), [['atrasado', 'Del trabajo', 500000, '2026-09-30'], ['atrasado', 'Luz', 20000, '2026-09-30']]);
  assert.equal(tot, res.vencidos + res.vencidosIngresos);
});

test('L5 review a: "Del trabajo" lists only the part the pases do not cover; fully covered or ticked, nothing', function(){
  var raw = C.vacio(2026);
  C.arrastre(raw, 8, 0);
  C.mes(raw, 8, {ingresos: [C.it('Del trabajo', 500000, false)]});
  var T = H.trab([{fecha: '2026-09-20', monto: 300000}]);
  var a = H.appVista(raw, T, null, '2026-10-15', {funcs: F_VENCE, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX'], globals: {oculto: false, PUNTOS: '..'}});
  var l = a.vencimientos(a.D, 9, a.hoy, []), res = a.vistaModelo(a.D, a.hoy).cad.resumen;
  assert.deepEqual(resumen(l), [['atrasado', 'Del trabajo', 200000, '2026-09-30']]);
  assert.equal(200000, res.vencidosIngresos, 'the same 200.000 the chain counts as not collected');
  var raw2 = C.copy(raw); raw2.meses[8].ingresos[0].monto = 300000;
  var b = H.appVista(raw2, T, null, '2026-10-15', {funcs: F_VENCE, vars: ['MESES', 'DIAS_VENCE', 'VENCE_MAX'], globals: {oculto: false, PUNTOS: '..'}});
  assert.deepEqual(resumen(b.vencimientos(b.D, 9, b.hoy, [])), [], 'covered by the pases');
  var raw3 = C.copy(raw); raw3.meses[8].ingresos[0].pagado = true;
  var c = vence(raw3, '2026-10-15');
  assert.deepEqual(resumen(c.vencimientos(c.D, 9, c.hoy, [])), [], 'ticked');
});

test('L5 review b: a weekly income shows the amount of one collection on each date, one overdue entry per past unpaid Friday', function(){
  var raw = C.vacio(2026);
  C.arrastre(raw, 9, 0);
  C.mes(raw, 9, {ingresos: [ing('Feria', 40000, false, 'semanal', [5])]});   // Fridays of October 2026: 2, 9, 16, 23, 30 -> 5 x 8.000
  var a = vence(raw, '2026-10-24');
  assert.deepEqual(resumen(a.vencimientos(a.D, 9, a.hoy, [])), [
    ['atrasado', 'Feria', 8000, '2026-10-02'], ['atrasado', 'Feria', 8000, '2026-10-09'],
    ['atrasado', 'Feria', 8000, '2026-10-16'], ['atrasado', 'Feria', 8000, '2026-10-23'],
    ['semana', 'Feria', 8000, '2026-10-30']]);
});

test('L5 review b: a fortnightly income on the 15th and the 30th, the 15th overdue: half on each date', function(){
  var raw = C.vacio(2026);
  C.arrastre(raw, 9, 0);
  C.mes(raw, 9, {ingresos: [ing('Sueldo', 600000, false, 'quincenal', [15, 30])]});
  var a = vence(raw, '2026-10-24'), l = a.vencimientos(a.D, 9, a.hoy, []);
  assert.deepEqual(resumen(l), [['atrasado', 'Sueldo', 300000, '2026-10-15'], ['semana', 'Sueldo', 300000, '2026-10-30']]);
  assert.equal(a.cuandoVence(l[0], a.hoy), 'Atrasado');
  assert.match(a.detalleVence(l[0]), /era el día 15/);
  var m = vence(raw, '2026-10-10');
  assert.deepEqual(resumen(m.vencimientos(m.D, 9, m.hoy, [])), [['semana', 'Sueldo', 300000, '2026-10-15']], 'nothing passed yet: only the next date');
});

// ── c: the separate quick-expense rows ──
var F_GASTO = ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'filaDelGasto',
  'anotarMov', 'esGastoAparte', 'copiarAnterior', 'esRenglonTrabajo'];
function gastoApp(raw, mes){
  var toasts = [];
  var a = H.appVista(raw, null, null, null, {funcs: F_GASTO, vars: ['gr', 'RENGLON_TRABAJO', 'MESES'],
    globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
      abrirHoja: function(){}, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){}, toast: function(t, ac, act, id){ toasts.push([t, ac, act, id]); }}});
  a.toasts = toasts;
  if(mes !== undefined) a.mes = mes;
  return a;
}
function modelo(filas, j){ var d = C.vacio(2026); C.arrastre(d, 8, 100000, 'declarado'); C.mes(d, j === undefined ? 9 : j, filas); return d; }

test('L3 review c: "No, es otro gasto" marks the row it creates with aparte: true, and the flag survives a reload', function(){
  var a = gastoApp(modelo({gastosVariables: [C.it('Super', 50000, false)]}));
  a.gr = {monto: 12000, cat: 0, sec: 'gastosVariables'}; a.sumarGasto(); a.gastoAparte();
  var f = a.D.meses[9].gastosVariables[1];
  assert.equal(f.nombre, 'Super (otro gasto)'); assert.equal(f.aparte, true);
  var d2 = a.normalizar(plain(a.D), a.hoy);
  assert.equal(d2.meses[9].gastosVariables[1].aparte, true);
  assert.equal(d2.meses[9].gastosVariables[0].aparte, undefined, 'ordinary rows carry no flag');
});

test('L3 review c: esGastoAparte prefers the flag; the name is only a fallback for rows saved before it', function(){
  var a = gastoApp(modelo({}));
  assert.equal(a.esGastoAparte({nombre: 'Viaje', aparte: true}), true, 'flagged, whatever its name (the user renamed it)');
  assert.equal(a.esGastoAparte({nombre: 'Super (otro gasto)', pagado: true}), true, 'old data: the name');
  assert.equal(a.esGastoAparte({nombre: 'Super'}), false);
  assert.equal(a.esGastoAparte('Super (otro gasto 2)'), true, 'a plain name still works');
});

test('L3 review c: copying the previous month skips a flagged row; the empty-copy message depends on the section', function(){
  var raw = modelo({gastosVariables: [{nombre: 'Viaje', monto: 30000, pagado: true, aparte: true}]}, 8);
  var a = gastoApp(raw, 9);
  a.copiarAnterior('gastosVariables');
  assert.deepEqual(plain(a.D.meses[9].gastosVariables), []);
  assert.equal(a.toasts[0][0], 'No hay nada para copiar del mes anterior');
  var b = gastoApp(modelo({ingresos: [C.it('Del trabajo', 30000, true)]}, 8), 9);
  b.copiarAnterior('ingresos');
  assert.equal(b.toasts[0][0], 'No hay nada para copiar: “Del trabajo” lo cargás desde Trabajo');
});

test('L3 review d: undo after the row was renamed or deleted keeps the movement and says it found nothing to revert', function(){
  var a = gastoApp(modelo({gastosVariables: [C.it('Super', 0, false)]}));
  a.gr = {monto: 12000, cat: 0, sec: 'gastosVariables'}; a.sumarGasto();
  var id = a.D.meses[9].movimientos[0].id;
  a.D.meses[9].gastosVariables[0].nombre = 'Supermercado';
  a.toasts.length = 0;
  a.quitarMov(id);
  assert.equal(a.toasts[0][0], 'No encontré el renglón para deshacer');
  assert.equal(a.D.meses[9].movimientos.length, 1, 'the movement stays: nothing was reverted');
  assert.equal(a.D.meses[9].gastosVariables[0].monto, 12000);
  a.D.meses[9].gastosVariables[0].nombre = 'Super'; a.toasts.length = 0;
  a.quitarMov(id);
  assert.equal(a.toasts[0][0], 'Deshecho');
  assert.equal(a.D.meses[9].movimientos.length, 0);
});
