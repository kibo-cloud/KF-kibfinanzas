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

// ── S-3: type hygiene of normalizar and a size cap on restore ──
test('S-3 normalizar keeps actualizado and cotizacionFecha only as text, and still keeps unknown fields', function(){
  var M = la.loadMotor(), hoy = M.hoyDe(new Date('2026-10-15T12:00:00'));
  var raros = [{x: 1}, ['2026-01-01'], 20260101, true, null];
  raros.forEach(function(v){
    var d = M.normalizar({anio: 2026, actualizado: v, cotizacionFecha: v}, hoy);
    assert.equal(d.actualizado, '', JSON.stringify(v));
    assert.equal(d.cotizacionFecha, '', JSON.stringify(v));
  });
  var ok = M.normalizar({anio: 2026, actualizado: '2026-09-01T10:00:00.000Z', cotizacionFecha: '2026-09-02', campoNuevo: {a: 1}, meses: [{campoMes: 7}]}, hoy);
  assert.equal(ok.actualizado, '2026-09-01T10:00:00.000Z');
  assert.equal(ok.cotizacionFecha, '2026-09-02');
  assert.deepEqual(JSON.parse(JSON.stringify(ok.campoNuevo)), {a: 1}, 'unknown year-level fields survive (design §8)');
  assert.equal(ok.meses[0].campoMes, 7, 'unknown month-level fields survive (design §8)');
});

test('S-3 restoring a file over 10 MB is refused with a visible message and reads nothing', function(){
  var ls = H.fakeStorage({});
  var leidos = 0;
  var app = H.appAlmacen(ls, null, {FileReader: function(){ leidos++; this.readAsText = function(){}; }}, ['restaurarCopia']);
  app.D = app.normalizar({anio: 2026}, app.hoy);
  app.restaurarCopia({size: 10 * 1024 * 1024 + 1, name: 'copia.json'});
  assert.equal(leidos, 0, 'the file is not read');
  assert.equal(app.g.alertas.length, 1);
  assert.match(app.g.alertas[0][0], /grande/);
  app.restaurarCopia({size: 2000, name: 'copia.json'});
  assert.equal(leidos, 1, 'a normal file is read');
  var grande = JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: C.vacio(2026)}, relleno: 'x'.repeat(10 * 1024 * 1024)});
  app.restaurarTexto(grande);
  assert.equal(app.pendiente, null, 'no restore is offered');
  assert.equal(app.g.alertas.length, 2);
  assert.match(app.g.alertas[1][0], /grande/);
  assert.deepEqual(Object.keys(ls.d), []);
});

// ── S-5: markup robustness ──
var M1 = '/*DATOS_' + 'INICIO*/', M2 = '/*DATOS_' + 'FIN*/';

test('S-5 listaHistorial escapes the stored size of each saved backup', function(){
  var app = la.loadApp({funcs: ['listaHistorial', 'esc', 'fechaCorta'], vars: ['ICO'], globals: {
    hayCarpeta: function(){ return true; },
    leerHist: function(){ return [{f: '2026-10-01T10:00:00Z', kb: '<img src=x onerror=alert(1)>', n: 'c"1.json'}]; }}});
  var h = app.listaHistorial();
  assert.ok(h.indexOf('<img') < 0, h);
  assert.ok(h.indexOf('&lt;img src=x onerror=alert(1)&gt; KB') >= 0, h);
});

test('S-5 pildora and filaAj escape their text by default; the constant texts the app passes render unchanged', function(){
  var p = {innerHTML: '', className: ''};
  var app = la.loadApp({funcs: ['pildora', 'filaAj', 'esc'], vars: ['ICO'], globals: {
    document: {getElementById: function(){ return p; }}, setTimeout: function(){ return 1; }, clearTimeout: function(){}, ultPild: 0, tPild: null}});
  app.pildora('<img src=x onerror=alert(1)>');
  assert.ok(p.innerHTML.indexOf('<img') < 0 && p.innerHTML.indexOf('&lt;img') >= 0, p.innerHTML);
  app.pildora('Cambios guardados');
  assert.ok(p.innerHTML.indexOf('<span>Cambios guardados</span>') >= 0);
  var f = app.filaAj('copia', '<b>x</b>', {t: '<i>y</i>', clase: 'a"b', id: 'c"d'}, 'copia');
  assert.ok(f.indexOf('<b>x</b>') < 0 && f.indexOf('<i>y</i>') < 0, f);
  assert.ok(f.indexOf('&lt;b&gt;x&lt;/b&gt;') >= 0 && f.indexOf('class="a&quot;b"') >= 0 && f.indexOf('id="c&quot;d"') >= 0, f);
  assert.equal(app.filaAj('zz', 'Dónde viven tus datos', {t: 'Revisando…', id: 'almacMini'}, 'ajVista', ' data-v="datos"'),
    '<button class="faj" data-act="ajVista" data-v="datos"><span class="ico"></span><span class="tx"><b>Dónde viven tus datos</b><small id="almacMini">Revisando…</small></span><i class="chev"></i></button>');
});

