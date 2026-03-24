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
}

const WINDOW_H = 96;
const ROW_H = 72;
const AXIS_H = 44;

// ── Sigma / peak functions ───────────────────
function getDoughSigma(temp: number): number {
  if (temp >= 28) return 3;
  if (temp >= 25) return 5;
  if (temp >= 22) return 7;
  return 10;
}

function getDoughPeakH(temp: number): number {
  if (temp >= 28) return 18;
  if (temp >= 25) return 24;
  if (temp >= 22) return 36;
  return 48;
}

function getPrefSigma(type: string, temp: number): number {
  if (type === 'biga') return 5;
  if (type === 'poolish') return temp >= 26 ? 3 : 4;
  // levain / sourdough
  if (temp >= 28) return 1.5;
  if (temp >= 25) return 2.5;
  return 3.5;
}

export function getPrefOptH(type: string, temp: number): number {
  if (type === 'biga') return 16;
  if (type === 'poolish') return temp >= 26 ? 12 : 8;
  // levain / sourdough
  if (temp >= 28) return 5;
  if (temp >= 25) return 7;
  if (temp >= 22) return 9;
  return 12;
}

function bell(h: number, peakH: number, sigma: number): number {
  return Math.exp(-0.5 * ((h - peakH) / sigma) ** 2);
}

type Quality = 'good' | 'ok' | 'off';
function quality(y: number): Quality {
  if (y >= 0.65) return 'good';
  if (y >= 0.3) return 'ok';
  return 'off';
}
const Q_COLOR: Record<Quality, string> = { good: '#4A7A3A', ok: '#C49A28', off: '#C4522A' };
const Q_LABEL: Record<Quality, string> = { good: 'Great timing', ok: 'Could be better', off: 'Adjust timing' };
const Q_ICON: Record<Quality, string> = { good: '🟢', ok: '🟡', off: '🔴' };

