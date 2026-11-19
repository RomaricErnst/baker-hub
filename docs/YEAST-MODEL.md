# The yeast model

19 Nov 2026 · `app/utils/yeastModel.ts` · tests: `tests/yeast-model.test.cjs` · data and fit: `docs/yeast-model/`

## In plain words

Baker Hub sizes commercial yeast (instant, active dry, fresh) with one model. It follows the dough's temperature through the plan, converts every hour into "what an hour at 25 °C would have done", and asks for the amount of yeast that brings the dough to its target rise at the bake.

Three things changed for bakers:

1. **A fridge mostly holds the dough.** An hour at 6 °C does about a tenth of an hour at 25 °C (the old engine counted fridge hours at 60–75 % of room-temperature hours). Doughs with a long cold retard get more yeast than before (about 2–3×), close to professional and book recipes (Modernist, Lehmann, Ooni), and the dough finishes rising at room temperature.
2. **Short doughs get less yeast, warm doughs less again.** The old curve was too steep in time (exponent 1.65), so 2–6 h doughs got 1.5–4× more yeast than any book. Above 30 °C yeast barely speeds up, but a warm dough is planned to a smaller rise, as hot-climate bakers do.
3. **A poolish or biga holds only its own yeast; the final dough gets its own.** The poolish now peaks at the mix by construction, and the final dough has a yeast line, as in every Modernist poolish recipe.

Every constant below is either published, derived from published science, or fitted to named data with its residuals. On the 79 independent data points the model is typically within a factor of 1.8 of the source (the sources disagree with each other by about as much); the old engine was within a factor of 2.6 on the same points.

## 1. Equations

**Activity.** Fermentation rate relative to 25 °C, from the cardinal-temperature model with inflection (CTMI; Rosso, Lobry & Flandrois 1993, *J. Theor. Biol.* 162:447):

```
CTMI(T) = (T − Tmax)(T − Tmin)² / { (Topt − Tmin) [ (Topt − Tmin)(T − Topt) − (Topt − Tmax)(Topt + Tmin − 2T) ] }   for Tmin < T < Tmax, else 0
r(T)    = CTMI(T) / CTMI(25 °C)
```

**Temperature path.** The dough leaves the bowl at its target dough temperature (the DDT the recipe solves water for) and relaxes towards its surroundings, `dT/dt = (T_env − T)/τ`. The surroundings are the kitchen, then the fridge, then the kitchen again, phase by phase from `buildSchedule`. The bulk cools as one mass in the first cold spell; pieces cool and warm on their own. τ is the engine's existing lumped-capacitance estimate (`thermalTauH`, ~1.6 h for 250 g, ~2.8 h for 1 kg; Lehmann cross-stacks 16–24 oz balls 2–2.5 h to cool them). Poolish and biga have their own paths: made at the kitchen temperature; a room-temperature poolish chilled before the mix when the plan says so; a fridge poolish out for its warm-up before the mix; a biga in the fridge throughout.

