'use client';
import { MIXER_TYPES, type MixerType } from '../data';

interface MixerPickerProps {
  selected: MixerType | null;
  onSelect: (mixer: MixerType) => void;
}

export default function MixerPicker({ selected, onSelect }: MixerPickerProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '.75rem',
    }}>
      {(Object.entries(MIXER_TYPES) as [MixerType, typeof MIXER_TYPES[MixerType]][]).map(([key, mixer]) => {
        const isSelected = selected === key;
        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            style={{
              border: `2px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: '13px',
              padding: '1.1rem 1.2rem',
              cursor: 'pointer',
              background: isSelected ? '#FEF4EF' : 'var(--warm)',
              transition: 'all .2s',
              boxShadow: isSelected ? '0 0 0 3px rgba(196,82,42,.1)' : 'none',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{mixer.emoji}</span>
              <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--char)' }}>
                {mixer.name}
              </div>
              {isSelected && (
                <span style={{ marginLeft: 'auto', color: 'var(--terra)', fontSize: '.9rem' }}>✓</span>
              )}
            </div>

            {/* Description */}
            <div style={{ fontSize: '.76rem', color: 'var(--smoke)', lineHeight: 1.5, marginBottom: '.65rem' }}>
              {mixer.desc}
            </div>

            {/* Stats row */}
            <div style={{
              display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.65rem',
            }}>
              <span style={{
                fontSize: '.66rem', fontFamily: 'var(--font-dm-mono)',
                background: isSelected ? '#FCDECE' : 'var(--cream)',
                color: isSelected ? 'var(--terra)' : 'var(--smoke)',
                borderRadius: '5px', padding: '.2rem .45rem',
              }}>
                max {mixer.maxHydration === 100 ? '∞' : `${mixer.maxHydration}%`} hyd
              </span>
              <span style={{
                fontSize: '.66rem', fontFamily: 'var(--font-dm-mono)',
                background: isSelected ? '#FCDECE' : 'var(--cream)',
                color: isSelected ? 'var(--terra)' : 'var(--smoke)',
                borderRadius: '5px', padding: '.2rem .45rem',
              }}>
                {mixer.kneadMin === 0 ? 'no knead' : `${mixer.kneadMin} min`}
              </span>
              <span style={{
                fontSize: '.66rem', fontFamily: 'var(--font-dm-mono)',
                background: isSelected ? '#FCDECE' : 'var(--cream)',
                color: isSelected ? 'var(--terra)' : 'var(--smoke)',
                borderRadius: '5px', padding: '.2rem .45rem',
              }}>
                {mixer.folds}× folds
              </span>
            </div>

            {/* Instructions */}
            <div style={{
              fontSize: '.7rem', color: isSelected ? 'var(--terra)' : 'var(--smoke)',
              fontFamily: 'var(--font-dm-mono)',
              background: isSelected ? '#FEF4EF' : 'var(--cream)',
              border: `1px solid ${isSelected ? '#F5C4B0' : 'var(--border)'}`,
              borderRadius: '6px',
              padding: '.35rem .55rem',
              lineHeight: 1.5,
            }}>
              {mixer.instructions}
            </div>

            {/* Temperature tip */}
            {(key === 'spiral' || key === 'stand') && (
              <div style={{
                marginTop: '.5rem',
                display: 'flex', gap: '.4rem', alignItems: 'flex-start',
                fontSize: '.68rem', lineHeight: 1.5,
                color: '#3A5A8A',
                background: '#EEF2FA',
                border: '1px solid #C4CDE0',
                borderRadius: '6px',
                padding: '.35rem .55rem',
              }}>
                <span style={{ flexShrink: 0 }}>🧊</span>
                <span>
                  {key === 'spiral'
                    ? 'Hot kitchen tip: add ice cubes directly into the mixing bowl with the water — the breaker bar will break them down as mixing progresses.'
                    : 'Hot kitchen tip: use ice-cold water only — do not add ice cubes directly, they can strain the motor.'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
