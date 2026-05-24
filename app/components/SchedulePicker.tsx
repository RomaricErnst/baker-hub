'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type AvailabilityBlock, type ScheduleResult, hoursLabel } from '../utils';
import FermentChart, { getPrefOptH, getPrefPeakH_RT, getPrefRTWarmupH, getStarterTroughH, getStarterFridgeWarmupH } from './FermentChart';

interface SchedulePickerProps {
  startTime: Date;
  eatTime: Date | null;
  blocks: AvailabilityBlock[];
  preheatMin: number;
  styleKey: string;
  kitchenTemp: number;
  schedule?: ScheduleResult | null;
  onChange: (startTime: Date, eatTime: Date, blocks: AvailabilityBlock[]) => void;
  bakeType?: 'pizza' | 'bread';
  isSourdough?: boolean;
  onFeedTimeChange?: (t: Date) => void;
  prefermentType?: string;
  onPrefOffsetChange?: (h: number) => void;
  onPrefGoesInFridgeChange?: (inFridge: boolean) => void;
  onFridgeOutTimeChange?: (t: Date | null) => void;
  onUsingPeak2Change?: (v: boolean) => void;
  onFeed2TimeChange?: (t: Date | null) => void;
  onStarterStateChange?: (s: StarterState) => void;
  starterLocation?: 'rt' | 'fridge';
  planningMode?: 'last_fed' | 'know_peak';
  lastFedTime?: Date | null;
  knownPeakTime?: Date | null;
  onStarterLocationChange?: (loc: 'rt' | 'fridge') => void;
  onPlanningModeChange?: (mode: 'last_fed' | 'know_peak') => void;
  onLastFedTimeChange?: (t: Date | null) => void;
  onKnownPeakTimeChange?: (t: Date | null) => void;
  hasNotFedYet?: boolean | null;
  onHasNotFedYetChange?: (v: boolean | null) => void;
  lastFedAge?: 'today' | 'yesterday' | 'days23' | 'days45' | 'week' | null;
  onLastFedAgeChange?: (age: 'today' | 'yesterday' | 'days23' | 'days45' | 'week' | null) => void;
  feedRatio?: 1 | 2 | 4 | 5 | 10;
  onFeedRatioChange?: (r: 1 | 2 | 4 | 5 | 10) => void;
  onStarterPeakTimeChange?: (t: Date | null) => void;
  mode?: 'simple' | 'custom';   // default 'custom'
  onReady?: () => void;
  sessionRestored?: boolean;
  fridgeTemp?: number;
  flourStrength?: number;
  startTimeInPast?: boolean;
}

type PickerPhase = 'bake_time' | 'start_confirm';
type Scenario = 'plenty' | 'tight' | 'too_short';
type StarterState = 'rt_fed' | 'fridge_unfed' | 'fridge_fed';

// ── Card date+time formatter ─────────────────
// "Fri 28 Mar · 9pm" / "ven. 28 mars · 21h"
function fmtCardHM(d: Date, isFr = false): string {
  // Always display in 15min increments
  const rounded = new Date(d);
  const raw = rounded.getMinutes();
  const snap = Math.round(raw / 15) * 15;
  if (snap === 60) { rounded.setHours(rounded.getHours() + 1); rounded.setMinutes(0); }
  else rounded.setMinutes(snap);
  const h = rounded.getHours(), m = rounded.getMinutes();
  if (isFr) return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}
function fmtCardDT(d: Date, isFr = false): string {
  const loc = isFr ? 'fr-FR' : 'en-US';
  const wd = d.toLocaleDateString(loc, { weekday: 'short' });
  const mo = d.toLocaleDateString(loc, { month: 'short' });
  return `${wd} ${d.getDate()} ${mo} · ${fmtCardHM(d, isFr)}`;
}

// ── Time formatter ────────────────────────────
// "4pm" / "4:30pm" — minutes omitted when zero
function formatTimeShort(d: Date, isFr = false): string {
  const rounded = new Date(d);
  const raw = rounded.getMinutes();
  const snap = Math.round(raw / 15) * 15;
  if (snap === 60) { rounded.setHours(rounded.getHours() + 1); rounded.setMinutes(0); }
  else rounded.setMinutes(snap);
  const h = rounded.getHours();
  const m = rounded.getMinutes();
  if (isFr) return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

// ── Day+time formatter ────────────────────────
// "Sat 25 Mar at 4pm" / "tonight at 9pm" / "tomorrow at 9am"
function formatDayShort(d: Date, isFr = false): string {
  const now = new Date();
  const todayStart    = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);
  const dStart = new Date(d); dStart.setHours(0, 0, 0, 0);

  const timeStr = formatTimeShort(d, isFr);
  if (dStart.getTime() === todayStart.getTime())    return `tonight at ${timeStr}`;
  if (dStart.getTime() === tomorrowStart.getTime()) return `tomorrow at ${timeStr}`;
  const loc = isFr ? 'fr-FR' : 'en-US';
  const weekday = d.toLocaleDateString(loc, { weekday: 'short' });
  const month   = d.toLocaleDateString(loc, { month: 'short' });
  return `${weekday} ${d.getDate()} ${month} at ${timeStr}`;
}

// ── Slider display formatter ──────────────────
// "Thu 26 Mar · 6pm"
function formatSliderDisplay(d: Date, isFr = false): string {
  const loc = isFr ? 'fr-FR' : 'en-US';
  const wd = d.toLocaleDateString(loc, { weekday: 'short' });
  const mo = d.toLocaleDateString(loc, { month: 'short' });
  return `${wd} ${d.getDate()} ${mo} · ${formatTimeShort(d, isFr)}`;
}

// ── Hour-rounded formatters ───────────────────
function roundToNearestHour(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() >= 30) r.setHours(r.getHours() + 1);
  r.setMinutes(0, 0, 0);
  return pushToReasonableHour(r);
}

// Rounds to nearest hour then formats — used for suggestion messages
function formatDayHour(d: Date): string {
  return formatDayShort(roundToNearestHour(d));
}

// ── Hour select label ─────────────────────────
// "12am", "1am", ..., "11am", "12pm", "1pm", ..., "11pm" (EN) / "0h", "1h", ..., "23h" (FR)
function hourLabel(h: number, isFr = false): string {
  if (isFr) return `${h}h`;
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// ── Per-style optimal fermentation defaults ───
// coldH values aligned with utils.ts buildSchedule (source of truth)
// preferredColdH = longer cold option when window allows
// minColdH = minimum cold retard that's actually beneficial for this style
// rtH = minimum RT hours needed at the end
const STYLE_FERM_DEFAULTS: Record<string, {
  coldH: number; rtH: number;
  preferredColdH?: number; minColdH?: number;
  minTotalFermH: number; coldHRequired?: boolean;
}> = {
  // Pizza — sweet spot = coldH + rtH. RT durations are minimums; climate adjusts yeast not timing.
  // preferredColdH = max useful cold before diminishing returns
  // minColdH = minimum cold retard for acceptable results
  // minTotalFermH = absolute minimum total fermentation
  neapolitan:    { coldH: 24, rtH: 2, preferredColdH: 48, minColdH: 12, minTotalFermH: 8  },
  newyork:       { coldH: 24, rtH: 2, preferredColdH: 48, minColdH: 12, minTotalFermH: 8  },
  pizza_romana:  { coldH: 24, rtH: 2, preferredColdH: 48, minColdH: 12, minTotalFermH: 6  },
  roman:         { coldH: 0,  rtH: 6, minColdH: 0,        minTotalFermH: 4  },
  pan:           { coldH: 0,  rtH: 5, minColdH: 0,        minTotalFermH: 3  },
  sourdough:     { coldH: 24, rtH: 4, preferredColdH: 48, minColdH: 12, minTotalFermH: 12 },
  // Bread
  pain_campagne: { coldH: 18, rtH: 3, preferredColdH: 24, minColdH: 8,  minTotalFermH: 10 },
  pain_levain:   { coldH: 16, rtH: 4, preferredColdH: 24, minColdH: 8,  minTotalFermH: 12 },
  baguette:      { coldH: 12, rtH: 2, preferredColdH: 16, minColdH: 6,  minTotalFermH: 8  },
  pain_complet:  { coldH: 12, rtH: 3, preferredColdH: 18, minColdH: 6,  minTotalFermH: 8  },
  pain_seigle:   { coldH: 0,  rtH: 5, minColdH: 0,        minTotalFermH: 4  },
  fougasse:      { coldH: 8,  rtH: 2, preferredColdH: 12, minColdH: 4,  minTotalFermH: 6  },
  brioche:       { coldH: 8,  rtH: 2, preferredColdH: 12, minColdH: 4,  minTotalFermH: 4,  coldHRequired: true },
  pain_mie:      { coldH: 8,  rtH: 2, preferredColdH: 12, minColdH: 4,  minTotalFermH: 4,  coldHRequired: true },
  pain_viennois: { coldH: 6,  rtH: 2, preferredColdH: 8,  minColdH: 3,  minTotalFermH: 4,  coldHRequired: true },
};
const FERM_FALLBACK: { coldH: number; rtH: number; minColdH?: number; minTotalFermH: number } = { coldH: 0, rtH: 4, minColdH: 0, minTotalFermH: 4 };

// ── Reasonable hours constraint ───────────────
// Never suggest a start between 00:00 and 07:00 — push to 07:00 that morning.
function pushToReasonableHour(d: Date): Date {
  const h = d.getHours();
  if (h >= 0 && h < 7) {
    const pushed = new Date(d);
    pushed.setHours(7, 0, 0, 0);
    return pushed;
  }
  if (h >= 23) {
    // Push to 7am next day
    const pushed = new Date(d);
    pushed.setDate(pushed.getDate() + 1);
    pushed.setHours(7, 0, 0, 0);
    return pushed;
  }
  return d;
}

// ── Starter peak hours ────────────────────────
function starterPeakHours(temp: number, mature: boolean): { min: number; max: number; mid: number } {
  let base: { min: number; max: number };
  if (temp >= 30)      base = { min: 3, max: 5 };
  else if (temp >= 27) base = { min: 4, max: 6 };
  else if (temp >= 24) base = { min: 5, max: 8 };
  else if (temp >= 21) base = { min: 7, max: 10 };
  else                 base = { min: 9, max: 14 };
  const adj = mature ? 0 : 1.5;
  return { min: base.min + adj, max: base.max + adj, mid: (base.min + base.max) / 2 + adj };
}

// ── Blocker overlap resolver ──────────────────
// If start falls inside any active block, push it forward to the end of that block.
// Repeats until no more overlaps (handles chained blocks).
// Returns the resolved start and an optional inline note for the UI.
function applyBlockerOverlap(
  start: Date,
  activeBlocks: AvailabilityBlock[],
): { resolvedStart: Date; moved: boolean; resolvedDate: Date } {
  let resolved = new Date(start);
  let moved = false;
  let safety = 0;
  let changed = true;
  while (changed && safety++ < 20) {
    changed = false;
    for (const b of activeBlocks) {
      if (resolved >= b.from && resolved < b.to) {
        resolved = new Date(b.to);
        moved = true;
        changed = true;
        break;
      }
    }
  }
  return {
    resolvedStart: moved ? resolved : start,
    moved,
    resolvedDate: resolved,
  };
}

// ── Start suggestion engine ───────────────────
// Default suggestion = NOW (rounded to nearest hour).
// Only suggest a later start when baker has more time than the preferred
// fermentation window — in that case, push start to eatTime − (targetFermH + preheatH)
// so the full fermentation window is used.
// Returns a ±2h range around the suggestion; never suggests midnight–7am.
function computeSuggestion(
  eatTime: Date,
  preheatMin: number,
  styleKey: string,
  kitchenTemp: number,
) {
  const now = new Date();
  const preheatH = preheatMin / 60;
  const totalAvailableH = (eatTime.getTime() - now.getTime()) / 3600000;
  const minFeasibleH = 2 + preheatH;

  const defaults = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;

  let tropicalFactor = 1;
  if (kitchenTemp >= 33) tropicalFactor = 1.25;
  else if (kitchenTemp >= 30) tropicalFactor = 1.15;

  const rtH_adjusted  = defaults.rtH / tropicalFactor;
  const standardFermH = defaults.coldH + rtH_adjusted;
  const preferredColdH = defaults.preferredColdH ?? null;
  const preferredFermH = preferredColdH !== null ? preferredColdH + rtH_adjusted : null;

  // Scenario: too_short → can't make it; tight → just enough for standard; plenty → extra time
  let scenario: Scenario;
  if (totalAvailableH < minFeasibleH) {
    scenario = 'too_short';
  } else if (totalAvailableH < standardFermH + preheatH + 1) {
    scenario = 'tight';
  } else {
    scenario = 'plenty';
  }

  // Suggested start:
  //   too_short / tight → NOW (start ASAP)
  //   plenty → push to eatTime − (targetFermH + preheatH) so window is fully used,
  //            but never earlier than NOW
  let suggestedStart: Date;
  let isPreferredMode = false;

  if (scenario !== 'plenty') {
    suggestedStart = pushToReasonableHour(roundToNearestHour(now));
  } else {
    const canUsePreferred = preferredFermH !== null
      && totalAvailableH >= preferredFermH + preheatH;
    const targetFermH = canUsePreferred ? preferredFermH! : standardFermH;
    isPreferredMode = canUsePreferred;

    const rawStart = new Date(eatTime.getTime() - (targetFermH + preheatH) * 3600000);
    suggestedStart = rawStart > now
      ? pushToReasonableHour(roundToNearestHour(rawStart))
      : pushToReasonableHour(roundToNearestHour(now));
  }

  // ±4h range — early end respects reasonable-hour rule; late end is unconstrained
  const rangeEarly  = pushToReasonableHour(new Date(suggestedStart.getTime() - 4 * 3600000));
  const rangeLatest = new Date(suggestedStart.getTime() + 4 * 3600000);

  return {
    scenario,
    suggestedStart,
    rangeEarly,
    rangeLatest,
    isPreferredMode,
    preferredColdH: preferredColdH ?? 0,
    standardColdH: defaults.coldH,
  };
}

// ── Workday helper ────────────────────────────
function getWorkdaysInWindow(
  start: Date,
  end: Date,
): Array<{ key: string; label: string; blockStart: Date; blockEnd: Date }> {
  if (end <= start) return [];

  const days: Array<{ key: string; label: string; blockStart: Date; blockEnd: Date }> = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14; i++) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      const blockStart = new Date(cursor); blockStart.setHours(9, 0, 0, 0);
      const blockEnd   = new Date(cursor); blockEnd.setHours(18, 0, 0, 0);
      if (blockStart < end && blockEnd > start) {
        const key = cursor.toISOString().slice(0, 10);
        const dateLabel = cursor.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        days.push({ key, label: `Work · ${dateLabel}`, blockStart, blockEnd });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// ── Night window helper ───────────────────────
function getNightsInWindow(
  start: Date,
  end: Date,
): Array<{ key: string; label: string; blockStart: Date; blockEnd: Date }> {
  if (end <= start) return [];

  const nights: Array<{ key: string; label: string; blockStart: Date; blockEnd: Date }> = [];
  // Start one day before windowStart to catch nights that began before midnight
  // e.g. at 1am, tonight's 10pm start was yesterday — cursor must go back one day
  const cursor = new Date(start); cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 14 && nights.length < 7; i++) {
    const nightStart = new Date(cursor); nightStart.setHours(22, 0, 0, 0);
    const nightEnd   = new Date(cursor); nightEnd.setDate(nightEnd.getDate() + 1); nightEnd.setHours(7, 0, 0, 0);

    if (nightStart < end && nightEnd > start) {
      const weekday = nightStart.toLocaleDateString('en-US', { weekday: 'long' });
      const key = nightStart.toISOString().slice(0, 10);
      nights.push({ key, label: `${weekday} night`, blockStart: nightStart, blockEnd: nightEnd });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return nights;
}

// ── Shared styles ─────────────────────────────
const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '.65rem .85rem',
  border: '2px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--warm)',
  color: 'var(--char)',
  fontSize: '.85rem',
  fontFamily: 'var(--font-dm-mono)',
  outline: 'none',
  cursor: 'pointer',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '.72rem',
  color: 'var(--smoke)',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: '.35rem',
  fontFamily: 'var(--font-dm-mono)',
};

// ── Sourdough card helper styles ──────────────
const STARTER_LABEL_STYLE: React.CSSProperties = {
  fontSize: '.72rem',
  fontFamily: 'var(--font-dm-mono)',
  color: 'var(--smoke)',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  marginBottom: '.5rem',
};
const STARTER_SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-dm-mono)',
  fontSize: '.85rem',
  padding: '.4rem .6rem',
  borderRadius: '8px',
  border: '1.5px solid var(--border)',
  background: 'var(--cream)',
  color: 'var(--char)',
  flex: 1,
};
function starterPillButton(active: boolean): React.CSSProperties {
  return {
    padding: '.35rem .7rem',
    borderRadius: '20px',
    border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
    background: active ? '#FEF4EF' : 'transparent',
    color: active ? 'var(--terra)' : 'var(--smoke)',
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '.8rem',
    cursor: 'pointer',
  };
}

// ── Snap to the edge of the blocker nearest to sweet spot center ──
function snapToBlockerEdgeIfBlocked(
  hbf: number,
  activeBlocks: AvailabilityBlock[],
  et: Date,
  sweetCenter: number,
): number {
  const ms = et.getTime();
  for (const b of activeBlocks) {
    const bFrom = (ms - b.to.getTime())   / 3600000; // HBF closer to bake
    const bTo   = (ms - b.from.getTime()) / 3600000; // HBF further from bake
    if (hbf > bFrom && hbf < bTo) {
      const distFrom = Math.abs(bFrom - sweetCenter);
      const distTo   = Math.abs(bTo   - sweetCenter);
      return distFrom <= distTo ? bFrom : bTo;
    }
  }
  return hbf;
}

