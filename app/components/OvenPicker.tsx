'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { OVEN_TYPES, BREAD_OVEN_TYPES, type AnyOvenType } from '../data';

// Ovens to EXCLUDE per bread style — truly incompatible (geometry or technique)
// wood_fired is NOT excluded anywhere — lower temp works for all styles
const BREAD_OVEN_EXCLUDES: Record<string, string[]> = {
  baguette:      ['dutch_oven'],
  fougasse:      ['dutch_oven'],
  brioche:       ['dutch_oven', 'home_oven_stone_bread'],
  pain_mie:      ['dutch_oven', 'home_oven_stone_bread'],
  pain_viennois: ['dutch_oven', 'home_oven_stone_bread'],
  pain_seigle:   ['dutch_oven', 'home_oven_stone_bread'],
};

interface OvenPickerProps {
  bakeType: 'pizza' | 'bread';
  styleKey?: string | null;
  selected: AnyOvenType | null;
  onSelect: (oven: AnyOvenType) => void;
}

export default function OvenPicker({ bakeType, styleKey, selected, onSelect }: OvenPickerProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const locale = useLocale();

  const allEntries = bakeType === 'bread'
    ? Object.entries(BREAD_OVEN_TYPES)
    : Object.entries(OVEN_TYPES);

  const excluded = bakeType === 'bread' && styleKey
    ? (BREAD_OVEN_EXCLUDES[styleKey] ?? [])
    : [];

  const visibleEntries = showAll
    ? allEntries
    : allEntries.filter(([key]) => !excluded.includes(key));

  const hiddenCount = allEntries.length - visibleEntries.length;

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '.75rem',
      }}>
        {visibleEntries.map(([key, oven]) => {
          const isSelected = selected === key;
          const o = oven as {
            name: string; nameFr?: string; emoji: string; image?: string;
            desc: string; descFr?: string;
          };
          const imgSrc = o.image;
          const displayName = locale === 'fr' && o.nameFr ? o.nameFr : o.name;
          const displayDesc = locale === 'fr' && o.descFr ? o.descFr : o.desc;
          return (
            <div
              key={key}
              onClick={() => onSelect(key as AnyOvenType)}
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
                  alt={o.name}
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', marginBottom: '.6rem' }}
                />
              ) : (
                <span style={{ fontSize: '2rem', marginBottom: '.6rem' }}>{o.emoji}</span>
              )}
              <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.25rem', color: 'var(--char)' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.45 }}>
                {displayDesc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Escape hatch — show hidden options with honest label */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginTop: '.75rem',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.72rem', color: 'var(--smoke)',
            fontFamily: 'var(--font-dm-mono)', padding: 0,
            textDecoration: 'underline', textUnderlineOffset: '2px',
          }}
        >
          Show {hiddenCount} more option{hiddenCount > 1 ? 's' : ''} (not typical for this style)
        </button>
      )}
    </div>
  );
}
