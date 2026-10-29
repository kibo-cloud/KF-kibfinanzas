'use strict';
// R4.2: property-style tests of the invariants I1-I7 of the contract (odd/tasks/repair-sprint-1-r4-design.md section 1) over many random
// years generated from a SEEDED PRNG (mulberry32): random rows, ticks, transfers, plans, arrastre.desde, confirmed closings, Trabajo pases and hoy.
// All amounts are integers, so every identity is exact. A failure message carries the case number: replay it with the same seed.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');

var M = la.loadMotor();
var CASOS = 400;

function prng(seed){
  var a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function Rnd(seed){
  var r = prng(seed);
  return {
    f: r,
    int: function(n){ return Math.floor(r() * n); },
    pick: function(a){ return a[Math.floor(r() * a.length)]; },
    chance: function(p){ return r() < p; },
    monto: function(){ return r() < 0.2 ? 0 : Math.floor(r() * 500) * 1000 + (r() < 0.3 ? Math.floor(r() * 1000) : 0); }
  };
}
function copy(x){ return JSON.parse(JSON.stringify(x)); }
function dos(n){ return (n < 10 ? '0' : '') + n; }
function iso(a, m, d){ return a + '-' + dos(m + 1) + '-' + dos(d); }
function eq(a, b, msg){ assert.ok(a === b, msg + ': ' + a + ' !== ' + b); }

var NOMBRES = ['Sueldo', 'Otros ingresos', 'Del trabajo', 'Alquiler', 'Luz', 'Super', 'Salidas', 'Préstamo', 'Tarjeta', 'Amigo', 'Libre'];

function filas(R, cuantas){
  var o = [], i;
  for(i = 0; i < cuantas; i++) o.push({nombre: R.pick(NOMBRES), monto: R.monto(), pagado: R.chance(0.5)});
  return o;
}
function transfers(R, m){
  ['ahorroMesARS', 'retiroARS', 'ventaARS', 'ventaUSD', 'reposicionARS', 'compraARS', 'compraUSD', 'ahorroMesUSD'].forEach(function(k){ m[k] = R.chance(0.3) ? R.monto() : 0; });
}
// a random raw year + hoy + ctx
function caso(seed){
  var R = Rnd(seed), anio = 2026, d = {anio: anio, pagoExplicito: true, ahorroAnioAnterior: R.monto(), usdAnioAnterior: R.int(2000), aReponerAnterior: R.chance(0.3) ? R.monto() : 0,
    cotizacionUSD: 1000 + R.int(1000), cotizacionFecha: '2026-10-01', cripto: R.chance(0.4) ? [{activo: 'BTC', cantidad: R.int(5), precioUSD: R.int(50000)}] : [], meses: [], planDeudas: {}};
  var j;
  for(j = 0; j < 12; j++){
    var m = {ingresos: filas(R, R.int(3)), gastosFijos: filas(R, R.int(3)), gastosVariables: filas(R, R.int(3)), deudas: filas(R, R.int(3))};
    transfers(R, m);
    d.meses.push(m);
  }
  ['Préstamo', 'Tarjeta'].forEach(function(n){
    if(R.chance(0.5)) d.planDeudas[n] = {total: R.monto(), recargo: R.chance(0.3) ? 10 : 0, cuotas: R.int(8), pagadasAntes: R.int(3)};
  });
  var desde = R.chance(0.25) ? 0 : R.int(12);
  if(R.chance(0.8)){
    d.arrastre = {desde: desde, inicial: {apertura: R.chance(0.15) ? null : R.monto(), declarado: null, declaradoEl: null, origen: R.pick(['declarado', 'declarado', 'omitido', 'arrastre']), calculadoOrigen: R.chance(0.5) ? R.monto() : null}};
    for(j = desde; j < 12; j++) if(R.chance(0.25)) d.meses[j].cierreReal = {valor: R.monto(), calculadoAlConfirmar: R.chance(0.5) ? R.monto() : null, confirmadoEl: '2026-10-01'};
  }
  var hoy = {anio: R.pick([2025, 2026, 2026, 2026, 2027]), mes: R.int(12), dia: 1 + R.int(28)};
  hoy.iso = iso(hoy.anio, hoy.mes, hoy.dia);
  var ctx = {pasesTrabajo: {}, trabajoDisponible: R.chance(0.5) ? R.monto() : 0};
  if(R.chance(0.3)) ctx.cierrePrevio = R.monto();
  for(j = 0; j < 12; j++) if(R.chance(0.3)){
    var l = [], q, n = 1 + R.int(2);
    for(q = 0; q < n; q++) l.push({fecha: iso(anio, j, 1 + R.int(28)), monto: R.monto()});
    ctx.pasesTrabajo[anio + '-' + dos(j + 1)] = l;
  }
  return {R: R, d: M.normalizar(copy(d), hoy), hoy: hoy, ctx: ctx, seed: seed};
}

function plain(x){ return JSON.parse(JSON.stringify(x)); }
function cada(fn){ for(var s = 1; s <= CASOS; s++) fn(caso(s * 7919), s); }
function ult(d, hoy){ return Math.min(11, M.mesTope(d.anio, hoy)); }

test('I1 closing: cierreCalc = apertura + resultado + pasesNetos, and resultado = realized income - expenses - installments', function(){
  var n = 0;
  cada(function(c, s){
    var r = M.cadena(c.d, c.hoy, c.ctx);
    r.meses.forEach(function(e, j){
      if(e.legacy) return;
      var f = M.flujosMes(c.d, j, c.hoy, c.ctx);
      eq(e.cierreCalc, e.apertura + e.resultado + e.pasesNetos, 'I1 caso ' + s + ' mes ' + j);
      eq(f.resultado, f.ingresosReal - f.gastosReal - f.cuotasReal, 'resultado caso ' + s + ' mes ' + j);
      if(f.estado === 'futuro'){ eq(e.resultado, 0, 'futuro sin resultado'); eq(e.pasesNetos, 0, 'futuro sin pases'); eq(e.cierreCalc, e.apertura, 'futuro plano'); }
      n++;
    });
  });
  assert.ok(n > 1000, 'months checked: ' + n);
});

test('I2 chain: apertura(m+1) = cierreReal(m) ?? cierreCalc(m); the first month follows the arrastre rules', function(){
  var n = 0;
  cada(function(c, s){
    var r = M.cadena(c.d, c.hoy, c.ctx), ar = c.d.arrastre, desde = r.resumen.desde;
    r.meses.forEach(function(e, j){
      if(e.legacy) return;
      if(j > desde){
        var p = r.meses[j - 1];
        eq(e.apertura, p.cierreReal !== null ? p.cierreReal : p.cierreCalc, 'I2 caso ' + s + ' mes ' + j);
        eq(p.cierre, p.cierreReal !== null ? p.cierreReal : p.cierreCalc, 'cierre caso ' + s);
      } else {
        var ini = ar.inicial;
        if(desde === 0 && ini.origen === 'arrastre' && typeof c.ctx.cierrePrevio === 'number') eq(e.apertura, c.ctx.cierrePrevio, 'apertura anioAnterior caso ' + s);
        else if(ini.origen === 'omitido' || ini.apertura === null){ eq(e.apertura, 0, 'sin saldo inicial caso ' + s); assert.equal(e.sinSaldoInicial, true); }
        else eq(e.apertura, ini.apertura, 'apertura declarada caso ' + s);
      }
      n++;
    });
  });
  assert.ok(n > 1000, 'months checked: ' + n);
});

test('I3 conservation: every realized transfer moves money between pockets without creating any (ARS legs net to venta - compra; USD to its own flows)', function(){
  var n = 0;
  cada(function(c, s){
    for(var j = 0; j < 12; j++){
      var f = M.flujosMes(c.d, j, c.hoy, c.ctx), m = c.d.meses[j], real = f.estado !== 'futuro';
      var ars = f.pasesNetos - f.trabajoRealizado + f.dAhorroARS;   // Disponible + Ahorro ARS, without Trabajo
      eq(ars, real ? m.ventaARS - m.compraARS : 0, 'I3 ARS caso ' + s + ' mes ' + j);
      eq(f.dUSD, real ? m.ahorroMesUSD + m.compraUSD - m.ventaUSD : 0, 'I3 USD caso ' + s + ' mes ' + j);
      if(!real){ eq(f.dDisp, 0, 'futuro: Disponible quieto'); eq(f.dAhorroARS, 0, 'futuro: ahorro quieto'); }
      // compra never touches Disponible; ahorroMesUSD never touches ARS pockets
      eq(f.dDisp, f.resultado + f.pasesNetos, 'dDisp caso ' + s);
      eq(f.pasesNetos - f.trabajoRealizado, real ? m.retiroARS + m.ventaARS - m.ahorroMesARS - m.reposicionARS : 0, 'pases netos caso ' + s + ' mes ' + j);
      assert.ok(f.reposicionExcedente >= 0 && f.reposicionExcedente <= m.reposicionARS, 'excedente acotado');
      n++;
    }
  });
  assert.equal(n, CASOS * 12);
});

test('I4 month change: stocks of m+1 opening = stocks of m closing + the visible difference; no peso appears or disappears', function(){
  var n = 0;
  cada(function(c, s){
    var r = M.cadena(c.d, c.hoy, c.ctx), sr = M.serie(c.d, c.hoy);
    for(var j = r.resumen.desde; j < 11; j++){
      var e = r.meses[j], sig = r.meses[j + 1], real = e.estado !== 'futuro', dif = e.diferencia === null ? 0 : e.diferencia;
      var m = c.d.meses[j];
      var ahAntes = j > 0 ? sr[j - 1].ahorroAcumulado : c.d.ahorroAnioAnterior, ahDespues = real ? sr[j].ahorroAcumulado : ahAntes;
      var abre = sig.apertura + ahDespues, cierra = e.apertura + ahAntes;
      var esperado = (real ? e.resultado + e.trabajoRealizado + m.ventaARS - m.compraARS : 0) + dif;
      eq(abre - cierra, esperado, 'I4 caso ' + s + ' mes ' + j);
      n++;
    }
  });
  assert.ok(n > 500, 'transitions checked: ' + n);
});

// mutate EVERYTHING that lives in a future month (rows, ticks, transfers, a confirmed closing, future Trabajo pases)
function mutarFuturo(c, R){
  var d = copy(c.d), ctx = copy(c.ctx), j, q, sec = ['ingresos', 'gastosFijos', 'gastosVariables', 'deudas'];
  for(j = 0; j < 12; j++){
    if(M.estadoMes(d.anio, j, c.hoy) !== 'futuro') continue;
    var m = d.meses[j];
    sec.forEach(function(k){
      m[k].forEach(function(it){ it.monto = R.monto(); it.pagado = R.chance(0.5); });
      if(R.chance(0.7)) m[k].push({nombre: R.pick(NOMBRES), monto: R.monto(), pagado: R.chance(0.5), tope: 0, frec: '', dias: []});
    });
    transfers(R, m);
    if(d.arrastre && j >= d.arrastre.desde && R.chance(0.5)) m.cierreReal = {valor: R.monto(), calculadoAlConfirmar: R.monto(), confirmadoEl: '2026-10-01'};
    ctx.pasesTrabajo[d.anio + '-' + dos(j + 1)] = [{fecha: iso(d.anio, j, 1 + R.int(28)), monto: R.monto()}];
    for(q = 0; q < 1; q++) ctx.pasesTrabajo[d.anio + '-' + dos(j + 1)].push({fecha: iso(d.anio, j, 28), monto: R.monto()});
  }
  return {d: d, ctx: ctx};
}

test('I5 time isolation: nothing in a future month changes disponibleActual, ahorro a hoy, patrimonio neto, pasivos or any past/current month', function(){
  var n = 0, cambiados = 0;
  cada(function(c, s){
    var mu = mutarFuturo(c, c.R);
    var a = M.cadena(c.d, c.hoy, c.ctx), b = M.cadena(mu.d, c.hoy, mu.ctx);
    if(JSON.stringify(c.d) !== JSON.stringify(mu.d)) cambiados++;
    eq(b.resumen.disponibleActual, a.resumen.disponibleActual, 'disponibleActual caso ' + s);
    eq(b.resumen.proyectadoAlCierre, a.resumen.proyectadoAlCierre, 'proyectadoAlCierre caso ' + s);
    eq(b.resumen.vencidos, a.resumen.vencidos, 'vencidos caso ' + s);
    assert.deepEqual(plain(M.patrimonioNeto(mu.d, c.hoy, mu.ctx)), plain(M.patrimonioNeto(c.d, c.hoy, c.ctx)), 'patrimonioNeto caso ' + s);
    assert.deepEqual(plain(M.pasivos(mu.d, c.hoy)), plain(M.pasivos(c.d, c.hoy)), 'pasivos caso ' + s);
    for(var j = 0; j < 12; j++){
      if(M.estadoMes(c.d.anio, j, c.hoy) === 'futuro') continue;
      assert.deepEqual(plain(b.meses[j]), plain(a.meses[j]), 'mes ' + j + ' caso ' + s);
      assert.deepEqual(plain(M.flujosMes(mu.d, j, c.hoy, mu.ctx)), plain(M.flujosMes(c.d, j, c.hoy, c.ctx)), 'flujos mes ' + j + ' caso ' + s);
    }
    n++;
  });
  assert.equal(n, CASOS);
  assert.ok(cambiados > CASOS / 3, 'the mutation really changed the data in ' + cambiados + ' cases');
});

test('I6 legacy isolation: months before arrastre.desde reproduce the old calc numbers and ignore the new model entirely', function(){
  var n = 0;
  cada(function(c, s){
    var r = M.cadena(c.d, c.hoy, c.ctx), sr = M.serie(c.d, c.hoy), desde = r.resumen.desde;
    var sin = copy(c.d); delete sin.arrastre; sin.meses.forEach(function(m){ delete m.cierreReal; });
    var rs = M.cadena(sin, c.hoy, c.ctx);
    var mu = copy(c.d);
    for(var j = desde; j < 12; j++) mu.meses[j].ahorroMesARS += 12345;   // anything at or after desde cannot reach a legacy month
    var rm = M.cadena(mu, c.hoy, c.ctx);
    for(j = 0; j < desde; j++){
      var e = r.meses[j];
      assert.equal(e.legacy, true);
      assert.deepEqual(plain(e.calc), plain(M.calc(c.d.meses[j])), 'calc caso ' + s + ' mes ' + j);
      Object.keys(e.calc).forEach(function(k){ eq(e.calc[k], sr[j][k], 'serie.' + k + ' caso ' + s + ' mes ' + j); });
      assert.deepEqual(plain(e), plain(rs.meses[j]), 'sin arrastre caso ' + s + ' mes ' + j);
      assert.deepEqual(plain(e), plain(rm.meses[j]), 'mutado caso ' + s + ' mes ' + j);
      n++;
    }
    if(!c.d.arrastre) r.meses.forEach(function(x){ assert.equal(x.legacy, true); });
    if(!c.d.arrastre) assert.equal(r.resumen.sinDisponible, true);
  });
  assert.ok(n > 500, 'legacy months checked: ' + n);
});

test('I7 determinism: same data + same hoy => same outputs, twice and under two different system clocks', function(){
  var A = la.loadMotor({today: '2020-01-01'}), B = la.loadMotor({today: '2030-06-15'});
  function todo(m, c){
    var d = m.normalizar(copy(c.d), c.hoy), ctx = copy(c.ctx);
    return JSON.stringify({cadena: m.cadena(d, c.hoy, ctx), neto: m.patrimonioNeto(d, c.hoy, ctx), pasivos: m.pasivos(d, c.hoy),
      flujos: [0, 3, 6, 9, 11].map(function(j){ return m.flujosMes(d, j, c.hoy, ctx); }), estados: [0, 5, 11].map(function(j){ return m.estadoMes(d.anio, j, c.hoy); })});
  }
  cada(function(c, s){
    var x = todo(M, c);
    eq(todo(M, c), x, 'dos corridas caso ' + s);
    eq(todo(A, c), x, 'reloj 2020 caso ' + s);
    eq(todo(B, c), x, 'reloj 2030 caso ' + s);
  });
});

test('the generator exercises the interesting branches (guards against vacuous properties)', function(){
  var v = {legacy: 0, omitido: 0, difAnio: 0, reconfirmar: 0, trabajo: 0, reconciliar: 0, vencidos: 0, excedente: 0, actual: 0, planes: 0, cierreReal: 0, sinDisp: 0};
  cada(function(c){
    var r = M.cadena(c.d, c.hoy, c.ctx);
    r.meses.forEach(function(e, j){
      if(e.legacy){ v.legacy++; return; }
      if(e.sinSaldoInicial) v.omitido++;
      if(e.difAnioAnterior !== null) v.difAnio++;
      if(e.reconfirmar) v.reconfirmar++;
      if(e.trabajoRealizado > 0) v.trabajo++;
      if(e.reconciliar) v.reconciliar++;
      if(e.estado === 'actual') v.actual++;
      if(e.cierreReal !== null) v.cierreReal++;
      if(M.flujosMes(c.d, j, c.hoy, c.ctx).reposicionExcedente > 0) v.excedente++;
    });
    if(r.resumen.vencidos > 0) v.vencidos++;
    if(r.resumen.sinDisponible) v.sinDisp++;
    if(M.pasivos(c.d, c.hoy).detalle.some(function(x){ return x.conPlan; })) v.planes++;
  });
  Object.keys(v).forEach(function(k){ assert.ok(v[k] > 5, k + ' only ' + v[k]); });
});
