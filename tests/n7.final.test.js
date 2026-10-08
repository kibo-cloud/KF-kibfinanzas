'use strict';
// N7 (final verification, night run): the three last fixes. Each test failed before its fix (recorded in odd/tasks/repair-sprint-1.md).
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');

// ── N7-1: a fresh "Versión para PC" file opens the year it carries, not the calendar year ──
var M1 = '/*DATOS_' + 'INICIO*/', M2 = '/*DATOS_' + 'FIN*/';
function semilla(){ var d = M.normalizar(C.vacio(2026), HOY); d.actualizado = ''; return d; }   // what the app ships: a 2026 year, never saved, nothing loaded
function exportado(anio){   // what versionPC embeds: the open year as it was saved
  var d = M.normalizar(C.vacio(anio), HOY);
  d.meses[9].ingresos = [C.it('Sueldo', 900000, true)]; d.actualizado = '2027-01-20T10:00:00.000Z'; d.rev = 4;
  return d;
}
function appCargar(ls, embebido, today){
  var avisos = {innerHTML: ''}, datos = {textContent: '\n' + M1 + JSON.stringify(embebido) + M2 + '\n'};
  var g = {localStorage: ls, arrancado: false, T: null, navigator: {},
    document: {getElementById: function(id){ return id === 'datos' ? datos : id === 'avisos' ? avisos : null; }},
    aplicarTema: function(){}, render: function(){}, avisoSinGuardado: function(){}, vioBienvenida: function(){ return true; }, bienvenida: function(){},
    avisoPrimeraVez: function(){}, revisarCopia: function(){}, avisoCuarentena: function(){}, tieneTrab: function(){ return false; }};
  var app = la.loadApp({today: today || '2026-10-15', funcs: helpersPresentes(['cargar', 'anioActivo', 'recordarAnio', 'leerAnio', 'aniosGuardados', 'leerEmbebido', 'hayDatos',
    'revGuardada', 'revValida', 'claveCuarentena', 'ponerEnCuarentena', 'semillaExportada', 'anioValido'], la.SRC_FOR_TESTS),
    vars: ['PREF', 'LSANIO', 'M1', 'M2', 'LSCUAR', 'LSTRAB', 'sucio'], globals: g});
  return app;
}
// a helper the harness asks for and the app no longer has is a loud failure (renamed or removed), never silently dropped
function helpersPresentes(nombres, src){
  var faltan = nombres.filter(function(n){ return !new RegExp('^function ' + n + '\\s*\\(', 'm').test(src); });
  if(faltan.length) throw new Error('appCargar: helper(s) missing from index.html: ' + faltan.join(', '));
  return nombres;
}

test('N7-1 a fresh PC file of 2027 opens 2027 (calendar 2026), remembers it, and an edit saves under kibo.datos.2027', function(){
  var ls = H.fakeStorage({});
  var app = appCargar(ls, exportado(2027));
  app.cargar();
  assert.equal(app.D.anio, 2027, 'the embedded year, not the calendar year');
  assert.equal(app.D.meses[9].ingresos[0].monto, 900000);
  assert.equal(ls.d['kibo.anio'], '2027', 'remembered as the open year in that file\'s storage');
  // reopening the same file: the remembered year is read back (nothing stored yet), still 2027
  var otra = appCargar(ls, exportado(2027)); otra.cargar();
  assert.equal(otra.D.anio, 2027);
});

test('N7-1 a PC file whose own storage has a stale kibo.anio still opens the embedded year when nothing is stored', function(){
  var ls = H.fakeStorage({'kibo.anio': '2025'});
  var app = appCargar(ls, exportado(2027));
  app.cargar();
  assert.deepEqual([app.D.anio, ls.d['kibo.anio']], [2027, '2027']);
});

test('N7-1 the normal app is unchanged: the shipped seed takes the remembered or calendar year; stored data still wins', function(){
  var a = appCargar(H.fakeStorage({}), semilla(), '2027-03-01'); a.cargar();
  assert.equal(a.D.anio, 2027, 'calendar year with the shipped seed');
  var ls = H.fakeStorage({'kibo.anio': '2028'});
  var b = appCargar(ls, semilla()); b.cargar();
  assert.equal(b.D.anio, 2028, 'remembered year with the shipped seed');
  var ls2 = H.fakeStorage({'kibo.anio': '2026', 'kibo.datos.2026': JSON.stringify(M.normalizar(C.vacio(2026), HOY))});
  var c = appCargar(ls2, exportado(2027)); c.cargar();
  assert.equal(c.D.anio, 2026, 'a stored year always wins over the embedded one');
});

