'use client';
import { useState } from 'react';
import { MIXER_TYPES, type MixerType } from '../data';

interface MixerPickerProps {
  selected: MixerType | null;
  onSelect: (mixer: MixerType) => void;
}

export default function MixerPicker({ selected, onSelect }: MixerPickerProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '.75rem',
    }}>
      {(Object.entries(MIXER_TYPES) as [MixerType, typeof MIXER_TYPES[MixerType]][]).map(([key, mixer]) => {
        const isSelected = selected === key;
        const imgSrc = (mixer as { image?: string }).image;
        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              border: `2px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: '18px',
              padding: '1rem .75rem',
              cursor: 'pointer',
              background: isSelected ? '#FFF8F3' : 'var(--warm)',
              transition: 'all .25s',
              boxShadow: hoveredKey === key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
              transform: hoveredKey === key ? 'translateY(-3px)' : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            }}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={mixer.name}
                style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', marginBottom: '.6rem' }}
              />
            ) : (
              <span style={{ fontSize: '2rem', marginBottom: '.6rem' }}>{mixer.emoji}</span>
            )}
            <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.25rem', color: 'var(--char)' }}>
              {mixer.name}
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.45, marginBottom: '.5rem' }}>
              {mixer.desc}
            </div>
            <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{
                fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                background: isSelected ? '#FCDECE' : '#F5F7F0',
                color: isSelected ? 'var(--terra)' : 'var(--smoke)',
                borderRadius: '5px', padding: '.2rem .4rem',
              }}>
                max {mixer.maxHydration === 100 ? '∞' : `${mixer.maxHydration}%`}
              </span>
              <span style={{
                fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                background: isSelected ? '#FCDECE' : '#F5F7F0',
                color: isSelected ? 'var(--terra)' : 'var(--smoke)',
                borderRadius: '5px', padding: '.2rem .4rem',
              }}>
                {mixer.folds}× folds
              </span>
            </div>
            {isSelected && (
              <div style={{ marginTop: '.5rem', color: 'var(--terra)', fontSize: '.8rem', fontWeight: 600 }}>✓</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
