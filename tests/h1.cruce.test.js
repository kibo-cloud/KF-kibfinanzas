'use strict';
// H1 (S2, cross-year integrity): contract I4 (odd/tasks/repair-sprint-1-r4-design.md §1) — "Month change: across pockets Σ stocks(m+1
// opening) = Σ stocks(m closing). No peso appears or disappears." — applied to December -> January of two MODEL years, plus R4.3
// ("duplicar from a chained year uses the LIVE closing of the previous year") extended from the Disponible to every carried pocket:
// Ahorro ARS (ahorroAnioAnterior), a reponer (aReponerAnterior), USD (usdAnioAnterior) and the debt (each plan's pagadasAntes).
// A carried field the user edited in the new year is explicit data (D14): it is kept and the December notice stays visible.
// The property tests are seeded (mulberry32) and reproducible: a failure names its seed; SEEDS lists every seed that runs.
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
  'derivaAnioPrevio', 'avisoDerivaPrevio', 'previoEnVivo', 'arrastreVivo', 'carryDiciembre', 'cuotasProgramadas', 'cuotasDeMas'])
  .filter(function(n, i, a){ return a.indexOf(n) === i && new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); });
var VARS = ['PREF', 'MESES', 'CORTOS', 'oculto', 'PUNTOS', 'ICOSEC', 'MAS_QUE_LO_NORMAL', 'TOP_CATEGORIAS', 'FORMAS', 'CATS', 'COLCARP'];
var COT = 1500;   // seccion2's cotizacionUSD: a USD bought or sold at this price moves no net worth
var SEEDS = [];
for(var s0 = 1; s0 <= 60; s0++) SEEDS.push(20261013 + s0 * 7919);

function mulberry32(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function plain(x){ return JSON.parse(JSON.stringify(x)); }

// the app reading the stored years exactly as it does on the phone (leerAnio), with the year-views stubs of tests/fixtures/anio-vistas.js
function vista(store, T, today, anio){
  var nodo = {innerHTML: ''}, csv = [];
  var app = la.loadApp({today: today || '2027-01-10', funcs: FUNCS, vars: VARS,
    globals: {localStorage: H.fakeStorage(store), document: {getElementById: function(id){ return id === 'v-anio' ? nodo : null; }}, descargar: function(t){ csv.push(t); }}});
  app.T = T || C.copy(H.TRAB_VACIO);
  app.D = app.leerAnio(anio || 2027);
  app.anio = function(){ nodo.innerHTML = ''; app.renderAnio(); return nodo.innerHTML; };
  app.csv = function(){ csv.length = 0; app.exportarCSV(); return csv[0]; };
  return app;
}
// creates 2027 from the stored 2026 with the real duplicar, on the phone's date `creado`
function crear(raw26, creado){
  var y26 = M.normalizar(C.copy(raw26), C.hoy(creado));
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, creado);
  H.cargarEn(app, ls, 2026); app.duplicar();
  assert.ok(ls.d['kibo.datos.2027'], 'duplicar created 2027 on ' + creado);
  return ls.d;
}
function filas(d, n){ var c = 0; d.meses.forEach(function(m){ if(m.deudas.some(function(r){ return String(r.nombre).trim() === n && M.num(r.monto) > 0; })) c++; }); return c; }
function programadas(d, n){   // months whose installment row is still unpaid (scheduled or overdue): the slot of a real installment
  var c = 0;
  d.meses.forEach(function(m){
    var ls = m.deudas.filter(function(r){ return String(r.nombre).trim() === n && M.num(r.monto) > 0; });
    if(ls.length && !ls.some(function(r){ return r.pagado === true; })) c++;
  });
  return c;
}

