'use strict';
// R4.5 correction (owner decision 2026-10-06): in a year WITH `arrastre`, "El año" ("Los doce meses", its chart, "Año por año") and the
// year CSV read the SAME chained balance model as the month card (tilesMes / vistaModelo, R4.4); a year WITHOUT `arrastre` is
// byte-identical to what it showed before. Mapping and stop items: odd/tasks/repair-sprint-1-r4.5-matrix.md, section E.
var test = require('node:test');
var assert = require('node:assert/strict');
var crypto = require('crypto');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var V = require('./fixtures/anio-vistas');
var BASE = require('./fixtures/anio-legacy.json');

function sha(t){ return crypto.createHash('sha256').update(t).digest('hex'); }
function l01(anio){   // the L-01 dataset: unticked "Del trabajo" without pases (Q3), scheduled November savings
  var d = C.vacio(anio || 2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 500000, true), C.it('Del trabajo', 80000, false)], gastosFijos: [C.it('Alquiler', 100000, true)], ahorroMesARS: 50000});
  C.mes(d, 10, {ahorroMesARS: 200000});
  return d;
}
var COL = {ing: 1, gas: 2, aho: 3, dol: 4, saq: 5, rep: 6, deu: 7, disp: 8, acu: 9};
function sumar(a, k){ return a.reduce(function(t, x){ return t + x[k]; }, 0); }
function vista(app){ var vm = app.vistaModelo(app.D, app.hoy), t = []; for(var j = 0; j < 12; j++) t.push(app.tilesMes(app.D, j, vm)); return {vm: vm, t: t}; }

// (a) a year WITHOUT arrastre: the same bytes as on 0ad13c1
test('year views, legacy year: "El año" HTML and the year CSV are byte-identical to 0ad13c1 for every motor-corpus dataset', function(){
  var n = 0;
  V.corpus().forEach(function(c){
    var app = V.appAnio(c.d, c.otros, V.TRAB_PASES()), b = BASE.data[c.nombre];
    assert.ok(b, c.nombre + ': baseline present');
    assert.equal(app.vistaModelo(app.D, app.hoy), null, c.nombre + ': no model view');
    var html = app.anio();
    assert.equal(html.length, b.htmlLargo, c.nombre + ': "El año" length');
    assert.equal(sha(html), b.html, c.nombre + ': "El año" bytes');
    assert.equal(app.csv(), b.csv, c.nombre + ': CSV bytes');
    assert.ok(V.tabla(html, 'anAnios').length >= 2, c.nombre + ': "Año por año" rendered');
    n++;
  });
  assert.equal(n, 9);
  assert.match(BASE.meta.razon, /0ad13c1/);
});

