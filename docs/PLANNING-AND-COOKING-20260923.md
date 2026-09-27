# Planning and cooking navigation — 23 September 2026

Implementation and review record for the preview branch. Publication status is tracked in the task and deployment metadata.

## Names and forward path

Keep the common destinations **Préparation / Preparation** and **Cuisson & service / Cooking & serving**. The latter includes oven/griddle guidance, cooking, bread cooling and the relevant serving action. It must not become a pizza-only “Cuisson” label while the navigation still serves bread.

In the pizza cooking destination, the parent removes competing Guide/Cuire tabs. The intended forward path is preheat → oven-specific shaping/topping/cooking instructions → one primary action into the per-pizza cooking queue. The queue has a secondary **Four et conseils de cuisson / Oven and cooking advice** return. An empty pizza selection retains **Choisir mes pizzas / Choose my pizzas** rather than claiming there is already a queue. Bread retains its cooling stage and assembly/serving action. Its preceding bake card is titled **Cuire le pain / Bake the bread**, avoiding a serving claim before required cooling.

The guide uses local cooking counters: pizza 1/2 and 2/2; most bread 1/3 through 3/3; bagels include poaching, making four cooking stages; unleavened flatbread has two. Preparation totals exclude cooking stages. Global element identifiers, saved completion indices and progress keys remain unchanged. Reading ahead and marking completion remain independent.

The final pizza heading is **Cuire les pizzas / Bake the pizzas**. Oven-specific actions are visible rather than hidden beneath a handoff button. The default primary handoff is **Commencer la cuisson des pizzas / Start baking the pizzas**; the parent may supply the applicable selected/empty-selection wording. Secondary help remains optional. The final guide card has no inactive Next control or competing footer primary. The parent’s contextual next/previous labels are preserved.

## One planning view, optional rescheduling

The default is a quiet dated agenda with exact action times, active durations, named waits and visibly compressed long intervals. Availability is entered above the agenda and appears as shaded intervals. The vertical spacing is deliberately not a linear time scale. Simple and Custom share the same interaction.

“Modifier les horaires” reveals edits. A proposed time previews all resulting rows, retains struck-through original times, and requires Keep or Cancel. Keep is disabled for invalid schedules. The outer Continue action is hidden while a proposal remains open. Positive confirmation appears after committing a change; actual conflicts remain visible without an edit. Preheating retains its full duration even if another event occurs during it. Availability conflicts are attached to the affected action rather than combined into the mixing-window warning.

The existing scheduling engine remains authoritative. Commercial preferment and known starter-peak guards are retained. Complex multiple-feed starter changes require dedicated starter replanning instead of a speculative calendar edit. No new biological peak calibration is claimed.

An independent UI/UX reviewer interacted with 26-hour plans at 320/390px in Simple and desktop Custom, plus a 48-hour plan with unavailable time. Their preferred foundation was this unified agenda over the previous split views and the fixed-scale mockup. Their three release findings—an active outer Continue during a draft, truncated apparent preheating, and conflated warnings—were addressed before final verification.

## Ready-time estimates and their limits

`app/utils/servingTime.ts` provides an optional offset from the existing start-of-cooking timestamp. It does not change fermentation calculations. Preheating and bagel poaching already precede that timestamp and are not added a second time.

Supported estimates use existing upper guide endpoints:

- A single default-size focaccia, bagel or ciabatta: numeric protocol baking time plus its explicit cooling allowance.
- Greek pita or piadina at the protocol weight: existing one-at-a-time griddle allowance multiplied by item count. These protocols serve/fill warm. The note still requires safe handling.
- One country, sourdough, wholemeal or rye loaf: existing oven guidance plus the upper endpoint of `breadCoolingRange`. This is an indicative allowance, not calibrated doneness. Weight changes the cooling allowance, not the generic oven duration; the note says so. Rye can reach the next day.
- Thin round pizza styles with a supported oven and a known first topping heat band: the existing upper cooking endpoint for the **first pizza only**, not completion of the whole order.

Unknown oven batch capacity, changed profile weights, untimed cooling/steam settling, unsupported ovens and pan/deep-dish timing return `null`. Pocket pita, batbout, kebab bread and panuozzo therefore retain an explicit start-of-cooking field rather than receiving invented readiness minutes. Pizza without a known first topping heat band also retains that fallback.

Readiness labels distinguish **Pain prêt à trancher**, **Pain prêt à garnir**, warm griddle breads and **Première pizza prête**, each marked as an estimate. A bread-to-fill estimate excludes filling preparation and assembly and explicitly is not the meal time. The parent integrates the offset with the time input and schedule while retaining the canonical cooking-start timestamp. Date rollover must preserve the actual day. These changes do not validate a full dinner deadline or physical bake.

## Related simplifications in the current revision

Bread selection keeps the bread photograph dominant, with a smaller labelled meal example for supported sandwich, tartine and wrap families. Bread-only styles remain single-image cards. The flatbread group/jump is **Pitas & wraps**; **Pain à wrap · Laffa** and **Galette à garnir · Piadina** explain their use. The repeated bread-selection instruction is removed while optional fillings remain explained.

Simple temperature setup displays the actual saved/current value in one confirmation sentence with **Modifier** to reveal precise controls. It does not overwrite saved kitchen, fridge or flour-storage values. Fridge/flour controls remain optional. Parent-owned setup/footer/destination integration should be reviewed together rather than accepted from these isolated component changes.

For the separate raw-chicken pita addition and official handling references, see `CHICKEN-PITA-20260923.md`; this navigation work does not constitute a cooking trial.

## Verification

Production build, i18n and TypeScript passed. All 259 unit/component/domain tests passed. Independent Chrome interaction checks covered 320/390px Simple, desktop Custom, 26/48-hour schedules, cooking forward/back, local numbering, cancellation, invalid-time blocking and the final reviewer fixes. No browser errors or horizontal overflow were found in those checks.

All 92 mobile WebKit cases are covered by passing runs at 320/375/390/430px: 84 passed in the full run; eight header cases initially expected the old dough-selection wording and all eight passed after updating those assertions to the new pizza heading. No application change was required for those failures. Authenticated cloud saving and physical Safari keyboard/toolbar behavior are not covered. Browser checks use a local production-equivalent build; deployment readiness is checked separately. No physical baking, cooking or validated meal-service deadline is claimed.
