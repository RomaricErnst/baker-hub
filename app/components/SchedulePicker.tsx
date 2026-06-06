'use client';
import { useState, useMemo, useEffect, useRef, useId } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type AvailabilityBlock, type ScheduleResult, hoursLabel } from '../utils';
import FermentChart, { getPrefOptH, getPrefPeakH_RT, getPrefRTWarmupH, getStarterTroughH, getStarterFridgeWarmupH } from './FermentChart';

export type StarterEventKind =
  | 'last_fed'
  | 'refresh'
  | 'intermediate_refresh'
  | 'pre_mix'
  | 'fridge_in'
  | 'fridge_out'
  | 'known_peak'
  ;

export interface StarterEvent {
  kind: StarterEventKind;
  time: Date;
  isPast: boolean;
  isActive: boolean;
  isDraggable: boolean;
  label: string;
  cardTimeFormat: 'relative' | 'absolute';
  cardNote?: string;
  bellStyle: 'none' | 'solid' | 'dotted' | 'historical_dotted';
  bellPeakTime?: Date;
  bellStartTime?: Date;
  bellSigmaScale: number;
}

interface SourdoughSolverResult {
  usingPeak2:           boolean;
  hasFutureFeedPath:    boolean;
  starterPillState:     'green' | 'yellow' | 'red';
  driftNote:            string | null;
  starterRefeedTime:    Date | null;
  starterStateNote:     string | null;
  fridgeSuggestion:     string | null;
  suggestedFridgeOutTime: Date | null;
  suggestedFridgePeakTime: Date | null;
  showFridgeComparison: boolean;
  adjPeakHValue:        number | null;
  sourdoughSweetFrom:   number | null;
  sourdoughSweetTo:     number | null;
  starterIsDepletedAt:  Date | null;
  windowTooShort:       boolean;
  suggestedBakeTime:    Date | null;
  feed2Time:            Date | null;
  feedTime:             Date | null;
  fridgeOutTime:        Date | null;
  fridgeFeedTime:       Date | null;
  // Computed FermentChart props
  starterFeedTime:      Date | null;
  starterFeed2Time:     Date | null;
  starterKnownPeakTime: Date | null;
  starterRedPill:       boolean;
  starterFeed2OutOfZone: boolean;
  comparisonFridgeOutTime: Date | null;
  comparisonFridgePeakTime: Date | null;
  starterFridgeInTime:  Date | null;
  peakTime:             Date | null;
  starterIntermediateFeeds: Date[];
  isFridgeHoldPath:        boolean;
  fridgeHoldRefreshTime:   Date | null;
  fridgeHoldInTime:        Date | null;
  fridgeHoldOutTime:       Date | null;
  preMixStretchFactor:     number;
  refreshStretchFactor:    number;
  planExplanation:         string | null;
  starterEvents:           StarterEvent[];
}

interface DerivedStarterState {
  peakTime: Date | null;
  feedTime: Date | null;
  fridgeOut: Date | null;
  suggestedFridgeOut: Date | null;
  suggestedFridgePeak: Date | null;
  showFridgeComparison: boolean;
  fridgeSuggestion: string | null;
  starterIsDepletedAt: Date | null;
  starterRefeedTime: Date | null;
  starterStateNote: string | null;
  adjPeakH: number;
}

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
  onStarterFridgeInTimeChange?: (t: Date | null) => void;
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

