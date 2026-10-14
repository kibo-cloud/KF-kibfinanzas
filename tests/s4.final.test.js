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

// ── 3 (MEDIUM): re-saving the plan sheet in 2027 offers to load installments without the shift duplicar applies (the ones December 2026
// still schedules unpaid already have their month): «poner 3», then cuotasDeMas flagged 2 extra ──
function anioConPlan(){
  var ls = creado(C.seccion2(false, false), '2026-10-15'), g = {preguntas: [], alertas: [], toasts: []};
  var a = H.appVista(null, null, ls.d, '2026-10-20', {funcs: ['ofrecerCarga', 'conCuotasDeDiciembre', 'cuotasDeMas', 'esc'], vars: ['MESES'],
    globals: {preguntar: function(t, c, b, fn){ g.preguntas.push(c); fn(); }, alerta: function(t, c){ g.alertas.push([t, c]); }, tocar: function(){}, renderMes: function(){},
      toast: function(t){ g.toasts.push(t); }, fARS: function(n){ return '$' + Math.round(n); }}});
  a.D = a.leerAnio(2027); a.g = g;
  return a;
}
function filasPrestamo(d){ return d.meses.filter(function(m){ return m.deudas.some(function(r){ return r.nombre === 'Préstamo' && r.monto > 0; }); }).length; }
test('3: loading installments from the plan sheet counts what December still schedules: one more, none extra', function(){
  var a = anioConPlan();
  assert.equal(a.cuotasProgramadas(a.leerAnio(2026), 'Préstamo'), 2, 'December 2026 still schedules 2 unpaid');
  a.ofrecerCarga('Préstamo', 0);
  assert.equal(a.g.toasts.length, 1);
  assert.match(a.g.toasts[0], /^Cargué 1 cuota de /);
  assert.equal(filasPrestamo(a.D), 1);
  assert.deepEqual(a.plain(a.cuotasDeMas(a.D)), []);
  assert.equal(a.D.planDeudas['Préstamo'].pagadasAntes, 3, 'pagadasAntes keeps saying what was PAID');
});
test('3: a year that does not follow December live loads as before (no shift)', function(){
  var a = anioConPlan();
  delete a.D.arrastre;   // legacy year
  a.ofrecerCarga('Préstamo', 0);
  assert.match(a.g.toasts[0], /^Cargué 3 cuotas de /);
  assert.equal(a.D.planDeudas['Préstamo'].pagadasAntes, 3);
});

