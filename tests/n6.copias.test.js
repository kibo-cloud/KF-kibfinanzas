'use strict';
// N6: backup -> modify everything -> restore round trips through the real app functions (armarCopia, restaurarTexto, escribirAnios,
// guardarTrab), checked on the stored blobs AND on what the screens compute from them (chain, month cards, patrimonio, El año, CSV).
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var AV = require('./fixtures/anio-vistas');
var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');

function norm(d){ return M.normalizar(C.copy(d), HOY); }
function sinRev(o){ o = C.copy(o); delete o.rev; return o; }

// ── a full device: previous legacy year, a model year with everything, Trabajo with a realized and a future pase ──
function anio2025(){
  var d = C.vacio(2025);
  C.mes(d, 11, {ingresos: [C.it('Sueldo', 800000, true)], gastosFijos: [C.it('Alquiler', 300000, true)], gastosVariables: [C.it('Super', 90000, true)],
    deudas: [C.it('Préstamo', 100000, true)], ahorroMesARS: 120000, ahorroMesUSD: 40, compraARS: 60000, compraUSD: 40});
  d.planDeudas = {'Préstamo': {total: 600000, recargo: 0, cuotas: 6, pagadasAntes: 0}};
  return d;
}
function anio2026(){
  var d = C.seccion2(true, false);   // arrastre (declarado, desde septiembre), confirmed September closing, plan Préstamo, ahorro
  d.cotizacionUSD = 1250; d.cotizacionFecha = '2026-10-01';
  d.cripto = [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}];
  C.mes(d, 8, {compraARS: 125000, compraUSD: 100, ahorroMesUSD: 20});
  d.meses[9].ingresos.push(C.it('Del trabajo', 100000, true));
  d.meses[9].movimientos = [{id: 'm1', fecha: '2026-10-03T10:00:00.000Z', sec: 'gastosVariables', nombre: 'Supermercado', monto: 20000, pp: false}];
  return d;
}
function trabajo(){
  var t = H.trab([{fecha: '2026-10-10', monto: 100000}, {fecha: '2026-11-20', monto: 50000}], 900000);
  t.activo = true; t.tope = 5;
  t.facturas = [{id: 'f1', cliente: 'ACME', tipo: 'factura', monto: 250000, fecha: '2026-09-20', plazo: 30, forma: 'transferencia'}];
  return t;
}
function dispositivo(){
  var y25 = norm(anio2025()), y26 = norm(anio2026()), tr = NT.plain(NT.normTrab(trabajo()));   // the app always stores a normalized Trabajo
  y25.rev = 3; y26.rev = 9; tr.rev = 4;
  return H.fakeStorage({'kibo.anio': '2026', 'kibo.bienvenida': '1', 'kibo.datos.2025': JSON.stringify(y25), 'kibo.datos.2026': JSON.stringify(y26), 'kibo.trabajo': JSON.stringify(tr)});
}
var TRAB_FUNCS = ['catValida', 'colorValido', 'nomCarpeta', 'stockValido', 'tjId', 'esISO', 'utcDe', 'hoyISO', 'formaValida', 'normTrab', 'leerTrab', 'revValida', 'numEstricto'];
var TRAB_VARS = ['CATS', 'COLCARP', 'FORMAS'];
var NT = la.loadApp({today: '2026-10-15', funcs: TRAB_FUNCS, vars: TRAB_VARS});
function almacen(ls){ return H.appAlmacen(ls, '2026-10-15', null, TRAB_FUNCS.concat(['restaurarCopia', 'descTrabajo'])); }

