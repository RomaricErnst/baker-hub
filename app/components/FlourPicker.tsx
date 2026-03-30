'use client';
import { useState, useEffect, useRef } from 'react';
import { type FlourKey, type FlourBlend } from '../data';
import FlourScan from './FlourScan';
import { FLOUR_DB, type FlourEntry } from '@/lib/flourDatabase';

// ── Crowd favourite IDs ───────────────────────────
const CROWD_FAV_IDS = [
  'caputo_pizzeria', 'caputo_cuoco', 'caputo_nuvola',
  'stagioni_napoletana', 'stagioni_superiore',
];

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
  { code: 'sg', flag: '🇸🇬', name: 'Singapore' },
  { code: 'jp', flag: '🇯🇵', name: 'Japan' },
  { code: 'kr', flag: '🇰🇷', name: 'Korea' },
  { code: 'au', flag: '🇦🇺', name: 'Australia' },
  { code: 'in', flag: '🇮🇳', name: 'India' },
  { code: 'id', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'my', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'th', flag: '🇹🇭', name: 'Thailand' },
  { code: 'ph', flag: '🇵🇭', name: 'Philippines' },
  { code: 'vn', flag: '🇻🇳', name: 'Vietnam' },
  { code: 'cn', flag: '🇨🇳', name: 'China' },
];

// ── Europe country sub-filter ────────────────────
const EUROPE_COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: 'de', flag: '🇩🇪', name: 'Germany' },
  { code: 'nl', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'se', flag: '🇸🇪', name: 'Sweden' },
  { code: 'no', flag: '🇳🇴', name: 'Norway' },
  { code: 'fi', flag: '🇫🇮', name: 'Finland' },
  { code: 'pl', flag: '🇵🇱', name: 'Poland' },
  { code: 'at', flag: '🇦🇹', name: 'Austria' },
];

