'use strict';
// R4.3: OLD DATA -> BACKUP -> NORMALIZE -> MIGRATE -> VALIDATE -> MODEL (never OLD DATA -> MODIFY -> HOPE).
// Covers: model fields preserved/validated by normalizar (never created), the pure model start (iniciarArrastre), the pre-R4 snapshot
// and its restore, the year chain on duplicar, the legacy `pagado` reference date (Q9), the per-blob revision for several tabs (Q12)
// and backup -> restore. Contract: odd/tasks/repair-sprint-1-r4-design.md sections 8, 10 and 12.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var base = require('./fixtures/motor-corpus');
var baseline = require('./fixtures/baseline-normalizar-7f7ad40');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
var R4_YEAR = ['arrastre', 'rev'];
function quitarR4(d){   // the pre-migration view of a normalized blob: no model field of R4.3
  var o = plain(d);
  R4_YEAR.forEach(function(k){ delete o[k]; });
  o.meses.forEach(function(m){ delete m.cierreReal; });
  return o;
}

// ── datasets: minimal, real-like (R4 corpus), old shapes, corrupt ──
function viejo7f7ad40(anio){   // blob as the 7f7ad40-era app saved it: no pagoExplicito, no pagado, some text amounts
  var meses = [], i;
  for(i = 0; i < 12; i++) meses.push({ingresos: [{nombre: 'Sueldo', monto: i < 6 ? '1000' : 0}], gastosFijos: [{nombre: 'Alquiler', monto: 300}], gastosVariables: [], deudas: [{nombre: 'Préstamo', monto: 50}],
    ahorroMesARS: 20, movimientos: [{id: 'm' + i, fecha: '2026-01-0' + (i % 9 + 1), sec: 'gastosVariables', nombre: 'Super', monto: 10}]});
  return {anio: anio, version: 1, actualizado: '2026-07-20T10:00:00.000Z', cotizacionUSD: 1400, meses: meses, planDeudas: {'Préstamo': {total: 600, recargo: 0, cuotas: 12, pagadasAntes: 1}}};
}
function v131(anio){   // v1.31.x: explicit pagado, pagoExplicito, no model fields
  var d = base.datasets()[0][1];
  d = C.copy(d); d.anio = anio; return d;
}
function conUsdYCripto(){
  var d = C.vacio(2026);
  d.cripto = [{activo: 'BTC', cantidad: 0.5, precioUSD: 60000}];
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 900000, true)], gastosFijos: [C.it('Alquiler', 300000, true)], ahorroMesARS: 100000, ahorroMesUSD: 50, compraARS: 150000, compraUSD: 100, ventaUSD: 20, ventaARS: 30000,
    deudas: [C.it('Tarjeta', 40000, false)], movimientos: []});
  d.planDeudas = {'Tarjeta': {total: 120000, recargo: 0, cuotas: 3, pagadasAntes: 0}};
  return d;
}
function conTrabajo(){
  var d = C.vacio(2026);
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 300000, true), C.it('Sueldo', 100000, true)]});
  return d;
}
var CTX_TRABAJO = {pasesTrabajo: {'2026-10': [{fecha: '2026-10-05', monto: 200000}, {fecha: '2026-10-10', monto: 100000}]}};
var DATASETS = [
  ['vacio', function(){ return {}; }],
  ['minimo', function(){ return C.vacio(2026); }],
  ['seccion2', function(){ var d = C.seccion2(false, false); delete d.arrastre; d.meses.forEach(function(m){ delete m.cierreReal; }); return d; }],
  ['mixed2026 (R4 corpus)', function(){ return base.datasets()[0][1]; }],
  ['legacy2026 (R4 corpus)', function(){ return base.datasets()[3][1]; }],
  ['7f7ad40-era', function(){ return viejo7f7ad40(2026); }],
  ['v1.31.x', function(){ return v131(2026); }],
  ['usd y cripto', conUsdYCripto],
  ['trabajo', conTrabajo],
  ['meses faltantes y numeros como texto', function(){ var d = C.vacio(2026); d.meses = [{ingresos: [{nombre: 'Sueldo', monto: '1.500'}]}, null, 'x']; d.cotizacionUSD = '1450'; return d; }]
];
var HOY = C.hoy('2026-10-15');

