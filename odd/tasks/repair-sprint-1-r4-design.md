# R4 Design Review — financial model, chain and migration

Status: APPROVED CONTRACT. On 2026-10-05 the owner approved Q1-Q15 exactly as recommended in
section 12 (single answer: "Aprobar todas como están"). This document is the source of truth for
R4 (Alfa loop).
Base: `odd/tasks/repair-sprint-1.md` ("Engine state for R4 review"), decisions D1-D17, branch
`fix/repair-sprint-1` at the R3 closure.

Facts verified in the code before writing (index.html at HEAD unless noted):

- Trabajo pases: the destination month/year is derived from the pase date (`destinoPase`), and
  `resumenTrab` subtracts EVERY pase from Trabajo's available money regardless of its date
  (`r.pasado`, ~4661-4662, `r.disponible = cobrado - gastado - pasado`, ~4696).
- "Del trabajo" is matched by name: `clave()` (accent/case-insensitive) in the engine
  (`esRenglonTrabajo`, `sumaPagado`), but `trim().toLowerCase()` in `renglonTrabajo` (~5886).
- The motor reads the system clock in `mesTope`, `mesesCorridos` and the `proyeccionDeudas`
  fallback (`new Date().getMonth()`).
- Baseline `normalizar` (7f7ad40) mutates the year object and each month object in place and only
  REBUILDS items (`o = {nombre, monto, tope}` + known fields). Unknown year-level and month-level
  fields survive an older app version; unknown item-level fields do not. It also always sets
  `d.version = 1`, so `version` cannot be used as a model marker.
- `serie`: `accA += ahorroMesARS - compraARS - retiroARS + reposicionARS`;
  `accR = max(0, accR + retiroARS + ventaARS - reposicionARS)`; `calc.disponibleLibre =
  ingresos - gastos - ahorroMesARS + (retiroARS + ventaARS) - reposicionARS`.

Correction to earlier statements (audit F13, R3 candidate list): a reposición larger than the
pending `aReponer` does NOT create money. It lowers the month's available money by the same
amount it adds to savings ARS (conservation holds). It only looked like creation because
`patrimonio` ignores the available-money pocket, so moving money from available to savings
appeared as growth. The real defect is the missing pocket in net worth, fixed by this model.
Likewise, a USD purchase is funded from savings ARS (`accA -= compraARS`), not from available
money; that is consistent with the transfer model, not a bug.

---

## 1. Formal financial model

### Pockets (where the money is)

| Pocket | Currency | Today in the data |
|---|---|---|
| Disponible (available) | ARS | does not exist as a stock (only a monthly result) |
| Ahorro ARS (savings) | ARS | `serie.ahorroAcumulado` |
| Ahorro USD | USD | `serie.usdAcumulado` |
| Cripto | asset, valued in USD | `D.cripto` (quantity × manual price) |
| Deuda (liability) | ARS | `planDeudas` + rows in `deudas` |
| Trabajo (business cash) | ARS | separate store `kibo.trabajo`; `resumenTrab().disponible` — see decision Q2 |

### Time

- `hoy` = the evaluation date, passed into every temporal function (section 3).
- A row belongs to its month `(anio, mes)`. Rows have no day; a month is "past" if `< hoy.mes`,
  "current" if `= hoy.mes`, "future" if `> hoy.mes` (same year; other years compare by year).

### Concepts (operational definitions)