// I4 across December 2026 -> January 2027, every pocket, plus the same numbers on every screen
function invariantes(store, T, msg){
  var a = vista(store, T), P = a.leerAnio(2026), Y = a.D, hoy = a.hoy;
  var sp = a.serie(P)[11], sy = a.serie(Y);
  var cp = a.cadena(P, hoy, a.ctxModelo(P, hoy)).meses[11], cy = a.cadena(Y, hoy, a.ctxModelo(Y, hoy)).meses[0];
  assert.equal(cy.apertura, cp.cierre, msg + ': Disponible Dec 2026 closing = Jan 2027 opening');
  assert.equal(a.num(Y.ahorroAnioAnterior), sp.ahorroAcumulado, msg + ': Ahorro ARS Dec closing = Jan opening');
  assert.equal(a.num(Y.aReponerAnterior), sp.aReponer, msg + ': a reponer Dec closing = Jan opening');
  assert.equal(a.num(Y.usdAnioAnterior), sp.usdAcumulado, msg + ': USD Dec closing = Jan opening');
  var ep = a.estadoDeuda(P, 'Préstamo', 11, hoy), ey = a.estadoDeuda(Y, 'Préstamo', 0, hoy);
  if(ep){
    assert.equal(ey.saldo, ep.saldo, msg + ': debt saldo Dec closing = Jan opening');
    assert.equal(ey.restantes, ep.restantes, msg + ': remaining installments carried, not re-counted');
    assert.equal(filas(Y, 'Préstamo'), Math.max(0, ep.restantes - programadas(P, 'Préstamo')), msg + ': no installment scheduled in both years');
  }
  // the same numbers on screen: Patrimonio a hoy (January), "El año" and the CSV of 2027
  var p = a.plain(a.patrimonioPantalla(Y, hoy)).modelo;
  assert.equal(p.ahorroARS, sy[0].ahorroAcumulado, msg + ': Patrimonio ahorro = the year series');
  assert.equal(p.usd, sy[0].usdAcumulado, msg + ': Patrimonio USD = the year series');
  assert.equal(p.pasivos, ey ? ey.saldo : 0, msg + ': Patrimonio debts = the carried saldo');
  var csv = V.csvFilas(a.csv()), ene = csv[1];
  assert.equal(+ene[15].replace(',', '.'), sy[0].ahorroAcumulado, msg + ': CSV Ahorro acumulado (enero)');
  assert.equal(+ene[17].replace(',', '.'), sy[0].usdAcumulado, msg + ': CSV USD acumulado (enero)');
  var t = V.tabla(a.anio(), 'anTabla');
  assert.equal(t[0][0], 'Enero');
  assert.equal(t[0][9], a.fARS(sy[0].ahorroAcumulado), msg + ': El año Ahorro acumulado (enero)');
  return p;
}

