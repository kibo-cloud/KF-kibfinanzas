'use strict';
// P3a (visual redesign of the month view): the hero, the row states and the balance block only PRESENT numbers the engine already
// computes (cadena / flujosMes / tilesMes / lineasSaldo). These tests pin the new texts and prove every number shown is one of those.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var M = la.loadMotor();
var SRC = la.SRC_FOR_TESTS;
function existe(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); }
var FUNCS = ['estadoHero', 'claseHero', 'subHero', 'chipT', 'chipsHero', 'etiquetaHero', 'htmlHero', 'barra', 'fPct', 'botonOjo', 'fARS', 'grupos', 'esc',
  'lineasSaldo', 'seccion', 'abierta', 'filaTope', 'textoDeuda', 'cuotaAdelantada', 'esProgramado', 'gastadoVista', 'datosRealizados', 'cobroTxt',
  'faltaSeccion', 'textoFalta', 'textoDelTrabajo', 'secAhorro', 'notaCompra', 'notaRetiro', 'fUSD'].filter(existe);
var VARS = ['MESES', 'oculto', 'PUNTOS', 'ICOSEC', 'MARCABLE', 'TOPEABLE', 'SECS', 'verFilas', 'SUB_APAGADO'];

function appMes(d, T, j, today){
  var app = H.appVista(d, T, null, today, {funcs: FUNCS, vars: VARS});
  if(j !== undefined) app.mes = j;
  return app;
}
function vm(app){ return app.vistaModelo(app.D, app.hoy); }
function hero(app, j, notas, apagado){ return app.htmlHero(app.D, j, vm(app), app.hoy, H.tiles(app, j), notas, apagado); }
function bigClass(h){ return /<div class="big ([a-z]+)" id="bigFinal">/.exec(h)[1]; }

// ── hero (finding 1, 2, 3, 10, 11) ──
test('hero state per month: past = closing (confirmed or not), current = available now + estimated closing + pending, future = projection', function(){
  var app = appMes(C.seccion2(false, false)), v = vm(app);
  var sep = app.plain(app.estadoHero(app.D, 8, v, app.hoy)), oct = app.plain(app.estadoHero(app.D, 9, v, app.hoy)), nov = app.plain(app.estadoHero(app.D, 10, v, app.hoy));
  assert.deepEqual(sep, {modo: 'cerrado', estado: 'pasado', valor: 175000, confirmado: true});
  assert.equal(oct.modo, 'hoy');
  assert.equal(oct.valor, H.tiles(app, 9).disponibleFinal, 'the big number is the card value (tilesMes)');
  assert.equal(oct.alCierre, app.lineasSaldo(app.D, 9, v).proyectado, 'the estimated closing is the balance block projection');
  var f = M.flujosMes(app.D, 9, app.hoy, v.ctx);
  assert.deepEqual(oct.falta, {cobrar: f.ingresosPend, pagar: f.gastosPend + f.cuotasPend, atrasado: v.cad.resumen.vencidos, atrasadoCobros: v.cad.resumen.vencidosIngresos});
  assert.deepEqual(oct.falta, {cobrar: 0, pagar: 245000, atrasado: 20000, atrasadoCobros: 0}, 'non-vacuous');
  assert.deepEqual([nov.modo, nov.valor], ['proyectado', H.tiles(app, 10).disponibleFinal]);
  assert.equal(nov.valor, 1280000);
  assert.equal(app.estadoHero(app.D, 7, v, app.hoy).modo, 'simple', 'a month before arrastre.desde keeps the simple calculation');
  var leg = appMes(H.sinModelo(C.seccion2(false, false)));
  assert.equal(leg.estadoHero(leg.D, 9, vm(leg), leg.hoy).modo, 'simple', 'a year without arrastre');
});

