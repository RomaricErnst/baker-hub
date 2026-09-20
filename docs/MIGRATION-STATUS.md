# Migration acceptance — 20 September 2026

Branch: codex/prototype-migration-20260920. **Not ready for user acceptance yet.** Earlier preview builds were incomplete; deployment success is not evidence of feature parity.

## Preserved reference
Production remains at commit 7a118048886dadb572c426d0643db1dedd4f5b80, deployment dpl_FSS7hWNWHWLWoceZmgHZsrXezYEB. Both original working copies and Git history have verified archives in the parent project backups/migration-20260920 directory. Database and Storage are not part of these code archives. No schema changes made.

## Integrated, awaiting final browser verification
- 244 pictured branded flours, 12 generic types, archived lookup records; local approved photos for all 156 pizza recipes and nine bread styles.
- Direct flour search, large photo/specification dialogs, localized type labels; wholegrain catalogue type variants retain wholegrain calculation behavior.
- Compact progress; picture selection cards; explicit review before generating; optional temperature preparation in setup; mixer batch count configured once.
- New menu with clear Save/Saved language and accessible dismissal; profile, sharing and account operations retained.
- Ingredient ANY/ALL filtering, corrected Quick criteria, savoury/dessert isolation, secondary custom creation and Shopping access after any selection.
- Recipe water shown once with folded preparation breakdown; contextual preparation actions and approved technique pictures; bread cooling action; approved bilingual FAQ replacements.
- Actual preparation order in Prep and Bake. Approved pizza images used consistently instead of legacy image variants.
- Commercial yeast calculation continuity, final-dose dilution instructions and exact aliquot water accounting corrected. Graph calculations use entered fridge temperature consistently.
- About copy no longer describes estimates as validated guarantees.

## Acceptance evidence and remaining blockers
The complete regression suite now passes 59 tests, including graph rendering, guide content, flour-type mapping and recipe-display checks. TypeScript, i18n parity and the Webpack production build also pass. The local mobile browser reaches the French style and quantity steps successfully; cloud account and save/restore still require a signed-in preview session.

Brioche/viennois originally omitted essential enriched ingredients in both prototype and old implementation. Sourced complete formula integration, UI quantities and conservation tests are in progress. Do not count these styles as accepted until those checks pass.

Browser automation through CUA timed out. The alternative browser CLI successfully opened the local app and exercised the French mobile home, mode choice, style selection and quantity steps. The deployed preview fetch reaches Vercel login, and local placeholder account configuration cannot validate cloud login/save/restore. Do not claim account or complete deployed visual verification until a signed-in browser session is checked.

Required before review handoff: complete EN/FR mobile/desktop journeys; direct, poolish, biga and sourdough paths; recipe/steps/graph agreement; save/reload/resume/rebake; profile/sharing/shopping; independent original-audit review; successful final build and deployed preview verification.


## Latest parity checkpoint — 20 September

Still **not ready for acceptance**. Integrated flat oven choices, oven/mixing tabs,
shared quantity controls, compact climate controls with optional water preparation,
recipe totals before preferment stage detail, the grouped menu and rustic-board bread
assets. Removed the style-page preferences tip and duplicate refrigerated-flour control.

The 67-test regression suite passed before the final small quantity/unit and thermal
integration edits. A targeted refrigerated-flour regression has been added. Final
TypeScript/build and EN/FR visual journeys at phone/tablet widths remain required.
Local preview and browser automation are resource-constrained: browser reports
“Resource temporarily unavailable”; local HTTP requests time out while compiling.
Agent workers have exhausted their usage limits. Do not call this visual parity verified.

### Mobile walkthrough follow-up — 21 September

The Vercel checkpoint 0169a70 built successfully. A 390×844 browser walkthrough
reached style, quantity, equipment, climate, flour details/selection, yeast,
planning, review, recipe, guide, menu/settings and pizza catalogue. Screenshots
revealed further mismatches; this is not acceptance sign-off.

Follow-up corrections restore the exact whole New York pizza asset, preparation
name and saved name, single-step guide presentation, shopping country settings,
visible pizza review bar above bottom navigation, larger quantity touch targets,
and explicit shopping/preparation routes from pizza review. Duplicate scale advice
is consolidated. Header Back now follows the real step list rather than numeric IDs.

Follow-up tests: recipe/guide/session set 9 passed; guide visual/content set 5 passed;
pizza parity set 4 passed; refrigerated-flour/mass set 5 passed. TypeScript passed
before the final guide and pizza layout changes; the next deployment must pass its
build and be visually checked again. Remaining: final phone/tablet and EN journeys,
all-step browsing/completion, named save/restore and full prototype page comparison.

### Deployed acceptance checks — 21 September, continuation

The branch is still withheld from final acceptance while the sourdough restore
fix is checked live. The previous signed-off-looking preview was premature.

Verified on the protected Vercel branch at phone and tablet widths:
- Full-width stacked tabletop and masonry oven choices; mixing stays in its own
  equipment tab. Shared quantity controls work for pizza and bread.
- Climate title and optional water preparation now match the approved direction.
- Pizza selection survives browser reload. Shopping, alternatives, preparation,
  and cooking are reachable without scrolling to the catalogue bottom.
- Multiple ingredient selections keep their section open; ANY/ALL selection works.
- French/English switching retains the pizza preparation page and quantities.
- Settings have an explicit close action; the grouped menu is deployed.

Browser checks caught and corrected a localized shopping-note object crash,
lost navigation during language changes, and missing saved starter events.
Sourdough testing also found levain erroneously entering the commercial
preferment calculation. The engine now keeps these paths separate; the recipe
uses the chosen ripe-starter amount and subtracts its flour/water from additions.

Current checks: 76 regression tests passed, TypeScript passed, i18n keys passed.
The last tested live deployment before the levain fix was 9f5672f; 8083358 is
being deployed. Do not equate build success with the outstanding live checks.
Signed-in cloud save/share and an independent agent audit remain unverified:
all three available audit workers returned usage-limit errors.
