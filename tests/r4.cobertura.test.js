'use strict';
// R4.5 complementary coverage (NOT part of the D16 acceptance criterion): the owner's "MATRIZ ALFA" scenarios C-01..C-21
// (odd/tasks/repair-sprint-1.md, "Complementary R4.5 coverage"). Scenarios already pinned by an existing test are cited in
// odd/tasks/repair-sprint-1-r4.5-matrix.md instead of being duplicated here; this file holds the ones that had no direct test, the
// R4.4 leftovers (L-xx) and the before -> migration -> after report invariants (R-xx).
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var AD = require('./fixtures/r45-antes-despues');

var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');
var SRC = la.SRC_FOR_TESTS;
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function modelo(raw, ctx){ var d = M.normalizar(C.copy(raw), HOY); return {d: d, cad: plain(M.cadena(d, HOY, ctx || {})), pat: plain(M.patrimonioNeto(d, HOY, ctx || {}))}; }

// ── C: scenarios without a direct test before R4.5 ──
test('C-01 mes vacío: an empty model month carries the opening unchanged; an empty legacy month is all zeros; an empty year has no data', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 120000, 'declarado');
  var r = modelo(d);
  assert.deepEqual([r.cad.meses[8].cierre, r.cad.meses[9].apertura, r.cad.meses[9].cierreCalc, r.cad.meses[10].proyectado, r.cad.resumen.disponibleActual],
    [120000, 120000, 120000, 120000, 120000]);
  var app = H.appVista(d);
  assert.deepEqual([H.tiles(app, 9).totalIngresos, H.tiles(app, 9).totalGastos, H.tiles(app, 9).disponibleFinal], [0, 0, 120000]);
  var leg = M.normalizar(C.vacio(2026), HOY);
  assert.deepEqual([M.calc(leg.meses[9]).disponibleFinal, M.calc(leg.meses[9]).pendienteIngresos], [0, 0]);
  assert.equal(M.hayDatos(leg, false), false);
});

test('C-02 mes parcialmente cargado: rows without amount, ticked without amount and pending rows; only ticked amounts are realized', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 1000000, true), C.it('Extra', 0, true)], gastosFijos: [C.it('Alquiler', 0, true), C.it('Luz', 30000, false)],
    gastosVariables: [{nombre: 'Super', monto: ''}], deudas: [C.it('Cuota', 0, true)]});
  var r = modelo(d), o = r.cad.meses[9];
  assert.deepEqual([o.resultado, o.pendienteGastos, o.cierreCalc, o.proyectado], [1000000, 30000, 1000000, 970000]);
  assert.equal(H.tiles(H.appVista(d), 9).disponibleFinal, 1000000);
});

test('C-14 USD: buying funds from savings ARS, selling enters Disponible, an external USD inflow only touches USD; valued at the stored cotizacion', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); d.ahorroAnioAnterior = 1000000; d.usdAnioAnterior = 100;
  C.mes(d, 9, {compraARS: 300000, compraUSD: 200, ventaUSD: 50, ventaARS: 75000, ahorroMesUSD: 10});
  var r = modelo(d), f = plain(M.flujosMes(r.d, 9, HOY, {}));
  assert.deepEqual([f.dDisp, f.dAhorroARS, f.dUSD], [75000, -300000, 160]);
  assert.deepEqual([r.pat.disponible, r.pat.ahorroARS, r.pat.usd, r.pat.usdARS], [75000, 700000, 260, 390000]);
  assert.equal(M.serie(r.d)[9].aReponer, 75000, 'a USD sale counts as money taken out of savings to put back (serie semantics, kept by the model)');
});

test('C-15 cripto: quantity x USD price x cotizacion enters the gross worth a hoy; the old year-end view counts it the same way', function(){
  var d = C.seccion2(false, false); d.cripto = [{activo: 'BTC', cantidad: 0.5, precioUSD: 60000}, {activo: 'ETH', cantidad: 2, precioUSD: 2500}];
  var r = modelo(d);
  assert.deepEqual([r.pat.criptoUSD, r.pat.criptoARS, r.pat.bruto, r.pat.neto], [35000, 52500000, 2925000 + 52500000, 2625000 + 52500000]);
  assert.equal(M.patrimonio(r.d).criptoUSD, 35000);
});

test('C-19 recarga: what one save writes, a fresh load reads back to the same chain, card and net worth', function(){
  var ls = H.fakeStorage(), a = H.appAlmacen(ls);
  a.D = M.normalizar(C.copy(C.seccion2(false, false)), HOY); a.sucio = true; a.guardar();
  assert.equal(H.guardado(ls, 2026).rev, 1);
  var b = H.appAlmacen(ls), d2 = H.cargarEn(b, ls, 2026);
  assert.deepEqual(plain(M.cadena(d2, HOY, {})), plain(M.cadena(a.D, HOY, {})));
  var v = H.appVista(H.guardado(ls, 2026));
  assert.deepEqual([H.tiles(v, 9).disponibleFinal, v.patrimonioPantalla(v.D, v.hoy).patrimonioARS], [825000, 2625000]);
});

