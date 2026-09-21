# Practical Steps review

Executed handler/data tests, not browser or human usability testing. Production app unchanged.

Questions asked at the point of use:

- What do I weigh now? Previously Steps referred away to Ingredients and omitted quantities. Shared `stageIngredients`/`stageQuantities` now gives direct-mix rows or separate preferment/final rows for the renderer.
- Is final water extra water? Final flour/water are explicitly the remainder; all ripe preferment is added once. Tests confirm each pair sums to the shared total for Poolish and Biga at 37%, across pizza and bread. Biga uses catalog 45% hydration.
- Which yeast goes into the preferment? This prototype has a fixed illustrative whole-recipe yeast fixture, not the full scheduler-dependent production dosage. The helper withholds that row and identifies the missing calculation. No standalone model was grafted onto inconsistent total dough arithmetic.
- How much starter? The starter/final allocation is unavailable and blocked from appearing ready to mix. It is not replaced with commercial yeast or guessed grams.
- How many pieces? Divide step gives planned count and per-piece grams. Quantity screen separately identifies waste allowance.
- If I edit the plan, can I accidentally use stale weights? The helper suppresses step rows while stale; existing update flow requires regeneration.
- Does ice replace all recipe water? Thermal helper must consume final free water from this shared allocation, excluding water already used in the preferment. Science peer owns the bounded heat-balance helper.

`work/prototype-review/stage-quantities.cjs` passes direct/Poolish/Biga pizza and bread conservation, unknown yeast withholding, stale suppression and starter guard. Renderer integration and closed peer recheck pending; no overall cooking-readiness claim.

Renderer integration reviewed: Use now quantities precede mixing instructions, final preferment mix explicitly names its stage, unknown-dose completion is withheld, and active mixing batch has its own primary completion. Handler traversal confirms three batches must complete before stage advances; blocked preferment cannot bypass the control. Measured water/flour/preferment temperatures refresh the local water estimate without an unnecessary recipe reset; post-mix target change still requires recipe review. Source default target is applied when accepting the default style as well as explicitly selecting it. Water helper consumes the shared final-water allocation.

Final source peer flagged the original spiral mixer instruction's blanket 20–30% ice phrase, which conflicts with the new targeted calculation; designer asked to retain kneading text and remove this duplicate ice instruction in the prototype.

Small-batch and water-return checks: a single within-capacity mix now shows its ingredient rows without a redundant Batch 1 of 1 selector; adjustments remain available in a disclosure. Optional water-detail navigation records its invoking route, dough step and active batch. Executed test opens from batch two with batch one complete, edits starting-water temperature, then closes: it returns to the same step/batch with progress intact and no whole-recipe stale flag. Ingredients invocation returns to Ingredients. Scroll restoration is not asserted. Essential inline water rendering and distinct direct-ice physics are being integrated by designer/science peers; this entry is not their signoff.
