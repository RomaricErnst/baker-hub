'use client';
import { useState } from 'react';
import {
  type AvailabilityBlock,
  type ScheduleResult,
  formatTime,
  hoursLabel,
} from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
import LearnModal from './LearnModal';

interface TimelineProps {
  schedule: ScheduleResult;
  blocks: AvailabilityBlock[];
  preheatMin: number;
  startTime: Date;
  eatTime: Date;
  mixerType: MixerType;
  styleKey: string;
  oil: number;
  hydration: number;
  numItems: number;
  onStartBaking?: () => void;
}

// ── Step kinds ────────────────────────────────
type StepKind = 'mixing' | 'bulk_ferm' | 'divide_ball' | 'final_proof' | 'cold' | 'rest_rt' | 'preheat' | 'eat';

interface TimelineStep {
  kind: 'step';
  id: string;
  stepKind: StepKind;
  time: Date;
  label: string;
  tip: string;
  icon: string;
  durationH: number | null;
  coldBlocks?: AvailabilityBlock[];
}

// ── Visual themes per step kind ───────────────
const THEME: Record<StepKind, {
  dot: string; ring: string; line: string;
  pill: string; pillText: string;
  cardBg?: string; cardBorder?: string;
}> = {
  mixing:      { dot: 'var(--ash)',    ring: 'rgba(61,53,48,.1)',    line: 'var(--border)', pill: 'var(--cream)',  pillText: 'var(--ash)' },
  bulk_ferm:   { dot: 'var(--terra)',  ring: 'rgba(196,82,42,.1)',   line: '#F5C4B0',       pill: '#FEF4EF',      pillText: 'var(--terra)', cardBg: '#FEF8F5', cardBorder: '#F5C4B0' },
  divide_ball: { dot: '#8A6A4A',       ring: 'rgba(138,106,74,.1)',  line: '#D4B898',       pill: '#FDF4EA',      pillText: '#6A3A10' },
  final_proof: { dot: '#7A8C6E',       ring: 'rgba(122,140,110,.1)', line: '#C8D4BA',       pill: '#F2F5EF',      pillText: '#4A5A44', cardBg: '#F5F7F2', cardBorder: '#C8D4BA' },
  cold:        { dot: '#6A7FA8',       ring: 'rgba(106,127,168,.1)', line: '#C4CDE0',       pill: '#EEF2FA',      pillText: '#3A5A8A', cardBg: '#EEF2FA', cardBorder: '#C4CDE0' },
  rest_rt:     { dot: '#B87850',       ring: 'rgba(184,120,80,.1)',  line: '#DDB898',       pill: '#FDF0E8',      pillText: '#7A3A10', cardBg: '#FDF4EE', cardBorder: '#DDB898' },
  preheat:     { dot: '#C4A030',       ring: 'rgba(196,160,48,.12)', line: '#E8D890',       pill: '#FDFBF2',      pillText: '#7A5A10' },
  eat:         { dot: '#5A9A50',       ring: 'rgba(90,154,80,.1)',   line: 'transparent',   pill: '#F2FAF0',      pillText: '#3A6A30' },
};

