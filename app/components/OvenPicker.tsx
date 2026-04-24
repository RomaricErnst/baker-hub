'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { OVEN_TYPES, BREAD_OVEN_TYPES, type AnyOvenType, type OvenType, type BreadOvenType } from '../data';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

// Ovens to EXCLUDE per bread style — truly incompatible (geometry or technique)
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

// Maps simplified UI id → existing AnyOvenType data key
const PIZZA_OVEN_TO_DATA: Record<string, AnyOvenType> = {
  home:       'home_oven_standard',
  stone:      'home_oven_steel',
  steel:      'home_oven_steel',
  ooni:       'pizza_oven',
  gozney:     'pizza_oven',
  woodfired:  'pizza_oven',
  deck:       'pizza_oven',
  pan:        'home_oven_standard',
  convection: 'home_oven_standard',
};

// Maps data key → preferred simplified UI id for display
const DATA_TO_PIZZA_OVEN: Partial<Record<AnyOvenType, string>> = {
  home_oven_standard: 'home',
  home_oven_steel:    'stone',
  pizza_oven:         'ooni',
  electric_pizza:     'home',
};

export default function OvenPicker({ bakeType, styleKey, selected, onSelect }: OvenPickerProps) {
  const t = useTranslations('oven');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(!selected);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (bakeType === 'pizza') {
    const options = [
      { id: 'home',       image: '/oven_standard.png',      title: t('home.title'),       tagline: t('home.tagline') },
      { id: 'stone',      image: '/oven_stone.png',          title: t('stone.title'),      tagline: t('stone.tagline') },
      { id: 'steel',      image: '/oven_stone.png',          title: t('steel.title'),      tagline: t('steel.tagline') },
      { id: 'ooni',       image: '/oven_fire.png',           title: t('ooni.title'),       tagline: t('ooni.tagline') },
      { id: 'gozney',     image: '/oven_fire.png',           title: t('gozney.title'),     tagline: t('gozney.tagline') },
      { id: 'woodfired',  image: '/oven_wood_bread.png',     title: t('woodfired.title'),  tagline: t('woodfired.tagline') },
      { id: 'deck',       image: '/oven_steam.png',          title: t('deck.title'),       tagline: t('deck.tagline') },
      { id: 'pan',        image: '/oven_standard_bread.png', title: t('pan.title'),        tagline: t('pan.tagline') },
      { id: 'convection', image: '/oven_standard.png',       title: t('convection.title'), tagline: t('convection.tagline') },
    ];

    const selectedDisplayId = selected ? (DATA_TO_PIZZA_OVEN[selected] ?? '') : '';
    const selectedOpt = options.find(o => o.id === selectedDisplayId);

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
          selectedId={selectedDisplayId}
          onSelect={(id) => {
            onSelect(PIZZA_OVEN_TO_DATA[id] ?? 'home_oven_standard' as AnyOvenType);
            setExpanded(false);
          }}
        />
      </div>
    );
  }

  // ── Bread path: existing grid ──────────────────
  const allEntries = Object.entries(BREAD_OVEN_TYPES);
  const excluded = styleKey ? (BREAD_OVEN_EXCLUDES[styleKey] ?? []) : [];
  const visibleEntries = showAll ? allEntries : allEntries.filter(([key]) => !excluded.includes(key));
  const hiddenCount = allEntries.length - visibleEntries.length;

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '.75rem',
      }}>
        {visibleEntries.map(([key, oven]) => {
          const isSelected = selected === key;
          const o = oven as { name: string; nameFr?: string; emoji: string; image?: string; desc: string; descFr?: string };
          return (
            <div
              key={key}
              onClick={() => onSelect(key as AnyOvenType)}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey(null)}
              style={{
                border: `2px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
                borderRadius: '18px',
                padding: '1rem .75rem',
                cursor: 'pointer',
                background: isSelected ? '#FFF8F3' : 'var(--warm)',
                transition: 'all .25s',
                boxShadow: hoveredKey === key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
                transform: hoveredKey === key ? 'translateY(-3px)' : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              }}
            >
              {o.image ? (
                <img src={o.image} alt={o.name} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px', marginBottom: '.6rem' }} />
              ) : (
                <span style={{ fontSize: '2rem', marginBottom: '.6rem' }}>{o.emoji}</span>
              )}
              <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.25rem', color: 'var(--char)' }}>
                {locale === 'fr' && o.nameFr ? o.nameFr : o.name}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.45 }}>
                {locale === 'fr' && o.descFr ? o.descFr : o.desc}
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginTop: '.75rem', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
            padding: 0, textDecoration: 'underline', textUnderlineOffset: '2px',
          }}
        >
          Show {hiddenCount} more option{hiddenCount > 1 ? 's' : ''} (not typical for this style)
        </button>
      )}
    </div>
  );
}
