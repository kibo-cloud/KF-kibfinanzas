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

Update 2026-10-13 (repair sprint, owner brief: "bloquear antes que alterar el saldo / conservar datos y bloquear"): H1 resolved under
contracts I4/R4.3, M1 and M3 resolved by blocking, N2-B repair tool built (data untouched unless the user repairs). See the sections
"H1", "M1", "M3" and "N2-B repair" below; the other rows still wait for the owner.

Update 2026-10-28 (owner-delegated decisions, `owner-decisions-closure.md`, shipped as 1.34.0): every remaining row is resolved; each row cites
its task (D1-D7) or the decision table (N3a-A, N3a-B, N3b-A kept as (a)). GitHub publication: blocked locally (wrong GitHub account on
this PC, owner 2026-10-28); versions kept locally only.

| Id | Context (where recorded) | Alternatives | Money effect | Recommendation |
|---|---|---|---|---|
| N2-B (MEDIUM) | Legacy data saved by the old matcher can hold `[variant "Dél trabajo" unticked, exact "Del trabajo" ticked]` in one month; `flujosMes` allocates pases to rows in order, so the variant absorbs the pase and the user's unticked amount counts as realized (repair-sprint-1.md ~285, L-03d todo). | (a) keep data, show a visible notice listing affected months so the user can merge or rename; (b) engine allocates pases to the ticked exact row first (motor + goldens change, report first); (c) one-time merge migration (rewrites stored rows, against D14). | (a) none until the user acts; (b) fixes the over-count automatically for all users; (c) same as b but destructive. | (a) built (`46f33df`) plus a user-initiated, reversible repair (see "N2-B repair"): preview, copy first, reorder only (exact row first), «Deshacer». The tool is built; stored data is untouched unless the user repairs. (b) engine change not made (L-03d stays todo for unrepaired data). **Resolved** in 1.34.0 by (b), `owner-decisions-closure.md` D1: `flujosMes` gives pases to the single exact "Del trabajo" row first; L-03d passes; goldens unchanged. |
| L3 partial payment | Quick expense "Sí" with a typed amount smaller than the pending row: today "Dejar" ticks the whole row, "Cambiar a" sets the row to the typed amount (alpha-product-surface.md L3). | (a) keep the two answers; (b) split: tick the typed part as a paid row, keep the rest pending. | (b) keeps the remaining obligation visible; (a) may hide it. | (b), needs the owner (it creates a new row-splitting rule). **Resolved** in 1.34.0 by (b), `owner-decisions-closure.md` D2: «Pagué una parte» splits the paid part into a ticked row and keeps the rest pending. |
| "(otro gasto)" vs topes | Separate quick expenses are rows "<x> (otro gasto)"; topes are per row name. | (a) they count only on their own row; (b) they count toward the original row's tope. | Budget alerts only, no balance change. | (b) (the spend is in the same category), owner to confirm. **Resolved** in 1.34.0 by (b), `owner-decisions-closure.md` D3. |
| L5 due day | Only incomes (`frec`/`dias`) and invoices have dates; expenses/installments do not (alpha-product-surface.md L5). | (a) keep (undated rows appear in the last week as "Fin de mes"); (b) optional "vence el día N" field on rows/plans. | None (display). | (b) as a small additive field, owner to confirm (new stored field). **Resolved** in 1.34.0 by (b), `owner-decisions-closure.md` D4: optional `vence` on rows and debt plans, read with fallback. |
| N1-B (LOW) | `duplicar` sets the new year's `pagadasAntes` from all 12 months, so creating next year before December counts ticked-ahead installments as paid (repair-sprint-1.md ~256). | (a) keep; (b) count only realized months; (c) derive live from the previous year. | Debt saldo of the new year. | (a) for Alpha (normally done after December); (b) later. **Resolved** in 1.34.0 by (b), `owner-decisions-closure.md` D5 (H1 did not cover it): only realized installments count when carrying a plan. |
| N3a-A (LOW) | Start-of-month notice never asks in January about the previous December (other year blob). | (a) keep (Editar of the January opening reaches December); (b) ask and write the previous year with its own revision check. | None. | (a). **Resolved**: (a) kept (owner-delegated decision, `owner-decisions-closure.md` decision table). |
| N3a-B (LOW) | "Mantener" after a confirmed closing changed: acknowledges the drift (updates calculadoAlConfirmar). | (a) keep (built); (b) keep asking until "Confirmar de nuevo". | None (confirmed value kept). | (a). **Resolved**: (a) kept (owner-delegated decision, `owner-decisions-closure.md` decision table). |
| N3b-A (LOW) | Ticking ahead in future model months is blocked; a row already ticked ahead can only be unticked. | (a) keep (built); (b) allow ticking ahead as a marker; (c) clear ticks ahead (rewrites data). | None while future. | (a). **Resolved**: (a) kept (owner-delegated decision, `owner-decisions-closure.md` decision table). |
| N3b-B (LOW) | `normalizar` stores cotización 1499 when none; the composition shows "cotización sin cargar". | (a) keep (built); (b) exclude USD/crypto from the net until loaded (motor/golden change). | Net worth includes USD at 1499 until loaded. | (a) + make the "sin cargar" label prominent. **Resolved** in 1.34.0 by (a) + prominent "Cotización sin cargar" chip, `owner-decisions-closure.md` D6. |
| N4-A (LOW) | Unreadable Trabajo blob: copied to quarantine, next save writes Trabajo. | (a) keep (built); (b) block Trabajo writes until a restore; (c) warning with "Descargar el texto". | Raw text always kept. | (a) + (c) (download action is presentation). **Resolved** in 1.34.0 by (a) + (c) «Descargar el texto», `owner-decisions-closure.md` D6. |
| H1 (HIGH, from S2) | `duplicar` copies December's ahorroAcumulado, usdAcumulado, aReponer and each plan's pagadasAntes into the new year as a snapshot; a later edit of December (late savings, retiro, installment ticked) does not reach the new year (S2 H1). | (a) live carry: the new year reads savings / USD / aReponer and pagadasAntes from the stored previous year, like the Disponible already does (D6, `cierreAnioAnterior`); (b) keep the snapshot + drift notice + a "Volver a tomar de diciembre" (re-sync) action; (c) keep the snapshot silently. | (a) the new year always matches December; (b) correct after the user acts; (c) silent mismatch. | **Resolved** by (a) under contract I4 + R4.3 (`30840d5` + H1 completion; see "H1 — Cross-year integrity"): live carry in model years, user-edited fields kept with the notice; legacy years keep the snapshot + notice. Remaining OWNER_DECISION: installments loaded twice by older versions (named, never removed). |
| M1 (MEDIUM, from S2) | A pase dated in a month before `arrastre.desde` of a model year leaves Trabajo but never reaches the Disponible (those months are legacy for the chain) (S2 M1). | (a) block such dates with a message; (b) warn and let the user confirm; (c) count it into the first model month. | (a) no lost money, one more refusal; (b) the user may still lose track; (c) new allocation rule (motor/golden change). | **Resolved** by (a), owner's stated preference "bloquear antes que alterar el saldo / conservar datos y bloquear" (brief 2026-10-13): the date is refused, deleting an old pase before desde is refused, the two-tap confirmation removed (see "M1"). |
| M3 (MEDIUM, from S2) | Restore writes Trabajo only when the backup has it, so "Del trabajo" rows of restored years and the device's Trabajo can disagree (S2 M3). | (a) keep the device Trabajo (today); (b) require a complete backup (years with "Del trabajo" pases + Trabajo); (c) repair the rows from the Trabajo pases after restore. | (a) possible mismatch; (b) some old backups refused; (c) rewrites stored rows (against D14). | **Resolved** by (b), owner's stated preference "bloquear antes que alterar el saldo / conservar datos y bloquear" (brief 2026-10-13): a restore that would mix Trabajo from two sources is refused, nothing written; every other restore proceeds as before (see "M3"). |
| N4-B (LOW) | Quarantine copies are kept forever and travel in backups. | (a) keep (built); (b) Ajustes row to download and delete each; (c) auto-delete when readable (against "never delete"). | Storage only. | (b), owner to confirm deletion UX. **Resolved** in 1.34.0 by (b), `owner-decisions-closure.md` D7: Ajustes → "Textos apartados", download or delete with confirmation. |

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

