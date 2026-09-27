# Sandwich catalogue and quantity contract — 22 September 2026

## Scope

89 filling recipes: 6 tartines, baguette 10, focaccia 10, bagel 8, pocket pita 7, and 6 each for Greek pita, kebab bread, batbout, laffa, piadina, pan-bagnat bread, ciabatta and panuozzo. These are sandwich fillings, not 89 dough formulas. Family images show the bread family, not a photograph of every filling.

`classic` means a familiar combination selected for the catalogue, not a protected traditional designation or a popularity ranking. All catalogue quantities and steps are Bakerhub editorial adaptations. `inspired` identifies creative variations. Only one pan bagnat is labelled classic; the five alternatives explicitly start with “Inspired / Inspiré”. No claim of ten traditional pan-bagnat recipes is made.

Regional references consulted:

- [Nice Côte d’Azur tourism: pan bagnat](https://www.explorenicecotedazur.com/explorer/art-de-vivre/gastronomie-et-terroir/recettes-de-cuisine-nicoise/le-pan-bagnat/) — the classic uses tomato, raw vegetables, tuna, hard-boiled egg, anchovy, olives and olive oil; variations are separately labelled.
- [Emilia-Romagna tourism: piadina](https://emiliaromagnaturismo.it/en/food-valley/pdo-and-pgi-products-from-emilia-romagna/pgi-piadina-romagnola) — supports cooked greens, raw vegetables, cured meat and fresh cheese as familiar fillings. Our grams and instructions are original editorial portions.
- [GoTürkiye: street food](https://goturkiye.com/istanbul/street-food) — contextual reference for döner as sliced cooked meat; our ready-cooked filling is a home adaptation, not a spit-roasting recipe.

The remaining familiar combinations are editorial selections, not recipes copied from a source or a claim of regional authenticity. There are no retailer availability claims.

## Portion and energy basis

Every ingredient quantity is **edible grams for one serving**: one sandwich, or one tartine portion. Meat is explicitly already cooked except `chicken_raw` in `pita-poulet-cru-citron`, weighed raw without skin or bones; canned foods are drained; eggs are peeled and hard-boiled. Vegetable weights are before the recipe’s roasting/sautéing step unless their label says cooked. Oil, sauces, cheese and nuts are counted. Shopping therefore buys the explicitly labelled raw or cooked meat/falafel/egg; it never silently treats raw meat weight as cooked yield.

`estimatedSandwichKcal` adds a stated **baked bread portion** plus every retained filling. A family’s default portion is a reference serving, not a statement that one pan or loaf makes one sandwich. The parent dough amount is not treated as baked bread mass: baking removes water. The interface must display the reference bread grams beside the calorie estimate and avoid claiming that a custom dough piece has exactly this energy value.

The numbers in `SANDWICH_INGREDIENTS` are rounded **generic-food estimates**, not an imported or individually verified nutrient database, brand labels, measured recipes, or medical nutrition advice. Each item retains its English reference-food description, an appropriate reference database URL, and `provenance: generic-food-estimate`. Those URLs identify the reference systems, **not evidence that the exact value was retrieved from a matching record in this session**. Composite dishes (porchetta, kebab, hummus, falafel, sauces and breads) can vary substantially by recipe and brand. Exact food-code validation and custom baked-yield modelling remain separate work; do not describe these estimates as validated nutrition.

Primary reference systems:

- [USDA FoodData Central documentation](https://fdc.nal.usda.gov/data-documentation/) explains the distinction between generic analytical foods and manufacturer-provided branded data.
- [ANSES Ciqual](https://ciqual.anses.fr/) is the French food-composition reference. Its values are food averages and depend on the exact food and preparation basis selected.

The displayed “lighter” selection means at least **20% less estimated energy than the mean of this catalogue’s classic recipes in the same bread family, with identical bread grams**. This is an explicit internal comparison, not a regulated nutritional claim or a guarantee of better health. `comparisonKcal` is calculated from actual classic catalogue recipes at full precision; the current filling quantities are reassessed with `isLighterSandwich` after edits. Each family includes at least two qualifying options. A larger filling or extra sauce can remove the classification.

## Preparation and food handling

Instructions cover vegetable washing/cutting/draining, sauce mixing, roasting or sautéing where required, warming cooked fillings, appropriate bread opening/folding, assembly, and refrigerated resting for pan-bagnat-style fillings. Cold sandwiches legitimately require preparation without a cooking stage. Steps are rebuilt when a filling ingredient is removed, so an omitted egg does not leave an egg-cooking instruction.

Ready-cooked meat is clearly named. Reheating guidance uses package instructions and 74°C throughout for cooked leftovers; minutes are task estimates, not a safety guarantee. The panuozzo sequence reserves raw greens and cold sauce until after its oven finish. Hard-boiled eggs require firm whites and yolks. Perishable fillings should be chilled promptly and kept at 4°C or below; the time outside refrigeration is limited to two hours, or one hour above 32°C. These limits are particularly relevant in Singapore. Product use-by instructions still apply.

Primary safety references:

- [USDA FSIS: leftovers and food safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety).
- [FoodSafety.gov: safe minimum internal temperatures](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures).

Allergens identify expected ingredients, not a certified allergen-free result. Product formulations can add allergens; bread may carry sesame or other toppings beyond its baseline gluten. Vegetarian cheese recipes require cheese labelled vegetarian/non-animal rennet. Meat/fish removal and brand substitutions should be checked against actual products; the base recipe’s allergen list is intentionally not an allergy-safety guarantee.

## State, shopping and serving

- Canonical family/ingredient/recipe definitions: `app/lib/sandwichCatalog.ts`; pure state helpers: `app/lib/sandwich.ts`.
- Selection quantities count complete sandwich or tartine servings, independent of parent loaf/pan count. Filling totals sum identical ingredient IDs across recipes.
- Shopping contains filling ingredients; the UI joins these with the parent dough ingredients rather than adding purchased bread a second time.
- Family switching explicitly resets selections, overrides, shopping/prep ticks and serving progress; unrelated pizza state is separate.
- Valid per-recipe customization can survive zero selected quantity. Restored quantities are finite nonnegative integers capped at 99 per recipe; unknown/foreign-family IDs and invalid overrides are rejected.
- Filling shopping keys include their current total grams. Prep keys include recipe, step, serving quantity and every effective ingredient amount. Changed grams invalidate affected checks; completed portions reset for the edited recipe.
- Parent dough shopping keys use `dough:{ingredientId}:{grams}` and survive normalization. A changed quantity creates a new unchecked key; obsolete keys cannot check the new amount.
- Rebaking preserves selected fillings and custom grams but resets task/served progress.
- Serving queues retain each recipe separately and clamp completed portions to the selected amount.

Domain tests cover catalogue coverage, shared shopping, family isolation, invalidation, hostile/stale restore data, customization before selection, rebake and independent serving queues. Nutrition tests are reviewed separately. Unit tests demonstrate software contracts, not biological or nutritional validation.


## Tartines for sliced loaves — 22 September 2026

The `tartine` companion family maps explicitly to `pain_campagne`, `pain_levain`, `pain_complet`, `pain_seigle` and `pain_mie`. It does not alter the selected dough or offer a second bread selection. Brioche, pain viennois and fougasse remain unmapped until suitable content is added; unknown style keys remain unsupported.

Six editorial combinations: avocado and hard-boiled egg; goat cheese, honey and walnuts; ham and Emmental; mushrooms and ricotta; tomato, ricotta and basil; tuna, yogurt and cucumber. Existing ingredient definitions are reused, including the **peeled hard-boiled egg**; no poached/fried egg estimate or cooking claim is introduced.

One tartine quantity is an **open-faced portion with 60 g baked bread**, consisting of one large slice or several smaller slices, not one loaf and not a guaranteed slice count. Preparation weighs that portion, optionally toasts it and keeps assembly open-faced. Toppings and shopping scale by portion; parent dough ingredients continue to represent the entire bake once. Switching between the five supported loaf styles retains the tartine selection because the companion family is unchanged.

Bread energy uses an explicitly generic sliced-bread reference of 250 kcal/100 g. This is neither analysis of the user's loaf nor a claim that country, sourdough, wholemeal, rye and sandwich loaves have identical energy or allergens. The existing nutrition and bread-product allergen limitations above apply. The two lighter choices retain the same 60 g reference bread portion and satisfy the existing internal comparison against the family classics. The fallback illustration uses the existing country-bread image; it is not a photograph of the assembled tartine.
