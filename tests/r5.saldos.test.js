'use strict';
// R5 part 1 (night run N3a): balance UX of the month view. Rules come from the approved contract only:
// D2 (opening editable from the month view, real closing correction, difference informational, no movement created),
// D5 / Q1 (first use asks the available money now; skip = 'omitido', shown as not configured), D6 (confirmed closing kept,
// difference shown, reconfirmation asked), D7 / Q8 (projection labeled as an estimate, overdue of earlier months apart),
// D10 (dismissible start-of-month notice), D17 (plain-language labels). Nothing here introduces a money rule.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function varDeLaApp(n){ return new Function(la.extractVar(n) + ' return ' + n + ';')(); }   // eslint-disable-line no-new-func

var R5_FUNCS = ['vistaModelo', 'tilesMes', 'mesDelModelo', 'pasesDelMes', 'lineasSaldo', 'textoOrigen', 'muestraPrimerUso', 'claveAvisoCierre',
  'avisoCierreDescartado', 'descartarAvisoCierre', 'avisoCierrePendiente', 'guardarModelo', 'fijarApertura', 'modoApertura', 'fijarCierreReal',
  'mantenerCierreReal', 'hayCierreParaMantener', 'fijarCierreRealValor', 'filaSaldo', 'htmlSaldo', 'htmlAvisosSaldo', 'fARS', 'grupos', 'esc', 'editarApertura'];
function app(ls, today, extra, funcs){
  var g = Object.assign({MESES: varDeLaApp('MESES'), oculto: false, PUNTOS: '••••'}, extra || {});
  return H.appAlmacen(ls, today || '2026-10-15', g, R5_FUNCS.concat(funcs || []));
}
function con(raw, today){ return H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(raw, C.hoy(today || '2026-10-15')))}); }
function vm(a){ return a.vistaModelo(a.D, a.hoy); }
function lineas(a, j){ return plain(a.lineasSaldo(a.D, j, vm(a))); }
function sinSep(){ var d = C.seccion2(false, false); delete d.meses[8].cierreReal; return d; }
// the lines of the month must add up to its total: opening + income - expenses - installments - savings + other savings moves
function suma(l){ return Math.round((l.apertura + l.ingresos - l.gastos - l.cuotas - l.ahorro + l.otros) * 100) / 100; }
function total(l){ return l.estado === 'pasado' ? l.cierreCalc : (l.estado === 'actual' ? l.disponibleActual : l.proyectado); }

test('first-use prompt (D5, Q1): only for the year that contains hoy and has no arrastre', function(){
  var a = app(H.fakeStorage({}));
  var sinModelo = H.sinModelo(C.seccion2(false, false));
  assert.equal(a.muestraPrimerUso(M.normalizar(C.copy(sinModelo), a.hoy), a.hoy), true, 'existing data, no arrastre');
  assert.equal(a.muestraPrimerUso(M.normalizar(C.vacio(2026), a.hoy), a.hoy), true, 'new device, empty year');
  assert.equal(a.muestraPrimerUso(M.normalizar(C.seccion2(false, false), a.hoy), a.hoy), false, 'arrastre exists: never again');
  assert.equal(a.muestraPrimerUso(M.normalizar(C.vacio(2025), a.hoy), a.hoy), false, 'a past year');
  assert.equal(a.muestraPrimerUso(M.normalizar(C.vacio(2027), a.hoy), a.hoy), false, 'a future year');
  var om = C.copy(sinModelo); om.arrastre = {desde: 9, inicial: {apertura: null, declarado: null, origen: 'omitido'}};
  assert.equal(a.muestraPrimerUso(M.normalizar(om, a.hoy), a.hoy), false, 'skipped (omitido) counts as answered');
});

