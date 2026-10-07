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
  The official list is recorded verbatim in "D16 — official acceptance list (verbatim)" below.
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

#### R4.3 native review (parent, 2026-10-06)

- Slice 4512c18..bf86e0f (9 files, 1090 lines, medium, reliability lens): consent granted by the owner;
  approved and acknowledged (review-6fc93dcdc772585a, authority burned).
- CRITICAL finding (REAL, introduced): restoring a backup whose Trabajo `rev` is higher than the stored
  one set `T.rev = max(stored, incoming)`, so `escribirConRev` saw a conflict, the Trabajo restore was
  refused and the tab was wrongly marked `obsoleta`. Fixed in 4c430ba: the restore adopts the STORED
  rev (`escribirConRev` adds 1, still above any tab). RED first (new test in `tests/r4.migracion.test.js`
  failed: `tope` 1 instead of 55), GREEN after; `npm test` 499/499, `test:e2e` 121/121. Targeted
  validator approved.
- Advisory (non-blocking, follow-ups for R4.5/R4.6): `duplicar` save path untested (index.html:3914);
  `deshacerTj`/`aplicarPase` rev paths covered by reading only (index.html:4891-4894); Trabajo restore
  coverage beyond the new case (tests/r4.migracion.test.js:534-561).
- Next reviewed boundary: 4c430ba.

### R4.4

- STATUS: done. The screen reads the balance model ONLY for a year with `arrastre` (months `>= desde`); a year without it (every user until R5 calls `activarSaldos`) and every month before `desde` render exactly as before (the card IS `calc(m)`, the net worth IS the old `patrimonio(d)`, Trabajo subtracts every pase at once). No motor change: `tests/fixtures/motor-golden.json` and `motor-golden-r4.json` byte-identical to b009cf8, so no `test(golden): regenerate for R4.4` commit and no `golden-diff-R4.4.md`. No APPVER/sw bump (Q11).
- COMMITS: e968338 `r4.4: wire the balance model into the month card, Trabajo and net worth` (index.html + tests + E2E + inventory; one work unit, ~300 authored lines: the card, Trabajo and net worth share `vistaModelo`/`resumenTrab`, so a split would not keep each commit meaningful). This note: `r4.4: record progress`.
- WHAT (index.html lines at e968338):
  1. Aliases `flujosMes`, `patrimonioNeto` (2412-2413; the alias guard caught their absence first).
  2. `vistaModelo(d, hoy)` (2682): null without `arrastre`; else `{hoy, ctx: ctxModelo, cad: cadena}`. `mesDelModelo` (2687). `tilesMes(d, j, vm)` (2688): same fields as `calc()`; legacy month -> `calc()` itself; model month -> Ingresos = realized income + realized Trabajo pases (past/current) or scheduled income + scheduled pases (future), Gastos = realized or scheduled expenses, Ahorro = `ahorroMesARS`, Disponible final = `cierre` (past, confirmed real if any) / `cierreCalc` = disponible actual (current) / `proyectado` (future); bars and "ahorro sugerido" recomputed from those. `tilesHoy` (2702) feeds `renderMes` (2709), `refrescar` (3529) and `pintarTorta` (3006, "% de lo que entró").
  3. Q3: `tieneTilde(d, j, k, it)` (2704), used by `seccion` (2872): "Del trabajo" gets a checkbox only in a model month without pases (the motor already treated such a row as ordinary income with its own `pagado`; only the UI was missing).
  4. Q4: `resumenTrab` (4967) adds `pasadoProgramado` = pases dated after hoy whose destination month is a model month (`paseAlModelo` 5038, destination year = open `D` or `leerAnio`, cached per call); `disponible = cobrado - gastado - pasado + pasadoProgramado`; `paraPasar` = the old value, used by `abrirPase`/`notaPase`/`guardarPase`/`tjPaseTodo` so a scheduled pase cannot be committed twice; `explicaDisp` (5198) subtracts only the pases already out.
  5. Q2/D7: `trabajoDisponible` (5043), `patrimonioPantalla(d, hoy)` (3217) used by `renderUSD` (3223): legacy -> `patrimonio(d)`; model -> `patrimonioNeto` with `ctx.trabajoDisponible`, shown as `neto / cotizacionUSD` (big number) and `neto` in pesos; component rows (savings ARS, USD, crypto) now a hoy.
- TESTS: RED first: `tests/r4.integracion.test.js` 13/13 failed on b009cf8 (`function not found: vistaModelo` / `patrimonioPantalla`); behavioral RED of Q4 on the baseline `resumenTrab`: `disponible = 500000` where the model year needs 700.000. GREEN after: 13/13; `npm test` 512 pass / 0 fail (was 499). Covers: every corpus dataset without arrastre -> card deepEqual `calc()` for 12 months and net worth deepEqual `patrimonio()`; legacy "Del trabajo" has no checkbox and stays always realized; section 2 numbers on the card (Sep 175.000 confirmed, Oct 825.000, Nov 1.280.000 projected; ticking Luz -> 800.000); legacy month inside a model year = `calc()`; Q4 future pase (next month and later in the current month), destination before `desde`, destination year read from storage (model vs legacy); Q3 checkbox with/without pases; net worth 2.625.000 + Trabajo.
- E2E: `npm run test:e2e` 140 pass / 0 fail (was 121). New (hook extended, copy only, with `patrimonio`, `patrimonioPantalla`, `hoyApp`, `fARS`, `fUSD`): legacy year with a realized and a future pase -> Oct card 450.000 = `calc()`, tiles unchanged, no checkbox on "Del trabajo", Trabajo 500.000, Patrimonio = old `patrimonio()` (US$ 200 / $250.000); the same data with `arrastre` desde Oct (apertura 100.000) -> Oct card 550.000 (chain), Nov 750.000 (projected with the scheduled pase), Trabajo 700.000 (the future pase stays), Patrimonio US$ 1.200 / $1.500.000 (550.000 + 250.000 + 700.000); Q3 by real click (250.000 -> 330.000); `activarSaldos(400000)` -> the Oct card shows 400.000 (the R4.3 check now asserts `calc()` is unchanged, the screen check is new). RED: the same run.mjs against a worktree of b009cf8 gave 127 pass / 10 fail: every model check failed (Oct 450.000 instead of 550.000, Nov 200.000 instead of 750.000, Trabajo 500.000 instead of 700.000, no checkbox, activation still 150.000) while every legacy check passed.
- AUDIT: both inline scripts compile (`new Function`); motor block untouched (still no `Date`); alias, inventory and hoy-llamadas guards green; `git diff --quiet b009cf8 -- tests/fixtures/motor-golden.json tests/fixtures/motor-golden-r4.json` clean. Inventory (`tests/inventario.data.js`): `tilesMes` added (r4); `renderMes`, `refrescar`, `seccion`, `renderUSD`, `resumenTrab`, `ctxModelo` reasons updated; `pintarTorta` removed (it no longer sums money itself, it renders `tilesHoy()`).
- INTERPRETATIONS (contract silent; none adds a money rule):
  1. Card per month state: past -> chain closing (`cierreReal ?? cierreCalc`), current -> `cierreCalc` (= disponible actual), future -> `proyectado`; tiles show realized flows for past/current and scheduled flows for a future month (so the future card adds up to its projection). Labels unchanged ("Disponible final · <mes>"): the number keeps meaning "what is left at the end of that month"; "estimado"/opening line are R5.
  2. "Ingresos" on the card includes realized Trabajo pases although the model books them as a transfer (pases netos): the user saw them as income before and the card total is unchanged when pases and rows match.
  3. Q4 applies only when the pase's destination month is a model month; a pase into a legacy month keeps leaving Trabajo at once, because the legacy "Del trabajo" row already counts it as income (otherwise the money would be in both pockets).
  4. Trabajo cash is included in the net worth of a model year whatever year is open (it is a hoy).
  5. The "% de lo que entró" of the pie and "ahorro sugerido" follow the card's Ingresos.
- ON-SCREEN NUMBERS THAT CHANGE (year with `arrastre`, months `>= desde` only): month card "Disponible final" (+ its red/green color and pulse), Ingresos and Gastos tiles, the two bars, "Con esa meta te tocaría ahorrar", the pie's "% de lo que entró"; "Del trabajo" checkbox (Q3); Dólares > "Patrimonio total" header, big number, pesos line, and its rows "Ahorro líquido en pesos" / "Dólares guardados" (a hoy instead of year end); Trabajo > "Disponible del trabajo", its explanation and the CSV line, when a future pase goes to a model month. Unchanged: Ahorro tile, section subtotals, topes, notes a reponer/compra, "El año" table and CSV, Dólares month table, "Cripto".
- KNOWN RISKS: "Patrimonio total" no longer equals the sum of the three rows shown (Disponible, Trabajo and Deudas have no row yet: R5 labels); the pase sheet says "Disponible" for `paraPasar` while Trabajo's big number includes scheduled pases (differ only with a scheduled pase into a model month); "El año" table, year CSV and "Año por año" keep `calc()/serie()` flows for every year, so in a model year an unticked "Del trabajo" without pases still counts there (Q3 not applied) and the "Disponible" column is the month flow, not the chain; a "Del trabajo" row whose amount exceeds its pases keeps the excess pending with no checkbox (locked row); `renglonTrabajo` still matches by `trim().toLowerCase()` (accented variants); `paseAlModelo` reads other years from storage on every `resumenTrab` call.
- NEXT STEP: R4.5 validation (17-case matrix D16 with evidence, before -> migration -> after report, native review of b009cf8..HEAD), deciding there whether "El año"/CSV move to the chain; then R5 (first-use prompt, Editar, labels incl. the patrimonio rows).
- OWNER DECISION (2026-10-06): the Patrimonio rows stay as they are until R5; R4.4 does not change the
  visual structure of Patrimonio. Closed rules for R4.4: a year without `arrastre` looks exactly as
  before; a year with `arrastre` uses the approved model; no new money rule; no golden change without a
  prior justified report; future Trabajo pases are never deducted before their date.
- R5 UX DEBT (MUST, owner wording): when "Patrimonio total" represents net worth, the interface must
  explain clearly and auditably how the total is composed, including Disponible, Trabajo and Deudas. It
  must not remain a number whose composition the user has to infer.

#### R4.4 native review and closure (parent, 2026-10-06)

- Re-verified after the writer: `npm test` 512/512, `npm run test:e2e` 140/140 (re-run by the parent),
  both golden fixtures byte-identical to b009cf8, tree clean.
- Native assessment of 4c430ba..908afee: medium, 369 lines, `under_budget` (not due). Review requested
  explicitly to close the stage; owner granted consent. Reliability lens: approved, no correction,
  acknowledged (review-7ff05da739f4b4f5, authority burned). Next reviewed boundary: 908afee.
