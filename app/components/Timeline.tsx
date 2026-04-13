'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  icon?: string;
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
  hydration?: number,
  oil?: number,
  t: (key: string, params?: Record<string, string | number>) => string = (k) => k,
): TimelineStep[] {
  const items: TimelineStep[] = [];

  // 0a — Make Poolish / Biga (when prefStartTime provided)
  if (prefStartTime && (prefermentType === 'poolish' || prefermentType === 'biga')) {
    const isPoolish = prefermentType === 'poolish';
    items.push({
      kind: 'step', id: 'make_preferment', stepKind: 'make_preferment',
      time: prefStartTime,
      label: isPoolish ? t('timeline.prefSteps.makePoolish') : t('timeline.prefSteps.makeBiga'),
      iconKey: 'preferment',
      tip: isPoolish
        ? (prefGoesInFridge
            ? t('timeline.prefSteps.tipPoolishFridge')
            : t('timeline.prefSteps.tipPoolishRT'))
        : t('timeline.prefSteps.tipBiga'),
      durationH: null,
    });
  }

  // 0a2 — Remove Poolish / Biga from Fridge (fridge protocol only)
  if (prefGoesInFridge && prefRemoveFromFridgeTime && prefStartTime &&
      (prefermentType === 'poolish' || prefermentType === 'biga')) {
    const temp = kitchenTemp ?? 20;
    // Poolish: push removal AFTER any blocker — never before.
    // Biga: no warmup needed, use straight from fridge, no adjustment.
    let removeTime = new Date(prefRemoveFromFridgeTime);
    if (prefermentType === 'poolish') {
      let safety = 0;
      while (safety++ < 10) {
        const inBlock = blocks.find(b => removeTime >= b.from && removeTime < b.to);
        if (!inBlock) break;
        removeTime = new Date(inBlock.to);
      }
      if (removeTime >= schedule.bulkFermStart) removeTime = new Date(prefRemoveFromFridgeTime);
    }
    // Duration = time until Mix & Knead starts (not until bulk ferm starts).
    // The poolish is used at mix time — it warms during mixing, not after.
    const mixStartMs = schedule.bulkFermStart.getTime() - (schedule.mixingDurationH ?? 0.25) * 3600000;
    const warmupHRaw = (mixStartMs - removeTime.getTime()) / 3600000;
    const warmupH = Math.max(0, Math.round(warmupHRaw * 4) / 4); // round to nearest 15 min
    const idealWarmupH = temp >= 28 ? 1.5 : temp >= 24 ? 2 : 2.5;
    const warmupShort = prefermentType === 'poolish' && warmupH < idealWarmupH * 0.6;
    items.push({
      kind: 'step', id: 'remove_pref_fridge', stepKind: 'mixing',
      time: removeTime,
      label: prefermentType === 'biga' ? t('timeline.prefSteps.removeBiga') : t('timeline.prefSteps.removePoolish'),
      iconKey: 'preferment',
      tip: prefermentType === 'biga'
        ? t('timeline.prefSteps.tipRemoveBiga')
        : warmupShort
        ? t('timeline.prefSteps.tipRemovePoolishShort')
        : `${t('timeline.prefSteps.removePoolish')} — ${warmupH.toFixed(1)}h à ${temp}°C.`,
      durationH: warmupH > 0 ? warmupH : null,
    });
  }

  // 0b — Feed Starter (sourdough only, when feedTime provided)
  if (feedTime && isSourdough) {
    const temp = kitchenTemp ?? 20;
    const tip = temp >= 28
      ? t('timeline.prefSteps.tipFeedHot', { temp: `${temp}°C` })
      : temp >= 24
      ? t('timeline.prefSteps.tipFeedWarm', { temp: `${temp}°C` })
      : t('timeline.prefSteps.tipFeedRT');
    items.push({
      kind: 'step', id: 'feed_starter', stepKind: 'feed_starter',
      time: feedTime,
      label: t('timeline.prefSteps.feedStarter'),
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
    if (bulkH >= 2) return t('timeline.bulkTips.long');
    if (bulkH >= 1) return t('timeline.bulkTips.medium');
    if (bulkH >= 0.5) return t('timeline.bulkTips.short');
    return t('timeline.bulkTips.veryShort');
  }

  // Divide & ball tip
  function divideBallTip(): string {
    let tip = t('timeline.divideTip', { n: numItems, plural: numItems !== 1 ? 's' : '' });
    if (schedule.coldRetard1Start) {
      tip += t('timeline.divideTipCold');
    }
    if (schedule.kitchenTemp >= 30 && schedule.coldRetard1Start) {
      tip += t('timeline.divideTipWarm');
    }
    const h = hydration ?? 0;
    const o = oil ?? 0;
    if (h >= 70) {
      if (o > 0) {
        tip += ' — Lightly oiled hands work best for this enriched dough. Coat your hands and the proofing container with neutral oil — never flour, which hydrates instantly and makes things stickier.';
      } else if (h >= 75) {
        tip += ` — At ${h}% hydration, sticky is normal. Keep a bowl of water nearby and wet your hands before handling — never use bench flour. Use a bench scraper to lift pieces. Move quickly and with confidence.`;
      } else {
        tip += ` — Wet hands prevent sticking at this hydration. Keep a small bowl of water nearby and dip your hands before each touch. Avoid bench flour — it hydrates instantly and makes things worse.`;
      }
    }
    return tip;
  }

  // 1 — Mix & Knead
  items.push({
    kind: 'step', id: 'mixing', stepKind: 'mixing',
    time: startTime,
    label: t('timeline.steps.mixing'),
    icon: '🤌',
    iconKey: 'mix',
    tip: isSourdough
      ? t('timeline.mixTips.sourdough')
      : mixerType === 'hand'
      ? t('timeline.mixTips.hand')
      : mixerType === 'spiral'
      ? t('timeline.mixTips.spiral')
      : mixerType === 'no_knead'
      ? t('timeline.mixTips.noKnead')
      : t('timeline.mixTips.stand'),
    durationH: kneadMin > 0 ? kneadMin / 60 : null,
  });

  // 2 — Bulk Fermentation
  if (schedule.bulkFermHours > 0) {
    items.push({
      kind: 'step', id: 'bulk_ferm', stepKind: 'bulk_ferm',
      time: schedule.bulkFermStart,
      label: t('timeline.steps.bulkFerm'),
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
        label: t('timeline.steps.coldBulk'),
        icon: '❄️',
        iconKey: 'cold',
        tip: t('timeline.coldTips.bulk'),
        durationH: cold1DurationH,
        coldBlocks: coldBlocks1,
      });
    }

    // 4 — Divide & Ball (at divideBallTime)
    items.push({
      kind: 'step', id: 'divide_ball', stepKind: 'divide_ball',
      time: schedule.divideBallTime,
      label: t('timeline.steps.divideBall'),
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
        label: t('timeline.steps.coldBalls'),
        icon: '❄️',
        iconKey: 'cold',
        tip: t('timeline.coldTips.balls'),
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
        label: t('timeline.steps.coldBulk'),
        icon: '❄️',
        iconKey: 'cold',
        tip: t('timeline.coldTips.single'),
        durationH: coldDurationH,
        coldBlocks,
      });
    }

    // rest_rt merged into Final Proof step below

    // 5 — Divide & Ball (after rest)
    items.push({
      kind: 'step', id: 'divide_ball', stepKind: 'divide_ball',
      time: schedule.divideBallTime,
      label: t('timeline.steps.divideBall'),
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
  // Show warmup + actual proof window only — preheat is parallel/independent.
  const warmupStepH = schedule.rtWarmupStart && schedule.rtWarmupEnd
    ? Math.max(0, (schedule.rtWarmupEnd.getTime() - schedule.rtWarmupStart.getTime()) / 3600000)
    : (schedule.restRtHours ?? 0);
  const finalProofStepDuration = warmupStepH + schedule.finalProofHours;
  if (finalProofStepDuration > 0 || schedule.finalProofHours > 0) {
    items.push({
      kind: 'step', id: 'final_proof', stepKind: 'final_proof',
      time: finalProofStepStart ?? schedule.finalProofStart,
      label: t('timeline.steps.finalProof'),
      icon: '⏰',
      iconKey: 'proof',
      tip: schedule.coldRetardStart
        ? t('timeline.finalProofTips.withCold')
        : t('timeline.finalProofTips.withoutCold'),
      durationH: finalProofStepDuration,
    });
  }

  // Preheat Oven
  items.push({
    kind: 'step', id: 'preheat', stepKind: 'preheat',
    time: schedule.preheatStart,
    label: t('timeline.steps.preheat'),
    icon: '🔥',
    iconKey: 'preheat',
    tip: preheatMin >= 45
      ? t('timeline.preheatTips.long', { min: preheatMin })
      : t('timeline.preheatTips.short', { min: preheatMin }),
    durationH: preheatMin / 60,
  });

  // Bake & Eat!
  items.push({
    kind: 'step', id: 'eat', stepKind: 'eat',
    time: schedule.bakeStart,
    label: t('timeline.steps.eat'),
    icon: '🎉',
    iconKey: 'bake',
    tip: t('timeline.eatTip'),
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

function buildPhases(schedule: ScheduleResult, preheatMin: number, t: (key: string, params?: Record<string, string | number>) => string = (k) => k): Phase[] {
  const phases: Phase[] = [
    { label: t('timeline.phaseLabels.mixing'), icon: '🤌', iconKey: 'mix', durationH: schedule.mixingDurationH || 5 / 60, stepKind: 'mixing' },
  ];

  if (schedule.bulkFermHours > 0) {
    phases.push({ label: t('timeline.phaseLabels.bulkFerm'), icon: '🌡️', iconKey: 'bulk', durationH: schedule.bulkFermHours, stepKind: 'bulk_ferm' });
  }

  if (schedule.coldRetardHours > 0) {
    phases.push({ label: t('timeline.phaseLabels.coldRetard'), icon: '❄️', iconKey: 'cold', durationH: schedule.coldRetardHours, stepKind: 'cold' });
  }

  // Final Proof phase includes warmup. Preheat overlaps — not shown as a separate phase.
  const warmupH = schedule.rtWarmupStart && schedule.rtWarmupEnd
    ? Math.max(0, (schedule.rtWarmupEnd.getTime() - schedule.rtWarmupStart.getTime()) / 3600000)
    : (schedule.restRtHours ?? 0);
  const totalProofPhaseH = warmupH + schedule.finalProofHours;
  if (totalProofPhaseH > 0) {
    phases.push({ label: t('timeline.phaseLabels.finalProof'), icon: '⏰', iconKey: 'proof', durationH: totalProofPhaseH, stepKind: 'final_proof' });
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
  const t = useTranslations();

  const isSourdough = styleKey === 'sourdough' || styleKey === 'pain_levain';

  const items  = buildItems(schedule, blocks, startTime, eatTime, preheatMin, mixerType, numItems, feedTime, kitchenTemp, isSourdough, prefStartTime, prefermentType, prefGoesInFridge, prefRemoveFromFridgeTime, hydration, oil, t);
  const phases = buildPhases(schedule, preheatMin, t);

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

      {/* Auto-adjust banner removed — the app adapting to your kitchen is the promise, not a warning. */}

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
                  {item.id === 'remove_pref_fridge'
                    ? item.tip
                    : item.stepKind === 'rest_rt'
                    ? <>{t('timeline.restRtTip')}</>
                    : item.stepKind === 'final_proof'
                    ? schedule.coldRetard2Start !== null
                      ? <>{t('timeline.finalProofCovered')}<InfoBadge term="poke_test" onOpen={setLearnTerm} /></>
                      : <>{t('timeline.finalProofShape')}<InfoBadge term="poke_test" onOpen={setLearnTerm} /></>
                    : item.stepKind === 'divide_ball'
                    ? <>{item.tip}</>
                    : item.tip}
                </div>

                {/* Mixing sequence — shown on Mix & Knead step only, not Remove Poolish */}
                {item.id === 'mixing' && (() => {
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
                      { kind: 'step', iconKey: 'mix', bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10–15 min, stop if FDT exceeds 28°C', noteNode: <>typically 10–15 min, stop if final dough temperature (FDT)<InfoBadge term="fdt" onOpen={setLearnTerm} /> exceeds 28°C</> },
                      { kind: 'step', iconKey: 'water', bold: 'Once pumpkin is stable — add remaining 10% water gradually', note: 'bassinage — small additions, wait for pumpkin to reform each time', term: 'bassinage' },
                      ...(showOil ? [{ kind: 'step' as const, iconKey: 'oil', bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
                    ] : [
                      // ≤70% hydration: remaining water before Speed 2
                      { kind: 'step', iconKey: 'water', bold: 'Flour + 90% of water + yeast', note: 'Speed 1, 3 min to combine' },
                      { kind: 'step', iconKey: 'salt', bold: 'Add salt', note: 'Speed 1, 2 min until absorbed' },
                      { kind: 'step', iconKey: 'water', bold: 'Add remaining 10% water', note: 'Speed 1, mix until absorbed, ~1 min' },
                      { kind: 'step', iconKey: 'mix', bold: 'Speed 2 until pumpkin shape forms', note: 'typically 10–15 min, stop if FDT exceeds 28°C', noteNode: <>typically 10–15 min, stop if final dough temperature (FDT)<InfoBadge term="fdt" onOpen={setLearnTerm} /> exceeds 28°C</> },
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
                    {item.stepKind === 'bulk_ferm' && t('timeline.blockLabels.bulkFerm', { dur: hoursLabel(item.durationH ?? 0) })}
                    {item.stepKind === 'final_proof' && t('timeline.blockLabels.finalProof', { dur: hoursLabel(schedule.finalProofHours) })}
                    {item.stepKind === 'rest_rt' && item.id !== 'remove_pref_fridge' && t('timeline.blockLabels.roomTemp', { dur: hoursLabel(item.durationH ?? 0) })}
                    {item.id === 'remove_pref_fridge' && item.durationH && item.durationH > 0 && t('timeline.blockLabels.warmup', { dur: hoursLabel(item.durationH ?? 0) })}
                    {item.stepKind === 'rt_warmup' && t('timeline.blockLabels.rtWarmup', { dur: hoursLabel(item.durationH ?? 0) })}
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
