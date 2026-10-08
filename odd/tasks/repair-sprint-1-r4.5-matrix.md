# R4.5 — D16 acceptance matrix, complementary coverage and before → migration → after

Branch `fix/repair-sprint-1`, base `0b31901`. Contract: `odd/tasks/repair-sprint-1-r4-design.md` (approved, Q1-Q15 binding).
Official list: `odd/tasks/repair-sprint-1.md`, "D16 — official acceptance list (verbatim)".

How to reproduce every number below:

- `node --test tests/r4.matriz.test.js` — the 17 D16 cases (`D16-01` .. `D16-17`), one test each.
- `node --test tests/r4.cobertura.test.js` — complementary scenarios without a previous direct test (`C-xx`), R4.4 leftovers (`L-xx`),
  before/after invariants (`R-xx`).
- `npm run test:e2e` — screen checks named `D16-..` (hoy = 2026-10-04 in the E2E copy).
- `node tests/fixtures/r45-antes-despues.js` — prints the full before → migration → after tables of section D.

Unit tests use hoy = 2026-10-15 unless stated. "Part" = what produced the number: **motor** (`flujosMes`, `cadena`, `pasivos`,
`patrimonioNeto`, `iniciarArrastre`, parsers), **app** (`tilesMes`, `patrimonioPantalla`, `resumenTrab`, `activarSaldos`, `duplicar`,
`armarCopia`/`restaurarTexto`, `sumarGasto`/`quitarMov`), **UI** (what the E2E reads on screen).

Result legend: **PASS** = automated test asserts the expected numbers and passes. **PENDING-R7** = roadmap item, current behavior
pinned, no built guarantee violated. "UI R5" = the model passes; the screen for it is reserved for R5 by the owner.

## A. D16 official cases (17)