// ── Joint mix+pref optimiser ──────────────────
function findOptimalPosition(
  sweetCenter: number,
  sweetFrom: number,
  sweetTo: number,
  activeBlocks: AvailabilityBlock[],
  et: Date,
  hasPref: boolean,
  prefOffsetH: number,
  kitchenTemp: number,
  nowHBF: number = 999,
  prefermentType: string = 'poolish',
  prefMinH: number = 3,
  minTotalRT: number = 3,
  prefRTWarmupH: number = 0,
  prefGoesInFridge: boolean = false,
  fridgeTemp: number = 6,
  styleKey: string = 'neapolitan',
): {
  mixHBF: number;
  prefHBF: number;
  mixInZone: boolean;
  prefInZone: boolean;
  fallback: boolean;
  mixInBlocker: boolean;
  prefInBlocker: boolean;
  score: number;
} {
  const ms = et.getTime();
  function isInBlocker(hbf: number): boolean {
    return activeBlocks.some(b => {
      const s = (ms - b.from.getTime()) / 3600000;
      const e = (ms - b.to.getTime())   / 3600000;
      return hbf > Math.min(s, e) && hbf < Math.max(s, e);
    });
  }
  function inSweet(hbf: number): boolean {
    return hbf >= sweetTo && hbf <= sweetFrom;
  }
  const STEP = 0.25;
  // Search range must reach from sweetCenter down to minTotalRT
  // so valid positions just below sweetTo are not missed when blocker
  // fills the entire sweet zone
  const SEARCH_RANGE = Math.max(
    (sweetFrom - sweetTo) / 2 + 2,
    sweetCenter - minTotalRT + 1
  );
  const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
  let bestScore = -1;
  let bestCombinedScore = -1;
  let bestResult: ReturnType<typeof findOptimalPosition> | null = null;
  for (let delta = 0; delta <= SEARCH_RANGE; delta += STEP) {
    for (const sign of [0, 1, -1]) {
      const candidate = sweetCenter + (sign * delta);
      if (candidate < minTotalRT || candidate > sweetFrom + 2) continue;
      const mixClear = !isInBlocker(candidate);
      if (!mixClear) continue;
      const bulkEndHBF = candidate - typicalBulkH;
      // Allow bulk to start up to 30min before a blocker begins —
      // baker can start bulk then refrigerate when they leave.
      const bulkBlockedDeep = isInBlocker(bulkEndHBF) && activeBlocks.every(b => {
        const s = (et.getTime() - b.from.getTime()) / 3600000;
        const e2 = (et.getTime() - b.to.getTime()) / 3600000;
        const lo = Math.min(s, e2); const hi = Math.max(s, e2);
        return !(bulkEndHBF > lo && bulkEndHBF < hi) || (bulkEndHBF - lo < 0.5);
      });
      const bulkClear = bulkEndHBF > 0 && (!isInBlocker(bulkEndHBF) || !bulkBlockedDeep);
      if (!bulkClear) continue;
      // Poolish fridge: ensure at least 30min warmup before mix is available.
      // Full warmup (prefRTWarmupH) is ideal but not a hard requirement —
      // 30min minimum is scientifically sufficient for yeast to resume activity.
      if (hasPref && prefermentType === 'poolish' && prefGoesInFridge && prefRTWarmupH > 0) {
        const MIN_WARMUP_H = 0.5;
        const removeHBF = candidate + prefRTWarmupH;
        if (isInBlocker(removeHBF)) {
          // Full warmup slot blocked — find the latest unblocked slot >= 30min before mix
          const fallbackRemove = candidate + MIN_WARMUP_H;
          if (isInBlocker(fallbackRemove)) continue; // even 30min warmup impossible — skip
        }
      }
      if (!hasPref) {
        // No preferment — score mix position only
        const score = inSweet(candidate) ? 3 : 0;
        if (score === 3) {
          return {
            mixHBF: candidate, prefHBF: candidate,
            mixInZone: true, prefInZone: true,
            fallback: false, mixInBlocker: false, prefInBlocker: false,
            score: 3,
          };
        }
        // Keep as best if better than anything seen
        if (score > bestScore) {
          bestScore = score;
          bestResult = {
            mixHBF: candidate, prefHBF: candidate,
            mixInZone: inSweet(candidate), prefInZone: true,
            fallback: !inSweet(candidate), mixInBlocker: false, prefInBlocker: false,
            score,
          };
        }
        continue;
      }

      // ── Preferment placement for this mix candidate ──────────────────
      const prefZoneMax = prefermentType === 'biga' ? 72 : prefGoesInFridge ? 24 : prefOffsetH * 1.5;
      const prefZoneMin = prefermentType === 'biga' ? 12 : prefGoesInFridge ? 3 : 1;
      // Use scientific optimum, not current drag position.
      // prefOffsetH is UI state — using it as search target causes
      // different results on first load vs after drag+reset.
      const prefOptH = getPrefOptH(
        prefermentType, kitchenTemp, prefGoesInFridge, styleKey, fridgeTemp
      );
      // Fridge poolish/biga needs 0.25h buffer for warmup slot.
      // RT poolish needs no buffer — used directly at mix time.
      const fridgeBuffer = prefGoesInFridge ? 0.25 : 0;
      const hardMax = Math.min(prefZoneMax, nowHBF - candidate - fridgeBuffer);
      let bestPrefOffset = 0;

      // Scan outward from optH in both directions, prefer closer positions
      for (let delta = 0; delta <= prefZoneMax; delta += STEP) {
        for (const dir of [0, 1, -1]) {
          const p = prefOptH + dir * delta;
          if (p < prefZoneMin || p > hardMax) continue;
          if (!isInBlocker(candidate + p)) {
            bestPrefOffset = p;
            break;
          }
        }
        if (bestPrefOffset >= prefZoneMin) break;
      }

      if (bestPrefOffset < prefZoneMin) continue; // no valid pref position for this mix candidate

      // If we landed further back than optimal, try to find the most recent valid position
      if (bestPrefOffset > prefOptH) {
        for (let p = prefOptH; p <= bestPrefOffset; p += STEP) {
          if (p >= prefZoneMin && p <= hardMax && !isInBlocker(candidate + p)) {
            bestPrefOffset = p;
            break;
          }
        }
      }

      // Score plateau constants — declared here so they're in scope for both
      // the comfort window guard and the scoring block below.
      const fridgePlateauH  = prefermentType === 'biga' ? 10 : prefGoesInFridge ? 3 : 0;
      const scorePlateauH   = fridgePlateauH; // upper bound (over-fermented side)
      const scorePlateauH_LOW = prefGoesInFridge && prefermentType === 'poolish' ? 5 : fridgePlateauH; // lower bound (wider — underdeveloped is safer)
      const scoreRTPeakTol  = kitchenTemp >= 30 ? 0.5
                            : kitchenTemp >= 28 ? 0.75
                            : kitchenTemp >= 24 ? 1.0
                            : 1.5;
      const scoreRTPeakTolUpper = kitchenTemp >= 30 ? 0.75
                                : kitchenTemp >= 28 ? 1.0
                                : kitchenTemp >= 24 ? 1.5
                                : 2.0;

      // Comfort window: if fridge poolish start lands outside 18:00–21:00,
      // scan for the EARLIEST slot whose clock time falls in 18:00–21:00.
      // If no such slot exists, keep the original bestPrefOffset.
      if (prefermentType === 'poolish' && prefGoesInFridge) {
        const prefAbsMs = ms - (candidate + bestPrefOffset) * 3600000;
        const prefHour = new Date(prefAbsMs).getHours();
        if (prefHour < 18 || prefHour >= 21) {
          let comfortOffset: number | null = null;
          for (let p = prefZoneMin; p <= hardMax; p += STEP) {
            if (isInBlocker(candidate + p)) continue;
            const absMs = ms - (candidate + p) * 3600000;
            const h = new Date(absMs).getHours();
            if (h >= 18 && h < 21) {
              comfortOffset = p;
              break;
            }
          }
          if (comfortOffset !== null) {
            // Only apply comfort if the poolish stays in the green zone.
            // Comfort is a preference, not a reason to leave green zone.
            const comfortInZone = comfortOffset >= prefOptH - scorePlateauH_LOW
                                && comfortOffset <= prefOptH + scorePlateauH;
            if (comfortInZone) bestPrefOffset = comfortOffset;
          }
        }
      }
      const prefInZone = prefGoesInFridge
        ? bestPrefOffset >= prefOptH - scorePlateauH_LOW && bestPrefOffset <= prefOptH + scorePlateauH
        : bestPrefOffset >= prefOptH - scoreRTPeakTol && bestPrefOffset <= prefOptH + scoreRTPeakTolUpper;
      // Pref yellow = developing but viable (below green floor, above minimum)
      const prefYellow = !prefInZone && (
        prefGoesInFridge
          ? bestPrefOffset >= prefZoneMin && bestPrefOffset < prefOptH - scorePlateauH_LOW
          : bestPrefOffset >= 1 && bestPrefOffset < prefOptH - scoreRTPeakTol
      );
      const mixInZone = inSweet(candidate);
      const score = (mixInZone ? 2 : 0) + (prefInZone ? 2 : prefYellow ? 1 : 0);
      // score 4 = both green, score 3 = mix green + pref yellow,
      // score 2 = mix green only, score 1 = pref yellow only, score 0 = neither

      const mixHour = new Date(ms - candidate * 3600000).getHours();
      const prefHour = new Date(ms - (candidate + bestPrefOffset) * 3600000).getHours();
      const doughReasonable = mixHour >= 7 && mixHour <= 22 ? 1 : 0;
      const poolishComfort = Math.max(0, 8 - Math.abs(prefHour - 19));
      // Prefer longer cold retard — scientifically better flavour development.
      // Uses params already in scope: sweetFrom (max useful window), minTotalRT (RT floor).
      // Candidate further from bake = more cold retard time = better result.
      const hasColdRetardLocal = sweetCenter > minTotalRT + 2;
      const retardBonus = hasColdRetardLocal
        ? Math.min(8, Math.round(
            Math.min(candidate - minTotalRT, sweetFrom - minTotalRT) /
            Math.max(1, sweetFrom - minTotalRT) * 8
          ))
        : 0;
      // Priority: score → fridge poolish → cold retard → reasonable hour → poolish convenience
      const fridgeBonus = (prefGoesInFridge && hasPref) ? 8 : 0;
      // Reduce retard weight when preferment is still developing (not at peak).
      // Scientifically: preferment at peak > marginal extra cold retard hours
      // in the diminishing-returns zone (13h+). Applies to poolish RT, poolish
      // fridge, and biga equally.
      const prefScoreComponent = prefInZone ? 2 : prefYellow ? 1 : 0;
      const retardWeight = prefScoreComponent >= 2 ? 8 : 3;
      const combinedScore = score * 100 + fridgeBonus * 10 + retardBonus * retardWeight + doughReasonable * 5 + poolishComfort;

      if (combinedScore > bestCombinedScore) {
        bestScore = score;
        bestCombinedScore = combinedScore;
        bestResult = {
          mixHBF: candidate, prefHBF: candidate + bestPrefOffset,
          mixInZone,
          prefInZone: prefInZone || prefYellow,
          fallback: !mixInZone, mixInBlocker: false, prefInBlocker: false,
          score,
        };
      }
    }
  }

  // Return best partial result found (if any)
  if (bestResult) return bestResult;
  const fallbackPrefOffset = Math.min(prefOffsetH, nowHBF - sweetCenter - 0.25);
  return {
    mixHBF:        sweetCenter,
    prefHBF:       sweetCenter + Math.max(0, fallbackPrefOffset),
    mixInZone:     false,
    prefInZone:    false,
    fallback:      true,
    mixInBlocker:  isInBlocker(sweetCenter),
    prefInBlocker: hasPref && isInBlocker(sweetCenter + Math.max(0, fallbackPrefOffset)),
    score:         0,
  };
}

// ── Simple colour bar (Simple mode only) ──────
const BAR_PAD = 14;
const BAR_SVG_H = 80;
const BAR_Y = 36;
const BAR_H = 18;
const BAR_AXIS_Y = 60;
const BAR_DS = 13; // diamond half-size

function barHToX(hbf: number, W: number, barWin: number): number {
  return BAR_PAD + (1 - Math.max(0, Math.min(barWin, hbf)) / barWin) * (W - BAR_PAD * 2);
}
function barXToHBF(x: number, W: number, barWin: number): number {
  return Math.max(0.5, Math.min(barWin - 0.5, (1 - (x - BAR_PAD) / (W - BAR_PAD * 2)) * barWin));
}

