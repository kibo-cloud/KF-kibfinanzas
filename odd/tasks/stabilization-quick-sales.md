# Stabilization loop — financial audit, pending decisions, quick-sales UX

## Objective

Protect financial integrity with an end-to-end audit of every money path, settle (or precisely document) the pending owner
decisions, and improve the daily use of "productos rápidos" (quick sales inside Trabajo): a pie chart backed by real data, an
"Editar producto" action from the product screen without registering a sale, and a persistent "Agregar producto" access.

Owner brief: "TuGasto — LOOP DE ESTABILIZACIÓN, AUDITORÍA FINANCIERA Y UX DE VENTAS RÁPIDAS" (2026-10-12).

## Constraints

- No new money rule without the owner; pending decisions → `OWNER_DECISION_REQUIRED` with a recommendation, work continues.
- Never change financial rules to make tests pass; motor goldens byte-identical unless a justified report precedes any change.
- Historical sales/payments are never rewritten by a product edit unless the model already does so and the owner approved it.
- No GitHub, no remote, no visibility change. No destructive git. Small conventional commits, no AI attribution.
- Every inline-script change regenerates the CSP sha256 hashes (index.html + privacidad.html, see tests/l8.csp.test.js).

## Baseline (verified 2026-10-12)

- Branch `fix/repair-sprint-1`, HEAD `08d86a1`, tree clean, no remote. APPVER 1.33.0, SW `kibfinanzas-offline-v46`.
- `npm test` 797 (796 pass, 0 fail, 1 todo L-03d). `npm run test:e2e` 487/487. Motor goldens byte-identical to 1528a44.
- "Ventas rápidas" exists in THIS product: "productos rápidos" inside Trabajo (index.html help text ~4369: one-tap sale with the
  product's default payment method, "Preguntar siempre" asks efectivo/virtual, monthly Digital vs Efectivo totals, stock, folders,
  compact grid, cost/ganancia informative). Payment methods `FORMAS` (~5989): transferencia, echeq, efectivo, otra; echeq/otra
  count as digital.

## Checklist

- [x] S0 Map the quick-sales module (data model, sale flow, persistence, undo, edit capabilities, add-product placement, existing
      charts). Route: delegated read-only explorer. Done (map used by S3a-d).
- [x] S1 Pending decisions review (N1-B, N2-B, N3a-A/B, N3b-A/B, N4-A/B, L3 partial payment + "(otro gasto)" vs topes, L5 due day):
      context, alternatives, effects, recommendation; apply only what is already approved.
- [x] S2 End-to-end financial flow audit (entry → display → persistence → export → restore), findings with repro/impact/cause/test.
      Route: delegated read-only auditor; fixes by a writer, RED first.
- [x] S3a Quick-sales pie chart (data-backed metrics, period explicit, text alternative).
- [x] S3b "⋮ → Editar producto" from the product screen (no sale on edit; history preserved).
- [x] S3c Persistent "Agregar producto" access.
- [x] S3d Local visual consistency of the quick-sales screen.
- [x] S4 Independent reviews of money/persistence changes; native review per slice with owner consent.
- [x] S5 Security / performance (large product lists) / offline / desktop regression.
- [x] S6 Final verification and delivery report.

## Progress / evidence

### S3 — Quick sales (done)

Commits: `290fc6b` (stale tab refuses sales/product edits before changing anything), `f7af54f` (tests), `1226b9d` (S3a pie),
`4e23c77` (S3b ⋮ Editar producto), `7a09777` (S3c persistent + Producto), `9051c2f` (S3d tidy).

- **S3a pie "Cobrado en <Mes>, hasta hoy".** Metrics come only from `resumenTrab` (`mesEfe` / `mesDig`): sales paid on the spot and
  payments received, dated this month and not after today. Excluded on purpose: a-plazo invoices not yet collected and sales/echeqs
  dated later (not money in hand; the Disponible card already says "Además entran … con fecha más adelante"). Efectivo vs
  Digital / Virtual (transferencia, echeq and otra count as digital, as the existing monthly totals did). Why: it answers the seller's
  end-of-day/month question (how much came in cash, how much by transfer) and matches the cash-box split; no new money rule. Period in
  the title; percentages always sum to 100 (a side that exists never shows 0 % or 100 %); an empty month shows a sentence instead of an
  empty chart; a screen-reader table (`.tj-sr`) is the text alternative.
