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

// ── app-level helpers: a fake localStorage and the real storage-layer functions loaded from index.html ──
function fakeStorage(init, rechaza){
  var d = {}, log = [];
  Object.keys(init || {}).forEach(function(k){ d[k] = init[k]; });
  return {
    d: d, log: log,
    get length(){ return Object.keys(d).length; },
    key: function(i){ var k = Object.keys(d)[i]; return k === undefined ? null : k; },
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function(k, v){ if(rechaza && rechaza(k)) throw new Error('QuotaExceededError'); log.push(k); d[k] = String(v); },
    removeItem: function(k){ delete d[k]; }
  };
}
var FUNCS = ['claveMia', 'dos', 'revGuardada', 'claveCuarentena', 'ponerEnCuarentena', 'cuarentenaAntesDeBorrar', 'avisoCuarentena', 'esc', 'escribirConRev', 'avisoOtraPestana', 'hayEdicion', 'alCambiarOtraPestana', 'recargarDesdeAlmacenamiento',
  'asegurarSnapshotR4', 'respaldoR4', 'diasDelRespaldoR4', 'vencerRespaldoR4', 'volverAntesDeR4', 'ctxModelo', 'cierreAnioAnterior', 'activarSaldos',
  'guardar', 'guardarTrab', 'blobAlDia', 'leerAnio', 'aniosGuardados', 'normTrab', 'leerTrab', 'anioValido', 'escribirAnios', 'armarCopia', 'restaurarTexto', 'avisoCopiaGrande', 'duplicar', 'avisarRestauro'];
var VARS = ['PREF', 'LSANIO', 'LSCOPIA', 'LSOCULTO', 'LSBIENV', 'LSHIST', 'LSTRAB', 'LSVISTA', 'LSR4', 'LSAVCIERRE', 'CLAVES_PROPIAS', 'sucio', 'arrancado', 'obsoleta', 'pendiente', 'MAX_COPIA', 'LSCUAR'];
function nuevaApp(ls, today, extra){
  var g = {localStorage: ls, pildoras: [], recargas: 0, renders: 0, alertas: [], hojas: [], ultPild: 0};
  g.avisos = {innerHTML: '', textContent: ''};
  g.document = {activeElement: null, getElementById: function(id){ return id === 'avisos' ? g.avisos : null; }};
  g.velo = {classList: {contains: function(){ return false; }}};
  g.pildora = function(t, mal){ g.pildoras.push([t, !!mal]); };
  g.estado = function(){}; g.quitarAvisoVacia = function(){}; g.marcarVencidos = function(){}; g.aplicarModo = function(){}; g.recordarAnio = function(){};
  g.render = function(){ g.renders++; };
  g.alerta = function(t, c){ g.alertas.push([t, c]); };
  g.abrirHoja = function(h){ g.hojas.push(h); };
  g.confirmar = function(t, c, e, fn){ fn(); };
  g.location = {reload: function(){ g.recargas++; }};
  g.cargar = function(){}; g.toast = function(){}; g.tieneTrab = function(){ return false; };
  Object.keys(extra || {}).forEach(function(k){ g[k] = extra[k]; });
  g.ls = ls;
  var app = loadAppR4(g, today);
  app.g = g; app.arrancado = true;
  return app;
}
function loadAppR4(g, today){
  var funcs = FUNCS.filter(function(n){ return !(n in g); });   // a stub passed by the test replaces the real function
  var app = la.loadApp({today: today || '2026-10-15', funcs: funcs, vars: VARS, globals: g});
  app.T = app.normTrab(null);
  return app;
}
function guardado(ls, anio){ return JSON.parse(ls.d['kibo.datos.' + anio]); }
function cargarEn(app, ls, anio){ app.D = app.normalizar(JSON.parse(ls.d['kibo.datos.' + anio]), app.hoy); return app.D; }
var AVISO = 'Hay cambios hechos en otra pestaña. Recargá para no perderlos.';

// ── 4. pre-R4 snapshot (Q15) ──
var PROPIAS = {'kibo.datos.2026': '{"a":1}', 'kibo.datos.2025': '{"a":2}', 'kibo.anio': '2026', 'kibo.ultimaCopia': '2026-01-01', 'kibo.oculto': '0',
  'kibo.bienvenida': '1', 'kibo.historial': '[]', 'kibo.trabajo': '{"t":1}', 'kibo.vistaProd': 'compacta'};
