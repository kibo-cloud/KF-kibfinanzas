'use strict';
// Golden corpus for the financial engine (R3). `compute(api)` runs every engine function over a fixed set of
// inputs and returns ONE plain object; `canon()` serializes it deterministically (NaN and -0 stay visible).
// The same corpus is used before the extraction (functions read globals D / mes) and after it (TGMotor, explicit
// arguments): `api` is an adapter exposing one uniform, explicit-argument signature per function.
// "Today" for every run: 2026-10-04 (current month index 9), passed to every temporal function as an explicit `hoy` (R4.1: the engine
// never reads the system clock). `api.hoyDe` builds it.

var TODAY = '2026-10-04';

function it(n, m, p, extra){
  var o = {nombre: n, monto: m};
  if(p !== undefined) o.pagado = p;
  if(extra) Object.keys(extra).forEach(function(k){ o[k] = extra[k]; });
  return o;
}

// A year with explicit paid state, every section filled, all savings flows, crypto, debt plans, "Del trabajo" rows.
function mixed(anio){
  var meses = [], i;
  for(i = 0; i < 12; i++){
    var ing = [it('Sueldo', 500000 + i * 10000, i <= 9), it('Otros ingresos', i % 3 === 0 ? 25000 : 0, i % 2 === 0)];
    if(i === 2 || i === 5 || i === 9) ing.push(it('Del trabajo', 80000 + i * 1000, false));
    if(i === 3 || i === 10) ing.push(it('  DEL   trabajo ', 41000.5, true));
    var fijos = [it('Alquiler', 150000, i <= 9), it('Luz', 18000 + i * 500, i < 9, {tope: 20000}), it('Gas', i % 2 ? 9000 : 0, false),
                 it('Internet', 12000, i <= 8, {frec: 'semanal', dias: [5]}), it('Celular', 8000, true), it('Transporte', 30000, i <= 9, {tope: 25000})];
    var vars = [it('Supermercado', 90000 + i * 1111.11, i <= 9, {tope: 100000}), it('Comida afuera', 30000, false), it('Salidas', 15000.5, i <= 9),
                it('Ropa', i === 4 ? 70000 : 0, true), it('Salud', 12345.67, i <= 7), it('Otros', 5000, i <= 9)];
    if(i % 2 === 0) vars.push(it('Extra A', 7000, true), it('Extra B', 6500, true), it('Extra C', 4200, true), it('Extra D', 3100, true), it('sin plata', 0, true));
    if(i === 6) vars.push(it('', 1000, true));   // unnamed row
    var deu = [it('Préstamo', 55000, i <= 9)];
    if(i >= 5 && i <= 7) deu.push(it('Tarjeta', i === 7 ? 33334 : 33333, i < 7));
    if(i === 4) deu[0] = it('Préstamo', 0, true);   // ticked without amount
    if(i === 10) deu.push(it('Libre', 20000, false));
    var m = {ingresos: ing, gastosFijos: fijos, gastosVariables: vars, deudas: deu,
      ahorroMesARS: i === 11 ? 0 : 50000, metaAhorroPct: i % 5 === 0 ? 0.2 : 0.1, ahorroMesUSD: i === 2 ? 20 : 0,
      compraARS: i === 4 ? 200000 : 0, compraUSD: i === 4 ? 150 : 0, retiroARS: i === 6 ? 30000 : 0,
      ventaUSD: i === 7 ? 50 : 0, ventaARS: i === 7 ? 70000 : 0, reposicionARS: i === 8 ? 10000 : (i === 10 ? 999999 : 0), movimientos: []};
    if(i === 9) m.movimientos = [{id: 'a1', fecha: '2026-10-02T10:00:00.000Z', sec: 'gastosVariables', nombre: 'Supermercado', monto: 5000, pp: true},
                                 {id: 'a2', fecha: '2026-10-03T10:00:00.000Z', sec: 'gastosFijos', nombre: 'Luz', monto: 700, pp: false}, null, 3];
    meses.push(m);
  }
  return {anio: anio, ahorroAnioAnterior: 120000, usdAnioAnterior: 300, aReponerAnterior: 5000, cotizacionUSD: 1400,
    cripto: [{activo: 'BTC', cantidad: 0.0123, precioUSD: 60000}, {activo: 'ETH', cantidad: 1.5, precioUSD: 2500}, null],
    pagoExplicito: true, meses: meses,
    planDeudas: {
      'Préstamo': {total: 600000, recargo: 10, cuotas: 12, pagadasAntes: 2},
      'Tarjeta': {total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0},
      'Sin filas': {total: 50000, recargo: 5, cuotas: 4, pagadasAntes: 1},
      'Ínfimo': {total: 2, recargo: 0, cuotas: 5, pagadasAntes: 0},
      'Cero': {total: 0, recargo: 0, cuotas: 0, pagadasAntes: 0}
    }, ui: {tema: 'raro', col: {x: true}}};
}

