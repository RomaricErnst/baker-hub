'use client';
import { useState } from 'react';
import { FLOUR_DATA, FLOUR_BRANDS, type FlourKey, type BrandKey, type FlourBlend, computeBlendProfile } from '../data';
import FlourScan from './FlourScan';
import { FLOUR_DB } from '@/lib/flourDatabase';

// ── Type badge labels for individual flour rows ──
const TYPE_BADGE: Record<string, string> = {
  '00': '00', bread: 'bread',
  all_purpose: 'AP', high_gluten: 'MB', semolina: 'SEM',
  wholemeal: 'WW', rye: 'RYE',
};

const FLAGS: Record<string, string> = {
  it: '🇮🇹', fr: '🇫🇷', us: '🇺🇸', sg: '🇸🇬',
  uk: '🇬🇧', jp: '🇯🇵', ca: '🇨🇦', au: '🇦🇺', my: '🇲🇾', de: '🇩🇪',
  cn: '🇨🇳', kr: '🇰🇷', in: '🇮🇳', th: '🇹🇭', id: '🇮🇩', vn: '🇻🇳', ph: '🇵🇭',
};

// ── Origin / type filter data ─────────────────
const ORIGIN_GROUPS: Record<string, string[]> = {
  france:   ['fr'],
  italy:    ['it'],
  uk:       ['uk'],
  americas: ['us', 'ca', 'br', 'mx', 'ar'],
  europe:   ['de', 'nl', 'be', 'se', 'no', 'fi', 'dk', 'pl', 'tr', 'at'],
  apac:     ['jp', 'cn', 'kr', 'sg', 'th', 'id', 'my', 'vn', 'ph', 'in', 'au'],
};

const ORIGIN_PILLS = [
  { key: 'france',   label: '🇫🇷 France' },
  { key: 'italy',    label: '🇮🇹 Italy' },
  { key: 'uk',       label: '🇬🇧 UK' },
  { key: 'americas', label: '🌎 Americas' },
  { key: 'europe',   label: '🌍 Europe' },
  { key: 'apac',     label: '🌏 APAC' },
];

const APAC_CHIPS = [
  { code: 'sg', label: '🇸🇬' },
  { code: 'jp', label: '🇯🇵' },
  { code: 'cn', label: '🇨🇳' },
  { code: 'kr', label: '🇰🇷' },
  { code: 'in', label: '🇮🇳' },
  { code: 'au', label: '🇦🇺' },
];
const APAC_MORE_CODES = ['th', 'id', 'my', 'vn', 'ph'];

interface TypeGroup { label: string; types: string[] }
const TYPE_LABEL_GROUPS: Record<string, TypeGroup[]> = {
  italy: [
    { label: '00',       types: ['00'] },
    { label: '0',        types: ['0'] },
    { label: 'Tipo 1',   types: ['1'] },
    { label: 'Semolina', types: ['semolina'] },
  ],
  france: [
    { label: 'T45',   types: ['T45'] },
    { label: 'T55',   types: ['T55'] },
    { label: 'T65',   types: ['T65'] },
    { label: 'T80',   types: ['T80'] },
    { label: 'T110+', types: ['T110', 'T150'] },
  ],
  all: [
    { label: 'Bread',       types: ['bread', 'high_gluten'] },
    { label: 'All-purpose', types: ['all_purpose'] },
    { label: 'Wholemeal',   types: ['wholemeal'] },
    { label: 'Rye',         types: ['rye'] },
    { label: 'Semolina',    types: ['semolina'] },
  ],
};

function getTypeGroupKey(origin: string | null): string {
  if (origin === 'italy')  return 'italy';
  if (origin === 'france') return 'france';
  return 'all';
}

const STYLE_DISPLAY: Record<string, string> = {
  neapolitan: 'Neapolitan', newyork: 'New York', roman: 'Roman',
  detroit: 'Detroit', sicilian: 'Sicilian', sourdough: 'Sourdough',
};

