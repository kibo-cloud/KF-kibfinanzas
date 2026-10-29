'use strict';
// N4 (pre-Alpha code audit): integrity fixes I-1..I-7. Each test failed before its fix (recorded in odd/tasks/repair-sprint-1.md).
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');

// ── I-1: quick expense in a future model month adds the amount but does not tick ahead ──
function gastoApp(d, mes, sec, cat, monto){
  var g = {gr: {monto: monto, cat: cat, sec: sec}, toasts: [], document: {getElementById: function(){ return null; }}};
  g.cerrarHoja = function(){}; g.tocar = function(){}; g.conScroll = function(){}; g.renderMes = function(){}; g.fARS = function(v){ return '$' + v; };
  g.toast = function(t){ g.toasts.push(t); };
  var app = la.loadApp({today: '2026-10-15', funcs: ['sumarGasto', 'mesDelModelo', 'preguntaPago', 'anotarMov'], globals: g});
  d = C.copy(d); if(!d.meses[mes].gastosVariables) d.meses[mes].gastosVariables = [C.it('Supermercado', 0, false)];
  app.D = M.normalizar(d, HOY); app.mes = mes;
  return app;
}
function modelo(){ var d = C.vacio(2026); d.arrastre = {desde: 0, inicial: {apertura: 100000, origen: 'declarado'}}; return d; }

test('I-1 quick expense on an empty row of a FUTURE model month: amount added, row left programado (not ticked)', function(){
  var app = gastoApp(modelo(), 11, 'gastosVariables', 0, 5000);
  app.sumarGasto();
  var it = app.D.meses[11].gastosVariables[0];
  assert.deepEqual([it.monto, it.pagado], [5000, false]);
  var mv = app.D.meses[11].movimientos[0];
  assert.deepEqual([mv.monto, mv.pp], [5000, false], 'Deshacer restores the untouched state');
});

test('I-1 a row already ticked ahead keeps its tick (nothing is unticked either)', function(){
  var d = modelo(); d.meses[11].gastosVariables = [{nombre: 'Supermercado', monto: 0, pagado: true}];
  var app = gastoApp(d, 11, 'gastosVariables', 0, 5000);
  app.sumarGasto();
  assert.deepEqual([app.D.meses[11].gastosVariables[0].monto, app.D.meses[11].gastosVariables[0].pagado], [5000, true]);
});

test('I-1 current and past model months and legacy years keep the old behavior (an empty row becomes paid)', function(){
  [[modelo(), 9], [modelo(), 3], [C.vacio(2026), 11], [C.vacio(2026), 9]].forEach(function(c){
    var app = gastoApp(c[0], c[1], 'gastosVariables', 0, 5000);
    app.sumarGasto();
    assert.deepEqual([app.D.meses[c[1]].gastosVariables[0].monto, app.D.meses[c[1]].gastosVariables[0].pagado], [5000, true], 'month ' + c[1] + (c[0].arrastre ? ' model' : ' legacy'));
  });
});

// ── I-2: duplicar reports success only when the new year was saved ──
test('I-2 duplicar when the new year cannot be stored: nothing half-done, previous year/state kept, the user is told', function(){
  var abiertos = [];
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.seccion2(false, false), HOY))}, function(k){ return k === 'kibo.datos.2027'; });
  var app = H.appAlmacen(ls, '2026-10-15', {recordarAnio: function(a){ abiertos.push(a); }});
  H.cargarEn(app, ls, 2026); app.mes = 7;
  var antes = JSON.stringify(app.D);
  app.duplicar();
  assert.equal(ls.d['kibo.datos.2027'], undefined);
  assert.deepEqual([app.D.anio, app.mes, JSON.stringify(app.D) === antes], [2026, 7, true], 'the open year, month and data are the previous ones');
  assert.deepEqual(abiertos, [], 'the open-year marker never points to a year that was not saved');
  assert.equal(app.obsoleta, false);
  assert.equal(app.hayLS, true);
  assert.deepEqual(app.g.alertas.map(function(a){ return a[0]; }), ['No pude crear el año']);
  assert.ok(!/Listo/.test(JSON.stringify(app.g.alertas)));
  // and when it works it still says Listo and opens the new year
  var ls2 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.seccion2(false, false), HOY))});
  var ok = H.appAlmacen(ls2, '2026-10-15', {recordarAnio: function(a){ abiertos.push(a); }});
  H.cargarEn(ok, ls2, 2026); ok.duplicar();
  assert.ok(ls2.d['kibo.datos.2027']);
  assert.deepEqual([ok.D.anio, abiertos], [2027, [2027]]);
  assert.equal(ok.g.alertas[0][0], 'Listo el 2027');
});

