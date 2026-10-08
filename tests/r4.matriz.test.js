'use strict';
// R4.5: the 17 OFFICIAL D16 acceptance cases (odd/tasks/repair-sprint-1.md "D16 — official acceptance list (verbatim)"), one test each,
// against the current code. Expected values come from the approved contract (odd/tasks/repair-sprint-1-r4-design.md); each test cites
// its source. The INPUT / EXPECTED / ACTUAL / EVIDENCE table lives in odd/tasks/repair-sprint-1-r4.5-matrix.md.
// Cases 5 and 17 are validated on the model/migration and, since R5 (N3a), also through the month-view Editar path; case 15 runs the
// R7 quick-expense question (rule D8, built in L3).
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
var HOY = C.hoy('2026-10-15');
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function filas(l){ return plain(l).map(function(it){ return {nombre: it.nombre, monto: it.monto, pagado: it.pagado}; }); }
function modelo(raw, iso, ctx){
  var h = iso ? C.hoy(iso) : HOY, d = M.normalizar(C.copy(raw), h);
  return {d: d, h: h, cad: plain(M.cadena(d, h, ctx || {})), pat: plain(M.patrimonioNeto(d, h, ctx || {})), f: function(j){ return plain(M.flujosMes(d, j, h, ctx || {})); }};
}
// a model year that starts in October (arrastre.desde = 9) with the given opening and October rows
function octubre(apertura, filas){
  var d = C.vacio(2026); C.arrastre(d, 9, apertura, 'declarado'); C.mes(d, 9, filas); return d;
}
var SUELDO = function(p){ return C.it('Sueldo', 1000000, p); };
var GASTOS = {gastosFijos: [C.it('Alquiler', 400000, true)], gastosVariables: [C.it('Super', 100000, true)]};
function con(o, extra){ var r = {}; Object.keys(o).forEach(function(k){ r[k] = o[k]; }); Object.keys(extra).forEach(function(k){ r[k] = extra[k]; }); return r; }
var CARD = ['totalIngresos', 'totalGastos', 'ahorroMesARS', 'disponibleFinal'];
// R5 (N3a): the month-view write path (Editar of the opening) on the same storage harness
var R5 = ['vistaModelo', 'tilesMes', 'mesDelModelo', 'pasesDelMes', 'guardarModelo', 'modoApertura', 'fijarApertura', 'lineasSaldo', 'textoOrigen', 'filaSaldo', 'htmlSaldo', 'fARS', 'grupos', 'esc'];
function appR5(ls){ return H.appAlmacen(ls, '2026-10-15', {MESES: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'], oculto: false, PUNTOS: ''}, R5); }
function card(app, j){ var t = H.tiles(app, j), o = {}; CARD.forEach(function(k){ o[k] = t[k]; }); return o; }

// 1 ── §1 Resultado del mes / Disponible actual, I1; §2(b)
test('D16-01 sueldo realizado + gastos realizados: resultado 500.000, disponible actual 500.000, the card shows it', function(){
  var raw = octubre(0, con(GASTOS, {ingresos: [SUELDO(true)]})), r = modelo(raw), o = r.cad.meses[9];
  assert.deepEqual([o.apertura, o.resultado, o.pasesNetos, o.cierreCalc, o.proyectado], [0, 500000, 0, 500000, 500000]);
  assert.equal(r.cad.resumen.disponibleActual, 500000);
  assert.deepEqual([o.pendienteIngresos, o.pendienteGastos, o.pendienteCuotas], [0, 0, 0]);
  assert.deepEqual(card(H.appVista(raw), 9), {totalIngresos: 1000000, totalGastos: 500000, ahorroMesARS: 0, disponibleFinal: 500000});
  // the same rows in a year WITHOUT the model (every user before R5): the card is the old calc() (D4), same number here
  var leg = C.copy(raw); delete leg.arrastre;
  assert.equal(H.tiles(H.appVista(leg), 9).disponibleFinal, 500000);
  // in a past month the closing carries to the next opening (I2)
  var sep = C.vacio(2026); C.arrastre(sep, 8, 0, 'declarado'); C.mes(sep, 8, con(GASTOS, {ingresos: [SUELDO(true)]}));
  var rs = modelo(sep);
  assert.deepEqual([rs.cad.meses[8].cierre, rs.cad.meses[9].apertura, rs.cad.resumen.disponibleActual], [500000, 500000, 500000]);
});

// 2 ── §1 Realizado vs Pendiente; Proyectado al cierre = actual + pending income - pending expenses
test('D16-02 sueldo pendiente + gastos realizados: the pending salary is not available money, only projected', function(){
  var raw = octubre(600000, con(GASTOS, {ingresos: [SUELDO(false)]})), r = modelo(raw), o = r.cad.meses[9];
  assert.deepEqual([o.apertura, o.resultado, o.cierreCalc, o.pendienteIngresos, o.proyectado], [600000, -500000, 100000, 1000000, 1100000]);
  assert.equal(r.cad.resumen.disponibleActual, 100000);
  assert.equal(r.cad.resumen.proyectadoAlCierre, 1100000);
  assert.deepEqual(card(H.appVista(raw), 9), {totalIngresos: 0, totalGastos: 500000, ahorroMesARS: 0, disponibleFinal: 100000});
  // legacy year: the old month result, without opening (D4): -500.000 with 1.000.000 pending
  var leg = C.copy(raw); delete leg.arrastre;
  var c = H.tiles(H.appVista(leg), 9);
  assert.deepEqual([c.disponibleFinal, c.pendienteIngresos], [-500000, 1000000]);
});

// 3 ── §1 Disponible inicial + Pendiente; Q8 overdue shown apart
test('D16-03 saldo inicial + sueldo pendiente: available = opening; the salary only enters the projection; overdue income is apart', function(){
  var raw = octubre(200000, {ingresos: [SUELDO(false)]}), r = modelo(raw), o = r.cad.meses[9];
  assert.deepEqual([o.apertura, o.sinSaldoInicial, o.resultado, o.cierreCalc, o.proyectado], [200000, false, 0, 200000, 1200000]);
  assert.equal(r.cad.resumen.disponibleActual, 200000);
  assert.equal(H.tiles(H.appVista(raw), 9).disponibleFinal, 200000);
  // the same salary left pending in a PAST month: out of its closing, out of October's projection, reported as overdue income (Q8)
  var sep = C.vacio(2026); C.arrastre(sep, 8, 200000, 'declarado'); C.mes(sep, 8, {ingresos: [SUELDO(false)]});
  var rs = modelo(sep);
  assert.deepEqual([rs.cad.meses[8].cierre, rs.cad.meses[9].apertura, rs.cad.resumen.disponibleActual, rs.cad.resumen.proyectadoAlCierre],
    [200000, 200000, 200000, 200000]);
  assert.deepEqual([rs.cad.resumen.vencidosIngresos, rs.cad.resumen.vencidos], [1000000, 0]);
});

// 4 ── §1 Pases netos, §4 savings in the same month, I3, I5, §6 bruto
test('D16-04 saldo inicial + ahorro: savings leave Disponible and enter Ahorro ARS (no peso created); future savings only project', function(){
  var raw = octubre(300000, {ingresos: [SUELDO(true)], ahorroMesARS: 200000});
  raw.ahorroAnioAnterior = 500000;
  C.mes(raw, 10, {ahorroMesARS: 100000});
  var r = modelo(raw), o = r.cad.meses[9], f = r.f(9);
  assert.deepEqual([o.apertura, o.resultado, o.pasesNetos, o.cierreCalc], [300000, 1000000, -200000, 1100000]);
  assert.deepEqual([f.dDisp, f.dAhorroARS, f.dDisp + f.dAhorroARS], [800000, 200000, 1000000]);   // I3: both pockets move by the result only
  assert.equal(r.cad.resumen.disponibleActual, 1100000);
  assert.equal(r.cad.meses[10].proyectado, 1000000);
  assert.deepEqual([r.pat.disponible, r.pat.ahorroARS, r.pat.bruto, r.pat.neto], [1100000, 700000, 1800000, 1800000]);   // Nov savings excluded (I5)
  assert.deepEqual(card(H.appVista(raw), 9), {totalIngresos: 1000000, totalGastos: 0, ahorroMesARS: 200000, disponibleFinal: 1100000});
  assert.equal(H.tiles(H.appVista(raw), 10).disponibleFinal, 1000000);
});

// 5 ── §8 first use (Q1, D5), D2 (correct the opening / the real closing), D6; model and migration only (the Editar screen is R5)
test('D16-05 saldo inicial corregido manualmente (model + Editar): declared -> derived opening; a corrected opening or real closing moves the chain by exactly the difference', function(){
  var raw = H.sinModelo(C.seccion2(false, false)), d = M.normalizar(C.copy(raw), HOY);
  var ar = plain(M.iniciarArrastre(d, HOY, 825000, {}));
  assert.deepEqual(ar, {desde: 9, inicial: {apertura: 175000, declarado: 825000, declaradoEl: '2026-10-15', origen: 'declarado'}});
  d.arrastre = ar;
  var meses0 = JSON.stringify(d.meses);
  assert.equal(M.cadena(d, HOY, {}).resumen.disponibleActual, 825000);
  d.arrastre.inicial.apertura = 200000;   // the user corrects the opening by +25.000
  var cad = M.cadena(M.normalizar(plain(d), HOY), HOY, {});
  assert.deepEqual([cad.meses[9].apertura, cad.resumen.disponibleActual, cad.meses[10].proyectado], [200000, 850000, 1305000]);
  assert.equal(JSON.stringify(d.meses), meses0, 'no movement is created by a correction (D2, D14)');
  // correcting a past month's real closing: the next opening follows the real value, the difference stays informational (D2)
  var r = modelo(C.seccion2(false, false));
  assert.deepEqual([r.cad.meses[8].cierreCalc, r.cad.meses[8].cierreReal, r.cad.meses[8].diferencia, r.cad.meses[9].apertura], [200000, 175000, -25000, 175000]);
  // the app path today: activarSaldos is idempotent, so a second declaration does NOT overwrite the stored opening (Editar is R5)
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(raw)}), app = H.appAlmacen(ls);
  H.cargarEn(app, ls, 2026);
  assert.equal(app.activarSaldos(825000), true);
  assert.equal(app.activarSaldos(900000), false);
  assert.equal(H.guardado(ls, 2026).arrastre.inicial.apertura, 175000);
  // R5: the same correction through Editar of the month view: available now 850.000 -> opening 200.000 (+25.000), no movement (D2)
  var ls5 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(raw)}), a5 = appR5(ls5);
  H.cargarEn(a5, ls5, 2026);
  assert.equal(a5.activarSaldos(825000), true);
  var meses5 = JSON.stringify(H.guardado(ls5, 2026).meses);
  assert.equal(a5.fijarApertura(850000, a5.modoApertura(a5.D, a5.hoy)), true);
  var g5 = H.guardado(ls5, 2026), c5 = M.cadena(M.normalizar(g5, HOY), HOY, {});
  assert.deepEqual([g5.arrastre.inicial.apertura, g5.arrastre.inicial.origen, c5.resumen.disponibleActual, c5.meses[10].proyectado], [200000, 'declarado', 850000, 1305000]);
  assert.equal(JSON.stringify(g5.meses), meses5, 'Editar creates no movement');
  assert.equal(H.tiles(H.appVista(g5), 9).disponibleFinal, 850000);
});

