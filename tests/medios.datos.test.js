'use strict';
// 1.35 cash / digital split, data model (T1 of odd/tasks/cash-digital-split.md): the optional per-line `medio`, the quick-expense
// `movimientos` medio and previous medio (`mp`), the month transfers between cash and digital (extraccionARS / depositoARS), the cash
// opening (arrastre.inicial.aperturaEfectivo), the Trabajo pase `forma`, and the pre-migration snapshot taken when the schema moves to 1.35.
// Old data never gains a field: a year without cash looks exactly as before.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var base = require('./fixtures/motor-corpus');

var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function norm(d){ return plain(M.normalizar(C.copy(d), HOY)); }

test('normalizar keeps medio "efectivo" on a line and drops any other value (missing = digital)', function(){
  var d = C.vacio(2026);
  C.mes(d, 9, {ingresos: [Object.assign(C.it('Sueldo', 100, true), {medio: 'efectivo'}), Object.assign(C.it('Changas', 50, true), {medio: 'digital'})],
    gastosFijos: [Object.assign(C.it('Alquiler', 30, true), {medio: 'EFECTIVO'}), Object.assign(C.it('Luz', 10, true), {medio: 1})],
    gastosVariables: [Object.assign(C.it('Super', 20, true), {medio: 'efectivo'})], deudas: [Object.assign(C.it('Tarjeta', 5, false), {medio: 'efectivo'})]});
  var m = norm(d).meses[9];
  assert.equal(m.ingresos[0].medio, 'efectivo');
  assert.equal('medio' in m.ingresos[1], false, 'digital is the absence of the field');
  assert.equal('medio' in m.gastosFijos[0], false, 'only the exact value counts');
  assert.equal('medio' in m.gastosFijos[1], false);
  assert.equal(m.gastosVariables[0].medio, 'efectivo');
  assert.equal(m.deudas[0].medio, 'efectivo');
});

test('normalizar keeps the quick-expense medio and the previous line medio (mp) for Undo', function(){
  var d = C.vacio(2026);
  C.mes(d, 9, {movimientos: [
    {id: 'a', fecha: '2026-10-02', sec: 'gastosVariables', nombre: 'Super', monto: 10, medio: 'efectivo', mp: 'digital'},
    {id: 'b', fecha: '2026-10-03', sec: 'gastosVariables', nombre: 'Super', monto: 5, medio: 'cheque', mp: 'x'},
    {id: 'c', fecha: '2026-10-03', sec: 'gastosVariables', nombre: 'Super', monto: 5, mp: 'efectivo'}]});
  var mv = norm(d).meses[9].movimientos;
  assert.equal(mv[0].medio, 'efectivo'); assert.equal(mv[0].mp, 'digital');
  assert.equal('medio' in mv[1], false); assert.equal('mp' in mv[1], false);
  assert.equal('medio' in mv[2], false); assert.equal(mv[2].mp, 'efectivo');
});

test('month transfers between cash and digital are kept only as positive numbers', function(){
  var d = C.vacio(2026);
  C.mes(d, 3, {extraccionARS: 20000, depositoARS: '5000'});
  C.mes(d, 4, {extraccionARS: 0, depositoARS: -10});
  C.mes(d, 5, {extraccionARS: 'abc', depositoARS: null});
  var n = norm(d);
  assert.equal(n.meses[3].extraccionARS, 20000);
  assert.equal(n.meses[3].depositoARS, 5000);
  [4, 5, 0].forEach(function(j){ assert.equal('extraccionARS' in n.meses[j], false, 'month ' + j); assert.equal('depositoARS' in n.meses[j], false, 'month ' + j); });
});

test('arrastre.inicial.aperturaEfectivo is validated: numbers (also numeric text) kept, garbage and absurd values dropped, never created', function(){
  function con(v){ var d = C.arrastre(C.vacio(2026), 9, 1000, 'declarado'); if(v !== undefined) d.arrastre.inicial.aperturaEfectivo = v; return norm(d).arrastre.inicial; }
  assert.equal(con(300).aperturaEfectivo, 300);
  assert.equal(con(-250.5).aperturaEfectivo, -250.5, 'a negative opening is data, not clamped');
  assert.equal(con('1200').aperturaEfectivo, 1200);
  assert.equal(con(0).aperturaEfectivo, 0, 'an answered 0 stays (the first-use cash question is not asked again)');
  ['abc', '', null, true, {}, 1e14, -1e14, Infinity].forEach(function(v){ assert.equal('aperturaEfectivo' in con(v), false, String(v)); });
  assert.equal('aperturaEfectivo' in con(), false, 'never invented');
});

test('old data gains no cash field and normalizar stays idempotent on cash data', function(){
  base.datasets().forEach(function(e){
    var n = norm(e[1]), txt = JSON.stringify(n);
    ['"medio"', '"extraccionARS"', '"depositoARS"', '"aperturaEfectivo"', '"mp"'].forEach(function(k){ assert.equal(txt.indexOf(k), -1, e[0] + ': ' + k); });
    assert.deepEqual(norm(n), n, e[0] + ': idempotent');
  });
  var d = C.arrastre(C.vacio(2026), 9, 1000, 'declarado', {aperturaEfectivo: 400});
  C.mes(d, 9, {gastosVariables: [Object.assign(C.it('Super', 20, true), {medio: 'efectivo'})], extraccionARS: 100,
    movimientos: [{id: 'a', fecha: '2026-10-02', sec: 'gastosVariables', nombre: 'Super', monto: 20, medio: 'efectivo', mp: 'digital', pp: false}]});
  var once = norm(d);
  assert.deepEqual(norm(once), once);
});

