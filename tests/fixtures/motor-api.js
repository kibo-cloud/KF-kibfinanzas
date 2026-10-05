'use strict';
// Adapter: gives the golden corpus one uniform, explicit-argument API over the engine.
var loadApp = require('../load-app').loadApp;
var corpus = require('./motor-corpus');

var FUNCS = ['num', 'sinSigno', 'cerosFuera', 'parseMonto', 'parseCantidad', 'parsePct', 'parseEntero', 'parcial', 'suma', 'sumaPagado', 'clave', 'esRenglonTrabajo',
  'estaPagado', 'cuotaPaga', 'alternarPago', 'sumarAItem', 'calc', 'serie', 'costoDolares', 'criptoUSD', 'patrimonio', 'ranking', 'datosTorta', 'gastadoTope',
  'repartoCuotas', 'totalConRecargo', 'valorCuota', 'mesTope', 'mesesCorridos', 'planDe', 'estadoDeuda', 'pagadasHasta', 'pendientesDesde', 'planDeCarga',
  'proyeccionDeudas', 'cargarCuotas', 'hayDatos', 'mesVacio', 'normalizar'];

function build(){
  var trab = false;
  var app = loadApp({today: corpus.TODAY, funcs: FUNCS, vars: ['TORTA_MAX', 'TOPEABLE'], globals: {tieneTrab: function(){ return trab; }}});
  var api = {
    SECS: app.SECS, MARCABLE: app.MARCABLE, RENGLON_TRABAJO: app.RENGLON_TRABAJO, TORTA_MAX: app.TORTA_MAX, TOPEABLE: app.TOPEABLE,
    num: app.num, parseMonto: app.parseMonto, parseCantidad: app.parseCantidad, parsePct: app.parsePct, parseEntero: app.parseEntero, parcial: app.parcial,
    suma: app.suma, sumaPagado: app.sumaPagado, clave: app.clave, esRenglonTrabajo: app.esRenglonTrabajo, estaPagado: app.estaPagado,
    cuotaPaga: app.cuotaPaga, alternarPago: app.alternarPago, sumarAItem: app.sumarAItem, calc: app.calc, serie: app.serie,
    costoDolares: app.costoDolares, criptoUSD: app.criptoUSD, patrimonio: app.patrimonio, ranking: app.ranking,
    repartoCuotas: app.repartoCuotas, totalConRecargo: app.totalConRecargo, valorCuota: app.valorCuota,
    mesTope: app.mesTope, mesesCorridos: app.mesesCorridos, mesVacio: app.mesVacio, normalizar: app.normalizar,
    // functions that read the globals D / mes: set them first
    datosTorta: function(m, j){ app.mes = j; return app.datosTorta(m); },
    gastadoTope: function(it, j){ app.mes = j; return app.gastadoTope(it); },
    planDe: function(d, n){ app.D = d; return app.planDe(n); },
    estadoDeuda: function(d, n, i){ app.D = d; return app.estadoDeuda(n, i); },
    pagadasHasta: function(d, n, h){ app.D = d; return app.pagadasHasta(n, h); },
    pendientesDesde: function(d, n, h){ app.D = d; return app.pendientesDesde(n, h); },
    planDeCarga: function(d, n, h){ app.D = d; return app.planDeCarga(n, h); },
    cargarCuotas: function(d, n, h){ app.D = d; return app.cargarCuotas(n, h); },
    proyeccionDeudas: function(d){ app.D = d; return app.proyeccionDeudas(); },
    hayDatos: function(d, t){ app.D = d; trab = !!t; return app.hayDatos(); }
  };
  return api;
}

module.exports = {build: build};
