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
 * hold. A tick closes the steps planned before it. The bake is never blocked: nothing here
 * hides or disables anything, it only names a step.
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
      if (!nextAction || now < nextAction.at) return { step: s.step, kind: 'now', held: due.at(-1) !== s };
    }
  }
  const s = due.length ? due[due.length - 1] : pending[0];
  return { step: s.step, kind: s.at <= now ? 'now' : 'next', held: false };
}

/** Ticking a step ticks the unticked steps planned before it in the same bake: the baker's own act
 *  says they were done (you cannot shape a dough you have not mixed). Never inferred from the clock. */
export function stepsClosedByTick(steps: readonly ClockStep[], ticked: number): number[] {
  const target = steps.find(s => s.step === ticked);
  if (!target) return [];
  return steps.filter(s => !s.done && s.step !== ticked && (s.at < target.at || (s.at === target.at && s.step < ticked))).map(s => s.step);
}
