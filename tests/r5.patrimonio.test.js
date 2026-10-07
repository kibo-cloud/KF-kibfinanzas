'use strict';
// R5 part 2 (night run N3b): the auditable composition of "Patrimonio total" in a model year (owner MUST, R4.4 UX debt; D7, Q2, Q6,
// Q14, design §6). Every number on screen is a field of patrimonioNeto (one source, D13); the rows add up to the gross worth and the
// gross minus the debts is the net. A year WITHOUT arrastre keeps the old view byte for byte (owner decision 2026-10-06).
var test = require('node:test');
var assert = require('node:assert/strict');
var crypto = require('crypto');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var U = require('./fixtures/usd-vistas');
var R4 = require('./fixtures/motor-corpus-r4');
var BASE = require('./fixtures/usd-legacy.json');

function sha(t){ return crypto.createHash('sha256').update(t).digest('hex'); }
function hoyDe(iso){ return C.hoy(iso); }
// [data-pat] rows of the rendered composition: {k: [label text, value text]}
function filas(html){
  var out = {}, re = /<div class="fila-in" data-pat="([a-z]+)"><label[^>]*>([\s\S]*?)<\/label><span[^>]*>([\s\S]*?)<\/span><\/div>/g, m;
  while((m = re.exec(html))){
    var k = m[1], v = [m[2].replace(/<[^>]+>/g, ''), m[3].replace(/<[^>]+>/g, '')];
    if(k === 'deuda'){ (out.deuda = out.deuda || []).push(v); } else out[k] = v;
  }
  return out;
}

// ── legacy year: byte-identical ──
test('Patrimonio, legacy year: the Dólares tab is byte-identical to 8d1ee42 for every motor-corpus dataset (+ section 2 without model)', function(){
  var n = 0;
  U.legacy().forEach(function(c){
    var app = U.appUSD(c.d, U.TRAB()), b = BASE.data[c.nombre];
    assert.ok(b, c.nombre + ': baseline present');
    assert.equal(app.vistaModelo(app.D, app.hoy), null, c.nombre + ': no model view');
    var html = app.usd();
    assert.equal(U.seccionPatrimonio(html), b.patrimonio, c.nombre + ': "Patrimonio total" bytes');
    assert.equal(html.length, b.htmlLargo, c.nombre + ': tab length');
    assert.equal(sha(html), b.html, c.nombre + ': tab bytes');
    assert.equal(html.indexOf('data-pat='), -1, c.nombre + ': no composition rows');
    n++;
  });
  assert.equal(n, 11, 'non-vacuous');
  assert.match(BASE.meta.razon, /8d1ee42/);
});

// ── the composition adds up (numbers) over the R4 corpus ──
test('Patrimonio composition: rows = patrimonioNeto fields, they add up to bruto and bruto - deudas = neto (R4 corpus)', function(){
  var app = U.appUSD(null), n = 0;
  R4.datasets().forEach(function(e){
    var hoy = hoyDe(e.iso), d = app.normalizar(C.copy(e.raw), hoy);
    if(!d.arrastre) return;
    var pn = app.patrimonioNeto(d, hoy, C.copy(e.ctx)), f = app.plain(app.filasPatrimonio(pn));
    assert.deepEqual(f.filas.map(function(x){ return x.k; }), ['disponible', 'ahorro', 'usd', 'cripto', 'trabajo'], e.nombre + ': row order');
    assert.deepEqual(f.filas.map(function(x){ return x.valor; }), [pn.disponible, pn.ahorroARS, pn.usdARS, pn.criptoARS, pn.trabajo], e.nombre + ': one source');
    var suma = f.filas.reduce(function(t, x){ return t + x.valor; }, 0);
    assert.equal(suma, f.bruto, e.nombre + ': rows add up to bruto');
    assert.equal(f.bruto, pn.bruto, e.nombre + ': bruto');
    assert.equal(f.deudas, pn.pasivos, e.nombre + ': deudas = pasivos (Q6, Q14)');
    assert.equal(f.bruto - f.deudas, f.neto, e.nombre + ': bruto - deudas = neto');
    assert.equal(f.neto, pn.neto, e.nombre + ': neto');
    var det = f.detalleDeudas.reduce(function(t, x){ return t + x.saldo; }, 0);
    assert.equal(det, f.deudas, e.nombre + ': debt detail adds up');
    n++;
  });
  assert.ok(n >= 15, 'non-vacuous: ' + n + ' model datasets');
});