// ── 1. normalizar preserves and validates the model fields, and never creates them ──
test('normalizar never creates arrastre, cierreReal or rev (initialization needs the user answer)', function(){
  DATASETS.forEach(function(e){
    var d = M.normalizar(C.copy(e[1]()), HOY);
    assert.equal('arrastre' in d, false, e[0] + ': arrastre');
    assert.equal('rev' in d, false, e[0] + ': rev');
    d.meses.forEach(function(m, j){ assert.equal('cierreReal' in m, false, e[0] + ': cierreReal ' + j); });
  });
});

test('normalizar keeps a well-formed arrastre / cierreReal / rev exactly (and is idempotent)', function(){
  var raw = C.vacio(2026);
  raw.arrastre = {desde: 8, inicial: {apertura: 50000, declarado: 825000, declaradoEl: '2026-10-15', origen: 'declarado', calculadoOrigen: 123}};
  raw.rev = 7;
  raw.meses[8].cierreReal = {valor: 175000, calculadoAlConfirmar: 200000, confirmadoEl: '2026-10-01'};
  var d = plain(M.normalizar(C.copy(raw), HOY));
  assert.deepEqual(d.arrastre, raw.arrastre);
  assert.equal(d.rev, 7);
  assert.deepEqual(d.meses[8].cierreReal, raw.meses[8].cierreReal);
  assert.deepEqual(plain(M.normalizar(C.copy(d), HOY)), d);
});

test('normalizar coerces numbers and drops malformed fields one by one (never invents values)', function(){
  var raw = C.vacio(2026);
  raw.arrastre = {desde: '3', inicial: {apertura: '1500', declarado: 'abc', declaradoEl: 42, origen: 'raro', calculadoOrigen: null, extra: 1}};
  raw.rev = '5';
  raw.meses[3].cierreReal = {valor: '900', calculadoAlConfirmar: 'x', confirmadoEl: 7};
  var d = plain(M.normalizar(C.copy(raw), HOY));
  assert.deepEqual(d.arrastre, {desde: 3, inicial: {apertura: 1500}});
  assert.equal(d.rev, 5);
  assert.deepEqual(d.meses[3].cierreReal, {valor: 900});
});

test('normalizar drops whole fields that cannot be read: null / unreadable arrastre, cierreReal without valor, bad rev', function(){
  [null, 'x', 5, [], {}, {desde: 'abc'}, {desde: null}, {desde: 12}, {desde: -1}, {inicial: {apertura: 1}}].forEach(function(a){
    var raw = C.vacio(2026); raw.arrastre = a;
    assert.equal('arrastre' in M.normalizar(raw, HOY), false, JSON.stringify(a));
  });
  [null, 'x', [], {}, {valor: 'abc'}, {valor: ''}, {valor: null}, {calculadoAlConfirmar: 5}].forEach(function(c){
    var raw = C.vacio(2026); raw.meses[2].cierreReal = c;
    assert.equal('cierreReal' in M.normalizar(raw, HOY).meses[2], false, JSON.stringify(c));
  });
  [-1, 'x', null, {}, NaN, Infinity, ''].forEach(function(r){
    var raw = C.vacio(2026); raw.rev = r;
    assert.equal('rev' in M.normalizar(raw, HOY), false, JSON.stringify(r));
  });
  var raw2 = C.vacio(2026); raw2.rev = 2.9;
  assert.equal(M.normalizar(raw2, HOY).rev, 2);
});

test('additive only: stripping arrastre / cierreReal / rev from a migrated blob gives exactly the pre-migration normalized blob (no loss, idempotent)', function(){
  DATASETS.forEach(function(e){
    var antes = plain(M.normalizar(C.copy(e[1]()), HOY));
    var migrado = M.normalizar(C.copy(e[1]()), HOY);
    var ar = M.iniciarArrastre(migrado, HOY, 777000, {});
    if(ar) migrado.arrastre = ar;
    migrado.rev = 3;
    if(migrado.meses[8]) migrado.meses[8].cierreReal = {valor: 1, calculadoAlConfirmar: 2, confirmadoEl: '2026-10-01'};
    var dos = plain(M.normalizar(plain(migrado), HOY));
    assert.deepEqual(quitarR4(dos), antes, e[0] + ': stripping the R4 fields must give the pre-migration blob');
    assert.deepEqual(plain(M.normalizar(plain(dos), HOY)), dos, e[0] + ': idempotent');
    // no loss of the user's original values
    var raw = e[1](), x;
    if(raw && Array.isArray(raw.meses)) raw.meses.forEach(function(m, j){
      if(!m || typeof m !== 'object') return;
      ['ahorroMesARS', 'ahorroMesUSD', 'compraARS', 'compraUSD', 'retiroARS', 'ventaUSD', 'ventaARS', 'reposicionARS'].forEach(function(k){
        if(m[k] !== undefined) assert.equal(dos.meses[j][k], +m[k], e[0] + ' ' + k + ' ' + j);
      });
      ['ingresos', 'gastosFijos', 'gastosVariables', 'deudas'].forEach(function(s){
        (m[s] || []).forEach(function(it, q){
          if(!it || typeof it !== 'object') return;   // junk rows are normalized to empty rows, not part of the user's values
          x = dos.meses[j][s][q]; assert.equal(x.nombre, String(it.nombre || '')); assert.equal(x.monto, M.num(it.monto));
        });
      });
    });
  });
});