test('hero on screen, current month: "Tenés hoy", the estimated closing in neutral style, pending chips that jump to the rows', function(){
  var app = appMes(C.seccion2(false, false)), h = hero(app, 9);
  assert.match(h, /<small class="hero-lbl">Tenés hoy<\/small>/);
  assert.match(h, /id="bigFinal">\$825\.000</);
  assert.equal(bigClass(h), 'ok');
  assert.match(h, /<div class="hero-sub" id="heroSub">Al cierre: <b>\$580\.000<\/b> · estimado<\/div>/);
  assert.match(h, /<button class="chip-t" data-act="irA" data-v="pagar"><span class="chip pend">Te falta pagar \$245\.000<\/span><\/button>/);
  assert.match(h, /<button class="chip-t" data-act="irA" data-v="atrasado"><span class="chip atras">Atrasado \$20\.000<\/span><\/button>/);
  assert.doesNotMatch(h, /Te falta cobrar/, 'nothing left to collect: no chip');
  assert.match(h, /<small>Cobrado<\/small><b>\$1\.000\.000<\/b>/, 'tiles are what was collected / paid');
  assert.match(h, /<small>Pagado<\/small>/);
  assert.doesNotMatch(h, /data-act="rapido"|data-t="anio"|data-t="usd"|El año|Dólares/, 'no hero buttons that repeat the tab bar or the Gasto button');
});

test('hero on screen, past and future months and legacy: closing with its confirmation, neutral projection, simple calculation marked', function(){
  var app = appMes(C.seccion2(false, false)), sep = hero(app, 8), nov = hero(app, 10), ago = hero(app, 7);
  assert.match(sep, /<small class="hero-lbl">Cerraste con<\/small>/);
  assert.match(sep, /<span class="chip real">Confirmado<\/span>/);
  var sinConf = C.seccion2(false, false); delete sinConf.meses[8].cierreReal;
  assert.match(hero(appMes(sinConf), 8), /<span class="chip pend">Sin confirmar<\/span>/);
  assert.match(nov, /<small class="hero-lbl">Proyectado para Noviembre<\/small>/);
  assert.equal(bigClass(nov), 'proy', 'a projection is never the green real-money hero');
  assert.match(nov, /class="saldo hero hero-proyectado"/);
  assert.match(nov, /<span class="chip prog">Programado<\/span>/);
  assert.match(nov, /<small>A cobrar<\/small>/);
  assert.match(ago, /<small class="hero-lbl">Disponible final<\/small>/);
  assert.match(ago, /<span class="chip prog">Cálculo simple<\/span>/);
  var leg = appMes(H.sinModelo(C.seccion2(false, false)), null, 9, '2027-03-01');   // 2026 seen from 2027: a legacy past year
  var hl = hero(leg, 9);
  assert.match(hl, /Cálculo simple/);
  assert.match(hl, new RegExp('id="bigFinal">' + leg.fARS(leg.calc(leg.D.meses[9]).disponibleFinal).replace(/[$.()]/g, '\\$&') + '<'), 'legacy number unchanged: calc()');
});

test('hero colors: red only for a negative real balance; a negative projection is amber; the simple calculation under the first-use question is gray', function(){
  var app = appMes(C.seccion2(false, false));
  assert.deepEqual([app.claseHero('hoy', -1), app.claseHero('cerrado', -1), app.claseHero('simple', -1), app.claseHero('hoy', 0)], ['mal', 'mal', 'mal', 'ok']);
  assert.deepEqual([app.claseHero('proyectado', -1), app.claseHero('proyectado', 5)], ['ambar', 'proy']);
  assert.equal(app.claseHero('simple', 5, true), 'proy');
});

// ── rows and section headers (finding 3, 7, 13; D) ──
function sec(app, k){ var S = app.SECS.filter(function(s){ return s.k === k; })[0]; return app.seccion(S, app.D.meses[app.mes]); }
var SECCIONES = ['ingresos', 'gastosFijos', 'gastosVariables', 'deudas'];