// ── Americas country sub-filter ──────────────────
const AMERICAS_COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: 'us', flag: '🇺🇸', name: 'United States' },
  { code: 'ca', flag: '🇨🇦', name: 'Canada' },
  { code: 'br', flag: '🇧🇷', name: 'Brazil' },
  { code: 'mx', flag: '🇲🇽', name: 'Mexico' },
  { code: 'ar', flag: '🇦🇷', name: 'Argentina' },
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
export default function FlourPicker({ blend, onBlendChange, bakeType = 'pizza', mode = 'custom', styleKey }: FlourPickerProps) {
  // Accordion
  const [openSection, setOpenSection] = useState<'search' | 'blend' | null>('search');

  // Scan state
  const [scanOpen, setScanOpen] = useState(false);

  // "I know my type or W value" collapsible in Section 2
  const [typeWOpen, setTypeWOpen] = useState(false);
  const [quickSub, setQuickSub] = useState<'type' | null>(null);
  const [manualQW, setManualQW] = useState<number | null>(null);

  // Search section filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterOrigin, setFilterOrigin] = useState<string | null>(null);
  const [filterManufacturer, setFilterManufacturer] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'type' | 'origin' | 'manufacturer' | null>(null);

  // APAC + Europe sub-filter + blend state
  const [apacCountry, setApacCountry] = useState<string | null>(null);
  const [europeCountry, setEuropeCountry] = useState<string | null>(null);
  const [americasCountry, setAmericasCountry] = useState<string | null>(null);
  const [blendApacCountry, setBlendApacCountry] = useState<string | null>(null);
  const [blendEuropeCountry, setBlendEuropeCountry] = useState<string | null>(null);
  const [blendAmericasCountry, setBlendAmericasCountry] = useState<string | null>(null);
  const [blendSearchQuery, setBlendSearchQuery] = useState('');
  const [blendFilterType, setBlendFilterType] = useState<string | null>(null);
  const [blendFilterOrigin, setBlendFilterOrigin] = useState<string | null>(null);
  const [blendFilterBrand, setBlendFilterBrand] = useState<string | null>(null);
  const [blendSelectedF2, setBlendSelectedF2] = useState<FlourEntry | null>(null);
  const [blendRatio, setBlendRatio] = useState(85);
  const [blendShowFullSearch, setBlendShowFullSearch] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const blendRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (openSection === 'blend' && blendRef.current) {
      const rect = blendRef.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        setTimeout(() => blendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
      }
    }
  }, [openSection]);

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
        fontFamily: 'var(--font-dm-sans)', fontSize: '14px', fontWeight: 500,
        color: '#1A1612',
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: '12px', color: '#8A7F78' }}>{openSection === key ? '▾' : '▸'}</span>
    </div>
  );

  return (
    <div>

      {/* ══ SECTION 1: Scan (standalone hero) ════════ */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => { setScanOpen(s => !s); }}
          style={{
            width: '100%', padding: '13px 16px',
            borderRadius: '12px', border: '1.5px solid #E8E0D5',
            background: '#FDFBF7', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📷</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1612', fontFamily: 'DM Sans, sans-serif' }}>Scan your bag</div>
              <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>Point your camera at any flour bag</div>
            </div>
          </div>
          <span style={{ fontSize: '16px', color: '#C4522A' }}>→</span>
        </button>
        {scanOpen && (
          <div style={{ marginTop: '8px' }}>
            <FlourScan
              onResult={result => {
                const autoTile: FlourKey = result.w >= 270 ? 'strong00' : 'pizza00';
                onBlendChange({ ...blend, flour1: autoTile, wOverride: result.w });
                setScanOpen(false);
              }}
              onCancel={() => setScanOpen(false)}
            />
          </div>
        )}
      </div>

      {/* ══ SECTION 2: Find your flour ════════════════ */}
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
                          onClick={() => { setFilterOrigin(filterOrigin === origin ? null : origin); setApacCountry(null); setEuropeCountry(null); setAmericasCountry(null); setActiveDropdown(null); }}
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

            {/* APAC country sub-filter pills */}
            {filterOrigin === 'Asia-Pacific' && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px' }}>
                {APAC_COUNTRIES.map(({ code, flag, name }) => (
                  <button
                    key={code}
                    onClick={() => setApacCountry(apacCountry === code ? null : code)}
                    title={name}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '20px',
                      border: apacCountry === code ? '1.5px solid #C4522A' : '1px solid #E8E0D5',
                      background: apacCountry === code ? '#FDF0EB' : 'transparent',
                      fontSize: '18px',
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
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px' }}>
                {EUROPE_COUNTRIES.map(({ code, flag, name }) => (
                  <button
                    key={code}
                    onClick={() => setEuropeCountry(europeCountry === code ? null : code)}
                    title={name}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '20px',
                      border: europeCountry === code ? '1.5px solid #C4522A' : '1px solid #E8E0D5',
                      background: europeCountry === code ? '#FDF0EB' : 'transparent',
                      fontSize: '18px',
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
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px' }}>
                {AMERICAS_COUNTRIES.map(({ code, flag, name }) => (
                  <button
                    key={code}
                    onClick={() => setAmericasCountry(americasCountry === code ? null : code)}
                    title={name}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '20px',
                      border: americasCountry === code ? '1.5px solid #C4522A' : '1px solid #E8E0D5',
                      background: americasCountry === code ? '#FDF0EB' : 'transparent',
                      fontSize: '18px',
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
                    <span style={{ cursor: 'pointer', color: '#8A7F78' }} onClick={() => { setFilterOrigin(null); setApacCountry(null); setEuropeCountry(null); setAmericasCountry(null); }}>×</span>
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
                    onClick={() => { setFilterType(null); setFilterOrigin(null); setFilterManufacturer(null); setApacCountry(null); setEuropeCountry(null); setAmericasCountry(null); }}
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

            {/* ── I know my type or W value ── */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #E8E0D5', paddingTop: '10px' }}>
              <div
                onClick={() => { setTypeWOpen(o => !o); if (typeWOpen) setQuickSub(null); }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#3D3530', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}
              >
                <span>Don&apos;t see your flour? Enter type or W</span>
                <span style={{ fontSize: '11px', color: '#8A7F78' }}>{typeWOpen ? '▾' : '▸'}</span>
              </div>

              {typeWOpen && (
                <div style={{ paddingTop: '10px' }}>
                  {/* Select by type */}
                  <div
                    onClick={() => setQuickSub(quickSub === 'type' ? null : 'type')}
                    style={{ padding: '10px 12px', borderRadius: '10px', background: '#F5F0E8', marginBottom: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#1A1612' }}
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

                  {/* or separator */}
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#8A7F78', padding: '2px 0', fontFamily: 'DM Sans, sans-serif' }}>or</div>

                  {/* I know my W value */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: '#F5F0E8', marginTop: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#3D3530', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>I know my W value</span>
                    <input
                      type="number"
                      inputMode="numeric"
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
                        width: '80px', padding: '0 12px',
                        height: '44px',
                        border: '1.5px solid #E8E0D5', borderRadius: '8px',
                        fontFamily: 'var(--font-dm-mono)', fontSize: '16px',
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

          </div>
        )}
      </div>

      {/* ══ SECTION 3: Blend (custom mode only) ══════ */}
      {mode === 'custom' && (
        <div ref={blendRef}>
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
              padding: '12px 0', cursor: 'pointer',
              borderTop: '2px solid #E8E0D5',
              marginTop: '8px',
              fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 500,
              color: '#8A7F78',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Blend: Add a second flour</span>
              <span style={{
                fontSize: '10px', fontFamily: 'DM Sans, sans-serif',
                background: '#F5F0E8', color: '#8A7F78',
                borderRadius: '20px', padding: '1px 7px',
                border: '1px solid #E8E0D5',
              }}>optional</span>
            </div>
            <span style={{ fontSize: '12px', color: '#8A7F78' }}>{openSection === 'blend' ? '▾' : '›'}</span>
          </div>
          {openSection === 'blend' && (
            <div style={{ paddingTop: '10px', paddingBottom: '14px', scrollMarginTop: '80px' }}>

              {/* If flour2 selected: show confirmation + ratio slider */}
              {blendSelectedF2 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1A1612', fontFamily: 'DM Sans, sans-serif' }}>
                        {blendSelectedF2.brand ? `${blendSelectedF2.brand} ${blendSelectedF2.name}` : blendSelectedF2.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>
                        W{blendSelectedF2.w} · {blendSelectedF2.protein}% protein
                      </div>
                    </div>
                    <button
                      onClick={() => { setBlendSelectedF2(null); setBlendShowFullSearch(false); setBlendSearchQuery(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '12px', textDecoration: 'underline' }}
                    >
                      Change
                    </button>
                  </div>
                  {/* Ratio slider */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '6px' }}>
                      <span>Main flour {blendRatio}%</span>
                      <span>{blendSelectedF2.name} {100 - blendRatio}%</span>
                    </div>
                    <input
                      type="range" min={60} max={95} step={5}
                      value={blendRatio}
                      onChange={e => {
                        const r = +e.target.value;
                        setBlendRatio(r);
                        const f1w = blend.wOverride ?? 260;
                        const blendedW = Math.round((f1w * r / 100) + (blendSelectedF2.w * (100 - r) / 100));
                        onBlendChange({ ...blend, ratio1: r, wOverride: blendedW, customFlour2Name: `${blendSelectedF2.brand} ${blendSelectedF2.name}` });
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <button
                    onClick={() => { setBlendSelectedF2(null); onBlendChange({ ...blend, flour2: null, ratio1: 100, customFlour2Name: undefined }); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                  >
                    Remove blend
                  </button>
                </div>
              ) : (
                <div>
                  {/* Preset chips — only if styleKey has presets */}
                  {styleKey && BLEND_PRESETS[styleKey] && BLEND_PRESETS[styleKey].length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
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
                                setBlendSelectedF2(genericEntry);
                                setBlendRatio(preset.ratio);
                                const f1w = blend.wOverride ?? 260;
                                const blendedW = Math.round((f1w * preset.ratio / 100) + (generic.w * (100 - preset.ratio) / 100));
                                onBlendChange({ ...blend, ratio1: preset.ratio, wOverride: blendedW, customFlour2Name: generic.label });
                              }
                            }}
                            style={{
                              padding: '6px 12px', borderRadius: '20px',
                              border: '1.5px solid #E8E0D5', background: '#FDFBF7',
                              fontSize: '13px', color: '#3D3530',
                              fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '12px' }}>
                    {/* Row 1 — Label + full-width search input */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '6px' }}>
                        Or find a specific brand:
                      </div>
                      <input
                        type="text"
                        placeholder="Search flour..."
                        value={blendSearchQuery}
                        onChange={e => { setBlendSearchQuery(e.target.value); setBlendShowFullSearch(true); }}
                        style={{
                          width: '100%', padding: '8px 12px',
                          border: '1px solid #E8E0D5', borderRadius: '10px',
                          fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
                          background: 'white', outline: 'none', color: '#1A1612',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {/* Row 2 — Type + Origin + Brand on same row */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <select
                        value={blendFilterType ?? ''}
                        onChange={e => setBlendFilterType(e.target.value || null)}
                        style={{
                          padding: '6px 8px', borderRadius: '20px', border: 'none',
                          background: blendFilterType ? '#1A1612' : '#F5F0E8',
                          color: blendFilterType ? 'white' : '#3D3530',
                          fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                          cursor: 'pointer', outline: 'none', flexShrink: 0,
                        }}
                      >
                        <option value="">Type ▾</option>
                        {[...new Set(FLOUR_DB.map(f => f.type))].sort().map(t => (
                          <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                        ))}
                      </select>
                      <select
                        value={blendFilterOrigin ?? ''}
                        onChange={e => { setBlendFilterOrigin(e.target.value || null); setBlendApacCountry(null); setBlendEuropeCountry(null); setBlendAmericasCountry(null); }}
                        style={{
                          padding: '6px 8px', borderRadius: '20px', border: 'none',
                          background: blendFilterOrigin ? '#1A1612' : '#F5F0E8',
                          color: blendFilterOrigin ? 'white' : '#3D3530',
                          fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                          cursor: 'pointer', outline: 'none', flexShrink: 0,
                        }}
                      >
                        <option value="">Origin ▾</option>
                        {Object.keys(ORIGIN_GROUPS).map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <select
                        value={blendFilterBrand ?? ''}
                        onChange={e => setBlendFilterBrand(e.target.value || null)}
                        style={{
                          padding: '6px 8px', borderRadius: '20px', border: 'none',
                          background: blendFilterBrand ? '#1A1612' : '#F5F0E8',
                          color: blendFilterBrand ? 'white' : '#3D3530',
                          fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                          cursor: 'pointer', outline: 'none', flexShrink: 0,
                        }}
                      >
                        <option value="">Brand ▾</option>
                        {blendBrandOptions.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* APAC / Europe / Americas country sub-filter pills for blend */}
                    {(blendFilterOrigin === 'Asia-Pacific' || blendFilterOrigin === 'Europe' || blendFilterOrigin === 'Americas') && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', marginBottom: '4px' }}>
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
                                border: active ? '1.5px solid #C4522A' : '1px solid #E8E0D5',
                                background: active ? '#FDF0EB' : 'transparent',
                                fontSize: '18px',
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
                          <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', padding: '8px 0' }}>
                            Not in our database — use the type or W option below.
                          </div>
                        );
                      }
                      return (
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {blendResults.map(f => (
                            <div
                              key={f.id}
                              onClick={() => {
                                setBlendSelectedF2(f);
                                setBlendRatio(85);
                                setBlendSearchQuery('');
                                setBlendFilterType(null);
                                setBlendFilterBrand(null);
                                const f1w = blend.wOverride ?? 260;
                                const blendedW = Math.round((f1w * 85 / 100) + (f.w * 15 / 100));
                                onBlendChange({ ...blend, ratio1: 85, wOverride: blendedW, customFlour2Name: `${f.brand} ${f.name}` });
                              }}
                              style={{ padding: '8px 0', borderBottom: '0.5px solid #E8E0D5', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#FDFBF7'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                            >
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1612', fontFamily: 'DM Sans, sans-serif' }}>{f.brand}</div>
                                <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>{f.name}</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '13px', fontFamily: 'var(--font-dm-mono)', color: f.wPublished ? '#1A1612' : '#8A7F78' }}>
                                  {f.wPublished ? `W${f.w}` : `~W${f.w}`}
                                </div>
                                <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-dm-mono)' }}>{f.protein}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Type or W fallback — always visible */}
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '0.5px solid #E8E0D5' }}>
                      <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
                        Don&apos;t see your flour? Pick a type or enter W:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                          { label: '00 · Pizza flour',   w: 260, protein: 12.0 },
                          { label: 'Semolina rimacinata', w: 200, protein: 12.5 },
                          { label: 'Manitoba',            w: 380, protein: 14.0 },
                          { label: 'Wholemeal',           w: 185, protein: 12.0 },
                          { label: 'Rye',                 w: 160, protein: 10.0 },
                          { label: 'Bread flour',         w: 270, protein: 12.8 },
                          { label: 'All-purpose',         w: 190, protein: 10.5 },
                        ].map(t => (
                          <button
                            key={t.label}
                            onClick={() => {
                              const genericEntry: FlourEntry = {
                                id: t.label, brand: '', name: t.label,
                                type: 'bread', country: 'us', w: t.w, wPublished: false,
                                protein: t.protein, hydration: [60, 75],
                                bestFor: [], crowdFavourite: [], note: '', bagImage: '', logo: null,
                              };
                              setBlendSelectedF2(genericEntry);
                              setBlendRatio(85);
                              const f1w = blend.wOverride ?? 260;
                              const blendedW = Math.round((f1w * 85 / 100) + (t.w * 15 / 100));
                              onBlendChange({ ...blend, ratio1: 85, wOverride: blendedW, customFlour2Name: t.label });
                            }}
                            style={{
                              padding: '4px 10px', borderRadius: '20px',
                              border: '1px solid #E8E0D5', background: 'transparent',
                              fontSize: '12px', color: '#3D3530',
                              fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                        {/* W value input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>W</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="e.g. 380"
                            min={100} max={450}
                            style={{
                              width: '72px', padding: '4px 8px',
                              border: '1.5px solid #E8E0D5', borderRadius: '8px',
                              fontFamily: 'var(--font-dm-mono)', fontSize: '13px',
                              color: '#1A1612', background: 'white', outline: 'none', textAlign: 'center',
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
                                setBlendSelectedF2(genericEntry);
                                setBlendRatio(85);
                                const f1w = blend.wOverride ?? 260;
                                const blendedW = Math.round((f1w * 85 / 100) + (v * 15 / 100));
                                onBlendChange({ ...blend, ratio1: 85, wOverride: blendedW, customFlour2Name: `Custom W${v}` });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
