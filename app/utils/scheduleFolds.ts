import { getBreadProtocol } from './breadProfiles';

/** The existing generic BakeGuide's prescribed offsets from bulk start.
 * These are protocol actions, not a new fermentation model. Bread protocols
 * prescribe conditional folds without fixed times; do not invent those here.
 * Handling duration is unspecified, so availability checks use point events.
 */
export function scheduledFoldMinutes(bulkHours: number, styleKey: string): number[] {
  // Rye (pain de seigle) is never folded: it has too little gluten to strengthen.
  if (getBreadProtocol(styleKey) || styleKey === 'pain_seigle' || !Number.isFinite(bulkHours)) return [];
  if (bulkHours >= 2) return [30, 60, 90, 120];
  if (bulkHours >= 1.5) return [30, 60];
  if (bulkHours >= 0.5) return [15];
  return [];
}

/** Minutes after the first batch's mix ends at which each of its folds is
 * scheduled (fold-1, fold-2, …), as the plan actually times them — including
 * the wait for later batches to be mixed. The guide's "After 15 min" text
 * should read these, so it agrees with the plan (e.g. +22 min with 3 batches). */
export function firstBatchFoldMinutes(schedule: {
  availabilityActions?: { id: string; at: Date }[];
  batchMixWindows?: { end: Date }[];
}): number[] {
  const mixEnd = schedule.batchMixWindows?.[0]?.end;
  if (!mixEnd) return [];
  return (schedule.availabilityActions ?? [])
    .filter(action => /^fold-\d+$/.test(action.id))
    .sort((a, b) => +a.at - +b.at)
    .map(action => Math.round((+action.at - +mixEnd) / 60000));
}
