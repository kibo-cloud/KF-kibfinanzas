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
  smaller candidates (e.g. commit by commit) or disable review for this clone. Pending owner
  decision.
- Verified by the parent: fixture unchanged since f95a625; motor block has no references to
  D, T, document, window, innerHTML or localStorage (only comments/property names);
  `npm test` 273/273; `npm run test:e2e` 90/90.

## Next step

Stop before R4: review of the extracted engine (this document, `tests/motor.golden.test.js`) and the exact R4 migration plan.

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
