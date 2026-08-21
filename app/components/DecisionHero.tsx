'use client';

interface DecisionHeroProps {
  image: string;
  title: string;
  tagline: string;
  isSelected: boolean;
  onSelect: () => void;
  size?: 'large' | 'small';
  badge?: string;
}

export default function DecisionHero({
  image, title, tagline, isSelected, onSelect, size = 'large', badge,
}: DecisionHeroProps) {
  const isLarge = size === 'large';
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
      }}
      style={{
        position: 'relative',
        border: isSelected ? '2px solid var(--gold)' : '1px solid var(--border)',
        borderRadius: isLarge ? '16px' : '14px',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 2px 14px rgba(26,22,18,0.12)',
      }}
    >
      <img
        src={image}
        alt={title}
        style={{ width: '100%', height: isLarge ? '230px' : '150px', objectFit: 'cover', display: 'block' }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to top, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.15) 55%, transparent 75%)',
      }} />
      {badge && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          fontFamily: 'var(--font-dm-mono)',
          fontSize: '11px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          background: 'rgba(255,255,255,0.92)',
          color: 'var(--char)',
          padding: '4px 8px',
          borderRadius: '20px',
        }}>
          {badge}
        </div>
      )}
      <div style={{
        position: 'absolute',
        left: isLarge ? '16px' : '12px',
        right: isLarge ? '16px' : '12px',
        bottom: isLarge ? '14px' : '10px',
      }}>
        <div style={{
          fontFamily: 'var(--font-playfair)',
          fontWeight: 800,
          fontSize: isLarge ? '30px' : '20px',
          lineHeight: 1.05,
          color: 'white',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: 'var(--font-dm-sans)',
          fontSize: isLarge ? '13.5px' : '11.5px',
          color: 'rgba(255,255,255,0.82)',
          marginTop: '4px',
        }}>
          {tagline}
        </div>
      </div>
      {isLarge && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          width: '32px',
          height: '32px',
          background: 'var(--gold)',
          borderRadius: '50%',
          color: '#2B2420',
          fontSize: '17px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          ›
        </div>
      )}
    </div>
  );
}