test('claveMia: the R4 marker is an own key; the snapshot itself is not (like pre130)', function(){
  var app = nuevaApp(fakeStorage());
  assert.equal(app.claveMia('kibo.modeloSaldos'), true);
  assert.equal(app.claveMia('kibo.respaldo.pre-r4'), false);
});
test('asegurarSnapshotR4: copies ONLY the own keys, with a timestamp, and sets the marker; a second call changes nothing', function(){
  var ls = fakeStorage(Object.assign({}, PROPIAS, {'kibo.otraApp': 'ajeno', 'kibo.datos.test': 'x'}));
  var app = nuevaApp(ls, '2026-10-15');
  assert.equal(app.asegurarSnapshotR4(), true);
  var r = JSON.parse(ls.d['kibo.respaldo.pre-r4']);
  assert.deepEqual(Object.keys(r.datos).sort(), Object.keys(PROPIAS).sort());
  assert.equal(r.datos['kibo.otraApp'], undefined);
  assert.match(r.fecha, /^2026-10-15T/);
  assert.ok(ls.d['kibo.modeloSaldos']);
  var antes = JSON.stringify(ls.d), n = ls.log.length;
  ls.d['kibo.datos.2026'] = '{"a":99}';   // later edits must not enter the snapshot
  assert.equal(app.asegurarSnapshotR4(), true);
  assert.equal(JSON.parse(ls.d['kibo.respaldo.pre-r4']).datos['kibo.datos.2026'], '{"a":1}');
  assert.equal(ls.log.length, n, 'no write on the second call');
  assert.notEqual(antes, undefined);
});
test('asegurarSnapshotR4: when the snapshot cannot be stored it reports false and sets no marker (nothing may be migrated)', function(){
  var ls = fakeStorage(PROPIAS, function(k){ return k === 'kibo.respaldo.pre-r4'; });
  var app = nuevaApp(ls);
  assert.equal(app.asegurarSnapshotR4(), false);
  assert.equal(ls.d['kibo.modeloSaldos'], undefined);
});
test('pre-R4 snapshot expires after 30 days (and only the snapshot goes; the marker stays so it is never retaken)', function(){
  var ls = fakeStorage(PROPIAS), app = nuevaApp(ls, '2026-10-15');
  app.asegurarSnapshotR4();
  var r = JSON.parse(ls.d['kibo.respaldo.pre-r4']);
  r.fecha = '2026-09-16T12:00:00.000Z'; ls.d['kibo.respaldo.pre-r4'] = JSON.stringify(r);   // 29 days earlier
  assert.equal(app.vencerRespaldoR4(), false);
  assert.ok(ls.d['kibo.respaldo.pre-r4']);
  r.fecha = '2026-09-10T12:00:00.000Z'; ls.d['kibo.respaldo.pre-r4'] = JSON.stringify(r);   // 35 days earlier
  assert.equal(app.vencerRespaldoR4(), true);
  assert.equal(ls.d['kibo.respaldo.pre-r4'], undefined);
  assert.ok(ls.d['kibo.modeloSaldos']);
  assert.equal(app.asegurarSnapshotR4(), true);
  assert.equal(ls.d['kibo.respaldo.pre-r4'], undefined, 'not retaken after expiry');
});
test('volverAntesDeR4: restores only own keys, removes the R4 marker and the snapshot, foreign keys survive', function(){
  var ls = fakeStorage(Object.assign({}, PROPIAS, {'kibo.otraApp': 'ajeno'})), app = nuevaApp(ls);
  app.asegurarSnapshotR4();
  ls.d['kibo.datos.2026'] = '{"a":99,"arrastre":{"desde":3}}'; ls.d['kibo.datos.2030'] = 'nuevo'; delete ls.d['kibo.vistaProd']; ls.d['kibo.otraApp2'] = 'tambien ajeno';
  app.volverAntesDeR4();
  assert.equal(app.g.recargas, 1);
  assert.equal(ls.d['kibo.datos.2026'], '{"a":1}');
  assert.equal(ls.d['kibo.datos.2030'], undefined);
  assert.equal(ls.d['kibo.vistaProd'], 'compacta');
  assert.equal(ls.d['kibo.otraApp'], 'ajeno');
  assert.equal(ls.d['kibo.otraApp2'], 'tambien ajeno');
  assert.equal(ls.d['kibo.modeloSaldos'], undefined);
  assert.equal(ls.d['kibo.respaldo.pre-r4'], undefined);
});
test('volverAntesDeR4 ignores foreign keys that a snapshot may contain and does nothing without a snapshot', function(){
  var ls = fakeStorage({'kibo.datos.2026': 'actual', 'kibo.otraApp': 'vivo'}), app = nuevaApp(ls);
  app.volverAntesDeR4();
  assert.equal(app.g.recargas, 0);
  ls.d['kibo.respaldo.pre-r4'] = JSON.stringify({version: 'x', fecha: '2026-10-01T00:00:00.000Z', datos: {'kibo.datos.2026': 'viejo', 'kibo.otraApp': 'del respaldo', 'otro.suelto': 'x'}});
  app.volverAntesDeR4();
  assert.equal(ls.d['kibo.datos.2026'], 'viejo');
  assert.equal(ls.d['kibo.otraApp'], 'vivo');
  assert.equal(ls.d['otro.suelto'], undefined);
});

