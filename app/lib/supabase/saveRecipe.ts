import { createClient } from '@/app/lib/supabase/client';
import type { StyleKey, OvenType, MixerType, YeastType } from '@/app/data';

export interface RecipeToSave {
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
}

export async function saveRecipe(recipe: RecipeToSave): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in' };

  const { error } = await supabase.from('recipes').insert({
    user_id: user.id,
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
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
