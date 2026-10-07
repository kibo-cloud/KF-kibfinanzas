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
  'lineasSaldo'].filter(existe);
var VARS = ['MESES', 'oculto', 'PUNTOS'];

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
