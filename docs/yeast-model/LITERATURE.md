> Phase 1 evidence base of the yeast model (19 Nov 2026), kept with `docs/YEAST-MODEL.md`. Paths beginning `S/` were working files of that research session and are not in the repository; the numbers they produced are quoted here, and the data points are in `DATASET.csv` beside this file.

# Yeast model, phase 1: literature review

19 Nov 2026. Research only: no engine code was changed. The engine was read at `main` @ `d72254d`.

Everything here was read in this session, or in the 19 Nov poolish pass (`S/poolish/SOURCES.md`), which is marked *prior pass*. Book pages were read in the owner's PDFs. MP4 means Modernist Pizza Vol. 4 Kitchen Manual (book page + 8 = PDF page). MB6 means Modernist Bread Vol. 6 Kitchen Manual (book page + 16 = PDF page). The data points are in `DATASET.csv` (202 rows). The numbers computed below are in `S/ym_work/analysis.txt`, produced by the scripts in `S/ym_work/scripts/`.

**Access limits (stated, not worked around).**
- **pizzamaking.com is blocked.** The proxy refuses CONNECT, and the fetch tool fails. So Craig's (TXCraig1) thread 26831, his charts, BeanAnimal's posts and the cold-fermentation threads were **not read**. Craig appears below only through secondary descriptions, which are labelled as such.
- **Reddit cannot be reached.** It is not on the fetch allowlist, and the search proxy rejects reddit-restricted queries. The search results pointed only at redlib mirrors, which were not used.
- **Facebook and Instagram** text was not reachable.
- **Full-text journal pages are mostly unreadable.** PMC shows a reCAPTCHA interstitial, ASM and ResearchGate fail, and Europe PMC is not allowlisted. Peer-reviewed numbers therefore come from abstracts, catalogue records and open copies. Each is labelled.
- **Books other than the two Modernist manuals were not available.** These are Suas, Hamelman, Calvel, Reinhart, Giorilli, Wing & Scott, Cauvain and Figoni. They are cited only where a reachable page quotes them; nothing is taken from memory.

## 0. What the engine does today (code-confirmed)

From `app/utils.ts` (lines 47–116 and 2060–2077):

- **Room temperature (RT):** IDY% = 9.5 / (h^1.65 · 2.5^((T−25)/10)) ÷ tropical.
- **Tropical factor:** ÷1.15 at 30–32.9 °C, ÷1.25 at ≥ 33 °C, held above 35 °C. The code comment calls it a "product allowance for faster dough breakdown in the heat, not a microbial growth coefficient".
- **Cold:** IDY% = 7.5 / h^1.313 ÷ 2^((Tf−4)/10).
- **Multi-phase:** `fermentationBudget` = t_RT·(d·w)^(1/1.65) + t_cold·(d·c)^(1/1.313) = 1, run over a cooling/warming exposure.
- **Dose limits:** floor 0.05 %.
- **Sugar:** at ≥ 10 % sugar, a fixed enriched dose of 1 % IDY applies. Above 5 % sugar there is only an `osmoticStress` warning.

Two points differ from the brief:
1. The "+20 % osmotic above 2 % sugar" rule is gone. Code comment: "A universal 20% dose increase at 2% flour-basis sugar isn't warranted."
2. "Definition B (70–80 % of max rise)" does not appear anywhere in the repository. I found no endpoint definition in code or docs.

Two findings about the current constants matter for everything below:
- **The RT law reproduces the dough.school table.**
  - 4–12 h at 20–25 °C: every cell within ±5 % of `rt()`.
  - 24 h: 1.00 at 25 °C, 1.26 at 20 °C.
  - 30 °C: +9 to +32 %, where the tropical divisor acts.
  - 48–72 h: the table sits 25–58 % above the law (DATASET D001–D019).
  - dough.school names no source, model, author or endpoint.
- **The "2.5 per 10 °C" is a dose Q10, not a time Q10.** At a fixed dose, h ∝ 2.5^(−ΔT/16.5). So the engine's time-to-ready Q10 is 2.5^(1/1.65) = **1.74**. For the cold law, 2^(1/1.313) = **1.69**. Comparisons with "fermentation doubles every X degrees" rules must use 1.74, not 2.5.

## 1. Temperature dependence of S. cerevisiae

### 1a. Growth: cardinal temperatures

| Source | Tmin | Topt | Tmax | Notes |
|---|---|---|---|---|
| Salvadó et al. 2011, *Appl. Environ. Microbiol.* 77:2292 (abstract via SGD) | 1.3–4.3 °C across the genus | **32.3 °C** (S. cerevisiae) | **45.4 °C** | 27 strains; CTMI (Rosso) fitted to growth curves. Full table not readable (PMC captcha). |
| Zakhartsev et al. 2015, *J. Thermal Biol.* 52:117 (ScienceDirect abstract) | ≈ 3 °C | ≈ 30–33 °C | ≈ 42 °C | Anaerobic glucose-limited batches, 5–40 °C. Maintenance cost jumps 12-fold between 31 and 33 °C, which suppresses μmax above ~31 °C. |
| Rosso, Lobry & Flandrois 1993, *J. Theor. Biol.* 162:447 | — | — | — | The CTMI equation, verified in the rTPC source: r = rmax·(T−Tmax)(T−Tmin)² / {(Topt−Tmin)[(Topt−Tmin)(T−Topt) − (Topt−Tmax)(Topt+Tmin−2T)]}. |
| Ratkowsky 1983 square-root model | — | — | — | √r = b(T−Tmin). Only the form was checked (Wolfram demonstrations; Scribd copy not read). No S. cerevisiae dough fit was found. |

