import { createClient } from '@/app/lib/supabase/client';
import { ALL_STYLES } from '@/app/data';
import type { SessionData } from '@/app/lib/session';

export interface BakeEvent {
  id: string;
  bake_date: string;
  status: 'dough_planned' | 'pizza_planned' | 'baked';
  notes: string | null;
  dough_snapshot: SessionData | null;
  recipe_id: string | null;
  pizza_party_id: string | null;
  created_at: string;
  updated_at: string;
}

export function bakeEventTitle(event: BakeEvent): string {
  const snap = event.dough_snapshot;
  if (!snap) return 'Session';
  const style = (ALL_STYLES as Record<string, { name: string }>)[snap.styleKey ?? ''];
  const styleName = style?.name ?? snap.styleKey ?? 'Session';
  const n = snap.numItems ?? 0;
  const type = snap.bakeType === 'bread'
    ? (n === 1 ? 'loaf' : 'loaves')
    : (n === 1 ? 'pizza' : 'pizzas');
  const date = snap.eatTime
    ? new Date(snap.eatTime).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : new Date(event.bake_date).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      });
  return `${styleName} · ${n} ${type} · ${date}`;
}

export function bakeEventDoughSpec(event: BakeEvent): string {
  const snap = event.dough_snapshot;
  if (!snap || snap.tab !== 'custom') return '';
  const parts: string[] = [];
  if (snap.manualHydration !== undefined) parts.push(`${snap.manualHydration}%`);
  if (snap.prefermentType && snap.prefermentType !== 'none') {
    const label = snap.prefermentType.charAt(0).toUpperCase() + snap.prefermentType.slice(1);
    parts.push(label);
  }
  parts.push('Custom');
  return parts.join(' · ');
}

export async function fetchBakeEvents(): Promise<BakeEvent[]> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('bake_events')
      .select('id, bake_date, status, notes, dough_snapshot, recipe_id, pizza_party_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) return [];
    return (data ?? []) as BakeEvent[];
  } catch { return []; }
}

export interface BakePhoto {
  id: string;
  slot_index: number | null;
  photo_url: string;
  taken_at: string;
}

export async function fetchPhotosForEvents(
  eventIds: string[]
): Promise<Record<string, BakePhoto[]>> {
  try {
    if (eventIds.length === 0) return {};
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bake_photos')
      .select('id, bake_event_id, slot_index, photo_url, taken_at')
      .in('bake_event_id', eventIds)
      .order('taken_at', { ascending: true });
    if (error || !data) return {};
    const result: Record<string, BakePhoto[]> = {};
    for (const photo of data) {
      const eid = photo.bake_event_id as string;
      if (!result[eid]) result[eid] = [];
      result[eid].push(photo as BakePhoto);
    }
    return result;
  } catch { return {}; }
}

export interface PizzaPartySlot {
  id: string;
  session_id: string;
  slot_index: number;
  preset_id: string;
  qty?: number;
  toppings: Record<string, unknown> | null;
  notes: string | null;
}

export async function fetchPizzaPartySlots(
  bakeEventIds: string[],
): Promise<Record<string, PizzaPartySlot[]>> {
  try {
    if (bakeEventIds.length === 0) return {};
    const supabase = createClient();

    const { data: sessions } = await supabase
      .from('pizza_party_sessions')
      .select('id, bake_event_id')
      .in('bake_event_id', bakeEventIds);
    if (!sessions?.length) return {};

    const sessionIds = sessions.map(s => s.id);
    const sessionMap = Object.fromEntries(
      sessions.map(s => [s.id, s.bake_event_id as string]),
    );

    const { data: slots } = await supabase
      .from('pizza_party_slots')
      .select('id, session_id, slot_index, preset_id, qty, toppings, notes')
      .in('session_id', sessionIds)
      .order('slot_index', { ascending: true });

    if (!slots?.length) return {};

    const result: Record<string, PizzaPartySlot[]> = {};
    for (const slot of slots) {
      const eventId = sessionMap[slot.session_id];
      if (!result[eventId]) result[eventId] = [];
      result[eventId].push(slot as PizzaPartySlot);
    }
    return result;
  } catch { return {}; }
}

export async function deleteBakeEvent(id: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('bake_events').delete().eq('id', id);
    return !error;
  } catch { return false; }
}
