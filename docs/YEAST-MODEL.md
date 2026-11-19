# The yeast model

19 Nov 2026, **Phase 3 refit 20 Nov 2026** · `app/utils/yeastModel.ts` · tests: `tests/yeast-model.test.cjs` · data and fit: `docs/yeast-model/` (Phase 3: `docs/yeast-model/fit3/`, report `fit3-report.txt`, plots `plots/`)

## In plain words

Baker Hub sizes commercial yeast (instant, active dry, fresh) with one model. It follows the dough's temperature through the plan, converts every hour into "what an hour at 25 °C would have done", and asks for the amount of yeast that brings the dough to its target rise at the bake.

Three things changed for bakers:

1. **A fridge mostly holds the dough.** An hour at 6 °C does about a tenth of an hour at 25 °C (the old engine counted fridge hours at 60–75 % of room-temperature hours). Doughs with a long cold retard get more yeast than before (about 2–3×), close to professional and book recipes (Modernist, Lehmann, Ooni), and the dough finishes rising at room temperature.
2. **Short doughs get less yeast, warm doughs less again.** The old curve was too steep in time (exponent 1.65), so 2–6 h doughs got 1.5–4× more yeast than any book. Above 30 °C yeast barely speeds up, but a warm dough is planned to a smaller rise, as hot-climate bakers do.
3. **A poolish or biga holds only its own yeast; the final dough gets its own.** The poolish now peaks at the mix by construction, and the final dough has a yeast line, as in every Modernist poolish recipe.

