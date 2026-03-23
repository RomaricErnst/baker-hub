'use client';
import { useState } from 'react';
import { FLOUR_DATA, FLOUR_BRANDS, type FlourKey, type BrandKey, type FlourBlend, computeBlendProfile } from '../data';
import FlourScan from './FlourScan';

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
  semolina:  'Crunch + golden colour. 10–20% typical.',
  manitoba:  'Extra strength for 72h+ ferments.',
  wholemeal: 'Nutty complexity — use sparingly.',
  allpurpose: 'Softens structure for home oven.',
  rye:       'Deep flavour, enzyme boost. 10–30% typical.',
  strong00:  'Boost strength for long cold ferments.',
};

// ── W strength helper ─────────────────────────
function wStrength(w: number): { label: string; color: string } {
  if (w < 200) return { label: 'Weak — short ferments only',   color: 'var(--smoke)' };
  if (w < 250) return { label: 'Medium — 8-24h',               color: 'var(--smoke)' };
  if (w < 300) return { label: 'Strong — 24-48h',              color: 'var(--sage)' };
  if (w < 350) return { label: 'Very strong — 48-72h',         color: 'var(--gold)' };
  return           { label: 'Professional — 72h+',             color: 'var(--terra)' };
}

interface FlourPickerProps {
  blend: FlourBlend;
  onBlendChange: (blend: FlourBlend) => void;
  bakeType?: 'pizza' | 'bread';
  mode?: 'simple' | 'custom';
}

type FlourMode = 'selector' | 'brand' | 'manual' | 'scan';