// (b) a year WITH arrastre: the table shows the card month by month
function tablaModelo(d){
  var app = V.appAnio(d, {2025: C.vacio(2025)}), v = vista(app), s = app.serie(app.D), html = app.anio(), t = V.tabla(html, 'anTabla');
  for(var j = 0; j < 12; j++){
    var r = t[j], c = v.t[j], leg = v.vm.cad.meses[j].legacy;
    assert.equal(r[0], app.MESES ? app.MESES[j] : r[0]);
    assert.deepEqual([r[COL.ing], r[COL.gas], r[COL.disp]], [app.hARS(c.totalIngresos), app.hARS(c.totalGastos), app.hARS(c.disponibleFinal)].map(function(h){ return h.replace(/<[^>]+>/g, ''); }), 'month ' + j + ' = card');
    if(leg) assert.deepEqual([c.totalIngresos, c.totalGastos, c.disponibleFinal], [s[j].totalIngresos, s[j].totalGastos, s[j].disponibleFinal], 'month ' + j + ' before desde = calc()');
    assert.deepEqual([r[COL.aho], r[COL.dol], r[COL.saq], r[COL.rep], r[COL.deu], r[COL.acu]],
      [s[j].ahorroMesARS, s[j].compraARS, s[j].sacadoARS, s[j].reposicionARS, s[j].totalDeudas, s[j].ahorroAcumulado].map(function(x){ return app.fARS(x); }), 'month ' + j + ' transfers / deudas / acumulado unchanged');
  }
  return {app: app, v: v, s: s, html: html, t: t};
}
test('year views, model year (L-01): every "Los doce meses" row shows the month card; totals follow; the old serie() values are gone', function(){
  var x = tablaModelo(l01()), tot = x.t[12], f = x.app.fARS;
  assert.deepEqual([x.t[9][COL.ing], x.t[9][COL.gas], x.t[9][COL.disp]], [f(500000), f(100000), f(350000)], 'Oct = card 500.000 / 100.000 / 350.000');
  assert.deepEqual([x.t[10][COL.disp], x.t[11][COL.disp]], [f(230000), f(230000)], 'Nov / Dec = projected 430.000 - 200.000');
  assert.notEqual(x.t[9][COL.ing], f(580000), 'guard: not the serie() Ingresos (Del trabajo always realized)');
  assert.notEqual(x.t[9][COL.disp], f(430000), 'guard: not the month flow');
  assert.deepEqual([tot[COL.ing], tot[COL.gas], tot[COL.disp], tot[COL.acu]], [f(sumar(x.v.t, 'totalIngresos')), f(sumar(x.v.t, 'totalGastos')), f(x.v.t[11].disponibleFinal), f(250000)]);
  assert.ok(x.html.indexOf('Cierre ' + f(230000)) > 0, 'header "Cierre" = December card value');
});
test('year views, model year (section 2): legacy August, confirmed September, current October, scheduled November', function(){
  var x = tablaModelo(C.seccion2(false, false)), f = x.app.fARS, tot = x.t[12];
  assert.deepEqual(x.t.slice(7, 12).map(function(r){ return [r[COL.ing], r[COL.gas], r[COL.deu], r[COL.disp]]; }),
    [['—', '—', '—', '—'], [f(1000000), f(600000), f(100000), f(175000)], [f(1000000), f(400000), '—', f(825000)],
     [f(1000000), '—', '—', f(1280000)], ['—', '—', '—', f(1280000)]]);
  assert.deepEqual([tot[COL.ing], tot[COL.gas], tot[COL.disp]], [f(3000000), f(1000000), f(1280000)]);
  assert.ok(x.html.indexOf('Cierre ' + f(1280000)) > 0);
  assert.ok(x.html.indexOf(x.app.lineas(x.v.t.map(function(c){ return c.totalIngresos; }), x.v.t.map(function(c){ return c.totalGastos; }))) > 0,
    '"Ingresos y gastos" chart draws the same rows');
  assert.ok(x.html.indexOf('<span class="sub">' + f(3000000) + ' · ' + f(1000000) + '</span>') > 0, 'chart header = table totals');
});

// (c) the CSV of a model year carries exactly the card / table values
test('year views, model year: the CSV Ingresos / Gastos / Disponible final are the card values; the other columns are unchanged', function(){
  [l01(), C.seccion2(false, false)].forEach(function(d, n){
    var app = V.appAnio(d), v = vista(app), s = app.serie(app.D), l = V.csvFilas(app.csv()), t = V.tabla(app.anio(), 'anTabla');
    assert.equal(l.length, 13);
    for(var j = 0; j < 12; j++){
      var r = l[j + 1], c = v.t[j], num = function(x){ return String(x).replace('.', ','); };
      assert.deepEqual([r[1], r[4], r[14]], [num(c.totalIngresos), num(c.totalGastos), num(c.disponibleFinal)], 'dataset ' + n + ' month ' + j);
      assert.equal(app.fARS(+r[14].replace(',', '.')), t[j][COL.disp].replace(/<[^>]+>/g, ''), 'CSV = "El año" cell');
      assert.deepEqual([r[2], r[3], r[5], r[13], r[15]], [num(s[j].subtotalFijos), num(s[j].subtotalVariables), num(s[j].ahorroMesARS), num(s[j].totalDeudas), num(s[j].ahorroAcumulado)], 'stop items / transfers unchanged');
    }
  });
  var l = V.csvFilas(V.appAnio(l01()).csv());
  assert.deepEqual([l[10][0], l[10][1], l[10][14]], ['Octubre', '500000', '350000'], 'guard: not 580000 / 430000 (serie)');
});