// everything a user can see or export, computed from what is STORED
function estado(ls){
  var anios = {}, T, y25, y26;
  Object.keys(ls.d).filter(function(k){ return /^kibo\.datos\.(2025|2026)$/.test(k); }).sort().forEach(function(k){ anios[k] = sinRev(JSON.parse(ls.d[k])); });
  T = JSON.parse(ls.d['kibo.trabajo']); delete T.rev; delete T.actualizado;
  y25 = JSON.parse(ls.d['kibo.datos.2025']); y26 = JSON.parse(ls.d['kibo.datos.2026']);
  var v = H.appVista(y26, C.copy(T), {'kibo.datos.2025': JSON.stringify(y25)}, '2026-10-15',
    {funcs: TRAB_FUNCS.concat(['patrimonioPantalla', 'clave', 'aplicado']), vars: TRAB_VARS});
  v.T = v.normTrab(C.copy(T));
  var vm = v.vistaModelo(v.D, v.hoy), tarjetas = [];
  assert.ok(vm, 'the stored 2026 is a model year');
  for(var j = 0; j < 12; j++) tarjetas.push(H.tiles(v, j));
  var a26 = AV.appAnio(y26, {2025: y25}, v.normTrab(C.copy(T))), a25 = AV.appAnio(y25, {2026: y26}, v.normTrab(C.copy(T)));
  return {anios: anios, trabajo: T, cadena: v.plain(vm.cad), tarjetas: tarjetas, patrimonio: v.plain(v.patrimonioPantalla(v.D, v.hoy)),
    resumenTrab: v.plain(v.resumenTrab()), elAnio2026: a26.anio(), csv2026: a26.csv(), elAnio2025: a25.anio(), csv2025: a25.csv()};
}

test('N6 backup -> modify everything -> restore gives back exactly the backed-up state (blobs minus rev, Trabajo, chain, cards, patrimonio, El año, CSV)', function(){
  var ls = dispositivo();
  var antes = estado(ls);
  assert.ok(antes.cadena.meses[8].cierreReal || antes.anios['kibo.datos.2026'].meses[8].cierreReal, 'non-vacuous: a confirmed closing');
  assert.ok(antes.anios['kibo.datos.2026'].arrastre && !antes.anios['kibo.datos.2025'].arrastre, 'non-vacuous: model year + legacy year');
  assert.equal(antes.trabajo.pases.length, 2);
  var A = almacen(ls); H.cargarEn(A, ls, 2026); A.T = A.leerTrab();
  var copiaTxt = JSON.stringify(A.armarCopia()), copia = JSON.parse(copiaTxt);
  assert.deepEqual(Object.keys(copia.anios).sort(), ['2025', '2026']);
  assert.ok(copia.trabajo && copia.trabajo.pases.length === 2);

  // modify everything: edit 2026, delete 2025, empty Trabajo, add 2027
  A.D.meses[9].ingresos[0].monto = 1; A.D.cripto = []; A.D.cotizacionUSD = 999; delete A.D.arrastre; A.sucio = true; assert.equal(A.guardar(), true);
  delete ls.d['kibo.datos.2025'];
  A.T = A.normTrab(Object.assign(H.trab([]), {rev: A.T.rev})); assert.equal(A.guardarTrab(true), true);
  ls.d['kibo.datos.2027'] = JSON.stringify(norm(C.vacio(2027)));
  assert.deepEqual([JSON.parse(ls.d['kibo.datos.2026']).cotizacionUSD, ls.d['kibo.datos.2025'], JSON.parse(ls.d['kibo.trabajo']).pases.length], [999, undefined, 0], 'non-vacuous: everything changed');

  // restore through the real flow (confirm sheet -> pendiente)
  var B = almacen(ls); H.cargarEn(B, ls, 2026); B.T = B.leerTrab();
  B.restaurarTexto(copiaTxt); B.pendiente();
  assert.deepEqual(B.g.alertas, [], 'no failure reported');
  var despues = estado(ls);
  Object.keys(antes).forEach(function(k){ assert.deepEqual(despues[k], antes[k], k + ' equals the backup'); });
  assert.ok(ls.d['kibo.datos.2027'], 'a year that is not in the backup is left alone');
  assert.ok(JSON.parse(ls.d['kibo.datos.2026']).rev > 9 && JSON.parse(ls.d['kibo.datos.2025']).rev >= 1, 'revisions only move forward');
});