CTMI relative to 25 °C, with Salvadó's Topt/Tmax and Tmin = 3 °C (Tmin = 0 in brackets):

| °C | 4 | 6 | 10 | 15 | 20 | 21 | 28 | 30 | 32 | 35 | 38 | 40 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTMI | 0.004 (0.04) | 0.03 (0.09) | 0.16 (0.23) | 0.41 (0.48) | 0.72 | 0.78 | 1.13 | 1.18 | 1.21 | 1.17 | 1.02 | 0.85 |
| Engine `2.5^((T−25)/10)` × tropical (a **dose** factor) | 0.15 | 0.18 | 0.25 | 0.40 | 0.63 | 0.69 | 1.32 | 1.82 | 2.18 | 3.13 | 4.11 | 4.94 |
| Engine as a **time** factor (dose factor^(1/1.65)) | 0.31 | 0.35 | 0.43 | 0.57 | 0.76 | 0.80 | 1.18 | 1.44 | 1.60 | 1.99 | 2.36 | 2.63 |

Reading: between 18 and 27 °C the engine (time) and the CTMI agree within about 5 %. Below 12 °C the CTMI falls far faster. Above 28 °C the CTMI flattens and turns down at 35 °C, while the engine keeps accelerating. Its tropical divisor makes that worse.

### 1b. Fermentation (CO₂ per cell) is not growth

| Source | What it shows |
|---|---|
| Bake Magazine, "The science of fermentation" (no author or date) | "a 1°C rise in dough temperature will accelerate yeast activity by about 10 percent", which is a time Q10 ≈ 2.6. Optimum 32–40 °C; maximum gassing 40–45 °C; bakeries ferment at 23–30 °C. |
| Istudor, Voicu, Muscalu & Tudor 2020, *E3S Web Conf.* 180:03012 | Dough with 3 % compressed yeast, 1.8 % salt, 53 % water; 1 h proving. CO₂ relative to 30 °C: 33 °C +7.9 %, 36 °C +21.6 %, 39 °C +52 %. Conference paper; their two setups disagree by 10× in absolute ppm. |
| Janssens et al., UBC student paper (YPD medium) | CO₂ per cell: 25 °C 1.66, 30 °C 2.31, 35 °C 3.02 ×10⁻⁹ mL, so Q10 ≈ 1.8 between 25 and 35 °C. Growth peaked at 30 °C, CO₂ at 35 °C. Low grade. |
| Nestec SA, US 5,827,724 (priority 1990; Google Patents text) | Normal commercial yeast (LBB) in 2 % maltose medium: > 40 mL CO₂/g pressed yeast after 6–7 d at 3–5 °C, 5–6 d at 5–9 °C, 3–4 d at 10 °C; > 20 mL/g after ~4 h at 30 °C. Implied rate relative to 30 °C: 4 °C ≈ 0.05, 7 °C ≈ 0.06, 10 °C ≈ 0.10, i.e. ≈ 0.085 and 0.16 of a 25 °C rate. **The only quantitative low-temperature fermentation data found.** |
| Nestec SA, US 5,776,526 | LTI strains: < 3–12 mL/h/kg dough at 3–12 °C; the claims allow < 15 mL/h/kg at ≤ 8 °C. Control values are only in the figures. |
| Figoni, *How Baking Works* (ckbk excerpt) | Dormant 0–1 °C; optimum "often given as 78–82 °F (25–28 °C)"; 30–38 °C "fermentation is fast"; cells die from ~50 °C, most dead by 60 °C. |
| BAKERpedia / ASBE "Dry yeast" (citing Hui 2006, Figoni 2008) | Optimum 25–28 °C; fermentation falls at ≥ 50 °C. |
| Laura Meyer, Pizza Today | "most active between 85 and 95 F"; dies above 110 °F; "slows to a crawl" at 35–40 °F. |
| Weekend Bakery | Commercial yeast optimum "just over 27C"; "above 35C ... effectively dormant or dead". **This contradicts the microbiology above** (Tmax ≈ 42–45 °C); treat it as a dough-handling observation, not kinetics. |

### 1c. Temperature dependence measured in recipes and practice

