/** Schedule guidance only: these states do not measure biological maturity. */
export type TimingWindowStatus = 'early' | 'within' | 'late' | 'unavailable';

export interface TimingWindowInput {
  mixTime: Date;
  bakeTime: Date;
  /** Chronological bounds supplied by the selected method's existing engine. */
  windowFrom: Date | null;
  windowTo: Date | null;
}

export interface TimingWindowAssessment {
  status: TimingWindowStatus;
  /** Position within the recommended window, clamped to [0, 1]. */
  marker: number | null;
  /** Signed distance from the nearest boundary; zero inside the window. */
  offsetMinutes: number | null;
}

/**
 * Compare the planned mix with an explicitly supplied recommended mixing window.
 * Earlier mixing means longer fermentation before the same bake; it does not
 * mean the dough is under-fermented. No style, climate, or maturity thresholds
 * are invented here. Missing or contradictory engine guidance remains unknown.
 */
export function assessTimingWindow({
  mixTime, bakeTime, windowFrom, windowTo,
}: TimingWindowInput): TimingWindowAssessment {
  const unavailable: TimingWindowAssessment = {
    status: 'unavailable', marker: null, offsetMinutes: null,
  };
  const stamp = (value: Date | null): number =>
    value instanceof Date ? value.getTime() : NaN;
  const mix = stamp(mixTime);
  const bake = stamp(bakeTime);
  const from = stamp(windowFrom);
  const to = stamp(windowTo);
  if (![mix, bake, from, to].every(Number.isFinite)
    || mix >= bake || from >= to || to >= bake) return unavailable;

  const marker = Math.max(0, Math.min(1, (mix - from) / (to - from)));
  if (mix < from) return {status: 'early', marker, offsetMinutes: (mix - from) / 60000};
  if (mix > to) return {status: 'late', marker, offsetMinutes: (mix - to) / 60000};
  return {status: 'within', marker, offsetMinutes: 0};
}
