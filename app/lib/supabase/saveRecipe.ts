import { createClient } from '@/app/lib/supabase/client';
import type { StyleKey, OvenType, MixerType, YeastType, FlourBlend } from '@/app/data';

export interface RecipeToSave {
  mode: 'simple' | 'custom';
  styleKey: StyleKey;
  bakeType: string;
  numItems: number;
  itemWeight: number;
  ovenType: OvenType;
  mixerType: MixerType;
  yeastType: YeastType;
  kitchenTemp: number;
  humidity: string;
  fridgeTemp: number;
  startTime: Date | null;
  eatTime: Date | null;
  flour: number;
  water: number;
  salt: number;
  yeastGrams: number | null;
  hydration: number;
  totalColdHours: number;
  totalRTHours: number;
  // Custom mode fields
  prefermentType?: string;
  prefermentFlourPct?: number;
  manualOil?: number;
  manualSugar?: number;
  manualSalt?: number;
  flourBlend?: FlourBlend;
  targetDoughTemp?: number;
  wastePct?: number;
}

export async function saveRecipe(recipe: RecipeToSave): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in' };

  const { error } = await supabase.from('recipes').insert({
    user_id: user.id,
    mode: recipe.mode,
    style_key: recipe.styleKey,
    bake_type: recipe.bakeType,
    num_items: recipe.numItems,
    item_weight: recipe.itemWeight,
    oven_type: recipe.ovenType,
    mixer_type: recipe.mixerType,
    yeast_type: recipe.yeastType,
    kitchen_temp: recipe.kitchenTemp,
    humidity: recipe.humidity,
    fridge_temp: recipe.fridgeTemp,
    start_time: recipe.startTime?.toISOString() ?? null,
    eat_time: recipe.eatTime?.toISOString() ?? null,
    flour: recipe.flour,
    water: recipe.water,
    salt: recipe.salt,
    yeast_grams: recipe.yeastGrams,
    hydration: recipe.hydration,
    total_cold_hours: recipe.totalColdHours,
    total_rt_hours: recipe.totalRTHours,
    preferment_type: recipe.prefermentType ?? null,
    preferment_flour_pct: recipe.prefermentFlourPct ?? null,
    manual_oil: recipe.manualOil ?? null,
    manual_sugar: recipe.manualSugar ?? null,
    manual_salt: recipe.manualSalt ?? null,
    flour_blend: recipe.flourBlend ? JSON.stringify(recipe.flourBlend) : null,
    target_dough_temp: recipe.targetDoughTemp ?? null,
    waste_pct: recipe.wastePct ?? null,
    recipe_name: null,
    notes: null,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateRecipe(
  id: string,
  fields: { recipe_name?: string | null; notes?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('recipes')
    .update(fields)
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteRecipe(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in' };
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
