# Bakerhub — continuation handoff

## Coupled scheduling controls — 24 September 2026

User reported misleading green validity and stale later actions during a mixing drag. Code inspection confirmed the green background only showed free calendar time; early preferment failures returned no candidate schedule, leaving downstream rows unchanged. The horizontal reference keeps preferment offset when mixing moves and changes the offset independently when preferment moves.

Commercial plans now show two compact vertical controls together (one for direct dough) on a shared linear axis. Green slots use the same full builder/method/availability checks as Apply; grey is incompatible, hatching marks unavailability. Mixing shifts preferment with it; if that lands on an unavailable/past preparation, search the existing maturation window for the closest viable preferment. Preferment-only edits keep mixing pinned and report the maturation conflict instead of silently moving it. Every buildable candidate previews later dough actions even if a preferment constraint rejects it. Both handles may be adjusted before one Apply/Cancel; fixed bake remains fixed. Complex starter plans retain the prior editor and restrictions. No new biological calibration or implicit RT/fridge switch.

Quantity/navigation application f0844f202548f9229e57f3d826915554554bd6ad deployed READY as dpl_6FotRDEbyXPkWNjkggjrTLBUMfuk. Browser confirmed direct 280g entry, oven then mixing and climate Back preserving selected stand mixer. CI35974008764 passed 121 cases; 7 new quantity/equipment cases read debounced storage before its write. Tests now wait for the exact persisted value. No claim that this first mobile run fully passed. New scheduling regression covers linked handles, independent preferment, downstream preview, Apply and undo. Local278 tests and build passed before publication; new mobile results pending. Spiral-ice default remains unchanged pending the conditional-default design decision; selecting a spiral alone does not imply compatible model.

## Lighter quantities and consistent step navigation — 24 September 2026

User approved simplifying quantity entry, equipment and navigation on the prototype. Removed the repeated total-mass card; the recipe retains totals. Round-pizza mass is directly editable with a suggested-weight reset; diameter/crust changes preserve an explicit override. Fillings invitation now has a short heading and pictures. Routine forward buttons say Continuer / Continue; return-to-recipe and generated-output actions retain explicit destinations.

Four then Pétrissage are sequential choices in the equipment section, with preserved choices and a Change oven shortcut. Shared setup footers pair Précédent / Back with the primary action; header Back follows the same path. Back from climate returns to mixing, then oven, then mode selection. The footer is hidden during pending schedule edits and manual flour entry. Equipment swiping cannot skip the mixing choice.

Local TypeScript, 276 tests, production build/i18n and diff checks pass. Added mobile regressions for manual weight, recommendation reset, sequential equipment and Back preservation in Simple/Custom. Deployment and mobile CI results pending at this checkpoint. No scheduling-engine or production changes. On the question of spiral ice defaults, recommendation is conditional on cooling demand and confirmed mixer compatibility; this revision does not silently change the existing water method.

## Maturity windows and vertical schedule editor — 24 September 2026

User approved a direct branch prototype. The previous editor incorrectly froze the preferment recommendation as a required duration. Commercial edits now preserve the other anchor when inside the existing method's recommended window, otherwise search quarter-hour offsets and revalidate the full schedule. The window uses the existing getPrefOptH/prefZoneConstants temperature/storage model; no new fermentation calibration. Current storage mode is retained and explicitly shown. Fixed baking time is preserved; later baking remains a separate explicit proposal. Complex starter plans retain their existing restrictions.

Selected actions reveal a linear vertical time slider, shaded unavailability, exact date/time fallback, Apply/Cancel and undo. The surrounding agenda remains compact and is not itself a draggable time scale. Only the handle consumes touch scrolling. The slider spans candidate times, not a guarantee that every point satisfies all downstream constraints; the actual builder validates each edit. Planning copy becomes “Planifier la préparation” and “Mon planning”.

