# Alpha product surface — UX/UI, branding, PWA, GitHub

## Objective

Turn the technical Alpha candidate into a product the user perceives as a new version (TuGasto 1.3 / Alpha): the R4/R5 money
mechanics are visible and understandable without reading the contract, the visible identity is TuGasto, mobile and desktop
work, the PWA delivers the new build, and the repository is published to GitHub clean and safe.

Owner brief: "TU GASTO — PRODUCT SURFACE, UX/UI, BRANDING, GITHUB & FINAL ALPHA" (2026-10-07).

## Constraints

- Do not redo R4/R4.5/R4.6/R5. Respect Q1-Q15, the R4 contract, R4.4/R4.5 decisions, R5, D16 (D16-15 stayed PENDIENTE-R7 until L3 built R7, 2026-10-08), the
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

### L1 — P3b: El año, Patrimonio, Trabajo (done)

Route: delegated writer (index.html + tests; 2+ non-trivial files). No money rule changed: every figure is read from serieVista /
cadena (estadoHero) / patrimonioNeto / patrimonioPantalla / resumenTrab. Motor goldens byte-identical. D16-15 untouched.
Commits: 240e9ed (legacy amounts recorded before the redesign), 5786c97 (feature + updated pins), d2a4950 (E2E).

Before → after per finding:
- 4 El año: two unlabeled "December" figures, "Ahorro acumulado" year-end incl. programado next to an a-hoy Patrimonio, "Arranque
  del año" → one hero: "Tenés hoy" (= month hero, chain) + chip "A hoy", "Ahorro acumulado a hoy" (= patrimonioNeto.ahorroARS, the
  Patrimonio figure), then "Al cierre del año (estimado)": "Disponible al cierre de diciembre (estimado)" and "Ahorro al cierre de
  diciembre (estimado, con lo programado)" (= December row of serieVista). The pace line is "Ahorro a este ritmo en diciembre";
  "Los doce meses" header "Cierre $X · estimado"; "Ahorro acumulado" header "en diciembre · estimado"; "Arranque del año" →
  "Ahorro con el que arrancaste el año". Past model year: "Cerraste el año con"; future: gray "Proyectado para diciembre";
  legacy: "Disponible final del año" + "Cálculo simple" (same numbers). Chart axis text 13 user units (≥ 11 px at 360, ≤ 17 px at
  1280 via max-width 440).
- 5 / 15 Patrimonio: tab "USD" → "Patrimonio" (internal id `usd` kept; there were no deep links besides `?gasto=1`). Order: hero
  "Patrimonio neto a hoy" in pesos + "En dólares: US$ X" (legacy: "Todo junto al cierre del año" + "Cálculo simple"), "De qué se
  compone" (R5 composition), "Dólares mes a mes", "Datos" (cotización, cripto, dólares del año anterior: every input, only there).
  The dollars table of a model year no longer has one "Cierre" total: "A hoy" (= patrimonioNeto.usd, the composition figure) and
  "Con lo programado" (difference + year end); future months say "programado" (Q13, I5). Legacy table unchanged.
- 6 Trabajo: "A lo personal $650.000" (incl. the future pase) → "Lo que pasaste a lo personal": "Ya pasaste $450.000" +
  "Programado $200.000" (`pasesPersonal`: ya = pasado − pasadoProgramado, the split resumenTrab/Disponible already use, Q4); the
  Disponible text says "lo que ya pasaste a lo personal" and adds "Programado para pasar a lo personal: $Y. Se descuenta en su
  fecha."; scheduled pase rows "Programado para el …". "Entra en 30 días" → "Vence en 30 días o menos" (prox30 is the open
  balance by invoice due date, the same concept as "Vence en N días").
- 15 Update notice: "versión 1.30" → "versión <APPVER>", two lines; waits (CSS `:has`) while the start-of-month closing question
  is open; "Tenés hoy" stays above the tab bar at 390 × 844.
- P2 polish / 1280: the month bar fits the content at ≥ 720 px (12 equal buttons, nothing scrolled away); the tab bar is padded
  to the content width; expense sheet amount with "$" prefix, placeholder "0", button "Sumar gasto".
- 11 Gasto: the floating button became a tab-bar action (center, filled green, `id="fab"` kept, `data-act=gastoRapido`); from
  another tab it opens the month first; `?gasto=1` still works. The scroll-away handler and the 72 px FAB clearance are gone.
- Vocabulary: balance block "Disponible actual" / "Proyectado al cierre (estimado)" / "Disponible al cierre" → "Tenés hoy" /
  "Al cierre (estimado)" / "Cerraste con"; future month "Proyectado para <Mes>".
- Fit: Trabajo segmented control, cobranza and folder buttons ≥ 44; compact product badge 11 px; section titles keep ≥ 40 % of
  the header so they do not wrap word by word.

