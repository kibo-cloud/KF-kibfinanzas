# Repair Sprint 1 — Financial semantics & reliability

## Objective

Give TuGasto a correct, trustworthy financial core for Alfa: the system must represent where the
money is, and available money must not vanish when the month changes.

## Problem

Master Audit (read-only, baseline `f3dbff3`) found that the engine only models monthly flows that
reset every month plus one accumulated savings stock. Sprint 0 added pending/realized status to
external flows, but transfers between "pockets" (savings, withdrawals, USD buy/sell) were never
modeled, producing inconsistent semantics (E1-E14), plus security and reliability defects.

## Approved decisions (product owner, 2026-10-04)

- D1 Option A: income, expenses and installments have pending/realized status; transfers between
  pockets have no check; transfers in the current or past months are realized; future-month
  transfers are scheduled and only affect the projection. Chain: opening → movements → closing →
  next opening.
- D1b Alfa pockets: available ARS, savings ARS, savings USD, crypto, debt (liability). No accounts
  or wallets yet.
- D2 Carried balance is Must. User can correct the real closing; no fictitious movement is ever
  created; the difference is informational ("Según tus registros / Saldo real / Diferencia").
  Opening balance must be editable directly from the month view ("Saldo inicial … · Editar"),
  not only from the start-of-month prompt.
- D3 Future transfers are "programado": never change current available, may appear in
  "Proyectado al cierre", clearly distinguished.
- D4 No retroactive carry. Migration marker (`arrastreDesde` or equivalent); historical numbers
  keep their historical behavior. Migration must be safe, reversible and tested.
- D5 First use asks "¿Cuánto dinero tenés disponible actualmente?" with enter/skip. Skip → $0
  shown explicitly as "not configured".
- D6 Unconfirmed closings recalculate; a confirmed closing whose month later changes keeps the
  confirmed value, shows the difference and asks for reconfirmation.
- D7 Net worth (net) is the headline: available + savings ARS + USD valued + crypto valued −
  pending debt; gross as secondary detail; computed up to the current month only; estimates
  labeled.
- D8 Quick expense on a pending item with amount: ask the user (mark existing as paid vs record a
  separate realized expense keeping the plan pending); avoid accidental duplication.
- D9 Number parsing: explicit Argentine rules, no silent guessing of ambiguous input; per field
  type (money vs crypto quantity); invalid → visible error; tests per field type.
- D10 Dismissible start-of-month prompt (Confirmar / Corregir / Ahora no) is only a UX aid.
- D11 Reposición without pending debt to savings is treated as savings; documented and tested so
  no money is created.
- D12 Order R1 → R2 → R3 → (review) → R4 → R5… R3 (pure extraction, no financial behavior
  change) and R4 (semantics, pockets, opening/closing, carry, migration) stay separate.
- D13 Before changing any calculation, inventory its consumers. One semantic source per concept
  (Registrado, Realizado, Pendiente, Programado, Disponible inicial, Resultado del mes, Pases
  netos, Disponible actual, Proyectado al cierre, Patrimonio bruto, Patrimonio neto).
- D14 Safety: never delete data, never turn differences into movements, never silently alter
  existing movements, never break backup/restore, no unnecessary key changes, explicit tested
  migration, tests before/after, E2E for critical flows, clean tree after each stage. Must be able
  to compare before → migration → after and explain every number.
- D15 Out of scope: bank accounts, wallets, bank sync, AI, advanced scenarios, inflation, multiple
  USD rates, encryption, unrelated features.
- D16 R4 acceptance matrix (17 cases) with input, expected, actual, automated test, evidence.
- D17 UI speaks plain language (Disponible inicial, Ingresos, Gastos, Ahorro, Disponible actual,
  Proyectado al cierre, "Viene del mes anterior"); model jargon ("pases", "bolsillos") stays internal.

## Scope of this run

R1, R2, R3 only. **Stop before R4** for review of the extracted engine and the exact migration plan.

