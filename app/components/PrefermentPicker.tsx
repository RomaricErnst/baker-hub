'use client';
import { useState } from 'react';
import { PREFERMENT_TYPES, type PrefermentType } from '../data';
import { useTranslations } from 'next-intl';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

interface PrefermentPickerProps {
  selected: PrefermentType;
  onSelect: (type: PrefermentType) => void;
  flourPct?: number;
  onFlourPctChange?: (pct: number) => void;
  styleKey?: string;
  hideTypes?: PrefermentType[];
  kitchenTemp?: number;
  yeastType?: string;
}

export default function PrefermentPicker({
  selected, onSelect, flourPct, onFlourPctChange,
  styleKey, hideTypes = [], kitchenTemp, yeastType,
}: PrefermentPickerProps) {
  const t = useTranslations('preferment');
  const [expanded, setExpanded] = useState(selected === 'none');

  const ALL_OPTIONS = [
    { id: 'none',    image: '/preferment-direct.png',  title: t('none.title'),    tagline: t('none.tagline') },
    { id: 'poolish', image: '/preferment-poolish.png', title: t('poolish.title'), tagline: t('poolish.tagline') },
    { id: 'biga',    image: '/preferment-biga.png',    title: t('biga.title'),    tagline: t('biga.tagline') },
    { id: 'levain',  image: '/yeast_sourdough.png',    title: t('levain.title'),  tagline: t('levain.tagline') },
  ];

  const options = ALL_OPTIONS
    .filter(o => !hideTypes.includes(o.id as PrefermentType))
    .filter(o => o.id !== 'levain' || yeastType === 'sourdough')
    .map(o => {
      const pData = PREFERMENT_TYPES[o.id as PrefermentType] as { bestFor?: string[] };
      const isRecommended = o.id !== 'none' && styleKey && pData?.bestFor?.includes(styleKey);
      return { ...o, badge: isRecommended ? t('recommended') : undefined };
    });

  const selectedOpt = options.find(o => o.id === selected);

  return (
    <div>
      {!expanded && selectedOpt ? (
        <DecisionSummary
          thumbnail={selectedOpt.image}
          title={selectedOpt.title}
          tagline={selectedOpt.tagline}
          onExpand={() => setExpanded(true)}
        />
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Playfair Display', fontSize: 22, fontWeight: 700, color: 'var(--char)', margin: 0 }}>
              {t('heading')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--smoke)', margin: '4px 0 0', fontFamily: 'DM Sans' }}>
              {t('subtitle')}
            </p>
          </div>
          <DecisionList
            options={options}
            selectedId={selected}
            onSelect={(id) => { onSelect(id as PrefermentType); setExpanded(false); }}
          />
        </div>
      )}

      {/* Hydration / cold-ferment pills when a preferment is active */}
      {selected !== 'none' && (() => {
        const pData = PREFERMENT_TYPES[selected] as { hydration?: number; cold?: boolean };
        if (!pData.hydration && !pData.cold) return null;
        return (
          <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', marginTop: '.6rem' }}>
            {pData.hydration && (
              <span style={{
                fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                background: 'var(--cream)', color: 'var(--ash)',
                borderRadius: '20px', padding: '.1rem .45rem',
                border: '1px solid var(--border)',
              }}>
                {pData.hydration}% {t('hydration')}
              </span>
            )}
            {pData.cold && (
              <span style={{
                fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                background: 'rgba(107,122,90,0.1)', color: 'var(--sage)',
                borderRadius: '20px', padding: '.1rem .45rem',
                border: '1px solid rgba(107,122,90,0.25)',
              }}>
                {t('coldFerment')}
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