// ── 5. activarSaldos: snapshot first, then the model, idempotent ──
function blobSeccion2SinModelo(){
  var raw = C.seccion2(false, false); delete raw.arrastre; raw.meses.forEach(function(m){ delete m.cierreReal; });
  return raw;
}
test('activarSaldos: takes the pre-R4 snapshot BEFORE the first write of the model, then saves arrastre derived from the declared value', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(blobSeccion2SinModelo()), 'kibo.anio': '2026'});
  var app = nuevaApp(ls, '2026-10-15');
  cargarEn(app, ls, 2026);
  assert.equal(app.activarSaldos(825000), true);
  assert.deepEqual(plain(app.D.arrastre), {desde: 9, inicial: {apertura: 175000, declarado: 825000, declaradoEl: '2026-10-15', origen: 'declarado'}});
  assert.deepEqual(guardado(ls, 2026).arrastre, plain(app.D.arrastre));
  assert.ok(ls.log.indexOf('kibo.respaldo.pre-r4') >= 0 && ls.log.indexOf('kibo.respaldo.pre-r4') < ls.log.indexOf('kibo.datos.2026'), 'snapshot written before the year');
  var snap = JSON.parse(ls.d['kibo.respaldo.pre-r4']);
  assert.equal(JSON.parse(snap.datos['kibo.datos.2026']).arrastre, undefined, 'the snapshot holds the OLD data');
});
test('activarSaldos(null): skipped balance is stored as omitido; calling again does nothing (idempotent)', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(blobSeccion2SinModelo())}), app = nuevaApp(ls, '2026-10-15');
  cargarEn(app, ls, 2026);
  assert.equal(app.activarSaldos(null), true);
  assert.equal(app.D.arrastre.inicial.origen, 'omitido');
  var antes = ls.d['kibo.datos.2026'], n = ls.log.length;
  assert.equal(app.activarSaldos(500000), false);
  assert.equal(ls.d['kibo.datos.2026'], antes);
  assert.equal(ls.log.length, n);
  assert.equal(app.D.arrastre.inicial.origen, 'omitido');
});
test('activarSaldos: if the snapshot cannot be stored nothing is migrated', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(blobSeccion2SinModelo())}, function(k){ return k === 'kibo.respaldo.pre-r4'; });
  var app = nuevaApp(ls, '2026-10-15');
  cargarEn(app, ls, 2026);
  var antes = ls.d['kibo.datos.2026'];
  assert.equal(app.activarSaldos(825000), false);
  assert.equal(app.D.arrastre, undefined);
  assert.equal(ls.d['kibo.datos.2026'], antes);
  assert.equal(ls.d['kibo.modeloSaldos'], undefined);
});
test('activarSaldos: a year that is not the current one, or an invalid declared number, writes nothing', function(){
  var ls = fakeStorage({'kibo.datos.2025': JSON.stringify(C.vacio(2025))}), app = nuevaApp(ls, '2026-10-15');
  cargarEn(app, ls, 2025);
  assert.equal(app.activarSaldos(100), false);
  assert.equal(app.D.arrastre, undefined);
  var ls2 = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026))}), app2 = nuevaApp(ls2, '2026-10-15');
  cargarEn(app2, ls2, 2026);
  assert.equal(app2.activarSaldos('mucho'), false);
  assert.equal(ls2.d['kibo.respaldo.pre-r4'], undefined);
});

