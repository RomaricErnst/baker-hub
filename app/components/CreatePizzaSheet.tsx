'use client';
// « Créer ma pizza » — build a custom pizza from catalogue ingredients or
// free text. Saved to the baker profile; appears on every party surface.
import { useMemo, useState } from 'react';
import { PIZZAS, DESSERT_PIZZAS } from '../lib/toppingDatabase';
import { saveCustomPizza, type CustomPizzaIngredient } from '../lib/profile';
import type { Ingredient, IngredientCategory, IngredientUnit, OvenTempTag } from '../lib/toppingTypes';

const UNITS: IngredientUnit[] = ['g', 'ml', 'pcs', 'slices', 'leaves', 'sprigs', 'tbsp', 'pinch'];

const CAT_LABELS: Record<IngredientCategory, { en: string; fr: string }> = {
  sauce:  { en: 'Sauces & bases', fr: 'Sauces & bases' },
  base:   { en: 'Bases', fr: 'Bases' },
  cheese: { en: 'Cheese', fr: 'Fromages' },
  meat:   { en: 'Meat', fr: 'Viandes' },
  seafood:{ en: 'Seafood', fr: 'Mer' },
  veg:    { en: 'Vegetables', fr: 'Légumes' },
  spice:  { en: 'Spices', fr: 'Épices' },
  finish: { en: 'Finishing', fr: 'Finitions' },
};

