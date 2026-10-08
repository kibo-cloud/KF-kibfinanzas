'use strict';
// L6 (R6) analysis in "El año": this month against the previous one and the average of the earlier realized months (Cobrado, Pagado,
// Ahorro = the serieVista row, the same numbers as the table and the month card), the gastos per category (ticked rows, which add up
// to Pagado), and "Más que lo normal" (a presentation threshold). Future months never count (I5); legacy years use their own numbers.
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var FUNCS = ['analisisAnio', 'variacion', 'mesesTranscurridos', 'mesesCargados', 'datosRealizados', 'serieVista', 'pctTxt', 'flecha', 'fraseComp',
  'htmlComparacion', 'htmlTendencias', 'barritas', 'fARS', 'grupos', 'esc'];
function app(raw, today){
  var a = H.appVista(raw, null, null, today || '2026-10-15', {funcs: FUNCS, vars: ['MESES', 'CORTOS', 'MAS_QUE_LO_NORMAL', 'TOP_CATEGORIAS'], globals: {oculto: false, PUNTOS: '..'}});
  a.analisis = function(){ var vm = a.vistaModelo(a.D, a.hoy), s = a.serieVista(a.D, a.hoy); return {an: a.analisisAnio(a.D, s, a.hoy, vm), s: s}; };
  return a;
}
var it = C.it;
function mesG(ing, gastos, ahorro){ return {ingresos: [it('Sueldo', ing, true)], gastosVariables: gastos, ahorroMesARS: ahorro || 0}; }

// a model year from July; hoy 2026-10-15: Jul-Sep past, Oct current, Nov future (with large ticked amounts that must never count)
function modelo(){
  var d = C.vacio(2026); C.arrastre(d, 6, 100000);
  C.mes(d, 6, mesG(1000000, [it('Super', 200000, true), it('Nafta', 50000, true)], 100000));
  C.mes(d, 7, mesG(1000000, [it('Super', 220000, true), it('Nafta', 50000, true), it('Ropa', 30000, false)], 100000));
  C.mes(d, 8, mesG(1200000, [it('Super', 180000, true), it('Nafta', 50000, true)], 160000));
  C.mes(d, 9, mesG(900000, [it('Super', 300000, true), it('Nafta', 62000, true), it('Cine', 10000, true), it('Ropa', 99000, false)], 50000));
  C.mes(d, 10, mesG(5000000, [it('Super', 9000000, true), it('Viaje', 7000000, true)], 0));
  return d;
}

test('L6 realized months only: the reference is the current month, the average is the earlier realized months, November never counts', function(){
  var a = app(modelo()), r = a.analisis(), an = a.plain(r.an), s = r.s;
  assert.equal(an.ref, 9); assert.equal(an.anterior, 8); assert.deepEqual(an.base, [6, 7, 8]); assert.deepEqual(an.meses, [6, 7, 8, 9]);
  assert.equal(an.enCurso, true); assert.equal(an.simple, false);
  assert.equal(an.comp.pagado.actual, s[9].totalGastos, 'Pagado = the serieVista row (the month card tile)');
  assert.equal(an.comp.pagado.actual, 372000);
  assert.equal(an.comp.pagado.promedio, (s[6].totalGastos + s[7].totalGastos + s[8].totalGastos) / 3);
  assert.equal(an.comp.pagado.promedio, 250000);
  assert.equal(an.comp.pagado.vsPromedio, (372000 - 250000) / 250000);
  assert.equal(an.comp.pagado.vsAnterior, (372000 - 230000) / 230000);
  assert.equal(an.comp.cobrado.actual, s[9].totalIngresos);
  assert.equal(an.comp.ahorro.vsPromedio, (50000 - 120000) / 120000);
  assert.deepEqual(an.categorias.map(function(c){ return c.nombre; }), ['Super', 'Nafta', 'Cine'], 'November\'s Viaje never appears; unticked Ropa neither');
  assert.equal(an.categorias[0].porMes[10], 0, 'a future month adds nothing, even ticked');
});

test('L6 the categories of each realized month add up to its Pagado (one source: the ticked gastos)', function(){
  var a = app(modelo()), r = a.analisis(), an = a.plain(r.an);
  an.meses.forEach(function(j){
    var t = 0; an.categorias.forEach(function(c){ t += c.porMes[j]; });
    assert.equal(t, r.s[j].totalGastos, 'month ' + j);
  });
});

