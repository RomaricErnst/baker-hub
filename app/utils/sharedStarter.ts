// One jar, two bakes (20 Nov 2026 retention round 7, B5, Priya: two live sourdough bakes each planned their own
// feeds of the same starter). When another live sourdough bake on this device feeds the jar for its levain close
// enough that one feed is ready for both mixes, the two bakes build their levain from that one feed: sized for
// both, said once with both amounts, and the later bake's starter steps follow the earlier bake's plan.
// Nothing with one bake (owner's rule B): with no other bake the caller never calls this, and a null result
// leaves the plan as it is.
import { mixNearPeak, getStarterFridgeWarmupH } from './starterPeak';
import { starterBuild } from './starterBuild';
import { roundToQuarter } from './units';

/** One bake's levain build: its pre-mix feed (time, peak, ratio), its mix and the levain its dough takes. */
export interface StarterUse {
  id: string;
  /** "the campagne", "the baguettes": lower-case, as it reads inside a sentence. */
  name: string;
  feedAt: number;
  peakAt: number;
  mixAt: number;
  ratio: number;
  /** recipe.sourdough.starterGramsMid / Max: the levain the dough takes (starterBuild's inputs). */
  need: { mid: number; max: number };
  /** When the bake was planned (its journal entry's createdAt): once the earlier feed's time has passed, the pair
   *  still shares it only when both bakes were planned before it (round 8: the share held only until the feed). */
  createdAt?: number;
  /** The bake time (ms): two bakes of the same name are told apart by it in the feed line (round 9, S7). */
  bakeAt?: number;
  /** The bake's starter steps (saved events) and recorded feeds, so the bake that follows shows the jar's steps
   *  and either bake's tick carries to the other (round 8, S6). Not used to decide the pair. */
  events?: readonly JarEvent[];
  records?: readonly JarRecord[];
  /** Every feed the bake plans before its mix (refresh, intermediate, pre-mix): a feed of the jar at the same time as
   *  the other bake's pre-mix feed is that one feed (round 11). */
  feeds?: readonly { at: number; ratio: number }[];
}
/** A saved starter step, in either shape (session: ms numbers; page: Dates). */
export type JarEvent = { kind: string; time: Date; isPast?: boolean; historicalStorage?: boolean; bellPeakTime?: Date; feedingRatio?: number; [key: string]: unknown };
export type JarRecord = { kind: 'refresh' | 'intermediate_refresh' | 'pre_mix'; plannedAt: number; actualAt: number; recordedAt: number; ratio: number; stated?: boolean };

export interface SharedStarterFeed {
  /** The one feed: the earlier bake's pre-mix feed. */
  at: number;
  peakAt: number;
  ratio: number;
  /** True when this bake's own feed is the one kept (its plan leads); false when it follows the other bake. */
  leads: boolean;
  /** The other bake of the pair (its StarterUse id). */
  otherId: string;
  /** What stays in the jar once both doughs have taken their levain. */
  keep: number;
  first: { name: string; grams: number; bakeAt?: number };
  second: { name: string; grams: number; bakeAt?: number };
  build: { seed: number; flour: number; water: number; total: number };
}

/** The feed both bakes can use, or null. The earlier pre-mix feed is kept; the later bake shares it when its
 *  own mix falls in that feed's ready window (mixNearPeak: the solver's green band around the peak, from that
 *  feed's own rise). Both bakes compute the same pair, whichever is on screen. The pair holds while both mixes are
 *  ahead: before the shared feed, and after it when both bakes were planned before it (so a feed done for one
 *  bake alone is never claimed for two). */