// Pre-mix stretch factor: when pre-mix feed happens BEFORE refresh peak,
// starter yeast population isn't fully matured → pre-mix peak takes longer.
// 0h early = 1.0 (sweet spot), 1h early = 1.1, 2h early = 1.2 (max).
// At-or-after refresh peak = 1.0 (no stretch).
function computePreMixStretchFactor(preMixMs: number, refreshPeakMs: number | null): number {
  if (refreshPeakMs == null) return 1.0;
  const gapH = (preMixMs - refreshPeakMs) / 3600000;
  if (gapH >= 0) return 1.0;
  const hoursEarly = Math.min(2, Math.abs(gapH));
  return 1.0 + 0.1 * hoursEarly;
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
  const barId = useId().replace(/:/g, '');
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
              <clipPath key={i} id={`sbc-${barId}-${i}`}>
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
              <g clipPath={`url(#sbc-${barId}-${i})`}>
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
export default function SchedulePicker({ startTime, eatTime, blocks, preheatMin, styleKey, kitchenTemp, schedule, onChange, bakeType = 'pizza', isSourdough = false, onFeedTimeChange, prefermentType = 'none', onPrefOffsetChange, onPrefGoesInFridgeChange, onFridgeOutTimeChange, onUsingPeak2Change, onFeed2TimeChange, onStarterFridgeInTimeChange, onStarterStateChange, starterLocation: starterLocationProp, planningMode: planningModeProp, lastFedTime: lastFedTimeProp, knownPeakTime: knownPeakTimeProp, onStarterLocationChange, onPlanningModeChange, onLastFedTimeChange, onKnownPeakTimeChange, hasNotFedYet: hasNotFedYetProp = null, onHasNotFedYetChange, lastFedAge: lastFedAgeProp, onLastFedAgeChange, feedRatio: feedRatioProp, onFeedRatioChange, onStarterPeakTimeChange, mode = 'custom', onReady, fridgeTemp = 6, sessionRestored = false, flourStrength = 1.0, startTimeInPast = false }: SchedulePickerProps) {
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
  const [suggestedBakeTimeBread, setSuggestedBakeTimeBread] = useState<Date | null>(null);
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
  const [fridgeOutTime, setFridgeOutTime]       = useState<Date | null>(null);
  const [solverResult, setSolverResult]         = useState<SourdoughSolverResult | null>(null);
  const [refeedSuggestion, setRefeedSuggestion] = useState<Date | null>(null);
  const [mixOverride, setMixOverride]           = useState(false);
  const [hasNotFedYet, setHasNotFedYet]         = useState<boolean | null>(hasNotFedYetProp ?? null);
  const [lastFedAge, setLastFedAge]             = useState<'today'|'yesterday'|'days23'|'days45'|'week'|null>(lastFedAgeProp ?? null);
  const [feedRatio, setFeedRatio]               = useState<1 | 2 | 4 | 5 | 10>(feedRatioProp ?? 1);
  const [showRatioInfo, setShowRatioInfo]       = useState(false);
  const [showStarterTips, setShowStarterTips] = useState(false);

  // Sync sourdough state from props when they change (session restore case).
  // Without this, props restored asynchronously after mount don't reach the
  // solver because state is stuck at initial null/default values.
  useEffect(() => {
    if (lastFedTimeProp !== undefined && lastFedTimeProp !== lastFedTime) {
      setLastFedTime(lastFedTimeProp ?? null);
    }
  }, [lastFedTimeProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (knownPeakTimeProp !== undefined && knownPeakTimeProp !== knownPeakTime) {
      setKnownPeakTime(knownPeakTimeProp ?? null);
    }
  }, [knownPeakTimeProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (starterLocationProp !== undefined && starterLocationProp !== starterLocation) {
      setStarterLocation(starterLocationProp);
    }
  }, [starterLocationProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (planningModeProp !== undefined && planningModeProp !== planningMode) {
      setPlanningMode(planningModeProp);
    }
  }, [planningModeProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lastFedAgeProp !== undefined && lastFedAgeProp !== lastFedAge) {
      setLastFedAge(lastFedAgeProp ?? null);
    }
  }, [lastFedAgeProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (feedRatioProp !== undefined && feedRatioProp !== feedRatio) {
      setFeedRatio(feedRatioProp);
    }
  }, [feedRatioProp]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [localBlocks, setLocalBlocks] = useState<AvailabilityBlock[]>(blocks);

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
    onChange(pendingStart, d, blocks);
  }

  function computeAndApplyRecommendation(
    currentBlocks: AvailabilityBlock[],
    et: Date,
  ) {
    // Reset prefAlgoRed at start — prevents stale state from previous run
    setPrefAlgoRed(false);
    setWindowTooShort(false);
    setSuggestedBakeTimeBread(null);

    // Sourdough uses its own engine — non-sourdough schedule computation must not run
    if (isSourdough) {
      findOptimalPositionSourdough(et);
      return;
    }

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
      if (bakeType === 'bread') {
        const prefColdH  = scaledDefaults.preferredColdH ?? scaledDefaults.coldH ?? 0;
        const minNeededH = prefColdH + minTotalRTLocal + 1;
        const suggested  = new Date(Date.now() + minNeededH * 3600000);
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
        setSuggestedBakeTimeBread(suggested);
      }
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
    setHasDragged(false);
    hasManuallyDragged.current = false;
    if (isSourdough) {
      const sfDef = STYLE_FERM_DEFAULTS[styleKey ?? ''] ?? FERM_FALLBACK;
      const sweetCenter = ((sfDef.preferredColdH ?? sfDef.coldH ?? 0)
        + sfDef.rtH + (sfDef.minTotalFermH ?? 12)) / 2;
      setPendingStart(new Date(pendingEatTime.getTime() - sweetCenter * 3600000));
    }
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
    // Reset drag state so solver picks ideal mix time, not a stale dragged position
    setHasDragged(false);
    hasManuallyDragged.current = false;
    // findOptimalPositionSourdough now calls deriveStarterPeakTime internally
    // and commits a single atomic setSolverResult at every exit point.
    findOptimalPositionSourdough(pendingEatTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFedTime, knownPeakTime, starterLocation, planningMode,
      starterMature, starterHasRye, feedRatio, eatTimeSet, pendingEatTime,
      styleKey, kitchenTemp]);


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
  // Dough peaks at bake when mix is in sweet zone — cold retard duration
  // flexes to match mix position. Outside sweet zone, bell shifts to show
  // under/over fermentation honestly. RT-only styles use fixed _optimalMix.
  const _hasColdRetardStyle = (_sfDef.coldH ?? 0) > 0;
  const renderSweetCenter = _hasColdRetardStyle
    ? Math.max(renderSweetTo, Math.min(mixOffsetH, renderSweetFrom))
    : _optimalMix;
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
  useEffect(() => { setLocalBlocks(blocks); }, [blocks]);
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

    // Sourdough: expand window to always show Feed 1 and active feed diamond
    if (isSourdough) {
      if (lastFedTime) {
        const feed1HBF = (pendingEatTime.getTime() - lastFedTime.getTime()) / 3600000;
        computed = Math.min(120, Math.max(computed, Math.ceil((feed1HBF + 3) / 12) * 12));
      }
      const activeFeedTime = solverResult?.starterFeedTime;
      if (activeFeedTime) {
        const activeFeedHBF = (pendingEatTime.getTime() - activeFeedTime.getTime()) / 3600000;
        computed = Math.min(120, Math.max(computed, Math.ceil((activeFeedHBF + 3) / 12) * 12));
      }
    }

    const nowHBF = (pendingEatTime.getTime() - Date.now()) / 3600000;
    const clipped = isSourdough
      ? computed
      : Math.min(computed, Math.max(mixOffH + 4, nowHBF + 1));

    windowHRef.current = clipped;
    return clipped;
  }, [isDragging, pendingEatTime, pendingStart, prefOffsetH,
      hasPrefActive, isSourdough, lastFedTime, renderSweetFrom, solverResult]);

  // Fixed window start — always covers 5 days before bake regardless of diamond position
  const windowStart = useMemo(() => {
    const fiveDaysBefore = new Date(pendingEatTime.getTime() - 5 * 24 * 3600000);
    const now = new Date();
    const base = fiveDaysBefore > now ? fiveDaysBefore : now;
    if (!isSourdough) return base;
    // Sourdough: extend back to show hist feed bell (lastFedTime may be in the past)
    // and active feed bell (feed2Time may be further back than now)
    const histFeed = solverResult?.starterFeed2Time ?? lastFedTime;
    const activeFeed = solverResult?.starterFeedTime;
    let earliest = base;
    if (histFeed && histFeed < earliest) {
      earliest = new Date(histFeed.getTime() - 2 * 3600000);
    }
    if (activeFeed && activeFeed < earliest) {
      earliest = new Date(activeFeed.getTime() - 2 * 3600000);
    }
    // Never go back more than 6 days
    const sixDaysBefore = new Date(pendingEatTime.getTime() - 6 * 24 * 3600000);
    return earliest < sixDaysBefore ? sixDaysBefore : earliest;
  }, [pendingEatTime, isSourdough, solverResult, lastFedTime]);

  const nights   = useMemo(() => getNightsInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const workdays = useMemo(() => getWorkdaysInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const _effectiveBlocks = isSourdough ? localBlocks : blocks;
  const isWorkActive = _effectiveBlocks.some(b => b.label.startsWith('Work · '));

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

  // ── Sourdough: derive peak time from inputs (returns values, no setState) ──
  function deriveStarterPeakTime(bakeTime: Date, targetMixTime?: Date | null): DerivedStarterState {
    const NULL_RESULT: DerivedStarterState = {
      peakTime: null, feedTime: null, fridgeOut: null,
      suggestedFridgeOut: null, suggestedFridgePeak: null,
      showFridgeComparison: false, fridgeSuggestion: null,
      starterIsDepletedAt: null, starterRefeedTime: null,
      starterStateNote: null, adjPeakH: 0,
    };
    onStarterPeakTimeChange?.(null);
    const peakH = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
    const ryeF  = starterHasRye ? 0.8 : 1.0;
    const matF  = starterMature ? 1.0 : 1.2;
    const ratioMultiplier = 1 + 0.35 * Math.log(feedRatio);
    const adjPeakH = peakH * ryeF * matF * ratioMultiplier;
    const troughH  = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMultiplier;
    const warmupH  = getStarterFridgeWarmupH(kitchenTemp);

    if (planningMode === 'know_peak' && knownPeakTime) {
      onStarterPeakTimeChange?.(knownPeakTime);
      return { ...NULL_RESULT, peakTime: knownPeakTime, adjPeakH, feedTime: lastFedTime ?? null };
    }

    if (planningMode === 'last_fed' && lastFedTime) {
      const now = new Date();
      const hoursSinceFeed = (now.getTime() - lastFedTime.getTime()) / 3600000;

      if (starterLocation === 'fridge' && fridgeOutTime) {
        const peakTime = new Date(fridgeOutTime.getTime() + warmupH * 3600000);
        onStarterPeakTimeChange?.(peakTime);
        return { ...NULL_RESULT, peakTime, feedTime: lastFedTime, fridgeOut: fridgeOutTime, adjPeakH };
      }

      if (starterLocation === 'fridge' && !fridgeOutTime) {
        // No fridgeOutTime set yet — solver's fridge candidate scan will find one.
        // peakTime stays null; solver picks the winning fridgeOut and computes peak.
        onStarterPeakTimeChange?.(null);
        return { ...NULL_RESULT, peakTime: null, feedTime: lastFedTime, adjPeakH };
      }

      // RT starter — still rising or just past peak (1h tolerance for fridge suggestion)
      // 0.5h hysteresis prevents oscillation; extended to 1h so a starter up to 1h
      // past peak still gets evaluated for fridge hold suggestion.
      const PEAK_HYSTERESIS = 1.0;
      if (hoursSinceFeed < adjPeakH + PEAK_HYSTERESIS) {
        const rtPeakTime = new Date(lastFedTime.getTime() + adjPeakH * 3600000);
        // Use targetMixTime if available (passed from solver with post-blocker position),
        // otherwise fall back to ideal mix from sweet center. Never use raw pendingStart (may be stale).
        const sfDef = STYLE_FERM_DEFAULTS[styleKey ?? ''] ?? FERM_FALLBACK;
        const sweetCenterH = ((sfDef.preferredColdH ?? sfDef.coldH ?? 0) + sfDef.rtH
          + (sfDef.minTotalFermH ?? 12)) / 2;
        const referenceMixTime = targetMixTime
          ?? new Date(bakeTime.getTime() - sweetCenterH * 3600000);
        const hoursAfterPeak =
          (referenceMixTime.getTime() - rtPeakTime.getTime()) / 3600000;

        let _suggestedFridgeOut: Date | null = null;
        let _suggestedFridgePeak: Date | null = null;
        let _showFridgeComparison = false;
        let _fridgeSuggestion: string | null = null;

        if (starterLocation === 'rt') {
          const warmupH2 = getStarterFridgeWarmupH(kitchenTemp);
          const coldFactor = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10);
          const fridgePeakH = adjPeakH * coldFactor;
          const nowMs2 = Date.now();
          const fridgeOutTime2 = new Date(pendingStart.getTime() - warmupH2 * 3600000);
          const timeInFridgeH = (fridgeOutTime2.getTime() - nowMs2) / 3600000;
          // fridgeViable: there is enough window to feed now, put in fridge,
          // and have it still rising (or near peak) at removal.
          // 0 < timeInFridge < fridgePeakH means: removal is before fridge peak
          // (starter still rising at removal — best case)
          // Also check: RT path doesn't already give green-green at a reasonable hour
          // If rtPeakTime is already in the sweet zone, no need for fridge.
          const localSweetFrom = (sfDef.preferredColdH ?? sfDef.coldH ?? 0) + (sfDef.rtH ?? 2)
            + Math.round(((sfDef.coldH ?? 0) + (sfDef.rtH ?? 2)) * 0.35);
          const localSweetTo = sfDef.minTotalFermH ?? (sfDef.rtH ?? 2);
          const rtPeakInZone = rtPeakTime !== null && (() => {
            const rtPeakHBF = (bakeTime.getTime() - rtPeakTime.getTime()) / 3600000;
            return rtPeakHBF >= localSweetTo && rtPeakHBF <= localSweetFrom;
          })();
          const fridgeViable = !rtPeakInZone
            && timeInFridgeH > 0
            && timeInFridgeH < fridgePeakH * 0.95;
          if (fridgeViable) {
            const computedFridgeOut = new Date(
              pendingStart.getTime() - warmupH2 * 3600000
            );
            const computedFridgePeak = new Date(
              computedFridgeOut.getTime() + warmupH2 * 3600000
            );
            const minFridgeInTime = new Date(Date.now() + 15 * 60000);
            if (computedFridgeOut > minFridgeInTime) {
              _suggestedFridgeOut = computedFridgeOut;
              _suggestedFridgePeak = computedFridgePeak;
              _showFridgeComparison = true;
              const feedNowFridgeH = (fridgeOutTime2.getTime() - Date.now()) / 3600000;
              const feedNowBetter = hoursAfterPeak >= adjPeakH && feedNowFridgeH > 0
                && feedNowFridgeH < fridgePeakH * 0.8;
              _fridgeSuggestion = locale === 'fr'
                ? (feedNowBetter
                    ? `Nourrissez maintenant, réfrigérez — sortir à ${
                        computedFridgeOut.toLocaleTimeString('fr-FR',
                          { hour: 'numeric', minute: '2-digit' })
                      } pour pic au mélange`
                    : `Mettez au frigo maintenant — sortez à ${
                        computedFridgeOut.toLocaleTimeString('fr-FR',
                          { hour: 'numeric', minute: '2-digit' })
                      } pour mixer au pic`)
                : (feedNowBetter
                    ? `Feed now, refrigerate — remove at ${
                        computedFridgeOut.toLocaleTimeString('en-US',
                          { hour: 'numeric', minute: '2-digit', hour12: true })
                      } to mix at peak`
                    : `Refrigerate now — remove at ${
                        computedFridgeOut.toLocaleTimeString('en-US',
                          { hour: 'numeric', minute: '2-digit', hour12: true })
                      } to mix at peak`);
            }
          }
        }

        onStarterPeakTimeChange?.(rtPeakTime);
        return {
          peakTime: rtPeakTime,
          feedTime: lastFedTime,
          fridgeOut: null,
          suggestedFridgeOut: _suggestedFridgeOut,
          suggestedFridgePeak: _suggestedFridgePeak,
          showFridgeComparison: _showFridgeComparison,
          fridgeSuggestion: _fridgeSuggestion,
          starterIsDepletedAt: null,
          starterRefeedTime: null,
          starterStateNote: null,
          adjPeakH,
        };
      }

      // RT starter — declining (past peak, before trough)
      // Return the ACTUAL current cycle peak (already passed) so the solver
      // scores it as suboptimal. starterRefeedTime signals a refeed-now
      // candidate which findOptimalPositionSourdough picks up as Peak 2B.
      if (hoursSinceFeed < troughH) {
        const decliningPeak = new Date(lastFedTime.getTime() + adjPeakH * 3600000);
        onStarterPeakTimeChange?.(decliningPeak);
        return {
          peakTime: decliningPeak,
          feedTime: lastFedTime,
          fridgeOut: null,
          suggestedFridgeOut: null,
          suggestedFridgePeak: null,
          showFridgeComparison: false,
          fridgeSuggestion: null,
          starterIsDepletedAt: null,
          starterRefeedTime: new Date(),
          starterStateNote: locale === 'fr'
            ? 'En descente — encore utilisable. Rafraîchir maintenant donne un pic plus fort.'
            : 'Declining — still usable. Feeding now gives a stronger result.',
          adjPeakH,
        };
      }

      // RT starter — depleted (past trough)
      const troughTime = new Date(lastFedTime.getTime() + troughH * 3600000);
      const refeedNow = new Date();
      const depletedPeak = new Date(refeedNow.getTime() + adjPeakH * 3600000);
      onStarterPeakTimeChange?.(depletedPeak);
      return {
        peakTime: depletedPeak,
        feedTime: lastFedTime,
        fridgeOut: null,
        suggestedFridgeOut: null,
        suggestedFridgePeak: null,
        showFridgeComparison: false,
        fridgeSuggestion: null,
        starterIsDepletedAt: troughTime,
        starterRefeedTime: refeedNow,
        starterStateNote: 'Depleted — needs feeding. Schedule below assumes you feed it now.',
        adjPeakH,
      };
    }

    return NULL_RESULT;
  }

  // ── Sourdough: joint mix+starter solver (scoring loop) ──────
  function findOptimalPositionSourdough(et: Date, manualMixOverride?: Date, blocksOverride?: AvailabilityBlock[]) {
    // Reset drag state — any solver run means inputs changed, drag position is stale.
    // When triggered by a drag, preserve hasDragged so the label stays "Your plan".
    hasManuallyDragged.current = false;
    if (!manualMixOverride) {
      setHasDragged(false);
    }

    // If baker manually dragged, use their chosen mix time for feed timing
    const targetMixTime: Date | null = manualMixOverride ?? null;

    // Local vars for atomic solver output — all written here, committed in one setSolverResult call
    let _usingPeak2 = false;
    let _feed2Time: Date | null = null;
    let _starterPillState: 'green' | 'yellow' | 'red' = 'yellow';
    let _driftNote: string | null = null;
    let _hasFutureFeedPath = false;
    let _refreshStretchFactor = 1.0;
    let _isFridgeHoldPath = false;
    let _fridgeHoldRefreshTime: Date | null = null;
    let _fridgeHoldInTime: Date | null = null;
    let _fridgeHoldOutTime: Date | null = null;
    let _sourdoughSweetFrom: number | null = null;
    let _sourdoughSweetTo: number | null = null;
    let _windowTooShort = false;
    let _suggestedBakeTime: Date | null = null;
    let _newPendingStart: Date = pendingStart;
    let _newFridgeOut: Date | null = fridgeOutTime;
    let _adjPeakH: number | null = null;
    let _fridgeFeedTime: Date | null = null;

    // Get derived starter state (no setState calls inside)
    const derived = deriveStarterPeakTime(et, targetMixTime);
    const _feedTime = derived.feedTime;
    const _starterRefeedTime = derived.starterRefeedTime;
    const _starterIsDepletedAt = derived.starterIsDepletedAt;
    const _starterStateNote = derived.starterStateNote;
    const _suggestedFridgeOut = derived.suggestedFridgeOut;
    const _suggestedFridgePeak = derived.suggestedFridgePeak;
    const _showFridgeComparison = derived.showFridgeComparison;
    const _fridgeSuggestion = derived.fridgeSuggestion;
    const adjPeakH_derived = derived.adjPeakH;
    const peakTime = derived.peakTime;

    // Helper: build and commit solverResult atomically at any exit point
    function buildAndSetResult() {
      const _starterFeedTime = (() => {
        if (planningMode === 'know_peak') return null;
        if (starterLocation === 'fridge' && _fridgeFeedTime) return _fridgeFeedTime;
        if (_hasFutureFeedPath && _feed2Time) return _feed2Time;
        if (_usingPeak2 && _feed2Time) return _feed2Time;
        return lastFedTime ?? _feedTime;
      })();

      const _starterFeed2Time = (() => {
        if (!(_hasFutureFeedPath || _usingPeak2)) return null;
        if ((['days23','days45','week'] as const).includes(lastFedAge as 'days23'|'days45'|'week')) return null;
        return lastFedTime ?? null;
      })();

      // Refresh Feeds for chart: long-horizon intermediates ONLY.
      // The PRIMARY refresh (_starterRefeedTime) is rendered separately via
      // the starterRefeedTime prop — it gets the refeed diamond (line ~1261
      // in FermentChart) and the refresh bell in the depleted block. Pushing
      // it here too would duplicate both. Block (b) below handles long-horizon
      // intermediates (3+ day plans where starter needs feeding between major
      // events).
      const _intermediateRefreshFeeds: Date[] = [];

      if (_isFridgeHoldPath) {
        // Path B owns its own refresh visualisation — skip the multi-refresh array
      } else {
        // Long-horizon intermediates: if the gap from refresh (or last feed)
        // to the next major feed exceeds one full trough cycle, add additional
        // refresh feeds to keep starter alive. Temperature/style/maturity/rye/
        // ratio sensitive via getStarterTroughH + ryeF/matF/ratioMult.
        if (planningMode === 'last_fed' && lastFedTime) {
          const adjPeakH_eff = _adjPeakH ?? adjPeakH_derived;
          if (adjPeakH_eff) {
            const ryeF = starterHasRye ? 0.8 : 1.0;
            const matF = starterMature ? 1.0 : 1.2;
            const ratioMult = 1 + 0.35 * Math.log(feedRatio);
            const troughH_int = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * matF * ratioMult;

            // Determine the "next major feed" the chart walks toward.
            // Priority: future pre-mix feed (_feed2Time) > start dough time.
            const nextMajorFeedMs = (_hasFutureFeedPath || _usingPeak2) && _feed2Time
              ? _feed2Time.getTime()
              : _newPendingStart.getTime() - adjPeakH_eff * 3600000;

            // Starting point: primary refresh if exists, then intermediate
            // refreshes (if any), else lastFedTime.
            const startMs = _intermediateRefreshFeeds.length > 0
              ? _intermediateRefreshFeeds[_intermediateRefreshFeeds.length - 1].getTime()
              : (_starterRefeedTime ? _starterRefeedTime.getTime() : lastFedTime.getTime());

            const gapH = (nextMajorFeedMs - startMs) / 3600000;
            const numIntermediate = Math.floor(gapH / troughH_int);

            for (let i = 1; i < numIntermediate; i++) {
              const ft = new Date(startMs + i * troughH_int * 3600000);
              // Snap to 7am-10pm sleeping hours
              const h = ft.getHours();
              if (h < 7) { ft.setHours(7, 0, 0, 0); }
              else if (h > 22) { ft.setHours(7, 0, 0, 0); ft.setDate(ft.getDate() + 1); }
              // Guards: must be future, must clear blockers, must precede next major feed
              if (
                ft.getTime() > Date.now() &&
                ft.getTime() < nextMajorFeedMs - 30 * 60000 &&
                !inBlockerMs(ft.getTime())
              ) {
                _intermediateRefreshFeeds.push(ft);
              }
            }
          }
        }
      }

      // Compute pre-mix stretch factor for the winning path.
      // Only relevant when refresh peak exists AND pre-mix feed exists.
      // Path B handles its own timing — gets 1.0 by construction.
      const _preMixStretchFactor = (() => {
        if (_isFridgeHoldPath) return 1.0;
        if (!_feed2Time) return 1.0;
        const adjPeakH_eff = _adjPeakH ?? adjPeakH_derived;
        if (!adjPeakH_eff) return 1.0;
        // Reference peak: explicit refresh peak if any, else implicit last-fed peak.
        // Same biology either way — pre-mix fed before its reference peak has
        // stretched timing because yeast hasn't fully matured.
        const referencePeakMs = _starterRefeedTime
          ? _starterRefeedTime.getTime() + adjPeakH_eff * 3600000
          : (lastFedTime ? lastFedTime.getTime() + adjPeakH_eff * 3600000 : null);
        return computePreMixStretchFactor(_feed2Time.getTime(), referencePeakMs);
      })();

      const _planExplanation = (() => {
        if (_windowTooShort) {
          return isFr
            ? 'Pas assez de temps avant la cuisson. Essayez une cuisson plus tardive.'
            : 'Not enough time before bake. Try a later bake time.';
        }
        if (_isFridgeHoldPath) {
          return isFr
            ? "Rafraîchi, pic, puis frigo jusqu'au rafraîchi final — idéal pour les cuissons à 2+ jours."
            : 'Refresh, peak, then fridge holds your starter until pre-mix — best for 2+ day plans.';
        }
        if (_usingPeak2 && !_hasFutureFeedPath) {
          return isFr
            ? 'Un seul rafraîchi suffit — votre levain pique pile au pétrissage.'
            : "One refresh is enough — your starter peaks right when you'll mix.";
        }
        if (_hasFutureFeedPath && _feed2Time && _starterRefeedTime) {
          const adjPeakH_eff = _adjPeakH ?? adjPeakH_derived;
          if (!adjPeakH_eff) {
            return isFr
              ? 'Rafraîchi pour réveiller votre levain, puis rafraîchi final synchronisé au pétrissage.'
              : 'Refresh wakes your starter; pre-mix is timed so it peaks at mix.';
          }
          const refreshPeakMsLocal = _starterRefeedTime.getTime() + adjPeakH_eff * _refreshStretchFactor * 3600000;
          const gapH = (_feed2Time.getTime() - refreshPeakMsLocal) / 3600000;
          if (gapH >= -1 && gapH <= 3) {
            return isFr
              ? 'Rafraîchi pour réveiller votre levain, puis rafraîchi final au pic — levain optimal.'
              : 'Refresh wakes your starter; pre-mix at peak gives the strongest leaven.';
          }
          if (gapH < -1) {
            return isFr
              ? "Rafraîchi final un peu avant le pic pour s'adapter à votre planning — résultat solide."
              : 'Pre-mix lands a bit before peak to fit your schedule — still gives a solid result.';
          }
          return isFr
            ? "Rafraîchi final plus tard qu'idéal à cause de votre planning — ça reste bon."
            : 'Pre-mix is later than ideal because of your schedule — still works.';
        }
        if (planningMode === 'know_peak') {
          return isFr
            ? 'Votre levain pique naturellement vers le pétrissage — aucune action nécessaire.'
            : 'Your starter peaks naturally around mix time — no action needed.';
        }
        return null;
      })();

      // ── Canonical starter event list (sourdough only) ──
      const _starterEvents: StarterEvent[] = (() => {
        const events: StarterEvent[] = [];
        const nowMs = Date.now();
        const adjPeakH_eff = _adjPeakH ?? adjPeakH_derived ?? 0;
        const refreshStretch = _refreshStretchFactor;
        const preMixStretch  = _preMixStretchFactor;

        if (planningMode === 'know_peak' && knownPeakTime) {
          const knownPeakBellH = adjPeakH_eff > 0 ? adjPeakH_eff : 14;
          const bellStartTime = new Date(knownPeakTime.getTime() - knownPeakBellH * 3600000);
          events.push({
            kind: 'known_peak',
            time: knownPeakTime,
            isPast: knownPeakTime.getTime() < nowMs,
            isActive: true,
            isDraggable: false,
            label: isFr ? 'Pic du levain' : 'Starter Peak',
            cardTimeFormat: 'absolute',
            bellStyle: 'solid',
            bellPeakTime: knownPeakTime,
            bellStartTime: bellStartTime,
            bellSigmaScale: 1.0,
          });
          return events;
        }

        if (lastFedTime) {
          events.push({
            kind: 'last_fed',
            time: lastFedTime,
            isPast: lastFedTime.getTime() < nowMs,
            isActive: false,
            isDraggable: false,
            label: isFr ? 'Dernier rafraîchi' : 'Last fed',
            cardTimeFormat: 'absolute',
            bellStyle: 'historical_dotted',
            bellPeakTime: new Date(lastFedTime.getTime() + adjPeakH_eff * 3600000),
            bellSigmaScale: 1.0,
          });
        }

        if (_isFridgeHoldPath
            && _fridgeHoldRefreshTime
            && _fridgeHoldInTime
            && _fridgeHoldOutTime
            && _feed2Time) {
          const refreshPeakAt = new Date(_fridgeHoldRefreshTime.getTime() + adjPeakH_eff * refreshStretch * 3600000);
          events.push({
            kind: 'refresh',
            time: _fridgeHoldRefreshTime,
            isPast: _fridgeHoldRefreshTime.getTime() < nowMs - 60 * 60 * 1000,
            isActive: false,
            isDraggable: false,
            label: isFr ? 'Rafraîchi' : 'Refresh Feed',
            cardTimeFormat: 'relative',
            cardNote: isFr
              ? `Pic vers ${fmtCardHM(refreshPeakAt, isFr)} — puis au frigo`
              : `Peak around ${fmtCardHM(refreshPeakAt, isFr)} — then refrigerate`,
            bellStyle: 'dotted',
            bellPeakTime: refreshPeakAt,
            bellSigmaScale: refreshStretch,
          });
          events.push({
            kind: 'fridge_in',
            time: _fridgeHoldInTime,
            isPast: _fridgeHoldInTime.getTime() < nowMs,
            isActive: false,
            isDraggable: false,
            label: isFr ? 'Au frigo' : 'Into Fridge',
            cardTimeFormat: 'absolute',
            cardNote: isFr ? 'Au pic — ralentit la fermentation' : 'At peak — slows fermentation',
            bellStyle: 'none',
            bellSigmaScale: 1.0,
          });
          const warmupMin = Math.round(getStarterFridgeWarmupH(kitchenTemp) * 60);
          events.push({
            kind: 'fridge_out',
            time: _fridgeHoldOutTime,
            isPast: _fridgeHoldOutTime.getTime() < nowMs,
            isActive: false,
            isDraggable: false,
            label: isFr ? 'Sortie du frigo' : 'Out of Fridge',
            cardTimeFormat: 'absolute',
            cardNote: isFr
              ? `Tempérer ~${warmupMin} min avant le rafraîchi final`
              : `Warm up ~${warmupMin} min before pre-mix feed`,
            bellStyle: 'none',
            bellSigmaScale: 1.0,
          });
          const preMixPeakAt = new Date(_feed2Time.getTime() + adjPeakH_eff * preMixStretch * 3600000);
          events.push({
            kind: 'pre_mix',
            time: _feed2Time,
            isPast: _feed2Time.getTime() < nowMs,
            isActive: true,
            isDraggable: true,
            label: isFr ? 'Rafraîchi final' : 'Pre-mix Feed',
            cardTimeFormat: 'absolute',
            cardNote: isFr ? `Pic vers ${fmtCardHM(preMixPeakAt, isFr)}` : `Peak around ${fmtCardHM(preMixPeakAt, isFr)}`,
            bellStyle: 'solid',
            bellPeakTime: preMixPeakAt,
            bellSigmaScale: preMixStretch,
          });
          events.sort((a, b) => a.time.getTime() - b.time.getTime());
          return events;
        }

        if (_starterRefeedTime && !_usingPeak2) {
          const isPrimary = !_hasFutureFeedPath;
          const refreshPeakAt = new Date(_starterRefeedTime.getTime() + adjPeakH_eff * refreshStretch * 3600000);
          events.push({
            kind: 'refresh',
            time: _starterRefeedTime,
            isPast: _starterRefeedTime.getTime() < nowMs - 60 * 60 * 1000,
            isActive: isPrimary,
            isDraggable: false,
            label: isFr ? 'Rafraîchi' : 'Refresh Feed',
            cardTimeFormat: 'relative',
            cardNote: isFr ? `Pic vers ${fmtCardHM(refreshPeakAt, isFr)}` : `Peak around ${fmtCardHM(refreshPeakAt, isFr)}`,
            bellStyle: isPrimary ? 'solid' : 'dotted',
            bellPeakTime: refreshPeakAt,
            bellSigmaScale: refreshStretch,
          });
        }

        if (!_isFridgeHoldPath
            && !_starterRefeedTime
            && starterLocation === 'fridge'
            && _starterFeedTime
            && !_usingPeak2) {
          const activePeakAt = new Date(_starterFeedTime.getTime() + adjPeakH_eff * 3600000);
          events.push({
            kind: 'refresh',
            time: _starterFeedTime,
            isPast: _starterFeedTime.getTime() < nowMs,
            isActive: true,
            isDraggable: false,
            label: isFr ? 'Rafraîchi' : 'Refresh Feed',
            cardTimeFormat: 'absolute',
            cardNote: isFr ? `Pic vers ${fmtCardHM(activePeakAt, isFr)}` : `Peak around ${fmtCardHM(activePeakAt, isFr)}`,
            bellStyle: 'solid',
            bellPeakTime: activePeakAt,
            bellSigmaScale: 1.0,
          });
        }

        for (let i = 0; i < _intermediateRefreshFeeds.length; i++) {
          const ft = _intermediateRefreshFeeds[i];
          if (_starterRefeedTime && Math.abs(ft.getTime() - _starterRefeedTime.getTime()) < 30 * 60 * 1000) continue;
          const intPeakAt = new Date(ft.getTime() + adjPeakH_eff * 3600000);
          const refreshCount = events.filter(e => e.kind === 'refresh' || e.kind === 'intermediate_refresh').length + 1;
          events.push({
            kind: 'intermediate_refresh',
            time: ft,
            isPast: ft.getTime() < nowMs,
            isActive: false,
            isDraggable: false,
            label: isFr ? `Rafraîchi ${refreshCount}` : `Refresh Feed ${refreshCount}`,
            cardTimeFormat: 'absolute',
            bellStyle: 'dotted',
            bellPeakTime: intPeakAt,
            bellSigmaScale: 1.0,
          });
        }

        if ((_hasFutureFeedPath || _usingPeak2) && _feed2Time) {
          const preMixPeakAt = new Date(_feed2Time.getTime() + adjPeakH_eff * preMixStretch * 3600000);
          const isNow = Math.abs(_feed2Time.getTime() - nowMs) < 30 * 60 * 1000;
          events.push({
            kind: 'pre_mix',
            time: _feed2Time,
            isPast: _feed2Time.getTime() < nowMs,
            isActive: true,
            isDraggable: true,
            label: _usingPeak2
              ? (isFr ? 'Prochain rafraîchi' : 'Next Feed')
              : (isFr ? 'Rafraîchi final' : 'Pre-mix Feed'),
            cardTimeFormat: isNow ? 'relative' : 'absolute',
            cardNote: isFr ? `Pic vers ${fmtCardHM(preMixPeakAt, isFr)}` : `Peak around ${fmtCardHM(preMixPeakAt, isFr)}`,
            bellStyle: 'solid',
            bellPeakTime: preMixPeakAt,
            bellSigmaScale: preMixStretch,
          });
        }

        if (!_isFridgeHoldPath && starterLocation === 'fridge' && _newFridgeOut) {
          const warmupMin = Math.round(getStarterFridgeWarmupH(kitchenTemp) * 60);
          events.push({
            kind: 'fridge_out',
            time: _newFridgeOut,
            isPast: _newFridgeOut.getTime() < nowMs,
            isActive: false,
            isDraggable: false,
            label: isFr ? 'Sortie du frigo' : 'Remove from Fridge',
            cardTimeFormat: 'absolute',
            cardNote: isFr
              ? `~${warmupMin} min pour atteindre la temp. ambiante`
              : `~${warmupMin} min to reach room temp`,
            bellStyle: 'none',
            bellSigmaScale: 1.0,
          });
        }

        if (events.length === 1 && events[0].kind === 'last_fed' && !_starterRefeedTime) {
          events[0].isActive = true;
          events[0].bellStyle = 'solid';
        }

        events.sort((a, b) => a.time.getTime() - b.time.getTime());
        return events;
      })();

      // Suppress fridge suggestion banner when the winning candidate doesn't
      // use the fridge path. deriveStarterPeakTime may suggest fridge based on
      // standalone state but if the solver chose a refresh+future-feed or
      // single future feed path, the suggestion is stale and misleading.
      const _winnerUsesFridge = _isFridgeHoldPath
        || starterLocation === 'fridge'
        || (_suggestedFridgeOut !== null && _suggestedFridgeOut !== undefined);
      const _fridgeSuggestionFinal = _winnerUsesFridge ? _fridgeSuggestion : null;

      setSolverResult({
        usingPeak2:             _usingPeak2,
        hasFutureFeedPath:      _hasFutureFeedPath,
        starterPillState:       _starterPillState,
        driftNote:              _driftNote,
        starterRefeedTime:      _starterRefeedTime,
        starterStateNote:       _starterStateNote,
        fridgeSuggestion:       _fridgeSuggestionFinal,
        suggestedFridgeOutTime: _suggestedFridgeOut,
        suggestedFridgePeakTime: _suggestedFridgePeak,
        showFridgeComparison:   _showFridgeComparison,
        adjPeakHValue:          _adjPeakH ?? (adjPeakH_derived || null),
        sourdoughSweetFrom:     _sourdoughSweetFrom,
        sourdoughSweetTo:       _sourdoughSweetTo,
        starterIsDepletedAt:    _starterIsDepletedAt,
        windowTooShort:         _windowTooShort,
        suggestedBakeTime:      _suggestedBakeTime,
        feed2Time:              _feed2Time,
        feedTime:               _feedTime,
        fridgeOutTime:          _newFridgeOut,
        fridgeFeedTime:         _fridgeFeedTime,
        starterFeedTime:        _starterFeedTime,
        starterFeed2Time:       _starterFeed2Time,
        starterKnownPeakTime:   planningMode === 'know_peak' ? knownPeakTime : null,
        starterRedPill:         _hasFutureFeedPath,
        starterFeed2OutOfZone:  _usingPeak2 && _hasFutureFeedPath,
        comparisonFridgeOutTime:  _showFridgeComparison ? _suggestedFridgeOut : null,
        comparisonFridgePeakTime: _showFridgeComparison ? _suggestedFridgePeak : null,
        // Capture fridge-in time once — don't overwrite on repeated solver runs
        // to prevent the curve from drifting when baker toggles settings.
        // fridgeInTime = when starter goes into fridge = the feed time itself
        // (baker feeds then immediately refrigerates)
        // When hasFutureFeedPath: use feed2Time (the future recommended feed)
        // When currently declining: use now (refrigerate immediately)
        starterFridgeInTime: _showFridgeComparison
          ? (_hasFutureFeedPath && _feed2Time
              ? _feed2Time
              : (solverResult?.starterFridgeInTime ?? new Date()))
          : null,
        peakTime: (starterLocation === 'fridge' && _newFridgeOut)
          ? new Date(_newFridgeOut.getTime() + getStarterFridgeWarmupH(kitchenTemp) * 3600000)
          : (_starterFeedTime && _adjPeakH
              ? new Date(_starterFeedTime.getTime() + _adjPeakH * _preMixStretchFactor * 3600000)
              : null),
        starterIntermediateFeeds: _intermediateRefreshFeeds,
        isFridgeHoldPath:      _isFridgeHoldPath,
        fridgeHoldRefreshTime: _fridgeHoldRefreshTime,
        fridgeHoldInTime:      _fridgeHoldInTime,
        fridgeHoldOutTime:     _fridgeHoldOutTime,
        preMixStretchFactor:   _preMixStretchFactor,
        refreshStretchFactor:  _refreshStretchFactor,
        planExplanation:       _planExplanation,
        starterEvents:         _starterEvents,
      });
      onStarterFridgeInTimeChange?.(_showFridgeComparison
        ? (_hasFutureFeedPath && _feed2Time
            ? _feed2Time
            : (solverResult?.starterFridgeInTime ?? new Date()))
        : null);

      // Also sync pendingStart and fridgeOutTime (individual states) if changed
      if (_newPendingStart.getTime() !== pendingStart.getTime()) {
        setPendingStart(_newPendingStart);
      }
      if (_newFridgeOut !== fridgeOutTime) {
        setFridgeOutTime(_newFridgeOut);
        onFridgeOutTimeChange?.(_newFridgeOut);
      }
    }

    if (!peakTime && starterLocation !== 'fridge') {
      buildAndSetResult();
      return;
    }

    // Local sfDef — avoids stale render-time closure
    const localSfDef = STYLE_FERM_DEFAULTS[styleKey ?? ''] ?? FERM_FALLBACK;
    const _localPrefColdH = localSfDef.preferredColdH ?? localSfDef.coldH;
    const localSweetFrom  = _localPrefColdH + localSfDef.rtH;
    const localSweetTo    = localSfDef.minTotalFermH ?? 4;
    _sourdoughSweetFrom = localSweetFrom;
    _sourdoughSweetTo   = localSweetTo;

    // Window too short check — same concept as poolish windowTooShort
    const bakeMs    = et.getTime();
    const nowMs0    = Date.now();
    const windowHBF = (bakeMs - nowMs0) / 3600000;
    const minFermH  = (localSfDef.minTotalFermH ?? 4) + 1.0;

    // Compute starter peak params early — needed for suggestion if window too short
    const peakH   = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
    const ryeF    = starterHasRye ? 0.8 : 1.0;
    const matF    = starterMature ? 1.0 : 1.2;
    const ratioMultiplier = 1 + 0.35 * Math.log(feedRatio);
    const adjPeakH = peakH * ryeF * matF * ratioMultiplier;
    _adjPeakH = adjPeakH;

    if (windowHBF < minFermH) {
      _windowTooShort = true;
      _starterPillState = 'green';
      setRefeedSuggestion(null);
      _feed2Time = null;

      // Earliest viable bake suggestion — bread only (not pizza)
      if (bakeType === 'bread') {
        const sweetCenterH = (localSweetFrom + localSweetTo) / 2;
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
        _suggestedBakeTime = suggested;
      }
      buildAndSetResult();
      return;
    }
    _windowTooShort = false;
    _suggestedBakeTime = null;

    const troughH  = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMultiplier;
    // Refresh stretch factor: a refresh feed from a past-peak starter takes
    // longer to peak because yeast population starts lower. More depletion =
    // longer stretch. Multiplier on adjPeakH (already temperature-sensitive).
    _refreshStretchFactor = (() => {
      if (planningMode !== 'last_fed' || !lastFedTime) return 1.0;
      const hSinceFeed = (Date.now() - lastFedTime.getTime()) / 3600000;
      if (hSinceFeed <= adjPeakH) return 1.0;
      if (hSinceFeed <= adjPeakH * 1.5) return 1.05;
      if (hSinceFeed <= troughH) return 1.15;
      if (hSinceFeed <= troughH * 1.5) return 1.25;
      if (hSinceFeed <= troughH * 2.5) return 1.35;
      return 1.5;
    })();
    const _adjPeakH_refresh = adjPeakH * _refreshStretchFactor;
    const warmupH  = getStarterFridgeWarmupH(kitchenTemp);
    const ftm      = Math.max(0.7, Math.min(1.5, flourStrength ?? 1.0));
    // Peak hold window scales with peak time — faster biology = narrower window.
    // RT: adjPeakH × 0.15, clamped 1.0–3.0h. Fridge: always 2.0h (cold = stable).
    const rtTOL   = Math.max(1.0, Math.min(3.0, adjPeakH * 0.15));
    const baseTOL = starterLocation === 'fridge' ? 2.0 : rtTOL;
    const TOL     = baseTOL * ftm;

    const sweetFromHBF = localSweetFrom;
    const sweetToHBF   = localSweetTo;
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
      // Sourdough styles use cold retard — mix at any hour is fine (just go to fridge).
      // Suppress hour-of-day penalty for sourdough to avoid biasing against
      // biologically-optimal but late/early mix times.
      if (isSourdough) return 1;
      const h = new Date(bakeMs - mixHBF * 3600000).getHours();
      return (h >= 7 && h <= 22) ? 1 : 0;
    }

    function feedComfort(feedMs: number): number {
      const h = new Date(feedMs).getHours();
      if (h >= 7  && h <= 9)  return 8;
      if (h >= 19 && h <= 21) return 6;
      if (h >= 6  && h <= 10) return 3;
      if (h >= 18 && h <= 22) return 2;
      if (h >= 11 && h <= 17) return 1;
      if (h >= 23 || h <= 1)  return -4;
      return -8;  // 2am-5am
    }

    const effectiveBlocks = blocksOverride ?? blocks;
    function inBlocker(mixHBF: number): boolean {
      return effectiveBlocks.some(b => {
        const s = (bakeMs - b.from.getTime()) / 3600000;
        const e = (bakeMs - b.to.getTime())   / 3600000;
        return mixHBF > Math.min(s, e) && mixHBF < Math.max(s, e);
      });
    }
    function inBlockerMs(timeMs: number): boolean {
      return effectiveBlocks.some(b =>
        timeMs > b.from.getTime() && timeMs < b.to.getTime()
      );
    }
    function candidateValid(actionsMs: (number | null | undefined)[]): boolean {
      return actionsMs.every(t => t == null || !inBlockerMs(t));
    }

    function combinedScore(mixHBF: number, peakHBF: number, feedMs: number, usesMixForComfort = false): number {
      const ss = starterScore(mixHBF, peakHBF);
      const ds = doughScore(mixHBF);
      const retardW = ss >= 2 ? 8 : 3;
      // For Peak 2: score the mix hour (controllable) not the trough/refeed time (fixed biology)
      const comfortMs = usesMixForComfort ? (bakeMs - mixHBF * 3600000) : feedMs;
      // feedComfort x3: feed hour matters when biology is otherwise equal.
      // Without weighting, retardBonus (up to 64 points) buries feedComfort
      // (up to 8 points), forcing midnight feeds when humane alternatives exist.
      return (ss + ds) * 100
        + retardBonus(mixHBF) * retardW
        + reasonableHour(mixHBF) * 5
        + feedComfort(comfortMs) * 3;
    }

    // ── Candidate generation ──────────────────────────

    const STEP     = 0.25;
    const scanFrom = sweetFromHBF + 2;
    const scanTo   = Math.max(sweetToHBF - 2, minTotalRT + 0.5);

    interface Candidate {
      mixHBF:          number;
      peakHBF:         number;
      feedMs:          number;
      usingPeak2:      boolean;
      feed2Ms:         number | null;
      score:           number;
      sscore:          0 | 1 | 2;
      isFridgePath?:   boolean;
      isFutureFeedPath?: boolean;
      isFridgeHoldPath?: boolean;
      // Path B specific fields
      fridgeHoldRefreshMs?: number;
      fridgeHoldInMs?:      number;
      fridgeHoldOutMs?:     number;
    }

    const candidates: Candidate[] = [];

    const nowMs = Date.now();

    // Peak 1 candidates
    const feed1Ms = peakTime
      ? (lastFedTime ? lastFedTime.getTime() : peakTime.getTime() - adjPeakH * 3600000)
      : (lastFedTime?.getTime() ?? Date.now());

    if (peakTime) {
      const peak1HBF = (bakeMs - peakTime.getTime()) / 3600000;
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
          if (inBlockerMs(troughMs)) continue;
          const ss = starterScore(mixHBF, peak2AHBF);
          if (ss === 0) continue;
          candidates.push({
            mixHBF, peakHBF: peak2AHBF, feedMs: troughMs,
            usingPeak2: true, feed2Ms: troughMs,
            score: combinedScore(mixHBF, peak2AHBF, troughMs, true), sscore: ss,
          });
        }
      }

      // Option B: refeed now (declining state — _starterRefeedTime set from derived)
      if (_starterRefeedTime && !inBlockerMs(_starterRefeedTime.getTime())) {
        const refeedMs  = _starterRefeedTime.getTime();
        const peak2BHBF = (bakeMs - (refeedMs + adjPeakH * 3600000)) / 3600000;

        for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
          if (bakeMs - mixHBF * 3600000 <= nowMs) continue;
          if (inBlocker(mixHBF)) continue;
          const ss = starterScore(mixHBF, peak2BHBF);
          if (ss === 0) continue;
          candidates.push({
            mixHBF, peakHBF: peak2BHBF, feedMs: refeedMs,
            usingPeak2: true, feed2Ms: refeedMs,
            score: combinedScore(mixHBF, peak2BHBF, refeedMs, true) + 6, sscore: ss,
          });
        }
      }
    }

    // Peak 1 Fridge candidates (still-rising RT starter, fridge path computed)
    if (starterLocation === 'rt' && _suggestedFridgePeak && _suggestedFridgeOut
        && !inBlockerMs(_suggestedFridgeOut.getTime())) {
      const fridgePeakHBF = (bakeMs - _suggestedFridgePeak.getTime()) / 3600000;
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
          score: combinedScore(mixHBF, fridgePeakHBF, fridgeFeedMs)
                 + (lastFedTime && (Date.now() - lastFedTime.getTime()) / 3600000 > adjPeakH ? 10 : 5),
          sscore: ss,
          isFridgePath: true,
        });
      }
    }

    // ── Fridge candidate scan (fridge starter, no fridgeOutTime yet) ──────────
    // Iterate candidate fridge-removal times in 15min steps. Each gives
    // mix = fridgeOut + warmupH. Starter peak = mix by construction (true ss=2).
    // Scan window respects sweet zone bounds + yellow margin.
    // Temperature/style sensitive via warmupH, sweetFromHBF, sweetToHBF, adjPeakH.
    if (starterLocation === 'fridge' && !fridgeOutTime) {
      const _warmupH = getStarterFridgeWarmupH(kitchenTemp);
      const nowMsLocal = Date.now();
      const mixHBFMin = Math.max(minTotalRT + 0.5, sweetToHBF - 2);
      const mixHBFMax = sweetFromHBF + 2;
      const fridgeOutMinMs = Math.max(
        nowMsLocal + 15 * 60000,
        bakeMs - (mixHBFMax + _warmupH) * 3600000
      );
      const fridgeOutMaxMs = bakeMs - (mixHBFMin + _warmupH) * 3600000;
      for (let foMs = fridgeOutMinMs; foMs <= fridgeOutMaxMs; foMs += 15 * 60000) {
        const mixMs = foMs + _warmupH * 3600000;
        const mixHBF = (bakeMs - mixMs) / 3600000;
        if (inBlocker(mixHBF)) continue;
        if (inBlockerMs(foMs)) continue;
        const ds = doughScore(mixHBF);
        if (ds === 0) continue;
        const feedMs = lastFedTime?.getTime() ?? foMs;
        const ss: 2 = 2;
        candidates.push({
          mixHBF, peakHBF: mixHBF, feedMs,
          usingPeak2: false, feed2Ms: null,
          score: combinedScore(mixHBF, mixHBF, feedMs) + 10,
          sscore: ss,
          isFridgePath: true,
        });
      }
    }

    // ── Future-feed candidates (always generated, compete in main pool) ──────
    // A future feed with ss=2,ds=2 (score≈400) beats Peak1 with ss=2,ds=0 (score≈200).
    {
      const nowMs2       = Date.now();
      // Use baker's dragged mix time if available, otherwise use sweet center
      const idealMixTime2 = targetMixTime ?? new Date(bakeMs - ((sweetFromHBF + sweetToHBF) / 2) * 3600000);
      const idealMixHBF2  = (bakeMs - idealMixTime2.getTime()) / 3600000;
      const baseFeed2    = new Date(idealMixTime2.getTime() - adjPeakH * 3600000);
      const searchStart2 = targetMixTime
        ? new Date(baseFeed2.getTime() - 15 * 60000)
        : new Date(baseFeed2.getTime() - 36 * 3600000);
      const searchEnd2 = targetMixTime
        ? new Date(baseFeed2.getTime() + 15 * 60000)
        : new Date(baseFeed2.getTime() + 2 * 3600000);

      // refreshPeakMsForStretch: if starter is declining/depleted, refresh
      // peak exists and stretch applies. Otherwise null (no stretch).
      const refreshPeakMsForStretch = _starterRefeedTime
        ? _starterRefeedTime.getTime() + _adjPeakH_refresh * 3600000
        : null;

      for (let t2 = searchStart2.getTime(); t2 <= searchEnd2.getTime(); t2 += 15 * 60000) {
        if (t2 <= nowMs2) continue;
        const stretchFactor2 = computePreMixStretchFactor(t2, refreshPeakMsForStretch);
        const peakT2 = new Date(t2 + adjPeakH * stretchFactor2 * 3600000);
        const mHBF2  = (bakeMs - peakT2.getTime()) / 3600000;
        if (mHBF2 < sweetToHBF - 4 || mHBF2 > sweetFromHBF + 4) continue;
        if (bakeMs - mHBF2 * 3600000 <= nowMs2) continue;
        if (inBlocker(mHBF2)) continue;
        if (inBlockerMs(t2)) continue;
        // Same biological gap rule for plain future-feed (when refresh exists)
        if (refreshPeakMsForStretch != null) {
          const _gapPreCheck2 = (t2 - refreshPeakMsForStretch) / 3600000;
          const _maxEarly2 = adjPeakH * 0.5;
          if (_gapPreCheck2 < -_maxEarly2 || _gapPreCheck2 > 6) continue;
        }
        const sc2 = combinedScore(mHBF2, mHBF2, t2, true);
        const ss2 = starterScore(mHBF2, mHBF2);
        if (ss2 === 0) continue;
        const _depletionPenalty = (() => {
          if (!lastFedTime) return 0;
          const gapH = (t2 - lastFedTime.getTime()) / 3600000;
          if (gapH <= adjPeakH) return 0;
          if (gapH <= troughH) return -3;
          if (gapH <= troughH * 1.5) return -8;
          return -15;
        })();
        // Biology penalty: pre-mix sweet spot is at refresh peak (0–3h post-peak window).
        // Both sub-peak and far-post-peak candidates are penalised symmetrically.
        const _subPeakPenalty = (() => {
          // Reference peak: explicit refresh peak if any, else implicit last-fed peak.
          // Same biology either way — pre-mix from a near-peak starter is strongest.
          const referencePeakMs = refreshPeakMsForStretch ?? (
            lastFedTime ? lastFedTime.getTime() + adjPeakH * 3600000 : null
          );
          if (referencePeakMs == null) return 0;
          const gapFromPeakH = (t2 - referencePeakMs) / 3600000;
          if (gapFromPeakH >= 0 && gapFromPeakH <= 3) return 0;
          if (gapFromPeakH > 3 && gapFromPeakH <= 6) return -(gapFromPeakH - 3) * 2;
          if (gapFromPeakH > 6 && gapFromPeakH <= 9) return -10 - (gapFromPeakH - 6) * 2;
          if (gapFromPeakH > 9) return -16 - Math.min(14, (gapFromPeakH - 9) * 3);
          if (gapFromPeakH >= -2) return -5;
          return -10 - Math.min(20, (Math.abs(gapFromPeakH) - 2) * 3);
        })();
        candidates.push({
          mixHBF: mHBF2, peakHBF: mHBF2, feedMs: t2,
          usingPeak2: false, feed2Ms: t2,
          score: sc2 + _depletionPenalty + _subPeakPenalty, sscore: ss2,
          isFutureFeedPath: true,
        });
      }
    }

    // ── Refresh + Future Feed candidates (declining/depleted starter, two-feed path) ─
    // When starter is past peak (declining or depleted), a single future feed produces
    // a weak levain. The correct biology is: refresh now to rebuild yeast
    // population, then a second (pre-mix) feed timed so peak = mix. This
    // candidate models that two-feed path. Only generated when:
    //   - starter is currently past peak (declining or depleted)
    //   - planningMode === 'last_fed' and lastFedTime exists
    //   - starterLocation === 'rt' (fridge has its own paths)
    //   - there is enough time between now+adjPeakH (refresh peak) and the
    //     pre-mix feed to allow the refresh cycle to complete
    // Include declining starters (past peak, before trough), not just depleted.
    // Biology: any past-peak starter benefits from a refresh before pre-mix.
    if (
      planningMode === 'last_fed' && lastFedTime &&
      starterLocation === 'rt' &&
      (Date.now() - lastFedTime.getTime()) / 3600000 > adjPeakH
    ) {
      const nowMs3 = Date.now();
      const refreshMs = nowMs3;
      const refreshPeakMs = refreshMs + _adjPeakH_refresh * 3600000;
      // Pre-mix feed must come AFTER refresh has had time to peak (or close to it)
      // Allow pre-mix feed to start as early as refreshPeakMs - 1h (some overlap ok)
      const earliestPreMixMs = refreshPeakMs - 12 * 3600000;  // allow up to 12h before refresh peak; scoring penalty applies
      const baseFeed3 = targetMixTime
        ? new Date(targetMixTime.getTime() - adjPeakH * 3600000)
        : null;
      const searchStart3 = baseFeed3
        ? new Date(baseFeed3.getTime() - 15 * 60000)
        : new Date(refreshPeakMs - 12 * 3600000);
      const searchEnd3 = baseFeed3
        ? new Date(baseFeed3.getTime() + 15 * 60000)
        : new Date(refreshPeakMs + 12 * 3600000);

      if (!inBlockerMs(refreshMs)) {
        for (let t3 = Math.max(searchStart3.getTime(), earliestPreMixMs); t3 <= searchEnd3.getTime(); t3 += 15 * 60000) {
          if (t3 <= nowMs3) continue;
          const stretchFactor3 = computePreMixStretchFactor(t3, refreshPeakMs);
          const peakT3 = new Date(t3 + adjPeakH * stretchFactor3 * 3600000);
          const mHBF3  = (bakeMs - peakT3.getTime()) / 3600000;
          if (mHBF3 < sweetToHBF - 4 || mHBF3 > sweetFromHBF + 4) continue;
          if (bakeMs - mHBF3 * 3600000 <= nowMs3) continue;
          if (inBlocker(mHBF3)) continue;
          if (inBlockerMs(t3)) continue;
          // Biological minimum gap: pre-mix must be no earlier than
          // adjPeakH × 0.5 before refresh peak (= half refresh cycle has
          // elapsed since refresh feed), and no later than 6h after refresh
          // peak (starter declining beyond that point).
          const _gapPreCheck3 = (t3 - refreshPeakMs) / 3600000;
          const _maxEarly = adjPeakH * 0.5;
          if (_gapPreCheck3 < -_maxEarly || _gapPreCheck3 > 6) continue;
          const sc3 = combinedScore(mHBF3, mHBF3, t3, true);
          const ss3 = starterScore(mHBF3, mHBF3);
          if (ss3 === 0) continue;
          // Biology penalty: pre-mix sweet spot is AT refresh peak (0h gap).
          // Earlier than peak → starter not yet matured, pre-mix peak stretches.
          // Later than peak → starter declining, pre-mix peaks weaker.
          const gapFromRefreshPeakH = (t3 - refreshPeakMs) / 3600000;
          const biologyPenalty = (() => {
            if (gapFromRefreshPeakH >= 0 && gapFromRefreshPeakH <= 3) return 0;
            if (gapFromRefreshPeakH > 3 && gapFromRefreshPeakH <= 6) return -(gapFromRefreshPeakH - 3) * 2;
            if (gapFromRefreshPeakH > 6 && gapFromRefreshPeakH <= 9) return -10 - (gapFromRefreshPeakH - 6) * 2;
            if (gapFromRefreshPeakH > 9) return -16 - Math.min(14, (gapFromRefreshPeakH - 9) * 3);
            if (gapFromRefreshPeakH < 0 && gapFromRefreshPeakH >= -1) return -2;
            if (gapFromRefreshPeakH < -1 && gapFromRefreshPeakH >= -2) return -5;
            return -10 - Math.min(20, (Math.abs(gapFromRefreshPeakH) - 2) * 3);
          })();
          candidates.push({
            mixHBF: mHBF3, peakHBF: mHBF3, feedMs: t3,
            usingPeak2: false, feed2Ms: t3,
            score: sc3 + 12 + biologyPenalty, sscore: ss3,
            isFutureFeedPath: true,
          });
        }
      }
    }

    // ── Path B: Refresh → Fridge Hold → Pre-mix Feed (far-future bakes) ─────
    // For declining/depleted starters with bake 2+ days away, the optimal
    // baker practice is: refresh now → let peak → fridge → take out → pre-mix
    // → mix. Two feeds total, fridge handles the long gap.
    // Generated when:
    //   - starter is declining/depleted (past peak, set via _starterRefeedTime)
    //   - planningMode === 'last_fed' && lastFedTime exists
    //   - starterLocation === 'rt'
    //   - Pre-mix feed is far enough out that fridge hold makes sense (>= 24h
    //     from refresh peak to pre-mix feed)
    //   - Fridge hold duration is reasonable (6h <= hold <= 120h / 5 days)
    if (
      _starterRefeedTime &&
      planningMode === 'last_fed' && lastFedTime &&
      starterLocation === 'rt'
    ) {
      const warmupH_pathB = getStarterFridgeWarmupH(kitchenTemp);
      const nowMs_pathB = Date.now();
      const refreshMs_pathB = _starterRefeedTime.getTime();
      const refreshPeakMs = refreshMs_pathB + _adjPeakH_refresh * 3600000;
      const idealMixTime_pathB = targetMixTime ?? new Date(bakeMs - ((sweetFromHBF + sweetToHBF) / 2) * 3600000);
      const baseFeed_pathB = new Date(idealMixTime_pathB.getTime() - adjPeakH * 3600000);
      const searchStart_pathB = targetMixTime
        ? new Date(baseFeed_pathB.getTime() - 15 * 60000)
        : new Date(baseFeed_pathB.getTime() - 24 * 3600000);
      const searchEnd_pathB = targetMixTime
        ? new Date(baseFeed_pathB.getTime() + 15 * 60000)
        : new Date(baseFeed_pathB.getTime() + 2 * 3600000);
      const minHoldH = 6;
      const maxHoldH = 120; // 5 days
      const minGapFromRefreshPeakH = 24; // require at least 24h between refresh peak and pre-mix

      if (!inBlockerMs(refreshMs_pathB)) {
        for (let t = searchStart_pathB.getTime(); t <= searchEnd_pathB.getTime(); t += 15 * 60000) {
          if (t <= nowMs_pathB) continue;
          // Pre-mix peak = mix
          const peakT = new Date(t + adjPeakH * 3600000);
          const mHBF  = (bakeMs - peakT.getTime()) / 3600000;
          if (mHBF < sweetToHBF - 4 || mHBF > sweetFromHBF + 4) continue;
          if (bakeMs - mHBF * 3600000 <= nowMs_pathB) continue;
          if (inBlocker(mHBF)) continue;
          if (inBlockerMs(t)) continue;

          // Fridge timing: in at refresh peak, out at pre-mix - warmupH
          const fridgeInMs  = refreshPeakMs;
          const fridgeOutMs = t - warmupH_pathB * 3600000;
          if (fridgeOutMs <= fridgeInMs) continue; // negative hold
          const holdH = (fridgeOutMs - fridgeInMs) / 3600000;
          if (holdH < minHoldH || holdH > maxHoldH) continue;
          if (fridgeOutMs <= refreshPeakMs) continue;  // pre-mix must come at or after refresh peak
          if ((fridgeOutMs - refreshPeakMs) / 3600000 < minGapFromRefreshPeakH - 1) continue;
          if (inBlockerMs(fridgeInMs)) continue;
          if (inBlockerMs(fridgeOutMs)) continue;

          const sc = combinedScore(mHBF, mHBF, t, true);
          const ss = starterScore(mHBF, mHBF);
          if (ss === 0) continue;

          // Bonus: cleaner than multi-refresh-at-RT for far bakes.
          // Scales with RT refreshes avoided.
          const gapFromNowToPreMixH = (t - nowMs_pathB) / 3600000;
          const rtRefreshesAvoided = Math.max(0, Math.floor(gapFromNowToPreMixH / troughH) - 1);
          const pathBBonus = 8 + rtRefreshesAvoided * 3;

          candidates.push({
            mixHBF: mHBF, peakHBF: mHBF, feedMs: t,
            usingPeak2: false, feed2Ms: t,
            score: sc + pathBBonus, sscore: ss,
            isFridgeHoldPath: true,
            isFutureFeedPath: true, // keeps existing winner logic working
            fridgeHoldRefreshMs: refreshMs_pathB,
            fridgeHoldInMs: fridgeInMs,
            fridgeHoldOutMs: fridgeOutMs,
          });
        }
      }
    }

    // ── Pick best candidate ──────────────────────────

    if (candidates.length === 0) {
      // True dead-end: window too short for even a future-feed path.
      const windowH    = (bakeMs - Date.now()) / 3600000;
      const minViableH = sweetToHBF + adjPeakH + 1;
      if (windowH > 0 && windowH < minViableH) {
        _windowTooShort = true;
        _feed2Time = null;
        setRefeedSuggestion(null);
        _driftNote = null;
        buildAndSetResult();
        return;
      }
      _hasFutureFeedPath = false;
      _starterPillState  = 'yellow';
      buildAndSetResult();
      return;
    }

    candidates.sort((a, b) => b.score - a.score);
    let best = candidates[0];
    let foundValid = false;
    for (const cand of candidates) {
      const candMixMs = bakeMs - cand.mixHBF * 3600000;
      const actions: (number | null | undefined)[] = [candMixMs, cand.feedMs, cand.feed2Ms];
      if (cand.isFridgePath) {
        actions.push(candMixMs - getStarterFridgeWarmupH(kitchenTemp) * 3600000);
      }
      if (cand.isFridgeHoldPath) {
        actions.push(cand.fridgeHoldRefreshMs, cand.fridgeHoldInMs, cand.fridgeHoldOutMs);
      }
      if (candidateValid(actions)) {
        best = cand;
        foundValid = true;
        break;
      }
    }
    // If no candidate cleared all blockers, the highest-scoring fallback still
    // violates blocker rules. Surface this honestly via windowTooShort so the
    // baker can adjust bake time or blockers instead of seeing a misleading
    // green-pill plan with diamonds in red zones.
    if (!foundValid || best.score < 250) {
      _windowTooShort = true;
    }

    // If baker manually dragged, always use their chosen mix time.
    // Never snap back — it is the baker's decision.
    // Solver still found best starter protocol for this position.
    const newMix = manualMixOverride ?? new Date(bakeMs - best.mixHBF * 3600000);
    _newPendingStart = newMix;
    onChange(newMix, et, blocks);

    // Compute fridgeOutTime from mix position when fridge starter
    if (starterLocation === 'fridge') {
      const candidateFridgeOut = new Date(newMix.getTime() - warmupH * 3600000);
      _newFridgeOut = candidateFridgeOut.getTime() < Date.now()
        ? new Date()
        : candidateFridgeOut;
    }

    // If fridge path candidate won, apply the suggested fridge-out time
    if (best.isFridgePath && _suggestedFridgeOut && starterLocation === 'fridge') {
      _newFridgeOut = _suggestedFridgeOut;
    }

    _usingPeak2      = best.usingPeak2;
    _feed2Time       = best.feed2Ms ? new Date(best.feed2Ms) : null;
    _starterPillState = best.sscore === 2 ? 'green' : 'yellow';
    setRefeedSuggestion(null);

    // If a future-feed candidate won, override flags accordingly.
    if (best.isFutureFeedPath) {
      _hasFutureFeedPath = true;
      _usingPeak2 = false;
      if (_feed2Time) setRefeedSuggestion(_feed2Time);
    }

    if (best.isFridgeHoldPath) {
      _isFridgeHoldPath = true;
      _fridgeHoldRefreshTime = best.fridgeHoldRefreshMs ? new Date(best.fridgeHoldRefreshMs) : null;
      _fridgeHoldInTime = best.fridgeHoldInMs ? new Date(best.fridgeHoldInMs) : null;
      _fridgeHoldOutTime = best.fridgeHoldOutMs ? new Date(best.fridgeHoldOutMs) : null;
    }

    // Drift note for yellow positions
    if (best.sscore < 2 && doughScore(best.mixHBF) < 2) {
      _driftNote = isFr
        ? 'Timing légèrement décalé — la pâte sera quand même bonne.'
        : 'Timing slightly off — your dough will still be great.';
    } else if (best.sscore < 2) {
      _driftNote = isFr
        ? 'Le levain sera légèrement passé son pic — toujours bon.'
        : 'Starter slightly past peak at mix — still good.';
    } else if (doughScore(best.mixHBF) < 2) {
      _driftNote = isFr
        ? 'Fenêtre un peu courte — la pâte sera bonne quand même.'
        : 'Window a little tight — dough will still be good.';
    } else {
      _driftNote = null;
    }

    // If baker manually dragged, compute advisory next-feed time so starter
    // peaks at their chosen mix time. This updates the feed diamond
    // independently of which candidate won the scoring.
    if (targetMixTime && !best.isFutureFeedPath && !best.usingPeak2) {
      const advisoryFeed = new Date(targetMixTime.getTime() - adjPeakH * 3600000);
      if (advisoryFeed.getTime() > Date.now()) {
        // Feed is in the future — show as recommended next feed
        _hasFutureFeedPath = true;
        _feed2Time = advisoryFeed;
      } else {
        // Feed is in the past — starter already peaked or declining at mix time.
        // Show feed1 as the relevant feed, pill reflects honest state.
        // _feed2Time stays null, _starterFeedTime will use lastFedTime.
        // _starterPillState already set by scoring — may be yellow/green.
      }
    }

    const activeFeed = (best.isFutureFeedPath || best.usingPeak2) && best.feed2Ms
      ? new Date(best.feed2Ms)
      : lastFedTime ?? new Date(best.feedMs);
    onFeedTimeChange?.(activeFeed);
    if ((best.isFutureFeedPath || best.usingPeak2) && best.feed2Ms) {
      onFeed2TimeChange?.(new Date(best.feed2Ms));
    }

    // For fridge starters, compute optimal feed time so the graph bell is anchored correctly.
    if (starterLocation === 'fridge' && adjPeakH) {
      const _wh2 = 1.5;
      const _fph2 = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10) * adjPeakH;
      const _optFeed = new Date(_newPendingStart.getTime() - (_wh2 + _fph2) * 3600000);
      if (_optFeed.getTime() > Date.now()) {
        const _hf = _optFeed.getHours();
        const _adj = new Date(_optFeed);
        if (_hf < 7) { _adj.setHours(7, 0, 0, 0); }
        else if (_hf > 22) { _adj.setHours(7, 0, 0, 0); _adj.setDate(_adj.getDate() + 1); }
        _fridgeFeedTime = _adj;
      }
    }

    buildAndSetResult();
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
    if (isSourdough && eatTimeSet) {
      setHasDragged(false);
      hasManuallyDragged.current = false;
      // Pass newBlocks directly — blocks prop hasn't updated yet (parent re-renders async).
      // No manualMixOverride — let solver freely find best position avoiding blockers.
      findOptimalPositionSourdough(pendingEatTime, undefined, newBlocks);
      setLocalBlocks(newBlocks);
    } else if (!hasManuallyDragged.current && phase === 'start_confirm') {
      computeAndApplyRecommendation(newBlocks, pendingEatTime);
    }
  }

  function toggleWork() {
    const newBlocks = isWorkActive
      ? _effectiveBlocks.filter(b => !b.label.startsWith('Work · '))
      : [..._effectiveBlocks, ...workdays.map(d => ({ from: d.blockStart, to: d.blockEnd, label: d.label }))];
    applyAndUpdate(newBlocks);
  }

  function isAnyNightActive(): boolean {
    return nights.some(n => _effectiveBlocks.some(b => b.label === n.label));
  }

  function toggleAllNights() {
    const anyActive = isAnyNightActive();
    const nightLabels = new Set(nights.map(n => n.label));
    const withoutNights = _effectiveBlocks.filter(b => !nightLabels.has(b.label));
    const newBlocks = anyActive
      ? withoutNights
      : [...withoutNights, ...nights.map(n => ({ from: n.blockStart, to: n.blockEnd, label: n.label }))];
    applyAndUpdate(newBlocks);
  }

  function removeBlock(index: number) {
    applyAndUpdate(_effectiveBlocks.filter((_, i) => i !== index));
  }

  function addCustomBlock() {
    const from = new Date(customFrom);
    const to   = new Date(customTo);
    if (!customLabel.trim() || isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return;
    applyAndUpdate([..._effectiveBlocks, { from, to, label: customLabel.trim() }]);
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
          <div style={{ flex: 2, position: 'relative' }}>
            <div style={{
              ...INPUT_STYLE, width: '100%',
              display: 'flex', alignItems: 'center',
              color: pickerDate ? 'var(--char)' : 'var(--smoke)',
              position: 'relative', zIndex: 1, cursor: 'pointer',
              pointerEvents: 'none',
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
              onClick={e => {
                // Desktop browsers need showPicker() to open the calendar.
                // iOS opens natively on tap — showPicker() throws or no-ops there.
                // Single handler on the input itself — no double-trigger.
                try {
                  (e.currentTarget as HTMLInputElement).showPicker?.();
                } catch {
                  // iOS or older browsers — native behavior already opens picker
                }
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
                    setHasDragged(false);
                    hasManuallyDragged.current = false;
                    if (isSourdough) {
                      const sfDef = STYLE_FERM_DEFAULTS[styleKey ?? ''] ?? FERM_FALLBACK;
                      const sweetCenter = ((sfDef.preferredColdH ?? sfDef.coldH ?? 0)
                        + sfDef.rtH + (sfDef.minTotalFermH ?? 12)) / 2;
                      setPendingStart(new Date(pendingEatTime.getTime() - sweetCenter * 3600000));
                    }
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
                  onClick={() => { setStarterMature(opt.value); }}
                  style={starterPillButton(starterMature === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => { setStarterHasRye(!starterHasRye); }}
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
          {isSourdough && solverResult?.fridgeSuggestion && starterLocation === 'rt' && (
            <div style={{
              fontSize: '.7rem',
              color: 'var(--smoke)',
              fontFamily: 'var(--font-dm-sans)',
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}>
              {solverResult.fridgeSuggestion}
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
        {(
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

      {windowTooShort && eatTimeSet && !isSourdough && (
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
          {!isSourdough && bakeType === 'bread' && suggestedBakeTimeBread && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>
                {isFr ? 'Essayez plutôt :' : 'Try instead:'}
              </div>
              <button
                onClick={() => {
                  setPendingEatTime(suggestedBakeTimeBread);
                  setEatTimeSet(true);
                  onChange(pendingStart, suggestedBakeTimeBread, blocks);
                  setSuggestedBakeTimeBread(null);
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
                {fmtCardDT(suggestedBakeTimeBread, isFr)} →
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
      {isSourdough && lastFedAge === null && (
        <div style={{
          padding: '24px 20px',
          textAlign: 'center',
          color: 'var(--smoke)',
          fontFamily: 'var(--font-dm-sans)',
          fontSize: '13px',
          lineHeight: 1.6,
        }}>
          {isFr
            ? 'Indiquez quand votre levain a été nourri pour voir votre plan.'
            : 'Tell us when your starter was last fed to see your plan.'}
        </div>
      )}
      <div style={{ marginBottom: startInvalid ? '.5rem' : '1rem', display: isSourdough && lastFedAge === null ? 'none' : undefined }}>
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
                if (isSourdough) {
                  findOptimalPositionSourdough(pendingEatTime, newStart);
                }
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
                const _fridgeOutTime = solverResult?.fridgeOutTime ?? fridgeOutTime;
                if (_fridgeOutTime) {
                  return Math.max(1,
                    (pendingStart.getTime() - _fridgeOutTime.getTime()) / 3600000
                    + warmupH
                  );
                }
                const activeFeed = solverResult?.usingPeak2 && solverResult?.feed2Time
                  ? solverResult.feed2Time
                  : solverResult?.feedTime ?? null;
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
              blocks={isSourdough ? localBlocks : blocks}
              recommendedMixHBF={recommendedHBF}
              showZoneLabels={zonesOpen}
              hasDragged={hasDragged}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => setIsDragging(false)}
              sweetCenterH={renderSweetCenter}
              sweetFromH={renderSweetFrom}
              sweetToH={renderSweetTo}
              nowHBF={(pendingEatTime.getTime() - Date.now()) / 3600000}
              starterFeedTime={solverResult?.starterFeedTime ?? null}
              starterFeed2Time={solverResult?.starterFeed2Time ?? null}
              starterFridgeOutTime={isSourdough ? (solverResult?.fridgeOutTime ?? fridgeOutTime) : null}
              starterKnownPeakTime={
                (isSourdough && starterLocation === 'fridge')
                  ? (solverResult?.starterKnownPeakTime ?? null)
                  : (solverResult?.peakTime ?? solverResult?.starterKnownPeakTime ?? null)
              }
              starterIsDepletedAt={solverResult?.starterIsDepletedAt ?? null}
              starterRefeedTime={solverResult?.starterRefeedTime ?? null}
              starterIntermediateFeeds={solverResult?.starterIntermediateFeeds ?? []}
              starterMature={starterMature}
              starterAdjPeakH={solverResult?.adjPeakHValue ?? null}
              starterHasRye={isSourdough ? starterHasRye : false}
              starterRedPill={solverResult?.starterRedPill ?? false}
              starterFeed2OutOfZone={solverResult?.starterFeed2OutOfZone ?? false}
              comparisonFridgeOutTime={solverResult?.comparisonFridgeOutTime ?? null}
              comparisonFridgePeakTime={solverResult?.comparisonFridgePeakTime ?? null}
              showFridgeComparison={solverResult?.showFridgeComparison ?? false}
              starterFridgeInTime={isSourdough ? (solverResult?.starterFridgeInTime ?? null) : null}
              starterFridgeHoldRefreshTime={isSourdough ? (solverResult?.fridgeHoldRefreshTime ?? null) : null}
              starterFridgeHoldInTime={isSourdough ? (solverResult?.fridgeHoldInTime ?? null) : null}
              starterFridgeHoldOutTime={isSourdough ? (solverResult?.fridgeHoldOutTime ?? null) : null}
              starterPreMixStretchFactor={solverResult?.preMixStretchFactor ?? 1.0}
              starterRefreshStretchFactor={solverResult?.refreshStretchFactor ?? 1.0}
              starterEvents={isSourdough ? (solverResult?.starterEvents ?? []) : []}
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
                if (isSourdough) {
                  findOptimalPositionSourdough(pendingEatTime, newStart);
                }
              }}
              onPrefChange={(offsetH) => {
                hasManuallyDragged.current = true;
                setHasDragged(true);
                setPrefAlgoRed(false);
                if (isSourdough) {
                  const bakeMs = pendingEatTime.getTime();
                  const feedAbsHBF = mixOffsetH + offsetH;
                  const newFeedTime = new Date(bakeMs - feedAbsHBF * 3600000);
                  if (solverResult?.usingPeak2 && solverResult?.adjPeakHValue) {
                    // Feed 2 drag cascades: peak is adjPeakH after feed → mix aligns with peak
                    const newMixHBF = Math.max(_minTotalRT, feedAbsHBF - solverResult.adjPeakHValue);
                    const newMixTime = new Date(bakeMs - newMixHBF * 3600000);
                    onFeed2TimeChange?.(newFeedTime);
                    const inZone = newMixHBF >= renderSweetTo && newMixHBF <= renderSweetFrom;
                    setSolverResult(prev => prev ? { ...prev, feed2Time: newFeedTime, starterPillState: inZone ? 'green' : 'yellow' } : prev);
                    setPendingStart(newMixTime);
                    onChange(newMixTime, pendingEatTime, blocks);
                  } else {
                    // Single cycle: update feed, trigger solver re-run via lastFedTime
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
                const blocksToUse = isSourdough ? localBlocks : blocks;
                computeAndApplyRecommendation(blocksToUse, pendingEatTime);
                if (isSourdough) {
                  findOptimalPositionSourdough(pendingEatTime, undefined, blocksToUse);
                }
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
        const doughZoneFrom = isSourdough && solverResult?.sourdoughSweetFrom !== null && solverResult?.sourdoughSweetFrom !== undefined
          ? solverResult.sourdoughSweetFrom : renderSweetFrom;
        const doughZoneTo   = isSourdough && solverResult?.sourdoughSweetTo !== null && solverResult?.sourdoughSweetTo !== undefined
          ? solverResult.sourdoughSweetTo : renderSweetTo;
        const _windowTooShortRender = solverResult?.windowTooShort ?? false;
        const mixInZone    = mixOffsetH >= doughZoneTo && mixOffsetH <= doughZoneFrom;
        const sourdoughDoughGreen  = isSourdough && !_windowTooShortRender
          && mixOffsetH >= doughZoneTo && mixOffsetH <= doughZoneFrom;
        const sourdoughDoughYellow = isSourdough && !_windowTooShortRender && !sourdoughDoughGreen
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
            {isSourdough && startComputed && lastFedAge !== null && (() => {
              const peakH     = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
              const ratioMult = 1 + 0.35 * Math.log(feedRatio);
              const ryeF      = starterHasRye ? 0.8 : 1.0;
              const matF      = starterMature ? 1.0 : 1.2;
              const adjPeakH  = peakH * ryeF * matF * ratioMult;
              const troughH   = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMult;
              const warmupH   = getStarterFridgeWarmupH(kitchenTemp);
              const mixTime   = pendingStart;

              // Read from solverResult for consistency
              const _usingPeak2      = solverResult?.usingPeak2 ?? false;
              const _feed2Time       = solverResult?.feed2Time ?? null;
              const _feedTime        = solverResult?.feedTime ?? null;
              const _hasFutureFeedPath = solverResult?.hasFutureFeedPath ?? false;
              const _starterPillState  = solverResult?.starterPillState ?? 'yellow';
              const _driftNote         = solverResult?.driftNote ?? null;
              const _starterStateNote  = solverResult?.starterStateNote ?? null;
              const _starterRefeedTime = solverResult?.starterRefeedTime ?? null;
              const _fridgeSuggestion  = solverResult?.fridgeSuggestion ?? null;
              const _adjPeakHState     = solverResult?.adjPeakHValue ?? null;
              const _windowTooShortCard = solverResult?.windowTooShort ?? false;
              const _suggestedBakeTimeCard = solverResult?.suggestedBakeTime ?? null;
              const _activeFridgeOutTime = solverResult?.fridgeOutTime ?? fridgeOutTime;
              const _isFridgeHoldPath        = solverResult?.isFridgeHoldPath ?? false;
              const _fridgeHoldRefreshTime   = solverResult?.fridgeHoldRefreshTime ?? null;
              const _fridgeHoldInTime        = solverResult?.fridgeHoldInTime ?? null;
              const _fridgeHoldOutTime       = solverResult?.fridgeHoldOutTime ?? null;

              // Use pre-computed peakTime from solverResult — same value the chart uses
              const activePeakTime: Date | null = solverResult?.peakTime ?? null;

              const feedPlan: { ft: Date; label: string; note?: string }[] = [];

              if (planningMode === 'last_fed' && lastFedTime && activePeakTime) {
                const now = new Date();
                if (!_usingPeak2) {
                  if (lastFedTime > now) {
                    feedPlan.push({
                      ft: lastFedTime,
                      label: isFr ? 'Rafraîchi' : 'Feed',
                      note: undefined,
                    });
                  }
                  const lastFeedNeeded = new Date(mixTime.getTime() - adjPeakH * 3600000);
                  const gapH = (lastFeedNeeded.getTime() - now.getTime()) / 3600000;
                  let numExtra: number;
                  if (starterLocation === 'fridge') {
                    // Optimal single feed: latest time to feed so starter peaks at mix via fridge
                    const warmupH2 = 1.5;
                    const fridgePeakH2 = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10) * adjPeakH;
                    const optimalFeedTime = new Date(mixTime.getTime() - (warmupH2 + fridgePeakH2) * 3600000);
                    if (optimalFeedTime.getTime() > now.getTime()) {
                      feedPlan.length = 0;
                      const hf = optimalFeedTime.getHours();
                      const adjustedFeed = new Date(optimalFeedTime);
                      if (hf < 7) { adjustedFeed.setHours(7, 0, 0, 0); }
                      else if (hf > 22) { adjustedFeed.setHours(7, 0, 0, 0); adjustedFeed.setDate(adjustedFeed.getDate() + 1); }
                      feedPlan.push({
                        ft: adjustedFeed,
                        label: isFr ? 'Rafraîchir' : 'Feed',
                        note: isFr
                          ? 'Rafraîchir puis mettre au frais — pic au moment du pétrissage'
                          : 'Feed then refrigerate — timed to peak at mix',
                      });
                      numExtra = 0;
                    } else {
                      // Optimal fridge feed time passed. Check if feeding now + RT peaks near mix.
                      const rtPeakIfFeedNow = new Date(Date.now() + adjPeakH * 3600000);
                      const rtGapH = (mixTime.getTime() - rtPeakIfFeedNow.getTime()) / 3600000;
                      if (Math.abs(rtGapH) <= adjPeakH * 0.15 + 0.5) {
                        feedPlan.length = 0;
                        feedPlan.push({
                          ft: new Date(),
                          label: isFr ? 'Rafraîchir maintenant' : 'Feed now',
                          note: isFr
                            ? 'Votre levain atteindra son pic au moment du pétrissage'
                            : 'Your starter will peak around mix time',
                        });
                        numExtra = 0;
                      } else {
                        numExtra = Math.floor(gapH / troughH);
                      }
                    }
                  } else {
                    numExtra = Math.floor(gapH / troughH);
                  }
                  if (numExtra > 0) {
                    feedPlan.length = 0;
                    // When hasFutureFeedPath, only generate intermediate feeds (i < numExtra),
                    // not the final entry — that comes from feed2Time below.
                    const loopMax = _hasFutureFeedPath ? numExtra - 1 : numExtra;
                    // Skip i=0 when standalone REFRESH FEED block is shown (avoids duplicate)
                    const loopStart = (_starterRefeedTime && !_usingPeak2) ? 1 : 0;
                    for (let i = loopStart; i <= loopMax; i++) {
                      const ft = new Date(now.getTime() + i * troughH * 3600000);
                      const h = ft.getHours();
                      if (h < 7) { ft.setHours(7, 0, 0, 0); }
                      else if (h > 22) { ft.setHours(7, 0, 0, 0); ft.setDate(ft.getDate() + 1); }
                      const isLast = i === numExtra;
                      const _nextFt = new Date(ft.getTime() + troughH * 3600000); void _nextFt;
                      feedPlan.push({
                        ft,
                        label: isLast
                          ? (isFr ? 'Rafraîchi final' : 'Pre-mix Feed')
                          : (isFr ? `Rafraîchi ${i + 1}` : `Refresh Feed ${i + 1}`),
                        note: isLast
                          ? (() => {
                              const stretchFactor = solverResult?.preMixStretchFactor ?? 1.0;
                              const peakAt = new Date(ft.getTime() + adjPeakH * stretchFactor * 3600000);
                              return isFr
                                ? `Pic vers ${fmtCardHM(peakAt, isFr)}`
                                : `Peak around ${fmtCardHM(peakAt, isFr)}`;
                            })()
                          : undefined,
                      });
                    }
                  }
                  // When solver computed exact feed2Time via future-feed path,
                  // use it as the pre-mix feed — more accurate than RT numExtra calculation.
                  if (_hasFutureFeedPath && _feed2Time) {
                    feedPlan.push({
                      ft: _feed2Time,
                      label: isFr ? 'Rafraîchi final' : 'Pre-mix Feed',
                      note: (() => {
                        const stretchFactor = solverResult?.preMixStretchFactor ?? 1.0;
                        const peakAt = new Date(_feed2Time.getTime() + adjPeakH * stretchFactor * 3600000);
                        return isFr
                          ? `Pic vers ${fmtCardHM(peakAt, isFr)}`
                          : `Peak around ${fmtCardHM(peakAt, isFr)}`;
                      })(),
                    });
                  }
                } else if (_usingPeak2 && _feed2Time) {
                  feedPlan.push({
                    ft: _feed2Time,
                    label: isFr ? 'Prochain rafraîchi' : 'Next Feed',
                    note: (() => {
                      const isRefeedNow = Math.abs(_feed2Time.getTime() - Date.now()) < 30 * 60 * 1000;
                      return isRefeedNow
                        ? (isFr ? 'Rafraîchir maintenant pour un pic plus fort' : 'Feed now for a stronger peak')
                        : (isFr ? 'Rafraîchi actif pour cette cuisson' : 'Active feed for this bake');
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

                  {/* Event-driven render (sourdough only) — replaces feedPlan + standalone blocks */}
                  {isSourdough && solverResult?.starterEvents && solverResult.starterEvents.length > 0 && (() => {
                    const events = solverResult.starterEvents;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginBottom: '.6rem' }}>
                        {events.map((ev, i) => {
                          if (ev.kind === 'last_fed' && ev.isPast) return null;
                          const timeStr = ev.cardTimeFormat === 'relative'
                            ? (() => {
                                const fifteen = 15 * 60 * 1000;
                                const rounded = new Date(Math.ceil(ev.time.getTime() / fifteen) * fifteen);
                                const hm = fmtCardHM(rounded, isFr);
                                return isFr ? `Maintenant · ${hm}` : `Now · ${hm}`;
                              })()
                            : fmtCardDT(ev.time, isFr);
                          const labelUpper = ev.label.toUpperCase();
                          return (
                            <div key={`ev-card-${i}`}>
                              <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                {labelUpper}
                              </div>
                              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                                {timeStr}
                              </div>
                              {ev.cardNote && (
                                <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '2px' }}>
                                  {ev.cardNote}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Future feed path: planned Next Feed */}
                  {!solverResult?.starterEvents?.length && isSourdough && _hasFutureFeedPath && _feed2Time && feedPlan.length === 0 && planningMode !== 'last_fed' && !_isFridgeHoldPath && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isFr ? 'RAFRAÎCHI FINAL' : 'PRE-MIX FEED'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                        {(() => {
                          const isNow = Math.abs(_feed2Time.getTime() - Date.now()) < 30 * 60 * 1000;
                          return isNow ? (isFr ? 'Maintenant' : 'Now') : fmtCardDT(_feed2Time, isFr);
                        })()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '2px' }}>
                        {isFr
                          ? 'Rafraîchi pour que le levain soit prêt au pétrissage'
                          : 'Feed so your starter peaks at mix time'}
                      </div>
                    </div>
                  )}

                  {!solverResult?.starterEvents?.length && isSourdough && _starterRefeedTime && !_usingPeak2 && !_isFridgeHoldPath && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                        textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isFr ? 'RAFRAÎCHI' : 'REFRESH FEED'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)',
                        fontFamily: 'var(--font-dm-mono)' }}>
                        {(() => {
                          const fifteen = 15 * 60 * 1000;
                          const rounded = new Date(Math.ceil(_starterRefeedTime.getTime() / fifteen) * fifteen);
                          const timeStr = fmtCardHM(rounded, isFr);
                          return isFr ? `Maintenant · ${timeStr}` : `Now · ${timeStr}`;
                        })()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)',
                        lineHeight: 1.4, marginTop: '2px' }}>
                        {(() => {
                          const stretchFactor = solverResult?.refreshStretchFactor ?? 1.0;
                          const adjPeakH_eff = solverResult?.adjPeakHValue ?? null;
                          if (!adjPeakH_eff || !_starterRefeedTime) {
                            return isFr ? 'Rafraîchir maintenant pour un pic plus fort' : 'Feed now for a stronger peak';
                          }
                          const peakTime = new Date(_starterRefeedTime.getTime() + adjPeakH_eff * stretchFactor * 3600000);
                          return isFr
                            ? `Pic vers ${fmtCardHM(peakTime, isFr)}`
                            : `Peak around ${fmtCardHM(peakTime, isFr)}`;
                        })()}
                      </div>
                    </div>
                  )}

                  {!solverResult?.starterEvents?.length && _usingPeak2 && _feed2Time && feedPlan.length === 0 && !_isFridgeHoldPath && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isFr ? 'PROCHAIN RAFRAÎCHI' : 'NEXT FEED'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                        {(() => {
                          const isNow = Math.abs(_feed2Time.getTime() - Date.now()) < 30 * 60 * 1000;
                          return isNow ? (isFr ? 'Maintenant' : 'Now') : fmtCardDT(_feed2Time, isFr);
                        })()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '1px' }}>
                        {isFr ? 'Rafraîchir pour un pic plus fort' : 'Feed for a stronger peak'}
                      </div>
                    </div>
                  )}

                  {_fridgeSuggestion && starterLocation === 'rt' && (
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
                      {_fridgeSuggestion}
                    </div>
                  )}

                  {!solverResult?.starterEvents?.length && _isFridgeHoldPath && _fridgeHoldRefreshTime && _fridgeHoldInTime && _fridgeHoldOutTime && _feed2Time && (
                    <>
                      {/* REFRESH FEED */}
                      <div style={{ marginBottom: '.6rem' }}>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          {isFr ? 'RAFRAÎCHI' : 'REFRESH FEED'}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                          {(() => {
                            const fifteen = 15 * 60 * 1000;
                            const rounded = new Date(Math.ceil(_fridgeHoldRefreshTime.getTime() / fifteen) * fifteen);
                            const timeStr = fmtCardHM(rounded, isFr);
                            return isFr ? `Maintenant · ${timeStr}` : `Now · ${timeStr}`;
                          })()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '2px' }}>
                          {(() => {
                            const stretchFactor = solverResult?.refreshStretchFactor ?? 1.0;
                            const adjPeakH_eff = solverResult?.adjPeakHValue ?? null;
                            if (!adjPeakH_eff) {
                              return isFr ? 'Rafraîchir, laisser pousser, puis réfrigérer' : 'Feed, let peak, then refrigerate';
                            }
                            const peakTime = new Date(_fridgeHoldRefreshTime.getTime() + adjPeakH_eff * stretchFactor * 3600000);
                            return isFr
                              ? `Pic vers ${fmtCardHM(peakTime, isFr)} — puis au frigo`
                              : `Peak around ${fmtCardHM(peakTime, isFr)} — then refrigerate`;
                          })()}
                        </div>
                      </div>

                      {/* INTO FRIDGE */}
                      <div style={{ marginBottom: '.6rem' }}>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          {isFr ? 'AU FRIGO' : 'INTO FRIDGE'}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                          {fmtCardDT(_fridgeHoldInTime, isFr)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '2px' }}>
                          {isFr
                            ? 'Au pic — ralentit la fermentation'
                            : 'At peak — slows fermentation'}
                        </div>
                      </div>

                      {/* OUT OF FRIDGE */}
                      <div style={{ marginBottom: '.6rem' }}>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          {isFr ? 'SORTIE DU FRIGO' : 'OUT OF FRIDGE'}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                          {fmtCardDT(_fridgeHoldOutTime, isFr)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '2px' }}>
                          {(() => {
                            const warmupMin = Math.round(getStarterFridgeWarmupH(kitchenTemp) * 60);
                            return isFr
                              ? `Tempérer ~${warmupMin} min avant le rafraîchi final`
                              : `Warm up ~${warmupMin} min before pre-mix feed`;
                          })()}
                        </div>
                      </div>

                      {/* PRE-MIX FEED */}
                      <div style={{ marginBottom: '.6rem' }}>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          {isFr ? 'RAFRAÎCHI FINAL' : 'PRE-MIX FEED'}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                          {fmtCardDT(_feed2Time, isFr)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '2px' }}>
                          {(() => {
                            const stretchFactor = solverResult?.preMixStretchFactor ?? 1.0;
                            const peakAt = new Date(_feed2Time.getTime() + adjPeakH * stretchFactor * 3600000);
                            return isFr
                              ? `Pic vers ${fmtCardHM(peakAt, isFr)}`
                              : `Peak around ${fmtCardHM(peakAt, isFr)}`;
                          })()}
                        </div>
                      </div>
                    </>
                  )}

                  {(!isSourdough || !solverResult?.starterEvents?.length) && feedPlan.length > 0 && !_isFridgeHoldPath && (
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

                  {(!isSourdough || !solverResult?.starterEvents?.length) && starterLocation === 'fridge' && _activeFridgeOutTime && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isFr ? 'SORTIR DU FRIGO' : 'REMOVE FROM FRIDGE'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                        {fmtCardDT(_activeFridgeOutTime, isFr)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.4, marginTop: '1px' }}>
                        {isFr
                          ? `~${Math.round(warmupH * 60)} min pour atteindre la temp. ambiante`
                          : `~${Math.round(warmupH * 60)} min to reach room temp`}
                      </div>
                    </div>
                  )}

                  {activePeakTime && activePeakTime > new Date() && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isFr ? 'PIC' : 'PEAK'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                        {fmtCardDT(activePeakTime, isFr)}
                      </div>
                    </div>
                  )}

                  {(() => {
                    // During active drag, compute pill directly from mix position vs peak
                    // so baker gets immediate feedback without waiting for async solver rerun.
                    const dragGapH = isSourdough && hasDragged && _adjPeakHState
                      ? (() => {
                          const peakMs = (() => {
                            if (planningMode === 'know_peak' && knownPeakTime) return knownPeakTime.getTime();
                            const base = (_usingPeak2 || _hasFutureFeedPath) && _feed2Time
                              ? _feed2Time
                              : lastFedTime ?? _feedTime;
                            return base ? base.getTime() + (_adjPeakHState) * 3600000 : null;
                          })();
                          return peakMs ? Math.abs((pendingStart.getTime() - peakMs) / 3600000) : null;
                        })()
                      : null;
                    const rtTOLDrag = _adjPeakHState ? Math.max(1.0, Math.min(3.0, _adjPeakHState * 0.15)) : 2.0;
                    const pillGreen = !_windowTooShortCard
                      && (dragGapH !== null ? dragGapH <= rtTOLDrag : _starterPillState === 'green');
                    const pillText = pillGreen
                      ? (isFr ? 'Prêt au mélange' : 'Ready at mix')
                      : _windowTooShortCard
                        ? (isFr ? 'Fenêtre courte — voir le plan' : 'Window tight — see plan')
                        : _hasFutureFeedPath && _feed2Time
                          ? (isFr
                              ? `Rafraîchir le ${fmtCardDT(_feed2Time, true)}`
                              : `Feed ${fmtCardDT(_feed2Time, false)}`)
                          : _starterPillState === 'yellow' && _activeFridgeOutTime
                            ? (isFr
                                ? `Sortir du frigo — ${fmtCardDT(_activeFridgeOutTime, isFr)}`
                                : `Remove from fridge — ${fmtCardDT(_activeFridgeOutTime, isFr)}`)
                            : (() => {
                                const adjPeakH2 = _adjPeakHState ?? 8;
                                const baseFeedMs = (() => {
                                  if (planningMode === 'know_peak' && knownPeakTime) return knownPeakTime.getTime() - adjPeakH2 * 3600000;
                                  if (_hasFutureFeedPath && _feed2Time) return _feed2Time.getTime();
                                  if (_usingPeak2 && _feed2Time) return _feed2Time.getTime();
                                  return lastFedTime?.getTime() ?? _feedTime?.getTime() ?? null;
                                })();
                                if (!baseFeedMs) return isFr ? 'En cours de montée' : 'Still rising';
                                const peakMs = planningMode === 'know_peak' && knownPeakTime
                                  ? knownPeakTime.getTime()
                                  : baseFeedMs + adjPeakH2 * 3600000;
                                const gapH = (pendingStart.getTime() - peakMs) / 3600000;
                                if (gapH < -0.5)  return isFr ? 'En cours de montée' : 'Still rising';
                                if (gapH <= 1.5)  return isFr ? 'Au pic au mélange' : 'At peak at mix';
                                if (gapH <= 3.5)  return isFr ? 'Légèrement après le pic' : 'Just past peak';
                                return isFr ? 'Passé le pic — surveiller' : 'Past peak — watch closely';
                              })();
                    return (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        gap: '.3rem', marginTop: '.3rem',
                        background: pillGreen ? 'rgba(74,122,58,0.1)' : 'rgba(212,168,83,0.15)',
                        border: `1px solid ${pillGreen ? 'rgba(74,122,58,0.3)' : 'rgba(212,168,83,0.4)'}`,
                        borderRadius: '20px',
                        padding: '.2rem .65rem',
                        fontSize: '12px',
                        color: pillGreen ? '#4A7A3A' : '#9A7010',
                        fontFamily: 'var(--font-dm-mono)',
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: pillGreen ? '#4A7A3A' : '#9A7010',
                          flexShrink: 0,
                        }} />
                        {pillText}
                      </div>
                    );
                  })()}

                  {solverResult?.planExplanation && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--char)',
                      fontFamily: 'var(--font-dm-sans)',
                      lineHeight: 1.5,
                      marginTop: '.5rem',
                    }}>
                      {solverResult.planExplanation}
                    </div>
                  )}
                  {!solverResult?.planExplanation && _starterStateNote
                    && !(_hasFutureFeedPath && _feed2Time && feedPlan.length === 0 && _feed2Time.getTime() - Date.now() > 30 * 60 * 1000)
                    && (
                    <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5, marginTop: '.5rem' }}>
                      {_starterStateNote}
                    </div>
                  )}
                  {!solverResult?.planExplanation && _driftNote && (
                    <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5, marginTop: '.4rem' }}>
                      {_driftNote}
                    </div>
                  )}

                  {isSourdough && !solverResult?.planExplanation && feedPlan.length === 0 && (_starterRefeedTime && !_hasFutureFeedPath || _usingPeak2 && _feed2Time || _hasFutureFeedPath && _feed2Time) && (
                    <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)',
                      lineHeight: 1.5, marginTop: '6px' }}>
                      {_starterRefeedTime && !_hasFutureFeedPath
                        ? (isFr ? 'Rafraîchir maintenant — votre levain atteindra son pic au moment du pétrissage.'
                                : 'Feed now — your starter will peak around mix time.')
                        : _usingPeak2 && _feed2Time
                          ? (isFr ? `Rafraîchir le ${fmtCardDT(_feed2Time, true)} pour un pic au moment du pétrissage.`
                                  : `Feed ${fmtCardDT(_feed2Time, false)} — timed to peak at mix.`)
                          : _hasFutureFeedPath && _feed2Time
                            ? (isFr ? 'Votre levain actuel ne peut pas atteindre le moment du mélange — un nouveau repas le synchronise.'
                                    : "Current cycle can't reach mix time — a fresh feed gets it in sync.")
                            : null}
                    </div>
                  )}

                  {isSourdough && (
                    <div style={{ marginTop: '8px' }}>
                      <button onClick={() => setShowStarterTips(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--smoke)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', flexShrink: 0 }}>i</span>
                        {isFr ? 'Signes que votre levain est prêt' : 'Signs your starter is ready'}
                      </button>
                      {showStarterTips && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--smoke)',
                          fontFamily: 'var(--font-dm-sans)', lineHeight: 1.6,
                          borderLeft: '2px solid var(--border)', paddingLeft: '8px' }}>
                          {isFr
                            ? "Dôme bombé · Odeur alcoolisée et légèrement acide · Texture bulleuse · Flotte dans l'eau"
                            : 'Domed top · Alcoholic, slightly sour smell · Bubbly texture · Floats in water'}
                        </div>
                      )}
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
                      borderRadius: '20px', padding: '.2rem .65rem',
                      fontSize: '12px', color, fontFamily: 'var(--font-dm-mono)',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
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
                // Dough peak position relative to bake. Matches bell physics:
                //   _doughPeakHBF > 0 → peak BEFORE bake → still rising at bake
                //   _doughPeakHBF < 0 → peak AFTER bake → over-fermenting past bake
                //   _doughPeakHBF ≈ 0 → peak AT bake (sweet spot)
                const _doughPeakHBF = mixOffsetH - renderSweetCenter;
                const pillText   = isSourdough
                  ? (sourdoughDoughGreen
                      ? (isFr ? 'Pâte prête à la cuisson' : 'Dough ready at bake')
                      : sourdoughDoughYellow && _doughPeakHBF > 0.5
                        ? (isFr ? 'Encore en fermentation — devrait être bien'
                                : 'Still rising at bake — should be fine')
                        : sourdoughDoughYellow && _doughPeakHBF < -0.5
                        ? (isFr ? 'Pic après la cuisson — surveiller la surfermentation'
                                : 'Dough peaks after bake — watch for over-fermentation')
                        : sourdoughDoughYellow
                        ? (isFr ? 'Proche du pic — devrait être bien'
                                : 'Near peak — should be fine')
                        : mixOffsetH > doughZoneFrom + 2
                        ? (isFr ? 'Pétrissage trop tôt — risque de surfermentation'
                                : 'Mix too early — over-fermentation risk')
                        : (isFr ? 'Fenêtre de fermentation courte — risque de sous-fermentation'
                                : 'Short fermentation window — under-fermentation risk'))
                  : mixStatus;
                return (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                    marginTop: '.3rem',
                    background: pillGreen ? 'rgba(74,122,58,0.1)' : pillYellow ? 'rgba(212,168,83,0.15)' : 'rgba(196,82,42,0.1)',
                    border: `1px solid ${pillGreen ? 'rgba(74,122,58,0.3)' : pillYellow ? 'rgba(212,168,83,0.4)' : 'rgba(196,82,42,0.3)'}`,
                    borderRadius: '20px',
                    padding: '.2rem .65rem',
                    fontSize: '12px',
                    color: pillGreen ? '#4A7A3A' : pillYellow ? '#9A7010' : '#C4522A',
                    fontFamily: 'var(--font-dm-mono)',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
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
              {isSourdough && _windowTooShortRender && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--terra)', fontFamily: 'var(--font-dm-mono)' }}>
                    {isFr ? 'Pas assez de temps pour ce créneau' : 'Not enough time for this bake'}
                  </div>
                  {bakeType === 'bread' && solverResult?.suggestedBakeTime && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>
                        {isFr ? 'Essayez plutôt :' : 'Try instead:'}
                      </div>
                      <button
                        onClick={() => {
                          const sugBakeTime = solverResult?.suggestedBakeTime;
                          if (!sugBakeTime) return;
                          setPendingEatTime(sugBakeTime);
                          setEatTimeSet(true);
                          onChange(pendingStart, sugBakeTime, blocks);
                          setHasDragged(false);
                        }}
                        style={{
                          padding: '.2rem .65rem',
                          borderRadius: '20px',
                          border: '1.5px solid var(--terra)',
                          background: '#FEF4EF',
                          color: 'var(--terra)',
                          fontFamily: 'var(--font-dm-mono)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {fmtCardDT(solverResult.suggestedBakeTime, isFr)} →
                      </button>
                    </div>
                  )}
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
