const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.endsWith('/auditedPizzaRecipes')?path.join(__dirname,'../app/lib/auditedPizzaRecipes.ts'):request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
const load=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.ts']=load;require.extensions['.tsx']=load;
require.extensions['.css']=module=>{module.exports=new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});};
const {PIZZAS,DESSERT_PIZZAS}=require('../app/lib/toppingDatabase.ts');
const pizzas=[...PIZZAS,...DESSERT_PIZZAS];
const {SANDWICH_RECIPES,partitionSandwichSteps}=require('../app/lib/sandwichCatalog.ts');
const {effectiveSandwichSteps,aggregateSandwichShopping,createSandwichSnapshot}=require('../app/lib/sandwich.ts');
const styles=['neapolitan','sourdough','pizza_romana','roman','newyork','pan'];

test('all materialized pizza ingredients have usable bilingual quantities and bake order for every style',()=>{
 assert.equal(new Set(pizzas.map(p=>p.id)).size,pizzas.length);
 for(const p of pizzas)for(const style of styles)for(const i of p.ingredients){
  assert.ok(i.name.en&&i.name.fr,`${p.id}/${i.id}`);
  assert.ok(['before','after'].includes(i.bakeOrderByStyle?.[style]??i.bakeOrder),`${p.id}/${i.id}/${style}`);
  assert.ok(i.qtyPerPizza&&Number.isFinite(i.qtyPerPizza.amount)&&i.qtyPerPizza.amount>0,`${p.id}/${i.id} quantity`);
  for(const quantity of [1,4,12])assert.ok(Number.isFinite(i.qtyPerPizza.amount*(i.qtyMultiplierByStyle?.[style]??1)*quantity),`${p.id}/${i.id} scale`);
 }
});

test('all sausage and uncooked egg variants retain safe preparation across style overrides',()=>{
 for(const p of pizzas)for(const i of p.ingredients)for(const style of styles){
  const note=i.prepNoteByStyle?.[style]??i.prepNote;
  if(['salsiccia','italian_sausage','ground_beef'].includes(i.id)){
   assert.match(note.en,/71\s*°C/,`${p.id}/${i.id}/${style}`);
   assert.match(note.fr,/71\s*°C/,`${p.id}/${i.id}/${style}`);
   assert.doesNotMatch(note.en,/Only a 450|raw.*traditional/);
  }
  if(['egg','whole_egg','poached_egg'].includes(i.id)){
   assert.equal(i.bakeOrderByStyle?.[style]??i.bakeOrder,'after',p.id);
   assert.match(note.en,/pasteuri[sz]ed/i,p.id);assert.match(note.fr,/pasteuris/i,p.id);
   assert.match(note.en,/white and yolk.*firm|white.*yolk.*firm/i,p.id);
  }
  if(i.id==='speck')assert.equal(i.bakeOrderByStyle?.[style]??i.bakeOrder,'after',p.id);
  if(i.id==='foie_gras')assert.match(i.prepNote.en,/not raw/i,p.id);
 }
});

test('every sandwich default and single-ingredient removal keeps unique valid ordered steps and scaled shopping',()=>{
 for(const r of SANDWICH_RECIPES){
  for(const overrides of [{},...r.ingredients.map(i=>({[i.ingredientId]:0}))]){
   const steps=effectiveSandwichSteps(r,overrides);
   assert.equal(new Set(steps.map(s=>s.id)).size,steps.length,r.id);
   assert.ok(steps.every(s=>s.title.fr&&s.title.en&&s.instruction.fr&&s.instruction.en&&Number.isFinite(s.minutes)&&s.minutes>=0),r.id);
   for(const defer of [true,false]){
    const split=partitionSandwichSteps(steps,defer);
    assert.deepEqual([...split.prep,...split.serve],steps,`${r.id}/${defer}`);
    assert.ok(split.prep.every(s=>s.phase!=='assemble'),r.id);
    if(defer)assert.ok(split.prep.every(s=>!/-bread$|-toast$/.test(s.id)),r.id);
    assert.ok(split.serve.length>0,r.id);
   }
   const one=aggregateSandwichShopping({[r.id]:1},{[r.id]:overrides},r.familyId);
   const four=aggregateSandwichShopping({[r.id]:4},{[r.id]:overrides},r.familyId);
   assert.deepEqual(four.map(i=>i.ingredientId),one.map(i=>i.ingredientId));
   one.forEach((i,j)=>assert.ok(Math.abs(four[j].grams-i.grams*4)<.11,r.id));
  }
 }
});

