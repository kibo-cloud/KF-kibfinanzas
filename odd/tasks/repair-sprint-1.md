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
- [x] R2 Model-independent fixes: E1 `hayDatos` uses registered data; E4 parsing per field type
      with visible errors (D9); U2 "Gasto" card button; S1 `toast` escapes by default; S6 `esc`
      escapes `'`; S2 CSV formula neutralization; S3 explicit own-key list instead of `kibo.`
      wildcard; S4/E12 restore reports failures and `hayLS` recovers; E9 quick-expense undo
      restores previous `pagado` and debt progress requires monto > 0; E14 last installment
      absorbs rounding remainder. Each with RED-before/GREEN-after tests.
- [x] R3 Pure extraction of the financial engine into an isolated unit loaded before the app,
      testable as a whole; identical financial behavior; deployment contract preserved
      (offline cache, "Versión para PC" export). Commits `f95a625`, `a6dd7a4`, `12d4a7c`, `3a8a7ae`
      (v1.31.4, sw v44); docs commit follows. See "R3 evidence" below.

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

## R2 evidence (v1.31.3, branch `fix/repair-sprint-1`)

Commits: `58cee5a` E1 hayDatos · `ae134fb` E4 parsing · `8e3c947` U2 card button · `83d2b0e` S1/S2/S6 · `8e60385` S3 · `e6c5de8` S4/E12 · `56ec314` E9/E14 · `990c004` E2E hardening + checks · `5f82924` release v1.31.3 (APPVER 1.31.3, sw v43, LEEME).
Final: `npm test` 111/111; `npm run test:e2e` 86 pass / 0 fail (3 consecutive runs); inline-script syntax check 0 errors.
Baseline for the E2E RED: new run.mjs against a worktree of `98146d4` gives 13 FAIL (card Gasto sheet, 1e3 field mark/stored/message/restored value, crypto 0.001 stored as 1, 1,234.5 accepted, backup reminder missing for unticked data, toast XSS handler ran and an `<img>` was injected).

| Item | RED (before) | GREEN (after) |
|---|---|---|
| E1 hayDatos (`58cee5a`) | `tests/caracterizacion.test.js`: "[R2 fixed] hayDatos E1: registered data counts even when nothing is ticked" and "...any month flow field is registered data" failed | 62/62 |
| E4 parsing (`ae134fb`) | `tests/parseo.test.js` (13 tests) failed: `function not found: parseMonto` (parsers did not exist); old behavior pinned in R1: parseNum('1e3') = 13, '0.001' = 1, '12.5,3' = 125.3 | 13/13, 75/75 total |
| U2 (`8e3c947`) | E2E "card Gasto button opens the quick-expense sheet" got=false (baseline run) | E2E pass |
| S1/S6/S2 (`83d2b0e`) | `tests/seguridad.test.js`: "esc escapes single quotes too (S6)", "toast escapes its text by default (S1)", "toast escapes quotes and the action label" failed on assertions; csvTexto tests: `function not found: csvTexto` | 86/86 total |
| S3 (`8e60385`) | `tests/claves.test.js`: `var not found: CLAVES_PROPIAS` (the `kibo.` wildcard snapshotted and deleted a foreign `kibo.otraApp`) | 4/4 |
| S4/E12 (`e6c5de8`) | `tests/copias.test.js`: `function not found: escribirAnios` / `avisarRestauro`; "guardar: a later successful save sets hayLS back to true" failed (hayLS stayed false) | 7/7, 93 total |
| E9/E14 (`56ec314`) | `tests/deudas.test.js`: `function not found: repartoCuotas`; `tests/movimientos.test.js`: "undo ... restores pagado=false", "undo on a paid item keeps it paid" (no `pp`) and "normalizar keeps pp" failed | 111/111 total |
| E2E hardening (`990c004`) | baseline run above | `send` rejects after 15 s and on socket error/close; `nav` waits for `Page.loadEventFired` (+300 ms settle); two screen checks wait 1.3 s for the count-up animation |

### R2 decisions and notes

- Parsers (index.html ~1905-1955): `parseMonto`, `parseCantidad`, `parsePct`, `parseEntero` return NaN when the text is not understood and 0 when empty; `parseNum` was removed (no caller left). `crudo` no longer writes exponent notation (1e-8 becomes "0,00000001") because the parsers reject exponents.
- UI contract: while typing, invalid text is never written to the model (last valid value kept) and the input gets class `err` (new CSS using `--neg`); partial text ending in "." or "," shows nothing until blur; on blur/commit a toast or inline note says "No entendí «X» como número" and the field is redrawn from the model. Forms with a Guardar button (topes, plan de deudas, cobro de ingresos, Trabajo) validate everything first and write nothing when one field is invalid.
- Visible change: the cobro-de-ingresos and plan-de-deudas editors now prefill amounts as plain grouped digits (`1.500`) instead of `$1.500` (`montoInput`), so the "ojito" mode cannot put dots into an editable field.
- E1: `hayDatos` = any item monto > 0 (paid or not) OR any non-zero month flow field OR Trabajo data. Callers re-checked: `cargar` (welcome / empty notice), `cerrarBienvenida`, `quitarAvisoVacia`, `revisarCopia` (the backup reminder now also fires for unticked data), `restaurarTexto.teniaDatos`.
- E9a: movement entries get an optional boolean `pp` (previous pagado); `quitarMov` restores it only when the item is empty again after the undo; entries without `pp` behave as before.
- E9b: `cuotaPaga(j, it)` = ticked AND monto > 0, used by `estadoDeuda` (both loops) and `pagadasHasta`. The help text ("cada mes con un monto cargado ... es una cuota paga") now mentions the tick.
- E14: `repartoCuotas(p)` gives {valor: round(total with recargo / cuotas), ultima: round(total with recargo) - (cuotas-1)*valor} (floor fallback if that would be negative). `cargarCuotas` numbers installments as pagadasAntes + pagadasHasta(desde) + offset + 1; only installment number `cuotas` gets `ultima`. `estadoDeuda.saldo` = (restantes-1)*valor + ultima. The reposicion rule is untouched (R4).
- S3 key list (explicit): `kibo.datos.<4 digits>`, `kibo.anio`, `kibo.ultimaCopia`, `kibo.oculto`, `kibo.bienvenida`, `kibo.historial`, `kibo.trabajo`, `kibo.vistaProd`. `kibo.esquema` is also deleted on restore (as before, so the boot re-records the schema); `kibo.respaldo.pre130` is the snapshot itself. `kibo.datos.test` (storage probe) is not an app key.
- S1: `toast` escapes text and action label by default. No caller passes markup; the four callers that pre-escaped (`esc(it.nombre)`, `esc(nom)`, `esc(p.nombre)`, `esc(a)`) now pass plain text. No `toastHtml` was needed. `pildora` still takes HTML (callers pass constants; outside R2 scope).
- S2: `csvTexto` prefixes `'` on text cells starting with = + - @ TAB CR; used by the year CSV (month names only) and the Trabajo CSV (cliente, numero, concepto, fuente, cobro cliente, facturas que paga, gasto concepto). Numeric cells go through `n()` or raw numbers and are never prefixed (tested with negative values).

