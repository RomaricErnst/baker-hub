# Actionable fermentation timing windows — 22 September 2026

## Product decision

Romaric asked to restore the lost early / recommended window / late feedback while preserving the clean migration design, across Simple/Custom, styles, climates and preferments. Independent UI/UX and engine reviews informed this change.

The shared panel above Actions / Visual schedule shows an explicitly labelled **mixing window**, the planned mixing/baking times, a marker and a contextual status. An out-of-window time explains which direction to move mixing and opens the existing time editor. The bake time stays unchanged until the baker edits it. Preferment guidance is distinct: sourdough shows the solver's estimated peak when available; poolish/biga show an observation check. Details explain the difference between timing advice and physical maturity.

The existing duration/fridge timeline remains. No illustrative maturity curves were restored. The requested universal biological readiness verdict cannot be supported by the current engine; this release restores actionable schedule guidance, not measured or experimentally validated maturity.

## Implementation

- `FermentationReadiness.tsx`: compact bilingual display shared by both views/modes, qualitative early/within/late marker, explicit dates across midnight, accessible text plus color, >=44px action/disclosure targets.
- `fermentationAssessment.ts`: pure inclusive chronological-window assessment; invalid or reversed bounds remain unavailable rather than being sorted into a fabricated window.
- `SchedulePicker.tsx`: uses the exact commercial solver raw bounds (shared extraction, preserving calculations) rather than the former broader chart limits. Sourdough uses solver bounds, with contradictory hot-climate render limits suppressed. The existing editor now has a name, 16px text, focus/scroll, a key per edited row, and an explicit Valider / Done button (or Enter) to commit on touch Safari. Blur still commits when focus moves.
- Removed the redundant focused-row mixing hint, whose old bounds differed from the shared panel and omitted day changes. Busy-conflict and applied-suggestion row notes remain.
- Existing unsupported enriched-method combinations, started plans, missing starter inputs, impossible plans and overdue preparation do not earn a positive window. Future busy-time detection uses exact schedule cold intervals, including split refrigeration.
- No dose, temperature, starter-ratio, authentication or production-setting changes.

## Engine limitations found

Commercial yeast dose adapts to timing, temperatures and ingredients; a fixed curve cannot independently determine readiness. The recommended time window is a planning guide and is labelled as such.

Sourdough has inconsistent historical solver/display bounds: hot room-only roman, pan and rye styles can have collapsed/reversed display windows, while the solver's raw bounds remain ordered. These cases display unavailable guidance. They require a separate calibrated model review, not invented visual thresholds. Sourdough starter yellow/red signals also mix availability with maturity; they are not interpreted as a definitive too-young/too-old verdict.

Unknown styles receive no invented window. Enriched recipes retain the existing direct-commercial-only limitation. Already-started plans show observation guidance rather than recomputing an apparent historical mistake from today's remaining time.

## Verification

- TypeScript and isolated production build passed locally.
- Targeted assessment, rendering and schedule regression tests passed. Matrix tests exercise all 15 existing styles, four temperatures (16/22/30/35°C), three flour-strength factors and cold availability: 360 commercial combinations, plus 60 sourdough style/climate checks. These verify software behavior, not biological validation.
- Initial GitHub run `35678729689`: full unit suite and build passed; 20/24 WebKit cases passed. Four direct-dough interaction cases incorrectly assumed an unfinished restored plan would keep its seeded start rather than legitimately re-solve. Test corrected to make an actual user time edit. No application change was needed for that failure.
- Live Vercel preview verified: Simple setup to schedule; switch Actions/Visual schedule; move mixing earlier to show “Pétrissage trop tôt”; use its adjustment button to return inside the window while retaining the bake time; explicit Valider confirmation on the final application build; corrected result also shown in Visual schedule. Late feedback was checked separately.
- Second run `35679203757` exposed a touch-Safari interaction: tapping a non-focusable heading leaves the date input focused, so a blur-only edit remains uncommitted. Added an explicit confirmation button and changed the test to use it; did not weaken the status assertions.
- Run `35679738965` at `66f5476`: 167/167 unit tests, production build and 24/24 WebKit cases passed. The 320px early-state screenshot was visually inspected.
- Run `35679941794` at `8e8d448`: 167/167 unit tests and build passed; 23/24 WebKit cases passed. One poolish view comparison captured the initial restored time before asynchronous re-solving; the test now waits for the visible result to settle before comparing views.
- Final run `35680216465` at test-only commit `efcfaad9`: 167/167 unit tests, i18n/build, 24/24 WebKit checks passed. Preview `dpl_8dA14iiF4eUKsYMjA8DTa7X5UZWd` is READY; application code is `8e8d448`. Mobile cases cover direct/poolish/biga/sourdough, both modes, both languages, 320/375/390/430px, checks disclosure, shared status and editing, alongside existing header/save/menu tests.

Physical iPhone Safari chrome/keyboard and authenticated cloud save remain outside these tests.

## Specialist follow-up requested by Romaric

Read SCIENCE-REVIEW-20260922.md and BLOCKER-REVIEW-20260922.md. The science reviewer ran 47 targeted tests and a 2,700-case generated-schedule probe; blocker reviewer ran 18 targeted checks with concrete active/passive/boundary examples. These are bounded engineering reviews, not empirical baking validation. Preserve existing calibrated coefficients.

`cd6380a` softens labels to before/after the recommended window; retains clear mix-earlier/later actions; condenses observation guidance; describes unsupported estimates as an app limit; and gives known availability conflicts a neutral badge and a route to existing availability controls. Action detection includes preheat and shaping and uses consistent half-open boundaries. Existing hands-on-duration and split-cold solver limitations are documented, not silently declared fixed.

Final UX read-only check found no material regression after neutral availability and calmer advisory wording. Scope remains planning assistance, with no claim that all engine limitations are resolved.

Post-review verification: run `35686741003`, commit `35952d1`, passed 170 unit tests, i18n/production build and 24/24 iPhone WebKit checks, including the custom-block conflict and availability action at 320/375/390/430px. Vercel preview is READY; no production promotion.