// 6 ── D6, §2(d) case B, §4 "edit a past transfer, month confirmed"
test('D16-06 cierre confirmado que luego cambia: the confirmed value holds, the difference updates and asks to reconfirm; unconfirmed recalculates', function(){
  var raw = C.seccion2(false, false);
  raw.meses[8].gastosFijos[1].pagado = true;   // Sep Luz 20.000 paid after September was confirmed at 175.000 (calculated 200.000)
  var r = modelo(raw), s = r.cad.meses[8];
  assert.deepEqual([s.cierreCalc, s.cierreReal, s.diferencia, s.reconfirmar, s.cierre], [180000, 175000, -5000, true, 175000]);
  assert.deepEqual([r.cad.meses[9].apertura, r.cad.resumen.disponibleActual], [175000, 825000]);
  assert.equal(H.tiles(H.appVista(raw), 8).disponibleFinal, 175000, 'the September card keeps the confirmed closing');
  var sin = C.copy(raw); delete sin.meses[8].cierreReal;
  var u = modelo(sin);
  assert.deepEqual([u.cad.meses[8].cierre, u.cad.meses[9].apertura, u.cad.resumen.disponibleActual], [180000, 180000, 830000]);   // 180.000 + 600.000 + 50.000
});

// 7 ── D3, §4 scheduled rows, Q4 (Trabajo pase), Q5
test('D16-07 pase futuro: never changes available money a hoy; only the projection of its month; Trabajo keeps it until its date', function(){
  var r = modelo(C.seccion2(false, false));
  var raw2 = C.seccion2(false, false); C.mes(raw2, 11, {ahorroMesARS: 50000});
  var r2 = modelo(raw2);
  assert.deepEqual([r.cad.resumen.disponibleActual, r2.cad.resumen.disponibleActual, r.pat.ahorroARS, r2.pat.ahorroARS], [825000, 825000, 600000, 600000]);
  assert.deepEqual([r.cad.meses[10].proyectado, r2.cad.meses[11].proyectado], [1280000, 1230000]);
  assert.deepEqual([r2.f(11).pasesNetos, r2.f(11).pasesNetosProg], [0, -50000]);
  // Trabajo pase dated 2026-11-05 into a model month (Q4): Trabajo keeps it, the pase sheet cannot pass it again, Nov projects it
  var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 300000, true), C.it('Sueldo', 500000, true)], gastosFijos: [C.it('Alquiler', 200000, true)]});
  C.mes(d, 10, {ingresos: [C.it('Del trabajo', 200000, true)]});
  var app = H.appVista(d, H.trab([{fecha: '2026-10-05', monto: 300000}, {fecha: '2026-11-05', monto: 200000}])), t = app.resumenTrab();
  assert.deepEqual([t.disponible, t.paraPasar, t.pasadoProgramado], [700000, 500000, 200000]);
  assert.deepEqual([H.tiles(app, 9).disponibleFinal, H.tiles(app, 10).disponibleFinal], [700000, 900000]);
});

