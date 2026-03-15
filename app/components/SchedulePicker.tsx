'use client';
import { useState, useMemo } from 'react';
import { type AvailabilityBlock, toDateTimeLocal, formatTime, hoursLabel } from '../utils';

interface SchedulePickerProps {
  startTime: Date;
  eatTime: Date;
  blocks: AvailabilityBlock[];
  onChange: (startTime: Date, eatTime: Date, blocks: AvailabilityBlock[]) => void;
}

const PRESET_EMOJI: Record<string, string> = {
  'Tonight 10pm–7am':        '🌙',
  'Tomorrow night 10pm–7am': '🌙',
  'Work hours 9am–6pm':      '💼',
};

function buildPresets(now: Date): { label: string; from: Date; to: Date }[] {
  // Tonight 10pm → next morning 7am
  const tonightFrom = new Date(now);
  tonightFrom.setHours(22, 0, 0, 0);
  if (tonightFrom <= now) tonightFrom.setDate(tonightFrom.getDate() + 1);
  const tonightTo = new Date(tonightFrom);
  tonightTo.setDate(tonightTo.getDate() + 1);
  tonightTo.setHours(7, 0, 0, 0);

  // Tomorrow night 10pm → day after 7am
  const tmrwFrom = new Date(now);
  tmrwFrom.setDate(tmrwFrom.getDate() + 1);
  tmrwFrom.setHours(22, 0, 0, 0);
  const tmrwTo = new Date(tmrwFrom);
  tmrwTo.setDate(tmrwTo.getDate() + 1);
  tmrwTo.setHours(7, 0, 0, 0);

  // Next weekday 9am–6pm
  const workFrom = new Date(now);
  workFrom.setHours(9, 0, 0, 0);
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  if (workFrom <= now || isWeekend(workFrom)) {
    workFrom.setDate(workFrom.getDate() + 1);
    while (isWeekend(workFrom)) workFrom.setDate(workFrom.getDate() + 1);
  }
  const workTo = new Date(workFrom);
  workTo.setHours(18, 0, 0, 0);

  return [
    { label: 'Tonight 10pm–7am',        from: tonightFrom, to: tonightTo },
    { label: 'Tomorrow night 10pm–7am', from: tmrwFrom,    to: tmrwTo   },
    { label: 'Work hours 9am–6pm',      from: workFrom,    to: workTo   },
  ];
}

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

