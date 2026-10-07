'use strict';
// N5 (pre-Alpha security audit). S-1: maps keyed by user-typed names never resolve inherited Object.prototype members
// ("__proto__", "constructor", "toString") and never write into a prototype.
var test = require('node:test');
var assert = require('node:assert/strict');
var vm = require('node:vm');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');

var NOMBRES = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
var TRAB_FUNCS = ['statsClientes', 'cobranza', 'clientes', 'fuentes', 'carpetas', 'clave', 'saldoFac', 'venceFac', 'diasEntre', 'utcDe', 'sumarDias', 'hoyISO', 'esISO',
  'normTrab', 'formaValida', 'stockValido', 'nomCarpeta', 'colorValido', 'catValida', 'revValida', 'numEstricto', 'tjId', 'sinAsignar', 'aplicado', 'dos'];

function trabApp(t){
  var app = la.loadApp({today: '2026-10-15', funcs: TRAB_FUNCS, vars: ['COLCARP', 'CATS', 'FORMAS']});
  app.T = app.normTrab(t);
  return app;
}
function protoLimpio(app){
  // the context's own Object.prototype (the realm the app code runs in) and the host one stay clean
  assert.equal(vm.runInContext('JSON.stringify([({}).n, ({}).pend, ({}).total, ({}).venc, ({}).medidas])', app), '[null,null,null,null,null]');
  assert.equal(({}).n, undefined);
  assert.equal(Object.prototype.total, undefined);
  assert.equal(Object.total, undefined);
}

test('S-1 statsClientes and cobranza list a client named like an Object.prototype member and pollute nothing', function(){
  var app = trabApp({facturas: NOMBRES.map(function(n, i){ return {id: 'f' + i, cliente: n, tipo: 'factura', monto: 500 + i, fecha: '2026-10-10', plazo: 0}; })});
  var st = app.plain(app.statsClientes());
  assert.deepEqual(st.map(function(r){ return r.nombre; }).sort(), NOMBRES.slice().sort());
  st.forEach(function(r){ assert.equal(r.n, 1, r.nombre); assert.ok(r.pend >= 500, r.nombre); });
  var cz = app.plain(app.cobranza());
  assert.deepEqual(cz.clientes.map(function(r){ return r.nombre; }).sort(), NOMBRES.slice().sort());
  cz.clientes.forEach(function(r){ assert.equal(r.n, 1, r.nombre); });
  protoLimpio(app);
});

test('S-1 the client, source and folder lists keep entries named like Object.prototype members', function(){
  var app = trabApp({facturas: NOMBRES.map(function(n, i){ return {id: 'f' + i, cliente: n, fuente: n, tipo: 'simple', contado: true, monto: 100, fecha: '2026-10-10'}; }),
    productos: NOMBRES.map(function(n, i){ return {id: 'p' + i, nombre: 'Prod ' + i, carpeta: n, precio: 1}; })});
  assert.deepEqual(app.plain(app.clientes()).sort(), NOMBRES.slice().sort());
  assert.deepEqual(app.plain(app.fuentes()).sort(), NOMBRES.slice().sort());
  var cs = app.plain(app.carpetas());
  assert.deepEqual(cs.map(function(c){ return c.nombre; }).sort(), NOMBRES.slice().sort());
  cs.forEach(function(c){ assert.equal(c.n, 1, c.nombre); });
  protoLimpio(app);
});

test('S-1 resumenTrab groups income by a source named like an Object.prototype member', function(){
  var H = require('./fixtures/r45-harness');
  var T = C.copy(H.TRAB_VACIO);
  T.facturas = NOMBRES.map(function(n, i){ return {id: 'f' + i, cliente: '', fuente: n, tipo: 'simple', contado: true, monto: 100 + i, fecha: '2026-10-10', forma: 'efectivo'}; });
  var app = H.appVista(null, null, null, '2026-10-15', {funcs: ['normTrab', 'formaValida', 'stockValido', 'nomCarpeta', 'colorValido', 'catValida', 'revValida', 'numEstricto', 'tjId', 'clave', 'aplicado'],
    vars: ['COLCARP', 'CATS', 'FORMAS']});
  app.T = app.normTrab(T);
  var r = app.plain(app.resumenTrab());
  assert.deepEqual(r.porFuente.map(function(x){ return x.nombre; }).sort(), NOMBRES.slice().sort());
  r.porFuente.forEach(function(x){ assert.equal(x.n, 1, x.nombre); });
  protoLimpio(app);
});