test('month lines (D2, D17, §2): opening with its origin, flows, closing / available / projection; each month adds up', function(){
  var ls = con(C.seccion2(false, false)), a = app(ls); H.cargarEn(a, ls, 2026);
  var sep = lineas(a, 8), oct = lineas(a, 9), nov = lineas(a, 10);
  assert.deepEqual([sep.estado, sep.desde, sep.origen, sep.apertura, sep.ingresos, sep.gastos, sep.cuotas, sep.ahorro, sep.otros],
    ['pasado', true, 'declarado', 50000, 1000000, 600000, 100000, 150000, 0]);
  assert.deepEqual([sep.cierreCalc, sep.cierreReal, sep.diferencia, sep.cierre, sep.reconfirmar], [200000, 175000, -25000, 175000, false]);
  assert.deepEqual([oct.estado, oct.origen, oct.apertura, oct.ingresos, oct.gastos, oct.cuotas, oct.otros, oct.disponibleActual, oct.proyectado, oct.vencidos],
    ['actual', 'cadena', 175000, 1000000, 400000, 0, 50000, 825000, 580000, 20000]);
  assert.deepEqual([nov.estado, nov.origen, nov.apertura, nov.ingresos, nov.cuotas, nov.ahorro, nov.proyectado], ['futuro', 'cadena', 580000, 1000000, 100000, 200000, 1280000]);
  assert.equal(a.lineasSaldo(a.D, 7, vm(a)), null, 'a month before desde is legacy: no lines');
  var n = 0;
  [C.seccion2(false, false), C.seccion2(true, true), sinSep()].forEach(function(raw){
    var l2 = con(raw), b = app(l2); H.cargarEn(b, l2, 2026);
    for(var j = 8; j < 12; j++){ var l = lineas(b, j); assert.equal(suma(l), total(l), 'month ' + j + ' adds up'); n++; }
  });
  assert.equal(n, 12, 'non-vacuous');
});

test('origin texts (D17): previous month, declared, skipped, previous December', function(){
  var a = app(H.fakeStorage({}));
  assert.deepEqual([a.textoOrigen('cadena', 2026, false), a.textoOrigen('declarado', 2026, false), a.textoOrigen('omitido', 2026, true),
    a.textoOrigen('anioAnterior', 2027, false), a.textoOrigen('arrastre', 2027, false), a.textoOrigen('declarado', 2026, true)],
  ['Viene del mes anterior', 'Lo cargaste vos', 'Saldo inicial sin configurar', 'Viene de diciembre 2026', 'Viene de diciembre 2026', 'Saldo inicial sin configurar']);
});

test('month view HTML: labels per month state, overdue apart (Q8), confirm / reconfirm (D2, D6); legacy month shows nothing', function(){
  var ls = con(C.seccion2(false, false)), a = app(ls); H.cargarEn(a, ls, 2026);
  var v = vm(a), oct = a.htmlSaldo(a.D, 9, v), sep = a.htmlSaldo(a.D, 8, v), nov = a.htmlSaldo(a.D, 10, v);
  ['Disponible inicial', 'Viene del mes anterior', 'Editar', 'Ingresos', 'Gastos', 'Ahorro', 'Disponible actual', 'Proyectado al cierre (estimado)',
    'Pendientes de meses anteriores', '$825.000', '$580.000', '$20.000'].forEach(function(t){ assert.ok(oct.indexOf(t) >= 0, 'Oct shows ' + t); });
  ['Disponible al cierre', 'Lo cargaste vos', 'Según tus registros', 'Saldo real', 'Diferencia', '($25.000)'].forEach(function(t){ assert.ok(sep.indexOf(t) >= 0, 'Sep shows ' + t); });
  assert.equal(sep.indexOf('Cambió desde que lo confirmaste'), -1);
  ['Proyectado al cierre (estimado)', 'programado', '$1.280.000'].forEach(function(t){ assert.ok(nov.indexOf(t) >= 0, 'Nov shows ' + t); });
  assert.equal(nov.indexOf('Editar'), -1, 'a future month opening is the projection: nothing to edit there');
  assert.equal(oct.indexOf('Disponible al cierre'), -1);
  assert.equal(a.htmlSaldo(a.D, 7, v), '', 'legacy month: unchanged view');
  var sinConf = con(sinSep()), b = app(sinConf); H.cargarEn(b, sinConf, 2026);
  assert.ok(b.htmlSaldo(b.D, 8, vm(b)).indexOf('¿Es correcto?') >= 0, 'an unconfirmed past month asks');
  a.D.meses[8].gastosFijos[1].pagado = true;   // Sep Luz ticked after the confirmation (D16-06): the confirmed value is kept, the difference shows
  var cambio = a.htmlSaldo(a.D, 8, vm(a));
  ['Cambió desde que lo confirmaste', 'Confirmar de nuevo', 'Mantener', '$175.000', '$180.000', '($5.000)'].forEach(function(t){ assert.ok(cambio.indexOf(t) >= 0, 'reconfirm shows ' + t); });
  var leg = H.sinModelo(C.seccion2(false, false)), l3 = con(leg), c = app(l3); H.cargarEn(c, l3, 2026);
  assert.equal(c.vistaModelo(c.D, c.hoy), null);
  assert.equal(c.htmlSaldo(c.D, 9, null), '', 'a year without arrastre shows none of it');
});