Every constant below is either published or fitted to named data with its residuals and its uncertainty. Phase 3 (§12) refitted every constant on 157 dose rows from 28 independent lineages plus 23 temperature and dose-ratio statements, with each source given its own level (sources differ by about ×1.9: how far their dough rises, their flour, their style). Inside a source the model follows the shape of its numbers within about ×1.4; held-out sources followed it within ×1.55 inside each source and ×2.0 overall (the source's own level is unknown in advance).

### Phase 3 in short (20 Nov 2026)

| | Phase 2 | Phase 3 | What it means |
|---|---|---|---|
| Biga medium M_b | 2.67 | **1.55** | 48 h fridge biga 0.61 → 0.27 % of biga flour; inside the biga sources |
| Warm-dough rise R | 0.6 (one source) | **0.76** (fitted ± 0.06) | 47 % less yeast at 30 °C than at 22 °C on the same 6.5 h plan (practice: 20–50 %) |
| A, b | 2.05, 1.24 | **1.41, 1.15** | Shallower in time; room-temperature 4–12 h sits at the middle of its sources (see below) |
| Tmin, Topt | −0.5, 32.3 (published) | **−3.2, 40** (fitted; Topt at its bound) | r(6 °C) 0.10 → 0.11; r(30 °C) 1.16 → 1.35 |
| Poolish M_p | 0.83 | **0.70** | 12 h poolish at 21 °C: 0.10 → 0.08 % of its flour |

**LOW CONFIDENCE** (fewer than three independent sources at credibility ≥ 0.6 in the regime; kitchen-trial priorities, §12.4): hot kitchens ≥ 28 °C (E3's R and the activity above 30 °C), the cold hold (Tmin, r at 4–8 °C), cool kitchens below 18 °C, and fridge poolish. Tmin and M_b also move by more than their own standard error with the weighting scheme (§12.3).

**Topt on its bound, and the level A** (§12.6–12.7): with a literature optimum (35 °C gas production, 32.3 °C growth) refitted, only warm room-temperature doughs move (up to 25 % less at 35 °C) and the hot cut overshoots practice (51 %, 55 % at 30 °C); the fitted 40 °C stays. The professional-only level would put every dose ×1.29 higher; the pre-registered 1.41 stays, and the first kitchen trial decides (§12.7).

**Room temperature 4–12 h "runs low"?** Not from b and not from the temperature curve: no residual trend against hours or temperature inside that regime. Its sources split into two groups about ×5 apart (Craig's tables, Modernist, My Pizza Night, Pizza Napoletana DOC above; the EU Neapolitan TSG, teigformel, pizzamateur, Biorito, Crust Kingdom below), and the split follows the yeast type: a fit on dry-yeast sources alone gives 0.25 % for 8 h at 20 °C, on fresh-yeast sources alone 0.14 %, all together 0.20 %. Either the fresh conversion (× 3) overstates fresh yeast in practice, or the fresh-yeast (mostly Italian Neapolitan) sources stop earlier. The model stays at the middle; this is open question §8.7.

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

| Constant | Value | Basis | Uncertainty (Phase 3: SE from the fit; lineage bootstrap 2.5–97.5 %, B = 40) |
|---|---|---|---|
| Tmax | 45.4 °C | (a) Salvadó et al. 2011, *Appl. Environ. Microbiol.* 77:2292, S. cerevisiae growth | — |
| Topt | 40 °C | (c) fitted; it sits at its 40 °C bound. The data stop at 35 °C dough and keep rising there (Istudor's 1 h gas tests to 39 °C, Pizzastunde at 35 °C, the Modernist 21/27 °C proof pairs). Fixing Salvadó's 32.3 °C fits clearly worse (objective 309.8 vs 263.7) and pushes R to 0.56. Below 35 °C the curve is what the data say; above it, it is extrapolation | SE 2.5; bound-limited |
| Tmin | −3.2 °C | (c) fitted (−3.21): cold-retard recipes, Lehmann, Nestec's measured gas rates 3–10 °C (US 5,827,724, baker's yeast in maltose). **LOW CONFIDENCE** | SE 0.63; bootstrap −4.1 to −2.4; equal weights −6.1, professional only −1.8; r(6 °C) 0.10–0.13 |
| A | 1.41 % | (c) fitted (1.409), anchored so that the dough sources' own levels average zero | SE of ln A 0.18; bootstrap 0.93–1.96 |
| b | 1.15 | (c) fitted (1.147); Finney 1976: 1.36, Phase 2: 1.24 | SE 0.06; bootstrap 1.00–1.24; professional only 1.26 |
| M_p, poolish | 0.70 | (c) fitted (0.704): 8 poolish lineages (MP4, MB6, Suas, Pezzetta, Weekend Bakery, Dissapore, fond.kitchen, The Dough Formula, biancolievito/Giorilli) | SE of ln 0.19; bootstrap 0.42–0.83 |
| M_b, biga | 1.55 | (c) fitted (1.549): 9 biga lineages (MB6 KM pp. 19, 22; Giorilli and biancolievito; Zaghini; fond.kitchen; Jordo's; Ooni; italianpizzasecrets; Burnhard; behindthecrust) | SE of ln 0.19; bootstrap 0.83–2.22; equal weights 1.17, professional only 3.21 (moves beyond its SE) |
| R in a warm dough | 0.76 | (c) fitted (0.762) to the hot-kitchen doses and statements (Finney 30 °C; Suas; Lehmann; Pizzastunde; TFL Mini Oven; My Pizza Night, fond.kitchen, pizzamateur "halve it" statements; Istudor rates). Phase 2 took 0.6 from one sourdough page. Practice: 20–50 % less yeast in heat beyond the speed-up. **LOW CONFIDENCE** (two strong lineages ≥ 28 °C) | SE 0.06; bootstrap 0.73–0.78; professional only 0.65 |
| R transition | 25 → 28 °C of dough temperature at the end of the plan | (a) You Knead Sourdough's two temperatures; smoothstep between them so no step | — |
| Fresh, active dry | × 3.0, × 1.33 of instant | (a) MB6 KM p. xi (prior sources: BAKERpedia/ASBE 2.86 and 1.43; Fleischmann's 1.25 for ADY). Every Phase 3 row records the type as the source states it; ambiguous "dry" or unstated types are read as instant, and reading them as active dry moves no constant beyond 0.1 SE (M_b 1.55 → 1.45) | ADY 1.25–1.5 across sources; fresh see §8.7 |
| Floor, ceiling | 0.05 %, 1.5 % | product limits (MP4 p. 38 uses 0.04 %; Modernist emergency doughs 0.8–1 %) | — |

Shipped values are the Phase 3 regime-weighted fit without the three flagged rows, rounded (A 1.41, b 1.15, Tmin −3.2, Topt 40, M_p 0.70, M_b 1.55, R 0.76). Phase 2 values (A 2.05, b 1.24, Tmin −0.5, Topt 32.3, M_p 0.83, M_b 2.67, R 0.6) and their basis are in §4–5, kept as the record.

## 3. Endpoints

ENDPOINTS.md (Phase 1) explains why published tables for the same time and temperature differ 3–10×: they stop the dough at different points. The model makes the endpoint explicit:

- **E1, dough ready ≈ doubled.** The reference for A and b: tables and recipes whose dough is ready to divide, shape or bake. No style in Baker Hub has a sourced rise target that differs from doubled (Forkish's tripled bulk and AVPN's fixed schedule are single recipes), so the per-style table is uniform: R = 1.
- **E2, a long cold retard holds the dough; it finishes at room temperature.** This is professional and hot-climate practice (Lehmann's 1–3-day doughs, Modernist's cold-proofed poolish doughs, da Michele's protocol in Singapore, Pizzastunde at 35 °C). The cold tail of r(T) is therefore fitted to those recipes and to Nestec's measured cold gas rates, not to the community tables that expect the dough to rise in the fridge (§5.3).
- **E3, a warm dough is used at a smaller rise.** R eases from 1 at 25 °C to 0.76 at 28 °C (fitted in Phase 3; 0.6 in Phase 2) of dough temperature at the end of the plan (the dough at the bake, from the path). A cold-retarded dough that warms for an hour in a 32 °C kitchen ends near 18 °C and keeps R = 1; a room-temperature dough in that kitchen ends near 32 °C and gets R = 0.76.
- **Preferments: ripe.** "The yeast has done as much fermenting as possible with the food available" (MP4 p. 2); "domed, just beginning to recede" (Suas). E3 does not apply to preferments.

## 4. Method (Phase 2; Phase 3 in §12)

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

## 5. Fit quality (Phase 2 constants; Phase 3 in §12)

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

1. **Cold (LOW CONFIDENCE).** Few measured points between 2 and 8 °C, none in dough. Phase 3: the community cold tables sit ×0.53 below the model even after each source's own level, while the measured and professional sources sit on it (professional-only fit: cold rows −0.00); letting the dough cool into the fridge more slowly (a free cooling time constant) halves that gap only at an unphysical 8 h, so it was not adopted. Home fridges run ±3 °C, and r doubles between 4 and 6 °C, so the fridge setting matters more than it used to. A kitchen trial (dough volume at 24 and 48 h at a measured 4 and 6 °C) would pin Tmin.
2. **Heat (owner priority; LOW CONFIDENCE).** Still no source gives dose against time at a dough temperature of 28–38 °C. Phase 3 fitted E3's R to the hot-kitchen evidence (0.76 ± 0.06) and freed Topt (it went to its 40 °C bound). On the app's Roman 6.5 h plan the model now cuts 47 % at 30 °C and 51 % at 32 °C against 22 °C (Phase 2: 53 %, 54 %): about 45 % from the activity curve and the rest from R. That is at the top of practice's 20–50 %. Two strong lineages only (Finney, Istudor); the rest are a summer pizzeria, a tropical forum baker and home-baking guides.
3. **Endpoint conversions.** No measured rise-against-time curve at a fixed dose. E3's "dose ∝ rise target" is derived, not measured.
4. **Salt, hydration, flour.** No factor without a source. The poolish/biga media carry salt and hydration implicitly. The flour tolerance multiplier (W) is unchanged.
5. **Large preferments** (> 35 %) and **fridge biga**. Phase 3 added Burnhard (48 h at an unstated fridge temperature), fond.kitchen (2.5 h + 46 h at 4–6 °C + 1.5 h), biancolievito and Zaghini (24 h at 4 °C, then 18 °C). The model gives 0.27 % of biga flour for the app's 48 h fridge biga (Phase 2 0.61 %). **Hold versus rise:** residuals of long bigas are positive (biga residual against ln hours: slope +0.27 ± 0.12), i.e. long bigas carry more yeast than a ripe-at-the-mix model asks. That is what a biga *held* in the fridge (Burnhard, the fond.kitchen fridge biga) rather than ripened looks like; with nine lineages and three strong ones it was reported, not modelled. The app always keeps a biga in the fridge, so Giorilli's 16 h at 18 °C biga is checked in the model (0.17 %, sources 0.10–0.33 %) and not reachable in a plan.
7. **Fresh against dry yeast.** At room temperature the fresh-yeast sources sit ×0.58 below the dry-yeast ones on the same schedules (§ Phase 3 in short). The × 3 conversion is the published one and was kept, as instructed; a trial with the same dough and schedule at 1 % fresh and 0.33 % instant would settle it.
6. **Craig's original data** (pizzamaking.com) were unreachable; the old engine's curve could not be checked against them.

## 9. How to challenge it

- **Add a data point.** Phase 3 rows live in `docs/yeast-model/fit3/newdata.py` (and, for the record, at the end of `DATASET.csv`, ids N…), with the yeast type exactly as the source states it, its conversion and its assumptions. Register its source in `fit3/registry.py` (lineage, tier, the regimes it tested, a one-line reason) **before** fitting. Rerun `cd docs/yeast-model/fit3 && NBOOT=40 python3 run3.py ..`, and move the constants only when the hold-out and the stopping rule (§12.1) are no worse.
- **When the constants change**, update `app/utils/yeastModel.ts`, this file, the About page section, and the fixture (`python3 export_fixture3.py ../../../tests/fixtures/yeast-model-data.json ../flagged.json`). `tests/yeast-model.test.cjs` fails until all four agree.
- **Kitchen trials**, in priority order (the LOW CONFIDENCE regimes):
  1. a 30–32 °C room-temperature dough: its dose, rise and time (E3's R and Topt);
  2. a measured fridge temperature (4 and 6 °C) with dough volume at 24 h and 48 h (Tmin);
  3. the same dough and schedule at 1 % fresh and 0.33 % instant at 20 °C (the fresh conversion, §8.7);
  4. a fridge poolish at a measured temperature, 12 and 18 h, with its dose and dome;
  5. dough volume against time for two doses at 21 °C (the endpoint conversion).

## 10. Reference recipes: main → Phase 2 → Phase 3

The real engine (`calculateRecipe` on `buildSchedule`): `main` @ e5c7ccb, Phase 2 @ f40e8f2, Phase 3 (this commit). Total = all instant yeast as a % of all flour (preferment and final dough together); the preferment column is its own dose as a % of its own flour. Script: `S/yeastmodel/ref/refs.cjs` (scratch; the cases are listed in the table).

| Recipe | main | Phase 2 | Phase 3 | Preferment main → P2 → P3 | Against the sources |
|---|---|---|---|---|---|
| Thomas baguette, 20 °C, 11 h poolish (fresh) | 0.073 % | 0.295 % | 0.251 % | 0.093 → 0.124 → 0.096 | Poolish 11 h at 20 °C: sources 0.067–0.15 % at 11–13 h (MB6, Dissapore, fond.kitchen, Weekend Bakery). **Better than main**; slightly less than Phase 2 |
| Neapolitan, 12 h poolish at 22 °C, 26 h dough | 0.027 % | 0.198 % | 0.170 % | 0.089 → 0.095 → 0.072 | Poolish in the 12–14 h row (0.067–0.15 %); total below MP4's 0.40 % with 36 h cold. **Better than main** |
| Roman (RT 6 h) with 12 h poolish, 22 °C | 0.226 % | 0.294 % | 0.243 % | 0.067 → 0.095 → 0.072 | Same |
| New York, 18 h fridge poolish (6 °C), 22 °C | 0.073 % | 0.285 % | 0.222 % | 0.242 → 0.395 → 0.258 | Weekend Bakery fridge poolish 0.5 % at 18 h (fridge temperature unstated): within ×2. LOW CONFIDENCE regime |
| Neapolitan direct, 32 °C kitchen, 26 h | 0.070 % | 0.203 % | 0.171 % | — | Lehmann 0.375 %, Modernist 0.4–0.48 % with long cold; community 0.1–0.3 %. **Better than main**; LOW CONFIDENCE |
| Neapolitan direct, 30 °C kitchen, 26 h | 0.073 % | 0.217 % | 0.180 % | — | as above |
| Roman direct, 30 °C kitchen, 6.5 h | 0.296 % | 0.126 % | 0.117 % | — | 47 % less than at 22 °C (0.221 %): practice 20–50 %. **Better than Phase 2** (53 %) |
| Neapolitan direct, 21 °C, 26 h (24 h cold) | 0.085 % | 0.158 % | 0.140 % | — | Community 0.1–0.3 %, pros 0.23–0.48 %. **Better than main** |
| Neapolitan direct, 21 °C, 50 h (48 h cold) | 0.050 % | 0.114 % | 0.098 % | — | Community 0.08–0.125 %, pros 0.23–0.375 %. **Better than main** (not floor-bound) |
| Emergency Neapolitan, 22 °C, 2.5 h | 1.500 % | 1.120 % | 0.852 % | — | Modernist emergency 0.8–1 % for 2.3 h at FDT 27 °C: inside. **Better** |
| Pan pizza, 22 °C, 5 h | 1.078 % | 0.356 % | 0.289 % | — | Sources at ~5 h, 21–22 °C: 0.2–0.65 %. Inside |
| Baguette direct, 20 °C, 14 h | 0.215 % | 0.233 % | 0.205 % | — | Same |
| Brioche (enriched), 22 °C, 10 h | 1.000 % | 1.000 % | 1.000 % | — | Same (rule kept) |
| Neapolitan direct, 18 °C, 8 h RT only | 0.695 % | 0.250 % | 0.220 % | — | Sources at 8–12 h, 18–21 °C: 0.09–0.53 %; model at their middle (dry-yeast sources alone: about 0.30 %). Lower than Phase 2; see §8.7 |
| Roman direct, 20 °C, 8 h RT only | 0.578 % | 0.223 % | 0.194 % | — | Sources at ~8 h, 20–22 °C: 0.09 (teigformel) – 0.53 % (Pizza Napoletana DOC); median of lineages ≈ 0.2 %. Inside, middle |
| Baguette direct, 21 °C, 12 h (the plan takes 5.25 h cold) | 0.260 % | 0.231 % | 0.205 % | — | Mixed plan, 6 h room + 5.25 h cold: between the room and cold rows |
| Biga 45 %, 16 h at 18 °C, Roman | 0.618 % | 0.996 % | 0.633 % | 1.375 → 1.500 → 0.798 | The app keeps a biga in the fridge, so this is a 16 h fridge biga (0.80 % of biga flour). The model's 16 h at 18 °C biga: 0.17 % (Giorilli/Zaghini 0.33 %, fond 0.10 %). **Better than Phase 2** |
| Biga 45 %, 48 h fridge, Roman, 22 °C | 0.157 % | 0.540 % | 0.342 % | 0.349 → 0.612 → 0.267 | Burnhard 0.33 % (48 h, fridge), fond.kitchen 0.10 % (46 h at 4–6 °C): inside. **Better than Phase 2** (0.61 %, above every source) |

No reference plan changed between the three: schedules do not depend on the dose. No reference recipe is worse than main against its sources; against Phase 2, the 18–20 °C room-temperature doughs are 11–13 % lower (the yeast-type split, §8.7) and the 11 h poolish 23 % lower (still inside its sources).

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


**Phase 3 rerun (20 Nov 2026).** The same harnesses on the Phase 3 constants:

- **Poolish planner sweep:** all 1,296 free plans identical to Phase 2 (so 1,121 identical to main, 175 changed, every change the pre-#137 plan); set plans identical to Phase 2 (the 10 that differed in the loaded parallel run were rerun alone at the same settle time and all matched Phase 2). Poolish past its peak at the knead: 0. Poolish under 0.1 g: 0. Valid plans 810 / 810.
- Total yeast against Phase 2 (median): fridge poolish ×0.77–0.80, room poolish ×0.80–0.87 (M_p 0.83 → 0.70 and the lower dough law).
- **Engine sweep**, 5,940 plans: **0 schedules changed** (against main and Phase 2). Doses under 0.1 g: 0. At the 0.05 % floor: main 854, Phase 2 551, Phase 3 592 (long warm room-temperature doughs). At the 1.5 % ceiling: 0. "Ready earlier/later" notes: main 1,394, Phase 2 726, Phase 3 757.

| Total yeast, Phase 3 / Phase 2 (median) | ≤ 4 h | Room-temperature plans | Cold-retard plans |
|---|---|---|---|
| Direct dough, 19–27 °C | ×0.78 | ×0.88 | ×0.87 |
| Direct dough, ≤ 18 °C | ×0.81 | ×0.91 | ×0.87 |
| Direct dough, ≥ 28 °C | ×0.86 | ×1.00 (floor) | ×0.87 |
| Poolish doughs | | ×0.74–0.92 | ×0.78–0.86 |
| Biga doughs | | ×0.51–0.52 | ×0.59–0.63 |

**Tests (Phase 3).** Unit 819/819; tsc and i18n clean; round trips, closing levain, feasible fallback, fridge starter, peak consistency (172 cases, 0 violations), starter %, levain raise, path independence (200 cases, 0 failures) and the closing grid pass. Mobile (iPhone 390, Chromium): 255 of 280 pass; the 24 that fail also fail on main @ e5c7ccb, rerun the same day (stale navigation, header, sandwich and fermentation specs; none touch the yeast amounts). The 25th, the poolish-peak recipe amounts (final dough 2.6 → 2.2 g, whole 2.8 → 2.4 g), was updated and passes.

Against main, biga doughs are now ×2.9–4.8 (median; Phase 2 ×5.6–8.5) and direct cold-retard doughs ×1.6.

## 12. Phase 3 refit (20 Nov 2026)

Owner's brief (19 Nov 2026): find more sources and a generalised formula, without chasing any one source; know each source's yeast type; fix the three Phase 2 weaknesses (biga too high, E3 cutting too much in heat, room temperature 4–12 h low). Scripts, registry, data and reports: `docs/yeast-model/fit3/`, `fit3-report.txt`, `fit3-results.json`, `flagged.json`, `plots/`.

### 12.1 Pre-registered before fitting

- **Sources** (`fit3/registry.py`). Every source has a **lineage** (copies of one table count once: dough.school, the secondhand Craig chart and Crust Kingdom are one Craig lineage; biancolievito restates Giorilli; Modernist Pizza and Modernist Bread are one), a **credibility tier** (1.0 measured; 0.8 professional tables; 0.6 manufacturer; 0.4 recipe sites and calculators; 0.2 forum and anecdote) and the **regimes it tested or specialises in**, with a one-line reason. Outside those regimes a source drops one tier. A row's weight is that tier divided by the rows of its lineage.
- **Hold-out** (`fit3/holdout3.py`, seed 20261120): 25 % of the lineages, never Modernist or Nestec, keeping three biga and three cold lineages and two hot ones in the fit, and at least one biga and one cold lineage held out: Baking Steel, Lehmann, Pezzetta, PizzApp, Pizza Napoletana DOC, Weekend Bakery, italianpizzasecrets.
- **Outliers**: none removed by hand. Rows beyond 3 robust SD of the offset-corrected residuals are flagged, kept in the data with the reason, and the fit is shown with and without them.
- **Stopping rule** (owner, 20:16): held-out within about ×1.8; no residual trend against temperature, hours or regime; no reference recipe worse than today's app without evidence; biga, hot kitchen and room temperature 4–12 h each inside their sources' range; then stop.

### 12.2 Data added

35 dose rows from 11 sources (8 new to the dataset: biancolievito, Zaghini/Scatti di Gusto, italianpizzasecrets, Burnhard, behindthecrust, pizzamateur.fr, teigformel.de, agricolaconforti.it; new rows from Ooni, fond.kitchen and Jordo's), and 23 statements (9 dose ratios, 8 time ratios, 6 measured rates) from 13 sources, 4 of them new (technomitron/AAINB, Istudor et al. 2020, Reinhart quoted on Forno Bravo/TFL, Bake Magazine). The Phase 1–2 rows Phase 1 had set aside (dough.school, the Craig chart, the community cold tables, Pizza Napoletana DOC's fridge column, Weekend Bakery's fridge poolish) are back in, at their tier and lineage weight, so the outlier rule rather than a judgement decides.

| Added rows | Room 18–27 °C | Cold | Poolish | Biga |
|---|---|---|---|---|
| Fresh (÷ 3) | 10 | 5 | 5 | 6 |
| Instant | — | — | — | 5 |
| Ambiguous "dry" or unstated (read as instant; active-dry reading in the sensitivity run) | — | — | — | 4 |

All 157 rows by stated type: instant/IDY 93, fresh (CY) 60, unstated 3, "dry" 1. Not used, with reasons (`newdata.py` `NOT_USED`): a page that says it was written by AI without review; two pages search could not find; three without time-specific numbers; and no manufacturer (Lesaffre, Lallemand, AB Mauri, Fermipan) or German/Japanese/South-East Asian school table with time and temperature was reachable this session, so tier 0.6 is empty.

### 12.3 Model and fit

Unchanged structure: `ln dose = ln A + ln M + ln R(T_end) − b ln Heq + u_source + e`. Each source has its own offset u (its endpoint, flour and style), drawn from N(0, τ²) and profiled out; A is anchored so that the dough sources' offsets average zero; Tmin, Topt, b, M_p, M_b and R are fitted together with A. The statements carry no offset; time and rate ratios enter as 1.2 × ln(ratio) (a fixed scale, so they cannot reward a small b).

**Spread.** Shape residual σ = 0.32 (×1.38), source spread τ = 0.62 (×1.87). Most of the disagreement between sources is level, not shape (`plots/c-before-after-offsets.png`; the collapse in `plots/a-collapse.png`).

**Weighting schemes** (flagged rows excluded):

| Scheme | A | b | Tmin | M_p | M_b | R |
|---|---|---|---|---|---|---|
| Equal weights (lineage only) | 1.59 | 1.18 | −6.1 | 0.61 | 1.17 | 0.76 |
| Credibility tier | 1.38 | 1.15 | −3.8 | 0.72 | 1.43 | 0.75 |
| Measured + professional only | 2.11 | 1.26 | −1.8 | 0.84 | 3.21 | 0.65 |
| **Tier × regime (shipped)** | **1.41** | **1.15** | **−3.2** | **0.70** | **1.55** | **0.76** |

**The owner should know:** Tmin moves beyond its own SE (0.63) under every other scheme, and M_b moves beyond its SE with equal weights and with professionals only (to 3.2: Giorilli, Zaghini and Modernist's bigas carry about twice the yeast the recipe sites do). b and R move beyond their SE only with professionals only (1.26, 0.65). Topt stays at its bound throughout. These are the parameters to which the evidence is least robust, hence LOW CONFIDENCE for the cold and the hot regimes.

**Coverage per regime** (independent lineages; at tier ≥ 0.6 after the regime rule):

| Regime | Lineages | At tier ≥ 0.6 | |
|---|---|---|---|
| Room 18–27 °C | 14 | 3 (Modernist, Forkish, EU TSG) | |
| Cool < 18 °C | 2 | 0 | **LOW CONFIDENCE** |
| Hot ≥ 28 °C | 9 | 2 (Finney, Istudor) | **LOW CONFIDENCE** |
| Cold (mostly fridge) | 12 | 2 (Nestec, Lehmann) | **LOW CONFIDENCE** |
| Biga | 9 | 3 (Modernist, Giorilli, Zaghini) | |
| Poolish, room | 8 | 3 (Modernist, Suas, Pezzetta) | |
| Poolish, fridge | 1 | 0 | **LOW CONFIDENCE** |

**Structure tests** (objective, lower is better; shipped 263.7): Topt fixed at Salvadó's 32.3 °C 309.8 (R falls to 0.56); no E3 (R = 1) 280.3; Phase 2's R = 0.6 286.6; a curvature term in ln Heq 261.2 (c = −0.02: not needed); ambiguous dry types read as active dry 262.7 (no constant moves beyond 0.1 SE); a free fridge cooling time constant 249.4 but at its 8 h bound (unphysical for a dough ball; professional-only it goes to 0.6 h), not adopted.

**Outliers.** Three rows beyond 3 robust SD (0.48): D021 dough.school 2 h + 70 h at 4 °C, 0.05 % (−1.51); D050 Biorito 24 h at 5 °C, 0.017 % (−1.95); N026 pizzamateur 72 h at 4 °C, 0.013 % (−1.62). All three are community fridge rows at the longest times, where the dough is meant to rise in the fridge. With them: A 1.41, b 1.15, Tmin −3.55, M_b 1.57, R 0.755: no constant moves beyond 0.6 SE.

### 12.4 Validation

| Check | Result |
|---|---|
| Held-out lineages, new source (no offset), 22 rows | rms 0.705 (×2.02), bias +0.49, 14 of 22 within ×2. The expected total for a new source is √(σ² + τ²) = ×2.05: the miss is the source's own level |
| Held-out, inside each source (shape) | rms 0.441 (×1.55) |
| Residual trend vs room temperature (all, room only) | none (slopes within 1 SE) |
| vs ln hours | overall −0.065 ± 0.026 (a regime-mix effect); none inside room, cold or poolish; biga +0.27 ± 0.12 (hold versus rise, §8.5) |
| vs cold share | −0.18 ± 0.07: the community cold tables (§8.1) |
| Mean residual by regime after offsets | room +0.11, hot +0.30, cold −0.64, biga −0.16, poolish +0.01, fridge poolish −0.12 |
| By stated yeast type after offsets | instant/IDY −0.02, CY −0.06, fresh −0.12 (the fresh level difference sits in the source offsets, §8.7) |
| Statements | rate and time ratios within ±0.32 except Nestec 7 and 10 °C (−0.60, −0.69: the model is faster than the patent's thresholds) and Pizzastunde's "halve it at 35 °C" (−1.27) |

The stopping rule: held-out shape ×1.55 meets ×1.8; the new-source total (×2.02) does not and cannot by shape alone (τ is between sources). Residual trends remain against cold share (community cold tables) and in biga hours; both are reported, not chased. Biga (0.27 % at 48 h fridge; 0.17 % at 16 h, 18 °C), hot kitchen (47 % less at 30 °C) and room 4–12 h (0.20 % at 8 h, 20 °C) are inside their sources' ranges. No reference recipe is worse than main (§10).

**Lineage bootstrap** (B = 40, 2.5 / 50 / 97.5 %): b 1.00 / 1.14 / 1.24 · Tmin −4.1 / −3.1 / −2.4 · R 0.73 / 0.76 / 0.78 · A 0.93 / 1.43 / 1.96 · M_p 0.42 / 0.69 / 0.83 · M_b 0.83 / 1.43 / 2.22 · 8 h at 20 °C 0.16 / 0.20 / 0.25 % · 30 vs 22 °C dose ratio 0.48 / 0.50 / 0.54 · 2 h + 46 h at 6 °C + 2 h 0.10 / 0.13 / 0.15 % · biga 48 h fridge 0.20 / 0.32 / 0.48 % · poolish 12 h at 21 °C 0.05 / 0.08 / 0.10 % · r(6 °C) 0.10 / 0.11 / 0.13.

### 12.5 Plots

- `plots/a-collapse.png`: every row on one curve after its source's offset, by regime and yeast type;
- `plots/b-residuals.png`: residuals against room temperature, hours, cold share and regime;
- `plots/c-before-after-offsets.png`: the collapse before and after source offsets;
- `plots/d-old-vs-new.png`: main (Craig v1.1), Phase 2 and Phase 3, room temperature 18–30 °C and the cold path, dough and biga.

### 12.6 Topt on its bound: the hot-kitchen doses with a literature optimum

Topt went to its 40 °C bound. Two literature optima were tried instead, each with every other constant refitted (regime weights, flagged rows out):

- **35 °C, gas production.** Short gas tests keep rising past 30 °C: Istudor et al. 2020 (1 h tests, already in the data) measure +8 % at 33, +22 % at 36 and +52 % at 39 °C against 30 °C; a 70-minute respirometer study (UBC *Expedition*, student journal) finds the highest rate at its warmest point, 35 °C, of 25/30/35. No source reachable this session puts a dough fermentation optimum at 35–38 °C explicitly, so 35 °C is the lower end of what gas production supports. Refit: A 1.41, b 1.14, Tmin −2.0, M_p 0.72, M_b 1.60, **R 0.65**; objective 283.0 (shipped 263.7).
- **32.3 °C, growth** (Salvadó et al. 2011, the Phase 2 value). Refit: A 1.41, b 1.12, Tmin −1.0, M_p 0.72, M_b 1.65, **R 0.56**; objective 309.8.

With a lower Topt the fit pushes R down to keep the hot doses where the data are, so the hot-kitchen doses move less than the curve itself:

| Recipe (total instant yeast % of flour) | main | Phase 3 (Topt 40) | Topt 35 | Topt 32.3 | Pro level, shipped shape (A 1.82) | Professional + measured fit |
|---|---|---|---|---|---|---|
| Thomas baguette, 20 °C, 11 h poolish (fresh) | 0.073 | 0.251 | 0.246 | 0.239 | 0.326 | 0.347 |
| Neapolitan, 12 h poolish at 22 °C, 26 h dough | 0.027 | 0.170 | 0.169 | 0.166 | 0.221 | 0.229 |
| Roman (RT 6 h) with 12 h poolish, 22 °C | 0.226 | 0.243 | 0.244 | 0.244 | 0.316 | 0.311 |
| New York, 18 h fridge poolish (6 °C), 22 °C | 0.073 | 0.222 | 0.223 | 0.219 | 0.289 | 0.339 |
| Neapolitan direct, 32 °C kitchen, 26 h | 0.070 | 0.171 | 0.170 | 0.167 | 0.222 | 0.234 |
| Neapolitan direct, 30 °C kitchen, 26 h | 0.073 | 0.180 | 0.180 | 0.178 | 0.234 | 0.251 |
| Roman direct, 30 °C kitchen, 6.5 h | 0.296 | 0.117 | 0.108 | 0.100 | 0.153 | 0.120 |
| Neapolitan direct, 21 °C, 26 h (24 h cold) | 0.085 | 0.140 | 0.138 | 0.135 | 0.181 | 0.185 |
| Neapolitan direct, 21 °C, 50 h (48 h cold) | 0.050 | 0.098 | 0.099 | 0.099 | 0.128 | 0.132 |
| Emergency Neapolitan, 22 °C, 2.5 h | 1.500 | 0.852 | 0.833 | 0.816 | 1.103 | 1.228 |
| Pan pizza, 22 °C, 5 h | 1.078 | 0.289 | 0.289 | 0.290 | 0.375 | 0.374 |
| Baguette direct, 20 °C, 14 h | 0.215 | 0.205 | 0.201 | 0.194 | 0.267 | 0.275 |
| Brioche (enriched), 22 °C, 10 h | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| Neapolitan direct, 18 °C, 8 h RT only | 0.695 | 0.220 | 0.215 | 0.209 | 0.285 | 0.282 |
| Roman direct, 20 °C, 8 h RT only | 0.578 | 0.194 | 0.192 | 0.189 | 0.252 | 0.244 |
| Baguette direct, 21 °C, 12 h RT | 0.260 | 0.205 | 0.200 | 0.193 | 0.266 | 0.270 |
| Biga 45 %, 16 h at 18 °C, Roman | 0.618 | 0.633 | 0.639 | 0.634 | 0.821 | 1.035 |
| Biga 45 %, 48 h fridge, Roman, 22 °C | 0.157 | 0.342 | 0.349 | 0.354 | 0.443 | 0.670 |
| Hot 28: Roman direct, 28 °C, 6.5 h | 0.408 | 0.128 | 0.116 | 0.106 | 0.167 | 0.133 |
| Hot 32: Roman direct, 32 °C, 6.5 h | 0.246 | 0.108 | 0.103 | 0.098 | 0.141 | 0.110 |
| Hot 35: Roman direct, 35 °C, 6.5 h | 0.172 | 0.098 | 0.097 | 0.096 | 0.127 | 0.097 |
| Hot 28: Neapolitan direct, 28 °C, 26 h | 0.077 | 0.172 | 0.172 | 0.170 | 0.223 | 0.237 |
| Hot 35: Neapolitan direct, 35 °C, 26 h | 0.062 | 0.126 | 0.108 | 0.094 | 0.164 | 0.147 |
| Hot 30: Pan pizza, 30 °C, 5 h | 0.451 | 0.161 | 0.147 | 0.135 | 0.210 | 0.170 |
| Hot 30: Roman with 4 h poolish, 30 °C | 0.152 | 0.160 | 0.157 | 0.155 | 0.208 | 0.182 |
| Roman direct, 22 °C, 6.5 h | 0.708 | 0.221 | 0.222 | 0.222 | 0.287 | 0.280 |
| **Less yeast at 30 °C than at 22 °C, Roman 6.5 h** (practice 20–50 %) | 58 % | 47 % | 51 % | 55 % | 47 % | 57 % |

**Does any recipe move materially?** Only the warm room-temperature doughs: at 28–35 °C, Topt 35 gives 1–14 % less than Topt 40, Topt 32.3 gives 2–25 % less (largest: Neapolitan at 35 °C, 0.126 → 0.094 %; Roman 28 °C, 0.128 → 0.106 %). Temperate, cold, poolish and biga recipes move by 6 % or less. Both literature optima fit worse and cut more than practice's 50 % at 30 °C (51 % and 55 %). The fitted 40 °C stays; above 35 °C it is extrapolation (the data stop there).

### 12.7 The level A: regime-weighted 1.41 or the professional level

| Level | How it is set | Effect |
|---|---|---|
| **1.41 (shipped)** | Pre-registered: every dough source with its own offset, offsets average zero, tier × regime weights | the reference column above |
| 1.82 | Professional + measured sources only, shape held at the shipped one | ×1.29 on every recipe |
| 2.11 | Professional + measured fit with its own shape (b 1.26, Tmin −1.75, M_b 3.2, R 0.65) | ×1.05–1.95 (biga most); not a level change alone |

Evidence for a higher level:

- the held-out lineages use ×1.63 the model (bias +0.49): Pizza Napoletana DOC's 12 rows (+0.50) and Baking Steel's single row (+1.50) carry most of it; per held-out lineage the mean is +0.45, against an expected spread of τ/√7 = 0.24 for seven new sources (about 1.9 SE);
- the professional and measured dough sources sit +0.25 (×1.28) above the shipped level on average (EU TSG −1.00, Forkish −0.05, Modernist +0.36, Lehmann +0.39, Finney +1.53; five lineages, SE about 0.28);
- dry-yeast sources alone give 0.25 % for 8 h at 20 °C against 0.20 % (§8.7).

Evidence against: each of the three is 1–2 SE and two of them hinge on one or two sources (Finney's optimised 30 °C test bakes; Baking Steel); the professionals themselves span ×12 (TSG to Finney); and the pre-registered rule set A from all E1 sources before any fit was run.

**Recommendation: keep 1.41** for now. It is the pre-registered estimate and no alternative is more than about 2 SE away. The three hints all point the same way (about ×1.25–1.3 for instant-yeast bakers), so the owner's first kitchen trial (§9, the 20 °C fresh-against-instant dough) also decides the level: if an 8 h, 20 °C instant-yeast dough at 0.20 % is under-proofed at the bake, move A to 1.82 (shape unchanged; the tests and the About page follow the constant). This is the owner's decision; no constant was changed for it.
