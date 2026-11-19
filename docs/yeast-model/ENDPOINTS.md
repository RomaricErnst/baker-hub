> Phase 1 evidence base of the yeast model (19 Nov 2026), kept with `docs/YEAST-MODEL.md`. Paths beginning `S/` were working files of that research session and are not in the repository; the numbers they produced are quoted here, and the data points are in `DATASET.csv` beside this file.

# Endpoints: what "ready" means, and how to convert between definitions

19 Nov 2026. Companion to `LITERATURE.md` and `DATASET.csv`; the `endpoint` column there uses the labels below.

## 1. Definitions found

| Label | Source(s) | Definition as written | Stage |
|---|---|---|---|
| **Ripe / peak (preferment)** | MP4 p. 2; MB6 pp. 19–23; Suas via TFL; BAKERpedia | MP4: "the yeast has done as much fermenting as possible with the food available to it; if more time transpires, the yeast will become inactive". Suas: "domed slightly on top and has just begun to recede". | poolish, biga, sponge, pâte fermentée |
| **Doubled** | dough.school ("doubled, jiggly, a poke springs back slowly"); Ooni ("roughly doubled", in the fridge and again after 5 h RT); Baking Steel; Biorito ("fino al raddoppio"); Forkish "I slept in" (balls); Elmo bakes; Fleischmann's proofing test | volume ≈ 2× | bulk, balls or whole dough |
| **Tripled** | Forkish Saturday White ("triple its original volume", bulk); Forkish Overnight Straight Pizza ("2 to 3 times") | volume 2–3× | bulk only; a proof follows |
| **Partial rise, temperature-dependent** | You Knead Sourdough (warm climates) | "Warm climates (28°C+): target a 30% rise during bulk"; below 25 °C "up to 50% rise". (YKS is a sourdough source; the logic is general.) | bulk |
| **Fully proofed (fingertip test)** | Modernist (MP4 recipes; MB "Calling Proof", referenced on MB6 recipe pages); fond (poke test, "ready without doubling") | dent recovers slowly and partly | final proof |
| **Optimum with a usable window** | Crust Kingdom ("optimum", usable before and after); fond poolish (past peak but usable +2–4 h, prior pass); STG ("ready to be used within the next six hours") | a time with a window | whole schedule |
| **Hold without blowing (commercial cold dough)** | Lehmann (usable over 3 days; 5 days at FDT 70–75 °F; some dough "blows after only 12 to 15 hours" when too warm); Modernist cold-proof (temper to 13 °C; "reduced volume") | the fridge is a storage window, not a rise target | cold |
| **Fixed schedule** | EU 97/2010 TSG (2 h + 4–6 h at ~25 °C); AVPN (MP4 p. 43: 12–18 h + 6–8 h at 20 °C); Modernist recipes | the recipe's hours; quality judged at the bake | whole schedule |
| **Full rise (calculator)** | BeanAnimal (reports "hours remaining for full rise", fitted to Craig's charts) | not defined further | whole schedule |
| **Craig (TXCraig1) chart** | not readable (pizzamaking.com blocked). The GitHub PR describes the anchor as "ready in 12 h at 70 °F". | **unknown**; the owner's brief records it as "full-rise tables" | — |
| **"Definition B": 70–80 % of max rise** | the brief | **not found in the repository**. No source found uses it. | — |
| **Loaf optimum (cereal science)** | Finney et al. 1976 | the fermentation and proof that give a balanced loaf: proof ≈ 30 % of fermentation time | bulk + proof |
| **CO₂ volume fraction** | Modernist Cuisine "The role of yeast in bread" | dough is ready to degas "when carbon dioxide accounts for over half of its total volume", i.e. ≥ 2× | bulk |

## 2. Why tables for the same time and temperature differ 3–10×

Instant yeast at ~20–21 °C, total time 20–24 h (DATASET):

| Dose | Source | Endpoint |
|---|---|---|
| 0.037 % | AVPN (MP4 p. 43) | fixed schedule, 2.7 % salt |
| 0.04 % | Modernist Neapolitan | bulk 20–24 h + 3 h proof, fingertip |
| 0.048 % | khymos/PizzApp+ (20 h) | unspecified |
| 0.079 % | engine | — |
| 0.10 % | dough.school | unspecified, "doubled" in its cold guide |
| 0.20 % | Baking Steel | doubled, 3.2 % salt |

The same spread appears at 12 h:

| Dose | Source | Endpoint |
|---|---|---|
| 0.048 % | the Craig anchor via the PR | "ready" |
| 0.05 % | Biorito | doubled, fresh/3 |
| 0.08 % | Forkish | bulk to 2–3× at a 25–26 °C mix |
| 0.10 % | Jordo | — |
| 0.20–0.25 % | dough.school / My Pizza Night | — |

Part of the spread is salt (2–3.4 %) and starting dough temperature (Forkish mixes at 25–26 °C, ambient usually lower). A large part is the endpoint:
- **how far the dough rises** (30 % → 2× → 3×);
- **which stage** the table covers (bulk only, versus bulk + proof);
- **whether the table means the earliest usable point or the centre of a window.**

## 3. Converting between endpoints

What can be supported:

1. **Rise fraction → time, at constant dose. Not documented.**
   - No source reachable this session measures dough volume against time at a fixed dose.
   - The closest pair is Forkish Saturday White (0.4 % IDY, 5 h bulk to 3×, then a proof) and Modernist Direct NY (0.47 %, 5.2 h to "proofed"). They are similar doses for nominally different endpoints, but flour, salt, mix temperature and stage all differ, so nothing can be separated.
   - Early on, gas grows roughly linearly with time, before the yeast multiplies. So a 30 % rise needs less than half the time of a doubling at the same dose. That is an inference, not a measurement.
   - **Gap: Phase 2 needs a measurement.** A kitchen test, timing volume marks at 1.3×, 2× and 3× for two doses, would settle it.
2. **Bulk-only → whole schedule.** Finney's proof ≈ 30 % of fermentation time is the only quantitative relation found (short, warm, US systems). Modernist recipes put proof at 3 h after a 20–24 h bulk (≈ 12 %), and at 100 % of the time in "bench rest + proof" doughs.
3. **Peak (ripe preferment) → usable window.** From the prior pass: peak + ⅓ × time to peak at room temperature (fond; consistent with Suas's 12–15 h span); fridge peak + 12 h (The Dough Formula).
4. **Hold (pro cold) vs rise (community cold).** These are different endpoints. In the physical reconstruction (`LITERATURE.md` §4) they imply fridge activity k ≈ 0.02–0.04 versus k ≈ 0.16–0.21. A model must choose one per protocol:
   - "ready at bake time after a hold window" (Lehmann/Modernist): yeast sized for the warm phases, with the fridge a near-pause;
   - "doubled in the fridge" (community): the fridge does real work.
5. **Temperature-dependent endpoint.** YKS (30 % at ≥ 28 °C vs 50 % below 25 °C) and Pizzastunde's short warm-up both say that in heat bakers stop earlier. Their reason is dough strength and over-proof risk, not yeast. This argues for an endpoint that tightens with temperature, rather than a yeast-kinetics correction. That separation is exactly what the engine's "tropical factor" comment describes.

## 4. Recommendation for the model's endpoint (for decision)

- **One explicit endpoint per stage:**
  - bulk: rise fraction;
  - final proof: proofed;
  - preferment: ripe.
- **Fit every constant to sources tagged with the same endpoint.** `DATASET.csv` carries the tag.
- **Treat "doubled" (≈ 2×) as the reference.** It is the most common written definition: dough.school, Ooni, Baking Steel, Biorito, Fleischmann's, Modernist Cuisine's > 50 % CO₂.
- **Express "ready earlier in heat"** as an endpoint fraction that depends on dough temperature, sourced to YKS, Pizzastunde and Lehmann, with magnitude to be calibrated.
- **Define Definition B in writing before using it.** If the engine keeps it, the 70–80 % fraction needs a source or a kitchen measurement; none was found.
