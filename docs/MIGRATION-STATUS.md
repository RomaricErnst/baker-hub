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

## Review checkpoint — 21 September 2026, cc76157

This checkpoint supersedes the test counts and reviewer availability above.
Three fresh review agents completed independent checks of prototype parity,
starter restoration/rebaking, and the original engine findings. Their concrete
fixes are integrated in cc76157. All 85 regression tests and TypeScript pass.

Corrections include normal numeric typing, independent step completion,
fresh starter planning for sourdough rebakes, sugar adjustment in preferment
dosing, buffered dough totals, starter-aware flour blend quantities, and actual
preferment yeast percentages. Main water accounting passed the final review.

The preceding 611628c deployment was checked for stable starter amounts after
reload (115 g), canonical feeding times, and the simplified recipe layout.
cc76157 is awaiting post-deployment browser acceptance. Signed-in cloud save
and sharing have not been exercised. Scientific models remain estimates;
these regression checks do not constitute experimental biological validation.

## Final acceptance round — 21 September 2026

This checkpoint supersedes earlier counts and reviewer availability. Three
independent reviewers completed the renewed prototype, UX and engine review.
The 176d441 online build passed explicit flour selection, live bag-image upload,
climate and preferment numeric editing, generated guide navigation/focus, and
pizza selection through shopping and ingredient help. The 972-case independent
recipe accounting matrix reported no failures; these are software checks, not
experimental fermentation validation.

The final live pizza walkthrough found an overflowing detail panel. The follow-up
bounds the panel, scrolls its contents while retaining close/quantity controls,
and adds keyboard focus containment/restoration and 44px quantity targets.
Remaining country/origin labels and generic Italian-shop wording are localized.
All 114 regression tests and TypeScript pass. Final deployment and targeted
online panel checks are the remaining acceptance gate for this follow-up.

Real signed-in cloud save/share and physical camera capture have not been
exercised; save/share payload and failure paths have automated coverage, and
online image-file scanning has been exercised. Original site/code backups remain
as recorded above; this is the migration branch, not a replacement of main.

## Screenshot feedback correction round — 21 September 2026

This supersedes the preceding acceptance language: user screenshots exposed
material UX and schedule defects that the earlier checks missed. The corrected
round contains direct flour selection with optional details, visible catalogue
filters, consistent second/third flour entry, keyboard-operable blend ratios,
wide opening photographs and consistent illustrated equipment cards. Style
selection is explicit. Review rows show all flour proportions and actual timing;
hydration advice sits beside its input and total-formula percentages beside grams.

Preferment guidance uses practical incremental choices without unrelated badges.
The graph retains selected commercial preferments and blocks invalid plans rather
than silently changing method. Actions, graph, parent state, generated guide and
reload were exercised for biga and poolish, including bake-time edits. A dedup
bug that left parent dates stale and a fridge-removal bulk-start offset were fixed.
Guide instructions now use calculated doses and planned storage, keep final-mix
water out of preferment preparation, and handle rye, sugar and scheduled autolyse.
Duplicate help/navigation and contradictory FAQ claims were removed.

Verification: 144 automated tests, TypeScript and translation-key checks pass.
Local phone/tablet checks cover opening images, equipment, flour selection/details,
three-flour blending, guide layout and scheduling. Deployment and targeted online
verification follow this commit. Real signed-in cloud save/share and physical
camera capture remain outside the exercised scope; image-file scanning was
previously checked online. Numerical fermentation tests are not biological trials.

Follow-up before handoff: changing a restored preferment/yeast method now revokes
both the past-preparation exception and cached approval. Independent review and
146 tests pass. Unchanged selections retain legitimate resume behavior.

Online checks on 386a7bd/7db17b4/71403af exercised visible flour filters,
inline catalogue expansion, direct selection, optional details, second-flour
selection and keyboard expansion/collapse. Phone and tablet images/equipment
were inspected. Deployed restored biga/poolish method changes, date edits,
generation and reload agree. A fresh French bread journey reached ingredients
and guide; previous/next browsing did not mark steps complete. This caught
sub-hour duration rounding and hand-kneading copy, corrected in the follow-up.

The bread follow-up now preserves the exact end of mixing across room-temperature,
one-cold-stage and two-cold-stage schedules; rounding could otherwise remove
minutes from kneading. Short guide durations show actual minutes and hand mixing
has its own wording. 148 tests and TypeScript pass after these corrections.
