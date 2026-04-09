'use client';
import { useState } from 'react';
import {
  type AvailabilityBlock,
  type ScheduleResult,
  formatTime,
  hoursLabel,
} from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
import { StepIcon, IconProof } from './StepIcons';
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
  feedTime?: Date | null;
  kitchenTemp?: number;
  onStartBaking?: () => void;
  prefStartTime?: Date | null;
  prefermentType?: string;
  prefGoesInFridge?: boolean;
  prefRemoveFromFridgeTime?: Date | null;
}

// ── Step kinds ────────────────────────────────
type StepKind = 'feed_starter' | 'make_preferment' | 'mixing' | 'bulk_ferm' | 'divide_ball' | 'final_proof' | 'cold' | 'rest_rt' | 'rt_warmup' | 'preheat' | 'eat';

interface TimelineStep {
  kind: 'step';
  id: string;
  stepKind: StepKind;
  time: Date;
  label: string;
  tip: string;
  icon: string;
  iconKey: string;
  durationH: number | null;
  coldBlocks?: AvailabilityBlock[];
}

// ── Visual themes per step kind ───────────────
const THEME: Record<StepKind, {
  dot: string; ring: string; line: string;
  pill: string; pillText: string;
  cardBg?: string; cardBorder?: string;
}> = {
  feed_starter:    { dot: '#6A7FA8', ring: 'rgba(106,127,168,0.1)', line: '#C4CDE0', pill: '#EEF2FA', pillText: '#3A5A8A', cardBg: '#EEF2FA', cardBorder: '#C4CDE0' },
  make_preferment: { dot: '#C4A030', ring: 'rgba(196,160,48,0.12)', line: '#E8D890', pill: '#FDFBF2', pillText: '#7A5A10', cardBg: '#FDFBF2', cardBorder: '#E8D890' },
  mixing:      { dot: 'var(--ash)',    ring: 'rgba(61,53,48,.1)',    line: 'var(--border)', pill: 'var(--cream)',  pillText: 'var(--ash)' },
  bulk_ferm:   { dot: 'var(--terra)',  ring: 'rgba(196,82,42,.1)',   line: '#F5C4B0',       pill: '#FEF4EF',      pillText: 'var(--terra)', cardBg: '#FEF8F5', cardBorder: '#F5C4B0' },
  divide_ball: { dot: '#8A6A4A',       ring: 'rgba(138,106,74,.1)',  line: '#D4B898',       pill: '#FDF4EA',      pillText: '#6A3A10' },
  final_proof: { dot: '#7A8C6E',       ring: 'rgba(122,140,110,.1)', line: '#C8D4BA',       pill: '#F2F5EF',      pillText: '#4A5A44', cardBg: '#F5F7F2', cardBorder: '#C8D4BA' },
  cold:        { dot: '#6A7FA8',       ring: 'rgba(106,127,168,.1)', line: '#C4CDE0',       pill: '#EEF2FA',      pillText: '#3A5A8A', cardBg: '#EEF2FA', cardBorder: '#C4CDE0' },
  rest_rt:     { dot: '#B87850',       ring: 'rgba(184,120,80,.1)',  line: '#DDB898',       pill: '#FDF0E8',      pillText: '#7A3A10', cardBg: '#FDF4EE', cardBorder: '#DDB898' },
  rt_warmup:   { dot: '#B87850',       ring: 'rgba(184,120,80,.1)',  line: '#DDB898',       pill: '#FDF0E8',      pillText: '#7A3A10', cardBg: '#FDF4EE', cardBorder: '#DDB898' },
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
  feedTime?: Date | null,
  kitchenTemp?: number,
  isSourdough?: boolean,
  prefStartTime?: Date | null,
  prefermentType?: string,
  prefGoesInFridge?: boolean,
  prefRemoveFromFridgeTime?: Date | null,
): TimelineStep[] {
  const items: TimelineStep[] = [];

  // 0a — Make Poolish / Biga (when prefStartTime provided)
  if (prefStartTime && (prefermentType === 'poolish' || prefermentType === 'biga')) {
    const isPoolish = prefermentType === 'poolish';
    items.push({
      kind: 'step', id: 'make_preferment', stepKind: 'make_preferment',
      time: prefStartTime,
      label: isPoolish ? 'Make your Poolish' : 'Make your Biga',
      icon: isPoolish ? '🏺' : '🧱',
      iconKey: 'preferment',
      tip: isPoolish
        ? (prefGoesInFridge
            ? 'Mix equal weight flour and water (100% hydration) with a pinch of yeast. Stir until combined. Cover tightly and place in the fridge immediately — remove from fridge at the time shown in the next step.'
            : 'Mix equal weight flour and water (100% hydration) with a pinch of yeast. Stir until no dry flour remains. Leave at room temperature — it peaks when domed and bubbly. Mix your dough immediately at peak.')
        : 'Combine flour, water and a tiny amount of yeast (0.1–0.2%). Mix roughly — biga is intentionally shaggy, not smooth. Cover and place in the fridge until the removal step.',
      durationH: null,
    });
  }

  // 0a2 — Remove Poolish / Biga from Fridge (fridge protocol only)
  if (prefGoesInFridge && prefRemoveFromFridgeTime && prefStartTime &&
      (prefermentType === 'poolish' || prefermentType === 'biga')) {
    const temp = kitchenTemp ?? 20;
    // Push remove time out of any blocker (same pattern as dough warmup)
    let removeTime = new Date(prefRemoveFromFridgeTime);
    let safety = 0;
    while (safety++ < 10) {
      const inBlock = blocks.find(b => removeTime >= b.from && removeTime < b.to);
      if (!inBlock) break;
      // Push earlier by blocker duration (extend RT warmup)
      removeTime = new Date(inBlock.from.getTime() - 15 * 60000);
    }
    const warmupH = (schedule.bulkFermStart.getTime() - removeTime.getTime()) / 3600000;
    items.push({
      kind: 'step', id: 'remove_pref_fridge', stepKind: 'rest_rt',
      time: removeTime,
      label: prefermentType === 'biga' ? 'Remove Biga from fridge' : 'Remove Poolish from fridge',
      icon: '🌡️',
      iconKey: 'proof',
      tip: prefermentType === 'biga'
        ? `Take your biga out of the fridge and leave covered at room temperature for ~${warmupH.toFixed(1)}h. It will reach its peak just as you start mixing.`
        : temp >= 28
        ? `Take your poolish out of the fridge. At ${temp}°C it will reach peak in ~${warmupH.toFixed(1)}h — mix your dough when it peaks.`
        : `Take your poolish out of the fridge and leave covered at room temperature for ~${warmupH.toFixed(1)}h. It peaks when the surface is domed and bubbly — mix immediately.`,
      durationH: warmupH,
    });
  }

  // 0b — Feed Starter (sourdough only, when feedTime provided)
  if (feedTime && isSourdough) {
    const temp = kitchenTemp ?? 20;
    const tip = temp >= 28
      ? `Feed equal weights starter + flour + water. At ${temp}°C your starter peaks in 3-5h — watch for dome + bubbles.`
      : temp >= 24
      ? `Feed equal weights starter + flour + water. Peaks in 4-6h at ${temp}°C.`
      : 'Feed equal weights starter + flour + water. Peaks in 6-10h at room temperature.';
    items.push({
      kind: 'step', id: 'feed_starter', stepKind: 'feed_starter',
      time: feedTime,
      label: 'Feed your starter',
      icon: '🫙',
      iconKey: 'starter',
      tip,
      durationH: null,
    });
  }
  const kneadMin = MIXER_TYPES[mixerType].kneadMin;
  const isTwoPhase = schedule.coldRetard2Start !== null;

  // Divide & ball duration
  const extraBalls = Math.max(0, numItems - 4);
  const divideMin  = 15 + 2 * extraBalls;
  const divideH    = divideMin / 60;

  // Bulk ferm tip — dynamic based on bulkFermHours
  function bulkFermTip(bulkH: number): string {
    if (bulkH >= 2) {
      return 'Cover tightly and place in a warm spot away from drafts. Perform 4 sets of stretch & folds in the first 2 hours, every 30 minutes.';
    } else if (bulkH >= 1) {
      return 'Cover tightly. Perform 2–3 sets of stretch & folds every 20–30 minutes.';
    } else if (bulkH >= 0.5) {
      return 'Cover tightly. Perform one set of stretch & folds after 15 minutes, then cover and rest.';
    } else {
      return 'Cover tightly and rest — dough goes straight to the fridge after this short window.';
    }
  }

  // Divide & ball tip
  function divideBallTip(): string {
    let tip = `Weigh and divide dough into ${numItems} ball${numItems !== 1 ? 's' : ''}. Pinch the bottom tight for a smooth, taut skin.`;
    if (schedule.coldRetard1Start) {
      tip += ' Cold dough is easier to ball — work quickly before it warms up.';
    }
    if (schedule.kitchenTemp >= 30 && schedule.coldRetard1Start) {
      tip += ' ⚠️ Your kitchen is warm — get balls back in the fridge within 20 minutes.';
    }
    return tip;
  }

  // 1 — Mix & Knead
  items.push({
    kind: 'step', id: 'mixing', stepKind: 'mixing',
    time: startTime,
    label: 'Mix & Knead',
    icon: '🤌',
    iconKey: 'mix',
    tip: isSourdough
      ? 'Combine flour and water, then add your starter. Add salt with the remaining water. Mix until fully absorbed.'
      : mixerType === 'hand'
      ? 'Flour + 90% water first — cover and rest 20 min (autolyse). Then yeast, salt, remaining water, and knead 8–12 min until the windowpane test passes.'
      : mixerType === 'spiral'
      ? 'Flour + water + yeast at Speed 1. Add salt, then Speed 2 until pumpkin shape forms and the windowpane test passes.'
      : mixerType === 'no_knead'
      ? 'Combine all ingredients and mix until no dry flour remains — time and stretch & folds do the rest.'
      : 'Flour + water at Speed 1. Add yeast, then salt, then remaining water. Speed 2 until dough clears the bowl and passes the windowpane test.',
    durationH: kneadMin > 0 ? kneadMin / 60 : null,
  });

  // 2 — Bulk Fermentation
  if (schedule.bulkFermHours > 0) {
    items.push({
      kind: 'step', id: 'bulk_ferm', stepKind: 'bulk_ferm',
      time: schedule.bulkFermStart,
      label: 'Bulk Fermentation',
      icon: '🌡️',
      iconKey: 'bulk',
      tip: bulkFermTip(schedule.bulkFermHours),
      durationH: schedule.bulkFermHours,
    });
  }

  if (isTwoPhase) {
    // ── TWO-PHASE SEQUENCE ──────────────────────────────────────

    // 3 — Cold Retard 1 (bulk cold)
    if (schedule.coldRetard1Start && schedule.coldRetard1End) {
      const cold1DurationH = Math.max(0,
        (schedule.coldRetard1End.getTime() - schedule.coldRetard1Start.getTime()) / 3600000
      );
      const coldBlocks1 = blocks
        .filter(b => b.from < schedule.coldRetard1End! && b.to > schedule.coldRetard1Start!)
        .sort((a, b) => a.from.getTime() - b.from.getTime());
      items.push({
        kind: 'step', id: 'cold_1', stepKind: 'cold',
        time: schedule.coldRetard1Start,
        label: 'Cold Retard — Bulk',
        icon: '❄️',
        iconKey: 'cold',
        tip: 'Whole dough mass goes into the fridge. Cold bulk fermentation slows yeast activity and develops flavour. No action needed.',
        durationH: cold1DurationH,
        coldBlocks: coldBlocks1,
      });
    }

    // 4 — Divide & Ball (at divideBallTime)
    items.push({
      kind: 'step', id: 'divide_ball', stepKind: 'divide_ball',
      time: schedule.divideBallTime,
      label: 'Divide & Ball',
      icon: '⚖️',
      iconKey: 'divide',
      tip: divideBallTip(),
      durationH: divideH,
    });

    // 5 — Cold Retard 2 (balls cold)
    if (schedule.coldRetard2Start && schedule.coldRetard2End) {
      const cold2DurationH = Math.max(0,
        (schedule.coldRetard2End.getTime() - schedule.coldRetard2Start.getTime()) / 3600000
      );
      const coldBlocks2 = blocks
        .filter(b => b.from < schedule.coldRetard2End! && b.to > schedule.coldRetard2Start!)
        .sort((a, b) => a.from.getTime() - b.from.getTime());
      items.push({
        kind: 'step', id: 'cold_2', stepKind: 'cold',
        time: schedule.coldRetard2Start,
        label: 'Cold Retard — Balls',
        icon: '❄️',
        iconKey: 'cold',
        tip: 'Individual dough balls rest in the fridge. This firms them up and makes final proofing more controlled.',
        durationH: cold2DurationH,
        coldBlocks: coldBlocks2,
      });
    }

    // rt_warmup merged into Final Proof step below

  } else {
    // ── SINGLE-PHASE SEQUENCE ───────────────────────────────────

    // 3 — Cold Retard (whole dough mass goes in fridge first)
    if (schedule.coldRetard1Start && schedule.coldRetard1End) {
      const coldDurationH = Math.max(0,
        (schedule.coldRetard1End.getTime() - schedule.coldRetard1Start.getTime()) / 3600000
      );
      const coldBlocks = blocks
        .filter(b => b.from < schedule.coldRetard1End! && b.to > schedule.coldRetard1Start!)
        .sort((a, b) => a.from.getTime() - b.from.getTime());
      items.push({
        kind: 'step', id: 'cold', stepKind: 'cold',
        time: schedule.coldRetard1Start,
        label: 'Cold Retard',
        icon: '❄️',
        iconKey: 'cold',
        tip: 'Dough rests in the fridge. Cold fermentation builds flavour slowly — no action needed, time works for you.',
        durationH: coldDurationH,
        coldBlocks,
      });
    }

    // rest_rt merged into Final Proof step below

    // 5 — Divide & Ball (after rest)
    items.push({
      kind: 'step', id: 'divide_ball', stepKind: 'divide_ball',
      time: schedule.divideBallTime,
      label: 'Divide & Ball',
      icon: '⚖️',
      iconKey: 'divide',
      tip: divideBallTip(),
      durationH: divideH,
    });
  }

  // Final Proof — merged with warmup/rest. Starts when dough comes out of fridge.
  // Duration runs to bakeStart (preheat overlaps with end of proof).
  const finalProofStepStart =
    schedule.rtWarmupStart ??
    (schedule.restRtHours > 0 ? schedule.coldRetardEnd : null) ??
    schedule.finalProofStart;
  const finalProofStepDuration = finalProofStepStart
    ? Math.max(0, (schedule.bakeStart.getTime() - finalProofStepStart.getTime()) / 3600000)
    : schedule.finalProofHours;
  if (finalProofStepDuration > 0 || schedule.finalProofHours > 0) {
    items.push({
      kind: 'step', id: 'final_proof', stepKind: 'final_proof',
      time: finalProofStepStart ?? schedule.finalProofStart,
      label: 'Final Proof',
      icon: '⏰',
      iconKey: 'proof',
      tip: schedule.coldRetardStart
        ? 'Remove balls from fridge and rest until slightly soft, then proof covered at room temperature. Start preheating your oven during the final proof — poke test tells you when to bake.'
        : 'Shape dough balls and proof covered at room temperature. Start preheating your oven during the final proof — poke test tells you when to bake.',
      durationH: finalProofStepDuration,
    });
  }

  // Preheat Oven
  items.push({
    kind: 'step', id: 'preheat', stepKind: 'preheat',
    time: schedule.preheatStart,
    label: 'Preheat Oven',
    icon: '🔥',
    iconKey: 'preheat',
    tip: preheatMin >= 45
      ? `Start now — while dough finishes its final proof. Give it the full ${preheatMin} min to fully saturate your baking surface.`
      : `Start now — while dough finishes its final proof. Set oven to maximum temperature for ${preheatMin} minutes.`,
    durationH: preheatMin / 60,
  });

  // Bake & Eat!
  items.push({
    kind: 'step', id: 'eat', stepKind: 'eat',
    time: schedule.bakeStart,
    label: 'Bake & Eat!',
    icon: '🎉',
    iconKey: 'bake',
    tip: 'Your dough is perfectly fermented. Score, load, and bake. Buon appetito!',
    durationH: null,
  });

  return items;
}

