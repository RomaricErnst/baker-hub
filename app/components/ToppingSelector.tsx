'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  PIZZAS, DESSERT_PIZZAS, getPizzaById,
  BASE_LABELS, OCCASION_LABELS, SEASON_LABELS,
  WINE_CATEGORY_LABELS, WINE_EXAMPLES,
  BUDGET_LABELS, COMPLEXITY_LABELS,
  INGREDIENT_CATEGORY_LABELS,
  filterPizzas, getFilterCounts, DEFAULT_FILTER, getCurrentSeason,
  type Pizza, type FilterState, type WineCategory, type BaseType,
  type OccasionTag, type DietaryTag, type Season, type BudgetTier,
  type ComplexityTier, type RegionTag, type IngredientCategory,
} from '../lib/toppingDatabase';
import type { Locale } from '../lib/toppingTypes';

// ─── Ingredient chips ─────────────────────────────────────────

const INGREDIENT_CHIPS: {
  category: { en: string; fr: string };
  items: { en: string; fr: string; search: string }[];
}[] = [
  {
    category: { en: 'Cheese & Dairy', fr: 'Fromage & Produits laitiers' },
    items: [
      { en: 'Mozzarella',     fr: 'Mozzarella',       search: 'mozzarella' },
      { en: 'Burrata',        fr: 'Burrata',           search: 'burrata' },
      { en: 'Stracciatella',  fr: 'Stracciatella',     search: 'stracciatella' },
      { en: 'Gorgonzola',     fr: 'Gorgonzola',        search: 'gorgonzola' },
      { en: 'Ricotta',        fr: 'Ricotta',           search: 'ricotta' },
      { en: 'Pecorino',       fr: 'Pecorino',          search: 'pecorino' },
      { en: 'Parmesan',       fr: 'Parmesan',          search: 'parmesan' },
      { en: 'Brie',           fr: 'Brie',              search: 'brie' },
      { en: 'Camembert',      fr: 'Camembert',         search: 'camembert' },
      { en: 'Raclette',       fr: 'Raclette',          search: 'raclette' },
      { en: 'Goat cheese',    fr: 'Chèvre',            search: 'goat' },
      { en: 'Taleggio',       fr: 'Taleggio',          search: 'taleggio' },
      { en: 'Reblochon',      fr: 'Reblochon',         search: 'reblochon' },
      { en: 'Smoked cheese',  fr: 'Fromage fumé',      search: 'provola' },
      { en: 'Stracchino',     fr: 'Stracchino',        search: 'stracchino' },
      { en: 'Labneh',         fr: 'Labneh',            search: 'labneh' },
      { en: 'Cream',          fr: 'Crème',             search: 'cream' },
      { en: 'Pistachio cream',fr: 'Crème de pistache', search: 'pistachio' },
    ],
  },
  {
    category: { en: 'Meat, Fish & Deli', fr: 'Viande, Poisson & Charcuterie' },
    items: [
      { en: 'Parma ham',      fr: 'Jambon de Parme',   search: 'prosciutto' },
      { en: 'Pepperoni',      fr: 'Pepperoni',         search: 'pepperoni' },
      { en: 'Spicy salami',   fr: 'Salami épicé',      search: 'salami' },
      { en: 'Guanciale',      fr: 'Guanciale',         search: 'guanciale' },
      { en: 'Speck',          fr: 'Speck',             search: 'speck' },
      { en: 'Chorizo',        fr: 'Chorizo',           search: 'chorizo' },
      { en: 'Merguez',        fr: 'Merguez',           search: 'merguez' },
      { en: 'Sausage',        fr: 'Saucisse',          search: 'salsiccia' },
      { en: 'Ham',            fr: 'Jambon',            search: 'ham' },
      { en: 'Bacon',          fr: 'Lardons',           search: 'lardons' },
      { en: 'Mortadella',     fr: 'Mortadelle',        search: 'mortadella' },
      { en: 'Bresaola',       fr: 'Bresaola',          search: 'bresaola' },
      { en: 'Chicken',        fr: 'Poulet',            search: 'chicken' },
      { en: 'Duck',           fr: 'Canard',            search: 'duck' },
      { en: 'Beef',           fr: 'Bœuf',              search: 'beef' },
      { en: 'Char siu',       fr: 'Char siu',          search: 'char siu' },
      { en: 'Foie gras',      fr: 'Foie gras',         search: 'foie gras' },
      { en: 'Andouille',      fr: 'Andouille',         search: 'andouille' },
      { en: 'Salmon',         fr: 'Saumon',            search: 'salmon' },
      { en: 'Anchovy',        fr: 'Anchois',           search: 'anchovy' },
      { en: 'Tuna',           fr: 'Thon',              search: 'tuna' },
      { en: 'Prawns',         fr: 'Crevettes',         search: 'prawn' },
      { en: 'Octopus',        fr: 'Poulpe',            search: 'octopus' },
      { en: 'Clams',          fr: 'Palourdes',         search: 'clam' },
    ],
  },
  {
    category: { en: 'Produce & Herbs', fr: 'Légumes & Herbes' },
    items: [
      { en: 'Mushrooms',      fr: 'Champignons',       search: 'mushroom' },
      { en: 'Porcini',        fr: 'Cèpes',             search: 'porcini' },
      { en: 'Artichoke',      fr: 'Artichaut',         search: 'artichoke' },
      { en: 'Courgette',      fr: 'Courgette',         search: 'courgette' },
      { en: 'Aubergine',      fr: 'Aubergine',         search: 'aubergine' },
      { en: 'Potato',         fr: 'Pomme de terre',    search: 'potato' },
      { en: 'Olive',          fr: 'Olive',             search: 'olive' },
      { en: 'Capers',         fr: 'Câpres',            search: 'caper' },
      { en: 'Spinach',        fr: 'Épinards',          search: 'spinach' },
      { en: 'Peppers',        fr: 'Poivrons',          search: 'pepper' },
      { en: 'Red onion',      fr: 'Oignon rouge',      search: 'onion' },
      { en: 'Sweetcorn',      fr: 'Maïs',              search: 'sweetcorn' },
      { en: 'Rocket',         fr: 'Roquette',          search: 'rocket' },
      { en: 'Basil',          fr: 'Basilic',           search: 'basil' },
      { en: 'Rosemary',       fr: 'Romarin',           search: 'rosemary' },
      { en: 'Truffle',        fr: 'Truffe',            search: 'truffle' },
      { en: 'Fig',            fr: 'Figue',             search: 'fig' },
      { en: 'Pear',           fr: 'Poire',             search: 'pear' },
      { en: 'Chilli',         fr: 'Piment',            search: 'chilli' },
      { en: 'Pineapple',      fr: 'Ananas',            search: 'pineapple' },
      { en: 'Kimchi',         fr: 'Kimchi',            search: 'kimchi' },
      { en: 'Spring onion',   fr: 'Ciboule',           search: 'spring onion' },
      { en: 'Pickled daikon', fr: 'Daïkon mariné',     search: 'daikon' },
      { en: 'Bean sprouts',   fr: 'Germes de soja',    search: 'bean sprout' },
      { en: 'Asparagus',      fr: 'Asperges',          search: 'asparagus' },
      { en: 'Strawberries',   fr: 'Fraises',           search: 'strawberr' },
      { en: 'Apple',          fr: 'Pomme',             search: 'apple' },
      { en: 'Walnuts',        fr: 'Noix',              search: 'walnut' },
    ],
  },
  {
    category: { en: 'Sauces & Finish', fr: 'Sauces & Finitions' },
    items: [
      { en: 'Egg',            fr: 'Œuf',               search: 'egg' },
      { en: 'Truffle oil',    fr: 'Huile de truffe',   search: 'truffle oil' },
      { en: 'Honey',          fr: 'Miel',              search: 'honey' },
      { en: 'Hot honey',      fr: 'Miel pimenté',      search: 'hot honey' },
      { en: 'Pesto',          fr: 'Pesto',             search: 'pesto' },
      { en: 'BBQ sauce',      fr: 'Sauce BBQ',         search: 'bbq' },
      { en: 'Harissa',        fr: 'Harissa',           search: 'harissa' },
      { en: 'Miso',           fr: 'Miso',              search: 'miso' },
      { en: 'Hoisin',         fr: 'Sauce hoisin',      search: 'hoisin' },
      { en: 'Peanut sauce',   fr: 'Sauce cacahuète',   search: 'peanut' },
      { en: 'Gochujang',      fr: 'Gochujang',         search: 'gochujang' },
      { en: 'Laksa',          fr: 'Laksa',             search: 'laksa' },
      { en: 'Tom yam',        fr: 'Tom yam',           search: 'tom yam' },
      { en: 'Teriyaki',       fr: 'Teriyaki',          search: 'teriyaki' },
      { en: 'Sesame oil',     fr: 'Huile de sésame',   search: 'sesame' },
      { en: 'Mustard',        fr: 'Moutarde',          search: 'mustard' },
      { en: 'Nutella',        fr: 'Nutella',           search: 'nutella' },
      { en: 'Chocolate',      fr: 'Chocolat',          search: 'chocolat' },
      { en: 'Cinnamon',       fr: 'Cannelle',          search: 'cinnamon' },
      { en: 'Almond flakes',  fr: 'Amandes effilées',  search: 'almond' },
      { en: 'Nori',           fr: 'Nori',              search: 'nori' },
      { en: 'Lemongrass',     fr: 'Citronnelle',       search: 'lemongrass' },
      { en: 'Kaffir lime',    fr: 'Citron kaffir',     search: 'kaffir' },
    ],
  },
];

// ─── Style names ──────────────────────────────────────────────

const STYLE_NAMES: Record<string, string> = {
  neapolitan:   'Neapolitan',
  sourdough:    'Sourdough',
  pizza_romana: 'Pizza Romana',
  roman:        'Roman Teglia',
  newyork:      'New York',
  pan:          'Pan / Detroit',
};
const STYLE_NAMES_FR: Record<string, string> = {
  neapolitan:   'Napolitaine',
  sourdough:    'Au levain',
  pizza_romana: 'Romaine',
  roman:        'Teglia romaine',
  newyork:      'New York',
  pan:          'Pan / Detroit',
};

// ─── Types ───────────────────────────────────────────────────

type Qty = Record<string, number>;

