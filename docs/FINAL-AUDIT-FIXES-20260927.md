# Final audit corrections — 27 September 2026

User authorized implementation after the independent final audit. This update targets the existing candidate PR, not production.

## Corrections

- Replace lean-bread fallback guidance for brioche, pain de mie and pain viennois with family-specific shaping, proofing, oven, baking and cooling instructions. Enriched mixing instructions expose ingredient order, progressive butter incorporation and a practical stopping/cooling criterion.
- Preserve supported minimum cold rests (4h brioche, 4h mie, 3h viennois) in the final chronology; explain insufficient time and repair initial recommendations using the complete schedule.
- Use one quantity-aware division duration in planning and preparation. Piadina rolling follows rest. Minute-precise guide times match the schedule.
- State the supported 100% starter hydration before planning; distinguish it from feeding ratio.
- Keep retained sandwich ingredients, sauces and assembly instructions consistent after removals.
- Clarify cooked chicken recipe weights, estimated raw breast purchases and 74°C separate cooking; retain explicit uncertainty for yield. Share/export purchasing notes consistently. Estimate egg purchases while preserving weighed recipe quantities.
- Scope pizza completion to selected quantities, including a 1-of-24 selection. Allow direct quantity entry and correct herb station classification.
- Distinguish local resume from account history before starting a new bake. Remove the self-linking Plan action and irrelevant piadina fermentation-container disclosure. Align domestic oven rack guidance.

## Validation

392 unit/component tests pass; isolated production build passes, including TypeScript and translation checks. Independent final code review found the reported completion-scope, cold-minimum and enriched-main-instruction issues resolved. Mobile assertions were updated to the intended Save/account behavior, preparation overview arrival and current piadina label without removing navigation, persistence or hit-target checks.

New remote WebKit run is pending. Previous candidate run had 316 passes and 28 stale-assertion failures; it is not evidence that this update passes. Protected preview authentication, authenticated account/share behavior, physical Safari and actual kitchen outcomes remain unverified.

## Culinary basis and limits

Enriched protocols use King Arthur Baking brioche / pain de mie guidance and Moulin Fritz pain viennois guidance as reference points, adapted to the existing formulas and scaled piece weights. These adaptations require a real baking trial; they are not a kitchen validation. Cold minima retain the application's existing supported method rather than claiming universal biological requirements. Chicken raw yield is an explicitly approximate existing model; 74°C is the FoodSafety.gov poultry safety criterion.

- https://www.kingarthurbaking.com/recipes/brioche-recipe
- https://www.kingarthurbaking.com/recipes/pain-de-mie-recipe
- https://www.moulin-fritz.fr/wp-content/uploads/2016/05/recette-pain-viennois.pdf
- https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures

No new product mode or professional service-time guarantee was introduced. Production publication awaits final release approval.
