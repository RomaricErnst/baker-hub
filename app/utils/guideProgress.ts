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