test('legacy isolation (I6): months before arrastre.desde read exactly as before, with or without the model fields', function(){
  DATASETS.forEach(function(e){
    var d0 = M.normalizar(C.copy(e[1]()), HOY), d1 = M.normalizar(C.copy(e[1]()), HOY);
    d1.arrastre = {desde: 5, inicial: {apertura: 100, origen: 'declarado'}}; d1.rev = 9;
    var s0 = plain(M.serie(d0, HOY)), s1 = plain(M.serie(d1, HOY)), cad = M.cadena(d1, HOY, {});
    assert.deepEqual(s1, s0, e[0] + ': serie unchanged by the model fields');
    for(var j = 0; j < 5; j++){
      assert.equal(cad.meses[j].legacy, true, e[0] + ' month ' + j);
      assert.deepEqual(plain(cad.meses[j].calc), plain(M.calc(d0.meses[j])), e[0] + ' calc ' + j);
      assert.equal(JSON.stringify(d1.meses[j]), JSON.stringify(d0.meses[j]), e[0] + ' blob ' + j);
    }
    assert.deepEqual(plain(M.patrimonio(d1)), plain(M.patrimonio(d0)), e[0] + ': old patrimonio unchanged');
  });
});

test('old-version round trip: the baseline normalizar (7f7ad40) keeps year-level arrastre/rev and month-level cierreReal', function(){
  var d = M.normalizar(C.copy(C.seccion2(false, false)), HOY);
  d.rev = 12;
  var t = JSON.parse(JSON.stringify(d)), viejo = baseline.normalizar(t);   // what an old install does when it loads and saves the blob
  assert.deepEqual(plain(viejo.arrastre), plain(d.arrastre));
  assert.equal(viejo.rev, 12);
  assert.deepEqual(plain(viejo.meses[8].cierreReal), plain(d.meses[8].cierreReal));
  // and the new code reads it back unchanged
  var otra = plain(M.normalizar(plain(viejo), HOY));
  assert.deepEqual(otra.arrastre, plain(d.arrastre));
  assert.deepEqual(otra.meses[8].cierreReal, plain(d.meses[8].cierreReal));
  assert.equal(otra.rev, 12);
});

// ── 2. Q9: the legacy `pagado` inference is dated by the blob's last save ──
function legacyConMeses(actualizado){
  var d = {anio: 2026, meses: []}, i;
  if(actualizado !== undefined) d.actualizado = actualizado;
  for(i = 0; i < 12; i++) d.meses.push({ingresos: [{nombre: 'Sueldo', monto: 100}]});
  return d;
}
function flags(d){ return d.meses.map(function(m){ return m.ingresos[0].pagado; }); }
test('Q9: a blob saved in March only infers months up to March as paid, however late it is restored', function(){
  var d = M.normalizar(legacyConMeses('2026-03-10T12:00:00.000Z'), HOY);   // hoy is October
  assert.deepEqual(flags(d), [true, true, true, false, false, false, false, false, false, false, false, false]);
});
test('Q9: without a usable save date (absent, garbage) the reference stays hoy, as before; a future date is capped to hoy', function(){
  var hasta = [true, true, true, true, true, true, true, true, true, true, false, false];
  assert.deepEqual(flags(M.normalizar(legacyConMeses(), HOY)), hasta);
  assert.deepEqual(flags(M.normalizar(legacyConMeses(''), HOY)), hasta);
  assert.deepEqual(flags(M.normalizar(legacyConMeses('ayer'), HOY)), hasta);
  assert.deepEqual(flags(M.normalizar(legacyConMeses('2027-02-01T00:00:00.000Z'), HOY)), hasta);
  assert.deepEqual(flags(M.normalizar(legacyConMeses('2026-13-01'), HOY)), hasta);
});
test('Q9: a blob saved in an earlier year than the blob year still marks nothing as paid; older years are fully inferred', function(){
  var d = legacyConMeses('2025-12-20T00:00:00.000Z');
  assert.deepEqual(flags(M.normalizar(d, HOY)), new Array(12).fill(false));   // saved before this year even started
  var v = legacyConMeses('2026-05-01T00:00:00.000Z'); v.anio = 2024;
  assert.deepEqual(flags(M.normalizar(v, HOY)), new Array(12).fill(true));   // a closed year is closed, whatever the save date
});
test('Q9: a blob that already has explicit pagado is not touched by the save date', function(){
  var d = legacyConMeses('2026-03-10T12:00:00.000Z'); d.pagoExplicito = true;
  assert.deepEqual(flags(M.normalizar(d, HOY)), new Array(12).fill(undefined));
});

