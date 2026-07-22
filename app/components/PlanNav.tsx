'use client';

import { useTranslations } from 'next-intl';

/* ── PlanNav ──────────────────────────────────────────────
   The one navigation component of the Recipe tab. Rendered twice:
   below the recipe cards (variant "quiet" — the protocol continues
   below, nothing should shout) and below the protocol (variant "cta"
   — end of the page, the single terra CTA of the screen).
   Same geometry in both slots; only emphasis changes. */

interface PlanNavProps {
  variant: 'quiet' | 'cta';
  onEditSetup?: () => void;
  onOpenGuide?: () => void;
}

const PILL_BASE: React.CSSProperties = {
  flex: 1,
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: '1px',
  padding: '.55rem 0',
  borderRadius: '12px',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
};

const LABEL_ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  fontSize: '.85rem', fontWeight: 500,
};

export default function PlanNav({ variant, onEditSetup, onOpenGuide }: PlanNavProps) {
  const t = useTranslations('planNav');
  const cta = variant === 'cta';

  if (!onEditSetup && !onOpenGuide) return null;

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {onEditSetup && (
        <button
          onClick={onEditSetup}
          style={{
            ...PILL_BASE,
            border: '1.5px solid var(--border)',
            background: 'var(--warm)',
            color: 'var(--ash)',
          }}
        >
          <span style={LABEL_ROW}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--smoke)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7" /><circle cx="9" cy="7" r="2.2" fill="var(--warm)" />
              <line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.2" fill="var(--warm)" />
            </svg>
            {t('editSetup')}
          </span>
        </button>
      )}
      {onOpenGuide && (
        <button
          onClick={onOpenGuide}
          style={{
            ...PILL_BASE,
            border: cta ? 'none' : '1.5px solid var(--border)',
            background: cta ? 'var(--terra)' : 'var(--warm)',
            color: cta ? '#fff' : 'var(--ash)',
            padding: '.4rem 0',
          }}
        >
          <span style={LABEL_ROW}>
            {t('guide')}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={cta ? '#fff' : 'var(--smoke)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="12" x2="20" y2="12" /><polyline points="13 5 20 12 13 19" />
            </svg>
          </span>
          <span style={{
            fontFamily: 'var(--font-dm-mono)', fontSize: '.62rem',
            color: cta ? 'rgba(255,255,255,0.75)' : 'var(--smoke)',
          }}>
            {t('guideSub')}
          </span>
        </button>
      )}
    </div>
  );
}
