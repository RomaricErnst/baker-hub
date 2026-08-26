'use client';
import { useRef, useEffect, useState, useId } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type AvailabilityBlock } from '../utils';
import type { StarterEvent } from './SchedulePicker';

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
const CHART_H   = 164;  // baseline + now tick + day-name row

// Diamond labels now sit ABOVE the axis (over the curves, with a cream halo),
// so there are no label rows below the axis to make room for.
const LABEL_Y      = BL - 17;  // lane 0
const LABEL_LANE_H = 14;       // lane 1 sits this much higher

// DOUGH_SIG and DOUGH_SWEET_CENTER are computed inside the component
// based on hasColdRetard — see derived physics section

// Diamond half-diagonal. Matches the settled prototype's marker size once its
// 320-unit viewBox is scaled to a 360px phone (21.2 units ≈ 24px across).
const S = 12;

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
  const CW = 6.2;   // DM Mono 10px ≈ 6.2px/char
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
  nowHBF = 999, phases, scheduleNote,
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

  // ── Chart layers ─────────────────────────────────────────
  // All three off by default: the resting chart is curves, diamonds and the
  // day scale, nothing else. The baker's selection persists in localStorage
  // (works signed out, no schema) — a later move into the F1 baker profile is
  // a one-line migration of load/save below.
  const [layers, setLayers] = useState<ChartLayers>({ fridge: false, busy: false, window: false });
  const [everOpened, setEverOpened] = useState(false);
  const layersHydrated = useRef(false);

  useEffect(() => {
    // Deferred to after paint on purpose. Server and client both render the
    // all-off default, so there is no hydration mismatch; the saved selection
    // is applied on the next frame.
    const raf = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(LAYERS_KEY);
        if (raw) {
          const p = JSON.parse(raw) as Partial<ChartLayers> & { everOpened?: boolean };
          setLayers({ fridge: !!p.fridge, busy: !!p.busy, window: !!p.window });
          setEverOpened(!!p.everOpened);
        }
      } catch { /* private mode / corrupt value — defaults are fine */ }
      layersHydrated.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!layersHydrated.current) return;
    try {
      window.localStorage.setItem(LAYERS_KEY, JSON.stringify({ ...layers, everOpened }));
    } catch { /* storage full or blocked — the chart still works */ }
  }, [layers, everOpened]);

  // While dragging, all three switch on temporarily: that is the one moment
  // all of them are genuinely needed (still in its window? just dropped into
  // work hours? after now?). The baker's saved selection is untouched.
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
  const prefColor  = isLevain ? '#4A7FA5' : '#C4A030';
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
    ? getPrefOptH(prefermentType, kitchenTemp, true)
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
  const prefOptHFridge = getPrefOptH(prefermentType, kitchenTemp, true);
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

  // ── Cold ranges, per curve ───────────────────────────────
  // Each entry is an [x1, x2] pixel span of the SAME curve that is in the
  // fridge. The dough's cold retard sits between the end of bulk and the end
  // of the retard; a fridge preferment is cold for its whole span. Sourdough
  // starter bells carry their own hold and are cased in the event-bell block.
  const doughColdRanges: Array<[number, number]> = [];
  if (hasColdRetard && phases && phases.coldRetardH > 0) {
    const coldStartHBF = effectiveMixHBF - (phases.bulkFermH ?? 0);
    const coldEndHBF   = Math.max(0, coldStartHBF - phases.coldRetardH);
    if (coldStartHBF > coldEndHBF) {
      doughColdRanges.push([hToX(coldStartHBF, W, WH), hToX(coldEndHBF, W, WH)]);
    }
  }
  const prefColdRanges: Array<[number, number]> = [];
  if (hasPref && !isLevain && prefNeedsFridge) {
    prefColdRanges.push([hToX(prefStartAbsHBF, W, WH), hToX(effectiveMixHBF, W, WH)]);
  }

  // ── Pixel positions ──────────────────────────────────────
  const mixX  = hToX(effectiveMixHBF, W, WH);
  const prefX = hasPref ? hToX(prefStartAbsHBF, W, WH) : 0;
  const bakeX = hToX(0, W, WH);

  // ── Blocker helpers ──────────────────────────────────────
  const bakeMs = eatTime.getTime();

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
      return hbf > hbfEnd && hbf < hbfStart;
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
    if (which === 'pref' && prefStartAbsHBF > nowHBF + 1) return;
    e.preventDefault();
    e.stopPropagation();
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
      const abs = Math.min(WH - 0.05, snap15(xToHBF(x, W, WH)));
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
    const focused = focusId === id;
    const op = opacityFor(id);
    return (
      <g
        style={{
          cursor: startTimeInPast ? 'default'
            : (disabled ? 'not-allowed' : dragging === which ? 'grabbing' : 'grab'),
          opacity: startTimeInPast ? 0.6 : 1,
        }}
        onPointerDown={e => onPointerDown(e, which)}
      >
        {/* A step inside a busy window gets a dashed ring — shown when the
            busy layer is on OR whenever that step is in focus, so the
            conflict is never invisible. */}
        {warn && (L.busy || focused) && (
          <circle cx={cx} cy={BL} r={12} fill="none"
            stroke="#9A7010" strokeWidth={1.2} strokeDasharray="2.5 2.5" opacity={op} />
        )}
        {focused && (
          <circle cx={cx} cy={BL} r={15} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.4} />
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
      {/* No permanent legend row — the guide panel below doubles as the
          legend, with each swatch drawn exactly as it appears here. */}
      <svg
        ref={svgRef}
        width={W}
        height={CHART_H}
        style={{ display: 'block', touchAction: 'none', overflow: 'visible' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* ── Clip paths for blockers ── */}
        <defs>
          {/* Cold casings — ONE clipPath per curve, built from that curve's
              OWN cold ranges. Cold belongs to a curve, not to a time span: a
              poolish already mixed in must not pick up a casing for the
              dough's cold retard. */}
          <clipPath id={`cold-dough-${chartId}`}>
            {doughColdRanges.map(([a, b], i) => (
              <rect key={i} x={Math.min(a, b)} y={0} width={Math.abs(b - a)} height={AXIS_Y} />
            ))}
          </clipPath>
          <clipPath id={`cold-pref-${chartId}`}>
            {prefColdRanges.map(([a, b], i) => (
              <rect key={i} x={Math.min(a, b)} y={0} width={Math.abs(b - a)} height={AXIS_Y} />
            ))}
          </clipPath>
          {/* Chart area clip — hide anything below axis */}
          <clipPath id={`chart-area-clip-${chartId}`}>
            <rect x={0} y={0} width={W} height={AXIS_Y} />
          </clipPath>
          {/* Bell clip paths — hide left tail before each diamond */}
          <clipPath id={`dough-bell-clip-${chartId}`}>
            <rect x={hToX(effectiveMixHBF, W, WH)} y={0} width={W} height={CHART_H} />
          </clipPath>
          {hasPref && (
            <clipPath id={`pref-bell-clip-${chartId}`}>
              <rect x={hToX(prefStartAbsHBF, W, WH)} y={0} width={W} height={CHART_H} />
            </clipPath>
          )}
          {!useEventDrivenStarter && isLevain && starterIntermediateFeeds.map((ft, idx) => {
            const leftX = hToX((bakeMs - ft.getTime()) / 3600000, W, WH);
            return (
              <clipPath key={`rbc-${idx}`} id={`refresh-bell-clip-${chartId}-${idx}`}>
                <rect x={leftX} y={0} width={Math.max(0, W - leftX)} height={CHART_H} />
              </clipPath>
            );
          })}
        </defs>

        {/* ── Bake reference line ── */}
        <line x1={bakeX} y1={TOP_PAD} x2={bakeX} y2={AXIS_Y}
          stroke={TERRA} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.25} />

        {/* ── Mix reference line (hasPref only) ── */}
        {hasPref && (
          <line x1={mixX} y1={TOP_PAD} x2={mixX} y2={AXIS_Y}
            stroke={CHAR} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.2} />
        )}

        {/* ── Window lane ──────────────────────────────────
             Only where the engine already computes a range: Make Poolish from
             getPrefOptH/prefZoneMax, Start Dough from sweetFrom/sweetTo.
             Sourdough starter feeds have no such range and get no window. */}
        {(L.window || focusId === 'mix') && hasDoughWindow && renderWindow(
          doughZoneFrom, doughZoneTo, DOUGH_SWEET_CENTER, SAGE, focusId === 'mix',
        )}
        {(L.window || focusId === 'pref') && hasPrefWindow && renderWindow(
          prefZoneFrom, prefZoneTo, prefOptWindowHBF, prefColor, focusId === 'pref',
        )}

        {/* ── Busy columns ── full height, no WORK / NIGHT text: the labels
             collided with curve peaks and with `now`, and the layer is only
             ever visible because the baker just ticked it on. ── */}
        {L.busy && blocks.map((b, i) => {
          const { hbfStart, hbfEnd } = blockerHBF(b);
          const x1 = Math.max(PAD, hToX(Math.min(hbfStart, WH), W, WH));
          const x2 = Math.min(W - PAD, hToX(Math.max(hbfEnd, 0), W, WH));
          if (x2 <= x1) return null;
          return (
            <rect key={i} x={x1} y={TOP_PAD} width={x2 - x1} height={BL - TOP_PAD}
              fill={BUSY_FILL} opacity={0.11} />
          );
        })}

        {/* ── Pref bell (drawn first so dough overlaps) ── */}
        {hasPref && (
          <>
            {/* Path B: Refresh → Fridge Hold → Pre-mix Feed visualization */}
            {!useEventDrivenStarter && isFridgeHoldPath && fridgeHoldRefreshHBF !== null && fridgeHoldInHBF !== null && fridgeHoldOutHBF !== null && (() => {
              const refreshX = hToX(fridgeHoldRefreshHBF, W, WH);
              const fridgeInX = hToX(fridgeHoldInHBF, W, WH);
              const fridgeOutX = hToX(fridgeHoldOutHBF, W, WH);
              const refreshPeakHBF = fridgeHoldRefreshHBF - effectivePeakH_refresh;
              return (
                <g>
                  {/* Refresh bell clipped to refresh → fridge-in window */}
                  <defs>
                    <clipPath id={`pathb-refresh-clip-${chartId}`}>
                      <rect x={refreshX} y={0} width={Math.max(0, fridgeInX - refreshX)} height={CHART_H} />
                    </clipPath>
                  </defs>
                  {(() => {
                    const rbD = makeBellPath(refreshPeakHBF, starterSigmaH_refresh, W, WH, fridgeHoldRefreshHBF);
                    return (
                      <g clipPath={`url(#pathb-refresh-clip-${chartId})`}>
                        <path d={rbD} fill="rgba(74,127,165,0.08)" stroke="none" />
                        <path d={openBell(rbD)} fill="none" stroke="rgba(74,127,165,0.35)"
                          strokeWidth={1} strokeDasharray="2 3" />
                      </g>
                    );
                  })()}
                  {/* Cold storage flat region from fridge-in to fridge-out */}
                  <rect
                    x={fridgeInX}
                    y={AXIS_Y - 12}
                    width={Math.max(0, fridgeOutX - fridgeInX)}
                    height={12}
                    fill="rgba(150,180,210,0.20)"
                  />
                  {/* Fridge-in marker */}
                  <line
                    x1={fridgeInX} y1={AXIS_Y - 12}
                    x2={fridgeInX} y2={AXIS_Y}
                    stroke="rgba(74,127,165,0.6)"
                    strokeWidth={1.5}
                  />
                  {/* Fridge-out marker */}
                  <line
                    x1={fridgeOutX} y1={AXIS_Y - 12}
                    x2={fridgeOutX} y2={AXIS_Y}
                    stroke="rgba(74,127,165,0.6)"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })()}

            {/* ── Intermediate refresh cycle bells (drawn below hist + active) ── */}
            {!useEventDrivenStarter && isLevain && starterIntermediateFeeds.length > 0 && starterIntermediateFeeds.map((ft, idx) => {
              const hbf = (bakeMs - ft.getTime()) / 3600000;
              if (hbf <= 0 || hbf > WH) return null;
              const rbD = makeBellPath(hbf - effectivePeakH_refresh, starterSigmaH_refresh, W, WH, hbf);
              return (
                <g key={`rb-${idx}`} clipPath={`url(#refresh-bell-clip-${chartId}-${idx})`}>
                  <path d={rbD} fill="rgba(74,127,165,0.06)" stroke="none" />
                  <path
                    d={openBell(rbD)}
                    fill="none"
                    stroke="rgba(74,127,165,0.25)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                </g>
              );
            })}

            {/* ── Event-driven bells (sourdough, one per starterEvent) ── */}
            {useEventDrivenStarter && (() => {
              return (
                <>
                  {/* The old baseline cold strip + "fridge" caption lived
                      here. Cold is now drawn ON the curve it belongs to, as a
                      casing clipped to that curve's own hold — a condition of
                      the dough, not an event on the axis. */}
                  {/* Bells — one per event with bellStyle !== 'none' */}
                  {starterEvents.map((ev, idx) => {
                    if (ev.bellStyle === 'none' || !ev.bellPeakTime) return null;
                    const bellStartMs = (ev.bellStartTime ?? ev.time).getTime();
                    const feedHBF = (bakeMs - bellStartMs) / 3600000;
                    const peakHBF = (bakeMs - ev.bellPeakTime.getTime()) / 3600000;
                    if (feedHBF <= 0 || feedHBF > WH) return null;
                    const sigma = starterSigmaH * ev.bellSigmaScale;
                    const fillStyle = ev.bellStyle === 'solid' ? `${prefColor}2E` :
                                       ev.bellStyle === 'dotted' ? `${prefColor}14` :
                                       'rgba(74,127,165,0.08)';
                    const strokeStyle = ev.bellStyle === 'solid' ? `${prefColor}A5` :
                                         ev.bellStyle === 'dotted' ? `${prefColor}80` :
                                         'rgba(74,127,165,0.30)';
                    const strokeWidth = ev.bellStyle === 'solid' ? 1.5 : 1;
                    const dashArray = ev.bellStyle === 'solid' ? undefined :
                                       ev.bellStyle === 'dotted' ? '3 3' :
                                       '3 3';
                    // Per-event fridge-hold detection: this bell "owns" the
                    // following fridge_in / fridge_out pair iff its peak lines
                    // up with the next fridge_in (within 2h) and a fridge_out
                    // follows. The old ev.hasFridgePhase flag is never set by
                    // the engine, and the scalar fridgeOutHBF /
                    // feedToFridgeOutH derived from starterFeedTime point at
                    // the ORIGINAL last_fed — not the refresh whose peak goes
                    // into the fridge. Walking the events array here gives
                    // each bell its own hold AND the per-event geometry that
                    // makeFridgePhaseBellPath needs.
                    //
                    // CARD-ALIGNMENT INVARIANT: the card renders INTO FRIDGE
                    // from _fridgeHoldInTime and OUT OF FRIDGE from
                    // _fridgeHoldOutTime (SchedulePicker), and the engine
                    // emits the fridge_in / fridge_out events from those SAME
                    // values — so the cold-phase span on the curve equals the
                    // card's stated times by construction. Never recompute
                    // fridge times in the chart from anything else.
                    const myIdx = idx;
                    const nextFridgeIn  = starterEvents.find((e, j) => j > myIdx && e.kind === 'fridge_in');
                    const nextFridgeOut = starterEvents.find((e, j) => j > myIdx && e.kind === 'fridge_out');
                    // Topology, not proximity: this bell owns the following
                    // fridge_in/out iff it is the LAST bell-bearing event
                    // before that fridge_in (no other bell sits between).
                    // The previous 2h-to-peak heuristic assumed the bell
                    // peaks at RT then gets chilled AT peak — true for
                    // refresh→fridge, but for fed-straight-into-fridge
                    // (Fridge / Today or Yesterday) fridge_in = the feed
                    // and the peak is the COLD peak ~42h later, so the gap
                    // is ~42h → ownsHold falsed → the cold curve never
                    // rendered and the bell collapsed to a flat baseline
                    // dotted line. Topology handles both cases: last_fed
                    // owns when there's no refresh between it and
                    // fridge_in; the refresh owns when there is.
                    const fiIdx = nextFridgeIn ? starterEvents.indexOf(nextFridgeIn) : -1;
                    const noBellBetween = fiIdx > idx && !starterEvents.some((e, j) =>
                      j > idx && j < fiIdx && e.bellStyle && e.bellStyle !== 'none');
                    // ev.bellStyle is already narrowed away from 'none' by
                    // the early `if (ev.bellStyle === 'none') return null;`
                    // at the top of this map callback.
                    const ownsHold = !!nextFridgeIn && !!nextFridgeOut
                      && nextFridgeOut.time.getTime() > nextFridgeIn.time.getTime()
                      && nextFridgeIn.time.getTime() >= bellStartMs
                      && noBellBetween;
                    const fridgeInHBF_ev       = ownsHold && nextFridgeIn  ? (bakeMs - nextFridgeIn.time.getTime())  / 3600000 : null;
                    const fridgeOutHBF_ev      = ownsHold && nextFridgeOut ? (bakeMs - nextFridgeOut.time.getTime()) / 3600000 : null;
                    // Sub-case split: a starter chilled AT its RT peak
                    // (ev.bellPeakTime ≈ fridge_in within 2h) plateaus +
                    // gently declines through the hold — it does NOT re-rise
                    // in the cold. makeFridgePhaseBellPath centres a cold
                    // gaussian at feedHBF − fridgePeakH (the cold peak hours
                    // after feed) which is only correct when fed straight
                    // into the fridge (peak well AFTER fridge_in). Routing
                    // chilled-at-peak through that function landed a wrong
                    // mid-hold cold peak and a sharp post-peak drop.
                    const chilledAtPeak = ownsHold && fridgeInHBF_ev !== null
                      && Math.abs(ev.bellPeakTime.getTime() - nextFridgeIn!.time.getTime()) <= 2 * 3600000;
                    // Cold-phase geometry MUST come from the event's own
                    // bellPeakTime (card-aligned). Passing the chart-level
                    // fridgePeakH re-derived the peak with the NEXT feed's
                    // optimized ratio — the bell peaked ~10h later than the
                    // card said for a fed-straight-into-fridge starter.
                    const feedToPeakH_ev = Math.max(1, feedHBF - peakHBF);
                    // Fridge-history last_fed: the engine flags hasFridgePhase
                    // when the starter sat in the fridge since this feed — a
                    // historical fact. Draw the fridge-phase shape even when
                    // the winning plan emits no fridge_in/out events (e.g. a
                    // blocker flipped the winner to a refresh-only plan), so
                    // the PAST bell is identical across plan/blocker changes.
                    // Same call and args as the ownsHold branch → same shape.
                    const fridgeHistoryBell =
                      ev.kind === 'last_fed' && !!ev.hasFridgePhase;
                    const bellD =
                      ownsHold && fridgeOutHBF_ev !== null && fridgeInHBF_ev !== null && chilledAtPeak
                        ? makeBellWithFridgePlateau(peakHBF, sigma, fridgeInHBF_ev, fridgeOutHBF_ev, W, WH, feedHBF)
                        : (ownsHold && fridgeOutHBF_ev !== null) || fridgeHistoryBell
                          ? makeFridgePhaseBellPath(feedHBF, peakHBF, feedToPeakH_ev, feedToPeakH_ev * 0.4, W, WH)
                          : makeBellPath(peakHBF, sigma, W, WH, feedHBF);
                    // Cold casing for THIS bell's own hold. ownsHold is the
                    // topology check that already decides which bell the
                    // fridge_in/out pair belongs to — reusing it means a bell
                    // can never inherit a neighbour's cold phase.
                    const coldCasing = L.fridge
                      && ownsHold && fridgeInHBF_ev !== null && fridgeOutHBF_ev !== null
                      ? (() => {
                          const xa = hToX(fridgeInHBF_ev, W, WH);
                          const xb = hToX(fridgeOutHBF_ev, W, WH);
                          const cid = `cold-ev-${chartId}-${idx}`;
                          return (
                            <>
                              <defs>
                                <clipPath id={cid}>
                                  <rect x={Math.min(xa, xb)} y={0} width={Math.abs(xb - xa)} height={AXIS_Y} />
                                </clipPath>
                              </defs>
                              <g clipPath={`url(#${cid})`}>
                                <path d={openBell(bellD)} fill="none" stroke={COLD_STROKE}
                                  strokeWidth={5.5} strokeOpacity={0.32} strokeLinecap="round" />
                              </g>
                            </>
                          );
                        })()
                      : null;
                    // Solid (active) bell: the starter is consumed at Start
                    // Dough — fade the curve after mixX so the "what if
                    // unused" tail reads as hypothetical, not as noise.
                    if (ev.bellStyle === 'solid' && mixX > 0 && mixX < W) {
                      return (
                        <g key={`ev-bell-${idx}`} clipPath={`url(#chart-area-clip-${chartId})`}>
                          <defs>
                            <clipPath id={`premix-clip-${chartId}-${idx}`}>
                              <rect x={0} y={0} width={Math.max(0, mixX)} height={CHART_H} />
                            </clipPath>
                            <clipPath id={`postmix-clip-${chartId}-${idx}`}>
                              <rect x={Math.max(0, mixX)} y={0} width={Math.max(0, W - mixX)} height={CHART_H} />
                            </clipPath>
                          </defs>
                          {/* fill (closed path) and stroke (open path) are
                              separated so the baseline closing run is never
                              stroked — it drew a stray horizontal line at the
                              axis. */}
                          <path
                            d={bellD}
                            fill={fillStyle} stroke="none"
                            clipPath={`url(#premix-clip-${chartId}-${idx})`}
                          />
                          {coldCasing}
                          <path
                            d={openBell(bellD)}
                            fill="none" stroke={strokeStyle}
                            strokeWidth={strokeWidth} strokeDasharray={dashArray}
                            clipPath={`url(#premix-clip-${chartId}-${idx})`}
                          />
                          <path
                            d={bellD}
                            fill={`${prefColor}10`} stroke="none"
                            clipPath={`url(#postmix-clip-${chartId}-${idx})`}
                          />
                          <path
                            d={openBell(bellD)}
                            fill="none" stroke={`${prefColor}45`}
                            strokeWidth={1} strokeDasharray="3 3"
                            clipPath={`url(#postmix-clip-${chartId}-${idx})`}
                          />
                        </g>
                      );
                    }
                    return (
                      <g key={`ev-bell-${idx}`} clipPath={`url(#chart-area-clip-${chartId})`}>
                        <path d={bellD} fill={fillStyle} stroke="none" />
                        {coldCasing}
                        <path
                          d={openBell(bellD)}
                          fill="none"
                          stroke={strokeStyle}
                          strokeWidth={strokeWidth}
                          strokeDasharray={dashArray}
                        />
                      </g>
                    );
                  })}
                </>
              );
            })()}

            {/* ── Muted historical bell — shows the spent cycle from Last Fed ── */}
            {!useEventDrivenStarter && isLevain && histPeakHBF !== null && histFeedHBF !== null && (() => {
              const histD = makeBellPath(histPeakHBF, starterSigmaH, W, WH, histFeedHBF);
              return (
                <g clipPath={`url(#chart-area-clip-${chartId})`}>
                  <path d={histD} fill="rgba(74,127,165,0.08)" stroke="none" />
                  <path
                    d={openBell(histD)}
                    fill="none"
                    stroke="rgba(74,127,165,0.30)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </g>
              );
            })()}

            {/* ── Depleted: flat dormant baseline + refresh bell + pre-mix bell ── */}
            {!useEventDrivenStarter && isLevain && depletedAtHBF !== null && activeFeedHBF !== null && (
              <>
                {/* Flat baseline from trough onward — starter dormant */}
                <line
                  x1={hToX(depletedAtHBF, W, WH)}
                  y1={BL}
                  x2={Math.max(
                    hToX(refeedHBF ?? depletedAtHBF, W, WH),
                    hToX(depletedAtHBF, W, WH)
                  )}
                  y2={BL}
                  stroke="rgba(74,127,165,0.12)"
                  strokeWidth={1}
                  strokeDasharray="2 5"
                />
                {/* Refresh bell — dotted, only when refresh is a distinct earlier
                    feed from the active (pre-mix) feed. Uses refresh stretch
                    (wider sigma, slightly later peak) per depleted-starter biology. */}
                {refeedHBF !== null && Math.abs(refeedHBF - activeFeedHBF) > 0.5 && (() => {
                  const refD = makeBellPath(
                    refeedHBF - effectivePeakH_refresh,
                    starterSigmaH_refresh, W, WH, refeedHBF
                  );
                  return (
                    <g clipPath={`url(#chart-area-clip-${chartId})`}>
                      <path d={refD} fill={`${prefColor}1A`} stroke="none" />
                      <path
                        d={openBell(refD)}
                        fill="none"
                        stroke={`${prefColor}80`}
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                    </g>
                  );
                })()}
                {/* Active pre-mix bell — solid, always rendered at active feed
                    position. This is the cycle that feeds the dough. */}
                {(() => {
                  const actD = makeBellPath(
                    activeFeedHBF - effectivePeakHStretched,
                    starterSigmaH * starterPreMixStretchFactor, W, WH, activeFeedHBF
                  );
                  return (
                    <g clipPath={`url(#chart-area-clip-${chartId})`}>
                      <path d={actD} fill={`${prefColor}2E`} stroke="none" />
                      <path
                        d={openBell(actD)}
                        fill="none"
                        stroke={`${prefColor}A5`}
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                })()}
              </>
            )}

            {/* ── Normal active bell (RT, fridge retard, or Mode B) ── */}
            {(!isLevain || (depletedAtHBF === null && !useEventDrivenStarter)) && (
              <>
                {/* Warmup + active bell (RT or after fridge removal, including fridge portion) */}
                {(() => {
                  const legacyBellD = (() => {
                    // When fridge comparison is showing, suppress this bell entirely —
                    // the comparison overlay is the single authoritative curve.
                    if (isLevain && showFridgeComparison) {
                      return `M0,${BL} L0,${BL}`; // empty path
                    }
                    if (isLevain && knownPeakHBF !== null) {
                      const syntheticFeedHBF = knownPeakHBF + effectivePeakH;
                      return makeBellPath(knownPeakHBF, starterSigmaH, W, WH, syntheticFeedHBF);
                    }
                    const peakHBF = isLevain && effectiveStarterPeakHBF !== null
                      ? effectiveStarterPeakHBF : prefPeakHBF;

                    if (isLevain && fridgeOutHBF !== null) {
                      const warmupSigma = Math.max(0.5, starterWarmupH * 0.4);
                      const feedHBF2 = activeFeedHBF ?? fridgeOutHBF + 24;
                      const N = 300;
                      const pts: string[] = [];
                      for (let i = 0; i <= N; i++) {
                        const hbf = (i / N) * feedHBF2;
                        let normH: number;
                        if (hbf >= fridgeOutHBF) {
                          // Fridge gaussian normalised so height at fridgeOutHBF = fridgeHeightAtRemoval,
                          // ensuring continuity with the RT warmup segment.
                          // Correct: bell center in HBF space = feedHBF2 - fridgePeakH
                          // (fridgePeakH hours before feed = where starter peaks if left in fridge forever)
                          const fridgeBellCenter = feedHBF2 - fridgePeakH;
                          const rawFridgeH = Math.exp(-0.5 * ((hbf - fridgeBellCenter) / fridgeSigma) ** 2);
                          const fridgeAtRemoval = Math.exp(-0.5 * ((fridgeOutHBF - fridgeBellCenter) / fridgeSigma) ** 2);
                          normH = fridgeAtRemoval > 0 ? rawFridgeH / fridgeAtRemoval * fridgeHeightAtRemoval : rawFridgeH;
                        } else {
                          // Correct model: one continuous fermentation cycle.
                          // In fridge: progresses at 1/coldFactor speed.
                          // After removal: progresses at full RT speed.
                          // Accumulated fridge time at removal = feedToFridgeOutH.
                          // After removal, each real hour = 1 RT hour.
                          // Total equivalent time from feed = fridge hours + RT hours since removal.
                          const fridgeHoursAccumulated = feedToFridgeOutH ?? 0;
                          const rtHoursAfterRemoval = fridgeOutHBF - hbf;
                          // RT is coldFactor faster than fridge — scale to equivalent fridge hours
                          const fridgeEquivAfterRemoval = rtHoursAfterRemoval * starterColdFactor;
                          const totalEquivH = fridgeHoursAccumulated + fridgeEquivAfterRemoval;
                          normH = Math.exp(-0.5 * ((totalEquivH - fridgePeakH) / fridgeSigma) ** 2);
                        }
                        normH = Math.max(0, Math.min(1, normH));
                        const x = hToX(hbf, W, WH);
                        const y = BL - normH * MAXH;
                        pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
                      }
                      pts.push(`L ${hToX(feedHBF2, W, WH).toFixed(1)} ${BL}`);
                      pts.push(`L ${hToX(0, W, WH).toFixed(1)} ${BL}`);
                      pts.push('Z');
                      return pts.join(' ');
                    }

                    const feedHBF = isLevain && activeFeedHBF !== null
                      ? activeFeedHBF : prefStartAbsHBF;

                    if (prefNeedsFridge && !isLevain) {
                      return makePlateauBellPath(peakHBF, prefSig, plateauHalfW, W, WH, feedHBF);
                    }
                    return makeBellPath(peakHBF, starterSigmaH * starterPreMixStretchFactor, W, WH, feedHBF);
                  })();
                  // Starter/preferment is consumed at Start Dough — fade the
                  // curve after mixX so the tail reads as hypothetical.
                  if (mixX > 0 && mixX < W) {
                    return (
                      <g clipPath={`url(#chart-area-clip-${chartId})`}>
                        <defs>
                          <clipPath id={`legacy-premix-clip-${chartId}`}>
                            <rect x={0} y={0} width={Math.max(0, mixX)} height={CHART_H} />
                          </clipPath>
                          <clipPath id={`legacy-postmix-clip-${chartId}`}>
                            <rect x={Math.max(0, mixX)} y={0} width={Math.max(0, W - mixX)} height={CHART_H} />
                          </clipPath>
                        </defs>
                        <path d={legacyBellD} fill={`${prefColor}2E`} stroke="none"
                          clipPath={`url(#legacy-premix-clip-${chartId})`} />
                        <path d={openBell(legacyBellD)} fill="none" stroke={`${prefColor}A5`}
                          strokeWidth={1.5} clipPath={`url(#legacy-premix-clip-${chartId})`} />
                        <path d={legacyBellD} fill={`${prefColor}10`} stroke="none"
                          clipPath={`url(#legacy-postmix-clip-${chartId})`} />
                        <path d={openBell(legacyBellD)} fill="none" stroke={`${prefColor}45`}
                          strokeWidth={1} strokeDasharray="3 3" clipPath={`url(#legacy-postmix-clip-${chartId})`} />
                      </g>
                    );
                  }
                  return (
                    <g clipPath={`url(#chart-area-clip-${chartId})`}>
                      <path d={legacyBellD} fill={`${prefColor}2E`} stroke="none" />
                      <path d={openBell(legacyBellD)} fill="none" stroke={`${prefColor}A5`}
                        strokeWidth={1.5} />
                    </g>
                  );
                })()}
              </>
            )}

            {/* Vertical line at feed/origin point */}
            <line
              x1={activePrefX} y1={BL} x2={activePrefX} y2={BL}
              stroke={`${prefColor}A5`} strokeWidth={1.5}
              clipPath={`url(#pref-bell-clip-${chartId})`}
            />
          </>
        )}

        {/* ── RT vs Fridge comparison overlay ── */}
        {isLevain && showFridgeComparison
         && compFridgePeakHBF !== null
         && compFridgeOutHBF !== null && (
          <>
            {/* Single continuous curve: feed → fridge → RT warmup
                Uses equiv-RT gaussian: 1 real hour in fridge = 1/coldFactor equiv hours
                Gives flat slope in fridge, steep slope at RT — one smooth curve */}
            <path
              d={(() => {
                const _cf = Math.pow(2, (kitchenTemp - (fridgeTemp ?? 6)) / 10);
                const _sigma = starterSigmaH;
                const _peakH = effectivePeakH;
                const feedH  = activeFeedHBF ?? compFridgeOutHBF + _peakH;
                // fridgeInHBF: when starter goes INTO fridge (same as feedH when feed→fridge)
                const inH = (fridgeInHBF !== null && fridgeInHBF <= feedH)
                  ? fridgeInHBF : feedH;
                const outH = compFridgeOutHBF;
                // equiv RT accumulated through each phase:
                const phase1EquivRT = feedH - inH;           // RT before fridge
                const phase2EquivRT = (inH - outH) / _cf;   // fridge time scaled down
                const N = 300;
                const pts: string[] = [];
                for (let i = 0; i <= N; i++) {
                  const hbf = (i / N) * feedH;
                  let equivRT: number;
                  if (hbf >= inH) {
                    equivRT = feedH - hbf;                          // phase 1: RT
                  } else if (hbf >= outH) {
                    equivRT = phase1EquivRT + (inH - hbf) / _cf;   // phase 2: fridge
                  } else {
                    equivRT = phase1EquivRT + phase2EquivRT + (outH - hbf); // phase 3: RT
                  }
                  const normH = Math.max(0, Math.min(1,
                    Math.exp(-0.5 * ((equivRT - _peakH) / _sigma) ** 2)
                  ));
                  const x = hToX(hbf, W, WH);
                  const y = BL - normH * MAXH;
                  pts.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
                }
                return pts.join(' ');
              })()}
              fill="rgba(74,127,165,0.15)"
              stroke="rgba(74,127,165,0.6)"
              strokeWidth={1.5}
              clipPath={`url(#chart-area-clip-${chartId})`}
            />
            {/* Fridge-out marker */}
            <line
              x1={hToX(compFridgeOutHBF, W, WH)}
              y1={AXIS_Y - 8}
              x2={hToX(compFridgeOutHBF, W, WH)}
              y2={AXIS_Y + 8}
              stroke="rgba(74,127,165,0.6)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </>
        )}


        {/* ── Dough bell (drawn on top) — fill(closed) + stroke(open) so the
               baseline closing run is never stroked ── */}
        {(() => {
          const doughPlateauHalfW = hasColdRetard
            ? Math.min(8, Math.max(2, (sweetFromH ?? 26) * 0.14))
            : 0;
          const doughD = doughPlateauHalfW > 0
            ? makePlateauBellPath(doughPeakHBF, DOUGH_SIG, doughPlateauHalfW, W, WH, effectiveMixHBF)
            : makeBellPath(doughPeakHBF, DOUGH_SIG, W, WH, effectiveMixHBF);
          return (
            <g clipPath={`url(#chart-area-clip-${chartId})`} opacity={opacityFor('mix')}>
              <path d={doughD} fill={`${SAGE}2E`} stroke="none" />
              {/* Cold casing — same path, clipped to THIS curve's cold ranges,
                  drawn under the normal stroke which keeps its own colour. */}
              {L.fridge && doughColdRanges.length > 0 && (
                <g clipPath={`url(#cold-dough-${chartId})`}>
                  <path d={openBell(doughD)} fill="none" stroke={COLD_STROKE}
                    strokeWidth={5.5} strokeOpacity={0.32} strokeLinecap="round" />
                </g>
              )}
              <path d={openBell(doughD)} fill="none" stroke={`${SAGE}A5`} strokeWidth={1.5} />
            </g>
          );
        })()}
        <line
          x1={hToX(effectiveMixHBF, W, WH)}
          y1={BL - (() => {
            const doughPlateauHalfW = hasColdRetard
              ? Math.min(8, Math.max(2, (sweetFromH ?? 26) * 0.14))
              : 0;
            if (doughPlateauHalfW === 0) return bell(effectiveMixHBF, doughPeakHBF, DOUGH_SIG);
            const dist = Math.abs(effectiveMixHBF - doughPeakHBF);
            return dist <= doughPlateauHalfW ? 1.0
              : Math.exp(-0.5 * ((dist - doughPlateauHalfW) / DOUGH_SIG) ** 2);
          })() * MAXH}
          x2={hToX(effectiveMixHBF, W, WH)}
          y2={BL}
          stroke={`${SAGE}A5`} strokeWidth={1.5}
          clipPath={`url(#dough-bell-clip-${chartId})`}
        />

        {/* ── Baseline ── */}
        <line x1={PAD} y1={BL} x2={W - PAD} y2={BL}
          stroke="rgba(0,0,0,0.12)" strokeWidth={0.8} />

        {/* ── Axis line ── */}
        <line x1={PAD} y1={AXIS_Y} x2={W - PAD} y2={AXIS_Y}
          stroke="var(--border)" strokeWidth={1} />

        {/* ── `now` — a tick on the axis, always visible, never a layer.
             A small filled triangle plus a lowercase caption. No full-height
             line: it competed with everything else for the same space. ── */}
        {nowHBF > 0 && nowHBF < WH && (() => {
          const nx = hToX(nowHBF, W, WH);
          return (
            <g pointerEvents="none">
              <polygon points={`${nx - 4},${AXIS_Y + 6} ${nx + 4},${AXIS_Y + 6} ${nx},${AXIS_Y + 0.5}`}
                fill="#9A9089" />
              <text x={nx} y={AXIS_Y + 16} fontSize={8} fill="#9A9089"
                fontFamily="DM Mono, monospace" textAnchor="middle"
                letterSpacing=".08em">{t('nowLabel')}</text>
            </g>
          );
        })()}

        {/* ── Day scale — dividers at midnight, day name for the stretch that
             starts there. A day name that would collide with the `now`
             caption is dropped, not overlapped. ── */}
        {(() => {
          const nowX = (nowHBF > 0 && nowHBF < WH) ? hToX(nowHBF, W, WH) : null;
          const nowHalf = (t('nowLabel').length * 4.4) / 2;
          return days.map((d, i) => {
            const labelX = d.x + 4;
            const clash = nowX !== null
              && Math.abs((labelX + 12) - nowX) < (20 + nowHalf);
            return (
              <g key={i} pointerEvents="none">
                {d.dividerX !== null && (
                  <line x1={d.dividerX} y1={AXIS_Y - 2} x2={d.dividerX} y2={AXIS_Y + 4}
                    stroke="#C9BEAC" strokeWidth={1} />
                )}
                {!clash && labelX < W - PAD - 22 && (
                  <text x={labelX} y={AXIS_Y + 16} fontSize={9.5} fill="var(--smoke)"
                    fontFamily="DM Mono, monospace" letterSpacing=".06em">{d.name}</text>
                )}
              </g>
            );
          });
        })()}

        {/* ── Bake marker (downward triangle sitting on the baseline) ── */}
        <polygon
          points={`${bakeX - 7.5},${BL - 10} ${bakeX + 7.5},${BL - 10} ${bakeX},${BL + 2.5}`}
          fill={TERRA} opacity={opacityFor('bake')}
        />
        {focusId === 'bake' && (
          <circle cx={bakeX} cy={BL} r={15} fill="none" stroke={TERRA} strokeWidth={1.5} opacity={0.4} />
        )}

        {/* ── Event-driven diamonds (sourdough) ──────────────
             Labels are no longer drawn here: every label on the chart goes
             through one packing pass above the axis, so a starter feed and
             Start Dough can never collide. ── */}
        {useEventDrivenStarter && visibleStarterEvents.map(({ ev, idx, x }) => {
          const isHistorical   = ev.kind === 'last_fed' && ev.isPast;
          const isIntermediate = ev.kind === 'intermediate_refresh';
          const id   = `ev:${idx}`;
          const size = isIntermediate ? S * 0.72 : S;
          const focused = focusId === id;
          const fill = isHistorical ? 'rgba(74,127,165,0.20)'
            : isIntermediate ? 'rgba(74,127,165,0.5)'
            : ev.isActive ? prefColor : 'rgba(74,127,165,0.45)';
          const inBusyWindow = !ev.isPast && inBlocker((bakeMs - ev.time.getTime()) / 3600000);
          return (
            <g key={`ev-diamond-${idx}`} pointerEvents={ev.isDraggable ? 'auto' : 'none'}
               opacity={opacityFor(id)}>
              {inBusyWindow && (L.busy || focused) && (
                <circle cx={x} cy={AXIS_Y} r={12} fill="none"
                  stroke="#9A7010" strokeWidth={1.2} strokeDasharray="2.5 2.5" />
              )}
              {focused && (
                <circle cx={x} cy={AXIS_Y} r={15} fill="none" stroke={fill}
                  strokeWidth={1.5} opacity={0.4} />
              )}
              <polygon
                points={`${x},${AXIS_Y - size} ${x + size},${AXIS_Y} ${x},${AXIS_Y + size} ${x - size},${AXIS_Y}`}
                fill={fill}
                stroke="var(--cream, #F5F0E8)"
                strokeWidth={1.6}
                style={{ cursor: ev.isDraggable ? 'grab' : 'default' }}
                onPointerDown={ev.isDraggable ? (e) => onPointerDown(e, ev.kind === 'refresh' ? 'refresh' : 'pref') : undefined}
              />
            </g>
          );
        })}

        {/* ── Historical feed diamond (muted, Feed 1 in Peak 2 scenario) ── */}
        {!useEventDrivenStarter && hasPref && isLevain && histPrefX !== null && (
          <g pointerEvents="none">
            <polygon
              points={`${histPrefX},${AXIS_Y - S} ${histPrefX + S},${AXIS_Y} ${histPrefX},${AXIS_Y + S} ${histPrefX - S},${AXIS_Y}`}
              fill="rgba(74,127,165,0.20)" stroke="var(--cream, #F5F0E8)" strokeWidth={1.6}
            />
          </g>
        )}

        {/* ── Refeed diamond (depleted state) ── */}
        {!useEventDrivenStarter && isLevain && refeedHBF !== null && depletedAtHBF !== null
         && refeedHBF > effectiveMixHBF
         && Math.abs(hToX(refeedHBF, W, WH) - activePrefX) > 20 && (
          <g>
            <polygon
              points={`${hToX(refeedHBF, W, WH)},${AXIS_Y - S} ${hToX(refeedHBF, W, WH) + S},${AXIS_Y} ${hToX(refeedHBF, W, WH)},${AXIS_Y + S} ${hToX(refeedHBF, W, WH) - S},${AXIS_Y}`}
              fill="rgba(74,127,165,0.20)" stroke="rgba(74,127,165,0.45)" strokeWidth={1.5}
            />
            <text
              x={hToX(refeedHBF, W, WH)}
              y={AXIS_Y + 36}
              fontSize={11}
              fill="var(--smoke)"
              fontFamily="DM Mono, monospace"
              textAnchor="middle"
              fontWeight="600"
            >
              {isFr ? 'Rafraîchi' : 'Feed'}
            </text>
          </g>
        )}

        {/* ── Feed circle — single cycle, no Peak 2 ── */}
        {!useEventDrivenStarter && isLevain && activeFeedHBF !== null && histFeedHBF === null
         && (!knownPeakHBF || starterRedPill)
         && activeFeedHBF > 0 && (
          <g>
            <circle
              cx={hToX(activeFeedHBF, W, WH)}
              cy={AXIS_Y}
              r={5}
              fill="rgba(74,127,165,0.45)"
              stroke="rgba(74,127,165,0.75)"
              strokeWidth={1}
            />
            <text
              x={hToX(activeFeedHBF, W, WH)}
              y={AXIS_Y + 36}
              fontSize={10}
              fill="rgba(74,127,165,0.75)"
              fontFamily="DM Mono, monospace"
              textAnchor="middle"
            >
              {isFr ? 'Rafraîchi' : 'Feed'}
            </text>
          </g>
        )}

        {/* Active feed diamond — hasFutureFeedPath or Peak2 scenario */}
        {!useEventDrivenStarter && isLevain && activeFeedHBF !== null && histFeedHBF !== null
         && (!knownPeakHBF || starterRedPill || starterFeed2Time)
         && activeFeedHBF > 0 && (
          <g>
            <polygon
              points={`${activePrefX},${AXIS_Y - S} ${activePrefX + S},${AXIS_Y} ${activePrefX},${AXIS_Y + S} ${activePrefX - S},${AXIS_Y}`}
              fill={prefColor}
              stroke="var(--cream, #F5F0E8)"
              strokeWidth={1.6}
              style={{ cursor: 'grab' }}
              onPointerDown={e => onPointerDown(e, 'pref')}
            />
          </g>
        )}

        {/* Refresh Feed markers — one diamond per intermediate feed cycle */}
        {!useEventDrivenStarter && isLevain && starterIntermediateFeeds.length > 0 && (() => {
          const refreshes = starterIntermediateFeeds.map((ft, idx) => {
            const hbf = (eatTime.getTime() - ft.getTime()) / 3600000;
            const x = hToX(hbf, W, WH);
            return { ft, hbf, x, idx };
          });
          const visible = refreshes.filter(r => r.hbf >= 0 && r.hbf <= WH);
          visible.sort((a, b) => b.hbf - a.hbf);
          const kept: typeof visible = [];
          const activeX = activeFeedHBF !== null ? hToX(activeFeedHBF, W, WH) : null;
          const histX = histFeedHBF !== null ? hToX(histFeedHBF, W, WH) : null;
          for (const r of visible) {
            if (activeX !== null && Math.abs(r.x - activeX) < 35) continue;
            if (histX !== null && Math.abs(r.x - histX) < 35) continue;
            if (kept.some(k => Math.abs(r.x - k.x) < 35)) continue;
            kept.push(r);
          }
          return (
            <g>
              {kept.map((r) => {
                return (
                  <g key={`refresh-${r.idx}`}>
                    <polygon
                      points={`${r.x},${AXIS_Y - S * 0.7} ${r.x + S * 0.7},${AXIS_Y} ${r.x},${AXIS_Y + S * 0.7} ${r.x - S * 0.7},${AXIS_Y}`}
                      fill="rgba(74,127,165,0.5)"
                      stroke="#4A7FA5"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Path B diamonds: Refresh only (In/Out shown as cold-storage region, not cluttering diamonds) */}
        {!useEventDrivenStarter && isFridgeHoldPath && fridgeHoldRefreshHBF !== null && fridgeHoldInHBF !== null && fridgeHoldOutHBF !== null && (() => {
          // Path-B legacy diamond block — must NOT fire when the engine is
          // emitting starterEvents (the event-driven diamond block at line
          // ~1482 already renders the refresh diamond + 'Refresh Feed' label
          // below the axis). Without this gate we drew a SECOND tiny
          // diamond + a 'Refresh' label landing on the tick-mark row.
          // Mirrors the !useEventDrivenStarter guard on the Path-B bell
          // block (line ~1027) and the legacy intermediate block (~1640).
          const items = [
            { hbf: fridgeHoldRefreshHBF, fillColor: '#4A7FA5' },
          ];
          return (
            <g>
              {items.map((item, idx) => {
                const x = hToX(item.hbf, W, WH);
                if (x < 0 || x > W) return null;
                return (
                  <g key={`pathb-diamond-${idx}`}>
                    <polygon
                      points={`${x},${AXIS_Y - 6} ${x + 5},${AXIS_Y} ${x},${AXIS_Y + 6} ${x - 5},${AXIS_Y}`}
                      fill={item.fillColor}
                      stroke="#FFF"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* ── Pref diamond (hidden in Mode B — no concrete feed time) ── */}
        {hasPref && !knownPeakHBF && !isLevain && renderDiamond(
          activePrefX,
          (prefStartAbsHBF > nowHBF || inBlocker(prefStartAbsHBF)) ? '#BBBBBB' : prefColor,
          inBlocker(prefStartAbsHBF),
          'pref',
          prefStartAbsHBF > nowHBF,
        )}

        {/* ── Mix diamond ── */}
        {renderDiamond(
          mixX,
          inBlocker(effectiveMixHBF) ? '#aaaaaa' : DARK_SAGE,
          inBlocker(effectiveMixHBF),
          'mix',
        )}

        {/* ── Ghost diamond (recommended position) ── */}
        {recommendedMixHBF != null &&
         Math.abs(recommendedMixHBF - effectiveMixHBF) > 0.5 && (
          <g opacity={0.3} pointerEvents="none">
            <polygon
              points={`${hToX(recommendedMixHBF, W, WH)},${AXIS_Y - S}
                ${hToX(recommendedMixHBF, W, WH) + S},${AXIS_Y}
                ${hToX(recommendedMixHBF, W, WH)},${AXIS_Y + S}
                ${hToX(recommendedMixHBF, W, WH) - S},${AXIS_Y}`}
              fill="none"
              stroke={DARK_SAGE}
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
          </g>
        )}

        {/* ── Labels — one packed pass, ABOVE the axis. A 3.5px cream
             paint-order halo keeps a second-lane label readable where it
             crosses a curve. ── */}
        {packLabels(labelItems, W).map(l => (
          <text
            key={l.key}
            x={l.x}
            y={LABEL_Y - l.lane * LABEL_LANE_H}
            fontSize={10}
            fontWeight={500}
            fill={l.color}
            opacity={l.dim ? 0.4 : 1}
            fontFamily="DM Mono, monospace"
            textAnchor="middle"
            style={{ paintOrder: 'stroke fill', stroke: 'var(--cream, #F5F0E8)', strokeWidth: '3.5px', strokeLinejoin: 'round' }}
            pointerEvents="none"
          >
            {l.text}
          </text>
        ))}
      </svg>

      {/* ── Reset ────────────────────────────────────────────
          Directly under the chart, above the guide link: the baker must SEE
          the diamond jump back when they press it — that is the confirmation,
          and it only works while the chart is on screen. ── */}
      {showReset && onReset && (
        <div style={{ marginTop: '11px' }}>
          <button
            onClick={onReset}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '8px 13px', border: '1.5px solid var(--border, #E8E0D5)',
              borderRadius: '20px', background: 'var(--warm, #FDFBF7)',
              color: 'var(--ash, #3D3530)', fontSize: '12px', cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span style={{ color: 'var(--terra)', fontSize: '13px' }}>↺</span>
            {t('reset')}
          </button>
        </div>
      )}

      {/* ── The guide — also the legend, which is why nothing permanent
          sits beside the chart. ── */}
      <div style={{ marginTop: '12px' }}>
        <button
          onClick={() => {
            setGuideOpen(o => {
              const next = !o;
              // First ever open turns all three layers on so the explanations
              // have something to point at. After that the baker's ticks are
              // respected — never re-enabled behind their back.
              if (next && !everOpened) {
                setEverOpened(true);
                setLayers({ fridge: true, busy: true, window: true });
              }
              return next;
            });
          }}
          aria-expanded={guideOpen}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: '12px', textAlign: 'left',
            color: guideOpen ? 'var(--ash, #3D3530)' : 'var(--smoke, #8A7F78)',
            textDecoration: guideOpen ? 'none' : 'underline', textUnderlineOffset: '2px',
          }}
        >
          {guideOpen ? t('guide.close') : t('guide.open')}
        </button>

        {guideOpen && (
          <div style={{
            marginTop: '9px', background: 'var(--warm, #FDFBF7)',
            border: '1px solid var(--border, #E8E0D5)', borderRadius: '14px',
            padding: '13px', fontFamily: 'var(--font-ui)',
          }}>
            {/* Leads with the action, before any biology. */}
            <p style={{ margin: '0 0 11px', fontSize: '11.5px', lineHeight: 1.5, color: 'var(--smoke, #8A7F78)' }}>
              <b style={{ color: 'var(--ash, #3D3530)', fontWeight: 500 }}>{t('guide.dragLead')}</b>
              {' '}{t('guide.dragRest')}
            </p>

            {(() => {
              const allOn = (!hasAnyCold || layers.fridge)
                && layers.busy
                && (!hasAnyWindow || layers.window);
              const rows: Array<{
                key: 'fridge' | 'busy' | 'window';
                label: string; desc: string; swatch: React.ReactNode;
              }> = [];
              if (hasAnyCold) rows.push({
                key: 'fridge', label: t('guide.fridge'), desc: t('guide.fridgeDesc'),
                swatch: (
                  <svg width="26" height="12" style={{ flexShrink: 0, marginTop: 3 }}>
                    <path d="M2 9 Q9 2 24 5" fill="none" stroke={COLD_STROKE} strokeWidth={5} opacity={0.32} strokeLinecap="round" />
                    <path d="M2 9 Q9 2 24 5" fill="none" stroke={SAGE} strokeWidth={1.6} />
                  </svg>
                ),
              });
              rows.push({
                key: 'busy', label: t('guide.busy'), desc: t('guide.busyDesc'),
                swatch: (
                  <svg width="26" height="12" style={{ flexShrink: 0, marginTop: 3 }}>
                    <rect x="2" y="0" width="8" height="12" fill={BUSY_FILL} opacity={0.16} />
                    <rect x="16" y="0" width="8" height="12" fill={BUSY_FILL} opacity={0.16} />
                  </svg>
                ),
              });
              if (hasAnyWindow) rows.push({
                key: 'window', label: t('guide.window'), desc: t('guide.windowDesc'),
                swatch: (
                  <svg width="26" height="12" style={{ flexShrink: 0, marginTop: 3 }}>
                    <rect x="2" y="4" width="21" height="5" rx="2.5" fill={DARK_SAGE} opacity={0.32} />
                    <line x1="12" y1="2" x2="12" y2="11" stroke={DARK_SAGE} strokeWidth={1.5} />
                  </svg>
                ),
              });
              const tick = (
                <svg width="10" height="8" viewBox="0 0 10 8">
                  <path d="M1 4 L4 7 L9 1" fill="none" stroke="#FDFBF7" strokeWidth={1.8}
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              );
              const box = (on: boolean) => (
                <span style={{
                  width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  border: `1.5px solid ${on ? 'var(--ash, #3D3530)' : '#C4B7A4'}`,
                  background: on ? 'var(--ash, #3D3530)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{on ? tick : null}</span>
              );
              const rowStyle = (first: boolean): React.CSSProperties => ({
                display: 'flex', alignItems: 'flex-start', gap: '9px',
                padding: first ? '0 2px 8px' : '8px 2px',
                background: 'none', border: 'none',
                borderTop: first ? 'none' : '1px solid var(--border, #E8E0D5)',
                width: '100%', textAlign: 'left', cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              });
              return (
                <>
                  <button
                    onClick={() => {
                      const v = !allOn;
                      setLayers({ fridge: v, busy: v, window: v });
                    }}
                    aria-pressed={allOn}
                    style={rowStyle(true)}
                  >
                    {box(allOn)}
                    <span style={{ flex: 1 }}>
                      <b style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--ash, #3D3530)' }}>
                        {t('guide.all')}
                      </b>
                    </span>
                  </button>
                  {rows.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setLayers(prev => ({ ...prev, [r.key]: !prev[r.key] }))}
                      aria-pressed={layers[r.key]}
                      style={rowStyle(false)}
                    >
                      {box(layers[r.key])}
                      <span style={{ flex: 1 }}>
                        <b style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--ash, #3D3530)' }}>
                          {r.label}
                        </b>
                        <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--smoke, #8A7F78)', lineHeight: 1.4, marginTop: 1 }}>
                          {r.desc}
                        </span>
                      </span>
                      {r.swatch}
                    </button>
                  ))}
                </>
              );
            })()}

            <p style={{ margin: '11px 0 0', fontSize: '11.5px', lineHeight: 1.5, color: 'var(--smoke, #8A7F78)' }}>
              {t('guide.foot')}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
