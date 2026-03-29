'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { type AvailabilityBlock, type ScheduleResult, hoursLabel } from '../utils';
import FermentChart, { getPrefOptH } from './FermentChart';

interface SchedulePickerProps {
  startTime: Date;
  eatTime: Date | null;
  blocks: AvailabilityBlock[];
  preheatMin: number;
  styleKey: string;
  kitchenTemp: number;
  schedule?: ScheduleResult | null;
  onChange: (startTime: Date, eatTime: Date, blocks: AvailabilityBlock[]) => void;
  bakeType?: 'pizza' | 'bread';
  isSourdough?: boolean;
  onFeedTimeChange?: (t: Date) => void;
  prefermentType?: string;
  onPrefOffsetChange?: (h: number) => void;
  mode?: 'simple' | 'custom';   // default 'custom'
}

type Scenario = 'plenty' | 'tight' | 'too_short';

// ── Time formatter ────────────────────────────
// "4pm" / "4:30pm" — minutes omitted when zero
function formatTimeShort(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'am' : 'pm';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

// ── Day+time formatter ────────────────────────
// "Sat 25 Mar at 4pm" / "tonight at 9pm" / "tomorrow at 9am"
function formatDayShort(d: Date): string {
  const now = new Date();
  const todayStart    = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);
  const dStart = new Date(d); dStart.setHours(0, 0, 0, 0);

  const timeStr = formatTimeShort(d);
  if (dStart.getTime() === todayStart.getTime())    return `tonight at ${timeStr}`;
  if (dStart.getTime() === tomorrowStart.getTime()) return `tomorrow at ${timeStr}`;
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month   = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${d.getDate()} ${month} at ${timeStr}`;
}

// ── Bake time summary formatter ───────────────
// "Saturday 28 Mar · 7pm"
function formatBakeTimeSummary(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month   = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} ${d.getDate()} ${month} · ${formatTimeShort(d)}`;
}

// ── Slider display formatter ──────────────────
// "Thu 26 Mar · 6pm"
function formatSliderDisplay(d: Date): string {
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mo = d.toLocaleDateString('en-US', { month: 'short' });
  return `${wd} ${d.getDate()} ${mo} · ${formatTimeShort(d)}`;
}

// ── Hour-rounded formatters ───────────────────
function roundToNearestHour(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() >= 30) r.setHours(r.getHours() + 1);
  r.setMinutes(0, 0, 0);
  return pushToReasonableHour(r);
}

// ── Hour select label ─────────────────────────
// "12am", "1am", ..., "11am", "12pm", "1pm", ..., "11pm"
function hourLabel(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// ── Per-style optimal fermentation defaults ───
const STYLE_FERM_DEFAULTS: Record<string, { coldH: number; rtH: number; preferredColdH?: number }> = {
  // Pizza
  neapolitan:      { coldH: 24, rtH: 2,  preferredColdH: 48 },
  newyork:         { coldH: 48, rtH: 2,  preferredColdH: 72 },
  roman:           { coldH: 0,  rtH: 8  },
  pan:             { coldH: 0,  rtH: 6  },
  sourdough:       { coldH: 24, rtH: 4,  preferredColdH: 48 },
  // Bread
  pain_campagne:   { coldH: 12, rtH: 4  },
  pain_levain:     { coldH: 24, rtH: 4  },
  baguette:        { coldH: 24, rtH: 2  },
  pain_complet:    { coldH: 12, rtH: 3  },
  pain_seigle:     { coldH: 0,  rtH: 4  },
  fougasse:        { coldH: 0,  rtH: 3  },
  brioche:         { coldH: 0,  rtH: 4  },
  pain_mie:        { coldH: 0,  rtH: 3  },
  pain_viennois:   { coldH: 0,  rtH: 3  },
};
const FERM_FALLBACK: { coldH: number; rtH: number } = { coldH: 0, rtH: 8 };

// ── Reasonable hours constraint ───────────────
function pushToReasonableHour(d: Date): Date {
  const h = d.getHours();
  if (h >= 0 && h < 7) {
    const pushed = new Date(d);
    pushed.setHours(7, 0, 0, 0);
    return pushed;
  }
  return d;
}

// ── Starter peak hours ────────────────────────
function starterPeakHours(temp: number, mature: boolean): { min: number; max: number; mid: number } {
  let base: { min: number; max: number };
  if (temp >= 30)      base = { min: 3, max: 5 };
  else if (temp >= 27) base = { min: 4, max: 6 };
  else if (temp >= 24) base = { min: 5, max: 8 };
  else if (temp >= 21) base = { min: 7, max: 10 };
  else                 base = { min: 9, max: 14 };
  const adj = mature ? 0 : 1.5;
  return { min: base.min + adj, max: base.max + adj, mid: (base.min + base.max) / 2 + adj };
}

// ── Blocker overlap resolver ──────────────────
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
function computeSuggestion(
  eatTime: Date,
  preheatMin: number,
  styleKey: string,
  kitchenTemp: number,
) {
  const now = new Date();
  const preheatH = preheatMin / 60;
  const totalAvailableH = (eatTime.getTime() - now.getTime()) / 3600000;
  const minFeasibleH = 2 + preheatH;

  const defaults = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;

  let tropicalFactor = 1;
  if (kitchenTemp >= 33) tropicalFactor = 1.25;
  else if (kitchenTemp >= 30) tropicalFactor = 1.15;

  const rtH_adjusted  = defaults.rtH / tropicalFactor;
  const standardFermH = defaults.coldH + rtH_adjusted;
  const preferredColdH = defaults.preferredColdH ?? null;
  const preferredFermH = preferredColdH !== null ? preferredColdH + rtH_adjusted : null;

  let scenario: Scenario;
  if (totalAvailableH < minFeasibleH) {
    scenario = 'too_short';
  } else if (totalAvailableH < standardFermH + preheatH + 1) {
    scenario = 'tight';
  } else {
    scenario = 'plenty';
  }

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
  if (end <= start) return [];

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
  if (end <= start) return [];

  const nights: Array<{ key: string; label: string; blockStart: Date; blockEnd: Date }> = [];
  const cursor = new Date(start); cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14 && nights.length < 7; i++) {
    const nightStart = new Date(cursor); nightStart.setHours(22, 0, 0, 0);
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
  padding: '.65rem .85rem',
  border: '2px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--warm)',
  color: 'var(--char)',
  fontSize: '.85rem',
  fontFamily: 'var(--font-dm-mono)',
  outline: 'none',
  cursor: 'pointer',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '.72rem',
  color: 'var(--smoke)',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: '.35rem',
  fontFamily: 'var(--font-dm-mono)',
};

// ── Duration formatter ────────────────────────
function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
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
    const bFrom = (ms - b.to.getTime())   / 3600000;
    const bTo   = (ms - b.from.getTime()) / 3600000;
    if (hbf >= bFrom && hbf <= bTo) {
      const distFrom = Math.abs(bFrom - sweetCenter);
      const distTo   = Math.abs(bTo   - sweetCenter);
      return distFrom <= distTo ? bFrom : bTo;
    }
  }
  return hbf;
}

