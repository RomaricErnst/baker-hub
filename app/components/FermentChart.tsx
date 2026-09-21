'use client';
import { useRef, useEffect, useState, useId } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type AvailabilityBlock, type ScheduleResult } from '../utils';
import { createClient } from '@/app/lib/supabase/client';
import type { StarterEvent } from './SchedulePicker';

/** Exact cold stages; handling/warm-up gaps are not refrigeration. */
export function scheduleColdIntervals(schedule: ScheduleResult | null | undefined): Array<{from: Date; to: Date}> {
  if (!schedule) return [];
  const pairs = schedule.coldRetard2Start
    ? [[schedule.coldRetard1Start, schedule.coldRetard1End], [schedule.coldRetard2Start, schedule.coldRetard2End]]
    : [[schedule.coldRetardStart, schedule.coldRetardEnd]];
  return pairs.flatMap(([from,to]) => from && to && +to > +from ? [{from,to}] : []);
}

export function coldIntervalHoursBeforeBake(eatTime: Date, intervals: Array<{from: Date; to: Date}>): Array<[number, number]> {
  return intervals.filter(({from,to}) => Number.isFinite(+from) && Number.isFinite(+to) && +to > +from)
    .map(({from,to}) => [(+eatTime - +from) / 3600000, (+eatTime - +to) / 3600000]);
}

/** Pair actual starter fridge events, including a starter already stored cold. */
export function starterColdIntervals(events: StarterEvent[], fallbackStart?: Date | null, fallbackOut?: Date | null): Array<{from: Date; to: Date}> {
  const intervals: Array<{from: Date; to: Date}> = [];
  let from: Date | null = null;
  const ordered = [...events].sort((a,b) => +a.time - +b.time);
  for (const event of ordered) {
    if (event.kind === 'fridge_in') from = event.time;
    if (event.kind === 'fridge_out') {
      const start = from ?? fallbackStart;
      if (start && +event.time > +start) intervals.push({from:start,to:event.time});
      from = null;
    }
  }
  if (!intervals.length && fallbackStart && fallbackOut && +fallbackOut > +fallbackStart) intervals.push({from:fallbackStart,to:fallbackOut});
  return intervals;
}

export interface FermentChartProps {
  eatTime: Date;
  prefermentType: string;   // 'none' | 'biga' | 'poolish' | 'levain' | 'sourdough'
  kitchenTemp: number;
  fridgeTemp?: number;      // fridge storage temp — for starter curve shape
  styleKey?: string;        // for style-sensitive starter peak timing
  mixOffsetH: number;       // hours before bake — controlled
  prefOffsetH: number;      // hours before mix — controlled (0 / ignored when no pref)
  blocks: AvailabilityBlock[];
  onMixChange: (h: number) => void;
  onPrefChange: (h: number) => void;
  onRefreshChange?: (absHBF: number) => void; // commit a dragged refresh feed (absolute HBF)
  onDragStart?: () => void;
  onDragEnd?: () => void;
  windowH?: number;         // total window to display (default 96h)
  prefInFridge?: boolean;   // show fridge climate note in pref card
  hasColdRetard?: boolean;  // widens bell and sweet zone for cold schedules
  sweetCenterH?: number;    // actual sweet center HBF for this style+window — sets dough peak
  sweetFromH?: number;      // upper sweet zone boundary HBF
  sweetToH?: number;        // lower sweet zone boundary HBF
  nowHBF?: number;          // hours before bake right now — used to clamp drag
  doughColdIntervals?: Array<{from: Date; to: Date}>;
  prefermentFridgeOutTime?: Date | null;
  phases?: {
    bulkFermH: number;
    coldRetardH: number;
    finalProofH: number;
    preheatH: number;
  };
  scheduleNote?: string | null;
  recommendedMixHBF?: number | null;
  /** id of the row selected in the plan list — that step is highlighted and
   *  everything else drops back. Ids match the list: 'mix' | 'pref' | 'bake'
   *  | `ev:<index>` for sourdough starter events. */
  focusId?: string | null;
  /** Reset lives directly under the chart so the baker sees the diamond jump
   *  back when they press it. Rendered only when the plan is the baker's. */
  showReset?: boolean;
  onReset?: () => void;
  starterFeedTime?: Date | null;
  starterFeed2Time?: Date | null;
  starterFridgeOutTime?: Date | null;
  starterKnownPeakTime?: Date | null;
  starterIsDepletedAt?: Date | null;
  starterRefeedTime?: Date | null;
  starterIntermediateFeeds?: Date[];
  starterMature?: boolean;
  starterHasRye?: boolean;
  starterStoredInFridge?: boolean;
  startTimeInPast?: boolean;
  comparisonFridgeOutTime?: Date | null;
  comparisonFridgePeakTime?: Date | null;
  showFridgeComparison?: boolean;
  starterAdjPeakH?: number | null;  // ratio+maturity+rye adjusted peak hours
  starterRedPill?: boolean;
  starterFeed2OutOfZone?: boolean;
  starterFridgeInTime?: Date | null;
  starterFridgeHoldRefreshTime?: Date | null;
  starterFridgeHoldInTime?:      Date | null;
  starterFridgeHoldOutTime?:     Date | null;
  starterPreMixStretchFactor?:   number;
  starterRefreshStretchFactor?:  number;
  starterEvents?: StarterEvent[];
}

// ── Constants ────────────────────────────────────────────────
const WINDOW_H_DEFAULT = 96;
const PAD       = 16;
// Window lane — a step's "room to move" bar. The lane height is RESERVED
// permanently (whether or not any window is drawn) so the plot never shifts
// when the window layer is switched on.
const WIN_LANE_Y = 5;
const WIN_LANE_H = 6;
const TOP_PAD   = 30;   // plot top — busy columns and the tallest bell start here
const MAXH      = 110;  // max bell height (fits within TOP_PAD to BL)
const BL        = 140;  // baseline
const AXIS_Y    = 140;  // axis line = same as baseline BL
const CHART_H   = 182;  // baseline + diamond + now tick + day-name row

// Diamond labels now sit ABOVE the axis (over the curves, with a cream halo),
// so there are no label rows below the axis to make room for.
const LABEL_Y      = BL - 22;  // lane 0 — clears the taller diamond
const LABEL_LANE_H = 16;       // lane 1 sits this much higher

// DOUGH_SIG and DOUGH_SWEET_CENTER are computed inside the component
// based on hasColdRetard — see derived physics section

// Diamond half-diagonal — 30px across. Larger than both the prototype (~24px
// at 360) and the old chart (26px): these are drag targets as well as marks,
// and at 24px they read as decoration rather than something to grab.
const S = 15;

// Cold casing drawn behind a curve wherever that curve is in the fridge.
const COLD_STROKE = '#5B87AD';
const BUSY_FILL   = '#8A7F78';

// ── Sigma / optimal-hours functions ──────────────────────────
// ── Poolish RT peak time (hours from start to peak at room temp) ─────
// Style-sensitive: pizza doughs ferment slightly faster (more yeast activity)
// than bread styles. Biga always goes to fridge so RT peak not applicable.
export function getPrefPeakH_RT(type: string, temp: number, styleKey = 'neapolitan'): number {
  if (type === 'biga') return 0; // always fridge — no RT peak concept

  // Sourdough / levain: hours from a 1:1:1 feed to peak for a vigorous MATURE
  // starter. maturity (matF), rye (ryeF) and feed ratio (ratioMultiplier) are
  // applied on top of this base by the caller.
  //
  // Continuous Q10 (temperature-coefficient) model, replacing the old bucket
  // ladder that went FLAT at 7.5h for every temp ≤20°C — which under-predicted
  // cold kitchens badly (16°C is ~13h in reality, not 7.5h → the app told cold
  // bakers to feed hours too late). Anchored at the one well-established point
  // (24°C → 5.5h) with Q10 = 2.8, fit to a wide consensus of published data
  // (King Arthur feeding-ratio trials, Brod & Taylor, The Sourdough Journey,
  // Tartine, The Clever Carrot). One smooth curve is more robust than buckets:
  // no edge discontinuities, and it also corrects the tropical end (a 34°C
  // starter peaks in ~2h, not the flat 2.5h the ladder returned → over-early
  // feed). Clamped [1.75h, 24h]: yeast activity maxes out near ~35°C so peak
  // time floors ~1.75h; the ceiling guards absurd values at cellar temps (the
  // fridge path handles genuine cold storage separately).
  // Fit vs consensus (1:1:1, mature): 16°C 12.5h(12–14) · 18°C 10.2h(10) ·
  // 20°C 8.3h(8–9) · 22°C 6.8h(6–8) · 24°C 5.5h(5–6) · 28°C 3.6h(3–4) ·
  // 32°C 2.4h(2–3) · 34°C 2.0h(~2).
  if (type === 'sourdough' || type === 'levain') {
    const raw = 5.5 * Math.pow(2.8, (24 - temp) / 10);
    return Math.max(1.75, Math.min(24, raw));
  }

  const isBread = ['pain_campagne','pain_levain','baguette','pain_complet',
                   'pain_seigle','fougasse','brioche','pain_mie','pain_viennois'].includes(styleKey);
  // Poolish (commercial yeast) — bread styles: slightly slower RT peak
  if (isBread) {
    if (temp >= 32) return 3;
    if (temp >= 30) return 4;
    if (temp >= 28) return 5;
    if (temp >= 26) return 7;
    if (temp >= 24) return 9;
    return 12;
  }
  // Poolish — pizza styles
  if (temp >= 32) return 3;
  if (temp >= 30) return 4;
  if (temp >= 28) return 5;
  if (temp >= 26) return 7;
  if (temp >= 24) return 9;
  return 11;
}

