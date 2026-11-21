/** Which plan rules a saved bake was made with (round 8, 21 Nov 2026). The hot-kitchen ladder
 * (`buildSchedule`, one fridge spell at 28 °C and above) applies only to plans made after it shipped:
 * a saved bake is never re-shaped under the baker (owner's principle, as for an arranged take-out or a
 * recorded mix). Sessions saved since carry `planRules` = HOT_PLAN_RULES. */
export const HOT_PLAN_RULES = 2;

export interface HotPlanSession {
  planRules?: number;
  legacyHotPlan?: boolean;
  recipeGenerated?: boolean;
  startTime?: number | null;
  execution?: unknown;
  mixExecution?: unknown;
}

/** True when a restored bake keeps the engine's plan shape from before the hot-kitchen ladder: it was
 * kept so already, or it was saved before the ladder (no `planRules`) and is under way (its Start Dough
 * time has come, or a mix or preferment is recorded). A bake not yet under way, a new bake and Bake again
 * get the current rules. */
export function legacyHotPlanFor(session: HotPlanSession | null | undefined, now: number): boolean {
  if (!session) return false;
  if (session.legacyHotPlan === true) return true;
  if ((session.planRules ?? 0) >= HOT_PLAN_RULES || !session.recipeGenerated) return false;
  const start = typeof session.startTime === 'number' && Number.isFinite(session.startTime) ? session.startTime : Infinity;
  return start <= now || !!session.execution || !!session.mixExecution;
}
