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