| Source | Statement | Implied **time** Q10 |
|---|---|---|
| MP4 (12 recipes) and MB6 (10 final proofs): the same dough proofed at 21 °C or at 27 °C/65 % RH | e.g. Apizza 3–3½ h vs 2–2½ h; NY square 3 h vs 2 h; MB6 Mantuan 5–7 h vs 3–4 h | median **1.97** (range 1.21–2.54, n = 22). This is proof stage only, and includes the dough's warm-up lag, so it is a lower bound for the dough-temperature Q10. |
| Reinhart (as quoted on Forno Bravo and TFL) | "For every 17 degree [°F] increase ... the rate of fermentation doubles" | 2.08 |
| Weekend Bakery reply | a loaf proofing 4 h at 15 °C takes about 1 h at 30 °C | 2.52 |
| My Pizza Night; fond.kitchen | "roughly doubles with every 10°C"; "about 8–10 °C warmer, about twice as fast" | 2.0–2.4 |
| TFL "Chuck" (2011) | "each ten degrees Fahrenheit halves/doubles rising time" | 3.5 |
| Biorito (IT) | "every five degrees less ... almost double the time" | ≈ 4 |
| Bake Magazine | +10 % per °C | 2.6 |
| Pizzastunde (35 °C outdoors) | a dough planned for 24 h at room temperature is "fully fermented in 8–10 hours" | 2.4–3× faster than at ~20–22 °C, i.e. ≈ 2.0–2.3 over 13–15 °C |
| Gänzle et al. 1998 (as summarised on the Greenwood sourdough FAQ) — **Candida milleri, not S. cerevisiae** | Topt 28 °C; generation time doubles at 20 and 32 °C, quadruples at 14 and 34 °C; no growth at 8 and 35 °C | not baker's yeast |

**Agreements.** Between 15 and 30 °C nearly every practical source sits at a time Q10 of 2.0–2.6. The engine's effective 1.74 is at the low edge; Modernist's own pairs give ~2.0. The CTMI gives a local time Q10 of about 2.4 between 15 and 25 °C and about 1.7 between 20 and 30 °C.

**Disagreements.**
- **Above 30 °C.** Growth (CTMI, Zakhartsev) flattens. CO₂ per cell keeps rising to 35–40 °C (Istudor, UBC, Bake Mag). Practice at 35 °C (Pizzastunde) sits between the two. The engine's tropical divisors push the wrong way relative to growth kinetics, and roughly match practice only because its Q10 is low elsewhere.
- **Below 10 °C.** See §4.
- **Possible error in the secondary description of Craig.** The GitHub PR says Craig's temperature curve "follows Gänzle et al. (1998)". If so, it would be a *C. milleri* sourdough-yeast curve (Topt 28 °C, Tmax 35 °C), which is the wrong organism for baker's yeast above 28 °C. **Unverified**: Craig's thread is unreachable.

## 2. Dose–time law (room temperature)

Today's law: dose ∝ h^−1.65 (Craig/dough.school).

What the evidence says:

| Data | Exponent b in dose ∝ h^−b | Source |
|---|---|---|
| Independent direct-dough tables and recipes, 18–30 °C (39 points from 14 sources; dough.school, AI posts, anecdotes, sweet and chemically leavened doughs excluded) | **1.19** (free fit); **1.25** with the time Q10 fixed so the dose Q10 is 2.5. Residual SD ×1.96. | `analysis.txt` |
| Poolish tables and recipes (28 points, 9 sources) | **1.39** | same |
| Finney et al. 1976, *Cereal Chem.* 53:126 (abstract) | 180 → 70 min fermentation needed 2 → 7.2 % yeast, so b ≈ **1.36** for short straight doughs. Proof ≈ 30 % of fermentation time. | measured, optimised loaves |
| Modernist Bread poolish, 8 → 12 h | 1.54 (0.74 overall, 3 → 18 h; prior pass) | MB6 p. 20 |
| Suas poolish (prior pass) | 1.1–1.7 | BAKERpedia relay |
| yozzause bakery table (fresh yeast, 1–8 h) | ≈ 1.0 (5.33 % at 1 h → 0.667 % at 8 h) | TFL |
| Crust Kingdom 2 → 18 h | ≈ 1.29 | table |
| dough.school / engine | 1.65 | — |

**Mechanism.** The literature gives the pieces but no dough-specific dose–time law.
- If yeast does not multiply, time ∝ 1/dose and b = 1.
- Exponential growth with doubling time t_d gives dose ∝ 1/(2^(t/t_d) − 1). That is steeper than any power law at long times.
- Short doughs barely grow. Mariana on TFL reports no measured multiplication in < 6 h at 30 °C. MB6 makes the same point for poolish (more yeast gives less multiplication).
- Long doughs grow and then exhaust sugars. The poolish "ripe" endpoint in MP4 p. 2 is defined by exhaustion.
- Rezaei et al. 2014 (SGD abstract) show the yeast's physiological state at harvest changes fermentation rate. Struyf et al. 2017 (*Compr. Rev. Food Sci. Food Saf.* 16:850, abstract) review sugar, salt and strain effects but give no dose–time law.

**Consequence.** One exponent of 1.65 makes the engine:
- ask for 3–9× more yeast than every source at ≤ 3 h. Modernist "emergency" doughs use 0.8–1 % for 2.3 h; the engine computes 3.4 %. Brazilian thin-crust uses 0.49 % for 2 h; the engine computes 4.4 %.
- ask for less than the community at 48–72 h.

The pooled data are better described by b ≈ 1.2–1.4, or by a law whose local slope rises with time: about 1 below 4 h, about 1.4 at 8–24 h. Steeper at very long times is suggested only by dough.school's own long-time cells, which run above its law.

