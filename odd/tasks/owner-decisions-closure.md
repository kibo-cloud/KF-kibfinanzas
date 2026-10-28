# Owner decisions closure (TuGasto 1.34.0)

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
| GitHub | Not done: destination/visibility must be given by the owner | Remote rule. |

## Constraints

- Static PWA, single `index.html`, no build tools or runtime dependencies; strict CSP (update script hashes in `index.html` and
  `privacidad.html` when the inline script changes).
- New stored fields read with fallback; no stored data is deleted or rewritten automatically.
- Test-first: RED observed before each behavior change, then GREEN; mutation check on money changes.
- Motor goldens (`tests/fixtures/motor-golden*.json`) stay byte-identical except for D1, whose differences are listed case by case.
- Version snapshot: `versiones/TuGasto v1.33.0` taken 2026-10-28 before this work (workspace rule).

## Checklist

- [x] D0 Reconcile P1-P12 in `alpha-product-surface.md` with L1-L10 evidence (docs only). Route: inline (one doc). Ticked P1, P3-P9,
      P12 with the citing section; P10 left open (dead `.fab` CSS still present, found by rg), P11 left open (owner deferred, no
      destination); P8 marked superseded by this feature. Docs only: no test run needed.
- [ ] D1 N2-B (b) engine allocation order + goldens report + L-03d green.
- [ ] D2 L3 (b) partial payment split.
- [ ] D3 "(otro gasto)" counts toward the original row's tope.
- [ ] D4 L5 optional due day on rows/plans + "Qué vence esta semana".
- [ ] D5 N1-B (b) or resolved-by-H1 proof.
- [ ] D6 N3b-B prominent label + N4-A download action (verify whether already built).
- [ ] D7 N4-B Ajustes quarantine rows (download / delete with confirmation).
- [ ] D8 Version 1.34.0 + SW `kibfinanzas-offline-v47`, update path, full suites, docs (`CLAUDE.md`, S1 table rows marked resolved).

## Delivery

Branch `feat/owner-decisions` from `fix/repair-sprint-1` (dd6a132). One work-unit commit per task, Conventional Commits, no AI
trailers. No remote configured: push/PR are owner decisions. Forecast ~900-1300 authored changed lines; strategy `exception-ok`
(no PR possible without a remote; native review per slice by RDD assessment).

## Checks

`npm test` (baseline 913: 912 pass, 1 todo L-03d) and `npm run test:e2e` (baseline 534/534) per task closure.

## Progress / evidence

- 2026-10-28: document created; decisions recorded. Engram mirror pending (memory session ambiguity).

## Next step

D0.
