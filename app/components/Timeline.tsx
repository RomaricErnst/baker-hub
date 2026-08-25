'use client';
import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
  bakeType?: string;
  recipe?: import('../utils').RecipeResult | null;
}

// ── Step kinds ────────────────────────────────
export type StepKind = 'feed_starter' | 'make_preferment' | 'mixing' | 'bulk_ferm' | 'divide_ball' | 'final_proof' | 'cold' | 'rest_rt' | 'rt_warmup' | 'preheat' | 'eat';

interface TimelineStep {
  kind: 'step';
  id: string;
  stepKind: StepKind;
  time: Date;
  label: string;
  tip?: string;
  icon?: string;
  iconKey: string;
  durationH: number | null;
  coldBlocks?: AvailabilityBlock[];
}

// ── Visual themes per step kind ───────────────
export const THEME: Record<StepKind, {
  dot: string; ring: string; line: string;
  pill: string; pillText: string;
  cardBg?: string; cardBorder?: string;
}> = {
  feed_starter:    { dot: '#6A7FA8', ring: 'rgba(106,127,168,0.1)', line: '#C4CDE0', pill: '#EEF2FA', pillText: '#3A5A8A', cardBg: '#EEF2FA', cardBorder: '#C4CDE0' },
  make_preferment: { dot: '#C4A030', ring: 'rgba(196,160,48,0.12)', line: '#E8D890', pill: '#FDFBF2', pillText: '#7A5A10', cardBg: '#FDFBF2', cardBorder: '#E8D890' },
  mixing:      { dot: 'var(--ash)',    ring: 'rgba(61,53,48,.1)',    line: 'var(--border)', pill: 'var(--cream)',  pillText: 'var(--ash)' },
  bulk_ferm:   { dot: 'var(--terra)',  ring: 'rgba(107, 68, 35,.1)',   line: '#F5C4B0',       pill: '#FEF4EF',      pillText: 'var(--terra)', cardBg: '#FEF8F5', cardBorder: '#F5C4B0' },
  divide_ball: { dot: '#8A6A4A',       ring: 'rgba(138,106,74,.1)',  line: '#D4B898',       pill: '#FDF4EA',      pillText: '#6A3A10' },
  final_proof: { dot: '#7A8C6E',       ring: 'rgba(122,140,110,.1)', line: '#C8D4BA',       pill: '#F2F5EF',      pillText: '#4A5A44', cardBg: '#F5F7F2', cardBorder: '#C8D4BA' },
  cold:        { dot: '#6A7FA8',       ring: 'rgba(106,127,168,.1)', line: '#C4CDE0',       pill: '#EEF2FA',      pillText: '#3A5A8A', cardBg: '#EEF2FA', cardBorder: '#C4CDE0' },
  rest_rt:     { dot: '#B87850',       ring: 'rgba(184,120,80,.1)',  line: '#DDB898',       pill: '#FDF0E8',      pillText: '#7A3A10', cardBg: '#FDF4EE', cardBorder: '#DDB898' },
  rt_warmup:   { dot: '#B87850',       ring: 'rgba(184,120,80,.1)',  line: '#DDB898',       pill: '#FDF0E8',      pillText: '#7A3A10', cardBg: '#FDF4EE', cardBorder: '#DDB898' },
  preheat:     { dot: '#C4A030',       ring: 'rgba(196,160,48,.12)', line: '#E8D890',       pill: '#FDFBF2',      pillText: '#7A5A10' },
  eat:         { dot: '#5A9A50',       ring: 'rgba(90,154,80,.1)',   line: 'transparent',   pill: '#F2FAF0',      pillText: '#3A6A30' },
};