function fmtHM(d: Date): string {
  const h = d.getHours(), m = d.getMinutes();
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

function fmtDT(d: Date): string {
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mo = d.toLocaleDateString('en-US', { month: 'short' });
  return `${wd} ${d.getDate()} ${mo} · ${fmtHM(d)}`;
}

// ── Component ────────────────────────────────
export default function FermentChart({
  eatTime, prefermentType, kitchenTemp,
  mixOffsetH, prefOffsetH,
  blocks, onMixChange, onPrefChange,
}: FermentChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(320);
  const [dragging, setDragging] = useState<'mix' | 'pref' | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasPref = prefermentType !== 'none' && prefermentType !== '';
  const totalH = (hasPref ? 2 : 1) * ROW_H + AXIS_H;
  const doughRowTop = hasPref ? ROW_H : 0;
  const prefRowTop = 0;
  const axisTop = totalH - AXIS_H;

  const toX = (hbf: number) => Math.max(0, Math.min(w, (1 - hbf / WINDOW_H) * w));
  const toHBF = (x: number) => (1 - Math.max(0, Math.min(w, x)) / w) * WINDOW_H;
  const snap15 = (h: number) => Math.round(h * 4) / 4;

  const mixX = toX(mixOffsetH);
  const prefHBF = mixOffsetH + prefOffsetH;
  const prefX = toX(prefHBF);

  const doughPeakH = getDoughPeakH(kitchenTemp);
  const doughSigma = getDoughSigma(kitchenTemp);
  const prefPeakH = hasPref ? mixOffsetH + getPrefOptH(prefermentType, kitchenTemp) : 0;
  const prefSigmaV = hasPref ? getPrefSigma(prefermentType, kitchenTemp) : 1;

  function makeBellPath(peakH: number, sigma: number, rowTop: number): string {
    const PAD = 8;
    const availH = ROW_H - PAD * 2;
    const N = Math.max(2, Math.floor(w / 2));
    let pts = '';
    for (let i = 0; i <= N; i++) {
      const px = (i / N) * w;
      const h = toHBF(px);
      const y = bell(h, peakH, sigma);
      const cy = rowTop + ROW_H - PAD - y * availH;
      pts += i === 0
        ? `M ${px.toFixed(1)} ${cy.toFixed(1)}`
        : ` L ${px.toFixed(1)} ${cy.toFixed(1)}`;
    }
    return `${pts} L ${w} ${rowTop + ROW_H} L 0 ${rowTop + ROW_H} Z`;
  }

  function getCurveY(hbf: number, peakH: number, sigma: number, rowTop: number): number {
    const PAD = 8;
    const availH = ROW_H - PAD * 2;
    return rowTop + ROW_H - PAD - bell(hbf, peakH, sigma) * availH;
  }

  // Pointer events
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
    const rawH = toHBF(x);
    if (dragging === 'mix') {
      const h = Math.max(2, Math.min(WINDOW_H - 1, snap15(rawH)));
      onMixChange(h);
    } else {
      // pref must be left of mix (earlier = larger HBF)
      const rawHBF = Math.max(mixOffsetH + 1, Math.min(WINDOW_H - 1, snap15(rawH)));
      onPrefChange(rawHBF - mixOffsetH);
    }
  }

  function onPointerUp() { setDragging(null); }

  // Blocker columns
  const bakeMs = eatTime.getTime();
  const windowStartMs = bakeMs - WINDOW_H * 3600000;

  // Axis ticks every 24h (skip bake=0)
  const ticks: { x: number; label: string }[] = [];
  for (let h = WINDOW_H; h > 0; h -= 24) {
    const t = new Date(bakeMs - h * 3600000);
    ticks.push({
      x: toX(h),
      label: t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    });
  }

  const mixTime = new Date(bakeMs - mixOffsetH * 3600000);
  const prefTime = hasPref ? new Date(bakeMs - prefHBF * 3600000) : null;
  const mixQual = quality(bell(mixOffsetH, doughPeakH, doughSigma));
  const prefLabel = prefermentType === 'sourdough' ? 'Feed starter'
    : prefermentType === 'biga' ? 'Biga'
    : prefermentType === 'poolish' ? 'Poolish'
    : prefermentType;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
      <svg
        ref={svgRef}
        width={w}
        height={totalH}
        style={{ display: 'block', touchAction: 'none', overflow: 'visible' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Row backgrounds */}
        {hasPref && <rect x={0} y={prefRowTop} width={w} height={ROW_H} fill="#F2F5EF" />}
        <rect x={0} y={doughRowTop} width={w} height={ROW_H} fill="#F8F4EE" />

        {/* Blocker columns */}
        {blocks.map((b, i) => {
          const x1 = Math.max(0, (b.from.getTime() - windowStartMs) / (WINDOW_H * 3600000) * w);
          const x2 = Math.min(w, (b.to.getTime()   - windowStartMs) / (WINDOW_H * 3600000) * w);
          if (x2 <= x1) return null;
          return <rect key={i} x={x1} y={0} width={x2 - x1} height={axisTop} fill="rgba(80,60,50,0.09)" />;
        })}

        {/* Pref bell curve */}
        {hasPref && (
          <>
            <path
              d={makeBellPath(prefPeakH, prefSigmaV, prefRowTop)}
              fill="rgba(107,122,90,0.2)" stroke="rgba(107,122,90,0.45)" strokeWidth={1.5}
            />
            <text x={6} y={prefRowTop + 13} fontSize={8.5} fill="#8A9A7A" fontFamily="DM Mono, monospace">
              {prefLabel.toUpperCase()}
            </text>
            {/* Drop line to pref curve */}
            {(() => {
              const cy = getCurveY(prefHBF, prefPeakH, prefSigmaV, prefRowTop);
              return (
                <>
                  <line x1={prefX} y1={cy} x2={prefX} y2={axisTop}
                    stroke="rgba(107,122,90,0.35)" strokeWidth={1} strokeDasharray="3 3" />
                  <circle cx={prefX} cy={cy} r={4} fill="var(--sage)" stroke="white" strokeWidth={1.5} />
                </>
              );
            })()}
          </>
        )}

        {/* Dough bell curve */}
        <path
          d={makeBellPath(doughPeakH, doughSigma, doughRowTop)}
          fill="rgba(196,82,42,0.12)" stroke="rgba(196,82,42,0.35)" strokeWidth={1.5}
        />
        <text x={6} y={doughRowTop + 13} fontSize={8.5} fill="#C4845A" fontFamily="DM Mono, monospace">
          DOUGH
        </text>
        {/* Drop line to dough curve */}
        {(() => {
          const cy = getCurveY(mixOffsetH, doughPeakH, doughSigma, doughRowTop);
          return (
            <>
              <line x1={mixX} y1={cy} x2={mixX} y2={axisTop}
                stroke="rgba(196,82,42,0.3)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={mixX} cy={cy} r={4} fill="var(--terra)" stroke="white" strokeWidth={1.5} />
            </>
          );
        })()}

        {/* Axis */}
        <rect x={0} y={axisTop} width={w} height={AXIS_H} fill="#FDFBF7" />
        <line x1={0} y1={axisTop} x2={w} y2={axisTop} stroke="var(--border)" strokeWidth={1} />

        {/* Ticks */}
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={tk.x} y1={axisTop} x2={tk.x} y2={axisTop + 5} stroke="var(--border)" strokeWidth={1} />
            <text x={tk.x} y={axisTop + 15} fontSize={8} fill="var(--smoke)"
              fontFamily="DM Sans, sans-serif" textAnchor="middle">
              {tk.label}
            </text>
          </g>
        ))}

        {/* Bake anchor (right edge, terra, not draggable) */}
        {(() => {
          const bx = w - 1;
          return (
            <>
              <line x1={bx} y1={0} x2={bx} y2={axisTop} stroke="rgba(196,82,42,0.2)" strokeWidth={1} />
              <polygon
                points={`${bx - 8},${axisTop + 6} ${bx},${axisTop + 22} ${bx + 8},${axisTop + 6}`}
                fill="var(--terra)"
              />
              <text x={bx - 2} y={axisTop + AXIS_H - 3} fontSize={8} fill="var(--terra)"
                fontFamily="DM Mono, monospace" textAnchor="end">BAKE</text>
            </>
          );
        })()}

        {/* Pref diamond (gold, draggable) */}
        {hasPref && (
          <g
            style={{ cursor: dragging === 'pref' ? 'grabbing' : 'grab' }}
            onPointerDown={e => onPointerDown(e, 'pref')}
          >
            <polygon
              points={`${prefX},${axisTop + 6} ${prefX + 11},${axisTop + 18} ${prefX},${axisTop + 30} ${prefX - 11},${axisTop + 18}`}
              fill="var(--gold)" stroke="white" strokeWidth={1.5}
            />
            <text x={prefX} y={axisTop + AXIS_H - 2} fontSize={7.5} fill="var(--gold)"
              fontFamily="DM Mono, monospace" textAnchor="middle">
              {prefermentType === 'sourdough' ? 'FEED' : prefermentType.toUpperCase().slice(0, 5)}
            </text>
          </g>
        )}

        {/* Mix diamond (dark, draggable) */}
        <g
          style={{ cursor: dragging === 'mix' ? 'grabbing' : 'grab' }}
          onPointerDown={e => onPointerDown(e, 'mix')}
        >
          <polygon
            points={`${mixX},${axisTop + 6} ${mixX + 11},${axisTop + 18} ${mixX},${axisTop + 30} ${mixX - 11},${axisTop + 18}`}
            fill="var(--ash)" stroke="white" strokeWidth={1.5}
          />
          <text x={mixX} y={axisTop + AXIS_H - 2} fontSize={7.5} fill="var(--ash)"
            fontFamily="DM Mono, monospace" textAnchor="middle">MIX</text>
        </g>
      </svg>

      {/* Info cards */}
      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: '130px',
          background: 'var(--cream)', border: '1.5px solid var(--border)',
          borderRadius: '10px', padding: '.45rem .75rem',
        }}>
          <div style={{
            fontSize: '.63rem', color: 'var(--smoke)',
            fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase',
            letterSpacing: '.04em', marginBottom: '.18rem',
          }}>Mix</div>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {fmtDT(mixTime)}
          </div>
          <div style={{ fontSize: '.67rem', color: Q_COLOR[mixQual], marginTop: '.12rem' }}>
            {Q_ICON[mixQual]} {Q_LABEL[mixQual]}
          </div>
        </div>

        {hasPref && prefTime && (
          <div style={{
            flex: 1, minWidth: '130px',
            background: 'var(--cream)', border: '1.5px solid var(--border)',
            borderRadius: '10px', padding: '.45rem .75rem',
          }}>
            <div style={{
              fontSize: '.63rem', color: 'var(--smoke)',
              fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase',
              letterSpacing: '.04em', marginBottom: '.18rem',
            }}>{prefLabel}</div>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
              {fmtDT(prefTime)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