// ── Build timeline steps ──────────────────────
function buildItems(
  schedule: ScheduleResult,
  blocks: AvailabilityBlock[],
  startTime: Date,
  eatTime: Date,
  preheatMin: number,
  mixerType: MixerType,
  numItems: number,
): TimelineStep[] {
  const items: TimelineStep[] = [];
  const kneadMin = MIXER_TYPES[mixerType].kneadMin;

  // 1 — Mix & Knead
  items.push({
    kind: 'step', id: 'mixing', stepKind: 'mixing',
    time: startTime,
    label: 'Mix & Knead',
    icon: '🤌',
    tip: 'Combine flour, water, salt and yeast. Knead until smooth and elastic — dough passes the windowpane test. Cover and rest 20 min.',
    durationH: kneadMin > 0 ? kneadMin / 60 : null,
  });

  // 2 — Bulk Fermentation
  if (schedule.bulkFermHours > 0) {
    items.push({
      kind: 'step', id: 'bulk_ferm', stepKind: 'bulk_ferm',
      time: schedule.bulkFermStart,
      label: 'Bulk Fermentation',
      icon: '🌡️',
      tip: 'Cover tightly and place in a warm spot away from drafts. Perform 4 sets of stretch & folds in the first 2 hours, every 30 minutes.',
      durationH: schedule.bulkFermHours,
    });
  }

  // 2b — Divide & Ball
  {
    const divideTime = new Date(schedule.bulkFermStart.getTime() + schedule.bulkFermHours * 3600000);
    const extraBalls = Math.max(0, numItems - 4);
    const divideMin  = 15 + 2 * extraBalls;
    const divideH    = divideMin / 60;

    // Detect tight window: next step starts within 15 min
    const nextStepTime = schedule.coldRetardStart ?? schedule.finalProofStart;
    const windowMin = (nextStepTime.getTime() - divideTime.getTime()) / 60000;
    const isTight   = windowMin < 15;

    items.push({
      kind: 'step', id: 'divide_ball', stepKind: 'divide_ball',
      time: divideTime,
      label: 'Divide & Ball',
      icon: '⚖️',
      tip: `Weigh and divide dough into ${numItems} balls. Pinch the bottom tight for a smooth, taut skin.${isTight ? ' ⚠️ Tight window — work quickly.' : ''}`,
      durationH: divideH,
    });
  }

  // 3 — Cold Retard (if any)
  if (schedule.coldRetardStart && schedule.coldRetardEnd) {
    const coldBlocks = blocks
      .filter(b => b.from < schedule.coldRetardEnd! && b.to > schedule.coldRetardStart!)
      .sort((a, b) => a.from.getTime() - b.from.getTime());
    items.push({
      kind: 'step', id: 'cold', stepKind: 'cold',
      time: schedule.coldRetardStart,
      label: 'Cold Retard',
      icon: '❄️',
      tip: 'Dough rests in the fridge. Cold fermentation builds flavour slowly — no action needed, time works for you.',
      durationH: schedule.coldRetardHours,
      coldBlocks,
    });
  }

  // 4 — Remove from fridge (only if cold retard exists)
  if (schedule.coldRetardEnd && schedule.restRtHours > 0) {
    items.push({
      kind: 'step', id: 'rest_rt', stepKind: 'rest_rt',
      time: schedule.coldRetardEnd,
      label: 'Remove from fridge — rest at room temperature',
      icon: '🌡️',
      tip: 'Take dough balls out of the fridge and leave covered at room temperature. Cold dough is too stiff to stretch and will tear. The poke test will be unreliable until the dough has warmed through.',
      durationH: schedule.restRtHours,
    });
  }

  // 5 — Final Proof
  if (schedule.finalProofHours > 0) {
    items.push({
      kind: 'step', id: 'final_proof', stepKind: 'final_proof',
      time: schedule.finalProofStart,
      label: 'Final Proof',
      icon: '⏰',
      tip: schedule.coldRetardStart
        ? 'Shape dough balls if not already done. Cover and leave at room temperature until the poke test confirms they are ready to bake.'
        : 'Shape dough balls and let them proof covered at room temperature. The poke test tells you when they are ready to bake.',
      durationH: schedule.finalProofHours,
    });
  }

  // 6 — Preheat Oven
  items.push({
    kind: 'step', id: 'preheat', stepKind: 'preheat',
    time: schedule.preheatStart,
    label: 'Preheat Oven',
    icon: '🔥',
    tip: preheatMin >= 45
      ? `Heat oven to maximum temperature. Give it the full ${preheatMin} min to fully saturate your baking surface.`
      : `Set oven to maximum temperature. Preheat for ${preheatMin} minutes.`,
    durationH: preheatMin / 60,
  });

  // 7 — Bake & Eat!
  items.push({
    kind: 'step', id: 'eat', stepKind: 'eat',
    time: schedule.bakeStart,
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
  const phases: Phase[] = [
    { label: 'Mixing', icon: '🤌', durationH: schedule.mixingDurationH || 5 / 60, stepKind: 'mixing' },
  ];

  if (schedule.bulkFermHours > 0) {
    phases.push({ label: 'Bulk Fermentation', icon: '🌡️', durationH: schedule.bulkFermHours, stepKind: 'bulk_ferm' });
  }

  if (schedule.coldRetardHours > 0) {
    phases.push({ label: 'Cold Retard', icon: '❄️', durationH: schedule.coldRetardHours, stepKind: 'cold' });
  }

  if (schedule.finalProofHours > 0) {
    phases.push({ label: 'Final Proof', icon: '⏰', durationH: schedule.finalProofHours, stepKind: 'final_proof' });
  }

  phases.push({ label: 'Preheat', icon: '🔥', durationH: preheatMin / 60, stepKind: 'preheat' });

  return phases;
}

// ── ⓘ badge ───────────────────────────────────
function InfoBadge({ term, onOpen }: { term: string; onOpen: (t: string) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onOpen(term); }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginLeft: '.3rem',
        width: '16px', height: '16px', borderRadius: '50%',
        border: '1.5px solid var(--terra)', color: 'var(--terra)',
        background: 'transparent', cursor: 'pointer',
        fontSize: '9px', fontWeight: 700, lineHeight: 1,
        flexShrink: 0, verticalAlign: 'middle',
        padding: 0,
      }}
    >
      i
    </button>
  );
}

