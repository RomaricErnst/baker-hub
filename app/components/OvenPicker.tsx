'use client';
import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
  const locale = useLocale();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (selected === null && bakeType === 'pizza') {
      onSelect('home_oven_steel' as AnyOvenType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommendedOven = bakeType === 'bread'
    ? (['brioche', 'pain_mie', 'pain_viennois', 'pain_seigle'].includes(styleKey ?? '')
        ? 'standard_bread'
        : ['baguette', 'fougasse'].includes(styleKey ?? '')
          ? 'home_oven_stone_bread'
          : 'dutch_oven')
    : null;

  const badge = locale === 'fr' ? 'Recommandé' : 'Recommended';

  const pizzaOptions = [
    { id: 'pizza_oven',         image: '/oven_fire.webp',           title: t('pizzaOven.title'),     tagline: t('pizzaOven.tagline') },
    { id: 'home_oven_steel',    image: '/oven_stone.webp',          title: t('homeSteel.title'),     tagline: t('homeSteel.tagline') },
    { id: 'home_oven_standard', image: '/oven_standard.webp',       title: t('homeStandard.title'),  tagline: t('homeStandard.tagline') },
    { id: 'electric_pizza',     image: '/oven_electric.webp',       title: t('electricPizza.title'), tagline: t('electricPizza.tagline') },
  ];

  const allBreadOptions = [
    { id: 'dutch_oven',            image: '/oven_dutch.webp',          title: t('dutchOven.title'),  tagline: t('dutchOven.tagline'),  badge: recommendedOven === 'dutch_oven'            ? badge : undefined },
    { id: 'home_oven_stone_bread', image: '/oven_stone_bread.webp',    title: t('homeStoneB.title'), tagline: t('homeStoneB.tagline'), badge: recommendedOven === 'home_oven_stone_bread' ? badge : undefined },
    { id: 'standard_bread',        image: '/oven_standard_bread.webp', title: t('standardB.title'),  tagline: t('standardB.tagline'),  badge: recommendedOven === 'standard_bread'        ? badge : undefined },
    { id: 'wood_fired',            image: '/oven_wood_bread.webp',     title: t('woodFired.title'),  tagline: t('woodFired.tagline') },
    { id: 'steam_oven',            image: '/oven_steam.webp',          title: t('steamOven.title'),  tagline: t('steamOven.tagline') },
  ];

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
    <DecisionList
      options={options}
      selectedId={selectedId}
      onSelect={(id) => {
        onSelect(id as AnyOvenType);
        setExpanded(false);
      }}
    />
  );
}
