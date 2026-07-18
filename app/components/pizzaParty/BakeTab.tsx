'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PIZZAS, DESSERT_PIZZAS, getCustomPizzaList, type Pizza } from '../../lib/toppingDatabase';
import type { StyleKey, IngredientCategory, Ingredient } from '../../lib/toppingTypes';
import { createClient } from '@/app/lib/supabase/client';
import { uploadPhoto, ALLOWED_MIME_TYPES } from '@/app/lib/photoUpload';
import type { User } from '@supabase/supabase-js';
import { useRef } from 'react';

// Word units need a space and a FR translation — raw join produced "5leaves".
const UNIT_LABELS: Record<string, { en: string; fr: string }> = {
  g: { en: 'g', fr: 'g' },
  ml: { en: 'ml', fr: 'ml' },
  leaves: { en: ' leaves', fr: ' feuilles' },
  pcs: { en: ' pcs', fr: ' pcs' },
  pinch: { en: ' pinch', fr: ' pincée' },
  sprigs: { en: ' sprigs', fr: ' brins' },
  tbsp: { en: ' tbsp', fr: ' c.à.s.' },
  slices: { en: ' slices', fr: ' tranches' },
  drizzle: { en: ' drizzle', fr: ' filet' },
};
function fmtQtyUnit(amount: number | string, unit: string, fr: boolean): string {
  const u = UNIT_LABELS[unit] ? UNIT_LABELS[unit][fr ? 'fr' : 'en'] : ' ' + unit;
  return `${amount}${u}`;
}

// ── AU FOUR / IN THE OVEN guidance ───────────────────────────────────────────
// Oven-aware bake guidance: session ovenType × the pizza's ovenTemp tag.
// Observations, never alarms. One or two short lines.
type OvenTempKey = 'high' | 'mid' | 'low';
type OvenGuideLines = { en: string[]; fr: string[] };
type OvenGuide = Record<OvenTempKey, OvenGuideLines>;

const PIZZA_OVEN_GUIDE: OvenGuide = {
  high: {
    en: ['≈ 60–90 s — quarter-turn every 20–30 s.', 'Leoparding comes fast: ready once the cornicione is puffed and spotted.'],
    fr: ["≈ 60–90 s — tourner d'un quart toutes les 20–30 s.", 'Le léopardage vient vite : prête dès que le cornicione est gonflé et tacheté.'],
  },
  mid: {
    en: ['Let the flame settle a little: ≈ 90–120 s, quarter-turn every 30 s.', 'Delicate toppings prefer this gentler heat.'],
    fr: ['Flamme un peu retombée : ≈ 90–120 s, un quart de tour toutes les 30 s.', 'Les garnitures délicates préfèrent cette chaleur plus douce.'],
  },
  low: {
    en: ['Oven mouth, gentle heat: ≈ 2–3 min, turning regularly.', 'A golden base is enough — sweet toppings colour quickly.'],
    fr: ['En bouche de four, chaleur douce : ≈ 2–3 min en tournant régulièrement.', 'Une base dorée suffit — les garnitures sucrées colorent vite.'],
  },
};

const STONE_GUIDE: OvenGuide = {
  high: {
    en: ['≈ 5–7 min on a well-preheated stone — rotate halfway.', 'The stone gives its best after 45–60 min of preheating.'],
    fr: ['≈ 5–7 min sur pierre bien préchauffée — tourner à mi-cuisson.', 'La pierre donne le meilleur après 45–60 min de préchauffage.'],
  },
  mid: {
    en: ['≈ 6–8 min on the stone — rotate halfway.', 'One rack lower lets the top brown without rushing the toppings.'],
    fr: ['≈ 6–8 min sur pierre — tourner à mi-cuisson.', 'Une grille un cran plus bas laisse dorer le dessus sans brusquer les garnitures.'],
  },
  low: {
    en: ['≈ 7–9 min on the stone, middle rack.', 'Colour is a better guide than the clock — sugar browns quickly.'],
    fr: ['≈ 7–9 min sur pierre, grille médiane.', 'La couleur guide mieux que le chrono — le sucre dore vite.'],
  },
};

const STANDARD_GUIDE: OvenGuide = {
  high: {
    en: ['≈ 8–10 min, top rack — finish 60 s under the broiler if it looks pale.', 'An upside-down baking sheet, well preheated, gets close to a stone.'],
    fr: ['≈ 8–10 min, grille haute — finir 60 s sous le gril si elle reste pâle.', "Une plaque retournée et bien préchauffée s'approche de l'effet pierre."],
  },
  mid: {
    en: ['≈ 9–11 min, upper-middle rack.', 'A short broil at the very end brings back colour if needed.'],
    fr: ['≈ 9–11 min, grille médiane-haute.', 'Un passage court sous le gril en toute fin redonne de la couleur si besoin.'],
  },
  low: {
    en: ['≈ 10–12 min, middle rack.', 'The base is ready when it lifts in one piece without folding.'],
    fr: ['≈ 10–12 min, grille médiane.', "La base est prête quand elle se soulève d'un seul geste sans plier."],
  },
};

