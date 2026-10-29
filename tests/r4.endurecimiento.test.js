'use strict';
// R4.6 hardening (night run N2): backup completeness and round trip, restore and new-year edge cases, stale tabs, sheet number fields.
// Money rules come from odd/tasks/repair-sprint-1-r4-design.md (Q1-Q15) and D16; nothing here introduces a new rule.
var test = require('node:test');
var assert = require('node:assert/strict');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var la = require('./load-app');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
// normTrab's helpers: without them leerTrab swallows the ReferenceError and returns an EMPTY store (see tests/fixtures/r45-harness.js)
var TRAB_FUNCS = ['catValida', 'colorValido', 'nomCarpeta', 'stockValido', 'tjId'];
function varDeLaApp(n){ return new Function(la.extractVar(n) + ' return ' + n + ';')(); }   // eslint-disable-line no-new-func
var TRAB_VARS = {CATS: varDeLaApp('CATS'), COLCARP: varDeLaApp('COLCARP')};
function almacen(ls, today, extra){ return H.appAlmacen(ls, today || '2026-10-15', Object.assign({}, TRAB_VARS, extra), TRAB_FUNCS); }
function sinRev(o){ var c = plain(o); delete c.rev; delete c.actualizado; return c; }

// Every own storage key, classified. A key added to CLAVES_PROPIAS without a decision here fails the first test.
var DATOS = ['kibo.trabajo'];   // plus every kibo.datos.YYYY: the user's money, must travel in the backup
var DEL_TELEFONO = {   // device state: by design NOT in the backup (restoring on another phone must not carry it)
  'kibo.anio': 'which year is open', 'kibo.ultimaCopia': 'date of the last backup made on this phone', 'kibo.oculto': 'amounts hidden with dots',
  'kibo.bienvenida': 'welcome already seen', 'kibo.historial': 'list of backup files in this phone\'s folder', 'kibo.vistaProd': 'compact / full product list',
  'kibo.modeloSaldos': 'migration marker: re-derived on restore when a restored year has arrastre (D16-09)',
  'kibo.avisoCierre': 'R5 (D10): month whose start-of-month closing notice was dismissed with "Ahora no" (a per-device convenience)',
  'kibo.datosDesde': 'L4: first day this phone had data (backup reminder when there was never a backup)',
  'kibo.copiaPospuesta': 'L4: backup reminder snoozed with "Más tarde" until this date'
};

function trabajo(){
  var t = H.trab([{fecha: '2026-09-10', monto: 150000}, {fecha: '2026-11-05', monto: 200000}]);
  t.activo = true; t.tope = 9000000;
  t.gastos = [{id: 'g1', fecha: '2026-09-02', monto: 12000, desc: 'Monotributo', forma: 'transferencia', creada: ''}];
  return t;
}
function dispositivo(){
  var y26 = C.seccion2(false, false); y26.cripto = [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}];
  y26.meses[8].ingresos.push(C.it('Del trabajo', 150000, true));
  var y25 = C.vacio(2025); C.mes(y25, 11, {ingresos: [C.it('Sueldo', 900000, true)], gastosFijos: [C.it('Alquiler', 300000, true)], ahorroMesARS: 100000});
  var init = {'kibo.datos.2025': JSON.stringify(Object.assign(y25, {rev: 4})), 'kibo.datos.2026': JSON.stringify(Object.assign(M.normalizar(y26, C.hoy('2026-10-15')), {rev: 9})),
    'kibo.trabajo': JSON.stringify(Object.assign(trabajo(), {rev: 3}))};
  Object.keys(DEL_TELEFONO).forEach(function(k){ init[k] = 'x'; });
  return H.fakeStorage(init);
}

