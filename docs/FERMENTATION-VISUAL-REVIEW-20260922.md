# Fermentation visual review — 22 September 2026

## Decision
Use a visual schedule rather than curves whose height suggests dough maturity. The previous illustrative bells were not calibrated to the recipe's changing yeast dose; a fixed biga peak could misleadingly make a valid schedule look unready. Solver helpers remain unchanged; only the presentation and exact cold-interval wiring changed.

## Behaviour
- Separate preferment/starter and dough duration lanes; direct dough uses one compact lane.
- Always-visible preparation/feed, fridge-removal (when applicable), mixing and baking dates/times.
- Blue exclusively marks refrigeration, using actual schedule intervals. Mixing and shaping gaps are excluded; preferment warm-up is not painted cold.
- Expandable dough fridge-entry/removal timestamps.
- Draggable markers, keyboard 15-minute adjustment, busy-period display, reset to recommendation. Changes remain tied to the scheduler.
- Action display no longer rounds canonical minutes independently; late-night values keep the correct day/time.

## Verification
WebKit iPhone simulation at 390×664: direct, biga, poolish and sourdough paths. Biga/direct keyboard movement updates visual and Actions timestamps identically. Direct pointer drag moved mixing from 11:00 to 14:15; Actions matched. Sourdough refresh and mixing times match across views. Expanded fridge timestamps remain reachable by scrolling.

154 automated tests passed, including finite geometry across fermentation methods/temperatures, exact split cold periods with mixing gaps, poolish warm-up, starter refrigeration events and non-rounded timestamp formatting. TypeScript passed. This view describes scheduled durations, not a biological maturity measurement.
