'use client';
import { useState, useEffect, useRef } from 'react';
import { FLOUR_DATA, type FlourKey, type FlourBlend, computeBlendProfile } from '../data';
import FlourScan from './FlourScan';
import { FLOUR_DB, type FlourEntry } from '@/lib/flourDatabase';

// ── Flour lists (used by BlendSection) ────────────
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

// ── Crowd favourite IDs ───────────────────────────
const CROWD_FAV_IDS = [
  'caputo_pizzeria', 'caputo_cuoco', 'caputo_nuvola',
  'stagioni_napoletana', 'stagioni_superiore',
];

// ── Origin groups (display-label keyed) ──────────
const ORIGIN_GROUPS: Record<string, string[]> = {
  'France':       ['fr'],
  'Italy':        ['it'],
  'UK':           ['uk'],
  'Americas':     ['us', 'ca', 'br', 'mx', 'ar'],
  'Europe':       ['de', 'nl', 'se', 'no', 'fi', 'pl', 'at'],
  'Asia-Pacific': ['jp', 'cn', 'kr', 'sg', 'au', 'in', 'th', 'id', 'my', 'vn', 'ph'],
};

// ── Type display labels ───────────────────────────
const TYPE_LABELS: Record<string, string> = {
  '00': '00', '0': '0', '1': 'Tipo 1', '2': 'Tipo 2',
  'T45': 'T45', 'T55': 'T55', 'T65': 'T65', 'T80': 'T80',
  'T110': 'T110', 'T150': 'T150',
  'bread': 'Bread', 'all_purpose': 'All-purpose',
  'high_gluten': 'High gluten', 'wholemeal': 'Wholemeal',
  'rye': 'Rye', 'spelt': 'Spelt', 'semolina': 'Semolina',
};

// ── Quick pick type list ──────────────────────────
const QUICK_TYPES = [
  { label: '00 (soft)',    w: 260, protein: 12.0 },
  { label: '0',           w: 240, protein: 11.5 },
  { label: 'T45 / Gruau', w: 310, protein: 13.0 },
  { label: 'T55',         w: 200, protein: 10.5 },
  { label: 'T65',         w: 220, protein: 11.0 },
  { label: 'T80',         w: 210, protein: 11.5 },
  { label: 'T110 / T150', w: 190, protein: 11.0 },
  { label: 'Bread flour', w: 270, protein: 12.8 },
  { label: 'All-purpose', w: 190, protein: 10.5 },
  { label: 'Wholemeal',   w: 185, protein: 12.0 },
  { label: 'Rye',         w: 160, protein: 10.0 },
  { label: 'Semolina',    w: 0,   protein: 12.5 },
];

// ── W strength helper ─────────────────────────────
function wStrength(w: number): { label: string; color: string } {
  if (w < 200) return { label: 'Weak — short ferments only', color: 'var(--smoke)' };
  if (w < 250) return { label: 'Medium — 8-24h',             color: 'var(--smoke)' };
  if (w < 300) return { label: 'Strong — 24-48h',            color: 'var(--sage)'  };
  if (w < 350) return { label: 'Very strong — 48-72h',       color: 'var(--gold)'  };
  return           { label: 'Professional — 72h+',           color: 'var(--terra)' };
}

const PILL: React.CSSProperties = {
  fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
  background: 'var(--cream)', color: 'var(--ash)',
  borderRadius: '20px', padding: '.1rem .5rem',
  border: '1px solid var(--border)',
};

// ── Props ─────────────────────────────────────────
interface FlourPickerProps {
  blend: FlourBlend;
  onBlendChange: (blend: FlourBlend) => void;
  bakeType?: 'pizza' | 'bread';
  mode?: 'simple' | 'custom';
  styleKey?: string | null;
}

// ── FlourCardGrid (used by BlendSection) ──────────
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

