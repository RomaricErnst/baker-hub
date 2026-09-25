# Bakerhub — continuation handoff

## Recommendation-first scheduling and compact Organisation — 25 September 2026

User authorized the existing preview only. Organisation progress now shares the section navigation bar; its step menu remains separate from the six-section menu. Scheduling explicitly targets first pizza/bread oven entry (pan-cooked breads use cooking start), retaining the canonical saved oven anchor rather than adding a serving-time offset. Target controls stay above alternative-time presets.

Key actions default to compact rows with compatible-window text. Modify opens a horizontal time strip and exact date/time input. Adjacent validated quarter-hour choices form green bands; isolated valid times remain points. Slot results are keyed to current constraints and cancelled on replacement. Apply/Cancel remain distinct; persistent “Revenir aux horaires recommandés” recomputes using current availability. Candidate-derived intervention details expose dependent folds/transitions and a changed mixing time before Apply.

Commercial preferment changes may move automatic mixing using the supported fixed-bake search, while explicit mixing choices stay pinned. Shared fold offsets come directly from the existing generic BakeGuide prescriptions and are now checked as availability point events. Passive initial bulk retains its existing modeled duration across blocks; canonical actions determine conflicts. No biological coefficients changed.

Verification at this checkpoint: TypeScript and local production build passed; 309 unit/component tests passed after core fixes. Adapted mobile matrix has 204 authored cases; runtime execution still pending. Local WebKit cannot launch (missing system libraries; dependency install unavailable). Do not report the new browser checks as passed until CI evidence is recorded. Production unchanged.

Remaining limits: conditional bread folds depend on dough and have no invented timestamps; some handling durations remain point checks. Fermentation is estimated, search bounded, and completed versus expired work remains the prior documented distinction gap. Optional “Ce que vérifie le planning” discloses these model boundaries.


## Shared scheduling feedback and persistent Reset — 25 September 2026

The user's screenshot sequence is reproduced on the existing preview: after confirming a poolish preparation, a custom blocker creates a warning; moving preparation to a valid draft enables confirmation but leaves the committed-plan warning visible. Reset was visible immediately after Apply but disappeared after reload/resume while times persisted. Exact screenshot recipe/temperatures were not provided; controlled Asia/Singapore regression fixes25 September08:49 and26 September19:30 bake with explicit22°C/5°C/spiral assumptions.

Commercial blocker changes and Reset now use the same full-candidate validation and bounded fixed-bake search as editing, preserving chosen storage and explicit manual pins. Sourdough uses read-only joint solver probes, complete action validation and exact displayed-event checks. Current and draft feedback share validation; stale global preferment warning removed. Saved timingOverrides distinguish automatic times from manual choices, survive local/cloud resume, and clear on Reset/rebake. Reset retains current blockers and other recipe inputs; Cancel discards only the draft. Custom block removal now identifies the actual block rather than using a filtered index.

No biological coefficients changed. Green means compatibility with the existing estimated model. Preferment/starter handling durations remain point events where unmodeled; completed versus missed past preparation is not explicitly represented, so elapsed preparation is conservatively preserved. Search exhaustion is not proof of biological impossibility. Read docs/SCHEDULING-INDEPENDENT-REVIEW-20260925.md.

First preview b2239d8 is READY as dpl_8zDxe1vtToEjah745WdZUTh75k7P. CI36089442827 passed all300 unit tests, build and180/180 macOS iPhone-WebKit cases (9.6min), including all36 new scheduling cases. Parent CUA verified stale warning clears on valid draft, Apply and reload preserve Reset, night blocker preserves explicit preferment, Reset recomputes Fri19:30poolish/Sat07:00mix with Sat19:30bake fixed and current work/night/custom blocks intact. Independent interaction reviewer inspected the coherent settled desktop timeline; physical iPhone not reproduced.

Final corrective patch extends canonical validity to visible disabled Continue and recipe generation in both modes, re-seeds Reset from the current model preference even if the manual schedule remains valid, and suppresses old duplicate warning panels. New/updated gate assertions pass; final CI rerun pending. No production change.

