'use strict';
// R4.5 before -> migration -> after report (design section 8/9, D14). For each legacy / pre-R4 dataset, at hoy 2026-10-15:
//   BEFORE = what the screen computed before the model (normalizar + calc / old patrimonio / old Trabajo available; = the legacy golden),
//   MIGRATION = the blob after normalizar(d, hoy) + iniciarArrastre (declared 500.000, or skipped),
//   AFTER = what the screen computes with the model (tilesMes / cadena / patrimonioNeto / resumenTrab).
// Pure computation; tests/r4.cobertura.test.js asserts its invariants. Print the table: node tests/fixtures/r45-antes-despues.js
var la = require('../load-app');
var C = require('./r4-casos');
var H = require('./r45-harness');
var base = require('./motor-corpus');

var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');
var DECLARADO = 500000;
function plain(x){ return JSON.parse(JSON.stringify(x)); }

function viejo7f7ad40(){   // same shape as tests/r4.migracion.test.js: no pagoExplicito, no pagado, text amounts, a debt plan
  var meses = [], i;
  for(i = 0; i < 12; i++) meses.push({ingresos: [{nombre: 'Sueldo', monto: i < 6 ? '1000' : 0}], gastosFijos: [{nombre: 'Alquiler', monto: 300}], gastosVariables: [], deudas: [{nombre: 'Préstamo', monto: 50}],
    ahorroMesARS: 20, movimientos: [{id: 'm' + i, fecha: '2026-01-0' + (i % 9 + 1), sec: 'gastosVariables', nombre: 'Super', monto: 10}]});
  return {anio: 2026, version: 1, actualizado: '2026-07-20T10:00:00.000Z', cotizacionUSD: 1400, meses: meses, planDeudas: {'Préstamo': {total: 600, recargo: 0, cuotas: 12, pagadasAntes: 1}}};
}
function conUsdYCripto(){
  var d = C.vacio(2026);
  d.cripto = [{activo: 'BTC', cantidad: 0.5, precioUSD: 60000}];
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 900000, true)], gastosFijos: [C.it('Alquiler', 300000, true)], ahorroMesARS: 100000, ahorroMesUSD: 50, compraARS: 150000, compraUSD: 100, ventaUSD: 20, ventaARS: 30000,
    deudas: [C.it('Tarjeta', 40000, false)]});
  C.mes(d, 10, {deudas: [C.it('Tarjeta', 40000, false)], ahorroMesARS: 100000});
  d.planDeudas = {'Tarjeta': {total: 120000, recargo: 0, cuotas: 3, pagadasAntes: 0}};
  return d;
}
function conTrabajo(){
  var d = C.vacio(2026);
  C.mes(d, 8, {ingresos: [C.it('Del trabajo', 50000, false)]});   // legacy month: "Del trabajo" without pases, unticked
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 300000, true), C.it('Sueldo', 100000, true)], gastosVariables: [C.it('Super', 40000, false)]});
  C.mes(d, 10, {ingresos: [C.it('Del trabajo', 150000, true)]});
  return d;
}
var PASES = [{fecha: '2026-10-05', monto: 200000}, {fecha: '2026-10-10', monto: 100000}, {fecha: '2026-11-05', monto: 150000}];
var DATASETS = [
  {n: 'legacy2026 (golden corpus, no pagoExplicito)', raw: function(){ return base.datasets()[3][1]; }},
  {n: 'mixed2026 (golden corpus, v1.31.x)', raw: function(){ return base.datasets()[0][1]; }},
  {n: '7f7ad40-era blob', raw: viejo7f7ad40},
  {n: 'section 2 without model', raw: function(){ return H.sinModelo(C.seccion2(false, false)); }},
  {n: 'USD + crypto + debt plan', raw: conUsdYCripto},
  {n: 'Trabajo with a future pase', raw: conTrabajo, T: function(){ return H.trab(PASES); }}
];

