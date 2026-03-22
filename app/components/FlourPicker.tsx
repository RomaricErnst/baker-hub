'use client';
import { useState } from 'react';

export type FlourCategory = 'allpurpose' | 'bread' | 'pizza00' | 'strong00';

const FLOUR_OPTIONS: {
  key: FlourCategory;
  emoji: string;
  name: string;
  sub: string;
}[] = [
  { key: 'pizza00',    emoji: '⭐', name: 'Pizza flour 00',            sub: 'Italian 00 — ideal for most pizza and bread styles' },
  { key: 'strong00',   emoji: '💪', name: 'Strong 00 W270+',          sub: 'Best for long cold ferments — maximum flavour'      },
  { key: 'bread',      emoji: '🌾', name: 'Bread flour / T65',        sub: 'Good gluten, reliable results'                      },
  { key: 'allpurpose', emoji: '🏠', name: 'All-purpose / T55',        sub: 'Works fine, slightly less structure'                },
];

interface FlourPickerProps {
  selected: FlourCategory;
  onSelect: (cat: FlourCategory) => void;
}

export default function FlourPicker({ selected, onSelect }: FlourPickerProps) {
  const [hovered, setHovered] = useState<FlourCategory | null>(null);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '.75rem',
    }}>
      {FLOUR_OPTIONS.map(opt => {
        const isSelected = selected === opt.key;
        return (
          <div
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            onMouseEnter={() => setHovered(opt.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              border: `1.5px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '.85rem 1rem',
              cursor: 'pointer',
              background: isSelected ? '#FFF8F3' : 'var(--warm)',
              transition: 'all .2s',
              boxShadow: hovered === opt.key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
              transform: hovered === opt.key ? 'translateY(-2px)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.3rem' }}>
              <span style={{ fontSize: '1.3rem' }}>{opt.emoji}</span>
              <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--char)', flex: 1 }}>
                {opt.name}
              </div>
              {isSelected && (
                <span style={{ color: 'var(--terra)', fontSize: '.85rem' }}>✓</span>
              )}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.45, paddingLeft: '1.9rem' }}>
              {opt.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
