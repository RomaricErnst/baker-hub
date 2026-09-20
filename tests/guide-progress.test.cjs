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
