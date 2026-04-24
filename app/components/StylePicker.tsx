'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { PIZZA_STYLES, BREAD_STYLES, type StyleKey, type BakeType } from '../data';
import DecisionHero from './DecisionHero';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

interface StylePickerProps {
  bakeType: BakeType;
  selected: StyleKey | null;
  onSelect: (key: StyleKey) => void;
}

// SVG illustrations — no external dependencies
const STYLE_ART: Record<string, { bg: string; svg: string }> = {
  neapolitan: {
    bg: 'radial-gradient(ellipse at 50% 110%,#8B2500,#3D1200 50%,#1A0800)',
    svg: `<circle cx="120" cy="72" r="65" fill="#C4522A" opacity=".88"/>
      <circle cx="120" cy="72" r="52" fill="#D43020" opacity=".82"/>
      <ellipse cx="100" cy="65" rx="14" ry="10" fill="#F5F0E8" opacity=".92"/>
      <ellipse cx="128" cy="62" rx="12" ry="9" fill="#F5F0E8" opacity=".88"/>
      <ellipse cx="115" cy="71" rx="9" ry="7" fill="#F5F0E8" opacity=".85"/>
      <circle cx="58" cy="75" r="10" fill="#150500" opacity=".92"/>
      <circle cx="182" cy="73" r="9" fill="#150500" opacity=".88"/>
      <ellipse cx="105" cy="59" rx="6" ry="3" fill="#4A7A2A" opacity=".9" transform="rotate(-20 105 59)"/>
      <ellipse cx="132" cy="57" rx="5" ry="3" fill="#4A7A2A" opacity=".85" transform="rotate(15 132 57)"/>
      <text x="120" y="106" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">Neapolitan</text>`,
  },
  newyork: {
    bg: 'linear-gradient(160deg,#2A1A08,#1A1005)',
    svg: `<polygon points="120,14 212,84 28,84" fill="#D4A853" opacity=".9"/>
      <polygon points="120,18 206,82 34,82" fill="#C4522A" opacity=".82"/>
      <polygon points="120,22 198,80 42,80" fill="#E8D070" opacity=".62"/>
      <circle cx="95" cy="62" r="8" fill="#8B2515" opacity=".9"/>
      <circle cx="132" cy="55" r="7" fill="#8B2515" opacity=".85"/>
      <circle cx="108" cy="70" r="6" fill="#8B2515" opacity=".8"/>
      <circle cx="150" cy="66" r="7" fill="#8B2515" opacity=".85"/>
      <text x="120" y="104" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">New York</text>`,
  },
  pizza_romana: {
    bg: 'radial-gradient(ellipse at 50% 110%,#6B3A1F,#2C1800 50%,#140C00)',
    svg: `<circle cx="120" cy="72" r="65" fill="#C4522A" opacity=".75"/>
      <circle cx="120" cy="72" r="60" fill="#D4906A" opacity=".55"/>
      <circle cx="120" cy="72" r="55" fill="#E8C89A" opacity=".35"/>
      <ellipse cx="98" cy="66" rx="11" ry="8" fill="#F5F0E8" opacity=".85"/>
      <ellipse cx="132" cy="60" rx="9" ry="7" fill="#F5F0E8" opacity=".80"/>
      <ellipse cx="118" cy="74" rx="8" ry="6" fill="#F5F0E8" opacity=".78"/>
      <circle cx="60" cy="74" r="6" fill="#150500" opacity=".80"/>
      <circle cx="180" cy="70" r="5" fill="#150500" opacity=".75"/>
      <circle cx="120" cy="30" r="4" fill="#150500" opacity=".65"/>
      <circle cx="120" cy="114" r="4" fill="#150500" opacity=".65"/>
      <ellipse cx="100" cy="61" rx="4" ry="2" fill="#4A7A2A" opacity=".85" transform="rotate(-15 100 61)"/>
      <ellipse cx="128" cy="58" rx="3" ry="2" fill="#4A7A2A" opacity=".80" transform="rotate(10 128 58)"/>
      <circle cx="120" cy="72" r="65" fill="none" stroke="#E8C89A" stroke-width="6" opacity=".55"/>
      <circle cx="120" cy="72" r="65" fill="none" stroke="#8B4A1A" stroke-width="2" opacity=".60"/>
      <text x="120" y="138" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">Pizza Romana</text>`,
  },
  roman: {
    bg: 'linear-gradient(180deg,#18180E,#2A2010)',
    svg: `<rect x="22" y="33" width="196" height="50" rx="4" fill="#C4A855" opacity=".9"/>
      <rect x="22" y="33" width="196" height="43" rx="4" fill="#C4522A" opacity=".72"/>
      <rect x="22" y="33" width="196" height="41" rx="4" fill="#E8D080" opacity=".5"/>
      <circle cx="58" cy="51" r="7" fill="#2A1500" opacity=".52"/>
      <circle cx="100" cy="47" r="6" fill="#2A1500" opacity=".48"/>
      <circle cx="148" cy="52" r="8" fill="#2A1500" opacity=".5"/>
      <circle cx="186" cy="49" r="6" fill="#2A1500" opacity=".45"/>
      <line x1="102" y1="33" x2="102" y2="83" stroke="#8A6010" stroke-width="1.5" opacity=".5"/>
      <line x1="162" y1="33" x2="162" y2="83" stroke="#8A6010" stroke-width="1.5" opacity=".5"/>
      <text x="120" y="104" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">Roman Teglia</text>`,
  },
  pan: {
    bg: 'linear-gradient(180deg,#1E0E08,#0E0800)',
    svg: `<rect x="20" y="30" width="200" height="54" rx="3" fill="#4A3020"/>
      <rect x="24" y="32" width="192" height="50" rx="2" fill="#C47830" opacity=".9"/>
      <rect x="24" y="32" width="192" height="41" rx="2" fill="#E8C070" opacity=".78"/>
      <rect x="38" y="34" width="28" height="37" rx="2" fill="#C4522A" opacity=".7"/>
      <rect x="86" y="34" width="26" height="37" rx="2" fill="#C4522A" opacity=".68"/>
      <rect x="130" y="34" width="26" height="37" rx="2" fill="#C4522A" opacity=".7"/>
      <rect x="170" y="34" width="32" height="37" rx="2" fill="#C4522A" opacity=".65"/>
      <circle cx="65" cy="49" r="7" fill="#8B2515" opacity=".75"/>
      <circle cx="110" cy="52" r="6.5" fill="#8B2515" opacity=".7"/>
      <text x="120" y="104" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">Pan / Detroit</text>`,
  },
  sourdough: {
    bg: 'radial-gradient(ellipse at 50% 110%,#5A2A00,#1A1005 70%,#0A0800)',
    svg: `<ellipse cx="120" cy="72" rx="82" ry="13" fill="#2A1205"/>
      <ellipse cx="120" cy="68" rx="78" ry="12" fill="#D4A053" opacity=".9"/>
      <ellipse cx="120" cy="64" rx="72" ry="10" fill="#C4522A" opacity=".78"/>
      <ellipse cx="98" cy="61" rx="13" ry="9" fill="#F5F0E8" opacity=".9" transform="rotate(-10 98 61)"/>
      <ellipse cx="124" cy="59" rx="12" ry="8" fill="#F5F0E8" opacity=".85" transform="rotate(8 124 59)"/>
      <ellipse cx="143" cy="63" rx="10" ry="7" fill="#F5F0E8" opacity=".88"/>
      <text x="120" y="99" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">Sourdough</text>`,
  },
  baguette: {
    bg: 'linear-gradient(160deg,#18120A,#100C06)',
    svg: `<rect x="12" y="41" width="216" height="32" rx="16" fill="#8B5A18" transform="rotate(-3 120 57)"/>
      <rect x="16" y="43" width="208" height="25" rx="13" fill="#C4852A" transform="rotate(-3 120 55)"/>
      <line x1="55" y1="39" x2="75" y2="75" stroke="#7A4010" stroke-width="2.5" opacity=".55"/>
      <line x1="92" y1="37" x2="112" y2="73" stroke="#7A4010" stroke-width="2.5" opacity=".55"/>
      <line x1="128" y1="37" x2="148" y2="71" stroke="#7A4010" stroke-width="2.5" opacity=".5"/>
      <ellipse cx="220" cy="58" rx="14" ry="11" fill="#F0E0B0" transform="rotate(-3 220 58)"/>
      <text x="112" y="103" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">Baguette</text>`,
  },
  brioche: {
    bg: 'linear-gradient(180deg,#16100A,#0E0A06)',
    svg: `<ellipse cx="120" cy="79" rx="82" ry="12" fill="#8B4A10"/>
      <ellipse cx="120" cy="71" rx="78" ry="17" fill="#D4852A"/>
      <ellipse cx="120" cy="63" rx="72" ry="15" fill="#E8A040"/>
      <ellipse cx="120" cy="43" rx="30" ry="20" fill="#E8A040"/>
      <ellipse cx="120" cy="37" rx="25" ry="15" fill="#F0B050"/>
      <ellipse cx="118" cy="33" rx="15" ry="9" fill="#FFCC60" opacity=".55"/>
      <text x="120" y="104" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#D4A853" font-style="italic">Brioche</text>`,
  },
};

