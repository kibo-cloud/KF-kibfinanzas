'use strict';
// S3: quick sales ("productos rápidos" inside Trabajo). A quick sale stores a COPY of the product (concepto, precio, costo, forma) as a
// 'simple' factura with no product id, so editing or deleting a product never rewrites a past sale. A stale tab (another tab saved
// Trabajo after this one loaded it) refuses every quick-sale / product change up front and changes nothing in memory.
var test = require('node:test');
var assert = require('node:assert/strict');
var H = require('./fixtures/r45-harness');
var la = require('./load-app');
var COLCARP = new Function(la.extractVar('COLCARP') + ' return COLCARP;')();

var FUNCS = ['venderProducto', 'tocarProducto', 'guardarProducto', 'borrarProducto', 'trabVieja', 'prodPorId', 'tjId', 'antesDeCambiar', 'deshacerTj',
  'stockValido', 'nomCarpeta', 'colorValido', 'carpetas', 'colorLibre', 'clave', 'catValida', 'nombreForma', 'resumenTrab', 'saldoFac', 'venceFac',
  'sinAsignar', 'sumarDias', 'diasEntre', 'ganancia', 'paseAlModelo', 'aplicado', 'acreditaEl'];

// fields of the product editor sheet (#pxNombre...), read by guardarProducto through val/leerMonto (stubbed: number parsing is tested elsewhere)
function app(ls, today, extra){
  var campos = {}, avisos = {innerHTML: '', textContent: ''}, notas = [];
  var g = {COLCARP: COLCARP, tjAntes: null, tab: 'trabajo', px: null, carpSel: '', carpSelGeneral: false, renders: 0, toasts: [], cobros: [], listas: 0, confirmados: 0, hojasCerradas: 0};
  g.document = {activeElement: null, getElementById: function(id){ return id === 'avisos' ? avisos : /^px/.test(id) ? {value: campos[id] || '', focus: function(){}, select: function(){}} : null; }};
  g.val = function(id){ return String(campos[id] || ''); };
  g.leerMonto = function(id){ var r = String(campos[id] || '').trim(); if(!r) return {ok: false, vacio: true, v: 0, msg: ''}; var v = Number(r); return isNaN(v) ? {ok: false, v: 0, msg: 'no entendí'} : v < 0 ? {ok: false, v: v, msg: 'no puede ser negativo'} : {ok: true, v: v}; };
  g.parseEntero = function(s){ var n = Number(String(s).trim()); return Number.isInteger(n) ? n : NaN; };
  g.errorEn = function(id, t){ notas.push([id, t]); };
  g.renderTrabajo = function(){ g.renders++; };
  g.toast = function(t){ g.toasts.push(t); };
  g.abrirCobroProd = function(id){ g.cobros.push(id); };
  g.abrirProductos = function(){ g.listas++; };
  g.cerrarHoja = function(){ g.hojasCerradas++; };
  g.fARS = function(n){ return '$' + Math.round(n); };
  g.confirmar = function(t, c, e, fn){ g.confirmados++; fn(); };
  Object.keys(extra || {}).forEach(function(k){ g[k] = extra[k]; });
  var a = H.appAlmacen(ls, today || '2026-10-15', g, FUNCS.concat(extra && extra.funcs || []));
  a.campos = campos; a.avisosEl = avisos; a.notas = notas;
  return a;
}
function storeCon(productos, facturas, rev){
  var t = Object.assign({}, H.TRAB_VACIO, {modo: 'simple', productos: productos, facturas: facturas || []});
  if(rev != null) t.rev = rev;
  return t;
}
var CAFE = {id: 'p1', nombre: 'Café', precio: 1500, costo: 600, forma: 'efectivo', stock: 3, carpeta: 'Bebidas', color: 'azul'};
var MEDIA = {id: 'p2', nombre: 'Medialuna', precio: 800, costo: 0, forma: 'transferencia', stock: null, carpeta: '', color: ''};
var PREG = {id: 'p3', nombre: 'Torta', precio: 9000, costo: 0, forma: '', stock: 1, carpeta: '', color: ''};
function cargada(productos, facturas, extra){
  var ls = H.fakeStorage({'kibo.trabajo': JSON.stringify(storeCon(productos.map(function(p){ return Object.assign({}, p); }), facturas, 4))});
  var a = app(ls, '2026-10-15', extra); a.T = a.leerTrab();
  return {a: a, ls: ls};
}
// another tab saves Trabajo: the stored revision moves past the one this tab holds
function otraPestanaGuarda(ls){ var t = JSON.parse(ls.d['kibo.trabajo']); t.rev = (t.rev || 0) + 1; t.tope = 123; ls.d['kibo.trabajo'] = JSON.stringify(t); }
function venta(id, concepto, monto, forma, fecha, extra){
  return Object.assign({id: id, tipo: 'simple', concepto: concepto, cantidad: 1, precio: monto, monto: monto, costo: 0, contado: true, fecha: fecha, forma: forma}, extra || {});
}

