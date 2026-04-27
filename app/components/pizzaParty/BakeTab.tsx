'use client';
import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PIZZAS, DESSERT_PIZZAS, type Pizza } from '../../lib/toppingDatabase';
import type { StyleKey, IngredientCategory, Ingredient } from '../../lib/toppingTypes';

interface BakeTabProps {
  selectedPizzas: Record<string, number>;
  locale: string;
  styleKey?: string;
}

function getAllPizzas(): Pizza[] {
  return [...PIZZAS, ...DESSERT_PIZZAS];
}

const ORDER_MAP: Record<IngredientCategory, number> = {
  sauce: 1, base: 1,
  cheese: 2,
  meat: 3, seafood: 3,
  veg: 4,
  spice: 5,
  finish: 6,
};

export default function BakeTab({ selectedPizzas, locale, styleKey }: BakeTabProps) {
  const t = useTranslations('bake');
  const l = locale as 'en' | 'fr';
  const [selectedPizzaId, setSelectedPizzaId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // doneCounts[pizzaId] = how many of that pizza have been baked
  const [doneCounts, setDoneCounts] = useState<Record<string, number>>({});

  const allPizzas = getAllPizzas();

  const selectedEntries = Object.entries(selectedPizzas)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const pizza = allPizzas.find(p => p.id === id);
      return pizza ? { pizza, qty } : null;
    })
    .filter((e): e is { pizza: Pizza; qty: number } => e !== null);

  const totalOrdered = selectedEntries.reduce((acc, e) => acc + e.qty, 0);
  const totalDone = Object.values(doneCounts).reduce((a, b) => a + b, 0);

  function markOneDone(pizzaId: string) {
    setDoneCounts(prev => ({ ...prev, [pizzaId]: (prev[pizzaId] ?? 0) + 1 }));
    setSelectedPizzaId(null);
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedPizzaId) return;
    const url = URL.createObjectURL(file);
    setPhotos(prev => ({ ...prev, [selectedPizzaId]: url }));
  }

  function getEffectiveBakeOrder(ing: Ingredient): 'before' | 'after' {
    if (styleKey) return ing.bakeOrderByStyle?.[styleKey as StyleKey] ?? ing.bakeOrder;
    return ing.bakeOrder;
  }

  function getImageSrc(pizzaId: string): string {
    const variantMap: Record<string, string> = {
      pizza_romana: '_pizza_romana',
      newyork: '_newyork',
      pan: '_pan',
      roman: '_roman',
    };
    const suffix = styleKey && variantMap[styleKey];
    if (suffix) return `/pizzas/${pizzaId}${suffix}.webp`;
    return `/pizzas/${pizzaId}.webp`;
  }

  function handleImageError(e: React.SyntheticEvent<HTMLImageElement>, pizzaId: string) {
    const img = e.target as HTMLImageElement;
    if (!img.src.endsWith(`${pizzaId}.webp`)) {
      img.src = `/pizzas/${pizzaId}.webp`;
    }
  }

  function getBeforeLabel(): string {
    if (styleKey === 'roman') return t('section.before_roman');
    if (styleKey === 'pan') return t('section.before_pan');
    return t('section.before');
  }

  function getAfterLabel(): string {
    if (styleKey === 'pan') return t('section.after_pan');
    return t('section.after');
  }

  // ── DETAIL VIEW ──────────────────────────────────────────
  if (selectedPizzaId !== null) {
    const entry = selectedEntries.find(e => e.pizza.id === selectedPizzaId);
    if (!entry) { setSelectedPizzaId(null); return null; }
    const { pizza, qty } = entry;

    const beforeIngredients = pizza.ingredients
      .filter(i => getEffectiveBakeOrder(i) === 'before')
      .sort((a, b) => (ORDER_MAP[a.category] ?? 5) - (ORDER_MAP[b.category] ?? 5));

    const afterIngredients = pizza.ingredients
      .filter(i => getEffectiveBakeOrder(i) === 'after');

    const assemblyNote = styleKey === 'roman' || styleKey === 'pan'
      ? (l === 'fr' ? t(`assembly.${styleKey}`) : t(`assembly.${styleKey}`))
      : null;

    return (
      <div>
        {/* Top bar */}
        <div style={{ height: '56px', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setSelectedPizzaId(null)}
            style={{
              color: 'var(--terra)', fontFamily: 'DM Sans, sans-serif', fontSize: '14px',
              cursor: 'pointer', background: 'none', border: 'none', marginRight: 'auto', padding: 0,
            }}
          >
            {'\u2190'} {l === 'fr' ? 'Toutes les pizzas' : 'All pizzas'}
          </button>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: 600, color: 'var(--char)' }}>
            {pizza.name[l]}
          </span>
          {qty > 1 && (
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '13px', color: 'var(--smoke)', marginLeft: '6px' }}>
              &times;{qty}
            </span>
          )}
        </div>

        {/* Hero image */}
        <div style={{ width: '100%', height: '220px', background: '#1A1612', overflow: 'hidden' }}>
          <img
            src={getImageSrc(pizza.id)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => handleImageError(e, pizza.id)}
          />
        </div>

        {/* Assembly note for Teglia / Detroit */}
        {assemblyNote && (
          <div style={{
            margin: '12px 16px',
            padding: '10px 12px',
            background: 'rgba(196,82,42,0.06)',
            border: '1px solid rgba(196,82,42,0.2)',
            borderRadius: '10px',
            fontSize: '12px',
            color: 'var(--ash)',
            fontFamily: 'DM Sans, sans-serif',
            lineHeight: 1.5,
          }}>
            {assemblyNote}
          </div>
        )}

        {/* BEFORE section */}
        {beforeIngredients.length > 0 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              margin: '20px 16px 4px',
            }}>
              <div style={{
                width: '3px', height: '16px', borderRadius: '2px',
                background: 'var(--terra)', flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
                color: 'var(--terra)', textTransform: 'uppercase',
                letterSpacing: '1.5px', fontWeight: 700,
              }}>
                {getBeforeLabel()}
              </span>
            </div>
            {beforeIngredients.map((ing, i) => (
              <div
                key={ing.id}
                style={{
                  display: 'flex', alignItems: 'center', minHeight: '56px', padding: '0 16px',
                  borderBottom: i < beforeIngredients.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: 600, color: 'var(--char)', flex: 1 }}>
                  {ing.name[l]}
                </span>
                {ing.qtyPerPizza && (
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '13px', color: 'var(--smoke)', textAlign: 'right' }}>
                    {ing.qtyPerPizza.amount}{ing.qtyPerPizza.unit} {t('perPizza')}
                  </span>
                )}
              </div>
            ))}
          </>
        )}

        {/* AFTER section */}
        {afterIngredients.length > 0 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              margin: '20px 16px 4px',
            }}>
              <div style={{
                width: '3px', height: '16px', borderRadius: '2px',
                background: 'var(--gold)', flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
                color: 'var(--gold)', textTransform: 'uppercase',
                letterSpacing: '1.5px', fontWeight: 700,
              }}>
                {getAfterLabel()}
              </span>
            </div>
            {afterIngredients.map((ing, i) => (
              <div
                key={ing.id}
                style={{
                  display: 'flex', alignItems: 'center', minHeight: '56px', padding: '0 16px',
                  borderBottom: i < afterIngredients.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: 600, color: 'var(--char)', flex: 1 }}>
                  {ing.name[l]}
                </span>
                {ing.qtyPerPizza && (
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '13px', color: 'var(--smoke)', textAlign: 'right' }}>
                    {ing.qtyPerPizza.amount}{ing.qtyPerPizza.unit} {t('perPizza')}
                  </span>
                )}
              </div>
            ))}
          </>
        )}

        {/* Sticky action bar — photo (independent) + Done (primary) */}
        <div style={{
          position: 'sticky', bottom: 0,
          background: 'var(--warm)',
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        }}>
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handlePhotoCapture}
          />
          {/* Photo button — small, independent, no state impact */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title={l === 'fr' ? 'Prendre une photo' : 'Take a photo'}
            style={{
              width: '48px', height: '48px', flexShrink: 0,
              background: photos[selectedPizzaId ?? ''] ? 'transparent' : 'var(--border)',
              border: photos[selectedPizzaId ?? '']
                ? '1.5px solid #6B7A5A' : '1px solid var(--border)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden', padding: 0,
            }}
          >
            {photos[selectedPizzaId ?? ''] ? (
              <img
                src={photos[selectedPizzaId ?? '']}
                style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                alt=""
              />
            ) : (
              <svg viewBox="0 0 20 20" width={20} height={20} fill="none"
                stroke="var(--smoke)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 7.5A1.5 1.5 0 012.5 6h.879a2 2 0 001.664-.89l.812-1.22A2 2 0 017.519 3h4.962a2 2 0 011.664.89l.812 1.22A2 2 0 0016.62 6H17.5A1.5 1.5 0 0119 7.5v8A1.5 1.5 0 0117.5 17h-15A1.5 1.5 0 011 15.5v-8z"/>
                <circle cx="10" cy="11" r="3"/>
              </svg>
            )}
          </button>
          {/* Done button — marks one unit baked, returns to grid */}
          {(() => {
            const currentEntry = selectedEntries.find(e => e.pizza.id === selectedPizzaId);
            const doneCount = doneCounts[selectedPizzaId ?? ''] ?? 0;
            const remainingQty = (currentEntry?.qty ?? 1) - doneCount;
            const isLastOne = remainingQty <= 1;
            return (
              <button
                onClick={() => selectedPizzaId && markOneDone(selectedPizzaId)}
                style={{
                  flex: 1, height: '48px',
                  background: '#6B7A5A', color: 'white',
                  border: 'none', borderRadius: '10px',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: '15px', fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '8px',
                }}
              >
                <svg viewBox="0 0 16 16" width={16} height={16} fill="none"
                  stroke="white" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8l4 4 8-8"/>
                </svg>
                {isLastOne
                  ? (l === 'fr' ? 'Pizza cuite !' : 'Pizza baked!')
                  : (l === 'fr'
                    ? `Cuite — encore ${remainingQty - 1}`
                    : `Baked — ${remainingQty - 1} left`)}
              </button>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── GRID VIEW ────────────────────────────────────────────
  return (
    <div>
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{
          fontFamily: 'Playfair Display, serif', fontSize: '26px',
          fontWeight: 700, color: 'var(--char)', margin: '0 0 2px',
        }}>
          {t('header.title')}
        </h2>
        <p style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
          color: 'var(--smoke)', margin: '0 0 12px',
        }}>
          {t('header.subtitle')}
        </p>
        {totalDone > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontFamily: 'DM Mono, monospace', fontSize: '11px',
              color: totalDone >= totalOrdered ? '#6B7A5A' : 'var(--smoke)',
              marginBottom: '6px',
            }}>
              {totalDone >= totalOrdered
                ? (l === 'fr' ? '🎉 Toutes les pizzas cuites !' : '🎉 All pizzas baked!')
                : (l === 'fr'
                  ? `${totalDone} / ${totalOrdered} cuites`
                  : `${totalDone} / ${totalOrdered} baked`)}
            </div>
            <div style={{
              height: '4px', borderRadius: '2px', background: 'var(--border)',
            }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                background: totalDone >= totalOrdered ? '#6B7A5A' : 'var(--terra)',
                width: `${Math.min(100, (totalDone / totalOrdered) * 100)}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {selectedEntries.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--smoke)', fontFamily: 'DM Sans, sans-serif', fontSize: '15px' }}>
          {l === 'fr' ? "Sélectionnez des pizzas dans l'onglet Choisir" : 'Select pizzas in the Pick tab'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '16px' }}>
          {selectedEntries.map(({ pizza, qty }) => {
            const doneCount = doneCounts[pizza.id] ?? 0;
            const remainingQty = qty - doneCount;
            const isFullyDone = remainingQty <= 0;
            return (
              <div
                key={pizza.id}
                onClick={() => !isFullyDone && setSelectedPizzaId(pizza.id)}
                style={{
                  border: isFullyDone ? '1.5px solid #6B7A5A' : '1px solid var(--border)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  cursor: isFullyDone ? 'default' : 'pointer',
                  boxShadow: '0 2px 8px rgba(26,22,18,0.06)',
                  opacity: isFullyDone ? 0.55 : 1,
                  transition: 'opacity 0.2s ease, border 0.2s ease',
                }}
              >
                <div style={{ height: '160px', background: '#1A1612', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={getImageSrc(pizza.id)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={e => handleImageError(e, pizza.id)}
                  />
                  {isFullyDone && (
                    <div style={{
                      position: 'absolute', top: '8px', right: '8px',
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: '#6B7A5A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg viewBox="0 0 12 12" width={14} height={14} fill="none"
                        stroke="white" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 700, color: 'var(--char)' }}>
                      {pizza.name[l]}
                    </span>
                    {remainingQty > 1 && (
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '13px', color: 'var(--smoke)', marginLeft: '6px' }}>
                        &times;{remainingQty}
                      </span>
                    )}
                    {isFullyDone && (
                      <span style={{
                        fontFamily: 'DM Sans, sans-serif', fontSize: '11px',
                        color: '#6B7A5A', marginLeft: '6px', fontWeight: 500,
                      }}>
                        {l === 'fr' ? '✓ Cuite' : '✓ Done'}
                      </span>
                    )}
                  </div>
                  {pizza.story && (
                    <div style={{
                      fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--smoke)',
                      marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {pizza.story[l]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
