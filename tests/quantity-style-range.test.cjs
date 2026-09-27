const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('app/[locale]/page.tsx', 'utf8');
const table = source.slice(source.indexOf('const PIZZA_WEIGHT_TABLE:'), source.indexOf('const STYLE_HAS_DIAMETER'));
const fn = source.slice(source.indexOf('function pizzaWeightFromTable('), source.indexOf('// Diameter, crust and weight'));
const context = {};
vm.runInNewContext(ts.transpile(table + fn + '\nglobalThis.weight = pizzaWeightFromTable;', {target: ts.ScriptTarget.ES2020}), context);
test('diameter presets preserve style-specific dough weights', () => {
  assert.equal(context.weight('neapolitan', 30, 1), 260);
  assert.equal(context.weight('newyork', 35, 1), 320);
  assert.equal(context.weight('newyork', 40, 2), 405);
  assert.equal(context.weight('pizza_romana', 24, 0), 175);
  assert.equal(context.weight('sourdough', 35, 2), 295);
});
