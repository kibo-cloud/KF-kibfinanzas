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
function l01(anio, apertura){   // the L-01 dataset: unticked "Del trabajo" without pases (Q3), scheduled November savings; opening 0 unless given
  var d = C.vacio(anio || 2026); C.arrastre(d, 9, apertura || 0, 'declarado');
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
    assert.deepEqual([r[COL.aho], r[COL.dol], r[COL.saq], r[COL.rep], r[COL.acu]],
      [s[j].ahorroMesARS, s[j].compraARS, s[j].sacadoARS, s[j].reposicionARS, s[j].ahorroAcumulado].map(function(x){ return app.fARS(x); }), 'month ' + j + ' transfers / acumulado unchanged');
    // N1 item 1 (R4.5 close): the Deudas column of a model month is the model's installments (realized: paid; future: scheduled,
    // ticks ignored, §1), from flujosMes through tilesMes; a month before desde keeps calc()
    var fm = leg ? null : app.flujosMes(app.D, j, app.hoy, v.vm.ctx);
    assert.equal(r[COL.deu], app.fARS(leg ? s[j].totalDeudas : (fm.realizado ? fm.cuotasReal : fm.cuotasProg)), 'month ' + j + ' Deudas');
  }
  return {app: app, v: v, s: s, html: html, t: t};
}
test('year views, model year (L-01): every "Los doce meses" row shows the month card; totals follow; the old serie() values are gone', function(){
  var x = tablaModelo(l01()), tot = x.t[12], f = x.app.fARS;
  assert.deepEqual([x.t[9][COL.ing], x.t[9][COL.gas], x.t[9][COL.disp]], [f(500000), f(100000), f(350000)], 'Oct = card 500.000 / 100.000 / 350.000');
  assert.deepEqual([x.t[10][COL.disp], x.t[11][COL.disp]], [f(230000), f(230000)], 'Nov / Dec = projected 430.000 - 200.000');
  assert.notEqual(x.t[9][COL.ing], f(580000), 'guard: not the serie() Ingresos (Del trabajo always realized)');
  assert.notEqual(x.t[9][COL.disp], f(430000), 'guard: not the month flow');
  assert.deepEqual([tot[COL.ing], tot[COL.gas], tot[COL.acu]], [f(sumar(x.v.t, 'totalIngresos')), f(sumar(x.v.t, 'totalGastos')), f(250000)]);
  assert.ok(x.html.indexOf('Cierre ' + f(230000)) > 0, 'header "Cierre" = December card value');
  // with opening 0, December (230.000) equals the old serie() sum of the monthly flows (430.000 - 200.000), so a Total Disponible
  // check on this dataset could pass by coincidence: it is made on the same dataset with a declared opening of 100.000 instead
  var y = tablaModelo(l01(2026, 100000)), dic = y.v.t[11].disponibleFinal, viejo = sumar(y.s, 'disponibleFinal'), cards = sumar(y.v.t, 'disponibleFinal');
  assert.deepEqual([dic, viejo], [330000, 230000], 'December 330.000; the old serie() sum stays 230.000');
  assert.ok(cards !== dic, 'nor the sum of the card balances');
  assert.equal(y.t[12][COL.disp], f(dic), 'Total Disponible = December card value');
  assert.ok(y.t[12][COL.disp] !== f(viejo) && y.t[12][COL.disp] !== f(cards), 'not a sum of monthly balances');
});
test('year views, model year (section 2): legacy August, confirmed September, current October, scheduled November', function(){
  var x = tablaModelo(C.seccion2(false, false)), f = x.app.fARS, tot = x.t[12];
  assert.deepEqual(x.t.slice(7, 12).map(function(r){ return [r[COL.ing], r[COL.gas], r[COL.deu], r[COL.disp]]; }),
    [['—', '—', '—', '—'], [f(1000000), f(600000), f(100000), f(175000)], [f(1000000), f(400000), '—', f(825000)],
     [f(1000000), '—', f(100000), f(1280000)], ['—', '—', '—', f(1280000)]]);
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
      assert.deepEqual([r[5], r[15]], [num(s[j].ahorroMesARS), num(s[j].ahorroAcumulado)], 'transfers unchanged');
      assert.deepEqual([r[2], r[3]], [num(c.subtotalFijos), num(c.subtotalVariables)], 'Gastos fijos / variables = card split (N1 item 2)');
      assert.equal(r[13], num(c.totalDeudas), 'Deudas = card / table (N1 item 1: model installments)');
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
  var n = 0;
  V.corpus().forEach(function(c){
    var app = V.appAnio(c.d);
    assert.deepEqual(app.plain(app.serieVista(app.D, app.hoy)), app.plain(app.serie(app.D)), c.nombre);
    n++;
  });
  assert.equal(n, 9, 'guard: every corpus dataset was compared');
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

// native review follow-ups (night range T1/T2): the year summary reads the year it is given; serieVista marks its own model rows
test('mesEnRojo / resumenAnio read the year they are given, not the open one', function(){
  var rojo = C.seccion2(false, false); rojo.meses[9].gastosVariables = [C.it('Viaje', 2000000, true)];   // October spends more than it earns
  var app = V.appAnio(rojo, {2025: C.vacio(2025)}), d = app.D, vm = app.vistaModelo(d, app.hoy), s = app.serieVista(d, app.hoy);
  assert.equal(app.mesEnRojo(d, s, 9, vm), true, 'October is red in its own year');
  assert.equal(app.mesEnRojo(d, s, 8, vm), false, 'September is not');
  var ref = app.resumenAnio(d, s, vm);
  assert.ok(ref.indexOf('En <b>Octubre</b> gastaste más de lo que entró.') > 0, 'the summary names the red month');
  var otro = C.seccion2(false, false); otro.anio = 2027; C.arrastre(otro, 8, 50000, 'declarado');
  app.D = app.normalizar(otro, app.hoy);   // another year is open: the given one still decides
  assert.equal(app.mesEnRojo(d, s, 9, vm), true);
  assert.equal(app.resumenAnio(d, s, vm), ref, 'same summary, same year in the footer');
  app.D = d;
  assert.equal(app.anio().indexOf(ref) >= 0, true, 'renderAnio passes the open year');
});
test('serieVista marks every overlaid model row itself (.modelo), whatever tilesMes returns; legacy rows stay unmarked', function(){
  var app = V.appAnio(C.seccion2(false, false), {2025: C.vacio(2025)}), real = app.tilesMes;
  app.tilesMes = function(d, j, vm){ var t = real(d, j, vm); delete t.modelo; return t; };
  var s = app.serieVista(app.D, app.hoy), vm = app.vistaModelo(app.D, app.hoy);
  app.tilesMes = real;
  var marcas = app.plain(s.map(function(r){ return r.modelo === true; })), esperado = app.plain(vm.cad.meses.map(function(e){ return !e.legacy; }));
  assert.deepEqual(marcas, esperado);
  assert.deepEqual([marcas.slice(0, 8).indexOf(true), marcas.slice(8).indexOf(false)], [-1, -1], 'non-vacuous: legacy January..August, model September..December');
  var s2 = app.serieVista(app.D, app.hoy);
  assert.deepEqual(app.plain(s2), app.plain(app.serieVista(app.D, app.hoy)), 'deterministic');
  assert.deepEqual(app.plain(s2).map(function(r){ return r.modelo === true; }), esperado, 'same marks with the real tilesMes');
});

// N1 item 1 (R4.5 close, design §1): Deudas in a model month = realizado ? cuotasReal : cuotasProg (one source: flujosMes via tilesMes)
function deudasFila(d, otros){
  var app = V.appAnio(d, otros || {2025: C.vacio(2025)}), html = app.anio();
  return {app: app, t: V.tabla(html, 'anTabla'), anios: V.tabla(html, 'anAnios'), csv: V.csvFilas(app.csv())};
}
test('N1-1 Deudas column, model year (section 2): November scheduled installment = 100.000; Total and "Año por año" Deudas = 200.000', function(){
  var x = deudasFila(C.seccion2(false, false)), f = x.app.fARS;
  assert.deepEqual(x.t.slice(8, 12).map(function(r){ return r[COL.deu]; }), [f(100000), '—', f(100000), '—'], 'Sep paid, Oct unpaid (0), Nov scheduled');
  assert.equal(x.t[12][COL.deu], f(200000), 'Total Deudas');
  assert.deepEqual(x.anios[1].slice(0, 4).filter(function(c, i){ return i === 0 || i === 3; }), ['2026', f(200000)], '"Año por año" Deudas');
  assert.equal(x.csv[11][13], '100000', 'CSV Deudas November = scheduled');
});
test('N1-1 Deudas column: a ticked installment in a FUTURE month counts as scheduled, not paid (ticks ignored, §1)', function(){
  var a = deudasFila(C.seccion2(false, false)), b = deudasFila(C.seccion2(false, true)), f = a.app.fARS;
  assert.equal(b.t[10][COL.deu], a.t[10][COL.deu], 'ticked or not, November shows the same scheduled installment');
  var vm = b.app.vistaModelo(b.app.D, b.app.hoy), fm = b.app.flujosMes(b.app.D, 10, b.app.hoy, vm.ctx);
  assert.deepEqual([fm.cuotasReal, fm.cuotasProg], [0, 100000], 'the model holds it as scheduled');
  assert.equal(b.app.tilesMes(b.app.D, 10, vm).totalDeudas, fm.cuotasProg);
  assert.equal(b.t[12][COL.deu], f(200000));
});
test('N1-1 a future model row reconciles: Disponible(j) - Disponible(j-1) = Ingresos - Gastos - Deudas + net transfers', function(){
  var d = C.seccion2(false, false);
  C.mes(d, 11, {ingresos: [C.it('Sueldo', 300000, false)], gastosFijos: [C.it('Luz', 50000, true)], deudas: [C.it('Préstamo', 100000, false)], ahorroMesARS: 20000, retiroARS: 5000});
  var x = deudasFila(d), app = x.app, s = app.serieVista(app.D, app.hoy), j = 11;
  var neto = s[j].sacadoARS - s[j].reposicionARS - s[j].ahorroMesARS;
  assert.equal(s[j].disponibleFinal - s[j - 1].disponibleFinal, s[j].totalIngresos - s[j].totalGastos - s[j].totalDeudas + neto);
  assert.deepEqual([s[j].totalIngresos, s[j].totalGastos, s[j].totalDeudas, neto, s[j].disponibleFinal - s[j - 1].disponibleFinal], [300000, 50000, 100000, -15000, 135000]);
  assert.equal(x.t[j][COL.deu], app.fARS(100000));
});
test('N1-1 legacy guard: a year without arrastre keeps calc().totalDeudas (paid installments only) in the table', function(){
  var d = C.seccion2(false, false); delete d.arrastre;
  var x = deudasFila(d), s = x.app.serie(x.app.D);
  for(var j = 0; j < 12; j++) assert.equal(x.t[j][COL.deu], x.app.fARS(s[j].totalDeudas));
  assert.equal(x.t[10][COL.deu], '—', 'November unticked = not paid, as before');
});

// N1 item 2 (R4.5 close): CSV "Gastos fijos" / "Gastos variables" of a model month split the SAME Gastos the row shows: paid
// subtotals in a past/current month (as before), every registered row of the section in a future month (Programado, §1)
function nov400(){
  var d = C.seccion2(false, false);
  C.mes(d, 10, {gastosFijos: [C.it('Alquiler', 400000, false)], gastosVariables: [C.it('Super', 100000, true)]});
  return d;
}
test('N1-2 year CSV, model year: Gastos fijos + Gastos variables = Gastos for every model month (L-01, section 2, Nov 400.000 + 100.000)', function(){
  [l01(), C.seccion2(false, false), C.seccion2(true, true), nov400()].forEach(function(d, n){
    var app = V.appAnio(d), vm = app.vistaModelo(app.D, app.hoy), l = V.csvFilas(app.csv());
    for(var j = 0; j < 12; j++){
      if(vm.cad.meses[j].legacy) continue;
      var r = l[j + 1];
      assert.equal(+r[2].replace(',', '.') + +r[3].replace(',', '.'), +r[4].replace(',', '.'), 'dataset ' + n + ' month ' + j + ': fijos + variables = Gastos');
    }
  });
  var l = V.csvFilas(V.appAnio(nov400()).csv());
  assert.deepEqual(l[11].slice(1, 5), ['1000000', '400000', '100000', '500000'], 'Nov: unticked fixed 400.000 + ticked variable 100.000, all scheduled');
});
test('N1-2 year CSV: past / current model months keep the paid subtotals; a legacy year is unchanged', function(){
  var app = V.appAnio(C.seccion2(false, false)), l = V.csvFilas(app.csv()), s = app.serie(app.D);
  [8, 9].forEach(function(j){ assert.deepEqual([l[j + 1][2], l[j + 1][3]], [String(s[j].subtotalFijos), String(s[j].subtotalVariables)], 'month ' + j); });
  assert.deepEqual([l[10][2], l[10][3], l[10][4]], ['400000', '0', '400000'], 'Oct: Luz and Supermercado unticked stay pending');
  var d = nov400(); delete d.arrastre;
  var a2 = V.appAnio(d), l2 = V.csvFilas(a2.csv());
  assert.deepEqual([l2[11][2], l2[11][3], l2[11][4]], ['0', '100000', '100000'], 'legacy: paid subtotals, as before');
});

// N1 item 3 (R4.5 close, DERIVED rule, flagged for owner review): in a model year the "El año" summary card reads the same rows as the
// table (serieVista) over the REALIZED months only (past + current, plus legacy months before desde as today); a future month never
// enters the averages; a red month is a negative model Resultado (flujosMes.resultado), never the chained Disponible.
function resumen(html){ var i = html.indexOf('<div class="resumen'); return html.slice(i, html.indexOf('</div></div>', html.indexOf('res-pie', i)) + 12); }
function txt(h){ return h.replace(/<[^>]+>/g, ''); }
test('N1-3 summary card, model year (L-01 + legacy September income 400.000): card averages over the realized months', function(){
  var d = l01(); C.mes(d, 8, {ingresos: [C.it('Sueldo', 400000, true)]});
  var app = V.appAnio(d), r = txt(resumen(app.anio())), f = app.fARS;
  assert.ok(r.indexOf('Por mes entran ' + f(450000) + ' y se van ' + f(50000) + '. Te quedan ' + f(400000) + '.') >= 0, r);
  assert.ok(r.indexOf('6%de lo que entra') >= 0, 'ring = 50.000 / 900.000 (card Ingresos): ' + r);
  assert.ok(r.indexOf('Gastaste más en Octubre y menos en Septiembre.') >= 0, r);
  assert.ok(r.indexOf('A este ritmo cerrás diciembre con ' + f(100000) + '.') >= 0, 'savings at this pace from October: ' + r);
  assert.ok(r.indexOf('Promedio de 2 meses ya transcurridos de 2026') >= 0, 'explicit label: ' + r);
  assert.equal(r.indexOf(f(490000)), -1, 'guard: not the serie() average (580.000 October)');
});
test('N1-3 summary card, model year (section 2, November ticked): a future month is never in the averages', function(){
  var app = V.appAnio(C.seccion2(false, true)), r = txt(resumen(app.anio())), f = app.fARS;
  assert.ok(r.indexOf('Por mes entran ' + f(1000000) + ' y se van ' + f(500000) + '.') >= 0, r);
  assert.ok(r.indexOf('Promedio de 2 meses ya transcurridos de 2026') >= 0, r);
  assert.equal(r.indexOf('Noviembre'), -1, r);
});
test('N1-3 summary card, model year: a red month is a negative model Resultado (October), never the chained Disponible; a future month is never flagged', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 1000000, 'declarado');
  C.mes(d, 8, {ingresos: [C.it('Sueldo', 500000, true)], gastosFijos: [C.it('Alquiler', 100000, true)]});
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 100000, true)], gastosFijos: [C.it('Alquiler', 300000, true)]});
  C.mes(d, 10, {gastosVariables: [C.it('Viaje', 900000, true)]});
  var app = V.appAnio(d), html = app.anio(), r = txt(resumen(html)), s = app.serieVista(app.D, app.hoy);
  assert.ok(s[9].disponibleFinal > 0, 'the chained Disponible of October is positive');
  assert.ok(r.indexOf('En Octubre gastaste más de lo que entró.') >= 0, r);
  assert.equal(r.indexOf('Noviembre'), -1, 'the future month is not flagged: ' + r);
});
test('N1-3 summary card: a legacy year still uses the month flow over the loaded months', function(){
  var d = C.vacio(2026);
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 100000, true)], gastosFijos: [C.it('Alquiler', 300000, true)]});
  C.mes(d, 10, {gastosVariables: [C.it('Viaje', 900000, true)]});
  var r = txt(resumen(V.appAnio(d).anio()));
  assert.ok(r.indexOf('En 2 meses gastaste más de lo que entró.') >= 0, r);
  assert.ok(r.indexOf('2 meses cargados de 2026') >= 0, r);
});