test('what a section still has to pay or collect adds up to the engine pending (flujosMes in a model month, calc() in a legacy one)', function(){
  var casos = [['model', C.seccion2(false, false)], ['model, ticked', C.seccion2(true, true)], ['legacy', H.sinModelo(C.seccion2(false, false))]], n = 0;
  casos.forEach(function(c){
    var app = appMes(c[1]), v = vm(app);
    for(var j = 0; j < 12; j++){
      var fs = SECCIONES.map(function(k){ return app.faltaSeccion(app.D, j, k, app.hoy); }), est = M.estadoMes(2026, j, app.hoy);
      if(est === 'futuro'){ assert.deepEqual(app.plain(fs), [0, 0, 0, 0], c[0] + ' ' + j + ': a future month has nothing "missing", it is programado'); continue; }
      if(v && !v.cad.meses[j].legacy){
        var f = M.flujosMes(app.D, j, app.hoy, v.ctx);
        assert.deepEqual(app.plain([fs[0], fs[1] + fs[2], fs[3]]), [f.ingresosPend, f.gastosPend, f.cuotasPend], c[0] + ' ' + j);
      } else {
        var k = M.calc(app.D.meses[j]);
        assert.deepEqual(app.plain(fs), [k.pendienteIngresos, k.pendienteFijos, k.pendienteVariables, k.pendienteDeudas], c[0] + ' ' + j);
      }
      n++;
    }
  });
  assert.equal(n, 30, 'non-vacuous');
  var del = C.vacio(2026); C.arrastre(del, 9, 0, 'declarado'); C.mes(del, 9, {ingresos: [C.it('Del trabajo', 400000, false), C.it('Sueldo', 50000, false)]});
  var a = appMes(del, H.trab([{fecha: '2026-10-10', monto: 300000}]), 9);
  assert.equal(a.faltaSeccion(a.D, 9, 'ingresos', a.hoy), M.flujosMes(a.D, 9, a.hoy, vm(a).ctx).ingresosPend, 'Del trabajo: only its excess is missing');
  assert.equal(a.faltaSeccion(a.D, 9, 'ingresos', a.hoy), 150000);
});

test('section header: "total" and below it "falta $X" only when something is pending', function(){
  var app = appMes(C.seccion2(false, false), null, 9);
  assert.match(sec(app, 'gastosFijos'), /<span class="sub"><span id="sub-gastosFijos">\$425\.000<\/span><small class="falta" id="falta-gastosFijos">falta \$25\.000<\/small><\/span>/);
  assert.match(sec(app, 'ingresos'), /<small class="falta" id="falta-ingresos"><\/small>/, 'nothing pending: empty (hidden)');
  app.mes = 10;
  assert.match(sec(app, 'ingresos'), /<small class="falta" id="falta-ingresos"><\/small>/, 'future month: programado, not "falta"');
});

test('row states: paid = solid check; pending = ring + "Falta" (current) or "Atrasado" (past); future model month = dashed ring + "Programado"', function(){
  var app = appMes(C.seccion2(false, true), null, 9), oct = sec(app, 'gastosFijos');
  assert.match(oct, /<div class="item pago"><button class="chk on" data-act="pagar" data-k="gastosFijos" data-i="0"/);
  assert.match(oct, /<div class="item pend"><button class="chk" data-act="pagar" data-k="gastosFijos" data-i="1"[^>]*>.*?<span class="mt-w"><small class="est pend">Falta<\/small><input class="monto"/);
  app.mes = 8;
  assert.match(sec(app, 'gastosFijos'), /<div class="item pend">.*?<small class="est atras">Atrasado<\/small>/, 'September Luz unpaid: overdue');
  app.mes = 10;
  var nov = sec(app, 'ingresos');
  assert.match(nov, /<div class="item progr"><button class="chk prog" data-act="pagar"[^>]*>.*?<small class="est prog">Programado<\/small>/, 'ticked ahead: programado chip');
  assert.doesNotMatch(nov, /Falta|item pago/);
});

test('Del trabajo: partial, complete and programado states in plain words, never "pases"', function(){
  function caso(monto, pagado, pases, j){
    var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); C.mes(d, j || 9, {ingresos: [C.it('Del trabajo', monto, !!pagado)]});
    var a = appMes(d, H.trab(pases), j || 9); return a.textoDelTrabajo(a.D, a.mes, a.D.meses[a.mes].ingresos[0], a.hoy);
  }
  var f = function(n){ return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  assert.equal(caso(400000, false, [{fecha: '2026-10-10', monto: 300000}]), 'Cobrado ' + f(300000) + ' de ' + f(400000) + ': lo que pasaste desde Trabajo. Los ' + f(100000) + ' que faltan tildalos cuando los cobres.');
  assert.equal(caso(400000, true, [{fecha: '2026-10-10', monto: 300000}]), 'Cobrado ' + f(400000) + ': ' + f(300000) + ' lo pasaste desde Trabajo y ' + f(100000) + ' lo marcaste vos. Se cambia desde esa pestaña.');
  assert.equal(caso(300000, false, [{fecha: '2026-10-10', monto: 300000}]), 'Cobrado ' + f(300000) + ': lo pasaste desde Trabajo. Se cambia desde esa pestaña.');
  assert.equal(caso(300000, false, [{fecha: '2026-10-10', monto: 100000}, {fecha: '2026-10-25', monto: 200000}]),
    'Cobrado ' + f(100000) + ' de ' + f(300000) + ': lo que pasaste desde Trabajo. ' + f(200000) + ' los pasás más adelante desde Trabajo.', 'a pase dated after hoy is not collected yet (flujosMes trabajoProgramado)');
  assert.equal(caso(200000, false, [{fecha: '2026-11-05', monto: 200000}], 10), 'Programado: lo que vas a pasar desde Trabajo. Se cambia desde esa pestaña.');
});

