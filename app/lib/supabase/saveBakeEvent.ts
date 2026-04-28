import { createClient } from '@/app/lib/supabase/client';
import type { SessionData } from '@/app/lib/session';
import { ALL_STYLES } from '@/app/data';

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

export async function saveNamedSession(
  session: SessionData,
  recipeId?: string | null,
): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const style = (ALL_STYLES as Record<string, { name: string }>)
      [session.styleKey ?? '']?.name ?? session.styleKey ?? 'Session';
    const n = session.numItems ?? 0;
    const type = session.bakeType === 'bread'
      ? (n === 1 ? 'loaf' : 'loaves')
      : (n === 1 ? 'pizza' : 'pizzas');
    const date = session.eatTime
      ? new Date(session.eatTime).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short',
        })
      : new Date().toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short',
        });
    const name = `${style} · ${n} ${type} · ${date}`;

    const { data, error } = await supabase
      .from('bake_events')
      .insert({
        user_id: user.id,
        bake_date: session.eatTime
          ? new Date(session.eatTime).toISOString()
          : new Date().toISOString(),
        status: 'dough_planned',
        recipe_id: recipeId ?? null,
        dough_snapshot: session,
        notes: name,
      })
      .select('id')
      .single();

    if (error) { console.error('saveNamedSession error:', error); return null; }
    return data?.id ?? null;
  } catch (e) {
    console.error('saveNamedSession exception:', e);
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
