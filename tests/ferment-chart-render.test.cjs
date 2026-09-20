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
