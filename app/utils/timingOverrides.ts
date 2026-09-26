/** Explicitly chosen action timestamps, in epoch milliseconds. Missing keys are automatic. */
export type TimingOverrides = { mix?: number; pref?: number; feed?: number; refresh?: number; prefLocked?: boolean };

/** Legacy automatic plans must not acquire manual pins merely by being restored. */
export function normalizeTimingOverrides(value: unknown): TimingOverrides {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const result: TimingOverrides = {};
  for (const key of ['mix', 'pref', 'feed', 'refresh'] as const) {
    const timestamp = source[key];
    if (typeof timestamp === 'number' && Number.isFinite(timestamp) && Math.abs(timestamp) <= 8.64e15) result[key] = timestamp;
  }
  if (source.prefLocked === true && result.pref !== undefined) result.prefLocked = true;
  return result;
}