// 8 ── D4 (no retroactive carry), I6, §6 (savings a hoy), D7 (cut at the current month)
test('D16-08 ahorro histórico: savings of the previous year and of legacy months count a hoy; legacy months read as before', function(){
  var raw = C.vacio(2026); raw.ahorroAnioAnterior = 500000;
  for(var j = 0; j < 8; j++) C.mes(raw, j, {ahorroMesARS: 50000});
  C.arrastre(raw, 8, 0, 'declarado');
  C.mes(raw, 8, {ahorroMesARS: 100000}); C.mes(raw, 10, {ahorroMesARS: 200000});
  var r = modelo(raw);
  assert.equal(r.pat.ahorroARS, 1000000);   // 500.000 + 8 x 50.000 + 100.000; November (scheduled) excluded
  assert.equal(M.patrimonio(r.d).ahorroARS, 1200000, 'the old year-end patrimonio() still includes November (legacy semantics, D4)');
  for(j = 0; j < 8; j++) assert.deepEqual(plain(r.cad.meses[j].calc), plain(M.calc(r.d.meses[j])), 'legacy month ' + j);
  assert.deepEqual([r.cad.meses[8].apertura, r.cad.meses[8].cierre, r.cad.resumen.disponibleActual], [0, -100000, -100000]);
  var app = H.appVista(raw);
  assert.equal(app.patrimonioPantalla(app.D, app.hoy).ahorroARS, 1000000);
  var leg = C.copy(raw); delete leg.arrastre;
  var al = H.appVista(leg);
  assert.equal(al.patrimonioPantalla(al.D, al.hoy).ahorroARS, 1200000, 'a year without the model shows the old year-end savings (D4)');
});