const ELECTRIC_GUIDE: OvenGuide = {
  high: {
    en: ['≈ 2–3 min — keep an eye on the underside.', 'The base element marks quickly: a quarter-turn halfway evens it out.'],
    fr: ['≈ 2–3 min — surveiller le dessous.', 'La sole marque vite : un quart de tour à mi-cuisson égalise la couleur.'],
  },
  mid: {
    en: ['One notch lower: ≈ 3–4 min.', 'Delicate toppings appreciate the slightly longer bake.'],
    fr: ['Thermostat un cran plus bas : ≈ 3–4 min.', 'Les garnitures délicates apprécient cette cuisson un peu plus longue.'],
  },
  low: {
    en: ['Reduced power: ≈ 4–5 min.', 'The underside colours before the top — a peek around 3 min tells you where it is.'],
    fr: ['Puissance réduite : ≈ 4–5 min.', "Le dessous colore avant le dessus — un coup d'œil vers 3 min situe la cuisson."],
  },
};

const STEAM_GUIDE: OvenGuide = {
  high: {
    en: ['Steam off for pizza: ≈ 6–8 min on a well-preheated stone or tray.', "Steam serves bread — pizza crust prefers dry heat."],
    fr: ['Sans vapeur pour la pizza : ≈ 6–8 min sur pierre ou plaque bien préchauffée.', 'La vapeur sert le pain — la croûte de pizza préfère la chaleur sèche.'],
  },
  mid: {
    en: ['Steam off: ≈ 7–9 min, upper-middle rack.', 'Delicate toppings settle in nicely at this pace.'],
    fr: ['Sans vapeur : ≈ 7–9 min, grille médiane-haute.', 'Les garnitures délicates apprécient ce rythme.'],
  },
  low: {
    en: ['Steam off, moderate heat: ≈ 8–10 min.', 'Colour is a better guide than the clock — sugar browns quickly.'],
    fr: ['Sans vapeur, chaleur modérée : ≈ 8–10 min.', 'La couleur guide mieux que le chrono — le sucre dore vite.'],
  },
};

const DUTCH_GUIDE: OvenGuide = {
  high: {
    en: ['≈ 8–10 min, top rack, oven at max.', 'The Dutch oven shines for bread — for pizza, a well-preheated tray takes over.'],
    fr: ['≈ 8–10 min, grille haute, four au maximum.', 'La cocotte brille pour le pain — pour la pizza, une plaque bien préchauffée prend le relais.'],
  },
  mid: {
    en: ['≈ 9–11 min, upper-middle rack on a preheated tray.', 'A short broil at the very end brings back colour if needed.'],
    fr: ['≈ 9–11 min, grille médiane-haute sur plaque préchauffée.', 'Un passage court sous le gril en toute fin redonne de la couleur si besoin.'],
  },
  low: {
    en: ['≈ 10–12 min, middle rack on a preheated tray.', 'The base is ready when it lifts in one piece without folding.'],
    fr: ['≈ 10–12 min, grille médiane sur plaque préchauffée.', "La base est prête quand elle se soulève d'un seul geste sans plier."],
  },
};

const FALLBACK_GUIDE: OvenGuide = {
  high: {
    en: ['Oven at max on a well-preheated surface: ≈ 5–8 min depending on power.', 'Rotate halfway for even colour.'],
    fr: ['Four au maximum sur support bien préchauffé : ≈ 5–8 min selon la puissance.', 'Tourner à mi-cuisson pour une couleur régulière.'],
  },
  mid: {
    en: ['Slightly gentler heat: ≈ 7–9 min.', 'Delicate toppings prefer this pace.'],
    fr: ['Chaleur un peu plus douce : ≈ 7–9 min.', 'Les garnitures délicates préfèrent ce rythme.'],
  },
  low: {
    en: ['Moderate heat: ≈ 8–10 min.', 'Colour is a better guide than the clock — sugar browns quickly.'],
    fr: ['Chaleur modérée : ≈ 8–10 min.', 'La couleur guide mieux que le chrono — le sucre dore vite.'],
  },
};

// All 9 oven types (4 pizza + 5 bread) — bread ovens map to their closest
// pizza behaviour so the section stays useful whatever the session carries.
const OVEN_GUIDANCE: Record<string, OvenGuide> = {
  pizza_oven: PIZZA_OVEN_GUIDE,
  wood_fired: PIZZA_OVEN_GUIDE,
  home_oven_steel: STONE_GUIDE,
  home_oven_stone_bread: STONE_GUIDE,
  home_oven_standard: STANDARD_GUIDE,
  standard_bread: STANDARD_GUIDE,
  electric_pizza: ELECTRIC_GUIDE,
  steam_oven: STEAM_GUIDE,
  dutch_oven: DUTCH_GUIDE,
};

function getOvenGuidance(ovenType: string | undefined, ovenTemp: OvenTempKey, l: 'en' | 'fr'): string[] {
  const guide = (ovenType && OVEN_GUIDANCE[ovenType]) || FALLBACK_GUIDE;
  return (guide[ovenTemp] ?? guide.high)[l];
}


interface BakeTabProps {
  selectedPizzas: Record<string, number>;
  locale: string;
  styleKey?: string;
  kitchenTemp?: number;
  prefermentType?: string;
  bakeEventId?: string | null;
  ovenType?: string;
  onEnsureBakeEvent?: () => Promise<string | null>;
  onShare?: () => void;
  sessionSaved?: boolean;
  onBakedQtysChange?: (qtys: Record<string, number>) => void;
}

function getAllPizzas(): Pizza[] {
  return [...PIZZAS, ...DESSERT_PIZZAS, ...getCustomPizzaList()];
}

const ORDER_MAP: Record<IngredientCategory, number> = {
  sauce: 1, base: 1,
  cheese: 2,
  meat: 3, seafood: 3,
  veg: 4,
  spice: 5,
  finish: 6,
};

// ── Inline CoachButton (self-contained, no external deps beyond React) ────────
const COACH_STEPS_BT = new Set(['pizza_maestro']);

