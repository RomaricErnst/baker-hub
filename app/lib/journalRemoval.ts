// Removing a bake from this device, with Undo (24 Nov 2026 round 18, H3). Delete is immediate: the entry, its
// guide ticks and plan snapshots, and the draft when it is that bake, go at once; "Removed · Undo" stands where the
// row was until the next navigation (no timer, nothing over the bottom nav). Its photos are deleted only once
// Undo is gone (the next navigation, another removal, or the page closing). Cloud bake_events are untouched.
import { deleteJournalEntry, restoreJournalEntry, currentJournalId, setCurrentJournalId, listJournal, journalBakeInProgress, type JournalEntry } from './localJournal';
import { carriedJarRecords, savedStarterUse, sharedStarterFeedFor, type StarterUse } from '../utils/sharedStarter';
import { deleteJournalPhotos } from './journalPhotos';
import { loadSession, saveSession, type SessionData } from './session';

export interface JournalRemoval {
  entry: JournalEntry;
  /** The bake's own localStorage keys (guide ticks, plan snapshots), as they were. */
  keys: Record<string, string>;
  /** The draft (bh_session_v1) when the removed bake was the bake on screen; the page clears it. */
  session: SessionData | null;
  /** Other bakes as they were before the removed bake's jar feeds were carried into them (Undo puts them back). */
  others: JournalEntry[];
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
  const others = carryJarFeeds(id);
  const entry = deleteJournalEntry(id);
  if (!entry) { for (const other of others) restoreJournalEntry(other); return null; }
  try { for (const key of Object.keys(keys)) store?.removeItem(key); } catch {}
  pending = { entry, keys, session, others, at: { ...navigation, ...at } };
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
  for (const other of removal.others) restoreJournalEntry(other);
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

/** One jar, two bakes (round 8): a feed recorded in the removed bake is done in the bake that shared it. That bake
 *  un-merges and shows its own starter steps; the carried records join its own so they stay done. Returns the
 *  bakes as they were. Journal entries only: a bake open on screen keeps its own state. */
function carryJarFeeds(id: string, now = Date.now()): JournalEntry[] {
  try {
    const live = listJournal().filter(entry => entry.eatTime != null && journalBakeInProgress(entry, now));
    const uses = live.map(entry => savedStarterUse(entry as Parameters<typeof savedStarterUse>[0], entry.id, false, now)).filter((use): use is StarterUse => !!use);
    const removed = uses.find(use => use.id === id);
    if (!removed) return [];
    const before: JournalEntry[] = [];
    for (const use of uses) {
      if (use.id === id) continue;
      const shared = sharedStarterFeedFor(use, uses, now);
      if (shared?.otherId !== id) continue;
      const carried = carriedJarRecords(shared, removed);
      const entry = live.find(row => row.id === use.id);
      if (!carried.length || !entry) continue;
      const own = entry.session.starterFeedRecords ?? [];
      const added = carried.filter(record => !own.some(o => o.plannedAt === record.plannedAt || o.actualAt === record.actualAt));
      if (!added.length) continue;
      before.push(entry);
      const next = { ...entry, session: { ...entry.session, starterFeedRecords: [...own, ...added].sort((a, b) => a.actualAt - b.actualAt) } } as JournalEntry;
      restoreJournalEntry(next);
    }
    return before;
  } catch { return []; }
}