// ── app side: Trabajo pases and the schema snapshot ──
function fakeStorage(init){
  var d = {}; Object.keys(init || {}).forEach(function(k){ d[k] = init[k]; });
  return {d: d, get length(){ return Object.keys(d).length; }, key: function(i){ var k = Object.keys(d)[i]; return k === undefined ? null : k; },
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function(k, v){ d[k] = String(v); }, removeItem: function(k){ delete d[k]; }};
}
var VARS = ['PREF', 'LSANIO', 'LSCOPIA', 'LSOCULTO', 'LSBIENV', 'LSHIST', 'LSTRAB', 'LSVISTA', 'LSESQ', 'LSR4', 'LSAVCIERRE', 'LSDATOSDESDE', 'LSCOPIAPOS', 'CLAVES_PROPIAS', 'LSCUAR', 'LSDIARIO'];
function appSeguro(ls){
  var g = {localStorage: ls, pildora: function(){}, location: {reload: function(){ g.recargado = true; }}, confirmar: function(t, c, e, fn){ fn(); }};
  var app = la.loadApp({funcs: ['claveMia', 'seguroActualizacion', 'respaldoMedios', 'diasDelRespaldoMedios', 'vencerRespaldoMedios', 'volverAntesDeMedios', 'cuarentenaAntesDeBorrar', 'revGuardada', 'claveCuarentena', 'ponerEnCuarentena'], vars: VARS, globals: g});
  app.g = g; return app;
}

test('schema 1.30 -> 1.35: a silent pre-migration snapshot of the own keys (no update notice, no pre-1.30 copy)', function(){
  var ls = fakeStorage({'kibo.esquema': '1.30', 'kibo.datos.2026': '{"a":1}', 'kibo.trabajo': '{"t":1}', 'kibo.otraApp': 'ajeno'});
  var app = appSeguro(ls);
  assert.equal(app.ESQUEMA, '1.35');
  assert.equal(app.seguroActualizacion(), false, 'the version notice comes from versionNueva, not from here');
  var r = JSON.parse(ls.d['kibo.respaldo.pre-medios']);
  assert.deepEqual(Object.keys(r.datos).sort(), ['kibo.datos.2026', 'kibo.trabajo']);
  assert.equal(ls.d['kibo.respaldo.pre130'], undefined);
  assert.equal(ls.d['kibo.esquema'], '1.35');
  ls.d['kibo.datos.2026'] = '{"a":2}';
  assert.equal(app.seguroActualizacion(), false);
  assert.equal(JSON.parse(ls.d['kibo.respaldo.pre-medios']).datos['kibo.datos.2026'], '{"a":1}', 'taken once');
});

test('schema snapshot: nothing on a new phone; pre-1.30 phones keep the old behavior (pre130 copy and notice)', function(){
  var ls = fakeStorage({'kibo.esquema': '1.30'}), app = appSeguro(ls);
  assert.equal(app.seguroActualizacion(), false);
  assert.equal(ls.d['kibo.respaldo.pre-medios'], undefined, 'no own data, no copy');
  var ls2 = fakeStorage({'kibo.datos.2026': '{"a":1}'}), app2 = appSeguro(ls2);
  assert.equal(app2.seguroActualizacion(), true);
  assert.ok(ls2.d['kibo.respaldo.pre130']);
  assert.equal(ls2.d['kibo.respaldo.pre-medios'], undefined);
});

test('volverAntesDeMedios restores only own keys and consumes the snapshot; it expires after 30 days', function(){
  var ls = fakeStorage({'kibo.esquema': '1.30', 'kibo.datos.2026': '{"a":1}', 'kibo.otraApp': 'ajeno'}), app = appSeguro(ls);
  app.seguroActualizacion();
  ls.d['kibo.datos.2026'] = '{"medio":1}'; ls.d['kibo.datos.2027'] = 'nuevo';
  app.volverAntesDeMedios();
  assert.equal(app.g.recargado, true);
  assert.equal(ls.d['kibo.datos.2026'], '{"a":1}');
  assert.equal(ls.d['kibo.datos.2027'], undefined);
  assert.equal(ls.d['kibo.otraApp'], 'ajeno');
  assert.equal(ls.d['kibo.respaldo.pre-medios'], undefined);
  assert.equal(ls.d['kibo.esquema'], '1.35', 'kept: the next start does not copy again');
  ls.d['kibo.respaldo.pre-medios'] = JSON.stringify({version: 'x', fecha: '2026-04-01T00:00:00.000Z', datos: {}});
  assert.equal(app.vencerRespaldoMedios(), true, 'older than 30 days (today is 2026-06-15 in loadApp)');
  assert.equal(ls.d['kibo.respaldo.pre-medios'], undefined);
});

test('normTrab keeps a cash pase (forma efectivo) and adds nothing to the others', function(){
  var app = la.loadApp({funcs: ['normTrab', 'esISO', 'hoyISO', 'utcDe', 'formaValida', 'stockValido', 'nomCarpeta', 'colorValido', 'catValida', 'tjId', 'dos'], vars: ['FORMAS', 'CATS', 'COLCARP']});
  var t = app.plain(app.normTrab({pases: [{id: 'p1', fecha: '2026-10-05', monto: 100, forma: 'efectivo'}, {id: 'p2', fecha: '2026-10-06', monto: 50, forma: 'echeq'}, {id: 'p3', fecha: '2026-10-07', monto: 20}]}));
  assert.equal(t.pases[0].forma, 'efectivo');
  assert.equal('forma' in t.pases[1], false);
  assert.equal('forma' in t.pases[2], false);
  assert.deepEqual(app.plain(app.normTrab(t)).pases, t.pases, 'idempotent');
});
