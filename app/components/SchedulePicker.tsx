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
  onReady?: () => void;
}

type PickerPhase = 'bake_time' | 'start_confirm';
type Scenario = 'plenty' | 'tight' | 'too_short';

// ── Card date+time formatter ─────────────────
// "Fri 28 Mar · 9pm"
function fmtCardHM(d: Date): string {
  const h = d.getHours(), m = d.getMinutes();
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}
function fmtCardDT(d: Date): string {
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mo = d.toLocaleDateString('en-US', { month: 'short' });
  return `${wd} ${d.getDate()} ${mo} · ${fmtCardHM(d)}`;
}

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

// Rounds to nearest hour then formats — used for suggestion messages
function formatDayHour(d: Date): string {
  return formatDayShort(roundToNearestHour(d));
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
// coldH = hours in fridge at 4°C, rtH = room-temperature hours
// preferredColdH = longer cold option for styles that benefit from extra time
// Source: Craig's model, Definition B (70-80% max rise, home-baker forgiving)
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
// Never suggest a start between 00:00 and 07:00 — push to 07:00 that morning.
function pushToReasonableHour(d: Date): Date {
  const h = d.getHours();
  if (h >= 0 && h < 7) {
    const pushed = new Date(d);
    pushed.setHours(7, 0, 0, 0);
    return pushed;
  }
  if (h >= 23) {
    // Push to 7am next day
    const pushed = new Date(d);
    pushed.setDate(pushed.getDate() + 1);
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
// If start falls inside any active block, push it forward to the end of that block.
// Repeats until no more overlaps (handles chained blocks).
// Returns the resolved start and an optional inline note for the UI.
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
// Default suggestion = NOW (rounded to nearest hour).
// Only suggest a later start when baker has more time than the preferred
// fermentation window — in that case, push start to eatTime − (targetFermH + preheatH)
// so the full fermentation window is used.
// Returns a ±2h range around the suggestion; never suggests midnight–7am.
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

  // Scenario: too_short → can't make it; tight → just enough for standard; plenty → extra time
  let scenario: Scenario;
  if (totalAvailableH < minFeasibleH) {
    scenario = 'too_short';
  } else if (totalAvailableH < standardFermH + preheatH + 1) {
    scenario = 'tight';
  } else {
    scenario = 'plenty';
  }

  // Suggested start:
  //   too_short / tight → NOW (start ASAP)
  //   plenty → push to eatTime − (targetFermH + preheatH) so window is fully used,
  //            but never earlier than NOW
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

  // ±4h range — early end respects reasonable-hour rule; late end is unconstrained
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

// ── Snap to the edge of the blocker nearest to sweet spot center ──
function snapToBlockerEdgeIfBlocked(
  hbf: number,
  activeBlocks: AvailabilityBlock[],
  et: Date,
  sweetCenter: number,
): number {
  const ms = et.getTime();
  for (const b of activeBlocks) {
    const bFrom = (ms - b.to.getTime())   / 3600000; // HBF closer to bake
    const bTo   = (ms - b.from.getTime()) / 3600000; // HBF further from bake
    if (hbf > bFrom && hbf < bTo) {
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
  kitchenTemp: number,
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
      return hbf > Math.min(s, e) && hbf < Math.max(s, e);
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
      // Check baker is free at end of bulk (when dough goes in fridge)
      const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
      const bulkEndHBF = candidate - typicalBulkH;
      const bulkClear = bulkEndHBF > 0 && !isInBlocker(bulkEndHBF);
      if (mixClear && prefClear && bulkClear) {
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
const BAR_SVG_H = 80;
const BAR_Y = 36;
const BAR_H = 18;
const BAR_AXIS_Y = 60;
const BAR_DS = 13; // diamond half-size

function barHToX(hbf: number, W: number, barWin: number): number {
  return BAR_PAD + (1 - Math.max(0, Math.min(barWin, hbf)) / barWin) * (W - BAR_PAD * 2);
}
function barXToHBF(x: number, W: number, barWin: number): number {
  return Math.max(0.5, Math.min(barWin - 0.5, (1 - (x - BAR_PAD) / (W - BAR_PAD * 2)) * barWin));
}

function SimpleColourBar({
  eatTime, pendingStart, blocks, onStartChange, hasColdRetard, kitchenTemp, sweetFrom, sweetTo,
}: {
  eatTime: Date;
  pendingStart: Date;
  blocks: AvailabilityBlock[];
  onStartChange: (d: Date) => void;
  hasColdRetard?: boolean;
  kitchenTemp: number;
  sweetFrom?: number;
  sweetTo?: number;
}) {
  const barWin       = hasColdRetard ? 72 : 48;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const lastHBFRef   = useRef<number>(0);
  const [W, setW]    = useState(320);
  const [dragging, setDragging] = useState(false);
  // Local drag HBF for free visual movement — no applyBlockerOverlap during drag
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
  // During drag: show diamond at raw drag position (no blocker snap/push)
  const effectiveMixHBF = localHBF !== null ? localHBF : mixOffsetH;
  const diamondX   = barHToX(Math.max(0.5, Math.min(barWin - 0.5, effectiveMixHBF)), W, barWin);
  const barCY      = BAR_Y + BAR_H / 2; // diamond center y

  // Zone boundaries — driven by style+timing aware sweet zone props
  const sweetL_HBF = sweetFrom ?? (hasColdRetard ? 52 : 26);
  const sweetR_HBF = sweetTo   ?? (hasColdRetard ? 20 : 14);
  const goldL_HBF  = sweetL_HBF + 10;
  const goldR2_HBF = Math.max(0.5, sweetR_HBF - 6);

  // Colour zones: [fromHBF (left), toHBF (right), fill, label]
  const zones = [
    { from: barWin,     to: goldL_HBF,  fill: 'rgba(196,82,42,0.2)',   label: 'Too early' },
    { from: goldL_HBF,  to: sweetL_HBF, fill: 'rgba(212,168,83,0.35)', label: 'Still ok'  },
    { from: sweetL_HBF, to: sweetR_HBF, fill: 'rgba(107,122,90,0.5)',  label: 'Start Dough' },
    { from: sweetR_HBF, to: goldR2_HBF, fill: 'rgba(212,168,83,0.35)', label: 'Still ok'  },
    { from: goldR2_HBF, to: 0,          fill: 'rgba(196,82,42,0.2)',   label: 'Too late'  },
  ];

  // Axis ticks every 12h
  const ticks: { x: number; label: string }[] = [];
  for (let h = 12; h < barWin; h += 12) {
    const t  = new Date(bakeMs - h * 3600000);
    const wd = t.toLocaleDateString('en-US', { weekday: 'short' });
    const hr = t.getHours();
    const timeLabel = hr === 0 ? 'midnight' : hr === 12 ? 'noon'
      : `${hr > 12 ? hr - 12 : hr}${hr < 12 ? 'am' : 'pm'}`;
    ticks.push({ x: barHToX(h, W, barWin), label: `${wd} ${timeLabel}` });
  }

  // Status — uses dynamic zone boundaries
  const inZone    = mixOffsetH >= sweetR_HBF && mixOffsetH <= sweetL_HBF;
  const tooEarly  = mixOffsetH > goldL_HBF;
  const tooLate   = mixOffsetH < goldR2_HBF;
  const nearEarly = !inZone && mixOffsetH > sweetL_HBF;
  const nearLate  = !inZone && mixOffsetH < sweetR_HBF && !tooLate;
  const status    = inZone
    ? '🟢 Dough ready at bake'
    : nearEarly ? '🟡 A little early — dough will be great'
    : nearLate  ? '🟡 A little late — dough will still work'
    : tooEarly  ? '🔴 Too early — risk of over-fermentation'
    : '🔴 Too late — risk of under-fermentation';

  // Pointer handling
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
    // Update local visual only — no applyBlockerOverlap during drag (free movement)
    setLocalHBF(hbf);
  }
  function onPointerUp() {
    if (dragging) {
      onStartChange(new Date(bakeMs - lastHBFRef.current * 3600000));
    }
    setLocalHBF(null);
    setDragging(false);
  }

  // Formatters
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

  // Use visual (drag) position for blocker colouring during drag
  const inBlocker = blocks.some(b => {
    const bFromHBF = (bakeMs - b.to.getTime())   / 3600000;
    const bToHBF   = (bakeMs - b.from.getTime()) / 3600000;
    return effectiveMixHBF > bFromHBF && effectiveMixHBF < bToHBF;
  });
  const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
  const bulkEndHBF = effectiveMixHBF - typicalBulkH;
  const bulkEndInBlocker = !inBlocker && bulkEndHBF > 0 && blocks.some(b => {
    const bFromHBF = (bakeMs - b.to.getTime())   / 3600000;
    const bToHBF   = (bakeMs - b.from.getTime()) / 3600000;
    return bulkEndHBF > bFromHBF && bulkEndHBF < bToHBF;
  });
  const dFill   = inBlocker ? '#aaaaaa' : bulkEndInBlocker ? '#C4A030' : '#1A1612';
  const dStroke = inBlocker ? '#999999' : bulkEndInBlocker ? '#7A6010' : 'white';

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'] }}
    >
      {/* Hint */}
      <div style={{ fontSize: '13px', color: 'var(--smoke)', textAlign: 'center', marginBottom: '8px' }}>
        Drag the diamond to set your mixing time
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
          {/* Clip to bar track shape */}
          <clipPath id="simple-bar-clip">
            <rect x={BAR_PAD} y={BAR_Y} width={W - BAR_PAD * 2} height={BAR_H} rx={9} />
          </clipPath>
          {/* Clip paths for blocker hatches */}
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

        {/* Background track */}
        <rect x={BAR_PAD} y={BAR_Y} width={W - BAR_PAD * 2} height={BAR_H} fill="#E8E0D5" rx={9} />

        {/* Colour zones (clipped to track) */}
        <g clipPath="url(#simple-bar-clip)">
          {zones.map((z, i) => {
            const zx1 = barHToX(z.from, W, barWin);
            const zx2 = barHToX(z.to, W, barWin);
            return <rect key={i} x={zx1} y={BAR_Y} width={zx2 - zx1} height={BAR_H} fill={z.fill} />;
          })}
        </g>

        {/* Zone labels above bar */}
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

        {/* Bake reference line */}
        <line x1={barHToX(0, W, barWin)} y1={0} x2={barHToX(0, W, barWin)} y2={BAR_AXIS_Y}
          stroke="#C4522A" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.25} />

        {/* Blocker columns */}
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

        {/* Baseline */}
        <line x1={BAR_PAD} y1={BAR_Y + BAR_H + 1} x2={W - BAR_PAD} y2={BAR_Y + BAR_H + 1}
          stroke="rgba(0,0,0,0.08)" strokeWidth={0.8} />

        {/* Axis line */}
        <line x1={BAR_PAD} y1={BAR_AXIS_Y} x2={W - BAR_PAD} y2={BAR_AXIS_Y}
          stroke="#E8E0D5" strokeWidth={1} />

        {/* Ticks */}
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

        {/* Bake marker */}
        {(() => {
          const bx = barHToX(0, W, barWin);
          return (
            <>
              <polygon points={`${bx - 6},${BAR_AXIS_Y} ${bx},${BAR_AXIS_Y - 10} ${bx + 6},${BAR_AXIS_Y}`}
                fill="#C4522A" />
              <text x={bx} y={BAR_AXIS_Y + 12} fontSize={9} fill="#C4522A"
                fontFamily="DM Mono, monospace" textAnchor="middle">
                Bake
              </text>
            </>
          );
        })()}

        {/* Diamond (draggable) */}
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
          <div style={{ fontSize: '.65rem', marginTop: '.1rem', color: inZone ? '#4A7A3A' : (nearEarly || nearLate) ? '#C49A28' : '#C4522A' }}>
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


    </div>
  );
}

// ── Component ─────────────────────────────────
export default function SchedulePicker({ startTime, eatTime, blocks, preheatMin, styleKey, kitchenTemp, schedule, onChange, bakeType = 'pizza', isSourdough = false, onFeedTimeChange, prefermentType = 'none', onPrefOffsetChange, mode = 'custom', onReady }: SchedulePickerProps) {
  const t = useTranslations('scheduler');
  const tCommon = useTranslations('common');
  const alreadySet = eatTime !== null && eatTime > new Date();
  // Skip phase 1 if a future bake time is already set (return-to-edit case)
  const [phase, setPhase] = useState<PickerPhase>(() => alreadySet ? 'start_confirm' : 'bake_time');
  const [pendingEatTime, setPendingEatTime] = useState<Date>(eatTime ?? new Date());
  const [pendingStart, setPendingStart] = useState(startTime);
  // eatTimeSet: false on first visit until baker picks a date
  const [eatTimeSet, setEatTimeSet] = useState(alreadySet);
  // startComputed: false until engine runs at least once; true on return-to-edit
  const [startComputed, setStartComputed] = useState(alreadySet);

  const [isDragging, setIsDragging] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isNarrow, setIsNarrow] = useState(false);
  const [blockerNote, setBlockerNote] = useState<string | null>(null);
  const [guardNote, setGuardNote] = useState<string | null>(null);
  const [recommendedColdH, setRecommendedColdH] = useState<number>(0);
  const [pickerDateTime, setPickerDateTime] = useState<string>(() => {
    if (alreadySet && eatTime) {
      const d = eatTime;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }
    return '';
  });
  // Split state for custom time picker UI
  const [pickerDate, setPickerDate] = useState<string>(() => {
    if (alreadySet && eatTime) {
      const d = eatTime;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return '';
  });
  const [pickerHour, setPickerHour] = useState<number>(() => alreadySet && eatTime ? eatTime.getHours() : 18);
  const [pickerMinute, setPickerMinute] = useState<number>(() => {
    if (alreadySet && eatTime) {
      const m = eatTime.getMinutes();
      return [0,15,30,45].reduce((prev, cur) => Math.abs(cur-m) < Math.abs(prev-m) ? cur : prev, 0);
    }
    return 0;
  });
  const [dismissedConflict, setDismissedConflict] = useState(false);

  // Sourdough state
  const [feedTime, setFeedTime] = useState<Date | null>(null);
  const [mixOverride, setMixOverride] = useState(false);
  const [starterMature, setStarterMature] = useState(true);

  // Preferment offset state (non-sourdough)
  const [prefOffsetH, setPrefOffsetH] = useState<number>(() =>
    getPrefOptH(prefermentType, kitchenTemp)
  );

  // Recommendation ghost diamond + fallback popup
  const [recommendedHBF, setRecommendedHBF] = useState<number | null>(null);
  const [showFallbackPopup, setShowFallbackPopup] = useState(false);
  const [fallbackOptions, setFallbackOptions] = useState<{
    outsideZone: { mixHBF: number; qualityPct: number } | null;
    inBlocker:   { mixHBF: number; overlapMin: number } | null;
  } | null>(null);
  const hasManuallyDragged = useRef(false);
  const suppressStartReset = useRef(false);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const pickerDateTimeRef = useRef<string>(pickerDateTime);

  const prefLabel = prefermentType === 'poolish' ? 'Make Poolish'
    : prefermentType === 'biga' ? 'Make Biga'
    : (prefermentType === 'levain' || isSourdough) ? 'Feed Starter'
    : 'Make Preferment';

  function applyTimePick(date: string, hour: number, minute: number) {
    const hh = String(hour).padStart(2, '0');
    const mi = String(minute).padStart(2, '0');
    const dt = `${date}T${hh}:${mi}`;
    pickerDateTimeRef.current = dt;
    setPickerDateTime(dt);
    updateEatTime(dt);
    if (date) { confirmBakeTime(); }
  }

  function updateEatTime(dt: string) {
    if (!dt || dt.length < 16) return;
    const [datePart, timePart] = dt.split('T');
    const [yyyy, mm, dd] = datePart.split('-').map(Number);
    const [hh, mi] = timePart.split(':').map(Number);
    const d = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
    setPendingEatTime(d);
    setEatTimeSet(true);
  }

  function computeAndApplyRecommendation(
    currentBlocks: AvailabilityBlock[],
    et: Date,
  ) {
    const defaults = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;
    const isTrop = kitchenTemp >= 28;
    const minBulkRTLocal = isTrop ? 0.5 : 1.5;
    const minTotalRTLocal = minBulkRTLocal + 1.0 + (preheatMin / 60);
    const nowMs = Date.now();
    const totalWindowH = (et.getTime() - nowMs) / 3600000;
    const nowHBF = totalWindowH;

    // Guard: bake time in the past
    if (totalWindowH <= 0) {
      setGuardNote('This bake time is in the past — please pick a future date.');
      return;
    }

    // Guard: window too short for any fermentation
    if (totalWindowH < minTotalRTLocal) {
      setGuardNote(`Not enough time — you need at least ${Math.ceil(minTotalRTLocal)}h. Pick a later bake time.`);
      return;
    }

    // CT maximization — exact same model as buildSchedule
    const preferredColdH = defaults.preferredColdH ?? defaults.coldH;
    let expectedColdH: number;
    if (defaults.coldH === 0) {
      expectedColdH = 0;
    } else if (totalWindowH >= preferredColdH + minTotalRTLocal) {
      expectedColdH = preferredColdH;
    } else if (totalWindowH >= defaults.coldH + minTotalRTLocal) {
      expectedColdH = defaults.coldH;
    } else if (totalWindowH > minTotalRTLocal) {
      expectedColdH = totalWindowH - minTotalRTLocal;
    } else {
      expectedColdH = 0;
    }
    const hasColdLocal = expectedColdH > 0;
    setRecommendedColdH(expectedColdH);

    // Style-aware sweet zones from STYLE_FERM_DEFAULTS
    // sweetFrom = upper bound given available window
    // sweetTo   = minimum acceptable fermentation
    const sweetFromRaw = hasColdLocal
      ? expectedColdH + defaults.rtH
      : defaults.rtH + 4;
    const sweetToRaw = hasColdLocal
      ? Math.max(defaults.coldH * 0.7 + defaults.rtH, minTotalRTLocal + 1)
      : minTotalRTLocal + 1;
    const sweetCenterRaw = (sweetFromRaw + sweetToRaw) / 2;

    // Clamp so mix diamond never falls in the past
    const sweetFrom   = Math.min(sweetFromRaw,   nowHBF - 0.25);
    const sweetTo     = Math.min(sweetToRaw,     nowHBF - 0.5);
    const sweetCenter = Math.min(sweetCenterRaw, nowHBF - 0.5);

    // Short window note — RT-only tight windows only
    // Cold retard reduction already covered by scheduleNote from buildSchedule
    if (!hasColdLocal && totalWindowH < sweetToRaw) {
      setGuardNote('Tight schedule — start as early as possible. Same-day dough can still be great.');
    } else {
      setGuardNote(null);
    }

    // Poolish offset — clamp so it never starts in the past
    const rawPrefOffset = hasPrefActive ? getPrefOptH(prefermentType, kitchenTemp) : prefOffsetH;
    const maxPrefOffset = Math.max(0.25, nowHBF - sweetCenter - 0.25);
    const optimalPrefOffset = hasPrefActive
      ? Math.min(rawPrefOffset, maxPrefOffset)
      : prefOffsetH;
    if (hasPrefActive) {
      setPrefOffsetH(optimalPrefOffset);
      onPrefOffsetChange?.(optimalPrefOffset);
    }
    const result = findOptimalPosition(
      sweetCenter, sweetFrom, sweetTo,
      currentBlocks, et,
      hasPrefActive, optimalPrefOffset,
      kitchenTemp,
    );

    if (result.mixInBlocker) {
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
      setBlockerNote(null);
      setRecommendedHBF(result.mixHBF);
      setShowFallbackPopup(false);
      setPendingStart(newStart);
      onChange(newStart, et, currentBlocks);
      setDismissedConflict(true);
      if (hasPrefActive) {
        setPrefOffsetH(result.prefHBF - result.mixHBF);
        onPrefOffsetChange?.(result.prefHBF - result.mixHBF);
      }
    }
  }

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // On mount: if bake time already set (refresh / return-to-edit),
  // always run the recommendation engine before showing the graph
  useEffect(() => {
    if (!alreadySet) return;
    if (hasManuallyDragged.current) return;
    // Small delay so parent onChange resets scheduleReady first, then we set it back
    setTimeout(() => {
      computeAndApplyRecommendation(blocks, pendingEatTime);
      setStartComputed(true);
      onReady?.();
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eatTimeSet) return;
    setStartComputed(false);
    setShowFallbackPopup(false);
    setDismissedConflict(false);
    setGuardNote(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEatTime]);

  const suggestion = useMemo(
    () => computeSuggestion(pendingEatTime, preheatMin, styleKey, kitchenTemp),
    [pendingEatTime, preheatMin, styleKey, kitchenTemp],
  );

  // FIX 2: climate-aware pref fridge flag
  const hasPrefActive = prefermentType !== 'none' && prefermentType !== '' && !isSourdough;

  // Cold-aware fermentation curve
  const mixOffsetH = Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000);
  const hasColdRetard = (schedule?.coldRetardHours ?? 0) > 0;
  const _sfDef = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;
  const _minTotalRT = (kitchenTemp >= 28 ? 0.5 : 1.5) + 1.0 + (preheatMin / 60);
  const renderSweetFrom = recommendedColdH > 0
    ? recommendedColdH + _sfDef.rtH
    : _sfDef.rtH + 4;
  const renderSweetTo = recommendedColdH > 0
    ? Math.max(_sfDef.coldH * 0.7 + _sfDef.rtH, _minTotalRT + 1)
    : _minTotalRT + 1;
  const renderSweetCenter = (renderSweetFrom + renderSweetTo) / 2;
  const prefGoesInFridge = hasPrefActive && (
    prefermentType === 'biga' || (prefermentType === 'poolish' && kitchenTemp >= 26)
  );

  // Phase timeline strip data for FermentChart
  const phases = schedule ? {
    bulkFermH: schedule.bulkFermHours ?? 0,
    coldRetardH: schedule.coldRetardHours ?? 0,
    finalProofH: schedule.finalProofHours ?? 0,
    preheatH: (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000,
  } : undefined;

  // Dynamic chart window — fits mix+pref duration with breathing room
  const windowHRef = useRef(96);
  const windowH = useMemo(() => {
    if (isDragging) return windowHRef.current;
    const mixOffH = Math.max(1, (pendingEatTime.getTime() - pendingStart.getTime()) / 3600000);
    const neededH = hasPrefActive
      ? mixOffH + prefOffsetH + 10
      : mixOffH + 10;
    const computed = Math.min(144, Math.max(36, Math.ceil(neededH / 12) * 12));
    windowHRef.current = computed;
    return computed;
  }, [isDragging, pendingEatTime, pendingStart, prefOffsetH, hasPrefActive]);

  // Fixed window start — always covers 5 days before bake regardless of diamond position
  const windowStart = useMemo(() => {
    const fiveDaysBefore = new Date(pendingEatTime.getTime() - 5 * 24 * 3600000);
    const now = new Date();
    return fiveDaysBefore > now ? fiveDaysBefore : now;
  }, [pendingEatTime]);

  const nights   = useMemo(() => getNightsInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const workdays = useMemo(() => getWorkdaysInWindow(windowStart, pendingEatTime), [windowStart, pendingEatTime]);
  const isWorkActive = blocks.some(b => b.label.startsWith('Work · '));

  // ── Phase transitions ────────────────────────
  function confirmBakeTime() {
    const dt = pickerDateTimeRef.current;
    if (!dt || dt.length < 16) return;
    const [datePart, timePart] = dt.split('T');
    const [yyyy, mm, dd] = datePart.split('-').map(Number);
    const [hh, mi] = timePart.split(':').map(Number);
    const et = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
    suppressStartReset.current = true;
    setPendingEatTime(et);
    setEatTimeSet(true);
    hasManuallyDragged.current = false;
    setDismissedConflict(false);
    setShowFallbackPopup(false);
    setPhase('start_confirm');
    if (isSourdough) {
      const peak = starterPeakHours(kitchenTemp, starterMature);
      const ft = pushToReasonableHour(
        new Date(pendingStart.getTime() - peak.mid * 3600000)
      );
      setFeedTime(ft);
      onFeedTimeChange?.(ft);
    }
    setTimeout(() => {
      computeAndApplyRecommendation(blocks, et);
      setStartComputed(true);
      onReady?.();
      suppressStartReset.current = false;
    }, 0);
  }

  // ── Handlers ─────────────────────────────────

  function adjustStart(deltaH: number) {
    const d = new Date(pendingStart.getTime() + deltaH * 3600000);
    setPendingStart(d);
    onChange(d, pendingEatTime, blocks);
  }

  function applyAndUpdate(newBlocks: AvailabilityBlock[]) {
    const { resolvedStart, moved, resolvedDate: _resolvedDate } = applyBlockerOverlap(pendingStart, newBlocks);
    if (resolvedStart.getTime() !== pendingStart.getTime()) setPendingStart(resolvedStart);
    setBlockerNote(null);
    onChange(resolvedStart, pendingEatTime, newBlocks);
    if (!hasManuallyDragged.current && phase === 'start_confirm') {
      computeAndApplyRecommendation(newBlocks, pendingEatTime);
    }
  }

  function toggleWork() {
    const newBlocks = isWorkActive
      ? blocks.filter(b => !b.label.startsWith('Work · '))
      : [...blocks, ...workdays.map(d => ({ from: d.blockStart, to: d.blockEnd, label: d.label }))];
    applyAndUpdate(newBlocks);
  }

  function isAnyNightActive(): boolean {
    return nights.some(n => blocks.some(b => b.label === n.label));
  }

  function toggleAllNights() {
    const anyActive = isAnyNightActive();
    const nightLabels = new Set(nights.map(n => n.label));
    const withoutNights = blocks.filter(b => !nightLabels.has(b.label));
    const newBlocks = anyActive
      ? withoutNights
      : [...withoutNights, ...nights.map(n => ({ from: n.blockStart, to: n.blockEnd, label: n.label }))];
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

  // ── Shared sub-components ─────────────────────
  const continueBtnStyle: React.CSSProperties = {
    marginTop: '1.1rem', width: '100%', padding: '1rem 1.5rem',
    border: 'none', borderRadius: '12px',
    background: 'var(--terra)', color: '#fff',
    fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(196,82,42,0.25)',
    letterSpacing: '.01em',
  };

  // ── Unified render (bake time always visible) ─
  const { scenario } = suggestion;
  const startInvalid = startComputed && pendingStart >= pendingEatTime;
  const bulkConflict = schedule?.bulkConflict ?? null;

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans)' }}>

      {/* Bake time inputs — always visible */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--char)', marginBottom: '.3rem' }}>
          {bakeType === 'bread' ? t('bakeTimeLabelBread') : t('bakeTimeLabelPizza')}
        </div>
        <div style={{ fontSize: '.74rem', color: 'var(--smoke)', marginBottom: '.75rem', lineHeight: 1.5 }}>
          {t('bakeTimeSub')}
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', position: 'relative' }}>
          {/* Date — native picker styled as "Sat 4 Apr" */}
          <div style={{ flex: 2, position: 'relative' }}>
            <div style={{
              ...INPUT_STYLE, width: '100%',
              display: 'flex', alignItems: 'center',
              color: pickerDate ? 'var(--char)' : 'var(--smoke)',
              position: 'relative', zIndex: 1,
            }}>
              {pickerDate ? (() => {
                const [y, m, d] = pickerDate.split('-').map(Number);
                const dt = new Date(y, m - 1, d);
                const wd = dt.toLocaleDateString('en-US', { weekday: 'short' });
                const mo = dt.toLocaleDateString('en-US', { month: 'short' });
                return `${wd} ${d} ${mo}`;
              })() : 'Pick a date'}
            </div>
            <input
              type="date"
              value={pickerDate}
              onChange={e => {
                const d = e.target.value;
                setPickerDate(d);
                if (d && pickerHour !== null) applyTimePick(d, pickerHour, pickerMinute);
              }}
              style={{
                position: 'absolute', inset: 0, opacity: 0,
                cursor: 'pointer', width: '100%', height: '100%',
                zIndex: 2,
              }}
            />
          </div>
          {/* Time — select with 15-min steps */}
          <select
            value={`${pickerHour}:${String(pickerMinute).padStart(2,'0')}`}
            onChange={e => {
              const [h, m] = e.target.value.split(':').map(Number);
              setPickerHour(h);
              setPickerMinute(m);
              if (pickerDate) applyTimePick(pickerDate, h, m);
            }}
            disabled={!pickerDate}
            style={{ ...INPUT_STYLE, flex: 1, width: undefined, appearance: 'none' as React.CSSProperties['appearance'], opacity: pickerDate ? 1 : 0.45, cursor: pickerDate ? 'pointer' : 'not-allowed' }}
          >
            {!pickerDate && <option value="" disabled>Select date first</option>}
            {Array.from({ length: 96 }, (_, i) => {
              const h = Math.floor(i / 4);
              const m = (i % 4) * 15;
              const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
              const ap = h < 12 ? 'am' : 'pm';
              const label = `${h12}:${String(m).padStart(2,'0')} ${ap}`;
              return (
                <option key={i} value={`${h}:${String(m).padStart(2,'0')}`}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Phase 2 content — only once bake time is set */}
      {eatTimeSet && (<div>

      {/* too_short compact note */}
      {scenario === 'too_short' && (
        <div style={{ fontSize: '.78rem', color: 'var(--terra)', marginBottom: '.9rem', lineHeight: 1.5 }}>
          ⚡ {t('scenario.tooShort')}
        </div>
      )}

      {/* Sourdough starter section */}
      {isSourdough && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--char)', marginBottom: '.4rem' }}>
            🫙 When can you feed your starter?
          </div>
          <div style={{ fontSize: '.76rem', color: 'var(--smoke)', marginBottom: '.75rem', lineHeight: 1.5 }}>
            Set your feed time on the chart — mix updates automatically.
          </div>

          {/* Maturity toggle */}
          <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.9rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.72rem', color: 'var(--smoke)', alignSelf: 'center', fontFamily: 'var(--font-dm-mono)', marginRight: '.2rem' }}>
              My starter is:
            </span>
            {([
              { value: true,  label: '🔥 Active / mature' },
              { value: false, label: '🌱 Young (< 6 months)' },
            ] as { value: boolean; label: string }[]).map(opt => (
              <button key={String(opt.value)}
                onClick={() => {
                  setStarterMature(opt.value);
                  if (feedTime) {
                    const peak = starterPeakHours(kitchenTemp, opt.value);
                    const ft = pushToReasonableHour(new Date(pendingStart.getTime() - peak.mid * 3600000));
                    setFeedTime(ft);
                    onFeedTimeChange?.(ft);
                  }
                }}
                style={{
                  padding: '.3rem .75rem', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '.75rem', fontFamily: 'var(--font-dm-sans)',
                  border: `1.5px solid ${starterMature === opt.value ? 'var(--terra)' : 'var(--border)'}`,
                  background: starterMature === opt.value ? '#FEF4EF' : 'transparent',
                  color: starterMature === opt.value ? 'var(--terra)' : 'var(--smoke)',
                }}
              >{opt.label}</button>
            ))}
          </div>

          {/* Peak window note */}
          {(() => {
            const peak = starterPeakHours(kitchenTemp, starterMature);
            return (
              <div style={{ fontSize: '.74rem', color: 'var(--smoke)', fontStyle: 'italic', background: 'var(--cream)', borderRadius: '8px', padding: '.4rem .75rem', display: 'inline-block' }}>
                At {kitchenTemp}°C your starter peaks in {peak.min}–{peak.max}h{!starterMature ? ' — young starters take longer' : ''}
              </div>
            );
          })()}
        </div>
      )}

      </div>)}

      {eatTimeSet && (<div>

      {/* Blocker section — always visible */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.6rem' }}>
          Block your unavailable times — we&apos;ll plan around them.
        </div>
        <div>

      {/* Quick presets — all toggles on one row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.45rem', marginBottom: '.8rem', width: '100%', overflow: 'visible', paddingLeft: 0 }}>
        {workdays.length > 0 && (
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
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {t('blockers.weekdays')}
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', opacity: .65 }}>
              {t('blockers.weekdayHours')}
            </span>
            {isWorkActive && <span style={{ opacity: .7 }}>✓</span>}
          </button>
        )}
        {nights.length > 0 && (() => {
          const active = isAnyNightActive();
          return (
            <button
              onClick={toggleAllNights}
              style={{
                padding: '.38rem .85rem', borderRadius: '20px',
                border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                background: active ? '#FEF4EF' : 'var(--warm)',
                color: active ? 'var(--terra)' : 'var(--smoke)',
                fontSize: '.78rem', fontWeight: active ? 500 : 400,
                cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                transition: 'all .15s',
                display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              🌙 Nights
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', opacity: .65 }}>
                · 10pm → 7am
              </span>
              {active && <span style={{ opacity: .7 }}>✓</span>}
            </button>
          );
        })()}

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
          padding: '1rem 1.1rem', background: 'var(--warm)',
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
                background: 'var(--card)', color: 'var(--char)',
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
                  step={900}
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '.55rem .75rem',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--card)', color: 'var(--char)',
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
                  step={900}
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{
                    width: '100%', padding: '.55rem .75rem',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--card)', color: 'var(--char)',
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

      {/* Active block chips — custom blocks only */}
      {blocks.some(b => !nights.some(n => n.label === b.label) && !b.label.startsWith('Work · ')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginBottom: '.5rem' }}>
          {blocks.filter((block) => {
            const isNightBlock = nights.some(n => n.label === block.label);
            const isWorkBlock = block.label.startsWith('Work · ');
            return !isNightBlock && !isWorkBlock;
          }).map((block, i) => {
            const durationH = (block.to.getTime() - block.from.getTime()) / 3600000;
            const emoji = '🚫';
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
                <span style={{ fontSize: '.95rem', flexShrink: 0 }}>{emoji}</span>
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
                  onClick={() => removeBlock(i)}
                  title="Remove"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--smoke)', fontSize: '.8rem',
                    padding: '.15rem .3rem', borderRadius: '4px',
                    lineHeight: 1, flexShrink: 0, transition: 'color .15s',
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
      </div>

      {guardNote && (
        <div style={{
          background: 'var(--cream)', borderLeft: '4px solid var(--terra)',
          borderRadius: 10, padding: '.75rem 1rem', marginBottom: '1rem',
          fontSize: '.82rem', color: 'var(--char)', lineHeight: 1.5,
        }}>
          {guardNote}
        </div>
      )}

      {startComputed && (<>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '1.1rem 0 1rem' }} />

      {/* Fermentation chart */}
      <div style={{ marginBottom: startInvalid ? '.5rem' : '1rem' }}>
        <div style={{ fontSize: '.7rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.5rem' }}>
          {hasManuallyDragged.current ? 'Your fermentation plan' : 'Recommended fermentation plan'}
        </div>
        {startComputed ? (
          mode === 'simple' ? (
            <SimpleColourBar
              eatTime={pendingEatTime}
              pendingStart={pendingStart}
              blocks={blocks}
              hasColdRetard={hasColdRetard}
              kitchenTemp={kitchenTemp}
              sweetFrom={renderSweetFrom}
              sweetTo={renderSweetTo}
              onStartChange={(newStart) => {
                setPendingStart(newStart);
                const bakeMs = pendingEatTime.getTime();
                const h = (bakeMs - newStart.getTime()) / 3600000;
                const inB = blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return h > Math.min(s,e) && h < Math.max(s,e);
                });
                const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
                const bulkEndHBF = h - typicalBulkH;
                const bulkEndInB = !inB && bulkEndHBF > 0 && blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return bulkEndHBF > Math.min(s,e) && bulkEndHBF < Math.max(s,e);
                });
                const fmtBulkDur = (h: number) => h === 0.5 ? '30min' : h === 0.75 ? '45min' : '1h30';
                const fmtBulkTime = (hbf: number) => new Date(bakeMs - hbf * 3600000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                setBlockerNote(
                  inB ? "Start Dough falls in one of your busy windows — that's fine if it works for you."
                  : bulkEndInB ? `Your dough needs ~${fmtBulkDur(typicalBulkH)} to rise — be free by ${fmtBulkTime(bulkEndHBF)} to put it in the fridge, or start a bit earlier.`
                  : null
                );
                onChange(newStart, pendingEatTime, blocks);
              }}
            />
          ) : (
            <FermentChart
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
              recommendedMixHBF={recommendedHBF}
              showZoneLabels={adjustOpen}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => setIsDragging(false)}
              sweetCenterH={renderSweetCenter}
              nowHBF={(pendingEatTime.getTime() - Date.now()) / 3600000}
              onMixChange={(h) => {
                hasManuallyDragged.current = true;
                setRecommendedHBF(null);
                const newStart = new Date(pendingEatTime.getTime() - h * 3600000);
                if (isSourdough) setMixOverride(true);
                setPendingStart(newStart);
                const bakeMs = pendingEatTime.getTime();
                const inB = blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return h > Math.min(s,e) && h < Math.max(s,e);
                });
                const typicalBulkH = kitchenTemp >= 30 ? 0.5 : kitchenTemp >= 28 ? 0.75 : 1.5;
                const bulkEndHBF = h - typicalBulkH;
                const bulkEndInB = !inB && bulkEndHBF > 0 && blocks.some(b => {
                  const s = (bakeMs - b.from.getTime()) / 3600000;
                  const e = (bakeMs - b.to.getTime())   / 3600000;
                  return bulkEndHBF > Math.min(s,e) && bulkEndHBF < Math.max(s,e);
                });
                const fmtBulkDur = (h: number) => h === 0.5 ? '30min' : h === 0.75 ? '45min' : '1h30';
                const fmtBulkTime = (hbf: number) => new Date(bakeMs - hbf * 3600000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                setBlockerNote(
                  inB ? "Start Dough falls in one of your busy windows — that's fine if it works for you."
                  : bulkEndInB ? `Your dough needs ~${fmtBulkDur(typicalBulkH)} to rise — be free by ${fmtBulkTime(bulkEndHBF)} to put it in the fridge, or start a bit earlier.`
                  : null
                );
                onChange(newStart, pendingEatTime, blocks);
              }}
              onPrefChange={(offsetH) => {
                if (isSourdough) {
                  const newFeed = new Date(pendingStart.getTime() - offsetH * 3600000);
                  setFeedTime(newFeed);
                  onFeedTimeChange?.(newFeed);
                  // Starter diamond moves independently — Start Dough stays.
                  // Baker uses "Reset mix to starter peak" to relink.
                } else {
                  setPrefOffsetH(offsetH);
                  onPrefOffsetChange?.(offsetH);
                }
              }}
            />
          )
        ) : (
          <div style={{
            textAlign: 'center', fontFamily: 'var(--font-dm-mono)',
            fontSize: '.9rem', color: 'var(--smoke)',
            padding: '1.5rem 0', letterSpacing: '.01em',
          }}>
            {t('setByPlan')}
          </div>
        )}

        {/* Sourdough reset-mix link */}
        {isSourdough && feedTime && startComputed && (
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

      {/* Adjust schedule — custom mode only */}
      {mode !== 'simple' && <div style={{ marginTop: '.5rem', marginBottom: '.75rem' }}>
        <div
          onClick={() => setAdjustOpen(o => !o)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', padding: '.4rem 0',
            borderTop: '1px solid var(--border)',
            borderBottom: adjustOpen ? 'none' : '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '.8rem', fontWeight: 500, color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>
            Adjust
          </span>
          <span style={{ fontSize: '12px', color: '#8A7F78' }}>{adjustOpen ? '▾' : '›'}</span>
        </div>

        {adjustOpen && (
          <div style={{ paddingTop: '4px', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>
                <span style={{ color: '#3D5A30', fontWeight: 600 }}>◆ Dough:</span> drag the green diamond — green curve should peak at Bake
              </div>
              {hasPrefActive && (
                <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>
                  <span style={{ color: '#C4A030', fontWeight: 600 }}>◇ {prefLabel}:</span> drag the gold diamond — gold curve should peak at Start Dough
                </div>
              )}
            </div>
            <button
              onClick={() => {
                hasManuallyDragged.current = false;
                computeAndApplyRecommendation(blocks, pendingEatTime);
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--smoke)', fontSize: '.72rem',
                fontFamily: 'var(--font-dm-mono)',
                textDecoration: 'underline', textUnderlineOffset: '2px', padding: 0,
              }}
            >
              Reset to recommendation →
            </button>
          </div>
        )}
      </div>}

      {/* ── Message cards: State 1 (fallback), State 2 (blocker note), State 3 (bulk conflict) ── */}
      {showFallbackPopup && fallbackOptions && (
        <div style={{
          background: 'var(--cream)', borderLeft: '4px solid var(--terra)',
          borderRadius: '10px', padding: '.75rem 1rem',
          marginBottom: '.75rem', fontFamily: 'var(--font-dm-sans)',
        }}>
          <div style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.4rem' }}>
            No perfect time found
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--smoke)', marginBottom: '.75rem', lineHeight: 1.5 }}>
            Your schedule doesn&apos;t leave a free mixing window. What works best for you?
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
                  background: 'var(--terra)', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '.4rem .9rem', fontSize: '.78rem',
                  fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  marginBottom: '8px',
                }}
              >
                <div>Start just before or after my busy time</div>
                <div style={{ fontSize: '.74rem', marginTop: '2px', opacity: 0.8 }}>Dough will still be great.</div>
              </button>
            )}
            {fallbackOptions.inBlocker && (
              <button
                onClick={() => {
                  const bakeMs = pendingEatTime.getTime();
                  const scFrom = renderSweetFrom;
                  const scTo   = renderSweetTo;
                  const sc = (scFrom + scTo) / 2;
                  let bestHBF = sc;
                  let bestDist = Infinity;
                  for (const b of blocks) {
                    const edgeStart = (bakeMs - b.from.getTime()) / 3600000;
                    const edgeEnd   = (bakeMs - b.to.getTime())   / 3600000;
                    for (const edge of [edgeStart, edgeEnd]) {
                      const dist = Math.abs(edge - sc);
                      if (dist < bestDist) { bestDist = dist; bestHBF = edge; }
                    }
                  }
                  const newStart = new Date(bakeMs - bestHBF * 3600000);
                  setPendingStart(newStart);
                  setRecommendedHBF(null);
                  onChange(newStart, pendingEatTime, blocks);
                  setShowFallbackPopup(false);
                }}
                style={{
                  background: 'transparent', color: 'var(--smoke)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '.4rem .9rem', fontSize: '.78rem',
                  cursor: 'pointer', textAlign: 'left',
                  marginBottom: '12px',
                }}
              >
                <div>Mix during my busy time — I&apos;ll make it work</div>
                <div style={{ fontSize: '.74rem', marginTop: '2px', opacity: 0.8 }}>Still within the ideal window — dough will be great.</div>
              </button>
            )}
            <button
              onClick={() => {
                setShowFallbackPopup(false);
                hasManuallyDragged.current = true;
              }}
              style={{
                background: 'transparent', color: 'var(--smoke)',
                border: 'none', fontSize: '.78rem', cursor: 'pointer', padding: '.4rem 0',
              }}
            >
              I&apos;ll set it myself
            </button>
          </div>
        </div>
      )}

      {blockerNote && (
        <div style={{
          background: 'var(--cream)', borderLeft: '4px solid var(--terra)',
          borderRadius: '10px', padding: '.75rem 1rem',
          marginBottom: '.75rem', fontFamily: 'var(--font-dm-sans)',
        }}>
          <div style={{ fontSize: '.82rem', color: 'var(--char)', lineHeight: 1.5 }}>
            {blockerNote}
          </div>
        </div>
      )}

      {bulkConflict && !dismissedConflict && (() => {
        const MIN_REASONABLE_HOUR = 7;
        const earlierStart = bulkConflict.suggestedEarlierStart;
        const earlierIsReasonable = earlierStart
          ? earlierStart.getHours() >= MIN_REASONABLE_HOUR
          : false;
        return (
          <div style={{
            background: 'var(--cream)', borderLeft: '4px solid var(--terra)',
            borderRadius: '10px', padding: '.75rem 1rem',
            marginBottom: '.75rem', fontFamily: 'var(--font-dm-sans)',
          }}>
            {earlierIsReasonable && earlierStart ? (
              <>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.2rem' }}>
                  Your bulk fermentation begins during a busy window.
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--smoke)', lineHeight: 1.5, marginBottom: '.65rem' }}>
                  Start dough at {formatSliderDisplay(earlierStart)} so you can kick off bulk fermentation while you&apos;re free.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.2rem' }}>
                  Your bulk fermentation will run into your busy window.
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--smoke)', lineHeight: 1.5, marginBottom: '.65rem' }}>
                  Starting earlier isn&apos;t practical here — your dough will be worth the compromise.
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {earlierIsReasonable && earlierStart && (
                <button
                  onClick={() => {
                    adjustStart(-(bulkConflict.suggestEarlierByMin / 60));
                    setDismissedConflict(true);
                  }}
                  style={{
                    background: 'var(--terra)', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '.4rem .9rem',
                    fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  Start at {formatSliderDisplay(earlierStart)} →
                </button>
              )}
              <button
                onClick={() => setDismissedConflict(true)}
                style={{
                  background: 'transparent', color: 'var(--smoke)',
                  border: '1px solid var(--border)', borderRadius: '8px', padding: '.4rem .9rem',
                  fontSize: '.78rem', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                }}
              >
                {earlierIsReasonable && earlierStart ? 'Keep as is' : 'Got it, I\'ll make it work'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Info cards (pref + mix start times) — custom mode only ── */}
      {startComputed && mode !== 'simple' && (() => {
        const isLevainType = prefermentType === 'levain' || isSourdough;
        const cardPrefColor = isLevainType ? '#4A7FA5' : '#C4A030';
        const infoOptH = (hasPrefActive || isSourdough) ? getPrefOptH(isSourdough ? 'sourdough' : prefermentType, kitchenTemp) : 0;
        const cardPrefInZone = (hasPrefActive || isSourdough) && prefOffsetH >= infoOptH - 3 && prefOffsetH <= infoOptH + 3;
        const cardPrefStatus = cardPrefInZone ? '🟢 Ready when dough starts' : '🟡 Adjust timing';
        const cardPrefTime = hasPrefActive
          ? new Date(pendingEatTime.getTime() - (mixOffsetH + prefOffsetH) * 3600000)
          : isSourdough && feedTime ? feedTime : null;
        const doughZoneFrom = renderSweetFrom;
        const doughZoneTo   = renderSweetTo;
        const mixInZone   = mixOffsetH >= doughZoneTo && mixOffsetH <= doughZoneFrom;
        const mixTooEarly = mixOffsetH > doughZoneFrom;
        const mixStatus   = mixInZone
          ? '🟢 Dough ready at bake'
          : mixTooEarly
          ? '🟡 A little early — dough will be great'
          : '🟡 A little late — dough will still work';
        const bakeMs = pendingEatTime.getTime();
        const mixInBlocker = !mixInZone && mixOffsetH > 0 && blocks.some(b => {
          const s2 = (bakeMs - b.from.getTime()) / 3600000;
          const e2 = (bakeMs - b.to.getTime())   / 3600000;
          return mixOffsetH >= Math.min(s2, e2) && mixOffsetH <= Math.max(s2, e2);
        });
        return (
          <div style={{ display: 'flex', gap: '6px', marginTop: '1rem', flexWrap: 'wrap' }}>
            {/* Pref card */}
            {cardPrefTime && (
              <div style={{
                flex: 1, minWidth: '120px',
                background: 'var(--cream)', border: '1.5px solid var(--border)',
                borderRadius: '10px', padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
                  <div style={{ width: 8, height: 8, background: cardPrefColor, transform: 'rotate(45deg)', flexShrink: 0 }} />
                  <div style={{
                    fontSize: '13px', color: 'var(--smoke)',
                    fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em',
                  }}>{prefLabel}</div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                  {fmtCardDT(cardPrefTime)}
                </div>
                <div style={{ fontSize: '12px', marginTop: '.1rem', color: cardPrefInZone ? '#4A7A3A' : '#C49A28' }}>
                  {cardPrefStatus}
                </div>
                {prefGoesInFridge && (
                  <div style={{ fontSize: '12px', marginTop: '.2rem', color: '#3A5A8A', fontFamily: 'var(--font-dm-mono)' }}>
                    🧊 Cold ferment — use fridge
                  </div>
                )}
              </div>
            )}

            {/* Mix card */}
            <div style={{
              flex: 1, minWidth: '120px',
              background: 'var(--cream)', border: '1.5px solid var(--border)',
              borderRadius: '10px', padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '.2rem' }}>
                <div style={{ width: 8, height: 8, background: '#3D5A30', transform: 'rotate(45deg)', flexShrink: 0 }} />
                <div style={{
                  fontSize: '13px', color: 'var(--smoke)',
                  fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.04em',
                }}>Start Dough</div>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
                {fmtCardDT(pendingStart)}
              </div>
              <div style={{ fontSize: '12px', marginTop: '.1rem', color: mixInZone ? '#4A7A3A' : '#C4522A' }}>
                {mixStatus}
              </div>
              {mixInBlocker && (
                <div style={{ fontSize: '11px', color: '#7A5A10', marginTop: '4px', lineHeight: 1.4 }}>
                  ⚠️ Within a blocked window — intentional?
                </div>
              )}
            </div>
          </div>
        );
      })()}


      {schedule?.scheduleNote && (
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--smoke)', textAlign: 'center', marginTop: '8px' }}>
          {schedule.scheduleNote}
        </div>
      )}

      </>)}



      {startInvalid && (
        <div style={{
          fontSize: '.78rem', color: 'var(--terra)',
          background: '#FEF4EF', border: '1px solid #F5C4B0',
          borderRadius: '8px', padding: '.5rem .85rem',
          marginBottom: '.75rem', marginTop: '.5rem',
        }}>
          {t('startBeforeBake')}
        </div>
      )}

      </div>)} {/* end eatTimeSet */}

    </div>
  );
}
