'use client';
import { PREFERMENT_TYPES, type PrefermentType } from '../data';
import { useTranslations } from 'next-intl';
import DecisionList from './DecisionList';

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

  const ALL_OPTIONS = [
    { id: 'none',    image: '/preferment-direct.webp',  title: t('none.title'),    tagline: t('none.tagline') },
    { id: 'poolish', image: '/preferment-poolish.webp', title: t('poolish.title'), tagline: t('poolish.tagline') },
    { id: 'biga',    image: '/preferment-biga.webp',    title: t('biga.title'),    tagline: t('biga.tagline') },
    { id: 'levain',  image: '/yeast_sourdough.webp',    title: t('levain.title'),  tagline: t('levain.tagline') },
  ];

  const options = ALL_OPTIONS
    .filter(o => !hideTypes.includes(o.id as PrefermentType))
    .filter(o => o.id !== 'levain' || yeastType === 'sourdough')
    .map(o => {
      const pData = PREFERMENT_TYPES[o.id as PrefermentType] as { bestFor?: string[] };
      const isRecommended = o.id !== 'none' && styleKey && pData?.bestFor?.includes(styleKey);
      return { ...o, badge: isRecommended ? t('recommended') : undefined };
    });

  // Collapsing to a summary made sense when this picker shared a card with
  // others. On its own page it hides the alternatives behind a CHANGE link and
  // turns a one-tap decision into three — and the page already has a title, so
  // the summary was the second thing repeating what the header said.
  return (
    <div>
      <div>
          {/* No heading here: the step page above already says "Preferment
              method". Two titles, one question. */}
          <p style={{ fontSize: 13, color: 'var(--smoke)', margin: '0 0 14px', fontFamily: 'var(--font-ui)' }}>
            {t('subtitle')}
          </p>
          <DecisionList
            options={options}
            selectedId={selected}
            onSelect={(id) => onSelect(id as PrefermentType)}
          />
      </div>

      {/* Hydration / cold-ferment pills when a preferment is active */}
      {selected !== 'none' && (() => {
        const pData = PREFERMENT_TYPES[selected] as { hydration?: number; cold?: boolean };
        if (!pData.hydration && !pData.cold) return null;
        return (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {pData.hydration && (
              <span style={{
                fontSize: '11px', fontFamily: 'var(--font-ui)',
                background: 'var(--cream)', color: 'var(--ash)',
                borderRadius: '20px', padding: '.1rem 8px',
                border: '1px solid var(--border)',
              }}>
                {pData.hydration}% {t('hydration')}
              </span>
            )}
            {pData.cold && (
              <span style={{
                fontSize: '11px', fontFamily: 'var(--font-ui)',
                background: 'rgba(107,122,90,0.1)', color: 'var(--sage)',
                borderRadius: '20px', padding: '.1rem 8px',
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