// NOTE: getPrefRTWarmupH (a fixed climate ladder) lived here and is gone.
// Preferment warm-up is now utils.requiredPrefWarmupH — solved from the dough
// temperature the mix actually needs, and 0 whenever water temperature alone
// can reach it. Starter warm-up below is unrelated and still a ladder: a
// 100–150 g starter has a ~80–90 min time constant, so 0.5–1.5h genuinely
// warms it, unlike a 600 g poolish.

// How long after Feed 1 until starter is depleted (trough = ready for Feed 2)
export function getStarterTroughH(temp: number, mature: boolean, styleKey = 'neapolitan'): number {
  const peakH = getPrefPeakH_RT('sourdough', temp, styleKey);
  const maturityFactor = mature ? 1.0 : 1.2;
  return peakH * 1.8 * maturityFactor;
}

// How long starter needs at RT after coming out of fridge to reach peak
export function getStarterFridgeWarmupH(temp: number): number {
  if (temp >= 30) return 0.5;
  if (temp >= 28) return 0.75;
  if (temp >= 26) return 1.0;
  return 1.5;
}

function getPrefSig(type: string, temp: number, inFridge = false, prefOffsetH = 10): number {
  if (type === 'biga') return Math.max(8, prefOffsetH * 0.4);
  if (type === 'poolish') {
    if (inFridge) return Math.max(6, prefOffsetH * 0.4); // scales with actual window
    return temp >= 26 ? 3 : temp >= 22 ? 4 : 5;         // RT poolish
  }
  if (temp >= 30) return 2;
  if (temp >= 26) return 3;
  return 4;
}

export function getPrefOptH(type: string, temp: number, inFridge = false, styleKey = 'neapolitan', fridgeTemp = 6): number {
  if (type === 'biga') return 48;       // biga fridge: 48h optimal, up to 72h safe
  if (type === 'poolish') {
    if (inFridge) return Math.max(10, Math.min(22, Math.round(22 - fridgeTemp * 1.5)));
    // RT poolish optimal = RT peak time for this style+temp
    return getPrefPeakH_RT(type, temp, styleKey);
  }
  // levain / sourdough — align with getPrefPeakH_RT
  return getPrefPeakH_RT(type, temp, styleKey);
}

// ── Chart layers ─────────────────────────────────────────────
export interface ChartLayers { fridge: boolean; busy: boolean; window: boolean }
const LAYERS_KEY = 'bh_chart_layers_v1';

// ── Label packing: clamp, then stagger, then drop ───────────
// 1. Clamp each label inside the canvas so "Bake" cannot overflow the right
//    edge. 2. Test against everything already placed, left to right.
// 3. On a clash, drop to a second lane. 4. If both lanes are full, omit the
//    label rather than overlap it.
interface PackIn  { x: number; text: string; color: string; key: string; dim: boolean;
  /** Anchors (Dough, Bake) claim their lane first. Left-to-right alone let a
   *  cluster of starter refreshes fill both lanes and drop `Dough` — the one
   *  label the chart most needs. Within a tier the pass is still left-to-right. */
  anchor?: boolean }
interface PackOut extends PackIn { lane: number }
function packLabels(items: PackIn[], W: number): PackOut[] {
  const CW = 7.4;   // DM Mono 12px ≈ 7.4px/char
  const GAP = 5;
  const out: PackOut[] = [];
  const lanes: Array<Array<[number, number]>> = [[], []];
  [...items]
    .sort((a, b) => (Number(!!b.anchor) - Number(!!a.anchor)) || (a.x - b.x))
    .forEach(it => {
    const half = (it.text.length * CW) / 2;
    const cx = Math.max(PAD + half, Math.min(W - PAD - half, it.x));
    const lo = cx - half - GAP;
    const hi = cx + half + GAP;
    for (let ln = 0; ln < lanes.length; ln++) {
      if (!lanes[ln].some(r => lo < r[1] && hi > r[0])) {
        lanes[ln].push([lo, hi]);
        out.push({ ...it, x: cx, lane: ln });
        return;
      }
    }
    // both lanes taken at this x — omit rather than overlap
  });
  return out;
}

// ── Math helpers ─────────────────────────────────────────────
function bell(h: number, peakH: number, sigma: number): number {
  return Math.exp(-0.5 * ((h - peakH) / sigma) ** 2);
}

function hToX(hbf: number, W: number, wh = WINDOW_H_DEFAULT): number {
  return PAD + (1 - hbf / wh) * (W - PAD * 2);
}

function xToHBF(x: number, W: number, wh = WINDOW_H_DEFAULT): number {
  return Math.max(1, Math.min(wh - 1, (1 - (x - PAD) / (W - PAD * 2)) * wh));
}

function snap15(h: number): number {
  return Math.round(h * 4) / 4;
}

// Closed bell paths end with two baseline anchor points + Z so they can be
// FILLED. When the same closed path is also STROKED, that closing run draws a
// stray horizontal line along the axis ("a small return to close the graph").
// openBell() strips the two trailing baseline anchors + Z so strokes follow
// only the curve itself. Render bells as fill(closed) + stroke(open) pairs.
function openBell(d: string): string {
  const zi = d.lastIndexOf(' Z');
  const base = zi > 0 ? d.slice(0, zi) : d;
  const i = base.lastIndexOf(' L ');
  const j = i > 0 ? base.lastIndexOf(' L ', i - 1) : -1;
  return j > 0 ? base.slice(0, j) : base;
}

// Sample bell curve into a closed SVG path
function makeBellPath(peakHBF: number, sigma: number, W: number, wh = WINDOW_H_DEFAULT, startHBF?: number): string {
  const N = 260;
  const left = startHBF ?? wh;
  const floor = startHBF !== undefined ? bell(startHBF, peakHBF, sigma) : 0;
  const range = Math.max(0.01, 1 - floor);
  // Sample bake-side (hbf=0) → feed-side (hbf=left)
  const raw: Array<{ x: number; y: number; h: number }> = [];
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * left;
    const h = (bell(hbf, peakHBF, sigma) - floor) / range;
    raw.push({ x: hToX(hbf, W, wh), y: BL - h * MAXH, h });
  }
  // Trim the decayed bake-side tail: the path used to run feed→bake hugging
  // the baseline 1–3px up after the bell decays; with a dashed stroke that
  // rendered as a phantom dotted line across the chart.
  let s = 0;
  while (s < raw.length - 2 && raw[s].h < 0.006) s++;
  // Degenerate bell: the peak sits so far outside the window that the whole
  // visible curve hugs the baseline — stroked, that renders as a short stray
  // line parallel to the axis ("a line closing the graph"). Draw nothing.
  if (!raw.some(pt => pt.h > 0.02)) return '';
  const pts: string[] = [`M ${raw[s].x.toFixed(1)} ${BL}`];
  for (let i = s; i < raw.length; i++) {
    pts.push(`L ${raw[i].x.toFixed(1)} ${raw[i].y.toFixed(1)}`);
  }
  pts.push(`L ${hToX(left, W, wh).toFixed(1)} ${BL}`);
  pts.push('Z');
  return pts.join(' ');
}