Tests: new tests/l1.vistas.test.js (6: legacy El año and Patrimonio keep the exact set of money amounts and tables recorded on
ec9db4a in fixtures/l1-legacy-numeros.json and are marked; model El año figures = chain / patrimonioNeto / serieVista with their
labels, one hero; past and future years; dollars a hoy vs programado and the card order; pasesPersonal adds up and matches
Disponible). Byte pins anio-legacy.json / usd-legacy.json regenerated with TUGASTO_GOLDEN_RAZON (layout only; the year CSV is
still the 0ad13c1 one). Updated pins (old wording → new): r4.anio (Cierre estimado, pace line), r4.cobertura (explicaDisp),
r5.patrimonio (headline in pesos, composition title), r5.saldos and e2e (balance block words, the Patrimonio helper reads
#bigPatri / #patriUSD). E2E +42 L1 checks. Results: `npm test` 706 (705 pass, 1 todo L-03d); `npm run test:e2e` 304/304.

Screenshots (session scratchpad `ux/shots/`, script `ux/shoot-l1.mjs`, hoy 2026-10-15): `l1-<dark|light>-<390|1280>-` abrir,
mes-oct, anio, patrimonio, trabajo, hoja-gasto, aviso-actualizacion.

Left: Ajustes/other sheets microcopy (L2); `.fab` CSS rules are now unused (L10 cleanup).

### L2 — Microcopy (done)

Route: delegated writer (index.html + tests; 2+ non-trivial files). Text only: no money rule, no layout change, no new action.
Motor goldens byte-identical to 58bd02d. User-derived strings still go through `esc()`; `filaAj`/`pildora` keep escaping.
Commits: 99750e4 (Ajustes, backups, data warnings, other tab), d82768c (Trabajo + help), 3c37c84 (El año, Patrimonio, opening
balance), bc0ffb4 (tests), e96e419 (balance block label). About 50 user-facing strings changed in index.html (58 lines).

Rules applied:
- One vocabulary across screens: Tenés hoy / Al cierre (estimado) / Cerraste con / Proyectado para / Cobrado / Pagado / Falta /
  Programado / Lo que pasaste. No internal words on screen: pase(s), bolsillo, arrastre, modelo, cadena, LAB, R4/R5, legacy, internal
  version numbers, "el sistema".
- Errors say what happened and what to do; no browser error names (`NotAllowedError`) or file internals.
- Destructive confirmations state the consequence (all nine `confirmar` calls checked by a test).
- Icon-only buttons have an aria-label (already true; now guarded by E2E). Voseo, short, warm.

| Screen | Old | New |
| --- | --- | --- |
| Ajustes · Año | Volver a como estaba antes de la 1.30 / Guardado al actualizar… | Volver a como estaba antes de actualizar / Se guardó al actualizar la app… |
| Ajustes · Año | Volver a como estaba antes de los saldos / Guardado antes de empezar con los saldos… | Volver a como estaba antes del saldo mes a mes / Se guardó antes de que la app empezara a llevar tu saldo de un mes al otro… |
| Ajustes · restore confirmations | …, antes de la 1.30. / …, antes de empezar con los saldos. | …, antes de actualizar la app. / …, antes de que la app llevara tu saldo de un mes al otro. |
| Ajustes · restore refusals | No pude guardar una copia de lo que no se puede leer. No cambié nada. / No se pudo restaurar | No pude apartar los datos que no se pueden leer, así que no cambié nada. Hacé una copia de seguridad y probá de nuevo. / No se pudo restaurar. No cambié nada: probá de nuevo. |
| Dónde viven tus datos | Compartir archivos en este navegador → json: sí · json como texto: sí · txt: sí | Desde este navegador la copia se puede mandar directo a Drive, al mail o a WhatsApp. (or: …no se puede mandar directo: queda en Descargas…) |
| Dónde viven tus datos | El sistema se comprometió a conservarlos / El sistema no garantiza conservarlos / En este teléfono, sin garantía del sistema | Están protegidos (row: Protegidos: el teléfono no los borra) / No están protegidos (row: Sin protección: hacé copias seguido) / En este teléfono, sin protección asegurada |
| Ajustes · Copia | Copiar la copia al portapapeles | Copiar la copia como texto |
| Backup alerts | Tu navegador aceptó el archivo pero rechazó el envío (NotAllowedError)… / Tu navegador rechazó el envío (…)… | Tu navegador no dejó mandar el archivo. La copia está a salvo en Descargas… / Tu navegador no dejó mandar el archivo… |
| Backup alerts | Probar compartir / Copiar / No se puede / Copiada al portapapeles | Compartir de nuevo / Copiar como texto / No se puede compartir (+ mandala desde la app Archivos) / Copiada como texto |
| Versión para PC | No pude armarlo · El archivo de la app no tiene las marcas donde van los datos… / No se puede acá | No pude armar la versión para PC · No encontré dónde poner tus datos… Recargá la app con internet y probá de nuevo. / No se puede desde este navegador |
| Other-tab notice | Hay cambios hechos en otra pestaña. Recargá para no perderlos. | Hay cambios hechos en otra pestaña. Recargá para verlos: hasta entonces esta pestaña no guarda nada. |
| Unreadable year notice | No pude leer los datos de 2026. Guardé una copia; no se van a pisar. | No pude leer los datos de 2026. Los aparté tal cual para que no se pierdan, y ese año no se modifica. |
| Trabajo | Borrar el pase · Se descuentan $X del renglón … | ¿Borrar lo que pasaste? · Se descuentan $X del renglón … y vuelven al disponible del trabajo. |
| Trabajo | Pase borrado. No encontré el renglón … | Lo borré de Trabajo, pero no encontré el renglón … |
| Mes · Del trabajo row | …borrá esos pases desde ahí… los dos lados siguen cerrando. | …borralo desde ahí… las dos pestañas siguen cerrando. |
| Trabajo · cobranza | Hola! Te escribo por… | ¡Hola! Te escribo por… |
| Método de uso | La idea: …lo que queda es el disponible final. Ese número grande del resumen… | …Tenés hoy… Al cierre (estimado)… Cerraste con… Proyectado para |
| Método de uso | El botón verde de abajo / (Mes → Año → USD → Ajustes) / scrolleando / scrollear | El botón Gasto, en el medio de la barra de abajo / (Mes → Año → Patrimonio → Trabajo → Ajustes; …) / deslizando / deslizarlas |
| Método de uso | cinco temas … si el sistema se comprometió… / Guardar la versión para PC / Exportar CSV | seis temas (+ Tu forma de trabajo) … si tus datos están protegidos / Versión para PC / CSV del año |
| Método de uso | Los topes se arrastran… / arrastrado mes a mes y año a año / Si borrás un pase… mientras tenga pases / …gastos y pases | Los topes pasan solos… / sumado mes a mes y de un año al otro / Si borrás algo que pasaste… mientras tenga plata pasada desde Trabajo / …gastos y lo que pasaste a lo personal |
| El año | Al cierre del año (estimado) › Disponible al cierre de diciembre (estimado) / Ahorro al cierre de diciembre (estimado, con lo programado) | Al cierre del año (estimado) › Disponible en diciembre / Ahorro en diciembre (con lo programado) |
| Patrimonio | Lo que tenés hoy, bolsillo por bolsillo. | Lo que tenés hoy, parte por parte. |
| Mes · saldo | Cobros pendientes de meses anteriores: | Sin cobrar de meses anteriores: (pairs with "Atrasado de meses anteriores" and the hero chip "Sin cobrar de antes") |
| Mes · saldo de diciembre | …que no está en este teléfono con saldos. / No se pudo guardar. | …Ese año no está en este teléfono, o no lleva el saldo de un mes al otro, así que no se puede corregir desde acá. / No se pudo guardar. Probá de nuevo. |

Kept on purpose: "¿Cuánto dinero tenés disponible actualmente?" (owner wording, D5/Q1); "Disponible final" in a year or month
without the month-to-month balance ("Cálculo simple", pinned by the legacy byte fixtures); "Todavía no la editaste en este archivo"
(cotización) and the year-CSV headers ("Ahorro ARS", "USD del mes"), because both sit in byte-pinned fixtures (usd-legacy.json, the
0ad13c1 CSV) and the gain was too small to regenerate them; the stored snapshot field `version: 'anterior a los saldos'` (data,
never shown). Follow-ups: a debt that already has a plan offers only Quitar / Guardar (no Cancelar; the backdrop closes it);
"💳 Digital / Virtual" (Trabajo summary) vs "Transferencia / Virtual" (quick-sale button).

Tests: tests/ui-textos.js documents and implements the extraction (markup text + title/aria-label/placeholder/alt, string literals
with a space, comments/regex/one-word identifiers skipped, markup stripped, escapes decoded; one-word literals are left to the
rendered-DOM walk). New tests/l2.microcopia.test.js (7): extractor sanity, the method on a synthetic source, no jargon, no
English/programming words (Save, Cancel, Delete, Loading, Error:, undefined, NaN, null), privacidad.html, every `confirmar` has a
consequence body, one "estimado" in El año. E2E +83 L2 checks: a planted-word control, then the rendered text and labels of the five
tabs, three Ajustes screens and eleven sheets (quick expense, debt plan, September closing, welcome, restore confirmation, pass to
personal, its detail and delete confirmation, new invoice, payment received, work expense): no jargon, no English words, every
icon-only button labeled; each sheet opens and closes; the delete-confirmation text; the El año rows. Updated pins (old → new
wording): e2e (other-tab notice, restore row, unreadable year, El año rows), n4.integridad, n7.final, r4.migracion, l1.vistas,
r5.patrimonio. Results: `npm test` 713 (712 pass, 1 todo L-03d); `npm run test:e2e` 387/387.

### L4 — Backup reminder (done)

Route: inline in the single writer (index.html + tests). No money rule; nothing about the backup format or the backup flow changed.
Commit: 6dabc01.

- Rule: ONE compact notice (`#avisos`, same slot and order as the old reminder: after the no-storage notice, the welcome and the
  empty-phone notice; the unreadable-data notice is never covered, `sinTaparCuarentena`; the update notice still replaces it) when
  the last backup (`kibo.ultimaCopia`, already written by `hacerCopia`) is older than 30 days, or there was never one and this phone
  has had data for 7 days or more. Text: "Hace N días que no hacés una copia de seguridad. Tus datos viven solo en este dispositivo."
  (never backed up: "Hace N días que cargás datos y todavía no hiciste ninguna copia de seguridad. Tus datos viven solo en este
  dispositivo."). Buttons: "Hacer copia ahora" (`data-act="copia"` → the existing `hacerCopia`, which clears the notice and records
  the date) and "Más tarde" (snooze 7 days). Never for an empty phone, never downloads by itself, never blocks.
- Replaced: the old reminder (15 days, or immediately when never backed up, "Después" only closed it for this start). Ajustes' "Última
  copia" row keeps its 15-day red mark (DIAS_AVISO, unchanged).
- New device keys (in CLAVES_PROPIAS, NOT in the backup, classified in tests/r4.endurecimiento.test.js and claves.test.js):
  `kibo.datosDesde` (first day this phone had data; recorded at start-up, forgotten when the phone is empty again) and
  `kibo.copiaPospuesta` (snoozed until). A phone that already had data before this version starts counting the 7 days from its
  first start with this version (there is no earlier date to read).
- Code: `recordatorioCopia(ahora, ultima, desde, pospuesta, conDatos)` (pure), `revisarCopia`, `posponerCopia`; constants
  DIAS_COPIA 30, DIAS_SIN_COPIA 7, DIAS_POSPONER 7.
- Tests (RED first: tests/l4.copia.test.js 0/6 before the code): thresholds (30 days exactly / just over, 7 days with data, no
  recorded day, unreadable date), empty phone, snooze window, one notice with both buttons, the first-day key. E2E +10 (replaces the
  old "reminder shown with no backup yet" check): no reminder on day 0, the first day recorded, 8 days with data, 40 days since the
  last backup, "Más tarde" hides and snoozes (and stays hidden after a restart), back after the snooze, "Hacer copia ahora" produces
  the backup file through the existing flow and hides it with today's date, empty phone. Results: `npm test` 719 (718 pass, 1 todo
  L-03d); `npm run test:e2e` 396/396; motor goldens byte-identical to ae166a3.