Local verification before publication:300 unit/component tests pass, TypeScript and production build pass. Nine added browser scenarios cover36 width cases, bringing the authored mobile matrix to180; their execution/preview verification is pending. Local WebKit could not launch because its system libraries are absent and dependency installation is restricted; do not label authored tests as passed. Preview only; production untouched.


## Conditional batches and stable setup navigation — 25 September 2026

User approved hiding routine batch questions and requested top-of-page navigation plus investigation of flour requiring two taps. Batch controls now appear above existing mixer-specific capacity estimates or with an explicit manual override; smaller quantities offer a discreet split action. Hand/no-knead use lots/batches wording. Existing recipe calculation and thresholds remain unchanged.

Visible-page identity now resets scroll after React commit and two animation frames, covering same-route setup steps, mode, oven/mixer, quantity and destinations. History restoration is manual; ordinary value/detail changes do not reset reading. Focus restoration in setup overview and flour details uses preventScroll. Removed the flour selection smooth-scroll animation and made manual-entry scrolling instant.

Live pre-change desktop verification: opening Flour, selecting Caputo Nuvola and Change flour each worked with one click. Exact physical-iPhone two-tap symptom is not reproduced or claimed fixed. Added WebKit regressions for conditional stand/spiral batches, manual override/reset, single-tap equipment/flour/search/Continue and unobscured headings at the configured mobile widths. TSX transpilation and test syntax checks passed locally; full build/mobile CI and preview verification pending at publication. No production change.

Final verification: application 4ff9df2b0955d240022f65764c32f166771f6a91 deployed READY as dpl_EPK8DqHxzWbmKfTy8xKo4RWfhRsw. Live browser verified 1040g spiral hides count, split/reset, 2080g stand suggests 2 while spiral remains 1, flour search single-click selection and Continue, yeast/equipment choices, and new headings at scrollY=0. Initial CI36079636525 passed140/144 mobile cases; four new cases stopped at a test selector that also matched hidden flour-dialog headings. Test-only fix3d05539419ce476e8ba222aa2166d7d654cb4111 scopes the heading by accessible name. CI36080259576 passed282 unit tests, build/i18n and144/144 iPhone-WebKit cases across320/375/390/430px, including the corrected flour single-tap checks. No physical iPhone verification or claim that the exact reported two-tap symptom was reproduced.

## Setup naming and selection consistency — 25 September 2026

User approved Organisation for the complete setup (equipment, dough, timing), preserving six destinations and Recipe for the generated result. Removed redundant Votre recette above the step counter. Mode entry uses Comment définir votre recette ? with Me laisser guider / Personnaliser ma recette. Garnish invitation has one top action with optional marker, no repeated bottom action. Setting choices remain selected until Continue in both modes; removed commercial-yeast auto advance and the legacy custom-mode delayed return to Plan. Navigation scroll resets after mounting to avoid sticky-title clipping. Votre équipement remains singular. TypeScript passed; preview/runtime verification pending.


## Inline key timing controls — 24 September 2026

User approved the isolated inline interaction prototype and authorized preview deployment, explicitly including sourdough. Setup now shows vertical controls beside each key action, on explicitly labeled per-action axes; fixed bake time remains above. Detailed dough agenda stays in preparation. Commercial mixing keeps preferment coupled and preferment-only edits preserve mixing; both use the existing full-plan validator. Green slot previews use the same validation as confirmation. Reset appears only after a timing change; exact date/time entry, cancel and atomic confirmation remain available.

Sourdough uses read-only probes of the existing joint starter solver, with cloned pin refs and captured effects. Mixing recomputes upcoming feeds/cold actions; dragging a feed keeps mixing pinned. Historical feeds/observed peak are immutable. Known-peak edits check its usability window; multi-feed/cold plans use the engine's candidate maturity score, not a room-temperature peak formula. Upcoming revival and fridge actions remain visible. Invalid candidates cannot commit. Applying persists starter events and dependent times atomically with mixing/bake times. Restored events stay authoritative until an explicit edit. Existing conflict guidance retained beside mixing.