interface Props {
  locale: string;
  styleKey?: string;
  numItems: number;
  activePill: 'pizzas' | 'shopping' | 'party';
  onPillChange: (pill: 'pizzas' | 'shopping' | 'party') => void;
  t: (key: string) => string;
  controlledQtys?: Qty;
  onQtysChange?: (qtys: Qty) => void;
  hidePillBar?: boolean;
  onStyleChange?: (style: string) => void;
  activeStyleKey?: string;
  onStyleKeyChange?: (key: string) => void;
}

// ─── Sub-region maps ─────────────────────────────────────────

const ITALY_REGIONS: RegionTag[] = ['neapolitan','roman','sicilian','ligurian','venetian','calabrian'];
const FRANCE_REGIONS: RegionTag[] = ['alsace','savoie','provence','bretagne','normandie','basque','lyonnais','nord'];

const REGION_NAMES: Record<RegionTag, { en: string; fr: string }> = {
  neapolitan: { en: 'Naples',   fr: 'Naples' },
  roman:      { en: 'Rome',     fr: 'Rome' },
  sicilian:   { en: 'Sicily',   fr: 'Sicile' },
  ligurian:   { en: 'Liguria',  fr: 'Ligurie' },
  venetian:   { en: 'Venice',   fr: 'Venise' },
  calabrian:  { en: 'Calabria', fr: 'Calabre' },
  alsace:     { en: 'Alsace',   fr: 'Alsace' },
  savoie:     { en: 'Savoie',   fr: 'Savoie' },
  provence:   { en: 'Provence', fr: 'Provence' },
  bretagne:   { en: 'Brittany', fr: 'Bretagne' },
  normandie:  { en: 'Normandy', fr: 'Normandie' },
  basque:     { en: 'Basque',   fr: 'Pays Basque' },
  lyonnais:   { en: 'Lyon',     fr: 'Lyonnais' },
  nord:       { en: 'Nord',     fr: 'Nord' },
  american:         { en: 'American',       fr: 'Américaine' },
  asian:            { en: 'Asian',          fr: 'Asiatique' },
  fusion:           { en: 'Fusion',         fr: 'Fusion' },
  spanish:          { en: 'Spanish',        fr: 'Espagnole' },
  middle_eastern:   { en: 'Middle Eastern', fr: 'Moyen-Orient' },
  north_african:    { en: 'North African',  fr: 'Afrique du Nord' },
  japanese:         { en: 'Japanese',       fr: 'Japonaise' },
  northern_italian: { en: 'Northern Italy', fr: 'Italie du Nord' },
};

// ─── Emoji map ────────────────────────────────────────────────

function pizzaEmoji(id: string): string {
  if (id.includes('diavola') || id.includes('nduja') || id.includes('spicy')) return '🌶️';
  if (id.includes('formaggi') || id.includes('raclette') || id.includes('tartiflette') || id.includes('chevre') || id.includes('brie')) return '🧀';
  if (id.includes('burrata')) return '✨';
  if (id.includes('flamm') || id.includes('tarte_flambee')) return '🥐';
  if (id.includes('salmon') || id.includes('tuna') || id.includes('tonno')) return '🐟';
  if (id.includes('bbq') || id.includes('chicken')) return '🍗';
  if (id.includes('nutella') || id.includes('fraises')) return '🍓';
  if (id.includes('tatin') || id.includes('camembert')) return '🍎';
  if (id.includes('chocolat') || id.includes('poire')) return '🍐';
  if (id.includes('brulee')) return '🍮';
  if (id.includes('speculoos')) return '🍌';
  if (id.includes('miel') || id.includes('honey')) return '🍯';
  if (id.includes('funghi') || id.includes('mushroom')) return '🍄';
  if (id.includes('prosciutto') || id.includes('bayonne') || id.includes('speck')) return '🥩';
  return '🍕';
}

// ─── Inline styles ────────────────────────────────────────────

const S = {
  pill: (active: boolean, variant: 'terra' | 'sage' | 'default' = 'default'): React.CSSProperties => ({
    fontSize: '13px', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
    border: active
      ? (variant === 'terra' ? '1px solid #C4522A' : variant === 'sage' ? '1px solid #6B7A5A' : '1px solid #1A1612')
      : '1px solid #E0D8CF',
    background: active
      ? (variant === 'terra' ? '#C4522A' : variant === 'sage' ? '#6B7A5A' : '#1A1612')
      : '#FDFBF7',
    color: active ? 'white' : '#3D3530',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.12s',
    userSelect: 'none' as const,
    flexShrink: 0,
  }),
  winePill: (active: boolean): React.CSSProperties => ({
    fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
    border: active ? '1px solid #7A4A8A' : '1px solid #DBC8E8',
    background: active ? '#7A4A8A' : '#FDFBF7',
    color: active ? 'white' : '#7A4A8A',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.12s',
    userSelect: 'none' as const,
    flexShrink: 0,
    minWidth: '80px',
  }),
  navPill: (active: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'center' as const, padding: '7px 4px',
    borderRadius: '10px', fontSize: '11px', cursor: 'pointer',
    border: '1px solid #E0D8CF',
    background: active ? '#1A1612' : 'transparent',
    color: active ? '#F5F0E8' : '#8A7F78',
    fontWeight: active ? 500 : 400,
    transition: 'all 0.12s',
  }),
  secHdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    cursor: 'pointer', padding: '8px 12px 4px',
  } as React.CSSProperties,
  secTitle: {
    fontSize: '10px', color: '#3D3530', textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: '5px',
  } as React.CSSProperties,
  secBadge: (show: boolean): React.CSSProperties => ({
    fontSize: '9px', background: '#C4522A', color: 'white',
    borderRadius: '10px', padding: '1px 5px', display: show ? 'inline' : 'none',
  }),
  secBody: (open: boolean): React.CSSProperties => ({
    display: open ? 'flex' : 'none', flexDirection: 'column', gap: '6px',
    padding: '0 12px 8px',
  }),
  subSec: {
    background: '#F5F0E8', borderRadius: '8px', padding: '7px 9px',
  } as React.CSSProperties,
  subLbl: {
    fontSize: '9px', color: '#8A7F78', textTransform: 'uppercase' as const,
    letterSpacing: '0.06em', marginBottom: '5px', fontWeight: 500, display: 'block',
  } as React.CSSProperties,
  pillRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: '5px',
  } as React.CSSProperties,
  card: (selected: boolean): React.CSSProperties => ({
    background: selected ? '#FFF8F5' : '#FDFBF7',
    borderRadius: '12px',
    border: selected ? '1.5px solid #C4522A' : '1.5px solid #E0D8CF',
    overflow: 'hidden', cursor: 'pointer', transition: 'all 0.12s',
  }),
  cardEmoji: {
    fontSize: '17px', flexShrink: 0, width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#F0EBE3', borderRadius: '7px',
  } as React.CSSProperties,
  tag: (type: 'default' | 'spicy' | 'season' | 'special'): React.CSSProperties => ({
    fontSize: '9px', padding: '2px 6px', borderRadius: '10px',
    ...(type === 'spicy'   ? { background: '#FFF0EC', color: '#C4522A', border: '0.5px solid #F5C4B3' }
      : type === 'season'  ? { background: '#EFF5E8', color: '#3B6D11', border: '0.5px solid #C0DD97' }
      : type === 'special' ? { background: '#FEF9EC', color: '#9A7020', border: '0.5px solid #FAC775' }
      :                      { background: '#F0EBE3', color: '#6B7A5A', border: '0.5px solid #E0D8CF' }),
  }),
  qtyBtn: {
    width: '26px', height: '26px', borderRadius: '7px',
    border: '1.5px solid #C8C0B8', background: '#F5F0E8',
    fontSize: '15px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1A1612', fontWeight: 500, flexShrink: 0,
  } as React.CSSProperties,
  addBtn: {
    height: '26px', padding: '0 12px', borderRadius: '13px',
    border: 'none', background: '#C4522A',
    fontSize: '11px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' as const,
    letterSpacing: '0.02em',
  } as React.CSSProperties,
  ingBadge: {
    fontSize: '9px', padding: '1px 6px', borderRadius: '8px',
    background: '#F0EBE3', color: '#8A7F78',
    marginLeft: '6px', whiteSpace: 'nowrap' as const,
    flexShrink: 0, marginTop: '2px',
  } as React.CSSProperties,
};

// ─── Flavour slider ───────────────────────────────────────────

function FlavorSlider({ leftLabel, rightLabel, value, onChange }: {
  leftLabel: string; rightLabel: string;
  value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr 54px', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '10px', color: '#8A7F78', textAlign: 'right' }}>{leftLabel}</span>
        <input
          type="range" min={1} max={5} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ accentColor: '#C4522A', width: '100%' }}
        />
        <span style={{ fontSize: '10px', color: '#8A7F78' }}>{rightLabel}</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: '9px', color: value === 3 ? '#C4522A' : 'transparent', fontWeight: 500, marginTop: '1px' }}>
        Any
      </div>
    </div>
  );
}

// ─── Filter group (3-column grid with subtitle) ───────────────
function FilterGroup({ label, items }: {
  label: string;
  items: { key: string; title: string; badge?: string; open: boolean; onToggle: () => void; children: React.ReactNode }[];
}) {
  const openItem = items.find(i => i.open);
  return (
    <div style={{ borderBottom: '0.5px solid #F0EBE3', paddingBottom: '4px' }}>
      {/* Group subtitle */}
      <div style={{
        fontSize: '10px', fontWeight: 700, color: '#1A1612',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        padding: '10px 12px 3px',
        fontFamily: 'DM Mono, monospace',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: '#C4522A', flexShrink: 0, display: 'inline-block',
        }} />
        {label}
      </div>
      {/* Header row — 3 columns or full width if single item */}
      <div style={{ display: 'grid', gridTemplateColumns: items.length === 1 ? '1fr' : '1fr 1fr 1fr' }}>
        {items.map(item => (
          <div
            key={item.key}
            onClick={item.onToggle}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 8px',
              margin: '3px 4px',
              cursor: 'pointer',
              borderRadius: '8px',
              border: item.open
                ? '1px solid rgba(196,82,42,0.3)'
                : '1px solid rgba(26,22,18,0.07)',
              background: item.open
                ? 'rgba(196,82,42,0.07)'
                : 'rgba(26,22,18,0.03)',
              transition: 'all 0.12s',
            }}
          >
            <span style={{
              fontSize: '10px',
              color: item.open ? '#C4522A' : '#3D3530',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontWeight: item.open ? 700 : 500,
              fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              {item.title}
              {item.badge && (
                <span style={{
                  background: '#C4522A', color: 'white',
                  borderRadius: '10px', fontSize: '8px',
                  padding: '1px 5px', fontWeight: 600,
                }}>
                  {item.badge}
                </span>
              )}
            </span>
            <span style={{
              fontSize: '11px',
              color: item.open ? '#C4522A' : '#8A7F78',
              transform: item.open ? 'rotate(180deg)' : 'none',
              transition: 'all 0.15s', display: 'inline-block',
              marginLeft: '3px', flexShrink: 0,
            }}>⌄</span>
          </div>
        ))}
      </div>
      {/* Full-width expanded content */}
      {openItem && (
        <div style={{
          borderTop: '0.5px solid #F0EBE3',
          background: '#FDFBF7',
          padding: '10px 12px 12px',
        }}>
          {openItem.children}
        </div>
      )}
    </div>
  );
}