test('C-20 cierre/reapertura: confirming a closing and removing the confirmation gives back exactly the calculated chain; no movement is ever created', function(){
  var abierto = H.sinModelo(C.seccion2(false, false)); C.arrastre(abierto, 8, 50000, 'declarado');
  var a = modelo(abierto);
  var cerrado = C.copy(abierto); cerrado.meses[8].cierreReal = {valor: 175000, calculadoAlConfirmar: 200000, confirmadoEl: '2026-10-01'};
  var b = modelo(cerrado);
  assert.deepEqual([b.cad.meses[9].apertura, b.cad.resumen.disponibleActual, b.cad.meses[8].diferencia], [175000, 825000, -25000]);
  var reabierto = C.copy(cerrado); delete reabierto.meses[8].cierreReal;
  var c = modelo(reabierto);
  assert.deepEqual(c.cad, a.cad);
  assert.deepEqual(c.pat, a.pat);
  assert.equal(JSON.stringify(b.d.meses.map(function(m){ var o = plain(m); delete o.cierreReal; return o; })), JSON.stringify(a.d.meses), 'only the confirmation field differs');
});

// ── R: before -> migration -> after report (tests/fixtures/r45-antes-despues.js, design section 8/9, D4, D14, I6) ──
test('R-01 before -> migration -> after: the migration only adds arrastre; legacy months, serie and the old outputs are untouched; Oct shows the declared value', function(){
  var inf = AD.informe();
  assert.equal(inf.length, 12, 'guard: 6 datasets x (declared, skipped); an empty report would pass vacuously');
  assert.equal(inf.filter(function(r){ return r.arrastre.inicial.origen === 'declarado'; }).length, 6, 'guard: the declared branch runs');
  inf.forEach(function(r){
    var tag = r.n + ' / ' + r.arrastre.inicial.origen;
    assert.equal(JSON.stringify(r.mesesDespues), JSON.stringify(r.mesesAntes), tag + ': months');
    assert.equal(JSON.stringify(r.serieDespues), JSON.stringify(r.serieAntes), tag + ': serie');
    assert.equal(r.despues.sep, r.antes.sep, tag + ': September (before desde) reads as before (I6)');
    if(r.arrastre.inicial.origen === 'declarado') assert.ok(Math.abs(r.despues.oct - AD.DECLARADO) < 0.005, tag + ': Oct = declared');
    assert.equal(r.despues.disponibleActual, r.despues.oct, tag);
  });
});
test('R-02 years without arrastre (older and later year) show no model at all after the migration of another year', function(){
  var l = AD.aniosSinArrastre();
  assert.equal(l.length, 3, 'guard: the loop is not vacuous');
  l.forEach(function(a){ assert.equal(a.modelo, null, a.n); });
});

// ── L: R4.4 leftovers, pinned and classified (odd/tasks/repair-sprint-1-r4.5-matrix.md section C) ──
function trabajoSinPases(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Sueldo', 500000, true), C.it('Del trabajo', 80000, false)], gastosFijos: [C.it('Alquiler', 100000, true)], ahorroMesARS: 50000});
  C.mes(d, 10, {ahorroMesARS: 200000});
  return d;
}
test('L-01 "El año" table, year CSV and "Año por año" read the month card (chain) in a model year (owner decision 2026-10-06, matrix section E)', function(){
  var V = require('./fixtures/anio-vistas');
  var app = V.appAnio(trabajoSinPases(), {2025: C.vacio(2025)}), s = M.serie(app.D);
  var card = H.tiles(app, 9), f = app.fARS;
  assert.deepEqual([card.totalIngresos, card.disponibleFinal], [500000, 350000], 'month card: Q3 applied (unticked "Del trabajo" pending), chain');
  var t = V.tabla(app.anio(), 'anTabla');
  assert.deepEqual([t[9][1], t[9][8]], [f(500000), f(350000)], '"El año" Oct row = card (was 580.000 / 430.000 from serie())');
  assert.deepEqual([s[9].totalIngresos, s[9].disponibleFinal], [580000, 430000], 'serie() itself is unchanged (other consumers, golden)');
  assert.equal(t[12][9], f(250000), '"Acumulado" stays serie(): year end incl. the scheduled November savings (matrix E.3, unchanged)');
  var pv = H.appVista(trabajoSinPases());
  assert.equal(pv.patrimonioPantalla(pv.D, pv.hoy).ahorroARS, 50000, 'Patrimonio: savings a hoy (unchanged)');
  var oct = V.csvFilas(app.csv())[10];
  assert.deepEqual([oct[0], oct[1], oct[14]], ['Octubre', '500000', '350000'], 'CSV columns Ingresos / Disponible final = card');
  assert.deepEqual(V.tabla(app.anio(), 'anAnios')[1].slice(0, 3), ['2026', f(500000), f(100000)], '"Año por año" = card rows');
});

