'use client';
import { BREAD_FERMENTATION_DEFAULTS, getBreadProtocol, breadActiveCookMinutes } from '../utils/breadProfiles';
import { useState, useMemo, useEffect, useRef, useId } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type AvailabilityBlock, type ScheduleResult, hoursLabel, requiredPrefWarmupH, findScheduleRepair } from '../utils';
import FermentChart, { scheduleColdIntervals, getPrefOptH, getPrefPeakH_RT, getStarterTroughH, getStarterFridgeWarmupH } from './FermentChart';
import FermentationReadiness from './FermentationReadiness';
import ScheduleTimeline from './ScheduleTimeline';
import ScheduleTimeSlider from './ScheduleTimeSlider';
import ScheduleKeyTimings, {type KeyTimingAnchor} from './ScheduleKeyTimings';
import {assessScheduleDraft} from '../utils/scheduleDraft';
import {proposeScheduleEdit, laterBakeAlternative, scheduleEditSlots, type EditInput, type EditTimes} from '../utils/scheduleEdit';
import { isTimeBlocked, findAvailabilityConflicts, type AvailabilityAction } from '../utils/scheduleAvailability';
import type { MixerType } from '../data';

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
  hasFridgePhase?: boolean;
  /** Time was derived from a vague chip ("2–3 days ago") — card shows ≈ */
  timeIsEstimate?: boolean;
}

/** Raw commercial start-window bounds, before the solver clips to now.
 * Shared by solving and display so restored plans retain identical guidance.
 */
export function commercialReadinessWindow({ coldH, preferredColdH, rtH, minTotalFermH,
  flourStrength, kitchenTemp, preheatMin, totalWindowH,
}: { coldH: number; preferredColdH?: number; rtH: number; minTotalFermH?: number;
  flourStrength: number; kitchenTemp: number; preheatMin: number; totalWindowH: number;
}): { from: number; to: number } {
  const ftm = Math.max(0.5, Math.min(2.0, flourStrength));
  const scaledColdH = Math.round(coldH * ftm);
  const preferred = Math.round((preferredColdH ?? coldH) * ftm);
  const minimumRT = (kitchenTemp >= 28 ? 0.5 : 1.5) + 1 + preheatMin / 60;
  const expectedColdH = scaledColdH === 0 ? 0
    : totalWindowH >= preferred + minimumRT ? preferred
      : totalWindowH >= scaledColdH + minimumRT ? scaledColdH
        : totalWindowH > minimumRT ? totalWindowH - minimumRT : 0;
  const hasCold = expectedColdH > 0;
  const plateau = hasCold ? Math.round(coldH * .35 * flourStrength) : Math.round(rtH * .75);
  return {
    from: hasCold ? Math.min(72, coldH + rtH + plateau) : rtH + plateau,
    to: minTotalFermH ?? minimumRT + 1,
  };
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
  planConstrained:      boolean;
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
  recommendedNextFeedRatio: 1 | 2 | 4 | 5 | 10 | null;
}

/**
 * Return a mix time that is strictly in the future and strictly before bake.
 * A stale saved mix may be before `now`, while a very short or already-past
 * bake window may have no executable slot at all. Returning null for the
 * latter lets the caller show a blocker instead of emitting a past schedule.
 */
export function futureMixBeforeBake(
  proposed: Date,
  bakeTime: Date,
  now: Date = new Date(),
): Date | null {
  const proposedMs = proposed.getTime();
  const bakeMs = bakeTime.getTime();
  const nowMs = now.getTime();
  if (![proposedMs, bakeMs, nowMs].every(Number.isFinite)) return null;
  if (bakeMs <= nowMs) return null;

  const firstFutureSlotMs = Math.ceil((nowMs + 15 * 60000) / (15 * 60000)) * (15 * 60000);
  const candidateMs = proposedMs > nowMs ? proposedMs : firstFutureSlotMs;
  if (candidateMs >= bakeMs) return null;
  return new Date(candidateMs);
}

/** Keep an unworkable selected preferment visible, but do not call it a usable plan. */
export function solverNotificationAlreadySynced(last: {s: number; e: number} | null, next: {s: number; e: number}, parent: {s: number; e: number | undefined}): boolean {
  return !!last && last.s === next.s && last.e === next.e && parent.s === next.s && parent.e === next.e;
}

export function commercialPrefermentPlanValid({type, inFridge, mixTime, bakeTime, offsetHours, blocks, now = new Date(), alreadyStarted = false}: {
  type: string; inFridge: boolean; mixTime: Date; bakeTime: Date; offsetHours: number;
  blocks: AvailabilityBlock[]; now?: Date; alreadyStarted?: boolean;
}): boolean {
  if (type !== 'poolish' && type !== 'biga') return true;
  const mix = +mixTime, bake = +bakeTime, prep = mix - offsetHours * 3600000;
  const minimum = type === 'biga' ? 12 : inFridge ? 3 : 1;
  if (![mix, bake, prep, offsetHours].every(Number.isFinite) || offsetHours < minimum || prep >= mix || mix >= bake) return false;
  if (!alreadyStarted && prep < +now - 60000) return false;
  return !blocks.some(block => [prep,mix].some(time => time >= +block.from && time < +block.to));
}

/** Reuse the solver's peak-use band; an observed peak cannot move with the bake date. */
export function knownPeakMixUsable(mixTime: Date, peakTime: Date, peakRiseH: number, flourStrength = 1): boolean {
  const gapH = (+mixTime - +peakTime) / 3600000;
  if (![gapH, peakRiseH, flourStrength].every(Number.isFinite) || peakRiseH <= 0) return false;
  const tolerance = Math.max(1, Math.min(3, peakRiseH * 0.15)) * Math.max(0.7, Math.min(1.5, flourStrength));
  return gapH >= -tolerance - 0.5 && gapH <= tolerance;
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
  mixerType?: MixerType;
  numItems?: number;
  confirmedPlan?: boolean;
  styleKey: string;
  kitchenTemp: number;
  schedule?: ScheduleResult | null;
  onChange: (startTime: Date, eatTime: Date, blocks: AvailabilityBlock[], options?: { preservePlan: boolean; prefOffsetHours?: number; starterPlan?: {events:StarterEvent[];fridgeOutTime:Date|null;usingPeak2:boolean;feed2Time:Date|null;starterFridgeInTime:Date|null} }) => void;
  bakeType?: 'pizza' | 'bread';
  isSourdough?: boolean;
  onFeedTimeChange?: (t: Date | null) => void;
  onStarterEventsChange?: (events: StarterEvent[]) => void;
  savedStarterEvents?: StarterEvent[];
  prefermentType?: string;
  onPrefermentValidityChange?: (valid: boolean) => void;
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
  lastFeedRatio?: 1 | 2 | 4 | 5 | 10;
  onLastFeedRatioChange?: (r: 1 | 2 | 4 | 5 | 10) => void;
  nextFeedRatio?: 1 | 2 | 4 | 5 | 10;
  onNextFeedRatioChange?: (r: 1 | 2 | 4 | 5 | 10) => void;
  nextFeedRatioOverride?: 1 | 2 | 4 | 5 | 10 | null;
  onNextFeedRatioOverrideChange?: (r: 1 | 2 | 4 | 5 | 10 | null) => void;
  ratioMode?: 'recommend' | 'keep';
  onRatioModeChange?: (m: 'recommend' | 'keep') => void;
  onStarterPeakTimeChange?: (t: Date | null) => void;
  starterTimingValid?: boolean;
  onStarterTimingValidityChange?: (valid: boolean) => void;
  readyTimeOffsetMinutes?: number;
  readyTimeLabel?: string;
  readyTimeNote?: string;
  mode?: 'simple' | 'custom';   // default 'custom'
  onReady?: () => void;
  onEditingChange?: (editing: boolean) => void;
  sessionRestored?: boolean;
  savedPrefOffsetHours?: number;
  savedPrefGoesInFridge?: boolean;
  recipeGenerated?: boolean;
  fridgeTemp?: number;
  flourStrength?: number;
  startTimeInPast?: boolean;
  tang?: 'mild' | 'balanced' | 'tangy';
  onTangChange?: (t: 'mild' | 'balanced' | 'tangy') => void;
}

type PickerPhase = 'bake_time' | 'start_confirm';
type Scenario = 'plenty' | 'tight' | 'too_short';
type StarterState = 'rt_fed' | 'fridge_unfed' | 'fridge_fed';

// ── Card date+time formatter ─────────────────
// "Fri 28 Mar · 9pm" / "ven. 28 mars · 21h"
export function fmtCardHM(d: Date, isFr = false): string {
  const h = d.getHours(), m = d.getMinutes();
  if (isFr) return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}
export function fmtCardDT(d: Date, isFr = false): string {
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

// ── Unified starter-peak model ───────────────────────────────────────────────
// SINGLE source of truth for "when does a starter peak after a feed at feedMs?"
// A feed placed before its reference peak (yeast not fully matured) stretches its
// own time-to-peak; a feed at/after the reference peak does not. Both the SCORING
// peak (candidate generation) and the DISPLAY peak (chart bell `bellPeakTime` +
// card "Peak around…"/PEAK row) call this with the SAME reference peak, so
// scoring ≡ bell ≡ card by construction and the green pill can never fire while
// the bell still peaks hours after mix (the "false green" class).
//
// refPeakMs is the reference peak the feed is measured against — canonically
// `_starterRefeedTime ? refeed + adjPeakH : lastFed + adjPeakH` (bare adjPeakH),
// matching the bell's `_preMixStretchFactor` reference. adjPeakHEff is the
// temperature/ratio-adjusted peak hours for the ACTIVE ratio in this scope
// (Stage-1 `adjPeakH`, or the per-ratio `adjPeakH_r` inside evaluatePlanForRatio),
// so the same call is correct at every ratio.
function computeStarterPeakMs(feedMs: number, refPeakMs: number | null, adjPeakHEff: number): number {
  return feedMs + adjPeakHEff * computePreMixStretchFactor(feedMs, refPeakMs) * 3600000;
}

// ── Time formatter ────────────────────────────
// "4pm" / "4:30pm" — minutes omitted when zero
export function formatTimeShort(d: Date, isFr = false): string {
  const h = d.getHours(), m = d.getMinutes();
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
export const STYLE_FERM_DEFAULTS: Record<string, {
  coldH: number; rtH: number;
  preferredColdH?: number; minColdH?: number;
  minTotalFermH: number; coldHRequired?: boolean;
}> = {
  ...BREAD_FERMENTATION_DEFAULTS,
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
// Climate-aware warm-fermentation reduction for sourdough. In hot kitchens
// sourdough over-ferments at room temp (Perfect Loaf summer guide; Sourdough
// Journey "two-stage bulk"; Culinary Exploration), so experts SHORTEN the warm
// phase and SHIFT the balance toward cold. The freed warm time is absorbed by
// the existing cold maximization (capped at preferredColdH downstream); coldH /
// minColdH / minTotalFermH are unchanged. Commercial yeast returns baseRtH —
// climate adjusts yeast dose there, not timing. Floors prevent unreasonably
// short warm phases at the extremes.
export function climateRtH(baseRtH: number, kitchenTemp: number, isSourdough: boolean): number {
  if (!isSourdough) return baseRtH;
  if (kitchenTemp >= 33) return Math.max(1.5, baseRtH * 0.45);
  if (kitchenTemp >= 30) return Math.max(2,   baseRtH * 0.60);
  if (kitchenTemp >= 28) return Math.max(2.5, baseRtH * 0.75);
  return baseRtH;
}

// Only suggest a later start when baker has more time than the preferred
// fermentation window — in that case, push start to eatTime − (targetFermH + preheatH)
// so the full fermentation window is used.
// Returns a ±2h range around the suggestion; never suggests midnight–7am.
function computeSuggestion(
  eatTime: Date,
  preheatMin: number,
  styleKey: string,
  kitchenTemp: number,
  isSourdough: boolean,
) {
  const now = new Date();
  const preheatH = preheatMin / 60;
  const totalAvailableH = (eatTime.getTime() - now.getTime()) / 3600000;
  const minFeasibleH = 2 + preheatH;

  const defaults = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;

  // Sourdough gets the stronger climateRtH reduction (0.45–0.75x at 28–33°C+);
  // commercial yeast unchanged. Replaces the prior /tropicalFactor (~1.15) which
  // was too weak AND inconsistently applied (only here; the actual sweet-zone
  // sites used raw defaults.rtH).
  const rtH_adjusted   = climateRtH(defaults.rtH, kitchenTemp, isSourdough);
  const standardFermH  = defaults.coldH + rtH_adjusted;
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
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return [];

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
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return [];

  const nights: Array<{ key: string; label: string; blockStart: Date; blockEnd: Date }> = [];
  // Start one day before blockerWindowStart to catch nights that began before
  // midnight — at 1am, tonight's 11pm start was yesterday, so the cursor must
  // go back one day.
  const cursor = new Date(start); cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  // Cap at 10, not 7. A six-day window plus the day-before cursor yields at
  // most 8, so the window test below is the only filter and the set depends on
  // the window alone. At 7 the cap bit from the front: a window start that
  // moved earlier pushed a night NEAR THE BAKE out of the array, so which
  // nights existed depended on where the window began.
  for (let i = 0; i < 14 && nights.length < 10; i++) {
    // 23:00 — aligned with the profile's sleep blocker default (23:00–07:00)
    const nightStart = new Date(cursor); nightStart.setHours(23, 0, 0, 0);
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
  padding: '12px 12px',
  border: '2px solid var(--border)',
  borderRadius: '16px',
  background: 'var(--warm)',
  color: 'var(--char)',
  fontSize: '14px',
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  cursor: 'pointer',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--smoke)',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: '4px',
  fontFamily: 'var(--font-ui)',
};

// ── Sourdough card helper styles ──────────────
const STARTER_LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'var(--font-ui)',
  color: 'var(--smoke)',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  marginBottom: '8px',
};
const STARTER_SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '14px',
  padding: '8px 8px',
  borderRadius: '16px',
  border: '1.5px solid var(--border)',
  background: 'var(--cream)',
  color: 'var(--char)',
  flex: 1,
};
function starterPillButton(active: boolean): React.CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: '20px',
    border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
    background: active ? '#FEF4EF' : 'transparent',
    color: active ? 'var(--terra)' : 'var(--smoke)',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
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
// ── Preferment zone constants — SINGLE SOURCE for solver scoring
// (findOptimalPosition) and the poolish/biga card colour zones, which were
// duplicated copies at risk of drifting apart. Behaviour-preserving hoist:
// the two originals differed only in the unreachable RT-biga case (biga
// always forces prefGoesInFridge via localPrefGoesInFridge), where the
// solver form (biga → 10) is kept.
function prefZoneConstants(prefermentType: string, prefGoesInFridge: boolean, kitchenTemp: number): {
  plateauH: number; plateauLowH: number; rtTol: number; rtTolUpper: number;
} {
  // Plateau half-widths: poolish fridge +3h upper / 5h lower (asymmetric),
  // biga +10h upper / 24h lower (green 24–58h — Modernist Pizza 24–48h
  // standard, 72h max), RT ±0 (tolerances below apply instead).
  const plateauH = prefermentType === 'biga' ? 10 : prefGoesInFridge ? 3 : 0;
  const plateauLowH = prefermentType === 'biga' ? 24
    : prefGoesInFridge && prefermentType === 'poolish' ? 5
    : plateauH;
  // Climate-aware RT tolerances — RT poolish curve is steeper at high temp →
  // narrower safe window. Lower bound symmetric-ish, upper slightly wider.
  const rtTol      = kitchenTemp >= 30 ? 0.5  : kitchenTemp >= 28 ? 0.75 : kitchenTemp >= 24 ? 1.0 : 1.5;
  const rtTolUpper = kitchenTemp >= 30 ? 0.75 : kitchenTemp >= 28 ? 1.0  : kitchenTemp >= 24 ? 1.5 : 2.0;
  return { plateauH, plateauLowH, rtTol, rtTolUpper };
}

export function findOptimalPosition(
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
      return hbf > Math.min(s, e) && hbf <= Math.max(s, e);
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
      // Poolish fridge warm-up: prefRTWarmupH is now the warm-up the dough
      // TEMPERATURE actually requires (utils.requiredPrefWarmupH) — it is 0
      // whenever water temperature alone can reach the target FDT, which is the
      // normal case at the 20–30% flour a fridge poolish uses. When it is 0
      // there is no constraint here at all.
      //
      // When it is non-zero, clearing the slot is a PREFERENCE, not a gate:
      // taking a container out of the fridge is a five-second action, so a busy
      // window is a mild inconvenience, never a reason to reject an otherwise
      // good plan. Scored below so the solver quietly picks a mix time that
      // clears it — instead of asking the baker to move Start Dough itself.
      const warmupClear =
        (hasPref && prefermentType === 'poolish' && prefGoesInFridge && prefRTWarmupH > 0
          && isInBlocker(candidate + prefRTWarmupH))
          ? 0 : 1;
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
      // RT poolish ceiling is BIOLOGY (RT poolish window is 6–14h; 16 gives
      // scan headroom), never prefOffsetH — that is UI drag state, and using
      // it made the search zone depend on the previous answer (same feedback
      // class as the sourdough pendingStart bug: drag → Reset landed on a
      // different plan than the original).
      const prefZoneMax = prefermentType === 'biga' ? 72 : prefGoesInFridge ? 24 : 16;
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
      // SINGLE SOURCE with the card zones — see prefZoneConstants.
      const { plateauH: fridgePlateauH, plateauLowH: scorePlateauH_LOW,
              rtTol: scoreRTPeakTol, rtTolUpper: scoreRTPeakTolUpper } =
        prefZoneConstants(prefermentType, prefGoesInFridge, kitchenTemp);
      const scorePlateauH   = fridgePlateauH; // upper bound (over-fermented side)

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
      // Warm-up clearance sits with the other practicality terms (doughReasonable 5,
      // poolishComfort 0–8): enough to win a near-tie and shift the mix by an hour,
      // never enough to outrank a quality tier (100) or the cold-retard bonus.
      const combinedScore = score * 100 + fridgeBonus * 10 + retardBonus * retardWeight
        + doughReasonable * 5 + poolishComfort + warmupClear * 6;

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
  // Scientific optimum, not prefOffsetH (UI drag state) — same feedback
  // class as P1 above, fallback flavour.
  const fallbackPrefOffset = Math.min(
    getPrefOptH(prefermentType, kitchenTemp, prefGoesInFridge, styleKey, fridgeTemp),
    nowHBF - sweetCenter - 0.25);
  const fallbackOffset = hasPref ? Math.max(prefermentType === 'biga' ? 12 : prefGoesInFridge ? 3 : 1, fallbackPrefOffset) : 0;
  return {
    mixHBF:        sweetCenter,
    prefHBF:       sweetCenter + fallbackOffset,
    mixInZone:     false,
    prefInZone:    false,
    fallback:      true,
    mixInBlocker:  isInBlocker(sweetCenter),
    prefInBlocker: hasPref && isInBlocker(sweetCenter + fallbackOffset),
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
    let frame = 0;
    const ro = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setW(width));
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
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
    { from: goldL_HBF,   to: tooEarlyHBF, fill: 'rgba(107, 68, 35,0.25)',   label: tRoot('schedulePicker.zoneLabels.tooEarly') },
    { from: tooEarlyHBF, to: sweetL_HBF,  fill: 'rgba(156, 130, 72,0.35)', label: tRoot('schedulePicker.zoneLabels.stillOk')  },
    { from: sweetL_HBF,  to: sweetR_HBF,  fill: 'rgba(107,122,90,0.5)',  label: '' },
    { from: sweetR_HBF,  to: goldR2_HBF,  fill: 'rgba(156, 130, 72,0.35)', label: tRoot('schedulePicker.zoneLabels.stillOk')  },
    { from: goldR2_HBF,  to: 0,           fill: 'rgba(107, 68, 35,0.25)',  label: tRoot('schedulePicker.zoneLabels.tooLate')  },
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
  const dFill   = inBlocker ? '#aaaaaa' : bulkEndInBlocker ? '#C4A030' : '#2B2420';
  const dStroke = inBlocker ? '#999999' : bulkEndInBlocker ? '#7A6010' : 'white';

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
      {/* Hint */}
      <div style={{ fontSize: '13px', color: 'var(--smoke)', textAlign: 'center', marginBottom: '8px' }}>
        {locale === 'fr'
          ? <><span style={{ color: '#6B7A5A', fontWeight: 600 }}>✓ Meilleur créneau choisi</span> — glissez le losange pour le changer</>
          : <><span style={{ color: '#6B7A5A', fontWeight: 600 }}>✓ Best start time set</span> — drag the diamond to change it</>}
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
              fontSize={9.5} fill="#2B2420" fillOpacity={0.45}
              textAnchor="middle" fontFamily="DM Mono, monospace">
              {item.label}
            </text>
          ));
        })()}

        {/* Bake reference line */}
        <line x1={barHToX(0, W, barWin)} y1={0} x2={barHToX(0, W, barWin)} y2={BAR_AXIS_Y}
          stroke="#6B4423" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.25} />

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
              <rect x={bx1} y={0} width={bx2 - bx1} height={BAR_AXIS_Y} fill="rgba(107, 68, 35,0.09)" />
              <g clipPath={`url(#sbc-${barId}-${i})`}>
                {Array.from({ length: n }, (_, j) => {
                  const ox = bx1 + j * 7 - BAR_AXIS_Y;
                  return (
                    <line key={j} x1={ox} y1={0} x2={ox + BAR_AXIS_Y} y2={BAR_AXIS_Y}
                      stroke="rgba(107, 68, 35,0.16)" strokeWidth={1} />
                  );
                })}
              </g>
              <line x1={bx1} y1={0} x2={bx2} y2={0}
                stroke="rgba(107, 68, 35,0.5)" strokeWidth={2.5} />
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
                fill="#6B4423" />
              <text x={bx} y={BAR_AXIS_Y + 12} fontSize={9} fill="#6B4423"
                fontFamily="DM Mono, monospace" textAnchor="middle">
                {tRoot('schedulePicker.bakeLabel')}
              </text>
            </>
          );
        })()}

        {/* Diamond (draggable) */}
        <g style={{ cursor: dragging ? 'grabbing' : 'grab' }} onPointerDown={onPointerDown}>
          <text
            x={Math.min(Math.max(diamondX, 42), W - 42)} y={BAR_Y - 6}
            fontSize={11} fontWeight={700} fill="#3D5A30"
            fontFamily="DM Mono, monospace" textAnchor="middle"
          >
            {tRoot('schedulePicker.zoneLabels.startDough')}
          </text>
          <polygon
            points={`${diamondX},${barCY - BAR_DS} ${diamondX + BAR_DS},${barCY} ${diamondX},${barCY + BAR_DS} ${diamondX - BAR_DS},${barCY}`}
            fill={dFill} stroke={dStroke} strokeWidth={1.5}
          />
          {inBlocker && (
            <>
              <circle cx={diamondX + BAR_DS + 3} cy={barCY - BAR_DS} r={5} fill="rgba(107, 68, 35,0.9)" />
              <text x={diamondX + BAR_DS + 3} y={barCY - BAR_DS + 4}
                fontSize={7} fill="white" textAnchor="middle" fontFamily="DM Mono, monospace">!</text>
            </>
          )}
        </g>
      </svg>

      {/* Colour legend — zone labels vanish when zones are narrow, leaving
          first-time bakers guessing what green/gold/terra mean */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap',
        marginTop: '4px', fontSize: '11px', color: 'var(--smoke)',
        fontFamily: 'var(--font-ui)',
      }}>
        {([
          ['rgba(107,122,90,0.7)', locale === 'fr' ? 'idéal' : 'sweet spot'],
          ['rgba(156, 130, 72,0.7)', locale === 'fr' ? 'correct' : 'still ok'],
          ['rgba(107, 68, 35,0.45)', locale === 'fr' ? 'risqué' : 'pushing it'],
        ] as const).map(([c, lbl]) => (
          <span key={lbl} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 10, height: 6, borderRadius: 3, background: c, display: 'inline-block' }} />
            {lbl}
          </span>
        ))}
      </div>

      {/* Info cards */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'center' }}>
        <div style={{
          background: 'var(--cream)',
          border: '1.5px solid var(--border)', borderRadius: '16px', padding: '8px 12px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
            <div style={{ width: 8, height: 8, background: '#2B2420', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {tRoot('schedulePicker.startDough')}
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
            {fmtDT(pendingStart)}
          </div>
          <div style={{ fontSize: '11px', marginTop: '.1rem', color: inZone ? '#4A7A3A' : (earlyOk || nearLate) ? '#C49A28' : '#6B4423' }}>
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

// Simple mode (Flo): no chart — just the computed start time, editable.
// The heavy lifting (blocker notes, sourdough re-solve pinning) stays in the
// caller's onStartChange, unchanged from the colour-bar days.
// ── Simple mode: the plan as dated actions ────
// Simple mode has no chart by design, which left the blockers invisible: the
// solver was avoiding them all along, but the only visible consequence was a
// single start time quietly landing on a different hour. A baker who toggles
// "Nights" and sees nothing move concludes the control is broken.
function SimplePlan({ schedule, isFr, movedNote, pendingStart, onEditStart }: {
  schedule: ScheduleResult;
  isFr: boolean;
  movedNote: string | null;
  pendingStart: Date;
  onEditStart: () => void;
}) {
  const when = (d: Date) => d.toLocaleString(isFr ? 'fr-FR' : 'en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: !isFr,
  });
  // Same marker vocabulary as the custom-mode plan list: shape carries kind,
  // colour carries curve. Simple mode has no chart and nothing here is
  // editable, so no soft time fields — but the reading is identical.
  // Setup exists to turn a bake time into a start time, and the recipe falls
  // out of that. Mix, into the fridge, out of the fridge, final proof and
  // preheat are all things the baker DOES on the day — they belong to
  // Protocol, and printing them here made the configuration screen a
  // read-only rehearsal of a page that already exists.
  //
  // What is left is the pair that actually gets set: when the dough starts
  // and when it bakes. Same two rows Custom shows, same vocabulary.
  // pendingStart, not schedule.bulkFermStart. bulkFermStart is startTime plus
  // kneadMin — the moment bulk fermentation begins, fifteen minutes after the
  // baker actually starts. Labelling it "Start dough" put a time on screen
  // that was quietly a quarter hour late, and disagreed with the card above
  // it by exactly that much.
  type Row = { t: string; s?: string; d: Date; c: string; m: PlanRow['marker']; edit?: boolean };
  const rows: Row[] = [
    {
      t: isFr ? 'Début de la pâte' : 'Start dough',
      d: pendingStart, c: '#3D5A30', m: 'step', edit: true,
    },
    {
      t: isFr ? 'Cuisson' : 'Bake',
      d: schedule.bakeStart, c: '#7A4A22', m: 'bake',
    },
  ];
  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            {/* The editable row is a button in a soft field, the way custom
                mode draws its editable times. The bake row stays plain text:
                that contrast is what teaches which one you can move, with no
                caption spent saying so. */}
            <div
              onClick={r.edit ? onEditStart : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 4px',
                cursor: r.edit ? 'pointer' : 'default',
              }}
            >
              <PlanMarker marker={r.m} color={r.c} />
              <span style={{
                flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontSize: '12.5px',
                color: 'var(--smoke)',
                textTransform: r.m === 'cold' ? 'none' : 'uppercase',
                letterSpacing: r.m === 'cold' ? 0 : '.04em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{r.t}</span>
              {r.edit ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  background: 'var(--warm)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '7px 11px', minHeight: '38px',
                  fontFamily: 'var(--font-mono, DM Mono, monospace)', fontSize: '15px',
                  fontWeight: 600, color: 'var(--char)',
                  whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                }}>
                  {when(r.d)}
                  <svg width="9" height="6" viewBox="0 0 11 7" fill="none" aria-hidden="true">
                    <path d="M1 1.5L5.5 5.5L10 1.5" stroke="var(--smoke)" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : (
                <span style={{
                  fontFamily: 'var(--font-mono, DM Mono, monospace)', fontSize: '14px',
                  fontWeight: r.m === 'cold' ? 400 : 500,
                  color: r.m === 'cold' ? 'var(--smoke)' : 'var(--char)',
                  whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                }}>{when(r.d)}</span>
              )}
            </div>
            {r.s && (
              <div style={{
                padding: '0 4px 10px 25px', fontSize: '11.5px',
                lineHeight: 1.5, color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
              }}>{r.s}</div>
            )}
          </div>
        ))}
      </div>
      {movedNote && (
        <div style={{
          marginTop: '12px', padding: '0 4px', fontSize: '11.5px',
          lineHeight: 1.5, color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
        }}>{movedNote}</div>
      )}
    </div>
  );
}

// The editor, with no card around it. It used to render a dated panel whose
// only content was the start time — the same start time the plan row beneath
// already showed. Now the row is the display and this is what the row opens.
function SimpleStartTime({ pendingStart, isFr, onStartChange, editing }: {
  pendingStart: Date;
  isFr: boolean;
  onStartChange: (d: Date) => void;
  editing: boolean;
}) {
  const toLocal = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  if (!editing) return null;
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginBottom: '6px' }}>
        {isFr ? 'Choisissez votre départ' : 'Choose your start'}
      </div>
      <input
        type="datetime-local"
        step={900}
        value={toLocal(pendingStart)}
        onChange={e => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) onStartChange(d); }}
        style={{
          width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
          padding: '10px 10px',
          border: '1.5px solid var(--gold)', borderRadius: '8px',
          background: 'var(--warm)', color: 'var(--char)',
          fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none',
        }}
      />
    </div>
  );
}

// ── Plan list ────────────────────────────────────────────────
// One stacked list, one row per event, in chronological order. Rows are
// separated by hairlines — no boxes, no card fill. Shape carries kind,
// colour carries curve.
export interface PlanRow {
  id: string;
  /** Epoch ms — the list is sorted by this, so a dragged step re-sorts
   *  itself into chronological place. */
  at: number;
  name: string;
  timeText: string;
  endAt?: number;
  waitLabel?: string;
  originalAt?: number;
  marker: 'step' | 'history' | 'cold' | 'bake';
  color: string;
  /** Steps you DO get a soft time field. Things that follow from them —
   *  Out of fridge, Last fed — get plain text. That contrast teaches the
   *  rule with no caption. */
  editable: boolean;
  isHistory?: boolean;
  note?: React.ReactNode;
}

function PlanMarker({ marker, color }: { marker: PlanRow['marker']; color: string }) {
  const box: React.CSSProperties = {
    width: 12, flexShrink: 0, display: 'flex',
    justifyContent: 'center', alignItems: 'center',
  };
  if (marker === 'bake') {
    return (
      <span style={box}>
        <span style={{
          width: 0, height: 0,
          borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
          borderTop: `9px solid ${color}`,
        }} />
      </span>
    );
  }
  if (marker === 'cold') {
    return (
      <span style={box}>
        <span style={{ width: 11, height: 4, borderRadius: 2, background: color, opacity: 0.5 }} />
      </span>
    );
  }
  return (
    <span style={box}>
      <span style={{
        width: 9, height: 9, transform: 'rotate(45deg)',
        background: marker === 'history' ? 'transparent' : color,
        border: marker === 'history' ? `1.5px solid ${color}` : 'none',
        opacity: marker === 'history' ? 0.55 : 1,
      }} />
    </span>
  );
}

