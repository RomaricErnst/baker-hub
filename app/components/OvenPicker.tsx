'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { type AnyOvenType } from '../data';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

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
  const t = useTranslations('oven');
  const [expanded, setExpanded] = useState(true);

  const pizzaOptions = [
    { id: 'pizza_oven',         image: '/oven_fire.png',           title: t('pizzaOven.title'),     tagline: t('pizzaOven.tagline') },
    { id: 'home_oven_steel',    image: '/oven_stone.png',          title: t('homeSteel.title'),     tagline: t('homeSteel.tagline') },
    { id: 'home_oven_standard', image: '/oven_standard.png',       title: t('homeStandard.title'),  tagline: t('homeStandard.tagline') },
    { id: 'electric_pizza',     image: '/oven_electric.png',       title: t('electricPizza.title'), tagline: t('electricPizza.tagline') },
  ];

  const allBreadOptions = [
    { id: 'dutch_oven',            image: '/oven_dutch.png',          title: t('dutchOven.title'),  tagline: t('dutchOven.tagline') },
    { id: 'home_oven_stone_bread', image: '/oven_stone_bread.png',    title: t('homeStoneB.title'), tagline: t('homeStoneB.tagline') },
    { id: 'standard_bread',        image: '/oven_standard_bread.png', title: t('standardB.title'),  tagline: t('standardB.tagline') },
    { id: 'wood_fired',            image: '/oven_wood_bread.png',     title: t('woodFired.title'),  tagline: t('woodFired.tagline') },
    { id: 'steam_oven',            image: '/oven_steam.png',          title: t('steamOven.title'),  tagline: t('steamOven.tagline') },
  ];

  const defaultId = bakeType === 'pizza' ? 'home_oven_steel' : 'dutch_oven';

  useEffect(() => {
    if (selected === null) {
      onSelect(defaultId as AnyOvenType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = bakeType === 'pizza'
    ? pizzaOptions
    : allBreadOptions.filter(o => {
        const excluded = styleKey ? (BREAD_OVEN_EXCLUDES[styleKey] ?? []) : [];
        return !excluded.includes(o.id);
      });

  const selectedId = selected ?? '';
  const selectedOpt = options.find(o => o.id === selectedId);

  if (!expanded && selectedOpt) {
    return (
      <DecisionSummary
        thumbnail={selectedOpt.image}
        title={selectedOpt.title}
        tagline={selectedOpt.tagline}
        onExpand={() => setExpanded(true)}
      />
    );
  }

  return (
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
        selectedId={selectedId}
        onSelect={(id) => {
          onSelect(id as AnyOvenType);
          setExpanded(false);
        }}
      />
    </div>
  );
}