// ── N7-2: the rollbacks never delete an unreadable own blob without quarantining it first ──
var ROTO = '{"anio":2027,"meses":[{"ingresos":[{"nombre":"Sueldo","monto":900000';

test('N7-2 volverAntesDeR4 quarantines an unreadable non-active year and Trabajo before deleting own keys', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.vacio(2026), HOY)), 'kibo.trabajo': JSON.stringify({version: 1, facturas: []})});
  var app = H.appAlmacen(ls);
  assert.equal(app.asegurarSnapshotR4(), true);
  ls.d['kibo.datos.2027'] = ROTO; ls.d['kibo.trabajo'] = '{roto';
  app.volverAntesDeR4();
  assert.equal(app.g.recargas, 1);
  assert.equal(ls.d['kibo.datos.2027'], undefined, 'the rollback still removes keys created after the snapshot');
  assert.equal(ls.d['kibo.cuarentena.2027'], ROTO, 'the raw text was kept');
  assert.equal(ls.d['kibo.cuarentena.trabajo'], '{roto');
});

test('N7-2 volverAntesDeR4 does nothing when the quarantine copy cannot be stored', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.vacio(2026), HOY))}, function(k){ return k.indexOf('kibo.cuarentena.') === 0; });
  var app = H.appAlmacen(ls);
  app.asegurarSnapshotR4();
  ls.d['kibo.datos.2027'] = ROTO;
  app.volverAntesDeR4();
  assert.equal(app.g.recargas, 0);
  assert.equal(ls.d['kibo.datos.2027'], ROTO, 'nothing deleted');
  assert.ok(ls.d['kibo.respaldo.pre-r4'], 'the snapshot is still there to try again');
  assert.deepEqual(app.g.pildoras.map(function(p){ return p[1]; }), [true]);
});

test('N7-2 volverAntesDe130 quarantines an unreadable non-active year before deleting own keys', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': '{"a":1}', 'kibo.respaldo.pre130': JSON.stringify({version: 'anterior a 1.30', fecha: '2026-01-01T00:00:00.000Z', datos: {'kibo.datos.2026': '{"a":1}'}})});
  ls.d['kibo.datos.2027'] = ROTO;
  var app = H.appAlmacen(ls, null, {LSESQ: 'kibo.esquema', LSPRE130: 'kibo.respaldo.pre130'}, ['volverAntesDe130', 'respaldoPrevio']);
  assert.equal(app.LSPRE130, la.extractVar('LSESQ').indexOf("LSPRE130 = 'kibo.respaldo.pre130'") >= 0 ? 'kibo.respaldo.pre130' : null, 'same key as the app');
  app.volverAntesDe130();
  assert.equal(app.g.recargas, 1);
  assert.equal(ls.d['kibo.datos.2027'], undefined);
  assert.equal(ls.d['kibo.cuarentena.2027'], ROTO);
});

test('N7-2 volverAntesDe130 refuses and keeps everything when the unreadable year cannot be quarantined (native review follow-up, night range T7)', function(){
  var pre = JSON.stringify({version: 'anterior a 1.30', fecha: '2026-01-01T00:00:00.000Z', datos: {'kibo.datos.2026': '{"a":1}'}});
  var ls = H.fakeStorage({'kibo.datos.2026': '{"b":2}', 'kibo.esquema': '1.30', 'kibo.respaldo.pre130': pre}, function(k){ return k.indexOf('kibo.cuarentena.') === 0; });
  ls.d['kibo.datos.2027'] = ROTO;
  var antes = JSON.stringify(ls.d);
  var app = H.appAlmacen(ls, null, {LSESQ: 'kibo.esquema', LSPRE130: 'kibo.respaldo.pre130'}, ['volverAntesDe130', 'respaldoPrevio']);
  app.volverAntesDe130();
  assert.equal(app.g.recargas, 0, 'no reload');
  assert.equal(JSON.stringify(ls.d), antes, 'nothing deleted or restored: the unreadable year, the open year, the schema mark and the pre-1.30 copy stay');
  assert.deepEqual(app.plain(app.g.pildoras), [['No pude apartar los datos que no se pueden leer, así que no cambié nada. Hacé una copia de seguridad y probá de nuevo.', true]]);
});
test('appCargar fails loudly when a requested helper is missing (native review follow-up, night range T7)', function(){
  assert.throws(function(){ helpersPresentes(['cargar', 'noExisteEstaFuncion'], la.SRC_FOR_TESTS); }, /helper\(s\) missing from index\.html: noExisteEstaFuncion/);
  assert.deepEqual(helpersPresentes(['cargar', 'leerAnio'], la.SRC_FOR_TESTS), ['cargar', 'leerAnio']);
});