// ─── Filter section ───────────────────────────────────────────

function FilterSection({ title, badge, open, onToggle, children }: {
  title: string; badge?: string; open: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '0.5px solid #F0EBE3' }}>
      <div style={S.secHdr} onClick={onToggle}>
        <span style={S.secTitle}>
          {title}
          {badge && <span style={S.secBadge(true)}>{badge}</span>}
        </span>
        <span style={{
          fontSize: '10px', color: '#8A7F78',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s', display: 'inline-block',
        }}>▾</span>
      </div>
      <div style={S.secBody(open)}>{children}</div>
    </div>
  );
}

// ─── Pizza card ───────────────────────────────────────────────

function PizzaCard({ pizza, qty, locale, onQtyChange, onTap, styleKey }: {
  pizza: Pizza; qty: number; locale: string; styleKey?: string;
  onQtyChange: (delta: number, e: React.MouseEvent) => void;
  onTap: () => void;
}) {
  const l = locale as 'en' | 'fr';
  const name = pizza.name[l] ?? pizza.name.en;
  const budget = '€'.repeat(pizza.budget);

  return (
    <div style={S.card(qty > 0)} onClick={onTap}>
      <div style={{ display: 'flex', gap: '8px', padding: '6px 10px 6px' }}>
        {/* Left: image spanning all rows */}
        <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#1A1612' }}>
          <img
            src={(() => {
              const variantMap: Record<string, string> = {
                pizza_romana: `_pizza_romana`,
                newyork: `_newyork`,
                pan: `_pan`,
                roman: `_roman`,
              };
              const suffix = styleKey && variantMap[styleKey];
              if (suffix) return `/pizzas/${pizza.id}${suffix}.webp`;
              return `/pizzas/${pizza.id}.webp`;
            })()}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        {/* Right: 3 rows */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
          {/* Row 1: name · budget */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A1612', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            <span style={{ fontSize: '11px', color: '#8A7F78', flexShrink: 0 }}>{budget}</span>
          </div>
          {/* Row 2: story tagline — 2 line max */}
          {pizza.story && (
            <div style={{ fontSize: '11px', color: '#8A7F78', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
              {pizza.story[l] ?? pizza.story.en}
            </div>
          )}
          {/* Row 3: occasion tags · wine pairing · time · qty controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {pizza.occasion.slice(0, 2).map(tag => {
              const OCCASION_LABELS: Record<string, { en: string; fr: string }> = {
                classic: { en: 'Classic', fr: 'Classique' },
                spicy:   { en: 'Spicy',   fr: 'Épicé' },
                kids:    { en: 'Kids',    fr: 'Enfants' },
                party:   { en: 'Party',   fr: 'Fête' },
                impress: { en: 'Impress', fr: 'Impressionner' },
                quick:   { en: 'Quick',   fr: 'Rapide' },
              };
              return (
                <span key={tag} style={{ fontSize: '9px', color: 'var(--smoke)', background: 'var(--cream)', borderRadius: '10px', padding: '2px 6px', flexShrink: 0, fontFamily: 'DM Sans, sans-serif' }}>
                  {OCCASION_LABELS[tag]?.[l] ?? OCCASION_LABELS[tag]?.en ?? tag}
                </span>
              );
            })}
            {pizza.winePairing?.[0] && (
              <span style={{ fontSize: '10px', color: '#8A7F78', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px', flexShrink: 1 }}>
                {pizza.winePairing[0][l] ?? pizza.winePairing[0].en}
              </span>
            )}
            {pizza.winePairing?.[0] && (
              <span style={{ fontSize: '10px', color: '#C8C0B8' }}>·</span>
            )}
            <span style={{ fontSize: '10px', color: '#8A7F78', flexShrink: 0 }}>
              {pizza.prepMinutes} min
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button style={{ ...S.qtyBtn, visibility: qty > 0 ? 'visible' : 'hidden' }} onClick={e => onQtyChange(-1, e)}>−</button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#C4522A', minWidth: '14px', textAlign: 'center', visibility: qty > 0 ? 'visible' : 'hidden' }}>{qty}</span>
              <button style={S.qtyBtn} onClick={e => onQtyChange(1, e)}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pizza sheet ──────────────────────────────────────────────

function PizzaSheet({ pizza, qty, locale, styleKey, onQtyChange, onClose }: {
  pizza: Pizza; qty: number; locale: string; styleKey?: string;
  onQtyChange: (delta: number) => void;
  onClose: () => void;
}) {
  const l = locale as 'en' | 'fr';

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const variantMap: Record<string, string> = {
    pizza_romana: '_pizza_romana',
    newyork: '_newyork',
    pan: '_pan',
    roman: '_roman',
  };
  const suffix = styleKey && variantMap[styleKey];
  const imgSrc = suffix
    ? `/pizzas/${pizza.id}${suffix}.webp`
    : `/pizzas/${pizza.id}.webp`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(26,22,18,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: 'calc(100dvh - 64px - 60px - env(safe-area-inset-bottom))',
          background: '#FDFBF7',
          borderRadius: '20px 20px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Image — takes all remaining space, shrinks to zero if needed */}
        <div style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          maxHeight: 'clamp(160px, 40dvh, 320px)',
          background: '#1A1612',
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
        }}>
          <img
            src={imgSrc}
            alt={pizza.name[l] ?? pizza.name.en}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              display: 'block',
            }}
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (suffix && !img.src.endsWith(`${pizza.id}.webp`)) {
                img.src = `/pizzas/${pizza.id}.webp`;
              } else {
                img.style.display = 'none';
              }
            }}
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              width: '28px', height: '28px',
              background: 'rgba(26,22,18,0.6)',
              border: 'none', borderRadius: '50%',
              color: 'white', fontSize: '13px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >&#x2715;</button>
        </div>

        {/* Info — title, ingredients, wine — fixed height, never compressed */}
        <div style={{
          flexShrink: 0,
          padding: '12px 16px 8px',
          background: '#FDFBF7',
        }}>
          <div style={{
            fontSize: '18px', fontWeight: 700,
            fontFamily: 'Playfair Display, serif',
            color: '#1A1612', marginBottom: '6px',
          }}>
            {pizza.name[l] ?? pizza.name.en}
          </div>

          {pizza.ingredients.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap',
              gap: '4px', marginBottom: '6px',
            }}>
              {pizza.ingredients.map(ing => (
                <span key={ing.id} style={{
                  fontSize: '11px', color: '#3D3530',
                  background: '#F5F0E8', borderRadius: '20px',
                  padding: '2px 8px', border: '1px solid #E0D8CF',
                }}>
                  {ing.name[l] ?? ing.name.en}
                </span>
              ))}
            </div>
          )}

          {pizza.wineNote && (
            <div style={{
              fontSize: '11px', color: '#7A4A8A',
              background: '#F5EDF8', borderRadius: '8px',
              padding: '5px 10px', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600, marginRight: '4px' }}>
                {l === 'fr' ? 'Accord vin :' : 'Wine pairing:'}
              </span>
              {pizza.wineNote[l] ?? pizza.wineNote.en}
            </div>
          )}

          {pizza.funNote && (
            <div style={{
              fontSize: '11px', color: '#6B7A5A',
              fontStyle: 'italic',
              marginTop: '4px',
              paddingLeft: '2px',
            }}>
              {pizza.funNote[l] ?? pizza.funNote.en}
            </div>
          )}
        </div>

        {/* Footer — qty controls, always visible */}
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid #E0D8CF',
          padding: '10px 16px 0',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          background: '#FDFBF7',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: '13px', color: '#8A7F78',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {l === 'fr' ? 'Combien ?' : 'How many?'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={e => { e.stopPropagation(); onQtyChange(-1); }}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: '1.5px solid #E0D8CF', background: '#FDFBF7',
                  cursor: 'pointer', fontSize: '20px', color: '#1A1612',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >&#x2212;</button>
              <span style={{
                fontSize: '20px', fontWeight: 700, color: '#1A1612',
                fontFamily: 'DM Mono, monospace',
                minWidth: '28px', textAlign: 'center',
              }}>
                {qty}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onQtyChange(1); }}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: 'none', background: '#C4522A',
                  cursor: 'pointer', fontSize: '20px', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >&#x2B;</button>
            </div>
          </div>
          {qty > 0 && (
            <div style={{
              marginTop: '6px', fontSize: '11px',
              color: '#6B7A5A', fontFamily: 'DM Sans, sans-serif',
              textAlign: 'center',
            }}>
              {qty === 1
                ? (l === 'fr' ? '1 ajouté — continuer' : '1 added — keep browsing')
                : (l === 'fr'
                    ? `${qty} ajoutés — continuer`
                    : `${qty} added — keep browsing`)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Shopping List ────────────────────────────────────────────────

const SECTION_ORDER: IngredientCategory[] = ['veg', 'cheese', 'base', 'meat', 'seafood', 'sauce', 'finish', 'spice'];

const SECTION_LABELS: Record<IngredientCategory, Locale> = {
  veg:     { en: 'Produce',         fr: 'Fruits & Légumes' },
  cheese:  { en: 'Dairy & Chilled', fr: 'Crèmerie & Frais' },
  base:    { en: 'Dairy & Chilled', fr: 'Crèmerie & Frais' },
  meat:    { en: 'Deli & Meat',     fr: 'Charcuterie & Viande' },
  seafood: { en: 'Fish & Seafood',  fr: 'Poisson & Fruits de mer' },
  sauce:   { en: 'Sauce & Pantry',  fr: 'Sauces & Épicerie' },
  finish:  { en: 'Sauce & Pantry',  fr: 'Sauces & Épicerie' },
  spice:   { en: 'Sauce & Pantry',  fr: 'Sauces & Épicerie' },
};


function formatQty(total: number, unit: string, locale: string): string {
  const l = locale as 'en' | 'fr';
  const unitLabels: Record<string, Locale> = {
    g:      { en: 'g',       fr: 'g' },
    ml:     { en: 'ml',      fr: 'ml' },
    pcs:    { en: 'pcs',     fr: 'pcs' },
    slices: { en: 'slices',  fr: 'tranches' },
    leaves: { en: 'leaves',  fr: 'feuilles' },
    sprigs: { en: 'sprigs',  fr: 'brins' },
    tbsp:   { en: 'tbsp',    fr: 'càs' },
    pinch:  { en: 'pinches', fr: 'pincées' },
  };
  const label = unitLabels[unit]?.[l] ?? unit;
  return `${total} ${label}`;
}

interface ShoppingItem {
  id: string;
  name: Locale;
  category: IngredientCategory;
  totalAmount?: number;
  unit?: string;
  qtyNote?: string;
  isCommonPantry?: boolean;
  hardToFind?: boolean;
  goodEnough?: { name: Locale };
  compromise?: { name: Locale };
  localSwap?: Partial<Record<string, { name: Locale }>>;
  forPizzas: string[];
}

function buildShoppingList(
  qtys: Record<string, number>,
  locale: string,
  styleKey?: string,
): { sections: Array<{ category: IngredientCategory; label: string; items: ShoppingItem[] }> } {
  const l = locale as 'en' | 'fr';
  const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];
  const ingredientMap: Record<string, ShoppingItem & { pizzaCount: Record<string, number> }> = {};

  Object.entries(qtys).forEach(([pizzaId, qty]) => {
    if (qty <= 0) return;
    const pizza = allPizzas.find(p => p.id === pizzaId);
    if (!pizza) return;

    pizza.ingredients.forEach((ing) => {
      if (!ingredientMap[ing.id]) {
        ingredientMap[ing.id] = {
          id: ing.id,
          name: ing.name,
          category: ing.category,
          totalAmount: undefined,
          unit: undefined,
          qtyNote: undefined,
          isCommonPantry: ing.isCommonPantry,
          hardToFind: ing.hardToFind,
          goodEnough: ing.goodEnough,
          compromise: ing.compromise,
          localSwap: ing.localSwap as Partial<Record<string, { name: Locale }>> | undefined,
          forPizzas: [],
          pizzaCount: {},
        };
      }
      const item = ingredientMap[ing.id];
      if (ing.qtyPerPizza) {
        const multiplier = styleKey
          ? ((ing as import('../lib/toppingTypes').Ingredient).qtyMultiplierByStyle?.[styleKey as import('../lib/toppingTypes').StyleKey] ?? 1)
          : 1;
        const prev = item.totalAmount ?? 0;
        item.totalAmount = prev + ing.qtyPerPizza.amount * qty * multiplier;
        item.unit = ing.qtyPerPizza.unit;
        item.qtyNote = l === 'fr' ? ing.qtyPerPizza.noteFR : ing.qtyPerPizza.noteEN;
      }
      const pizzaName = pizza.name[l] ?? pizza.name.en;
      if (!item.pizzaCount[pizzaName]) item.pizzaCount[pizzaName] = 0;
      item.pizzaCount[pizzaName] += qty;
    });
  });

  Object.values(ingredientMap).forEach(item => {
    item.forPizzas = Object.entries(item.pizzaCount).map(([name, count]) =>
      count > 1 ? `${name} ×${count}` : name
    );
  });

  const sectionMap: Record<string, ShoppingItem[]> = {};
  const processedSections = new Set<string>();

  SECTION_ORDER.forEach(cat => {
    const label = SECTION_LABELS[cat][l];
    if (processedSections.has(label)) return;
    processedSections.add(label);
    const items = Object.values(ingredientMap).filter(item => {
      const itemLabel = SECTION_LABELS[item.category]?.[l];
      return itemLabel === label;
    });
    if (items.length > 0) sectionMap[label] = items;
  });

  const sections = Object.entries(sectionMap).map(([label, items]) => ({
    category: items[0].category,
    label,
    items: [...items].sort((a, b) => {
      if (a.isCommonPantry && !b.isCommonPantry) return 1;
      if (!a.isCommonPantry && b.isCommonPantry) return -1;
      return 0;
    }),
  }));

  return { sections };
}

const LOCATIONS = [
  { key: 'singapore',    label: 'Singapore' },
  { key: 'france',       label: 'France' },
  { key: 'uk',           label: 'UK' },
  { key: 'us',           label: 'US' },
  { key: 'australia',    label: 'Australia' },
  { key: 'international',label: 'International' },
];

function ShoppingList({ qtys, locale, numItems, styleKey, recipeIngredients }: {
  qtys: Record<string, number>;
  locale: string;
  numItems: number;
  styleKey?: string;
  recipeIngredients?: Array<{ name: string; amount: string }>;
}) {
  const l = locale as 'en' | 'fr';
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [shoppingLocation, setShoppingLocation] = useState<string>('international');
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bh_shopping_location');
      if (saved) setShoppingLocation(saved);
    } catch {}
  }, []);

  const { sections } = buildShoppingList(qtys, locale, styleKey);
  const totalSelected = Object.values(qtys).filter(q => q > 0).length;

  // Pre-tick pantry items
  useEffect(() => {
    setTicked(prev => {
      const next = { ...prev };
      sections.forEach(s => s.items.forEach(item => {
        if (item.isCommonPantry && !(item.id in next)) next[item.id] = true;
      }));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSelected]);

  function toggleTick(id: string) {
    setTicked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSub(id: string) {
    setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function setLocation(loc: string) {
    setShoppingLocation(loc);
    try { localStorage.setItem('bh_shopping_location', loc); } catch {}
    setShowLocationPicker(false);
  }

  function buildShareText(): string {
    const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];
    const pizzaLines = Object.entries(qtys)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const p = allPizzas.find(x => x.id === id);
        return p ? (p.name[l] ?? p.name.en) + (q > 1 ? ` ×${q}` : '') : id;
      }).join(', ');

    let text = `Baker Hub — ${l === 'fr' ? 'Liste de courses Pizza Party' : 'Pizza Party Shopping List'}\n`;
    text += `${pizzaLines}\n\n`;

    sections.forEach(section => {
      text += `${section.label.toUpperCase()}\n`;
      section.items.forEach(item => {
        const tick = ticked[item.id] ? '✓' : '☐';
        const name = item.name[l] ?? item.name.en;
        const qty = item.totalAmount && item.unit ? formatQty(item.totalAmount, item.unit, locale) : '';
        text += `${tick} ${name}${qty ? '  —  ' + qty : ''}\n`;
      });
      text += '\n';
    });

    if (recipeIngredients?.length) {
      text += `${l === 'fr' ? 'POUR VOTRE PÂTE' : 'FOR YOUR DOUGH'}\n`;
      recipeIngredients.forEach(i => { text += `☐ ${i.name}  —  ${i.amount}\n`; });
      text += '\n';
    }
    text += `bakerhub.app`;
    return text;
  }

  function handleShare() {
    const text = buildShareText();
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
    }
  }


  if (totalSelected === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: '#8A7F78', fontSize: '13px', textAlign: 'center' }}>
        {l === 'fr' ? 'Ajoutez des pizzas pour voir la liste de courses' : 'Add pizzas to see your shopping list'}
      </div>
    );
  }

  const currentLocationLabel = LOCATIONS.find(loc => loc.key === shoppingLocation)?.label ?? 'International';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', background: '#FDFBF7', borderBottom: '1px solid #E0D8CF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: '#8A7F78' }}>
            {(() => {
              const toBuy = sections.reduce((acc, s) => acc + s.items.filter(i => !ticked[i.id]).length, 0);
              return l === 'fr'
                ? `${totalSelected} pizza${totalSelected > 1 ? 's' : ''} sélectionnée${totalSelected > 1 ? 's' : ''} · ${toBuy} ingrédient${toBuy > 1 ? 's' : ''} à acheter`
                : `${totalSelected} pizza${totalSelected > 1 ? 's' : ''} selected · ${toBuy} ingredient${toBuy > 1 ? 's' : ''} to buy`;
            })()}
          </span>
          <button
            onClick={() => setShowLocationPicker(v => !v)}
            style={{ fontSize: '11px', color: '#8A7F78', background: 'none', border: '1px solid #E0D8CF', borderRadius: '12px', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {shoppingLocation === 'singapore'
              ? (l === 'fr' ? `Où acheter : ${currentLocationLabel} ▾` : `Where to shop: ${currentLocationLabel} ▾`)
              : (l === 'fr' ? `Ma région : ${currentLocationLabel} ▾` : `My region: ${currentLocationLabel} ▾`)
            }
          </button>
        </div>
        {showLocationPicker && (
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {LOCATIONS.map(loc => (
              <button
                key={loc.key}
                onClick={() => setLocation(loc.key)}
                style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer',
                  border: shoppingLocation === loc.key ? '1px solid #C4522A' : '1px solid #E0D8CF',
                  background: shoppingLocation === loc.key ? '#C4522A' : '#FDFBF7',
                  color: shoppingLocation === loc.key ? 'white' : '#3D3530',
                }}
              >
                {loc.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
        {sections.map(section => (
          <div key={section.label}>
            <div style={{ padding: '7px 12px 4px 11px', background: '#F5F0E8', borderLeft: '3px solid #C4522A' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#3D3530', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'DM Mono, monospace' }}>
                {section.label}
              </span>
            </div>

            {section.items.map(item => {
              const name = item.name[l] ?? item.name.en;
              const isTicked = ticked[item.id] ?? false;
              const isExpanded = expandedSubs[item.id] ?? false;
              const hasSubInfo = !!(item.goodEnough || item.compromise);
              const showSubProactively = !!item.hardToFind;
              const localNote = item.localSwap?.[shoppingLocation]?.name;

              return (
                <div key={item.id} style={{ borderBottom: '0.5px solid #F0EBE3', background: isTicked ? '#FAFAF8' : '#FDFBF7' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 12px', gap: '10px' }}>
                    <button
                      onClick={() => toggleTick(item.id)}
                      style={{
                        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                        border: isTicked ? 'none' : '1.5px solid #C8C0B8',
                        background: isTicked ? (item.isCommonPantry ? '#C8C0B8' : '#6B7A5A') : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: '1px',
                      }}
                    >
                      {isTicked && (
                        <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l3 3 5-5"/>
                        </svg>
                      )}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                        <span
                          onClick={() => hasSubInfo && toggleSub(item.id)}
                          style={{
                            fontSize: '13px',
                            color: isTicked ? '#B0A89E' : '#1A1612',
                            textDecoration: 'none',
                            cursor: hasSubInfo ? 'pointer' : 'default',
                            fontFamily: 'DM Sans, sans-serif',
                          }}
                        >
                          {name}
                          {item.isCommonPantry && (
                            <span style={{ fontSize: '10px', color: '#8A7F78', marginLeft: '5px', fontStyle: 'italic' }}>pantry</span>
                          )}
                          {hasSubInfo && !showSubProactively && (
                            <span style={{ fontSize: '10px', color: '#C8C0B8', marginLeft: '4px' }}>{isExpanded ? '▲' : '▼'}</span>
                          )}
                        </span>
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                          {item.totalAmount && item.unit ? formatQty(item.totalAmount, item.unit, locale) : ''}
                        </span>
                      </div>

                      {item.qtyNote && (
                        <div style={{ fontSize: '10px', color: '#A09890', marginTop: '1px' }}>{item.qtyNote}</div>
                      )}

                      {showSubProactively && (
                        <div style={{ marginTop: '3px' }}>
                          {item.goodEnough && (
                            <div style={{ fontSize: '11px', color: '#6B7A5A' }}>
                              <span style={{ fontWeight: 500 }}>{l === 'fr' ? 'Très proche :' : 'Also great:'}</span>
                              {' '}{item.goodEnough.name[l] ?? item.goodEnough.name.en}
                            </div>
                          )}
                          {item.compromise && (
                            <div style={{ fontSize: '11px', color: '#8A7F78' }}>
                              <span style={{ fontWeight: 500 }}>{l === 'fr' ? 'À défaut :' : 'If not available:'}</span>
                              {' '}{item.compromise.name[l] ?? item.compromise.name.en}
                            </div>
                          )}
                          {localNote && shoppingLocation !== 'international' && (
                            <div style={{ fontSize: '11px', color: '#8A7F78', marginTop: '1px' }}>
                              <span style={{ fontWeight: 500 }}>{LOCATIONS.find(loc => loc.key === shoppingLocation)?.label ?? ''}:</span>
                              {' '}{localNote[l] ?? localNote.en}
                            </div>
                          )}
                        </div>
                      )}

                      {!showSubProactively && isExpanded && hasSubInfo && (
                        <div style={{ marginTop: '3px', padding: '6px 8px', background: '#F5F0E8', borderRadius: '6px' }}>
                          {item.goodEnough && (
                            <div style={{ fontSize: '11px', color: '#6B7A5A', marginBottom: '2px' }}>
                              <span style={{ fontWeight: 500 }}>{l === 'fr' ? 'Très proche :' : 'Also great:'}</span>
                              {' '}{item.goodEnough.name[l] ?? item.goodEnough.name.en}
                            </div>
                          )}
                          {item.compromise && (
                            <div style={{ fontSize: '11px', color: '#8A7F78' }}>
                              <span style={{ fontWeight: 500 }}>{l === 'fr' ? 'À défaut :' : 'If not available:'}</span>
                              {' '}{item.compromise.name[l] ?? item.compromise.name.en}
                            </div>
                          )}
                          {localNote && shoppingLocation !== 'international' && (
                            <div style={{ fontSize: '11px', color: '#8A7F78', marginTop: '2px' }}>
                              <span style={{ fontWeight: 500 }}>{LOCATIONS.find(loc => loc.key === shoppingLocation)?.label ?? ''}:</span>
                              {' '}{localNote[l] ?? localNote.en}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {recipeIngredients && recipeIngredients.length > 0 && (
          <div>
            <div style={{ padding: '7px 12px 4px 11px', background: '#F5F0E8', borderLeft: '3px solid #C4522A' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#3D3530', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'DM Mono, monospace' }}>
                {l === 'fr' ? 'Pour votre pâte' : 'For your dough'}
              </span>
            </div>
            {recipeIngredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', gap: '10px', borderBottom: '0.5px solid #F0EBE3' }}>
                <button
                  onClick={() => toggleTick('dough_' + i)}
                  style={{
                    width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                    border: ticked['dough_' + i] ? 'none' : '1.5px solid #C8C0B8',
                    background: ticked['dough_' + i] ? '#6B7A5A' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {ticked['dough_' + i] && (
                    <svg viewBox="0 0 12 12" width={10} height={10} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 6l3 3 5-5"/>
                    </svg>
                  )}
                </button>
                <span style={{ fontSize: '13px', color: ticked['dough_' + i] ? '#B0A89E' : '#1A1612', flex: 1, textDecoration: 'none' }}>
                  {ing.name}
                </span>
                <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Mono, monospace' }}>{ing.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share + Copy buttons */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid #E0D8CF', background: '#FDFBF7' }}>
        <button
          onClick={handleShare}
          style={{
            width: '100%', padding: '11px', background: '#1A1612', color: '#F5F0E8',
            border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
          }}
        >
          <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="#F5F0E8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3v10M6 7l4-4 4 4"/>
            <path d="M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2"/>
          </svg>
          {l === 'fr' ? 'Partager la liste' : 'Share list'}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export default function ToppingSelector({ locale, numItems, activePill, onPillChange, t, styleKey, controlledQtys, onQtysChange, hidePillBar, onStyleChange, activeStyleKey, onStyleKeyChange }: Props) {
  const l = locale as 'en' | 'fr';

  // Filter state
  const [filter, setFilter] = useState<FilterState>({
    ...DEFAULT_FILTER,
    styleKey: styleKey as import('../lib/toppingTypes').StyleKey | undefined,
  });

  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  useEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setSummaryVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Section open/closed — Occasion open by default, all others closed
  const [open, setOpen] = useState<Record<string, boolean>>({
    occasion: false, base: false, region: false, season: false,
    diet: false, wine: false, budget: false, budget_complexity: false,
    flavour: false, ingredient: false,
  });

  const FILTER_GROUPS: Record<string, string[]> = {
    basics:     ['occasion', 'base', 'region'],
    refine:     ['season', 'diet', 'wine'],
    deeper:     ['budget', 'budget_complexity', 'flavour'],
    ingredient: ['ingredient'],
  };

  function togOpen(key: string) {
    setOpen(prev => {
      const next = { ...prev };
      const group = Object.values(FILTER_GROUPS).find(g => g.includes(key));
      if (group) {
        group.forEach(k => { next[k] = false; });
      }
      next[key] = !prev[key];
      return next;
    });
  }

  // Region parent selection
  const [regionParent, setRegionParent] = useState<'all' | 'italy' | 'france' | 'fusion'>('all');

  // Quantities — controlled from parent when controlledQtys provided, otherwise internal
  const [internalQtys, setInternalQtys] = useState<Qty>({});
  const qtys: Qty = controlledQtys ?? internalQtys;
  const getQty = (id: string) => qtys[id] ?? 0;
  const totalQty = Object.values(qtys).reduce((a, b) => a + b, 0);
  const changeQty = (id: string, delta: number) => {
    const next = { ...qtys, [id]: Math.max(0, (qtys[id] ?? 0) + delta) };
    if (!next[id]) delete next[id];
    if (controlledQtys !== undefined) {
      onQtysChange?.(next);
    } else {
      setInternalQtys(next);
    }
  };

  // Summary open
  const [sumOpen, setSumOpen] = useState(false);

  // Sheet
  const [sheetId, setSheetId] = useState<string | null>(null);
  const sheetPizza = sheetId ? (getPizzaById(sheetId) ?? null) : null;

  // Dessert expanded
  const [dessertOpen, setDessertOpen] = useState(false);

  // Style picker popup
  const [showStylePicker, setShowStylePicker] = useState(false);

  // Flavour slider values — separate from filter for UI display
  const [flavourUI, setFlavourUI] = useState({ richness: 3, boldness: 3, creative: 3, refined: 3 });

  // Filtered pizzas
  const filtered = useMemo(() =>
    filterPizzas(PIZZAS, { ...filter, styleKey: (styleKey as import('../lib/toppingTypes').StyleKey) ?? undefined }),
    [filter, styleKey]
  );

  // Current season for auto-detect label
  const currentSeason = getCurrentSeason();

  // unused import guard
  void getFilterCounts;

  // Per-option counts for smart filter hiding
  const filterCounts = useMemo(() => {
    const base = { ...filter, styleKey: styleKey ?? undefined } as import('../lib/toppingTypes').FilterState;
    const countFor = (overrides: Partial<import('../lib/toppingTypes').FilterState>) =>
      filterPizzas(PIZZAS, { ...base, ...overrides }).length;
    return {
      occasion: Object.fromEntries(
        (['classic','spicy','kids','party','impress','quick'] as const)
          .map(v => [v, countFor({ occasion: [v] })])
      ) as Record<string, number>,
      base: Object.fromEntries(
        (['tomato_raw','tomato_cooked','tomato_concentrate',
          'bianca_cream','bianca_oil','bianca_ricotta',
          'pesto','nduja','truffle_cream','bbq','miso',
          'harissa','zaatar','vodka_cream','other'] as const)
          .map(v => [v, countFor({ base: v })])
      ) as Record<string, number>,
      region: Object.fromEntries(
        (['neapolitan','roman','sicilian','ligurian','venetian',
          'calabrian','alsace','bretagne','savoie','provence',
          'basque','lyonnais','nord','normandie','american',
          'asian','fusion','spanish','middle_eastern',
          'north_african','japanese','northern_italian'] as const)
          .map(v => [v, countFor({ region: v })])
      ) as Record<string, number>,
      budget: Object.fromEntries(
        ([1,2,3] as const).map(v => [v, countFor({ budget: v })])
      ) as Record<string, number>,
      complexity: Object.fromEntries(
        ([1,2,3] as const).map(v => [v, countFor({ complexity: v })])
      ) as Record<string, number>,
    };
  }, [styleKey, filter]);

  // ── Filter helpers ──────────────────────────────────────────

  const setBase = (v: BaseType | null) =>
    setFilter((p: FilterState) => ({ ...p, base: v }));

  const setRegion = (v: RegionTag | null) =>
    setFilter((p: FilterState) => ({ ...p, region: v }));

  const toggleOccasion = (v: OccasionTag) =>
    setFilter((p: FilterState) => ({
      ...p,
      occasion: p.occasion.includes(v) ? p.occasion.filter(o => o !== v) : [...p.occasion, v],
    }));

  const toggleDietary = (v: DietaryTag) =>
    setFilter((p: FilterState) => ({
      ...p,
      dietary: p.dietary.includes(v) ? p.dietary.filter(d => d !== v) : [...p.dietary, v],
    }));

  const setSeason = (v: Season) =>
    setFilter((p: FilterState) => ({ ...p, season: v }));

  const toggleWine = (v: WineCategory) =>
    setFilter((p: FilterState) => ({
      ...p,
      wine: p.wine.includes(v) ? p.wine.filter(w => w !== v) : [...p.wine, v],
    }));

  const setBudget = (v: BudgetTier | null) =>
    setFilter((p: FilterState) => ({ ...p, budget: v }));

  const setComplexity = (v: ComplexityTier | null) =>
    setFilter((p: FilterState) => ({ ...p, complexity: v }));

  const updateFlavour = (axis: keyof typeof flavourUI, v: number) => {
    setFlavourUI(p => ({ ...p, [axis]: v }));
    setFilter((p: FilterState) => ({
      ...p,
      flavour: {
        ...p.flavour,
        [axis]: v === 3 ? null : v <= 2 ? [1, 2] : [4, 5],
      },
    }));
  };

  const clearAll = () => {
    setFilter({ ...DEFAULT_FILTER });
    setFlavourUI({ richness: 3, boldness: 3, creative: 3, refined: 3 });
    setRegionParent('all');
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: '56px' }}>

      {/* ── 3 navigation pills ── */}
      {!hidePillBar && (
        <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', background: '#FDFBF7', borderBottom: '1px solid #E0D8CF', flexShrink: 0 }}>
          {(['pizzas', 'shopping', 'party'] as const).map(pill => (
            <div key={pill} style={S.navPill(activePill === pill)} onClick={() => onPillChange(pill)}>
              {pill === 'pizzas'   ? t('pizzaParty.pill.pizzas')
                : pill === 'shopping' ? t('pizzaParty.pill.shopping')
                : t('pizzaParty.pill.partyTime')}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════
          PIZZAS pill
      ══════════════════════════════════════ */}
      {/* Style awareness banner */}
      {activePill === 'pizzas' && (
        <div style={{
          padding: '6px 12px',
          background: '#F5F0E8',
          borderBottom: '1px solid #E0D8CF',
          fontSize: '11px',
          color: '#6B7A5A',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          <svg viewBox="0 0 20 20" width={12} height={12} fill="none"
            stroke="#6B7A5A" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="7" />
            <path d="M10 9v5" />
            <circle cx="10" cy="7" r=".5" fill="#6B7A5A" stroke="none" />
          </svg>
          <span style={{ flex: 1 }}>
            {styleKey
              ? (l === 'fr'
                  ? `Pizzas pour ${STYLE_NAMES_FR[styleKey] ?? styleKey}`
                  : `Showing pizzas for ${STYLE_NAMES[styleKey] ?? styleKey}`)
              : (l === 'fr' ? 'Tous les styles' : 'All styles')
            }
          </span>
          <span
            onClick={() => setShowStylePicker(true)}
            style={{
              fontSize: '11px',
              color: 'var(--terra)',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              flexShrink: 0,
            }}
          >
            {l === 'fr' ? 'Changer' : 'Change'}
          </span>
        </div>
      )}

      {activePill === 'pizzas' && (
        <>
          {/* ── Filter panel ── */}
          <div style={{ background: '#FDFBF7', borderBottom: '1px solid #E0D8CF' }}>

            {/* ── Group 1: The Basics ── */}
            <FilterGroup
              label={l === 'fr' ? 'L\'essentiel' : 'The Basics'}
              items={[
                ...(!Object.values(filterCounts.occasion).every(c => c === 0) ? [{
                  key: 'occasion', title: l === 'fr' ? 'Occasion' : 'Occasion',
                  badge: filter.occasion.length > 0 ? `${filter.occasion.length}` : undefined,
                  open: open.occasion, onToggle: () => togOpen('occasion'),
                  children: (
                    <div style={S.pillRow}>
                      {(['classic','spicy','kids','party','impress','quick'] as OccasionTag[]).map(o => {
                        if (filterCounts.occasion[o] === 0 && !filter.occasion.includes(o)) return null;
                        return (
                          <span key={o} style={S.pill(filter.occasion.includes(o))} onClick={() => toggleOccasion(o)}>
                            {OCCASION_LABELS[o][l]}
                          </span>
                        );
                      })}
                    </div>
                  ),
                }] : []),
                ...(!Object.values(filterCounts.base).every(c => c === 0) ? [{
                  key: 'base', title: l === 'fr' ? 'Base' : 'Base',
                  badge: filter.base !== null ? '1' : undefined,
                  open: open.base, onToggle: () => togOpen('base'),
                  children: (
                    <div style={S.pillRow}>
                      <span style={S.pill(filter.base === null, 'terra')} onClick={() => setBase(null)}>
                        {l === 'fr' ? 'Toutes' : 'All'}
                      </span>
                      {(['tomato_raw','tomato_cooked','bianca_cream','bianca_oil','bianca_ricotta','pesto','nduja','bbq'] as BaseType[]).map(b => {
                        if (filterCounts.base[b] === 0 && filter.base !== b) return null;
                        return (
                          <span key={b} style={S.pill(filter.base === b, 'terra')}
                            onClick={() => setBase(filter.base === b ? null : b)}>
                            {BASE_LABELS[b][l]}
                          </span>
                        );
                      })}
                    </div>
                  ),
                }] : []),
                ...(!Object.values(filterCounts.region).every(c => c === 0) ? [{
                  key: 'region', title: l === 'fr' ? 'Région' : 'Region',
                  badge: regionParent !== 'all' ? (regionParent === 'italy' ? '🇮🇹' : regionParent === 'france' ? '🇫🇷' : '🌍') : undefined,
                  open: open.region, onToggle: () => togOpen('region'),
                  children: (
                    <>
                      <div style={S.pillRow}>
                        {(['all','italy','france','fusion'] as const).map(r => (
                          <span key={r} style={S.pill(regionParent === r, 'terra')}
                            onClick={() => { setRegionParent(r); setRegion(null); }}>
                            {r === 'all' ? (l === 'fr' ? 'Toutes' : 'All')
                              : r === 'italy'  ? '🇮🇹 ' + (l === 'fr' ? 'Italie' : 'Italy')
                              : r === 'france' ? '🇫🇷 France'
                              : '🌍 Fusion'}
                          </span>
                        ))}
                      </div>
                      {(regionParent === 'italy' || regionParent === 'france') && (
                        <div style={S.subSec}>
                          <span style={S.subLbl}>
                            {regionParent === 'italy'
                              ? (l === 'fr' ? 'Régions italiennes' : 'Italian regions')
                              : (l === 'fr' ? 'Régions françaises' : 'French regions')}
                          </span>
                          <div style={S.pillRow}>
                            {(regionParent === 'italy' ? ITALY_REGIONS : FRANCE_REGIONS).map(r => {
                              if (filterCounts.region[r] === 0 && filter.region !== r) return null;
                              return (
                                <span key={r} style={S.pill(filter.region === r)}
                                  onClick={() => setRegion(filter.region === r ? null : r)}>
                                  {REGION_NAMES[r][l]}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ),
                }] : []),
              ]}
            />

            {/* ── Group 2: Refine ── */}
            <FilterGroup
              label={l === 'fr' ? 'Affinez' : 'Refine'}
              items={[
                {
                  key: 'season', title: l === 'fr' ? 'Saison' : 'Season',
                  badge: filter.season !== 'all' ? SEASON_LABELS[filter.season][l] : undefined,
                  open: open.season, onToggle: () => togOpen('season'),
                  children: (
                    <div style={S.pillRow}>
                      {(['all','spring','summer','autumn','winter'] as Season[]).map(s => (
                        <span key={s}
                          style={S.pill(filter.season === s, filter.season === s && s === 'all' ? 'terra' : 'sage')}
                          onClick={() => setSeason(s)}>
                          {SEASON_LABELS[s][l]}{s === currentSeason && s !== 'all' ? (l === 'fr' ? ' · maintenant' : ' · now') : ''}
                        </span>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'diet', title: l === 'fr' ? 'Régime' : 'Diet',
                  badge: filter.dietary.length > 0 ? `${filter.dietary.length}` : undefined,
                  open: open.diet, onToggle: () => togOpen('diet'),
                  children: (
                    <>
                      <div style={S.subSec}>
                        <span style={S.subLbl}>{l === 'fr' ? 'Préférence alimentaire' : 'Dietary preference'}</span>
                        <div style={S.pillRow}>
                          {([['veg', l === 'fr' ? 'Végétarien' : 'Vegetarian'],['vegan','Vegan'],['pescatarian', l === 'fr' ? 'Pescatarien' : 'Pescatarian']] as [DietaryTag,string][]).map(([d,label]) => {
                            const count = filtered.filter(p => p.dietary.includes(d as DietaryTag)).length + DESSERT_PIZZAS.filter(p => p.dietary.includes(d as DietaryTag)).length;
                            if (count === 0 && !filter.dietary.includes(d as DietaryTag)) return null;
                            return <span key={d} style={S.pill(filter.dietary.includes(d as DietaryTag))} onClick={() => toggleDietary(d as DietaryTag)}>{label}</span>;
                          })}
                        </div>
                      </div>
                      <div style={S.subSec}>
                        <span style={S.subLbl}>{l === 'fr' ? 'Allergènes · exclure' : 'Allergens · exclude'}</span>
                        <div style={S.pillRow}>
                          {([['dairy_free', l === 'fr' ? 'Sans lactose' : 'No dairy'],['no_nuts', l === 'fr' ? 'Sans noix' : 'No nuts'],['no_fish', l === 'fr' ? 'Sans poisson' : 'No fish'],['no_pork', l === 'fr' ? 'Sans porc' : 'No pork']] as [DietaryTag,string][]).map(([d,label]) => {
                            const count = filtered.filter(p => p.dietary.includes(d as DietaryTag)).length + DESSERT_PIZZAS.filter(p => p.dietary.includes(d as DietaryTag)).length;
                            if (count === 0 && !filter.dietary.includes(d as DietaryTag)) return null;
                            return <span key={d} style={S.pill(filter.dietary.includes(d as DietaryTag))} onClick={() => toggleDietary(d as DietaryTag)}>{label}</span>;
                          })}
                        </div>
                      </div>
                      <div style={S.subSec}>
                        <span style={S.subLbl}>{l === 'fr' ? 'Restrictions religieuses' : 'Religious'}</span>
                        <div style={S.pillRow}>
                          {(['halal','kosher'] as DietaryTag[]).map(d => {
                            const count = filtered.filter(p => p.dietary.includes(d)).length + DESSERT_PIZZAS.filter(p => p.dietary.includes(d)).length;
                            if (count === 0 && !filter.dietary.includes(d)) return null;
                            return <span key={d} style={S.pill(filter.dietary.includes(d))} onClick={() => toggleDietary(d)}>{d === 'halal' ? 'Halal' : 'Kosher'}</span>;
                          })}
                        </div>
                      </div>
                    </>
                  ),
                },
                {
                  key: 'wine', title: l === 'fr' ? 'Vins' : 'Wine',
                  badge: filter.wine.length > 0 ? `${filter.wine.length}` : undefined,
                  open: open.wine, onToggle: () => togOpen('wine'),
                  children: (
                    <div style={S.subSec}>
                      <span style={S.subLbl}>{l === 'fr' ? 'Toucher une catégorie · exemples à droite' : 'Tap a category · examples on the right'}</span>
                      {(['lr','fr','cw','rw','sp','ro'] as WineCategory[]).map(w => (
                        <div key={w} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                          <span style={S.winePill(filter.wine.includes(w))} onClick={() => toggleWine(w)}>{WINE_CATEGORY_LABELS[w][l]}</span>
                          <span style={{ fontSize: '10px', color: '#8A7F78' }}>{WINE_EXAMPLES[w][l]}</span>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />

            {/* ── Group 3: Go Deeper ── */}
            <FilterGroup
              label={l === 'fr' ? 'Pour les curieux' : 'Go Deeper'}
              items={[
                ...(!Object.values(filterCounts.budget).every(c => c === 0) ? [{
                  key: 'budget', title: l === 'fr' ? 'Budget' : 'Budget',
                  badge: filter.budget !== null ? BUDGET_LABELS[filter.budget][l] : undefined,
                  open: open.budget, onToggle: () => togOpen('budget'),
                  children: (
                    <div style={S.pillRow}>
                      {([1,2,3] as BudgetTier[]).map(b => {
                        if (filterCounts.budget[b] === 0 && filter.budget !== b) return null;
                        return (
                          <span key={b} style={S.pill(filter.budget === b)}
                            onClick={() => setBudget(filter.budget === b ? null : b)}>
                            {BUDGET_LABELS[b][l]}
                          </span>
                        );
                      })}
                    </div>
                  ),
                }] : []),
                ...(!Object.values(filterCounts.complexity).every(c => c === 0) ? [{
                  key: 'budget_complexity', title: l === 'fr' ? 'Complexité' : 'Complexity',
                  badge: filter.complexity !== null ? COMPLEXITY_LABELS[filter.complexity][l] : undefined,
                  open: open.budget_complexity, onToggle: () => togOpen('budget_complexity'),
                  children: (
                    <div style={S.pillRow}>
                      {([1,2,3] as ComplexityTier[]).map(c => {
                        if (filterCounts.complexity[c] === 0 && filter.complexity !== c) return null;
                        return (
                          <span key={c} style={S.pill(filter.complexity === c)}
                            onClick={() => setComplexity(filter.complexity === c ? null : c)}>
                            {COMPLEXITY_LABELS[c][l]}
                          </span>
                        );
                      })}
                    </div>
                  ),
                }] : []),
                {
                  key: 'flavour', title: l === 'fr' ? 'Saveurs' : 'Flavour',
                  open: open.flavour, onToggle: () => togOpen('flavour'),
                  children: (
                    <div style={S.subSec}>
                      <FlavorSlider leftLabel={l === 'fr' ? 'Léger' : 'Light'} rightLabel={l === 'fr' ? 'Riche' : 'Rich'} value={flavourUI.richness} onChange={v => updateFlavour('richness', v)} />
                      <FlavorSlider leftLabel={l === 'fr' ? 'Délicat' : 'Delicate'} rightLabel={l === 'fr' ? 'Puissant' : 'Bold'} value={flavourUI.boldness} onChange={v => updateFlavour('boldness', v)} />
                      <FlavorSlider leftLabel={l === 'fr' ? 'Classique' : 'Classic'} rightLabel={l === 'fr' ? 'Créatif' : 'Creative'} value={flavourUI.creative} onChange={v => updateFlavour('creative', v)} />
                      <FlavorSlider leftLabel={l === 'fr' ? 'Réconfort' : 'Comfort'} rightLabel={l === 'fr' ? 'Raffiné' : 'Refined'} value={flavourUI.refined} onChange={v => updateFlavour('refined', v)} />
                    </div>
                  ),
                },
              ]}
            />

            <FilterGroup
              label={l === 'fr' ? 'Par ingrédient' : 'By Ingredient'}
              items={[
                {
                  key: 'ingredient',
                  title: l === 'fr' ? 'Ingrédient' : 'Ingredient',
                  badge: (filter.ingredientChips ?? []).length > 0 || filter.ingredientSearch
                    ? String((filter.ingredientChips ?? []).length + (filter.ingredientSearch ? 1 : 0))
                    : undefined,
                  open: open.ingredient,
                  onToggle: () => togOpen('ingredient'),
                  children: (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                        {INGREDIENT_CHIPS.map(group => (
                          <div key={group.category.en} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{
                              fontSize: '8px', fontWeight: 600, color: '#8A7F78',
                              textTransform: 'uppercase', letterSpacing: '0.07em',
                              fontFamily: 'DM Mono, monospace', paddingBottom: '5px',
                              borderBottom: '1px solid #E8E0D5', marginBottom: '2px',
                              textAlign: 'center', lineHeight: 1.3,
                            }}>
                              {l === 'fr' ? group.category.fr : group.category.en}
                            </div>
                            <div style={{
                              display: 'flex', flexDirection: 'column', gap: '4px',
                              maxHeight: '148px', overflowY: 'auto', overflowX: 'hidden',
                              scrollbarWidth: 'thin' as React.CSSProperties['scrollbarWidth'],
                              scrollbarColor: '#E0D8CF transparent',
                              paddingRight: '2px',
                            }}>
                              {group.items.map(item => {
                                const active = (filter.ingredientChips ?? []).includes(item.search);
                                return (
                                  <span
                                    key={item.search}
                                    onClick={() => setFilter((prev: FilterState) => {
                                      const chips = prev.ingredientChips ?? [];
                                      return {
                                        ...prev,
                                        ingredientChips: active
                                          ? chips.filter(c => c !== item.search)
                                          : [...chips, item.search],
                                      };
                                    })}
                                    style={{
                                      fontSize: '11px', padding: '5px 4px', borderRadius: '20px',
                                      cursor: 'pointer', textAlign: 'center',
                                      border: active ? '1px solid #C4522A' : '1px solid #E8E0D5',
                                      background: active ? '#C4522A' : '#FDFBF7',
                                      color: active ? 'white' : '#3D3530',
                                      fontFamily: 'DM Sans, sans-serif',
                                      transition: 'all 0.12s', lineHeight: 1.3,
                                      userSelect: 'none' as React.CSSProperties['userSelect'],
                                      whiteSpace: 'nowrap' as React.CSSProperties['whiteSpace'],
                                      overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {l === 'fr' ? item.fr : item.en}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {(filter.ingredientChips ?? []).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#C4522A', fontFamily: 'DM Sans' }}>
                            {(filter.ingredientChips ?? []).length} {l === 'fr' ? 'sélectionné(s)' : 'selected'}
                          </span>
                          <button
                            onClick={() => setFilter((p: FilterState) => ({ ...p, ingredientChips: [] }))}
                            style={{ fontSize: '11px', color: '#8A7F78', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            · {l === 'fr' ? 'effacer' : 'clear'}
                          </button>
                        </div>
                      )}

                      <input
                        type="text"
                        value={filter.ingredientSearch}
                        onChange={e => setFilter((p: FilterState) => ({ ...p, ingredientSearch: e.target.value }))}
                        placeholder={l === 'fr' ? 'Autre ingrédient...' : 'Other ingredient...'}
                        style={{
                          width: '100%', fontSize: '12px', padding: '7px 10px',
                          borderRadius: '8px', border: '0.5px solid #E0D8CF',
                          background: '#F5F0E8', outline: 'none', color: '#1A1612',
                          fontFamily: 'DM Sans, sans-serif', marginTop: '8px',
                          boxSizing: 'border-box' as React.CSSProperties['boxSizing'],
                        }}
                      />
                    </div>
                  ),
                },
              ]}
            />

          </div>{/* end filter panel */}

          {/* ── Results strip ── */}
          <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F0E8', borderBottom: '1px solid #E0D8CF', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#8A7F78' }}>
              {l === 'fr'
                ? `${filtered.length} pizza${filtered.length !== 1 ? 's' : ''}`
                : `Showing ${filtered.length} pizza${filtered.length !== 1 ? 's' : ''}`}
              {filter.season !== 'all' ? ` · ${SEASON_LABELS[filter.season][l]}` : ''}
            </span>
            <button onClick={clearAll} style={{ fontSize: '11px', color: '#C4522A', background: 'none', border: 'none', cursor: 'pointer' }}>
              {l === 'fr' ? 'Tout effacer' : 'Clear all'}
            </button>
          </div>

          {/* ── Cards + dessert + summary ── */}
          <div>

            <div style={{ overflowY: 'auto', maxHeight: '462px', borderBottom: '1px solid #E0D8CF' }}>

              {/* Pizza cards */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {filtered.map(pizza => (
                  <PizzaCard
                    key={pizza.id}
                    pizza={pizza}
                    qty={getQty(pizza.id)}
                    locale={locale}
                    styleKey={styleKey}
                    onQtyChange={(delta, e) => { e.stopPropagation(); changeQty(pizza.id, delta); }}
                    onTap={() => setSheetId(pizza.id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8A7F78', fontSize: '13px' }}>
                    {l === 'fr'
                      ? 'Aucune pizza ne correspond — essayez d\'effacer les filtres'
                      : 'No pizzas match — try clearing some filters'}
                  </div>
                )}
              </div>

            </div>

            {/* Grey spacer between pizza list and dessert */}
            <div style={{ height: '10px', background: '#F5F0E8' }} />

            {/* Dessert toggle */}
            <div
              onClick={() => setDessertOpen(v => !v)}
              style={{
                padding: '10px 12px 8px',
                cursor: 'pointer',
                background: dessertOpen ? '#F5F0E8' : '#FDFBF7',
                borderTop: '1px solid #E0D8CF',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: '#D4A853', flexShrink: 0, display: 'inline-block',
                }} />
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: '#1A1612',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {l === 'fr' ? 'Une touche sucrée ?' : 'Something sweet?'}
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                color: dessertOpen ? '#C4522A' : '#8A7F78',
                transform: dessertOpen ? 'rotate(180deg)' : 'none',
                transition: 'all 0.15s', display: 'inline-block',
              }}>⌄</span>
            </div>

            {/* Dessert cards */}
            {dessertOpen && (
              <div style={{
                background: '#F5F0E8',
                overflowY: 'auto',
                maxHeight: '228px',
              }}>
                <div style={{ padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {DESSERT_PIZZAS.map(pizza => (
                    <PizzaCard
                      key={pizza.id}
                      pizza={pizza}
                      qty={getQty(pizza.id)}
                      locale={locale}
                      styleKey={styleKey}
                      onQtyChange={(delta, e) => { e.stopPropagation(); changeQty(pizza.id, delta); }}
                      onTap={() => setSheetId(pizza.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Sheet overlay ── */}
            {sheetPizza && (
              <PizzaSheet
                pizza={sheetPizza}
                qty={getQty(sheetPizza.id)}
                locale={locale}
                styleKey={styleKey}
                onQtyChange={delta => changeQty(sheetPizza.id, delta)}
                onClose={() => setSheetId(null)}
              />
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          SHOPPING pill — placeholder for Prompt 8
      ══════════════════════════════════════ */}
      {activePill === 'shopping' && (
        <ShoppingList
          qtys={qtys}
          locale={locale}
          numItems={numItems}
          styleKey={styleKey}
        />
      )}

      {/* ══════════════════════════════════════
          PARTY TIME pill — placeholder for Prompt 9
      ══════════════════════════════════════ */}
      {activePill === 'party' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: '#8A7F78', fontSize: '13px', textAlign: 'center' }}>
          {l === 'fr' ? 'Au four ! — bientôt disponible' : 'Let\'s cook — coming soon'}
        </div>
      )}

      {/* Grey spacer between dessert and summary */}
      {totalQty > 0 && (
        <div style={{ height: '10px', background: '#F5F0E8' }} />
      )}

      {/* ── Full selection summary — always rendered for IntersectionObserver ── */}
      <div ref={summaryRef} style={{ margin: '0 -16px', marginTop: totalQty === 0 ? '10px' : '0' }}>
        <div style={{ background: '#F5F0E8' }}>
          {(activePill === 'pizzas' || hidePillBar) && (
            <div style={{
              background: '#1A1612',
              borderTop: '1px solid #C4522A',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 16px',
            }}>
              <span style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>
                {l === 'fr' ? 'Votre pizza party' : 'Your pizza party'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {Array.from({ length: Math.min(numItems, 10) }, (_, i) => (
                    <div key={i} style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: i < totalQty
                        ? (totalQty >= numItems ? '#6B7A5A' : '#C4522A')
                        : '#3D3530',
                    }} />
                  ))}
                </div>
                <span style={{
                  fontSize: '11px',
                  color: totalQty >= numItems ? '#6B7A5A' : '#C4522A',
                  fontFamily: 'DM Mono, monospace', fontWeight: 600,
                }}>
                  {totalQty}/{numItems}
                </span>
                {totalQty > 0 && (
                  <span
                    onClick={() => onPillChange('shopping')}
                    style={{ fontSize: '11px', color: '#C4522A', marginLeft: '10px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {l === 'fr' ? 'Liste →' : 'Shopping →'}
                  </span>
                )}
              </div>
            </div>
          )}
          {totalQty > 0 && (activePill === 'pizzas' || hidePillBar) && (
            <div style={{ padding: '0 16px', background: 'var(--warm)' }}>
              {Object.entries(qtys)
                .filter(([, qty]) => (qty as number) > 0)
                .map(([pizzaId, qty]) => {
                  const pizza = getPizzaById(pizzaId);
                  if (!pizza) return null;
                  return (
                    <div key={pizzaId} style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '0.5px solid #E0D8CF',
                    }}>
                      <span style={{
                        fontSize: '13px', color: '#1A1612',
                        fontFamily: 'DM Sans, sans-serif', flex: 1,
                      }}>
                        {pizza.name[l] ?? pizza.name.en}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          onClick={e => { e.stopPropagation(); changeQty(pizzaId, -1); }}
                          style={{
                            width: '26px', height: '26px', borderRadius: '50%',
                            border: '1px solid #E0D8CF', background: '#FDFBF7',
                            cursor: 'pointer', fontSize: '16px', color: '#1A1612',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >−</button>
                        <span style={{
                          fontSize: '13px', fontWeight: 600, color: '#1A1612',
                          fontFamily: 'DM Mono, monospace',
                          minWidth: '16px', textAlign: 'center',
                        }}>
                          {qty as number}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); changeQty(pizzaId, 1); }}
                          style={{
                            width: '26px', height: '26px', borderRadius: '50%',
                            border: '1px solid #C4522A', background: '#C4522A',
                            cursor: 'pointer', fontSize: '16px', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >+</button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Style picker bottom sheet ── */}
      {showStylePicker && (
        <>
          <div
            onClick={() => setShowStylePicker(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(26,22,18,0.5)',
              zIndex: 200,
            }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: '#FDFBF7',
              borderRadius: '20px 20px 0 0',
              maxHeight: '70vh',
              zIndex: 201,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{
              width: '32px', height: '3px',
              background: '#E0D8CF', borderRadius: '2px',
              margin: '12px auto 0',
              flexShrink: 0,
            }} />
            <div style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '18px', fontWeight: 700,
              color: 'var(--char)',
              padding: '12px 16px 8px',
              flexShrink: 0,
            }}>
              {l === 'fr' ? 'Choisir un style de pizza' : 'Choose a pizza style'}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {[
                { key: 'neapolitan' },
                { key: 'sourdough'  },
                { key: 'pizza_romana' },
                { key: 'roman'      },
                { key: 'newyork'    },
                { key: 'pan'        },
              ].map(({ key }, idx, arr) => {
                const isSelected = styleKey === key;
                const isDoughStyle = key === activeStyleKey;
                const name = l === 'fr'
                  ? (STYLE_NAMES_FR[key] ?? key)
                  : (STYLE_NAMES[key] ?? key);
                return (
                  <div
                    key={key}
                    onClick={() => {
                      setShowStylePicker(false);
                      onStyleKeyChange?.(key);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 16px',
                      borderBottom: idx < arr.length - 1
                        ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'rgba(196,82,42,0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '15px', fontWeight: 600,
                        color: 'var(--char)',
                      }}>
                        {name}
                      </div>
                    </div>
                    {isDoughStyle && (
                      <span style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '9px',
                        color: 'var(--gold)',
                        background: 'rgba(212,168,83,0.15)',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        marginRight: '8px',
                        flexShrink: 0,
                      }}>
                        {l === 'fr' ? 'Votre pâte' : 'Your dough'}
                      </span>
                    )}
                    {isSelected && (
                      <span style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '14px',
                        color: 'var(--terra)',
                        flexShrink: 0,
                      }}>
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{
              padding: '10px 16px 20px',
              fontSize: '11px',
              color: 'var(--smoke)',
              fontFamily: 'DM Sans, sans-serif',
              fontStyle: 'italic',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              {l === 'fr'
                ? 'Changer le style ici ne modifie pas votre recette de pâte.'
                : 'Changing style here does not change your dough recipe.'}
            </div>
          </div>
        </>
      )}

      {/* ── Party bar — fixed at bottom, hides when summary visible ── */}
      {(activePill === 'pizzas' || hidePillBar) && !summaryVisible && (
      <div style={{
        position: 'fixed', bottom: '64px', left: 0, right: 0, zIndex: 30,
        background: '#1A1612',
        borderTop: '1px solid #C4522A',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 16px',
      }}>
        <span style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>
          {l === 'fr' ? 'Votre pizza party' : 'Your pizza party'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '3px' }}>
            {Array.from({ length: Math.min(numItems, 10) }, (_, i) => (
              <div key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: i < totalQty
                  ? (totalQty >= numItems ? '#6B7A5A' : '#C4522A')
                  : '#3D3530',
              }} />
            ))}
          </div>
          <span style={{
            fontSize: '11px',
            color: totalQty >= numItems ? '#6B7A5A' : '#C4522A',
            fontFamily: 'DM Mono, monospace', fontWeight: 600,
          }}>
            {totalQty}/{numItems}
          </span>
          {totalQty > 0 && (
            <span
              onClick={() => onPillChange('shopping')}
              style={{ fontSize: '11px', color: '#C4522A', marginLeft: '10px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'DM Sans, sans-serif' }}
            >
              {l === 'fr' ? 'Liste →' : 'Shopping →'}
            </span>
          )}
        </div>
      </div>
      )}

    </div>
  );
}