TypeScript and production build passed; 282 unit/component tests include real-solver probes for known peak, RT feeds and week-old refrigerated revival, with no parent writes during probing. Application 35ff1ee deployed READY as dpl_9K3G7VxPSWPhhWZbrC52vtkaMA9J. Browser verified commercial coupled/independent controls and fixed bake. Levain runtime exposed a hidden parent write in deriveStarterPeakTime during read-only probes (React update loop); removed helper side effects and captured peak publication for explicit commit. Regression probes now include the peak callback and optimized-ratio scans. Hide controls until starter inputs exist; reset icon is decorative for accessibility. Correction cb1550c12ed34e636b2e9f83de7b7c3d2815bd37 deployed READY as dpl_GEj3sysrjHZfc3VqcowPKyxwha3s. Browser confirmed night-aware levain 07:00 to 07:15 with fixed 19:30 bake and explicit confirmation, without update loop. Feed pins now exclude alternative peak-2 families that ignore the requested feed; restored levain uses probe readiness rather than a missing-result generic warning. Latest application d6e2046a3f3b16d967a5e32de4546218c0d5765f deployed READY as dpl_4KeNSxA9RTRFoH8wW86PBiNPCDtt. Browser verified a restored levain plan, independent feed 22:07 to 22:22 while mix stays07:15 and bake19:30, and successful confirmation. Additional read-only pain_levain probes passed for RT and week-old fridge starters. Final interaction fix holds the feed slider axis stationary while dragging; mobile regression asserts unchanged bounds. CI36017066484 was superseded, with levain cases passing through320/375/390px; CI36018060075 and final-axis CI36019755703 each passed135/136 mobile cases, including all levain and axis tests. Each caught an unhandled optional PizzaParty preload rejection during reload (different width/mode); preload now catches failure, while the actual screen loader retains error handling. Axis commit79beb384 deployed READY as dpl_HcPWqGZKZvpAjFPk5MMbQxgYDXPG; deployed browser verified stationary feed bounds22:22→22:37, unchanged mix07:15/bake19:30, Cancel and hidden Reset. Final preload correction verification pending; first CI36014847222 had 116 passes and 16 failures (levain preview loop plus stale garnish/reset accessible-label expectations), addressed. Preview only.

## Shared heading hierarchy — 24 September 2026

Aligned style/quantity, all guided setup steps including equipment, mode choice and pizza/bread topping catalogue page titles to 28px display type, 700 weight, 1.15 line height. Section headings use 18px UI type; optional garnish card heading remains 16px. Fixes unstyled batch headings inherited as body text and independent 26/30px title styles. No navigation renaming in this change.

## Garnish action label — 24 September 2026

User confirmed the single clickable photo card: Choisir mes garnitures →, becoming Modifier ma sélection · N → after selection. Compact heading now reads Garnitures · facultatif on one line; no additional button. Prior navigation CI36007489094 completed successfully.

## Garnish navigation simplification — 24 September 2026

One optional illustrated garnish entry replaces duplicate controls. Quantity footer uses Précédent and Définir ma recette; catalogue retains selection review and Back. Existing-base review leads to Préparer les garnitures with Voir les courses secondary; scratch leads to recipe setup; late edits retain explicit return destinations. Review-sheet edit-selection is a discreet action. Existing bread retains Back even with no selection; header/footer return to the same chooser and preserve choices. UI/UX agent reviewed the revised diff and found no material blockers. TypeScript, 278 unit tests and production build pass. Application commit 0784dec40ea4d7448860537f11eec17e40ba0b9a deployed READY as dpl_3kQLKnmAM9wQiUVbvZ3QmEMGuyWG. Deployed browser verified the single garnish entry, review sheet actions, retained 4 × 280g and one topping after Back, and recipe CTA opening equipment setup. Visual layout inspected. Mobile CI36006955891 still running at this checkpoint. Scoped catalogue Back tests to the footer because pagination also has Précédent. Preview only.


## Pizza style versus toppings — 24 September 2026