test('a user-typed name never reaches the month view HTML unescaped (only numbers and fixed labels are rendered)', function(){
  var raw = C.seccion2(false, false); raw.meses[9].ingresos[0].nombre = '<img src=x onerror=alert(1)>';
  var ls = con(raw), a = app(ls); H.cargarEn(a, ls, 2026);
  assert.equal(a.htmlSaldo(a.D, 9, vm(a)).indexOf('<img'), -1);
});

test('D16-05 via Editar (D2, Q1): in the migration month the declared value is re-derived; the opening moves, no movement is created', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(H.sinModelo(C.seccion2(false, false)))}), a = app(ls); H.cargarEn(a, ls, 2026);
  assert.equal(a.activarSaldos(825000), true);
  var meses0 = JSON.stringify(H.guardado(ls, 2026).meses);
  assert.equal(a.modoApertura(a.D, a.hoy), 'actual');
  assert.equal(a.fijarApertura(850000, 'actual'), true);
  var g = H.guardado(ls, 2026);
  assert.deepEqual(g.arrastre, {desde: 9, inicial: {apertura: 200000, declarado: 850000, declaradoEl: '2026-10-15', origen: 'declarado'}});
  assert.equal(JSON.stringify(g.meses), meses0, 'no movement is created (D2, D14)');
  var c = M.cadena(M.normalizar(g, a.hoy), a.hoy, {});
  assert.deepEqual([c.meses[9].apertura, c.resumen.disponibleActual, c.meses[10].proyectado], [200000, 850000, 1305000]);
  assert.equal(a.fijarApertura(NaN, 'actual'), false, 'not a number: nothing written');
});

test('D16-17 via Editar (D5): skip first, declare later from the month view', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(H.sinModelo(C.seccion2(false, false)))}), a = app(ls); H.cargarEn(a, ls, 2026);
  assert.equal(a.activarSaldos(null), true);
  assert.deepEqual(plain(H.guardado(ls, 2026).arrastre.inicial), {apertura: null, declarado: null, declaradoEl: '2026-10-15', origen: 'omitido'});
  assert.ok(a.htmlSaldo(a.D, 9, vm(a)).indexOf('Saldo inicial sin configurar') >= 0, 'shown explicitly as not configured');
  assert.equal(a.activarSaldos(500000), false, 'the first-use path stays idempotent');
  assert.equal(a.fijarApertura(500000, 'actual'), true, 'Editar declares it');
  var g = H.guardado(ls, 2026);
  assert.deepEqual([g.arrastre.desde, g.arrastre.inicial.origen, g.arrastre.inicial.declarado, g.arrastre.inicial.apertura], [9, 'declarado', 500000, -150000]);
  assert.equal(M.cadena(M.normalizar(g, a.hoy), a.hoy, {}).resumen.disponibleActual, 500000);
});

test('Editar of a past migration month (D2): the opening itself is typed; declared keeps the iniciarArrastre identity', function(){
  var ls = con(C.seccion2(false, false)), a = app(ls); H.cargarEn(a, ls, 2026);
  assert.equal(a.modoApertura(a.D, a.hoy), 'apertura');
  assert.equal(a.fijarApertura(80000, 'actual'), false, 'the available-now question only exists while the migration month is the current one');
  assert.equal(a.fijarApertura(80000, 'apertura'), true);
  var g = H.guardado(ls, 2026), c = M.cadena(M.normalizar(g, a.hoy), a.hoy, {});
  assert.deepEqual(plain(g.arrastre.inicial), {apertura: 80000, declarado: 230000, declaradoEl: '2026-10-15', origen: 'declarado'});
  assert.deepEqual([c.meses[8].cierreCalc, c.meses[8].cierre, c.meses[8].reconfirmar, c.meses[9].apertura], [230000, 175000, true, 175000], 'confirmed September holds (D6)');
  // an opening carried from the previous December is not typed here: Editar goes to that December's closing
  var d27 = M.normalizar(C.vacio(2027), C.hoy('2027-02-10')); d27.arrastre = {desde: 0, inicial: {apertura: 1000, origen: 'arrastre', calculadoOrigen: 1000}};
  var l27 = H.fakeStorage({'kibo.datos.2027': JSON.stringify(d27)}), b = app(l27, '2027-02-10'); H.cargarEn(b, l27, 2027);
  assert.equal(b.modoApertura(b.D, b.hoy), 'diciembre');
  assert.equal(b.fijarApertura(5000, 'apertura'), false);
});