// 9 ── §8 Compatibility ("backups need no format change"), D14 (never break backup/restore)
test('D16-09 restauración de backup: arrastre / cierreReal / rev travel; the chain, the card and the net worth are identical after the round trip', function(){
  var d = M.normalizar(C.copy(C.seccion2(false, false)), HOY); d.rev = 4;
  var ls1 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(d)}), a1 = H.appAlmacen(ls1);
  H.cargarEn(a1, ls1, 2026);
  var texto = JSON.stringify(a1.armarCopia());
  var ls2 = H.fakeStorage(), a2 = H.appAlmacen(ls2);
  a2.D = a2.normalizar({anio: 2026}, a2.hoy);
  a2.restaurarTexto(texto); a2.pendiente();
  var b = H.guardado(ls2, 2026);
  assert.deepEqual(plain(M.cadena(M.normalizar(C.copy(b), HOY), HOY, {})), plain(M.cadena(d, HOY, {})));
  var v = H.appVista(b);
  assert.deepEqual([H.tiles(v, 8).disponibleFinal, H.tiles(v, 9).disponibleFinal, H.tiles(v, 10).disponibleFinal], [175000, 825000, 1280000]);
  assert.equal(v.patrimonioPantalla(v.D, v.hoy).patrimonioARS, 2625000);
  // an older backup without the model restores a legacy year: the card is calc() again (the user is asked again in R5)
  var viejo = H.sinModelo(C.seccion2(false, false));
  a2.restaurarTexto(JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: viejo}})); a2.pendiente();
  var vl = H.appVista(H.guardado(ls2, 2026));
  assert.equal(vl.vistaModelo(vl.D, vl.hoy), null);
  assert.deepEqual(H.tiles(vl, 9), plain(vl.calc(vl.D.meses[9])));
});

