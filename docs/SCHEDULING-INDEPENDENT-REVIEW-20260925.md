# Independent scheduling consistency review — 25 September 2026

Read AGENTS.md, PROJECT-HANDOFF.md and the dated science, fermentation-window and availability reviews. This review does not recalibrate recipe coefficients or establish empirical baking validity.

## Source-confirmed defects in the starting implementation

- The global commercial-preferment warning reads committed `pendingStart`/`prefOffsetH`, while the visible sliders render draft mixing and preferment times. A valid preview can therefore coexist with a stale warning.
- The visible Reset action is gated only by `dirty`. Confirmation removes that condition while manual changes remain applied. Persisted override identity is needed; a restored recommendation must not be mistaken for a manual pin.
- Commercial availability edits skip recommendation search after a manual change or outside `start_confirm`. Sourdough availability edits clear manual pins unconditionally. Neither behavior satisfies the requested pin-preserving replan contract.
- Automatic cold-poolish search uses a 12-hour floor, the coarse commercial validity helper a 3-hour floor, and manual editing a separate preferred-window calculation. Searching the same existing supported window as manual validation avoids independently weakening biology.
- Existing automatic recommendation also compares room-temperature and refrigerator poolish and may silently change storage. Availability repair must retain the selected storage mode.
- Known preparation points, complete dough actions, chronology and supported timing windows must all be validated together. A local free calendar time alone cannot warrant a green full-plan result.

## Screenshot evidence and assumptions

Visible evidence: Friday 25 September 2026 around 08:49 Singapore, Saturday 26 September 19:30 baking, weekday 09:00–18:00 enabled, nights disabled, cold poolish. Initial preparation Friday09:00 is blocked. Manually displayed preparation Friday19:15 and mixing Saturday05:15 are 10 hours apart and outside that weekday block.

The screenshot does not identify recipe style, temperatures, flour strength, mixer, preheat duration or complete downstream actions. A bounded production-builder probe assuming Neapolitan, 22°C, hand mixing, 45-minute preheat, no preferment warmup and a supplied 10–18-hour preferment window accepts the manual candidate. This is not recovery of the exact user state or proof of biological maturity.

## Review of new core implementation

`validateScheduleCandidate` centralizes exact candidate validation. `findFixedBakeSchedule` searches supported mixing and preferment windows together, retains fixed baking time, and respects absolute manual pins. It uses the production schedule builder and existing model inputs. No new biological coefficients were introduced.

Independent review raised two follow-up defects: explicit baking-time edits recursively replaced an existing mixing pin; automatic search could choose preferment preparation exactly at the supplied current time, making the recommendation immediately expire. Both are corrected: explicit bake changes retain pins through fixed-bake search, and automatic recommendations use the next quarter-hour planning boundary for unpinned preparation. This is a planning margin, not a biological coefficient change. Dedicated regressions pass.

The exact canonical baking-time guard correctly rejects off-grid schedules rounded by the historical phase builder rather than claiming the requested minute was preserved.

Independently executed 29 tests across schedule edits, search and phase regression; all passed at this intermediate checkpoint. These tests do not establish the React integration or browser interaction result. Earlier commercial-component test execution was blocked by an incomplete source download, not an asserted application failure.

The sourdough reviewer corrected a storage-signature issue identified here: historical fridge events must not mask addition/removal of future cold storage. Future fridge-event sequence/count is now compared separately, and warning text refers to an estimated maturity window. Six component-probe tests independently passed, including known peak, room-temperature starter, week-old refrigerated starter, active-duration overlap, half-open boundaries and immutable history. The optimized-next-day fixture was strengthened to require an actually valid slot rather than merely no side effects from potentially all-invalid probes.

Caller review also flagged two messaging/history issues for integration: a failed pinned search alone does not prove that pins caused the failure, and an expired unstarted preferment recommendation must not be casually equated with a completed preparation. An explicit reset/restart needs to distinguish these states or state the remaining limitation.

Latest independent execution: **37 tests passed** across schedule-edit, schedule-search, schedule-regression and key-timing-starter files after the two core corrections. The concise failed-pin message now says no slot was found while retaining the selected times. The current integration conservatively preserves elapsed commercial preparation on Reset because it has no explicit completion-aware distinction; resetting an expired but unstarted recommendation remains a limitation.

The caller's legacy sourdough input-change effects were subsequently narrowed: populated explicit timing overrides route through the pin-preserving replan helper, including bake/input/ratio-triggered solves. No-override legacy initialization remains distinct. This resolves the identified source-level overwrite route; broader interaction evidence remains separate from the core gate.

## Final corrective integration review

Reviewed the follow-up local changes after the parent reported CI run `36089442827` at `b2239d8` passing 300 unit tests/build and 180 macOS WebKit cases. That CI evidence was supplied by the coordinating agent, not independently fetched by this reviewer, and precedes the final corrective patch.