## 3. Endpoint

Summary only; see `ENDPOINTS.md`. The ×2 residual scatter and the 3–5× table spreads are mostly endpoint differences: doubled, tripled, ripe/peak, "ready" after a holding window, a fixed regulatory schedule.

Sources for the same time and temperature differ by up to 10×:
- 0.048 % (khymos/PizzApp+, Craig anchor as described in the GitHub PR);
- 0.10 % (dough.school, Baking Steel uses 0.2 % to double);
- **at 24 h and ~20 °C: Modernist Neapolitan 0.04 % + 3 h proof, versus Baking Steel 0.2 % "double in size".**

## 4. Cold fermentation

**Engine:** IDY% = 7.5/h^1.313 ÷ 2^((Tf−4)/10). On its own, 24 h at 4 °C needs 0.116 %. That is the same dose as ~18 h at 21 °C, so the law makes fridge time worth 60–75 % of 21 °C time. **That is not physical.**
- Biology: CTMI growth ≈ 0–4 % of the 25 °C rate at 4 °C, and Nestec CO₂ ≈ 8.5 %.
- It works only because the law is a **whole-protocol** law. It includes the warm hours while a freshly mixed dough at 24–28 °C cools, and the tempering after.
- The engine *also* runs a separate cooling/warming trajectory. **Hypothesis to check in code: the warm hours may be counted twice**, which would push cold doses down. Every external source sits above the engine's cold dose.

**Data, `DATASET.csv`.** Ratio of source to engine, without the engine's trajectory:

| Group | Ratio |
|---|---|
| Community cold tables (dough.school, Crust Kingdom, Jordo, My Pizza Night, fond) | 1.3–3.7×, median 2.1 |
| Professional or book recipes (Modernist poolish doughs 1–2 d at 4 °C, Ooni, Lehmann) | 4–8× |

**A consistent physical reading** (`coldcheck.py`). Treat every phase with one RT law fitted to independent data (1.86·h^−1.25 at 25 °C), dough temperature relaxing to ambient with τ = 2 h, and the CTMI for warm phases. Then solve for the fridge's relative activity k:

| Sources | Implied k | Matches |
|---|---|---|
| Community tables | **k ≈ 0.16–0.21** | a Q10 of 2–2.5 extrapolated down to 4 °C (0.15–0.23) |
| Modernist, Ooni, Lehmann | **k ≈ 0.02–0.04** | CTMI and the Nestec data (0.04–0.09) |

These two schools differ by 5–10× in what a fridge hour is worth. The cause is the endpoint, not the yeast:
- **Pro / book school:** the fridge is a hold. The dough must not blow over 1–3 days (Lehmann: FDT 80–85 °F for walk-in, 70–75 °F for 5-day life). Modernist: cold-proofing gives "reduced volume"; temper to 13 °C.
- **Community school:** the dough is meant to have about doubled when it comes out (Ooni, dough.school).

Other cold facts:
- **Fridge temperatures quoted:** Modernist 0.5–4.4 °C typical, 4 °C recommended; fond 2–4 °C; dough.school 2–4 °C; da Michele 5–8 °C; Pizza Napoletana DOC 5–6 °C; Baker Hub default 6 °C. Home fridges vary by ±3 °C, and that moves k by 2–3×. No source measured dough temperature inside a fridge.
- **Cooling time:** Lehmann cross-stacks 16 oz balls ≥ 2 h and 17–24 oz balls ≥ 2.5 h. That supports τ ≈ 1.5–2.5 h. No measured cooling curve was found.
- **No published dough Q10 for 2–8 °C was found.** Nestec is a maltose medium, not dough.

## 5. Preferments

- **Poolish at room temperature** (prior pass + Modernist): the books are 1.3–2.2× above the engine's ÷3.1 at 8–14 h, and 0.6–0.7× at 3 h. The pooled poolish exponent is 1.39. A poolish needs about **1/1.2–1/1.6 of a salted dough's dose** at the same time and temperature (prior pass; MP4 p. 2 and MB6 p. 20 give ÷1.34–1.41 at 21 °C). Mechanism: no salt (§6), 100 % hydration (§7), endpoint "ripe" = sugar exhaustion.
- **Fridge poolish:** only Weekend Bakery (0.5 % / 18 h, 0.3 % / 24 h, fridge temperature unstated) and a V-ZUG Singapore recipe. The latter has 2.5 % "yeast" of poolish flour, 1 h at room temperature then 18–24 h in the fridge, type unstated. Both are above the engine. **Weakly documented.**
- **Biga:**
  - MB6 p. 22: 0.31 % for 12 h at room temperature, 60 % water. MB6 p. 19: 0.24–0.33 %.
  - Giorilli via Dissapore (prior pass): 1 % fresh, 44 % water, 16 h at 18–20 °C.
  - Engine ratio 0.57–0.89. The engine's biga ×2.2 sits above both books.
- **Sponge** 0.1–0.2 % / 12 h, and **pâte fermentée** 0.07 % / 12 h at room temperature with 2 % salt (MB6 p. 19 and p. 23): no engine law exists.
- **Splitting** (MP4 and MB6 recipes, prior pass): every Modernist poolish dough adds instant yeast to the final dough. Totals are 0.33–0.82 % of all flour. Gozney and CalBeachBaker (TFL) do the same.