// ── task 0: a stale tab refuses before changing anything ──
test('S3-0 a quick sale in a stale tab (another tab saved) is refused: no sale, no stock change, other-tab notice, nothing written', function(){
  var c = cargada([CAFE]); otraPestanaGuarda(c.ls);
  var antes = c.ls.d['kibo.trabajo'];
  c.a.venderProducto('p1');
  assert.equal(c.a.T.facturas.length, 0, 'no sale in memory');
  assert.equal(c.a.T.productos[0].stock, 3, 'stock untouched in memory');
  assert.equal(c.a.tjAntes, null, 'no undo snapshot of a change that never happened');
  assert.equal(c.ls.d['kibo.trabajo'], antes, 'storage untouched');
  assert.equal(c.a.obsoleta, true);
  assert.match(c.a.avisosEl.innerHTML, /otra pestaña/);
  assert.deepEqual(c.a.g.toasts, [], 'no "sold" toast');
});

test('S3-0 a tab already marked stale refuses a quick sale and a paid-with sale from the sheet too', function(){
  var c = cargada([CAFE, PREG]); c.a.obsoleta = true;
  c.a.venderProducto('p1'); c.a.venderProducto('p3', 'efectivo'); c.a.tocarProducto('p1');
  assert.equal(c.a.T.facturas.length, 0);
  assert.deepEqual([c.a.T.productos[0].stock, c.a.T.productos[1].stock], [3, 1]);
  assert.match(c.a.avisosEl.innerHTML, /otra pestaña/);
});

test('S3-0 saving a product edit in a stale tab is refused: the product keeps its fields, the sheet says why', function(){
  var c = cargada([CAFE]); otraPestanaGuarda(c.ls);
  c.a.px = {id: 'p1', forma: 'transferencia', color: 'rojo'};
  Object.assign(c.a.campos, {pxNombre: 'Café doble', pxPrecio: '2500', pxCosto: '', pxStock: '9', pxCarp: 'Otra'});
  c.a.guardarProducto();
  assert.deepEqual(c.a.plain(c.a.T.productos[0]), Object.assign({}, CAFE, {creada: ''}), 'nothing changed in memory');
  assert.equal(c.a.g.listas, 0, 'the editor stays open');
  assert.equal(c.a.obsoleta, true);
  assert.ok(c.a.notas.some(function(n){ return n[0] === 'pxNota' && /otra pestaña/.test(n[1]); }), 'the sheet explains the refusal');
});

test('S3-0 a new product in a stale tab is not added', function(){
  var c = cargada([CAFE]); c.a.obsoleta = true;
  c.a.px = {id: null, forma: '', color: ''};
  Object.assign(c.a.campos, {pxNombre: 'Alfajor', pxPrecio: '700'});
  c.a.guardarProducto();
  assert.equal(c.a.T.productos.length, 1);
});

test('S3-0 deleting a product in a stale tab is refused before asking, and again if the tab went stale while the question was open', function(){
  var c = cargada([CAFE]); otraPestanaGuarda(c.ls);
  c.a.borrarProducto('p1');
  assert.equal(c.a.g.confirmados, 0, 'no question for a delete that cannot happen');
  assert.equal(c.a.T.productos.length, 1);
  var d = cargada([CAFE], [], {confirmar: function(t, cu, e, fn){ otraPestanaGuarda(d.ls); fn(); }});
  d.a.borrarProducto('p1');
  assert.equal(d.a.T.productos.length, 1, 'the confirm callback re-checks');
  assert.equal(d.a.obsoleta, true);
});

