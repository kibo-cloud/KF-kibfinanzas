'use strict';
// R4.2 golden corpus: the NEW pure functions (estadoMes, flujosMes, cadena, pasivos, patrimonioNeto) over fixed datasets and fixed `hoy`.
// Separate from motor-corpus.js on purpose: tests/fixtures/motor-golden.json stays byte-identical (design doc section 9).
var C = require('./r4-casos');
var base = require('./motor-corpus');

function pases(mapa){ return {pasesTrabajo: mapa}; }

function datasets(){
  var out = [], i;
  function add(nombre, raw, iso, ctx){ out.push({nombre: nombre, raw: raw, iso: iso, ctx: ctx || {}}); }

  // the contract section 2 chain, at three different moments, and in a closed / not started year
  add('s2-hoy-octubre', C.seccion2(false, false), '2026-10-15');
  add('s2-octubre-pagado-noviembre-actual', C.seccion2(true, true), '2026-11-20');
  add('s2-hoy-septiembre', C.seccion2(false, false), '2026-09-15');
  add('s2-anio-cerrado', C.seccion2(true, true), '2027-03-01');
  add('s2-anio-futuro', C.seccion2(false, false), '2025-12-31');

  // pre-R4 years: no arrastre at all (legacy, restored backup) and a mixed year with the model starting in May
  var mixed = base.datasets();
  add('legacy-mixed2026', mixed[0][1], '2026-10-04');
  add('legacy-sin-pagoexplicito', mixed[3][1], '2026-10-04');
  var ar = C.copy(mixed[0][1]); C.arrastre(ar, 4, 250000, 'declarado');
  ar.meses[5].cierreReal = {valor: 900000, calculadoAlConfirmar: 1, confirmadoEl: '2026-07-01'};
  add('mixed-con-arrastre-desde-mayo', ar, '2026-10-04', pases({'2026-10': [{fecha: '2026-10-02', monto: 41000}]}));

  // skipped initial balance
  var om = C.vacio(2026); C.arrastre(om, 9, null, 'omitido');
  C.mes(om, 9, {ingresos: [C.it('Sueldo', 800000, true)], gastosFijos: [C.it('Alquiler', 300000, true)], ahorroMesARS: 100000});
  add('saldo-inicial-omitido', om, '2026-10-15');

  // January opening from the previous year's closing, with and without drift against the snapshot
  var an = C.vacio(2027); C.arrastre(an, 0, 120000, 'arrastre', {calculadoOrigen: 120000});
  C.mes(an, 0, {ingresos: [C.it('Sueldo', 500000, true)], gastosFijos: [C.it('Alquiler', 200000, true)]});
  add('enero-arrastre-sin-deriva', an, '2027-01-20', {cierrePrevio: 120000});
  add('enero-arrastre-con-deriva', an, '2027-01-20', {cierrePrevio: 135000});
  add('enero-arrastre-sin-ctx', an, '2027-01-20');

  // Trabajo: realized pase, scheduled pase, a pase later this month, manual row without pases, excess, reconciliation mismatch
  var tr = C.vacio(2026); C.arrastre(tr, 7, 0, 'declarado');
  C.mes(tr, 7, {ingresos: [C.it('Del trabajo', 100000, true)]});   // no pases: ordinary ticked income
  C.mes(tr, 8, {ingresos: [C.it('Del trabajo', 150000, false)]});   // no pases: ordinary pending income
  C.mes(tr, 9, {ingresos: [C.it('Del trabajo', 400000, true), C.it('Sueldo', 200000, true)]});   // pases 300.000 + excess 100.000
  C.mes(tr, 10, {ingresos: [C.it('Del trabajo', 120000, false)]});   // pases 300.000 > row: mismatch
  C.mes(tr, 11, {ingresos: [C.it('Del trabajo', 300000, false)]});   // scheduled pase
  add('trabajo-pases', tr, '2026-10-15', pases({
    '2026-10': [{fecha: '2026-10-05', monto: 200000}, {fecha: '2026-10-10', monto: 100000}, {fecha: '2026-10-20', monto: 50000}],
    '2026-11': [{fecha: '2026-11-03', monto: 300000}], '2026-12': [{fecha: '2026-12-01', monto: 300000}]}));
  add('trabajo-pases-noviembre', tr, '2026-11-20', pases({
    '2026-10': [{fecha: '2026-10-05', monto: 200000}, {fecha: '2026-10-10', monto: 100000}, {fecha: '2026-10-20', monto: 50000}],
    '2026-11': [{fecha: '2026-11-03', monto: 300000}], '2026-12': [{fecha: '2026-12-01', monto: 300000}]}));
  add('trabajo-sin-pases', tr, '2026-10-15');

  // reposicion larger than aReponer (the excess is savings), equal and smaller
  [150000, 100000, 60000].forEach(function(r){
    var d = C.vacio(2026); C.arrastre(d, 8, 500000, 'declarado'); d.aReponerAnterior = 0;
    C.mes(d, 8, {retiroARS: 100000}); C.mes(d, 9, {reposicionARS: r});
    add('reposicion-' + r, d, '2026-10-15');
  });

  // USD and savings flows (purchase, sale, external inflow)
  var us = C.vacio(2026); C.arrastre(us, 8, 0, 'declarado'); us.usdAnioAnterior = 500; us.ahorroAnioAnterior = 1000000;
  us.cripto = [{activo: 'BTC', cantidad: 0.5, precioUSD: 60000}];
  C.mes(us, 8, {compraARS: 300000, compraUSD: 200, ahorroMesUSD: 30});
  C.mes(us, 9, {ventaUSD: 50, ventaARS: 70000, ahorroMesARS: 40000});
  C.mes(us, 10, {compraARS: 150000, compraUSD: 100, ahorroMesARS: 20000});
  add('usd-y-cripto', us, '2026-10-15', {trabajoDisponible: 80000});

  // debt plans: partial, cuota 0, overdue, future, with surplus rows, and a debt without plan
  function plan(extra){
    var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
    d.planDeudas = {'Tarjeta': {total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0}, 'Préstamo': {total: 600000, recargo: 10, cuotas: 12, pagadasAntes: 2}, 'Cero': {total: 0, recargo: 0, cuotas: 0, pagadasAntes: 0}};
    C.mes(d, 7, {deudas: [C.it('Amigo', 5000, false)]});
    C.mes(d, 8, {ingresos: [C.it('Sueldo', 1000000, true)], deudas: [C.it('Tarjeta', 33333, false), C.it('Préstamo', 55000, true), C.it('Amigo', 7000, true)]});
    C.mes(d, 9, {deudas: [C.it('Tarjeta', 33333, false), C.it('Préstamo', 55000, false), C.it('Amigo', 1000, false)]});
    C.mes(d, 10, {deudas: [C.it('Tarjeta', 33334, false), C.it('Préstamo', 55000, false), C.it('Amigo', 9999, false)]});
    if(extra) extra(d);
    return d;
  }
  add('deudas-vencida', plan(), '2026-10-15');
  add('deudas-parcial', plan(function(d){ d.meses[8].deudas[0].pagado = true; }), '2026-10-15');
  add('deudas-cuota-cero', plan(function(d){ d.meses[8].deudas[0].pagado = true; d.meses[8].deudas[0].monto = 0; }), '2026-10-15');
  add('deudas-futura-tildada', plan(function(d){ d.meses[10].deudas[0].pagado = true; }), '2026-10-15');
  add('deudas-vencida-pagada-con-cierre-confirmado', plan(function(d){
    d.meses[8].cierreReal = {valor: 1000000, calculadoAlConfirmar: 1000000, confirmadoEl: '2026-10-01'}; d.meses[8].deudas[0].pagado = true; }), '2026-10-15');

  // empty and degenerate inputs
  add('vacio-con-arrastre', (function(){ var d = C.vacio(2026); C.arrastre(d, 0, 0, 'declarado'); return d; })(), '2026-06-15');
  add('vacio-sin-arrastre', C.vacio(2026), '2026-06-15');
  add('arrastre-desde-fuera-de-rango', (function(){ var d = C.vacio(2026); C.arrastre(d, 14, 5, 'declarado'); return d; })(), '2026-06-15');
  return out;
}

function compute(api){
  var out = {};
  datasets().forEach(function(e){
    var p = e.iso.split('-'), hoy = {anio: +p[0], mes: +p[1] - 1, dia: +p[2], iso: e.iso};
    var d = api.normalizar(C.copy(e.raw), hoy), ctx = C.copy(e.ctx), j, r = {hoy: hoy, estados: [], flujos: []};
    for(j = 0; j < 12; j++){ r.estados.push(api.estadoMes(d.anio, j, hoy)); r.flujos.push(api.flujosMes(d, j, hoy, ctx)); }
    r.cadena = api.cadena(d, hoy, ctx);
    r.pasivos = api.pasivos(d, hoy);
    r.patrimonioNeto = api.patrimonioNeto(d, hoy, ctx);
    out[e.nombre] = r;
  });
  return out;
}

module.exports = {datasets: datasets, compute: compute, canon: base.canon};
