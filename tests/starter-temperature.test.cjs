const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const utils=require('../app/utils.ts');
// A fridge starter used without another feed is only partly warmed at mixing;
// the water calculation uses that temperature, so the water comes out warmer.
test('a colder starter at mixing asks for warmer water',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-25T18:00Z'),[],22,45,'stand','pain_campagne');
 const at=t=>utils.calculateRecipe('pain_campagne','dutch_oven',1,800,22,'normal',schedule,6,'sourdough','custom','stand',
  undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,t);
 const room=at(undefined),warmed=utils.prefTempAfterWarmup(100,100,6,22,1.5),cold=at(warmed);
 assert.ok(warmed>6&&warmed<22,`starter after 1.5 h out: ${warmed}`);
 assert.ok(cold.waterTemp>room.waterTemp,`water ${cold.waterTemp} vs ${room.waterTemp}`);
 assert.ok(Math.abs(cold.thermal.doughTempC-room.thermal.doughTempC)<0.6,'both reach the target dough temperature');
});