// ── 4 (MEDIUM): 2025 has no month-to-month balance (legacy) and 2026 declares it from October. A pase dated 2025-12-20 left Trabajo and
// never reached the 2026 Disponible (bruto -300.000): desdeDelSaldo said -1 for a year without arrastre. Refused like M1, pointing to
// where the balance starts; deleting such a pase is refused too ──
function appPaseAnios(fecha, conModelo){
  var y25 = C.vacio(2025), y26 = C.vacio(2026);
  y25.meses[11].ingresos = [C.it('Del trabajo', 0, true)];
  if(conModelo !== false) C.arrastre(y26, 9, 100000, 'declarado');
  var store = {'kibo.datos.2025': JSON.stringify(M.normalizar(C.copy(y25), C.hoy('2026-10-15'))), 'kibo.datos.2026': JSON.stringify(M.normalizar(C.copy(y26), C.hoy('2026-10-15')))};
  var g = {campos: {psFecha: fecha, psMonto: '1000'}, notas: [], aplicados: [], alertas: [], escritos: 0, boton: {textContent: 'Pasar'}, nota: {className: '', innerHTML: ''}};
  var a = H.appVista(JSON.parse(store['kibo.datos.2026']), H.trab([], 500000), store, '2026-10-15', {funcs: ['guardarPase', 'notaPase', 'destinoPase', 'anioExiste', 'avisoPaseAntes', 'desdeDelSaldo', 'inicioDelSaldo', 'aniosGuardados', 'quitarPase', 'sacarPaseT', 'tjId', 'sumarPaseT', 'fDiaLargo'], vars: ['MESES'],
    globals: {val: function(id){ return g.campos[id] || ''; }, leerMonto: function(id){ var v = Number(g.campos[id]); return {ok: true, v: v, vacio: !g.campos[id]}; },
      errorEn: function(id, t){ g.notas.push(t); }, aplicarPase: function(p, signo, cambiarT){ g.aplicados.push(p); cambiarT(); return true; }, alerta: function(t, c){ g.alertas.push([t, c]); },
      guardarTrab: function(){ g.escritos++; }, paseQuitado: null, confirmar: function(t, c, b, fn){ fn(); },
      cerrarHoja: function(){}, renderTrabajo: function(){}, toast: function(){}, fARS: function(n){ return '$' + n; }, tjAntes: null, obsoleta: false, RENGLON_TRABAJO: 'Del trabajo',
      document: {getElementById: function(id){ return id === 'psNota' ? g.nota : {focus: function(){}}; }, querySelector: function(){ return g.boton; }}}});
  a.resumenTrab = function(){ return {paraPasar: 500000}; };
  a.g = g; return a;
}
var NO_ANTES_ANIO = 'Esa fecha (20/12/2025) es anterior a Octubre 2026, desde cuando llevás el saldo mes a mes: pasarlo con esa fecha haría aparecer o desaparecer plata. Elegí una fecha desde Octubre 2026.';
test('4: a pase into a year without the month-to-month balance, before a later year that declares it, is refused', function(){
  var a = appPaseAnios('2025-12-20');
  assert.equal(a.avisoPaseAntes(a.destinoPase()), NO_ANTES_ANIO);
  a.guardarPase();
  assert.equal(a.g.aplicados.length, 0, 'not saved');
  assert.deepEqual(a.g.notas, [NO_ANTES_ANIO]);
});
test('4: deleting a pase into such a year is refused; nothing changes', function(){
  var a = appPaseAnios('2026-10-10'), viejo = {id: 'p1', fecha: '2025-12-20', monto: 300000, anio: 2025, mes: 11, creada: '2025-12-20T00:00:00.000Z'};
  a.T.pases = [viejo];
  var antes = JSON.stringify(a.T);
  a.quitarPase('p1', true);
  assert.equal(JSON.stringify(a.T), antes);
  assert.equal(a.g.aplicados.length, 0);
  assert.deepEqual(a.g.alertas, [['No se puede borrar', 'Lo que pasaste el 20/12/2025 es anterior a Octubre 2026, desde cuando llevás el saldo mes a mes: el saldo con el que arrancaste ya la tiene en cuenta, así que borrarlo haría aparecer plata en Trabajo. No cambié nada.']]);
});
test('4: still allowed: a date from where the balance starts, and any date when no later year has the month-to-month balance', function(){
  var a = appPaseAnios('2026-10-10');
  assert.equal(a.avisoPaseAntes(a.destinoPase()), '');
  a.guardarPase(); assert.equal(a.g.aplicados.length, 1);
  var b = appPaseAnios('2025-12-20', false);
  assert.equal(b.avisoPaseAntes(b.destinoPase()), '');
  b.guardarPase(); assert.equal(b.g.aplicados.length, 1);
});

// ── 5 (MEDIUM, X1 review R3-001) and 6 (LOW): the "Del trabajo" repair (N2-B) and its undo record (kibo.reparoTrabajo.AAAA) ──
var Y26 = 'kibo.datos.2026', REP26 = 'kibo.reparoTrabajo.2026';
function datosRep(){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado');
  C.mes(d, 2, {ingresos: [C.it('Dél trabajo', 1000, false), C.it('Sueldo', 5000, true), C.it('Del trabajo', 2000, true)]});
  C.mes(d, 9, {ingresos: [C.it('Dél trabajo', 100000, false), C.it('Del trabajo', 300000, true)]});
  return d;
}
var FUNCS_REP = ['mesesTrabajoDoble', 'exactoTrabajo', 'planOrdenTrabajo', 'conOrdenTrabajo', 'ordenarTrabajo', 'leerReparo', 'deshacerOrdenTrabajo',
  'guardar', 'copiaDelSiguiente', 'escribirConRev', 'revGuardada', 'blobAlDia', 'esc', 'listaY', 'copiaJSON'];
