'use client';
import { useTranslations, useLocale } from 'next-intl';
import { type AnyOvenType } from '../data';
import { getBreadProtocol } from '../utils/breadProfiles';
import DecisionList from './DecisionList';

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
  /** Pre-fill a sensible default WITHOUT advancing the step.
   *  onSelect advances the flow, so it must only run on a real user tap —
   *  calling it from the mount effect made the oven step skip itself. */
  onPreselect?: (oven: AnyOvenType) => void;
  construction?: 'tabletop' | 'masonry' | 'home' | 'micro';
  onConstructionChange?: (kind: 'tabletop' | 'masonry' | 'home' | 'micro') => void;
}

export default function OvenPicker({ bakeType, styleKey, selected, onSelect, construction = 'tabletop', onConstructionChange }: OvenPickerProps) {
  const t = useTranslations('oven');
  const locale = useLocale();
  const pizzaOptions = [
    { id: 'tabletop', image: '/images/approved/equipment-v2/portable-gas-oven.webp', title: locale === 'fr' ? 'Four à pizza compact' : 'Tabletop pizza oven', tagline: locale === 'fr' ? 'Modèle de table, à gaz ou à bois' : 'Tabletop model, gas or wood' },
    { id: 'masonry', image: '/images/approved/equipment-v2/masonry-oven.webp', title: locale === 'fr' ? 'Four maçonné' : 'Brick / masonry oven', tagline: locale === 'fr' ? 'Four fixe avec sole et voûte épaisses' : 'Built-in oven with a heavy floor and dome' },
    { id: 'home_oven_steel',    image: '/images/approved/equipment-v2/home-oven-steel.webp',          title: t('homeSteel.title'),     tagline: t('homeSteel.tagline') },
    { id: 'home_oven_standard', image: '/images/approved/equipment-v2/home-oven-standard.webp',       title: t('homeStandard.title'),  tagline: t('homeStandard.tagline') },
    { id: 'electric_pizza',     image: '/images/approved/equipment-v2/electric-pizza-oven-v3.webp',       title: t('electricPizza.title'), tagline: t('electricPizza.tagline') },
  ];

  const allBreadOptions = [
    { id: 'griddle', image: '/images/approved/equipment-v2/griddle.webp', title: locale==='fr'?'Poêle ou plancha':'Skillet or griddle', tagline: locale==='fr'?'Cuisson sur une surface chaude':'Cook on a hot flat surface' },
    { id: 'dutch_oven',            image: '/images/approved/equipment-v2/dutch-oven.webp',          title: t('dutchOven.title'),  tagline: t('dutchOven.tagline') },
    { id: 'home_oven_stone_bread', image: '/images/approved/equipment-v2/home-oven-stone.webp',    title: t('homeStoneB.title'), tagline: t('homeStoneB.tagline') },
    { id: 'standard_bread',        image: '/images/approved/equipment-v2/home-oven-standard.webp', title: t('standardB.title'),  tagline: t('standardB.tagline') },
    { id: 'wood_fired',            image: '/images/approved/equipment-v2/bread-wood-open.webp',     title: t('woodFired.title'),  tagline: t('woodFired.tagline') },
    { id: 'home', image: '/images/approved/equipment-v2/bread-home-open.webp', title: locale==='fr'?'Four vapeur domestique':'Home steam oven', tagline: locale==='fr'?'Avec injection de vapeur':'With steam injection' },
    { id: 'micro', image: '/images/approved/equipment-v2/bread-micro-open.webp', title: locale==='fr'?'Four de microboulangerie':'Microbakery oven', tagline: locale==='fr'?'Modèle vertical avec injection de vapeur':'Upright model with steam injection' },
  ];

  const options = bakeType === 'pizza'
    ? pizzaOptions
    : allBreadOptions.filter(o => {
        const excluded = styleKey ? (BREAD_OVEN_EXCLUDES[styleKey] ?? []) : [];
        const profile = styleKey ? getBreadProtocol(styleKey) : undefined;
        const equipmentId = o.id === 'home' || o.id === 'micro' ? 'steam_oven' : o.id;
        return !excluded.includes(o.id) && (profile ? profile.equipment.includes(equipmentId) : o.id !== 'griddle');
      });

  const selectedId = selected === 'pizza_oven' ? (construction === 'masonry' ? 'masonry' : 'tabletop') : selected === 'steam_oven' ? (construction === 'micro' ? 'micro' : 'home') : selected ?? '';
  return <DecisionList layout="illustrated" options={options} selectedId={selectedId} onSelect={(id) => {
    if (id === 'tabletop' || id === 'masonry') {
      onConstructionChange?.(id);
      onSelect('pizza_oven');
    } else if (id === 'home' || id === 'micro') {
      onConstructionChange?.(id); onSelect('steam_oven');
    } else onSelect(id as AnyOvenType);
  }} />;
}