test('L-02 "Del trabajo" amount above its pases: the excess is pending with its own checkbox (R5 N3b); the row stays read-only', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); C.mes(d, 9, {ingresos: [C.it('Del trabajo', 400000, false)]});
  var app = H.appVista(d, H.trab([{fecha: '2026-10-10', monto: 300000}])), vm = app.vistaModelo(app.D, app.hoy);
  var f = plain(M.flujosMes(app.D, 9, app.hoy, vm.ctx));
  assert.deepEqual([f.trabajoRealizado, f.ingresosReal, f.ingresosPend, vm.cad.resumen.disponibleActual, vm.cad.resumen.proyectadoAlCierre], [300000, 0, 100000, 300000, 400000]);
  assert.equal(app.tieneTilde(app.D, 9, 'ingresos', app.D.meses[9].ingresos[0]), true, 'R5 N3b: the excess has a checkbox (was locked forever)');
  app.D.meses[9].ingresos[0].pagado = true;
  var g = plain(M.flujosMes(app.D, 9, app.hoy, vm.ctx));
  assert.deepEqual([g.trabajoRealizado, g.ingresosReal, g.ingresosPend, app.vistaModelo(app.D, app.hoy).cad.resumen.disponibleActual], [300000, 100000, 0, 400000], 'ticked: the excess is realized');
  assert.match(la.extractFunction('seccion'), /var vt = S\.k === 'ingresos' && esRenglonTrabajo\(lista\[i\]\.nombre\) && pasesDelMes\(D\.anio, mes\) > 0/);
});

function paseSobre(nombre){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); C.mes(d, 9, {ingresos: [C.it(nombre, 100000, false)]});
  var app = H.appVista(d, H.trab([]), null, null, {funcs: ['renglonTrabajo', 'revGuardada', 'blobAlDia', 'aplicarPase'], vars: ['LSTRAB'], globals: {escribirJuntos: function(){ return 'ok'; }, sucio: false, hayLS: true, tGuardar: null, obsoleta: false, avisoOtraPestana: function(){},
    marcarVencidos: function(){}, estado: function(){}, quitarAvisoVacia: function(){}}});
  var p = {id: 'x', fecha: '2026-10-10', monto: 300000, anio: 2026, mes: 9};
  assert.equal(app.aplicarPase(p, 1, function(){ app.T.pases.push(p); return function(){}; }), true);
  var vm = app.vistaModelo(app.D, app.hoy);
  return {filas: app.D.meses[9].ingresos.length, disponible: vm.cad.resumen.disponibleActual, pend: vm.cad.meses[9].pendienteIngresos};
}
test('L-03 pase onto "Del trabajo" written exactly: the pase lands in the same row (pinned reference for L-03b)', function(){
  assert.deepEqual(paseSobre('Del trabajo'), {filas: 1, disponible: 300000, pend: 100000});
});
// N1 item 5 (R4.5 close, design §7 + D13): the app's row lookup uses the engine's clave() matcher; an exact (trim / lowercase) match still wins
test('L-03b accent / spacing variant of "Del trabajo" must behave like the exact name (D13 one matcher)', function(){
  assert.deepEqual(paseSobre('Del Trabájo'), {filas: 1, disponible: 300000, pend: 100000});
});