### L3 — R7 quick expense on a pending item (done)

Route: inline in the single writer (index.html + tests). Rule: D8 only (approved). No new money rule: "Sí" is a tick (realized, Q1-Q3),
"No" is an ordinary ticked row; both are read by the existing chain. Motor goldens byte-identical to ae166a3 (the only motor-block
line touched is `normalizar` keeping two optional movement fields, like R2's `pp`; no golden input has them). Commit: 18107b6.

- When: the quick expense targets a row that is NOT ticked and has an amount > 0, in a current or past month of the model, or in any
  month of a year without the model (legacy). D8 is about the row, not the model, and nothing in the contract contradicts it: D4 keeps
  historical numbers as they were computed (nothing already recorded is rewritten; the user's answer only writes the month being
  edited). A future month of the model keeps N4 I-1 (amount added, no tick, no question). A ticked or empty row behaves as before.
- Question sheet: "Gasto de $20.000" / "Super está pendiente por $50.000. ¿Este gasto es ese pago?" → "No, es otro gasto" ·
  "Sí, marcarlo como pagado" · "Cancelar" (nothing changes while asking; Cancelar closes it).
- "Sí": ticks the existing row. Same amount → done. Different amount → second sheet "¿Con qué monto lo marco?" ("Super decía $50.000
  y anotaste $20.000.") → "Dejar $50.000" / "Cambiar a $20.000" / "Cancelar". Never a second row (no duplication). Toast "Marqué
  Super como pagado" + Deshacer. The movement logged is `{tipo:'pago', ma:<previous amount>, pp:<previous tick>, monto:<row amount
  after>}`.
- "No, es otro gasto": there was no existing mechanism for a separate quick expense, so a separate ticked row is created in the same
  section: "Super (otro gasto)" with the typed amount; the planned row stays pending. Named "<row> (otro gasto)" and not exactly
  like the row because rows are identified by name inside a section (undo, "Copiar del mes anterior", topes propagation, the order
  list, "Agregar a todos"): two rows with the same name would make undo and next month's copy act on the wrong one. If "Super (otro
  gasto)" already exists and is ticked or empty it is reused (amount added); a pending one is never mixed in ("Super (otro gasto 2)").
  Toast "Anoté $20.000 en Super (otro gasto). Super sigue pendiente" + Deshacer. A created row is logged with `tipo:'aparte'`.
- Undo (E9, toast or the × in "Gastos rápidos", also after a restart: `normalizar` keeps `tipo` and `ma`): "pago" restores the
  previous amount and tick; "aparte" subtracts and removes the row it created; a reused row gets its amount back. Each answer then
  Deshacer leaves the month byte-for-byte as before (tested with deepEqual of the whole month).
- Example (D16-15: opening 100.000, Sueldo 500.000 ✓, Super 50.000 ✗, quick 20.000): Sí + Dejar → Tenés hoy 550.000, al cierre
  550.000; Sí + Cambiar → 580.000 / 580.000; No → 580.000 / 530.000; every undo → 600.000 / 550.000.
- OWNER_DECISION_REQUIRED (not built, no rule invented): partial payment — the typed amount is smaller than the pending row and the
  user wants the rest to stay pending (today: "Dejar" marks the whole row paid, "Cambiar a" makes the row the typed amount; neither
  keeps a pending remainder). Options: (a) split the row into a paid part and a pending remainder; (b) keep today's two answers.
  Also not decided: whether "<row> (otro gasto)" should count toward the row's tope (today it has no tope of its own).
- Tests (RED first): tests/l3.gasto.test.js 0/8 and D16-15 failing before the code (functions missing); after: 8/8 and D16-15 PASS.
  D16-15 (tests/r4.matriz.test.js) is no longer a PENDING-R7 pin: it asserts the question, both "Sí" amounts, "No", the chain after
  each and undo to the exact month. Mutation check on the guard `preguntaPago`: always false → 7 failures; without the future-month
  clause → 2; without `monto > 0` → 1. Updated pins: tests/movimientos.test.js (E9 "pending amount" case now answers the question
  both ways), harness lists in movimientos and n4.integridad; inventory: preguntaPago, preguntarPago, gastoEsPago, marcarPago,
  gastoAparte classified `otro`. E2E +17: the question text and buttons, nothing changes while asking, Cancelar, "Sí" amount
  question, Dejar (one row, toast, Deshacer), Cambiar a + restart + undo from the list, same amount ticks directly, "No" separate row
  and toast, its undo, future month unchanged. Results: `npm test` 727 (726 pass, 1 todo L-03d); `npm run test:e2e` 413/413.
- Review fixes (see "L3/L4 review fixes" below): undo of a "Sí" now reverses only that payment (a5dd6c1); "Copiar los montos de <mes>"
  skips "<row> (otro gasto)" rows (e493538).

### L3/L4 review fixes

Route: inline in the single writer (index.html + tests). Independent review of ae166a3..a113e68. RED first: tests/l34.revision.test.js
5/7 failing before the code (the two "undo the second one first" cases already passed), 7/7 after.

1. HIGH, a5dd6c1 `fix: undoing a "Sí" reverses only that payment`. `quitarMov` restored the row to the stored amount (`ma`) and lost
   whatever happened to the row after the "Sí" (repro: Super 50.000 pending → quick 50.000 "Sí" → quick 10.000 → undo the first →
   50.000 pending, the 10.000 lost while its movement stayed listed; undo the second → 40.000). Now the undo reverses the delta of that
   payment: `monto = max(0, monto − mv.monto + mv.ma)` and the previous tick. "Dejar" (mv.monto = ma) leaves the amount alone; "Cambiar a"
   puts the planned amount back on top of later changes. Tests: both payment paths × both undo orders end at "Super 50.000 pending" with
   no movement left; a manual edit after "Sí" survives its undo (45.000 stays 45.000; 20.000 → edited 22.000 → undo → 52.000).
2. MEDIUM, e493538 `fix: copying the previous month skips one-off expenses`. `copiarAnterior` copied "<row> (otro gasto)" rows (money
   already spent, D8 separate realized expense) into the next month as pending plan. `esGastoAparte(nombre)` matches exactly the names
   L3 creates (`<something> (otro gasto)` and `(otro gasto N)`, N ≥ 2); they are skipped (and do not count as something to copy).
3. LOW, b1f52cb `fix: the backup reminder counts data in any year`. `revisarCopia` only looked at the open year, so an empty open year
   cleared `kibo.datosDesde` and hid the reminder although another stored year had data. `hayDatosEnElTelefono()` = open year or Trabajo
   or any other stored year (`aniosGuardados` + `leerAnio` + `hayDatos`).
4. Accepted LOW (documented, no code): restoring a backup made by this version into an OLDER app drops the movement fields `tipo`/`ma`
   (its `normalizar` does not know them), so undo there falls back to subtracting the amount. Old-version only.

Results: `npm test` 734 (733 pass, 1 todo L-03d); `npm run test:e2e` 413/413; motor goldens byte-identical.

### L5 — Qué vence esta semana (done)

Route: inline in the single writer (index.html + tests). No money rule: every amount is a row amount or an invoice open balance
(`saldoFac`); no date is invented. Commit: 6621fa9. Motor goldens byte-identical to a113e68.

- Where: the month view of the CURRENT month only, a card right under the hero (`#vence`), before the balance block. Nothing due → no
  card at all (no empty message). Hidden while the first-use question is open and while the "Esta app está vacía" notice is shown (the
  same `:has` rule as the hero), so the one-prompt-at-a-time order is kept. It is content, not a notice: `#avisos` is untouched.
- What has a date in the data (checked): expense and installment rows have NO due day (rows are `{nombre, monto, tope, frec, dias,
  pagado}`; `frec`/`dias` exist only for income, "¿Cada cuánto lo cobrás?"); debt plans have no day either; Trabajo invoices have
  `venceFac` (fecha + plazo). So the card lists, from `vencimientos(d, j, hoy, facturas)`:
  1. Overdue rows of past months of the model: the same unticked rows `cadena.resumen.vencidos` (to pay) and `vencidosIngresos` (to
     collect) add up — "Del trabajo" excluded (its pending side is Trabajo's invoices). Legacy months have no "Atrasado" (as the hero).
  2. Income with collection days: the next configured day within 7 days ("Día 20", "Hoy", "Mañana"); all days passed → "Atrasado ·
     era el día N" (weekly without a day = Friday, as `cuantosPagos`).
  3. Rows without a day are due with the month (past month end they already become "Atrasado" by the existing rule): listed only in
     the month's last 7 days, chip "Fin de mes", "vence con el mes".
  4. Trabajo invoices with an open balance (contado never): overdue or due within 7 days, the same window as "Cobranza de la semana".
  Order: overdue first, then by date, same date bigger amount first. Six rows visible, then "Y N más: los ves en sus secciones".
- Tap: an invoice opens its detail (`verFactura`); a plan row opens its month (past month for an overdue one), opens its section if
  folded, scrolls it to the center and marks it amber for 1.8 s (`.resalta`; static under reduced motion). Rows are 48 px buttons.
- Constants (presentation): `DIAS_VENCE = 7`, `VENCE_MAX = 6`. Names go through `esc()`.
- OWNER_DECISION_REQUIRED (not built): a due day for expenses, installments or debt plans would be a NEW stored field (and new UI).
  Without it those rows only appear in the last week of the month. Options: (a) add an optional "vence el día N" to rows / plans;
  (b) keep today's behavior.
- Tests (RED first: tests/l5.vence.test.js 0/6 before the code, 6/6 after): only the current month; window (inside at exactly 7
  days, outside at 8 and 10, a passed day is overdue, weekly next Friday, ticked rows out); month-end rows (7 days in, 8 out; order);
  overdue rows add up to `cadena.resumen.vencidos` and to `vencidosIngresos` minus "Del trabajo", legacy year has none; invoices
  (overdue, today, inside, outside, paid); empty → no card, escaped names, "Y N más". Inventory: `vencimientos` r4 (lists single
  rows, display only), `htmlVence`, `irVence` otro. E2E +11: card right under the hero, title and count, rows/chips/sub-lines/amounts
  in order, tap targets ≥ 44, invoice tap opens it, current-month tap opens the folded section and marks the row, overdue tap opens
  September and marks Luz, no card in a future month, a ticked row leaves the card, no card when nothing is due.

### L6 — Analysis (done)

Route: inline in the single writer (index.html + tests). No money rule: every number is a `serieVista` field (Cobrado =
totalIngresos, Pagado = totalGastos, Ahorro = ahorroMesARS: the "Los doce meses" row and the month card tile) or the ticked gastos
per category, which add up to that Pagado (tested). Commits: 3f4c567, b9702e6. Motor goldens byte-identical to a113e68.

- Audit items: the deferred R6 list (E3, E6, E7, E8, E10, E11, U3) is only referenced by number in repair-sprint-1.md; the master audit
  text with their definitions is not in the repository, so this stage implements what the owner brief and L6 describe and what is
  derivable from the existing numbers (month vs previous / vs average, category trends, "más que lo normal"). Anything else on that
  list stays deferred.
- Months (I5): the transcurred months with data (`mesesTranscurridos` in a model year, `mesesCargados` in a legacy one), never a
  future month. Reference = the last of them (the current month in this year; December in a past year). Average = the months BEFORE
  the reference (presentation choice: the month in progress is not averaged with itself; said on screen: "El promedio es el de N meses
  anteriores"). No base (no earlier month, or 0) → no percentage and no sentence (no division by zero). A year that has not started
  or has nothing → no section.
- "Este mes contra los anteriores" (`anComp`, after the summary card): Cobrado / Pagado / Ahorro of the reference month with ↑/↓ % vs
  the previous month and vs the average, plain sentences ("Este mes gastaste 49% más que tu promedio.", "…62% más que en septiembre."),
  "Octubre todavía no terminó: cuenta lo que ya cobraste y pagaste." for the month in progress, and "Cálculo simple" in a legacy year.
- "Cómo vienen tus gastos" (`anTend`): the 5 categories with the most ticked gastos over the realized months (same definition as
  "En qué se te fue la plata": `datosRealizados` + `estaPagado`, fijos + variables), each with its amount in the reference month
  ("Nada en <mes>" when 0), a 12-slot mini bar chart up to that month (inline SVG, the reference bar green, no library), its average
  and ↑/↓ %. "Más que lo normal" = 25 % or more above the category's own average of the earlier months (`MAS_QUE_LO_NORMAL = 0.25`, a
  presentation constant, not a money rule); amber line + chip; a new category (average 0) never qualifies.
- Legacy years: their own numbers (calc/serie), marked "Cálculo simple". The legacy byte pins (anio-legacy.json) and the L1 legacy money
  set (l1-legacy-numeros.json) are NOT regenerated: the pin tests compare "El año" without the two new sections
  (`anio-vistas.sinAnalisis`), proving everything else is byte-identical; l1.vistas also asserts the new section is marked.
- Tests (RED first: tests/l6.analisis.test.js 0/7 before the code, 7/7 after): realized months only (November ticked, never counted),
  reference/previous/base, values = serieVista; categories add up to Pagado every month; threshold (+50 % in, +24 % out, exactly +25 %
  in, new category out); sentences and card HTML; division by zero and a one-month year; empty / future year → null; legacy year
  (calc numbers, December reference, "Cálculo simple", escaped names). Harness: anio-vistas FUNCS/VARS (+8 functions, +2 constants).
  Inventory: `analisisAnio` mixto. E2E +9: section order, header and rows (October, vs Septiembre, vs Promedio), sentences, the
  in-progress note, categories (escaped, no November "Viaje", 10 bars each), "Más que lo normal" chip/line/header count, nothing of
  the future month, no horizontal overflow at 360, legacy year December "Cálculo simple".

Results (after the L3/L4 fixes, L5, L6): `npm test` 747 (746 pass, 1 todo L-03d); `npm run test:e2e` 433/433.

Screenshots (session scratchpad `ux/shots/`, script `ux/shoot-l56.mjs` based on shoot-l1, hoy 2026-10-15, seeded year plus two dated
income rows and one more invoice): `l56-<light|dark>-390-` and `l56-light-1280-` l5-mes-oct, l6-anio-analisis, l6-anio,
l6-anio-legacy.

### L7 — Desktop + accessibility (done)

Route: inline in the single writer (index.html + tests; resumed after an interrupted writer, its diff reviewed and kept). No money
change; motor goldens byte-identical. Commits: c5daa38 (390 px boxes recorded BEFORE the layout, tests/fixtures/l7-movil-390.json),
aecfb19, 2120ca1.

- Desktop (`@media screen and (min-width:1024px)`, screen only so printing keeps the single column): content max 1200 px centered
  (24 px gutters), the tab bar aligned with it. Mes: two columns (`.mes-cols` 5fr / 7fr): left = hero, "Qué vence", balance block;
  right = the sections and rows. The wrappers are `display:contents` below 1024 px, so the phone DOM boxes do not move. The left
  column is `position:sticky` only when it fits the window (`fijarResumen` on render/resize); otherwise it scrolls with the page.
  El año, Patrimonio, Trabajo: summary/hero full width, sections in two CSS columns (`break-inside:avoid`). Ajustes max 720 px.
  Sheets were already centered with max-width 520 px; on desktop max-height 80vh.
- Contrast (WCAG AA 4.5:1, computed from the CSS custom properties in light, dark and both forced themes): light `--txt2` #8a8a8e →
  #6c6c70, `--acc` #1f9d55 → #177a45, `--neg` #d0453a → #c23a30, `--c-prog` #6e6e73 → #636366; new `--on-acc` (white in light,
  #06210f in dark) for every text on a green fill (white on the dark theme's light green was 2.3:1). Forced themes repeat the
  system themes value by value (tested).
- Keyboard and screen reader: `html lang="es-AR"`; the tab bar is a `role=tablist` of five `role=tab` buttons (`aria-selected`,
  `aria-controls` → `role=tabpanel` views) with arrows/Home/End; Gasto is a plain action outside the tablist (DOM order changed,
  visual order kept with CSS `order`, the L1 1280 check now sorts by position). The sheet is `role=dialog aria-modal=true`, named
  by its first h3 (`aria-labelledby`, else "Ventana"), focus moves inside on open, Tab/Shift+Tab are trapped, Esc closes it (as
  tapping outside) and the focus returns to the opener. Toast and pill: `role=status aria-live=polite`. `:focus-visible` ring 2 px.
  Hidden amounts: each "••••" is wrapped as `role=img aria-label="oculto"`. `prefers-reduced-motion`: no animations/transitions.
- Tests: tests/l7.accesibilidad.test.js (7: contrast light/dark incl. state chips and text on green, forced themes = system themes,
  the check really measures, markup roles, focus ring / reduced motion / desktop media). E2E +30: 390 px boxes of mes/año/
  patrimonio/trabajo unchanged vs the recorded fixture; at 1280 and 1440 two columns side by side, centered ≤ 1200, no overlap, no
  horizontal overflow (mes, anio, usd, trabajo); left column static when it does not fit, sticky at 1600 px high; tablist and
  aria-selected; ArrowRight + Enter; Enter on Gasto opens the dialog with focus inside; 25 Tab/Shift+Tab stay inside; Esc closes and
  returns focus to Gasto; live regions; focus ring; hidden amounts read "oculto"; reduced motion stops the animations.
- Screenshots (`ux/shots/`, script `ux/shoot-l7.mjs` = shoot-l56 with the four views, hoy 2026-10-15): `l7-<light|dark>-<1280|1440>-`
  mes, mes-todo, anio, patrimonio, trabajo and `l7-light-390-` (same set). Looked at: month in two columns, El año / Trabajo sections
  in two columns, no overflow at any width.

### L5/L6 review fixes

Route: inline in the single writer. RED first: tests/l56.revision.test.js 0/8 before the code, 8/8 after (probe `l56rev/p1.js`).

1. MEDIUM, 3a6754e `fix: "Qué vence" lists the uncovered part of "Del trabajo"`. `vencimientos` dropped every "Del trabajo" row, but
   `flujosMes` counts its part above the pases as pending (repro: September "Del trabajo" 500.000 unticked, no pases, hoy 2026-10-15
   → hero "Sin cobrar" 500.000, card nothing). Now each row's pending amount is the row amount, or for "Del trabajo" the
   `repartoTrabajo(...).exceso`; the overdue listing adds up to `cadena.resumen.vencidos + vencidosIngresos` (tested, also with a
   300.000 pase → 200.000, and covered/ticked → nothing). The L5 test that excluded it was updated.
2. MEDIUM, 8e9a648 `fix: "Qué vence" shows the amount of each collection`. Weekly / fortnightly / "días" incomes showed the monthly
   total next to one date. Now each date shows `monto / cuantosPagos` (rounded, the same per-payment figure as `cobroTxt`), every
   passed day of an unticked row is its own "Atrasado · era el día N" entry, plus the next date if inside 7 days. Tests: weekly
   Fridays at hoy 2026-10-24 (4 overdue × 8.000 + the 30th), fortnightly 15/30 (15th overdue, 300.000 each).
3. LOW, daa29e4 `fix: mark separate quick expenses with a flag`. "No, es otro gasto" creates its row with `aparte: true`
   (`normalizar` keeps it); `esGastoAparte(row)` prefers the flag and falls back to the name for data saved before it. The
   empty-copy toast mentions "Del trabajo" only when the previous month had one; otherwise "No hay nada para copiar del mes anterior".
4. LOW, 94fa612 `fix: undo says when nothing could be reverted`. `quitarMov` said "Deshecho" and dropped the movement even when the
   row had been renamed or deleted; now it keeps the movement and says "No encontré el renglón para deshacer".

Results (after L7 and the L5/L6 fixes): `npm test` 762 (761 pass, 1 todo L-03d); `npm run test:e2e` 467/467; motor goldens
byte-identical to 956c4aa.
## Improvement loop (owner: "ejecutá todo lo que creas necesario para mejorarla en formato loop", 2026-10-07)

Ordered backlog (each item: test-first, suites green, docs, small commits; native review consent batched per slice):
- [x] L1 P3b: El año, Patrimonio (tab renamed from "USD"), Trabajo, update-notice version, 1280 month bar, expense sheet polish,
      Gasto action without covering amounts, one vocabulary across hero and balance block.
- [x] L2 P4: microcopy sweep of every screen, sheet, notice, error, confirmation and backup/restore text.
- [x] L3 R7 / D16-15: quick expense on a pending item asks (D8: mark the existing one as paid vs record a separate realized
      expense keeping the plan pending). Owner explicitly asked for it now; D8 is the approved rule.
- [x] L4 Backup reminder ("hace N días que no hacés una copia" + one-tap download).
- [x] L5 "Qué vence esta semana" (pending with dates, installments, Trabajo invoices) on opening.
- [x] L6 R6 analysis: month vs previous and vs average, category trends, "más que lo normal" (from the validated model).
- [x] L7 Desktop two-column layout + accessibility (contrast, labels, focus, screen reader).
- [ ] L8 Atomic writes (year + Trabajo) and strict CSP if feasible without breaking the PC file; else documented debt.
- [ ] L9 Version 1.33.0 + SW, PWA update path, offline, PC/file:// verification.
- [ ] L10 Native review slices, final verification, GitHub (destination must be given by the owner), ALPHA verdict.
