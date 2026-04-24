'use client';

interface DecisionHeroProps {
  image: string;
  title: string;
  tagline: string;
  isSelected: boolean;
  onSelect: () => void;
}

export default function DecisionHero({ image, title, tagline, isSelected, onSelect }: DecisionHeroProps) {
  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative',
        border: isSelected ? '2px solid var(--gold)' : '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(26,22,18,0.08)',
      }}
    >
      <img
        src={image}
        alt={title}
        style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 60%)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '16px',
        fontFamily: 'Playfair Display, serif',
        fontSize: '24px',
        fontWeight: 700,
        color: 'white',
      }}>
        {title}
      </div>
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '16px',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '13px',
        fontStyle: 'italic',
        color: 'rgba(255,255,255,0.9)',
      }}>
        {tagline}
      </div>
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        width: '32px',
        height: '32px',
        background: 'var(--gold)',
        borderRadius: '50%',
        color: '#1A1612',
        fontSize: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        ›
      </div>
    </div>
  );
}
