'use strict';
// R4.2 builders: raw year blobs for the new financial model (design doc section 2 and friends). Plain JS, no engine here.
// Each builder returns a RAW blob (call motor.normalizar(copy, hoy) before use; pagoExplicito is already true).

function hoy(iso){ var p = iso.split('-'); return {anio: +p[0], mes: +p[1] - 1, dia: +p[2], iso: iso}; }
function it(n, m, p){ return {nombre: n, monto: m, pagado: !!p}; }
function copy(x){ return JSON.parse(JSON.stringify(x)); }

function vacio(anio){
  var meses = [], i;
  for(i = 0; i < 12; i++) meses.push({});
  return {anio: anio || 2026, pagoExplicito: true, ahorroAnioAnterior: 0, usdAnioAnterior: 0, aReponerAnterior: 0, cotizacionUSD: 1500, cotizacionFecha: '2026-10-01',
    cripto: [], meses: meses, planDeudas: {}};
}
function mes(d, j, o){ Object.keys(o).forEach(function(k){ d.meses[j][k] = o[k]; }); return d; }
function arrastre(d, desde, apertura, origen, extra){
  d.arrastre = {desde: desde, inicial: {apertura: apertura, declarado: apertura, declaradoEl: '2026-09-01', origen: origen || 'declarado', calculadoOrigen: null}};
  if(extra) Object.keys(extra).forEach(function(k){ d.arrastre.inicial[k] = extra[k]; });
  return d;
}

// Section 2 of the contract. oct/nov: are the pending rows of October / November ticked (paid)?
function seccion2(oct, nov){
  var d = vacio(2026);
  d.ahorroAnioAnterior = 500000; d.usdAnioAnterior = 1000;
  d.planDeudas = {'Préstamo': {total: 600000, recargo: 0, cuotas: 6, pagadasAntes: 2}};
  arrastre(d, 8, 50000, 'declarado');
  mes(d, 8, {ingresos: [it('Sueldo', 1000000, true)], gastosFijos: [it('Alquiler', 400000, true), it('Luz', 20000, false)],
    gastosVariables: [it('Supermercado', 200000, true)], deudas: [it('Préstamo', 100000, true)], ahorroMesARS: 150000,
    cierreReal: {valor: 175000, calculadoAlConfirmar: 200000, confirmadoEl: '2026-10-01'}});
  mes(d, 9, {ingresos: [it('Sueldo', 1000000, true)], gastosFijos: [it('Alquiler', 400000, true), it('Luz', 25000, oct)],
    gastosVariables: [it('Supermercado', 120000, oct)], deudas: [it('Préstamo', 100000, oct)], retiroARS: 50000});
  mes(d, 10, {ingresos: [it('Sueldo', 1000000, !!nov)], deudas: [it('Préstamo', 100000, !!nov)], ahorroMesARS: 200000});
  return d;
}

module.exports = {hoy: hoy, it: it, copy: copy, vacio: vacio, mes: mes, arrastre: arrastre, seccion2: seccion2};