- Advisory WARNING `R3-pase-validation-untested` (the Q4 double-pass guard was unproved through the pase
  sheet): covered in 02ac5a5 by a test that drives the real `guardarPase` (600.000 above `paraPasar`
  500.000 but under `disponible` 700.000 is rejected; exactly 500.000 is accepted). Passed on the
  existing code; mutation check (validation switched to `disponible`) made it fail, then restored.
  `npm test` 513/513, `test:e2e` 140/140. Assessed 908afee..02ac5a5: medium, 30 lines, under budget
  (pending in the next slice).
- Advisory SUGGESTION `R3-explicaDisp-untested` (index.html:5201-5202, explanation text with a scheduled
  pase): open, for R4.5.

### R4.5

- STATUS: done (validation and evidence). Full matrix, complementary coverage, leftover classification and the before → migration →
  after report: `odd/tasks/repair-sprint-1-r4.5-matrix.md`.
- COMMITS: f0886f3 `r4.5: add the D16 acceptance matrix tests and screen checks` (`tests/r4.matriz.test.js`, harness
  `tests/fixtures/r45-harness.js`, 16 E2E checks), d300d25 `r4.5: add complementary coverage, leftover pins and the before/after report`
  (`tests/r4.cobertura.test.js`, `tests/fixtures/r45-antes-despues.js`), 0ff866d `r4.5: fix stale tab writing another year when passing
  Trabajo money` (index.html 1 line + RED test), this note `r4.5: record progress`.
- D16 (17 official cases, one test each `D16-01`..`D16-17`): 16 PASS, 1 PENDING-R7 (case 15, gasto rápido sobre pendiente: today the
  amount is added to the pending row without asking, the money spent is not deducted from Disponible; R2 E9 undo holds), 0 FAIL.
  Cases 5 and 17 validated on the model/migration (Editar and the first-use prompt are R5); case 14 passes on the model and the
  headline, the gross row is R5 (owner: Patrimonio rows stay until R5).
- Complementary (21, `C-xx`, not D16): 21 PASS (C-18 after the fix); 7 new tests, the rest cite existing tests.
- FAILs found and classification:
  1. REAL R4.3 bug, fixed (0ff866d): a stale tab (`obsoleta`) passing Trabajo money to ANOTHER year still wrote that year's blob while
     the Trabajo save was refused, so the row without its pase counted the money twice. RED `L-07` on 0b31901, GREEN after
     `aplicarPase` refuses (and shows the notice) when the tab is stale. Also covers `quitarPase` from a stale tab.
  2. Accent / spacing variants of "Del trabajo" (`L-03b`, node:test `todo`): `renglonTrabajo` (trim/lowercase) vs `clave()` makes a
     pase create a second row and the user's unticked amount becomes realized (Disponible 400.000 instead of 300.000). Pre-existing,
     exposed by Q3. NOT fixed: changing the writer changes which existing row a pase/undo touches; needs an owner rule (R8 Trabajo).
- Leftovers classified: "El año" table, year CSV and "Año por año" still read `serie()`/`calc()` in a model year (Q3 not applied there,
  "Disponible" column = month flow, "Acumulado" = year end) — owner decision, pinned by `L-01`; "Del trabajo" above its pases is a locked
  pending excess — R5 UX debt (`L-02`); R4.3 advisories covered (`L-05` duplicar real save, `L-06` other-year pase revs, `L-08`
  deshacerTj revs, `L-09` Trabajo restore); `explicaDisp` with a scheduled pase correct (`L-04`). No contradiction with Q1-Q15.
- TESTS: `npm test` 549 (548 pass, 0 fail, 1 todo) — was 513; `npm run test:e2e` 156 pass / 0 fail — was 140. Both goldens
  byte-identical to 0b31901 (no regeneration).
- KNOWN RISKS: `L-10` (pinned, accepted under Q12): with a missed storage event, a pase into the open year can store the year row while
  the Trabajo save is refused (two blobs, no transaction); `num()` reads legacy text "1.500" as 1.5 (pre-R1 behavior, the app no longer stores text amounts).
- OWNER DECISIONS NEEDED: (1) whether "El año" table, year CSV and "Año por año" move to the chain/Q3 in a model year; (2) the
  "Del trabajo" matcher rule for existing rows (L-03b); (3) approval of the matrix (design section 11, R4.5 acceptance).
- NEXT STEP: owner approval of the matrix and decisions (1)-(2), then R4.6 cleanup and R5.

#### R4.5 native review and closure (parent, 2026-10-06)

- Parent re-verification after the writer: `npm test` 548 pass / 0 fail / 1 todo, `npm run test:e2e` 156/156 (re-run), goldens
  byte-identical, tree clean; mutation check: removing the 0ff866d guard makes `L-07` fail.
- Native review of 908afee..0cd42de (9 files, 1074 lines, medium, `slice_budget_reached`; covers 02ac5a5): owner granted consent;
  reliability lens approved with no correction; acknowledged (review-15d6db26ee406280, authority burned). Next reviewed boundary 0cd42de.
- Advisories: WARNINGs R3-stale-toast-misleading and R3-stale-quitarPase-unproved (consequence of 0ff866d: a stale tab removed the
  pase from memory and said "Pase borrado") → fixed in 696077f (`quitarPase` refuses in a stale tab), RED `L-07b` first, GREEN after;
  `npm test` 550 (549 pass, 0 fail, 1 todo), `test:e2e` 156/156, goldens identical. SUGGESTIONs left open for R4.6: `L-10` pins a
  known inconsistency as a passing assertion (should read as a risk marker / todo); D16-16 E2E rejection check waits 300 ms and asserts
  no visible rejection.

#### Year views on the chain (owner decision 2026-10-06)

- DECISION (owner, binding): in a year WITH `arrastre`, "El año" (year table), the year CSV and "Año por año" use the SAME chained
  balance model as the month card (`cadena`/`tilesMes`/`vistaModelo`, R4.4); a year WITHOUT `arrastre` behaves exactly as before.
  Correction derived from the inconsistency pinned by `L-01`; D16 stays the official matrix. Closes owner decision (1) above.
- MAPPING: `odd/tasks/repair-sprint-1-r4.5-matrix.md` section E (consumers, before → after for the L-01 and section 2 datasets,
  per-column change/keep with the decision behind each number). Commit 8fb7633.
- CONSUMERS (index.html at 374d899): new `serieVista(d, hoy)` (2706): `serie()` itself without `arrastre`; a model month overlays
  `tilesMes` (one semantic source, D13). `renderAnio` (3112): table, "Ingresos y gastos" chart and "Año por año" (3176, open and
  stored years) read it; in a model year the Disponible total and the "Cierre" header are December's card value. `exportarCSV`
  (3954) reads it. Months before `desde` stay `calc()` (D4/I6).
- BEFORE → AFTER (L-01 dataset, hoy 2026-10-15): Oct Ingresos 580.000 → 500.000 (Q3), Oct Disponible 430.000 → 350.000 (disponible a
  hoy), Nov/Dec Disponible −200.000/0 → 230.000/230.000 (projected), Total Disponible 230.000 (sum) → 230.000 (December), "Año por año"
  Ingresos 580.000 → 500.000; Acumulado 250.000 unchanged. Section 2: Sep 150.000 → 175.000 (confirmed), Oct 650.000 → 825.000, Nov
  Ingresos 0 → 1.000.000 and Disponible −200.000 → 1.280.000, Total Ingresos 2.000.000 → 3.000.000, Total Disponible 600.000 → 1.280.000.
- TESTS: `tests/r4.anio.test.js` (6): (a) legacy year byte-identical "El año" HTML + CSV over the 9 motor-corpus datasets against
  `tests/fixtures/anio-legacy.json` (generated on 0ad13c1 code by `tests/fixtures/generar-anio-legacy.js`, refuses without
  `TUGASTO_GOLDEN_RAZON`; harness `tests/fixtures/anio-vistas.js` renders the real `renderAnio`/`exportarCSV`); (b) L-01 and section 2
  rows = `tilesMes` month by month, legacy months = `calc()`, totals and header; (c) CSV = card = "El año" cell; (d) "Año por año" open +
  stored model years sum the card rows, legacy year keeps `serie()`, guards against 580.000; structure + `serieVista` = `serie()` for
  every corpus dataset. RED on 0ad13c1: 5 of 6 failed (Oct 580.000/430.000 instead of 500.000/350.000, Sep 150.000 instead of 175.000,
  CSV 580000/430000, "Año por año" 580.000, `serieVista` missing); (a) passed before and after (regression guard). GREEN 6/6. `L-01`
  rewritten to pin the new behavior (it pinned the divergence). `seguridad` year-CSV test loads `serieVista`/`vistaModelo`; inventory:
  `serieVista` added (r4), `exportarCSV` removed (no longer sums money itself; probe in `inventario.test.js` moved to `serieVista`),
  `renderAnio` reason updated. `npm test` 556 (555 pass, 0 fail, 1 todo) — was 550.
- E2E: 7 new checks in the R4.4 block (hoy 2026-10-04): legacy year Oct row 500.000/50.000/450.000, Total 700.000/50.000/650.000,
  CSV = `serie()`; model year Oct row 500.000/50.000/550.000, Nov 200.000/—/750.000, Total Disponible 750.000, CSV = card. RED: the
  same run.mjs on a 0ad13c1 worktree gave 159 pass / 4 fail (all model checks). GREEN `npm run test:e2e` 163/163 — was 156.
- GOLDENS: `motor-golden.json` and `motor-golden-r4.json` byte-identical to 0ad13c1 (motor block untouched). No APPVER bump (Q11).
- STOP ITEMS (unchanged, documented in matrix E.3): (1) Deudas column and "Año por año" Deudas stay paid installments (`tilesMes` keeps
  `calc().totalDeudas`, no card tile; a future model month's scheduled installment is in the projected Disponible but not in the
  column); (2) CSV "Gastos fijos"/"Gastos variables" stay paid subtotals (in a future model month Gastos ≠ fijos + variables; splitting
  the scheduled amount would duplicate `flujosMes` logic); (3) `resumenAnio` (summary card on "El año") keeps `serie()`: its text is a
  month flow ("gastaste más de lo que entró"), so in a model year its "Por mes entran" average can differ from the table (L-01 580.000
  vs 500.000). Judgment for owner confirmation: the Disponible total / "Cierre" header in a model year = December's card value.
- NOT TOUCHED: Patrimonio rows (R5), "Del trabajo" matcher (L-03b), motor block.
- MODEL RULE (owner-approved 2026-10-06, point 4): in a year WITH `arrastre`, "Total Disponible" of "Los doce meses" and the header
  "Cierre" represent the available balance at the close of the LAST month of the year (December): `serieVista(d, hoy)[11].disponibleFinal`
  (index.html `renderAnio`, `if(s[11].modelo) T.f = s[11].disponibleFinal`). They never sum monthly balances. A year WITHOUT `arrastre`
  keeps its previous behavior (byte-identical legacy test). Pinned by `tests/r4.anio.test.js` "model rule: ... December closing balance";
  mutation check (rule disabled) fails 3 tests, restored. Points 1-3 (Deudas column, CSV fijos/variables, `resumenAnio`) are under
  analysis; decision (1) is NOT closed yet.
