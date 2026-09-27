# Chicken pita preparation — 23 September 2026

## Recipe identity and quantities

Added `pita-poulet-cru-citron`, “Poulet citron · à cuisiner cru” / “Lemon chicken · cook from raw”. This is the new raw-chicken meal entry; the catalogue now has **89** recipes. Existing `pita-poulet-citron` and `pita-poulet-shawarma` IDs, ingredient quantities and saved selections remain intact, explicitly titled as already-cooked chicken. No raw/cooked weight conversion or saved-selection migration occurs.

Per new raw-chicken pita: 100 g raw boneless skinless chicken breast, 25 g yogurt, 70 g cucumber, 20 g lettuce, 8 g lemon juice and 3 g olive oil, plus the existing reference 80 g baked pocket pita. Four portions therefore list **400 g raw chicken**, 100 g yogurt, 280 g cucumber, 80 g lettuce, 32 g lemon juice and 12 g oil. Bread dough is still calculated by the parent bake; the 80 g bread reference is the calorie basis, not a measured baking yield. These are editorial portions, not a tested claim that one pita satisfies every person's appetite.

The raw chicken ingredient uses a rounded generic estimate of 120 kcal/100 g, separately from cooked breast at 165 kcal/100 g. It retains the catalogue's explicit `generic-food-estimate` provenance. No exact food record, nutrient analysis, cooked yield or retained-fat measurement was validated. All listed oil is counted. The finished dish image is intentionally copied from the existing lemon-chicken pita: the two preparation routes produce the same type of visible dish; this is illustrative generated imagery, not evidence of a cooked trial.

## Preparation behavior

All three pocket-pita chicken recipes now have specific instructions instead of generic carrot/tahini/cheese directions. Instructions list only the retained vegetables and sauce ingredients. Removing chicken removes its handling and cooking steps; removing yogurt, lemon or oil removes its associated instruction. Raw chicken has separate chilled/thawed handling, strip thickness, clean utensils, pan batches, temperature check and assembly steps. The measured oil is used in the pan; lemon belongs to the yogurt dressing. No unlisted seasoning is required.

Start the chicken close to pita baking, or after the pitas leave the oven when cooking alone. Mix the sauce in a clean bowl and assemble only once bread is baked and safe to handle. Indicative 6–10 minute pan time applies **per batch**, never as proof of safe doneness or a guaranteed dinner deadline. The existing planner does not become a validated complete meal scheduler through this recipe addition.

## Authoritative food-handling references

Checked 23 September 2026 via indexed official USDA FSIS pages (direct page opens returned unavailable/403 in the browsing tool):

- [FSIS poultry minimum temperature](https://ask.fsis.usda.gov/article/To-what-internal-temperature-should-I-cook-poultry): 165°F / 73.9°C measured with a food thermometer. Recipe rounds upward to **74°C**, checked at the centre of the thickest pieces before removal from heat.
- [FSIS washing poultry](https://ask.fsis.usda.gov/article/Should-I-wash-chicken-or-other-poultry-before-cooking): washing can spread contamination. Recipe says not to rinse chicken.
- [FSIS cutting boards](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/cutting-boards): separate raw-meat and ready-to-eat preparation surfaces and wash boards with hot soapy water. Recipe uses a separate board and clean hands, tools and serving plate.

The earlier catalogue's prompt chilling and time-out-of-fridge instructions remain. These references support handling guidance; they do not validate the editorial ingredient ratios, pan time, flavor, pita capacity, meal schedule or result.

## Verification

Image coverage passed for all 89 assets; the checker permits identical pixels only for the documented raw/cooked lemon-chicken pair. TypeScript checking passed. 17 targeted tests passed: chicken-pita, sandwich-domain and sandwich-science suites. Coverage includes raw versus cooked shopping totals, altered raw weight, retained old saved recipes, temperature endpoint before assembly, ingredient-removal instructions, catalogue count, energy assumptions and unchanged sandwich domain behavior. No physical cooking, eating, baking or full novice journey was performed for this bounded change. Parent integration owns the overall Simple journey, UI labels and timing validation.
