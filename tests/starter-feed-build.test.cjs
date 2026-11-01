const {test} = require('node:test');
const assert = require('node:assert/strict');
require('./load-production.cjs');
const {starterBuild, starterFeedRoleLabel} = require('../app/utils/starterBuild.ts');

test('every prescribed feed covers the whole recipe range, reserve and jar loss at the chosen ratio', () => {
  for (const ratio of [1, 2, 4, 5, 10]) {
    for (const maximum of [9, 35, 129, 501, 1340]) {
      const target = Math.round(maximum / 1.08);
      const feed = starterBuild(target, maximum, ratio);
      assert.equal(feed.flour, ratio * feed.seed);
      assert.equal(feed.water, feed.flour);
      assert.equal(feed.total, feed.seed + feed.flour + feed.water);
      assert.ok(feed.total * 0.9 >= Math.max(target, maximum) + feed.keep);
    }
  }
  assert.deepEqual(starterBuild(120, 129, 1), {seed:58, flour:58, water:58, total:174, keep:26});
  assert.equal(starterFeedRoleLabel('pre_mix', true), 'Rafraîchi avant pétrissage');
});