- PARENT VERIFICATION: `npm test` 556 (555 pass, 0 fail, 1 todo), `npm run test:e2e` 163/163 (re-run by the parent), goldens
  byte-identical to 0ad13c1, tree clean; mutation check (`serieVista` forced to return `serie()`) makes 5 tests fail, restored.
- NATIVE REVIEW: assessment of 0cd42de..5e8502e (12 files, 484 lines, medium, `slice_budget_reached`; includes 696077f). The owner
  DECLINED the review for this candidate (consent `declined_this_candidate`, 2026-10-06); no review record, reviews stay enabled. The
  last reviewed boundary stays 0cd42de; this slice is unreviewed by native review.

#### N1 — R4.5 closure of the year views (night run, 2026-10-06)

- STATUS: done; full mapping, before → after and the sweep in `odd/tasks/repair-sprint-1-r4.5-matrix.md` E.3 / E.4. Closes owner
  decision (1) points 1-3 and owner decision (2) ("Del trabajo" matcher).
- COMMITS: a8a3a84 `fix(r4.5): show model installments in the year Deudas column`, 6de98fb `fix(r4.5): split scheduled expenses in the
  year CSV`, 08b8cf0 `fix(r4.5): base the year summary on realized model months`, 69c65a1 `fix(r4.5): ignore future ticks in the year
  ranking and debt projection`, ecda44f `fix(r4.5): alias estadoMes for the realized year view` (69c65a1 was committed with 2 failing
  alias tests: the real page would have thrown on "El año" of a model year; fixed in the next commit), 8f3296c `fix(r4.5): find the Del
  trabajo row with the engine matcher`, 4de7b35 `test(r4.5): check year Deudas, summary and ranking of a model year on screen`.
- 1 Deudas (`tilesMes`: realized `cuotasReal`, future `cuotasProg`): RED 4 tests (S2 Nov '—' instead of 100.000, Total/"Año por año"
  200.000, ticked future = unticked, future row reconciliation), GREEN; r4.anio assertions that pinned Deudas = `serie()` now pin the
  model value (explained in the test). Legacy guard + byte-identical legacy test pass.
- 2 CSV fijos/variables (`tilesMes`, future month = `suma()` per section): RED 1 (Nov 0/100.000 vs Gastos 500.000), GREEN; past/current
  and legacy unchanged.
- 3 `resumenAnio` (DERIVED rule, flagged for owner review): realized months only, model Resultado for red months, label "Promedio de N
  meses ya transcurridos". RED 3 (P3a 490.000 → 450.000, S2 3 → 2 months, red month "2 meses" → "Octubre"), GREEN; mutation (red
  rule on chained Disponible + future months allowed) fails 2.
- 4 ranking / `proyeccionDeudas`: app-side `datosRealizados(D, hoy)` (future model rows unticked in a copy); engine untouched, goldens
  identical. RED 3, GREEN.
- 5 matcher: exact name first, else `esRenglonTrabajo` (clave). `L-03b` todo → pass; `L-03c` (exact wins, undo path). Mutation (fallback
  removed) fails both.
- 6 sweep: no further §1/D13-derived fix; N1-A (ticks on the month screen of a future model month: pie, budgets, debt text) and N1-B
  (`duplicar` `pagadasAntes` from all 12 months) recorded as OWNER_DECISION_REQUIRED with alternatives (matrix E.4).
- TESTS: `npm test` 571 pass / 0 fail / 0 todo (was 556 / 0 / 1); `npm run test:e2e` 166/166 (was 163; RED with the 1d7102b
  index.html: 163 pass / 3 fail). Goldens byte-identical to 1d7102b. No APPVER bump.
- NOTE: a8a3a84 and 6de98fb wrote `tests/r4.anio.test.js` with CRLF; 08b8cf0 restores LF.
- NATIVE REVIEW: consent pending (owner away, night-run rule); not claimed.

## Night run to Alpha candidate (owner brief "MODO NOCTURNO AUTÓNOMO", 2026-10-06)

Owner authorizes autonomous work R4.5 → R4.6 → R5 → pre-Alpha audit → fixes → cleanup → security → regression → final audit →
smoke → Alpha readiness verdict, without intermediate approvals. Authority order: Q1-Q15, R4 contract, D16, complementary matrix,
recorded R4.4/R4.5 decisions, existing behavior when it does not contradict the model, conservative data preservation. A genuinely
new product rule is marked `OWNER_DECISION_REQUIRED` (documented with alternatives) and work continues on everything else. D16-15 stays
`PENDIENTE-R7`. No golden regeneration to hide changes. Small conventional commits. Native review consent is interactive and the
owner is away: per the brief, each pending consent is recorded here and the available verification runs instead (independent
read-only reviewer agents + mutation checks); no native PASS is ever claimed without a real native review.

Checklist (route: delegated writer per task, parent verifies + re-runs suites):
- [x] N1 R4.5 close: points 1-3 (Deudas column, CSV fijos/variables, `resumenAnio`), other `calc()/serie()` consumers in model years,
      "Del trabajo" matcher (L-03b), cross-view consistency. Route: delegated writer. Evidence: "#### N1 — R4.5 closure" above and
      matrix E.4; two OWNER_DECISION_REQUIRED recorded (N1-A, N1-B).
- [x] N2 R4.6 hardening: weak tests (L-10 risk marker, D16-16 E2E rejection), stale tab / storage races / double write / double count,
      restore, migration, backup, import/export, numbers, pending/paid, future months, new years; dead params; semantics source per concept.
      Route: delegated writer. Evidence: "#### N2 — R4.6 hardening" below; 3 bugs fixed RED→GREEN, one OWNER_DECISION_REQUIRED (N2-B).
- [x] N3 R5: opening / available UX (first-use prompt via `activarSaldos`, "Saldo inicial · Editar", "Viene del mes anterior", real
      closing correction, edit of a previous month), Patrimonio composition (owner MUST), "Del trabajo" above its pases presentation.
      Route: delegated writer (N3a, N3b). Evidence: "#### N3a" and "#### N3b" below; release v1.32.0 / sw v45.
- [x] N4 Pre-Alpha code audit + cleanup (risk-reducing only). Route: delegated writer. Evidence: "#### N4/N5/N6" below; I-1..I-7 fixed.
- [x] N5 Security audit (import/restore/export, dynamic HTML/XSS, storage, SW/cache, deletion, migrations) with regression tests.
      Route: delegated writer. Evidence: "#### N4/N5/N6" below; S-1..S-5 fixed (S-4 CSP added without hashes).
- [x] N6 Backup/restore/migration end-to-end round trips (old + new data, Trabajo, arrastre, ahorro, deudas, previous years).
      Route: delegated writer. Evidence: "#### N4/N5/N6" below; no new bug, round trips pinned in unit + E2E.
- [x] N7 Final regression, smoke, Alpha readiness report.
      Route: independent review + smoke (parent), then delegated writer for the three fixes. Evidence: "#### N7 — final verification" below.

Native review consent log (night run):
- 2026-10-07: the owner granted consent and the whole night range 0cd42de..1528a44 was natively reviewed as 7 slices (T1..T7), all
  APPROVED with no correction and acknowledged; this supersedes every "consent pending" entry below (kept as history). Reviewed boundary
  now 1528a44. The follow-up slice 1528a44..HEAD (fixes of the review advisories) is pending its own native review; not claimed.
  Details: "#### Native review of the night range (2026-10-07)" below.
- N4/N5/N6 (7bb5480..HEAD of N4-N6, 9 code/test commits + this record): native review consent pending (owner away); not claimed.
- N7 (0daa848..HEAD: a3c0916, 685296a, f8821b5 + this record): native review consent pending (owner away); not claimed.
  Writer verification: `npm test` 661 (660 pass, 1 todo `L-03d`), `npm run test:e2e` 214/214, motor goldens byte-identical to 7bb5480,
  mutation checks in the N4/N5/N6 section.
- N3b (8d1ee42..HEAD of N3b, N3a review fixes + R5 part 2 + release v1.32.0): native review consent pending (owner away); not claimed.
  Writer verification: `npm test` 628 (627 pass, 1 todo), `npm run test:e2e` 204/204, motor goldens byte-identical to 8d1ee42,
  mutation checks in the N3b section.
- N3a (7c3dcf1..HEAD of N3a, integrity fixes + R5 part 1): native review consent pending (owner away); not claimed. Writer verification:
  `npm test` 603 (602 pass, 1 todo), `npm run test:e2e` 192/192, motor goldens byte-identical, mutation checks in the N3a section.
- N2 (ec12149..HEAD of N2): native review consent pending (owner away); not claimed. Writer verification: `npm test` 585 (584 pass,
  1 todo risk marker), `npm run test:e2e` 169/169, motor goldens byte-identical, mutation checks recorded in the N2 section.
- N1 (1d7102b..1d6c734, 8 commits, 297+/21-): native review consent pending (owner away); not claimed. Parent verification:
  `npm test` 571/571 (0 todo), `npm run test:e2e` 166/166, motor goldens byte-identical, tree clean. Independent read-only review
  launched (results below when available).
- N1 process defects (recorded, history NOT rewritten — branch kept intact by rule "never destroy existing work"): 69c65a1 was
  committed with 2 failing tests (missing `estadoMes` alias; fixed in ecda44f, the next commit); a8a3a84 and 6de98fb wrote
  `tests/r4.anio.test.js` with CRLF (restored to LF in 08b8cf0), so those two commits show the whole file as changed. Any bisect
  over 69c65a1 must skip it. Owner may squash before merge.
- Parent triage of N1 OWNER_DECISION items: N1-A (future ticked rows treated as paid by pie / budget bars / debt row on the month
  screen) is DERIVED from §1 ("nothing in a future month is Realizado") and D3 ("scheduled ... clearly distinguished"): handled in
  N3 (R5) as "programado" in future model months; not an owner decision. N1-B (`duplicar` sets `pagadasAntes` from all 12 months)
  stays OWNER_DECISION_REQUIRED (low; Q14 count-based debts; alternatives in matrix E.4), recommended keep for Alpha with a note.

#### N2 — R4.6 hardening (night run)