| # | Case | Input | Expected (source) | Actual (observed) | Result | Evidence | Part |
|---|---|---|---|---|---|---|---|
| 1 | sueldo realizado + gastos realizados | model desde Oct, opening 0; Oct Sueldo 1.000.000 ✓, Alquiler 400.000 ✓, Super 100.000 ✓ | resultado 500.000, cierre 500.000, disponible actual 500.000, card Ingresos 1.000.000 / Gastos 500.000 / 500.000; in a past month the closing becomes the next opening (§1, I1, I2) | 500.000 / 500.000 / 500.000; card 1.000.000 / 500.000 / 500.000; legacy calc 500.000; Sep variant: Sep cierre 500.000 → Oct apertura 500.000 | PASS | `D16-01` (r4.matriz); E2E `D16-01 Oct card` "500000", tiles ["$1.000.000","$500.000","—"] | motor, app, UI |
| 2 | sueldo pendiente + gastos realizados | opening 600.000; Sueldo 1.000.000 ✗; gastos 500.000 ✓ | resultado −500.000, disponible 100.000, pendiente ingresos 1.000.000, proyectado 1.100.000 (§1 Pendiente, Proyectado) | −500.000 / 100.000 / 1.000.000 / 1.100.000; card Ingresos 0; legacy calc −500.000 with 1.000.000 pending | PASS | `D16-02`; E2E `D16-02` "100000", tiles ["—","$500.000","—"] | motor, app, UI |
| 3 | saldo inicial + sueldo pendiente | opening 200.000; Sueldo 1.000.000 ✗ | disponible = opening 200.000; proyectado 1.200.000; if the month is past: out of its closing, out of the Oct projection, reported as overdue income (§1, Q8) | 200.000 / 1.200.000; card 200.000; past variant: Sep cierre 200.000, Oct apertura 200.000, proyectado 200.000, vencidosIngresos 1.000.000, vencidos 0 | PASS | `D16-03`; E2E `D16-03` "200000" | motor, app, UI |
| 4 | saldo inicial + ahorro | opening 300.000; Sueldo 1.000.000 ✓; Ahorro del mes 200.000; Nov ahorro 100.000; ahorro año anterior 500.000 | cierre 1.100.000; Disponible −200.000 / Ahorro +200.000 (I3); ahorro a hoy 700.000 (Nov excluded, I5); bruto = neto 1.800.000; Nov projection 1.000.000 (§1, §4, §6) | 1.100.000; dDisp 800.000 + dAhorro 200.000 = resultado 1.000.000; ahorro 700.000; bruto/neto 1.800.000; Nov 1.000.000 | PASS | `D16-04`; E2E `D16-04` "1100000", tiles ["$1.000.000","—","$200.000"]; `D16-12` Patrimonio ["US$ 1.200,00","$1.800.000"]; `D16-07` Nov "1000000" | motor, app, UI |
| 5 | saldo inicial corregido manualmente | section 2 blob without model; declare 825.000; then opening corrected to 200.000; Sep real closing 175.000 vs calc 200.000 | apertura 175.000 → disponible 825.000; correction +25.000 moves disponible to 850.000 and Nov projection to 1.305.000; no movement created; next opening = real closing, diferencia −25.000 (§8 Q1, D2, D6) | 175.000 / 825.000; 200.000 / 850.000 / 1.305.000; months byte-identical; Sep 200.000 / 175.000 / −25.000 → Oct 175.000. App: `activarSaldos` is idempotent (second call false, stored 175.000 kept) | PASS (model); UI via Editar since R5 N3a (`fijarApertura`: 850.000 → opening 200.000, rows unchanged; E2E `D16-05 Editar`) | `D16-05`; E2E `D16-05` | motor, app, UI |
| 6 | cierre confirmado que luego cambia | section 2 (Sep confirmed 175.000, calculated 200.000), then Sep Luz 20.000 ticked | confirmed value holds; diferencia updates; reconfirm asked; next opening unchanged; without confirmation the chain follows (D6, §2(d)B) | cierreCalc 180.000, real 175.000, diferencia −5.000, reconfirmar true, Oct apertura 175.000, disponible 825.000; unconfirmed: 180.000 → 180.000 → 830.000 | PASS | `D16-06`; E2E `D16-06` Oct "175000", Sep "175000" | motor, app, UI |
| 7 | pase futuro | (a) section 2 + Dec ahorro 50.000; (b) Trabajo pases 2026-10-05 300.000 and 2026-11-05 200.000 into a model year | nothing a hoy changes; only the projection of its month; Trabajo keeps a scheduled pase until its date and cannot pass it twice (D3, §4, Q4, Q5) | (a) disponible 825.000 and ahorro 600.000 unchanged; Dec projection 1.230.000; pasesNetosProg −50.000. (b) Trabajo disponible 700.000, paraPasar 500.000, programado 200.000; Oct card 700.000, Nov card 900.000 | PASS | `D16-07`; E2E `D16-07` Nov "1000000"; existing E2E `R4.4 model` (550.000 / 750.000 / Trabajo 700.000); `Q4: the pase sheet rejects ...` (r4.integracion) | motor, app, UI |
| 8 | ahorro histórico | ahorro año anterior 500.000; Jan-Aug legacy ahorro 50.000 each; desde Sep; Sep ahorro 100.000; Nov ahorro 200.000 | ahorro a hoy 1.000.000; legacy months read exactly as before; a year without model keeps the old year-end view (D4, I6, §6, D7) | 1.000.000 (model, `patrimonioPantalla` too); old `patrimonio()` 1.200.000; months 0-7 deepEqual `calc()`; legacy year shows 1.200.000 | PASS | `D16-08` | motor, app |
| 9 | restauración de backup | section 2 model blob (rev 4) → `armarCopia` → empty device → `restaurarTexto` | the same chain, card and net worth; an older backup without model restores a legacy year (§8, D14) | `cadena` deepEqual; cards Sep 175.000 / Oct 825.000 / Nov 1.280.000; net worth 2.625.000; old backup → no model view, card = `calc()` | PASS | `D16-09`; existing migration restore tests; E2E `R4.3 c` | app, motor |
| 10 | creación de nuevo año | `duplicar` from section 2 on 2026-10-15; then the new year read on 2027-01-15 | new year `arrastre {desde 0, apertura = Dec cierre, origen arrastre, calculadoOrigen}`; when the year arrives the LIVE previous closing wins and the drift is visible (§8, D6) | `{desde 0, apertura 825.000, origen arrastre, calculadoOrigen 825.000}`; ahorroAnioAnterior 800.000, USD 1.000, aReponer 50.000, plan pagadasAntes 3; 2027-01-15: cierrePrevio 625.000, apertura 625.000 (origen anioAnterior), difAnioAnterior −200.000; legacy year stays legacy | PASS | `D16-10`; `L-05` (real save path) | app, motor |
| 11 | modificación de un mes anterior | Sep Super 200.000 → 150.000 (unconfirmed / confirmed); Aug (before desde) +999.999 income | unconfirmed: chain follows; confirmed: opening holds, diferencia, reconfirm; before desde: nothing a hoy (I2, D6, §4, D4) | unconfirmed 200.000→250.000, disponible 850.000→900.000; confirmed: diferencia −75.000, reconfirmar true, Oct 175.000, disponible 825.000; Aug: disponible 825.000 (Aug calc 999.999) | PASS | `D16-11` | motor |
| 12 | patrimonio con meses futuros cargados | section 2 + Dec: ticked Aguinaldo 5.000.000, ahorro 1.000.000, compra 150.000/US$ 100, ahorroMesUSD 50 | net worth a hoy unchanged (D7 cut at the current month, I5) | disponible 825.000, ahorro 600.000, USD 1.000, bruto 2.925.000, neto 2.625.000 = without Dec; screen 2.625.000. Legacy year (no model) keeps year-end: ahorro 1.650.000, USD 1.150 | PASS | `D16-12`; E2E `D16-12` | motor, app, UI |
| 13 | deuda pendiente | plan Tarjeta 3 × (33.333/33.333/33.334) unpaid Sep (overdue), Oct, Nov; Sep Sueldo 1.000.000 ✓ | the unpaid installment never leaves Disponible; pasivo 100.000; overdue shown apart; paid late → booked in Sep (§5B, Q6, Q7, Q8, Q14) | Sep cierre 1.000.000, disponible 1.000.000, vencidos 33.333, proyectado 966.667, pasivos 100.000, neto 900.000; paid: Sep 966.667, vencidos 0, pasivos 66.667, neto 900.000 | PASS | `D16-13`; E2E `D16-13` "1100000" | motor, app, UI |
| 14 | patrimonio bruto vs neto | section 2; + BTC 0.01 @ 60.000 and Trabajo cash 300.000 | bruto 2.925.000 − pasivos 300.000 = neto 2.625.000; headline = neto; gross as secondary detail (D7, §6, Q2) | exactly those; with crypto+Trabajo: bruto 4.125.000, neto 3.825.000, headline $3.825.000 / US$ 2.550. R5 N3b: the gross is a row on screen (Dólares > Patrimonio total: Disponible 825.000 + Ahorro 600.000 + Dólares 1.500.000 = bruto 2.925.000, Deudas (300.000), neto 2.625.000) | PASS (model, headline and gross row on screen) | `D16-14` (+ rendered `renderUSD` rows); `tests/r5.patrimonio.test.js`; E2E `D16-14` ["US$ 1.000,00","$1.500.000"] and `R5 Patrimonio composition` | motor, app, UI |
| 15 | gasto rápido sobre pendiente | opening 100.000, Sueldo 500.000 ✓, Super 50.000 ✗; quick expense 20.000 on Super; each answer, then Deshacer | D8 (ask: mark existing as paid vs separate realized expense; no accidental duplication) — R7 built in L3 (2026-10-08) | the question "Super está pendiente por $50.000. ¿Este gasto es ese pago?", nothing changed while asking; Sí + Dejar $50.000 → Super 50.000 ✓, one row, disponible 550.000 / proyectado 550.000; Sí + Cambiar a $20.000 → Super 20.000 ✓, 580.000 / 580.000; No → Super 50.000 ✗ + "Super (otro gasto)" 20.000 ✓, 580.000 / 530.000; every Deshacer → exactly the previous month, 600.000 / 550.000; future month of the model: no question, 70.000 programado (N4 I-1) | PASS (R7 done 2026-10-08; was PENDING-R7) | `D16-15`; `tests/l3.gasto.test.js`; E2E `L3 …` (17 checks) | app, motor, UI |
| 16 | formatos argentinos de números | `parseMonto` / `parseCantidad` over es-AR inputs; values into the chain; typed on screen | 1.234,56 → 1234.56; 1.500 → 1500; 1,5 → 1.5; 1e3, 1,234.5, 12.5,3 rejected; quantity 0,001 → 0.001; cents survive into disponible and the derived opening (D9, Q1) | all listed values; disponible 899.765,94; declared 1.234.567,89 → apertura 334.801,95 and disponible back to 1.234.567,89; screen: "100.234,56" stored 100234.56, card 499.765; "1,234.5" rejected | PASS | `D16-16`; E2E `D16-16` (3 checks); existing `tests/parseo.test.js` | motor, app, UI |
| 17 | primer mes sin saldo inicial | section 2 blob without model; skip the declaration | `origen omitido`, apertura null, opening 0 flagged, available = what the month registered (D5, §8) | `{desde 9, apertura null, declarado null, origen omitido}`; sinSaldoInicial true, apertura 0, disponible 650.000, proyectado 405.000, patrimonio disponible 650.000; `activarSaldos(null)` stores it; a later `activarSaldos(500000)` refused; card 650.000 | PASS (model); UI since R5 N3a: Omitir → "Saldo inicial sin configurar", later Editar 500.000 → declarado (E2E `D16-17`) | `D16-17`; E2E `D16-17` | motor, app, UI |

