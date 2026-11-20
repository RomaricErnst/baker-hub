const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
// 20 Nov 2026 retention round 6 (flow): shared oven, picks, shopping, spoons, one name per bake, rate rows, due line.
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.endsWith('/auditedPizzaRecipes') ? path.join(__dirname,'../app/lib/auditedPizzaRecipes.ts') : request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.ts']=require.extensions['.tsx'];
const {sharedOvenFor,ovenBackTitle}=require('../app/utils/sharedOven.ts');
const {scalePicks,allPicksBaked}=require('../app/utils/pizzaPicks.ts');
const {bakeTitleName}=require('../app/utils/bakeTitle.ts');
const {buildShoppingList}=require('../app/components/ToppingSelector.tsx');
const J=require('../app/lib/localJournal.ts');
const m=60000,h=3600000;

test('B1 shared oven: the second bake brings the oven back after the first, at the time it comes out',()=>{
 const d=(hh,mm)=>Date.UTC(2026,10,22,hh-1,mm);// Paris
 const campagne={id:'c',from:d(8,30),to:d(10,0),ovenType:'dutch_oven',subject:'Le pain de campagne'};
 // Baguettes at 10:00: their 45 min preheat would start at 9:15, while the campagne is in.
 const shared=sharedOvenFor({preheatAt:d(9,15),bakeAt:d(10,0),ovenType:'home_oven_stone_bread'},[campagne],true);
 assert.deepEqual(shared,{at:d(10,0),after:'le pain de campagne'});
 assert.equal(ovenBackTitle(true,shared.after,{celsius:250}),'Remettre le four à 250 °C après le pain de campagne');
 assert.equal(ovenBackTitle(false,'the campagne',{celsius:250}),'Bring the oven back to 250°C after the campagne');
 assert.equal(ovenBackTitle(false,'the pizzas',{max:true}),'Bring the oven back to its maximum after the pizzas');
 // Out before the preheat would start, another oven, or a later bake still in: a normal preheat.
 assert.equal(sharedOvenFor({preheatAt:d(10,30),bakeAt:d(11,15),ovenType:'home_oven_stone_bread'},[campagne],false),null);
 assert.equal(sharedOvenFor({preheatAt:d(9,15),bakeAt:d(10,0),ovenType:'pizza_oven'},[campagne],false),null);
 assert.equal(sharedOvenFor({preheatAt:d(9,15),bakeAt:d(9,45),ovenType:'dutch_oven'},[campagne],false),null);
 assert.equal(sharedOvenFor({preheatAt:d(9,15),bakeAt:d(10,0),ovenType:'dutch_oven'},[],false),null,'one bake: nothing');
});

test('A8 Bake again with fewer pizzas: the picks scale, each keeping its share; never up',()=>{
 assert.deepEqual(scalePicks({margherita:3,diavola:2,funghi:1},4),{margherita:2,diavola:1,funghi:1});
 assert.deepEqual(scalePicks({margherita:3,diavola:2,funghi:1},2),{margherita:1,diavola:1});
 const same={margherita:2};assert.equal(scalePicks(same,4),same);
 assert.equal(Object.values(scalePicks({a:5,b:5,c:5},7)).reduce((x,y)=>x+y,0),7);
});

test('A9 every chosen pizza baked is the bake done',()=>{
 assert.ok(allPicksBaked({margherita:2,pepperoni:1},{margherita:2,pepperoni:1}));
 assert.ok(!allPicksBaked({margherita:2,pepperoni:1},{margherita:2}));
 assert.ok(!allPicksBaked({},{}));
});

test('A11 one tomato line and one olive-oil line',()=>{
 const items=buildShoppingList({margherita:2,pepperoni:1},'en','neapolitan').sections.flatMap(s=>s.items);
 const tomatoes=items.filter(i=>['san_marzano','marinara_sauce','tomato_sauce_cooked'].includes(i.id));
 assert.equal(tomatoes.length,1);assert.equal(tomatoes[0].totalAmount,240);assert.match(tomatoes[0].qtyNote,/cooked sauce/);
 const four=buildShoppingList({margherita:3,quattro_formaggi:1},'fr','neapolitan').sections.flatMap(s=>s.items);
 const oils=four.filter(i=>['evo_oil','evo_oil_finish','olio_base','evo_oil_base'].includes(i.id));
 assert.equal(oils.length,1);assert.equal(oils[0].totalAmount,30);assert.equal(oils[0].unit,'ml');assert.match(oils[0].qtyNote,/filets pour finir/);
});

