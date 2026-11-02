// Run the production dough planner against recurring availability for the entire
// repair horizon. Starter biology is independently exercised in the component matrix.
const assert = require('node:assert/strict');
const {utils} = require('./load-production.cjs');
const {validateScheduleCandidate} = require('../app/utils/scheduleEdit.ts');
const fs=require('node:fs'), ts=require('typescript');
const Module = require('node:module');
const path = require('node:path');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/')
    ? path.join(__dirname, '..', request.slice(2)) : request, ...args);
};
require.extensions['.tsx'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
    fileName: filename,
  }).outputText, filename);
};
const {commercialReadinessWindow,STYLE_FERM_DEFAULTS}=require('../app/components/SchedulePicker.tsx');
const hour = 3600000;
const monday = Date.parse('2026-11-02T00:00Z');
const styles = ['neapolitan','newyork','pizza_romana','roman','baguette','pain_campagne','fougasse','pain_complet'];
function periods(mask) {
  const blocks = [];
  for (let day = -4; day <= 5; day++) {
    const date = monday + day*24*hour;
    const weekday = new Date(date).getUTCDay();
    if (mask !== 'work') blocks.push({from:new Date(date-hour),to:new Date(date+7*hour),label:'Night'});
    if (mask !== 'sleep' && weekday>0 && weekday<6) blocks.push({from:new Date(date+9*hour),to:new Date(date+18*hour),label:'Work'});
  }
  return blocks;
}
const results = {total:0,clear:0,clashes:0,repaired:0,covered:0,invalid:0};
const samples=[];
for (const styleKey of styles) {
 for (const kitchenTemp of [18,22,27,32]) for (const fraction of [0,0.33,0.67,1])
 for (const lead of [1,4,8,12]) for (const bakeHour of [8,15,19.5]) for (const mask of ['sleep','work','both']) {
  const bake=new Date(monday+bakeHour*hour);
  const boundsAt=totalWindowH=>commercialReadinessWindow({...STYLE_FERM_DEFAULTS[styleKey],kitchenTemp,preheatMin:45,flourStrength:1,totalWindowH});
  const bounds=boundsAt(72);
  const duration=Math.round((bounds.to+fraction*(bounds.from-bounds.to))*4)/4;
  const start=new Date(+bake-duration*hour);
  const now=new Date(+start-lead*hour), blocks=periods(mask);
  const mixWindow=oven=>{
    const range=boundsAt((+oven-+now)/hour);
    return {from:new Date(+oven-range.from*hour),to:new Date(+oven-range.to*hour)};
  };
  const req={styleKey,kitchenTemp,preheatMin:45,mixerType:'hand',numItems:4};
  // Use the same entry point as the displayed commercial candidate.
  const validate=(start,bake,blocks)=>validateScheduleCandidate({...req,start,bake,blocks,window:mixWindow,
    now:+now,hasPreferment:false,prefHours:0,prefWarmupHours:0,supported:true,methodValid:()=>true});
  const draft=validate(start,bake,blocks);
  results.total++;
  const original=draft.schedule;
  assert.ok(original);
  if (!original.availabilityConflicts.length && !original.bulkConflict && !original.coldExitConflict) {
    if(original.preparationInvalid){results.invalid++;continue;}
    assert.equal(draft.valid,true,JSON.stringify({styleKey,kitchenTemp,duration,lead,bakeHour,mask,reason:draft.issue}));
    results.clear++;continue;
  }
  results.clashes++;
  const repair=utils.findScheduleRepair({...req,startTime:start,eatTime:bake,availabilityBlocks:blocks,now,mixWindow});
  if (!repair) {
    // The baker may explicitly accept one named conflict at a time. Each
    // acknowledgement must remove that exact action and leave others intact.
    let edited=blocks,checked=draft;
    const maxActions=original.availabilityActions.length;
    for(let n=0;n<maxActions&&!checked.valid;n++){
      const first=checked.schedule.availabilityConflicts[0]?.action;
      if(!first) break;
      const record={id:first.id,at:+first.at,...(first.end?{end:+first.end}:{})};
      edited=edited.map(block=>checked.schedule.availabilityConflicts.some(conflict=>conflict.block===block && conflict.action.id===first.id && +conflict.action.at===+first.at)
        ? {...block,coveredActions:[...(block.coveredActions??[]),record]}:block);
      checked=validate(start,bake,edited);
    }
    if(checked.valid)results.covered++;
    else if(samples.length<10)samples.push({styleKey,kitchenTemp,duration,lead,bakeHour,mask,reason:checked.issue,remaining:checked.schedule.availabilityConflicts.map(c=>c.action.id),invalid:checked.schedule.preparationInvalid,exit:checked.schedule.coldExitConflict});
    continue;
  }
  assert.ok(+repair.eatTime>=+bake && +repair.eatTime<=+bake+72*hour);
  const checked=validate(repair.startTime,repair.eatTime,blocks);
  assert.ok(checked.valid,JSON.stringify({styleKey,kitchenTemp,duration,lead,bakeHour,mask,reason:checked.issue}));
  results.repaired++;
 }
 console.log(styleKey,results);
}
console.log({results,repairRate:results.repaired/results.clashes,samples});
assert.equal(results.total,4608);
assert.equal(results.repaired+results.covered,results.clashes);
