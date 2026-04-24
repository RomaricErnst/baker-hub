'use client';
import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PIZZAS, DESSERT_PIZZAS, type Pizza } from '../../lib/toppingDatabase';

interface BakeTabProps {
  selectedPizzas: Record<string, number>;
  locale: string;
}

function getAllPizzas(): Pizza[] {
  return [...PIZZAS, ...DESSERT_PIZZAS];
}

export default function BakeTab({ selectedPizzas, locale }: BakeTabProps) {
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

  // ── DETAIL VIEW ──────────────────────────────────────────
  if (selectedPizzaId !== null) {
    const entry = selectedEntries.find(e => e.pizza.id === selectedPizzaId);
    if (!entry) { setSelectedPizzaId(null); return null; }
    const { pizza, qty } = entry;
    const beforeIngredients = pizza.ingredients.filter(i => i.bakeOrder === 'before');
    const afterIngredients = pizza.ingredients.filter(i => i.bakeOrder === 'after');

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
            src={`/pizzas/${pizza.id}.png`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* BEFORE section */}
        {beforeIngredients.length > 0 && (
          <>
            <div style={{
              padding: '16px 16px 8px',
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              {t('section.before')}
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
              {t('section.after')}
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
                  src={`/pizzas/${pizza.id}.png`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