Summary A: 16 PASS (5 and 17 on the model, 14 with its gross row reserved for R5), 1 PENDING-R7 (case 15), 0 FAIL.
Update 2026-10-08 (L3, R7 built): 17 PASS, 0 PENDING, 0 FAIL — case 15 now asserts both answers, undo and no duplication.

## B. Complementary coverage (21, not part of D16)

| # | Scenario | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|---|
| C-01 | mes vacío | model desde Sep, opening 120.000, no rows | opening carries unchanged; legacy empty month all 0; empty year has no data | Sep cierre / Oct apertura / Oct cierre / Nov proj. / disponible = 120.000; card 0 / 0 / 120.000; calc 0; `hayDatos` false | PASS | `C-01` (new) |
| C-02 | mes parcialmente cargado | Sueldo 1.000.000 ✓, Extra 0 ✓, Alquiler 0 ✓, Luz 30.000 ✗, Super '' , Cuota 0 ✓ | only ticked amounts realized | resultado 1.000.000, pendiente 30.000, cierre 1.000.000, proyectado 970.000, card 1.000.000 | PASS | `C-02` (new) |
| C-03 | mes anterior con pendientes | section 2 Sep Luz 20.000 ✗; D16-03 past salary | overdue apart (Q8) | vencidos 20.000; vencidosIngresos 1.000.000 | PASS | r4.contrato `s2 (b again, e)`; `D16-03` |
| C-04 | mes actual | section 2 Oct | disponible actual 825.000, proyectado 580.000 | same; card 825.000 | PASS | r4.contrato `s2 (b again, e)`; r4.integracion `section 2: Sep (past) ...` |
| C-05 | mes futuro | section 2 Nov | flat cierre, projection only | cierreCalc 825.000, proyectado 1.280.000, card 1.280.000 | PASS | r4.contrato `s2 (b again, e)`; r4.integracion section 2; E2E `D16-07` |
| C-06 | pase futuro | scheduled savings; Trabajo pase dated after hoy | no effect a hoy | see D16-07 | PASS | `D16-07`; r4.integracion `Q4: a future Trabajo pase ...`, `Q4: a pase dated later in the CURRENT month ...`; r4.contrato `s4: savings ..., scheduled savings` |
| C-07 | pase realizado | Trabajo pase 2026-10-10 300.000; savings in the same month | realized transfer into/out of Disponible | trabajoRealizado 300.000, disponible 300.000; savings dDisp −150.000 / dAhorro +150.000 | PASS | r4.contrato `s7: a pase dated <= hoy ...`, `s4: savings in the same month ...`; E2E `R4.4 model: Oct card ...` 550.000 |
| C-08 | deuda | plan 3 cuotas; debt without plan | pasivos count-based; unplanned unticked rows ≤ hoy | 100.000 / 66.667; without plan 9.000 | PASS | r4.contrato `s5 B: partial plan ...`, `s5 B: a debt without a plan ...`; `D16-13` |
| C-09 | cuota vencida | Sep installment unpaid | out of closing, liability, overdue | vencidos 33.333, pasivo includes it | PASS | r4.contrato `s5 B: an overdue installment ...`; `D16-13` |
| C-10 | cuota pagada tarde | tick the Sep installment in Oct | booked in Sep (Q7); chain or reconfirm | Sep 966.667 → Oct opening 966.667; confirmed: opening 1.000.000, diferencia 33.333, reconfirmar | PASS | same r4.contrato test; `D16-13` |
| C-11 | reposición | aReponer 100.000; reposición 100.000 / 60.000 / 150.000 | no money created; excess labeled savings (D11) | dDisp + dAhorro = 0; aReponer 0 / 40.000 / 0; excedente 0 / 0 / 50.000; future month reported apart | PASS | r4.contrato `s5 A: ...`; r4.revision `reposicionExcedente is realized only ...` |
| C-12 | ahorro | — | — | see D16-04, D16-08 | PASS | `D16-04`, `D16-08` |
| C-13 | Trabajo | Q2 / Q3 / Q4 | cash in net worth; "Del trabajo" without pases has a checkbox; future pases scheduled | net worth 2.625.000 + 300.000; Q3 250.000 → 330.000 on click; Trabajo 700.000 | PASS | r4.integracion Q2/Q3/Q4 tests; r4.contrato s7 (4 tests); E2E `R4.4 Q3`, `R4.4 model` |
| C-14 | USD | ahorro 1.000.000, USD 100; Oct compra 300.000/US$ 200, venta US$ 50/75.000, ahorroMesUSD 10 | purchase from savings ARS, sale into Disponible, external USD inflow only USD (Q13) | dDisp 75.000, dAhorro −300.000, dUSD 160; disponible 75.000, ahorro 700.000, USD 260 = 390.000 ARS; aReponer 75.000 (serie semantics kept) | PASS | `C-14` (new); r4.contrato `s4: ahorroMesUSD ...` |
| C-15 | cripto | BTC 0.5 @ 60.000, ETH 2 @ 2.500 | qty × price × cotización in bruto a hoy | criptoUSD 35.000, ARS 52.500.000; bruto 55.425.000, neto 55.125.000; old view criptoUSD 35.000 | PASS | `C-15` (new) |
| C-16 | restauración | see D16-09 | — | — | PASS | `D16-09`; r4.migracion restore tests (4); `L-09` (new); E2E `R4.3 c` |
| C-17 | migración | 6 legacy / pre-R4 datasets, declared 500.000 and skipped | additive only; legacy months, serie and old outputs untouched; Oct = declared | all hold (section D) | PASS | `R-01`, `R-02` (new); r4.migracion `iniciarArrastre ...` (4), `additive only ...`, `legacy isolation (I6) ...`, `old-version round trip ...`; E2E `R4.3 b` |
| C-18 | múltiples pestañas | two tabs, stale tab, storage event | stale tab never overwrites; no write until reload | all hold after fix `0ff866d` (stale tab no longer writes another year through a pase) | PASS (after fix) | r4.migracion revision, two-tab and storage-event tests; E2E `R4.3 a` checks; `L-06`, `L-07` (new, RED→GREEN), `L-08`; `L-10` risk resolved in N2 (R4.6) |
| C-19 | recarga | save section 2, fresh load | same chain, card, net worth | rev 1; `cadena` deepEqual; card 825.000; net worth 2.625.000 | PASS | `C-19` (new); E2E `R4.3 b: arrastre and cierreReal survive a reload`, `rev survives a reload` |
| C-20 | cierre/reapertura | confirm Sep at 175.000, then remove the confirmation | reopening gives back exactly the calculated chain; no movement | confirmed: Oct 175.000 / 825.000 / −25.000; reopened `cadena` and `patrimonioNeto` deepEqual the never-confirmed ones; only `cierreReal` differs | PASS | `C-20` (new); `D16-06` |
| C-21 | datos antiguos | every golden corpus dataset; 7f7ad40-era blob | a year without model reads exactly as before | card = `calc()` for 12 months × 9 datasets; net worth = old `patrimonio()`; both goldens byte-identical | PASS | r4.integracion `legacy year: no model view ...`; r4.migracion round trip + Q9 tests; `R-01`; motor golden tests |

