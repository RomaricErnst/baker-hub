# Baking-science and timing-window review — 22 September 2026

## Scope and decision

Read-only review of application state `8e8d448` and the subsequent test-only work. No application code, recipe constant, dose, or formula was changed by this review. Read AGENTS.md, PROJECT-HANDOFF.md, the current fermentation-window design, and historical engine/science/sourdough audits before evaluating the implementation.

**Keep the existing calibrated formulas. Keep the new window as a recommended planning range. Change its interpretation/copy, not its coefficients:** “Before / within / after the recommended window” is more defensible and calmer than “too early / too late.” An adjustable commercial yeast dose means an out-of-window plan is not automatically an under- or overfermented dough. Conversely, an in-window timestamp does not prove physical readiness.

This is a code-and-consistency review, not a baking trial or comprehensive empirical validation. The existing comments' Modernist book/table comparisons were preserved but their underlying book pages were not available for independent revalidation. No substitute constants were inferred from generic recipes.

## What responds to what

| Layer | Inputs that actually matter | Limits relevant to the window |
| --- | --- | --- |
| Commercial yeast dose | Actual warm/cold duration, kitchen and fridge temperature, yeast type; downstream flour tolerance, sugar and priority | Empirical laws and caps, not a dough-core temperature simulation; salt and exact hydration are not dose inputs |
| Commercial mixing range | Style, flour-strength factor, remaining planning horizon/cold availability, climate-dependent minimum warm allowance | Does not directly accept fridge temperature, preferment fraction/type, dough hydration, yeast dose or measured dough temperature; it is an existing scheduling preference |
| Schedule construction | Style, climate bands, start/bake, preparation duration and unavailable periods | No fridge-temperature input; time accounting now uses actual phase timestamps, including warm handling between cold periods |
| Poolish/biga seed | Preferment fraction, actual duration within supported bounds, kitchen/fridge temperature, yeast conversion, whole-dough yeast requirement | Max of ripening dose and estimated grown-population requirement is a calibrated heuristic, not measured cell growth; it can increase seed above the peak-only dose |
| Sourdough starter planning | Temperature, maturity/rye flags, feed ratio, starter history, cold storage, candidate feed paths and availability | Starter peak is estimated. A starter scoring color can include availability; it is not a pure maturity measurement |
| Sourdough final-dough starter amount | Temperature band, feed-to-mix duration, flour-strength factor | Final dough fermentation duration and fridge temperature are not arguments of `sourdoughGuidance`; do not describe this as a fully coupled fermentation model |
| Water/thermal balance | Actual flour/water/preferment masses and temperatures, target dough temperature, mixer heat | Useful mass-weighted mixing estimate; not the subsequent dough cooling curve. Measured ingredient temperatures affect water advice, not the fermentation kinetics |
| Simple/Custom | Shared recipe/planning pipeline; Custom can override specified inputs | Simple is not a different scientific model. Custom exact hydration bypasses automatic hydration adjustment |

Humidity's hydration adjustment and style/flour tolerance rules remain heuristics. There is no justified reason in this task to retune them. Enriched formulas preserve their separately sourced direct-commercial method; unsupported saved sourdough/preferment combinations must remain explicit.

## Numerical checks against production functions

Loaded actual TypeScript using `tests/load-production.cjs`; no copied replacement formula.

- At 4 h warm, no cold, 1,000 g flour, instant yeast and no priority override, dose percentages at 16 / 22 / 30 / 35 / 38°C were **1.5 / 1.2697 / 0.5305 / 0.3087 / 0.2345**. The cool endpoint hits the existing ceiling. Hotter input did not accidentally increase dose; the historical >35°C tropical-band fall-through is absent.
- At 2 h warm, 22°C, 24 h cold, fridge 2 / 4 / 6 / 8 / 10°C, the same dose was **0.1328 / 0.1156 / 0.1006 / 0.0876 / 0.0762%**. Fridge correction has the expected direction in this model.
- At 1,000 g flour, 650 g total water, poolish 12 h at 22°C, whole-dough target 1 g IDY, fractions 10 / 30 / 60% produced seed **0.31952 / 0.31952 / 0.40109 g** and remaining water **550 / 350 / 50 g**. A low-fraction preferment can correctly be governed by the whole-dough target instead of scaling seed linearly with its flour. Do not remove this behavior casually. Its growth assumptions still need empirical evidence before calling it universal maturity prediction.
- Ran **47 targeted tests, all passed**, covering yeast continuity and dilution, preferment ordering/validity/blockers, assessment boundaries/style-climate matrix, enriched formulas, water-energy handling, schedule accounting, sourdough dead-end guards, mass balance and measured ingredient temperatures. These include the previous short-window/proof-after-bake and elapsed-warm-exposure regressions.

Commands:

```sh
node --test tests/yeast-continuity.test.cjs tests/commercial-preferment-schedule.test.cjs tests/fermentation-assessment.test.cjs tests/water-methods.test.cjs tests/enriched-formulas.test.cjs
node --test tests/schedule-regression.test.cjs tests/sourdough-schedule-guards.test.cjs tests/recipe-mass.test.cjs tests/measured-ingredient-temperature.test.cjs
```

## Findings, bounded by evidence

### P2 — Window semantics must remain advisory

