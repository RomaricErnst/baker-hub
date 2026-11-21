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
import { sharedStarterFeedFor, savedStarterUse, type StarterUse } from '../utils/sharedStarter';
import type { SessionData } from './session';
import { rowStep, clockMark, type ClockStep } from '../utils/guideProgress';
import { translateGuideTitle } from '../utils/guideTitles';

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

/** With several bakes under way, the one whose next key moment (preferment, mix, bake) is nearest
 *  now; a moment up to two hours past still counts as due (17 Nov 2026 retention review). */
export function dueJournalEntry(now = Date.now()): JournalEntry | null {
  let best: { entry: JournalEntry; wait: number } | null = null;
  for (const entry of listJournal()) {
    if (entry.eatTime == null || !journalBakeInProgress(entry, now) || entry.session?.bakedDone) continue;
    const s = entry.session as { startTime?: unknown; prefOffsetH?: unknown; prefermentType?: unknown };
    const start = finite(s.startTime);
    const pref = start != null && s.prefermentType !== 'none' && s.prefermentType !== 'levain' && finite(s.prefOffsetH) ? start - (s.prefOffsetH as number) * 3600000 : null;
    const waits = [pref, start, entry.eatTime].filter((t): t is number => t != null && t >= now - 2 * 3600000).map(t => Math.max(0, t - now));
    if (!waits.length) continue;
    const wait = Math.min(...waits);
    if (!best || wait < best.wait) best = { entry, wait };
  }
  return best?.entry ?? null;
}

/** Plan steps spent waiting in the fridge: the row names what comes after them. */
const WAITING_STEPS = new Set(['cold_1', 'cold_2', 'cold', 'rest', 'autolyse', 'poolish_ferment', 'biga_ferment']);

export interface LiveJournalBake {
  entry: JournalEntry;
  /** The moment the row is ordered by: the step under way, or the next one. */
  at: number;
  /** The plan step's own label, as saved with the recipe; null for snapshots without steps. */
  label: string | null;
  /** True when the step is under way now (no time is shown). */
  current: boolean;
  /** Baked and not rated yet: the row offers the rating (20 Nov 2026 round 6). */
  rate?: boolean;
  /** Other bakes whose starter step this row is too: one jar, two bakes (round 8, S6; mergeSharedJarRows). */
  jarWith?: JournalEntry[];
}

/** A baked bake stays on home as "Rate" for this long after its bake time, until rated (20 Nov 2026 round 6,
 *  Thomas: rating the baguettes dropped the campagne, baked that morning and never rated). */
export const RATE_ROW_MS = 72 * 3600000;

/** Every bake under way on this device, one row each, the most pressing first: the step under way
 *  (unless it is a wait in the fridge), else the next step with its time. Same bakes as dueJournalEntry
 *  considers (in progress, not finished); a bake two hours past its time is over (17 Nov 2026 retention round 2). */
/** The guide's own steps for a bake (titles in the language it was last shown in, times, ticks), saved by
 *  the guide under the bake's journal id. */
export function guidePlanSnapshot(id: string, locale?: string): { locale: string; steps: (ClockStep & { title: string })[] } | null {
  const read = (suffix: string) => {
    try {
      const raw = storage()?.getItem('bh_guide_done_v2:' + JSON.stringify({ bake: id }) + ':plan' + suffix);
      const value = raw ? JSON.parse(raw) : null;
      if (!value || typeof value.locale !== 'string' || !Array.isArray(value.steps)) return null;
      const steps = value.steps.filter((s: unknown): s is ClockStep & { title: string } => !!s && typeof s === 'object'
        && Number.isFinite((s as ClockStep).at) && Number.isInteger((s as ClockStep).step) && typeof (s as { title?: unknown }).title === 'string' && !!(s as { title: string }).title);
      return steps.length ? { locale: value.locale as string, steps: steps as (ClockStep & { title: string })[] } : null;
    } catch { return null; }
  };
  const plan = read('');
  if (!plan || !locale || plan.locale === locale) return plan;
  // Shown last in the other language: its titles in this one, from the guide's own copy when it was shown here
  // (same step at the same time), else from the table of the guide's titles (18 Nov 2026 retention round 4).
  const own = read(':' + locale);
  return { locale, steps: plan.steps.map(step => {
    const same = own?.steps.find(o => o.step === step.step && o.at === step.at);
    return { ...step, title: same?.title ?? translateGuideTitle(step.title, locale) };
  }) };
}