var NADA = function(){ return function(){}; };   // L8: the Trabajo change of a pase (not under test here)
function appRenglon(ingresos){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); C.mes(d, 9, {ingresos: ingresos});
  return H.appVista(d, H.trab([]), null, null, {funcs: ['renglonTrabajo', 'revGuardada', 'blobAlDia', 'aplicarPase'], vars: ['LSTRAB'], globals: {escribirJuntos: function(){ return 'ok'; }, sucio: false, hayLS: true, tGuardar: null, obsoleta: false, avisoOtraPestana: function(){},
    marcarVencidos: function(){}, estado: function(){}, quitarAvisoVacia: function(){}}});
}
test('L-03c the row lookup is the engine matcher: an exact "Del trabajo" row wins over an earlier variant; a variant alone receives and gives back the pase (undo path)', function(){
  var a = appRenglon([C.it('  del  TRABAJO ', 5000, false), C.it('Del trabajo', 100000, false)]), p = {id: 'x', fecha: '2026-10-10', monto: 300000, anio: 2026, mes: 9};
  assert.equal(a.aplicarPase(p, 1, NADA), true);
  assert.deepEqual(a.D.meses[9].ingresos.map(function(x){ return x.monto; }), [5000, 400000], 'exact row first, as before the change');
  var b = appRenglon([C.it('Del Trabájo', 100000, false)]);
  assert.equal(b.aplicarPase(p, 1, NADA), true);
  assert.equal(b.aplicarPase(p, -1, NADA), true, 'quitarPase / reponerPase go through aplicarPase: the variant row is found to give the pase back');
  assert.deepEqual(b.plain(b.D.meses[9].ingresos).map(function(x){ return [x.nombre, x.monto, x.pagado]; }), [['Del Trabájo', 100000, false]], 'no second row, no rename, amount back');
  assert.match(la.extractFunction('renglonTrabajo'), /esRenglonTrabajo\(/, 'same clave() matcher as the engine');
  assert.match(la.extractFunction('quitarPase'), /aplicarPase\(p, -1, /);
  assert.match(la.extractFunction('reponerPase'), /aplicarPase\(p, 1, /);
  assert.doesNotMatch(la.extractFunction('deshacerTj'), /ingresos|renglonTrabajo/, 'deshacerTj restores the Trabajo store only, it never looks up the row');
});

// RISK MARKER (N2, OWNER_DECISION_REQUIRED, matrix F): L-03b is resolved for NEW data only. Data saved under the old matcher can hold a
// variant row (unticked) BEFORE the exact ticked "Del trabajo" row that received the pase; the engine allocates the pase to the rows in
// order, so the variant absorbs it and the user's unticked amount reads as realized. Fixing it needs a rule (engine allocation order ->
// golden diff report, or a data merge). This test is `todo` on purpose: when it starts passing, the risk was fixed.
test('L-03d legacy two-row data: a variant unticked row before the exact ticked "Del trabajo" row must stay pending', {todo: 'OWNER_DECISION_REQUIRED N2-B: engine allocates pases to "Del trabajo" rows in order; legacy two-row data is not rewritten'}, function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Dél trabajo', 100000, false), C.it('Del trabajo', 300000, true)]});
  var app = H.appVista(d, H.trab([{fecha: '2026-10-05', monto: 300000}])), vm = app.vistaModelo(app.D, app.hoy);
  var f = plain(M.flujosMes(app.D, 9, app.hoy, vm.ctx));
  assert.deepEqual([f.ingresosReal, f.trabajoRealizado, f.ingresosPend], [0, 300000, 100000], 'observed today: [100000, 300000, 0] (the 100.000 the user did not tick counts as realized)');
});

test('L-04 explicaDisp with a scheduled pase: only the pases already out are explained, and the text adds up to the big number', function(){
  var app = H.appVista(null, null, null, null, {funcs: ['explicaDisp', 'pasesPersonal', 'fARS', 'grupos'], globals: {oculto: false, PUNTOS: '..'}});
  var r = {cobrado: 1000000, gastado: 100000, pasado: 500000, pasadoProgramado: 200000};
  r.disponible = r.cobrado - r.gastado - r.pasado + r.pasadoProgramado;
  assert.equal(app.explicaDisp(r), 'Lo cobrado ($1.000.000) menos los gastos ($100.000) y lo que ya pasaste a lo personal ($300.000).');
  assert.equal(1000000 - 100000 - 300000, r.disponible);
  assert.equal(app.explicaDisp({cobrado: 500000, gastado: 0, pasado: 200000, pasadoProgramado: 200000}), 'Todo lo cobrado sigue en el trabajo: todavía no pasaste nada a lo personal.');
  assert.equal(app.explicaDisp({cobrado: 500000, gastado: 0, pasado: 200000}), 'Lo cobrado ($500.000) menos lo que ya pasaste a lo personal ($200.000).', 'legacy (no scheduled field)');
});

// R4.3 review advisories
test('L-05 duplicar through the REAL save path: the new year is written with its own rev and arrastre after the snapshot; the old year is untouched', function(){
  var viejo = JSON.stringify(M.normalizar(C.copy(C.seccion2(false, false)), HOY));
  var ls = H.fakeStorage({'kibo.datos.2026': viejo}), app = H.appAlmacen(ls);
  H.cargarEn(app, ls, 2026);
  app.duplicar();
  var n = H.guardado(ls, 2027);
  assert.deepEqual([n.rev, n.arrastre.desde, n.arrastre.inicial.apertura, n.arrastre.inicial.origen], [1, 0, 825000, 'arrastre']);
  assert.equal(ls.d['kibo.datos.2026'], viejo);
  assert.ok(ls.d['kibo.modeloSaldos']);
  assert.ok(ls.log.indexOf('kibo.respaldo.pre-r4') < ls.log.indexOf('kibo.datos.2027'), 'snapshot before the new year');
  assert.equal(app.D.anio, 2027);
  var ls2 = H.fakeStorage({'kibo.datos.2026': viejo}, function(k){ return k === 'kibo.respaldo.pre-r4'; }), b = H.appAlmacen(ls2);
  H.cargarEn(b, ls2, 2026);
  b.duplicar();
  assert.equal(ls2.d['kibo.datos.2027'], undefined, 'snapshot refused: no new year');
  assert.equal(b.D.anio, 2026);
  assert.equal(b.g.alertas[0][0], 'No pude crear el año');
});

var PASE_FUNCS = ['renglonTrabajo', 'blobAlDia', 'aplicarPase', 'quitarPase', 'reponerPase', 'guardarPase', 'resumenTrab', 'hoyISO', 'esISO', 'utcDe', 'sumarDias', 'diasEntre', 'ganancia',
  'saldoFac', 'venceFac', 'sinAsignar', 'paseAlModelo', 'mesDelModelo', 'pasesDelMes'];
function appPase(ls, hechos){
  return H.appAlmacen(ls, '2026-10-15', {
    leerMonto: function(){ return {ok: true, v: hechos.monto}; },
    destinoPase: function(){ return {fecha: hechos.fecha, anio: +hechos.fecha.slice(0, 4), mes: +hechos.fecha.slice(5, 7) - 1}; },
    errorEn: function(id, msg){ hechos.errores.push(msg); }, anioExiste: function(){ return true; }, cerrarHoja: function(){}, renderTrabajo: function(){},
    MESES: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], tjId: function(){ return 'nuevo'; }, fARS: function(n){ return String(n); },
    tjAntes: null, paseQuitado: null, tieneTrab: function(){ return true; }
  }, PASE_FUNCS);
}
function almacenConTrabajo(){
  return H.fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026)), 'kibo.datos.2025': JSON.stringify(Object.assign(C.vacio(2025), {rev: 2})),
    'kibo.trabajo': JSON.stringify(Object.assign(H.trab([]), {rev: 1}))});
}
test('L-06 aplicarPase / quitarPase on ANOTHER year go through the revision of that blob (advisory: covered by reading only)', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2025-12-10', errores: []}, app = appPase(ls, hechos);
  H.cargarEn(app, ls, 2026); app.T = app.leerTrab();
  app.guardarPase();
  assert.deepEqual(hechos.errores, []);
  var y = H.guardado(ls, 2025), t = JSON.parse(ls.d['kibo.trabajo']);
  assert.deepEqual([y.rev, y.meses[11].ingresos[0].nombre, y.meses[11].ingresos[0].monto, t.rev, t.pases.length], [3, 'Del trabajo', 100000, 2, 1]);
  app.quitarPase('nuevo');
  y = H.guardado(ls, 2025); t = JSON.parse(ls.d['kibo.trabajo']);
  assert.deepEqual([y.rev, y.meses[11].ingresos[0].monto, t.rev, t.pases.length], [4, 0, 3, 0]);
});