test('real closing correction (D2): confirm writes {valor, calculadoAlConfirmar, confirmadoEl}; the next opening follows; remove goes back', function(){
  var ls = con(sinSep()), a = app(ls); H.cargarEn(a, ls, 2026);
  assert.equal(a.fijarCierreReal(8, 175000), true);
  var g = H.guardado(ls, 2026);
  assert.deepEqual(g.meses[8].cierreReal, {valor: 175000, calculadoAlConfirmar: 200000, confirmadoEl: '2026-10-15'});
  assert.deepEqual([lineas(a, 8).diferencia, lineas(a, 9).apertura, lineas(a, 9).disponibleActual], [-25000, 175000, 825000]);
  var meses = JSON.stringify(g.meses.map(function(m){ var c = plain(m); delete c.cierreReal; return c; }));
  assert.equal(a.fijarCierreReal(8, null), true, 'remove the confirmation');
  g = H.guardado(ls, 2026);
  assert.equal(g.meses[8].cierreReal, undefined);
  assert.equal(JSON.stringify(g.meses), meses, 'no movement was ever created');
  assert.deepEqual([lineas(a, 9).apertura, lineas(a, 9).disponibleActual], [200000, 850000]);
  assert.equal(a.fijarCierreReal(9, 1), false, 'the current month has no closing yet');
  assert.equal(a.fijarCierreReal(10, 1), false, 'nor a future month');
  assert.equal(a.fijarCierreReal(7, 1), false, 'nor a legacy month');
});

test('a past month edited after its confirmation (D6): the confirmed value is kept, Mantener acknowledges, re-confirm takes the new value', function(){
  var ls = con(C.seccion2(false, false)), a = app(ls); H.cargarEn(a, ls, 2026);
  a.D.meses[8].gastosFijos[1].pagado = true;   // Luz ticked: calculated 180.000
  var l = lineas(a, 8);
  assert.deepEqual([l.cierreCalc, l.cierre, l.diferencia, l.reconfirmar, lineas(a, 9).apertura], [180000, 175000, -5000, true, 175000]);
  assert.equal(a.mantenerCierreReal(8), true);
  var g = H.guardado(ls, 2026);
  assert.deepEqual([g.meses[8].cierreReal.valor, g.meses[8].cierreReal.calculadoAlConfirmar, lineas(a, 8).reconfirmar], [175000, 180000, false]);
  assert.equal(a.fijarCierreReal(8, 180000), true);
  assert.deepEqual([lineas(a, 8).diferencia, lineas(a, 9).apertura], [0, 180000]);
  // without a confirmation the chain recalculates and nothing extra is shown (owner brief)
  var l2 = con(sinSep()), b = app(l2); H.cargarEn(b, l2, 2026);
  b.D.meses[8].gastosFijos[1].pagado = true;
  assert.deepEqual([lineas(b, 8).cierre, lineas(b, 9).apertura], [180000, 180000]);
  assert.equal(b.htmlSaldo(b.D, 8, vm(b)).indexOf('Cambió desde que lo confirmaste'), -1);
  assert.equal(b.mantenerCierreReal(8), false, 'nothing to keep');
});

