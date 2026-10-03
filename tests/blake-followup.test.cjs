const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const {utils,data}=require('./load-production.cjs');
const {assessScheduleDraft}=require('../app/utils/scheduleDraft.ts');
const {normalizeFlourTarget,saveSession,loadSession}=require('../app/lib/session.ts');
const start=new Date('2030-06-01T08:00:00Z'),bake=new Date('2030-06-02T18:00:00Z');
function recipe(style,hydration,yeast='instant',pref='none'){
 const schedule=utils.buildSchedule(start,bake,[],22,45,'hand',style,2);
 return utils.calculateRecipe(style,'standard_bread',2,500,22,'normal',schedule,5,yeast,'custom','hand',hydration,undefined,undefined,undefined,pref,undefined,20,undefined,undefined,false,10,false,undefined,undefined,undefined,undefined,500);
}
test('flour-first is fixed across hydration, piece weight and enriched formulas',()=>{
 for(const style of ['baguette','pain_levain','brioche','pain_viennois','pain_mie']){
  const low=recipe(style,65),high=recipe(style,80);
  a.equal(low.flour,500,style);a.equal(high.flour,500,style);
  const mass=r=>r.flour+r.water+r.salt+r.oil+r.sugar+(r.enrichment?.milk??0)+(r.enrichment?.eggs??0)+(r.enrichment?.butter??0)+(r.yeast?.convertedGrams??0);
  a.ok(Math.abs(mass(low)-low.totalDough)<3,style);
  if(!low.enrichment)a.ok(high.totalDough>low.totalDough,style);
 }
});
test('flour-first counts levain and poolish flour inside the target',()=>{
 const sour=recipe('pain_levain',75,'sourdough','levain');
 a.equal(sour.flour,500);a.ok(sour.sourdough);
 const pool=recipe('baguette',70,'instant','poolish');
 a.equal(pool.flour,500);a.equal(pool.preferment.prefFlour+pool.preferment.finalFlour,500);
});
test('flour target is optional, validated and retained in local snapshots',()=>{
 a.equal(normalizeFlourTarget('500'),undefined);a.equal(normalizeFlourTarget(Infinity),undefined);
 a.equal(normalizeFlourTarget(500),500);
 const values={};global.localStorage={getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=v,removeItem:k=>delete values[k]};
 a.equal(saveSession({bakeType:'bread',totalFlourTarget:500}),true);a.equal(loadSession().totalFlourTarget,500);
});
test('pre-mix autolyse reserves work before the levain anchor and respects unavailable time',()=>{
 a.equal(data.preMixAutolyseMinFor('hand','pain_levain'),30);
 a.equal(data.preMixAutolyseMinFor('hand','pain_seigle'),0);
 a.equal(data.preMixAutolyseMinFor('no_knead','pain_levain'),0);
 const schedule=utils.buildSchedule(start,bake,[],22,45,'hand','pain_levain',1);
 const action=schedule.availabilityActions.find(x=>x.id==='autolyse');
 a.equal(+action.at,+start-32*60000);a.equal(+action.end,+start-30*60000);
 a.equal(+schedule.availabilityActions.find(x=>x.id==='mix').at,+start);
 const input={start,bake,from:new Date(+start-3600000),to:new Date(+start+3600000),kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'pain_levain',numItems:1,methodValid:true,now:+start-86400000};
 const blocked=assessScheduleDraft({...input,blocks:[{from:action.at,to:action.end,label:'Call'}]});
 a.equal(blocked.valid,false);a.equal(blocked.conflict.id,'autolyse');
 a.equal(assessScheduleDraft({...input,blocks:[],now:+start-15*60000}).valid,false);
});
test('multiple autolyse batches are prepared once before the first mixing anchor',()=>{
 const schedule=utils.buildSchedule(start,bake,[],22,45,'hand','pain_levain',2,2);
 const actions=schedule.availabilityActions.filter(x=>x.id==='autolyse');
 a.equal(actions.length,1);a.equal(+actions[0].at,+start-34*60000);a.equal(+actions[0].end,+start-30*60000);
 a.equal(+schedule.availabilityActions.find(x=>x.id==='mix').at,+start);
 a.equal(schedule.batchMixWindows.length,2);
});
test('changing bake family clears the bread flour target only after confirmation',async()=>{
 const ts=require('typescript'),vm=require('node:vm');
 const source=fs.readFileSync('app/[locale]/page.tsx','utf8'),tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let handler;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='selectBakeType')handler=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);
 const cleared=new Error('target-cleared');let value=750,allow=false;
 const context={bakeType:'bread',styleKey:'brioche',hasWorkInProgress:true,fr:true,window:{confirm:()=>allow},createSandwichSnapshot:()=>({})};
 for(const name of new Set(handler.match(/\bset[A-Z]\w+/g)))context[name]=()=>{};
 context.setTotalFlourTarget=v=>{value=v;throw cleared;};
 vm.createContext(context);vm.runInContext(ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 await context.selectBakeType('pizza');a.equal(value,750);
 await context.selectBakeType('bread');a.equal(value,750);
 allow=true;await a.rejects(()=>context.selectBakeType('pizza'),error=>error===cleared);a.equal(value,undefined);
});
test('French rye references have actual local product pictures and no invented W',()=>{
 const catalogue=require('../lib/flourCatalogue.json'),provenance=require('../lib/flourPhotoProvenance.json');
 for(const id of ['celnat_seigle_t130','foricher_seigle_t130','foricher_seigle_t170']){
  const f=catalogue.find(f=>f.id===id);a.equal(f.type,'rye');a.equal(f.country,'fr');a.equal(f.w,null);a.equal(f.hydration,null);
  a.ok(fs.statSync('public'+f.bagImage).size>1000);a.ok(provenance[id].remoteUrl);a.ok(f.verification.source);
 }
});
