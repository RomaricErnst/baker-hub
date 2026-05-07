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
    const time = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    });
    const name = `${style} · ${n} ${type} · ${date} ${time}`;

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

    if (error) {
      console.error('saveNamedSession error:', error);
      if (error.code === '23505') {
        const suffix = Math.floor(Math.random() * 1000);
        const { data: retry, error: retryError } = await supabase
          .from('bake_events')
          .insert({
            user_id: user.id,
            bake_date: session.eatTime
              ? new Date(session.eatTime).toISOString()
              : new Date().toISOString(),
            status: 'dough_planned',
            recipe_id: recipeId ?? null,
            dough_snapshot: session,
            notes: name + ' (' + suffix + ')',
          })
          .select('id')
          .single();
        if (!retryError) return retry?.id ?? null;
      }
      return null;
    }
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

export async function savePizzaPartySelections(
  bakeEventId: string,
  qtys: Record<string, number>,
  style: string,
): Promise<string | null> {
  try {
    const supabase = createClient();

    const quantity = Object.values(qtys).reduce((a, b) => a + b, 0);
    if (quantity === 0) return null;

    // Select-first: get existing session or create new one
    let { data: session } = await supabase
      .from('pizza_party_sessions')
      .select('id')
      .eq('bake_event_id', bakeEventId)
      .single();

    if (!session) {
      const { data: newSession, error: insertError } = await supabase
        .from('pizza_party_sessions')
        .insert({ bake_event_id: bakeEventId, quantity, style })
        .select('id')
        .single();
      if (insertError || !newSession) return null;
      session = newSession;
    } else {
      await supabase
        .from('pizza_party_sessions')
        .update({ quantity, style })
        .eq('id', session.id);
    }

    if (!session) return null;

    const slots = Object.entries(qtys)
      .filter(([, qty]) => qty > 0)
      .map(([presetId, qty], index) => ({
        session_id: session.id,
        slot_index: index,
        preset_id: presetId,
        qty,
        toppings: null,
      }));

    if (slots.length > 0) {
      await supabase.from('pizza_party_slots').delete().eq('session_id', session.id);
      await supabase.from('pizza_party_slots').insert(slots);
    }

    await supabase
      .from('bake_events')
      .update({ pizza_party_id: session.id, status: 'pizza_planned' })
      .eq('id', bakeEventId);

    return session.id;
  } catch (e) {
    console.error('savePizzaPartySelections error:', e);
    return null;
  }
}

export async function updateBakeEvent(
  id: string,
  session: SessionData,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('bake_events')
      .update({
        dough_snapshot: session,
        bake_date: session.eatTime
          ? new Date(session.eatTime).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    return !error;
  } catch { return false; }
}

export async function saveBakedQtys(
  bakeEventId: string,
  bakedQtys: Record<string, number>,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('pizza_party_sessions')
      .update({ baked_qtys: bakedQtys })
      .eq('bake_event_id', bakeEventId);
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

export async function saveComment(
  bakeEventId: string,
  comment: string,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('bake_events')
      .update({ comment, updated_at: new Date().toISOString() })
      .eq('id', bakeEventId);
    return !error;
  } catch { return false; }
}

export async function uploadBakePhoto(
  bakeEventId: string,
  userId: string,
  file: File,
): Promise<{ id: string; url: string } | null> {
  try {
    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/${bakeEventId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('bake-photos')
      .upload(path, file, { upsert: false });
    if (uploadError) { console.error('upload error:', uploadError); return null; }

    const { data: urlData } = supabase.storage
      .from('bake-photos')
      .getPublicUrl(path);

    const { data: row, error: insertError } = await supabase
      .from('bake_photos')
      .insert({
        bake_event_id: bakeEventId,
        slot_index: null,
        photo_url: urlData.publicUrl,
        taken_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !row) return null;
    return { id: row.id, url: urlData.publicUrl };
  } catch (e) {
    console.error('uploadBakePhoto error:', e);
    return null;
  }
}

export async function deleteBakePhoto(
  photoId: string,
  photoUrl: string,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const urlObj = new URL(photoUrl);
    const path = urlObj.pathname.split('/bake-photos/')[1];
    if (path) await supabase.storage.from('bake-photos').remove([path]);
    const { error } = await supabase
      .from('bake_photos').delete().eq('id', photoId);
    return !error;
  } catch { return false; }
}

export async function updateSessionName(
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
