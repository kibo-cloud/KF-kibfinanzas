# Owner decisions closure (TuGasto 1.34.0)

Status: complete (D0-D9 done); native review unavailable on the full range, independent audit findings closed in D9.

## Objective

Close every open OWNER_DECISION_REQUIRED item left by `alpha-product-surface.md` (L10) and `stabilization-quick-sales.md` (S1),
reconcile the stale P1-P12 checklist, and ship the result as version 1.34.0.

## Problem / why

The Alpha verdict was `ALPHA_READY` with non-blocking owner decisions still open. The owner approved (2026-10-28, "toma las mejores
decisiones para terminar el plan, te doy la aprobacion") that the agent picks the best option for each one. Context, alternatives and
money effect of each item: `odd/tasks/stabilization-quick-sales.md` "S1 — Pending decisions".

## Decisions (owner-delegated, 2026-10-28)

| Id | Chosen | Rationale |
|---|---|---|
| N2-B | (b) `flujosMes` allocates a pase to the ticked exact "Del trabajo" row first | Fixes the over-count for every user without rewriting stored data (D14 holds); only the allocation order changes. L-03d becomes a passing test. The user-initiated repair tool stays (it tidies stored order). Motor golden changes must be limited to affected cases and reported. |
| L3 partial payment | (b) split: the typed part becomes a ticked row, the rest stays pending | Keeps the remaining obligation visible. |
| "(otro gasto)" vs topes | (b) counts toward the original row's tope | Same category spend; budget alerts only, no balance change. |
| L5 due day | (b) optional "vence el día N" on rows/plans | Additive field, read with fallback; undated rows keep today's behavior. |
| N1-B | (b) count only realized months, unless H1 live carry already derives `pagadasAntes` from the stored previous year (then resolved by H1, verified with a test) | Correct debt saldo when next year is created before December. |
| N3a-A | (a) keep | Editar of the January opening already reaches December. |
| N3a-B | (a) keep | Confirmed value kept. |
| N3b-A | (a) keep | No money effect while future. |
| N3b-B | (a) + prominent "cotización sin cargar" label | Presentation only. |
| N4-A | (a) + (c) "Descargar el texto" action | Presentation only; raw text always kept. |
| N4-B | (b) Ajustes row to download and delete each quarantine copy (delete only by explicit user action with confirmation) | Storage control without automatic deletion. |
| GitHub | Not done: blocked: wrong GitHub account on this PC (owner, 2026-10-28); versions kept locally only. No push, remote or tag. | Remote rule. |

## Constraints

- Static PWA, single `index.html`, no build tools or runtime dependencies; strict CSP (update script hashes in `index.html` and
  `privacidad.html` when the inline script changes).
- New stored fields read with fallback; no stored data is deleted or rewritten automatically.
- Test-first: RED observed before each behavior change, then GREEN; mutation check on money changes.
- Motor goldens (`tests/fixtures/motor-golden*.json`) stay byte-identical except for D1, whose differences are listed case by case.
- Version snapshot: `versiones/TuGasto v1.33.0` taken 2026-10-28 before this work (workspace rule).

## Checklist

- [x] D0 Reconcile P1-P12 in `alpha-product-surface.md` with L1-L10 evidence (docs only). Route: inline (one doc). Ticked P1, P3-P9,
      P12 with the citing section; P10 left open (dead `.fab` CSS still present, found by rg), P11 left open (blocked: wrong GitHub account on this PC (owner, 2026-10-28); versions kept locally only); P8 marked superseded by this feature. Docs only: no test run needed.
- [x] D1 N2-B (b) engine allocation order + goldens report + L-03d green. Route: inline (one engine function + its tests, already
      mapped). `flujosMes` gives the month's pases first to the single row named exactly "Del trabajo" (the `renglonTrabajo`
      criterion, the row a pase is added to); the other "Del trabajo" rows follow in order; two exact rows or none keep the old order
      (same months the repair tool calls ambiguous). RED: L-03d and new L-03e failed (2/31 in r4.cobertura); GREEN 31/31. Mutations:
      no priority → 5 fail (L-03d, L-03e, 3 repair tests); priority with two exact rows → L-03f fails. Goldens: none changed (no golden
      case has a variant row before a single exact row), `tests/fixtures/` untouched. Repair tool: the engine now reads unrepaired
      data like repaired data, so the preview says "No cambia ningún total de ese mes." when before = after, and the notice says the
      money "cuenta primero en el renglón llamado exactamente «Del trabajo»" (no longer "se reparte entre ellos"); tests updated.
      `npm test` 915/915 (0 todo), `npm run test:e2e` 534/534.
      Rationale (tick): the decision row says "ticked exact row" because that is the L-03d case; the pase is added to the exact row
      whatever its tick, so the tick does not change which row holds it. Requiring the tick would leave [variant ticked, exact
      unticked] reading the pase from the variant and the repair still changing totals; L-03e pins that case.