### H1 — Cross-year integrity (2026-10-13)

Contract basis: I4 of `odd/tasks/repair-sprint-1-r4-design.md` §1 ("Month change: across pockets Σ stocks(m+1 opening) = Σ stocks(m
closing). No peso appears or disappears", December → January included) and R4.3 (a chained year starts from the LIVE closing of the
previous year, already true for the Disponible). No new money rule: the other carried pockets now follow the same live rule.

| What the new year holds from December | Kind | Behavior now |
|---|---|---|
| Disponible opening (`arrastre.inicial`) | live (R4.3, unchanged) | `cierreAnioAnterior` |
| `ahorroAnioAnterior`, `aReponerAnterior`, `usdAnioAnterior`, each plan's `pagadasAntes` | copied by `duplicar`, now **live** in a model year (`previoEnVivo`: `desde 0`, origin `arrastre`, previous year with a model) | `arrastreVivo` (called by `leerAnio` and on a storage event when nothing is being edited) re-reads `carryDiciembre` of the stored previous year while the field still equals `copiaDiciembre`; field and snapshot move together |
| a carried field the user changed in the new year | user data (D14) | kept; the "Diciembre cambió" notice names it |
| legacy year (no model) or a year starting mid-year | copied snapshot | unchanged; any December change shows the notice |
| v1.32/v1.33 model year without `copiaDiciembre` | opening of an older version | December of today is adopted as the snapshot in memory only (no number changes, nothing written); a field that differs from December is ambiguous and is kept as stored |
| installment rows of a plan | loaded once (historical rows untouched) | `duplicar` (model year) no longer loads installments the previous year still schedules (`cuotasProgramadas`); rows loaded twice by older versions are named by `cuotasDeMas` (estimates paid with max(pagadasAntes, real paid in the previous year)) and never removed |
| retroactive edits of past months | historical | not changed by this fix |