Summary B: 21 PASS (C-18 after the R4.5 fix).

## C. R4.4 leftovers — classification

| Item | Observed (test) | Classification | Action |
|---|---|---|---|
| "El año" table, year CSV, "Año por año" in a model year | still `serie()`/`calc()`: with an unticked "Del trabajo" without pases the Oct row shows Ingresos 580.000 / Disponible 430.000 while the card shows 500.000 / 350.000; "Acumulado" 250.000 (year end incl. scheduled Nov savings) vs savings a hoy 50.000 (`L-01`) | Contract silent: not a bug of the approved rules; it is the product decision reserved by the owner (rule 5). Q3 is applied on the card but not in these secondary views | **Owner decision 2026-10-06: move to the chain** — section E |
| "Del trabajo" without pases (Q3) in those views | counted as always realized there (`L-01`) | same as above | Owner decision |
| "Disponible" column vs chained balance | column = month flow (`calc().disponibleFinal`, no opening); card = chain (`L-01`) | same as above | Owner decision |
| "Del trabajo" amount above its pases (locked row) | row 400.000 unticked, pase 300.000: excess 100.000 pending, row read-only; disponible 300.000, proyectado 400.000 (`L-02`) | RESOLVED in R5 N3b (7af23d0): the excess has its own checkbox and the note "De esto, $300.000 vino de pases del trabajo; el resto, $100.000, lo marcás vos."; ticked → disponible 400.000; money unchanged (interpretation 4 of R4.2, `flujosMes`) | `L-02` rewritten, `tests/r5.mes.test.js`, E2E |
| Accent / spacing variants of "Del trabajo" | `renglonTrabajo` (`trim().toLowerCase()`) does not find "Del Trabájo" / " del  trabajo ": a pase creates a second row; the engine (`clave()`) allocates the pase to the first row, so the user's unticked 100.000 becomes realized: disponible 400.000 instead of 300.000 (`L-03b`, todo) | Real defect, pre-existing (two matchers, design §7) and exposed by R4 (Q3 gives the row its own flag). Not fixed: the fix changes which existing row a pase or its undo touches on data written under the old matcher — needs a rule | **RESOLVED** in 8f3296c (N1, conservative rule: exact name first, else the `clave()` row the engine already counts; no data rewrite) — `L-03b` passes, `L-03c` added |
| R4.3 advisory: `duplicar` save path | real `guardar`: 2027 written with rev 1, arrastre `{0, 825.000, arrastre}`, snapshot before it, 2026 untouched; snapshot refused → no year, alert (`L-05`) | Covered | — |
| R4.3 advisory: `aplicarPase` / `deshacerTj` rev paths | other-year pase writes that blob with its rev (2→3→4 with the undo), Trabajo rev 1→2→3 (`L-06`); `deshacerTj` saves on top of the stored rev (5→6→7) and a stale undo is refused (`L-08`) | Covered | — |
| | **stale tab** (`obsoleta`) passing money to ANOTHER year still wrote that year's blob while Trabajo refused: the row without its pase counts the money twice (`L-07`, RED on 0b31901) | **Real R4.3 bug** (contract: a stale tab writes nothing until reload) | **Fixed** `0ff866d`: `aplicarPase` refuses and shows the notice when the tab is stale |
| R4.3 advisory: Trabajo restore coverage | backup without Trabajo leaves the stored one byte-identical; a backup with a LOWER Trabajo rev (1 vs stored 6) is written with rev 7 (`L-09`) | Covered | — |
| `explicaDisp` with a scheduled pase (index.html ~5201) | "Lo cobrado ($1.000.000) menos los gastos ($100.000) y lo que pasaste a Ingresos ($300.000)." = 600.000 = the big number with 200.000 scheduled (`L-04`) | Covered, correct | — |
| Multiple tabs and reload | see C-18, C-19 | Covered | Risk `L-10` (below) resolved in N2 (R4.6) |
| Restore / migration | see C-16, C-17, section D | Covered | — |

Contradictions with Q1-Q15 found: none.

## D. Before → migration → after (hoy 2026-10-15)

Before = the pre-R4 screen numbers (`normalizar` + `calc()` / old `patrimonio()` / old Trabajo available; identical to the legacy
golden, which is byte-identical). Migration = `normalizar(d, hoy)` + `iniciarArrastre` (declared 500.000, or skipped). After = the R4
screen (`tilesMes`, `cadena`, `patrimonioPantalla`, `resumenTrab`). In every row the migration only adds `arrastre`: the months and
`serie()` are byte-identical before and after (`R-01`). Sep is before `desde`, so it reads as before (I6).