- [x] D2 L3 (b) partial payment split. Route: inline (quick-expense functions in index.html + tests). When "Sí" is answered with an
      amount smaller than the pending row, the amount sheet adds «Pagué una parte: quedan $X pendientes» (primary; «Dejar» and
      «Cambiar a» kept). `pagoParcial`: the typed part goes to a ticked row "<row> (pago parcial)" marked `aparte` (spent money,
      not copied to the next month; reused when ticked or empty, like "(otro gasto)", via the new shared `renglonLibre`), the
      planned row keeps the rest, unticked. Movement `{tipo:'parcial', nueva, rn, rfo, rfn}` (kept by `normalizar`, junk dropped):
      undo gives the part back to the planned row found by name + place among same-named rows + count (S2 M2 rule), removes the row
      it created, and refuses ("No encontré el renglón para deshacer") when the planned row is no longer identifiable. RED: 0/6 in
      `tests/d2.parcial.test.js` (functions missing); GREEN 6/6. Mutations: undo without giving the part back → 2 fail; planned row
      not reduced → 2 fail. Inventory classified (`renglonLibre`, `pagoParcial`, `quitarMov` note). E2E +3 (button list, split,
      toast, undo). Motor goldens unchanged. `npm test` 921/921, `npm run test:e2e` 537/537.
