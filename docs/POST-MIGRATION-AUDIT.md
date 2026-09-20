# Required independent acceptance audit

User requested an agent review AFTER migration completion. Do not treat the current preview as full acceptance.

Build an issue ledger from original outputs/engine-audit.md, about-science-audit.md, navigation-audit.md, journey-parity-recheck.md, final-flow-review.md, prototype-steps-practical-review.md and all other relevant audit reports. Each finding needs original source, migrated location, expected behavior, evidence, status and retest result. No finding may be closed merely because code changed.

Review streams:
1. Science: every pizza/bread style, flour and hydration, yeast/preferment and sourdough, mixer heat, climate sensitivity, temperature and humidity assumptions. Distinguish published facts from estimates; verify questionable claims with primary sources.
2. Fermentation graphs: every method including sourdough, room/cold/multiple cold phases, preferment timing, availability, graph/schedule/recipe agreement and boundary cases.
3. UX: mobile/desktop EN/FR and units; setup, editing, navigation, recipe, steps, pizza selection, shopping, preparation, bake queue, save/restore and sharing.
4. Completeness and content: preserve every valid original feature, help/FAQ, actionable step instructions, readiness cues, illustrations; remove repetition and unsupported promises. Check every visible state, not only the happy path.

Independent agents should challenge the implementation; root integrates fixes and reruns affected checks. Science requires evidence and uncertainty disclosure, not a claim of universal correctness. Agents were usage-limited during initial migration; do not claim this final audit has run yet.

## Renewed prototype parity review — 21 September 2026

The final `/tmp/proto.html` overrides remain the baseline. The earlier migration
sign-off was not sufficient: fine-tuning, scheduling presentation, manual flour
entry, and preferment guidance retained older implementations.

Restored in this pass:
- Vertical fine-tuning fields, recommended hydration/reset/breakdown, measured
  flour/preferment temperatures wired to heat balance and saved sessions.
- A 20% preferment starting point independent of an unset schedule, gram
  estimates, and the final Poolish decision guidance.
- Action schedule by default and a separate fermentation graph; both retain
  starter feeds, fridge actions and commercial preferment actions.
- Flour search state survives scan/type cancellation; exact scan matches use
  catalogue metadata, uncertain matches ask for a type. Manual entry retains
  type even when W is supplied; optional protein is identified as user-entered.
- Step overview is portalled above navigation so its last entries are reachable.
- Explicit Settings Done returns to the originating page.

User-requested presentation changes retained: compact yeast/preferment images,
whole-subject opening photos, compact style images, readable controls, and moving
bake naming out of style selection. These are separate from parity restoration.

Browser evidence: Cuoco search -> scan -> cancel retains query; product details
-> choose returns selected card; 28 cm / 275 g typing commits correctly; action
and graph tabs both work for a dated Poolish plan; fine-tuning renders on phone.
Physical camera capture/live recognition and authenticated cloud save/share are
not yet verified. Automated recognition-handling tests do not replace those checks.
