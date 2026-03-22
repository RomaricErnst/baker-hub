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
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '.75rem',
    }}>
      {(Object.entries(MIXER_TYPES) as [MixerType, typeof MIXER_TYPES[MixerType]][]).map(([key, mixer]) => {
        const isSelected = selected === key;
        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              border: `2px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: '18px',
              padding: '1.5rem',
              cursor: 'pointer',
              background: isSelected ? '#FFF8F3' : 'var(--warm)',
              transition: 'all .25s',
              boxShadow: hoveredKey === key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
              transform: hoveredKey === key ? 'translateY(-3px)' : 'none',
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
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
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
                {mixer.folds}× folds
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
