import { createClient } from '@/app/lib/supabase/client';
import type { SessionData } from '@/app/lib/session';

export interface BakeEventToSave {
  session: SessionData;
  recipeId?: string | null;
  pizzaPartyId?: string | null;
}

export async function upsertBakeEvent(payload: BakeEventToSave): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { session } = payload;

    const { data, error } = await supabase
      .from('bake_events')
      .upsert(
        {
          user_id: user.id,
          bake_date: session.eatTime
            ? new Date(session.eatTime).toISOString()
            : new Date().toISOString(),
          status: 'dough_planned',
          recipe_id: payload.recipeId ?? null,
          pizza_party_id: payload.pizzaPartyId ?? null,
          dough_snapshot: session,
          notes: '__autosave__',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,notes',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single();

    if (error) { console.error('upsertBakeEvent error:', error); return null; }
    return data?.id ?? null;
  } catch (e) {
    console.error('upsertBakeEvent exception:', e);
    return null;
  }
}

export async function nameBakeEvent(
  bakeEventId: string,
  name: string,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('bake_events')
      .update({ notes: name, updated_at: new Date().toISOString() })
      .eq('id', bakeEventId);
    return !error;
  } catch { return false; }
}

export async function markBaked(bakeEventId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('bake_events')
      .update({ status: 'baked', updated_at: new Date().toISOString() })
      .eq('id', bakeEventId);
    return !error;
  } catch { return false; }
}
