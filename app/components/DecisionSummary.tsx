'use client';
import { useTranslations } from 'next-intl';

interface DecisionSummaryProps {
  thumbnail?: string;
  thumbnailBg?: string;
  title: string;
  tagline: string;
  onExpand: () => void;
}

export default function DecisionSummary({ thumbnail, thumbnailBg, title, tagline, onExpand }: DecisionSummaryProps) {
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
        boxShadow: '0 2px 8px rgba(43, 36, 32,0.06)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: '44px', height: '44px',
        borderRadius: thumbnailBg ? '50%' : '8px',
        overflow: 'hidden', flexShrink: 0,
        background: thumbnailBg ?? '#2B2420',
      }}>
        {thumbnail && !thumbnailBg && (
          <img src={thumbnail} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '15px', fontWeight: 600, color: 'var(--char)' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--smoke)' }}>
          {tagline}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-dm-mono)',
        fontSize: '11px',
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
