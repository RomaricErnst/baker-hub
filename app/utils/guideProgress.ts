export function firstIncompleteStep(completed: ReadonlySet<number>): number {
  let step = 1;
  while (completed.has(step)) step++;
  return step;
}
/** Completion and browsing are independent; undo changes only this step. */
export function toggleStepCompletion(step: number, completed: ReadonlySet<number>): Set<number> {
  const next = new Set(completed);
  if (next.has(step)) next.delete(step);
  else next.add(step);
  return next;
}

/** What identifies a guide step across plan changes: its phase and title, with the
 *  occurrence for repeated titles (two starter feeds). Indexed by step number. */
export function guideStepSignatures(steps: ReadonlyArray<{ phase?: string; title?: string } | null | undefined>): string[] {
  const seen = new Map<string, number>();
  return steps.map(step => {
    if (!step) return '';
    const base = `${step.phase ?? ''}|${step.title ?? ''}`;
    const k = (seen.get(base) ?? 0) + 1;
    seen.set(base, k);
    return `${base}#${k}`;
  });
}

/** Ticks follow their step when a plan change inserts or removes steps (a late feed adds a
 *  refresh; a new plan drops one). A step that no longer exists loses its tick; with the same
 *  number of steps and no title match (a language switch) numbers are kept. */
export function remapCompletedSteps(completed: Iterable<number>, before: readonly string[], after: readonly string[]): number[] {
  if (!before.length || !after.length) return [...completed];
  const out = new Set<number>();
  for (const step of completed) {
    const sig = before[step];
    const index = sig ? after.indexOf(sig) : -1;
    if (index > 0) out.add(index);
    else if (before.length === after.length && after[step]) out.add(step);
  }
  return [...out].sort((a, b) => a - b);
}

/** One guide step as the clock sees it. */
export interface ClockStep {
  step: number;
  at: number;
  phase?: string;
  /** Something the baker does (mix, preferment, feed, into or out of the fridge, divide/shape);
   *  a wait (rise, rest, chill) is not one. */
  action?: boolean;
  done: boolean;
}
export interface ClockMark { step: number; kind: 'now' | 'next'; held: boolean }

/**
 * The step the bar names (18 Nov 2026 retention round 3, owner's rule): the clock drives it.
 * A baker who ticks nothing simply follows the clock: the latest step whose time has come.
 * Once the baker has ticked something in this bake, an earlier unticked action step stays Now
 * after its time until the next action step's time (a grace period, never a gate); waits never
 * hold. A tick marks only its own step (20 Nov 2026 round 6, owner's decision D2): steps planned
 * before the last tick stay unticked and plain, behind the baker, never held or named. The bake is
 * never blocked: nothing here hides or disables anything, it only names a step.
 */
export function clockMark(steps: readonly ClockStep[], now: number): ClockMark | null {
  const sorted = [...steps].sort((a, b) => a.at - b.at || a.step - b.step);
  const ticked = sorted.some(s => s.done);
  const lastDoneAt = Math.max(-Infinity, ...sorted.filter(s => s.done).map(s => s.at));
  const pending = sorted.filter(s => !s.done && s.at >= lastDoneAt);
  if (!pending.length) return null;
  const due = pending.filter(s => s.at <= now);
  if (ticked) {
    for (const s of due) {
      if (!s.action || s.phase === 'cooking') continue;
      const nextAction = sorted.find(o => o.at > s.at && o.action);
      if (!nextAction || now < nextAction.at) return restOrNow(sorted, s, now) ?? { step: s.step, kind: 'now', held: due.some(o => o !== s && o.at >= s.at) };
    }
  }
  // Steps planned at the same minute (a sourdough mix and its bulk, a take-out at the preheat): the first of
  // them is the one to do, so an unticked mix is never skipped to the rise (18 Nov 2026 retention round 4).
  const latest = due.length ? due[due.length - 1].at : undefined;
  const s = due.length ? due.find(d => d.at === latest)! : pending[0];
  if (s.at <= now && s.action && s.phase !== 'cooking') { const rest = restOrNow(sorted, s, now); if (rest) return rest; }
  return { step: s.step, kind: s.at <= now ? 'now' : 'next', held: false };
}

/** During a long rest the next thing to do is what the bar names (20 Nov 2026 retention round 5, Maya: at
 *  10:00 a 20-hour fridge rest opened as "Now" with an empty "Step done" and read as a missed step). An action
 *  that starts a wait of at least LONG_REST_MS (into the fridge, a poolish made) stays Now for REST_GRACE_MS
 *  after its time; then the step after the rest is "Next". The earlier step is neither ticked nor marked missed. */
export const REST_GRACE_MS = 2 * 3600000;
export const LONG_REST_MS = 4 * 3600000;
function restOrNow(sorted: readonly ClockStep[], s: ClockStep, now: number): ClockMark | null {
  if (now - s.at < REST_GRACE_MS) return null;
  // The step after the rest, whatever its kind (the take-out can be the final rise's own step). Nothing is
  // planned between them, so the rest is one wait, not a sequence of steps the baker may be on.
  const next = sorted.find(o => o.at > s.at && !o.done);
  if (!next || next.at <= now || next.at - s.at < LONG_REST_MS) return null;
  return { step: next.step, kind: 'next', held: false };
}

/**
 * The step a home row names for a bake (18 Nov 2026 retention round 4): the next thing to DO, by the guide's own
 * step. Among the unticked action steps not behind the last tick (nor behind a later step that has begun), the
 * one whose time is nearest now (a poolish made five hours ago gives way to a mix due in twenty minutes; a wait
 * such as the final rise gives way to the take-out or the oven). Without an action left, the step the clock marks.
 */
export function rowStep(steps: readonly ClockStep[], now: number): { step: number; current: boolean } | null {
  const lastDoneAt = Math.max(-Infinity, ...steps.filter(s => s.done).map(s => s.at));
  // A past action counts only while the clock is still on it (no later step has begun): a shaping behind a
  // final rise that has started is behind the baker.
  const actions = [...steps].filter(s => !s.done && s.action && s.at >= lastDoneAt
    && (s.at > now || !steps.some(o => o.at > s.at && o.at <= now))).sort((a, b) => a.at - b.at || a.step - b.step);
  let best: ClockStep | undefined;
  for (const s of actions) if (!best || Math.abs(s.at - now) < Math.abs(best.at - now)) best = s;
  if (best) return { step: best.step, current: best.at <= now };
  const mark = clockMark(steps, now);
  return mark ? { step: mark.step, current: mark.kind === 'now' } : null;
}