- `onScheduleValidityChange` now carries canonical committed validation into both Simple and Custom Continue/generation gates. Unconfirmed edits separately withhold Continue, so a valid draft cannot generate a recipe using old committed times.
- Commercial Reset now seeds the current model's preferred mixing centre and preferment duration before searching with current blockers, rather than accepting the old valid manual schedule as the recommendation. Storage mode and bake time remain unchanged.
- Legacy warning panels are suppressed once the full candidate timeline is available, leaving the candidate-derived inline message instead of duplicate committed-state warnings.
- Independently reran 31 edit/search/sourdough-probe tests after these changes; all passed. No new biological coefficients or empirical maturity claims were introduced.

Parent-reported live checks reproduced the old stale warning, then confirmed immediate clearing in the corrected preview, persisted Reset after confirmation/reload, and manual preferment retention when enabling nights. The initial source review of the Reset seed was insufficient: it did not follow the seed variable back to its manual-time dependency. The stricter browser assertion below supersedes that earlier provisional Reset approval. The completion-versus-expired-preparation limitation above remains.

### Reset seed correction after stricter browser testing

The parent reported eight Reset failures (French/English at four widths, 172 other cases passing) for the preceding corrective patch: Reset retained the manually chosen 20:15 time. `renderSweetCenter` clamps `mixOffsetH` for cold-fermented styles, so it is partly derived from the manual mixing time and is not an independent recommendation.

Reviewed the one-line correction to seed `input.start` from `pendingEatTime - _optimalMix * 3600000`. `_optimalMix` is calculated from the existing style cold preference through `biasCold` plus existing `climateRtH`, without reading `mixOffsetH`. The same fixed-bake search then validates this independent seed against current blockers, supported windows and unchanged storage. This addresses the specific dependency error without modifying scientific coefficients. Final TypeScript/browser rerun evidence must be recorded by the parent before declaring the Reset regression resolved in deployment.

## Remaining limits and acceptance gates

- Verify the caller passes current method/storage/windows/pins and uses the same candidate for messages, slider colors and confirmation. Verify persisted times also recalculate recipe quantities/dosing.
- Check current biological-model limits, including unsupported hot room-only sourdough bounds. Do not manufacture a green window by swapping or loosening bounds.
- **Folds are not included in availability validation at all.** `BakeGuide` still prescribes folds during bulk, but `buildSchedule().availabilityActions` contains no fold action. Consequently a green candidate does not establish that the baker is available for those folds. This is an omitted-action limitation, not merely an unknown duration; no fold timestamps were invented in this repair.
- Starter feeds, commercial-preferment preparation, no-knead combining, refrigerator transfers and starting oven preheat are checked as timestamp-only actions, without handling-duration overlap coverage. Passive preheating is not itself a continuous hands-on interval.
- Divide/shaping receives a modeled active span only when a later second-cold-phase entry supplies its end; other branches check its timestamp only. Modeled mixing/finishing, bagel poaching, piadina rolling and applicable active cooking retain their represented spans. This is not comprehensive hands-on duration coverage.
- Search is bounded, not a proof of impossibility. A failed search needs a concise bounded-result message.
- Numerical tests are not physical baking validation. Physical iPhone Safari and authenticated cloud-save behavior require separate evidence.

## Independent interaction and mobile visual review

The interaction reviewer independently parsed the downloaded report artifacts for CI `36089442827`: **180 cases, all expected outcomes**, including all **36 scheduling-feedback cases** (nine scenarios at 320/375/390/430px). The added scenarios cover fixed-clock poolish/work-block recomputation in both modes, live invalid-to-valid feedback, Cancel, manual pin retention, Reset persistence/current blockers, custom blackout/removal, rapid biga night toggles and room/fridge starter blocker/reset flows. This first passing run precedes the strengthened recommendation-reset and selected-valid-marker assertions.

Independently inspected the actual 320px and 390px WebKit poolish-after-work screenshots. Text and selected-time controls fit horizontally, and the selected time and Continue are readable. The title/date crop under the sticky section bar and partly obscured following row reflect the deliberate scroll-to-control capture; these images alone do not show a load-position regression. At 320px the full slider still requires scrolling even though its exact-time button is visible.

One material coherence issue was identified: valid poolish preparation exactly at 18:00, both the work-block end and axis endpoint, appeared entirely hatched with no visible green. The exact boundary is allowed by the half-open availability rule, but the visual suggested unavailability. The final local correction adds a small green check beside the selected time, with an accessible “Compatible with the estimated schedule” label. The check receives the exact complete current candidate's validity from `SchedulePicker`; it does not invoke the hypothetical slot-edit callback or infer validity from free calendar time. Invalid candidates omit the check, and unknown validity is not presented as valid. This resolves the source-level boundary ambiguity without incorrectly coloring minutes before 18:00 as available. The final marker's deployed screenshots and latest browser assertions require the subsequent verification run.

Read-only CUA inspection of the first corrected deployment also independently confirmed the settled automatic plan (Friday19:30 poolish, Saturday07:00 mixing, Saturday19:30 baking), retained work/night/custom blocks, no stale warning or Reset in the automatic state, and unobscured controls at the observed desktop viewport. Parent-run interactions and independently inspected screenshots are distinguished from interactions performed by this reviewer. No further material source/visual findings remain in this bounded review; scientific and runtime limitations above still apply.

