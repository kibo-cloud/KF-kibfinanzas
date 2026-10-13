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
  g.hojas = []; g.abrirHoja = function(h){ g.hojas.push(h); };
  g.fARS = function(n){ return '$' + Math.round(n); };
  g.confirmar = function(t, c, e, fn){ g.confirmados++; fn(); };
  Object.keys(extra || {}).forEach(function(k){ g[k] = extra[k]; });
  var a = H.appAlmacen(ls, today || '2026-10-15', g, FUNCS.concat(extra && extra.funcs || []));
  a.campos = campos; a.avisosEl = avisos; a.notas = notas; a.g = g;   // the counters of THIS test's stubs (the harness copies g into its own object)
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

// ── task 2 (S3a): "Cobrado en <Mes>, hasta hoy" donut, built only from resumenTrab's mesEfe / mesDig ──
function torta(r){ var a = app(H.fakeStorage({}), '2026-10-15', {funcs: ['cobradoMes', 'htmlCobradoMes', 'esc', 'largo']}); return {a: a, d: a.plain(a.cobradoMes(r)), h: a.htmlCobradoMes(r, 'Octubre')}; }

test('S3a the donut slices are exactly mesEfe and mesDig, their sum is the shown total, percentages add up to 100', function(){
  var t = torta({mesEfe: 1000, mesDig: 2340});
  assert.deepEqual(t.d, {total: 3340, partes: [{k: 'efectivo', n: 'Efectivo', v: 1000, p: 30}, {k: 'digital', n: 'Digital / Virtual', v: 2340, p: 70}]});
  [[1, 2], [1, 1], [333, 667], [1, 999999], [5, 3]].forEach(function(x){
    var d = torta({mesEfe: x[0], mesDig: x[1]}).d;
    assert.equal(d.partes.reduce(function(s, p){ return s + p.p; }, 0), 100, JSON.stringify(x));
    assert.equal(d.partes.reduce(function(s, p){ return s + p.v; }, 0), d.total);
  });
  assert.match(t.h, /Cobrado en Octubre, hasta hoy/);
  assert.match(t.h, /\$3340/);
});

test('S3a the donut from a real month: the same numbers resumenTrab gives the month cards (pending invoices and future sales out)', function(){
  var c = cargada([CAFE], [venta('a', 'A', 1000, 'efectivo', '2026-10-02'), venta('b', 'B', 2000, 'transferencia', '2026-10-15'), venta('e', 'E', 5000, 'efectivo', '2026-10-20'),
    {id: 'g', tipo: 'factura', cliente: 'X', concepto: 'Plazo', monto: 9000, fecha: '2026-10-03', contado: false, plazo: 30, forma: 'efectivo'}], {funcs: ['cobradoMes']});
  var r = c.a.resumenTrab(), d = c.a.plain(c.a.cobradoMes(r));
  assert.deepEqual([d.total, d.partes[0].v, d.partes[1].v], [r.mesEfe + r.mesDig, r.mesEfe, r.mesDig]);
  assert.equal(d.total, 3000);
});

test('S3a nothing collected: one sentence, no chart, no table', function(){
  var t = torta({mesEfe: 0, mesDig: 0});
  assert.deepEqual(t.d, {total: 0, partes: []});
  assert.doesNotMatch(t.h, /<svg|<table/);
  assert.match(t.h, /todavía no cobraste nada/i);
});

test('S3a a zero side is left out: one full slice at 100%', function(){
  var t = torta({mesEfe: 0, mesDig: 4500});
  assert.deepEqual(t.d.partes, [{k: 'digital', n: 'Digital / Virtual', v: 4500, p: 100}]);
  assert.equal((t.h.match(/<circle/g) || []).length, 1);
  assert.doesNotMatch(t.h, /Efectivo/);
});

test('S3a text alternative: the drawing is hidden from screen readers and a table repeats every number', function(){
  var h = torta({mesEfe: 1000, mesDig: 3000}).h;
  assert.match(h, /<svg[^>]*aria-hidden="true"/);
  var tabla = /<div class="tj-sr"><table>([\s\S]*)<\/table><\/div>/.exec(h);
  assert.ok(tabla, 'visually hidden table');
  ['Efectivo', 'Digital / Virtual', '25%', '75%', '$1000', '$3000', 'Total', '$4000', 'Cobrado en Octubre, hasta hoy'].forEach(function(x){ assert.ok(tabla[1].indexOf(x) >= 0, x); });
});