// 10 ── §8 "years after the start year: desde 0, opening = previous December closing; duplicar snapshots it", D6 drift
test('D16-10 creación de nuevo año: the new year opens from the December closing; when the year arrives the live closing wins and the drift is visible', function(){
  var ls = H.fakeStorage(), d = M.normalizar(C.copy(C.seccion2(false, false)), HOY);
  var app = H.appAlmacen(ls, '2026-10-15', {guardar: function(){}, leerAnio: function(){ return null; }});
  app.D = d; app.duplicar();
  var n = app.D;
  assert.deepEqual(plain(n.arrastre), {desde: 0, inicial: {apertura: 825000, origen: 'arrastre', calculadoOrigen: 825000}});
  assert.deepEqual([n.anio, n.ahorroAnioAnterior, n.usdAnioAnterior, n.aReponerAnterior, n.planDeudas['Préstamo'].pagadasAntes], [2027, 800000, 1000, 50000, 3]);
  // on 2027-01-15 the 2026 year is closed: November's scheduled savings (200.000) are realized (Q5), so December closes at 625.000
  var hoy27 = C.hoy('2027-01-15');
  var ls27 = H.fakeStorage({'kibo.datos.2026': JSON.stringify(C.seccion2(false, false)), 'kibo.datos.2027': JSON.stringify(plain(n))});
  var a27 = H.appAlmacen(ls27, '2027-01-15');
  var d27 = H.cargarEn(a27, ls27, 2027), ctx = a27.ctxModelo(d27, hoy27), cad = M.cadena(d27, hoy27, ctx);
  assert.equal(ctx.cierrePrevio, 625000);
  assert.deepEqual([cad.meses[0].apertura, cad.meses[0].origenApertura, cad.meses[0].difAnioAnterior, cad.resumen.disponibleActual], [625000, 'anioAnterior', -200000, 625000]);
  // a legacy year stays legacy in the new year (D4)
  var al = H.appAlmacen(H.fakeStorage(), '2026-10-15', {guardar: function(){}, leerAnio: function(){ return null; }});
  al.D = M.normalizar(H.sinModelo(C.seccion2(false, false)), HOY); al.duplicar();
  assert.equal(al.D.arrastre, undefined);
});

// 11 ── I2, D6, §4 "edit a past transfer", D4 (no retroactive carry)
test('D16-11 modificación de un mes anterior: unconfirmed -> the chain follows; confirmed -> the opening holds and asks to reconfirm; before desde -> nothing a hoy', function(){
  var sin = H.sinModelo(C.seccion2(false, false)); C.arrastre(sin, 8, 50000, 'declarado');
  var a = modelo(sin);
  assert.deepEqual([a.cad.meses[8].cierre, a.cad.resumen.disponibleActual], [200000, 850000]);
  sin.meses[8].gastosVariables[0].monto = 150000;   // Sep Super 200.000 -> 150.000
  var b = modelo(sin);
  assert.deepEqual([b.cad.meses[8].cierre, b.cad.meses[9].apertura, b.cad.resumen.disponibleActual], [250000, 250000, 900000]);
  var conf = C.seccion2(false, false); conf.meses[8].gastosVariables[0].monto = 150000;
  var c = modelo(conf);
  assert.deepEqual([c.cad.meses[8].cierreCalc, c.cad.meses[8].diferencia, c.cad.meses[8].reconfirmar, c.cad.meses[9].apertura, c.cad.resumen.disponibleActual],
    [250000, -75000, true, 175000, 825000]);
  var leg = C.seccion2(false, false); C.mes(leg, 7, {ingresos: [C.it('Sueldo', 999999, true)]});
  var e = modelo(leg);
  assert.equal(e.cad.resumen.disponibleActual, 825000, 'a month before arrastre.desde never feeds the chain (D4)');
  assert.equal(e.cad.meses[7].calc.disponibleFinal, 999999);
});

