# Six-section navigation — approved direction

Status: user approved implementation on a separate preview branch after completing sandwich imagery. The existing migration preview remains the comparison baseline; main/production must remain unchanged.

## Final section names and ownership

1. **Ma fournée / My bake**: bread or pizza, specific style, dough quantity, optional compatible toppings/fillings and their quantities. Bread and filled-serving counts are distinct.
2. **Organisation / Organisation**: Simple/Custom, oven and mixing, kitchen conditions, flour, yeast/starter, preferment when applicable, dough preferences, baking time and availability, fine tuning and review. This is where scheduling inputs are edited.
3. **Recette / Recipe**: calculated dough ingredients and selected fillings.
4. **Courses / Shopping**: one destination for dough and fillings, including plain dough without any companion selection.
5. **Protocole / Method**: dough preparation and filling preparation, existing timings attached to actions, progression/checklists. No duplicate scheduling editor. A link to Organisation changes times. Do not call this section Planning.
6. **Cuisson & service / Bake & serve**: preheat, applicable bread poaching/baking/cooling, pizza cooking queue, sandwich/tartine assembly and service. Preserve original step identifiers and completion state.

## Navigation

- One compact active-destination control opens all six cards in a two-column, three-row panel. Selecting a destination closes it. No rotating carousel, no permanent dough/companion bottom tabs, no second persistent phase rail.
- Cards have clear descriptions and a visibly selected state. Final labels above supersede the earlier mockup's Paramètres/Préparation wording.
- Every page has useful forward/back or return links; the menu is optional for following the ordinary flow.
- Optional garnitures appear only once a compatible style is chosen. Do not ask for a different bread to select a filling.
- A late toppings/fillings invitation in Protocole returns to that same destination, preserving dough settings and checked work.
- Main selection and Organisation support detailed subpages with named return controls.
- Do not reset recipe selections, shopping/preparation ticks, queue progress, or scheduling state simply by navigating.
- Saved legacy destinations must resolve to the appropriate new section.

## Design reference and limits

`continuation-reference/navigation-six-20260922.html` preserves the last interactive discussion mockup before the final Organisation/Protocole naming correction. It is a design reference with simplified, simulated state, not the production implementation or a tested Safari layout.

The real application must retain the complete existing calculations, recipes, filters, ingredient customisation, saving, languages, shopping helpers and protocol content. Structural navigation changes must not change fermentation calculations.

## Verification required before claiming completion

Complete pizza and bread flows, dough-only shopping, traditional-loaf tartines, late fillings and return, restored sessions, both modes/languages, blocked setup correction, check-state preservation, and narrow WebKit geometry. Native Safari toolbar/keyboard animation still requires physical-device review.