### Final application artifact review

Independently parsed CI `36091509127` for application `89f0f8b`: **188 expected passes and four navigation-test failures**, one at each width. The final 320px and 390px poolish screenshots now clearly show the green selected-time check at the 18:00 endpoint. The previous hatched-boundary ambiguity is resolved without changing the blocked interval. Selected times remain unobscured and readable; the screenshots intentionally retain their scroll-to-control position. The final desktop confirmation screenshot also shows two valid markers, one Reset, no obsolete warning and a usable Continue action. No further material visual issue was identified.

The four failures share a new test's incorrect navigation expectation. Source `advanceAdv` calls `nextUnanswered`, which intentionally skips the already answered schedule after returning to the preferment page. The artifact confirms arrival at step10, “Peaufinez votre pâte”, rather than schedule step9. The corrected test asserts that existing step10 destination, uses Previous to reopen step9, and exercises browser Back/Forward with saved-time/override assertions unchanged. This is a test-only correction; the application did not need modification. All actual scheduling checks, including real native-pointer dragging, overlapping midnight blocks, active-duration overlap, exact endpoints, latest feedback, Reset recalculation and compatibility markers passed in this run. The complete rerun with the corrected navigation expectation remains a pending final gate at this checkpoint.

The coordinating agent subsequently verified the corrected journey in the live browser: Previous9→8, Continue8→10, Previous10→9, browserBack→10 and Forward→9 retained Friday18:15 poolish, Saturday07:00 mixing and Reset. This is separately attributed live interaction evidence. Test-only head `5a7845f` retains application `89f0f8b`; its full CI rerun `36092548019` is pending at this checkpoint.

### Final independent sign-off

Independently fetched job steps and decoded logs for CI `36092548019`, job `107937833776`, after completion. All steps succeeded: **302 unit tests passed, zero failures; image checks and production build passed; all 192 macOS iPhone-WebKit cases passed in 12.2 minutes**. Logs explicitly confirm the corrected Previous/Continue and browser Back/Forward case at all four widths. Head `5a7845f` changes tests only; the application remains the visually reviewed `89f0f8b`. This closes the pending rerun gate above.

Independent source, mobile artifact and final-log review is complete with no remaining material findings within the tested scope. The checks validate software consistency and simulated browser interactions, not physical fermentation, physical-iPhone touch/keyboard behavior, authenticated cloud saving or unmodeled action durations. Custom availability editing remains remove-and-replace; completed-versus-expired preparation remains the documented conservative limitation.

## Recommendation-first prototype review — 25 September 2026

The current prototype adds explicit oven/cooking target language, compact Organisation progress, and horizontal time editors revealed by Modifier. This review inspected the actual helper/guide integration and component diff; browser verification is recorded separately by the coordinating agent.

- `scheduledFoldMinutes` now provides one definition for the generic guide's existing fold prescriptions and `buildSchedule().availabilityActions`: bulk +15 minutes at 0.5–<1.5 hours, +30/+60 at 1.5–<2 hours, and +30/+60/+90/+120 at >=2 hours. These literal existing protocol points are now checked against blockers. No handling duration or new biological coefficient was invented. Bread-specific conditional folds remain untimed and are disclosed; this is not complete measured hands-on-duration coverage.
- Removed the initial-bulk truncation at the first availability block in both cold branches. Passive bulk keeps its existing modeled duration. Fold points and the actual fridge transfer now determine availability validity; the fixed-bake search can move mixing rather than treating every minute of initial bulk as hands-on. Regression checks a passive interval between folds in both cold branches.
- Commercial preferment edits first retain the automatic mixing time. If that fails and no explicit mixing pin exists, the bounded full-candidate search may move mixing while preserving the requested preparation and baking times. Explicit mixing pins remain protected. The visible candidate and Apply use that same result. This does not establish equivalent flexibility for every sourdough feed path, which retains its current joint-solver restrictions.
- The no-knead mixing note now refers to the bulk step's actual folds, removing its contradictory unconditional two-hour instruction. The generic guide renders the shared fold offsets.

Independent local verification after these changes: 30 targeted scheduling tests passed; full suite passed 309/309 tests. This is software regression evidence, not biological validation or browser/mobile verification. The remaining disclosure about conditional bread folds and timestamp-only handling is appropriate. Existing completed-versus-expired-preparation and bounded-search limitations remain.

Follow-up starter integration: extracted the existing bounded starter candidate search for reuse by feed editing. Feed edits retain the displayed automatic mixing time if valid, otherwise may search a different mixing time when it is unpinned. Explicit manual/draft mixing pins remain fixed; historical events, future storage pattern, estimated peak usability, complete action availability and fixed bake validation are unchanged. Seven real component-probe tests pass, including a new comparison demonstrating an additional valid feed time with automatic mixing versus the explicitly pinned case, with zero parent write effects. This supersedes the conservative-feed restriction noted immediately above; it remains a bounded search, not an exhaustive or empirical guarantee.
