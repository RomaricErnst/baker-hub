const test=require('node:test'),a=require('node:assert/strict');const {utils}=require('./load-production.cjs');const {mixingBatchPlan}=require('../app/utils/mixingBatches.ts');
function make(style,weight=1000,yeast='instant',pref='none'){const schedule=utils.buildSchedule(new Date('2026-09-21T08:00Z'),new Date('2026-09-22T18:00Z'),[],24,60,'stand',style);return utils.calculateRecipe(style,'standard_bread',1,weight,24,'normal',schedule,4,yeast,'custom','stand',undefined,undefined,undefined,undefined,pref);}
test('published enrichment ratios scale with requested mass and preserve actual added water',()=>{
 for(const style of ['brioche','pain_viennois'])for(const weight of [250,1000,4000])for(const yeast of ['instant','active_dry','fresh']){
 const r=make(style,weight,yeast),e=r.enrichment;a.ok(e);a.equal(r.oil,0);a.equal(r.thermal,undefined);a.ok(!e.unsupportedMethod);
 const mass=r.flour+r.water+r.salt+r.sugar+e.milk+e.eggs+e.butter+r.yeast.convertedGrams;a.ok(Math.abs(mass-weight)<=4,`${style}/${weight}: ${mass}`);
 a.ok(Math.abs(e.butter/r.flour-(style==='brioche'?.5:.08))<.006);
 a.equal(r.water,style==='brioche'?Math.round(r.flour*.09):0);
 a.ok(Math.abs(e.waterEquivalent-(r.water+e.milk*.87+e.eggs*.75+e.butter*.16))<1e-9);
 const parts=[0,1,2].map(n=>mixingBatchPlan(r,'stand',3,n).portion);for(const k of ['milk','eggs','butter'])a.equal(parts.reduce((s,p)=>s+p[k],0),e[k]);
 }
});
test('unsupported saved methods are explicitly flagged, not represented as sourced variants',()=>{for(const style of ['brioche','pain_viennois']){a.equal(make(style,1000,'sourdough').enrichment.unsupportedMethod,true);a.equal(make(style,1000,'instant','poolish').enrichment.unsupportedMethod,true);}});
test('oil-based sandwich loaf remains unchanged and has no new enrichment',()=>{const r=make('pain_mie');a.equal(r.enrichment,undefined);a.ok(r.oil>0);});