| Dataset | Start | Opening (Oct) | Sep before → after | Oct card before → after | Nov card before → after | Proj. Oct | Overdue (exp/inc) | Savings ARS before → after | USD | Net worth before → after (bruto / pasivos) | Trabajo before → after | Ingresos Oct before → after |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| legacy2026 (golden corpus, no pagoExplicito) | declared 500.000 | 294.846,16 | 60.964,95 → 60.964,95 | 205.153,84 → 500.000 | -1.008.998,5 → -391.255,77 | 500.000 | 0 / 0 | 1.449.999 → 400.000 | 420 → 420 | 8.807.091 → 8.162.715 (8.257.092 / 94.377) | — → — | 704.000 → 704.000 |
| legacy2026 (golden corpus, no pagoExplicito) | skipped | — | 60.964,95 → 60.964,95 | 205.153,84 → 205.153,84 | -1.008.998,5 → -686.101,93 | 205.153,84 | 0 / 0 | 1.449.999 → 400.000 | 420 → 420 | 8.807.091 → 7.867.868,84 (7.962.245,84 / 94.377) | — → — | 704.000 → 704.000 |
| mixed2026 (golden corpus, v1.31.x) | declared 500.000 | 323.000,49 | 103.310,62 → 103.310,62 | 265.999,51 → 500.000 | -1.037.798,5 → -363.101,44 | 528.154,33 | 0 / 0 | 1.449.999 → 400.000 | 420 → 420 | 8.321.199 → 7.643.489 (7.771.200 / 127.711) | — → — | 679.000 → 590.000 |
| mixed2026 (golden corpus, v1.31.x) | skipped | — | 103.310,62 → 103.310,62 | 265.999,51 → 176.999,51 | -1.037.798,5 → -686.101,93 | 205.153,84 | 0 / 0 | 1.449.999 → 400.000 | 420 → 420 | 8.321.199 → 7.320.488,51 (7.448.199,51 / 127.711) | — → — | 679.000 → 590.000 |
| 7f7ad40-era blob | declared 500.000 | 500.020 | -20 → -20 | -20 → 500.000 | -20 → 499.280 | 499.650 | 0 / 0 | 240 → 200 | 0 → 0 | 240 → 500.000 (500.200 / 200) | — → — | 0 → 0 |
| 7f7ad40-era blob | skipped | — | -20 → -20 | -20 → -20 | -20 → -740 | -370 | 0 / 0 | 240 → 200 | 0 → 0 | 240 → -20 (180 / 200) | — → — | 0 → 0 |
| section 2 without model | declared 500.000 | -150.000 | 150.000 → 150.000 | 650.000 → 500.000 | -200.000 → 955.000 | 255.000 | 0 / 0 | 800.000 → 600.000 | 1.000 → 1.000 | 2.300.000 → 2.300.000 (2.600.000 / 300.000) | — → — | 1.000.000 → 1.000.000 |
| section 2 without model | skipped | — | 150.000 → 150.000 | 650.000 → 650.000 | -200.000 → 1.105.000 | 405.000 | 0 / 0 | 800.000 → 600.000 | 1.000 → 1.000 | 2.300.000 → 2.450.000 (2.750.000 / 300.000) | — → — | 1.000.000 → 1.000.000 |
| USD + crypto + debt plan | declared 500.000 | -30.000 | 0 → 0 | 530.000 → 500.000 | -100.000 → 320.000 | 460.000 | 0 / 0 | 50.000 → -50.000 | 130 → 130 | 45.245.000 → 45.525.000 (45.645.000 / 120.000) | — → — | 900.000 → 900.000 |
| USD + crypto + debt plan | skipped | — | 0 → 0 | 530.000 → 530.000 | -100.000 → 350.000 | 490.000 | 0 / 0 | 50.000 → -50.000 | 130 → 130 | 45.245.000 → 45.555.000 (45.675.000 / 120.000) | — → — | 900.000 → 900.000 |
| Trabajo with a future pase | declared 500.000 | 100.000 | 50.000 → 50.000 | 400.000 → 500.000 | 150.000 → 610.000 | 460.000 | 0 / 0 | 0 → 0 | 0 → 0 | 0 → 1.200.000 (1.200.000 / 0) | 550.000 → 700.000 | 400.000 → 400.000 |
| Trabajo with a future pase | skipped | — | 50.000 → 50.000 | 400.000 → 400.000 | 150.000 → 510.000 | 360.000 | 0 / 0 | 0 → 0 | 0 → 0 | 0 → 1.100.000 (1.100.000 / 0) | 550.000 → 700.000 | 400.000 → 400.000 |
| mixed2025 (no arrastre) | — | — | 103.310,62 = | 265.999,51 = | -1.037.798,5 = | — | — | 1.449.999 = | 420 = | 8.321.199 = | — | 679.000 = |
| legacy2025 (no arrastre) | — | — | 60.964,95 = | 205.153,84 = | -891.255,77 = | — | — | 1.449.999 = | 420 = | 8.807.091 = | — | 704.000 = |
| mixed2027 (no arrastre) | — | — | 103.310,62 = | 265.999,51 = | -1.037.798,5 = | — | — | 1.449.999 = | 420 = | 8.321.199 = | — | 679.000 = |

How every changed number is explained:

- **Oct card** = the declared value (Q1: the opening is derived so that disponible actual = declared). Skipped: opening 0, so the card
  is the realized result + transfers of October — equal to the old card unless Q3 applies (mixed2026: 265.999,51 → 176.999,51 because
  the unticked "Del trabajo" row of 89.000, without pases, is now pending income: Ingresos 679.000 → 590.000).
- **Nov card** = projected closing (Oct projection + Nov scheduled flows), not the Nov month flow (R4.4 interpretation 1).
- **Savings ARS** = a hoy (Oct) instead of year end (D7, I5); future savings are excluded. Negative savings (USD dataset −50.000) come
  from a USD purchase funded from savings ARS (design note, serie semantics kept).
- **Net worth** = D7 net a hoy: Disponible + savings + USD + crypto (+ Trabajo, Q2) − liabilities (Q6). The old value had neither
  Disponible nor liabilities nor Trabajo.