test('S3-0 an up-to-date tab still sells, edits and deletes (the guard is not a lock)', function(){
  var c = cargada([CAFE, MEDIA]);
  c.a.venderProducto('p1');
  assert.equal(c.a.T.facturas.length, 1);
  c.a.px = {id: 'p2', forma: 'transferencia', color: ''};
  Object.assign(c.a.campos, {pxNombre: 'Medialuna', pxPrecio: '900', pxCosto: '', pxStock: '', pxCarp: ''});
  c.a.guardarProducto();
  assert.equal(c.a.prodPorId('p2').precio, 900);
  c.a.borrarProducto('p2');
  assert.equal(c.a.T.productos.length, 1);
  assert.equal(JSON.parse(c.ls.d['kibo.trabajo']).productos.length, 1, 'saved');
  assert.equal(c.a.obsoleta, false);
});

// ── task 1: quick sales, covered ──
test('S3-1 normTrab keeps every product field across a save and a reload (round trip)', function(){
  var c = cargada([CAFE, MEDIA, PREG]);
  var otra = app(c.ls); otra.T = otra.leerTrab();
  assert.deepEqual(otra.plain(otra.T.productos), [CAFE, MEDIA, PREG].map(function(p){ return Object.assign({}, p, {creada: ''}); }));
  assert.equal(c.a.guardarTrab(true), true);
  var t2 = app(c.ls); t2.T = t2.leerTrab();
  assert.deepEqual(t2.plain(t2.T.productos), otra.plain(otra.T.productos), 'what is saved reads back the same');
  assert.equal(t2.normTrab({productos: [{id: 'x', nombre: '  ', precio: 5}]}).productos.length, 0, 'a product without a name is dropped');
});

test('S3-1 a quick sale stores a copy of the product (name, price, cost, payment), today, cash-collected, and takes one unit of stock', function(){
  var c = cargada([CAFE]);
  c.a.venderProducto('p1');
  var f = c.a.plain(c.a.T.facturas[0]);
  assert.deepEqual([f.tipo, f.concepto, f.cantidad, f.precio, f.monto, f.costo, f.contado, f.fecha, f.forma, f.plazo], ['simple', 'Café', 1, 1500, 1500, 600, true, '2026-10-15', 'efectivo', 0]);
  assert.equal('producto' in f || 'idProducto' in f, false, 'the sale does not point at the product');
  assert.equal(c.a.T.productos[0].stock, 2);
  assert.equal(JSON.parse(c.ls.d['kibo.trabajo']).facturas.length, 1, 'saved');
  assert.match(c.a.g.toasts[0], /Café · \$1500 · efectivo · quedan 2/);
});

test('S3-1 the sheet payment overrides the product default only for that sale; no stock control keeps stock null', function(){
  var c = cargada([MEDIA]);
  c.a.venderProducto('p2', 'efectivo');
  assert.deepEqual([c.a.T.facturas[0].forma, c.a.T.productos[0].forma, c.a.T.productos[0].stock], ['efectivo', 'transferencia', null]);
});

test('S3-1 sold out: one tap opens the payment sheet instead of selling; "Vender igual" sells and the stock goes negative', function(){
  var c = cargada([Object.assign({}, CAFE, {stock: 0})]);
  c.a.tocarProducto('p1');
  assert.deepEqual([c.a.T.facturas.length, c.a.g.cobros], [0, ['p1']]);
  c.a.venderProducto('p1', 'transferencia');
  assert.deepEqual([c.a.T.facturas.length, c.a.T.productos[0].stock], [1, -1]);
  assert.match(c.a.g.toasts[0], /sin stock/);
});

test('S3-1 "Preguntar siempre" (no default payment): a tap asks, never sells; the chosen payment is stored', function(){
  var c = cargada([PREG]);
  c.a.tocarProducto('p3'); c.a.venderProducto('p3');
  assert.deepEqual([c.a.T.facturas.length, c.a.g.cobros], [0, ['p3', 'p3']]);
  c.a.venderProducto('p3', 'efectivo');
  assert.deepEqual([c.a.T.facturas.length, c.a.T.facturas[0].forma, c.a.T.productos[0].stock], [1, 'efectivo', 0]);
});

test('S3-1 Deshacer after a quick sale removes the sale and gives the unit of stock back, saved', function(){
  var c = cargada([CAFE], [venta('v0', 'Viejo', 100, 'efectivo', '2026-10-01')]);
  c.a.venderProducto('p1');
  assert.deepEqual([c.a.T.facturas.length, c.a.T.productos[0].stock], [2, 2]);
  c.a.deshacerTj();
  assert.deepEqual([c.a.T.facturas.length, c.a.T.facturas[0].id, c.a.T.productos[0].stock], [1, 'v0', 3]);
  var s = JSON.parse(c.ls.d['kibo.trabajo']);
  assert.deepEqual([s.facturas.length, s.productos[0].stock], [1, 3]);
});

