# Sprint 0 — Payment status drives totals

## Objective

Make the financial impact of every movement depend on its real payment/collection status.
Income counts only when collected; expenses and installments count only when paid.

## Problem

`suma()` / `calc()` in `index.html` (lines ~1917-1933) sum every `monto` regardless of `pagado`.
Every view (Mes, Año, torta, CSV, live `refrescar`) consumes `calc`/`serie`, so pending
movements hit totals as soon as an amount is typed. Contributing issues:

- `ingresos` and `gastosVariables` have no status (`MARCABLE = {gastosFijos, deudas}`).
- `estaPagado` infers `pagado` for undefined flags (`monto > 0 && month <= current`), so
  freshly typed current-month amounts look and count as already paid.
- `duplicar` (next year) keeps stale `pagado` flags while zeroing amounts.

## Scope (authorized)

- Status-aware totals in the central engine (`calc`), no per-screen patches.
- Status checkbox for `ingresos` and `gastosVariables`, reusing the existing `pagar` button.
- Explicit, non-destructive legacy compatibility for undefined `pagado`.
- Minimal isolated Node test infrastructure (`node:test`, no dependencies).

Out of scope: general audit, cleanup, refactor, redesign, rename, unrelated features.

## Rules (decided)

R1. Realized totals: `calc` sums only items with `pagado === true` for `totalIngresos`,
    `subtotalFijos`, `subtotalVariables`, `totalGastos`, `totalDeudas`; all derived metrics
    (`disponibleLibre`, `disponibleFinal`, `pctGastos`, `pctAhorro`, `ahorroSugerido`) follow.
R2. Pending is exposed as data only (`pendienteIngresos`, `pendienteFijos`,
    `pendienteVariables`, `pendienteGastos`, `pendienteDeudas`); no new visual design.
R3. `suma()` stays "registered total" (all amounts) for section subtotals, `hayDatos`, etc.
R4. Every creation path writes an explicit `pagado` boolean (default `false`).
R5. Legacy compatibility: a one-time, per-year migration in `normalizar` fills ONLY
    undefined `pagado` using the exact pre-fix inference (`monto > 0 && month <= mesTope()`),
    then stamps a marker so it never runs again. Explicit `true`/`false` are never touched.
    This freezes what the UI already showed as ticked, preserving past/current totals;
    only future-month projections and explicitly unticked items change.
R6. After migration `estaPagado` treats undefined as `false` (no silent inference).
R7. Next-year `duplicar` resets `pagado` to `false` along with the zeroed amounts.
R8. `cargarCuotas` sets `pagado: true` for months strictly before the current month,
    `false` for current and future; it keeps an existing explicit flag.
R9. Gasto rápido is money already spent: a new target item, or one whose `monto` was 0,
    becomes `pagado: true`; a target with a pending positive amount keeps its status.
R10. Income synced from Trabajo ("Del trabajo") is already cash-based and always counts.

## Tasks

- [x] T1 Test infrastructure + characterization of current `suma`/`calc`/`serie`.
- [x] T2 Model: explicit flags at creation, legacy migration, `estaPagado`, `duplicar`, cuotas.
- [x] T3 Engine + UI: status-aware `calc`, `MARCABLE` for ingresos/variables, gasto rápido, Trabajo row.
- [x] T4 Version bump (APPVER, sw cache), LEEME changelog, full suite + manual flow check.
- [x] T5 Composition views (yearly ranking, monthly pie) count only paid items.
- [x] T6 Budget cap bars (topes) are consumed only by paid items.

## TDD

Mode: off (no project/session configuration). Tests are still required by the sprint brief.
Runner: `npm test` (= `node --test "tests/**/*.test.js"`; Node 24, no dependencies).

## Route

Delegated direct: one writer for `index.html` + test files (writer trigger: 2+ non-trivial files).

## Progress / evidence