// N1 item 4 (R4.5 close, §1): "En qué se te fue la plata" (ranking) and "Deudas" (proyeccionDeudas) on "El año" never count a ticked
// row of a FUTURE model month as paid; a legacy year is unchanged. Engine untouched: the app passes the realized view of the year.
function seccion(html, k){ var i = html.indexOf('data-sec="' + k + '"'); return i < 0 ? '' : html.slice(i, html.indexOf('data-sec=', i + 10) > 0 ? html.indexOf('data-sec=', i + 10) : html.length); }
function futuroTildado(){ var d = nov400(); d.meses[10].deudas = [C.it('Préstamo', 100000, true)]; return d; }
test('N1-4 ranking, model year: a ticked expense of a future month is not "plata que se fue"', function(){
  var app = V.appAnio(futuroTildado()), r = txt(seccion(app.anio(), 'anRank')), f = app.fARS;
  assert.ok(r.indexOf('Supermercado' + f(200000)) >= 0, 'September paid stays: ' + r);
  assert.equal(r.indexOf('Super' + f(100000)), -1, 'November (future) ticked Super is not in the ranking: ' + r);
});
test('N1-4 Deudas on "El año", model year: a ticked future installment is not paid; same count as evaluating at min(11, mesTope) (pasivos rule)', function(){
  var app = V.appAnio(futuroTildado()), r = txt(seccion(app.anio(), 'anDeudas'));
  assert.ok(r.indexOf('Préstamo3 de 6 · ene 2027') >= 0, '2 before + September; October unpaid, November future: ' + r);
  var e = app.estadoDeuda(app.D, 'Préstamo', Math.min(11, app.mesTope(2026, app.hoy)), app.hoy);
  assert.equal(e.pagadas, 3, 'pasivos evaluation point (R4.2 interpretation 8)');
  var pd = app.proyeccionDeudas(app.datosRealizados(app.D, app.hoy), app.hoy);
  assert.deepEqual([pd[0].e.pagadas, pd[0].e.restantes], [3, 3]);
  assert.equal(app.D.meses[10].deudas[0].pagado, true, 'the stored data is not touched');
});
test('N1-4 legacy guard: a year without arrastre keeps ranking() and proyeccionDeudas() on the data as stored', function(){
  var d = futuroTildado(); delete d.arrastre;
  var app = V.appAnio(d), html = app.anio(), f = app.fARS;
  assert.ok(txt(seccion(html, 'anRank')).indexOf('Super' + f(100000)) >= 0);
  assert.ok(txt(seccion(html, 'anDeudas')).indexOf('Préstamo4 de 6') >= 0);
  assert.equal(app.datosRealizados(app.D, app.hoy), app.D, 'legacy: the same object');
});

