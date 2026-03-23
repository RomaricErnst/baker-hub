'use client';
import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { type AvailabilityBlock, type ScheduleResult, hoursLabel } from '../utils';

interface SchedulePickerProps {
  startTime: Date;
  eatTime: Date | null;
  blocks: AvailabilityBlock[];
  preheatMin: number;
  styleKey: string;
  kitchenTemp: number;
  schedule?: ScheduleResult | null;
  onChange: (startTime: Date, eatTime: Date, blocks: AvailabilityBlock[]) => void;
  onConfirm?: () => void;
  bakeType?: 'pizza' | 'bread';
}

type PickerPhase = 'bake_time' | 'start_confirm';
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
  return d;
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

// ── Component ─────────────────────────────────
export default function SchedulePicker({ startTime, eatTime, blocks, preheatMin, styleKey, kitchenTemp, schedule, onChange, onConfirm, bakeType = 'pizza' }: SchedulePickerProps) {
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

  // Start picker state — synced with pendingStart after confirmBakeTime runs
  function toPickerDate(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  const [startPickerDate, setStartPickerDate] = useState<string>(() =>
    alreadySet ? toPickerDate(startTime) : ''
  );
  const [startPickerHour, setStartPickerHour] = useState<number>(() =>
    alreadySet ? startTime.getHours() : 8
  );

  function updateEatTime(dateStr: string, hour: number) {
    if (!dateStr) return;
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2], hour, 0, 0, 0);
    setPendingEatTime(d);
    setEatTimeSet(true);
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

  const nights   = useMemo(() => getNightsInWindow(pendingStart, pendingEatTime), [pendingStart, pendingEatTime]);
  const workdays = useMemo(() => getWorkdaysInWindow(pendingStart, pendingEatTime), [pendingStart, pendingEatTime]);
  const isWorkActive = blocks.some(b => b.label.startsWith('Work · '));

  // ── Phase transitions ────────────────────────
  function confirmBakeTime() {
    const s = suggestion.suggestedStart;
    setPendingStart(s);
    setStartPickerDate(toPickerDate(s));
    setStartPickerHour(s.getHours());
    onChange(s, pendingEatTime, blocks);
    setStartComputed(true);
    setDismissedConflict(false);
    setPhase('start_confirm');
  }

  function confirmStart() {
    onChange(pendingStart, pendingEatTime, blocks);
    onConfirm?.();
  }

  // ── Handlers ─────────────────────────────────

  function adjustStart(deltaH: number) {
    const d = new Date(pendingStart.getTime() + deltaH * 3600000);
    setPendingStart(d);
    setStartPickerDate(toPickerDate(d));
    setStartPickerHour(d.getHours());
    onChange(d, pendingEatTime, blocks);
  }

  function handleSlider(val: number, sliderMin: number, totalMs: number) {
    const ms = sliderMin + (val / 100) * totalMs;
    const d = pushToReasonableHour(new Date(ms));
    const { resolvedStart, moved, resolvedDate } = applyBlockerOverlap(d, blocks);
    setPendingStart(resolvedStart);
    setStartPickerDate(toPickerDate(resolvedStart));
    setStartPickerHour(resolvedStart.getHours());
    setBlockerNote(moved ? t('startMovedNote', { time: formatDayShort(resolvedDate) }) : null);
    onChange(resolvedStart, pendingEatTime, blocks);
  }

  function setStartFromPicker(dateStr: string, hour: number) {
    if (!dateStr) return;
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2], hour, 0, 0, 0);
    setPendingStart(d);
    onChange(d, pendingEatTime, blocks);
  }

  // Apply blocker overlap whenever blocks change
  function applyAndUpdate(newBlocks: AvailabilityBlock[]) {
    const { resolvedStart, moved, resolvedDate } = applyBlockerOverlap(pendingStart, newBlocks);
    if (resolvedStart.getTime() !== pendingStart.getTime()) setPendingStart(resolvedStart);
    setBlockerNote(moved ? t('startMovedNote', { time: formatDayShort(resolvedDate) }) : null);
    onChange(resolvedStart, pendingEatTime, newBlocks);
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

  // ── PHASE 1: Bake time ────────────────────────
  if (phase === 'bake_time') {
    return (
      <div style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <div style={{ marginBottom: '.9rem' }}>
          <div style={{
            fontWeight: 700, fontSize: '.95rem', color: 'var(--char)',
            marginBottom: '.25rem',
          }}>
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
          onClick={confirmBakeTime}
          disabled={!eatTimeSet}
          style={{
            ...continueBtnStyle,
            background: eatTimeSet ? 'var(--terra)' : 'var(--border)',
            color: eatTimeSet ? '#fff' : 'var(--smoke)',
            cursor: eatTimeSet ? 'pointer' : 'default',
          }}
        >
          {t('planMyBake')}
        </button>
      </div>
    );
  }

  // ── PHASE 2: Start suggestion + blockers + confirm (merged) ──
  const { scenario, suggestedStart, rangeEarly, rangeLatest, isPreferredMode } = suggestion;

  // Slider bounds — from now to bakeTime − preheat − 1h
  const sliderNow = new Date();
  const sliderMin = sliderNow.getTime();
  const sliderMax = pendingEatTime.getTime() - preheatMin * 60000 - 3600000;
  const totalMs   = Math.max(sliderMax - sliderMin, 1);
  const earlyPct   = Math.max(0, Math.min(100, ((rangeEarly.getTime()  - sliderMin) / totalMs) * 100));
  const latestPct  = Math.max(0, Math.min(100, ((rangeLatest.getTime() - sliderMin) / totalMs) * 100));
  const currentPct = Math.max(0, Math.min(100, ((pendingStart.getTime() - sliderMin) / totalMs) * 100));

  const scenarioBg    = scenario === 'too_short' ? '#FEF4EF' : scenario === 'tight' ? '#FFF8E8' : '#F2FAF0';
  const scenarioBdr   = scenario === 'too_short' ? '#F5C4B0' : scenario === 'tight' ? '#E8D080' : '#C8D4BA';
  const scenarioColor = scenario === 'too_short' ? 'var(--terra)' : scenario === 'tight' ? '#7A5A10' : '#3A6A30';
  const scenarioIcon  = scenario === 'too_short' ? '⚡' : scenario === 'tight' ? '⏰' : '✨';

  let scenarioMain: string;
  let scenarioSecondary: string | null = null;

  if (scenario === 'plenty') {
    if (isPreferredMode) {
      scenarioMain = t('scenario.plentyPreferred', { start: formatDayHour(rangeEarly), end: formatDayHour(rangeLatest) });
      scenarioSecondary = t('scenario.plentyPreferredSub');
    } else {
      scenarioMain = t('scenario.plenty', { start: formatDayHour(suggestedStart) });
      scenarioSecondary = t('scenario.plentySub', { start: formatDayHour(rangeEarly), end: formatDayHour(rangeLatest) });
    }
  } else if (scenario === 'tight') {
    scenarioMain = t('scenario.tight');
  } else {
    scenarioMain = t('scenario.tooShort');
  }

  const startInvalid = startComputed && pendingStart >= pendingEatTime;
  const bulkConflict = schedule?.bulkConflict ?? null;

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans)' }}>

      {/* Bake time summary — click Edit to go back to phase 1 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '.65rem',
        padding: '.5rem .85rem',
        background: 'var(--cream)', border: '1.5px solid var(--border)',
        borderRadius: '10px', marginBottom: '1rem',
      }}>
        <span style={{ fontSize: '.7rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>
          {t('bakeTime')}
        </span>
        <span style={{ flex: 1, fontSize: '.82rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)' }}>
          {formatDayShort(pendingEatTime)}
        </span>
        <button
          onClick={() => { setPhase('bake_time'); setStartComputed(false); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--smoke)', fontSize: '.72rem',
            fontFamily: 'var(--font-dm-mono)', padding: '.1rem .35rem',
            borderRadius: '5px', flexShrink: 0,
            textDecoration: 'underline', textUnderlineOffset: '2px',
          }}
        >
          {tCommon('edit')}
        </button>
      </div>

      {/* Scenario message */}
      <div style={{
        display: 'flex', gap: '.6rem', alignItems: 'flex-start',
        background: scenarioBg, border: `1.5px solid ${scenarioBdr}`,
        borderRadius: '10px', padding: '.7rem .9rem',
        marginBottom: '1.1rem', fontSize: '.82rem',
        color: scenarioColor, lineHeight: 1.55,
      }}>
        <span style={{ flexShrink: 0 }}>{scenarioIcon}</span>
        <div>
          <span>{scenarioMain}</span>
          {scenarioSecondary && (
            <span style={{ display: 'block', marginTop: '.3rem', fontSize: '.74rem', opacity: .7 }}>
              {scenarioSecondary}
            </span>
          )}
        </div>
      </div>

      {/* Start time slider */}
      <div style={{ marginBottom: startInvalid ? '.5rem' : '1rem' }}>
        <label style={LABEL_STYLE}>{t('startMixing')}</label>

        {/* Large time display */}
        <div style={{
          textAlign: 'center',
          fontFamily: 'var(--font-dm-mono)',
          fontSize: '1.35rem',
          fontWeight: 700,
          color: startInvalid ? 'var(--terra)' : 'var(--char)',
          marginBottom: '.9rem',
          letterSpacing: '-.01em',
        }}>
          {startComputed ? formatSliderDisplay(pendingStart) : t('setByPlan')}
        </div>

        {/* Slider track + zones */}
        <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
          {/* Zone background strip */}
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: 0, right: 0, height: '8px', borderRadius: '4px',
            overflow: 'hidden', display: 'flex', pointerEvents: 'none',
          }}>
            <div style={{ width: `${earlyPct}%`, background: '#C0D4E8', flexShrink: 0 }} />
            <div style={{ width: `${Math.max(0, latestPct - earlyPct)}%`, background: '#B8D4A8', flexShrink: 0 }} />
            <div style={{ flex: 1, background: '#E8D890' }} />
          </div>

          {/* Terra fill left of thumb */}
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: 0, width: `${currentPct}%`, height: '8px',
            background: startComputed ? 'var(--terra)' : 'var(--border)',
            borderRadius: '4px 0 0 4px',
            pointerEvents: 'none', zIndex: 0,
          }} />

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(currentPct)}
            onChange={e => handleSlider(Number(e.target.value), sliderMin, totalMs)}
            disabled={!startComputed}
            className="start-slider"
            style={{ position: 'relative', zIndex: 1 }}
          />
        </div>

        {/* Zone labels */}
        <div style={{
          display: 'flex', marginTop: '.3rem',
          fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)',
        }}>
          {earlyPct > 8 && (
            <div style={{
              width: `${earlyPct}%`, textAlign: 'center',
              color: '#6A88A8', flexShrink: 0,
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>
              Too Early
            </div>
          )}
          {(latestPct - earlyPct) > 8 && (
            <div style={{
              width: `${Math.max(0, latestPct - earlyPct)}%`, textAlign: 'center',
              color: 'var(--sage)', flexShrink: 0,
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>
              Sweet Zone
            </div>
          )}
          <div style={{
            flex: 1, textAlign: 'center',
            color: '#8A7A30',
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            Getting Tight
          </div>
        </div>
      </div>

      {/* Date+hour picker for jumping to a different day */}
      {startComputed && (
        <div style={{ marginTop: '.5rem' }}>
          <label style={LABEL_STYLE}>{t('orPickDay')}</label>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input
              type="date"
              value={startPickerDate}
              onChange={e => {
                setStartPickerDate(e.target.value);
                if (e.target.value) setStartFromPicker(e.target.value, startPickerHour);
              }}
              style={{ ...INPUT_STYLE, flex: 2, width: undefined }}
            />
            <select
              value={startPickerHour}
              onChange={e => {
                const h = Number(e.target.value);
                setStartPickerHour(h);
                if (startPickerDate) setStartFromPicker(startPickerDate, h);
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
        </div>
      )}

      {bulkConflict && !dismissedConflict && (
        <div style={{
          background: '#FFF8E8', border: '1.5px solid #E8D080',
          borderRadius: '10px', padding: '.75rem 1rem',
          marginTop: '.75rem', fontSize: '.8rem', color: '#7A5A10',
          lineHeight: 1.5,
        }}>
          <div style={{ marginBottom: '.5rem' }}>
            ⏰ {t('conflict.message', { minutes: bulkConflict.missingMin })}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
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
              {t('conflict.startEarlier', { minutes: bulkConflict.suggestEarlierByMin })}
            </button>
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
      )}

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

      {!startInvalid && (
        <div style={{
          fontSize: '.72rem', color: 'var(--smoke)',
          fontFamily: 'var(--font-dm-mono)',
          marginTop: '.45rem', marginBottom: '.15rem',
        }}>
          {t('totalWindow', { hours: hoursLabel((pendingEatTime.getTime() - pendingStart.getTime()) / 3600000) })}
        </div>
      )}

      {blockerNote && (
        <div style={{
          fontSize: '.74rem', color: 'var(--smoke)',
          marginTop: '.4rem', fontStyle: 'italic', lineHeight: 1.4,
        }}>
          {blockerNote}
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '1.1rem 0 1rem' }} />

      {/* Blocker section */}
      <div style={{ fontSize: '.82rem', color: 'var(--char)', fontWeight: 600, marginBottom: '.3rem' }}>
        {t('blockers.heading')}
      </div>
      <div style={{ fontSize: '.74rem', color: 'var(--smoke)', marginBottom: '.9rem', lineHeight: 1.5 }}>
        {t('blockers.sub')}
      </div>

      {/* Quick presets — work toggle */}
      {workdays.length > 0 && (
        <div style={{ marginBottom: '.75rem' }}>
          <div style={{
            fontSize: '.65rem', color: 'var(--smoke)', opacity: .7,
            fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: '.4rem',
          }}>
            {t('blockers.quickPresets')}
          </div>
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

      {/* Active block chips */}
      {blocks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginBottom: '.5rem' }}>
          {blocks.map((block, i) => {
            const durationH = (block.to.getTime() - block.from.getTime()) / 3600000;
            const isNightBlock = nights.some(n => n.label === block.label);
            const isWorkBlock  = block.label.startsWith('Work · ');
            const emoji = isNightBlock ? '🌙' : isWorkBlock ? '💼' : '🕐';
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '.6rem',
                  padding: '.5rem .85rem',
                  background: '#EEF2FA', border: '1.5px solid #C4CDE0',
                  borderRadius: '10px',
                }}
              >
                <span style={{ fontSize: '.95rem', flexShrink: 0 }}>{emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--char)' }}>
                    {block.label}
                  </span>
                  <span style={{
                    marginLeft: '.5rem', fontSize: '.72rem',
                    color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                  }}>
                    {formatTimeShort(block.from)} → {formatTimeShort(block.to)}
                  </span>
                  <span style={{
                    marginLeft: '.35rem', fontSize: '.7rem',
                    color: '#6A7FA8', fontFamily: 'var(--font-dm-mono)',
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

      {/* Single CTA */}
      <button
        onClick={confirmStart}
        disabled={startInvalid || !startComputed}
        style={{
          ...continueBtnStyle,
          background: (startInvalid || !startComputed) ? 'var(--border)' : 'var(--terra)',
          color: (startInvalid || !startComputed) ? 'var(--smoke)' : '#fff',
          cursor: (startInvalid || !startComputed) ? 'default' : 'pointer',
        }}
      >
        {t('confirmStart')}
      </button>
    </div>
  );
}
