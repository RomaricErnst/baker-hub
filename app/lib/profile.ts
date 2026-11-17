// Baker profile — local-first persistence (bh_profile_v1).
// Supabase sync is a post-launch follow-up (see supabase/migrations note).
// Types only from toppingTypes — no data imports (keeps this leaf-level).
import type { Pizza, Ingredient, IngredientUnit, BakeOrder, OvenTempTag, IngredientCategory, StyleKey } from './toppingTypes';

const PROFILE_KEY = 'bh_profile_v1';

export interface CustomPizzaIngredient {
  /** id of a database ingredient when picked from the catalogue */
  refId?: string;
  nameEn: string;
  nameFr: string;
  amount: number;
  unit: IngredientUnit;
  bakeOrder: BakeOrder;
  category: IngredientCategory;
  /** true when typed free-text (not in the catalogue) */
  free?: boolean;
}

export interface CustomPizzaDef {
  id: string;            // "custom_<slug>_<ts>"
  name: string;          // baker's own name — same in both locales
  ovenTemp: OvenTempTag; // inferred at creation, editable
  ingredients: CustomPizzaIngredient[];
  createdAt: number;
  /** small JPEG data-URL, centre-cropped square */
  photo?: string;
}

export interface StandardBlocker {
  enabled: boolean;
  from: string; // "23:00"
  to: string;   // "07:00"
}

export interface BakerProfile {
  version: 1;
  ovenType?: string | null; // legacy single field — read as fallback
  ovenTypePizza?: string | null;
  ovenTypeBread?: string | null;
  mixerType?: string | null;
  yeastType?: string | null;
  fridgeTemp?: number;
  styleKey?: StyleKey | null; // legacy single field — read as fallback
  styleKeyPizza?: StyleKey | null;
  styleKeyBread?: StyleKey | null;
  preferredMode?: 'simple' | 'custom' | null;
  /** Custom-mode preferment preference — levain lives on the sourdough path */
  prefermentType?: 'none' | 'poolish' | 'biga' | null;
  starter?: {
    mature: boolean;
    hasRye: boolean;
    tang: 'mild' | 'balanced' | 'tangy';
  };
  blockers?: {
    sleep: StandardBlocker;
    work: StandardBlocker;
  };
  customPizzas?: CustomPizzaDef[];
  /** last local change, ms — drives newest-wins sync */
  updatedAt?: number;
}

// Change listener — page registers a debounced Supabase push here.
let profileListener: (() => void) | null = null;
export function setProfileListener(fn: (() => void) | null): void { profileListener = fn; }

export const DEFAULT_BLOCKERS = {
  sleep: { enabled: true, from: '23:00', to: '07:00' },
  work:  { enabled: false, from: '09:00', to: '18:00' },
};

export function loadProfile(): BakerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as BakerProfile;
    if (p.version !== 1) return null;
    return p;
  } catch { return null; }
}

export function saveProfile(p: BakerProfile, opts?: { silent?: boolean }): void {
  if (typeof window === 'undefined') return;
  const stamped = { ...p, version: 1 as const, updatedAt: opts?.silent ? p.updatedAt : Date.now() };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(stamped)); } catch {}
  if (!opts?.silent) profileListener?.();
}

export function updateProfile(patch: Partial<BakerProfile>): BakerProfile {
  const next: BakerProfile = { version: 1, ...(loadProfile() ?? {}), ...patch };
  saveProfile(next);
  return next;
}

// ── Custom pizza → Pizza (database shape) ────────────────────────────────────
// Permissive classification defaults so custom pizzas survive every filter.
export function customPizzaToPizza(def: CustomPizzaDef): Pizza {
  const ingredients: Ingredient[] = def.ingredients.map((ing, i) => ({
    id: ing.refId ?? `free_${def.id}_${i}`,
    name: { en: ing.nameEn, fr: ing.nameFr },
    category: ing.category,
    bakeOrder: ing.bakeOrder,
    qtyPerPizza: { amount: ing.amount, unit: ing.unit },
  }));
  return {
    id: def.id,
    name: { en: def.name, fr: def.name },
    story: { en: 'Your creation', fr: 'Votre création' },
    category: 'modern',
    base: 'other',
    season: ['all'],
    occasion: ['party'],
    dietary: [],
    budget: 2,
    complexity: 1,
    prepMinutes: 5,
    ovenTemp: def.ovenTemp,
    wine: [],
    ingredients,
    photoUrl: def.photo,
    flavour: { richness: 3, boldness: 3, creative: 5, refined: 3 },
  };
}

export function loadCustomPizzas(): CustomPizzaDef[] {
  return loadProfile()?.customPizzas ?? [];
}

export function saveCustomPizza(def: CustomPizzaDef): void {
  const list = loadCustomPizzas().filter(p => p.id !== def.id);
  updateProfile({ customPizzas: [...list, def] });
}

export function deleteCustomPizza(id: string): void {
  updateProfile({ customPizzas: loadCustomPizzas().filter(p => p.id !== id) });
}


// ── Last bake's equipment ────────────────────────────────────────────────────
// The oven (one per family), kneading and commercial yeast the baker confirmed on the last bake
// carry to the next one, like the kitchen and fridge (17 Nov 2026 retention review). Kept on this
// device beside the profile; the profile, when it names them, still wins.
const LAST_EQUIPMENT_KEY = 'bh_last_equipment_v1';
export interface LastEquipment { ovenPizza?: string; ovenBread?: string; mixer?: string; yeast?: string }
export function loadLastEquipment(): LastEquipment {
  if (typeof window === 'undefined') return {};
  try {
    const value = JSON.parse(localStorage.getItem(LAST_EQUIPMENT_KEY) ?? '{}') as LastEquipment;
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}
export function rememberLastEquipment({bakeType, oven, mixer, yeast}: {bakeType: string | null; oven: string | null; mixer: string | null; yeast: string | null}): void {
  if (typeof window === 'undefined' || !bakeType) return;
  try {
    const next: LastEquipment = {...loadLastEquipment()};
    if (oven) next[bakeType === 'bread' ? 'ovenBread' : 'ovenPizza'] = oven;
    if (mixer) next.mixer = mixer;
    if (yeast) next.yeast = yeast;
    localStorage.setItem(LAST_EQUIPMENT_KEY, JSON.stringify(next));
  } catch {}
}