## Tasks

- [x] R1 Safety net (no behavior change): extractor understands regex literals; E2E suite moved
      into the repo (`npm run test:e2e`, no dependencies, system Edge/Chrome, temp dir outside the
      repo, test hook injected at serve time only); consumer inventory of every money-summing
      function with its current semantics, guarded by a test.
- [ ] R2 Model-independent fixes: E1 `hayDatos` uses registered data; E4 parsing per field type
      with visible errors (D9); U2 "Gasto" card button; S1 `toast` escapes by default; S6 `esc`
      escapes `'`; S2 CSV formula neutralization; S3 explicit own-key list instead of `kibo.`
      wildcard; S4/E12 restore reports failures and `hayLS` recovers; E9 quick-expense undo
      restores previous `pagado` and debt progress requires monto > 0; E14 last installment
      absorbs rounding remainder. Each with RED-before/GREEN-after tests.
- [ ] R3 Pure extraction of the financial engine into an isolated unit loaded before the app,
      testable as a whole; identical financial behavior; deployment contract preserved
      (offline cache, "Versión para PC" export).

## Deferred (not in this run)

- R4 semantics/pockets/carry/migration (needs review after R3).
- R5 UX of the model, R6 analytics (E3, E6, E7, E8, E10, E11, U3), R7 quick expense (E5/D8),
  R8 Trabajo (E13), R9 privacy text (S5) and visible rebrand.
- E14 reposición rule (D11) belongs to R4 (it changes the model).

## TDD

Mode: off by configuration; RED-before/GREEN-after is applied by sprint rule (D14).
Runner: `npm test` (= `node --test "tests/**/*.test.js"`); E2E: `npm run test:e2e` (added in R1).

## Route

Delegated direct: one writer per stage (writer trigger: 2+ non-trivial files per stage).

## Progress / evidence

- Branch `fix/repair-sprint-1` from `f3dbff3` (`fix/estado-pago-totales`). Baseline 49/49.
- R1 done (no product file touched). Commits: `bdb3e56` extractor supports regex literals (+ `tests/load-app.test.js`, esc workaround removed from topes tests); `51e8015` E2E suite (`npm run test:e2e`, 62 checks pass; exit 2 when no browser); third commit adds inventory + characterization tests and this document update.
- R1 evidence: `npm test` 59/59; `npm run test:e2e` 62 pass / 0 fail; `git diff f3dbff3 -- index.html sw.js manifest.webmanifest privacidad.html LEEME.md` empty.
- E2E notes: site copied to an OS temp dir, hook and Date pin (2026-10-04T12:00 local) injected into the copy only; browser via `TUGASTO_BROWSER` or system Edge/Chrome.

## Next step

R2.

## Consumer inventory (R1, current semantics)

Documentation of the CURRENT state (baseline `f3dbff3`; line numbers refer to index.html, which R1 does not touch). Guarded by `tests/inventario.test.js` (source of truth: `tests/inventario.data.js`). Semantics: registrado = every loaded amount; realizado = only ticked/paid; mixto = both; otro = editor/display/Trabajo ledger/false positive. Known bugs are listed as they behave today.

