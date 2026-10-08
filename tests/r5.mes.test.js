'use strict';
// R5 part 2 (night run N3b): the month screen of a model year.
// (1) "Del trabajo" above its pases (R4.2 interpretation 4, design §7, L-02): what the row keeps beyond its pases is ordinary income with its
//     own tilde; the part the pases cover stays always realized. flujosMes already implements the money rule; this is presentation only.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
var SRC = la.SRC_FOR_TESTS;
function existe(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); }
var FUNCS = ['seccion', 'abierta', 'fARS', 'grupos', 'esc', 'filaTope', 'textoDeuda', 'cuotaAdelantada', 'repartoTrabajo', 'esProgramado', 'gastadoVista', 'datosRealizados',
  'htmlTorta', 'pasadas', 'textoTopes', 'puedeAlternar', 'fPct', 'faltaSeccion', 'textoFalta', 'textoDelTrabajo'].filter(existe);
var VARS = ['ICOSEC', 'MARCABLE', 'TOPEABLE', 'MESES', 'oculto', 'PUNTOS', 'TORTA_MAX', 'SECS', 'verFilas'].filter(function(v){ return new RegExp('^var ' + v + '\\s*=', 'm').test(SRC); });

// the month screen of `d` with Trabajo store T; j = the month shown
function appMes(d, T, j, today){
  var app = H.appVista(d, T, null, today, {funcs: FUNCS, vars: VARS});
  if(j !== undefined) app.mes = j;
  return app;
}
function sec(app, k){ var S = app.SECS.filter(function(s){ return s.k === k; })[0]; return app.seccion(S, app.D.meses[app.mes]); }
function vm(app){ return app.vistaModelo(app.D, app.hoy); }
function excesoOct(monto, pagado){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); C.mes(d, 9, {ingresos: [C.it('Del trabajo', monto, !!pagado)]});
  return appMes(d, H.trab([{fecha: '2026-10-10', monto: 300000}]), 9);
}

// ── (1) "Del trabajo" above its pases ──
test('Del trabajo above its pases: the excess gets its own tilde; ticking it realizes exactly the excess (flujosMes)', function(){
  var app = excesoOct(400000), row = app.D.meses[9].ingresos[0];
  assert.equal(app.tieneTilde(app.D, 9, 'ingresos', row), true, 'a checkbox for the excess');
  assert.deepEqual(app.plain(app.repartoTrabajo(app.D, 9, row)), {pases: 300000, exceso: 100000});
  var f = M.flujosMes(app.D, 9, app.hoy, vm(app).ctx);
  assert.deepEqual([f.trabajoRealizado, f.ingresosReal, f.ingresosPend, vm(app).cad.resumen.disponibleActual], [300000, 0, 100000, 300000], 'unticked: the excess is pending');
  row.pagado = true;
  f = M.flujosMes(app.D, 9, app.hoy, vm(app).ctx);
  assert.deepEqual([f.trabajoRealizado, f.ingresosReal, f.ingresosPend, vm(app).cad.resumen.disponibleActual], [300000, 100000, 0, 400000], 'ticked: realized, the pase part unchanged');
  assert.equal(H.tiles(app, 9).totalIngresos, 400000, 'card Ingresos = pases + ticked excess');
});

test('Del trabajo covered by its pases (row = pases or below): no tilde, as before; a legacy month never has one', function(){
  [300000, 250000].forEach(function(m){
    var app = excesoOct(m), row = app.D.meses[9].ingresos[0];
    assert.equal(app.tieneTilde(app.D, 9, 'ingresos', row), false, m + ': covered by pases');
    assert.equal(app.repartoTrabajo(app.D, 9, row).exceso, 0);
  });
  var leg = C.vacio(2026); C.mes(leg, 9, {ingresos: [C.it('Del trabajo', 400000, false)]});
  var a = appMes(leg, H.trab([{fecha: '2026-10-10', monto: 300000}]), 9);
  assert.equal(a.tieneTilde(a.D, 9, 'ingresos', a.D.meses[9].ingresos[0]), false, 'legacy month: unchanged');
});

test('Del trabajo with two rows: the pases cover them in order, like flujosMes; only the uncovered part of each row is tickable', function(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 9, {ingresos: [C.it('Del trabajo', 200000, false), C.it('Sueldo', 50000, true), C.it('Del Trabajo ', 250000, false)]});
  var app = appMes(d, H.trab([{fecha: '2026-10-10', monto: 300000}]), 9), ls = app.D.meses[9].ingresos;
  assert.deepEqual(app.plain(app.repartoTrabajo(app.D, 9, ls[0])), {pases: 200000, exceso: 0});
  assert.deepEqual(app.plain(app.repartoTrabajo(app.D, 9, ls[2])), {pases: 100000, exceso: 150000});
  assert.deepEqual([app.tieneTilde(app.D, 9, 'ingresos', ls[0]), app.tieneTilde(app.D, 9, 'ingresos', ls[2])], [false, true]);
  ls[2].pagado = true;
  var f = M.flujosMes(app.D, 9, app.hoy, vm(app).ctx);
  assert.equal(f.ingresosReal, 50000 + 150000, 'the ticked excess is exactly what flujosMes realizes');
  assert.equal(f.ingresosPend, 0);
});

