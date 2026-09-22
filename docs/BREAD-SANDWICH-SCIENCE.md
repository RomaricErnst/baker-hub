# Bread and sandwich science review

22 September 2026. Independent reviewer scope: new bread protocols, fermentation integration and full-portion nutrition. Application implementation belongs to the engine/catalogue/guide agents. This document begins with design constraints; final audit results will be appended after the implementation exists. **Not yet an implementation acceptance.**

## Preserve existing calibration

The existing climate/fridge/dose engine was reviewed separately in SCIENCE-REVIEW-20260922.md. Adding named breads is not a reason to replace its coefficients. New profiles must identify their recipe/protocol anchor and separate a practical adaptation from a verbatim or experimentally validated formula. Reusing an analogous bread's cold schedule supplies a planning heuristic, not new evidence that a style is calibrated for every temperature, flour and preferment.

## Method constraints communicated to implementers

- Piadina's selected unleavened version requires explicit mixing/resting/rolling/pan cooking and no yeast, starter feeding, fermentation curve, or maturity window. Stale saved yeast/preferment selections must not add ingredients or resurrect fermentation instructions.
- Bagel needs shaping, poaching and oven baking as separate operations. Do not call an ordinary baked ring a verified bagel protocol. Ingredient quantities for the water bath belong outside dough mass and must not be counted as if all bath liquid/sugar is consumed.
- Oven pocket pita and Greek pan pita need different shaping and cooking guidance. Dimples and intentional punctures that suit Greek pita should not be copied into a promised pocket method. A pocket that fails to inflate can still be used as a wrap; do not promise every piece inflates.
- Batbout needs its semolina/durum flour identity represented in a default blend or explicit ingredient guidance. Shaping/rolling precedes its final rise. Do not reuse a generic all-white loaf's shaping order under this name.
- Focaccia pan oil/topping oil and skillet oil are distinct from oil mixed into dough. Ingredient/mass/nutrition accounting must say what is included.
- Equipment routes must match the actual cooking method. A skillet is not an oven at a guessed numeric temperature; hot oven methods must respect the selected equipment's achievable/safe range. Thick loaves and thin flatbreads cannot share the same doneness time.
- Cold fermentation can overlap unavailable time, but hands-on steps cannot. New boil/shape/griddle actions need suitable availability treatment or an explicit limitation; an existing proof timestamp is not automatically sufficient.

## First-party recipe checks

