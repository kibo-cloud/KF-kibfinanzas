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
- [ ] S1 Pending decisions review (N1-B, N2-B, N3a-A/B, N3b-A/B, N4-A/B, L3 partial payment + "(otro gasto)" vs topes, L5 due day):
      context, alternatives, effects, recommendation; apply only what is already approved.
- [ ] S2 End-to-end financial flow audit (entry → display → persistence → export → restore), findings with repro/impact/cause/test.
      Route: delegated read-only auditor; fixes by a writer, RED first.
- [x] S3a Quick-sales pie chart (data-backed metrics, period explicit, text alternative).
- [x] S3b "⋮ → Editar producto" from the product screen (no sale on edit; history preserved).
- [x] S3c Persistent "Agregar producto" access.
- [x] S3d Local visual consistency of the quick-sales screen.
- [ ] S4 Independent reviews of money/persistence changes; native review per slice with owner consent.
- [ ] S5 Security / performance (large product lists) / offline / desktop regression.
- [ ] S6 Final verification and delivery report.

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
- **Tests.** `tests/s3.ventas.test.js` (35 unit tests: pie data and percentages, sale copy unaffected by product edits, stale-tab
  refusal, add/edit paths); e2e S3a-S3d checks in `tests/e2e/run.mjs` (pie values and text table, ⋮ geometry at 360/390/430 px in both
  views, long press on ⋮ never sells, + Producto in the viewed folder, empty state, S3d 44 px targets — RED observed at 32x32 / 36 px
  before `9051c2f`).
- **Screenshots** (light and dark, 390 and 1280 px; top, grid, bottom): `scratchpad/s0/s3-{390,1280}-{top,grid,bottom}[-dark].png`;
  before: `s3-before-*.png`. Reviewed: no clipped text besides the intended ellipsis on long secondary lines, no overlap of ⋮ and the
  payment icon, contrast unchanged (existing tokens).

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
| N4-B (LOW) | Quarantine copies are kept forever and travel in backups. | (a) keep (built); (b) Ajustes row to download and delete each; (c) auto-delete when readable (against "never delete"). | Storage only. | (b), owner to confirm deletion UX. |

Safe to build without the owner (presentation only): N2-B (a) detection notice; N3b-B prominent "sin cargar" label; N4-A (c) download
action. Everything else waits for the owner.
