'use client';
import { useRef, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type AvailabilityBlock } from '../utils';

export interface FermentChartProps {
  eatTime: Date;
  prefermentType: string;   // 'none' | 'biga' | 'poolish' | 'levain' | 'sourdough'
  kitchenTemp: number;
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
}

// ── Constants ────────────────────────────────────────────────
const WINDOW_H_DEFAULT = 96;
const PAD       = 16;
const CHART_H   = 240;
const TOP_PAD   = 60;   // space above curves for window labels
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

export function getPrefOptH(type: string, temp: number, inFridge = false, styleKey = 'neapolitan'): number {
  if (type === 'biga') return 48;       // biga fridge: 48h optimal, up to 72h safe
  if (type === 'poolish') {
    if (inFridge) return 18;            // poolish fridge: 18h optimal (overnight), 24h max
    // RT poolish optimal = RT peak time for this style+temp
    return getPrefPeakH_RT(type, temp, styleKey);
  }
  // levain / sourdough
  if (temp >= 30) return 5;
  if (temp >= 26) return 7;
  return 9;
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
  const range = 1 - floor;
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
  startHBF: number,
): string {
  function pbell(h: number): number {
    const dist = Math.abs(h - peakHBF);
    if (dist <= plateauHalfW) return 1.0;
    return Math.exp(-0.5 * ((dist - plateauHalfW) / sigma) ** 2);
  }
  const N = 320;
  const floor = pbell(startHBF);
  const range = Math.max(0.01, 1 - floor);
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * startHBF;
    const x = hToX(hbf, W, wh);
    const y = BL - ((pbell(hbf) - floor) / range) * MAXH;
    pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L ${hToX(startHBF, W, wh).toFixed(1)} ${BL}`);
  pts.push(`L ${hToX(0, W, wh).toFixed(1)} ${BL}`);
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
  eatTime, prefermentType, kitchenTemp,
  mixOffsetH, prefOffsetH,
  blocks, onMixChange, onPrefChange, onDragStart, onDragEnd,
  windowH, prefInFridge, hasColdRetard, sweetCenterH, sweetFromH, sweetToH,
  nowHBF = 999, phases, scheduleNote,
  recommendedMixHBF, showZoneLabels, hasDragged,
}: FermentChartProps) {
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
  const DOUGH_SIG          = hasColdRetard ? 18 : 10;
  const DOUGH_SWEET_CENTER = sweetCenterH ?? (hasColdRetard ? 26 : 6);

  // Two-temperature poolish protocol:
  // needsFridge = offset > RT peak time for this style+temp
  // If fridge: peak = AT mix (fridge cold phase + RT warmup lands at mix)
  // If RT only: peak = after mix naturally (curve still rising at mix = honest)
  const rtPeakH = hasPref ? getPrefPeakH_RT(prefermentType, kitchenTemp) : 0;
  const prefNeedsFridge = hasPref && (prefermentType === 'biga' || prefOffsetH > rtPeakH);
  const prefSig = hasPref ? getPrefSig(prefermentType, kitchenTemp, prefNeedsFridge, prefOffsetH) : 1;

  // Plateau width = science-based peak window at cold retard temps:
  // Poolish fridge: ±3h (narrow — peaks and holds ~6h total then declines fast)
  // Biga fridge:   ±10h (broad — much more forgiving, ~20h quality window)
  // RT: no plateau — sharp bell (fast biology, narrow peak)
  const plateauHalfW = prefNeedsFridge
    ? (prefermentType === 'biga' ? 10 : 3)
    : 0;

  // Over-fermentation: peak drifts left of mix when past threshold
  const prefOverFermentH = prefermentType === 'biga' ? 72 : 48;

  // During drag, use local position for all mix-derived values
  const effectiveMixHBF = localMixHBF !== null ? localMixHBF : mixOffsetH;

  const prefStartAbsHBF = Math.min(
    effectiveMixHBF + prefOffsetH,
    nowHBF - 0.25
  );
  const doughPeakHBF = effectiveMixHBF - DOUGH_SWEET_CENTER;
  // Fridge protocol: RT warmup guarantees peak exactly at mix
  // Full RT: peak happens naturally at rtPeakH after poolish start
  const prefPeakHBF = prefNeedsFridge
    ? prefOffsetH > prefOverFermentH
      ? effectiveMixHBF + (prefOffsetH - prefOverFermentH) * 0.5  // drifts left – over-fermented
      : effectiveMixHBF                         // peaks AT mix – fridge protocol
    : prefStartAbsHBF - rtPeakH;               // peaks naturally (RT)

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
  const prefZoneFrom  = hasPref ? effectiveMixHBF + prefZoneMax : 0;
  const prefZoneTo    = hasPref ? effectiveMixHBF + 3 : 0;

  // ── Pixel positions ──────────────────────────────────────
  const mixX  = hToX(effectiveMixHBF, W, WH);
  const prefX = hasPref ? hToX(prefStartAbsHBF, W, WH) : 0;
  const bakeX = hToX(0, W, WH);

  // ── Label collision detection ────────────────────────────
  const labelsClose = hasPref && Math.abs(mixX - prefX) < 80;

  // ── Blocker helpers ──────────────────────────────────────
  const bakeMs = eatTime.getTime();

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

  // Adaptive ticks: 3h short / 12h medium / 24h long — same as SimpleColourBar
  const tickIntervalH = WH <= 18 ? 3 : WH <= 72 ? 12 : 24;
  const ticks: { x: number; label: string }[] = [];
  for (let h = tickIntervalH; h < WH; h += tickIntervalH) {
    const tick = new Date(bakeMs - h * 3600000);
    if (tick.getMinutes() !== 0) continue;
    const wd = tick.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' });
    const hr = tick.getHours();
    const timeLabel = hr === 0  ? t('tickLabels.midnight')
      : hr === 6  ? t('tickLabels.6am')
      : hr === 12 ? t('tickLabels.noon')
      : hr === 18 ? t('tickLabels.6pm')
      : isFr
      ? `${hr}h`
      : `${hr > 12 ? hr - 12 : hr}${hr < 12 ? 'am' : 'pm'}`;
    ticks.push({ x: hToX(h, W, WH), label: `${wd} ${timeLabel}` });
  }

  // ── Pointer events ───────────────────────────────────────
  function getSvgX(e: React.PointerEvent): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return e.clientX - rect.left;
  }

  function onPointerDown(e: React.PointerEvent, which: 'mix' | 'pref') {
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
      const maxAbs = Math.min(WH - 2, nowHBF - 0.25);
      const abs = Math.max(effectiveMixHBF + 0.25, Math.min(maxAbs, snap15(xToHBF(x, W, WH))));
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
          markerStart={x1 >= 0 ? `url(#arrow-${markerId}-start)` : undefined}
          markerEnd={`url(#arrow-${markerId}-end)`}
        />}
      </g>
    );
  }

  // ── Diamond renderer ─────────────────────────────────────
  function renderDiamond(
    cx: number, fill: string, stroke: string, warn: boolean,
    which: 'mix' | 'pref',
  ) {
    const shouldGlow = showZoneLabels && (
      (which === 'mix' && glowState === 'mix')
      || (which === 'pref' && glowState === 'pref')
    );
    return (
      <g
        style={{ cursor: dragging === which ? 'grabbing' : 'grab' }}
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
              <clipPath key={i} id={`bc-${i}`}>
                <rect x={x1} y={TOP_PAD} width={Math.max(0, x2 - x1)} height={AXIS_Y - TOP_PAD} />
              </clipPath>
            );
          })}
          {/* Bidirectional arrow markers for zone width indicators */}
          <marker id="arrow-sage-start" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M6,0 L0,3 L6,6" fill="none" stroke="#6B7A5A" strokeWidth="1.2"/>
          </marker>
          <marker id="arrow-sage-end" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke="#6B7A5A" strokeWidth="1.2"/>
          </marker>
          <marker id="arrow-pref-start" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M6,0 L0,3 L6,6" fill="none" stroke={prefColor} strokeWidth="1.2"/>
          </marker>
          <marker id="arrow-pref-end" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke={prefColor} strokeWidth="1.2"/>
          </marker>
          {/* Chart area clip — hide anything below axis */}
          <clipPath id="chart-area-clip">
            <rect x={0} y={0} width={W} height={AXIS_Y} />
          </clipPath>
          {/* Bell clip paths — hide left tail before each diamond */}
          <clipPath id="dough-bell-clip">
            <rect x={hToX(effectiveMixHBF, W, WH)} y={0} width={W} height={CHART_H} />
          </clipPath>
          {hasPref && (
            <clipPath id="pref-bell-clip">
              <rect x={hToX(prefStartAbsHBF, W, WH)} y={0} width={W} height={CHART_H} />
            </clipPath>
          )}
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
            prefermentType === 'levain'    ? t('zoneLabels.feedStarterWindow') :
            prefermentType === 'sourdough' ? t('zoneLabels.feedStarterWindow') :
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
              <g clipPath={`url(#bc-${i})`}>
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
            <path
              d={prefNeedsFridge
                ? makePlateauBellPath(prefPeakHBF, prefSig, plateauHalfW, W, WH, prefStartAbsHBF)
                : makeBellPath(prefPeakHBF, prefSig, W, WH, prefStartAbsHBF)}
              fill={`${prefColor}2E`} stroke={`${prefColor}A5`} strokeWidth={1.5}
              clipPath="url(#chart-area-clip)"
            />
            <line
              x1={hToX(prefStartAbsHBF, W, WH)}
              y1={BL - bell(prefStartAbsHBF, prefPeakHBF, prefSig) * MAXH}
              x2={hToX(prefStartAbsHBF, W, WH)}
              y2={BL}
              stroke={`${prefColor}A5`} strokeWidth={1.5}
              clipPath="url(#pref-bell-clip)"
            />
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
          clipPath="url(#chart-area-clip)"
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
          clipPath="url(#dough-bell-clip)"
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

        {/* ── Pref diamond ── */}
        {hasPref && renderDiamond(
          prefX,
          inBlocker(prefStartAbsHBF) ? '#aaaaaa' : prefColor,
          inBlocker(prefStartAbsHBF) ? '#999999' : prefStroke,
          inBlocker(prefStartAbsHBF),
          'pref',
        )}
        {hasPref && (
          <>
            <text
              x={prefX}
              y={labelsClose ? AXIS_Y + 50 : AXIS_Y + 36}
              fontSize={12}
              fill={prefColor}
              fontFamily="DM Mono, monospace"
              textAnchor="middle"
              fontWeight="600"
            >
              {prefermentType === 'biga'      ? t('cardLabels.makeBiga')    :
               prefermentType === 'levain'    ? t('cardLabels.feedStarter') :
               prefermentType === 'sourdough' ? t('cardLabels.feedStarter') :
               t('cardLabels.makePoolish')}
            </text>
            {/* Protocol indicator — ❄ Fridge or 🌡 RT */}
            <text
              x={prefX}
              y={labelsClose ? AXIS_Y + 64 : AXIS_Y + 50}
              fontSize={10}
              fill={prefNeedsFridge ? '#6A8FAF' : '#C4A030'}
              fontFamily="DM Mono, monospace"
              textAnchor="middle"
              opacity={0.85}
            >
              {prefNeedsFridge
                ? (isFr ? '❄ Frigo' : '❄ Fridge')
                : (isFr ? '🌡 Temp. ambiante' : '🌡 Room temp')}
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
          x={mixX} y={AXIS_Y + 36}
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
