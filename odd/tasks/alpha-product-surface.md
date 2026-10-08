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
- [x] P2 Branding kibFinanzas → TuGasto (visible surfaces only) + manifest/title/metadata + LEEME. Route: delegated writer.
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

### P1 — UX/UI audit (done, route: delegated read-only auditor; 44 screenshots at 360/390/430/1280, dark mode)

Realistic model year seeded (hoy 2026-10-15). Full report kept outside the repo (scratch); key results recorded here.

What was implemented but NOT visible or misleading on screen (P0):
1. Hero says "Disponible final · Octubre $952.000" but it is today's balance; the month-end estimate ($890k) is buried.
2. A future month's projection is shown in the same bold green as real money.
3. Three unlabeled totals in a month (hero tiles = collected/paid; section headers = registered incl. pending; "En qué se te va"
   adds installments).
4. "El año": two different "December" figures (savings pace vs closing) with no labels; "Ahorro acumulado" is year-end incl.
   scheduled while Patrimonio is a hoy; "Arranque del año" is last year's savings, not the opening balance.
5. Dólares year table total counts a future USD inflow; the breakdown (a hoy) does not.
6. Trabajo "A lo personal" counts a future pase; "Disponible del trabajo" does not (Q4).
7. "Del trabajo" covered by pases looks uncollected; help text leaks "pases".
8. First-use question appears above a hero that already shows a number.
9. Fresh install stacks three prompts and 14 zero rows.
P1: red used for normal choices; pending/overdue absent from the first screen; FAB covers amounts and duplicates the hero button;
"USD" tab holds Patrimonio; Ahorro sub-headings larger than the section; debts "Sin pago este mes" reads as nothing due;
re-confirm block hard to read; Patrimonio answer comes last; update notice shows an old version; legacy years unmarked.
Layout: no overflow and no clipped money at any width; 31 tap targets < 44 px on the 390 month; 10 px tab labels, 8.5 px chart axes.
Brand: visible "kibFinanzas"/"KF" in title, header logo, print, Ajustes, footer, welcome, share titles, alerts, export file
names, manifest, privacidad.html, icons ("K"). Must stay: `kibo.*` keys, SW cache prefix `kibfinanzas-offline-` (old-cache
cleanup depends on it). Safe: backup `app` field (restore never checks it), manifest id.
Classification: items 1-3, 7-9 and the P1 list are presentation (no money rule). Items 4-6 are "a hoy" vs year-end/scheduled
mixing on screen: resolved by labeling and by splitting realized vs scheduled per §1/I5/Q4/Q13 (derived, no new rule).

### P2 — Branding (done, route: delegated writer; app + test + icon files, so delegated per the writer trigger)

What changed (visible identity → TuGasto):
- index.html: `<title>`, `apple-mobile-web-app-title`, header mark `KF` → `TG` (same `.kf` style, `title="TuGasto"`; a full
  "TuGasto" wordmark does not fit beside the save status and the Guardar button at 360 px, the reason v1.4 moved to a
  monogram), `document.title` and print header `TuGasto · <año>`, Ajustes privacy text and footer `TuGasto v<APPVER>`,
  "Bienvenido a TuGasto", share titles "Copia de TuGasto", restore alerts "No parece una copia de TuGasto", the size alert,
  export names `tugasto-copia-<fecha>.json`, `tugasto-<año>.html`, `tugasto-<año>.csv`, `tugasto-trabajo-<fecha>.csv` and the
  Trabajo CSV first line `TuGasto · Trabajo por mi cuenta · …`. New backups write `app:'TuGasto'`.
- manifest.webmanifest: `name`/`short_name` "TuGasto", description starts with "TuGasto". `id` unchanged (`./`).
- privacidad.html: title, date line (moved to 7 de octubre de 2026 because the text changed), body, back link.
- LEEME.md: title "TuGasto" + "TuGasto (antes kibFinanzas)" note; install steps, example repo name and PC file name use the
  new name. Historical changelog entries (v1.1, v1.4) keep the old name: they are history. No new changelog entry: the version
  bump belongs to P7 (the release test pins APPVER 1.32.0 as the first entry).
