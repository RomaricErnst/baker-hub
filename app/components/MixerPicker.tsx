'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type MixerType } from '../data';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

interface MixerPickerProps {
  selected: MixerType | null;
  onSelect: (mixer: MixerType) => void;
  styleKey?: string;
  bakeType?: 'pizza' | 'bread';
  kitchenTemp?: number;
}

const NO_KNEAD_WARNING: Partial<Record<string, string>> = {
  neapolitan: 'No-knead produces too slack a dough for Neapolitan. Hand or stand mixing gives better cornicione structure.',
  newyork: 'No-knead gives marginal structure for New York slices. Stand mixing recommended for a foldable crust.',
};

export default function MixerPicker({ selected, onSelect, styleKey, bakeType, kitchenTemp }: MixerPickerProps) {
  const t = useTranslations('mixer');
  const [expanded, setExpanded] = useState(!selected);

  const options = [
    { id: 'stand',    image: '/mixer_stand.png',   title: t('stand.title'),    tagline: t('stand.tagline') },
    { id: 'hand',     image: '/mixer_hand.png',    title: t('hand.title'),     tagline: t('hand.tagline') },
    { id: 'no_knead', image: '/mixer_noknead.png', title: t('no_knead.title'), tagline: t('no_knead.tagline') },
    { id: 'spiral',   image: '/mixer_spiral.png',  title: t('spiral.title'),   tagline: t('spiral.tagline') },
  ];

  const selectedOpt = options.find(o => o.id === selected);

  return (
    <>
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
            selectedId={selected ?? ''}
            onSelect={(id) => { onSelect(id as MixerType); setExpanded(false); }}
          />
        </div>
      )}

      {/* Contextual warnings — always visible after selection */}
      {selected === 'spiral' && kitchenTemp !== undefined && kitchenTemp >= 26 && (
        <div style={{
          marginTop: '.75rem', background: '#EEF6FF', border: '1.5px solid #B0CDE8',
          borderRadius: '10px', padding: '.7rem .9rem', fontSize: '.78rem',
          color: '#3A5F80', lineHeight: 1.55, display: 'flex', gap: '.5rem', alignItems: 'flex-start',
        }}>
          <span>🧊</span>
          <span>Use ice-cold water or add ice cubes to your mixing bowl at this temperature.</span>
        </div>
      )}
      {selected === 'no_knead' && bakeType === 'pizza' && styleKey && NO_KNEAD_WARNING[styleKey] && (
        <div style={{
          marginTop: '.75rem', background: '#FFF8E8', border: '1.5px solid #E8D080',
          borderRadius: '10px', padding: '.7rem .9rem', fontSize: '.78rem',
          color: '#7A5A10', lineHeight: 1.55, display: 'flex', gap: '.5rem', alignItems: 'flex-start',
        }}>
          <span>⚠️</span>
          <span>{NO_KNEAD_WARNING[styleKey]}</span>
        </div>
      )}
    </>
  );
}
