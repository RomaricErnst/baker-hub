const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {serializeStarterEvents,restoreStarterEvents}=require('../app/lib/session.ts');
test('starter schedule survives JSON storage and rebake date shifting',()=>{
 const time=new Date('2026-09-23T04:30:00Z');
 const events=[{kind:'pre_mix',time,isPast:false,isActive:true,isDraggable:false,label:'Pre-mix',cardTimeFormat:'absolute',bellStyle:'solid',bellSigmaScale:1,bellStartTime:time,bellPeakTime:new Date(time.getTime()+6*3600000)}];
 const json=JSON.parse(JSON.stringify(serializeStarterEvents(events)));
 const restored=restoreStarterEvents(json);
 assert.deepEqual(restored,events);
 const shifted=restoreStarterEvents(json,86400000);
 assert.equal(shifted[0].time.getTime(),time.getTime()+86400000);
 assert.equal(shifted[0].bellPeakTime.getTime()-shifted[0].time.getTime(),6*3600000);
 assert.deepEqual(restoreStarterEvents(undefined),[]);
});

test('recipe starter timing stays unchanged after reopening the plan',()=>{
 const {starterFeedToMixHours}=require('../app/lib/starterTiming.ts');
 const mix=new Date('2026-09-23T12:00:00Z');
 const events=[{kind:'last_fed',time:new Date('2026-09-21T00:00:00Z')},{kind:'pre_mix',time:new Date('2026-09-23T06:00:00Z')},{kind:'fridge_out',time:new Date('2026-09-23T11:00:00Z')}];
 assert.equal(starterFeedToMixHours(events,mix,null),6);
 assert.equal(starterFeedToMixHours(restoreStarterEvents(JSON.parse(JSON.stringify(serializeStarterEvents(events)))),mix,null),6);
});