export default function StylePicker({ bakeType, selected, onSelect }: StylePickerProps) {
  const t = useTranslations('style');
  const locale = useLocale();
  const styleKey = selected;
  const [expanded, setExpanded] = useState(!styleKey);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const isBread = bakeType === 'bread';

  const pizzaListOptions = [
    { id: 'newyork', image: '/pizzas/ny_pepperoni_slice.png', title: t('newyork.title'), tagline: t('newyork.tagline') },
    { id: 'pizza_romana', image: '/pizzas/carciofi_romana.png', title: t('pizza_romana.title'), tagline: t('pizza_romana.tagline') },
    { id: 'roman', image: '/pizzas/teglia_patata_provola.png', title: t('roman.title'), tagline: t('roman.tagline') },
    { id: 'pan', image: '/pizzas/detroit_red_top.png', title: t('pan.title'), tagline: t('pan.tagline') },
    { id: 'sourdough', image: '/pizzas/diavola.png', title: t('sourdough.title'), tagline: t('sourdough.tagline') },
  ];

  const allPizzaOptions = [
    { id: 'neapolitan', image: '/pizzas/margherita.png', title: t('neapolitan.title'), tagline: t('neapolitan.tagline') },
    ...pizzaListOptions,
  ];

  const selectedStyle = allPizzaOptions.find(s => s.id === styleKey);

  if (!isBread) {
    if (!expanded && selectedStyle) {
      return (
        <DecisionSummary
          thumbnail={selectedStyle.image}
          title={selectedStyle.title}
          tagline={selectedStyle.tagline}
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
        <DecisionHero
          image="/pizzas/margherita.png"
          title={t('neapolitan.title')}
          tagline={t('neapolitan.tagline')}
          isSelected={styleKey === 'neapolitan'}
          onSelect={() => { onSelect('neapolitan'); setExpanded(false); }}
        />
        <div style={{ marginTop: 12 }}>
          <DecisionList
            options={pizzaListOptions}
            selectedId={styleKey ?? ''}
            onSelect={(id) => { onSelect(id as StyleKey); setExpanded(false); }}
          />
        </div>
      </div>
    );
  }

  // Bread: existing grid layout
  const styles = BREAD_STYLES;
  const imgHeight = 90;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '.75rem',
    }}>
      {(Object.entries(styles) as [string, { name: string; nameFr?: string; emoji: string; image?: string; desc: string; hydration: number; salt: number; oil: number; sugar: number; pref: string; bulkH: number; ballW: number; ovenNote: string; flourNote: string }][]).map(([key, style]) => {
        const isSelected = selected === key;
        const art = STYLE_ART[key];

        return (
          <div
            key={key}
            onClick={() => onSelect(key as StyleKey)}
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              border: `2px solid ${isSelected ? 'var(--bread)' : 'var(--border)'}`,
              borderRadius: '16px',
              cursor: 'pointer',
              overflow: 'hidden',
              background: isSelected ? '#FFF8F3' : 'var(--warm)',
              transition: 'all .25s',
              boxShadow: hoveredKey === key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
              transform: hoveredKey === key ? 'translateY(-3px)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '1rem .75rem .85rem',
            }}
          >
            {style.image ? (
              <img
                src={style.image}
                alt={style.name}
                style={{
                  width: '100%',
                  height: imgHeight,
                  borderRadius: 10,
                  objectFit: 'cover',
                  marginBottom: '.6rem',
                  display: 'block',
                }}
              />
            ) : art ? (
              <div
                style={{
                  width: '100%',
                  height: imgHeight,
                  borderRadius: 10,
                  marginBottom: '.6rem',
                  background: art.bg,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
                dangerouslySetInnerHTML={{
                  __html: `<svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">${art.svg}</svg>`,
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: imgHeight,
                borderRadius: 10,
                marginBottom: '.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--cream)', fontSize: '2rem',
              }}>
                {style.emoji}
              </div>
            )}
            <div style={{ width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--char)', marginBottom: '.2rem' }}>
                {locale === 'fr' && style.nameFr ? style.nameFr : style.name}
              </div>
              <div style={{
                fontSize: '.65rem',
                color: 'var(--smoke)', lineHeight: 1.4, fontWeight: 300,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}>
                {style.desc}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