export function sharedStarterFeedFor(own: StarterUse, others: readonly StarterUse[], now: number): SharedStarterFeed | null {
  if (!(own.mixAt > now) || !(own.peakAt > own.feedAt)) return null;
  let best: { other: StarterUse; gap: number } | null = null;
  for (const other of others) {
    if (other.id === own.id || !(other.mixAt > now) || !(other.peakAt > other.feedAt)) continue;
    const ownFirst = own.feedAt < other.feedAt || (own.feedAt === other.feedAt && own.id < other.id);
    const [early, late] = ownFirst ? [own, other] : [other, own];
    const plannedBefore = (use: StarterUse) => use.createdAt != null && use.createdAt < early.feedAt;
    if (!(early.feedAt > now) && !(plannedBefore(early) && plannedBefore(late))) continue;
    const riseH = (early.peakAt - early.feedAt) / 3600000;
    if (!(late.mixAt > early.feedAt) || !mixNearPeak(late.mixAt, early.peakAt, riseH)) continue;
    const gap = Math.abs(other.feedAt - own.feedAt);
    if (!best || gap < best.gap) best = { other, gap };
  }
  if (!best) return sameFeedFor(own, others, now);
  const other = best.other;
  const leads = own.feedAt < other.feedAt || (own.feedAt === other.feedAt && own.id < other.id);
  const [early, late] = leads ? [own, other] : [other, own];
  const ratio = early.ratio;
  // Each dough's own build at the kept feed's ratio, then one feed of both.
  const a = starterBuild(early.need.mid, early.need.max, ratio), b = starterBuild(late.need.mid, late.need.max, ratio);
  const total = a.total + b.total;
  return {
    at: early.feedAt, peakAt: early.peakAt, ratio, leads, otherId: other.id,
    keep: Math.max(0, total - early.need.mid - late.need.mid),
    first: { name: early.name, grams: a.total, bakeAt: early.bakeAt }, second: { name: late.name, grams: b.total, bakeAt: late.bakeAt },
    build: { seed: a.seed + b.seed, flour: a.flour + b.flour, water: a.water + b.water, total },
  };
}

/** Two bakes feeding the same jar at the same time (round 11, Priya: the pizza's refresh and the loaf's pre-mix feed
 *  both Wed 9:45pm, never said): one feed for both. The bake whose pre-mix feed it is follows (its levain comes from
 *  that feed); the other leads and goes on with its own later feeds. Within 15 minutes and at the same ratio only:
 *  the follower keeps its own peak, moved with its feed. The jar's rest is what stays once both doughs have their
 *  levain, the leader's later feeds included, so both bakes say the same "keep the rest". */
function sameFeedFor(own: StarterUse, others: readonly StarterUse[], now: number): SharedStarterFeed | null {
  let best: { leader: StarterUse; follower: StarterUse; at: number; gap: number } | null = null;
  for (const other of others) {
    if (other.id === own.id || !(other.mixAt > now) || !(other.peakAt > other.feedAt)) continue;
    for (const [leader, follower] of [[other, own], [own, other]] as const) {
      const feed = (leader.feeds ?? []).filter(f => f.at < leader.feedAt && f.ratio === follower.ratio && Math.abs(f.at - follower.feedAt) <= SAME_FEED_MS)
        .sort((a, b) => Math.abs(a.at - follower.feedAt) - Math.abs(b.at - follower.feedAt))[0];
      if (!feed || !(follower.mixAt > feed.at)) continue;
      const plannedBefore = (use: StarterUse) => use.createdAt != null && use.createdAt < feed.at;
      if (!(feed.at > now) && !(plannedBefore(leader) && plannedBefore(follower))) continue;
      const gap = Math.abs(feed.at - follower.feedAt);
      if (!best || gap < best.gap) best = { leader, follower, at: feed.at, gap };
    }
  }
  if (!best) return null;
  const { leader, follower, at } = best;
  const ratio = follower.ratio;
  const a = starterBuild(leader.need.mid, leader.need.max, ratio), b = starterBuild(follower.need.mid, follower.need.max, ratio);
  const later = (leader.feeds ?? []).filter(f => f.at > at && f.at < leader.mixAt)
    .reduce((sum, f) => { const x = starterBuild(leader.need.mid, leader.need.max, f.ratio); return sum + x.flour + x.water; }, 0);
  const total = a.total + b.total;
  return {
    at, peakAt: follower.peakAt + (at - follower.feedAt), ratio, leads: leader.id === own.id, otherId: (leader.id === own.id ? follower : leader).id,
    keep: Math.max(0, total + later - leader.need.mid - follower.need.mid),
    first: { name: leader.name, grams: a.total, bakeAt: leader.bakeAt }, second: { name: follower.name, grams: b.total, bakeAt: follower.bakeAt },
    build: { seed: a.seed + b.seed, flour: a.flour + b.flour, water: a.water + b.water, total },
  };
}
const SAME_FEED_MS = 15 * 60000;

/** A saved bake's levain build (journal entry → StarterUse), or null when it has none to share: not sourdough,
 *  no saved levain need (bakes older than that field), no mix, or no planned pre-mix feed with a peak. */