// ── I-3: an unreadable year blob is quarantined, never overwritten, and travels in the backup ──
var ROTO = '{"anio":2026,"meses":[{"ingresos":[{"nombre":"Sueldo","monto":900000';   // truncated JSON

test('I-3 saving over an unreadable stored year: the raw text is copied to quarantine, the year key is not written, a visible warning', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': ROTO});
  var app = H.appAlmacen(ls);
  app.D = M.normalizar({anio: 2026}, HOY); app.sucio = true;
  assert.equal(app.guardar(), false);
  assert.equal(ls.d['kibo.datos.2026'], ROTO, 'the stored text is untouched');
  assert.equal(ls.d['kibo.cuarentena.2026'], ROTO, 'a copy is kept in quarantine');
  assert.ok(app.g.avisos.innerHTML.indexOf('No pude leer los datos de 2026. Los aparté tal cual para que no se pierdan, y ese año no se modifica.') >= 0, app.g.avisos.innerHTML);
  assert.equal(app.hayLS, true, 'storage itself works');
  // a second attempt still does not write, and the quarantine copy is never replaced
  ls.d['kibo.datos.2026'] = ROTO + 'x';
  app.sucio = true; assert.equal(app.guardar(), false);
  assert.deepEqual([ls.d['kibo.datos.2026'], ls.d['kibo.cuarentena.2026']], [ROTO + 'x', ROTO]);
});

test('I-3 a stored year that parses to something that is not a year object counts as unreadable too', function(){
  ['null', '5', '[1,2]', '"texto"'].forEach(function(raw){
    var ls = H.fakeStorage({'kibo.datos.2026': raw});
    var app = H.appAlmacen(ls);
    assert.equal(app.leerAnio(2026), null, raw);
    app.D = M.normalizar({anio: 2026}, HOY); app.sucio = true;
    assert.equal(app.guardar(), false, raw);
    assert.equal(ls.d['kibo.datos.2026'], raw, raw);
    assert.equal(ls.d['kibo.cuarentena.2026'], raw, raw);
  });
});

test('I-3 the quarantine key survives the pre-R4 rollback and is never deleted by the app', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': ROTO});
  var app = H.appAlmacen(ls);
  app.D = M.normalizar({anio: 2026}, HOY); app.sucio = true; app.guardar();
  assert.equal(app.claveMia('kibo.cuarentena.2026'), false, 'device key: no rollback or restore path that deletes own keys can remove it');
});

test('I-3 armarCopia carries the quarantined raw text and never exports unsaved memory as that year', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': ROTO, 'kibo.datos.2025': JSON.stringify(M.normalizar(C.vacio(2025), HOY))});
  var app = H.appAlmacen(ls);
  app.D = M.normalizar({anio: 2026}, HOY); app.D.meses[0].ahorroMesARS = 1;   // memory over an unreadable year (never saved)
  var cp = app.plain(app.armarCopia());
  assert.deepEqual(Object.keys(cp.anios), ['2025']);
  assert.deepEqual(cp.cuarentena, {'2026': ROTO});
  assert.equal(ls.d['kibo.cuarentena.2026'], ROTO, 'detected while building the backup: quarantined now');
});

test('I-3 restoring a backup is the explicit way out: the year is written, the quarantine copy stays; a backup brings its quarantine along', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': ROTO});
  var app = H.appAlmacen(ls); app.D = M.normalizar({anio: 2026}, HOY);
  app.restaurarTexto(JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: C.vacio(2026)}, cuarentena: {'2024': 'viejo roto', '0999': 'x', '2026': 'otro'}}));
  app.pendiente();
  assert.equal(JSON.parse(ls.d['kibo.datos.2026']).anio, 2026, 'the year is readable again');
  assert.equal(ls.d['kibo.cuarentena.2026'], ROTO, 'the local raw copy was kept (quarantined before overwrite, never replaced)');
  assert.equal(ls.d['kibo.cuarentena.2024'], 'viejo roto', 'the backup quarantine is restored when absent here');
  assert.equal(ls.d['kibo.cuarentena.0999'], undefined, 'only real year keys');
  app.D = M.normalizar(JSON.parse(ls.d['kibo.datos.2026']), HOY); app.sucio = true;
  assert.equal(app.guardar(), true, 'writes work again once the year is readable');
});

test('I-3 duplicar sees an unreadable next year as existing and does not overwrite it', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.seccion2(false, false), HOY)), 'kibo.datos.2027': ROTO});
  var app = H.appAlmacen(ls);
  H.cargarEn(app, ls, 2026); app.duplicar();
  assert.equal(ls.d['kibo.datos.2027'], ROTO);
  assert.equal(app.D.anio, 2026);
  assert.deepEqual(app.g.alertas.map(function(a){ return a[0]; }), ['Ese año ya existe']);
});

