'use strict';
// U4a (independent review of 5786c97): in a model year, the "A hoy" row of "Dólares mes a mes" and the purchase paragraph below it
// only count the dollars bought in months that already happened. A purchase scheduled for a future month (Q13/I5) goes on the
// "Con lo programado" row and in its own "en el año, con lo programado" line. Legacy years keep the whole-year purchase cost.
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var V = require('./fixtures/anio-vistas');
var U = require('./fixtures/usd-vistas');

function txt(h){ return h.replace(/<[^>]+>/g, ''); }
function parrafo(html){ var i = html.indexOf('Este año compraste'), j = html.indexOf('data-sec="usdDatos"'); return txt(html.slice(i < 0 ? html.indexOf('Con lo programado, en el año') : i, j)); }

// October (the current month, realized): US$ 100 for $100.000; November (future): US$ 100 for $200.000
function conCompras(raw){
  raw.meses[9].compraUSD = 100; raw.meses[9].compraARS = 100000;
  raw.meses[10].compraUSD = 100; raw.meses[10].compraARS = 200000;
  return raw;
}

test('U4a model year: "A hoy" pays the realized average; the future purchase is only in "Con lo programado"', function(){
  var app = U.appUSD(conCompras(C.seccion2(false, false))), html = app.usd(), fA = app.fARS, fU = app.fUSD;
  var t = V.tabla(html, 'usdMeses'), hoyF = t[12], progF = t[13];
  assert.equal(hoyF[0], 'A hoy');
  assert.equal(hoyF[2], fA(1000), 'a hoy: only October, $1.000 per dollar (not the year average $1.500)');
  assert.equal(progF[0], 'Con lo programado');
  assert.equal(progF[2], fA(1500), 'con lo programado: the whole-year average');
  var p = parrafo(html), vale = 100 * 1500;
  assert.ok(p.indexOf('Este año compraste ' + fU(100) + ' con ' + fA(100000) + ', a ' + fA(1000) + ' por dólar en promedio.') >= 0, p);
  assert.ok(p.indexOf('A la cotización de hoy valen ' + fA(vale) + ': ' + fA(vale - 100000) + ' más de lo que pagaste.') >= 0, p);
  assert.ok(p.indexOf('Con lo programado, en el año: ' + fU(200) + ' con ' + fA(300000) + ', a ' + fA(1500) + ' por dólar.') >= 0, p);
});

test('U4a model year: only a future purchase → no "Este año compraste" a hoy, just the programado line', function(){
  var raw = conCompras(C.seccion2(false, false)); raw.meses[9].compraUSD = 0; raw.meses[9].compraARS = 0;
  var app = U.appUSD(raw), html = app.usd(), fA = app.fARS, fU = app.fUSD, t = V.tabla(html, 'usdMeses');
  assert.equal(t[12][2], '—', 'nothing bought a hoy');
  assert.equal(t[13][2], fA(2000));
  assert.equal(html.indexOf('Este año compraste'), -1);
  assert.ok(parrafo(html).indexOf('Con lo programado, en el año: ' + fU(100) + ' con ' + fA(200000) + ', a ' + fA(2000) + ' por dólar.') >= 0);
});

test('U4a model year: no future purchase → no programado line, the "Con lo programado" row keeps "—"', function(){
  var raw = conCompras(C.seccion2(false, false)); raw.meses[10].compraUSD = 0; raw.meses[10].compraARS = 0; raw.meses[10].ahorroMesUSD = 50;
  var app = U.appUSD(raw), html = app.usd(), fA = app.fARS, t = V.tabla(html, 'usdMeses');
  assert.equal(t[12][2], fA(1000));
  assert.equal(t[13][0], 'Con lo programado');
  assert.equal(t[13][2], '—');
  assert.equal(html.indexOf('Con lo programado, en el año'), -1);
});

test('U4a legacy year: the "Cierre" row and the paragraph keep the whole-year purchase cost', function(){
  var raw = conCompras(H.sinModelo(C.seccion2(false, false)));
  var app = U.appUSD(raw), html = app.usd(), fA = app.fARS, fU = app.fUSD, t = V.tabla(html, 'usdMeses');
  assert.equal(t[12][0], 'Cierre');
  assert.equal(t[12][2], fA(1500));
  assert.ok(txt(html).indexOf('Este año compraste ' + fU(200) + ' con ' + fA(300000) + ', a ' + fA(1500) + ' por dólar en promedio.') >= 0);
  assert.equal(html.indexOf('Con lo programado, en el año'), -1);
});