export default function SchedulePicker({ startTime, eatTime, blocks, onChange }: SchedulePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const presets = useMemo(() => buildPresets(new Date()), []);
  const totalHours = (eatTime.getTime() - startTime.getTime()) / 3600000;
  const timeInvalid = eatTime <= startTime;

  function handleStartChange(val: string) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) onChange(d, eatTime, blocks);
  }

  function handleEatChange(val: string) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) onChange(startTime, d, blocks);
  }

  function isPresetActive(label: string) {
    return blocks.some(b => b.label === label);
  }

  function togglePreset(preset: { label: string; from: Date; to: Date }) {
    if (isPresetActive(preset.label)) {
      onChange(startTime, eatTime, blocks.filter(b => b.label !== preset.label));
    } else {
      onChange(startTime, eatTime, [...blocks, { from: preset.from, to: preset.to, label: preset.label }]);
    }
  }

  function removeBlock(index: number) {
    onChange(startTime, eatTime, blocks.filter((_, i) => i !== index));
  }

  function addCustomBlock() {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (!customLabel.trim() || isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return;
    onChange(startTime, eatTime, [...blocks, { from, to, label: customLabel.trim() }]);
    setCustomLabel('');
    setCustomFrom('');
    setCustomTo('');
    setShowCustom(false);
  }

  const customReady = customLabel.trim() && customFrom && customTo
    && new Date(customTo) > new Date(customFrom);

  return (
    <div>

      {/* ── Time inputs ─────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '.75rem',
        alignItems: 'end',
        marginBottom: timeInvalid ? '.75rem' : '1.5rem',
      }}>

        <div>
          <label style={LABEL_STYLE}>Start mixing</label>
          <input
            type="datetime-local"
            value={toDateTimeLocal(startTime)}
            onChange={e => handleStartChange(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        {/* Duration bridge */}
        <div style={{ textAlign: 'center', paddingBottom: '.6rem' }}>
          <div style={{
            fontSize: '.65rem',
            color: timeInvalid ? 'var(--terra)' : 'var(--smoke)',
            fontFamily: 'var(--font-dm-mono)',
            whiteSpace: 'nowrap',
            marginBottom: '.1rem',
          }}>
            {timeInvalid ? '!' : totalHours > 0 ? hoursLabel(totalHours) : '—'}
          </div>
          <div style={{ color: 'var(--border)', fontSize: '.9rem', lineHeight: 1 }}>→</div>
        </div>

        <div>
          <label style={LABEL_STYLE}>Ready to eat</label>
          <input
            type="datetime-local"
            value={toDateTimeLocal(eatTime)}
            onChange={e => handleEatChange(e.target.value)}
            style={{
              ...INPUT_STYLE,
              border: `2px solid ${timeInvalid ? 'var(--terra)' : 'var(--border)'}`,
            }}
          />
        </div>
      </div>

      {/* Invalid time warning */}
      {timeInvalid && (
        <div style={{
          fontSize: '.78rem', color: 'var(--terra)',
          background: '#FEF4EF', border: '1px solid #F5C4B0',
          borderRadius: '8px', padding: '.5rem .85rem',
          marginBottom: '1.25rem',
        }}>
          Eat time must be after start time.
        </div>
      )}

      {/* ── Availability blocks ──────────────────────── */}
      <div>
        <div style={{
          fontSize: '.72rem', color: 'var(--smoke)',
          textTransform: 'uppercase', letterSpacing: '.06em',
          marginBottom: '.6rem', fontFamily: 'var(--font-dm-mono)',
        }}>
          I won't be available — dough goes in the fridge
        </div>

        {/* Preset pills + Custom toggle */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.45rem', marginBottom: '.8rem' }}>
          {presets.map(preset => {
            const active = isPresetActive(preset.label);
            return (
              <button
                key={preset.label}
                onClick={() => togglePreset(preset)}
                style={{
                  padding: '.38rem .85rem',
                  borderRadius: '20px',
                  border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                  background: active ? '#FEF4EF' : 'var(--warm)',
                  color: active ? 'var(--terra)' : 'var(--smoke)',
                  fontSize: '.78rem',
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                  transition: 'all .15s',
                }}
              >
                {PRESET_EMOJI[preset.label]} {preset.label}
                {active && <span style={{ marginLeft: '.35rem', opacity: .7 }}>✓</span>}
              </button>
            );
          })}

          <button
            onClick={() => setShowCustom(v => !v)}
            style={{
              padding: '.38rem .85rem',
              borderRadius: '20px',
              border: `1.5px solid ${showCustom ? 'var(--terra)' : 'var(--border)'}`,
              background: showCustom ? '#FEF4EF' : 'var(--warm)',
              color: showCustom ? 'var(--terra)' : 'var(--smoke)',
              fontSize: '.78rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
              transition: 'all .15s',
            }}
          >
            {showCustom ? '✕ Cancel' : '＋ Custom'}
          </button>
        </div>

        {/* Custom block form */}
        {showCustom && (
          <div style={{
            border: '1.5px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem 1.1rem',
            background: 'var(--warm)',
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
                  border: '1.5px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--card)',
                  color: 'var(--char)',
                  fontSize: '.82rem',
                  fontFamily: 'var(--font-dm-sans)',
                  outline: 'none',
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
                      width: '100%',
                      padding: '.55rem .75rem',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--card)',
                      color: 'var(--char)',
                      fontSize: '.78rem',
                      fontFamily: 'var(--font-dm-mono)',
                      outline: 'none',
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
                      width: '100%',
                      padding: '.55rem .75rem',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--card)',
                      color: 'var(--char)',
                      fontSize: '.78rem',
                      fontFamily: 'var(--font-dm-mono)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                onClick={addCustomBlock}
                disabled={!customReady}
                style={{
                  alignSelf: 'flex-start',
                  padding: '.55rem 1.1rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: customReady ? 'var(--terra)' : 'var(--border)',
                  color: customReady ? '#fff' : 'var(--smoke)',
                  fontSize: '.82rem',
                  fontWeight: 500,
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
        {blocks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            {blocks.map((block, i) => {
              const durationH = (block.to.getTime() - block.from.getTime()) / 3600000;
              const emoji = PRESET_EMOJI[block.label] ?? '🕐';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '.6rem',
                    padding: '.5rem .85rem',
                    background: '#EEF2FA',
                    border: '1.5px solid #C4CDE0',
                    borderRadius: '10px',
                  }}
                >
                  <span style={{ fontSize: '.95rem', flexShrink: 0 }}>{emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--char)' }}>
                      {block.label}
                    </span>
                    <span style={{
                      marginLeft: '.5rem',
                      fontSize: '.72rem',
                      color: 'var(--smoke)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}>
                      {formatTime(block.from)} → {formatTime(block.to)}
                    </span>
                    <span style={{
                      marginLeft: '.35rem',
                      fontSize: '.7rem',
                      color: '#6A7FA8',
                      fontFamily: 'var(--font-dm-mono)',
                    }}>
                      ({hoursLabel(durationH)})
                    </span>
                  </div>
                  <button
                    onClick={() => removeBlock(i)}
                    title="Remove"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--smoke)',
                      fontSize: '.8rem',
                      padding: '.15rem .3rem',
                      borderRadius: '4px',
                      lineHeight: 1,
                      flexShrink: 0,
                      transition: 'color .15s',
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            fontSize: '.78rem',
            color: 'var(--smoke)',
            fontStyle: 'italic',
            padding: '.4rem 0',
          }}>
            No blocks added — dough will ferment at room temperature throughout.
          </div>
        )}
      </div>
    </div>
  );
}