// 12 ── D7 (computed up to the current month only), I5, §6 cut-off
test('D16-12 patrimonio con meses futuros cargados: future rows (even ticked) and future transfers change nothing a hoy', function(){
  var base = modelo(C.seccion2(false, false));
  var raw = C.seccion2(false, false);
  C.mes(raw, 11, {ingresos: [C.it('Aguinaldo', 5000000, true)], ahorroMesARS: 1000000, compraARS: 150000, compraUSD: 100, ahorroMesUSD: 50});
  var r = modelo(raw);
  assert.deepEqual([r.pat.disponible, r.pat.ahorroARS, r.pat.usd, r.pat.bruto, r.pat.neto], [825000, 600000, 1000, 2925000, 2625000]);
  assert.deepEqual(r.pat, base.pat);
  var app = H.appVista(raw);
  assert.equal(app.patrimonioPantalla(app.D, app.hoy).patrimonioARS, 2625000);
  // a year without the model keeps the old year-end net worth, future months included (D4, legacy view until R5 activates the model)
  var leg = H.sinModelo(C.copy(raw)), al = H.appVista(leg), p = al.patrimonioPantalla(al.D, al.hoy);
  assert.deepEqual([p.ahorroARS, p.usd], [500000 + 150000 - 50000 + 200000 + 1000000 - 150000, 1000 + 100 + 50]);
});

// 13 ── §5 B (debts), Q6, Q7, Q8, Q14
test('D16-13 deuda pendiente: an unpaid installment never leaves Disponible; it is a liability and, when overdue, shown apart', function(){
  var d = C.vacio(2026); C.arrastre(d, 8, 0, 'declarado');
  d.planDeudas = {'Tarjeta': {total: 100000, recargo: 0, cuotas: 3, pagadasAntes: 0}};
  C.mes(d, 8, {ingresos: [SUELDO(true)], deudas: [C.it('Tarjeta', 33333, false)]});
  C.mes(d, 9, {deudas: [C.it('Tarjeta', 33333, false)]});
  C.mes(d, 10, {deudas: [C.it('Tarjeta', 33334, false)]});
  var r = modelo(d);
  assert.deepEqual([r.cad.meses[8].cierre, r.cad.resumen.disponibleActual, r.cad.resumen.vencidos, r.cad.resumen.proyectadoAlCierre], [1000000, 1000000, 33333, 966667]);
  assert.deepEqual([r.pat.pasivos, r.pat.bruto, r.pat.neto], [100000, 1000000, 900000]);
  assert.equal(H.tiles(H.appVista(d), 9).disponibleFinal, 1000000);
  d.meses[8].deudas[0].pagado = true;   // paid late: booked in September (Q7)
  var p = modelo(d);
  assert.deepEqual([p.cad.meses[8].cierre, p.cad.resumen.vencidos, p.pat.pasivos, p.pat.neto], [966667, 0, 66667, 900000]);
});

// 14 ── D7 (net is the headline, gross secondary), §6, Q2, Q6
test('D16-14 patrimonio bruto vs neto: bruto 2.925.000 - pasivos 300.000 = neto 2.625.000; the screen headline is the net', function(){
  var r = modelo(C.seccion2(false, false));
  assert.deepEqual([r.pat.disponible, r.pat.ahorroARS, r.pat.usdARS, r.pat.criptoARS, r.pat.trabajo, r.pat.bruto, r.pat.pasivos, r.pat.neto],
    [825000, 600000, 1500000, 0, 0, 2925000, 300000, 2625000]);
  var raw = C.seccion2(false, false); raw.cripto = [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}];
  var app = H.appVista(raw, H.trab([], 300000)), p = app.plain(app.patrimonioPantalla(app.D, app.hoy));
  assert.deepEqual([p.modelo.criptoARS, p.modelo.trabajo, p.modelo.bruto, p.modelo.pasivos, p.modelo.neto], [900000, 300000, 4125000, 300000, 3825000]);
  assert.deepEqual([p.patrimonioARS, p.patrimonioUSD], [3825000, 2550]);   // headline = neto (in pesos and at the stored cotizacion)
  // the old patrimonio() (year without the model) has no liabilities at all: no gross/net distinction (D4 legacy)
  var al = H.appVista(H.sinModelo(C.seccion2(false, false)));
  assert.equal(al.patrimonioPantalla(al.D, al.hoy).modelo, undefined);
  // R5 N3b: the gross is now a row on screen (Dólares > Patrimonio total), above the debts and the net
  var hu = require('./fixtures/usd-vistas').appUSD(C.seccion2(false, false)).usd();
  assert.match(hu, /data-pat="bruto"><label><b>Patrimonio bruto<\/b><\/label><span>\$2\.925\.000<\/span>/);
  assert.match(hu, /data-pat="deudas"><label>Deudas \(lo que te falta pagar\)<\/label><span class="mudo"><span class="neg">\(\$300\.000\)<\/span><\/span>/);
  assert.match(hu, /data-pat="neto"><label><b>Patrimonio neto<\/b><\/label><span><b>\$2\.625\.000<\/b><\/span>/);
  assert.ok(hu.indexOf('data-pat="bruto"') < hu.indexOf('data-pat="deudas"') && hu.indexOf('data-pat="deudas"') < hu.indexOf('data-pat="neto"'), 'gross, debts, net in that order');
});

