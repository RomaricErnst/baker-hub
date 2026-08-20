'use client';

// Executive summary of the protocole — the phase strip that used to open
// the old Timeline below the recipe (mix → bulk → cold → proof, each with
// its icon, themed card and duration pill). Rendered at the top of the
// Protocole tab, above the unified step spine.

import { useTranslations } from 'next-intl';
import { type ScheduleResult, hoursLabel } from '../utils';
import { buildPhases } from './Timeline';
import { StepIcon } from './StepIcons';

export default function PhaseSummary({ schedule }: { schedule: ScheduleResult }) {
  const t = useTranslations();
  const phases = buildPhases(schedule, 0, t);
  if (phases.length === 0) return null;
  return (
    <div style={{
      display: 'flex', gap: '.35rem',
      overflowX: 'auto', paddingBottom: '.35rem',
      msOverflowStyle: 'none',
    }}>
      {phases.map((phase, i) => {
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '.55rem .85rem',
              border: '1.5px solid var(--border)',
              borderRadius: '12px',
              background: 'var(--warm)',
              minWidth: '86px',
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
                background: 'var(--cream)', color: 'var(--ash)',
                borderRadius: '10px', padding: '.15rem .5rem',
              }}>
                {hoursLabel(phase.durationH)}
              </span>
            </div>
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
  );
}
