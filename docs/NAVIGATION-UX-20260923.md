# Navigation refinement — 23 September 2026

## Purpose and references

The baker should immediately understand the next action and be able to reach any part of the current bake without hunting for features. Sandwiches and tartines belong to the same journey as dough, not a separate companion workflow that accidentally bypasses bread preparation.

This review branch starts at `5a16793` on `codex/navigation-six-sections-20260922`. The user's immutable preview `baker-p3w22y06b-thebaker-hubs-projects.vercel.app` is the earlier `b75b4e5` build. Preserve both that branch and `codex/prototype-migration-20260920` for comparison. Production/main is not part of this change.

## Specialist advice

Two independent UI/UX agents reviewed the source, specification and rendered mobile screens before the revised implementation. Both supported the six-section structure. Their primary finding was the misleading forward path from shopping directly to fillings and then assembly. They recommended:

- Keep style → quantity → optional recipes, with compatible food photographs.
- One prominent next action; a quieter explicit option to continue without garnitures.
- Keep six section cards collapsed initially, with icons, descriptions and “Voir les 6 rubriques”.
- Make the existing section control sticky rather than add another navigation rail.
- Guide shopping → dough preparation → fillings → baking → assembly. Direct section/local-view access remains available; checkboxes are never gates.
- Use destination-specific labels for sequential return links and selection edits.

The mobile specialist accepted the revised 390px screenshots and reviewed navigation logic. This was a visual/source review, not an independent complete interaction test.

## Implementation

- Illustrated discovery card after quantity: three pizza recipes, or three recipes for the selected bread family, including tartines for traditional loaves. The whole preview opens the existing catalogue; it never silently selects a recipe.
- The footer exposes “Choisir mes pizzas / sandwichs / tartines” and the quieter “Continuer sans garnitures”. After selection, the ordinary organisation action resumes.
- Quantity displays the chosen dough with “Changer de pâte”. The style action explicitly says “Choisir la quantité”.
- Sticky section disclosure follows the visible/hidden brand header. Its expanded two-column grid is bounded and scrollable on short screens. Selection, outside click and Escape close it.
- Subsequent sections use visible named previous-section links; local setup back behavior and named return-from-edit behavior are preserved.
- Recipe offers shopping as its main next action, with a quieter shortcut for users who already have ingredients. Selection links say “Modifier…” instead of promising read-only recipe viewing.
- Shopping starts the dough protocol. The last dough-preparation step offers selected garniture preparation. Garniture preparation leads to the cooking guide. Bread cooling ends with sandwich/tartine assembly; pizza's cooking guide links into its cooking queue.
- Section-menu jumps preserve local views. Only the recommended forward path chooses the appropriate dough/baking view.

No fermentation calculations, recipe quantities, authentication or production configuration are changed.

## Verification

Validation results are recorded in the latest `PROJECT-HANDOFF.md` entry. Mobile tests cover all six sections, both modes, English/French entry and navigation, dough-only shopping, recipe selection and return preservation, illustrated tartine discovery, and the complete shopping-to-dough-to-fillings-to-baking-to-service route.

Physical iPhone Safari toolbar/keyboard behavior and authenticated cloud saving remain outside this local verification. The recipe section still uses the existing catalogue for editing selected recipes; a dedicated read-only selected-recipe summary is a future refinement, not part of this revision.