// 15 ── D8 (R7, built in L3 2026-10-08): a quick expense on a pending row with an amount asks: mark the existing row as paid, or record a
// separate realized expense keeping the plan pending. Undo (R2 E9) restores exactly the previous state for both answers; no duplication.
function caso15(){
  var hojas = [], toasts = [];
  var raw = octubre(100000, {ingresos: [C.it('Sueldo', 500000, true)], gastosVariables: [C.it('Super', 50000, false)]});
  var app = H.appVista(raw, null, null, null, {funcs: ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'filaDelGasto', 'anotarMov'], vars: ['gr'],
    globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
      abrirHoja: function(h){ hojas.push(h); }, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){}, toast: function(t){ toasts.push(t); }}});
  app.hojas = hojas; app.toasts = toasts;
  return app;
}
function disp(app){ var o = M.cadena(app.D, app.hoy, {}).meses[9]; return [o.cierreCalc, o.proyectado]; }
test('D16-15 gasto rápido sobre pendiente [R7]: asks; "Sí" ticks the row (keep or update its amount), "No" records a separate realized expense; undo restores exactly', function(){
  // the question
  var app = caso15(), antes = plain(app.D.meses[9]);
  assert.deepEqual(disp(app), [600000, 550000]);
  app.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; app.sumarGasto();
  assert.equal(app.hojas.length, 1, 'asks before touching anything');
  assert.match(app.hojas[0], /Super<\/b> está pendiente por \$\s?50\.000\. ¿Este gasto es ese pago\?/);
  assert.deepEqual(plain(app.D.meses[9]), antes, 'nothing changed while asking (Cancelar leaves it as it was)');
  // "Sí", the typed amount differs: second question; keep the row amount
  app.gastoEsPago();
  assert.equal(app.hojas.length, 2, 'the amounts differ: asks which one, no silent change');
  assert.match(app.hojas[1], /data-act="pagoMonto" data-v="fila"/); assert.match(app.hojas[1], /data-act="pagoMonto" data-v="gasto"/);
  app.marcarPago(false);
  var ls = app.D.meses[9].gastosVariables, mv = app.D.meses[9].movimientos[0];
  assert.deepEqual(filas(ls), [{nombre: 'Super', monto: 50000, pagado: true}], 'ticked, same amount, no new row');
  assert.deepEqual(disp(app), [550000, 550000], 'the planned 50.000 is now spent: deducted from Tenés hoy, projection unchanged');
  app.quitarMov(mv.id);
  assert.deepEqual(plain(app.D.meses[9]), antes, 'undo: exactly the previous month');
  assert.deepEqual(disp(app), [600000, 550000]);
  // "Sí", update the row to the typed amount
  app.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; app.sumarGasto(); app.gastoEsPago(); app.marcarPago(true);
  assert.deepEqual(filas(app.D.meses[9].gastosVariables), [{nombre: 'Super', monto: 20000, pagado: true}]);
  assert.deepEqual(disp(app), [580000, 580000]);
  app.quitarMov(app.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(app.D.meses[9]), antes, 'undo: exactly the previous month');
  // "No, es otro gasto": a separate ticked row; the plan stays pending
  app.gr = {monto: 20000, cat: 0, sec: 'gastosVariables'}; app.sumarGasto(); app.gastoAparte();
  assert.deepEqual(filas(app.D.meses[9].gastosVariables), [{nombre: 'Super', monto: 50000, pagado: false}, {nombre: 'Super (otro gasto)', monto: 20000, pagado: true}]);
  assert.deepEqual(disp(app), [580000, 530000], 'the 20.000 is spent today; the 50.000 is still planned');
  app.quitarMov(app.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(app.D.meses[9]), antes, 'undo: the separate row is gone, the plan is as it was');
  assert.deepEqual(disp(app), [600000, 550000]);
});

