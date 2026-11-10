// Bake journal kept in this browser only — no account needed.
//
// One entry per bake: the id is created on the first recipe generation and
// reused for every regeneration of that bake, so editing and regenerating
// updates the entry instead of adding a new one. Starting a new bake forgets
// the current id; earlier entries stay.
//
// Entries (summary, session snapshot, rating, note, photo ids) live in
// localStorage. Photo bytes live in IndexedDB (journalPhotos.ts) — localStorage
// is far too small for images. Every storage call is wrapped: a private window
// or a full quota must never block planning a bake.
import type { SessionData } from './session';

export const JOURNAL_KEY = 'bh_journal_v1';
export const JOURNAL_CURRENT_KEY = 'bh_journal_current_v1';
export const JOURNAL_LIMIT = 50;
export const JOURNAL_PHOTO_LIMIT = 3;
export const JOURNAL_NOTE_LIMIT = 2000;

export interface JournalEntry {
  v: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  bakeType: string | null;
  styleKey: string | null;
  bakeName: string;
  numItems: number;
  itemWeight: number;
  kitchenTemp: number | null;
  eatTime: number | null;
  /** Session snapshot (bh_session_v1 shape) used to resume or bake again. */
  session: SessionData;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  note: string;
  photoIds: string[];
  /** bake_events id once the baker saved this entry to their account. */
  accountEventId: string | null;
}

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function newId(): string {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function normalizeRating(value: unknown): JournalEntry['rating'] {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5 ? n as JournalEntry['rating'] : null;
}

/** Accepts the current shape and older ones ({id, session} rows, string ratings, missing fields). */
export function normalizeJournalEntry(raw: unknown): JournalEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const session = row.session as SessionData | undefined;
  if (typeof row.id !== 'string' || !row.id || !session || typeof session !== 'object' || session.version !== 1) return null;
  const savedAt = finite(session.savedAt) ?? 0;
  const createdAt = finite(row.createdAt) ?? savedAt;
  return {
    v: 1,
    id: row.id,
    createdAt,
    updatedAt: finite(row.updatedAt) ?? Math.max(createdAt, savedAt),
    bakeType: typeof row.bakeType === 'string' ? row.bakeType : session.bakeType ?? null,
    styleKey: typeof row.styleKey === 'string' ? row.styleKey : session.styleKey ?? null,
    bakeName: typeof row.bakeName === 'string' ? row.bakeName : session.bakeName ?? '',
    numItems: finite(row.numItems) ?? finite(session.numItems) ?? 0,
    itemWeight: finite(row.itemWeight) ?? finite(session.itemWeight) ?? 0,
    kitchenTemp: finite(row.kitchenTemp) ?? finite(session.kitchenTemp),
    eatTime: finite(row.eatTime) ?? finite(session.eatTime),
    session,
    rating: normalizeRating(row.rating),
    note: typeof row.note === 'string' ? row.note.slice(0, JOURNAL_NOTE_LIMIT) : '',
    photoIds: Array.isArray(row.photoIds) ? row.photoIds.filter((id): id is string => typeof id === 'string' && !!id).slice(0, JOURNAL_PHOTO_LIMIT) : [],
    accountEventId: typeof row.accountEventId === 'string' && row.accountEventId ? row.accountEventId : null,
  };
}