- **S3b edit rule: sales keep their copy.** Each sale stores its own concepto / precio / monto / costo / forma at the moment of the sale
  (the model already worked this way). "⋮ → Editar producto" changes only the product for future taps: it never sells, never moves
  stock, never rewrites past sales or totals. The ⋮ sits outside the sell button (44x44, bottom-right; a right strip in the compact
  grid), so a tap or long press on it can never register a sale.
- **S3c add-button placement.** "+ Producto" lives in the search toolbar above the grid, which stays sticky while scrolling the
  products, so adding is one tap away anywhere in a long list; it opens the new product in the folder being viewed. With no products the
  screen shows a single primary "+ Agregar producto" (no search box, no duplicate link at the bottom). Why: the old access was a text
  link below "Nueva venta", out of sight with many products.
- **S3d.** Local only, existing tokens: the payment icon of each card and the folder titles are 44 px touch targets (visual size
  unchanged), cards lay out as a column, help text updated (pie, + Producto, Editar producto). No global redesign.
- **Tests.** `tests/s3.ventas.test.js` (31 unit tests: pie data and percentages, sale copy unaffected by product edits, stale-tab
  refusal, add/edit paths); e2e S3a-S3d checks in `tests/e2e/run.mjs` (pie values and text table, ⋮ geometry at 360/390/430 px in both
  views, long press on ⋮ never sells, + Producto in the viewed folder, empty state, S3d 44 px targets — RED observed at 32x32 / 36 px
  before `9051c2f`).
- **Screenshots** (light and dark, 390 and 1280 px; top, grid, bottom): `scratchpad/s0/s3-{390,1280}-{top,grid,bottom}[-dark].png`;
  before: `s3-before-*.png`. Reviewed: no clipped text besides the intended ellipsis on long secondary lines, no overlap of ⋮ and the
  payment icon, contrast unchanged (existing tokens).

### S2 — Financial audit

Audit route: delegated read-only auditor (probes in `scratchpad/s2/`, `node <file>` with `loader.js`); fixes by one writer, RED first, one
commit each, mutation check (`scratchpad/s2/mut.js`: the fix line is reverted/weakened and the test must fail). Tests:
`tests/s2.auditoria.test.js` (one block per finding). Motor goldens byte-identical to a264d6a; no money rule changed.