export function liveJournalBakes(now = Date.now(), locale?: string): LiveJournalBake[] {
  const rows: LiveJournalBake[] = [];
  for (const entry of listJournal()) {
    if (entry.eatTime == null || !entry.session?.recipeGenerated) continue;
    const plan = locale ? guidePlanSnapshot(entry.id, locale) : null;
    const pick = plan ? rowStep(plan.steps, now) : null;
    // Over: marked baked, every guide step ticked, or two hours past the bake time. Unrated, it stays as "Rate"
    // (never a stale step such as "Cuisson et dégustation" at 9h15 at 10:00).
    const over = !!entry.session.bakedDone || entry.eatTime + 2 * 3600000 <= now || (!!plan && !pick && entry.eatTime <= now);
    if (over) {
      if (entry.rating == null && entry.eatTime <= now && now - entry.eatTime < RATE_ROW_MS) rows.push({ entry, at: entry.eatTime, label: null, current: false, rate: true });
      continue;
    }
    if (!journalBakeInProgress(entry, now)) continue;
    // The guide's next thing to do (rowStep), by its own name in the page's language and its own time.
    const marked = pick && plan ? plan.steps.find(step => step.step === pick.step) : undefined;
    if (marked) { rows.push({ entry, at: marked.at, label: marked.title, current: pick!.current }); continue; }
    const steps = (entry.session.computedRecipe?.timelineSteps ?? [])
      .filter(step => Number.isFinite(step.time) && typeof step.label === 'string' && step.label)
      .sort((a, b) => a.time - b.time);
    if (steps.length) {
      const started = steps.filter(step => step.time <= now);
      // The rest inside the mix belongs to the mix.
      const under = started.at(-1)?.id === 'autolyse' && started.length > 1 ? started.at(-2) : started.at(-1);
      const next = steps.find(step => step.time > now);
      if (under && !WAITING_STEPS.has(under.id)) rows.push({ entry, at: under.time, label: under.label, current: true });
      else if (next) rows.push({ entry, at: next.time, label: next.label, current: false });
      else if (under) rows.push({ entry, at: under.time, label: under.label, current: true });
      continue;
    }
    const s = entry.session as { startTime?: unknown; prefOffsetH?: unknown; prefermentType?: unknown };
    const start = finite(s.startTime);
    const pref = start != null && s.prefermentType !== 'none' && s.prefermentType !== 'levain' && finite(s.prefOffsetH) ? start - (s.prefOffsetH as number) * 3600000 : null;
    const at = [pref, start, entry.eatTime].filter((t): t is number => t != null && t > now)[0] ?? entry.eatTime;
    rows.push({ entry, at, label: null, current: false });
  }
  // Ordered by time, as the steps come (18 Nov 2026 retention round 3).
  // Bakes to rate come after the bakes under way.
  return rows.sort((a, b) => Number(!!a.rate) - Number(!!b.rate) || a.at - b.at || (a.entry.eatTime ?? 0) - (b.entry.eatTime ?? 0));
}

/** What a bake under way is on, for the single home card (20 Nov 2026 round 6, owner's decision D1): the step the
 *  guide's bar names (its `:plan` snapshot read by `clockMark`, so card and bar never disagree), "now" or "next"
 *  with its time. Null before the bake's first step, after the bake (three hours past, as the guide), or when every
 *  step is ticked: the card then keeps its dated line. */