test('start-of-month notice (D10): previous model month unconfirmed; "Ahora no" hides it for that month on this device', function(){
  var ls = con(sinSep()), a = app(ls); H.cargarEn(a, ls, 2026);
  assert.deepEqual(plain(a.avisoCierrePendiente(a.D, a.hoy, vm(a))), {mes: 8, valor: 200000});
  a.descartarAvisoCierre(8);
  assert.equal(ls.d['kibo.avisoCierre'], '2026-09');
  assert.equal(a.avisoCierrePendiente(a.D, a.hoy, vm(a)), null);
  assert.equal(H.guardado(ls, 2026).rev, undefined, 'dismissing writes nothing in the year');
  var l2 = con(C.seccion2(false, false)), b = app(l2); H.cargarEn(b, l2, 2026);
  assert.equal(b.avisoCierrePendiente(b.D, b.hoy, vm(b)), null, 'already confirmed');
  var l3 = con(sinSep()), c = app(l3, '2026-09-20'); H.cargarEn(c, l3, 2026);
  assert.equal(c.avisoCierrePendiente(c.D, c.hoy, vm(c)), null, 'the migration month has no previous model month');
  var l4 = con(sinSep()), d = app(l4, '2027-01-10'); H.cargarEn(d, l4, 2026);
  assert.equal(d.avisoCierrePendiente(d.D, d.hoy, vm(d)), null, 'only for the open year that contains hoy');
  var l5 = con(sinSep()), e = app(l5); H.cargarEn(e, l5, 2026);
  assert.equal(e.fijarCierreReal(8, 200000), true, 'Confirmar writes the calculated value as the real one');
  assert.equal(e.avisoCierrePendiente(e.D, e.hoy, vm(e)), null);
  var html = a.htmlAvisosSaldo(M.normalizar(sinSep(), a.hoy), 9, null, a.hoy);
  assert.equal(html, '', 'no view model: nothing');
});

test('the notices HTML: first-use prompt and the start-of-month question with its three answers', function(){
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(H.sinModelo(C.seccion2(false, false)))}), a = app(ls); H.cargarEn(a, ls, 2026);
  var p = a.htmlAvisosSaldo(a.D, 9, null, a.hoy);
  ['¿Cuánto dinero tenés disponible actualmente?', 'Guardar', 'Omitir', 'id="inPrimerUso"'].forEach(function(t){ assert.ok(p.indexOf(t) >= 0, t); });
  var l2 = con(sinSep()), b = app(l2); H.cargarEn(b, l2, 2026);
  var q = b.htmlAvisosSaldo(b.D, 9, vm(b), b.hoy);
  ['¿Cerraste <b>Septiembre</b> con <b>$200.000</b>?', 'Confirmar', 'Corregir', 'Ahora no'].forEach(function(t){ assert.ok(q.indexOf(t) >= 0, t); });
  assert.equal(b.htmlAvisosSaldo(b.D, 8, vm(b), b.hoy), '', 'only on the current month');
});

test('a stale tab cannot declare, correct or confirm (Q12): nothing written, the notice is shown', function(){
  var ls = con(sinSep()), a = app(ls), b = app(ls); H.cargarEn(a, ls, 2026); H.cargarEn(b, ls, 2026);
  a.D.meses[9].ingresos.push(C.it('Extra', 1, true)); a.sucio = true; a.guardar();
  var antes = JSON.stringify(ls.d);
  assert.deepEqual([b.sucio, b.obsoleta], [false, false], 'tab B is clean and missed the event');
  assert.equal(b.fijarCierreReal(8, 1), false);
  assert.equal(JSON.stringify(ls.d), antes);
  assert.equal(b.obsoleta, true);
  assert.equal(b.D.meses[8].cierreReal, undefined, 'memory as before');
  assert.ok(b.g.avisos.innerHTML.indexOf('Hay cambios hechos en otra pestaña') >= 0);
  assert.equal(b.fijarApertura(1, 'apertura'), false);
  assert.equal(b.mantenerCierreReal(8), false);
  assert.equal(JSON.stringify(ls.d), antes);
  // the first-use declaration from a clean tab that missed another tab's save
  var l2 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(H.sinModelo(C.seccion2(false, false)))}), c = app(l2), d = app(l2);
  H.cargarEn(c, l2, 2026); H.cargarEn(d, l2, 2026);
  c.D.meses[0].ahorroMesARS = 1; c.sucio = true; c.guardar();
  var antes2 = JSON.stringify(l2.d);
  assert.equal(d.activarSaldos(825000), false);
  assert.equal(JSON.stringify(l2.d), antes2, 'no snapshot, no marker, no arrastre');
  assert.equal(d.D.arrastre, undefined);
});

