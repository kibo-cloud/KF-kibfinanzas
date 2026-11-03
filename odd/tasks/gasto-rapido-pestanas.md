# Feature: gasto-rapido-pestanas (1.35.2)

## Objective
Split the "Gasto rápido" sheet into two tabs, Variables and Fijos, so the chip list is shorter and less invasive.

## Problem
Since 1.35.1 the sheet lists every gastosVariables + gastosFijos row in one chip block; with many items it floods the sheet.

## Why
User request (2026-11-03): two "windows" to switch between fixed and variable expenses.

## Scope
- `gastoRapido()` in `index.html` renders a `.seg` control (existing component, `index.html:302-304`) with two buttons:
  "Variables (n)" and "Fijos (n)", `role="tablist"` / `role="tab"` / `aria-selected`.
- Default tab: Variables; if the month has no variables, Fijos.
- Each tab shows all its rows (no cap), most-used-this-month first, stable order otherwise.
- Switching tab only re-renders the chips; the typed amount and payment medium stay; the selected chip is cleared.
- A tab with no rows shows a short empty hint instead of an empty block.
- `sumarGasto` keeps using chip `data-sec`/`data-i` (no change to the mapping or the engine).

## Constraints
- No dependencies, no build, render-only; goldens untouched.
- CSP hash re-sync in `index.html` AND `privacidad.html` (tests l8.csp, n5 S-4).
- Release 1.35.2: APPVER, `sw.js` v51, LEEME CHANGELOG, `tests/release.test.js`.

## Tasks
- [x] T1 RED+GREEN: tabs in `gastoRapido()` + tab switching; tests for default tab, counts, switching, empty tab, every row reachable. Route: delegated (writer; index.html + tests).
- [x] T2 Release 1.35.2 + CSP sync; full `npm test` + `npm run test:e2e`. Route: delegated (same writer).
- [x] T3 Version folder `versiones/TuGasto v1.35.2`. Route: inline. Created 2026-11-03; copy shows APPVER 1.35.2, sw v51.

## Acceptance criteria
- Opening Gasto rápido shows the Variables tab with only variable chips; tapping Fijos shows only fixed chips.
- Every variable and fixed row is reachable through its tab.
- Amount and medium survive a tab switch; adding an expense still lands in the right row.
- All unit + E2E tests green.

## Delivery strategy
single-pr (forecast < 200 authored lines).

## Progress / evidence
- 2026-11-03: branch `feat/gasto-rapido-pestanas` from `fix/ingresos-gasto-rapido` (533d130). RDD on (default).
- T1 (c00d974, delegated writer): RED = new tests/gasto-rapido-pestanas.test.js 6/6 failing (grFilas/grVerPestana missing, no grTab dispatch). GREEN = 6/6. New helpers grFilas, grChipsHtml, grPestana, grVerPestana; action `grTab` in the click delegation; CSS .seg.gr-tabs, .gr-vacio. tests/ingresos-gasto-rapido.test.js adapted (fixed rows now reached through the Fijos tab). New E2E block "1.35.2" (4 checks: default tab + counts, variable chips only, switch keeps amount, fixed expense lands in Luz). CSP hash re-synced in index.html + privacidad.html inside T1 so the commit stays green. npm test 996/996; E2E 566 pass / 0 fail.
- T2 (ba97c8b): RED = tests/release.test.js 2 failing (APPVER 1.35.2, sw v51). GREEN after APPVER 1.35.2, sw.js v51, LEEME CHANGELOG v1.35.2, CSP re-sync (index + privacidad line 5). npm test 996/996; npm run test:e2e 566 pass / 0 fail (incl. the four 1.35.2 checks and L9 PWA 1.35.2).

- Parent spot check: `npm test` 996/996. RDD assess base d56b7fc (last reviewed boundary; 1.35.1 stayed pending), committed-only, untracked CLAUDE.md excluded: medium, 386 changed lines, review_due false (`under_budget`) -> no native review yet; the next commit that crosses ~400 lines triggers a review of the whole slice.

## Next step
Feature complete locally. Publishing 1.35.2 is the user's decision (release = origin/main + one commit with this tree + origin CLAUDE.md).