- STATUS: done. Route: delegated writer (one bounded writer, 2+ non-trivial files). Commits on `fix/repair-sprint-1` after ec12149:
  cb25dd3 `fix(r4.6): check both revisions before a Trabajo pase writes anything`, f987630 `test(r4.6): assert a visible rejection for
  D16-16 with a condition wait`, 3cc37fa `fix(r4.5): count Trabajo pases in the red-month rule` (parent addition A), 75bff01
  `test(r4.6): pin legacy two-row Del trabajo allocation as a risk marker` (parent addition B), 8ea9e7d `test(r4.6): guard data-driven
  loops against vacuous passes`, 0a2eb2d `fix(r4.6): a stale tab never creates the new year`, d785220 `refactor(r4.6): remove
  unreferenced baseline leftovers`, b71de11 `refactor(r4.6): document the single semantic source per concept`, plus this record.
- BUG 1 — L-10 two-blob pase (was a pinned "accepted" risk; a SAFE fix existed): a pase writes the year row and Trabajo with no
  transaction. With a missed storage event the row was written and the Trabajo save refused (money in both pockets); removing a pase
  emptied the row while Trabajo kept the pase (money in neither); a stale open year left memory changed and toasted "Pasé".
  Fix: `blobAlDia` + a precheck in `aplicarPase` of the stored Trabajo and open-year revisions before the first write; `guardarPase`
  says "Hay cambios hechos en otra pestaña. Recargá antes de pasar."; `quitarPase` / `reponerPase` stop silently when stale. RED: 4 tests
  (`L-10`, `L-10b`, `L-10c`, `L-10d`) fail on ec12149 (`L-10` stored the row +100.000; `L-10b` stored the row at 0, rev 2). GREEN after.
  Mutation (precheck removed): 4 fail, restored.
- BUG 2 — red month ignored Trabajo pases (independent review of N1, parent addition A): `mesEnRojo` used `flujosMes().resultado`, which
  leaves realized pases out, while the card / row count them as Ingresos; a month funded by a 300.000 pase with 100.000 expenses was "En
  Octubre gastaste más de lo que entró". Fix: `resultado + trabajoRealizado < 0` (= card Ingresos − Gastos − Deudas); legacy rule
  unchanged. RED 1 (`N2 red month, model year ...` in r4.anio), GREEN; the test also asserts the month stays red when the pase does not
  cover the expenses (guards against "never red").
- BUG 3 — `duplicar` in a stale tab: wrote the pre-R4 snapshot, switched the open year and alerted "Listo el 2027" while the new year's
  save was refused (nothing stored). Fix: refuse up front when stale, and when its own pending save is refused (December in memory is
  not the stored one). RED 2 (r4.endurecimiento), GREEN; mutation (guards removed) fails 2.
- WEAK TESTS FIXED: `L-10` pinned a money-duplicating state as passing → now 4 behavior tests (above). D16-16 E2E rejection waited
  300 ms and only checked the stored value → `waitFor` condition helper; asserts the visible toast "No entendí «1,234.5» como número",
  the field showing the stored amount back, the card unchanged and the `err` class while typing (169 E2E checks, was 166). Mutation
  (toast removed from `aplicarInput`): 3 E2E checks fail (incl. the new one), restored. Vacuous-loop guards: R-01 (12 rows, 6 declared),
  R-02 (3 years), r4.anio serieVista corpus (9), r4.integracion legacy datasets (6), datos `duplicar` rows (>= 2). D16-15 still pins
  today's behavior on purpose (PENDING-R7, labeled in its name and messages).
- NEW RISK TESTS (`tests/r4.endurecimiento.test.js`, 8): own-key classification (data vs device; a new key fails until classified) and
  backup completeness (every year + Trabajo, no device key); multi-year + Trabajo backup → empty phone round trip (years, Trabajo, chain,
  12 cards, net worth); restore over newer revisions (written above them; a stale tab of before is refused); unreadable / empty backups
  write nothing; `duplicar` with a CONFIRMED December closing (opens at 700.000, `calculadoOrigen` 825.000; in 2027 the confirmed value
  holds when December changes, the unconfirmed chain follows: 625.000 − 90.000); the two stale `duplicar` cases; sheet fields
  `leerMonto` / `cantidadDe` (decimals, `$`, negatives with reason, escaped echo, quantity > 0). Pending vs paid, future months and
  editing a previous month with / without confirmed closing were already covered (D16-02/03/06/11, C-03..C-05, N1) and not duplicated.
- CLEANUP (no behavior change): scan of every top-level function's parameters (425 params, 384 functions, motor and app): no dead
  parameter. Unreferenced code removed: `tBuffer`, `tServidor`, `conflictoDatos`, `limpiarBuffer(){}` (baseline leftovers, no reference in
  app, sw.js or tests). `activarSaldos` is unreferenced by the UI but kept (R5 caller; tested). Motor goldens byte-identical to ec12149.
- INVENTORY: `tests/inventario.data.js` reasons refreshed (flujosMes now wired, ranking / proyeccionDeudas through `datosRealizados`,
  renderAnio summary, duplicar, aplicarPase) and `SOURCES` added; the table below is guarded by `tests/inventario.test.js` (mutation:
  wrong owner in the doc row → 1 fail, restored). The R1 "Consumer inventory" table at the end of this file stays the R1 snapshot; the
  current classification is `tests/inventario.data.js`.
- OWNER_DECISION_REQUIRED: N2-B (MEDIUM) legacy two-row "Del trabajo" data — `L-03b` is resolved for new data only; alternatives in
  matrix F. Pinned by `L-03d` (node:test `todo`; passing it means the risk was fixed).
- RISKS (matrix F): no transaction across year + Trabajo (precheck closes the missed-event window; a quota error on the second write can
  still split); `cambiarAnio` in a stale tab drops the stale edits (LOW, left as is).
- TESTS: `npm test` 585 (584 pass, 0 fail, 1 todo = `L-03d` risk marker; was 571 / 0 / 0); `npm run test:e2e` 169/169 (was 166); motor
  goldens byte-identical to ec12149. No APPVER bump.
- NATIVE REVIEW: consent pending (owner away, night-run rule); not claimed.

##### Semantic sources (R4.6)

One owner per concept of the model (design §1). Every figure of a model month on screen reads the owner directly or through the
listed adapter; no screen recomputes a concept on its own. Mirrored in `tests/inventario.data.js` `SOURCES` and guarded by
`tests/inventario.test.js` (owner must be a motor function; this table must name it).

| Concept | Owner | Field / rule | Screen adapter |
|---|---|---|---|
| Registrado | `suma` | every loaded amount of a section, any status | section subtotals (`seccion`), future-month CSV fijos/variables |
| Realizado | `flujosMes` | `ingresosReal` / `gastosReal` / `cuotasReal` / `trabajoRealizado`: ticked rows of a past or current month, pases dated <= hoy | `tilesMes` (card), `serieVista` (year views), `mesEnRojo` |
| Pendiente | `flujosMes` | `ingresosPend` / `gastosPend` / `cuotasPend`: unticked rows of a past or current month | `cadena` (projection, overdue apart, Q8) |
| Programado | `flujosMes` | `*Prog`, `trabajoProgramado`, `pasesNetosProg`: everything of a future month | `tilesMes` of a future month |
| Disponible inicial | `cadena` | `meses[j].apertura`: declared (`iniciarArrastre`) in the migration month, previous closing after, live December closing in January (`ctxModelo` → `cierreAnioAnterior`) | month card; R5 month lines `lineasSaldo` ("Disponible inicial", origin, Editar) |
| Resultado del mes | `flujosMes` | `resultado` = realized income − realized expenses − realized installments | red-month rule (`mesEnRojo` adds `trabajoRealizado`, as the card) |
| Pases netos | `flujosMes` | `pasesNetos` = retiro + venta − ahorro − reposición (+ realized Trabajo pases) | `cadena` |
| Disponible actual | `cadena` | `resumen.disponibleActual` | `tilesMes` (current month), `patrimonioNeto` |
| Proyectado al cierre | `cadena` | `meses[j].proyectado`, `resumen.proyectadoAlCierre` | `tilesMes` (future month) |
| Patrimonio bruto | `patrimonioNeto` | `bruto` | `filasPatrimonio` (R5 N3b: Dólares > Patrimonio total of a model year) |
| Patrimonio neto | `patrimonioNeto` | `neto` = bruto − `pasivos` | `patrimonioPantalla` |

Legacy months/years (no `arrastre`, or before `desde`) keep `calc()` / `serie()` / `patrimonio()` byte for byte (I6; motor goldens).

#### N3a — R5 balance UX (night run)

- STATUS: done (R5 part 1). N3 stays open: N3b completes it (Patrimonio composition, "Del trabajo" above its pases, APPVER/sw bump).
  Route: delegated writer (one bounded writer; index.html + several test files).
- COMMITS (after 7c3dcf1): ad970a4 `fix(r4.6): duplicar checks the stored revision before building the new year`, 98b0e9d `fix(r4.6): a pase
  aborts when the open-year write fails` (both: integrity fixes from the N2 review, below), e7a1e68 `feat(r5): show the month balance chain
  with first-use prompt, opening edit and real closing correction`, 4910326 `test(r5): drive D16-05 and D16-17 through the month-view Editar
  path`, 7a96e62 `test(r5): check the balance UX of the month view end to end`, plus this record.

##### Integrity fixes from N2 review