// ── Joint mix+pref optimiser ──────────────────
function findOptimalPosition(
  sweetCenter: number,
  sweetFrom: number,
  sweetTo: number,
  activeBlocks: AvailabilityBlock[],
  et: Date,
  hasPref: boolean,
  prefOffsetH: number,
): {
  mixHBF: number;
  prefHBF: number;
  mixInZone: boolean;
  prefInZone: boolean;
  fallback: boolean;
  mixInBlocker: boolean;
  prefInBlocker: boolean;
} {
  const ms = et.getTime();
  function isInBlocker(hbf: number): boolean {
    return activeBlocks.some(b => {
      const s = (ms - b.from.getTime()) / 3600000;
      const e = (ms - b.to.getTime())   / 3600000;
      return hbf >= Math.min(s, e) && hbf <= Math.max(s, e);
    });
  }
  function inSweet(hbf: number): boolean {
    return hbf >= sweetTo && hbf <= sweetFrom;
  }
  const STEP = 0.25;
  const SEARCH_RANGE = (sweetFrom - sweetTo) / 2 + 2;
  for (let delta = 0; delta <= SEARCH_RANGE; delta += STEP) {
    for (const sign of [0, 1, -1]) {
      const candidate = sweetCenter + (sign * delta);
      if (candidate < sweetTo - 2 || candidate > sweetFrom + 2) continue;
      const mixClear  = !isInBlocker(candidate);
      const prefClear = !hasPref || !isInBlocker(candidate + prefOffsetH);
      if (mixClear && prefClear) {
        return {
          mixHBF:        candidate,
          prefHBF:       candidate + prefOffsetH,
          mixInZone:     inSweet(candidate),
          prefInZone:    true,
          fallback:      !inSweet(candidate),
          mixInBlocker:  false,
          prefInBlocker: false,
        };
      }
    }
  }
  return {
    mixHBF:        sweetCenter,
    prefHBF:       sweetCenter + prefOffsetH,
    mixInZone:     false,
    prefInZone:    false,
    fallback:      true,
    mixInBlocker:  isInBlocker(sweetCenter),
    prefInBlocker: hasPref && isInBlocker(sweetCenter + prefOffsetH),
  };
}

// ── Simple colour bar (Simple mode only) ──────
const BAR_PAD = 14;
const BAR_SVG_H = 72;
const BAR_Y = 36;
const BAR_H = 18;
const BAR_AXIS_Y = 60;
const BAR_DS = 13;

function barHToX(hbf: number, W: number, barWin: number): number {
  return BAR_PAD + (1 - Math.max(0, Math.min(barWin, hbf)) / barWin) * (W - BAR_PAD * 2);
}
function barXToHBF(x: number, W: number, barWin: number): number {
  return Math.max(0.5, Math.min(barWin - 0.5, (1 - (x - BAR_PAD) / (W - BAR_PAD * 2)) * barWin));
}

