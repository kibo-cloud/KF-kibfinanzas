'use strict';
// Final audit fixes (sprint closure, odd/tasks/stabilization-quick-sales.md "Final audit fixes"). Each block turns one audit probe
// (scratchpad fin/ and sec2/) into a test and pins the fixed behavior. No money rule changes: the motor goldens stay byte-identical.
var test = require('node:test');
var assert = require('node:assert/strict');
var H = require('./fixtures/r45-harness');
var C = require('./fixtures/r4-casos');
var la = require('./load-app');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }

// 2026 (model year) and 2027 created from it by the real duplicar
function creado(raw26, hoyIso){
  var y26 = M.normalizar(C.copy(raw26), C.hoy(hoyIso));
  var ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, hoyIso);
  app.D = app.leerAnio(2026); app.duplicar();
  return ls;
}
// what the Patrimonio tab shows for the stored year `anio` (opened as the app opens it: leerAnio)
function patrimonio(store, anio, hoyIso, T){
  var a = H.appVista(null, T || null, store, hoyIso);
  a.D = a.leerAnio(anio);
  var p = a.plain(a.patrimonioPantalla(a.D, a.hoy)).modelo;
  return {disp: p.disponible, ahorro: p.ahorroARS, bruto: p.bruto, campo: a.D.ahorroAnioAnterior};
}

// ── 1 (HIGH): a 2027 created by 1.32/1.33 has no stored copiaDiciembre. leerAnio adopts December as the copy in memory only, so after a
// December edit the stored field looked user-edited and froze while the Disponible followed live (bruto -100.000, no notice) ──
function anioSinCopia(){
  var ls = creado(C.seccion2(true, true), '2026-12-20');
  var y27 = JSON.parse(ls.d['kibo.datos.2027']); delete y27.copiaDiciembre; ls.d['kibo.datos.2027'] = JSON.stringify(y27);
  return ls;
}
test('1: open 2027 (no stored copy), switch to 2026, edit December, back to 2027: nothing appears or disappears (I4)', function(){
  var ls = anioSinCopia(), antes = patrimonio(ls.d, 2027, '2027-01-10');
  var app = H.appAlmacen(ls, '2027-01-10');
  app.D = app.leerAnio(2027);                       // opened: the copy is adopted in memory, nothing saved
  app.D = app.leerAnio(2026);                       // the user switches to 2026
  app.D.meses[11].ahorroMesARS = 100000; app.sucio = true;
  assert.equal(app.guardar(), true);
  app.D = app.leerAnio(2027);                       // back to 2027
  var despues = patrimonio(ls.d, 2027, '2027-01-10');
  assert.equal(despues.bruto, antes.bruto, 'bruto unchanged');
  assert.equal(despues.ahorro, 900000);
  assert.equal(app.D.ahorroAnioAnterior, 900000, 'the field follows December');
  assert.equal(JSON.parse(ls.d['kibo.datos.2027']).copiaDiciembre.ahorro, 800000, 'the copy of the pre-edit December was stored');
});
test('1: the stored copy is written only when missing; a year that already has one, or does not follow December, is not rewritten', function(){
  var ls = creado(C.seccion2(true, true), '2026-12-20'), y27 = ls.d['kibo.datos.2027'];
  var app = H.appAlmacen(ls, '2027-01-10');
  app.D = app.leerAnio(2026); app.D.meses[11].ahorroMesARS = 100000; app.sucio = true;
  assert.equal(app.guardar(), true);
  assert.equal(ls.d['kibo.datos.2027'], y27, 'a year with its stored copy is untouched');
  var leg = creado(H.sinModelo(C.seccion2(true, true)), '2026-12-20'), l27 = JSON.parse(leg.d['kibo.datos.2027']);
  delete l27.copiaDiciembre; leg.d['kibo.datos.2027'] = JSON.stringify(l27);
  var b = H.appAlmacen(leg, '2027-01-10'), txt = leg.d['kibo.datos.2027'];
  b.D = b.leerAnio(2026); b.D.meses[11].ahorroMesARS = 100000; b.sucio = true;
  assert.equal(b.guardar(), true);
  assert.equal(leg.d['kibo.datos.2027'], txt, 'a legacy year does not follow December: untouched');
});
test('1: if the copy of the next year cannot be written, the December edit is not saved either (no silent drift)', function(){
  var ls = anioSinCopia(), d26 = ls.d['kibo.datos.2026'];
  var falla = H.fakeStorage(ls.d, function(k){ return k === 'kibo.datos.2027'; });
  var app = H.appAlmacen(falla, '2027-01-10');
  app.D = app.leerAnio(2026); app.D.meses[11].ahorroMesARS = 100000; app.sucio = true;
  assert.equal(app.guardar(), false);
  assert.equal(falla.d['kibo.datos.2026'], d26, 'December not written');
  assert.equal(app.sucio, true, 'the edit stays pending, as any failed save');
  assert.equal(JSON.parse(falla.d['kibo.datos.2027']).copiaDiciembre, undefined);
});
test('1: a pase written into 2026 (year + Trabajo together) stores the copy of 2027 first, too', function(){
  var ls = anioSinCopia(), app = H.appAlmacen(ls, '2027-01-10');
  app.D = app.leerAnio(2026); app.D.meses[11].ahorroMesARS = 100000;
  assert.equal(app.escribirJuntos([{clave: 'kibo.datos.2026', obj: app.D}, {clave: 'kibo.trabajo', obj: app.T}], 'pase'), 'ok');
  assert.equal(JSON.parse(ls.d['kibo.datos.2027']).copiaDiciembre.ahorro, 800000);
  assert.equal(patrimonio(ls.d, 2027, '2027-01-10').ahorro, 900000);
});