1. `duplicar` in a CLEAN tab that missed the storage event built the new year from a stale December (only `obsoleta` and a refused pending
   save were guarded). Fix: `if(!blobAlDia(PREF + D.anio, D)){ obsoleta = true; avisoOtraPestana(); return; }` before building anything
   (no snapshot, no marker, no year switch). RED: new test in `tests/r4.endurecimiento.test.js` ("duplicar in a CLEAN tab that missed the
   storage event") failed on 7c3dcf1 (snapshot + `kibo.datos.2027` written from the stale December); GREEN after. Mutation (guard removed):
   1 fail, restored. Harness lists gained `blobAlDia` (`r45-harness`, `r4.migracion`; `datos.test` stubs it).
2. A pase into the open year ignored the result of `guardar()`: on a write error (quota) `aplicarPase` returned true and `guardarPase`
   stored the pase in Trabajo with no row (money in Trabajo only after a reload). Fix: `guardar()` now returns true/false (false on stale tab,
   revision conflict or write error; callers that ignore it are unchanged); `aplicarPase` reverts the row in memory (removes a row it just
   created, else restores the amount), restores `sucio` and returns false, so Trabajo is not written; a write error on another year shows
   "No se pudo guardar"; a missing row / missing year returns `'sinRenglon'` so `quitarPase` keeps its "No encontré el renglón" path and
   `quitarPase`/`reponerPase` stop on a real failure (the undo stays available). The R4.6 comment on `aplicarPase` now states exactly what is
   guaranteed: both revisions checked before the first write; the year is written first and Trabajo only after it; NOT guaranteed: a failure
   of the Trabajo write after the year was written (no transaction in localStorage). RED: `L-11a`, `L-11b`, `L-11c` in
   `tests/r4.cobertura.test.js` (quota-failing fakeStorage on the year key) failed on ad970a4 (e.g. Trabajo stored 1 pase, row 0); GREEN after.
   Mutation (`guardar(); return true;` restored): 3 fail, restored.

##### What was built (R5 part 1)

| # | Feature | UI text (exact) | Rule |
|---|---|---|---|
| 1 | First-use prompt, inline card above the month card, while the open year contains hoy and has no `arrastre` (data or new device). Guardar → `activarSaldos(valor)`; Omitir → `activarSaldos(null)`; never shown again once `arrastre` exists; never for a year that does not contain hoy | "¿Cuánto dinero tenés disponible actualmente?" · "Lo que tenés para gastar, sin contar tus ahorros. Así el saldo pasa de un mes al otro." · Guardar / Omitir · error "No entendí «X» como número." / "Escribí un monto." | D5, Q1, §8, D9 |
| 2 | Month balance lines (`#saldoMes`, model months only; legacy months / years render nothing extra): opening + origin + Editar, + Ingresos, − Gastos, − Deudas (if any), − Ahorro, "Retiros y reposiciones del ahorro" (if any), then the month total. Past: "Disponible al cierre"; current: "Disponible actual" + "Proyectado al cierre (estimado)" + overdue apart; future: "Disponible inicial (estimado)" and "Proyectado al cierre (estimado)", title "· programado" | "Saldo de <Mes>" (+ "· a hoy" / "· programado") · origins "Viene del mes anterior" / "Lo cargaste vos" / "Saldo inicial sin configurar" / "Viene de diciembre AAAA" · "Pendientes de meses anteriores: $X (no están en lo proyectado)" · "Cobros pendientes de meses anteriores: $X" | D2, D3, D7/Q8, D17, §1 |
| 3 | Editar of the opening: migration month while it is the current month → sheet "¿Cuánto dinero tenés disponible actualmente?" re-derived with `iniciarArrastre` (also after `omitido`); migration month already past → sheet "¿Con cuánto dinero empezaste <Mes>?" (the opening itself; `declarado` = apertura + resultado + pases netos of that month, same identity); any later month → the real-closing sheet of the previous month; opening carried from December (`origen arrastre`) → opens December of the previous year. Never creates movements | "No se crea ningún movimiento." | D2, Q1, D14 |
| 4 | Real closing correction on a past model month: "¿Es correcto?" → sheet "Cierre de <Mes> AAAA", "Según tus registros $calc", "Saldo real" input, live "Diferencia"; Confirmar writes `cierreReal = {valor, calculadoAlConfirmar, confirmadoEl: hoy.iso}`; "Quitar confirmación" removes it. When `reconfirmar`: "Cambió desde que lo confirmaste. El cierre confirmado se mantiene en $X; con tus registros ahora da $Y." with Confirmar de nuevo / Mantener | as quoted | D2, D6 |
| 5 | Start-of-month notice on the current month of the year of hoy, previous month a model month without `cierreReal`: Confirmar (writes the calculated value as real) / Corregir (correction sheet) / Ahora no (per-device key `kibo.avisoCierre` = "AAAA-MM"; own key, classified as DEVICE in `r4.endurecimiento` and `claves` tests; never travels in the backup). Never blocks | "¿Cerraste <Mes> con $X?" · "Es lo que da con lo que registraste. Si tenías otra plata, corregilo." | D10 |
| 6 | Editing a past confirmed month: `refrescar` redraws `#saldoMes`, so the kept confirmed value, the difference and the reconfirm question appear at once; unconfirmed → the chain recalculates, nothing extra | — | D6, owner brief |
| 7 | All writes through `guardarModelo`: stale tab or stored revision ahead → nothing written (notice); pre-R4 snapshot before the first model write on the device; failed save → memory restored. `activarSaldos` gained the same `blobAlDia` precheck (a stale clean tab no longer writes the snapshot/marker before being refused) | "Hay cambios hechos en otra pestaña. Recargá para no perderlos." | Q12, §8, D14 |

Code (index.html at 7a96e62): view `muestraPrimerUso`, `textoOrigen`, `lineasSaldo`, `htmlSaldo`, `avisoCierrePendiente`, `htmlAvisosSaldo`
(before `renderMes`); writes `guardarModelo`, `modoApertura`, `fijarApertura`, `fijarCierreReal`, `mantenerCierreReal` and the sheet glue
(before `activarSaldos`); `renderMes`/`refrescar` render `#avisoSaldo` and `#saldoMes`; 10 new `data-act` actions. Only numbers (through
`fARS`) and fixed labels reach these HTML strings; prefilled input values go through `esc`. No new motor call needs an alias (`cadena`,
`flujosMes`, `iniciarArrastre` were already aliased; alias test green). No motor change, no APPVER/sw bump.

- INTERPRETATIONS (no new money rule; flagged for owner review):
  1. Past migration month: the opening is typed directly (D2 "editable directly"); the "available now" question only exists while the
     migration month is the current one (Q1 derivation needs "so far" = now).
  2. "Mantener" keeps the confirmed value and records the new calculated value in `calculadoAlConfirmar` (acknowledges the drift so the
     question does not repeat); the money is unchanged.
  3. The start-of-month notice is shown only on the current month of the open year that contains hoy, so January never asks about the
     previous year's December (another blob); the January opening's Editar still reaches it.
  4. First-use and "available now" amounts are non-negative (money field, D9); the opening and the real closing accept a leading "-".
  5. "Saldo inicial sin configurar" is the origin text for `omitido` (and for a declared opening with no number).
- TESTS: `tests/r5.saldos.test.js` (14). RED first: 14/14 failed on 98b0e9d (`var not found: LSAVCIERRE`, functions missing). GREEN 14/14.
  Covers: first-use condition (data / new device / arrastre / omitido / past and future years), month lines for §2 numbers (Sep 50.000 →
  200.000 calc / 175.000 real / −25.000; Oct 175.000 → 825.000, projection 580.000, overdue 20.000; Nov 580.000 → 1.280.000) and the
  add-up identity on 12 model months of three datasets, origin texts, HTML labels per state + reconfirm + legacy empty + an `<img>` row name
  never rendered, D16-05 / D16-17 via `fijarApertura`, past-migration-month editing (confirmed Sep holds, D6), confirm / remove / refuse
  current-future-legacy months, Mantener / re-confirm, unconfirmed recalculation with nothing extra, start-of-month notice (dismiss key
  value, confirmed, migration month, other year), notices HTML, stale clean tab cannot declare / correct / confirm / Mantener and
  `activarSaldos` writes no snapshot, snapshot before the first model write, quota failure restores memory, refused snapshot writes nothing.
  `tests/r4.matriz.test.js` D16-05 and D16-17 now also run the Editar path (D16-15 untouched, PENDIENTE-R7). Static guard in
  `r4.migracion` updated: `activarSaldos` has exactly one caller, `primerUso` (a user action).
- MUTATIONS (each restored): `guardarModelo` revision precheck removed → 1 fail; `deshacer()` on a failed save removed → 1 fail;
  `activarSaldos` precheck removed → 1 fail; "Ahora no" check removed → 1 fail; `modoApertura` always 'apertura' → 2 fail.
- E2E (23 new checks, `npm run test:e2e` 192/192, was 169): first use (invalid "1,234.5" visible error and nothing stored; Guardar 825.000 →
  opening 225.000, marker, card 825.000, lines), D16-05 Editar (prefilled 825.000 → 850.000, opening 250.000, rows byte-identical),
  D16-17 Omitir ("Saldo inicial sin configurar", no prompt after reload, Editar 500.000 → opening −100.000), start-of-month notice
  (text, three answers, Ahora no → `kibo.avisoCierre` 2026-09, hidden after reload; Confirmar stores 300.000), Sep "¿Es correcto?" → live
  difference ($25.000) → cierreReal {275.000, 300.000, 2026-10-04}, Oct opens 275.000; Luz ticked → reconfirm shown, card kept 275.000,
  Mantener → calculadoAlConfirmar 280.000; Quitar confirmación → 280.000; stale tab cannot confirm; legacy 2025 year shows none of it.
  RED: the new run.mjs against a worktree of 98b0e9d: 167 pass / 2 fail (the first R5 check fails — no prompt — and the block aborts).
- GOLDENS: `git diff --quiet 7c3dcf1 -- tests/fixtures/motor-golden.json tests/fixtures/motor-golden-r4.json` clean (motor untouched).
- OWNER_DECISION_REQUIRED:
  - N3a-A (LOW) start-of-month notice in January about the previous year's December: (a) keep as is (no notice; Editar of the January
    opening reaches December) — recommended for Alfa; (b) show it and write the previous year's blob with its own revision check.
  - N3a-B (LOW) "Mantener" semantics (interpretation 2): (a) acknowledge the drift (built); (b) keep asking until "Confirmar de nuevo".
- RISKS: the first-use card shows on every month of the open current year until answered (non-blocking by design); Editar of a January
  opening carried from December switches the open year (`cambiarAnio`) — covered by reading and `modoApertura` only, no E2E; `guardar()`
  now returns a value (all previous callers ignore it); localStorage still has no transaction (Trabajo write after the year write can fail).
- NATIVE REVIEW: consent pending (owner away, night-run rule); not claimed.

#### N3b — R5 patrimonio, Del trabajo, programado, release (night run)

- STATUS: done (R5 part 2). With N3a, N3 is complete. Route: delegated writer (one bounded writer; index.html, sw.js, LEEME.md, tests).
- COMMITS (after 8d1ee42): 99ca49a `fix(r4.6): guardar reports false when nothing was written`, 3183dba `fix(r5): Editar on a carried January
  only when December is closed`, 308be77 `fix(r5): prefill exact amounts with cents in the balance sheets` (the three: fixes from the N3a
  review, below), a056e00 `feat(r5): show the auditable Patrimonio composition of a model year`, 7af23d0 `feat(r5): let the excess of a Del
  trabajo row above its pases be ticked`, 87a0d63 `feat(r5): show ticked rows of a future model month as programado`, 049abc5 `test(r5): check
  Patrimonio composition, Del trabajo excess and programado months end to end`, 63602f7 `chore(release): v1.32.0 balance carried between
  months`, bade5e4 `test(r5): D16-14 checks the gross worth row on screen`, plus this record.

##### Fixes from N3a review

1. `guardar()` returned `undefined` before start-up / with no open year, which callers checking `!== false` (`aplicarPase`, `guardarModelo`)
   took as written. Now `false`. RED: `tests/copias.test.js` "guardar reports false when nothing was written" (got `undefined`); GREEN after.
