# Feature: cash-digital-split (TuGasto 1.35.0)

## Objective

Show three money values on the main screen — Total, Digital and Cash (efectivo) — and integrate the
cash/digital split across the whole system.

## Problem

Personal money is a single monthly result (`disponibleFinal` / `cadena().resumen.disponibleActual`).
The owner cannot tell how much is in cash versus in digital accounts. Only the Trabajo tab knows
`forma` (efectivo vs. digital).

## Why

The owner handles both cash and digital money and wants each pocket visible and kept correct by every
money flow.

## Scope (authorized by the owner, 2026-11-02)

- Per-line optional field `medio: 'efectivo'` (missing = digital), also on quick-expense `movimientos`.
- Cash opening amount and month-level transfers between pockets (ATM withdrawal / deposit).
- Pure engine function returning `{efectivo, digital, total}` with invariant
  `total === current disponible`; existing engine outputs unchanged (goldens untouched).
- Main screen shows Total, Digital, Cash; Efectivo/Digital selector on lines, quick expense and add-line;
  "Pasar efectivo <-> digital" action; one-time "how much cash do you have?" prompt.
- Integration: Trabajo cash cobros / pases, Undo, CSV, backup/restore, Version para PC.
- Release 1.35.0: `APPVER`, `ESQUEMA`, `sw.js` cache version, `versiones/TuGasto v1.35.0`.

## Constraints and defaults

- Existing data migrates as digital with cash 0: the total never changes.
- Savings, USD buy/sell and debt instalments come from digital unless the line is marked cash.
- No dependencies, no build tools; user text via `textContent`; CSP respected.
- Older app versions drop per-line fields (index.html comment near `normalizar`): take a pre-migration
  snapshot like `asegurarSnapshotR4`.
- No push, PR or merge without the owner.

## Delivery

- Forecast: ~700-900 authored changed lines across 6 tasks (above the ~400 heuristic; one cohesive
  feature on its own branch `feat/cash-digital-split`, based on `feat/owner-decisions` 0fd5f46).
- Strategy: `ask-on-risk`; work-unit commits per task, owner decides delivery.

## Tasks

- [x] T1 Data model: `medio` in `normalizar` items and `movimientos`, cash opening, pocket transfers,
      schema bump with pre-migration snapshot. Route: delegated (writer trigger, 2+ files).
      Evidence: tests/medios.datos.test.js RED 8/9 on base, GREEN 9/9; npm test 959/960 (only S-4: privacidad.html
      CSP line is outside the writer surface, synced by the parent).
- [x] T2 Engine: `disponiblePorMedio` in `TGMotor`, invariant total == disponible. Route: delegated.
      Evidence: tests/medios.motor.test.js RED 0/9 on T1, GREEN 9/9 (whole R4 corpus: old data cash 0 / digital = total;
      with cash marks cadena, flujosMes, pasivos, patrimonioNeto byte-equal). Goldens untouched and green.
- [x] T3 UI: hero with 3 values, selectors, transfer action, first-use cash prompt. Route: delegated.
      Evidence: tests/medios.ui.test.js RED 0/13 on T2, GREEN 13/13; npm test 980/982 (inventory + S-4, outside surface).
- [x] T4 Integration: Trabajo cash/pases, Undo, CSV, backup/restore, Version para PC. Route: delegated.
      Evidence: tests/medios.integracion.test.js RED 4/6 on T3 (CSV columns missing), GREEN 6/6; npm test 986/988.
- [x] T5 Tests: unit + E2E for split, migration, backup round-trip; full suites green. Route: delegated.
      Evidence: npm test 986/988 (the 2 failures need files outside the writer surface, see Progress); npm run test:e2e
      562/562 (549 before + 13 new "1.35" checks). L7 390 px fixture re-recorded (L7_GRABAR=1): only the month hero grew 57 px.
- [ ] T6 Release 1.35.0: versions bump, LEEME changelog, version folder. Route: inline/delegated.

## Acceptance criteria

- Old data: total unchanged, digital == total, cash == 0.
- Every money flow updates the correct pocket; digital + cash == total always.
- `npm test` and `npm run test:e2e` all green (baseline 951 / 549), goldens unchanged.

