const {test}=require('node:test'),assert=require('node:assert/strict');
const {data}=require('./load-production.cjs');
const {BREAD_GROUPS}=require('../app/lib/breadNavigation.ts');
const {sandwichFamilyForStyle}=require('../app/lib/sandwich.ts');
test('visible bread groups cover every supported bread once without duplicating destinations',()=>{
 const keys=BREAD_GROUPS.flatMap(g=>g.keys);
 assert.equal(new Set(keys).size,keys.length);
 assert.deepEqual([...keys].sort(),Object.keys(data.BREAD_STYLES).sort());
 assert.equal(sandwichFamilyForStyle('brioche'),null);
 assert.equal(sandwichFamilyForStyle('pita'),'pita');
 assert.equal(sandwichFamilyForStyle('pain_campagne'),'tartine');
});
