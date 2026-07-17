# Sourdough Engine — Deep Review (July 17, 2026)

## The end game (restated)

Give a busy baker a pragmatic, executable plan built from three inputs: the state of
their starter (where it lives, when it was last fed, how it behaves), when they want to
bake, and when they are actually free. Keep it simple on the surface, mimic best practice
underneath, and use tricks like feed-ratio changes to hit the sweet spot when time is
awkward.

## How the current engine works (as built)

`findOptimalPositionSourdough` generates competing candidate plans and scores them:

- **Peak 1** — use the current/upcoming peak directly (feed already done or imminent).
- **Peak 2A** — let the starter fall to its trough, refeed, use the second peak.
- **Peak 2B** — refeed now (starter declining/depleted), use that peak.
- **Future-feed** — schedule a single future feed timed so the starter peaks at mix.
- **Refresh + bridges** — 1–2 intermediate refreshes to close a 6–24h dead zone.
- **Path B (fridge hold)** — refresh, peak, chill, then a pre-mix feed; for 2+ day bakes.

Each candidate is scored `(starterScore + doughScore) × 100 + retardBonus×weight +
mixComfort×2 + feedComfort×3`, then the highest-scoring candidate whose every action
(mix, feeds, fridge in/out, intermediates) clears the baker's blockers wins. A second
pass (Stage 2) re-runs the whole evaluation at each feed ratio (1:1:1 … 1:10:10) and
recommends the ratio that best clears blockers / scores highest — this is the "trick to
find the sweet spot based on available time" the brief asks for.

## What is genuinely good here

- The three-input framing (starter state / bake time / availability) is exactly right.
- The candidate-competition design is the correct shape for "pick the most pragmatic plan."
- The ratio search is a real, differentiated lever, and it is already wired end to end.
- Chart ↔ card ↔ solver share canonical timestamps by construction (the `actionTimesMs` /
  `renderFridgeInMs` machinery) — the historic "graph and card disagree" class of bug is
  structurally prevented now.

## Fixes shipped in this pass

1. **Mix-hour comfort** — `reasonableHour()` returned a flat `1` for all sourdough, so a
   3 a.m. Start Dough cost nothing and could win a tie. Both `combinedScore` and the
   per-ratio `combinedScore_r` now add `feedComfort(mixHour) × 2`, so humane mix times win
   biologically-equal ties without ever overriding a starter/dough score tier.
2. **FR translation** of the depleted-starter note (was English-only).
3. **Session persistence** (separate batch) — starter location, last-fed age, ratio,
   peak/feed times now save and restore from both localStorage and the DB, so a resumed
   sourdough plan no longer collapses to "now."

## Two calibration questions for the owner (NOT changed unilaterally)

Numbers from the pure biology functions, mature wheat levain, `pain_levain`:

| temp | 1:1:1 | 1:2:2 | 1:4:4 | 1:5:5 | 1:10:10 |
|------|-------|-------|-------|-------|---------|
| 22°C | 12.0h | 14.9h | 17.8h | 18.8h | 21.7h |
| 26°C |  7.0h |  8.7h | 10.4h | 10.9h | 12.6h |
| 30°C |  4.0h |  5.0h |  5.9h |  6.3h |  7.2h |

**A. Base peak may run slow.** A vigorous 1:1:1 levain at 22°C typically peaks in ~5–8h;
the engine says 12h. Erring long is the *safe* direction for planning (you won't miss the
peak), but it makes the app tell bakers to feed earlier than a confident baker would. This
is a one-line change to `getPrefPeakH_RT`, but it ripples through every bell curve, card
time and blocker calc — high blast radius this close to launch.

**B. Ratio lever is under-powered.** 1:1:1 → 1:10:10 only stretches the peak 1.81×
(`1 + 0.35·ln(r)`); real starters stretch ~2.5–3×. A stronger coefficient (≈0.5) would let
the ratio trick actually rescue awkward windows, which is the whole point of the feature.

**DECISION (Jul 17): applied both now.** Sourdough peak curve recalibrated to real-world
vigorous-levain timing (1:1:1 @ 22°C: 12h → 6h) as a dedicated `sourdough`/`levain` branch
in `getPrefPeakH_RT`, leaving the poolish curves untouched. Ratio coefficient raised
0.35 → 0.5 (spread 1.81× → 2.15×). New numbers:

| temp | 1:1:1 | 1:2:2 | 1:4:4 | 1:5:5 | 1:10:10 |
|------|-------|-------|-------|-------|---------|
| 22°C |  6.0h |  8.1h | 10.2h | 10.8h | 12.9h |
| 26°C |  4.5h |  6.1h |  7.6h |  8.1h |  9.7h  |
| 30°C |  3.0h |  4.0h |  5.1h |  5.4h |  6.5h  |

Side benefit: shorter peak → smaller `minViableH` → fewer false "window too short" flags,
which directly helps the busy-baker use case. Still slightly conservative at the cool end
so planning ahead doesn't undershoot the peak.

## Simplicity note

`SchedulePicker.tsx` is ~6.7k lines and the solver carries six candidate families plus
bridges and Path B. It is impressively correct but heavy. If post-launch feedback shows
bakers only ever hit 2–3 of these paths in practice, there is a real opportunity to retire
the rarely-used branches and shrink the surface area — a maintainability win, not a
user-facing one. Flagged for later, not for the 5-day window.