// ── Flour card grid ───────────────────────────
function FlourCardGrid({
  flours, selected, onSelect, exclude, descOverride, trailingCard,
}: {
  flours: FlourKey[];
  selected: FlourKey | null;
  onSelect: (k: FlourKey) => void;
  exclude?: FlourKey | null;
  descOverride?: Partial<Record<FlourKey, string>>;
  trailingCard?: React.ReactNode;
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
              <span style={{ fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)', background: 'var(--cream)', color: 'var(--ash)', borderRadius: '20px', padding: '.1rem .5rem', border: '1px solid var(--border)' }}>
                W {f.w}
              </span>
              <span style={{ fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)', background: 'var(--cream)', color: 'var(--ash)', borderRadius: '20px', padding: '.1rem .5rem', border: '1px solid var(--border)' }}>
                {f.protein}% protein
              </span>
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.4 }}>{descOverride?.[key] ?? FLOUR_DESCS[key]}</div>
          </div>
        );
      })}
      {trailingCard}
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
                // reset custom when closing
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
              {/* Three inputs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: '120px' }}>
                  <div style={{ fontSize: '.62rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.3rem' }}>Name</div>
                  <input
                    type="text"
                    placeholder="e.g. Farro, Spelt"
                    value={customName}
                    onChange={e => { setCustomName(e.target.value); handleCustomChange(e.target.value, customW, customProtein, customRatio1); }}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <div style={{ width: '80px' }}>
                  <div style={{ fontSize: '.62rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.3rem' }}>W value</div>
                  <input
                    type="number"
                    placeholder="W value"
                    value={customW}
                    min={50} max={500} step={10}
                    onChange={e => { const v = e.target.value === '' ? '' : Number(e.target.value); setCustomW(v); handleCustomChange(customName, v, customProtein, customRatio1); }}
                    style={{ ...inputStyle, width: '80px' }}
                  />
                </div>
                <div style={{ width: '80px' }}>
                  <div style={{ fontSize: '.62rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.3rem' }}>Protein %</div>
                  <input
                    type="number"
                    placeholder="protein %"
                    value={customProtein}
                    min={5} max={20} step={0.5}
                    onChange={e => { const v = e.target.value === '' ? '' : Number(e.target.value); setCustomProtein(v); handleCustomChange(customName, customW, v, customRatio1); }}
                    style={{ ...inputStyle, width: '80px' }}
                  />
                </div>
              </div>

              {/* Ratio slider */}
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

              {/* Blend W pill */}
              {customW !== '' && (
                (() => {
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
                })()
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Tab pill button ───────────────────────────
function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '.4rem .9rem', borderRadius: '20px', cursor: 'pointer',
        fontSize: '.78rem', fontFamily: 'var(--font-dm-sans)', fontWeight: active ? 600 : 400,
        border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
        background: active ? '#FEF4EF' : 'transparent',
        color: active ? 'var(--terra)' : 'var(--smoke)',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────
export default function FlourPicker({ blend, onBlendChange, bakeType = 'pizza', mode = 'custom' }: FlourPickerProps) {
  const [flourMode, setFlourMode] = useState<FlourMode>('selector');
  const [wCardOpen, setWCardOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<BrandKey | null>(
    blend.brandKey ?? null
  );
  const [manualW, setManualW] = useState<number>(blend.wOverride ?? 250);

  const primaryFlours   = bakeType === 'bread' ? BREAD_FLOURS        : PIZZA_FLOURS;
  const secondaryFlours = bakeType === 'bread' ? BREAD_SECOND_FLOURS  : PIZZA_SECOND_FLOURS;

  function switchMode(m: FlourMode) {
    setFlourMode(m);
    // Reset overrides when switching modes
    onBlendChange({ flour1: blend.flour1, flour2: null, ratio1: 100 });
    setSelectedBrand(null);
  }

  // ── Mode 2: brand product select ──────────
  function selectBrandProduct(brandKey: BrandKey, product: { name: string; w: number }) {
    onBlendChange({
      flour1: 'pizza00',
      flour2: null,
      ratio1: 100,
      wOverride: product.w,
      brandKey,
      brandProduct: product.name,
    });
  }

  // ── Mode 3: manual W ──────────────────────
  function handleManualW(val: number) {
    setManualW(val);
    onBlendChange({
      flour1: blend.flour1,
      flour2: null,
      ratio1: 100,
      wOverride: val,
    });
  }

  const strength = wStrength(manualW);

  return (
    <div>
      {/* Mode tabs — custom mode only */}
      {mode === 'custom' && (
        <>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: 0 }}>
            <TabPill label="🗂 By Type"          active={flourMode === 'selector' || flourMode === 'manual'} onClick={() => { switchMode('selector'); setWCardOpen(false); }} />
            <TabPill label="🏷 I know my brand"  active={flourMode === 'brand'}    onClick={() => { switchMode('brand'); setWCardOpen(false); }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.4rem', marginBottom: '.75rem' }}>
            <button
              onClick={() => switchMode('scan')}
              style={{
                background: 'none',
                border: '1.5px solid var(--border)',
                borderRadius: '20px',
                padding: '.28rem .7rem',
                fontSize: '.7rem',
                fontFamily: 'var(--font-dm-sans)',
                color: 'var(--smoke)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '.3rem',
              }}
            >
              📷 Scan my bag
            </button>
          </div>
        </>
      )}

      {/* ── MODE 1: Selector (+ W card inline) ── */}
      {(flourMode === 'selector' || flourMode === 'manual' || mode === 'simple') && (
        <div>
          <FlourCardGrid
            flours={primaryFlours}
            selected={blend.flour1}
            onSelect={key => {
              const newFlour2 = blend.flour2 === key ? null : blend.flour2;
              onBlendChange({ flour1: key, flour2: newFlour2, ratio1: blend.ratio1 });
            }}
            trailingCard={mode === 'custom' ? (
              <div
                onClick={() => {
                  const next = !wCardOpen;
                  setWCardOpen(next);
                  setFlourMode(next ? 'manual' : 'selector');
                }}
                style={{
                  border: `1.5px solid ${wCardOpen ? 'var(--terra)' : 'var(--border)'}`,
                  borderRadius: '12px',
                  padding: '.8rem .9rem',
                  cursor: 'pointer',
                  background: wCardOpen ? '#FFF8F3' : 'var(--warm)',
                  transition: 'all .2s',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--char)', marginBottom: '.4rem' }}>
                  ✏️ Enter W value
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.4 }}>
                  Know your flour's exact W? Enter it directly.
                </div>
              </div>
            ) : undefined}
          />

          {/* W value expanded section */}
          {wCardOpen && mode === 'custom' && (
            <div style={{ marginTop: '.85rem' }}>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: '.65rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.4rem' }}>
                  W value
                </div>
                <input
                  type="number"
                  min={80} max={500} step={10}
                  value={manualW}
                  onChange={e => handleManualW(Number(e.target.value))}
                  style={{
                    width: '100px', border: '1.5px solid var(--border)', borderRadius: '8px',
                    padding: '.5rem .75rem', fontFamily: 'var(--font-dm-mono)',
                    fontSize: '.88rem', color: 'var(--char)', background: 'var(--warm)',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                border: `1.5px solid ${strength.color}`,
                borderRadius: '20px', padding: '.3rem .75rem',
                fontSize: '.72rem', fontFamily: 'var(--font-dm-mono)',
                color: strength.color, marginBottom: '1rem',
              }}>
                W {manualW} — {strength.label}
              </div>
              <BlendSection
                blend={blend}
                onBlendChange={onBlendChange}
                primaryFlours={primaryFlours}
                secondaryFlours={secondaryFlours}
              />
            </div>
          )}

          {mode === 'custom' && !wCardOpen && (
            <BlendSection
              blend={blend}
              onBlendChange={onBlendChange}
              primaryFlours={primaryFlours}
              secondaryFlours={secondaryFlours}
            />
          )}
        </div>
      )}

      {/* ── MODE 2: Brand ────────────────────── */}
      {flourMode === 'brand' && mode === 'custom' && (
        <div>
          {/* Brand cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem', marginBottom: '1rem' }}>
            {(Object.entries(FLOUR_BRANDS) as [BrandKey, typeof FLOUR_BRANDS[BrandKey]][]).map(([key, brand]) => {
              const isActive = selectedBrand === key;
              return (
                <div
                  key={key}
                  onClick={() => setSelectedBrand(key)}
                  style={{
                    border: `1.5px solid ${isActive ? 'var(--terra)' : 'var(--border)'}`,
                    borderRadius: '14px', padding: '1rem', cursor: 'pointer',
                    background: isActive ? '#FFF8F3' : 'var(--warm)', transition: 'all .2s',
                  }}
                >
                  <div style={{ fontSize: '1.4rem', marginBottom: '.4rem' }}>{brand.logo}</div>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--char)', marginBottom: '.2rem' }}>{brand.name}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--smoke)' }}>{brand.products.length} products</div>
                </div>
              );
            })}
          </div>

          {/* Product grid */}
          {selectedBrand && (
            <div>
              <div style={{ fontSize: '.7rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.65rem' }}>
                {FLOUR_BRANDS[selectedBrand].name} products
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '.65rem' }}>
                {FLOUR_BRANDS[selectedBrand].products.map(product => {
                  const isSelected = blend.brandKey === selectedBrand && blend.brandProduct === product.name;
                  return (
                    <div
                      key={product.name}
                      onClick={() => selectBrandProduct(selectedBrand, product)}
                      style={{
                        border: `1.5px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
                        borderRadius: '12px', padding: '.8rem .9rem', cursor: 'pointer',
                        background: isSelected ? '#FFF8F3' : 'var(--warm)', transition: 'all .2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--char)' }}>{product.name}</div>
                        {isSelected && <span style={{ color: 'var(--terra)', fontSize: '.8rem' }}>✓</span>}
                      </div>
                      <div style={{ marginBottom: '.4rem' }}>
                        <span style={{ fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)', background: 'var(--cream)', color: 'var(--ash)', borderRadius: '20px', padding: '.1rem .5rem', border: '1px solid var(--border)' }}>
                          W {product.w}
                        </span>
                      </div>
                      <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.4 }}>{product.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Blend toggle in brand mode */}
              {blend.brandProduct && (
                <BlendSection
                  blend={blend}
                  onBlendChange={onBlendChange}
                  primaryFlours={primaryFlours}
                  secondaryFlours={secondaryFlours}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODE 4: Scan ─────────────────────── */}
      {flourMode === 'scan' && mode === 'custom' && (
        <FlourScan
          onResult={result => {
            setManualW(result.w);
            onBlendChange({
              flour1: blend.flour1,
              flour2: null,
              ratio1: 100,
              wOverride: result.w,
            });
            setFlourMode('manual');
          }}
          onCancel={() => setFlourMode('selector')}
        />
      )}
    </div>
  );
}