test('N6 mutation guard: a backup without Trabajo or without a year does not round-trip', function(){
  var ls = dispositivo(), antes = estado(ls);
  var A = almacen(ls); H.cargarEn(A, ls, 2026); A.T = A.leerTrab();
  [function(c){ delete c.trabajo; }, function(c){ delete c.anios[2025]; }].forEach(function(romper){
    var c = A.plain(A.armarCopia()); romper(c);
    var ls2 = dispositivo(), B = almacen(ls2); H.cargarEn(B, ls2, 2026);
    ls2.d['kibo.datos.2025'] = JSON.stringify(Object.assign(norm(C.vacio(2025)), {rev: 3}));
    ls2.d['kibo.trabajo'] = JSON.stringify(Object.assign(H.trab([]), {rev: 4}));
    B.T = B.leerTrab();
    B.restaurarTexto(JSON.stringify(c)); B.pendiente();
    assert.notDeepEqual(estado(ls2), antes);
  });
});

// ── old backups ──
function viejo7f7ad40(anio){   // blob as the 7f7ad40-era app saved it (same shape as tests/r4.migracion.test.js): no pagoExplicito, no pagado, text amounts
  var meses = [], i;
  for(i = 0; i < 12; i++) meses.push({ingresos: [{nombre: 'Sueldo', monto: i < 6 ? '1000' : 0}], gastosFijos: [{nombre: 'Alquiler', monto: 300}], gastosVariables: [], deudas: [{nombre: 'Préstamo', monto: 50}],
    ahorroMesARS: 20, movimientos: [{id: 'm' + i, fecha: anio + '-01-0' + (i % 9 + 1), sec: 'gastosVariables', nombre: 'Super', monto: 10}]});
  return {anio: anio, version: 1, actualizado: '2026-07-20T10:00:00.000Z', cotizacionUSD: 1400, meses: meses, planDeudas: {'Préstamo': {total: 600, recargo: 0, cuotas: 12, pagadasAntes: 1}}};
}

test('N6 a 7f7ad40-era backup (several years + Trabajo, no rev, no model) restores cleanly and reads as before', function(){
  var trab = {facturas: [{id: 'f1', cliente: 'X', monto: 1000, fecha: '2026-03-01'}], cobros: [], gastos: [], productos: []};
  var copia = {app: 'kibFinanzas', version: 1, creada: '2026-07-20T10:00:00.000Z', anios: {2025: viejo7f7ad40(2025), 2026: viejo7f7ad40(2026)}, trabajo: trab};
  var ls = dispositivo(), B = almacen(ls); H.cargarEn(B, ls, 2026); B.T = B.leerTrab();
  B.restaurarTexto(JSON.stringify(copia)); B.pendiente();
  assert.deepEqual(B.g.alertas, []);
  [2025, 2026].forEach(function(a){
    var g = JSON.parse(ls.d['kibo.datos.' + a]);
    assert.deepEqual(sinRev(g), sinRev(norm(viejo7f7ad40(a))), a + ': stored = today\'s normalizar of the old blob');
    assert.equal(g.arrastre, undefined, 'no model invented');
    assert.ok(g.rev >= 1);
    assert.deepEqual(JSON.parse(JSON.stringify(M.serie(norm(g)))), JSON.parse(JSON.stringify(M.serie(norm(viejo7f7ad40(a))))), a + ': same year numbers');
  });
  var t = JSON.parse(ls.d['kibo.trabajo']);
  assert.deepEqual([t.facturas.length, t.facturas[0].cliente, t.facturas[0].monto, t.pases.length], [1, 'X', 1000, 0]);
});

test('N6 a pre-R4 single-year export (bare year object, no wrapper) restores into its year', function(){
  var ls = H.fakeStorage({}), B = almacen(ls); B.D = norm(C.vacio(2026));
  var viejo = viejo7f7ad40(2024);
  B.restaurarTexto(JSON.stringify(viejo)); B.pendiente();
  assert.deepEqual(Object.keys(ls.d).filter(function(k){ return k.indexOf('kibo.datos.') === 0; }), ['kibo.datos.2024']);
  assert.deepEqual(sinRev(JSON.parse(ls.d['kibo.datos.2024'])), sinRev(norm(viejo)));
  assert.equal(ls.d['kibo.trabajo'], undefined, 'no Trabajo invented');
});
