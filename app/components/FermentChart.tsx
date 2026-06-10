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
const CHART_H   = 252;
const TOP_PAD   = 72;   // space above curves for window labels
const BL        = 175;  // baseline = TOP_PAD + curve height area
const MAXH      = 110;  // max bell height (fits within TOP_PAD to BL)
const AXIS_Y    = 175;  // axis line = same as baseline BL

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
  const isBread = ['pain_campagne','pain_levain','baguette','pain_complet',
                   'pain_seigle','fougasse','brioche','pain_mie','pain_viennois'].includes(styleKey);
  // Bread styles: slightly slower RT peak (lower yeast, more enzymatic)
  if (isBread) {
    if (temp >= 30) return 5;
    if (temp >= 28) return 7;
    if (temp >= 26) return 9;
    if (temp >= 24) return 11;
    return 14;
  }
  // Pizza / sourdough styles
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
  const pts: string[] = [];
  const left = startHBF ?? wh;
  const floor = startHBF !== undefined ? bell(startHBF, peakHBF, sigma) : 0;
  const range = Math.max(0.01, 1 - floor);
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * left;
    const x = hToX(hbf, W, wh);
    const y = BL - ((bell(hbf, peakHBF, sigma) - floor) / range) * MAXH;
    pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L ${hToX(left, W, wh).toFixed(1)} ${BL}`);
  pts.push(`L ${hToX(0,    W, wh).toFixed(1)} ${BL}`);
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

function makeFridgePhaseBellPath(
  feedHBF: number,
  fridgeOutHBF: number,
  fridgePeakH: number,
  fridgeSigma: number,
  feedToFridgeOutH: number,
  starterColdFactor: number,
  fridgeHeightAtRemoval: number,
  W: number,
  WH: number,
): string {
  const N = 300;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * feedHBF;
    let normH: number;
    if (hbf >= fridgeOutHBF) {
      const fridgeBellCenter = feedHBF - fridgePeakH;
      const rawFridgeH = Math.exp(-0.5 * ((hbf - fridgeBellCenter) / fridgeSigma) ** 2);
      const fridgeAtRemoval = Math.exp(-0.5 * ((fridgeOutHBF - fridgeBellCenter) / fridgeSigma) ** 2);
      normH = fridgeAtRemoval > 0
        ? rawFridgeH / fridgeAtRemoval * fridgeHeightAtRemoval
        : rawFridgeH;
    } else {
      const rtHoursAfterRemoval = fridgeOutHBF - hbf;
      const fridgeEquivAfterRemoval = rtHoursAfterRemoval * starterColdFactor;
      const totalEquivH = feedToFridgeOutH + fridgeEquivAfterRemoval;
      normH = Math.exp(-0.5 * ((totalEquivH - fridgePeakH) / fridgeSigma) ** 2);
    }
    normH = Math.max(0, Math.min(1, normH));
    const x = hToX(hbf, W, WH);
    const y = BL - normH * MAXH;
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
  const DOUGH_SIG          = hasColdRetard ? 18 : Math.max(3, WH * 0.35);
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

  // Q10 cold activity model for fridge starter
  const starterColdFactor = isLevain && starterFridgeOutTime
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
  const labelsClose = hasPref && Math.abs(mixX - activePrefX) < 100;
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
  {
    const firstTick = new Date(bakeMs);
    firstTick.setMinutes(0, 0, 0);
    firstTick.setHours(Math.floor(firstTick.getHours() / tickIntervalH) * tickIntervalH);
    for (let tMs = firstTick.getTime(); tMs > bakeMs - WH * 3600000; tMs -= tickIntervalH * 3600000) {
      const h = (bakeMs - tMs) / 3600000;
      if (h < 1.5) continue;
      if (h > WH - 0.5) continue;
      const tick = new Date(tMs);
      const wd = tick.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' });
      const hr = tick.getHours();
      const timeLabel = hr === 0 ? t('tickLabels.midnight')
        : hr === 6 ? t('tickLabels.6am')
        : hr === 12 ? t('tickLabels.noon')
        : hr === 18 ? t('tickLabels.6pm')
        : isFr ? `${hr}h`
        : `${hr > 12 ? hr - 12 : hr}${hr < 12 ? 'am' : 'pm'}`;
      ticks.push({ x: hToX(h, W, WH), label: `${wd} ${timeLabel}` });
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
  const prefInZone     = hasPref && prefOffsetH >= 3 && prefOffsetH <= prefOptHChart;
  const prefEarlyOk    = hasPref && prefOffsetH > prefOptHChart && prefOffsetH <= prefMaxHChart;
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
               prefermentType === 'levain' || prefermentType === 'sourdough' ? 'Starter' :
               'Poolish'}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="24" height="10" viewBox="0 0 24 10">
            <path d="M0,8 Q6,0 12,5 Q18,10 24,2" stroke="#4A6B3A" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
            Dough
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
                <rect x={x1} y={TOP_PAD} width={Math.max(0, x2 - x1)} height={AXIS_Y - TOP_PAD} />
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
              <rect x={x1} y={TOP_PAD} width={x2 - x1} height={AXIS_Y - TOP_PAD} fill="rgba(196,82,42,0.09)" />
              <g clipPath={`url(#bc-${chartId}-${i})`}>
                {Array.from({ length: n }, (_, j) => {
                  const ox = x1 + j * 7 - AXIS_Y;
                  return (
                    <line key={j}
                      x1={ox} y1={TOP_PAD} x2={ox + AXIS_Y} y2={AXIS_Y}
                      stroke="rgba(196,82,42,0.16)" strokeWidth={1}
                    />
                  );
                })}
              </g>
              <line x1={x1} y1={TOP_PAD} x2={x2} y2={TOP_PAD}
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
                    return (
                      <path
                        key={`ev-bell-${idx}`}
                        d={
                          ev.hasFridgePhase && fridgeOutHBF !== null && feedToFridgeOutH !== null
                            ? makeFridgePhaseBellPath(
                                feedHBF,
                                fridgeOutHBF,
                                fridgePeakH,
                                fridgeSigma,
                                feedToFridgeOutH,
                                starterColdFactor,
                                fridgeHeightAtRemoval,
                                W, WH
                              )
                            : makeBellPath(peakHBF, sigma, W, WH, feedHBF)
                        }
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
                <path
                  d={(() => {
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
                  })()}
                  fill={`${prefColor}2E`}
                  stroke={`${prefColor}A5`}
                  strokeWidth={1.5}
                  clipPath={`url(#chart-area-clip-${chartId})`}
                />
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

        {/* ── Ticks — max 5, min 32px apart ── */}
        {(() => {
          const visible: typeof ticks = [];
          for (const tk of ticks) {
            if (visible.length >= 5) break;
            const prev = visible[visible.length - 1];
            if (!prev || Math.abs(tk.x - prev.x) >= 32) visible.push(tk);
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
        <text x={bakeX} y={AXIS_Y + 20} fontSize={14} fontWeight="600" fill={TERRA}
          fontFamily="DM Mono, monospace" textAnchor="middle">{t('bakeLabel')}</text>

        {/* ── Event-driven diamonds + labels (sourdough) ── */}
        {useEventDrivenStarter && starterEvents.filter(ev => ev.kind !== 'fridge_out').map((ev, idx) => {
          if (ev.kind === 'fridge_in') return null;
          const hbf = (bakeMs - ev.time.getTime()) / 3600000;
          if (hbf < 0 || hbf > WH) return null;
          const x = hToX(hbf, W, WH);
          const isFridgeOut = ev.kind === 'fridge_out';
          const isHistorical = ev.kind === 'last_fed' && ev.isPast;
          const isIntermediate = ev.kind === 'intermediate_refresh';
          const diamondFill = isHistorical ? 'rgba(74,127,165,0.20)' :
                              isIntermediate ? 'rgba(74,127,165,0.5)' :
                              isFridgeOut ? 'rgba(140,200,230,0.5)' :
                              ev.isActive ? prefColor : 'rgba(74,127,165,0.45)';
          const diamondStroke = isHistorical ? 'rgba(74,127,165,0.45)' :
                                isIntermediate ? '#4A7FA5' :
                                isFridgeOut ? '#5A9DC9' :
                                ev.isActive ? 'white' : 'rgba(74,127,165,0.75)';
          const diamondSize = isIntermediate ? S * 0.7 : S;
          const points = `${x},${AXIS_Y - diamondSize} ${x + diamondSize},${AXIS_Y} ${x},${AXIS_Y + diamondSize} ${x - diamondSize},${AXIS_Y}`;
          const tickPositions = ticks.map(tk => tk.x);
          const collidesWithTick = tickPositions.some(tx => Math.abs(x - tx) < 40);
          const labelY = collidesWithTick ? AXIS_Y + S + 38 : AXIS_Y + S + 20;
          const labelFill = isHistorical ? 'var(--smoke)' :
                            isIntermediate ? '#4A7FA5' :
                            isFridgeOut ? '#5A9DC9' :
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
                y={labelY}
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
        })}

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
                      const collidesWithTick = tickPositions.some(tx => Math.abs(r.x - tx) < 40);
                      const activeX = activeFeedHBF !== null ? hToX(activeFeedHBF, W, WH) : null;
                      const collidesWithActive = activeX !== null && Math.abs(r.x - activeX) < 50;
                      const labelY = (collidesWithTick || collidesWithActive) ? AXIS_Y + S + 38 : AXIS_Y + S + 20;
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

        {/* Path B diamonds: Refresh, Into Fridge, Out of Fridge */}
        {isFridgeHoldPath && fridgeHoldRefreshHBF !== null && fridgeHoldInHBF !== null && fridgeHoldOutHBF !== null && (() => {
          const items = [
            { hbf: fridgeHoldRefreshHBF, label: isFr ? 'Rafraîchi' : 'Refresh',       fillColor: '#4A7FA5' },
            { hbf: fridgeHoldInHBF,      label: isFr ? 'Au frigo' : 'Into fridge',    fillColor: '#96B4D2' },
            { hbf: fridgeHoldOutHBF,     label: isFr ? 'Sortie' : 'Out of fridge',    fillColor: '#96B4D2' },
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
              x={activePrefX}
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
              x={activePrefX}
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
          x={mixX} y={allClose ? AXIS_Y + 52 : labelsClose ? AXIS_Y + 50 : AXIS_Y + 36}
          fontSize={12} fill="#3D5A30"
          fontFamily="DM Mono, monospace"
          textAnchor="middle" fontWeight="600"
        >Start Dough</text>

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

    </div>
  );
}