[King Arthur's bagel recipe](https://www.kingarthurbaking.com/recipes/bagels-recipe) uses a comparatively stiff dough, a rise and shaped rest, then a water bath followed by oven baking. This supports the required operation sequence; it does not validate Bakerhub's proposed climate-adjusted yeast amount or an unrelated boil duration.

[King Arthur's pocket pita](https://www.kingarthurbaking.com/recipes/golden-pita-bread-recipe) rolls individual pieces, rests them briefly, and bakes in a hot oven before wrapping to retain softness. Its notes explicitly allow using an unpuffed bread as a wrap. The source's formula contains about 63% water and about 7% oil by flour; a lower-oil Bakerhub formula is an adaptation, not an exact reproduction.

[My Greek Dish's own pita recipe](https://www.mygreekdish.com/recipe/the-easiest-homemade-pita-bread/) uses a lean flour/water/yeast/salt/sugar dough, dimpling and skillet cooking. Its 360 g water to 500–530 g flour is approximately 68–72% hydration. Skillet/coating oil is separate from dough ingredients. This anchors the distinction from pocket pita without importing the article's broader health claims.

[Taste of Maroc's batbout](https://tasteofmaroc.com/batbout-moroccan-pita-bread/) uses white, fine semolina/durum and whole-wheat flours. Balls rest, are rolled thin, then rise before griddle cooking. The author notes that hot conditions can accelerate rise and dry the surface; covering and judging puffiness matter. This supports the flour/method distinction, not a universal minute-perfect fermentation prediction.

## Nutrition acceptance criteria

The displayed serving must include the bread, filling, sauce and specified edible oil/toppings. Define whether the bread amount is baked edible weight or dough weight; these cannot use the same per-100 g baked-bread value without an explicit yield assumption. A per-sandwich estimate should scale with chosen bread portion and fillings, and total shopping quantities should scale independently with guest count.

Each ingredient needs an identifiable source food and preparation state (raw/cooked/drained). [USDA FoodData Central documentation](https://fdc.nal.usda.gov/data-documentation/) distinguishes analytically derived generic foods, survey foods and manufacturer label data. A source homepage alone does not establish that a specific numerical row was verified. Missing nutrient data must not silently become zero or support an unjustified comparison. Rounding should follow summation; labels should call the result an estimate.

“Lighter” must have a clear comparison basis, such as lower estimated energy than a stated original portion. It is not a guarantee of nutritional adequacy, weight loss or general healthfulness. Smaller portions and fewer calories are separate from vegetarian/vegan status. Do not infer allergens solely from dietary tags or promise suitability for a medical diet.

For filling instructions, use accurately described cooked/ready-to-eat ingredients or give an actual cooking method. [FoodSafety.gov's minimum-temperature chart](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures) specifies 74°C for poultry, 71°C for ground meat and 63°C for fish; a short arbitrary reheating time alone cannot certify raw meat as cooked. Keep any safety instruction contextual to the actual ingredient, not an unrelated warning panel.

## Pending verification

- Inspect final profiles, unsupported-method guards, cooker routes and rendered guide order.
- Run independent climate/fridge/style/schedule/portion checks against production exports, including piadina stale-state behavior.
- Re-run relevant existing-style regressions without retuning expected outputs to accommodate changes.
- Verify nutrition full-portion conservation, scaling, missing-data behavior and the “lighter” comparison contract.
- Record evidence and remaining limits here before final acceptance.

## Implemented-domain review

The new profiles now explicitly distinguish oven, griddle and boil/bake protocols. Existing dose-response coefficients were preserved; new style defaults are labelled product adaptations rather than a newly calibrated kinetic model. Piadina has a finite preparation budget, zero fermentation exposure, no yeast/starter/preferment ingredients even with stale selections, and explicit invalid timing outside the supported preparation window. Its 45-minute minimum and 2-hour maximum are the supported product protocol, not experimentally established universal dough limits. Bagel's current kneaded protocol rejects the existing zero-work no-knead option; this is not a claim that no-knead bagels are impossible.

The engine owner added equipment/method/timing issues for unsupported restored selections. Laffa's oven guidance now allows 250–260°C within the oven's rating. The guide owner replaced generic loaf shaping and cooling with profile stages, including poaching and griddle cooking, and corrected rest/rolling order. Batbout's profile calls for fine semolina; the actual selected default blend must still be checked in the integrated journey.

### Independent checks completed

Owned tests: `tests/bread-science.test.cjs` and `tests/sandwich-science.test.cjs`, **7 tests passing** at this review checkpoint.

- 330 recipe combinations (11 new styles × five kitchen temperatures 16/22/30/35/38°C × three fridge values 2/4/8°C × Simple/Custom) preserve finite, nonnegative ingredient quantities and requested mass within weighing tolerance. This arithmetic matrix deliberately includes long room-temperature cases; passing it does not mean every such plan is recommended or executable.
- 64 piadina combinations of climate and stale yeast/preferment state produce no yeast, sourdough, preferment or cold-fermentation schedule.
- All 82 sandwich estimates retain their stated bread portion when fillings are removed; adding edible filling increases energy. Unknown nutrient records fail explicitly instead of becoming zero.
- Shopping amounts scale edible fillings with portion count without double-counting bread already made by the parent recipe.
- “Lighter” catalogue options are checked against the actual same-family classic mean with equal bread mass. The comparison now uses unrounded energy; a richer customized filling loses the classification through `isLighterSandwich`.

Also reran the existing schedule-regression, recipe-mass and enriched-formula suites: **15 tests passed**. The implementation owner's five bread-profile tests passed when independently rerun, including equipment/method guards and climate/fridge/duration sensitivity.

### Nutrition interpretation

The energy numbers are **rounded generic-food estimates**, now explicitly marked `generic-food-estimate`; they are not individually verified USDA/CIQUAL record extracts. The database homepage links are background references, not proof that each row has a matched analytical record. Ingredient preparation states are explicit for cooked meats, peeled cooked egg and drained foods. Vegetarian cheese instructions require appropriate rennet labelling. Catalogue heating instructions distinguish already-cooked ingredients from raw meat and retain a measured-temperature criterion for leftovers.

The model estimates **energy (kcal)**, not a complete nutrient panel. It cannot support claims about protein adequacy, sodium, fibre or medical suitability. A “lighter” option means lower estimated energy than this catalogue's specified comparison, not generally healthier food.

### Remaining UI acceptance conditions

At this checkpoint, the domain passes its bounded review; the final UI was still being integrated. The coordinator must verify that calories visibly state the reference **baked bread grams** and listed filling portion, because a custom raw dough piece may produce a different-sized bread. The UI must call the dynamic lighter helper after edits, show estimate provenance without claiming verified database precision, and respect protocolIssue gates before presenting an executable guide. Final build, browser and deployment results belong in the handoff and are not claimed by this document.

## Final integration inspection

The implemented UI now displays baked reference-bread grams alongside estimated kcal, uses the dynamic lighter helper for filtering/badges, and explains that actual bread may differ. Batbout's default 67/33 bread-flour/semolina split is part of calculator output, shopping and mixing-guide quantities, with custom blends preserved. Recipe and guide output stop on unsupported method/equipment/timing states. These earlier integration conditions are resolved by source inspection and rendering checks.

Reran the final bread-profile, independent bread/nutrition, bread-guide and sandwich-component suites together: **22 tests passed**. This includes actual semolina ingredient-card/guide rendering in addition to arithmetic checks.

### Actionable availability gap sent to implementation owners

The new unleavened planner initially treated pan cooking as a point event. A 12:45 cooking start with an unavailable period beginning at 12:46 therefore passed its readiness check, although the specified piadina requires several minutes of hands-on cooking per bread. The same distinction applies to the new Greek pita/batbout griddle methods; generic passive-oven availability assumptions cannot prove these complete actions fit. Bagel poaching also needs an explicit active-work budget or an honest unmodeled-action limitation. This is an action-duration/accounting issue, not a reason to change fermentation coefficients.

Final availability sign-off is pending resolution or explicit bounded disclosure of this finding. The short piadina mixing/rest/rolling plan otherwise separates passive rest from active work correctly.

### Availability correction independently verified

The engine and unleavened planner now use a count-aware active griddle interval: one bread at a time multiplied by the profile's upper cooking estimate. The UI exposes the estimated batch completion, so a cooking-start time is not mistaken for the meal being finished. Independent tests confirm that unavailability beginning one minute after cooking starts is caught for piadina, Greek pita and batbout, while a period beginning exactly at batch completion remains clear.

Bagels now have an explicit poaching/transfer allowance of two minutes per item before the unchanged oven-entry time. The dough fermentation horizon ends at the first poach; the remaining allowance is not counted as room-temperature fermentation. This is a conservative batch-planning convention, not a simulation of each ring's temperature or exact readiness. The engine rejects a short plan that cannot retain the supported pre-poach window. A six-bagel independent test verifies the 12-minute action interval, conflict detection, fermentation accounting and insufficient-time guard.

The two independent science suites now contain **9 passing tests**. The active-cooking availability issue is resolved at the calculation/planner level; explicit bagel-poaching guide/timeline integration is the final display check before closing this review.

## Final bounded sign-off

**Passed for the completed source integration reviewed on 22 September 2026.** This closes the earlier pending conditions in this document. BakeGuide now presents a separate timed bagel-poaching step, followed by oven baking without repeating the poach instruction; Timeline uses the same poach timestamp/duration and ends proof at that action. Griddle cooking displays the batch duration. Independently reran all five bread-protocol guide/render tests after these changes: all passed.

The final sign-off covers ingredient accounting, supported protocol/method/equipment guards, separation of rest from fermentation, explicit hands-on cooking availability, guide/timeline consistency, and honest energy-estimate/comparison semantics. No remaining actionable defect was identified in this bounded review. It does **not** certify empirical baking outcomes for every style/climate/flour, each generic calorie value against an analytical record, physical-device behavior, or deployment status. Existing model limitations in SCIENCE-REVIEW-20260922.md remain; they were not silently solved by adding profiles. The coordinator owns the final CI/browser/deployment gate.
