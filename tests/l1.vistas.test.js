'use strict';
// L1 (P3b redesign): "El año", Patrimonio (ex "USD") and Trabajo label every figure by its time scope ("a hoy" vs "al cierre del año,
// estimado"; realized vs programado), with numbers read from the existing sources only (serieVista / cadena / patrimonioNeto /
// resumenTrab). A legacy year (no arrastre) keeps exactly the money it showed before the redesign (fixtures/l1-legacy-numeros.json,
// recorded on ec9db4a) and is marked "Cálculo simple".
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var V = require('./fixtures/anio-vistas');
var U = require('./fixtures/usd-vistas');
var BASE = require('./fixtures/l1-legacy-numeros.json');

// the same extraction as fixtures/generar-l1-numeros.js: every money amount in the HTML, as a sorted set
function montos(html){
  var m = html.match(/-?(?:US\$\s?|\$)-?[\d.]+(?:,\d+)?/g) || [], s = {};
  m.forEach(function(x){ s[x.replace(/\s+/g, ' ')] = 1; });
  return Object.keys(s).sort();
}
function txt(h){ return h.replace(/<[^>]+>/g, ''); }
// data-an rows of the year hero: {k: [label, value]}
function filasAn(html){
  var out = {}, re = /<div class="sdo-f" data-an="([a-zA-Z]+)"><span>([\s\S]*?)<\/span><b>([\s\S]*?)<\/b><\/div>/g, m;
  while((m = re.exec(html))) out[m[1]] = [m[2], m[3]];
  return out;
}
function hero(html, id){ var i = html.indexOf('id="' + id + '"'); return html.slice(html.lastIndexOf('<div', i), html.indexOf('<div class="sec', i) > 0 ? html.indexOf('<div class="sec', i) : undefined); }

// ── legacy years keep their numbers ──
test('L1 legacy year, "El año": the same money amounts and the same tables as before the redesign; marked "Cálculo simple"', function(){
  var n = 0;
  assert.match(BASE.meta.razon, /ec9db4a/);
  V.corpus().forEach(function(c){
    var app = V.appAnio(c.d, c.otros, V.TRAB_PASES()), todo = app.anio(), html = V.sinAnalisis(todo), b = BASE.anio[c.nombre];
    assert.ok(b, c.nombre + ': baseline present');
    if(todo !== html) assert.match(todo, /data-sec="anComp"[\s\S]*<span class="chip prog">Cálculo simple<\/span>/, c.nombre + ': L6 analysis marked "Cálculo simple"');
    assert.deepEqual(montos(html), b.montos, c.nombre + ': the set of amounts on screen');
    assert.deepEqual(V.tabla(html, 'anTabla'), b.doceMeses, c.nombre + ': "Los doce meses"');
    assert.deepEqual(V.tabla(html, 'anAnios'), b.anioPorAnio, c.nombre + ': "Año por año"');
    assert.match(hero(html, 'heroAnio'), /data-modo="simple"[\s\S]*Disponible final del año[\s\S]*<span class="chip prog">Cálculo simple<\/span>/, c.nombre + ': marked');
    n++;
  });
  assert.equal(n, 9, 'non-vacuous');
});
test('L1 legacy year, Patrimonio tab: the same money amounts and the same "Dólares mes a mes" table as before; marked "Cálculo simple"', function(){
  var n = 0;
  U.legacy().forEach(function(c){
    var app = U.appUSD(c.d, U.TRAB()), html = app.usd(), b = BASE.usd[c.nombre];
    assert.ok(b, c.nombre + ': baseline present');
    assert.deepEqual(montos(html), b.montos, c.nombre + ': the set of amounts on screen');
    assert.deepEqual(V.tabla(html, 'usdMeses'), b.dolaresMes, c.nombre + ': "Dólares mes a mes"');
    assert.match(hero(html, 'heroPatri'), /Todo junto al cierre del año[\s\S]*<span class="chip prog">Cálculo simple<\/span>/, c.nombre + ': marked');
    n++;
  });
  assert.equal(n, 11, 'non-vacuous');
});