// ── Component ─────────────────────────────────
export default function Timeline({
  schedule, blocks, preheatMin, startTime, eatTime, mixerType, styleKey, oil, hydration, numItems, onStartBaking,
}: TimelineProps) {
  const [learnTerm, setLearnTerm] = useState<string | null>(null);

  const items  = buildItems(schedule, blocks, startTime, eatTime, preheatMin, mixerType, numItems);
  const phases = buildPhases(schedule, preheatMin);

  const lastStepId = items[items.length - 1]?.id;

  const isSourdough = styleKey === 'sourdough' || styleKey === 'sourdough_bread';

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
        {items.map((item) => {
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
                    {item.stepKind === 'bulk_ferm' && (
                      <InfoBadge term="bulk_fermentation" onOpen={setLearnTerm} />
                    )}
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
                  {item.stepKind === 'rest_rt'
                    ? <>Take dough balls out of the fridge and leave covered at room temperature. Cold dough is too stiff to stretch and will tear. The poke test<InfoBadge term="poke_test" onOpen={setLearnTerm} /> will be unreliable until the dough has warmed through.</>
                    : item.stepKind === 'final_proof'
                    ? <>Shape dough balls if not already done. Cover and leave at room temperature until the poke test<InfoBadge term="poke_test" onOpen={setLearnTerm} /> confirms they are ready to bake.</>
                    : item.stepKind === 'divide_ball'
                    ? <>{item.tip}{schedule.coldRetardStart && <><br /><span style={{ marginTop: '.35rem', display: 'inline-block', color: '#6A7FA8', fontStyle: 'italic' }}>Coming from the fridge? Cold dough is easier to ball — work quickly before it warms up.</span></>}</>
                    : item.tip}
                </div>

                {/* Mixing sequence — shown on mixing step only */}
                {item.stepKind === 'mixing' && (() => {
                  const showOil = oil > 0;
                  const showBassinage = hydration > 70;

                  type SeqItem =
                    | { kind: 'step'; emoji: string; bold: string; note: string; noteNode?: React.ReactNode; term?: string }
                    | { kind: 'rest'; label: string; note: string; noteNode?: React.ReactNode; term?: string };

                  let sequence: SeqItem[] = [];

                  if (isSourdough) {
                    sequence = [
                      { kind: 'step', emoji: '🌊', bold: 'Flour + 90% of water', note: 'mix 2 min until no dry flour remains' },
                      { kind: 'step', emoji: '🫙', bold: 'Add starter', note: 'mix to combine' },
                      { kind: 'step', emoji: '🧂', bold: 'Add salt + remaining 10% water', note: 'mix until fully absorbed' },
                      ...(showOil ? [{ kind: 'step' as const, emoji: '🫒', bold: 'Add oil last', note: 'oil added late preserves gluten structure' }] : []),
                    ];
                  } else if (mixerType === 'hand') {
                    sequence = [
                      { kind: 'step', emoji: '🌊', bold: 'Flour + 90% of water', note: 'mix until no dry flour remains, ~2 min' },
                      { kind: 'rest', label: 'Cover and rest 20 min', note: 'flour absorbs water naturally, reduces kneading time', term: 'autolyse' },
                      { kind: 'step', emoji: '🧫', bold: 'Add yeast', note: 'mix to combine, 2 min' },
                      { kind: 'step', emoji: '🧂', bold: 'Add salt', note: 'mix until absorbed, 2 min' },
                      ...(showBassinage ? [{ kind: 'step' as const, emoji: '💧', bold: 'Add remaining 10% water gradually', note: 'mix until absorbed', term: 'bassinage' }] : []),
                      ...(showOil ? [{ kind: 'step' as const, emoji: '🫒', bold: 'Add oil last', note: 'mix 1 min' }] : []),
                      { kind: 'step', emoji: '🙌', bold: 'Knead 8–12 min until smooth and elastic', note: 'windowpane test', term: 'windowpane' },
                    ];
                  } else if (mixerType === 'stand') {
                    sequence = [
                      { kind: 'step', emoji: '🌊', bold: 'Flour + 90% of water', note: 'Speed 1, 2 min to combine' },
                      { kind: 'step', emoji: '🧫', bold: 'Add yeast', note: 'Speed 1, 2 min' },
                      { kind: 'step', emoji: '🧂', bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
                      { kind: 'step', emoji: '⚙️', bold: 'Speed 2', note: '6–10 min until dough clears the bowl', term: 'windowpane' },
                      ...(showBassinage ? [{ kind: 'step' as const, emoji: '💧', bold: 'Add bassinage water gradually at Speed 2', note: 'hydration >70%', term: 'bassinage' }] : []),
                      ...(showOil ? [{ kind: 'step' as const, emoji: '🫒', bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
                    ];
                  } else if (mixerType === 'spiral') {
                    sequence = [
                      { kind: 'step', emoji: '🌊', bold: 'Flour + 90% of water + yeast', note: 'Speed 1, 3 min to combine' },
                      { kind: 'step', emoji: '🧂', bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
                      { kind: 'step', emoji: '🌀', bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10–15 min, stop if final dough temperature (FDT) exceeds 28°C', noteNode: <>typically 10–15 min, stop if final dough temperature (FDT)<InfoBadge term="fdt" onOpen={setLearnTerm} /> exceeds 28°C</>, term: 'pumpkin' },
                      ...(showBassinage ? [{ kind: 'step' as const, emoji: '💧', bold: 'Once pumpkin is stable, add remaining water gradually', note: 'wait for pumpkin to reform after each addition', term: 'bassinage' }] : []),
                      ...(showOil ? [{ kind: 'step' as const, emoji: '🫒', bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
                    ];
                  } else {
                    // no_knead
                    sequence = [
                      { kind: 'step', emoji: '🌊', bold: 'Combine all ingredients including salt', note: 'mix just until no dry flour remains, ~2 min' },
                      { kind: 'step', emoji: '⏰', bold: 'Cover and rest', note: 'stretch & folds every 30 min for first 2 hours' },
                      { kind: 'step', emoji: '💡', bold: 'Time does the work', note: 'no kneading needed' },
                    ];
                  }

                  let stepCount = 0;

                  return (
                    <div style={{
                      marginTop: '.65rem',
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '.7rem .9rem',
                      background: 'var(--warm)',
                    }}>
                      <div style={{
                        fontSize: '.68rem', fontWeight: 600, color: 'var(--smoke)',
                        textTransform: 'uppercase', letterSpacing: '.07em',
                        fontFamily: 'var(--font-dm-mono)', marginBottom: '.55rem',
                      }}>
                        Mixing order
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                        {sequence.map((s, i) => {
                          if (s.kind === 'rest') {
                            return (
                              <div key={i} style={{
                                marginLeft: '1.5rem',
                                background: 'var(--cream)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '.45rem .7rem',
                                display: 'flex', gap: '.5rem', alignItems: 'baseline',
                              }}>
                                <span style={{ fontSize: '.8rem', flexShrink: 0 }}>⏳</span>
                                <span style={{ fontSize: '.76rem', lineHeight: 1.5 }}>
                                  <strong style={{ color: 'var(--char)' }}>{s.label}</strong>
                                  {s.term && <InfoBadge term={s.term} onOpen={setLearnTerm} />}
                                  {' '}
                                  <em style={{ color: 'var(--smoke)', fontStyle: 'italic' }}>— {s.noteNode ?? s.note}</em>
                                </span>
                              </div>
                            );
                          }
                          stepCount += 1;
                          const n = stepCount;
                          return (
                            <div key={i} style={{ display: 'flex', gap: '.55rem', alignItems: 'baseline' }}>
                              <span style={{
                                fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)',
                                color: 'var(--smoke)', flexShrink: 0, minWidth: '14px',
                              }}>
                                {n}.
                              </span>
                              <span style={{ fontSize: '.8rem', flexShrink: 0 }}>{s.emoji}</span>
                              <span style={{ fontSize: '.76rem', lineHeight: 1.5 }}>
                                <strong style={{ color: 'var(--char)' }}>{s.bold}</strong>
                                {s.term && <InfoBadge term={s.term} onOpen={setLearnTerm} />}
                                {' '}
                                <em style={{ color: 'var(--smoke)', fontStyle: 'italic' }}>— {s.noteNode ?? s.note}</em>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Step sub-label */}
                {(item.stepKind === 'cold' || item.stepKind === 'bulk_ferm' || item.stepKind === 'final_proof' || item.stepKind === 'rest_rt') && th.cardBg && (
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
                    {item.stepKind === 'bulk_ferm' && `Bulk fermentation · ${hoursLabel(item.durationH ?? 0)}`}
                    {item.stepKind === 'final_proof' && `Final proof window · ${hoursLabel(item.durationH ?? 0)}`}
                    {item.stepKind === 'rest_rt' && `Room temperature · ${hoursLabel(item.durationH ?? 0)}`}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {learnTerm && (
        <LearnModal term={learnTerm} onClose={() => setLearnTerm(null)} />
      )}
    </div>
  );
}
