# Bakerhub — continuation handoff

Updated 22 September 2026. Read this first. It supersedes the September 13 handoff and earlier acceptance summaries; older reports remain historical evidence, not current status.

## Resume the correct work

- Repository: `RomaricErnst/baker-hub` on GitHub.
- Active branch: `codex/prototype-migration-20260920`. Continue from this branch, not main or the old release-candidate branch.
- Latest application commit at this handoff: `8f816ac` (WebKit-verified narrow header spacing). Handoff/documentation commits may follow without changing application behaviour.
- Local checkout: `/Users/romaricernst/Documents/Codex/2026-09-11/create-an-image-of/work/baker-hub-migration`.
- Stable test URL: https://baker-hub-git-codex-prototype-mig-b4b24a-thebaker-hubs-projects.vercel.app/fr
- Latest immutable preview build (READY; mobile UI verified separately in CI): https://baker-5prje3pz8-thebaker-hubs-projects.vercel.app/fr
- Deployment: `dpl_8Gd755dct1NAFypuS7JXVt4eB8rx`, READY. New pushes can supersede it.
- Temporary Vercel share tokens expire; obtain fresh access if the preview requests login. Do not store tokens or credentials in this document.
- Vercel project `prj_qDz6tdakJGeFFtVApo9mpAU7rNQq`; team `team_WioBBEisA4hox7JpPyBX0Vtr`. Branch pushes auto-deploy previews.

The next task is to continue Romaric's mobile feedback and polish this branch. No known unfinished implementation from the latest footer/graph requests remains. Do not represent the whole product as universally verified: limits below remain.

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
- Phone setup hides bottom destination tabs; Continue remains sticky. Tabs return for generated recipe/pizza module. Menu offers pizza access during setup.
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

## Verification and limits

Latest app: 154 automated tests and TypeScript passed; Vercel READY. WebKit 26.6 iPhone simulation tested 375×600 and 390×664; iPad ingredient layout 768×900. Setup, flour/manual/scan UI, date changes/review, pizza pick/filter/detail/review/shop/prep/bake, ingredient/guide and bread cooling were exercised. Direct/biga/poolish/sourdough timeline rendering was checked, with pointer/keyboard changes agreeing with Actions. Deployed sourdough timeline checked too.

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
- `SchedulePicker.tsx`, `FermentChart.tsx`, `app/utils.ts`: planner, visual timeline, engine. FermentChart still exports engine helpers used by the planner; preserve them during cleanup.
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