2. Editar on a January opening carried from December (`modoApertura` = 'diciembre') was offered while December of the previous year was still
   future/current (year created ahead by `duplicar`): it switched years and `abrirCierre(11)` returned silently. Now `htmlSaldo` offers Editar
   in that mode only when that December is `pasado` (the origin "Viene de diciembre AAAA" is still shown); `editarApertura` also returns when
   December is not closed, refuses in a stale tab (`avisoOtraPestana`) and stops when `guardar()` of the pending edits returns false (no
   edit is dropped by `cambiarAnio`). RED: 2 tests in `tests/r5.saldos.test.js` (hoy 2026-10-15 and 2026-12-15 showed Editar; the stale and
   failed-save cases switched year); GREEN after. Mutations: Editar condition removed → 1 fail; save check removed → 1 fail.
3. `montoEditable` rounded to whole pesos, so confirming an unchanged closing of 199.999,50 stored 200.000 against `calculadoAlConfirmar`
   199.999,5 (spurious difference shifting the next openings). Now the sheets prefill `1.234,56` when there are cents (read back by
   `parseMonto`), and the input carries `data-exacto`: an unchanged input is the exact source value (also beyond two decimals). Applies to
   `abrirCierre` and `editarApertura` (opening and "available now"). RED: 3 tests (`montoEditable` format; unchanged closing → valor =
   calculadoAlConfirmar = 199999.5, difference 0, October opens at 199999.5; unchanged opening 50000.125 kept, typed "60.000,25" read);
   GREEN after. Mutation (`data-exacto` shortcut off) → 1 fail.

##### What was built (R5 part 2)

| # | Feature | UI text (exact) | Rule |
|---|---|---|---|
| 1 | Dólares > "Patrimonio total" of a model year: rows Disponible a hoy, Ahorro en pesos, Dólares (USD × cotización, estimate), Cripto (estimate), Plata del trabajo → Patrimonio bruto; Deudas (one sub-row per debt) → Patrimonio neto; headline "Patrimonio neto a hoy" (US$ at the cotización; in pesos without one). Every number is a field of `patrimonioNeto` through `filasPatrimonio` / `htmlPatrimonio` (one source). A legacy year renders the old view byte for byte | "Lo que tenés hoy, bolsillo por bolsillo. Lo de los meses que vienen no cuenta." · "Dólares (US$ X a $C, estimado)" · "Deudas (lo que te falta pagar)" · "Dólares y cripto son una estimación: a $C por dólar, la cotización que cargaste el …" · without cotización: "(US$ X, falta la cotización)" / "sin cotización" / "Falta la cotización del dólar (arriba, en Cotización): los dólares y la cripto todavía no se suman." · default cotización never edited: "(US$ X a $1.499, cotización sin cargar)" / "Todavía no cargaste la cotización del dólar: …" | owner MUST (R4.4), D7, Q2, Q6, Q14, §6, D13 |
| 2 | "Del trabajo" above its pases in a model month: checkbox for the excess (`tieneTilde` + `repartoTrabajo`, the same in-order allocation as `flujosMes`); the row stays read-only; the pase part is always realized | "De esto, $X vino de pases del trabajo; el resto, $Y, lo marcás vos." | R4.2 interpretation 4, §7, L-02 |
| 3 | Future model month (`esProgramado`): pie from `datosRealizados` (empty → "Noviembre todavía no llegó: lo que cargaste está programado. …"), caps through `gastadoVista` (0, no over-cap alert), debt text from `estadoDeuda(datosRealizados(D))`; rows show a dashed "Programado" mark instead of a tick, a row ticked ahead keeps a button that only unticks (`puedeAlternar` guards the action); section note | "Programado: noviembre todavía no llegó. Lo marcás como pagado/cobrado cuando llegue." · aria "Programado" / "Programado: lo marcaste antes de tiempo. Tocá para desmarcarlo." | N1-A derived from §1 and D3 |
| 4 | Release: APPVER 1.31.4 → 1.32.0, service-worker cache v44 → v45 (same convention as 3a8a7ae), no new file (precache list unchanged and checked), LEEME changelog entry for R4/R5 | — | Q11 |

- BEFORE → AFTER (hoy 2026-10-15, section 2): the Patrimonio body was "Ahorro líquido en pesos" $600.000 / "Dólares guardados" US$ 1.000 /
  "Cripto" —, total US$ 1.750 / $2.625.000 with no visible gross or debts → now Disponible $825.000 + Ahorro $600.000 + Dólares $1.500.000 +
  Cripto — + Trabajo — = bruto $2.925.000; Deudas ($300.000) (Préstamo $300.000); neto $2.625.000 (headline unchanged). L-02 data (row
  400.000, pase 300.000): no checkbox, disponible 300.000 forever → checkbox; ticked, disponible 400.000. Future November with Expensas
  90.000 ticked and cap 80.000: "Te pasaste por $10.000" + alert + slice in the pie → "— de $80.000", no alert, empty pie "programado";
  Préstamo ticked ahead "Cuota 4 de 6" → "Sin pago este mes; va la 4 de 6". Legacy years: unchanged.
- INTERPRETATIONS (no new money rule): USD/crypto rows are labeled estimates at the stored cotización; the debt sub-rows are
  `pasivos().detalle`; "Plata del trabajo" is `resumenTrab().disponible` (Q2, R4.2 interpretation 4); the excess is ticked on the row itself
  (its `pagado`), which is exactly what `flujosMes` already reads.
