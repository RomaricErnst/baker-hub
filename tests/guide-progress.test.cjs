const {test} = require('node:test');
const assert = require('node:assert/strict');
require('./load-production.cjs');
const {firstIncompleteStep, toggleStepCompletion} = require('../app/utils/guideProgress.ts');
test('a browsed future step can be completed without completing intervening steps', () => {
  const original = new Set([1]);
  const completed = toggleStepCompletion(4, original);
  assert.deepEqual([...completed], [1, 4]);
  assert.equal(firstIncompleteStep(completed), 2);
  assert.deepEqual([...original], [1]);
});
test('undo preserves completion of subsequent steps', () => {
  const completed = toggleStepCompletion(2, new Set([1, 2, 3, 4]));
  assert.deepEqual([...completed], [1, 3, 4]);
  assert.equal(firstIncompleteStep(completed), 2);
  assert.deepEqual([...toggleStepCompletion(2, completed)].sort(), [1, 2, 3, 4]);
});

const {guideStepSignatures, remapCompletedSteps} = require('../app/utils/guideProgress.ts');
test('ticks follow their step when a late feed inserts a step, and drop with a removed one (17 Nov 2026 retention round 2)', () => {
  const step = (phase, title) => ({phase, title});
  // Index = step number (1-based; 0 unused).
  const before = guideStepSignatures([null, step('preparation','Refresh feed'), step('preparation','Start Dough'), step('preparation','Refrigerate the dough'), step('cooking','Preheat the oven')]);
  const after = guideStepSignatures([null, step('preparation','Refresh feed'), step('preparation','Refresh feed'), step('preparation','Start Dough'), step('preparation','Refrigerate the dough'), step('cooking','Preheat the oven')]);
  assert.deepEqual(remapCompletedSteps([1, 3], before, after), [1, 4], 'the refrigerate tick stays on Refrigerate');
  assert.deepEqual(remapCompletedSteps([1, 4], after, before), [1, 3]);
  // The second feed was ticked and no longer exists: its tick goes, the others stay.
  assert.deepEqual(remapCompletedSteps([2, 4], after, before), [3]);
  // A language switch (same steps, other titles) keeps the numbers.
  const fr = guideStepSignatures([null, step('preparation','Rafraîchi'), step('preparation','Pétrir la pâte'), step('preparation','Pointage au froid'), step('cooking','Préchauffer le four')]);
  assert.deepEqual(remapCompletedSteps([1, 3], before, fr), [1, 3]);
  // Nothing known about the old steps: numbers are kept as stored.
  assert.deepEqual(remapCompletedSteps([2], [], after), [2]);
});