// ── 6. duplicar: the year chain ──
function appDuplicar(d, ls, previos){
  var app = nuevaApp(ls || fakeStorage(), '2026-10-15', {
    leerAnio: function(a){ return previos && previos[a] ? M.normalizar(C.copy(previos[a]), HOY) : null; },
    guardar: function(){}
  });
  app.D = d;
  return app;
}
test('duplicar with arrastre: the new year starts from the December closing (calculated) with origen arrastre and the snapshot of that closing', function(){
  var d = M.normalizar(C.copy(C.seccion2(false, false)), HOY);
  var app = appDuplicar(d);
  app.duplicar();
  assert.equal(app.D.anio, 2027);
  assert.deepEqual(plain(app.D.arrastre), {desde: 0, inicial: {apertura: 825000, origen: 'arrastre', calculadoOrigen: 825000}});
  assert.equal(app.D.rev, undefined, 'a new year starts its own revision');
  app.D.meses.forEach(function(m){ assert.equal('cierreReal' in m, false); });
  assert.equal(M.cadena(app.D, HOY, {cierrePrevio: 825000}).meses[0].apertura, 825000);
});
test('duplicar: a confirmed December closing wins over the calculated one, and the calculated one is kept for drift detection', function(){
  var d = M.normalizar(C.copy(C.seccion2(false, false)), HOY);
  d.meses[11].cierreReal = {valor: 800000, calculadoAlConfirmar: 825000, confirmadoEl: '2026-10-01'};
  var app = appDuplicar(d);
  app.duplicar();
  assert.deepEqual(plain(app.D.arrastre), {desde: 0, inicial: {apertura: 800000, origen: 'arrastre', calculadoOrigen: 825000}});
  assert.equal('cierreReal' in app.D.meses[11], false, 'the confirmation belongs to the old year');
});
test('duplicar without arrastre: legacy stays legacy (no model field is invented), and stale R4 fields are never copied', function(){
  var d = M.normalizar(C.copy(blobSeccion2SinModelo()), HOY);
  d.rev = 4;
  var app = appDuplicar(d);
  app.duplicar();
  assert.equal(app.D.arrastre, undefined);
  assert.equal(app.D.rev, undefined);
  assert.equal(d.rev, 4, 'the source year is untouched');
});
test('duplicar from a chained year uses the LIVE closing of the previous year (not the stale snapshot)', function(){
  var prev = C.vacio(2025); C.arrastre(prev, 8, 100000, 'declarado');
  C.mes(prev, 8, {ingresos: [C.it('Sueldo', 500000, true)]});
  var d = C.vacio(2026); d.arrastre = {desde: 0, inicial: {apertura: 100000, origen: 'arrastre', calculadoOrigen: 100000}};
  C.mes(d, 0, {ingresos: [C.it('Sueldo', 200000, true)]});
  d = M.normalizar(d, HOY);
  var vivo = M.cadena(M.normalizar(C.copy(prev), HOY), HOY, {}).meses[11].cierre;   // 600.000, not the 100.000 of the snapshot
  assert.equal(vivo, 600000);
  var app = appDuplicar(d, null, {2025: prev});
  app.duplicar();
  assert.equal(app.D.arrastre.inicial.apertura, M.cadena(d, HOY, {cierrePrevio: vivo}).meses[11].cierre);
  assert.equal(app.D.arrastre.inicial.apertura, 800000);
});