// ── 3. iniciarArrastre (Q1, D5) ──
test('iniciarArrastre: contract section 2, declare 825.000 on 2026-10-15 with Oct realized 600.000 and pases +50.000 -> apertura 175.000', function(){
  var raw = C.seccion2(false, false); delete raw.arrastre; raw.meses.forEach(function(m){ delete m.cierreReal; });
  var d = M.normalizar(raw, HOY);
  var ar = plain(M.iniciarArrastre(d, HOY, 825000, {}));
  assert.deepEqual(ar, {desde: 9, inicial: {apertura: 175000, declarado: 825000, declaradoEl: '2026-10-15', origen: 'declarado'}});
  d.arrastre = ar;
  assert.equal(M.cadena(d, HOY, {}).resumen.disponibleActual, 825000);   // the model reproduces what the user declared
});
test('iniciarArrastre: skipping gives origen omitido and no apertura; invalid input or another year gives nothing', function(){
  var d = M.normalizar(C.vacio(2026), HOY);
  var om = {desde: 9, inicial: {apertura: null, declarado: null, declaradoEl: '2026-10-15', origen: 'omitido'}};
  assert.deepEqual(plain(M.iniciarArrastre(d, HOY, null, {})), om);
  assert.deepEqual(plain(M.iniciarArrastre(d, HOY, undefined, {})), om);
  assert.equal(M.iniciarArrastre(d, HOY, 'abc', {}), null);
  assert.equal(M.iniciarArrastre(d, HOY, NaN, {}), null);
  assert.equal(M.iniciarArrastre(M.normalizar(C.vacio(2025), HOY), HOY, 100, {}), null);   // the model starts in the year that contains hoy
  d.arrastre = M.iniciarArrastre(d, HOY, null, {});
  var res = M.cadena(d, HOY, {}).resumen;
  assert.equal(M.cadena(d, HOY, {}).meses[9].sinSaldoInicial, true);
  assert.equal(res.desde, 9);
});
test('iniciarArrastre: the derived opening makes the available money equal the declared one (several datasets, with USD, crypto, debts and Trabajo pases)', function(){
  [['usd y cripto', conUsdYCripto(), {}], ['trabajo', conTrabajo(), CTX_TRABAJO], ['minimo', C.vacio(2026), {}], ['mixed', base.datasets()[0][1], {}]].forEach(function(e){
    var d = M.normalizar(C.copy(e[1]), HOY);
    [0, 1000, 825000, -5000, 12345.67].forEach(function(dec){
      var c = C.copy(d); c.arrastre = M.iniciarArrastre(c, HOY, dec, e[2]);
      assert.ok(Math.abs(M.cadena(c, HOY, e[2]).resumen.disponibleActual - dec) < 0.005, e[0] + ' ' + dec);
    });
  });
  var tr = M.normalizar(conTrabajo(), HOY);   // the Trabajo row is the projection of the pases (section 7): it is not counted twice
  assert.equal(M.iniciarArrastre(tr, HOY, 1000000, CTX_TRABAJO).inicial.apertura, 1000000 - 100000 - 300000);
});
test('iniciarArrastre is pure: it does not mutate the blob and gives the same answer twice', function(){
  var d = M.normalizar(C.copy(C.seccion2(false, false)), HOY); delete d.arrastre;
  var antes = JSON.stringify(d), a = plain(M.iniciarArrastre(d, HOY, 825000, {})), b = plain(M.iniciarArrastre(d, HOY, 825000, {}));
  assert.deepEqual(a, b); assert.equal(JSON.stringify(d), antes);
});
