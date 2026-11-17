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