**Equivalent hours.** `Heq = ∫ r(T(t)) dt`, integrated exactly over each exponential (Simpson's rule over the first 8 τ of a phase, the settled remainder at the surroundings).

**Dose.** Instant yeast as a % of the flour that ferments:

```
dose = A · M · R · Heq^(−b)
```

- M, the **medium**: 1 for a salted dough, M_p for a poolish, M_b for a biga (ripe endpoint).
- R, the **rise target** (§3).
- The inverse `Heq = (A·M·R / dose)^(1/b)` gives the timing for a baker-entered amount and the poolish peak.
- A plan's **budget** is `Heq / Heq_needed(dose)`: 1 on target, the readiness band is 0.9–1.1.

The product limits are unchanged: 0.05 % floor and 1.5 % ceiling on an automatic dose (preferments too), 1 % fixed for enriched doughs (sugar ≥ 10 % of flour).

## 2. Constants

Basis: **(a)** published value · **(b)** derived from accepted science with cited inputs · **(c)** fitted to named data (residuals in §5).

| Constant | Value | Basis | Uncertainty |
|---|---|---|---|
| Tmax | 45.4 °C | (a) Salvadó et al. 2011, *Appl. Environ. Microbiol.* 77:2292, S. cerevisiae growth | — |
| Topt | 32.3 °C | (a) Salvadó et al. 2011. Fitting it freely gave 34.0 °C (33.0 with plain least squares), SE ≈ 4 °C: the data cannot identify it, so the published value is used | free fit 34 ± 4 °C |
| Tmin | −0.5 °C | (c) fitted (−0.54) to the cold-retard recipes (E2) and Nestec's measured gas rates at 4, 7 and 10 °C (US 5,827,724, normal baker's yeast in maltose medium) | bootstrap 95 %: −1.2 to 0.5 °C; r(6 °C) 0.08–0.11 |
| A | 2.05 % | (c) fitted (2.054) | SE of ln A 0.29; bootstrap 0.97–3.18 |
| b | 1.24 | (c) fitted (1.244); expected 1.2–1.4 (Finney 1976: 1.36; independent Phase 1 fit: 1.19–1.25) | SE 0.15; bootstrap 0.91–1.43 |
| M_p, poolish | 0.83 | (c) fitted (0.831) to MP4 KM p. 2, MB6 KM p. 20, MB2 p. 44 errata, Weekend Bakery, fond.kitchen, Dissapore, Pezzetta, Suas (held out), The Dough Formula (held out) | SE of ln 0.19; bootstrap 0.54–1.25 |
| M_b, biga | 2.67 | (c) fitted (2.666) to MB6 KM p. 22 (0.31 %, 12 h), MB6 KM p. 19 (0.24–0.33 %), Giorilli via Dissapore (1 % fresh, 16 h, 18–20 °C) | SE of ln 0.52; bootstrap 1.75–4.32 |
| R in a warm dough | 0.6 | (a) You Knead Sourdough: "Warm climates (28 °C+): target a 30 % rise during bulk", up to 50 % below 25 °C → 30/50. (b) dose ∝ R because the dose law is a gas law: gas ∝ dose · Heq^b, so a smaller gas target at the same time needs proportionally less yeast | one source; see §8 |
| R transition | 25 → 28 °C of dough temperature at the end of the plan | (a) the same source's two temperatures; smoothstep between them so no step | — |
| Fresh, active dry | × 3.0, × 1.33 of instant | (a) MB6 KM p. xi (prior sources: BAKERpedia/ASBE 2.86 and 1.43; Fleischmann's 1.25 for ADY) | ADY 1.25–1.5 across sources |
| Floor, ceiling | 0.05 %, 1.5 % | product limits (MP4 p. 38 uses 0.04 %; Modernist emergency doughs 0.8–1 %) | — |

Shipped values are the fit rounded (A 2.05, b 1.24, Tmin −0.5, M_p 0.83, M_b 2.67); the rounding changes no residual statistic by more than 0.005.

## 3. Endpoints

ENDPOINTS.md (Phase 1) explains why published tables for the same time and temperature differ 3–10×: they stop the dough at different points. The model makes the endpoint explicit:

- **E1, dough ready ≈ doubled.** The reference for A and b: tables and recipes whose dough is ready to divide, shape or bake. No style in Baker Hub has a sourced rise target that differs from doubled (Forkish's tripled bulk and AVPN's fixed schedule are single recipes), so the per-style table is uniform: R = 1.
- **E2, a long cold retard holds the dough; it finishes at room temperature.** This is professional and hot-climate practice (Lehmann's 1–3-day doughs, Modernist's cold-proofed poolish doughs, da Michele's protocol in Singapore, Pizzastunde at 35 °C). The cold tail of r(T) is therefore fitted to those recipes and to Nestec's measured cold gas rates, not to the community tables that expect the dough to rise in the fridge (§5.3).
- **E3, a warm dough is used at a smaller rise.** R eases from 1 at 25 °C to 0.6 at 28 °C of dough temperature at the end of the plan (the dough at the bake, from the path). A cold-retarded dough that warms for an hour in a 32 °C kitchen ends near 18 °C and keeps R = 1; a room-temperature dough in that kitchen ends near 32 °C and gets R = 0.6.
- **Preferments: ripe.** "The yeast has done as much fermenting as possible with the food available" (MP4 p. 2); "domed, just beginning to recede" (Suas). E3 does not apply to preferments.

## 4. Method

**Data.** `docs/yeast-model/DATASET.csv` (Phase 1: 202 rows; sources and quotes in LITERATURE.md). `fit/rows.py` maps each row to a temperature path the model can integrate and says why a row is not used:

- not independent: dough.school (its table reproduces the old engine to ±5 %) and the secondhand Craig description, kept as references;
- no time, no dose, or flagged implausible in Phase 1 (Pizza Napoletana DOC's fridge column); the AI post; chemically leavened or enriched doughs (which test the fixed enriched dose instead);
- unstated temperatures (the Suas relay on TFL, yozzause's bakery table: checks only).

Assumptions written next to each row:

- the dough starts at room temperature unless a dough temperature is stated (Modernist 27 °C, Forkish 25.5 and 28 °C, Lehmann 28 °C, da Michele 24.5 °C, Ooni's 35–46 °C water ≈ 26 °C);
- τ = 2 h for every data path;
- cold tables that state no finish get mixed at 21 °C, straight to the fridge, 2 h at 21 °C before the bake (fond: 1.5–3 h; Modernist: 2 h).

**Fit.** Least squares in ln(dose), robust (soft-L1, scale 0.5 in ln units, about one between-source standard deviation, so that one-row sources such as Baking Steel at ×5 cannot swing b), with each row weighted 1/√(rows from its source) and anecdotes at half weight. The same objective includes:

- the 22 Modernist proof pairs (the same dough proofed at 21 and 27 °C), as residuals of b · ln(Heq₂₁/Heq₂₇);
- the three Nestec gas-rate ratios, as b · ln(r(T)/r(30)).

Free parameters: A, b, Tmin, M_p, M_b, with Topt and Tmax fixed (§2).

**Validation.**

- **Hold-out.** Five of the 21 eligible sources (24 %) were drawn with a fixed seed before fitting (`fit/holdout.py`; constraints keep every parameter identifiable): Baking Steel, Forkish, Lehmann, Suas, The Dough Formula.
- **Leave-one-source-out**, for every source.
- **Source bootstrap**, 200 resamples, for the intervals in §2.
- **Sensitivity**: τ 1.5/3 h, the proof-pair start temperature, Topt free, all cold data, without Nestec, without the pairs.

The shipped constants are the fit on all eligible sources after validation.

Reproduce: `cd docs/yeast-model/fit && python3 run_fit.py && python3 checks.py && python3 export_fixture.py ../../../tests/fixtures/yeast-model-data.json` (numpy, scipy). Reports: `fit-report.txt`, `checks-report.txt`, `fit-results.json`.

## 5. Fit quality

Residual = ln(source dose / model dose); "×" is its exponential.

### 5.1 Overall

| Set | n | rms | bias | within ×2 |
|---|---|---|---|---|
| Fit set, fit-set constants | 69 | 0.585 (×1.80) | +0.08 | 50 |
| **Held-out sources**, fit-set constants | 10 | 0.647 (×1.91) | +0.27 | 8 |
| Leave-one-source-out, each source predicted without it | 79 | 0.635 (×1.89) | — | 52 |
| All eligible, shipped constants | 79 | 0.580 (×1.79) | +0.06 | 58 |
| Same 79 rows, **old engine** | 79 | 0.95 (×2.59) | −0.31 | — |

Fit-set constants (before refitting on all): A 2.45, b 1.37, Tmin −0.2, M_p 0.82, M_b 2.96. Across leave-one-source-out fits, A ranged 1.58–2.38 and b 1.15–1.36 (Finney and Baking Steel move them most).

### 5.2 Per regime (shipped constants)

| Regime | n | mean | rms | Old engine (same rows) |
|---|---|---|---|---|
| Room temperature, ≤ 4 h | 11 | −0.07 | 0.49 | direct RT overall: rms 1.10 (×2.99), bias −0.79 |
| Room temperature, 4–12 h | 22 | +0.19 | 0.69 | |
| Room temperature, > 12 h | 9 | +0.06 | 0.69 | |
| Dough at ≥ 28 °C (Finney, 30 °C) | 2 | +0.81 | 0.81 | |
| Cold, recipes (E2) | 4 | −0.46 | 0.68 | rms 1.49 (×4.42), bias +1.02 |
| Poolish | 28 | +0.03 | 0.47 | rms 0.58 (×1.78) |
| Biga | 3 | 0.00 | 0.14 | rms 0.43 (×1.54) |

Per source (fit-set constants), the largest offsets are source styles, not regimes:

- above the model (they use more yeast): Pizza Napoletana DOC +0.66, My Pizza Night +0.60, Finney +0.77, Suas +0.45, Baking Steel +1.54;
- below the model: Crust Kingdom −0.74, Biorito −0.80, the EU TSG −1.12, da Michele −0.80.

The residual scatter (×1.8) is mostly between sources.

### 5.3 What the fit does not reproduce

- **Community cold tables** (dough.school cold, Crust Kingdom, My Pizza Night, Jordo, fond tables, Biorito): they use 2–5× less yeast than the model (source/model 0.20–0.63; Biorito's 24 h fridge 0.017 % at 0.04×). Their endpoint is a rise *in* the fridge. Fitting them too gives Tmin −2.8 °C, r(6) 0.15 instead of 0.10, and 0.104 % instead of 0.146 % for 2 h + 46 h at 6 °C + 2 h. Under E2 the model follows the recipes.
- **Proof pairs at 27 °C**: the books' 27 °C proofs are 1.27× faster than the model predicts (mean ln(Heq₂₁/Heq₂₇) +0.24). A higher Topt (38–40 °C) would fit them and Nestec at 7–10 °C, but the dose data at 27–30 °C (Suas, Finney) point the other way; the free fit settles at 34 °C.
- **Nestec**: 4 °C 0.042 vs 0.051 measured, 7 °C 0.112 vs 0.061, 10 °C 0.210 vs 0.095 (relative to 30 °C). The CTMI shape cannot be as flat between 4 and 7 °C as the patent's coarse thresholds (">40 mL after 6–7 days").
- **Short-term gas above 33 °C** (Istudor et al. 2020, 1 h tests): +8 % at 33, +22 % at 36, +52 % at 39 °C relative to 30 °C; the model falls from 32 °C. Multi-hour doughs follow growth and maintenance, which peak at 31–33 °C (Salvadó; Zakhartsev et al. 2015).
- **Pizzastunde at 35 °C**: a dough planned for 24 h at room temperature is "fully fermented in 8–10 hours". The model gives 16.9 h at R = 1, 11.2 h at R = 0.6.

### 5.4 Checks on rows not used to fit

- **Poolish doughs** (MP4 thin-crust, Neapolitan, NY, artisan, NY square, Quad City, focaccia; MB6 French; Gozney; CalBeachBaker): the total yeast is 0.44–1.94× the direct-dough need of the dough's own path (geometric mean 1.16). Hence the final dough's yeast rule (§6).
- **Fixed enriched dose**: MP4 Pizza Gourmet uses 1.08 % at 10.7 % sugar for 4.25 h (the lean law would give 0.37 %): the 1 % rule holds.
- **Other checks**:
  - Weekend Bakery's fridge poolish: 0.98× at 18 h, 0.67× at 24 h, assuming a 4 °C fridge;
  - MB6 sponge 1.23× and pâte fermentée 0.57× (a salted, ripe preferment);
  - yozzause's bakery table at an assumed 26.5 °C: 0.93–1.64×;
  - dough.school: 0.92–2.88×, highest at short times, the old exponent's mark;
  - Craig (secondhand, 0.048 % at 12 h): 0.40×.

### 5.5 The old cold law: double counting?

Phase 1 asked whether the engine's cooling trajectory counted warm hours twice. Measured on the old engine, it did not matter: the trajectory moved its dose by ≤ 1 % (Neapolitan, 21 °C, 26 and 50 h). The old cold doses were low because the cold law itself credited a 4 °C hour like 0.6–0.75 of a 21 °C hour. The new model cannot double count: there is one integral.

## 6. Preferments

- **Dose.** A poolish or biga holds `A · M · Heq_pref^(−b)` of its own flour, Heq over its own path (`prefermentPath`), with the 0.05–1.5 % limits. This replaced Craig's laws × 1/3.1 (RT poolish), × 1.65 (fridge poolish) and × 2.2 (biga), and folds in the ÷1.4 proposed from MP4 KM p. 2 / MB6 KM p. 20 (M_p 0.83 relative to the new dough law).
- **Final dough.** It gets its own yeast: the direct-dough need of the path from the mix to the bake (`finalYeastGrams`), with no credit for the preferment's yeast.
  - Every Modernist poolish dough adds yeast to the final dough, and their totals sit at 1.16× that need (§5.4); Suas and Hamelman do the same.
  - This replaced the leavening top-up (a seed sized to carry the whole dough, which over-ripened room-temperature poolishes; Thomas's 11 h poolish peaked about 4.5 h in).
  - Preferments above ~35 % of the flour (MB6 p. 19 gives 10–35 %) are outside this evidence.
- **Peak.** `poolishPeakHours` inverts the same dose on the same path, so a poolish dosed for its window peaks at the mix. The planner's poolish levers (fridge, later start) remain for a dose held at the floor or a window longer than the dosed one (`preferment.pastPeak`).

## 7. Where the model is used

| Consumer | Function |
|---|---|
| Recipe, direct dough | `calculateRecipe` → `doughThermalPath` (mix at the target dough temperature) → `recommendYeast(…, path)` |
| Preferment and final dough | `computePrefermentRecipe` (`prefermentPath`, `finalYeastGrams`) |
| Poolish peak and levers | `poolishPeakHours`, `poolishPeakAtMix`, `pastPeak` → page `poolishPeakAtMix` → `poolishRipeness.ts` |
| Baker-entered amount | `fermentationHoursForYeast` (scan + bisection, nearest the style's window within the time left) → `checkYeastEntry`, SchedulePicker `yeastTimingFor` |
| Bake from the fridge | `bakeFromFridgeOption` (the usual plan's dose, read on the variant's path) |
| Suggested other bake times | `fermentationBudget(1.5, …)` (can even the ceiling make it?) |
| Recipe "how was this calculated" | `YeastHelper` |
| About page | `app/[locale]/about/yeastModelSection.tsx` (EN, FR) |

Schedules do not depend on the dose (they come from the style's hours), so plan structure is unchanged except where a dose feeds a decision: the inversion for an entered amount, the poolish levers, the bake-from-fridge offer and the suggestion filter.

**The budget is not monotone in the window.** A Neapolitan plan of 10 h at room temperature ferments more (Heq 8.2 at 22 °C) than an 11 h plan that takes the cold retard (Heq 6.1). So the inversion collects every window where the budget rises through the target and returns the one nearest the style's own window, within the time left.

## 8. Limits and open questions

1. **Cold.** Few measured points between 2 and 8 °C, none in dough. Home fridges run ±3 °C, and r doubles between 4 and 6 °C, so the fridge setting matters more than it used to. A kitchen trial (dough volume at 24 and 48 h at a measured 4 and 6 °C) would pin Tmin.
2. **Heat (owner priority).** No source gives dose against time at a dough temperature of 28–38 °C. The model rests on:
   - Salvadó's optimum;
   - E3's single source (You Knead Sourdough, a sourdough page; the logic is general);
   - two checks that disagree in direction: Pizzastunde is faster than the model, Suas and Finney are slower.

   Hot-kitchen practice cuts yeast 20–50 % against temperate doughs on the same schedule. The model cuts about 53 % at 30 °C (Roman 6.5 h, 30 vs 22 °C): 21 % from the activity curve and the rest from E3. If tropical bakers report under-proof, E3's 0.6 is the first constant to revisit (0.7–0.8 would match the anecdotes).
3. **Endpoint conversions.** No measured rise-against-time curve at a fixed dose. E3's "dose ∝ rise target" is derived, not measured.
4. **Salt, hydration, flour.** No factor without a source. The poolish/biga media carry salt and hydration implicitly. The flour tolerance multiplier (W) is unchanged.
5. **Large preferments** (> 35 %) and **fridge biga**: extrapolated (no dose data for a fridge-only biga; the model gives 0.6 % of biga flour for 48 h at 6 °C).
6. **Craig's original data** (pizzamaking.com) were unreachable; the old engine's curve could not be checked against them.

## 9. How to challenge it

- **Add a data point.** Add a row to `docs/yeast-model/DATASET.csv` (with its source, page or URL, endpoint and temperatures), map it in `fit/rows.py`, rerun the fit, and move the constants only if the hold-out and leave-one-source-out results improve.
- **When the constants change**, update `app/utils/yeastModel.ts`, this file, the About page section, and the fixture (`export_fixture.py`). `tests/yeast-model.test.cjs` fails until all four agree.
- **Kitchen trials** that would most improve the model:
  - dough volume against time for two doses at 21 °C (the endpoint conversion);
  - a measured fridge temperature with dough volume at 24 h and 48 h;
  - a 30–32 °C room-temperature dough with its dose and rise.

## 10. Reference recipes, before → after

The real engine (`calculateRecipe` on `buildSchedule`), `main` @ e5c7ccb vs this branch. Total = all instant yeast as a % of all flour (preferment and final dough together). Judged against the sources for that regime.

| Recipe | Before | After | Change | Poolish/biga (% of its flour) | Verdict |
|---|---|---|---|---|---|
| Thomas: 2 baguettes, 20 °C, 11 h poolish, then 4.8 h room + 10.25 h fridge | 0.073 % | 0.295 % | ×4.0 | 0.093 → 0.124; peaks at the mix (before: needed the #137 split) | **Better.** MP4/MB6 poolish 0.1–0.2 % at 12 h; Modernist poolish doughs add yeast to the final dough |
| Neapolitan, 12 h poolish at 22 °C, 26 h dough (24 h cold) | 0.027 % | 0.198 % | ×7.4 | 0.089 → 0.095; peak 10.1 → 12 h of 12 h | **Better.** MP4 Neapolitan with poolish, 36 h cold: 0.40 %. Before, the final dough had no yeast for a 26 h plan |
| Roman, 6.5 h, with 12 h poolish, 22 °C | 0.226 % | 0.294 % | ×1.3 | 0.067 → 0.095 | **Better** (poolish now in the books' row) |
| New York, 18 h fridge poolish (6 °C), 22 °C | 0.073 % | 0.285 % | ×3.9 | 0.242 → 0.395 | **Better.** Weekend Bakery fridge poolish 0.5 % at 18 h |
| Neapolitan direct, 32 °C kitchen, 26 h (two-phase, 22 h cold) | 0.070 % | 0.203 % | ×2.9 | — | **Better under E2** (Lehmann 0.375 %, Modernist 0.4–0.48 % with long cold). Weakly sourced at 32 °C |
| Neapolitan direct, 30 °C, 26 h | 0.073 % | 0.217 % | ×3.0 | — | as above |
| Roman direct, 30 °C, 6.5 h room only | 0.296 % | 0.126 % | ×0.43 | — | **Open (§8.2).** Hot-kitchen practice cuts 20–50 % versus temperate; the model cuts 53 % (0.265 % at 22 °C) |
| Neapolitan direct, 21 °C, 26 h (24 h cold) | 0.085 % | 0.158 % | ×1.9 | — | **Better.** Between the community tables (0.1–0.3 %) and the pros (0.23–0.48 %) |
| Neapolitan direct, 21 °C, 50 h (48 h cold) | 0.050 % (floor, budget 128 % "earlier") | 0.114 % | ×2.3 | — | **Better.** No longer floor-bound or flagged; community 0.08–0.125 %, pros 0.23–0.375 % |
| Emergency Neapolitan, 22 °C, 2.5 h | 1.5 % (ceiling, budget 51 % "later") | 1.12 % | ×0.75 | — | **Better.** Modernist emergency 0.8–1 % for 2.3 h at FDT 27 °C; now reachable within the ceiling |
| Pan pizza, 22 °C, 5 h | 1.08 % | 0.356 % | ×0.33 | — | **Better.** Sources at ~5 h, 21–22 °C: 0.2–0.65 % (median ≈ 0.47) |
| Baguette direct, 20 °C, 14 h (7 h cold) | 0.215 % | 0.233 % | ×1.08 | — | Same |
| Brioche (enriched), 22 °C, 10 h | 1 % fixed | 1 % fixed | — | — | Same (rule kept) |
| Roman direct, 18 °C, 8 h room only | 0.695 % | 0.250 % | ×0.36 | — | **Better**, at the low side. Sources at 8–12 h, 18–21 °C: 0.1–0.53 % |
| Roman, 45 % biga, 48 h fridge, 22 °C | 0.157 % | 0.540 % | ×3.4 | 0.349 → 0.612 | **Open (§8.5).** A fridge-only biga has no dose data |

No reference plan changed: schedules do not depend on the dose.

## 11. Plan sweeps

**Poolish planner sweep.** The harness from #137 mounts the real `SchedulePicker` in jsdom with a fixed clock (Wed 18 Nov 07:00 Paris):

- 6 poolish styles × kitchen 18–32 °C (8 values) × 3 bakes × storage auto/room/fridge × busy none/nights/nights+work = 1,296 plans;
- each run with the poolish time free, then pinned to main's free plan (set).

| | Free | Set |
|---|---|---|
| Plans identical to main | 1,121 | 1,280 |
| Changed | 175 | 16 |
| Valid on main / branch (none lost or gained) | 810 / 810 | 810 / 810 |
| Poolish past its peak at the knead (main: final-dough split; branch: `pastPeak`) | 350 → **0** | 358 → **0** |
| Set poolish time moved | — | 0 |
| Storage different from the baker's fixed choice | 45 → 45 (pre-existing on main) | 45 → 45 |
| Poolish % changed | 0 | 0 |
| Poolish dose under 0.1 g | 2 → 0 | 2 → 0 |
| Final dough has a yeast line | 350 → 1,296 | 358 → 1,296 |

**Every changed plan is the plan the engine made before #137's levers.** The same sweep on c7ec072 (the commit before #137) matches the branch on all 1,296 free plans.

- 152 "fridge" or "auto" plans get their longer poolish back (+0.25 to +7 h, same mix): #137 had shortened them because the leavening top-up over-ripened the poolish.
- 16 "auto" plans stay at room temperature: #137 had moved them into the fridge (Thomas's case).
- 7 "room" plans move by a quarter hour or two.

The levers stay in the code as a safety net; on these 2,592 plans they no longer act.

Total yeast for these plans, new/old (median, p10–p90), rises because the final dough now has its own yeast:

| Group | Median | p10–p90 |
|---|---|---|
| 18–20 °C, fridge poolish | ×2.1 | 0.8–3.1 |
| 18–20 °C, room poolish | ×2.4 | 1.0–3.9 |
| 22–26 °C, fridge poolish | ×1.5 | 0.9–2.9 |
| 22–26 °C, room poolish | ×3.3 | 1.5–5.4 |
| 28–32 °C, fridge poolish | ×2.8 | 1.2–4.0 |
| 28–32 °C, room poolish | ×4.6 | 1.1–6.4 |

**Engine sweep (no UI).** 5,940 plans and recipes:

- 10 styles × kitchen 16–38 °C × 3–72 h × fridge 3/6/8 °C, plus poolish and biga variants;
- main @ e5c7ccb vs this branch.

Results:

- **0 schedules changed.**
- Doses under 0.1 g: 51 → 0.
- Automatic dose at the 0.05 % floor: 854 → 551.
- At the 1.5 % ceiling: 306 → 0.
- "Ready earlier/later" budget notes: 1,394 → 726.

Total yeast new/old, medians:

| Group | ≤ 4 h | Room-temperature plans | Cold-retard plans |
|---|---|---|---|
| Direct dough, 19–27 °C | ×0.39 | ×0.48 | ×1.81 |
| Direct dough, ≤ 18 °C | ×0.52 | ×0.41 | ×1.87 |
| Direct dough, ≥ 28 °C | ×0.40 | ×1.00 | ×1.75 |

- Poolish doughs: ×0.7–4.9.
- Biga doughs: ×5.6–8.5, the largest change and the least documented (§8.5).