| Id | Severity | Repro | Impact | Cause | Test (RED observed) | Status / commit |
|---|---|---|---|---|---|---|
| H2 | HIGH | 2026-12-10, create 2027 (duplicar) and open it (`p7-futyear.js`) | Patrimonio neto a hoy 3.980.000 → 2.700.000: the 2026 Disponible vanishes while a future year is open | `patrimonioNeto` with `iHoy = -1` for a future year evaluates the open year, not "a hoy" | same Patrimonio a hoy with 2026 or 2027 open; a past year says "al cierre de 2026" (RED: 2.700.000 ≠ 3.980.000) | fixed `3068ba5`: `patrimonioPantalla` reads the year that contains today from storage when a future year is open (legacy year → previous behavior); a past year shows its closing labeled "Patrimonio neto al cierre de <año>" |
| M2 | MEDIUM | two "Super" rows, quick expense on the second, Deshacer (`p6-undo.js`) | undo reverts the FIRST row: one row unticked/reduced wrongly, the other left changed | `quitarMov` matched the row by name only | deepEqual month after undo with duplicate names (RED: first row unticked) | fixed `0c49689`: the movement stores `fi` (row index, with name and section); `normalizar` keeps it; undo uses it when the row there still has that name, older movements fall back to the name |
| L4 | LOW | quick expense in October, go to April, tap Deshacer on the toast | nothing happens, silently | `quitarMov` searched only `D.meses[mes]` | undo after switching month restores the October month; an id not in the open year gives a message (RED: row unchanged) | fixed `51535bc`: searched in its own month; otherwise "No pude deshacer: ese gasto ya no está en el año que tenés abierto." |
| L1 | LOW | El año of a model year with installments | "Te quedan" overstated by the average installment | sentence used income − expenses | model year with 3 months 100.000 / 30.000 / 10.000 → 60.000 (RED: 70.000) | fixed `d6376e5` + `e20ab2a` (model years only; a year without the model stays byte-identical to its pins, D4); the model-year pin in r4.anio now reads the §1 Resultado |
| L2 | LOW | Trabajo CSV with a past pase 300.000 and a scheduled one 200.000 | summary did not add up (Pasado 500.000 vs Disponible 700.000) | summary used `r.pasado` (includes scheduled) | Cobrado − Gastos − Pasado = Disponible; separate "Programado para pasar a lo personal" (RED: 500.000 ≠ 300.000) | fixed `33a9191` (uses `pasesPersonal`, the same split as the screen) |
| L3 | LOW | Simple mode, an a-plazo invoice dated today | "Hoy vendiste" mixed it with what was collected; the line under it only split collected money | presentation | line says "a plazo, sin cobrar $X" (RED: missing) | fixed `2239b12` (presentation only) |
| L5 | LOW | plan "Préstamo" with no rows in any month | keeps counting as a liability and cannot be reached (plans open from a row) | no entry point | composition offers "Quitar plan" only for row-less plans; confirmation states the consequence; Pasivos after removal = the others (RED: functions missing) | fixed `235313a` (user action; no rule change) |
| H1 | HIGH | edit December 2026 after creating 2027 (`p1-carry.js`, `p3-cuotas.js`) | 2027 keeps the old ahorro / USD / a reponer / pagadasAntes | `duplicar` stores a snapshot | notice appears with the changed parts; copied values untouched (RED: functions missing) | interim `b55dade`: notice in the Patrimonio tab "Diciembre <año-1> cambió después de crear <año>: … pueden no coincidir." No re-sync. **OWNER_DECISION_REQUIRED** (see S1) |
| M1 | MEDIUM | pase dated in a month before `arrastre.desde` (`p2-backpase.js`) | money leaves Trabajo but never reaches the Disponible | months before `desde` are legacy for the chain | first tap warns ("Esa fecha es anterior a desde cuándo llevás el saldo mes a mes: esa plata no se va a reflejar en el disponible.") and changes the button to "Pasar igual"; second tap saves (RED: saved at once) | interim `8653da0` (warn + confirm, not blocked; wording avoids the L2 jargon "pase"). **OWNER_DECISION_REQUIRED** |
| M3 | MEDIUM | restore a backup without `trabajo`, or whose Trabajo passed money to years it does not bring (`p8-trab.js`) | "Del trabajo" rows and the Trabajo ledger can disagree after restore | restore writes Trabajo only when present | confirmation says "La copia no trae Trabajo: se mantiene el Trabajo de este teléfono…" or names the missing years (RED: missing) | interim `4717c65`. **OWNER_DECISION_REQUIRED** |
| N2-B (a) | MEDIUM | legacy month with "Dél trabajo" + "Del trabajo" | pases spread over both rows | old matcher data | notice lists the months with more than one "Del trabajo" row; no data change (RED: missing) | interim `46f33df` (Trabajo screen); the engine fix (b) still waits for the owner |

Verification per commit: `npm test` 0 fail before each commit (gated script); `npm run test:e2e` run on 9051c2f (534/0), 3068ba5 (534/0)
and on the final head (see S6/handoff). Test pins touched on purpose: r4.anio model-year summary (L1), harness function lists (usd-vistas,
r45-harness, r4.migracion, l8.diario, r4.cobertura, r4.integracion, seguridad), inventario.data (`derivaAnioPrevio`).

### S2/S3 independent review fixes

One fix per commit, each with a RED test first and a mutation check (the reverted line makes the new test fail). No money rule
changes, motor goldens byte-identical, APPVER 1.33.0 / sw v46 kept, CSP hashes regenerated in index.html and privacidad.html.
`npm test` 855 (854 pass + 1 todo), `npm run test:e2e` 534/534.

