'use client';
import { useState } from 'react';
import { PREFERMENT_TYPES, type PrefermentType } from '../data';
import { useLocale } from 'next-intl';

interface PrefermentPickerProps {
  selected: PrefermentType;
  onSelect: (type: PrefermentType) => void;
  styleKey?: string;
}

export default function PrefermentPicker({ selected, onSelect, styleKey }: PrefermentPickerProps) {
  const locale = useLocale();
  const isFr = locale === 'fr';
  const [hovered, setHovered] = useState<PrefermentType | null>(null);

  const types = Object.entries(PREFERMENT_TYPES) as [PrefermentType, typeof PREFERMENT_TYPES[PrefermentType]][];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '.75rem',
    }}>
      {types.map(([key, p]) => {
        const isSelected = selected === key;
        const isNone = key === 'none';
        const isRecommended = !isNone && styleKey && (p as { bestFor?: string[] }).bestFor?.includes(styleKey);
        const pData = p as {
          name: string; nameFr: string; emoji: string;
          desc: string; descFr: string;
          flourPct?: number; hydration?: number;
          fermentHoursMin?: number; fermentHoursMax?: number;
          cold?: boolean;
          bestFor?: string[];
        };

        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: 'relative',
              border: `1.5px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: '14px',
              padding: '1rem',
              cursor: 'pointer',
              background: isSelected ? '#FFF8F3' : 'var(--warm)',
              transition: 'all .2s',
              boxShadow: hovered === key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
              transform: hovered === key ? 'translateY(-2px)' : 'none',
            }}
          >
            {/* Recommended badge */}
            {isRecommended && (
              <div style={{
                position: 'absolute', top: '.6rem', right: '.6rem',
                fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                background: 'rgba(212,168,83,0.15)',
                color: 'var(--gold)', border: '1px solid rgba(212,168,83,0.3)',
                borderRadius: '20px', padding: '.15rem .5rem',
              }}>
                ✨ Recommended
              </div>
            )}

            {/* Emoji */}
            <div style={{ fontSize: '2rem', marginBottom: '.5rem', lineHeight: 1 }}>
              {pData.emoji}
            </div>

            {/* Name + check */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '.3rem', gap: '.4rem',
            }}>
              <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--char)' }}>
                {isFr ? pData.nameFr : pData.name}
              </div>
              {isSelected && <span style={{ color: 'var(--terra)', fontSize: '.85rem', flexShrink: 0 }}>✓</span>}
            </div>

            {/* Desc */}
            {isNone ? (
              <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.45, marginBottom: '.3rem' }}>
                {isFr ? pData.descFr : pData.desc}
              </div>
            ) : (
              <>
                <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.45, marginBottom: '.55rem' }}>
                  {isFr ? pData.descFr : pData.desc}
                </div>
                {/* Pills */}
                <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                    background: 'var(--cream)', color: 'var(--ash)',
                    borderRadius: '20px', padding: '.1rem .45rem',
                    border: '1px solid var(--border)',
                  }}>
                    {pData.flourPct}% flour
                  </span>
                  <span style={{
                    fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                    background: 'var(--cream)', color: 'var(--ash)',
                    borderRadius: '20px', padding: '.1rem .45rem',
                    border: '1px solid var(--border)',
                  }}>
                    {pData.hydration}% hydration
                  </span>
                  <span style={{
                    fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                    background: 'var(--cream)', color: 'var(--ash)',
                    borderRadius: '20px', padding: '.1rem .45rem',
                    border: '1px solid var(--border)',
                  }}>
                    {pData.fermentHoursMin}–{pData.fermentHoursMax}h
                  </span>
                  {pData.cold && (
                    <span style={{
                      fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                      background: '#EEF6FF', color: '#4A78A8',
                      borderRadius: '20px', padding: '.1rem .45rem',
                      border: '1px solid #B0CDE8',
                    }}>
                      ❄️ Cold ferment
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
