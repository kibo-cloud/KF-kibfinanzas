'use strict';
// R4.5 harness: the app loaded with a fake localStorage, reusing the exact stubs of tests/r4.migracion.test.js (storage layer) and
// tests/r4.integracion.test.js (screen view model). No engine logic lives here.
var la = require('../load-app');
var C = require('./r4-casos');

function fakeStorage(init, rechaza){
  var d = {}, log = [];
  Object.keys(init || {}).forEach(function(k){ d[k] = init[k]; });
  return {
    d: d, log: log,
    get length(){ return Object.keys(d).length; },
    key: function(i){ var k = Object.keys(d)[i]; return k === undefined ? null : k; },
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function(k, v){ if(rechaza && rechaza(k)) throw new Error('QuotaExceededError'); log.push(k); d[k] = String(v); },
    removeItem: function(k){ delete d[k]; }
  };
}

// a Trabajo store with one collected payment and the given pases ({fecha, monto})
function trab(pases, cobrado){
  return {facturas: [], cobros: [{id: 'c1', cliente: '', monto: cobrado || 1000000, fecha: '2026-01-01', forma: 'transferencia', aplic: [], creada: ''}],
    gastos: [], productos: [], tope: 0,
    pases: (pases || []).map(function(p, i){ return {id: 'p' + i, fecha: p.fecha, monto: p.monto, anio: +p.fecha.slice(0, 4), mes: +p.fecha.slice(5, 7) - 1}; })};
}
var TRAB_VACIO = {facturas: [], cobros: [], pases: [], gastos: [], productos: [], tope: 0};

// ── screen view model (month card, Trabajo, net worth): same function list as tests/r4.integracion.test.js ──
var FUNCS_VISTA = ['dos', 'leerAnio', 'ctxModelo', 'cierreAnioAnterior', 'vistaModelo', 'tilesMes', 'mesDelModelo', 'tieneTilde', 'repartoTrabajo', 'pasesDelMes',
  'hoyISO', 'esISO', 'utcDe', 'sumarDias', 'diasEntre', 'ganancia', 'saldoFac', 'venceFac', 'sinAsignar', 'tieneTrab', 'resumenTrab',
  'paseAlModelo', 'trabajoDisponible', 'patrimonioPantalla'];
function appVista(d, T, otros, today, extra){
  var g = {localStorage: fakeStorage(otros || {})};
  Object.keys(extra && extra.globals || {}).forEach(function(k){ g[k] = extra.globals[k]; });
  var app = la.loadApp({today: today || '2026-10-15', funcs: FUNCS_VISTA.concat(extra && extra.funcs || []), vars: ['PREF'].concat(extra && extra.vars || []), globals: g});
  app.T = T || C.copy(TRAB_VACIO);
  app.D = d ? app.normalizar(C.copy(d), app.hoy) : null;
  return app;
}
function tiles(app, j){ return app.plain(app.tilesMes(app.D, j, app.vistaModelo(app.D, app.hoy))); }

// ── storage layer (save, revisions, backup/restore, duplicar, activarSaldos): same stubs as tests/r4.migracion.test.js ──
var FUNCS_ALMACEN = ['claveMia', 'dos', 'revGuardada', 'claveCuarentena', 'ponerEnCuarentena', 'cuarentenaAntesDeBorrar', 'avisoCuarentena', 'esc', 'escribirConRev', 'avisoOtraPestana', 'hayEdicion', 'alCambiarOtraPestana', 'recargarDesdeAlmacenamiento',
  'asegurarSnapshotR4', 'respaldoR4', 'diasDelRespaldoR4', 'vencerRespaldoR4', 'volverAntesDeR4', 'ctxModelo', 'cierreAnioAnterior', 'activarSaldos',
  'guardar', 'guardarTrab', 'blobAlDia', 'leerAnio', 'aniosGuardados', 'normTrab', 'leerTrab', 'esISO', 'utcDe', 'hoyISO', 'formaValida', 'anioValido', 'escribirAnios', 'armarCopia', 'restaurarTexto', 'avisoCopiaGrande', 'duplicar', 'avisarRestauro',
  'escribirJuntos', 'diarioValido', 'apartarDiario', 'recuperarDiario', 'avisoDiario', 'sinTaparCuarentena', 'sumarPaseT', 'sacarPaseT'];
var VARS_ALMACEN = ['PREF', 'LSANIO', 'LSCOPIA', 'LSOCULTO', 'LSBIENV', 'LSHIST', 'LSTRAB', 'LSVISTA', 'LSR4', 'LSAVCIERRE', 'LSDATOSDESDE', 'LSCOPIAPOS', 'CLAVES_PROPIAS', 'sucio', 'arrancado', 'obsoleta', 'pendiente', 'FORMAS', 'MAX_COPIA', 'LSCUAR', 'LSDIARIO'];
function appAlmacen(ls, today, extra, funcsExtra){
  var g = {localStorage: ls, pildoras: [], recargas: 0, renders: 0, alertas: [], hojas: [], ultPild: 0};
  g.avisos = {innerHTML: '', textContent: ''};
  g.document = {activeElement: null, getElementById: function(id){ return id === 'avisos' ? g.avisos : null; }};
  g.velo = {classList: {contains: function(){ return false; }}};
  g.pildora = function(t, mal){ g.pildoras.push([t, !!mal]); };
  g.estado = function(){}; g.quitarAvisoVacia = function(){}; g.marcarVencidos = function(){}; g.aplicarModo = function(){}; g.recordarAnio = function(){};
  g.render = function(){ g.renders++; };
  g.alerta = function(t, c){ g.alertas.push([t, c]); };
  g.abrirHoja = function(h){ g.hojas.push(h); };
  g.confirmar = function(t, c, e, fn){ fn(); };
  g.location = {reload: function(){ g.recargas++; }};
  g.cargar = function(){}; g.toast = function(){}; g.tieneTrab = function(){ return false; };
  Object.keys(extra || {}).forEach(function(k){ g[k] = extra[k]; });
  var funcs = FUNCS_ALMACEN.concat((funcsExtra || []).filter(function(n){ return FUNCS_ALMACEN.indexOf(n) < 0; })).filter(function(n){ return !(n in g); });   // a stub passed by the test replaces the real function (esISO..FORMAS: normTrab needs them; leerTrab would swallow the error and return an EMPTY store)
  var app = la.loadApp({today: today || '2026-10-15', funcs: funcs, vars: VARS_ALMACEN, globals: g});
  app.T = app.normTrab(null);
  app.g = g; app.arrancado = true;
  return app;
}
function guardado(ls, anio){ return JSON.parse(ls.d['kibo.datos.' + anio]); }
function cargarEn(app, ls, anio){ app.D = app.normalizar(JSON.parse(ls.d['kibo.datos.' + anio]), app.hoy); return app.D; }
function sinModelo(raw){ delete raw.arrastre; raw.meses.forEach(function(m){ delete m.cierreReal; }); return raw; }

module.exports = {fakeStorage: fakeStorage, trab: trab, TRAB_VACIO: TRAB_VACIO, appVista: appVista, tiles: tiles, appAlmacen: appAlmacen,
  guardado: guardado, cargarEn: cargarEn, sinModelo: sinModelo};