test('A6 one name per bake: the Recipe\'s automatic title',()=>{
 assert.equal(bakeTitleName('pizza','neapolitan',6,19,false,'Neapolitan'),'Pizza night');
 assert.equal(bakeTitleName('pizza','neapolitan',6,12,true,'Napolitaine'),'Déjeuner pizza');
 assert.equal(bakeTitleName('bread','baguette',2,10,false,'Baguette'),'Baguettes');
});

function storage(){const values=new Map();return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};}
beforeEach(()=>{global.localStorage=storage();});
const bake=over=>({bakeType:'bread',styleKey:'baguette',bakeName:'',numItems:2,itemWeight:320,kitchenTemp:20,recipeGenerated:true,tab:'simple',...over});
const plan=(id,locale,steps)=>localStorage.setItem('bh_guide_done_v2:'+JSON.stringify({bake:id})+':plan',JSON.stringify({locale,steps}));

test('A7 a baked, unrated bake stays as a row to rate, after the bakes under way; rated, it goes',()=>{
 const t0=Date.UTC(2026,10,22,18,30);// Sun 19:30 Paris
 const campagne=J.recordGeneratedBake(bake({styleKey:'pain_campagne',numItems:1,eatTime:t0-10.25*h}),1).entry;J.forgetCurrentJournalBake();
 const later=J.recordGeneratedBake(bake({eatTime:t0+24*h}),2).entry;J.forgetCurrentJournalBake();
 plan(campagne.id,'fr',[{step:1,at:t0-14*h,action:true,done:true,title:'Pétrir la pâte'},{step:2,at:t0-10.25*h,action:false,done:true,phase:'cooking',title:'Cuire le pain'}]);
 let rows=J.liveJournalBakes(t0,'fr');
 assert.deepEqual(rows.map(r=>[r.entry.id,!!r.rate]),[[later.id,false],[campagne.id,true]]);
 // All ticked at 10:00, an hour after its bake time: rate, never a stale "Cuisson et dégustation".
 rows=J.liveJournalBakes(t0-8.5*h,'fr');
 assert.ok(rows.find(r=>r.entry.id===campagne.id).rate);
 J.updateJournalEntry(campagne.id,{rating:4});
 assert.ok(!J.liveJournalBakes(t0,'fr').some(r=>r.entry.id===campagne.id));
});

test('D1 the home card names the step the bar names, from the first step until the bake is over',()=>{
 const T=Date.UTC(2026,10,20,10);// Maya: Start Dough Fri 6:00pm SGT
 const e=J.recordGeneratedBake(bake({bakeType:'pizza',styleKey:'neapolitan',eatTime:T+25.5*h}),1).entry;
 plan(e.id,'en',[
  {step:1,at:T,action:true,done:false,phase:'preparation',title:'Start Dough'},
  {step:2,at:T+45*m,action:false,done:false,phase:'preparation',title:'Let the dough rise'},
  {step:3,at:T+75*m,action:true,done:false,phase:'preparation',title:'Refrigerate the dough'},
  {step:4,at:T+23.25*h,action:true,done:false,phase:'preparation',title:'Take the dough out of the fridge'},
  {step:5,at:T+24.75*h,action:true,done:false,phase:'cooking',title:'Preheat the oven'},
 ]);
 assert.equal(J.journalDueStep(e.id,'en',T+25.5*h,T-2*h),null,'before the first step: the dated line');
 assert.deepEqual(J.journalDueStep(e.id,'en',T+25.5*h,T+20*m),{kind:'now',title:'Start Dough',at:T});
 assert.deepEqual(J.journalDueStep(e.id,'en',T+25.5*h,T+16*h),{kind:'next',title:'Take the dough out of the fridge',at:T+23.25*h});
 assert.equal(J.journalDueStep(e.id,'en',T+25.5*h,T+29*h),null,'after the bake: the dated line');
});