export function journalDueStep(id: string, locale: string, bakeAt: number | null, now = Date.now()): { kind: 'now' | 'next'; title: string; at: number } | null {
  const plan = guidePlanSnapshot(id, locale);
  if (!plan || (bakeAt != null && now > bakeAt + 3 * 3600000)) return null;
  if (!plan.steps.some(step => step.at <= now || step.done)) return null;
  const mark = clockMark(plan.steps, now);
  const step = mark ? plan.steps.find(s => s.step === mark.step) : undefined;
  return mark && step ? { kind: mark.kind, title: step.title, at: step.at } : null;
}

/** One jar, two bakes on home (21 Nov 2026 round 8, S6, Priya: two identical "Take starter out of the fridge 6:00pm"
 *  rows). When two live sourdough bakes share a feed (sharedStarterFeedFor) and both rows are on a step of the jar up
 *  to that feed (their own starter steps, the shared feed, or the leading bake's), the jar's step is one row: the
 *  leading bake's, naming both bakes (`jarWith`). The bake that follows keeps a row of its own, for its next step
 *  after the shared feed (its guide's step, else its mix), so both bakes stay one tap away. Nothing with fewer than
 *  two sourdough bakes (owner's rule B: the rows are returned as they are). */
export function mergeSharedJarRows(rows: LiveJournalBake[], now = Date.now(), locale?: string): LiveJournalBake[] {
  const uses = new Map<string, StarterUse>();
  for (const row of rows) {
    if (row.rate) continue;
    const use = savedStarterUse(row.entry as Parameters<typeof savedStarterUse>[0], row.entry.id);
    if (use) uses.set(row.entry.id, use);
  }
  if (uses.size < 2) return rows;
  const all = [...uses.values()];
  const STARTER = ['refresh', 'intermediate_refresh', 'pre_mix', 'fridge_in', 'fridge_out'];
  const nearAny = (at: number, times: number[]) => times.some(t => Math.abs(t - at) <= 8 * 60000);
  const jarTimes = (use: StarterUse, until: number) => (use.events ?? []).filter(e => STARTER.includes(e.kind) && +e.time <= until + 60000).map(e => +e.time);
  const joined = new Map<string, JournalEntry[]>();
  const moved = new Map<string, LiveJournalBake>();
  for (const follower of all) {
    const shared = sharedStarterFeedFor(follower, all, now);
    if (!shared || shared.leads || moved.has(shared.otherId)) continue;
    const leader = uses.get(shared.otherId);
    const fRow = rows.find(r => r.entry.id === follower.id), lRow = rows.find(r => r.entry.id === shared.otherId);
    if (!leader || !fRow || !lRow || fRow.rate || lRow.rate || !fRow.label || !lRow.label) continue;
    const times = [shared.at, ...jarTimes(follower, Math.max(shared.at, follower.feedAt)), ...jarTimes(leader, shared.at)];
    if (!nearAny(fRow.at, times) || !nearAny(lRow.at, [shared.at, ...jarTimes(leader, shared.at)])) continue;
    // The follower's next step after the shared feed: its guide's, else its mix.
    const after = Math.max(shared.at, follower.feedAt) + 60000;
    const next = (locale ? guidePlanSnapshot(follower.id, locale)?.steps : undefined)?.filter(step => step.at > after && !step.done).sort((a, b) => a.at - b.at)[0];
    moved.set(follower.id, next ? { entry: fRow.entry, at: next.at, label: next.title, current: false } : { entry: fRow.entry, at: follower.mixAt, label: null, current: false });
    joined.set(leader.id, [...(joined.get(leader.id) ?? []), fRow.entry]);
  }
  if (!moved.size) return rows;
  return rows.map(r => moved.get(r.entry.id) ?? (joined.has(r.entry.id) ? { ...r, jarWith: joined.get(r.entry.id) } : r))
    .sort((a, b) => Number(!!a.rate) - Number(!!b.rate) || a.at - b.at || (a.entry.eatTime ?? 0) - (b.entry.eatTime ?? 0));
}