| Function | Line | Semantic | Reason |
|---|---|---|---|
| normalizar | 1817 | otro | input normalization; migration default pagado = monto > 0 for past months |
| suma | 1920 | registrado | sums every loaded amount, paid or not |
| sumaPagado | 1922 | realizado | sums only pagado === true (plus "Del trabajo" income rows) |
| calc | 1927 | mixto | realized totals (sumaPagado) plus pending totals (suma - sumaPagado) and savings flows |
| serie | 1945 | mixto | calc() per month plus accumulated savings/USD/aReponer stock |
| cobroTxt | 2015 | otro | displays one item amount split by number of payments |
| cargarCuotas | 2071 | otro | writes planned installment amounts into debt rows (E14: 100000/3 loses 1 peso) |
| proyeccionDeudas | 2090 | registrado | last month with a debt row of monto > 0, paid or not |
| patrimonio | 2111 | mixto | accumulated savings and USD stock from serie() plus crypto |
| ranking | 2122 | realizado | yearly expense ranking, only paid rows |
| renderMes | 2267 | mixto | month view: calc() realized and pending, serie() savings |
| gastadoTope | 2325 | realizado | budget cap consumption: only paid items |
| seccion | 2428 | registrado | section subtotal uses suma(): every loaded row |
| secMovimientos | 2468 | registrado | quick-expense log total: every movement, independent of pagado |
| secAhorro | 2484 | realizado | savings stock and aReponer from serie() |
| notaRetiro | 2520 | realizado | aReponer from serie() |
| datosTorta | 2537 | realizado | pie chart: only paid rows |
| pintarTorta | 2582 | realizado | renders the pie from calc()/datosTorta (realized) |
| armarCarrusel | 2607 | otro | false positive: CSS calc( string in a style |
| renderAnio | 2675 | mixto | year view: serie() realized totals, ranking realized |
| renderUSD | 2791 | otro | USD stock/valuation from serie() and patrimonio() |
| refrescar | 3096 | mixto | live refresh: calc() realized plus suma() section subtotals |
| hayDatos | 3377 | realizado | E1: should be registrado, fixed in R2 (today false when data is registered but nothing is ticked) |
| exportarCSV | 3435 | realizado | exports serie() realized totals per month |
| duplicar | 3447 | otro | copies the year: carries serie() stock, zeroes every monto/pagado |
| gastoRapido | 3642 | otro | editor/writer of a single item amount; no aggregation |
| sumarAItem | 3667 | otro | editor/writer of a single item amount; no aggregation; forces pagado when the previous monto was 0 |
| sumarGasto | 3671 | otro | editor/writer of a single item amount; no aggregation; logs a movement |
| quitarMov | 3690 | otro | editor/writer of a single item amount; no aggregation (E9: undo does not restore previous pagado) |
| copiarAnterior | 3719 | otro | copies previous-month amounts, resets pagado |
| abrirComoCobras | 3734 | otro | opens the weekly/frequency charge editor for one item |
| pintarNotaCobras | 3773 | otro | editor/writer of a single item amount; no aggregation |
| guardarComoCobras | 3786 | otro | editor/writer of a single item amount; no aggregation |
| valorDe | 4039 | otro | reads one item amount from the DOM binding |
| aplicarInput | 4049 | otro | editor/writer of a single item amount; no aggregation |
| pasesDelMes | 4215 | otro | sum of Trabajo pases of a month (feeds the "Del trabajo" income row) |
| normTrab | 4307 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| saldoFac | 4392 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| sinAsignar | 4401 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| resumenTrab | 4408 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| filaFac | 4588 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| filaCobro | 4595 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| filaVenta | 4602 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| filaGasto | 4633 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| cuerpoCobranza | 4678 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| mensajeCobro | 4695 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| renderTrabajo | 4868 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| abrirVenta | 5115 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| guardarFac | 5228 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| borrarFac | 5310 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| verFactura | 5322 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| generarAbonos | 5367 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| abrirCobro | 5402 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| verCobro | 5491 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| abrirGasto | 5523 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| guardarGasto | 5551 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| verGasto | 5570 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| borrarGasto | 5578 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| csvTrabajo | 5602 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| aplicarPase | 5657 | otro | writes a pase amount into the "Del trabajo" income row (counted as realized by sumaPagado) |
| quitarPase | 5715 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| verPase | 5735 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |
| accionTj | 5744 | otro | Trabajo ledger (facturas/cobros/gastos/pases): own date-based realization, outside the monthly plan semantics |

Totals: {"otro":44,"registrado":4,"realizado":9,"mixto":6}. Characterization of functions R2 will change: `tests/caracterizacion.test.js` (names prefixed "[R2 will change]").