// ── BlendSection ──────────────────────────────────
function BlendSection({
  blend, onBlendChange, primaryFlours, secondaryFlours,
}: {
  blend: FlourBlend;
  onBlendChange: (b: FlourBlend) => void;
  primaryFlours: FlourKey[];
  secondaryFlours: FlourKey[];
}) {
  const [blendOpen, setBlendOpen] = useState(blend.flour2 !== null || !!blend.customFlour2Name);
  const [customFlourOpen, setCustomFlourOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customW, setCustomW] = useState<number | ''>('');
  const [customProtein, setCustomProtein] = useState<number | ''>('');
  const [customRatio1, setCustomRatio1] = useState(70);
  const [blendSearch, setBlendSearch] = useState('');
  const [selectedF2, setSelectedF2] = useState<FlourEntry | null>(null);
  const [dbRatio, setDbRatio] = useState(70);

  const inputStyle: React.CSSProperties = {
    padding: '.42rem .6rem', borderRadius: '8px',
    border: '1.5px solid var(--border)', background: 'var(--warm)',
    fontFamily: 'var(--font-dm-mono)', fontSize: '.88rem',
    color: 'var(--char)', outline: 'none',
  };

  const blendResults = FLOUR_DB.filter(f =>
    blendSearch
      ? (f.brand + ' ' + f.name).toLowerCase().includes(blendSearch.toLowerCase())
      : true
  ).slice(0, 50);

  function openBlend() {
    setBlendOpen(true);
    setCustomFlourOpen(false);
  }

  function closeBlend() {
    setBlendOpen(false);
    setSelectedF2(null);
    setBlendSearch('');
    onBlendChange({ flour1: blend.flour1, flour2: null, ratio1: 100 });
  }

  function selectF2(f: FlourEntry) {
    setSelectedF2(f);
    if (customFlourOpen) {
      setCustomFlourOpen(false);
      setCustomName(''); setCustomW(''); setCustomProtein('');
    }
    const f1w = FLOUR_DATA[blend.flour1].w;
    const blendedW = Math.round((f1w * dbRatio / 100) + (f.w * (100 - dbRatio) / 100));
    onBlendChange({
      flour1: blend.flour1,
      flour2: null,
      ratio1: dbRatio,
      wOverride: blendedW,
      customFlour2Name: `${f.brand} ${f.name}`,
    });
  }

  function handleDbRatioChange(ratio: number) {
    setDbRatio(ratio);
    if (selectedF2) {
      const f1w = FLOUR_DATA[blend.flour1].w;
      const blendedW = Math.round((f1w * ratio / 100) + (selectedF2.w * (100 - ratio) / 100));
      onBlendChange({
        flour1: blend.flour1,
        flour2: null,
        ratio1: ratio,
        wOverride: blendedW,
        customFlour2Name: `${selectedF2.brand} ${selectedF2.name}`,
      });
    }
  }

  function handleCustomChange(name: string, w: number | '', protein: number | '', ratio: number) {
    if (w !== '' && name.trim()) {
      const f1w = FLOUR_DATA[blend.flour1].w;
      const blendedW = Math.round((f1w * ratio / 100) + ((w as number) * (100 - ratio) / 100));
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

          {/* Confirmation label */}
          {selectedF2 && (
            <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
              Second flour: {selectedF2.brand} {selectedF2.name}
            </div>
          )}

          {/* Search input */}
          <input
            type="text"
            placeholder="Search second flour..."
            value={blendSearch}
            onChange={e => setBlendSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px',
              border: '1px solid #E8E0D5', borderRadius: '10px',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              background: 'white', outline: 'none',
              marginBottom: '8px', boxSizing: 'border-box',
            }}
          />

          {/* Scrollable results list */}
          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '0.5px solid #E8E0D5', borderRadius: '10px' }}>
            {blendResults.map(f => (
              <div
                key={f.id}
                onClick={() => selectF2(f)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: '0.5px solid #E8E0D5',
                  cursor: 'pointer',
                  background: selectedF2?.id === f.id ? '#F5F0E8' : 'white',
                }}
                onMouseEnter={e => { if (selectedF2?.id !== f.id) (e.currentTarget as HTMLDivElement).style.background = '#FDFBF7'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = selectedF2?.id === f.id ? '#F5F0E8' : 'white'; }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1612', fontFamily: 'DM Sans, sans-serif' }}>{f.brand}</div>
                  <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>{f.name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '13px', fontFamily: 'var(--font-dm-mono)', color: f.wPublished ? '#1A1612' : '#8A7F78' }}>
                    {f.wPublished ? `W${f.w}` : `~W${f.w}`}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-dm-mono)' }}>
                    {f.protein}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ratio slider — shown when a DB entry is selected */}
          {selectedF2 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.4rem' }}>
                <span style={{ fontSize: '.75rem', color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', fontWeight: 600 }}>
                  {dbRatio}% {FLOUR_DATA[blend.flour1].name}
                </span>
                <span style={{ fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                  {100 - dbRatio}% {selectedF2.name}
                </span>
              </div>
              <input
                type="range" min={10} max={90} step={10} value={dbRatio}
                onChange={e => handleDbRatioChange(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem' }}>
                <span>10%</span><span>90%</span>
              </div>
              <div style={{ marginTop: '.75rem', display: 'inline-flex', alignItems: 'center', gap: '.5rem', background: 'rgba(107,122,90,0.12)', border: '1px solid rgba(107,122,90,0.3)', borderRadius: '20px', padding: '.3rem .75rem', fontSize: '.72rem', fontFamily: 'var(--font-dm-mono)', color: 'var(--sage)' }}>
                <span>Blended W {Math.round((FLOUR_DATA[blend.flour1].w * dbRatio / 100) + (selectedF2.w * (100 - dbRatio) / 100))}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setCustomFlourOpen(v => !v);
              if (customFlourOpen) {
                setCustomName(''); setCustomW(''); setCustomProtein('');
                onBlendChange({ flour1: blend.flour1, flour2: null, ratio1: blend.ratio1 });
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

// ── Main component ────────────────────────────────
export default function FlourPicker({ blend, onBlendChange, bakeType = 'pizza', mode = 'custom', styleKey }: FlourPickerProps) {
  // Accordion
  const [openSection, setOpenSection] = useState<'quick' | 'search' | 'blend' | null>('search');

  // Quick pick sub-state
  const [quickSub, setQuickSub] = useState<'scan' | 'type' | 'manual' | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [manualQW, setManualQW] = useState<number | null>(null);

  // Search section filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterOrigin, setFilterOrigin] = useState<string | null>(null);
  const [filterManufacturer, setFilterManufacturer] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'type' | 'origin' | 'manufacturer' | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeDropdown) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [activeDropdown]);

  const primaryFlours   = bakeType === 'bread' ? BREAD_FLOURS       : PIZZA_FLOURS;
  const secondaryFlours = bakeType === 'bread' ? BREAD_SECOND_FLOURS : PIZZA_SECOND_FLOURS;

  function selectDBEntry(f: FlourEntry) {
    const autoTile: FlourKey = f.w >= 270 ? 'strong00' : 'pizza00';
    onBlendChange({
      flour1: autoTile,
      flour2: blend.flour2,
      ratio1: blend.ratio1,
      wOverride: f.w,
      brandKey: undefined,
      brandProduct: `${f.brand} ${f.name}`,
    });
  }

  function applyQuickType(label: string, w: number) {
    const autoTile: FlourKey = w >= 270 ? 'strong00' : 'pizza00';
    onBlendChange({
      flour1: autoTile,
      flour2: blend.flour2,
      ratio1: blend.ratio1,
      wOverride: w,
      brandKey: undefined,
      brandProduct: label,
    });
  }

  // ── Dynamic filter options ──
  const baseFiltered = (excl: ('type' | 'origin' | 'manufacturer')[]) =>
    FLOUR_DB
      .filter(f => !searchQuery || `${f.brand} ${f.name}`.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(f => excl.includes('type') || !filterType ? true : f.type === filterType)
      .filter(f => excl.includes('origin') || !filterOrigin ? true : (ORIGIN_GROUPS[filterOrigin] ?? []).includes(f.country))
      .filter(f => excl.includes('manufacturer') || !filterManufacturer ? true : f.brand === filterManufacturer);

  const typeOptions = [...new Set(baseFiltered(['type']).map(f => f.type))].sort();
  const originOptions = Object.keys(ORIGIN_GROUPS).filter(g =>
    baseFiltered(['origin']).some(f => ORIGIN_GROUPS[g].includes(f.country))
  );
  const mfgOptions = [...new Set(baseFiltered(['manufacturer']).map(f => f.brand))].sort();

  const results = baseFiltered([])
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  // ── Section header factory ──
  const sectionHeader = (label: string, key: 'quick' | 'search' | 'blend') => (
    <div
      onClick={() => setOpenSection(openSection === key ? null : key)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', cursor: 'pointer',
        borderBottom: openSection === key ? 'none' : '1px solid #E8E0D5',
        fontFamily: 'var(--font-dm-sans)', fontSize: '14px', fontWeight: 500,
        color: '#1A1612',
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: '12px', color: '#8A7F78' }}>{openSection === key ? '▾' : '▸'}</span>
    </div>
  );

  // ── Sub-option row style ──
  const subRowStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: '10px',
    background: '#F5F0E8', marginBottom: '6px',
    cursor: 'pointer', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
    fontSize: '13px', color: '#1A1612',
  };

  // ── Filter chip style ──
  const chipStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#1A1612' : '#F5F0E8',
    color: active ? 'white' : '#3D3530',
    borderRadius: '20px', padding: '5px 12px',
    fontSize: '12px', fontWeight: 500, border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
  });

  return (
    <div>

      {/* ══ SECTION 1: Quick pick ══════════════════ */}
      <div style={{ borderBottom: openSection === 'quick' ? '1px solid #E8E0D5' : undefined }}>
        {sectionHeader('Quick pick', 'quick')}
        {openSection === 'quick' && (
          <div style={{ paddingTop: '10px', paddingBottom: '14px' }}>

            {/* A) Scan your bag */}
            <div
              style={subRowStyle}
              onClick={() => {
                setQuickSub(quickSub === 'scan' ? null : 'scan');
                setScanOpen(s => !s);
              }}
            >
              <span>📷 Scan your bag</span>
              <span style={{ fontSize: '12px', color: '#8A7F78' }}>→</span>
            </div>
            {scanOpen && (
              <div style={{ marginBottom: '8px' }}>
                <FlourScan
                  onResult={result => {
                    const autoTile: FlourKey = result.w >= 270 ? 'strong00' : 'pizza00';
                    onBlendChange({ ...blend, flour1: autoTile, wOverride: result.w });
                    setScanOpen(false);
                    setQuickSub(null);
                  }}
                  onCancel={() => { setScanOpen(false); setQuickSub(null); }}
                />
              </div>
            )}

            {/* or separator A→B */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#8A7F78', padding: '2px 0', fontFamily: 'DM Sans, sans-serif' }}>or</div>

            {/* B) Select by type */}
            <div
              style={{ ...subRowStyle, marginBottom: '0' }}
              onClick={() => setQuickSub(quickSub === 'type' ? null : 'type')}
            >
              <span>Select by type</span>
              <span style={{ fontSize: '12px', color: '#8A7F78' }}>{quickSub === 'type' ? '▾' : '▸'}</span>
            </div>
            {quickSub === 'type' && (
              <div style={{ background: '#F5F0E8', borderRadius: '0 0 10px 10px', padding: '4px 0 6px', marginBottom: '6px' }}>
                {QUICK_TYPES.map(t => {
                  const isSelected = blend.brandProduct === t.label;
                  return (
                    <div
                      key={t.label}
                      onClick={() => applyQuickType(t.label, t.w)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', cursor: 'pointer',
                        background: isSelected ? 'rgba(196,82,42,0.08)' : 'transparent',
                        borderRadius: '8px', margin: '0 4px',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: isSelected ? '#C4522A' : '#1A1612', fontWeight: isSelected ? 600 : 400 }}>
                        {t.label}
                      </span>
                      <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-dm-mono)' }}>
                        {t.w > 0 ? `W~${t.w}` : '—'} · ~{t.protein}% protein
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* or separator B→C */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#8A7F78', padding: '2px 0', fontFamily: 'DM Sans, sans-serif' }}>or</div>

            {/* C) I know my W value — always visible, live apply */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: '#F5F0E8' }}>
              <span style={{ fontSize: '13px', color: '#3D3530', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>I know my W value</span>
              <input
                type="number"
                placeholder="e.g. 280"
                min={100} max={450}
                value={manualQW ?? ''}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 100 && v <= 450) {
                    setManualQW(v);
                    const autoTile: FlourKey = v >= 270 ? 'strong00' : 'pizza00';
                    onBlendChange({
                      flour1: autoTile, flour2: blend.flour2, ratio1: blend.ratio1,
                      wOverride: v, brandKey: undefined, brandProduct: `Custom W${v}`,
                    });
                  } else if (e.target.value === '') {
                    setManualQW(null);
                  }
                }}
                style={{
                  width: '80px', padding: '6px 10px',
                  border: '1.5px solid #E8E0D5', borderRadius: '8px',
                  fontFamily: 'var(--font-dm-mono)', fontSize: '14px',
                  fontWeight: 700, color: '#1A1612',
                  background: 'white', outline: 'none', textAlign: 'center',
                }}
              />
              {manualQW !== null && (() => {
                const s = wStrength(manualQW);
                return <span style={{ fontSize: '11px', fontFamily: 'var(--font-dm-mono)', color: s.color }}>{s.label}</span>;
              })()}
            </div>

          </div>
        )}
      </div>

      {/* ══ SECTION 2: Find your flour ════════════ */}
      <div style={{ borderBottom: '1px solid #E8E0D5' }}>
        {sectionHeader('Find your flour', 'search')}
        {openSection === 'search' && (
          <div style={{ paddingTop: '12px', paddingBottom: '14px' }}>

            {/* Search bar + filter chips — single row */}
            <div ref={dropdownRef} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search flour..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1, padding: '8px 12px',
                    border: '1px solid #E8E0D5', borderRadius: '10px',
                    fontSize: '13px', fontFamily: 'var(--font-dm-sans)',
                    background: 'white', outline: 'none', minWidth: 0,
                    color: '#1A1612',
                  }}
                />

                {/* Type chip */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}
                    style={{
                      padding: '7px 10px', borderRadius: '20px',
                      border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                      background: !!filterType ? '#1A1612' : '#F5F0E8',
                      color: !!filterType ? 'white' : '#3D3530',
                      whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px',
                    }}
                  >
                    Type ▾
                  </button>
                  {activeDropdown === 'type' && (
                    <div style={{
                      position: 'absolute', zIndex: 50, top: '100%', left: 0, marginTop: '4px',
                      background: 'white', borderRadius: '12px',
                      border: '1px solid #E8E0D5',
                      boxShadow: '0 4px 16px rgba(26,22,18,0.10)',
                      padding: '8px', minWidth: '160px', maxHeight: '240px', overflowY: 'auto',
                    }}>
                      {typeOptions.map(type => (
                        <div
                          key={type}
                          onClick={() => { setFilterType(filterType === type ? null : type); setActiveDropdown(null); }}
                          style={{ padding: '7px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: filterType === type ? '#C4522A' : '#1A1612', fontWeight: filterType === type ? 500 : 400, background: 'transparent' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F5F0E8'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          {TYPE_LABELS[type] ?? type}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Origin chip */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'origin' ? null : 'origin')}
                    style={{
                      padding: '7px 10px', borderRadius: '20px',
                      border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                      background: !!filterOrigin ? '#1A1612' : '#F5F0E8',
                      color: !!filterOrigin ? 'white' : '#3D3530',
                      whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px',
                    }}
                  >
                    Origin ▾
                  </button>
                  {activeDropdown === 'origin' && (
                    <div style={{
                      position: 'absolute', zIndex: 50, top: '100%', left: 0, marginTop: '4px',
                      background: 'white', borderRadius: '12px',
                      border: '1px solid #E8E0D5',
                      boxShadow: '0 4px 16px rgba(26,22,18,0.10)',
                      padding: '8px', minWidth: '160px', maxHeight: '240px', overflowY: 'auto',
                    }}>
                      {originOptions.map(origin => (
                        <div
                          key={origin}
                          onClick={() => { setFilterOrigin(filterOrigin === origin ? null : origin); setActiveDropdown(null); }}
                          style={{ padding: '7px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: filterOrigin === origin ? '#C4522A' : '#1A1612', fontWeight: filterOrigin === origin ? 500 : 400, background: 'transparent' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F5F0E8'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          {origin}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Brand chip */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'manufacturer' ? null : 'manufacturer')}
                    style={{
                      padding: '7px 10px', borderRadius: '20px',
                      border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                      background: !!filterManufacturer ? '#1A1612' : '#F5F0E8',
                      color: !!filterManufacturer ? 'white' : '#3D3530',
                      whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px',
                    }}
                  >
                    Brand ▾
                  </button>
                  {activeDropdown === 'manufacturer' && (
                    <div style={{
                      position: 'absolute', zIndex: 50, top: '100%', right: 0, marginTop: '4px',
                      background: 'white', borderRadius: '12px',
                      border: '1px solid #E8E0D5',
                      boxShadow: '0 4px 16px rgba(26,22,18,0.10)',
                      padding: '8px', minWidth: '160px', maxHeight: '240px', overflowY: 'auto',
                    }}>
                      {mfgOptions.map(mfg => (
                        <div
                          key={mfg}
                          onClick={() => { setFilterManufacturer(filterManufacturer === mfg ? null : mfg); setActiveDropdown(null); }}
                          style={{ padding: '7px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: filterManufacturer === mfg ? '#C4522A' : '#1A1612', fontWeight: filterManufacturer === mfg ? 500 : 400, background: 'transparent' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F5F0E8'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          {mfg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Active filter tags (FP4) */}
            {(filterType || filterOrigin || filterManufacturer) && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                {filterType && (
                  <span style={{ fontSize: '11px', background: '#F5F0E8', borderRadius: '12px', padding: '3px 8px', display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#3D3530' }}>
                    Type: {TYPE_LABELS[filterType] ?? filterType}
                    <span style={{ cursor: 'pointer', color: '#8A7F78' }} onClick={() => setFilterType(null)}>×</span>
                  </span>
                )}
                {filterOrigin && (
                  <span style={{ fontSize: '11px', background: '#F5F0E8', borderRadius: '12px', padding: '3px 8px', display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#3D3530' }}>
                    Origin: {filterOrigin}
                    <span style={{ cursor: 'pointer', color: '#8A7F78' }} onClick={() => setFilterOrigin(null)}>×</span>
                  </span>
                )}
                {filterManufacturer && (
                  <span style={{ fontSize: '11px', background: '#F5F0E8', borderRadius: '12px', padding: '3px 8px', display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#3D3530' }}>
                    Brand: {filterManufacturer}
                    <span style={{ cursor: 'pointer', color: '#8A7F78' }} onClick={() => setFilterManufacturer(null)}>×</span>
                  </span>
                )}
                {[filterType, filterOrigin, filterManufacturer].filter(Boolean).length > 1 && (
                  <span
                    style={{ fontSize: '11px', color: '#C4522A', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    onClick={() => { setFilterType(null); setFilterOrigin(null); setFilterManufacturer(null); }}
                  >
                    Clear all
                  </span>
                )}
              </div>
            )}

            {/* Results list — crowd favs when no filter, filtered otherwise */}
            {(() => {
              const noFiltersActive = !searchQuery && !filterType && !filterOrigin && !filterManufacturer;
              const displayList: FlourEntry[] = noFiltersActive
                ? CROWD_FAV_IDS.map(id => FLOUR_DB.find(f => f.id === id)).filter(Boolean) as FlourEntry[]
                : results;

              if (displayList.length === 0) {
                return (
                  <div style={{ fontSize: '13px', color: '#8A7F78', textAlign: 'center', padding: '16px 0' }}>
                    No flours match your filters.
                  </div>
                );
              }
              return (
                <div>
                  {!noFiltersActive && (
                    <div style={{ fontSize: '11px', color: '#8A7F78', marginBottom: '6px', fontFamily: 'DM Sans, sans-serif' }}>
                      {displayList.length} flour{displayList.length !== 1 ? 's' : ''} found
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
                          padding: '10px 0', borderBottom: '0.5px solid #E8E0D5',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(196,82,42,0.04)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#FDFBF7'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(196,82,42,0.04)' : 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? '#C4522A' : '#1A1612', fontFamily: 'DM Sans, sans-serif' }}>
                            {f.brand}
                          </div>
                          <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>{f.name}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13px', fontFamily: 'var(--font-dm-mono)', color: f.wPublished ? '#1A1612' : '#8A7F78' }}>
                            {f.wPublished ? `W${f.w}` : `~W${f.w}`}
                          </div>
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-dm-mono)' }}>
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
          </div>
        )}
      </div>

      {/* ══ SECTION 3: Blend (custom mode only) ══ */}
      {mode === 'custom' && (
        <div>
          {sectionHeader('Blend: Add a second flour', 'blend')}
          {openSection === 'blend' && (
            <div style={{ paddingTop: '10px', paddingBottom: '14px' }}>
              <BlendSection
                blend={blend}
                onBlendChange={onBlendChange}
                primaryFlours={primaryFlours}
                secondaryFlours={secondaryFlours}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
