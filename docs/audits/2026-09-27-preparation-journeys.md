# Preparation, cooking and catalogue audit — 27 September 2026

## Implemented interface decisions

- The section navigator names the section. Preparation uses plain Dough / Fillings tabs, followed by one local progress control for the selected content.
- Cooking uses the same compact overview/resume control with a phase-local step count. The generic Preparation back link is removed when the targeted filling-preparation link is present. The latter remains near the top so a long or finished queue does not hide it.
- Existing-base journeys preserve the origin of late selection edits across reload and optional review. Preparation has one forward action, correctly labelled cooking while raw bread still needs baking.
- Prepared ingredients, assembly and final baking/chilling remain in their correct order. Draining mozzarella is grouped under “À anticiper”, not marinade/brine.

## Executed numerical audit

- 26 dough styles (6 pizza, 20 bread), 4 kitchen temperatures, 3 fridge temperatures, 4 horizons and 4 leavening methods: 4,992 actual production-function combinations.
- 600 additional elapsed-time scenarios with and without overnight availability blocks.
- Assertions cover finite nonnegative ingredients, mass balance, retained oven time, phase durations, unsupported method guards, unleavened bread and preferment accounting. Extreme/short cases test robustness, not universal feasibility.
- A separate 6,656-case schedule probe did not reach the known long-warm-exposure helper edge. That helper defect was nevertheless corrected conservatively: invalid positive warm exposure remains not recommended in a mixed warm/cold calculation, rather than being treated like no warm exposure. Calibrated coefficients remain unchanged; the existing warning contract is retained.

## Catalogue audit

156 materialized pizza recipes and 91 bread fillings across 14 families were inspected through their real catalogues. Regressions cover recipe/style/quantity combinations, ingredient removal and preparation/service ordering. Confirmed corrections include sausage preparation, egg guidance, speck finishing order, ready-to-eat foie gras wording, cheese categorization, and bread-dependent preparation/finishing actions.

Chicken cooking is the default preparation step; three recipe titles no longer require already-cooked chicken. Listed cooked-weight quantities are weighed after cooking; ready-cooked chicken is only an alternative. Known custom-pizza ingredient references now inherit preparation guidance, and incompatible ingredient preparations no longer overwrite one another. Completion keys include instructions and quantities.

Primary food-safety references used by the catalogue reviewer:
- USDA FSIS, Sausages and Food Safety: https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/meat-catfish/sausages-and-food-safety
- USDA FSIS, Safe Minimum Internal Temperature Chart: https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart
- FDA, What You Need to Know About Egg Safety: https://www.fda.gov/food/buy-store-serve-safe-food/what-you-need-know-about-egg-safety

## Limits and follow-up

These are code audits, catalogue checks and numerical simulations, not experimental baking validation or thousands of browser journeys. Sourdough final inoculation is not directly calibrated against final-dough duration and fridge temperature. Enriched dough thermal estimates omit milk/egg/butter temperatures. Some conditional handling tasks are absent from availability modeling. Do not claim these model limitations were solved by the interface change.

Mobile regressions for pizza, baguette, bagel, piadina and existing-base late edits have been authored. Local browser execution and physical Safari verification are not established. Deployment build status is separate from browser test results.