test('I-3 an unreadable Trabajo blob is copied to quarantine before it is replaced', function(){
  var ls = H.fakeStorage({'kibo.trabajo': '{"facturas":[{"id":"f1"'});
  var app = H.appAlmacen(ls); app.T = app.leerTrab();
  assert.equal(app.guardarTrab(true), true);
  assert.equal(ls.d['kibo.cuarentena.trabajo'], '{"facturas":[{"id":"f1"');
  assert.equal(JSON.parse(ls.d['kibo.trabajo']).version, 1);
  // when the copy cannot be stored, nothing is replaced
  var ls2 = H.fakeStorage({'kibo.trabajo': '{roto'}, function(k){ return k === 'kibo.cuarentena.trabajo'; });
  var b = H.appAlmacen(ls2); b.T = b.leerTrab();
  assert.equal(b.guardarTrab(true), false);
  assert.equal(ls2.d['kibo.trabajo'], '{roto');
});

// ── I-4: a stale tab exports what is stored, not its stale memory ──
test('I-4 armarCopia in a stale tab exports the stored year and Trabajo', function(){
  var y = M.normalizar(C.copy(C.seccion2(false, false)), HOY); delete y.rev;
  var tr = H.trab([{fecha: '2026-09-10', monto: 1000}]); tr.rev = 3; tr.tope = 77;
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(Object.assign({}, y, {rev: 5, cotizacionUSD: 2000})), 'kibo.trabajo': JSON.stringify(tr)});
  var s = H.appAlmacen(ls);
  s.D = M.normalizar(Object.assign(C.copy(y), {rev: 4, cotizacionUSD: 1000}), HOY); s.sucio = true;   // missed the storage event: rev 4 < stored 5
  s.T = s.normTrab(Object.assign(C.copy(tr), {rev: 2, tope: 11}));
  var cp = s.plain(s.armarCopia());
  assert.equal(cp.anios[2026].cotizacionUSD, 2000, 'the stored year, not the stale memory');
  assert.equal(cp.trabajo.tope, 77, 'the stored Trabajo, not the stale memory');
  // obsoleta set explicitly (storage event seen with edits pending)
  var o = H.appAlmacen(ls);
  o.D = M.normalizar(Object.assign(C.copy(y), {rev: 5, cotizacionUSD: 1000}), HOY); o.T = o.normTrab(Object.assign(C.copy(tr), {tope: 11})); o.obsoleta = true;
  var cp2 = o.plain(o.armarCopia());
  assert.deepEqual([cp2.anios[2026].cotizacionUSD, cp2.trabajo.tope], [2000, 77]);
  // a tab that is up to date still exports its memory (saved first)
  var a = H.appAlmacen(ls); H.cargarEn(a, ls, 2026); a.T = a.leerTrab(); a.D.cotizacionUSD = 3000; a.sucio = true;
  assert.equal(a.plain(a.armarCopia()).anios[2026].cotizacionUSD, 3000);
});

// ── I-5: a restored year always gets a revision ──
test('I-5 escribirAnios sets rev = max(stored, own) + 1 even when the key did not exist', function(){
  var ls = H.fakeStorage({'kibo.datos.2025': JSON.stringify({anio: 2025, rev: 7, meses: []})});
  var app = H.appAlmacen(ls);
  var anios = {2025: C.vacio(2025), 2026: C.vacio(2026), 2027: Object.assign(C.vacio(2027), {rev: 4})};
  app.escribirAnios(anios, ['2025', '2026', '2027']);
  assert.deepEqual([2025, 2026, 2027].map(function(a){ return JSON.parse(ls.d['kibo.datos.' + a]).rev; }), [8, 1, 5]);
});

// ── I-6: the afterprint listener of imprimir does not pile up ──
test('I-6 imprimir registers its afterprint listener once and removes it', function(){
  var oyentes = [], tareas = [];
  var g = {tab: 'anio', oculto: false, aplicarOculto: function(){}, render: function(){},
    document: {querySelector: function(){ return null; }},
    window: {addEventListener: function(t, f, o){ oyentes.push([t, f, o]); }, removeEventListener: function(t, f){ oyentes = oyentes.filter(function(x){ return !(x[0] === t && x[1] === f); }); }, print: function(){}},
    setTimeout: function(f){ tareas.push(f); return tareas.length; }};
  var app = la.loadApp({funcs: ['imprimir'], globals: g});
  for(var i = 0; i < 3; i++){ app.imprimir(); while(tareas.length) tareas.shift()(); }
  var vivos = oyentes.filter(function(x){ return x[0] === 'afterprint' && !(x[2] && x[2].once); });
  assert.equal(vivos.length, 0, 'no permanent afterprint listener is left behind (got ' + oyentes.length + ')');
});