// ── Build timeline steps ──────────────────────
export function buildItems(
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
  bakeType?: string,
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
    // Removal time comes from the engine (utils.requiredPrefWarmupH) — it is no
    // longer nudged around here. Two policies used to fight: this file silently
    // pushed removal past a blocker (shortening the warm-up without telling
    // anyone) while the plan card asked the baker to move Start Dough. The
    // solver now scores warm-up clearance itself, and taking a container out of
    // the fridge is a five-second action that does not need a free window.
    const removeTime = new Date(prefRemoveFromFridgeTime);
    // Duration = time until Mix & Knead starts (not until bulk ferm starts).
    // The poolish is used at mix time — it warms during mixing, not after.
    const mixStartMs = schedule.bulkFermStart.getTime() - (schedule.mixingDurationH ?? 0.25) * 3600000;
    const warmupHRaw = (mixStartMs - removeTime.getTime()) / 3600000;
    const warmupH = Math.max(0, Math.round(warmupHRaw * 4) / 4); // round to nearest 15 min
    // Zero warm-up for a poolish means it goes from fridge straight into the
    // mix (water temperature carries the dough to target) — no step to show.
    if (prefermentType === 'biga' || warmupH > 0) {
      items.push({
        kind: 'step', id: 'remove_pref_fridge', stepKind: 'mixing',
        time: removeTime,
        label: prefermentType === 'biga' ? t('timeline.prefSteps.removeBiga') : t('timeline.prefSteps.removePoolish'),
        iconKey: 'preferment',
        tip: prefermentType === 'biga'
          ? t('timeline.prefSteps.tipRemoveBiga')
          : t('timeline.prefSteps.tipRemovePoolish', {
              dur: hoursLabel(warmupH), temp: `${temp}°C`,
            }),
        durationH: warmupH > 0 ? warmupH : null,
      });
    }
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
      icon: '',
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
    const _bread = bakeType === 'bread';
    let tip = t(_bread ? 'timeline.divideTipBread' : 'timeline.divideTip', { n: numItems, plural: numItems !== 1 ? 's' : '' });
    if (schedule.coldRetard1Start) {
      tip += t(_bread ? 'timeline.divideTipColdBread' : 'timeline.divideTipCold');
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
    icon: '',
    iconKey: 'mix',
    // No tip here: the full mixing walkthrough renders right below on the
    // Protocole tab — repeating a one-liner above it was redundant (tester).
    durationH: kneadMin > 0 ? kneadMin / 60 : null,
  });

  // 2 — Bulk Fermentation
  if (schedule.bulkFermHours > 0) {
    items.push({
      kind: 'step', id: 'bulk_ferm', stepKind: 'bulk_ferm',
      time: schedule.bulkFermStart,
      label: t('timeline.steps.bulkFerm'),
      icon: '',
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
        icon: '',
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
      label: t(bakeType === 'bread' ? 'timeline.steps.divideShape' : 'timeline.steps.divideBall'),
      icon: '',
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
        label: t(bakeType === 'bread' ? 'timeline.steps.coldShaped' : 'timeline.steps.coldBalls'),
        icon: '',
        iconKey: 'cold',
        tip: t(bakeType === 'bread' ? 'timeline.coldTips.shaped' : 'timeline.coldTips.balls'),
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
        icon: '',
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
      label: t(bakeType === 'bread' ? 'timeline.steps.divideShape' : 'timeline.steps.divideBall'),
      icon: '',
      iconKey: 'divide',
      tip: divideBallTip(),
      durationH: divideH,
    });
  }

  // Final Proof — merged with warmup/rest. Starts when dough comes out of fridge.
  // Duration runs to bakeStart (preheat overlaps with end of proof).
  const finalProofStepStartRaw =
    schedule.rtWarmupStart ??
    (schedule.restRtHours > 0 ? schedule.coldRetardEnd : null) ??
    schedule.finalProofStart;
  // Express plans stamped Divide & Ball and Final Proof at the same minute —
  // proof can't start until the balls exist. Clamp the displayed start to
  // divide end (display only; total window is unchanged).
  const divideEndMs = schedule.divideBallTime
    ? schedule.divideBallTime.getTime() + divideH * 3600000
    : null;
  const finalProofStepStart = finalProofStepStartRaw && divideEndMs && finalProofStepStartRaw.getTime() < divideEndMs
    ? new Date(divideEndMs)
    : finalProofStepStartRaw;
  // Duration must match the Guide's Final Proof card: wall-clock from the
  // moment the dough is out (or shaped) to bakeStart. warmup+proofHours
  // understates whenever the schedule carries slack (blockers, rounding) —
  // the dough keeps proofing until it's baked, so the window is the truth.
  const warmupStepH = schedule.rtWarmupStart && schedule.rtWarmupEnd
    ? Math.max(0, (schedule.rtWarmupEnd.getTime() - schedule.rtWarmupStart.getTime()) / 3600000)
    : (schedule.restRtHours ?? 0);
  const proofWindowStart = finalProofStepStart ?? schedule.finalProofStart;
  const finalProofStepDuration = proofWindowStart && schedule.bakeStart
    ? Math.max(0, (schedule.bakeStart.getTime() - proofWindowStart.getTime()) / 3600000)
    : warmupStepH + schedule.finalProofHours;
  if (finalProofStepDuration > 0 || schedule.finalProofHours > 0) {
    items.push({
      kind: 'step', id: 'final_proof', stepKind: 'final_proof',
      time: finalProofStepStart ?? schedule.finalProofStart,
      label: t('timeline.steps.finalProof'),
      icon: '⏰',
      iconKey: 'proof',
      tip: schedule.coldRetardStart
        ? t(bakeType === 'bread' ? 'timeline.finalProofTipsBread.withCold' : 'timeline.finalProofTips.withCold')
        : t(bakeType === 'bread' ? 'timeline.finalProofTipsBread.withoutCold' : 'timeline.finalProofTips.withoutCold'),
      durationH: finalProofStepDuration,
    });
  }

  // Preheat Oven
  items.push({
    kind: 'step', id: 'preheat', stepKind: 'preheat',
    time: schedule.preheatStart,
    label: t('timeline.steps.preheat'),
    icon: '',
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
    icon: '',
    iconKey: 'bake',
    tip: bakeType === 'bread' ? t('timeline.eatTipBread') : t('timeline.eatTipPizza'),
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

export function buildPhases(schedule: ScheduleResult, preheatMin: number, t: (key: string, params?: Record<string, string | number>) => string = (k) => k): Phase[] {
  const phases: Phase[] = [
    { label: t('timeline.phaseLabels.mixing'), icon: '', iconKey: 'mix', durationH: schedule.mixingDurationH || 5 / 60, stepKind: 'mixing' },
  ];

  if (schedule.bulkFermHours > 0) {
    phases.push({ label: t('timeline.phaseLabels.bulkFerm'), icon: '', iconKey: 'bulk', durationH: schedule.bulkFermHours, stepKind: 'bulk_ferm' });
  }

  if (schedule.coldRetardHours > 0) {
    phases.push({ label: t('timeline.phaseLabels.coldRetard'), icon: '', iconKey: 'cold', durationH: schedule.coldRetardHours, stepKind: 'cold' });
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
        fontSize: '11px', fontWeight: 700, lineHeight: 1,
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
  schedule, blocks, preheatMin, startTime, eatTime, mixerType, styleKey, oil, hydration, numItems, feedTime, kitchenTemp, onStartBaking, prefStartTime, prefermentType, prefGoesInFridge, prefRemoveFromFridgeTime, bakeType, recipe,
}: TimelineProps) {
  const [learnTerm, setLearnTerm] = useState<string | null>(null);
  const t = useTranslations();
  const _fmtLocale = useLocale();

  const isSourdough = styleKey === 'sourdough' || styleKey === 'pain_levain';

  // Memoized — rebuilding every render made rapid state changes janky
  // (one observed full renderer freeze during fast scroll + re-render)
  // Baker-facing times live on the quarter grid — 15:22 is engine precision,
  // not kitchen time. Snap down, same convention as the Guide.
  const displayStartTime = (() => {
    const d = new Date(startTime);
    d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
    return d;
  })();

  const items = useMemo(
    () => buildItems(schedule, blocks, displayStartTime, eatTime, preheatMin, mixerType, numItems, feedTime, kitchenTemp, isSourdough, prefStartTime, prefermentType, prefGoesInFridge, prefRemoveFromFridgeTime, hydration, oil, t, bakeType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule, blocks, displayStartTime, eatTime, preheatMin, mixerType, numItems, feedTime, kitchenTemp, isSourdough, prefStartTime, prefermentType, prefGoesInFridge, prefRemoveFromFridgeTime, hydration, oil, bakeType],
  );
  const phases = useMemo(() => buildPhases(schedule, preheatMin, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule, preheatMin]);

  const lastStepId = items[items.length - 1]?.id;

  return (
    <div>

      {/* ── Header ─────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '20px',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '17px',
            fontWeight: 700, color: 'var(--char)',
          }}>
            {t('timeline.bakingProtocol')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--smoke)', marginTop: '.1rem', fontFamily: 'var(--font-ui)' }}>
            {formatTime(displayStartTime, _fmtLocale)} → {formatTime(eatTime, _fmtLocale)}
            {' · '}{hoursLabel((eatTime.getTime() - displayStartTime.getTime()) / 3600000)} total
          </div>
          {/* Quick-bake honesty note — short windows silently produced an
              express plan with no hint that it trades flavour for speed */}
          {(eatTime.getTime() - startTime.getTime()) / 3600000 <= 8 && (
            <div style={{
              marginTop: '12px', padding: '12px 16px',
              background: '#FDFBF2', border: '1px solid #E8D890',
              borderRadius: '8px', fontSize: '12px', color: '#7A5A10',
              lineHeight: 1.55,
            }}>
              {t('timeline.quickBakeNote')}
            </div>
          )}
        </div>

        {/* Start Bake Guide button removed — baker uses tab navigation instead */}
      </div>

      {/* Auto-adjust banner removed — the app adapting to your kitchen is the promise, not a warning. */}

      {/* ── Phase summary ──────────────────────── */}
      <div style={{
        display: 'flex', gap: '8px',
        overflowX: 'auto', paddingBottom: '4px',
        marginBottom: '32px',
        msOverflowStyle: 'none',
      }}>
        {phases.map((phase, i) => {
          const th = THEME[phase.stepKind];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 12px',
                border: `1.5px solid ${th.cardBorder ?? th.line}`,
                borderRadius: '16px',
                background: th.cardBg ?? 'var(--warm)',
                minWidth: '90px',
              }}>
                <span style={{ width: '22px', height: '22px', marginBottom: '.2rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--char)' }}>
                  <StepIcon iconKey={phase.iconKey} size={20} />
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--char)', textAlign: 'center', marginBottom: '4px', lineHeight: 1.3 }}>
                  {phase.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '11px',
                  background: th.pill, color: th.pillText,
                  borderRadius: '8px', padding: '.15rem 8px',
                }}>
                  {hoursLabel(phase.durationH)}
                </span>
              </div>

              {/* Connector arrow */}
              {i < phases.length - 1 && (
                <div style={{
                  width: '16px', flexShrink: 0,
                  textAlign: 'center', color: 'var(--border)',
                  fontSize: '11px',
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
            <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>

              {/* Time column */}
              <div style={{
                width: '72px', flexShrink: 0,
                textAlign: 'right', paddingTop: '.1rem',
                fontFamily: 'var(--font-ui)',
                fontSize: '11px', color: 'var(--smoke)',
                lineHeight: 1.4,
              }}>
                {formatTime(item.time, _fmtLocale)}
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
                  alignItems: 'center', gap: '8px',
                  marginBottom: '4px',
                }}>
                  <div style={{
                    fontWeight: 600, fontSize: '14px', color: 'var(--char)',
                    display: 'flex', alignItems: 'center', gap: '8px',
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
                      fontFamily: 'var(--font-ui)',
                      fontSize: '11px',
                      background: th.pill,
                      color: th.pillText,
                      borderRadius: '8px',
                      padding: '.18rem 8px',
                      flexShrink: 0,
                    }}>
                      {hoursLabel(item.durationH)}
                    </span>
                  )}
                </div>

                {/* Preferment ingredient quantities */}
                {item.id === 'make_preferment' && recipe?.preferment && (() => {
                  const { prefFlour, prefWater, prefYeastGrams } = recipe.preferment!;
                  const parts = [
                    `${Math.round(prefFlour)}g flour`,
                    `${Math.round(prefWater)}g water`,
                    prefYeastGrams > 0 ? `${prefYeastGrams.toFixed(1)}g yeast` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)', marginBottom: '8px' }}>
                      {parts}
                    </div>
                  );
                })()}

                {/* Tip — hidden entirely for steps that carry none */}
                {(item.tip || item.stepKind === 'rest_rt' || item.stepKind === 'final_proof') && (
                <div style={{
                  fontSize: '12px', color: 'var(--smoke)',
                  lineHeight: 1.6,
                }}>
                  {item.id === 'remove_pref_fridge'
                    ? item.tip
                    : item.stepKind === 'rest_rt'
                    ? <>{t(bakeType === 'bread' ? 'timeline.restRtTipBread' : 'timeline.restRtTip')}</>
                    : item.stepKind === 'final_proof'
                    ? schedule.coldRetard2Start !== null
                      ? <>{t(bakeType === 'bread' ? 'timeline.finalProofCoveredBread' : 'timeline.finalProofCovered')}<InfoBadge term="poke_test" onOpen={setLearnTerm} /></>
                      : <>{t(bakeType === 'bread' ? 'timeline.finalProofShapeBread' : 'timeline.finalProofShape')}<InfoBadge term="poke_test" onOpen={setLearnTerm} /></>
                    : item.stepKind === 'divide_ball'
                    ? <>{item.tip}</>
                    : item.tip}
                </div>
                )}


                {/* Step sub-label */}
                {(item.stepKind === 'cold' || item.stepKind === 'bulk_ferm' || item.stepKind === 'final_proof' || item.stepKind === 'rest_rt' || item.stepKind === 'rt_warmup') && th.cardBg && (
                  <div style={{
                    marginTop: '8px',
                    display: 'flex', gap: '8px', alignItems: 'center',
                    fontSize: '11px',
                    color: th.pillText,
                    fontFamily: 'var(--font-ui)',
                  }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: th.dot, flexShrink: 0,
                    }} />
                    {item.stepKind === 'cold' && `${formatTime(item.time, _fmtLocale)} → ${_fmtLocale === 'fr' ? "jusqu'\u00e0" : 'ends at'} ${formatTime(new Date(item.time.getTime() + (item.durationH ?? 0) * 3600000), _fmtLocale)}`}
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