function SimpleColourBar({
  eatTime, pendingStart, blocks, onStartChange, hasColdRetard,
}: {
  eatTime: Date;
  pendingStart: Date;
  blocks: AvailabilityBlock[];
  onStartChange: (d: Date) => void;
  hasColdRetard?: boolean;
}) {
  const barWin       = hasColdRetard ? 72 : 48;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const lastHBFRef   = useRef<number>(0);
  const [W, setW]    = useState(320);
  const [dragging, setDragging] = useState(false);
  const [localHBF, setLocalHBF] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bakeMs     = eatTime.getTime();
  const mixOffsetH = (bakeMs - pendingStart.getTime()) / 3600000;
  const effectiveMixHBF = localHBF !== null ? localHBF : mixOffsetH;
  const diamondX   = barHToX(Math.max(0.5, Math.min(barWin - 0.5, effectiveMixHBF)), W, barWin);
  const barCY      = BAR_Y + BAR_H / 2;

  const sweetL_HBF = hasColdRetard ? 52 : 26;
  const sweetR_HBF = hasColdRetard ? 20 : 14;
  const goldL_HBF  = hasColdRetard ? 62 : 36;
  const goldR2_HBF = hasColdRetard ? 10 : 8;

  const zones = [
    { from: barWin,     to: goldL_HBF,  fill: 'rgba(196,82,42,0.2)',   label: 'Too early' },
    { from: goldL_HBF,  to: sweetL_HBF, fill: 'rgba(212,168,83,0.35)', label: 'Still ok'  },
    { from: sweetL_HBF, to: sweetR_HBF, fill: 'rgba(107,122,90,0.5)',  label: 'Start here' },
    { from: sweetR_HBF, to: goldR2_HBF, fill: 'rgba(212,168,83,0.35)', label: 'Still ok'  },
    { from: goldR2_HBF, to: 0,          fill: 'rgba(196,82,42,0.2)',   label: 'Too late'  },
  ];

  const ticks: { x: number; label: string }[] = [];
  for (let h = 12; h < barWin; h += 12) {
    const t   = new Date(bakeMs - h * 3600000);
    const wd  = t.toLocaleDateString('en-US', { weekday: 'short' });
    const hr  = t.getHours();
    const ap  = hr < 12 ? 'a' : 'p';
    const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    ticks.push({ x: barHToX(h, W, barWin), label: `${wd} ${h12}${ap}` });
  }

  const inZone   = mixOffsetH >= sweetR_HBF && mixOffsetH <= sweetL_HBF;
  const nearZone = mixOffsetH >= goldR2_HBF  && mixOffsetH <= goldL_HBF;
  const status   = inZone   ? '🟢 Start Dough ready at bake'
    : nearZone ? '🟡 Close — slight risk'
    : '🔴 Adjust timing';

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
    const hbf = Math.round(barXToHBF(getSvgX(e), W, barWin) * 4) / 4;
    lastHBFRef.current = hbf;
    setLocalHBF(hbf);
  }
  function onPointerUp() {
    if (dragging) {
      const sweetCenter = hasColdRetard ? 34 : 20;
      const snapped = snapToBlockerEdgeIfBlocked(lastHBFRef.current, blocks, eatTime, sweetCenter);
      onStartChange(new Date(bakeMs - snapped * 3600000));
    }
    setLocalHBF(null);
    setDragging(false);
  }

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

  const inBlocker = blocks.some(b => {
    const bFromHBF = (bakeMs - b.to.getTime())   / 3600000;
    const bToHBF   = (bakeMs - b.from.getTime()) / 3600000;
    return effectiveMixHBF >= bFromHBF && effectiveMixHBF <= bToHBF;
  });
  const dFill   = inBlocker ? '#aaaaaa' : '#1A1612';
  const dStroke = inBlocker ? '#999999' : 'white';

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
      <div style={{ fontSize: '13px', color: 'var(--smoke)', textAlign: 'center', marginBottom: '8px' }}>
        Drag the diamond to set your start dough time
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
          <clipPath id="simple-bar-clip">
            <rect x={BAR_PAD} y={BAR_Y} width={W - BAR_PAD * 2} height={BAR_H} rx={9} />
          </clipPath>
          {blocks.map((b, i) => {
            const hbfFrom = (bakeMs - b.from.getTime()) / 3600000;
            const hbfTo   = (bakeMs - b.to.getTime())   / 3600000;
            const bx1 = barHToX(hbfFrom, W, barWin);
            const bx2 = barHToX(hbfTo, W, barWin);
            return (
              <clipPath key={i} id={`sbc-${i}`}>
                <rect x={bx1} y={0} width={Math.max(0, bx2 - bx1)} height={BAR_SVG_H} />
              </clipPath>
            );
          })}
        </defs>

        <rect x={BAR_PAD} y={BAR_Y} width={W - BAR_PAD * 2} height={BAR_H} fill="#E8E0D5" rx={9} />

        <g clipPath="url(#simple-bar-clip)">
          {zones.map((z, i) => {
            const zx1 = barHToX(z.from, W, barWin);
            const zx2 = barHToX(z.to, W, barWin);
            return <rect key={i} x={zx1} y={BAR_Y} width={zx2 - zx1} height={BAR_H} fill={z.fill} />;
          })}
        </g>

        {zones.map((z, i) => {
          const zx1 = barHToX(z.from, W, barWin);
          const zx2 = barHToX(z.to, W, barWin);
          if (zx2 - zx1 < 28) return null;
          return (
            <text key={i} x={(zx1 + zx2) / 2} y={BAR_Y - 6}
              fontSize={9.5} fill="#1A1612" fillOpacity={0.45}
              textAnchor="middle" fontFamily="DM Mono, monospace">
              {z.label}
            </text>
          );
        })}

        <line x1={barHToX(0, W, barWin)} y1={0} x2={barHToX(0, W, barWin)} y2={BAR_AXIS_Y}
          stroke="#C4522A" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.25} />

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
              <rect x={bx1} y={0} width={bx2 - bx1} height={BAR_AXIS_Y} fill="rgba(196,82,42,0.09)" />
              <g clipPath={`url(#sbc-${i})`}>
                {Array.from({ length: n }, (_, j) => {
                  const ox = bx1 + j * 7 - BAR_AXIS_Y;
                  return (
                    <line key={j} x1={ox} y1={0} x2={ox + BAR_AXIS_Y} y2={BAR_AXIS_Y}
                      stroke="rgba(196,82,42,0.16)" strokeWidth={1} />
                  );
                })}
              </g>
              <line x1={bx1} y1={0} x2={bx2} y2={0}
                stroke="rgba(196,82,42,0.5)" strokeWidth={2.5} />
            </g>
          );
        })}

        <line x1={BAR_PAD} y1={BAR_Y + BAR_H + 1} x2={W - BAR_PAD} y2={BAR_Y + BAR_H + 1}
          stroke="rgba(0,0,0,0.08)" strokeWidth={0.8} />

        <line x1={BAR_PAD} y1={BAR_AXIS_Y} x2={W - BAR_PAD} y2={BAR_AXIS_Y}
          stroke="#E8E0D5" strokeWidth={1} />

        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={tk.x} y1={BAR_AXIS_Y} x2={tk.x} y2={BAR_AXIS_Y + 3}
              stroke="#E8E0D5" strokeWidth={1} />
            <text x={tk.x} y={BAR_AXIS_Y + 12} fontSize={9.5} fill="var(--smoke)"
              fontFamily="DM Mono, monospace" textAnchor="middle">
              {tk.label}
            </text>
          </g>
        ))}

        {(() => {
          const bx = barHToX(0, W, barWin);
          return (
            <>
              <polygon points={`${bx - 6},${BAR_AXIS_Y} ${bx},${BAR_AXIS_Y - 10} ${bx + 6},${BAR_AXIS_Y}`}
                fill="#C4522A" />
              <text x={bx - 2} y={BAR_AXIS_Y + 12} fontSize={9} fill="#C4522A"
                fontFamily="DM Mono, monospace" textAnchor="end">
                {fmtDT(eatTime)}
              </text>
            </>
          );
        })()}

        <g style={{ cursor: dragging ? 'grabbing' : 'grab' }} onPointerDown={onPointerDown}>
          <polygon
            points={`${diamondX},${barCY - BAR_DS} ${diamondX + BAR_DS},${barCY} ${diamondX},${barCY + BAR_DS} ${diamondX - BAR_DS},${barCY}`}
            fill={dFill} stroke={dStroke} strokeWidth={1.5}
          />
          {inBlocker && (
            <>
              <circle cx={diamondX + BAR_DS + 3} cy={barCY - BAR_DS} r={5} fill="rgba(196,82,42,0.9)" />
              <text x={diamondX + BAR_DS + 3} y={barCY - BAR_DS + 4}
                fontSize={7} fill="white" textAnchor="middle" fontFamily="DM Mono, monospace">!</text>
            </>
          )}
        </g>
      </svg>

      {/* Info cards */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '.6rem', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: '120px', background: 'var(--cream)',
          border: '1.5px solid var(--border)', borderRadius: '10px', padding: '.45rem .7rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
            <div style={{ width: 8, height: 8, background: '#1A1612', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Start Dough
            </div>
          </div>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {fmtDT(pendingStart)}
          </div>
          <div style={{ fontSize: '.65rem', marginTop: '.1rem', color: inZone ? '#4A7A3A' : nearZone ? '#C49A28' : '#C4522A' }}>
            {status}
          </div>
        </div>
        <div style={{
          flex: 1, minWidth: '100px', background: 'var(--cream)',
          border: '1.5px solid var(--border)', borderRadius: '10px', padding: '.45rem .7rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
            <div style={{ width: 8, height: 8, background: '#C4522A', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Bake
            </div>
          </div>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {fmtDT(eatTime)}
          </div>
          <div style={{ fontSize: '.65rem', marginTop: '.1rem', color: 'var(--smoke)' }}>Fixed</div>
        </div>
      </div>

      {inBlocker && (
        <div style={{ fontSize: '.72rem', color: '#7A5A10',
          background: '#FEF9F0', borderRadius: '8px',
          padding: '6px 10px', marginTop: '6px',
          border: '0.5px solid #F0D9A0', lineHeight: 1.4 }}>
          ⚠️ Your mix time overlaps a blocked window —
          we hope this is intentional! Feel free to adjust
          if needed.
        </div>
      )}

    </div>
  );
}

// ── Component ─────────────────────────────────
export default function SchedulePicker({ startTime, eatTime, blocks, preheatMin, styleKey, kitchenTemp, schedule, onChange, bakeType = 'pizza', isSourdough = false, onFeedTimeChange, prefermentType = 'none', onPrefOffsetChange, mode = 'custom' }: SchedulePickerProps) {
  const t = useTranslations('scheduler');
  const tCommon = useTranslations('common');
  const alreadySet = eatTime !== null && eatTime > new Date();

  const [pendingEatTime, setPendingEatTime] = useState<Date>(eatTime ?? new Date());
  const [pendingStart, setPendingStart] = useState(startTime);
  const [eatTimeSet, setEatTimeSet] = useState(alreadySet);
  const [startComputed, setStartComputed] = useState(alreadySet);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [constraintsOpen, setConstraintsOpen] = useState(false);

  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isNarrow, setIsNarrow] = useState(false);
  const [blockerNote, setBlockerNote] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState<string>(() => {
    if (alreadySet) {
      const d = eatTime!;
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    return '';
  });
  const [pickerHour, setPickerHour] = useState<number>(() => alreadySet ? eatTime!.getHours() : 20);
  const [dismissedConflict, setDismissedConflict] = useState(false);

  // Sourdough state
  const [feedTime, setFeedTime] = useState<Date | null>(null);
  const [mixOverride, setMixOverride] = useState(false);
  const [starterMature, setStarterMature] = useState(true);

  // Preferment offset state
  const [prefOffsetH, setPrefOffsetH] = useState<number>(() =>
    getPrefOptH(prefermentType, kitchenTemp)
  );

  const [recommendedHBF, setRecommendedHBF] = useState<number | null>(null);
  const [showFallbackPopup, setShowFallbackPopup] = useState(false);
  const [fallbackOptions, setFallbackOptions] = useState<{
    outsideZone: { mixHBF: number; qualityPct: number } | null;
    inBlocker:   { mixHBF: number; overlapMin: number } | null;
  } | null>(null);
  const hasManuallyDragged = useRef(false);

  function updateEatTime(dateStr: string, hour: number) {
    if (!dateStr) return;
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2], hour, 0, 0, 0);
    setPendingEatTime(d);
    setEatTimeSet(true);
  }

  function computeAndApplyRecommendation(
    currentBlocks: AvailabilityBlock[],
    et: Date,
  ) {
    const sweetCenter = hasColdRetard ? 34 : 20;
    const sweetFrom   = hasColdRetard ? 52 : 26;
    const sweetTo     = hasColdRetard ? 20 : 14;

    const result = findOptimalPosition(
      sweetCenter, sweetFrom, sweetTo,
      currentBlocks, et,
      hasPrefActive, prefOffsetH,
    );

    if (result.fallback) {
      const outsideHBF = result.mixHBF;
      const maxDist = sweetFrom - sweetCenter;
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
    } else {
      const newStart = new Date(et.getTime() - result.mixHBF * 3600000);
      setRecommendedHBF(result.mixHBF);
      setShowFallbackPopup(false);
      setPendingStart(newStart);
      onChange(newStart, et, currentBlocks);
      if (hasPrefActive) {
        setPrefOffsetH(result.prefHBF - result.mixHBF);
        onPrefOffsetChange?.(result.prefHBF - result.mixHBF);
      }
      if (isSourdough) {
        const peak = starterPeakHours(kitchenTemp, starterMature);
        const ft = pushToReasonableHour(new Date(newStart.getTime() - peak.mid * 3600000));
        setFeedTime(ft);
        onFeedTimeChange?.(ft);
      }
    }
  }

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const suggestion = useMemo(
    () => computeSuggestion(pendingEatTime, preheatMin, styleKey, kitchenTemp),
    [pendingEatTime, preheatMin, styleKey, kitchenTemp],
  );

  const hasPrefActive = prefermentType !== 'none' && prefermentType !== '' && !isSourdough;

  const mixOffsetH = Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000);
  const hasColdRetard = (schedule?.coldRetardHours ?? 0) > 0 || mixOffsetH > 22;
  const prefGoesInFridge = hasPrefActive && (
    prefermentType === 'biga' || (prefermentType === 'poolish' && kitchenTemp >= 26)
  );

  const phases = schedule ? {
    bulkFermH: schedule.bulkFermHours ?? 0,
    coldRetardH: schedule.coldRetardHours ?? 0,
    finalProofH: schedule.finalProofHours ?? 0,
    preheatH: (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000,
  } : undefined;

  const windowH = useMemo(() => {
    const mixOffH = Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000);
    const neededH = hasPrefActive
      ? mixOffH + prefOffsetH + 10
      : mixOffH + 10;
    return Math.min(144, Math.max(36, Math.ceil(neededH / 12) * 12));
  }, [pendingEatTime, pendingStart, prefOffsetH, hasPrefActive]);

  const windowStart = useMemo(() => {
    const fiveDaysBefore = new Date(pendingEatTime.getTime() - 5 * 24 * 3600000);
    const now = new Date();
    return fiveDaysBefore > now ? fiveDaysBefore : now;
  }, [pendingEatTime]);

  const nights   = useMemo(() => getNightsInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const workdays = useMemo(() => getWorkdaysInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const isWorkActive = blocks.some(b => b.label.startsWith('Work · '));

  function adjustStart(deltaH: number) {
    const d = new Date(pendingStart.getTime() + deltaH * 3600000);
    setPendingStart(d);
    onChange(d, pendingEatTime, blocks);
  }

  function applyAndUpdate(newBlocks: AvailabilityBlock[]) {
    const { resolvedStart, moved, resolvedDate } = applyBlockerOverlap(pendingStart, newBlocks);
    if (resolvedStart.getTime() !== pendingStart.getTime()) setPendingStart(resolvedStart);
    setBlockerNote(moved ? t('startMovedNote', { time: formatDayShort(resolvedDate) }) : null);
    onChange(resolvedStart, pendingEatTime, newBlocks);
    if (!hasManuallyDragged.current && startComputed) {
      computeAndApplyRecommendation(newBlocks, pendingEatTime);
    }
  }

  function toggleWork() {
    const newBlocks = isWorkActive
      ? blocks.filter(b => !b.label.startsWith('Work · '))
      : [...blocks, ...workdays.map(d => ({ from: d.blockStart, to: d.blockEnd, label: d.label }))];
    applyAndUpdate(newBlocks);
  }

  function isNightActive(label: string): boolean {
    return blocks.some(b => b.label === label);
  }

  function toggleNight(night: { key: string; label: string; blockStart: Date; blockEnd: Date }) {
    const newBlocks = isNightActive(night.label)
      ? blocks.filter(b => b.label !== night.label)
      : [...blocks, { from: night.blockStart, to: night.blockEnd, label: night.label }];
    applyAndUpdate(newBlocks);
  }

  function removeBlock(index: number) {
    applyAndUpdate(blocks.filter((_, i) => i !== index));
  }

  function addCustomBlock() {
    const from = new Date(customFrom);
    const to   = new Date(customTo);
    if (!customLabel.trim() || isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return;
    applyAndUpdate([...blocks, { from, to, label: customLabel.trim() }]);
    setCustomLabel(''); setCustomFrom(''); setCustomTo('');
    setShowCustom(false);
  }

  const customReady = customLabel.trim() && customFrom && customTo
    && new Date(customTo) > new Date(customFrom);

  const { scenario } = suggestion;
  const startInvalid = startComputed && pendingStart >= pendingEatTime;
  const bulkConflict = schedule?.bulkConflict ?? null;

  // Pref label helpers
  const prefAxisLabel = prefermentType === 'biga' ? 'Start Biga'
    : prefermentType === 'poolish' ? 'Make Poolish'
    : 'Start Levain';

  // Slider ranges
  const mixSliderMin = hasColdRetard ? 20 : 14;
  const mixSliderMax = hasColdRetard ? 52 : 26;
  const prefOptH = getPrefOptH(prefermentType, kitchenTemp);
  const prefSliderMin = Math.max(1, prefOptH - 6);
  const prefSliderMax = prefOptH + 8;

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── S1: Bake time ──────────────────────────── */}
      {!eatTimeSet ? (
        <div>
          <div style={{ marginBottom: '.9rem' }}>
            <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--char)', marginBottom: '.25rem' }}>
              {bakeType === 'bread' ? t('bakeTimeLabelBread') : t('bakeTimeLabelPizza')}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--smoke)', lineHeight: 1.5 }}>
              {t('bakeTimeSub')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
            <input
              type="date"
              value={pickerDate}
              onChange={e => {
                setPickerDate(e.target.value);
                if (e.target.value) updateEatTime(e.target.value, pickerHour);
              }}
              style={{ ...INPUT_STYLE, flex: 2, width: undefined }}
            />
            <select
              value={pickerHour}
              onChange={e => {
                const h = Number(e.target.value);
                setPickerHour(h);
                if (pickerDate) updateEatTime(pickerDate, h);
              }}
              style={{
                ...INPUT_STYLE, width: 'auto', flex: 1,
                appearance: 'none' as React.CSSProperties['appearance'],
              }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (!eatTimeSet) return;
              hasManuallyDragged.current = false;
              setDismissedConflict(false);
              setEatTimeSet(true);
              computeAndApplyRecommendation(blocks, pendingEatTime);
              setStartComputed(true);
            }}
            disabled={!eatTimeSet}
            style={{
              marginTop: '.25rem', width: '100%', padding: '1rem 1.5rem',
              border: 'none', borderRadius: '12px',
              background: eatTimeSet ? 'var(--terra)' : 'var(--border)',
              color: eatTimeSet ? '#fff' : 'var(--smoke)',
              fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700,
              cursor: eatTimeSet ? 'pointer' : 'default',
              boxShadow: eatTimeSet ? '0 3px 10px rgba(196,82,42,0.25)' : 'none',
              letterSpacing: '.01em',
            }}
          >
            {t('planMyBake')}
          </button>
        </div>
      ) : (
        /* Bake time summary — tappable to edit */
        <div
          onClick={() => { setEatTimeSet(false); setStartComputed(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '.65rem',
            padding: '.55rem .9rem',
            background: 'var(--cream)', border: '1.5px solid var(--border)',
            borderRadius: '10px', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '.7rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>
            {t('bakeTime')}
          </span>
          <span style={{ flex: 1, fontSize: '.88rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
            {formatBakeTimeSummary(pendingEatTime)}
          </span>
          <span style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textDecoration: 'underline', textUnderlineOffset: '2px', flexShrink: 0 }}>
            {tCommon('edit')}
          </span>
        </div>
      )}

      {/* ── S2: Time constraints (expandable) ─────── */}
      {eatTimeSet && (
        <div style={{
          border: '1.5px solid var(--border)', borderRadius: '12px',
          background: 'var(--warm)', overflow: 'hidden',
        }}>
          <button
            onClick={() => setConstraintsOpen(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '.75rem 1rem',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--char)' }}>
              {t('blockers.heading')}
            </span>
            <span style={{ fontSize: '.8rem', color: 'var(--smoke)' }}>
              {constraintsOpen ? '▾' : '▸'}
            </span>
          </button>

          {constraintsOpen && (
            <div style={{ padding: '0 1rem 1rem' }}>
              <div style={{ fontSize: '.74rem', color: 'var(--smoke)', marginBottom: '.9rem', lineHeight: 1.5 }}>
                {t('blockers.sub')}
              </div>

              {/* Work toggle */}
              {workdays.length > 0 && (
                <div style={{ marginBottom: '.75rem' }}>
                  <button
                    onClick={toggleWork}
                    style={{
                      padding: '.38rem .85rem', borderRadius: '20px',
                      border: `1.5px solid ${isWorkActive ? 'var(--terra)' : 'var(--border)'}`,
                      background: isWorkActive ? '#FEF4EF' : 'var(--warm)',
                      color: isWorkActive ? 'var(--terra)' : 'var(--smoke)',
                      fontSize: '.78rem', fontWeight: isWorkActive ? 500 : 400,
                      cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                      transition: 'all .15s',
                      display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('blockers.weekdays')}
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', opacity: .65 }}>
                      {t('blockers.weekdayHours')}
                    </span>
                    {isWorkActive && <span style={{ opacity: .7 }}>✓</span>}
                  </button>
                </div>
              )}

              {/* Night toggles */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.45rem', marginBottom: '.8rem' }}>
                {nights.length === 0 ? (
                  <div style={{ fontSize: '.76rem', color: 'var(--smoke)', fontStyle: 'italic', padding: '.2rem 0' }}>
                    {t('blockers.noOvernights')}
                  </div>
                ) : (
                  nights.map(night => {
                    const active = isNightActive(night.label);
                    return (
                      <button
                        key={night.key}
                        onClick={() => toggleNight(night)}
                        style={{
                          padding: '.38rem .85rem', borderRadius: '20px',
                          border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                          background: active ? '#FEF4EF' : 'var(--warm)',
                          color: active ? 'var(--terra)' : 'var(--smoke)',
                          fontSize: '.78rem', fontWeight: active ? 500 : 400,
                          cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                          transition: 'all .15s',
                          display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        🌙 {night.label}
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', opacity: .65 }}>
                          {t('blockers.nightHours')}
                        </span>
                        {active && <span style={{ opacity: .7 }}>✓</span>}
                      </button>
                    );
                  })
                )}
                <button
                  onClick={() => setShowCustom(v => !v)}
                  style={{
                    padding: '.38rem .85rem', borderRadius: '20px',
                    border: `1.5px solid ${showCustom ? 'var(--terra)' : 'var(--border)'}`,
                    background: showCustom ? '#FEF4EF' : 'var(--warm)',
                    color: showCustom ? 'var(--terra)' : 'var(--smoke)',
                    fontSize: '.78rem', cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)', transition: 'all .15s',
                  }}
                >
                  {showCustom ? t('blockers.cancel') : t('blockers.addCustom')}
                </button>
              </div>

              {/* Custom block form */}
              {showCustom && (
                <div style={{
                  border: '1.5px solid var(--border)', borderRadius: '12px',
                  padding: '1rem 1.1rem', background: 'var(--cream)',
                  marginBottom: '.8rem',
                }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.75rem' }}>
                    {t('blockers.customTitle')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <input
                      type="text"
                      placeholder={t('blockers.customLabelPlaceholder')}
                      value={customLabel}
                      onChange={e => setCustomLabel(e.target.value)}
                      style={{
                        padding: '.55rem .75rem',
                        border: '1.5px solid var(--border)', borderRadius: '8px',
                        background: 'var(--warm)', color: 'var(--char)',
                        fontSize: '.82rem', fontFamily: 'var(--font-dm-sans)', outline: 'none',
                      }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                      <div>
                        <div style={{ fontSize: '.67rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.25rem' }}>
                          {t('blockers.from')}
                        </div>
                        <input
                          type="datetime-local"
                          value={customFrom}
                          onChange={e => setCustomFrom(e.target.value)}
                          style={{
                            width: '100%', padding: '.55rem .75rem',
                            border: '1.5px solid var(--border)', borderRadius: '8px',
                            background: 'var(--warm)', color: 'var(--char)',
                            fontSize: '.78rem', fontFamily: 'var(--font-dm-mono)', outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: '.67rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.25rem' }}>
                          {t('blockers.to')}
                        </div>
                        <input
                          type="datetime-local"
                          value={customTo}
                          onChange={e => setCustomTo(e.target.value)}
                          style={{
                            width: '100%', padding: '.55rem .75rem',
                            border: '1.5px solid var(--border)', borderRadius: '8px',
                            background: 'var(--warm)', color: 'var(--char)',
                            fontSize: '.78rem', fontFamily: 'var(--font-dm-mono)', outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={addCustomBlock}
                      disabled={!customReady}
                      style={{
                        alignSelf: 'flex-start', padding: '.55rem 1.1rem',
                        border: 'none', borderRadius: '12px',
                        background: customReady ? 'var(--terra)' : 'var(--border)',
                        color: customReady ? '#fff' : 'var(--smoke)',
                        fontSize: '.82rem', fontWeight: 500,
                        cursor: customReady ? 'pointer' : 'default',
                        transition: 'all .15s',
                      }}
                    >
                      {t('blockers.addBlock')}
                    </button>
                  </div>
                </div>
              )}

              {/* Active custom block chips */}
              {blocks.some(b => !nights.some(n => n.label === b.label) && !b.label.startsWith('Work · ')) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                  {blocks.filter(block => {
                    const isNightBlock = nights.some(n => n.label === block.label);
                    const isWorkBlock = block.label.startsWith('Work · ');
                    return !isNightBlock && !isWorkBlock;
                  }).map((block, i) => {
                    const realIndex = blocks.findIndex(b => b === block);
                    const durationH = (block.to.getTime() - block.from.getTime()) / 3600000;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '.6rem',
                          padding: '.5rem .85rem',
                          background: '#FEF4EF', border: '1.5px solid var(--terra)',
                          borderRadius: '10px',
                        }}
                      >
                        <span style={{ fontSize: '.95rem', flexShrink: 0 }}>🚫</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--terra)' }}>
                            {block.label}
                          </span>
                          <span style={{ opacity: .7, marginLeft: '.3rem', fontSize: '.8rem' }}>✓</span>
                          <span style={{
                            marginLeft: '.5rem', fontSize: '.72rem',
                            color: 'var(--terra)', opacity: .75, fontFamily: 'var(--font-dm-mono)',
                          }}>
                            {formatTimeShort(block.from)} → {formatTimeShort(block.to)}
                          </span>
                          <span style={{
                            marginLeft: '.35rem', fontSize: '.7rem',
                            color: 'var(--terra)', opacity: .5, fontFamily: 'var(--font-dm-mono)',
                          }}>
                            ({hoursLabel(durationH)})
                          </span>
                        </div>
                        <button
                          onClick={() => removeBlock(realIndex)}
                          title="Remove"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--smoke)', fontSize: '.8rem',
                            padding: '.15rem .3rem', borderRadius: '4px',
                            lineHeight: 1, flexShrink: 0,
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
          )}
        </div>
      )}

      {/* ── S3: Graph ─────────────────────────────── */}
      {eatTimeSet && (
        <div>
          <label style={LABEL_STYLE}>
            {hasPrefActive ? t('schedulerTitle.withPref') : t('schedulerTitle.noPref')}
          </label>
          {mode === 'simple' ? (
            <SimpleColourBar
              eatTime={pendingEatTime}
              pendingStart={pendingStart}
              blocks={blocks}
              hasColdRetard={hasColdRetard}
              onStartChange={(newStart) => {
                const { resolvedStart, moved, resolvedDate } = applyBlockerOverlap(newStart, blocks);
                setPendingStart(resolvedStart);
                setBlockerNote(moved ? t('startMovedNote', { time: formatDayShort(resolvedDate) }) : null);
                onChange(resolvedStart, pendingEatTime, blocks);
              }}
            />
          ) : (
            <FermentChart
              readOnly={true}
              showZoneLabels={adjustOpen}
              eatTime={pendingEatTime}
              prefermentType={isSourdough ? 'sourdough' : prefermentType}
              kitchenTemp={kitchenTemp}
              mixOffsetH={Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000)}
              prefOffsetH={
                isSourdough && feedTime
                  ? Math.max(1, (pendingStart.getTime() - feedTime.getTime()) / 3600000)
                  : prefOffsetH
              }
              windowH={windowH}
              prefInFridge={prefGoesInFridge}
              hasColdRetard={hasColdRetard}
              phases={phases}
              scheduleNote={schedule?.scheduleNote ?? null}
              blocks={blocks}
              recommendedMixHBF={null}
              onMixChange={() => {}}
              onPrefChange={() => {}}
            />
          )}

          {/* Sourdough reset-mix link */}
          {isSourdough && feedTime && mixOverride && (
            <div style={{ marginTop: '.4rem', textAlign: 'right' }}>
              <button
                onClick={() => {
                  setMixOverride(false);
                  const peak = starterPeakHours(kitchenTemp, starterMature);
                  const newMix = pushToReasonableHour(new Date(feedTime.getTime() + peak.mid * 3600000));
                  setPendingStart(newMix);
                  onChange(newMix, pendingEatTime, blocks);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--smoke)', fontSize: '.72rem',
                  fontFamily: 'var(--font-dm-mono)',
                  textDecoration: 'underline', textUnderlineOffset: '2px', padding: 0,
                }}
              >
                Reset mix to starter peak →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── S4: Adjust schedule (expandable, custom mode only) ── */}
      {eatTimeSet && mode === 'custom' && (
        <div style={{
          border: '1.5px solid var(--border)', borderRadius: '12px',
          background: 'var(--warm)', overflow: 'hidden',
        }}>
          <button
            onClick={() => setAdjustOpen(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '.75rem 1rem',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--char)' }}>
              Want to adjust your schedule?
            </span>
            <span style={{ fontSize: '.8rem', color: 'var(--smoke)' }}>
              {adjustOpen ? '▾' : '▸'}
            </span>
          </button>

          {adjustOpen && (
            <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '.9rem' }}>

              {/* Mix slider */}
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.35rem' }}>
                  Start Dough
                </div>
                {/* Diamond indicator row */}
                <div style={{ position: 'relative', height: '18px', marginBottom: '2px' }}>
                  <div style={{
                    position: 'absolute',
                    left: `calc(${Math.max(0, Math.min(100, ((Math.min(mixSliderMax, Math.max(mixSliderMin, mixOffsetH)) - mixSliderMin) / (mixSliderMax - mixSliderMin)) * 100))}% - 6px)`,
                    top: '3px',
                    width: 12, height: 12,
                    background: '#3D5A30',
                    transform: 'rotate(45deg)',
                    pointerEvents: 'none',
                  }} />
                </div>
                <input
                  type="range"
                  min={mixSliderMin}
                  max={mixSliderMax}
                  step={0.25}
                  value={Math.min(mixSliderMax, Math.max(mixSliderMin, mixOffsetH))}
                  onChange={e => {
                    const hbf = Number(e.target.value);
                    const newStart = new Date(pendingEatTime.getTime() - hbf * 3600000);
                    hasManuallyDragged.current = true;
                    setPendingStart(newStart);
                    onChange(newStart, pendingEatTime, blocks);
                  }}
                  style={{ width: '100%', accentColor: '#3D5A30', cursor: 'pointer', height: '4px' }}
                />
                <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.25rem' }}>
                  {formatSliderDisplay(pendingStart)}
                </div>
              </div>

              {/* Pref slider */}
              {hasPrefActive && (
                <div>
                  <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.35rem' }}>
                    {prefAxisLabel}
                  </div>
                  <div style={{ position: 'relative', height: '18px', marginBottom: '2px' }}>
                    <div style={{
                      position: 'absolute',
                      left: `calc(${Math.max(0, Math.min(100, ((Math.min(prefSliderMax, Math.max(prefSliderMin, prefOffsetH)) - prefSliderMin) / (prefSliderMax - prefSliderMin)) * 100))}% - 6px)`,
                      top: '3px',
                      width: 12, height: 12,
                      background: '#C4A030',
                      transform: 'rotate(45deg)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                  <input
                    type="range"
                    min={prefSliderMin}
                    max={prefSliderMax}
                    step={0.25}
                    value={Math.min(prefSliderMax, Math.max(prefSliderMin, prefOffsetH))}
                    onChange={e => {
                      const h = Number(e.target.value);
                      setPrefOffsetH(h);
                      onPrefOffsetChange?.(h);
                    }}
                    style={{ width: '100%', accentColor: '#C4A030', cursor: 'pointer', height: '4px' }}
                  />
                  <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.25rem' }}>
                    {formatHours(prefOffsetH)} before Start Dough
                  </div>
                </div>
              )}

              {/* Reset to suggested */}
              <button
                onClick={() => {
                  hasManuallyDragged.current = false;
                  computeAndApplyRecommendation(blocks, pendingEatTime);
                }}
                style={{
                  alignSelf: 'flex-start', padding: '.45rem 1rem',
                  borderRadius: '8px', border: '1.5px solid var(--border)',
                  background: 'transparent', color: 'var(--smoke)',
                  fontSize: '.78rem', cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                Reset to suggested
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── S5: Times summary ─────────────────────── */}
      {eatTimeSet && startComputed && (
        <div style={{
          background: '#F5F0E8', borderRadius: '12px',
          padding: '.85rem 1rem',
          display: 'flex', flexDirection: 'column', gap: '.55rem',
        }}>
          {hasPrefActive && !isSourdough && (() => {
            const prefTime = new Date(pendingEatTime.getTime() - (mixOffsetH + prefOffsetH) * 3600000);
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.5rem' }}>
                <span style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                  {prefAxisLabel}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', textAlign: 'right' }}>
                  {formatSliderDisplay(prefTime)}
                </span>
              </div>
            );
          })()}
          {isSourdough && feedTime && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.5rem' }}>
              <span style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                Feed Starter
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', textAlign: 'right' }}>
                {formatSliderDisplay(feedTime)}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.5rem' }}>
            <span style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
              Start Dough
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', textAlign: 'right' }}>
              {formatSliderDisplay(pendingStart)}
            </span>
          </div>
        </div>
      )}

      {/* ── S6: Generate CTA ──────────────────────── */}
      {eatTimeSet && (
        <button
          onClick={() => {
            computeAndApplyRecommendation(blocks, pendingEatTime);
            setStartComputed(true);
            setDismissedConflict(false);
          }}
          style={{
            width: '100%', padding: '1rem 1.5rem',
            border: 'none', borderRadius: '12px',
            background: 'var(--terra)', color: '#fff',
            fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(196,82,42,0.25)',
            letterSpacing: '.01em',
          }}
        >
          Generate my bake plan →
        </button>
      )}

      {/* ── Fallback popup ────────────────────────── */}
      {showFallbackPopup && fallbackOptions && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(26,22,18,0.45)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: 'var(--warm)', borderRadius: '18px',
            padding: '1.5rem', maxWidth: '340px', width: '100%',
            boxShadow: '0 8px 32px rgba(26,22,18,0.18)',
          }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--char)', marginBottom: '.5rem' }}>
              No perfect window found
            </div>
            <div style={{ fontSize: '13px', color: 'var(--smoke)', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              Your blocked times overlap the ideal mixing window. Choose the best option for you:
            </div>
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
                  width: '100%', padding: '12px 14px',
                  borderRadius: '12px', border: '1.5px solid var(--border)',
                  background: 'white', textAlign: 'left',
                  cursor: 'pointer', marginBottom: '8px',
                }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--char)' }}>
                  Start slightly outside sweet spot
                </div>
                <div style={{ fontSize: '11px', color: 'var(--smoke)', marginTop: '2px' }}>
                  ~{fallbackOptions.outsideZone.qualityPct}% optimal — dough still very good
                </div>
              </button>
            )}
            {fallbackOptions.inBlocker && (
              <button
                onClick={() => {
                  const { mixHBF } = fallbackOptions!.inBlocker!;
                  const newStart = new Date(pendingEatTime.getTime() - mixHBF * 3600000);
                  setPendingStart(newStart);
                  setRecommendedHBF(null);
                  onChange(newStart, pendingEatTime, blocks);
                  setShowFallbackPopup(false);
                }}
                style={{
                  width: '100%', padding: '12px 14px',
                  borderRadius: '12px', border: '1.5px solid var(--border)',
                  background: 'white', textAlign: 'left',
                  cursor: 'pointer', marginBottom: '12px',
                }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--char)' }}>
                  Start during a blocked window
                </div>
                <div style={{ fontSize: '11px', color: 'var(--smoke)', marginTop: '2px' }}>
                  Overlaps by ~{fallbackOptions.inBlocker.overlapMin} min — make sure this works for you
                </div>
              </button>
            )}
            <button
              onClick={() => {
                setShowFallbackPopup(false);
                hasManuallyDragged.current = true;
              }}
              style={{
                width: '100%', padding: '10px',
                borderRadius: '12px', border: 'none',
                background: 'transparent', color: 'var(--smoke)',
                fontSize: '13px', cursor: 'pointer',
              }}>
              Adjust manually
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk conflict banner ───────────────────── */}
      {bulkConflict && !dismissedConflict && (() => {
        const MIN_REASONABLE_HOUR = 7;
        const earlierStart = bulkConflict.suggestedEarlierStart;
        const earlierIsReasonable = earlierStart
          ? earlierStart.getHours() >= MIN_REASONABLE_HOUR
          : false;
        return (
          <div style={{
            background: '#FFF8E8', border: '1.5px solid #E8D080',
            borderRadius: '10px', padding: '.75rem 1rem',
            color: '#7A5A10',
          }}>
            <div style={{ marginBottom: '.5rem' }}>
              {earlierIsReasonable && earlierStart ? (
                <>
                  <div style={{ fontSize: '.82rem', fontWeight: 600, lineHeight: 1.55 }}>
                    ⏰ Your unavailability window overlaps with bulk fermentation.
                  </div>
                  <div style={{ fontSize: '.74rem', opacity: .8, marginTop: '.2rem', lineHeight: 1.55 }}>
                    Starting at {formatSliderDisplay(earlierStart)} clears the window before it starts.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '.82rem', fontWeight: 600, lineHeight: 1.55 }}>
                    ⏰ Your unavailability window overlaps with bulk fermentation.
                  </div>
                  <div style={{ fontSize: '.74rem', opacity: .8, marginTop: '.2rem', lineHeight: 1.55 }}>
                    A shorter bulk still makes great dough — the difference is minimal.
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {earlierIsReasonable && earlierStart && (
                <button
                  onClick={() => {
                    adjustStart(-(bulkConflict.suggestEarlierByMin / 60));
                    setDismissedConflict(true);
                  }}
                  style={{
                    padding: '.4rem .9rem', border: 'none', borderRadius: '8px',
                    background: 'var(--terra)', color: '#fff',
                    fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  Start at {formatTimeShort(earlierStart)}
                </button>
              )}
              <button
                onClick={() => setDismissedConflict(true)}
                style={{
                  padding: '.4rem .9rem', borderRadius: '8px',
                  border: '1.5px solid #E8D080', background: 'transparent',
                  color: '#7A5A10', fontSize: '.78rem', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                }}
              >
                {t('conflict.continueAnyway')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Validation messages ───────────────────── */}
      {startInvalid && (
        <div style={{
          fontSize: '.78rem', color: 'var(--terra)',
          background: '#FEF4EF', border: '1px solid #F5C4B0',
          borderRadius: '8px', padding: '.5rem .85rem',
        }}>
          {t('startBeforeBake')}
        </div>
      )}

      {blockerNote && (
        <div style={{
          fontSize: '.74rem', color: 'var(--smoke)',
          fontStyle: 'italic', lineHeight: 1.4,
        }}>
          {blockerNote}
        </div>
      )}

    </div>
  );
}