// one seeded scenario: a model 2026, 2027 created on a random date, then December 2026 (and the installments) edited late, with 2027
// opened and saved in between at random points (the stored 2027 then carries whatever the app read)
var EDICIONES = ['ahorro', 'retiro', 'reposicion', 'compra', 'venta', 'ahorroUSD', 'cuota', 'pase', 'abrir27'];
function escenario(seed){
  var r = mulberry32(seed), pick = function(a){ return a[Math.floor(r() * a.length)]; }, k;
  var creado = pick(['2026-10-15', '2026-12-10', '2026-12-28']);
  var raw = C.seccion2(r() < 0.5, r() < 0.5);
  if(r() < 0.5) C.mes(raw, 11, {deudas: [C.it('Préstamo', 100000, false)]});   // December's installment scheduled before creating 2027
  var store = crear(raw, creado), T = H.trab([], 1000000), realizado = 0, pasos = [], i;
  var base = invariantes(store, T, 'seed ' + seed + ' created ' + creado);
  var n = 1 + Math.floor(r() * 6);
  for(i = 0; i < n; i++){
    var e = pick(EDICIONES), d26 = JSON.parse(store['kibo.datos.2026']), dic = d26.meses[11], v = (1 + Math.floor(r() * 9)) * 10000;
    pasos.push(e);
    if(e === 'ahorro') dic.ahorroMesARS = M.num(dic.ahorroMesARS) + v;
    else if(e === 'retiro') dic.retiroARS = M.num(dic.retiroARS) + v;
    else if(e === 'reposicion') dic.reposicionARS = M.num(dic.reposicionARS) + v;
    else if(e === 'compra'){ k = v / 1000; dic.compraUSD = M.num(dic.compraUSD) + k; dic.compraARS = M.num(dic.compraARS) + k * COT; }
    else if(e === 'venta'){ k = v / 10000; dic.ventaUSD = M.num(dic.ventaUSD) + k; dic.ventaARS = M.num(dic.ventaARS) + k * COT; }
    else if(e === 'ahorroUSD'){ k = v / 1000; dic.ahorroMesUSD = M.num(dic.ahorroMesUSD) + k; realizado += k * COT; }   // dollars from outside: new money
    else if(e === 'cuota'){   // tick / untick one installment row of Oct-Dec 2026
      var rows = [9, 10, 11].map(function(j){ return d26.meses[j].deudas.filter(function(x){ return x.nombre === 'Préstamo' && x.monto > 0; })[0]; }).filter(Boolean);
      if(rows.length){ var x = pick(rows); x.pagado = !x.pagado; }
    } else if(e === 'pase'){   // a Trabajo pase into December: the "Del trabajo" row and the pase, as aplicarPase writes them
      var it = dic.ingresos.filter(function(x){ return x.nombre === 'Del trabajo'; })[0];
      if(!it){ it = {nombre: 'Del trabajo', monto: 0, tope: 0, pagado: true}; dic.ingresos.push(it); }
      it.monto += v;
      T.pases.push({id: 'p' + i, fecha: '2026-12-05', monto: v, anio: 2026, mes: 11});
    } else if(e === 'abrir27'){   // 2027 opened and saved: what the app read is what gets stored
      var a = vista(store, T); store['kibo.datos.2027'] = JSON.stringify(a.D);
    }
    store['kibo.datos.2026'] = JSON.stringify(d26);
  }
  var msg = 'seed ' + seed + ' created ' + creado + ' edits ' + pasos.join(',');
  var fin = invariantes(store, T, msg);
  assert.equal(Math.round(fin.neto - base.neto), Math.round(realizado), msg + ': Patrimonio a hoy moves only by what was realized (new dollars)');
}

test('H1 property: I4 holds from December 2026 to January 2027 for every pocket, whatever is edited late and in whatever order', function(){
  SEEDS.forEach(escenario);
});