// (d) "Año por año": model years (open and stored) never bring calc()/serie() back
test('year views, "Año por año": a model year (open or stored) sums the card rows; a legacy year keeps serie(); guard against the old values', function(){
  var leg = C.vacio(2024); C.mes(leg, 3, {ingresos: [C.it('Del trabajo', 70000, false), C.it('Sueldo', 1000, true)], gastosFijos: [C.it('Luz', 300, true)]});
  var app = V.appAnio(l01(2026), {2025: l01(2025), 2024: leg}), f = app.fARS, rows = V.tabla(app.anio(), 'anAnios');
  assert.deepEqual(rows.map(function(r){ return r[0]; }), ['2024', '2025', '2026']);
  var d25 = app.normalizar(C.copy(l01(2025)), app.hoy), vm25 = app.vistaModelo(d25, app.hoy), t25 = [], j;
  for(j = 0; j < 12; j++) t25.push(app.tilesMes(d25, j, vm25));
  var v26 = vista(app);
  assert.deepEqual(rows[2].slice(1, 3), [f(sumar(v26.t, 'totalIngresos')), f(sumar(v26.t, 'totalGastos'))], 'open model year');
  assert.deepEqual(rows[1].slice(1, 3), [f(sumar(t25, 'totalIngresos')), f(sumar(t25, 'totalGastos'))], 'stored model year (all months past)');
  assert.deepEqual([rows[1][1], rows[2][1]], [f(500000), f(500000)]);
  [rows[1], rows[2]].forEach(function(r){ assert.notEqual(r[1], f(580000), 'guard: serie() Ingresos is back'); });
  assert.deepEqual(rows[1].slice(3), [f(0), f(250000), f(250000), app.fUSD(0)].map(function(x){ return x; }), 'Deudas / Ahorrado / Cierre en pesos / Dólares unchanged');
  var sL = app.serie(app.normalizar(C.copy(leg), app.hoy));
  assert.deepEqual(rows[0].slice(1, 3), [f(sumar(sL, 'totalIngresos')), f(sumar(sL, 'totalGastos'))], 'legacy year: serie()');
  assert.equal(rows[0][1], f(71000), 'legacy "Del trabajo" always realized (unchanged)');
});

test('year views: renderAnio and exportarCSV read the rows through serieVista (one semantic source, D13); a legacy year gets serie() itself', function(){
  assert.match(la.extractFunction('renderAnio'), /serieVista\(D, hoy\)/);
  assert.match(la.extractFunction('renderAnio'), /serieVista\(dA, hoy\)/);
  assert.match(la.extractFunction('exportarCSV'), /serieVista\(D, hoyApp\(\)\)/);
  assert.match(la.extractFunction('serieVista'), /tilesMes\(d, j, vm\)/);
  V.corpus().forEach(function(c){
    var app = V.appAnio(c.d);
    assert.deepEqual(app.plain(app.serieVista(app.D, app.hoy)), app.plain(app.serie(app.D)), c.nombre);
  });
});

// Model rule (owner, 2026-10-06): in a year WITH arrastre, "Total Disponible" and the header "Cierre" are the available balance at the
// close of the LAST month of the year (December), never a sum of monthly balances. A year WITHOUT arrastre keeps its previous behavior
// (pinned byte for byte by the legacy test above).
test('model rule: in a model year "Total Disponible" and "Cierre" = December closing balance, never the sum of the monthly balances', function(){
  [l01(), C.seccion2(false, false)].forEach(function(d, i){
    var app = V.appAnio(d, {2025: C.vacio(2025)}), v = vista(app), html = app.anio(), t = V.tabla(html, 'anTabla'), f = app.fARS;
    var dic = v.t[11].disponibleFinal, suma = sumar(v.t.filter(function(c, j){ return !v.vm.cad.meses[j].legacy; }), 'disponibleFinal');
    assert.notEqual(suma, dic, 'dataset ' + i + ': the sum differs from December, so the assertion can tell them apart');
    assert.equal(t[12][COL.disp], f(dic), 'dataset ' + i + ': Total Disponible = December closing');
    assert.notEqual(t[12][COL.disp], f(suma), 'dataset ' + i + ': not the sum of monthly balances');
    assert.ok(html.indexOf('Cierre ' + f(dic)) > 0, 'dataset ' + i + ': header "Cierre" = December closing');
  });
});