test('backup completeness: every own key is classified; the backup carries every year and Trabajo and nothing of the device', function(){
  var ls = dispositivo(), app = almacen(ls, null, {tieneTrab: function(){ return true; }});
  var propias = plain(app.CLAVES_PROPIAS).sort();
  assert.deepEqual(propias, DATOS.concat(Object.keys(DEL_TELEFONO)).sort(), 'a new own key needs a decision: data (in the backup) or device');
  H.cargarEn(app, ls, 2026); app.T = app.leerTrab();
  var copia = plain(app.armarCopia());
  assert.deepEqual(Object.keys(copia).sort(), ['anios', 'app', 'creada', 'trabajo', 'version']);
  assert.deepEqual(Object.keys(copia.anios).sort(), ['2025', '2026'], 'every stored year, not only the open one');
  assert.equal(JSON.stringify(copia).indexOf('kibo.'), -1, 'no device key travels');
  assert.deepEqual([copia.trabajo.pases.length, copia.trabajo.gastos.length, copia.trabajo.tope], [2, 1, 9000000]);
});

test('backup -> restore round trip on an empty phone: same years, same Trabajo, same chain, card and net worth', function(){
  var ls = dispositivo(), a = almacen(ls, null, {tieneTrab: function(){ return true; }});
  H.cargarEn(a, ls, 2026); a.T = a.leerTrab();
  var texto = JSON.stringify(a.armarCopia());
  var ls2 = H.fakeStorage(), b = almacen(ls2, null, {descTrabajo: function(){ return ''; }});
  b.D = b.normalizar({anio: 2026}, b.hoy);
  b.restaurarTexto(texto); b.pendiente();
  [2025, 2026].forEach(function(y){
    assert.deepEqual(sinRev(b.normalizar(H.guardado(ls2, y), b.hoy)), sinRev(a.normalizar(H.guardado(ls, y), a.hoy)), 'year ' + y);
  });
  assert.deepEqual(sinRev(b.normTrab(JSON.parse(ls2.d['kibo.trabajo']))), sinRev(a.normTrab(JSON.parse(ls.d['kibo.trabajo']))), 'Trabajo');
  assert.ok(ls2.d['kibo.modeloSaldos'], 'a restored model year marks the phone as migrated');
  var va = H.appVista(H.guardado(ls, 2026), JSON.parse(ls.d['kibo.trabajo'])), vb = H.appVista(H.guardado(ls2, 2026), JSON.parse(ls2.d['kibo.trabajo']));
  assert.deepEqual(plain(vb.vistaModelo(vb.D, vb.hoy).cad), plain(va.vistaModelo(va.D, va.hoy).cad), 'chain');
  for(var j = 0; j < 12; j++) assert.deepEqual(H.tiles(vb, j), H.tiles(va, j), 'card month ' + j);
  assert.deepEqual(plain(vb.patrimonioPantalla(vb.D, vb.hoy)), plain(va.patrimonioPantalla(va.D, va.hoy)), 'net worth');
  assert.equal(va.patrimonioPantalla(va.D, va.hoy).patrimonioARS > 0, true, 'guard: a non-trivial net worth was compared');
});

test('restore over a phone with newer revisions: the restored years and Trabajo win, and a stale tab of before cannot overwrite them', function(){
  var ls = dispositivo(), viejo = H.appAlmacen(ls, '2026-10-15');
  H.cargarEn(viejo, ls, 2026); viejo.T = viejo.leerTrab();   // tab opened before the restore (rev 9 / Trabajo rev 3)
  var copia = {app: 'kibFinanzas', version: 1, anios: {2026: Object.assign(C.vacio(2026), {rev: 1})}, trabajo: Object.assign(H.trab([]), {rev: 1})};
  var r = H.appAlmacen(ls, '2026-10-15', {descTrabajo: function(){ return ''; }});
  r.D = H.cargarEn(r, ls, 2026); r.T = r.leerTrab();
  r.restaurarTexto(JSON.stringify(copia)); r.pendiente();
  var y = H.guardado(ls, 2026), t = JSON.parse(ls.d['kibo.trabajo']);
  assert.deepEqual([y.rev, t.rev, t.pases.length], [10, 4, 0], 'written above every revision a tab may hold');
  viejo.D.meses[9].ahorroMesARS = 1; viejo.sucio = true; viejo.guardar();
  viejo.T.tope = 1; viejo.guardarTrab(true);
  assert.deepEqual([H.guardado(ls, 2026).rev, JSON.parse(ls.d['kibo.trabajo']).rev, viejo.obsoleta], [10, 4, true], 'the stale tab is refused');
});

