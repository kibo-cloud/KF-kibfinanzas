# Alpha product surface — UX/UI, branding, PWA, GitHub

## Objective

Turn the technical Alpha candidate into a product the user perceives as a new version (TuGasto 1.3 / Alpha): the R4/R5 money
mechanics are visible and understandable without reading the contract, the visible identity is TuGasto, mobile and desktop
work, the PWA delivers the new build, and the repository is published to GitHub clean and safe.

Owner brief: "TU GASTO — PRODUCT SURFACE, UX/UI, BRANDING, GITHUB & FINAL ALPHA" (2026-10-07).

## Constraints

- Do not redo R4/R4.5/R4.6/R5. Respect Q1-Q15, the R4 contract, R4.4/R4.5 decisions, R5, D16 (D16-15 stays PENDIENTE-R7), the
  complementary matrix, migrations, backups and existing data.
- No new money rule. New product decisions → `OWNER_DECISION_REQUIRED`, documented, work continues.
- Branding: visible identity → TuGasto; technical compatibility stays (localStorage keys `kibo.*`, backup format fields such as
  `app: 'kibFinanzas'` if read on restore, migration names, cache name prefix only if renaming does not break cleanup). Every
  legacy reference kept is documented with its reason.
- Goldens never regenerated to hide a difference. Security protections never weakened for UX.
- Small conventional commits; no AI attribution.

## Baseline (2026-10-07, before any change)

- Branch `fix/repair-sprint-1`, HEAD `1c3c3f8`, tree clean, NO git remote configured.
- APPVER `1.32.0` (index.html:2450); service worker `kibfinanzas-offline-v45` (sw.js:5); manifest name/short_name `kibFinanzas`.
- `<title>kibFinanzas</title>` (index.html:8), privacidad.html title "Política de privacidad · kibFinanzas".
- Visible-name occurrences (`kibfinanzas`/`kib finanzas`, case-insensitive, lines): index.html 19, privacidad.html 5, LEEME.md 7,
  manifest 2, sw.js 3.
- No `.gitignore`.
- `npm test`: 679 (678 pass, 0 fail, 1 todo L-03d). `npm run test:e2e`: 218/218. Motor goldens byte-identical to 1528a44.

## Checklist (route per task recorded below)

- [ ] P1 UX/UI audit of the real app (screenshots 360/390/430/desktop; dashboard, month, patrimonio, Trabajo, pending/scheduled,
      empty and future states; microcopy; branding inventory). Route: delegated read-only auditor.
- [ ] P2 Branding kibFinanzas → TuGasto (visible surfaces only) + manifest/title/metadata + LEEME. Route: delegated writer.
- [ ] P3 Visual redesign (hierarchy, cards, states, spacing, typography, feedback) + R4/R5 mechanics visible (Disponible origin,
      proyectado vs actual, programado, pendiente actionable, Trabajo, patrimonio composition, deudas). Route: delegated writer(s).
- [ ] P4 Microcopy pass (titles, buttons, errors, confirmations, notices, empty states, backup/restore texts).
- [ ] P5 Mobile/responsive fixes (360/390/430/desktop).
- [ ] P6 UX E2E (visible assertions for the flows in the brief) + branding/PWA tests.
- [ ] P7 PWA/cache: version bump with justification, update path for existing installs, offline, PC/file://.
- [ ] P8 OWNER_DECISION review (N1-B, N2-B, N3a-A/B, N3b-A/B, N4-A/B); N2-B with maximum data conservation.
- [ ] P9 Security/integrity regression; CSP status.
- [ ] P10 Pre-Alpha cleanup (dead code/CSS, stale labels, debug logs).
- [ ] P11 GitHub: .gitignore, secret/PII scan, remote (destination must be explicit), push, verification.
- [ ] P12 Native review per slice, final verification, ALPHA_READY / ALPHA_BLOCKED.

## Progress / evidence

(filled per task)