| Finding | Repro | Fix | Test |
|---|---|---|---|
| MEDIUM — undo of a quick sale in a stale tab replaced `T` from `tjAntes` before `guardarTrab`; the save was refused but memory and screen showed the undo and the toast said "Listo, quedó como antes". | Sale → another tab saves Trabajo → Deshacer: memory 0 sales / stock 3, storage unchanged, toast shown. | `deshacerTj` returns up front on `trabVieja()` (other-tab notice), nothing changes (`d2e6cab`). | `S3-R1` (s3.ventas); L-08 harness gets `trabVieja`. |
| MEDIUM — quick-expense undo found the row by its position `fi`; after deleting/reordering OTHER rows a different same-named row sat there. | `[Luz, Super 0, Super 70000✓]`, +20000 to the first Super, delete Luz, Deshacer → `[Super 20000✓, Super 50000✓]`. | `anotarMov` stores `fo` (place among rows with the same name) and `fn` (how many had that name); undo takes the `fo`-th same-named row only while there are still `fn` of them, otherwise changes nothing and says "No encontré el renglón para deshacer". `fi` is kept as a hint for older versions; movements without `fo` keep the old fi / first-by-name path. `normalizar` keeps `fo` (integer ≥ 0) and `fn` (integer ≥ 1) (`49ac393`). | `M2-R` ×4 (s2.auditoria): other row deleted, Ordenar (`aplicarOrden`), target row deleted, normalizar. |
| LOW-MEDIUM — with a future year open, the "Dólares mes a mes" table got "a hoy" from today's year but subtracted the open year's `usdAnioAnterior`. | Today 2026-11-10, 2027 created: 2027's "A hoy" row showed Entraron (US$ 200,00) with 2026's US$ 1.100. | `renderUSD` renders the table and its subtitle from the open year's own model (`patrimonioPantalla(D, hoy, true)` skips the swap); the hero and composition stay "a hoy" from today's year (`0ef5d3b`). | `H2-R` (s2.auditoria). |
| LOW — the H1 "Diciembre cambió" notice compared December against the editable starting fields, so editing them on purpose raised it. | Edit `usdAnioAnterior` / `ahorroAnioAnterior` / a plan's `pagadasAntes` in the new year → notice. | `duplicar` stores `copiaDiciembre` {ahorro, aReponer, usd, cuotas} (year-level, kept by `normalizar`, junk dropped, never invented); the notice compares December against it. A year created before this has no snapshot and shows no notice (nothing to compare against) (`07601db`). | `H1-R` ×3 (s2.auditoria): manual edit → none; real change → notice; normalizar / old year. |
| LOW — "a plazo, sin cobrar" was `hoyVendido − cobradoHoy`, so a same-day cobro of today's a-plazo sale did not lower it. | Cash 30000 + a-plazo 70000 today, cobro 20000 on it → "sin cobrar $70000". | `resumenTrab` sums `saldoFac(f)` of today's a-plazo sales (`hoyAPlazo`); `lineaHoy` shows that (`215f391`). | `S3-R5` (s3.ventas); the L3 unit test passes `hoyAPlazo`. |

### S1 — Pending decisions (review 2026-10-12)

None of these has an owner answer recorded; the built defaults stay and nothing is marked resolved. Each keeps
`OWNER_DECISION_REQUIRED` with the recommendation below. Only presentation that adds no money rule may be done without the owner.

