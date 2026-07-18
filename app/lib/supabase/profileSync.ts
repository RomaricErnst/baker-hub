// Baker preferences ↔ Supabase baker_profiles sync (no save button by design).
// Strategy: newest wins by timestamp; every local change pushes debounced.
import { createClient } from './client';
import { loadProfile, saveProfile, type BakerProfile } from '../profile';

export async function pushProfile(userId: string): Promise<void> {
  const local = loadProfile();
  if (!local) return;
  const supabase = createClient();
  await supabase.from('baker_profiles').upsert({
    user_id: userId,
    profile: local,
    updated_at: new Date(local.updatedAt ?? Date.now()).toISOString(),
  });
}

export async function pullAndMergeProfile(userId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('baker_profiles')
    .select('profile, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return; // offline / RLS hiccup — stay local, retry next launch
  const local = loadProfile();
  const serverTime = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
  const localTime = local?.updatedAt ?? 0;
  if (data?.profile && serverTime > localTime) {
    // Server is newer — adopt it (stamp with server time so we don't re-push)
    saveProfile({ ...(data.profile as BakerProfile), updatedAt: serverTime }, { silent: true });
  } else if (local && localTime > serverTime) {
    await pushProfile(userId);
  }
}
