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
  showZoneLabels?: boolean;
  hasDragged?: boolean;
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
const CHART_H   = 272;  // tall enough for 3 staggered label rows below the axis (was 252 — row-2 labels clipped)
const TOP_PAD   = 72;   // space above curves for window labels
const BL        = 175;  // baseline = TOP_PAD + curve height area
const MAXH      = 110;  // max bell height (fits within TOP_PAD to BL)
const AXIS_Y    = 175;  // axis line = same as baseline BL
const BLOCKER_TOP = BL - MAXH - 8; // blocker columns cap a touch above the tallest bell

// DOUGH_SIG and DOUGH_SWEET_CENTER are computed inside the component
// based on hasColdRetard — see derived physics section

// Diamond half-size
const S = 13;

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

// ── RT warmup time to bring cold poolish to peak ─────────────────────
// How long poolish needs at room temp after coming out of fridge.
// Climate-sensitive: hotter kitchen = faster warmup.
export function getPrefRTWarmupH(temp: number): number {
  if (temp >= 30) return 0.5;
  if (temp >= 28) return 0.75;
  if (temp >= 26) return 1.0;
  return 2.0;
}

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
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * left;
    const x = hToX(hbf, W, wh);
    const y = BL - ((pbell(hbf) - floor) / range) * MAXH;
    pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
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
        h = Math.max(FRIDGE_FLOOR, declineGauss);
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
  blocks, onMixChange, onPrefChange, onDragStart, onDragEnd,
  windowH, prefInFridge, hasColdRetard, sweetCenterH, sweetFromH, sweetToH,
  nowHBF = 999, phases, scheduleNote,
  recommendedMixHBF, showZoneLabels, hasDragged,
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
  const [dragging, setDragging] = useState<'mix' | 'pref' | null>(null);
  // Local drag HBF for free visual movement during mix drag — no onMixChange until pointer up
  const [localMixHBF, setLocalMixHBF] = useState<number | null>(null);
  // Glow guidance state
  const hasMovedMixRef  = useRef(false);
  const hasMovedPrefRef = useRef(false);
  const [glowState, setGlowState] = useState<'mix' | 'pref' | 'both' | 'done'>('mix');
  const [legendOpen, setLegendOpen] = useState(false); // B1 — first-use chart literacy

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Inject diamond glow keyframes once
  useEffect(() => {
    const id = 'fc-diamond-glow-style';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes fc-glow-pulse {
        0%   { filter: drop-shadow(0 0 0px rgba(196,82,42,0)); }
        50%  { filter: drop-shadow(0 0 6px rgba(196,82,42,0.8)); }
        100% { filter: drop-shadow(0 0 0px rgba(196,82,42,0)); }
      }
      .fc-diamond-glow { animation: fc-glow-pulse 1.6s ease-in-out infinite; }
    `;
    document.head.appendChild(s);
    return () => { document.getElementById(id)?.remove(); };
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
  const prefStroke = isLevain ? '#2A5F85' : '#7A6010';
  const SAGE            = '#6B7A5A';
  const TERRA           = '#C4522A';
  const CHAR            = '#1A1612';
  const DARK_SAGE       = '#3D5A30';
  const DARK_SAGE_STR   = '#4A6B3A';

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
  const rtPeakH = hasPref ? getPrefPeakH_RT(prefermentType, kitchenTemp) : 0;
  const prefNeedsFridge = hasPref && (prefermentType === 'biga' || prefOffsetH > rtPeakH);
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

  // ── Label collision detection ────────────────────────────
  const labelsClose = hasPref && Math.abs(mixX - activePrefX) < 130;
  // Keep centred diamond labels fully inside the canvas (12px mono ≈ 7.2px/char)
  const clampLabelX = (x: number, text: string, fs = 12) => {
    const half = text.length * fs * 0.3 + 4;
    return Math.min(Math.max(x, half), W - half);
  };
  const allClose = isLevain && histPrefX !== null
    && Math.abs((histPrefX ?? 0) - activePrefX) < 80
    && Math.abs(activePrefX - mixX) < 80;

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

  // Adaptive ticks: clock-aligned, stepping backward from bake time
  const tickIntervalH = WH <= 18 ? 3 : WH <= 48 ? 6 : WH <= 96 ? 12 : 24;
  const ticks: { x: number; label: string }[] = [];
  const _fmtTickLabel = (d: Date): string => {
    const wd = d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' });
    const hr = d.getHours();
    const timeLabel = hr === 0 ? t('tickLabels.midnight')
      : hr === 6 ? t('tickLabels.6am')
      : hr === 12 ? t('tickLabels.noon')
      : hr === 18 ? t('tickLabels.6pm')
      : isFr ? `${hr}h`
      : `${hr > 12 ? hr - 12 : hr}${hr < 12 ? 'am' : 'pm'}`;
    return `${wd} ${timeLabel}`;
  };
  {
    const firstTick = new Date(bakeMs);
    firstTick.setMinutes(0, 0, 0);
    firstTick.setHours(Math.floor(firstTick.getHours() / tickIntervalH) * tickIntervalH);
    for (let tMs = firstTick.getTime(); tMs > bakeMs - WH * 3600000; tMs -= tickIntervalH * 3600000) {
      const h = (bakeMs - tMs) / 3600000;
      if (h < 1.5) continue;
      if (h > WH - 0.5) continue;
      ticks.push({ x: hToX(h, W, WH), label: _fmtTickLabel(new Date(tMs)) });
    }
  }
  // Feed-day tick: when the earliest rendered event (typically "Last fed")
  // falls beyond the last clock-aligned tick, the leftmost feed day had no
  // labeled tick. Add one anchored on the earliest event time so the feed
  // day is dated on the axis. Skip if a clock-aligned tick already sits
  // within ~32 px (the same dedupe stride the renderer uses).
  if (useEventDrivenStarter && starterEvents.length > 0) {
    const earliestEv = starterEvents.reduce(
      (acc, ev) => (ev.time.getTime() < acc.time.getTime() ? ev : acc),
      starterEvents[0],
    );
    const earliestHBF = (bakeMs - earliestEv.time.getTime()) / 3600000;
    if (earliestHBF > 1.5 && earliestHBF < WH - 0.5) {
      const x = hToX(earliestHBF, W, WH);
      const hasNearby = ticks.some(tk => Math.abs(tk.x - x) < 32);
      if (!hasNearby) ticks.push({ x, label: _fmtTickLabel(earliestEv.time) });
    }
  }

  // ── Pointer events ───────────────────────────────────────
  function getSvgX(e: React.PointerEvent): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return e.clientX - rect.left;
  }

  function onPointerDown(e: React.PointerEvent, which: 'mix' | 'pref') {
    if (startTimeInPast) return;
    if (which === 'pref' && prefStartAbsHBF > nowHBF) return;
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
    } else {
      const abs = Math.min(WH - 0.05, snap15(xToHBF(x, W, WH)));
      onPrefChange(abs - effectiveMixHBF);
    }
  }

  function onPointerUp() {
    onDragEnd?.();
    if (dragging === 'mix' && localMixHBF !== null) {
      hasMovedMixRef.current = true;
      onMixChange(localMixHBF);
      setLocalMixHBF(null);
      setGlowState(prev => {
        if (prev === 'mix') return hasPref ? 'pref' : 'done';
        if (prev === 'pref') return 'done';
        return prev;
      });
    } else if (dragging === 'pref') {
      hasMovedPrefRef.current = true;
      setGlowState(prev => {
        if (prev === 'pref' || prev === 'mix') return 'done';
        return prev;
      });
    }
    setDragging(null);
  }

  // ── Status logic ─────────────────────────────────────────
  const mixInZone   = effectiveMixHBF >= doughZoneTo   && effectiveMixHBF <= doughZoneFrom;
  const mixTooEarly = false;
  const mixStatus = mixInZone   ? t('mixStatus.ready')
    : mixTooEarly ? t('mixStatus.peaksBefore')
    : t('mixStatus.peaksAfter');

  // 5-state — same boundaries as zone and plateau
  // Protocol indicator already shown below diamond — no need to repeat in pill
  const prefOptHChart  = prefermentType === 'biga' ? 48 : prefNeedsFridge ? 18 : rtPeakH;
  const prefMaxHChart  = prefermentType === 'biga' ? 72 : prefNeedsFridge ? 24 : rtPeakH * 1.5;
  // Biga green mirrors solver + card: 24h→58h (optH 48, −24h/+10h plateau)
  const prefInZone     = prefermentType === 'biga'
    ? hasPref && prefOffsetH >= 24 && prefOffsetH <= 58
    : hasPref && prefOffsetH >= 3 && prefOffsetH <= prefOptHChart;
  const prefEarlyOk    = prefermentType === 'biga'
    ? hasPref && prefOffsetH > 58 && prefOffsetH <= prefMaxHChart
    : hasPref && prefOffsetH > prefOptHChart && prefOffsetH <= prefMaxHChart;
  const prefTooShort   = hasPref && prefOffsetH < 3;
  const prefStatus = prefInZone   ? t('prefStatus.readyAtMix')
    : prefEarlyOk                 ? t('prefStatus.earlyOk')
    : prefTooShort                ? t('prefStatus.notYetPeak')
    :                               t('prefStatus.pastPeak');

  // ── Info card data ───────────────────────────────────────
  const mixTime  = new Date(bakeMs - effectiveMixHBF * 3600000);
  const prefTime = hasPref ? new Date(bakeMs - prefStartAbsHBF * 3600000) : null;

  const prefLabel = prefermentType === 'sourdough' || prefermentType === 'levain'
    ? t('cardLabels.feedStarter')
    : prefermentType === 'biga'    ? t('cardLabels.makeBiga')
    : prefermentType === 'poolish' ? t('cardLabels.makePoolish')
    : prefermentType;

  const prefTypeName = prefermentType === 'sourdough' || prefermentType === 'levain'
    ? 'Levain'
    : prefermentType === 'biga'    ? 'Biga'
    : 'Poolish';

  // ── Zone renderer ────────────────────────────────────────
  function renderZone(
    fromHBF: number, toHBF: number,
    color: string, label: string, labelY: number,
    markerId: string,
  ) {
    const x1 = hToX(fromHBF, W, WH);
    const x2 = hToX(toHBF,   W, WH);
    if (x2 <= x1 + 1) return null;
    // Visible portion of zone clipped to screen
    const visLeft  = Math.max(x1, 0);
    const visRight = Math.min(x2, W);
    const visWidth = visRight - visLeft;
    // Label aims for center of visible screen portion, stays within zone bounds
    // If visible zone too narrow → label clips naturally (no orphan floating label)
    const labelW = label.length * 7;
    const labelX = Math.min(
      Math.max((visLeft + visRight) / 2, visLeft + labelW / 2),
      visRight - labelW / 2
    );
    const showLabel = visWidth > labelW * 0.6; // only render if enough visible space
    // Arrow clamped to visible area
    const arrowX1 = Math.max(x1 + 4, 2);
    const arrowX2 = Math.min(x2 - 4, W - 2);
    return (
      <g>
        {/* Zone fill — clipped to screen */}
        <rect x={visLeft} y={TOP_PAD} width={visWidth} height={BL - TOP_PAD}
          fill={`${color}12`} />
        {/* Left boundary line — only if on screen */}
        {x1 >= 0 && <line x1={x1} y1={labelY + 9} x2={x1} y2={BL}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />}
        {/* Right boundary line */}
        <line x1={x2} y1={labelY + 9} x2={x2} y2={BL}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />
        {/* Label — aims for visible center, within zone bounds */}
        {showLabel && <text x={labelX} y={labelY} fontSize={11} fill={color}
          textAnchor="middle" fontFamily="DM Mono, monospace" fillOpacity={0.85} fontWeight="600">
          {label}
        </text>}
        {/* Arrow — clipped to visible area, left arrowhead only if zone left is on screen */}
        {arrowX2 > arrowX1 + 8 && <line
          x1={arrowX1} x2={arrowX2}
          y1={labelY + 9} y2={labelY + 9}
          stroke={color} strokeWidth={1.2} strokeOpacity={0.7}
          markerStart={x1 >= 0 ? `url(#arrow-${markerId}-start-${chartId})` : undefined}
          markerEnd={`url(#arrow-${markerId}-end-${chartId})`}
        />}
      </g>
    );
  }

  // ── Diamond renderer ─────────────────────────────────────
  function renderDiamond(
    cx: number, fill: string, stroke: string, warn: boolean,
    which: 'mix' | 'pref', disabled = false,
  ) {
    const shouldGlow = showZoneLabels && (
      (which === 'mix' && glowState === 'mix')
      || (which === 'pref' && glowState === 'pref')
    );
    return (
      <g
        style={{ cursor: startTimeInPast ? 'default' : (disabled ? 'not-allowed' : dragging === which ? 'grabbing' : 'grab'), opacity: startTimeInPast ? 0.6 : 1 }}
        onPointerDown={e => onPointerDown(e, which)}
      >
        <polygon
          className={shouldGlow ? 'fc-diamond-glow' : undefined}
          points={`${cx},${BL - S} ${cx + S},${BL} ${cx},${BL + S} ${cx - S},${BL}`}
          fill={fill} stroke={stroke} strokeWidth={1.5}
          style={{ animation: hasDragged ? 'none' : 'diamondPulse 1.8s ease-out 0.5s 2' }}
        />
        {warn && (
          <>
            <circle cx={cx + S + 3} cy={BL - S} r={5} fill="rgba(196,82,42,0.9)" />
            <text x={cx + S + 3} y={BL - S + 4} fontSize={10} fill="white"
              textAnchor="middle" fontFamily="DM Mono, monospace">!</text>
          </>
        )}
      </g>
    );
  }

  // ── Drop-line renderer ───────────────────────────────────
  function renderDropLine(hbf: number, peakHBF: number, sigma: number, color: string, startY?: number) {
    const x  = hToX(hbf, W, WH);
    const v  = bell(hbf, peakHBF, sigma) * MAXH;
    const cy = BL - v;
    const y1 = startY ?? BL;
    return (
      <>
        <line x1={x} y1={y1} x2={x} y2={cy}
          stroke={color} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.5} />
        <circle cx={x} cy={cy} r={3.5} fill={color} stroke="white" strokeWidth={1} />
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', overflow: 'hidden', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
      {/* ── Curve legend ── */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
        {hasPref && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="24" height="10" viewBox="0 0 24 10">
              <path d="M0,8 Q6,0 12,5 Q18,10 24,2" stroke={prefColor} strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
              {prefermentType === 'biga' ? 'Biga' :
               prefermentType === 'levain' || prefermentType === 'sourdough' ? (isFr ? 'Levain' : 'Starter') :
               'Poolish'}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="24" height="10" viewBox="0 0 24 10">
            <path d="M0,8 Q6,0 12,5 Q18,10 24,2" stroke="#4A6B3A" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
            {isFr ? 'Pâte' : 'Dough'}
          </span>
        </div>
      </div>
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
          <style>{`
            @keyframes diamondPulse {
              0%   { filter: drop-shadow(0 0 0px rgba(61,90,48,0)); }
              40%  { filter: drop-shadow(0 0 6px rgba(61,90,48,0.7)); }
              100% { filter: drop-shadow(0 0 0px rgba(61,90,48,0)); }
            }
          `}</style>
          {blocks.map((b, i) => {
            const { hbfStart, hbfEnd } = blockerHBF(b);
            const x1 = hToX(hbfStart, W, WH);
            const x2 = hToX(hbfEnd,   W, WH);
            return (
              <clipPath key={i} id={`bc-${chartId}-${i}`}>
                <rect x={x1} y={BLOCKER_TOP} width={Math.max(0, x2 - x1)} height={AXIS_Y - BLOCKER_TOP} />
              </clipPath>
            );
          })}
          {/* Bidirectional arrow markers for zone width indicators */}
          <marker id={`arrow-sage-start-${chartId}`} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M6,0 L0,3 L6,6" fill="none" stroke="#6B7A5A" strokeWidth="1.2"/>
          </marker>
          <marker id={`arrow-sage-end-${chartId}`} markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke="#6B7A5A" strokeWidth="1.2"/>
          </marker>
          <marker id={`arrow-pref-start-${chartId}`} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M6,0 L0,3 L6,6" fill="none" stroke={prefColor} strokeWidth="1.2"/>
          </marker>
          <marker id={`arrow-pref-end-${chartId}`} markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke={prefColor} strokeWidth="1.2"/>
          </marker>
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

        {/* ── Sweet-spot zones ── */}
        {showZoneLabels && (() => {
          const prefWindowLabel =
            prefermentType === 'biga'      ? t('zoneLabels.makeBigaWindow')    :
            prefermentType === 'levain'    ? 'Starter peak' :
            prefermentType === 'sourdough' ? 'Starter peak' :
            t('zoneLabels.makePoolishWindow');
          return (
            <>
              {renderZone(doughZoneFrom, doughZoneTo, SAGE, t('zoneLabels.startDoughWindow'), 12, 'sage')}
              {hasPref && renderZone(prefZoneFrom, prefZoneTo, prefColor, prefWindowLabel, 38, 'pref')}
            </>
          );
        })()}

        {/* ── Blocker columns ── */}
        {blocks.map((b, i) => {
          const { hbfStart, hbfEnd } = blockerHBF(b);
          if (hbfEnd > WH || hbfStart < 0) return null;
          const x1 = hToX(hbfStart, W, WH);
          const x2 = hToX(hbfEnd,   W, WH);
          if (x2 <= x1) return null;
          const n = Math.ceil((x2 - x1 + AXIS_Y) / 7) + 2;
          return (
            <g key={i}>
              <rect x={x1} y={BLOCKER_TOP} width={x2 - x1} height={AXIS_Y - BLOCKER_TOP} fill="rgba(196,82,42,0.09)" />
              <g clipPath={`url(#bc-${chartId}-${i})`}>
                {Array.from({ length: n }, (_, j) => {
                  const ox = x1 + j * 7 - AXIS_Y;
                  return (
                    <line key={j}
                      x1={ox} y1={BLOCKER_TOP} x2={ox + AXIS_Y} y2={AXIS_Y}
                      stroke="rgba(196,82,42,0.16)" strokeWidth={1}
                    />
                  );
                })}
              </g>
              <line x1={x1} y1={BLOCKER_TOP} x2={x2} y2={BLOCKER_TOP}
                stroke="rgba(196,82,42,0.5)" strokeWidth={2.5} />
            </g>
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
                  <path
                    d={makeBellPath(refreshPeakHBF, starterSigmaH_refresh, W, WH, fridgeHoldRefreshHBF)}
                    fill="rgba(74,127,165,0.08)"
                    stroke="rgba(74,127,165,0.35)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    clipPath={`url(#pathb-refresh-clip-${chartId})`}
                  />
                  {/* Cold storage flat region from fridge-in to fridge-out */}
                  <rect
                    x={fridgeInX}
                    y={AXIS_Y - 12}
                    width={Math.max(0, fridgeOutX - fridgeInX)}
                    height={12}
                    fill="rgba(150,180,210,0.20)"
                    stroke="rgba(150,180,210,0.5)"
                    strokeWidth={0.5}
                    strokeDasharray="4 2"
                  />
                  {/* Label the region — unlabeled it reads as a rendering
                      glitch hugging the axis */}
                  {fridgeOutX - fridgeInX > 40 && (
                    <text
                      x={(fridgeInX + fridgeOutX) / 2} y={AXIS_Y - 16}
                      fontSize={9} fill="rgba(74,127,165,0.75)"
                      textAnchor="middle" fontFamily="DM Mono, monospace"
                    >
                      ❄ {isFr ? 'frigo' : 'fridge'}
                    </text>
                  )}
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
              return (
                <path
                  key={`rb-${idx}`}
                  d={makeBellPath(hbf - effectivePeakH_refresh, starterSigmaH_refresh, W, WH, hbf)}
                  fill="rgba(74,127,165,0.06)"
                  stroke="rgba(74,127,165,0.25)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  clipPath={`url(#refresh-bell-clip-${chartId}-${idx})`}
                />
              );
            })}

            {/* ── Event-driven bells (sourdough, one per starterEvent) ── */}
            {useEventDrivenStarter && (() => {
              const fridgeIn = starterEvents.find(e => e.kind === 'fridge_in');
              const fridgeOut = starterEvents.find(e => e.kind === 'fridge_out');
              const fridgeHasIn = !!fridgeIn;
              return (
                <>
                  {/* Cold-storage flat region (Path B): low baseline between fridge_in and fridge_out */}
                  {fridgeHasIn && fridgeOut && (() => {
                    const inHBF = (bakeMs - fridgeIn.time.getTime()) / 3600000;
                    const outHBF = (bakeMs - fridgeOut.time.getTime()) / 3600000;
                    if (inHBF <= 0 || outHBF <= 0) return null;
                    const xIn = hToX(inHBF, W, WH);
                    const xOut = hToX(outHBF, W, WH);
                    return (
                      <g>
                        <rect
                          x={Math.min(xIn, xOut)}
                          y={BL - 4}
                          width={Math.abs(xOut - xIn)}
                          height={4}
                          fill="rgba(74,127,165,0.10)"
                          stroke="rgba(74,127,165,0.25)"
                          strokeWidth={0.5}
                          strokeDasharray="2 3"
                        />
                        {Math.abs(xOut - xIn) > 40 && (
                          <text
                            x={(xIn + xOut) / 2} y={BL - 8}
                            fontSize={9} fill="rgba(74,127,165,0.75)"
                            textAnchor="middle" fontFamily="DM Mono, monospace"
                          >
                            ❄ {isFr ? 'frigo' : 'fridge'}
                          </text>
                        )}
                      </g>
                    );
                  })()}
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
                    const bellD =
                      ownsHold && fridgeOutHBF_ev !== null && fridgeInHBF_ev !== null && chilledAtPeak
                        ? makeBellWithFridgePlateau(peakHBF, sigma, fridgeInHBF_ev, fridgeOutHBF_ev, W, WH, feedHBF)
                        : ownsHold && fridgeOutHBF_ev !== null
                          ? makeFridgePhaseBellPath(feedHBF, peakHBF, feedToPeakH_ev, feedToPeakH_ev * 0.4, W, WH)
                          : makeBellPath(peakHBF, sigma, W, WH, feedHBF);
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
                          <path
                            d={bellD}
                            fill={fillStyle} stroke={strokeStyle}
                            strokeWidth={strokeWidth} strokeDasharray={dashArray}
                            clipPath={`url(#premix-clip-${chartId}-${idx})`}
                          />
                          <path
                            d={bellD}
                            fill={`${prefColor}10`} stroke={`${prefColor}45`}
                            strokeWidth={1} strokeDasharray="3 3"
                            clipPath={`url(#postmix-clip-${chartId}-${idx})`}
                          />
                        </g>
                      );
                    }
                    return (
                      <path
                        key={`ev-bell-${idx}`}
                        d={bellD}
                        fill={fillStyle}
                        stroke={strokeStyle}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dashArray}
                        clipPath={`url(#chart-area-clip-${chartId})`}
                      />
                    );
                  })}
                </>
              );
            })()}

            {/* ── Muted historical bell — shows the spent cycle from Last Fed ── */}
            {!useEventDrivenStarter && isLevain && histPeakHBF !== null && histFeedHBF !== null && (
              <>
                <path
                  d={makeBellPath(histPeakHBF, starterSigmaH, W, WH, histFeedHBF)}
                  fill="rgba(74,127,165,0.08)"
                  stroke="rgba(74,127,165,0.30)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  clipPath={`url(#chart-area-clip-${chartId})`}
                />
              </>
            )}

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
                {refeedHBF !== null && Math.abs(refeedHBF - activeFeedHBF) > 0.5 && (
                  <path
                    d={makeBellPath(
                      refeedHBF - effectivePeakH_refresh,
                      starterSigmaH_refresh, W, WH, refeedHBF
                    )}
                    fill={`${prefColor}1A`}
                    stroke={`${prefColor}80`}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    clipPath={`url(#chart-area-clip-${chartId})`}
                  />
                )}
                {/* Active pre-mix bell — solid, always rendered at active feed
                    position. This is the cycle that feeds the dough. */}
                <path
                  d={makeBellPath(
                    activeFeedHBF - effectivePeakHStretched,
                    starterSigmaH * starterPreMixStretchFactor, W, WH, activeFeedHBF
                  )}
                  fill={`${prefColor}2E`}
                  stroke={`${prefColor}A5`}
                  strokeWidth={1.5}
                  clipPath={`url(#chart-area-clip-${chartId})`}
                />
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
                        <path d={legacyBellD} fill={`${prefColor}2E`} stroke={`${prefColor}A5`}
                          strokeWidth={1.5} clipPath={`url(#legacy-premix-clip-${chartId})`} />
                        <path d={legacyBellD} fill={`${prefColor}10`} stroke={`${prefColor}45`}
                          strokeWidth={1} strokeDasharray="3 3" clipPath={`url(#legacy-postmix-clip-${chartId})`} />
                      </g>
                    );
                  }
                  return (
                    <path d={legacyBellD} fill={`${prefColor}2E`} stroke={`${prefColor}A5`}
                      strokeWidth={1.5} clipPath={`url(#chart-area-clip-${chartId})`} />
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
            <text
              x={hToX(compFridgeOutHBF, W, WH)}
              y={AXIS_Y + 50}
              fontSize={9}
              fill="rgba(74,127,165,0.9)"
              fontFamily="DM Mono, monospace"
              fontWeight="600"
              textAnchor="middle"
            >
              {isFr ? 'Sortir' : 'Remove'}
            </text>
          </>
        )}


        {/* ── Dough bell (drawn on top) ── */}
        <path
          d={(() => {
            const doughPlateauHalfW = hasColdRetard
              ? Math.min(8, Math.max(2, (sweetFromH ?? 26) * 0.14))
              : 0;
            return doughPlateauHalfW > 0
              ? makePlateauBellPath(doughPeakHBF, DOUGH_SIG, doughPlateauHalfW, W, WH, effectiveMixHBF)
              : makeBellPath(doughPeakHBF, DOUGH_SIG, W, WH, effectiveMixHBF);
          })()}
          fill={`${SAGE}2E`} stroke={`${SAGE}A5`} strokeWidth={1.5}
          clipPath={`url(#chart-area-clip-${chartId})`}
        />
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

        {/* ── Ticks — label-aware spacing (fixed 32px gap let 55px-wide
             labels overlap on narrow screens, and the last tick collided
             with the Bake label) ── */}
        {(() => {
          const visible: typeof ticks = [];
          const labelPx = (s: string) => s.length * 7.2 + 10; // DM Mono 12px ≈ 7.2px/char
          const bakeClear = (t('bakeLabel').length * 8.4) / 2 + 14; // Bake is 14px semibold
          for (const tk of ticks) {
            if (visible.length >= 5) break;
            // Keep clear of the Bake label at the right edge
            if (Math.abs(bakeX - tk.x) < labelPx(tk.label) / 2 + bakeClear) continue;
            const prev = visible[visible.length - 1];
            const needed = prev ? (labelPx(tk.label) + labelPx(prev.label)) / 2 : 0;
            if (!prev || Math.abs(tk.x - prev.x) >= needed) visible.push(tk);
          }
          return visible;
        })().map((tk, i) => (
          <g key={i}>
            <line x1={tk.x} y1={AXIS_Y} x2={tk.x} y2={AXIS_Y + 3}
              stroke="var(--border)" strokeWidth={1} />
            <text x={tk.x} y={AXIS_Y + 20} fontSize={12} fill="var(--smoke)"
              fontFamily="DM Mono, monospace" textAnchor="middle">
              {tk.label}
            </text>
          </g>
        ))}

        {/* ── Bake marker (upward triangle) ── */}
        <polygon
          points={`${bakeX - 8},${AXIS_Y} ${bakeX},${AXIS_Y - 12} ${bakeX + 8},${AXIS_Y}`}
          fill={TERRA}
        />
        <text
          // Clamp inside the chart — centred on bakeX the FR "Cuisson" label
          // ran off the right edge ("Cuisso…")
          x={Math.min(bakeX, W - (t('bakeLabel').length * 8.4) / 2 - 2)}
          y={AXIS_Y + 20} fontSize={14} fontWeight="600" fill={TERRA}
          fontFamily="DM Mono, monospace" textAnchor="middle">{t('bakeLabel')}</text>

        {/* ── Event-driven diamonds + labels (sourdough) ── */}
        {useEventDrivenStarter && (() => {
          // Build the list of visible, rendered events first, then assign each
          // label a stacking ROW based on actual x-proximity — not array-index
          // parity. Index parity broke when fridge_out was filtered and
          // fridge_in return-null'd mid-map (their idx still counted), so two
          // close labels (e.g. Out-of-fridge + Pre-mix within ~1h) could land on
          // the same row and overlap. Greedy placement: a label drops to the
          // next row only if it sits within LABEL_MIN_DX of one already placed
          // on that row. Mirrors the intermediate-refresh block's approach.
          const ROW_H = 14;
          const tickPositions = ticks.map(tk => tk.x);
          // Width-aware spacing — the old fixed 46px gap let long labels like
          // "Refresh Feed 1" (~90px) overlap neighbours and the green
          // "Start Dough" mix label.
          const labelPxW = (s: string) => s.length * 6.2 + 8;
          const visible = starterEvents
            .filter(ev => ev.kind !== 'fridge_out' && ev.kind !== 'fridge_in')
            .map((ev, idx) => {
              const hbf = (bakeMs - ev.time.getTime()) / 3600000;
              if (hbf < 0 || hbf > WH) return null;
              return { ev, idx, x: hToX(hbf, W, WH) };
            })
            .filter((v): v is { ev: StarterEvent; idx: number; x: number } => v !== null)
            .sort((a, b) => a.x - b.x);
          // Assign rows greedily left-to-right.
          // Pre-seed the mix diamond's "Start Dough" label (12px font, drawn
          // in its own block at ~rows 0–1) so event labels keep clear of it.
          const placed: { x: number; row: number; w: number }[] = [
            { x: mixX, row: 0, w: 92 },
            { x: mixX, row: 1, w: 92 },
          ];
          const rowFor = (x: number, w: number): number => {
            let row = 0;
            // increase row until no already-placed label on that row overlaps
            // (bounded to 3 rows so labels never march too far down)
            while (row < 3 && placed.some(p => p.row === row && Math.abs(p.x - x) < (p.w + w) / 2)) {
              row++;
            }
            placed.push({ x, row, w });
            return row;
          };
          return visible.map(({ ev, idx, x }) => {
            const isHistorical = ev.kind === 'last_fed' && ev.isPast;
            const isIntermediate = ev.kind === 'intermediate_refresh';
            const diamondFill = isHistorical ? 'rgba(74,127,165,0.20)' :
                                isIntermediate ? 'rgba(74,127,165,0.5)' :
                                ev.isActive ? prefColor : 'rgba(74,127,165,0.45)';
            const diamondStroke = isHistorical ? 'rgba(74,127,165,0.45)' :
                                  isIntermediate ? '#4A7FA5' :
                                  ev.isActive ? 'white' : 'rgba(74,127,165,0.75)';
            const diamondSize = isIntermediate ? S * 0.7 : S;
            const points = `${x},${AXIS_Y - diamondSize} ${x + diamondSize},${AXIS_Y} ${x},${AXIS_Y + diamondSize} ${x - diamondSize},${AXIS_Y}`;
            // A label whose diamond sits under a day tick drops just enough to
            // clear the tick text (baseline AXIS_Y+20, ~12px tall) — a small
            // +8 nudge, NOT a full extra row, so an isolated label (e.g. a
            // far-left "Refresh Feed" with nothing beside it) stays tucked under
            // the axis instead of floating ~2 rows down and reading as detached.
            const collidesWithTick = tickPositions.some(tx => Math.abs(x - tx) < 55);
            const baseLabelY = (AXIS_Y + S + 22) + (collidesWithTick ? 8 : 0);
            const finalLabelY = baseLabelY + rowFor(x, labelPxW(ev.label)) * ROW_H;
            const labelFill = isHistorical ? 'var(--smoke)' :
                              isIntermediate ? '#4A7FA5' :
                              ev.isActive ? prefColor : 'rgba(74,127,165,0.75)';
            return (
              <g key={`ev-diamond-${idx}`} pointerEvents={ev.isDraggable ? 'auto' : 'none'}>
                <polygon
                  points={points}
                  fill={diamondFill}
                  stroke={diamondStroke}
                  strokeWidth={1.5}
                  style={{ cursor: ev.isDraggable ? 'pointer' : 'default' }}
                  onPointerDown={ev.isDraggable ? (e) => onPointerDown(e, 'pref') : undefined}
                />
                <text
                  x={x}
                  y={finalLabelY}
                  fontSize={10}
                  fill={labelFill}
                  fontFamily="DM Mono, monospace"
                  textAnchor="middle"
                  fontWeight={ev.isActive ? '600' : '500'}
                >
                  {ev.label}
                </text>
              </g>
            );
          });
        })()}

        {/* ── Historical feed diamond (muted, Feed 1 in Peak 2 scenario) ── */}
        {!useEventDrivenStarter && hasPref && isLevain && histPrefX !== null && (() => {
          const histLabelsClose = histPrefX !== null && Math.abs(activePrefX - (histPrefX ?? 0)) < 90;
          return (
            <g pointerEvents="none">
              <polygon
                points={`${histPrefX},${AXIS_Y - S} ${histPrefX + S},${AXIS_Y} ${histPrefX},${AXIS_Y + S} ${histPrefX - S},${AXIS_Y}`}
                fill="rgba(74,127,165,0.20)" stroke="rgba(74,127,165,0.45)" strokeWidth={1.5}
              />
              {!allClose && (
                <text x={histPrefX} y={histLabelsClose ? AXIS_Y + 52 : AXIS_Y + 36}
                  fontSize={11} fill="var(--smoke)"
                  fontFamily="DM Mono, monospace" textAnchor="middle" fontWeight="600">
                  {isFr ? 'Dernier rafraîchi' : 'Last fed'}
                </text>
              )}
            </g>
          );
        })()}

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
              Feed
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
         && activeFeedHBF > 0 && (() => {
          const labelsClose = Math.abs(activePrefX - (histPrefX ?? 0)) < 70;
          return (
            <g>
              <polygon
                points={`${activePrefX},${AXIS_Y - S} ${activePrefX + S},${AXIS_Y} ${activePrefX},${AXIS_Y + S} ${activePrefX - S},${AXIS_Y}`}
                fill={prefColor}
                stroke="white"
                strokeWidth={1.5}
                style={{ cursor: 'pointer' }}
                onPointerDown={e => onPointerDown(e, 'pref')}
              />
              {!allClose && (
                <text
                  x={activePrefX}
                  y={labelsClose ? AXIS_Y + 52 : AXIS_Y + 36}
                  fontSize={10}
                  fill={prefColor}
                  fontFamily="DM Mono, monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {starterRedPill
                    ? (isFr ? 'Rafraîchi final' : 'Pre-mix Feed')
                    : (isFr ? 'Prochain rafraîchi' : 'Next Feed')}
                </text>
              )}
            </g>
          );
        })()}

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
          const showNumbers = kept.length > 1;
          return (
            <g>
              {kept.map((r, displayIdx) => {
                const labelText = showNumbers
                  ? (isFr ? `Rafraîchi ${displayIdx + 1}` : `Refresh Feed ${displayIdx + 1}`)
                  : (isFr ? 'Rafraîchi' : 'Refresh Feed');
                return (
                  <g key={`refresh-${r.idx}`}>
                    <polygon
                      points={`${r.x},${AXIS_Y - S * 0.7} ${r.x + S * 0.7},${AXIS_Y} ${r.x},${AXIS_Y + S * 0.7} ${r.x - S * 0.7},${AXIS_Y}`}
                      fill="rgba(74,127,165,0.5)"
                      stroke="#4A7FA5"
                      strokeWidth={1}
                    />
                    {(() => {
                      const tickPositions = ticks.map(tk => tk.x);
                      const collidesWithTick = tickPositions.some(tx => Math.abs(r.x - tx) < 55);
                      const activeX = activeFeedHBF !== null ? hToX(activeFeedHBF, W, WH) : null;
                      const collidesWithActive = activeX !== null && Math.abs(r.x - activeX) < 50;
                      const labelY = (collidesWithTick || collidesWithActive) ? AXIS_Y + S + 42 : AXIS_Y + S + 22;
                      return (
                        <text x={r.x} y={labelY} textAnchor="middle" fontSize="10" fill="#4A7FA5" fontWeight="500" fontFamily="var(--font-dm-mono)">
                          {labelText}
                        </text>
                      );
                    })()}
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
            { hbf: fridgeHoldRefreshHBF, label: isFr ? 'Rafraîchi' : 'Refresh', fillColor: '#4A7FA5' },
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
                    <text
                      x={x}
                      y={AXIS_Y + 22}
                      fill="var(--smoke)"
                      fontSize="9"
                      fontFamily="var(--font-dm-mono)"
                      textAnchor="middle"
                    >
                      {item.label}
                    </text>
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
          (prefStartAbsHBF > nowHBF || inBlocker(prefStartAbsHBF)) ? '#999999' : prefStroke,
          inBlocker(prefStartAbsHBF) || (isLevain && starterFeed2OutOfZone),
          'pref',
          prefStartAbsHBF > nowHBF,
        )}
        {hasPref && !knownPeakHBF && !isLevain && (
          <>
            <text
              x={clampLabelX(activePrefX, prefermentType === 'biga' ? t('cardLabels.makeBiga') : t('cardLabels.makePoolish'))}
              y={allClose ? AXIS_Y + 20 : labelsClose ? AXIS_Y + 50 : AXIS_Y + 36}
              fontSize={12}
              fill={prefColor}
              fontFamily="DM Mono, monospace"
              textAnchor="middle"
              fontWeight="600"
            >
              {isLevain
                ? (histFeedHBF !== null
                    ? (isFr ? 'Prochain repas' : 'Next Feed')
                    : (isFr ? 'Repas' : 'Feed'))
                : prefermentType === 'biga'
                  ? t('cardLabels.makeBiga')
                  : t('cardLabels.makePoolish')}
            </text>
            {/* Protocol indicator — ❄ Fridge or 🌡 RT */}
            <text
              x={clampLabelX(activePrefX, '❄ Fridge', 10)}
              y={allClose ? AXIS_Y + 34 : labelsClose ? AXIS_Y + 64 : AXIS_Y + 50}
              fontSize={10}
              fill={prefNeedsFridge ? '#6A8FAF' : '#C4A030'}
              fontFamily="DM Mono, monospace"
              textAnchor="middle"
              opacity={0.85}
            >
              {isLevain
                ? (starterFridgeOutTime
                    ? (isFr ? '❄ Frigo' : '❄ Fridge')
                    : (isFr ? 'Temp. ambiante' : 'Room temp'))
                : (prefNeedsFridge
                    ? (isFr ? '❄ Frigo' : '❄ Fridge')
                    : (isFr ? '🌡 Temp. ambiante' : '🌡 Room temp'))}
            </text>
          </>
        )}

        {/* ── Mix diamond ── */}
        {renderDiamond(
          mixX,
          inBlocker(effectiveMixHBF) ? '#aaaaaa' : DARK_SAGE,
          inBlocker(effectiveMixHBF) ? '#999999' : DARK_SAGE_STR,
          inBlocker(effectiveMixHBF),
          'mix',
        )}
        {/* ── Mix label ── */}
        <text
          x={clampLabelX(mixX, isFr ? 'Pétrissage' : 'Start Dough')} y={allClose ? AXIS_Y + 52 : AXIS_Y + 36}
          fontSize={12} fill="#3D5A30"
          fontFamily="DM Mono, monospace"
          textAnchor="middle" fontWeight="600"
        >{isFr ? 'Pétrissage' : 'Start Dough'}</text>

        {/* ── Ghost diamond (recommended position) ── */}
        {recommendedMixHBF != null &&
         Math.abs(recommendedMixHBF - effectiveMixHBF) > 0.5 && (
          <g opacity={0.35} pointerEvents="none">
            <polygon
              points={`${hToX(recommendedMixHBF, W, WH)},${AXIS_Y - S}
                ${hToX(recommendedMixHBF, W, WH) + S},${AXIS_Y}
                ${hToX(recommendedMixHBF, W, WH)},${AXIS_Y + S}
                ${hToX(recommendedMixHBF, W, WH) - S},${AXIS_Y}`}
              fill="#3D5A30"
              stroke="white"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>

      {/* Optional drag invitation — an offer, not an instruction; sits
          right under the graph and retires after the first drag */}
      {!hasDragged && !startTimeInPast && (
        <div style={{
          textAlign: 'center', fontSize: '11px', marginTop: '4px',
          color: '#8A7F78', fontFamily: 'DM Sans, sans-serif',
          fontStyle: 'italic',
        }}>
          {isFr
            ? 'Envie d’ajuster ? Les losanges ◆ se déplacent'
            : 'Want to tweak the times? The diamonds ◆ are draggable'}
        </div>
      )}

      {/* ── How to read this chart — permanent, collapsible, calm ── */}
      <div style={{ marginTop: '6px' }}>
        <button
          onClick={() => setLegendOpen(o => !o)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
            fontFamily: 'var(--font-dm-mono)', fontSize: '10.5px', color: 'var(--smoke, #8A7F78)',
            textDecoration: 'underline', textUnderlineOffset: '2px',
          }}
        >
          {legendOpen
            ? (isFr ? '− Comment lire ce graphique' : '− How to read this chart')
            : (isFr ? '? Comment lire ce graphique' : '? How to read this chart')}
        </button>
        {legendOpen && (
          <div style={{
            marginTop: '6px', padding: '10px 12px',
            background: 'rgba(26,22,18,0.03)', border: '1px solid var(--border, #E8E0D5)',
            borderRadius: '10px', fontFamily: 'var(--font-dm-sans)', fontSize: '12px',
            color: 'var(--ash, #3D3530)', lineHeight: 1.65,
          }}>
            {([
              [isFr ? 'Les cloches' : 'The bells', isFr
                ? "chaque courbe est une fermentation qui monte, culmine, puis retombe. La première est votre préferment ou levain, la seconde votre pâte."
                : 'each curve is a fermentation rising, peaking, then falling. The first is your preferment or starter, the second your dough.'],
              [isFr ? 'Les losanges' : 'The diamonds', isFr
                ? 'vos moments d\'action, posés sur la ligne du temps. Faites-les glisser pour déplacer « Faire le poolish » ou « Pétrissage » — les courbes suivent.'
                : 'your action moments, sitting on the timeline. Drag them to move "Make Poolish" or "Start Dough" — the curves follow.'],
              [isFr ? 'Les zones colorées' : 'The coloured zones', isFr
                ? 'les fenêtres recommandées pour chaque action. Au centre, le point idéal.'
                : 'the recommended windows for each action. The centre is the sweet spot.'],
              [isFr ? 'Les hachures' : 'The hatched columns', isFr
                ? 'vos indisponibilités (sommeil, travail) — le plan les contourne.'
                : 'your busy hours (sleep, work) — the plan works around them.'],
              [isFr ? 'Les plateaux' : 'The flat stretches', isFr
                ? 'du temps au frigo : la biologie ralentit presque à l\'arrêt. C\'est voulu.'
                : 'fridge time: the biology slows almost to a pause. That\'s by design.'],
            ] as const).map(([term, body]) => (
              <div key={term} style={{ marginBottom: '5px' }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10.5px', color: 'var(--terra, #C4522A)', fontWeight: 700 }}>{term}</span>
                <span> — {body}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Gentle reminder: the schedule is a guide, not a stopwatch ── */}
      <div style={{
        marginTop: '8px', fontFamily: 'var(--font-dm-sans)', fontSize: '11px',
        color: 'var(--smoke, #8A7F78)', lineHeight: 1.5, fontStyle: 'italic',
      }}>
        {isFr
          ? 'Les horaires sont indicatifs — la chaleur, la farine et la vigueur de votre levain décalent le pic de quelques heures. Fiez-vous à votre levain et à votre pâte autant qu’à l’horloge.'
          : 'Times are a guide — warmth, flour and starter vigour can shift the real peak by a couple of hours. Trust your starter and dough as much as the clock.'}
      </div>

    </div>
  );
}
