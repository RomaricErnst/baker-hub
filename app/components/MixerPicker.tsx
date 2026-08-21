'use client';
import { useState, useEffect, useRef } from 'react';
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
  /** Projected total dough (numItems × itemWeight) — surfaces the stand-mixer
      batch note at selection time instead of only on the recipe page. */
  totalDoughG?: number;
  locale?: string;
}

const NO_KNEAD_WARNING: Partial<Record<string, string>> = {
  neapolitan: 'No-knead produces too slack a dough for Neapolitan. Hand or stand mixing gives better cornicione structure.',
  newyork: 'No-knead gives marginal structure for New York slices. Stand mixing recommended for a foldable crust.',
};

export default function MixerPicker({ selected, onSelect, styleKey, bakeType, kitchenTemp, totalDoughG, locale }: MixerPickerProps) {
  const t = useTranslations('mixer');
  // Same rule as OvenPicker: start collapsed when already chosen, and let the
  // selection show for a beat before folding away.
  const [expanded, setExpanded] = useState(selected == null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); }, []);

  const options = [
    { id: 'stand',    image: '/mixer_stand.webp',   title: t('stand.title'),    tagline: t('stand.tagline') },
    { id: 'hand',     image: '/mixer_hand.webp',    title: t('hand.title'),     tagline: t('hand.tagline') },
    { id: 'no_knead', image: '/mixer_noknead.webp', title: t('no_knead.title'), tagline: t('no_knead.tagline') },
    { id: 'spiral',   image: '/mixer_spiral.webp',  title: t('spiral.title'),   tagline: t('spiral.tagline') },
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
          <p style={{ fontSize: 13, color: 'var(--smoke)', margin: '0 0 14px', fontFamily: 'var(--font-ui)' }}>
            {t('subtitle')}
          </p>
          <DecisionList
            options={options}
            selectedId={selected ?? ''}
            onSelect={(id) => {
              onSelect(id as MixerType);
              if (collapseTimer.current) clearTimeout(collapseTimer.current);
              collapseTimer.current = setTimeout(() => setExpanded(false), 420);
            }}
          />
        </div>
      )}

      {/* Early batch hint — the 1500g cap otherwise only appears on the
          recipe page, after the baker has already committed to the mixer */}
      {selected === 'stand' && (totalDoughG ?? 0) > 1500 && (
        <div style={{
          marginTop: '12px', background: '#FDFBF2', border: '1px solid #E8D890',
          borderRadius: '16px', padding: '12px 16px', fontSize: '12px',
          color: '#7A5A10', lineHeight: 1.55,
        }}>
          {locale === 'fr'
            ? `Avec ${totalDoughG}g de pâte, vous pétrirez en ${Math.ceil((totalDoughG ?? 0) / 1500)} fois — le plan s'en occupe.`
            : `With ${totalDoughG}g of dough you'll mix in ${Math.ceil((totalDoughG ?? 0) / 1500)} batches — the plan handles it.`}
        </div>
      )}

      {/* Contextual warnings — always visible after selection */}
      {selected === 'no_knead' && bakeType === 'pizza' && styleKey && NO_KNEAD_WARNING[styleKey] && (
        <div style={{
          marginTop: '12px', background: '#FFF8E8', border: '1.5px solid #E8D080',
          borderRadius: '16px', padding: '12px 16px', fontSize: '12px',
          color: '#7A5A10', lineHeight: 1.55, display: 'flex', gap: '8px', alignItems: 'flex-start',
        }}>
          <span>⚠️</span>
          <span>{NO_KNEAD_WARNING[styleKey]}</span>
        </div>
      )}
    </>
  );
}
