'use strict';
// 1.35 cash / digital split, integration (T4 of odd/tasks/cash-digital-split.md): Trabajo pases with `forma` feed the cash pocket,
// the backup round trip carries every new field, "Versión para PC" keeps them, the year CSV gains cash columns only for a year that
// uses cash, and the Trabajo CSV says how each pase went.
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var la = require('./load-app');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function ef(x){ x.medio = 'efectivo'; return x; }
var TRAB_FUNCS = ['catValida', 'colorValido', 'nomCarpeta', 'stockValido', 'tjId'];
function varDeLaApp(n){ return new Function(la.extractVar(n) + ' return ' + n + ';')(); }   // eslint-disable-line no-new-func
var TRAB_VARS = {CATS: varDeLaApp('CATS'), COLCARP: varDeLaApp('COLCARP')};
function almacen(ls, today, extra){ return H.appAlmacen(ls, today || '2026-10-15', Object.assign({}, TRAB_VARS, extra), TRAB_FUNCS); }
function sinRev(o){ var c = plain(o); delete c.rev; delete c.actualizado; return c; }

// a 2026 model year from October that uses every new field, and a Trabajo store with a cash pase and a transfer pase
function anioConEfectivo(){
  var d = C.arrastre(C.vacio(2026), 9, 100000, 'declarado', {aperturaEfectivo: 20000});
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 500000, true), C.it('Del trabajo', 11000, false)], gastosVariables: [ef(C.it('Super', 10000, true)), ef(C.it('Verdulería', 5000, false))],
    extraccionARS: 15000, depositoARS: 3000,
    movimientos: [{id: 'm1', fecha: '2026-10-02T10:00:00.000Z', sec: 'gastosVariables', nombre: 'Super', monto: 10000, pp: false, medio: 'efectivo', mp: 'digital', fo: 0, fn: 1, fi: 0}]});
  return d;
}
function trabajo(){
  var t = H.trab([{fecha: '2026-10-05', monto: 7000}, {fecha: '2026-10-06', monto: 4000}]);
  t.pases[0].forma = 'efectivo';
  return t;
}

test('a cash pase feeds the cash pocket through ctxModelo; a transfer pase stays digital; the total is the same', function(){
  var a = H.appVista(anioConEfectivo(), trabajo());
  var ctx = plain(a.ctxModelo(a.D, a.hoy));
  assert.deepEqual(ctx.pasesTrabajo['2026-10'], [{fecha: '2026-10-05', monto: 7000, forma: 'efectivo'}, {fecha: '2026-10-06', monto: 4000}]);
  var v = plain(M.disponiblePorMedio(a.D, 9, a.hoy, a.ctxModelo(a.D, a.hoy)));
  assert.deepEqual([v.efectivo, v.total], [20000 - 10000 + 7000 + 15000 - 3000, H.tiles(a, 9).disponibleFinal]);
  var b = H.appVista(anioConEfectivo(), H.trab([{fecha: '2026-10-05', monto: 7000}, {fecha: '2026-10-06', monto: 4000}]));
  assert.equal(H.tiles(b, 9).disponibleFinal, v.total, 'the pase medio never changes the total');
  assert.equal(plain(M.disponiblePorMedio(b.D, 9, b.hoy, b.ctxModelo(b.D, b.hoy))).efectivo, v.efectivo - 7000);
});

test('January of the next year starts from the live December cash of the stored year', function(){
  var y26 = anioConEfectivo(), y27 = C.arrastre(C.vacio(2027), 0, 0, 'arrastre');
  var a = H.appVista(y27, trabajo(), {'kibo.datos.2026': JSON.stringify(y26)}, '2027-01-10');
  var ctx = a.ctxModelo(a.D, a.hoy), dic = plain(M.cadenaMedios(a.normalizar(C.copy(y26), a.hoy), a.hoy, a.ctxModelo(a.normalizar(C.copy(y26), a.hoy), a.hoy))[11]);
  assert.equal(ctx.cierrePrevioEfectivo, dic.cierreEfectivo);
  var ene = plain(M.disponiblePorMedio(a.D, 0, a.hoy, ctx));
  assert.deepEqual([ene.efectivo, ene.total], [dic.cierreEfectivo, ctx.cierrePrevio]);
});