// The same year as an old blob: no pagoExplicito, no pagado flags, text amounts, junk rows.
function legacy(anio){
  var d = mixed(anio), s = ['ingresos', 'gastosFijos', 'gastosVariables', 'deudas'];
  delete d.pagoExplicito;
  d.meses.forEach(function(m, i){
    s.forEach(function(k){ m[k].forEach(function(x){ delete x.pagado; }); });
    if(i === 1){ m.ingresos[0].monto = '1.500'; m.gastosFijos[0].monto = '200000'; m.gastosFijos[1].pagado = false; m.deudas.push(null, 'x', {nombre: 7, monto: 'abc'}); }
    if(i === 2){ m.gastosFijos[0].tope = -5; m.gastosFijos[1].frec = 'xx'; m.gastosFijos[2].dias = [0, 3, 40, 'a']; m.ingresos[0].pagado = true; }
    if(i === 3) delete m.metaAhorroPct;
  });
  d.meses.length = 11; d.cotizacionUSD = 0; d.planDeudas.Tarjeta = null;
  return d;
}

function datasets(){
  return [
    ['mixed2026', mixed(2026)], ['mixed2025', mixed(2025)], ['mixed2027', mixed(2027)],
    ['legacy2026', legacy(2026)], ['legacy2025', legacy(2025)], ['legacy2027', legacy(2027)],
    ['empty2026', {}], ['emptyNull', null], ['emptyString', 'x']
  ];
}

var NUMS = [0, 1, -1, 1.5, -0, '12', '1e3', '0x10', ' 7 ', '1.234,5', 'abc', '', null, undefined, NaN, Infinity, -Infinity, true, {}, [], [3], '3px', 1e21, 5e-7];
var PARSE_IN = ['', ' ', '0', '-', '-0', '-5', '5', '1234', '1.234', '1.234,56', '1,5', ',5', '.5', '0.5', '1.5', '1.55', '1.555', '1.5555', '12.34', '1.2.3', '1,2,3', '1.234.567', '12.345.678,9',
  '$ 1.500', '$1500', '1 500', '1e3', '1E-8', '0,00000001', '0.001', '1,234.5', '12.5,3', '+5', '--5', '5-', '5%', '15 %', '100%', '-10%', '1,', '1.', '.', ',', '1.234,', 'abc', '1a', '0,5', '007', '1.0', '1.00', '0.50', '999.999', '1000.000'];
var CLAVES = ['Del trabajo', 'DEL TRABAJO', '  del   trabajo  ', 'Del Trabajó', 'Árbol ñandú', 'Çafé', '', null, undefined, 42, 'Otros'];
var PLANES = [null, undefined, {}, {cuotas: 0, total: 100}, {total: 100000, recargo: 0, cuotas: 3}, {total: 100000, recargo: 10, cuotas: 3}, {total: 2, recargo: 0, cuotas: 5},
  {total: 100000, recargo: 0, cuotas: 1}, {total: 1000, recargo: 0, cuotas: 7}, {total: '5000', recargo: '2.5', cuotas: 6}, {total: 600000, recargo: 10, cuotas: 12}];

function copy(x){ return JSON.parse(JSON.stringify(x)); }
function range(n){ var o = [], i; for(i = 0; i < n; i++) o.push(i); return o; }
var SEC = ['ingresos', 'gastosFijos', 'gastosVariables', 'deudas'];

