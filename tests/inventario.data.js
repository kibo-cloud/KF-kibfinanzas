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

// R4.6: the single semantic source per concept of the model (design section 1). Every screen figure of a model month reads the owner
// (directly or through the listed adapter); mirrored by the table "Semantic sources (R4.6)" in odd/tasks/repair-sprint-1.md.
var SOURCES = {
  'Registrado':           ['suma', 'every loaded amount of a section, any status'],
  'Realizado':            ['flujosMes', 'ingresosReal / gastosReal / cuotasReal / trabajoRealizado: ticked rows of a past or current month, pases dated <= hoy'],
  'Pendiente':            ['flujosMes', 'ingresosPend / gastosPend / cuotasPend: unticked rows of a past or current month'],
  'Programado':           ['flujosMes', 'ingresosProg / gastosProg / cuotasProg / trabajoProgramado / pasesNetosProg: everything of a future month'],
  'Disponible inicial':   ['cadena', 'meses[j].apertura: declared (iniciarArrastre) in the migration month, previous closing after, live December closing in January (ctxModelo.cierrePrevio)'],
  'Resultado del mes':    ['flujosMes', 'resultado = realized income - realized expenses - realized installments'],
  'Pases netos':          ['flujosMes', 'pasesNetos = retiro + venta - ahorro - reposicion (+ realized Trabajo pases)'],
  'Disponible actual':    ['cadena', 'resumen.disponibleActual; card through tilesMes'],
  'Proyectado al cierre': ['cadena', 'meses[j].proyectado / resumen.proyectadoAlCierre; card of a future month through tilesMes'],
  'Patrimonio bruto':     ['patrimonioNeto', 'bruto; row on screen through filasPatrimonio (R5, Dólares > Patrimonio total of a model year)'],
  'Patrimonio neto':      ['patrimonioNeto', 'neto; screen through patrimonioPantalla']
};

module.exports = {
  SOURCES: SOURCES,
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
    proyeccionDeudas:   [R, 'last month with a debt row of monto > 0, paid or not; R4.5 (N1): a model year passes datosRealizados'],
    patrimonio:         [M, 'accumulated savings and USD stock from serie() plus crypto'],
    flujosMes:          [N, 'R4.2: per-month realized / pending / scheduled flows and transfers split by hoy; single source of Realizado / Pendiente / Programado / Resultado / Pases netos (R4.6), read by the screen through tilesMes, mesEnRojo and cadena'],
    cadena:             [N, 'R4.2 pure: 12-month opening/closing chain over flujosMes, legacy months before arrastre.desde keep calc()'],
    pasivos:            [N, 'R4.2 pure: liabilities a hoy: count-based plan saldo plus unticked rows of debts without a plan'],
    patrimonioNeto:     [N, 'R4.2 pure: net worth a hoy from cadena, serie up to hoy, crypto, trabajo and pasivos (old patrimonio stays pinned)'],
    ranking:            [Z, 'yearly expense ranking, only paid rows; R4.5 (N1): a model year passes datosRealizados (future rows unticked in a copy)'],
    renderMes:          [M, 'month view: card from tilesMes (R4.4: calc() for legacy months, the cadena for model months), serie() savings'],
    tilesMes:           [N, 'R4.4 month card: calc() itself for a legacy month; model month: realized (past/current) or scheduled (future) flows from flujosMes, Del trabajo from pases, Disponible final from cadena (cierre / disponible actual / proyectado)'],
    gastadoTope:        [Z, 'budget cap consumption: only paid items'],
    seccion:            [R, 'section subtotal uses suma(): every loaded row; R4.4 (Q3): a Del trabajo row without pases in a model month gets a checkbox (tieneTilde); R5: also one above its pases, with the pases / excess split (repartoTrabajo)'],
    repartoTrabajo:     [N, 'R5 (R4.2 interpretation 4, design 7): how much of a Del trabajo row of a model month its pases cover and the excess; the same in-order allocation as flujosMes, display only (no money total)'],
    secMovimientos:     [R, 'quick-expense log total: every movement, independent of pagado'],
    secAhorro:          [Z, 'savings stock and aReponer from serie()'],
    notaRetiro:         [Z, 'aReponer from serie()'],
    datosTorta:         [Z, 'pie chart: only paid rows'],
    armarCarrusel:      [O, 'false positive: CSS calc( string in a style'],
    renderAnio:         [M, 'year view: rows from serieVista (R4.5: serie() for a legacy year/month; the month card for a model month, Disponible total = December closing), summary resumenAnio over the realized months of serieVista (N1; red month = card Ingresos - Gastos - Deudas < 0, N2), ranking realized'],
    renderUSD:          [O, 'USD stock/valuation from serie(); Patrimonio total from patrimonioPantalla (R4.4: old patrimonio() for a legacy year, patrimonioNeto a hoy incl. Trabajo for a model year; R5: its composition rows through filasPatrimonio / htmlPatrimonio)'],
    refrescar:          [M, 'live refresh: card from tilesMes (R4.4, same rule as renderMes) plus suma() section subtotals'],
    gastadoVista:       [Z, 'R5 (N1-A): what a capped row consumed on the month screen: gastadoTope (ticked only), and 0 in a future model month (programado, esProgramado)'],
    hayDatos:           [R, 'E1 (fixed in R2): any item with monto > 0 (paid or not), any month flow field, or Trabajo data'],
    serieVista:         [N, 'R4.5 year views (renderAnio table/chart/"Año por año", exportarCSV): serie() itself without arrastre; a model month overlays tilesMes (one semantic source with the card)'],
    duplicar:           [O, 'copies the year: carries serie() stock, zeroes every monto/pagado; R4.3: starts the new year chain from the December closing (cadena); R4.6: refused in a stale tab'],
    ctxModelo:          [O, 'R4.3: builds the motor ctx (Trabajo pases by month, live previous-year closing) for cadena/iniciarArrastre; R4.4: feeds the screen through vistaModelo'],
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
    resumenTrab:        [O, TRAB + '; R4.4 (Q4): a pase dated after hoy into a model month stays in Trabajo available until its date (paraPasar keeps the old value for pase validation)'],
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
    aplicarPase:        [O, 'writes a pase amount into the "Del trabajo" income row (realized through flujosMes trabajoRealizado in a model month, sumaPagado in a legacy one); R4.6: checks the Trabajo and year revisions before the first write and reverts the row when the year write fails (Trabajo is then not written)'],
    quitarPase:         [O, TRAB],
    verPase:            [O, TRAB],
    accionTj:           [O, TRAB]
  }
};