// ── Build phase summary ───────────────────────
interface Phase {
  label: string;
  icon: string;
  iconKey: string;
  durationH: number;
  stepKind: StepKind;
}

function buildPhases(schedule: ScheduleResult, preheatMin: number): Phase[] {
  const phases: Phase[] = [
    { label: 'Mixing', icon: '🤌', iconKey: 'mix', durationH: schedule.mixingDurationH || 5 / 60, stepKind: 'mixing' },
  ];

  if (schedule.bulkFermHours > 0) {
    phases.push({ label: 'Bulk Fermentation', icon: '🌡️', iconKey: 'bulk', durationH: schedule.bulkFermHours, stepKind: 'bulk_ferm' });
  }

  if (schedule.coldRetardHours > 0) {
    phases.push({ label: 'Cold Retard', icon: '❄️', iconKey: 'cold', durationH: schedule.coldRetardHours, stepKind: 'cold' });
  }

  // Final Proof phase includes warmup. Preheat overlaps — not shown as a separate phase.
  const warmupH = schedule.rtWarmupStart && schedule.rtWarmupEnd
    ? Math.max(0, (schedule.rtWarmupEnd.getTime() - schedule.rtWarmupStart.getTime()) / 3600000)
    : (schedule.restRtHours ?? 0);
  const totalProofPhaseH = warmupH + schedule.finalProofHours;
  if (totalProofPhaseH > 0) {
    phases.push({ label: 'Final Proof', icon: '⏰', iconKey: 'proof', durationH: totalProofPhaseH, stepKind: 'final_proof' });
  }

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
  schedule, blocks, preheatMin, startTime, eatTime, mixerType, styleKey, oil, hydration, numItems, feedTime, kitchenTemp, onStartBaking, prefStartTime, prefermentType, prefGoesInFridge, prefRemoveFromFridgeTime,
}: TimelineProps) {
  const [learnTerm, setLearnTerm] = useState<string | null>(null);

  const isSourdough = styleKey === 'sourdough' || styleKey === 'pain_levain';

  const items  = buildItems(schedule, blocks, startTime, eatTime, preheatMin, mixerType, numItems, feedTime, kitchenTemp, isSourdough, prefStartTime, prefermentType, prefGoesInFridge, prefRemoveFromFridgeTime);
  const phases = buildPhases(schedule, preheatMin);

  const lastStepId = items[items.length - 1]?.id;

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
            Your baking protocol
          </div>
          <div style={{ fontSize: '.75rem', color: 'var(--smoke)', marginTop: '.1rem', fontFamily: 'var(--font-dm-mono)' }}>
            {formatTime(startTime)} → {formatTime(eatTime)}
            {' · '}{hoursLabel((eatTime.getTime() - startTime.getTime()) / 3600000)} total
          </div>
        </div>

        {/* Start Bake Guide button removed — baker uses tab navigation instead */}
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
                <span style={{ width: '22px', height: '22px', marginBottom: '.2rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--char)' }}>
                  <StepIcon iconKey={phase.iconKey} size={20} />
                </span>
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
                    <span style={{ width: '18px', height: '18px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: th.dot }}>
                      <StepIcon iconKey={item.iconKey} size={16} />
                    </span>
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
                    ? schedule.coldRetard2Start !== null
                      ? <>Balls are already shaped — cover and leave at room temperature until the poke test<InfoBadge term="poke_test" onOpen={setLearnTerm} /> confirms ready.</>
                      : <>Shape your balls if not done. Cover and leave at room temperature until the poke test<InfoBadge term="poke_test" onOpen={setLearnTerm} /> confirms ready.</>
                    : item.stepKind === 'divide_ball'
                    ? <>{item.tip}</>
                    : item.tip}
                </div>

                {/* Mixing sequence — shown on mixing step only */}
                {item.stepKind === 'mixing' && (() => {
                  const showOil = oil > 0;
                  const showBassinage = hydration > 70;

                  type SeqItem =
                    | { kind: 'step'; iconKey: string; bold: string; note: string; noteNode?: React.ReactNode; term?: string }
                    | { kind: 'rest'; label: string; note: string; noteNode?: React.ReactNode; term?: string };

                  let sequence: SeqItem[] = [];

                  if (isSourdough) {
                    sequence = [
                      { kind: 'step', iconKey: 'water', bold: 'Flour + 90% of water', note: 'mix 2 min until no dry flour remains' },
                      { kind: 'step', iconKey: 'starter', bold: 'Add starter', note: 'mix to combine' },
                      { kind: 'step', iconKey: 'salt', bold: 'Add salt + remaining 10% water', note: 'mix until fully absorbed' },
                      ...(showOil ? [{ kind: 'step' as const, iconKey: 'oil', bold: 'Add oil last', note: 'oil added late preserves gluten structure' }] : []),
                    ];
                  } else if (mixerType === 'hand') {
                    sequence = [
                      { kind: 'step', iconKey: 'water', bold: 'Flour + 90% of water', note: 'mix until no dry flour remains, ~2 min' },
                      { kind: 'rest', label: 'Cover and rest 20 min', note: 'flour absorbs water naturally, reduces kneading time', term: 'autolyse' },
                      { kind: 'step', iconKey: 'yeast', bold: 'Add yeast', note: 'mix to combine, 2 min' },
                      { kind: 'step', iconKey: 'salt', bold: 'Add salt', note: 'mix until absorbed, 2 min' },
                      ...(showBassinage
                        ? [{ kind: 'step' as const, iconKey: 'water', bold: 'Add remaining 10% water gradually', note: 'bassinage — small additions, wait for absorption between each', term: 'bassinage' }]
                        : [{ kind: 'step' as const, iconKey: 'water', bold: 'Add remaining 10% water', note: 'mix until absorbed, ~1 min' }]
                      ),
                      ...(showOil ? [{ kind: 'step' as const, iconKey: 'oil', bold: 'Add oil last', note: 'mix 1 min' }] : []),
                      { kind: 'step', iconKey: 'knead', bold: 'Knead 8–12 min until smooth and elastic', note: 'windowpane test', term: 'windowpane' },
                    ];
                  } else if (mixerType === 'stand') {
                    sequence = showBassinage ? [
                      // >70% hydration: build structure first, then bassinage at Speed 2
                      { kind: 'step', iconKey: 'water', bold: 'Flour + 90% of water', note: 'Speed 1, 2 min to combine' },
                      { kind: 'step', iconKey: 'yeast', bold: 'Add yeast', note: 'Speed 1, 2 min' },
                      { kind: 'step', iconKey: 'salt', bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
                      { kind: 'step', iconKey: 'mix', bold: 'Speed 2 — 4–5 min', note: 'build gluten structure before adding remaining water' },
                      { kind: 'step', iconKey: 'water', bold: 'Add remaining 10% water gradually at Speed 2', note: 'bassinage — small additions, wait for absorption between each', term: 'bassinage' },
                      { kind: 'step', iconKey: 'mix', bold: 'Continue Speed 2', note: 'until dough clears the bowl and passes windowpane test', term: 'windowpane' },
                      ...(showOil ? [{ kind: 'step' as const, iconKey: 'oil', bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
                    ] : [
                      // ≤70% hydration: remaining water before Speed 2
                      { kind: 'step', iconKey: 'water', bold: 'Flour + 90% of water', note: 'Speed 1, 2 min to combine' },
                      { kind: 'step', iconKey: 'yeast', bold: 'Add yeast', note: 'Speed 1, 2 min' },
                      { kind: 'step', iconKey: 'salt', bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
                      { kind: 'step', iconKey: 'water', bold: 'Add remaining 10% water', note: 'Speed 1, mix until absorbed, ~1 min' },
                      { kind: 'step', iconKey: 'mix', bold: 'Speed 2 — 6–10 min', note: 'until dough clears the bowl and passes windowpane test', term: 'windowpane' },
                      ...(showOil ? [{ kind: 'step' as const, iconKey: 'oil', bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
                    ];
                  } else if (mixerType === 'spiral') {
                    sequence = showBassinage ? [
                      // >70% hydration: pumpkin first, then bassinage
                      { kind: 'step', iconKey: 'water', bold: 'Flour + 90% of water + yeast', note: 'Speed 1, 3 min to combine' },
                      { kind: 'step', iconKey: 'salt', bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
                      { kind: 'step', iconKey: 'mix', bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10–15 min, stop if FDT exceeds 28°C', noteNode: <>typically 10–15 min, stop if final dough temperature (FDT)<InfoBadge term="fdt" onOpen={setLearnTerm} /> exceeds 28°C</>, term: 'pumpkin' },
                      { kind: 'step', iconKey: 'water', bold: 'Once pumpkin is stable — add remaining 10% water gradually', note: 'bassinage — small additions, wait for pumpkin to reform each time', term: 'bassinage' },
                      ...(showOil ? [{ kind: 'step' as const, iconKey: 'oil', bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
                    ] : [
                      // ≤70% hydration: remaining water before Speed 2
                      { kind: 'step', iconKey: 'water', bold: 'Flour + 90% of water + yeast', note: 'Speed 1, 3 min to combine' },
                      { kind: 'step', iconKey: 'salt', bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
                      { kind: 'step', iconKey: 'water', bold: 'Add remaining 10% water', note: 'Speed 1, mix until absorbed, ~1 min' },
                      { kind: 'step', iconKey: 'mix', bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10–15 min, stop if FDT exceeds 28°C', noteNode: <>typically 10–15 min, stop if final dough temperature (FDT)<InfoBadge term="fdt" onOpen={setLearnTerm} /> exceeds 28°C</>, term: 'pumpkin' },
                      ...(showOil ? [{ kind: 'step' as const, iconKey: 'oil', bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
                    ];
                  } else {
                    // no_knead
                    sequence = [
                      { kind: 'step', iconKey: 'water', bold: 'Combine all ingredients including salt', note: 'mix just until no dry flour remains, ~2 min' },
                      { kind: 'step', iconKey: 'proof', bold: 'Cover and rest', note: 'stretch & folds every 30 min for first 2 hours' },
                      { kind: 'step', iconKey: 'bulk', bold: 'Time does the work', note: 'no kneading needed' },
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
                                <span style={{ width: '16px', height: '16px', flexShrink: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--smoke)' }}>
                                  <IconProof size={14} />
                                </span>
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
                              <span style={{ width: '16px', height: '16px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--terra)' }}>
                                <StepIcon iconKey={(s as { iconKey: string }).iconKey} size={14} />
                              </span>
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
                {(item.stepKind === 'cold' || item.stepKind === 'bulk_ferm' || item.stepKind === 'final_proof' || item.stepKind === 'rest_rt' || item.stepKind === 'rt_warmup') && th.cardBg && (
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
                    {item.stepKind === 'rt_warmup' && `Room temperature warmup · ${hoursLabel(item.durationH ?? 0)}`}
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