## 6. Salt

| Source | Finding |
|---|---|
| Foods 2017, 6(8):66, "Sodium Chloride and Its Influence on the Aroma Profile of Yeasted Bread" (MDPI open text) | Rheofermentometer at 30 °C, 3 h. Total dough volume: 0 % NaCl 2241 mL; 0.26 % 2108; 1.04 % 1581; 1.73 % 982; 2.60 % 573; 3.46 % 313. Percentages are w/w of dough; their Table 1 gives 0.43–5.80 % on flour for the same series. No significant inhibition below ~0.26 %. Their own tables are internally inconsistent on yeast dose and test duration. |
| Cargill, "Salt in bread dough" | 1.5 % salt on flour cuts gas by "only about 9%" (study not named). "At 2% of the flour weight or less, salt alone does not significantly alter ... gassing power." |
| Lynch et al. 2009, *Food Res. Int.* 42:885; Beck, Jekle & Becker 2012, *IJFST* 47:1798 | Cited by the MDPI paper for gluten strengthening and retention. Their gas data were not readable this session. |
| Bake Magazine | +0.2 % salt slows yeast (no magnitude). |
| Figoni | Typical 1.8–2.2 %. |

**Gap.** The two numbers disagree by about 3×:
- Cargill: about −9 % gas at 1.5 % salt.
- MDPI: about −30 % *volume* at ~1.7 % salt on flour.

Volume also depends on retention. Neapolitan doughs at 2.7–3.4 % salt (STG, AVPN, Ooni, Modernist emergency) are a test case. **A salt factor cannot yet be sourced** better than "salted lean dough vs unsalted preferment, ×1.2–1.6", which comes from the poolish books.

## 7. Sugar, osmotic stress, hydration

- **Sugar** (Figoni; BAKERpedia citing Hui and Figoni; Reed, *Yeast Technology* 1991 via BAKERpedia):
  - yeast consumes ~3–5 % sugar;
  - 5–10 % increases activity;
  - above 10 % activity decreases;
  - osmotolerant yeast is for > 5 % up to 25 % sugar (SAF Gold sheet: 10–30 %, used at 1–3 %, with dough 3–5 °F warmer).
  - Rich doughs: "doubling or tripling the required yeast level".
  - PizzaBlab: above 5 % sugar multiply by 1.5–2×.
  - MP4 Pizza Gourmet (10.7 % sugar) uses 1.08 % for 4.25 h at 21 °C, against 0.4–0.5 % for lean 5 h doughs: ≈ 2× (DATASET).
  - **Aslankoohi et al. 2015, *PLoS ONE* 10:e0119364:** glycerol-production mutants lose 30–50 % CO₂ at 6 % sugar, aw 0.97. Over-expression gives +50 % at 18 % sugar, aw 0.95, in a lab strain, and no change in a bakery strain.
  - **Consistent with today's code** (fixed 1 % IDY at ≥ 10 %), not with the old +20 % at 2 %.
- **Hydration:** Bake Magazine says higher water speeds fermentation by diluting solutes (no number). Rosell & Collar (CSIC, core.ac.uk) note that dough consistency changes gas development, with coded regression coefficients only. **No quantitative hydration factor was found.** It appears only implicitly, through the poolish (100 %) versus biga (44–60 %) contrast.

## 8. Yeast types and conversions (IDY = 1)

| Source | Fresh (CY) | ADY |
|---|---|---|
| MB6 p. xi (prior pass); Lehmann (CY 1 % = IDY 0.375 %) | 3.0; Lehmann 2.67 | 1.33 |
| BAKERpedia/ASBE (Hui 2006; Figoni 2008) | 2.86 (IDY = 0.35 × CY) | 1.43 (ADY = 0.5 × CY) |
| hanseata, TFL | 3.0 lean, 2.5 enriched | 1.5 |
| Fleischmann's | — | 1.25 ("Use 25% more Active Dry") |
| My Pizza Night | 3.0 | 1.25 |
| Jordo's calculator | — | 1.67–2.0 |
| Modernist Cuisine "Is fresh yeast best?" | ~6×10⁹ cells/g compressed; ~25 % of cells killed in ADY production | — |

Conversions are reasonably well documented at fresh = 2.7–3 × IDY. ADY spans 1.25–1.5 × IDY in manufacturer and book sources. Calculator outliers reach 2.

## 9. Hot-climate practice (owner priority)

### What was reachable

**Asia:**
- Singapore: TFL MoonshineSG (kitchen 26–32 °C, RH > 80 %); TFL Hiscook and nora sass; Elmo bakes; Epicure SG (via PressReader); Tiong Bahru Bakery workshop (Tatler HK); Michelin Guide SG (da Michele recipe); Cicheti chef (Tatler); V-ZUG SG recipe.
- Laos and Thailand: TFL Mini Oven, Jilrob.
- Southern China: TFL Stig.
- Hong Kong: SCMP on Kytaly, no numbers.
- India: Swissbake.
- Brazil: tudogostoso / Luciano Ufer.

