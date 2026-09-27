# Baking companion: simpler entry and household setup

The goal is a capable home cook with no baking experience completing a bake or meal through recommended defaults and observable readiness cues. Custom retains technical choices. Buying dough or using existing bread is a supported entry into the companion, not a reason to turn the homepage into a general recipe catalogue.

## Landing decision

Two independent agent reviews tested three local, working landing variants in fresh Chrome contexts at 320/390px and desktop widths (1280/1440). They independently ranked **B > C > A**:

- A: single large food photo per card. Familiar, but loaf imagery did not communicate sandwiches/wraps; 320px page needed more scrolling.
- B: one dominant image and two supporting examples per card. Chosen: broad range visible while keeping two whole-card actions and bread/pizza dominant.
- C: compact image/text rows. Fastest scan and shortest page, but the expanded bread range depended on reading the caption.

Initial screenshots with stale development CSS were discarded. The comparison was rerun only after checking the variant class and actual computed layout. Temporary variant controls were removed before publication. Final B has top-aligned images and explicit bread, sandwich, tartine and wrap copy. Existing-dough/bread entry is secondary.

These are specialist-agent evaluations and browser checks, not a study with first-time human participants or physical-device acceptance.

## Bread discovery

All 20 breads remain visible in four groups: sliced loaves; baguettes/sandwich breads; flatbreads/pockets; enriched/sharing breads. Optional in-page jump links reduce scrolling without hiding results or adding a required choice. Selecting a style opens quantity directly. Each card states compatible uses; brioche has no sandwich step. Seed choice for sourdough bread now appears with quantity.

For individual breads such as pita and bagels, a mismatch between selected sandwiches and planned breads is explicit in the selection review. “Make N breads” updates the batch in one tap, preserving the option to bake spare bread. Loaves/trays keep separate bread-weight accounting rather than assuming one loaf per sandwich.

## Existing base

`/[locale]/with-my-base` reuses the same filling catalogues. Bread/wraps go through selection, shopping, preparation and assembly. Purchased pizza dough goes through toppings, shopping, preparation and package-based baking/serving guidance. Dough temperature/time is not invented for an unknown purchased product.

Drafts and pizza shopping/preparation ticks use separate local storage keys from the homemade bake. Switching bases retains each bread family's choices. This is local-device persistence, not a new cloud sharing feature.

## Simple mode

- Missing equipment receives supported household defaults, with an explicit confirmation/edit screen. Existing saved equipment is retained.
- Hand and KitchenAid/stand mixer are prominent; other methods remain available in a disclosure.
- Kitchen temperature is visible; fridge/flour and water preparation are optional details. Warm-climate facts are not silently guessed away.
- Active-starter sourdough is available for supported breads. Equal flour/water weights must be confirmed; unknown/stiff starter proportions do not falsely lead to a nonexistent Custom hydration control.
- Starter readiness uses visible rise/bubbles and the existing known-peak path. Uncertain readiness opens feeding details and revokes a stale starter plan.
- A discovered contradiction in the known-peak fallback (ready now, but mix many hours later without another feed) is guarded explicitly rather than showing a green plan. See the starter regression tests.

A helper still needs to confirm the real equipment, starter facts and timing. No interface can guarantee bread tonight from any starter or room temperature. The complete meal is not physically kitchen-tested, and a share link that presets a task for another device is not implemented here.

## Recipe integration

New raw-chicken pita option includes ingredient-aware cooking instructions and preserves the existing cooked-chicken recipes and IDs. The avocado/poached-egg/feta tartine and optional pomegranate are included, with selective opt-in finishes on five other recipes. See the dedicated recipe notes for source and image details.

## Verification

Independent mobile interactions confirmed grouped bread → pita → quantity → fillings → Simple household equipment, bread-only brioche, four-pita quantity reconciliation, and purchased pizza through served/reload. Parent checks confirmed tartine optional ingredients, scaled shopping, reload, preparation/assembly, raw chicken quantities/instructions, base switching and wrap discovery. Production build/i18n/TypeScript passed; 249 unit/component/domain tests passed. All 76 mobile WebKit tests passed across 320/375/390/430px. The final timing-blocker persistence addition also passed a fresh Chrome generated → invalid → uncertain → reload flow and focused session tests.

Remote deployment browser access is not established by these local checks; Vercel deployment metadata confirms the branch build separately. Physical iPhone chrome/keyboard and authenticated cloud persistence remain untested.

Warm-kitchen acceptance limitation: two fresh 30°C active-starter cases (bake next morning at 08:30 and 07:00) were correctly blocked because the requested mix lay outside the observed starter-peak window. No successful 30°C active-starter end-to-end case is claimed from this iteration; a compatible 22°C case did reach recipe generation. This does not establish that all warm schedules are impossible. The interface must continue to reject an incompatible plan rather than promise any requested dinner time.
