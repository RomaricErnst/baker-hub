// Removing a bake from this device, with Undo (24 Nov 2026 round 18, H3). Delete is immediate: the entry, its
// guide ticks and plan snapshots, and the draft when it is that bake, go at once; "Removed · Undo" stands where the
// row was until the next navigation (no timer, nothing over the bottom nav). Its photos are deleted only once
// Undo is gone (the next navigation, another removal, or the page closing). Cloud bake_events are untouched.
import { deleteJournalEntry, restoreJournalEntry, currentJournalId, setCurrentJournalId, type JournalEntry } from './localJournal';
import { deleteJournalPhotos } from './journalPhotos';
import { loadSession, saveSession, type SessionData } from './session';

export interface JournalRemoval {
  entry: JournalEntry;
  /** The bake's own localStorage keys (guide ticks, plan snapshots), as they were. */
  keys: Record<string, string>;
  /** The draft (bh_session_v1) when the removed bake was the bake on screen; the page clears it. */
  session: SessionData | null;
  /** Where each part of the app was when it was removed: a change is the next navigation. */
  at: Record<string, string>;
}

let pending: JournalRemoval | null = null;
const listeners = new Set<() => void>();
const navigation: Record<string, string> = {};
const emit = () => listeners.forEach(listener => listener());

export function subscribeJournalRemoval(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const pendingJournalRemoval = (): JournalRemoval | null => pending;

const bakeKeyPrefixes = (id: string) => ['bh_guide_done_v2:', 'bh_guide_seen_v1:'].map(prefix => prefix + JSON.stringify({ bake: id }));

/** Removes the bake now; Undo can put everything back until the next navigation. `at` overrides where a part
 *  of the app will be right after (the menu reopening on My bakes). */
export function removeJournalBake(id: string, at: Record<string, string> = {}): JournalRemoval | null {
  finalizeJournalRemoval();
  let store: Storage | null = null;
  try { store = typeof localStorage === 'undefined' ? null : localStorage; } catch {}
  const keys: Record<string, string> = {};
  try {
    const prefixes = bakeKeyPrefixes(id);
    for (let i = 0; store && i < store.length; i++) {
      const key = store.key(i);
      if (key && prefixes.some(prefix => key.startsWith(prefix))) keys[key] = store.getItem(key) ?? '';
    }
  } catch {}
  const session = currentJournalId() === id ? loadSession() : null;
  const entry = deleteJournalEntry(id);
  if (!entry) return null;
  try { for (const key of Object.keys(keys)) store?.removeItem(key); } catch {}
  pending = { entry, keys, session, at: { ...navigation, ...at } };
  if (typeof window !== 'undefined') window.addEventListener('pagehide', finalizeJournalRemoval, { once: true });
  emit();
  return pending;
}

/** Undo: the entry, its keys and the draft come back as they were. */
export function undoJournalRemoval(): JournalRemoval | null {
  const removal = pending;
  if (!removal) return null;
  pending = null;
  restoreJournalEntry(removal.entry);
  try { for (const [key, value] of Object.entries(removal.keys)) localStorage.setItem(key, value); } catch {}
  if (removal.session) { saveSession(removal.session); setCurrentJournalId(removal.entry.id); }
  emit();
  return removal;
}

/** Undo is gone: the photos go too. */
export function finalizeJournalRemoval(): void {
  const removal = pending;
  if (!removal) return;
  pending = null;
  if (removal.entry.photoIds.length) void deleteJournalPhotos(removal.entry.photoIds);
  emit();
}

/** Each part of the app reports where it is ('page': section and home, 'menu': the menu page). A change after a
 *  removal is the next navigation, which ends Undo. */
export function noteJournalNavigation(part: string, key: string): void {
  navigation[part] = key;
  if (pending && pending.at[part] !== undefined && pending.at[part] !== key) finalizeJournalRemoval();
  else if (pending && pending.at[part] === undefined) pending.at[part] = key;
}