function appRep(){
  var g = {toasts: [], alertas: [], falla: false};
  var ls = H.fakeStorage({}, function(k){ return g.falla && k === Y26; });
  ls.d[Y26] = JSON.stringify(Object.assign(M.normalizar(C.copy(datosRep()), C.hoy('2026-10-15')), {rev: 1}));
  var a = H.appVista(JSON.parse(ls.d[Y26]), H.trab([{fecha: '2026-10-05', monto: 300000}]), null, '2026-10-15', {funcs: FUNCS_REP, vars: ['MESES', 'LSREPARO', 'LSCUAR', 'LSTRAB', 'LSDIARIO'],
    globals: {localStorage: ls, arrancado: true, tGuardar: null, obsoleta: false, sucio: false, hayLS: true, ultPild: 0,
      estado: function(){}, quitarAvisoVacia: function(){}, pildora: function(){}, avisoCuarentena: function(){}, avisoOtraPestana: function(){},
      toast: function(t){ g.toasts.push(t); }, alerta: function(t, c){ g.alertas.push([t, c]); }, renderTrabajo: function(){},
      document: {getElementById: function(){ return null; }}}});
  a.D.rev = 1; a.g = g; a.ls = ls;
  return a;
}
function filasRep(d, j){ return plain(d.meses[j].ingresos).map(function(x){ return [x.nombre, x.monto, x.pagado]; }); }
test('5: a second repair whose year cannot be saved leaves the undo record exactly as it was (earlier repair of other months kept)', function(){
  var a = appRep();
  assert.equal(a.ordenarTrabajo(), true);                     // repair 1: March and October
  var oct = a.D.meses[9].ingresos;
  oct.reverse(); oct[1].monto = 120000;                        // the user puts October back in the old order and changes the variant
  a.sucio = true; assert.equal(a.guardar(), true);
  var rec = a.ls.d[REP26], anio = a.ls.d[Y26], mem = JSON.stringify(a.D.meses);
  a.g.falla = true;
  assert.equal(a.ordenarTrabajo(), false);
  assert.equal(a.ls.d[REP26], rec, 'the undo record is byte-identical to the one before this repair');
  assert.equal(a.ls.d[Y26], anio, 'the year is as it was');
  assert.equal(JSON.stringify(a.D.meses), mem, 'the open year too');
  a.g.falla = false;
  assert.equal(a.deshacerOrdenTrabajo(), false, 'October changed after repair 1: the undo is refused, nothing lost');
});
test('5: a first repair whose year cannot be saved leaves no undo record', function(){
  var a = appRep();
  a.g.falla = true;
  assert.equal(a.ordenarTrabajo(), false);
  assert.equal(a.ls.d[REP26], undefined);
});
test('6: a second repair after later edits, then «Deshacer»: the later edits are kept (undo goes back to just before that repair)', function(){
  var a = appRep();
  assert.equal(a.ordenarTrabajo(), true);                     // repair 1: March and October
  var oct = a.D.meses[9].ingresos;                             // [Del trabajo 300000 ✓, Dél trabajo 100000 ✗]
  oct.push(C.it('Sueldo', 50000, true));                       // the user adds an income
  oct[0].nombre = 'Dél trabajo'; oct[1].nombre = 'Del trabajo';   // and renames: the exact row is now the second one
  a.sucio = true; assert.equal(a.guardar(), true);
  var antes2 = filasRep(a.D, 9), mar0 = plain(datosRep().meses[2].ingresos).map(function(x){ return [x.nombre, x.monto, x.pagado]; });
  assert.equal(a.ordenarTrabajo(), true);                     // repair 2: October again
  assert.equal(a.deshacerOrdenTrabajo(), true);
  assert.deepEqual(filasRep(a.D, 9), antes2, 'October as right before repair 2: the added Sueldo and the renames are still there');
  assert.deepEqual(filasRep(a.D, 2).map(function(r){ return r[0]; }), mar0.map(function(r){ return r[0]; }), 'March (untouched since repair 1) goes back to its original order');
});

// ── 7 (MEDIUM, security): a backup edited by hand can carry a year or a month as an ARRAY. normalizar took them as objects and the
// stored JSON of an array drops its named fields: every later save silently lost that month (sec2 probe 6) ──
test('7: a month stored as an array is read as an empty month (an object), so what the user types there is saved', function(){
  var raw = C.vacio(2026); raw.meses[0] = [];
  var d = M.normalizar(raw, C.hoy('2026-10-15'));
  assert.equal(Array.isArray(d.meses[0]), false);
  d.meses[0].gastosVariables.push({nombre: 'Pan', monto: 50, pagado: true});
  var back = JSON.parse(JSON.stringify(d));
  assert.deepEqual(back.meses[0].gastosVariables.slice(-1), [{nombre: 'Pan', monto: 50, pagado: true}]);
  assert.equal(M.normalizar([], C.hoy('2026-10-15')).meses.length, 12, 'an array year is read as an empty year, never as an array');
  assert.equal(Array.isArray(M.normalizar([], C.hoy('2026-10-15'))), false);
});
test('7: a restore with a year that is an array does not store it: skipped and reported; the year on the phone stays', function(){
  var y25 = JSON.stringify(Object.assign(C.vacio(2025), {rev: 3}));
  var ls = H.fakeStorage({'kibo.datos.2025': y25}), a = H.appAlmacen(ls, '2026-10-15', {}, ['descTrabajo', 'fARS', 'esc']);
  a.D = a.normalizar(C.vacio(2026), a.hoy);
  var meses = []; for(var i = 0; i < 12; i++) meses.push([]);
  a.restaurarTexto(JSON.stringify({app: 'TuGasto', version: 1, anios: {'2025': [], '2026': {anio: 2026, meses: meses}}}));
  a.pendiente();
  assert.equal(ls.d['kibo.datos.2025'], y25, '2025 untouched');
  var y26 = JSON.parse(ls.d['kibo.datos.2026']);
  assert.equal(y26.meses.length, 12);
  assert.equal(y26.meses.every(function(m){ return !Array.isArray(m) && Array.isArray(m.ingresos); }), true, 'array months stored as months');
  assert.equal(a.g.alertas.length, 1);
  assert.match(a.g.alertas[0][1], /Salteé lo que no es un año válido: <b>2025<\/b>/);
});