test('S-5 leerEmbebido does not cut the data when a name contains the end marker', function(){
  var M = la.loadMotor(), hoy = M.hoyDe(new Date('2026-10-15T12:00:00'));
  var d = M.normalizar({anio: 2026}, hoy);
  d.meses[0].gastosVariables[0].nombre = 'raro ' + M2 + ' fin';
  d.meses[0].gastosVariables[0].monto = 123;
  var texto = '\n' + M1 + '\n' + JSON.stringify(d) + '\n' + M2 + '\n';
  var app = la.loadApp({funcs: ['leerEmbebido'], vars: ['M1', 'M2'], globals: {document: {getElementById: function(){ return {textContent: texto}; }}}});
  var r = app.plain(app.leerEmbebido());
  assert.equal(r.meses[0].gastosVariables[0].nombre, 'raro ' + M2 + ' fin');
  assert.equal(r.meses[0].gastosVariables[0].monto, 123);
});

test('S-5 "Versión para PC" never writes the end marker inside the embedded data', async function(){
  var M = la.loadMotor(), hoy = M.hoyDe(new Date('2026-10-15T12:00:00'));
  var bajado = null, base = '<html><script id="datos" type="application/json">\n' + M1 + '\n{\n}\n' + M2 + '\n</script></html>';
  var app = la.loadApp({funcs: ['versionPC'], vars: ['M1', 'M2'], globals: {
    sucio: false, window: {fetch: true}, alerta: function(){},
    fetch: function(){ return Promise.resolve({text: function(){ return base; }}); },
    descargar: function(t){ bajado = t; }}});
  app.D = M.normalizar({anio: 2026}, hoy);
  app.D.meses[0].gastosVariables[0].nombre = 'raro ' + M2 + ' </script> fin';
  app.versionPC();
  await new Promise(function(r){ setTimeout(r, 20); });
  assert.ok(bajado, 'a file was produced');
  var i = bajado.indexOf(M1), j = bajado.indexOf(M2);
  assert.equal(bajado.indexOf(M2, j + 1), -1, 'the end marker appears once');
  var d = JSON.parse(bajado.slice(i + M1.length, j));
  assert.equal(d.meses[0].gastosVariables[0].nombre, 'raro ' + M2 + ' </script> fin');
});

// ── S-4: Content-Security-Policy (L8: the inline scripts by sha256 hash, see tests/l8.csp.test.js; everything else locked to this origin) ──
test('S-4 index.html and privacidad.html carry the same CSP meta, before any script, with no eval and no other origin', function(){
  var fs = require('fs'), path = require('path');
  var metas = ['index.html', 'privacidad.html'].map(function(f){
    var src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    var m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(src);
    assert.ok(m, f + ' has the CSP meta');
    var s = src.indexOf('<script');
    assert.ok(s < 0 || m.index < s, f + ': the CSP comes before the first script');
    assert.ok(src.indexOf('<meta charset="utf-8">') < m.index, f + ': after the charset');
    assert.equal(/\son[a-z]+="/i.test(src), false, f + ': no inline event handler attributes');
    return m[1];
  });
  assert.equal(metas[0], metas[1]);
  var dir = {};
  metas[0].split(';').forEach(function(p){ var t = p.trim().split(/\s+/); dir[t[0]] = t.slice(1); });
  assert.deepEqual(dir['object-src'], ["'none'"]);
  assert.deepEqual(dir['base-uri'], ["'none'"]);
  assert.deepEqual(dir['form-action'], ["'none'"]);
  assert.deepEqual(dir['default-src'], ["'self'"]);
  assert.deepEqual(dir['connect-src'], ["'self'"]);
  Object.keys(dir).forEach(function(k){
    dir[k].forEach(function(v){
      var hash = k === 'script-src' && /^'sha256-[A-Za-z0-9+/]{43}='$/.test(v), inline = k === 'style-src' && v === "'unsafe-inline'";
      assert.ok(hash || inline || ["'self'", "'none'", 'data:', 'blob:'].indexOf(v) >= 0, k + ' allows only this origin: ' + v);
    });
  });
  assert.equal(metas[0].indexOf('unsafe-eval'), -1);
});