Numbers (probes `scratchpad/s2/p1-carry.js`, `p3-cuotas.js`; tests `tests/h1.cruce.test.js`):

| Case | Before | After |
|---|---|---|
| late December savings transfer 100.000 | 2027 Disponible 1.180.000, Ahorro 800.000, bruto 3.480.000 (100.000 vanished) | 1.180.000 / 900.000 / 3.580.000 (bruto unchanged) |
| late December retiro 50.000 | bruto +50.000 | bruto 0 (Disponible +50.000, Ahorro −50.000) |
| late December USD 100 | USD 1.000, bruto +0 (dollars never arrived) | USD +100, bruto +150.000 (cotización 1.500) |
| 2027 created in October, Oct/Nov paid later | 3 rows (Jan-Mar), Pasivos 300.000 | 1 row (Jan), pagadasAntes 5, Pasivos 100.000 |

- Property test: 60 seeds `20261013 + s·7919` (s = 1..60), mulberry32, random late December edits in random order; I4 asserted for
  Disponible, Ahorro, a reponer, USD and each plan's saldo/restantes, plus Patrimonio, CSV and "El año" agree.
- Migration: a 7f7ad40-era two-year dataset reads byte-equal to `normalizar` of the stored blob (no model: nothing follows, no notice);
  a legacy-created year keeps its copied values and legacy installment loading; v1.32 years: unchanged numbers, snapshot adopted in
  memory, later December changes followed once saved.