// the audit probes as fixed numbers (p1-carry.js, p3-cuotas.js in the S2 scratchpad)
function p1(cambiar){
  var store = crear(C.seccion2(true, true), '2026-12-20'), a0 = vista(store), d26 = JSON.parse(store['kibo.datos.2026']);
  cambiar(d26.meses[11]); store['kibo.datos.2026'] = JSON.stringify(d26);
  var a1 = vista(store);
  return [a0.plain(a0.patrimonioPantalla(a0.D, a0.hoy)).modelo, a1.plain(a1.patrimonioPantalla(a1.D, a1.hoy)).modelo];
}
test('H1 p1-carry: a late December savings transfer moves 100.000 from Disponible to Ahorro in 2027; the total does not move', function(){
  var r = p1(function(m){ m.ahorroMesARS = 100000; });
  assert.deepEqual([r[0].disponible, r[0].ahorroARS, r[0].bruto], [1280000, 800000, 3580000]);
  assert.deepEqual([r[1].disponible, r[1].ahorroARS, r[1].bruto], [1180000, 900000, 3580000]);   // before the fix: ahorro 800.000, bruto 3.480.000
});
test('H1 p1-carry: a late retiro and late dollars reach 2027 exactly once', function(){
  var r = p1(function(m){ m.retiroARS = 50000; });
  assert.deepEqual([r[1].disponible - r[0].disponible, r[1].ahorroARS - r[0].ahorroARS, r[1].bruto - r[0].bruto], [50000, -50000, 0]);   // before: bruto +50.000
  r = p1(function(m){ m.ahorroMesUSD = 100; });
  assert.deepEqual([r[1].usd - r[0].usd, r[1].bruto - r[0].bruto], [100, 150000]);   // before: USD 1000, bruto +0 (the 100 dollars never arrived)
});
test('H1 p3-cuotas: 2027 created in October loads no installment that 2026 still schedules; paying them later leaves the real debt', function(){
  var store = crear(C.seccion2(false, false), '2026-10-15'), n = JSON.parse(store['kibo.datos.2027']);
  // 6 installments, 3 paid by October, October/November still scheduled in 2026: 1 left for 2027 (before the fix: 3 rows, Jan-Mar)
  assert.deepEqual(n.meses.map(function(m){ return (m.deudas.filter(function(x){ return x.nombre === 'Préstamo'; })[0] || {}).monto || 0; }).slice(0, 3), [100000, 0, 0]);
  assert.equal(n.planDeudas['Préstamo'].pagadasAntes, 3, 'pagadasAntes is still the installments actually PAID');
  var d26 = JSON.parse(store['kibo.datos.2026']); d26.meses[9].deudas[0].pagado = true; d26.meses[10].deudas[0].pagado = true;
  store['kibo.datos.2026'] = JSON.stringify(d26);
  var a = vista(store), p = a.plain(a.patrimonioPantalla(a.D, a.hoy)).modelo;
  assert.equal(a.D.planDeudas['Préstamo'].pagadasAntes, 5, 'the live December count');
  assert.deepEqual([p.pasivos, p.pasivosDetalle], [100000, [{nombre: 'Préstamo', saldo: 100000, conPlan: true}]]);   // before: 300.000
});

// D14: what the user typed in the new year is kept; the notice says December changed
test('H1 a carried field edited in 2027 keeps the user value; untouched ones follow December; the notice names only the edited ones', function(){
  var store = crear(C.seccion2(true, true), '2026-12-10'), n = JSON.parse(store['kibo.datos.2027']);
  n.usdAnioAnterior = 5000;   // the user's own number
  store['kibo.datos.2027'] = JSON.stringify(n);
  var d26 = JSON.parse(store['kibo.datos.2026']); d26.meses[11].ahorroMesARS = 99000; d26.meses[11].compraUSD = 50; d26.meses[11].compraARS = 75000;
  store['kibo.datos.2026'] = JSON.stringify(d26);
  var a = vista(store), s = a.serie(a.leerAnio(2026))[11];
  assert.equal(a.D.usdAnioAnterior, 5000, 'kept');
  assert.equal(a.D.ahorroAnioAnterior, s.ahorroAcumulado, 'followed December');
  assert.deepEqual(a.plain(a.derivaAnioPrevio(a.D, a.hoy)), ['dolares']);
  assert.match(a.avisoDerivaPrevio(a.D, a.hoy), /Diciembre 2026 cambió después de crear 2027: los dólares que pasaron al año nuevo pueden no coincidir\./);
});
test('H1 a chained third year follows the live closing of the second, which follows the first', function(){
  var store = crear(C.seccion2(true, true), '2026-12-10');
  var app = H.appAlmacen(H.fakeStorage(store), '2027-12-10', null, FUNCS.filter(function(n){ return /^(arrastreVivo|carryDiciembre|cuotasProgramadas|cuotasDeMas)$/.test(n); }));
  app.D = app.leerAnio(2027); app.duplicar();
  var st = app.g.localStorage.d, d26 = JSON.parse(st['kibo.datos.2026']); d26.meses[11].ahorroMesARS = 70000; st['kibo.datos.2026'] = JSON.stringify(d26);
  var a = vista(st, null, '2028-01-10', 2028), y27 = a.leerAnio(2027);
  assert.equal(a.D.ahorroAnioAnterior, a.serie(y27)[11].ahorroAcumulado);
  assert.equal(a.D.ahorroAnioAnterior, 870000, '800.000 + the late 70.000, through 2027');
});