- **Trabajo** 550.000 → 700.000: the pase dated 2026-11-05 goes to a model month, so it stays in Trabajo until its date (Q4) and
  appears in the November projection (610.000 / 510.000).
- **Carried balance / years without arrastre**: older (2025) and later (2027) years without `arrastre` show no model view and the
  same numbers as before (`R-02`).
- **Pending payments**: no overdue appears because `desde` is October (months before `desde` are legacy and never feed `vencidos`, D4).

## E. Year views on the chain (owner decision 2026-10-06)

Owner decision: in a year WITH `arrastre`, "El año", the year CSV and "Año por año" use the SAME chained balance model as the month
card (`cadena` / `tilesMes` / `vistaModelo`, R4.4); a year WITHOUT `arrastre` behaves exactly as before. Correction derived from the
inconsistency pinned by `L-01` (section C, first row). D16 stays the official matrix; this is not a new matrix. No new money rule:
every changed number is a value the month card already shows (R4.4 interpretations 1-2, Q3), or, for the Disponible total, the card
value of December.

### E.1 Consumers (index.html lines at 0ad13c1)

| Surface | Function (lines) | Source today | Columns / values |
|---|---|---|---|
| "El año" summary card | `resumenAnio(s)` (3072-3098), called by `renderAnio` (3101) | `serie(D)` | avg Ingresos / Gastos / Ahorro, cheapest/most expensive month, "gastaste más de lo que entró" (`disponibleFinal < 0`), December savings at this pace (`ahorroAcumulado`) |
| "El año" › "Los doce meses" | `renderAnio` (3099-3116) | `serie(D)` (3100) | Ingresos, Gastos, Ahorro, A dólares, Saqué, Repuse, Deudas, Disponible, Acumulado; Total row = sum of each column, Acumulado = `s[11]`; header "Cierre" = sum of Disponible; aReponer note |
| "El año" › "Ingresos y gastos" | `renderAnio` (3118-3122) | `serie(D)` | the Ingresos / Gastos columns as lines; header = the table totals |
| "El año" › "Ahorro acumulado" | `renderAnio` (3125-3126) | `serie(D)` | `ahorroAcumulado` per month |
| "El año" › "Año por año" | `renderAnio` (3150-3169) | `serie(dA)` per stored year (3161; `leerAnio`) | Ingresos, Gastos, Deudas, Ahorrado (sums), Cierre en pesos (`s[11].ahorroAcumulado`), Dólares al cierre |
| Year CSV | `exportarCSV` (3940-3951) | `serie(D)` | Ingresos, Gastos fijos, Gastos variables, Gastos, Ahorro ARS, Pesos a dólares, Dólares comprados, Pagado a, Saqué, Dólares vendidos, Repuse, A reponer, Deudas, Disponible final, Ahorro acumulado, USD del mes, USD acumulado |

The card side: `vistaModelo` (2682), `tilesMes` (2688): a legacy month (no `arrastre`, or before `desde`) returns `calc()` itself;
a model month overrides `totalIngresos` (realized income + realized Trabajo pases for past/current, scheduled income + scheduled pases
for a future month; Q3: "Del trabajo" without pases is ordinary income with its own `pagado`), `totalGastos` (realized / scheduled
fixed + variable), `disponibleFinal` (past: `cierreReal ?? cierreCalc`; current: `cierreCalc`; future: `proyectado`) and the derived
`ahorroSugerido` / `pctGastos` / `pctAhorro`. Every other field (`ahorroMesARS`, `totalDeudas`, `subtotalFijos`, `subtotalVariables`,
transfers) is `calc()`'s.

### E.2 Before → after, model-year examples (hoy 2026-10-15)

L-01 dataset (`desde` Oct, opening 0; Oct Sueldo 500.000 ✓, "Del trabajo" 80.000 ✗ without pases, Alquiler 100.000 ✓, ahorro 50.000;
Nov ahorro 200.000):

| Value | Before (`serie`) | After (card) | Decision |
|---|---|---|---|
| Oct Ingresos (table, CSV) | 580.000 | 500.000 | Q3 + R4.4 interp. 2: the unticked "Del trabajo" without pases is pending income |
| Oct Gastos | 100.000 | 100.000 | realized = paid (no change here) |
| Oct Disponible (table, CSV) | 430.000 (month flow) | 350.000 (`cierreCalc`) | R4.4 interp. 1 (current month = disponible a hoy) |
| Nov Disponible | −200.000 (flow) | 230.000 (`proyectado` 430.000 − 200.000) | R4.4 interp. 1 (future = projected) |
| Dec Disponible | 0 | 230.000 | same |
| Total Ingresos / Gastos | 580.000 / 100.000 | 500.000 / 100.000 | sums of the changed rows |
| Total Disponible and header "Cierre" | 230.000 (sum of flows) | 230.000 (December card value) | see E.3 row "Disponible total" |
| Acumulado (rows, total) | 50.000 … 250.000 | unchanged | see E.3 |
| "Año por año" 2026 Ingresos / Gastos | 580.000 / 100.000 | 500.000 / 100.000 | the table totals |

Section 2 dataset (`desde` Sep, opening 50.000, Sep confirmed 175.000, Oct pending rows, Nov scheduled Sueldo 1.000.000 + Préstamo
100.000 + ahorro 200.000):

| Value | Before | After | Decision |
|---|---|---|---|
| Aug (before `desde`) | all `calc()` | unchanged | D4 / I6 |
| Sep Disponible | 150.000 (flow) | 175.000 (confirmed closing) | R4.4 interp. 1, D6 |
| Oct Disponible | 650.000 | 825.000 (disponible a hoy) | R4.4 interp. 1 |
| Nov Ingresos / Gastos / Disponible | 0 / 0 / −200.000 | 1.000.000 / 0 / 1.280.000 | R4.4 interp. 1 (future: scheduled flows, projected closing) |
| Dec Disponible | 0 | 1.280.000 | projected |
| Total Ingresos / Gastos | 2.000.000 / 1.000.000 | 3.000.000 / 1.000.000 | sums of the changed rows |
| Total Disponible and "Cierre" | 600.000 | 1.280.000 | December card value (E.3) |
| Deudas column (Sep 100.000, Nov 0) | unchanged | unchanged | stop item (E.3) |
| "Año por año" 2026 Ingresos / Gastos | 2.000.000 / 1.000.000 | 3.000.000 / 1.000.000 | the table totals |

