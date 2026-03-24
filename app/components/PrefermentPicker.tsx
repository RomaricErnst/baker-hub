'use client';
import { useState, useEffect } from 'react';
import { PREFERMENT_TYPES, PREFERMENT_LABELS, type PrefermentType } from '../data';
import { useLocale } from 'next-intl';

interface PrefermentPickerProps {
  selected: PrefermentType;
  onSelect: (type: PrefermentType) => void;
  flourPct?: number;
  onFlourPctChange?: (pct: number) => void;
  kitchenTemp?: number;
  hasNightBlocker?: boolean;
  styleKey?: string;
  hideTypes?: PrefermentType[];
}

function prefermentTimingNote(
  key: string,
  flourPct: number,
  kitchenTemp: number,
  hasNightBlocker: boolean,
): { text: string; level: 'normal' | 'warning' | 'fridge' } {
  if (key === 'poolish') {
    if (kitchenTemp >= 26) return {
      text: '🧊 Ferment in the fridge (4°C) for 12-16h — too warm for room temperature in this climate. Go straight from fridge to final dough.',
      level: 'fridge',
    };
    if (kitchenTemp >= 23 && hasNightBlocker) return {
      text: '🧊 You have an overnight window — ferment in the fridge (4°C) for 12-16h. Warm kitchen + overnight RT = over-fermented poolish.',
      level: 'fridge',
    };
    if (kitchenTemp >= 23) return {
      text: `⚠️ Ferment ${flourPct >= 60 ? '5-7h' : '4-6h'} at room temperature max. Start poolish close to mixing time, not overnight.`,
      level: 'warning',
    };
    return {
      text: `Ferment ${flourPct <= 35 ? '6-10h' : flourPct >= 60 ? '10-20h' : '8-16h'} at room temperature.`,
      level: 'normal',
    };
  }

  if (key === 'biga') {
    const hours = flourPct <= 30 ? '12-24h' : flourPct >= 55 ? '24-60h' : '16-48h';
    if (kitchenTemp >= 28) return {
      text: `🧊 Ferment ${hours} in the fridge (4°C). In your hot kitchen, move directly from fridge to final dough — no counter rest.`,
      level: 'fridge',
    };
    return { text: `Ferment ${hours} in the fridge (4°C).`, level: 'normal' };
  }

  if (key === 'levain') {
    if (kitchenTemp >= 28) return {
      text: `Feed your starter ${flourPct >= 25 ? '3-4h' : '3-5h'} before mixing — peaks fast above 28°C. Watch for dome + bubbles, not the clock.`,
      level: 'warning',
    };
    if (kitchenTemp >= 23) return {
      text: `Feed your starter ${flourPct >= 25 ? '4-6h' : '5-7h'} before mixing.`,
      level: 'normal',
    };
    return {
      text: `Feed your starter ${flourPct >= 25 ? '4-8h' : '6-12h'} before mixing.`,
      level: 'normal',
    };
  }

  return { text: '', level: 'normal' };
}

export default function PrefermentPicker({
  selected, onSelect, flourPct, onFlourPctChange,
  kitchenTemp = 22, hasNightBlocker = false, styleKey, hideTypes = [],
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
          name: string; nameFr: string; emoji: string;
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

                {/* Passive climate warning pill when NOT selected */}
                {!isSelected && key === 'poolish' && kitchenTemp >= 26 && (
                  <div style={{
                    fontSize: '.62rem', color: '#3A5A8A', background: '#EEF2FA',
                    border: '1px solid #C4CDE0', borderRadius: '6px', padding: '.15rem .45rem',
                    display: 'inline-block', marginBottom: '.4rem',
                    fontFamily: 'var(--font-dm-mono)',
                  }}>
                    🧊 Fridge ferment in tropical kitchen
                  </div>
                )}
                {!isSelected && key === 'poolish' && kitchenTemp >= 23 && kitchenTemp < 26 && hasNightBlocker && (
                  <div style={{
                    fontSize: '.62rem', color: '#3A5A8A', background: '#EEF2FA',
                    border: '1px solid #C4CDE0', borderRadius: '6px', padding: '.15rem .45rem',
                    display: 'inline-block', marginBottom: '.4rem',
                    fontFamily: 'var(--font-dm-mono)',
                  }}>
                    🧊 Fridge if overnight
                  </div>
                )}

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

                    {/* Climate-aware timing note */}
                    {(() => {
                      const timing = prefermentTimingNote(key, localFlourPct, kitchenTemp, hasNightBlocker);
                      if (!timing.text) return null;
                      const styles: Record<string, React.CSSProperties> = {
                        normal:  { color: 'var(--smoke)', background: 'transparent', border: 'none', borderRadius: '0', padding: '0' },
                        warning: { color: '#7A5A10', background: '#FFF8E8', border: '1px solid #E8D080', borderRadius: '8px', padding: '.4rem .6rem' },
                        fridge:  { color: '#3A5A8A', background: '#EEF2FA', border: '1px solid #C4CDE0', borderRadius: '8px', padding: '.4rem .6rem' },
                      };
                      return (
                        <div style={{
                          marginTop: '.55rem', fontSize: '.72rem', fontStyle: 'italic',
                          lineHeight: 1.5, ...styles[timing.level],
                        }}>
                          {timing.text}
                        </div>
                      );
                    })()}
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
