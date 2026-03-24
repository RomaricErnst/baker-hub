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
}

// ── Constants ────────────────────────────────────────────────
const WINDOW_H_DEFAULT = 96;
const PAD = 14;
const DOUGH_SIG = 10;
const DOUGH_SWEET_CENTER = 20;

// Single-row layout (no preferment)
const SINGLE_H = 100;
const SINGLE_BL = 82;
const SINGLE_MAXH = 66;
const SINGLE_AXIS_Y = 88;

// Two-row layout (preferment active)
const ROW_H = 58;
const GAP = 4;
const AXIS_ZONE = 24;
const TWO_H = ROW_H + GAP + ROW_H + AXIS_ZONE; // 144
const BL1 = ROW_H;                              // 58  — pref baseline
const BL2 = ROW_H + GAP + ROW_H;               // 120 — dough baseline
const AXIS_Y = TWO_H - 12;                      // 132
const MAXH_ROW = 50;

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

// Sample bell curve into an SVG path, baseline at BL, peak height maxH
function makeBellPath(peakHBF: number, sigma: number, BL: number, maxH: number, W: number, wh = WINDOW_H_DEFAULT): string {
  const N = 260;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const hbf = (i / N) * wh;
    const x = hToX(hbf, W, wh);
    const y = BL - bell(hbf, peakHBF, sigma) * maxH;
    pts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L ${hToX(wh, W, wh).toFixed(1)} ${BL}`);
  pts.push(`L ${hToX(0, W, wh).toFixed(1)} ${BL}`);
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
  windowH, prefInFridge,
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

  // ── Derived layout ───────────────────────────────────────
  const hasPref  = prefermentType !== 'none' && prefermentType !== '';
  const canvasH  = hasPref ? TWO_H        : SINGLE_H;
  const BL       = hasPref ? BL2          : SINGLE_BL;
  const maxH     = hasPref ? MAXH_ROW     : SINGLE_MAXH;
  const axisY    = hasPref ? AXIS_Y       : SINGLE_AXIS_Y;

  // ── Colors ───────────────────────────────────────────────
  const isLevain   = prefermentType === 'levain' || prefermentType === 'sourdough';
  const prefColor  = isLevain ? '#4A7FA5' : '#C4A030';
  const prefStroke = isLevain ? '#2A5F85' : '#7A6010';
  const SAGE       = '#6B7A5A';
  const TERRA      = '#C4522A';
  const CHAR       = '#1A1612';

  // ── Physics ──────────────────────────────────────────────
  const optH            = hasPref ? getPrefOptH(prefermentType, kitchenTemp) : 0;
  const prefSig         = hasPref ? getPrefSig(prefermentType, kitchenTemp)  : 1;
  const prefStartAbsHBF = mixOffsetH + prefOffsetH;
  const doughPeakHBF    = mixOffsetH - DOUGH_SWEET_CENTER;
  const prefPeakHBF     = prefStartAbsHBF - optH;

  // Sweet-spot zones (fixed — do NOT move when gold diamond moves)
  const doughZoneFrom = DOUGH_SWEET_CENTER + 6; // 26
  const doughZoneTo   = DOUGH_SWEET_CENTER - 6; // 14
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
      hbfStart: (bakeMs - b.from.getTime()) / 3600000, // further left (larger)
      hbfEnd:   (bakeMs - b.to.getTime())   / 3600000, // closer to bake (smaller)
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

  // ── Annotation visibility ────────────────────────────────
  const showDoughAnnotation = Math.abs(doughPeakHBF) < 2;
  const showPrefAnnotation  = hasPref && Math.abs(prefPeakHBF - mixOffsetH) < 1.5;

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

  // ── Sweet-spot zone renderer ─────────────────────────────
  function renderZone(
    fromHBF: number, toHBF: number,
    color: string, label: string,
    topY: number, botY: number,
  ) {
    const x1 = hToX(fromHBF, W, WH);
    const x2 = hToX(toHBF, W, WH);
    if (x2 <= x1 + 1) return null;
    return (
      <g>
        <rect x={x1} y={topY} width={x2 - x1} height={botY - topY}
          fill={`${color}12`} />
        <line x1={x1} y1={topY} x2={x1} y2={botY}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />
        <line x1={x2} y1={topY} x2={x2} y2={botY}
          stroke={color} strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.45} />
        <text x={(x1 + x2) / 2} y={topY + 9} fontSize={8} fill={color}
          textAnchor="middle" fontFamily="DM Mono, monospace" fillOpacity={0.65}>
          {label}
        </text>
      </g>
    );
  }

  // ── Diamond polygon renderer ─────────────────────────────
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
          points={`${cx},${axisY - S} ${cx + S},${axisY} ${cx},${axisY + S} ${cx - S},${axisY}`}
          fill={fill} stroke={stroke} strokeWidth={1.5}
        />
        {warn && (
          <>
            <circle cx={cx + S + 3} cy={axisY - S} r={5} fill="rgba(196,82,42,0.9)" />
            <text x={cx + S + 3} y={axisY - S + 4} fontSize={7} fill="white"
              textAnchor="middle" fontFamily="DM Mono, monospace">!</text>
          </>
        )}
      </g>
    );
  }

  // ── Drop-line renderer ───────────────────────────────────
  function renderDropLine(
    hbf: number, peakHBF: number, sigma: number,
    BLrow: number, maxHrow: number,
    color: string,
  ) {
    const x  = hToX(hbf, W, WH);
    const v  = bell(hbf, peakHBF, sigma) * maxHrow;
    const cy = BLrow - v;
    return (
      <>
        <line x1={x} y1={BLrow} x2={x} y2={cy}
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
      {/* ── Hint text ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '.4rem' }}>
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

      <svg
        ref={svgRef}
        width={W}
        height={canvasH}
        style={{ display: 'block', touchAction: 'none', overflow: 'visible' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* ── Hatch clip paths for blockers ── */}
        <defs>
          {blocks.map((b, i) => {
            const { hbfStart, hbfEnd } = blockerHBF(b);
            const x1 = hToX(hbfStart, W, WH);
            const x2 = hToX(hbfEnd, W, WH);
            return (
              <clipPath key={i} id={`bc-${i}`}>
                <rect x={x1} y={0} width={Math.max(0, x2 - x1)} height={axisY} />
              </clipPath>
            );
          })}
        </defs>

        {/* ── Row backgrounds (two-row mode) ── */}
        {hasPref && (
          <>
            <rect x={0} y={0}          width={W} height={BL1}   fill={`${prefColor}08`} />
            <rect x={0} y={BL1 + GAP}  width={W} height={ROW_H} fill={`${SAGE}08`} />
          </>
        )}

        {/* ── Bake reference line ── */}
        <line x1={bakeX} y1={0} x2={bakeX} y2={axisY}
          stroke={TERRA} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.25} />

        {/* ── Mix reference line (two-row only, spans both rows) ── */}
        {hasPref && (
          <line x1={mixX} y1={0} x2={mixX} y2={AXIS_Y}
            stroke={CHAR} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.2} />
        )}

        {/* ── Sweet-spot zones (never move with diamonds) ── */}
        {hasPref
          ? renderZone(doughZoneFrom, doughZoneTo, SAGE,      'Mix here',   BL1 + GAP, BL2)
          : renderZone(doughZoneFrom, doughZoneTo, SAGE,      'Mix here',   0,         SINGLE_BL)
        }
        {hasPref && renderZone(prefZoneFrom, prefZoneTo, prefColor, 'Start here', 0, BL1)}

        {/* ── Blocker columns ── */}
        {blocks.map((b, i) => {
          const { hbfStart, hbfEnd } = blockerHBF(b);
          if (hbfEnd > WH || hbfStart < 0) return null;
          const x1 = hToX(hbfStart, W, WH);
          const x2 = hToX(hbfEnd, W, WH);
          if (x2 <= x1) return null;
          const n = Math.ceil((x2 - x1 + axisY) / 7) + 2;
          return (
            <g key={i}>
              <rect x={x1} y={0} width={x2 - x1} height={axisY} fill="rgba(196,82,42,0.09)" />
              <g clipPath={`url(#bc-${i})`}>
                {Array.from({ length: n }, (_, j) => {
                  const ox = x1 + j * 7 - axisY;
                  return (
                    <line key={j}
                      x1={ox} y1={0} x2={ox + axisY} y2={axisY}
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

        {/* ── Pref bell curve (two-row mode) ── */}
        {hasPref && (
          <>
            <path
              d={makeBellPath(prefPeakHBF, prefSig, BL1, MAXH_ROW, W, WH)}
              fill={`${prefColor}26`} stroke={`${prefColor}99`} strokeWidth={1.5}
            />
            {/* Row label */}
            <text x={PAD + 2} y={10} fontSize={8} fill={prefColor} fillOpacity={0.6}
              fontFamily="DM Mono, monospace">{prefTypeName}</text>
            {/* Alignment annotation */}
            {showPrefAnnotation && (
              <text
                x={hToX(prefPeakHBF, W, WH)} y={BL1 - MAXH_ROW - 3}
                fontSize={8} fill={prefColor} fillOpacity={0.8}
                textAnchor="middle" fontFamily="DM Mono, monospace"
              >
                Ready at mix
              </text>
            )}
            {/* Drop line */}
            {renderDropLine(
              prefStartAbsHBF, prefPeakHBF, prefSig, BL1, MAXH_ROW,
              inBlocker(prefStartAbsHBF) ? '#aaaaaa' : prefColor,
            )}
          </>
        )}

        {/* ── Dough bell curve ── */}
        <path
          d={makeBellPath(doughPeakHBF, DOUGH_SIG, BL, maxH, W, WH)}
          fill={`${SAGE}26`} stroke={`${SAGE}99`} strokeWidth={1.5}
        />
        {/* Row label */}
        <text
          x={PAD + 2} y={hasPref ? BL1 + GAP + 10 : 10}
          fontSize={8} fill={SAGE} fillOpacity={0.6}
          fontFamily="DM Mono, monospace"
        >Dough</text>
        {/* Alignment annotation */}
        {showDoughAnnotation && (
          <text
            x={hToX(0, W, WH) - 4} y={BL - maxH - 3}
            fontSize={8} fill={SAGE} fillOpacity={0.8}
            textAnchor="end" fontFamily="DM Mono, monospace"
          >
            Ready at bake
          </text>
        )}
        {/* Drop line */}
        {renderDropLine(
          mixOffsetH, doughPeakHBF, DOUGH_SIG, BL, maxH,
          inBlocker(mixOffsetH) ? '#aaaaaa' : SAGE,
        )}

        {/* ── Baselines ── */}
        {hasPref && (
          <line x1={PAD} y1={BL1} x2={W - PAD} y2={BL1}
            stroke="rgba(0,0,0,0.12)" strokeWidth={0.8} />
        )}
        <line x1={PAD} y1={BL} x2={W - PAD} y2={BL}
          stroke="rgba(0,0,0,0.12)" strokeWidth={0.8} />

        {/* ── Axis line ── */}
        <line x1={PAD} y1={axisY} x2={W - PAD} y2={axisY}
          stroke="var(--border)" strokeWidth={1} />

        {/* ── Ticks ── */}
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={tk.x} y1={axisY} x2={tk.x} y2={axisY + 3}
              stroke="var(--border)" strokeWidth={1} />
            <text x={tk.x} y={axisY + 13} fontSize={7.5} fill="var(--smoke)"
              fontFamily="DM Mono, monospace" textAnchor="middle">
              {tk.label}
            </text>
          </g>
        ))}

        {/* ── Bake marker (upward triangle, not draggable) ── */}
        <polygon
          points={`${bakeX - 8},${axisY} ${bakeX},${axisY - 12} ${bakeX + 8},${axisY}`}
          fill={TERRA}
        />
        <text x={bakeX} y={axisY + 14} fontSize={8} fill={TERRA}
          fontFamily="DM Mono, monospace" textAnchor="middle">Bake</text>

        {/* ── Pref diamond (draggable) ── */}
        {hasPref && renderDiamond(
          prefX,
          inBlocker(prefStartAbsHBF) ? '#aaaaaa' : prefColor,
          inBlocker(prefStartAbsHBF) ? '#999999' : prefStroke,
          inBlocker(prefStartAbsHBF),
          'pref',
        )}

        {/* ── Mix diamond (draggable) ── */}
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
            flex: 1, minWidth: '110px',
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
          flex: 1, minWidth: '110px',
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

        {/* Bake card */}
        <div style={{
          flex: 1, minWidth: '100px',
          background: 'var(--cream)', border: '1.5px solid var(--border)',
          borderRadius: '10px', padding: '.45rem .7rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
            <div style={{ width: 8, height: 8, background: TERRA, transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{
              fontSize: '.6rem', color: 'var(--smoke)',
              fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em',
            }}>Bake</div>
          </div>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {fmtHM(eatTime)}
          </div>
          <div style={{ fontSize: '.65rem', marginTop: '.1rem', color: 'var(--smoke)' }}>
            Fixed
          </div>
        </div>
      </div>

    </div>
  );
}