| Id | Context (where recorded) | Alternatives | Money effect | Recommendation |
|---|---|---|---|---|
| N2-B (MEDIUM) | Legacy data saved by the old matcher can hold `[variant "Dél trabajo" unticked, exact "Del trabajo" ticked]` in one month; `flujosMes` allocates pases to rows in order, so the variant absorbs the pase and the user's unticked amount counts as realized (repair-sprint-1.md ~285, L-03d todo). | (a) keep data, show a visible notice listing affected months so the user can merge or rename; (b) engine allocates pases to the ticked exact row first (motor + goldens change, report first); (c) one-time merge migration (rewrites stored rows, against D14). | (a) none until the user acts; (b) fixes the over-count automatically for all users; (c) same as b but destructive. | (a) now (detection notice is presentation, no money rule — can be built); (b) as the real fix once the owner approves a golden diff. |
| L3 partial payment | Quick expense "Sí" with a typed amount smaller than the pending row: today "Dejar" ticks the whole row, "Cambiar a" sets the row to the typed amount (alpha-product-surface.md L3). | (a) keep the two answers; (b) split: tick the typed part as a paid row, keep the rest pending. | (b) keeps the remaining obligation visible; (a) may hide it. | (b), needs the owner (it creates a new row-splitting rule). |
| "(otro gasto)" vs topes | Separate quick expenses are rows "<x> (otro gasto)"; topes are per row name. | (a) they count only on their own row; (b) they count toward the original row's tope. | Budget alerts only, no balance change. | (b) (the spend is in the same category), owner to confirm. |
| L5 due day | Only incomes (`frec`/`dias`) and invoices have dates; expenses/installments do not (alpha-product-surface.md L5). | (a) keep (undated rows appear in the last week as "Fin de mes"); (b) optional "vence el día N" field on rows/plans. | None (display). | (b) as a small additive field, owner to confirm (new stored field). |
| N1-B (LOW) | `duplicar` sets the new year's `pagadasAntes` from all 12 months, so creating next year before December counts ticked-ahead installments as paid (repair-sprint-1.md ~256). | (a) keep; (b) count only realized months; (c) derive live from the previous year. | Debt saldo of the new year. | (a) for Alpha (normally done after December); (b) later. |
| N3a-A (LOW) | Start-of-month notice never asks in January about the previous December (other year blob). | (a) keep (Editar of the January opening reaches December); (b) ask and write the previous year with its own revision check. | None. | (a). |
| N3a-B (LOW) | "Mantener" after a confirmed closing changed: acknowledges the drift (updates calculadoAlConfirmar). | (a) keep (built); (b) keep asking until "Confirmar de nuevo". | None (confirmed value kept). | (a). |
| N3b-A (LOW) | Ticking ahead in future model months is blocked; a row already ticked ahead can only be unticked. | (a) keep (built); (b) allow ticking ahead as a marker; (c) clear ticks ahead (rewrites data). | None while future. | (a). |
| N3b-B (LOW) | `normalizar` stores cotización 1499 when none; the composition shows "cotización sin cargar". | (a) keep (built); (b) exclude USD/crypto from the net until loaded (motor/golden change). | Net worth includes USD at 1499 until loaded. | (a) + make the "sin cargar" label prominent. |
| N4-A (LOW) | Unreadable Trabajo blob: copied to quarantine, next save writes Trabajo. | (a) keep (built); (b) block Trabajo writes until a restore; (c) warning with "Descargar el texto". | Raw text always kept. | (a) + (c) (download action is presentation). |
| H1 (HIGH, from S2) | `duplicar` copies December's ahorroAcumulado, usdAcumulado, aReponer and each plan's pagadasAntes into the new year as a snapshot; a later edit of December (late savings, retiro, installment ticked) does not reach the new year (S2 H1). | (a) live carry: the new year reads savings / USD / aReponer and pagadasAntes from the stored previous year, like the Disponible already does (D6, `cierreAnioAnterior`); (b) keep the snapshot + drift notice + a "Volver a tomar de diciembre" (re-sync) action; (c) keep the snapshot silently. | (a) the new year always matches December; (b) correct after the user acts; (c) silent mismatch. | (a), consistent with D6 / the live Disponible carry. Interim notice built (`b55dade`). OWNER_DECISION_REQUIRED |
| M1 (MEDIUM, from S2) | A pase dated in a month before `arrastre.desde` of a model year leaves Trabajo but never reaches the Disponible (those months are legacy for the chain) (S2 M1). | (a) block such dates with a message; (b) warn and let the user confirm; (c) count it into the first model month. | (a) no lost money, one more refusal; (b) the user may still lose track; (c) new allocation rule (motor/golden change). | (a) block with a message. Interim (b) built (`8653da0`). OWNER_DECISION_REQUIRED |
| M3 (MEDIUM, from S2) | Restore writes Trabajo only when the backup has it, so "Del trabajo" rows of restored years and the device's Trabajo can disagree (S2 M3). | (a) keep the device Trabajo (today); (b) require a complete backup (years with "Del trabajo" pases + Trabajo); (c) repair the rows from the Trabajo pases after restore. | (a) possible mismatch; (b) some old backups refused; (c) rewrites stored rows (against D14). | Warn (built, `4717c65`) and offer to also restore Trabajo when the backup has it. OWNER_DECISION_REQUIRED |
| N4-B (LOW) | Quarantine copies are kept forever and travel in backups. | (a) keep (built); (b) Ajustes row to download and delete each; (c) auto-delete when readable (against "never delete"). | Storage only. | (b), owner to confirm deletion UX. |

