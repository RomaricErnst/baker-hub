'use client';
import {
  type FermentWindow,
  type AvailabilityBlock,
  type ScheduleResult,
  formatTime,
  hoursLabel,
} from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';

interface TimelineProps {
  schedule: ScheduleResult;
  blocks: AvailabilityBlock[];
  preheatMin: number;
  startTime: Date;
  eatTime: Date;
  mixerType: MixerType;
  onStartBaking?: () => void;
}

// ── Step kinds ────────────────────────────────
type StepKind = 'mixing' | 'bulk_ferm' | 'final_proof' | 'cold' | 'preheat' | 'eat';

interface TimelineStep {
  kind: 'step';
  id: string;
  stepKind: StepKind;
  time: Date;
  label: string;
  tip: string;
  icon: string;
  durationH: number | null;
}

interface GapMarker {
  kind: 'gap';
  id: string;
  blockLabel: string;
}

type TimelineItem = TimelineStep | GapMarker;

// ── Visual themes per step kind ───────────────
const THEME: Record<StepKind, {
  dot: string; ring: string; line: string;
  pill: string; pillText: string;
  cardBg?: string; cardBorder?: string;
}> = {
  mixing:      { dot: 'var(--ash)',    ring: 'rgba(61,53,48,.1)',    line: 'var(--border)', pill: 'var(--cream)',  pillText: 'var(--ash)' },
  bulk_ferm:   { dot: 'var(--terra)',  ring: 'rgba(196,82,42,.1)',   line: '#F5C4B0',       pill: '#FEF4EF',      pillText: 'var(--terra)', cardBg: '#FEF8F5', cardBorder: '#F5C4B0' },
  final_proof: { dot: '#7A8C6E',       ring: 'rgba(122,140,110,.1)', line: '#C8D4BA',       pill: '#F2F5EF',      pillText: '#4A5A44', cardBg: '#F5F7F2', cardBorder: '#C8D4BA' },
  cold:        { dot: '#6A7FA8',       ring: 'rgba(106,127,168,.1)', line: '#C4CDE0',       pill: '#EEF2FA',      pillText: '#3A5A8A', cardBg: '#EEF2FA', cardBorder: '#C4CDE0' },
  preheat:     { dot: '#C4A030',       ring: 'rgba(196,160,48,.12)', line: '#E8D890',       pill: '#FDFBF2',      pillText: '#7A5A10' },
  eat:         { dot: '#5A9A50',       ring: 'rgba(90,154,80,.1)',   line: 'transparent',   pill: '#F2FAF0',      pillText: '#3A6A30' },
};