test('backup -> restore on an empty phone carries every cash field (lines, quick expenses, transfers, cash opening, pase forma)', function(){
  var y = M.normalizar(anioConEfectivo(), C.hoy('2026-10-15'));
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(Object.assign(y, {rev: 3})), 'kibo.trabajo': JSON.stringify(Object.assign(trabajo(), {rev: 2}))});
  var a = almacen(ls, null, {tieneTrab: function(){ return true; }});
  H.cargarEn(a, ls, 2026); a.T = a.leerTrab();
  var texto = JSON.stringify(a.armarCopia());
  ['"medio":"efectivo"', '"mp":"digital"', '"extraccionARS":15000', '"depositoARS":3000', '"aperturaEfectivo":20000', '"forma":"efectivo"'].forEach(function(k){ assert.ok(texto.indexOf(k) > 0, k); });
  var ls2 = H.fakeStorage(), b = almacen(ls2, null, {descTrabajo: function(){ return ''; }});
  b.D = b.normalizar({anio: 2026}, b.hoy);
  b.restaurarTexto(texto); b.pendiente();
  var ya = a.normalizar(H.guardado(ls, 2026), a.hoy), yb = b.normalizar(H.guardado(ls2, 2026), b.hoy);
  assert.deepEqual(sinRev(yb), sinRev(ya), 'the year');
  assert.deepEqual(sinRev(b.normTrab(JSON.parse(ls2.d['kibo.trabajo']))).pases, sinRev(a.normTrab(JSON.parse(ls.d['kibo.trabajo']))).pases, 'Trabajo pases');
  var va = H.appVista(H.guardado(ls, 2026), JSON.parse(ls.d['kibo.trabajo'])), vb = H.appVista(H.guardado(ls2, 2026), JSON.parse(ls2.d['kibo.trabajo']));
  assert.deepEqual(plain(M.cadenaMedios(vb.D, vb.hoy, vb.ctxModelo(vb.D, vb.hoy))), plain(M.cadenaMedios(va.D, va.hoy, va.ctxModelo(va.D, va.hoy))), 'same cash and digital');
});

test('"Versión para PC": the embedded year keeps the cash fields (leerEmbebido normalizes them back)', function(){
  var y = M.normalizar(anioConEfectivo(), C.hoy('2026-10-15')), M1 = '/*DATOS_' + 'INICIO*/', M2 = '/*DATOS_' + 'FIN*/';
  var texto = M1 + JSON.stringify(y) + M2;
  var app = la.loadApp({funcs: ['leerEmbebido'], vars: ['M1', 'M2'], globals: {document: {getElementById: function(){ return {textContent: texto}; }}}});
  var r = app.plain(app.leerEmbebido());
  assert.deepEqual(plain(M.normalizar(r, C.hoy('2026-10-15'))), plain(y));
});

function appCsv(d){
  var salida = {};
  var app = la.loadApp({today: '2026-10-15', funcs: ['csvTexto', 'exportarCSV', 'serieVista', 'vistaModelo', 'tilesMes', 'ctxModelo', 'cierreAnioAnterior', 'dos'], globals: {
    MESES: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'], T: null,
    descargar: function(t){ salida.t = t; }}});
  app.D = app.normalizar(C.copy(d), app.hoy);
  app.exportarCSV();
  return salida.t.replace('﻿', '').split('\r\n').map(function(f){ return f.split(';'); });
}

test('year CSV: a year that uses cash gets Saqué efectivo / Deposité efectivo / Efectivo / Digital; Efectivo + Digital = Disponible final', function(){
  var f = appCsv(anioConEfectivo()), h = f[0], oct = f[10];
  assert.deepEqual(h.slice(-4), ['Saqué efectivo', 'Deposité efectivo', 'Efectivo', 'Digital']);
  var col = function(n){ return +String(oct[h.indexOf(n)]).replace(',', '.'); };
  assert.deepEqual([col('Saqué efectivo'), col('Deposité efectivo'), col('Efectivo')], [15000, 3000, 20000 - 10000 + 15000 - 3000]);
  assert.equal(col('Efectivo') + col('Digital'), col('Disponible final'));
  var g = appCsv(C.arrastre(C.vacio(2026), 9, 100000, 'declarado'));
  assert.equal(g[0].length, 18, 'a year without cash exports the same columns as before');
});

test('Trabajo CSV: each pase says how it went (Efectivo or Transferencia)', function(){
  var salida = null, T = trabajo();
  T.facturas = []; T.gastos = [];
  var app = la.loadApp({funcs: ['csvTrabajo', 'csvTexto', 'pasesPersonal'], globals: {   // the stubs of tests/seguridad.test.js
    T: T, MESES: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    hoyISO: function(){ return '2026-10-15'; }, fDiaLargo: function(x){ return x; },
    resumenTrab: function(){ return {cobrado: 0, gastado: 0, gastoFuturo: 0, aAcreditar: 0, pasado: 11000, disponible: 0, porCobrar: 0, facturado12: 0}; },
    nombreForma: function(){ return 'Transferencia'; }, nombrePeriodo: function(){ return ''; }, largoPeriodo: function(){ return 6; },
    sumarDias: function(d){ return d; }, venceFac: function(){ return ''; }, saldoFac: function(){ return 0; }, ganancia: function(){ return 0; },
    nomFac: function(f){ return f.cliente; }, facPorId: function(){ return null; }, sinAsignar: function(){ return 0; },
    nombreCat: function(){ return 'Otros'; }, fechaArchivo: function(){ return '2026-10-15'; },
    descargar: function(t){ salida = t; }
  }});
  app.csvTrabajo();
  var l = salida.replace('﻿', '').split('\r\n'), i = l.indexOf('PASADO A LO PERSONAL');
  assert.equal(l[i + 1], 'Fecha;Monto;Fue a;Cómo');
  assert.equal(l[i + 2], '2026-10-05;7000;Ingresos de Octubre 2026;Efectivo');
  assert.equal(l[i + 3], '2026-10-06;4000;Ingresos de Octubre 2026;Transferencia');
});