// ── §6 case on screen ──
test('Patrimonio composition on screen, §6 case: 825.000 + 600.000 + 1.500.000 = 2.925.000 - 300.000 = 2.625.000', function(){
  var app = U.appUSD(C.seccion2(false, false)), html = app.usd(), r = filas(html);
  assert.deepEqual(r.disponible, ['Disponible a hoy', '$825.000']);
  assert.deepEqual(r.ahorro, ['Ahorro en pesos', '$600.000']);
  assert.deepEqual(r.usd, ['Dólares (US$ 1.000,00 a $1.500, estimado)', '$1.500.000']);
  assert.deepEqual(r.cripto, ['Cripto', '—']);
  assert.deepEqual(r.trabajo, ['Plata del trabajo', '—']);
  assert.deepEqual(r.bruto, ['Patrimonio bruto', '$2.925.000']);
  assert.deepEqual(r.deudas, ['Deudas (lo que te falta pagar)', '($300.000)']);
  assert.deepEqual(r.deuda, [['Préstamo', '$300.000']]);
  assert.deepEqual(r.neto, ['Patrimonio neto', '$2.625.000']);
  assert.match(html, /Lo que tenés hoy, bolsillo por bolsillo/);
  assert.match(html, /Dólares y cripto son una estimación: a \$1\.500 por dólar/);
  assert.match(html, /id="bigPatri"[^>]*>US\$ 1\.750,00<\/div><div class="mudo" style="font-size:15px">\$2\.625\.000<\/div>/, 'headline = neto (D7)');
  assert.match(html, /<span class="nom">Patrimonio total<\/span><span class="sub">US\$ 1\.750,00<\/span>/);
  assert.match(html, /data-campo="usdAnioAnterior"/, 'the input stays');
});

test('Patrimonio composition with Trabajo cash and crypto (Q2): every pocket has its row and the total still adds up', function(){
  var raw = C.seccion2(false, false); raw.cripto = [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}];
  var app = U.appUSD(raw, H.trab([], 300000)), r = filas(app.usd());
  assert.deepEqual(r.cripto, ['Cripto (US$ 600,00 a $1.500, estimado)', '$900.000']);
  assert.deepEqual(r.trabajo, ['Plata del trabajo', '$300.000']);
  assert.deepEqual(r.bruto, ['Patrimonio bruto', '$4.125.000']);   // 825.000 + 600.000 + 1.500.000 + 900.000 + 300.000
  assert.deepEqual(r.neto, ['Patrimonio neto', '$3.825.000']);
  assert.equal(app.patrimonioPantalla(app.D, app.hoy).patrimonioARS, 3825000, 'same number as the screen adapter');
});

test('Patrimonio composition with the cotización the app ships (never loaded): the number is in the total, so it is shown and says so', function(){
  var raw = C.seccion2(false, false); raw.cotizacionUSD = 0; raw.cotizacionFecha = '';   // normalizar puts 1499 and no date
  var app = U.appUSD(raw), html = app.usd(), r = filas(html);
  assert.equal(app.D.cotizacionUSD, 1499, 'guard: the default of normalizar');
  assert.deepEqual(r.usd, ['Dólares (US$ 1.000,00 a $1.499, cotización sin cargar)', '$1.499.000']);
  assert.match(html, /Todavía no cargaste la cotización del dólar: dólares y cripto están calculados a \$1\.499, la que trae la app/);
  assert.doesNotMatch(html, /son una estimación/);
  assert.deepEqual(r.neto, ['Patrimonio neto', '$2.624.000']);
});

test('Patrimonio composition without any cotización: says so instead of a fake dollar value', function(){
  var raw = C.seccion2(false, false); raw.cripto = [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}];
  var app = U.appUSD(raw); app.D.cotizacionUSD = 0;   // only reachable before normalizar (or by an edit bypassing it): defensive branch
  var html = app.usd(), r = filas(html);
  assert.deepEqual(r.usd, ['Dólares (US$ 1.000,00, falta la cotización)', 'sin cotización']);
  assert.deepEqual(r.cripto, ['Cripto (US$ 600,00, falta la cotización)', 'sin cotización']);
  assert.deepEqual(r.bruto, ['Patrimonio bruto', '$1.425.000']);
  assert.deepEqual(r.neto, ['Patrimonio neto', '$1.125.000']);
  assert.match(html, /Falta la cotización del dólar/);
  assert.doesNotMatch(html, /id="bigPatri"[^>]*>(—|US\$)/, 'no US$ headline without cotización');
  assert.match(html, /id="bigPatri"[^>]*>\$1\.125\.000<\/div><div class="mudo" style="font-size:15px">Sin cotización del dólar/);
  assert.match(html, /<span class="sub">\$1\.125\.000<\/span>/);
});

test('Patrimonio composition escapes debt names (user data)', function(){
  var raw = C.seccion2(false, false);
  raw.meses[9].deudas.push({nombre: '<img src=x onerror=alert(1)>', monto: 5000, pagado: false});
  var app = U.appUSD(raw), html = app.usd();
  assert.equal(html.indexOf('<img'), -1);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.deepEqual(filas(html).deudas, ['Deudas (lo que te falta pagar)', '($305.000)']);
});
