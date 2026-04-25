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

  const allPizzas = getAllPizzas();

  const selectedEntries = Object.entries(selectedPizzas)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const pizza = allPizzas.find(p => p.id === id);
      return pizza ? { pizza, qty } : null;
    })
    .filter((e): e is { pizza: Pizza; qty: number } => e !== null);

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
            {'\u2190'} {t('back')}
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
              padding: '16px 16px 8px',
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              {getBeforeLabel()}
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
              padding: '16px 16px 8px',
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              {getAfterLabel()}
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

        {/* Photo button */}
        <div style={{ margin: '24px 16px 8px' }}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handlePhotoCapture}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: '56px', width: '100%',
              background: 'var(--gold)', color: 'var(--char)',
              borderRadius: '14px', fontFamily: 'DM Sans, sans-serif',
              fontSize: '16px', fontWeight: 600, cursor: 'pointer', border: 'none',
            }}
          >
            {t('photo.button')}
          </button>
          {photos[selectedPizzaId] && (
            <img
              src={photos[selectedPizzaId]}
              alt=""
              style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', marginTop: '12px', display: 'block' }}
            />
          )}
        </div>
      </div>
    );
  }

  // ── GRID VIEW ────────────────────────────────────────────
  return (
    <div>
      <div style={{ padding: '20px 16px 0' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: 700, color: 'var(--char)', margin: '0 0 6px' }}>
          {t('header.title')}
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--smoke)', margin: 0 }}>
          {t('header.subtitle')}
        </p>
      </div>

      {selectedEntries.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--smoke)', fontFamily: 'DM Sans, sans-serif', fontSize: '15px' }}>
          {l === 'fr' ? "Sélectionnez des pizzas dans l'onglet Choisir" : 'Select pizzas in the Pick tab'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '16px' }}>
          {selectedEntries.map(({ pizza, qty }) => (
            <div
              key={pizza.id}
              onClick={() => setSelectedPizzaId(pizza.id)}
              style={{
                border: '1px solid var(--border)', borderRadius: '14px',
                overflow: 'hidden', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(26,22,18,0.06)',
              }}
            >
              <div style={{ height: '160px', background: '#1A1612', overflow: 'hidden' }}>
                <img
                  src={getImageSrc(pizza.id)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => handleImageError(e, pizza.id)}
                />
              </div>
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: 700, color: 'var(--char)' }}>
                    {pizza.name[l]}
                  </span>
                  {qty > 1 && (
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '13px', color: 'var(--smoke)', marginLeft: '6px' }}>
                      &times;{qty}
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
          ))}
        </div>
      )}
    </div>
  );
}
