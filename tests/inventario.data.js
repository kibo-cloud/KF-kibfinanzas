'use strict';
// D13 consumer inventory: every top-level function in index.html (both inline blocks: the engine in <script id="motor">
// since R3, and the app script; the semantics below did not change with the move) whose body reads `.monto`
// or calls suma/sumaPagado/calc/serie, with its CURRENT semantic (documentation of today's
// behavior, known bugs included; classification is NOT a statement of what is correct).
//   registrado = counts every loaded amount, paid or not (suma)
//   realizado  = counts only ticked/paid amounts (sumaPagado, estaPagado)
//   mixto      = uses both (realized totals plus pending/registered totals, or a stock built from them)
//   r4         = new financial model (R4.2): explicit realizado/pendiente/programado split by hoy, see odd/tasks/repair-sprint-1-r4-design.md
//   otro       = no money aggregation of the monthly plan: editors/writers of one item, display of one
//                row, the separate "Trabajo" ledger, or a false positive of the scanner
var R = 'registrado', Z = 'realizado', M = 'mixto', O = 'otro', N = 'r4';
var EDIT = 'editor/writer of a single item amount; no aggregation';
var TRAB = 'Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics';

module.exports = {
  SEMANTICS: [R, Z, M, O, N],
  INVENTORY: {
    normalizar:         [O, 'input normalization; migration default pagado = monto > 0 for past months'],
    suma:               [R, 'sums every loaded amount, paid or not'],
    sumaPagado:         [Z, 'sums only pagado === true (plus "Del trabajo" income rows)'],
    calc:               [M, 'realized totals (sumaPagado) plus pending totals (suma - sumaPagado) and savings flows'],
    serie:              [M, 'calc() per month plus accumulated savings/USD/aReponer stock'],
    cobroTxt:           [O, 'displays one item amount split by number of payments'],
    cuotaPaga:          [Z, 'E9 (R2): an installment counts as paid only when the debt row is ticked AND monto > 0'],
    cargarCuotas:       [O, 'writes planned installment amounts into debt rows (E14 fixed in R2: the last installment of the plan takes the rounding remainder)'],
    proyeccionDeudas:   [R, 'last month with a debt row of monto > 0, paid or not'],
    patrimonio:         [M, 'accumulated savings and USD stock from serie() plus crypto'],
    flujosMes:          [N, 'R4.2 pure: per-month realized / pending / scheduled flows and transfers split by hoy (not wired to the UI yet)'],
    cadena:             [N, 'R4.2 pure: 12-month opening/closing chain over flujosMes, legacy months before arrastre.desde keep calc()'],
    pasivos:            [N, 'R4.2 pure: liabilities a hoy: count-based plan saldo plus unticked rows of debts without a plan'],
    patrimonioNeto:     [N, 'R4.2 pure: net worth a hoy from cadena, serie up to hoy, crypto, trabajo and pasivos (old patrimonio stays pinned)'],
    ranking:            [Z, 'yearly expense ranking, only paid rows'],
    renderMes:          [M, 'month view: calc() realized and pending, serie() savings'],
    gastadoTope:        [Z, 'budget cap consumption: only paid items'],
    seccion:            [R, 'section subtotal uses suma(): every loaded row'],
    secMovimientos:     [R, 'quick-expense log total: every movement, independent of pagado'],
    secAhorro:          [Z, 'savings stock and aReponer from serie()'],
    notaRetiro:         [Z, 'aReponer from serie()'],
    datosTorta:         [Z, 'pie chart: only paid rows'],
    pintarTorta:        [Z, 'renders the pie from calc()/datosTorta (realized)'],
    armarCarrusel:      [O, 'false positive: CSS calc( string in a style'],
    renderAnio:         [M, 'year view: serie() realized totals, ranking realized'],
    renderUSD:          [O, 'USD stock/valuation from serie() and patrimonio()'],
    refrescar:          [M, 'live refresh: calc() realized plus suma() section subtotals'],
    hayDatos:           [R, 'E1 (fixed in R2): any item with monto > 0 (paid or not), any month flow field, or Trabajo data'],
    exportarCSV:        [Z, 'exports serie() realized totals per month'],
    duplicar:           [O, 'copies the year: carries serie() stock, zeroes every monto/pagado'],
    gastoRapido:        [O, EDIT],
    sumarAItem:         [O, EDIT + '; forces pagado when the previous monto was 0'],
    sumarGasto:         [O, EDIT + '; logs a movement'],
    quitarMov:          [O, EDIT + ' (E9 fixed in R2: undo restores the previous pagado of an item left empty)'],
    copiarAnterior:     [O, 'copies previous-month amounts, resets pagado'],
    abrirComoCobras:    [O, 'opens the weekly/frequency charge editor for one item'],
    pintarNotaCobras:   [O, EDIT],
    guardarComoCobras:  [O, EDIT],
    valorDe:            [O, 'reads one item amount from the DOM binding'],
    aplicarInput:       [O, EDIT],
    pasesDelMes:        [O, 'sum of Trabajo pases of a month (feeds the "Del trabajo" income row)'],
    normTrab:           [O, TRAB],
    saldoFac:           [O, TRAB],
    sinAsignar:         [O, TRAB],
    resumenTrab:        [O, TRAB],
    filaFac:            [O, TRAB],
    filaCobro:          [O, TRAB],
    filaVenta:          [O, TRAB],
    filaGasto:          [O, TRAB],
    cuerpoCobranza:     [O, TRAB],
    mensajeCobro:       [O, TRAB],
    renderTrabajo:      [O, TRAB],
    abrirVenta:         [O, TRAB],
    guardarFac:         [O, TRAB],
    borrarFac:          [O, TRAB],
    verFactura:         [O, TRAB],
    generarAbonos:      [O, TRAB],
    abrirCobro:         [O, TRAB],
    verCobro:           [O, TRAB],
    abrirGasto:         [O, TRAB],
    guardarGasto:       [O, TRAB],
    verGasto:           [O, TRAB],
    borrarGasto:        [O, TRAB],
    csvTrabajo:         [O, TRAB],
    aplicarPase:        [O, 'writes a pase amount into the "Del trabajo" income row (counted as realized by sumaPagado)'],
    quitarPase:         [O, TRAB],
    verPase:            [O, TRAB],
    accionTj:           [O, TRAB]
  }
};