**Australia (QLD):** TFL Worthwhilebubble; You Knead Sourdough.

**Other hot places:** Caribbean and Mexico (TFL); South Africa, Arizona and others (Weekend Bakery comments); Pizzastunde (35 °C summer); Lehmann (Pizza Today, PMQ).

### Not reachable or nothing found
- Reddit, Facebook and Instagram.
- Bakery Mentors, At-Sunrice and Le Cordon Bleu Asia: no public quantitative pages found.
- Local-language searches (MS, VI, ID, TH, PT) returned mass-market recipes with no heat protocol.

### Protocols recorded

| Source (place) | Protocol | Numbers |
|---|---|---|
| Pizzastunde (35 °C, outdoor) | ice-cold water; lower hydration; fridge-only maturation; dough boxes in cool boxes with ice packs; short warm-up | fresh yeast 1 g/kg (≈ 0.033 % IDY) vs normal 1–2 g/kg; hydration 65–66 % vs 70–72 %; **dough after kneading < 23–24 °C**; warm-up 30–60 min; a 24 h room-temperature dough ferments fully in 8–10 h at 35 °C |
| Lehmann (commercial, hot shops) | control finished dough temperature with ice water; cross-stack in the cooler, then down-stack | FDT 80–85 °F (27–29 °C) for walk-in, 70–75 °F (21–24 °C) for reach-in or longer life; water 40–45 °F, ice pound-for-pound; 0.375 % IDY; 1–3 days (5 days at the lower FDT) |
| da Michele recipe (Michelin SG) | short room-temperature start, fridge, long room-temperature finish | FDT 24–25 °C; 2 h RT; 8–12 h at 5–8 °C; 6 h RT; 0.15–0.2 % fresh |
| Swissbake (India, professional) | air-conditioned bakery; water held cool; ice by formula | bakery 20–24 °C; water 22–26 °C; ice = W·(Ttap − Treq)/(Ttap + 80) |
| King Arthur (summer) | colder liquid, less of it | DDT 75–78 °F; liquid −10 % |
| Weekend Bakery replies (27–35 °C kitchens) | ice water; fridge retarding; less yeast; halve the autolyse | DDT 24–26 °C after kneading; proof "closer to 27C"; 1 h autolyse instead of 2 at 28–30 °C; 4 h at 15 °C ≈ 1 h at 30 °C |
| Epicure SG (Singapore) | proof below ambient; brief fridge spells | ideal proof 24–26 °C |
| Tiong Bahru Bakery (Singapore, sourdough) | — | proof 24–30 °C |
| You Knead Sourdough (Australia, warm) | **shorter endpoint**; fridge breaks | above 28 °C target a **30 % rise** in bulk (50 % below 25 °C); 15–30 min fridge breaks |
| Elmo bakes (Singapore home baker, no fridge use) | warm direct dough, short | 5–7 g dry yeast / 500 g (1–1.4 %); doubles in ~40 min at ~30 °C; overproofed by 1.5 h |
| TFL Stig (S. China, 30 °C) | air-conditioned room; fridge 12 h | — |
| TFL Mini Oven (N. Laos, 28 °C days) | less yeast; bake moved earlier | 0.4 % SAF instant, 70 % water at 24 °C |
| TFL ehanner (advice for Barbados) | less yeast | "nearly half the yeast"; DDT ~78 °F |
| TFL Chuck (NYC 90–95 °F) | — | halve yeast when ambient is 10 °F above an 80 °F DDT |
| My Pizza Night; fond; Jordo | less yeast | 25 °C+ cut yeast 20–30 %; "above about 85°F (29°C) the dough tends to run ahead of its flavor"; cold water "buys an extra 1–2 hours" |
| TFL 11767 (Nicaragua, Hawaii) | fridge retard after kneading, often twice | 4–20 h |
| Modernist Cuisine (cold-proofing article) | Neapolitans "adjust the yeast amount based on the season" | — |

### What this means for the model

The practice converges on four things:
1. **Control the dough temperature, not the dose.** Targets cluster at 23–26 °C after mixing (Pizzastunde < 23–24; WB 24–26; KA 24–26; da Michele 24–25), using ice or chilled water and an air-conditioned room.
2. **Move most of the time into the fridge.** Fridge-only, or a short room-temperature start, fridge, short finish.
3. **Shorter room-temperature finishes:** 30–60 min warm-up at 35 °C.
4. **An earlier endpoint:** 30 % rise instead of 50 %. Over-proofing risk rises with temperature.

The doses quoted for hot kitchens are 20–50 % below temperate ones at the same schedule. Only one source quantifies speed at 35 °C (2.4–3×). **No source gives dose-versus-time data at 28–38 °C dough temperature.** The tropical end of any model will be extrapolated from the temperature curve, so the planner should prefer protocols that keep dough at ≤ 26 °C.

## 10. Gaps (what is not documented anywhere reachable)