export function savedStarterUse(entry: { id: string; createdAt?: number; eatTime?: number | null; session: { yeastType?: unknown; levainNeed?: { mid: number; max: number }; startTime?: number | null; nextFeedRatio?: number; starterEvents?: readonly { kind: string; time: number; bellPeakTime?: number; feedingRatio?: number }[]; starterFeedRecords?: readonly JarRecord[]; starterLocation?: unknown; kitchenTemp?: unknown } },
  name: string, fr = false, now = Date.now()): StarterUse | null {
  const ses = entry.session;
  if (ses.yeastType !== 'sourdough' || !ses.levainNeed || ses.startTime == null) return null;
  const events = (ses.starterEvents ?? []).filter(e => Number.isFinite(e.time));
  const mixAt = ses.startTime;
  const feed = events.filter(e => e.kind === 'pre_mix' && e.bellPeakTime != null && e.time < mixAt).sort((x, y) => x.time - y.time).at(-1);
  if (!feed) return null;
  return {
    id: entry.id, name, feedAt: feed.time, peakAt: feed.bellPeakTime!, mixAt, ratio: feed.feedingRatio ?? ses.nextFeedRatio ?? 1, need: ses.levainNeed,
    createdAt: entry.createdAt, bakeAt: entry.eatTime ?? undefined,
    // Its jar steps include the take-out its plan shows (round 11, withStarterTakeOut).
    events: withStarterTakeOut(events.map(e => ({ ...e, time: new Date(e.time), bellPeakTime: e.bellPeakTime == null ? undefined : new Date(e.bellPeakTime) })) as JarEvent[],
      ses.starterLocation === 'fridge', getStarterFridgeWarmupH(typeof ses.kitchenTemp === 'number' ? ses.kitchenTemp : 22), now, fr),
    records: ses.starterFeedRecords ?? [],
    feeds: events.filter(e => (e.kind === 'refresh' || e.kind === 'intermediate_refresh' || e.kind === 'pre_mix') && e.time < mixAt)
      .map(e => ({ at: e.time, ratio: e.feedingRatio ?? ses.nextFeedRatio ?? 1 })),
  };
}

/** The other bake's recorded feeds of the jar's steps (at or before the shared feed): a feed ticked in one bake is
 *  done in the other (round 8, S6). Empty without a shared feed. */
export function carriedJarRecords(shared: SharedStarterFeed | null, other: StarterUse | undefined): JarRecord[] {
  if (!shared || !other?.records) return [];
  return other.records.filter(record => Math.min(record.plannedAt, record.actualAt) <= shared.at + 60000);
}

/** "Feed 1:2:2 for both bakes · 180 g: 90 g for the campagne, 90 g for the baguettes". Two bakes of the same name
 *  are told apart by their bake day, and time when they bake the same day (`when`, twinBakeWhen; round 9, S7):
 *  "156 g for the pizzas (Sat 7:30pm), 156 g for the pizzas (Sat 8:30pm)". */
export function sharedFeedLine(shared: SharedStarterFeed, fr: boolean, weight: (grams: number) => string,
  when?: (bakeAt: number | undefined, other: number | undefined) => string): string {
  const r = shared.ratio;
  const twins = shared.first.name === shared.second.name && !!when;
  const label = (own: SharedStarterFeed['first'], other: SharedStarterFeed['first']) => {
    const at = twins ? when!(own.bakeAt, other.bakeAt) : '';
    return at ? `${own.name} (${at})` : own.name;
  };
  const a = label(shared.first, shared.second), b = label(shared.second, shared.first);
  return fr
    ? `Rafraîchir 1:${r}:${r} pour les deux fournées · ${weight(shared.build.total)} : ${weight(shared.first.grams)} pour ${a}, ${weight(shared.second.grams)} pour ${b}`
    : `Feed 1:${r}:${r} for both bakes · ${weight(shared.build.total)}: ${weight(shared.first.grams)} for ${a}, ${weight(shared.second.grams)} for ${b}`;
}

/** A starter step the baker never gave: a past fridge spell drawn from an ESTIMATED or assumed last feed (Simple's
 *  "In the fridge" assumes a week; Custom's age chips "2–3 days ago" … "A week+"). It stays in the plan's events (the
 *  solver's history) but is never shown as a dated fact ("Refrigerate · Wed 18 Nov · 8:00am · Already done", round 9,
 *  N): not in the Recipe's starter card, the planner's rows, or the jar steps a following bake shows. */
export function inventedStarterHistory(event: { kind: string; historicalStorage?: boolean; timeIsEstimate?: unknown; assumed?: unknown }): boolean {
  return event.kind !== 'last_fed' && !!event.historicalStorage && (!!event.timeIsEstimate || !!event.assumed);
}