| Concept | Meaning | Fed by | Must NOT include | Relation |
|---|---|---|---|---|
| **Registrado** (registered) | everything the user loaded for a month | all rows of ingresos, gastos fijos/variables, deudas (any status) and all month transfer fields | nothing is excluded; it is the raw total | = Realizado + Pendiente + Programado |
| **Realizado** (realized) | money that actually moved | external rows with `pagado === true` in past/current months; transfer fields of past/current months; Trabajo income dated `<= hoy` | pending rows; anything in a future month | drives every "a hoy" figure and every closing |
| **Pendiente** (pending) | external flows registered in a past/current month and not yet ticked | external rows with `pagado !== true`, month `<= hoy.mes` | transfers (they have no status); future months | Registrado − Realizado − Programado; feeds Proyectado al cierre (current month only) |
| **Programado** (scheduled) | anything registered in a future month | all rows and transfer fields of months `> hoy.mes`; Trabajo pases dated `> hoy` | — | never changes "a hoy" figures; only projections |
| **Disponible inicial** (opening) | available money at the start of a month | month = migration month: user-declared value (section 8); later months: closing of the previous month (confirmed real if it exists, else calculated); January: previous year's December closing | any flow of the month itself | Apertura(m) |
| **Resultado del mes** (month result) | external net flow of a month | realized income − realized expenses − realized installments | transfers; pending; scheduled | a flow, not a stock |
| **Pases netos** (net transfers into Disponible) | internal movement between Disponible and other pockets | `retiroARS + ventaARS − ahorroMesARS − reposicionARS` (+ Trabajo income realized, see §7) | `compraARS/compraUSD` (savings ARS → USD, never touch Disponible); `ahorroMesUSD` (external USD inflow) | sums to zero across all pockets except the external USD inflow and Trabajo |
| **Disponible actual** (current) | available money now (current month only) | Apertura(hoy.mes) + Resultado realizado + Pases netos realizados | pending; scheduled | = closing calculated "so far" |
| **Disponible al cierre** (closing) | available money at the end of a month | Apertura + Resultado + Pases netos (calculated); optionally a confirmed real value | pending (it never carries) | Cierre(m) → Apertura(m+1); difference real − calculated is informational |
| **Proyectado al cierre** (projected closing) | ESTIMATE of the closing of the current month if all pending is settled | Disponible actual + pending income − pending expenses − pending installments of the current month | overdue pending of earlier months (shown apart, Q8); future months | labeled "estimado" |
| **Patrimonio bruto** (gross worth) | assets a hoy | Disponible actual + Ahorro ARS a hoy + Ahorro USD a hoy × cotización + Cripto × precio × cotización (+ Trabajo, Q2) | future months; projections | — |
| **Patrimonio neto** (net worth) | assets − liabilities a hoy | Patrimonio bruto − Pasivos | pending ordinary expenses (not liabilities, Q6); `aReponer` (internal, both sides are the user's) | headline (D7) |
| **Pasivos** (liabilities) | money owed to third parties a hoy | Σ plan saldo of remaining installments (incl. overdue), + unticked debt rows `<= hoy` of debts without a plan | future rows of debts without a plan (unknown commitment) | — |

Invariants (become tests in R4.2):

- I1 Closing: `Cierre_calc(m) = Apertura(m) + Resultado(m) + PasesNetos(m)`.
- I2 Chain: `Apertura(m+1) = CierreReal(m) ?? Cierre_calc(m)`; never anything else.
- I3 Conservation: for any realized internal transfer, Σ change across pockets = 0.
- I4 Month change: across pockets, `Σ stocks(m+1 opening) = Σ stocks(m closing)` (+ the explicit,
  visible difference when a real closing is confirmed). No peso appears or disappears.
- I5 Time isolation: changing anything in a month `> hoy.mes` leaves every "a hoy" figure unchanged.
- I6 Legacy isolation: every month before `arrastre.desde` produces byte-identical outputs to the
  pre-R4 golden.
- I7 Determinism: same data + same `hoy` ⇒ same outputs; the motor never reads the clock.

---

## 2. Monthly chain — numeric cases

Assumptions: model active since Sep 2026 (`arrastre.desde = Sep`), `hoy = 2026-10-15`, cotización
USD 1.500. Pockets at Sep opening: Disponible 50.000 (declared), Ahorro ARS 500.000, USD 1.000,
Cripto 0. Loan plan: 6 × 100.000, 2 paid before Sep.

**(a) a month starts with money** — Sep: Apertura = 50.000 (declared initial balance).

**(b) income and expenses** — Sep rows: Sueldo 1.000.000 ✓; Alquiler 400.000 ✓; Super 200.000 ✓;
Cuota 100.000 ✓; Luz 20.000 ✗ (pending). Transfer: Ahorro del mes 150.000.

- Resultado = 1.000.000 − 600.000 − 100.000 = **300.000**
- Pases netos = −150.000
- Cierre_calc(Sep) = 50.000 + 300.000 − 150.000 = **200.000**; Ahorro ARS = 650.000
- Luz 20.000 is pending and does NOT enter the closing.
- Check I4: Disp+AhorroARS: open 550.000 → close 850.000; Δ 300.000 = Resultado (the transfer is
  internal). ✓

**(c) money left unspent** — the 200.000 stays in Disponible; it is not income of October and not
savings unless the user registers a savings transfer.

**(d) money goes to the next month** — no record is created.
- Case A (no confirmation): Apertura(Oct) = 200.000.
- Case B (user confirms "really 175.000"): Apertura(Oct) = 175.000; Sep shows "Según tus registros
  200.000 · Saldo real 175.000 · Diferencia −25.000". The difference is not a movement; it is
  information ("money not registered") and stays attached to September.

**(b again, current month)** — Oct rows: Sueldo 1.000.000 ✓; Alquiler 400.000 ✓; Super 120.000 ✗;
Luz 25.000 ✗; Cuota 100.000 ✗. Transfer: Retiro de ahorro 50.000.

- Resultado realizado = 1.000.000 − 400.000 = 600.000; Pases netos = +50.000
- Disponible actual = 175.000 + 600.000 + 50.000 = **825.000**
- Proyectado al cierre = 825.000 − 120.000 − 25.000 − 100.000 = **580.000** (estimate)
- Overdue: Sep Luz 20.000 pending, shown apart (Q8), not in the projection.
- Ahorro ARS a hoy = 650.000 − 50.000 = 600.000; `aReponer` = 50.000.

**(e) something future is registered** — Nov: Sueldo 1.000.000, Cuota 100.000, Ahorro 200.000.
Effect a hoy: none (Disponible actual 825.000, Ahorro 600.000, patrimonio unchanged, I5).
Projection only: Nov projected closing = 580.000 + 1.000.000 − 100.000 − 200.000 = 1.280.000.

**(f) something scheduled becomes realized** — when `hoy` reaches November, the Ahorro 200.000
(transfer) becomes realized automatically (D1); Sueldo and Cuota become pending and realize when
ticked. No data is rewritten: realization is a function of `hoy`, not a stored flag.
Risk accepted by D1: a pre-loaded transfer realizes even if the user never did it (shown in Q5).

**(g) consecutive months** (Oct assumed closed with all pending paid):

| Month | Apertura | Resultado | Pases netos | Cierre calc | Real | Diferencia |
|---|---|---|---|---|---|---|
| Sep | 50.000 | 300.000 | −150.000 | 200.000 | 175.000 | −25.000 |
| Oct | 175.000 | 355.000 | +50.000 | 580.000 | — | — |
| Nov | 580.000 | 900.000 | −200.000 | 1.280.000 | — | — |

Telescoping check: 50.000 + (300.000 + 355.000 + 900.000) + (−150.000 + 50.000 − 200.000) +
(−25.000) = 1.280.000 ✓ — every peso is explained by a result, a transfer or a visible difference.

Patrimonio a hoy (Oct 15): bruto = 825.000 + 600.000 + 1.000 × 1.500 + 0 = **2.925.000**;
pasivos = loan saldo 3 × 100.000 = 300.000 (includes the unpaid Oct installment);
neto = **2.625.000**. The USD part is an estimate at the dated cotización.

---

## 3. "Hoy" and determinism

Rule: the motor never calls `new Date()`/`Date.now()`; a test fails if the motor block contains
them. The app builds `hoy` once per render/action: `hoy = {anio, mes, dia, iso}`.

Functions that must receive `hoy` (conceptual signatures):

| Function | Why |
|---|---|
| `mesTope(anio, hoy)`, `mesesCorridos(anio, hoy)` | past/current/future month boundaries |
| `normalizar(d, hoy)` | legacy pagado migration and the saldo-model marker (§8) |
| `cargarCuotas(d, nombre, desde, hoy)` | which loaded installments start as paid |
| `estadoDeuda(d, nombre, i, hoy)`, `proyeccionDeudas(d, hoy)` | projection start; no clock fallback |
| `serie(d, hoy)` | realized vs scheduled transfers; "a hoy" stocks |
| `cadena(d, hoy, ctx)` NEW | aperturas, cierres, diferencias for 12 months; `ctx = {cierrePrevio, pasesTrabajo}` |
| `proyectadoAlCierre(d, mes, hoy)` NEW | estimate for the current month |
| `patrimonio(d, hoy, ctx)` | bruto/neto a hoy; `ctx` carries Disponible from `cadena`, Trabajo (Q2) |
| `pasivos(d, hoy)` NEW | liabilities a hoy |

Functions that stay time-free: `calc(m)` (month-local arithmetic), `suma`, `sumaPagado`, parsers,
`ranking`, `datosTorta`, `gastadoTope`, `repartoCuotas`, `estaPagado`.
Cross-year input (`cierrePrevio`) is passed in by the app (it reads the previous year's blob);
the motor never reads storage.

---

## 4. Transfers ("pases")

Two different things share the word:
(1) personal transfers between pockets (savings, withdrawal, reposición, USD buy/sell) — always
within ONE month; (2) Trabajo "pase a lo personal" — dated, from the Trabajo store into the
personal Disponible of the month of its date.

Money never "transfers between months"; it stays in its pocket and the chain carries it.

`hoy = 2026-10-15`:

| Case | Origin date | Destination date | State | Origin effect | Destination effect |
|---|---|---|---|---|---|
| Savings in the same month | Oct | Oct | realized | Disponible −150.000 (Oct) | Ahorro ARS +150.000 (Oct) |
| "Jan → Feb" | — | — | not a transfer | Jan closing | Feb opening (chain, I2) |
| "Jan → Mar" | — | — | not a transfer | Jan closing → Feb opening/closing → Mar opening | money stays in Disponible through Feb |
| USD purchase (realized) | Sep | Sep | realized | Ahorro ARS −300.000 | USD +200 |
| Savings scheduled | Nov | Nov | scheduled | none a hoy; Nov projection −200.000 | Nov projection +200.000 |
| Trabajo pase dated 2026-10-10 | Oct (Trabajo) | Oct (Disponible) | realized | Trabajo −300.000 | Disponible +300.000 ("Del trabajo") |
| Trabajo pase dated 2026-11-05 | Nov | Nov | scheduled (proposed, Q4) | **today's code: Trabajo −300.000 now** → money in neither pocket until Nov (violates I4). Proposed: no effect until the date | Nov projection +300.000 |
| Edit/delete a past transfer, month NOT confirmed | its month | its month | realized | that month's closing changes | next opening follows (chain) |
| Edit/delete a past transfer, month confirmed | its month | its month | realized | calculated closing changes | next opening keeps the real value; difference updates; reconfirm prompt (D6) |
| Undo Trabajo pase | pase date | same | — | Trabajo +monto | Disponible −monto in that month (existing `quitarPase`) |

---

## 5. Debts

Two different "debts":

**A. `aReponer` — money withdrawn from savings that the user plans to put back (internal).**
Before: `aReponer` = 100.000.

| Case | Disponible | Ahorro ARS | aReponer after |
|---|---|---|---|
| Reposición 100.000 (= pending) | −100.000 | +100.000 | 0 |
| Reposición 60.000 (<) | −60.000 | +60.000 | 40.000 |
| Reposición 150.000 (>) | −150.000 | +150.000 | 0; the excess 50.000 is classified as savings (D11) |

No money is created in any case (I3). The rule D11 only changes the label of the excess; the
display should say "50.000 fueron ahorro" so the user is not told they repaid more than they owed.

**B. External debts (loans, cards) — section `deudas`, optional plan.** Plan 3 × 33.333/33.334
(R2 exact split).

| Case | Rule |
|---|---|
| Partially paid plan (1 of 3 ticked) | pasivo = 66.667 (remaining installments); Disponible reduced only by the ticked month |
| Cuota 0 ticked | not a payment (`cuotaPaga` requires monto > 0, R2); no effect anywhere |
| Installment crosses the month (Sep unpaid) | stays pending in Sep; Sep closing excludes it; pasivo still includes it. Paying it later = ticking the Sep row ⇒ booked in Sep (changes Sep closing; chain or reconfirm). Alternative booking in the current month: Q7 |
| Future installment (Nov) | scheduled; no effect a hoy on Disponible; pasivo counts it (it is owed) |
| Partial payment of one installment (row edited lower) | plan saldo is count-based today (not amount-based) — kept for Alfa, documented (Q14) |
| Debt without a plan | pasivo = unticked rows `<= hoy`; future rows unknown commitment, not counted |

---

## 6. Net worth

- Bruto = Disponible actual + Ahorro ARS a hoy + Ahorro USD a hoy × cotización + Cripto valued
  (+ Trabajo available, Q2).
- Neto = Bruto − Pasivos (§1).
- Cut-off: everything realized up to `hoy` (past and current months; transfers of the current month
  count, D1); nothing from future months (I5).
- Valuation: USD and crypto use the stored cotización/prices, labeled with their date (estimate).
- Before `arrastre.desde`, Disponible is not tracked (historical behavior, D4): net worth for
  legacy months excludes it, and is labeled as such if ever shown historically.

---

## 7. "Del trabajo"

What it is today (verified):
1. a reserved income row name (`RENGLON_TRABAJO = 'Del trabajo'`);
2. the receiving side of Trabajo pases (aggregated per month by `aplicarPase`);
3. always realized, without a checkbox (`sumaPagado` bypass; `seccion` hides the check and locks
   the row when the month has pases; `copiarAnterior` skips it);
4. identified by its NAME, with two different matchers (`clave` vs `trim().toLowerCase()`).

So it is not a normal category: semantically it is a **transfer from another pocket (Trabajo
cash) into Disponible**, implemented with a historical naming rule. Consequences today: a user
who types an income named "Del trabajo" gets an always-realized income without any pase; an
accented variant ("Del Trabájo") is realized by the engine but a pase creates a second row.

Most robust solution: the motor derives Trabajo income from the pases themselves
(`ctx.pasesTrabajo = {'2026-10': realized total, ...}` built by the app from `T.pases`, realized
when `fecha <= hoy`), and treats it as a transfer into Disponible. The row stays as a display and
backward-compatibility projection (older versions and backups keep working). A reconciliation check
flags months where the row amount ≠ Σ pases (manual edits, restores without Trabajo). Rows named
"Del trabajo" with no pases become ordinary income with a checkbox (Q3).

---

## 8. Migration (reversible, non-destructive)

**Before (v1.31.x):** year blob `kibo.datos.<anio>` with months, items (`pagado` explicit,
`pagoExplicito` marker), month transfer fields; no opening/closing; Trabajo separate.

**New fields (additive; year and month level only — verified to survive older app versions):**

- year: `arrastre = {desde: <month index or 0>, inicial: {valor|null, origen: 'declarado'|'omitido'|'arrastre', declaradoEl, calculadoOrigen}}`
- month: `cierreReal = {valor, calculadoAlConfirmar, confirmadoEl}` (optional)
- No new item-level fields (older versions drop them). `version` is not used (old code rewrites it).

**Order on every load (`normalizar(d, hoy)`):**
1. shape normalization (existing);
2. legacy `pagado` migration if `!pagoExplicito` (existing; reference date: Q9);
3. saldo model: if the year has no `arrastre` —
   - year < the model start year: legacy (no field written);
   - the year containing `hoy` on first run: `arrastre.desde = hoy.mes`, `inicial` from the first-use
     prompt (D5): the user declares current available money; `Apertura(desde)` is derived as
     `declarado − Resultado realizado − Pases netos realizados` of that month so far (Q1);
     skip ⇒ `valor: null, origen: 'omitido'`, opening 0, shown "sin saldo inicial";
   - years after the start year: `arrastre.desde = 0`, opening = previous December closing;
     `duplicar` snapshots it (`origen: 'arrastre'`, `calculadoOrigen`) for drift detection.

**Compatibility period:** the old semantics stay authoritative for months `< desde` forever (D4);
reading code for legacy months is never removed. Backups need no format change (fields live in
the year blobs that `armarCopia` already includes). Restoring a pre-R4 backup simply has no
`arrastre` ⇒ step 3 runs again (the user is asked again).

**Validations (tests):** I6 legacy isolation; idempotence (normalize twice = once); additive only
(strip the new fields ⇒ deepEqual the pre-migration blob); old-version round trip (pre-R4
`normalizar` from 7f7ad40/HEAD keeps `arrastre`/`cierreReal`); backup → restore → same chain.

**Rollback:**
- Code: revert the R4 commits; new fields are ignored by older code and preserved by it.
- Data: before the first R4 migration, snapshot all own keys to `kibo.respaldo.pre-r4` (own-key
  list, same mechanism as pre-1.30) for 30 days, with a "volver" action.
- Model: removing `arrastre`/`cierreReal` restores exactly the old semantics (tested).

**When the old model can stop being used:** the pre-R4 snapshot and its action are removed after
30 days and two releases; the name-based "Del trabajo" fallback after the reconciliation shows no
mismatches in tests and one release; legacy-month semantics and legacy-backup restore: never.

---

## 9. Golden fixture procedure

- Inputs: `tests/fixtures/motor-corpus.js` datasets + `TODAY`. R4 adds datasets (do not edit the
  existing ones): the §2 chain (Sep-Nov), confirmed/unconfirmed closings, skipped initial balance,
  future Trabajo pase, reposición > aReponer, plans (partial, zero, overdue, future), pre-R4 legacy
  year, restored backup without `arrastre`.
- Contractual outputs: every value returned by `corpus.compute` (all motor functions over all
  datasets) plus the new functions (`cadena`, `proyectadoAlCierre`, `patrimonio`, `pasivos`).
- New functions only ADD sections (no regeneration needed for existing ones).
- Changing existing outputs (expected in R4.4) happens in ONE dedicated commit
  `test(golden): regenerate for R4.4` containing only the fixture and a generated report
  `tests/fixtures/golden-diff-R4.4.md` listing every changed path `dataset/field: before → after`,
  each mapped to a decision (D1-D17, Q*) or a matrix case. An unmapped change is a regression.
- Accidental regeneration guard: the generator refuses to write unless
  `TUGASTO_GOLDEN_RAZON` is set; it stores `{razon, baseCommit, hash}` in the fixture metadata; a
  test fails if the fixture hash has no matching `golden-diff-*.md` report.
- before → migración → después: for the legacy datasets the corpus records three outputs: the
  pre-R4 engine on the raw blob (from the current fixture), the blob after `normalizar(d, hoy)`,
  and the R4 engine; I6 asserts legacy months are identical across all three.
- Never regenerate to make a failing test pass; a failing golden first gets an explanation.

---

## 10. Multiple tabs

Today: each save writes the whole year blob; the last tab to save wins (no `storage` listener).
New-model impact: a confirmed closing or declared initial balance saved in tab A is silently lost
when stale tab B saves the same year; first-run initialization is deterministic per `hoy`, so
both tabs agree, except across a month boundary.
Minimal mechanism (recommended inside R4, Q12): a per-blob revision `rev` incremented on save;
before writing, re-read the stored `rev`; if it changed since this tab loaded, do not write and
show "Hay cambios desde otra pestaña: recargá". Plus a `storage` listener that reloads when this
tab has no unsaved edits. Same for `kibo.trabajo`.

---

## 11. R4 implementation plan

| Stage | Objective | Files / components | Tests | Risk | Acceptance | Rollback |
|---|---|---|---|---|---|---|
| R4.1 Contract + `hoy` | inject `hoy` everywhere in the motor; no behavior change | motor block, aliases, app call sites, tests harness | golden byte-identical with `hoy = TODAY`; test "motor has no Date" | low | golden unchanged, all suites green | revert commit |
| R4.2 New model (pure, unused) | `cadena`, `pasesNetos`, `proyectadoAlCierre`, `pasivos`, new `patrimonio` beside the old one; no caller switched | motor block | invariants I1-I7 as property tests; §2 cases; golden: additive sections | low | new functions green; old outputs unchanged | revert |
| R4.3 Migration | `arrastre`, `cierreReal`, first-use derivation, `duplicar` snapshot, pre-r4 snapshot, multi-tab `rev` | `normalizar`, `duplicar`, storage layer, own-key list | idempotence, additive-strip, old-version round trip, restore, `rev` conflict | medium | migration tests green; legacy isolation I6 | snapshot + revert; data untouched |
| R4.4 Integration | switch consumers to the new model per the inventory (tiles, `refrescar`, `patrimonio` callers, `hayDatos` unaffected), Trabajo income from pases, future Trabajo pases scheduled | app render code, `resumenTrab`, inventory data | golden regeneration commit + diff report; E2E updated | **high** (numbers change) | every changed number mapped to a decision; inventory updated | revert; data untouched |
| R4.5 Validation | 17-case matrix (D16) with input / expected / actual / test / evidence; before→migration→after report; native review | doc, tests, E2E | matrix all green; E2E green | — | owner approves the matrix | — |
| R4.6 Cleanup | remove dead params, document semantics source per concept, update inventory semantics | motor, docs | suites green | low | no behavior change (golden identical) | revert |

Release coupling (Q11): R4.4 changes what "Disponible" means on screen; shipping it without R5
(opening line, Editar, prompts, labels) would show unexplained numbers. Recommendation: no
release between R4.4 and R5; version bump only when R5 lands.

---

## 12. Decisions for the owner — APPROVED 2026-10-05 as recommended

Binding answers: Q1 ask current available, derive the opening; Q2 Trabajo cash is a pocket in net
worth; Q3 "Del trabajo" rows without pases are ordinary income with a checkbox; Q4 future Trabajo
pases scheduled on both sides; Q5 scheduled transfers realize automatically when their month
arrives; Q6 liabilities = debts section only; Q7 late installment booked in its own month; Q8
overdue pending shown apart from the projection; Q9 legacy pagado migration dated by
`actualizado`; Q10 new fields in the year blobs (year/month level); Q11 no release between R4.4
and R5; Q12 multi-tab `rev` + `storage` in R4.3; Q13 `ahorroMesUSD` = external USD inflow
realized by month, no checkbox; Q14 debt saldo count-based; Q15 pre-R4 snapshot kept 30 days.

- Q1 First use: ask "¿Cuánto dinero tenés disponible actualmente?" (D5) and derive the opening of
  the current month from it (recommended), or ask "¿Con cuánto empezaste el mes?".
- Q2 Trabajo cash in net worth: include `resumenTrab().disponible` as a pocket (recommended: yes,
  it is the user's money) or keep it out for Alfa.
- Q3 Rows named "Del trabajo" without pases: become ordinary income with a checkbox (recommended).
- Q4 Future-dated Trabajo pases: scheduled on both sides until their date (recommended; today they
  leave Trabajo immediately).
- Q5 Scheduled transfers realize automatically when their month arrives (D1). Confirm, or require
  a one-tap confirmation in that month.
- Q6 Liabilities = debts section only (plans + unpaid rows ≤ hoy without plan); pending ordinary
  expenses are not liabilities (recommended for Alfa).
- Q7 Paying an overdue installment: booked in its own month (recommended, conserves the chain)
  or in the current month.
- Q8 Overdue pending of earlier months: shown apart, not inside "Proyectado al cierre" (recommended).
- Q9 Legacy `pagado` migration reference date: use the blob's last save date (`actualizado`)
  instead of today, so an old backup restored later does not mark extra months as paid
  (recommended; changes legacy golden outputs, documented in the diff report).
- Q10 Storage: new fields inside the year blobs at year/month level (recommended; verified to
  survive older versions) vs a separate key.
- Q11 No release between R4.4 and R5 (recommended).
- Q12 Minimal multi-tab protection (`rev` + `storage` listener) inside R4.3 (recommended).
- Q13 `ahorroMesUSD` ("dólares que entraron aparte"): external USD inflow, realized by month, no
  checkbox (recommended).
- Q14 Debt saldo stays count-based (installments) for Alfa; partial payments not modeled.
- Q15 Pre-R4 snapshot retention: 30 days (same as pre-1.30).

## Risks

- R4.4 changes the main number on screen; mitigated by Q11 and the diff report.
- Automatic realization of scheduled transfers (Q5) can overstate savings if the user never did it.
- Count-based debt saldo (Q14) diverges from amounts when installments are edited.
- Booking late payments in their own month (Q7) changes past closings; mitigated by D6 reconfirm.
- Multi-tab loss of confirmations until Q12 lands.
- The first-use derivation (Q1) absorbs any unregistered movement of the month into the opening.
- The unreviewed slice `3a8a7ae..HEAD` joins the first R4 native review.
