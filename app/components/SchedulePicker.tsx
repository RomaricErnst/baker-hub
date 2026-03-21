'use client';
import { useState, useMemo, useEffect } from 'react';
import { type AvailabilityBlock, toDateTimeLocal, hoursLabel } from '../utils';

interface SchedulePickerProps {
  startTime: Date;
  eatTime: Date | null;
  blocks: AvailabilityBlock[];
  preheatMin: number;
  styleKey: string;
  kitchenTemp: number;
  onChange: (startTime: Date, eatTime: Date, blocks: AvailabilityBlock[]) => void;
  onConfirm?: () => void;
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
  sourdough_bread: { coldH: 24, rtH: 4  },
  baguette:        { coldH: 24, rtH: 2  },
  focaccia:        { coldH: 0,  rtH: 8  },
  ciabatta:        { coldH: 24, rtH: 2  },
  brioche:         { coldH: 0,  rtH: 4  },
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
): { resolvedStart: Date; note: string | null } {
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
    note: moved ? `Start moved to ${formatDayShort(resolved)} to avoid your unavailability block.` : null,
  };
}

// ── Start suggestion engine ───────────────────
// Uses Craig's per-stage model:
//   RT:   IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
//   Cold: IDY% = 7.5 / hours^1.313
// Tropical correction (RT only): 30-32°C → ×1.15, 33-35°C → ×1.25
// IDY floor 0.05%, ceiling 2.0%
function computeSuggestion(
  eatTime: Date,
  preheatMin: number,
  styleKey: string,
  kitchenTemp: number,
) {
  const now = new Date();
  const preheatH = preheatMin / 60;
  const msUntilBake = eatTime.getTime() - now.getTime();
  const minFeasibleMs = (2 + preheatH) * 3600000;

  // Look up style defaults
  const defaults = STYLE_FERM_DEFAULTS[styleKey] ?? FERM_FALLBACK;

  // Tropical correction applies only to the RT portion.
  // Higher temp → faster fermentation → fewer hours needed → divide by factor.
  let tropicalFactor = 1;
  if (kitchenTemp >= 33) tropicalFactor = 1.25;
  else if (kitchenTemp >= 30) tropicalFactor = 1.15;

  const rtH_adjusted   = defaults.rtH / tropicalFactor;
  const standardFermH  = defaults.coldH + rtH_adjusted;

  // Preferred (longer) fermentation — only for styles with preferredColdH defined.
  // Baker must have enough time for preferred + preheat + 2h breathing room.
  const preferredColdH = defaults.preferredColdH ?? null;
  const preferredFermH = preferredColdH !== null ? preferredColdH + rtH_adjusted : null;
  const canUsePreferred = preferredFermH !== null
    && msUntilBake >= (preferredFermH + preheatH + 2) * 3600000;

  // Best start: preferred if baker has time, otherwise standard
  const bestFermH = canUsePreferred ? preferredFermH! : standardFermH;
  let bestStart = new Date(eatTime.getTime() - (bestFermH + preheatH) * 3600000);

  // Alternative start: standard option when in preferred mode, quicker half-time otherwise
  let altStart = canUsePreferred
    ? new Date(eatTime.getTime() - (standardFermH + preheatH) * 3600000)
    : new Date(eatTime.getTime() - (standardFermH * 0.5 + preheatH) * 3600000);

  bestStart = pushToReasonableHour(bestStart);
  altStart  = pushToReasonableHour(altStart);

  // Scenario is based on the standard window (not preferred) — tight/too_short thresholds unchanged
  const standardStart = new Date(eatTime.getTime() - (standardFermH + preheatH) * 3600000);
  const msUntilStandard = standardStart.getTime() - now.getTime();

  let scenario: Scenario;
  if (msUntilBake < minFeasibleMs) {
    scenario = 'too_short';
  } else if (msUntilStandard < 2 * 3600000) {
    scenario = 'tight';
  } else {
    scenario = 'plenty';
  }

  const suggestedStart =
    scenario === 'too_short' ? new Date(now)
    : scenario === 'tight'   ? new Date(Math.max(now.getTime() + 5 * 60000, pushToReasonableHour(standardStart).getTime()))
    : bestStart;

  return {
    scenario,
    suggestedStart,
    alternativeStart: altStart,
    isPreferredMode: canUsePreferred && scenario === 'plenty',
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
    const nightStart = new Date(cursor); nightStart.setHours(23, 0, 0, 0);
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
  borderRadius: '10px',
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
export default function SchedulePicker({ startTime, eatTime, blocks, preheatMin, styleKey, kitchenTemp, onChange, onConfirm }: SchedulePickerProps) {
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
    const s = roundToNearestHour(suggestion.suggestedStart);
    setPendingStart(s);
    onChange(s, pendingEatTime, blocks);
    setStartComputed(true);
    setPhase('start_confirm');
  }

  function confirmStart() {
    onChange(pendingStart, pendingEatTime, blocks);
    onConfirm?.();
  }

  // ── Handlers ─────────────────────────────────
  function handleStartChange(val: string) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      setPendingStart(d);
      onChange(d, pendingEatTime, blocks);
    }
  }

  // Apply blocker overlap whenever blocks change
  function applyAndUpdate(newBlocks: AvailabilityBlock[]) {
    const { resolvedStart, note } = applyBlockerOverlap(pendingStart, newBlocks);
    if (resolvedStart.getTime() !== pendingStart.getTime()) setPendingStart(resolvedStart);
    setBlockerNote(note);
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
    marginTop: '1rem', width: '100%', padding: '.8rem',
    border: 'none', borderRadius: '12px',
    background: 'var(--terra)', color: '#fff',
    fontFamily: 'var(--font-playfair)', fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer',
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
            When does the pizza go in the oven?
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--smoke)', lineHeight: 1.5 }}>
            We&apos;ll recommend the best window to start your dough.
          </div>
        </div>
        <input
          type="datetime-local"
          value={eatTimeSet ? toDateTimeLocal(pendingEatTime) : ''}
          onChange={e => {
            const d = new Date(e.target.value);
            if (!isNaN(d.getTime())) {
              setPendingEatTime(d);
              setEatTimeSet(true);
            }
          }}
          style={{ ...INPUT_STYLE, marginBottom: '1rem' }}
        />
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
          Plan my bake →
        </button>
      </div>
    );
  }

  // ── PHASE 2: Start suggestion + blockers + confirm (merged) ──
  const { scenario, suggestedStart, alternativeStart, isPreferredMode } = suggestion;

  const scenarioBg    = scenario === 'too_short' ? '#FEF4EF' : scenario === 'tight' ? '#FFF8E8' : '#F2FAF0';
  const scenarioBdr   = scenario === 'too_short' ? '#F5C4B0' : scenario === 'tight' ? '#E8D080' : '#C8D4BA';
  const scenarioColor = scenario === 'too_short' ? 'var(--terra)' : scenario === 'tight' ? '#7A5A10' : '#3A6A30';
  const scenarioIcon  = scenario === 'too_short' ? '⚡' : scenario === 'tight' ? '⏰' : '✨';

  let scenarioMain: string;
  let scenarioSecondary: string | null = null;

  if (scenario === 'plenty') {
    if (isPreferredMode) {
      scenarioMain = `Start between ${formatDayHour(suggestedStart)} and ${formatDayHour(alternativeStart)} for best results.`;
      scenarioSecondary = 'Earlier start = longer cold rest = more complex flavour. Later is still great.';
    } else {
      scenarioMain = `Start ${formatDayHour(suggestedStart)} for best results — or ${formatDayHour(alternativeStart)} for a quicker plan.`;
    }
  } else if (scenario === 'tight') {
    scenarioMain = `Start ${formatDayHour(suggestedStart)} for best results.`;
  } else {
    scenarioMain = `That's very soon — start now for the best you can get.`;
  }

  const startInvalid = startComputed && pendingStart >= pendingEatTime;

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
          Bake time
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
          Edit
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

      {/* Start time adjuster */}
      <div style={{ marginBottom: startInvalid ? '.5rem' : '0' }}>
        <label style={LABEL_STYLE}>Start mixing</label>
        {/* CSS overlay: formatted text visible, invisible datetime-local on top for editing */}
        <div style={{ position: 'relative' }}>
          <div style={{
            ...INPUT_STYLE,
            border: `2px solid ${startInvalid ? 'var(--terra)' : 'var(--border)'}`,
            color: startComputed ? 'var(--char)' : 'var(--smoke)',
            fontWeight: startComputed ? 700 : undefined,
            pointerEvents: 'none',
          }}>
            {startComputed ? formatDayShort(pendingStart) : 'Set by plan above'}
          </div>
          <input
            type="datetime-local"
            value={startComputed ? toDateTimeLocal(pendingStart) : ''}
            onChange={e => handleStartChange(e.target.value)}
            style={{
              position: 'absolute', inset: 0, opacity: 0,
              width: '100%', height: '100%', cursor: 'pointer',
              border: 'none', padding: 0, margin: 0,
            }}
          />
        </div>
      </div>

      {startInvalid && (
        <div style={{
          fontSize: '.78rem', color: 'var(--terra)',
          background: '#FEF4EF', border: '1px solid #F5C4B0',
          borderRadius: '8px', padding: '.5rem .85rem',
          marginBottom: '.75rem', marginTop: '.5rem',
        }}>
          Start time must be before bake time.
        </div>
      )}

      {!startInvalid && (
        <div style={{
          fontSize: '.72rem', color: 'var(--smoke)',
          fontFamily: 'var(--font-dm-mono)',
          marginTop: '.45rem', marginBottom: '.15rem',
        }}>
          {hoursLabel((pendingEatTime.getTime() - pendingStart.getTime()) / 3600000)} total window
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
        Anything in between to work around?
      </div>
      <div style={{ fontSize: '.74rem', color: 'var(--smoke)', marginBottom: '.9rem', lineHeight: 1.5 }}>
        Optional — mark windows when you&apos;re unavailable and we&apos;ll send the dough to the fridge.
      </div>

      {/* Quick presets — work toggle */}
      {workdays.length > 0 && (
        <div style={{ marginBottom: '.75rem' }}>
          <div style={{
            fontSize: '.65rem', color: 'var(--smoke)', opacity: .7,
            fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: '.4rem',
          }}>
            Quick presets
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
            💼 Weekdays
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', opacity: .65 }}>
              · 9am → 6pm
            </span>
            {isWorkActive && <span style={{ opacity: .7 }}>✓</span>}
          </button>
        </div>
      )}

      {/* Night toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.45rem', marginBottom: '.8rem' }}>
        {nights.length === 0 ? (
          <div style={{ fontSize: '.76rem', color: 'var(--smoke)', fontStyle: 'italic', padding: '.2rem 0' }}>
            No overnight periods in this schedule.
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
                  · 11pm → 7am
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
          {showCustom ? '✕ Cancel' : '＋ Custom'}
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
            Custom unavailability block
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            <input
              type="text"
              placeholder="Label — e.g. Weekend away"
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
                  From
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
                  To
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
                border: 'none', borderRadius: '8px',
                background: customReady ? 'var(--terra)' : 'var(--border)',
                color: customReady ? '#fff' : 'var(--smoke)',
                fontSize: '.82rem', fontWeight: 500,
                cursor: customReady ? 'pointer' : 'default',
                transition: 'all .15s',
              }}
            >
              Add block
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
        Confirm start →
      </button>
    </div>
  );
}