test('L-07 a STALE tab (another tab saved; tab marked obsoleta) writes nothing when it passes money from Trabajo to another year, or removes a pase', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2025-12-10', errores: []}, app = appPase(ls, hechos);
  H.cargarEn(app, ls, 2026); app.T = app.leerTrab();
  app.obsoleta = true;   // what the storage event (with the pase sheet open) or a refused save leaves behind: no writes until reload (R4.3, Q12)
  var y25 = ls.d['kibo.datos.2025'], y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  app.guardarPase();
  assert.equal(ls.d['kibo.datos.2025'], y25, 'the other year is not written (its row without the pase would count the money twice)');
  assert.deepEqual([ls.d['kibo.datos.2026'] === y26, ls.d['kibo.trabajo'] === tr, app.T.pases.length], [true, true, 0]);
  assert.ok(app.g.avisos.innerHTML.indexOf('Hay cambios hechos en otra pestaña') >= 0, 'the stale notice is shown');
  // removing a pase from a stale tab must not touch the other year either
  var ls2 = almacenConTrabajo(), h2 = {monto: 100000, fecha: '2025-12-10', errores: []}, b = appPase(ls2, h2);
  H.cargarEn(b, ls2, 2026); b.T = b.leerTrab(); b.guardarPase();
  var y = ls2.d['kibo.datos.2025'];
  b.obsoleta = true; b.quitarPase('nuevo');
  assert.equal(ls2.d['kibo.datos.2025'], y, 'the row keeps the pase that Trabajo still has');
});
test('L-07b removing a pase from a STALE tab changes nothing (memory, Trabajo, other year) and never says "Pase borrado" (review R3-stale-toast-misleading)', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2025-12-10', errores: []}, toasts = [];
  var app = H.appAlmacen(ls, '2026-10-15', {
    leerMonto: function(){ return {ok: true, v: hechos.monto}; },
    destinoPase: function(){ return {fecha: hechos.fecha, anio: 2025, mes: 11}; },
    errorEn: function(id, msg){ hechos.errores.push(msg); }, anioExiste: function(){ return true; }, cerrarHoja: function(){}, renderTrabajo: function(){},
    MESES: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], tjId: function(){ return 'nuevo'; }, fARS: function(n){ return String(n); },
    tjAntes: null, paseQuitado: null, tieneTrab: function(){ return true; }, toast: function(m){ toasts.push(m); }
  }, PASE_FUNCS);
  H.cargarEn(app, ls, 2026); app.T = app.leerTrab(); app.guardarPase();
  var y25 = ls.d['kibo.datos.2025'], tr = ls.d['kibo.trabajo'];
  toasts.length = 0;
  app.obsoleta = true;
  app.quitarPase('nuevo', true);
  assert.equal(app.T.pases.length, 1, 'the pase stays in memory: nothing was removed');
  assert.equal(ls.d['kibo.trabajo'], tr, 'Trabajo is not written');
  assert.equal(ls.d['kibo.datos.2025'], y25, 'the other year is not written');
  assert.deepEqual(toasts, [], 'no "Pase borrado" message');
  assert.ok(app.g.avisos.innerHTML.indexOf('Hay cambios hechos en otra pestaña') >= 0, 'the stale notice is shown instead');
});