function SimpleColourBar({
  eatTime, pendingStart, blocks, onStartChange, hasColdRetard, kitchenTemp, sweetFrom, sweetTo, yellowTo, nowHBF,
}: {
  eatTime: Date;
  pendingStart: Date;
  blocks: AvailabilityBlock[];
  onStartChange: (d: Date) => void;
  hasColdRetard?: boolean;
  kitchenTemp: number;
  sweetFrom?: number;
  sweetTo?: number;
  yellowTo?: number;
  nowHBF?: number;
}) {
  const tRoot = useTranslations();
  const locale = useLocale();
  const isFr = locale === 'fr';
  const _barWindowH = nowHBF ?? 0;
  // Scale window to the sweet zone: show ~2× sweetFrom so baker sees
  // equal context either side of the green zone.
  // sweetFrom is the left (early/furthest) edge of the green zone in HBF.
  const sweetLeft = sweetFrom ?? (_barWindowH > 0 ? _barWindowH : (hasColdRetard ? 48 : 12));
  const rawBarWin = Math.min(72, Math.max(Math.round(sweetLeft * 2), 12));
  // Clip left edge: never show more than 1h of past
  const _earlyMixOffH = (eatTime.getTime() - pendingStart.getTime()) / 3600000;
  const barWin = _barWindowH > 0
    ? Math.min(rawBarWin, Math.max(_earlyMixOffH + 4, _barWindowH + 1))
    : rawBarWin;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const lastHBFRef   = useRef<number>(0);
  const [W, setW]    = useState(320);
  const [dragging, setDragging] = useState(false);
  // Local drag HBF for free visual movement — no applyBlockerOverlap during drag
  const [localHBF, setLocalHBF] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bakeMs     = eatTime.getTime();
  const mixOffsetH = (bakeMs - pendingStart.getTime()) / 3600000;
  // During drag: show diamond at raw drag position (no blocker snap/push)
  const effectiveMixHBF = localHBF !== null ? localHBF : mixOffsetH;
  const diamondX   = barHToX(Math.max(0.5, Math.min(barWin - 0.5, effectiveMixHBF)), W, barWin);
  const barCY      = BAR_Y + BAR_H / 2; // diamond center y

  // Zone boundaries — driven by style+timing aware sweet zone props
  const _nowHBFBar = nowHBF ?? barWin;
  // Green zone left = min(now, max useful start from prop)
  // Green zone right = minTotalFerm boundary from prop
  const sweetL_HBF = sweetFrom ?? _nowHBFBar;
  const sweetR_HBF = sweetTo   ?? 8;
  // Yellow: left = nowHBF (nothing left of now), right = sweetR - 2h
  const goldL_HBF  = _nowHBFBar;
  const goldR2_HBF = yellowTo ?? Math.max(0.5, sweetR_HBF - 2);

  // Early tolerance: cold retard styles are more forgiving on the early side
  // because extra time = more cold retard (slow). RT-only styles are tighter
  // because extra time = active room-temp fermentation (fast).
  const greenWidth = sweetL_HBF - sweetR_HBF;
  const earlyToleranceH = hasColdRetard
    ? Math.max(4, greenWidth * 0.4)
    : Math.max(1, greenWidth * 0.3);
  const tooEarlyHBF = Math.min(goldL_HBF, sweetL_HBF + earlyToleranceH);

  // Colour zones: 6 symmetrical zones
  // LEFT: past(grey) · too early(terra) · early ok(gold) | GREEN | late ok(gold) · too late(terra) :RIGHT
  const zones = [
    { from: barWin,      to: goldL_HBF,   fill: 'rgba(120,115,110,0.45)', label: '' },
    { from: goldL_HBF,   to: tooEarlyHBF, fill: 'rgba(196,82,42,0.25)',   label: tRoot('schedulePicker.zoneLabels.tooEarly') },
    { from: tooEarlyHBF, to: sweetL_HBF,  fill: 'rgba(212,168,83,0.35)', label: tRoot('schedulePicker.zoneLabels.stillOk')  },
    { from: sweetL_HBF,  to: sweetR_HBF,  fill: 'rgba(107,122,90,0.5)',  label: tRoot('schedulePicker.zoneLabels.startDough') },
    { from: sweetR_HBF,  to: goldR2_HBF,  fill: 'rgba(212,168,83,0.35)', label: tRoot('schedulePicker.zoneLabels.stillOk')  },
    { from: goldR2_HBF,  to: 0,           fill: 'rgba(196,82,42,0.25)',  label: tRoot('schedulePicker.zoneLabels.tooLate')  },
  ];

  // Adaptive ticks: 3h for short windows, 12h for medium, 24h for long
  const tickIntervalH = barWin <= 18 ? 3 : barWin <= 72 ? 12 : 24;
  const ticks: { x: number; label: string }[] = [];
  for (let h = tickIntervalH; h < barWin; h += tickIntervalH) {
    const tick = new Date(bakeMs - h * 3600000);
    if (tick.getMinutes() !== 0) continue;
    const hr = tick.getHours();
    const wd = tick.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' });
    const timeLabel = hr === 0  ? tRoot('schedulePicker.tickLabels.midnight')
      : hr === 6  ? tRoot('schedulePicker.tickLabels.6am')
      : hr === 12 ? tRoot('schedulePicker.tickLabels.noon')
      : hr === 18 ? tRoot('schedulePicker.tickLabels.6pm')
      : isFr
      ? `${hr}h`
      : `${hr > 12 ? hr - 12 : hr}${hr < 12 ? 'am' : 'pm'}`;
    ticks.push({ x: barHToX(h, W, barWin), label: `${wd} ${timeLabel}` });
  }

  // Status – derived from 6-zone boundaries
  const inZone   = mixOffsetH >= sweetR_HBF && mixOffsetH <= sweetL_HBF;
  const earlyOk  = !inZone && mixOffsetH > sweetL_HBF && mixOffsetH <= tooEarlyHBF;
  const tooEarly = !inZone && mixOffsetH > tooEarlyHBF; // drag clamp prevents past
  const nearLate = !inZone && mixOffsetH < sweetR_HBF && mixOffsetH >= goldR2_HBF;
  const tooLate  = mixOffsetH < goldR2_HBF;
  const status   = inZone   ? tRoot('schedulePicker.simpleStatus.ready')
    : earlyOk    ? tRoot('schedulePicker.simpleStatus.earlyOk')
    : tooEarly   ? tRoot('schedulePicker.simpleStatus.tooEarly')
    : nearLate   ? tRoot('schedulePicker.simpleStatus.lateOk')
    : tRoot('schedulePicker.simpleStatus.tooLate');

  // Pointer handling
  function getSvgX(e: React.PointerEvent): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return e.clientX - rect.left;
  }
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault(); e.stopPropagation();
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    const rawHbf = Math.round(barXToHBF(getSvgX(e), W, barWin) * 4) / 4;
    const maxHBF = nowHBF ? Math.min(barWin - 0.5, nowHBF - 0.25) : barWin - 0.5;
    const hbf = Math.max(0.5, Math.min(maxHBF, rawHbf));
    lastHBFRef.current = hbf;
    // Update local visual only — no applyBlockerOverlap during drag (free movement)
    setLocalHBF(hbf);
  }
  function onPointerUp() {
    if (dragging) {
      onStartChange(new Date(bakeMs - lastHBFRef.current * 3600000));
    }
    setLocalHBF(null);
    setDragging(false);
  }

  // Formatters (locale-aware)
  function fmtHM(d: Date): string {
    const h = d.getHours(), m = d.getMinutes();
    if (isFr) return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
    const ap = h < 12 ? 'am' : 'pm';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
  }
  function fmtDT(d: Date): string {
    const wd = d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' });
    return `${wd} ${d.getDate()} · ${fmtHM(d)}`;
  }

  // Use visual (drag) position for blocker colouring during drag
  const inBlocker = blocks.some(b => {
    const bFromHBF = (bakeMs - b.to.getTime())   / 3600000;
    const bToHBF   = (bakeMs - b.from.getTime()) / 3600000;
    return effectiveMixHBF > bFromHBF && effectiveMixHBF < bToHBF;
  });
  const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
  const bulkEndHBF = effectiveMixHBF - typicalBulkH;
  const bulkEndInBlocker = !inBlocker && bulkEndHBF > 0 && blocks.some(b => {
    const bFromHBF = (bakeMs - b.to.getTime())   / 3600000;
    const bToHBF   = (bakeMs - b.from.getTime()) / 3600000;
    return bulkEndHBF > bFromHBF && bulkEndHBF < bToHBF;
  });
  const dFill   = inBlocker ? '#aaaaaa' : bulkEndInBlocker ? '#C4A030' : '#1A1612';
  const dStroke = inBlocker ? '#999999' : bulkEndInBlocker ? '#7A6010' : 'white';

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
      {/* Hint */}
      <div style={{ fontSize: '13px', color: 'var(--smoke)', textAlign: 'center', marginBottom: '8px' }}>
        {locale === 'fr'
          ? '← Glissez le losange pour ajuster vos horaires →'
          : '← Drag the diamond to set your start time →'}
      </div>
      <svg
        ref={svgRef}
        width={W} height={BAR_SVG_H}
        style={{ display: 'block', touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          {/* Clip to bar track shape */}
          <clipPath id="simple-bar-clip">
            <rect x={BAR_PAD} y={BAR_Y} width={W - BAR_PAD * 2} height={BAR_H} rx={9} />
          </clipPath>
          {/* Clip paths for blocker hatches */}
          {blocks.map((b, i) => {
            const hbfFrom = (bakeMs - b.from.getTime()) / 3600000;
            const hbfTo   = (bakeMs - b.to.getTime())   / 3600000;
            const bx1 = barHToX(hbfFrom, W, barWin);
            const bx2 = barHToX(hbfTo, W, barWin);
            return (
              <clipPath key={i} id={`sbc-${i}`}>
                <rect x={bx1} y={0} width={Math.max(0, bx2 - bx1)} height={BAR_SVG_H} />
              </clipPath>
            );
          })}
        </defs>

        {/* Background track */}
        <rect x={BAR_PAD} y={BAR_Y} width={W - BAR_PAD * 2} height={BAR_H} fill="#E8E0D5" rx={9} />

        {/* Colour zones (clipped to track) */}
        <g clipPath="url(#simple-bar-clip)">
          {zones.map((z, i) => {
            const zx1 = barHToX(z.from, W, barWin);
            const zx2 = barHToX(z.to, W, barWin);
            return <rect key={i} x={zx1} y={BAR_Y} width={zx2 - zx1} height={BAR_H} fill={z.fill} />;
          })}
        </g>

        {/* Zone labels above bar */}
        {(() => {
          const items = zones.map((z, i) => {
            const zx1 = barHToX(z.from, W, barWin);
            const zx2 = barHToX(z.to, W, barWin);
            return { i, cx: (zx1 + zx2) / 2, width: zx2 - zx1, label: z.label };
          }).filter(item => item.width >= 40);
          const visible: typeof items = [];
          for (const item of items) {
            const prev = visible[visible.length - 1];
            if (!prev || item.cx - prev.cx > 40) visible.push(item);
          }
          return visible.map(item => (
            <text key={item.i} x={item.cx} y={BAR_Y - 6}
              fontSize={9.5} fill="#1A1612" fillOpacity={0.45}
              textAnchor="middle" fontFamily="DM Mono, monospace">
              {item.label}
            </text>
          ));
        })()}

        {/* Bake reference line */}
        <line x1={barHToX(0, W, barWin)} y1={0} x2={barHToX(0, W, barWin)} y2={BAR_AXIS_Y}
          stroke="#C4522A" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.25} />

        {/* Blocker columns */}
        {blocks.map((b, i) => {
          const hbfFrom = (bakeMs - b.from.getTime()) / 3600000;
          const hbfTo   = (bakeMs - b.to.getTime())   / 3600000;
          if (hbfFrom <= 0 && hbfTo >= barWin) return null;
          const bx1 = barHToX(hbfFrom, W, barWin);
          const bx2 = barHToX(hbfTo, W, barWin);
          if (bx2 <= bx1) return null;
          const n = Math.ceil((bx2 - bx1 + BAR_SVG_H) / 7) + 2;
          return (
            <g key={i}>
              <rect x={bx1} y={0} width={bx2 - bx1} height={BAR_AXIS_Y} fill="rgba(196,82,42,0.09)" />
              <g clipPath={`url(#sbc-${i})`}>
                {Array.from({ length: n }, (_, j) => {
                  const ox = bx1 + j * 7 - BAR_AXIS_Y;
                  return (
                    <line key={j} x1={ox} y1={0} x2={ox + BAR_AXIS_Y} y2={BAR_AXIS_Y}
                      stroke="rgba(196,82,42,0.16)" strokeWidth={1} />
                  );
                })}
              </g>
              <line x1={bx1} y1={0} x2={bx2} y2={0}
                stroke="rgba(196,82,42,0.5)" strokeWidth={2.5} />
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={BAR_PAD} y1={BAR_Y + BAR_H + 1} x2={W - BAR_PAD} y2={BAR_Y + BAR_H + 1}
          stroke="rgba(0,0,0,0.08)" strokeWidth={0.8} />

        {/* Axis line */}
        <line x1={BAR_PAD} y1={BAR_AXIS_Y} x2={W - BAR_PAD} y2={BAR_AXIS_Y}
          stroke="#E8E0D5" strokeWidth={1} />

        {/* Ticks */}
        {(() => {
          const visible: typeof ticks = [];
          for (const t of ticks) {
            const prev = visible[visible.length - 1];
            if (visible.length >= 5) break;
            if (!prev || Math.abs(t.x - prev.x) >= 32) visible.push(t);
          }
          return visible.map((tk, i) => (
            <g key={i}>
              <line x1={tk.x} y1={BAR_AXIS_Y} x2={tk.x} y2={BAR_AXIS_Y + 3}
                stroke="#E8E0D5" strokeWidth={1} />
              <text x={tk.x} y={BAR_AXIS_Y + 12} fontSize={9.5} fill="var(--smoke)"
                fontFamily="DM Mono, monospace" textAnchor="middle">
                {tk.label}
              </text>
            </g>
          ));
        })()}

        {/* Bake marker */}
        {(() => {
          const bx = barHToX(0, W, barWin);
          return (
            <>
              <polygon points={`${bx - 8},${BAR_AXIS_Y} ${bx},${BAR_AXIS_Y - 14} ${bx + 8},${BAR_AXIS_Y}`}
                fill="#C4522A" />
              <text x={bx} y={BAR_AXIS_Y + 12} fontSize={9} fill="#C4522A"
                fontFamily="DM Mono, monospace" textAnchor="middle">
                {tRoot('schedulePicker.bakeLabel')}
              </text>
            </>
          );
        })()}

        {/* Diamond (draggable) */}
        <g style={{ cursor: dragging ? 'grabbing' : 'grab' }} onPointerDown={onPointerDown}>
          <polygon
            points={`${diamondX},${barCY - BAR_DS} ${diamondX + BAR_DS},${barCY} ${diamondX},${barCY + BAR_DS} ${diamondX - BAR_DS},${barCY}`}
            fill={dFill} stroke={dStroke} strokeWidth={1.5}
          />
          {inBlocker && (
            <>
              <circle cx={diamondX + BAR_DS + 3} cy={barCY - BAR_DS} r={5} fill="rgba(196,82,42,0.9)" />
              <text x={diamondX + BAR_DS + 3} y={barCY - BAR_DS + 4}
                fontSize={7} fill="white" textAnchor="middle" fontFamily="DM Mono, monospace">!</text>
            </>
          )}
        </g>
      </svg>

      {/* Info cards */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '.6rem', justifyContent: 'center' }}>
        <div style={{
          background: 'var(--cream)',
          border: '1.5px solid var(--border)', borderRadius: '10px', padding: '.45rem .7rem',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
            <div style={{ width: 8, height: 8, background: '#1A1612', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {tRoot('schedulePicker.startDough')}
            </div>
          </div>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {fmtDT(pendingStart)}
          </div>
          <div style={{ fontSize: '.65rem', marginTop: '.1rem', color: inZone ? '#4A7A3A' : (earlyOk || nearLate) ? '#C49A28' : '#C4522A' }}>
            {status}
          </div>
        </div>
        {/* Bake time shown on bar axis — no separate card needed */}
      </div>


    </div>
  );
}

// ── Component ─────────────────────────────────
// v1779291581473456000
export default function SchedulePicker({ startTime, eatTime, blocks, preheatMin, styleKey, kitchenTemp, schedule, onChange, bakeType = 'pizza', isSourdough = false, onFeedTimeChange, prefermentType = 'none', onPrefOffsetChange, onPrefGoesInFridgeChange, onFridgeOutTimeChange, onUsingPeak2Change, onFeed2TimeChange, onStarterStateChange, starterLocation: starterLocationProp, planningMode: planningModeProp, lastFedTime: lastFedTimeProp, knownPeakTime: knownPeakTimeProp, onStarterLocationChange, onPlanningModeChange, onLastFedTimeChange, onKnownPeakTimeChange, hasNotFedYet: hasNotFedYetProp = null, onHasNotFedYetChange, lastFedAge: lastFedAgeProp, onLastFedAgeChange, feedRatio: feedRatioProp, onFeedRatioChange, onStarterPeakTimeChange, mode = 'custom', onReady, fridgeTemp = 6, sessionRestored = false, flourStrength = 1.0, startTimeInPast = false }: SchedulePickerProps) {
  const t = useTranslations('scheduler');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isFr = locale === 'fr';
  const alreadySet = eatTime !== null && eatTime > new Date();
  // Skip phase 1 if a future bake time is already set (return-to-edit case)
  const [phase, setPhase] = useState<PickerPhase>(() => alreadySet ? 'start_confirm' : 'bake_time');
  const [pendingEatTime, setPendingEatTime] = useState<Date>(eatTime ?? new Date());
  const [pendingStart, setPendingStart] = useState(startTime);
  // eatTimeSet: false on first visit until baker picks a date
  const [eatTimeSet, setEatTimeSet] = useState(alreadySet);
  // startComputed: false until engine runs at least once; true on return-to-edit
  const [startComputed, setStartComputed] = useState(alreadySet);

  const [isDragging, setIsDragging] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isNarrow, setIsNarrow] = useState(false);
  const [blockerNote, setBlockerNote] = useState<string | null>(null);
  const [guardNote, setGuardNote] = useState<string | null>(null);
  const [windowTooShort, setWindowTooShort] = useState(false);
  const [suggestedBakeTime, setSuggestedBakeTime] = useState<Date | null>(null);
  const minTotalRTRef = useRef(2.5);
  const [recommendedColdH, setRecommendedColdH] = useState<number>(() => {
    const d = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;
    return d.coldH ?? 0;
  });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [pickerDateTime, setPickerDateTime] = useState<string>(() => {
    if (alreadySet && eatTime) {
      const d = eatTime;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }
    return '';
  });
  // Split state for custom time picker UI
  const [pickerDate, setPickerDate] = useState<string>(() => {
    if (alreadySet && eatTime) {
      const d = eatTime;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return '';
  });
  const [pickerHour, setPickerHour] = useState<number>(() => alreadySet && eatTime ? eatTime.getHours() : 18);
  const [pickerMinute, setPickerMinute] = useState<number>(() => {
    if (alreadySet && eatTime) {
      const m = eatTime.getMinutes();
      return [0,15,30,45].reduce((prev, cur) => Math.abs(cur-m) < Math.abs(prev-m) ? cur : prev, 0);
    }
    return 0;
  });
  const [dismissedConflict, setDismissedConflict] = useState(false);

  // Sourdough state — new UX vars
  const [starterLocation, setStarterLocation]   = useState<'rt' | 'fridge'>(starterLocationProp ?? 'rt');
  const [planningMode, setPlanningMode]         = useState<'last_fed' | 'know_peak'>(planningModeProp ?? 'last_fed');
  const [lastFedTime, setLastFedTime]           = useState<Date | null>(lastFedTimeProp ?? null);
  const [knownPeakTime, setKnownPeakTime]       = useState<Date | null>(knownPeakTimeProp ?? null);
  // Derived for BakeGuide backward compat
  const [starterMature, setStarterMature]       = useState(true);
  const [starterHasRye, setStarterHasRye]       = useState(false);
  const [feedTime, setFeedTime]                 = useState<Date | null>(null);
  const [fridgeOutTime, setFridgeOutTime]       = useState<Date | null>(null);
  const [usingPeak2, setUsingPeak2]             = useState(false);
  const [feed2Time, setFeed2Time]               = useState<Date | null>(null);
  const [starterPillState, setStarterPillState] = useState<'green' | 'yellow' | 'red'>('green');
  const [refeedSuggestion, setRefeedSuggestion] = useState<Date | null>(null);
  const [mixOverride, setMixOverride]           = useState(false);
  const [hasNotFedYet, setHasNotFedYet]         = useState<boolean | null>(hasNotFedYetProp ?? null);
  const [lastFedAge, setLastFedAge]             = useState<'today'|'yesterday'|'days23'|'days45'|'week'|null>(lastFedAgeProp ?? null);
  const [starterStateNote, setStarterStateNote] = useState<string | null>(null);
  const [starterIsDepletedAt, setStarterIsDepletedAt] = useState<Date | null>(null);
  const [starterRefeedTime, setStarterRefeedTime]     = useState<Date | null>(null);
  const [feedRatio, setFeedRatio]               = useState<1 | 2 | 4 | 5 | 10>(feedRatioProp ?? 1);
  const [driftNote, setDriftNote]               = useState<string | null>(null);
  const [showRatioInfo, setShowRatioInfo]       = useState(false);
  const [fridgeSuggestion, setFridgeSuggestion] = useState<string | null>(null);
  const [suggestedFridgeOutTime, setSuggestedFridgeOutTime] = useState<Date | null>(null);
  const [suggestedFridgePeakTime, setSuggestedFridgePeakTime] = useState<Date | null>(null);
  const [showFridgeComparison, setShowFridgeComparison] = useState(false);
  const [adjPeakHState, setAdjPeakHState] = useState<number | null>(null);
  // StarterState kept for BakeGuide compat — derived from new vars
  const starterState: StarterState = starterLocation === 'fridge'
    ? (fridgeOutTime ? 'fridge_fed' : 'fridge_unfed')
    : 'rt_fed';

  // Preferment offset state (non-sourdough)
  const [prefOffsetH, setPrefOffsetH] = useState<number>(() =>
    getPrefOptH(prefermentType, kitchenTemp)
  );

  // Recommendation ghost diamond + fallback popup
  const [recommendedHBF, setRecommendedHBF] = useState<number | null>(null);
  const [showFallbackPopup, setShowFallbackPopup] = useState(false);
  const [fallbackOptions, setFallbackOptions] = useState<{
    outsideZone: { mixHBF: number; qualityPct: number } | null;
    inBlocker:   { mixHBF: number; overlapMin: number } | null;
  } | null>(null);
  const hasManuallyDragged = useRef(false);
  const [hasDragged, setHasDragged] = useState(false);
  // Tracks whether the recommendation algo chose fridge or RT poolish.
  // This is the single source of truth — render-time display reads this,
  // not an independent re-computation from mixOffsetH.
  const [algoChoseFridge, setAlgoChoseFridge] = useState<boolean>(true);
  const suppressStartReset = useRef(false);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [skipPoolishNote, setSkipPoolishNote] = useState(false);
  // True when algo found a poolish slot but scored red (under-fermentation risk).
  // Distinct from skipPoolishNote (window too short). Hides poolish from graph.
  const [prefAlgoRed, setPrefAlgoRed] = useState(false);
  const [editingMix, setEditingMix]   = useState(false);
  const [editingPref, setEditingPref] = useState(false);
  const pickerDateTimeRef = useRef<string>(pickerDateTime);

  const prefLabel = prefermentType === 'poolish' ? tRoot('preferment.makePoolish')
    : prefermentType === 'biga' ? tRoot('preferment.makeBiga')
    : (prefermentType === 'levain' || isSourdough) ? tRoot('preferment.feedStarter')
    : tRoot('preferment.makePreferment');

  function applyTimePick(date: string, hour: number, minute: number) {
    const hh = String(hour).padStart(2, '0');
    const mi = String(minute).padStart(2, '0');
    const dt = `${date}T${hh}:${mi}`;
    pickerDateTimeRef.current = dt;
    setPickerDateTime(dt);
    updateEatTime(dt);
    if (date) { confirmBakeTime(); }
  }

  function updateEatTime(dt: string) {
    if (!dt || dt.length < 16) return;
    const [datePart, timePart] = dt.split('T');
    const [yyyy, mm, dd] = datePart.split('-').map(Number);
    const [hh, mi] = timePart.split(':').map(Number);
    const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
    setPendingEatTime(d);
    setEatTimeSet(true);
  }

  function computeAndApplyRecommendation(
    currentBlocks: AvailabilityBlock[],
    et: Date,
  ) {
    // Reset prefAlgoRed at start — prevents stale state from previous run
    setPrefAlgoRed(false);
    setWindowTooShort(false);
    const defaults = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;
    // Scale fermentation windows by flour strength (W value / fermToleranceMultiplier).
    // Stronger flour tolerates longer fermentation and benefits from more cold retard.
    // rtH and minTotalFermH are NOT scaled — those are fixed by physiology and style.
    const ftm = Math.max(0.5, Math.min(2.0, flourStrength));
    const scaledDefaults = {
      ...defaults,
      coldH:          Math.round(defaults.coldH * ftm),
      preferredColdH: Math.round((defaults.preferredColdH ?? defaults.coldH) * ftm),
    };
    const isTrop = kitchenTemp >= 28;
    const minBulkRTLocal = isTrop ? 0.5 : 1.5;
    const minTotalRTLocal = minBulkRTLocal + 1.0 + (preheatMin / 60);
    minTotalRTRef.current = minTotalRTLocal;
    const nowMs = Date.now();
    const totalWindowH = (et.getTime() - nowMs) / 3600000;
    const nowHBF = totalWindowH;

    // Guard: bake time in the past
    if (totalWindowH <= 0) {
      setGuardNote(tRoot('schedulePicker.guardPast'));
      return;
    }

    // Guard: window too short for any fermentation
    if (totalWindowH < minTotalRTLocal) {
      setWindowTooShort(true);
      setGuardNote(null);
      setStartComputed(false);
      return;
    }

    // CT maximization — exact same model as buildSchedule
    const preferredColdH = scaledDefaults.preferredColdH ?? scaledDefaults.coldH;
    let expectedColdH: number;
    if (scaledDefaults.coldH === 0) {
      expectedColdH = 0;
    } else if (totalWindowH >= preferredColdH + minTotalRTLocal) {
      expectedColdH = preferredColdH;
    } else if (totalWindowH >= scaledDefaults.coldH + minTotalRTLocal) {
      expectedColdH = scaledDefaults.coldH;
    } else if (totalWindowH > minTotalRTLocal) {
      expectedColdH = totalWindowH - minTotalRTLocal;
    } else {
      expectedColdH = 0;
    }
    const hasColdLocal = expectedColdH > 0;
    setRecommendedColdH(expectedColdH);

    const minColdH = defaults.minColdH ?? 0;
    // Compute fridge decision locally — same logic as render-time prefGoesInFridge
    // but using fresh values to avoid stale closure
    // Never use mixOffsetH (stale UI state) to compute the recommendation.
    // Fridge is viable if total window allows: poolish min 12h + RT fermentation.
    // Exclude preheat from fridge viability — preheat is post-load, irrelevant to poolish window.
    const minTotalRT_noPreheat = (kitchenTemp >= 28 ? 0.5 : 1.5) + 1.0;
    const localEnoughTimeForFridge = nowHBF >= (14 + minTotalRT_noPreheat);
    const localPrefGoesInFridge = hasPrefActive && (
      prefermentType === 'biga'
      || (prefermentType === 'poolish' && (kitchenTemp >= 26 || localEnoughTimeForFridge))
    );
    // Scale fridge poolish optimal time by flour strength — stronger flour benefits from longer poolish.
    // RT poolish is temp-driven (not gluten-driven), so only fridge poolish gets scaled.
    const basePrefOptH = hasPrefActive
      ? getPrefOptH(prefermentType, kitchenTemp, localPrefGoesInFridge, styleKey ?? 'neapolitan', fridgeTemp)
      : prefOffsetH;
    const rawPrefOffset = localPrefGoesInFridge
      ? Math.min(24, Math.round(basePrefOptH * ftm * 2) / 2)
      : basePrefOptH;
    // fridge-aware minimum: 12h for fridge poolish/biga, 3h for RT poolish
    const poolishMinH = localPrefGoesInFridge ? 12 : 3;

    // sweetCenter = coldH + rtH = the style sweet spot where dough peaks at bake
    // This is a style constant — NOT climate sensitive (climate adjusts yeast, not timing)
    // sweetFrom = leftmost boundary (preferredColdH + rtH) — widest useful cold
    // sweetTo = rightmost boundary (minimum viable total fermentation)
    const optimalColdH = hasColdLocal ? (scaledDefaults.coldH + defaults.rtH) : 0;
    const sweetCenterRaw = hasColdLocal
      ? scaledDefaults.coldH + defaults.rtH     // dough peaks at bake at this position
      : defaults.rtH;                            // RT only: peak at rtH before bake
    // sweetFrom = right edge of dough quality plateau (not preferredColdH which is the target).
    // plateauHalfW is how far from sweetCenter bake can be while still at peak quality.
    // Beyond this, dough is on the decline — mixInZone=false, score drops.
    // Scaled by flourStrength: stronger flour has wider plateau tolerance.
    const plateauHalfW = hasColdLocal
      ? Math.round((defaults.coldH ?? 24) * 0.35 * (flourStrength ?? 1.0))  // ~8h for 24h cold, W250
      : Math.round((defaults.rtH ?? 2) * 0.75);  // ~1.5h for 2h RT
    const sweetFromRaw = hasColdLocal
      ? Math.min(72, (defaults.coldH ?? 24) + (defaults.rtH ?? 2) + plateauHalfW)
      : (defaults.rtH ?? 2) + plateauHalfW;
    // Use minTotalFermH as the right boundary — matches the card's green zone
    // and is the scientifically correct absolute minimum for acceptable results.
    // This is style-sensitive: each style defines its own minTotalFermH.
    const sweetToRaw = defaults.minTotalFermH ?? (minTotalRTLocal + 1);

    // Clip all to nowHBF — cannot start in the past
    const sweetCenter = Math.min(sweetCenterRaw, nowHBF - 0.5);
    const sweetFrom   = Math.min(sweetFromRaw,   nowHBF - 0.25);
    const sweetTo     = Math.min(sweetToRaw,     sweetFrom - 0.5);

    if (!hasColdLocal && totalWindowH < sweetToRaw) {
      setGuardNote(isFr
        ? 'Fenêtre courte — une pâte du jour peut quand même être excellente.'
        : 'Working with a short window — same-day dough can still be wonderful.');
    } else {
      setGuardNote(null);
    }

    // Pass full raw offset — findOptimalPosition computes per-candidate clamp:
    //   maxPrefOffset = min(rawPrefOffset, nowHBF - candidate - 0.25)
    // This correctly handles every candidate independently.
    const optimalPrefOffset = hasPrefActive ? rawPrefOffset : prefOffsetH;
    if (hasPrefActive) {
      setPrefOffsetH(optimalPrefOffset);
      onPrefOffsetChange?.(optimalPrefOffset);
    }

    // Skip poolish if window too short for even a yellow result.
    // Yellow requires at least poolishMinH + minTotalRTLocal.
    // This is style + temperature sensitive via poolishMinH and minTotalRTLocal.
    // Consistent with localEnoughTimeForFridge — exclude preheat
    const minWindowForYellowPoolish = poolishMinH + minTotalRT_noPreheat;
    const skipPoolishDueToTime = hasPrefActive && totalWindowH < minWindowForYellowPoolish;
    if (skipPoolishDueToTime) {
      // Suppress preferment — direct dough gives better result than underdeveloped poolish
      setSkipPoolishNote(true);
      setPrefAlgoRed(false);
    } else {
      setSkipPoolishNote(false);
    }

    // Pass hasPref=false to findOptimalPosition when skipping poolish
    const effectiveHasPref = hasPrefActive && !skipPoolishDueToTime;

    // Minimum viable poolish: 3h RT, 12h fridge
    const prefMinViableH = poolishMinH;
    // Always try both fridge and RT poolish modes when poolish is active.
    // Pick the mode with the highest score. Fridge wins ties (better flavour development).
    // This makes the recommendation style-sensitive and temperature-sensitive
    // while always maximising fermentation quality.
    let result = findOptimalPosition(
      sweetCenter, sweetFrom, sweetTo,
      currentBlocks, et,
      effectiveHasPref, optimalPrefOffset,
      kitchenTemp,
      nowHBF,
      prefermentType,
      prefMinViableH,
      minTotalRTLocal,
      localPrefGoesInFridge ? getPrefRTWarmupH(kitchenTemp) : 0,
      localPrefGoesInFridge,
      fridgeTemp,
      styleKey ?? 'neapolitan',
    );
    let resultChoseFridge = localPrefGoesInFridge;

    if (effectiveHasPref && prefermentType === 'poolish' && localPrefGoesInFridge) {
      // Also try RT mode — RT poolish peaks earlier and may score higher
      // when the window is too short for a full fridge poolish
      const rtPrefOptH = getPrefOptH(prefermentType, kitchenTemp, false, styleKey ?? 'neapolitan', fridgeTemp);
      const rtResult = findOptimalPosition(
        sweetCenter, sweetFrom, sweetTo,
        currentBlocks, et,
        effectiveHasPref, rtPrefOptH,
        kitchenTemp,
        nowHBF,
        prefermentType,
        3,           // RT minimum 3h
        minTotalRTLocal,
        0,           // no warmup needed for RT poolish
        false,       // RT mode
        fridgeTemp,
        styleKey ?? 'neapolitan',
      );
      // RT wins only if strictly better score — fridge wins all ties
      if (rtResult.score > result.score) {
        result = rtResult;
        resultChoseFridge = false;
      }
    }

    // Report which mode won — display reads this as single source of truth
    if (effectiveHasPref && prefermentType === 'poolish') {
      setAlgoChoseFridge(resultChoseFridge);
    }

    // Unified decision tree — single source of truth for all scheduler states.
    // score 4: both green  → silent success
    // score 3: mix green, poolish yellow  → success, subtle note shown in poolish card
    // score 2: mix green, no poolish (RT-only styles)  → silent success
    // score 1: poolish yellow only  → success, subtle note in poolish card
    // score 0, slot found outside zone  → success with tight-window note in mix card
    // score 0, no slot, sweetCenter free  → guard note (window too tight)
    // score 0, no slot, sweetCenter blocked  → popup (genuine full conflict)
    if (result.score === 0 && result.fallback && result.mixInBlocker) {
      // Genuine conflict — every valid position is blocked
      const outsideHBF = result.mixHBF;
      const maxDist = Math.max(1, sweetFrom - sweetCenter);
      const dist = Math.abs(outsideHBF - sweetCenter);
      const qualityPct = Math.max(50, Math.round(100 - (dist / maxDist) * 40));
      const overlapMin = (() => {
        const bakeMs2 = et.getTime();
        for (const b of currentBlocks) {
          const s = (bakeMs2 - b.from.getTime()) / 3600000;
          const e = (bakeMs2 - b.to.getTime())   / 3600000;
          const lo = Math.max(Math.min(s, e), sweetCenter - 1);
          const hi = Math.min(Math.max(s, e), sweetCenter + 1);
          if (hi > lo) return Math.round((hi - lo) * 60);
        }
        return 30;
      })();
      setFallbackOptions({
        outsideZone: { mixHBF: outsideHBF, qualityPct },
        inBlocker:   { mixHBF: sweetCenter, overlapMin },
      });
      setRecommendedHBF(null);
      setShowFallbackPopup(true);
      if (hasPrefActive) setPrefAlgoRed(true);
    } else {
      // Valid slot found (score 1–4) or score 0 with sweetCenter free
      const newStart = new Date(et.getTime() - result.mixHBF * 3600000);
      setRecommendedHBF(result.mixHBF);
      setShowFallbackPopup(false);
      setPendingStart(newStart);
      onChange(newStart, et, currentBlocks);
      setDismissedConflict(true);
      if (hasPrefActive) {
        setPrefOffsetH(result.prefHBF - result.mixHBF);
        onPrefOffsetChange?.(result.prefHBF - result.mixHBF);
        // Red = valid slot found but score=0 (under-fermentation risk, not a blocker issue)
        // Hide poolish graph if: score=0 (no viable slot found) OR
        // RT poolish is below climate-sensitive minimum (no meaningful fermentation).
        const minViableRT = Math.max(1, Math.round(prefRTPeakH * 0.25));
        setPrefAlgoRed(effectiveHasPref && (
          (result.score === 0 && !result.mixInBlocker) ||
          (!resultChoseFridge && (result.prefHBF - result.mixHBF) < minViableRT)
        ));
      }
      // Score 0 with sweetCenter free: tight window note via existing guardShort path
      if (result.score === 0 && !result.mixInBlocker) {
        setGuardNote(isFr
        ? 'Fenêtre courte — une pâte du jour peut quand même être excellente.'
        : 'Working with a short window — same-day dough can still be wonderful.');
      } else {
        setBlockerNote(null);
      }
    }
    if (isSourdough) {
      findOptimalPositionSourdough(et);
    }
  }

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // On mount: if bake time already set (refresh / return-to-edit),
  // always run the recommendation engine before showing the graph
  useEffect(() => {
    if (!alreadySet) return;
    if (hasManuallyDragged.current) return;
    // If a session was restored, trust the saved times — do not recompute.
    // Baker already planned this; engine would overwrite their schedule.
    if (sessionRestored) {
      setStartComputed(true);
      onReady?.();
      return;
    }
    setTimeout(() => {
      computeAndApplyRecommendation(blocks, pendingEatTime);
      setStartComputed(true);
      onReady?.();
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eatTimeSet) return;
    setStartComputed(false);
    setShowFallbackPopup(false);
    setDismissedConflict(false);
    setGuardNote(null);
    setWindowTooShort(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEatTime]);

  // Auto-regenerate preset blocks when bake date changes
  useEffect(() => {
    if (!eatTimeSet) return;
    const wasWorkActive = blocks.some(b => b.label.startsWith('Work · '));
    const wasNightActive = blocks.some(b => b.label.startsWith('Night · '));
    if (!wasWorkActive && !wasNightActive) return;

    const freshWorkdays = getWorkdaysInWindow(windowStart, pendingEatTime);
    const freshNights   = getNightsInWindow(windowStart, pendingEatTime);

    // Keep any custom blocks (non-preset), then re-add active presets
    const customBlocks = blocks.filter(
      b => !b.label.startsWith('Work · ') && !b.label.startsWith('Night · ')
    );
    const newBlocks = [
      ...customBlocks,
      ...(wasWorkActive  ? freshWorkdays.map(d => ({ from: d.blockStart, to: d.blockEnd, label: d.label })) : []),
      ...(wasNightActive ? freshNights.map(n => ({ from: n.blockStart, to: n.blockEnd, label: n.label })) : []),
    ];
    applyAndUpdate(newBlocks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEatTime]);

  // Sourdough constraint re-evaluation when key inputs change
  useEffect(() => {
    if (!isSourdough || !eatTimeSet) return;
    setWindowTooShort(false);
    const peakTime = deriveStarterPeakTime();
    if (!peakTime) return;
    findOptimalPositionSourdough(pendingEatTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFedTime, knownPeakTime, fridgeOutTime, starterLocation, planningMode, starterMature, starterHasRye, feedRatio, eatTimeSet, pendingEatTime, styleKey]);

  // Clear starter state note when inputs that drive it change
  useEffect(() => {
    setStarterStateNote(null);
  }, [lastFedTime, knownPeakTime, starterLocation, planningMode, starterMature, starterHasRye]);

  // Clear fridge suggestion when key inputs change
  useEffect(() => {
    setFridgeSuggestion(null);
    setSuggestedFridgeOutTime(null);
    setSuggestedFridgePeakTime(null);
    setShowFridgeComparison(false);
  }, [starterLocation, lastFedTime, lastFedAge, planningMode,
      pendingEatTime, feedRatio, starterMature,
      starterHasRye, kitchenTemp]);

  useEffect(() => {
    if (!isSourdough) return;
    setSuggestedBakeTime(null);
  }, [lastFedTime, lastFedAge, starterLocation, planningMode,
      starterMature, starterHasRye, feedRatio, kitchenTemp, isSourdough]);

  useEffect(() => {
    setDriftNote(null);
  }, [lastFedTime, knownPeakTime, pendingEatTime]);

  const suggestion = useMemo(
    () => computeSuggestion(pendingEatTime, preheatMin, styleKey, kitchenTemp),
    [pendingEatTime, preheatMin, styleKey, kitchenTemp],
  );

  // FIX 2: climate-aware pref fridge flag
  const hasPrefActive = prefermentType !== 'none' && prefermentType !== '' && !isSourdough;

  // Cold-aware fermentation curve
  const mixOffsetH = Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000);
  const hasColdRetard = (schedule?.coldRetardHours ?? 0) > 0;
  const _sfDef = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;
  const _minTotalRT = (kitchenTemp >= 28 ? 0.5 : 1.5) + 1.0 + (preheatMin / 60);
  const _nowHBF = (pendingEatTime.getTime() - Date.now()) / 3600000;
  // Bake time in blocker detection
  const bakeTimeInBlocker = useMemo(() => {
    const bakeMs = pendingEatTime.getTime();
    return blocks.some(b => bakeMs > b.from.getTime() && bakeMs < b.to.getTime());
  }, [pendingEatTime, blocks]);
  const _tropFactor = kitchenTemp >= 33 ? 1.25 : kitchenTemp >= 30 ? 1.15 : 1.0;
  const _prefColdH = _sfDef.preferredColdH ?? _sfDef.coldH;
  // Green zone: always shows full style window — NOT clipped to nowHBF.
  // Zone guides the baker on what's ideal. Diamond clamped to nowHBF separately.
  const renderSweetFrom = _prefColdH + _sfDef.rtH;
  const renderSweetTo   = _sfDef.minTotalFermH ?? 4;
  // Yellow zone extends 2h past green right edge
  const renderYellowTo  = Math.max(0.5, renderSweetTo - 2);
  // _optimalMix = style sweet spot where dough peaks at bake = coldH + rtH
  // For RT-only styles, use rtH. Climate adjusts yeast not timing so no tropFactor here.
  const _optimalMix = _sfDef.coldH > 0
    ? _sfDef.coldH + _sfDef.rtH
    : _sfDef.rtH;
  const renderSweetCenter = Math.min(_optimalMix, renderSweetFrom - 0.25);
  // Two-temperature protocol:
  // Biga: always fridge.
  // Poolish: fridge when there is enough time (>= 14h between now and Start Dough),
  //          or when kitchen >= 26°C regardless of time (RT window too narrow/fragile).
  //          Falls back to RT only when window is short AND kitchen is cool (< 26°C).
  const prefRTPeakH = hasPrefActive ? getPrefPeakH_RT(prefermentType, kitchenTemp, styleKey ?? 'neapolitan') : 0;
  // prefGoesInFridge is set by the algo after trying both fridge and RT modes.
  // Never recompute independently — algo result is the single source of truth.
  const prefGoesInFridge = hasPrefActive && (
    prefermentType === 'biga' || (prefermentType === 'poolish' && algoChoseFridge)
  );
  useEffect(() => {
    onPrefGoesInFridgeChange?.(prefGoesInFridge);
  }, [prefGoesInFridge, onPrefGoesInFridgeChange]);
  // "Remove poolish from fridge" time: rtWarmupH before mix, pushed out of blockers
  const prefRTWarmupH = prefGoesInFridge ? getPrefRTWarmupH(kitchenTemp) : 0;
  const prefRemoveFromFridgeHBF = prefGoesInFridge ? mixOffsetH + prefRTWarmupH : null;
  const prefRemoveFromFridgeTime = prefRemoveFromFridgeHBF !== null
    ? new Date(pendingEatTime.getTime() - prefRemoveFromFridgeHBF * 3600000)
    : null;

  // Phase timeline strip data for FermentChart
  const phases = schedule ? {
    bulkFermH: schedule.bulkFermHours ?? 0,
    coldRetardH: schedule.coldRetardHours ?? 0,
    finalProofH: schedule.finalProofHours ?? 0,
    preheatH: (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000,
  } : undefined;

  // Dynamic chart window — fits mix+pref duration with breathing room
  const windowHRef = useRef(96);
  const windowH = useMemo(() => {
    if (isDragging) return windowHRef.current;
    const mixOffH = Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000);
    const diamondH = hasPrefActive ? mixOffH + prefOffsetH + 10 : mixOffH + 10;
    const zoneH = renderSweetFrom + 8;
    let computed = Math.min(144, Math.max(36, Math.ceil(Math.max(diamondH, zoneH) / 12) * 12));

    // Sourdough: expand window to always show Feed 1 (lastFedTime may be 40+ hours past)
    if (isSourdough && lastFedTime) {
      const feed1HBF = (pendingEatTime.getTime() - lastFedTime.getTime()) / 3600000;
      computed = Math.min(120, Math.max(computed, Math.ceil((feed1HBF + 3) / 12) * 12));
    }

    const nowHBF = (pendingEatTime.getTime() - Date.now()) / 3600000;
    const clipped = isSourdough
      ? computed
      : Math.min(computed, Math.max(mixOffH + 4, nowHBF + 1));

    windowHRef.current = clipped;
    return clipped;
  }, [isDragging, pendingEatTime, pendingStart, prefOffsetH,
      hasPrefActive, isSourdough, lastFedTime, renderSweetFrom]);

  // Fixed window start — always covers 5 days before bake regardless of diamond position
  const windowStart = useMemo(() => {
    const fiveDaysBefore = new Date(pendingEatTime.getTime() - 5 * 24 * 3600000);
    const now = new Date();
    return fiveDaysBefore > now ? fiveDaysBefore : now;
  }, [pendingEatTime]);

  const nights   = useMemo(() => getNightsInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const workdays = useMemo(() => getWorkdaysInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const isWorkActive = blocks.some(b => b.label.startsWith('Work · '));

  // ── Phase transitions ────────────────────────
  function confirmBakeTime() {
    const dt = pickerDateTimeRef.current;
    if (!dt || dt.length < 16) return;
    const [datePart, timePart] = dt.split('T');
    const [yyyy, mm, dd] = datePart.split('-').map(Number);
    const [hh, mi] = timePart.split(':').map(Number);
    const et = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
    suppressStartReset.current = true;
    setPendingEatTime(et);
    setEatTimeSet(true);
    hasManuallyDragged.current = false;
    setHasDragged(false);
    setDismissedConflict(false);
    setShowFallbackPopup(false);
    setPhase('start_confirm');
    setTimeout(() => {
      computeAndApplyRecommendation(blocks, et);
      setStartComputed(true);
      onReady?.();
      suppressStartReset.current = false;
    }, 0);
  }

  function clearFridgeSuggestion() {
    setFridgeSuggestion(null);
    setSuggestedFridgeOutTime(null);
    setSuggestedFridgePeakTime(null);
    setShowFridgeComparison(false);
  }

  // ── Sourdough: derive peak time from inputs ──
  function deriveStarterPeakTime(): Date | null {
    clearFridgeSuggestion();
    onStarterPeakTimeChange?.(null);
    const peakH = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
    const ryeF  = starterHasRye ? 0.8 : 1.0;
    const matF  = starterMature ? 1.0 : 1.2;
    const ratioMultiplier = 1 + 0.35 * Math.log(feedRatio);
    const adjPeakH = peakH * ryeF * matF * ratioMultiplier;
    setAdjPeakHState(adjPeakH);
    const troughH  = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMultiplier;
    const warmupH  = getStarterFridgeWarmupH(kitchenTemp);

    if (planningMode === 'know_peak' && knownPeakTime) {
      onStarterPeakTimeChange?.(knownPeakTime);
      return knownPeakTime;
    }

    if (planningMode === 'last_fed' && lastFedTime) {
      const now = new Date();
      const hoursSinceFeed = (now.getTime() - lastFedTime.getTime()) / 3600000;

      if (starterLocation === 'fridge' && fridgeOutTime) {
        const peakTime = new Date(fridgeOutTime.getTime() + warmupH * 3600000);
        onStarterPeakTimeChange?.(peakTime);
        return peakTime;
      }

      if (starterLocation === 'fridge' && !fridgeOutTime) {
        // No fridgeOutTime yet — estimate peak at mix time so solver can run
        onStarterPeakTimeChange?.(new Date(pendingStart.getTime()));
        return new Date(pendingStart.getTime());
      }

      // RT starter — still rising or just past peak (1h tolerance for fridge suggestion)
      // 0.5h hysteresis prevents oscillation; extended to 1h so a starter up to 1h
      // past peak still gets evaluated for fridge hold suggestion.
      const PEAK_HYSTERESIS = 1.0;
      if (hoursSinceFeed < adjPeakH + PEAK_HYSTERESIS) {
        setStarterIsDepletedAt(null);
        setStarterRefeedTime(null);

        const rtPeakTime = new Date(lastFedTime.getTime() + adjPeakH * 3600000);
        const hoursAfterPeak =
          (pendingStart.getTime() - rtPeakTime.getTime()) / 3600000;

        if (hoursAfterPeak > adjPeakH * 0.6 && starterLocation === 'rt') {
          const warmupH2 = getStarterFridgeWarmupH(kitchenTemp);
          const coldFactor = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10);
          const fridgePeakH = adjPeakH * coldFactor;
          const maxFridgeGapH = fridgePeakH * 0.7;
          if (hoursAfterPeak <= maxFridgeGapH) {
            const computedFridgeOut = new Date(
              pendingStart.getTime() - warmupH2 * 3600000
            );
            const computedFridgePeak = new Date(
              computedFridgeOut.getTime() + warmupH2 * 3600000
            );
            const minFridgeInTime = new Date(Date.now() + 15 * 60000);
            if (computedFridgeOut > minFridgeInTime) {
              setSuggestedFridgeOutTime(computedFridgeOut);
              setSuggestedFridgePeakTime(computedFridgePeak);
              setShowFridgeComparison(true);
              setFridgeSuggestion(
                locale === 'fr'
                  ? `Mettez au frigo maintenant — sortez à ${
                      computedFridgeOut.toLocaleTimeString('fr-FR',
                        { hour: 'numeric', minute: '2-digit' })
                    } pour mixer au pic`
                  : `Refrigerate now — remove at ${
                      computedFridgeOut.toLocaleTimeString('en-US',
                        { hour: 'numeric', minute: '2-digit', hour12: true })
                    } to mix at peak`
              );
            } else {
              clearFridgeSuggestion();
            }
          } else {
            clearFridgeSuggestion();
          }
        } else {
          clearFridgeSuggestion();
        }

        onStarterPeakTimeChange?.(rtPeakTime);
        return rtPeakTime;
      }

      // RT starter — declining (past peak, before trough)
      // Return the ACTUAL current cycle peak (already passed) so the solver
      // scores it as suboptimal. starterRefeedTime signals a refeed-now
      // candidate which findOptimalPositionSourdough picks up as Peak 2B.
      if (hoursSinceFeed < troughH) {
        setStarterStateNote(
          locale === 'fr'
            ? 'En descente — encore utilisable. Nourrir maintenant donne un pic plus fort.'
            : 'Declining — still usable. Feeding now gives a stronger result.'
        );
        setStarterIsDepletedAt(null);
        setStarterRefeedTime(new Date());
        clearFridgeSuggestion();
        const decliningPeak = new Date(lastFedTime.getTime() + adjPeakH * 3600000);
        onStarterPeakTimeChange?.(decliningPeak);
        return decliningPeak;
      }

      // RT starter — depleted (past trough)
      const troughTime = new Date(lastFedTime.getTime() + troughH * 3600000);
      setStarterIsDepletedAt(troughTime);
      const refeedNow = new Date();
      setStarterRefeedTime(refeedNow);
      setStarterStateNote('Depleted — needs feeding. Schedule below assumes you feed it now.');
      clearFridgeSuggestion();
      const depletedPeak = new Date(refeedNow.getTime() + adjPeakH * 3600000);
      onStarterPeakTimeChange?.(depletedPeak);
      return depletedPeak;
    }

    return null;
  }

  // ── Sourdough: joint mix+starter solver (scoring loop) ──────
  function findOptimalPositionSourdough(et: Date) {
    const peakTime = deriveStarterPeakTime();
    if (!peakTime) return;

    // Window too short check — same concept as poolish windowTooShort
    const bakeMs    = et.getTime();
    const nowMs0    = Date.now();
    const windowHBF = (bakeMs - nowMs0) / 3600000;
    const minFermH  = (_sfDef.minTotalFermH ?? 4) + 1.0;

    // Compute starter peak params early — needed for suggestion if window too short
    const peakH   = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
    const ryeF    = starterHasRye ? 0.8 : 1.0;
    const matF    = starterMature ? 1.0 : 1.2;
    const ratioMultiplier = 1 + 0.35 * Math.log(feedRatio);
    const adjPeakH = peakH * ryeF * matF * ratioMultiplier;

    if (windowHBF < minFermH) {
      setWindowTooShort(true);
      setStarterPillState('green');
      setRefeedSuggestion(null);
      setFeed2Time(null);

      // Earliest viable bake suggestion — bread only (not pizza)
      if (bakeType === 'bread') {
        const sweetCenterH = (renderSweetFrom + renderSweetTo) / 2;
        const minNeededH   = adjPeakH + sweetCenterH + 1;
        const suggested    = new Date(Date.now() + minNeededH * 3600000);
        suggested.setMinutes(0, 0, 0);
        suggested.setHours(suggested.getHours() + 1);
        const sh = suggested.getHours();
        if (sh < 7) {
          suggested.setHours(7, 0, 0, 0);
          if (suggested <= new Date()) suggested.setDate(suggested.getDate() + 1);
        } else if (sh > 22) {
          suggested.setDate(suggested.getDate() + 1);
          suggested.setHours(7, 0, 0, 0);
        }
        setSuggestedBakeTime(suggested);
      }
      return;
    }
    setWindowTooShort(false);
    setSuggestedBakeTime(null);

    const troughH  = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMultiplier;
    const warmupH  = getStarterFridgeWarmupH(kitchenTemp);
    const ftm      = Math.max(0.7, Math.min(1.5, flourStrength ?? 1.0));
    const baseTOL  = starterLocation === 'fridge' ? 2.0 : 1.0;
    const TOL      = baseTOL * ftm;

    const sweetFromHBF = renderSweetFrom;
    const sweetToHBF   = renderSweetTo;
    const minTotalRT   = (kitchenTemp >= 28 ? 0.5 : 1.5) + 1.0 + (preheatMin / 60);

    // ── Scoring helpers ──────────────────────────────

    function starterScore(mixHBF: number, peakHBF: number): 0 | 1 | 2 {
      const gap = Math.abs(mixHBF - peakHBF);
      if (gap <= TOL)       return 2;
      if (gap <= TOL + 1.5) return 1;
      return 0;
    }

    function doughScore(mixHBF: number): 0 | 1 | 2 {
      if (mixHBF >= sweetToHBF && mixHBF <= sweetFromHBF) return 2;
      if (mixHBF >= sweetToHBF - 2 && mixHBF <= sweetFromHBF + 2) return 1;
      return 0;
    }

    function retardBonus(mixHBF: number): number {
      const hasColdRetardLocal = (sweetFromHBF - sweetToHBF) / 2 > minTotalRT;
      if (!hasColdRetardLocal) return 0;
      return Math.min(8, Math.round(
        Math.min(mixHBF - minTotalRT, sweetFromHBF - minTotalRT) /
        Math.max(1, sweetFromHBF - minTotalRT) * 8
      ));
    }

    function reasonableHour(mixHBF: number): number {
      const h = new Date(bakeMs - mixHBF * 3600000).getHours();
      return (h >= 7 && h <= 22) ? 1 : 0;
    }

    function feedComfort(feedMs: number): number {
      const h = new Date(feedMs).getHours();
      if (h >= 7  && h <= 9)  return 8;
      if (h >= 19 && h <= 21) return 6;
      if (h >= 6  && h <= 10) return 3;
      if (h >= 18 && h <= 22) return 2;
      return 0;
    }

    function inBlocker(mixHBF: number): boolean {
      return blocks.some(b => {
        const s = (bakeMs - b.from.getTime()) / 3600000;
        const e = (bakeMs - b.to.getTime())   / 3600000;
        return mixHBF > Math.min(s, e) && mixHBF < Math.max(s, e);
      });
    }

    function combinedScore(mixHBF: number, peakHBF: number, feedMs: number, usesMixForComfort = false): number {
      const ss = starterScore(mixHBF, peakHBF);
      const ds = doughScore(mixHBF);
      const retardW = ss >= 2 ? 8 : 3;
      // For Peak 2: score the mix hour (controllable) not the trough/refeed time (fixed biology)
      const comfortMs = usesMixForComfort ? (bakeMs - mixHBF * 3600000) : feedMs;
      return (ss + ds) * 100
        + retardBonus(mixHBF) * retardW
        + reasonableHour(mixHBF) * 5
        + feedComfort(comfortMs);
    }

    // ── Candidate generation ──────────────────────────

    const STEP     = 0.25;
    const scanFrom = sweetFromHBF + 2;
    const scanTo   = Math.max(sweetToHBF - 2, minTotalRT + 0.5);

    interface Candidate {
      mixHBF:       number;
      peakHBF:      number;
      feedMs:       number;
      usingPeak2:   boolean;
      feed2Ms:      number | null;
      score:        number;
      sscore:       0 | 1 | 2;
      isFridgePath?: boolean;
    }

    const candidates: Candidate[] = [];

    const nowMs = Date.now();

    // Peak 1 candidates
    const peak1HBF = (bakeMs - peakTime.getTime()) / 3600000;
    const feed1Ms  = lastFedTime
      ? lastFedTime.getTime()
      : peakTime.getTime() - adjPeakH * 3600000;

    for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
      if (bakeMs - mixHBF * 3600000 <= nowMs) continue;
      if (inBlocker(mixHBF)) continue;
      const ss = starterScore(mixHBF, peak1HBF);
      if (ss === 0) continue;
      candidates.push({
        mixHBF, peakHBF: peak1HBF, feedMs: feed1Ms,
        usingPeak2: false, feed2Ms: null,
        score: combinedScore(mixHBF, peak1HBF, feed1Ms), sscore: ss,
      });
    }

    // Peak 2 candidates (Mode A last_fed only)
    if (planningMode === 'last_fed' && lastFedTime) {
      // Option A: natural trough cycle (Feed 2 at trough)
      const troughMs  = lastFedTime.getTime() + troughH * 3600000;
      const peak2AHBF = (bakeMs - (troughMs + adjPeakH * 3600000)) / 3600000;

      if (troughMs >= nowMs) {
        for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
          if (bakeMs - mixHBF * 3600000 <= nowMs) continue;
          if (inBlocker(mixHBF)) continue;
          const ss = starterScore(mixHBF, peak2AHBF);
          if (ss === 0) continue;
          candidates.push({
            mixHBF, peakHBF: peak2AHBF, feedMs: troughMs,
            usingPeak2: true, feed2Ms: troughMs,
            score: combinedScore(mixHBF, peak2AHBF, troughMs, true), sscore: ss,
          });
        }
      }

      // Option B: refeed now (declining state — starterRefeedTime set to now)
      if (starterRefeedTime) {
        const refeedMs  = starterRefeedTime.getTime();
        const peak2BHBF = (bakeMs - (refeedMs + adjPeakH * 3600000)) / 3600000;

        for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
          if (bakeMs - mixHBF * 3600000 <= nowMs) continue;
          if (inBlocker(mixHBF)) continue;
          const ss = starterScore(mixHBF, peak2BHBF);
          if (ss === 0) continue;
          candidates.push({
            mixHBF, peakHBF: peak2BHBF, feedMs: refeedMs,
            usingPeak2: true, feed2Ms: refeedMs,
            score: combinedScore(mixHBF, peak2BHBF, refeedMs, true), sscore: ss,
          });
        }
      }
    }

    // Peak 1 Fridge candidates (still-rising RT starter, fridge path computed)
    if (starterLocation === 'rt' && suggestedFridgePeakTime) {
      const fridgePeakHBF = (bakeMs - suggestedFridgePeakTime.getTime()) / 3600000;
      const fridgeFeedMs  = lastFedTime?.getTime() ?? feed1Ms;
      const fridgeTOL     = TOL * 1.5;

      for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
        if (bakeMs - mixHBF * 3600000 <= nowMs) continue;
        if (inBlocker(mixHBF)) continue;
        const gap = Math.abs(mixHBF - fridgePeakHBF);
        const ss: 0 | 1 | 2 = gap <= fridgeTOL ? 2 : gap <= fridgeTOL + 1.5 ? 1 : 0;
        if (ss === 0) continue;
        candidates.push({
          mixHBF,
          peakHBF: fridgePeakHBF,
          feedMs: fridgeFeedMs,
          usingPeak2: false,
          feed2Ms: null,
          score: combinedScore(mixHBF, fridgePeakHBF, fridgeFeedMs) + 5,
          sscore: ss,
          isFridgePath: true,
        });
      }
    }

    // ── Pick best candidate ──────────────────────────

    if (candidates.length === 0) {
      // Is the bake too soon for ANY starter cycle, or is this a genuine timing mismatch?
      const windowH    = (bakeMs - Date.now()) / 3600000;
      const minViableH = sweetToHBF + adjPeakH + 1;
      if (windowH > 0 && windowH < minViableH) {
        setWindowTooShort(true);
        setFeed2Time(null);
        setRefeedSuggestion(null);
        setDriftNote(null);
        return;
      }

      const idealMixHBF  = (sweetFromHBF + sweetToHBF) / 2;
      const idealMixTime = new Date(bakeMs - idealMixHBF * 3600000);
      const baseFeed     = new Date(idealMixTime.getTime() - adjPeakH * 3600000);

      // Search for the best future feed time in a ±36h window around the ideal,
      // scoring by feedComfort so a 4am ideal gets promoted to a nearby morning.
      const feedCandidates: { feedTime: Date; mixTime: Date; comfort: number }[] = [];
      const nowMs2        = Date.now();
      const searchStart   = new Date(baseFeed.getTime() - 36 * 3600000);
      const searchEnd     = new Date(baseFeed.getTime() + 2  * 3600000);

      for (let t = searchStart.getTime(); t <= searchEnd.getTime(); t += 15 * 60000) {
        if (t <= nowMs2) continue;
        const peakT  = new Date(t + adjPeakH * 3600000);
        const mixHBF = (bakeMs - peakT.getTime()) / 3600000;
        if (mixHBF < sweetToHBF - 4) continue;
        if (mixHBF > sweetFromHBF + 4) continue;
        if (bakeMs - mixHBF * 3600000 <= nowMs2) continue;
        feedCandidates.push({ feedTime: new Date(t), mixTime: peakT, comfort: feedComfort(t) });
      }

      let bestFeed = baseFeed;
      let bestMix  = idealMixTime;
      if (feedCandidates.length > 0) {
        feedCandidates.sort((a, b) => {
          if (b.comfort !== a.comfort) return b.comfort - a.comfort;
          return Math.abs(a.mixTime.getTime() - idealMixTime.getTime())
               - Math.abs(b.mixTime.getTime() - idealMixTime.getTime());
        });
        bestFeed = feedCandidates[0].feedTime;
        bestMix  = feedCandidates[0].mixTime;
      }

      setStarterPillState('red');
      const now = new Date();
      const displayFeed = bestFeed < now ? now : bestFeed;
      setRefeedSuggestion(displayFeed);
      setUsingPeak2(false);
      setFeed2Time(displayFeed);
      setDriftNote(null);
      const newPeak = new Date(displayFeed.getTime() + adjPeakH * 3600000);
      const newMixHBF = (bakeMs - newPeak.getTime()) / 3600000;
      const clampedMixHBF = Math.max(sweetToHBF, Math.min(sweetFromHBF, newMixHBF));
      const newMix = new Date(bakeMs - clampedMixHBF * 3600000);
      setPendingStart(newMix);
      onChange(newMix, et, blocks);
      if (planningMode === 'last_fed' && lastFedTime) {
        onFeedTimeChange?.(lastFedTime);
        setFeedTime(lastFedTime);
      }
      return;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    const newMix = new Date(bakeMs - best.mixHBF * 3600000);
    setPendingStart(newMix);
    onChange(newMix, et, blocks);

    // Compute fridgeOutTime from mix position when fridge starter
    if (starterLocation === 'fridge') {
      const computedFridgeOut = new Date(newMix.getTime() - warmupH * 3600000);
      setFridgeOutTime(computedFridgeOut);
      onFridgeOutTimeChange?.(computedFridgeOut);
    }

    // If fridge path candidate won, apply the suggested fridge-out time
    if (best.isFridgePath && suggestedFridgeOutTime) {
      setFridgeOutTime(suggestedFridgeOutTime);
      onFridgeOutTimeChange?.(suggestedFridgeOutTime);
    }

    setUsingPeak2(best.usingPeak2);
    setFeed2Time(best.feed2Ms ? new Date(best.feed2Ms) : null);
    setStarterPillState(best.sscore === 2 ? 'green' : 'yellow');
    setRefeedSuggestion(null);

    // Drift note for yellow positions
    if (best.sscore < 2 || doughScore(best.mixHBF) < 2) {
      setDriftNote('Starter timing slightly off — mix shifted to best available window.');
    } else {
      setDriftNote(null);
    }

    const activeFeed = best.usingPeak2 && best.feed2Ms
      ? new Date(best.feed2Ms)
      : lastFedTime ?? new Date(best.feedMs);
    onFeedTimeChange?.(activeFeed);
    setFeedTime(activeFeed);
    if (best.usingPeak2 && best.feed2Ms) {
      onFeed2TimeChange?.(new Date(best.feed2Ms));
    }
  }

  // ── Handlers ─────────────────────────────────

  function adjustStart(deltaH: number) {
    const d = new Date(pendingStart.getTime() + deltaH * 3600000);
    setPendingStart(d);
    onChange(d, pendingEatTime, blocks);
  }

  function applyAndUpdate(newBlocks: AvailabilityBlock[]) {
    const { resolvedStart, moved, resolvedDate: _resolvedDate } = applyBlockerOverlap(pendingStart, newBlocks);
    if (resolvedStart.getTime() !== pendingStart.getTime()) setPendingStart(resolvedStart);
    setBlockerNote(null);
    onChange(resolvedStart, pendingEatTime, newBlocks);
    if (!hasManuallyDragged.current && phase === 'start_confirm') {
      computeAndApplyRecommendation(newBlocks, pendingEatTime);
    }
  }

  function toggleWork() {
    const newBlocks = isWorkActive
      ? blocks.filter(b => !b.label.startsWith('Work · '))
      : [...blocks, ...workdays.map(d => ({ from: d.blockStart, to: d.blockEnd, label: d.label }))];
    applyAndUpdate(newBlocks);
  }

  function isAnyNightActive(): boolean {
    return nights.some(n => blocks.some(b => b.label === n.label));
  }

  function toggleAllNights() {
    const anyActive = isAnyNightActive();
    const nightLabels = new Set(nights.map(n => n.label));
    const withoutNights = blocks.filter(b => !nightLabels.has(b.label));
    const newBlocks = anyActive
      ? withoutNights
      : [...withoutNights, ...nights.map(n => ({ from: n.blockStart, to: n.blockEnd, label: n.label }))];
    applyAndUpdate(newBlocks);
  }

  function removeBlock(index: number) {
    applyAndUpdate(blocks.filter((_, i) => i !== index));
  }

  function addCustomBlock() {
    const from = new Date(customFrom);
    const to   = new Date(customTo);
    if (!customLabel.trim() || isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return;
    applyAndUpdate([...blocks, { from, to, label: customLabel.trim() }]);
    setCustomLabel(''); setCustomFrom(''); setCustomTo('');
    setShowCustom(false);
  }

  const customReady = customLabel.trim() && customFrom && customTo
    && new Date(customTo) > new Date(customFrom);

  // ── Shared sub-components ─────────────────────
  const continueBtnStyle: React.CSSProperties = {
    marginTop: '1.1rem', width: '100%', padding: '1rem 1.5rem',
    border: 'none', borderRadius: '12px',
    background: 'var(--terra)', color: '#fff',
    fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(196,82,42,0.25)',
    letterSpacing: '.01em',
  };

  // ── Unified render (bake time always visible) ─
  const { scenario } = suggestion;
  const startInvalid = startComputed && pendingStart >= pendingEatTime;
  const bulkConflict = schedule?.bulkConflict ?? null;

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans)' }}>

      {/* Bake time inputs — always visible */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--char)', marginBottom: '.3rem' }}>
          {bakeType === 'bread' ? t('bakeTimeLabelBread') : t('bakeTimeLabelPizza')}
        </div>
        <div style={{ fontSize: '.74rem', color: 'var(--smoke)', marginBottom: '.75rem', lineHeight: 1.5 }}>
          {t('bakeTimeSub')}
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', position: 'relative' }}>
          {/* Date — native picker styled as "Sat 4 Apr" */}
          <div style={{ flex: 2, position: 'relative' }}
            onClick={() => { try { dateInputRef.current?.showPicker(); } catch { dateInputRef.current?.click(); } }}
          >
            <div style={{
              ...INPUT_STYLE, width: '100%',
              display: 'flex', alignItems: 'center',
              color: pickerDate ? 'var(--char)' : 'var(--smoke)',
              position: 'relative', zIndex: 1, cursor: 'pointer',
            }}>
              {pickerDate ? (() => {
                const [y, m, d] = pickerDate.split('-').map(Number);
                const dt = new Date(y, m - 1, d);
                const loc = isFr ? 'fr-FR' : 'en-US';
                const wd = dt.toLocaleDateString(loc, { weekday: 'short' });
                const mo = dt.toLocaleDateString(loc, { month: 'short' });
                return `${wd} ${d} ${mo}`;
              })() : tRoot('schedulePicker.pickDate')}
            </div>
            <input
              ref={dateInputRef}
              type="date"
              value={pickerDate}
              onChange={e => {
                const d = e.target.value;
                setPickerDate(d);
                if (d && pickerHour !== null) applyTimePick(d, pickerHour, pickerMinute);
              }}
              style={{
                position: 'absolute', inset: 0, opacity: 0,
                cursor: 'pointer', width: '100%', height: '100%',
                zIndex: 2, fontSize: 16,
              }}
            />
          </div>
          {/* Time — select with 15-min steps */}
          <select
            value={`${pickerHour}:${String(pickerMinute).padStart(2,'0')}`}
            onChange={e => {
              const [h, m] = e.target.value.split(':').map(Number);
              setPickerHour(h);
              setPickerMinute(m);
              if (pickerDate) applyTimePick(pickerDate, h, m);
            }}
            disabled={!pickerDate}
            style={{ ...INPUT_STYLE, flex: 1, width: undefined, appearance: 'none' as React.CSSProperties['appearance'], opacity: pickerDate ? 1 : 0.45, cursor: pickerDate ? 'pointer' : 'not-allowed' }}
          >
            {!pickerDate && <option value="" disabled>{tRoot('schedulePicker.selectDateFirst')}</option>}
            {Array.from({ length: 96 }, (_, i) => {
              const h = Math.floor(i / 4);
              const m = (i % 4) * 15;
              const label = isFr
                ? `${h}h${String(m).padStart(2, '0')}`
                : `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2,'0')} ${h < 12 ? 'am' : 'pm'}`;
              return (
                <option key={i} value={`${h}:${String(m).padStart(2,'0')}`}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Phase 2 content — only once bake time is set */}
      {eatTimeSet && (<div>

      {/* Sourdough starter section */}
      {isSourdough && (
        <div style={{
          background: 'var(--warm)',
          border: '1.5px solid var(--border)',
          borderRadius: '14px',
          padding: '1.25rem',
          marginTop: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>

          {/* ── Card header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '-.25rem' }}>
            <div style={{ width: 8, height: 8, background: '#4A7FA5', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {isFr ? 'Votre levain' : 'Your starter'}
            </div>
          </div>

          {/* ── Q1: Where has it been since last fed? ── */}
          <div>
            <div style={STARTER_LABEL_STYLE}>
              {isFr ? 'Où était-il depuis son dernier repas ?' : 'Where has it been since last fed?'}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {(['rt', 'fridge'] as const).map(loc => (
                <button
                  key={loc}
                  onClick={() => {
                    setStarterLocation(loc);
                    onStarterLocationChange?.(loc);
                    setFridgeOutTime(null);
                    onFridgeOutTimeChange?.(null);
                    onStarterStateChange?.(loc === 'fridge' ? 'fridge_unfed' : 'rt_fed');
                  }}
                  style={starterPillButton(starterLocation === loc)}
                >
                  {loc === 'rt' ? (isFr ? 'Température ambiante' : 'Room temp') : (isFr ? 'Frigo' : 'Fridge')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Mode A: last fed — age chip flow ── */}
          {planningMode === 'last_fed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              <div style={STARTER_LABEL_STYLE}>
                {isFr ? 'QUAND A-T-IL ÉTÉ NOURRI ?' : 'WHEN WAS IT LAST FED?'}
              </div>

              {/* Age chips — always visible */}
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                {([
                  { id: 'today',     en: 'Today',       fr: "Aujourd'hui" },
                  { id: 'yesterday', en: 'Yesterday',    fr: 'Hier' },
                  { id: 'days23',    en: '2–3 days ago', fr: 'Il y a 2–3 jours' },
                  { id: 'days45',    en: '4–5 days ago', fr: 'Il y a 4–5 jours' },
                  { id: 'week',      en: 'A week+',      fr: 'Une semaine+' },
                ] as { id: 'today'|'yesterday'|'days23'|'days45'|'week'; en: string; fr: string }[]).map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => {
                      const now = new Date();
                      let prefill: Date;
                      if (chip.id === 'today') {
                        prefill = new Date(now.getTime() - 2 * 3600000);
                        const m = Math.round(prefill.getMinutes() / 15) * 15;
                        prefill.setMinutes(m === 60 ? 0 : m, 0, 0);
                        if (m === 60) prefill.setHours(prefill.getHours() + 1);
                      } else if (chip.id === 'yesterday') {
                        prefill = new Date(now);
                        prefill.setDate(prefill.getDate() - 1);
                        prefill.setHours(20, 0, 0, 0);
                      } else if (chip.id === 'days23') {
                        prefill = new Date(now.getTime() - 60 * 3600000);
                      } else if (chip.id === 'days45') {
                        prefill = new Date(now.getTime() - 108 * 3600000);
                      } else {
                        prefill = new Date(now.getTime() - 196 * 3600000);
                      }
                      setLastFedAge(chip.id);
                      onLastFedAgeChange?.(chip.id);
                      setLastFedTime(prefill);
                      onLastFedTimeChange?.(prefill);
                    }}
                    style={{
                      padding: '.3rem .65rem',
                      borderRadius: '20px',
                      border: `1.5px solid ${lastFedAge === chip.id ? 'var(--terra)' : 'var(--border)'}`,
                      background: lastFedAge === chip.id ? '#FEF4EF' : 'transparent',
                      color: lastFedAge === chip.id ? 'var(--terra)' : 'var(--smoke)',
                      fontFamily: 'var(--font-dm-sans)',
                      fontSize: '.8rem',
                      cursor: 'pointer',
                      fontWeight: lastFedAge === chip.id ? 600 : 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isFr ? chip.fr : chip.en}
                  </button>
                ))}
              </div>

              {/* Time select — inline, Today / Yesterday only */}
              {(lastFedAge === 'today' || lastFedAge === 'yesterday') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.1rem' }}>
                  <div style={{ fontSize: '.78rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>
                    {isFr ? 'à' : 'at'}
                  </div>
                  <select
                    value={lastFedTime
                      ? `${lastFedTime.getHours()}:${String(lastFedTime.getMinutes()).padStart(2,'0')}`
                      : ''}
                    onChange={e => {
                      const [h, m] = e.target.value.split(':').map(Number);
                      const base = lastFedAge === 'today'
                        ? new Date()
                        : (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
                      base.setHours(h, m, 0, 0);
                      if (base > new Date()) return;
                      setLastFedTime(base);
                      onLastFedTimeChange?.(base);
                    }}
                    style={{
                      fontFamily: 'var(--font-dm-mono)',
                      fontSize: '.82rem',
                      padding: '.28rem .5rem',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border)',
                      background: 'var(--warm)',
                      color: 'var(--char)',
                      minWidth: '100px',
                    }}
                  >
                    {Array.from({ length: 96 }, (_, i) => {
                      const h = Math.floor(i / 4);
                      const m = (i % 4) * 15;
                      if (lastFedAge === 'today') {
                        const now = new Date();
                        if (h > now.getHours() || (h === now.getHours() && m > now.getMinutes())) return null;
                      }
                      const mm = String(m).padStart(2, '0');
                      const label = isFr
                        ? `${h}h${m === 0 ? '' : mm}`
                        : `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${mm} ${h < 12 ? 'am' : 'pm'}`;
                      return <option key={i} value={`${h}:${mm}`}>{label}</option>;
                    }).filter(Boolean)}
                  </select>
                </div>
              )}

              {/* Approximate age note — 2+ days */}
              {(lastFedAge === 'days23' || lastFedAge === 'days45' || lastFedAge === 'week') && (
                <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5 }}>
                  {starterLocation === 'fridge'
                    ? (isFr
                        ? 'Le plan ci-dessous indiquera quand sortir votre levain.'
                        : 'The plan below will tell you when to take it out.')
                    : (isFr
                        ? "Votre levain a besoin d'être nourri — le plan vous guidera."
                        : 'Your starter needs feeding — the plan will guide you.')}
                </div>
              )}
            </div>
          )}

          {/* ── Maturity + rye ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            <div style={STARTER_LABEL_STYLE}>
              {isFr ? 'Comment est-il en forme ?' : 'How active is it?'}
            </div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {([
                { value: true,  label: 'Active & healthy' },
                { value: false, label: 'Young (<6 months)' },
              ] as { value: boolean; label: string }[]).map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setStarterMature(opt.value)}
                  style={starterPillButton(starterMature === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setStarterHasRye(!starterHasRye)}
                style={{
                  padding: '.35rem .7rem', borderRadius: '20px',
                  border: `1.5px solid ${starterHasRye ? 'var(--sage)' : 'var(--border)'}`,
                  background: starterHasRye ? 'rgba(107,122,90,0.08)' : 'transparent',
                  color: starterHasRye ? 'var(--sage)' : 'var(--smoke)',
                  fontFamily: 'var(--font-dm-sans)', fontSize: '.8rem', cursor: 'pointer',
                }}
              >
                Rye starter
              </button>
            </div>
          </div>

          {/* ── Feed ratio selector ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.35rem' }}>
              <div style={STARTER_LABEL_STYLE}>{isFr ? 'Ratio de nourrissage' : 'Feed ratio'}</div>
              <button
                onClick={() => setShowRatioInfo(v => !v)}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: `1.5px solid ${showRatioInfo ? 'var(--smoke)' : 'var(--border)'}`,
                  background: showRatioInfo ? 'var(--smoke)' : 'transparent',
                  color: showRatioInfo ? 'white' : 'var(--smoke)',
                  fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                  cursor: 'pointer', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 1, flexShrink: 0,
                }}
              >i</button>
            </div>
            {showRatioInfo && (
              <div style={{ fontSize: '.73rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5, marginBottom: '.5rem' }}>
                {isFr
                  ? "Levain : eau : farine. Un ratio élevé dilue la levure et allonge le pic — idéal pour planifier longtemps à l'avance."
                  : 'Starter : water : flour. A higher ratio dilutes the yeast and extends the peak — great for planning further ahead.'}
              </div>
            )}
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              {([1, 2, 4, 5, 10] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setFeedRatio(r); onFeedRatioChange?.(r); }}
                  style={{
                    padding: '.3rem .65rem', borderRadius: '20px',
                    border: `1.5px solid ${feedRatio === r ? 'var(--bread)' : 'var(--border)'}`,
                    background: feedRatio === r ? 'rgba(139,105,20,0.10)' : 'transparent',
                    color: feedRatio === r ? 'var(--bread)' : 'var(--smoke)',
                    fontFamily: 'var(--font-dm-mono)', fontSize: '.78rem', cursor: 'pointer',
                  }}
                >
                  1:{r}:{r}
                </button>
              ))}
            </div>
            {feedRatio === 4 && (
              <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', marginTop: '.3rem' }}>
                {isFr
                  ? 'Équilibré · pic plus tardif, idéal pour la plupart'
                  : 'Balanced · later peak, recommended for most bakers'}
              </div>
            )}
          </div>

          {/* ── Fridge suggestion (still-rising, mix too far from RT peak) ── */}
          {isSourdough && fridgeSuggestion && starterLocation === 'rt' && (
            <div style={{
              fontSize: '.7rem',
              color: 'var(--smoke)',
              fontFamily: 'var(--font-dm-sans)',
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}>
              {fridgeSuggestion}
            </div>
          )}

          {/* ── Mode B toggle link / picker ── */}
          {planningMode === 'last_fed' && (
            <button
              onClick={() => { setPlanningMode('know_peak'); onPlanningModeChange?.('know_peak'); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--smoke)', fontSize: '.68rem',
                fontFamily: 'var(--font-dm-mono)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                padding: 0, alignSelf: 'flex-start',
              }}
            >
              {isFr ? 'Je sais quand mon levain sera à son pic →' : 'I know when my starter will peak →'}
            </button>
          )}

          {planningMode === 'know_peak' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              <div>
                <div style={STARTER_LABEL_STYLE}>
                  {isFr ? 'À quelle heure votre levain est-il à son pic ?' : 'When does your starter peak?'}
                </div>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <select
                    value={knownPeakTime
                      ? `${knownPeakTime.getFullYear()}-${String(knownPeakTime.getMonth()+1).padStart(2,'0')}-${String(knownPeakTime.getDate()).padStart(2,'0')}`
                      : ''}
                    onChange={e => {
                      const [y,mo,d] = e.target.value.split('-').map(Number);
                      const base = knownPeakTime ?? new Date();
                      const next = new Date(y, mo-1, d, base.getHours(), base.getMinutes(), 0, 0);
                      setKnownPeakTime(next);
                      onKnownPeakTimeChange?.(next);
                    }}
                    style={STARTER_SELECT_STYLE}
                  >
                    {[0, 1, 2].map(offset => {
                      const dt = new Date();
                      dt.setDate(dt.getDate() + offset);
                      const val = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
                      const lbl = offset === 0
                        ? (isFr ? "Aujourd'hui" : 'Today')
                        : offset === 1
                        ? (isFr ? 'Demain' : 'Tomorrow')
                        : dt.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                      return <option key={offset} value={val}>{lbl}</option>;
                    })}
                  </select>
                  <select
                    value={knownPeakTime
                      ? `${knownPeakTime.getHours()}:${String(knownPeakTime.getMinutes()).padStart(2,'0')}`
                      : ''}
                    onChange={e => {
                      const [h, m] = e.target.value.split(':').map(Number);
                      const base = knownPeakTime ?? new Date();
                      const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
                      setKnownPeakTime(next);
                      onKnownPeakTimeChange?.(next);
                    }}
                    style={STARTER_SELECT_STYLE}
                  >
                    {Array.from({ length: 96 }, (_, i) => {
                      const h = Math.floor(i / 4);
                      const m = (i % 4) * 15;
                      const val = `${h}:${String(m).padStart(2,'0')}`;
                      const lbl = isFr
                        ? `${h}h${String(m).padStart(2,'0')}`
                        : `${h === 0 ? 12 : h > 12 ? h-12 : h}:${String(m).padStart(2,'0')} ${h < 12 ? 'am' : 'pm'}`;
                      return <option key={i} value={val}>{lbl}</option>;
                    })}
                  </select>
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.3rem' }}>
                  {isFr ? 'La fenêtre de mélange sera centrée sur ce moment' : 'Mix window will be centered on this time'}
                </div>
              </div>
              <button
                onClick={() => {
                  setPlanningMode('last_fed');
                  onPlanningModeChange?.('last_fed');
                  setKnownPeakTime(null);
                  onKnownPeakTimeChange?.(null);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--smoke)', fontSize: '.68rem',
                  fontFamily: 'var(--font-dm-mono)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  padding: 0, alignSelf: 'flex-start',
                }}
              >
                {isFr ? '← Retour' : '← Back'}
              </button>
            </div>
          )}

        </div>
      )}

      </div>)}

      {eatTimeSet && (<div>

      {/* Blocker section — always visible */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.6rem' }}>
          Block your unavailable times — we&apos;ll plan around them.
        </div>
        <div>

      {/* Quick presets — all toggles on one row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.45rem', marginBottom: '.8rem', width: '100%', overflow: 'visible', paddingLeft: 0 }}>
        {workdays.length > 0 && (
          <button
            onClick={toggleWork}
            style={{
              padding: '.38rem .85rem', borderRadius: '20px',
              border: `1.5px solid ${isWorkActive ? 'var(--terra)' : 'var(--border)'}`,
              background: isWorkActive ? '#FEF4EF' : 'var(--warm)',
              color: isWorkActive ? 'var(--terra)' : 'var(--smoke)',
              fontSize: '.78rem', fontWeight: isWorkActive ? 500 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
              transition: 'all .15s',
              display: 'inline-flex', alignItems: 'center', gap: '.3rem',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {t('blockers.weekdays')}
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', opacity: .65 }}>
              {t('blockers.weekdayHours')}
            </span>
            {isWorkActive && <span style={{ opacity: .7 }}>✓</span>}
          </button>
        )}
        {nights.length > 0 && (() => {
          const active = isAnyNightActive();
          return (
            <button
              onClick={toggleAllNights}
              style={{
                padding: '.38rem .85rem', borderRadius: '20px',
                border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                background: active ? '#FEF4EF' : 'var(--warm)',
                color: active ? 'var(--terra)' : 'var(--smoke)',
                fontSize: '.78rem', fontWeight: active ? 500 : 400,
                cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                transition: 'all .15s',
                display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t('blockers.nights')}
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', opacity: .65 }}>
                {t('blockers.nightHoursLabel')}
              </span>
              {active && <span style={{ opacity: .7 }}>✓</span>}
            </button>
          );
        })()}

        <button
          onClick={() => setShowCustom(v => !v)}
          style={{
            padding: '.38rem .85rem', borderRadius: '20px',
            border: `1.5px solid ${showCustom ? 'var(--terra)' : 'var(--border)'}`,
            background: showCustom ? '#FEF4EF' : 'var(--warm)',
            color: showCustom ? 'var(--terra)' : 'var(--smoke)',
            fontSize: '.78rem', cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)', transition: 'all .15s',
          }}
        >
          {showCustom ? t('blockers.cancel') : t('blockers.addCustom')}
        </button>
      </div>

      {/* Custom block form */}
      {showCustom && (
        <div style={{
          border: '1.5px solid var(--border)', borderRadius: '12px',
          padding: '1rem 1.1rem', background: 'var(--warm)',
          marginBottom: '.8rem',
        }}>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.75rem' }}>
            {t('blockers.customTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            <input
              type="text"
              placeholder={t('blockers.customLabelPlaceholder')}
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              style={{
                padding: '.55rem .75rem',
                border: '1.5px solid var(--border)', borderRadius: '8px',
                background: 'var(--card)', color: 'var(--char)',
                fontSize: '.82rem', fontFamily: 'var(--font-dm-sans)', outline: 'none',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
              <div>
                <div style={{ fontSize: '.67rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.25rem' }}>
                  {t('blockers.from')}
                </div>
                <input
                  type="datetime-local"
                  step={900}
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '.55rem .75rem',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--card)', color: 'var(--char)',
                    fontSize: '.78rem', fontFamily: 'var(--font-dm-mono)', outline: 'none',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: '.67rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.25rem' }}>
                  {t('blockers.to')}
                </div>
                <input
                  type="datetime-local"
                  step={900}
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{
                    width: '100%', padding: '.55rem .75rem',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--card)', color: 'var(--char)',
                    fontSize: '.78rem', fontFamily: 'var(--font-dm-mono)', outline: 'none',
                  }}
                />
              </div>
            </div>
            <button
              onClick={addCustomBlock}
              disabled={!customReady}
              style={{
                alignSelf: 'flex-start', padding: '.55rem 1.1rem',
                border: 'none', borderRadius: '12px',
                background: customReady ? 'var(--terra)' : 'var(--border)',
                color: customReady ? '#fff' : 'var(--smoke)',
                fontSize: '.82rem', fontWeight: 500,
                cursor: customReady ? 'pointer' : 'default',
                transition: 'all .15s',
              }}
            >
              {t('blockers.addBlock')}
            </button>
          </div>
        </div>
      )}

      {/* Active block chips — custom blocks only */}
      {blocks.some(b => !b.label.endsWith(' night') && !b.label.startsWith('Work · ')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginBottom: '.5rem' }}>
          {blocks.filter((block) => {
            const isNightBlock = block.label.endsWith(' night');
            const isWorkBlock = block.label.startsWith('Work · ');
            return !isNightBlock && !isWorkBlock;
          }).map((block, i) => {
            const durationH = (block.to.getTime() - block.from.getTime()) / 3600000;
            const emoji = '🚫';
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '.6rem',
                  padding: '.5rem .85rem',
                  background: '#FEF4EF', border: '1.5px solid var(--terra)',
                  borderRadius: '10px',
                }}
              >
                <span style={{ fontSize: '.95rem', flexShrink: 0 }}>{emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--terra)' }}>
                    {block.label}
                  </span>
                  <span style={{ opacity: .7, marginLeft: '.3rem', fontSize: '.8rem' }}>✓</span>
                  <span style={{
                    marginLeft: '.5rem', fontSize: '.72rem',
                    color: 'var(--terra)', opacity: .75, fontFamily: 'var(--font-dm-mono)',
                  }}>
                    {formatTimeShort(block.from, isFr)} → {formatTimeShort(block.to, isFr)}
                  </span>
                  <span style={{
                    marginLeft: '.35rem', fontSize: '.7rem',
                    color: 'var(--terra)', opacity: .5, fontFamily: 'var(--font-dm-mono)',
                  }}>
                    ({hoursLabel(durationH)})
                  </span>
                </div>
                <button
                  onClick={() => removeBlock(i)}
                  title="Remove"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--smoke)', fontSize: '.8rem',
                    padding: '.15rem .3rem', borderRadius: '4px',
                    lineHeight: 1, flexShrink: 0, transition: 'color .15s',
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
        </div>
      </div>

      {windowTooShort && eatTimeSet && (
        <div style={{
          background: 'var(--cream)',
          borderRadius: '12px',
          border: '1.5px solid var(--border)',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          fontFamily: 'var(--font-dm-sans)',
          display: 'flex',
          flexDirection: 'column',
          gap: '.5rem',
        }}>
          <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {isFr ? 'Pas assez de temps pour ce créneau' : 'Not enough time for this bake'}
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--smoke)', lineHeight: 1.55 }}>
            {isFr
              ? `Il faut au moins ${Math.ceil(minTotalRTRef.current)}h entre maintenant et la cuisson.`
              : `You need at least ${Math.ceil(minTotalRTRef.current)}h between now and your bake.`}
          </div>
          {isSourdough && bakeType === 'bread' && suggestedBakeTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>
                {isFr ? 'Essayez plutôt :' : 'Try instead:'}
              </div>
              <button
                onClick={() => {
                  setPendingEatTime(suggestedBakeTime);
                  setEatTimeSet(true);
                  onChange(pendingStart, suggestedBakeTime, blocks);
                  setSuggestedBakeTime(null);
                  setWindowTooShort(false);
                }}
                style={{
                  padding: '.35rem .85rem',
                  borderRadius: '20px',
                  border: '1.5px solid var(--terra)',
                  background: '#FEF4EF',
                  color: 'var(--terra)',
                  fontFamily: 'var(--font-dm-mono)',
                  fontSize: '.82rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {fmtCardDT(suggestedBakeTime, isFr)} →
              </button>
            </div>
          )}
          {bakeType === 'pizza' && (
            <div style={{ fontSize: '.82rem', color: 'var(--smoke)' }}>
              {isFr ? 'Essayez un créneau plus tardif — ou commandez une pizza ce soir.'
                     : 'Try a later time — or order in tonight.'}
            </div>
          )}
        </div>
      )}

      {guardNote && !windowTooShort && eatTimeSet && (
        <div style={{
          fontSize: '.82rem',
          color: 'var(--smoke)',
          lineHeight: 1.55,
          padding: '.5rem 0',
          fontFamily: 'var(--font-dm-sans)',
        }}>
          {guardNote}
        </div>
      )}

      {startComputed && (<>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '1.1rem 0 1rem' }} />

      {/* Fermentation chart */}
      <div style={{ marginBottom: startInvalid ? '.5rem' : '1rem' }}>
        <div style={{ fontSize: '.7rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.4rem' }}>
          {hasDragged ? t('schedulerTitle.yours') : t('schedulerTitle.recommended')}
        </div>
        {startComputed ? (
          mode === 'simple' ? (
            <SimpleColourBar
              eatTime={pendingEatTime}
              pendingStart={pendingStart}
              blocks={blocks}
              hasColdRetard={hasColdRetard}
              kitchenTemp={kitchenTemp}
              sweetFrom={renderSweetFrom}
              sweetTo={renderSweetTo}
              yellowTo={renderYellowTo}
              nowHBF={(pendingEatTime.getTime() - Date.now()) / 3600000}
              onStartChange={(newStart) => {
                setPendingStart(newStart);
                const bakeMs = pendingEatTime.getTime();
                const h = (bakeMs - newStart.getTime()) / 3600000;
                const inB = blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return h > Math.min(s,e) && h < Math.max(s,e);
                });
                const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
                const bulkEndHBF = h - typicalBulkH;
                const bulkEndInB = !inB && bulkEndHBF > 0 && blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return bulkEndHBF > Math.min(s,e) && bulkEndHBF < Math.max(s,e);
                });
                const fmtBulkDur = (h: number) => h === 0.5 ? '30min' : h === 0.75 ? '45min' : '1h30';
                const fmtBulkTime = (hbf: number) => new Date(bakeMs - hbf * 3600000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                setBlockerNote(
                  inB ? tRoot('schedulePicker.blockerNote')
                  : bulkEndInB ? tRoot('schedulePicker.bulkNote', { dur: fmtBulkDur(typicalBulkH), time: fmtBulkTime(bulkEndHBF) })
                  : null
                );
                onChange(newStart, pendingEatTime, blocks);
              }}
            />
          ) : (
            <FermentChart
              eatTime={pendingEatTime}
              prefermentType={(skipPoolishNote || prefAlgoRed) ? 'none' : (isSourdough ? 'sourdough' : prefermentType)}
              kitchenTemp={kitchenTemp}
              fridgeTemp={fridgeTemp}
              styleKey={styleKey ?? 'neapolitan'}
              mixOffsetH={Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000)}
              prefOffsetH={(() => {
                if (!isSourdough) return prefOffsetH;
                const warmupH = getStarterFridgeWarmupH(kitchenTemp);
                if (fridgeOutTime) {
                  return Math.max(1,
                    (pendingStart.getTime() - fridgeOutTime.getTime()) / 3600000
                    + warmupH
                  );
                }
                const activeFeed = usingPeak2 && feed2Time ? feed2Time : feedTime;
                if (activeFeed) {
                  return Math.max(1,
                    (pendingStart.getTime() - activeFeed.getTime()) / 3600000
                  );
                }
                if (knownPeakTime) {
                  return Math.max(0.5,
                    (pendingStart.getTime() - knownPeakTime.getTime()) / 3600000
                    + getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan')
                  );
                }
                return prefOffsetH;
              })()}
              windowH={windowH}
              prefInFridge={prefGoesInFridge}
              hasColdRetard={hasColdRetard}
              phases={phases}
              scheduleNote={schedule?.scheduleNote ?? null}
              blocks={blocks}
              recommendedMixHBF={recommendedHBF}
              showZoneLabels={zonesOpen}
              hasDragged={hasDragged}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => setIsDragging(false)}
              sweetCenterH={renderSweetCenter}
              sweetFromH={renderSweetFrom}
              sweetToH={renderSweetTo}
              nowHBF={(pendingEatTime.getTime() - Date.now()) / 3600000}
              starterFeedTime={isSourdough
                ? (planningMode === 'know_peak'
                    ? null
                    : starterPillState === 'red' && feed2Time
                      ? feed2Time
                      : usingPeak2
                        ? feed2Time
                        : (lastFedTime ?? feedTime))
                : null}
              starterFeed2Time={
                isSourdough
                  ? (starterPillState === 'red' && feed2Time
                      ? (lastFedTime ?? feedTime)
                      : usingPeak2 ? feedTime : null)
                  : null
              }
              starterFridgeOutTime={isSourdough ? fridgeOutTime : null}
              starterKnownPeakTime={
                isSourdough && planningMode === 'know_peak' ? knownPeakTime : null
              }
              starterIsDepletedAt={isSourdough ? starterIsDepletedAt : null}
              starterRefeedTime={isSourdough ? starterRefeedTime : null}
              starterMature={starterMature}
              starterAdjPeakH={isSourdough ? adjPeakHState : null}
              starterRedPill={isSourdough && starterPillState === 'red'}
              starterFeed2OutOfZone={isSourdough && usingPeak2 && starterPillState === 'red'}
              comparisonFridgeOutTime={isSourdough && showFridgeComparison ? suggestedFridgeOutTime : null}
              comparisonFridgePeakTime={isSourdough && showFridgeComparison ? suggestedFridgePeakTime : null}
              showFridgeComparison={isSourdough && showFridgeComparison}
              startTimeInPast={startTimeInPast}
              onMixChange={(h) => {
                hasManuallyDragged.current = true;
                setHasDragged(true);
                setRecommendedHBF(null);
                const newStart = new Date(pendingEatTime.getTime() - h * 3600000);
                if (isSourdough) setMixOverride(true);
                setPendingStart(newStart);
                const bakeMs = pendingEatTime.getTime();
                const inB = blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return h > Math.min(s,e) && h < Math.max(s,e);
                });
                const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
                const bulkEndHBF = h - typicalBulkH;
                const bulkEndInB = !inB && bulkEndHBF > 0 && blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return bulkEndHBF > Math.min(s,e) && bulkEndHBF < Math.max(s,e);
                });
                const fmtBulkDur = (h: number) => h === 0.5 ? '30min' : h === 0.75 ? '45min' : '1h30';
                const fmtBulkTime = (hbf: number) => new Date(bakeMs - hbf * 3600000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                setBlockerNote(
                  inB ? tRoot('schedulePicker.blockerNote')
                  : bulkEndInB ? tRoot('schedulePicker.bulkNote', { dur: fmtBulkDur(typicalBulkH), time: fmtBulkTime(bulkEndHBF) })
                  : null
                );
                onChange(newStart, pendingEatTime, blocks);
              }}
              onPrefChange={(offsetH) => {
                hasManuallyDragged.current = true;
                setHasDragged(true);
                setPrefAlgoRed(false);
                if (isSourdough) {
                  const bakeMs = pendingEatTime.getTime();
                  const feedAbsHBF = mixOffsetH + offsetH;
                  const newFeedTime = new Date(bakeMs - feedAbsHBF * 3600000);
                  if (usingPeak2 && adjPeakHState) {
                    // Feed 2 drag cascades: peak is adjPeakH after feed → mix aligns with peak
                    const newMixHBF = Math.max(_minTotalRT, feedAbsHBF - adjPeakHState);
                    const newMixTime = new Date(bakeMs - newMixHBF * 3600000);
                    setFeed2Time(newFeedTime);
                    onFeed2TimeChange?.(newFeedTime);
                    const inZone = newMixHBF >= renderSweetTo && newMixHBF <= renderSweetFrom;
                    setStarterPillState(inZone ? 'green' : 'yellow');
                    setPendingStart(newMixTime);
                    onChange(newMixTime, pendingEatTime, blocks);
                  } else {
                    // Single cycle: update feed, trigger solver re-run via lastFedTime
                    setFeedTime(newFeedTime);
                    onFeedTimeChange?.(newFeedTime);
                    onLastFedTimeChange?.(newFeedTime);
                  }
                } else {
                  setPrefOffsetH(offsetH);
                  onPrefOffsetChange?.(offsetH);
                }
              }}
            />
          )
        ) : (
          <div style={{
            textAlign: 'center', fontFamily: 'var(--font-dm-mono)',
            fontSize: '.9rem', color: 'var(--smoke)',
            padding: '1.5rem 0', letterSpacing: '.01em',
          }}>
            {t('setByPlan')}
          </div>
        )}

      </div>

      {eatTimeSet && (
        <div style={{ marginTop: '6px', marginBottom: '.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Drag hint — always visible, disappears after first drag */}
          {!hasDragged && mode !== 'simple' && !startTimeInPast && (
            <div style={{
              textAlign: 'center', fontSize: '11px',
              color: '#8A7F78', fontFamily: 'DM Sans, sans-serif',
              fontStyle: 'italic',
            }}>
              {locale === 'fr'
                ? '← Glissez les losanges pour ajuster vos horaires →'
                : '← Drag the diamonds to adjust your schedule →'}
            </div>
          )}

          {/* Show timing guide checkbox — Custom mode only */}
          {mode !== 'simple' && <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', fontSize: '12px',
            color: '#8A7F78', fontFamily: 'DM Sans, sans-serif',
          }}>
            <input
              type="checkbox"
              checked={zonesOpen}
              onChange={e => setZonesOpen(e.target.checked)}
              style={{ width: '14px', height: '14px', accentColor: 'var(--terra)', cursor: 'pointer' }}
            />
            {locale === 'fr' ? 'Afficher le guide' : 'Show timing guide'}
          </label>}

          {/* Instructions — only shown when zonesOpen */}
          {zonesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '22px' }}>
              <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>
                <span style={{ color: '#3D5A30', fontWeight: 600 }}>◆ {t('adjustDoughLabel')}</span>{' '}
                {t('adjustDoughVerb')}
              </div>
              {hasPrefActive && (
                <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>
                  <span style={{ color: '#C4A030', fontWeight: 600 }}>◇ {prefLabel}:</span>{' '}
                  {t('adjustPrefVerb')}
                </div>
              )}
            </div>
          )}

          {/* Reset link — only when dragged and not a past session */}
          {hasDragged && !startTimeInPast && (
            <button
              onClick={() => {
                hasManuallyDragged.current = false;
                setHasDragged(false);
                computeAndApplyRecommendation(blocks, pendingEatTime);
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--smoke)', fontSize: '.72rem',
                fontFamily: 'var(--font-dm-mono)',
                textDecoration: 'underline', textUnderlineOffset: '2px',
                padding: 0, textAlign: 'left',
              }}
            >
              {locale === 'fr' ? '↺ Revenir à la recommandation' : '↺ Reset to recommendation'}
            </button>
          )}

          {/* Read-only note — past sessions */}
          {startTimeInPast && (
            <div style={{
              fontSize: '.75rem', color: 'var(--smoke)',
              fontFamily: 'var(--font-dm-mono)',
              textAlign: 'center', padding: '.4rem 0',
            }}>
              {locale === 'fr'
                ? "Programme enregistré — modifiez l'heure de cuisson pour replanifier"
                : 'Saved schedule — edit your bake time to replan'}
            </div>
          )}

        </div>
      )}

      {/* ── Message cards: State 0 (bake in blocker), State 1 (fallback), State 2 (blocker note), State 3 (bulk conflict) ── */}

      {/* State 0 — bake time falls in a blocker */}
      {bakeTimeInBlocker && eatTimeSet && (
        <div style={{
          background: 'var(--cream)',
          borderLeft: '4px solid var(--gold)',
          borderRadius: '10px',
          padding: '.65rem 1rem',
          marginBottom: '.75rem',
          fontFamily: 'var(--font-dm-sans)',
          fontSize: '.82rem',
          color: 'var(--ash)',
        }}>
          {locale === 'fr'
            ? "Votre heure de cuisson tombe dans une plage occupée — visiblement, le four passe avant tout."
            : "Your bake time falls in one of your busy windows — looks like the oven wins."}
        </div>
      )}
      {showFallbackPopup && fallbackOptions && (
        <div style={{
          background: 'var(--cream)', borderLeft: '4px solid var(--terra)',
          borderRadius: '10px', padding: '.75rem 1rem',
          marginBottom: '.75rem', fontFamily: 'var(--font-dm-sans)',
        }}>
          <div style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.4rem' }}>
            No free mixing window found
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--smoke)', marginBottom: '.75rem', lineHeight: 1.5 }}>
            Your blocked times don&apos;t leave a clear mixing window. Here are your options:
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {fallbackOptions.outsideZone && (
              <button
                onClick={() => {
                  const { mixHBF } = fallbackOptions!.outsideZone!;
                  const newStart = new Date(pendingEatTime.getTime() - mixHBF * 3600000);
                  setPendingStart(newStart);
                  setRecommendedHBF(mixHBF);
                  onChange(newStart, pendingEatTime, blocks);
                  setShowFallbackPopup(false);
                }}
                style={{
                  background: 'var(--terra)', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '.4rem .9rem', fontSize: '.78rem',
                  fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  marginBottom: '8px',
                }}
              >
                <div>{tRoot('schedulePicker.fallbackBtn1')}</div>
                <div style={{ fontSize: '.74rem', marginTop: '2px', opacity: 0.8 }}>{tRoot('schedulePicker.fallbackBtn1Sub')}</div>
              </button>
            )}
            {fallbackOptions.inBlocker && (
              <button
                onClick={() => {
                  const bakeMs = pendingEatTime.getTime();
                  const scFrom = renderSweetFrom;
                  const scTo   = renderSweetTo;
                  const sc = (scFrom + scTo) / 2;
                  let bestHBF = sc;
                  let bestDist = Infinity;
                  for (const b of blocks) {
                    const edgeStart = (bakeMs - b.from.getTime()) / 3600000;
                    const edgeEnd   = (bakeMs - b.to.getTime())   / 3600000;
                    for (const edge of [edgeStart, edgeEnd]) {
                      const dist = Math.abs(edge - sc);
                      if (dist < bestDist) { bestDist = dist; bestHBF = edge; }
                    }
                  }
                  const newStart = new Date(bakeMs - bestHBF * 3600000);
                  setPendingStart(newStart);
                  setRecommendedHBF(null);
                  onChange(newStart, pendingEatTime, blocks);
                  setShowFallbackPopup(false);
                }}
                style={{
                  background: 'transparent', color: 'var(--smoke)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '.4rem .9rem', fontSize: '.78rem',
                  cursor: 'pointer', textAlign: 'left',
                  marginBottom: '12px',
                }}
              >
                <div>{tRoot('schedulePicker.fallbackBtn2')}</div>
                <div style={{ fontSize: '.74rem', marginTop: '2px', opacity: 0.8 }}>{tRoot('schedulePicker.fallbackBtn2Sub')}</div>
              </button>
            )}
            <button
              onClick={() => {
                setShowFallbackPopup(false);
                hasManuallyDragged.current = true;
                setHasDragged(true);
              }}
              style={{
                background: 'transparent', color: 'var(--smoke)',
                border: 'none', fontSize: '.78rem', cursor: 'pointer', padding: '.4rem 0',
              }}
            >
              I&apos;ll set it myself
            </button>
          </div>
        </div>
      )}

      {bulkConflict && !dismissedConflict && (() => {
        const MIN_REASONABLE_HOUR = 7;
        const earlierStart = bulkConflict.suggestedEarlierStart;
        const earlierIsReasonable = earlierStart
          ? earlierStart.getHours() >= MIN_REASONABLE_HOUR
          : false;
        return (
          <div style={{
            background: 'var(--cream)', borderLeft: '4px solid var(--terra)',
            borderRadius: '10px', padding: '.75rem 1rem',
            marginBottom: '.75rem', fontFamily: 'var(--font-dm-sans)',
          }}>
            {earlierIsReasonable && earlierStart ? (
              <>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.2rem' }}>
                  Your bulk fermentation begins during a busy window.
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--smoke)', lineHeight: 1.5, marginBottom: '.65rem' }}>
                  Start dough at {formatSliderDisplay(earlierStart, isFr)} so you can kick off bulk fermentation while you&apos;re free.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.2rem' }}>
                  Your bulk fermentation will run into your busy window.
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--smoke)', lineHeight: 1.5, marginBottom: '.65rem' }}>
                  Your dough will still be worth it — the flavour develops regardless.
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {earlierIsReasonable && earlierStart && (
                <button
                  onClick={() => {
                    adjustStart(-(bulkConflict.suggestEarlierByMin / 60));
                    setDismissedConflict(true);
                  }}
                  style={{
                    background: 'var(--terra)', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '.4rem .9rem',
                    fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  Start at {formatSliderDisplay(earlierStart, isFr)} →
                </button>
              )}
              <button
                onClick={() => setDismissedConflict(true)}
                style={{
                  background: 'transparent', color: 'var(--smoke)',
                  border: '1px solid var(--border)', borderRadius: '8px', padding: '.4rem .9rem',
                  fontSize: '.78rem', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                }}
              >
                {earlierIsReasonable && earlierStart ? tRoot('schedulePicker.keepAsIs') : tRoot('schedulePicker.gotIt')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Info cards (pref + mix start times) — custom mode only ── */}
      {startComputed && mode !== 'simple' && (() => {
        const isLevainType = prefermentType === 'levain' || isSourdough;
        const cardPrefColor = isLevainType ? '#4A7FA5' : '#C4A030';
        // Single source of truth — same functions used by graph zone and recommendation
        const prefOptHCard  = getPrefOptH(prefermentType, kitchenTemp, prefGoesInFridge, styleKey ?? 'neapolitan', fridgeTemp);
        const prefMaxHCard  = prefermentType === 'biga' ? 72 : prefGoesInFridge ? 24 : prefRTPeakH * 1.5;
        // Fridge: 3h regardless of temp (needs time to cool then start fermenting).
        // RT: ~25% of peak time — climate-sensitive minimum for meaningful fermentation.
        // e.g. 30°C peak=4h → min=1h, 22°C peak=9h → min=2h, 18°C peak=13h → min=3h
        const prefMinHCard = prefGoesInFridge ? 3 : Math.max(1, Math.round(prefRTPeakH * 0.25));
        // Plateau half-width: poolish fridge ±3h upper / +5h lower (asymmetric), biga ±10h, RT ±0
        const fridgePlateauH    = prefGoesInFridge ? (prefermentType === 'biga' ? 10 : 3) : 0;
        const cardPrefPlateauH_LOW = prefGoesInFridge && prefermentType === 'poolish' ? 5 : fridgePlateauH;
        // Climate-aware RT zones — absolute hour offsets, not percentages.
        // rtPeakH is already climate-sensitive (4h at 30°C, 11h at 18°C).
        // Green: at or just past peak (±1.5h window)
        // Developing: 3h → peak (still rising — valid but not optimal)
        // EarlyOk: peak+1.5h → maxH (just past peak — still usable)
        // Climate-sensitive: RT poolish curve is steeper at high temp → narrower
        // safe window. Symmetric: a poolish 1h before peak is as usable as 1h after.
        const RT_PEAK_TOLERANCE = kitchenTemp >= 30 ? 0.5
                                : kitchenTemp >= 28 ? 0.75
                                : kitchenTemp >= 24 ? 1.0
                                : 1.5;
        // Green zone = plateau only: optH-plateauH_LOW → optH+plateauH (fridge, asymmetric) or optH-tol → optH+tolUpper (RT)
        // Developing zone = viable but not yet at peak: 3h → plateau start
        const RT_PEAK_TOLERANCE_UPPER = kitchenTemp >= 30 ? 0.75
                                      : kitchenTemp >= 28 ? 1.0
                                      : kitchenTemp >= 24 ? 1.5
                                      : 2.0;
        const cardPrefInZone = prefGoesInFridge
          ? hasPrefActive && prefOffsetH >= prefOptHCard - cardPrefPlateauH_LOW && prefOffsetH <= prefOptHCard + fridgePlateauH
          : hasPrefActive && prefOffsetH >= prefOptHCard - RT_PEAK_TOLERANCE && prefOffsetH <= prefOptHCard + RT_PEAK_TOLERANCE_UPPER;
        const cardPrefEarlyOk = prefGoesInFridge
          ? hasPrefActive && prefOffsetH > prefOptHCard + fridgePlateauH && prefOffsetH <= prefMaxHCard
          : hasPrefActive && prefOffsetH > prefOptHCard + RT_PEAK_TOLERANCE_UPPER && prefOffsetH <= prefMaxHCard;
        // Developing = viable but not yet at peak (both fridge and RT)
        const cardPrefDeveloping = hasPrefActive
          && prefOffsetH >= prefMinHCard
          && (prefGoesInFridge
            ? prefOffsetH < prefOptHCard - cardPrefPlateauH_LOW
            : prefOffsetH < prefOptHCard);
        const cardPrefTooEarly  = hasPrefActive && prefOffsetH > prefMaxHCard;
        const cardPrefLateOk    = hasPrefActive && prefOffsetH >= 0.25 && prefOffsetH < prefMinHCard;
        // For RT: use cardPrefDeveloping instead of cardPrefLateOk for 3h→peak*0.8 range
        const cardPrefTooShort  = hasPrefActive && prefOffsetH < 1;
        // Protocol already shown via ❄/🌡 indicator below diamond — not repeated in pill
        const cardPrefStatus = cardPrefInZone      ? tRoot('schedulePicker.prefReadyAtMix')
          : cardPrefEarlyOk                        ? tRoot('schedulePicker.prefEarlyOk')
          : cardPrefDeveloping                     ? tRoot('schedulePicker.prefLateOk')
          : cardPrefLateOk                         ? tRoot('schedulePicker.prefTooLate')
          : cardPrefTooShort                        ? tRoot('schedulePicker.prefTooShortTime')
          :                                          tRoot('schedulePicker.prefTooEarly');
        const cardPrefTime = hasPrefActive
          ? new Date(pendingEatTime.getTime() - (mixOffsetH + prefOffsetH) * 3600000)
          : null;
        const doughZoneFrom = renderSweetFrom;
        const doughZoneTo   = renderSweetTo;
        const mixInZone    = mixOffsetH >= doughZoneTo && mixOffsetH <= doughZoneFrom;
        const sourdoughDoughGreen  = isSourdough && mixOffsetH >= doughZoneTo && mixOffsetH <= doughZoneFrom;
        const sourdoughDoughYellow = isSourdough && !sourdoughDoughGreen
          && mixOffsetH >= doughZoneTo - 2 && mixOffsetH <= doughZoneFrom + 2;
        // Gold zones: use yellowTo (already computed) for right edge,
        // mirror symmetrically for left gold
        const doughGoldRightTo  = renderYellowTo;
        const doughGoldLeftFrom = doughZoneFrom + (doughZoneFrom - doughZoneTo) * 0.2;
        const mixEarlyOk  = !mixInZone && mixOffsetH > doughZoneFrom && mixOffsetH <= doughGoldLeftFrom;
        const mixTooEarly = !mixInZone && mixOffsetH > doughGoldLeftFrom;
        const mixLateOk   = !mixInZone && mixOffsetH < doughZoneTo && mixOffsetH >= doughGoldRightTo;
        const mixTooLate  = mixOffsetH < doughGoldRightTo;
        const mixStatus =
          mixInZone   ? tRoot('schedulePicker.doughReadyAtBake')
          : mixEarlyOk  ? tRoot('schedulePicker.doughEarlyOk')
          : mixTooEarly ? tRoot('schedulePicker.doughPeaksBefore')
          : mixLateOk   ? tRoot('schedulePicker.doughLateOk')
          : tRoot('schedulePicker.doughPeaksAfter');
        const bakeMs = pendingEatTime.getTime();
        const mixInBlocker = !mixInZone && mixOffsetH > 0 && blocks.some(b => {
          const s2 = (bakeMs - b.from.getTime()) / 3600000;
          const e2 = (bakeMs - b.to.getTime())   / 3600000;
          return mixOffsetH >= Math.min(s2, e2) && mixOffsetH <= Math.max(s2, e2);
        });
        return (
          <div style={{ display: 'flex', gap: '6px', marginTop: '1rem', flexWrap: 'wrap', justifyContent: (cardPrefTime || isSourdough) ? 'flex-start' : 'center' }}>

            {/* ── Sourdough Starter Plan card ── */}
            {isSourdough && startComputed && (() => {
              const peakH     = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
              const ratioMult = 1 + 0.35 * Math.log(feedRatio);
              const ryeF      = starterHasRye ? 0.8 : 1.0;
              const matF      = starterMature ? 1.0 : 1.2;
              const adjPeakH  = peakH * ryeF * matF * ratioMult;
              const troughH   = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMult;
              const warmupH   = getStarterFridgeWarmupH(kitchenTemp);
              const mixTime   = pendingStart;

              const activePeakTime: Date | null =
                planningMode === 'know_peak' && knownPeakTime
                  ? knownPeakTime
                  : feedTime
                    ? (starterLocation === 'fridge' && fridgeOutTime
                        ? new Date(fridgeOutTime.getTime() + warmupH * 3600000)
                        : new Date(feedTime.getTime() + adjPeakH * 3600000))
                    : null;

              const feedPlan: { ft: Date; label: string; note?: string }[] = [];

              if (planningMode === 'last_fed' && lastFedTime && activePeakTime) {
                const now = new Date();
                if (!usingPeak2) {
                  if (lastFedTime > now) {
                    feedPlan.push({
                      ft: lastFedTime,
                      label: isFr ? 'Nourrir' : 'Feed',
                      note: undefined,
                    });
                  }
                  const lastFeedNeeded = new Date(mixTime.getTime() - adjPeakH * 3600000);
                  const gapH = (lastFeedNeeded.getTime() - now.getTime()) / 3600000;
                  const numExtra = Math.floor(gapH / troughH);
                  if (numExtra > 0) {
                    feedPlan.length = 0;
                    for (let i = 0; i <= numExtra; i++) {
                      const ft = new Date(now.getTime() + i * troughH * 3600000);
                      const h = ft.getHours();
                      if (h < 7) { ft.setHours(7, 0, 0, 0); }
                      else if (h > 22) { ft.setHours(7, 0, 0, 0); ft.setDate(ft.getDate() + 1); }
                      const isLast = i === numExtra;
                      const nextFt = new Date(ft.getTime() + troughH * 3600000);
                      feedPlan.push({
                        ft,
                        label: isLast
                          ? (isFr ? 'Dernier repas' : 'Last feed')
                          : (isFr ? `Repas ${i + 1}` : `Feed ${i + 1}`),
                        note: isLast
                          ? (isFr
                              ? `Pic vers ${fmtCardHM(new Date(ft.getTime() + adjPeakH * 3600000), isFr)}`
                              : `Peak around ${fmtCardHM(new Date(ft.getTime() + adjPeakH * 3600000), isFr)}`)
                          : (isFr
                              ? `Prochain repas vers ${fmtCardHM(nextFt, isFr)}`
                              : `Next feed around ${fmtCardHM(nextFt, isFr)}`),
                      });
                    }
                  }
                } else if (usingPeak2 && feed2Time) {
                  feedPlan.push({
                    ft: feed2Time,
                    label: isFr ? 'Prochain repas' : 'Next Feed',
                    note: (() => {
                      const isRefeedNow = Math.abs(feed2Time.getTime() - Date.now()) < 30 * 60 * 1000;
                      return isRefeedNow
                        ? (isFr ? 'Nourrir maintenant pour un pic plus fort' : 'Feed now for a stronger peak')
                        : (isFr ? 'Repas actif pour cette cuisson' : 'Active feed for this bake');
                    })(),
                  });
                }
              }


              return (
                <div style={{
                  flex: 1, minWidth: '140px',
                  background: 'var(--cream)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px', padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.6rem' }}>
                    <div style={{ width: 8, height: 8, background: '#4A7FA5', transform: 'rotate(45deg)', flexShrink: 0 }} />
                    <div style={{
                      fontSize: '13px', color: 'var(--smoke)',
                      fontFamily: 'var(--font-dm-mono)',
                      textTransform: 'uppercase', letterSpacing: '.04em',
                    }}>
                      {isFr ? 'LEVAIN' : 'STARTER'}
                    </div>
                  </div>

                  {feedPlan.length === 0 && lastFedTime && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.7 }}>
                        {isFr ? 'DERNIER REPAS' : 'LAST FED'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', opacity: 0.7 }}>
                        {fmtCardDT(lastFedTime, isFr)}
                      </div>
                    </div>
                  )}
                  {feedPlan.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', marginBottom: '.6rem' }}>
                      {feedPlan.map((fp, i) => (
                        <div key={i}>
                          <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            {fp.label}
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                            {fmtCardDT(fp.ft, isFr)}
                          </div>
                          {fp.note && (
                            <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '1px' }}>
                              {fp.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {starterLocation === 'fridge' && fridgeOutTime && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isFr ? 'SORTIR DU FRIGO' : 'REMOVE FROM FRIDGE'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                        {fmtCardHM(fridgeOutTime, isFr)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '1px' }}>
                        {isFr
                          ? `~${Math.round(warmupH * 60)} min pour atteindre la temp. ambiante`
                          : `~${Math.round(warmupH * 60)} min to reach room temp`}
                      </div>
                    </div>
                  )}

                  {activePeakTime && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isFr ? 'PIC' : 'PEAK'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                        {fmtCardHM(activePeakTime, isFr)}
                      </div>
                    </div>
                  )}

                  {fridgeSuggestion && starterLocation === 'rt' && (
                    <div style={{
                      fontSize: '11px',
                      color: '#78350F',
                      fontFamily: 'var(--font-dm-sans)',
                      lineHeight: 1.5,
                      marginBottom: '.5rem',
                      padding: '.4rem .6rem',
                      background: '#FEF3C7',
                      borderRadius: '6px',
                      border: '1px solid #FDE68A',
                    }}>
                      {fridgeSuggestion}
                    </div>
                  )}

                  {(() => {
                    const pillGreen  = starterPillState === 'green';
                    const pillYellow = starterPillState === 'yellow';
                    const pillText =
                      starterPillState === 'green'
                        ? (usingPeak2
                            ? (isFr ? 'Pic 2 — saveur plus complexe' : 'Second peak — stronger flavour')
                            : (isFr ? 'Prêt au mélange' : 'Ready at mix'))
                        : starterPillState === 'yellow'
                        ? (fridgeOutTime && !usingPeak2
                            ? (isFr
                                ? `Sortir du frigo à ${fmtCardHM(fridgeOutTime, isFr)}`
                                : `Remove from fridge at ${fmtCardHM(fridgeOutTime, isFr)}`)
                            : (isFr ? 'En cours de montée' : 'Still developing'))
                        : (refeedSuggestion
                            ? (isFr
                                ? `Nourrir à ${fmtCardDT(refeedSuggestion, true)}`
                                : `Feed at ${fmtCardDT(refeedSuggestion, false)}`)
                            : '');
                    return (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        gap: '.3rem', marginTop: '.3rem',
                        background: pillGreen
                          ? 'rgba(74,122,58,0.1)'
                          : pillYellow
                            ? 'rgba(212,168,83,0.15)'
                            : 'rgba(196,82,42,0.1)',
                        border: `1px solid ${pillGreen
                          ? 'rgba(74,122,58,0.3)'
                          : pillYellow
                            ? 'rgba(212,168,83,0.4)'
                            : 'rgba(196,82,42,0.3)'}`,
                        borderRadius: '20px',
                        padding: '.15rem .55rem',
                        fontSize: '11px',
                        color: pillGreen ? '#4A7A3A' : pillYellow ? '#9A7010' : '#C4522A',
                        fontFamily: 'var(--font-dm-mono)',
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: pillGreen ? '#4A7A3A' : pillYellow ? '#9A7010' : '#C4522A',
                          flexShrink: 0,
                        }} />
                        {pillText}
                      </div>
                    );
                  })()}

                  {starterStateNote && starterPillState !== 'red' && (
                    <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5, marginTop: '.5rem' }}>
                      {starterStateNote}
                    </div>
                  )}
                  {driftNote && (
                    <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5, marginTop: '.4rem' }}>
                      {driftNote}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Pref card */}
            {!isSourdough && (cardPrefTime || (hasPrefActive && (skipPoolishNote || prefAlgoRed))) && (
              <div style={{
                flex: 1, minWidth: '120px',
                background: 'var(--cream)', border: '1.5px solid var(--border)',
                borderRadius: '10px', padding: '14px 16px',
                opacity: (skipPoolishNote || prefAlgoRed) ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
                  <div style={{ width: 8, height: 8, background: cardPrefColor, transform: 'rotate(45deg)', flexShrink: 0 }} />
                  <div style={{
                    fontSize: '13px', color: 'var(--smoke)',
                    fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em',
                  }}>{prefLabel}</div>
                </div>
                {(skipPoolishNote || prefAlgoRed) ? (
                  <div style={{ fontSize: '12px', color: 'var(--smoke)', lineHeight: 1.5, marginTop: '6px' }}>
                    {locale === 'fr'
                      ? `Fenêtre trop courte pour un ${prefermentType} — votre pâte fermentera directement et sera délicieuse.`
                      : `Window too short for ${prefermentType} — your dough will ferment directly and still taste great.`}
                  </div>
                ) : editingPref ? (
                  <input
                    type="datetime-local"
                    defaultValue={cardPrefTime!.toISOString().slice(0,16)}
                    autoFocus
                    onBlur={e => {
                      const t = new Date(e.target.value);
                      if (!isNaN(t.getTime())) {
                        const newPrefOffsetH = (pendingStart.getTime() - t.getTime()) / 3600000;
                        if (newPrefOffsetH >= 0) onPrefOffsetChange?.(newPrefOffsetH);
                      }
                      setEditingPref(false);
                    }}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingPref(false); }}
                    style={{
                      fontSize: '13px', padding: '4px 6px', borderRadius: '6px',
                      border: '1.5px solid var(--terra)', background: 'var(--warm)',
                      color: 'var(--char)', fontFamily: 'var(--font-dm-mono)',
                      width: '100%', outline: 'none',
                    }}
                  />
                ) : (
                  <div
                    onClick={() => setEditingPref(true)}
                    style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', cursor: 'text' }}
                  >
                    {fmtCardDT(cardPrefTime!, isFr)}
                  </div>
                )}
                {!(skipPoolishNote || prefAlgoRed) && (() => {
                  const isGreen  = cardPrefInZone;
                  const isGold   = cardPrefEarlyOk || cardPrefLateOk;
                  const isRed    = cardPrefTooEarly || cardPrefTooShort;
                  const bg     = isGreen ? 'rgba(74,122,58,0.1)'   : isGold ? 'rgba(212,168,83,0.15)' : 'rgba(196,82,42,0.1)';
                  const border = isGreen ? 'rgba(74,122,58,0.3)'   : isGold ? 'rgba(212,168,83,0.4)'  : 'rgba(196,82,42,0.3)';
                  const color  = isGreen ? '#4A7A3A'               : isGold ? '#9A7010'               : '#C4522A';
                  return (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                      marginTop: '.3rem',
                      background: bg, border: `1px solid ${border}`,
                      borderRadius: '20px', padding: '.15rem .55rem',
                      fontSize: '11px', color, fontFamily: 'var(--font-dm-mono)',
                    }}>
                      {cardPrefStatus}
                    </div>
                  );
                })()}
                {(() => {
                  if (!prefGoesInFridge || prefermentType !== 'poolish' || prefRTWarmupH <= 0) return null;
                  const removeMs = pendingEatTime.getTime() - (mixOffsetH + prefRTWarmupH) * 3600000;
                  const removeDate = new Date(removeMs);
                  const inBlock = blocks.find(b => removeDate >= b.from && removeDate < b.to);
                  if (!inBlock) return null;
                  const delayMin = Math.round(((inBlock.to.getTime() - removeMs) / 3600000) * 60 / 15) * 15;
                  return (
                    <div style={{ fontSize: '11px', color: '#7A5A10', marginTop: '5px', lineHeight: 1.5 }}>
                      Remove from fridge at {formatTimeShort(removeDate, isFr)} — falls in your busy window.
                      {delayMin > 0 && ` Moving Start Dough ${delayMin} min later would clear it.`}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Mix card */}
            <div style={{
              background: 'var(--cream)', border: '1.5px solid var(--border)',
              borderRadius: '10px', padding: '14px 16px',
              ...(cardPrefTime ? { flex: 1, minWidth: '120px' } : { minWidth: '160px', maxWidth: '260px' }),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
                <div style={{ width: 8, height: 8, background: '#3D5A30', transform: 'rotate(45deg)', flexShrink: 0 }} />
                <div style={{
                  fontSize: '13px', color: 'var(--smoke)',
                  fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em',
                }}>{tRoot('schedulePicker.startDough')}</div>
              </div>
              {editingMix ? (
                <input
                  type="datetime-local"
                  defaultValue={pendingStart.toISOString().slice(0,16)}
                  autoFocus
                  onBlur={e => {
                    const t = new Date(e.target.value);
                    if (!isNaN(t.getTime())) {
                      const newMixOffsetH = (pendingEatTime.getTime() - t.getTime()) / 3600000;
                      if (newMixOffsetH >= 0.5) {
                        const newStart = new Date(t);
                        setPendingStart(newStart);
                        onChange(newStart, pendingEatTime, blocks);
                      }
                    }
                    setEditingMix(false);
                  }}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingMix(false); }}
                  style={{
                    fontSize: '13px', padding: '4px 6px', borderRadius: '6px',
                    border: '1.5px solid var(--terra)', background: 'var(--warm)',
                    color: 'var(--char)', fontFamily: 'var(--font-dm-mono)',
                    width: '100%', outline: 'none',
                  }}
                />
              ) : (
                <div
                  onClick={() => setEditingMix(true)}
                  style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', cursor: 'text' }}
                >
                  {fmtCardDT(pendingStart, isFr)}
                </div>
              )}
              {(() => {
                const pillGreen  = isSourdough ? sourdoughDoughGreen  : mixInZone;
                const pillYellow = isSourdough ? sourdoughDoughYellow : (mixEarlyOk || mixLateOk);
                const pillText   = isSourdough
                  ? (sourdoughDoughGreen
                      ? (isFr ? 'Levain à son pic' : 'Starter peaks at mix')
                      : sourdoughDoughYellow
                        ? (isFr ? 'Levain en montée' : 'Starter still rising')
                        : (isFr ? 'Levain pas encore prêt' : 'Starter not yet ready'))
                  : mixStatus;
                return (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                    marginTop: '.3rem',
                    background: pillGreen ? 'rgba(74,122,58,0.1)' : pillYellow ? 'rgba(212,168,83,0.15)' : 'rgba(196,82,42,0.1)',
                    border: `1px solid ${pillGreen ? 'rgba(74,122,58,0.3)' : pillYellow ? 'rgba(212,168,83,0.4)' : 'rgba(196,82,42,0.3)'}`,
                    borderRadius: '20px',
                    padding: '.15rem .55rem',
                    fontSize: '11px',
                    color: pillGreen ? '#4A7A3A' : pillYellow ? '#9A7010' : '#C4522A',
                    fontFamily: 'var(--font-dm-mono)',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: pillGreen ? '#4A7A3A' : pillYellow ? '#9A7010' : '#C4522A',
                      flexShrink: 0,
                    }} />
                    {pillText}
                  </div>
                );
              })()}
              {mixInBlocker && (
                <div style={{ fontSize: '11px', color: '#7A5A10', marginTop: '4px', lineHeight: 1.4 }}>
                  Within a blocked window — intentional?
                </div>
              )}
              {blockerNote && !mixInBlocker && (
                <div style={{ fontSize: '11px', color: '#7A5A10', marginTop: '5px', lineHeight: 1.5 }}>
                  {blockerNote}
                </div>
              )}
              {/* scheduleNote removed — info available in timeline */}
            </div>
          </div>
        );
      })()}


      {/* scheduleNote moved into Start Dough card */}

      </>)}



      {startInvalid && (
        <div style={{
          fontSize: '.78rem', color: 'var(--terra)',
          background: '#FEF4EF', border: '1px solid #F5C4B0',
          borderRadius: '8px', padding: '.5rem .85rem',
          marginBottom: '.75rem', marginTop: '.5rem',
        }}>
          {t('startBeforeBake')}
        </div>
      )}

      </div>)} {/* end eatTimeSet */}

    </div>
  );
}