// ── Flour lists ───────────────────────────────
const PIZZA_FLOURS: FlourKey[]        = ['pizza00', 'strong00', 'bread', 'allpurpose'];
const PIZZA_SECOND_FLOURS: FlourKey[] = ['semolina', 'manitoba', 'wholemeal', 'allpurpose'];
const BREAD_FLOURS: FlourKey[]        = ['bread', 'strong00', 'allpurpose', 'wholemeal', 'rye'];
const BREAD_SECOND_FLOURS: FlourKey[] = ['rye', 'wholemeal', 'manitoba', 'allpurpose'];

const FLOUR_DESCS: Record<FlourKey, string> = {
  pizza00:    'Classic Italian 00 — ideal for most pizza styles',
  strong00:   'Long cold ferments — maximum flavour',
  bread:      'Reliable gluten — great for most styles',
  allpurpose: 'Accessible, slightly less structure',
  semolina:   'Nutty durum wheat flavour',
  wholemeal:  'Nutty, nutritious, absorbs more water',
  rye:        'Deep flavour, enzyme-active',
  manitoba:   'Ultra-strong — 72h+ ferments, very high gluten',
};

const SECOND_FLOUR_VALUE: Partial<Record<FlourKey, string>> = {
  semolina:   'Crunch + golden colour. 10–20% typical.',
  manitoba:   'Extra strength for 72h+ ferments.',
  wholemeal:  'Nutty complexity — use sparingly.',
  allpurpose: 'Softens structure for home oven.',
  rye:        'Deep flavour, enzyme boost. 10–30% typical.',
  strong00:   'Boost strength for long cold ferments.',
};

// ── W strength helper ─────────────────────────
function wStrength(w: number): { label: string; color: string } {
  if (w < 200) return { label: 'Weak — short ferments only', color: 'var(--smoke)' };
  if (w < 250) return { label: 'Medium — 8-24h',             color: 'var(--smoke)' };
  if (w < 300) return { label: 'Strong — 24-48h',            color: 'var(--sage)'  };
  if (w < 350) return { label: 'Very strong — 48-72h',       color: 'var(--gold)'  };
  return           { label: 'Professional — 72h+',           color: 'var(--terra)' };
}

// ── Shared pill style ─────────────────────────
const PILL: React.CSSProperties = {
  fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
  background: 'var(--cream)', color: 'var(--ash)',
  borderRadius: '20px', padding: '.1rem .5rem',
  border: '1px solid var(--border)',
};

interface FlourPickerProps {
  blend: FlourBlend;
  onBlendChange: (blend: FlourBlend) => void;
  bakeType?: 'pizza' | 'bread';
  mode?: 'simple' | 'custom';
  styleKey?: string | null;
}

