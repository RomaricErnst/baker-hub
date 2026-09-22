const {test} = require('node:test');
const assert = require('node:assert/strict');
const {utils} = require('./load-production.cjs');
const {BREAD_PROTOCOLS} = require('../app/utils/breadProfiles.ts');
const start = new Date('2026-09-25T10:00:00Z');

test('new bread climate/fridge/mode matrix keeps recipe mass finite and conserved', () => {
  for (const [style, protocol] of Object.entries(BREAD_PROTOCOLS)) {
    const oven = protocol.equipment[0];
    for (const temp of [16,22,30,35,38]) for (const fridge of [2,4,8]) for (const mode of ['simple','custom']) {
      const end = new Date(+start + (protocol.method === 'unleavened' ? 2 : 24) * 3600000);
      const schedule = utils.buildSchedule(start,end,[],temp,oven === 'griddle' ? 5 : 30,'hand',style);
      const recipe = utils.calculateRecipe(style,oven,4,140,temp,'normal',schedule,fridge,'instant',mode,'hand');
      const quantities = [recipe.flour,recipe.water,recipe.salt,recipe.oil,recipe.sugar,recipe.yeast?.convertedGrams ?? 0];
      assert.ok(quantities.every(n=>Number.isFinite(n)&&n>=0), `${style}/${temp}/${fridge}/${mode}`);
      assert.ok(Math.abs(quantities.reduce((a,b)=>a+b,0)-560)<=3, `${style} batch mass`);
    }
  }
});

test('unleavened piadina cannot inherit a saved yeast or preferment recipe', () => {
  for (const temp of [16,22,30,38]) for (const yeast of ['instant','active_dry','fresh','sourdough']) for (const preferment of ['none','poolish','biga','levain']) {
    const schedule = utils.buildSchedule(start,new Date(+start+2*3600000),[],temp,5,'hand','piadina');
    const recipe = utils.calculateRecipe('piadina','griddle',4,140,temp,'normal',schedule,4,yeast,'custom','hand',undefined,undefined,undefined,undefined,preferment);
    assert.equal(recipe.yeast,null);
    assert.equal(recipe.sourdough,null);
    assert.equal(recipe.preferment,null);
    assert.equal(schedule.totalRTHours,0);
    assert.equal(schedule.totalColdHours,0);
    assert.equal(schedule.coldRetardStart,null);
    assert.equal(schedule.coldRetard2Start,null);
  }
});

test('a griddle batch cannot be clear when unavailability starts after its first bread begins', () => {
  const cook = new Date('2026-09-25T12:45:00Z');
  for (const style of ['piadina','greek_pita','batbout']) {
    const mix = new Date(+cook-(style==='piadina'?45:180)*60000);
    const blocked = utils.buildSchedule(mix,cook,[{from:new Date(+cook+60000),to:new Date(+cook+30*60000),label:'Away'}],22,5,'hand',style,4);
    assert.ok(blocked.availabilityConflicts.some(c=>c.action.id==='bake'),style);
    const cooking = blocked.availabilityActions.find(a=>a.id==='bake');
    assert.equal(+cooking.end-+cooking.at,4*BREAD_PROTOCOLS[style].cookMinutes[1]*60000);
    const after = utils.buildSchedule(mix,cook,[{from:cooking.end,to:new Date(+cooking.end+30*60000),label:'Away'}],22,5,'hand',style,4);
    assert.ok(!after.availabilityConflicts.some(c=>c.action.id==='bake'),style);
  }
});

test('bagel poaching occupies real work time without extending dough fermentation to oven entry', () => {
  const bake = new Date(+start+4*3600000);
  const block = {from:new Date(+bake-5*60000),to:new Date(+bake-60000),label:'Away'};
  const schedule = utils.buildSchedule(start,bake,[block],22,30,'hand','bagel',6);
  assert.equal(+schedule.bakeStart,+bake);
  assert.equal(+bake-+schedule.poachStart,12*60000);
  assert.ok(schedule.availabilityConflicts.some(c=>c.action.id==='poach'));
  assert.equal(schedule.totalRTHours+schedule.totalColdHours,(+schedule.poachStart-+schedule.bulkFermStart)/3600000);
  const short = utils.buildSchedule(start,new Date(+start+2*3600000),[],22,30,'hand','bagel',6);
  assert.equal(short.preparationInvalid,true);
  const recipe = utils.calculateRecipe('bagel','standard_bread',6,110,22,'normal',short,4,'instant','simple','hand');
  assert.equal(recipe.protocolIssue,'timing');
});
