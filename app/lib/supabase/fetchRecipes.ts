import { createClient } from '@/app/lib/supabase/client';
import { ALL_STYLES } from '@/app/data';

export interface SavedRecipe {
  id: string;
  style_key: string;
  bake_type: string;
  num_items: number;
  item_weight: number;
  hydration: number;
  oven_type: string;
  kitchen_temp: number;
  eat_time: string | null;
  flour: number;
  water: number;
  salt: number;
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
    .select('id, style_key, bake_type, num_items, item_weight, hydration, oven_type, kitchen_temp, eat_time, flour, water, salt, recipe_name, notes, created_at')
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
  return `${styleName} · ${r.num_items} × ${r.item_weight}g · ${r.hydration}% · ${date}`;
}