1. Craig's original equations, endpoint and data (blocked site).
2. Dose–time data at 28–38 °C dough temperature.
3. Measured dough-in-fridge rates at 2–8 °C, and dough cooling curves.
4. A quantitative salt factor in dough (two sources, 3× apart) and a hydration factor (none).
5. A published endpoint conversion ("doubled" vs "ripe" vs "ready") with numbers. Only indirect evidence exists: Forkish's tripled bulk, YKS's 30 % vs 50 %, Modernist's proof pairs.
6. Fridge poolish and fridge biga doses (2 weak points).

## Sources

**Owner's books (PDF):**
- *Modernist Pizza* Vol. 4 Kitchen Manual, pp. 1–2, 17, 26–79, 105–106, 263.
- *Modernist Bread* Vol. 6 Kitchen Manual, pp. xi, 18–23, 44–159 (final-proof tables).

**Peer-reviewed / technical:**
- Salvadó et al. 2011, AEM (abstract): https://www.yeastgenome.org/reference/21317255
- Zakhartsev et al. 2015, J Therm Biol: https://www.sciencedirect.com/science/article/abs/pii/S0306456515300188
- Rosso 1993 CTMI (rTPC code): https://rdrr.io/github/padpadpadpad/rTPC/src/R/rosso_1993.R
- Aslankoohi et al. 2015, PLoS ONE: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0119364
- Struyf et al. 2017 (AGRIS record): https://agris.fao.org/search/ar/records/65dea9d0b766d82b18fe07c4
- Rezaei et al. 2014 (SGD): https://www.yeastgenome.org/reference/24387860
- Finney et al. 1976, Cereal Chem: https://cerealsgrains.org/publications/cc/backissues/1976/Documents/CC1976a16.html
- Walker, Quail & McMaster 1996, CFW: https://researchers.mq.edu.au/en/publications/influence-of-dough-and-proofer-temperatures-and-yeast-concentrati/
- El-Hady et al. 1996, Cereal Chem: https://www.cerealsgrains.org:443/publications/cc/backissues/1996/Documents/73_472.pdf
- Rosell & Collar, CSIC: https://core.ac.uk/download/36050806.pdf
- Istudor et al. 2020: https://www.e3s-conferences.org/articles/e3sconf/pdf/2020/40/e3sconf_te-re-rd2020_03012.pdf
- Janssens et al. (UBC): https://ojs.library.ubc.ca/index.php/expedition/article/view/188348/186126
- Foods 2017 6(8):66: https://mdpi.com/2304-8158/6/8/66
- Nestec US 5,827,724: https://patents.google.com/patent/US5827724
- Nestec US 5,776,526: https://patents.justia.com/patent/5776526
- Gänzle 1998 summary: https://nyx.org/~dgreenw/whatfactorsaffectmicrobial.html and https://www.sourdough.co.uk/research/modeling-growth-lactobacillus-sanfranciscensis-candida-milleri-response-process-parameters-sourdough-fermentation/
- Cauvain & Young, *Technology of Breadmaking* 2nd ed. (front matter only): https://content.e-bookshelf.de/media/reading/L-1446-5befe51757.pdf
- EU Reg. 97/2010 (Pizza Napoletana TSG): https://www.legislation.gov.uk/eur/2010/97/annexes

**Manufacturers / trade:**
- Fleischmann's: https://www.fleischmannsyeast.com/baking-basics/yeast-101/
- SAF Instant Gold sheet: https://cdn.shoplightspeed.com/shops/613568/files/22604199/safinstant-pos-15910-35150-saf-instant-gold-9-19.pdf
- BAKERpedia osmotolerant yeast: https://bakerpedia.com/?p=23300
- BAKERpedia dry yeast: https://bakerpedia.com/?p=3774
- ASBE dry yeast: https://asbe.org/article/dry-yeast/
- Baking Business: https://www.bakingbusiness.com/articles/34372-leavening-yeast-accounting-for-choices
- Bake Magazine: https://www.bakemag.com/articles/836-the-science-of-fermentation
- Cargill: https://www.cargill.com/salt-in-perspective/salt-in-bread-dough
- King Arthur: https://www.kingarthurbaking.com/blog/2018/06/22/winter-to-summer-yeast-baking and https://www.kingarthurbaking.com/professional/dough-temperatures.html
- Modernist Cuisine: https://modernistcuisine.com/mb/is-fresh-yeast-best/, https://modernistcuisine.com/mb/the-role-of-yeast-in-bread/ and https://modernistcuisine.com/mp/cold-proofing-pizza-dough/
- Figoni via ckbk: https://app.ckbk.com/section/howb92676c11s005ss001/factors-affecting-yeast-fermentation
- Lehmann / Pizza Today / PMQ:
  - https://pizzatoday.com/?p=130064
  - https://www.pizzatoday.com/2012-august-dough-shelf-life
  - https://pizzatoday.com/news/temperature-essentials/130722/
  - https://www.pmq.com/pizza-dough-temperature/
  - https://www.pmq.com/tired-of-cross-stacking-your-dough-boxes-tom-the-dough-doctor-lehmann-has-an-alternative-you-might-like-better/
  - https://pizzatoday.com/?p=618020
  - https://pizzatoday.com/?p=143911
  - https://pizzatoday.com/?p=132050
- Swissbake:
  - https://www.swissbake.in/blog/summer-baking-tips-for-professionals
  - https://www.swissbake.in/blog/regulating-dough-temperature-baking