`commercialReadinessWindow` shares the old solver's raw bounds, which is a sound consistency improvement over a separately broader chart band. But those bounds are not a calibrated maturity envelope. For example, a roomy Neapolitan plan with strength 1 gets 34-to-8 hours before the target across most kitchen temperatures; changing fridge temperature cannot change that helper because it is not an argument. Recipe dose does change. Preserve this purposeful separation and say “recommended window,” rather than implying the dough itself is too early or too late.

Minimum justified change: calm status copy and one concise estimate label, with observation cues in the existing disclosure. Retain the clear direction for adjusting the mixing time while holding bake time fixed. Do not add another warning card.

### P2 — Existing hot room-only sourdough bounds disagree

The sourdough candidate window uses unadjusted style `preferredColdH + rtH` versus `minTotalFermH`, while the historical rendered upper bound can shrink through `climateRtH`. Roman at 30°C has adjusted warm 3.6 h against minimum 4 h; at 35–38°C it has 2.7 h against 4 h. Pan at 30°C collapses at 3 h; rye collapses/reverses against its 4 h minimum. The new panel already suppresses contradictory bounds rather than manufacturing a green range.

Keep that conservative fallback. Resolving the underlying disagreement requires reviewing the intended style constraints and sourdough dose/schedule relationship together, not swapping endpoints or lowering minimums until a test passes.

### P2 latent helper defect — Excessive mixed warm exposure drops out of dosing

Production reproduction:

```js
recommendYeast(29.9, 30, 12, 4, 'instant', 1000, null, 'neapolitan')
// pct 0.05, notRecommended false
recommendYeast(30, 30, 12, 4, 'instant', 1000, null, 'neapolitan')
// pct 0.2871, notRecommended false
```

At the RT rejection threshold, `rtIDY` returns null and the mixed branch handles it like no warm phase, reverting to the higher cold-only dose. This is a real consistency discontinuity independent of coefficient calibration. **It was not reproduced through normal schedule generation:** a 2,700-case no-blocker matrix (15 styles × 6 temperatures 16/22/28/30/35/38°C × 10 horizons 2–96 h × 3 preheat values) produced no mixed schedule entering this branch. Do not call it a confirmed current UI failure or change formulas as part of window copy. Follow up with an invalid-exposure contract and targeted restored/blocked-schedule reachability investigation before fixing; a rejection/flag is preferable to inventing a new dose.

### Calibration limitations, not newly proven defects

- Sourdough final dough inoculation is not directly duration/fridge-sensitive. Starter planning is much richer than this final-dose function. An unchanged inoculation under changed bake horizon is therefore expected from current architecture, not evidence that the new display broke a formula.
- Q10/exponential terms, flour-tolerance factors, fixed thermal coefficients, peak ratios and 35–38°C floors are assumptions fitted to limited reference points. Their units are consistent when hours and Celsius differences are used as documented. They do not establish independent predictive accuracy across all flour/starter strains and batch sizes.
- A percent floor and priority multipliers can create plateaus or steps; those alone are not a bug. Preserve documented calibration unless observational evidence supports changing it.

## Availability blockers and actionable guidance

The science requirement is that convenience constraints never silently erase real exposure or declare an impossible preparation executable. Current passing tests verify half-open blocked intervals, feasible preferment/mixing placements, invalid fully blocked/reversed/under-minimum preferment plans, and sourdough dead ends that cannot claim green. Schedule accounting includes real warm handling and proof elapsed time; it does not shorten exposure just because a nominal proof cap is lower.

The new panel separately checks future feed/mix/bake and exact cold-entry/exit action times; blocked/impossible preparation suppresses its positive window. A generic unavailable-period notice should direct the baker to the affected action, not automatically shift mixing when the conflict belongs to another event. A detailed independent blocker audit is being coordinated separately; this review does not claim every sourdough candidate family or manual interaction was exhaustively verified.

## Reconciliation with historical reviews

Do not reopen historical defects by reading old line numbers alone. Current tests and code show preserved mass accounting, nonzero preferment seed precision, final-dose dilution arithmetic, actual warm/cold phase accounting, short-window chronological guards, thermal residual exposure, and explicit enriched-method limitations. The prior sourdough review approved a stronger feed-ratio lever and revised peak timing; the current continuous temperature model is later than that document. No rollback is recommended.

## External evidence and limits

Maurizio Leo's first-hand [dough-temperature guidance](https://www.theperfectloaf.com/the-importance-of-dough-temperature-in-baking/) supports measuring actual dough temperature and adapting the process to observed development when dough is warmer or colder than expected. This supports keeping observation cues alongside the schedule; it does **not** validate Bakerhub's exact Q10, dose floor, growth anchor, or recommended-window endpoints.

Attempts to inspect King Arthur's professional temperature/fermentation pages and the linked [primary microbiology paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC106434/) were blocked/unavailable in this environment. Those sources were not used to claim verification of numerical constants. Source-code comments and historical audit reports were treated as provenance, not independently reproduced scientific evidence.

## Minimum release recommendation

Keep calibrated recipe constants and current guarded windows; soften the status language, retain one clear adjustment action and optional physical signs, and preserve impossible/unsupported-plan guards. Record the hot-sourdough inconsistency and latent mixed-exposure edge case for scoped follow-up. This provides useful scheduling advice without suggesting that a timestamp measures the dough.

## Integrated outcome

The root implementation adopted advisory before/after-window wording, reduced repeated cautions, and made known availability conflicts neutral and actionable (`cd6380a`). Formula constants, dosing, thermal balance and candidate scoring were preserved. See BLOCKER-REVIEW-20260922.md for the remaining scheduling gaps and final handoff for runtime evidence.
