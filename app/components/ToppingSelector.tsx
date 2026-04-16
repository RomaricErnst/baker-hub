'use client';
import { useState, useMemo } from 'react';
import {
  PIZZAS, DESSERT_PIZZAS, getPizzaById,
  BASE_LABELS, OCCASION_LABELS, SEASON_LABELS,
  WINE_CATEGORY_LABELS, WINE_EXAMPLES,
  BUDGET_LABELS, COMPLEXITY_LABELS,
  INGREDIENT_CATEGORY_LABELS,
  filterPizzas, getFilterCounts, DEFAULT_FILTER, getCurrentSeason,
  type Pizza, type FilterState, type WineCategory, type BaseType,
  type OccasionTag, type DietaryTag, type Season, type BudgetTier,
  type ComplexityTier, type RegionTag,
} from '../lib/toppingDatabase';

// ─── Types ───────────────────────────────────────────────────

type Qty = Record<string, number>;

interface Props {
  locale: string;
  numItems: number;
  activePill: 'pizzas' | 'shopping' | 'party';
  onPillChange: (pill: 'pizzas' | 'shopping' | 'party') => void;
  t: (key: string) => string;
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
  american:   { en: 'American', fr: 'Américaine' },
  asian:      { en: 'Asian',    fr: 'Asiatique' },
  fusion:     { en: 'Fusion',   fr: 'Fusion' },
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
    fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
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
    fontSize: '24px', flexShrink: 0, width: '40px', height: '40px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#F0EBE3', borderRadius: '8px',
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

function PizzaCard({ pizza, qty, locale, onQtyChange, onTap }: {
  pizza: Pizza; qty: number; locale: string;
  onQtyChange: (delta: number, e: React.MouseEvent) => void;
  onTap: () => void;
}) {
  const l = locale as 'en' | 'fr';
  const name  = pizza.name[l]   ?? pizza.name.en;
  const story = pizza.story?.[l] ?? pizza.story?.en ?? '';
  const tags  = pizza.occasion.slice(0, 2).map(o =>
    OCCASION_LABELS[o]?.[l] ?? o
  );
  const seasonEmoji =
    pizza.season.includes('winter') && !pizza.season.includes('all') ? '❄️' :
    pizza.season.includes('autumn') && !pizza.season.includes('all') ? '🍂' :
    pizza.season.includes('spring') && !pizza.season.includes('all') ? '🌸' :
    pizza.season.includes('summer') && !pizza.season.includes('all') ? '☀️' : null;

  return (
    <div style={S.card(qty > 0)} onClick={onTap}>
      <div style={{ display: 'flex', gap: '10px', padding: '9px 10px 6px', alignItems: 'flex-start' }}>
        <div style={S.cardEmoji}>
          <span style={{ fontSize: '24px' }}>{pizzaEmoji(pizza.id)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1612', marginBottom: '1px' }}>{name}</div>
          <div style={{ fontSize: '10px', color: '#8A7F78', lineHeight: 1.4, marginBottom: '4px' }}>{story}</div>
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {seasonEmoji && <span style={S.tag('season')}>{seasonEmoji}</span>}
            {tags.map((tag, i) => <span key={i} style={S.tag('default')}>{tag}</span>)}
            {pizza.budget === 3 && <span style={S.tag('special')}>€€€</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', color: '#8A7F78' }}>
          {pizza.prepMinutes} min · {'€'.repeat(pizza.budget)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {qty > 0 && (
            <>
              <button style={S.qtyBtn} onClick={e => onQtyChange(-1, e)}>−</button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#C4522A', minWidth: '16px', textAlign: 'center' }}>{qty}</span>
            </>
          )}
          {qty > 0 ? (
            <button style={S.qtyBtn} onClick={e => onQtyChange(1, e)}>+</button>
          ) : (
            <button style={S.addBtn} onClick={e => onQtyChange(1, e)}>
              {l === 'fr' ? '+ Ajouter' : '+ Add'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pizza sheet ──────────────────────────────────────────────

function PizzaSheet({ pizza, qty, locale, onQtyChange, onClose }: {
  pizza: Pizza; qty: number; locale: string;
  onQtyChange: (delta: number) => void;
  onClose: () => void;
}) {
  const l = locale as 'en' | 'fr';
  const beforeIngs = pizza.ingredients.filter(i => i.bakeOrder === 'before');
  const afterIngs  = pizza.ingredients.filter(i => i.bakeOrder === 'after');

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: 'rgba(26,22,18,0.5)', zIndex: 10, borderRadius: '0 0 24px 24px' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#FDFBF7', borderRadius: '14px 14px 0 0', padding: '12px 14px 14px', maxHeight: '80%', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: '32px', height: '3px', background: '#E0D8CF', borderRadius: '2px', margin: '0 auto 10px' }} />
        <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '14px', background: 'none', border: 'none', fontSize: '16px', color: '#8A7F78', cursor: 'pointer' }}>✕</button>

        {/* Title + story */}
        <div style={{ fontSize: '15px', fontWeight: 500, color: '#1A1612', marginBottom: '2px' }}>
          {pizzaEmoji(pizza.id)} {pizza.name[l] ?? pizza.name.en}
        </div>
        <div style={{ fontSize: '11px', color: '#8A7F78', marginBottom: '8px', lineHeight: 1.5 }}>
          {pizza.story?.[l] ?? pizza.story?.en}
        </div>

        {/* Wine note */}
        {pizza.wineNote && (
          <div style={{ fontSize: '11px', color: '#7A4A8A', background: '#F5EDF8', borderRadius: '8px', padding: '5px 8px', marginBottom: '8px' }}>
            {pizza.wineNote[l] ?? pizza.wineNote.en}
          </div>
        )}

        {/* Quantity */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#F5F0E8', borderRadius: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', color: '#3D3530', fontWeight: 500 }}>
            {l === 'fr' ? 'Combien ?' : 'How many?'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button style={{ ...S.qtyBtn, width: '30px', height: '30px' }} onClick={() => onQtyChange(-1)}>−</button>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#C4522A', minWidth: '22px', textAlign: 'center' }}>{qty}</span>
            <button style={{ ...S.qtyBtn, width: '30px', height: '30px' }} onClick={() => onQtyChange(1)}>+</button>
          </div>
        </div>

        {/* Before baking */}
        {beforeIngs.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, padding: '5px 8px', borderRadius: '6px', marginBottom: '4px', background: '#FFF0EC', color: '#C4522A' }}>
              🔥 {l === 'fr' ? 'Va sur la pizza avant cuisson' : 'Goes on before baking'}
            </div>
            {beforeIngs.map(ing => (
              <div key={ing.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #F0EBE3' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: '#1A1612' }}>{ing.name[l] ?? ing.name.en}</div>
                  {ing.prepNote && (
                    <div style={{ fontSize: '10px', color: '#6B7A5A', marginTop: '1px' }}>
                      {ing.prepNote[l] ?? ing.prepNote.en}
                    </div>
                  )}
                  {ing.goodEnough && (
                    <div style={{ fontSize: '10px', color: '#6B7A5A', marginTop: '1px' }}>
                      → {ing.goodEnough.name[l] ?? ing.goodEnough.name.en}
                    </div>
                  )}
                </div>
                <span style={S.ingBadge}>
                  {INGREDIENT_CATEGORY_LABELS[ing.category]?.[l] ?? ing.category}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* After baking */}
        {afterIngs.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, padding: '5px 8px', borderRadius: '6px', marginBottom: '4px', background: '#EFF5E8', color: '#3B6D11' }}>
              ✅ {l === 'fr' ? 'Ajouter après cuisson' : 'Added after baking'}
            </div>
            {afterIngs.map(ing => (
              <div key={ing.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #F0EBE3' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: '#1A1612' }}>{ing.name[l] ?? ing.name.en}</div>
                  {ing.prepNote && (
                    <div style={{ fontSize: '10px', color: '#6B7A5A', marginTop: '1px' }}>
                      {ing.prepNote[l] ?? ing.prepNote.en}
                    </div>
                  )}
                  {ing.goodEnough && (
                    <div style={{ fontSize: '10px', color: '#6B7A5A', marginTop: '1px' }}>
                      → {ing.goodEnough.name[l] ?? ing.goodEnough.name.en}
                    </div>
                  )}
                </div>
                <span style={S.ingBadge}>
                  {INGREDIENT_CATEGORY_LABELS[ing.category]?.[l] ?? ing.category}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={onClose}
          style={{ width: '100%', padding: '11px', background: '#C4522A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', marginTop: '10px' }}
        >
          {qty > 0
            ? (l === 'fr' ? `✓ ${qty} ajoutée${qty > 1 ? 's' : ''} — continuer` : `✓ ${qty} added — keep browsing`)
            : (l === 'fr' ? 'Ajouter à ma pizza party →' : 'Add to my pizza party →')}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export default function ToppingSelector({ locale, numItems, activePill, onPillChange, t }: Props) {
  const l = locale as 'en' | 'fr';

  // Filter state
  const [filter, setFilter] = useState<FilterState>({ ...DEFAULT_FILTER });

  // Section open/closed — Occasion open by default, all others closed
  const [open, setOpen] = useState<Record<string, boolean>>({
    occasion: true, base: false, region: false, season: false,
    diet: false, wine: false, budget: false, flavour: false,
  });
  const togOpen = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  // Region parent selection
  const [regionParent, setRegionParent] = useState<'all' | 'italy' | 'france' | 'fusion'>('all');

  // Quantities
  const [qtys, setQtys] = useState<Qty>({});
  const getQty = (id: string) => qtys[id] ?? 0;
  const totalQty = Object.values(qtys).reduce((a, b) => a + b, 0);
  const changeQty = (id: string, delta: number) => {
    setQtys(prev => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) };
      if (!next[id]) delete next[id];
      return next;
    });
  };

  // Summary open
  const [sumOpen, setSumOpen] = useState(false);

  // Sheet
  const [sheetId, setSheetId] = useState<string | null>(null);
  const sheetPizza = sheetId ? (getPizzaById(sheetId) ?? null) : null;

  // Dessert expanded
  const [dessertOpen, setDessertOpen] = useState(false);

  // Flavour slider values — separate from filter for UI display
  const [flavourUI, setFlavourUI] = useState({ richness: 3, boldness: 3, creative: 3, refined: 3 });

  // Filtered pizzas
  const filtered = useMemo(() => filterPizzas(PIZZAS, filter), [filter]);

  // Current season for auto-detect label
  const currentSeason = getCurrentSeason();

  // unused import guard
  void getFilterCounts;

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>

      {/* ── 3 navigation pills ── */}
      <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', background: '#FDFBF7', borderBottom: '1px solid #E0D8CF', flexShrink: 0 }}>
        {(['pizzas', 'shopping', 'party'] as const).map(pill => (
          <div key={pill} style={S.navPill(activePill === pill)} onClick={() => onPillChange(pill)}>
            {pill === 'pizzas'   ? t('pizzaParty.pill.pizzas')
              : pill === 'shopping' ? t('pizzaParty.pill.shopping')
              : t('pizzaParty.pill.partyTime')}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════
          PIZZAS pill
      ══════════════════════════════════════ */}
      {activePill === 'pizzas' && (
        <>
          {/* ── Filter panel ── */}
          <div style={{ background: '#FDFBF7', borderBottom: '1px solid #E0D8CF', flexShrink: 0, maxHeight: '290px', overflowY: 'auto' }}>

            {/* Occasion — open by default */}
            <FilterSection
              title={l === 'fr' ? 'Occasion' : 'Occasion'}
              open={open.occasion} onToggle={() => togOpen('occasion')}
              badge={filter.occasion.length > 0 ? `${filter.occasion.length}` : undefined}
            >
              <div style={S.pillRow}>
                {(['classic','spicy','kids','party','impress','quick'] as OccasionTag[]).map(o => (
                  <span key={o} style={S.pill(filter.occasion.includes(o))} onClick={() => toggleOccasion(o)}>
                    {OCCASION_LABELS[o][l]}
                  </span>
                ))}
              </div>
            </FilterSection>

            {/* Base */}
            <FilterSection
              title={l === 'fr' ? 'Base' : 'Base'}
              open={open.base} onToggle={() => togOpen('base')}
            >
              <div style={S.pillRow}>
                <span style={S.pill(filter.base === null, 'terra')} onClick={() => setBase(null)}>
                  {l === 'fr' ? 'Toutes' : 'All'}
                </span>
                {(['tomato_raw','tomato_cooked','bianca_cream','bianca_oil','bianca_ricotta','pesto','nduja','bbq'] as BaseType[]).map(b => (
                  <span key={b} style={S.pill(filter.base === b, 'terra')}
                    onClick={() => setBase(filter.base === b ? null : b)}>
                    {BASE_LABELS[b][l]}
                  </span>
                ))}
              </div>
            </FilterSection>

            {/* Region */}
            <FilterSection
              title={l === 'fr' ? 'Région' : 'Region'}
              open={open.region} onToggle={() => togOpen('region')}
              badge={regionParent !== 'all' ? (regionParent === 'italy' ? '🇮🇹' : regionParent === 'france' ? '🇫🇷' : '🌍') : undefined}
            >
              <div style={S.pillRow}>
                {(['all','italy','france','fusion'] as const).map(r => (
                  <span key={r} style={S.pill(regionParent === r, 'terra')}
                    onClick={() => { setRegionParent(r); setRegion(null); }}>
                    {r === 'all'    ? (l === 'fr' ? 'Toutes' : 'All')
                      : r === 'italy'  ? '🇮🇹 ' + (l === 'fr' ? 'Italie' : 'Italy')
                      : r === 'france' ? '🇫🇷 France'
                      : '🌍 Fusion'}
                  </span>
                ))}
              </div>
              {regionParent !== 'all' && (
                <div style={S.subSec}>
                  <span style={S.subLbl}>
                    {regionParent === 'italy'
                      ? (l === 'fr' ? 'Régions italiennes' : 'Italian regions')
                      : (l === 'fr' ? 'Régions françaises' : 'French regions')}
                  </span>
                  <div style={S.pillRow}>
                    {(regionParent === 'italy' ? ITALY_REGIONS : FRANCE_REGIONS).map(r => (
                      <span key={r} style={S.pill(filter.region === r)}
                        onClick={() => setRegion(filter.region === r ? null : r)}>
                        {REGION_NAMES[r][l]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </FilterSection>

            {/* Season */}
            <FilterSection
              title={l === 'fr' ? 'Saison' : 'Season'}
              open={open.season} onToggle={() => togOpen('season')}
              badge={filter.season !== 'all' ? SEASON_LABELS[filter.season][l] : undefined}
            >
              <div style={S.subSec}>
                <span style={S.subLbl}>
                  {l === 'fr' ? 'Par défaut : toute l\'année · toucher pour filtrer' : 'Default: all year · tap to filter'}
                </span>
                <div style={S.pillRow}>
                  {(['all','spring','summer','autumn','winter'] as Season[]).map(s => (
                    <span key={s}
                      style={S.pill(filter.season === s, filter.season === s && s === 'all' ? 'terra' : 'sage')}
                      onClick={() => setSeason(s)}>
                      {SEASON_LABELS[s][l]}{s === currentSeason && s !== 'all'
                        ? (l === 'fr' ? ' — maintenant' : ' — now') : ''}
                    </span>
                  ))}
                </div>
              </div>
            </FilterSection>

            {/* Diet & Allergies */}
            <FilterSection
              title={l === 'fr' ? 'Régime & Allergies' : 'Diet & Allergies'}
              open={open.diet} onToggle={() => togOpen('diet')}
              badge={filter.dietary.length > 0 ? `${filter.dietary.length}` : undefined}
            >
              <div style={S.subSec}>
                <span style={S.subLbl}>{l === 'fr' ? 'Préférence alimentaire' : 'Dietary preference'}</span>
                <div style={S.pillRow}>
                  {([
                    ['veg',        l === 'fr' ? 'Végétarien' : 'Vegetarian'],
                    ['vegan',      'Vegan'],
                    ['pescatarian', l === 'fr' ? 'Pescatarien' : 'Pescatarian'],
                  ] as [DietaryTag, string][]).map(([d, label]) => (
                    <span key={d} style={S.pill(filter.dietary.includes(d))} onClick={() => toggleDietary(d)}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={S.subSec}>
                <span style={S.subLbl}>{l === 'fr' ? 'Allergènes — exclure' : 'Allergens — exclude'}</span>
                <div style={S.pillRow}>
                  {([
                    ['dairy_free',   l === 'fr' ? 'Sans lactose'  : 'No dairy'],
                    ['no_nuts',      l === 'fr' ? 'Sans noix'     : 'No nuts'],
                    ['no_fish',      l === 'fr' ? 'Sans poisson'  : 'No fish'],
                    ['no_pork',      l === 'fr' ? 'Sans porc'     : 'No pork'],
                    ['gluten_aware', l === 'fr' ? 'Sans gluten'   : 'No gluten'],
                  ] as [DietaryTag, string][]).map(([d, label]) => (
                    <span key={d} style={S.pill(filter.dietary.includes(d))} onClick={() => toggleDietary(d)}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={S.subSec}>
                <span style={S.subLbl}>{l === 'fr' ? 'Restrictions religieuses' : 'Religious'}</span>
                <div style={S.pillRow}>
                  {(['halal','kosher'] as DietaryTag[]).map(d => (
                    <span key={d} style={S.pill(filter.dietary.includes(d))} onClick={() => toggleDietary(d)}>
                      {d === 'halal' ? 'Halal' : 'Kosher'}
                    </span>
                  ))}
                </div>
              </div>
            </FilterSection>

            {/* Wine pairing */}
            <FilterSection
              title={l === 'fr' ? 'Accord vins' : 'Wine pairing'}
              open={open.wine} onToggle={() => togOpen('wine')}
              badge={filter.wine.length > 0 ? `${filter.wine.length}` : undefined}
            >
              <div style={S.subSec}>
                <span style={S.subLbl}>
                  {l === 'fr' ? 'Toucher une catégorie · exemples à droite' : 'Tap a category · examples on the right'}
                </span>
                {(['lr','fr','cw','rw','sp','ro'] as WineCategory[]).map(w => (
                  <div key={w} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                    <span style={S.winePill(filter.wine.includes(w))} onClick={() => toggleWine(w)}>
                      {WINE_CATEGORY_LABELS[w][l]}
                    </span>
                    <span style={{ fontSize: '10px', color: '#8A7F78' }}>
                      {WINE_EXAMPLES[w][l]}
                    </span>
                  </div>
                ))}
              </div>
            </FilterSection>

            {/* Budget & Complexity */}
            <FilterSection
              title={l === 'fr' ? 'Budget & Complexité' : 'Budget & Complexity'}
              open={open.budget} onToggle={() => togOpen('budget')}
            >
              <div style={S.subSec}>
                <span style={S.subLbl}>{l === 'fr' ? 'Budget par pizza' : 'Budget per pizza'}</span>
                <div style={S.pillRow}>
                  {([1,2,3] as BudgetTier[]).map(b => (
                    <span key={b} style={S.pill(filter.budget === b)}
                      onClick={() => setBudget(filter.budget === b ? null : b)}>
                      {BUDGET_LABELS[b][l]}
                    </span>
                  ))}
                </div>
              </div>
              <div style={S.subSec}>
                <span style={S.subLbl}>{l === 'fr' ? 'Complexité' : 'Prep complexity'}</span>
                <div style={S.pillRow}>
                  {([1,2,3] as ComplexityTier[]).map(c => (
                    <span key={c} style={S.pill(filter.complexity === c)}
                      onClick={() => setComplexity(filter.complexity === c ? null : c)}>
                      {COMPLEXITY_LABELS[c][l]}
                    </span>
                  ))}
                </div>
              </div>
            </FilterSection>

            {/* Flavour profile */}
            <FilterSection
              title={l === 'fr' ? 'Profil de saveurs' : 'Flavour profile'}
              open={open.flavour} onToggle={() => togOpen('flavour')}
            >
              <div style={S.subSec}>
                <FlavorSlider
                  leftLabel={l === 'fr' ? 'Léger' : 'Light'}
                  rightLabel={l === 'fr' ? 'Riche' : 'Rich'}
                  value={flavourUI.richness}
                  onChange={v => updateFlavour('richness', v)}
                />
                <FlavorSlider
                  leftLabel={l === 'fr' ? 'Délicat' : 'Delicate'}
                  rightLabel={l === 'fr' ? 'Puissant' : 'Bold'}
                  value={flavourUI.boldness}
                  onChange={v => updateFlavour('boldness', v)}
                />
                <FlavorSlider
                  leftLabel={l === 'fr' ? 'Classique' : 'Classic'}
                  rightLabel={l === 'fr' ? 'Créatif' : 'Creative'}
                  value={flavourUI.creative}
                  onChange={v => updateFlavour('creative', v)}
                />
                <FlavorSlider
                  leftLabel={l === 'fr' ? 'Réconfort' : 'Comfort'}
                  rightLabel={l === 'fr' ? 'Raffiné' : 'Refined'}
                  value={flavourUI.refined}
                  onChange={v => updateFlavour('refined', v)}
                />
              </div>
            </FilterSection>

            {/* Ingredient search */}
            <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F0EBE3' }}>
              <input
                type="text"
                value={filter.ingredientSearch}
                onChange={e => setFilter((p: FilterState) => ({ ...p, ingredientSearch: e.target.value }))}
                placeholder={l === 'fr' ? '🔍 Un ingrédient dans votre frigo...' : '🔍 An ingredient in your fridge...'}
                style={{
                  width: '100%', fontSize: '12px', padding: '7px 10px',
                  borderRadius: '8px', border: '0.5px solid #E0D8CF',
                  background: '#FDFBF7', outline: 'none', color: '#1A1612',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
            </div>

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
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

              {/* Pizza cards */}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map(pizza => (
                  <PizzaCard
                    key={pizza.id}
                    pizza={pizza}
                    qty={getQty(pizza.id)}
                    locale={locale}
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

              {/* Dessert toggle */}
              <div
                onClick={() => setDessertOpen(v => !v)}
                style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#F5F0E8', borderTop: '1px solid #E0D8CF' }}
              >
                <div style={{ flex: 1, height: '1px', background: '#D8D0C7' }} />
                <div style={{ fontSize: '11px', color: '#8A7F78', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{dessertOpen ? '▼' : '▶'}</span>
                  {l === 'fr'
                    ? `Une touche sucrée ? (${DESSERT_PIZZAS.length})`
                    : `Something sweet? (${DESSERT_PIZZAS.length})`}
                </div>
                <div style={{ flex: 1, height: '1px', background: '#D8D0C7' }} />
              </div>

              {/* Dessert cards */}
              {dessertOpen && (
                <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#F5F0E8' }}>
                  {DESSERT_PIZZAS.map(pizza => (
                    <PizzaCard
                      key={pizza.id}
                      pizza={pizza}
                      qty={getQty(pizza.id)}
                      locale={locale}
                      onQtyChange={(delta, e) => { e.stopPropagation(); changeQty(pizza.id, delta); }}
                      onTap={() => setSheetId(pizza.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Summary bar ── */}
            <div style={{ background: '#1A1612', flexShrink: 0, borderTop: '1px solid #C4522A' }}>
              <div
                onClick={() => setSumOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 5px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '11px', color: '#8A7F78' }}>
                  {l === 'fr' ? 'Votre pizza party' : 'Your pizza party'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {Array.from({ length: Math.min(numItems, 10) }, (_, i) => (
                      <div key={i} style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: i < totalQty
                          ? (totalQty >= numItems ? '#6B7A5A' : '#C4522A')
                          : '#3D3530',
                      }} />
                    ))}
                    {numItems > 10 && (
                      <span style={{ fontSize: '9px', color: '#8A7F78', marginLeft: '2px' }}>+{numItems - 10}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: totalQty >= numItems ? '#6B7A5A' : 'white' }}>
                    {totalQty} / {numItems}
                  </span>
                  <span style={{ fontSize: '10px', color: '#8A7F78', transform: sumOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
                </div>
              </div>

              {sumOpen && (
                <div style={{ maxHeight: '130px', overflowY: 'auto', padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(qtys).filter(([, q]) => q > 0).length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#3D3530', fontStyle: 'italic', padding: '3px 2px' }}>
                      {l === 'fr' ? 'Ajoutez des pizzas pour construire votre liste' : 'Add pizzas to build your list'}
                    </div>
                  ) : (
                    Object.entries(qtys).filter(([, q]) => q > 0).map(([id, qty]) => {
                      const p = getPizzaById(id);
                      if (!p) return null;
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: '#2A2420', borderRadius: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#D8D0C7', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name[l] ?? p.name.en}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
                            <button
                              style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1.5px solid #4D4540', background: '#3D3530', fontSize: '15px', cursor: 'pointer', color: '#D8D0C7', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => changeQty(id, -1)}>−</button>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#C4522A', minWidth: '18px', textAlign: 'center' }}>{qty}</span>
                            <button
                              style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1.5px solid #4D4540', background: '#3D3530', fontSize: '15px', cursor: 'pointer', color: '#D8D0C7', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => changeQty(id, 1)}>+</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* ── Sheet overlay ── */}
            {sheetPizza && (
              <PizzaSheet
                pizza={sheetPizza}
                qty={getQty(sheetPizza.id)}
                locale={locale}
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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: '#8A7F78', fontSize: '13px', textAlign: 'center' }}>
          {l === 'fr' ? 'Liste de courses — bientôt disponible' : 'Shopping list — coming soon'}
        </div>
      )}

      {/* ══════════════════════════════════════
          PARTY TIME pill — placeholder for Prompt 9
      ══════════════════════════════════════ */}
      {activePill === 'party' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: '#8A7F78', fontSize: '13px', textAlign: 'center' }}>
          {l === 'fr' ? 'Au four ! — bientôt disponible' : 'Let\'s cook — coming soon'}
        </div>
      )}

    </div>
  );
}
