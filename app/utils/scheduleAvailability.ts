/** Availability concerns hands-on actions, never passive fermentation. */
export interface AvailabilityAction {
  id: string;
  at: Date;
  /** Present only for a known active duration; the end is exclusive. */
  end?: Date;
}
export interface AvailabilityPeriod { from: Date; to: Date; label?: string }
export interface AvailabilityConflict { action: AvailabilityAction; block: AvailabilityPeriod }

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
      const hit = hasSpan
        ? Math.max(+action.at, now) < +block.to && +block.from < +action.end!
        : +block.from <= +action.at && +action.at < +block.to;
      if (hit) result.push({ action, block });
    }
  }
  return result;
}