Final app commit `ce1e4ebac1f1e695df24c30706d46973f7015a3c` (local `bc83f7d`, identical tree `40d77fda01653f86bb056cb7ece15b902122a0fa`) is deployed READY as preview `dpl_D1WAYmSbuFpCZB2Uc8HfMtyQn2dt`. CI [35968545932](https://github.com/RomaricErnst/baker-hub/actions/runs/35968545932) passed 276 unit/domain/component tests, build/i18n and all 120 macOS iPhone-WebKit tests across 320/375/390/430px (7.9 minutes). Local TypeScript passed.

Regression includes poolish 15:00 → mixing 07:00 → bake 18:00 with 23:00–07:00 blocked, preserving morning mixing with 16h maturation in the cold-window test; cold-out availability, earlier-bake dependencies, slider keyboard interaction, Apply/Undo and persistence. Live browser also verified a fresh custom Nuvola/instant/poolish pizza at 22°C with fridge 5°C: moving poolish to 24 Sep 15:00 proposed 25 Sep 07:00 mixing, 16h cold maturation and unchanged 19:30 bake with night blocked. Apply, reload, Resume and opening Plan preserved all three times. Screenshot: `docs/vertical-schedule-preview-20260924.jpg`. Exact inputs are collapsed under “Saisir une heure précise”; directly dragging the selected native slider uses a regular scale. This is browser/emulator verification, not physical iPhone or baking acceptance. Production unchanged.

Observed pre-existing navigation limits during this check: Resume opened the first setup step (the persisted Plan remained accessible in the step overview); a family-change browser confirmation stalled one automation tab, so verification continued in a fresh tab. No claim these separate navigation behaviors were fixed by the scheduling work.

## Approved incised b icon — 24 September 2026

User selected concept 3 and authorized preview publication. Added a flat cocoa/ivory SVG master and actual 32/180/192/512px PNG exports, plus 16/32/48px favicon ICO. Incision belongs to the standalone icon; the bakerhub. header wordmark is unchanged. Versioned filenames replace the dough-photo references in metadata and manifest; manifest MIME types and dimensions now match the assets. Existing installed home-screen shortcuts may retain cached artwork. Regenerate PNGs with scripts/build-brand-icons.cjs. Visual check at 512 and 32px: legible b and open counter; incision subtle at favicon size. Preview only.

## Lighter bread catalogue copy — 24 September 2026

Removed the introductory optional-fillings sentence in French and English, without replacement. Bread/meal photos and their idea captions provide the hint; the existing “Continuer sans garnitures” action remains on quantity setup. No navigation or scheduling behaviour changed. Prior entry revision iPhone CI 35953246661 is now confirmed SUCCESS. This copy-only revision is preview-only.

## Existing-base entry and image consistency — 24 September 2026

User approved revising the entry without adding a step for from-scratch users. Pizza / Bread still goes straight to style and quantity. The existing-base shortcut is now on each family's style screen, not the landing page. Bread entry offers baked bread / dough inline, bread-only photos and explicit selection. Opening the shortcut never silently restores a prior bagel; a separate named Resume action restores it. Active preparation URLs carry `active=1`, so reload preserves the current preparation and section. Empty entry screens do not overwrite the saved draft. New preparation resets selections; changing bread inside an active preparation preserves per-bread selections and dough state. Six-section navigation appears only after selecting a base.

Baked bread skips redundant origin/state fields in Ma fournée; state correction remains in Organisation. The filling heading asks what to prepare with the bread. Bread and meal images in the from-scratch catalogue now both fill identical frames using cover, without stretching.

Verification: TypeScript, 270 unit tests and production build/i18n passed. Published app `15263fa09e4a2f31f8e6cc9ca068de74e87fd969`; Vercel preview `dpl_9EvrQ1CMqWccjBAS7YUxkquXAHY1` READY. Direct deployed browser checks confirmed Pizza/Bread open straight to styles, matching bread/meal frame dimensions and cover treatment, bread-only entry with no preselected bagel, explicit Resume preserving a filling quantity through reload, and a new baguette starting empty without origin/state fields. Existing pizza dough shortcut reaches toppings and retained dough-handling controls. Added a mobile regression for explicit resume, new bread selection and reload; updated raw-bagel entry test. CI 35953246661 passed unit tests, image checks and build; iPhone suite was still running at this checkpoint. Previous revision CI run 35949978019 is confirmed SUCCESS. Preview only; production remains untouched.

## Scheduling dependencies and existing bases — 24 September 2026

Continue on `codex/navigation-polish-20260923`; baseline reviewed was `ffbccc259ff88ebe01061cafe2a480b078aef771`. User authorized discarding only the agent's test bake, implementation and preview verification. No production deployment.

- Schedule time labels now open the editor directly. Separate date/time controls, ±15/30 minutes, one Apply/Cancel pair and one-step undo replace nested edit modes. Cross-day comparisons include dates; repeated compressed-interval and unsaved-proposal copy is removed.
- `scheduleEdit.ts` uses the production builder. Moving commercial preferment retains the currently selected maturation duration/storage protocol and moves mixing/dependent actions. The bake/serving target stays fixed. Invalid plans explain the timing shortfall or availability conflict; a later bake is a separate proposal requiring explicit Apply. No biological constants or maturity curves were invented. Complex multi-feed starter edits still require dedicated replanning.
- Accepted edits are written immediately to the local session. Restore guards now also protect pre-recipe schedules, and changing the baking time no longer remounts the scheduler and erases undo/accepted edits.
- Style Back returns directly to the opening choices without clearing the selected family/style/quantities. Re-entering the same family preserves work; changing families warns when selections would be reset. Browser history stores navigation, not duplicated recipe state.
- Existing-base journeys use Header/BakeNavigator and all six optional destinations, keeping their separate local draft. Distinguish existing dough from baked bread, purchased from homemade, and dough progress. Raw bread/bagels require baking/cooling confirmation before assembly; bagel poaching is explicit. Unknown dough fermentation is not guessed: original recipe/package instructions are retained as optional notes. Existing snapshots migrate and keep per-base fillings/progress. Bread slicing/toasting is deferred until after raw bread has been baked.
- Generic filling prep names only selected vegetables; bagel toast copy no longer mentions unselected salmon/cream cheese. Singular portions corrected.

Verification at implementation checkpoint: 270 unit/component/domain tests passed, TypeScript passed, production build/i18n passed. iPhone WebKit workflow now includes this branch; updated tests cover new controls, preferment propagation/reload before recipe generation, raw bagel gating and browser Back. Deployment/mobile runtime outcomes must be recorded after the preview checks; this checkpoint is not a claim of live verification. No physical baking or authenticated cloud-saving acceptance.

Publication authorization: Romaric explicitly approved “Go ahead and push to prototype” on 24 September, resolving the prior approval blocker. Local implementation commits: `cc1b19c`, `9f6a60e`. The command-line transport lacks GitHub authentication; use the connected GitHub app to publish the identical code snapshot as a fast-forward from `ffbccc259ff88ebe01061cafe2a480b078aef771`. Preview only; no production promotion. Record actual deployment and CI outcomes after publication.

Published application: `5a732d5025d0dc74bbb9ae57d2b30d5c986d1c87`, whose tree exactly matches the tested local snapshot. Vercel `dpl_CroZDHDEicYMW21C86TRkiwg5PB3` is READY (preview, Next.js, build 46.7 seconds). Stable URL remains https://baker-hub-git-codex-navigation-po-c489c6-thebaker-hubs-projects.vercel.app/fr . Direct deployed checks confirmed the six-section existing-base navigation and a fresh bagel mixing edit 04:30→04:45, fixed bake 11:30, dependent rest adjustment, Apply/Undo availability and exact 04:45 persistence after reload before recipe generation. This does not establish every preferment or mobile journey. CI run https://github.com/RomaricErnst/baker-hub/actions/runs/35949978019 passed unit tests, image validation and build; iPhone interaction suite was still running at this checkpoint. Check its final result before claiming mobile acceptance. No production changes.

## Bread framing and pain de mie recipes — 23 September 2026

Captions now sit below the 126px image frame; bread-only cards use a compact centered photo. New generated rye tartine uses a dark rye base. Pain de mie now illustrates a proper club sandwich and has its own club/croque family with slice counts and recipe-specific bread weights. Bread-dependent steps, including croque oven cooking, occur at serving after baked bread is ready. Existing saved pain-de-mie tartine selections are preserved until explicitly replaced. Purchased pain de mie is also available in the existing-base entry. Image prompts, saved asset paths and recipe sources: `docs/BREAD-IMAGE-FRAMING-20260923.md`. Full automated suite:265 passed. Final browser/build/deployment results are in the task.

## Mobile imagery correction — 23 September 2026

The user reported landing mosaic images covering copy on physical iPhone, and unreadably small/repeated meal examples. Landing photos now live in a fixed-height clipped grid with positioned image wrappers, separate from text. Bread catalogue cards use a shallow 126px bread/meal pair above the title, captioned as bread and optional meal idea; plain breads keep one image. All five sliced breads now illustrate distinct existing tartine recipes. One card still selects one bread; group jumps remain. Independent Chrome review at 320/390/1280 and parent Chrome/WebKit at 320/390 found readable examples and no image overlap or horizontal overflow. Build/i18n/TypeScript and catalogue asset mapping passed. All 28 focused mobile WebKit cases passed across 320/375/390/430px (24 initial passes plus four new geometry tests passing after correcting the expected laffa quantity label). Same preview branch and link as below.

## Planning, bread discovery and cooking — 23 September 2026

Continue on `codex/navigation-polish-20260923` in `/Users/romaricernst/Documents/Codex/baker-navigation-polish`. Same preview: https://baker-hub-git-codex-navigation-po-c489c6-thebaker-hubs-projects.vercel.app/fr . User authorized implementation, independent UX review, testing and preview push.

The unified dated agenda replaces competing planning views, with optional time edits, actual consequence previews, Keep/Cancel, invalid-edit blocking and availability above/in the timeline. Positive feedback follows edits only. Long waits are explicitly compressed. Simple and Custom use the same interaction. An independent reviewer preferred this over the old split views and fixed-scale mockup, then verified fixes for unsaved-draft navigation, preheat duration and separated conflicts.

Bread cards retain dominant bread photos plus small meal examples, clearer wrap names and a preserving Pizza/Pain chooser at the bottom. Simple temperature setup is compact; water preparation remains practical at the preparation stage. Recipe offers Courses as primary and Préparation as secondary with matching section icons.

Cooking is a forward sequence rather than competing guide/queue tabs: preheat → visible oven-specific instructions → pizza queue, or bread bake → cooling → serving/assembly. Cooking has local counters, while saved progress identifiers remain stable. Contextual Next is primary; no dead final Next. See `docs/PLANNING-AND-COOKING-20260923.md` for implementation and timing limits.

Build, i18n, TypeScript and all 259 unit/component/domain tests passed. Independent browser checks passed at 320/390px and desktop; final WebKit results are recorded in the linked implementation report. Complex multiple-feed starter edits still require dedicated replanning. Ready-time estimates are limited to supported protocols and clearly labelled endpoints, not arbitrary full dinner deadlines. No physical baking or authenticated cloud-saving acceptance is claimed.

## Latest entry and Simple-mode iteration — 23 September 2026

Continue on `codex/navigation-polish-20260923` in `/Users/romaricernst/Documents/Codex/baker-navigation-polish`. The user authorized testing and pushing all improvements to this preview branch. Two independent agents tested three working landing variants and both chose B: dominant pizza/loaf photography plus two supporting examples, still only two primary actions. All temporary A/B/C switches were removed. Four visible bread groups have optional in-page jump links; a style selection goes directly to quantity. Brioche remains a bread-only journey.

`/[locale]/with-my-base` now supports purchased pizza dough, existing bread and wraps without dough setup. It reuses catalogues and stores its own local draft/ticks separately. Pizza baking uses package instructions; bread goes directly to filling preparation and assembly. Individual-bread selection reviews can match planned bread count to sandwich count in one explicit tap.

Simple preserves supported sourdough, recommends missing household equipment, emphasizes hand/KitchenAid mixing, and keeps advanced kitchen/water details optional. Starter equal-weight hydration is confirmed explicitly. Ready-now and uncertain paths retain the validated planning engine; a discovered known-peak fallback contradiction now blocks incompatible later mixing rather than inventing a new peak or feed. The guard covers editing a previously generated bake, switching to uncertain readiness, and reloading the saved blocked draft. Valid nearby mixing was verified through recipe generation at 22°C.

Raw-chicken pita is a separate recipe with 400 g raw chicken for four portions, preserving cooked-chicken recipes. The avocado/poached-egg/feta/optional-pomegranate update and other opt-in garnishes from the previous commit remain included. See `docs/SIMPLE-AND-ENTRY-UX-20260923.md` and `docs/CHICKEN-PITA-20260923.md`.

Verification so far: production build/i18n/TypeScript passed; 249 automated unit/component/domain checks passed; all 89 recipe images decoded. Independent Chrome checks at 320/390 and desktop widths covered landing comparison, grouped bread, pita quantity reconciliation, bread-only brioche, purchased pizza through served/reload, and valid/invalid/uncertain sourdough. Parent checks covered optional tartine shopping/reload/preparation/assembly, raw chicken shopping/preparation, wrap discovery and base-switch preservation. All 76 mobile WebKit cases passed at 320/375/390/430px, including new existing-base persistence/isolation tests. Deployment results are supplied with the task preview link.

Warm-case limitation: two 30°C active-starter next-morning schedules correctly blocked; a positive 30°C case was not established. No claim of arbitrary hot-kitchen timing feasibility.

Limits: no physical kitchen trial, no new task-preset sharing across devices, and no authenticated cloud-saving acceptance in this iteration. Preview browser checks are local production-equivalent builds; deployment readiness is separately verified using Vercel metadata.


## Recipe update and next UX target — 23 September 2026

Avocado tartine now uses poached egg, feta, salt/pepper and opt-in pomegranate, with regenerated photography. Six recipes have selective optional finishing touches backed by existing ingredient overrides. See `docs/TARTINE-AND-OPTIONAL-GARNISHES-20260923.md` for defaults, image prompt and verification.

New product direction from the user: Bakerhub remains a baking companion, but should accommodate purchased pizza dough and existing bread/wraps without forcing dough setup. The landing-page entry is being explored in conversation. Simple mode's target user is a competent home cook with no baking experience, sent a chicken-pita task for tonight: minimal decisions, recommended defaults, hand/KitchenAid methods, actionable instructions. Custom is for expert control. The helper scenario requires a separate UX audit; do not claim the new beginner journey is already implemented by the recipe change.

## Latest prototype revision — 23 September 2026

For the navigation refinement, continue on `codex/navigation-polish-20260923`, created from `5a16793` on `codex/navigation-six-sections-20260922`. This entry supersedes the older active-branch instruction below for this task. Local checkout: `/Users/romaricernst/Documents/Codex/baker-navigation-polish`.

The user requested UI/UX specialist advice before proceeding and then explicitly approved revision. Two independent specialist reviews prioritized a coherent forward journey over cosmetic changes. The implemented path is quantity → optional illustrated pizza/sandwich/tartine discovery → organisation → recipe → shopping → dough preparation → selected garnitures → baking/cooling → assembly or pizza cooking queue. Direct navigation remains available; completion ticks are not gates. The section map stays collapsed initially, is sticky while scrolling, and now names its six destinations clearly. See `docs/NAVIGATION-UX-20260923.md`.

Verification: production build/i18n/TypeScript and 233 unit tests passed. Mobile WebKit: 60/68 passed initially; eight failures came from the renamed editing-link assertion and a test reading a debounced saved draft too early. Corrected those assertions (including waiting for the actual saved value), then all eight affected tests passed at 320/375/390/430px. All 68 cases are therefore covered by the passing runs. Complete pizza and bread forward journeys preserve checked preparation work. A specialist accepted revised 390px screenshots/source; the parent also inspected rendered quantity/card/menu screens. Physical Safari toolbar/keyboard and authenticated cloud saving remain unverified.

Keep original six-section and migration branches, plus main/production, for the user's later comparison. This branch is preview-only. Publication details are supplied by the deployment/PR attached to this task.

Updated 22 September 2026. Read this first. It supersedes the September 13 handoff and earlier acceptance summaries; older reports remain historical evidence, not current status.

## Resume the correct work

- Repository: `RomaricErnst/baker-hub` on GitHub.
- Active branch: `codex/prototype-migration-20260920`. Continue from this branch, not main or the old release-candidate branch.
- Latest application commit at this handoff: `c6193fb` (bread-first tartines, consistent navigation, narrow footer repair and visible correction actions when setup is blocked). Test-only correction `dfceeecd` passed final CI. Handoff/documentation commits may follow without changing application behaviour.
- Historical Mac checkout: `/Users/romaricernst/Documents/Codex/2026-09-11/create-an-image-of/work/baker-hub-migration`. Current checkout is `/workspace/scratch/81bba1c35e5b/baker-hub`; this temporary workspace is not a portable backup. GitHub branch is authoritative.
- Stable test URL: https://baker-hub-git-codex-prototype-mig-b4b24a-thebaker-hubs-projects.vercel.app/fr
- Latest immutable preview build (READY; mobile UI verified separately in CI): https://baker-oqisck8wk-thebaker-hubs-projects.vercel.app/fr
- Deployment: `dpl_G3T5GmRHSDQ7vuUAdeNv1onhiUZv`, READY, preview target only. New pushes can supersede it.
- Temporary Vercel share tokens expire; obtain fresh access if the preview requests login. Do not store tokens or credentials in this document.
- Vercel project `prj_qDz6tdakJGeFFtVApo9mpAU7rNQq`; team `team_WioBBEisA4hox7JpPyBX0Vtr`. Branch pushes auto-deploy previews.

The next task is to continue Romaric's mobile feedback and polish this branch. Actionable mixing-window feedback is implemented; biological maturity calibration remains separate. Do not represent the whole product as universally verified: limits below remain.

## Product and working agreement

Romaric wants the best baking companion: intuitive mobile journeys, useful features, accurate pizza/bread calculations, particular care for hot climates. Every label/help sentence should help a decision or action. Avoid redundant explanations, scientific lectures and unsupported precision.

The final prototype was the baseline. Preserve its accepted design except agreed improvements below. Earlier migrations missed many details, so inspect real screens and rerun affected journeys after fixes; a build or passing test count alone is not acceptance. User has authorized branch edits, preview deployment and specialist-agent reviews. Do not repeatedly request approval for these. Coordinate bounded agent ownership, integrate their work, and verify it yourself. Do not claim an agent is working unless it is. Explain outcomes concisely.

Current prototype reference is archived at `docs/continuation-reference/option-a-journey-20260920.html`. This is source/reference, not a self-contained deployed app: relative assets may require the original project. Original local URL was `http://127.0.0.1:8765/outputs/option-a-journey.html?revision=20260920-catalogue-complete`; query strings were cache revisions, not separate source versions. Later user-approved website refinements supersede that prototype where documented.

## Accepted changes to preserve

### Setup and navigation
- Simple and Personnalisé are both guided. Mode screen: “À votre façon”; Simple has recommended dough settings; Personnalisé explicitly names flour, yeast/starter and preferment. No repeated eyebrow/long question.
- Whole-subject opening pizza/bread photos; rustic wooden boards for bread. Compact style cards; consistent oven/mixer illustrations; small yeast/preferment photos.
- Flat oven choices include tabletop pizza oven and masonry oven. Oven/mixing use explicit subchoices, not legacy nested forms.
- Bake naming occurs in review, not style selection. No ambiguous “Brouillon/Local” labels.
- Hydration advice belongs with hydration control. Review lists actual choices, flour proportions and scheduling.
- Pizza exposes My dough/Pizzas immediately; bread exposes My dough/Fillings only after selecting a supported bread style. Continue sits above them. Generated dough exposes Plan/Recipe/Guide locally. Reading can collapse the header and bottom bar; upward scroll or Navigation restores them. See the latest navigation section below.
- Mobile header is 56px, hides after deliberate downward scrolling, returns upward; ignores small jitter. Setup progress and generated bake name scroll away. Controls retain practical touch targets.
- Latest iPhone safe-area fix (`44b7bac`): opaque action background reaches full width and bottom edge, with safe-area padding inside rather than transparent space below Continue.

### Header readability — 22 September 2026
- Header Menu and Save/Enregistrer use 16px Figtree, weight 500; Save has the subtle existing border color. Header actions have minimum 44px width/height.
- Mobile wordmark is 24px. Removed the obsolete below-373px hide rule; below 360px, header side padding is 0 and Menu/Save side padding is 6px to fit Back + wordmark + French Save + Menu.
- Existing 56px mobile header, scroll handling, callbacks, save guard and accessibility behavior remain unchanged.

### Flour and recipe data
- Flour catalogue was expanded/cleaned, premixes excluded, photographed products integrated locally. Historical migration checkpoint reported 244 pictured branded entries plus 12 generic types; re-count live data before making a new completeness claim.
- Preserve Caputo Cuoco and corrected product identities, French supermarket and Singapore purchasing relevance. Do not silently swap product photos or specifications. Inspect provenance and source records for edits.
- Main files: `lib/flourCatalogue.json`, `lib/flourDatabase.ts`, `lib/flourPhotoProvenance.json`, `lib/flourArchive.json`, `public/flour-database.json`.
- Direct card selection does not require zoom. Details/photo are optional. Visible filters, inline catalogue expansion; first/second/third flour selection stays consistent.
- Manual flour entry has visible 48px white/bordered controls, optional name/W/protein, one “Utiliser cette farine” action. Hide unrelated Continue while editing. Scan cancellation preserves search; uncertain matches require confirmation/type selection.
- Total-formula baker percentages beside grams; stage additions remain unambiguous. Preferment instructions use computed quantities/storage; final-mix water is not repeated in preferment preparation.

### Pizza and baking journey
- Ingredients, base and occasion are primary filters; dessert is secondary. Preserve ANY/ALL ingredient filtering and corrected Quick mapping. Choosing an ingredient should not collapse the selection prematurely.
- Custom pizza creation is secondary to browsing. Selection review stays accessible after at least one choice; no large disabled review bar for empty selection.
- Search is 16px (avoids iOS input zoom); filter/quantity controls are >=44px. Shopping location wraps on narrow screens.
- Alternatives/suppliers belong in shopping, localized to France/Singapore (including ordinary supermarkets/specialists where appropriate). Preserve concise ingredient naming and substitute distinctions; do not claim retailer stock without evidence.
- Guide browsing previous/next is independent of optional completion. One help/signs path, no duplicated legacy navigation. Bread cooling has practical timing/readiness guidance.
- Baking queue cards open by touch or keyboard, sheets keep close/cooked counters reachable.

### Fermentation — latest important design change
- `3bb09af` replaces illustrative bell curves with **Planning visuel** / Visual schedule. Review found curve height was not calibrated to changing yeast dose and could imply unsupported readiness. Do not restore those curves casually.
- Separate preferment/starter and dough duration lanes. Direct dough uses one shorter lane.
- Biga/poolish preparation, starter feeds, applicable preferment fridge removal, mixing and baking dates/times stay visible beneath the diagram.
- Blue indicates exact scheduled cold intervals, excluding mixing, shaping gaps and preferment warm-up. Expandable dough fridge-entry/removal timestamps.
- Drag and keyboard 15-minute adjustments use existing scheduling callbacks. Actions and visual schedule show identical canonical minutes; display-only rounding was removed, including midnight date bugs.
- Solver biology helpers were not revalidated by this graphical redesign. Bars describe durations, not measured maturity. Read `docs/FERMENTATION-VISUAL-REVIEW-20260922.md`.

### Actionable fermentation windows — 22 September 2026
- User confirmed that a window is the desired model. Added one compact panel above both Actions and Visual schedule: recommended mixing range, planned-time marker, before / within / after the recommended window status, contextual explanation and adjustment action. Preserve existing duration/cold lanes.
- Same component in Simple and Custom, French and English. Preferment checks remain distinct; optional physical signs and temperatures appear in a disclosure. No decorative maturity curves or universal readiness guarantees.
- Commercial guidance uses the actual solver bounds, including style/flour/cold availability. Sourdough uses existing solver bounds, but contradictory hot-climate bounds and unsupported combinations show unavailable guidance instead of false green. Started/overdue/impossible plans retain distinct states.
- Adjustment opens and focuses the existing time editor. Explicit Valider / Done and Enter commit an edit; focus loss still commits. Safari touch does not reliably blur a field when tapping non-focusable text.
- Read `docs/FERMENTATION-WINDOWS-20260922.md` for rationale, test coverage and engine limitations. No dose, starter-ratio or production configuration change.

### Bounded availability repair — 22 September 2026
- Preserve one automatic protocol recommendation in Simple and Custom. Cold fermentation before and after balling/shaping is valid; no new protocol toggle is introduced.
- Shared half-open checks cover known active mixing/shaping spans and action points; passive autolyse and fermentation remain compatible with unavailability.
- Shaping and the second cold exit are checked together to retain existing minimum cold, warmup and proof time. Verified proposals retain the cold-phase count and require explicit acceptance to change mixing/baking time.
- Commercial proposals validate the selected direct/poolish/biga method, preparation/storage/warmup and advised mixing range for every candidate, then check preparation deadlines again on tap. Recurring availability is extended through the search horizon. Accepted plans survive the bake-key remount.
- Sourdough receives the clear conflicting action/time and manual planning controls, **not an automatic repair**: the starter solver can change feeds after a bake edit, so current green starter events cannot certify that new plan.
- No calibrated science formulas changed. Exact baseline comparison: 6,480 no-block schedules unchanged except added metadata. Read `docs/SCHEDULE-AVAILABILITY-20260922.md` and the final science gate in `docs/SCIENCE-REVIEW-20260922.md`.

## Verification and limits

**Latest availability repair verification:** [run 35689438983](https://github.com/RomaricErnst/baker-hub/actions/runs/35689438983) at `f39a68b` passed all **179 unit tests, i18n/build and 28/28 iPhone WebKit cases**. Existing 24 cases remain green; the four added cases cover explicit later-bake acceptance, stable parent times after remount, cleared conflicts and preserved two-phase cold fermentation at 320/375/390/430px. Artifact `10677462989` retains report/screenshots until 6 October 2026. Final application preview `dpl_G3T5GmRHSDQ7vuUAdeNv1onhiUZv` is READY and not production. Direct French deployed checks also confirmed the repair and both cold intervals. The earlier failed runs were obsolete source-shape assertions and a new test's incorrect English tab label; all were corrected without weakening behavioral assertions.


Latest fermentation verification: application `8e8d448`, test correction `efcfaad9`; run https://github.com/RomaricErnst/baker-hub/actions/runs/35680216465 passed all 167 unit tests, i18n/build and 24/24 iPhone WebKit checks. Artifact `10674932091` retains screenshots/report/traces for 14 days. Direct/poolish/biga/sourdough, both modes/languages and 320/375/390/430px were exercised. The current preview is READY, target preview. Live preview manual checks confirmed early/within/late feedback, explicit time confirmation, correction preserving bake time and matching visual view.

Science and blocker reviews are complete: `docs/SCIENCE-REVIEW-20260922.md` and `docs/BLOCKER-REVIEW-20260922.md`. Reviewers ran 47 and 18 targeted tests respectively and bounded production probes; no calibrated formula changes were justified. Preserve prior constants. Current summary corrections include advisory wording, neutral availability priority, a review-availability action, half-open interval edges and preheat/shaping points. Final post-review run https://github.com/RomaricErnst/baker-hub/actions/runs/35686741003 at `35952d1` passed all 170 unit tests, i18n/build and all 24 iPhone WebKit cases. The direct-dough case now also creates a custom block at bake time, verifies neutral conflict status and follows its availability action at all four widths. Final preview `dpl_C1Uxpi9KDrzeuQCDbvxGSq9TzzUB` is READY, preview target only.

Remaining limits after the bounded availability repair: untimed handling is not fully represented, automatic sourdough availability repair is deliberately withheld, and sourdough boundary conventions are not globally unified. Hot room-only sourdough window inconsistencies remain guarded/unavailable. A latent extreme mixed-RT dose discontinuity was found but not reached in 2,700 ordinary generated schedules; investigate restored/blocked reachability before changing its contract. Do not claim the whole engine is scientifically or exhaustively verified.

Historical migration baseline: 154 automated tests and TypeScript passed; Vercel READY. WebKit 26.6 iPhone simulation tested 375×600 and 390×664; iPad ingredient layout 768×900. Setup, flour/manual/scan UI, date changes/review, pizza pick/filter/detail/review/shop/prep/bake, ingredient/guide and bread cooling were exercised. Direct/biga/poolish/sourdough timeline rendering was checked, with pointer/keyboard changes agreeing with Actions. Deployed sourdough timeline checked too.

Do not overclaim:
- Physical iPhone Safari toolbar/keyboard behaviour and real camera capture are not reproduced fully by WebKit emulation. User's native screenshots can expose additional issues (as the footer did).
- Authenticated real cloud save/share/reopen was not fully exercised. Payload and failure paths have automated coverage; image-file scanning was checked separately.
- Numerical tests are not baking experiments or biological validation. Climate/humidity adjustments still need source-based judgment if revisited; don't infer scientific validity from green tests.
- Existing audit reports contain old unresolved/closed states. Reconcile each against code and evidence; don't blanket-close the original audit.

### Header verification — 22 September 2026
- Application commit `9a32a88` deployed READY to the preview above; no production promotion.
- Deployed Chrome checks: French and English setup Save changes to Enregistré/Saved and opens the existing account prompt; menu opens/closes; Escape closes and restores focus to Menu; language switching works.
- Measured deployed label styles: 16px / 500; Back, Menu and Save are 44px high, all >=44px wide. French unsaved text widths: Enregistrer 79.625px, Menu 40.3125px; Georgia wordmark at 28px measured 117.422px (24px estimate 100.65px). With the narrow CSS, total required width including Back and outer padding is about 306.6px at a 320px viewport.
- Narrow layouts were checked by source and measured width budget, **not rendered mobile emulation**: this cloud browser does not expose viewport resizing. Physical iPhone/keyboard/scroll behavior remains unverified here.
- Full local checkout/TypeScript/test suite could not run in this restricted network environment; the GitHub connector was used to edit the two files and Vercel confirmed a successful build. Existing earlier 154-test evidence is historical, not rerun for this change. Real authenticated cloud save remains unverified.

### Repeatable iPhone rendering checks
- `.github/workflows/iphone-webkit.yml` runs on code pushes to the migration branch only (or manual dispatch on that branch). It has read-only repository permissions and no deployment step.
- Installs pinned Playwright test tooling separately under `.ci-tools`; builds this exact commit and runs an isolated local app with fake Supabase configuration. No production credentials are used.
- `playwright.mobile.config.cjs` and `tests/mobile/header.spec.cjs` exercise WebKit with iPhone touch/mobile settings at 320, 375, 390 and 430px, in French and English.
- Checks rendered dimensions, header overlap/overflow, 56px header, 24px logo, 16px/500 labels, 44px targets, menu tap/close/Escape/focus, local draft save and account prompt, and language switching. Captures screenshots/geometry and failure traces as a 14-day GitHub Actions artifact.
- This is a local CI build audit, not a test of the protected Vercel deployment or authenticated cloud saving. Safari toolbar, keyboard, real camera and physical iPhone behavior remain out of scope.
- Final runner is `macos-14`, with Playwright 1.58.2 WebKit and iPhone 13 device parameters; custom viewport widths above. Use `localhost` and canonical English `/`, French `/fr`. This deliberately does not require Georgia font substitutes from Linux.
- **Verified result at commit `8f816ac`: all 8 WebKit cases passed (39.3 seconds), all 154 existing tests passed, i18n check and production build passed.** Run: https://github.com/RomaricErnst/baker-hub/actions/runs/35675704456 . Screenshot/report artifact: `10672534018` (expires 6 October 2026).
- The rendered audit supersedes the earlier source-only header assessment. It caught a 320px French logo/Save overlap on both Linux and macOS. Removing the narrow header's outer 8px padding on each side fixed it while preserving 24px logo, 16px/500 labels, 56px header and 44px targets. Screenshots at 320px and the 390px menu were visually inspected.
- Initial Linux run also hit English loopback redirects; these did not recur with macOS/localhost and canonical routes. No application routing was changed. Keyboard-focus restoration is tested from an explicitly keyboard-focused trigger, separately from touch taps (Safari taps do not necessarily focus buttons).
- Header/local-save/menu/language checks are now repeatable on this branch. This is not a complete application journey or physical iPhone acceptance test.

## Where to look

- `app/[locale]/page.tsx`: journey state, setup/review, sticky navigation.
- `app/components/Header.tsx`, `app/globals.css`, `app/hooks/useBottomNavHeight.ts`: menu/mobile bars/safe area.
- `FlourPicker.tsx`, `FlourScan.tsx`: flour selection/manual/scan.
- `SchedulePicker.tsx`, `FermentationReadiness.tsx`, `app/utils/fermentationAssessment.ts`, `FermentChart.tsx`, `app/utils.ts`: planner, visual timeline, engine. FermentChart still exports engine helpers used by the planner; preserve them during cleanup.
- `RecipeOutput.tsx`, `BakeGuide.tsx`: quantities and instructions.
- `ToppingSelector.tsx`, `app/components/pizzaParty/*`: pizza journey.
- `docs/WORDING-REVIEW-20260921.md`, `docs/MOBILE-WEBKIT-REVIEW-20260921.md`, `docs/FERMENTATION-VISUAL-REVIEW-20260922.md`: recent evidence.
- `docs/MIGRATION-STATUS.md`, `docs/POST-MIGRATION-AUDIT.md`: historical checkpoints and audit scope.
- `docs/continuation-reference/`: copied original audit inputs; historical findings need reconciliation.

## Run and verify

`npm install` as required by environment; then `npm run dev -- --webpack --port 3015`. Local `/fr` and `/en`. Checks: `npm test`, `npx tsc --noEmit`, `node scripts/check-i18n.js`. Run affected browser journeys, then deploy and verify the actual preview. Keep secrets in configured environment; never copy `.env.local` into Git or a prompt.

Mac verification tools used: agent-browser CLI plus Playwright WebKit. A new cloud environment must install its own tools/dependencies; it cannot rely on `/tmp` scripts or Mac executable paths. Browser hydration can lag initial HTML: wait for interactive readiness before judging clicks. Development HMR can reset test journeys. Too many leftover browser sessions previously stalled the server; close your test sessions. Do not mistake a reload, stale selector or dev overlay for an app bug.

## Backups and production

Original production baseline commit: `7a118048886dadb572c426d0643db1dedd4f5b80`; deployment `dpl_FSS7hWNWHWLWoceZmgHZsrXezYEB`. Main was not replaced by this migration work. Local archives remain under parent `backups/migration-20260920`; older archive `outputs/release-reference/bakerhub-live-7a118048.tar.gz`. Git history provides portable code recovery. Database/Storage are not included in code archives. Preview publication is authorized; don't silently promote main/production during a new task.

## Starting from a phone/new chat

Connect/open this repository and select the migration branch, then read this file. If a general chat cannot read the repository, attach this handoff; it can discuss feedback, but implementation also requires repository access. Do not assume conversation history or local Mac files transferred automatically. Confirm the branch and current commit before editing. Continue from the user's new feedback rather than restarting the migration or flour hunt.


## Historical product discussion — superseded by implementation below

Finish and verify the current fermentation work first. Romaric proposes a bread companion analogous to the pizza selection/toppings/shopping flow: optional sandwich recipes adapted to the chosen bread, quantities and a combined shopping list. Initial source audit: baguette exists in `BREAD_STYLES`; dedicated focaccia, bagel, pita, kebab-bread and ciabatta recipes were not found in the current catalogue. Bread families to validate before designing: focaccia, bagel, pita, bread suited to kebab, baguette; ciabatta is an additional candidate, not approved implementation. The user supplied Antico Fornaio focaccia menu photos as visual/appetite references (mortadella/pistachio, grilled vegetables, salmon, porchetta, etc.). Aim for roughly a dozen appealing recipes per supported family; for baguette, roughly ten fillings/sandwiches, not ten new dough formulas. Jambon-beurre and similar familiar choices should feature. Research current French popularity before ranking choices; no market claim established yet. No sandwich implementation, dough formula additions or catalogue edits have been made. Next step: audit supported breads and propose the module before implementing it.

A current concept example, not a national popularity ranking: [France Snacking, 7 September 2026 — La Cantina](https://www.snacking.fr/actualites/8230-Avec-La-Cantina-Jean-Francois-Monferran-se-relance-dans-le-snacking-italien/) describes panuozzi and focacce alongside pizzas in Saint-Étienne. Panuozzo could be a later bridge from the existing pizza dough journey, subject to its own preparation guide; it is not part of the current implementation.

## Bread and sandwich companion — 22 September 2026

User explicitly approved end-to-end implementation and preview publication after the fermentation work. Added eleven bread styles: focaccia, bagel, pocket pita, Greek pita, kebab bread, batbout, laffa, piadina, pan-bagnat bread, ciabatta and panuozzo. Existing baguette completes twelve sandwich families. Eighty-two bilingual recipes distinguish classics from inspired variations, including at least two lower-energy options per family. No national popularity ranking is claimed.

`app/utils/breadProfiles.ts` is the canonical new-style protocol/equipment/method/default source. New yeasted breads reuse the existing climate/fridge/dose engine without recalibrating coefficients. Piadina is explicitly unleavened with a rest/cook planner, no yeast or preferment. Bagel includes poaching; batbout contains actual weighed fine semolina, reflected in shopping and guide. Unsupported restored equipment, methods and timing are blocked rather than silently presented as valid protocols.

Optional `SandwichParty` follows choose → shopping → prepare → serve, with filling gram overrides, amount-sensitive checklists, serving/undo, local/cloud snapshot and rebake/share support. `sandwichParty` is independent of existing pizza selections; no database migration. Fillings do not silently change dough. Bread quantities count sandwiches separately from loaves and show reference baked-bread grams; a raw-dough upper-bound warning avoids promising an unmeasured cooked yield.

Nutrition is approximate generic-food energy including the stated bread portion, not verified nutrient analysis or an estimate of the user's exact customized dough. “Lighter” compares actual energy against the same family's classic recipes at their listed portions and is recomputed after customization. No medical health promise. See `docs/SANDWICH-RECIPES.md` and `docs/BREAD-SANDWICH-SCIENCE.md` for provenance and limits.

Eleven bread images and the griddle tile match the existing rustic catalogue; source prompts and final paths are in `docs/BREAD-IMAGE-PROMPTS.md`. They are illustrations of bread families, not photographs of tested baking outcomes.

Verification additions: bread climate/method matrices, exact flour mass, independent nutrition checks, bilingual guide rendering, persistence/share/rebake tests and twelve new macOS iPhone-WebKit checks across 320/375/390/430 widths. Final CI/deployment evidence is recorded after execution; do not treat authored browser tests as passed before that evidence exists. Production remains untouched.

## Navigation and companion alignment — continuation 22 September 2026

User requested early Pizza/filling access, agent-led navigation review, Safari vertical-space care, clear recipe/protocol destinations, and preview publication. Two independent reviews recommended stable hierarchy rather than adding bottom tabs after generation.

- No bottom bar on the initial Pizza/Bread chooser. Pizza then shows **Ma pâte / My dough** and **Pizzas** immediately. Per the latest user correction, bread shows **Ma pâte / My dough** and **Garnitures / Fillings** only after choosing a supported bread style.
- After recipe generation, dough has local **Plan / Recette / Protocole** (EN Plan / Recipe / Guide). The bottom dough button resumes its last visited view; tapping its current destination does nothing. Plan explicitly opens the choices overview.
- Both companions share `CompanionSteps`. Bread-specific names belong in headings (bagels, pitas, focaccias), not the fixed destination label. Traditional breads precede sandwich additions.
- Fillings use the selected bread directly, with no second family picker. Quantities autosave; changing to another bread in the same family retains fillings, while changing to an incompatible family asks before clearing. Early shopping explicitly excludes unconfigured dough and offers Finish my dough. Local/language/cloud restore paths preserve early companion destinations.
- Sandwich browsing adopts pizza photo proportions, concise cards, search, a selected-only Review selection action and quantity review sheet.
- Deliberate downward scroll hides the header; outside setup it also collapses bottom destinations and browsing actions. Upward movement, page boundaries, destination changes or a compact Navigation reveal control restore access. Setup keeps its bottom destinations and Continue. Focused navigation does not disappear. Reduced motion is honored; mobile keyboard shrink hides fixed bars.
- Resize observer updates defer to animation frames rather than mutating observed layout during delivery. No fermentation formulas changed.

Verification checkpoint: local 222 unit tests passed before the final scroll refinements; 10 affected tests and TypeScript passed afterward. Final build / macOS WebKit / preview evidence must be recorded after completion. Local WebKit download succeeded but launch lacked system libraries; native Safari browser toolbar and keyboard behavior remain unverified. Added 20 browser checks across four widths for early discovery, preserved selections/steps, generated local navigation and scrolling. Do not call authored tests passed until CI evidence exists.

The user briefly requested an inline prototype, then explicitly chose to test the online preview instead. Continue preview-only; no production promotion.

## Latest correction — bread-first garnitures and tartines

User requested fillings only after bread selection and tartines for traditional loaves, including avocado and egg. Added six bilingual tartines (88 companion recipes total /13 families). Campagne, levain, complet, seigle and mie map to tartines; brioche, viennois and fougasse have no companion destination pending suitable content. Tartine quantities count60g baked-bread portions (one large or several small slices), not loaves. The chosen bread name/image remains visible; avocado-and-egg uses the existing hard-boiled egg ingredient. No fermentation formula changes.

CI35708067892 on9e66b73 finished47/64 mobile tests passed. Failures:8 hidden selection CTA after dialog close,4 outdated Baguette quantity labels,4 container-geometry assertions despite visually separated Continue,1 recipe overflow326px at 320px. Parent/agent visually reviewed320/390/430 screenshots. Modal close now reveals navigation/actions without scrolling focused controls; keyboard hiding also covers landscape widths. Tests now follow bread-first selection, measure real buttons, await full reveal height and log overflow contributors. Rerun evidence pending. Local226 unit tests and TypeScript passed after tartine changes.

## Missing final setup action — user screenshot IMG_4019

The user showed the custom Fine-tune screen without a next action while bottom tabs remained visible. `StepPage` had a null-action branch when step summaries were populated but protocol generation remained blocked. `SetupReview` also omitted its action in that state. `setupBlocker.ts` now names the outstanding issue and routes to the relevant equipment, method, flour or planning step. A missing starter plan shows “Compléter le plan →”. Neither recipe validation nor baking calculations are bypassed. Added real rendered-component/unit tests and 8 mobile cases for Fine-tune and Review correction, visibility above bottom tabs and routing to Plan.

Navigation/tartine app commit 42da084 passed all72 iPhone WebKit tests in CI 35712064741, including the repaired320px recipe footer. Agent reviewed320/390px tartines and hidden/revealed bars. Final test-only commit `dfceeecd` on the same application code passed CI 35713615578: 230 unit tests, production build, and all 80 iPhone WebKit cases. Native iOS browser toolbar/keyboard animation is not reproduced by desktop WebKit device emulation.

## Final verified checkpoint

Application `c6193fb`; test correction `dfceeecd`. CI [35713615578](https://github.com/RomaricErnst/baker-hub/actions/runs/35713615578) passed 230/230 unit tests, build, 80/80 macOS iPhone-WebKit tests across 320/375/390/430 widths. The earlier 4 review-case failures were a test selector matching an additional hidden status; the visible status assertion now passes, including actual correction routing. Agent and parent inspected corrected 320px Fine-tune, choices review and recipe-footer screenshots, plus 320/390px tartines and reading navigation.

Preview build `dpl_G3T5GmRHSDQ7vuUAdeNv1onhiUZv` is READY for the application commit. Test-only build `dpl_7jnD23V1v98eikPX9wByajy3iGnC` is READY with identical app behavior. Production remains untouched. See `docs/NAVIGATION-REVIEW-20260922.md` for behavior, evidence and emulation limits. Continue from user feedback on the live preview; do not restart the implementation.