test('guarded save path: snapshot before the first model write on this device; a refused write leaves memory as before', function(){
  var ls = con(sinSep()), a = app(ls); H.cargarEn(a, ls, 2026);   // a year that already has arrastre (e.g. restored) on a device without the marker
  assert.equal(ls.d['kibo.modeloSaldos'], undefined);
  assert.equal(a.fijarCierreReal(8, 190000), true);
  assert.ok(ls.d['kibo.modeloSaldos'] && ls.d['kibo.respaldo.pre-r4'], 'marker and snapshot first');
  assert.equal(JSON.parse(JSON.parse(ls.d['kibo.respaldo.pre-r4']).datos['kibo.datos.2026']).meses[8].cierreReal, undefined, 'the snapshot holds the data before the write');
  var falla = {si: false}, l2 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(sinSep(), C.hoy('2026-10-15')))}, function(k){ return falla.si && k === 'kibo.datos.2026'; });
  var b = app(l2); H.cargarEn(b, l2, 2026);
  falla.si = true;
  var y = l2.d['kibo.datos.2026'];
  assert.equal(b.fijarCierreReal(8, 1), false);
  assert.deepEqual([l2.d['kibo.datos.2026'] === y, b.D.meses[8].cierreReal], [true, undefined]);
  var ar = JSON.stringify(b.D.arrastre);
  assert.equal(b.fijarApertura(1, 'apertura'), false);
  assert.equal(JSON.stringify(b.D.arrastre), ar);
  // the snapshot cannot be stored: nothing is written
  var l3 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(sinSep(), C.hoy('2026-10-15')))}, function(k){ return k === 'kibo.respaldo.pre-r4'; });
  var c = app(l3); H.cargarEn(c, l3, 2026);
  assert.equal(c.fijarCierreReal(8, 1), false);
  assert.equal(H.guardado(l3, 2026).meses[8].cierreReal, undefined);
});

// ── fixes from the N3a review ──
// a 2027 year created ahead (duplicar) whose January opening is carried from December 2026; 2026 is stored with the model
function eneroArrastrado(today, rechaza){
  var h = C.hoy(today), d26 = M.normalizar(C.seccion2(false, false), h), d27 = M.normalizar(C.vacio(2027), h);
  d27.arrastre = {desde: 0, inicial: {apertura: 1000, origen: 'arrastre', calculadoOrigen: 1000}};
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(d26), 'kibo.datos.2027': JSON.stringify(d27)}, rechaza);
  var hechos = {anios: [], cierres: []};
  var a = app(ls, today, {cambiarAnio: function(x){ hechos.anios.push(x); }, renderMes: function(){}, abrirCierre: function(j){ hechos.cierres.push(j); }});
  H.cargarEn(a, ls, 2027); a.hechos = hechos;
  return a;
}
function tieneEditar(a){ return a.htmlSaldo(a.D, 0, vm(a)).indexOf('data-act="editarApertura"') >= 0; }
test('Editar of a January carried from December: offered only once that December is closed (N3a review)', function(){
  ['2026-10-15', '2026-12-15'].forEach(function(t){
    var a = eneroArrastrado(t);
    assert.equal(a.modoApertura(a.D, a.hoy), 'diciembre', t + ': carried opening');
    assert.equal(tieneEditar(a), false, t + ': December 2026 is not closed yet: no Editar');
    assert.match(a.htmlSaldo(a.D, 0, vm(a)), /Viene de diciembre 2026/, t + ': the origin is still said');
    a.editarApertura(0);
    assert.deepEqual(a.hechos.anios, [], t + ': no year switch');
  });
  var b = eneroArrastrado('2027-02-10');
  assert.equal(tieneEditar(b), true, 'December 2026 closed: Editar offered');
  b.editarApertura(0);
  assert.deepEqual([b.hechos.anios, b.hechos.cierres], [[2026], [11]], 'goes to the December closing');
});
test('Editar of a carried January never drops unsaved edits: refused in a stale tab and when the save fails (N3a review)', function(){
  var a = eneroArrastrado('2027-02-10');
  a.obsoleta = true; a.editarApertura(0);
  assert.deepEqual(a.hechos.anios, [], 'stale tab: no year switch');
  assert.match(a.g.avisos.innerHTML, /otra pestaña/, 'stale tab: the notice is shown');
  var b = eneroArrastrado('2027-02-10', function(k){ return k === 'kibo.datos.2027'; });
  b.D.meses[0].ingresos.push({nombre: 'Sueldo', monto: 5, pagado: false}); b.sucio = true;
  b.editarApertura(0);
  assert.deepEqual(b.hechos.anios, [], 'failed save: no year switch');
  assert.equal(b.D.meses[0].ingresos.length, 1, 'the unsaved edit is still in memory');
  var c = eneroArrastrado('2027-02-10');
  c.D.meses[0].ingresos.push({nombre: 'Sueldo', monto: 5, pagado: false}); c.sucio = true;
  c.editarApertura(0);
  assert.deepEqual(c.hechos.anios, [2026], 'guard: a successful save switches');
  assert.equal(JSON.parse(c.localStorage.d['kibo.datos.2027']).meses[0].ingresos.length, 1, 'the edit was written before switching');
});