### E.3 Per column: change or keep

| Surface / column | Model year | Why |
|---|---|---|
| Table / CSV Ingresos, Gastos (model months) | **= `tilesMes`** | owner decision; R4.4 interp. 1-2, Q3 |
| Table / CSV Disponible (model months) | **= `tilesMes`** (chain) | owner decision; R4.4 interp. 1 |
| Table Total Ingresos / Gastos | **sum of the shown rows** | flows: the total stays a sum |
| Table Total Disponible and header "Cierre" | **December's value** (`tilesMes(11).disponibleFinal`) | the column is now a balance: summing balances has no meaning; the label already says "Cierre" (year closing), and the chain's closing is December's card value. Not a new money rule (it is a number the card shows), but it is a judgment: flagged for owner confirmation |
| "Ingresos y gastos" chart | **the same rows as the table** | its header already shows the table totals; lines and header must agree |
| "Año por año" Ingresos / Gastos (model year, open or stored) | **sums of the same rows** | owner decision; each year row is self-contained, legacy years keep `serie()` |
| Months before `desde` | unchanged (`calc()`) | D4 / I6 (`tilesMes` returns `calc()` itself) |
| Ahorro, A dólares, Saqué, Repuse, USD columns, A reponer | unchanged | transfers: `tilesMes` keeps `calc()`/`serie()` values, the card shows the same |
| Acumulado, "Ahorro acumulado" chart, "Cierre en pesos", "Dólares al cierre" | unchanged | the model has no other savings source: `patrimonioNeto` itself reads `serie()[iHoy].ahorroAcumulado`; a future month's value is a projection exactly like the future Disponible |
| Deudas column / "Año por año" Deudas / CSV Deudas | **= `tilesMes`** (N1 item 1): realized month `cuotasReal`, future month `cuotasProg` (ticks ignored, §1), from `flujosMes` | resolves the former STOP item: one source (D13); a future row now reconciles (Disponible(j) − Disponible(j−1) = Ingresos − Gastos − Deudas + net transfers). Months before `desde` keep `calc()` |
| CSV Gastos fijos / Gastos variables | **= `tilesMes`** (N1 item 2): realized month = paid subtotals (unchanged); future month = `suma()` of each section (Programado = every registered row) | resolves the former STOP item: fijos + variables = Gastos in every model month; done in the app layer, `flujosMes` untouched |
| `resumenAnio` (summary card on "El año") | **= `serieVista` over the REALIZED months** (N1 item 3, DERIVED rule, flagged for owner review, not blocking) | the set = past + current model months with Ingresos or Gastos on the card, plus legacy months before `desde` as before; future months never enter. Averages, ring %, max/min and "A este ritmo" (`ahorroAcumulado` of the last month of the set) read that set; a red month is `flujosMes.resultado < 0` (never the chained Disponible; legacy months keep `disponibleFinal < 0`); footer "Promedio de N meses ya transcurridos de AAAA" |
| Year without `arrastre` | byte-identical | owner decision; test over every motor-corpus dataset |
| "En qué se te fue la plata" (`ranking`) and "Deudas" (`proyeccionDeudas`) on "El año" | **read `datosRealizados(D, hoy)`** (N1 item 4) | a copy of the year where every row of a FUTURE model month is unticked (§1: scheduled, never paid). For the debt projection the paid count equals evaluating at `min(11, mesTope)` like `pasivos` (R4.2 interp. 8); the end month additionally ignores future ticks. Engine untouched (both live in the motor block; goldens identical); a year without `arrastre` passes `D` itself |

### E.4 N1 closure (night run, 2026-10-06)

Commits on `fix/repair-sprint-1`: a8a3a84 (Deudas), 6de98fb (CSV fijos/variables), 08b8cf0 (`resumenAnio`), 69c65a1 + ecda44f
(ranking / debt projection + the missing `estadoMes` alias), 8f3296c ("Del trabajo" matcher), 4de7b35 (E2E).

Before → after (hoy 2026-10-15 unless noted):

| Value | Before | After |
|---|---|---|
| Section 2, November Deudas (unticked scheduled installment) | — (0) | 100.000 |
| Section 2, Total Deudas / "Año por año" Deudas | 100.000 | 200.000 |
| Section 2 with November ticked, November Deudas | 100.000 (counted as paid) | 100.000 (scheduled; same value, tick ignored) |
| Section 2 + November Alquiler 400.000 unticked + Super 100.000 ticked: CSV fijos / variables / Gastos | 0 / 100.000 / 500.000 | 400.000 / 100.000 / 500.000 |
| Summary card, L-01 + legacy September income 400.000: "Por mes entran / se van / te quedan", ring | 490.000 / 50.000 / 440.000, 5% | 450.000 / 50.000 / 400.000, 6% |
| Summary card, section 2 with November ticked: months, "entran / se van" | 3 cargados, 1.000.000 / 333.333 | 2 transcurridos, 1.000.000 / 500.000 |
| Summary card, opening 1.000.000, Oct 100.000 − 300.000, Nov (future) expense 900.000 ticked | "En 2 meses gastaste más…" | "En Octubre gastaste más…" |
| "Deudas" on "El año", section 2 + November installment ticked | Préstamo 4 de 6 | Préstamo 3 de 6 (end month enero 2027 both) |
| Ranking, a ticked expense in future November | listed | not listed |
| Pase onto an existing "Del Trabájo" 100.000 unticked row (L-03b) | second row, Disponible 400.000 | same row, Disponible 300.000, 100.000 still pending |

"Del trabajo" matcher (N1 item 5, design §7, D13): `renglonTrabajo` keeps the exact trim/lowercase match FIRST (a plain "Del trabajo"
row, or an exact row listed after a variant, behaves exactly as before) and otherwise takes the row the engine already counts as
"Del trabajo" (`esRenglonTrabajo` = `clave()`). No data rewrite, no rename. `quitarPase` / `reponerPase` reach the row through
`aplicarPase`, so undo uses the same matcher; `deshacerTj` restores only the Trabajo store and never looks up the row. Tests `L-03b`
(was `todo`), `L-03c`.

Sweep (N1 item 6) of the other `calc()` / `serie()` / tick readers in a model year:

