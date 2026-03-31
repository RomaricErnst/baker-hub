'use client';
import { useRef, useEffect, useState } from 'react';
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
  windowH?: number;         // total window to display (default 96h)
  prefInFridge?: boolean;   // show fridge climate note in pref card
  hasColdRetard?: boolean;  // widens bell and sweet zone for cold schedules
  phases?: {
    bulkFermH: number;
    coldRetardH: number;
    finalProofH: number;
    preheatH: number;
  };
  scheduleNote?: string | null;
  recommendedMixHBF?: number | null;
  showZoneLabels?: boolean;
}

// ── Constants ────────────────────────────────────────────────
const WINDOW_H_DEFAULT = 96;
const PAD       = 16;
const CHART_H   = 220;
const TOP_PAD   = 60;   // space above curves for window labels
const BL        = 175;  // baseline = TOP_PAD + curve height area
const MAXH      = 110;  // max bell height (fits within TOP_PAD to BL)
const AXIS_Y    = 175;  // axis line = same as baseline BL

// DOUGH_SIG and DOUGH_SWEET_CENTER are computed inside the component
// based on hasColdRetard — see derived physics section

// Diamond half-size
const S = 10;

// ── Sigma / optimal-hours functions ──────────────────────────
function getPrefSig(type: string, temp: number): number {
  if (type === 'biga') return 6;
  if (type === 'poolish') return temp >= 26 ? 3.5 : 5;
  // levain / sourdough
  if (temp >= 30) return 2;
  if (temp >= 26) return 3;
  return 4;
}

export function getPrefOptH(type: string, temp: number): number {
  if (type === 'biga') return 20;
  if (type === 'poolish') return temp >= 26 ? 12 : 10;
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

// ── Formatting ───────────────────────────────────────────────
function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}