// ── Build timeline items ──────────────────────
function buildItems(
  schedule: ScheduleResult,
  blocks: AvailabilityBlock[],
  startTime: Date,
  eatTime: Date,
  preheatMin: number,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  const sorted = [...schedule.rtWindows, ...schedule.coldWindows]
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  // Time of first cold window — RT windows before this are bulk, after are final proof
  const firstColdMs = schedule.coldWindows.length > 0
    ? Math.min(...schedule.coldWindows.map(w => w.from.getTime()))
    : Infinity;

  function windowLabel(win: FermentWindow): { label: string; tip: string; icon: string; stepKind: StepKind } {
    if (win.type === 'cold') {
      return {
        stepKind: 'cold',
        label: 'Cold Retard',
        icon: '❄️',
        tip: 'Dough rests in the fridge. Cold fermentation builds flavour slowly — no action needed, time works for you.',
      };
    }
    if (win.from.getTime() >= firstColdMs) {
      return {
        stepKind: 'final_proof',
        label: 'Final Proof',
        icon: '⏰',
        tip: 'Remove dough from fridge. Allow 30–60 min to come to room temperature before shaping. Passes the poke test when ready.',
      };
    }
    return {
      stepKind: 'bulk_ferm',
      label: 'Bulk Fermentation',
      icon: '🌡️',
      tip: 'Cover tightly and place in a warm spot away from drafts. Perform 4 sets of stretch & folds in the first 2 hours, every 30 minutes.',
    };
  }

  function findBlock(coldWin: FermentWindow): AvailabilityBlock | null {
    return blocks.find(b =>
      Math.abs(b.from.getTime() - coldWin.from.getTime()) <= 60 * 60000
    ) ?? null;
  }

  // 1 — Mixing
  items.push({
    kind: 'step', id: 'mixing', stepKind: 'mixing',
    time: startTime,
    label: 'Mix & Knead',
    icon: '🤌',
    tip: 'Combine flour, water, salt and yeast. Knead until smooth and elastic — dough passes the windowpane test. Cover and rest 20 min.',
    durationH: 20 / 60,
  });

  // 2 — Fermentation windows
  for (let i = 0; i < sorted.length; i++) {
    const win = sorted[i];
    const prev = sorted[i - 1];

    // Gap marker before a cold window (user going away)
    if (win.type === 'cold') {
      const block = findBlock(win);
      items.push({
        kind: 'gap',
        id: `gap-${i}`,
        blockLabel: block?.label ?? 'Away',
      });
    }

    // "Return from fridge" note is embedded in final_proof tip; no extra marker needed

    const { label, tip, icon, stepKind } = windowLabel(win);
    items.push({
      kind: 'step', id: `win-${i}`, stepKind,
      time: win.from,
      label, tip, icon,
      durationH: win.hours,
    });
  }

  // 3 — Preheat
  const preheatTime = new Date(eatTime.getTime() - preheatMin * 60000);
  items.push({
    kind: 'step', id: 'preheat', stepKind: 'preheat',
    time: preheatTime,
    label: 'Preheat Oven',
    icon: '🔥',
    tip: preheatMin >= 45
      ? `Heat oven to maximum temperature. Give it the full ${preheatMin} min to fully saturate your baking surface.`
      : `Set oven to maximum temperature. Preheat for ${preheatMin} minutes.`,
    durationH: preheatMin / 60,
  });

  // 4 — Eat
  items.push({
    kind: 'step', id: 'eat', stepKind: 'eat',
    time: eatTime,
    label: 'Bake & Eat!',
    icon: '🎉',
    tip: 'Your dough is perfectly fermented. Score, load, and bake. Buon appetito!',
    durationH: null,
  });

  return items;
}

// ── Build phase summary ───────────────────────
interface Phase {
  label: string;
  icon: string;
  durationH: number;
  stepKind: StepKind;
}

function buildPhases(schedule: ScheduleResult, preheatMin: number): Phase[] {
  const firstColdMs = schedule.coldWindows.length > 0
    ? Math.min(...schedule.coldWindows.map(w => w.from.getTime()))
    : Infinity;

  const bulkH = schedule.rtWindows
    .filter(w => w.from.getTime() < firstColdMs)
    .reduce((s, w) => s + w.hours, 0);

  const finalH = schedule.rtWindows
    .filter(w => w.from.getTime() >= firstColdMs)
    .reduce((s, w) => s + w.hours, 0);

  const phases: Phase[] = [
    { label: 'Mixing', icon: '🤌', durationH: 20 / 60, stepKind: 'mixing' },
  ];

  if (bulkH > 0) {
    phases.push({ label: 'Bulk Fermentation', icon: '🌡️', durationH: bulkH, stepKind: 'bulk_ferm' });
  }

  if (schedule.totalColdHours > 0) {
    phases.push({ label: 'Cold Retard', icon: '❄️', durationH: schedule.totalColdHours, stepKind: 'cold' });
  }

  if (finalH > 0) {
    phases.push({ label: 'Final Proof', icon: '⏰', durationH: finalH, stepKind: 'final_proof' });
  }

  phases.push({ label: 'Preheat', icon: '🔥', durationH: preheatMin / 60, stepKind: 'preheat' });

  return phases;
}

