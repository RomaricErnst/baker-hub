// Poolish near its peak at the mix (owner's decision, 18 Nov 2026).
// The planner only uses the levers the baker left to it and never changes a
// value the baker set. A plan whose poolish, with the yeast the recipe puts in
// it, is still near its peak at the mix is returned exactly as found (lever 1).
// Otherwise, in order:
//   2. poolish in the fridge — only when storage is 'auto' (the fridge
//      protocol's own window, ≤ 24 h, and its warm-up before the mix);
//   3. a later poolish start (shorter poolish, same mix) — only when the baker
//      did not set the poolish time; within the engine's window for that storage;
//   4. else the plan stands and the recipe adds the rest of the same total
//      yeast to the final dough (computePrefermentRecipe in data.ts).
// The poolish % is never changed. "Near its peak" is the recipe's own test
// (data.ts poolishPeakAtMix): the plan is judged by the recipe it will show.
import {recommendPreferment,findFixedBakeSchedule,validateScheduleCandidate,type EditInput,type EditResult,type EditTimes,type FixedBakeSearchResult,type TimingPins} from './scheduleEdit';

export type PoolishSchedule = NonNullable<EditResult['schedule']>;
/** True when the recipe for this dough schedule, poolish time and storage keeps all its yeast in the poolish. */
export type PoolishPeakCheck = (schedule: PoolishSchedule, prefHours: number, inFridge: boolean) => boolean;
export type PoolishLever = 'none' | 'fridge' | 'later' | 'split';
export type PoolishStorage = 'auto' | 'room' | 'fridge';
export interface PoolishChoice { inFridge: boolean; input: EditInput; result: FixedBakeSearchResult }
export interface RipenContext {
  peakAtMix?: PoolishPeakCheck;
  storage: PoolishStorage;
  /** The baker set the poolish time (a pinned or recorded preparation). */
  timeSet: boolean;
  /** The protocol input for a storage (its window, warm-up and method rules). */
  optionFor: (inFridge: boolean) => EditInput | undefined;
  /** The search a storage gets on this path (lever 2). */
  searchStorage: (input: EditInput, inFridge: boolean) => FixedBakeSearchResult;
}

/** Adds the peak test to a candidate's checks; the search itself is unchanged. */
export function withPoolishPeak(input: EditInput, inFridge: boolean, peakAtMix: PoolishPeakCheck): EditInput {
  const formulaValid = input.formulaValid;
  return {...input, formulaValid: (schedule, times) => (!formulaValid || formulaValid(schedule, times)) && peakAtMix(schedule, times.prefHours, inFridge)};
}

export function choicePeaksAtMix(choice: {inFridge: boolean; result: {candidate: EditResult}}, peakAtMix: PoolishPeakCheck): boolean {
  const {schedule, times} = choice.result.candidate;
  return !schedule || peakAtMix(schedule, times.prefHours, choice.inFridge);
}

/** Levers 2 and 3 for a found plan whose poolish would be past its peak. */
export function ripenPoolish<T extends PoolishChoice>(base: T, ctx: RipenContext): (T | PoolishChoice) & {lever: PoolishLever} {
  const {peakAtMix} = ctx;
  if (!peakAtMix || !base.result.found || !base.result.candidate.schedule) return {...base, lever: 'none'};
  if (choicePeaksAtMix(base, peakAtMix)) return {...base, lever: 'none'};
  // 2. Fridge, when the baker left the storage to the planner.
  if (ctx.storage === 'auto' && !base.inFridge) {
    const input = ctx.optionFor(true);
    if (input) {
      const result = ctx.searchStorage(withPoolishPeak(input, true, peakAtMix), true);
      if (result.found) return {inFridge: true, input, result: {...result, candidate: validateScheduleCandidate(input, result.candidate.times)}, lever: 'fridge'};
    }
  }
  // 3. A later poolish start, same mix, when the baker did not set its time.
  if (!ctx.timeSet) {
    const storages = ctx.storage === 'auto' ? [base.inFridge, !base.inFridge] : [base.inFridge];
    const {start, bake, prefHours} = base.result.candidate.times;
    for (const inFridge of storages) {
      const input = inFridge === base.inFridge ? base.input : ctx.optionFor(inFridge);
      const window = input?.prefWindow;
      if (!input || !window) continue;
      const upper = inFridge === base.inFridge ? Math.min(prefHours, window.max) - .25 : window.max;
      for (let hours = Math.floor(upper * 4) / 4; hours >= window.min - 1e-9; hours -= .25) {
        const times: EditTimes = {start, bake, prefHours: hours};
        const candidate = validateScheduleCandidate(input, times);
        if (candidate.valid && candidate.schedule && peakAtMix(candidate.schedule, hours, inFridge))
          return {inFridge, input, result: {candidate, found: true, searched: 1, exhausted: false}, lever: 'later'};
      }
    }
  }
  // 4. The plan stands; the recipe puts the rest of the yeast in the final dough.
  return {...base, lever: 'split'};
}

/** recommendPreferment, then levers 2–3 when its plan's poolish would be past its peak. */
export function recommendRipePoolish(options: {inFridge: boolean; input: EditInput}[], pins: TimingPins = {}, preferences: {preferCold?: boolean; startThisEvening?: boolean} = {}, ctx: Omit<RipenContext, 'optionFor' | 'searchStorage'>) {
  const base = recommendPreferment(options, pins, preferences);
  if (!base || !ctx.peakAtMix) return base && {...base, lever: 'none' as PoolishLever};
  return ripenPoolish(base, {...ctx,
    optionFor: inFridge => options.find(option => option.inFridge === inFridge)?.input,
    searchStorage: (input, inFridge) => recommendPreferment([{inFridge, input}], pins, preferences).result,
  });
}

/** The same levers for a plan kept in its storage (findFixedBakeSchedule paths). */
export function ripenFixedPoolish(input: EditInput, inFridge: boolean, pins: TimingPins, ctx: Omit<RipenContext, 'searchStorage'>) {
  const result = findFixedBakeSchedule(input, pins);
  return ripenPoolish({inFridge, input, result}, {...ctx, searchStorage: candidate => findFixedBakeSchedule(candidate, pins)});
}