Safe to build without the owner (presentation only): N2-B (a) detection notice (built `46f33df`); H1 / M1 / M3 interim notices (built `b55dade`, `8653da0`, `4717c65`); N3b-B prominent "sin cargar" label; N4-A (c) download
action. Everything else waits for the owner.

### Native review (W1-W3, 2026-10-13)

- **Consent basis.** The owner's explicit loop authorization of 2026-10-13 ("tenés autorización para ... realizar revisiones ... No pidas
  aprobación entre ... revisiones").
- **Slices.** All reliability lens, APPROVED, no correction, acknowledged.

| Slice | Range | Review |
| --- | --- | --- |
| W1 | `b6549b1..890be85` | `review-b350fed44778bd11` |
| W2 | `890be85..eae79d6` | `review-bc75c8e9bfa59a52` |
| W3 | `eae79d6..63fcbd5` | `review-15c630d77721fa70` |

- **W3 capture.** Interrupted 20 times by the account session limit; completed on resume.
- **Advisories.**
  - W1: the `tests/s3.ventas.test.js` count in this document said 35; the real count is 31 (fixed, `84d62e6`).
  - W2: R3-deriva-falso-positivo (already fixed in `07601db`).
  - W2: the M1 two-tap pase confirmation lived on the button found by querySelector: with no button the pase could never be saved, and a
    date change kept "Pasar igual". The confirmed date is now sheet state (`paseOk`), reset when the sheet opens or the date changes
    (fixed, `e6ea163`; RED observed for both paths).
  - W3: the quick-expense undo refusal branch (`exacto = -2`) had no tests: a new same-named row, another row renamed to that name, and
    a stored `fo` without `fn` (older shape: the fo-th same-named row; out of range refuses) are now covered (`d1ea18a`,
    characterization, no behavior change).

### W4 and stage closure (2026-10-13)

- W4 (63fcbd5..c197158, 4 files, 112 lines, medium): reliability lens APPROVED, no correction, acknowledged
  (review-56cb305a54722b76). Advisory SUGGESTION: no test covers `abrirPase` clearing `paseOk` (reopen the sheet after an
  unconfirmed early date) — LOW follow-up, behavior present.
- Every code commit of this stage (b6549b1..c197158) is covered by an acknowledged native review (W1-W4) plus independent
  read-only reviews of the quick-sales and money changes.
- Final state (parent-verified at c197158 + this note): `npm test` 860 (859 pass, 0 fail, 1 todo L-03d = N2-B), `npm run test:e2e`
  534/534, motor goldens byte-identical to a264d6a, APPVER 1.33.0, SW v46, tree clean, no AI trailers, no remote (owner: do not
  publish yet).
- Owner decisions still open (isolated, recommendations in the S1 table; interim notices built where safe): H1 (year carry live vs
  snapshot; notice built), M1 (pases before desde; two-tap warning built), M3 (restore without Trabajo; notice built), N2-B (legacy
  two-row "Del trabajo"; notice built), L3 partial payment, "(otro gasto)" vs topes, L5 optional due day, N1-B, N3a-A/B, N3b-A/B,
  N4-A/B, GitHub publication.
- Residual risks: MEDIUM N2-B over-count on legacy two-row data until decided; H1 drift between years until decided; LOW restore
  without journal, style-src 'unsafe-inline', quarantine copies accumulate, render cost with hundreds of products not measured in a
  browser, W4 test gap.