// ── 2 (HIGH): a backup WITH Trabajo restores 2026 only; this phone's Trabajo passed money to 2025, which the phone keeps. The restored
// Trabajo has no pase into 2025 while the 2025 "Del trabajo" row stays: the money counted twice (Trabajo disponible 700.000 -> 1.000.000) ──
function hojaRestaurar(copia, pasesTel, aniosTel){
  var guardados = {};
  (aniosTel || []).forEach(function(y){ guardados['kibo.datos.' + y] = JSON.stringify(C.vacio(y)); });
  var ls = H.fakeStorage(guardados), a = H.appAlmacen(ls, '2026-10-15', {tieneTrab: function(){ return !!pasesTel; }}, ['avisoCopiaTrabajo', 'mezclaTrabajo', 'aniosDePases', 'descTrabajo', 'fARS', 'esc']);
  a.D = a.normalizar(C.vacio(2026), a.hoy);
  if(pasesTel) a.T.pases = pasesTel.map(function(f, i){ return {id: 'p' + i, fecha: f, monto: 300000, anio: +f.slice(0, 4), mes: +f.slice(5, 7) - 1, creada: f + 'T00:00:00.000Z'}; });
  var antes = JSON.stringify(ls.d), tAntes = JSON.stringify(a.T);
  a.pendiente = null;
  a.restaurarTexto(JSON.stringify(copia));
  return {hoja: a.g.hojas[a.g.hojas.length - 1] || '', alertas: a.g.alertas, a: a, ls: ls, intacto: JSON.stringify(ls.d) === antes && JSON.stringify(a.T) === tAntes};
}
function copiaDe(anios, tr){ var o = {app: 'TuGasto', version: 1, anios: {}}; anios.forEach(function(y){ o.anios[y] = C.vacio(y); }); if(tr) o.trabajo = tr; return o; }
test('2: a backup with Trabajo that would drop this phone\'s pases into a year the phone keeps is refused; nothing written', function(){
  var r = hojaRestaurar(copiaDe([2026], H.trab([], 1000000)), ['2025-12-20'], [2025, 2026]);
  assert.equal(r.hoja, '', 'no confirmation sheet');
  assert.equal(r.a.pendiente, null);
  assert.equal(r.intacto, true);
  assert.deepEqual(r.alertas, [['No restauré la copia', 'El Trabajo de este teléfono pasó plata a lo personal en 2025, que la copia no trae y este teléfono conserva, pero el Trabajo de la copia no tiene eso: los renglones «Del trabajo» y Trabajo dejarían de coincidir. Restaurá una copia completa (con todos esos años), o hacé primero una copia de seguridad de lo que tenés en este teléfono. No cambié nada.']]);
});
test('2: restores without that conflict are still offered (the year comes in the backup; the phone does not have it; pases only into replaced years)', function(){
  var tr = H.trab([{fecha: '2025-12-20', monto: 300000}], 1000000);
  [[copiaDe([2025, 2026], tr), ['2025-12-20'], [2025, 2026]],    // the backup brings 2025 too
   [copiaDe([2026], H.trab([], 1000000)), ['2025-12-20'], [2026]],   // the phone does not keep 2025: no row to count twice
   [copiaDe([2026], H.trab([], 1000000)), ['2026-03-10'], [2025, 2026]]   // the phone's pases go to the year the backup replaces
  ].forEach(function(c, i){
    var r = hojaRestaurar(c[0], c[1], c[2]);
    assert.equal(r.alertas.length, 0, 'case ' + i);
    assert.equal(typeof r.a.pendiente, 'function', 'case ' + i);
    assert.match(r.hoja, /Va a <b>reemplazar<\/b>/);
  });
});
