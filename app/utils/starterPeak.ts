// ── Unified starter-peak model ───────────────────────────────────────────────
// SINGLE source of truth for "when does a starter peak after a feed at feedMs?"
// A feed placed before its reference peak (yeast not fully matured) stretches its
// own time-to-peak; a feed at/after the reference peak does not. Both the SCORING
// peak (candidate generation) and the DISPLAY peak (chart bell `bellPeakTime` +
// card "Peak around…"/PEAK row) call this with the SAME reference peak, so
// scoring ≡ bell ≡ card by construction and the green pill can never fire while
// the bell still peaks hours after mix (the "false green" class).
// Shared by the solver (SchedulePicker) and a recorded feed's shift (bakeExecution).

// Pre-mix stretch factor: when pre-mix feed happens BEFORE refresh peak,
// starter yeast population isn't fully matured → pre-mix peak takes longer.
// 0h early = 1.0 (sweet spot), 1h early = 1.1, 2h early = 1.2 (max).
// At-or-after refresh peak = 1.0 (no stretch).
export function computePreMixStretchFactor(preMixMs: number, refreshPeakMs: number | null): number {
  if (refreshPeakMs == null) return 1.0;
  const gapH = (preMixMs - refreshPeakMs) / 3600000;
  if (gapH >= 0) return 1.0;
  const hoursEarly = Math.min(2, Math.abs(gapH));
  return 1.0 + 0.1 * hoursEarly;
}

/** The rise stretch of the first feed after a rest: a starter fed `hSinceFeedH` hours ago (past
 * its peak, declining, depleted or long dormant in the fridge) starts from fewer active yeasts, so
 * that feed peaks later than a healthy one. One ladder for every path (round 6, B3): the planned
 * refresh, a depleted or revived starter's first feed, and the first feed of a plan that shows no
 * separate refresh. Values unchanged from the solver's former copies. */
export function restStretchFactor(hSinceFeedH: number, adjPeakH: number, troughH: number): number {
  if (hSinceFeedH <= adjPeakH) return 1.0;
  if (hSinceFeedH <= adjPeakH * 1.5) return 1.05;
  if (hSinceFeedH <= troughH) return 1.15;
  if (hSinceFeedH <= troughH * 1.5) return 1.25;
  if (hSinceFeedH <= troughH * 2.5) return 1.35;
  return 1.5;
}

// refPeakMs is the reference peak the feed is measured against — canonically
// `_starterRefeedTime ? refeed + adjPeakH : lastFed + adjPeakH` (bare adjPeakH),
// matching the bell's `_preMixStretchFactor` reference. adjPeakHEff is the
// temperature/ratio-adjusted peak hours for the ACTIVE ratio in this scope
// (Stage-1 `adjPeakH`, or the per-ratio `adjPeakH_r` inside evaluatePlanForRatio),
// so the same call is correct at every ratio.
// restStretch: the first feed after a rest (restStretchFactor) rises with that stretch when it is
// larger; 1 (the default) for a feed that follows a planned one.
export function computeStarterPeakMs(feedMs: number, refPeakMs: number | null, adjPeakHEff: number, restStretch = 1): number {
  return feedMs + adjPeakHEff * Math.max(computePreMixStretchFactor(feedMs, refPeakMs), restStretch) * 3600000;
}

/** The peak of a pre-mix feed done at newFeedMs instead of oldFeedMs (a recorded late or early
 * feed). The plan's peak (oldPeakMs) gives the rise: peak − feed = adjPeakH × stretch against the
 * previous feed's bare peak (refFeedMs + adjPeakH). adjPeakH is recovered from it, and the new
 * peak goes through computeStarterPeakMs with the same reference, so the moved card and bell
 * keep the model the solver scored with. Without a previous feed the rise is kept. */
export function preMixPeakAfterMovedFeed(oldFeedMs: number, oldPeakMs: number, newFeedMs: number, refFeedMs: number | null): number {
  return preMixPeakAfterMove(oldFeedMs, oldPeakMs, refFeedMs, newFeedMs, refFeedMs);
}

/** The bare rise (adjPeakH, hours) behind a planned pre-mix peak, measured against the feed before it. */
export function preMixRiseH(feedMs: number, peakMs: number, refFeedMs: number | null): number {
  const riseH = (peakMs - feedMs) / 3600000;
  if (!(riseH > 0) || refFeedMs == null) return riseH;
  let adjPeakH = riseH;
  for (let i = 0; i < 30; i++) adjPeakH = riseH / computePreMixStretchFactor(feedMs, refFeedMs + adjPeakH * 3600000);
  return adjPeakH;
}

/** The peak of a pre-mix feed when it, or the feed before it, happens at another time than planned
 * (a recorded late feed, or the pre-mix feed moved to free time). The planned feed and peak give the
 * rise (preMixRiseH); the new peak goes through computeStarterPeakMs against the new previous feed,
 * so card, bell and scoring stay on the one model. */
export function preMixPeakAfterMove(oldFeedMs: number, oldPeakMs: number, oldRefFeedMs: number | null, newFeedMs: number, newRefFeedMs: number | null): number {
  const riseMs = oldPeakMs - oldFeedMs;
  if (!(riseMs > 0) || oldRefFeedMs == null) return newFeedMs + riseMs;
  const adjPeakH = preMixRiseH(oldFeedMs, oldPeakMs, oldRefFeedMs);
  return computeStarterPeakMs(newFeedMs, newRefFeedMs == null ? null : newRefFeedMs + adjPeakH * 3600000, adjPeakH);
}

/** Whether a mix at mixMs uses a starter near its peak: the solver's green band (starterScore, room
 * temperature: adjPeakH × 0.15 clamped 1–3 h, half an hour more on the rising side). */
export function mixNearPeak(mixMs: number, peakMs: number, adjPeakH: number): boolean {
  const tol = Math.max(1, Math.min(3, adjPeakH * 0.15));
  const gapH = (mixMs - peakMs) / 3600000;
  return gapH < 0 ? -gapH <= tol + 0.5 : gapH <= tol;
}
