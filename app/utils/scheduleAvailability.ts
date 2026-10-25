/** Availability concerns hands-on actions, never passive fermentation. */
export interface AvailabilityAction {
  id: string;
  at: Date;
  /** Present only for a known active duration; the end is exclusive. */
  end?: Date;
  /** Set by the canonical builder only for the final, standalone dough removal. */
  fridgeRemovalBake?: number;
}
export interface FridgeRemovalArrangement { at: number; bake: number }
export interface AvailabilityPeriod { from: Date; to: Date; label?: string; fridgeRemoval?: FridgeRemovalArrangement }
export interface AvailabilityConflict { action: AvailabilityAction; block: AvailabilityPeriod }

/** Saved arrangements are a commitment to one exact action, never general availability. */
export function normalizeFridgeRemoval(value: unknown): FridgeRemovalArrangement | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const {at, bake} = value as Record<string, unknown>;
  if (typeof at !== 'number' || typeof bake !== 'number' || !Number.isFinite(at) || !Number.isFinite(bake)
    || Math.abs(at) > 8.64e15 || Math.abs(bake) > 8.64e15 || at >= bake) return undefined;
  return {at, bake};
}

export function getFinalFridgeRemoval(actions: AvailabilityAction[]): AvailabilityAction | undefined {
  return actions.find(action => action.id === 'cold-out-2' && action.end === undefined
    && Number.isFinite(action.fridgeRemovalBake) && +action.at < action.fridgeRemovalBake!);
}

export function isFridgeRemovalCovered(action: AvailabilityAction, block: AvailabilityPeriod): boolean {
  const arrangement = normalizeFridgeRemoval(block.fridgeRemoval);
  return !!arrangement && getFinalFridgeRemoval([action]) === action
    && arrangement.at === +action.at && arrangement.bake === action.fridgeRemovalBake;
}

export function isTimeBlocked(time: Date | number, blocks: AvailabilityPeriod[]): boolean {
  const at = +time;
  return Number.isFinite(at) && blocks.some(b => +b.from < +b.to && +b.from <= at && at < +b.to);
}

export function actionConflicts(action: AvailabilityAction, blocks: AvailabilityPeriod[]): boolean {
  return findAvailabilityConflicts([action], blocks).length > 0;
}

export function findAvailabilityConflicts(
  actions: AvailabilityAction[], blocks: AvailabilityPeriod[], now = -Infinity,
): AvailabilityConflict[] {
  const result: AvailabilityConflict[] = [];
  for (const action of actions) {
    if (!Number.isFinite(+action.at)) continue;
    const hasSpan = action.end != null && Number.isFinite(+action.end) && +action.end > +action.at;
    if (hasSpan ? +action.end! <= now : +action.at < now) continue;
    for (const block of blocks) {
      if (!(+block.from < +block.to)) continue;
      if (isFridgeRemovalCovered(action, block)) continue;
      const hit = hasSpan
        ? Math.max(+action.at, now) < +block.to && +block.from < +action.end!
        : +block.from <= +action.at && +action.at < +block.to;
      if (hit) result.push({ action, block });
    }
  }
  return result;
}

/** Explicit lot identity for shared event lists and conflict diagnostics. */
export function foldActionLabel(id: string, locale: string, mixingBatches = 1): string | null {
  const match = /^fold-(\d+)(?:-batch-(\d+))?$/.exec(id);
  if (!match) return null;
  const fr = locale === 'fr';
  const fold = `${fr ? 'Rabat' : 'Fold'} ${match[1]}`;
  return mixingBatches > 1 ? `${fr ? 'Lot' : 'Batch'} ${match[2] ?? '1'} · ${fold}` : fold;
}