- [x] D3 "(otro gasto)" counts toward the original row's tope. Route: inline (tope display functions + tests). `gastadoConApartes`
      adds to a row's tope consumption its ticked one-off rows of the same section: "<row> (otro gasto)", "(otro gasto N)" and the D2
      "<row> (pago parcial)" rows (`baseAparte`: suffix + `esGastoAparte`, so an old unmarked "(otro gasto)" counts and a hand-typed
      "(pago parcial)" without the mark does not). Used by `filaTope`, `pasadas` (over-cap notice) and the live bar update. Budget
      alerts only: no total, balance or stored value changes; a future (programado) month still consumes nothing. Rationale for
      including "(pago parcial)": it is the same category spend, and without it a partial payment would release tope that «Cambiar a»
      keeps. RED: 0/4 in `tests/d3.topes.test.js`; GREEN 4/4; mutation (apart rows not added) → 3 fail. E2E +1 (tope bar after "No, es
      otro gasto"). `npm test` 925/925, `npm run test:e2e` 538/538.
- [x] D4 L5 optional due day on rows/plans + "Qué vence esta semana". Route: inline (one file + tests). New optional stored fields,
      read with fallback: row `vence` and plan `planDeudas[n].vence` (whole day 1..31; `normalizar` keeps a valid one, drops anything
      else, adds no key to rows/plans without it, so stored shapes and motor goldens are unchanged). `diaVence`: the row's own day,
      else (installments) its plan's day. `vencimientos`: a dated row is listed from 7 days before its day ("Día N"), overdue once the
      day passed ("Atrasado · era el día N"); a day past the month end means its last day; undated rows keep "Fin de mes". UI:
      "Días de vencimiento" button in Gastos fijos (sheet like the topes one: «Solo <mes>» / «De <mes> en adelante» by name; empty =
      no day; outside 1..31 refused, nothing saved), the row shows "Vence el día N"; the debt plan sheet has "Vence el día
      (opcional)" (`leerPlan` reads it with `leerDiaVence`). Scope note: the button is only in Gastos fijos (rent, services); variable
      rows keep no button (the field is still read if present), installments take the plan's day. RED: 0/4 in
      `tests/d4.vence.test.js`; GREEN 4/4 (+1 plan test in `tests/plan.test.js`); mutation (plan day ignored) → 1 fail. Layout
      fixture: `tests/fixtures/l7-movil-390.json` re-recorded with `L7_GRABAR=1` on purpose; the only change is the new button
      (`sec:gastosFijos` height 358 → 406 and the next 4 sections moved down 48-49 px); every other box identical. E2E +4.
      `npm test` 930/930, `npm run test:e2e` 541/541.
- [x] D5 N1-B (b) or resolved-by-H1 proof. Route: inline. Finding: H1 does NOT resolve N1-B. Its live carry re-reads December of
      the stored previous year, but `carryDiciembre` (and `duplicar`) counted every ticked installment of the 12 months
      (`estadoDeuda(prev, k, 11)`), so a November installment ticked ahead (data from before the N3b-A block) counted as paid when
      2027 was created in October. RED: `tests/d5.cuotas.test.js` pagadasAntes 4, expected 3. Applied (b): `cuotasRealizadas` =
      estadoDeuda pagadas minus the months ticked ahead in a model year (`esProgramado`); legacy years count the 12 months
      (unchanged, tested). Used by `duplicar`, `carryDiciembre`, `derivaAnioPrevio` (same rule as the copy, so no false notice)
      and `cuotasDeMas`. Consequence found by the H1 property test (seed 20363960, "no installment scheduled in both years"): a
      ticked-ahead month that is no longer "paid" must still be "scheduled", or `duplicar` loads it again in 2027; so
      `cuotasProgramadas(d, k, hoy)` also counts a ticked-ahead model month (callers pass `hoyApp()`). Once the month arrives the live
      carry counts it (pagadasAntes 3 → 4 on 2027-01-10). GREEN 3/3; H1 60 seeds green. Mutations: ticked-ahead not counted as
      scheduled → 2 fail (D5 + H1 property); ahead months not subtracted → 2 fail. Inventory: `cuotasRealizadas` classified,
      `carryDiciembre` / `cuotasProgramadas` / `cuotasDeMas` notes updated. Motor goldens unchanged. `npm test` 933/933,
      `npm run test:e2e` 541/541.
- [x] D6 N3b-B prominent label + N4-A download action (verify whether already built). Route: inline. Verified first: the label
      existed only as muted text inside the row ("…, cotización sin cargar") plus a plain note; no download action existed, and an
      unreadable Trabajo had no notice at all (read as empty, copied to quarantine only at the next save). Built what was missing:
      N3b-B: amber "Cotización sin cargar" chip in the Patrimonio hero (model year, default price, dollars or crypto present) and on
      the dollar / crypto rows, explanation note in amber; no number changes. N4-A: `revisarTrabajoIlegible` at start copies the
      unreadable Trabajo text to quarantine (same `ponerEnCuarentena` the save used; nothing else written) and shows a notice with
      «Descargar el texto» and «Restaurar una copia»; the year notice gets «Descargar el texto» too; `descargarCuarentena` saves the
      kept text as is (`tugasto-apartado-<clave>-<fecha>.txt`, only `kibo.cuarentena.*` keys); `sinTaparCuarentena` keeps the Trabajo
      notice under later notices. RED: 4/5 failed in `tests/d6.avisos.test.js`; GREEN 5/5. Mutation (no quarantine copy at start) →
      1 fail. `tests/r5.patrimonio.test.js` label expectation updated (chip). E2E +2 (notice at start, download content).
      `npm test` 938/938, `npm run test:e2e` 543/543.
- [x] D7 N4-B Ajustes quarantine rows (download / delete with confirmation). Route: delegated writer (one file + tests, quarantine
      functions already mapped by D6). Ajustes → Dónde viven tus datos gets "Textos apartados": `clavesCuarentena` lists every
      `kibo.cuarentena.*` key (sorted), `pintarCuarentena` paints one row per copy with DOM + `textContent` (name from
      `nombreCuarentena`: "Datos de 2026", "… · copia N", "Trabajo", "Diario", anything else the key suffix as is; size from
      `pesoCuarentena`) and «Descargar» (D6 `descargarCuarentena`) / «Borrar»; empty state "No hay ninguno…". «Borrar» runs
      `pedirBorrarCuarentena`: the shared `confirmar` sheet ("¿Borrar este texto apartado?", name set by `textContent`, «Cancelar» /
      «Borrar»); only the confirm action calls `borrarCuarentena`, which refuses any key outside `kibo.cuarentena.`. Nothing is
      deleted automatically; the LSCUAR comment now says so. RED: 0/4 in `tests/d7.cuarentena.test.js` (functions missing); GREEN 4/4.
      Mutations: delete before confirming → 1 fail (confirm test); prefix guard removed → 1 fail (only-quarantine test). Inventory: no
      new function reads amounts, nothing to classify (inventory test green). CSP: app script hash updated in `index.html` and
      `privacidad.html`. E2E +6 (empty state, list with names/sizes as text, download content, ask first, cancel keeps, confirm
      deletes only that copy). Layout fixture untouched (L7 does not measure Ajustes); motor goldens unchanged. `npm test` 942/942,
      `npm run test:e2e` 549/549.
- [x] D8 Version 1.34.0 + SW `kibfinanzas-offline-v47`, update path, full suites, docs (`CLAUDE.md`, S1 table rows marked resolved).
      Route: delegated writer (release bookkeeping across 8 tracked files, pattern of `d58d815`). APPVER 1.33.0 → 1.34.0 (`index.html`;
      `package.json` and `manifest.webmanifest` declare no version), SW cache `kibfinanzas-offline-v46` → `v47`, `tests/release.test.js`
      (APPVER 1.34.0, cache 47) and the L9 E2E previous release (`PREV = { appver: '1.33.0', sw: 46 }`) moved together. Update path: the
      existing L9 mechanism (the installed app notes `kibo.versionVista` and says "Actualizaste a la versión 1.34.0" once; the v46
      cache is deleted on activate) carries it; the E2E installs a 1.33.0/v46 build and publishes this one. The app shows no in-app
      changelog, so the user-facing summary is the `LEEME.md` CHANGELOG entry v1.34.0 (Spanish, app voice: pago parcial, otro gasto en
      el tope, día de vencimiento, cuotas al pasar de año, cotización sin cargar, textos apartados, orden "Del trabajo"). APPVER
      changes the app script: CSP hash updated in `index.html` and `privacidad.html` (policy text unchanged, so its date stays). P10:
      the dead `.fab` CSS (class used nowhere; `id="fab"` on `.nav-gasto` kept, it is what tests and E2E use) removed (every `.fab`
      rule and selector); P10 ticked in `alpha-product-surface.md`. Docs: S1 rows in `stabilization-quick-sales.md` cite D1-D7 or the decision
      table, GitHub blocked locally; repo `CLAUDE.md` (untracked, not committed) updated to 1.34.0. Test-first exception: release
      bookkeeping; `tests/release.test.js` failed on the old values only as the guard that moves with the bump. `npm test` 942/942,
      `npm run test:e2e` 549/549, `tests/fixtures/` unchanged since `cdc385b`.
- [x] D9 Audit findings A1–A10. Route: delegated writer (one file + tests; findings already located by the audit). Native review was
      unavailable (`lens_context_budget_exceeded` on the full range); an independent high-effort audit of `dd6a132..130f8a0` produced
      unverified candidates A1–A10. Each was first reproduced by a deterministic test in `tests/r6.auditoria.test.js` (one test per id):
      RED 0/9, all nine reproduced, none "not reproduced"; GREEN 9/9.
      A1 confirmed: `repartoTrabajo` (checkbox, "Falta", due list, "viene de Trabajo") still split pases in row order while D1's
      `flujosMes` gives them to the single exact row first ([«Dél trabajo» 100.000 unticked, «Del trabajo» 300.000 ticked]: screen 100.000
      covered / 100.000 above, engine 0 / 300.000). Fix: one motor helper `repartoPases(ingresos, pases)` (exported, aliased, classified in
      the inventory) used by both; the test checks 7 L-03-like cases add up row by row to `flujosMes`. Goldens unchanged.
      A2 confirmed: copying the month after a partial payment copied the leftover (60.000 instead of 100.000). Fix: optional row field
      `montoPlan` set by the first partial payment, kept by `normalizar` (no key on rows without it), used by `copiarAnterior`, dropped
      when undo makes the row whole again, when the user types a new amount, when the month copy overwrites the row and by `duplicar`.
      A3 confirmed: «Descargar el texto» pointed at the base key although the text went to `.2`. Fix: `ponerEnCuarentena` returns the key
      it used (or where the text already was; false on failure); both notices use it and show no button when nothing was kept.
      A4 confirmed: 3 loads → 3 notices. Fix: the Trabajo notice replaces its previous copy (other notices stay).
      A5 confirmed: undo after the rest was ticked showed the full amount paid. Fix: the movement keeps `rr` (leftover at split, kept by
      `normalizar`); undo refuses with a toast when the planned row is ticked or its amount is not `rr` minus later partial parts of the
      same row (so undoing an earlier part while a later one exists still works and adds up). Old movements without `rr`: tick check only.
      A6 confirmed: a 1.33-created year (pagadasAntes 4 with November ticked ahead) is corrected to 3 by the live carry with no word.
      Kept (owner decision N1-B b); Patrimonio's notice block (`avisoDerivaPrevio`) now names the plan and the ticked-ahead months
      (`data-av="cuotasAdelante"`) until they arrive; `cuotasRealizadas` takes an optional array to report those months. LEEME 1.34.0
      wording corrected (no longer "No se reescribe ningún dato guardado"). No migration.
      A7 confirmed: after deleting the base copy, the same text was copied again to the base key. Fix: `ponerEnCuarentena` checks every
      `base` / `base.N` slot first. Re-copying an unreadable source after delete is kept (data safety); the D7 delete confirmation says
      "<Trabajo / El año N> todavía no se puede leer: la próxima vez que abras la app se vuelve a apartar." when that is the case.
      A8 confirmed: installment rows showed no day although the plan had one. Fix: `notaVence` (uses `diaVence`) in `seccion`.
      A9 confirmed: "40" said «No entendí «40» como número.». Fix: `leerPlan` reports the field; `textoMalPlan` says "El día tiene que ser
      un número del 1 al 31 (o vacío)." (same words as the rows sheet) in the preview and on save.
      Mutations (fix reverted, then restored): A1 → A1 fails; A2 → A2 fails; A5 → A5 fails (plus the expected CSP hash test each time).
      Test lists updated for the new calls: `d6` (the year-notice test now stores an unreadable year, as the real flow does), `d7`
      (`revGuardada`), `p3a` / `r5.mes` (`notaVence`, `diaVence`). CSP hashes updated in `index.html` and `privacidad.html`. Version
      stays 1.34.0 / SW v47 (not yet delivered); the LEEME 1.34.0 entry lists the user-visible fixes. `npm test` 951/951,
      `npm run test:e2e` 549/549, `tests/fixtures/` unchanged.
      Follow-up (A10, not done on purpose): `abrirVences` / `guardarVences` duplicate `abrirTopes` / `guardarTopes`; a shared sheet would
      remove the copy, but it is a refactor with no behavior change, left for a later task.

## Delivery

Branch `feat/owner-decisions` from `fix/repair-sprint-1` (dd6a132). One work-unit commit per task, Conventional Commits, no AI
trailers. No remote configured: push/PR are owner decisions. Forecast ~900-1300 authored changed lines; strategy `exception-ok`
(no PR possible without a remote; native review per slice by RDD assessment).

## Checks

`npm test` (baseline 913: 912 pass, 1 todo L-03d) and `npm run test:e2e` (baseline 534/534) per task closure.

## Progress / evidence

- 2026-10-28: document created; decisions recorded. Engram mirror pending (memory session ambiguity).
- D0 done (`6e52d22`, docs only).
- D1 done (`05a0b75`): L-03d passes; 915 tests, 0 todo.
- D2 done (`b1d71d2`): partial payment split; 921 tests, E2E 537/537.
- D3 done (`5789200`): one-off rows count toward the tope; 925 tests, E2E 538/538.
- D4 done (`5e48300`): optional due day; 930 tests, E2E 541/541.
- D5 done (`61ba8c8`): N1-B (b) applied (H1 did not cover it); 933 tests, E2E 541/541.
- D6 done (`554b934`): prominent label + download action; 938 tests, E2E 543/543.
- D7 done (`cdc385b`): quarantine copies listed in Ajustes to download or delete with confirmation; 942 tests, E2E 549/549.
- GitHub: blocked: wrong GitHub account on this PC (owner, 2026-10-28); versions kept locally only (P11 and L10 notes updated).
- D8 done (this commit): 1.34.0, SW v47, CSP hash, LEEME changelog, S1 rows resolved, P10 dead CSS removed; 942 tests, E2E 549/549.
  Feature complete pending native review.
- D9 done (this commit): audit findings A1–A9 confirmed and fixed with tests, A10 recorded as follow-up; 951 tests, E2E 549/549.

## Next step

Owner delivery of 1.34.0 (local only; no GitHub). Native review unavailable: lens_context_budget_exceeded on the full range;
independent high-effort audit used instead.