// ── Flour card grid (second flour selection) ──
function FlourCardGrid({
  flours, selected, onSelect, exclude, descOverride,
}: {
  flours: FlourKey[];
  selected: FlourKey | null;
  onSelect: (k: FlourKey) => void;
  exclude?: FlourKey | null;
  descOverride?: Partial<Record<FlourKey, string>>;
}) {
  const [hovered, setHovered] = useState<FlourKey | null>(null);
  const visible = exclude ? flours.filter(k => k !== exclude) : flours;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.65rem' }}>
      {visible.map(key => {
        const f = FLOUR_DATA[key];
        const isSelected = selected === key;
        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              border: `1.5px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: '12px', padding: '.8rem .9rem', cursor: 'pointer',
              background: isSelected ? '#FFF8F3' : 'var(--warm)', transition: 'all .2s',
              boxShadow: hovered === key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
              transform: hovered === key ? 'translateY(-2px)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.4rem', marginBottom: '.4rem' }}>
              <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--char)', lineHeight: 1.3 }}>{f.name}</div>
              {isSelected && <span style={{ color: 'var(--terra)', fontSize: '.8rem', flexShrink: 0 }}>✓</span>}
            </div>
            <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.4rem' }}>
              <span style={PILL}>W {f.w}</span>
              <span style={PILL}>{f.protein}% protein</span>
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.4 }}>{descOverride?.[key] ?? FLOUR_DESCS[key]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Blend section ─────────────────────────────
function BlendSection({
  blend, onBlendChange, primaryFlours, secondaryFlours,
}: {
  blend: FlourBlend;
  onBlendChange: (b: FlourBlend) => void;
  primaryFlours: FlourKey[];
  secondaryFlours: FlourKey[];
}) {
  const [blendOpen, setBlendOpen] = useState(blend.flour2 !== null);
  const [customFlourOpen, setCustomFlourOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customW, setCustomW] = useState<number | ''>('');
  const [customProtein, setCustomProtein] = useState<number | ''>('');
  const [customRatio1, setCustomRatio1] = useState(70);
  const blendProfile = computeBlendProfile(blend);

  const inputStyle: React.CSSProperties = {
    padding: '.42rem .6rem', borderRadius: '8px',
    border: '1.5px solid var(--border)', background: 'var(--warm)',
    fontFamily: 'var(--font-dm-mono)', fontSize: '.88rem',
    color: 'var(--char)', outline: 'none',
  };

  function openBlend() {
    setBlendOpen(true);
    setCustomFlourOpen(false);
    if (!blend.flour2) {
      const next = secondaryFlours.find(k => k !== blend.flour1);
      if (next) onBlendChange({ ...blend, flour2: next, ratio1: 70 });
    }
  }

  function closeBlend() {
    setBlendOpen(false);
    onBlendChange({ ...blend, flour2: null, ratio1: 100 });
  }

  function handleCustomChange(name: string, w: number | '', protein: number | '', ratio: number) {
    if (w !== '' && name.trim()) {
      const f1w = FLOUR_DATA[blend.flour1].w;
      const blendedW = Math.round((f1w * ratio / 100) + (w * (100 - ratio) / 100));
      onBlendChange({ flour1: blend.flour1, flour2: null, ratio1: ratio, wOverride: blendedW, customFlour2Name: name.trim() });
    }
  }

  return (
    <>
      {!blendOpen && (
        <button
          onClick={openBlend}
          style={{
            marginTop: '.9rem', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--smoke)', fontSize: '.78rem', fontFamily: 'var(--font-dm-sans)',
            textDecoration: 'underline', textUnderlineOffset: '2px', padding: '.2rem 0',
          }}
        >
          Add a second flour? →
        </button>
      )}

      {blendOpen && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.7rem' }}>
            <div style={{ fontSize: '.7rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
              Second flour
            </div>
            <button onClick={closeBlend} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--smoke)', fontSize: '.72rem', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
              Remove blend
            </button>
          </div>

          <FlourCardGrid
            flours={secondaryFlours}
            selected={blend.flour2}
            onSelect={k => onBlendChange({ ...blend, flour2: k })}
            exclude={blend.flour1}
            descOverride={SECOND_FLOUR_VALUE}
          />

          {blend.flour2 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.4rem' }}>
                <span style={{ fontSize: '.75rem', color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', fontWeight: 600 }}>
                  {blend.ratio1}% {FLOUR_DATA[blend.flour1].name}
                </span>
                <span style={{ fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                  {100 - blend.ratio1}% {FLOUR_DATA[blend.flour2].name}
                </span>
              </div>
              <input
                type="range" min={10} max={90} step={10} value={blend.ratio1}
                onChange={e => onBlendChange({ ...blend, ratio1: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem' }}>
                <span>10%</span><span>90%</span>
              </div>
              <div style={{ marginTop: '.75rem', display: 'inline-flex', alignItems: 'center', gap: '.5rem', background: 'rgba(107,122,90,0.12)', border: '1px solid rgba(107,122,90,0.3)', borderRadius: '20px', padding: '.3rem .75rem', fontSize: '.72rem', fontFamily: 'var(--font-dm-mono)', color: 'var(--sage)' }}>
                <span>Blended W {blendProfile.blendedW}</span>
                <span style={{ opacity: .5 }}>·</span>
                <span>{blendProfile.hydrationDelta > 0 ? '+' : ''}{blendProfile.hydrationDelta}% hydration</span>
              </div>
            </div>
          )}

          {/* Custom flour entry */}
          <button
            onClick={() => {
              setCustomFlourOpen(v => !v);
              if (customFlourOpen) {
                setCustomName(''); setCustomW(''); setCustomProtein('');
                onBlendChange({ flour1: blend.flour1, flour2: blend.flour2, ratio1: blend.ratio1 });
              }
            }}
            style={{
              marginTop: '.75rem', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--smoke)', fontSize: '.75rem',
              fontFamily: 'var(--font-dm-sans)',
              textDecoration: 'underline', textUnderlineOffset: '2px', padding: '.2rem 0',
            }}
          >
            {customFlourOpen ? 'Cancel ✕' : 'Not listed? Add your own →'}
          </button>

          {customFlourOpen && (
            <div style={{ marginTop: '.65rem', padding: '.9rem', background: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: '120px' }}>
                  <div style={{ fontSize: '.62rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.3rem' }}>Name</div>
                  <input
                    type="text" placeholder="e.g. Farro, Spelt" value={customName}
                    onChange={e => { setCustomName(e.target.value); handleCustomChange(e.target.value, customW, customProtein, customRatio1); }}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <div style={{ width: '80px' }}>
                  <div style={{ fontSize: '.62rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.3rem' }}>W value</div>
                  <input
                    type="number" placeholder="W value" value={customW} min={50} max={500} step={10}
                    onChange={e => { const v = e.target.value === '' ? '' : Number(e.target.value); setCustomW(v); handleCustomChange(customName, v, customProtein, customRatio1); }}
                    style={{ ...inputStyle, width: '80px' }}
                  />
                </div>
                <div style={{ width: '80px' }}>
                  <div style={{ fontSize: '.62rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.3rem' }}>Protein %</div>
                  <input
                    type="number" placeholder="protein %" value={customProtein} min={5} max={20} step={0.5}
                    onChange={e => { const v = e.target.value === '' ? '' : Number(e.target.value); setCustomProtein(v); handleCustomChange(customName, customW, v, customRatio1); }}
                    style={{ ...inputStyle, width: '80px' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.35rem' }}>
                  <span style={{ fontSize: '.72rem', color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', fontWeight: 600 }}>
                    {customRatio1}% {FLOUR_DATA[blend.flour1].name}
                  </span>
                  <span style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                    {100 - customRatio1}% {customName || 'custom flour'}
                  </span>
                </div>
                <input
                  type="range" min={10} max={90} step={10} value={customRatio1}
                  onChange={e => { const r = Number(e.target.value); setCustomRatio1(r); handleCustomChange(customName, customW, customProtein, r); }}
                  style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem' }}>
                  <span>10%</span><span>90%</span>
                </div>
              </div>

              {customW !== '' && (() => {
                const f1w = FLOUR_DATA[blend.flour1].w;
                const estimated = Math.round((f1w * customRatio1 / 100) + ((customW as number) * (100 - customRatio1) / 100));
                const hydNote = estimated < 200 ? 'short ferments only' : estimated < 280 ? '24–48h ferments' : '48h+ ferments';
                return (
                  <div style={{ marginTop: '.65rem', display: 'inline-flex', alignItems: 'center', gap: '.5rem', background: 'rgba(107,122,90,0.12)', border: '1px solid rgba(107,122,90,0.3)', borderRadius: '20px', padding: '.3rem .75rem', fontSize: '.72rem', fontFamily: 'var(--font-dm-mono)', color: 'var(--sage)' }}>
                    <span>Blended W ~{estimated}</span>
                    <span style={{ opacity: .5 }}>·</span>
                    <span>{hydNote}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────
export default function FlourPicker({ blend, onBlendChange, bakeType = 'pizza', mode = 'custom', styleKey }: FlourPickerProps) {
  const [manualW, setManualW] = useState<number | ''>(blend.wOverride ?? '');
  const [selectedTile, setSelectedTile] = useState<FlourKey | 'manual'>(
    blend.wOverride ? 'manual' : blend.flour1
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [showOtherBrands, setShowOtherBrands] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [apacCountry, setApacCountry] = useState<string | null>(null);
  const [apacExpanded, setApacExpanded] = useState(false);

  const primaryFlours   = bakeType === 'bread' ? BREAD_FLOURS        : PIZZA_FLOURS;
  const secondaryFlours = bakeType === 'bread' ? BREAD_SECOND_FLOURS  : PIZZA_SECOND_FLOURS;

  function handleManualW(val: number | '') {
    setManualW(val);
    if (val !== '') {
      setSelectedTile('manual');
      onBlendChange({ flour1: blend.flour1, flour2: blend.flour2, ratio1: blend.ratio1, wOverride: val });
    }
  }

  function selectTile(key: FlourKey) {
    setSelectedTile(key);
    setManualW('');
    onBlendChange({ flour1: key, flour2: blend.flour2, ratio1: blend.ratio1 });
  }

  function selectBrandProduct(brandKey: BrandKey, product: { name: string; w: number }) {
    const autoTile: FlourKey = product.w >= 270 ? 'strong00' : 'pizza00';
    setSelectedTile(autoTile);
    setManualW('');
    onBlendChange({
      flour1: autoTile,
      flour2: blend.flour2,
      ratio1: blend.ratio1,
      wOverride: product.w,
      brandKey,
      brandProduct: product.name,
    });
  }

  return (
    <div>

      {/* ── PART 1: Flour tiles ──────────────── */}
      <div style={{ fontSize: '.65rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.55rem' }}>
        Select your flour
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.65rem' }}>

        {/* Flour tiles 1-4 */}
        {primaryFlours.map(key => {
          const f = FLOUR_DATA[key];
          const isSelected = selectedTile === key;
          return (
            <div
              key={key}
              onClick={() => selectTile(key)}
              style={{
                border: `1.5px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
                borderRadius: '12px', padding: '.8rem .9rem', cursor: 'pointer',
                background: isSelected ? '#FFF8F3' : 'var(--warm)', transition: 'all .2s',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.4rem', marginBottom: '.4rem' }}>
                <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--char)', lineHeight: 1.3 }}>{f.name}</div>
                {isSelected && <span style={{ color: 'var(--terra)', fontSize: '.8rem', flexShrink: 0 }}>✓</span>}
              </div>
              <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.4rem' }}>
                <span style={PILL}>W {f.w}</span>
                <span style={PILL}>{f.protein}% protein</span>
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.4 }}>{FLOUR_DESCS[key]}</div>
            </div>
          );
        })}

        {/* Tile 5: W value (custom mode only) */}
        {mode === 'custom' && (
          <div
            style={{
              border: `1.5px solid ${selectedTile === 'manual' ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: '12px', padding: '.8rem .9rem',
              background: selectedTile === 'manual' ? '#FFF8F3' : 'var(--cream)', transition: 'all .2s',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.4rem', marginBottom: '.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--char)', lineHeight: 1.3 }}>I know my W value</div>
              {selectedTile === 'manual' && <span style={{ color: 'var(--terra)', fontSize: '.8rem', flexShrink: 0 }}>✓</span>}
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.4 }}>Enter it directly</div>
            <input
              type="number" min={80} max={500} step={10}
              placeholder="e.g. 260"
              value={manualW}
              onChange={e => handleManualW(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                width: '80px', border: '1.5px solid var(--border)',
                borderRadius: '8px', padding: '.35rem .5rem',
                fontFamily: 'var(--font-dm-mono)', fontSize: '.85rem',
                color: 'var(--char)', background: 'var(--warm)', outline: 'none',
                marginTop: '.4rem', display: 'block',
              }}
            />
            {selectedTile === 'manual' && manualW !== '' && (() => {
              const s = wStrength(manualW as number);
              return (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', marginTop: '.4rem',
                  border: `1.5px solid ${s.color}`, borderRadius: '20px', padding: '.2rem .55rem',
                  fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)', color: s.color,
                }}>
                  W {manualW} — {s.label}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── PART 2: Iconic brands (custom only) ── */}
      {mode === 'custom' && (() => {
        // ── filter computation ──
        const base = FLOUR_DB.filter(f =>
          f.brand !== 'Caputo' && f.brand !== '5 Stagioni' && f.brand !== 'Generic'
        );
        const otherBrandsCount = new Set(base.map(f => f.brand)).size;

        let filtered = base;
        if (originFilter) filtered = filtered.filter(f => ORIGIN_GROUPS[originFilter].includes(f.country));
        if (originFilter === 'apac' && apacCountry) filtered = filtered.filter(f => f.country === apacCountry);
        if (typeFilter) {
          const groupKey = getTypeGroupKey(originFilter);
          const group = TYPE_LABEL_GROUPS[groupKey].find(g => g.label === typeFilter);
          if (group) filtered = filtered.filter(f => group.types.includes(f.type));
        }
        if (brandSearch.trim()) {
          const q = brandSearch.toLowerCase();
          filtered = filtered.filter(f => f.brand.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
        }

        const isFiltered = !!(originFilter || typeFilter || brandSearch.trim());
        const showCrowdFav = !isFiltered && !!styleKey && bakeType === 'pizza';
        const crowdFavs = showCrowdFav
          ? filtered.filter(f => f.crowdFavourite.includes(styleKey!))
          : [];
        const rest = showCrowdFav
          ? filtered.filter(f => !f.crowdFavourite.includes(styleKey!))
          : filtered;
        const restSorted = [...rest].sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
        const restByBrand: Record<string, typeof rest> = restSorted.reduce((acc, f) => {
          if (!acc[f.brand]) acc[f.brand] = [];
          acc[f.brand].push(f);
          return acc;
        }, {} as Record<string, typeof rest>);
        const brandNames = Object.keys(restByBrand).slice(0, 8);

        // ── pill style helpers ──
        const activePill: React.CSSProperties = {
          background: '#1A1612', color: 'white', borderRadius: '20px',
          padding: '.25rem .7rem', fontSize: '.72rem', cursor: 'pointer',
          border: '1px solid #1A1612', fontFamily: 'var(--font-dm-sans)',
          whiteSpace: 'nowrap' as const,
        };
        const inactivePill: React.CSSProperties = {
          background: 'transparent', color: '#8A7F78', borderRadius: '20px',
          padding: '.25rem .7rem', fontSize: '.72rem', cursor: 'pointer',
          border: '1px solid #E8E0D5', fontFamily: 'var(--font-dm-sans)',
          whiteSpace: 'nowrap' as const,
        };

        // ── flour row renderer (shared) ──
        function FlourRow({ f }: { f: typeof FLOUR_DB[0] }) {
          const isSelected = blend.brandProduct === `${f.brand} ${f.name}`;
          return (
            <div
              key={f.id}
              onClick={() => {
                const autoTile: FlourKey = f.w >= 270 ? 'strong00' : 'pizza00';
                setSelectedTile(autoTile);
                setManualW('');
                onBlendChange({
                  flour1: autoTile, flour2: blend.flour2, ratio1: blend.ratio1,
                  wOverride: f.w, brandKey: undefined, brandProduct: `${f.brand} ${f.name}`,
                });
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(196,82,42,0.06)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(196,82,42,0.06)' : 'transparent'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap',
                padding: '.35rem .5rem', borderRadius: '8px', cursor: 'pointer',
                background: isSelected ? 'rgba(196,82,42,0.06)' : 'transparent',
                transition: 'background .15s',
              }}
            >
              <span style={{ fontSize: '.82rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--terra)' : 'var(--char)' }}>
                {f.brand} {f.name}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: '20px', padding: '.1rem .5rem', color: 'var(--ash)', whiteSpace: 'nowrap' }}>
                W {f.w}
              </span>
              {f.type && TYPE_BADGE[f.type] && (
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: '20px', padding: '.1rem .5rem', color: 'var(--smoke)', whiteSpace: 'nowrap' }}>
                  {TYPE_BADGE[f.type]}
                </span>
              )}
            </div>
          );
        }

        return (
          <>
            <div style={{ fontSize: '.65rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginTop: '1.25rem', marginBottom: '.55rem' }}>
              Or pick by brand
            </div>
            {(Object.entries(FLOUR_BRANDS) as [BrandKey, typeof FLOUR_BRANDS[BrandKey]][]).map(([brandKey, brand]) => (
              <div key={brandKey} style={{
                border: '1.5px solid var(--border)', borderRadius: '14px',
                padding: '.85rem 1rem', background: 'var(--warm)', marginBottom: '.65rem',
                display: 'flex', gap: '1rem', alignItems: 'flex-start',
              }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--char)', width: '80px', flexShrink: 0, paddingTop: '.3rem' }}>
                  {brand.name} {brand.logo}
                </div>
                <div style={{ flex: 1 }}>
                  {(brand.products as readonly { name: string; w: number; protein: number; desc: string }[]).map(product => {
                    const isSelected = blend.brandKey === brandKey && blend.brandProduct === product.name;
                    return (
                      <div
                        key={product.name}
                        onClick={() => selectBrandProduct(brandKey, product)}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(196,82,42,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(196,82,42,0.06)' : 'transparent'; }}
                        style={{
                          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.4rem',
                          padding: '.35rem .5rem', borderRadius: '8px', cursor: 'pointer',
                          background: isSelected ? 'rgba(196,82,42,0.06)' : 'transparent',
                          transition: 'background .15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                          <span style={{ fontSize: '.82rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--terra)' : 'var(--char)' }}>
                            {product.name}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: '20px', padding: '.1rem .5rem', color: 'var(--ash)', whiteSpace: 'nowrap' }}>
                            W {product.w}
                          </span>
                        </div>
                        <span style={{ fontSize: '.68rem', color: 'var(--smoke)', width: '100%', marginTop: '.1rem', lineHeight: 1.3 }}>{product.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Other brands toggle */}
            <button
              onClick={() => setShowOtherBrands(v => !v)}
              style={{
                marginTop: '.75rem', width: '100%', padding: '.55rem 1rem',
                border: '1.5px solid var(--border)', borderRadius: '12px',
                background: 'transparent', color: 'var(--smoke)', fontSize: '.8rem',
                fontFamily: 'var(--font-dm-sans)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>🔍 Other brands</span>
              <span style={{ fontSize: '.7rem', fontFamily: 'var(--font-dm-mono)' }}>
                {showOtherBrands ? '▲ Hide' : `${otherBrandsCount} brands ▼`}
              </span>
            </button>

            {showOtherBrands && (
              <div style={{ marginTop: '.75rem' }}>

                {/* Search */}
                <input
                  type="text"
                  placeholder="Search brand or product..."
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '.4rem .7rem', marginBottom: '.75rem',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    fontSize: '.8rem', fontFamily: 'var(--font-dm-sans)',
                    background: 'var(--warm)', color: 'var(--char)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                {/* Origin filter */}
                <div style={{ fontSize: '11px', color: '#8A7F78', marginBottom: '6px' }}>
                  Where the flour is from
                </div>
                <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.55rem' }}>
                  {ORIGIN_PILLS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => {
                        const next = originFilter === p.key ? null : p.key;
                        setOriginFilter(next);
                        setTypeFilter(null);
                        setApacCountry(null);
                        setApacExpanded(false);
                      }}
                      style={originFilter === p.key ? activePill : inactivePill}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* APAC sub-row */}
                {originFilter === 'apac' && (
                  <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', marginBottom: '.55rem', paddingLeft: '.5rem' }}>
                    <button
                      onClick={() => setApacCountry(null)}
                      style={apacCountry === null ? activePill : inactivePill}
                    >All</button>
                    {APAC_CHIPS.map(c => (
                      <button
                        key={c.code}
                        onClick={() => setApacCountry(apacCountry === c.code ? null : c.code)}
                        style={apacCountry === c.code ? activePill : inactivePill}
                      >
                        {c.label}
                      </button>
                    ))}
                    {!apacExpanded ? (
                      <button onClick={() => setApacExpanded(true)} style={inactivePill}>More…</button>
                    ) : (
                      APAC_MORE_CODES.map(code => (
                        <button
                          key={code}
                          onClick={() => setApacCountry(apacCountry === code ? null : code)}
                          style={apacCountry === code ? activePill : inactivePill}
                        >
                          {FLAGS[code] ?? code}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Type filter (adaptive) */}
                {(() => {
                  const groupKey = getTypeGroupKey(originFilter);
                  const groups = TYPE_LABEL_GROUPS[groupKey];
                  return (
                    <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.65rem' }}>
                      {groups.map(g => (
                        <button
                          key={g.label}
                          onClick={() => setTypeFilter(typeFilter === g.label ? null : g.label)}
                          style={typeFilter === g.label ? activePill : inactivePill}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Clear filters */}
                {(originFilter || typeFilter) && (
                  <button
                    onClick={() => { setOriginFilter(null); setTypeFilter(null); setApacCountry(null); setApacExpanded(false); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#C4522A', padding: '0 0 .6rem 0', display: 'block' }}
                  >
                    Clear filters
                  </button>
                )}

                {/* Crowd favourites section */}
                {showCrowdFav && crowdFavs.length > 0 && (
                  <div style={{ marginBottom: '.85rem' }}>
                    <div style={{ fontSize: '.62rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.45rem' }}>
                      ✨ Popular for {STYLE_DISPLAY[styleKey!] ?? styleKey}
                    </div>
                    <div style={{ border: '1.5px solid rgba(212,168,83,0.3)', borderRadius: '14px', padding: '.65rem .85rem', background: 'rgba(212,168,83,0.05)' }}>
                      {crowdFavs.map(f => <FlourRow key={f.id} f={f} />)}
                    </div>
                  </div>
                )}

                {/* Results list */}
                {brandNames.length === 0 && crowdFavs.length === 0 ? (
                  <div style={{ fontSize: '.8rem', color: 'var(--smoke)', textAlign: 'center', padding: '1rem' }}>
                    No flours match your filters.
                  </div>
                ) : brandNames.map(brandName => {
                  const products = restByBrand[brandName];
                  const sampleCountry = products[0]?.country ?? 'us';
                  const samplePublished = products[0]?.wPublished;
                  return (
                    <div key={brandName} style={{
                      border: '1.5px solid var(--border)', borderRadius: '14px',
                      padding: '.85rem 1rem', background: 'var(--warm)', marginBottom: '.65rem',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--char)', marginBottom: '.3rem' }}>
                        {FLAGS[sampleCountry] ?? ''} {brandName}
                        {samplePublished === false && (
                          <span style={{ fontSize: '.6rem', color: 'var(--smoke)', fontStyle: 'italic', marginLeft: '.3rem' }}>~est</span>
                        )}
                      </div>
                      {products.map(f => <FlourRow key={f.id} f={f} />)}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      {/* ── PART 3: Scan button (custom only) ─── */}
      {mode === 'custom' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setScanOpen(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: '.4rem',
                border: '1.5px solid var(--border)', borderRadius: '20px',
                padding: '.35rem .85rem', background: 'none',
                fontSize: '.75rem', fontFamily: 'var(--font-dm-sans)',
                color: 'var(--smoke)', cursor: 'pointer', marginTop: '.75rem',
              }}
            >
              📷 Scan my bag — camera or photo library
            </button>
          </div>
          {scanOpen && (
            <FlourScan
              onResult={result => {
                setManualW(result.w);
                setSelectedTile('manual');
                onBlendChange({ ...blend, wOverride: result.w });
                setScanOpen(false);
              }}
              onCancel={() => setScanOpen(false)}
            />
          )}
        </>
      )}

      {/* ── PART 4: Blend section (custom only) ── */}
      {mode === 'custom' && (
        <BlendSection
          blend={blend}
          onBlendChange={onBlendChange}
          primaryFlours={primaryFlours}
          secondaryFlours={secondaryFlours}
        />
      )}

    </div>
  );
}
