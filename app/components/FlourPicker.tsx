'use client';
import { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { type FlourKey, type FlourBlend, type WSource, blendWIsApproximate } from '../data';
import FlourScan from './FlourScan';
import { FLOUR_DB, type FlourEntry } from '@/lib/flourDatabase';

// ── Crowd favourite IDs ───────────────────────────
// One shortlist served every pizza style, so a New York baker was shown the
// same four Neapolitan 00s — flours far too weak for a long cold ferment at
// 65% hydration. Bread already had per-style recommendations; pizza did not.
const PIZZA_FAV_BY_STYLE: Record<string, string[]> = {
  // Strong 00, the Naples standard.
  neapolitan:   ['caputo_pizzeria', 'caputo_nuvola', 'stagioni_napoletana', 'caputo_cuoco'],
  // Sourdough pizza needs more tolerance for the longer bulk.
  sourdough:    ['caputo_cuoco', 'stagioni_napoletana', 'caputo_saccorosso', 'caputo_nuvola'],
  // New York is a bread-flour dough: high protein, long cold ferment.
  newyork:      ['ka_bread', 'caputo_americana', 'ka_sir_lancelot', 'generic_bread'],
  // Romana is rolled thin and crisp — a softer, finer 00 suits it.
  pizza_romana: ['caputo_classica', 'polselli_classica', 'generic_00', 'caputo_pizzeria'],
  // Teglia is very wet and proofs long in the tray: the strongest flours.
  roman:        ['caputo_nuvola_super', 'caputo_saccorosso', 'stagioni_manitoba', 'molino_marino_rossa'],
  // Pan and Detroit are enriched, tray-baked breads more than pizzas.
  pan:          ['generic_bread', 'ka_bread', 'gold_medal_bread', 'caputo_americana'],
};
const CROWD_FAV_IDS = PIZZA_FAV_BY_STYLE.neapolitan;

// ── Bread recommendations by style ───────────────
const BREAD_REC_BY_STYLE: Record<string, string[]> = {
  sourdough:     ['T65', 'Bread flour', 'T80'],
  pain_levain:   ['T65', 'Bread flour', 'T80'],
  pain_campagne: ['T65', 'T80', 'Rye'],
  baguette:      ['T65', 'T55'],
  pain_complet:  ['T110 / T150', 'Wholemeal'],
  pain_seigle:   ['Rye', 'T80'],
  brioche:       ['T45 / Gruau', 'Manitoba'],
  pain_mie:      ['T55', 'Bread flour'],
  pain_viennois: ['T45 / Gruau', 'Bread flour'],
  contemporary:  ['Bread flour', 'T80'],
};

// ── Blend presets ─────────────────────────────────
const BLEND_PRESETS: Record<string, { label: string; type: FlourKey; ratio: number }[]> = {
  neapolitan:    [{ label: '+ Semolina 15%', type: 'semolina', ratio: 85 }, { label: '+ Manitoba 10%', type: 'manitoba', ratio: 90 }, { label: '+ Wholemeal 10%', type: 'wholemeal', ratio: 90 }],
  newyork:       [{ label: '+ Semolina 10%', type: 'semolina', ratio: 90 }, { label: '+ Manitoba 15%', type: 'manitoba', ratio: 85 }],
  roman:         [{ label: '+ Semolina 20%', type: 'semolina', ratio: 80 }, { label: '+ Wholemeal 10%', type: 'wholemeal', ratio: 90 }],
  pan:           [{ label: '+ Semolina 20%', type: 'semolina', ratio: 80 }, { label: '+ Wholemeal 10%', type: 'wholemeal', ratio: 90 }],
  sourdough:     [{ label: '+ Wholemeal 15%', type: 'wholemeal', ratio: 85 }, { label: '+ Rye 10%', type: 'rye', ratio: 90 }],
  pain_levain:   [{ label: '+ Rye 15%', type: 'rye', ratio: 85 }, { label: '+ Wholemeal 20%', type: 'wholemeal', ratio: 80 }],
  pain_campagne: [{ label: '+ Rye 20%', type: 'rye', ratio: 80 }, { label: '+ Wholemeal 15%', type: 'wholemeal', ratio: 85 }],
  baguette:      [{ label: '+ Rye 5%', type: 'rye', ratio: 95 }, { label: '+ Wholemeal 5%', type: 'wholemeal', ratio: 95 }],
  pain_complet:  [{ label: '+ Rye 15%', type: 'rye', ratio: 85 }],
  pain_seigle:   [{ label: '+ Wholemeal 20%', type: 'wholemeal', ratio: 80 }],
  brioche:       [],
  pain_mie:      [],
  pain_viennois: [],
  contemporary:  [{ label: '+ Wholemeal 10%', type: 'wholemeal', ratio: 90 }, { label: '+ Rye 5%', type: 'rye', ratio: 95 }],
};

// ── Blend generic types ───────────────────────────
const BLEND_GENERIC_TYPES: Record<string, { label: string; w: number; protein: number }> = {
  semolina:   { label: 'Semolina rimacinata', w: 200, protein: 12.5 },
  manitoba:   { label: 'Manitoba',            w: 380, protein: 14.0 },
  wholemeal:  { label: 'Wholemeal',           w: 185, protein: 12.0 },
  rye:        { label: 'Rye',                 w: 160, protein: 10.0 },
  allpurpose: { label: 'All-purpose',         w: 190, protein: 10.5 },
  bread:      { label: 'Bread flour',         w: 270, protein: 12.8 },
};

// ── Origin groups (display-label keyed) ──────────
const ORIGIN_GROUPS: Record<string, string[]> = {
  'France':       ['fr'],
  'Italy':        ['it'],
  'UK':           ['uk'],
  'Americas':     ['us', 'ca', 'br'],
  'Europe':       ['de', 'nl', 'se', 'no', 'fi', 'pl', 'at'],
  'Asia-Pacific': ['jp', 'cn', 'kr', 'sg', 'au', 'in', 'th', 'id', 'my', 'vn', 'ph'],
};

// ── APAC country sub-filter ───────────────────────
const APAC_COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: 'sg', flag: 'SG', name: 'Singapore' },
  { code: 'jp', flag: 'JP', name: 'Japan' },
  { code: 'kr', flag: 'KR', name: 'Korea' },
  { code: 'au', flag: 'AU', name: 'Australia' },
  { code: 'in', flag: 'IN', name: 'India' },
  { code: 'id', flag: 'ID', name: 'Indonesia' },
  { code: 'my', flag: 'MY', name: 'Malaysia' },
  { code: 'th', flag: 'TH', name: 'Thailand' },
  { code: 'ph', flag: 'PH', name: 'Philippines' },
  { code: 'vn', flag: 'VN', name: 'Vietnam' },
  { code: 'cn', flag: 'CN', name: 'China' },
];

// ── Europe country sub-filter ────────────────────
const EUROPE_COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: 'de', flag: 'DE', name: 'Germany' },
  { code: 'nl', flag: 'NL', name: 'Netherlands' },
  { code: 'se', flag: 'SE', name: 'Sweden' },
  { code: 'no', flag: 'NO', name: 'Norway' },
  { code: 'fi', flag: 'FI', name: 'Finland' },
  { code: 'pl', flag: 'PL', name: 'Poland' },
  { code: 'at', flag: 'AT', name: 'Austria' },
];

// ── Americas country sub-filter ──────────────────
const AMERICAS_COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: 'us', flag: 'US', name: 'United States' },
  { code: 'ca', flag: 'CA', name: 'Canada' },
  { code: 'br', flag: 'BR', name: 'Brazil' },
  { code: 'mx', flag: 'MX', name: 'Mexico' },
  { code: 'ar', flag: 'AR', name: 'Argentina' },
];

// ── Type display labels ───────────────────────────
const TYPE_LABELS: Record<string, string> = {
  '00': '00 · Pizza flour', '0': '0', '1': 'Tipo 1', '2': 'Tipo 2',
  'T45': 'T45', 'T55': 'T55', 'T65': 'T65', 'T80': 'T80',
  'T110': 'T110', 'T150': 'T150',
  'bread': 'Bread flour', 'all_purpose': 'All-purpose',
  'high_gluten': 'High gluten · Manitoba', 'wholemeal': 'Wholemeal',
  'rye': 'Rye', 'spelt': 'Spelt', 'semolina': 'Semolina',
};

// ── Quick pick type list ──────────────────────────
const QUICK_TYPES = [
  { label: '00 · Pizza flour', w: 260, protein: 12.0 },
  { label: '0',           w: 240, protein: 11.5 },
  { label: 'T45 / Gruau', w: 310, protein: 13.0 },
  { label: 'T55',         w: 200, protein: 10.5 },
  { label: 'T65',         w: 220, protein: 11.0 },
  { label: 'T80',         w: 210, protein: 11.5 },
  { label: 'T110 / T150', w: 190, protein: 11.0 },
  { label: 'Bread flour', w: 270, protein: 12.8 },
  { label: 'All-purpose', w: 190, protein: 10.5 },
  { label: 'Manitoba',    w: 380, protein: 14.0 },
  { label: 'Wholemeal',   w: 185, protein: 12.0 },
  { label: 'Rye',         w: 160, protein: 10.0 },
];

