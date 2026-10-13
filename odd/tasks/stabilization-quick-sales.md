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

- [ ] S0 Map the quick-sales module (data model, sale flow, persistence, undo, edit capabilities, add-product placement, existing
      charts). Route: delegated read-only explorer.
- [ ] S1 Pending decisions review (N1-B, N2-B, N3a-A/B, N3b-A/B, N4-A/B, L3 partial payment + "(otro gasto)" vs topes, L5 due day):
      context, alternatives, effects, recommendation; apply only what is already approved.
- [ ] S2 End-to-end financial flow audit (entry → display → persistence → export → restore), findings with repro/impact/cause/test.
      Route: delegated read-only auditor; fixes by a writer, RED first.
- [ ] S3a Quick-sales pie chart (data-backed metrics, period explicit, text alternative).
- [ ] S3b "⋮ → Editar producto" from the product screen (no sale on edit; history preserved).
- [ ] S3c Persistent "Agregar producto" access.
- [ ] S3d Local visual consistency of the quick-sales screen.
- [ ] S4 Independent reviews of money/persistence changes; native review per slice with owner consent.
- [ ] S5 Security / performance (large product lists) / offline / desktop regression.
- [ ] S6 Final verification and delivery report.

## Progress / evidence

(filled per task)