// ── Component ─────────────────────────────────
export default function Timeline({
  schedule, blocks, preheatMin, startTime, eatTime, mixerType, onStartBaking,
}: TimelineProps) {
  const items  = buildItems(schedule, blocks, startTime, eatTime, preheatMin);
  const phases = buildPhases(schedule, preheatMin);

  const steps = items.filter((it): it is TimelineStep => it.kind === 'step');
  const lastStepId = steps[steps.length - 1]?.id;

  return (
    <div>

      {/* ── Header ─────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.25rem',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-playfair)', fontSize: '1.15rem',
            fontWeight: 700, color: 'var(--char)',
          }}>
            Baking Schedule
          </div>
          <div style={{ fontSize: '.75rem', color: 'var(--smoke)', marginTop: '.1rem' }}>
            {formatTime(startTime)} → {formatTime(eatTime)}
            {' · '}{hoursLabel((eatTime.getTime() - startTime.getTime()) / 3600000)} total
          </div>
        </div>

        <button
          onClick={onStartBaking}
          style={{
            display: 'flex', alignItems: 'center', gap: '.45rem',
            padding: '.55rem 1.1rem',
            background: 'var(--char)', color: 'var(--cream)',
            border: 'none', borderRadius: '10px',
            fontSize: '.8rem', fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity .15s',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '.85rem' }}>▶</span>
          Start Baking Mode
        </button>
      </div>

      {/* ── Auto-adjust banner ──────────────────── */}
      {schedule.wasAutoAdjusted && (
        <div style={{
          display: 'flex', gap: '.6rem', alignItems: 'flex-start',
          background: '#FFF8E8', border: '1.5px solid #E8D080',
          borderRadius: '10px', padding: '.65rem .9rem',
          marginBottom: '1.25rem', fontSize: '.78rem',
          color: '#7A5A10', lineHeight: 1.5,
        }}>
          <span style={{ flexShrink: 0 }}>⚡</span>
          <span>
            <strong>Schedule auto-adjusted</strong> — a room temperature window was too long for your kitchen temperature.
            A cold retard phase was added automatically to prevent over-fermentation.
          </span>
        </div>
      )}

      {/* ── Phase summary ──────────────────────── */}
      <div style={{
        display: 'flex', gap: '.5rem',
        overflowX: 'auto', paddingBottom: '.35rem',
        marginBottom: '1.75rem',
        // hide scrollbar
        msOverflowStyle: 'none',
      }}>
        {phases.map((phase, i) => {
          const th = THEME[phase.stepKind];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '.55rem .85rem',
                border: `1.5px solid ${th.cardBorder ?? th.line}`,
                borderRadius: '12px',
                background: th.cardBg ?? 'var(--warm)',
                minWidth: '90px',
              }}>
                <span style={{ fontSize: '1.1rem', marginBottom: '.2rem' }}>{phase.icon}</span>
                <span style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--char)', textAlign: 'center', marginBottom: '.3rem', lineHeight: 1.3 }}>
                  {phase.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem',
                  background: th.pill, color: th.pillText,
                  borderRadius: '10px', padding: '.15rem .5rem',
                }}>
                  {hoursLabel(phase.durationH)}
                </span>
              </div>

              {/* Connector arrow */}
              {i < phases.length - 1 && (
                <div style={{
                  width: '16px', flexShrink: 0,
                  textAlign: 'center', color: 'var(--border)',
                  fontSize: '.7rem',
                }}>
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Timeline ───────────────────────────── */}
      <div>
        {items.map((item, idx) => {
          // ── Gap marker ──
          if (item.kind === 'gap') {
            return (
              <div key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'stretch' }}>
                {/* Time col placeholder */}
                <div style={{ width: '72px', flexShrink: 0 }} />

                {/* Line column — continues through the gap */}
                <div style={{
                  width: '20px', flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <div style={{ flex: 1, width: '2px', background: '#C4CDE0' }} />
                </div>

                {/* Gap card */}
                <div style={{ flex: 1, padding: '.5rem 0' }}>
                  <div style={{
                    border: '1.5px dashed #C4CDE0',
                    borderRadius: '10px',
                    padding: '.5rem .9rem',
                    background: '#EEF2FA',
                    display: 'flex', alignItems: 'center', gap: '.55rem',
                    fontSize: '.76rem', color: '#3A5A8A',
                    lineHeight: 1.45,
                  }}>
                    <span style={{ fontSize: '.9rem', flexShrink: 0 }}>🌙</span>
                    <span>
                      <strong>{item.blockLabel}</strong>
                      {' '}— dough rests in the fridge while you&apos;re away.
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // ── Step ──
          const th = THEME[item.stepKind];
          const isLast = item.id === lastStepId;

          return (
            <div key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'stretch' }}>

              {/* Time column */}
              <div style={{
                width: '72px', flexShrink: 0,
                textAlign: 'right', paddingTop: '.1rem',
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '.7rem', color: 'var(--smoke)',
                lineHeight: 1.4,
              }}>
                {formatTime(item.time)}
              </div>

              {/* Dot + line column */}
              <div style={{
                width: '20px', flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                {/* Dot */}
                <div style={{
                  width: '14px', height: '14px',
                  borderRadius: '50%',
                  background: th.dot,
                  flexShrink: 0,
                  boxShadow: `0 0 0 4px ${th.ring}`,
                  marginTop: '.05rem',
                }} />
                {/* Line to next item */}
                {!isLast && (
                  <div style={{
                    flex: 1, width: '2px',
                    background: th.line,
                    minHeight: '24px',
                    marginTop: '3px',
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : '1.25rem' }}>
                {/* Label row */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: '.5rem',
                  marginBottom: '.3rem',
                }}>
                  <div style={{
                    fontWeight: 600, fontSize: '.9rem', color: 'var(--char)',
                    display: 'flex', alignItems: 'center', gap: '.4rem',
                  }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>

                  {item.durationH !== null && (
                    <span style={{
                      fontFamily: 'var(--font-dm-mono)',
                      fontSize: '.68rem',
                      background: th.pill,
                      color: th.pillText,
                      borderRadius: '10px',
                      padding: '.18rem .55rem',
                      flexShrink: 0,
                    }}>
                      {hoursLabel(item.durationH)}
                    </span>
                  )}
                </div>

                {/* Tip */}
                <div style={{
                  fontSize: '.77rem', color: 'var(--smoke)',
                  lineHeight: 1.6,
                }}>
                  {item.tip}
                </div>

                {/* Mixer instructions — shown on mixing step only */}
                {item.stepKind === 'mixing' && (() => {
                  const mx = MIXER_TYPES[mixerType];
                  return (
                    <div style={{
                      marginTop: '.6rem',
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '.7rem .9rem',
                      background: 'var(--cream)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '.45rem',
                        marginBottom: '.4rem',
                      }}>
                        <span style={{ fontSize: '1rem' }}>{mx.emoji}</span>
                        <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--char)' }}>
                          {mx.name}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '.72rem', color: 'var(--smoke)',
                        fontFamily: 'var(--font-dm-mono)',
                        lineHeight: 1.6,
                      }}>
                        {mx.instructions}
                      </div>
                    </div>
                  );
                })()}

                {/* Cold retard card tint */}
                {(item.stepKind === 'cold' || item.stepKind === 'bulk_ferm' || item.stepKind === 'final_proof') && th.cardBg && (
                  <div style={{
                    marginTop: '.5rem',
                    display: 'flex', gap: '.4rem', alignItems: 'center',
                    fontSize: '.7rem',
                    color: th.pillText,
                    fontFamily: 'var(--font-dm-mono)',
                  }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: th.dot, flexShrink: 0,
                    }} />
                    {item.stepKind === 'cold' && `${formatTime(item.time)} → ends at ${formatTime(new Date(item.time.getTime() + (item.durationH ?? 0) * 3600000))}`}
                    {item.stepKind === 'bulk_ferm' && `Room temperature window · ${hoursLabel(item.durationH ?? 0)}`}
                    {item.stepKind === 'final_proof' && `Room temperature window · ${hoursLabel(item.durationH ?? 0)}`}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
