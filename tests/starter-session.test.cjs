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