- Baseline commit `7f7ad40` on `main`; work on branch `fix/estado-pago-totales`.
- T1 done: package.json, tests/load-app.js (brace-matching extractor + node:vm + fake Date), tests/smoke.test.js. Observed: `node --test "tests/**/*.test.js"` 2 pass / 0 fail. Note: on Node 24 the literal `node --test tests/` fails (directory treated as a module path), so the npm script uses a glob. Commit hash is recorded in the next task entry (a commit cannot contain its own hash).
- T1 commit: 95c4cb6.
- T2 done: R4-R8 in index.html (mesVacio, normalizar migration + marker `pagoExplicito`, mesTope(anio), mesesCorridos, estaPagado strict, cargarCuotas, crearItem/propagar/copiarAnterior, duplicar, restaurarTexto sets blob year before normalizar). tests/datos.test.js. Observed: 15 pass / 0 fail; inline script parses.
- T2 commit: 0aac6cf.
- T3 done: sumaPagado + calc realized totals and pendiente* (R1-R3), MARCABLE extended, alternarPago (pagar handler), sumarAItem (gasto rápido, R9), renglonTrabajo creates pagado:true and calc/seccion treat "Del trabajo" as always counted without checkbox (R10), aria text "cobrado" for ingresos, Ajustes help text updated. tests/totales.test.js. Observed: 30 pass / 0 fail; inline script parses.
- T3 commit: fc9e168.
- T4 done: APPVER 1.31.0, sw.js kibfinanzas-offline-v40, LEEME CHANGELOG entry. Final: 30 pass / 0 fail; inline script parses.
- T4 commit: 1c56f92.
- Native review (RDD on by default): assessed medium (executable change in index.html, 676 lines,
  slice budget reached); consent granted; lens review-reliability; outcome approved and
  acknowledged (lineage review-6094bb14733bbda9). Four non-blocking advisory findings:
  copiarAnterior untick (verified harmless: copy button only renders when section subtotal is 0),
  migration anio fallback (verified not reachable: normalizar sets `d.anio` before migrating),
  gasto rápido into a pending positive target (known R9 limitation), render paths untested by unit
  tests (covered by the browser check below).
- Browser check (headless Edge via CDP on a scratch copy of HEAD with a test-only hook exposing
  internals; repo untouched): 36 pass / 0 fail. Covered: legacy migration on load (past/current
  ticked, explicit false kept, future pending, marker), realized vs pending totals, on-screen
  balance, checkbox present on ingresos and gastos variables with "cobrado" label, toggle on/off,
  4x toggle without accumulation, edit pending amount (no impact) and paid amount (difference),
  persistence of ticked and pending state across reload, serie realized totals, no uncaught errors.

- T5 (product decision: any metric representing money actually spent/collected excludes
  pending): `ranking()` and `datosTorta()` summed `monto` regardless of status; both now skip
  items where `estaPagado` is false (same predicate as Sprint 0, no parallel logic). Empty-state
  copy of both views updated ("cuando tildes… como pagados"). Route: direct inline (1 source file,
  mechanical). RED first: tests/composicion.test.js 8 fail / 1 pass on old code; GREEN after.
  Commits d5fcc57 (fix) and 5d66c90 (v1.31.1, sw v41, LEEME). `npm test` 39/39. Browser check
  49/49 (13 new: pie data and screen, pie center total, ranking data and screen, tick/untick,
  4x toggle, saldo unchanged, pending still exposed). Native assess since 1c56f92: medium,
  review_due false (`under_budget`, 138 lines) — stays pending in the slice.
- T6 (product decision: budget consumption = sum of paid expenses): `filaTope`, `pasadas` and
  the live bar update in `refrescar` read `num(it.monto)` regardless of status. New helper
  `gastadoTope(it)` delegates to `estaPagado` and is used at all three sites (no new status
  logic). Route: direct inline. RED: tests/topes.test.js 6 fail / 4 pass with the helper wired
  to the old semantics; GREEN after. Commits f13bad0 (fix) and d49fcf6 (v1.31.2, sw v42, LEEME).
  `npm test` 49/49. Browser check 63/63 (14 new tope checks: pending over cap not consumed,
  tick/untick, warning shown/hidden, live edit pending/paid, exact limit, over limit, 4x toggle,
  saldo intact). Native assess since 1c56f92: medium, `under_budget` (264 lines) — still pending
  in the slice.

## Next step

Done. No push, no merge (user decision).