test('debt rows: "Cuota N de M" with pagada / pendiente / programada / sin pagar instead of "Sin pago este mes"', function(){
  var app = appMes(C.seccion2(false, false), null, 9);
  assert.match(app.textoDeuda('Préstamo', 8), /^Cuota 3 de 6 · pagada · quedan 3/);
  assert.match(app.textoDeuda('Préstamo', 9), /^Cuota 4 de 6 · pendiente · quedan 3/);
  assert.match(app.textoDeuda('Préstamo', 10), /^Cuota 4 de 6 · programada/);
  assert.match(app.textoDeuda('Préstamo', 7), /^Cuota 3 de 6 · sin pagar/);
  assert.doesNotMatch(sec(app, 'deudas'), /Sin pago este mes/);
});

// ── first use and empty year (finding 8, 9; F) ──
test('a year with nothing loaded shows each section as one sentence and one button; with data, or after "Cargar", the rows', function(){
  var app = appMes(C.vacio(2026), null, 9);
  app.D.meses[9].gastosFijos = [C.it('Alquiler', 0, false), C.it('Luz', 0, false)];
  var h = sec(app, 'gastosFijos');
  assert.match(h, /<div class="nota vacia">Todavía no cargaste nada en gastos fijos\.<\/div><button class="mas" data-act="verFilas" data-k="gastosFijos">Cargar gastos fijos<\/button><\/div><\/div>$/);
  assert.doesNotMatch(h, /input class="monto"/, 'no zero rows');
  app.verFilas.gastosFijos = true;
  assert.match(sec(app, 'gastosFijos'), /input class="monto"/);
  var con = appMes(C.seccion2(false, false), null, 9);
  assert.doesNotMatch(sec(con, 'gastosFijos'), /nota vacia/, 'a year with data: rows as always');
});

test('the simple calculation under the first-use question is gray and says why; the question card is the hero', function(){
  var leg = appMes(H.sinModelo(C.seccion2(false, false)), null, 9), h = hero(leg, 9, '', true);
  assert.match(h, /class="saldo hero hero-simple hero-apagado"/);
  assert.equal(bigClass(h), 'proy');
  assert.match(h, /Hasta que respondas: lo que tildaste este mes/);
  assert.match(h, /Cálculo simple/);
});

// ── savings section (finding 12; G) ──
test('savings: the rarely used groups wait behind a disclosure while empty; a group with data or with something to repay stays in sight', function(){
  var app = appMes(C.seccion2(false, false), null, 9), oct = app.secAhorro(app.D.meses[9], H.tiles(app, 9));
  var fuera = oct.slice(0, oct.indexOf('<details')), dentro = oct.slice(oct.indexOf('<details'));
  assert.ok(fuera.indexOf('Saqué del ahorro') >= 0 && fuera.indexOf('Repuse al ahorro') >= 0, 'October took 50.000 out: withdrawal and repayment in sight');
  assert.ok(dentro.indexOf('Pasé a dólares') >= 0 && dentro.indexOf('Otros dólares') >= 0, 'empty groups behind "Más movimientos del ahorro"');
  assert.match(oct, /<div class="nota ambar" id="notaRetiro">/, 'something to repay is amber, not red');
  app.mes = 10;
  var nov = app.secAhorro(app.D.meses[10], H.tiles(app, 10));
  assert.match(nov, /<details class="ah-mas"><summary>Más movimientos del ahorro/);
});