type TimedEvent = { kind: string; time: Date; isPast?: boolean; historicalStorage?: boolean; bellPeakTime?: Date };
/** The starter steps a bake shows with a shared feed. The bake that leads keeps its plan. The one that follows
 *  feeds nothing of its own before the shared feed (the jar follows the other bake's plan), and its pre-mix feed
 *  is the shared one. Given the leading bake's steps (`jar`), the one that follows shows the jar's own steps up to
 *  the shared feed, its history included (round 8, S6: one jar, one set of fridge dates), each marked `jar` except
 *  the shared feed; then its own steps after its pre-mix feed. Without a shared feed the events are returned as
 *  they are (same array). */
export function starterEventsWithSharedFeed<E extends TimedEvent>(events: E[], shared: SharedStarterFeed | null, now: number, jar?: readonly TimedEvent[]): E[] {
  if (!shared || shared.leads) return events;
  // Its own pre-mix feed still to come, else (the shared feed done, both mixes ahead) its last one.
  const feeds = events.filter(e => e.kind === 'pre_mix').sort((a, b) => +a.time - +b.time);
  const own = feeds.find(e => +e.time > now) ?? feeds.at(-1);
  if (!own) return events;
  const sharedFeed = { ...own, time: new Date(shared.at), bellPeakTime: new Date(shared.peakAt) };
  if (jar?.length) {
    const jarSteps = jar.filter(e => +e.time < shared.at && e.kind !== 'known_peak' && !inventedStarterHistory(e))
      .map(e => ({ ...e, jar: true }) as unknown as E);
    return [...jarSteps, sharedFeed, ...events.filter(e => +e.time > +own.time && e.kind !== 'pre_mix')]
      .sort((a, b) => +a.time - +b.time);
  }
  const starterStep = (e: E) => ['refresh', 'intermediate_refresh', 'fridge_in', 'fridge_out'].includes(e.kind) && !e.isPast && !e.historicalStorage && +e.time >= now;
  return events.filter(e => !(starterStep(e) && +e.time <= +own.time))
    .map(e => e === own ? sharedFeed : e);
}

/** A starter kept in the fridge always has its take-out step (round 11, Priya: the pizza's plan began with "Refresh
 *  feed 9:45pm" and never said to take the starter out). The planner times a fridge starter's first feed after its
 *  warm-up (the revival's removal is part of its busy-time check) but draws the removal only for some plans; here the
 *  first planned feed with no removal before it gets one, `warmupH` earlier (never before `now`). Display only: the
 *  plan's saved events, its validation and the solver are unchanged. `inFridge`: the starter is in the fridge now
 *  (no feed recorded since). Without a missing removal the same array is returned. */
export function withStarterTakeOut<E extends { kind: string; time: Date }>(events: E[], inFridge: boolean, warmupH: number, now: number, fr: boolean): E[] {
  if (!inFridge || !events.length) return events;
  const sorted = [...events].sort((a, b) => +a.time - +b.time);
  const lastFed = sorted.filter(e => e.kind === 'last_fed').at(-1);
  const feed = sorted.find(e => FEED_KINDS.includes(e.kind) && (!lastFed || +e.time > +lastFed.time));
  if (!feed || !(+feed.time > now)) return events;
  // A removal already planned after the starter went in (or after its last feed) and before this feed.
  const since = Math.max(lastFed ? +lastFed.time : -Infinity, ...sorted.filter(e => e.kind === 'fridge_in' && +e.time < +feed.time).map(e => +e.time));
  if (sorted.some(e => e.kind === 'fridge_out' && +e.time >= since && +e.time <= +feed.time)) return events;
  const minutes = Math.round(warmupH * 60);
  const out = { kind: 'fridge_out', time: new Date(Math.max(+feed.time - warmupH * 3600000, now)), isPast: false, isActive: false, isDraggable: false,
    label: fr ? 'Sortir le levain' : 'Starter out of the fridge', cardTimeFormat: 'absolute',
    cardNote: fr ? `~${minutes} min pour atteindre la temp. ambiante` : `~${minutes} min to reach room temp`, bellStyle: 'none', bellSigmaScale: 1 } as unknown as E;
  return [...events, out].sort((a, b) => +a.time - +b.time);
}
const FEED_KINDS = ['refresh', 'intermediate_refresh', 'pre_mix'];

/** A fridge step's time as the plan shows it: on the quarter-hour grid (round 8, S8: "8:02am" was a removal
 *  floored to now, or a feed answer's clock time). Feeds and peaks are already on the grid or have their own format. */
export function starterStepShownTime(event: { kind: string; time: Date }): Date {
  if (event.kind !== 'fridge_in' && event.kind !== 'fridge_out') return event.time;
  return roundToQuarter(event.time);
}