- Icons: apple-180, favicon-64, icono-192, icono-512, maskable-512 show a white "TG" on #1f9d55 (was "K"). Rounded square for
  the "any" icons and the favicon; full-bleed for apple-180 (iOS masks it; transparent corners would render black);
  maskable-512 full-bleed with the mark inside the 80 % safe circle. Generated by drawing on a `<canvas>` in the system
  headless Edge over CDP (same launch pattern as tests/e2e/run.mjs) and saving `toDataURL('image/png')`; sizes verified from
  the PNG IHDR (180/64/192/512/512). No dependency added; the generator script stayed in the session scratchpad.

Must stay (technical compatibility), each with its reason:
- localStorage keys `kibo.*`: renaming them would orphan every installed user's data.
- Service-worker cache name/prefix `kibfinanzas-offline-` (sw.js:5-6) and the sw.js source comment: old caches are deleted
  only by that prefix; renaming it would leave every old cache behind. The cache version was NOT bumped here (P7 owns it).
- Backup `app` field: restore never reads it, so old `app:'kibFinanzas'` backups (and backups without the field) keep
  opening; new backups say `app:'TuGasto'`. Proven by tests/p2.marca.test.js (old, new and field-less backups restore the
  same data).
- Internal identifiers: CSS class `.kf`, local variables named `kf`, the `window.__kf` test hook, package.json `name`, the
  `KF-kibfinanzas` repository/URL in LEEME (P11 decides the remote). None of them is shown in the app.