User approved concise heading clarification: style entry and both setup modes use “Quel style de pizza ?” / “Which pizza style?”. Topping catalogue heading uses “Quelles garnitures ?” / “Which toppings?”. No explanatory paragraph added. Existing photos retained; matching toppings across style photographs is a future image update, not part of this copy change. Preview only.

## Spiral ice default and atomic schedule saving — 24 September 2026

User explicitly requested direct ice as the spiral-mixer default, with a small compatibility reminder. Selecting a different mixer now defaults spiral to direct and other mixers to premelt. Reselecting the same mixer preserves the chosen method. Profile prefills and legacy recipes use the same default; existing saved water-method choices remain unchanged. Direct ice uses the existing thermal calculation and recipe/equipment restrictions. Removed the blocking compatibility checkbox without falsely marking a machine as user-confirmed. Setup, recipe and guide retain “Vérifiez que votre pétrin accepte la glace.” where relevant. Ooni explicitly describes ice substitution for Halo Pro (https://ooni.com/blogs/recipes/ooni-100-biga-dough-using-halo-pro); this is not evidence that most spiral models permit it.

CI35976396579 completed128/132 mobile checks: keyboard direction now passes, but the four paired cases caught the immediate save using the previous preferment offset while React state updated asynchronously. Apply/Undo now pass the chosen offset in the same save payload as mixing/bake times. Application49f01902903cebd7e8833dc5ae422c7760241519 and test-label correction df7f22f2039dcc4a4afbaa8681570bed3fc4298d are published. Preview dpl_2oMYgPvtjYEdnt7Rp3fG8hQVjM8S is READY. TypeScript,278 unit/component tests and production build pass. Deployed browser verified spiral selection defaults to direct ice, manual premelt choice remains after Back and reselecting the same mixer, and the short reminder is visible. CI35982499328 completed SUCCESS: all132 macOS iPhone-WebKit tests pass across320/375/390/430px, including both spiral-default paths, manual override preservation, paired-anchor editing, immediate atomic persistence and undo. This is browser/emulator verification, not physical-iPhone or baking acceptance. Production unchanged.

## Coupled scheduling controls — 24 September 2026

First paired-control deployment 8e77bd68d999beafbc837dfa29d118aa5802a336 is READY (dpl_CzSg84Gtsig3yjzNz7t14ZXeikBJ). Browser verified mixing 11:30 → 11:15 shifts poolish 22:45 → 22:30 and cold-in 13:15 → 13:00, while fixed baking remains19:30. Then moving poolish back to22:45 preserves mixing11:15 before applying;23:00 is rejected specifically by the23:00–07:00 night block. CI35975337237 passes128 tests, including all new quantity/equipment tests. Four paired-control cases exposed Safari interpreting ArrowDown opposite to Chrome on native vertical ranges; key handling now explicitly maps Down to15minutes later and Up to15minutes earlier. Final rerun pending. Automatic approval review rejected committing prototype screenshots to GitHub as an unapproved image disclosure; captures remain outside the repository, and no alternate upload was attempted.

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

## Scheduling consistency — 25 September 2026

User authorized implementation on `codex/navigation-polish-20260923`, independent scientific/interaction reviews, and preview publication only. Preserve the existing conditional mixer-batch question, scroll restoration and single-tap flour fixes from `25e9d87`.

Reproduced the stale warning and disappearing Reset on the old preview before editing. The reproduction used Custom Neapolitan, Caputo Nuvola, stand mixer, 22°C kitchen, cold poolish, Saturday26 September19:30 bake, weekday09–18 blocks and custom Friday06:45–08:00/08:00–09:00 blocks. Moving poolish08:15 to06:30 cleared the actual conflict but left the old global warning; confirmed manual times survived reload but Reset did not. Original screenshot recipe/temperatures are unknown. The automated regression instead explicitly fixes Singapore2026-09-25 08:49, Neapolitan4×260g, spiral mixer, instant yeast, kitchen22°C/fridge5°C, cold poolish11h and Saturday19:30 bake. These are stated fixture assumptions, not recovered user data or physical baking validation.

Changes:

- `validateScheduleCandidate` and production-builder validation serve complete committed/draft plans; messages, selected-time check, slot probes, confirmation and Continue use that same contract. A valid hypothetical replacement cannot certify an invalid displayed plan. Async slot batches capture one validator and discard cancelled work.
- Availability changes run bounded joint preparation/mixing search at fixed bake and storage mode, respecting modeled hands-on durations and explicit absolute manual pins. Passive fermentation can span blocked periods. Sourdough probes preserve historical actions and future cold-storage sequence and validate the entire displayed feed/mixing plan.
- Timing override identity is normalized and persisted with the recipe. Apply commits dependent times and metadata together; Cancel discards only drafts. One Reset remains through confirmation/reload and clears timing overrides, recomputing from current model inputs and current availability. Blocks are retained. Reset now starts at the current model recommendation rather than accepting an old valid manual time.
- Invalid committed schedules cannot Continue/generate in either mode. Candidate-derived inline warnings replace stale/duplicate panels. Custom block removal matches the actual block, preserving presets. A small green selected-time check disambiguates valid times exactly at the end of hatching.

Published implementation checkpoints: `b2239d8` and `c984e60`. CI [36089442827](https://github.com/RomaricErnst/baker-hub/actions/runs/36089442827) passed300 unit tests, build and180/180 macOS iPhone-WebKit cases at320/375/390/430px. Independent reviewer parsed all180 results and inspected320/390 screenshots. The final continuation/reset/selected-check refinements require the subsequent final evidence below. See `docs/SCHEDULING-INDEPENDENT-REVIEW-20260925.md` for independent findings and fixes.

Live preview checks also confirmed blocked23:00 poolish disables confirmation, the22:45 suggestion clears the warning immediately, Apply retains Reset, and Reset recomputes18:00 poolish/07:00 mixing at unchanged19:30 bake with current work/night/custom blocks retained.

Limits: no biological coefficients changed. Green means compatible with the existing estimated model, not experimentally verified maturity. Search is bounded, not a proof of impossibility. Folds described in the guide are absent from availability validation entirely. Preferment/feed/no-knead combining, fridge transfers and preheat initiation are timestamp-only checks; divide/shaping has an active span only in the two-cold-phase branch. Complete hands-on availability/duration coverage is not claimed. Elapsed preparation is conservatively preserved because the current model cannot distinguish completed work from an expired unstarted recommendation. Physical iPhone Safari/toolbar behavior and authenticated cloud-save are not covered by desktop WebKit/local-session browser evidence. Non-quarter-hour bake anchors rejected by canonical validation still reflect the historical builder's rounding limitation.

Stricter verification caught eight Reset failures in CI36090466356 (172 other browser cases and302 unit tests passed): `renderSweetCenter` still clamped the current manual offset. Commit `89f0f8b` seeds from the independent existing `_optimalMix` calculation instead. The same commit adds the selected-valid check and real pointer-drag, overlapping midnight/duration-boundary, remove/replace-block and Back/reopen browser scenarios (192 width cases total). Custom blocks currently support remove/replace rather than inline editing. Independent reviewers checked the exact correction and final live desktop screenshot. Final runtime evidence follows after CI36091509127 completes; do not treat pending tests as passed.

CI36091509127 on `89f0f8b` passed302 unit tests/build and188/192 browser cases, including all Reset, selected-marker, real dragging, overlap/duration-boundary and scientific-path cases. Four new navigation assertions wrongly expected Continue from step8 to return to the already-answered planning step9; captured pages showed the intended next unanswered step10 (Fine-tune). The test now follows that behavior, opens planning with Previous, then checks browser Back/Forward and unchanged persisted overrides. Application code is unchanged by this test correction. Final rerun evidence remains pending.

### Final verified scheduling checkpoint

Application `89f0f8b`; test correction `5a7845f`. CI [36092548019](https://github.com/RomaricErnst/baker-hub/actions/runs/36092548019) **SUCCESS:302/302 unit/component tests, build and192/192 macOS iPhone-WebKit cases**, including corrected reopening/Back/Forward at all four widths. Final artifact10846621932 contains screenshots/report. The 192 cases include48 scheduling-feedback checks plus existing calendar, navigation, batch, flour and header regressions; they are not192 distinct recipe protocols or a complete Cartesian product of every method/mode/language.

Verified scenarios include no blockers then work/night/custom add/remove; custom remove/replace; overlapping midnight periods; a free action start whose modeled duration crosses a block; exact exclusive endpoints; fixed-bake automatic poolish repair in both modes; blocked-window rejection with no green slots; manual invalid/valid feedback and Cancel; persisted manual pins/Reset through reload; Reset recomputing a different recommendation from current blockers; real pointer dragging with stable axes and final-result consistency; rapid biga night toggles; direct, poolish, biga, room-temperature and week-old refrigerated starter paths; starter feeds and peak constraints; French/English,320/375/390/430 widths. Native physical-iPhone touch/toolbar behavior remains untested.

Preview deployment `dpl_8X29hbhcTAygzSWNZQEXvU985YjH` is READY for `5a7845f`, with the same application code as `dpl_5z8u9tgtMmUFKsrx1zxV98eAhAKx`. Stable preview: https://baker-hub-git-codex-navigation-po-c489c6-thebaker-hubs-projects.vercel.app/fr . Parent verified final live warning clearing, Apply/Reset and Previous/Continue/Back/Forward with retained manual times. Independent reviewers inspected actual320/390px final-application screenshots and final desktop Reset proof; material findings were fixed. Production was not promoted. Documentation-only continuation may change deployment SHA without changing the verified app.

The stated model limits above remain deliberate disclosures, not passed scientific experiments. In particular, fold availability is not modeled, some handling is point-only, elapsed-versus-completed work is not explicitly distinguished, and authenticated cloud save was not exercised end-to-end.


## Recommendation-first scheduling prototype — 25 September 2026

Published app/test commit `2577e09bff2e59b71f6c8c264627f9048362fb0d` on the same preview branch. Organisation now has compact inline step progress. The target explicitly means first pizza/bread oven entry, with saved date/time above collapsed presets. Key actions show recommended times and compatible windows before editing; Modifier opens a horizontal slider plus exact input. Full-candidate probes may move automatic dependent actions while preserving explicit pins. Apply/Cancel, current conflict/correction and persistent return to current recommendation remain available. No biological coefficients changed. See `docs/SCHEDULING-DESIGN-EVOLUTION-20260925.md` for the original Simple horizontal bar / Advanced diamonds and graph history and acceptance criteria.

This revision also shares the existing generic guide fold offsets with availability validation. The earlier statement that all folds are absent is superseded: conditional bread-specific folds remain unmodeled, and unspecified handling durations remain point checks. Commercial preferment and starter-feed editing can replan automatic mixing within the existing bounded model.

Evidence: 310 local unit/component tests and TypeScript passed; first published CI36114598647 passed310 tests/build and182/204 mobile cases. Independent reviewer inspected320/390 screenshots: compact bar, green ranges and exact input are readable. The22 failures were8 outdated collapsed-preheat assertions,4 EnglishBack labels,4 obsolete invalid fixtures now repaired by coupled replanning, and6 footer hit tests without actual scrolling. Corrections retain strict hit testing, center-scroll controls and add focus scroll margins. Final rerun [36116727097](https://github.com/RomaricErnst/baker-hub/actions/runs/36116727097) is IN PROGRESS; do not claim204 passed until its result is checked. New preview deployment `dpl_5sLJ91TsB5WUG1vv5Z15JHHdSSrm` was BUILDING at this checkpoint.

Parent live-browser checks on preceding app commitde49196b confirmed fixed oven time through preset/block/edit/reload, horizontal editing and dependent mixing changes, invalid rejection and nearest valid correction, Apply and persistent Reset. Production remains untouched. Next: inspect final CI/deployment, fix any remaining material failures, then record exact completion evidence.