### Parse field-type inventory (every former parseNum caller)

| Field | Where | Type | Negative |
|---|---|---|---|
| Item amount (ingresos / fijos / variables / deudas) | `aplicarInput` | money | no |
| ahorroMesARS, compraARS, retiroARS, ventaARS, reposicionARS, ahorroAnioAnterior | `aplicarInput` | money | no |
| ahorroMesUSD, compraUSD, ventaUSD, usdAnioAnterior | `aplicarInput` (class usd) | money | no |
| cotizacionUSD | `aplicarInput` | money | no |
| cripto precioUSD | `aplicarInput` | money | no |
| cripto cantidad | `aplicarInput` (class cant) | quantity | no |
| metaAhorroPct | `aplicarInput` (class pct) | percent | no |
| Gasto rapido (grMonto) | `gastoRapido` + `sumarGasto` (revalidated on commit) | money | no |
| Topes (topein) | `guardarTopes` | money | no |
| Cobro de ingresos: total, cada pago | `pintarNotaCobras`, `guardarComoCobras` | money | no |
| Plan de deudas: total | `leerPlan` | money | no |
| Plan: cuotas, ya pagadas | `leerPlan` | integer | no |
| Plan: recargo % | `leerPlan` | percent | no |
| Trabajo: fxMonto, fxPrecio, fxMontoP, cbMonto, gxMonto (ARS or USD), gxCot, tpMonto, psMonto, pxPrecio, pxCosto | `leerMonto` | money | read only to say "no puede ser negativo" |
| Trabajo: fxCant | `cantidadDe` | quantity (> 0) | read only to say "mayor que cero" |
| Trabajo: fxAjuste (recargo o descuento %) | `totalFactura`, `guardarFac` | percent | YES (discount; the -100 floor is kept) |
| Trabajo: fxDias (plazo) | input handler, chip "otro", `guardarFac` | integer | no |
| Trabajo: pxStock | `guardarProducto` | integer | YES (stock can go negative) |

### Toast caller inventory (S1)

38 call sites. Plain constant text: ordering, topes, copy, restore and Trabajo messages. Text with user data (now escaped by `toast`, pre-escape removed): "Sumé $X a <categoria>", "Borré <nombre>", "<producto> · ...", "todo quedó a nombre de <cliente>", "Copié la factura ... con el número <numero>" (the known sink), "No entendí «<texto>» como número" (new). None passes markup.

### Native review (R1 + R2)

- R1 slice (base 1c56f92, 981 lines, includes Sprint 0 T5/T6): medium, consent granted,
  review-reliability approved and acknowledged (lineage review-269074009bc7ad4b). Advisory:
  E2E CDP had no timeout (fixed in R2); `gastadoTope`/`datosTorta` read global `mes` (to be
  parameterized in R3); composition tests assign fields directly (E2E covers the real path);
  regex heuristic misreads `a++ / b` (documented limit).
- R2 slice (base 98146d4, 1219 lines): medium, consent granted, approved and acknowledged
  (lineage review-cd57a009e8401e0b). Findings verified by the parent:
  - CONFIRMED, introduced: `leerPlan` turned half-typed values ("100000,", "10,", "2.") into 0
    and `guardarPlan` saved them. Fixed in c6a9ca4 (`leerPlan(alGuardar)`), RED first:
    tests/plan.test.js "saving rejects a trailing separator" failed, then 114/114 and E2E 86/86.
  - FALSE POSITIVE: `guardarTrab` returns true/false explicitly (index.html ~4497-4504).
  - FALSE POSITIVE: clearing `#avisos` only removes the storage notice, because `aviso()`
    replaces the whole container (one notice at a time).
  - Not fixed (suggestion): `nav` pending load promise on a failed navigate (E2E only).

## R3 evidence (v1.31.4, branch `fix/repair-sprint-1`)

Commits: `f95a625` golden fixtures (against the pre-extraction engine) · `a6dd7a4` extraction · `12d4a7c` E2E checks · `3a8a7ae` release (APPVER 1.31.4, sw `kibfinanzas-offline-v44`, LEEME changelog).

