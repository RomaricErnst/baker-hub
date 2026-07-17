# Baker Hub — Pre-launch App Audit (July 17, 2026)

Scope per owner: usability, features, UX/UI. Biology excluded (handled separately).
Findings are grouped by whether they're worth doing inside the 5-day launch window.

## Already fixed this session
- Removed a stray `GENERATE_PCT` debug `console.log` from the generate handler.
- Persistence of shopping/prep ticks, guide progress, schedule times, sourdough state.
- Guide rebuilt into clean timeline + Tips/FAQ/Maestro; Maestro output tightened.

## Launch-window candidates (small, high value)

**U1 · No error / not-found / loading routes.** There's no `app/error.tsx`,
`not-found.tsx`, or route-level `loading.tsx`. A thrown render error shows the raw Next.js
overlay in dev and a blank screen in prod. A minimal branded error page + 404 is ~30 min and
meaningfully more professional for a public launch.

**U2 · Primary controls are click-only `<div>`s.** The bake-type cards, mode cards and
journey tabs use `<div onClick>` with no `role="button"`, `tabIndex`, or Enter/Space
handling. They work with a mouse/touch but are invisible to keyboard and screen-reader users.
Converting the ~5 most important ones to real buttons (or adding role/tabIndex/onKeyDown) is
a modest, self-contained a11y win.

**U3 · First-run orientation.** A brand-new visitor lands on the hero + Pizza/Bread picker
with no one-line "what this does / how it works." A single subtitle under the hero
("Plan pizza & bread dough around your real schedule — we handle the timing.") would reduce
bounce. Copy-only, no logic.

**U4 · Reset scope.** `startOver()` now clears the new tick/guide keys (good). Worth a quick
confirm that switching Pizza→Bread mid-session also clears any stale Pizza Party quantities
from the shopping list so a bread bake never shows pizza toppings. (Spec says it should;
worth a live check once deployed.)

## Post-launch backlog (bigger, not for this window)

**B1 · Scheduler first-use load.** The Custom scheduler is powerful but dense on first
contact. A collapsible "how to read this chart" helper or a 3-step coach-mark would help
Persona A/B2 (learners) without touching the engine.

**B2 · Solver surface area.** `SchedulePicker.tsx` is ~6.7k lines with six candidate
families. Impressively correct but heavy to maintain. Once live telemetry shows which paths
bakers actually hit, retire the cold branches. Maintainability, not user-facing.

**B3 · Offline / PWA.** Bakers use this in the kitchen over hours. An installable PWA with
offline read of the current plan + guide would fit the use case well.

**B4 · Guide FAQ depth.** The new per-step FAQ covers the top 2–3 questions per step. Worth
expanding from real support questions after launch.

## Explicitly NOT issues (verified good)
- Chart ↔ card ↔ solver timestamp agreement is structurally enforced.
- i18n coverage: build fails if fr.json is missing any en.json key.
- Session save/restore now covers schedule + sourdough + pizza + ticks.
- Topping images carry alt text; the one empty alt is a decorative thumbnail.