// ── N7-3: every distinct unreadable text is kept, never replaced; backups carry them all and restore brings them back ──
test('N7-3 a second, different corruption of Trabajo is kept next to the first before Trabajo is written again', function(){
  var ls = H.fakeStorage({'kibo.trabajo': '{primero'});
  var app = H.appAlmacen(ls); app.T = app.leerTrab();
  assert.equal(app.guardarTrab(true), true);
  ls.d['kibo.trabajo'] = '{segundo';
  app.T = app.leerTrab();
  assert.equal(app.guardarTrab(true), true);
  ls.d['kibo.trabajo'] = '{primero';   // the same text again: no duplicate copy
  app.T = app.leerTrab(); app.guardarTrab(true);
  var copias = Object.keys(ls.d).filter(function(k){ return k.indexOf('kibo.cuarentena.') === 0; }).sort();
  assert.deepEqual(copias.map(function(k){ return ls.d[k]; }).sort(), ['{primero', '{segundo']);
  assert.equal(ls.d['kibo.cuarentena.trabajo'], '{primero', 'the first copy keeps its key');
});

test('N7-3 a restore over a year whose unreadable text changed keeps both texts', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': ROTO});
  var app = H.appAlmacen(ls); app.D = M.normalizar({anio: 2026}, HOY); app.sucio = true;
  assert.equal(app.guardar(), false);   // quarantined (first text)
  ls.d['kibo.datos.2026'] = ROTO + 'otro';
  app.restaurarTexto(JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: C.vacio(2026)}}));
  app.pendiente();
  assert.equal(JSON.parse(ls.d['kibo.datos.2026']).anio, 2026);
  var textos = Object.keys(ls.d).filter(function(k){ return k.indexOf('kibo.cuarentena.2026') === 0; }).map(function(k){ return ls.d[k]; }).sort();
  assert.deepEqual(textos, [ROTO, ROTO + 'otro']);
});

test('N7-3 armarCopia carries every quarantined text and a restore on a wiped phone brings them all back (no duplicates)', function(){
  var ls = H.fakeStorage({'kibo.trabajo': '{a'});
  var app = H.appAlmacen(ls); app.T = app.leerTrab(); app.guardarTrab(true);
  ls.d['kibo.trabajo'] = '{b'; app.T = app.leerTrab(); app.guardarTrab(true);
  ls.d['kibo.datos.2025'] = 'x1'; app.D = M.normalizar(C.vacio(2026), HOY);
  var cp = app.plain(app.armarCopia());
  assert.deepEqual(Object.keys(cp.cuarentena).map(function(k){ return cp.cuarentena[k]; }).sort(), ['x1', '{a', '{b']);
  var limpio = H.fakeStorage({});
  var b = H.appAlmacen(limpio); b.D = M.normalizar(C.vacio(2026), HOY);
  b.restaurarTexto(JSON.stringify(Object.assign({}, cp, {anios: {2026: C.vacio(2026)}}))); b.pendiente();
  var vuelta = function(){ return Object.keys(limpio.d).filter(function(k){ return k.indexOf('kibo.cuarentena.') === 0; }).map(function(k){ return limpio.d[k]; }).sort(); };
  assert.deepEqual(vuelta(), ['x1', '{a', '{b']);
  b.restaurarTexto(JSON.stringify(Object.assign({}, cp, {anios: {2026: C.vacio(2026)}}))); b.pendiente();
  assert.deepEqual(vuelta(), ['x1', '{a', '{b'], 'restoring the same backup twice adds nothing');
  assert.equal(b.claveMia('kibo.cuarentena.trabajo.2'), false, 'every copy is a device key');
});
