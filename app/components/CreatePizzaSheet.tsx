'use client';
// « Créer ma pizza » v2 — guided flow: base → fromage → viande/mer → légumes
// → finitions. Each group offers catalogue chips or free text; bake order is
// preset per ingredient and toggleable. Also edits an existing creation.
import { useMemo, useRef, useState } from 'react';
import { PIZZAS, DESSERT_PIZZAS } from '../lib/toppingDatabase';
import { saveCustomPizza, type CustomPizzaDef, type CustomPizzaIngredient } from '../lib/profile';
import type { Ingredient, IngredientCategory, IngredientUnit, OvenTempTag } from '../lib/toppingTypes';

const UNITS: IngredientUnit[] = ['g', 'ml', 'pcs', 'slices', 'leaves', 'sprigs', 'tbsp', 'pinch'];

// Guided groups, in topping order
const GROUPS: Array<{ cats: IngredientCategory[]; en: string; fr: string; freeCat: IngredientCategory }> = [
  { cats: ['sauce', 'base'], en: '1 · Base & sauce', fr: '1 · Base & sauce', freeCat: 'sauce' },
  { cats: ['cheese'], en: '2 · Cheese', fr: '2 · Fromages', freeCat: 'cheese' },
  { cats: ['meat', 'seafood'], en: '3 · Meat & sea', fr: '3 · Viandes & mer', freeCat: 'meat' },
  { cats: ['veg'], en: '4 · Vegetables', fr: '4 · Légumes', freeCat: 'veg' },
  { cats: ['spice', 'finish'], en: '5 · Finishing touches', fr: '5 · Finitions', freeCat: 'finish' },
];