test('S-1 planDe: a debt named like an Object.prototype member has no plan unless one was saved for it', function(){
  var M = la.loadMotor(), hoy = M.hoyDe(new Date('2026-10-15T12:00:00'));
  var app = la.loadApp({today: '2026-10-15', funcs: ['planDe', 'clave']});
  var d = M.normalizar({anio: 2026}, hoy);
  NOMBRES.forEach(function(n){ assert.equal(app.planDe(d, n), null, n); });
  // also on a plain-object map (a JSON clone, as duplicar builds the new year before it is reloaded)
  NOMBRES.forEach(function(n){ assert.equal(app.planDe({planDeudas: JSON.parse('{"Préstamo":{"cuotas":2}}')}, n), null, 'plain map: ' + n); });
  // a plan saved for such a name is the debt's own (the map has no prototype to write into)
  d.planDeudas['__proto__'] = {total: 1000, cuotas: 4, recargo: 0, pagadasAntes: 0};
  assert.deepEqual(app.plain(app.planDe(d, '__proto__')), {total: 1000, cuotas: 4, recargo: 0, pagadasAntes: 0});
  assert.equal(app.planDe(d, 'cuotas'), null);
  assert.deepEqual(app.plain(Object.keys(d.planDeudas)), ['__proto__']);
  // and it survives a save/load round trip
  var d2 = M.normalizar(JSON.parse(JSON.stringify(d)), hoy);
  assert.deepEqual(app.plain(app.planDe(d2, '__proto__')), {recargo: 0, total: 1000, cuotas: 4, pagadasAntes: 0});
  assert.equal(app.planDe(d2, 'constructor'), null);
});

test('S-1 ranking, pasivos and proyeccionDeudas count rows named like Object.prototype members', function(){
  var M = la.loadMotor(), hoy = M.hoyDe(new Date('2026-10-15T12:00:00'));
  var d = M.normalizar({anio: 2026}, hoy);
  d.meses[2].gastosVariables = NOMBRES.map(function(n, i){ return {nombre: n, monto: 100 * (i + 1), pagado: true}; });
  d.meses[2].deudas = NOMBRES.map(function(n){ return {nombre: n, monto: 50, pagado: false}; });
  var rk = JSON.parse(JSON.stringify(M.ranking(d)));
  assert.deepEqual(rk.map(function(x){ return x.nombre; }).sort(), NOMBRES.slice().sort());
  rk.forEach(function(x){ assert.equal(typeof x.monto, 'number', x.nombre); });
  var pv = JSON.parse(JSON.stringify(M.pasivos(d, hoy)));
  assert.equal(pv.total, 50 * NOMBRES.length);
  assert.deepEqual(pv.detalle.map(function(x){ return x.nombre; }).sort(), NOMBRES.slice().sort());
  // proyeccionDeudas: a plan for "constructor" is projected
  var app = la.loadApp({today: '2026-10-15', funcs: ['proyeccionDeudas']});
  var d2 = M.normalizar({anio: 2026, planDeudas: {constructor: {total: 400, cuotas: 4}}}, hoy);
  d2.meses[0].deudas = [{nombre: 'constructor', monto: 100, pagado: true}];
  var pr = app.plain(app.proyeccionDeudas(d2, hoy));
  assert.deepEqual(pr.map(function(x){ return x.nombre; }), ['constructor']);
  assert.equal(({}).monto, undefined);
});

// ── S-2: restore only writes real year keys ──
var H = require('./fixtures/r45-harness');
function copiaCon(claves){ var o = {}; claves.forEach(function(k){ o[k] = C.vacio(2026); }); return JSON.stringify({app: 'kibFinanzas', version: 1, anios: o}); }

test('S-2 escribirAnios writes only valid year keys (1900-2200, no leading zero) and reports the rest as skipped', function(){
  var ls = H.fakeStorage({});
  var app = H.appAlmacen(ls);
  var claves = ['0000', '0999', '12345', '1899', '2201', '2026'], anios = JSON.parse(copiaCon(claves)).anios;
  var r = app.plain(app.escribirAnios(anios, claves));
  assert.deepEqual(Object.keys(ls.d), ['kibo.datos.2026']);
  Object.keys(ls.d).forEach(function(k){ assert.ok(app.claveMia(k), k); });
  assert.equal(r.ultimo, 2026);
  assert.deepEqual(r.fallaron, []);
  assert.deepEqual(r.saltados, ['0000', '0999', '12345', '1899', '2201']);
});

test('S-2 restaurarTexto offers only the valid years and tells which entries it skipped', function(){
  var ls = H.fakeStorage({});
  var app = H.appAlmacen(ls); app.D = app.normalizar({anio: 2026}, app.hoy);
  app.restaurarTexto(copiaCon(['0999', '2026']));
  assert.equal(app.g.hojas.length, 1);
  assert.ok(app.g.hojas[0].indexOf('<b>2026</b>') >= 0, app.g.hojas[0]);
  assert.ok(app.g.hojas[0].indexOf('0999') < 0, 'the invalid key is not offered as a year');
  app.pendiente();
  assert.deepEqual(Object.keys(ls.d).filter(function(k){ return k.indexOf('kibo.datos.') === 0; }), ['kibo.datos.2026']);
  assert.equal(app.g.alertas.length, 1);
  assert.ok(app.g.alertas[0][1].indexOf('0999') >= 0, app.g.alertas[0][1]);
});

test('S-2 a backup whose only keys are invalid years is reported as empty and writes nothing', function(){
  var ls = H.fakeStorage({});
  var app = H.appAlmacen(ls); app.D = app.normalizar({anio: 2026}, app.hoy);
  app.restaurarTexto(copiaCon(['0000', '12345']));
  assert.equal(app.pendiente, null);
  assert.deepEqual(app.g.alertas.map(function(a){ return a[0]; }), ['Copia vacía']);
  assert.deepEqual(Object.keys(ls.d), []);
});