**Community / calculators:**
- dough.school: https://www.dough.school/guides/yeast-calculator and https://www.dough.school/guides/cold-fermentation
- Crust Kingdom: https://www.crustkingdom.com/how-much-yeast-in-pizza-dough/
- PizzaBlab: https://www.pizzablab.com/calculators/pizza-dough-calculator-guide/
- BeanAnimal: https://beananimal.com/tools/dough-fermentation-calculator/
- khymos: https://khymos.org/2020/11/15/how-much-yeast/
- GitHub PR (Craig, secondary): https://github.com/Alexbl00m/dough-designer-pro/pull/2
- My Pizza Night: https://mypizzanight.com/guides/pizza-dough-yeast-calculator
- Jordo's: https://jordospizzacalculator.com/guides/fermentation-timing
- fond.kitchen:
  - https://fond.kitchen/guides/pizza-dough/pizza-dough-fermentation/
  - https://fond.kitchen/guides/pizza-dough/cold-fermentation-pizza/
- Ooni: https://ooni.com/blogs/recipes/cold-prove-pizza-dough and https://eu.ooni.com/blogs/recipes/ken-forkishs-i-slept-in-but-i-want-pizza-tonight-dough
- Forkish: https://www.penguin.com.au/recipes/3995-the-saturday-white-bread and https://wpr.org/food/recipe-overnight-straight-pizza-dough-ken-forkish
- Baking Steel: https://bakingsteel.com/pages/printable-24-hour-pizza-dough-recipe
- Gozney: https://us.gozney.com/blogs/recipes/new-york-style-pizza-recipe
- Forno Bravo (Reinhart): https://www.fornobravo.com/blog/how-to-control-when-your-dough-doubles-in-size/
- Italian sources:
  - Biorito: https://biorito.com/blogs/informazioni/quanto-lievito-per-1-kg-di-farina
  - Pizza Napoletana DOC: https://www.pizzanapoletanadoc.it/quanto-riposa-un-impasto/
  - Pescenudo: https://www.pescenudo.it/2020/tempi-di-lievitazione-degli-impasti-con-lievito-di-birra
- The Fresh Loaf:
  - https://www.thefreshloaf.com/comment/553914
  - https://www.thefreshloaf.com/node/11767/baking-bread-tropics
  - https://www.thefreshloaf.com/node/24336
  - https://www.thefreshloaf.com/comment/288526
  - https://www.thefreshloaf.com/node/29619
  - https://www.thefreshloaf.com/comment/442313
  - https://www.thefreshloaf.com/node/29376/tropical-flops
  - https://www.thefreshloaf.com/node/9931
  - https://www.thefreshloaf.com/comment/518182
  - https://www.thefreshloaf.com/node/29531
  - https://www.thefreshloaf.com/comment/551465
- Weekend Bakery: https://weekendbakery.com/posts/a-few-tips-on-dough-temperature/comment-page-2
- Jack Sturgess: https://jack-sturgess.squarespace.com/blog-1/2018/10/16/baking-bread-in-extremes-of-temperature

**Hot-climate pages:**
- Pizzastunde: https://www.pizzastunde.com/en/pizza-at-35c-how-to-master-dough-and-toppings-in-the-summer-heat/
- Michelin SG: https://guide.michelin.com/sg/en/article/dining-in/how-to-make-margherita-like-a-michelin-pizzeria
- Tatler (Cicheti): https://www.tatlerasia.com/dining/food/cicheti-chef-co-owner-lim-yew-aun-best-tips-to-make-pizza-at-home
- Time Out SG: https://www.timeout.com/singapore/restaurants/rise-to-pizza-stardom-how-la-bottega-proofs-itself-as-singapores-best-pizza-joint
- V-ZUG SG: https://www.vzug.com/sg/en/recipe/pizzateig-napoletana--rvzug.recipe.2025.pizzateig_napoletana
- Elmo bakes: https://elmobakes.blogspot.com/2017/09/baking-bread-at-home-part-1.html
- Epicure SG: https://www.pressreader.com/singapore/epicure/20190501/282458530377764
- Tatler HK (Tiong Bahru Bakery): https://hk.asiatatler.com/dining/food/best-tips-to-make-sourdough
- You Knead Sourdough: https://www.youkneadsourdough.com.au/blogs/faq/how-to-prevent-over-proving-in-warm-climates
- SCMP: https://www.scmp.com/lifestyle/food-drink/article/2173310/secrets-behind-dough-worlds-best-pizzas-hong-kong-revealed
- Tudogostoso: https://www.tudogostoso.com.br/noticias/luciano-ufer-pizzaiolo-para-que-a-pizza-caseira-fique-boa-e-preciso-preparar-a-massa-com-antecedencia-e-deixa-la-fermentar-no-frio-por-horas-a28416.htm

**Prior pass:** the URLs listed in `S/poolish/SOURCES.md` (Suas via BAKERpedia, TFL 4082/553626, MB errata, Weekend Bakery poolish, fond poolish, Dissapore, Pezzetta, The Dough Formula, Hamelman via ckbk, Chainbaker).
