const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {NextIntlClientProvider}=require('next-intl');
const chart=require('../app/components/FermentChart.tsx');
const messages=require('../messages/en.json');
test('all fermentation methods render finite chart geometry in both temperature extremes',()=>{
 for(const type of ['none','poolish','biga','levain','sourdough'])for(const temp of [16,24,32,38])for(const fridge of [2,8]){
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(chart.default,{eatTime:new Date('2026-09-25T18:00Z'),prefermentType:type,kitchenTemp:temp,fridgeTemp:fridge,mixOffsetH:24,prefOffsetH:12,blocks:[],onMixChange:()=>{},onPrefChange:()=>{},prefInFridge:type==='biga'||type==='poolish',starterFeedTime:new Date('2026-09-24T08:00Z'),starterAdjPeakH:5.5})));
 assert.ok(html.includes('<svg'));assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'));
 }
});
test('poolish graph fridge timing uses entered temperature, starter helpers remain finite',()=>{
 assert.equal(chart.getPrefOptH('poolish',24,true,'neapolitan',2),19);
 assert.equal(chart.getPrefOptH('poolish',24,true,'neapolitan',8),10);
 for(const t of [16,24,32,38]){assert.ok(chart.getPrefPeakH_RT('sourdough',t)>0);assert.equal(chart.getPrefPeakH_RT('levain',t),chart.getPrefPeakH_RT('sourdough',t));}
 const source=fs.readFileSync(path.join(__dirname,'../app/components/FermentChart.tsx'),'utf8');
 assert.ok(!source.includes('getPrefOptH(prefermentType, kitchenTemp, true)'));
});
test('cold halos follow exact schedule stages after mixing and preserve shaping gaps',()=>{
 const bake=new Date('2026-09-25T18:00Z'),start=new Date('2026-09-24T08:00Z');
 const schedule=utils.buildSchedule(start,bake,[],22,45,'hand','pain_campagne');
 assert.equal(schedule.mixingDurationH,0.6);
 const intervals=chart.scheduleColdIntervals(schedule);
 assert.equal(intervals.length,2);
 assert.equal(+intervals[0].from,+schedule.coldRetard1Start);
 assert.equal(+intervals[0].to,+schedule.coldRetard1End);
 assert.equal(+intervals[1].from,+schedule.coldRetard2Start);
 assert.ok(+intervals[0].from >= +start+36*60000);
 assert.ok(+intervals[1].from > +intervals[0].to);
 const ranges=chart.coldIntervalHoursBeforeBake(bake,intervals);
 assert.equal(+bake-ranges[0][0]*3600000,+schedule.coldRetard1Start);
 assert.equal(+bake-ranges[1][1]*3600000,+schedule.coldRetard2End);
});
test('a poolish warm-up ends its cold interval before mixing',()=>{
 const bake=new Date('2026-09-25T18:00Z'),mix=new Date('2026-09-24T18:00Z'),prep=new Date('2026-09-24T04:00Z'),out=new Date('2026-09-24T16:00Z');
 const ranges=chart.coldIntervalHoursBeforeBake(bake,[{from:prep,to:out}]);
 assert.deepEqual(ranges,[[38,26]]);
 assert.ok(ranges[0][1]>(+bake-+mix)/3600000);
 const source=fs.readFileSync(path.join(__dirname,'../app/components/FermentChart.tsx'),'utf8');
 assert.match(source,/bakeMs - \+prefermentFridgeOutTime/);
 assert.ok(!source.includes('coldStartHBF = effectiveMixHBF - (phases.bulkFermH'));
});
test('starter refrigeration follows paired events and leaves the refresh period warm',()=>{
 const event=(kind,time)=>({kind,time:new Date(time),label:kind,isPast:false,isActive:false,isDraggable:false,bellStyle:'none',bellSigmaScale:1});
 const events=[event('refresh','2026-09-24T08:00Z'),event('fridge_in','2026-09-24T12:00Z'),event('fridge_out','2026-09-25T06:00Z'),event('pre_mix','2026-09-25T07:00Z')];
 const cold=chart.starterColdIntervals(events);
 assert.deepEqual(cold.map(x=>[x.from.toISOString(),x.to.toISOString()]),[['2026-09-24T12:00:00.000Z','2026-09-25T06:00:00.000Z']]);
});
test('commercial timeline lists fridge removal separately from final mixing',()=>{
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(chart.default,{eatTime:new Date('2026-09-25T18:00Z'),prefermentType:'poolish',kitchenTemp:24,mixOffsetH:24,prefOffsetH:12,blocks:[],onMixChange:()=>{},onPrefChange:()=>{},prefInFridge:true,prefermentFridgeOutTime:new Date('2026-09-24T16:00Z')})));
 assert.ok(html.includes('Take poolish out of the fridge'));
 assert.ok(html.includes('Mix the dough'));
 assert.ok(!html.includes('vitality'));
});