// a sheet input built from the HTML the app passed to abrirHoja: its markup value / data-exacto, and the live value the user leaves as is
function hojaConInput(){
  var st = {hojas: [], inputs: {}, avisos: {innerHTML: '', textContent: ''}};
  function attr(html, id, n){ var m = new RegExp('id="' + id + '"[^>]*?' + n + '="([^"]*)"').exec(html); return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null; }
  st.abrirHoja = function(h){
    st.hojas.push(h);
    ['inCierre', 'inApertura'].forEach(function(id){
      if(h.indexOf('id="' + id + '"') < 0) return;
      var a = {value: attr(h, id, 'value'), 'data-exacto': attr(h, id, 'data-exacto')};
      st.inputs[id] = {value: a.value, getAttribute: function(n){ return a.hasOwnProperty(n) ? a[n] : null; },
        addEventListener: function(){}, focus: function(){}, classList: {add: function(){}, remove: function(){}}};
    });
  };
  st.document = {activeElement: null, getElementById: function(id){ return id === 'avisos' ? st.avisos : (st.inputs[id] || null); }};
  return st;
}
function appHoja(raw, today){
  var st = hojaConInput(), ls = con(raw, today);
  var a = app(ls, today, {abrirHoja: st.abrirHoja, document: st.document, avisos: st.avisos, cerrarHoja: function(){}, conScroll: function(){}, renderMes: function(){},
    MESES: varDeLaApp('MESES')}, ['abrirCierre', 'guardarCierreHoja', 'guardarAperturaHoja', 'leerMontoDe', 'notaEn', 'montoEditable', 'attrExacto', 'montoInput', 'marcarErr']);
  H.cargarEn(a, ls, 2026); a.st = st; a.ls = ls;
  return a;
}
test('montoEditable prefills cents in the Argentine format and reads back through parseMonto (N3a review)', function(){
  var a = appHoja(sinSep());
  [[0, '0'], [1234, '1.234'], [300000.5, '300.000,50'], [-25000.05, '-25.000,05'], [0.07, '0,07'], [1234567.99, '1.234.567,99']].forEach(function(c){
    assert.equal(a.montoEditable(c[0]), c[1], String(c[0]));
    assert.equal(M.parseMonto(c[1], true), c[0], c[1] + ' reads back');
  });
});
test('balance sheets with cents: confirming the unchanged closing stores the exact calculated value (difference 0) (N3a review)', function(){
  var raw = sinSep(); raw.meses[8].gastosVariables.push(C.it('Kiosco', 0.5, true));   // September closes at 199.999,50
  var a = appHoja(raw);
  a.abrirCierre(8);
  assert.equal(a.st.inputs.inCierre.value, '199.999,50', 'prefilled with its cents');
  a.guardarCierreHoja(8);
  var cr = H.guardado(a.ls, 2026).meses[8].cierreReal;
  assert.deepEqual([cr.valor, cr.calculadoAlConfirmar], [199999.5, 199999.5]);
  var c = M.cadena(M.normalizar(H.guardado(a.ls, 2026), a.hoy), a.hoy, {});
  assert.deepEqual([c.meses[8].diferencia, c.meses[8].reconfirmar, c.meses[9].apertura], [0, false, 199999.5], 'no spurious difference shifts October');
});
test('balance sheets: an unchanged input keeps the exact source value, even beyond two decimals; a typed one is read (N3a review)', function(){
  var raw = sinSep(); raw.arrastre.inicial.apertura = 50000.125;
  var a = appHoja(raw);
  assert.equal(a.modoApertura(a.D, a.hoy), 'apertura');
  a.editarApertura(8);
  assert.equal(a.st.inputs.inApertura.value, '50.000,13');
  a.guardarAperturaHoja('apertura');
  assert.equal(H.guardado(a.ls, 2026).arrastre.inicial.apertura, 50000.125, 'Editar unchanged: opening unchanged');
  a.editarApertura(8); a.st.inputs.inApertura.value = '60.000,25';
  a.guardarAperturaHoja('apertura');
  assert.equal(H.guardado(a.ls, 2026).arrastre.inicial.apertura, 60000.25, 'a typed amount is read as typed');
});

