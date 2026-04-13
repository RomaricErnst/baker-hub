'use client';
import { useState } from 'react';
import { PREFERMENT_TYPES, type PrefermentType } from '../data';
import { useLocale, useTranslations } from 'next-intl';

interface PrefermentPickerProps {
  selected: PrefermentType;
  onSelect: (type: PrefermentType) => void;
  flourPct?: number;
  onFlourPctChange?: (pct: number) => void;
  styleKey?: string;
  hideTypes?: PrefermentType[];
  kitchenTemp?: number;
}


export default function PrefermentPicker({
  selected, onSelect, flourPct, onFlourPctChange,
  styleKey, hideTypes = [], kitchenTemp,
}: PrefermentPickerProps) {
  const locale = useLocale();
  const isFr = locale === 'fr';
  const t = useTranslations();
  const [hovered, setHovered] = useState<PrefermentType | null>(null);

  const types = (Object.entries(PREFERMENT_TYPES) as [PrefermentType, typeof PREFERMENT_TYPES[PrefermentType]][])
    .filter(([key]) => !hideTypes.includes(key));

  return (
    <>
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
          name: string; nameFr: string; emoji: string; image?: string;
          desc: string; descFr: string;
          flourPct?: number; hydration?: number;
          fermentHoursMin?: number; fermentHoursMax?: number;
          cold?: boolean;
          bestFor?: string[];
          flourPctMin?: number; flourPctMax?: number; flourPctStep?: number;
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

            {/* Horizontal layout: image left, text right */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              {/* Image — left, fixed size */}
              <div style={{ flexShrink: 0 }}>
                {pData.image ? (
                  <img
                    src={pData.image}
                    alt={pData.name}
                    style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '10px' }}
                  />
                ) : (
                  <div style={{ width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                    {pData.emoji}
                  </div>
                )}
              </div>

              {/* Text — right */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + checkmark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--char)' }}>
                    {isFr ? pData.nameFr : pData.name}
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.45 }}>
                  {isFr ? pData.descFr : pData.desc}
                </div>
              </div>
            </div>

            {/* Pills: hydration always shown, cold ferment for biga only */}
            {isSelected && !isNone && (
              <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '.6rem' }}>
                {pData.hydration && (
                  <span style={{
                    fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                    background: 'var(--cream)', color: 'var(--ash)',
                    borderRadius: '20px', padding: '.1rem .45rem',
                    border: '1px solid var(--border)',
                  }}>
                    {pData.hydration}% {t('preferment.hydration')}
                  </span>
                )}
                {pData.cold && (
                  <span style={{
                    fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                    background: 'rgba(107,122,90,0.1)', color: 'var(--sage)',
                    borderRadius: '20px', padding: '.1rem .45rem',
                    border: '1px solid rgba(107,122,90,0.25)',
                  }}>
                    {t('preferment.coldFerment')}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}