test('L-07c a pase into ANOTHER year from a tab that missed the storage event (Trabajo saved in another tab) writes nothing in either blob', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2025-12-10', errores: []}, a = appPase(ls, hechos), b = appPase(ls, hechos);
  H.cargarEn(a, ls, 2026); a.T = a.leerTrab(); H.cargarEn(b, ls, 2026); b.T = b.leerTrab();
  a.T.tope = 77; assert.equal(a.guardarTrab(true), true, 'tab A moved Trabajo');
  assert.deepEqual([b.obsoleta, b.sucio], [false, false], 'tab B is clean and never got the event');
  var antes = JSON.stringify(ls.d), y25 = ls.d['kibo.datos.2025'];
  assert.equal(b.aplicarPase({anio: 2025, mes: 11, monto: 100000}, 1), false, 'the precheck refuses before the first write');
  assert.equal(ls.d['kibo.datos.2025'], y25, 'the other year is not written (its row would count a pase Trabajo does not have)');
  assert.equal(JSON.stringify(ls.d), antes, 'nothing else either');
  assert.equal(b.obsoleta, true, 'the tab is marked stale');
  b.obsoleta = false; b.g.avisos.innerHTML = '';
  b.guardarPase();
  assert.equal(JSON.stringify(ls.d), antes, 'the pase sheet writes neither the other year nor Trabajo');
  assert.equal(b.T.pases.length, 0, 'no pase in memory');
  assert.equal(b.obsoleta, true);
  assert.ok(b.g.avisos.innerHTML.indexOf('Hay cambios hechos en otra pestaña') >= 0, 'the stale notice is shown');
});

test('L-08 deshacerTj keeps the revision of what is stored now, so the undo saves; a newer save of another tab still wins', function(){
  var ls = H.fakeStorage({'kibo.trabajo': JSON.stringify(Object.assign(H.trab([]), {tope: 10, rev: 5}))});
  var app = H.appAlmacen(ls, '2026-10-15', {tjAntes: null, tab: 'mes'}, ['deshacerTj', 'antesDeCambiar']);
  app.T = app.leerTrab();
  app.antesDeCambiar(); app.T.tope = 99; assert.equal(app.guardarTrab(true), true);
  app.deshacerTj();
  var t = JSON.parse(ls.d['kibo.trabajo']);
  assert.deepEqual([t.tope, t.rev], [10, 7]);
  var otra = H.appAlmacen(ls, '2026-10-15', {tjAntes: null, tab: 'mes'}, ['deshacerTj', 'antesDeCambiar']);
  otra.T = otra.leerTrab();
  app.antesDeCambiar(); app.T.tope = 50; app.guardarTrab(true);   // rev 8
  otra.T.tope = 1; otra.antesDeCambiar(); otra.deshacerTj();   // otra loaded rev 7: its undo must not overwrite rev 8
  t = JSON.parse(ls.d['kibo.trabajo']);
  assert.deepEqual([t.tope, t.rev, otra.obsoleta], [50, 8, true]);
});

