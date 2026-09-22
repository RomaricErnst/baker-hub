# Availability/blocker review — 22 September 2026

Read-only specialist review of the current fermentation-window implementation. Application formulas and code were not edited. Read AGENTS.md, PROJECT-HANDOFF.md, FERMENTATION-WINDOWS-20260922.md, sourdough-engine-review.md and the historical continuation-reference/engine-audit.md. Findings below concern scheduling executability, separately from biological maturity. Existing historical reports are not treated as current proof.

## Conclusion

The engine already distinguishes many actual actions from passive fermentation, and includes substantial sourdough candidate validation. However, **the current green mixing-window summary does not establish that every action clears availability**. Some conflicts are visible only in lower notes; some action times and active spans are omitted. Preserve calibrated coefficients. The justified immediate changes are neutral conflict presentation, consistent interval edges and checking already-known action timestamps. These improve honest guidance without claiming the whole solver is repaired or scientifically recalibrated.

## Reproduced findings

### P2 — new summary stays green while an action is unavailable

FermentationReadiness derives status from blocked/overdue/unavailableReason and the timing assessment, but not busy. A mix inside the recommended window retains a green check and “Dans le créneau”; busy adds a lower generic sentence, with no correction action. This is technically a mixing-range statement but too easily read as overall plan approval. Existing split-cold work conflicts make this reachable without an invalid recipe.

Minimum recommendation: preserve the estimated window as informative, but give availability conflict neutral priority (“An action needs another time”), name the first action/date, and offer a direct route to adjust the plan/availability. Do not describe unavailable time as biological over/under-fermentation. Do not automatically move an unrelated mixing time or declare every conflict fatal.

### P2 — new summary omits supported action times

The point list includes mix/bake, starter events, commercial-preferment preparation/removal and exact dough cold interval endpoints. It omits schedule.preheatStart and schedule.divideBallTime (the latter is covered indirectly in split-cold but not consistently for room-temperature plans). The new generic “check plan actions” message can also direct to a list that does not expose preheat/shaping and hides some fridge consequences.

Executed production buildSchedule with Neapolitan, mix 2026-09-27 16:00Z, bake 2026-09-28 18:00Z, kitchen22°C, hand mixer, preheat60min. Block 2026-09-28 16:55–17:05Z contains preheatStart17:00. Both conflict objects are null, none of current summary points hit, and readinessBusy is false. Include the preheat-start point, not the entire passive preheat duration. Include explicit divideBallTime; preserve passive proof freedom.

### P2 — interval-start inconsistency

Commercial solver and commercialPrefermentPlanValid use [from,to): blocked at the beginning, free at the end. Existing tests explicitly verify it. New readinessBusy, sourdough candidate blocker checks and action-row notes use strict interior (>from,<to); bakeTimeInBlocker does too. Thus an action exactly when work begins can evade some checks.

Executed production buildSchedule for Neapolitan, stand mixer, mix2026-09-27 16:00Z/bake2026-09-28 18:00Z,22°C/preheat60; block16:00–16:05. Mix ends16:11; both conflict objects null and current readiness point predicate returns false. Manual mix editing does not apply the commercial automatic overlap resolver, so the exact-start state is reachable by editing even if automatic commercial selection avoids it.

Minimum recommendation: use [from,to) in the new detector. Whole-engine boundary unification needs separate regression review; do not claim changing the detector alone changes all sourdough candidate selection.

### P2 — existing active-span gap; do not replace it with passive-overlap warnings

Executed the same stand-mixer Neapolitan example with block16:05–16:10. The complete11min mixing action overlaps the block, but mix-start point is clear; buildSchedule filters blocks before bulk starts16:11 and both conflict objects are null. New summary also misses it. This is a genuine active-span gap, separate from the new display.

Do not indiscriminately check the entire [mix,bulkFermStart) interval: hand Neapolitan is40min including30min passive autolyse, and other styles have autolyse too. The current ScheduleResult does not split initial mixing, rest and final kneading into exact timed actions. A full-span gate would over-warn bakers available before/after a passive rest. Minimum future change: explicitly represent active mixing/handling intervals, then test overlap. For known no-autolyse styles/mixers, the whole preparation interval can be checked accurately. Preferment feed/preparation durations likewise lack complete active interval representation.

### P2 — existing split-cold conflict is detected by summary, not solved comprehensively

For the hand-mixer26h example above, work2026-09-28 09:00–18:00 leaves second cold exit13:45 inside work; split-cold buildSchedule returns coldExitConflict:null. The summary detects the endpoint, but stays green as described above. The split branch extends cold exit only when relevantBlocks.length>1, unlike the single branch; it does not populate coldExitConflict. Consequently the existing single-phase “Bake at …” action is absent. Treat this as an existing solver/actionability gap, not a new biological-model error. Do not promise an automatic repair from a generic adjustment button.

## Intended behavior verified or inspected