function Chevron() {
  return (
    <svg width="9" height="6" viewBox="0 0 9 6" style={{ opacity: 0.45 }}>
      <path d="M1 1 L4.5 5 L8 1" fill="none" stroke="#1A1612" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanList({
  rows, focusId, onFocus, onEditTime, editingId, editor, collapseLabel,
}: {
  rows: PlanRow[];
  focusId: string | null;
  onFocus: (id: string) => void;
  onEditTime: (id: string) => void;
  editingId: string | null;
  editor: React.ReactNode;
  collapseLabel: (n: number) => string;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = rows.filter(r => r.isHistory);
  // Collapse completed steps only at two or more. A fresh sourdough plan has
  // just "Last fed" behind it, so it stays inline; collapsing a single row is
  // worse than showing it.
  const collapse = history.length >= 2 && !historyOpen;
  const shown = collapse ? rows.filter(r => !r.isHistory) : rows;

  // Every time field gets the width of the widest one. They were sized to
  // their own content, so "Sat 29 Aug · 11:15pm" and "Sun 30 Aug · 6pm"
  // drew two different boxes stacked on each other and the column
  // zig-zagged down the list. Character count is a fair proxy here:
  // the strings share a structure and the figures are tabular.
  const timeColCh = shown.reduce((m, r) => Math.max(m, (r.timeText ?? '').length), 0);

  const rowBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '9px',
    padding: '10px 4px', background: 'none', border: 'none',
    fontFamily: 'var(--font-ui)', textAlign: 'left', cursor: 'pointer',
    borderRadius: '9px', flex: 1, minWidth: 0,
  };

  return (
    <div style={{ marginTop: '14px' }}>
      {collapse && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setHistoryOpen(true)}
            style={{ ...rowBtn, width: '100%', color: 'var(--smoke)', opacity: 0.75, fontSize: '12px' }}
          >
            <PlanMarker marker="history" color="#4A7FA5" />
            <span style={{ flex: 1 }}>{collapseLabel(history.length)}</span>
            <span style={{ transform: 'rotate(-90deg)' }}><Chevron /></span>
          </button>
        </div>
      )}
      {shown.map((r, i) => {
        const focused = focusId === r.id;
        const last = i === shown.length - 1;
        return (
          <div key={r.id} style={{
            borderTop: '1px solid var(--border)',
            borderBottom: last ? '1px solid var(--border)' : undefined,
          }}>
            {/* Two targets, two jobs — SIBLING buttons filling the row. A
                button inside a button is invalid HTML and breaks keyboard
                and screen-reader navigation. */}
            <div style={{
              display: 'flex', alignItems: 'center', width: '100%',
              background: focused ? 'rgba(232,224,213,.55)' : 'none',
              borderRadius: '9px',
            }}>
              <button
                onClick={() => { if (r.marker !== 'cold') onFocus(r.id); }}
                style={{ ...rowBtn, cursor: r.marker === 'cold' ? 'default' : 'pointer' }}
              >
                <PlanMarker marker={r.marker} color={r.color} />
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: r.isHistory ? '12px' : '12.5px',
                  color: 'var(--smoke)',
                  textTransform: r.marker === 'cold' || r.isHistory ? 'none' : 'uppercase',
                  letterSpacing: r.marker === 'cold' || r.isHistory ? 0 : '.04em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.name}</span>
              </button>
              {editingId === r.id ? (
                <div style={{ padding: '4px 0', minWidth: '150px' }}>{editor}</div>
              ) : r.editable ? (
                <button
                  onClick={() => onEditTime(r.id)}
                  style={{
                    fontFamily: 'var(--font-mono, DM Mono, monospace)', fontSize: '14px',
                    fontWeight: 500, color: 'var(--char)', whiteSpace: 'nowrap',
                    border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '5px 9px', borderRadius: '9px',
                    background: 'rgba(26,22,18,.045)',
                    boxShadow: 'inset 0 0 0 1px rgba(26,22,18,.05)',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: `calc(${timeColCh}ch + 34px)`,
                    justifyContent: 'space-between',
                  }}
                >
                  {r.timeText}<Chevron />
                </button>
              ) : (
                <span style={{
                  fontFamily: 'var(--font-mono, DM Mono, monospace)', fontSize: '14px',
                  color: 'var(--smoke)', fontWeight: 400, whiteSpace: 'nowrap',
                  padding: '2px 0', fontVariantNumeric: 'tabular-nums',
                  minWidth: `calc(${timeColCh}ch + 34px)`,
                  textAlign: 'right',
                }}>{r.timeText}</span>
              )}
            </div>
            {/* One note per row, at most — indented, no left rule, no divider
                between a row and its own note. */}
            {r.note && (
              <div style={{
                padding: '0 4px 10px 25px', fontSize: '11.5px',
                lineHeight: 1.5, color: 'var(--smoke)',
              }}>{r.note}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ScheduleViewTabs({ value, onChange, id, isFr }: {
  value: 'actions' | 'graph'; onChange: (value: 'actions' | 'graph') => void; id: string; isFr: boolean;
}) {
  const options = ['actions', 'graph'] as const;
  return <div role="tablist" aria-label={isFr ? 'Affichage du planning' : 'Schedule view'} style={{display:'flex',gap:8,marginBottom:16}}>
    {options.map(option => <button key={option} type="button" role="tab" id={`${id}-${option}-tab`}
      aria-controls={`${id}-${option}-panel`} aria-selected={value === option} tabIndex={value === option ? 0 : -1}
      onClick={() => onChange(option)}
      onKeyDown={event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'actions' : event.key === 'End' ? 'graph' : option === 'actions' ? 'graph' : 'actions';
        onChange(next);
        document.getElementById(`${id}-${next}-tab`)?.focus();
      }}
      style={{flex:1,minHeight:44,padding:'10px 12px',border:'1px solid var(--border)',borderRadius:12,background:value === option ? 'var(--char)' : 'var(--cream)',color:value === option ? 'var(--cream)' : 'var(--char)',fontFamily:'var(--font-ui)',fontSize:13,fontWeight:600,cursor:'pointer'}}>
      {option === 'actions' ? (isFr ? 'Actions' : 'Action items') : (isFr ? 'Planning visuel' : 'Visual schedule')}
    </button>)}
  </div>;
}

/** Unleavened flatbread has a short preparation plan, not a fermentation solver. */
function UnleavenedSchedulePicker(props: SchedulePickerProps) {
  const isFr = useLocale() === 'fr';
  const localValue = (date: Date) => {
    const copy = new Date(+date - date.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 16);
  };
  const readyOffset=Number.isFinite(props.readyTimeOffsetMinutes)?Math.max(0,props.readyTimeOffsetMinutes??0):0;
  const [value, setValue] = useState(() => localValue(new Date(+(props.eatTime ?? new Date(Date.now() + 60 * 60000))+readyOffset*60000)));
  const [confirmed, setConfirmed] = useState(!!props.eatTime);
  useEffect(() => { props.onEditingChange?.(!confirmed); return () => props.onEditingChange?.(false); }, [confirmed, props.onEditingChange]);
  const cook = new Date(+new Date(value)-readyOffset*60000);
  const validDate = Number.isFinite(+cook);
  const start = new Date(+cook - 45 * 60000);
  const cookMinutes = breadActiveCookMinutes(props.styleKey, props.numItems);
  const cookEnd = new Date(+cook + cookMinutes * 60000);
  const busy = validDate && findAvailabilityConflicts([
    { id: 'mix', at: start, end: new Date(+start + 5 * 60000) },
    { id: 'roll', at: new Date(+cook - 10 * 60000), end: cook },
    { id: 'preheat', at: new Date(+cook - props.preheatMin * 60000) },
    { id: 'cook', at: cook, end: cookEnd },
  ], props.blocks, Date.now()).length > 0;
  const future = validDate && +start >= Date.now();
  const ready = future && !busy;
  useEffect(() => { props.onPrefermentValidityChange?.(true); }, [props.onPrefermentValidityChange]);
  return <section aria-label={isFr ? 'Repos et cuisson' : 'Rest and cook'} style={{ padding: '8px 0' }}>
    <h3 style={{ fontSize: 22, margin: '0 0 12px' }}>{isFr ? 'Repos et cuisson' : 'Rest and cook'}</h3>
    <p style={{ lineHeight: 1.5 }}>{isFr ? 'Préparez la pâte 45 min avant cuisson : mélange, 30 min de repos couvert, puis abaisse.' : 'Start 45 minutes before cooking: mix, rest covered for 30 minutes, then roll.'}</p>
    <label style={{ display: 'block', margin: '20px 0 8px', fontWeight: 500 }} htmlFor="piadina-cook-time">{readyOffset?props.readyTimeLabel:(isFr ? 'Commencer la cuisson à' : 'Start pan-cooking at')}</label>
    <input id="piadina-cook-time" type="datetime-local" value={value} onChange={event => { setValue(event.target.value); setConfirmed(false); }}
      style={{ width: '100%', boxSizing: 'border-box', minHeight: 48, fontSize: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 12, color: 'var(--char)', background: 'var(--cream)' }} />
    {validDate && <p>{isFr ? 'Commencer à ' : 'Start at '}{fmtCardDT(start, isFr)}</p>}
    {validDate && <p>{isFr ? 'Cuisson terminée vers ' : 'Cooking finished around '}{fmtCardDT(cookEnd, isFr)}{isFr ? ' · une galette à la fois' : ' · one flatbread at a time'}</p>}
    {!future && <p role="status">{isFr ? 'Choisissez une cuisson laissant au moins 45 min pour préparer la pâte.' : 'Choose a cooking time at least 45 minutes ahead to prepare the dough.'}</p>}
    {busy && <p role="status">{isFr ? 'Une étape tombe pendant une indisponibilité. Décalez la cuisson pour garder ce repos.' : 'A hands-on step overlaps your unavailable time. Move cooking to keep this rest.'}</p>}
    <button type="button" disabled={!ready} onClick={() => {
      props.onChange(start, cook, props.blocks, { preservePlan: true });
      props.onReady?.(); setConfirmed(true);
    }} style={{ width: '100%', minHeight: 48, marginTop: 12, padding: 12, border: 'none', borderRadius: 12,
      background: ready ? 'var(--terra)' : 'var(--border)', color: ready ? 'white' : 'var(--smoke)', fontSize: 16, fontWeight: 600 }}>
      {confirmed ? (isFr ? 'Planning confirmé' : 'Plan confirmed') : (isFr ? 'Valider le planning' : 'Confirm plan')}
    </button>
  </section>;
}

export default function SchedulePicker(props: SchedulePickerProps) {
  return getBreadProtocol(props.styleKey)?.method === 'unleavened'
    ? <UnleavenedSchedulePicker {...props} /> : <FermentedSchedulePicker {...props} />;
}

function FermentedSchedulePicker({ startTime, eatTime, blocks, preheatMin, mixerType = 'hand', numItems, confirmedPlan = false, styleKey, kitchenTemp, schedule, onChange, bakeType = 'pizza', isSourdough = false, onFeedTimeChange, onStarterEventsChange, savedStarterEvents = [], prefermentType = 'none', onPrefermentValidityChange, onPrefOffsetChange, onPrefGoesInFridgeChange, onFridgeOutTimeChange, onUsingPeak2Change, onFeed2TimeChange, onStarterFridgeInTimeChange, onStarterStateChange, starterLocation: starterLocationProp, planningMode: planningModeProp, lastFedTime: lastFedTimeProp, knownPeakTime: knownPeakTimeProp, onStarterLocationChange, onPlanningModeChange, onLastFedTimeChange, onKnownPeakTimeChange, hasNotFedYet: hasNotFedYetProp = null, onHasNotFedYetChange, lastFedAge: lastFedAgeProp, onLastFedAgeChange, lastFeedRatio: lastFeedRatioProp, onLastFeedRatioChange, nextFeedRatio: nextFeedRatioProp, onNextFeedRatioChange, nextFeedRatioOverride: nextFeedRatioOverrideProp, onNextFeedRatioOverrideChange, ratioMode: ratioModeProp, onRatioModeChange, onStarterPeakTimeChange, starterTimingValid: starterTimingValidProp = true, onStarterTimingValidityChange, mode = 'custom', readyTimeOffsetMinutes, readyTimeLabel, readyTimeNote, onReady, onEditingChange, fridgeTemp = 6, sessionRestored = false, savedPrefOffsetHours, savedPrefGoesInFridge, recipeGenerated = false, flourStrength = 1.0, startTimeInPast = false, tang = 'balanced', onTangChange }: SchedulePickerProps) {
  const readyOffset = Number.isFinite(readyTimeOffsetMinutes) && readyTimeOffsetMinutes! > 0 ? readyTimeOffsetMinutes! : 0;
  const [scheduleView, setScheduleView] = useState<'actions' | 'graph'>('actions');
  const scheduleViewId = useId();
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
  // Simple mode has no chart, so the start row IS the control. Its open state
  // lives here rather than inside the editor, because the row that opens it
  // and the field it opens are siblings now, not parent and child.
  const [simpleEditingStart, setSimpleEditingStart] = useState(false);
  // Set when a blocker toggle actually shifts the plan, so the baker is told
  // what moved and why instead of watching a time change for no stated reason.
  const [movedNote, setMovedNote] = useState<string | null>(null);
  const blockerMoveRef = useRef<{ prevStart: number; labels: string[] } | null>(null);
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
  // Deferred apply for the native date picker on touch devices.
  // iOS fires a `change` event (valued today) the moment the wheel opens;
  // applying eatTime immediately runs the solver + re-renders and the native
  // sheet dismisses before the baker can pick a date. On coarse pointers we
  // apply on blur (sheet closed), with a debounced fallback that waits until
  // the input is no longer focused.
  const applyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyRetriesRef = useRef(0);
  // Solver-initiated parent notifications: guard against update loops.
  // Fallback/far-horizon solver paths call onChange mid-solve; if the parent
  // re-renders with fresh array/Date identities the sourdough effect re-runs
  // the solver, which notifies again → React #185 (observed with a week+
  // revival starter + next-morning bake). Skip identical values and damp
  // runaway repeats within a tick window.
  const lastSolverNotifyRef = useRef<{ s: number; e: number } | null>(null);
  const solverNotifyBudgetRef = useRef<{ t: number; n: number }>({ t: 0, n: 0 });
  function notifyFromSolver(start: Date, et: Date, blks: AvailabilityBlock[]) {
    const s = start.getTime(), e = et.getTime();
    if (solverNotificationAlreadySynced(lastSolverNotifyRef.current, {s, e}, {s: startTime.getTime(), e: eatTime?.getTime()})) return;
    const now = Date.now();
    if (now - solverNotifyBudgetRef.current.t > 500) solverNotifyBudgetRef.current = { t: now, n: 0 };
    if (++solverNotifyBudgetRef.current.n > 4) return;
    lastSolverNotifyRef.current = { s, e };
    onChange(start, et, blks);
  }
  const [pickerDateTime, setPickerDateTime] = useState<string>(() => {
    if (alreadySet && eatTime) {
      const d = new Date(+eatTime + readyOffset * 60000);
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
      const d = new Date(+eatTime + readyOffset * 60000);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return '';
  });
  const [pickerHour, setPickerHour] = useState<number>(() => alreadySet && eatTime ? new Date(+eatTime + readyOffset * 60000).getHours() : 18);
  const [pickerMinute, setPickerMinute] = useState<number>(() => {
    if (alreadySet && eatTime) {
      const m = new Date(+eatTime + readyOffset * 60000).getMinutes();
      return m;
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
  const [showStarterDetails, setShowStarterDetails] = useState(false);
  const [simpleStarterUncertain, setSimpleStarterUncertain] = useState(!starterTimingValidProp);
  useEffect(() => { if (!starterTimingValidProp) setSimpleStarterUncertain(true); }, [starterTimingValidProp]);
  const [simpleReadyObserved,setSimpleReadyObserved] = useState(false);
  const [starterMature, setStarterMature]       = useState(true);
  const [starterHasRye, setStarterHasRye]       = useState(false);
  const [fridgeOutTime, setFridgeOutTime]       = useState<Date | null>(null);
  const [solverResult, setSolverResult]         = useState<SourdoughSolverResult | null>(null);
  const [lastFeedRatio, setLastFeedRatio]         = useState<1 | 2 | 4 | 5 | 10>(lastFeedRatioProp ?? 1);
  const simpleKnownPeakConflict = mode === 'simple' && isSourdough && planningMode === 'know_peak'
    && !!knownPeakTime && !knownPeakMixUsable(pendingStart, knownPeakTime,
      getPrefPeakH_RT('sourdough', kitchenTemp, styleKey) * (starterHasRye ? 0.8 : 1) * (starterMature ? 1 : 1.2) * (1 + 0.5 * Math.log(lastFeedRatio)), flourStrength);
  const starterTimingValid = !simpleKnownPeakConflict && (mode !== 'simple' || !simpleStarterUncertain
    || !!solverResult?.starterEvents.length);
  useEffect(() => { onStarterTimingValidityChange?.(starterTimingValid); }, [starterTimingValid, onStarterTimingValidityChange]);
  const savedEventLabels: Record<StarterEventKind, [string,string]> = {
    last_fed:['Last fed','Dernier rafraîchi'], refresh:['Refresh feed','Rafraîchir le levain'], intermediate_refresh:['Refresh feed','Rafraîchir le levain'], pre_mix:['Pre-mix feed','Rafraîchi avant mélange'], fridge_in:['Refrigerate starter','Réfrigérer le levain'], fridge_out:['Take starter out','Sortir le levain'], known_peak:['Starter peak','Levain à son pic'],
  };
  const displayStarterEvents = simpleKnownPeakConflict ? [] : solverResult?.starterEvents ?? savedStarterEvents.map(event => ({...event, label:savedEventLabels[event.kind][locale === 'fr' ? 1 : 0], isDraggable:false}));
  const eventSignature = JSON.stringify(isSourdough ? solverResult?.starterEvents ?? [] : []);
  useEffect(() => {
    // A newly mounted planner has no result yet; preserve the saved events
    // until the solver publishes the replacement schedule.
    if (simpleKnownPeakConflict) onStarterEventsChange?.([]);
    else if (!isSourdough || solverResult) onStarterEventsChange?.(isSourdough ? solverResult!.starterEvents : []);
  }, [eventSignature, simpleKnownPeakConflict, onStarterEventsChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set by the sourdough solver when the bake has no executable future slot.
  // Effects that invoke the solver must not immediately re-open the plan panel
  // after that explicit blocker has cleared a stale result.
  const sourdoughPlanBlockedRef = useRef(false);
  const [refeedSuggestion, setRefeedSuggestion] = useState<Date | null>(null);
  const [mixOverride, setMixOverride]           = useState(false);
  const [hasNotFedYet, setHasNotFedYet]         = useState<boolean | null>(hasNotFedYetProp ?? null);
  const [lastFedAge, setLastFedAge]             = useState<'today'|'yesterday'|'days23'|'days45'|'week'|null>(lastFedAgeProp ?? null);
  const [nextFeedRatio, setNextFeedRatio]         = useState<1 | 2 | 4 | 5 | 10>(nextFeedRatioProp ?? lastFeedRatioProp ?? 1);
  const [nextFeedRatioOverride, setNextFeedRatioOverride] = useState<1 | 2 | 4 | 5 | 10 | null>(nextFeedRatioOverrideProp ?? null);
  const [ratioMode, setRatioMode] = useState<'recommend' | 'keep'>(ratioModeProp ?? 'recommend');
  const [lastFeedRatioEditing, setLastFeedRatioEditing] = useState(false);
  const [showTasteInfo, setShowTasteInfo]       = useState(false);
  // The "Signs your starter is ready" / "Reading your dough" disclosures lived
  // on the two boxed cards and were removed with them, deliberately: readiness
  // cues are protocol, not planning. They belong to BakeGuide's readyWhen
  // sections and LearnModal (preferment_ready, poke_test, bulk), which already
  // cover them in more depth. The plan step is for scheduling; the baker is
  // planning here, not baking.

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
    if (lastFeedRatioProp !== undefined && lastFeedRatioProp !== lastFeedRatio) {
      setLastFeedRatio(lastFeedRatioProp);
    }
  }, [lastFeedRatioProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (nextFeedRatioProp !== undefined && nextFeedRatioProp !== nextFeedRatio) {
      setNextFeedRatio(nextFeedRatioProp);
    }
  }, [nextFeedRatioProp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ratioMode state synced from prop (session restore).
  useEffect(() => {
    if (ratioModeProp !== undefined && ratioModeProp !== ratioMode) {
      setRatioMode(ratioModeProp);
    }
  }, [ratioModeProp]); // eslint-disable-line react-hooks/exhaustive-deps

  // When override is null AND ratioMode === 'keep', nextFeedRatio follows lastFeedRatio.
  // Under 'recommend', the engine's recommendation flows in via the Stage-2 effect below.
  useEffect(() => {
    if (ratioMode === 'keep' && nextFeedRatioOverride === null && nextFeedRatio !== lastFeedRatio) {
      setNextFeedRatio(lastFeedRatio);
      onNextFeedRatioChange?.(lastFeedRatio);
    }
  }, [lastFeedRatio, nextFeedRatioOverride, ratioMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stage 2: auto-apply engine's ratio recommendation.
  // Triggers only when:
  //   - ratioMode === 'recommend' (engine is allowed to suggest)
  //   - Baker hasn't overridden (override is null — chips removed but kept for safety)
  //   - Solver found a recommendation different from current nextFeedRatio
  // Convergence: once applied, solver re-runs and finds same recommendation
  // (stable plan). No further changes.
  const ratioApplyHistoryRef = useRef<number[]>([]);
  // Baker-pinned refresh time (dragged refresh diamond), ms epoch. A ref, not
  // state: the solver must read the just-committed value synchronously.
  // Cleared on any input change / blocker change / bake-time change.
  const manualRefreshRef = useRef<number | null>(null);
  // Baker-pinned pre-mix/future-feed time (dragged Pre-mix diamond in a
  // non-Peak-2 plan). Same lifecycle as manualRefreshRef.
  const manualFeed2Ref = useRef<number | null>(null);
  // Baker-pinned MIX time (dragged Start Dough diamond). Unlike refresh /
  // pre-mix pins, the dragged mix previously lived only in pendingStart, so
  // any effect-triggered re-solve (e.g. a solver-applied ratio change)
  // recomputed the ideal mix and the dragged diamond snapped back. Same
  // lifecycle as manualRefreshRef: cleared on any input / bake-time /
  // blocker change and on Reset.
  const manualMixRef = useRef<number | null>(confirmedPlan ? +startTime : null);
  // Blocks the solver actually validated against (effectiveBlocks at the
  // last solve). The blocked-hours disclosure must read THIS, not the parent
  // blocks prop — the prop can lag pill toggles (observed live: a feed at
  // 11am flagged as blocked by a Work block the baker had just switched off).
  const lastSolvedBlocksRef = useRef<AvailabilityBlock[] | null>(null);
  useEffect(() => {
    if (ratioMode === 'keep') return;
    if (nextFeedRatioOverride !== null) return;
    const rec = solverResult?.recommendedNextFeedRatio;
    if (rec == null) return;
    if (rec === nextFeedRatio) { ratioApplyHistoryRef.current.length = 0; return; }
    // Oscillation guard — in tight windows (e.g. week+ revival + next-morning
    // bake) ratio A makes the plan too short → engine recommends B → with B
    // the plan fits → engine recommends A again → infinite apply loop
    // (React #185). If we're about to re-apply a ratio we already cycled
    // through, keep the current one and stop.
    const hist = ratioApplyHistoryRef.current;
    if (hist.includes(rec)) { hist.length = 0; return; }
    hist.push(nextFeedRatio);
    if (hist.length > 4) hist.shift();
    setNextFeedRatio(rec);
    onNextFeedRatioChange?.(rec);
  }, [solverResult?.recommendedNextFeedRatio, nextFeedRatioOverride, ratioMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // StarterState kept for BakeGuide compat — derived from new vars
  const starterState: StarterState = starterLocation === 'fridge'
    ? (fridgeOutTime ? 'fridge_fed' : 'fridge_unfed')
    : 'rt_fed';

  // Preferment offset state (non-sourdough)
  const [prefOffsetH, setPrefOffsetH] = useState<number>(() =>
    (sessionRestored || confirmedPlan) && Number.isFinite(savedPrefOffsetHours) ? savedPrefOffsetHours! : getPrefOptH(prefermentType, kitchenTemp)
  );
  const restoredCommercialPlan = useRef(sessionRestored ? {
    type: prefermentType, mix: startTime.getTime(), bake: eatTime?.getTime(),
    offset: savedPrefOffsetHours, fridge: savedPrefGoesInFridge, blocks: JSON.stringify(blocks),
  } : null);

  // Recommendation ghost diamond + fallback popup
  const [recommendedHBF, setRecommendedHBF] = useState<number | null>(null);
  const [showFallbackPopup, setShowFallbackPopup] = useState(false);
  const [fallbackOptions, setFallbackOptions] = useState<{
    outsideZone: { mixHBF: number; qualityPct: number } | null;
    inBlocker:   { mixHBF: number; overlapMin: number } | null;
  } | null>(null);
  const hasManuallyDragged = useRef(confirmedPlan);
  const [hasDragged, setHasDragged] = useState(false);
  // Tracks whether the recommendation algo chose fridge or RT poolish.
  // This is the single source of truth — render-time display reads this,
  // not an independent re-computation from mixOffsetH.
  const [algoChoseFridge, setAlgoChoseFridge] = useState<boolean>(() => (sessionRestored || confirmedPlan) ? (savedPrefGoesInFridge ?? true) : true);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // Plan-list focus: the row whose NAME button was tapped. That step is
  // highlighted on the chart and everything else drops back.
  const [focusRow, setFocusRow] = useState<string | null>(null);
  // One edit at a time. A drag supersedes an applied suggestion rather than
  // stacking on it — a row showing both "7:30pm" and "Moved to 5:00pm" was
  // the failure this replaces.
  const [appliedSuggestion, setAppliedSuggestion] = useState<{ id: string; from: number } | null>(null);
  const [skipPoolishNote, setSkipPoolishNote] = useState(false);
  // True when algo found a poolish slot but scored red (under-fermentation risk).
  // Distinct from skipPoolishNote (window too short); neither hides the selected method.
  const [prefAlgoRed, setPrefAlgoRed] = useState(false);
  // Which plan-list row has its time field open.
  const [starterPins,setStarterPins]=useState<{mix:number|null;feed:number|null;refresh:number|null}|null>(null);
  const keyBaselineRef=useRef<string|null>(null);
  const [keyAdjusted,setKeyAdjusted]=useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  useEffect(() => { onEditingChange?.(editingRow !== null); return () => onEditingChange?.(false); }, [editingRow, onEditingChange]);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [draftRowTime, setDraftRowTime] = useState('');
  const [editBaseTimes,setEditBaseTimes]=useState<EditTimes|null>(null);
  const [lastEditedRow, setLastEditedRow] = useState<string | null>(null);
  const [undoTimes,setUndoTimes]=useState<{start:Date;bake:Date;offset:number;blocks:AvailabilityBlock[]}|null>(null);
  const [alternativeBake,setAlternativeBake]=useState<Date|null>(null);
  const [noLaterBake,setNoLaterBake]=useState(false);
  const acceptedBakeRef=useRef<number|null>(null);
  function beginRowEdit(id:string,at:number) {
    setEditBaseTimes(null);
    const d=new Date(at);
    setDraftRowTime(new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16));
    setEditingEnabled(true);setEditingRow(id);setLastEditedRow(null);setAlternativeBake(null);setNoLaterBake(false);
  }
  const readinessEditorRef = useRef<HTMLInputElement>(null);
  const availabilityControlsRef = useRef<HTMLDivElement>(null);
  const pickerDateTimeRef = useRef<string>(pickerDateTime);
  const [localBlocks, setLocalBlocks] = useState<AvailabilityBlock[]>(blocks);
  // The blocks the solver must see, always current.
  //
  // Five call sites used to pass the `blocks` PROP straight into
  // findOptimalPositionSourdough, with a comment claiming the prop was the
  // single source of truth. It is not: for sourdough the live source is
  // localBlocks, and the prop lags by a render (see the note at the
  // localBlocks sync effect below). At mount that lag is not cosmetic — the
  // default-nights effect writes night blocks into localBlocks and solves
  // correctly, then the [pendingEatTime] effect's setTimeout(0) lands and
  // RE-SOLVES with the still-empty prop, throwing that plan away.
  //
  // The result was a first render whose Nights chip read ON while the plan on
  // screen was the nights-OFF plan. Every toggle afterwards was correct and
  // deterministic, so the sweep's A -> B -> A read it as a round-trip
  // divergence when in fact only A was wrong. Measured: state A was
  // byte-identical to the nights-OFF state B, and pre-seeding the prop with
  // night blocks made A equal C.
  //
  // Written synchronously in applyAndUpdate and refreshed after every commit,
  // so a deferred solve can never read a stale set.
  // A generated plan that is being resumed is already decided, and re-solving
  // it is what moved Start Dough, the poolish and the mix while the bake time
  // sat still: the solver works backward from the bake time, so it holds
  // eatTime and re-derives everything else — and because it will not place a
  // start in the past, it clamps to now and slides the whole protocol forward.
  // Correct when planning, wrong when the dough is already made.
  //
  // Guarded at the two solver entry points rather than on the effects that
  // call them. There are several such effects — the mount solve, the bake-time
  // effect, the sourdough constraint effect that "owns the solver for that
  // path" — and guarding them one by one is how the first attempt at this
  // missed the sourdough case entirely. One gate, both doors.
  //
  // Released a tick after mount, so this only ever suppresses the mount pass.
  // Everything the baker does afterwards, including editing the bake time,
  // re-plans normally — that is the escape hatch for someone who had not
  // actually started.
  const resumeFrozenRef = useRef(sessionRestored || confirmedPlan);
  useEffect(() => {
    const t = setTimeout(() => { resumeFrozenRef.current = false; }, 150);
    return () => clearTimeout(t);
  }, []);

  const solverBlocksRef = useRef<AvailabilityBlock[]>(blocks);
  useEffect(() => {
    solverBlocksRef.current = isSourdough ? localBlocks : blocks;
  });
  // Keep localBlocks in sync with the parent's blocks prop. Without this, any
  // sourdough re-solve NOT triggered by a chip toggle (e.g. age/location/
  // taste/ratio change → useEffect re-solve) could read a STALE localBlocks
  // and pass a blocker-violating plan as green. The chip-toggle path
  // (applyAndUpdate) sets localBlocks synchronously; this useEffect catches
  // every other prop update.
  useEffect(() => {
    setLocalBlocks(blocks);
  }, [blocks]);

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
    const d = new Date(+new Date(yyyy, mm - 1, dd, hh, mi, 0, 0) - readyOffset * 60000);
    setPendingEatTime(d);
    setEatTimeSet(true);
    onChange(pendingStart, d, blocks);
  }

  function computeAndApplyRecommendation(
    currentBlocks: AvailabilityBlock[],
    et: Date,
  ) {
    if (resumeFrozenRef.current) return;
    // Reset prefAlgoRed at start — prevents stale state from previous run
    setPrefAlgoRed(false);
    setWindowTooShort(false);
    setSuggestedBakeTimeBread(null);

    // Sourdough uses its own engine — non-sourdough schedule computation must not run.
    // Pass currentBlocks as blocksOverride so the solver sees the same blockers
    // the caller intended (matches applyAndUpdate's explicit-blocks contract).
    if (isSourdough) {
      findOptimalPositionSourdough(et, undefined, currentBlocks);
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
    // For SOURDOUGH: rtH is climate-sensitive — hot kitchens over-ferment at RT,
    // so climateRtH shifts more of the ferment toward cold (the freed warm time
    // is absorbed by the cold cap downstream). For commercial yeast climateRtH
    // returns baseRtH (climate adjusts yeast dose, not timing).
    // sweetFrom = leftmost boundary (preferredColdH + rtH) — widest useful cold
    // sweetTo = rightmost boundary (minimum viable total fermentation)
    const _biasedColdSolver = biasCold(
      scaledDefaults.coldH,
      scaledDefaults.minColdH ?? 0,
      scaledDefaults.preferredColdH ?? scaledDefaults.coldH
    );
    const _rtH_solver = climateRtH(defaults.rtH, kitchenTemp, isSourdough);
    const optimalColdH = hasColdLocal ? (_biasedColdSolver + _rtH_solver) : 0;
    const sweetCenterRaw = hasColdLocal
      ? _biasedColdSolver + _rtH_solver         // dough peaks at bake at this position
      : _rtH_solver;                             // RT only: peak at rtH before bake
    // sweetFrom = right edge of dough quality plateau (not preferredColdH which is the target).
    // plateauHalfW is how far from sweetCenter bake can be while still at peak quality.
    // Beyond this, dough is on the decline — mixInZone=false, score drops.
    // Scaled by flourStrength: stronger flour has wider plateau tolerance.
    const rawWindow = commercialReadinessWindow({ ...defaults, rtH: _rtH_solver, flourStrength,
      kitchenTemp, preheatMin, totalWindowH });
    const sweetFromRaw = rawWindow.from;
    // Use minTotalFermH as the right boundary — matches the card's green zone
    // and is the scientifically correct absolute minimum for acceptable results.
    // This is style-sensitive: each style defines its own minTotalFermH.
    const sweetToRaw = rawWindow.to;

    // Clip all to nowHBF — cannot start in the past
    const sweetCenter = Math.min(sweetCenterRaw, nowHBF - 0.5);
    const sweetFrom   = Math.min(sweetFromRaw,   nowHBF - 0.25);
    const sweetTo     = Math.min(sweetToRaw,     sweetFrom - 0.5);

    if (!hasPrefActive && !hasColdLocal && totalWindowH < sweetToRaw) {
      setGuardNote(isFr
        ? 'Créneau court : surveillez la levée avant de cuire.'
        : 'Short window: check the rise before baking.');
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
      // Retain a short-window diagnostic; never erase the selected preferment.
      setSkipPoolishNote(true);
      setPrefAlgoRed(false);
    } else {
      setSkipPoolishNote(false);
    }

    // Always solve the selected method. A short window is a visible conflict, not permission to switch to direct dough.
    const effectiveHasPref = hasPrefActive;

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
      requiredPrefWarmupH({
        prefermentType, prefInFridge: localPrefGoesInFridge,
        styleKey: styleKey ?? 'neapolitan', kitchenTemp, fridgeTemp,
      }),
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
      notifyFromSolver(newStart, et, currentBlocks);
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
      if (!hasPrefActive && result.score === 0 && !result.mixInBlocker) {
        setGuardNote(isFr
        ? 'Créneau court : surveillez la levée avant de cuire.'
        : 'Short window: check the rise before baking.');
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
    if (sessionRestored || confirmedPlan) {
      setStartComputed(true);
      onReady?.();
      return;
    }
    setTimeout(() => {
      computeAndApplyRecommendation(solverBlocksRef.current, pendingEatTime);
      setStartComputed(!isSourdough || !sourdoughPlanBlockedRef.current);
      onReady?.();
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eatTimeSet || resumeFrozenRef.current) return;
    if (acceptedBakeRef.current === +pendingEatTime) {
      acceptedBakeRef.current = null;
      setStartComputed(true);
      return;
    }
    if (confirmedPlan) {
      setPendingStart(startTime);
      setHasDragged(true);
      hasManuallyDragged.current = true;
      manualMixRef.current = +startTime;
      if (isSourdough) findOptimalPositionSourdough(pendingEatTime, startTime, solverBlocksRef.current);
      setStartComputed(true);
      onReady?.();
      return;
    }
    setStartComputed(false);
    setShowFallbackPopup(false);
    setDismissedConflict(false);
    setGuardNote(null);
    setHasDragged(false);
    hasManuallyDragged.current = false;
    manualRefreshRef.current = null;
    manualFeed2Ref.current = null;
    manualMixRef.current = null;
    ratioApplyHistoryRef.current.length = 0;
    if (isSourdough) {
      const sfDef = STYLE_FERM_DEFAULTS[styleKey ?? ''] ?? FERM_FALLBACK;
      const sweetCenter = ((sfDef.preferredColdH ?? sfDef.coldH ?? 0)
        + climateRtH(sfDef.rtH, kitchenTemp, isSourdough) + (sfDef.minTotalFermH ?? 12)) / 2;
      setPendingStart(new Date(pendingEatTime.getTime() - sweetCenter * 3600000));
      // Sourdough re-arms itself in the constraint effect below, which owns
      // the solver for that path.
      return;
    }

    // This effect blanks the plan panel on every bake-time change, and until
    // now the only thing that brought it back was confirmBakeTime's timeout.
    // That left the invariant living in the callers — four of them plus two
    // deferred touch paths — so any change that reached setPendingEatTime by
    // another road reset the panel and never restored it. Coming back from
    // the recipe and editing the bake time is one of those roads.
    //
    // The effect that clears it now also restores it. A valid future bake
    // time can no longer leave the panel hidden, whichever control moved it.
    if (isNaN(pendingEatTime.getTime())) return;
    const t = setTimeout(() => {
      computeAndApplyRecommendation(solverBlocksRef.current, pendingEatTime);
      setStartComputed(!isSourdough || !sourdoughPlanBlockedRef.current);
      onReady?.();
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEatTime]);

  // Auto-regenerate preset blocks when bake date changes
  useEffect(() => {
    if (!eatTimeSet || confirmedPlan || resumeFrozenRef.current) return;
    const wasWorkActive = blocks.some(b => b.label.startsWith('Work · '));
    // Night preset labels are `<Weekday> night` (suffix), not `Night · ` —
    // the old prefix check never matched, so nights were both (a) never
    // regenerated on date change and (b) kept as stale "custom" blocks below.
    const wasNightActive = blocks.some(b => b.label.endsWith(' night'));
    if (!wasWorkActive && !wasNightActive) return;

    const freshWorkdays = getWorkdaysInWindow(blockerWindowStart, pendingEatTime);
    const freshNights   = getNightsInWindow(blockerWindowStart, pendingEatTime);

    // Keep any custom blocks (non-preset), then re-add active presets
    const customBlocks = blocks.filter(
      b => !b.label.startsWith('Work · ') && !b.label.endsWith(' night')
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
    if (confirmedPlan) {
      findOptimalPositionSourdough(pendingEatTime, startTime, solverBlocksRef.current);
      setStartComputed(!sourdoughPlanBlockedRef.current);
      return;
    }
    // Reset drag state so solver picks ideal mix time, not a stale dragged position
    setHasDragged(false);
    hasManuallyDragged.current = false;
    manualRefreshRef.current = null;
    manualFeed2Ref.current = null;
    manualMixRef.current = null;
    // A real input change also restarts the ratio-oscillation history: the
    // guard otherwise vetoes recommendations based on ratios cycled under
    // OLD settings (live: toggle churn left the plan stuck at 1:1:1 with a
    // narrow bell and no refresh recommendation).
    ratioApplyHistoryRef.current.length = 0;
    // findOptimalPositionSourdough now calls deriveStarterPeakTime internally
    // and commits a single atomic setSolverResult at every exit point.
    // solverBlocksRef, not the prop: for sourdough the live source is
    // localBlocks and the prop lags a render. The old comment here asserted
    // the opposite, and that is what let the mount-time solve run without the
    // default night blockers.
    findOptimalPositionSourdough(pendingEatTime, undefined, solverBlocksRef.current);
    // Restore startComputed so the plan panel is visible after session restore
    // or bake-time change — the solver ran, so we have a result to show.
    if (lastFedAge !== null || (planningMode === 'know_peak' && knownPeakTime)) {
      setStartComputed(!sourdoughPlanBlockedRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFedTime, knownPeakTime, starterLocation, planningMode,
      starterMature, starterHasRye, lastFeedRatio, tang, eatTimeSet, pendingEatTime,
      styleKey, kitchenTemp]);

  // Solver-applied ratio change → re-solve WITHOUT clearing baker state.
  // nextFeedRatio is written by the ratio-apply effect (solver output), so
  // treating it as a baker input wiped pins + hasDragged right after any
  // drag or toggle whose re-solve recommended a new ratio — the ↺ Reset
  // link vanished and dragged diamonds silently snapped back. Baker-driven
  // ratio inputs (lastFeedRatio, ratioMode, override) still flow through
  // the destructive effect above; this one only rebuilds the plan.
  useEffect(() => {
    if (!isSourdough || !eatTimeSet) return;
    const mixOverride = hasManuallyDragged.current ? pendingStart : undefined;
    findOptimalPositionSourdough(pendingEatTime, mixOverride, solverBlocksRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextFeedRatio]);


  const suggestion = useMemo(
    () => computeSuggestion(pendingEatTime, preheatMin, styleKey, kitchenTemp, isSourdough),
    [pendingEatTime, preheatMin, styleKey, kitchenTemp, isSourdough],
  );

  // FIX 2: climate-aware pref fridge flag
  const hasPrefActive = prefermentType !== 'none' && prefermentType !== '' && !isSourdough;

  // Cold-aware fermentation curve
  const mixOffsetH = Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000);
  const hasColdRetard = (schedule?.coldRetardHours ?? 0) > 0;
  const _sfDef = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;
  // Tang → cold-retard bias. Longer cold = more acetic = tangier.
  // ±15% on the COLD portion only, clamped to the style's [minColdH, preferredColdH].
  // Balanced = 1.0 = byte-identical to pre-feature output.
  const _tangMult = tang === 'tangy' ? 1.15 : tang === 'mild' ? 0.85 : 1.0;
  function biasCold(coldH: number, minColdH: number, prefColdH: number): number {
    if (coldH <= 0) return 0;
    if (_tangMult === 1.0) return coldH;
    const biased = coldH * _tangMult;
    return Math.max(minColdH, Math.min(prefColdH, biased));
  }
  const _minTotalRT = (kitchenTemp >= 28 ? 0.5 : 1.5) + 1.0 + (preheatMin / 60);
  const _nowHBF = (pendingEatTime.getTime() - Date.now()) / 3600000;
  // Bake time in blocker detection
  const bakeTimeInBlocker = useMemo(() => {
    const bakeMs = pendingEatTime.getTime();
    return isTimeBlocked(bakeMs, blocks);
  }, [pendingEatTime, blocks]);
  const _tropFactor = kitchenTemp >= 33 ? 1.25 : kitchenTemp >= 30 ? 1.15 : 1.0;
  const _prefColdH = _sfDef.preferredColdH ?? _sfDef.coldH;
  // SOURDOUGH: climateRtH shrinks the warm phase at hot kitchen temps so the
  // rendered sweet zone shifts cold-ward in sync with the solver (lines ~1519
  // above) — chart green zone == card sweet zone at 30°C / 35°C. Commercial
  // yeast unchanged (climateRtH returns baseRtH there).
  const _rtH_render = climateRtH(_sfDef.rtH, kitchenTemp, isSourdough);
  // Green zone: always shows full style window — NOT clipped to nowHBF.
  // Zone guides the baker on what's ideal. Diamond clamped to nowHBF separately.
  const renderSweetFrom = _prefColdH + _rtH_render;
  const renderSweetTo   = _sfDef.minTotalFermH ?? 4;
  // Yellow zone extends 2h past green right edge
  const renderYellowTo  = Math.max(0.5, renderSweetTo - 2);
  // _optimalMix = style sweet spot where dough peaks at bake = coldH + rtH
  const _biasedColdRender = biasCold(
    _sfDef.coldH,
    _sfDef.minColdH ?? 0,
    _sfDef.preferredColdH ?? _sfDef.coldH
  );
  const _optimalMix = _sfDef.coldH > 0
    ? _biasedColdRender + _rtH_render
    : _rtH_render;
  // Dough peaks at bake when mix is in sweet zone — cold retard duration
  // flexes to match mix position. Outside sweet zone, bell shifts to show
  // under/over fermentation honestly. RT-only styles use fixed _optimalMix.
  const _hasColdRetardStyle = (_sfDef.coldH ?? 0) > 0;
  // Tang control is relevant when there's meaningful cold fermentation to bias,
  // or when the starter needs revival (extra refresh alters lactic/acetic balance).
  const _tangRelevant = isSourdough && (
    _hasColdRetardStyle ||
    lastFedAge === 'days45' || lastFedAge === 'week'
  );
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
  // "Remove poolish from fridge" time: the warm-up the dough TEMPERATURE needs,
  // not a fixed ladder. 0 for biga (goes into the mix cold by protocol) and 0
  // for any fridge poolish whose target dough temp is reachable on water alone.
  const prefRTWarmupH = requiredPrefWarmupH({
    prefermentType, prefInFridge: prefGoesInFridge,
    styleKey: styleKey ?? 'neapolitan', kitchenTemp, fridgeTemp,
  });
  const prefRemoveFromFridgeHBF = prefGoesInFridge ? mixOffsetH + prefRTWarmupH : null;
  const prefRemoveFromFridgeTime = prefRemoveFromFridgeHBF !== null
    ? new Date(pendingEatTime.getTime() - prefRemoveFromFridgeHBF * 3600000)
    : null;

  const savedCommercial = restoredCommercialPlan.current;
  const unchangedRestoredCommercialPlan = !!savedCommercial && savedCommercial.type === prefermentType
    && savedCommercial.mix === pendingStart.getTime() && savedCommercial.bake === pendingEatTime.getTime()
    && savedCommercial.offset === prefOffsetH && (savedCommercial.fridge ?? true) === prefGoesInFridge && savedCommercial.blocks === JSON.stringify(localBlocks);
  const restoredPrepOverdue = hasPrefActive && unchangedRestoredCommercialPlan
    && pendingStart.getTime() - prefOffsetH * 3600000 < Date.now();
  const commercialPrefValid = !hasPrefActive || (startComputed && commercialPrefermentPlanValid({
    type: prefermentType, inFridge: prefGoesInFridge, mixTime: pendingStart, bakeTime: pendingEatTime,
    offsetHours: prefOffsetH, blocks: localBlocks, alreadyStarted: unchangedRestoredCommercialPlan,
  }));
  useEffect(() => { onPrefermentValidityChange?.(commercialPrefValid); }, [commercialPrefValid, onPrefermentValidityChange]);

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

  // Window the night/workday PRESETS are generated over. It must be a pure
  // function of the bake time and the calendar, and of nothing else.
  //
  // It used to extend backwards on the sourdough path using
  // solverResult.starterFeedTime / starterFeed2Time. Its only consumers are the
  // two preset helpers below, so that made the blocker set an output of the
  // previous solve and an input to the next one: blocks -> solver -> plan ->
  // window -> blocks. A -> B -> A could not return, which is findings #4 and #6
  // in SWEEP-RUN-1-RESULTS.md, and it was sourdough-only because that branch
  // was sourdough-only.
  //
  // The old comment claimed the extension existed "to show hist feed bell". It
  // never reached the chart — FermentChart derives its own axis from bakeMs.
  //
  // Floored to local midnight so the set is stable across a toggle round-trip:
  // an unfloored `now` changes which nights qualify each time it crosses 07:00,
  // the night end. Blocks that sit in the past cannot bind — every planned
  // action is >= now.
  const blockerWindowStart = useMemo(() => {
    const sixDaysBefore = new Date(pendingEatTime.getTime() - 6 * 24 * 3600000);
    const now = new Date();
    const base = sixDaysBefore > now ? sixDaysBefore : now;
    const floored = new Date(base);
    floored.setHours(0, 0, 0, 0);
    return floored;
  }, [pendingEatTime]);

  const nights   = useMemo(() => getNightsInWindow(blockerWindowStart, pendingEatTime), [blockerWindowStart, pendingEatTime]);
  const workdays = useMemo(() => getWorkdaysInWindow(blockerWindowStart, pendingEatTime), [blockerWindowStart, pendingEatTime]);
  const _effectiveBlocks = isSourdough ? localBlocks : blocks;
  const isWorkActive = _effectiveBlocks.some(b => b.label.startsWith('Work · '));

  // Default night block (sourdough). Multi-day levain plans otherwise schedule
  // refresh/fridge-out actions overnight (1–4am) because nothing pulls feed
  // times toward waking hours — the audit's dominant default-mode complaint.
  // Night blockers are how the engine is designed to shape humane hours, so we
  // enable them by default and surface them as a clearable toggle. Applied once,
  // only when: sourdough, bake time set, not a restored session (which carries
  // its own blocks), and the baker has no blockers yet. If the baker later
  // clears nights, the ref keeps us from re-adding them.
  const nightsDefaultApplied = useRef(false);
  useEffect(() => {
    if (!isSourdough || !eatTimeSet || sessionRestored || confirmedPlan) return;
    if (nightsDefaultApplied.current) return;
    if (nights.length === 0) return;
    // Already has any blocker (from session/parent or a prior manual toggle) →
    // respect it, don't override.
    if (_effectiveBlocks.length > 0) { nightsDefaultApplied.current = true; return; }
    nightsDefaultApplied.current = true;
    const nightBlocks = nights.map(n => ({ from: n.blockStart, to: n.blockEnd, label: n.label }));
    applyAndUpdate(nightBlocks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSourdough, eatTimeSet, sessionRestored, nights]);

  // ── Phase transitions ────────────────────────
  function confirmBakeTime() {
    const dt = pickerDateTimeRef.current;
    if (!dt || dt.length < 16) return;
    const [datePart, timePart] = dt.split('T');
    const [yyyy, mm, dd] = datePart.split('-').map(Number);
    const [hh, mi] = timePart.split(':').map(Number);
    const et = new Date(+new Date(yyyy, mm - 1, dd, hh, mi, 0, 0) - readyOffset * 60000);
    setPendingEatTime(et);
    setEatTimeSet(true);
    hasManuallyDragged.current = false;
    setHasDragged(false);
    manualRefreshRef.current = null;
    manualFeed2Ref.current = null;
    manualMixRef.current = null;
    setDismissedConflict(false);
    setShowFallbackPopup(false);
    setPhase('start_confirm');
    // The compute used to live here. It belongs to the pendingEatTime effect
    // now — the same place that blanks the panel — so it cannot be skipped by
    // a path that reaches setPendingEatTime without coming through this
    // function. Running it here too would just solve the same schedule twice.
  }

  // Compute RT hours after fridge removal until starter peak, accounting for cold dwell.
  // rtToPeakH = max(warmupH, (fpH − dwellH) / coldFactor)
  // When dwell is long enough, the starter is nearly at peak on removal → bounded by warmupH.
  // When dwell is short, starter needs more RT time to finish rising.
  function fridgePeakAfterRemoval(fridgeOut: Date, lastFed: Date, adjPeakH_in: number): Date {
    const cf = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10);
    const wu = getStarterFridgeWarmupH(kitchenTemp);
    const fpH = adjPeakH_in * cf;
    const dwellH = (fridgeOut.getTime() - lastFed.getTime()) / 3600000;
    const rtToPeakH = Math.max(wu, (fpH - dwellH) / cf);
    return new Date(fridgeOut.getTime() + rtToPeakH * 3600000);
  }

  // Revival cycles (refresh feeds) a fridge starter needs before mixing.
  // Single source of truth — monotonic in age, maturity-aware, tang-aware.
  // Cross-checked vs real Singapore recipe: 1 refresh at 3-5 days is correct.
  //   age        mature  young
  //   today        0       0
  //   yesterday    0       1
  //   days23       1       1
  //   days45       1       2
  //   week         2       2
  function revivalCycles(
    age: typeof lastFedAge, mature: boolean, t: 'mild' | 'balanced' | 'tangy'
  ): number {
    let n: number;
    switch (age) {
      case 'today':     n = 0; break;
      case 'yesterday': n = mature ? 0 : 1; break;
      case 'days23':    n = 1; break;
      case 'days45':    n = mature ? 1 : 2; break;
      case 'week':      n = 2; break;
      default:          n = 0;
    }
    if (t === 'mild' && n < 2 && (age === 'days23' || age === 'days45' || age === 'week')) {
      n = Math.min(2, n + 1);
    }
    return n;
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
    const peakH = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
    const ryeF  = starterHasRye ? 0.8 : 1.0;
    const matF  = starterMature ? 1.0 : 1.2;
    const ratioMultiplier = 1 + 0.5 * Math.log(lastFeedRatio);
    const adjPeakH = peakH * ryeF * matF * ratioMultiplier;
    const troughH  = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMultiplier;
    const warmupH  = getStarterFridgeWarmupH(kitchenTemp);

    if (planningMode === 'know_peak' && knownPeakTime) {
      return { ...NULL_RESULT, peakTime: knownPeakTime, adjPeakH, feedTime: lastFedTime ?? null };
    }

    if (planningMode === 'last_fed' && lastFedTime) {
      const now = new Date();
      const hoursSinceFeed = (now.getTime() - lastFedTime.getTime()) / 3600000;

      if (starterLocation === 'fridge') {
        // Detect fridge starter revival need based on dwell time + lastFedAge.
        // Cold storage extends starter viability ~3-4× vs RT, but after ~5-7 days
        // in fridge, starter activity drops significantly and needs revival cycles.
        // Revival threshold: lastFedAge in {'days45', 'week'} OR fridge dwell > 5 days.
        // Any starter needing >=1 refresh cycle is in revival territory.
        const _cycles = revivalCycles(lastFedAge, starterMature, tang);
        const needsRevival = _cycles >= 1;

        if (needsRevival) {
          // Signal solver: this starter needs revival cycles. starterRefeedTime=now
          // makes Path B candidate (and intermediate refresh loop) eligible.
          // A fridge-located starter physically can't take a warm feed before
          // it warms up — the planned revival feed starts at now + warmup, so
          // "remove from fridge" lands at NOW instead of warmup-minutes in the
          // past (live bug: feed "Now · 8:45am" with removal 7:30am at 8:32).
          const refeedNow = new Date(Date.now() + warmupH * 3600000);
          // A refresh from a long-dormant starter peaks LATER than a healthy
          // one — the same refresh stretch the chart bell applies. Scoring
          // must use it too, or it thinks the starter peaks ~adjPeakH after
          // feeding (near mix → false green) while the bell peaks 1.5×
          // adjPeakH later. Mirror _refreshStretchFactor's late-decline value.
          const _revivalStretch = (() => {
            if (!lastFedTime) return 1.5;
            const hSince = (refeedNow.getTime() - lastFedTime.getTime()) / 3600000;
            if (hSince <= adjPeakH) return 1.0;
            if (hSince <= adjPeakH * 1.5) return 1.05;
            if (hSince <= troughH) return 1.15;
            if (hSince <= troughH * 1.5) return 1.25;
            if (hSince <= troughH * 2.5) return 1.35;
            return 1.5;
          })();
          const decliningPeak = new Date(refeedNow.getTime() + adjPeakH * _revivalStretch * 3600000);
          return {
            peakTime: decliningPeak,
            feedTime: lastFedTime,
            fridgeOut: fridgeOutTime,
            suggestedFridgeOut: null,
            suggestedFridgePeak: null,
            showFridgeComparison: false,
            fridgeSuggestion: null,
            starterIsDepletedAt: null,
            starterRefeedTime: refeedNow,
            starterStateNote: locale === 'fr'
              ? 'Levain au frigo depuis longtemps — rafraîchissements multiples recommandés avant le pétrissage.'
              : 'Starter in fridge for a while — multiple refresh cycles recommended before mixing.',
            adjPeakH,
          };
        }

        // Not in revival territory. Do NOT seed a peak1 candidate from
        // `fridgeOutTime` here: that value is engine-computed and fed back via
        // setFridgeOutTime after each solve, so seeding from it made the solver
        // non-idempotent — solve 1 (fridgeOutTime null) let the fridge-scan win
        // a self-consistent plan, then the fed-back fridgeOutTime disabled the
        // scan on solve 2 and a different, inconsistent candidate took over
        // (scoring peak ≠ cold bell → false green). The fridge-scan below owns
        // the "use straight from removal" path and searches the removal time
        // itself, keeping scoring ≡ bell ≡ card by construction.
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
        const sweetCenterH = ((sfDef.preferredColdH ?? sfDef.coldH ?? 0)
          + climateRtH(sfDef.rtH, kitchenTemp, isSourdough)
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
          // referenceMixTime, NOT pendingStart: pendingStart is the PREVIOUS
          // solve's mix fed back through state, which made derive depend on
          // the last answer — toggles then round-tripped to different plans
          // (sweep run 1: maturity/rye/location/ratioMode/Nights DIVERGED).
          const fridgeOutTime2 = new Date(referenceMixTime.getTime() - warmupH2 * 3600000);
          const timeInFridgeH = (fridgeOutTime2.getTime() - nowMs2) / 3600000;
          // fridgeViable: there is enough window to feed now, put in fridge,
          // and have it still rising (or near peak) at removal.
          // 0 < timeInFridge < fridgePeakH means: removal is before fridge peak
          // (starter still rising at removal — best case)
          // Also check: RT path doesn't already give green-green at a reasonable hour
          // If rtPeakTime is already in the sweet zone, no need for fridge.
          const _rtH_local = climateRtH(sfDef.rtH ?? 2, kitchenTemp, isSourdough);
          const localSweetFrom = (sfDef.preferredColdH ?? sfDef.coldH ?? 0) + _rtH_local
            + Math.round(((sfDef.coldH ?? 0) + _rtH_local) * 0.35);
          const localSweetTo = sfDef.minTotalFermH ?? _rtH_local;
          const rtPeakInZone = rtPeakTime !== null && (() => {
            const rtPeakHBF = (bakeTime.getTime() - rtPeakTime.getTime()) / 3600000;
            return rtPeakHBF >= localSweetTo && rtPeakHBF <= localSweetFrom;
          })();
          const fridgeViable = !rtPeakInZone
            && timeInFridgeH > 0
            && timeInFridgeH < fridgePeakH * 0.95;
          if (fridgeViable) {
            const computedFridgeOut = new Date(
              referenceMixTime.getTime() - warmupH2 * 3600000
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
      // Honest peak: a refresh from a depleted starter peaks LATER than a
      // healthy one — the same stretch the chart bell applies. Scoring must
      // use it too, or it thinks the starter peaks ~adjPeakH after feeding
      // (near mix -> false green) while the bell peaks up to 1.5x later.
      const _depletedStretch = (() => {
        const hSince = (refeedNow.getTime() - lastFedTime.getTime()) / 3600000;
        if (hSince <= adjPeakH) return 1.0;
        if (hSince <= adjPeakH * 1.5) return 1.05;
        if (hSince <= troughH) return 1.15;
        if (hSince <= troughH * 1.5) return 1.25;
        if (hSince <= troughH * 2.5) return 1.35;
        return 1.5;
      })();
      const depletedPeak = new Date(refeedNow.getTime() + adjPeakH * _depletedStretch * 3600000);
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
        starterStateNote: locale === 'fr'
          ? 'Épuisé — à rafraîchir. Le plan ci-dessous suppose un rafraîchi maintenant.'
          : 'Depleted — needs feeding. Schedule below assumes you feed it now.',
        adjPeakH,
      };
    }

    return NULL_RESULT;
  }

  // ── Sourdough: joint mix+starter solver (scoring loop) ──────
  // Read-only probes run the existing starter solver with isolated refs and
  // captured effects. Only an explicitly accepted, validated candidate replays
  // those effects; rendering a slider must never write the baker's saved plan.
  type StarterProbe = {result:SourdoughSolverResult|null;start:Date;effects:Array<()=>void>;mix:number|null;feed:number|null;refresh:number|null};
  const starterEffects = {notifyFromSolver,onFeed2TimeChange,onFeedTimeChange,onFridgeOutTimeChange,onStarterEventsChange,onStarterFridgeInTimeChange,setFridgeOutTime,setGuardNote,setHasDragged,setPendingStart,setRefeedSuggestion,setSolverResult,setStartComputed,setWindowTooShort,hasManuallyDragged,lastSolvedBlocksRef,manualFeed2Ref,manualMixRef,manualRefreshRef,resumeFrozenRef,sourdoughPlanBlockedRef};
  function findOptimalPositionSourdough(et: Date, manualMixOverride?: Date, blocksOverride?: AvailabilityBlock[], probe?:StarterProbe) {
    const notifyFromSolver = (...args:Parameters<typeof starterEffects.notifyFromSolver>) => {if(probe){probe.start=args[0];probe.effects.push(()=>starterEffects.notifyFromSolver(...args));}else starterEffects.notifyFromSolver(...args);};
    const onFeed2TimeChange = (...args:Parameters<NonNullable<typeof starterEffects.onFeed2TimeChange>>) => {if(probe){probe.effects.push(()=>starterEffects.onFeed2TimeChange?.(...args));}else starterEffects.onFeed2TimeChange?.(...args);};
    const onFeedTimeChange = (...args:Parameters<NonNullable<typeof starterEffects.onFeedTimeChange>>) => {if(probe){probe.effects.push(()=>starterEffects.onFeedTimeChange?.(...args));}else starterEffects.onFeedTimeChange?.(...args);};
    const onFridgeOutTimeChange = (...args:Parameters<NonNullable<typeof starterEffects.onFridgeOutTimeChange>>) => {if(probe){probe.effects.push(()=>starterEffects.onFridgeOutTimeChange?.(...args));}else starterEffects.onFridgeOutTimeChange?.(...args);};
    const onStarterEventsChange = (...args:Parameters<NonNullable<typeof starterEffects.onStarterEventsChange>>) => {if(probe){probe.effects.push(()=>starterEffects.onStarterEventsChange?.(...args));}else starterEffects.onStarterEventsChange?.(...args);};
    const onStarterFridgeInTimeChange = (...args:Parameters<NonNullable<typeof starterEffects.onStarterFridgeInTimeChange>>) => {if(probe){probe.effects.push(()=>starterEffects.onStarterFridgeInTimeChange?.(...args));}else starterEffects.onStarterFridgeInTimeChange?.(...args);};
    const setFridgeOutTime = (...args:Parameters<typeof starterEffects.setFridgeOutTime>) => {if(probe){probe.effects.push(()=>starterEffects.setFridgeOutTime(...args));}else starterEffects.setFridgeOutTime(...args);};
    const setGuardNote = (...args:Parameters<typeof starterEffects.setGuardNote>) => {if(probe){probe.effects.push(()=>starterEffects.setGuardNote(...args));}else starterEffects.setGuardNote(...args);};
    const setHasDragged = (...args:Parameters<typeof starterEffects.setHasDragged>) => {if(probe){probe.effects.push(()=>starterEffects.setHasDragged(...args));}else starterEffects.setHasDragged(...args);};
    const setPendingStart = (...args:Parameters<typeof starterEffects.setPendingStart>) => {if(probe){if(typeof args[0]!=='function')probe.start=args[0];probe.effects.push(()=>starterEffects.setPendingStart(...args));}else starterEffects.setPendingStart(...args);};
    const setRefeedSuggestion = (...args:Parameters<typeof starterEffects.setRefeedSuggestion>) => {if(probe){probe.effects.push(()=>starterEffects.setRefeedSuggestion(...args));}else starterEffects.setRefeedSuggestion(...args);};
    const setSolverResult = (...args:Parameters<typeof starterEffects.setSolverResult>) => {if(probe){if(typeof args[0]!=='function')probe.result=args[0];probe.effects.push(()=>starterEffects.setSolverResult(...args));}else starterEffects.setSolverResult(...args);};
    const setStartComputed = (...args:Parameters<typeof starterEffects.setStartComputed>) => {if(probe){probe.effects.push(()=>starterEffects.setStartComputed(...args));}else starterEffects.setStartComputed(...args);};
    const setWindowTooShort = (...args:Parameters<typeof starterEffects.setWindowTooShort>) => {if(probe){probe.effects.push(()=>starterEffects.setWindowTooShort(...args));}else starterEffects.setWindowTooShort(...args);};
    const hasManuallyDragged=probe?{current:starterEffects.hasManuallyDragged.current}:starterEffects.hasManuallyDragged;
    const lastSolvedBlocksRef=probe?{current:starterEffects.lastSolvedBlocksRef.current}:starterEffects.lastSolvedBlocksRef;
    const manualFeed2Ref=probe?{current:probe.feed}:starterEffects.manualFeed2Ref;
    const manualMixRef=probe?{current:probe.mix}:starterEffects.manualMixRef;
    const manualRefreshRef=probe?{current:probe.refresh}:starterEffects.manualRefreshRef;
    const resumeFrozenRef=probe?{current:false}:starterEffects.resumeFrozenRef;
    const sourdoughPlanBlockedRef=probe?{current:starterEffects.sourdoughPlanBlockedRef.current}:starterEffects.sourdoughPlanBlockedRef;

    if (resumeFrozenRef.current) return;
    // A past bake cannot produce a meaningful starter plan. Clear the stale
    // result and leave an explicit blocker instead of allowing a saved mix
    // time to be clamped to the bake itself.
    if (et.getTime() <= Date.now()) {
      sourdoughPlanBlockedRef.current = true;
      setWindowTooShort(false);
      setGuardNote(tRoot('schedulePicker.guardPast'));
      setStartComputed(false);
      setRefeedSuggestion(null);
      setSolverResult(null);
      return;
    }
    // Guard: bail early if required inputs aren't ready yet
    if (planningMode === 'last_fed' && (!lastFedTime || lastFedAge === null)) return;
    if (planningMode === 'know_peak' && !knownPeakTime) return;
    sourdoughPlanBlockedRef.current = false;

    // HOISTED — must be initialized before ANY buildAndSetResult() call.
    // inBlocker/inBlockerMs close over this const; the windowTooShort /
    // revival early-exit invokes buildAndSetResult (whose intermediate-feed
    // block calls inBlockerMs) BEFORE the old declaration point further down
    // → TDZ crash ("Cannot access before initialization") for week+ starters
    // with short windows. Keep this at the very top of the solver.
    const effectiveBlocks = blocksOverride ?? (isSourdough ? localBlocks : blocks);
    lastSolvedBlocksRef.current = effectiveBlocks;

    // Fold the baker's pinned mix into the override so effect-triggered
    // re-solves (ratio apply, refresh drags) honor a dragged Start Dough
    // exactly like the drag-time call did. Explicit override wins.
    if (manualMixOverride == null && manualMixRef.current != null) {
      manualMixOverride = new Date(manualMixRef.current);
    }
    // Reset drag state — any solver run means inputs changed, drag position is stale.
    // When triggered by a drag, preserve hasDragged so the label stays "Your plan".
    hasManuallyDragged.current = false;
    // Keep hasDragged when a baker pin is active — the pin IS a drag, and
    // clearing the flag here hid the “↺ Reset to recommendation” button
    // after every refresh/pre-mix diamond drag (live repro).
    if (!manualMixOverride && manualRefreshRef.current == null && manualFeed2Ref.current == null) {
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
    let _planConstrained = false;
    let _suggestedBakeTime: Date | null = null;
    let _farHorizonPlan = false;
    let _newPendingStart: Date = pendingStart;
    let _newFridgeOut: Date | null = fridgeOutTime;
    // Canonical fridge_in / fridge_out times for a non-Path-B fridge winner,
    // mirrored from best.renderFridgeInMs / best.renderFridgeOutMs once the
    // winner is selected. Read by the event builder's Block 2 to render
    // fridge_in / fridge_out at the EXACT timestamps candidateValid checked
    // (the values pushCand stored via computeNonPathBFridgeTimes). Null when
    // the winner is RT-only or Path B (Path B uses its own _fridgeHold*
    // mirrors). Render == validation by construction.
    let _renderFridgeInMs:  number | null = null;
    let _renderFridgeOutMs: number | null = null;
    let _adjPeakH: number | null = null;
    let _adjPeakH_last: number | null = null;
    let _fridgeFeedTime: Date | null = null;
    // Bridge-candidate refresh chain (additional to primary @now refresh) —
    // set when a bridging candidate wins; consumed by buildAndSetResult to
    // render exactly the refreshes the candidate was scored on.
    let _bridgeRefreshMs: number[] | null = null;
    let _recommendedNextFeedRatio: 1 | 2 | 4 | 5 | 10 | null = null;

    // Get derived starter state (no setState calls inside)
    const derived = deriveStarterPeakTime(et, targetMixTime);
    if(probe)probe.effects.push(()=>onStarterPeakTimeChange?.(derived.peakTime));
    else onStarterPeakTimeChange?.(derived.peakTime);
    const _feedTime = derived.feedTime;
    let _starterRefeedTime = derived.starterRefeedTime;
    // Baker-pinned refresh (dragged diamond): honored across all families —
    // Peak 2B, refresh+pre-mix, chains and the ratio evaluator all read this.
    if (manualRefreshRef.current != null && _starterRefeedTime) {
      _starterRefeedTime = new Date(manualRefreshRef.current);
    }
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
      // Safety guard: _newPendingStart defaults to the stale `pendingStart`
      // state and some early exits do not recompute it. Never emit a past
      // start, or silently choose the bake time when no future slot remains.
      const safeStart = futureMixBeforeBake(_newPendingStart, et);
      if (!safeStart) {
        sourdoughPlanBlockedRef.current = true;
        setWindowTooShort(false);
        setGuardNote(et.getTime() <= Date.now()
          ? tRoot('schedulePicker.guardPast')
          : tRoot('schedulePicker.guardNoFutureSlot'));
        setStartComputed(false);
        setRefeedSuggestion(null);
        setSolverResult(null);
        return;
      }
      if (mode === 'simple' && planningMode === 'know_peak' && knownPeakTime
        && !knownPeakMixUsable(safeStart, knownPeakTime, adjPeakH_derived, flourStrength)) {
        setPendingStart(safeStart);
        sourdoughPlanBlockedRef.current = true;
        setStartComputed(false);
        setSolverResult(null);
        onStarterEventsChange?.([]);
        onFeedTimeChange?.(null);
        return;
      }
      sourdoughPlanBlockedRef.current = false;
      _newPendingStart = safeStart;

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

      if (_bridgeRefreshMs && _bridgeRefreshMs.length > 0) {
        // Bridge-candidate winner — render exactly the refresh chain it was
        // scored on. Avoids any divergence between the scored plan and the
        // chart/card display (and prevents duplicate post-hoc intermediates).
        for (const ms of _bridgeRefreshMs) {
          _intermediateRefreshFeeds.push(new Date(ms));
        }
      } else if (_isFridgeHoldPath) {
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
            const ratioMult = 1 + 0.5 * Math.log(nextFeedRatio);
            // Refresh spacing: use peak-shoulder timing (~peakH × 1.25) instead of trough.
            // Baker best practice — refresh at/just past peak when starter is still strong,
            // not at trough (fully depleted). Peak-shoulder = peakH × 1.25 ≈ 17h at 22°C
            // for bread (peakH=14h). Biologically much better than waiting until trough (~25h),
            // because each refresh is from a stronger base.
            const peakH_int = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan') * ryeF * matF * ratioMult;
            const refreshSpacingH = peakH_int * 1.25;

            // Determine the "next major feed" the chart walks toward.
            // For fridge starter non-Path-B: respect _fridgeFeedTime as the boundary
            // (intermediates must precede the active fridge feed, not run past it).
            // For RT with future pre-mix: use _feed2Time.
            // For RT no future feed: use _newPendingStart - adjPeakH (implicit feed).
            const nextMajorFeedMs =
              starterLocation === 'fridge' && _fridgeFeedTime
                ? _fridgeFeedTime.getTime()
                : (_hasFutureFeedPath || _usingPeak2) && _feed2Time
                  ? _feed2Time.getTime()
                  : _newPendingStart.getTime() - adjPeakH_eff * 3600000;

            // Starting point: primary refresh if exists, then intermediate
            // refreshes (if any), else lastFedTime.
            const startMs = _intermediateRefreshFeeds.length > 0
              ? _intermediateRefreshFeeds[_intermediateRefreshFeeds.length - 1].getTime()
              : (_starterRefeedTime ? _starterRefeedTime.getTime() : lastFedTime.getTime());

            const gapH = (nextMajorFeedMs - startMs) / 3600000;
            // Cap intermediate refreshes at 2 (so total feeds including active ≤ 3).
            // This matches baker best practice — severely depleted starter recovers
            // with 2-3 feeds; more than that is wasted effort and not how bakers work.
            const MAX_INTERMEDIATES = 2;
            // Minimum revival refreshes by depletion level:
            //   - week+: at least 2 revival refreshes before active feed (deep revival)
            //   - days45: at least 1 revival refresh
            //   - else: no minimum (gap drives count)
            // cycles=1 → 0 intermediates (just the pre-mix); cycles=2 → 1 intermediate + pre-mix.
            const MIN_INTERMEDIATES = Math.max(0, revivalCycles(lastFedAge, starterMature, tang) - 1);
            const gapBasedCount = Math.floor(gapH / refreshSpacingH);
            const numIntermediate = Math.min(MAX_INTERMEDIATES + 1,
              Math.max(MIN_INTERMEDIATES + 1, gapBasedCount));

            // Same minimum spacing rule as computeIntermediatesForCandidate
            // and the bridge generator — max(6, adjPeakH × 0.75), enforced
            // between EVERY pair of consecutive feeds in the chain.
            const minFeedGapH_build = Math.max(6, adjPeakH_eff * 0.75);
            let prevAcceptedMs_build = startMs;
            for (let i = 1; i < numIntermediate; i++) {
              const ft = new Date(startMs + i * refreshSpacingH * 3600000);
              // Snap to 7am-10pm sleeping hours
              const h = ft.getHours();
              if (h < 7) { ft.setHours(7, 0, 0, 0); }
              else if (h > 22) { ft.setHours(7, 0, 0, 0); ft.setDate(ft.getDate() + 1); }
              // Guards: future, ≥ minFeedGapH before nextMajorFeedMs, ≥ minFeedGapH
              // after the previously accepted feed, AND clear of blockers.
              if (
                ft.getTime() > Date.now() &&
                ft.getTime() < nextMajorFeedMs - minFeedGapH_build * 3600000 &&
                ft.getTime() - prevAcceptedMs_build >= minFeedGapH_build * 3600000 &&
                !inBlockerMs(ft.getTime())
              ) {
                _intermediateRefreshFeeds.push(ft);
                prevAcceptedMs_build = ft.getTime();
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
        if (_planConstrained) {
          return isFr
            ? 'Créneau serré autour de vos disponibilités — le plan s’écarte un peu des fenêtres idéales.'
            : 'A tight fit around your hours — the plan bends the ideal windows a little.';
        }
        if (_farHorizonPlan) {
          return isFr
            ? 'Cuisson lointaine — gardez votre levain sur son rythme habituel, puis faites ce rafraîchi de montée pour qu\'il pique au pétrissage.'
            : 'Bake is far out — keep your starter on its usual feeding schedule, then do this build feed so it peaks at mix.';
        }
        if (_isFridgeHoldPath) {
          return isFr
            ? "Rafraîchi, pic, puis frigo jusqu'au rafraîchi final — idéal pour les cuissons à 2+ jours."
            : 'Refresh, peak, then fridge holds your starter until pre-mix — best for 2+ day plans.';
        }
        if (_usingPeak2 && !_hasFutureFeedPath) {
          // Only claim "peaks right at mix" when it actually does — otherwise
          // name the real peak time and let the baker mix when it's ready.
          // NOTE: compute the reference peak locally (same formula as
          // _refPeakForPreMix) — that const lives AFTER buildAndSetResult's
          // earliest invocation, so referencing it here would be a TDZ crash.
          const _p2AdjEff = _adjPeakH ?? adjPeakH_derived;
          const _p2RefPeak = _starterRefeedTime
            ? _starterRefeedTime.getTime() + (_p2AdjEff ?? 0) * 3600000
            : (lastFedTime ? lastFedTime.getTime() + (_p2AdjEff ?? 0) * 3600000 : null);
          const _p2Peak = _feed2Time && _p2AdjEff
            ? new Date(computeStarterPeakMs(_feed2Time.getTime(), _p2RefPeak, _p2AdjEff))
            : null;
          const _p2GapH = _p2Peak ? Math.abs(_newPendingStart.getTime() - _p2Peak.getTime()) / 3600000 : 0;
          // Adaptive "right at mix" threshold — matches the pill's green
          // past-peak ceiling (40% of a peak cycle, 1.0–1.5h) so the copy
          // can't claim "peaks right when you'll mix" while the pill is
          // yellow for a tropical past-peak gap.
          const _p2RightAtMixH = Math.max(1.0, Math.min(1.5, (_p2AdjEff ?? 14) * 0.4));
          if (_p2Peak && _p2GapH > _p2RightAtMixH) {
            return isFr
              ? `Un seul rafraîchi suffit — pic vers ${fmtCardHM(_p2Peak, true)}. Vérifiez sa montée avant de mélanger.`
              : `One refresh is enough — it peaks around ${fmtCardHM(_p2Peak, false)}. Check its rise before mixing.`;
          }
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
      //
      // INVARIANT: every action time (fridge_in / fridge_out / pre-mix / refresh /
      // intermediate_refresh) RENDERED below must be byte-identical to the
      // corresponding value in the winning candidate's actionTimesMs (the list
      // candidateValid scans). No render-time recomputation of any action
      // timestamp — the candidate's stored ms (best.fridgeHoldInMs,
      // best.fridgeHoldOutMs, best.feed2Ms, best.fridgeHoldRefreshMs,
      // best.fridgeOutMs, best.bridgeRefreshMs) is the SINGLE SOURCE OF TRUTH,
      // surfaced via the _* mirrors set when the winner is committed (see
      // lines ~3640/3672 where _newFridgeOut and the _fridgeHold* mirrors are
      // assigned). If the chart needs a derived time (e.g. a bell peak),
      // derive it FROM the stored action time — never recompute the action
      // time itself with its own formula. Validator and render reading
      // different values of the SAME logical timestamp is the root cause of
      // false-green pills, where a fridge action sits in a blocker but the
      // plan validates against a different timestamp that doesn't.
      //
      // MUTUAL EXCLUSION (fridge_in / fridge_out emission):
      //   - _isFridgeHoldPath winner → ONLY the Path B block (just below)
      //     emits fridge_in/out, both from candidate-stored ms.
      //   - non-Path-B fridge starter → ONLY the Block 2 block (further
      //     below, gated on !_isFridgeHoldPath) emits fridge_in/out, both
      //     derived from candidate-stored ms via _newFridgeOut and the
      //     rendered refresh peaks.
      //   - RT starter (non-Path-B) → no fridge_in/out emitted.
      // The two blocks must NEVER both fire for one winning plan; if they
      // did and disagreed, the validator would check one timestamp while the
      // chart and card rendered another.
      const _starterEvents: StarterEvent[] = (() => {
        const events: StarterEvent[] = [];
        const nowMs = Date.now();
        const adjPeakH_eff = _adjPeakH ?? adjPeakH_derived ?? 0;
        const refreshStretch = _refreshStretchFactor;
        const preMixStretch  = _preMixStretchFactor;
        // Stage 1: split ratio adjustment between historical and forward cycles.
        // In Stage 1, lastFeedRatio === nextFeedRatio (override always null), so
        // adjPeakH_last_eff === adjPeakH_next_eff and behavior is unchanged.
        const peakH_base_evt = getPrefPeakH_RT('sourdough', kitchenTemp, styleKey ?? 'neapolitan');
        const ryeF_evt = starterHasRye ? 0.8 : 1.0;
        const matF_evt = starterMature ? 1.0 : 1.2;
        const ratioMult_last_evt = 1 + 0.5 * Math.log(lastFeedRatio);
        const ratioMult_next_evt = 1 + 0.5 * Math.log(nextFeedRatio);
        const adjPeakH_last_eff = peakH_base_evt * ryeF_evt * matF_evt * ratioMult_last_evt;
        const adjPeakH_next_eff = peakH_base_evt * ryeF_evt * matF_evt * ratioMult_next_evt;

        if (planningMode === 'know_peak' && knownPeakTime) {
          const knownPeakBellH = adjPeakH_next_eff > 0 ? adjPeakH_next_eff : 14;
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
          // _planHasRefresh: does the live plan schedule any refresh feed
          // (primary, intermediate, or Path B)? Read from
          // _intermediateRefreshFeeds (populated above, before this push, at
          // lines ~2326–2331 and 2390–2406 — the SAME array the
          // intermediate_refresh events below iterate). The events array
          // can't be scanned here because primary/intermediate refresh
          // pushes happen AFTER this last_fed push; intermediates is the
          // live source. Primary refresh is implicitly covered by
          // !_starterRefeedTime, Path B by !_isFridgeHoldPath; this catches
          // the missing case (fridge starter with scheduled intermediate
          // feeds but no primary refresh).
          const _planHasRefresh = _intermediateRefreshFeeds.length > 0;
          // Detect: fridge is holding the last feed as the active cycle.
          // (No refresh planned, no path B, no future feed — engine is using
          // the existing feed and removing from fridge at the right time.)
          // Without !_planHasRefresh, an intermediate-refresh plan kept the
          // last_fed bell active with a 46h-distant COLD peak (lastFed +
          // adjPeakH × coldFactor, line ~2564); the chart fell back to
          // plain makeBellPath at that distant peak — the "flat for ~2 days
          // then spike" shape. With the guard, last_fed switches to the
          // historical_dotted RT cycle (peak ~adjPeakH after feed, line
          // ~2565) and the refresh bells carry the story.
          const isLastFedActiveInFridge =
            starterLocation === 'fridge'
            && !_isFridgeHoldPath
            && !_starterRefeedTime
            && !_usingPeak2
            && !_hasFutureFeedPath
            && !_planHasRefresh;

          // De-dupe: when the first scheduled refresh (primary, first
          // intermediate, or Path B) lands within ~1h of lastFedTime, the
          // "refresh" IS that same feed — surfacing both a historical
          // last_fed event AND a coincident refresh would stack two diamonds
          // and two labels at the same x. Suppress the separate last_fed
          // event in that case; the refresh push downstream already carries
          // the diamond + 'Refresh Feed' label. The historical last_fed
          // still renders when it is meaningfully earlier than the first
          // refresh (a genuinely distinct past feed — e.g. fed 2–3 days
          // ago, refresh planned now).
          const SAME_MOMENT_MS = 60 * 60 * 1000;
          const _firstRefreshMs: number | null =
            _starterRefeedTime?.getTime()
            ?? _fridgeHoldRefreshTime?.getTime()
            ?? (_intermediateRefreshFeeds.length > 0
                  ? _intermediateRefreshFeeds[0].getTime()
                  : null);
          const _firstRefreshCoincidesWithLastFed =
            _firstRefreshMs !== null
            && Math.abs(_firstRefreshMs - lastFedTime.getTime()) <= SAME_MOMENT_MS;

          // Bell peak time:
          //  - When active in fridge AND engine has set _newFridgeOut:
          //      peak = fridgeOut + warmupH (engine's actual plan)
          //  - When active in fridge but no fridgeOut yet (early state):
          //      peak = lastFed + adjPeakH × coldFactor (theoretical fridge peak)
          //  - Otherwise (historical, RT cycle):
          //      peak = lastFed + adjPeakH (RT cycle)
          const _coldFactor_evt = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10);
          const _warmupH_evt = getStarterFridgeWarmupH(kitchenTemp);
          // A starter that sat in the FRIDGE since its last feed rises at
          // cold speed regardless of whether that cycle is still active —
          // the historical bell previously used the RT peak (~6h after
          // feed, tall narrow spike) while the card correctly described the
          // fridge peak, so chart and card told different stories.
          const _lastFedInFridge = starterLocation === 'fridge';
          const lastFedBellPeakTime = isLastFedActiveInFridge
            ? (_newFridgeOut
                ? fridgePeakAfterRemoval(_newFridgeOut, lastFedTime, adjPeakH_last_eff)
                : new Date(lastFedTime.getTime() + adjPeakH_last_eff * _coldFactor_evt * 3600000))
            : new Date(lastFedTime.getTime() + adjPeakH_last_eff * (_lastFedInFridge ? _coldFactor_evt : 1) * 3600000);

          if (!_firstRefreshCoincidesWithLastFed) {
            events.push({
              kind: 'last_fed',
              time: lastFedTime,
              isPast: lastFedTime.getTime() < nowMs,
              isActive: isLastFedActiveInFridge,
              isDraggable: false,
              label: isFr ? 'Dernier rafraîchi' : 'Last fed',
              cardTimeFormat: 'absolute',
              // Age chips ("2–3 days ago") derive a precise-looking time —
              // flag it so the card shows ≈ instead of implying we know
              // it was exactly 8:15am.
              timeIsEstimate: lastFedAge === 'days23' || lastFedAge === 'days45' || lastFedAge === 'week',
              cardNote: isLastFedActiveInFridge
                ? (isFr
                    ? `Au frigo — pic vers ${fmtCardHM(lastFedBellPeakTime, isFr)}`
                    : `Held in fridge — peak around ${fmtCardHM(lastFedBellPeakTime, isFr)}`)
                : undefined,
              bellStyle: isLastFedActiveInFridge ? 'solid' : 'historical_dotted',
              bellPeakTime: lastFedBellPeakTime,
              // Cold rise is ~coldFactor slower — widen the bell to match,
              // otherwise the spike contradicts the fridge narrative.
              bellSigmaScale: _lastFedInFridge ? Math.max(1, _coldFactor_evt) : 1.0,
              // Historical FACT, not plan state: the starter sat in the fridge
              // since this feed (starterLocation), so the chart must draw the
              // fridge-phase shape (cold rise → plateau → sagging decline)
              // REGARDLESS of whether the winning plan emits fridge_in/out
              // events. Previously this was isLastFedActiveInFridge, so the
              // PAST bell changed shape when a blocker toggled the winner
              // between plans with and without a fridge_out — the past must be
              // blocker- and future-choice-independent.
              hasFridgePhase: _lastFedInFridge,
            });
          }
        }

        // Block 1 — Path B (fridge-hold) winner. Gated on _isFridgeHoldPath
        // ALONE so a Path B winner can NEVER silently fall through to
        // Block 2's _newFridgeOut math. _isFridgeHoldPath is set only at
        // line ~3673 when best.isFridgeHoldPath is true, and Path B candidate
        // creation (line ~3518) populates fridgeHoldRefreshMs /
        // fridgeHoldInMs / fridgeHoldOutMs / feed2Ms together — so all four
        // _* mirrors will be non-null in practice. Each individual events.push
        // below is now guarded by the corresponding mirror so we always
        // return early for a Path B winner, even in the degenerate case
        // where one mirror is null (better to drop one event than to let
        // Block 2 re-emit fridge_out at a different timestamp).
        if (_isFridgeHoldPath) {
          // Coherence safety net (defense in depth): the Path B generator
          // (line ~3506) already enforces refresh < fridge_in < fridge_out <
          // pre-mix on the CANDIDATE before pushing it into the pool, so any
          // _isFridgeHoldPath winner is coherent by construction. This check
          // re-verifies the ordering on the exact ms that are about to be
          // rendered, so a future regression that broke the generator guard
          // (or a stale-mirror leak) can't silently emit out-before-in
          // events. If the four mirrors disagree on ordering, drop the fridge
          // pair from the render (refresh + pre-mix still emit) rather than
          // draw an impossible cold band. This is render-time triage; the
          // root fix is always in the candidate generator.
          const _coherent = (
            _fridgeHoldRefreshTime
            && _fridgeHoldInTime
            && _fridgeHoldOutTime
            && _feed2Time
            && _fridgeHoldRefreshTime.getTime() <= _fridgeHoldInTime.getTime()
            && _fridgeHoldInTime.getTime() < _fridgeHoldOutTime.getTime()
            && _fridgeHoldOutTime.getTime() <= _feed2Time.getTime()
          );
          // A cold hold shorter than 2h is engine noise, not a real fridge
          // step — don't send the baker to the fridge for minutes, and don't
          // render a zero-width cold band.
          const _holdH = _fridgeHoldInTime && _fridgeHoldOutTime
            ? (_fridgeHoldOutTime.getTime() - _fridgeHoldInTime.getTime()) / 3600000
            : 0;
          const _meaningfulHold = _holdH >= 2;
          if (_fridgeHoldRefreshTime) {
            const refreshPeakAt = new Date(_fridgeHoldRefreshTime.getTime() + adjPeakH_next_eff * refreshStretch * 3600000);
            // This refresh is the baker's NEXT ACTION when it's now/upcoming —
            // it rendered as a faint dotted sliver ("the Now curve is not
            // shown") while only the final pre-mix feed got the solid bell.
            const _refreshUpcoming = _fridgeHoldRefreshTime.getTime() >= nowMs - 60 * 60 * 1000;
            events.push({
              kind: 'refresh',
              time: _fridgeHoldRefreshTime,
              isPast: _fridgeHoldRefreshTime.getTime() < nowMs - 60 * 60 * 1000,
              isActive: _refreshUpcoming,
              isDraggable: false,
              label: isFr ? 'Rafraîchi' : 'Refresh Feed',
              cardTimeFormat: Math.abs(_fridgeHoldRefreshTime.getTime() - nowMs) < 30 * 60000 ? 'relative' : 'absolute',
              cardNote: _meaningfulHold
                ? (isFr
                    ? `Pic vers ${fmtCardHM(refreshPeakAt, isFr)} — puis au frigo`
                    : `Peak around ${fmtCardHM(refreshPeakAt, isFr)} — then refrigerate`)
                : (isFr
                    ? `Pic vers ${fmtCardHM(refreshPeakAt, isFr)}`
                    : `Peak around ${fmtCardHM(refreshPeakAt, isFr)}`),
              bellStyle: _refreshUpcoming ? 'solid' : 'dotted',
              bellPeakTime: refreshPeakAt,
              bellSigmaScale: refreshStretch,
              // hasFridgePhase is NOT set here. Path B's biology is "refresh at
              // RT → rise to peak → put in fridge at peak → flat cold plateau"
              // — the opposite of makeFridgePhaseBellPath's "fed-then-fridge"
              // shape. The chart renders a separate cold plateau between the
              // fridge_in and fridge_out events (see FermentChart fridge-hold
              // block) so the curve shows: rise to peak → flat cold band →
              // resume.
            });
          }
          if (_fridgeHoldInTime && _coherent && _meaningfulHold) {
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
          }
          if (_fridgeHoldOutTime && _coherent && _meaningfulHold) {
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
          }
          if (_feed2Time) {
            const preMixPeakAt = new Date(_feed2Time.getTime() + adjPeakH_next_eff * preMixStretch * 3600000);
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
          }
          // Always return early for a Path B winner — even if some _* mirror
          // was null and we emitted fewer events. Falling through would let
          // Block 2 recompute fridge_out at newMix − warmupH and emit a
          // SECOND fridge_out at a different timestamp than the validator
          // checked (best.fridgeHoldOutMs) — the false-green hiding spot.
          events.sort((a, b) => a.time.getTime() - b.time.getTime());
          return events;
        }

        if (_starterRefeedTime && !_usingPeak2) {
          const isPrimary = !_hasFutureFeedPath;
          const refreshPeakAt = new Date(_starterRefeedTime.getTime() + adjPeakH_next_eff * refreshStretch * 3600000);
          events.push({
            kind: 'refresh',
            time: _starterRefeedTime,
            isPast: _starterRefeedTime.getTime() < nowMs - 60 * 60 * 1000,
            isActive: isPrimary,
            // The refresh is draggable (pin + re-solve) whether or not a
            // pre-mix follows — the multi-feed refresh-now is exactly the
            // diamond bakers want to move. Bridge-chain refreshes stay fixed
            // (one link of a chain can't move alone); intermediates recompute
            // from the pinned refresh at the next solve.
            isDraggable: !_bridgeRefreshMs,
            label: isFr ? 'Rafraîchi' : 'Refresh Feed',
            // "Now · ..." only when it truly is now — a clamped/delayed
            // refresh (fridge warmup) shows its absolute time.
            cardTimeFormat: Math.abs(_starterRefeedTime.getTime() - nowMs) < 30 * 60000 ? 'relative' : 'absolute',
            cardNote: isFr ? `Pic vers ${fmtCardHM(refreshPeakAt, isFr)}` : `Peak around ${fmtCardHM(refreshPeakAt, isFr)}`,
            bellStyle: isPrimary ? 'solid' : 'dotted',
            bellPeakTime: refreshPeakAt,
            bellSigmaScale: refreshStretch,
          });
        }

        for (let i = 0; i < _intermediateRefreshFeeds.length; i++) {
          const ft = _intermediateRefreshFeeds[i];
          if (_starterRefeedTime && Math.abs(ft.getTime() - _starterRefeedTime.getTime()) < 30 * 60 * 1000) continue;
          const intPeakAt = new Date(ft.getTime() + adjPeakH_next_eff * 3600000);
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
          const preMixPeakAt = new Date(_feed2Time.getTime() + adjPeakH_next_eff * preMixStretch * 3600000);
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
            hasFridgePhase: starterLocation === 'fridge',
          });
        }

        // Block 2 — non-Path-B fridge starter fridge_in / fridge_out emission.
        // Gated mutually-exclusive with Block 1: !_isFridgeHoldPath AND no
        // Path B mirror set. Both event times are now read from the winning
        // candidate's stored fields (mirrored as _renderFridgeInMs /
        // _renderFridgeOutMs from best.renderFridgeInMs / best.renderFridgeOutMs,
        // populated at gen time by pushCand → computeNonPathBFridgeTimes —
        // the SAME function and adjPeakH the validator used).
        //
        // INVARIANT: every fridge timestamp the event builder renders is
        // byte-identical to a stored candidate field, which is byte-identical
        // to the value candidateActionTimes / candidateValid scanned. The old
        // render-time recompute (latestRefreshPeakMs from rendered events,
        // _newFridgeOut from newMix − warmupH) is gone — it diverged from the
        // validator when an intermediate refresh peak ran later than the
        // primary, and let plans with fridge actions in blockers pass as
        // green (the false-green root cause). Render-only card-note math
        // (warmup minutes) stays here but never touches the event time.
        if (!_isFridgeHoldPath
            && _fridgeHoldOutTime == null
            && _fridgeHoldInTime == null
            && _fridgeHoldRefreshTime == null
            && starterLocation === 'fridge'
            && _renderFridgeOutMs != null) {
          // Display floor: an already-elapsed removal reads as "now" (the
          // biology math below still uses the raw computed value).
          const _foDisplayMs = Math.max(_renderFridgeOutMs, nowMs);
          const fridgeOutDate = new Date(_foDisplayMs);
          if (_renderFridgeInMs != null && _renderFridgeInMs < _renderFridgeOutMs) {
            // "At peak" is only true when the starter was chilled at its peak.
            // Fed-straight-into-fridge (fridge_in ≈ last feed) needs honest copy.
            const _straightIn = lastFedTime
              && Math.abs(_renderFridgeInMs - lastFedTime.getTime()) < 60 * 60 * 1000;
            events.push({
              kind: 'fridge_in',
              time: new Date(_renderFridgeInMs),
              isPast: _renderFridgeInMs < nowMs,
              isActive: false,
              isDraggable: false,
              label: isFr ? 'Au frigo' : 'Into Fridge',
              cardTimeFormat: 'absolute',
              // Age-chip times are estimates — never fabricate minute
              // precision for "2–3 days ago".
              timeIsEstimate: !!_straightIn && (lastFedAge === 'days23' || lastFedAge === 'days45' || lastFedAge === 'week'),
              cardNote: _straightIn
                ? (isFr ? 'Directement au frigo — montée lente au froid' : 'Straight to the fridge — slow cold rise')
                : (isFr ? 'Au pic — ralentit la fermentation' : 'At peak — slows fermentation'),
              bellStyle: 'none',
              bellSigmaScale: 1.0,
            });
          }
          const _warmupH_fo = getStarterFridgeWarmupH(kitchenTemp);
          const _cf_fo = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10);
          const _fpH_fo = adjPeakH_last_eff * _cf_fo;
          const _dwellH_fo = lastFedTime
            ? (_renderFridgeOutMs - lastFedTime.getTime()) / 3600000
            : _fpH_fo;
          const _rtToPeak_fo = Math.max(_warmupH_fo, (_fpH_fo - _dwellH_fo) / _cf_fo);
          const _foNoteMin = Math.round(_rtToPeak_fo * 60);
          const _showExtendedNote = _rtToPeak_fo > _warmupH_fo + 0.25;
          events.push({
            kind: 'fridge_out',
            time: fridgeOutDate,
            isPast: _foDisplayMs < nowMs,
            isActive: false,
            isDraggable: false,
            label: isFr ? 'Sortie du frigo' : 'Remove from Fridge',
            cardTimeFormat: 'absolute',
            cardNote: _showExtendedNote
              ? (isFr
                  ? `~${_foNoteMin} min à temp. ambiante jusqu'au pic`
                  : `~${_foNoteMin} min at room temp to reach peak`)
              : (isFr
                  ? `~${_foNoteMin} min pour atteindre la temp. ambiante`
                  : `~${_foNoteMin} min to reach room temp`),
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

      // B2 telemetry tap — classifies the winning candidate family per solve.
      // Inert unless a sweep harness sets window.__bhTrace = [] first
      // (established __audit pattern). Zero cost in normal use.
      // Committed peak — single computation shared by setSolverResult and the
      // telemetry trace so the trace always reports the value the card renders.
      //
      // Preferred source: the ACTIVE starter event's bellPeakTime. The card's
      // "Peak around HH" note is rendered from that SAME bellPeakTime, so
      // reading it here makes PEAK-row ≡ card-note ≡ chart-bell by construction
      // (they can't diverge by a rounding minute the way two parallel
      // adjPeakH×stretch formulas could — the 24°C "7am vs 7:15am" straddle).
      // Pick the active event nearest bake (the pre-mix / final refresh), whose
      // peak is the one the plan mixes at. Falls back to the explicit formula
      // below only when no active event carries a bellPeakTime.
      const _activeBellPeak: Date | null = (() => {
        // Only forward peaks: a spent last-fed cycle can be marked active with a
        // bellPeak in the past — that's not the peak the plan mixes at, so let
        // the explicit formula below (fridge-removal / refresh) own those.
        const act = _starterEvents.filter(
          e => e.isActive && e.bellPeakTime && e.bellPeakTime.getTime() > Date.now(),
        );
        if (!act.length) return null;
        return act.reduce((a, b) => (b.time.getTime() > a.time.getTime() ? b : a)).bellPeakTime ?? null;
      })();
      const _committedPeakTime: Date | null = planningMode === 'know_peak' ? knownPeakTime : _activeBellPeak ??
        ((_isFridgeHoldPath && _feed2Time && _adjPeakH)
          ? new Date(_feed2Time.getTime() + _adjPeakH * _preMixStretchFactor * 3600000)
          // Feed2-driven peak SECOND: future-feed / peak2 winners peak off the
          // pre-mix feed — the SAME value the pre_mix event's bellPeakTime
          // uses. Without this branch a fridge-located future-feed winner fell
          // into the fridge branches below and the PEAK row showed
          // removal+warmup ≈ mix (the 31°C "PEAK 10:45pm vs note 1:45am"
          // card contradiction).
          : ((_hasFutureFeedPath || _usingPeak2) && _feed2Time && _adjPeakH)
          ? new Date(_feed2Time.getTime() + _adjPeakH * _preMixStretchFactor * 3600000)
          : (_starterRefeedTime && !_hasFutureFeedPath && !_usingPeak2 && _adjPeakH
              ? new Date(_starterRefeedTime.getTime() + _adjPeakH * _refreshStretchFactor * 3600000)
          : (starterLocation === 'fridge' && _newFridgeOut && _renderFridgeOutMs != null && lastFedTime)
          ? fridgePeakAfterRemoval(_newFridgeOut, lastFedTime, _adjPeakH_last ?? _adjPeakH ?? adjPeakH_derived ?? 14)
          : (starterLocation === 'fridge' && _newFridgeOut && _renderFridgeOutMs != null)
          ? new Date(_newFridgeOut.getTime() + getStarterFridgeWarmupH(kitchenTemp) * 3600000)
          : _starterFeedTime && _adjPeakH
              ? new Date(_starterFeedTime.getTime() + _adjPeakH * _preMixStretchFactor * 3600000)
              : null));

      if (!probe && typeof window !== 'undefined' && Array.isArray((window as unknown as { __bhTrace?: unknown[] }).__bhTrace)) {
        const family = _isFridgeHoldPath ? 'pathB_fridge_hold'
          : _bridgeRefreshMs ? 'bridge_refresh'
          : _usingPeak2 ? (_hasFutureFeedPath ? 'peak2b_refeed_now' : 'peak2a_trough')
          : _hasFutureFeedPath ? 'future_feed'
          : 'peak1';
        (window as unknown as { __bhTrace: unknown[] }).__bhTrace.push({
          family,
          windowTooShort: _windowTooShort,
          planConstrained: _planConstrained,
          farHorizon: _farHorizonPlan,
          starterLocation, planningMode, lastFedAge, tang,
          lastFeedRatio, kitchenTemp,
          eatTime: et.getTime(),
          adjPeakH: _adjPeakH,
          // Committed-plan surface values (mix / peak / feeds / fridge / pill)
          // so sweeps can gate card ≡ note ≡ pill ≡ bell without fiber reads.
          mixMs: _newPendingStart.getTime(),
          peakMs: _committedPeakTime?.getTime() ?? null,
          refeedMs: _starterRefeedTime?.getTime() ?? null,
          feed2Ms: _feed2Time?.getTime() ?? null,
          fridgeOutMs: _newFridgeOut?.getTime() ?? null,
          pill: _starterPillState,
          usingPeak2: _usingPeak2,
          hasFutureFeedPath: _hasFutureFeedPath,
          refreshStretch: _refreshStretchFactor,
          preMixStretch: _preMixStretchFactor,
          events: _starterEvents.map(e => ({
            kind: e.kind, t: e.time.getTime(), active: e.isActive,
            bellPeak: e.bellPeakTime?.getTime() ?? null, note: e.cardNote ?? null,
          })),
        });
      }

      setSolverResult({
        usingPeak2:             _usingPeak2,
        hasFutureFeedPath:      _hasFutureFeedPath,
        starterPillState:       _starterPillState,
        driftNote:              _driftNote,
        starterRefeedTime:      _starterRefeedTime,
        // Derive-time notes for RT declining/depleted starters say "feed it
        // now" — but the winning plan may delay the primary feed (now inside
        // a blocker → Option C / delayed families). Say what the plan
        // actually does. Fridge-revival notes don't claim "now" and pass
        // through untouched (starterLocation gate).
        starterStateNote:       (() => {
          if (_starterStateNote && starterLocation === 'rt' && _starterRefeedTime) {
            const _pf = (_usingPeak2 && _feed2Time) ? _feed2Time.getTime() : _starterRefeedTime.getTime();
            if (Math.abs(_pf - Date.now()) > 30 * 60000) {
              return locale === 'fr'
                ? 'Votre levain a besoin d’un rafraîchi — le plan le place quand vous êtes disponible.'
                : 'Your starter needs a refresh — the plan schedules it when you’re free.';
            }
          }
          return _starterStateNote;
        })(),
        fridgeSuggestion:       _fridgeSuggestionFinal,
        suggestedFridgeOutTime: _suggestedFridgeOut,
        suggestedFridgePeakTime: _suggestedFridgePeak,
        showFridgeComparison:   _showFridgeComparison,
        adjPeakHValue:          _adjPeakH ?? (adjPeakH_derived || null),
        sourdoughSweetFrom:     _sourdoughSweetFrom,
        sourdoughSweetTo:       _sourdoughSweetTo,
        starterIsDepletedAt:    _starterIsDepletedAt,
        windowTooShort:         _windowTooShort,
        planConstrained:        _planConstrained,
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
        // Path B (fridge-hold) takes precedence regardless of starterLocation:
        // the active peak is the POST-FRIDGE pre-mix peak (= _feed2Time +
        // adjPeakH × preMixStretch), the SAME value the pre_mix event's
        // bellPeakTime uses (event builder lines ~2719/2781). Previously
        // peakTime branched on starterLocation === 'fridge'; an RT-initiated
        // Path B plan fell through to the _starterFeedTime branch and
        // returned the stale REFRESH peak — the card PEAK row, the chart
        // active peak, and the pre_mix bell ended up disagreeing.
        // adjPeakH_next_eff in the event builder is computed from the same
        // (peakH × ryeF × matF × ratioMultiplier) inputs as the outer
        // _adjPeakH (line ~2985), so the two formulas are byte-identical.
        peakTime: _committedPeakTime,
        starterIntermediateFeeds: _intermediateRefreshFeeds,
        isFridgeHoldPath:      _isFridgeHoldPath,
        fridgeHoldRefreshTime: _fridgeHoldRefreshTime,
        fridgeHoldInTime:      _fridgeHoldInTime,
        fridgeHoldOutTime:     _fridgeHoldOutTime,
        preMixStretchFactor:   _preMixStretchFactor,
        refreshStretchFactor:  _refreshStretchFactor,
        planExplanation:       _planExplanation,
        starterEvents:         _starterEvents,
        recommendedNextFeedRatio: _recommendedNextFeedRatio,
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
    // localSweetFrom = full quality plateau edge (preferredCold + rtH) — unbiased.
    // Tang effect comes from directional retardBonus (not band edge shift).
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
    const ratioMultiplier = 1 + 0.5 * Math.log(nextFeedRatio);
    const adjPeakH = peakH * ryeF * matF * ratioMultiplier;
    _adjPeakH = adjPeakH;
    // Peak hours from the LAST feed's ratio. A fridge starter used straight from
    // removal has NO future feed, so its rise is governed by lastFeedRatio, not
    // the recommended nextFeedRatio. The cold last_fed bell already uses this
    // (adjPeakH_last_eff in the event builder); the fridge-scan scoring and the
    // card fridge peak anchor to it too so card ≡ graph ≡ pill and the ratio
    // search can't shift a feed-less plan's peak.
    const adjPeakH_last = peakH * ryeF * matF * (1 + 0.5 * Math.log(lastFeedRatio));
    _adjPeakH_last = adjPeakH_last;

    // For severely depleted starters (week+ or fridge revival territory),
    // baker needs 1-2 full peak cycles to revive before normal dough cycle.
    // Minimum revival overhead: 1 cycle ~ adjPeakH; deep revival ~ 2 cycles.
    const _revivalOverheadH = (() => {
      // ~1.25 peak-cycles overhead per revival cycle (feed + rise time).
      // Feasibility must use the BALANCED cycle count: taste is a scheduling
      // preference, never a gate. Milder's +1 revival cycle inflated this hard
      // floor by ~adjPeakH*1.25 (+10h at 22°C) and flipped a comfortably
      // feasible 24h bake into "window too tight" (live repro 22 Jul). Mild
      // still gets its extra refresh via MIN_INTERMEDIATES when the window
      // actually fits it.
      const cycles = revivalCycles(lastFedAge, starterMature, 'balanced');
      return adjPeakH * 1.25 * cycles;
    })();
    // Starter-peak lead: if the last feed is already PAST its peak, the starter
    // must be refreshed and brought back to peak before it can leaven the dough,
    // so the viable window must fit ~one more peak cycle on top of the dough
    // ferment. Without this, a cold/slow kitchen (adjPeakH large) produced a
    // green "ready at mix" plan whose starter peak actually landed hours AFTER
    // mix — the plan should instead honestly report "not enough time." Only the
    // past-peak case adds lead (a still-rising starter is usable as-is); take
    // the max with revival overhead so the two don't double-count.
    const _starterLeadH = (planningMode === 'last_fed' && lastFedTime
      && (Date.now() - lastFedTime.getTime()) / 3600000 > adjPeakH)
      ? adjPeakH : 0;
    const effectiveMinFermH = minFermH + Math.max(_revivalOverheadH, _starterLeadH);

    if (windowHBF < effectiveMinFermH) {
      _windowTooShort = true;
      // A short window has no validated starter/mix candidate. Keep the
      // status honest so the visible blocker and later-bake suggestion are
      // not paired with a reassuring green pill.
      _starterPillState = 'yellow';
      setWindowTooShort(true);
      setRefeedSuggestion(null);
      _feed2Time = null;

      // Earliest viable bake suggestion — bread only (not pizza)
      if (bakeType === 'bread') {
        const sweetCenterH = (localSweetFrom + localSweetTo) / 2;
        const minNeededH   = adjPeakH + sweetCenterH + 1 + _revivalOverheadH;
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
    // Canonical reference peak for pre-mix/future feeds — the SAME reference the
    // bell's `_preMixStretchFactor` uses (bare adjPeakH). Every candidate family
    // that renders a pre_mix bell scores its peak via computeStarterPeakMs()
    // against THIS reference, so scoring peak ≡ bell peak by construction.
    const _refPeakForPreMix: number | null = _starterRefeedTime
      ? _starterRefeedTime.getTime() + adjPeakH * 3600000
      : (lastFedTime ? lastFedTime.getTime() + adjPeakH * 3600000 : null);
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
      // HBF: larger = earlier. mixHBF > peakHBF means mix BEFORE peak (starter
      // still rising — safer; allow slightly more tolerance on this side).
      const beforePeak = mixHBF > peakHBF;
      const gap = Math.abs(mixHBF - peakHBF);
      const tol2 = beforePeak ? TOL + 0.5 : TOL;
      if (gap <= tol2)       return 2;
      if (gap <= tol2 + 1.5) return 1;
      return 0;
    }

    // Rise-completion guard: a candidate that mixes long before its own feed's
    // rise has completed is biologically nonsense — the freshly-fed starter has
    // barely begun rising and the pre-feed culture is spent (the 31°C live bug:
    // "REFRESH FEED Now · 10:30pm → START DOUGH 10:45pm"). starterScore's gap
    // tolerance is absolute hours, so at tropical temps (short rises) it lets
    // "just fed" read as "nearly at peak". Only guards the rising side; the
    // declining side is already handled by the gap tolerance. Requires ≥60% of
    // the feed→peak rise to be complete at mix.
    function riseCompleteEnough(mixHBF: number, peakHBF: number, feedAnchorMs: number | null): boolean {
      if (feedAnchorMs == null) return true;
      const mixMs2  = bakeMs - mixHBF  * 3600000;
      const peakMs2 = bakeMs - peakHBF * 3600000;
      if (mixMs2 >= peakMs2) return true;         // at/after peak — not this guard's job
      if (peakMs2 <= feedAnchorMs) return true;   // no rise modelled for this anchor
      return (mixMs2 - feedAnchorMs) / (peakMs2 - feedAnchorMs) >= 0.6;
    }

    function doughScore(mixHBF: number): 0 | 1 | 2 {
      if (mixHBF >= sweetToHBF && mixHBF <= sweetFromHBF) return 2;
      if (mixHBF >= sweetToHBF - 2 && mixHBF <= sweetFromHBF + 2) return 1;
      return 0;
    }

    function retardBonus(mixHBF: number): number {
      const hasColdRetardLocal = (sweetFromHBF - sweetToHBF) / 2 > minTotalRT;
      if (!hasColdRetardLocal) return 0;
      // Base reward: longer cold retard (mix further from bake) = more flavour.
      const longCold = Math.min(8, Math.round(
        Math.min(mixHBF - minTotalRT, sweetFromHBF - minTotalRT) /
        Math.max(1, sweetFromHBF - minTotalRT) * 8
      ));
      // Tang direction: tangy favours longer cold (toward sweetFrom),
      // mild favours shorter cold (toward sweetTo). Balanced = neutral (unchanged).
      if (tang === 'tangy') return longCold;      // reward long cold
      if (tang === 'mild')  return 8 - longCold;  // reward short cold
      return longCold;                             // balanced: byte-identical to pre-2b
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

    // Sourdough's live blocker source is localBlocks (the blocks prop lags by
    // a render because the parent updates async). Non-sourdough uses blocks.
    // blocksOverride (passed by applyAndUpdate) always wins when present.
    // NOTE: effectiveBlocks is declared at the TOP of the solver (TDZ fix).
    function inBlocker(mixHBF: number): boolean {
      return isTimeBlocked(bakeMs - mixHBF * 3600000, effectiveBlocks);
    }
    function inBlockerMs(timeMs: number): boolean {
      return isTimeBlocked(timeMs, effectiveBlocks);
    }
    // POLICY (Jul 2026): blockers bind the present too. Planning from inside
    // a blocked window (e.g. lunch break at the office) does not mean the
    // baker can act right now, so a refresh pinned to "now" during a blocker
    // is NOT executable — Option C (delayed refresh) and post-blocker
    // families take over instead. Only firmly PAST times are exempt (last
    // fed, completed feeds): history can't be validated against blockers.
    // The 1h cutoff mirrors the refresh event's isPast convention
    // (nowMs − 60min).
    const HISTORY_CUTOFF_MS = 60 * 60000;
    function isBlockedActionMs(timeMs: number): boolean {
      if (timeMs < Date.now() - HISTORY_CUTOFF_MS) return false; // history — exempt
      return inBlockerMs(timeMs);
    }
    // candidateValid READS the candidate's stored action-time list and rejects
    // any candidate whose actions touch a blocker. The list was populated by
    // pushCand → computeActionTimes at gen time using the SAME outer state the
    // event builder will read at render — so render == validation by
    // construction, no scored-vs-rendered divergence.
    function candidateActionTimes(cand: Candidate): number[] {
      return cand.actionTimesMs ?? [];
    }
    function candidateValid(cand: Candidate): boolean {
      for (const ms of candidateActionTimes(cand)) {
        // isBlockedActionMs (not inBlockerMs): firmly-past times are history
        // and exempt; present and future actions must clear blockers.
        if (ms != null && isBlockedActionMs(ms)) return false;
      }
      if (inBlocker(cand.mixHBF)) return false;
      return true;
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
      // Tang nudge: extra retardBonus weight when baker picked mild/tangy.
      // Capped so a full starter-score tier (100 pts) always dominates —
      // tang only breaks ties between candidates the starter is equally happy with.
      const tangW = tang === 'balanced' ? 0 : 12;
      // Mix-hour comfort ×2: the baker must be PRESENT to mix, so the mix hour
      // matters on every path — including Peak 1, where the old reasonableHour
      // constant (always 1 for sourdough) let a 3am Start Dough cost nothing.
      // Weight 2 (max ±16) breaks ties between biologically-equal candidates
      // without ever overriding a starter/dough score tier (100 pts each).
      const mixComfort = feedComfort(bakeMs - mixHBF * 3600000);
      // Declining-gap shaping: starterScore's TOL band is flat, so within the
      // same ss tier a mix 1.5h past peak scored identically to a mix AT peak
      // — comfort points then picked the past-peak plan (30°C live bug: the
      // refresh-now family beat the backward-timed refresh whose peak lands
      // exactly at mix). Penalise the declining side proportionally to the
      // FRACTION of a peak cycle elapsed past peak: ~13 pts at 1.3h past peak
      // in a 3h-cycle tropical kitchen, ~3 pts at 2h past peak in a 22h-cycle
      // cold kitchen — never enough to jump a 100-pt scoring tier, so it only
      // breaks ties between biologically-unequal but same-tier candidates.
      const pastPeakH = peakHBF - mixHBF; // HBF: >0 → mix after peak
      const decliningPenalty = pastPeakH > 0
        ? Math.min(30, (pastPeakH / Math.max(1, adjPeakH)) * 30)
        : 0;
      return (ss + ds) * 100
        + retardBonus(mixHBF) * (retardW + tangW)
        + mixComfort * 2
        + feedComfort(comfortMs) * 3
        - decliningPenalty;
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
      // Fridge scan: honest removal time (mix = fridgeOut + rtToPeakH, not mix − warmupH)
      fridgeOutMs?:         number;
      // Bridging refreshes ADDITIONAL to the primary @now refresh, used to
      // close the 6–24h dead zone between a single refresh peak and pre-mix.
      // Order: earliest first. The last entry is the "final" refresh whose
      // peak the pre-mix is timed against. nBridge=0 → undefined.
      bridgeRefreshMs?: number[];
      // SINGLE SOURCE OF TRUTH for blocker validation. Populated at gen time
      // (by computeActionTimes below) using the same outer-scope values the
      // event builder will use to render. candidateActionTimes(cand) reads
      // this field verbatim — no recomputation, so the validator and the
      // renderer can never diverge. Required-by-convention: every push site
      // sets it via the pushCand helper.
      actionTimesMs?: number[];
      // Canonical fridge_in / fridge_out for NON-Path-B fridge plans (set at
      // gen time by pushCand → computeNonPathBFridgeTimes using the SAME
      // formulas the event builder's Block 2 used to recompute at render).
      // computeActionTimes pushes these into actionTimesMs so candidateValid
      // checks them; the event builder reads the winning candidate's values
      // (mirrored into _renderFridgeInMs / _renderFridgeOutMs) and renders
      // fridge_in / fridge_out at exactly those timestamps. Render ==
      // validation by construction for non-Path-B too, not just Path B.
      // Null when the plan does not involve a fridge transition.
      renderFridgeInMs?:  number;
      renderFridgeOutMs?: number;
    }

    // CANONICAL fridge-hold action-time source. For a Path B (fridge-hold)
    // candidate, returns the four baker-action timestamps EXCLUSIVELY from the
    // candidate's stored fields — never recomputed from latestRefreshPeak,
    // _newFridgeOut, or any other derived value. This is the single source the
    // validator (computeActionTimes), the event builder (Block 1), the result
    // mirrors (fridgeHoldInTime / fridgeHoldOutTime), and any ratio-search
    // sub-evaluator MUST read from when reasoning about a fridge-hold plan, so
    // every consumer agrees byte-for-byte on what time each action lands at.
    // Returns null for non-Path-B candidates (those use the non-fridge-hold
    // paths in computeActionTimes below).
    function fridgeHoldActionTimes(
      c: Pick<Candidate, 'isFridgeHoldPath' | 'fridgeHoldRefreshMs' | 'fridgeHoldInMs' | 'fridgeHoldOutMs' | 'feed2Ms'>,
    ): { refreshMs: number; fridgeInMs: number; fridgeOutMs: number; preMixMs: number } | null {
      if (!c.isFridgeHoldPath) return null;
      if (c.fridgeHoldRefreshMs == null || c.fridgeHoldInMs == null
          || c.fridgeHoldOutMs == null || c.feed2Ms == null) return null;
      return {
        refreshMs:   c.fridgeHoldRefreshMs,
        fridgeInMs:  c.fridgeHoldInMs,
        fridgeOutMs: c.fridgeHoldOutMs,
        preMixMs:    c.feed2Ms,
      };
    }

    // Canonical fridge_in / fridge_out source for NON-Path-B fridge plans.
    // Returns the times the event builder's Block 2 would have synthesized at
    // render — but computed ONCE at candidate gen time, stored on the
    // candidate, and read identically by validator and renderer. Mirrors the
    // formulas used in the previous render-time recompute: fridge_out =
    // c.fridgeOutMs (fridge scan) OR newMix − warmupH; fridge_in = the latest
    // refresh peak among the primary refresh, any bridge refreshes, AND
    // intermediate refreshes (the renderer's reduce-max considered all three).
    // Returns null when the plan does not involve a fridge transition.
    function computeNonPathBFridgeTimes(
      c: Pick<Candidate, 'mixHBF' | 'fridgeOutMs' | 'feed2Ms' | 'bridgeRefreshMs' | 'isFridgeHoldPath' | 'usingPeak2'>,
      adjPeakH_for:  number,
      ratioMult_for: number,
    ): { fridgeInMs: number; fridgeOutMs: number } | null {
      if (c.isFridgeHoldPath) return null;
      if (starterLocation !== 'fridge') return null;
      const candMixMs = bakeMs - c.mixHBF * 3600000;
      const refreshPeaks: number[] = [];
      if (_starterRefeedTime && !c.usingPeak2) {
        refreshPeaks.push(_starterRefeedTime.getTime() + adjPeakH_for * _refreshStretchFactor * 3600000);
      }
      if (c.bridgeRefreshMs) {
        for (const b of c.bridgeRefreshMs) refreshPeaks.push(b + adjPeakH_for * 3600000);
      } else {
        // Include intermediate refresh peaks too — the renderer's Block 2
        // reduces over BOTH refresh and intermediate_refresh events, so the
        // validator must consider them or false-green when an intermediate
        // peak lands later than the primary peak and lands in a blocker.
        const intermediates = computeIntermediatesForCandidate(c as Candidate, adjPeakH_for, ratioMult_for);
        for (const t of intermediates) refreshPeaks.push(t + adjPeakH_for * 3600000);
      }
      const fridgeInMs = refreshPeaks.length > 0
        ? Math.max(...refreshPeaks)
        : (lastFedTime?.getTime() ?? candMixMs);
      // The starter must be OUT (and warmed) before its next warm-side action.
      // With a future pre-mix feed that action is the FEED, not the mix —
      // anchoring removal on mix placed fridge_out AFTER the pre-mix feed on
      // the card (chronologically incoherent: feed at 8am, "remove" at 9:18am).
      const _nextWarmMs = (c.feed2Ms != null && c.feed2Ms > fridgeInMs)
        ? Math.min(c.feed2Ms, candMixMs)
        : candMixMs;
      const fridgeOutMs = c.fridgeOutMs
        ?? (_nextWarmMs - getStarterFridgeWarmupH(kitchenTemp) * 3600000);
      // Degenerate-hold guard: a fridge park is only real if the starter sits
      // cold for a meaningful stretch. When the refresh peak lands close to
      // mix (peak≈mix), fridgeOut−fridgeIn collapses to minutes and the card
      // showed a nonsensical 15-min excursion with a double-peak (peak, cold
      // for 15 min, "peak" again). Below MIN_FRIDGE_HOLD_H the starter simply
      // peaks near mix and is used straight — no fridge transition.
      const MIN_FRIDGE_HOLD_H = 3;
      if (fridgeOutMs - fridgeInMs < MIN_FRIDGE_HOLD_H * 3600000) return null;
      return { fridgeInMs, fridgeOutMs };
    }

    // Compute the full baker-action-time list for a candidate at gen time —
    // the values come from the SAME outer-scope state (_starterRefeedTime,
    // _refreshStretchFactor, starterLocation, kitchenTemp, …) that the event
    // builder will later read, so validation and render are guaranteed to see
    // identical timestamps. No recomputation happens at validation time.
    function computeActionTimes(
      c: Omit<Candidate, 'actionTimesMs'>,
      adjPeakH_for: number,
      ratioMult_for: number,
    ): number[] {
      const candMixMs = bakeMs - c.mixHBF * 3600000;
      const out: number[] = [candMixMs];
      // For a Path B (fridge-hold) candidate, draw EXCLUSIVELY from
      // fridgeHoldActionTimes — the canonical single source. The candidate's
      // feedMs is the pre-mix feed which already maps to preMixMs, so no extra
      // feed* push needed; bridge refreshes are not applicable to Path B.
      const fh = fridgeHoldActionTimes(c);
      if (fh) {
        out.push(fh.refreshMs, fh.fridgeInMs, fh.fridgeOutMs, fh.preMixMs);
        return out;
      }
      if (c.feedMs != null) out.push(c.feedMs);
      if (c.feed2Ms != null && c.feed2Ms !== c.feedMs) out.push(c.feed2Ms);
      // Path B refresh + fridge in/out — already stored on the candidate.
      if (c.fridgeHoldRefreshMs != null) out.push(c.fridgeHoldRefreshMs);
      if (c.fridgeHoldInMs != null)      out.push(c.fridgeHoldInMs);
      if (c.fridgeHoldOutMs != null)     out.push(c.fridgeHoldOutMs);
      // Bridge refreshes — already stored on the candidate.
      if (c.bridgeRefreshMs) out.push(...c.bridgeRefreshMs);
      // Non-Path-B paths emit a primary refresh at _starterRefeedTime (Path B
      // uses its own fridgeHoldRefreshMs which is already the same value).
      if (!c.isFridgeHoldPath && _starterRefeedTime && !c.usingPeak2) {
        out.push(_starterRefeedTime.getTime());
      }
      // Intermediate refreshes — only the post-hoc computation path; bridge
      // candidates already carry their refresh chain in bridgeRefreshMs.
      if (!c.isFridgeHoldPath && !c.bridgeRefreshMs) {
        const intermediates = computeIntermediatesForCandidate(c as Candidate, adjPeakH_for, ratioMult_for);
        for (const t of intermediates) out.push(t);
      }
      // Non-Path-B fridge starter fridge_in / fridge_out: READ from the
      // candidate's stored values — populated at gen time by pushCand via
      // computeNonPathBFridgeTimes, the SAME function that drives the event
      // builder's render. Render == validation by construction; the render-
      // time recompute that previously synthesized these from
      // latestRefreshPeak and newMix − warmupH (and silently diverged from
      // what the validator was checking) is gone.
      if (c.renderFridgeInMs  != null) out.push(c.renderFridgeInMs);
      if (c.renderFridgeOutMs != null) out.push(c.renderFridgeOutMs);
      return out;
    }

    // Planned FUTURE feeds for a candidate (history excluded, 1h grace like
    // isBlockedActionMs). Used for the universal feed-count cost: at equal
    // quality, fewer feeds win — for every family, not just Path B. 10 pts
    // per extra feed can never jump a 100-pt quality tier, so multi-feed
    // plans still win whenever a single feed genuinely can't reach green.
    function plannedFutureFeedCount(
      c: Omit<Candidate, 'actionTimesMs'>,
      adjPeakH_for: number,
      ratioMult_for: number,
    ): number {
      const nowRef = Date.now() - 60 * 60000;
      const feeds = new Set<number>();
      const fh = fridgeHoldActionTimes(c);
      if (fh) {
        if (fh.refreshMs > nowRef) feeds.add(fh.refreshMs);
        if (fh.preMixMs > nowRef) feeds.add(fh.preMixMs);
        return feeds.size;
      }
      if (c.feedMs != null && c.feedMs > nowRef) feeds.add(c.feedMs);
      if (c.feed2Ms != null && c.feed2Ms > nowRef) feeds.add(c.feed2Ms);
      if (c.bridgeRefreshMs) for (const b of c.bridgeRefreshMs) { if (b > nowRef) feeds.add(b); }
      if (!c.isFridgeHoldPath && _starterRefeedTime && !c.usingPeak2
          && _starterRefeedTime.getTime() > nowRef) feeds.add(_starterRefeedTime.getTime());
      if (!c.isFridgeHoldPath && !c.bridgeRefreshMs) {
        for (const t of computeIntermediatesForCandidate(c as Candidate, adjPeakH_for, ratioMult_for)) {
          if (t > nowRef) feeds.add(t);
        }
      }
      return feeds.size;
    }
    const FEED_COUNT_COST = 10;

    const candidates: Candidate[] = [];
    // pushCand wraps candidate creation so actionTimesMs is ALWAYS populated.
    // Bypassing this would reintroduce the validator-vs-render divergence.
    // For non-Path-B fridge plans, also populates renderFridgeInMs /
    // renderFridgeOutMs so the event builder reads identical stored values
    // (one canonical source for both validation and render). Candidates
    // whose stored fridge_in is not strictly before fridge_out are rejected
    // at gen time — the same coherence guard the Path B generator already
    // enforces, applied to non-Path-B too.
    function pushCand(c: Omit<Candidate, 'actionTimesMs'>): void {
      // Preview candidates must be scored and checked at the baker's pinned
      // mix, not at a nearby ideal peak that will later be overwritten.
      if(targetMixTime){
        const mixHBF=(bakeMs-+targetMixTime)/3600000;
        const sscore=starterScore(mixHBF,c.peakHBF);
        if(sscore!==2||!riseCompleteEnough(mixHBF,c.peakHBF,c.feed2Ms??c.feedMs))return;
        const comfort=!!(c.isFutureFeedPath||c.isFridgeHoldPath);
        c={...c,mixHBF,sscore,score:c.score-combinedScore(c.mixHBF,c.peakHBF,c.feedMs,comfort)+combinedScore(mixHBF,c.peakHBF,c.feedMs,comfort)};
      }

      // Baker-pinned pre-mix: only candidates whose future feed sits on the
      // pin survive (22.5 min = 1.5 grid steps). Peak-2 candidates are
      // governed by manualRefreshRef, not this pin.
      if (manualFeed2Ref.current != null) {
        if (c.usingPeak2 || c.feed2Ms == null || Math.abs(c.feed2Ms - manualFeed2Ref.current) > 22.5 * 60000) return;
      }
      const fridgeTimes = computeNonPathBFridgeTimes(c, adjPeakH, ratioMultiplier);
      if (fridgeTimes && !(fridgeTimes.fridgeInMs < fridgeTimes.fridgeOutMs)) return;
      const enriched: Omit<Candidate, 'actionTimesMs'> = {
        ...c,
        renderFridgeInMs:  fridgeTimes?.fridgeInMs,
        renderFridgeOutMs: fridgeTimes?.fridgeOutMs,
      };
      const _extraFeeds = Math.max(0, plannedFutureFeedCount(enriched, adjPeakH, ratioMultiplier) - 1);
      candidates.push({
        ...enriched,
        score: enriched.score - _extraFeeds * FEED_COUNT_COST,
        actionTimesMs: computeActionTimes(enriched, adjPeakH, ratioMultiplier),
      });
    }

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
        // Peak1's rise anchor: the refeed when in revival/declining (the peak
        // is refeed-based there), else the last feed.
        if (!riseCompleteEnough(mixHBF, peak1HBF, _starterRefeedTime?.getTime() ?? feed1Ms)) continue;
        pushCand({
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
      // Unified peak: the trough feed renders as a pre_mix bell, so score its
      // peak with the SAME helper + reference the bell uses (scoring ≡ bell).
      // A trough is past the natural peak → stretch resolves to 1.0, so this is
      // behaviour-identical to the old `troughMs + adjPeakH` for healthy troughs.
      const peak2AHBF = (bakeMs - computeStarterPeakMs(troughMs, _refPeakForPreMix, adjPeakH)) / 3600000;

      if (troughMs >= nowMs) {
        for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
          if (bakeMs - mixHBF * 3600000 <= nowMs) continue;
          if (inBlocker(mixHBF)) continue;
          if (inBlockerMs(troughMs)) continue;
          const ss = starterScore(mixHBF, peak2AHBF);
          if (ss === 0) continue;
          if (!riseCompleteEnough(mixHBF, peak2AHBF, troughMs)) continue;
          pushCand({
            mixHBF, peakHBF: peak2AHBF, feedMs: troughMs,
            usingPeak2: true, feed2Ms: troughMs,
            score: combinedScore(mixHBF, peak2AHBF, troughMs, true), sscore: ss,
          });
        }
      }

      // Option B: refeed now (declining state — _starterRefeedTime set from derived)
      if (_starterRefeedTime && !isBlockedActionMs(_starterRefeedTime.getTime())) {
        const refeedMs  = _starterRefeedTime.getTime();
        // Unified peak: the refeed renders as a pre_mix bell. Score against the
        // SAME helper + reference the bell uses so scoring ≡ bell (was
        // `_adjPeakH_refresh`, i.e. refreshStretch, which the bell never applied
        // here → the dominant false-green source; see FINDINGS.md).
        const peak2BHBF = (bakeMs - computeStarterPeakMs(refeedMs, _refPeakForPreMix, adjPeakH)) / 3600000;

        for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
          if (bakeMs - mixHBF * 3600000 <= nowMs) continue;
          if (inBlocker(mixHBF)) continue;
          const ss = starterScore(mixHBF, peak2BHBF);
          if (ss === 0) continue;
          if (!riseCompleteEnough(mixHBF, peak2BHBF, refeedMs)) continue;
          pushCand({
            mixHBF, peakHBF: peak2BHBF, feedMs: refeedMs,
            usingPeak2: true, feed2Ms: refeedMs,
            score: combinedScore(mixHBF, peak2BHBF, refeedMs, true) + 6, sscore: ss,
          });
        }
      }

      // Option C: DELAYED single refresh (declining/depleted/revival state).
      // Option B pins the revival refresh to "now", which lets the starter
      // peak hours BEFORE a humane mix slot (30°C live bug: refresh 12:15am →
      // peak ~3:45am → Start Dough 6am = mix 2¼h past peak). The correct plan
      // when nothing blocks it is to time the ONE refresh BACKWARD from the
      // mix so peak ≈ mix. For each mix slot on the scan grid, invert the
      // unified peak model (computeStarterPeakMs — the SAME helper + reference
      // the pre_mix bell and card note use, so scoring ≡ bell ≡ card by
      // construction) to find the refresh time whose peak lands at the mix.
      // Only pushed when that instant is genuinely in the future and
      // unblocked — otherwise Option B (refresh now) remains the fallback.
      // Skipped entirely when the baker pinned the refresh by dragging —
      // the pin IS the refresh time; Option B/Peak-2B honor it.
      if (_starterRefeedTime && manualRefreshRef.current == null) {
        const GRID_MS = 15 * 60000;
        for (let mixHBF = scanFrom; mixHBF >= scanTo; mixHBF -= STEP) {
          const mixMs = bakeMs - mixHBF * 3600000;
          if (mixMs <= nowMs) continue;
          if (inBlocker(mixHBF)) continue;
          // Invert peak(tR) = mixMs. computeStarterPeakMs is piecewise-linear
          // and monotone in tR, so a couple of fixed-point steps converge.
          let tR = mixMs - adjPeakH * 3600000;
          for (let it = 0; it < 4; it++) {
            tR += mixMs - computeStarterPeakMs(tR, _refPeakForPreMix, adjPeakH);
          }
          tR = Math.round(tR / GRID_MS) * GRID_MS;
          // Strictly-future refresh only (refresh-at-now is Option B's job),
          // and it must clear blockers like any other future action.
          const _minTrMs = starterLocation === 'fridge'
            ? nowMs + getStarterFridgeWarmupH(kitchenTemp) * 3600000
            : nowMs + 15 * 60000;
          if (tR <= _minTrMs) continue;
          if (inBlockerMs(tR)) continue;
          const peakCMs  = computeStarterPeakMs(tR, _refPeakForPreMix, adjPeakH);
          const peakCHBF = (bakeMs - peakCMs) / 3600000;
          const ss = starterScore(mixHBF, peakCHBF);
          if (ss === 0) continue;
          if (!riseCompleteEnough(mixHBF, peakCHBF, tR)) continue;
          pushCand({
            mixHBF, peakHBF: peakCHBF, feedMs: tR,
            usingPeak2: true, feed2Ms: tR,
            score: combinedScore(mixHBF, peakCHBF, tR, true) + 6, sscore: ss,
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
        pushCand({
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
    // Iterate candidate fridge-removal times in 15min steps.
    // Uses honest rtToPeakH = max(warmupH, (fpH − dwellH) / coldFactor) so the
    // scan accounts for short-dwell starters that need extra RT time after removal.
    //
    // Revival guard: this scan models "take out of fridge, warm up, peak
    // shortly after" — valid only for a RECENTLY-fed fridge starter that
    // accumulated most of its rise while cold. A starter fed days ago is
    // dormant: it needs a real refresh cycle (peaks ~adjPeakH after feeding),
    // NOT a quick warm-up. Using the warm-up model there produced an
    // optimistic peak ≈ mix (false green) that disagreed with the refresh
    // bell the card actually renders. Refresh-based candidates handle revival.
    const _needsRevivalScan = revivalCycles(lastFedAge, starterMature, tang) >= 1;
    if (starterLocation === 'fridge' && !_needsRevivalScan) {
      const _warmupH = getStarterFridgeWarmupH(kitchenTemp);
      const _cf = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10);
      // Cold-rise peak from the LAST feed's ratio (no future feed on this path),
      // matching the cold bell (adjPeakH_last_eff) so scoring ≡ bell ≡ card.
      const _fpH = adjPeakH_last * _cf;
      const lastFedMs = lastFedTime?.getTime() ?? Date.now() - 24 * 3600000;
      const nowMsLocal = Date.now();
      const mixHBFMin = Math.max(minTotalRT + 0.5, sweetToHBF - 2);
      const mixHBFMax = sweetFromHBF + 2;
      // Widen lower bound to handle short-dwell cases where rtToPeakH > warmupH
      const fridgeOutMinMs = Math.max(
        nowMsLocal + 15 * 60000,
        bakeMs - (mixHBFMax + adjPeakH) * 3600000
      );
      const fridgeOutMaxMs = bakeMs - (mixHBFMin + _warmupH) * 3600000;
      for (let foMs = fridgeOutMinMs; foMs <= fridgeOutMaxMs; foMs += 15 * 60000) {
        const dwellH = (foMs - lastFedMs) / 3600000;
        // peakUnflooredH: when biology truly peaks after removal (can be < warmupH
        // when starter already accumulated most of its rise while in fridge).
        // rtToPeakH: earliest safe mix (physically floored by warmup time).
        // When floor binds: mix is PAST peak by (warmupH − peakUnflooredH).
        const peakUnflooredH = (_fpH - dwellH) / _cf;
        const rtToPeakH = Math.max(_warmupH, peakUnflooredH);
        const mixMs = foMs + rtToPeakH * 3600000;
        const mixHBF = (bakeMs - mixMs) / 3600000;
        if (mixHBF < mixHBFMin - 0.5 || mixHBF > mixHBFMax + 0.5) continue;
        if (inBlocker(mixHBF)) continue;
        if (inBlockerMs(foMs)) continue;
        const ds = doughScore(mixHBF);
        if (ds === 0) continue;
        // Scoring peak = the SAME value fridgePeakAfterRemoval renders for the
        // cold bell and the card (removal + max(warmup, unflooredRise)), so
        // scoring ≡ bell ≡ card exactly. (Was floored at 0.25h, which reported
        // the biological peak a little before the warmup-limited mix and left a
        // sub-warmup gap between the pill and the graph.)
        const peakMs = foMs + rtToPeakH * 3600000;
        const peakHBF_honest = (bakeMs - peakMs) / 3600000;
        const ss = starterScore(mixHBF, peakHBF_honest);
        if (ss === 0 && ds < 2) continue;
        pushCand({
          mixHBF, peakHBF: peakHBF_honest, feedMs: lastFedMs,
          usingPeak2: false, feed2Ms: null,
          score: combinedScore(mixHBF, peakHBF_honest, lastFedMs) + (ss === 2 ? 10 : ss === 1 ? 5 : 0),
          sscore: ss,
          isFridgePath: true,
          fridgeOutMs: foMs,
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
      const searchStart2 = manualFeed2Ref.current!=null ? new Date(manualFeed2Ref.current) : targetMixTime
        ? new Date(baseFeed2.getTime() - 15 * 60000)
        : new Date(baseFeed2.getTime() - 36 * 3600000);
      const searchEnd2 = manualFeed2Ref.current!=null ? new Date(manualFeed2Ref.current) : targetMixTime
        ? new Date(baseFeed2.getTime() + 15 * 60000)
        : new Date(baseFeed2.getTime() + 2 * 3600000);

      // refreshPeakMsForStretch: reference peak used ONLY by the biological
      // eligibility gate below (unchanged, preserves which candidates exist).
      const refreshPeakMsForStretch = _starterRefeedTime
        ? _starterRefeedTime.getTime() + _adjPeakH_refresh * 3600000
        : null;

      for (let t2 = searchStart2.getTime(); t2 <= searchEnd2.getTime(); t2 += 15 * 60000) {
        if (t2 <= nowMs2) continue;
        // Unified peak: score against the SAME helper + reference the pre_mix
        // bell uses (_refPeakForPreMix, bare adjPeakH) so scoring ≡ bell. Was
        // stretched against refreshPeakMsForStretch (_adjPeakH_refresh) → the
        // reference disagreed with the bell → future_feed drift (FINDINGS.md).
        const peakT2 = new Date(computeStarterPeakMs(t2, _refPeakForPreMix, adjPeakH));
        const mHBF2  = (bakeMs - peakT2.getTime()) / 3600000;
        if (mHBF2 < sweetToHBF - 4 || mHBF2 > sweetFromHBF + 4) continue;
        if (inBlockerMs(t2)) continue;
        // Same biological gap rule for plain future-feed (when refresh exists)
        if (refreshPeakMsForStretch != null) {
          const _gapPreCheck2 = (t2 - refreshPeakMsForStretch) / 3600000;
          const _maxEarly2 = adjPeakH * 0.5;
          if (_gapPreCheck2 < -_maxEarly2 || _gapPreCheck2 > 6) continue;
        }
        // Near-peak mix offsets: mixing exactly at the pre-mix peak is ideal,
        // but when that slot is blocked or already past, a mix slightly
        // off-peak within starterScore tolerance is still a good, EXECUTABLE
        // plan (e.g. feed after the night blocker ends, mix just before work
        // starts). Offsets are explored only when the peak slot is unusable so
        // the pool stays lean; −2/h keeps true at-peak plans preferred.
        const _peakSlotBad2 = inBlocker(mHBF2) || bakeMs - mHBF2 * 3600000 <= nowMs2;
        const _mixOffsets2 = _peakSlotBad2 ? [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3] : [0];
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
        for (const _offH2 of _mixOffsets2) {
          const _mixMsC2  = peakT2.getTime() + _offH2 * 3600000;
          const _mixHBFC2 = (bakeMs - _mixMsC2) / 3600000;
          if (_mixMsC2 <= nowMs2) continue;
          if (inBlocker(_mixHBFC2)) continue;
          const ss2 = starterScore(_mixHBFC2, mHBF2);
          if (ss2 === 0) continue;
          if (!riseCompleteEnough(_mixHBFC2, mHBF2, t2)) continue;
          const sc2 = combinedScore(_mixHBFC2, mHBF2, t2, true);
          pushCand({
            mixHBF: _mixHBFC2, peakHBF: mHBF2, feedMs: t2,
            usingPeak2: false, feed2Ms: t2,
            score: sc2 + _depletionPenalty + _subPeakPenalty - Math.abs(_offH2) * 2, sscore: ss2,
            isFutureFeedPath: true,
          });
        }
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
    // Fridge-revival extension: a fridge starter in revival territory
    // (refeed-now set, ≥1 revival cycle) IS an RT process from the moment it
    // comes out for its refresh — the same two-feed chain (refresh @now →
    // bridge/pre-mix → mix) is its correct biology. Without this, a
    // fridge starter with a tight blocker layout had NO family able to place
    // a second feed tomorrow morning (peak1/2B anchor everything at now;
    // Path B needs a ≥6h fridge hold that rarely fits a <24h horizon), so the
    // engine fell into nonsense or fallback plans (31°C live bug).
    const _fridgeRevivalBridgeEligible =
      starterLocation === 'fridge' && _starterRefeedTime !== null;
    if (
      planningMode === 'last_fed' && lastFedTime &&
      (starterLocation === 'rt' || _fridgeRevivalBridgeEligible) &&
      (Date.now() - lastFedTime.getTime()) / 3600000 > adjPeakH
    ) {
      const nowMs3 = Date.now();
      // Refresh spacing: peak-shoulder timing (adjPeakH × 1.25) with a 6h
      // ABSOLUTE FLOOR. Without the floor, tropical kitchens (30°C → adjPeakH
      // ≈ 4h) generate bridges 5h apart — biologically too dense (a starter
      // never needs feeding <6h after a feed). The floor honours convenience
      // (no <6h spacing) without breaking biology (a 4h-peak starter is past
      // peak by 6h, which is still a sensible refresh point).
      const refreshSpacingH_bridge = Math.max(6, adjPeakH * 1.25);

      // nBridge = number of EXTRA refreshes inserted between the primary
      // refresh @now and the pre-mix feed. nBridge=0 keeps the original
      // single-refresh behaviour (no regression). nBridge≥1 closes the
      // 6–24h dead zone between a single refresh peak and the pre-mix.
      // Cap at 2 → total feeds incl. pre-mix ≤ 3 (matches MAX_INTERMEDIATES).
      for (let nBridge = 0; nBridge <= 2; nBridge++) {
        const refreshMs = nowMs3;
        if (isBlockedActionMs(refreshMs)) break;  // primary @now blocked → no chain possible

        const finalRefreshMs     = nowMs3 + nBridge * refreshSpacingH_bridge * 3600000;
        const finalRefreshPeakMs = finalRefreshMs + _adjPeakH_refresh * 3600000;

        // Bridge refresh times — additional to the primary @now. The LAST
        // entry is the "final" refresh whose peak the pre-mix is timed
        // against. Empty when nBridge=0.
        const bridges: number[] = [];
        for (let i = 1; i <= nBridge; i++) {
          bridges.push(nowMs3 + i * refreshSpacingH_bridge * 3600000);
        }

        // Reject the whole chain early if any bridge falls in a blocker.
        let bridgesOk = true;
        for (const br of bridges) {
          if (inBlockerMs(br)) { bridgesOk = false; break; }
        }
        if (!bridgesOk) continue;

        const earliestPreMixMs = finalRefreshPeakMs - 12 * 3600000;
        const baseFeed3 = targetMixTime
          ? new Date(targetMixTime.getTime() - adjPeakH * 3600000)
          : null;
        const searchStart3 = baseFeed3
          ? new Date(baseFeed3.getTime() - 15 * 60000)
          : new Date(finalRefreshPeakMs - 12 * 3600000);
        const searchEnd3 = baseFeed3
          ? new Date(baseFeed3.getTime() + 15 * 60000)
          : new Date(finalRefreshPeakMs + 12 * 3600000);

        // Minimum gap between consecutive feeds. adjPeakH × 0.75 gives ~13h at
        // 17.8h adjPeak; max(6, …) clamps so tropical kitchens (~4h adjPeak)
        // still respect the convenience floor. A feed should NEVER follow the
        // prior one in less time than this — that would mean feeding before
        // the earlier cycle had a chance to wake the starter.
        const minFeedGapH = Math.max(6, adjPeakH * 0.75);
        for (let t3 = Math.max(searchStart3.getTime(), earliestPreMixMs); t3 <= searchEnd3.getTime(); t3 += 15 * 60000) {
          if (t3 <= nowMs3) continue;
          // Pre-mix must follow the FINAL refresh by ≥ minFeedGapH. If this
          // can't be satisfied for current nBridge, the inner loop emits no
          // candidates and the outer loop's smaller nBridge will (the
          // 2-feed plan spaces correctly at ~24h).
          if (t3 - finalRefreshMs < minFeedGapH * 3600000) continue;
          // Unified peak: score the pre-mix against the SAME helper + reference
          // the bell uses (_refPeakForPreMix) so scoring ≡ bell. finalRefreshPeakMs
          // still drives the biological eligibility gate below (unchanged).
          const peakT3 = new Date(computeStarterPeakMs(t3, _refPeakForPreMix, adjPeakH));
          const mHBF3  = (bakeMs - peakT3.getTime()) / 3600000;
          if (mHBF3 < sweetToHBF - 4 || mHBF3 > sweetFromHBF + 4) continue;
          if (inBlockerMs(t3)) continue;
          // Biological gap window — anchored to the FINAL refresh's peak.
          // Pre-mix between adjPeakH × 0.5 before final-peak and 6h after.
          const _gapPreCheck3 = (t3 - finalRefreshPeakMs) / 3600000;
          const _maxEarly = adjPeakH * 0.5;
          if (_gapPreCheck3 < -_maxEarly || _gapPreCheck3 > 6) continue;
          // Near-peak mix offsets — same rationale as the t2 scan above: when
          // the exact pre-mix peak lands in a blocker (or the past), a mix
          // slightly off-peak is still executable and honest. This is the
          // family that expresses "refresh tonight, second feed after the
          // night blocker, mix just before work" for tight tropical windows.
          const _peakSlotBad3 = inBlocker(mHBF3) || bakeMs - mHBF3 * 3600000 <= nowMs3;
          const _mixOffsets3 = _peakSlotBad3 ? [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3] : [0];
          const gapFromRefreshPeakH = (t3 - finalRefreshPeakMs) / 3600000;
          const biologyPenalty = (() => {
            if (gapFromRefreshPeakH >= 0 && gapFromRefreshPeakH <= 3) return 0;
            if (gapFromRefreshPeakH > 3 && gapFromRefreshPeakH <= 6) return -(gapFromRefreshPeakH - 3) * 2;
            if (gapFromRefreshPeakH > 6 && gapFromRefreshPeakH <= 9) return -10 - (gapFromRefreshPeakH - 6) * 2;
            if (gapFromRefreshPeakH > 9) return -16 - Math.min(14, (gapFromRefreshPeakH - 9) * 3);
            if (gapFromRefreshPeakH < 0 && gapFromRefreshPeakH >= -1) return -2;
            if (gapFromRefreshPeakH < -1 && gapFromRefreshPeakH >= -2) return -5;
            return -10 - Math.min(20, (Math.abs(gapFromRefreshPeakH) - 2) * 3);
          })();
          // Convenience cost: prefer fewer feeds. Raised from ×2 to ×8 so a
          // 3-feed RT chain (nBridge≥1) doesn't edge out a cleaner 2-feed
          // fridge-hold plan on marginal biology — stacking room-temp refreshes
          // is not how bakers work for multi-day builds.
          const bridgeCost = nBridge * 8;
          for (const _offH3 of _mixOffsets3) {
            const _mixMsC3  = peakT3.getTime() + _offH3 * 3600000;
            const _mixHBFC3 = (bakeMs - _mixMsC3) / 3600000;
            if (_mixMsC3 <= nowMs3) continue;
            if (inBlocker(_mixHBFC3)) continue;
            const ss3 = starterScore(_mixHBFC3, mHBF3);
            if (ss3 === 0) continue;
            if (!riseCompleteEnough(_mixHBFC3, mHBF3, t3)) continue;
            const sc3 = combinedScore(_mixHBFC3, mHBF3, t3, true);
            pushCand({
              mixHBF: _mixHBFC3, peakHBF: mHBF3, feedMs: t3,
              usingPeak2: false, feed2Ms: t3,
              score: sc3 + 12 + biologyPenalty - bridgeCost - Math.abs(_offH3) * 2, sscore: ss3,
              isFutureFeedPath: true,
              bridgeRefreshMs: bridges.length > 0 ? [...bridges] : undefined,
            });
          }
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
    // Hot-kitchen relaxation: at kitchenTemp >= 28 with a multi-hour bake
    // horizon, allow Path B even when the starter is just-fed (rising at
    // RT) — _starterRefeedTime is null in that state, so the previous gate
    // never generated a fridge-hold candidate and the engine returned an
    // RT pre-mix that biologically over-ferments. Fall back to the
    // existing feed (lastFedTime) as the refresh anchor: refresh-peak
    // becomes lastFedTime + adjPeakH (the starter's natural RT peak), and
    // the chill-at-peak plan unrolls from there. Temperate kitchens
    // (<28°C) keep the original gate and the RT plan.
    const _pathBHotEligible =
      !_starterRefeedTime
      && kitchenTemp >= 28
      && lastFedTime
      && (bakeMs - Date.now()) / 3600000 >= 24;
    if (
      (_starterRefeedTime || _pathBHotEligible) &&
      planningMode === 'last_fed' && lastFedTime &&
      (starterLocation === 'rt' || starterLocation === 'fridge')
    ) {
      const warmupH_pathB = getStarterFridgeWarmupH(kitchenTemp);
      const nowMs_pathB = Date.now();
      const refreshMs_pathB = (_starterRefeedTime ?? lastFedTime).getTime();
      const refreshPeakMs = refreshMs_pathB + _adjPeakH_refresh * 3600000;
      const idealMixTime_pathB = targetMixTime ?? new Date(bakeMs - ((sweetFromHBF + sweetToHBF) / 2) * 3600000);
      const baseFeed_pathB = new Date(idealMixTime_pathB.getTime() - adjPeakH * 3600000);
      const searchStart_pathB = manualFeed2Ref.current!=null ? new Date(manualFeed2Ref.current) : targetMixTime
        ? new Date(baseFeed_pathB.getTime() - 15 * 60000)
        : new Date(baseFeed_pathB.getTime() - 24 * 3600000);
      // Widened upper bound (was +2h) so mid-range pre-mix feeds — which peak
      // at a later, in-zone mix — are reachable via Path B as well.
      const searchEnd_pathB = manualFeed2Ref.current!=null ? new Date(manualFeed2Ref.current) : targetMixTime
        ? new Date(baseFeed_pathB.getTime() + 15 * 60000)
        : new Date(baseFeed_pathB.getTime() + 14 * 3600000);
      const minHoldH = 6;
      const maxHoldH = 120; // 5 days
      // Adaptive gap: 10h at moderate temps (adjPeakH ≈ 14h), shrinks toward
      // the minHoldH floor at tropical temps (adjPeakH ≈ 4h → ~6h gap). A flat
      // 10h floor priced warm-RT starters out of Path B entirely (their
      // refresh peak comes 4h after refresh, leaving no room for a 10h+ hold
      // in a 1-day bake), forcing them into the crammed RT-refresh path which
      // can't reach green. Tying the gap to biology means hot RT starters get
      // a fridge route too.
      const minGapFromRefreshPeakH = Math.max(minHoldH, Math.min(10, adjPeakH * 1.5));

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
          // Scales with RT refreshes avoided, AND with kitchen temperature.
          // Biology (Sourdough Journey hot-climate guidance; expert
          // consensus): at ≥30°C a just-fed starter peaks in ~4h then sours
          // fast, so holding/refeeding at RT across a 1–2 day bake
          // over-ferments it — the correct move is to chill. hotBias gives
          // Path B a strong scoring edge at medium horizons (+2d), where the
          // RT pre-mix used to out-score it. Temperate kitchens (<28°C) are
          // unaffected (hotBias = 0); short same-day bakes still fall
          // through to RT because no usable hold window fits there.
          const gapFromNowToPreMixH = (t - nowMs_pathB) / 3600000;
          const rtRefreshesAvoided = Math.max(0, Math.floor(gapFromNowToPreMixH / troughH) - 1);
          // hotBias / multiDayBias exist to stop an RT starter over-fermenting
          // while it waits warm. A FRIDGE-located starter is already cold —
          // nothing to protect, and Path B's refresh is one more feed than the
          // baker needs when a single revival feed reaches green (30°C live
          // case: removing the work blocker jumped the plan from "one refresh
          // is enough" to refresh-now + fridge + pre-mix, two feeds for the
          // same mix time). Gate both biases on RT and charge the extra feed
          // so an equal-quality single-feed plan outranks Path B; Path B still
          // wins where single-feed genuinely can't (deep revival, blockers).
          const _pathBFridgeStarter = starterLocation === 'fridge';
          const hotBias =
            _pathBFridgeStarter ? 0
            : kitchenTemp >= 33 ? 14
            : kitchenTemp >= 30 ? 10
            : kitchenTemp >= 28 ? 6
            : 0;
          // Multi-day retard bias: for any 2-day+ bake, a fridge retard is the
          // industry-standard build (refresh → chill → pre-mix), simpler and
          // better than stacking 2-3 room-temp refreshes. Below 28°C hotBias is
          // 0, so without this a temperate 2-day plan picked a 3-feed RT bridge
          // chain over the cleaner 2-feed fridge hold. Applies regardless of
          // temperature; hot kitchens still get the extra hotBias on top.
          const bakeHorizonH_pathB = (bakeMs - nowMs_pathB) / 3600000;
          const multiDayBias = !_pathBFridgeStarter && bakeHorizonH_pathB >= 30 ? 12 : 0;
          // Superseded by the universal feed-count cost in pushCand — Path B's
          // two feeds are charged there like every other family (no double
          // charge here).
          const extraFeedCost = 0;
          const pathBBonus = 8 + rtRefreshesAvoided * 3 + hotBias + multiDayBias - extraFeedCost;

          // Coherence guard at the source: chronological ordering must hold —
          // refresh < fridge_in < fridge_out < pre-mix. Any malformed Path B
          // candidate is rejected here so the pool never carries a "fridge_out
          // before fridge_in" hybrid that renders incoherently downstream.
          if (
            !(refreshMs_pathB < fridgeInMs
              && fridgeInMs < fridgeOutMs
              && fridgeOutMs < t)
          ) continue;
          // Pure fridge-hold candidate — NO isFutureFeedPath flag. The earlier
          // dual-flag hybrid had two render blocks fire independently: the
          // future-feed block drew a plain bell on the curve while the
          // fridge-hold block bolted fridge_in/out onto the card — curve and
          // card disagreed. Pure fridge-hold → one render path, one source of
          // truth; pre-mix / feed reporting handled inside the isFridgeHoldPath
          // branch downstream.
          pushCand({
            mixHBF: mHBF, peakHBF: mHBF, feedMs: t,
            usingPeak2: false, feed2Ms: t,
            score: sc + pathBBonus, sscore: ss,
            isFridgeHoldPath: true,
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
      // Far-horizon fallback. The window is long enough (not too short) but no
      // candidate survived — this happens for bakes several days out where the
      // "refresh now" anchored candidates all fall outside their biological gap
      // windows and Path B exceeds its fridge-hold ceiling. Rather than a bare
      // yellow card with no plan, emit a simple build-feed plan: the baker keeps
      // the starter on its normal schedule, then does ONE build feed timed so it
      // peaks at an in-zone mix. Feed is snapped to waking hours and out of
      // blockers so it's executable.
      {
        const sweetCenterH = (localSweetFrom + localSweetTo) / 2;
        const idealMix = new Date(bakeMs - sweetCenterH * 3600000);
        let buildFeed = new Date(idealMix.getTime() - adjPeakH * 3600000);
        // Snap feed into 7am–10pm.
        const snapHumane = (d: Date) => {
          const h = d.getHours();
          if (h < 7) d.setHours(7, 0, 0, 0);
          else if (h > 22) { d.setHours(7, 0, 0, 0); d.setDate(d.getDate() + 1); }
          return d;
        };
        buildFeed = snapHumane(buildFeed);
        // Nudge out of blockers (bounded).
        let guard = 0;
        while (inBlockerMs(buildFeed.getTime()) && guard++ < 48) {
          buildFeed = snapHumane(new Date(buildFeed.getTime() + 60 * 60000));
        }
        const buildPeak = new Date(buildFeed.getTime() + adjPeakH * 3600000);
        const mix = new Date(buildPeak.getTime());
        _newPendingStart = mix.getTime() > Date.now() ? mix : idealMix;
        // Never commit a past, blocked, or biologically-void mix. This fallback
        // can also fire for NEAR bakes (tight blockers + the rise-completion
        // guard can empty the candidate pool), where idealMix may already be in
        // the past — committing it rendered a Start Dough before "now" (31°C
        // live bug). Advance to the first executable 15-min slot that is in the
        // future, outside blockers, and past ~60% of the refresh rise.
        {
          const _revivalReadyMs = _starterRefeedTime
            ? _starterRefeedTime.getTime() + adjPeakH * _refreshStretchFactor * 0.6 * 3600000
            : null;
          let _mfbMs = Math.max(
            _newPendingStart.getTime(),
            Date.now() + 15 * 60000,
            _revivalReadyMs ?? 0,
          );
          _mfbMs = Math.ceil(_mfbMs / (15 * 60000)) * (15 * 60000);
          let _g2 = 0;
          while (inBlockerMs(_mfbMs) && _g2++ < 96) _mfbMs += 15 * 60000;
          if (_mfbMs < bakeMs - 0.5 * 3600000) _newPendingStart = new Date(_mfbMs);
        }
        _feed2Time = buildFeed.getTime() > Date.now() ? buildFeed : null;
        _hasFutureFeedPath = _feed2Time !== null;
        // No scored candidate survived. Even when this build-feed fallback is
        // executable and lands in the sweet window, keep it yellow: it is a
        // constrained fallback, not a fully validated green path.
        _starterPillState = 'yellow';
        // "Bake is far out" is only an honest explanation when the bake IS far
        // out. When this fallback fires for a near bake, keep _farHorizonPlan
        // false so the card falls back to the revival/drift notes and flag the
        // window as constrained instead.
        if ((bakeMs - Date.now()) / 3600000 >= 30) {
          _farHorizonPlan = true;
        } else {
          _farHorizonPlan = false;
          _windowTooShort = true;
        }
        if (_feed2Time) setRefeedSuggestion(_feed2Time);
        notifyFromSolver(_newPendingStart, et, blocks);
      }
      buildAndSetResult();
      return;
    }

    candidates.sort((a, b) => b.score - a.score);
    // No feasible candidate (e.g. blockers eliminate every viable feed/mix
    // time for a tight window). Surface as windowTooShort instead of crashing
    // on an undefined best / Invalid Date downstream.
    if (candidates.length === 0) {
      _windowTooShort = true;
      // An empty candidate set has no validated executable plan. Never mark
      // this dead-end green, even if a future refactor reaches this guard.
      _starterPillState = 'yellow';
      setRefeedSuggestion(null);
      _feed2Time = null;
      buildAndSetResult();
      return;
    }
    // Intermediate-refresh times for a candidate — mirrors buildAndSetResult's
    // logic so the candidateValid check can reject candidates whose intermediate
    // refreshes land in blockers (previously only checked mix/feed/feed2/fridge).
    // Reuses the outer adjPeakH/ratioMultiplier (current solver ratio).
    function computeIntermediatesForCandidate(cand: Candidate, adjPeakH_for: number, ratioMult_for: number): number[] {
      // Bridge candidates carry their own refresh chain — use it as-is so the
      // candidateValid check and the post-hoc render share the same source.
      if (cand.bridgeRefreshMs && cand.bridgeRefreshMs.length > 0) {
        return cand.bridgeRefreshMs;
      }
      if (planningMode !== 'last_fed' || !lastFedTime) return [];
      const refreshSpacingH = peakH * ryeF * matF * ratioMult_for * 1.25;
      const candMixMs = bakeMs - cand.mixHBF * 3600000;
      const nextMajorFeedMs =
        starterLocation === 'fridge' && _fridgeFeedTime
          ? _fridgeFeedTime.getTime()
          : (cand.isFutureFeedPath || cand.usingPeak2) && cand.feed2Ms
            ? cand.feed2Ms
            : candMixMs - adjPeakH_for * 3600000;
      const startMs = _starterRefeedTime?.getTime() ?? lastFedTime.getTime();
      const gapH = (nextMajorFeedMs - startMs) / 3600000;
      const MAX_INT = 2;
      const MIN_INT = Math.max(0, revivalCycles(lastFedAge, starterMature, tang) - 1);
      const gapBased = Math.floor(gapH / refreshSpacingH);
      const numIntermediate = Math.min(MAX_INT + 1, Math.max(MIN_INT + 1, gapBased));
      // Minimum spacing between consecutive feeds — max(6, adjPeakH × 0.75)
      // so tropical kitchens never cram feeds at <6h. The check is applied at
      // BOTH the intermediate→nextMajor segment AND between successive
      // intermediates, so no two feeds in the chain end up too close.
      const minFeedGapH = Math.max(6, adjPeakH_for * 0.75);
      const out: number[] = [];
      let prevAcceptedMs = startMs;
      for (let i = 1; i < numIntermediate; i++) {
        const ft = new Date(startMs + i * refreshSpacingH * 3600000);
        const h = ft.getHours();
        if (h < 7) ft.setHours(7, 0, 0, 0);
        else if (h > 22) { ft.setHours(7, 0, 0, 0); ft.setDate(ft.getDate() + 1); }
        if (ft.getTime() <= Date.now()) continue;
        if (ft.getTime() >= nextMajorFeedMs - minFeedGapH * 3600000) continue;
        // Drop intermediates that would land <minFeedGapH after the previous
        // accepted feed (primary refresh or prior intermediate).
        if (ft.getTime() - prevAcceptedMs < minFeedGapH * 3600000) continue;
        out.push(ft.getTime());
        prevAcceptedMs = ft.getTime();
      }
      return out;
    }

    let best = candidates[0];
    let foundValid = false;
    for (const cand of candidates) {
      if (candidateValid(cand)) {
        best = cand;
        foundValid = true;
        break;
      }
    }
    // A pinned refresh that can't produce ANY executable plan must not
    // commit a fallback: the best-invalid candidate's other events (pre-mix,
    // fridge moves) come from a family that ignored the pin, so the card
    // renders chronological nonsense (live: pre-mix BEFORE the dragged
    // refresh + window-too-tight). Better a workable plan than an impossible
    // one — drop the pin and re-solve once, honestly.
    if (!foundValid && (manualRefreshRef.current != null || manualFeed2Ref.current != null)) {
      if(probe)return; // Keep an impossible request visible; never silently discard its pin.
      manualRefreshRef.current = null;
      manualFeed2Ref.current = null;
      manualMixRef.current = null;
      return findOptimalPositionSourdough(et, undefined, blocksOverride);
    }
    // If no candidate cleared all blockers, the highest-scoring fallback still
    // violates blocker rules. Surface this honestly via windowTooShort so the
    // baker can adjust bake time or blockers instead of seeing a misleading
    // green-pill plan with diamonds in red zones.
    if (!foundValid || best.score < 250) {
      // A full plan IS committed below — it just bends the ideal windows.
      // windowTooShort stays reserved for true dead-ends; flagging it here
      // rendered a complete Path-B plan alongside "Not enough time — try a
      // later bake time" with 2 days of lead (live repro 23 Jul).
      _planConstrained = true;
    }

    // If baker manually dragged, always use their chosen mix time.
    // Never snap back — it is the baker's decision.
    // Solver still found best starter protocol for this position.
    const newMix = manualMixOverride ?? new Date(bakeMs - best.mixHBF * 3600000);
    _newPendingStart = newMix;
    notifyFromSolver(newMix, et, blocks);

    // Use the candidate's HONEST fridge-out time (mix = fridgeOut + rtToPeakH),
    // not mix − warmupH. The old recompute moved fridgeOut later than the
    // candidate's actual removal time, pushing the committed peak past mix.
    // When the baker dragged (manualMixOverride), best.fridgeOutMs doesn't
    // correspond to the dragged position — fall back to mix − warmupH in that case.
    if (starterLocation === 'fridge') {
      const honestFridgeOut = (best.fridgeOutMs && !manualMixOverride)
        ? new Date(best.fridgeOutMs)
        : new Date(newMix.getTime() - warmupH * 3600000);
      _newFridgeOut = honestFridgeOut.getTime() < Date.now()
        ? new Date()
        : honestFridgeOut;
    }

    // If fridge path candidate won, apply the suggested fridge-out time
    if (best.isFridgePath && _suggestedFridgeOut && starterLocation === 'fridge') {
      _newFridgeOut = _suggestedFridgeOut;
    }

    _usingPeak2      = best.usingPeak2;
    _feed2Time       = best.feed2Ms ? new Date(best.feed2Ms) : null;
    _bridgeRefreshMs = best.bridgeRefreshMs ?? null;
    // Green requires BOTH: starter at peak at mix (sscore 2) AND the plan is
    // actually executable within the baker's availability (foundValid = every
    // action — mix, feed/refresh, pre-mix, intermediates, fridge in/out —
    // clears blockers). A starter-perfect plan with a feed in a blocked
    // window is NOT green; the baker can't run it.
    // Green also requires the mix to sit close to the peak on the DECLINING
    // side. starterScore's TOL (2.0h for fridge) is an absolute-hours band, so
    // at tropical temps (short rises, fast post-peak decline) a mix 2h past
    // peak still scored ss=2 and showed "Ready at mix" while the starter was
    // visibly deflating. Ceiling scales with biology: 40% of adjPeakH, floored
    // at 1h, capped by TOL — ~1.4h at 30°C, unchanged (= TOL) in cool/cold
    // kitchens where adjPeakH is long. Mix-before-peak is unaffected.
    const _mixPastPeakH_best = best.peakHBF - best.mixHBF; // HBF: >0 → mix after peak
    const _greenPastPeakCeilH = Math.min(TOL, Math.max(1.0, adjPeakH * 0.4));
    _starterPillState = (best.sscore === 2 && foundValid
      && _mixPastPeakH_best <= _greenPastPeakCeilH) ? 'green' : 'yellow';
    setRefeedSuggestion(null);

    // If a future-feed candidate won, override flags accordingly.
    if (best.isFutureFeedPath) {
      _hasFutureFeedPath = true;
      _usingPeak2 = false;
      if (_feed2Time) setRefeedSuggestion(_feed2Time);
    }

    // Mirror the non-Path-B fridge winner's stored fridge_in / fridge_out
    // (set at gen time by pushCand → computeNonPathBFridgeTimes) so the event
    // builder's Block 2 reads the SAME canonical timestamps candidateValid
    // checked. Only meaningful for non-Path-B fridge winners; Path B uses the
    // _fridgeHold* mirrors below.
    if (!best.isFridgeHoldPath) {
      if (best.renderFridgeInMs  != null) _renderFridgeInMs  = best.renderFridgeInMs;
      if (best.renderFridgeOutMs != null) _renderFridgeOutMs = best.renderFridgeOutMs;
      // Align _newFridgeOut (chart prop + non-event card paths) to the stored
      // value so the chart and the card never see a different fridge_out than
      // the validator did. Path B is handled by the block below.
      if (best.renderFridgeOutMs != null) {
        _newFridgeOut = new Date(best.renderFridgeOutMs);
      } else if (!best.isFridgePath && starterLocation === 'fridge') {
        // No render fridge transition (degenerate <3h hold suppressed in
        // computeNonPathBFridgeTimes): this plan has NO fridge excursion.
        // Clear the fridge-out that line ~4142 derived as newMix−warmup so the
        // chart marker, the peak computation, and the (now fridge-less) card
        // all agree — the starter just peaks near mix and is used straight.
        _newFridgeOut = null;
      }
    }

    if (best.isFridgeHoldPath) {
      _isFridgeHoldPath = true;
      _fridgeHoldRefreshTime = best.fridgeHoldRefreshMs ? new Date(best.fridgeHoldRefreshMs) : null;
      _fridgeHoldInTime = best.fridgeHoldInMs ? new Date(best.fridgeHoldInMs) : null;
      _fridgeHoldOutTime = best.fridgeHoldOutMs ? new Date(best.fridgeHoldOutMs) : null;
      // Path B's pre-mix is a future feed action — surface it the same way the
      // future-feed block did before. Without this, a pure fridge-hold winner
      // would silently lose the refeed suggestion. (Path B always sets
      // usingPeak2: false at the candidate level, no need to override.)
      if (_feed2Time) setRefeedSuggestion(_feed2Time);
      // Force _newFridgeOut to the Path B winner's stored fridge_out
      // (best.fridgeHoldOutMs) — the EXACT ms candidateValid checked via
      // computeActionTimes. This MUST run unconditionally for a Path B
      // winner, BEFORE any later code can read _newFridgeOut: it overrides
      // any earlier assignment (e.g. line ~3713's `newMix − warmupH`
      // fallback when starterLocation === 'fridge') so the chart's
      // starterFridgeOutTime prop and the card's fridge_out event are both
      // byte-identical to the validator's stored timestamp. Reading
      // best.fridgeHoldOutMs directly (not the _fridgeHoldOutTime mirror)
      // avoids any chance of a null mirror leaking the wrong value through.
      if (best.fridgeHoldOutMs) {
        _newFridgeOut = new Date(best.fridgeHoldOutMs);
      }
    }

    // Drift note for yellow positions
    if (best.sscore < 2 && doughScore(best.mixHBF) < 2) {
      _driftNote = isFr
        ? 'Timing légèrement décalé — la pâte sera quand même bonne.'
        : 'Timing slightly off — your dough will still be great.';
    } else if (best.sscore < 2) {
      // HBF: larger = earlier. mixHBF > peakHBF means mix BEFORE peak (still rising).
      const mixBeforePeak = best.mixHBF > best.peakHBF;
      _driftNote = mixBeforePeak
        ? (isFr
            ? 'Le levain sera encore en montée au pétrissage — presque au pic.'
            : 'Starter still rising at mix — nearly at peak.')
        : (isFr
            ? 'Le levain sera légèrement passé son pic — toujours bon.'
            : 'Starter slightly past peak at mix — still good.');
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

    // Path B's pre-mix is also a future feed action (the candidate just doesn't
    // carry isFutureFeedPath since that flag now means "future-feed render
    // path"). Include isFridgeHoldPath so the active-feed reporting picks up
    // the Path B pre-mix correctly.
    const _winnerHasFutureFeed = best.isFutureFeedPath || best.isFridgeHoldPath || best.usingPeak2;
    const activeFeed = _winnerHasFutureFeed && best.feed2Ms
      ? new Date(best.feed2Ms)
      : lastFedTime ?? new Date(best.feedMs);
    // A known peak is an observation, not evidence of when the last feed happened.
    onFeedTimeChange?.(planningMode === 'know_peak' ? null : activeFeed);
    if (_winnerHasFutureFeed && best.feed2Ms) {
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

    // ── Stage 2: ratio search ────────────────────────────────────
    // For each candidate ratio, re-run the whole-plan evaluation (mix +
    // feed + pre-mix + intermediate refreshes + fridge in/out) and pick the
    // ratio that best clears blockers + scores highest. The chosen ratio is
    // surfaced as _recommendedNextFeedRatio; the auto-apply useEffect then
    // sets nextFeedRatio and re-solves at that ratio (one extra solve,
    // converges stable on the same recommendation).
    // Skipped when ratio is irrelevant or the baker chose 'keep'.
    if (
      ratioMode === 'recommend'
      && planningMode !== 'know_peak'
      && !_windowTooShort
    ) {
      // Pure per-ratio evaluator — runs candidate gen with ratio-local values
      // (adjPeakH_r, troughH_r, _refreshStretchFactor_r, _adjPeakH_refresh_r,
      // TOL_r) and returns (allClear, bestScore, windowTooShort) without any
      // side effects.
      const evaluatePlanForRatio = (r: 1 | 2 | 4 | 5 | 10): {
        allClear: boolean;
        bestScore: number;
        windowTooShort: boolean;
        green: boolean;
      } => {
        const ratioMult_r = 1 + 0.5 * Math.log(r);
        const adjPeakH_r  = peakH * ryeF * matF * ratioMult_r;
        // Balanced cycle count — mirrors Stage 1's feasibility floor (taste
        // is never a gate; see _revivalOverheadH).
        const _revivalOverheadH_r = adjPeakH_r * 1.25 * revivalCycles(lastFedAge, starterMature, 'balanced');
        const effectiveMinFermH_r = minFermH + _revivalOverheadH_r;
        if ((bakeMs - Date.now()) / 3600000 < effectiveMinFermH_r) {
          return { allClear: false, bestScore: 0, windowTooShort: true, green: false };
        }
        const troughH_r = getStarterTroughH(kitchenTemp, starterMature, styleKey ?? 'neapolitan') * ryeF * ratioMult_r;
        const _refreshStretchFactor_r = (() => {
          if (planningMode !== 'last_fed' || !lastFedTime) return 1.0;
          const hSinceFeed = (Date.now() - lastFedTime.getTime()) / 3600000;
          if (hSinceFeed <= adjPeakH_r) return 1.0;
          if (hSinceFeed <= adjPeakH_r * 1.5) return 1.05;
          if (hSinceFeed <= troughH_r) return 1.15;
          if (hSinceFeed <= troughH_r * 1.5) return 1.25;
          if (hSinceFeed <= troughH_r * 2.5) return 1.35;
          return 1.5;
        })();
        const _adjPeakH_refresh_r = adjPeakH_r * _refreshStretchFactor_r;
        // Same canonical pre-mix reference as Stage 1, at THIS ratio's adjPeakH_r,
        // so the ratio evaluator scores against the same peak the final Stage-1
        // solve (and its bell) will produce at the chosen ratio (guardrail #3).
        const _refPeakForPreMix_r: number | null = _starterRefeedTime
          ? _starterRefeedTime.getTime() + adjPeakH_r * 3600000
          : (lastFedTime ? lastFedTime.getTime() + adjPeakH_r * 3600000 : null);
        const rtTOL_r   = Math.max(1.0, Math.min(3.0, adjPeakH_r * 0.15));
        const baseTOL_r = starterLocation === 'fridge' ? 2.0 : rtTOL_r;
        const TOL_r     = baseTOL_r * ftm;

        // Local scoring helpers using TOL_r (others are ratio-independent and
        // close over from the outer scope: doughScore/retardBonus/reasonableHour/feedComfort).
        const starterScore_r = (mixHBF: number, peakHBF: number): 0 | 1 | 2 => {
          const beforePeak = mixHBF > peakHBF;
          const gap = Math.abs(mixHBF - peakHBF);
          const tol2 = beforePeak ? TOL_r + 0.5 : TOL_r;
          if (gap <= tol2) return 2;
          if (gap <= tol2 + 1.5) return 1;
          return 0;
        };
        const combinedScore_r = (mixHBF: number, peakHBF: number, feedMs: number, usesMixForComfort = false): number => {
          const ss = starterScore_r(mixHBF, peakHBF);
          const ds = doughScore(mixHBF);
          const retardW = ss >= 2 ? 8 : 3;
          const comfortMs = usesMixForComfort ? (bakeMs - mixHBF * 3600000) : feedMs;
          const tangW = tang === 'balanced' ? 0 : 12;
          // Mirror main combinedScore: mix-hour comfort ×2 on every path
          const mixComfort = feedComfort(bakeMs - mixHBF * 3600000);
          // Mirror main combinedScore: declining-gap shaping (see Stage 1).
          const pastPeakH_r = peakHBF - mixHBF;
          const decliningPenalty_r = pastPeakH_r > 0
            ? Math.min(30, (pastPeakH_r / Math.max(1, adjPeakH_r)) * 30)
            : 0;
          return (ss + ds) * 100
            + retardBonus(mixHBF) * (retardW + tangW)
            + mixComfort * 2
            + feedComfort(comfortMs) * 3
            - decliningPenalty_r;
        };

        // Candidate generation (Peak1, Peak2, Future-feed, Refresh+PreMix —
        // these cover the paths where ratio actually changes blocker layout).
        const STEP_r = 0.25;
        const scanFrom_r = sweetFromHBF + 2;
        const scanTo_r   = Math.max(sweetToHBF - 2, minTotalRT + 0.5);
        const candidates_r: Candidate[] = [];
        const nowMs_r = Date.now();
        // Per-ratio pushCand — like the main solver's pushCand but using the
        // per-ratio adjPeakH_r/ratioMult_r so each candidate's stored action
        // times reflect THIS ratio's plan. Also stores renderFridgeInMs /
        // renderFridgeOutMs with the per-ratio adjPeakH_r so candidateValid
        // (called via foundValidR below) checks the SAME fridge timestamps the
        // event builder would render for this ratio. Without this, the ratio
        // search's allClear silently passed plans whose fridge actions land in
        // blockers — and rec stayed null because every ratio looked clear.
        function pushCand_r(c: Omit<Candidate, 'actionTimesMs'>): void {
          // Mirror pushCand's pre-mix pin (evaluator ≡ solver).
          if (manualFeed2Ref.current != null) {
            if (c.usingPeak2 || c.feed2Ms == null || Math.abs(c.feed2Ms - manualFeed2Ref.current) > 22.5 * 60000) return;
          }
          const fridgeTimes = computeNonPathBFridgeTimes(c, adjPeakH_r, ratioMult_r);
          if (fridgeTimes && !(fridgeTimes.fridgeInMs < fridgeTimes.fridgeOutMs)) return;
          const enriched: Omit<Candidate, 'actionTimesMs'> = {
            ...c,
            renderFridgeInMs:  fridgeTimes?.fridgeInMs,
            renderFridgeOutMs: fridgeTimes?.fridgeOutMs,
          };
          const _extraFeeds_r = Math.max(0, plannedFutureFeedCount(enriched, adjPeakH_r, ratioMult_r) - 1);
          candidates_r.push({
            ...enriched,
            score: enriched.score - _extraFeeds_r * FEED_COUNT_COST,
            actionTimesMs: computeActionTimes(enriched, adjPeakH_r, ratioMult_r),
          });
        }

        const feed1Ms_r = peakTime
          ? (lastFedTime ? lastFedTime.getTime() : peakTime.getTime() - adjPeakH_r * 3600000)
          : (lastFedTime?.getTime() ?? Date.now());

        if (peakTime) {
          const peak1HBF = (bakeMs - peakTime.getTime()) / 3600000;
          for (let mixHBF = scanFrom_r; mixHBF >= scanTo_r; mixHBF -= STEP_r) {
            if (bakeMs - mixHBF * 3600000 <= nowMs_r) continue;
            if (inBlocker(mixHBF)) continue;
            const ss = starterScore_r(mixHBF, peak1HBF);
            if (ss === 0) continue;
            if (!riseCompleteEnough(mixHBF, peak1HBF, _starterRefeedTime?.getTime() ?? feed1Ms_r)) continue;
            pushCand_r({
              mixHBF, peakHBF: peak1HBF, feedMs: feed1Ms_r,
              usingPeak2: false, feed2Ms: null,
              score: combinedScore_r(mixHBF, peak1HBF, feed1Ms_r), sscore: ss,
            });
          }
        }

        if (planningMode === 'last_fed' && lastFedTime) {
          const troughMs = lastFedTime.getTime() + troughH_r * 3600000;
          const peak2AHBF = (bakeMs - computeStarterPeakMs(troughMs, _refPeakForPreMix_r, adjPeakH_r)) / 3600000;
          if (troughMs >= nowMs_r) {
            for (let mixHBF = scanFrom_r; mixHBF >= scanTo_r; mixHBF -= STEP_r) {
              if (bakeMs - mixHBF * 3600000 <= nowMs_r) continue;
              if (inBlocker(mixHBF)) continue;
              if (inBlockerMs(troughMs)) continue;
              const ss = starterScore_r(mixHBF, peak2AHBF);
              if (ss === 0) continue;
              if (!riseCompleteEnough(mixHBF, peak2AHBF, troughMs)) continue;
              pushCand_r({
                mixHBF, peakHBF: peak2AHBF, feedMs: troughMs,
                usingPeak2: true, feed2Ms: troughMs,
                score: combinedScore_r(mixHBF, peak2AHBF, troughMs, true), sscore: ss,
              });
            }
          }
          if (_starterRefeedTime && !isBlockedActionMs(_starterRefeedTime.getTime())) {
            const refeedMs = _starterRefeedTime.getTime();
            const peak2BHBF = (bakeMs - computeStarterPeakMs(refeedMs, _refPeakForPreMix_r, adjPeakH_r)) / 3600000;
            for (let mixHBF = scanFrom_r; mixHBF >= scanTo_r; mixHBF -= STEP_r) {
              if (bakeMs - mixHBF * 3600000 <= nowMs_r) continue;
              if (inBlocker(mixHBF)) continue;
              const ss = starterScore_r(mixHBF, peak2BHBF);
              if (ss === 0) continue;
              if (!riseCompleteEnough(mixHBF, peak2BHBF, refeedMs)) continue;
              pushCand_r({
                mixHBF, peakHBF: peak2BHBF, feedMs: refeedMs,
                usingPeak2: true, feed2Ms: refeedMs,
                score: combinedScore_r(mixHBF, peak2BHBF, refeedMs, true) + 6, sscore: ss,
              });
            }
          }

          // Option C mirror: delayed single refresh timed backward from the
          // mix (see Stage-1 family) — evaluated per-ratio so allClear /
          // bestScore reflect the same plan space Stage 1 will solve.
          // Skipped when the baker pinned the refresh (mirror of Stage 1).
          if (_starterRefeedTime && manualRefreshRef.current == null) {
            const GRID_MS_r = 15 * 60000;
            for (let mixHBF = scanFrom_r; mixHBF >= scanTo_r; mixHBF -= STEP_r) {
              const mixMs = bakeMs - mixHBF * 3600000;
              if (mixMs <= nowMs_r) continue;
              if (inBlocker(mixHBF)) continue;
              let tR = mixMs - adjPeakH_r * 3600000;
              for (let it = 0; it < 4; it++) {
                tR += mixMs - computeStarterPeakMs(tR, _refPeakForPreMix_r, adjPeakH_r);
              }
              tR = Math.round(tR / GRID_MS_r) * GRID_MS_r;
              if (tR <= nowMs_r + 15 * 60000) continue;
              if (inBlockerMs(tR)) continue;
              const peakCMs  = computeStarterPeakMs(tR, _refPeakForPreMix_r, adjPeakH_r);
              const peakCHBF = (bakeMs - peakCMs) / 3600000;
              const ss = starterScore_r(mixHBF, peakCHBF);
              if (ss === 0) continue;
              if (!riseCompleteEnough(mixHBF, peakCHBF, tR)) continue;
              pushCand_r({
                mixHBF, peakHBF: peakCHBF, feedMs: tR,
                usingPeak2: true, feed2Ms: tR,
                score: combinedScore_r(mixHBF, peakCHBF, tR, true) + 6, sscore: ss,
              });
            }
          }
        }

        // Future-feed candidates (always generated)
        {
          const idealMixTime2 = targetMixTime ?? new Date(bakeMs - ((sweetFromHBF + sweetToHBF) / 2) * 3600000);
          const baseFeed2 = new Date(idealMixTime2.getTime() - adjPeakH_r * 3600000);
          const searchStart2 = targetMixTime
            ? new Date(baseFeed2.getTime() - 15 * 60000)
            : new Date(baseFeed2.getTime() - 36 * 3600000);
          const searchEnd2 = targetMixTime
            ? new Date(baseFeed2.getTime() + 15 * 60000)
            : new Date(baseFeed2.getTime() + 2 * 3600000);
          const refreshPeakMsForStretch_r = _starterRefeedTime
            ? _starterRefeedTime.getTime() + _adjPeakH_refresh_r * 3600000
            : null;
          for (let t2 = searchStart2.getTime(); t2 <= searchEnd2.getTime(); t2 += 15 * 60000) {
            if (t2 <= nowMs_r) continue;
            const peakT2 = new Date(computeStarterPeakMs(t2, _refPeakForPreMix_r, adjPeakH_r));
            const mHBF2  = (bakeMs - peakT2.getTime()) / 3600000;
            if (mHBF2 < sweetToHBF - 4 || mHBF2 > sweetFromHBF + 4) continue;
            if (inBlockerMs(t2)) continue;
            if (refreshPeakMsForStretch_r != null) {
              const _gp = (t2 - refreshPeakMsForStretch_r) / 3600000;
              const _me = adjPeakH_r * 0.5;
              if (_gp < -_me || _gp > 6) continue;
            }
            // Near-peak mix offsets — mirrors the Stage-1 t2 scan.
            const _peakSlotBad2r = inBlocker(mHBF2) || bakeMs - mHBF2 * 3600000 <= nowMs_r;
            const _mixOffsets2r = _peakSlotBad2r ? [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3] : [0];
            for (const _offH2r of _mixOffsets2r) {
              const _mixMsC2r  = peakT2.getTime() + _offH2r * 3600000;
              const _mixHBFC2r = (bakeMs - _mixMsC2r) / 3600000;
              if (_mixMsC2r <= nowMs_r) continue;
              if (inBlocker(_mixHBFC2r)) continue;
              const ss2 = starterScore_r(_mixHBFC2r, mHBF2);
              if (ss2 === 0) continue;
              if (!riseCompleteEnough(_mixHBFC2r, mHBF2, t2)) continue;
              const sc2 = combinedScore_r(_mixHBFC2r, mHBF2, t2, true);
              pushCand_r({
                mixHBF: _mixHBFC2r, peakHBF: mHBF2, feedMs: t2,
                usingPeak2: false, feed2Ms: t2,
                score: sc2 - Math.abs(_offH2r) * 2, sscore: ss2,
                isFutureFeedPath: true,
              });
            }
          }
        }

        // Refresh + future-feed (declining/depleted, RT) — mirrors the main
        // solver: nBridge loop over [0,1,2] to close the 6–24h dead zone
        // between a single refresh peak and pre-mix.
        if (
          planningMode === 'last_fed' && lastFedTime &&
          (starterLocation === 'rt'
            || (starterLocation === 'fridge' && _starterRefeedTime !== null)) &&
          (Date.now() - lastFedTime.getTime()) / 3600000 > adjPeakH_r
        ) {
          const nowMs3 = Date.now();
          const refreshSpacingH_bridge_r = Math.max(6, adjPeakH_r * 1.25);
          for (let nBridge = 0; nBridge <= 2; nBridge++) {
            const refreshMs = nowMs3;
            if (isBlockedActionMs(refreshMs)) break;
            const finalRefreshMs_r     = nowMs3 + nBridge * refreshSpacingH_bridge_r * 3600000;
            const finalRefreshPeakMs_r = finalRefreshMs_r + _adjPeakH_refresh_r * 3600000;
            const bridges_r: number[] = [];
            for (let i = 1; i <= nBridge; i++) {
              bridges_r.push(nowMs3 + i * refreshSpacingH_bridge_r * 3600000);
            }
            let bridgesOk = true;
            for (const br of bridges_r) {
              if (inBlockerMs(br)) { bridgesOk = false; break; }
            }
            if (!bridgesOk) continue;
            const earliestPreMixMs = finalRefreshPeakMs_r - 12 * 3600000;
            const baseFeed3 = targetMixTime
              ? new Date(targetMixTime.getTime() - adjPeakH_r * 3600000)
              : null;
            const searchStart3 = baseFeed3
              ? new Date(baseFeed3.getTime() - 15 * 60000)
              : new Date(finalRefreshPeakMs_r - 12 * 3600000);
            const searchEnd3 = baseFeed3
              ? new Date(baseFeed3.getTime() + 15 * 60000)
              : new Date(finalRefreshPeakMs_r + 12 * 3600000);
            const minFeedGapH_r = Math.max(6, adjPeakH_r * 0.75);
            for (let t3 = Math.max(searchStart3.getTime(), earliestPreMixMs); t3 <= searchEnd3.getTime(); t3 += 15 * 60000) {
              if (t3 <= nowMs_r) continue;
              // Pre-mix must be ≥ minFeedGapH after the final bridge — mirrors
              // the main solver's spacing rule.
              if (t3 - finalRefreshMs_r < minFeedGapH_r * 3600000) continue;
              const peakT3 = new Date(computeStarterPeakMs(t3, _refPeakForPreMix_r, adjPeakH_r));
              const mHBF3  = (bakeMs - peakT3.getTime()) / 3600000;
              if (mHBF3 < sweetToHBF - 4 || mHBF3 > sweetFromHBF + 4) continue;
              if (inBlockerMs(t3)) continue;
              const _gp3 = (t3 - finalRefreshPeakMs_r) / 3600000;
              const _me3 = adjPeakH_r * 0.5;
              if (_gp3 < -_me3 || _gp3 > 6) continue;
              // Near-peak mix offsets — mirrors the Stage-1 t3 scan.
              const _peakSlotBad3r = inBlocker(mHBF3) || bakeMs - mHBF3 * 3600000 <= nowMs_r;
              const _mixOffsets3r = _peakSlotBad3r ? [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3] : [0];
              const bridgeCost = nBridge * 8;
              for (const _offH3r of _mixOffsets3r) {
                const _mixMsC3r  = peakT3.getTime() + _offH3r * 3600000;
                const _mixHBFC3r = (bakeMs - _mixMsC3r) / 3600000;
                if (_mixMsC3r <= nowMs_r) continue;
                if (inBlocker(_mixHBFC3r)) continue;
                const ss3 = starterScore_r(_mixHBFC3r, mHBF3);
                if (ss3 === 0) continue;
                if (!riseCompleteEnough(_mixHBFC3r, mHBF3, t3)) continue;
                const sc3 = combinedScore_r(_mixHBFC3r, mHBF3, t3, true);
                pushCand_r({
                  mixHBF: _mixHBFC3r, peakHBF: mHBF3, feedMs: t3,
                  usingPeak2: false, feed2Ms: t3,
                  score: sc3 + 12 - bridgeCost - Math.abs(_offH3r) * 2, sscore: ss3,
                  isFutureFeedPath: true,
                  bridgeRefreshMs: bridges_r.length > 0 ? [...bridges_r] : undefined,
                });
              }
            }
          }
        }

        if (candidates_r.length === 0) {
          return { allClear: false, bestScore: 0, windowTooShort: false, green: false };
        }
        candidates_r.sort((a, b) => b.score - a.score);

        let bestR = candidates_r[0];
        let foundValidR = false;
        for (const cand of candidates_r) {
          // Per-ratio candidates carry their own actionTimesMs (populated by
          // pushCand_r at gen time). candidateValid reads cand.actionTimesMs
          // directly — no params needed.
          if (candidateValid(cand)) {
            bestR = cand;
            foundValidR = true;
            break;
          }
        }
        // Green mirrors Stage 1's _starterPillState: starter at peak at mix,
        // plan executable, and mix not too far down the declining side.
        const _pastPeakH_r = bestR.peakHBF - bestR.mixHBF;
        const _greenCeil_r = Math.min(TOL_r, Math.max(1.0, adjPeakH_r * 0.4));
        return { allClear: foundValidR, bestScore: bestR.score, windowTooShort: false,
                 green: foundValidR && bestR.sscore === 2 && _pastPeakH_r <= _greenCeil_r };
      };

      // Search: try every ratio, pick by priority:
      //   1) ratios that clear all blockers beat those that don't
      //   2) within same clear-state, higher combinedScore wins
      //   3) tie within RATIO_IMPROVE_THRESHOLD → prefer ratio closer to baker's usual
      const RATIOS_ARR: (1 | 2 | 4 | 5 | 10)[] = [1, 2, 4, 5, 10];
      const RATIO_IMPROVE_THRESHOLD = 18;
      let chosenRatio: 1 | 2 | 4 | 5 | 10 = lastFeedRatio;
      let chosenEval = evaluatePlanForRatio(lastFeedRatio);
      for (const rr of RATIOS_ARR) {
        if (rr === lastFeedRatio) continue;
        const cand = evaluatePlanForRatio(rr);
        const clearsWhenBaseDoesnt = cand.allClear && !chosenEval.allClear;
        const sameClearState = cand.allClear === chosenEval.allClear && !cand.windowTooShort && !chosenEval.windowTooShort;
        const betterScore = sameClearState && cand.bestScore > chosenEval.bestScore + RATIO_IMPROVE_THRESHOLD;
        const tie = sameClearState && Math.abs(cand.bestScore - chosenEval.bestScore) <= RATIO_IMPROVE_THRESHOLD;
        const closerToUsual = Math.abs(Math.log(rr) - Math.log(lastFeedRatio))
                           < Math.abs(Math.log(chosenRatio) - Math.log(lastFeedRatio));
        // Green tier sits between clear-state and raw score: a ratio whose
        // plan puts the starter at peak at mix beats one that doesn't,
        // regardless of the 18-pt threshold — and never regress from green.
        const greenRegression   = chosenEval.green && !cand.green;
        const greenWhenBaseIsnt = sameClearState && cand.green && !chosenEval.green;
        if (!greenRegression && (clearsWhenBaseDoesnt || greenWhenBaseIsnt || betterScore
            || (tie && closerToUsual && cand.green === chosenEval.green))) {
          chosenEval = cand;
          chosenRatio = rr;
        }
      }
      // ALWAYS emit the chosen ratio — even when it equals lastFeedRatio.
      // Emitting only on a delta made the applied ratio a one-way ratchet:
      // once auto-apply set nextFeedRatio to a recommendation, a later solve
      // whose best ratio was back at baseline emitted null, the effect did
      // nothing, and the stale ratio silently kept steering every plan
      // (live hysteresis: blocker off → ratio 2 applied → blocker back on →
      // single-feed plan persisted at ratio 2).
      _recommendedNextFeedRatio = chosenRatio;
    }

    buildAndSetResult();
  }

  // The solver reruns inside applyAndUpdate; by the time pendingStart settles
  // we can say whether the blockers moved it, and by how much.
  useEffect(() => {
    const rec = blockerMoveRef.current;
    if (!rec) return;
    blockerMoveRef.current = null;
    const deltaMin = Math.round((pendingStart.getTime() - rec.prevStart) / 60000);
    if (Math.abs(deltaMin) < 15) return;
    const at = pendingStart.toLocaleString(isFr ? 'fr-FR' : 'en-US', {
      weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: !isFr,
    });
    const earlier = deltaMin < 0;
    setMovedNote(isFr
      ? `Pétrissage ${earlier ? 'avancé' : 'repoussé'} à ${at} — il tombait dans une plage bloquée.`
      : `Mix moved ${earlier ? 'earlier' : 'later'}, to ${at} — it fell inside a blocked window.`);
  }, [pendingStart, isFr]);

  // ── Handlers ─────────────────────────────────

  // Apply a suggested clear time from a busy-conflict note. One edit at a
  // time: this IS the baker's edit, so it flips the eyebrow and shows Reset.
  function applySuggestedTime(id: string, at: Date) {
    setAppliedSuggestion({ id, from: (id === 'mix' ? pendingStart : pendingEatTime).getTime() });
    commitRowTime(id, at);
  }

  function undoSuggestedTime() {
    const prev = appliedSuggestion;
    setAppliedSuggestion(null);
    if (!prev) return;
    commitRowTime(prev.id, new Date(prev.from));
  }

  // Commit a new time for one plan-list row. Accepts a Date or the raw
  // datetime-local string from the inline picker.
  function commitRowTime(id: string | null, value: Date | string) {
    if (!id) return;
    const at = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(at.getTime())) return;
    hasManuallyDragged.current = true;
    setHasDragged(true);
    ratioApplyHistoryRef.current.length = 0;
    if (id === 'bake') {
      setPendingEatTime(at);
      setEatTimeSet(true);
      onChange(pendingStart, at, blocks, isSourdough ? undefined : {preservePlan:true});
      if (isSourdough) findOptimalPositionSourdough(at, undefined, localBlocks);
      return;
    }
    if (id === 'mix') {
      if ((pendingEatTime.getTime() - at.getTime()) / 3600000 < 0.5) return;
      setPendingStart(at);
      setRecommendedHBF(null);
      if (isSourdough) {
        setMixOverride(true);
        manualMixRef.current = at.getTime();
      }
      onChange(at, pendingEatTime, blocks, isSourdough ? undefined : {preservePlan:true});
      if (isSourdough) findOptimalPositionSourdough(pendingEatTime, at);
      return;
    }
    if (id === 'pref') {
      const newPrefOffsetH = (pendingStart.getTime() - at.getTime()) / 3600000;
      if (newPrefOffsetH >= 0) {
        setPrefOffsetH(newPrefOffsetH);
        onPrefOffsetChange?.(newPrefOffsetH);
      }
      return;
    }
    if (id.startsWith('ev:') && isSourdough) {
      // Starter feeds go through the same pin the drag path uses — never
      // rewrite lastFedTime, which survived Reset and made the original
      // recommendation unreachable (sweep run 1: reset:Next Feed DIVERGED).
      const step = 15 * 60000;
      const t = Math.round(at.getTime() / step) * step;
      manualRefreshRef.current = t;
      findOptimalPositionSourdough(pendingEatTime, undefined, localBlocks);
    }
  }

  // Reset — restores the recommended plan and clears every baker override.
  // Shared by the chart's Reset (custom mode) and the pill (simple mode).
  function resetToRecommendation() {
    hasManuallyDragged.current = false;
    setHasDragged(false);
    setStarterPins(null);setEditingRow(null);setEditBaseTimes(null);setKeyAdjusted(false);keyBaselineRef.current=null;
    setAppliedSuggestion(null);
    setFocusRow(null);
    // Reset must clear EVERY baker override, or it re-solves into the
    // overridden plan instead of the original recommendation.
    manualRefreshRef.current = null;
    manualFeed2Ref.current = null;
    manualMixRef.current = null;
    setNextFeedRatioOverride(null);
    onNextFeedRatioOverrideChange?.(null);
    // ...including the ratio oscillation history: the drag-solve pushed the
    // original ratio into it, so the reset-solve's recommendation (that same
    // ratio) was vetoed by the guard and the plan stayed at the
    // drag-influenced ratio.
    ratioApplyHistoryRef.current.length = 0;
    const blocksToUse = isSourdough ? localBlocks : blocks;
    computeAndApplyRecommendation(blocksToUse, pendingEatTime);
    if (isSourdough) {
      findOptimalPositionSourdough(pendingEatTime, undefined, blocksToUse);
    }
  }

  function adjustStart(deltaH: number) {
    const d = new Date(pendingStart.getTime() + deltaH * 3600000);
    setPendingStart(d);
    onChange(d, pendingEatTime, blocks);
  }

  function applyAndUpdate(newBlocks: AvailabilityBlock[]) {
    blockerMoveRef.current = {
      prevStart: pendingStart.getTime(),
      labels: newBlocks.map(b => b.label),
    };
    setMovedNote(null);
    // Blocker set changed — stale oscillation history must not veto fresh
    // ratio recommendations (it froze the ratchet across blocker toggles).
    ratioApplyHistoryRef.current.length = 0;
    const { resolvedStart, moved, resolvedDate: _resolvedDate } = applyBlockerOverlap(pendingStart, newBlocks);
    if (resolvedStart.getTime() !== pendingStart.getTime()) setPendingStart(resolvedStart);
    setBlockerNote(null);
    // Synchronous, so this solve and any deferred one see the new set.
    solverBlocksRef.current = newBlocks;
    onChange(resolvedStart, pendingEatTime, newBlocks);
    if (isSourdough && eatTimeSet) {
      setHasDragged(false);
      hasManuallyDragged.current = false;
      manualRefreshRef.current = null;
      manualFeed2Ref.current = null;
      manualMixRef.current = null;
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

  // Night preset labels are `<Weekday> night`. Match the suffix, not membership
  // of the current `nights` array — the same predicate the regeneration effect
  // already uses, and the mirror of toggleWork's `startsWith('Work · ')`.
  //
  // Membership was the asymmetry that made Nights fail the round-trip while
  // Weekdays passed: a night added under one window is not in `nights` after
  // the window moves, so OFF left it in place AND isAnyNightActive() reported
  // false — the chip read off while that block was still constraining the
  // solver.
  function isAnyNightActive(): boolean {
    return _effectiveBlocks.some(b => b.label.endsWith(' night'));
  }

  function toggleAllNights() {
    const withoutNights = _effectiveBlocks.filter(b => !b.label.endsWith(' night'));
    const newBlocks = isAnyNightActive()
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
    marginTop: '16px', width: '100%', padding: '16px 24px',
    border: 'none', borderRadius: '16px',
    background: 'var(--terra)', color: '#fff',
    fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(107, 68, 35,0.25)',
    letterSpacing: '.01em',
  };

  // ── Unified render (bake time always visible) ─
  const { scenario } = suggestion;
  const startInvalid = startComputed && pendingStart >= pendingEatTime;
  const bulkConflict = schedule?.bulkConflict ?? null;
  // These are planning windows supplied by the existing engine, not a new
  // maturity model. In particular, a missing sourdough solve is unknown.
  const commercialReadinessBounds = commercialReadinessWindow({
    ...(STYLE_FERM_DEFAULTS[styleKey ?? ''] ?? FERM_FALLBACK), flourStrength,
    kitchenTemp, preheatMin, totalWindowH: (pendingEatTime.getTime() - Date.now()) / 3600000,
  });
  const readinessFromH = isSourdough ? solverResult?.sourdoughSweetFrom ?? null : commercialReadinessBounds?.from ?? null;
  const readinessToH = isSourdough ? solverResult?.sourdoughSweetTo ?? null : commercialReadinessBounds?.to ?? null;
  const readinessUnsupported = ['brioche', 'pain_mie', 'pain_viennois'].includes(styleKey ?? '')
    && (isSourdough || prefermentType !== 'none');
  const readinessWindowValid = readinessFromH !== null && readinessToH !== null
    && Number.isFinite(readinessFromH) && Number.isFinite(readinessToH)
    && readinessFromH > readinessToH && readinessToH >= 0
    && !!STYLE_FERM_DEFAULTS[styleKey ?? ''] && !startTimeInPast
    && !readinessUnsupported && (!isSourdough || renderSweetFrom > renderSweetTo);
  const readinessWindowFrom = readinessWindowValid
    ? new Date(pendingEatTime.getTime() - readinessFromH! * 3600000) : null;
  const readinessWindowTo = readinessWindowValid
    ? new Date(pendingEatTime.getTime() - readinessToH! * 3600000) : null;
  const readinessNow = Date.now();
  // Preserve every explicit block and extend enabled recurring presets through
  // the repair search horizon. Later candidates must not escape future nights.
  const repairBlocks = [...localBlocks];
  const repairHorizon = new Date(+pendingEatTime + 48 * 3600000);
  const appendPreset = (entries: ReturnType<typeof getWorkdaysInWindow>) => {
    for (const entry of entries) if (!repairBlocks.some(b => +b.from === +entry.blockStart && +b.to === +entry.blockEnd)) {
      repairBlocks.push({ from: entry.blockStart, to: entry.blockEnd, label: entry.label });
    }
  };
  if (localBlocks.some(b => b.label.startsWith('Work · '))) appendPreset(getWorkdaysInWindow(pendingEatTime, repairHorizon));
  if (localBlocks.some(b => b.label.endsWith(' night'))) appendPreset(getNightsInWindow(pendingEatTime, repairHorizon));
  const methodActions = (mix: Date): AvailabilityAction[] => {
    if (isSourdough) return displayStarterEvents
      .filter(event => event.kind !== 'last_fed' && event.kind !== 'known_peak')
      .map(event => ({ id: event.kind.startsWith('fridge') ? 'starter-cold' : 'starter-feed', at: event.time }));
    if (!hasPrefActive) return [];
    return [{ id: 'preferment', at: new Date(+mix - prefOffsetH * 3600000) },
      ...(prefGoesInFridge && prefRTWarmupH > 0
        ? [{ id: 'preferment-cold-out', at: new Date(+mix - prefRTWarmupH * 3600000) }] : [])];
  };
  const readinessConflicts = findAvailabilityConflicts([
    ...(schedule?.availabilityActions ?? [{ id: 'mix', at: pendingStart }, { id: 'bake', at: pendingEatTime }]),
    ...methodActions(pendingStart),
  ], repairBlocks, readinessNow).sort((a, b) => +a.action.at - +b.action.at);
  const readinessBusy = readinessConflicts.length > 0
    || !!(bulkConflict && +pendingStart > readinessNow);
  const conflictNames: Record<string, [string, string]> = {
    mix: ['Pétrissage', 'Mixing'], 'mix-finish': ['Fin du pétrissage', 'Finish mixing'],
    poach: ['Pochage', 'Poaching'], roll: ['Abaisse', 'Rolling'],
    divide: ['Division et façonnage', 'Divide and shape'], preheat: ['Préchauffage', 'Preheat'], bake: ['Cuisson', 'Bake'],
    'cold-in': ['Mise au froid', 'Into the fridge'], 'cold-in-2': ['Deuxième mise au froid', 'Second fridge stage'],
    'cold-out': ['Sortie du froid', 'Out of the fridge'], 'cold-out-2': ['Deuxième sortie du froid', 'Second fridge exit'],
    'starter-feed': ['Rafraîchi du levain', 'Feed starter'], 'starter-cold': ['Étape au froid du levain', 'Starter fridge step'],
    preferment: ['Préparation du préferment', 'Prepare preferment'], 'preferment-cold-out': ['Sortie du préferment', 'Preferment fridge exit'],
  };
  const firstReadinessConflict = readinessConflicts[0];
  const conflictBlockLabel = firstReadinessConflict?.block.label;
  const localizedConflictBlock = conflictBlockLabel?.startsWith('Work · ') ? (isFr ? 'Travail' : 'Work')
    : conflictBlockLabel?.endsWith(' night') ? (isFr ? 'Nuit' : 'Night')
    : conflictBlockLabel ?? (isFr ? 'Indisponible' : 'Unavailable');
  const conflictDescription = firstReadinessConflict
    ? `${(conflictNames[firstReadinessConflict.action.id] ?? ['Étape', 'Step'])[isFr ? 0 : 1]} · ${fmtCardDT(firstReadinessConflict.action.at, isFr)}${firstReadinessConflict.action.end ? `–${fmtCardHM(firstReadinessConflict.action.end, isFr)}` : ''} · ${localizedConflictBlock}`
    : undefined;
  // A commercial proposal is checked both while offered and again on tap.
  // Starter plans remain manual: the later sourdough solve may change feeds.
  const acceptsCommercialRepair = (candidate: { startTime: Date; eatTime: Date }, now: number) => {
    if (isSourdough || +candidate.startTime < now) return false;
    const duration = (+candidate.eatTime - +candidate.startTime) / 3600000;
    const bounds = commercialReadinessWindow({ ...(STYLE_FERM_DEFAULTS[styleKey ?? ''] ?? FERM_FALLBACK),
      flourStrength, kitchenTemp, preheatMin, totalWindowH: (+candidate.eatTime - now) / 3600000 });
    if (!(bounds.from > bounds.to && duration >= bounds.to && duration <= bounds.from)) return false;
    if (!commercialPrefermentPlanValid({type:prefermentType, inFridge:prefGoesInFridge,
      mixTime:candidate.startTime, bakeTime:candidate.eatTime, offsetHours:prefOffsetH,
      blocks:repairBlocks, now:new Date(now)})) return false;
    const actions = methodActions(candidate.startTime);
    return actions.every(action => +action.at >= now)
      && findAvailabilityConflicts(actions, repairBlocks, now).length === 0;
  };
  const verifiedRepair = useMemo(() => !isSourdough && readinessBusy && readinessWindowValid && !restoredPrepOverdue && !startInvalid
    && !windowTooShort && !solverResult?.windowTooShort
    ? findScheduleRepair({ startTime: pendingStart, eatTime: pendingEatTime, availabilityBlocks: repairBlocks, numItems,
      kitchenTemp, preheatMin, mixerType, styleKey, now: new Date(readinessNow), allowStartShift: true,
      acceptCandidate: candidate => acceptsCommercialRepair(candidate, readinessNow),
    }) : null, [readinessBusy, readinessWindowValid, restoredPrepOverdue, startInvalid, windowTooShort, solverResult, pendingStart, pendingEatTime, localBlocks, kitchenTemp, preheatMin, mixerType, numItems, styleKey, isSourdough, flourStrength, prefermentType, prefGoesInFridge, prefOffsetH, prefRTWarmupH, displayStarterEvents]);
  const applyVerifiedRepair = () => {
    if (!verifiedRepair) return;
    if (!acceptsCommercialRepair(verifiedRepair, Date.now())) {
      setGuardNote(isFr ? 'Cette proposition a expiré. Choisissez un nouvel horaire.' : 'This proposal has expired. Choose a new time.');
      editReadinessTime('bake');
      return;
    }
    manualMixRef.current = +verifiedRepair.startTime;
    hasManuallyDragged.current = true;
    setHasDragged(true);
    setPendingStart(verifiedRepair.startTime);
    setPendingEatTime(verifiedRepair.eatTime);
    setLocalBlocks(repairBlocks);
    setStartComputed(true);
    setRecommendedHBF(null);
    setDismissedConflict(false);
    onChange(verifiedRepair.startTime, verifiedRepair.eatTime, repairBlocks, { preservePlan: true });
  };
  const editReadinessTime = (row: 'mix' | 'bake') => {
    if (startTimeInPast || row === 'bake') {
      if (row === 'bake') {
        dateInputRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
        dateInputRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    setScheduleView('actions');
    setFocusRow(row);
    beginRowEdit(row, +(row === 'mix' ? pendingStart : pendingEatTime));
  };
  const readinessPanel = !(isSourdough && planningMode === 'last_fed' && lastFedAge === null) && (
        <FermentationReadiness
          isFr={isFr}
          compact
          showRange={false}
          showConfirmation={lastEditedRow === 'mix'}
          mixTime={pendingStart}
          bakeTime={pendingEatTime}
          windowFrom={readinessWindowFrom}
          windowTo={readinessWindowTo}
          isSourdough={isSourdough}
          prefermentType={prefermentType}
          starterPeak={readinessUnsupported ? null : solverResult?.peakTime ?? null}
          starterState={readinessUnsupported ? null : solverResult?.starterPillState ?? null}
          blocked={simpleKnownPeakConflict || sourdoughPlanBlockedRef.current || startInvalid || windowTooShort || !!solverResult?.windowTooShort || !commercialPrefValid}
          overdue={restoredPrepOverdue}
          busy={readinessConflicts.some(conflict => conflict.action.id === 'mix')}
          conflictDescription={conflictDescription}
          repairLabel={verifiedRepair ? `${verifiedRepair.kind === 'start' ? (isFr ? 'Pétrir à ' : 'Mix at ') : (isFr ? 'Cuire à ' : 'Bake at ')}${fmtCardDT(verifiedRepair.kind === 'start' ? verifiedRepair.startTime : verifiedRepair.eatTime, isFr)}` : undefined}
          onApplyRepair={verifiedRepair ? applyVerifiedRepair : undefined}
          kitchenTemp={kitchenTemp}
          fridgeTemp={fridgeTemp}
          canEdit={!startTimeInPast}
          unavailableReason={startTimeInPast ? 'started' : readinessUnsupported ? 'unsupported' : undefined}
          onEditMix={() => editReadinessTime('mix')}
          onEditBake={() => editReadinessTime('bake')}
          onReviewAvailability={() => {
            availabilityControlsRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
            availabilityControlsRef.current?.focus({ preventScroll: true });
          }}
        />
      );
  // A bake time already in the past can't be planned backwards from — show a
  // calm message instead of letting the solver build an impossible schedule
  // (which produced invalid dates and an error screen). 2-min grace so a
  // just-now pick isn't rejected mid-interaction.
  // ONLY during fresh planning. A GENERATED or RESTORED plan legitimately has
  // past times once the baker has started baking — frozen historical steps,
  // not a mistake. Never re-solve or nag a committed plan being executed.
  const bakeInPast = eatTimeSet
    && !recipeGenerated
    && !sessionRestored
    && !isNaN(pendingEatTime.getTime())
    && pendingEatTime.getTime() < Date.now() - 2 * 60 * 1000;

  const suggestedTargets=useMemo(()=>{
    if(isSourdough||readinessUnsupported||recipeGenerated)return [];
    const found:Array<{start:Date;bake:Date;blocks:AvailabilityBlock[]}>=[];
    const now=Date.now();
    for(let day=0;day<3&&found.length<3;day++)for(const hour of [11,19]) {
      const target=new Date(now);target.setDate(target.getDate()+day);target.setHours(hour,30,0,0);
      const bake=new Date(+target-readyOffset*60000);if(+bake<=now)continue;
      const candidateBlocks=[...localBlocks];
      const append=(entries:ReturnType<typeof getWorkdaysInWindow>)=>{for(const e of entries)if(!candidateBlocks.some(b=>+b.from===+e.blockStart&&+b.to===+e.blockEnd))candidateBlocks.push({from:e.blockStart,to:e.blockEnd,label:e.label});};
      if(localBlocks.some(b=>b.label.startsWith('Work · ')))append(getWorkdaysInWindow(new Date(now),bake));
      if(localBlocks.some(b=>b.label.endsWith(' night')))append(getNightsInWindow(new Date(now),bake));
      const bounds=commercialReadinessWindow({...(STYLE_FERM_DEFAULTS[styleKey]??FERM_FALLBACK),flourStrength,kitchenTemp,preheatMin,totalWindowH:(+bake-now)/3600000});
      const from=new Date(+bake-bounds.from*3600000),to=new Date(+bake-bounds.to*3600000);
      for(let h=bounds.from;h>=bounds.to;h-=.5){
        const start=new Date(+bake-h*3600000);if(+start<=now)continue;
        const methodValid=commercialPrefermentPlanValid({type:prefermentType,inFridge:prefGoesInFridge,mixTime:start,bakeTime:bake,offsetHours:prefOffsetH,blocks:candidateBlocks,now:new Date(now)});
        const preview=assessScheduleDraft({start,bake,blocks:candidateBlocks,kitchenTemp,preheatMin,mixerType,styleKey,numItems,from,to,extraActions:methodActions(start),methodValid,now});
        if(preview.valid){found.push({start,bake,blocks:candidateBlocks});break;}
      }
      if(found.length===3)break;
    }
    return found;
  },[isSourdough,readinessUnsupported,recipeGenerated,localBlocks,styleKey,flourStrength,kitchenTemp,preheatMin,mixerType,numItems,prefermentType,prefGoesInFridge,prefOffsetH,prefRTWarmupH,readyOffset]);

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>

      {/* Bake time inputs — always visible */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--char)', marginBottom: '4px' }}>
          {isFr ? 'C’est pour quand ?' : 'When is it for?'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--smoke)', marginBottom: '12px', lineHeight: 1.5 }}>
          {readyOffset ? readyTimeLabel : (isFr ? 'Début de cuisson' : 'Start baking')}
        </div>
        {readyTimeNote&&<details style={{fontSize:14,marginBottom:10}}><summary style={{minHeight:44,cursor:'pointer'}}>{isFr?'Comment estimer cette heure ?':'How is this time estimated?'}</summary><p>{readyTimeNote}</p></details>}
        {suggestedTargets.length>0&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>{suggestedTargets.map(candidate=><button type="button" key={+candidate.bake} onClick={()=>{
          setPendingStart(candidate.start);setPendingEatTime(candidate.bake);setEatTimeSet(true);setStartComputed(true);setLocalBlocks(candidate.blocks);
          const target=new Date(+candidate.bake+readyOffset*60000);setPickerDate(`${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`);setPickerHour(target.getHours());setPickerMinute(target.getMinutes());
          onChange(candidate.start,candidate.bake,candidate.blocks,{preservePlan:true});onReady?.();
        }} style={{minHeight:44,fontSize:15,padding:'8px 10px',background:'var(--warm)',border:'1px solid var(--border)',borderRadius:10}}>{fmtCardDT(new Date(+candidate.bake+readyOffset*60000),isFr)}</button>)}</div>}
        {isSourdough&&<p style={{fontSize:14,color:'var(--smoke)'}}>{isFr?'Choisissez votre horaire : sa faisabilité dépendra de votre levain.':'Choose your time: feasibility depends on your starter.'}</p>}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          {/* Date — native picker styled as "Sat 4 Apr" */}
          <div style={{ flex: 2, minWidth: 0, position: 'relative' }}>
            <div style={{
              ...INPUT_STYLE, width: '100%',
              display: 'flex', alignItems: 'center',
              color: pickerDate ? 'var(--char)' : 'var(--smoke)',
              position: 'relative', zIndex: 1, cursor: 'pointer',
              pointerEvents: 'none',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              minWidth: 0,
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
                if (!d || pickerHour === null) return;
                const coarse = typeof window !== 'undefined'
                  && window.matchMedia?.('(pointer: coarse)').matches;
                if (!coarse) {
                  applyTimePick(d, pickerHour, pickerMinute);
                  return;
                }
                // Touch device: defer the heavy apply until the native picker
                // is closed — see applyDebounceRef comment.
                if (applyDebounceRef.current) clearTimeout(applyDebounceRef.current);
                applyRetriesRef.current = 0;
                const tryApply = () => {
                  applyDebounceRef.current = null;
                  const latest = dateInputRef.current?.value ?? d;
                  const stillFocused = typeof document !== 'undefined'
                    && document.activeElement === dateInputRef.current;
                  if (stillFocused && applyRetriesRef.current < 4) {
                    applyRetriesRef.current += 1;
                    applyDebounceRef.current = setTimeout(tryApply, 900);
                    return;
                  }
                  if (latest) applyTimePick(latest, pickerHour, pickerMinute);
                };
                applyDebounceRef.current = setTimeout(tryApply, 900);
              }}
              onBlur={() => {
                // Picker closed — apply immediately with the final value.
                if (applyDebounceRef.current) {
                  clearTimeout(applyDebounceRef.current);
                  applyDebounceRef.current = null;
                  const d = dateInputRef.current?.value ?? '';
                  if (d && pickerHour !== null) applyTimePick(d, pickerHour, pickerMinute);
                }
              }}
              onClick={e => {
                // Desktop browsers need showPicker() to open the calendar.
                // On touch devices (iOS/Android) the tap ALREADY opens the native
                // picker — calling showPicker() on top of it double-triggers and
                // dismisses the sheet on first tap ("field collapses" bug).
                // Only call it for fine pointers (mouse/trackpad).
                if (typeof window !== 'undefined'
                    && window.matchMedia?.('(pointer: coarse)').matches) return;
                try {
                  (e.currentTarget as HTMLInputElement).showPicker?.();
                } catch {
                  // Older browsers — native behavior already opens picker
                }
              }}
              style={{
                position: 'absolute', inset: 0, opacity: 0,
                cursor: 'pointer', width: '100%', height: '100%',
                zIndex: 2, fontSize: 16,
              }}
            />
          </div>
          <input type="time" aria-label={readyOffset ? readyTimeLabel : (isFr ? 'Début de cuisson' : 'Start baking')} step={60}
            value={`${String(pickerHour).padStart(2,'0')}:${String(pickerMinute).padStart(2,'0')}`}
            onChange={e=>{const [h,m]=e.target.value.split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return;setPickerHour(h);setPickerMinute(m);if(pickerDate)applyTimePick(pickerDate,h,m);}}
            disabled={!pickerDate} style={{...INPUT_STYLE,flex:1,width:undefined,minWidth:0,fontSize:16}} />
        </div>
      </div>

      {/* Phase 2 content — only once bake time is set */}
      {/* Past bake time — calm guidance, no plan (never a crash) */}
      {bakeInPast && (
        <div style={{
          background: 'var(--warm)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '16px 20px', marginTop: '16px',
          fontFamily: 'var(--font-ui)',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--char)', fontFamily: 'var(--font-ui)', marginBottom: '4px' }}>
            {isFr ? 'Cet horaire est déjà passé' : "That bake time has already passed"}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--smoke)', lineHeight: 1.55 }}>
            {isFr
              ? 'Choisissez une date et une heure à venir — Baker Hub planifie à rebours depuis la cuisson.'
              : 'Pick a date and time in the future — Baker Hub plans backwards from your bake.'}
          </div>
        </div>
      )}

      {eatTimeSet && !bakeInPast && (<div>

      {/* Sourdough starter section */}
      {isSourdough && (
        <div style={{
          background: 'var(--warm)',
          border: '1.5px solid var(--border)',
          borderRadius: '16px',
          padding: '20px',
          marginTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>

          {/* ── Card header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-.25rem' }}>
            <div style={{ width: 8, height: 8, background: '#4A7FA5', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {isFr ? 'Votre levain' : 'Your starter'}
            </div>
          </div>

          {mode === 'simple' && (
            <div style={{ display: 'grid', gap: '12px', fontSize: '15px', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>{isFr
                ? 'Cette recette utilise un levain nourri avec autant de farine que d’eau, en poids. Un levain ferme ou une proportion inconnue nécessite de vérifier la recette avant de continuer.'
                : 'This recipe uses a starter fed with equal weights of flour and water. A stiff starter or an unknown proportion needs a recipe check before continuing.'}</p>
              <p style={{ margin: 0 }}>{isFr
                ? 'Votre levain actif a-t-il bien monté depuis son repas, avec des bulles, sans être retombé ? Vérifiez-le à température ambiante.'
                : 'Has your active starter risen well since feeding, with bubbles, without collapsing? Check it at room temperature.'}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button type="button" style={{ ...starterPillButton(planningMode === 'know_peak'), minHeight: 44 }} onClick={() => {
                  const observedPeak = new Date();
                  setPlanningMode('know_peak'); onPlanningModeChange?.('know_peak');
                  setKnownPeakTime(observedPeak); onKnownPeakTimeChange?.(observedPeak);
                  setStarterLocation('rt'); onStarterLocationChange?.('rt');
                  setLastFedTime(null); onLastFedTimeChange?.(null);
                  setLastFedAge(null); onLastFedAgeChange?.(null);
                  setFridgeOutTime(null); onFridgeOutTimeChange?.(null);
                  setHasNotFedYet(false); onHasNotFedYetChange?.(false);
                  onFeedTimeChange?.(null);
                  onStarterStateChange?.('rt_fed');
                  setSimpleStarterUncertain(false); setSimpleReadyObserved(true); setShowStarterDetails(false);
                }}>{isFr ? 'Oui, il est prêt maintenant' : 'Yes, ready now'}</button>
                <button type="button" style={{ ...starterPillButton(simpleStarterUncertain), minHeight: 44 }} onClick={() => {
                  setPlanningMode('last_fed'); onPlanningModeChange?.('last_fed');
                  setKnownPeakTime(null); onKnownPeakTimeChange?.(null);
                  setLastFedTime(null); onLastFedTimeChange?.(null);
                  setLastFedAge(null); onLastFedAgeChange?.(null);
                  onStarterPeakTimeChange?.(null);
                  onFeedTimeChange?.(null); onStarterEventsChange?.([]);
                  setSolverResult(null); setStartComputed(false);
                  setSimpleStarterUncertain(true); setSimpleReadyObserved(false); setShowStarterDetails(true);
                }}>{isFr ? 'Pas encore / Je ne sais pas' : 'Not yet / Not sure'}</button>
              </div>
              <p role="status" style={{ margin: 0 }}>{simpleStarterUncertain
                ? (isFr ? 'Prochaine étape : indiquez ci-dessous son dernier repas. S’il ne monte pas encore, nourrissez-le selon votre routine et attendez une montée nette avant de confirmer qu’il est prêt. L’horaire reste à vérifier.' : 'Next: enter its last feed below. If it is not rising yet, feed it using your usual routine and wait for a clear rise before confirming readiness. Timing still needs checking.')
                : planningMode === 'know_peak' && knownPeakTime
                  ? (isFr ? `${simpleReadyObserved?'Levain déclaré prêt à':'Levain attendu prêt à'} ${fmtCardDT(knownPeakTime, true)}. Consultez le créneau de mélange ci-dessous ; prêt maintenant ne garantit pas du pain ce soir.` : `${simpleReadyObserved?'Starter reported ready at':'Starter expected ready at'} ${fmtCardDT(knownPeakTime)}. Check the mixing window below; ready now does not guarantee bread tonight.`)
                  : (isFr ? 'Prochaine étape : vérifiez votre levain, puis choisissez une réponse.' : 'Next: check your starter, then choose an answer.')}</p>
              <p style={{ margin: 0, color: 'var(--smoke)' }}>{isFr
                ? `Cuisine : ${kitchenTemp} °C. Vérifiez les signes de levée plus tôt s’il fait chaud ; les heures restent des estimations.`
                : `Kitchen: ${kitchenTemp}°C. Check rising signs earlier in a warm kitchen; times remain estimates.`}</p>
              <button type="button" aria-expanded={showStarterDetails} onClick={() => {setShowStarterDetails(v => !v);setSimpleReadyObserved(false);}} style={{ ...starterPillButton(false), minHeight: 44 }}>
                {showStarterDetails ? (isFr ? 'Masquer les détails du levain' : 'Hide starter details') : (isFr ? 'Autre horaire / détails du levain' : 'Other timing / starter details')}
              </button>
            </div>
          )}
          {(mode !== 'simple' || showStarterDetails) && <div style={{ display: 'grid', gap: '16px' }}>
          {/* ── Q1: Where has it been since last fed? ── */}
          <div>
            <div style={STARTER_LABEL_STYLE}>
              {isFr ? 'Où était-il depuis son dernier repas ?' : 'Where has it been since last fed?'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
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
                        + climateRtH(sfDef.rtH, kitchenTemp, isSourdough) + (sfDef.minTotalFermH ?? 12)) / 2;
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={STARTER_LABEL_STYLE}>
                {/* For a fridge starter, time-since-feed and time-in-fridge are
                    the same clock (fed, then chilled) — and fridge time is what
                    bakers actually remember. Label only; `lastFedAge` is
                    unchanged, so the engine reads exactly the same value. */}
                {starterLocation === 'fridge'
                  ? (isFr ? 'DEPUIS QUAND EST-IL AU FRIGO ?' : 'HOW LONG HAS IT BEEN IN THE FRIDGE?')
                  : (isFr ? 'QUAND A-T-IL ÉTÉ NOURRI ?' : 'WHEN WAS IT LAST FED?')}
              </div>

              {/* Age chips — always visible */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                      padding: '4px 12px',
                      borderRadius: '20px',
                      border: `1.5px solid ${lastFedAge === chip.id ? 'var(--terra)' : 'var(--border)'}`,
                      background: lastFedAge === chip.id ? '#FEF4EF' : 'transparent',
                      color: lastFedAge === chip.id ? 'var(--terra)' : 'var(--smoke)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '13px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '.1rem' }}>
                  <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
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
                      fontFamily: 'var(--font-ui)',
                      fontSize: '13px',
                      padding: '4px 8px',
                      borderRadius: '16px',
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
                <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                  {starterLocation === 'fridge'
                    ? (isFr
                        ? 'Le plan ci-dessous indiquera quand sortir votre levain.'
                        : 'The plan below will tell you when to take it out.')
                    : (isFr
                        ? "Votre levain a besoin d'être nourri — le plan vous guidera."
                        : 'Your starter needs feeding — the plan will guide you.')}
                </div>
              )}

              {/* ── Last feed ratio (belongs to the feed) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {!lastFeedRatioEditing ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontFamily: 'var(--font-ui)', fontSize: '12px',
                    color: 'var(--smoke)',
                  }}>
                    <span>
                      {isFr ? `Nourri à 1:${lastFeedRatio}:${lastFeedRatio}` : `Fed at 1:${lastFeedRatio}:${lastFeedRatio}`}
                    </span>
                    <button
                      onClick={() => setLastFeedRatioEditing(true)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
                        fontSize: '12px',
                        textDecoration: 'underline', textUnderlineOffset: '2px',
                        padding: 0,
                      }}
                    >
                      {isFr ? 'modifier →' : 'change →'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ ...STARTER_LABEL_STYLE, marginBottom: 0 }}>
                        {isFr ? 'Ratio du dernier nourrissage' : 'Last feed ratio'}
                      </div>
                    </div>
                    {/* Shown, not hidden behind a dot: it is one line, and it
                        answers the question the label raises. */}
                    <div style={{ fontSize: '11.5px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', lineHeight: 1.45, marginBottom: '8px' }}>
                      {isFr
                        ? "Levain : eau : farine. Le ratio de votre dernier rafraîchi — il place la courbe historique."
                        : 'Starter : water : flour. The ratio of your last feed — it places the historical curve.'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {([1, 2, 4, 5, 10] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => {
                            setLastFeedRatio(r);
                            onLastFeedRatioChange?.(r);
                            setLastFeedRatioEditing(false);
                          }}
                          style={{
                            padding: '4px 12px', borderRadius: '20px',
                            border: `1.5px solid ${lastFeedRatio === r ? 'var(--bread)' : 'var(--border)'}`,
                            background: lastFeedRatio === r ? 'rgba(139,105,20,0.10)' : 'transparent',
                            color: lastFeedRatio === r ? 'var(--bread)' : 'var(--smoke)',
                            fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer',
                          }}
                        >
                          1:{r}:{r}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setLastFeedRatioEditing(false)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
                        fontSize: '12px',
                        textDecoration: 'underline', textUnderlineOffset: '2px',
                        padding: 0, alignSelf: 'flex-start', marginTop: '.2rem',
                      }}
                    >
                      {isFr ? 'terminé' : 'done'}
                    </button>
                  </>
                )}
              </div>

              {/* ── Ratio mode (Recommend best | Keep my usual) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.1rem' }}>
                  <div style={{ ...STARTER_LABEL_STYLE, marginBottom: 0 }}>
                    {isFr ? 'Ratio pour cette fournée' : 'Feed ratio for this bake'}
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', lineHeight: 1.45 }}>
                  {isFr
                    ? "Un rafraîchi plus fort ou plus léger peut décaler le pétrissage hors de vos heures bloquées — même levain, autre timing."
                    : 'A stronger or lighter feed can move your mix out of your blocked hours — same starter, different timing.'}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {([
                    { id: 'recommend', en: 'Optimized',          fr: 'Optimisé' },
                    { id: 'keep',      en: 'Same as last feed',  fr: 'Comme le dernier rafraîchi' },
                  ] as { id: 'recommend' | 'keep'; en: string; fr: string }[]).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setRatioMode(opt.id);
                        onRatioModeChange?.(opt.id);
                        if (opt.id === 'keep') {
                          // Clear any prior override + force nextFeedRatio = lastFeedRatio
                          setNextFeedRatioOverride(null);
                          onNextFeedRatioOverrideChange?.(null);
                          if (nextFeedRatio !== lastFeedRatio) {
                            setNextFeedRatio(lastFeedRatio);
                            onNextFeedRatioChange?.(lastFeedRatio);
                          }
                        }
                      }}
                      // Match sibling pills (lastFeedRatio chips) — no bold on
                      // selected, so this toggle doesn't pop out more than its
                      // neighbours in the setup section.
                      style={{
                        padding: '4px 12px', borderRadius: '20px',
                        border: `1.5px solid ${ratioMode === opt.id ? 'var(--bread)' : 'var(--border)'}`,
                        background: ratioMode === opt.id ? 'rgba(139,105,20,0.10)' : 'transparent',
                        color: ratioMode === opt.id ? 'var(--bread)' : 'var(--smoke)',
                        fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer',
                      }}
                    >
                      {isFr ? opt.fr : opt.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Maturity + rye ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={STARTER_LABEL_STYLE}>
              {isFr ? 'Comment est-il en forme ?' : 'How active is it?'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                { value: true,  label: isFr ? 'Actif & en forme' : 'Active & healthy' },
                { value: false, label: isFr ? 'Jeune (<6 mois)' : 'Young (<6 months)' },
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
                  padding: '4px 12px', borderRadius: '20px',
                  border: `1.5px solid ${starterHasRye ? 'var(--sage)' : 'var(--border)'}`,
                  background: starterHasRye ? 'rgba(107,122,90,0.08)' : 'transparent',
                  color: starterHasRye ? 'var(--sage)' : 'var(--smoke)',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
                }}
              >
                {isFr ? 'Levain de seigle' : 'Rye starter'}
              </button>
            </div>
          </div>

          {/* ── Mode B toggle link / picker ── */}
          {planningMode === 'last_fed' && (
            <button
              onClick={() => {
                setPlanningMode('know_peak');
                onPlanningModeChange?.('know_peak');
                if (!knownPeakTime) {
                  const seed = new Date();
                  seed.setDate(seed.getDate() + 1);
                  seed.setHours(9, 0, 0, 0);
                  setKnownPeakTime(seed);
                  onKnownPeakTimeChange?.(seed);
                }
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--smoke)', fontSize: '11px',
                fontFamily: 'var(--font-ui)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                padding: 0, alignSelf: 'flex-start',
              }}
            >
              {isFr ? 'Je sais quand mon levain sera à son pic →' : 'I know when my starter will peak →'}
            </button>
          )}

          {planningMode === 'know_peak' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={STARTER_LABEL_STYLE}>
                  {isFr ? 'À quelle heure votre levain est-il à son pic ?' : 'When does your starter peak?'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '4px' }}>
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
                  color: 'var(--smoke)', fontSize: '11px',
                  fontFamily: 'var(--font-ui)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  padding: 0, alignSelf: 'flex-start',
                }}
              >
                {isFr ? '← Retour' : '← Back'}
              </button>
            </div>
          )}

          {/* ── Tang taste control (setup input, not card output) ── */}
          {_tangRelevant && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {isFr ? 'GOÛT' : 'TASTE'}
                </span>
                <button
                  onClick={() => setShowTasteInfo(v => !v)}
                  aria-label={isFr ? 'En savoir plus' : 'Learn more'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--smoke)', padding: 0,
                    fontFamily: 'var(--font-ui)',
                    fontSize: '11px', lineHeight: 1,
                  }}
                >ⓘ</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['mild', 'balanced', 'tangy'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { onTangChange?.(t); }}
                    style={{
                      padding: '4px 12px', borderRadius: '20px',
                      border: `1.5px solid ${tang === t ? 'var(--bread)' : 'var(--border)'}`,
                      background: tang === t ? 'rgba(139,105,20,0.10)' : 'transparent',
                      color: tang === t ? 'var(--bread)' : 'var(--smoke)',
                      fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    {t === 'mild'
                      ? (isFr ? 'Plus doux' : 'Milder')
                      : t === 'balanced'
                      ? (isFr ? 'Équilibré' : 'Balanced')
                      : (isFr ? 'Plus acidulé' : 'Tangier')}
                  </button>
                ))}
              </div>
              {showTasteInfo && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                  {t('taste.info')}
                </div>
              )}
            </div>
          )}

          </div>}
        </div>
      )}

      </div>)}

      {eatTimeSet && (<div>

      {/* Blocker section — always visible */}
      <div ref={availabilityControlsRef} tabIndex={-1} role="group" aria-label={isFr ? 'Mes disponibilités' : 'My availability'} style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--char)', marginBottom: '8px' }}>
          {isFr
            ? 'Bloquez vos indisponibilités — nous planifions autour.'
            : <>Block your unavailable times — we&apos;ll plan around them.</>}
        </div>
        <div>

      {/* Quick presets — all toggles on one row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', width: '100%', overflow: 'visible', paddingLeft: 0 }}>
        {(
          <button
            onClick={toggleWork}
            style={{
              padding: '8px 12px', minHeight: '44px', borderRadius: '20px',
              border: `1.5px solid ${isWorkActive ? 'var(--terra)' : 'var(--border)'}`,
              background: isWorkActive ? '#FEF4EF' : 'var(--warm)',
              color: isWorkActive ? 'var(--terra)' : 'var(--smoke)',
              fontSize: '12px', fontWeight: isWorkActive ? 500 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
              transition: 'all .15s',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {t('blockers.weekdays')}
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', opacity: .65 }}>
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
                padding: '8px 12px', minHeight: '44px', borderRadius: '20px',
                border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                background: active ? '#FEF4EF' : 'var(--warm)',
                color: active ? 'var(--terra)' : 'var(--smoke)',
                fontSize: '12px', fontWeight: active ? 500 : 400,
                cursor: 'pointer', fontFamily: 'var(--font-ui)',
                transition: 'all .15s',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t('blockers.nights')}
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', opacity: .65 }}>
                {t('blockers.nightHoursLabel')}
              </span>
              {active && <span style={{ opacity: .7 }}>✓</span>}
            </button>
          );
        })()}

        <button
          onClick={() => setShowCustom(v => !v)}
          style={{
            padding: '8px 12px', borderRadius: '20px',
            border: `1.5px solid ${showCustom ? 'var(--terra)' : 'var(--border)'}`,
            background: showCustom ? '#FEF4EF' : 'var(--warm)',
            color: showCustom ? 'var(--terra)' : 'var(--smoke)',
            fontSize: '12px', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', transition: 'all .15s',
          }}
        >
          {showCustom ? t('blockers.cancel') : t('blockers.addCustom')}
        </button>
      </div>

      {/* Custom block form */}
      {showCustom && (
        <div style={{
          border: '1.5px solid var(--border)', borderRadius: '16px',
          padding: '16px 16px', background: 'var(--warm)',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--char)', marginBottom: '12px' }}>
            {t('blockers.customTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder={t('blockers.customLabelPlaceholder')}
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1.5px solid var(--border)', borderRadius: '8px',
                background: 'var(--card)', color: 'var(--char)',
                fontSize: '13px', fontFamily: 'var(--font-ui)', outline: 'none',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '8px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px' }}>
                  {t('blockers.from')}
                </div>
                <input
                  type="datetime-local"
                  step={900}
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{
                    width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
                    padding: '8px 8px',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--card)', color: 'var(--char)',
                    fontSize: '12px', fontFamily: 'var(--font-ui)', outline: 'none',
                  }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px' }}>
                  {t('blockers.to')}
                </div>
                <input
                  type="datetime-local"
                  step={900}
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{
                    width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
                    padding: '8px 8px',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--card)', color: 'var(--char)',
                    fontSize: '12px', fontFamily: 'var(--font-ui)', outline: 'none',
                  }}
                />
              </div>
            </div>
            <button
              onClick={addCustomBlock}
              disabled={!customReady}
              style={{
                alignSelf: 'flex-start', padding: '8px 16px', minHeight: '44px',
                border: 'none', borderRadius: '12px',
                background: customReady ? 'var(--terra)' : 'var(--border)',
                color: customReady ? '#fff' : 'var(--smoke)',
                fontSize: '13px', fontWeight: 500,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
          {blocks.filter((block) => {
            const isNightBlock = block.label.endsWith(' night');
            const isWorkBlock = block.label.startsWith('Work · ');
            return !isNightBlock && !isWorkBlock;
          }).map((block, i) => {
            const durationH = (block.to.getTime() - block.from.getTime()) / 3600000;
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px',
                  background: '#FEF4EF', border: '1.5px solid var(--terra)',
                  borderRadius: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--terra)' }}>
                    {block.label}
                  </span>
                  <span style={{ opacity: .7, marginLeft: '.3rem', fontSize: '13px' }}>✓</span>
                  <span style={{
                    marginLeft: '.5rem', fontSize: '12px',
                    color: 'var(--terra)', opacity: .75, fontFamily: 'var(--font-ui)',
                  }}>
                    {formatTimeShort(block.from, isFr)} → {formatTimeShort(block.to, isFr)}
                  </span>
                  <span style={{
                    marginLeft: '.35rem', fontSize: '11px',
                    color: 'var(--terra)', opacity: .5, fontFamily: 'var(--font-ui)',
                  }}>
                    ({hoursLabel(durationH)})
                  </span>
                </div>
                <button
                  onClick={() => removeBlock(i)}
                  title="Remove"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--smoke)', fontSize: '13px',
                    padding: '.15rem 4px', borderRadius: '4px',
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
          borderRadius: '16px',
          border: '1.5px solid var(--border)',
          padding: '16px 20px',
          marginBottom: '16px',
          fontFamily: 'var(--font-ui)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
            {isFr ? 'Pas assez de temps pour ce créneau' : 'Not enough time for this bake'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--smoke)', lineHeight: 1.55 }}>
            {isFr
              ? `Il faut au moins ${Math.ceil(minTotalRTRef.current)}h entre maintenant et la cuisson.`
              : `You need at least ${Math.ceil(minTotalRTRef.current)}h between now and your bake.`}
          </div>
          {isSourdough && bakeType === 'bread' && suggestedBakeTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
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
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: '1.5px solid var(--terra)',
                  background: '#FEF4EF',
                  color: 'var(--terra)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {fmtCardDT(suggestedBakeTime, isFr)} →
              </button>
            </div>
          )}
          {!isSourdough && bakeType === 'bread' && suggestedBakeTimeBread && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
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
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: '1.5px solid var(--terra)',
                  background: '#FEF4EF',
                  color: 'var(--terra)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {fmtCardDT(suggestedBakeTimeBread, isFr)} →
              </button>
            </div>
          )}
          {bakeType === 'pizza' && (
            <div style={{ fontSize: '13px', color: 'var(--smoke)' }}>
              {isFr ? 'Essayez un créneau plus tardif — ou commandez une pizza ce soir.'
                     : 'Try a later time — or order in tonight.'}
            </div>
          )}
        </div>
      )}

      {simpleKnownPeakConflict && eatTimeSet && <p role="alert" style={{fontSize:15,color:'var(--terra)',lineHeight:1.5}}>{isFr
        ? 'Votre levain prêt à l’heure indiquée ne peut pas attendre jusqu’à ce mélange sans nouveau rafraîchi. Prochaine étape : choisissez « Autre horaire / détails du levain » pour planifier un rafraîchi, ou rapprochez la cuisson. La recette reste bloquée tant que ce créneau n’est pas compatible.'
        : 'Your starter cannot wait from the stated peak until this mix without another feed. Next: choose “Other timing / starter details” to plan a feed, or move baking earlier. The recipe stays blocked until this timing is compatible.'}</p>}
      {guardNote && !windowTooShort && eatTimeSet && (
        <div style={{
          fontSize: '13px',
          color: 'var(--smoke)',
          lineHeight: 1.55,
          padding: '8px 0',
          fontFamily: 'var(--font-ui)',
        }}>
          {guardNote}
        </div>
      )}

      {startComputed && (<>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '1.1rem 0 1rem' }} />

      {hasPrefActive && !commercialPrefValid && <p role="alert" style={{fontSize:14,color:'var(--terra)',lineHeight:1.5}}>{isFr
        ? `Le créneau ne permet pas de préparer ${prefermentType === 'biga' ? 'la biga' : 'le poolish'} avant le mélange sans conflit. Décalez la cuisson ou modifiez les disponibilités.`
        : `This window cannot fit ${prefermentType === 'biga' ? 'biga' : 'poolish'} before mixing without a conflict. Move the bake time or adjust busy times.`}</p>}

      {restoredPrepOverdue && <p role="status" style={{fontSize:14,color:'var(--terra)',lineHeight:1.5}}>{isFr
        ? 'L’heure prévue de préparation du préferment est passée. Si vous ne l’avez pas préparé, choisissez un nouveau planning.'
        : 'The planned preferment preparation time has passed. If you have not prepared it, choose a new schedule.'}</p>}



      {/* Fermentation chart stays separate from the action list. */}
      {isSourdough && planningMode === 'last_fed' && lastFedAge === null && (
        <div style={{
          padding: '24px 20px',
          textAlign: 'center',
          color: 'var(--smoke)',
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          lineHeight: 1.6,
        }}>
          {isFr
            ? 'Indiquez quand votre levain a été nourri pour voir votre plan.'
            : 'Tell us when your starter was last fed to see your plan.'}
        </div>
      )}
      <div hidden style={{ marginBottom: startInvalid ? '.5rem' : '1rem' }}>
      {scheduleView === 'graph' && <>
        <div style={{ fontSize: '11px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)', marginBottom: '8px' }}>
          {(hasDragged || appliedSuggestion !== null)
            ? t('schedulerTitle.yours')
            : t('schedulerTitle.recommended')}
        </div>
        {startComputed ? (
            <FermentChart
              eatTime={pendingEatTime}
              prefermentType={isSourdough ? 'sourdough' : prefermentType}
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
              doughColdIntervals={scheduleColdIntervals(schedule)}
              prefermentFridgeOutTime={prefRemoveFromFridgeTime}
              scheduleNote={schedule?.scheduleNote ?? null}
              blocks={isSourdough ? localBlocks : blocks}
              recommendedMixHBF={recommendedHBF}
              focusId={focusRow}
              showReset={(hasDragged || nextFeedRatioOverride !== null || appliedSuggestion !== null) && !startTimeInPast}
              onReset={resetToRecommendation}
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
              starterEvents={isSourdough ? displayStarterEvents : []}
              startTimeInPast={startTimeInPast}
              onMixChange={(h) => {
                hasManuallyDragged.current = true;
                setHasDragged(true);
                setRecommendedHBF(null);
                // Fresh user action = fresh ratio-convergence chain.
                ratioApplyHistoryRef.current.length = 0;
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
                  // Pin the dragged mix so effect-triggered re-solves (ratio
                  // apply, refresh drags) keep honoring it — pendingStart
                  // alone was recomputed away on the next solve.
                  manualMixRef.current = newStart.getTime();
                  findOptimalPositionSourdough(pendingEatTime, newStart);
                }
              }}
              onPrefChange={(offsetH) => {
                hasManuallyDragged.current = true;
                setHasDragged(true);
                ratioApplyHistoryRef.current.length = 0;
                setPrefAlgoRed(false);
                if (isSourdough) {
                  const bakeMs = pendingEatTime.getTime();
                  const feedAbsHBF = mixOffsetH + offsetH;
                  let newFeedTime = new Date(bakeMs - feedAbsHBF * 3600000);
                  // Clamp dragged feeds to the future — a now-pinned feed can
                  // be dragged forward, never into the past.
                  const _nowFloor = Math.ceil(Date.now() / (15 * 60000)) * (15 * 60000);
                  if (newFeedTime.getTime() < _nowFloor) newFeedTime = new Date(_nowFloor);
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
                    // PIN the dragged pre-mix — never rewrite the lastFedTime
                    // input. That mutation survived Reset, so “Reset to
                    // recommendation” returned a different plan than the
                    // original (sweep run 1: reset:Next Feed DIVERGED).
                    onFeedTimeChange?.(newFeedTime);
                    manualFeed2Ref.current = newFeedTime.getTime();
                    findOptimalPositionSourdough(pendingEatTime, undefined, solverBlocksRef.current);
                  }
                } else {
                  setPrefOffsetH(offsetH);
                  onPrefOffsetChange?.(offsetH);
                }
              }}
              onRefreshChange={(absHBF) => {
                hasManuallyDragged.current = true;
                setHasDragged(true);
                ratioApplyHistoryRef.current.length = 0;
                const _step = 15 * 60000;
                let _t = Math.round((pendingEatTime.getTime() - absHBF * 3600000) / _step) * _step;
                // Floors: the future (+ fridge warmup — a cold starter can't
                // take a warm feed earlier). Ceiling: 30 min before mix.
                const _minT = Math.ceil(Date.now() / _step) * _step
                  + (starterLocation === 'fridge' ? getStarterFridgeWarmupH(kitchenTemp) * 3600000 : 0);
                // Ceiling: the refresh peak (~adjPeakH after the feed) must
                // still be reachable before mix — not just "30 min before".
                const _halfPeakH = Math.max(1, (solverResult?.adjPeakHValue ?? 4) * 0.5);
                const _maxT = pendingStart.getTime() - _halfPeakH * 3600000;
                if (_t < _minT) _t = _minT;
                if (_t > _maxT) _t = _maxT;
                manualRefreshRef.current = _t;
                findOptimalPositionSourdough(pendingEatTime, undefined, solverBlocksRef.current);
              }}
            />
        ) : (
          <div style={{
            textAlign: 'center', fontFamily: 'var(--font-ui)',
            fontSize: '14px', color: 'var(--smoke)',
            padding: '24px 0', letterSpacing: '.01em',
          }}>
            {t('setByPlan')}
          </div>
        )}

      </>}
      </div>

      {eatTimeSet && (
        <div style={{ marginTop: '8px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Actions have their own reset; the graph retains its existing control. */}
          {scheduleView === 'actions' && keyAdjusted && editingRow===null && !startTimeInPast && (
            <button
              onClick={resetToRecommendation}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: '20px',
                background: 'var(--cream)',
                color: 'var(--ash)',
                fontSize: '12px',
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden="true" style={{ color: 'var(--terra)' }}>↺</span>
              {locale === 'fr' ? 'Revenir à la recommandation' : 'Reset to recommendation'}
            </button>
          )}

          {/* Read-only note — past sessions */}
          {startTimeInPast && (
            <div style={{
              fontSize: '12px', color: 'var(--smoke)',
              fontFamily: 'var(--font-ui)',
              textAlign: 'center', padding: '8px 0',
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
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '12px',
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
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
          borderRadius: '16px', padding: '12px 16px',
          marginBottom: '12px', fontFamily: 'var(--font-ui)',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--char)', marginBottom: '8px' }}>
            No free mixing window found
          </div>
          <div style={{ fontSize: '13px', color: 'var(--smoke)', marginBottom: '12px', lineHeight: 1.5 }}>
            Your blocked times don&apos;t leave a clear mixing window. Here are your options:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
                  borderRadius: '12px', padding: '8px 16px', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  marginBottom: '8px',
                }}
              >
                <div>{tRoot('schedulePicker.fallbackBtn1')}</div>
                <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>{tRoot('schedulePicker.fallbackBtn1Sub')}</div>
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
                  borderRadius: '12px', padding: '8px 16px', fontSize: '12px',
                  cursor: 'pointer', textAlign: 'left',
                  marginBottom: '12px',
                }}
              >
                <div>{tRoot('schedulePicker.fallbackBtn2')}</div>
                <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>{tRoot('schedulePicker.fallbackBtn2Sub')}</div>
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
                border: 'none', fontSize: '12px', cursor: 'pointer', padding: '8px 0',
              }}
            >
              I&apos;ll set it myself
            </button>
          </div>
        </div>
      )}

      {/* Availability conflicts and verified repairs are presented once, in
          the shared summary above the tabs. No unchecked phase-only shifts. */}

      {/* Both modes use the full action list, including starter and preferment actions. */}
      <div>
      {startComputed && scheduleView === 'actions' && (() => {
        const isLevainType = prefermentType === 'levain' || isSourdough;
        const cardPrefColor = isLevainType ? '#4A7FA5' : '#C4A030';
        // The pref/mix ZONE-TIER computation (green/gold/red bands and their
        // status strings) lived here and fed the pills on the old boxed cards.
        // The list has no pills: green pills confirming the engine's own work
        // were the largest source of noise. The window bounds below are still
        // needed — they drive the chart's window lane and the "room to move"
        // note on a selected row.
        const cardPrefTime = hasPrefActive
          ? new Date(pendingEatTime.getTime() - (mixOffsetH + prefOffsetH) * 3600000)
          : null;
        const doughZoneFrom = isSourdough && solverResult?.sourdoughSweetFrom !== null && solverResult?.sourdoughSweetFrom !== undefined
          ? solverResult.sourdoughSweetFrom : renderSweetFrom;
        const doughZoneTo   = isSourdough && solverResult?.sourdoughSweetTo !== null && solverResult?.sourdoughSweetTo !== undefined
          ? solverResult.sourdoughSweetTo : renderSweetTo;
        const bakeMs = pendingEatTime.getTime();
        // ── Build the plan list ──────────────────────────────
        // One row per event in chronological order, including Bake and Out of
        // fridge — both were previously missing or buried in the cards.
        const _blocks = isSourdough ? localBlocks : blocks;
        const inAnyBlocker = (d: Date) => isTimeBlocked(d, _blocks);
        const rows: PlanRow[] = [];

        // Estimated history renders day-only — the minute is fiction.
        const dayOnly = (d: Date) =>
          `≈ ${d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' })}`;

        const busyNote = (id: string, at: Date): React.ReactNode | undefined => {
          if (!inAnyBlocker(at) && !readinessConflicts.some(conflict => conflict.action.id === id)) return undefined;
          return isFr ? 'Cette étape chevauche une indisponibilité. Vérifiez le planning ci-dessus.'
            : 'This step overlaps an unavailable period. Review the plan above.';
        };

        const appliedNote = (id: string): React.ReactNode | undefined => {
          if (appliedSuggestion?.id !== id) return undefined;
          return (
            <span style={{ color: '#4A7A3A' }}>
              {tRoot('schedulePicker.movedClear')}
              <button
                onClick={() => undoSuggestedTime()}
                style={{
                  marginLeft: '7px', fontSize: '11px', color: 'var(--smoke)',
                  textDecoration: 'underline', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, fontFamily: 'var(--font-ui)',
                }}
              >{tRoot('schedulePicker.undo')}</button>
            </span>
          );
        };

        // Window guidance lives in the shared readiness panel, with full dates.
        // Row notes retain applied suggestions and availability conflicts only.
        const noteFor = (id: string, at: Date): React.ReactNode | undefined =>
          appliedNote(id) ?? busyNote(id, at);

        // 1 — sourdough starter events (history + feeds + fridge consequences)
        if (isSourdough && displayStarterEvents.length) {
          for (const ev of displayStarterEvents) {
            const isHist = ev.isPast && !ev.isActive;
            const timeText = ev.kind === 'fridge_out'
              ? fmtCardDT(ev.time, isFr)
              : ev.cardTimeFormat === 'relative'
                ? (() => {
                    const fifteen = 15 * 60 * 1000;
                    const rounded = new Date(Math.ceil(ev.time.getTime() / fifteen) * fifteen);
                    return `${tRoot('schedulePicker.nowPrefix')} · ${fmtCardHM(rounded, isFr)}`;
                  })()
                : ev.timeIsEstimate && ev.isPast
                  ? dayOnly(ev.time)
                  : `${ev.timeIsEstimate ? '≈ ' : ''}${fmtCardDT(ev.time, isFr)}`;
            const isCold = ev.kind === 'fridge_out' || ev.kind === 'fridge_in';
            rows.push({
              id: `ev:${displayStarterEvents.indexOf(ev)}`,
              at: ev.time.getTime(),
              name: ev.label,
              timeText,
              marker: isCold ? 'cold' : isHist ? 'history' : 'step',
              color: isCold ? '#5B87AD' : '#4A7FA5',
              editable: !isCold && !isHist && ev.isDraggable,
              isHistory: isHist,
              note: isCold || isHist ? undefined
                : noteFor(`ev:${displayStarterEvents.indexOf(ev)}`, ev.time),
            });
          }
        }

        // 2 — preferment (poolish / biga)
        if (!isSourdough && cardPrefTime) {
          rows.push({
            id: 'pref',
            at: cardPrefTime.getTime(),
            name: prefLabel,
            timeText: fmtCardDT(cardPrefTime, isFr),
            marker: 'step',
            color: cardPrefColor,
            editable: true,
            note: noteFor('pref', cardPrefTime),
          });
        }

        if(!isSourdough&&cardPrefTime&&prefGoesInFridge&&prefRTWarmupH>0&&prefRemoveFromFridgeTime){
          rows.push({id:'pref-out',at:+prefRemoveFromFridgeTime,name:isFr?'Sortir le préferment du réfrigérateur':'Take preferment out of the fridge',timeText:fmtCardDT(prefRemoveFromFridgeTime,isFr),marker:'cold',color:'#5B87AD',editable:false,waitLabel:isFr?'Retour à température':'Warming up'});
        }

        // 3 — Start Dough
        rows.push({
          id: 'mix',
          at: pendingStart.getTime(),
          name: tRoot('schedulePicker.startDough'),
          timeText: fmtCardDT(pendingStart, isFr),
          marker: 'step',
          color: '#3D5A30',
          editable: !startTimeInPast,
          waitLabel:isFr?'Repos de la pâte':'Dough rest',
          endAt: schedule?.availabilityActions?.find(a=>a.id==='mix')?.end?.getTime(),
          note: <>{noteFor('mix', pendingStart)}{readinessPanel}</>,
        });

        // Derived hands-on actions stay visible, using the protocol's canonical times.
        for(const action of schedule?.availabilityActions ?? []) {
          if(action.id === 'mix' || action.id === 'bake' || +action.at < +pendingStart || +action.at > +pendingEatTime) continue;
          rows.push({id:`dough:${action.id}`,at:+action.at,endAt:action.id==='preheat'?+action.at+preheatMin*60000:action.end ? +action.end : undefined,
            name:(conflictNames[action.id] ?? ['Étape','Step'])[isFr?0:1],timeText:fmtCardDT(action.at,isFr),
            waitLabel:action.id==='cold-in'||action.id==='cold-in-2'?(isFr?'Fermentation au réfrigérateur':'Fermentation in the fridge'):action.id==='preheat'?(isFr?'Préchauffage du four':'Oven preheating'):action.id==='mix-finish'||action.id==='cold-out-2'?(isFr?'Levée à température ambiante':'Rise at room temperature'):action.id==='mix'?(isFr?'Repos de la pâte':'Dough rest'):undefined,
            marker:action.id.startsWith('cold')?'cold':'step',color:action.id.startsWith('cold')?'#5B87AD':'#3D5A30',editable:false,
            note:noteFor(action.id,action.at)});
        }

        // 5 — Bake
        rows.push({
          id: 'bake',
          at: pendingEatTime.getTime(),
          name: isFr ? 'Début de cuisson' : 'Start baking',
          waitLabel: readyOffset ? (isFr ? 'Cuisson et repos avant dégustation' : 'Cooking and resting before serving') : undefined,
          timeText: fmtCardDT(pendingEatTime, isFr),
          marker: 'bake',
          color: '#7A4A22',
          editable: !startTimeInPast,
        });

        if(readyOffset) rows.push({id:'ready',at:+pendingEatTime+readyOffset*60000,name:readyTimeLabel??(isFr?'Prêt':'Ready'),timeText:fmtCardDT(new Date(+pendingEatTime+readyOffset*60000),isFr),marker:'bake',color:'#7A4A22',editable:false});
        for(const row of rows) if(row.id==='pref')row.waitLabel=isFr?'Maturation du préferment':'Preferment maturation';
        rows.sort((a, b) => a.at - b.at);

        const editedRow=rows.find(r=>r.id===editingRow);
        const draft=new Date(draftRowTime);
        const changed=!!editedRow&&(+draft!==editedRow.at||editBaseTimes!==null);
        const prefOpt=getPrefOptH(prefermentType,kitchenTemp,prefGoesInFridge,styleKey,fridgeTemp);
        const prefZone=prefZoneConstants(prefermentType,prefGoesInFridge,kitchenTemp);
        const prefWindow=!isSourdough&&hasPrefActive?{
          min:Math.max(prefermentType==='biga'?12:prefGoesInFridge?3:1,prefOpt-(prefGoesInFridge?prefZone.plateauLowH:prefZone.rtTol)),
          max:Math.min(prefermentType==='biga'?72:prefGoesInFridge?24:16,prefOpt+(prefGoesInFridge?prefZone.plateauH:prefZone.rtTolUpper)),
        }:undefined;
        const editInput:EditInput={
          id:editingRow??'',at:draft,start:editBaseTimes?.start??pendingStart,bake:alternativeBake??editBaseTimes?.bake??pendingEatTime,now:Date.now(),
          blocks:repairBlocks,kitchenTemp,preheatMin,mixerType,styleKey,numItems,
          prefHours:editBaseTimes?.prefHours??prefOffsetH,hasPreferment:hasPrefActive,
          prefWindow,
          prefWarmupHours:prefGoesInFridge?prefRTWarmupH:0,
          supported:!readinessUnsupported&&(!isSourdough||(planningMode==='know_peak'&&!!knownPeakTime&&displayStarterEvents.every(e=>e.kind==='known_peak'||e.kind==='last_fed'))),
          window:bake=>{
            const bounds=isSourdough?{from:readinessFromH,to:readinessToH}:commercialReadinessWindow({...(STYLE_FERM_DEFAULTS[styleKey]??FERM_FALLBACK),flourStrength,kitchenTemp,preheatMin,totalWindowH:(+bake-Date.now())/3600000});
            return {from:bounds.from!==null?new Date(+bake-bounds.from*3600000):null,to:bounds.to!==null?new Date(+bake-bounds.to*3600000):null};
          },
          methodValid:times=>isSourdough?!!knownPeakTime&&knownPeakMixUsable(times.start,knownPeakTime,getPrefPeakH_RT('sourdough',kitchenTemp,styleKey)*(starterHasRye?.8:1)*(starterMature?1:1.2)*(1+.5*Math.log(lastFeedRatio)),flourStrength):commercialPrefermentPlanValid({type:prefermentType,inFridge:prefGoesInFridge,mixTime:times.start,bakeTime:times.bake,offsetHours:times.prefHours,blocks:repairBlocks}),
          extraActions:isSourdough?methodActions(pendingStart):[],
        };
        const preview=changed?proposeScheduleEdit(editInput):null;
        const draftMix=preview&&Number.isFinite(+preview.times.start)?preview.times.start:pendingStart;
        const draftBake=preview&&Number.isFinite(+preview.times.bake)?preview.times.bake:pendingEatTime;
        const draftPrefOffset=preview&&Number.isFinite(preview.times.prefHours)?preview.times.prefHours:prefOffsetH;
        const {from:draftFrom,to:draftTo}=editInput.window(draftBake);
        const originalBounds=editInput.window(pendingEatTime);
        const sliderFrom=editingRow==='pref'&&prefWindow&&originalBounds.from?Math.max(Date.now(),+originalBounds.from-prefWindow.max*3600000):editingRow==='mix'&&originalBounds.from?Math.max(Date.now(),+originalBounds.from):Math.max(Date.now(),+(editedRow?.at??pendingEatTime)-12*3600000);
        const sliderTo=editingRow==='pref'&&prefWindow&&originalBounds.to?+originalBounds.to-prefWindow.min*3600000:editingRow==='mix'&&originalBounds.to?+originalBounds.to:+(editedRow?.at??pendingEatTime)+12*3600000;
        const setDraftAt=(at:number)=>{const d=new Date(at);setAlternativeBake(null);setDraftRowTime(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);};
        const canFindLater=changed&&preview&&!preview.valid&&!isSourdough&&['range','timing'].includes(preview.issue??'');
        const previewRows=rows.filter(row=>!row.id.startsWith('dough:')||!preview?.schedule||preview.schedule.availabilityActions?.some(a=>`dough:${a.id}`===row.id)).map(row=>{
          const action=preview?.schedule?.availabilityActions?.find(a=>`dough:${a.id}`===row.id||a.id===row.id);
          const at=row.id==='pref'?+draftMix-draftPrefOffset*3600000:row.id==='pref-out'?+draftMix-prefRTWarmupH*3600000:row.id==='ready'?+draftBake+readyOffset*60000:action?+action.at:row.at;
          return preview?.schedule?{...row,at,originalAt:at!==row.at?row.at:undefined,endAt:action?(action.id==='preheat'?+action.at+preheatMin*60000:action.end?+action.end:undefined):row.endAt,note:undefined,timeText:fmtCardDT(new Date(at),isFr)}:row;
        }).sort((a,b)=>a.at-b.at);
        // A new candidate may introduce or remove a cold phase: display its full action set.
        for(const action of preview?.schedule?.availabilityActions??[]) {
          if(action.id==='mix'||action.id==='bake'||previewRows.some(row=>row.id===`dough:${action.id}`))continue;
          previewRows.push({id:`dough:${action.id}`,at:+action.at,endAt:action.id==='preheat'?+action.at+preheatMin*60000:action.end?+action.end:undefined,name:(conflictNames[action.id]??['Étape','Step'])[isFr?0:1],timeText:fmtCardDT(action.at,isFr),marker:action.id.startsWith('cold')?'cold':'step',color:action.id.startsWith('cold')?'#5B87AD':'#3D5A30',editable:false,waitLabel:action.id==='cold-in'||action.id==='cold-in-2'?(isFr?'Fermentation au réfrigérateur':'Fermentation in the fridge'):undefined});
        }
        previewRows.sort((a,b)=>a.at-b.at);
        const duration=(hours:number)=>Math.max(0,hours).toLocaleString(isFr?'fr-FR':'en-GB',{maximumFractionDigits:1})+' h';
        const remaining=(+draftBake-+draftMix)/3600000;
        const minNeeded=draftTo?(+draftBake-+draftTo)/3600000:null;
        const maxAllowed=draftFrom?(+draftBake-+draftFrom)/3600000:null;
        const rangeExplanation=preview&&!preview.valid&&minNeeded!==null&&remaining<minNeeded
          ?(isFr?`Temps avant cuisson : ${duration(remaining)} ; ce protocole demande au moins ${duration(minNeeded)}. Il manque ${duration(minNeeded-remaining)}.`:`Time before baking: ${duration(remaining)}; this protocol needs at least ${duration(minNeeded)}. Short by ${duration(minNeeded-remaining)}.`)
          :preview&&!preview.valid&&maxAllowed!==null&&remaining>maxAllowed
          ?(isFr?`Fermentation trop longue : ${duration(remaining)} avant cuisson, au-delà de la limite conseillée de ${duration(maxAllowed)}.`:`Fermentation too long: ${duration(remaining)} before baking, beyond the recommended ${duration(maxAllowed)} limit.`):null;
        const draftMessage=preview?.issue==='busy'?(isFr?'Vous êtes indisponible pendant ':'You are unavailable during ')+(conflictNames[preview.conflict??'']??['une étape','an action'])[isFr?0:1]+'.'
          :preview?.issue==='past'?(isFr?'Ce changement placerait une préparation dans le passé. Choisissez un départ plus tardif.':'This change would put preparation in the past. Choose a later start.')
          :preview?.issue==='unsupported'?(isFr?'Ce changement nécessite de recalculer le plan du levain dans ses réglages.':'Replan the starter in its settings before changing this time.')
          :preview?.issue==='date'?(isFr?'Indiquez une date et une heure complètes.':'Enter a complete date and time.')
          :preview?.issue==='preferment'&&prefWindow?(isFr?`Maturation du préferment : ${duration(draftPrefOffset)} ; fenêtre conseillée : ${duration(prefWindow.min)}–${duration(prefWindow.max)}. Déplacez le préferment ou le pétrissage.`:`Preferment maturation: ${duration(draftPrefOffset)}; recommended window: ${duration(prefWindow.min)}–${duration(prefWindow.max)}. Move the preferment or mixing.`)
          :preview?.schedule?.bulkConflict?(isFr?`Repos avant mise au froid trop court : il manque ${preview.schedule.bulkConflict.missingMin} min. Avancez le pétrissage.`:`Rest before refrigeration is short by ${preview.schedule.bulkConflict.missingMin} min. Start mixing earlier.`)
          :preview?.schedule?.coldExitConflict?(isFr?`La sortie du réfrigérateur tombe pendant ${preview.schedule.coldExitConflict.blockLabel}. Déplacez la cuisson ou cette indisponibilité.`:`Taking the dough out overlaps ${preview.schedule.coldExitConflict.blockLabel}. Move the bake or this unavailable period.`)
          :preview&&!preview.valid?(isFr?'Aucun horaire compatible avec ce départ, vos disponibilités et la cuisson fixée.':'No schedule fits this start, your availability and the fixed bake time.'):null;
        const applyTimes=(start:Date,bake:Date,offset:number,appliedBlocks:AvailabilityBlock[]=repairBlocks)=>{
          acceptedBakeRef.current=+bake;
          hasManuallyDragged.current=true;setHasDragged(true);setRecommendedHBF(null);
          if(isSourdough){setMixOverride(true);manualMixRef.current=+start;}
          setPendingStart(start);setPendingEatTime(bake);setPrefOffsetH(offset);onPrefOffsetChange?.(offset);
          const target=new Date(+bake+readyOffset*60000);
          setPickerDate(`${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`);
          setPickerHour(target.getHours());setPickerMinute(target.getMinutes());
          setLocalBlocks(appliedBlocks);
          onChange(start,bake,appliedBlocks,{preservePlan:true,prefOffsetHours:offset});
        };
        const closeEdit=()=>{setEditingRow(null);setEditingEnabled(false);setAlternativeBake(null);setEditBaseTimes(null);};
        const saveEdit=()=>{
          if(!changed)return;
          const checked=proposeScheduleEdit(editInput);if(!checked.valid)return;
          setUndoTimes({start:pendingStart,bake:pendingEatTime,offset:prefOffsetH,blocks:localBlocks});
          applyTimes(checked.times.start,checked.times.bake,checked.times.prefHours);closeEdit();
        };
        const hour=3600000,step=900000;
        const originalSignature=JSON.stringify([+pendingStart,+pendingEatTime,prefOffsetH,displayStarterEvents.map(e=>[e.kind,+e.time])]);
        const captureBaseline=()=>{if(keyBaselineRef.current===null)keyBaselineRef.current=originalSignature;};
        const displayedTimes={start:draftMix,bake:draftBake,prefHours:draftPrefOffset};
        const slotInput={...editInput,...displayedTimes};
        const commercialChange=(id:string,at:number)=>{
          captureBaseline();
          if(id!==editingRow){beginRowEdit(id,at);setEditBaseTimes(displayedTimes);}else setDraftAt(at);
        };
        // Starter edits go through the joint starter solver, not the commercial
        // preferment window. Observed feeds/peaks stay immutable.
        type Pins={mix:number|null;feed:number|null;refresh:number|null};
        const basePins:Pins=starterPins??{mix:+pendingStart,feed:manualFeed2Ref.current,refresh:manualRefreshRef.current};
        const evaluateStarter=(pins:Pins)=>{
          const probe:StarterProbe={...pins,result:null,start:new Date(pins.mix??+pendingStart),effects:[]};
          findOptimalPositionSourdough(pendingEatTime,new Date(pins.mix??+pendingStart),repairBlocks,probe);
          const result=probe.result;
          const future=result?.starterEvents.filter(e=>e.kind!=='last_fed'&&e.kind!=='known_peak')??[];
          const requestedFeed=pins.feed===null||future.some(e=>e.kind==='pre_mix'&&Math.abs(+e.time-pins.feed!)<60000);
          const requestedRefresh=pins.refresh===null||future.some(e=>e.kind==='refresh'&&Math.abs(+e.time-pins.refresh!)<60000);
          const pinKept=+probe.start===(pins.mix??+pendingStart)&&requestedFeed&&requestedRefresh;
          // A known observed peak has a fixed usability window. Multi-feed/cold
          // plans use the solver's candidate score, which includes cold stretches.
          const peakOK=planningMode==='know_peak'?!!result?.peakTime&&knownPeakMixUsable(probe.start,result.peakTime,result.adjPeakHValue??getPrefPeakH_RT('sourdough',kitchenTemp,styleKey),flourStrength):result?.starterPillState==='green'&&!result.planConstrained;
          const bounds={from:result?.sourdoughSweetFrom!=null?new Date(+pendingEatTime-result.sourdoughSweetFrom*hour):null,to:result?.sourdoughSweetTo!=null?new Date(+pendingEatTime-result.sourdoughSweetTo*hour):null};
          const validation=assessScheduleDraft({start:probe.start,bake:pendingEatTime,...bounds,blocks:repairBlocks,kitchenTemp,preheatMin,mixerType,styleKey,numItems,
            extraActions:future.map(e=>({id:e.kind.startsWith('fridge')?'starter-cold':'starter-feed',at:e.time})),methodValid:!!result&&!result.windowTooShort&&pinKept&&peakOK});
          const valid=validation.valid&&future.every(e=>+e.time>=Date.now());
          const message=valid?null:validation.reason==='busy'?(isFr?'Une intervention chevauche une indisponibilité : ':'An action overlaps unavailable time: ')+(conflictNames[validation.conflict?.id??'']??['levain','starter'])[isFr?0:1]
            :!pinKept?(isFr?'Ce rafraîchi ne permet pas de conserver le pétrissage choisi. Essayez un autre horaire.':'This feed cannot keep your chosen mixing time. Try another time.')
            :!peakOK?(isFr?'Le levain ne sera pas dans sa fenêtre de maturité au pétrissage.':'The starter will not be in its maturity window at mixing.')
            :validation.reason==='range'?(isFr?'Ce pétrissage ne laisse pas une fermentation adaptée avant la cuisson fixée.':'This mixing time does not fit the fermentation window before your fixed bake.')
            :(isFr?'Ce créneau ne permet pas un plan complet avec les rafraîchis et passages au froid nécessaires.':'This slot cannot fit all required feeds and fridge steps.');
          return {probe,valid,message};
        };
        const starterPreview=isSourdough&&(starterPins||!solverResult)?evaluateStarter(basePins):null;
        const starterResult=starterPreview?.probe.result??solverResult;
        const starterMix=starterPreview?.probe.start??pendingStart;
        const starterEvents=starterPins?starterResult?.starterEvents??displayStarterEvents:displayStarterEvents.length?displayStarterEvents:starterResult?.starterEvents??[];
        const pinsFor=(id:string,at:number):Pins=>id==='mix'?{mix:at,feed:null,refresh:null}:id==='starter:pre_mix'?{...basePins,mix:+starterMix,feed:at}:{...basePins,mix:+starterMix,refresh:at};
        const starterChange=(id:string,at:number)=>{
          captureBaseline();setStarterPins(pinsFor(id,at));setEditingRow(id);setEditingEnabled(true);
        };
        const times=isSourdough?{start:starterMix,bake:pendingEatTime,prefHours:prefOffsetH}:displayedTimes;
        const bounds=isSourdough&&starterResult?{from:starterResult.sourdoughSweetFrom!=null?new Date(+times.bake-starterResult.sourdoughSweetFrom*hour):null,to:starterResult.sourdoughSweetTo!=null?new Date(+times.bake-starterResult.sourdoughSweetTo*hour):null}:editInput.window(times.bake);
        const clampBounds=(from:number,to:number,at:number)=>({from:Math.floor(Math.min(at,Math.max(Date.now(),from))/step)*step,to:Math.ceil(Math.max(at,to)/step)*step});
        const anchors:KeyTimingAnchor[]=[];
        if(isSourdough){
          for(const event of starterEvents){
            if(event.kind==='last_fed'||event.kind==='known_peak'||event.isPast&&!event.isActive)continue;
            const editable=!startTimeInPast&&!readinessUnsupported&&+event.time>Date.now()&&['refresh','pre_mix'].includes(event.kind);
            const id='starter:'+event.kind;
            const requested=editingRow===id?(event.kind==='pre_mix'?basePins.feed:basePins.refresh):null;
            const at=requested??+event.time;
            anchors.push({id:id+(!editable?':'+anchors.length:''),name:event.label,at,editable,
              ...clampBounds(+event.time-6*hour,Math.min(+starterMix-step,+event.time+6*hour),at),
              detail:event.kind.startsWith('fridge')?(isFr?'Calculé avec les rafraîchis':'Calculated with the feeds'):event.cardNote,
              note:editingRow===id?starterPreview?.message:null});
          }
        }else if(hasPrefActive){
          const at=+draftMix-draftPrefOffset*hour;
          anchors.push({id:'pref',name:prefLabel,at,editable:!startTimeInPast&&!readinessUnsupported,
            ...clampBounds(+draftMix-(prefWindow?.max??prefOffsetH+6)*hour,+draftMix-(prefWindow?.min??Math.max(.25,prefOffsetH-6))*hour,at),
            detail:(isFr?'Maturation : ':'Maturation: ')+duration(draftPrefOffset)+' · '+(prefGoesInFridge?(isFr?'au froid':'in the fridge'):(isFr?'à température ambiante':'at room temperature')),
            note:editingRow==='pref'?draftMessage:null});
        }
        anchors.push({id:'mix',name:isFr?'Pétrir la pâte':'Mix the dough',at:+times.start,editable:!startTimeInPast&&!readinessUnsupported,
          ...clampBounds(+(bounds.from??new Date(+times.start-6*hour)),+(bounds.to??new Date(+times.start+6*hour)),+times.start),
          detail:duration((+times.bake-+times.start)/hour)+(isFr?' avant cuisson':' before baking'),
          note:editingRow==='mix'?(isSourdough?starterPreview?.message:draftMessage):!editingRow?(isSourdough&&!solverResult&&!readinessUnsupported?starterPreview?.message:readinessPanel):null});
        const cacheKey=JSON.stringify([originalSignature,starterPins,editingRow,draftRowTime,editBaseTimes,kitchenTemp,fridgeTemp,flourStrength,lastFeedRatio,nextFeedRatio,ratioMode,starterLocation,planningMode,lastFedAge,knownPeakTime,prefermentType,repairBlocks]);
        const check=(id:string,at:number)=>isSourdough?evaluateStarter(pinsFor(id,at)).valid:proposeScheduleEdit({...slotInput,id,at:new Date(at)}).valid;
        const dirty=isSourdough?starterPins!==null&&(+starterMix!==+pendingStart||JSON.stringify(starterEvents.map(e=>[e.kind,+e.time]))!==JSON.stringify(displayStarterEvents.map(e=>[e.kind,+e.time]))):changed&&(+draftMix!==+pendingStart||+draftBake!==+pendingEatTime||draftPrefOffset!==prefOffsetH);
        const valid=isSourdough?!!starterPreview?.valid:!!preview?.valid;
        const cancel=()=>{setStarterPins(null);closeEdit();};
        const accept=()=>{
          if(isSourdough){
            const checked=evaluateStarter(basePins);if(!checked.valid)return;
            manualMixRef.current=basePins.mix;manualFeed2Ref.current=basePins.feed;manualRefreshRef.current=basePins.refresh;
            checked.probe.effects.forEach(effect=>effect());setHasDragged(true);hasManuallyDragged.current=true;
            const result=checked.probe.result!;acceptedBakeRef.current=+pendingEatTime;
            onChange(checked.probe.start,pendingEatTime,repairBlocks,{preservePlan:true,starterPlan:{events:result.starterEvents,fridgeOutTime:result.fridgeOutTime,usingPeak2:result.usingPeak2,feed2Time:result.feed2Time,starterFridgeInTime:result.starterFridgeInTime}});
            setKeyAdjusted(JSON.stringify([+checked.probe.start,+pendingEatTime,prefOffsetH,result.starterEvents.map(e=>[e.kind,+e.time])])!==keyBaselineRef.current);setStarterPins(null);closeEdit();
          }else{setKeyAdjusted(JSON.stringify([+draftMix,+draftBake,draftPrefOffset,displayStarterEvents.map(e=>[e.kind,+e.time])])!==keyBaselineRef.current);saveEdit();}
        };
        if(isSourdough&&((planningMode==='know_peak'&&!knownPeakTime)||(planningMode==='last_fed'&&(!lastFedTime||lastFedAge===null))))return null;
        return <ScheduleKeyTimings anchors={anchors} blocks={repairBlocks} isFr={isFr} onChange={isSourdough?starterChange:commercialChange} check={check} cacheKey={cacheKey}>
          {editingRow&&<div style={{display:'grid',gap:8,marginTop:12}}>
            <button type="button" onClick={accept} disabled={!dirty||!valid} style={{minHeight:48,padding:12,border:0,borderRadius:10,background:'var(--terra)',color:'white',fontSize:16}}>{isFr?'Valider ces horaires':'Confirm these times'}</button>
            <button type="button" className="bh-back-action" onClick={cancel}>{isFr?'Annuler':'Cancel'}</button>
          </div>}
          {dirty&&<button type="button" className="bh-back-action" onClick={resetToRecommendation}>{isFr?'Revenir à la recommandation':'Reset to recommendation'}</button>}
        </ScheduleKeyTimings>;

      })()}


      </div>

      {/* scheduleNote moved into Start Dough card */}

      </>)}



      {startInvalid && (
        <div style={{
          fontSize: '12px', color: 'var(--terra)',
          background: '#FEF4EF', border: '1px solid #F5C4B0',
          borderRadius: '16px', padding: '8px 12px',
          marginBottom: '12px', marginTop: '8px',
        }}>
          {t('startBeforeBake')}
        </div>
      )}

      </div>)} {/* end eatTimeSet */}

    </div>
  );
}