- Follow-up for P11 (outside P2's edit surface): `.gitignore` ignores `kibfinanzas-*.json`; personal exports are now
  `tugasto-*.json` / `.csv` / `.html` and need the same rule before publishing.

Tests:
- New tests/p2.marca.test.js (9): old-brand scan of index.html, privacidad.html, manifest.webmanifest and sw.js with an
  annotated allowlist (only sw.js's comment, VERSION and PREFIJO lines; each entry must still match exactly once);
  TuGasto title/mark/exports/manifest/privacy; icon PNG signature and sizes; old kibFinanzas, new TuGasto and field-less
  backups restore the same data; armarCopia writes `app:'TuGasto'` and round-trips.
- E2E (+13): document.title starts with "TuGasto"; header shows "TG" titled TuGasto; linked manifest named TuGasto; welcome
  sheet; Ajustes footer "TuGasto v"; the four exported file names start with `tugasto-`; Trabajo CSV first line; no text
  node or title/aria-label/placeholder/alt with the old brand in the rendered mes/anio/usd/trabajo/ajustes tabs and the
  welcome sheet.
- Updated pinned checks: the PC-file title (`TuGasto · 2027`), the Ajustes footer (`TuGasto v`) and the PC file name.
- Results: `npm test` 688 (687 pass, 1 todo L-03d); `npm run test:e2e` 231/231. Motor goldens untouched.
- Screenshots: header at 390 px, light and dark (session scratchpad `ux/shots/p2-header-light.png`, `p2-header-dark.png`).

### P3a — Redesign: tokens, home, month (done)

Route: delegated writer (index.html + tests; 2+ non-trivial files). Scope: design tokens, the month view (hero, rows, balance
block, first use/empty states, savings), tap targets. No money rule changed: every number on screen is read from cadena /
flujosMes / tilesMes / lineasSaldo / calc (legacy). Motor goldens byte-identical to 2e68947. D16-15 stays PENDIENTE-R7.

Design decisions:
- Tokens (CSS custom properties, light and dark, also under the `data-tema` overrides): type scale hero 40/700, card number
  28/700, section 17/600, row 16, caption 13, minimum 11, tabular money; 4-pt spacing, gutter/card padding 16, gap 12, rows
  ≥ 48, taps ≥ 44, 72 px FAB clearance; radius 14 (was 20); color roles realizado (green), pendiente/atrasado (amber),
  programado/proyectado (gray), deuda (neutral), trabajo (indigo), problem (red: negative balance, save failure, data at
  risk only). State chips (`.chip.real/.pend/.atras/.prog/.trab`). Decorative circles removed (month card, year summary).
- Hero (`estadoHero`/`htmlHero`): modes `hoy` ("Tenés hoy" = cadena cierreCalc, "Al cierre: $Y · estimado" = proyectado,
  chips "Te falta cobrar" = ingresosPend, "Te falta pagar" = gastosPend + cuotasPend, "Atrasado" = resumen.vencidos,
  "Sin cobrar de antes" = vencidosIngresos; each chip scrolls to its rows), `cerrado` ("Cerraste con" = cierre +
  Confirmado/Sin confirmar), `proyectado` ("Proyectado para <Mes>", gray number, dashed card, Programado chip; a negative
  projection is amber, never red/green), `simple` (legacy month/year: "Disponible final" = calc(), "Cálculo simple" chip).
  Tiles read Cobrado/Pagado (A cobrar/A pagar in a future month). Removed: hero buttons El año, Dólares (tab bar), Gasto
  (the FAB stays the single Gasto button) and Copia (Ajustes and the backup reminder keep it). Savings/over-cap hints are
  amber and one at a time (repay first). The FAB slides away while scrolling down and returns on scroll up; the page
  bottom clears it.
- Rows: paid = solid check; pending in a past/current month = amber ring + "Falta" ("Atrasado" in a past month); a row of a
  future model month = dashed ring + "Programado" (R5 esProgramado/puedeAlternar unchanged). Section header = total and,
  below it, "falta $X" (`faltaSeccion`: flujosMes pending rules in a model month, calc() pendienteX in a legacy one; 0 in a
  future month). Del trabajo (`textoDelTrabajo`): "Cobrado $300.000 de $400.000: lo que pasaste desde Trabajo. Los $100.000
  que faltan tildalos cuando los cobres." (pases dated ≤ hoy allocated in order like flujosMes; no "pases" wording).
  Debts: "Cuota 10 de 12 · pendiente / pagada / programada / sin pagar" instead of "Sin pago este mes; va la 10".
- Balance block: origin chip "Viene de Septiembre" / "Corregido en Septiembre" (previous closing confirmed with a
  difference; a confirmation equal to the records keeps "Viene de") / "Lo cargaste vos" / "Viene de diciembre <año>" /
  "Sin configurar" (amber); Editar 44 px; overdue reads "Atrasado de meses anteriores" (amber, chip target). Re-confirm
  (finding 14) is an amber box: "Cerraste con $175.000 (confirmado) · tus registros ahora dan $203.000" with "Usar
  $203.000" (fijarCierreReal with the calculated value: the same action as the start-of-month Confirmar, one tap instead
  of opening the sheet), "Dejar $175.000" (the existing Mantener) and "Otro monto" (the closing sheet, as before).
- First use / empty: the first-use question takes the hero's place (no number above it); when the year has data, the
  simple calculation stays below it, gray and marked ("Hasta que respondas: lo que tildaste este mes"). Fresh install
  order, one prompt at a time: (1) welcome sheet, (2) "Esta app está vacía" (restore / start fresh; question and card
  hidden via CSS `:has`), (3) the first-use question. Common reminders (backup, version notice) wait while the question
  is open; data-at-risk notices (quarantine, other tab) never wait. A year with nothing loaded shows each section as one
  sentence + "Cargar <sección>" instead of the template's zero rows.
- Savings: in-section sub-headings are caption size (the Ajustes page-title `.subtit` rule was making them 24 px). Pasé a
  dólares / Otros dólares / Saqué del ahorro / Repuse al ahorro wait behind "Más movimientos del ahorro" while empty
  (a group with an amount, a negative savings stock or something to repay stays visible); "a reponer" is amber.
- Tap targets: checks, ×, Editar, Guardar, eye, carousel dots, row info buttons, chips ≥ 44 × 44 (visual ring/dot kept
  small by a pseudo-element); tab labels 11 px. Over-cap bars/texts amber (class `.mal` kept for the DOM contract).

Before → after per finding: 1 "Disponible final · Octubre" → "Tenés hoy" + "Al cierre · estimado"; 2 future projection in
green → gray "Proyectado para Noviembre" + Programado; 3 unlabeled totals → Cobrado/Pagado tiles + "falta" per section;
7 Del trabajo looked uncollected / "pases" → "Cobrado X de Y"; 8 question under a number → question first; 9 three
stacked prompts + zero rows → one at a time + one-sentence sections; 10 red hints, pending absent → amber hints, pending
chips in the hero; 11 FAB + duplicated buttons → FAB only, tab-bar duplicates gone, FAB hides on scroll; 12 Ahorro
headings 24 px, 8 open inputs → caption headings, disclosure; 13 "Sin pago este mes" → "Cuota N de M · estado"; 14
four-line red re-confirm → amber two-choice box. Legacy years: same numbers, "Cálculo simple" chip.

Tests: new tests/p3a.vista.test.js (12: hero state per month = cadena/tilesMes/lineasSaldo values, hero texts and
colors, faltaSeccion adds up to flujosMes/calc over 30 months, header "falta", row states, Del trabajo states, debt
states, empty sections, first-use gray card, savings disclosure). Updated pins (old wording → new): r5.mes (Del trabajo,
debt text), r5.saldos (origin texts, overdue label, re-confirm block), r4.matriz ("Sin configurar"), e2e (card Gasto
button → FAB only; Del trabajo text; "Sin configurar" chip; re-confirm text; empty notice flow opens "Cargar gastos
variables" before typing). E2E +32 P3a checks (rendered DOM / computed styles): hero and estimated closing equal to the
balance block, chips and their amounts, chip scroll, tiles, section falta, row states, Del trabajo, Cuota 10 de 12,
origin chip + Editar 44 px, future month gray + Programado row chip, past month Confirmado, Usar/Dejar labels and the
values they write, first use before any number, fresh-install order, legacy marker, tap targets ≥ 44 at 390, no
overflow at 360/390/430 (Sep/Oct/Nov). Inventory: faltaSeccion, textoDelTrabajo classified r4.
Results: `npm test` 700 (699 pass, 1 todo L-03d); `npm run test:e2e` 262/262; goldens unchanged.

Screenshots (session scratchpad `ux/shots/`, seeded realistic year, hoy 2026-10-15): before `p3a-antes-<dark|light>-<390|1280>-*`,
after `p3a-despues-<dark|light>-<390|1280>-*` for abrir, mes-oct, mes-sep, mes-nov, mes-ago-legacy, primer-uso, vacio-mes,
vacio-empezar, legacy-2025 (script `ux/shoot-p3a.mjs`, light/dark via prefers-color-scheme emulation).

Left for P3b: El año (finding 4), Patrimonio/USD tab (5, 15), Trabajo (6), the update notice version text (15), the
1280 month-bar clipping and other P2 polish (expense sheet "$", "Sumar"), the FAB still covers the right edge of the
first screen at rest on phones (consider a Gasto action in the tab bar), and terminology alignment of the balance block
lines ("Disponible actual" / "Proyectado al cierre") with the hero ("Tenés hoy" / "Al cierre").

## Improvement loop (owner: "ejecutá todo lo que creas necesario para mejorarla en formato loop", 2026-10-07)

Ordered backlog (each item: test-first, suites green, docs, small commits; native review consent batched per slice):
- [ ] L1 P3b: El año, Patrimonio (tab renamed from "USD"), Trabajo, update-notice version, 1280 month bar, expense sheet polish,
      Gasto action without covering amounts, one vocabulary across hero and balance block.
- [ ] L2 P4: microcopy sweep of every screen, sheet, notice, error, confirmation and backup/restore text.
- [ ] L3 R7 / D16-15: quick expense on a pending item asks (D8: mark the existing one as paid vs record a separate realized
      expense keeping the plan pending). Owner explicitly asked for it now; D8 is the approved rule.
- [ ] L4 Backup reminder ("hace N días que no hacés una copia" + one-tap download).
- [ ] L5 "Qué vence esta semana" (pending with dates, installments, Trabajo invoices) on opening.
- [ ] L6 R6 analysis: month vs previous and vs average, category trends, "más que lo normal" (from the validated model).
- [ ] L7 Desktop two-column layout + accessibility (contrast, labels, focus, screen reader).
- [ ] L8 Atomic writes (year + Trabajo) and strict CSP if feasible without breaking the PC file; else documented debt.
- [ ] L9 Version 1.33.0 + SW, PWA update path, offline, PC/file:// verification.
- [ ] L10 Native review slices, final verification, GitHub (destination must be given by the owner), ALPHA verdict.