test('Del trabajo above its pases on screen: checkbox, the row stays read-only, and the split is said in plain words', function(){
  var app = excesoOct(400000), h = sec(app, 'ingresos');
  assert.match(h, /<button class="chk" data-act="pagar" data-k="ingresos" data-i="0" aria-label="Marcar como cobrado">/);
  assert.match(h, /class="nombre" data-k="ingresos" data-i="0" value="Del trabajo" aria-label="Nombre" readonly>/, 'still read-only (Trabajo changes it)');
  // P3a (finding 7): the split in plain words, without "pases": what already came in from Trabajo and what is left to tick
  assert.match(h, /Cobrado \$300\.000 de \$400\.000: lo que pasaste desde Trabajo\. Los \$100\.000 que faltan tildalos cuando los cobres\./);
  assert.doesNotMatch(h, /pases/);
  app.D.meses[9].ingresos[0].pagado = true;
  assert.match(sec(app, 'ingresos'), /<div class="item pago deltrab">.*<button class="chk on" data-act="pagar"/);
  var cub = excesoOct(300000), hc = sec(cub, 'ingresos');
  assert.doesNotMatch(hc, /data-act="pagar"/, 'covered row: no checkbox');
  assert.doesNotMatch(hc, /tildalos/);
  assert.match(hc, /Cobrado \$300\.000: lo pasaste desde Trabajo\. Se cambia desde esa pestaña\./);
});

