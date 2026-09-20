export function firstIncompleteStep(completed: ReadonlySet<number>): number {
  let step = 1;
  while (completed.has(step)) step++;
  return step;
}
export function canChangeStepCompletion(step: number, completed: ReadonlySet<number>): boolean {
  return completed.has(step) || step === firstIncompleteStep(completed);
}