test('L-09 Trabajo restore: a backup without Trabajo leaves the stored Trabajo as it is; a lower incoming revision still moves forward', function(){
  var guardadoT = JSON.stringify(Object.assign(H.trab([]), {tope: 3, rev: 6}));
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026)), 'kibo.trabajo': guardadoT});
  var app = H.appAlmacen(ls, null, {descTrabajo: function(){ return ''; }});
  app.D = app.normalizar({anio: 2026}, app.hoy);
  app.restaurarTexto(JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: C.vacio(2026)}})); app.pendiente();
  assert.equal(ls.d['kibo.trabajo'], guardadoT);
  app.restaurarTexto(JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: C.vacio(2026)}, trabajo: Object.assign(H.trab([]), {tope: 44, rev: 1})})); app.pendiente();
  var t = JSON.parse(ls.d['kibo.trabajo']);
  assert.deepEqual([t.tope, t.rev, app.obsoleta], [44, 7, false]);
});

// L-10 (was a pinned risk, fixed in R4.6): the pase writes two blobs (the year row and Trabajo) with no transaction. Both revisions are
// checked BEFORE the first write, so a missed storage event can no longer leave one blob written and the other refused.
function appPaseToasts(ls, hechos, toasts){
  return H.appAlmacen(ls, '2026-10-15', {
    leerMonto: function(){ return {ok: true, v: hechos.monto}; },
    destinoPase: function(){ return {fecha: hechos.fecha, anio: +hechos.fecha.slice(0, 4), mes: +hechos.fecha.slice(5, 7) - 1}; },
    errorEn: function(id, msg){ hechos.errores.push(msg); }, anioExiste: function(){ return true; }, cerrarHoja: function(){}, renderTrabajo: function(){},
    MESES: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], tjId: function(){ return 'nuevo'; }, fARS: function(n){ return String(n); },
    tjAntes: null, paseQuitado: null, tieneTrab: function(){ return true; }, toast: function(m){ toasts.push(m); }
  }, PASE_FUNCS);
}
test('L-10 a missed storage event on Trabajo: the pase into the OPEN year writes neither blob (no money in both pockets)', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2026-10-10', errores: []}, toasts = [];
  var a = appPase(ls, hechos), b = appPaseToasts(ls, hechos, toasts);
  H.cargarEn(a, ls, 2026); a.T = a.leerTrab(); H.cargarEn(b, ls, 2026); b.T = b.leerTrab();
  a.T.tope = 7; a.guardarTrab(true);   // another tab saves Trabajo; tab B has not processed the storage event yet
  var y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  b.guardarPase();
  assert.equal(ls.d['kibo.datos.2026'], y26, 'the year row is not written (before R4.6 it was: +100.000 while Trabajo kept the money)');
  assert.equal(ls.d['kibo.trabajo'], tr, 'Trabajo keeps the other tab\'s save');
  assert.deepEqual([b.obsoleta, b.T.pases.length, (b.D.meses[9].ingresos || []).length, toasts.length], [true, 0, 0, 0], 'nothing changes in memory, no "Pasé" toast');
  assert.ok(b.g.avisos.innerHTML.indexOf('Hay cambios hechos en otra pestaña') >= 0, 'the stale notice is shown');
  assert.equal(hechos.errores.length, 1, 'the sheet says why nothing happened');
});
test('L-10b a missed storage event on Trabajo: removing a pase writes neither blob (the money never vanishes from both pockets)', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2026-10-10', errores: []}, toasts = [];
  var a = appPase(ls, hechos);
  H.cargarEn(a, ls, 2026); a.T = a.leerTrab(); a.guardarPase();
  var b = appPaseToasts(ls, hechos, toasts);
  H.cargarEn(b, ls, 2026); b.T = b.leerTrab();
  a.T.tope = 7; a.guardarTrab(true);   // tab A saves Trabajo again; tab B misses the event
  var y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  b.quitarPase('nuevo', true);
  assert.equal(ls.d['kibo.datos.2026'], y26, 'the row keeps the pase that Trabajo still has');
  assert.equal(ls.d['kibo.trabajo'], tr);
  assert.deepEqual([b.obsoleta, b.T.pases.length, b.D.meses[9].ingresos[0].monto, toasts.length], [true, 1, 100000, 0]);
});
test('L-10c a missed storage event on the OPEN year: the pase writes neither blob and never says "Pasé"', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2026-10-10', errores: []}, toasts = [];
  var a = appPase(ls, hechos), b = appPaseToasts(ls, hechos, toasts);
  H.cargarEn(a, ls, 2026); a.T = a.leerTrab(); H.cargarEn(b, ls, 2026); b.T = b.leerTrab();
  a.D.meses[0].ahorroMesARS = 1; a.sucio = true; a.guardar();   // another tab saves the year; tab B misses the event
  var y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  b.guardarPase();
  assert.deepEqual([ls.d['kibo.datos.2026'] === y26, ls.d['kibo.trabajo'] === tr], [true, true]);
  assert.deepEqual([b.obsoleta, b.T.pases.length, toasts.length], [true, 0, 0]);
});
test('L-10d reponerPase (undo of a removal) checks both revisions first: a stale Trabajo leaves both blobs as they are', function(){
  var ls = almacenConTrabajo(), hechos = {monto: 100000, fecha: '2026-10-10', errores: []}, toasts = [];
  var b = appPaseToasts(ls, hechos, toasts);
  H.cargarEn(b, ls, 2026); b.T = b.leerTrab(); b.guardarPase(); b.quitarPase('nuevo', true);
  var a = appPase(ls, hechos); H.cargarEn(a, ls, 2026); a.T = a.leerTrab(); a.T.tope = 9; a.guardarTrab(true);
  var y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  b.reponerPase();
  assert.deepEqual([ls.d['kibo.datos.2026'] === y26, ls.d['kibo.trabajo'] === tr, b.obsoleta, b.T.pases.length], [true, true, true, 0]);
});