test('restore never writes a backup that cannot be read, and an empty backup leaves the phone as it is', function(){
  var ls = dispositivo(), antes = JSON.stringify(ls.d), app = H.appAlmacen(ls, '2026-10-15', {descTrabajo: function(){ return ''; }});
  H.cargarEn(app, ls, 2026);
  ['{no es json', JSON.stringify({app: 'kibFinanzas', anios: {}}), JSON.stringify({app: 'kibFinanzas', anios: {abcd: {}}}), JSON.stringify(null), '[]'].forEach(function(t){
    app.pendiente = null; app.restaurarTexto(t);
    assert.equal(app.pendiente, null, 'no pending replace for ' + t);
  });
  assert.equal(JSON.stringify(ls.d) === antes, true, 'the phone is untouched');
  assert.deepEqual(app.g.alertas.map(function(a){ return a[0]; }), ['Ese archivo no se pudo leer', 'Copia vacía', 'Copia vacía', 'Ese archivo no se pudo leer', 'Ese archivo no se pudo leer']);
});

// New year (duplicar): the December closing chain (§8, D6). D16-10 covers the calculated closing; this is the CONFIRMED one.
function conDiciembreConfirmado(){
  var d = C.seccion2(false, false);
  d.meses[11].cierreReal = {valor: 700000, calculadoAlConfirmar: 825000, confirmadoEl: '2026-12-31'};
  return d;
}
test('duplicar with a confirmed December closing: the new year opens from the confirmed value and keeps the calculated one to show the drift', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(conDiciembreConfirmado(), C.hoy('2026-10-15')))}), app = H.appAlmacen(ls);
  H.cargarEn(app, ls, 2026); app.duplicar();
  var n = H.guardado(ls, 2027);
  assert.deepEqual([n.arrastre.desde, n.arrastre.inicial.apertura, n.arrastre.inicial.origen, n.arrastre.inicial.calculadoOrigen], [0, 700000, 'arrastre', 825000]);
  assert.equal(n.meses.filter(function(m){ return m.cierreReal; }).length, 0, 'the confirmation belongs to the old year');
  // when 2027 arrives the live December closing of 2026 is read: the confirmed value holds even if December changes later (D6)
  var v = H.appVista(n, null, {'kibo.datos.2026': ls.d['kibo.datos.2026']}, '2027-01-15');
  assert.equal(v.vistaModelo(v.D, v.hoy).cad.meses[0].apertura, 700000);
  var cambiado = JSON.parse(ls.d['kibo.datos.2026']); cambiado.meses[11].gastosVariables = [C.it('Regalos', 90000, true)];
  var v2 = H.appVista(n, null, {'kibo.datos.2026': JSON.stringify(cambiado)}, '2027-01-15');
  assert.equal(v2.vistaModelo(v2.D, v2.hoy).cad.meses[0].apertura, 700000, 'confirmed closing holds');
  delete cambiado.meses[11].cierreReal;
  var v3 = H.appVista(n, null, {'kibo.datos.2026': JSON.stringify(cambiado)}, '2027-01-15');
  assert.equal(v3.vistaModelo(v3.D, v3.hoy).cad.meses[0].apertura, 625000 - 90000, 'unconfirmed: the chain follows the edit of December (625.000 a hoy 2027-01-15, D16-10)');
});

test('duplicar in a STALE tab writes nothing (no snapshot, no new year, no open-year change) and never says "Listo"', function(){
  var abiertos = [];
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.seccion2(false, false), C.hoy('2026-10-15')))});
  var app = H.appAlmacen(ls, '2026-10-15', {recordarAnio: function(a){ abiertos.push(a); }});
  H.cargarEn(app, ls, 2026);
  app.obsoleta = true;   // another tab saved; this one shows the notice and must not write until reload (R4.3, Q12)
  var antes = JSON.stringify(ls.d);
  app.duplicar();
  assert.deepEqual([JSON.stringify(ls.d) === antes, Object.keys(ls.d)], [true, ['kibo.datos.2026']], 'nothing stored: no kibo.datos.2027, no pre-R4 snapshot');
  assert.deepEqual([app.D.anio, abiertos.length, app.g.alertas.length], [2026, 0, 0]);
  assert.ok(app.g.avisos.innerHTML.indexOf('Hay cambios hechos en otra pestaña') >= 0, 'the stale notice is shown');
});