- Isolated, not fixed (**OWNER_DECISION_REQUIRED**): a v1.32 year read for the first time after December changed keeps the stored
  `pagadasAntes` (ambiguous: drift or the user's number), so Pasivos can count installments that 2026 already paid, and installment
  rows loaded twice by older versions stay (D14: no row deletion). Both are named by the notice ("<plan>: en <año> hay N cuotas cargadas
  de más (cargadas en …). No borré nada: revisalas antes de pagarlas."); the user decides.
- Mutation check: replacing `max(pagadasAntes, real paid)` with `pagadasAntes` in `cuotasDeMas` fails `H1 migration v1.32: installments
  loaded in both years…` and `H1-R a real December change…`.

### M1 — Pases dated before the month-to-month balance (2026-10-13)

Owner's preference (brief 2026-10-13): "bloquear antes que alterar el saldo". Probe `scratchpad/s2/p2-backpase.js` (test `M1 probe
p2-backpase`): with a declared opening in October, a pase dated 30/09 moves Trabajo −300.000 and the Disponible 0 (bruto −300.000); one
dated 10/10 leaves the total unchanged. Deleting such an old pase gives the 300.000 back to Trabajo while the opening already holds them.

- The pase sheet refuses a date in a month before `arrastre.desde` of a model year (`desdeDelSaldo`, `avisoPaseAntes`): the note turns
  red as soon as the date is typed and «Pasar» does nothing: "Esa fecha (10/03/2026) es anterior a Septiembre 2026, desde cuando llevás
  el saldo mes a mes: pasarlo con esa fecha haría aparecer o desaparecer plata. Elegí una fecha desde Septiembre 2026." (the brief's
  wording with "ese pase" replaced by "pasarlo": L2 forbids the word "pase" in UI copy).
- The two-tap «Pasar igual» confirmation (`paseOk`, interim `8653da0`) is removed: there is no sheet state left; a valid date saves at
  once. Test gap W4 ("reopening the sheet clears an earlier confirmation"): no confirmation exists any more; the test
  `M1 test gap (W4)` pins that `paseOk` is gone and that the date alone unblocks.
- Deleting a pase that went to a month before `desde` is refused (`quitarPase`, alert "No se puede borrar … No cambié nada."), nothing
  written. Existing pases before `desde` are not modified. Legacy years (no model) take any date as before.
- RED: 5 of 8 new `M1` tests failed before the change (refusal, unblock, test gap, delete refusal, delete harness).

### M3 — Restores that would mix Trabajo from two sources (2026-10-13)

Owner's preference (brief 2026-10-13): "conservar datos y bloquear". `restaurarTexto` calls `mezclaTrabajo` before opening the
confirmation sheet; on a conflict it shows "No restauré la copia" with the years and what to do, sets nothing pending and writes nothing.

| Case | Behavior |
|---|---|
| backup without `trabajo`, this phone's Trabajo passed money to a year the backup restores | refused: "La copia no trae Trabajo, y el Trabajo de este teléfono pasó plata a lo personal en 2026, que la copia reemplaza: … Restaurá una copia completa (con Trabajo), o hacé primero una copia de seguridad … No cambié nada." |
| backup `trabajo` passed money to a year the backup does not bring and this phone has | refused, naming the years ("… con todos esos años …") |
| backup without `trabajo`, phone Trabajo only in other years | offered as before: "La copia no trae Trabajo: se mantiene el Trabajo de este teléfono." |
| old backup without Trabajo on a phone without Trabajo; complete backup | offered as before |
| backup `trabajo` into a year neither the backup nor the phone has | offered, notice "… pero ni la copia ni este teléfono tienen <año>." |

- Cancel path: the sheet writes nothing until «Reemplazar» (test). Pase years come from `fecha` (as the interim notice did).
- RED: the 4 new `M3` tests failed before the change (no refusal; old wording). The interim tests of `4717c65` were replaced by these.

### N2-B repair — months with two "Del trabajo" rows (2026-10-13)

User-initiated and reversible; the engine is unchanged (goldens byte-identical) and no stored data changes unless the user repairs.

- The Trabajo notice (`avisoTrabajoDoble`) offers «Revisar y ordenar» when some month can be ordered. `planOrdenTrabajo` lists every
  month with more than one "Del trabajo" row; a month is ordered only when exactly one row has the exact name (the `renglonTrabajo`
  criterion: the row a pase creates) and it is not already first. Months with two exact rows (or none) are listed in the preview
  ("hay más de un renglón llamado exactamente «Del trabajo»: no lo ordeno, revisalo en Mes.") and never touched.
- Preview (`abrirOrdenTrabajo`): per month, each row's name, amount and tick, and the cobrado / sin cobrar before → after from
  `flujosMes` (`efectoOrdenTrabajo`); a month before the month-to-month balance says "No cambia ningún total de ese mes."
- «Ordenar» (`ordenarTrabajo`): refused in a stale tab (nothing written); writes the months' rows as they were to the device-only key
  `kibo.reparoTrabajo.<año>` FIRST, then moves the exact row to where the first "Del trabajo" row was (no name, amount or tick change;
  other rows keep their order) and saves the year. Example (test fixture): October [«Dél trabajo» 100.000 sin cobrar, «Del trabajo»
  300.000 cobrado] with a 300.000 pase: cobrado 400.000 → 300.000, sin cobrar 0 → 100.000 (`flujosMes` [ingresosReal, trabajoRealizado,
  ingresosPend] [100.000, 300.000, 0] → [0, 300.000, 100.000]).
- «Deshacer» (toast and a notice that stays until «Listo»): puts back the saved rows, months byte-identical; refused in a stale tab or
  when a repaired month changed afterwards ("Cambiaste Octubre después de ordenar: deshacerlo ahora borraría ese cambio. No cambié
  nada."). «Listo» forgets the copy.
- L-03d (`tests/r4.cobertura.test.js`) stays `todo`: it reads unrepaired data, and the engine allocation order did not change.
- RED: the 6 tests in `tests/n2b.reparo.test.js` failed before the change (functions missing); mutation (exact row put back at its own
  index) fails 3 of them.

### Final audit fixes (sprint closure, 2026-10-13)

Twelve findings from the closing audits: the financial review (a5ad…, probes `fin/p1`–`p8`), the security audit (probes `sec2/probe4`,
`probe6`) and the X1 native review. One fix per commit (`e9d5ff6..`), each with `npm test` green (`npm run test:e2e` on UI-behavior
commits and the last one). No money rule changed: `tests/fixtures/motor-golden*.json` byte-identical to `e9d5ff6`. No data is deleted.
Tests: `tests/s4.final.test.js` (items 1–10, 12) and `tests/s2.auditoria.test.js` (item 11). Each fix: RED observed first, then a
mutation of the fix fails its tests.

| # | Source · severity | Repro | Cause | Fix (commit) | Status |
|---|---|---|---|---|---|
| 1 | Financial review · HIGH | 2027 created by 1.32/1.33 (no stored `copiaDiciembre`), then a December 2026 edit: bruto −100.000, no notice (`fin/p1` A2) | `leerAnio` adopted the copy in memory only; after the edit the stored field looked user-edited and froze | `copiaDelSiguiente` stores the copy (from December as stored) before the previous year is saved; if it cannot be written, the year is not saved either (`cbff9bb`) | Done |
| 2 | Financial review · HIGH | Restore a backup WITH Trabajo bringing 2026 only, while this phone's Trabajo passed money to 2025 (kept): Trabajo disponible 700.000 → 1.000.000 (`fin/p3`, `p7`) | `mezclaTrabajo` did not check this phone's pases into kept years | Refused with a message, nothing written (`cefb3d6`) | Done |
| 3 | Financial review · MEDIUM | Re-save the plan sheet in 2027: «poner 3», then `cuotasDeMas` flags 2 extra (`fin/p5`) | `ofrecerCarga` ignored the installments December still schedules (the shift `duplicar` applies) | `conCuotasDeDiciembre` counts them during the calculation only (`968f925`) | Done |
| 4 | Financial review · MEDIUM | 2025 legacy, 2026 balance declared from a later month: a pase dated 2025-12-20 left Trabajo and reached no Disponible (bruto −300.000) (`fin/p1`, `p1b`) | `desdeDelSaldo` returned −1 for a year without `arrastre` | `inicioDelSaldo`: such a pase (and deleting it) is refused, pointing to where the balance starts (`9005a07`) | Done |
| 5 | X1 native review R3-001 · MEDIUM | A second «Ordenar» whose year cannot be saved removed or broke the undo record of the first | the undo record was written first and not restored on failure | the previous record text is put back exactly (or none) when the save fails (`9db0cf2`) | Done |
| 6 | Financial review · LOW | Repair, later edits, second repair, «Deshacer»: the later edits were lost (`fin/p8`) | the undo record kept the months from the first repair | a repair records the months as they are right before it (`5ddc821`) | Done |
| 7 | Security audit · MEDIUM | A hand-edited backup with a year or a month as an array: every later save silently lost that month (`sec2/probe6`) | `normalizar`/`escribirAnios` took arrays as objects; JSON of an array drops named fields | an array month is read as an empty month; an array year is skipped and named in the restore message (`5cccdb4`) | Done |
| 8 | Security audit · MEDIUM | A backup with a 4.4 MB `cuarentena` text filled the storage; later saves failed (`sec2/probe4`) | restore copied any string into `kibo.cuarentena.*`, which the app never deletes | `cuarentenaDeCopia`: 2 MB per text, 4 MB per backup; over the cap → not imported, named in the restore message; existing quarantine untouched (`4d64158`) | Done |
| 9 | Financial review · MEDIUM | Typing in 2027 while another tab saves a December 2026 edit: after its own save the open year kept the old December (`fin/p4`) | `alCambiarOtraPestana` skips the refresh while editing and nothing re-read it later | `releerDic`: the next successful save of that year re-runs `arrastreVivo` and renders (not while a field has the focus) (`16e95ac`) | Done |
| 10 | Financial review · LOW | Any error while following December opened the year as stored with no word | `leerAnio`: `try{ arrastreVivo(...) }catch(e){}` | the year read is marked (non-enumerable, never saved) and the December notice (`data-av="deriva"`) says it; no data change (`ceed56f`) | Done |
| 11 | X1 native review · LOW (test gap) | The M3 cancel test set `pendiente = null` itself | it never ran the app's cancel | the test evaluates the app's real `data-act` click listener and taps the sheet's «Cancelar»: sheet closed, nothing pending, storage unchanged (`1d7f42e`) | Done |
| 12 | Financial review · LOW (perf) | A 4-year chain read each previous year 5–7 times per render | `leerAnio` → `arrastreVivo` → `previoEnVivo` → `leerAnio`, asked again by `derivaAnioPrevio`, `cuotasDeMas`, `cierreAnioAnterior`, `desdeDelSaldo` | read-only lookups use `leerAnio(a, true)`, shared per year and day in `memoAnios`, cleared at `render()` start, on every write (`escribirConRev`, `escribirJuntos`, `recuperarDiario`, `escribirAnios`) and on every storage event; results byte-identical to the unmemoized path (`4a6fc83`) | Done |

Notes: item 9 does not re-render while a field has the focus (the values are already re-read; the next render shows them). Item 12's
`escribirJuntos`/`recuperarDiario` invalidation has no dedicated test (the save, storage event and restore paths do).

### X2 native review fix (2026-10-28)

| # | Source · severity | Repro | Cause | Fix | Status |
|---|---|---|---|---|---|
| X2-1 | X2 native review (review-8f5130ab7b3ab443) · WARNING, money | Legacy year before a stored year that starts in January from `arrastre`: a pase into the legacy year was allowed, left Trabajo and reached no Disponible (bruto −300.000) | `inicioDelSaldo` let it through when the first later model year started in January from `arrastre`, but that year follows December live only when the previous year itself has the month-to-month balance | `inicioDelSaldo` refuses a pase into a year without the balance whenever any later stored year has it, whatever that year's start; pure legacy (no later year with it) unchanged. CSP script hash updated in `index.html` and `privacidad.html` | Done |

Evidence: `tests/s5.x2.test.js` (case table + pure-legacy case) fails 1/2 on the pre-fix code and passes 2/2 with the fix;
`npm test` 913 (912 pass, 0 fail, 1 todo L-03d); `npm run test:e2e` 534/534; `tests/fixtures/` unchanged (motor goldens identical).
Route: inline (one function, already understood). No other X2 findings are recorded in the repository or Engram.
