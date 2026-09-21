const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/')
    ? path.join(__dirname, '..', request.slice(2))
    : request, ...args);
};
const compileTs = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
require.extensions['.ts'] = compileTs;
require.extensions['.tsx'] = compileTs;

const {findOptimalPosition,commercialPrefermentPlanValid,solverNotificationAlreadySynced,fmtCardHM,fmtCardDT,formatTimeShort}=require('../app/components/SchedulePicker.tsx');
const now=new Date('2026-10-01T08:00Z'),bake=new Date('2026-10-04T18:00Z');
function solve(type,blocks=[],hours=82){return findOptimalPosition(26,36,6,blocks,bake,type!=='none',type==='biga'?48:18,24,hours,type,type==='biga'?12:3,3,0,type==='biga'||type==='poolish',4,'neapolitan');}
test('direct has one mix; selected commercial preferments always retain a distinct preparation event',()=>{
 for(const type of ['none','poolish','biga']){
  const r=solve(type);assert.equal(r.prefHBF>r.mixHBF,type!=='none');
  assert.equal(commercialPrefermentPlanValid({type,inFridge:true,mixTime:new Date(+bake-r.mixHBF*3600000),bakeTime:bake,offsetHours:r.prefHBF-r.mixHBF,blocks:[],now}),true);
 }
});
test('preferment and dough preparation avoid busy slots when a feasible plan exists',()=>{
 const blocks=[{id:'busy',label:'Busy',from:new Date(+bake-50*3600000),to:new Date(+bake-40*3600000)}];
 for(const type of ['poolish','biga']){const r=solve(type,blocks);assert.ok(r.prefHBF>r.mixHBF);for(const offset of [r.prefHBF,r.mixHBF]){const time=+bake-offset*3600000;assert.ok(!(time>+blocks[0].from&&time<+blocks[0].to));}}
});
test('impossible biga preserves the method but is invalid rather than becoming a direct recipe',()=>{
 const shortBake=new Date(+now+4*3600000);
 const r=findOptimalPosition(3,3.5,1,[],shortBake,true,48,24,4,'biga',12,1,0,true,4,'neapolitan');
 assert.ok(r.prefHBF-r.mixHBF>=12);
 assert.equal(commercialPrefermentPlanValid({type:'biga',inFridge:true,mixTime:new Date(+shortBake-r.mixHBF*3600000),bakeTime:shortBake,offsetHours:r.prefHBF-r.mixHBF,blocks:[],now}),false);
});
test('full blockers and reversed or under-minimum phases cannot be accepted',()=>{
 for(const type of ['poolish','biga']){
  const mixTime=new Date(+now+48*3600000),blocks=[{id:'all',label:'Busy',from:now,to:bake}];
  assert.equal(commercialPrefermentPlanValid({type,inFridge:true,mixTime,bakeTime:bake,offsetHours:18,blocks,now}),false);
  for(const offsetHours of [-1,0,.5])assert.equal(commercialPrefermentPlanValid({type,inFridge:true,mixTime,bakeTime:bake,offsetHours,blocks:[],now}),false);
 }
 assert.equal(commercialPrefermentPlanValid({type:'levain',inFridge:false,mixTime:now,bakeTime:bake,offsetHours:0,blocks:[],now}),true);
});
test('selected method is never suppressed from chart or action rows; help does not enable layers',()=>{
 const picker=fs.readFileSync('app/components/SchedulePicker.tsx','utf8'),chart=fs.readFileSync('app/components/FermentChart.tsx','utf8');
 assert.match(picker,/const effectiveHasPref = hasPrefActive;/);
 assert.match(picker,/prefermentType=\{isSourdough \? 'sourdough' : prefermentType\}/);
 assert.match(picker,/if \(!isSourdough && cardPrefTime\)/);
 assert.match(chart,/const revealAll = dragging !== null;/);
 assert.doesNotMatch(chart,/L\.window \|\| focusId/);
 assert.match(chart,/onPointerCancel=\{onPointerUp\}/);
 for(const lang of ['en','fr']){const guide=require(`../messages/${lang}.json`).fermentChart.guide;assert.doesNotMatch(guide.dragRest,/higher is riper|plus c’est haut/);}
});

test('blocked interval includes its start and excludes its end',()=>{
 const mixTime=new Date(+now+48*3600000), prep=new Date(+mixTime-12*3600000);
 const args={type:'biga',inFridge:true,mixTime,bakeTime:bake,offsetHours:12,now};
 assert.equal(commercialPrefermentPlanValid({...args,blocks:[{from:prep,to:new Date(+prep+3600000)}]}),false);
 assert.equal(commercialPrefermentPlanValid({...args,blocks:[{from:new Date(+prep-3600000),to:prep}]}),true);
});
test('restore retains canonical offset and fridge, and only unchanged saved plans may have historical prep',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../app/components/SchedulePicker.tsx'),'utf8');
 assert.match(source,/sessionRestored && Number.isFinite\(savedPrefOffsetHours\)/);
 assert.match(source,/savedCommercial.fridge \?\? true/);
 assert.match(source,/alreadyStarted: unchangedRestoredCommercialPlan/);
 assert.match(source,/If you have not prepared it, choose a new schedule/);
});

test('returning to a previous recommendation resynchronizes a parent changed by a bake-time edit',()=>{
 const recommendation={s:100,e:300};
 assert.equal(solverNotificationAlreadySynced(recommendation,recommendation,{s:80,e:300}),false);
 assert.equal(solverNotificationAlreadySynced(recommendation,recommendation,{s:100,e:300}),true);
 assert.equal(solverNotificationAlreadySynced(null,recommendation,recommendation),false);
});

test('action times preserve canonical minutes, including the end of a day',()=>{
 const nearMidnight=new Date(2026,8,23,23,56);
 assert.equal(fmtCardHM(nearMidnight,true),'23h56');
 assert.equal(fmtCardHM(nearMidnight,false),'11:56pm');
 assert.equal(formatTimeShort(nearMidnight,true),'23h56');
 assert.equal(formatTimeShort(nearMidnight,false),'11:56pm');
 assert.match(fmtCardDT(nearMidnight,true),/23 .*23h56$/);
 assert.match(fmtCardDT(nearMidnight,false),/23 .*11:56pm$/);
 assert.equal(fmtCardHM(new Date(2026,8,23,7,4),true),'7h04');
 assert.equal(fmtCardHM(new Date(2026,8,23,3,19),true),'3h19');
});