test('pan bagnat chilling and panuozzo final oven finish occur after assembly in service',()=>{
 for(const r of SANDWICH_RECIPES.filter(r=>['panuozzo','pan_bagnat'].includes(r.familyId))){
  for(const defer of [true,false]){
   const split=partitionSandwichSteps(effectiveSandwichSteps(r),defer);
   const assembly=split.serve.findIndex(s=>s.id===`${r.id}-assemble`);
   const finish=split.serve.findIndex(s=>s.id===`${r.id}-${r.familyId==='panuozzo'?'finish':'rest'}`);
   assert.ok(assembly>=0&&finish>assembly,r.id);
   assert.ok(split.serve.some(s=>/74|4\s*°C/.test(s.instruction.en)),r.id);
  }
 }
});

test('rendered homemade-bread prep defers toast, final bake and assembled sandwich chilling',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const SandwichParty=require('../app/components/SandwichParty.tsx').default;
 for(const id of ['bagel-saumon-cream-cheese','panuozzo-pancetta-mozza','pan_bagnat-nicois','tartine-avocat-oeuf']){
  const r=SANDWICH_RECIPES.find(r=>r.id===id);
  const snapshot={...createSandwichSnapshot(r.familyId),qtys:{[id]:1}};
  const props={isFr:false,styleKey:r.familyId==='tartine'?'pain_campagne':r.familyId,snapshot,onChange(){}};
  const prep=renderToStaticMarkup(React.createElement(SandwichParty,{...props,phase:'prep'}));
  const serve=renderToStaticMarkup(React.createElement(SandwichParty,{...props,phase:'serve'}));
  const split=partitionSandwichSteps(effectiveSandwichSteps(r),true);
  for(const step of split.serve){
   const title=step.title.en.replace(/&/g,'&amp;').replace(/'/g,'&#x27;');
   assert.ok(!prep.includes(`<strong>${title}</strong>`),`${id} ${title} wrongly in prep`);
   assert.ok(serve.includes(`<strong>${title}</strong>`),`${id} ${title} missing from service`);
  }
 }
});

test('custom pizza catalog references retain safe sausage and egg preparation with chosen quantities',()=>{
 const {getCustomPizzaList}=require('../app/lib/toppingDatabase.ts');
 const oldWindow=global.window,oldStorage=global.localStorage;
 try{
  global.window={};global.localStorage={getItem:()=>JSON.stringify({version:1,customPizzas:[{id:'custom_safe',name:'My pizza',createdAt:1,ovenTemp:'high',ingredients:[{refId:'salsiccia',nameEn:'Sausage',nameFr:'Saucisse',category:'meat',bakeOrder:'before',amount:90,unit:'g'},{refId:'egg',nameEn:'Egg',nameFr:'Œuf',category:'base',bakeOrder:'before',amount:2,unit:'pcs'}]}]})};
  const p=getCustomPizzaList()[0];
  assert.equal(p.ingredients[0].qtyPerPizza.amount,90);assert.match(p.ingredients[0].prepNote.en,/71°C/);
  assert.equal(p.ingredients[1].qtyPerPizza.amount,2);assert.match(p.ingredients[1].prepNote.en,/pasteurised/);assert.equal(p.ingredients[1].bakeOrder,'after');
 }finally{global.window=oldWindow;global.localStorage=oldStorage;}
});

test('pizza prep keeps distinct sauce instructions when the same ingredient is shared',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const PrepTab=require('../app/components/pizzaParty/PrepTab.tsx').default;
 const matches=pizzas.filter(p=>p.ingredients.some(i=>i.id==='coconut_milk'));
 assert.ok(matches.length>=2);
 const notes=[...new Set(matches.flatMap(p=>p.ingredients.filter(i=>i.id==='coconut_milk').map(i=>i.prepNote.en)))];
 const html=renderToStaticMarkup(React.createElement(PrepTab,{locale:'en',selectedPizzas:Object.fromEntries(matches.map(p=>[p.id,1])),bakeTime:new Date(),onGoToBake(){},onGoToShopping(){},onGoToPizzas(){}}));
 for(const note of notes)assert.ok(html.includes(note),note);
});

test('chicken wraps offer home cooking and ready-cooked alternatives without imposing either in the dish name',()=>{
 for(const r of SANDWICH_RECIPES.filter(r=>['pita','laffa','piadina','greek_pita','kebab_bread'].includes(r.familyId)&&r.ingredients.some(i=>i.ingredientId==='chicken'))){
  assert.doesNotMatch(r.name.fr,/déjà cuit/i,r.id);assert.doesNotMatch(r.name.en,/already cooked/i,r.id);
  const steps=effectiveSandwichSteps(r);
  assert.ok(steps.some(s=>s.title.fr==='Cuire le poulet'&&s.title.en==='Cook the chicken'),r.id);
  const instructions=steps.map(s=>s.instruction.en).join(' ');
  assert.match(instructions,/raw chicken/i,r.id);assert.match(instructions,/already have cooked chicken/i,r.id);assert.match(instructions,/74°C/);assert.match(instructions,/cooked weight|cooked chicken weight/);
  assert.ok(!effectiveSandwichSteps(r,{chicken:0}).some(s=>/-chicken-option$|-heat$/.test(s.id)),r.id);
 }
});