test('duplicar when the pending save of this tab is refused (another tab saved the year): no new year is created', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.seccion2(false, false), C.hoy('2026-10-15')))});
  var a = H.appAlmacen(ls), b = H.appAlmacen(ls);
  H.cargarEn(a, ls, 2026); H.cargarEn(b, ls, 2026);
  a.D.meses[11].ingresos = [C.it('Aguinaldo', 500000, false)]; a.sucio = true; a.guardar();
  b.D.meses[0].ahorroMesARS = 1; b.sucio = true;   // unsaved edit in tab B; it missed the storage event
  b.duplicar();
  assert.equal(ls.d['kibo.datos.2027'], undefined, 'built from a December that is not the stored one: refused');
  assert.deepEqual([b.D.anio, b.obsoleta, b.g.alertas.length], [2026, true, 0]);
});

test('duplicar in a CLEAN tab that missed the storage event: the stored revision is checked first, nothing is written, the year stays open', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.seccion2(false, false), C.hoy('2026-10-15')))});
  var abiertos = [], a = H.appAlmacen(ls), b = H.appAlmacen(ls, '2026-10-15', {recordarAnio: function(y){ abiertos.push(y); }});
  H.cargarEn(a, ls, 2026); H.cargarEn(b, ls, 2026);
  a.D.meses[8].gastosVariables.push(C.it('Farmacia', 30000, true)); a.D.meses[11].ahorroMesARS = 50000; a.sucio = true; a.guardar();
  var antes = JSON.stringify(ls.d);
  assert.deepEqual([b.sucio, b.obsoleta], [false, false], 'tab B has no pending edit and was not marked stale');
  b.duplicar();
  assert.equal(JSON.stringify(ls.d), antes, 'nothing stored: no kibo.datos.2027 built from a stale December, no snapshot, no marker');
  assert.deepEqual([b.D.anio, b.obsoleta, abiertos.length, b.g.alertas.length], [2026, true, 0, 0]);
  assert.ok(b.g.avisos.innerHTML.indexOf('Hay cambios hechos en otra pestaña') >= 0, 'the stale notice is shown');
});

// Sheet money / quantity fields (Trabajo, pases): D9 per field type, negatives read only to explain the error
test('leerMonto / cantidadDe: Argentine money with decimals, negatives and garbage get a visible reason, never a silent value', function(){
  var vals = {};
  var app = la.loadApp({funcs: ['leerMonto', 'cantidadDe', 'val', 'esc'], globals: {document: {getElementById: function(id){
    return vals[id] === undefined ? null : {value: vals[id], getAttribute: function(){ return null; }};
  }}}});
  function m(t){ vals.x = t; return plain(app.leerMonto('x')); }
  function q(t){ vals.x = t; return plain(app.cantidadDe('x')); }
  assert.deepEqual(m('1.234,56'), {ok: true, v: 1234.56});
  assert.deepEqual(m('$ 1.500'), {ok: true, v: 1500});
  assert.deepEqual(m('-1.500,5'), {ok: false, v: -1500.5, msg: 'no puede ser negativo'});
  assert.deepEqual([m('1,234.5').ok, m('1,234.5').msg], [false, 'no entendí «1,234.5» como número']);
  assert.deepEqual(m('<b>1</b>').msg, 'no entendí «&lt;b&gt;1&lt;/b&gt;» como número', 'the echoed text is escaped (it goes into innerHTML)');
  assert.deepEqual(m(''), {ok: false, vacio: true, v: 0, msg: ''});
  assert.deepEqual(q('0,001'), {ok: true, v: 0.001});
  assert.deepEqual(q('-2'), {ok: false, v: 1, msg: 'La cantidad tiene que ser mayor que cero.'});
  assert.deepEqual(q('0'), {ok: false, v: 1, msg: 'La cantidad tiene que ser mayor que cero.'});
  assert.equal(q('1,234.5').ok, false);
});