// ── 8 (MEDIUM, security): restore copied ANY string of the backup's `cuarentena` into kibo.cuarentena.*, a key the app never deletes:
// a 4.4 MB text filled the storage and every later save failed (sec2 probe 4). Each text is capped at 2 MB and the backup's total at 4 MB ──
function restaurarCuar(cuar, previa){
  var ls = H.fakeStorage(previa || {}), a = H.appAlmacen(ls, '2026-10-15', {}, ['descTrabajo', 'fARS', 'esc']);
  a.D = a.normalizar(C.vacio(2026), a.hoy);
  a.restaurarTexto(JSON.stringify({app: 'TuGasto', version: 1, anios: {'2026': C.vacio(2026)}, cuarentena: cuar}));
  a.pendiente();
  return {ls: ls, a: a};
}
var MB = 1024 * 1024;
function corto(t){ return typeof t === 'string' && t.length > 40 ? t.length + ' chars' : t; }   // a failing assert never prints megabytes
test('8: a quarantine text over 2 MB is not imported and is named in the restore message; a small one still comes back', function(){
  var r = restaurarCuar({'2026': 'Q'.repeat(2 * MB + 1), '2025': 'roto'});
  assert.equal(corto(r.ls.d['kibo.cuarentena.2026']), undefined, 'the oversized text is not stored');
  assert.equal(r.ls.d['kibo.cuarentena.2025'], 'roto', 'the small one is imported');
  assert.equal(r.a.g.alertas.length, 1);
  assert.match(r.a.g.alertas[0][1], /No traje los datos apartados \(los que no se pudieron leer\) de <b>2026<\/b>: son demasiado grandes\./);
  assert.match(r.a.g.alertas[0][1], /Lo demás de la copia quedó guardado/);
});
test('8: the texts of one backup add up to 4 MB at most: the one that would pass it is not imported and named; exactly 2 MB is accepted', function(){
  var r = restaurarCuar({'2024': 'a'.repeat(2 * MB), '2025': 'b'.repeat(1.5 * MB), 'trabajo': 'c'.repeat(MB), '2023': 'd'.repeat(0.5 * MB)});
  assert.equal(r.ls.d['kibo.cuarentena.2024'].length, 2 * MB);
  assert.equal(r.ls.d['kibo.cuarentena.2025'].length, 1.5 * MB);
  assert.equal(corto(r.ls.d['kibo.cuarentena.trabajo']), undefined, '2 + 1.5 + 1 MB would pass the 4 MB total');
  assert.equal(r.ls.d['kibo.cuarentena.2023'].length, 0.5 * MB, 'a later text that still fits the total is imported');
  assert.match(r.a.g.alertas[0][1], /de <b>trabajo<\/b>: son demasiado grandes/);
});
test('8: the quarantine already on the phone is never deleted or replaced, even when the backup brings an oversized text for that key', function(){
  var r = restaurarCuar({'2026': 'Q'.repeat(3 * MB), '2026.2': 'otro'}, {'kibo.cuarentena.2026': 'viejo'});
  assert.equal(corto(r.ls.d['kibo.cuarentena.2026']), 'viejo');
  assert.equal(corto(r.ls.d['kibo.cuarentena.2026.2']), 'otro', 'the small text goes next to it, as before');
  assert.match(r.a.g.alertas[0][1], /de <b>2026<\/b>: son demasiado grandes/);
});