// ── native review follow-up (night range T4): "Mantener" refuses a month that is not past, and reports a refusal apart from a write failure ──
function appMantener(ls, today){
  var a = app(ls, today, {conScroll: function(f){ f(); }, renderMes: function(){ a.g.renders++; }}, ['mantenerCierreHoja']);
  H.cargarEn(a, ls, 2026);
  return a;
}
test('Mantener only keeps the closing of a past month: a confirmed month that is current again is refused and nothing is written', function(){
  var ls = con(C.seccion2(false, false), '2026-09-20'), a = appMantener(ls, '2026-09-20');
  assert.equal(vm(a).cad.meses[8].estado, 'actual', 'September is the current month on this clock');
  assert.equal(vm(a).cad.meses[8].cierreReal, 175000, 'and still carries the stored confirmation');
  var antes = JSON.stringify(ls.d);
  assert.equal(a.mantenerCierreReal(8), false);
  assert.equal(JSON.stringify(ls.d), antes, 'nothing written');
  a.mantenerCierreHoja(8);
  assert.equal(JSON.stringify(ls.d), antes, 'the button writes nothing either');
  assert.deepEqual(a.g.pildoras, [['Ese mes ya no tiene un cierre confirmado para mantener', false]], 'a refusal, not "No se pudo guardar"');
  assert.equal(a.g.renders, 1, 'the month is repainted so the stale button goes away');
});
test('the Mantener button: success, nothing to keep, and a write failure that shows "No se pudo guardar" exactly once', function(){
  var ls = con(C.seccion2(false, false)), a = appMantener(ls);
  a.D.meses[8].gastosFijos[1].pagado = true;   // calculated 180.000 against the confirmed 175.000
  a.mantenerCierreHoja(8);
  assert.deepEqual(a.g.pildoras[a.g.pildoras.length - 1], ['Se mantiene el cierre confirmado', false]);
  assert.deepEqual(a.g.pildoras.filter(function(p){ return p[1]; }), [], 'no error pill');
  assert.equal(H.guardado(ls, 2026).meses[8].cierreReal.calculadoAlConfirmar, 180000);
  var l2 = con(sinSep()), b = appMantener(l2), antes = JSON.stringify(l2.d);
  b.mantenerCierreHoja(8);
  assert.deepEqual(b.g.pildoras, [['Ese mes ya no tiene un cierre confirmado para mantener', false]], 'no confirmation: a refusal');
  assert.equal(JSON.stringify(l2.d), antes);
  var falla = {si: false}, l3 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(M.normalizar(C.seccion2(false, false), C.hoy('2026-10-15')))}, function(k){ return falla.si && k === 'kibo.datos.2026'; });
  var c = appMantener(l3), y;
  c.D.meses[8].gastosFijos[1].pagado = true;
  falla.si = true; y = l3.d['kibo.datos.2026'];
  c.mantenerCierreHoja(8);
  assert.equal(l3.d['kibo.datos.2026'], y, 'the year is not written');
  assert.deepEqual(c.g.pildoras.filter(function(p){ return p[0] === 'No se pudo guardar'; }), [['No se pudo guardar', true]], 'the failure is reported once');
  assert.equal(c.g.pildoras.length, 1, 'and nothing else is claimed');
  assert.equal(c.D.meses[8].cierreReal.calculadoAlConfirmar, 200000, 'memory as before');
});
