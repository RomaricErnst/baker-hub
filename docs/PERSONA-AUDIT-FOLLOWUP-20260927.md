# Persona audit follow-up — 27 September 2026

Scope: fixes from four simulated baker profiles and a UI/UX source review. These are not interviews, physical baking trials or physical-iPhone acceptance.

## Implemented

- Liquid starter is explicitly 100% hydration (equal total flour/water weights); feed ratios remain 1:r:r, not selectable starter hydration. Removed the verbose simple-only confirmation gate and kept the same concise meaning in both modes and ingredient output.
- Recipe percentage column explicitly uses flour weight. Flour blends support precise integer percentages down to 1%, conserving 100%.
- Sequential mixing batches reserve full work spans, including blockers. Actual mixer dough capacity is an optional persisted setting. Earliest-lot fermentation exposure is counted. An earliest fold that conflicts with later mixing is rejected with an equipment/quantity action; every batch start and preferment loading must fit the existing usable window.
- Mixing remains one common formula and fermentation schedule, not independently optimized per-lot biology. Individual maturity observations remain necessary.
- Pizza completion requires every selected recipe quantity. Surplus is separate and removed recipes do not count toward completion.
- Chicken shopping distinguishes estimated raw purchase from cooked recipe target. The 0.73 USDA boneless/skinless breast tenderloin yield is a qualified estimate, not guaranteed conversion. Recipe/nutrition weights unchanged; raw cooking is included for club sandwich too.
- Fresh mozzarella (cow/buffalo, packed in liquid) quantities explicitly mean drained cheese. Shopping/export instruct using declared drained pack weight; no invented brine conversion or pack size. One ambiguous authored NY buffalo recipe is expressed as a 100g drained-cheese target; custom amounts/units preserved. Low-moisture cheese unaffected.
- Guided piadina combines equipment/kitchen into one step plus planning. Other bread protocols, including yeasted laffa, retain their own paths. Optional early baking time is a preference until actual planner validation.
- Account save does not claim success until server confirmation; in-flight edits remain unsaved. Share uses the same canonical save. Anonymous account access remains retryable; export is called Download recipe.
- Completion supports optional result notes and another bake with retained choices, reset progression and required new schedule confirmation. Account users save the completed bake before cloning; failed save keeps it open.
- Larger/darker timing, 44px technique links, accessible overview metadata. Practical help and other questions are independent disclosures, not nested. Plain English guide labels.
- Sandwich family-specific names, no redundant checklist counter, multi-recipe preparation order with unchanged safe per-recipe checklists. Customization accurately describes quantity editing.

## Deliberately not invented

A restaurant service ETA needs oven simultaneous capacity, recipe cooking duration and thermal recovery/handling data. No unsupported last-pizza ETA was added. Ingredient substitutions likewise require structured substitutions and rewritten instructions; the current quantity editor no longer implies them. Identically worded steps for different sauces were not merged; a common preparation order is provided instead.

## Verification at preparation

- TypeScript and isolated production build passed.
- Full local unit/component suite: 369/369 before final mobile selector edits.
- Real mounted guide: overview/start/direct step/phase return/reload for neapolitan, pain_campagne and piadina passed.
- Real mounted sourdough: original24 and two-batch rapid/full24, no displayed-card or parent-state divergence and no runtime errors.
- New mobile cases cover anonymous save retry and fresh guided piadina through notes/rebake. Runtime CI results are recorded separately after publication.
- Authenticated live account, recipient sharing, physical Safari and physical dough trials remain unverified.

Primary yield reference: https://foodbuyingguide.fns.usda.gov/files/Reports/USDA_FBG_Section1_MeatsAndMeatAlternates_YieldTable.pdf
