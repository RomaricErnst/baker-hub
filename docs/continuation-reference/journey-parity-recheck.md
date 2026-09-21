# Journey parity recheck — 15 September 2026

Scope: static comparison of current app source (`work/baker-hub`) with prototype modules. No authenticated end-to-end or live model verification. The prototype is not yet a faithful substitute for the existing application.

## P1 — must retain before a release

1. **Schedule-dependent steps are replaced by a fixed sequence.** `prototype-fermentation-steps.js:2–25` always adds room-temperature fermentation, fridge transfer and cold fermentation for pizza, while bread always takes a generic bulk/shape/proof/bake/cool route. Existing `BakeGuide.tsx:879–880,1675–1705` explicitly distinguishes no-cold, cold and a second cold phase. Build the visible steps from the same schedule as production; test same-day direct, cold bulk, cold balls/two-phase, bread and sourdough. A clean navigation shell must not delete these branches.

2. **Recipe saving is an in-memory demonstration and repeated Save duplicates a bake.** `prototype-rework-handlers.js:7` pushes a new record every time. `openSaved` at line 8 redirects any unfinished generated bake to Steps rather than its exact last location. Existing `SessionViewer.tsx` uses Supabase for notes/photos/name and cloud sessions. Preserve durable cloud saving, stable record identity, and intended resume location in the final integration. Reload/cross-device tests remain required.

3. **Maestro is explicitly unavailable in this prototype.** Handler line 75 returns a fixed unavailable response. Its visible photo/question controls do not validate the production feature. Keep the existing production integration and test it separately with relevant step context and photo uncertainty.

4. **Bread and starter thermal/quantity routes remain incomplete.** `prototype-water-source.js:42–43` rejects sourdough and enriched dough; the step quantity system may consequently offer preview navigation rather than execution. This is honest as a prototype limitation, but cannot count as complete bread parity. Final integration must use the production recipe quantities and supported thermal calculation or a clear supported fallback.

## P2 — concrete UX corrections

5. **Cold fermentation help is mapped to bulk help.** `prototype-rework.js:28` maps any title containing “ferment” to bulk. “Move to the fridge” falls through to bake. Use stable stage IDs for FAQ selection, including a dedicated cold key. Existing `BakeGuide.tsx:1699` uses cold FAQ explicitly. The generic equipment advice at prototype line 64 also shows mixer instructions during non-mixing steps; constrain those tips to mixing.

6. **Mixing instructions lose conditional detail.** `prototype-step-quantities.js` uses one spiral timing paragraph and generic instructions for other mixers. Existing `BakeGuide.tsx:1272–1323` varies ingredient order, reserved water, preferment incorporation and oil addition. Retain these conditional instructions in concise expandable technique content, with the essential ingredient order in the active step.

7. **French setting does not translate the journey.** Settings changes `lang`, but most screen headings/actions are hard-coded English (`prototype-rework.js:37–88`). Catalogue data sometimes switches language, creating a mixed-language screen. Treat English-only as an explicit prototype scope; restore complete French before parity claims.

8. **All steps overview exists and should be retained.** `prototype-step-quantities.js:13` provides expandable future steps, ingredients and current/completed labels. This is good exploration without marking work complete. Verify completed-step revisiting and return-to-current behavior in a browser; do not turn looking ahead into completion.

9. **Rebaking intentionally drops busy times.** `openSaved` resets blocks and presets. Consider reapplying saved kitchen availability defaults and asking for a new serving date; do not silently carry obsolete dates or drop recurring personal availability. A rebake should preserve recipe decisions, reset execution/photos, and rebuild a fresh schedule.

## Recommended review sequence

First restore schedule/method parity and stage-specific help. Then compare one direct pizza, one poolish cold pizza, one two-phase pizza, one direct bread and one sourdough bread from planning to result. After that verify save/reload/resume/rebake, sharing and French/imperial settings on the integrated candidate. Attractive prototype pages alone cannot establish those outcomes.