/** Newest first. Never throws; an unreadable store reads as empty. */
export function listJournal(): JournalEntry[] {
  try {
    const raw = storage()?.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    const rows = Array.isArray(value) ? value : Array.isArray(value?.entries) ? value.entries : [];
    const seen = new Set<string>();
    return rows.map(normalizeJournalEntry).filter((entry: JournalEntry | null): entry is JournalEntry => {
      if (!entry || seen.has(entry.id)) return false;
      seen.add(entry.id); return true;
    }).sort((a: JournalEntry, b: JournalEntry) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}

export function getJournalEntry(id: string): JournalEntry | null {
  return listJournal().find(entry => entry.id === id) ?? null;
}

/** Writes the list, keeping the newest JOURNAL_LIMIT by creation. Returns the photo ids of dropped entries. */
function writeJournal(entries: JournalEntry[]): { ok: boolean; dropped: JournalEntry[] } {
  const byAge = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const kept = byAge.slice(0, JOURNAL_LIMIT);
  const dropped = byAge.slice(JOURNAL_LIMIT);
  try {
    const store = storage();
    if (!store) return { ok: false, dropped: [] };
    store.setItem(JOURNAL_KEY, JSON.stringify(kept.sort((a, b) => b.updatedAt - a.updatedAt)));
    return { ok: true, dropped };
  } catch { return { ok: false, dropped: [] }; }
}

export function currentJournalId(): string | null {
  try { return storage()?.getItem(JOURNAL_CURRENT_KEY) || null; } catch { return null; }
}
export function setCurrentJournalId(id: string | null): void {
  try {
    const store = storage();
    if (!store) return;
    if (id) store.setItem(JOURNAL_CURRENT_KEY, id); else store.removeItem(JOURNAL_CURRENT_KEY);
  } catch {}
}
/** A new bake starts: later generations create a new entry. Returns the id that was current. */
export function forgetCurrentJournalBake(): string | null {
  const id = currentJournalId();
  setCurrentJournalId(null);
  return id;
}

function summary(session: SessionData) {
  return {
    bakeType: session.bakeType ?? null,
    styleKey: session.styleKey ?? null,
    bakeName: session.bakeName ?? '',
    numItems: finite(session.numItems) ?? 0,
    itemWeight: finite(session.itemWeight) ?? 0,
    kitchenTemp: finite(session.kitchenTemp),
    eatTime: finite(session.eatTime),
  };
}

export interface RecordResult { entry: JournalEntry | null; dropped: JournalEntry[] }

/**
 * Adds or updates the entry for the current bake after a recipe was generated.
 * Notes, rating and photos already on the entry are kept.
 */
export function recordGeneratedBake(data: Omit<SessionData, 'version' | 'savedAt'> | SessionData, now = Date.now()): RecordResult {
  try {
    if (!data.bakeType) return { entry: null, dropped: [] };
    const session: SessionData = { ...data, version: 1, savedAt: now } as SessionData;
    const entries = listJournal();
    let id = currentJournalId();
    const existing = id ? entries.find(entry => entry.id === id) : undefined;
    if (!id || !existing) id = id ?? newId();
    const entry: JournalEntry = existing
      ? { ...existing, ...summary(session), session, updatedAt: now }
      : { v: 1, id, createdAt: now, updatedAt: now, ...summary(session), session, rating: null, note: '', photoIds: [], accountEventId: null };
    const result = writeJournal([entry, ...entries.filter(row => row.id !== id)]);
    if (!result.ok) return { entry: null, dropped: [] };
    setCurrentJournalId(id);
    return { entry, dropped: result.dropped };
  } catch { return { entry: null, dropped: [] }; }
}

/** Refreshes the snapshot of the current bake's existing entry (progress, ticks). Never creates one. */
export function refreshCurrentJournalSnapshot(data: Omit<SessionData, 'version' | 'savedAt'>, now = Date.now()): boolean {
  try {
    const id = currentJournalId();
    if (!id || !data.bakeType || !data.recipeGenerated) return false;
    const entries = listJournal();
    const existing = entries.find(entry => entry.id === id);
    if (!existing) return false;
    const session = { ...data, version: 1, savedAt: existing.session.savedAt } as SessionData;
    if (JSON.stringify(session) === JSON.stringify(existing.session)) return true;
    const next: JournalEntry = { ...existing, ...summary(session), session: { ...session, savedAt: now }, updatedAt: now };
    return writeJournal(entries.map(entry => entry.id === id ? next : entry)).ok;
  } catch { return false; }
}

export type JournalPatch = Partial<Pick<JournalEntry, 'rating' | 'note' | 'photoIds' | 'accountEventId'>>;

/** Rating, note, photos — changes made after the bake. Does not change the list order. */
export function updateJournalEntry(id: string, patch: JournalPatch): JournalEntry | null {
  try {
    const entries = listJournal();
    const existing = entries.find(entry => entry.id === id);
    if (!existing) return null;
    const next = normalizeJournalEntry({ ...existing, ...patch });
    if (!next) return null;
    return writeJournal(entries.map(entry => entry.id === id ? next : entry)).ok ? next : null;
  } catch { return null; }
}

/** Removes the entry. Returns it (for photo cleanup) or null if nothing changed. */
export function deleteJournalEntry(id: string): JournalEntry | null {
  try {
    const entries = listJournal();
    const existing = entries.find(entry => entry.id === id);
    if (!existing) return null;
    if (!writeJournal(entries.filter(entry => entry.id !== id)).ok) return null;
    if (currentJournalId() === id) setCurrentJournalId(null);
    return existing;
  } catch { return null; }
}

/** Resume is offered while the bake time is ahead, or within the day after it. */
export function journalBakeInProgress(entry: Pick<JournalEntry, 'eatTime'>, now = Date.now()): boolean {
  return entry.eatTime == null || entry.eatTime + 12 * 3600000 > now;
}