const MAESTRO_CONTENT_BT: Record<string, {
  question: { en: string; fr: string };
  instruction?: { en: string; fr: string };
}> = {
  pizza_maestro: {
    question: { en: 'How is my pizza looking?', fr: 'Comment va ma pizza ?' },
    instruction: { en: 'Photo your base, topped pizza, or fresh from the oven', fr: 'Photographiez votre base, pizza garnie, ou à la sortie du four' },
  },
};

function CoachButton({
  stepId, styleKey, kitchenTemp, prefermentType, locale, ovenType, pizzaName, imageBase64,
  photoOverlay, beforeBake, afterBake,
}: {
  stepId: string;
  styleKey: string;
  kitchenTemp: number;
  prefermentType?: string;
  locale: string;
  ovenType?: string;
  pizzaName?: string;
  imageBase64?: string;
  photoOverlay?: boolean;
  beforeBake?: string[];
  afterBake?: string[];
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const l = locale === 'fr' ? 'fr' : 'en';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true); setFeedback(null); setError(false);
    try {
      // Resize to max 1024px before encoding — keeps payload
      // under Vercel's 4.5MB limit regardless of photo size
      const resized = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 1024;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas unavailable')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });

      const base64 = resized.split(',')[1];
      const mimeType = 'image/jpeg';

      const res = await fetch('/api/bake-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          stepId,
          styleKey,
          kitchenTemp,
          prefermentType,
          locale,
          ovenType,
          pizzaName,
          beforeBake,
          afterBake,
        }),
      });

      const data = await res.json();
      if (data.feedback) setFeedback(data.feedback);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageBase64(base64: string) {
    setLoading(true); setFeedback(null); setError(false);
    try {
      const res = await fetch('/api/bake-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', stepId, styleKey, kitchenTemp, prefermentType, locale, ovenType, pizzaName, beforeBake, afterBake }),
      });
      const data = await res.json();
      if (data.feedback) setFeedback(data.feedback);
      else setError(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  }

  if (!COACH_STEPS_BT.has(stepId)) return null;

  // Photo overlay mode — button sits on top of the photo, feedback appears below
  if (photoOverlay) {
    return (
      <div>
        {!feedback && (
          <div style={{
            position: 'absolute', bottom: '14px', left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
          }}>
            <button
              onClick={() => { if (imageBase64) { handleImageBase64(imageBase64); } else { fileInputRef.current?.click(); } }}
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(26,22,18,0.82)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(245,240,232,0.22)',
                borderRadius: '20px', padding: '8px 18px',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1.5px solid rgba(245,240,232,0.3)', borderTop: '1.5px solid #F5F0E8', borderRadius: '50%', animation: 'bh-spin 0.7s linear infinite' }} />
              ) : (
                <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="#F5F0E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12"/>
                </svg>
              )}
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: loading ? 'rgba(245,240,232,0.6)' : '#F5F0E8', whiteSpace: 'nowrap' }}>
                {loading
                  ? (l === 'fr' ? 'Le Maestro regarde...' : 'Maestro is looking...')
                  : (l === 'fr' ? 'Demander au Maestro ✦' : 'Ask Maestro ✦')}
              </span>
            </button>
          </div>
        )}
        {feedback && (
          <div style={{ background: '#1A1612', borderLeft: '3px solid #C4522A', borderRadius: '10px', padding: '12px 14px', margin: '0 16px 10px', position: 'relative' }}>
            <div style={{ color: '#F5F0E8', fontSize: '13px', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.6 }}>{feedback}</div>
            <button onClick={() => { setFeedback(null); setError(false); }}
              style={{ position: 'absolute', bottom: '8px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '11px', fontFamily: 'var(--font-dm-mono)', textDecoration: 'underline', padding: 0 }}>
              {l === 'fr' ? 'Reprendre' : 'Retake'}
            </button>
          </div>
        )}
        {error && !feedback && (
          <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic', padding: '8px 16px' }}>
            {l === 'fr' ? 'Maestro indisponible. Réessayez.' : 'Maestro unavailable. Please try again.'}
          </div>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFile} />
      </div>
    );
  }

  return (
    <div style={{ marginTop: '14px', marginBottom: '4px' }}>
      <input type="file" accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }} ref={fileInputRef} onChange={handleFile} />

      {MAESTRO_CONTENT_BT[stepId]?.question && (
        <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: 'var(--char)', fontWeight: 500, marginBottom: '4px' }}>
          {MAESTRO_CONTENT_BT[stepId].question[l]}
        </div>
      )}
      {MAESTRO_CONTENT_BT[stepId]?.instruction && !imageBase64 && (
        <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--smoke)', fontStyle: 'italic', marginBottom: '8px' }}>
          {MAESTRO_CONTENT_BT[stepId].instruction![l]}
        </div>
      )}

      {feedback && (
        <div style={{ background: '#1A1612', borderLeft: '3px solid #C4522A', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px', position: 'relative' }}>
          <div style={{ color: '#F5F0E8', fontSize: '13px', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.6 }}>{feedback}</div>
          <button onClick={() => { setFeedback(null); setError(false); }}
            style={{ position: 'absolute', bottom: '8px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#8A7F78', fontSize: '11px', fontFamily: 'var(--font-dm-mono)', textDecoration: 'underline', padding: 0 }}>
            {l === 'fr' ? 'Reprendre' : 'Retake'}
          </button>
        </div>
      )}
      {error && !feedback && (
        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic', marginBottom: '8px' }}>
          {l === 'fr' ? 'Maestro indisponible. Réessayez.' : 'Maestro unavailable. Please try again.'}
        </div>
      )}
      {!feedback && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={() => { if (imageBase64) { handleImageBase64(imageBase64); } else { fileInputRef.current?.click(); } }} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1A1612', border: '1px solid rgba(245,240,232,0.15)', borderRadius: '20px', padding: '4px 12px', cursor: loading ? 'default' : 'pointer', height: '28px', opacity: loading ? 0.7 : 1 }}>
            {loading ? (
              <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1.5px solid rgba(245,240,232,0.3)', borderTop: '1.5px solid #F5F0E8', borderRadius: '50%', animation: 'bh-spin 0.7s linear infinite', flexShrink: 0 }} />
            ) : (
              <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="#F5F0E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12"/>
              </svg>
            )}
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: loading ? 'rgba(245,240,232,0.6)' : '#F5F0E8', whiteSpace: 'nowrap' }}>
              {loading ? (l === 'fr' ? 'Le Maestro regarde...' : 'Maestro is looking...') : (l === 'fr' ? 'Demander au Maestro' : 'Ask Maestro')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function BakeTab({ selectedPizzas, locale, styleKey, kitchenTemp, prefermentType, bakeEventId, ovenType, onEnsureBakeEvent, onShare, sessionSaved, onBakedQtysChange }: BakeTabProps) {
  const t = useTranslations('bake');
  const l = locale as 'en' | 'fr';
  const [sheetPizzaId, setSheetPizzaId] = useState<string | null>(null);
  const [showTechSheet, setShowTechSheet] = useState(false);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [doneCounts, setDoneCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (Object.values(doneCounts).every(v => v === 0)) return;
    const save = async () => {
      let id = bakeEventId;
      if (!id && onEnsureBakeEvent) id = await onEnsureBakeEvent();
      if (!id) return;
      const { saveBakedQtys } = await import('@/app/lib/supabase/saveBakeEvent');
      await saveBakedQtys(id, doneCounts);
    };
    save();
  }, [doneCounts, bakeEventId, onEnsureBakeEvent]);

  useEffect(() => {
    onBakedQtysChange?.(doneCounts);
  }, [doneCounts, onBakedQtysChange]);

  const [user, setUser] = useState<User | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<Record<string, string>>({});
  const [photoWarn, setPhotoWarn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

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

  function changeDoneCount(pizzaId: string, delta: number) {
    setDoneCounts(prev => {
      const current = prev[pizzaId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [pizzaId]: next };
    });
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sheetPizzaId) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) return;

    // Encode to base64 for Maestro reuse (both logged-in and anonymous)
    const encodeBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unavailable')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = reject;
      img.src = objectUrl;
    });

    const b64 = await encodeBase64(file).catch(() => null);
    if (b64) setPhotoBase64(prev => ({ ...prev, [sheetPizzaId]: b64 }));

    if (!user) {
      const url = URL.createObjectURL(file);
      setPhotos(prev => ({ ...prev, [sheetPizzaId]: url }));
      return;
    }

    setUploadingSlot(sheetPizzaId);
    try {
      const slotIndex = selectedEntries.findIndex(e => e.pizza.id === sheetPizzaId);
      const evId = bakeEventId ?? (onEnsureBakeEvent ? await onEnsureBakeEvent() : null);
      const result = await uploadPhoto(file, user.id, evId, slotIndex >= 0 ? slotIndex : null);
      setPhotos(prev => ({ ...prev, [sheetPizzaId]: result.url }));
      if (result.warned) setPhotoWarn(true);
    } catch (err) {
      console.error('Photo upload failed:', err);
      const url = URL.createObjectURL(file);
      setPhotos(prev => ({ ...prev, [sheetPizzaId]: url }));
    } finally {
      setUploadingSlot(null);
    }
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
    if (img.src.endsWith(`${pizzaId}_pan.webp`)) { img.style.display = 'none'; return; }
    if (img.src.endsWith(`${pizzaId}.webp`)) {
      // Some pizzas only ship a _pan visual (Detroit, Chicago, cheeseburger)
      img.src = `/pizzas/${pizzaId}_pan.webp`;
      return;
    }
    img.src = `/pizzas/${pizzaId}.webp`;
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

  const sheetEntry = sheetPizzaId ? selectedEntries.find(e => e.pizza.id === sheetPizzaId) : null;

  // ── GRID VIEW (always rendered) ──────────────────────────────────────────────
  return (
    <div>
      <style>{`
        @keyframes bh-spin { to { transform: rotate(360deg); } }
        @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes bhPopIn { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.25); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes bhChipIn { from { transform: translateY(6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

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
                ? (l === 'fr' ? 'Toutes les pizzas cuites !' : 'All pizzas baked!')
                : (l === 'fr'
                  ? `${totalDone} / ${totalOrdered} cuites`
                  : `${totalDone} / ${totalOrdered} baked`)}
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                background: totalDone >= totalOrdered ? '#6B7A5A' : 'var(--terra)',
                width: `${Math.min(100, (totalDone / totalOrdered) * 100)}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            {totalDone >= totalOrdered && onShare && (
              <button
                onClick={onShare}
                style={{
                  marginTop: '10px', padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(212,168,83,0.5)',
                  color: '#D4A853',
                  fontFamily: 'DM Mono, monospace', fontSize: '11px',
                  borderRadius: '8px', cursor: 'pointer',
                  letterSpacing: '.06em',
                }}
              >
                {sessionSaved
                  ? (l === 'fr' ? '✦ Partager ce bake' : '✦ Share this bake')
                  : (l === 'fr' ? '✦ Sauvegarder & Partager' : '✦ Save & Share this bake')}
              </button>
            )}
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
            const bakedCount = doneCounts[pizza.id] ?? 0;
            // Lightly muted when done — still clearly visible, since real
            // parties rebake favourites beyond the plan.
            const cardDone = qty > 0 && bakedCount >= qty;
            return (
              <div
                key={pizza.id}
                onClick={() => setSheetPizzaId(pizza.id)}
                style={{
                  border: cardDone ? '1px solid rgba(107,122,90,0.45)' : '1px solid var(--border)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(26,22,18,0.06)',
                }}
              >
                <div style={{ height: '160px', background: '#1A1612', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={getImageSrc(pizza.id)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                      filter: cardDone ? 'saturate(0.72) brightness(0.94)' : 'none',
                      opacity: cardDone ? 0.92 : 1,
                      transition: 'filter 0.25s ease, opacity 0.25s ease' }}
                    onError={e => handleImageError(e, pizza.id)}
                  />
                  {(() => {
                    const baked = bakedCount;
                    if (baked === 0) return null;
                    const allDone = baked >= qty;
                    return (
                      <div style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: baked > qty ? '#D4A853' : '#6B7A5A', borderRadius: '12px',
                        padding: '3px 8px',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        {allDone && (
                          <svg viewBox="0 0 10 10" width={10} height={10} fill="none"
                            stroke="white" strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1.5 5l2.5 2.5 4.5-4.5"/>
                          </svg>
                        )}
                        <span style={{
                          fontFamily: 'DM Mono, monospace', fontSize: '11px',
                          color: 'white', fontWeight: 700, lineHeight: 1,
                        }}>
                          {baked}/{qty}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 700, color: 'var(--char)' }}>
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
            );
          })}
        </div>
      )}

      {/* ── Bottom sheet ──────────────────────────────────────────────────────── */}
      {sheetPizzaId && sheetEntry && (() => {
        const { pizza, qty } = sheetEntry;
        const beforeIngredients = pizza.ingredients
          .filter(i => getEffectiveBakeOrder(i) === 'before')
          .sort((a, b) => (ORDER_MAP[a.category] ?? 5) - (ORDER_MAP[b.category] ?? 5));
        const afterIngredients = pizza.ingredients
          .filter(i => getEffectiveBakeOrder(i) === 'after');
        const assemblyNote = (styleKey === 'roman' || styleKey === 'pan')
          ? t(`assembly.${styleKey}`)
          : null;
        const baked = doneCounts[sheetPizzaId] ?? 0;

        return (
          <>
            {/* Scrim */}
            <div
              onClick={() => { setSheetPizzaId(null); setShowTechSheet(false); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 190 }}
            />

            {/* Sheet */}
            <div ref={sheetScrollRef} style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: 'var(--warm)',
              borderRadius: '16px 16px 0 0',
              zIndex: 200,
              maxHeight: 'calc(100dvh - 60px)',
              overflowY: 'auto',
              animation: 'slideUpSheet 0.3s ease',
            }}>
              {/* Drag handle */}
              <div style={{
                width: 36, height: 4,
                background: 'rgba(0,0,0,0.15)',
                borderRadius: 2,
                margin: '14px auto 10px',
              }} />

              {/* Sheet header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '0 16px 12px',
                borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <span style={{
                    fontFamily: 'var(--font-playfair)',
                    fontSize: '18px', fontWeight: 700,
                    color: 'var(--char)',
                  }}>
                    {pizza.name[l]}
                  </span>
                  {qty > 1 && (
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '13px', color: 'var(--smoke)', marginLeft: '6px' }}>
                      &times;{qty}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setSheetPizzaId(null); setShowTechSheet(false); }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '1px solid var(--border)',
                    background: 'var(--cream)',
                    cursor: 'pointer', fontSize: 16, lineHeight: 1,
                    color: 'var(--smoke)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >×</button>
              </div>

              {/* Hero image */}
              <div style={{ width: '100%', height: '180px', background: '#1A1612', overflow: 'hidden' }}>
                <img
                  src={getImageSrc(pizza.id)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => handleImageError(e, pizza.id)}
                />
              </div>

              {/* Assembly note */}
              {assemblyNote && (
                <div style={{
                  margin: '12px 16px',
                  padding: '10px 12px',
                  background: 'rgba(196,82,42,0.06)',
                  border: '1px solid rgba(196,82,42,0.2)',
                  borderRadius: '10px',
                  fontSize: '12px', color: 'var(--ash)',
                  fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5,
                }}>
                  {assemblyNote}
                </div>
              )}

              {/* BEFORE section */}
              {beforeIngredients.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 16px 4px' }}>
                    <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: 'var(--terra)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--terra)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>
                      {getBeforeLabel()}
                    </span>
                  </div>
                  {beforeIngredients.map((ing, i) => (
                    <div key={ing.id} style={{
                      display: 'flex', flexDirection: 'column',
                      padding: '10px 16px',
                      borderBottom: i < beforeIngredients.length - 1
                        ? '1px solid var(--border)' : undefined,
                      gap: '2px',
                    }}>
                      {/* Ingredient name — full width, no competition */}
                      <span style={{
                        fontFamily: 'Playfair Display, serif',
                        fontSize: '15px', fontWeight: 600,
                        color: 'var(--char)',
                      }}>
                        {ing.name[l]}
                      </span>
                      {/* Qty + hint — right-aligned below name */}
                      {ing.qtyPerPizza && (
                        <div style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'flex-end', gap: '1px',
                        }}>
                          <span style={{
                            fontFamily: 'var(--font-dm-mono)',
                            fontSize: '12px', color: 'var(--smoke)',
                          }}>
                            {fmtQtyUnit(ing.qtyPerPizza.amount, ing.qtyPerPizza.unit, l === 'fr')} {t('perPizza')}
                          </span>
                          {(l === 'fr'
                            ? ing.qtyPerPizza.noteFR
                            : ing.qtyPerPizza.noteEN) && (
                            <span style={{
                              fontFamily: 'var(--font-dm-mono)',
                              fontSize: '11px', color: 'var(--smoke)',
                              opacity: 0.70, fontStyle: 'italic',
                            }}>
                              {l === 'fr'
                                ? ing.qtyPerPizza.noteFR
                                : ing.qtyPerPizza.noteEN}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* AU FOUR / IN THE OVEN section */}
              {(() => {
                const lines = getOvenGuidance(ovenType, pizza.ovenTemp, l);
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 16px 4px' }}>
                      <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: 'var(--bread)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--bread)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>
                        {t('section.oven')}
                      </span>
                    </div>
                    <div style={{ padding: '8px 16px 2px' }}>
                      <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: 'var(--ash)', lineHeight: 1.6 }}>
                        {lines[0]}
                      </div>
                      {lines[1] && (
                        <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '12px', color: 'var(--smoke)', lineHeight: 1.55, marginTop: '3px' }}>
                          {lines[1]}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* AFTER section */}
              {afterIngredients.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 16px 4px' }}>
                    <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: 'var(--gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>
                      {getAfterLabel()}
                    </span>
                  </div>
                  {afterIngredients.map((ing, i) => (
                    <div key={ing.id} style={{
                      display: 'flex', flexDirection: 'column',
                      padding: '10px 16px',
                      borderBottom: i < afterIngredients.length - 1
                        ? '1px solid var(--border)' : undefined,
                      gap: '2px',
                    }}>
                      {/* Ingredient name — full width, no competition */}
                      <span style={{
                        fontFamily: 'Playfair Display, serif',
                        fontSize: '15px', fontWeight: 600,
                        color: 'var(--char)',
                      }}>
                        {ing.name[l]}
                      </span>
                      {/* Qty + hint — right-aligned below name */}
                      {ing.qtyPerPizza && (
                        <div style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'flex-end', gap: '1px',
                        }}>
                          <span style={{
                            fontFamily: 'var(--font-dm-mono)',
                            fontSize: '12px', color: 'var(--smoke)',
                          }}>
                            {fmtQtyUnit(ing.qtyPerPizza.amount, ing.qtyPerPizza.unit, l === 'fr')} {t('perPizza')}
                          </span>
                          {(l === 'fr'
                            ? ing.qtyPerPizza.noteFR
                            : ing.qtyPerPizza.noteEN) && (
                            <span style={{
                              fontFamily: 'var(--font-dm-mono)',
                              fontSize: '11px', color: 'var(--smoke)',
                              opacity: 0.70, fontStyle: 'italic',
                            }}>
                              {l === 'fr'
                                ? ing.qtyPerPizza.noteFR
                                : ing.qtyPerPizza.noteEN}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Technique & tips link */}
              <div style={{ padding: '14px 16px 4px' }}>
                <button
                  onClick={() => setShowTechSheet(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--terra)', fontFamily: 'var(--font-dm-sans)',
                    fontSize: '13px', fontWeight: 500,
                    textDecoration: 'underline', textUnderlineOffset: '3px',
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  {l === 'fr' ? 'Technique & conseils ✦' : 'Technique & tips ✦'}
                </button>
              </div>

              {/* Technique sheet */}
              {showTechSheet && (
                <>
                  <div
                    onClick={() => setShowTechSheet(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210 }}
                  />
                  <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    background: 'var(--warm)', borderRadius: '16px 16px 0 0',
                    zIndex: 220, maxHeight: 'calc(100dvh - 60px)',
                    display: 'flex', flexDirection: 'column',
                    animation: 'slideUpSheet 0.3s ease',
                  }}>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {/* Drag handle */}
                      <div style={{ width: 36, height: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 2, margin: '14px auto 10px' }} />

                      {/* Title */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0 16px 12px', borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', fontWeight: 700, color: 'var(--char)' }}>
                          {l === 'fr' ? 'Étirement & Cuisson' : 'Stretch & Bake'}
                        </span>
                        <button onClick={() => setShowTechSheet(false)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: 16, color: 'var(--smoke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>

                      {/* Sections */}
                      {([
                        {
                          key: 'STRETCH',
                          fr: 'ÉTIREMENT',
                          body: {
                            en: 'Use knuckles and gravity — no rolling pin. Start from the centre, let the weight do the work. Keep the cornicione ring intact. Work quickly once the dough is out of the fridge.',
                            fr: "Utilisez les articulations et la gravité — pas de rouleau. Partez du centre, laissez le poids travailler. Gardez le cornicione intact. Travaillez rapidement une fois la pâte sortie du froid.",
                          },
                        },
                        {
                          key: 'TOP',
                          fr: 'GARNITURE',
                          body: {
                            en: 'Sauce first, then cheese, then toppings. Wet toppings go last or they make the base soggy. Top quickly — exposed dough dries fast.',
                            fr: "Sauce en premier, puis fromage, puis garnitures. Les garnitures humides vont en dernier sinon elles détremperont la base. Garnissez rapidement — la pâte exposée sèche vite.",
                          },
                        },
                        {
                          key: 'LAUNCH',
                          fr: 'ENFOURNEMENT',
                          body: {
                            en: 'Flour the peel well. Build the pizza on the peel, not on the counter. Launch with one confident forward push — hesitation causes sticking.',
                            fr: "Farinez bien la pelle. Montez la pizza sur la pelle, pas sur le plan de travail. Enfournez d'un seul geste confiant vers l'avant — l'hésitation colle.",
                          },
                        },
                        {
                          key: 'WATCH FOR',
                          fr: 'À SURVEILLER',
                          body: {
                            en: 'Leoparding on the cornicione (dark spots) = correct fermentation and heat. Cheese melted and slightly golden = done.',
                            fr: "Léopardage sur le cornicione (taches sombres) = fermentation et chaleur correctes. Fromage fondu et légèrement doré = cuit.",
                          },
                        },
                      ] as const).map(({ key, fr: frKey, body }) => (
                        <div key={key} style={{ padding: '16px 16px 0' }}>
                          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--terra)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '6px' }}>
                            {l === 'fr' ? frKey : key}
                          </div>
                          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '13px', color: 'var(--ash)', lineHeight: 1.6 }}>
                            {body[l]}
                          </div>
                        </div>
                      ))}

                      {/* Maestro in tech sheet */}
                      <div style={{ padding: '20px 16px 8px' }}>
                        <CoachButton
                          stepId="pizza_maestro"
                          styleKey={styleKey ?? 'neapolitan'}
                          kitchenTemp={kitchenTemp ?? 22}
                          prefermentType={prefermentType}
                          locale={l}
                          ovenType={ovenType}
                          pizzaName={pizza.name[l]}
                        />
                      </div>
                    </div>

                    {/* Close bar */}
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
                      <button
                        onClick={() => setShowTechSheet(false)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: 'var(--smoke)', textDecoration: 'underline' }}
                      >
                        {l === 'fr' ? 'Fermer' : 'Close'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Photo soft-warn banner */}
              {photoWarn && (
                <div style={{
                  margin: '8px 16px',
                  padding: '8px 12px',
                  background: 'rgba(212,168,83,0.1)',
                  border: '1px solid rgba(212,168,83,0.3)',
                  borderRadius: '8px', fontSize: '12px', color: 'var(--ash)',
                  fontFamily: 'DM Sans, sans-serif',
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: '8px', lineHeight: 1.4,
                }}>
                  <span>
                    {l === 'fr'
                      ? 'Vous avez 40+ photos. Les plus anciennes sont supprimees apres 50.'
                      : 'You have 40+ photos saved. Oldest are removed automatically after 50.'}
                  </span>
                  <button
                    onClick={() => setPhotoWarn(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--smoke)', fontSize: '14px', lineHeight: 1, flexShrink: 0, padding: 0 }}
                  >x</button>
                </div>
              )}

              {/* Sticky footer: completion chip + photo + baked stepper */}
              {(() => {
                const isComplete = qty > 0 && baked >= qty;
                const nextEntry = isComplete
                  ? selectedEntries.find(e =>
                      e.pizza.id !== sheetPizzaId && (doneCounts[e.pizza.id] ?? 0) < e.qty
                    ) ?? null
                  : null;
                return (
              <div style={{
                position: 'sticky', bottom: 0,
                background: 'var(--warm)',
                borderTop: '1px solid var(--border)',
                paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
              }}>
                {/* Completion chip — additive, never blocks rebaking */}
                {isComplete && nextEntry && (
                  <button
                    onClick={() => {
                      setSheetPizzaId(nextEntry.pizza.id);
                      setShowTechSheet(false);
                      // Instant scroll only — smooth scrolling moves targets under fingers
                      if (sheetScrollRef.current) sheetScrollRef.current.scrollTop = 0;
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: 'calc(100% - 32px)', margin: '10px 16px 0',
                      padding: '13px 16px',
                      background: 'rgba(107,122,90,0.10)',
                      border: '1px solid rgba(107,122,90,0.4)',
                      borderRadius: '12px', cursor: 'pointer',
                      animation: 'bhChipIn 0.25s ease',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '14px', fontWeight: 600, color: '#6B7A5A' }}>
                      {l === 'fr' ? `Suivante : ${nextEntry.pizza.name.fr}` : `Next: ${nextEntry.pizza.name.en}`}
                    </span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '15px', color: '#6B7A5A', lineHeight: 1 }}>→</span>
                  </button>
                )}
                {isComplete && !nextEntry && (
                  <button
                    onClick={() => { setSheetPizzaId(null); setShowTechSheet(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: 'calc(100% - 32px)', margin: '10px 16px 0',
                      padding: '12px 16px', gap: '10px',
                      background: 'rgba(107,122,90,0.10)',
                      border: '1px solid rgba(107,122,90,0.4)',
                      borderRadius: '12px', cursor: 'pointer',
                      animation: 'bhChipIn 0.25s ease', textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '14px', fontWeight: 600, color: '#6B7A5A' }}>
                        {l === 'fr' ? '✓ Toutes les pizzas cuites' : '✓ All pizzas baked'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '12px', fontStyle: 'italic', color: 'var(--smoke)' }}>
                        {l === 'fr' ? 'Belle fournée.' : 'A beautiful bake.'}
                      </span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: 'var(--smoke)', textDecoration: 'underline', flexShrink: 0 }}>
                      {l === 'fr' ? 'Fermer' : 'Close'}
                    </span>
                  </button>
                )}
              <div style={{
                padding: '10px 16px 0',
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                {/* Hidden photo input */}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  id={`photo-${sheetPizzaId}`}
                  onChange={handlePhotoCapture}
                />

                {/* Photo button */}
                <button
                  onClick={() => document.getElementById(`photo-${sheetPizzaId}`)?.click()}
                  disabled={uploadingSlot === sheetPizzaId}
                  title={l === 'fr' ? 'Prendre une photo' : 'Take a photo'}
                  style={{
                    width: 44, height: 44, flexShrink: 0,
                    background: photos[sheetPizzaId] ? 'transparent' : '#F0EAE3',
                    border: photos[sheetPizzaId] ? '1.5px solid #6B7A5A' : '1px solid var(--border)',
                    borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: uploadingSlot === sheetPizzaId ? 'default' : 'pointer',
                    overflow: 'hidden', padding: 0,
                  }}
                >
                  {uploadingSlot === sheetPizzaId ? (
                    <span style={{
                      display: 'block', width: '18px', height: '18px',
                      border: '2px solid var(--border)', borderTop: '2px solid var(--smoke)',
                      borderRadius: '50%', animation: 'bh-spin 0.8s linear infinite',
                    }} />
                  ) : photos[sheetPizzaId] ? (
                    <img src={photos[sheetPizzaId]}
                      style={{ width: 44, height: 44, objectFit: 'cover' }} alt="" />
                  ) : (
                    <svg viewBox="0 0 20 20" width={18} height={18} fill="none"
                      stroke="var(--smoke)" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 7.5A1.5 1.5 0 012.5 6h.879a2 2 0 001.664-.89l.812-1.22A2 2 0 017.519 3h4.962a2 2 0 011.664.89l.812 1.22A2 2 0 0016.62 6H17.5A1.5 1.5 0 0119 7.5v8A1.5 1.5 0 0117.5 17h-15A1.5 1.5 0 011 15.5v-8z"/>
                      <circle cx="10" cy="11" r="3"/>
                    </svg>
                  )}
                </button>

                {/* Baked stepper */}
                <div style={{
                  flex: 1, height: '44px',
                  display: 'flex', alignItems: 'center',
                  background: '#F5F0E8',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => changeDoneCount(sheetPizzaId, -1)}
                    disabled={baked === 0}
                    style={{
                      width: '48px', height: '44px', flexShrink: 0,
                      background: 'transparent', border: 'none',
                      fontSize: '22px', lineHeight: 1,
                      color: baked === 0 ? '#C8C0B8' : '#6B7A5A',
                      cursor: baked === 0 ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >−</button>
                  <div style={{ flex: 1, textAlign: 'center', fontFamily: 'DM Mono, monospace', lineHeight: 1.2 }}>
                    <div style={{
                      fontWeight: 700, fontSize: '15px',
                      color: baked > qty ? '#D4A853' : isComplete ? '#6B7A5A' : 'var(--char)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      transition: 'color 0.2s ease',
                    }}>
                      {baked > qty ? baked : `${baked} / ${qty}`}
                      {isComplete && baked <= qty && (
                        <svg key={`bh-done-${sheetPizzaId}`} viewBox="0 0 12 12" width={12} height={12}
                          fill="none" stroke="#6B7A5A" strokeWidth="2.4"
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{ animation: 'bhPopIn 0.45s ease', flexShrink: 0 }}>
                          <path d="M2 6.2l2.8 2.8L10 3.5"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--smoke)', marginTop: '1px' }}>
                      {l === 'fr' ? 'cuites' : 'baked'}
                    </div>
                  </div>
                  <button
                    onClick={() => changeDoneCount(sheetPizzaId, 1)}
                    style={{
                      width: '48px', height: '44px', flexShrink: 0,
                      background: baked >= qty ? '#D4A853' : '#6B7A5A',
                      border: 'none', fontSize: '22px', lineHeight: 1,
                      color: 'white', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >+</button>
                </div>
              </div>
              </div>
                );
              })()}

              {/* Full-width photo hero with Maestro button overlaid */}
              {photos[sheetPizzaId] && (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden' }}>
                  <img
                    src={photos[sheetPizzaId]}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    alt=""
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                    background: 'linear-gradient(to bottom, transparent, rgba(26,22,18,0.75))',
                    pointerEvents: 'none',
                  }} />
                  <CoachButton
                    stepId="pizza_maestro"
                    styleKey={styleKey ?? 'neapolitan'}
                    kitchenTemp={kitchenTemp ?? 22}
                    prefermentType={prefermentType}
                    locale={l}
                    ovenType={ovenType}
                    pizzaName={pizza.name[l]}
                    imageBase64={photoBase64[sheetPizzaId]}
                    photoOverlay={true}
                    beforeBake={beforeIngredients.map(i => i.name.en)}
                    afterBake={afterIngredients.map(i => i.name.en)}
                  />
                </div>
              )}

              {/* Sign-in nudge — persistent inline, not a toast */}
              {!user && photos[sheetPizzaId] && (
                <div style={{
                  margin: '4px 16px 12px',
                  padding: '10px 14px',
                  background: 'rgba(26,22,18,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: 'var(--smoke)',
                  fontFamily: 'var(--font-dm-sans)',
                  lineHeight: 1.5,
                }}>
                  {l === 'fr'
                    ? 'Connectez-vous pour sauvegarder cette photo — retrouvez-la dans ☰ Mes sessions.'
                    : 'Sign in to save this photo — find it in ☰ My Sessions.'}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
