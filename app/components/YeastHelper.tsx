'use client';
import { useState } from 'react';
import { YEAST_TYPES, type YeastType } from '../data';

interface CalcData {
  rtHours: number;
  coldHours: number;
  kitchenTemp: number;
  fridgeTemp: number;
  idyPct: number;
  idyGrams: number;
}

interface YeastHelperProps {
  onSelect: (yeastType: YeastType) => void;
  onClose: () => void;
  calcData?: CalcData;
}

export default function YeastHelper({ onSelect, onClose, calcData }: YeastHelperProps) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<YeastType | null>(null);
  const [showCalc, setShowCalc] = useState(false);

  function confirm(type: YeastType) {
    setSelected(type);
    setStep(3);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: '20px',
        padding: '2rem', maxWidth: '480px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '.7rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.2rem' }}>
              Step {step} of 3
            </div>
            <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.2rem', fontWeight: 700 }}>
              {step === 1 && 'What does your yeast look like?'}
              {step === 2 && 'What does the packet say?'}
              {step === 3 && 'Confirmed!'}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--border)', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px', cursor: 'pointer',
            fontSize: '.9rem', color: 'var(--smoke)',
          }}>✕</button>
        </div>

        {/* Step 1 — Visual identification */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: '.85rem', color: 'var(--smoke)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Pick the description that best matches what you have:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
              {[
                { label: 'Soft block or cube', desc: 'Moist, crumbly, beige/grey.', type: 'fresh' as YeastType },
                { label: 'Large brown granules', desc: 'Tan/brown, coarse. Small sachet or jar.', type: 'active_dry' as YeastType },
                { label: 'Fine powder / granules', desc: 'Light beige, very fine. Dissolves instantly.', type: 'instant' as YeastType },
                { label: 'Thick paste or liquid', desc: 'Off-white to grey, bubbly. Kept in a jar.', type: 'sourdough' as YeastType },
              ].map(opt => (
                <button key={opt.type} onClick={() => { setSelected(opt.type); setStep(2); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                    padding: '.75rem .6rem',
                    border: '1.5px solid var(--border)', borderRadius: '14px',
                    background: 'var(--warm)', cursor: 'pointer',
                    transition: 'all .2s',
                  }}>
                  {YEAST_TYPES[opt.type].image ? (
                    <img
                      src={YEAST_TYPES[opt.type].image as string}
                      alt={opt.label}
                      style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '8px', marginBottom: '.5rem' }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>{YEAST_TYPES[opt.type].emoji}</span>
                  )}
                  <div style={{ fontWeight: 600, fontSize: '.78rem', marginBottom: '.15rem', color: 'var(--char)' }}>{opt.label}</div>
                  <div style={{ fontSize: '.68rem', color: 'var(--smoke)', lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Label guide */}
        {step === 2 && selected && (
          <div>
            <p style={{ fontSize: '.85rem', color: 'var(--smoke)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Does your packet say any of these?
            </p>
            <div style={{
              background: '#F5F7F0', border: '1px solid #C8D4BA',
              borderRadius: '12px', padding: '1rem 1.2rem', marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '.75rem', color: 'var(--smoke)', marginBottom: '.4rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Also known as
              </div>
              <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--char)' }}>
                {YEAST_TYPES[selected].also}
              </div>
            </div>

            {/* Comparison table */}
            <div style={{ fontSize: '.78rem', marginBottom: '1.25rem' }}>
              {(Object.entries(YEAST_TYPES) as [YeastType, typeof YEAST_TYPES[YeastType]][]).map(([key, y]) => {
                const yImg = (y as { image?: string }).image;
                return (
                  <div key={key} onClick={() => confirm(key)}
                    style={{
                      display: 'flex', gap: '.75rem', padding: '.65rem .85rem',
                      borderRadius: '9px', marginBottom: '.35rem', cursor: 'pointer',
                      background: key === selected ? '#FEF4EF' : 'var(--warm)',
                      border: `1.5px solid ${key === selected ? 'var(--terra)' : 'var(--border)'}`,
                      transition: 'all .15s',
                    }}>
                    {yImg ? (
                      <img src={yImg} alt={y.name} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '5px', flexShrink: 0 }} />
                    ) : (
                      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{y.emoji}</span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--char)', marginBottom: '.1rem' }}>{y.name}</div>
                      <div style={{ color: 'var(--smoke)', lineHeight: 1.4 }}>{y.also}</div>
                    </div>
                    {key === selected && <span style={{ color: 'var(--terra)', alignSelf: 'center' }}>✓</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button onClick={() => setStep(1)} style={{
                flex: 1, padding: '.75rem', border: '1.5px solid var(--border)',
                borderRadius: '12px', background: 'var(--warm)', cursor: 'pointer',
                fontSize: '.85rem', color: 'var(--smoke)',
              }}>← Back</button>
              <button onClick={() => selected && confirm(selected)} style={{
                flex: 2, padding: '.75rem', border: 'none',
                borderRadius: '12px', background: 'var(--terra)', cursor: 'pointer',
                fontSize: '.85rem', color: '#fff', fontWeight: 500,
              }}>Confirm {selected ? YEAST_TYPES[selected].name : ''} →</button>
            </div>
          </div>
        )}

        {/* ── Yeast transparency panel ─────────────── */}
        {calcData && (
          <div>
            <button
              onClick={() => setShowCalc(v => !v)}
              style={{
                fontSize: '.72rem',
                color: 'var(--smoke)',
                fontFamily: 'var(--font-dm-mono)',
                cursor: 'pointer',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                padding: 0,
                marginTop: '.75rem',
              }}
            >
              {showCalc ? 'Hide calculation ↑' : 'How was this calculated? ↓'}
            </button>

            {showCalc && (
              <div style={{
                background: 'var(--cream)',
                border: '1.5px solid var(--border)',
                borderRadius: '10px',
                padding: '.85rem 1rem',
                marginTop: '.5rem',
                fontSize: '.75rem',
                color: 'var(--ash)',
                lineHeight: 1.7,
              }}>
                <div>Model: Craig&apos;s per-stage formula v1.1</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  RT phases: IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  Cold phase: IDY% = 7.5 / hours^1.313
                </div>
                {calcData.kitchenTemp >= 30 && (
                  <div>
                    Tropical correction applied:{' '}
                    <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                      ÷{calcData.kitchenTemp <= 32 ? '1.15' : '1.25'} at {calcData.kitchenTemp <= 32 ? '30–32°C' : '33–35°C'}
                    </span>
                  </div>
                )}
                <div style={{ marginTop: '.35rem' }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    RT hours: {calcData.rtHours}h
                    {' · '}Cold hours: {calcData.coldHours}h
                    {' · '}Kitchen: {calcData.kitchenTemp}°C
                    {' · '}Fridge: {calcData.fridgeTemp}°C
                  </span>
                </div>
                <div>
                  Result:{' '}
                  <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    IDY: {calcData.idyPct}% → {calcData.idyGrams}g
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Confirmation */}
        {step === 3 && selected && (
          <div style={{ textAlign: 'center' }}>
            {(YEAST_TYPES[selected] as { image?: string }).image ? (
              <img
                src={(YEAST_TYPES[selected] as { image?: string }).image!}
                alt={YEAST_TYPES[selected].name}
                style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1rem' }}
              />
            ) : (
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{YEAST_TYPES[selected].emoji}</div>
            )}
            <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '.5rem' }}>
              {YEAST_TYPES[selected].name}
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--smoke)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {YEAST_TYPES[selected].usage}
            </div>

            {/* Key facts */}
            <div style={{
              background: 'var(--warm)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem',
              textAlign: 'left',
            }}>
              {[
                { label: 'Form', value: YEAST_TYPES[selected].form },
                { label: 'Shelf life', value: YEAST_TYPES[selected].shelfLife },
                { label: 'Common in', value: YEAST_TYPES[selected].commonIn },
                { label: 'Amount vs instant', value: selected === 'instant' ? '× 1.0 (base reference)' : `× ${YEAST_TYPES[selected].conversion}` },
              ].map(f => (
                <div key={f.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '.8rem', padding: '.35rem 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ color: 'var(--smoke)' }}>{f.label}</span>
                  <span style={{ fontWeight: 500, color: 'var(--char)' }}>{f.value}</span>
                </div>
              ))}
            </div>

            <button onClick={() => { onSelect(selected); onClose(); }}
              style={{
                width: '100%', padding: '1rem', border: 'none',
                borderRadius: '12px', background: 'var(--char)', color: 'var(--cream)',
                fontFamily: 'var(--font-playfair)', fontSize: '1rem', fontWeight: 700,
                cursor: 'pointer',
              }}>
              ✓ Use {YEAST_TYPES[selected].name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
