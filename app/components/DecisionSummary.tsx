'use client';
import { useTranslations } from 'next-intl';

interface DecisionSummaryProps {
  thumbnail: string;
  title: string;
  tagline: string;
  onExpand: () => void;
}

export default function DecisionSummary({ thumbnail, title, tagline, onExpand }: DecisionSummaryProps) {
  const t = useTranslations('decisionSummary');

  return (
    <div
      onClick={onExpand}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        background: 'white',
        boxShadow: '0 2px 8px rgba(26,22,18,0.06)',
        cursor: 'pointer',
      }}
    >
      <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#1A1612' }}>
        <img src={thumbnail} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 600, color: 'var(--char)' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--smoke)' }}>
          {tagline}
        </div>
      </div>
      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: '10px',
        color: 'var(--terra)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        flexShrink: 0,
      }}>
        {t('change')}
      </div>
    </div>
  );
}