// ── (2) future model months (N1-A, derived from design §1 "nothing in a future month is Realizado" and D3 "scheduled, clearly distinguished") ──
// section 2 data at 2026-10-15 with November ticked ahead (Sueldo, Préstamo) plus a capped rent ticked in October and November
function futuro(modelo){
  var raw = C.seccion2(false, true);
  raw.meses[9].gastosFijos.push({nombre: 'Expensas', monto: 90000, pagado: true, tope: 80000});
  raw.meses[10].gastosFijos = [{nombre: 'Expensas', monto: 90000, pagado: true, tope: 80000}];
  if(!modelo) H.sinModelo(raw);
  return raw;
}
test('future model month: the pie shows nothing paid yet (ticks ahead are programado); past/current and legacy months unchanged', function(){
  var app = appMes(futuro(true), null, 10), nov = app.D.meses[10];
  var h = app.htmlTorta(nov, H.tiles(app, 10));
  assert.doesNotMatch(h, /tg-fila/, 'no slice for a ticked future row');
  assert.match(h, /Noviembre todavía no llegó: lo que cargaste está programado/);
  app.mes = 9;
  assert.match(app.htmlTorta(app.D.meses[9], H.tiles(app, 9)), /<span class="tg-n">Expensas<\/span>/, 'current month: paid rows still in the pie');
  var leg = appMes(futuro(false), null, 10);
  assert.match(leg.htmlTorta(leg.D.meses[10], H.tiles(leg, 10)), /<span class="tg-n">Expensas<\/span>/, 'legacy year: unchanged');
});
test('future model month: a ticked capped row does not consume its cap and raises no over-cap alert; legacy unchanged', function(){
  var app = appMes(futuro(true), null, 10), it = app.D.meses[10].gastosFijos[0];
  assert.equal(app.gastadoVista(it, 10), 0);
  assert.match(app.filaTope('gastosFijos', 0, it), /<small class="" id="tt-gastosFijos-0">— de \$80\.000<\/small>/);
  assert.deepEqual(app.plain(app.pasadas(app.D.meses[10])), [], 'no over-cap alert');
  app.mes = 9;
  assert.deepEqual(app.plain(app.pasadas(app.D.meses[9])), ['Expensas'], 'current month: still over the cap');
  var leg = appMes(futuro(false), null, 10);
  assert.equal(leg.gastadoVista(leg.D.meses[10].gastosFijos[0], 10), 90000, 'legacy year: unchanged');
  assert.deepEqual(leg.plain(leg.pasadas(leg.D.meses[10])), ['Expensas']);
});
test('future model month: the debt row text ignores installments ticked ahead; legacy unchanged', function(){
  var app = appMes(futuro(true), null, 10), sin = appMes(C.seccion2(false, false), null, 10);
  assert.equal(app.textoDeuda('Préstamo', 10), sin.textoDeuda('Préstamo', 10), 'a ticked future installment reads as not paid yet');
  assert.match(app.textoDeuda('Préstamo', 10), /^Cuota 4 de 6 · programada · quedan /, 'P3a (finding 13): the installment of a future month is "programada"');
  var leg = appMes(futuro(false), null, 10);
  assert.match(leg.textoDeuda('Préstamo', 10), /^Cuota 4 de 6/, 'legacy year: a ticked row is paid (unchanged)');
});
// native review follow-up (night range T5): the realized copy of the year is made only when it can change the debt text, i.e. when an
// installment of a programado month is ticked ahead; every other path reads D itself and says exactly what the copy would say
function textoConCopia(app, nombre, j){   // reference: always through datosRealizados, as before the follow-up
  var real = app.datosRealizados, n = 0, t;
  app.datosRealizados = function(d, h){ n++; return real(d, h); };
  t = app.textoDeuda(nombre, j);
  app.datosRealizados = real;
  return {t: t, copias: n};
}
test('the debt row text copies the year only when an installment of a programado month is ticked ahead (same text either way)', function(){
  var casos = [
    ['legacy year', appMes(futuro(false), null, 10), [8, 9, 10], 0],
    ['model year, nothing ticked ahead', appMes(C.seccion2(false, false), null, 10), [8, 9, 10, 11], 0],
    ['model year, an installment ticked ahead', appMes(futuro(true), null, 10), [8, 9, 10, 11], 1]
  ], n = 0;
  casos.forEach(function(c){
    var app = c[1];
    c[2].forEach(function(j){
      var ref = app.estadoDeuda(app.datosRealizados(app.D, app.hoy), 'Préstamo', j, app.hoy), r = textoConCopia(app, 'Préstamo', j);
      assert.equal(r.copias, c[3], c[0] + ', month ' + j + ': copies');
      assert.ok(ref, c[0] + ': the plan exists');
      assert.equal(r.t, app.textoDeuda('Préstamo', j), c[0] + ', month ' + j + ': deterministic');
      assert.match(r.t, new RegExp('Cuota ' + ref.cuotaN + ' de ' + ref.plan.cuotas + ' · ' + (ref.esteMes ? 'pagada' : '(pendiente|programada|sin pagar)')), c[0] + ', month ' + j + ': same installment as the realized view');
      assert.equal(r.t.indexOf('quedan ' + ref.restantes) >= 0 || ref.restantes === 0, true, c[0] + ', month ' + j + ': same remaining as the realized view');
      if(ref.fin) assert.ok(r.t.indexOf('terminás en ' + app.MESES[ref.fin.mes].toLowerCase()) >= 0, c[0] + ', month ' + j + ': same end month as the realized view');
      n++;
    });
  });
  assert.equal(n, 11, 'non-vacuous');
  // the ticked-ahead installment of November must not move the end date of the current month's text (why the copy is kept there)
  var con = appMes(futuro(true), null, 9), sin = appMes(C.seccion2(false, false), null, 9);
  assert.equal(con.textoDeuda('Préstamo', 9), sin.textoDeuda('Préstamo', 9));
});
test('future model month on screen: rows say "programado" instead of a tick state; a row ticked ahead can only be unticked', function(){
  var app = appMes(futuro(true), null, 10), h = sec(app, 'ingresos');
  assert.doesNotMatch(h, /class="item pago/, 'nothing looks paid');
  assert.match(h, /<button class="chk prog" data-act="pagar" data-k="ingresos" data-i="0" aria-label="Programado: lo marcaste antes de tiempo. Tocá para desmarcarlo.">/);
  assert.match(h, /Programado: noviembre todavía no llegó\. Lo marcás como cobrado cuando llegue\./);
  assert.equal(app.puedeAlternar(10, app.D.meses[10].ingresos[0]), true, 'untick a row ticked ahead');
  app.D.meses[10].ingresos[0].pagado = false;
  h = sec(app, 'ingresos');
  assert.match(h, /<span class="chk prog" role="img" aria-label="Programado" title="Programado"><\/span>/);
  assert.doesNotMatch(h, /data-act="pagar"/, 'cannot tick a future row');
  assert.equal(app.puedeAlternar(10, app.D.meses[10].ingresos[0]), false);
  app.mes = 9;
  var oct = sec(app, 'gastosFijos');
  assert.match(oct, /<div class="item pago"><button class="chk on" data-act="pagar" data-k="gastosFijos" data-i="0"/, 'current month: unchanged');
  assert.doesNotMatch(oct, /programado/i);
  assert.equal(app.puedeAlternar(9, app.D.meses[9].gastosFijos[1]), true);
  var leg = appMes(futuro(false), null, 10), hl = sec(leg, 'ingresos');
  assert.match(hl, /<div class="item pago"><button class="chk on" data-act="pagar"/, 'legacy year: unchanged');
  assert.doesNotMatch(hl, /programado/i);
});
test('the tick action goes through puedeAlternar (static guard)', function(){
  assert.match(SRC, /if\(a === 'pagar'\)\{\n\s+var kp = [^\n]+\n\s+if\(itp && puedeAlternar\(mes, itp\)\)\{ alternarPago\(mes, itp\);/);
});