function fmtHM(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

function fmtDT(d: Date): string {
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mo = d.toLocaleDateString('en-US', { month: 'short' });
  return `${wd} ${d.getDate()} ${mo} · ${fmtHM(d)}`;
}

// ── Component ─────────────────────────────────────────────────
export default function FermentChart({
  eatTime, prefermentType, kitchenTemp,
  mixOffsetH, prefOffsetH,
  blocks, onMixChange, onPrefChange,
  windowH, prefInFridge, hasColdRetard, phases, scheduleNote,
  recommendedMixHBF, showZoneLabels,
}: FermentChartProps) {
  const WH = windowH ?? WINDOW_H_DEFAULT;
  const containerRef  = useRef<HTMLDivElement>(null);
  const svgRef        = useRef<SVGSVGElement>(null);
  const [W, setW]     = useState(320);
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
  // Cold-aware dough bell: wider sigma, later peak for cold retard schedules
  const DOUGH_SIG          = hasColdRetard ? 18 : 10;
  const DOUGH_SWEET_CENTER = hasColdRetard ? 34 : 20;

  const optH            = hasPref ? getPrefOptH(prefermentType, kitchenTemp) : 0;
  const prefSig         = hasPref ? getPrefSig(prefermentType, kitchenTemp)  : 1;
  // During drag, use local position for all mix-derived values
  const effectiveMixHBF = localMixHBF !== null ? localMixHBF : mixOffsetH;

  const prefStartAbsHBF = effectiveMixHBF + prefOffsetH;
  const doughPeakHBF    = effectiveMixHBF - DOUGH_SWEET_CENTER;
  const prefPeakHBF     = prefStartAbsHBF - optH;

  // Sweet-spot zones (cold retard: 20–52h; RT: 14–26h)
  const doughZoneFrom = hasColdRetard ? 52 : 26;
  const doughZoneTo   = hasColdRetard ? 20 : 14;
  const prefZoneFrom  = hasPref ? effectiveMixHBF + optH + 3 : 0;
  const prefZoneTo    = hasPref ? effectiveMixHBF + optH - 3 : 0;

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

  // ── Axis ticks ───────────────────────────────────────────
  const ticks: { x: number; label: string }[] = [];
  for (let h = 24; h < WH; h += 24) {
    const t   = new Date(bakeMs - h * 3600000);
    const wd  = t.toLocaleDateString('en-US', { weekday: 'short' });
    const hr  = t.getHours();
    const ap  = hr < 12 ? 'a' : 'p';
    const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    ticks.push({ x: hToX(h, W, WH), label: `${wd} ${h12}${ap}` });
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
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    const x = getSvgX(e);
    if (dragging === 'mix') {
      // Free visual movement only — no blocker check, no onMixChange during drag
      const h = Math.max(3, Math.min(WH - 2, snap15(xToHBF(x, W, WH))));
      setLocalMixHBF(h);
    } else {
      const abs = Math.max(mixOffsetH + 1, Math.min(WH - 2, snap15(xToHBF(x, W, WH))));
      onPrefChange(abs - mixOffsetH);
    }
  }

  function onPointerUp() {
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
  const mixTooEarly = effectiveMixHBF > doughZoneFrom;
  const mixStatus   = mixInZone   ? '🟢 Dough ready at bake'
    : mixTooEarly ? '🔴 Too early — over-fermented'
    : '🔴 Too late — under-fermented';

  const prefInZone = hasPref && prefOffsetH >= optH - 3 && prefOffsetH <= optH + 3;
  const prefStatus = prefInZone ? '🟢 Ready at mix' : '🟡 Adjust start time';

  // ── Info card data ───────────────────────────────────────
  const mixTime  = new Date(bakeMs - effectiveMixHBF * 3600000);
  const prefTime = hasPref ? new Date(bakeMs - prefStartAbsHBF * 3600000) : null;

  const prefLabel = prefermentType === 'sourdough' || prefermentType === 'levain'
    ? 'Feed Starter'
    : prefermentType === 'biga'    ? 'Make Biga'
    : prefermentType === 'poolish' ? 'Make Poolish'
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
    return (
      <g>
        <rect x={x1} y={TOP_PAD} width={x2 - x1} height={BL - TOP_PAD}
          fill={`${color}12`} />
        <line x1={x1} y1={labelY + 9} x2={x1} y2={BL}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />
        <line x1={x2} y1={labelY + 9} x2={x2} y2={BL}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />
        <rect
          x={(x1 + x2) / 2 - label.length * 4}
          y={labelY - 11}
          width={label.length * 8}
          height={14}
          fill="rgba(255,255,255,0.92)"
          rx={3}
        />
        <text x={(x1 + x2) / 2} y={labelY} fontSize={11} fill={color}
          textAnchor="middle" fontFamily="DM Mono, monospace" fillOpacity={0.85} fontWeight="600">
          {label}
        </text>
        <line
          x1={x1 + 4} x2={x2 - 4}
          y1={labelY + 9} y2={labelY + 9}
          stroke={color} strokeWidth={1.2} strokeOpacity={0.7}
          markerStart={`url(#arrow-${markerId}-start)`}
          markerEnd={`url(#arrow-${markerId}-end)`}
        />
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
            prefermentType === 'biga'      ? 'Make Biga window'    :
            prefermentType === 'levain'    ? 'Feed Starter window' :
            prefermentType === 'sourdough' ? 'Feed Starter window' :
            'Make Poolish window';
          return (
            <>
              {renderZone(doughZoneFrom, doughZoneTo, SAGE, 'Start Dough window', 12, 'sage')}
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
              d={makeBellPath(prefPeakHBF, prefSig, W, WH, prefStartAbsHBF)}
              fill={`${prefColor}2E`} stroke={`${prefColor}A5`} strokeWidth={1.5}
              clipPath="url(#pref-bell-clip)"
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
          d={makeBellPath(doughPeakHBF, DOUGH_SIG, W, WH, effectiveMixHBF)}
          fill={`${SAGE}2E`} stroke={`${SAGE}A5`} strokeWidth={1.5}
          clipPath="url(#dough-bell-clip)"
        />
        <line
          x1={hToX(effectiveMixHBF, W, WH)}
          y1={BL - bell(effectiveMixHBF, doughPeakHBF, DOUGH_SIG) * MAXH}
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

        {/* ── Ticks ── */}
        {ticks.map((tk, i) => (
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
          fontFamily="DM Mono, monospace" textAnchor="middle">Bake</text>

        {/* ── Pref diamond ── */}
        {hasPref && renderDiamond(
          prefX,
          inBlocker(prefStartAbsHBF) ? '#aaaaaa' : prefColor,
          inBlocker(prefStartAbsHBF) ? '#999999' : prefStroke,
          inBlocker(prefStartAbsHBF),
          'pref',
        )}
        {hasPref && (
          <text
            x={prefX}
            y={labelsClose ? AXIS_Y + 50 : AXIS_Y + 36}
            fontSize={12}
            fill={prefColor}
            fontFamily="DM Mono, monospace"
            textAnchor="middle"
            fontWeight="600"
          >
            {prefermentType === 'biga'      ? 'Make Biga'    :
             prefermentType === 'levain'    ? 'Feed Starter' :
             prefermentType === 'sourdough' ? 'Feed Starter' :
             'Make Poolish'}
          </text>
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
