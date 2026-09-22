'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { NEXT_CTA, SECONDARY_CTA } from '../lib/navButtons';
import { createClient } from '@/app/lib/supabase/client';
import {
  PIZZAS, DESSERT_PIZZAS, getPizzaById, getCustomPizzaList,
  BASE_LABELS, OCCASION_LABELS, SEASON_LABELS,
  WINE_CATEGORY_LABELS, WINE_EXAMPLES,
  BUDGET_LABELS, COMPLEXITY_LABELS,
  INGREDIENT_CATEGORY_LABELS,
  filterPizzas, getFilterCounts, DEFAULT_FILTER, getCurrentSeason,
  type Pizza, type FilterState, type WineCategory, type BaseType,
  type OccasionTag, type DietaryTag, type Season, type BudgetTier,
  type ComplexityTier, type RegionTag, type IngredientCategory,
} from '../lib/toppingDatabase';
import { approvedPizzaImage } from '../lib/approvedPizzaImage';
import CreatePizzaSheet from './CreatePizzaSheet';
import { loadCustomPizzas, type CustomPizzaDef } from '../lib/profile';
import PizzaPlaceholder from './PizzaPlaceholder';
import { SHOPPING_NOTE_FR } from '../lib/shoppingNoteTranslations';
import { filterPizzasByCourse, type Locale, type FlavorChip } from '../lib/toppingTypes';

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
    category: { en: 'Meat & Deli', fr: 'Viande & Charcuterie' },
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
    ],
  },
  {
    category: { en: 'Fish & Seafood', fr: 'Poisson & mer' },
    items: [
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
  doughConfigured?: boolean;
  onGoToMyDough?: () => void;
  /** Dough ingredients from the generated recipe — shown as a
      "For your dough" section so the baker shops once. */
  recipeIngredients?: Array<{ name: string; amount: string }>;
  onSelectionDone?:()=>void;
  selectionDoneLabel?:string;
  active?:boolean;
}

// ─── Sub-region maps ─────────────────────────────────────────

const ITALY_REGIONS: RegionTag[] = ['neapolitan','roman','sicilian','ligurian','venetian','calabrian','italian'];
const FRANCE_REGIONS: RegionTag[] = ['alsace','savoie','provence','bretagne','normandie','basque','lyonnais','nord','french'];
const ASIA_REGIONS: RegionTag[]   = ['japanese','korean','asian'];

const REGION_GROUP_MAP: Record<string, RegionTag[]> = {
  italy:  ['neapolitan','roman','calabrian','sicilian','ligurian','venetian','italian'],
  france: ['alsace','savoie','normandie','provence','bretagne','basque','lyonnais','nord','french'],
  asia:   ['japanese','korean','chinese','singaporean','thai','vietnamese','indonesian','asian'],
  fusion: ['american','spanish','middle_eastern','north_african','fusion'],
};

const REGION_NAMES: Record<RegionTag, { en: string; fr: string }> = {
  neapolitan: { en: 'Naples',   fr: 'Naples' },
  roman:      { en: 'Rome',     fr: 'Rome' },
  sicilian:   { en: 'Sicily',   fr: 'Sicile' },
  ligurian:   { en: 'Liguria',  fr: 'Ligurie' },
  venetian:   { en: 'Venice',   fr: 'Venise' },
  calabrian:  { en: 'Calabria', fr: 'Calabre' },
  italian:    { en: 'Italian',  fr: 'Italienne' },
  alsace:     { en: 'Alsace',   fr: 'Alsace' },
  savoie:     { en: 'Savoie',   fr: 'Savoie' },
  provence:   { en: 'Provence', fr: 'Provence' },
  bretagne:   { en: 'Brittany', fr: 'Bretagne' },
  normandie:  { en: 'Normandy', fr: 'Normandie' },
  basque:     { en: 'Basque',   fr: 'Pays Basque' },
  lyonnais:   { en: 'Lyon',     fr: 'Lyonnais' },
  nord:       { en: 'Nord',     fr: 'Nord' },
  french:     { en: 'French',   fr: 'Française' },
  american:         { en: 'American',       fr: 'Américaine' },
  asian:            { en: 'Asian',          fr: 'Asiatique' },
  fusion:           { en: 'Fusion',         fr: 'Fusion' },
  spanish:          { en: 'Spanish',        fr: 'Espagnole' },
  middle_eastern:   { en: 'Middle Eastern', fr: 'Moyen-Orient' },
  north_african:    { en: 'North African',  fr: 'Afrique du Nord' },
  japanese:         { en: 'Japanese',       fr: 'Japonaise' },
  korean:           { en: 'Korean',         fr: 'Coréenne' },
  chinese:          { en: 'Chinese',        fr: 'Chinoise' },
  singaporean:      { en: 'Singaporean',    fr: 'Singapourienne' },
  thai:             { en: 'Thai',           fr: 'Thaïlandaise' },
  vietnamese:       { en: 'Vietnamese',     fr: 'Vietnamienne' },
  indonesian:       { en: 'Indonesian',     fr: 'Indonésienne' },
  northern_italian: { en: 'Northern Italy', fr: 'Italie du Nord' },
};

// ─── Inline styles ────────────────────────────────────────────

const S = {
  pill: (active: boolean, variant: 'terra' | 'sage' | 'default' = 'default'): React.CSSProperties => ({
    fontSize: '13px', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
    border: active
      ? (variant === 'terra' ? '1px solid #6B4423' : variant === 'sage' ? '1px solid #6B7A5A' : '1px solid #2B2420')
      : '1px solid #E0D8CF',
    background: active
      ? (variant === 'terra' ? '#6B4423' : variant === 'sage' ? '#6B7A5A' : '#2B2420')
      : '#FDFBF7',
    color: active ? 'white' : '#3D3530',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.12s',
    userSelect: 'none' as const,
    flexShrink: 0,
  }),
  winePill: (active: boolean): React.CSSProperties => ({
    fontSize: '11px', padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
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
    flex: 1, textAlign: 'center' as const, padding: '8px 4px',
    borderRadius: '16px', fontSize: '11px', cursor: 'pointer',
    border: '1px solid #E0D8CF',
    background: active ? '#2B2420' : 'transparent',
    color: active ? '#F0EBE0' : '#8A7F78',
    fontWeight: active ? 500 : 400,
    transition: 'all 0.12s',
  }),
  secHdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    cursor: 'pointer', padding: '8px 12px 4px',
  } as React.CSSProperties,
  secTitle: {
    fontSize: '11px', color: '#3D3530', textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: '4px',
  } as React.CSSProperties,
  secBadge: (show: boolean): React.CSSProperties => ({
    fontSize: '11px', background: '#6B4423', color: 'white',
    borderRadius: '16px', padding: '1px 4px', display: show ? 'inline' : 'none',
  }),
  secBody: (open: boolean): React.CSSProperties => ({
    display: open ? 'flex' : 'none', flexDirection: 'column', gap: '8px',
    padding: '0 12px 8px',
  }),
  subSec: {
    background: '#F0EBE0', borderRadius: '8px', padding: '8px 8px',
  } as React.CSSProperties,
  subLbl: {
    fontSize: '11px', color: '#8A7F78', textTransform: 'uppercase' as const,
    letterSpacing: '0.06em', marginBottom: '4px', fontWeight: 500, display: 'block',
  } as React.CSSProperties,
  pillRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: '4px',
  } as React.CSSProperties,
  card: (selected: boolean): React.CSSProperties => ({
    background: selected ? '#FFF8F5' : '#FDFBF7',
    borderRadius: '8px',
    border: selected ? '1.5px solid #6B4423' : '1.5px solid #E0D8CF',
    overflow: 'hidden', cursor: 'pointer', transition: 'all 0.12s',
  }),
  cardEmoji: {
    fontSize: '17px', flexShrink: 0, width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#F0EBE3', borderRadius: '8px',
  } as React.CSSProperties,
  tag: (type: 'default' | 'spicy' | 'season' | 'special'): React.CSSProperties => ({
    fontSize: '11px', padding: '2px 8px', borderRadius: '16px',
    ...(type === 'spicy'   ? { background: '#FFF0EC', color: '#6B4423', border: '0.5px solid #F5C4B3' }
      : type === 'season'  ? { background: '#EFF5E8', color: '#3B6D11', border: '0.5px solid #C0DD97' }
      : type === 'special' ? { background: '#FEF9EC', color: '#9A7020', border: '0.5px solid #FAC775' }
      :                      { background: '#F0EBE3', color: '#6B7A5A', border: '0.5px solid #E0D8CF' }),
  }),
  qtyBtn: {
    width: '44px', height: '44px', borderRadius: '10px',
    border: '1.5px solid #C8C0B8', background: '#F0EBE0',
    fontSize: '15px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#2B2420', fontWeight: 500, flexShrink: 0,
  } as React.CSSProperties,
  addBtn: {
    height: '26px', padding: '0 12px', borderRadius: '8px',
    border: 'none', background: '#6B4423',
    fontSize: '11px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' as const,
    letterSpacing: '0.02em',
  } as React.CSSProperties,
  ingBadge: {
    fontSize: '11px', padding: '1px 8px', borderRadius: '16px',
    background: '#F0EBE3', color: '#8A7F78',
    marginLeft: '6px', whiteSpace: 'nowrap' as const,
    flexShrink: 0, marginTop: '2px',
  } as React.CSSProperties,
};

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
          fontSize: '11px', color: '#8A7F78',
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
    <div
      style={S.card(qty > 0)}
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
      aria-label={`${name}${qty > 0 ? ` · ${qty}` : ''}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 12px' }}>
        {/* Left: image spanning all rows */}
        <div style={{ width: '100%', aspectRatio: '2 / 1', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: '#2B2420' }}>
          {pizza.id.startsWith('custom_') ? (
            pizza.photoUrl
              ? <img src={pizza.photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <PizzaPlaceholder name={name} size="thumb" />
          ) : (
          <img
            src={approvedPizzaImage(pizza.id)}
            alt={name}
            loading="lazy" decoding="async" width={640} height={320}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (img.src.endsWith(`${pizza.id}_pan.webp`)) { img.style.display = 'none'; return; }
              if (img.src.endsWith(`${pizza.id}.webp`)) { img.src = `/pizzas/${pizza.id}_pan.webp`; return; }
              img.src = `/pizzas/${pizza.id}.webp`;
            }}
          />
          )}
        </div>
        {/* Right: 3 rows */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
          {/* Row 1: name · budget */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#2B2420', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            <span style={{ fontSize: '11px', color: '#8A7F78', flexShrink: 0 }}>{budget}</span>
          </div>
          {/* Row 2: story tagline — 2 line max */}
          {pizza.story && (
            <div style={{ fontSize: '14px', color: '#6b6058', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
              {pizza.story[l] ?? pizza.story.en}
            </div>
          )}
          {/* Row 3: occasion tags · wine pairing · time · qty controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* left group shrinks + clips so the qty stepper always stays fully visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
                <span key={tag} style={{ fontSize: '11px', color: 'var(--smoke)', background: 'var(--cream)', borderRadius: '8px', padding: '2px 8px', flexShrink: 0, fontFamily: 'var(--font-ui)' }}>
                  {OCCASION_LABELS[tag]?.[l] ?? OCCASION_LABELS[tag]?.en ?? tag}
                </span>
              );
            })}
            {pizza.winePairing?.[0] && (
              <span style={{ fontSize: '11px', color: '#8A7F78', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px', flexShrink: 1 }}>
                {pizza.winePairing[0][l] ?? pizza.winePairing[0].en}
              </span>
            )}
            {pizza.winePairing?.[0] && (
              <span style={{ fontSize: '11px', color: '#C8C0B8' }}>·</span>
            )}
            <span style={{ fontSize: '11px', color: '#8A7F78', flexShrink: 0 }}>
              {pizza.prepMinutes} min
            </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
              <button style={{ ...S.qtyBtn, visibility: qty > 0 ? 'visible' : 'hidden' }} onClick={e => onQtyChange(-1, e)}>−</button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B4423', minWidth: '14px', textAlign: 'center', visibility: qty > 0 ? 'visible' : 'hidden' }}>{qty}</span>
              <button style={S.qtyBtn} onClick={e => onQtyChange(1, e)}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PizzaIngredientDetails({pizza,locale,styleKey}: {pizza: Pizza; locale: string; styleKey?: string}) {
  const l = locale === 'fr' ? 'fr' : 'en';
  const style = styleKey as import('../lib/toppingTypes').StyleKey | undefined;
  return <div>
    <p style={{fontSize:13,color:'var(--smoke)'}}>{l === 'fr' ? 'Quantités pour une pizza' : 'Amounts for one pizza'}</p>
    {(['before','after'] as const).map(order => {
      const ingredients = pizza.ingredients.filter(ingredient => (style && ingredient.bakeOrderByStyle?.[style] || ingredient.bakeOrder) === order);
      if (!ingredients.length) return null;
      return <section key={order}>
        <h3 style={{fontSize:16,margin:'16px 0 8px'}}>{order === 'before' ? (l === 'fr' ? 'Avant cuisson' : 'Before baking') : (l === 'fr' ? 'Après cuisson' : 'After baking')}</h3>
        {ingredients.map(ingredient => {
          const note = (style && ingredient.prepNoteByStyle?.[style]) || ingredient.prepNote;
          const quantity = ingredient.qtyPerPizza;
          const multiplier = style ? ingredient.qtyMultiplierByStyle?.[style] ?? 1 : 1;
          return <div key={ingredient.id} style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:14}}><strong>{ingredient.name[l]}</strong><span>{quantity ? formatQty(quantity.amount * multiplier,quantity.unit,locale) : ''}</span></div>
            {note && <p style={{fontSize:13,lineHeight:1.5,margin:'4px 0'}}>{note[l]}</p>}
          </div>;
        })}
      </section>;
    })}
  </div>;
}

// ─── Pizza sheet ──────────────────────────────────────────────

export function PizzaSheet({ pizza, qty, locale, styleKey, onQtyChange, onClose }: {
  pizza: Pizza; qty: number; locale: string; styleKey?: string;
  onQtyChange: (delta: number) => void;
  onClose: () => void;
}) {
  const l = locale as 'en' | 'fr';

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const hasCustomPhoto = pizza.id.startsWith('custom_') && !!pizza.photoUrl;
  const imgSrc = hasCustomPhoto ? pizza.photoUrl! : approvedPizzaImage(pizza.id);

  // Drag-to-dismiss. A sheet that only closes via the ✕ reads as a page on a
  // phone; following the thumb and falling away past a threshold is what makes
  // it feel like a sheet. Pointer events cover touch and mouse alike, and the
  // drag only arms from the handle so the quantity controls stay tappable.
  const [dragY, setDragY] = useState(0);
  const dragFrom = useRef<number | null>(null);

  function onDragStart(e: React.PointerEvent) {
    dragFrom.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (dragFrom.current === null) return;
    setDragY(Math.max(0, e.clientY - dragFrom.current));
  }
  function onDragEnd() {
    if (dragFrom.current === null) return;
    dragFrom.current = null;
    setDragY(y => { if (y > 110) onClose(); return 0; });
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(43, 36, 32,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 'calc(69px + env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={pizza.name[l] ?? pizza.name.en}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
          if (e.key !== 'Tab') return;
          const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (!first) { e.preventDefault(); e.currentTarget.focus(); }
          else if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }}
        style={{
          width: '100%',
          maxHeight: 'calc(100dvh - 81px - env(safe-area-inset-bottom))',
          background: '#FDFBF7',
          borderRadius: '20px 20px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: `translateY(${dragY}px)`,
          transition: dragFrom.current === null ? 'transform 0.22s ease' : 'none',
          touchAction: 'pan-y',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{
            minHeight: 44, touchAction: 'none', padding: '10px 0 6px', display: 'flex', justifyContent: 'center',
            cursor: 'grab', flexShrink: 0, background: '#FDFBF7',
            position: 'relative', zIndex: 2,
          }}
        >
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#D9D0C2' }} />
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={onClose}
            aria-label={l === 'fr' ? 'Fermer les détails de la pizza' : 'Close pizza details'}
            style={{
              position: 'absolute', top: '2px', right: '2px',
              // 44px tap box, 28px painted disc: padding + content-box clip
              // keeps the visual unchanged while the finger gets a real target.
              width: '44px', height: '44px', padding: '8px',
              background: 'rgba(43, 36, 32,0.6)',
              backgroundClip: 'content-box',
              border: 'none', borderRadius: '50%',
              color: 'white', fontSize: '13px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >&#x2715;</button>
        </div>

        <div data-pizza-detail-scroll style={{flex:'1 1 auto',minHeight:0,overflowY:'auto',overscrollBehavior:'contain',touchAction:'pan-y'}}>
        {/* Image and ingredient details share the scrollable body. */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: 'calc(100dvh - 69px - 69px - 230px)',
          flexShrink: 0,
          background: '#2B2420',
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
        }}>
          {pizza.id.startsWith('custom_') && !pizza.photoUrl ? (
            <PizzaPlaceholder name={pizza.name[l] ?? pizza.name.en} size="hero" />
          ) : (
            <img
              src={imgSrc} loading="lazy" decoding="async"
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
                img.style.display = 'none';
              }}
            />
          )}

        </div>

        {/* Info — title, ingredients, wine — fixed height, never compressed */}
        <div style={{
          flexShrink: 0,
          padding: '12px 16px 8px',
          background: '#FDFBF7',
        }}>
          <div style={{
            fontSize: '17px', fontWeight: 700,
            fontFamily: 'var(--font-ui)',
            color: '#2B2420', marginBottom: '8px',
          }}>
            {pizza.name[l] ?? pizza.name.en}
          </div>

          <PizzaIngredientDetails pizza={pizza} locale={locale} styleKey={styleKey} />

          {pizza.preparationSequence && <p style={{ fontSize: 13, lineHeight: 1.5 }}>{pizza.preparationSequence[l]}</p>}
          {pizza.wineNote && (
            <div style={{
              fontSize: '11px', color: '#7A4A8A',
              background: '#F5EDF8', borderRadius: '16px',
              padding: '4px 12px', lineHeight: 1.5,
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

        </div>

        {/* Footer — qty controls, always visible */}
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid #E0D8CF',
          padding: '12px 16px 0',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          background: '#FDFBF7',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: '13px', color: '#8A7F78',
              fontFamily: 'var(--font-ui)',
            }}>
              {l === 'fr' ? 'Combien ?' : 'How many?'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={e => { e.stopPropagation(); onQtyChange(-1); }}
                style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  border: '1.5px solid #E0D8CF', background: '#FDFBF7',
                  cursor: 'pointer', fontSize: '20px', color: '#2B2420',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >&#x2212;</button>
              <span style={{
                fontSize: '20px', fontWeight: 700, color: '#2B2420',
                fontFamily: 'var(--font-ui)',
                minWidth: '28px', textAlign: 'center',
              }}>
                {qty}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onQtyChange(1); }}
                style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  border: 'none', background: '#6B4423',
                  cursor: 'pointer', fontSize: '20px', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >&#x2B;</button>
            </div>
          </div>
          {qty > 0 && (
            <div style={{
              marginTop: '8px', fontSize: '11px',
              color: '#6B7A5A', fontFamily: 'var(--font-ui)',
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


export function shoppingNoteText(note: string | Locale | undefined, locale: string): string {
  if (!note) return '';
  const text = typeof note !== 'string' ? note[locale === 'fr' ? 'fr' : 'en'] || note.en || '' : locale === 'fr' ? (SHOPPING_NOTE_FR[note] ?? note) : note;
  return /^(Product references; check your store for availability|Références produits)/i.test(text) ? '' : text;
}

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
    drizzle:{ en: 'drizzles', fr: 'filets' },
  };
  const singular: Record<string, Locale> = { slices: {en:'slice',fr:'tranche'}, leaves: {en:'leaf',fr:'feuille'}, sprigs: {en:'sprig',fr:'brin'}, pinch: {en:'pinch',fr:'pincée'}, drizzle: {en:'drizzle',fr:'filet'} };
  const label = (total === 1 ? singular[unit]?.[l] : undefined) ?? unitLabels[unit]?.[l] ?? unit;
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
  goodEnough?: { name: Locale; note?: Locale };
  compromise?: { name: Locale; note?: Locale };
  localSwap?: Partial<Record<string, { name: Locale; note?: Locale }>>;
  whereToFind?: import('../lib/toppingTypes').WhereToFind;
  forPizzas: string[];
}

export function buildShoppingList(
  qtys: Record<string, number>,
  locale: string,
  styleKey?: string,
): { sections: Array<{ category: IngredientCategory; label: string; items: ShoppingItem[] }> } {
  const l = locale as 'en' | 'fr';
  const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS, ...getCustomPizzaList()];
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
          category: ['fresh_basil','dill','lemon_wedge','rocket','fresh_coriander','fresh_chives','spring_onion','cucumber_fresh','red_onion_raw','kaffir_lime_leaves','lime_fresh','jalapeno_sliced','black_truffle_shavings','mixed_berries'].includes(ing.id) ? 'veg' : ['egg','whole_egg','poached_egg','mascarpone','ricotta','cream_cheese','cream_35','creme_fraiche','fromage_blanc','vanilla_cream','dark_choc_cream'].includes(ing.id) ? 'cheese' : ing.category === 'base' ? 'sauce' : ing.category,
          totalAmount: undefined,
          unit: undefined,
          qtyNote: undefined,
          isCommonPantry: ing.isCommonPantry,
          hardToFind: ing.hardToFind,
          goodEnough: ing.goodEnough,
          whereToFind: ing.whereToFind,
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
  { key: 'singapore',    label: 'Singapore', labelFr: 'Singapour' },
  { key: 'france',       label: 'France', labelFr: 'France' },
  { key: 'uk',           label: 'UK', labelFr: 'Royaume-Uni' },
  { key: 'us',           label: 'US', labelFr: 'États-Unis' },
  { key: 'australia',    label: 'Australia', labelFr: 'Australie' },
  { key: 'international',label: 'International', labelFr: 'International' },
];

export function ingredientHelpData(item: Pick<ShoppingItem, 'goodEnough' | 'compromise' | 'localSwap' | 'whereToFind'>, location: string, locale: string) {
  const l = locale === 'fr' ? 'fr' : 'en';
  const seen = new Set<string>();
  const alternatives = [item.goodEnough, item.compromise, item.localSwap?.[location]].flatMap(option => {
    const name = (option?.name[l] || option?.name.en || '').trim();
    if (!name || seen.has(name.toLowerCase())) return [];
    seen.add(name.toLowerCase());
    return [{name, note:option?.note?.[l] || option?.note?.en || ''}];
  });
  const where = item.whereToFind?.[location as import('../lib/toppingTypes').ShoppingContext];
  const placeLabel = (value: string) => l === 'fr' ? value.replace(/\bItalian delis\b/gi, 'Épiceries italiennes') : value;
  const shops = (where?.shops ?? []).filter(value => value.trim()).map(placeLabel);
  const online = (where?.online ?? []).filter(value => value.trim()).map(placeLabel);
  const links = ((where as (typeof where & {links?: Array<{label:string | Locale;url:string}>}))?.links ?? [])
    .map(link => ({...link,label:typeof link.label === 'string' ? link.label : link.label?.[l] || link.label?.en || ''}))
    .filter(link => link.label.trim() && /^https:\/\//.test(link.url));
  const hasWhere = shops.length + online.length + links.length > 0;
  return {alternatives, shops, online, links, note:shoppingNoteText(where?.note,l), hasWhere,
    available:alternatives.length > 0 || hasWhere,
    label:alternatives.length ? 'Alternatives' : l === 'fr' ? 'Où le trouver' : 'Where to find it'};
}

export function IngredientShoppingHelp({item,location,locale,onLocationChange,onBack}: {
  item: ShoppingItem; location:string; locale:string; onLocationChange:(value:string)=>void; onBack:()=>void;
}) {
  const l = locale === 'fr' ? 'fr' : 'en';
  const help = ingredientHelpData(item,location,l);
  return <section aria-label={item.name[l] || item.name.en} style={{padding:'16px 12px',fontFamily:'var(--font-ui)'}}>
    <button type="button" autoFocus onClick={onBack} style={SECONDARY_CTA}>{l === 'fr' ? 'Retour aux courses' : 'Back to shopping list'}</button>
    <h1 style={{fontFamily:'Georgia,serif',fontSize:30}}>{item.name[l] || item.name.en}</h1>
    <label style={{display:'grid',gap:8,marginBottom:24}}>{l === 'fr' ? 'Pays des courses' : 'Shopping location'}
      <select value={location} onChange={event=>onLocationChange(event.target.value)} style={{minHeight:44,padding:10,border:'1px solid var(--border)',borderRadius:10,background:'var(--cream)'}}>
        {LOCATIONS.map(loc=><option key={loc.key} value={loc.key}>{l === 'fr' ? loc.labelFr : loc.label}</option>)}
      </select>
    </label>
    {help.alternatives.length > 0 && <><h2>Alternatives</h2>
      <p style={{fontSize:13,color:'var(--smoke)'}}>{l === 'fr' ? 'Suggestions uniquement : votre liste de courses reste inchangée.' : 'Suggestions only — your shopping list stays unchanged.'}</p>
      {help.alternatives.map(option=><div key={option.name} style={{padding:'14px 0',borderBottom:'1px solid var(--border)'}}><strong>{option.name}</strong>{option.note && <p>{option.note}</p>}</div>)}
    </>}
    {help.hasWhere && <><h2>{l === 'fr' ? 'Où chercher' : 'Where to look'}</h2>
      {help.shops.length > 0 && <p>{help.shops.join(' · ')}</p>}
      {help.online.length > 0 && <p>{help.online.join(' · ')}</p>}
      {help.links.map(link=><p key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a></p>)}
      {help.note && <p>{help.note}</p>}
    </>}
    {!help.available && <p>{l === 'fr' ? 'Pas encore de suggestion pour ce pays.' : 'No suggestions for this location yet.'}</p>}
  </section>;
}

function ShoppingList({ qtys, locale, numItems, styleKey, recipeIngredients, onGoPrep, onGoPizzas }: {
  qtys: Record<string, number>;
  locale: string;
  numItems: number;
  styleKey?: string;
  recipeIngredients?: Array<{ name: string; amount: string }>;
  onGoPrep?: () => void;
  onGoPizzas?: () => void;
}) {
  const l = locale as 'en' | 'fr';
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [helpIngredientId, setHelpIngredientId] = useState<string | null>(null);
  const [shoppingLocation, setShoppingLocation] = useState<string>('international');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  useEffect(() => { const sync = (event: Event) => setShoppingLocation((event as CustomEvent<string>).detail); window.addEventListener('bh-shopping-location',sync); return () => window.removeEventListener('bh-shopping-location',sync); }, []);
  // Persisted so ticks survive leaving/reopening the app (cleared on Start Over)
  const shopTicksHydrated = useState(() => ({ done: false }))[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bh_shopping_location');
      if (saved) setShoppingLocation(saved);
    } catch {}
    try {
      const rawTicks = localStorage.getItem('bh_shop_ticks_v1');
      if (rawTicks) {
        const restored = JSON.parse(rawTicks) as Record<string, boolean>;
        setTicked(prev => ({ ...restored, ...prev }));
      }
    } catch {}
    shopTicksHydrated.done = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shopTicksHydrated.done) return;
    try { localStorage.setItem('bh_shop_ticks_v1', JSON.stringify(ticked)); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticked]);

  const { sections } = buildShoppingList(qtys, locale, styleKey);
  const totalSelected = Object.values(qtys).reduce((sum, qty) => sum + Math.max(0,qty), 0);

  function toggleTick(id: string) {
    setTicked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function setLocation(loc: string) {
    setShoppingLocation(loc);
    try { localStorage.setItem('bh_shopping_location', loc); } catch {}
    window.dispatchEvent(new CustomEvent('bh-shopping-location',{detail:loc}));
    setShowLocationPicker(false);
  }

  function buildShareText(): string {
    const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS, ...getCustomPizzaList()];
    const pizzaLines = Object.entries(qtys)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const p = allPizzas.find(x => x.id === id);
        return p ? (p.name[l] ?? p.name.en) + (q > 1 ? ` ×${q}` : '') : id;
      }).join(', ');

    let text = `Baker Hub — ${l === 'fr' ? 'Liste de courses Pizza Party' : 'Pizza Party Shopping List'}\n`;
    text += `${pizzaLines}\n\n`;

    if (recipeIngredients?.length) {
      text += `${l === 'fr' ? 'POUR VOTRE PÂTE' : 'FOR YOUR DOUGH'}\n`;
      recipeIngredients.forEach(i => { text += `${i.name}  —  ${i.amount}\n`; });
      text += '\n';
    }

    sections.forEach(section => {
      text += `${section.label.toUpperCase()}\n`;
      section.items.forEach(item => {
        const tick = ticked[item.id] ? '✓' : '';
        const name = item.name[l] ?? item.name.en;
        const qty = item.totalAmount && item.unit ? formatQty(item.totalAmount, item.unit, locale) : '';
        text += `${tick} ${name}${qty ? '  —  ' + qty : ''}\n`;
      });
      text += '\n';
    });

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

  const [linkCopied, setLinkCopied] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function handleShareLink() {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      const supabase = createClient();
      const items = sections.flatMap(section => section.items.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        totalAmount: item.totalAmount,
        unit: item.unit,
      })));
      const doughItems = recipeIngredients ?? [];
      const title = Object.entries(qtys)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => {
          const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS, ...getCustomPizzaList()];
          const p = allPizzas.find(x => x.id === id);
          return p ? (p.name[l] ?? p.name.en) + (q > 1 ? ` ×${q}` : '') : null;
        }).filter(Boolean).join(', ');

      // Keep one editable link per selected menu. A single global id caused a
      // new party to silently overwrite the previous party's shared list.
      const shareStorageKey = `bh_shopping_share_id:${title}`;
      let shareId: string | null = null;
      try { shareId = localStorage.getItem(shareStorageKey); } catch {}

      if (shareId) {
        const { error } = await supabase
          .from('shopping_list_shares')
          .update({ title, items, dough_items: doughItems, checked: ticked })
          .eq('id', shareId);
        if (error) shareId = null; // row may have been removed — fall through to create
      }

      if (!shareId) {
        const { data, error } = await supabase
          .from('shopping_list_shares')
          .insert({ title, items, dough_items: doughItems, checked: ticked })
          .select('id')
          .single();
        if (error || !data) {
          console.error('shopping_list_shares insert error:', error);
          setLinkError(error?.message ?? (l === 'fr' ? 'Erreur inconnue' : 'Unknown error'));
          setLinkBusy(false);
          return;
        }
        shareId = data.id;
        if (shareId) { try { localStorage.setItem(shareStorageKey, shareId); } catch {} }
      }

      const url = `${window.location.origin}/${locale}/list/${shareId}`;
      if (navigator.share) {
        await navigator.share({ url, title: l === 'fr' ? 'Liste de courses Pizza Party' : 'Pizza Party Shopping List' }).catch(() => {});
      } else {
        await navigator.clipboard?.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch (e) {
      console.error('handleShareLink exception:', e);
      setLinkError(e instanceof Error ? e.message : (l === 'fr' ? 'Erreur inconnue' : 'Unknown error'));
    } finally {
      setLinkBusy(false);
    }
  }


  const helpIngredient = sections.flatMap(section => section.items).find(item => item.id === helpIngredientId);
  if (helpIngredient) return <IngredientShoppingHelp item={helpIngredient} location={shoppingLocation} locale={l} onLocationChange={setLocation} onBack={() => setHelpIngredientId(null)} />;

  const currentLocation = LOCATIONS.find(loc => loc.key === shoppingLocation);
  const currentLocationLabel = (l === 'fr' ? currentLocation?.labelFr : currentLocation?.label) ?? 'International';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:30,margin:'16px 12px'}}>{l === 'fr' ? 'Liste de courses' : 'Shopping list'}</h1>
      {/* Header */}
      <div style={{ padding: '12px 12px 8px', background: '#FDFBF7', borderBottom: '1px solid #E0D8CF' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: '15px', fontWeight: 700, color: '#2B2420',
            fontFamily: 'var(--font-ui)',
          }}>
            {(() => {
              const toppingToBuy = sections.reduce((acc, s) => acc + s.items.filter(i => !ticked[i.id]).length, 0);
              const doughToBuy = recipeIngredients?.filter((_, i) => !ticked['dough_' + i]).length ?? 0;
              const toBuy = toppingToBuy + doughToBuy;
              return l === 'fr'
                ? `${totalSelected>0?`${totalSelected} pizza${totalSelected > 1 ? 's' : ''} · `:''}${toBuy} ingrédient${toBuy > 1 ? 's' : ''} à acheter`
                : `${totalSelected>0?`${totalSelected} pizza${totalSelected > 1 ? 's' : ''} · `:''}${toBuy} ingredient${toBuy > 1 ? 's' : ''} to buy`;
            })()}
          </span>
          <button
            onClick={() => setShowLocationPicker(v => !v)}
            style={{ fontSize: '12px', minHeight:44, color: '#8A7F78', background: 'none', border: '1px solid #E0D8CF', borderRadius: '12px', padding: '4px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {l === 'fr' ? `Pays des courses : ${currentLocationLabel} ▾` : `Shopping location: ${currentLocationLabel} ▾`}
          </button>
        </div>
        {showLocationPicker && (
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {LOCATIONS.map(loc => (
              <button
                key={loc.key}
                onClick={() => setLocation(loc.key)}
                style={{
                  fontSize: '11px', padding: '3px 12px', borderRadius: '12px', cursor: 'pointer',
                  border: shoppingLocation === loc.key ? '1px solid #6B4423' : '1px solid #E0D8CF',
                  background: shoppingLocation === loc.key ? '#6B4423' : '#FDFBF7',
                  color: shoppingLocation === loc.key ? 'white' : '#3D3530',
                }}
              >
                {l === 'fr' ? loc.labelFr : loc.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
        {/* Dough is the first thing to buy. Keeping it above the toppings
            mirrors the recipe and prevents the same flour/water being hidden
            after a long topping catalogue. */}
        {recipeIngredients && recipeIngredients.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ padding: '12px 12px 8px', background: '#F0EBE0', borderLeft: '3px solid #6B4423' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#3D3530', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-ui)' }}>
                {l === 'fr' ? 'Pour votre pâte' : 'For your dough'}
              </span>
            </div>
            {recipeIngredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', gap: '12px', borderBottom: '0.5px solid #F0EBE3' }}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!ticked['dough_' + i]}
                  onClick={() => toggleTick('dough_' + i)}
                  aria-label={ing.name}
                  style={{
                    width: '44px', height: '44px', borderRadius: '4px', flexShrink: 0,
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
                <span style={{ fontSize: '13px', color: ticked['dough_' + i] ? '#B0A89E' : '#2B2420', flex: 1, textDecoration: 'none' }}>
                  {ing.name}
                </span>
                <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>{ing.amount}</span>
              </div>
            ))}
          </div>
        )}

        {sections.map(section => (
          <div key={section.label} style={{ marginBottom: '20px' }}>
            <div style={{ padding: '12px 12px 8px 12px', background: '#F0EBE0', borderLeft: '3px solid #6B4423', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#3D3530', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-ui)' }}>
                {section.label}
              </span>
            </div>

            {section.items.map(item => {
              const name = item.name[l] ?? item.name.en;
              const isTicked = ticked[item.id] ?? false;
              const help = ingredientHelpData(item, shoppingLocation, l);

              return (
                <div key={item.id} style={{ borderBottom: '0.5px solid #F0EBE3', background: isTicked ? '#FAFAF8' : '#FDFBF7' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 12px', gap: '12px' }}>
                    <button
                      onClick={() => toggleTick(item.id)}
                      role="checkbox" aria-checked={isTicked} aria-label={name}
                      style={{
                        width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0,
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
                          style={{
                            fontSize: '15px',
                            color: isTicked ? '#B0A89E' : '#2B2420',
                            textDecoration: 'none',
                            fontFamily: 'var(--font-ui)',
                          }}
                        >
                          {name}
                          {item.isCommonPantry && (
                            <span style={{ fontSize: '11px', color: '#8A7F78', marginLeft: '5px', fontStyle: 'italic' }}>{l === 'fr' ? 'placard' : 'pantry'}</span>
                          )}

                        </span>
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
                          {item.totalAmount && item.unit ? formatQty(item.totalAmount, item.unit, locale) : ''}
                        </span>
                      </div>

                      {item.qtyNote && (
                        <div style={{ fontSize: '11px', color: '#A09890', marginTop: '1px' }}>{item.qtyNote}</div>
                      )}

                      {help.available && <button type="button" onClick={() => setHelpIngredientId(item.id)}
                        aria-label={`${help.label} · ${name}`}
                        style={{ background: 'none', border: '1px solid #E0D8CF', borderRadius: 8, minHeight:44, padding: '7px 10px', marginTop: 6, cursor: 'pointer' }}>
                        {help.label}
                      </button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      </div>

      {/* Footer: primary = onward journey (prep), share is secondary */}
      <div style={{ padding: '12px 12px 16px', borderTop: '1px solid #E0D8CF', background: '#FDFBF7' }}>
        <button
          onClick={() => onGoPrep?.()}
          style={{ ...NEXT_CTA, marginBottom: '8px' }}
        >
          {l==='fr'?'Commencer le protocole →':'Start the dough preparation →'}
        </button>
        <button
          type="button"
          onClick={() => onGoPizzas?.()}
          style={{ ...SECONDARY_CTA, marginBottom: '8px' }}
        >
          {totalSelected>0?(l === 'fr' ? 'Modifier les pizzas' : 'Change pizzas'):(l==='fr'?'Choisir des garnitures':'Choose toppings')}
        </button>
        <button
          onClick={handleShare}
          style={SECONDARY_CTA}
        >
          <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="#3D3530" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3v10M6 7l4-4 4 4"/>
            <path d="M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2"/>
          </svg>
          {l === 'fr' ? 'Partager la liste' : 'Share list'}
        </button>
        <button
          onClick={handleShareLink}
          disabled={linkBusy}
          style={{
            width: '100%', padding: '12px', minHeight: '44px', marginTop: '8px',
            background: 'transparent', color: linkCopied ? '#6B7A5A' : '#3D3530',
            border: `1px solid ${linkCopied ? '#6B7A5A' : '#E0D8CF'}`, borderRadius: '12px',
            fontSize: '13px', fontWeight: 500, cursor: linkBusy ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            opacity: linkBusy ? 0.6 : 1,
          }}
        >
          {!linkCopied && (
            <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 12a3 3 0 004.24 0l2.5-2.5a3 3 0 00-4.24-4.24l-1 1"/>
              <path d="M12 8a3 3 0 00-4.24 0l-2.5 2.5a3 3 0 004.24 4.24l1-1"/>
            </svg>
          )}
          {linkCopied
            ? (l === 'fr' ? 'Lien copié ✓' : 'Link copied ✓')
            : (l === 'fr' ? 'Partager un lien cochable' : 'Share checkable link')}
        </button>
        {linkError && (
          <div style={{ fontSize: '11px', color: '#B5654A', marginTop: '8px', textAlign: 'center' }}>
            {l === 'fr' ? 'Échec de la création du lien : ' : "Couldn't create the link: "}{linkError}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export default function ToppingSelector({ locale, numItems, activePill, onPillChange, t, styleKey, controlledQtys, onQtysChange, hidePillBar, onStyleChange, activeStyleKey, onStyleKeyChange, doughConfigured, onGoToMyDough, recipeIngredients,onSelectionDone,selectionDoneLabel,active=true }: Props) {
  const l = locale as 'en' | 'fr';

  // On-screen keyboard detection — position:fixed bottom bars anchor to the
  // shrunken visual viewport when the mobile keyboard opens (e.g. tapping the
  // ingredient search), leaving the summary bar "stuck" mid-screen. Hide it
  // while the keyboard is up; the resize event on close restores it.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      // Keyboard = viewport shrank AND a text field is focused. The ratio
      // alone also fires while mobile-browser chrome (URL bar) collapses on
      // scroll, which hid the bar in browser mode (never in standalone).
      const typing = !!document.activeElement
        && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      setKeyboardOpen(typing && vv.height < window.innerHeight * 0.8);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  // Filter state
  const [filter, setFilter] = useState<FilterState>({
    ...DEFAULT_FILTER,
    styleKey: styleKey as import('../lib/toppingTypes').StyleKey | undefined,
  });

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
  const [regionParent, setRegionParent] = useState<'all' | 'italy' | 'france' | 'asia' | 'fusion'>('all');

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

  // Custom pizzas — baker's own creations from the profile
  const [customVersion, setCustomVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDef, setEditDef] = useState<CustomPizzaDef | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const customPizzas = useMemo(() => getCustomPizzaList(), [customVersion]);

  // Dessert expanded
  const [dessertOpen, setDessertOpen] = useState(false);

  // Filter sheet + ingredient sheet state
  const [filterSheetKey, setFilterSheetKey] = useState<string | null>(null);
  const [ingTab, setIngTab] = useState<string>('Cheese & Dairy');
  const [ingSearch, setIngSearch] = useState('');
  const [ingredientSections, setIngredientSections] = useState<Record<string, boolean>>({});
  const [pizzaCourse, setPizzaCourse] = useState<'savoury' | 'sweet'>('savoury');
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);

  // Style picker popup
  const [showStylePicker, setShowStylePicker] = useState(false);

  // ── Sheet drag ────────────────────────────
  // These three sheets drew a grab bar and accepted no grab — a sheet
  // promising a gesture it does not honour. Same mechanic BakeTab shipped in
  // 3ae7abd: pointer capture on the HANDLE only, so the scrolling body below
  // never fights the finger, and a 120px threshold so a hesitant pull springs
  // back rather than counting as a decision.
  //
  // One offset per sheet, because two can be open at once (the style picker
  // sits above the selector) and a shared number would drag both.
  const [dragY, setDragY] = useState<Record<string, number>>({});
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);

  const closeSummary = () => {
    setSummarySheetOpen(false);
    setDragY(d => ({ ...d, summary: 0 }));
  };
  const closeFilterSheet = () => {
    setFilterSheetKey(null);
    setDragY(d => ({ ...d, filter: 0 }));
  };
  const closeStylePicker = () => {
    setShowStylePicker(false);
    setDragY(d => ({ ...d, style: 0 }));
  };

  // The visible bar is 44x5 to match Bake, inside its own padding — paint and
  // reach are different sizes.
  function sheetHandle(key: string, onClose: () => void) {
    return (
      <div
        onPointerDown={e => {
          dragFrom.current = e.clientY;
          setDraggingKey(key);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (dragFrom.current === null || draggingKey !== key) return;
          setDragY(d => ({ ...d, [key]: Math.max(0, e.clientY - dragFrom.current!) }));
        }}
        onPointerUp={() => {
          const shouldClose = (dragY[key] ?? 0) > 120;
          dragFrom.current = null;
          setDraggingKey(null);
          setDragY(d => ({ ...d, [key]: 0 }));
          if (shouldClose) onClose();
        }}
        style={{ padding: '14px 0 10px', touchAction: 'none', cursor: 'grab', flexShrink: 0 }}
      >
        <div style={{ width: 44, height: 5, background: '#DED5C7', borderRadius: 3, margin: '0 auto' }} />
      </div>
    );
  }
  const sheetTransform = (key: string) => ({
    transform: `translateY(${dragY[key] ?? 0}px)`,
    transition: draggingKey === key ? 'none' : 'transform .22s ease',
  });


  // Name search across the pizza list
  const [nameSearch, setNameSearch] = useState('');
  // Keep the catalogue scannable on a phone. The prototype presents twelve
  // results at a time; without a page boundary a broad search rendered the
  // whole catalogue and pushed the selected-pizza actions far below the fold.
  const [pizzaPage, setPizzaPage] = useState(0);
  const PIZZAS_PER_PAGE = 12;

  // Name-search predicate — shared by the curated list and Mes pizzas
  const matchesSearch = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    if (!q) return null;
    return (p: Pizza) =>
      (p.name.en ?? '').toLowerCase().includes(q) ||
      (p.name.fr ?? '').toLowerCase().includes(q) ||
      p.ingredients.some(ing => (ing.name.en ?? '').toLowerCase().includes(q) || (ing.name.fr ?? '').toLowerCase().includes(q));
  }, [nameSearch]);

  // Filtered pizzas
  const filtered = useMemo(() => {
    const base = filterPizzas(pizzaCourse === 'sweet' ? DESSERT_PIZZAS : PIZZAS, { ...(pizzaCourse === 'sweet' ? DEFAULT_FILTER : filter), styleKey: (styleKey as import('../lib/toppingTypes').StyleKey) ?? undefined });
    return matchesSearch ? base.filter(matchesSearch) : base;
  }, [filter, styleKey, matchesSearch, pizzaCourse]);

  const pizzaPageCount = Math.max(1, Math.ceil(filtered.length / PIZZAS_PER_PAGE));
  const visibleFiltered = filtered.slice(
    pizzaPage * PIZZAS_PER_PAGE,
    (pizzaPage + 1) * PIZZAS_PER_PAGE,
  );

  // A new search, filter, style, or savoury/dessert catalogue always starts
  // at the first page. Clamp as a safety net when a filter removes the page
  // that was visible before it changed.
  useEffect(() => {
    setPizzaPage(0);
  }, [nameSearch, filter, styleKey, pizzaCourse]);
  useEffect(() => {
    setPizzaPage(page => Math.min(page, pizzaPageCount - 1));
  }, [pizzaPageCount]);

  // Mes pizzas go through the exact same pipeline — a base or ingredient
  // filter (or the search) applies to the baker's creations too.
  const filteredCustom = useMemo(() => {
    const base = filterPizzasByCourse(customPizzas, pizzaCourse, filter, (styleKey as import('../lib/toppingTypes').StyleKey) ?? undefined);
    return matchesSearch ? base.filter(matchesSearch) : base;
  }, [customPizzas, filter, styleKey, matchesSearch, pizzaCourse]);

  // Perceived-speed: pre-warm the first screenful-and-a-half of card images
  // during idle time so scrolling meets a full cache, re-armed per filter.
  useEffect(() => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const warm = () => {
      [...customPizzas.slice(0, 4), ...filtered.slice(0, 14)].forEach(pz => {
        if (pz.id.startsWith('custom_')) return;
        const img = new Image();
        img.src = approvedPizzaImage(pz.id);
      });
    };
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(warm);
    else timer = setTimeout(warm, 800);
    return () => { if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId); if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, styleKey]);

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
        (['classic','kids','party','impress','quick'] as const)
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
          'calabrian','italian','alsace','bretagne','savoie','provence',
          'basque','lyonnais','nord','normandie','french','american',
          'asian','fusion','spanish','middle_eastern',
          'north_african','japanese','korean','northern_italian'] as const)
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

  useEffect(() => {
    setFilter(prev => ({
      ...prev,
      styleKey: styleKey as import('../lib/toppingTypes').StyleKey | undefined,
    }));
  }, [styleKey]);

  // ── Filter helpers ──────────────────────────────────────────

  const setBase = (v: BaseType | null) =>
    setFilter((p: FilterState) => ({ ...p, base: v }));

  const setRegion = (v: RegionTag | null) =>
    setFilter((p: FilterState) => ({ ...p, region: v }));
  const setRegions = (v: RegionTag[] | null) =>
    setFilter((p: FilterState) => ({ ...p, regions: v }));

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

  const hasActiveFilters = nameSearch.trim().length > 0 || pizzaCourse !== 'savoury' || Object.keys(DEFAULT_FILTER).some(key => JSON.stringify(filter[key as keyof FilterState]) !== JSON.stringify(DEFAULT_FILTER[key as keyof FilterState]));

  const clearAll = () => {
    setFilter({ ...DEFAULT_FILTER });
    setRegionParent('all');
    setNameSearch('');
    setIngSearch('');
    setPizzaCourse('savoury');
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: '80px' }}>

      {/* ══════════════════════════════════════
          PIZZAS pill
      ══════════════════════════════════════ */}
      {/* Context line: style name + count */}

      {activePill === 'pizzas' && (
        <div style={{
          background: '#FDFBF7',
          borderBottom: '1px solid #E0D8CF',
          padding: '8px 12px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '13px',
            color: '#3D3530',
          }}>
            {styleKey
              ? (l === 'fr'
                  ? (STYLE_NAMES_FR[styleKey] ?? styleKey)
                  : (STYLE_NAMES[styleKey] ?? styleKey))
              : (l === 'fr' ? 'Tous les styles' : 'All styles')}
            {/* Count lives in the "Showing N" filter row below — next to the
                style name it briefly read as "you're making 112 pizzas".
                (A '· Clear' link lived here too — removed: redundant with
                'Clear all' below, and next to the style name it read as
                clearing the style.) */}
          </span>
          <span
            onClick={() => setShowStylePicker(true)}
            style={{
              fontSize: '12px', color: '#6B4423',
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer', textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            {l === 'fr' ? 'Changer' : 'Change'}
          </span>
        </div>
      )}

      {activePill === 'pizzas' && (
        <>
          <h1 style={{fontFamily:'Georgia, serif',fontSize:26,lineHeight:1.15,margin:'10px 0 4px'}}>{l === 'fr' ? 'Choisissez vos pizzas' : 'Choose your pizzas'}</h1>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><span style={{fontSize:13,color:'var(--smoke)'}}>{totalQty} / {numItems} {l === 'fr' ? 'sélectionnées' : 'selected'}</span><button type="button" onClick={() => setCreateOpen(true)} style={{minHeight:44,border:0,background:'none',color:'var(--terra)',textDecoration:'underline',padding:'4px 0',fontSize:13,cursor:'pointer'}}>{l === 'fr' ? 'Créer ma pizza' : 'Create my pizza'}</button></div>
          {/* ── Results strip ── */}
          <div style={{ padding: '0 0 6px', background: '#FDFBF7', borderBottom: '1px solid #E0D8CF', flexShrink: 0 }}>
            <input
              type="search"
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              placeholder={l === 'fr' ? 'Rechercher une pizza ou un ingrédient…' : 'Search a pizza or ingredient…'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px',
                border: '1px solid #E0D8CF', borderRadius: '8px',
                background: 'var(--cream)', color: '#2B2420',
                fontSize: '16px', minHeight:44, fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
            />
          </div>
          {/* ── Chip row: 4 priority + More ── */}
          <style>{'.filter-scroll::-webkit-scrollbar { display: none; }'}</style>
          <div style={{ position: 'relative' }}>
          <div className="filter-scroll" onWheel={handleWheelScroll} style={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: '6px',
            padding: '4px 0 8px',
            scrollPaddingInlineStart: '12px',
            background: '#FDFBF7',
            borderBottom: '1px solid #E0D8CF',
            overflowX: 'auto',
            scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
            WebkitOverflowScrolling: 'touch',
            flexShrink: 0,
            alignItems: 'center',
          }}>
            {([
              { key: 'ingredient', label: l === 'fr' ? 'Ingrédients' : 'Ingredients', count: (filter.ingredientChips ?? []).length },
              { key: 'base', label: 'Base', count: filter.base !== null ? 1 : 0 },
              { key: 'occasion', label: 'Occasion', count: filter.occasion.length },
            ] as const).map(chip => (
              <button
                key={chip.key}
                onClick={() => setFilterSheetKey(chip.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px', minHeight:44,
                  borderRadius: '20px',
                  border: chip.count > 0 ? '1px solid #6B4423' : '1px solid #E0D8CF',
                  background: chip.count > 0 ? '#FBF0EB' : '#FDFBF7',
                  color: chip.count > 0 ? '#993C1D' : '#3D3530',
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap' as const,
                  flexShrink: 0,
                  fontFamily: 'var(--font-ui)',
                  fontWeight: chip.count > 0 ? 500 : 400,
                }}
              >
                {chip.label}
                {chip.count > 0 && (
                  <span style={{
                    background: '#6B4423', color: '#fff',
                    borderRadius: '50%', width: '15px', height: '15px',
                    fontSize: '11px', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, flexShrink: 0,
                  }}>
                    {chip.count}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setFilterSheetKey('more')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', minHeight:44, borderRadius: '20px',
                border: (() => {
                  const moreCnt = (filter.complexity !== null ? 1 : 0)
                    + (filter.region !== null || (filter.regions ?? []).length > 0 ? 1 : 0)
                    + (filter.season !== 'all' ? 1 : 0)
                    + filter.wine.length
                    + (filter.budget !== null ? 1 : 0);
                  return moreCnt > 0 ? '1px solid #3D3530' : '1px solid #8A7F78';
                })(),
                background: '#FDFBF7', color: '#8A7F78',
                fontSize: '12px', cursor: 'pointer',
                whiteSpace: 'nowrap' as const, flexShrink: 0,
                fontFamily: 'var(--font-ui)',
              }}
            >
              {l === 'fr' ? 'Plus ▾' : 'More ▾'}
              {(() => {
                const moreCnt = (filter.complexity !== null ? 1 : 0)
                  + (filter.region !== null || (filter.regions ?? []).length > 0 ? 1 : 0)
                  + (filter.season !== 'all' ? 1 : 0)
                  + filter.wine.length
                  + (filter.budget !== null ? 1 : 0);
                return moreCnt > 0 ? (
                  <span style={{
                    background: '#3D3530', color: '#fff',
                    borderRadius: '50%', width: '15px', height: '15px',
                    fontSize: '11px', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, flexShrink: 0,
                  }}>{moreCnt}</span>
                ) : null;
              })()}
            </button>
          </div>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '32px', height: '100%',
            background: 'linear-gradient(to right, transparent, #FDFBF7)',
            pointerEvents: 'none',
          }} />
          </div>

          {/* ── Active filter chips row ── */}
          {(() => {
            const activeChips: { label: string; onRemove: () => void }[] = [];
            filter.occasion.forEach(o => activeChips.push({
              label: OCCASION_LABELS[o][l],
              onRemove: () => toggleOccasion(o),
            }));
            filter.dietary.forEach(d => activeChips.push({
              label: d,
              onRemove: () => toggleDietary(d),
            }));
            if (filter.complexity !== null) {
              const cLabels: Record<number, string> = { 1: l === 'fr' ? 'Sans prépa' : 'No cook', 2: l === 'fr' ? 'Prépa rapide' : 'Light prep', 3: l === 'fr' ? 'À cuisiner' : 'Cooked' };
              activeChips.push({ label: cLabels[filter.complexity] ?? String(filter.complexity), onRemove: () => setComplexity(null) });
            }
            (filter.ingredientChips ?? []).forEach(ic => activeChips.push({
              label: INGREDIENT_CHIPS.flatMap(group => group.items).find(item => item.search === ic)?.[l] ?? ic,
              onRemove: () => setFilter((p: FilterState) => ({ ...p, ingredientChips: (p.ingredientChips ?? []).filter(c => c !== ic) })),
            }));
            if (filter.base !== null) activeChips.push({ label: BASE_LABELS[filter.base][l], onRemove: () => setBase(null) });
            if (filter.region !== null) {
              activeChips.push({ label: REGION_NAMES[filter.region][l], onRemove: () => setRegion(null) });
            } else if ((filter.regions ?? []).length > 0) {
              const groupLabel = regionParent === 'italy' ? (l === 'fr' ? 'Italie' : 'Italy')
                : regionParent === 'france' ? 'France'
                : regionParent === 'asia' ? 'Asia'
                : (l === 'fr' ? 'Fusion' : 'Fusion');
              activeChips.push({ label: groupLabel, onRemove: () => { setRegions(null); setRegionParent('all'); } });
            }
            if (filter.season !== 'all') activeChips.push({ label: SEASON_LABELS[filter.season][l], onRemove: () => setSeason('all') });
            filter.wine.forEach(w => activeChips.push({ label: WINE_CATEGORY_LABELS[w][l], onRemove: () => toggleWine(w) }));
            if (filter.budget !== null) activeChips.push({ label: BUDGET_LABELS[filter.budget][l], onRemove: () => setBudget(null) });
            if (activeChips.length === 0) return null;
            return (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '4px',
                padding: '8px 12px',
                background: '#FDFBF7',
                borderBottom: '1px solid #E0D8CF',
              }}>
                {activeChips.map((chip, i) => (
                  <span
                    key={i}
                    onClick={chip.onRemove}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 8px', borderRadius: '20px',
                      border: '1px solid #6B4423', background: '#FBF0EB',
                      fontSize: '11px', color: '#993C1D', cursor: 'pointer',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {chip.label}
                    <span style={{ fontSize: '13px', lineHeight: 1, color: '#6B4423' }}>×</span>
                  </span>
                ))}
              </div>
            );
          })()}

          {/* ── Filter bottom sheet ── */}
          {filterSheetKey !== null && (
            <>
              <div
                onClick={closeFilterSheet}
                style={{ position: 'fixed', inset: 0, background: 'rgba(43, 36, 32,0.5)', zIndex: 150 }}
              />
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0,
                  background: '#FDFBF7',
                  borderRadius: '20px 20px 0 0',
                  maxHeight: filterSheetKey === 'more' ? '80dvh' : '65dvh',
                  zIndex: 151,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  ...sheetTransform('filter'),
                }}
              >
                {sheetHandle('filter', closeFilterSheet)}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px', flexShrink: 0, borderBottom: '1px solid #F0EAE3' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2B2420', fontFamily: 'var(--font-ui)' }}>
                    {filterSheetKey === 'occasion'   ? (l === 'fr' ? 'Occasion' : 'Occasion')
                    : filterSheetKey === 'diet'       ? (l === 'fr' ? 'Régime alimentaire' : 'Diet')
                    : filterSheetKey === 'base'       ? 'Base'
                    : filterSheetKey === 'complexity' ? (l === 'fr' ? 'Complexité' : 'Complexity')
                    : filterSheetKey === 'ingredient' ? (l === 'fr' ? 'Par ingrédient' : 'By Ingredient')
                    : (l === 'fr' ? 'Plus de filtres' : 'More filters')}
                  </span>
                  <button
                    onClick={closeFilterSheet}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F0EBE0', border: 'none', fontSize: '14px', color: '#8A7F78', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'content-box', padding: '6px', margin: '-6px' }}
                  >✕</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>

                  {filterSheetKey === 'occasion' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px' }}>
                      {(['classic','kids','party','impress','quick'] as OccasionTag[]).map(o => {
                        if (filterCounts.occasion[o] === 0 && !filter.occasion.includes(o)) return null;
                        const active = filter.occasion.includes(o);
                        return (
                          <span key={o} onClick={() => toggleOccasion(o)} style={S.pill(active, 'terra')}>
                            {OCCASION_LABELS[o][l]}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {filterSheetKey === 'diet' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px' }}>
                      {([
                        ['veg', l === 'fr' ? 'Végétarien' : 'Vegetarian'],
                        ['vegan', 'Vegan'],
                        ['pescatarian', l === 'fr' ? 'Pescatarien' : 'Pescatarian'],
                        ['dairy_free', l === 'fr' ? 'Sans lactose' : 'Dairy-free'],
                      ] as [DietaryTag, string][]).map(([d, label]) => {
                        const active = filter.dietary.includes(d);
                        return (
                          <span key={d} onClick={() => toggleDietary(d)} style={S.pill(active, 'terra')}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {filterSheetKey === 'base' && (
                    <div style={{ margin: '12px 14px' }}>
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
                    </div>
                  )}

                  {filterSheetKey === 'complexity' && (
                    <div style={{ margin: '12px 14px' }}>
                      <div style={{ display: 'flex', border: '1px solid #E0D8CF', borderRadius: '16px', overflow: 'hidden' }}>
                        {([
                          [null,  l === 'fr' ? 'Tous' : 'All'],
                          [1,     l === 'fr' ? 'Sans prépa' : 'No cook'],
                          [2,     l === 'fr' ? 'Prépa rapide' : 'Light prep'],
                          [3,     l === 'fr' ? 'À cuisiner' : 'Cooked'],
                        ] as [ComplexityTier | null, string][]).map(([v, label]) => {
                          const active = filter.complexity === v;
                          return (
                            <div
                              key={String(v)}
                              onClick={() => setComplexity(v)}
                              style={{
                                flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: '11px',
                                background: active ? '#6B4423' : '#FDFBF7',
                                color: active ? '#fff' : '#8A7F78',
                                fontWeight: active ? 600 : 400,
                                cursor: 'pointer', transition: 'all 0.1s',
                                fontFamily: 'var(--font-ui)',
                                borderRight: '1px solid #E0D8CF',
                              }}
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {filterSheetKey === 'ingredient' && (
                    <>
                      <div style={{ padding: '8px 16px 4px' }}>
                        <input
                          type="text"
                          placeholder={l === 'fr' ? 'Rechercher un ingrédient...' : 'Search ingredients...'}
                          value={ingSearch}
                          onChange={e => setIngSearch(e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px',
                            border: '1px solid #E0D8CF', borderRadius: '8px',
                            fontSize: '13px', color: '#2B2420',
                            background: '#FDFBF7', fontFamily: 'var(--font-ui)',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <fieldset style={{ margin: '8px 16px', border: 0, padding: 0 }}>
                        <legend>{l === 'fr' ? 'Correspondance' : 'Match ingredients'}</legend>
                        {(['any', 'all'] as const).map(mode => <label key={mode} style={{ marginRight: 16 }}>
                          <input type="radio" name="ingredient-match" checked={(filter.ingredientMatchMode ?? 'any') === mode}
                            onChange={() => setFilter(p => ({ ...p, ingredientMatchMode: mode }))} />
                          {mode === 'any' ? (l === 'fr' ? 'Au moins un' : 'At least one') : (l === 'fr' ? 'Tous les ingrédients' : 'All selected')}
                        </label>)}
                      </fieldset>
                      {INGREDIENT_CHIPS.map(group => {
                        const items = group.items.filter(item => !ingSearch || `${item.en} ${item.fr}`.toLowerCase().includes(ingSearch.toLowerCase()));
                        if (!items.length) return null;
                        return <details key={group.category.en} open={!!ingSearch || !!ingredientSections[group.category.en]}
                          onToggle={e => { const value=e.currentTarget.open; setIngredientSections(p => p[group.category.en] === value ? p : ({ ...p, [group.category.en]: value })); }}
                          style={{ padding: '10px 16px', borderBottom: '1px solid #E0D8CF' }}>
                          <summary>{group.category[l]}</summary>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 10 }}>
                            {items.map(item => { const active=(filter.ingredientChips ?? []).includes(item.search); return <button type="button" key={item.search} aria-pressed={active}
                              onClick={() => setFilter(p => ({ ...p, ingredientChips: active ? (p.ingredientChips ?? []).filter(x => x !== item.search) : [...(p.ingredientChips ?? []), item.search] }))}
                              style={S.pill(active, 'terra')}>{item[l]}</button>; })}
                          </div>
                        </details>;
                      })}
                    </>
                  )}

                  {filterSheetKey === 'more' && (
                    <>
                      <fieldset style={{ margin: 16, border: 0, padding: 0 }}><legend>{l === 'fr' ? 'Salée ou sucrée' : 'Savoury or sweet'}</legend>
                        {(['savoury','sweet'] as const).map(course => <label key={course} style={{ marginRight: 16 }}><input type="radio" name="pizza-course" checked={pizzaCourse === course} onChange={() => setPizzaCourse(course)} />{course === 'sweet' ? (l === 'fr' ? 'Pizzas dessert' : 'Dessert pizzas') : (l === 'fr' ? 'Pizzas salées' : 'Savoury pizzas')}</label>)}
                        {pizzaCourse === 'sweet' && <p>{l === 'fr' ? 'Les filtres salés sont en pause.' : 'Savoury filters are paused.'}</p>}
                      </fieldset>
                      <FilterSection title={l === 'fr' ? 'Préférences alimentaires' : 'Dietary preferences'} open={open.diet} onToggle={() => togOpen('diet')}>
                        {(['veg','vegan','no_pork','no_fish','no_nuts','dairy_free'] as DietaryTag[]).map(value => <button key={value} type="button" style={S.pill(filter.dietary.includes(value), 'terra')} onClick={() => toggleDietary(value)}>{({veg: l==='fr'?'Végétarien':'Vegetarian',vegan:l==='fr'?'Végétalien':'Vegan',no_pork:l==='fr'?'Sans porc':'No pork',no_fish:l==='fr'?'Sans poisson':'No fish',no_nuts:l==='fr'?'Sans fruits à coque':'No nuts',dairy_free:l==='fr'?'Sans produits laitiers':'Dairy free'} as Record<string,string>)[value]}</button>)}
                      </FilterSection>

                      <FilterSection
                        title={l === 'fr' ? 'Complexité' : 'Complexity'}
                        badge={filter.complexity !== null ? '1' : undefined}
                        open={open.base}
                        onToggle={() => togOpen('base')}
                      >
                        <div style={S.pillRow}>
                          {([
                            [null,  l === 'fr' ? 'Tous' : 'All'],
                            [1,     l === 'fr' ? 'Sans prépa' : 'No cook'],
                            [2,     l === 'fr' ? 'Prépa rapide' : 'Light prep'],
                            [3,     l === 'fr' ? 'À cuisiner' : 'Cooked'],
                          ] as [ComplexityTier | null, string][]).map(([v, label]) => (
                            <span key={String(v)} style={S.pill(filter.complexity === v, 'terra')}
                              onClick={() => setComplexity(v)}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </FilterSection>

                      <FilterSection
                        title={l === 'fr' ? 'Région' : 'Region'}
                        badge={regionParent !== 'all' ? (regionParent === 'italy' ? '' : regionParent === 'france' ? '' : regionParent === 'asia' ? '' : '') : undefined}
                        open={open.region}
                        onToggle={() => togOpen('region')}
                      >
                        <div style={S.pillRow}>
                          {(['all','italy','france','asia','fusion'] as const).map(r => (
                            <span key={r} style={S.pill(regionParent === r, 'terra')}
                              onClick={() => { setRegionParent(r); setRegion(null); setRegions(r === 'all' ? null : REGION_GROUP_MAP[r] ?? null); }}>
                              {r === 'all'    ? (l === 'fr' ? 'Toutes' : 'All')
                              : r === 'italy'  ? (l === 'fr' ? 'Italie' : 'Italy')
                              : r === 'france' ? 'France'
                              : r === 'asia'   ? 'Asia'
                              : 'Fusion'}
                            </span>
                          ))}
                        </div>
                        {(regionParent === 'italy' || regionParent === 'france' || regionParent === 'asia') && (
                          <div style={{ ...S.subSec, marginTop: '8px' }}>
                            <span style={S.subLbl}>
                              {regionParent === 'italy'
                                ? (l === 'fr' ? 'Régions italiennes' : 'Italian regions')
                                : regionParent === 'france'
                                ? (l === 'fr' ? 'Régions françaises' : 'French regions')
                                : (l === 'fr' ? 'Cuisine asiatique' : 'Asian cuisine')}
                            </span>
                            <div style={S.pillRow}>
                              {(regionParent === 'italy' ? ITALY_REGIONS : regionParent === 'france' ? FRANCE_REGIONS : ASIA_REGIONS).map(r => {
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
                      </FilterSection>

                      <FilterSection
                        title={l === 'fr' ? 'Saison' : 'Season'}
                        badge={filter.season !== 'all' ? SEASON_LABELS[filter.season][l] : undefined}
                        open={open.season}
                        onToggle={() => togOpen('season')}
                      >
                        <div style={S.pillRow}>
                          {(['all','spring','summer','autumn','winter'] as Season[]).map(s => (
                            <span key={s}
                              style={S.pill(filter.season === s, filter.season === s && s === 'all' ? 'terra' : 'sage')}
                              onClick={() => setSeason(s)}>
                              {SEASON_LABELS[s][l]}{s === currentSeason && s !== 'all' ? (l === 'fr' ? ' · maintenant' : ' · now') : ''}
                            </span>
                          ))}
                        </div>
                      </FilterSection>

                      <FilterSection
                        title={l === 'fr' ? 'Accord vin' : 'Wine pairing'}
                        badge={filter.wine.length > 0 ? `${filter.wine.length}` : undefined}
                        open={open.wine}
                        onToggle={() => togOpen('wine')}
                      >
                        <div style={S.pillRow}>
                          {(Object.keys(WINE_CATEGORY_LABELS) as WineCategory[]).map(w => {
                            const active = filter.wine.includes(w);
                            return (
                              <span key={w} style={S.winePill(active)} onClick={() => toggleWine(w)}>
                                {WINE_CATEGORY_LABELS[w][l]}
                              </span>
                            );
                          })}
                        </div>
                      </FilterSection>

                      <FilterSection
                        title={l === 'fr' ? 'Budget' : 'Budget'}
                        badge={filter.budget !== null ? BUDGET_LABELS[filter.budget][l] : undefined}
                        open={open.budget}
                        onToggle={() => togOpen('budget')}
                      >
                        <div style={S.pillRow}>
                          <span style={S.pill(filter.budget === null, 'terra')} onClick={() => setBudget(null)}>
                            {l === 'fr' ? 'Tous' : 'All'}
                          </span>
                          {([1, 2, 3] as BudgetTier[]).map(b => {
                            if (filterCounts.budget[b] === 0 && filter.budget !== b) return null;
                            return (
                              <span key={b} style={S.pill(filter.budget === b, 'terra')}
                                onClick={() => setBudget(filter.budget === b ? null : b)}>
                                {BUDGET_LABELS[b][l]}
                              </span>
                            );
                          })}
                        </div>
                      </FilterSection>

                      {(() => {
                        const FLAVOR_CHIPS: { key: FlavorChip; en: string; fr: string }[] = [
                          { key: 'light',    en: 'Light',    fr: 'Léger' },
                          { key: 'rich',     en: 'Rich',     fr: 'Riche' },
                          { key: 'mild',     en: 'Mild',     fr: 'Doux' },
                          { key: 'bold',     en: 'Bold',     fr: 'Puissant' },
                          { key: 'creative', en: 'Creative', fr: 'Créatif' },
                          { key: 'spicy',    en: 'Spicy',    fr: 'Épicé' },
                        ];
                        return (
                          <FilterSection
                            title={l === 'fr' ? 'Saveurs' : 'Flavour'}
                            badge={filter.flavour.length > 0 ? `${filter.flavour.length}` : undefined}
                            open={open.flavour}
                            onToggle={() => togOpen('flavour')}
                          >
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '4px 0 8px' }}>
                              {FLAVOR_CHIPS.map(chip => {
                                const active = filter.flavour.includes(chip.key);
                                return (
                                  <button
                                    key={chip.key}
                                    onClick={() => {
                                      const next = active
                                        ? filter.flavour.filter(c => c !== chip.key)
                                        : [...filter.flavour, chip.key];
                                      setFilter(p => ({ ...p, flavour: next }));
                                    }}
                                    style={{
                                      padding: '4px 16px',
                                      borderRadius: '20px',
                                      border: active ? '1.5px solid var(--terra)' : '1px solid var(--border)',
                                      background: active ? 'rgba(107, 68, 35,0.1)' : 'var(--cream)',
                                      color: active ? 'var(--terra)' : 'var(--ash)',
                                      fontFamily: 'var(--font-ui)',
                                      fontSize: '13px',
                                      cursor: 'pointer',
                                      transition: 'all .15s',
                                    }}
                                  >
                                    {l === 'fr' ? chip.fr : chip.en}
                                  </button>
                                );
                              })}
                            </div>
                          </FilterSection>
                        );
                      })()}
                    </>
                  )}

                </div>

                {filterSheetKey === 'more' && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #F0EAE3', display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => { clearAll(); }}
                      style={{
                        flex: 1, padding: '12px', border: '1px solid #E0D8CF',
                        borderRadius: '12px', background: '#FDFBF7',
                        fontSize: '12px', color: '#8A7F78', cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {l === 'fr' ? 'Réinitialiser' : 'Reset'}
                    </button>
                    <button
                      onClick={() => setFilterSheetKey(null)}
                      style={{
                        flex: 2, padding: '12px', border: 'none',
                        borderRadius: '12px', background: '#6B4423',
                        fontSize: '13px', fontWeight: 600, color: '#fff',
                        cursor: 'pointer', fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {l === 'fr'
                        ? `Voir ${filtered.length} pizza${filtered.length !== 1 ? 's' : ''}`
                        : `Show ${filtered.length} pizza${filtered.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0EBE0', borderBottom: '1px solid #E0D8CF', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#8A7F78' }}>
              {l === 'fr'
                ? `${filtered.length} pizza${filtered.length !== 1 ? 's' : ''}`
                : `Showing ${filtered.length} pizza${filtered.length !== 1 ? 's' : ''}`}
              {filter.season !== 'all' ? ` · ${SEASON_LABELS[filter.season][l]}` : ''}
            </span>
            {hasActiveFilters && <button onClick={clearAll} style={{ fontSize: '13px', color: '#6B4423', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 8px', minHeight: '44px', margin: '-12px -8px' }}>
              {l === 'fr' ? 'Tout effacer' : 'Clear all'}
            </button>}
          </div>

          {/* ── Cards + dessert + summary ── */}
          <div>

            <div>

              {/* Mes pizzas — only once the baker has creations; the menu
                  always comes before the invitation to leave it */}
              {customPizzas.some(p => pizzaCourse === 'sweet' ? p.category === 'dessert' : p.category !== 'dessert') && (
              <div style={{ padding: '8px 12px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 0' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: '#8A7F78', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                    {l === 'fr' ? 'Mes pizzas' : 'My pizzas'}
                  </span>
                  <button
                    onClick={() => setCreateOpen(true)}
                    style={{
                      border: '1px dashed rgba(107, 68, 35,0.45)', borderRadius: '12px',
                      background: 'rgba(107, 68, 35,0.04)', padding: '4px 12px', cursor: 'pointer',
                      fontFamily: 'var(--font-ui)', fontSize: '11px', color: '#6B4423',
                    }}
                  >
                    {l === 'fr' ? '+ Nouvelle' : '+ New'}
                  </button>
                </div>
                {filteredCustom.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', padding: '2px 2px 4px' }}>
                    {l === 'fr' ? 'Aucune de vos pizzas ne correspond aux filtres actifs.' : 'None of your pizzas match the active filters.'}
                  </div>
                )}
                {filteredCustom.map(pizza => (
                  <div key={pizza.id} style={{ position: 'relative' }}>
                    <PizzaCard
                      pizza={pizza}
                      qty={getQty(pizza.id)}
                      locale={locale}
                      styleKey={styleKey}
                      onQtyChange={(delta, e) => { e.stopPropagation(); changeQty(pizza.id, delta); }}
                      onTap={() => setSheetId(pizza.id)}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); const d = loadCustomPizzas().find(x => x.id === pizza.id); if (d) setEditDef(d); }}
                      title={l === 'fr' ? 'Modifier' : 'Edit'}
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        border: '1px solid #E8E0D5', borderRadius: '12px', padding: '3px 8px',
                        background: 'rgba(253,251,247,0.92)', cursor: 'pointer',
                        fontFamily: 'var(--font-ui)', fontSize: '11px', color: '#6B4423',
                      }}
                    ></button>
                  </div>
                ))}
              </div>
              )}

              {/* Pizza cards */}
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {visibleFiltered.map(pizza => (
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
                  <div style={{ textAlign: 'center', padding: '24px 16px 8px', color: '#8A7F78', fontSize: '13px' }}>
                    {l === 'fr'
                      ? 'Aucune pizza ne correspond — essayez d\'effacer les filtres'
                      : 'No pizzas match — try clearing some filters'}
                  </div>
                )}
                {pizzaPageCount > 1 && (
                  <nav
                    aria-label={l === 'fr' ? 'Pages de pizzas' : 'Pizza pages'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '8px', padding: '12px 0 4px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPizzaPage(page => Math.max(0, page - 1))}
                      disabled={pizzaPage === 0}
                      style={{
                        ...SECONDARY_CTA, flex: 1, minHeight: '44px', padding: '10px 12px',
                        opacity: pizzaPage === 0 ? 0.45 : 1,
                        cursor: pizzaPage === 0 ? 'default' : 'pointer',
                      }}
                    >
                      {l === 'fr' ? '← Précédent' : '← Previous'}
                    </button>
                    <span style={{ minWidth: '76px', textAlign: 'center', fontSize: '12px', color: '#8A7F78' }}>
                      {pizzaPage + 1} / {pizzaPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPizzaPage(page => Math.min(pizzaPageCount - 1, page + 1))}
                      disabled={pizzaPage >= pizzaPageCount - 1}
                      style={{
                        ...SECONDARY_CTA, flex: 1, minHeight: '44px', padding: '10px 12px',
                        opacity: pizzaPage >= pizzaPageCount - 1 ? 0.45 : 1,
                        cursor: pizzaPage >= pizzaPageCount - 1 ? 'default' : 'pointer',
                      }}
                    >
                      {l === 'fr' ? 'Suivant →' : 'Next →'}
                    </button>
                  </nav>
                )}
              </div>

            </div>

            {(createOpen || editDef) && (
              <CreatePizzaSheet
                locale={locale}
                initial={editDef ?? undefined}
                onClose={() => { setCreateOpen(false); setEditDef(null); }}
                onCreated={() => setCustomVersion(v => v + 1)}
              />
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
        <>
        <ShoppingList
          qtys={qtys}
          locale={locale}
          numItems={numItems}
          styleKey={styleKey}
          recipeIngredients={recipeIngredients}
          onGoPrep={() => onPillChange('party')}
          onGoPizzas={() => onPillChange('pizzas')}
        />

        </>
      )}

      {/* ══════════════════════════════════════
          PARTY TIME pill — placeholder for Prompt 9
      ══════════════════════════════════════ */}
      {activePill === 'party' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: '#8A7F78', fontSize: '13px', textAlign: 'center' }}>
          {l === 'fr' ? 'Au four ! — bientôt disponible' : 'Let\'s cook — coming soon'}
        </div>
      )}

      {/* ── Summary sheet ── */}
      {summarySheetOpen && (
        <>
          <div
            onClick={closeSummary}
            style={{ position: 'fixed', inset: 0, background: 'rgba(43, 36, 32,0.52)', zIndex: 160 }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: '#FDFBF7', borderRadius: '20px 20px 0 0',
              maxHeight: '75dvh', zIndex: 161, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              ...sheetTransform('summary'),
            }}
          >
            {sheetHandle('summary', closeSummary)}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px', flexShrink: 0, borderBottom: '1px solid #F0EAE3' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#2B2420', fontFamily: 'var(--font-ui)' }}>
                {l === 'fr' ? 'Mes pizzas' : 'My pizzas'}
              </span>
              <button onClick={closeSummary}
                aria-label={l === 'fr' ? 'Fermer' : 'Close'}
                style={{ width: '44px', height: '44px', padding: '8px', margin: '-8px', backgroundClip: 'content-box', borderRadius: '50%', background: '#F0EBE0', border: 'none', fontSize: '14px', color: '#8A7F78', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>

                <>
                  {Object.entries(qtys).filter(([, q]) => (q as number) > 0).map(([pizzaId, qty]) => {
                    const pizza = getPizzaById(pizzaId);
                    if (!pizza) return null;
                    return (
                      <div key={pizzaId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #F0EAE3' }}>
                        <span style={{ fontSize: '13px', color: '#2B2420', fontFamily: 'var(--font-ui)', flex: 1 }}>
                          {pizza.name[l] ?? pizza.name.en}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button onClick={() => changeQty(pizzaId, -1)} style={{ width: '44px', height: '44px', flexShrink: 0, borderRadius: '50%', border: '1px solid #E0D8CF', background: '#FDFBF7', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>−</button>
                          <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '16px', textAlign: 'center', fontFamily: 'var(--font-ui)' }}>{qty as number}</span>
                          <button onClick={() => changeQty(pizzaId, 1)} style={{ width: '44px', height: '44px', flexShrink: 0, borderRadius: '50%', border: '1px solid #6B4423', background: '#6B4423', cursor: 'pointer', fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Dough awareness */}
                  {(() => {
                    if (doughConfigured && totalQty <= numItems) return null;
                    if (!doughConfigured) return (
                      <div
                        onClick={onGoToMyDough}
                        style={{
                          margin: '8px 14px 0',
                          padding: '12px 12px',
                          background: 'rgba(107, 68, 35,0.06)',
                          border: '1px solid rgba(107, 68, 35,0.15)',
                          borderRadius: '16px',
                          cursor: onGoToMyDough ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>
                          {l === 'fr'
                            ? 'Définissez vos quantités dans Ma fournée'
                            : 'Set your dough quantities in My bake'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#6B4423', fontFamily: 'var(--font-ui)' }}>→</span>
                      </div>
                    );
                    return (
                      <div
                        onClick={onGoToMyDough}
                        style={{
                          margin: '8px 14px 0',
                          padding: '12px 12px',
                          background: 'rgba(156, 130, 72,0.08)',
                          border: '1px solid rgba(156, 130, 72,0.3)',
                          borderRadius: '16px',
                          cursor: onGoToMyDough ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>
                          {l === 'fr'
                            ? 'Vous aurez peut-être besoin de plus de pâte — ajustez dans Ma fournée'
                            : 'You may need more dough — adjust in My bake'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#9C8248', fontFamily: 'var(--font-ui)' }}>→</span>
                      </div>
                    );
                  })()}
                </>

            </div>
            <div style={{padding:'12px 16px',display:'grid',gap:8,borderTop:'1px solid var(--border)'}}>
              <button type="button" onClick={()=>{closeSummary();if(onSelectionDone)onSelectionDone();else onPillChange('shopping');}} style={NEXT_CTA}>{selectionDoneLabel??(l === 'fr' ? 'Liste de courses' : 'Shopping list')}</button>
              <button type="button" onClick={()=>{closeSummary();onPillChange('party');}} style={SECONDARY_CTA}>{l === 'fr' ? 'Préparer les garnitures' : 'Prepare toppings'}</button>
              <button type="button" onClick={closeSummary} style={SECONDARY_CTA}>{l === 'fr' ? 'Choisir d’autres pizzas' : 'Choose more pizzas'}</button>
            </div>
          </div>
        </>
      )}

      {/* ── Style picker bottom sheet ── */}
      {showStylePicker && (
        <>
          <div
            onClick={closeStylePicker}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(43, 36, 32,0.5)',
              zIndex: 200,
            }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: '#FDFBF7',
              borderRadius: '20px 20px 0 0',
              maxHeight: '70dvh',
              zIndex: 201,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              ...sheetTransform('style'),
            }}
          >
            {sheetHandle('style', closeStylePicker)}
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '17px', fontWeight: 700,
              color: 'var(--char)',
              padding: '12px 16px 8px',
              flexShrink: 0,
            }}>
              {l === 'fr' ? 'Choisir un style de pizza' : 'Choose a pizza style'}
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
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
                      closeStylePicker();
                      onStyleKeyChange?.(key);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px 16px',
                      borderBottom: idx < arr.length - 1
                        ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'rgba(107, 68, 35,0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '15px', fontWeight: 600,
                        color: 'var(--char)',
                      }}>
                        {name}
                      </div>
                    </div>
                    {isDoughStyle && (
                      <span style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '11px',
                        color: 'var(--gold)',
                        background: 'rgba(156, 130, 72,0.15)',
                        borderRadius: '8px',
                        padding: '2px 8px',
                        marginRight: '8px',
                        flexShrink: 0,
                      }}>
                        {l === 'fr' ? 'Votre pâte' : 'Your dough'}
                      </span>
                    )}
                    {isSelected && (
                      <span style={{
                        fontFamily: 'var(--font-ui)',
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
              padding: '12px 16px 20px',
              fontSize: '11px',
              color: 'var(--smoke)',
              fontFamily: 'var(--font-ui)',
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

      {/* ── Sticky bar — always visible when pizzas pill active ──
           Hidden while the mobile keyboard is open: fixed bars anchor to the
           visual viewport and would float mid-screen above the keyboard. */}
      {active && activePill === 'pizzas' && (totalQty > 0 || !!onSelectionDone) && !keyboardOpen && (
        <div data-companion-action style={{
          // The bar sits ON the home indicator, so it pins to bottom 0 and
          // carries the safe-area inset as padding instead. Offsetting by
          // bottomNavH AND padding by the inset counted the same gap twice,
          // and on a rounded screen the second line still landed in the curve.
          position: 'fixed', bottom: 0, left: 0, right: 0,
          // The only dark surface below the header, which is why this bar read
          // as belonging to a different product. Sticky is right — you need
          // the count and the way out while browsing — the costume was not.
          // Warm surface, hairline top, and the shadow doing the lifting.
          background: 'var(--warm)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -4px 14px -10px rgba(26,22,18,0.5)',
          // 18px -> 24px. The inset was already here (and must not be paired
          // with a bottomNavH offset — see the comment on the scroll container,
          // that double-counted the same gap). What was too small is the
          // additive constant against the bar's recast surface. Matched by the
          // three sheet bodies above, whose last row used to sit under the
          // home indicator with no inset at all.
          padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', alignItems: 'center', gap: '12px',
          justifyContent: 'space-between',
          zIndex: 90,
        }}>
          <button type="button" disabled={totalQty === 0&&!onSelectionDone} onClick={() => totalQty===0?onSelectionDone?.():setSummarySheetOpen(true)} style={{...NEXT_CTA,width:'100%',minHeight:44,opacity:totalQty===0&&!onSelectionDone ? .65 : 1}}>
            {totalQty === 0 ? (onSelectionDone?(l==='fr'?'Continuer sans garnitures':'Continue without toppings'):(l === 'fr' ? 'Choisissez vos pizzas' : 'Choose your pizzas')) : (l === 'fr' ? `Voir ma sélection · ${totalQty} pizza${totalQty > 1 ? 's' : ''}` : `Review selection · ${totalQty} pizza${totalQty > 1 ? 's' : ''}`)}
          </button>

        </div>
      )}

    </div>
  );
}