function vista(app){
  var vm = app.vistaModelo(app.D, app.hoy), p = app.plain(app.patrimonioPantalla(app.D, app.hoy)), t = app.resumenTrab();
  var o = {sep: H.tiles(app, 8).disponibleFinal, oct: H.tiles(app, 9).disponibleFinal, nov: H.tiles(app, 10).disponibleFinal,
    ingresosOct: H.tiles(app, 9).totalIngresos, patrimonioARS: p.patrimonioARS, ahorroARS: p.ahorroARS, usd: p.usd,
    trabajo: app.T && app.tieneTrab() ? t.disponible : null,
    tildeTrabajoSep: app.D.meses[8].ingresos.filter(function(r){ return app.esRenglonTrabajo(r.nombre); }).map(function(r){ return app.tieneTilde(app.D, 8, 'ingresos', r); })};
  if(vm){
    var r = vm.cad.resumen;
    o.disponibleActual = r.disponibleActual; o.proyectadoAlCierre = r.proyectadoAlCierre; o.vencidos = r.vencidos; o.vencidosIngresos = r.vencidosIngresos;
    o.bruto = p.modelo.bruto; o.pasivos = p.modelo.pasivos; o.neto = p.modelo.neto;
  }
  return o;
}
function uno(ds, declarado){
  var T = ds.T ? ds.T() : null;
  var antes = H.appVista(ds.raw(), T && C.copy(T));
  var d = antes.D, ctx = antes.ctxModelo(d, antes.hoy);
  var mig = C.copy(plain(d)); mig.arrastre = plain(M.iniciarArrastre(mig, HOY, declarado, ctx));
  var despues = H.appVista(mig, T && C.copy(T));
  return {n: ds.n, antes: vista(antes), arrastre: mig.arrastre, despues: vista(despues), mesesAntes: plain(d.meses), mesesDespues: plain(despues.D.meses),
    serieAntes: plain(M.serie(d)), serieDespues: plain(M.serie(despues.D))};
}
function informe(){
  var out = [];
  DATASETS.forEach(function(ds){ out.push(uno(ds, DECLARADO)); out.push(uno(ds, null)); });
  return out;
}
// years without arrastre (an older and a later year): nothing may change
function aniosSinArrastre(){
  return [base.datasets()[1], base.datasets()[4], base.datasets()[2]].map(function(e){
    var a = H.appVista(e[1]);
    return {n: e[0], vista: vista(a), modelo: a.vistaModelo(a.D, a.hoy)};
  });
}

module.exports = {informe: informe, aniosSinArrastre: aniosSinArrastre, DECLARADO: DECLARADO, HOY: HOY};

if(require.main === module){
  var f = function(v){ return v === null || v === undefined ? '—' : (typeof v === 'number' ? String(Math.round(v * 100) / 100) : JSON.stringify(v)); };
  var campos = ['sep', 'oct', 'nov', 'ingresosOct', 'disponibleActual', 'proyectadoAlCierre', 'vencidos', 'vencidosIngresos', 'ahorroARS', 'usd', 'bruto', 'pasivos', 'neto', 'patrimonioARS', 'trabajo', 'tildeTrabajoSep'];
  informe().forEach(function(r){
    console.log('\n#### ' + r.n + ' — ' + (r.arrastre.inicial.origen === 'declarado' ? 'declared ' + DECLARADO : 'skipped (omitido)'));
    console.log('\nMigration: `arrastre` = `' + JSON.stringify(r.arrastre) + '`; months identical: ' + (JSON.stringify(r.mesesAntes) === JSON.stringify(r.mesesDespues)) +
      '; serie identical: ' + (JSON.stringify(r.serieAntes) === JSON.stringify(r.serieDespues)) + '\n');
    console.log('| Output | Before (pre-R4) | After (R4) |\n|---|---|---|');
    campos.forEach(function(k){ console.log('| ' + k + ' | ' + f(r.antes[k]) + ' | ' + f(r.despues[k]) + ' |'); });
  });
  console.log('\n#### Years without arrastre');
  aniosSinArrastre().forEach(function(a){ console.log('- ' + a.n + ': model view ' + (a.modelo ? 'PRESENT' : 'none') + '; ' + JSON.stringify(a.vista)); });
}
