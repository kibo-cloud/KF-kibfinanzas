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
    repartoPases:       [N, 'D9 A1 (N2-B b): how much of the month pases each income row absorbs (0 for non Del trabajo rows): the single exact-name row first, then the others in order; the one allocation shared by flujosMes (money) and repartoTrabajo (screen)'],
    flujosMes:          [N, 'R4.2: per-month realized / pending / scheduled flows and transfers split by hoy; single source of Realizado / Pendiente / Programado / Resultado / Pases netos (R4.6), read by the screen through tilesMes, mesEnRojo and cadena'],
    cadena:             [N, 'R4.2 pure: 12-month opening/closing chain over flujosMes, legacy months before arrastre.desde keep calc()'],
    pasivos:            [N, 'R4.2 pure: liabilities a hoy: count-based plan saldo plus unticked rows of debts without a plan'],
    patrimonioNeto:     [N, 'R4.2 pure: net worth a hoy from cadena, serie up to hoy, crypto, trabajo and pasivos (old patrimonio stays pinned)'],
    ranking:            [Z, 'yearly expense ranking, only paid rows; R4.5 (N1): a model year passes datosRealizados (future rows unticked in a copy)'],
    renderMes:          [M, 'month view: card from tilesMes (R4.4: calc() for legacy months, the cadena for model months), serie() savings'],
    tilesMes:           [N, 'R4.4 month card: calc() itself for a legacy month; model month: realized (past/current) or scheduled (future) flows from flujosMes, Del trabajo from pases, Disponible final from cadena (cierre / disponible actual / proyectado)'],
    gastadoTope:        [Z, 'budget cap consumption: only paid items'],
    seccion:            [R, 'section subtotal uses suma(): every loaded row; R4.4 (Q3): a Del trabajo row without pases in a model month gets a checkbox (tieneTilde); R5: also one above its pases, with the pases / excess split (repartoTrabajo)'],
    faltaSeccion:       [N, 'P3a: what a section still has unticked in a past/current month, by the existing rules: flujosMes pending (Del trabajo only above its pases, via repartoTrabajo) in a model month, calc() pendienteX in a legacy one; 0 in a future month (programado); display only'],
    textoDelTrabajo:    [N, 'P3a: the Del trabajo row in words: pases dated <= hoy allocated in order over the rows (as flujosMes realizes them) plus the ticked excess (R5), against the row amount; display only'],
    repartoTrabajo:     [N, 'R5 (R4.2 interpretation 4, design 7): how much of a Del trabajo row of a model month its pases cover and the excess; the same allocation as flujosMes (D9 A1: both call repartoPases, exact row first), display only (no money total)'],
    secMovimientos:     [R, 'quick-expense log total: every movement, independent of pagado'],
    secAhorro:          [Z, 'savings stock and aReponer from serie()'],
    notaRetiro:         [Z, 'aReponer from serie()'],
    datosTorta:         [Z, 'pie chart: only paid rows'],
    armarCarrusel:      [O, 'false positive: CSS calc( string in a style'],
    renderAnio:         [M, 'year view: rows from serieVista (R4.5: serie() for a legacy year/month; the month card for a model month, Disponible total = December closing), summary resumenAnio over the realized months of serieVista (N1; red month = card Ingresos - Gastos - Deudas < 0, N2), ranking realized'],
    renderUSD:          [O, 'USD stock/valuation from serie(); Patrimonio total from patrimonioPantalla (R4.4: old patrimonio() for a legacy year, patrimonioNeto a hoy incl. Trabajo for a model year; R5: its composition rows through filasPatrimonio / htmlPatrimonio)'],
    derivaAnioPrevio:   [O, 'S2 H1 notice: compares what duplicar copied (copiaDiciembre) with serie()/estadoDeuda of the stored previous year; in a model year that follows December live (arrastreVivo) only the fields the user changed, in a legacy year every field; display only, writes nothing'],
    carryDiciembre:     [Z, 'S2 H1 (I4, R4.3): what December of the stored previous year leaves today: serie() ahorroAcumulado / aReponer / usdAcumulado and cuotasRealizadas per plan (the same values duplicar copies); read by arrastreVivo through leerAnio'],
    cuotasRealizadas:   [Z, 'D5 (N1-B b): estadoDeuda pagadas of a plan up to December minus the months ticked ahead in a model year (esProgramado); legacy years count the 12 months; used by duplicar, carryDiciembre, derivaAnioPrevio and cuotasDeMas'],
    cuotasProgramadas:  [M, 'S2 H1: count of months whose installment row of a plan is loaded (monto > 0) and not paid (estaPagado), or (D5, with hoy) ticked ahead in a model month not yet arrived: the slot of a real installment; duplicar (model year) skips them when loading the new year, cuotasDeMas compares against them'],
    abrirOrdenTrabajo:  [O, 'S2 N2-B repair preview: shows the amount and tick of each "Del trabajo" row of a month and the cobrado / sin cobrar before and after reordering (efectoOrdenTrabajo through flujosMes); display only, writes nothing'],
    cuotasDeMas:        [O, 'S2 H1 notice: rows of a plan loaded in a model year beyond what remains after the live December (cuotas - max(pagadasAntes, cuotasRealizadas of the previous year) - its cuotasProgramadas); display only, rows never removed (D14)'],
    refrescar:          [M, 'live refresh: card from tilesMes (R4.4, same rule as renderMes) plus suma() section subtotals'],
    gastadoVista:       [Z, 'R5 (N1-A): what a capped row consumed on the month screen: gastadoTope (ticked only), and 0 in a future model month (programado, esProgramado)'],
    hayDatos:           [R, 'E1 (fixed in R2): any item with monto > 0 (paid or not), any month flow field, or Trabajo data'],
    serieVista:         [N, 'R4.5 year views (renderAnio table/chart/"Año por año", exportarCSV): serie() itself without arrastre; a model month overlays tilesMes (one semantic source with the card)'],
    duplicar:           [O, 'copies the year: carries serie() stock, zeroes every monto/pagado; R4.3: starts the new year chain from the December closing (cadena); R4.6: refused in a stale tab; S2 H1: stores copiaDiciembre and, in a model year, loads only the installments the old year does not still schedule (cuotasProgramadas)'],
    ctxModelo:          [O, 'R4.3: builds the motor ctx (Trabajo pases by month, live previous-year closing) for cadena/iniciarArrastre; R4.4: feeds the screen through vistaModelo'],
    gastoRapido:        [O, EDIT],
    sumarAItem:         [O, EDIT + '; forces pagado when the previous monto was 0'],
    sumarGasto:         [O, EDIT + '; logs a movement'],
    quitarMov:          [O, EDIT + ' (E9 fixed in R2: undo restores the previous pagado of an item left empty; L3: a "pago" movement restores the previous amount and tick, an "aparte" one removes the row it created; D2: a "parcial" one gives the part back to the planned row (refused when that row is no longer identifiable, or, D9 A5, when it was ticked or its amount is not the recorded leftover rr minus later parts) and removes the row it created; L3 review: a "pago" undo reverses only that payment, monto - mv.monto + ma)'],
    preguntaPago:       [O, 'L3 (D8) guard on ONE row: pending (not ticked) with monto > 0, outside a future month of the model; no aggregation'],
    preguntarPago:      [O, 'L3 question sheet: shows the amount of one row and the typed amount; no aggregation'],
    gastoEsPago:        [O, 'L3 "Sí": compares the typed amount with one row amount (asks when they differ); no aggregation'],
    marcarPago:         [O, EDIT + '; L3: ticks the row, keeps or replaces its amount, logs a "pago" movement with the previous amount'],
    gastoAparte:        [O, EDIT + '; L3: a separate ticked row "<row> (otro gasto)" (reused when ticked or empty), the planned row untouched'],
    renglonLibre:       [O, 'L3/D2: finds or creates the ticked one-off row "<row> (otro gasto)" / "<row> (pago parcial)" (reused when ticked or empty); reads one row amount, no aggregation'],
    pagoParcial:        [O, EDIT + '; D2 (owner decision, L3 partial payment b): the typed part goes to a ticked "<row> (pago parcial)" row (aparte), the planned row keeps the rest pending; logs a "parcial" movement; D9: keeps montoPlan (planned amount, for copiarAnterior) and the leftover rr (for undo)'],
    copiarAnterior:     [O, 'copies previous-month amounts, resets pagado; L3 review: skips the one-off "<row> (otro gasto)" rows; D9 A2: a row split by a partial payment copies its montoPlan (the planned amount), not the leftover'],
    vencimientos:       [N, 'L5 "Qué vence esta semana": lists single rows, no sum: pending rows (not ticked, monto > 0) of past model months (the rows cadena.resumen.vencidos adds up) and of the current month with a collection day or near the month end, plus Trabajo invoice open balances (saldoFac) by due date; display only'],
    htmlVence:          [O, 'L5 card: shows each listed row amount as is; no aggregation'],
    analisisAnio:       [M, 'L6 (R6) analysis of "El año": Cobrado / Pagado / Ahorro read from the serieVista rows (realized: tilesMes in a model month, calc in a legacy one) of the transcurred months only (no future month, I5), compared with the previous month and the average of the earlier ones; per category the ticked gastos (estaPagado on datosRealizados), which add up to Pagado; display only, no new rule'],
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
    aplicarPase:        [O, 'writes a pase amount into the "Del trabajo" income row (realized through flujosMes trabajoRealizado in a model month, sumaPagado in a legacy one); R4.6: checks the Trabajo and year revisions before the first write and reverts the row and Trabajo when a write fails; L8: both blobs go through the kibo.diario journal (escribirJuntos), finished at start-up by recuperarDiario'],
    quitarPase:         [O, TRAB],
    verPase:            [O, TRAB],
    accionTj:           [O, TRAB]
  }
};
