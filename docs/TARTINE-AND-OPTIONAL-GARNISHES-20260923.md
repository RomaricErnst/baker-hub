# Avocado tartine and optional finishing touches

User-requested update: avocado tartine now uses a poached egg, feta, optional pomegranate, salt and pepper. Stable recipe ID and image path are retained so saved selections still resolve. Other recipes continue to use the existing hard-boiled egg ingredient.

Per portion: 60 g cooked bread, 60 g avocado, 55 g edible egg (about one egg), 25 g feta, 5 g lemon juice, 0.3 g salt and 0.1 g black pepper. Pomegranate is off by default; opting in adds 15 g per portion. All weights remain editable. The instructions toast the bread, mash the avocado, poach the egg, then assemble immediately. Ingredient removal changes the applicable preparation/assembly instructions.

Optional extras use the existing ingredient-override state, so shopping, approximate nutrition and local snapshots follow the checkbox. Defaults are zero; `optionalGrams` provides a suggested amount when enabled. Salt is explicitly permitted to have zero energy rather than inventing a caloric value.

Applied selectively to six recipes:
- Avocado tartine: pomegranate.
- Mortadella and burrata focaccia: pistachios. The title no longer promises mandatory pistachios.
- Smoked salmon and cream cheese bagel: capers.
- Mushroom/ricotta tartine, mushroom/ricotta focaccia and mushroom/provolone ciabatta: parsley.

Core ingredients, bread requirements and established classic identities remain in the base recipe. Photos that include optional extras are labelled accordingly in the recipe detail.

## Image

Built-in image generation; existing dish photo supplied as the edit target. Saved project asset: `public/images/approved/sandwich/tartine-avocat-oeuf.webp`, 1000×750 WebP. Source generated PNG remains in the thread's generated-images directory. AI illustration, not a photograph of a tested bake.

Final prompt:

> Use case: precise-object-edit. Asset: Bakerhub recipe catalogue food photograph. Regenerate this avocado tartine photograph to match the updated recipe: ONE thick rustic country sourdough toast spread with crushed avocado and lemon, topped with ONE softly poached egg (tender white, a little golden yolk visible), crumbled feta, a restrained scattering of optional ruby pomegranate seeds, visible freshly ground black pepper and a few delicate salt flakes. Replace all hard-boiled egg slices with the single poached egg. Keep the same warm natural side lighting, rustic wooden board, beige stone backdrop, appetising realistic editorial food photography and close three-quarter overhead view. Whole toast fits inside frame with comfortable margin. Landscape 4:3 composition suitable for existing catalogue crop. No text, labels, logos, utensils, extra toast, hard-boiled egg slices or irrelevant garnishes. Feta and pepper must be clearly visible; pomegranate is a light optional finishing sprinkle, not a dominant ingredient.

Verification: all 233 existing/updated unit tests passed, TypeScript and production build passed, 88/88 catalogue image assets decoded with the expected aspect ratio. Local browser checks cover the updated recipe and optional selection. Account saving and deployed browser behavior are not established by these local checks.

The landing-page concept is a separate in-conversation prototype: homemade pizza/bread remain the primary entry, with a secondary existing-dough/bread/wrap entry that bypasses dough-making. It is not implemented as an application route in this recipe update.