// Bell that RISES to peak (same gaussian as makeBellPath), then HOLDS FLAT at
// peak height across the cold hold (peak→fridgeOut), then drops to baseline at
// fridgeOut. Used for the starter refresh bell of a fridge-hold plan so the
// curve doesn't descend through the long fridge dwell (fermentation paused in
// cold) — the following pre_mix bell renders separately and takes over after
// fridge_out. peakHBF is expected to equal fridgeInHBF (or differ by minutes);
// the plateau starts at min(peakHBF, fridgeInHBF) so the path stays monotone.
// Bell for the "chilled-at-peak" sub-case: starter rose at RT to its peak,
// the peak coincides with fridge_in, and the cold hold spans fridge_in →
// fridge_out. Biology: a starter chilled AT its peak does NOT re-rise in the
// cold — it holds a broad near-peak plateau then declines gently. Shape:
//   1. RT-rate gaussian rise from feed (baseline) to peak at fridgeInHBF.
//   2. Gentle linear decline across the cold hold from 1.0 at peak to
//      PLATEAU_END_HEIGHT (≈0.85) at fridgeOut — broad plateau with a
//      slow drift, not a flat top, matching slow cold fermentation.
//   3. Drop to baseline at fridgeOut; the pre_mix event's bell renders
//      separately and resumes from there.
// Use this when chilledAtPeak is true (peak time ≈ fridge_in time). The
// other shape (slow cold rise to a cold peak mid-hold) is in
// makeFridgePhaseBellPath and is correct only for fed-straight-into-fridge.
function makeBellWithFridgePlateau(
  peakHBF: number,
  sigma: number,
  fridgeInHBF: number,
  fridgeOutHBF: number,
  W: number, wh: number,
  feedHBF: number,
): string {
  const PLATEAU_END_HEIGHT = 0.85;
  const N = 200;
  const plateauStartHBF = Math.min(peakHBF, fridgeInHBF);
  // Normalize like makeBellPath: floor at feedHBF anchors the rise at baseline.
  const floor = bell(feedHBF, peakHBF, sigma);
  const range = Math.max(0.01, 1 - floor);
  const pts: string[] = [];
  pts.push(`M ${hToX(feedHBF, W, wh).toFixed(1)} ${BL}`);
  // (1) Rising portion: hbf descends from feedHBF (left, baseline) to
  //     plateauStartHBF (right of feed, peak).
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const hbf = feedHBF - t * (feedHBF - plateauStartHBF);
    const normH = (bell(hbf, peakHBF, sigma) - floor) / range;
    const yClamped = BL - Math.max(0, Math.min(1, normH)) * MAXH;
    pts.push(`L ${hToX(hbf, W, wh).toFixed(1)} ${yClamped.toFixed(1)}`);
  }
  // (2) Gentle decline across the cold hold: linear from 1.0 at the peak to
  //     PLATEAU_END_HEIGHT at fridge_out.
  const plateauSteps = 40;
  const span = plateauStartHBF - fridgeOutHBF;
  for (let i = 1; i <= plateauSteps; i++) {
    const t = i / plateauSteps;
    const hbf = plateauStartHBF - t * span;
    const h = 1 - t * (1 - PLATEAU_END_HEIGHT);
    const y = BL - h * MAXH;
    pts.push(`L ${hToX(hbf, W, wh).toFixed(1)} ${y.toFixed(1)}`);
  }
  // (3) Drop to baseline at fridge_out; pre-mix bell takes over from here.
  pts.push(`L ${hToX(fridgeOutHBF, W, wh).toFixed(1)} ${BL}`);
  pts.push(`L ${hToX(feedHBF, W, wh).toFixed(1)} ${BL}`);
  pts.push('Z');
  return pts.join(' ');
}

// ── Plateau bell path (for fridge poolish/biga) ────────────
// Flat-top bell: plateau centred on peakHBF, tapered sides
function makePlateauBellPath(
  peakHBF: number,
  sigma: number,
  plateauHalfW: number,
  W: number, wh: number,
  startHBF?: number,
): string {
  function pbell(h: number): number {
    const dist = Math.abs(h - peakHBF);
    if (dist <= plateauHalfW) return 1.0;
    return Math.exp(-0.5 * ((dist - plateauHalfW) / sigma) ** 2);
  }
  const N = 320;
  const left = startHBF ?? wh;
  const floor = startHBF !== undefined ? pbell(startHBF) : 0;
  const range = Math.max(0.01, 1 - floor);
  const pts: string[] = [];
  let _maxH = 0;
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * left;
    const x = hToX(hbf, W, wh);
    const hNorm = (pbell(hbf) - floor) / range;
    if (hNorm > _maxH) _maxH = hNorm;
    const y = BL - hNorm * MAXH;
    pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  // Degenerate: whole visible curve hugs the baseline — draw nothing (see
  // makeBellPath; stroked, this rendered as a stray axis-parallel line).
  if (_maxH < 0.02) return '';
  pts.push(`L ${hToX(left, W, wh).toFixed(1)} ${BL}`);
  pts.push(`L ${hToX(0,   W, wh).toFixed(1)} ${BL}`);
  pts.push('Z');
  return pts.join(' ');
}

