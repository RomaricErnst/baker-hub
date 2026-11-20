// One jar, two bakes (20 Nov 2026 retention round 7, B5, Priya: two live sourdough bakes each planned their own
// feeds of the same starter). When another live sourdough bake on this device feeds the jar for its levain close
// enough that one feed is ready for both mixes, the two bakes build their levain from that one feed: sized for
// both, said once with both amounts, and the later bake's starter steps follow the earlier bake's plan.
// Nothing with one bake (owner's rule B): with no other bake the caller never calls this, and a null result
// leaves the plan as it is.
import { mixNearPeak } from './starterPeak';
import { starterBuild } from './starterBuild';

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
}

export interface SharedStarterFeed {
  /** The one feed: the earlier bake's pre-mix feed. */
  at: number;
  peakAt: number;
  ratio: number;
  /** True when this bake's own feed is the one kept (its plan leads); false when it follows the other bake. */
  leads: boolean;
  first: { name: string; grams: number };
  second: { name: string; grams: number };
  build: { seed: number; flour: number; water: number; total: number };
}

/** The feed both bakes can use, or null. The earlier pre-mix feed is kept; the later bake shares it when its
 *  own mix falls in that feed's ready window (mixNearPeak: the solver's green band around the peak, from that
 *  feed's own rise). Both bakes compute the same pair, whichever is on screen. */
export function sharedStarterFeedFor(own: StarterUse, others: readonly StarterUse[], now: number): SharedStarterFeed | null {
  if (!(own.feedAt > now) || !(own.peakAt > own.feedAt)) return null;
  let best: { other: StarterUse; gap: number } | null = null;
  for (const other of others) {
    if (other.id === own.id || !(other.feedAt > now) || !(other.peakAt > other.feedAt)) continue;
    const ownFirst = own.feedAt < other.feedAt || (own.feedAt === other.feedAt && own.id < other.id);
    const [early, late] = ownFirst ? [own, other] : [other, own];
    const riseH = (early.peakAt - early.feedAt) / 3600000;
    if (!(late.mixAt > early.feedAt) || !mixNearPeak(late.mixAt, early.peakAt, riseH)) continue;
    const gap = Math.abs(other.feedAt - own.feedAt);
    if (!best || gap < best.gap) best = { other, gap };
  }
  if (!best) return null;
  const other = best.other;
  const leads = own.feedAt < other.feedAt || (own.feedAt === other.feedAt && own.id < other.id);
  const [early, late] = leads ? [own, other] : [other, own];
  const ratio = early.ratio;
  // Each dough's own build at the kept feed's ratio, then one feed of both.
  const a = starterBuild(early.need.mid, early.need.max, ratio), b = starterBuild(late.need.mid, late.need.max, ratio);
  return {
    at: early.feedAt, peakAt: early.peakAt, ratio, leads,
    first: { name: early.name, grams: a.total }, second: { name: late.name, grams: b.total },
    build: { seed: a.seed + b.seed, flour: a.flour + b.flour, water: a.water + b.water, total: a.total + b.total },
  };
}

/** "Feed 1:2:2 for both bakes · 180 g: 90 g for the campagne, 90 g for the baguettes". */
export function sharedFeedLine(shared: SharedStarterFeed, fr: boolean, weight: (grams: number) => string): string {
  const r = shared.ratio;
  return fr
    ? `Rafraîchir 1:${r}:${r} pour les deux fournées · ${weight(shared.build.total)} : ${weight(shared.first.grams)} pour ${shared.first.name}, ${weight(shared.second.grams)} pour ${shared.second.name}`
    : `Feed 1:${r}:${r} for both bakes · ${weight(shared.build.total)}: ${weight(shared.first.grams)} for ${shared.first.name}, ${weight(shared.second.grams)} for ${shared.second.name}`;
}

type TimedEvent = { kind: string; time: Date; isPast?: boolean; historicalStorage?: boolean; bellPeakTime?: Date };
/** The starter steps a bake shows with a shared feed. The bake that leads keeps its plan. The one that follows
 *  feeds nothing of its own before the shared feed (the jar follows the other bake's plan), and its pre-mix feed
 *  is the shared one. Without a shared feed the events are returned as they are (same array). */
export function starterEventsWithSharedFeed<E extends TimedEvent>(events: E[], shared: SharedStarterFeed | null, now: number): E[] {
  if (!shared || shared.leads) return events;
  const own = events.find(e => e.kind === 'pre_mix' && +e.time > now);
  if (!own) return events;
  const starterStep = (e: E) => ['refresh', 'intermediate_refresh', 'fridge_in', 'fridge_out'].includes(e.kind) && !e.isPast && !e.historicalStorage && +e.time >= now;
  return events.filter(e => !(starterStep(e) && +e.time <= +own.time))
    .map(e => e === own ? { ...e, time: new Date(shared.at), bellPeakTime: new Date(shared.peakAt) } : e);
}
