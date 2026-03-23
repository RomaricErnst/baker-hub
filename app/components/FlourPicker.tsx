'use client';
import { useState } from 'react';
import { FLOUR_DATA, type FlourKey, type FlourBlend, computeBlendProfile } from '../data';

const PIZZA_FLOURS: FlourKey[] = ['pizza00', 'strong00', 'bread', 'allpurpose', 'semolina'];
const BREAD_FLOURS: FlourKey[] = ['bread', 'strong00', 'allpurpose', 'wholemeal', 'rye'];

const FLOUR_DESCS: Record<FlourKey, string> = {
  pizza00:    'Classic Italian 00 — ideal for most pizza styles',
  strong00:   'Long cold ferments — maximum flavour',
  bread:      'Reliable gluten — great for most styles',
  allpurpose: 'Accessible, slightly less structure',
  semolina:   'Nutty durum wheat flavour',
  wholemeal:  'Nutty, nutritious, absorbs more water',
  rye:        'Deep flavour, enzyme-active',
};

interface FlourPickerProps {
  blend: FlourBlend;
  onBlendChange: (blend: FlourBlend) => void;
  bakeType?: 'pizza' | 'bread';
  mode?: 'simple' | 'custom';
}

// ── Flour card grid ──────────────────────────
function FlourCardGrid({
  flours,
  selected,
  onSelect,
  exclude,
}: {
  flours: FlourKey[];
  selected: FlourKey | null;
  onSelect: (k: FlourKey) => void;
  exclude?: FlourKey | null;
}) {
  const [hovered, setHovered] = useState<FlourKey | null>(null);
  const visible = exclude ? flours.filter(k => k !== exclude) : flours;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '.65rem',
    }}>
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
              borderRadius: '12px',
              padding: '.8rem .9rem',
              cursor: 'pointer',
              background: isSelected ? '#FFF8F3' : 'var(--warm)',
              transition: 'all .2s',
              boxShadow: hovered === key ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
              transform: hovered === key ? 'translateY(-2px)' : 'none',
            }}
          >
            {/* Name + check */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.4rem', marginBottom: '.4rem' }}>
              <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--char)', lineHeight: 1.3 }}>
                {f.name}
              </div>
              {isSelected && (
                <span style={{ color: 'var(--terra)', fontSize: '.8rem', flexShrink: 0 }}>✓</span>
              )}
            </div>
            {/* Pills */}
            <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.4rem' }}>
              <span style={{
                fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                background: 'var(--cream)', color: 'var(--ash)',
                borderRadius: '20px', padding: '.1rem .5rem',
                border: '1px solid var(--border)',
              }}>
                W {f.w}
              </span>
              <span style={{
                fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                background: 'var(--cream)', color: 'var(--ash)',
                borderRadius: '20px', padding: '.1rem .5rem',
                border: '1px solid var(--border)',
              }}>
                {f.protein}% protein
              </span>
            </div>
            {/* Desc */}
            <div style={{ fontSize: '.72rem', color: 'var(--smoke)', lineHeight: 1.4 }}>
              {FLOUR_DESCS[key]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────
export default function FlourPicker({ blend, onBlendChange, bakeType = 'pizza', mode = 'custom' }: FlourPickerProps) {
  const [blendOpen, setBlendOpen] = useState(blend.flour2 !== null);

  const availableFlours = bakeType === 'bread' ? BREAD_FLOURS : PIZZA_FLOURS;

  function selectPrimary(key: FlourKey) {
    // If same as flour2, clear flour2
    const newFlour2 = blend.flour2 === key ? null : blend.flour2;
    onBlendChange({ flour1: key, flour2: newFlour2, ratio1: blend.ratio1 });
  }

  function selectSecondary(key: FlourKey) {
    onBlendChange({ ...blend, flour2: key });
  }

  function handleRatio(val: number) {
    onBlendChange({ ...blend, ratio1: val });
  }

  function openBlend() {
    setBlendOpen(true);
    // Default second flour to first available that isn't flour1
    if (!blend.flour2) {
      const next = availableFlours.find(k => k !== blend.flour1);
      if (next) onBlendChange({ ...blend, flour2: next, ratio1: 70 });
    }
  }

  function closeBlend() {
    setBlendOpen(false);
    onBlendChange({ ...blend, flour2: null, ratio1: 100 });
  }

  const blendProfile = computeBlendProfile(blend);
  const showBlend = mode === 'custom';

  return (
    <div>
      {/* Section 1 — Primary flour */}
      <FlourCardGrid
        flours={availableFlours}
        selected={blend.flour1}
        onSelect={selectPrimary}
      />

      {/* Section 2 — Blend toggle (custom mode only) */}
      {showBlend && !blendOpen && (
        <button
          onClick={openBlend}
          style={{
            marginTop: '.9rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--smoke)', fontSize: '.78rem',
            fontFamily: 'var(--font-dm-sans)',
            textDecoration: 'underline', textUnderlineOffset: '2px',
            padding: '.2rem 0',
          }}
        >
          Add a second flour? →
        </button>
      )}

      {/* Section 3 — Blend UI */}
      {showBlend && blendOpen && (
        <div style={{ marginTop: '1rem' }}>
          {/* Header row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '.7rem',
          }}>
            <div style={{
              fontSize: '.7rem', color: 'var(--smoke)', textTransform: 'uppercase',
              letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)',
            }}>
              Second flour
            </div>
            <button
              onClick={closeBlend}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--smoke)', fontSize: '.72rem',
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              Remove blend
            </button>
          </div>

          {/* Second flour selector */}
          <FlourCardGrid
            flours={availableFlours}
            selected={blend.flour2}
            onSelect={selectSecondary}
            exclude={blend.flour1}
          />

          {/* Ratio slider — only when flour2 is selected */}
          {blend.flour2 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: '.4rem',
              }}>
                <span style={{
                  fontSize: '.75rem', color: 'var(--char)', fontFamily: 'var(--font-dm-mono)',
                  fontWeight: 600,
                }}>
                  {blend.ratio1}% {FLOUR_DATA[blend.flour1].name}
                </span>
                <span style={{
                  fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                }}>
                  {100 - blend.ratio1}% {FLOUR_DATA[blend.flour2].name}
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                step={10}
                value={blend.ratio1}
                onChange={e => handleRatio(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer' }}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                marginTop: '.15rem',
              }}>
                <span>10%</span><span>90%</span>
              </div>

              {/* Blend summary pill */}
              <div style={{
                marginTop: '.75rem',
                display: 'inline-flex', alignItems: 'center', gap: '.5rem',
                background: 'rgba(107,122,90,0.12)',
                border: '1px solid rgba(107,122,90,0.3)',
                borderRadius: '20px', padding: '.3rem .75rem',
                fontSize: '.72rem', fontFamily: 'var(--font-dm-mono)',
                color: 'var(--sage)',
              }}>
                <span>Blended W {blendProfile.blendedW}</span>
                <span style={{ opacity: .5 }}>·</span>
                <span>
                  {blendProfile.hydrationDelta > 0 ? '+' : ''}{blendProfile.hydrationDelta}% hydration
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