// ── task 3 (S3b): "⋮" on each product card → "Editar producto", without selling ──
var FUNCS_B = ['tarjetaProd', 'abrirOpcionesProd', 'abrirProducto', 'campoTj', 'chipsForma', 'esc', 'hexColor', 'textoForma', 'iconoForma'];
function conGrilla(productos, facturas){
  return cargada(productos, facturas, {funcs: FUNCS_B, attrMonto: function(n){ return ' value="' + (n || '') + '"'; }, FORMAS: [['transferencia', 'Transferencia'], ['echeq', 'Echeq'], ['efectivo', 'Efectivo'], ['otra', 'Otra']]});
}
// the top-level buttons of one card: [class, data-act, aria-label], in order (a card is <div class="tj-pw">: the sale button and its siblings)
function botones(html){
  var out = [], re = /<button(?: class="([^"]*)")?[^>]*?data-act="([^"]*)"[^>]*>/g, m;
  while((m = re.exec(html))){ var al = /aria-label="([^"]*)"/.exec(m[0]); out.push([(m[1] || '').split(' ')[0], m[2], al ? al[1] : null]); }
  return out;
}

test('S3b every card, full and compact, has a "⋮" button next to (not inside) the sale button, named for the product', function(){
  var c = conGrilla([CAFE, Object.assign({}, MEDIA, {nombre: 'Pan <b>&"'})]);
  [false, true].forEach(function(comp){
    var h = c.a.tarjetaProd(c.a.T.productos[0], comp, true), b = botones(h);
    assert.ok(b.some(function(x){ return x[0] === 'tj-opc' && x[1] === 'tjOpcProd' && x[2] === 'Opciones de Café'; }), JSON.stringify(b));
    var venta = h.indexOf('data-act="tjVender"'), cierre = h.indexOf('</button>', venta), opc = h.indexOf('class="tj-opc"');
    assert.ok(venta > 0 && cierre > venta && /^<div class="tj-pw"[^>]*><button class="tj-prod/.test(h), 'the card opens with the sale button');
    assert.ok(opc > cierre, 'the ⋮ is a sibling after the sale button closes, so a tap or long-press on it never reaches .tj-prod');
    assert.match(h, /class="tj-opc"[^>]*data-id="p1"/);
    assert.equal(/data-act="tjMedio"/.test(h), !comp, 'the payment corner icon stays in the full view');
  });
  var raro = c.a.tarjetaProd(c.a.T.productos[1], false, true);
  assert.match(raro, /aria-label="Opciones de Pan &lt;b&gt;&amp;&quot;"/, 'the name is escaped');
});

test('S3b the "⋮" sheet offers Editar producto and Cancelar, and changes nothing', function(){
  var c = conGrilla([CAFE]);
  var antes = JSON.stringify(c.a.T);
  c.a.abrirOpcionesProd('p1');
  var h = c.a.g.hojas[c.a.g.hojas.length - 1];
  assert.match(h, /<h3>Café<\/h3>/);
  assert.deepEqual(botones(h).map(function(x){ return x[1]; }), ['tjEditDesdeGrilla', 'cerrarHoja']);
  assert.match(h, /data-act="tjEditDesdeGrilla" data-id="p1">Editar producto</);
  assert.match(h, />Cancelar</);
  assert.equal(JSON.stringify(c.a.T), antes);
  assert.equal(c.a.tjAntes, null);
});

test('S3b from the grid: the editor saves and closes back to the grid (no list); it has a Cancelar; past sales keep their copy', function(){
  var c = conGrilla([CAFE]);
  c.a.venderProducto('p1');
  var ventas = JSON.stringify(c.a.T.facturas);
  c.a.abrirProducto('p1', false, 'grilla');
  var h = c.a.g.hojas[c.a.g.hojas.length - 1];
  assert.match(h, /<h3>Editar producto<\/h3>/);
  assert.deepEqual(botones(h).filter(function(x){ return /tjBorrarProd|cerrarHoja|tjGuardarProd/.test(x[1]); }).map(function(x){ return x[1]; }), ['tjBorrarProd', 'cerrarHoja', 'tjGuardarProd']);
  Object.assign(c.a.campos, {pxNombre: 'Café doble', pxPrecio: '2500', pxCosto: '', pxStock: '7', pxCarp: 'Bebidas'});
  var cerr = c.a.g.hojasCerradas;
  c.a.guardarProducto();
  assert.deepEqual([c.a.prodPorId('p1').nombre, c.a.prodPorId('p1').precio, c.a.prodPorId('p1').stock], ['Café doble', 2500, 7]);
  assert.deepEqual([c.a.g.listas, c.a.g.hojasCerradas], [0, cerr + 1], 'closes to the grid, not to the list');
  assert.equal(JSON.stringify(c.a.T.facturas), ventas, 'the sale made before keeps "Café" at $1500');
  assert.equal(c.a.T.facturas.length, 1, 'editing never creates a sale');
});

test('S3b the list path keeps its behavior: save reopens the list; delete from the grid closes back to the grid', function(){
  var c = conGrilla([CAFE, MEDIA]);
  c.a.abrirProducto('p2');
  assert.doesNotMatch(c.a.g.hojas[c.a.g.hojas.length - 1], /data-act="cerrarHoja"/, 'list path editor: Borrar + Guardar, as before');
  Object.assign(c.a.campos, {pxNombre: 'Medialuna', pxPrecio: '900'});
  c.a.guardarProducto();
  assert.equal(c.a.g.listas, 1);
  c.a.abrirProducto('p1', false, 'grilla');
  var cerr = c.a.g.hojasCerradas;
  c.a.borrarProducto('p1');
  assert.deepEqual([c.a.T.productos.length, c.a.g.listas, c.a.g.hojasCerradas], [1, 1, cerr + 1]);
});

test('S3b a stale tab refuses the edit from the grid too', function(){
  var c = conGrilla([CAFE]);
  c.a.abrirProducto('p1', false, 'grilla');
  otraPestanaGuarda(c.ls);
  Object.assign(c.a.campos, {pxNombre: 'Otro', pxPrecio: '1'});
  c.a.guardarProducto();
  assert.equal(c.a.prodPorId('p1').nombre, 'Café');
});

// ── task 4 (S3c): "+ Producto" always at hand ──
function conBarra(productos){
  return cargada(productos, [], {funcs: FUNCS_B.concat(['botonesProductos', 'grillaProds', 'vistaProd', 'enCarpeta', 'coincideProd', 'textoSinRes']), busqProd: '', LSVISTA: 'kibo.vistaProd',
    attrMonto: function(n){ return ' value="' + (n || '') + '"'; }, FORMAS: [['transferencia', 'Transferencia'], ['echeq', 'Echeq'], ['efectivo', 'Efectivo'], ['otra', 'Otra']]});
}
test('S3c the product toolbar holds the search box, a labeled "+ Producto" and the view switch, inside the products zone', function(){
  var c = conBarra([CAFE, MEDIA]);
  var h = c.a.botonesProductos();
  assert.match(h, /^<div class="tj-zona" id="tjZona"><div class="tj-phd" id="tjBarra">/);
  var barra = h.slice(0, h.indexOf('</div>', h.indexOf('id="tjBarra"')));
  assert.match(barra, /id="tjBuscar"[^>]*aria-label="Buscar producto"/);
  assert.deepEqual(botones(barra).map(function(x){ return [x[1], x[2]]; }), [['tjNuevoProdGrilla', 'Agregar producto'], ['tjVista', 'Pasar a grilla compacta']]);
  assert.match(barra, />\+ Producto<\/button>/);
  assert.equal((h.match(/data-act="tjNuevoProdGrilla"/g) || []).length, 1, 'one add button');
  assert.match(h, /<\/div><\/div>$/, 'the zone closes after the grid (the toolbar sticks only while the products scroll)');
});

test('S3c no products yet: the call to action is the add button, no search box', function(){
  var c = conBarra([]);
  var h = c.a.botonesProductos();
  assert.doesNotMatch(h, /tjBuscar/);
  assert.deepEqual(botones(h).map(function(x){ return [x[0], x[1]]; }), [['tj-nuevo', 'tjNuevoProdGrilla']]);
  assert.match(h, /\+ Agregar producto/);
});

test('S3c a new product from the toolbar starts in the folder you are looking at, has Cancelar, and saves back to the grid', function(){
  var c = conBarra([CAFE, MEDIA]);
  c.a.carpSel = 'bebidas'; c.a.carpSelGeneral = false;
  c.a.abrirProducto(null, false, 'grilla');
  var h = c.a.g.hojas[c.a.g.hojas.length - 1];
  assert.match(h, /<h3>Nuevo producto<\/h3>/);
  assert.match(h, /id="pxCarp"[^>]*value="Bebidas"/);
  assert.deepEqual(botones(h).filter(function(x){ return /cerrarHoja|tjGuardarProd|tjProds/.test(x[1]); }).map(function(x){ return x[1]; }), ['cerrarHoja', 'tjGuardarProd']);
  Object.assign(c.a.campos, {pxNombre: 'Té', pxPrecio: '900', pxCarp: 'Bebidas'});
  var cerr = c.a.g.hojasCerradas;
  c.a.guardarProducto();
  var nuevo = c.a.T.productos[2];
  assert.deepEqual([nuevo.nombre, nuevo.carpeta, nuevo.color, c.a.T.facturas.length, c.a.g.listas, c.a.g.hojasCerradas], ['Té', 'Bebidas', 'azul', 0, 0, cerr + 1]);
});

// ── review fix: undo of a quick sale in a stale tab ──
test('S3-R1 undoing a quick sale after another tab saved is refused: memory, storage and toasts unchanged, other-tab notice', function(){
  var c = cargada([CAFE]);
  c.a.venderProducto('p1');
  otraPestanaGuarda(c.ls);
  var guardado = c.ls.d['kibo.trabajo'], toasts = c.a.g.toasts.slice(), mem = JSON.stringify(c.a.T);
  c.a.deshacerTj();
  assert.equal(JSON.stringify(c.a.T), mem, 'the sale and the stock stay in memory');
  assert.equal(c.a.T.facturas.length, 1);
  assert.equal(c.a.T.productos[0].stock, 2);
  assert.equal(c.ls.d['kibo.trabajo'], guardado, 'storage untouched');
  assert.deepEqual(c.a.g.toasts, toasts, 'no "Listo, quedó como antes"');
  assert.equal(c.a.obsoleta, true);
  assert.match(c.a.avisosEl.innerHTML, /otra pestaña/);
});

// ── review fix (S2 L3): "a plazo, sin cobrar" is what today's a-plazo sales still owe (their saldo), not sold − collected in cash ──
test('S3-R5 a same-day cobro of today\'s a-plazo sale lowers "a plazo, sin cobrar"; fully collected, the part disappears', function(){
  var c = cargada([], [], {funcs: ['lineaHoy']});
  var plazo = venta('f2', 'Juan', 70000, 'transferencia', '2026-10-15', {tipo: 'factura', contado: false, plazo: 30, cliente: 'Juan'});
  c.a.T.facturas = [venta('f1', 'Café', 30000, 'efectivo', '2026-10-15'), plazo];
  c.a.T.cobros = [{id: 'c1', cliente: 'Juan', monto: 20000, fecha: '2026-10-15', forma: 'transferencia', aplic: [{f: 'f2', m: 20000, r: 0}]}];
  assert.equal(c.a.lineaHoy(c.a.resumenTrab()), 'Hoy: 2 ventas · efectivo $30000 · a plazo, sin cobrar $50000');
  c.a.T.cobros[0].monto = 70000; c.a.T.cobros[0].aplic[0].m = 70000;
  assert.equal(c.a.lineaHoy(c.a.resumenTrab()), 'Hoy: 2 ventas · efectivo $30000');
  c.a.T.cobros = [];
  assert.equal(c.a.lineaHoy(c.a.resumenTrab()), 'Hoy: 2 ventas · efectivo $30000 · a plazo, sin cobrar $70000');
});
