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
}

export interface StandardBlocker {
  enabled: boolean;
  from: string; // "23:00"
  to: string;   // "07:00"
}

export interface BakerProfile {
  version: 1;
  ovenType?: string | null;
  mixerType?: string | null;
  yeastType?: string | null;
  fridgeTemp?: number;
  styleKey?: StyleKey | null;
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
}

export const DEFAULT_BLOCKERS = {
  sleep: { enabled: false, from: '23:00', to: '07:00' },
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

export function saveProfile(p: BakerProfile): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...p, version: 1 })); } catch {}
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
