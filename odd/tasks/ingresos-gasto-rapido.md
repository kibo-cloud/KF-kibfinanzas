# Feature: ingresos-gasto-rapido (1.35.1)

## Objective
Fix two user-reported UI bugs in the month view and the quick-expense sheet.

## Problem
1. Income rows show debt installment lines ("Cuota 5 de 6 · pendiente · quedan 2 ...") after an inline edit.
   Root cause: `refrescar()` (`index.html:4884`) selects every `.dinfo` button, including income `data-act="cobro"`
   buttons, and overwrites them with `textoDeuda(D.meses[mes].deudas[data-i])`.
2. Some variable expenses never appear in "Gasto rápido".
   Root cause: `gastoRapido()` (`index.html:5847`) keeps only `todas.slice(0, 12)`; the default template already has
   12 fijos+variables, so newly created variables (usage 0, appended last) are cut.

## Why
User cannot trust the income section and cannot add quick expenses to some variable categories.

## Scope
- Render-only fixes; no engine, data model or migration change (goldens must stay unchanged).
- Bug 2 decision: remove the cap and keep most-used-first order, so every gastosVariables/gastosFijos row is reachable.

## Constraints
- No dependencies, no build. Bump `APPVER` to 1.35.1 and `sw.js` cache to v50 (visible change for installed users).
- CHANGELOG entry in `LEEME.md`.

## Tasks
- [x] T1 RED+GREEN: `refrescar()` only updates `.dinfo[data-act="plan"]`; test that income cobro buttons keep their text. Route: delegated (writer, index.html + tests). Commit `4d34081`; RED: income buttons read "Cuota 3 de 6 · pendiente ..." instead of "¿Cada cuánto lo cobrás?"; GREEN: `tests/ingresos-gasto-rapido.test.js` 1/1.
- [x] T2 RED+GREEN: `gastoRapido()` lists every variable and fixed expense; test with >12 items. Route: delegated (same writer). Commit `e13e560`; RED: 12 chips, expected 14; GREEN: 2/2. No existing test asserted the cap.
- [x] T3 Release 1.35.1: APPVER, sw.js v50, LEEME CHANGELOG; full `npm test` + `npm run test:e2e`. Route: delegated (same writer). Commit `07ee903`; `tests/release.test.js` updated first (RED 1.35.0/49 vs 1.35.1/50). Each commit also re-syncs the index.html CSP script-src hash (tests/l8.csp.test.js).
- [x] T4 Version folder `versiones/TuGasto v1.35.1`. Route: inline. Created 2026-11-03 (robocopy exit 1, 119 files); copy shows APPVER 1.35.1 and sw v50.

## Acceptance criteria
- Editing an income amount inline never shows "Cuota ..." under income rows.
- Gasto rápido shows a chip for every gastosVariables and gastosFijos row of the month.
- All unit + E2E tests green; goldens untouched.

## Delivery strategy
single-pr (forecast well under 400 authored lines).

## Progress / evidence
- 2026-11-03: root causes mapped by read-only explorer and parent spot check (index.html:4884, 5847). Branch `fix/ingresos-gasto-rapido` from `feat/cash-digital-split` (d56b7fc). RDD: on (default).

- 2026-11-03: T1-T3 done by the bounded writer. `npm test`: 990 tests, 989 pass, 1 fail = S-4 (`tests/n5.seguridad.test.js`): `privacidad.html` must carry the same CSP meta as index.html, and privacidad.html was outside the writer's allowed edit surface. Fix: copy index.html line 5 CSP meta into privacidad.html line 5 (new hash `sha256-SMvRtdX616AMplXIENUYrrYzvgjxtF203yeZ/2d8CHQ=`). E2E: `npm run test:e2e` 562 pass / 0 fail (exit 0).

- 2026-11-03: parent synced privacidad.html CSP (`f69bfad`); `npm test` 990/990 pass. RDD assess (base d56b7fc, committed-only, untracked CLAUDE.md excluded): risk medium (executable_change index.html), 150 changed lines, review_due false (`under_budget`) -> no native review; boundary stays d56b7fc.

## Next step
Feature complete locally. Push / GitHub Pages publish of 1.35.1 is the user's decision.