// ── El año, model year: a hoy vs al cierre (estimado), each from its source ──
test('L1 "El año", current model year: "Tenés hoy" = the chain, ahorro a hoy = patrimonioNeto, December figures = serieVista, all labeled', function(){
  var app = V.appAnio(C.seccion2(false, false), {2025: C.vacio(2025)}), html = app.anio(), f = app.fARS;
  var vm = app.vistaModelo(app.D, app.hoy), s = app.serieVista(app.D, app.hoy), n = app.numerosAnio(app.D, s, app.hoy, vm);
  var pn = app.patrimonioNeto(app.D, app.hoy, vm.ctx);
  assert.equal(n.modo, 'hoy');
  assert.equal(n.disponibleHoy, vm.cad.meses[app.hoy.mes].cierreCalc, 'Tenés hoy = the current month of the chain');
  assert.equal(n.ahorroHoy, pn.ahorroARS, 'ahorro a hoy = the Patrimonio source');
  assert.deepEqual([n.disponibleCierre, n.ahorroCierre], [s[11].disponibleFinal, s[11].ahorroAcumulado], 'December row of the year table');
  var h = hero(html, 'heroAnio'), r = filasAn(h);
  assert.match(h, /<small class="hero-lbl">Tenés hoy<\/small>[\s\S]*id="anBig">([^<]+)</);
  assert.equal(/id="anBig">([^<]+)</.exec(h)[1], f(n.disponibleHoy));
  assert.deepEqual(r.ahorroHoy, ['Ahorro acumulado a hoy', f(pn.ahorroARS)]);
  assert.deepEqual(r.dispCierre, ['Disponible en diciembre', f(s[11].disponibleFinal)]);
  assert.deepEqual(r.ahorroCierre, ['Ahorro en diciembre (con lo programado)', f(s[11].ahorroAcumulado)]);
  assert.match(h, /Al cierre del año \(estimado\)/);
  assert.ok(html.indexOf('id="heroAnio"') < html.indexOf('<div class="resumen'), 'one hero, first');
  assert.equal((html.match(/class="saldo hero/g) || []).length, 1, 'one hero per screen');
  // the two "December" figures carry different words; the pace is not the closing
  assert.match(txt(html), /Ahorro a este ritmo en diciembre:/);
  assert.doesNotMatch(txt(html), /A este ritmo cerrás diciembre/);
  assert.match(html, /<span class="nom">Ahorro con el que arrancaste el año<\/span>/);
  assert.doesNotMatch(html, /Arranque del año/);
  assert.ok(html.indexOf('Cierre ' + f(s[11].disponibleFinal) + '<small class="sub-cap">estimado</small>') > 0, 'the table header says the closing is estimated');
});
test('L1 "El año": a past model year is "Cerraste el año con"; a future one is projected (gray) with programado savings', function(){
  var d25 = C.seccion2(false, false); d25.anio = 2025;
  var app = V.appAnio(d25, {}, null, '2026-10-15'), s = app.serieVista(app.D, app.hoy), html = app.anio(), f = app.fARS;
  var n = app.numerosAnio(app.D, s, app.hoy, app.vistaModelo(app.D, app.hoy));
  assert.equal(n.modo, 'cerrado');
  assert.match(hero(html, 'heroAnio'), new RegExp('Cerraste el año con[\\s\\S]*id="anBig">' + f(s[11].disponibleFinal).replace(/[$.]/g, '\\$&') + '<'));
  assert.ok(html.indexOf('Cierre ' + f(s[11].disponibleFinal)) > 0 && html.indexOf('>estimado<') < 0, 'a closed year is not estimated');
  var d27 = C.seccion2(false, false); d27.anio = 2027;
  var a2 = V.appAnio(d27, {}, null, '2026-10-15'), s2 = a2.serieVista(a2.D, a2.hoy), h2 = a2.anio();
  var n2 = a2.numerosAnio(a2.D, s2, a2.hoy, a2.vistaModelo(a2.D, a2.hoy));
  assert.equal(n2.modo, 'proyectado');
  assert.match(hero(h2, 'heroAnio'), /Proyectado para diciembre[\s\S]*class="big (proy|ambar)"/);
  assert.deepEqual(filasAn(hero(h2, 'heroAnio')).ahorroCierre, ['Ahorro al cierre de diciembre (estimado, con lo programado)', a2.fARS(s2[11].ahorroAcumulado)]);
});

// ── Patrimonio, model year: the dollars a hoy vs programado ──
test('L1 Patrimonio, model year: "Dólares mes a mes" splits a hoy (patrimonioNeto) from programado; future months are marked', function(){
  var raw = C.seccion2(false, false); raw.meses[10].ahorroMesUSD = 50;   // November: US$ 50 scheduled
  var app = U.appUSD(raw), html = app.usd(), s = app.serie(app.D), p = app.patrimonioPantalla(app.D, app.hoy), f = app.fUSD;
  assert.notEqual(s[11].usdAcumulado, p.usd, 'guard: the year end includes the scheduled dollars');
  var t = V.tabla(html, 'usdMeses'), hoyF = t[12], progF = t[13];
  assert.equal(hoyF[0], 'A hoy');
  assert.equal(hoyF[3], f(p.usd), 'a hoy = the composition source (patrimonioNeto)');
  assert.equal(progF[0], 'Con lo programado');
  assert.deepEqual([progF[1], progF[3]], [f(s[11].usdAcumulado - p.usd), f(s[11].usdAcumulado)]);
  assert.equal(t.length, 14, 'no single total mixing both');
  assert.match(html, new RegExp('<span class="nom">Dólares mes a mes</span><span class="sub">' + f(p.usd).replace(/[$.]/g, '\\$&') + '<small class="sub-cap">a hoy</small>'));
  assert.match(t[10][0], /Noviembre programado/, 'a future month row says programado');
  assert.doesNotMatch(t[9][0], /programado/, 'the current month is not programado');
  // the answer first, then the composition, the table and the inputs in their own card
  var o = ['id="heroPatri"', 'data-sec="usdPatri"', 'data-sec="usdMeses"', 'data-sec="usdDatos"'].map(function(k){ return html.indexOf(k); });
  assert.deepEqual(o.slice().sort(function(a, b){ return a - b; }), o, 'order: hero, composition, dollars, data');
  assert.ok(o[0] >= 0);
  var datos = html.slice(o[3]);
  ['data-campo="cotizacionUSD"', 'data-act="addCripto"', 'data-campo="usdAnioAnterior"'].forEach(function(k){
    assert.ok(datos.indexOf(k) > 0, k + ' lives in Datos'); assert.equal(html.indexOf(k), o[3] + datos.indexOf(k), k + ' only there');
  });
});

// ── Trabajo: what you passed to personal, split like "Disponible del trabajo" ──
test('L1 Trabajo: pasesPersonal splits pasado into ya + programado; disponible = cobrado - gastado - ya', function(){
  var app = H.appVista(null, null, null, null, {funcs: ['pasesPersonal']});
  [{cobrado: 910000, gastado: 15000, pasado: 650000, pasadoProgramado: 200000}, {cobrado: 5, gastado: 0, pasado: 3, pasadoProgramado: 0},
   {cobrado: 100, gastado: 10, pasado: 40}].forEach(function(r){
    var p = app.pasesPersonal(r), disp = r.cobrado - r.gastado - r.pasado + (r.pasadoProgramado || 0);
    assert.equal(p.ya + p.programado, r.pasado, 'adds up');
    assert.equal(r.cobrado - r.gastado - p.ya, disp, 'matches Disponible del trabajo (resumenTrab)');
  });
});
