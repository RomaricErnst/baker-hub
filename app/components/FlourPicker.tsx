'use client';
import { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { FLOUR_DATA, type FlourKey, type FlourBlend, type WSource, blendWIsApproximate } from '../data';
import FlourScan, {matchScannedFlour} from './FlourScan';
import FlourCatalogueBrowser, {FlourProductButton, flourBehaviour, flourEngineW} from './FlourCatalogueBrowser';
import { archivedBlendSelections } from '../lib/flourRecovery';
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
const BREAD_FAV_BY_STYLE: Record<string, string[]> = {
  pain_campagne: ['francine_t65', 'foricher_t65', 'celnat_t80_bio', 'ka_bread'],
  pain_levain: ['foricher_t65', 'ka_bread', 'celnat_t80_bio', 'francine_t65'],
  baguette: ['francine_t65', 'foricher_t65', 'gmp_t65', 'francine_bio_t55'],
  pain_complet: ['francine_complete', 'doves_wholemeal', 'bobs_whole_wheat', 'shipton_wholemeal'],
  pain_seigle: ['doves_farm_rye', 'bobs_dark_rye', 'shipton_rye', 'ka_organic_medium_rye'],
  brioche: ['gruau_dor_gruau_t45', 'gmp_t45_gruau', 'caputo_manitoba', 'ka_bread'],
  pain_mie: ['francine_bio_t55', 'ka_bread', 'francine_t65', 'gmp_t65'],
  pain_viennois: ['gruau_dor_gruau_t45', 'gmp_t45_gruau', 'ka_bread', 'francine_bio_t55'],
  fougasse: ['francine_t65', 'foricher_t65', 'gmp_t65', 'francine_bio_t55'],
};


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

const ORIGIN_LABELS_FR: Record<string, string> = {
  France:'France', Italy:'Italie', UK:'Royaume-Uni', Americas:'Amériques', Europe:'Europe', 'Asia-Pacific':'Asie-Pacifique',
  Singapore:'Singapour', Japan:'Japon', Korea:'Corée', Australia:'Australie', India:'Inde', Indonesia:'Indonésie', Malaysia:'Malaisie', Thailand:'Thaïlande', Philippines:'Philippines', Vietnam:'Viêt Nam', China:'Chine',
  Germany:'Allemagne', Netherlands:'Pays-Bas', Sweden:'Suède', Norway:'Norvège', Finland:'Finlande', Poland:'Pologne', Austria:'Autriche',
  'United States':'États-Unis', Canada:'Canada', Brazil:'Brésil', Mexico:'Mexique', Argentina:'Argentine',
};
export function flourOriginLabel(value: string, locale: string): string {
  return locale === 'fr' ? ORIGIN_LABELS_FR[value] ?? value : value;
}

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

// Manual label metadata is retained with the blend through existing save/restore.
// Protein is descriptive: it does not replace the selected type or infer W.
export type ManualFlourBlend = FlourBlend & {
  manualFlour1?: { type: FlourKey; protein?: number; proteinSource?: 'manual' };
  manualFlour2?: { type: FlourKey; protein?: number; proteinSource?: 'manual' };
  manualFlour3?: { type: FlourKey; protein?: number; proteinSource?: 'manual' };
};
export function manualFlourSelection(blend: FlourBlend, type: FlourKey, name: string, wText: string, proteinText: string, locale: string): ManualFlourBlend | null {
  const w = wText.trim() === '' ? undefined : Number(wText);
  const protein = proteinText.trim() === '' ? undefined : Number(proteinText);
  if (w !== undefined && (!Number.isFinite(w) || w < 1 || w > 500)) return null;
  if (protein !== undefined && (!Number.isFinite(protein) || protein < 1 || protein > 30)) return null;
  const selectedW = w ?? FLOUR_DATA[type].w;
  return {...blend, flour1: type, w1: selectedW, wOverride: selectedW,
    w1Source: w === undefined ? 'typical' : 'manual', brandKey: undefined,
    brandProduct: name.trim() || (locale === 'fr' ? FLOUR_DATA[type].nameFr : FLOUR_DATA[type].name),
    manualFlour1: {type, ...(protein === undefined ? {} : {protein, proteinSource: 'manual' as const})}};
}

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
export function BlendBar({ parts, onChange, locale, approx }: {
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
            <div key={`g${i}`} role="slider" tabIndex={0}
              aria-label={`${p.name} · ${locale === 'fr' ? 'pourcentage de farine' : 'flour percentage'}`}
              aria-valuemin={5} aria-valuemax={p.pct + parts[i + 1].pct - 5}
              aria-valuenow={p.pct} aria-valuetext={`${p.pct}% ${p.name} · ${parts[i + 1].pct}% ${parts[i + 1].name}`}
              onKeyDown={e => {
                const pair = p.pct + parts[i + 1].pct;
                const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
                if (!delta && e.key !== 'Home' && e.key !== 'End') return;
                e.preventDefault();
                const left = e.key === 'Home' ? 5 : e.key === 'End' ? pair - 5 : Math.max(5, Math.min(pair - 5, p.pct + delta));
                const next = parts.map(part => part.pct); next[i] = left; next[i + 1] = pair - left;
                onChange(next);
              }}
              onPointerDown={e => grab(i, e)} style={{
              position: 'absolute', top: 0, bottom: 0, width: '44px', marginLeft: '-22px',
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
        <span>{locale === 'fr' ? 'Glissez ou utilisez les flèches du clavier' : 'Drag or use the keyboard arrows'}</span>
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

function FlourRow({f,selected,onClick}:{f:FlourEntry;selected?:boolean;onClick:()=>void}) {
 return <FlourProductButton entry={f} selected={selected} onChoose={onClick}/>;
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
  const [unmatchedScan, setUnmatchedScan] = useState<string | null>(null);

  // "I know my type or W value" collapsible in Section 2
  const [manualQW, setManualQW] = useState<number | null>(null);
  // Raw text of the W field — the controlled input previously only accepted
  // already-valid values (100-450), so typing '2' of '280' was rejected
  // char-by-char and the field appeared dead.
  const [manualQWText, setManualQWText] = useState('');
  const [manualType, setManualType] = useState<FlourKey>(blend.flour1 ?? 'pizza00');
  const [manualName, setManualName] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const savedManual = (blend as ManualFlourBlend).manualFlour1;
  function openManualFlour() {
    setManualType(blend.flour1 ?? 'pizza00');
    setManualName(savedManual ? blend.brandProduct ?? '' : '');
    setManualProtein(savedManual?.protein === undefined ? '' : String(savedManual.protein));
    setManualQWText(savedManual && blend.w1Source === 'manual' ? String(blend.w1 ?? '') : '');
    setRoad('type');
  }

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
  const flourRoadRef = useRef<HTMLDivElement>(null);
  const flourSearchRef = useRef<HTMLDivElement>(null);
  const previousRoadRef = useRef<typeof road>(null);
  useEffect(() => {
    const previous = previousRoadRef.current;
    previousRoadRef.current = road;
    if (road === 'scan' || road === 'type') {
      flourRoadRef.current?.focus({preventScroll: true});
      flourRoadRef.current?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    } else if (previous === 'scan' || previous === 'type') {
      flourSearchRef.current?.querySelector<HTMLElement>('input, button')?.focus({preventScroll: true});
    }
  }, [road]);
  const [pickerOverride, setPickerOverride] = useState<boolean | null>(null);
  const pickerOpen = pickerOverride ?? !blend.brandProduct;
  const setPickerOpen = (v: boolean) => setPickerOverride(v ? true : null);
  const [blendFilterType, setBlendFilterType] = useState<string | null>(null);
  const [blendFilterOrigin, setBlendFilterOrigin] = useState<string | null>(null);
  const [blendFilterBrand, setBlendFilterBrand] = useState<string | null>(null);
  const [blendSelectedF2, setBlendSelectedF2] = useState<FlourEntry | null>(() => {
    if (!blend.flour2 || !blend.customFlour2Name) return null;
    const known = FLOUR_DB.find(entry => `${entry.brand} ${entry.name}`.trim() === blend.customFlour2Name);
    if (known) return known;
    return {
      id: 'restored',
      brand: '',
      name: blend.customFlour2Name,
      type: 'bread',
      country: 'zz',
      w: blend.w2 ?? null,
      wPublished: blend.w2Source === 'exact',
      protein: (blend as ManualFlourBlend).manualFlour2?.protein ?? null,
      hydration: null,
      bestFor: [], crowdFavourite: [], note: '', bagImage: '', logo: null,
    };
  });
  const [blendRatio, setBlendRatio] = useState(() => blend.ratio1 < 100 ? blend.ratio1 : 85);
  // Third flour: which slot the blend search assigns to, the picked entry,
  // and flour2's share (flour3 takes the remainder).
  const [blendSlot, setBlendSlot] = useState<2 | 3>(2);
  const [blendSelectedF3, setBlendSelectedF3] = useState<FlourEntry | null>(() => {
    if (!blend.flour3 || !blend.customFlour3Name) return null;
    return FLOUR_DB.find(entry => `${entry.brand} ${entry.name}`.trim() === blend.customFlour3Name) ?? {
      id:'restored-third', brand:'', name:blend.customFlour3Name, type:blend.flour3, country:'zz',
      w:blend.w3 ?? null,wPublished:blend.w3Source === 'exact',protein:(blend as ManualFlourBlend).manualFlour3?.protein ?? null,hydration:null,
      bestFor:[],crowdFavourite:[],note:'',bagImage:'',logo:null,
    };

  });
  const [blendRatio2, setBlendRatio2] = useState(() => blend.ratio2 ?? 10);
  const [blendShowFullSearch, setBlendShowFullSearch] = useState(false);
  // Same mechanic as the base flour: one road open at a time, chosen from a row
  // under one sentence. The blend used to stack the search, its filters, a type
  // list and a W field all at once — which is exactly what the base stopped
  // doing, and why the two still looked like different products.
  const [blendRoad, setBlendRoad] = useState<'scan' | 'search' | 'type' | 'w' | null>(null);

  const locale = useLocale();
  const isFr = locale === 'fr';

  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectionRef=useRef<HTMLDivElement>(null);
  const chosenEntry=savedManual ? undefined : FLOUR_DB.find(f=>`${f.brand} ${f.name}`===blend.brandProduct);
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
    return flourBehaviour(f);
  }

  // A road is a way of finding a flour, not a view onto the last one's
  // results. Leaving the query and filters behind meant opening Type and
  // still reading a list narrowed by a search you had moved on from.
  function chooseRoad(k: 'scan' | 'search' | 'type' | 'w') {
    setRoad(cur => (cur === k ? null : k));
    setSearchQuery('');
    setFilterType(null);
    setFilterOrigin(null);
    setFilterManufacturer(null);
  }

  function chooseBlendRoad(k: 'scan' | 'search' | 'type' | 'w') {
    setBlendRoad(cur => (cur === k ? null : k));
    setSearchQuery('');
    setFilterType(null);
    setFilterOrigin(null);
    setFilterManufacturer(null);
  }

  function assignBlendFlour(entry: FlourEntry, key: FlourKey, label: string, r1ForSlot2 = 85, source?: WSource) {
    setUnmatchedScan(null);
    // Same rule for additions: default to what the database says it knows.
    source = source ?? (entry.wPublished ? 'exact' : 'typical');
    const manualMetadata = entry.id.startsWith('manual-') ? {type:key, ...(entry.protein == null ? {} : {protein:entry.protein,proteinSource:'manual' as const})} : undefined;
    if (blendSlot === 3) {
      setBlendSelectedF3(entry);
      const r1 = blend.flour3 ? blendRatio : Math.min(blendRatio, 80);
      const r2 = blend.flour3 ? (blend.ratio2 ?? blendRatio2) : Math.min(blendRatio2, 100 - r1 - 5);
      setBlendRatio(r1); setBlendRatio2(r2);
      onBlendChange({ ...blend, flour3: key, ratio1: r1, ratio2: r2, w3: flourEngineW(entry), w3Source: source, customFlour3Name: label, ...{manualFlour3:manualMetadata} });
    } else {
      setBlendSelectedF2(entry);
      onBlendChange({ ...blend, flour2: key, ratio1: r1ForSlot2, w2: flourEngineW(entry), w2Source: source, customFlour2Name: label, ...{manualFlour2:manualMetadata} });
    }
    setBlendShowFullSearch(false); setBlendSearchQuery(''); setBlendRoad(null);
  }

  function selectDBEntry(f: FlourEntry) {
    setUnmatchedScan(null); setRoad(null);
    const autoTile: FlourKey = flourBehaviour(f);
    onBlendChange({
      ...blend,
      flour1: autoTile,
      flour2: blend.flour2,
      ratio1: blend.ratio1,
      wOverride: flourEngineW(f),
      w1: flourEngineW(f),
      // 254 of the 291 entries carry an estimated W — the database flags it
      // with wPublished, and the list already prints ~W for those. Stamping
      // 'exact' regardless would have let an estimate print without its tilde
      // the moment it reached the card.
      w1Source: f.wPublished ? 'exact' : 'typical',
      brandKey: undefined,
      brandProduct: `${f.brand} ${f.name}`,
      ...{manualFlour1: undefined},
    });
    setPickerOpen(false);
    requestAnimationFrame(()=>selectionRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));
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
    <div ref={selectionRef}>
      {unmatchedScan && <p role="status">{isFr ? `« ${unmatchedScan} » : aucun produit exact retrouvé. Choisissez le type correspondant au sachet, ou recherchez une autre farine. Votre sélection actuelle reste inchangée.` : `“${unmatchedScan}”: no exact product found. Choose the type shown on the bag, or search for another flour. Your current selection is unchanged.`}</p>}

      {archivedBlendSelections(blend).length > 0 && <p role="alert" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12 }}>{isFr ? 'Une farine enregistrée est archivée. Remplacez-la explicitement ; vos anciennes valeurs restent conservées en attendant.' : 'A saved flour is archived. Choose its replacement explicitly; your previous values are retained until then.'} {archivedBlendSelections(blend).join(' · ')}</p>}
      {/* ── Selected flour — hero card (rendering only; same state) ── */}
      {chosenEntry&&<><FlourProductButton entry={chosenEntry} selected onChoose={()=>selectDBEntry(chosenEntry)}/><button type="button" onClick={()=>setPickerOpen(true)} style={{minHeight:44}}>{isFr?'Changer de farine':'Change flour'}</button></>}
      {blend.brandProduct && !chosenEntry && (
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
          {savedManual?.protein !== undefined && <p style={{fontSize:14,margin:'8px 0'}}>{isFr ? 'Protéines indiquées sur le sachet' : 'Protein entered from the bag'} : {savedManual.protein}%</p>}
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
      {pickerOpen && <>
        <div ref={flourSearchRef} hidden={road === 'scan' || road === 'type'}>
        <FlourCatalogueBrowser styleKey={styleKey ?? undefined} onChoose={selectDBEntry} recommendedIds={bakeType === 'bread' ? (BREAD_FAV_BY_STYLE[styleKey ?? ''] ?? BREAD_FAV_BY_STYLE.pain_campagne) : (PIZZA_FAV_BY_STYLE[styleKey ?? ''] ?? CROWD_FAV_IDS)} onGeneric={openManualFlour} onScan={()=>setRoad(road==='scan'?null:'scan')}/>
        </div>
        {(road === 'scan' || road === 'type') && <div ref={flourRoadRef} tabIndex={-1} aria-label={road === 'scan' ? (isFr ? 'Scanner une farine' : 'Scan a flour') : (isFr ? 'Choisir un type de farine' : 'Choose a flour type')}>
          {road === 'type' && <button type="button" onClick={()=>{setRoad(null);setUnmatchedScan(null);}} style={{minHeight:44,padding:'8px 0',border:0,background:'transparent',fontSize:16,color:'var(--terra)',cursor:'pointer'}}>{isFr ? '← Retour à la recherche de farine' : '← Back to flour search'}</button>}
        {road==='scan'&&<FlourScan onResult={result=>{const match=matchScannedFlour(result.name);if(match){selectDBEntry(match);}else{setUnmatchedScan(result.name);setManualName(result.name);setManualType(blend.flour1 ?? 'pizza00');setManualProtein('');setManualQWText('');setRoad('type');}}} onCancel={()=>{setRoad(null);setUnmatchedScan(null);}}/>}
        {road==='type'&&<section aria-label={isFr?'Saisir une farine':'Enter your flour'} style={{marginTop:16}}>
          <h3>{isFr?'Saisir votre farine':'Enter your flour'}</h3>
          <label style={{display:'block',marginBottom:16}}>{isFr?'Type de farine':'Flour type'}
            <select value={manualType} onChange={e=>setManualType(e.target.value as FlourKey)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}>
              {(Object.keys(FLOUR_DATA) as FlourKey[]).map(type=><option key={type} value={type}>{isFr?FLOUR_DATA[type].nameFr:FLOUR_DATA[type].name}</option>)}
            </select>
          </label>
          <label style={{display:'block',marginBottom:16}}>{isFr?'Nom du produit · facultatif':'Product name · optional'}
            <input type="text" value={manualName} onChange={e=>setManualName(e.target.value)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}/>
          </label>
          <details><summary style={{minHeight:44,padding:'10px 0',cursor:'pointer'}}>{isFr?'Ajouter les valeurs du sachet · facultatif':'Add values from the bag · optional'}</summary>
            <label style={{display:'block',marginBottom:16}}>{isFr?'Force W':'Strength W'}
              <input type="number" min={1} max={500} value={manualQWText} onChange={e=>setManualQWText(e.target.value)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}/>
            </label>
            <label style={{display:'block',marginBottom:16}}>{isFr?'Protéines (%)':'Protein (%)'}
              <input type="number" min={1} max={30} step={0.1} value={manualProtein} onChange={e=>setManualProtein(e.target.value)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}/>
            </label>
            <p style={{fontSize:14,color:'var(--smoke)'}}>{isFr?'Protéines : information du sachet, non utilisée pour calculer W.':'Protein is recorded from the bag; it is not used to calculate W.'}</p>
          </details>
          <p style={{fontSize:14}}>{isFr?'Sans force W indiquée, nous utilisons une estimation pour le type choisi.':'Without a stated W, we use an estimate for the selected flour type.'}</p>
          <button type="button" disabled={!manualFlourSelection(blend,manualType,manualName,manualQWText,manualProtein,locale)} onClick={()=>{
            const selection=manualFlourSelection(blend,manualType,manualName,manualQWText,manualProtein,locale);
            if(!selection)return;
            onBlendChange(selection);setRoad(null);setUnmatchedScan(null);setPickerOpen(false);
            requestAnimationFrame(()=>selectionRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));
          }} style={{minHeight:44,padding:'10px 16px',fontSize:16}}>{isFr?'Utiliser cette farine':'Use this flour'}</button>
        </section>}
        </div>}
      </>}

      {/* ── Blend (custom mode only) ────────────────── */}
      {mode === 'custom' && blend.brandProduct && (
        // No overflow:hidden on this card. It was clipping the filter menus
        // inside it: the Type/Origin/Brand dropdowns for the SECOND flour
        // opened into a hidden overflow and could not be used at all, while
        // the first flour's identical menus worked because its container never
        // clipped. Nothing inside paints to these corners, so the clip bought
        // nothing and cost the whole control.
        <div ref={blendRef} style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid #E8E0D5', background: '#F8F4EF' }}>
          <button type="button" aria-expanded={openSection === 'blend'}
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
              width:'100%',minHeight:44,textAlign:'left',border:0,background:'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
              color: '#3D3530',
              borderBottom: openSection === 'blend' ? '1px solid #E8E0D5' : 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!blend.flour2 && <span style={{ fontSize: '14px', color: '#6B4423', fontWeight: 600 }}>+</span>}
              {/* The header used to read "Add a second flour" while the panel
                  was picking the THIRD — the search for flour three appeared
                  inside a section named for flour two. */}
              <span>{
                blendSlot === 3 && blendShowFullSearch
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
            </span>
            <span style={{ fontSize: '12px', color: '#8A7F78' }}>{openSection === 'blend' ? '▾' : '›'}</span>
          </button>
          {openSection === 'blend' && (
            <div style={{ paddingTop: '12px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px', scrollMarginTop: '80px' }}>

              {/* If flour2 selected: show confirmation + ratio slider —
                  unless the baker is actively picking a third flour, which
                  reuses the same search UI below */}
              {blendSelectedF2 && !blendShowFullSearch ? (
                <div>
                  <FlourProductButton entry={blendSelectedF2} selected onChoose={()=>{}} />
                  <button type="button" onClick={()=>{setBlendSlot(2);setBlendShowFullSearch(true);setBlendRoad(null);}} style={{minHeight:44}}>{isFr?'Changer de farine':'Change flour'}</button>
                  {blendSelectedF3 && <><FlourProductButton entry={blendSelectedF3} selected onChoose={()=>{}} />
                    <button type="button" onClick={()=>{setBlendSlot(3);setBlendShowFullSearch(true);setBlendRoad(null);}} style={{minHeight:44}}>{isFr?'Changer la 3e farine':'Change third flour'}</button></>}
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
                      { name: blendSelectedF2!.name, pct: p2, w: flourEngineW(blendSelectedF2!) },
                      ...(blendSelectedF3 ? [{ name: blendSelectedF3.name, pct: 100 - blendRatio - p2, w: flourEngineW(blendSelectedF3) }] : []),
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
                                w2: flourEngineW(blendSelectedF2!), w3: flourEngineW(blendSelectedF3),
                                customFlour2Name: `${blendSelectedF2!.brand} ${blendSelectedF2!.name}`.trim(),
                                customFlour3Name: `${blendSelectedF3.brand} ${blendSelectedF3.name}`.trim() });
                            } else {
                              onBlendChange({ ...blend, ratio1: r1, w2: flourEngineW(blendSelectedF2!),
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
                    style={{ minHeight:44, background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                  >
                    {locale === 'fr' ? 'Retirer le mélange' : 'Remove blend'}
                  </button>
                </div>
              ) : (
                <div>
                  {(blendSelectedF2 || blendSlot===3) && <button type="button" onClick={()=>{setBlendSlot(2);setBlendShowFullSearch(false);setBlendRoad(null);}} style={{minHeight:44}}>{isFr?'Annuler':'Cancel'}</button>}
                  <div hidden={blendRoad==='scan'||blendRoad==='type'}>
                    <FlourCatalogueBrowser key={blendSlot} styleKey={styleKey ?? undefined}
                      recommendedIds={bakeType==='bread' ? (BREAD_FAV_BY_STYLE[styleKey ?? ''] ?? BREAD_FAV_BY_STYLE.pain_campagne) : (PIZZA_FAV_BY_STYLE[styleKey ?? ''] ?? CROWD_FAV_IDS)}
                      onChoose={entry=>{const ratio=blend.flour2 ? blend.ratio1 : 85;if(blendSlot===2)setBlendRatio(ratio);assignBlendFlour(entry,flourBehaviour(entry),`${entry.brand} ${entry.name}`.trim(),ratio);}}
                      onGeneric={()=>{setManualName('');setManualType('bread');setManualProtein('');setManualQWText('');setBlendRoad('type');}}
                      onScan={()=>setBlendRoad('scan')} />
                  </div>
                  {blendRoad==='scan'&&<FlourScan onResult={result=>{
                    const match=matchScannedFlour(result.name);
                    if(match){const ratio=blend.flour2 ? blend.ratio1 : 85;if(blendSlot===2)setBlendRatio(ratio);assignBlendFlour(match,flourBehaviour(match),`${match.brand} ${match.name}`.trim(),ratio);}
                    else{setUnmatchedScan(result.name);setManualName(result.name);setManualType('bread');setManualProtein('');setManualQWText('');setBlendRoad('type');}
                  }} onCancel={()=>{setBlendRoad(null);setUnmatchedScan(null);}}/>}
                  {blendRoad==='type'&&<button type="button" onClick={()=>{setBlendRoad(null);setUnmatchedScan(null);}} style={{minHeight:44}}>{isFr?'← Retour à la recherche de farine':'← Back to flour search'}</button>}
        {blendRoad==='type'&&<section aria-label={isFr?'Saisir une farine':'Enter your flour'} style={{marginTop:16}}>
          <h3>{isFr?'Saisir votre farine':'Enter your flour'}</h3>
          <label style={{display:'block',marginBottom:16}}>{isFr?'Type de farine':'Flour type'}
            <select value={manualType} onChange={e=>setManualType(e.target.value as FlourKey)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}>
              {(Object.keys(FLOUR_DATA) as FlourKey[]).map(type=><option key={type} value={type}>{isFr?FLOUR_DATA[type].nameFr:FLOUR_DATA[type].name}</option>)}
            </select>
          </label>
          <label style={{display:'block',marginBottom:16}}>{isFr?'Nom du produit · facultatif':'Product name · optional'}
            <input type="text" value={manualName} onChange={e=>setManualName(e.target.value)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}/>
          </label>
          <details><summary style={{minHeight:44,padding:'10px 0',cursor:'pointer'}}>{isFr?'Ajouter les valeurs du sachet · facultatif':'Add values from the bag · optional'}</summary>
            <label style={{display:'block',marginBottom:16}}>{isFr?'Force W':'Strength W'}
              <input type="number" min={1} max={500} value={manualQWText} onChange={e=>setManualQWText(e.target.value)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}/>
            </label>
            <label style={{display:'block',marginBottom:16}}>{isFr?'Protéines (%)':'Protein (%)'}
              <input type="number" min={1} max={30} step={0.1} value={manualProtein} onChange={e=>setManualProtein(e.target.value)} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:10,marginTop:6}}/>
            </label>
            <p style={{fontSize:14,color:'var(--smoke)'}}>{isFr?'Protéines : information du sachet, non utilisée pour calculer W.':'Protein is recorded from the bag; it is not used to calculate W.'}</p>
          </details>
          <p style={{fontSize:14}}>{isFr?'Sans force W indiquée, nous utilisons une estimation pour le type choisi.':'Without a stated W, we use an estimate for the selected flour type.'}</p>
          <button type="button" disabled={!manualFlourSelection(blend,manualType,manualName,manualQWText,manualProtein,locale)} onClick={()=>{
            const selection=manualFlourSelection(blend,manualType,manualName,manualQWText,manualProtein,locale);
            if(!selection)return;
            const entry: FlourEntry = {id:`manual-${blendSlot}`,brand:'',name:selection.brandProduct ?? '',type:manualType,country:'zz',
              w:selection.w1 ?? null,wPublished:selection.w1Source==='manual',protein:selection.manualFlour1?.protein ?? null,
              hydration:null,bestFor:[],crowdFavourite:[],note:'',bagImage:'',logo:null};
            if(blendSlot===2)setBlendRatio(blend.flour2 ? blend.ratio1 : 85);
            assignBlendFlour(entry,manualType,entry.name,blend.flour2 ? blend.ratio1 : 85,selection.w1Source);
          }} style={{minHeight:44,padding:'10px 16px',fontSize:16}}>{isFr?'Utiliser cette farine':'Use this flour'}</button>
        </section>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