// ── W strength helper ─────────────────────────────
function wStrength(w: number): { label: string; color: string } {
  if (w < 200) return { label: 'Weak — short ferments only', color: 'var(--smoke)' };
  if (w < 250) return { label: 'Medium — 8-24h',             color: 'var(--smoke)' };
  if (w < 300) return { label: 'Strong — 24-48h',            color: 'var(--sage)'  };
  if (w < 350) return { label: 'Very strong — 48-72h',       color: 'var(--gold)'  };
  return           { label: 'Professional — 72h+',           color: 'var(--terra)' };
}

// ── Props ─────────────────────────────────────────
interface FlourPickerProps {
  blend: FlourBlend;
  onBlendChange: (blend: FlourBlend) => void;
  bakeType?: 'pizza' | 'bread';
  mode?: 'simple' | 'custom';
  styleKey?: string | null;
}

// ── Main component ────────────────────────────────
// ── Blend ratio bar ──────────────────────────
// The base flour never carries a control of its own: it is 100 minus the rest,
// so an invalid blend cannot be expressed. Dragging a handle trades between the
// two parts it separates; the others hold still. Three flours is the ceiling —
// below about 14% a segment can no longer hold its own name, and two 5%
// segments on a narrow phone are 18px wide.
function BlendBar({ parts, onChange, locale, approx }: {
  parts: { name: string; pct: number; w: number }[];
  onChange: (pcts: number[]) => void;
  locale: string;
  // A blend is never better known than its least-known part. Printing 244
  // rather than ~244 would claim a precision that feeds straight into the
  // fermentation windows.
  approx: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const COLORS = ['#6B4423', '#9C8248', '#6B7A5A'];
  const blendW = Math.round(parts.reduce((a, p) => a + p.w * p.pct / 100, 0));

  function grab(i: number, e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const el = ref.current; if (!el) return;
    const before = parts.slice(0, i).reduce((a, p) => a + p.pct, 0);
    const pair = parts[i].pct + parts[i + 1].pct;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const pos = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
      const left = Math.max(5, Math.min(pair - 5, Math.round(pos - before)));
      const next = parts.map(p => p.pct);
      next[i] = left; next[i + 1] = pair - left;
      onChange(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Cumulative boundaries computed up front rather than mutated during the
  // render pass — the accumulator was being reassigned inside .map().
  const bounds = parts.reduce<number[]>((a, p) => [...a, (a[a.length - 1] ?? 0) + p.pct], []);
  return (
    <div>
      <div ref={ref} style={{
        position: 'relative', height: '52px', borderRadius: '12px', overflow: 'hidden',
        display: 'flex', border: '1px solid var(--border)', background: 'var(--warm)',
        touchAction: 'none', marginBottom: '10px',
      }}>
        {parts.map((p, i) => (
          <div key={i} style={{
            flex: `0 0 ${p.pct}%`, background: COLORS[i], color: '#fff', minWidth: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '1px', overflow: 'hidden',
          }}>
            {p.pct >= 14 && (
              <span style={{
                fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '94%',
              }}>{p.name}</span>
            )}
            <span style={{ fontSize: '11px', opacity: .85 }}>{p.pct}%</span>
          </div>
        ))}
        {parts.map((p, i) => {
          if (i >= parts.length - 1) return null;
          return (
            <div key={`g${i}`} onPointerDown={e => grab(i, e)} style={{
              position: 'absolute', top: 0, bottom: 0, width: '30px', marginLeft: '-15px',
              left: `${bounds[i]}%`, cursor: 'ew-resize', zIndex: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                width: '3px', height: '26px', borderRadius: '2px',
                background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(26,22,18,0.18)',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', fontSize: '12px',
        color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
      }}>
        <span>{locale === 'fr' ? 'Glissez pour ajuster' : 'Drag to adjust'}</span>
        <span style={{ color: '#9C8248' }}>{locale === 'fr' ? 'Force du mélange' : 'Blend strength'} W{approx ? ' ~' : ' '}{blendW}</span>
      </div>
    </div>
  );
}

const W_SOURCE_LABEL = (l: string): Record<WSource, string> => l === 'fr' ? {
  exact:   'valeur de ce produit',
  photo:   'lue sur l\u2019étiquette',
  typical: 'valeur courante pour ce type',
  manual:  'valeur que vous avez saisie',
} : {
  exact:   'this product\u2019s value',
  photo:   'read off the label',
  typical: 'typical for this flour type',
  manual:  'the value you entered',
};

// Only one road needs announcing. Scanning, searching and typing a W all give
// the real number for the flour in the baker's hands; picking a TYPE gives a
// representative one. Tagging all four made the distinction disappear into
// decoration — the tag is worth something only where it warns.
// One row, used by both slots. They were two copies that had already drifted —
// different padding, different selected state — and most of the visual defects
// on this page came from pairs of copies rather than from logic.
// ── One filter menu, used six times ───────────
// The base picker drew three of these by hand; the blend panel drew three
// native selects. Same filters, two different controls — which is how the two
// panels kept drifting apart on everything around them. One component, its own
// open state per instance, closing on an outside tap.
function FilterMenu({ label, value, options, onChange, format }: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  format?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  // These sit low on the page — the second-flour row is the last thing above
  // the sticky footer. Opening downward there puts the options under the fold.
  const toggle = () => {
    setOpen(o => {
      if (!o && ref.current) {
        const r = ref.current.getBoundingClientRect();
        setDropUp(window.innerHeight - r.bottom < 280 && r.top > 280);
      }
      return !o;
    });
  };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={toggle}
        style={{
          padding: '11px 14px', minHeight: '44px', borderRadius: '20px',
          border: 'none', cursor: 'pointer',
          fontSize: '12.5px', fontFamily: 'var(--font-ui)', fontWeight: 500,
          background: value ? '#2B2420' : '#F0EBE0',
          color: value ? 'white' : '#3D3530',
          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
        }}
      >
        {value ? (format ? format(value) : value) : label} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, left: 0,
          ...(dropUp
            ? { bottom: '100%', marginBottom: '4px' }
            : { top: '100%', marginTop: '4px' }),
          background: 'white', borderRadius: '16px', border: '1px solid #E8E0D5',
          boxShadow: '0 4px 16px rgba(43, 36, 32,0.10)',
          padding: '8px', minWidth: '180px', maxHeight: '260px', overflowY: 'auto',
        }}>
          {options.map(o => (
            <div
              key={o}
              onClick={() => { onChange(value === o ? null : o); setOpen(false); }}
              style={{
                padding: '11px 12px', minHeight: '44px', display: 'flex', alignItems: 'center',
                borderRadius: '16px', fontSize: '13px', cursor: 'pointer',
                color: value === o ? '#6B4423' : '#2B2420',
                fontWeight: value === o ? 500 : 400, background: 'transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F0EBE0'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >{format ? format(o) : o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlourRow({ f, selected, onClick }: {
  f: FlourEntry; selected?: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', borderBottom: '0.5px solid #E8E0D5', cursor: 'pointer',
        background: selected ? 'rgba(107, 68, 35,0.04)' : 'transparent',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#FDFBF7'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = selected ? 'rgba(107, 68, 35,0.04)' : 'transparent'; }}
    >
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: selected ? '#6B4423' : '#2B2420', fontFamily: 'var(--font-ui)' }}>{f.brand}</div>
        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>{f.name}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '13px', fontFamily: 'var(--font-ui)', color: f.wPublished ? '#2B2420' : '#8A7F78' }}>
          {f.wPublished ? `W${f.w}` : `~W${f.w}`}
        </div>
        <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>{f.protein}%</div>
      </div>
    </div>
  );
}

function WQualityTag({ kind, locale }: { kind: WSource; locale: string }) {
  const label = locale === 'fr'
    ? { photo: 'W du produit', exact: 'W du produit', typical: 'W approché', manual: 'W saisi' }[kind]
    : { photo: 'product W',    exact: 'product W',    typical: 'approximate W', manual: 'your W' }[kind];
  return (
    <span style={{
      fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '.06em',
      textTransform: 'uppercase', color: '#9C8248', whiteSpace: 'nowrap', flexShrink: 0,
      border: '1px solid rgba(156,130,72,0.3)', borderRadius: '20px', padding: '3px 8px',
    }}>{label}</span>
  );
}

export default function FlourPicker({ blend, onBlendChange, bakeType = 'pizza', mode = 'custom', styleKey }: FlourPickerProps) {
  // Accordion
  const [openSection, setOpenSection] = useState<'search' | 'blend' | null>('search');

  // Scan state

  // "I know my type or W value" collapsible in Section 2
  const [manualQW, setManualQW] = useState<number | null>(null);
  // Raw text of the W field — the controlled input previously only accepted
  // already-valid values (100-450), so typing '2' of '280' was rejected
  // char-by-char and the field appeared dead.
  const [manualQWText, setManualQWText] = useState('');

  // Search section filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterOrigin, setFilterOrigin] = useState<string | null>(null);
  const [filterManufacturer, setFilterManufacturer] = useState<string | null>(null);
  // Rendering-only: fold the three filter chips behind a funnel toggle.

  // APAC + Europe sub-filter + blend state
  const [apacCountry, setApacCountry] = useState<string | null>(null);
  const [europeCountry, setEuropeCountry] = useState<string | null>(null);
  const [americasCountry, setAmericasCountry] = useState<string | null>(null);
  const [blendApacCountry, setBlendApacCountry] = useState<string | null>(null);
  const [blendEuropeCountry, setBlendEuropeCountry] = useState<string | null>(null);
  const [blendAmericasCountry, setBlendAmericasCountry] = useState<string | null>(null);
  const [blendSearchQuery, setBlendSearchQuery] = useState('');
  // Open while no flour is chosen; the hero card's Change reopens it.
  // Derived, not captured. The initial value used to be read once at mount —
  // but this component mounts before a saved session has restored, so
  // brandProduct was still undefined and the picker latched open forever. That
  // is why "Change" appeared to do nothing: it set true on something already
  // true. null means "follow the choice"; true/false is an explicit override.
  // Which road the baker opened. Only one at a time: the page holds the card,
  // the shortlist and one row of entries, and whatever is opened appears under
  // it. Everything else stays shut.
  const [road, setRoad] = useState<'scan' | 'search' | 'type' | 'w' | null>(null);
  const [pickerOverride, setPickerOverride] = useState<boolean | null>(null);
  const pickerOpen = pickerOverride ?? !blend.brandProduct;
  const setPickerOpen = (v: boolean) => setPickerOverride(v ? true : null);
  const [blendFilterType, setBlendFilterType] = useState<string | null>(null);
  const [blendFilterOrigin, setBlendFilterOrigin] = useState<string | null>(null);
  const [blendFilterBrand, setBlendFilterBrand] = useState<string | null>(null);
  const [blendSelectedF2, setBlendSelectedF2] = useState<FlourEntry | null>(() => {
    if (!blend.flour2 || !blend.customFlour2Name) return null;
    // Reconstruct a minimal FlourEntry from saved blend data so the selected state is restored
    return {
      id: 'restored',
      brand: blend.customFlour2Name.split(' ')[0] ?? '',
      name: blend.customFlour2Name,
      type: 'bread',
      country: 'it',
      w: blend.wOverride ?? 260,
      wPublished: false,
      protein: 12,
      hydration: [60, 75] as [number, number],
      bestFor: [], crowdFavourite: [], note: '', bagImage: '', logo: null,
    };
  });
  const [blendRatio, setBlendRatio] = useState(() => blend.ratio1 < 100 ? blend.ratio1 : 85);
  // Third flour: which slot the blend search assigns to, the picked entry,
  // and flour2's share (flour3 takes the remainder).
  const [blendSlot, setBlendSlot] = useState<2 | 3>(2);
  const [blendSelectedF3, setBlendSelectedF3] = useState<FlourEntry | null>(() => {
    if (!blend.flour3 || !blend.customFlour3Name) return null;
    return {
      brand: blend.customFlour3Name.split(' ')[0] ?? '',
      name: blend.customFlour3Name,
      w: blend.w3 ?? 220,
    } as FlourEntry;
  });
  const [blendRatio2, setBlendRatio2] = useState(() => blend.ratio2 ?? 10);
  const [blendShowFullSearch, setBlendShowFullSearch] = useState(false);
  // Same mechanic as the base flour: one road open at a time, chosen from a row
  // under one sentence. The blend used to stack the search, its filters, a type
  // list and a W field all at once — which is exactly what the base stopped
  // doing, and why the two still looked like different products.
  const [blendRoad, setBlendRoad] = useState<'search' | 'type' | 'w' | null>(null);

  const locale = useLocale();
  const isFr = locale === 'fr';

  const dropdownRef = useRef<HTMLDivElement>(null);
  const blendRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openSection === 'blend' && blendRef.current) {
      const rect = blendRef.current.getBoundingClientRect();
      // Visible height, not innerHeight — with the search keyboard open the
      // visual viewport is much shorter and the dropdown stayed off-screen.
      const _visibleH = window.visualViewport?.height ?? window.innerHeight;
      if (rect.bottom > _visibleH) {
        setTimeout(() => blendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
      }
    }
  }, [openSection]);


  // Assign a picked blend flour to whichever slot the search was opened for.
  // Stores the flour's true W per slot (w2/w3) — computeBlendProfile does the
  // single authoritative blend, fixing the old double-blend of wOverride.
  // `source` says how the W of this addition is known — the caller knows which
  // road it came from, and the blend needs it to decide whether its own W can
  // be printed without a tilde.
  // FLOUR_DB.type is a MILLING designation — '00', 'T65', 'high_gluten' — and
  // FlourKey is a behaviour tile — 'pizza00', 'strong00', 'manitoba'. Twelve of
  // the database's sixteen type values are not FlourKeys at all, so casting one
  // to the other put a key like '00' into blend.flour2 and every later
  // FLOUR_DATA lookup came back undefined. That is the crash on selecting a
  // second flour from the search list.
  //
  // The single-flour path never hit it because selectDBEntry derives its tile
  // from W. Same rule here, with a direct pass for the four designations that
  // happen to be behaviour tiles too.
  function dbTypeToFlourKey(f: FlourEntry): FlourKey {
    const direct: Record<string, FlourKey> = {
      bread: 'bread', rye: 'rye', semolina: 'semolina', wholemeal: 'wholemeal',
      all_purpose: 'allpurpose',
    };
    const hit = direct[f.type];
    if (hit) return hit;
    return f.w >= 270 ? 'strong00' : 'pizza00';
  }

  function assignBlendFlour(entry: FlourEntry, key: FlourKey, label: string, r1ForSlot2 = 85, source?: WSource) {
    // Same rule for additions: default to what the database says it knows.
    source = source ?? (entry.wPublished ? 'exact' : 'typical');
    if (blendSlot === 3) {
      setBlendSelectedF3(entry);
      const r1 = Math.min(blendRatio, 80);
      const r2 = Math.min(blendRatio2, 100 - r1 - 5);
      setBlendRatio(r1); setBlendRatio2(r2);
      onBlendChange({ ...blend, flour3: key, ratio1: r1, ratio2: r2, w3: entry.w, w3Source: source, customFlour3Name: label });
    } else {
      setBlendSelectedF2(entry);
      onBlendChange({ ...blend, flour2: key, ratio1: r1ForSlot2, w2: entry.w, w2Source: source, customFlour2Name: label });
    }
    setBlendShowFullSearch(false); setBlendSearchQuery('');
  }

  function selectDBEntry(f: FlourEntry) {
    const autoTile: FlourKey = f.w >= 270 ? 'strong00' : 'pizza00';
    onBlendChange({
      flour1: autoTile,
      flour2: blend.flour2,
      ratio1: blend.ratio1,
      wOverride: f.w,
      w1: f.w,
      // 254 of the 291 entries carry an estimated W — the database flags it
      // with wPublished, and the list already prints ~W for those. Stamping
      // 'exact' regardless would have let an estimate print without its tilde
      // the moment it reached the card.
      w1Source: f.wPublished ? 'exact' : 'typical',
      brandKey: undefined,
      brandProduct: `${f.brand} ${f.name}`,
    });
    setPickerOpen(false);
  }

  function applyQuickType(label: string, w: number) {
    const autoTile: FlourKey = w >= 270 ? 'strong00' : 'pizza00';
    onBlendChange({
      flour1: autoTile,
      flour2: blend.flour2,
      ratio1: blend.ratio1,
      wOverride: w,
      w1: w,
      w1Source: 'typical',
      brandKey: undefined,
      brandProduct: label,
    });
    setPickerOpen(false);
  }

  // ── Dynamic filter options ──
  const baseFiltered = (excl: ('type' | 'origin' | 'manufacturer')[]) =>
    FLOUR_DB
      .filter(f => !searchQuery || `${f.brand} ${f.name}`.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(f => excl.includes('type') || !filterType ? true : f.type === filterType)
      .filter(f => {
        if (excl.includes('origin') || !filterOrigin) return true;
        const groupCountries = ORIGIN_GROUPS[filterOrigin] ?? [];
        if (filterOrigin === 'Asia-Pacific' && apacCountry) return f.country === apacCountry;
        if (filterOrigin === 'Europe' && europeCountry) return f.country === europeCountry;
        if (filterOrigin === 'Americas' && americasCountry) return f.country === americasCountry;
        return groupCountries.includes(f.country);
      })
      .filter(f => excl.includes('manufacturer') || !filterManufacturer ? true : f.brand === filterManufacturer);

  const typeOptions = [...new Set(baseFiltered(['type']).map(f => f.type))].sort();
  const originOptions = Object.keys(ORIGIN_GROUPS).filter(g =>
    baseFiltered(['origin']).some(f => ORIGIN_GROUPS[g].includes(f.country))
  );
  const mfgOptions = [...new Set(baseFiltered(['manufacturer']).map(f => f.brand))].sort();

  const results = baseFiltered([])
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  // ── Blend brand options (filtered dynamically) ──
  const blendFilteredForBrands = FLOUR_DB
    .filter(f => !blendSearchQuery || `${f.brand} ${f.name}`.toLowerCase().includes(blendSearchQuery.toLowerCase()))
    .filter(f => !blendFilterType || f.type === blendFilterType)
    .filter(f => {
      if (!blendFilterOrigin) return true;
      const groupCountries = ORIGIN_GROUPS[blendFilterOrigin] ?? [];
      if (blendFilterOrigin === 'Asia-Pacific' && blendApacCountry) return f.country === blendApacCountry;
      if (blendFilterOrigin === 'Europe' && blendEuropeCountry) return f.country === blendEuropeCountry;
      if (blendFilterOrigin === 'Americas' && blendAmericasCountry) return f.country === blendAmericasCountry;
      return groupCountries.includes(f.country);
    });
  const blendBrandOptions = [...new Set(blendFilteredForBrands.map(f => f.brand))].sort();

  // ── Section header factory ──
  const sectionHeader = (label: string, key: 'search' | 'blend') => (
    <div
      onClick={() => setOpenSection(openSection === key ? null : key)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', cursor: 'pointer',
        borderBottom: openSection === key ? 'none' : '1px solid #E8E0D5',
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500,
        color: '#2B2420',
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: '12px', color: '#8A7F78' }}>{openSection === key ? '▾' : '▸'}</span>
    </div>
  );

  return (
    <div>

      {/* ── Selected flour — hero card (rendering only; same state) ── */}
      {blend.brandProduct && (
        <div style={{ background:'#FDFBF7', border:'1.5px solid var(--bread)',
          borderRadius: '16px', padding: '12px 16px', marginBottom:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily:'var(--font-ui)', fontSize: '11px', letterSpacing:'.1em', color:'var(--bread)', marginBottom:'3px' }}>
                {locale === 'fr' ? 'VOTRE FARINE' : 'YOUR FLOUR'}
              </div>
              <div style={{ fontFamily:'var(--font-ui)', fontSize: '15px', fontWeight:700, color:'#2B2420', lineHeight:1.25 }}>
                {blend.brandProduct}
              </div>
            </div>
            {/* Change reopens the picker; it no longer clears the choice, so
                the baker can back out of changing their mind. */}
            <button onClick={() => setPickerOpen(true)}
              style={{ background:'none', border:'none', cursor:'pointer', flexShrink:0,
                color:'#8A7F78', fontSize: '12px', fontFamily:'var(--font-ui)',
                textDecoration:'underline', textUnderlineOffset:'2px', padding:'2px 0' }}>
              {locale === 'fr' ? 'Changer' : 'Change'}
            </button>
          </div>
          {/* The W and how well it is known. "W ~220, typical for this type"
              is not the same promise as "W 260, read off the label", and the
              app used to print both the same way. */}
          <div style={{ display:'flex', gap: '8px', marginTop:'8px', flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontFamily:'var(--font-ui)', fontSize: '11px', padding: '3px 8px',
              borderRadius:'20px', background:'rgba(139,105,20,0.1)', color:'var(--bread)' }}>
              W{blend.w1Source === 'typical' ? '~' : ''}{blend.wOverride ?? '—'}
            </span>
            {blend.w1Source && (
              <span style={{ fontFamily:'var(--font-ui)', fontSize: '11px', color:'#8A7F78' }}>
                {W_SOURCE_LABEL(locale)[blend.w1Source]}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Everything below is the act of CHOOSING a flour. Once one is chosen
          the hero card above says which, so the search, the quick picks, the
          type list and the W field all fold away — the page then holds the
          choice and the invitation to blend, nothing else. */}
      {pickerOpen && (<>
      {/* The shortlist is the shortcut. Below it, one sentence and one row.
          The W is not a fourth road — it is the destination, so it lives in the
          sentence rather than under the buttons: whoever knows it has nothing
          left to identify, and the "ou" says so grammatically. */}
      <p style={{
        fontFamily: 'var(--font-ui)', fontSize: '12.5px', color: 'var(--smoke)',
        lineHeight: 1.45, margin: '18px 0 0',
      }}>
        {locale === 'fr'
          ? 'Choisissez votre farine pour en déterminer la force — ou '
          : 'Choose your flour to work out its strength — or '}
        <button
          onClick={() => setRoad(r => r === 'w' ? null : 'w')}
          style={{
            background: 'none', border: 'none', padding: 0, font: 'inherit',
            color: '#6B4423', textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer',
          }}
        >{locale === 'fr' ? 'précisez-la ici' : 'enter it here'}</button>
        {locale === 'fr' ? '.' : '.'}
      </p>

      {/* The field opens under the sentence that offered it, not at the far
          end of the panels — tapping a link and having the answer appear
          somewhere else is how a control loses its cause. */}
      {road === 'w' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 12px', borderRadius: '16px', background: '#F0EBE0' }}>
                    <span style={{ fontSize: '13px', color: '#3D3530', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>{locale === 'fr' ? 'Force (W)' : 'Strength (W)'}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={locale === 'fr' ? 'ex. 280' : 'e.g. 280'}
                      min={100} max={450}
                      value={manualQWText}
                      onChange={e => {
                        const raw = e.target.value;
                        setManualQWText(raw);
                        const v = parseInt(raw);
                        if (!isNaN(v) && v >= 100 && v <= 450) {
                          setManualQW(v);
                          const autoTile: FlourKey = v >= 270 ? 'strong00' : 'pizza00';
                          onBlendChange({
                            flour1: autoTile, flour2: blend.flour2, ratio1: blend.ratio1,
                            w1Source: 'manual',
                            wOverride: v, w1: v, brandKey: undefined, brandProduct: `Custom W${v}`,
                          });
                        } else if (raw === '') {
                          setManualQW(null);
                        }
                      }}
                      style={{
                        width: '80px', padding: '0 12px',
                        height: '44px',
                        border: '1.5px solid #E8E0D5', borderRadius: '8px',
                        fontFamily: 'var(--font-ui)', fontSize: '15px',
                        fontWeight: 700, color: '#2B2420',
                        background: 'white', outline: 'none', textAlign: 'center',
                      }}
                    />
                    {manualQW !== null && (() => {
                      const s = wStrength(manualQW);
                      return <span style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', color: s.color }}>{s.label}</span>;
                    })()}
                  </div>
                </div>
              )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        {([
          { k: 'scan' as const,   n: locale === 'fr' ? 'Scanner'  : 'Scan',
            c: locale === 'fr' ? 'le sac' : 'the bag' },
          { k: 'search' as const, n: locale === 'fr' ? 'Chercher' : 'Search',
            c: `${FLOUR_DB.length} ${locale === 'fr' ? 'farines' : 'flours'}` },
          { k: 'type' as const,   n: locale === 'fr' ? 'Type'     : 'Type',
            c: locale === 'fr' ? 'valeur courante' : 'typical value' },
        ]).map(r => (
          <button
            key={r.k}
            onClick={() => setRoad(cur => cur === r.k ? null : r.k)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              border: `1px solid ${road === r.k ? '#6B4423' : 'var(--border)'}`,
              background: road === r.k ? '#F7F1E9' : 'var(--warm)',
              borderRadius: '12px', padding: '11px 6px', minHeight: '44px',
              fontFamily: 'var(--font-ui)', fontSize: '12.5px', fontWeight: 600,
              color: 'var(--ash)', cursor: 'pointer',
            }}
          >
            <span>{r.n}</span>
            <span style={{ fontSize: '10.5px', fontWeight: 400, color: 'var(--smoke)', textAlign: 'center' }}>{r.c}</span>
          </button>
        ))}
      </div>

      {road === 'scan' && (
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <FlourScan
            onResult={result => {
              const autoTile: FlourKey = result.w >= 270 ? 'strong00' : 'pizza00';
              onBlendChange({ ...blend, flour1: autoTile, wOverride: result.w, w1: result.w, w1Source: 'photo', brandProduct: result.name, brandKey: undefined });
              setRoad(null);
            }}
            onCancel={() => setRoad(null)}
          />
        </div>
      )}



      {/* ── Search + list (always open) ─────────────── */}
      <div style={{ marginBottom: '4px' }}>

        {/* search content starts — was inside openSection === 'search' */}
        <div style={{ paddingBottom: '16px' }}>

            {/* Search bar + filter chips, revealed by the Search entry */}
            {road === 'search' && (<>
            <div style={{ height: '16px' }} />
            {/* Same shape as the blend panel's search: the field owns a full
                row, the filters wrap under it. They were two different layouts
                for one control, and the shared row squeezed both. */}
            <div ref={dropdownRef} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder={locale === 'fr' ? 'Rechercher une farine…' : 'Search flour...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flexBasis: '100%', padding: '12px', minHeight: '44px',
                    border: '1px solid #E8E0D5', borderRadius: '8px',
                    fontSize: '13px', fontFamily: 'var(--font-ui)',
                    background: 'white', outline: 'none',
                    color: '#2B2420',
                  }}
                />

                {/* The three dimensions show themselves. Hiding them behind a
                    funnel cost a tap and, worse, hid WHAT could be filtered —
                    a baker cannot want a filter they cannot see. The search
                    road is already opened deliberately; nothing here needs a
                    second door. */}
                {(<>
                <FilterMenu label={locale === 'fr' ? 'Type' : 'Type'} value={filterType} options={typeOptions}
                  onChange={setFilterType} format={v => TYPE_LABELS[v] ?? v} />

                <FilterMenu label={locale === 'fr' ? 'Origine' : 'Origin'} value={filterOrigin} options={originOptions}
                  onChange={v => { setFilterOrigin(v); setApacCountry(null); setEuropeCountry(null); setAmericasCountry(null); }} />

                <FilterMenu label={locale === 'fr' ? 'Marque' : 'Brand'} value={filterManufacturer}
                  options={mfgOptions} onChange={setFilterManufacturer} />
                </>)}

              </div>
            </div>

            {/* APAC country sub-filter pills */}
            {filterOrigin === 'Asia-Pacific' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px' }}>
                {APAC_COUNTRIES.map(({ code, flag, name }) => (
                  <button
                    key={code}
                    onClick={() => setApacCountry(apacCountry === code ? null : code)}
                    title={name}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '20px',
                      border: apacCountry === code ? '1.5px solid #6B4423' : '1px solid #E8E0D5',
                      background: apacCountry === code ? '#FDF0EB' : 'transparent',
                      fontSize: '12px', fontWeight: 600, letterSpacing: '.04em',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    {flag}
                  </button>
                ))}
              </div>
            )}

            {/* Europe country sub-filter pills */}
            {filterOrigin === 'Europe' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px' }}>
                {EUROPE_COUNTRIES.map(({ code, flag, name }) => (
                  <button
                    key={code}
                    onClick={() => setEuropeCountry(europeCountry === code ? null : code)}
                    title={name}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '20px',
                      border: europeCountry === code ? '1.5px solid #6B4423' : '1px solid #E8E0D5',
                      background: europeCountry === code ? '#FDF0EB' : 'transparent',
                      fontSize: '12px', fontWeight: 600, letterSpacing: '.04em',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    {flag}
                  </button>
                ))}
              </div>
            )}

            {/* Americas country sub-filter pills */}
            {filterOrigin === 'Americas' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px' }}>
                {AMERICAS_COUNTRIES.map(({ code, flag, name }) => (
                  <button
                    key={code}
                    onClick={() => setAmericasCountry(americasCountry === code ? null : code)}
                    title={name}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '20px',
                      border: americasCountry === code ? '1.5px solid #6B4423' : '1px solid #E8E0D5',
                      background: americasCountry === code ? '#FDF0EB' : 'transparent',
                      fontSize: '12px', fontWeight: 600, letterSpacing: '.04em',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    {flag}
                  </button>
                ))}
              </div>
            )}

            {/* Active filter tags */}
            {(filterType || filterOrigin || filterManufacturer) && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                {filterType && (
                  <span style={{ fontSize: '11px', background: '#F0EBE0', borderRadius: '8px', padding: '3px 8px', display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#3D3530' }}>
                    Type: {TYPE_LABELS[filterType] ?? filterType}
                    <span style={{ cursor: 'pointer', color: '#8A7F78' }} onClick={() => setFilterType(null)}>×</span>
                  </span>
                )}
                {filterOrigin && (
                  <span style={{ fontSize: '11px', background: '#F0EBE0', borderRadius: '8px', padding: '3px 8px', display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#3D3530' }}>
                    Origin: {filterOrigin}
                    <span style={{ cursor: 'pointer', color: '#8A7F78' }} onClick={() => { setFilterOrigin(null); setApacCountry(null); setEuropeCountry(null); setAmericasCountry(null); }}>×</span>
                  </span>
                )}
                {filterManufacturer && (
                  <span style={{ fontSize: '11px', background: '#F0EBE0', borderRadius: '8px', padding: '3px 8px', display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#3D3530' }}>
                    Brand: {filterManufacturer}
                    <span style={{ cursor: 'pointer', color: '#8A7F78' }} onClick={() => setFilterManufacturer(null)}>×</span>
                  </span>
                )}
                {[filterType, filterOrigin, filterManufacturer].filter(Boolean).length > 1 && (
                  <span
                    style={{ fontSize: '11px', color: '#6B4423', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                    onClick={() => { setFilterType(null); setFilterOrigin(null); setFilterManufacturer(null); setApacCountry(null); setEuropeCountry(null); setAmericasCountry(null); }}
                  >
                    {locale === 'fr' ? 'Tout effacer' : 'Clear all'}
                  </span>
                )}
              </div>
            )}
            </>)}

            {/* Results sit under the field that produced them. */}
            {(() => {
              const noFiltersActive = !searchQuery && !filterType && !filterOrigin && !filterManufacturer;
              if (noFiltersActive) return null;

              // Bread path: show quick-type recommendations for the style
              if (bakeType === 'bread' && noFiltersActive) {
                const recLabels = BREAD_REC_BY_STYLE[styleKey ?? ''] ?? ['Bread flour', 'T65', 'All-purpose'];
                const breadRecs = recLabels.map(label => QUICK_TYPES.find(q => q.label === label)).filter(Boolean) as { label: string; w: number; protein: number }[];
                const styleName = styleKey ? styleKey.replace(/_/g, ' ') : '';
                // "For pain levain" read as a filter on the 285-flour list.
                // It is a shortlist, and saying so is the difference between
                // "these are your options" and "here are three good ones".
                // With a tool open, the list stops being the shortcut and
                // becomes the way back out of it. One word, but it turns a list
                // that is merely still there into an explicit exit.
                const sectionLabel = !styleKey
                  ? (isFr ? 'Choix rapides pour le pain' : 'Quick picks for bread')
                  : (isFr ? `Choix rapides pour le ${styleName}` : `Quick picks for ${styleName}`);
                return (
                  <div>
                    <div style={{ fontSize: '11px', color: '#8A7F78', marginBottom: '8px', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {sectionLabel}
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {breadRecs.map(t => {
                        const isSelected = blend.brandProduct === t.label;
                        return (
                          <button
                            key={t.label}
                            onClick={() => applyQuickType(t.label, t.w)}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                              padding: '8px 16px', borderRadius: '12px', cursor: 'pointer',
                              border: isSelected ? '1.5px solid var(--bread)' : '1.5px solid #E8E0D5',
                              background: isSelected ? 'rgba(139,105,20,0.08)' : '#FDFBF7',
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--bread)' : '#2B2420', fontFamily: 'var(--font-ui)' }}>
                              {t.label}
                            </span>
                            <span style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>
                              W~{t.w} · ~{t.protein}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Pizza / filtered path: crowd favs or search results
              const displayList: FlourEntry[] = noFiltersActive
                ? (PIZZA_FAV_BY_STYLE[styleKey ?? ''] ?? CROWD_FAV_IDS)
                    .map(id => FLOUR_DB.find(f => f.id === id)).filter(Boolean) as FlourEntry[]
                : results;

              if (displayList.length === 0) {
                return (
                  <div style={{ fontSize: '13px', color: '#8A7F78', textAlign: 'center', padding: '16px 0' }}>
                    {locale === 'fr' ? 'Aucune farine ne correspond à vos filtres.' : 'No flours match your filters.'}
                  </div>
                );
              }
              return (
                <div>
                  {noFiltersActive ? (
                    <div style={{ fontSize: '11px', color: '#8A7F78', marginBottom: '8px', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {isFr ? 'Coups de cœur' : 'Crowd favourites'}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#8A7F78', marginBottom: '8px', fontFamily: 'var(--font-ui)' }}>
                      {isFr
                        ? `${displayList.length} farine${displayList.length !== 1 ? 's' : ''} trouvée${displayList.length !== 1 ? 's' : ''}`
                        : `${displayList.length} flour${displayList.length !== 1 ? 's' : ''} found`}
                    </div>
                  )}
                  <div style={{ maxHeight: '320px', overflowY: 'auto', marginTop: '4px' }}>
                  {displayList.map(f => {
                    const isSelected = blend.brandProduct === `${f.brand} ${f.name}`;
                    return (
                      <div
                        key={f.id}
                        onClick={() => selectDBEntry(f)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 0', borderBottom: '0.5px solid #E8E0D5',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(107, 68, 35,0.04)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#FDFBF7'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(107, 68, 35,0.04)' : 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? '#6B4423' : '#2B2420', fontFamily: 'var(--font-ui)' }}>
                            {f.brand}
                          </div>
                          <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>{f.name}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13px', fontFamily: 'var(--font-ui)', color: f.wPublished ? '#2B2420' : '#8A7F78' }}>
                            {f.wPublished ? `W${f.w}` : `~W${f.w}`}
                          </div>
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>
                            {f.protein}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              );
            })()}

            {/* Type and W are two roads now, opened from the row and the
                sentence respectively — no shared accordion, no header asking
                "don't see your flour?" once the baker has already said so by
                tapping. The type list opens straight to its choices. */}
            {(road === 'type' || road === 'w') && (
            <div style={{ marginTop: '16px' }}>
              {road === 'type' && (
                <div style={{ paddingTop: '0' }}>
                  {/* No header repeating the button that opened this panel —
                      its accordion made the baker tap twice for a list they had
                      just asked for. The one thing worth saying stays: these
                      values are approximate. */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                    <WQualityTag kind="typical" locale={locale} />
                  </div>
                  {true && (
                    <div style={{ background: '#F0EBE0', borderRadius: '0 0 16px 16px', padding: '4px 0 8px', marginBottom: '8px' }}>
                      {QUICK_TYPES.map(t => {
                        const isSelected = blend.brandProduct === t.label;
                        return (
                          <div
                            key={t.label}
                            onClick={() => applyQuickType(t.label, t.w)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px 12px', cursor: 'pointer',
                              background: isSelected ? 'rgba(107, 68, 35,0.08)' : 'transparent',
                              borderRadius: '16px', margin: '0 4px',
                            }}
                          >
                            <span style={{ fontSize: '13px', color: isSelected ? '#6B4423' : '#2B2420', fontWeight: isSelected ? 600 : 400 }}>
                              {t.label}
                            </span>
                            <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>
                              {t.w > 0 ? `W~${t.w}` : '—'} · ~{t.protein}% protein
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

              {/* The W is its own road, reached from the sentence above. Just a
                  field: the baker already knows the number, they need somewhere
                  to put it, not a menu. */}

            </div>
            )}

            {/* The shortlist sits below the tools and never moves: the pills
                are tools, this is content, and content should not be pushed
                around by whatever tool happens to be open. Its heading says
                what it is at that moment — the shortcut when nothing is open,
                the way back when something is. */}
            {(() => {
              const noFiltersActive = !searchQuery && !filterType && !filterOrigin && !filterManufacturer;
              if (!noFiltersActive) return null;
              // Scan and Type are different modes, not different views of the
              // same list: pointing a camera or picking "T65" has nothing to do
              // with a shortlist of products. Under Search it is the useful
              // empty state, so it stays there until a query replaces it.
              if (road === 'scan' || road === 'type' || road === 'w') return null;

              // Bread path: show quick-type recommendations for the style
              if (bakeType === 'bread' && noFiltersActive) {
                const recLabels = BREAD_REC_BY_STYLE[styleKey ?? ''] ?? ['Bread flour', 'T65', 'All-purpose'];
                const breadRecs = recLabels.map(label => QUICK_TYPES.find(q => q.label === label)).filter(Boolean) as { label: string; w: number; protein: number }[];
                const styleName = styleKey ? styleKey.replace(/_/g, ' ') : '';
                // "For pain levain" read as a filter on the 285-flour list.
                // It is a shortlist, and saying so is the difference between
                // "these are your options" and "here are three good ones".
                // Only Search can still be open at this point, so the heading
                // has two states rather than three.
                const sectionLabel = road
                  ? (isFr ? 'Ou reprenez une conseillée' : 'Or take one of these')
                  : !styleKey
                    ? (isFr ? 'Choix rapides pour le pain' : 'Quick picks for bread')
                    : (isFr ? `Choix rapides pour le ${styleName}` : `Quick picks for ${styleName}`);
                return (
                  <div>
                    <div style={{ fontSize: '11px', color: '#8A7F78', margin: '32px 0 10px', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {sectionLabel}
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {breadRecs.map(t => {
                        const isSelected = blend.brandProduct === t.label;
                        return (
                          <button
                            key={t.label}
                            onClick={() => applyQuickType(t.label, t.w)}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                              padding: '8px 16px', borderRadius: '12px', cursor: 'pointer',
                              border: isSelected ? '1.5px solid var(--bread)' : '1.5px solid #E8E0D5',
                              background: isSelected ? 'rgba(139,105,20,0.08)' : '#FDFBF7',
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--bread)' : '#2B2420', fontFamily: 'var(--font-ui)' }}>
                              {t.label}
                            </span>
                            <span style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>
                              W~{t.w} · ~{t.protein}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Pizza / filtered path: crowd favs or search results
              const displayList: FlourEntry[] = noFiltersActive
                ? (PIZZA_FAV_BY_STYLE[styleKey ?? ''] ?? CROWD_FAV_IDS)
                    .map(id => FLOUR_DB.find(f => f.id === id)).filter(Boolean) as FlourEntry[]
                : results;

              if (displayList.length === 0) {
                return (
                  <div style={{ fontSize: '13px', color: '#8A7F78', textAlign: 'center', padding: '16px 0' }}>
                    {locale === 'fr' ? 'Aucune farine ne correspond à vos filtres.' : 'No flours match your filters.'}
                  </div>
                );
              }
              return (
                <div>
                  {/* The pizza path has its own heading — sectionLabel above
                      belongs to the bread branch only, which is why three
                      attempts at spacing this changed nothing on this screen. */}
                  {noFiltersActive ? (
                    <div style={{ fontSize: '11px', color: '#8A7F78', margin: '32px 0 10px', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {road
                        ? (isFr ? 'Ou reprenez un coup de cœur' : 'Or take one of these')
                        : (isFr ? 'Coups de cœur' : 'Crowd favourites')}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#8A7F78', marginBottom: '8px', fontFamily: 'var(--font-ui)' }}>
                      {isFr
                        ? `${displayList.length} farine${displayList.length !== 1 ? 's' : ''} trouvée${displayList.length !== 1 ? 's' : ''}`
                        : `${displayList.length} flour${displayList.length !== 1 ? 's' : ''} found`}
                    </div>
                  )}
                  <div style={{ maxHeight: '320px', overflowY: 'auto', marginTop: '4px' }}>
                  {displayList.map(f => {
                    const isSelected = blend.brandProduct === `${f.brand} ${f.name}`;
                    return (
                      <FlourRow key={f.id} f={f} selected={isSelected} onClick={() => selectDBEntry(f)} />
                    );
                  })}
                  </div>
                </div>
              );
            })()}



        </div>
      </div>
      </>)}

      {/* ── Blend (custom mode only) ────────────────── */}
      {mode === 'custom' && (
        // No overflow:hidden on this card. It was clipping the filter menus
        // inside it: the Type/Origin/Brand dropdowns for the SECOND flour
        // opened into a hidden overflow and could not be used at all, while
        // the first flour's identical menus worked because its container never
        // clipped. Nothing inside paints to these corners, so the clip bought
        // nothing and cost the whole control.
        <div ref={blendRef} style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid #E8E0D5', background: '#F8F4EF' }}>
          <div
            onClick={() => {
              if (openSection === 'blend') {
                setBlendFilterOrigin(null);
                setBlendFilterType(null);
                setBlendFilterBrand(null);
                setBlendSearchQuery('');
              }
              setOpenSection(openSection === 'blend' ? null : 'blend');
            }}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
              color: '#3D3530',
              borderBottom: openSection === 'blend' ? '1px solid #E8E0D5' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!blend.flour2 && <span style={{ fontSize: '14px', color: '#6B4423', fontWeight: 600 }}>+</span>}
              {/* The header used to read "Add a second flour" while the panel
                  was picking the THIRD — the search for flour three appeared
                  inside a section named for flour two. */}
              <span>{
                blendSlot === 3
                  ? (locale === 'fr' ? 'Ajouter une 3e farine' : 'Add a third flour')
                  : blend.flour2
                    ? (locale === 'fr' ? 'Votre mélange' : 'Your blend')
                    : (locale === 'fr' ? 'Ajouter une seconde farine' : 'Add a second flour')
              }</span>
              {/* "optional" belongs to the invitation, not to a blend that
                  already exists — and it was never translated. */}
              {!blend.flour2 && blendSlot !== 3 && (
                <span style={{
                  fontSize: '11px', fontFamily: 'var(--font-ui)',
                  background: '#EDE8E0', color: '#8A7F78',
                  borderRadius: '20px', padding: '1px 8px',
                  border: '1px solid #DDD8D0',
                }}>{locale === 'fr' ? 'facultatif' : 'optional'}</span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: '#8A7F78' }}>{openSection === 'blend' ? '▾' : '›'}</span>
          </div>
          {openSection === 'blend' && (
            <div style={{ paddingTop: '12px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px', scrollMarginTop: '80px' }}>

              {/* If flour2 selected: show confirmation + ratio slider —
                  unless the baker is actively picking a third flour, which
                  reuses the same search UI below */}
              {blendSelectedF2 && !(blendSlot === 3 && !blendSelectedF3 && blendShowFullSearch) ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#2B2420', fontFamily: 'var(--font-ui)' }}>
                        {blendSelectedF2.brand ? `${blendSelectedF2.brand} ${blendSelectedF2.name}` : blendSelectedF2.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>
                        W{blendSelectedF2.w} · {blendSelectedF2.protein}% protein
                      </div>
                    </div>
                    <button
                      onClick={() => { setBlendSlot(2); setBlendSelectedF2(null); setBlendShowFullSearch(false); setBlendSearchQuery(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '12px', textDecoration: 'underline' }}
                    >
                      {locale === 'fr' ? 'Changer' : 'Change'}
                    </button>
                  </div>
                  {/* The bar replaces two ranges that each owned a raw ratio
                      field. Percentages live here as one list; the write-back
                      keeps the engine's contract untouched — ratio1 is the
                      base, ratio2 is flour 2 when a third exists, and the last
                      flour takes the remainder. */}
                  {(() => {
                    const p2 = blendSelectedF3 ? (blend.ratio2 ?? blendRatio2) : 100 - blendRatio;
                    const parts = [
                      // The base is whatever the baker picked on this page —
                      // brandProduct when it is a named bag, otherwise the type.
                      { name: blend.brandProduct ?? (locale === 'fr' ? 'Farine de base' : 'Base flour'),
                        pct: blendRatio, w: blend.w1 ?? blend.wOverride ?? 260 },
                      { name: blendSelectedF2!.name, pct: p2, w: blendSelectedF2!.w },
                      ...(blendSelectedF3 ? [{ name: blendSelectedF3.name, pct: 100 - blendRatio - p2, w: blendSelectedF3.w }] : []),
                    ];
                    return (
                      <div style={{ marginBottom: '10px' }}>
                        <BlendBar
                          parts={parts}
                          locale={locale}
                          approx={blendWIsApproximate(blend)}
                          onChange={(pcts) => {
                            const r1 = pcts[0];
                            setBlendRatio(r1);
                            if (blendSelectedF3) {
                              setBlendRatio2(pcts[1]);
                              onBlendChange({ ...blend, ratio1: r1, ratio2: pcts[1],
                                w2: blendSelectedF2!.w, w3: blendSelectedF3.w,
                                customFlour2Name: `${blendSelectedF2!.brand} ${blendSelectedF2!.name}`.trim(),
                                customFlour3Name: `${blendSelectedF3.brand} ${blendSelectedF3.name}`.trim() });
                            } else {
                              onBlendChange({ ...blend, ratio1: r1, w2: blendSelectedF2!.w,
                                customFlour2Name: `${blendSelectedF2!.brand} ${blendSelectedF2!.name}`.trim() });
                            }
                          }}
                        />
                        {blendSelectedF3 ? (
                          <button
                            onClick={() => { setBlendSelectedF3(null); onBlendChange({ ...blend, flour3: null, ratio2: undefined, w3: undefined, customFlour3Name: undefined }); }}
                            style={{ marginTop: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '12px', textDecoration: 'underline', padding: '10px 0', minHeight: '44px' }}
                          >
                            {locale === 'fr' ? 'Retirer la 3e farine' : 'Remove third flour'}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setBlendSlot(3); setBlendShowFullSearch(true); }}
                            style={{
                              marginTop: '10px', padding: '13px 12px', minHeight: '44px',
                              background: 'none', border: '1.5px dashed #C8B898', borderRadius: '12px',
                              cursor: 'pointer', color: '#6B4423', fontSize: '13px', fontWeight: 600,
                              fontFamily: 'var(--font-ui)', width: '100%',
                            }}
                          >
                            {locale === 'fr' ? '+ Ajouter une 3e farine' : '+ Add a third flour'}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => { setBlendSelectedF2(null); setBlendSelectedF3(null); setBlendSlot(2); onBlendChange({ ...blend, flour2: null, ratio1: 100, customFlour2Name: undefined, w2: undefined, flour3: null, ratio2: undefined, w3: undefined, customFlour3Name: undefined }); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                  >
                    {locale === 'fr' ? 'Retirer le mélange' : 'Remove blend'}
                  </button>
                </div>
              ) : (
                <div>
                  {/* Preset chips — only if styleKey has presets */}
                  {styleKey && BLEND_PRESETS[styleKey] && BLEND_PRESETS[styleKey].length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)', marginBottom: '8px' }}>
                        Popular with {styleKey.replace('_', ' ')}:
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {BLEND_PRESETS[styleKey].map(preset => (
                          <button
                            key={preset.label}
                            onClick={() => {
                              const generic = BLEND_GENERIC_TYPES[preset.type];
                              if (generic) {
                                const genericEntry: FlourEntry = {
                                  id: preset.type, brand: '', name: generic.label,
                                  type: 'bread', country: 'us', w: generic.w, wPublished: false,
                                  protein: generic.protein, hydration: [60, 75],
                                  bestFor: [], crowdFavourite: [], note: '', bagImage: '', logo: null,
                                };
                                if (blendSlot === 2) setBlendRatio(preset.ratio);
                                assignBlendFlour(genericEntry, preset.type as FlourKey, generic.label, preset.ratio, 'typical');
                              }
                            }}
                            style={{
                              padding: '8px 12px', borderRadius: '20px',
                              border: '1.5px solid #E8E0D5', background: '#FDFBF7',
                              fontSize: '13px', color: '#3D3530',
                              fontFamily: 'var(--font-ui)', cursor: 'pointer',
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {blendSlot === 3 && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--cream)', borderRadius: '16px', padding: '8px 12px', marginTop: '4px',
                      fontSize: '12px', color: '#3D3530', fontFamily: 'var(--font-ui)',
                    }}>
                      <span>{locale === 'fr' ? 'Choisissez votre 3e farine' : 'Pick your third flour'}</span>
                      <button
                        onClick={() => { setBlendSlot(2); setBlendShowFullSearch(false); setBlendSearchQuery(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                      >
                        {locale === 'fr' ? 'Annuler' : 'Cancel'}
                      </button>
                    </div>
                  )}
                  {/* Same sentence, same row as the base flour — the W lives
                      inside the sentence rather than under the buttons. No scan
                      here: the camera belongs to the flour the dough is built
                      on, not to what you sprinkle into it. */}
                  <p style={{
                    fontFamily: 'var(--font-ui)', fontSize: '12.5px', color: '#8A7F78',
                    lineHeight: 1.45, margin: '14px 0 0',
                  }}>
                    {locale === 'fr' ? 'Sinon, déterminez sa force — ou ' : 'Otherwise, work out its strength — or '}
                    <button
                      onClick={() => setBlendRoad(r => r === 'w' ? null : 'w')}
                      style={{
                        background: 'none', border: 'none', padding: 0, font: 'inherit',
                        color: '#6B4423', textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer',
                      }}
                    >{locale === 'fr' ? 'saisissez-la directement' : 'enter it directly'}</button>
                    {locale === 'fr' ? ' si vous la connaissez.' : ' if you know it.'}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    {([
                      { k: 'search' as const, n: locale === 'fr' ? 'Chercher' : 'Search',
                        c: `${FLOUR_DB.length} ${locale === 'fr' ? 'farines' : 'flours'}` },
                      { k: 'type' as const, n: locale === 'fr' ? 'Type' : 'Type',
                        c: locale === 'fr' ? 'valeur courante' : 'typical value' },
                    ]).map(r => (
                      <button
                        key={r.k}
                        onClick={() => setBlendRoad(cur => cur === r.k ? null : r.k)}
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                          border: `1px solid ${blendRoad === r.k ? '#6B4423' : '#E8E0D5'}`,
                          background: blendRoad === r.k ? '#F7F1E9' : '#FDFBF7',
                          borderRadius: '12px', padding: '11px 6px', minHeight: '44px',
                          fontFamily: 'var(--font-ui)', fontSize: '12.5px', fontWeight: 600,
                          color: '#3D3530', cursor: 'pointer',
                        }}
                      >
                        <span>{r.n}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 400, color: '#8A7F78', textAlign: 'center' }}>{r.c}</span>
                      </button>
                    ))}
                  </div>

                  {blendRoad === 'search' && (
                  <div style={{ marginTop: '12px' }}>
                    {/* Search gets its own row. Four controls shared one line
                        with minWidth 0, so the input collapsed to a blank white
                        box — its placeholder clipped away — while Brand ran off
                        the right edge. Same cause, both symptoms. */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder={locale === 'fr' ? 'Rechercher une farine…' : 'Search flour...'}
                        value={blendSearchQuery}
                        onChange={e => { setBlendSearchQuery(e.target.value); setBlendShowFullSearch(true); }}
                        style={{
                          flexBasis: '100%', padding: '12px', minHeight: '44px',
                          border: '1px solid #E8E0D5', borderRadius: '8px',
                          fontSize: '13px', fontFamily: 'var(--font-ui)',
                          background: 'white', outline: 'none', color: '#2B2420',
                        }}
                      />
                      <FilterMenu label={locale === 'fr' ? 'Type' : 'Type'} value={blendFilterType}
                        options={[...new Set(FLOUR_DB.map(f => f.type))].sort()}
                        onChange={setBlendFilterType} format={v => TYPE_LABELS[v] ?? v} />
                      <FilterMenu label={locale === 'fr' ? 'Origine' : 'Origin'} value={blendFilterOrigin}
                        options={Object.keys(ORIGIN_GROUPS)}
                        onChange={v => { setBlendFilterOrigin(v); setBlendApacCountry(null); setBlendEuropeCountry(null); setBlendAmericasCountry(null); }} />
                      <FilterMenu label={locale === 'fr' ? 'Marque' : 'Brand'} value={blendFilterBrand}
                        options={blendBrandOptions} onChange={setBlendFilterBrand} />
                    </div>

                    {/* APAC / Europe / Americas country sub-filter pills for blend */}
                    {(blendFilterOrigin === 'Asia-Pacific' || blendFilterOrigin === 'Europe' || blendFilterOrigin === 'Americas') && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px' }}>
                        {(blendFilterOrigin === 'Asia-Pacific' ? APAC_COUNTRIES :
                          blendFilterOrigin === 'Europe' ? EUROPE_COUNTRIES :
                          AMERICAS_COUNTRIES).map(({ code, flag, name }) => {
                          const active = blendFilterOrigin === 'Asia-Pacific'
                            ? blendApacCountry === code
                            : blendFilterOrigin === 'Europe'
                            ? blendEuropeCountry === code
                            : blendAmericasCountry === code;
                          return (
                            <button
                              key={code}
                              onClick={() => {
                                if (blendFilterOrigin === 'Asia-Pacific') {
                                  setBlendApacCountry(active ? null : code);
                                } else if (blendFilterOrigin === 'Europe') {
                                  setBlendEuropeCountry(active ? null : code);
                                } else {
                                  setBlendAmericasCountry(active ? null : code);
                                }
                              }}
                              title={name}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '20px',
                                border: active ? '1.5px solid #6B4423' : '1px solid #E8E0D5',
                                background: active ? '#FDF0EB' : 'transparent',
                                fontSize: '17px',
                                cursor: 'pointer',
                                lineHeight: 1,
                              }}
                            >
                              {flag}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Results — only when search/filter active */}
                    {(blendSearchQuery || blendFilterType || blendFilterOrigin || blendFilterBrand) && (() => {
                      const blendResults = FLOUR_DB
                        .filter(f => !blendSearchQuery || `${f.brand} ${f.name}`.toLowerCase().includes(blendSearchQuery.toLowerCase()))
                        .filter(f => !blendFilterType || f.type === blendFilterType)
                        .filter(f => {
                          if (!blendFilterOrigin) return true;
                          const groupCountries = ORIGIN_GROUPS[blendFilterOrigin] ?? [];
                          if (blendFilterOrigin === 'Asia-Pacific' && blendApacCountry) return f.country === blendApacCountry;
                          if (blendFilterOrigin === 'Europe' && blendEuropeCountry) return f.country === blendEuropeCountry;
                          if (blendFilterOrigin === 'Americas' && blendAmericasCountry) return f.country === blendAmericasCountry;
                          return groupCountries.includes(f.country);
                        })
                        .filter(f => !blendFilterBrand || f.brand === blendFilterBrand)
                        .slice(0, 30);
                      if (blendResults.length === 0) {
                        return (
                          <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)', padding: '8px 0' }}>
                            {locale === 'fr' ? 'Pas dans notre base — utilisez le type ou le W ci-dessous.' : 'Not in our database — use the type or W option below.'}
                          </div>
                        );
                      }
                      return (
                        <div style={{ position: 'relative' }}>
                        {/* The list clips at 200px — about three rows — and said
                            nothing about it, so a filtered search looked like it
                            had three results. A count above and a fade at the cut
                            both say there is more without spending a row on it. */}
                        <div style={{
                          fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)',
                          padding: '2px 0 6px', letterSpacing: '.03em',
                        }}>
                          {blendResults.length >= 30
                            ? (locale === 'fr' ? '30+ farines — faites défiler' : '30+ flours — scroll for more')
                            : (locale === 'fr' ? `${blendResults.length} farines — faites défiler` : `${blendResults.length} flours — scroll for more`)}
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', position: 'relative' }}>
                          {blendResults.map(f => (
                            <FlourRow
                              key={f.id}
                              f={f}
                              onClick={() => {
                                if (blendSlot === 2) setBlendRatio(85);
                                setBlendFilterType(null);
                                setBlendFilterBrand(null);
                                assignBlendFlour(f, dbTypeToFlourKey(f), `${f.brand} ${f.name}`);
                              }}
                            />
                          ))}
                        </div>
                        <div aria-hidden="true" style={{
                          position: 'absolute', left: 0, right: 0, bottom: 0, height: '26px',
                          pointerEvents: 'none',
                          background: 'linear-gradient(180deg, rgba(245,240,232,0), var(--cream))',
                        }} />
                        </div>
                      );
                    })()}

                    </div>
                    )}

                    {/* Type and W are their own roads here too — no header
                        repeating the button that opened them. */}
                    {(blendRoad === 'type' || blendRoad === 'w') && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {(() => {
                          const presetTypes = new Set((BLEND_PRESETS[styleKey ?? ''] ?? []).map(p => p.type));
                          return ([
                            { label: '00 · Pizza flour',   type: 'pizza00',    w: 260, protein: 12.0 },
                            { label: 'Semolina rimacinata', type: 'semolina',   w: 200, protein: 12.5 },
                            { label: 'Manitoba',            type: 'manitoba',   w: 380, protein: 14.0 },
                            { label: 'Wholemeal',           type: 'wholemeal',  w: 185, protein: 12.0 },
                            { label: 'Rye',                 type: 'rye',        w: 160, protein: 10.0 },
                            { label: 'Bread flour',         type: 'bread',      w: 270, protein: 12.8 },
                            { label: 'All-purpose',         type: 'allpurpose', w: 190, protein: 10.5 },
                          ] as { label: string; type: FlourKey; w: number; protein: number }[])
                            .filter(t => !presetTypes.has(t.type as FlourKey))
                            .map(t => (
                          <button
                            key={t.label}
                            onClick={() => {
                              const genericEntry: FlourEntry = {
                                id: t.label, brand: '', name: t.label,
                                type: 'bread', country: 'us', w: t.w, wPublished: false,
                                protein: t.protein, hydration: [60, 75],
                                bestFor: [], crowdFavourite: [], note: '', bagImage: '', logo: null,
                              };
                              if (blendSlot === 2) setBlendRatio(85);
                              assignBlendFlour(genericEntry, t.type as FlourKey, t.label, undefined, 'typical');
                            }}
                            style={{
                              padding: '4px 12px', borderRadius: '20px',
                              border: '1px solid #E8E0D5', background: 'transparent',
                              fontSize: '12px', color: '#3D3530',
                              fontFamily: 'var(--font-ui)', cursor: 'pointer',
                            }}
                          >
                            {t.label}
                          </button>
                        ))
                        })()
                        }
                        {/* W value input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)' }}>W</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder={locale === 'fr' ? 'ex. 380' : 'e.g. 380'}
                            min={100} max={450}
                            style={{
                              width: '72px', padding: '4px 8px',
                              border: '1.5px solid #E8E0D5', borderRadius: '8px',
                              fontFamily: 'var(--font-ui)', fontSize: '13px',
                              color: '#2B2420', background: 'white', outline: 'none', textAlign: 'center',
                            }}
                            onChange={e => {
                              const v = parseInt(e.target.value);
                              if (!isNaN(v) && v >= 100 && v <= 450) {
                                const genericEntry: FlourEntry = {
                                  id: `W${v}`, brand: '', name: `Custom W${v}`,
                                  type: 'bread', country: 'us', w: v, wPublished: true,
                                  protein: 12, hydration: [60, 75],
                                  bestFor: [], crowdFavourite: [], note: '', bagImage: '', logo: null,
                                };
                                if (blendSlot === 2) setBlendRatio(85);
                                assignBlendFlour(genericEntry, (v >= 270 ? 'strong00' : 'pizza00') as FlourKey, `Custom W${v}`, undefined, 'manual');
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