test('L6 "Más que lo normal": 25% or more over the category average of the earlier months; a new category has no average', function(){
  var a = app(modelo()), an = a.plain(a.analisis().an);
  // Super: 300.000 vs (200.000 + 220.000 + 180.000) / 3 = 200.000 -> +50%; Nafta: 62.000 vs 50.000 -> +24% (not); Cine: new (average 0 -> no %)
  assert.deepEqual(an.masQueLoNormal.map(function(c){ return [c.nombre, c.vsPromedio]; }), [['Super', 0.5]]);
  var d = modelo(); d.meses[9].gastosVariables[1].monto = 62500;   // exactly +25%
  var b = app(d), bn = b.plain(b.analisis().an);
  assert.deepEqual(bn.masQueLoNormal.map(function(c){ return c.nombre; }), ['Super', 'Nafta']);
  assert.equal(bn.categorias.filter(function(c){ return c.nombre === 'Cine'; })[0].vsPromedio, null);
});

test('L6 sentences and the comparison card', function(){
  var a = app(modelo()), an = a.analisis().an, h = a.htmlComparacion(an);
  assert.equal(a.fraseComp(an, 'pagado', 'promedio'), 'Este mes gastaste 49% más que tu promedio.');
  assert.equal(a.fraseComp(an, 'pagado', 'anterior'), 'Este mes gastaste 62% más que en septiembre.');
  assert.equal(a.fraseComp(an, 'ahorro', 'promedio'), 'Este mes ahorraste 58% menos que tu promedio.');
  assert.match(h, /<p>Este mes gastaste 49% más que tu promedio\.<\/p>/);
  assert.match(h, /Octubre todavía no terminó: cuenta lo que ya cobraste y pagaste\. El promedio es el de 3 meses anteriores\./);
  assert.match(h, /data-comp="pagado"><span>Pagado<\/span><b>\$372\.000<\/b><span>↑ 62%<\/span><span>↑ 49%<\/span>/);
  assert.ok(h.indexOf('Cálculo simple') < 0);
  var t = a.htmlTendencias(an);
  assert.match(t, /Más que lo normal en octubre: <b>Super<\/b> \(\$300\.000, 50% más que su promedio\)\./);
  assert.equal((t.match(/class="an-cat"/g) || []).length, 3);
});

test('L6 division by zero and short years: no base means no percentage and no sentence', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 0);
  C.mes(d, 8, {ingresos: [it('Sueldo', 1000000, true)], gastosVariables: [it('Super', 0, true)]});
  C.mes(d, 9, mesG(1000000, [it('Super', 100000, true)], 0));
  var a = app(d), an = a.plain(a.analisis().an);
  assert.equal(an.comp.pagado.anterior, 0);
  assert.equal(an.comp.pagado.vsAnterior, null, 'September paid nothing: no "infinite %"');
  assert.equal(an.comp.pagado.vsPromedio, null);
  assert.equal(an.comp.ahorro.vsPromedio, null);
  assert.equal(a.fraseComp(a.analisis().an, 'pagado', 'promedio'), '');
  var uno = C.vacio(2026); C.arrastre(uno, 9, 0); C.mes(uno, 9, mesG(1000000, [it('Super', 100000, true)], 0));
  var b = app(uno), bn = b.analisis().an;
  assert.deepEqual(b.plain(bn.base), []); assert.equal(bn.comp.pagado.promedio, null); assert.equal(bn.anterior, null);
  assert.match(b.htmlComparacion(bn), /Cuando tengas un mes más cargado, acá vas a ver cómo viene este contra los anteriores\./);
  assert.match(b.htmlComparacion(bn), /Todavía no hay meses anteriores para promediar\./);
});

test('L6 empty data and a year that has not started: no analysis at all', function(){
  var a = app(C.vacio(2026));
  assert.equal(a.analisis().an, null);
  var fut = C.vacio(2027); C.mes(fut, 0, mesG(1000000, [it('Super', 100000, true)], 0));
  var b = app(fut);
  assert.equal(b.analisis().an, null, 'every month of 2027 is in the future (I5)');
});

test('L6 legacy year: its own numbers (calc/serie), marked "Cálculo simple"; December of a past year is the reference', function(){
  var d = C.vacio(2025);
  C.mes(d, 9, mesG(1000000, [it('Super', 200000, true), it('<b>x</b>', 1000, true)], 0));
  C.mes(d, 10, mesG(1000000, [it('Super', 260000, true)], 0));
  C.mes(d, 11, mesG(1000000, [it('Super', 150000, true), it('Regalos', 90000, true)], 0));
  var a = app(d), r = a.analisis(), an = a.plain(r.an);
  assert.equal(an.ref, 11); assert.equal(an.enCurso, false); assert.equal(an.simple, true);
  assert.equal(an.comp.pagado.actual, a.calc(a.D.meses[11]).totalGastos);
  assert.equal(an.comp.pagado.promedio, (a.calc(a.D.meses[9]).totalGastos + a.calc(a.D.meses[10]).totalGastos) / 2);
  var h = a.htmlComparacion(r.an);
  assert.match(h, /<p>En diciembre gastaste/);
  assert.match(h, /Cálculo simple/);
  assert.ok(a.htmlTendencias(r.an).indexOf('&lt;b&gt;x&lt;/b&gt;') > 0, 'category names are escaped');
});
