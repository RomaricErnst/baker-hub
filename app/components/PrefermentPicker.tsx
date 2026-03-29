'use client';
import { useState, useEffect } from 'react';
import { PREFERMENT_TYPES, PREFERMENT_LABELS, type PrefermentType } from '../data';
import { useLocale } from 'next-intl';

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
  const [hovered, setHovered] = useState<PrefermentType | null>(null);

  const [localFlourPct, setLocalFlourPct] = useState<number>(
    flourPct ?? ((PREFERMENT_TYPES[selected] as { flourPct?: number }).flourPct ?? 50)
  );

  useEffect(() => {
    setLocalFlourPct((PREFERMENT_TYPES[selected] as { flourPct?: number }).flourPct ?? 50);
  }, [selected]);

  const types = (Object.entries(PREFERMENT_TYPES) as [PrefermentType, typeof PREFERMENT_TYPES[PrefermentType]][])
    .filter(([key]) => !hideTypes.includes(key));

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

            {/* Emoji or image */}
            {pData.image ? (
              <img
                src={pData.image}
                alt={pData.name}
                style={{
                  width: '70px',
                  height: '70px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  marginBottom: '.5rem',
                }}
              />
            ) : (
              <div style={{ fontSize: '2rem', marginBottom: '.5rem', lineHeight: 1 }}>
                {pData.emoji}
              </div>
            )}

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
                    {isSelected ? localFlourPct : pData.flourPct}% flour
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

                {/* Expanded section when selected */}
                {isSelected && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      marginTop: '.85rem',
                      borderTop: '1px solid rgba(196,82,42,0.15)',
                      paddingTop: '.75rem',
                    }}
                  >
                    {/* Ratio label row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', marginBottom: '.35rem',
                    }}>
                      <span style={{
                        fontSize: '.72rem', color: 'var(--char)',
                        fontFamily: 'var(--font-dm-mono)', fontWeight: 600,
                      }}>
                        Flour in {isFr ? pData.nameFr : pData.name}: {localFlourPct}%
                      </span>
                      <span style={{ fontSize: '.68rem', color: 'var(--smoke)', fontStyle: 'italic' }}>
                        {PREFERMENT_LABELS[key]?.(localFlourPct)}
                      </span>
                    </div>

                    {/* Slider */}
                    <input
                      type="range"
                      min={pData.flourPctMin ?? 10}
                      max={pData.flourPctMax ?? 80}
                      step={pData.flourPctStep ?? 5}
                      value={localFlourPct}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setLocalFlourPct(v);
                        onFlourPctChange?.(v);
                      }}
                      style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer' }}
                    />
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '.6rem', color: 'var(--smoke)',
                      fontFamily: 'var(--font-dm-mono)', marginTop: '.1rem',
                    }}>
                      <span>Less complex</span><span>More complex</span>
                    </div>

                    {/* Climate note for poolish/biga */}
                    {key === 'poolish' && kitchenTemp !== undefined && kitchenTemp >= 26 && (
                      <div style={{
                        marginTop: '.65rem',
                        background: '#EEF6FF', border: '1px solid #B0CDE8',
                        borderRadius: '8px', padding: '.5rem .65rem',
                        fontSize: '.72rem', color: '#3A5F80', lineHeight: 1.5,
                        display: 'flex', gap: '.4rem', alignItems: 'flex-start',
                      }}>
                        <span>🌡️</span>
                        <span>Warm kitchen — keep poolish in the fridge after 1–2h at room temperature to avoid over-fermentation.</span>
                      </div>
                    )}
                    {key === 'biga' && (
                      <div style={{
                        marginTop: '.65rem',
                        background: '#EEF6FF', border: '1px solid #B0CDE8',
                        borderRadius: '8px', padding: '.5rem .65rem',
                        fontSize: '.72rem', color: '#3A5F80', lineHeight: 1.5,
                        display: 'flex', gap: '.4rem', alignItems: 'flex-start',
                      }}>
                        <span>❄️</span>
                        <span>Biga ferments best cold — refrigerate for 16–24h at 4°C for optimal flavour and gluten structure.</span>
                      </div>
                    )}

                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