// ── 7. several tabs (Q12): a per-blob revision ──
test('a save increments the revision of the blob', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026))}), app = nuevaApp(ls);
  cargarEn(app, ls, 2026);
  app.sucio = true; app.guardar();
  assert.equal(guardado(ls, 2026).rev, 1);
  app.sucio = true; app.guardar();
  assert.equal(guardado(ls, 2026).rev, 2);
  assert.equal(app.D.rev, 2);
});
test('two tabs: the second writer with a stale rev does NOT overwrite, shows the notice and marks the tab as stale', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026))}), A = nuevaApp(ls), B = nuevaApp(ls);
  cargarEn(A, ls, 2026); cargarEn(B, ls, 2026);
  A.D.meses[9].ingresos = [C.it('Sueldo', 111, true)]; A.sucio = true; A.guardar();
  B.D.meses[9].ingresos = [C.it('Sueldo', 999, true)]; B.sucio = true; B.guardar();
  assert.equal(guardado(ls, 2026).meses[9].ingresos[0].monto, 111, 'tab A data is intact');
  assert.equal(guardado(ls, 2026).rev, 1);
  assert.equal(B.obsoleta, true);
  assert.equal(B.sucio, true, 'B still has unsaved edits (they are not silently dropped)');
  assert.ok(B.g.avisos.innerHTML.indexOf(AVISO) >= 0, B.g.avisos.innerHTML);
  assert.equal(A.obsoleta, false);
  var n = ls.log.length;
  B.guardar();   // a stale tab never writes again until it reloads
  assert.equal(ls.log.length, n);
  // after reloading from storage the tab can save again, on top of A's data
  B.recargarDesdeAlmacenamiento();
  assert.equal(B.obsoleta, false);
  assert.equal(B.D.meses[9].ingresos[0].monto, 111);
  B.D.meses[9].gastosFijos = [C.it('Alquiler', 5, true)]; B.sucio = true; B.guardar();
  assert.equal(guardado(ls, 2026).rev, 2);
  assert.equal(guardado(ls, 2026).meses[9].gastosFijos[0].monto, 5);
  assert.equal(guardado(ls, 2026).meses[9].ingresos[0].monto, 111);
});
test('two tabs: a blob that disappeared from storage (cleared) can be written again, nothing is overwritten', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(Object.assign(C.vacio(2026), {rev: 5}))}), app = nuevaApp(ls);
  cargarEn(app, ls, 2026);
  delete ls.d['kibo.datos.2026'];
  app.sucio = true; app.guardar();
  assert.equal(guardado(ls, 2026).rev, 6);
  assert.equal(app.obsoleta, false);
});
test('Trabajo blob: same revision guard (stale tab does not overwrite)', function(){
  var ls = fakeStorage(), A = nuevaApp(ls), B = nuevaApp(ls);
  A.T = A.leerTrab(); B.T = B.leerTrab();
  A.T.tope = 100; assert.equal(A.guardarTrab(true), true);
  assert.equal(JSON.parse(ls.d['kibo.trabajo']).rev, 1);
  B.T.tope = 999;
  assert.equal(B.guardarTrab(true), false);
  assert.equal(JSON.parse(ls.d['kibo.trabajo']).tope, 100);
  assert.equal(B.obsoleta, true);
  assert.ok(B.g.avisos.innerHTML.indexOf(AVISO) >= 0);
  var C2 = nuevaApp(ls); C2.T = C2.leerTrab();   // normTrab keeps the revision
  assert.equal(C2.T.rev, 1);
  C2.T.tope = 7; assert.equal(C2.guardarTrab(true), true);
  assert.equal(JSON.parse(ls.d['kibo.trabajo']).rev, 2);
});
test('storage event: no unsaved edits -> silent reload of the changed year; the tab stays usable', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026))}), A = nuevaApp(ls), B = nuevaApp(ls);
  cargarEn(A, ls, 2026); cargarEn(B, ls, 2026);
  A.D.meses[9].ingresos = [C.it('Sueldo', 111, true)]; A.sucio = true; A.guardar();
  B.alCambiarOtraPestana({key: 'kibo.datos.2026', storageArea: ls});
  assert.equal(B.D.meses[9].ingresos[0].monto, 111);
  assert.equal(B.D.rev, 1);
  assert.equal(B.g.renders, 1);
  assert.equal(B.g.avisos.innerHTML, '');
  assert.equal(B.obsoleta, false);
  B.D.meses[9].ingresos[0].monto = 222; B.sucio = true; B.guardar();   // and it can save on top of A
  assert.equal(guardado(ls, 2026).meses[9].ingresos[0].monto, 222);
});
test('storage event: with unsaved edits (or an open sheet / a focused field) the tab is NOT reloaded: it shows the notice', function(){
  var casos = [function(app){ app.sucio = true; }, function(app){ app.g.velo.classList.contains = function(){ return true; }; },
    function(app){ app.g.document.activeElement = {tagName: 'INPUT'}; }];
  casos.forEach(function(prep, i){
    var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026))}), A = nuevaApp(ls), B = nuevaApp(ls);
    cargarEn(A, ls, 2026); cargarEn(B, ls, 2026);
    A.D.meses[9].ingresos = [C.it('Sueldo', 111, true)]; A.sucio = true; A.guardar();
    B.D.meses[9].ingresos = [C.it('Sueldo', 5, true)]; prep(B);
    B.alCambiarOtraPestana({key: 'kibo.datos.2026', storageArea: ls});
    assert.equal(B.D.meses[9].ingresos[0].monto, 5, 'case ' + i + ': in-memory edit untouched');
    assert.equal(B.g.renders, 0, 'case ' + i);
    assert.equal(B.obsoleta, true, 'case ' + i);
    assert.ok(B.g.avisos.innerHTML.indexOf(AVISO) >= 0, 'case ' + i);
  });
});
test('storage event: keys that are not this tab year or Trabajo are ignored; a Trabajo change reloads Trabajo', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026))}), A = nuevaApp(ls), B = nuevaApp(ls);
  cargarEn(B, ls, 2026); B.T = B.leerTrab();
  ['kibo.datos.2025', 'kibo.ultimaCopia', 'kibo.anio', null, 'otra.app'].forEach(function(k){ B.alCambiarOtraPestana({key: k, storageArea: ls}); });
  B.alCambiarOtraPestana({key: 'kibo.datos.2026', storageArea: {}});   // sessionStorage or another area
  assert.equal(B.g.renders, 0);
  assert.equal(B.obsoleta, false);
  A.T = A.leerTrab(); A.T.tope = 321; A.guardarTrab(true);
  B.alCambiarOtraPestana({key: 'kibo.trabajo', storageArea: ls});
  assert.equal(B.T.tope, 321);
  assert.equal(B.g.renders, 1);
});

