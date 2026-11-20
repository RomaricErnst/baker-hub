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

// 20 Nov 2026 retention round 5 (Maya): during a long rest the bar names the next action.
test('a long fridge rest names the next action after two hours; short gaps and fresh actions stay Now', () => {
  const {clockMark} = require('../app/utils/guideProgress.ts');
  const H = 3600000, t0 = Date.parse('2026-11-20T18:00:00+08:00');
  // Mix 18:00, rise 18:15, shape 21:20, into the fridge 21:35, out 17:35 next day, preheat 18:30, bake 19:30.
  const steps = (done = []) => [
    {step:1, at:t0, action:true}, {step:2, at:t0+0.25*H}, {step:3, at:t0+3.33*H, action:true},
    {step:4, at:t0+3.58*H, action:true}, {step:5, at:t0+23.58*H, action:true},
    {step:6, at:t0+24.5*H, phase:'cooking', action:true}, {step:7, at:t0+25.5*H, phase:'cooking', action:true},
  ].map(s => ({...s, done: done.includes(s.step)}));
  // Into the fridge at 21:35: Now for two hours, ticked or not.
  assert.deepEqual(clockMark(steps(), t0+4*H), {step:4, kind:'now', held:false});
  assert.equal(clockMark(steps([3]), t0+4*H).step, 4);
  // Sat 10:00 (Maya): the next action is named, the fridge step is neither ticked nor held.
  for (const done of [[], [3], [1,2,3]]) assert.deepEqual(clockMark(steps(done), t0+16*H), {step:5, kind:'next', held:false});
  // The take-out's own time: Now again.
  assert.deepEqual(clockMark(steps([3]), t0+23.6*H), {step:5, kind:'now', held:false});
  // A short gap to the next action (shape 21:20 → fridge 21:35) never jumps ahead.
  assert.equal(clockMark(steps(), t0+3.4*H).step, 3);
  // A wait step between them (mix → rise → shape, 3 h) is not a long rest: the rise is under way.
  assert.equal(clockMark(steps(), t0+2.5*H).step, 2);
});
test('after a fridge rest the step named Next is the take-out, even when it is the final rise\'s own wait step', () => {
  const {clockMark} = require('../app/utils/guideProgress.ts');
  const H = 3600000, t0 = 0;
  const steps = [
    {step:1, at:t0, action:true, done:false}, {step:2, at:t0+20*H, done:false},
    {step:3, at:t0+21*H, phase:'cooking', action:true, done:false},
  ];
  assert.deepEqual(clockMark(steps, t0+12*H), {step:2, kind:'next', held:false});
});