- Golden before the move: `npm test` 269/269 (golden generated and checked against the code of `29ed7cc`). Golden after the move, with the engine loaded as a whole (`loadMotor()`, no regex extraction): the same fixture, byte for byte (`tests/motor.golden.test.js` compares the whole serialized output and each dataset/field). `npm test` 273/273 final (the 4 extra tests are the motor self-containment, loader and inventory-coverage tests). `npm run test:e2e` 90 pass / 0 fail (86 before + 4 new R3 checks). Inline-script syntax check of the 2 non-JSON inline scripts: 0 errors.
- Golden corpus (`tests/fixtures/motor-corpus.js`, fixture `motor-golden.json`, ~1 MB, regenerate only by hand with `node tests/fixtures/generar-golden.js`, never to make a failing test pass): fake date 2026-10-04. Datasets: a migrated 2026 year with mixed paid/pending in the four sections (Del trabajo rows in several spellings, ahorro/compra/venta/retiro/reposición, a reposición larger than the pending stock, crypto, five debt plans: with recargo and pagadasAntes, tiny total vs many installments, cuotas 0, no rows, ticked-without-amount rows, future months loaded, 11 categories to force "Otros", unnamed row, movimientos with and without `pp`); the same year as 2025 and 2027; the same year as a legacy blob (no `pagoExplicito`, no `pagado`, text amounts, junk rows, 11 months) for 2025/2026/2027; empty `{}`, `null` and a string. Per dataset it records: normalizar, calc per month, serie, patrimonio, costoDolares, criptoUSD, ranking, datosTorta per month, gastadoTope per item, suma/sumaPagado per section (with and without the income flag), cuotaPaga/estaPagado, hayDatos (with and without Trabajo), proyeccionDeudas, and per plan/debt name: planDe, estadoDeuda for 12 months, pagadasHasta for 0..13, pendientesDesde, planDeCarga, cargarCuotas effects (returned plan + every month's debt rows) at desde 0/3/6/9/11, plus alternarPago and sumarAItem. Pure inputs: mesTope/mesesCorridos for 2023-2028, mesVacio, num (24 inputs), clave/esRenglonTrabajo, the constants, parseMonto/parseCantidad/parsePct/parseEntero with and without `neg` and `parcial` over 56 texts, repartoCuotas/totalConRecargo/valorCuota over 11 plans. NaN, -0 and Infinity are serialized explicitly so they cannot hide.
- Design: the engine is a classic inline block `<script id="motor">` (`var TGMotor = (function(){ 'use strict'; ... return {...}; })();`) placed right before the app script, not a separate `.js`. Rationale: "Versión para PC" fetches `./index.html` and slices it between the data markers, so anything outside index.html would be missing from the single self-contained file; the service worker cache is a fixed 9-file list (a new file would need sw.js + the E2E site copy + the deploy list changes and would be cached separately from the HTML that calls it); no build step exists. The block holds no `DATOS_` markers (tested) and `M1`/`M2` stay built by concatenation in the app so each marker still appears exactly once in the file. Inside the app IIFE, right after `'use strict'`, aliases (`var calc = TGMotor.calc, ...`) keep every existing call site working. The E2E hook (`calc`, `serie`, `ranking`, `datosTorta` in the app IIFE) works unchanged through the aliases.
- Test infrastructure: `tests/load-app.js` evaluates the motor block first in the vm context and exposes every TGMotor member as a global, so tests that extract app functions by name still resolve `calc`, `suma`, ... ; names the motor owns are skipped when listed in `funcs`/`vars`; `loadMotor()` returns `TGMotor` from a bare context (only Date, JSON, Math, Object, Array, String, isFinite, parseFloat). New tests: motor loads whole, motor source has no DOM/storage/app state/data markers, every TGMotor member reaches app code and none is defined twice, inventory scan covers both blocks. Existing tests were updated only for the new explicit arguments (`cargarCuotas(D, ...)`, `estadoDeuda(D, ...)`, `pagadasHasta(D, ...)`, `pendientesDesde(D, ...)`, `hayDatos(D, tieneTrab())`, `gastadoTope(it, mes)`, `datosTorta(m, mes)`, `mesTope(anio)`); no assertion value changed.
- Size: the move is ~430 lines of pure relocation (the advisory ~400 lines/task is exceeded by the golden corpus and its 1 MB fixture, not by logic); not split because the golden has to land before the move and the tests only make sense together with the move.

### Motor membership (final)

Signature column: "same" = unchanged; otherwise old → new. Call sites pass `D` (the app year object) and `mes` (current month index).

| Function / constant | Where | Reason / signature change |
|---|---|---|
| SECS, MARCABLE, RENGLON_TRABAJO, TORTA_MAX, TOPEABLE | moved (aliased, except TORTA_MAX) | constants the engine needs; TORTA_MAX is used only by datosTorta, so the app has no alias |
| mesVacio, normalizar | moved | pure (normalizar calls `mesTope(d.anio)`); same |
| num | moved | pure; same |
| sinSigno, cerosFuera, parseMonto, parseCantidad, parsePct, parseEntero, parcial | moved | pure; same (sinSigno, cerosFuera, parseMonto-family helpers are exported but the app only aliases the ones it calls) |
| suma, sumaPagado, calc, serie, costoDolares, criptoUSD, patrimonio, ranking | moved | pure; same |
| clave, esRenglonTrabajo, estaPagado, cuotaPaga, alternarPago, sumarAItem | moved | pure item helpers; same |
| mesTope | moved | read `D.anio` when called without argument → `mesTope(anio)` always explicit; the only no-argument caller was `estadoDeuda`, now `mesTope(d.anio)`. Reads `new Date()` (builtin) |
| mesesCorridos | moved | same; reads `new Date()` |
| planDe | moved | `planDe(nombre)` → `planDe(d, nombre)`; call sites: seccion (debt row button), abrirPlan x2, ofrecerCarga |
| estadoDeuda | moved | `(nombre, i)` → `(d, nombre, i)`; call sites: textoDeuda, duplicar |
| pagadasHasta, pendientesDesde, planDeCarga | moved | `(nombre, x)` → `(d, nombre, x)`; call site of planDeCarga: ofrecerCarga; the other two are internal |
| cargarCuotas | moved | `(nombre, desde)` → `(d, nombre, desde)`; call sites: duplicar, ofrecerCarga (it mutates the passed year, as before) |
| proyeccionDeudas | moved | `()` → `(d)`; call site: renderAnio |
| totalConRecargo, repartoCuotas, valorCuota | moved | pure; same |
| gastadoTope | moved | `(it)` → `(it, j)`; callers pass `mes` (filaTope, pasadas, refrescar). `estaPagado` ignores `j`, so output is identical |
| datosTorta | moved | `(m)` → `(m, j)`; caller htmlTorta passes `mes` |
| hayDatos | moved | `()` → `(d, conTrabajo)`; every caller passes `hayDatos(D, tieneTrab())` (cargar x2, restaurarTexto, cerrarBienvenida, quitarAvisoVacia, revisarCopia). `conTrabajo` replaces the old early `if(tieneTrab()) return true` |
| notaCompra | stayed | builds user text with `fARS` (presentation) |
| textoDeuda | stayed | builds user text with `fARS`, `MESES`, `D` |
| cuantosPagos, diasDelMes, cobroTxt | stayed | cuantosPagos/diasDelMes are pure calendar helpers used only by the cobro editor and its text (`cobroTxt` reads `D`/`mes` and `fARS`); not part of any total, so left in the app (candidate to move later without risk) |
| fARS, fUSD, hARS, hUSD, fPct, corto, grupos, esc, crudo, fechaCorta, marcarErr | stayed | presentation / DOM (read `oculto`, `PUNTOS`, `classList`) |
| renderMes, seccion, secAhorro, secMovimientos, notaRetiro, pintarTorta, htmlTorta, renderAnio, renderUSD, refrescar | stayed | render: DOM and app state |
| exportarCSV, duplicar, copiarAnterior, gastoRapido, sumarGasto, quitarMov, aplicarInput, abrirComoCobras, guardarComoCobras, pintarNotaCobras | stayed | DOM, `D`, `mes`, localStorage side effects; they call the motor |
| guardar, cargar, leerAnio, escribirAnios, restaurarTexto, versionPC | stayed | localStorage / persistence / export |
| Trabajo ledger (normTrab, resumenTrab, pasesDelMes, saldoFac, aplicarPase, quitarPase, tieneTrab, ...) | stayed | outside the monthly plan engine (D13 "otro"); read the global `T`. `pasesDelMes` and `tieneTrab` read `T` |

### Aliases in the app IIFE (31)

SECS, MARCABLE, RENGLON_TRABAJO, TOPEABLE, normalizar, num, parseMonto, parseCantidad, parsePct, parseEntero, parcial, suma, calc, serie, costoDolares, estaPagado, alternarPago, clave, esRenglonTrabajo, planDe, estadoDeuda, planDeCarga, cargarCuotas, proyeccionDeudas, criptoUSD, patrimonio, ranking, gastadoTope, datosTorta, hayDatos, sumarAItem.

Moved but not aliased because the app never calls them (reachable as `TGMotor.x`, and by name in tests): TORTA_MAX, mesVacio, sinSigno, cerosFuera, sumaPagado, mesTope, mesesCorridos, cuotaPaga, totalConRecargo, repartoCuotas, valorCuota, pagadasHasta, pendientesDesde.

### Engine state for R4 review (no implementation)

Which function defines each D13 concept TODAY (all in the motor):

| Concept | Defined by today | Note |
|---|---|---|
| Registrado | `suma(items)`; `hayDatos` for "any data" | every loaded `monto`, paid or not |
| Realizado | `sumaPagado(items, ing)`; `estaPagado`; `calc.totalIngresos/totalGastos/totalDeudas` | `pagado === true`, plus "Del trabajo" income rows always |
| Pendiente | `calc.pendienteIngresos/Fijos/Variables/Gastos/Deudas` = `suma - sumaPagado` | no concept of overdue |
| Programado | does not exist | every future-month amount is just registered/pending; future transfers (ahorro/compra/venta/retiro/reposición of future months) flow into `serie` accumulations like current ones |
| Disponible inicial | does not exist | `calc` starts from zero each month; only `ahorroAnioAnterior`, `usdAnioAnterior`, `aReponerAnterior` carry stock across years (by `duplicar`) |
| Resultado del mes | `calc.disponibleLibre` (= realized income − realized expenses − ahorroMesARS + sacado − repuesto) and `calc.disponibleFinal` (− realized debt payments) | note: debts are subtracted separately; compraARS/ventaUSD/ahorroMesUSD are not in `disponibleLibre`, only in `serie` stocks |
| Pases netos | does not exist as one number; pieces: `ahorroMesARS`, `retiroARS`, `ventaARS`, `reposicionARS` inside `calc`; `compraARS/compraUSD/ventaUSD/ahorroMesUSD` inside `serie` | no month-to-month chain of available money |
| Disponible actual | does not exist | the UI "disponible" is the month's `disponibleFinal`; it resets each month |
| Proyectado al cierre | does not exist | pending is shown, but no projected closing |
| Patrimonio bruto / neto | `patrimonio(d)` (year-end `s[11]`: savings ARS valued at `cotizacionUSD` + USD stock + crypto) | no pending debt subtracted (so neither bruto nor neto in D7 terms); uses month 11, i.e. includes future months' flows (D7 wants only up to the current month); `estadoDeuda.saldo` holds the debt pending balance per plan |

What R4 will need to add (not done): per-month opening balance and an explicit chain opening → movements → closing → next opening; a "realized vs scheduled" rule for transfers keyed on the month index vs `mesTope(d.anio)` (note: `estaPagado(j, it)` already receives the month and ignores it, and `gastadoTope`/`datosTorta` now receive `j` too, so month-aware semantics can be added without touching callers); the migration marker (`arrastreDesde`) set by `normalizar`; confirmed-closing storage and the real-vs-recorded difference; a net-worth function that subtracts pending debt and stops at the current month; the reposición-without-debt rule (D11); and a golden regeneration plan: R4 changes numbers on purpose, so regenerate `motor-golden.json` only together with a table of every changed output (before → migration → after) as D14 requires.

### R4 candidates noticed during the extraction (not fixed, by D12)

- `estaPagado(j, it)` and `alternarPago(j, it)` ignore `j` (dead parameter); R4 will probably give it meaning.
- `serie` accumulates all 12 months, so `patrimonio` and `renderUSD` include future-month flows (D7 says up to the current month, D3 says scheduled transfers must not change current available).
- `calc.disponibleLibre` ignores `compraARS`/`compraUSD`/`ahorroMesUSD`/`ventaUSD`: they only move the `serie` stocks. A purchase of USD from available money does not reduce the month's available.
- `reposicionARS` larger than the pending `aReponer` still lowers `disponibleLibre` and raises `ahorroAcumulado` (money creation; D11 / E14 reposición rule). Pinned by the golden (month 10 of the corpus).
- `patrimonio` does not subtract pending debt although `estadoDeuda.saldo` exists.
- `normalizar` silently defaults `cotizacionUSD` to 1499 when 0/missing and migrates legacy `pagado` with `i <= mesTope(anio)` (current month counts as paid). Both pinned.
- `datosTorta` includes deudas, `ranking` does not (different "expense" definitions across charts).
- `proyeccionDeudas` falls back to `new Date().getMonth()` when a plan has no loaded row; `estadoDeuda` projects from `max(first unpaid month, mesTope(d.anio) + 1)`.
- `mesTope(anio)` no longer falls back to `D.anio` for a missing argument (nothing relied on it after R3).
- `cuantosPagos`/`diasDelMes` (pure) and `notaCompra`/`textoDeuda` (text) were left in the app on purpose; `cobroTxt` reads `mes`/`D`.

### Native review (R3 slice)

- Assess since 6717964 (plan fix c6a9ca4 + R3): medium, 1064 lines, review due. Consent granted,
  but `review start` stopped with `lens_context_budget_exceeded`: no review authority was created.
  Probable cause (not confirmed): the ~1 MB golden fixture. Per the stop table: review as
  smaller candidates (e.g. commit by commit) or disable review for this clone. Owner decided:
  review commit by commit, never force the fixture.
- Verified by the parent: fixture unchanged since f95a625; motor block has no references to
  D, T, document, window, innerHTML or localStorage (only comments/property names);
  `npm test` 273/273; `npm run test:e2e` 90/90.

### R3 closure: per-commit native reviews (2026-10-05)

Each candidate was isolated in a temporary detached `git worktree` (HEAD = the commit, base = its
parent) because review targets are always base-to-HEAD. Worktrees removed afterwards.

| Candidate | Lines | Lineage | Outcome |
|---|---|---|---|
| c6a9ca4 leerPlan fix | 48 | review-cfb4b893892a28bb | approved, acknowledged |
| a6dd7a4 engine extraction | 708 | review-80af020722a3eb3c | approved, acknowledged |
| 12d4a7c+3a8a7ae E2E + v1.31.4 | 31 | review-b0f456c2d1d32f86 | approved, acknowledged |
| f95a625 golden fixture | 239 (+1 MB JSON line) | review-1f942402e7a6c21b | single attempt: `lens_context_budget_exceeded`, no authority; not forced |

Findings:
- c6a9ca4 WARNING (blank optional plan field now blocks save): FALSE POSITIVE. Verified with the
  real functions: `parseMonto('')`, `parseEntero('')`, `parsePct('')` are 0; `leerPlan(true)` with
  blank recargo/antes gives `{total:100000,cuotas:3,recargo:0,antes:0}`. Two test-quality
  suggestions recorded, not changed.
- a6dd7a4 WARNING (unaliased motor names used by the app): FALSE POSITIVE. Static scan: none of the
  13 unaliased TGMotor exports is referenced by bare name in the app script; no `mesTope()` call
  without argument.
- a6dd7a4 WARNING (harness test cannot detect a missing alias): REAL test gap, introduced. Fixed:
  tests/alias.test.js (e89ba91) statically checks the alias block, with a negative case proving it
  reports a removed `calc` alias; misleading harness test title corrected (187dde0).
- 3a8a7ae WARNING (PC-export E2E re-implemented the slicing instead of calling versionPC): REAL test
  gap, introduced. Fixed in 6db11dd: E2E clicks a `data-act="verpc"` element (real delegation and
  real `versionPC()`), captures the Blob and checks embedded data (year, 12 months), markers once,
  motor before app (CRLF-tolerant regex, covers the CRLF suggestion), every inline script compiles.
  Mutation proof: breaking the embed in versionPC made this check FAIL (89/90); restored.
- 3a8a7ae SUGGESTION (alias-vs-motor calc comparison is tautological): recorded, not changed.

f95a625 fixture without native review — evidence that it is covered:
- At f95a625 (engine still inside the app IIFE, no motor block) `tests/motor.golden.test.js` passes
  155/155: the JSON is exactly the pre-extraction engine output.
- The JSON is byte-identical between f95a625 and HEAD (`git diff --quiet`).
- Non-vacuity: a one-line mutation in `calc` (savings subtracted twice) fails 13 golden tests.
- The 238 lines of executable test code in that commit (corpus, api, generator, test) were read by
  the parent; the test compares the full canonical output byte for byte plus per dataset/field.

Remaining unreviewed slice: 3a8a7ae..6db11dd (docs + the three test commits above), medium,
191 lines, `under_budget` → stays pending in the slice and joins the first R4 review.

Final checks: `npm test` 275/275, `npm run test:e2e` 90/90, tree clean, no push, no merge.

## Next step

R3 closed. R4 design proposal written in `odd/tasks/repair-sprint-1-r4-design.md` (formal model,
numeric chain cases, `hoy` injection, transfers, debts, net worth, "Del trabajo", reversible
migration, golden procedure, multi-tab, R4.1-R4.6 plan, owner decisions Q1-Q15). Stop: no R4
implementation until the owner approves the design and answers Q1-Q15.

## R4 progress

### R4.1

- STATUS: done. The engine no longer reads the system clock. `hoyDe(date)` is the only constructor of `hoy` ({anio, mes, dia, iso}, mes 0-based); the motor block has no `Date` reference at all.
- COMMIT: 9f205c8 `r4.1: inject system date into engine` (code, tests and this note's base).
- Signature changes (call graph followed): `normalizar(d, hoy)`, `mesTope(anio, hoy)`, `mesesCorridos(anio, hoy)`, `estadoDeuda(d, nombre, i, hoy)`, `cargarCuotas(d, nombre, desde, hoy)`, `proyeccionDeudas(d, hoy)` (clock fallback now `hoy.mes`). `serie`, `patrimonio`, `planDeCarga`, `calc`, `suma*`, parsers, `ranking`, `datosTorta`, `gastadoTope`, `repartoCuotas`, `estaPagado` stay time-free and unchanged. New export `hoyDe`; app alias `hoyDe` and app helper `hoyApp()` = `hoyDe(new Date())`.
- App call sites (all pass `hoyApp()`): estadoDeuda (fila de deuda, cierre de año), proyeccionDeudas (render deudas), normalizar (leer año, cargar, importar), cargarCuotas (carga masiva, hoja de carga). Trabajo date logic untouched; APPVER/sw not bumped (Q11).
- TESTS: RED first (`tests/motor.reloj.test.js`, `tests/motor.determinismo.test.js` failed on a480520: `new Date` in the motor, `hoyDe` missing). GREEN after: `npm test` 286 pass / 0 fail. Golden pins `hoy` built from TODAY; `tests/fixtures/motor-golden.json` unchanged (empty `git diff --stat a480520`), byte-identical. `loadMotor()` now runs with a POISONED Date (any clock read throws); determinism test evaluates the motor under fake clocks 2020-01-01 and 2030-06-15 with the same `hoy` and asserts identical output on the six mixed/legacy datasets (normalizar, serie, patrimonio, proyeccionDeudas, estadoDeuda, cargarCuotas, mesTope, mesesCorridos). `loadApp` exposes `app.hoy` and `app.hoyApp` (fake clock) for tests and extracted app functions.
- E2E: `npm run test:e2e` 90 pass / 0 fail.
- AUDIT: inline scripts compile (new Function); alias and inventory tests green, `inventario.data.js` unchanged (no membership change besides the new `hoyDe`).
- KNOWN RISKS: any future motor call to a temporal function without `hoy` throws TypeError (intended, no silent clock fallback); the app still uses Date for timestamps and Trabajo (R4.x/out of scope); `hoy.dia` and `hoy.iso` are not consumed yet (reserved for R4.3 realization of Trabajo/transfers).
- NEXT STEP: R4.2 per design section 11 (monthly chain and invariants I1-I5 as tests), building on explicit `hoy`.

### R4.2

- STATUS: done. New pure motor functions, NOT connected to the UI (no app alias, `index.html` diff is only the motor block): `estadoMes(anio, j, hoy)`, `flujosMes(d, j, hoy, ctx)`, `cadena(d, hoy, ctx)` -> `{meses[12], resumen}`, `pasivos(d, hoy)` -> `{total, detalle}`, `patrimonioNeto(d, hoy, ctx)`. `ctx = {pasesTrabajo, cierrePrevio, trabajoDisponible}` is built by the app (R4.4). Old `patrimonio`, `serie`, `calc` untouched; `tests/fixtures/motor-golden.json` byte-identical to 59ebbbf.
- COMMITS: 4e3c7d3 `r4.2: add financial model functions with contract tests` (functions, section 2/4/5/7 cases, builders, inventory classification `r4`), 26267e0 `r4.2: add invariant property tests` (I1-I7, 400 seeded random years each), af3dbba `r4.2: guard golden regeneration and pin R4 outputs` (new fixture `tests/fixtures/motor-golden-r4.json` with `{razon, baseCommit, hash}` metadata; both generators refuse to write without `TUGASTO_GOLDEN_RAZON`, tested).
- TESTS: RED first (`tests/r4.contrato.test.js`: 18/18 failed with `M.cadena is not a function`), GREEN after implementing (18/18). Contract numbers obtained: Sep apertura 50.000 / resultado 300.000 / pases -150.000 / cierre calc 200.000 / real 175.000 / diferencia -25.000; Oct apertura 175.000, disponible actual 825.000, proyectado 580.000, vencidos 20.000; Nov flat at 825.000 with projection 1.280.000; ahorro ARS a hoy 600.000; bruto 2.925.000, pasivos 300.000, neto 2.625.000; table (g) with Oct paid: Oct 175.000 -> 580.000, Nov 580.000 -> 1.280.000 and the telescoping sum 1.280.000. Invariants: 8 tests (I1-I7 + a branch-coverage guard so the properties are not vacuous), 400 random years each (I1/I2 over thousands of months, I3 4.800 months, I4/I6 hundreds of transitions); a mutation of the chain (`apertura = cierreCalc` instead of `cierre`) failed 2 of them. Golden R4: 27 datasets x 5 outputs. `npm test` 453 pass / 0 fail.
- E2E: `npm run test:e2e` 90 pass / 0 fail.
- AUDIT: motor still has no `Date` (`motor.reloj.test.js` green); alias and inventory tests green (`inventario.data.js` gets the new semantic `r4` and four entries); `git diff --quiet 59ebbbf -- tests/fixtures/motor-golden.json` clean.
- INTERPRETATIONS (where the contract is silent or compressed; none changes an approved money rule, all are pinned by the R4 golden and easy to flip):
  1. `cierrePrevio` is applied only when `arrastre.desde === 0` AND `inicial.origen === 'arrastre'` (the snapshot case of section 8); a `declarado`/`omitido` opening is an explicit user decision and wins. Origen is then reported as `anioAnterior` and `difAnioAnterior = cierrePrevio - calculadoOrigen` only when the snapshot exists and differs.
  2. `proyectado` of the CURRENT month also adds `trabajoProgramado` (Trabajo pases dated later in the same month): the contract lists them as Programado and they feed projections. Section 2 numbers are unaffected (no pases there).
  3. `vencidos` = pending expenses + pending installments of `pasado` months `>= desde` (obligations); overdue pending INCOME is reported apart as `vencidosIngresos`.
  4. Trabajo rows (several rows named "Del trabajo" are allowed): pases are allocated to the rows in order; what a row keeps beyond the pases is ordinary income with ITS OWN `pagado`; `reconciliar` is true only when the rows total less than the pases (pases then win). Sigma pases(M) includes pases of the month dated after `hoy` (scheduled) when deciding the excess, as the contract states it per month. Non-positive pases are ignored.
  5. `reposicionExcedente` uses serie()'s own order: pending before = prior aReponer + this month's retiro + ventaARS (serie treats both as `sacado`), so it equals exactly what serie's clamp absorbs.
  6. `disponibleActual` is `null` (`sinDisponible: true`, patrimonioNeto uses 0) when no non-legacy month is past/current: year without `arrastre`, `desde` beyond the last month, a whole future year, or `desde` in the future. The declared opening of a future month is never counted a hoy (I5).
  7. `reconfirmar` compares at cent precision (not `!==`) and is also true when `calculadoAlConfirmar` is missing; a past month's `proyectado` is its chain closing (`cierreReal ?? cierreCalc`); the current month's `disponibleActual` is its `cierreCalc`.
  8. `pasivos` counts plan saldo with `estadoDeuda(..., min(11, mesTope))` so ticks in future months never reduce it; debts without plan (no plan or `cuotas` 0) count unticked rows `monto > 0` in past/current months, grouped by trimmed name.
  9. The `ahorroMesUSD`/`compra`/`venta` USD legs are kept as serie() does them (compraARS leaves savings ARS, ventaARS enters Disponible); I3 is therefore tested per pocket as `Disponible + Ahorro ARS = ventaARS - compraARS` (plus Trabajo) and USD `= ahorroMesUSD + compraUSD - ventaUSD`.
- KNOWN RISKS: functions are unused until R4.4, so real-data behavior (decimals, a year with partial arrastre) is only covered by the corpus and the random years; money amounts with decimals can differ at float noise level (visible in `mixed-con-arrastre-desde-mayo`); `pasivos` is count-based (Q14) and ignores edited installment amounts; scheduled transfers are treated as realized when their month arrives (Q5/D1).
- NEXT STEP: R4.3 (migration: `arrastre`/`cierreReal` written by `normalizar`/`duplicar`, pre-R4 snapshot, multi-tab `rev`), reusing `cadena` as the reader. Golden regeneration of the OLD fixture stays reserved for R4.4 (needs `TUGASTO_GOLDEN_RAZON`).

#### R4.1 / R4.2 native reviews (parent)

- R4.1 slice 3a8a7ae..e4669dc (926 lines): approved, acknowledged (review-2ecd86c348008b01). REAL
  finding: no guard that app call sites pass `hoy` → tests/hoy-llamadas.test.js (static arity check +
  negative case); 2 test-quality suggestions applied (tautology removed, direct poisoned-clock
  assertion). Commit 59ebbbf.
- R4.2 engine+tests e4669dc..26267e0 (745 lines, worktree): approved, acknowledged
  (review-98de80990eaba357). Findings, all fixed RED→GREEN in 6bbda16: hoy-llamadas did not list the
  new temporal functions (REAL); `flujosMes` re-implemented the paid predicate instead of
  `estaPagado` (REAL, one semantic source D13); `reposicionExcedente` reported in future months
  (REAL; now realized-only + `reposicionExcedenteProg`). R4 golden regenerated with reason; diff
  verified mechanically: +324 new fields, 3 future values moved, 0 other changes
  (tests/fixtures/golden-diff-R4.2-revision.md). Legacy golden untouched.
- R4.2 remainder 26267e0..6bbda16 (281 lines incl. the ~330 KB R4 fixture): single native attempt →
  `lens_context_budget_exceeded`, no authority. Parent review of the executable non-fixture code:
  both generators refuse to write without `TUGASTO_GOLDEN_RAZON` (tested by spawning them and
  asserting the fixtures are unchanged); the R4 golden test checks metadata reason, base commit and
  data hash, per dataset/field and byte-identical; corpus-r4 builds datasets only (no engine logic).
  The fixture itself is generated output, covered by the hash and the mechanical diff.
- Verified independently by the parent: §2 contract numbers from the real motor (Sep 200.000 / −25.000,
  Oct 825.000 / 580.000, patrimonio 2.925.000 / 2.625.000, chain 580.000 → 1.280.000).
- State at 6bbda16: npm test 456/456, test:e2e 90/90, tree clean.

### R4.3

- STATUS: done. Migration layer without touching what the screen computes: `cadena` is still not wired to the UI, `tests/fixtures/motor-golden.json` and `motor-golden-r4.json` byte-identical to 4512c18 (`git diff --quiet 4512c18 -- ...` clean; no regeneration, no `golden-diff-R4.3.md` needed). No APPVER/sw bump (Q11). Order of the migration: OLD DATA -> BACKUP (pre-R4 snapshot) -> normalizar -> migrar (`iniciarArrastre`) -> validar (`validarArrastre`/`validarCierreReal`) -> modelo; if the backup cannot be stored nothing is migrated.
- COMMITS: 652ac70 `r4.3: preserve and validate saldo model fields` (index.html motor block only + tests), e3c97eb `r4.3: add pre-R4 snapshot, model start and multi-tab revision guard` (storage layer + tests + E2E). This note: `r4.3: record progress`. (Two code commits instead of three: the storage layer and the revision guard share `guardar/escribirAnios/restaurarTexto/duplicar`, so splitting them would not keep each commit green.)
- WHAT (index.html lines at e3c97eb):
  1. `normalizar` (1801) preserves/validates `arrastre` (`validarArrastre` 1877: `desde` 0-11 or the whole field is dropped, `inicial` fields coerced or dropped one by one, `origen` in declarado/omitido/arrastre), month `cierreReal` (`validarCierreReal` 1895: needs a numeric `valor`; `calculadoAlConfirmar`/`confirmadoEl` optional) and `rev` (`revValida` 1876). It NEVER creates them (absent stays absent, so every pre-existing normalized blob and the golden are unchanged); year/month level only.
  2. Pre-R4 snapshot: `asegurarSnapshotR4` (6409) copies every own key (`claveMia`) into `kibo.respaldo.pre-r4` `{version, fecha, datos}` before the first model write and sets the marker `kibo.modeloSaldos` (own key, added to `CLAVES_PROPIAS`; the snapshot key itself is NOT an own key, like pre130); `vencerRespaldoR4` removes it after 30 days at startup (the marker stays, so it is never retaken); `volverAntesDeR4` (6435) restores only own keys and removes marker + snapshot; Ajustes row `volverR4` ("Volver a como estaba antes de los saldos") shown only while the snapshot is under 30 days old.
  3. `iniciarArrastre(d, hoy, declarado, ctx)` (motor, 2263): pure; `desde = hoy.mes`, `apertura = declarado - (resultado + pasesNetos of that month up to hoy)` rounded to cents, origen `declarado`; `null/undefined` -> origen `omitido`, `apertura null`; returns `null` for another year or a non-numeric declared value. App `activarSaldos(declarado)` (6469): idempotent, takes the snapshot first (abort if it fails), saves, rolls back the in-memory field if the save is refused. NOT called from any screen (guarded by a static test). `ctxModelo`/`cierreAnioAnterior` build the motor ctx (Trabajo pases, live previous-year closing) for it and for `duplicar`.
  4. `duplicar` (3911): the new year never inherits `arrastre`, `rev` or any `cierreReal`; if the old year has `arrastre` the new one gets `{desde:0, inicial:{apertura: Dec cierre (confirmed else calculated), origen:'arrastre', calculadoOrigen: Dec cierreCalc}}`; old years stay legacy.
  5. Q9: `normalizar` measures "mes ya corrido" of the legacy `pagado` inference against the month of `d.actualizado` when it is a usable date not later than `hoy` (otherwise `hoy`, as before). Only runs when `!pagoExplicito`.
  6. Q12: `rev` per year blob and Trabajo blob. `escribirConRev` (3603) re-reads the stored rev before writing; mismatch -> no write, notice "Hay cambios hechos en otra pestaña. Recargá para no perderlos." (+ Recargar button, in `#avisos`), tab marked `obsoleta` (no more writes until reload); success increments rev. `window` `storage` listener `alCambiarOtraPestana` (3628): changed key = this year or `kibo.trabajo`; no unsaved edits (not `sucio`, no pending autosave, no open sheet, no focused field) -> silent reload; otherwise the notice. `normTrab` preserves `rev`; `aplicarPase` (other-year write) and `deshacerTj` go through the same rule.
  7. Backup/restore: `armarCopia` already carries the year blobs, so the fields travel (tested). `escribirAnios` snapshots first when the backup carries `arrastre/cierreReal`, and sets `rev = max(stored, incoming) + 1` when it overwrites a stored year (a restore can never be overwritten by a tab that loaded an older revision); the Trabajo restore adopts the stored rev the same way. An older backup without `arrastre` leaves the year without it.
- TESTS: RED first: `tests/r4.migracion.test.js` 36 of 42 failed on 4512c18 (`M.iniciarArrastre is not a function`, missing app functions, no rev); the 6 that passed were behaviors that already held (never-creates, baseline round trip, legacy isolation, two Q9 cases equal to the old behavior). GREEN after: 42/42 (`npm test` 498 pass / 0 fail; was 456). Covers minimal / R4-corpus / 7f7ad40-era / v1.31.x / USD+crypto / Trabajo / partial-and-corrupt blobs; no loss + idempotence + additive-only (strip arrastre/cierreReal/rev = pre-migration blob), I6 legacy isolation, the BASELINE normalizar of 7f7ad40 (verbatim fixture `tests/fixtures/baseline-normalizar-7f7ad40.js`) keeping arrastre/cierreReal/rev, section 2 numbers (declare 825.000 -> apertura 175.000 and `disponibleActual` back to 825.000), `disponibleActual == declared` over several datasets, snapshot create/expiry/restore/own-keys-only, `activarSaldos` ordering and idempotence, duplicar chain (calculated, confirmed, legacy, live-vs-snapshot previous year), two fake tabs sharing one localStorage, storage-event cases, Trabajo rev, backup -> restore (fresh device, over existing data, older backup). Existing tests adapted: `claves.test.js` (marker key in the own-key list, snapshot key not), `copias.test.js` (loads `revGuardada`/`escribirConRev`), `hoy-llamadas` (`iniciarArrastre` needs 3 args), `inventario.data.js` (`ctxModelo` otro, `duplicar` note).
- E2E: `npm run test:e2e` 121 pass / 0 fail (was 90). New (copy-only hook extended with `activarSaldos`, `armarCopia`, `restaurarTexto`, `pendiente`, `obsoleta`, `sucio`): two real tabs on the same origin (second CDP target): A saves, B with unsaved edits is not reloaded, shows the notice and cannot overwrite; with the stale flag cleared the rev check still refuses; a tab without edits reloads silently; `activarSaldos` -> arrastre/cierreReal/rev survive a reload and the Oct "disponible" on screen is unchanged (150.000); Ajustes row visible; "volver" through the real UI restores the exact old text and removes marker and snapshot; backup -> wipe -> restore keeps the fields; an older backup leaves the year without them.
- AUDIT: both inline scripts compile (`new Function`); the motor block still has no `Date`; alias, inventory and hoy-llamadas guards green; `git diff --quiet 4512c18 -- tests/fixtures/motor-golden.json tests/fixtures/motor-golden-r4.json` clean; `git status --porcelain` empty after the commits.
- Q9 OUTCOME: implemented. The legacy golden does not pin it: its raw datasets and the R4 corpus carry no `actualizado`, so the reference stays `hoy` and every golden output is unchanged (no STOP, no regeneration; the design expectation that Q9 regenerates the legacy golden does not materialize with the current corpus). The behavior is pinned by the Q9 cases of `tests/r4.migracion.test.js` instead.
- INTERPRETATIONS (contract silent; none changes an approved money rule):
  1. "R4 marker" = a new own key `kibo.modeloSaldos` (ISO date of the first model write on the device); it decides "first write" and is removed by the restore. The snapshot key is deliberately not an own key (it must not snapshot itself; same as pre130).
  2. A malformed `arrastre` without a readable `desde` is dropped entirely (a defaulted 0 would turn a whole year into model months); unknown keys inside `arrastre/inicial` are not preserved.
  3. `iniciarArrastre` returns `null` when `d.anio !== hoy.anio` (the model starts in the year that contains hoy); `declaradoEl` is also set for `omitido`; `calculadoOrigen` only exists for origen `arrastre`.
  4. A stored blob that vanished (cleared by the browser) does not count as a revision conflict: writing recreates it and overwrites nothing.
  5. `activarSaldos` and `duplicar` refuse to write when the snapshot cannot be stored; a restore does not (the user explicitly asked for it).
- KNOWN RISKS: localStorage has no compare-and-set, so two tabs saving within the same few milliseconds can still race (accepted: minimal mechanism, Q12); a stale tab keeps its unsaved edits in memory but they are lost on "Recargar" (that is what the text says); `deshacerTj` and `aplicarPase` rev handling are covered by reading, not by a dedicated test; `ctxModelo` builds Trabajo pases from `T.pases` as R4.4 will, but R4.4 may refine it; `volverAntesDeR4` also reverts Trabajo and everything after the snapshot (same trade-off as pre130); the first-use prompt and the "estimado"/labels are R5.
- NEXT STEP: R4.4 integration (switch consumers to `cadena`/`patrimonioNeto`, Trabajo pases into ctx, future pases scheduled, golden regeneration commit with `golden-diff-R4.4.md`), then R5 (first-use prompt calling `activarSaldos`, Editar, labels).

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
| cargarCuotas | 2071 | otro | writes planned installment amounts into debt rows (E14 fixed in R2: the plan's last installment takes the rounding remainder) |
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
| hayDatos | 3377 | registrado | E1 fixed in R2 (was realizado): any item with monto > 0, any month flow field or Trabajo data |
| cuotaPaga | (new in R2) | realizado | E9: an installment is paid only when ticked AND monto > 0 |
| exportarCSV | 3435 | realizado | exports serie() realized totals per month |
| duplicar | 3447 | otro | copies the year: carries serie() stock, zeroes every monto/pagado |
| gastoRapido | 3642 | otro | editor/writer of a single item amount; no aggregation |
| sumarAItem | 3667 | otro | editor/writer of a single item amount; no aggregation; forces pagado when the previous monto was 0 |
| sumarGasto | 3671 | otro | editor/writer of a single item amount; no aggregation; logs a movement |
| quitarMov | 3690 | otro | editor/writer of a single item amount; no aggregation (E9 fixed in R2: undo restores the previous pagado of an item left empty) |
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

Totals at R1: {"otro":44,"registrado":4,"realizado":9,"mixto":6}; R2 moved hayDatos to registrado and added cuotaPaga (realizado). Characterization of the R2 behaviors: `tests/caracterizacion.test.js` (names now prefixed "[R2 fixed]"). Line numbers in the table are the R1 baseline.