## Applicable checks

- `npm test`
- `npm run test:e2e`

## Progress

- 2026-11-02: exploration done, plan approved by owner ("Si, son esos").
- T1 (delegated writer): fields `medio` (line, movimiento), `mp` (movimiento, previous line medio for Undo),
  `extraccionARS` / `depositoARS` (month, kept only when > 0), `arrastre.inicial.aperturaEfectivo` (|n| <= 1e13),
  Trabajo pase `forma: 'efectivo'` (optional). ESQUEMA 1.35: moving from 1.30 takes a silent snapshot
  `kibo.respaldo.pre-medios` (30 days, Ajustes "Volver a como estaba antes de efectivo y digital"); pre-1.30 phones keep
  the pre130 path. Deviation: snapshot at schema upgrade (earlier than the first cash write) instead of the lazy R4 marker,
  so no new own key was needed in CLAVES_PROPIAS.
- T2: TGMotor gains esEfectivo, cadenaMedios, disponiblePorMedio, aperturaEfectivoPara, usaMedios (internal efectivoMes,
  efectivoLegacy, cadenaEfectivo, efectivoInicial). Cash is its own chain by the flujosMes/cadena rules; digital = total - cash.
  A confirmed cierreReal corrects the total only (difference lands in digital). ctxModelo passes pase `forma` and
  `cierrePrevioEfectivo` (live December cash). Pending outside the writer surface: tests/inventario.data.js entries for
  efectivoMes / efectivoLegacy, and the privacidad.html CSP line.
- T3: hero keeps the big total and adds Digital / Efectivo (Efectivo opens "¿Cuánto efectivo tenés hoy?" in the current
  model year) plus "Pasar efectivo ↔ digital" (month fields extraccionARS / depositoARS). Each line row has a 💳/💵 toggle
  (none on a "Del trabajo" row filled by pases); add-line and quick expense have Digital/Efectivo chips. Quick expense
  without a choice follows the line medio; in the other medio than a line with an amount it goes to a separate
  "<line> (en efectivo|digital)" row (aparte), so each line keeps one medio. Undo restores the line medio (`mp`) unless the
  user changed it later. One-time cash question after the start-of-month notice; Omitir = 0. Helpers medioDe, ponerMedio,
  puedeDeclararEfectivo, muestraPreguntaEfectivo live in TGMotor so test-loaded app functions keep resolving them.
  Also pending inventory: gastoEnOtroMedio.
- T4: "Pasar a lo personal" has Transferencia/Efectivo chips (hidden #psForma read by destinoPase); a cash pase shows 💵 in
  the list, "Cómo" in its sheet and in the Trabajo CSV (new 4th column). The year CSV adds Saqué efectivo, Deposité
  efectivo, Efectivo, Digital only when usaMedios(D) (legacy/pinned CSVs stay byte-identical). Backup, restore and
  "Versión para PC" needed no code: normalizar/normTrab keep the fields (round trip tested). duplicar clears the transfers.
- T5: the first full E2E run (on T3) failed 4 checks: 44 px tap targets (row toggle was 34 px), "one notice at a time"
  (the cash question was a second .aviso), the L7 layout pin and the Gasto-over-amount check at 360 px (hero +111 px).
  Fix: the one-time cash question now lives in the hero Efectivo cell ("Efectivo · ¿cuánto tenés?", opens a sheet with
  Cancelar / Omitir / Guardar), "Pasar" is a third 44 px cell of the same row, toggles are 44 px; hero growth 57 px, L7
  fixture re-recorded. E2E block "1.35 cash / digital split" drives the hero values, the question, the toggle, the
  transfer sheet, cash and digital quick expenses with Undo, backup -> restore, and the first-use state.
- Pending outside the writer surface (parent): (1) privacidad.html CSP meta must equal index.html's script-src
  ('self' + the two hashes now in index.html); (2) tests/inventario.data.js entries: efectivoMes [r4],
  efectivoLegacy [realizado], gastoEnOtroMedio [otro]. T6 release (APPVER, sw.js, LEEME, versiones/) by the parent.

## Next step

Parent: sync privacidad.html CSP + inventario entries, then T6 release 1.35.0 (owner decides delivery).
