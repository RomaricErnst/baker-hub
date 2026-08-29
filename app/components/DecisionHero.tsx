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
          fontFamily: 'var(--font-ui)',
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
          fontFamily: 'var(--font-ui)',
          fontWeight: 800,
          fontSize: isLarge ? '30px' : '20px',
          lineHeight: 1.05,
          color: 'white',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: isLarge ? '13.5px' : '11.5px',
          color: 'rgba(255,255,255,0.82)',
          marginTop: '4px',
        }}>
          {tagline}
        </div>
      </div>
      {/* No gold disc on the large card. The whole card is the tap target and
          the four smaller ones directly beneath prove that reads without help
          — they carry no chevron and nobody hesitates over them. It was also
          the loudest gold on the screen, competing with the badge for the
          same corner of attention, against a palette that spends accent
          sparingly on purpose. */}
    </div>
  );
}
