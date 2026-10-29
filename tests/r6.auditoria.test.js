'use strict';
// D9 (owner-decisions-closure): findings of the independent audit of dd6a132..1.34.0, one test per finding (A1..A9). Each was first
// reproduced here (RED) before its fix. A10 (duplicated sheet code) is a follow-up, not a behavior: no test.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var V = require('./fixtures/anio-vistas');

var M = la.loadMotor();
var SRC = la.SRC_FOR_TESTS;
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function existe(n){ return new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC); }
function filas(l){ return plain(l).map(function(it){ return [it.nombre, it.monto, it.pagado]; }); }

// ── A1: repartoTrabajo (checkbox, "Falta", due list, "viene de Trabajo") must split the pases exactly like flujosMes (the money) ──
function appTrab(ingresos){
  var d = C.vacio(2026); C.arrastre(d, 9, 0, 'declarado'); C.mes(d, 9, {ingresos: ingresos});
  return H.appVista(d, H.trab([{fecha: '2026-10-05', monto: 300000}]));
}
// realized / pending income of the month as the screen reads it row by row (repartoTrabajo for "Del trabajo" rows)
function porRenglon(a){
  var real = 0, pend = 0;
  a.D.meses[9].ingresos.forEach(function(it){
    var r = a.repartoTrabajo(a.D, 9, it), mo = r ? r.exceso : M.num(it.monto);
    if(it.pagado === true) real += mo; else pend += mo;
  });
  return [real, pend];
}
test('A1 repartoTrabajo gives the pase to the single exact «Del trabajo» row first, like flujosMes', function(){
  var a = appTrab([C.it('Dél trabajo', 100000, false), C.it('Del trabajo', 300000, true)]), ls = a.D.meses[9].ingresos;
  assert.deepEqual(plain(ls.map(function(it){ return a.repartoTrabajo(a.D, 9, it); })), [{pases: 0, exceso: 100000}, {pases: 300000, exceso: 0}],
    'before: the variant took 100.000 of the pase and the exact row showed 100.000 above its pases');
  assert.deepEqual([a.tieneTilde(a.D, 9, 'ingresos', ls[0]), a.tieneTilde(a.D, 9, 'ingresos', ls[1])], [true, false],
    'the unticked variant is pending money with its own checkbox; the exact row is all pase');
  var casos = [
    [C.it('Dél trabajo', 100000, false), C.it('Del trabajo', 300000, true)],
    [C.it('Dél trabajo', 100000, true), C.it('Del trabajo', 300000, false)],
    [C.it('Dél trabajo', 100000, false), C.it('Sueldo', 50000, true), C.it('Del trabajo', 200000, true)],
    [C.it('Del trabajo', 300000, true), C.it('Dél trabajo', 100000, false)],
    [C.it('Dél trabajo', 100000, false), C.it('del trabajo ', 300000, true), C.it('DEL TRABAJO', 50000, true)],
    [C.it('Dél trabajo', 100000, false), C.it('Del Trabájo', 300000, true)],
    [C.it('Del trabajo', 500000, false), C.it('Sueldo', 80000, false)]
  ];
  casos.forEach(function(ing, n){
    var b = appTrab(ing), f = plain(M.flujosMes(b.D, 9, b.hoy, b.vistaModelo(b.D, b.hoy).ctx));
    assert.deepEqual(porRenglon(b), [f.ingresosReal, f.ingresosPend], 'case ' + n + ': the rows add up to the engine');
  });
  assert.match(la.extractFunction('flujosMes'), /repartoPases\(/, 'one allocation, shared');
  assert.match(la.extractFunction('repartoTrabajo'), /repartoPases\(/, 'one allocation, shared');
});

// ── A2 / A5: partial payment (D2) ──
var FUNCS_GR = ['sumarGasto', 'quitarMov', 'esc', 'fARS', 'grupos', 'preguntaPago', 'preguntarPago', 'gastoEsPago', 'marcarPago', 'gastoAparte', 'pagoParcial',
  'filaDelGasto', 'anotarMov', 'renglonLibre', 'esGastoAparte', 'copiarAnterior'];
function appGasto(ls){
  var d = C.vacio(2026); C.arrastre(d, 9, 100000, 'declarado'); C.mes(d, 9, {gastosFijos: ls});
  var toasts = [];
  var a = H.appVista(d, null, null, null, {funcs: FUNCS_GR, vars: ['gr', 'MESES'],
    globals: {oculto: false, PUNTOS: '..', document: {getElementById: function(){ return null; }},
      abrirHoja: function(){}, cerrarHoja: function(){}, tocar: function(){}, conScroll: function(){}, renderMes: function(){}, toast: function(t){ toasts.push(t); }}});
  a.toasts = toasts;
  return a;
}
function parcial(a, monto){ a.gr = {monto: monto, cat: 0, sec: 'gastosFijos'}; a.sumarGasto(); a.gastoEsPago(); a.pagoParcial(); }

test('A2 copying the month after a partial payment copies the planned amount, not the leftover', function(){
  var a = appGasto([C.it('Alquiler', 100000, false)]);
  parcial(a, 40000);
  assert.deepEqual(filas(a.D.meses[9].gastosFijos), [['Alquiler', 60000, false], ['Alquiler (pago parcial)', 40000, true]]);
  a.mes = 10; a.copiarAnterior('gastosFijos');
  assert.deepEqual(filas(a.D.meses[10].gastosFijos), [['Alquiler', 100000, false]], 'before: 60.000 (the leftover); the paid part is not copied');
  var n = plain(M.normalizar(plain(a.D), C.hoy('2026-10-15')));
  assert.equal(n.meses[9].gastosFijos[0].montoPlan, 100000, 'the planned amount is kept when the year is read again');
  assert.equal('montoPlan' in n.meses[9].gastosFijos[1], false, 'no key on rows without it');
  var b = appGasto([C.it('Alquiler', 100000, false)]), antes = plain(b.D.meses[9]);
  parcial(b, 40000); parcial(b, 10000);
  assert.equal(b.D.meses[9].gastosFijos[0].montoPlan, 100000, 'a second part keeps the first planned amount');
  b.quitarMov(b.D.meses[9].movimientos[1].id); b.quitarMov(b.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(b.D.meses[9]), antes, 'undoing every part leaves the row exactly as it was (no montoPlan)');
  assert.match(SRC, /delete it\.montoPlan/, 'typing a new amount drops the stored plan amount');
  assert.match(la.extractFunction('duplicar'), /delete m\[k\]\[q\]\.montoPlan/, 'a new year starts without it');
});

test('A5 undoing a partial payment refuses when the planned row changed after it (ticked or edited); later parts do not block it', function(){
  var a = appGasto([C.it('Alquiler', 100000, false)]);
  parcial(a, 40000);
  a.D.meses[9].gastosFijos[0].pagado = true;   // the rest was paid
  var antes = plain(a.D.meses[9]);
  a.quitarMov(a.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(a.D.meses[9]), antes, 'before: Alquiler showed 100.000 paid');
  assert.match(a.toasts[a.toasts.length - 1], /^No pude deshacer: Alquiler cambió después de ese pago/);
  var b = appGasto([C.it('Alquiler', 100000, false)]);
  parcial(b, 40000);
  b.D.meses[9].gastosFijos[0].monto = 70000;   // edited by hand
  var antesB = plain(b.D.meses[9]);
  b.quitarMov(b.D.meses[9].movimientos[0].id);
  assert.deepEqual(plain(b.D.meses[9]), antesB);
  var c = appGasto([C.it('Alquiler', 100000, false)]);
  parcial(c, 40000); parcial(c, 20000);
  c.quitarMov(c.D.meses[9].movimientos[0].id);   // the first part, while the second is still there
  assert.deepEqual(filas(c.D.meses[9].gastosFijos), [['Alquiler', 80000, false], ['Alquiler (pago parcial)', 20000, true]], 'still adds up to 100.000');
  var n = plain(M.normalizar(plain(c.D), C.hoy('2026-10-15')).meses[9].movimientos[0]);
  assert.equal(n.rr, 40000, 'the leftover at split time is kept by normalizar');
});

// ── A3 / A4 / A7: quarantine (D6 / D7) ──
function appCuar(store, rechaza){
  var ls = H.fakeStorage(store, rechaza), avisos = {innerHTML: ''}, pedidos = [];
  var a = la.loadApp({today: '2026-10-15', funcs: ['revGuardada', 'revValida', 'claveCuarentena', 'ponerEnCuarentena', 'avisoCuarentena', 'revisarTrabajoIlegible', 'esc',
    'clavesCuarentena', 'nombreCuarentena', 'pedirBorrarCuarentena', 'borrarCuarentena'],
    vars: ['LSCUAR', 'LSTRAB', 'LSDIARIO', 'PREF'],
    globals: {localStorage: ls, tab: 'x', document: {getElementById: function(id){ return id === 'avisos' ? avisos : null; }},
      confirmar: function(t, cuerpo){ pedidos.push(cuerpo); }, toast: function(){}, renderAjustes: function(){}}});
  a.ls = ls; a.avisos = avisos; a.pedidos = pedidos;
  return a;
}
test('A3 «Descargar el texto» points at the copy actually written (.2, .3…), and is not offered when nothing was kept', function(){
  var a = appCuar({'kibo.cuarentena.trabajo': 'texto viejo', 'kibo.trabajo': '{roto'});
  a.revisarTrabajoIlegible();
  assert.equal(a.ls.d['kibo.cuarentena.trabajo.2'], '{roto');
  assert.match(a.avisos.innerHTML, /data-act="cuarDescargar" data-k="kibo\.cuarentena\.trabajo\.2">/, 'before: data-k="kibo.cuarentena.trabajo" (the old text)');
  var b = appCuar({'kibo.cuarentena.2026': 'viejo', 'kibo.datos.2026': '[1'});
  assert.ok(b.ponerEnCuarentena('kibo.datos.2026', '[1'));
  b.avisoCuarentena(2026);
  assert.match(b.avisos.innerHTML, /data-k="kibo\.cuarentena\.2026\.2">Descargar el texto/);
  var c = appCuar({'kibo.datos.2026': '[1'}, function(){ return true; });
  c.avisoCuarentena(2026);
  assert.doesNotMatch(c.avisos.innerHTML, /cuarDescargar/, 'no copy on this phone: nothing to download');
  assert.match(c.avisos.innerHTML, /data-act="restaurar"/);
  var d = appCuar({'kibo.trabajo': '{roto'}, function(){ return true; });
  d.revisarTrabajoIlegible();
  assert.doesNotMatch(d.avisos.innerHTML, /cuarDescargar/);
});

test('A4 the unreadable-Trabajo notice is shown once, however many times the year is loaded again', function(){
  var a = appCuar({'kibo.trabajo': '{roto'});
  a.revisarTrabajoIlegible(); a.revisarTrabajoIlegible(); a.revisarTrabajoIlegible();
  assert.equal((a.avisos.innerHTML.match(/data-av="cuarentena-trabajo"/g) || []).length, 1, 'before: 3');
  var b = appCuar({'kibo.trabajo': '{roto'});
  b.avisos.innerHTML = '<div class="aviso" data-av="otro"><p>Otro</p></div>';
  b.revisarTrabajoIlegible(); b.revisarTrabajoIlegible();
  assert.match(b.avisos.innerHTML, /^<div class="aviso" data-av="otro"><p>Otro<\/p><\/div><div class="aviso" data-av="cuarentena-trabajo">/, 'other notices stay');
  assert.equal((b.avisos.innerHTML.match(/data-av="cuarentena-trabajo"/g) || []).length, 1);
});

test('A7 the same text is never copied twice, even after the first copy was deleted; deleting says when it comes back', function(){
  var a = appCuar({'kibo.cuarentena.trabajo.2': 'T', 'kibo.cuarentena.trabajo.3': 'U'});
  assert.equal(a.ponerEnCuarentena('kibo.trabajo', 'U'), 'kibo.cuarentena.trabajo.3');
  assert.equal('kibo.cuarentena.trabajo' in a.ls.d, false, 'before: a duplicate of U went to the free base key');
  assert.equal(a.ponerEnCuarentena('kibo.trabajo', 'V'), 'kibo.cuarentena.trabajo', 'a new text takes the first free slot');
  assert.deepEqual(Object.keys(a.ls.d).sort(), ['kibo.cuarentena.trabajo', 'kibo.cuarentena.trabajo.2', 'kibo.cuarentena.trabajo.3']);
  var b = appCuar({'kibo.cuarentena.trabajo': '{roto', 'kibo.trabajo': '{roto', 'kibo.cuarentena.2026': 'viejo', 'kibo.datos.2026': '{"anio":2026,"meses":[]}'});
  b.pedirBorrarCuarentena('kibo.cuarentena.trabajo');
  assert.match(b.pedidos[0], /Trabajo todavía no se puede leer: la próxima vez que abras la app se vuelve a apartar\./);
  b.pedirBorrarCuarentena('kibo.cuarentena.2026');
  assert.doesNotMatch(b.pedidos[1], /se vuelve a apartar/, 'a copy of text that is no longer stored does not come back');
});

// ── A6: N1-B (b) corrects 1.33 data in the live carry; it is said, not silent ──
var FUNCS_A6 = V.FUNCS.concat(['resumenTrab', 'paseAlModelo', 'trabajoDisponible', 'patrimonioPantalla', 'tieneTrab', 'hoyISO', 'esISO', 'utcDe',
  'sumarDias', 'diasEntre', 'ganancia', 'saldoFac', 'venceFac', 'sinAsignar', 'repartoTrabajo', 'pasesDelMes', 'tieneTilde', 'modoApertura',
  'derivaAnioPrevio', 'avisoDerivaPrevio', 'previoEnVivo', 'arrastreVivo', 'carryDiciembre', 'cuotasProgramadas', 'cuotasDeMas', 'cuotasRealizadas',
  'esProgramado', 'mesDelModelo'])
  .filter(function(n, i, a){ return a.indexOf(n) === i && existe(n); });
var VARS_A6 = ['PREF', 'MESES', 'CORTOS', 'oculto', 'PUNTOS', 'ICOSEC', 'MAS_QUE_LO_NORMAL', 'TOP_CATEGORIAS', 'FORMAS', 'CATS', 'COLCARP'];
function vista27(store, today){
  var app = la.loadApp({today: today, funcs: FUNCS_A6, vars: VARS_A6,
    globals: {localStorage: H.fakeStorage(store), document: {getElementById: function(){ return null; }}, descargar: function(){}}});
  app.T = C.copy(H.TRAB_VACIO);
  app.D = app.leerAnio(2027);
  return app;
}
test('A6 a year created under 1.33 counted an installment ticked ahead; the live carry corrects it and the month says why', function(){
  var raw = C.seccion2(false, false);
  raw.meses[10].deudas.forEach(function(x){ if(x.nombre === 'Préstamo') x.pagado = true; });   // November ticked ahead
  var y26 = M.normalizar(C.copy(raw), C.hoy('2026-10-15')), ls = H.fakeStorage({'kibo.datos.2026': JSON.stringify(y26)}), app = H.appAlmacen(ls, '2026-10-15');
  H.cargarEn(app, ls, 2026); app.duplicar();
  var n = JSON.parse(ls.d['kibo.datos.2027']);
  n.planDeudas['Préstamo'].pagadasAntes = 4; n.copiaDiciembre.cuotas['Préstamo'] = 4;   // what 1.33 wrote
  var store = {'kibo.datos.2026': ls.d['kibo.datos.2026'], 'kibo.datos.2027': JSON.stringify(n)};
  var a = vista27(store, '2026-10-20');
  assert.equal(a.D.planDeudas['Préstamo'].pagadasAntes, 3, 'kept (owner decision N1-B b): only realized months count');
  var h = a.avisoDerivaPrevio(a.D, a.hoy);
  assert.match(h, /data-av="cuotasAdelante"[^]*Préstamo[^]*noviembre de 2026/, 'before: no word about the change');
  var b = vista27(store, '2027-01-10');
  assert.equal(b.D.planDeudas['Préstamo'].pagadasAntes, 4, 'once November arrives it counts');
  assert.doesNotMatch(b.avisoDerivaPrevio(b.D, b.hoy), /cuotasAdelante/, 'nothing ahead any more: no notice');
});

// ── A8: an installment row without its own day shows its plan's day, as the due list does ──
test('A8 the row note uses the same day as «Qué vence esta semana» (the plan day for installments)', function(){
  var a = la.loadApp({funcs: ['diaVence'].concat(existe('notaVence') ? ['notaVence'] : [])});
  var raw = C.seccion2(false, false); raw.planDeudas['Préstamo'].vence = 10;
  var d = M.normalizar(C.copy(raw), C.hoy('2026-10-15')), cuota = d.meses[9].deudas.filter(function(x){ return x.nombre === 'Préstamo'; })[0];
  assert.equal(typeof a.notaVence, 'function', 'before: the note read only it.vence (installments showed nothing)');
  assert.equal(a.notaVence(d, 'deudas', cuota), '<div class="nota dvence">Vence el día 10</div>');
  assert.equal(a.notaVence(d, 'gastosFijos', {nombre: 'Luz', vence: 5}), '<div class="nota dvence">Vence el día 5</div>');
  assert.equal(a.notaVence(d, 'gastosFijos', {nombre: 'Luz'}), '');
  assert.equal(a.notaVence(d, 'ingresos', {nombre: 'Sueldo', vence: 5}), '');
  assert.match(la.extractFunction('seccion'), /notaVence\(D, S\.k, lista\[i\]\)/);
});

// ── A9: a day outside 1..31 in the plan sheet is named as such, not as "not a number" ──
function formulario(valores){
  var els = {};
  Object.keys(valores).forEach(function(id){ els[id] = {value: valores[id], classList: {add: function(){}, remove: function(){}}}; });
  return {getElementById: function(id){ return els[id] || null; }};
}
test('A9 the plan sheet says the due day goes from 1 to 31', function(){
  function msj(v){
    var a = la.loadApp({funcs: ['parseEntero', 'parsePct', 'parcial', 'marcarErr', 'leerPlan', 'leerDiaVence', 'esc'].concat(existe('textoMalPlan') ? ['textoMalPlan'] : []),
      globals: {document: formulario({plTotal: '100.000', plCuotas: '3', plRec: '0', plAntes: '0', plVence: v})}});
    assert.equal(typeof a.textoMalPlan, 'function', 'before: «No entendí «40» como número.»');
    return a.textoMalPlan(a.leerPlan(true));
  }
  assert.equal(msj('40'), 'El día tiene que ser un número del 1 al 31 (o vacío).');
  assert.equal(msj('0'), 'El día tiene que ser un número del 1 al 31 (o vacío).');
  var b = la.loadApp({funcs: ['parseEntero', 'parsePct', 'parcial', 'marcarErr', 'leerPlan', 'leerDiaVence', 'esc'].concat(existe('textoMalPlan') ? ['textoMalPlan'] : []),
    globals: {document: formulario({plTotal: '1x<b>', plCuotas: '3'})}});
  assert.equal(b.textoMalPlan(b.leerPlan(true)), 'No entendí «1x&lt;b&gt;» como número.', 'other fields: as before, escaped');
  assert.equal((SRC.match(/(?<!function )textoMalPlan\(l[pt]\)/g) || []).length, 2, 'preview and save use it');
});
