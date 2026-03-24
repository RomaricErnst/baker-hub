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
}

// ── Constants ────────────────────────────────────────────────
const WINDOW_H_DEFAULT = 96;
const PAD       = 14;
const CHART_H   = 120;
const BL        = 96;   // single baseline for ALL bells
const MAXH      = 78;   // max bell height
const AXIS_Y    = 108;  // axis line Y

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
function makeBellPath(peakHBF: number, sigma: number, W: number, wh = WINDOW_H_DEFAULT): string {
  const N = 260;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * wh;
    const x = hToX(hbf, W, wh);
    const y = BL - bell(hbf, peakHBF, sigma) * MAXH;
    pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L ${hToX(wh, W, wh).toFixed(1)} ${BL}`);
  pts.push(`L ${hToX(0,  W, wh).toFixed(1)} ${BL}`);
  pts.push('Z');
  return pts.join(' ');
}

// ── Formatting ───────────────────────────────────────────────
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
  windowH, prefInFridge, hasColdRetard,
}: FermentChartProps) {
  const WH = windowH ?? WINDOW_H_DEFAULT;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [W, setW]    = useState(320);
  const [dragging, setDragging] = useState<'mix' | 'pref' | null>(null);

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
  const prefColor  = isLevain ? '#4A7FA5' : '#C4A030';
  const prefStroke = isLevain ? '#2A5F85' : '#7A6010';
  const SAGE       = '#6B7A5A';
  const TERRA      = '#C4522A';
  const CHAR       = '#1A1612';

  // ── Physics ──────────────────────────────────────────────
  // Cold-aware dough bell: wider sigma, later peak for cold retard schedules
  const DOUGH_SIG          = hasColdRetard ? 18 : 10;
  const DOUGH_SWEET_CENTER = hasColdRetard ? 34 : 20;

  const optH            = hasPref ? getPrefOptH(prefermentType, kitchenTemp) : 0;
  const prefSig         = hasPref ? getPrefSig(prefermentType, kitchenTemp)  : 1;
  const prefStartAbsHBF = mixOffsetH + prefOffsetH;
  const doughPeakHBF    = mixOffsetH - DOUGH_SWEET_CENTER;
  const prefPeakHBF     = prefStartAbsHBF - optH;

  // Sweet-spot zones (cold retard: 20–52h; RT: 14–26h)
  const doughZoneFrom = hasColdRetard ? 52 : 26;
  const doughZoneTo   = hasColdRetard ? 20 : 14;
  const prefZoneFrom  = hasPref ? mixOffsetH + optH + 3 : 0;
  const prefZoneTo    = hasPref ? mixOffsetH + optH - 3 : 0;

  // ── Pixel positions ──────────────────────────────────────
  const mixX  = hToX(mixOffsetH, W, WH);
  const prefX = hasPref ? hToX(prefStartAbsHBF, W, WH) : 0;
  const bakeX = hToX(0, W, WH);

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
      return hbf >= hbfEnd && hbf <= hbfStart;
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
      const h = Math.max(3, Math.min(WH - 2, snap15(xToHBF(x, W, WH))));
      onMixChange(h);
    } else {
      const abs = Math.max(mixOffsetH + 1, Math.min(WH - 2, snap15(xToHBF(x, W, WH))));
      onPrefChange(abs - mixOffsetH);
    }
  }

  function onPointerUp() { setDragging(null); }

  // ── Status logic ─────────────────────────────────────────
  const mixInZone   = mixOffsetH >= doughZoneTo   && mixOffsetH <= doughZoneFrom;
  const mixTooEarly = mixOffsetH > doughZoneFrom;
  const mixStatus   = mixInZone   ? '🟢 Dough ready at bake'
    : mixTooEarly ? '🔴 Too early — over-fermented'
    : '🔴 Too late — under-fermented';

  const prefInZone = hasPref && prefOffsetH >= optH - 3 && prefOffsetH <= optH + 3;
  const prefStatus = prefInZone ? '🟢 Ready at mix' : '🟡 Adjust start time';

  // ── Info card data ───────────────────────────────────────
  const mixTime  = new Date(bakeMs - mixOffsetH * 3600000);
  const prefTime = hasPref ? new Date(bakeMs - prefStartAbsHBF * 3600000) : null;

  const prefLabel = prefermentType === 'sourdough' || prefermentType === 'levain'
    ? 'Feed starter'
    : prefermentType === 'biga'    ? 'Start Biga'
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
  ) {
    const x1 = hToX(fromHBF, W, WH);
    const x2 = hToX(toHBF,   W, WH);
    if (x2 <= x1 + 1) return null;
    return (
      <g>
        <rect x={x1} y={0} width={x2 - x1} height={BL}
          fill={`${color}12`} />
        <line x1={x1} y1={0} x2={x1} y2={BL}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />
        <line x1={x2} y1={0} x2={x2} y2={BL}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />
        <text x={(x1 + x2) / 2} y={labelY} fontSize={8} fill={color}
          textAnchor="middle" fontFamily="DM Mono, monospace" fillOpacity={0.65}>
          {label}
        </text>
      </g>
    );
  }

  // ── Diamond renderer ─────────────────────────────────────
  function renderDiamond(
    cx: number, fill: string, stroke: string, warn: boolean,
    which: 'mix' | 'pref',
  ) {
    return (
      <g
        style={{ cursor: dragging === which ? 'grabbing' : 'grab' }}
        onPointerDown={e => onPointerDown(e, which)}
      >
        <polygon
          points={`${cx},${AXIS_Y - S} ${cx + S},${AXIS_Y} ${cx},${AXIS_Y + S} ${cx - S},${AXIS_Y}`}
          fill={fill} stroke={stroke} strokeWidth={1.5}
        />
        {warn && (
          <>
            <circle cx={cx + S + 3} cy={AXIS_Y - S} r={5} fill="rgba(196,82,42,0.9)" />
            <text x={cx + S + 3} y={AXIS_Y - S + 4} fontSize={7} fill="white"
              textAnchor="middle" fontFamily="DM Mono, monospace">!</text>
          </>
        )}
      </g>
    );
  }

  // ── Drop-line renderer ───────────────────────────────────
  function renderDropLine(hbf: number, peakHBF: number, sigma: number, color: string) {
    const x  = hToX(hbf, W, WH);
    const v  = bell(hbf, peakHBF, sigma) * MAXH;
    const cy = BL - v;
    return (
      <>
        <line x1={x} y1={BL} x2={x} y2={cy}
          stroke={color} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.5} />
        <circle cx={x} cy={cy} r={3.5} fill={color} stroke="white" strokeWidth={1} />
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
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
                <rect x={x1} y={0} width={Math.max(0, x2 - x1)} height={AXIS_Y} />
              </clipPath>
            );
          })}
        </defs>

        {/* ── Bake reference line ── */}
        <line x1={bakeX} y1={0} x2={bakeX} y2={AXIS_Y}
          stroke={TERRA} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.25} />

        {/* ── Mix reference line (hasPref only) ── */}
        {hasPref && (
          <line x1={mixX} y1={0} x2={mixX} y2={AXIS_Y}
            stroke={CHAR} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.2} />
        )}

        {/* ── Sweet-spot zones ── */}
        {renderZone(doughZoneFrom, doughZoneTo, SAGE,      'Mix here',   10)}
        {hasPref && renderZone(prefZoneFrom, prefZoneTo, prefColor, 'Start here', 20)}

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
              <rect x={x1} y={0} width={x2 - x1} height={AXIS_Y} fill="rgba(196,82,42,0.09)" />
              <g clipPath={`url(#bc-${i})`}>
                {Array.from({ length: n }, (_, j) => {
                  const ox = x1 + j * 7 - AXIS_Y;
                  return (
                    <line key={j}
                      x1={ox} y1={0} x2={ox + AXIS_Y} y2={AXIS_Y}
                      stroke="rgba(196,82,42,0.16)" strokeWidth={1}
                    />
                  );
                })}
              </g>
              <line x1={x1} y1={0} x2={x2} y2={0}
                stroke="rgba(196,82,42,0.5)" strokeWidth={2.5} />
            </g>
          );
        })}

        {/* ── Pref bell (drawn first so dough overlaps) ── */}
        {hasPref && (
          <>
            <path
              d={makeBellPath(prefPeakHBF, prefSig, W, WH)}
              fill={`${prefColor}2E`} stroke={`${prefColor}A5`} strokeWidth={1.5}
            />
            <text x={PAD + 2} y={24} fontSize={8.5} fill={prefColor} fillOpacity={0.7}
              fontFamily="DM Mono, monospace">{prefTypeName}</text>
            {renderDropLine(
              prefStartAbsHBF, prefPeakHBF, prefSig,
              inBlocker(prefStartAbsHBF) ? '#aaaaaa' : prefColor,
            )}
          </>
        )}

        {/* ── Dough bell (drawn on top) ── */}
        <path
          d={makeBellPath(doughPeakHBF, DOUGH_SIG, W, WH)}
          fill={`${SAGE}2E`} stroke={`${SAGE}A5`} strokeWidth={1.5}
        />
        <text x={PAD + 2} y={12} fontSize={8.5} fill={SAGE} fillOpacity={0.7}
          fontFamily="DM Mono, monospace">Dough</text>
        {renderDropLine(
          mixOffsetH, doughPeakHBF, DOUGH_SIG,
          inBlocker(mixOffsetH) ? '#aaaaaa' : SAGE,
        )}

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
            <text x={tk.x} y={AXIS_Y + 13} fontSize={7.5} fill="var(--smoke)"
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
        <text x={bakeX} y={AXIS_Y + 14} fontSize={8} fill={TERRA}
          fontFamily="DM Mono, monospace" textAnchor="middle">Bake</text>

        {/* ── Pref diamond ── */}
        {hasPref && renderDiamond(
          prefX,
          inBlocker(prefStartAbsHBF) ? '#aaaaaa' : prefColor,
          inBlocker(prefStartAbsHBF) ? '#999999' : prefStroke,
          inBlocker(prefStartAbsHBF),
          'pref',
        )}

        {/* ── Mix diamond ── */}
        {renderDiamond(
          mixX,
          inBlocker(mixOffsetH) ? '#aaaaaa' : CHAR,
          inBlocker(mixOffsetH) ? '#999999' : 'white',
          inBlocker(mixOffsetH),
          'mix',
        )}
      </svg>

      {/* ── Info cards ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '.6rem', flexWrap: 'wrap' }}>
        {/* Pref card */}
        {hasPref && prefTime && (
          <div style={{
            flex: 1, minWidth: '120px',
            background: 'var(--cream)', border: '1.5px solid var(--border)',
            borderRadius: '10px', padding: '.45rem .7rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
              <div style={{ width: 8, height: 8, background: prefColor, transform: 'rotate(45deg)', flexShrink: 0 }} />
              <div style={{
                fontSize: '.6rem', color: 'var(--smoke)',
                fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em',
              }}>{prefLabel}</div>
            </div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
              {fmtDT(prefTime)}
            </div>
            <div style={{ fontSize: '.65rem', marginTop: '.1rem', color: prefInZone ? '#4A7A3A' : '#C49A28' }}>
              {prefStatus}
            </div>
            {prefInFridge && (
              <div style={{ fontSize: '.62rem', marginTop: '.2rem', color: '#3A5A8A', fontFamily: 'var(--font-dm-mono)' }}>
                🧊 Cold ferment — use fridge
              </div>
            )}
          </div>
        )}

        {/* Mix card */}
        <div style={{
          flex: 1, minWidth: '120px',
          background: 'var(--cream)', border: '1.5px solid var(--border)',
          borderRadius: '10px', padding: '.45rem .7rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
            <div style={{ width: 8, height: 8, background: CHAR, transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{
              fontSize: '.6rem', color: 'var(--smoke)',
              fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em',
            }}>Start mixing</div>
          </div>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {fmtDT(mixTime)}
          </div>
          <div style={{ fontSize: '.65rem', marginTop: '.1rem', color: mixInZone ? '#4A7A3A' : TERRA }}>
            {mixStatus}
          </div>
        </div>
      </div>

      {/* ── Hint text ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '.45rem' }}>
        {hasPref ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width={10} height={10} style={{ flexShrink: 0 }}>
                <polygon points="5,0 10,5 5,10 0,5" fill={prefColor} />
              </svg>
              <span style={{ fontSize: '.68rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                drag to set {prefTypeName.toLowerCase()} start — curve moves, zone stays
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width={10} height={10} style={{ flexShrink: 0 }}>
                <polygon points="5,0 10,5 5,10 0,5" fill={CHAR} />
              </svg>
              <span style={{ fontSize: '.68rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                drag to move the whole plan
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={10} height={10} style={{ flexShrink: 0 }}>
              <polygon points="5,0 10,5 5,10 0,5" fill={CHAR} />
            </svg>
            <span style={{ fontSize: '.68rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
              drag to set mix time
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