test('S3-1 editing a product never changes past sales (they keep their copy of name, price, cost and payment)', function(){
  var c = cargada([CAFE]);
  c.a.venderProducto('p1'); c.a.venderProducto('p1', 'transferencia');
  var antes = c.a.plain(c.a.T.facturas);
  c.a.px = {id: 'p1', forma: 'transferencia', color: 'rojo'};
  Object.assign(c.a.campos, {pxNombre: 'Café grande', pxPrecio: '2200', pxCosto: '900', pxStock: '10', pxCarp: 'Cafetería'});
  c.a.guardarProducto();
  assert.deepEqual([c.a.prodPorId('p1').nombre, c.a.prodPorId('p1').precio, c.a.prodPorId('p1').stock], ['Café grande', 2200, 10]);
  assert.deepEqual(c.a.plain(c.a.T.facturas), antes, 'sales untouched in memory');
  assert.deepEqual(JSON.parse(c.ls.d['kibo.trabajo']).facturas.map(function(f){ return [f.concepto, f.precio, f.monto, f.costo, f.forma]; }),
    [['Café', 1500, 1500, 600, 'efectivo'], ['Café', 1500, 1500, 600, 'transferencia']], 'and saved');
});

test('S3-1 product editor rules: name, price > 0, cost not above price, whole stock; a refused save changes nothing', function(){
  var c = cargada([CAFE]);
  var casos = [[{pxNombre: '', pxPrecio: '10'}, /Falta el nombre/], [{pxNombre: 'X', pxPrecio: ''}, /Falta el precio/], [{pxNombre: 'X', pxPrecio: '0'}, /mayor que cero/],
    [{pxNombre: 'X', pxPrecio: '10', pxCosto: '20'}, /Te cuesta más/], [{pxNombre: 'X', pxPrecio: '10', pxStock: '1.5'}, /Stock/]];
  casos.forEach(function(k){
    c.a.px = {id: 'p1', forma: 'efectivo', color: ''}; Object.keys(c.a.campos).forEach(function(x){ delete c.a.campos[x]; }); Object.assign(c.a.campos, k[0]);
    c.a.notas.length = 0; c.a.guardarProducto();
    assert.match(c.a.notas[0][1], k[1]);
    assert.deepEqual(c.a.plain(c.a.T.productos[0]), Object.assign({}, CAFE, {creada: ''}));
  });
});

test('S3-1 deleting a product keeps every sale made with it', function(){
  var c = cargada([CAFE, MEDIA]);
  c.a.venderProducto('p1'); c.a.venderProducto('p2');
  c.a.borrarProducto('p1');
  assert.deepEqual([c.a.T.productos.length, c.a.T.facturas.length, c.a.T.facturas[0].concepto], [1, 2, 'Café']);
  assert.equal(JSON.parse(c.ls.d['kibo.trabajo']).facturas.length, 2);
});

test('S3-1 month totals: Efectivo vs Digital (transferencia, echeq, otra), realized only: a future-dated sale and a pending invoice are not counted', function(){
  var fs = [venta('a', 'A', 1000, 'efectivo', '2026-10-02'), venta('b', 'B', 2000, 'transferencia', '2026-10-15'), venta('c', 'C', 300, 'echeq', '2026-10-10'),
    venta('d', 'D', 40, 'otra', '2026-10-01'), venta('e', 'E', 5000, 'efectivo', '2026-10-20'), venta('f', 'F', 7000, 'efectivo', '2026-09-30'),
    {id: 'g', tipo: 'factura', cliente: 'X', concepto: 'Plazo', monto: 9000, fecha: '2026-10-03', contado: false, plazo: 30, forma: 'efectivo'}];
  var c = cargada([CAFE], fs);
  var r = c.a.resumenTrab();
  assert.deepEqual([r.mesEfe, r.mesDig, r.aAcreditar], [1000, 2340, 5000]);
  c.a.venderProducto('p1'); c.a.venderProducto('p1', 'transferencia');
  r = c.a.resumenTrab();
  assert.deepEqual([r.mesEfe, r.mesDig], [2500, 3840], 'each quick sale lands on its payment side');
});
