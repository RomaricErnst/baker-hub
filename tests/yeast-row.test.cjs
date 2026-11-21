const test = require('node:test');
const assert = require('node:assert/strict');
const row = require('../app/utils/yeastRow.ts');

// Fine-tune yeast row (20 Nov 2026 round 7, owner): one-line label, "Auto" until the plan, then its amount greyed.
test('labels name the yeast after a middle dot, in both languages', () => {
  assert.equal(row.yeastRowLabel('instant', false), 'Yeast · instant dry');
  assert.equal(row.yeastRowLabel('active_dry', false), 'Yeast · active dry');
  assert.equal(row.yeastRowLabel('fresh', false), 'Yeast · fresh');
  assert.equal(row.yeastRowLabel('instant', true), 'Levure · instantanée');
  assert.equal(row.yeastRowLabel('active_dry', true), 'Levure · sèche active');
  assert.equal(row.yeastRowLabel('fresh', true), 'Levure · fraîche');
});

test('the empty box reads Auto, then the plan amount with "· auto"', () => {
  assert.equal(row.autoPctPlaceholder(undefined, false), 'Auto');
  assert.equal(row.autoPctPlaceholder(undefined, true), 'Auto');
  assert.equal(row.autoPctPlaceholder(0.1834, false), '0.18 · auto');
  assert.equal(row.autoPctPlaceholder(0.1834, true), '0,18 · auto');
  assert.equal(row.autoPctPlaceholder(0.0525, false), '0.053 · auto');
});