// ── 8. backup -> restore keeps the model fields ──
function copiaDe(d, ls){ var app = nuevaApp(ls); app.D = d; return JSON.stringify(app.armarCopia()); }
function restaurar(ls, texto){
  var app = nuevaApp(ls); app.D = app.normalizar({anio: 2026}, app.hoy);
  app.restaurarTexto(texto);
  assert.equal(typeof app.pendiente, 'function', 'the confirmation sheet registers the restore');
  app.pendiente();
  return app;
}
test('backup -> restore through the real app functions: arrastre, cierreReal and rev survive', function(){
  var d = M.normalizar(C.copy(C.seccion2(false, false)), HOY); d.rev = 4;
  var ls1 = fakeStorage({'kibo.datos.2026': JSON.stringify(d)});
  var texto = copiaDe(cargarEn(nuevaApp(ls1), ls1, 2026), ls1);
  var ls2 = fakeStorage();
  restaurar(ls2, texto);
  var b = guardado(ls2, 2026);
  assert.deepEqual(b.arrastre, plain(d.arrastre));
  assert.deepEqual(b.meses[8].cierreReal, plain(d.meses[8].cierreReal));
  assert.equal(b.rev, 5, 'N4 I-5: a restored year always moves its revision forward: max(stored, own 4) + 1, also onto an empty device');
  assert.ok(ls2.d['kibo.modeloSaldos'], 'restoring an R4 backup onto a device marks it as migrated');
  assert.equal(ls2.d['kibo.respaldo.pre-r4'], undefined, 'nothing to snapshot on an empty device');
  assert.deepEqual(plain(M.cadena(M.normalizar(b, HOY), HOY, {})), plain(M.cadena(d, HOY, {})), 'same chain after the round trip');
});
test('restoring an R4 backup over existing data: the OLD data is snapshotted first, and the revision moves forward (never back)', function(){
  var d = M.normalizar(C.copy(C.seccion2(false, false)), HOY); d.rev = 3;
  var texto = copiaDe(d, fakeStorage({'kibo.datos.2026': JSON.stringify(d)}));
  var viejo = JSON.stringify(Object.assign(C.vacio(2026), {rev: 7}));
  var ls = fakeStorage({'kibo.datos.2026': viejo});
  restaurar(ls, texto);
  var snap = JSON.parse(ls.d['kibo.respaldo.pre-r4']);
  assert.equal(snap.datos['kibo.datos.2026'], viejo);
  assert.ok(ls.log.indexOf('kibo.respaldo.pre-r4') < ls.log.indexOf('kibo.datos.2026'));
  assert.equal(guardado(ls, 2026).rev, 8, 'max(stored 7, incoming 3) + 1: a tab that loaded rev 7 or 3 can never overwrite the restore');
  assert.ok(guardado(ls, 2026).arrastre);
});
test('restoring an older backup WITHOUT arrastre leaves the year without it (the model asks again in R5)', function(){
  var conModelo = M.normalizar(C.copy(C.seccion2(false, false)), HOY);
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(conModelo), 'kibo.modeloSaldos': '2026-10-01T00:00:00.000Z'});
  var viejoTexto = JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: blobSeccion2SinModelo()}});
  restaurar(ls, viejoTexto);
  var b = guardado(ls, 2026);
  assert.equal(b.arrastre, undefined);
  b.meses.forEach(function(m){ assert.equal('cierreReal' in m, false); });
  assert.equal(M.cadena(M.normalizar(b, HOY), HOY, {}).resumen.sinDisponible, true);
});
test('restoring a backup whose Trabajo revision is HIGHER than the stored one writes Trabajo (no false conflict)', function(){
  var guardadoT = {facturas: [], cobros: [], pases: [], gastos: [], productos: [], tope: 1, rev: 2};
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026)), 'kibo.trabajo': JSON.stringify(guardadoT)});
  var texto = JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: C.vacio(2026)},
    trabajo: {facturas: [], cobros: [], pases: [], gastos: [], productos: [], tope: 55, rev: 9}});
  var app = nuevaApp(ls, null, {descTrabajo: function(){ return ''; }});   // the confirmation text is not under test
  app.D = app.normalizar({anio: 2026}, app.hoy);
  app.restaurarTexto(texto); app.pendiente();
  var t = JSON.parse(ls.d['kibo.trabajo']);
  assert.equal(t.tope, 55, 'the Trabajo part of the backup is stored');
  assert.ok(t.rev > 2, 'the revision moves past what any tab loaded');
  assert.equal(app.obsoleta, false, 'no other tab exists: the tab is not marked stale');
  assert.equal(app.g.avisos.innerHTML.indexOf(AVISO), -1, 'no "other tab" notice');
});
test('restore resets the stale flag of the tab (it replaces everything)', function(){
  var ls = fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026))}), app = nuevaApp(ls);
  app.obsoleta = true;
  app.D = app.normalizar({anio: 2026}, app.hoy);
  app.restaurarTexto(JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: C.vacio(2026)}}));
  app.pendiente();
  assert.equal(app.obsoleta, false);
});

// ── 9. static guards on index.html ──
var SRC = la.SRC_FOR_TESTS;
test('index.html: the storage listener, the Ajustes row and the actions exist; activarSaldos is only called by the first-use answer (R5), never automatically', function(){
  assert.match(SRC, /window\.addEventListener\('storage', alCambiarOtraPestana\)/);
  assert.match(SRC, /filaAj\('volverR4'/);
  assert.match(SRC, /a === 'volverR4'/);
  assert.match(SRC, /a === 'recargarPag'/);
  var llamadas = SRC.match(/activarSaldos\(/g) || [];
  assert.equal(llamadas.length, 2, 'the definition and one caller');
  assert.match(la.extractFunction('primerUso'), /activarSaldos\(v\)/, 'the caller is the first-use prompt (Guardar / Omitir), a user action');
});
test('index.html: the restore row shows only while the snapshot exists and is younger than 30 days', function(){
  assert.match(SRC, /respaldoR4\(\) && diasDelRespaldoR4\(\) <= 30 \? filaAj\('volverR4'/);
});