// Fed-straight-into-fridge starter bell: a SINGLE peaks-once hump anchored on
// the CARD peak (peakHBF — read from ev.bellPeakTime, which equals
// solverResult.peakTime by construction). Replaces the prior cold-gaussian-
// centred-at-feedHBF-minus-fridgePeakH version, which could place the peak
// mid-hold (off by hours from the card) and which carried an unconditional
// post-removal RT-warmup re-rise that produced a second bump.
//
// Biology: rise from feed (baseline) at cold rate to peak; one peak ONLY;
// past the peak (closer to bake) hold a broad plateau then decline gently
// with a floor (cold-fermented starter deflates slowly, never collapses).
// When the plan removes the starter BEFORE its peak (peakHBF < fridgeOutHBF),
// the same rising gaussian continues smoothly past fridge_out to peak (the
// warm acceleration is subsumed by the single rise — no separate re-rise
// branch). When removed AT/AFTER peak (peakHBF ≥ fridgeOutHBF), the curve
// is already past the peak by fridge_out and is on the plateau/decline side.
// In both sub-cases the peak coincides with peakHBF on the chart.
function makeFridgePhaseBellPath(
  feedHBF: number,
  peakHBF: number,
  fridgePeakH: number,
  fridgeSigma: number,
  W: number,
  WH: number,
): string {
  const PLATEAU_W     = fridgePeakH * 0.6;
  const DECLINE_SIGMA = fridgeSigma * 2.5;
  const FRIDGE_FLOOR  = 0.6;
  const N = 300;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * feedHBF;
    let h: number;
    if (hbf >= peakHBF) {
      // Rising side (before the peak in time): one gaussian approaching 1.0
      // at peakHBF. Width scales with fridgeSigma so the cold rise reads
      // gently across the long pre-peak span.
      h = Math.exp(-0.5 * ((hbf - peakHBF) / fridgeSigma) ** 2);
    } else {
      // Past the peak (closer to bake): plateau within PLATEAU_W, then
      // floored gaussian decline with DECLINE_SIGMA. At dist = PLATEAU_W the
      // plateau (1.0) meets the decline (exp(0) = 1.0) — continuous, no
      // notch — and the floor prevents a collapse to baseline.
      const dist = peakHBF - hbf;
      if (dist <= PLATEAU_W) {
        h = 1.0;
      } else {
        const declineDist = dist - PLATEAU_W;
        const declineGauss = Math.exp(-0.5 * (declineDist / DECLINE_SIGMA) ** 2);
        // Sagging floor: a fed-then-chilled starter declines slowly but it
        // does DECLINE — a constant 0.6 floor drew a flat, still-high plateau
        // for days ("rises, drops partway, then holds high"), which reads as
        // wrong biology. Let the floor itself decay on a gentle cold time
        // constant (~48h to fall to ~0.22×), clamped so the curve never
        // collapses to the axis.
        const saggingFloor = Math.max(0.15, FRIDGE_FLOOR * Math.exp(-declineDist / 48));
        h = Math.max(saggingFloor, declineGauss);
      }
    }
    h = Math.max(0, Math.min(1, h));
    const x = hToX(hbf, W, WH);
    const y = BL - h * MAXH;
    pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L ${hToX(feedHBF, W, WH).toFixed(1)} ${BL}`);
  pts.push(`L ${hToX(0, W, WH).toFixed(1)} ${BL}`);
  pts.push('Z');
  return pts.join(' ');
}

// ── Formatting ───────────────────────────────────────────────
function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}

function fmtHM(d: Date, isFr = false): string {
  const h = d.getHours();
  const m = d.getMinutes();
  if (isFr) return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

function fmtDT(d: Date, isFr = false): string {
  const loc = isFr ? 'fr-FR' : 'en-US';
  const wd = d.toLocaleDateString(loc, { weekday: 'short' });
  return `${wd} ${d.getDate()} · ${fmtHM(d, isFr)}`;
}

// ── Component ─────────────────────────────────────────────────
export default function FermentChart({
  eatTime, prefermentType, kitchenTemp, fridgeTemp = 6, styleKey = 'neapolitan',
  mixOffsetH, prefOffsetH,
  blocks, onMixChange, onPrefChange, onRefreshChange, onDragStart, onDragEnd,
  windowH, prefInFridge, hasColdRetard, sweetCenterH, sweetFromH, sweetToH,
  nowHBF = 999, doughColdIntervals = [], prefermentFridgeOutTime, scheduleNote,
  recommendedMixHBF, focusId = null, showReset = false, onReset,
  starterFeedTime, starterFeed2Time, starterFridgeOutTime,
  starterKnownPeakTime = null, starterIsDepletedAt = null, starterRefeedTime = null,
  starterIntermediateFeeds = [],
  starterMature = true,
  startTimeInPast = false,
  comparisonFridgeOutTime = null, comparisonFridgePeakTime = null,
  showFridgeComparison = false,
  starterAdjPeakH = null,
  starterRedPill = false,
  starterFeed2OutOfZone = false,
  starterFridgeInTime = null,
  starterFridgeHoldRefreshTime = null,
  starterFridgeHoldInTime      = null,
  starterFridgeHoldOutTime     = null,
  starterPreMixStretchFactor   = 1.0,
  starterRefreshStretchFactor  = 1.0,
  starterEvents = [] as StarterEvent[],
}: FermentChartProps) {
  const chartId = useId().replace(/:/g, '');
  const WH = windowH ?? WINDOW_H_DEFAULT;
  const containerRef  = useRef<HTMLDivElement>(null);
  const svgRef        = useRef<SVGSVGElement>(null);
  const [W, setW]     = useState(320);
  const t = useTranslations('fermentChart');
  const locale = useLocale();
  const isFr = locale === 'fr';
  const [dragging, setDragging] = useState<'mix' | 'pref' | 'refresh' | null>(null);
  // Local drag HBF for free visual movement during mix drag — no onMixChange until pointer up
  const [localMixHBF, setLocalMixHBF] = useState<number | null>(null);
  // Refresh diamond mirrors the mix pattern: free local movement while
  // dragging, one solver commit on release (the solver sweep is too heavy
  // to run per pointermove).
  const [localRefreshHBF, setLocalRefreshHBF] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<'mix' | 'pref' | 'refresh' | null>(null);

  // ── Chart layers ─────────────────────────────────────────
  // All three off by default: the resting chart is curves, diamonds and the
  // day scale, nothing else. The baker's selection persists in localStorage
  // (works signed out, no schema) — a later move into the F1 baker profile is
  // a one-line migration of load/save below.
  const [layers, setLayers] = useState<ChartLayers>({ fridge: false, busy: false, window: false });
  const layersHydrated = useRef(false);

  // A tick is a preference, and preferences belong to an account. Signed out,
  // a tick applies to the chart in front of the baker and is not written
  // down — the app should not be carrying settings for someone it cannot
  // name. Signed in, it persists (localStorage today, a one-line migration
  // into the F1 profile later).
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => { if (alive) setSignedIn(!!data.user); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setSignedIn(!!session?.user);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!signedIn) { layersHydrated.current = true; return; }
    // Deferred to after paint on purpose. Server and client both render the
    // all-off default, so there is no hydration mismatch; the saved selection
    // is applied on the next frame.
    const raf = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(LAYERS_KEY);
        if (raw) {
          const p = JSON.parse(raw) as Partial<ChartLayers>;
          setLayers({ fridge: !!p.fridge, busy: !!p.busy, window: !!p.window });
        }
      } catch { /* private mode / corrupt value — defaults are fine */ }
      layersHydrated.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [signedIn]);

  useEffect(() => {
    if (!layersHydrated.current || !signedIn) return;
    try {
      window.localStorage.setItem(LAYERS_KEY, JSON.stringify(layers));
    } catch { /* storage full or blocked — the chart still works */ }
  }, [layers, signedIn]);

  // Two temporary reveals, neither of which touches the baker's ticks.
  // Dragging: the one moment all three are genuinely needed (still in its
  // window? just dropped into work hours? after now?).
  // Opening help never changes visible layers. Only an active drag temporarily
  // reveals constraints; release/cancel immediately restores checkbox choices.
  const revealAll = dragging !== null;
  const L = {
    fridge: layers.fridge || revealAll,
    busy:   layers.busy   || revealAll,
    window: layers.window || revealAll,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Derived ──────────────────────────────────────────────
  const hasPref = prefermentType !== 'none' && prefermentType !== '';

  // ── Colors ───────────────────────────────────────────────
  const isLevain   = prefermentType === 'levain' || prefermentType === 'sourdough';
  // When isLevain AND starterEvents is non-empty, use new event-driven render
  // path. When isLevain but starterEvents is empty (shouldn't happen post Phase 1
  // but defensive), fall back to legacy paths.
  // For non-sourdough (!isLevain), legacy paths always used.
  const useEventDrivenStarter = isLevain && starterEvents.length > 0;
  const prefColor = '#B69746'; // Blue is reserved for refrigeration in the timeline.
  const SAGE            = '#6B7A5A';
  const TERRA           = '#6B4423';
  const CHAR            = '#2B2420';
  const DARK_SAGE       = '#3D5A30';

  // ── Physics ──────────────────────────────────────────────
  // DOUGH_SWEET_CENTER = offset from mix to dough peak = coldH + rtH per style
  // Passed as sweetCenterH from SchedulePicker. Fallback: 26h cold, 6h RT.
  // When mixHBF = DOUGH_SWEET_CENTER → doughPeakHBF = 0 = bake (correct).
  // Clamp the RT-only sigma: WH * 0.35 grows with the window (up to ~42 on a
  // 120h chart) which flattens the bell into an uninformative smear. Cap at 12
  // so an RT dough bell keeps a readable peak on wide windows.
  const DOUGH_SIG          = hasColdRetard ? 18 : Math.max(3, Math.min(12, WH * 0.35));
  // For sourdough RT-only (no cold retard), dough needs ~adjPeakH for the
  // levain to peak inside it. Non-sourdough RT-only uses 6h default.
  const DOUGH_SWEET_CENTER_NO_RETARD = isLevain && starterAdjPeakH
    ? Math.max(6, starterAdjPeakH * 0.85)
    : 6;
  const DOUGH_SWEET_CENTER = sweetCenterH ?? (hasColdRetard ? 26 : DOUGH_SWEET_CENTER_NO_RETARD);

  // Two-temperature poolish protocol:
  // needsFridge = offset > RT peak time for this style+temp
  // If fridge: peak = AT mix (fridge cold phase + RT warmup lands at mix)
  // If RT only: peak = after mix naturally (curve still rising at mix = honest)
  const rtPeakH = hasPref ? getPrefPeakH_RT(prefermentType, kitchenTemp, styleKey) : 0;
  // The scheduler decides fridge vs room temp (it scores both modes) and hands
  // the answer down as prefInFridge. Re-deriving it here from prefOffsetH made
  // the chart disagree with the card on the same screen — an 11h poolish in a
  // sub-24°C kitchen hits `11 > 11 === false` and printed "Room temp" while the
  // card printed a fridge removal time. Local derivation is the fallback only.
  const prefNeedsFridge = hasPref && (
    prefermentType === 'biga' ||
    (prefInFridge !== undefined ? prefInFridge : prefOffsetH > rtPeakH)
  );
  // Fridge: fix sigma at optimal duration so curve shape is stable during drag
  // RT: use actual prefOffsetH (small sigma, negligible effect)
  const prefSigInput = prefNeedsFridge
    ? getPrefOptH(prefermentType, kitchenTemp, true, styleKey, fridgeTemp)
    : prefOffsetH;
  const prefSig = hasPref ? getPrefSig(prefermentType, kitchenTemp, prefNeedsFridge, prefSigInput) : 1;

  // Plateau width = science-based peak window at cold retard temps:
  // Poolish fridge: ±3h (narrow — peaks and holds ~6h total then declines fast)
  // Biga fridge:   ±10h (broad — much more forgiving, ~20h quality window)
  // RT: no plateau — sharp bell (fast biology, narrow peak)
  const plateauHalfW = prefNeedsFridge
    ? (prefermentType === 'biga' ? 10 : 3)
    : 0;

  // During drag, use local position for all mix-derived values
  const effectiveMixHBF = localMixHBF !== null ? localMixHBF : mixOffsetH;

  const prefStartAbsHBF = effectiveMixHBF + prefOffsetH;
  const doughPeakHBF = effectiveMixHBF - DOUGH_SWEET_CENTER;
  // Both fridge and RT: peak relative to prefStartAbsHBF so curve slides with diamond.
  // Fridge: peak is optH hours after start (at optimal → peaks at mix, earlier/later → shifts).
  const prefOptHFridge = getPrefOptH(prefermentType, kitchenTemp, true, styleKey, fridgeTemp);
  const prefPeakHBF = prefNeedsFridge
    ? prefStartAbsHBF - prefOptHFridge
    : prefStartAbsHBF - rtPeakH;

  // Sweet-spot zones — driven by style+timing aware props
  // Zone: left = max useful start (min of now and preferredCold+rtH)
  // Zone: right = minTotalFermH boundary — unified cold/RT
  const doughZoneFrom = sweetFromH ?? (hasColdRetard ? 52 : 26);
  const doughZoneTo   = sweetToH   ?? (hasColdRetard ? 8  : 8 );
  // Zone max aligned with science-based over-ferment threshold per type:
  // Poolish fridge: 24h max · Biga: 72h max · RT poolish: rtPeakH * 1.5
  const prefZoneMax = hasPref
    ? prefermentType === 'biga' ? 72
    : prefNeedsFridge           ? 24
    : rtPeakH * 1.5
    : 0;

  // Poolish/Biga: zone is anchored to mix (time available for preferment before mix)
  // Sourdough/Levain: zone is anchored to the actual starter peak time (±TOL band)
  // The two concepts are completely different — mixing them was wrong for sourdough.
  let prefZoneFrom: number;
  let prefZoneTo: number;
  if (isLevain && starterFeedTime) {
    const activePeakH = starterAdjPeakH ?? getPrefPeakH_RT('sourdough', kitchenTemp, styleKey);
    // Fridge-aware: a fridge starter's true peak is fridgeOut + rtToPeakH
    // (generalized two-phase), not feed + RT-peakH. Mirror the engine.
    let peakHBF2: number;
    if (starterFridgeOutTime) {
      const cf = Math.pow(2, (kitchenTemp - fridgeTemp) / 10);
      const wu = getStarterFridgeWarmupH(kitchenTemp);
      const fpH = activePeakH * cf;
      const dwellH = (starterFridgeOutTime.getTime() - starterFeedTime.getTime()) / 3600000;
      const rtToPeakH = Math.max(wu, (fpH - dwellH) / cf);
      const peakMs = starterFridgeOutTime.getTime() + rtToPeakH * 3600000;
      peakHBF2 = (eatTime.getTime() - peakMs) / 3600000;
    } else {
      const activeFeedHBF2 = (eatTime.getTime() - starterFeedTime.getTime()) / 3600000;
      peakHBF2 = activeFeedHBF2 - activePeakH;
    }
    // TOL mirrors the solver's tolerance: ±2h for fridge, ±1h for RT, widened by 0.5h for display
    // Match solver: adjPeakH × 0.15 clamped 1.0–3.0h, then +0.5h visual breathing room.
    // starterAdjPeakH is the ratio+maturity+rye adjusted peak — same value solver uses.
    const displayTOL = Math.max(1.5, Math.min(3.5, activePeakH * 0.15 + 0.5));
    prefZoneFrom = peakHBF2 + displayTOL;
    prefZoneTo   = Math.max(0, peakHBF2 - displayTOL);
  } else {
    prefZoneFrom = hasPref ? effectiveMixHBF + prefZoneMax : 0;
    prefZoneTo   = hasPref ? effectiveMixHBF + 3 : 0;
  }

  const bakeMs = eatTime.getTime();

  // ── Visible starter events (sourdough) ───────────────────
  // fridge_in / fridge_out carry no diamond — they are consequences of a
  // step, drawn as the cold casing on the curve and listed as a plain row.
  const visibleStarterEvents = !useEventDrivenStarter ? [] : starterEvents
    .map((ev, idx) => ({ ev, idx }))
    .filter(({ ev }) => ev.kind !== 'fridge_out' && ev.kind !== 'fridge_in')
    .map(({ ev, idx }) => {
      const hbf = (bakeMs - ev.time.getTime()) / 3600000;
      if (hbf < 0 || hbf > WH) return null;
      // Live drag: the refresh diamond follows the pointer; bells and card
      // re-render after the solver commits on release.
      const useLocal = ev.kind === 'refresh' && dragging === 'refresh' && localRefreshHBF !== null;
      return { ev, idx, x: hToX(useLocal ? localRefreshHBF! : hbf, W, WH) };
    })
    .filter((v): v is { ev: StarterEvent; idx: number; x: number } => v !== null);

  // ── Windows ("room to move") ─────────────────────────────
  // Draw a window only where the engine already computes one. Sourdough
  // starter feeds have no such range — they get none, and that is correct.
  const hasDoughWindow = sweetFromH !== undefined && sweetToH !== undefined
    && sweetFromH > sweetToH;
  const hasPrefWindow  = hasPref && !isLevain && prefZoneFrom > prefZoneTo;
  const prefOptWindowHBF = effectiveMixHBF
    + getPrefOptH(prefermentType, kitchenTemp, prefNeedsFridge, styleKey, fridgeTemp);

  // Cold halos use the same absolute stages as the action plan. A drag preview
  // must not fabricate a new cold schedule before the solver commits it.
  const doughColdRanges = coldIntervalHoursBeforeBake(eatTime, doughColdIntervals)
    .map(([from,to]): [number,number] => [hToX(from, W, WH), hToX(to, W, WH)]);
  const prefColdRanges: Array<[number, number]> = [];
  if (hasPref && !isLevain && prefNeedsFridge && prefermentFridgeOutTime) {
    const outHBF = (bakeMs - +prefermentFridgeOutTime) / 3600000;
    if (prefStartAbsHBF > outHBF) {
      prefColdRanges.push([hToX(prefStartAbsHBF, W, WH), hToX(outHBF, W, WH)]);
    }
  }

  if (hasPref && isLevain) {
    const cold = starterColdIntervals(starterEvents,
      starterFridgeHoldInTime ?? starterFridgeInTime ?? starterFeedTime,
      starterFridgeHoldOutTime ?? starterFridgeOutTime);
    prefColdRanges.push(...coldIntervalHoursBeforeBake(eatTime, cold)
      .map(([from,to]): [number,number] => [hToX(from,W,WH),hToX(to,W,WH)]));
  }

  // ── Pixel positions ──────────────────────────────────────
  const mixX  = hToX(effectiveMixHBF, W, WH);
  const prefX = hasPref ? hToX(prefStartAbsHBF, W, WH) : 0;
  const bakeX = hToX(0, W, WH);

  // ── Blocker helpers ──────────────────────────────────────

  // ── Sourdough multi-cycle starter derived values ──────────
  const starterPeakH   = isLevain ? getPrefPeakH_RT('sourdough', kitchenTemp, styleKey) : 0;
  const starterWarmupH = isLevain ? getStarterFridgeWarmupH(kitchenTemp) : 0;

  // Q10 cold activity model for fridge starter. Trigger when EITHER the
  // legacy scalar prop is set OR the event list carries a fridge_out — the
  // per-event bell rendering reads coldFactor for the warmup branch of
  // makeFridgePhaseBellPath and would silently fall back to coldFactor=1
  // (no cold model) if only events are populated.
  const _hasAnyFridgeOut = !!starterFridgeOutTime
    || starterEvents.some(e => e.kind === 'fridge_out');
  const starterColdFactor = isLevain && _hasAnyFridgeOut
    ? Math.pow(2, (kitchenTemp - fridgeTemp) / 10)
    : 1;

  // fridgePeakH: how long starter takes to peak if left in fridge indefinitely
  // Use effectivePeakH (adjPeakH adjusted for maturity/rye/ratio) if available.
  // effectivePeakH is computed below but we need it here — compute it early.
  const basePeakForFridge = (isLevain && starterAdjPeakH) ? starterAdjPeakH : starterPeakH;
  const fridgePeakH = basePeakForFridge * starterColdFactor;

  // fridgeOutHBF: when starter is removed from fridge (hours before bake)
  const fridgeOutHBF: number | null = isLevain && starterFridgeOutTime
    ? (bakeMs - starterFridgeOutTime.getTime()) / 3600000
    : null;

  const activeFeedHBF: number | null = isLevain && starterFeedTime
    ? (bakeMs - starterFeedTime.getTime()) / 3600000 : null;

  // feedToFridgeOutH: hours starter spent in fridge after feeding (for fridge bell height)
  const feedToFridgeOutH: number | null =
    activeFeedHBF !== null && fridgeOutHBF !== null
      ? activeFeedHBF - fridgeOutHBF
      : null;

  const fridgeSigma = fridgePeakH * 0.4;
  const fridgeHeightAtRemoval: number =
    feedToFridgeOutH !== null
      ? Math.exp(-0.5 * ((feedToFridgeOutH - fridgePeakH) / fridgeSigma) ** 2)
      : 0;

  // effectivePeakH: use starterAdjPeakH when provided (ratio/maturity/rye adjusted)
  // Falls back to base starterPeakH when null (non-sourdough or engine not yet run)
  const effectivePeakH = isLevain && starterAdjPeakH ? starterAdjPeakH : starterPeakH;
  // Stretched effective peak (used only for the ACTIVE pre-mix bell)
  const effectivePeakHStretched = effectivePeakH * starterPreMixStretchFactor;
  // Refresh bell peak (position only — sigma computed after starterSigmaH)
  const effectivePeakH_refresh = effectivePeakH * starterRefreshStretchFactor;

  // starterSigmaH: bell width scales with actual peak time (wide bell for long cycles)
  const starterSigmaH = isLevain && starterAdjPeakH
    ? starterAdjPeakH * 0.35
    : prefSig;
  // Refresh bell: sigma stretched proportionally — depleted starter = wider/flatter peak
  const starterSigmaH_refresh = starterSigmaH * starterRefreshStretchFactor;

  const activePeakHBF: number | null = activeFeedHBF !== null
    ? (starterFridgeOutTime
        ? (bakeMs - starterFridgeOutTime.getTime()) / 3600000 - starterWarmupH
        : activeFeedHBF - effectivePeakHStretched)
    : null;

  const histFeedHBF: number | null = isLevain && starterFeed2Time
    ? (bakeMs - starterFeed2Time.getTime()) / 3600000 : null;

  const histPeakHBF: number | null = histFeedHBF !== null
    ? histFeedHBF - effectivePeakH : null;

  const activePrefX = activeFeedHBF !== null ? hToX(activeFeedHBF, W, WH) : prefX;
  const starterLaneHBF = useEventDrivenStarter
    ? Math.max(...starterEvents.filter(e => e.kind !== 'known_peak').map(e =>
      e.kind === 'refresh' && localRefreshHBF !== null ? localRefreshHBF : (bakeMs - +e.time) / 3600000), effectiveMixHBF)
    : activeFeedHBF ?? prefStartAbsHBF;
  const prefLaneX = isLevain ? hToX(starterLaneHBF,W,WH) : activePrefX;

  const histPrefX   = histFeedHBF  !== null ? hToX(histFeedHBF,  W, WH) : null;

  // Mode B: known peak — bell centred on that time, no feed point
  const knownPeakHBF: number | null = isLevain && starterKnownPeakTime
    ? (bakeMs - starterKnownPeakTime.getTime()) / 3600000 : null;

  // Depleted: trough time (starter flat from here)
  const depletedAtHBF: number | null = isLevain && starterIsDepletedAt
    ? (bakeMs - starterIsDepletedAt.getTime()) / 3600000 : null;

  // Refeed time for depleted state — fresh bell origin
  const refeedHBF: number | null = isLevain && starterRefeedTime
    ? (bakeMs - starterRefeedTime.getTime()) / 3600000 : null;

  // Effective peak for the active bell
  const effectiveStarterPeakHBF: number | null =
    knownPeakHBF !== null ? knownPeakHBF
    : activePeakHBF !== null ? activePeakHBF
    : null;

  // RT vs fridge comparison overlay values
  const compFridgeOutHBF: number | null =
    showFridgeComparison && comparisonFridgeOutTime
      ? (bakeMs - comparisonFridgeOutTime.getTime()) / 3600000
      : null;

  const compFridgePeakHBF: number | null =
    showFridgeComparison && comparisonFridgePeakTime
      ? (bakeMs - comparisonFridgePeakTime.getTime()) / 3600000
      : null;

  const fridgeInHBF: number | null = isLevain && starterFridgeInTime
    ? (bakeMs - starterFridgeInTime.getTime()) / 3600000
    : null;

  const fridgeHoldRefreshHBF: number | null = isLevain && starterFridgeHoldRefreshTime
    ? (bakeMs - starterFridgeHoldRefreshTime.getTime()) / 3600000 : null;
  const fridgeHoldInHBF: number | null = isLevain && starterFridgeHoldInTime
    ? (bakeMs - starterFridgeHoldInTime.getTime()) / 3600000 : null;
  const fridgeHoldOutHBF: number | null = isLevain && starterFridgeHoldOutTime
    ? (bakeMs - starterFridgeHoldOutTime.getTime()) / 3600000 : null;
  const isFridgeHoldPath = fridgeHoldRefreshHBF !== null && fridgeHoldInHBF !== null && fridgeHoldOutHBF !== null;

  // ── Focus ────────────────────────────────────────────────
  // A row's name button in the plan list focuses that step here: its diamond
  // gets a ring, its window appears, everything else drops back.
  const hasFocus = !!focusId;
  const dimOthers = (id: string) => hasFocus && focusId !== id;
  const opacityFor = (id: string) => (dimOthers(id) ? 0.4 : 1);

  // Short chart labels. The list carries the verb ("Make Poolish"); the chart
  // only has to say which curve this diamond belongs to.
  const shortPrefLabel = prefermentType === 'biga' ? t('shortLabels.biga')
    : isLevain ? t('shortLabels.starter')
    : t('shortLabels.poolish');
  const shortEventLabel = (kind: string, fallback: string): string => {
    switch (kind) {
      case 'last_fed':             return t('shortLabels.fed');
      case 'refresh':
      case 'intermediate_refresh': return t('shortLabels.refresh');
      case 'pre_mix':              return t('shortLabels.preMix');
      case 'known_peak':           return t('shortLabels.starter');
      default:                     return fallback;
    }
  };

  // A guide row whose layer has nothing to show is omitted — no fridge row on
  // a plan with no cold phase, no window row on a plan with no windows.
  const hasAnyCold = doughColdRanges.length > 0 || prefColdRanges.length > 0
    || (useEventDrivenStarter && starterEvents.some(e => e.kind === 'fridge_out'))
    || (isLevain && !!starterFridgeOutTime);
  const hasAnyWindow = hasDoughWindow || hasPrefWindow;

  // ── One label pass for the whole chart ───────────────────
  // Every marker's label goes through the same clamp → stagger → drop, so a
  // starter feed and Start Dough can never overlap each other.
  const labelItems: PackIn[] = [];
  if (hasPref && !isLevain && !knownPeakHBF) {
    labelItems.push({ x: activePrefX, text: shortPrefLabel, color: prefColor, key: 'pref', dim: dimOthers('pref') });
  }
  visibleStarterEvents.forEach(({ ev, idx, x }) => {
    const isHistorical = ev.kind === 'last_fed' && ev.isPast;
    labelItems.push({
      x,
      text: shortEventLabel(ev.kind, ev.label),
      color: isHistorical ? 'var(--smoke, #8A7F78)'
        : ev.kind === 'intermediate_refresh' ? '#4A7FA5'
        : ev.isActive ? prefColor : 'rgba(74,127,165,0.85)',
      key: `ev:${idx}`,
      dim: dimOthers(`ev:${idx}`),
    });
  });
  labelItems.push({ x: mixX, text: t('shortLabels.dough'), color: DARK_SAGE, key: 'mix', dim: dimOthers('mix'), anchor: true });
  labelItems.push({ x: bakeX, text: t('bakeLabel'), color: TERRA, key: 'bake', dim: dimOthers('bake'), anchor: true });

  function blockerHBF(b: AvailabilityBlock) {
    return {
      hbfStart: (bakeMs - b.from.getTime()) / 3600000,
      hbfEnd:   (bakeMs - b.to.getTime())   / 3600000,
    };
  }

  function inBlocker(hbf: number): boolean {
    return blocks.some(b => {
      const { hbfStart, hbfEnd } = blockerHBF(b);
      return hbf > hbfEnd && hbf <= hbfStart;
    });
  }

  // ── Day scale ────────────────────────────────────────────
  // The old evenly-spaced ticks were clock-aligned labels that bakers read as
  // event times — a documented trap. Replaced by day dividers at midnight
  // plus the day name for the stretch that starts there.
  const days: { x: number; dividerX: number | null; name: string }[] = [];
  {
    const windowStartMs = bakeMs - WH * 3600000;
    // First (usually partial) day: starts at the left edge of the window.
    const pushDay = (startMs: number, isDivider: boolean) => {
      const hbf = (bakeMs - startMs) / 3600000;
      const x = hToX(Math.max(0, Math.min(WH, hbf)), W, WH);
      days.push({
        x,
        dividerX: isDivider ? x : null,
        name: new Date(startMs)
          .toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' })
          .replace('.', '')
          .toUpperCase(),
      });
    };
    pushDay(windowStartMs, false);
    const firstMidnight = new Date(windowStartMs);
    firstMidnight.setHours(0, 0, 0, 0);
    firstMidnight.setDate(firstMidnight.getDate() + 1);
    for (let ms = firstMidnight.getTime(); ms < bakeMs; ms += 86400000) {
      pushDay(ms, true);
    }
  }

  // ── Pointer events ───────────────────────────────────────
  function getSvgX(e: React.PointerEvent): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return e.clientX - rect.left;
  }

  function onPointerDown(e: React.PointerEvent, which: 'mix' | 'pref' | 'refresh') {
    if (startTimeInPast) return;
    if (which === 'refresh' && !onRefreshChange) return;
    // Allow dragging a feed pinned at/near "now" forward — only refuse
    // genuinely historical positions (>1h before now). A Peak-2B feed is
    // stamped at solve time; seconds later it sat "in the past" and every
    // drag was silently swallowed while the hint promised draggability.
    if (which === 'pref' && (isLevain ? activeFeedHBF ?? prefStartAbsHBF : prefStartAbsHBF) > nowHBF + 1) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedMarker(which);
    setDragging(which);
    (e.target as Element).setPointerCapture(e.pointerId);
    onDragStart?.();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    const x = getSvgX(e);
    if (dragging === 'mix') {
      const h = Math.max(1, Math.min(nowHBF - 0.25, snap15(xToHBF(x, W, WH))));
      setLocalMixHBF(h);
    } else if (dragging === 'refresh') {
      const h = Math.max(0.25, Math.min(nowHBF, snap15(xToHBF(x, W, WH))));
      setLocalRefreshHBF(h);
    } else {
      const abs = Math.max(effectiveMixHBF + 0.25, Math.min(nowHBF, WH - 0.05, snap15(xToHBF(x, W, WH))));
      onPrefChange(abs - effectiveMixHBF);
    }
  }

  function onPointerUp() {
    onDragEnd?.();
    if (dragging === 'mix' && localMixHBF !== null) {
      onMixChange(localMixHBF);
      setLocalMixHBF(null);
    } else if (dragging === 'pref') {
      /* committed live on move — nothing to flush on release */
    } else if (dragging === 'refresh') {
      if (localRefreshHBF !== null) onRefreshChange?.(localRefreshHBF);
      setLocalRefreshHBF(null);
    }
    setDragging(null);
  }

  // The mix/pref STATUS strings and the info-card values lived here. Both
  // fed the green/gold pills on the old boxed cards; the plan list carries no
  // pills, so the engine's own work is no longer narrated back at the baker.

  // ── Window lane renderer ─────────────────────────────────
  // A rounded bar in the event's own colour spanning the range the engine
  // already computes, with a tick at the optimum. Drawn only where a real
  // range exists — sourdough starter feeds have none, and get none.
  function renderWindow(
    fromHBF: number, toHBF: number, optHBF: number,
    color: string, solo: boolean,
  ) {
    const x1 = Math.max(PAD, hToX(fromHBF, W, WH));
    const x2 = Math.min(W - PAD, hToX(toHBF, W, WH));
    if (!(x2 > x1 + 2)) return null;
    const optX = hToX(optHBF, W, WH);
    return (
      <g>
        <rect
          x={x1} y={WIN_LANE_Y} width={x2 - x1} height={WIN_LANE_H} rx={WIN_LANE_H / 2}
          fill={color} opacity={solo ? 0.6 : 0.26}
        />
        {optX >= x1 && optX <= x2 && (
          <line
            x1={optX} y1={WIN_LANE_Y - 1} x2={optX} y2={WIN_LANE_Y + WIN_LANE_H + 1}
            stroke={color} strokeWidth={1.5} opacity={solo ? 0.9 : 0.45}
          />
        )}
      </g>
    );
  }

  // ── Diamond renderer ─────────────────────────────────────
  // Shape carries kind, colour carries curve. A cream stroke always separates
  // a marker from whatever sits behind it.
  function renderDiamond(
    cx: number, fill: string, warn: boolean,
    which: 'mix' | 'pref', disabled = false, id = which as string,
    size = S,
  ) {
    const focused = focusId === id || selectedMarker === which;
    const op = opacityFor(id);
    return (
      <g role="slider" onFocus={() => setSelectedMarker(which)} tabIndex={startTimeInPast || disabled ? -1 : 0}
        aria-label={which==='mix'?(isFr?'Heure du mélange':'Mixing time'):(isFr?'Heure du préferment':'Preferment time')}
        aria-valuemin={0} aria-valuemax={Math.max(1,nowHBF)} aria-valuenow={which==='mix'?effectiveMixHBF:prefStartAbsHBF}
        aria-valuetext={fmtDT(new Date(bakeMs-(which==='mix'?effectiveMixHBF:prefStartAbsHBF)*3600000),isFr)}
        onKeyDown={event=>{if(startTimeInPast||disabled||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const delta=event.key==='ArrowLeft'?.25:-.25;setSelectedMarker(which);if(which==='mix')onMixChange(Math.max(1,Math.min(nowHBF-.25,effectiveMixHBF+delta)));else onPrefChange(Math.max(.25,Math.min(nowHBF-effectiveMixHBF,prefOffsetH+delta)));}}
        style={{
          touchAction:'none',
          cursor: startTimeInPast ? 'default'
            : (disabled ? 'not-allowed' : dragging === which ? 'grabbing' : 'grab'),
          opacity: startTimeInPast ? 0.6 : 1,
        }}
        onPointerDown={e => onPointerDown(e, which)}
      >
        <rect x={cx-22} y={BL-22} width={44} height={44} fill="transparent"/>
        {/* A step inside a busy window gets a dashed ring — shown when the
            busy layer is on OR whenever that step is in focus, so the
            conflict is never invisible. */}
        {warn && (L.busy || focused) && (
          <circle cx={cx} cy={BL} r={15} fill="none"
            stroke="#9A7010" strokeWidth={1.3} strokeDasharray="2.5 2.5" opacity={op} />
        )}
        {focused && (
          <circle cx={cx} cy={BL} r={19} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.4} />
        )}
        <polygon
          points={`${cx},${BL - size} ${cx + size},${BL} ${cx},${BL + size} ${cx - size},${BL}`}
          fill={fill} stroke="var(--cream, #F5F0E8)" strokeWidth={1.6} opacity={op}
        />
      </g>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', overflow: 'hidden', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
      <svg ref={svgRef} width={W} height={hasPref?CHART_H:CHART_H-60} aria-label={isFr ? 'Durées de préparation et de fermentation' : 'Preparation and fermentation timeline'}
        style={{display:'block',touchAction:'pan-y'}} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <g transform={hasPref?undefined:"translate(0,-60)"}>
        {days.map((day,i)=><g key={i}>
          {day.dividerX !== null && <line x1={day.dividerX} x2={day.dividerX} y1={16} y2={148} stroke="var(--border)" strokeDasharray="3 4"/>}
          {(!days[i+1] || days[i+1].x-day.x>36) && <text x={Math.min(W-40,day.x+4)} y={174} fontSize={11} fill="var(--ash)">{day.name}</text>}
        </g>)}
        {(layers.busy || dragging) && blocks.map((block,i)=>{const h=blockerHBF(block);const x1=Math.max(PAD,hToX(h.hbfStart,W,WH)),x2=Math.min(W-PAD,hToX(h.hbfEnd,W,WH));return x2>x1?<rect key={i} x={x1} y={16} width={x2-x1} height={132} fill="var(--smoke)" opacity={.12}/>:null;})}
        {hasPref && <>
          <text x={PAD} y={22} fontSize={13} fill="var(--ash)">{isLevain ? (isFr?'Levain':'Starter') : prefermentType==='biga'?'Biga':'Poolish'}</text>
          <rect x={Math.max(PAD,prefLaneX)} y={34} width={Math.max(2,mixX-Math.max(PAD,prefLaneX))} height={18} rx={5} fill={prefColor} opacity={.7}/>
          {prefColdRanges.map(([a,b],i)=><rect key={i} x={Math.max(PAD,Math.min(a,b))} y={34} width={Math.max(0,Math.min(mixX,Math.max(a,b))-Math.max(PAD,Math.min(a,b)))} height={18} rx={4} fill="#4A7FA5"/>)}
        </>}
        <text x={PAD} y={80} fontSize={13} fill="var(--ash)">{isFr?'Pâte':'Dough'}</text>
        <rect x={mixX} y={92} width={Math.max(2,bakeX-mixX)} height={18} rx={5} fill={SAGE}/>
        {doughColdRanges.map(([a,b],i)=><rect key={i} x={Math.max(mixX,Math.min(a,b))} y={92} width={Math.max(0,Math.min(bakeX,Math.max(a,b))-Math.max(mixX,Math.min(a,b)))} height={18} rx={4} fill="#4A7FA5"/>)}
        <line x1={PAD} x2={W-PAD} y1={BL} y2={BL} stroke="var(--border)"/>
        {hasPref && !isLevain && renderDiamond(activePrefX,prefColor,inBlocker(prefStartAbsHBF),'pref')}
        {useEventDrivenStarter && visibleStarterEvents.map(({ev,idx,x})=><g key={idx}>
          <line x1={x} x2={x} y1={54} y2={BL} stroke={prefColor} opacity={.25}/>
          <circle cx={x} cy={BL} r={ev.isDraggable?10:5} fill={prefColor} opacity={ev.isPast?.45:1}
            role={ev.isDraggable?'slider':undefined} tabIndex={ev.isDraggable&&!startTimeInPast?0:undefined}
            aria-label={ev.label} aria-valuemin={0} aria-valuemax={Math.max(1,nowHBF)} aria-valuenow={(bakeMs-+ev.time)/3600000}
            aria-valuetext={fmtDT(ev.time,isFr)}
            onKeyDown={event=>{if(!ev.isDraggable||startTimeInPast||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const h=Math.max(.25,Math.min(nowHBF,(bakeMs-+ev.time)/3600000+(event.key==='ArrowLeft'?.25:-.25)));if(ev.kind==='refresh')onRefreshChange?.(h);else onPrefChange(Math.max(.25,h-effectiveMixHBF));}}
            style={{touchAction:'none',cursor:ev.isDraggable?'grab':'default'}}
            onPointerDown={ev.isDraggable?e=>onPointerDown(e,ev.kind==='refresh'?'refresh':'pref'):undefined}/>
        </g>)}
        {hasPref && isLevain && !useEventDrivenStarter && renderDiamond(activePrefX,prefColor,inBlocker(prefStartAbsHBF),'pref')}
        {renderDiamond(mixX,DARK_SAGE,inBlocker(effectiveMixHBF),'mix')}
        <polygon points={`${bakeX-8},${BL-10} ${bakeX+8},${BL-10} ${bakeX},${BL+3}`} fill={TERRA}/>
        </g>
      </svg>
      <div style={{display:'flex',flexWrap:'wrap',gap:12,fontSize:12,color:'var(--ash)',margin:'0 0 8px'}}>
        <span>{isFr?'Les barres montrent les durées, pas la maturité.':'Bars show duration, not readiness.'}</span>
        {hasAnyCold && <span><span aria-hidden="true" style={{display:'inline-block',width:12,height:8,background:'#4A7FA5',marginRight:5}}/>{isFr?'Au réfrigérateur':'In the fridge'}</span>}
      </div>
      <div aria-live="polite" aria-atomic="true" style={{fontSize:14,lineHeight:1.4}}>
        {(() => {
          const actions: Array<{key:string;name:string;hbf:number}> = [];
          if (hasPref && isLevain && starterEvents.length) {
            starterEvents.filter(event=>event.kind!=='known_peak').forEach((event,i)=>actions.push({key:`starter-${i}`,name:event.label,hbf:event.kind==='refresh' && localRefreshHBF!==null?localRefreshHBF:(bakeMs-+event.time)/3600000}));
          } else if (hasPref) actions.push({key:'pref',name:isLevain?(isFr?'Préparer le levain':'Prepare starter'):prefermentType==='biga'?(isFr?'Préparer la biga':'Prepare biga'):(isFr?'Préparer le poolish':'Prepare poolish'),hbf:prefStartAbsHBF});
          if (hasPref && !isLevain && prefNeedsFridge && prefermentFridgeOutTime) {
            actions.push({key:'pref-fridge-out',name:isFr
              ? `Sortir ${prefermentType==='biga'?'la biga':'le poolish'} du réfrigérateur`
              : `Take ${prefermentType==='biga'?'biga':'poolish'} out of the fridge`,hbf:(bakeMs-+prefermentFridgeOutTime)/3600000});
          }
          actions.push({key:'mix',name:isFr?'Mélanger la pâte':'Mix the dough',hbf:effectiveMixHBF},{key:'bake',name:isFr?'Cuire':'Bake',hbf:0});
          return actions.sort((a,b)=>b.hbf-a.hbf).map(action=><div key={action.key} style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:'2px 12px',padding:'8px 0',borderTop:'1px solid var(--border)',color:inBlocker(action.hbf)?'var(--terra)':'var(--char)'}}>
            <strong style={{fontWeight:action.key===dragging?700:500}}>{action.name}</strong><span>{fmtDT(new Date(bakeMs-action.hbf*3600000),isFr)}</span>
            {inBlocker(action.hbf)&&<span style={{width:'100%',fontSize:12}}>{isFr?'Créneau occupé':'Busy time'}</span>}
          </div>);
        })()}
      </div>
      {doughColdIntervals.length>0 && <details style={{fontSize:13,lineHeight:1.5,marginTop:4}}>
        <summary style={{minHeight:44,cursor:'pointer'}}>{isFr?'Pâte : horaires au réfrigérateur':'Dough: fridge times'}</summary>
        {doughColdIntervals.map((interval,i)=><div key={i} style={{padding:'6px 0',borderTop:'1px solid var(--border)'}}>
          <div>{isFr?'Mettre au frais':'Refrigerate'} · {fmtDT(interval.from,isFr)}</div>
          <div>{isFr?'Sortir du réfrigérateur':'Remove from fridge'} · {fmtDT(interval.to,isFr)}</div>
        </div>)}
      </details>}
      {showReset && onReset && <button type="button" onClick={onReset} style={{minHeight:44,background:'none',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',marginTop:8,color:'var(--terra)'}}>{t('reset')}</button>}
      <details style={{marginTop:8,fontSize:13,lineHeight:1.5}}><summary style={{minHeight:44,cursor:'pointer'}}>{isFr?'Ajuster le planning':'Adjust the schedule'}</summary>
        <p>{isFr?'Glissez un losange : les horaires ci-dessus se mettent à jour. Au clavier, utilisez les flèches gauche et droite par pas de 15 minutes.':'Drag a diamond to update the times above. With a keyboard, use left and right arrows in 15-minute steps.'}</p>
        <label style={{display:'flex',alignItems:'center',gap:8,minHeight:44}}><input type="checkbox" checked={layers.busy} onChange={event=>setLayers(prev=>({...prev,busy:event.target.checked}))}/>{isFr?'Afficher mes indisponibilités':'Show my busy times'}</label>
      </details>
    </div>
  );
}