function perDataset(api, raw, hoy){
  var d = api.normalizar(copy(raw), hoy), o = {}, names = {};
  o.norm = copy(d);
  o.calc = d.meses.map(function(m){ return api.calc(m); });
  o.serie = api.serie(d);
  o.patrimonio = api.patrimonio(d);
  o.costoDolares = api.costoDolares(d);
  o.criptoUSD = api.criptoUSD(d);
  o.ranking = api.ranking(d);
  o.torta = range(12).map(function(j){ return api.datosTorta(d.meses[j], j); });
  o.topes = range(12).map(function(j){ return ['gastosFijos', 'gastosVariables'].map(function(s){ return d.meses[j][s].map(function(x){ return api.gastadoTope(x, j); }); }); });
  o.sumas = d.meses.map(function(m){ return SEC.map(function(s){ return [api.suma(m[s]), api.sumaPagado(m[s]), api.sumaPagado(m[s], true)]; }); });
  o.cuotaPaga = d.meses.map(function(m, j){ return m.deudas.map(function(x){ return [api.cuotaPaga(j, x), api.estaPagado(j, x)]; }); });
  o.hayDatos = [api.hayDatos(d, false), api.hayDatos(d, true)];
  o.proyeccion = api.proyeccionDeudas(d, hoy);
  Object.keys(d.planDeudas).forEach(function(n){ names[n] = true; });
  d.meses.forEach(function(m){ m.deudas.forEach(function(x){ names[String(x.nombre || '').trim()] = true; }); });
  names['No existe'] = true; names['  Tarjeta '] = true;
  o.deuda = {};
  Object.keys(names).forEach(function(n){
    var r = {plan: api.planDe(d, n)};
    r.estado = range(12).map(function(i){ return api.estadoDeuda(d, n, i, hoy); });
    r.pagadasHasta = range(14).map(function(h){ return api.pagadasHasta(d, n, h); });
    r.pendientesDesde = range(12).map(function(h){ return api.pendientesDesde(d, n, h); });
    r.planDeCarga = range(12).map(function(h){ return api.planDeCarga(d, n, h); });
    r.cargar = [0, 3, 6, 9, 11].map(function(desde){
      var c = copy(d), pc = api.cargarCuotas(c, n, desde, hoy);
      return {desde: desde, pc: pc, deudas: c.meses.map(function(m){ return m.deudas; })};
    });
    o.deuda[n] = r;
  });
  // pure item mutators, on copies
  var c2 = copy(d), x = c2.meses[9].gastosVariables[0];
  o.alternar = [api.alternarPago(9, x), x.pagado, api.alternarPago(9, x), x.pagado];
  var items = [{nombre: 'v', monto: 0, pagado: false}, {nombre: 'p', monto: 100, pagado: false}, {nombre: 'q', monto: 100, pagado: true}, {nombre: 'e', monto: 0}];
  items.forEach(function(t){ api.sumarAItem(t, 1500.5); });
  o.sumarAItem = items;
  return o;
}

function compute(api){
  var out = {datasets: {}, pure: {}}, p = out.pure, hoy = api.hoyDe(new Date(TODAY + 'T12:00:00'));
  datasets().forEach(function(e){ out.datasets[e[0]] = perDataset(api, e[1], hoy); });
  p.mesTope = [2023, 2024, 2025, 2026, 2027, 2028, 0].map(function(a){ return [a, api.mesTope(a, hoy)]; });
  p.mesesCorridos = [2023, 2024, 2025, 2026, 2027, 2028, 0].map(function(a){ return [a, api.mesesCorridos(a, hoy)]; });
  p.mesVacio = api.mesVacio();
  p.num = NUMS.map(function(v){ return api.num(v); });
  p.clave = CLAVES.map(function(v){ return [api.clave(v), api.esRenglonTrabajo(v)]; });
  p.constantes = {SECS: api.SECS, MARCABLE: api.MARCABLE, RENGLON_TRABAJO: api.RENGLON_TRABAJO, TORTA_MAX: api.TORTA_MAX, TOPEABLE: api.TOPEABLE};
  p.parse = PARSE_IN.map(function(s){
    return [s, api.parseMonto(s), api.parseMonto(s, true), api.parseCantidad(s), api.parseCantidad(s, true), api.parsePct(s), api.parsePct(s, true),
      api.parseEntero(s), api.parseEntero(s, true), api.parcial(s, api.parseMonto), api.parcial(s, api.parseEntero)];
  });
  p.parseOtros = [null, undefined, 12, 0, -0, 1.5].map(function(a){ return [api.parseMonto(a), api.parseCantidad(a), api.parseEntero(a)]; });
  p.reparto = PLANES.map(function(pl){ return [api.repartoCuotas(pl), api.totalConRecargo(pl), api.valorCuota(pl)]; });
  return out;
}

function canon(x){
  return JSON.stringify(x, function(k, v){
    if(typeof v === 'number'){
      if(Number.isNaN(v)) return 'NaN';
      if(v === Infinity) return 'Infinity';
      if(v === -Infinity) return '-Infinity';
      if(Object.is(v, -0)) return '-0';
    }
    return v;
  });
}

module.exports = {TODAY: TODAY, datasets: datasets, compute: compute, canon: canon};