| Consumer | Reads | Verdict |
|---|---|---|
| "El año" Ahorro, A dólares, Saqué, Repuse, Acumulado, "Ahorro acumulado" chart, aReponer note; "Año por año" Ahorrado / Cierre en pesos / Dólares al cierre; Dólares tab table; month-card Ahorro / compra / retiro notes (`serie(D)[mes]`) | `serie()` transfers and accumulations | unchanged by E.3 decision (transfers have no tick; no other savings source) |
| Dólares "Patrimonio total" | `patrimonioPantalla` (model: `patrimonioNeto`) | already on the model (R4.4); Patrimonio rows are R5 |
| Trabajo tab | Trabajo store, `pasesDelMes` | not a month-flow consumer; matcher fixed above |
| Month screen of a FUTURE model month: expense pie (`datosTorta`), budget bars and the over-budget alert (`gastadoTope`), debt row text (`textoDeuda` → `estadoDeuda(D, n, mes)`) | ticks (`estaPagado`) | N1-A: triaged as derived (§1, D3); RESOLVED in R5 N3b (87a0d63) at the call sites (`esProgramado`, `gastadoVista`, `datosRealizados`), motor untouched |
| `duplicar` (new year): `planDeudas[k].pagadasAntes = estadoDeuda(D, k, 11).pagadas` | ticks of all 12 months | **OWNER_DECISION_REQUIRED (N1-B)**, see below |

OWNER_DECISION_REQUIRED (recorded, work continued):

- **N1-A — ticks on the month screen of a future model month.** The card Ingresos/Gastos of a future month are scheduled (every row),
  but the pie, the budget bars/alert and the debt row text still treat a ticked row as paid. Alternatives: (a) keep: the tick in a future
  month is the user's own marker, only totals follow §1 (no change, inconsistent wording "pagado"); (b) follow §1 on the screen: pie and
  budgets count every scheduled row, the debt text never says "pagada" in a future month (one rule, changes what the user sees); (c) R5
  UX: disable / hide the tick in a future month and show "programado" (prevents the state, needs the R5 design). Recommendation: (c),
  with (b) as the interim if R5 slips. RESOLVED (R5 N3b, 87a0d63): (c) — nothing is shown as paid in a future model month (pie, caps,
  debt text); an unticked row shows "programado" with no tick; a row ticked ahead can only be unticked (open question N3b-A).
- **N1-B — `duplicar` carries paid installments from every month.** Creating next year before December counts a ticked future
  installment as paid and an unticked one as pending in the snapshot `pagadasAntes`. Alternatives: (a) keep (normally done after
  December, when every month is past); (b) count only realized months (`min(11, mesTope)`), so later payments in the old year are not
  reflected in the new snapshot; (c) derive `pagadasAntes` live from the previous year blob instead of a snapshot (larger change, R8).
  Recommendation: (a) for Alpha with a note; revisit with (c).

Line endings: a8a3a84 and 6de98fb wrote `tests/r4.anio.test.js` with CRLF; 08b8cf0 restores LF (history rewrite was not permitted).

## F. Risks found in R4.5

- `L-10` RESOLVED in N2 (cb25dd3, R4.6): if another tab saved Trabajo and this tab had not yet processed the storage event, a pase
  into the OPEN year wrote the year row and then the Trabajo save was refused (money in both pockets); removing a pase did the reverse
  (money in neither). `aplicarPase` now checks the stored revisions of Trabajo and of the open year BEFORE the first write; a mismatch
  marks the tab stale and writes nothing. Tests `L-10`, `L-10b` (removal), `L-10c` (stale open year), `L-10d` (undo of a removal); RED
  on ec12149, mutation (precheck removed) fails 4. Residual: there is still no transaction across the two blobs; the precheck and both
  writes run in one synchronous task, so another tab's write in between is practically excluded (browsers do not guarantee localStorage
  atomicity across tabs), and a storage error on the second write (quota) can still leave one side written (pre-existing, reported by
  the "No se pudo guardar" pill).
- N2 `duplicar` in a stale tab (RESOLVED, 0a2eb2d): it wrote the pre-R4 snapshot, switched the open year and said "Listo el 2027" while
  the save of the new year was refused. Now refused up front, and when its own pending save is refused.
- N2 (LOW, open): `cambiarAnio` in a stale tab: the pending save is refused (notice shown), then the other year loads and the unsaved
  edits of the stale tab are dropped; the tab stays stale until reload. No money is written twice; the edits were going to be lost on
  reload anyway. Left as is.
- `L-03b` accent variants: RESOLVED in 8f3296c (N1 item 5, E.4).
- RESOLVED in 696077f (native review R3-stale-toast-misleading / R3-stale-quitarPase-unproved): removing a pase from a stale tab
  removed it from memory and showed "Pase borrado…" although nothing was stored. `quitarPase` now refuses in a stale tab (notice
  only, nothing changes in memory or storage); RED `L-07b` (pase removed from memory), GREEN after.
- `num()` (= `parseFloat`, unchanged since before R1) reads a legacy text amount "1.500" as 1.5; the app never stores formatted text since R2 (D9),
  so only hand-edited or very old blobs are affected.
- **N2-B (MEDIUM, OWNER_DECISION_REQUIRED) — L-03b resolved for new data only; legacy two-row data remains.** Data saved under the old
  matcher can hold `[variant unticked, exact "Del trabajo" ticked]` rows in one month (the old matcher created the exact row for the
  pase next to the user's variant row). `flujosMes` allocates the pase to the "Del trabajo" rows in order, so the variant absorbs it and
  the user's unticked amount becomes realized. Probe: Oct `[Dél trabajo 100.000 ✗, Del trabajo 300.000 ✓]` + pase 300.000 dated
  2026-10-05 → `[ingresosReal, trabajoRealizado, ingresosPend]` = `[100.000, 300.000, 0]`, expected `[0, 300.000, 100.000]`. Pinned as
  a risk marker: `L-03d` (node:test `todo`; when it passes, the risk was fixed). Alternatives: (a) leave it and show a notice when a month
  holds more than one "Del trabajo" row (no money rule changes); (b) the engine allocates pases to the ticked exact row first (changes motor
  goldens → needs a golden diff report); (c) one-time conservative migration merging the rows (data rewrite). Recommendation: (a) for
  Alpha, (b) in a later engine slice with its diff report.
