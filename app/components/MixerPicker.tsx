'use client';
import { useTranslations } from 'next-intl';
import { type MixerType } from '../data';
import { getBreadProtocol } from '../utils/breadProfiles';
import DecisionList from './DecisionList';

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
  const options = [
    { id: 'stand',    image: '/images/approved/equipment-v2/stand-mixer.webp',   title: t('stand.title'),    tagline: t('stand.tagline') },
    { id: 'hand',     image: '/images/approved/equipment-v2/hand-kneading.webp',    title: t('hand.title'),     tagline: t('hand.tagline') },
    { id: 'no_knead', image: '/images/approved/equipment-v2/no-knead.webp', title: t('no_knead.title'), tagline: t('no_knead.tagline') },
    { id: 'spiral',   image: '/images/approved/equipment-v2/spiral-mixer-v3.webp',  title: t('spiral.title'),   tagline: t('spiral.tagline') },
  ].filter(option=>!styleKey || !getBreadProtocol(styleKey) || getBreadProtocol(styleKey)!.supportedMixers.includes(option.id as MixerType));

  return (<>
      <DecisionList layout="illustrated" options={options} selectedId={selected ?? ''} onSelect={id => onSelect(id as MixerType)} />

      {/* Contextual warnings — always visible after selection */}
      {selected === 'no_knead' && bakeType === 'pizza' && styleKey && NO_KNEAD_WARNING[styleKey] && (
        <div style={{
          marginTop: '12px', background: '#FFF8E8', border: '1.5px solid #E8D080',
          borderRadius: '16px', padding: '12px 16px', fontSize: '12px',
          color: '#7A5A10', lineHeight: 1.55, display: 'flex', gap: '8px', alignItems: 'flex-start',
        }}>
          <span>{locale === 'fr' ? 'Pour ce style, choisissez le pétrissage à la main ou avec un pétrin.' : 'For this style, choose hand kneading or a mixer.'}</span>
        </div>
      )}
    </>
  );
}