// L-11 (N2 review): the pase writes the open year first; when that write FAILS (quota / browser refuses, not another tab) nothing else
// may happen: the row goes back in memory, Trabajo is not written and the user sees "No se pudo guardar".
function almacenQueFalla(){
  var falla = {anio: false}, ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(C.vacio(2026)), 'kibo.trabajo': JSON.stringify(Object.assign(H.trab([]), {rev: 1}))},
    function(k){ return falla.anio && k === 'kibo.datos.2026'; });
  return {ls: ls, falla: falla};
}
test('L-11a a pase into the open year whose write fails: no row stored, no pase in Trabajo, memory as before, visible failure', function(){
  var a = almacenQueFalla(), ls = a.ls, hechos = {monto: 100000, fecha: '2026-10-10', errores: []}, toasts = [];
  var b = appPaseToasts(ls, hechos, toasts);
  H.cargarEn(b, ls, 2026); b.T = b.leerTrab();
  a.falla.anio = true;
  var y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  b.guardarPase();
  assert.equal(ls.d['kibo.datos.2026'], y26, 'the year is not written');
  assert.equal(ls.d['kibo.trabajo'], tr, 'Trabajo is not written (before the fix: 1 pase stored with no row)');
  assert.deepEqual([b.T.pases.length, b.D.meses[9].ingresos.length, toasts.length, hechos.errores.length], [0, 0, 0, 1], 'memory as before, no "Pasé", the sheet says it failed');
  assert.ok(b.g.pildoras.some(function(p){ return p[0] === 'No se pudo guardar' && p[1]; }), 'the existing save-failure feedback is shown');
  assert.equal(b.obsoleta, false, 'a refused write is not another tab');
});
test('L-11b removing a pase whose open-year write fails: the row keeps it, Trabajo keeps it, nothing says it was removed', function(){
  var a = almacenQueFalla(), ls = a.ls, hechos = {monto: 100000, fecha: '2026-10-10', errores: []}, toasts = [];
  var b = appPaseToasts(ls, hechos, toasts);
  H.cargarEn(b, ls, 2026); b.T = b.leerTrab(); b.guardarPase();
  assert.equal(H.guardado(ls, 2026).meses[9].ingresos[0].monto, 100000);
  a.falla.anio = true; toasts.length = 0; b.g.pildoras.length = 0;
  var y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  b.quitarPase('nuevo', true);
  assert.deepEqual([ls.d['kibo.datos.2026'] === y26, ls.d['kibo.trabajo'] === tr], [true, true]);
  assert.deepEqual([b.T.pases.length, b.D.meses[9].ingresos[0].monto, toasts.length], [1, 100000, 0]);
  assert.ok(b.g.pildoras.some(function(p){ return p[0] === 'No se pudo guardar' && p[1]; }));
});
test('L-11c undoing a removal (reponerPase) whose open-year write fails: nothing changes and the undo stays available', function(){
  var a = almacenQueFalla(), ls = a.ls, hechos = {monto: 100000, fecha: '2026-10-10', errores: []}, toasts = [];
  var b = appPaseToasts(ls, hechos, toasts);
  H.cargarEn(b, ls, 2026); b.T = b.leerTrab(); b.guardarPase(); b.quitarPase('nuevo', true);
  assert.equal(H.guardado(ls, 2026).meses[9].ingresos[0].monto, 0);
  a.falla.anio = true; toasts.length = 0;
  var y26 = ls.d['kibo.datos.2026'], tr = ls.d['kibo.trabajo'];
  b.reponerPase();
  assert.deepEqual([ls.d['kibo.datos.2026'] === y26, ls.d['kibo.trabajo'] === tr], [true, true]);
  assert.deepEqual([b.T.pases.length, b.D.meses[9].ingresos[0].monto], [0, 0]);
  assert.ok(b.paseQuitado && b.paseQuitado.id === 'nuevo', 'the undo can be tried again');
});
