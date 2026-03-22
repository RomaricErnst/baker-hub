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
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '.75rem',
    }}>
      {(Object.entries(OVEN_TYPES) as [OvenType, typeof OVEN_TYPES[OvenType]][]).map(([key, oven]) => {
        const isSelected = selected === key;
        const imgSrc = (oven as { image?: string }).image;
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
                alt={oven.name}
                style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '10px', marginBottom: '.6rem' }}
              />
            ) : (
              <span style={{ fontSize: '2rem', marginBottom: '.6rem' }}>{oven.emoji}</span>
            )}
            <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.25rem', color: 'var(--char)' }}>
              {oven.name}
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.45, marginBottom: '.5rem' }}>
              {oven.desc}
            </div>
            <div style={{
              fontSize: '.68rem', color: 'var(--terra)',
              fontFamily: 'var(--font-dm-mono)',
              background: '#FEF4EF', borderRadius: '6px',
              padding: '.25rem .5rem',
            }}>
              {oven.tempNote}
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