- TESTS: new `tests/r5.patrimonio.test.js` (7: legacy Dólares tab byte-identical to 8d1ee42 for 11 datasets against
  `tests/fixtures/usd-legacy.json`, generated on 8d1ee42 by `tests/fixtures/generar-usd-legacy.js` (refuses without `TUGASTO_GOLDEN_RAZON`),
  harness `tests/fixtures/usd-vistas.js` renders the real `renderUSD`; rows = `patrimonioNeto` fields, sum = bruto, bruto − deudas = neto,
  debt detail sums, over every R4-corpus model dataset (>= 15); §6 case on screen; Trabajo + crypto; default and missing cotización;
  escaped debt names), `tests/r5.mes.test.js` (9: Del trabajo excess via `flujosMes` numbers, covered / legacy, two rows in order, screen;
  future month pie / caps / debt text / tick state / action guard, each with the current month and a legacy year unchanged),
  `tests/release.test.js` (3: APPVER = first changelog entry, sw v45, every referenced local file precached and present; RED 2/3 before the
  bump). Updated: `L-02` (now pins the checkbox), `D16-14` (gross row on screen), harness lists (`repartoTrabajo` in r45-harness /
  r4.integracion; `gastadoVista`, `esProgramado`, `mesDelModelo` in topes), inventory (`repartoTrabajo`, `gastadoVista`; SOURCES "Patrimonio
  bruto" adapter `filasPatrimonio`). RED first per feature (composition 5 of 6 failing, Del trabajo 4/4 + L-02, programado 5/5). `npm test`
  628 (627 pass, 0 fail, 1 todo `L-03d`), was 603.
- MUTATIONS (each restored): Trabajo row valued 0 → 2 fail; deudas 0 in `filasPatrimonio` → 3 fail; `repartoTrabajo` without consuming the
  pases in order → 1 fail; `esProgramado` always false → 3 fail; `textoDeuda` back on `D` → 1 fail.
- E2E (12 new, `npm run test:e2e` 204/204, was 192): model-year composition rows (550.000 + 250.000 + 700.000 = 1.500.000 − 100.000 =
  1.400.000), rows add up to the headline (US$ 1.120 at 1.250), legacy year without rows; Del trabajo excess: 2 checkboxes, the split text,
  card 550.000 → click → 650.000; future November: nothing paid-looking, programado mark and note, cap "— de $50.000" and no alert, pie
  "todavía no llegó", untick then no tick; Ajustes shows "kibFinanzas v" + APPVER (1.32.0). RED: the new run.mjs against a worktree of
  8d1ee42: 152 pass / 4 fail (the first R5 checks fail and the block aborts).
- MATRIX: `odd/tasks/repair-sprint-1-r4.5-matrix.md` D16-14 (gross row on screen), C `L-02` (resolved), E.4 N1-A (resolved). `node --test
  tests/r4.matriz.test.js tests/r4.cobertura.test.js`: 45 (44 pass, 1 todo `L-03d`); D16-15 stays PENDIENTE-R7.
- GOLDENS: `git diff --quiet 8d1ee42 -- tests/fixtures/motor-golden.json tests/fixtures/motor-golden-r4.json` clean; motor block untouched.
- OWNER_DECISION_REQUIRED:
  - N3b-A (LOW) tick in a future model month: (a) built — no tick ahead; a row already ticked ahead shows "programado" and can only be
    unticked (left ticked, it realizes when the month arrives, as before); (b) allow ticking ahead as a "will be paid" marker (no
    prevention); (c) clear every tick ahead while the month is future (changes stored data, against D14).
  - N3b-B (LOW) default cotización: `normalizar` puts 1499 when none is stored, so a truly missing cotización only exists before
    normalizing. Built: the composition shows the value (it is inside the net) and says "cotización sin cargar"; alternative (b) leave USD
    and crypto out of the net until the user loads a cotización (motor/golden change in `patrimonioNeto`).
- RISKS: display rounding — each row is rounded to the peso on screen, so with cents the shown rows can differ from the shown gross by $1
  (the numbers add up exactly; screen sums tested on whole pesos); in a future model month `textoDeuda` / `htmlTorta` deep-copy the year
  (`datosRealizados`) per call; `repartoTrabajo` builds `ctxModelo` per "Del trabajo" row (a storage read only for a January carry).
- NATIVE REVIEW: consent pending (owner away, night-run rule); not claimed.

#### N4/N5/N6 — audit, security, backup/restore (night run)

- STATUS: done. Route: one bounded delegated writer (index.html, privacidad.html, tests, this document). Findings come from the two
  pre-Alpha auditors (security auditor "S-*", integrity auditor A "I-*" = A1/B1..B6); their probe scripts reproduced every finding at 7bb5480.
- COMMITS (after 7bb5480): 5979bca `security: key user-named maps without a prototype (S-1)`, 95a20e7 `security: restore only real year keys
  (S-2)`, b59e208 `security: keep date fields as text and cap restore size (S-3)`, 251ddc1 `security: escape history size, pill and settings
  rows; keep data markers intact (S-5)`, 7627ed9 `security: add a Content-Security-Policy meta to the app and privacy pages (S-4)`, b628e2b
  `fix(r4.6): never overwrite unreadable data, export stored data from stale tabs, report failed new years (I-2..I-7)`, 04d2a10 `fix(r5): a
  quick expense in a future model month stays programado (I-1)`, b454346 `test(n6): backup, modify everything and restore round trips in unit
  and E2E`, ccff9b0 `fix(r4.6): keep the unreadable-data warning visible at start-up (I-3)`, plus this record. No commit carries AI trailers.
- PROCESS NOTE (recorded, history not rewritten): every commit ran `npm test` green before committing; the E2E suite was run at the end.
  b628e2b..04d2a10 leave one existing E2E check (`R4.3 c`, restored `rev`) failing because I-5 intentionally moves the revision forward;
  b454346 updates that expectation. Bisect over E2E between those commits must account for it.

| # | Source / severity | Finding | Fix | RED (before) → GREEN |
|---|---|---|---|---|
| S-1 | security / MEDIUM | maps keyed by user names were `{}`: a client/source/folder/expense/debt named `__proto__`/`constructor` vanished from Clientes, Cobranza, fuentes, carpetas, ranking, pasivos, proyección, and `planDe(d,'constructor')` returned `Object` | `Object.create(null)` for statsClientes `m`, cobranza `g`, clientes/fuentes `visto`, carpetas `vistas`, resumenTrab `mf`/`anios`, gastoRapido `usos`, motor `ranking.map`, `proyeccionDeudas.vistos`, `pasivos.libres`; `normalizar` builds `planDeudas` without prototype; `planDe` reads own keys only; rename and `duplicar` use the same | `tests/n5.seguridad.test.js` S-1: 5/5 failing (e.g. Clientes listed 2 of 4 names; `planDe(...,'__proto__')` returned `{}`) → 5/5 |
| S-2 | security / LOW-MED | restore accepted any 4-digit key and `escribirAnios` wrote `kibo.datos.0`, `.999`, `.12345` (not own keys) | `anioValido` (`/^[1-9]\d{3}$/`, 1900-2200) in `restaurarTexto` and `escribirAnios`, plus `claveMia(PREF+anio)` before each write; skipped keys reported (`saltados`) in the restore message | 3/3 failing → 3/3 |
| S-3 | security / LOW | `actualizado`/`cotizacionFecha` kept any type; no restore size cap | both kept only as strings (unknown fields still survive, design §8); `MAX_COPIA` 10 MB checked in `restaurarCopia` (before reading) and `restaurarTexto` ("Ese archivo es muy grande") | 2/2 failing → 2/2 |
| S-4 | security / LOW | no CSP | meta CSP in index.html and privacidad.html: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'` (no hashes, so nothing goes stale; no `unsafe-eval`) | new static test (same meta in both pages, before any script, only self/none/inline/data/blob, no inline `on*=` handlers); E2E: any CSP violation becomes a page error, a cross-origin image is refused (`img-src` reported), "Versión para PC" scripts compiled in Node |
| S-5 | security / LOW | `l[i].kb` raw in `listaHistorial`; `pildora`/`filaAj` raw; `leerEmbebido` cut the data at the first `/*DATOS_FIN*/` (a name could contain it) | `esc(l[i].kb)`; `pildora` and `filaAj` (titulo, sub.t/clase/id) escape by default (constant texts render byte-identical, tested); `leerEmbebido` reads up to the LAST end marker; `versionPC` writes `*/` as `*\/` (JSON reads it the same) | 4/4 failing → 4/4 |
| I-1 | auditor A1 / MEDIUM | quick expense in a FUTURE model month ticked an empty row (realized ahead) | derived, not new: §1 Programado ("nothing in a future month is realized") + N3b-A option (a) "no ticking ahead" → in a future month of the model `sumarGasto` adds the amount and leaves the tick as it was; current/past months and legacy years unchanged; D16-15 untouched (PENDIENTE-R7) | `tests/n4.integridad.test.js` I-1: 1/3 failing (`pagado` true) → 3/3; `tests/movimientos.test.js` harness list |
| I-2 | auditor B1 / MEDIUM | `duplicar` said "Listo" when the new year was not saved (year switched, `kibo.anio` pointed to nothing) | checks `guardar()`; on failure restores `D`, `mes`, `obsoleta`, `hayLS`, never calls `recordarAnio`, alerts "No pude crear el año" | 1/1 failing → 1/1 |
| I-3 | auditor B2 / MEDIUM | an unreadable year blob read as "no year" and was overwritten by the next save (rev 0) | `revGuardada` reports `roto` (parse error or not an object); the raw text is copied as is to `kibo.cuarentena.<anio>` (never replaced, never deleted); year writes return `'roto'` until a backup restore (`escribirAnios` copies to quarantine first); warning "No pude leer los datos de AAAA. Guardé una copia; no se van a pisar." at start-up and on save (other start-up notices add themselves below it); `armarCopia` carries the raw texts in a new `cuarentena` field and never exports unsaved memory as that year; restore brings a backup's quarantine when absent; `duplicar` sees the year as existing. Trabajo: same copy to `kibo.cuarentena.trabajo`, then written (no in-app recovery path; see N4-A). Quarantine keys are device keys (not `claveMia`) so no rollback/restore path that deletes own keys can remove them | 7/8 failing (the device-key guard passed) → 8/8; E2E 3 checks |
| I-4 | auditor B3 / LOW-MED | `armarCopia` in a stale tab exported stale memory | exports `leerAnio`/`leerTrab` when `obsoleta` or `!blobAlDia` | 1/1 failing (exported cot 1000, stored 2000) → 1/1 |
| I-5 | auditor B4 / LOW | restore kept the backup's `rev` when the key did not exist | always `rev = max(stored, own) + 1` | 1/1 failing → 1/1; updated `r4.migracion` "backup -> restore" (4 → 5) and E2E `R4.3 c` |
| I-6 | auditor B5 / LOW | `imprimir` added a permanent `afterprint` listener per print | `{once:true}` and removed in `volver` | 1/1 failing (3 listeners) → 1/1 |
| I-7 | auditor B6 / LOW | stale comments | R4.2 header ("la app las usa desde R4.4/R5"), Mes `tieneTilde` comment (R5 excess); the `|| 2026` fallback of `normalizar` is KEPT (callers always set the year from the key; a `hoy`-based fallback would change motor output) with a comment | comments only |

- MUTATIONS (each restored with the saved fixed file; counts over the focused files): S-1 cobranza `g = {}` → 1 fail; `planDe` without the own-key
  check + `ranking` back to `{}` → 2 fail; S-2 guard removed → 1 fail; I-1 line removed → 1; I-2 save result ignored → 1; I-3 `roto` not
  blocked → 3; I-3 `duplicar` back to `leerAnio` → 1; I-4 stale memory exported → 1; I-5 rev only when the key existed → 2; I-6 permanent
  listener → 1; N6 `armarCopia` drops Trabajo → 1 (unit) and the E2E N6 block aborts; `armarCopia` drops 2025 → 1; restore ignores Trabajo → 2.
  Not run: S-3, S-4, S-5 mutations (their RED runs above fail on exactly the removed lines).
- N6 (tests only; no new bug found): `tests/n6.copias.test.js` (4) — a device with a legacy 2025, a 2026 model year (arrastre, confirmed
  September closing, ahorro, USD bought, crypto, a debt plan, a "Del trabajo" row, a movement) and Trabajo (cobro, factura, realized + future
  pase) is backed up with the real `armarCopia`, everything is changed (2026 edited and de-modeled, 2025 deleted, Trabajo emptied, 2027
  added), then restored with the real `restaurarTexto` → `pendiente`: stored years (minus rev), Trabajo (minus rev/actualizado), the chain,
  12 month cards, `patrimonioPantalla`, `resumenTrab`, El año HTML and CSV of both years equal the backup; 2027 is left alone; revisions only
  move forward. A 7f7ad40-era multi-year backup with Trabajo and a bare pre-R4 single-year export restore cleanly (stored = today's
  `normalizar` of the old blob, no model invented, same `serie`). E2E (6 + 3 for I-3): the same through the real "Reemplazar" button and a
  reload, comparing storage and the Mes card, CSV, Dólares/Patrimonio, El año and Trabajo screens; an old backup on a wiped phone.
- VERIFICATION: `npm test` 661 (660 pass, 0 fail, 1 todo `L-03d`), was 628; `npm run test:e2e` 214/214, was 204; `git diff --quiet 7bb5480 --
  tests/fixtures/motor-golden.json tests/fixtures/motor-golden-r4.json` clean (the motor changes are prototype-free maps, own-key `planDe`, string-only
  date fields and comments). Release: APPVER stays 1.32.0 and the service-worker cache v45 (nothing was published since; no new file, the precache
  list is unchanged and `tests/release.test.js` passes).
- RESIDUAL RISKS: (1) CSP keeps `'unsafe-inline'` for scripts and styles (the app is two inline blocks and the "Versión para PC" file must stay
  one self-contained file): it does not stop an injected inline script; it does block loading from or sending to other origins through
  fetch/XHR, images, objects, forms and `<base>`; navigation-based exfiltration and `frame-ancestors` (not available in a meta) are not covered.
  The PC file opened from `file://` carries the same CSP; its scripts compile (E2E) but it was not opened from `file://` in a browser here.
  (2) `normTrab` keeps `ui.col` as `{}` keyed by folder keys (only booleans copied through `hasOwnProperty`); a folder named `constructor`
  can read an inherited truthy value for its collapsed state (cosmetic). (3) Quarantine keys are never cleaned up and have no UI beyond the
  warning (one copy per year at most, never replaced). (4) A failed `duplicar` of a model year keeps the pre-R4 safety snapshot it took first
  (a backup of what was there; harmless). (5) The I-1 toast still says "Sumé $X a Y" in a future month (the row shows "Programado").
- OWNER_DECISION_REQUIRED:
  - N4-A (LOW) unreadable Trabajo blob: built (a) copy to `kibo.cuarentena.trabajo`, then the next save writes Trabajo (there is no in-app way
    to recover it, and blocking would leave the Trabajo tab unusable); (b) block Trabajo writes until a backup is restored, as for years;
    (c) show a Trabajo-specific warning with a "Descargar el texto" action.
  - N4-B (LOW) quarantine lifecycle: built (a) kept forever, travels in backups; (b) an Ajustes row to download and delete each quarantined
    text; (c) delete it automatically once the year is readable again (against "never delete the raw text").
- NATIVE REVIEW: consent pending (owner away, night-run rule); not claimed.

#### N7 — final verification (night run)

- INDEPENDENT REVIEW of `7bb5480..0daa848` (N4/N5/N6): no CRITICAL or HIGH finding. Three findings were fixed below (one MEDIUM pre-existing,
  two LOW).
- SMOKE: (a) app flow (load, edit, save, reload, backup -> modify -> restore round trip) PASS with 0 page errors and 0 CSP violations;
  (b) "Versión para PC" exported and opened via `file://` PASS except the year defect (fixed in N7-1); (c) offline reload with the service
  worker v45 cache PASS.
- N7-1 (MEDIUM, pre-existing since 7f7ad40) `cargar()` replaced the embedded year of a fresh PC file with `kibo.anio` or the calendar
  year, so a 2027 export opened as 2026 and saved under `kibo.datos.2026`. Fix: with nothing stored and an exported seed
  (`semillaExportada`: saved before or has data) the embedded year is kept and remembered in that file's storage; the shipped seed and
  stored data behave as before. RED: 2 of 3 unit tests failed (`actual 2026` / `[2025,'2025']`), the "normal app unchanged" guard passed;
  the new E2E opens the exported 2027 file via `file://` with a stale `kibo.anio` and failed 2 checks (`2026` shown, no
  `kibo.datos.2027`). GREEN: 3/3 unit, E2E 218/218 (title and header show 2027, data present, `kibo.anio` = 2027, an edit saves under
  `kibo.datos.2027`, nothing under 2026). Mutation: keeping the embedded year for any seed fails the "normal app unchanged" guard. Commit a3c0916.
- N7-2 (LOW) `volverAntesDeR4` / `volverAntesDe130` deleted every own key, including an unreadable year or Trabajo blob created after the
  snapshot. Fix: `cuarentenaAntesDeBorrar` copies such text to quarantine first; if the copy cannot be stored nothing is deleted (red pill,
  the snapshot stays). RED: 3/3 failed. GREEN: 3/3; the existing rollback tests (claves, r4.migracion) load the helper. Mutation: helper
  ignoring unreadable blobs fails 3/3; dropping the guard from `volverAntesDe130` fails its test. Commit 685296a.
- N7-3 (LOW) `ponerEnCuarentena` treated any existing copy as stored, so a second, different unreadable text of the same key was lost.
  Fix: each distinct text goes to the next free key (`kibo.cuarentena.AAAA`, `.2`, `.3`…), the same text is never stored twice, nothing
  is overwritten or deleted; `armarCopia` already carries every quarantine key; restore maps suffixed keys back without duplicates.
  RED: 3/3 failed. GREEN: 3/3. Mutations: old "any copy counts" rule fails 3; no de-duplication fails 2; restore ignoring suffixed keys fails 1.
  Commit f8821b5. This supersedes N4/N5/N6 residual risk (3) "one copy per year at most".
- FINAL REGRESSION: `npm test` 670 (669 pass, 0 fail, 1 todo `L-03d`), was 661; `npm run test:e2e` 218/218, was 214; `git diff --quiet
  0daa848 -- tests/fixtures/motor-golden.json tests/fixtures/motor-golden-r4.json` clean. APPVER 1.32.0 and sw v45 unchanged.
- ENVIRONMENT NOTE: drive C: was full during this run (ENOSPC); the suites were run with `TEMP`/`TMP` on another drive, same commands.

Alpha checklist:

| Area | Status | Evidence / note |
| --- | --- | --- |
| Saldo inicial / arrastre / disponible | PASS | R4.x, N1, N3a; goldens unchanged |
| Ingresos / gastos / pendientes | PASS | R2, N1-x, D16 list |
| Ahorro | PASS | s4, I3 conservation property |
| Trabajo / pases | RISK | L-03d OWNER_DECISION_REQUIRED N2-B open; no transaction across the year + Trabajo writes (a crash between them can split a pase) |
| Deudas / patrimonio | PASS | N1-1, N1-4, N3b |
| Meses futuros | PASS | I5 time isolation, N1-x |
| Años nuevos | PASS | L-05, duplicar tests, I-2 |
| Modificación histórica | PASS | s4 past transfer edit, C-20 |
| Multi-tab / stale / rev / storage events | PASS | R4.3, L-07..L-11, I-4/I-5 |
| Backup / restore | PASS | N6 round trips (unit + E2E), N7-3 |
| Migración | PASS | R-01/R-02, N6 old backups, N7-2 rollbacks |
| Presentation screens | PASS | year views, N3a/N3b, E2E screens |
| Versión para PC | PASS after fix | N7-1 unit + E2E `file://` open |
| Unit / E2E / goldens | PASS | 670 (669 + 1 todo) / 218 / goldens clean |
| Mutation checks | PASS (partial) | N7 fixes mutated; S-3/S-4/S-5 mutations not run |
| Security audit | PASS | N5; residual: CSP keeps `'unsafe-inline'` |

#### Native review of the night range (2026-10-07)

The owner granted consent for 7 slices; each was reviewed in a detached worktree, reliability lens, APPROVED with no correction, and
acknowledged (authority burned):

| Slice | Range | Lineage |
| --- | --- | --- |
| T1 | 0cd42de..8085ef0 | review-bccbbdef747ab3c5 |
| T2 | 8085ef0..1d6c734 | review-d225a0bd645bab5c |
| T3 | 1d6c734..7c3dcf1 | review-1cc24265990764ff |
| T4 | 7c3dcf1..8d1ee42 | review-ff932fea6c351705 |
| T5 | 8d1ee42..7bb5480 | review-9e3389c3fb0f4fe4 |
| T6 | 7bb5480..0daa848 | review-01202ef982ddb626 |
| T7 | 0daa848..1528a44 | review-eca95cd56e2ca17d |

Advisory triage (all non-blocking):
- Already fixed at 1528a44: T4 R3-diciembre-branch (3183dba) and T4 R3-guardar-undefined (99ca49a); T6 R3-quarantine-second-text-lost
  and R3-restore-order-trabajo-quarantine (f8821b5).
- By design: T5 R3-reparto-pases-futuros is consistent with `flujosMes` (R4.2 interpretation 4: the scheduled pases of the month count
  when deciding the excess of "Del trabajo"); no change.
- OWNER_DECISION_REQUIRED, unchanged: T2 R3-trabajo-matcher-two-rows-diverge is the same class as N2-B (L-03d); T7 R3-quarantine-unbounded
  is N4-B.
- Fixed by the follow-up slice (1528a44..HEAD), RED first or mutation-checked:
  - 28ff05b `mantenerCierreReal` refuses a month that is not past; the "Mantener" button (`mantenerCierreHoja`) reports a refusal as such
    and shows "No se pudo guardar" once on a write failure (it was shown twice). RED: a confirmed month that is current again was written.
  - e83c617 `textoDeuda` copies the year only when an installment of a programado month is ticked ahead (`cuotaAdelantada`). Copying only
    when the viewed month is programado (the advisory's wording) would change the text of a current month whose later installment was
    ticked ahead (the end date moves): a test pins it and that mutation fails it.
  - 4ab2d03 `mesEnRojo` / `resumenAnio` take the year they summarize (`d`), not the global `D`; no behavior change.
  - 3c169d9 `serieVista` marks its overlaid model rows `.modelo = true` itself; no behavior change.
  - c807c83 L-07c: a pase into another year from a tab that missed the Trabajo storage event writes neither blob.
  - 09a6a79 the semantic-sources test finds the app script start with LF or CRLF.
  - 2c0fd3c `volverAntesDe130` refuse-and-keep path covered; `appCargar` in `tests/n7.final.test.js` fails loudly on a missing helper.
  - 4fd3c77 L-01: the Total Disponible check runs on an opening of 100.000 (December 330.000 vs the old serie() sum 230.000), so it
    cannot pass by coincidence.
  - b23171d labels the follow-up tests with their slice.
- Verification of the follow-up slice: `npm test` 679 (678 pass, 1 todo `L-03d`), `npm run test:e2e` 218/218, motor goldens
  byte-identical to 1528a44, APPVER 1.32.0 and sw v45 unchanged.
- T8 (follow-up slice 1528a44..6ff871d, 8 files, 253 lines, medium): owner granted consent; reliability lens APPROVED with no
  correction; acknowledged (review-b4a2b0e28f039237, authority burned). Advisory SUGGESTION `R3-mantener-double-clock-read`
  (index.html ~6949-6954: `mantenerCierreHoja` and `mantenerCierreReal` read `hoyApp()` twice; across a month boundary the precheck
  can pass and the write refuse, with no pill; nothing is written) — accepted as LOW residual, no code change. Every code commit of
  the branch since 0cd42de is now covered by an acknowledged native review; reviewed boundary = 6ff871d (this note is passive docs).
- ALPHA READINESS (parent, 2026-10-07): `ALPHA_CANDIDATE`. No CRITICAL or HIGH risk open; native review complete; 679 tests
  (678 pass, 1 todo L-03d), E2E 218/218, goldens identical, smoke (app flow, PC export via file://, offline) PASS. Open MEDIUM:
  N2-B legacy two-row "Del trabajo" data (L-03d), non-transactional Trabajo write after a successful year write, CSP with
  'unsafe-inline'. Open owner decisions (built defaults in place, none blocking): N1-B, N2-B, N3a-A/B, N3b-A/B, N4-A/B.

## D16 — official acceptance list (verbatim)

Origin: owner message in the previous Claude Code session (02140968-86ae-44f2-b1ca-4a73731947bc),
2026-10-05 01:37 UTC, section "## 16. Criterio de aceptación del modelo". Recovered from the session
transcript on 2026-10-06 and confirmed by the owner as the official D16. Kept literally (owner language);
it must not be reinterpreted or replaced.

> Quiero que antes de cerrar R4 exista una matriz de casos como mínimo:
>
> 1. sueldo realizado + gastos realizados;
> 2. sueldo pendiente + gastos realizados;
> 3. saldo inicial + sueldo pendiente;
> 4. saldo inicial + ahorro;
> 5. saldo inicial corregido manualmente;
> 6. cierre confirmado que luego cambia;
> 7. pase futuro;
> 8. ahorro histórico;
> 9. restauración de backup;
> 10. creación de nuevo año;
> 11. modificación de un mes anterior;
> 12. patrimonio con meses futuros cargados;
> 13. deuda pendiente;
> 14. patrimonio bruto vs neto;
> 15. gasto rápido sobre pendiente;
> 16. formatos argentinos de números;
> 17. primer mes sin saldo inicial.
>
> Para cada caso quiero:
>
> * datos de entrada;
> * resultado esperado;
> * resultado real;
> * test automatizado;
> * evidencia.

Complementary R4.5 coverage (NOT part of the D16 acceptance criterion), from the owner's Alfa loop brief,
2026-10-05 07:20 UTC, section "# 12. R4.5 — MATRIZ ALFA", verbatim:

> Además de los casos nominales, probá: mes vacío; mes parcialmente cargado; mes anterior con pendientes;
> mes actual; mes futuro; pase futuro; pase realizado; deuda; cuota vencida; cuota pagada tarde;
> reposición; ahorro; Trabajo; USD; cripto; restauración; migración; múltiples pestañas; recarga;
> cierre/reapertura; datos antiguos.
>
> Para cada caso registrar: INPUT / EXPECTED / ACTUAL / PASS/FAIL / EVIDENCE.
> No aceptes "parece correcto".

Owner rules for R4.5 (2026-10-06): cases 5 and 17 are validated on the model/migration (their UI is R5);
case 15 belongs to R7 (rule D8 decided, feature not built): do not implement R7, distinguish a functional
FAIL from a roadmap-pending result; do not advance to R5/R7; no golden regeneration to hide changes.

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