// N2 (independent review of N1): the red-month rule of a realized model month reads what the card / row shows (Ingresos incl. the
// realized Trabajo pases, R4.4 interpretation 2), not flujosMes().resultado alone (which leaves the pases out as internal transfers)
test('N2 red month, model year: a month funded by a realized Trabajo pase is not "gastaste más de lo que entró"', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
  C.mes(d, 8, {ingresos: [C.it('Sueldo', 100000, true)], gastosFijos: [C.it('Luz', 10000, true)]});
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 300000, true)], gastosFijos: [C.it('Alquiler', 100000, true)]});
  var app = V.appAnio(d, {}, V.TRAB_PASES()), h = app.anio(), f = app.fARS;
  assert.deepEqual(V.tabla(h, 'anTabla')[9].slice(1, 3), [f(300000), f(100000)], 'the October row: 300.000 in, 100.000 out');
  var r = h.slice(h.indexOf('class="resumen'), h.indexOf('res-pie')).replace(/<[^>]+>/g, ' ');
  assert.equal(r.indexOf('gastaste más de lo que entró'), -1, 'no month spent more than it received');
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 300000, true)], gastosFijos: [C.it('Alquiler', 400000, true)]});
  var h2 = V.appAnio(d, {}, V.TRAB_PASES()).anio(), r2 = h2.slice(h2.indexOf('class="resumen'), h2.indexOf('res-pie')).replace(/<[^>]+>/g, ' ');
  assert.ok(/En\s+Octubre\s+gastaste más de lo que entró/.test(r2), 'still red when the pase does not cover the expenses (300.000 - 400.000)');
});