// 16 ── D9 (Argentine parsing per field type, no silent guessing), §8 Q1 (declared value to cents)
test('D16-16 formatos argentinos de números: money and quantity parsers; parsed values reach the chain to the cent', function(){
  var monto = [['1.234,56', 1234.56], ['1.500', 1500], ['1500', 1500], ['1,5', 1.5], [',5', 0.5], ['0.5', 0.5], ['1.5', 1.5], ['1.50', 1.5],
    ['$ 1.500', 1500], ['1.234.567,89', 1234567.89], ['', 0]];
  monto.forEach(function(c){ assert.equal(M.parseMonto(c[0]), c[1], c[0]); });
  ['1e3', '1,234.5', '12.5,3', '1.2.3', 'abc', '-100'].forEach(function(t){ assert.ok(Number.isNaN(M.parseMonto(t)), t); });
  assert.equal(M.parseMonto('-100', true), -100);
  [['0,001', 0.001], ['0.001', 0.001], ['1.234,5', 1234.5], ['0,00000001', 0.00000001]].forEach(function(c){ assert.equal(M.parseCantidad(c[0]), c[1], c[0]); });
  assert.ok(Number.isNaN(M.parseCantidad('1,234.5')));
  var d = M.normalizar(C.copy(octubre(0, {ingresos: [C.it('Sueldo', M.parseMonto('1.000.000,50'), true)], gastosVariables: [C.it('Super', M.parseMonto('100.234,56'), true)]})), HOY);
  var cad = M.cadena(d, HOY, {});
  assert.ok(Math.abs(cad.resumen.disponibleActual - 899765.94) < 0.005, String(cad.resumen.disponibleActual));
  delete d.arrastre;
  d.arrastre = M.iniciarArrastre(d, HOY, M.parseMonto('1.234.567,89'), {});
  assert.ok(Math.abs(M.cadena(d, HOY, {}).resumen.disponibleActual - 1234567.89) < 0.005);
  assert.equal(d.arrastre.inicial.apertura, 334801.95);
});

// 17 ── D5 (skip -> $0 "not configured"), §8 (skip => valor null, origen 'omitido', opening 0); model and migration only (prompt is R5)
test('D16-17 primer mes sin saldo inicial (model + Omitir, then Editar): skipped -> origen omitido, opening 0 flagged, available = what the month registered', function(){
  var raw = H.sinModelo(C.seccion2(false, false)), d = M.normalizar(C.copy(raw), HOY);
  var ar = plain(M.iniciarArrastre(d, HOY, null, {}));
  assert.deepEqual(ar, {desde: 9, inicial: {apertura: null, declarado: null, declaradoEl: '2026-10-15', origen: 'omitido'}});
  d.arrastre = ar;
  var cad = plain(M.cadena(d, HOY, {})), o = cad.meses[9];
  assert.deepEqual([o.sinSaldoInicial, o.origenApertura, o.apertura, o.resultado, o.pasesNetos, o.cierreCalc, o.proyectado], [true, 'omitido', 0, 600000, 50000, 650000, 405000]);
  assert.equal(cad.resumen.disponibleActual, 650000);
  assert.equal(M.patrimonioNeto(d, HOY, {}).disponible, 650000);
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(raw)}), app = H.appAlmacen(ls);
  H.cargarEn(app, ls, 2026);
  assert.equal(app.activarSaldos(null), true);
  assert.deepEqual(H.guardado(ls, 2026).arrastre.inicial, {apertura: null, declarado: null, declaradoEl: '2026-10-15', origen: 'omitido'});
  assert.equal(app.activarSaldos(500000), false, 'a later declaration goes through Editar (R5), not the first-use path');
  assert.equal(H.tiles(H.appVista(H.guardado(ls, 2026)), 9).disponibleFinal, 650000);
  // R5: the month view says it explicitly, and Editar declares it later
  var a5 = appR5(ls); H.cargarEn(a5, ls, 2026);
  assert.ok(a5.htmlSaldo(a5.D, 9, a5.vistaModelo(a5.D, a5.hoy)).indexOf('>Sin configurar<') >= 0);   // P3a: the origin is a chip
  assert.equal(a5.fijarApertura(500000, a5.modoApertura(a5.D, a5.hoy)), true);
  var g = H.guardado(ls, 2026);
  assert.deepEqual([g.arrastre.inicial.origen, g.arrastre.inicial.declarado, g.arrastre.inicial.apertura], ['declarado', 500000, -150000]);
  assert.equal(H.tiles(H.appVista(g), 9).disponibleFinal, 500000);
});