export default function CreatePizzaSheet({ locale, onClose, onCreated }: {
  locale: string; onClose: () => void; onCreated: () => void;
}) {
  const fr = locale === 'fr';
  const l = fr ? 'fr' : 'en';
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<CustomPizzaIngredient[]>([]);
  const [freeName, setFreeName] = useState('');
  const [freeAmount, setFreeAmount] = useState('50');
  const [freeUnit, setFreeUnit] = useState<IngredientUnit>('g');

  // Unique catalogue across all pizzas, keyed by ingredient id
  const catalogue = useMemo(() => {
    const map = new Map<string, Ingredient>();
    [...PIZZAS, ...DESSERT_PIZZAS].forEach(p => p.ingredients.forEach(ing => {
      if (!map.has(ing.id)) map.set(ing.id, ing);
    }));
    return [...map.values()];
  }, []);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalogue
      .filter(ing => (ing.name.en + ' ' + ing.name.fr).toLowerCase().includes(q))
      .filter(ing => !picked.some(p => p.refId === ing.id))
      .slice(0, 8);
  }, [search, catalogue, picked]);

  function addFromCatalogue(ing: Ingredient) {
    setPicked(prev => [...prev, {
      refId: ing.id,
      nameEn: ing.name.en,
      nameFr: ing.name.fr,
      amount: ing.qtyPerPizza?.amount ?? 50,
      unit: ing.qtyPerPizza?.unit ?? 'g',
      bakeOrder: ing.bakeOrder,
      category: ing.category,
    }]);
    setSearch('');
  }

  function addFree() {
    const n = freeName.trim();
    if (!n) return;
    setPicked(prev => [...prev, {
      nameEn: n, nameFr: n,
      amount: Math.max(1, Number(freeAmount) || 50),
      unit: freeUnit,
      bakeOrder: 'before',
      category: 'veg',
      free: true,
    }]);
    setFreeName(''); setFreeAmount('50');
  }

  // ovenTemp inference — majority vote of database pizzas containing the
  // picked catalogue ingredients; sweet finish pulls low, no vote = high.
  function inferOvenTemp(): OvenTempTag {
    const votes: Record<OvenTempTag, number> = { high: 0, mid: 0, low: 0 };
    const refIds = picked.filter(p => p.refId).map(p => p.refId as string);
    [...PIZZAS, ...DESSERT_PIZZAS].forEach(p => {
      const hits = p.ingredients.filter(ing => refIds.includes(ing.id)).length;
      if (hits > 0) votes[p.ovenTemp] += hits;
    });
    const best = (Object.entries(votes) as Array<[OvenTempTag, number]>).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'high';
  }

  function save() {
    if (!name.trim() || picked.length === 0) return;
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'pizza';
    saveCustomPizza({
      id: `custom_${slug}_${Date.now()}`,
      name: name.trim(),
      ovenTemp: inferOvenTemp(),
      ingredients: picked,
      createdAt: Date.now(),
    });
    onCreated();
    onClose();
  }

  const canSave = name.trim().length > 0 && picked.length > 0;
  const input = {
    border: '1px solid #E0D8CF', borderRadius: '8px', padding: '9px 11px',
    fontFamily: 'var(--font-dm-sans)', fontSize: '14px', color: '#1A1612',
    background: '#FDFBF7', width: '100%',
  } as const;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.52)', zIndex: 250 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#FDFBF7', borderRadius: '20px 20px 0 0', zIndex: 251,
        maxHeight: 'calc(100dvh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ width: 32, height: 3, background: '#E0D8CF', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid #F0EAE3', flexShrink: 0 }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: 700, color: '#1A1612' }}>
            {fr ? 'Créer ma pizza' : 'Create my pizza'}
          </span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F5F0E8', border: 'none', fontSize: 14, color: '#8A7F78', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 14px' }}>
          {/* Name */}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={fr ? 'Nom de votre pizza — ex. La Romaric' : 'Your pizza name — e.g. La Famiglia'}
            style={{ ...input, fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: '16px' }}
          />

          {/* Picked ingredients */}
          {picked.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {picked.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  background: '#F5F0E8', border: '1px solid #E8E0D5', borderRadius: '10px', padding: '7px 10px',
                }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: '#1A1612', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fr ? p.nameFr : p.nameEn}{p.free ? ' ✎' : ''}
                  </span>
                  <input
                    type="number" inputMode="numeric" value={p.amount}
                    onChange={e => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      setPicked(prev => prev.map((x, j) => j === i ? { ...x, amount: v } : x));
                    }}
                    style={{ width: '52px', border: '1px solid #E0D8CF', borderRadius: '6px', padding: '4px 6px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', textAlign: 'right', background: '#FDFBF7' }}
                  />
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: '#8A7F78', width: '38px' }}>{p.unit}</span>
                  <button
                    onClick={() => setPicked(prev => prev.map((x, j) => j === i ? { ...x, bakeOrder: x.bakeOrder === 'before' ? 'after' : 'before' } : x))}
                    style={{
                      fontFamily: 'var(--font-dm-mono)', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', cursor: 'pointer',
                      border: p.bakeOrder === 'before' ? '1px solid rgba(196,82,42,0.45)' : '1px solid rgba(212,168,83,0.55)',
                      background: p.bakeOrder === 'before' ? 'rgba(196,82,42,0.08)' : 'rgba(212,168,83,0.12)',
                      color: p.bakeOrder === 'before' ? '#C4522A' : '#B8903A', whiteSpace: 'nowrap',
                    }}
                  >
                    {p.bakeOrder === 'before' ? (fr ? 'avant' : 'before') : (fr ? 'après' : 'after')}
                  </button>
                  <button onClick={() => setPicked(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '13px', padding: '0 2px' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Catalogue search */}
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: '#C4522A', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '6px' }}>
              {fr ? 'Ingrédients du catalogue' : 'Catalogue ingredients'}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={fr ? 'Rechercher — mozzarella, basilic…' : 'Search — mozzarella, basil…'}
              style={input}
            />
            {results.length > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {results.map(ing => (
                  <button key={ing.id} onClick={() => addFromCatalogue(ing)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    background: '#FDFBF7', border: '1px solid #E8E0D5', borderRadius: '8px',
                    padding: '8px 11px', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: '#1A1612' }}>{ing.name[l]}</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: '#8A7F78', flexShrink: 0 }}>
                      {CAT_LABELS[ing.category][l]} · +
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Free text */}
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: '#C4522A', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '6px' }}>
              {fr ? 'Ou en texte libre' : 'Or free text'}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={freeName} onChange={e => setFreeName(e.target.value)}
                placeholder={fr ? 'Ingrédient' : 'Ingredient'} style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
              <input type="number" inputMode="numeric" value={freeAmount} onChange={e => setFreeAmount(e.target.value)}
                style={{ ...input, width: '64px', fontFamily: 'var(--font-dm-mono)', textAlign: 'right' }} />
              <select value={freeUnit} onChange={e => setFreeUnit(e.target.value as IngredientUnit)}
                style={{ ...input, width: '84px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px' }}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button onClick={addFree} disabled={!freeName.trim()} style={{
                border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: freeName.trim() ? 'pointer' : 'default',
                background: freeName.trim() ? '#6B7A5A' : '#E0D8CF', color: 'white',
                fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 600,
              }}>+</button>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div style={{ borderTop: '1px solid #F0EAE3', padding: '12px 14px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
          <button onClick={save} disabled={!canSave} style={{
            width: '100%', border: 'none', borderRadius: '12px', padding: '13px',
            background: canSave ? '#C4522A' : '#E0D8CF', color: 'white', cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'var(--font-dm-sans)', fontSize: '15px', fontWeight: 700,
          }}>
            {fr ? 'Enregistrer ma pizza' : 'Save my pizza'}
          </button>
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: '#8A7F78', textAlign: 'center', marginTop: '6px' }}>
            {fr ? 'Sauvegardée dans votre profil — retrouvez-la à chaque soirée.' : 'Saved to your profile — back for every party.'}
          </div>
        </div>
      </div>
    </>
  );
}