export default function CreatePizzaSheet({ locale, onClose, onCreated, initial }: {
  locale: string; onClose: () => void; onCreated: () => void; initial?: CustomPizzaDef;
}) {
  const fr = locale === 'fr';
  const l = fr ? 'fr' : 'en';
  const [name, setName] = useState(initial?.name ?? '');
  const [picked, setPicked] = useState<CustomPizzaIngredient[]>(initial?.ingredients ?? []);
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo);
  // Re-croppable source: full image + drag position (0..1), baked at save
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoDims, setPhotoDims] = useState<{ w: number; h: number } | null>(null);
  const [pos, setPos] = useState<{ fx: number; fy: number }>({ fx: 0.5, fy: 0.5 });
  const dragRef = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [free, setFree] = useState<Record<string, { name: string; amount: string; unit: IngredientUnit }>>({});
  const [openGroup, setOpenGroup] = useState(0);

  const catalogue = useMemo(() => {
    const map = new Map<string, Ingredient>();
    [...PIZZAS, ...DESSERT_PIZZAS].forEach(p => p.ingredients.filter(Boolean).forEach(ing => {
      if (!map.has(ing.id)) map.set(ing.id, ing);
    }));
    return [...map.values()];
  }, []);

  function add(ing: Ingredient) {
    setPicked(prev => [
      // One base per pizza — picking a second base swaps the first,
      // silently, the way a real pizza works. Sauces stay stackable.
      ...(ing.category === 'base' ? prev.filter(x => x.category !== 'base') : prev),
      {
        refId: ing.id, nameEn: ing.name.en, nameFr: ing.name.fr,
        amount: ing.qtyPerPizza?.amount ?? 50,
        unit: ing.qtyPerPizza?.unit ?? 'g',
        bakeOrder: ing.bakeOrder, category: ing.category,
      },
    ]);
  }

  function addFree(gi: number) {
    const f = free[gi] ?? { name: '', amount: '50', unit: 'g' as IngredientUnit };
    const n = f.name.trim();
    if (!n) return;
    const cat = GROUPS[gi].freeCat;
    setPicked(prev => [...prev, {
      nameEn: n, nameFr: n,
      amount: Math.max(1, Number(f.amount) || 50), unit: f.unit,
      bakeOrder: cat === 'finish' ? 'after' : 'before',
      category: cat, free: true,
    }]);
    setFree(prev => ({ ...prev, [gi]: { name: '', amount: '50', unit: 'g' } }));
  }

  async function attachPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Keep a working copy (≤1280) — the crop is baked at save time
      const sc = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      setPhotoSrc(c.toDataURL('image/jpeg', 0.85));
      setPhotoDims({ w: c.width, h: c.height });
      setPos({ fx: 0.5, fy: 0.5 });
      setPhoto(undefined);
    };
    img.src = url;
  }

  function onDragStart(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX, y: e.clientY, fx: pos.fx, fy: pos.fy };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current || !photoDims || !previewRef.current) return;
    const size = previewRef.current.clientWidth;
    const { w, h } = photoDims;
    const side = Math.min(w, h);
    const overX = size * (w - side) / side;
    const overY = size * (h - side) / side;
    const dfx = overX > 0 ? (dragRef.current.x - e.clientX) / overX : 0;
    const dfy = overY > 0 ? (dragRef.current.y - e.clientY) / overY : 0;
    setPos({
      fx: Math.min(1, Math.max(0, dragRef.current.fx + dfx)),
      fy: Math.min(1, Math.max(0, dragRef.current.fy + dfy)),
    });
  }
  function onDragEnd() { dragRef.current = null; }

  async function bakeCrop(): Promise<string | undefined> {
    if (!photoSrc || !photoDims) return photo;
    const img = new Image();
    img.src = photoSrc;
    try { await img.decode(); } catch { return photo; }
    const { w, h } = photoDims;
    const side = Math.min(w, h);
    const c = document.createElement('canvas');
    c.width = 640; c.height = 640;
    const ctx = c.getContext('2d');
    if (!ctx) return photo;
    ctx.drawImage(img, pos.fx * (w - side), pos.fy * (h - side), side, side, 0, 0, 640, 640);
    return c.toDataURL('image/jpeg', 0.8);
  }

  function inferOvenTemp(): OvenTempTag {
    const votes: Record<OvenTempTag, number> = { high: 0, mid: 0, low: 0 };
    const refIds = picked.filter(p => p.refId).map(p => p.refId as string);
    [...PIZZAS, ...DESSERT_PIZZAS].forEach(p => {
      const hits = p.ingredients.filter(ing => ing && refIds.includes(ing.id)).length;
      if (hits > 0) votes[p.ovenTemp] += hits;
    });
    const best = (Object.entries(votes) as Array<[OvenTempTag, number]>).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'high';
  }

  async function save() {
    if (!name.trim() || picked.length === 0) return;
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'pizza';
    saveCustomPizza({
      id: initial?.id ?? `custom_${slug}_${Date.now()}`,
      name: name.trim(),
      ovenTemp: inferOvenTemp(),
      ingredients: picked,
      createdAt: initial?.createdAt ?? Date.now(),
      photo: await bakeCrop(),
    });
    onCreated(); onClose();
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
            {initial ? (fr ? 'Modifier ma pizza' : 'Edit my pizza') : (fr ? 'Créer ma pizza' : 'Create my pizza')}
          </span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F5F0E8', border: 'none', fontSize: 14, color: '#8A7F78', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 14px' }}>
          {/* Name + photo */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ width: 56, height: 56, borderRadius: '12px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: '1px dashed #C8C0B8', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={attachPhoto} />
              {photoSrc ? (
                <img src={photoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.fx * 100}% ${pos.fy * 100}%` }} />
              ) : photo ? (
                <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg viewBox="0 0 20 20" width={20} height={20} fill="none" stroke="#8A7F78" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 7.5A1.5 1.5 0 012.5 6h.879a2 2 0 001.664-.89l.812-1.22A2 2 0 017.519 3h4.962a2 2 0 011.664.89l.812 1.22A2 2 0 0016.62 6H17.5A1.5 1.5 0 0119 7.5v8A1.5 1.5 0 0117.5 17h-15A1.5 1.5 0 011 15.5v-8z"/>
                  <circle cx="10" cy="11" r="3"/>
                </svg>
              )}
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={fr ? 'Nom de votre pizza' : 'Your pizza name'}
              style={{ ...input, fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: '16px' }}
            />
          </div>
          {photoSrc && photoDims && (
            <div style={{ marginTop: '10px' }}>
              <div
                ref={previewRef}
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                style={{
                  width: '180px', height: '180px', borderRadius: '12px', overflow: 'hidden',
                  border: '1px solid #E0D8CF', touchAction: 'none', cursor: 'grab',
                  position: 'relative', background: '#1A1612',
                }}
              >
                <img
                  src={photoSrc} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.fx * 100}% ${pos.fy * 100}%`, pointerEvents: 'none', userSelect: 'none' }}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '10.5px', fontStyle: 'italic', color: '#8A7F78', marginTop: '4px' }}>
                {fr ? 'Glissez pour recadrer' : 'Drag to reframe'}
              </div>
            </div>
          )}
          {(photo || photoSrc) && (
            <button onClick={() => { setPhoto(undefined); setPhotoSrc(null); setPhotoDims(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '10.5px', fontFamily: 'var(--font-dm-mono)', textDecoration: 'underline', padding: '4px 0 0' }}>
              {fr ? 'Retirer la photo' : 'Remove photo'}
            </button>
          )}

          {/* Picked list */}
          {picked.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {picked.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#F5F0E8', border: '1px solid #E8E0D5', borderRadius: '10px', padding: '7px 10px' }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: '#1A1612', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fr ? p.nameFr : p.nameEn}{p.free ? ' ✎' : ''}
                  </span>
                  <input
                    type="number" inputMode="numeric" value={p.amount}
                    onChange={e => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      setPicked(prev => prev.map((x, j) => j === i ? { ...x, amount: v } : x));
                    }}
                    style={{ width: '50px', border: '1px solid #E0D8CF', borderRadius: '6px', padding: '4px 6px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', textAlign: 'right', background: '#FDFBF7' }}
                  />
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: '#8A7F78', width: '34px' }}>{p.unit}</span>
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

          {/* Guided groups */}
          {GROUPS.map((g, gi) => {
            const opts = catalogue.filter(ing => g.cats.includes(ing.category));
            const isOpen = openGroup === gi;
            const f = free[gi] ?? { name: '', amount: '50', unit: 'g' as IngredientUnit };
            const nPicked = picked.filter(p => g.cats.includes(p.category)).length;
            return (
              <div key={gi} style={{ marginTop: '12px', border: '1px solid #F0EAE3', borderRadius: '12px', overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenGroup(isOpen ? -1 : gi)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', background: '#F5F0E8', border: 'none', cursor: 'pointer' }}
                >
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: '#C4522A', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 700 }}>
                    {fr ? g.fr : g.en}{nPicked > 0 ? ` · ${nPicked} ✓` : ''}
                  </span>
                  <span style={{ color: '#8A7F78', fontSize: '12px' }}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '132px', overflowY: 'auto' }}>
                      {opts.map(ing => {
                        const on = picked.some(x => x.refId === ing.id);
                        const style = {
                          border: on ? '1.5px solid #6B7A5A' : '1px solid #E8E0D5',
                          borderRadius: '16px', padding: '6px 11px',
                          background: on ? 'rgba(107,122,90,0.10)' : '#FDFBF7', cursor: 'pointer',
                          fontFamily: 'var(--font-dm-sans)', fontSize: '12.5px',
                          color: on ? '#4E5B42' : '#1A1612',
                        };
                        const label = on ? '\u2713 ' + ing.name[l] : ing.name[l] + ' +';
                        return (
                          <button
                            key={ing.id}
                            onClick={() => on ? setPicked(prev => prev.filter(x => x.refId !== ing.id)) : add(ing)}
                            style={style}
                          >{label}</button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px' }}>
                      <input value={f.name}
                        onChange={e => setFree(prev => ({ ...prev, [gi]: { ...f, name: e.target.value } }))}
                        placeholder={fr ? 'Autre — texte libre' : 'Other — free text'}
                        style={{ ...input, flex: 1, width: 'auto', padding: '7px 10px', fontSize: '13px' }} />
                      <input type="number" inputMode="numeric" value={f.amount}
                        onChange={e => setFree(prev => ({ ...prev, [gi]: { ...f, amount: e.target.value } }))}
                        style={{ ...input, width: '56px', padding: '7px 6px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', textAlign: 'right' }} />
                      <select value={f.unit}
                        onChange={e => setFree(prev => ({ ...prev, [gi]: { ...f, unit: e.target.value as IngredientUnit } }))}
                        style={{ ...input, width: '72px', padding: '7px 4px', fontFamily: 'var(--font-dm-mono)', fontSize: '12px' }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button onClick={() => addFree(gi)} disabled={!f.name.trim()} style={{
                        border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: f.name.trim() ? 'pointer' : 'default',
                        background: f.name.trim() ? '#6B7A5A' : '#E0D8CF', color: 'white',
                        fontFamily: 'var(--font-dm-sans)', fontSize: '13px', fontWeight: 600, flexShrink: 0,
                      }}>+</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Save bar */}
        <div style={{ borderTop: '1px solid #F0EAE3', padding: '12px 14px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
          <button onClick={save} disabled={!canSave} style={{
            width: '100%', border: 'none', borderRadius: '12px', padding: '13px',
            background: canSave ? '#C4522A' : '#E0D8CF', color: 'white', cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'var(--font-dm-sans)', fontSize: '15px', fontWeight: 700,
          }}>
            {initial ? (fr ? 'Enregistrer les modifications' : 'Save changes') : (fr ? 'Enregistrer ma pizza' : 'Save my pizza')}
          </button>
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: '#8A7F78', textAlign: 'center', marginTop: '6px' }}>
            {fr ? 'Sauvegardée dans votre profil — modifiable à tout moment.' : 'Saved to your profile — editable any time.'}
          </div>
        </div>
      </div>
    </>
  );
}
