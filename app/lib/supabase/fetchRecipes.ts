import { createClient } from '@/app/lib/supabase/client';
import { ALL_STYLES } from '@/app/data';

export interface SavedRecipe {
  id: string;
  mode: string | null;
  style_key: string;
  bake_type: string;
  num_items: number;
  item_weight: number;
  hydration: number;
  oven_type: string;
  mixer_type: string | null;
  yeast_type: string | null;
  kitchen_temp: number;
  humidity: string | null;
  fridge_temp: number | null;
  eat_time: string | null;
  flour: number;
  water: number;
  salt: number;
  preferment_type: string | null;
  preferment_flour_pct: number | null;
  manual_oil: number | null;
  manual_sugar: number | null;
  manual_salt: number | null;
  flour_blend: string | null;
  target_dough_temp: number | null;
  waste_pct: number | null;
  recipe_name: string | null;
  notes: string | null;
  created_at: string;
}

export async function fetchRecipes(): Promise<SavedRecipe[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('recipes')
    .select('id, mode, style_key, bake_type, num_items, item_weight, hydration, oven_type, mixer_type, yeast_type, kitchen_temp, humidity, fridge_temp, eat_time, flour, water, salt, preferment_type, preferment_flour_pct, manual_oil, manual_sugar, manual_salt, flour_blend, target_dough_temp, waste_pct, recipe_name, notes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return [];
  return data ?? [];
}

export function recipeSubtitle(r: SavedRecipe): string {
  const style = (ALL_STYLES as Record<string, { name: string }>)[r.style_key];
  const styleName = style?.name ?? r.style_key;
  const date = r.created_at
    ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';
  const modeLabel = r.mode === 'custom' ? ' · Custom' : '';
  return `${styleName} · ${r.num_items} × ${r.item_weight}g · ${r.hydration}%${modeLabel} · ${date}`;
}
