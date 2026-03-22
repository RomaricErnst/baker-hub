'use client';
import { useState } from 'react';
import { OVEN_TYPES, type OvenType } from '../data';

interface OvenPickerProps {
  selected: OvenType | null;
  onSelect: (oven: OvenType) => void;
}

export default function OvenPicker({ selected, onSelect }: OvenPickerProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '.75rem',
    }}>
      {(Object.entries(OVEN_TYPES) as [OvenType, typeof OVEN_TYPES[OvenType]][]).map(([key, oven]) => {
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{oven.emoji}</span>
              <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--char)' }}>
                {oven.name}
              </div>
              {isSelected && (
                <span style={{ marginLeft: 'auto', color: 'var(--terra)', fontSize: '.9rem' }}>✓</span>
              )}
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--smoke)', lineHeight: 1.5, marginBottom: '.5rem' }}>
              {oven.desc}
            </div>
            <div style={{
              fontSize: '.7rem', color: 'var(--terra)',
              fontFamily: 'var(--font-dm-mono)',
              background: '#FEF4EF', borderRadius: '6px',
              padding: '.25rem .5rem', display: 'inline-block',
            }}>
              {oven.tempNote}
            </div>
          </div>
        );
      })}
    </div>
  );
}
