/** Which plan rules a saved bake was made with (round 8, 21 Nov 2026). The one-trip ladder (`buildSchedule`,
 * one fridge spell) applies only to plans made after it shipped: a saved bake is never re-shaped under the baker
 * (owner's principle, as for an arranged take-out or a recorded mix). Sessions saved since carry `planRules` =
 * HOT_PLAN_RULES: 2 the ladder for commercial doughs (round 8), 3 also for Simple levain (22 Nov 2026 round 9,
 * owner decision 4). */
export const HOT_PLAN_RULES = 3;
/** The rules that first gave commercial doughs the ladder: a commercial bake saved with them is already current. */
const COMMERCIAL_LADDER_RULES = 2;

export interface HotPlanSession {
  planRules?: number;
  legacyHotPlan?: boolean;
  recipeGenerated?: boolean;
  startTime?: number | null;
  execution?: unknown;
  mixExecution?: unknown;
  yeastType?: string | null;
  prefermentType?: string | null;
  starterFeedRecords?: readonly unknown[];
  starterEvents?: readonly { kind: string; time: number; historicalStorage?: boolean }[];
}

const isLevainSession = (session: HotPlanSession) => session.yeastType === 'sourdough' || session.prefermentType === 'levain';

/** True when a restored bake keeps the engine's plan shape from before its ladder: it was kept so already, or it
 * was saved before the rules that now re-shape it (no `planRules` for any dough; below 3 for a levain dough) and
 * is under way: its Start Dough time has come, a mix or preferment is recorded, or, for a levain, a starter feed is
 * recorded or a planned starter step's time has come (the bake begins with the jar). A bake not yet under way, a new
 * bake and Bake again get the current rules. */
export function legacyHotPlanFor(session: HotPlanSession | null | undefined, now: number): boolean {
  if (!session) return false;
  if (session.legacyHotPlan === true) return true;
  if (!session.recipeGenerated) return false;
  const rules = session.planRules ?? 0;
  const levain = isLevainSession(session);
  if (rules >= HOT_PLAN_RULES || (rules >= COMMERCIAL_LADDER_RULES && !levain)) return false;
  const start = typeof session.startTime === 'number' && Number.isFinite(session.startTime) ? session.startTime : Infinity;
  if (start <= now || !!session.execution || !!session.mixExecution) return true;
  if (!levain) return false;
  if ((session.starterFeedRecords?.length ?? 0) > 0) return true;
  return (session.starterEvents ?? []).some(event => !event.historicalStorage && event.kind !== 'last_fed' && event.kind !== 'known_peak'
    && Number.isFinite(event.time) && event.time <= now);
}