- **Passive cold interval overlap:** the same26h plan with night23:00–07:00 fully inside cold phase yields no summary conflict. This is correct. Bulk/proof periods are not blanket-blocked.
- **Weekdays/nights:** weekday preset uses local09:00–18:00 Mon–Fri; nights use local23:00–07:00 and explicitly start the cursor on the previous day to cover early morning. Calendar setDate/setHours preserves local wall-clock endpoints through DST; elapsed fermentation uses milliseconds. Labels/keys are not the actual comparison values. No physical timezone/DST interaction sweep was performed.
- **Custom/cross-midnight:** explicit datetime endpoints are compared chronologically; to<=from is rejected, so crossing midnight requires the following date. Overlapping blocks are tested with some(); overlap resolution repeatedly advances to block end. Resolver safety caps10/20 are finite; pathological many-block chains were not replayed.
- **Commercial direct/poolish/biga:** joint solver scans mixing and preparation, keeps selected method if impossible; plan-validity gate rejects insufficient prep, past unstarted prep, reversed dates, blocked mix/prep. Poolish fridge removal during a busy period is intentionally a soft preference (warmupClear score), not a hard rejection: preserve this documented policy while making the consequence clear. A5-second action can still be physically impossible away from home; surface it calmly instead of silently overriding availability.
- **Sourdough:** candidateActionTimes records feed, extra refreshes, bridge feeds, starter fridge-in/out and mix from shared event derivation. Candidates reject present/future actions in unavailable time; firmly past actions older than1h are exempt as history. Dough cold actions are not part of this starter candidate list; summary can detect later schedule conflicts. New summary only checks strictly future events while solver uses1h grace: no claim that this mismatch is fixed.
- **Simple/Custom:** same summary and canonical schedule state; modes do not justify different availability policy.
- **Manual/reset/restore:** manual mixing can preserve a baker-selected time and needs visible conflict feedback. Reset clears mix/feed/ratio overrides and ratio history and reruns with current blocks. Sourdough toggles synchronously use new local blocks; prop sync addresses stale-block regressions. Generated restore temporarily freezes solver to preserve existing plans; unchanged commercial restore allows historical preparation and shows overdue guidance. No new full UI toggle/reset/restore blocker matrix was executed in this review.
- **Impossible schedules:** commercial preferment invalidity and short/reversed windows suppress green; sourdough empty/dead-end fallback guards tested. Direct all-busy fallback and full action feasibility should not be inferred from merely being in the biological planning range.

## Validation and limits

Ran production probes described above through tests/load-production.cjs (no copied algorithm), then existing targeted tests:

`node --test tests/schedule-regression.test.cjs tests/commercial-preferment-schedule.test.cjs tests/sourdough-schedule-guards.test.cjs`

18/18 passed. Coverage includes phase accounting, short windows, commercial preferment feasible/impossible cases, boundary contract, restore source guards and sourdough fallback source guards. Source assertions are weaker than interaction tests. This finite review does not certify all sourdough families, DST transitions, full UI blocker state transitions or physical baking science. Existing24WebKit checks establish rendering/basic editing, not a comprehensive availability matrix.

## Smallest useful delivery

1. Neutral availability state above optional detail, with first affected action and a clear adjustment route; no alarming tone or biological claim.
2. New detector uses half-open blocked periods, explicit preheat/shaping/cold/feed/mix/bake times and no passive-phase overlap rules.
3. Focused tests prove start blocked/end free, preheat/shaping caught, passive cold/rest not warned, and conflict overrides green presentation.
4. Document remaining active-span and solver feasibility gaps. Any solver changes require independent targeted regression evidence before changing behavior; no formula constants need changing for these findings.

## Root integration after the read-only review

Implemented the bounded display corrections in `cd6380a`: `hasActionConflict` uses half-open blocks and future action timestamps; the summary includes preheat, divide/shape and preparation-completion timestamps alongside existing feed/mix/fridge/bake points. An in-window plan with a known availability conflict has a neutral status and a “Review my availability” button that focuses the existing availability controls. No automatic correction is promised. Passive phases are not treated as active intervals.

Added regression checks for interval boundaries, neutral priority, preheat/shaping detection and passive cold acceptance, plus an iPhone interaction that adds a block beginning at bake time and opens availability from the summary. Final CI result is recorded in PROJECT-HANDOFF.md.

Remaining: detailed active handling spans are not represented, sourdough/row boundary predicates are not globally unified, and split-cold conflicts are surfaced without a universal automatic repair. The existing solver gaps above remain open. No whole-engine feasibility or biological validation claim is made.

Live preview follow-up: enabled weekday 09:00–18:00 availability on a Monday 18:00 bake. After recalculation the summary showed neutral “Horaire à ajuster”; its availability button focused the named controls. No formula or candidate-score changes. Post-review unit count is 170, including three new conflict regressions. Run 35686377559 passed unit/build checks; mobile test matched the exact text without its status icon, corrected in 35952d1. Final rerun recorded in handoff.
