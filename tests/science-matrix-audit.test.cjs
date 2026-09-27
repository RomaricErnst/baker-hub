const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils,data}=require('./load-production.cjs');
const {getBreadProtocol}=require('../app/utils/breadProfiles.ts');
const start=new Date('2030-10-01T08:00:00Z');
const styles=Object.keys({...data.PIZZA_STYLES,...data.BREAD_STYLES});
// This matrix checks numerical/contract consistency, not experimentally measured maturity.
test('all 26 styles retain finite balanced recipes and explicit method gates across climate and duration',()=>{
 let cases=0;
 for(const style of styles)for(const temperature of [16,22,30,38])for(const fridge of [2,5,8])for(const hours of [.75,4,26,72])for(const method of ['none','poolish','biga','levain']){
  const protocol=getBreadProtocol(style);
  const oven=protocol?.equipment[0]||(data.PIZZA_STYLES[style]?'home_oven_standard':'standard_bread');
  const end=new Date(+start+hours*3600000);
  const schedule=utils.buildSchedule(start,end,[],temperature,oven==='griddle'?5:30,'hand',style,4);
  const recipe=utils.calculateRecipe(style,oven,4,250,temperature,'normal',schedule,fridge,method==='levain'?'sourdough':'instant','custom','hand',undefined,undefined,undefined,undefined,method,undefined,20,undefined,undefined,false,0,true,undefined,24);
  const label=`${style}/${temperature}/${fridge}/${hours}/${method}`;
  const ingredients=[recipe.flour,recipe.water,recipe.salt,recipe.oil,recipe.sugar,recipe.enrichment?.milk||0,recipe.enrichment?.eggs||0,recipe.enrichment?.butter||0,recipe.preferment?.prefYeastGrams??recipe.yeast?.convertedGrams??0];
  assert.ok(ingredients.every(value=>Number.isFinite(value)&&value>=0),label);
  assert.ok(Math.abs(ingredients.reduce((sum,value)=>sum+value,0)-1000)<=4,label+' mass');
  assert.equal(+schedule.bakeStart,+end,label+' oven time');
  assert.ok(schedule.totalRTHours>=0&&schedule.totalColdHours>=0,label+' nonnegative phases');
  if(protocol?.method==='unleavened'){
   assert.equal(recipe.yeast,null,label);assert.equal(recipe.sourdough,null,label);assert.equal(recipe.preferment,null,label);
  }else if(protocol&&!protocol.supportedPreferments.includes(method)){
   assert.ok(recipe.protocolIssue==='method'||recipe.protocolIssue==='timing',label+' unsupported gate');
  }else if(recipe.enrichment&&method!=='none'){
   assert.equal(recipe.enrichment.unsupportedMethod,true,label+' enriched gate');
  }else if(method==='levain'){
   assert.equal(recipe.yeast,null,label);assert.ok(recipe.sourdough,label);assert.equal(recipe.preferment,null,label);
  }else if(method!=='none'){
   assert.ok(recipe.preferment,label);assert.equal(recipe.preferment.prefFlour+recipe.preferment.finalFlour,recipe.flour,label);assert.equal(recipe.preferment.prefWater+recipe.preferment.finalWater,recipe.water,label);
  }
  cases++;
 }
 assert.equal(cases,4992);
});

test('all leavened styles account for real warm/cold elapsed time with and without overnight blocks',()=>{
 let cases=0;
 for(const style of styles.filter(key=>key!=='piadina'))for(const temperature of [16,22,30,38])for(const hours of [4,26,72])for(const blocked of [false,true]){
  const end=new Date(+start+hours*3600000);
  const blocks=blocked?[{from:new Date(+start+15*3600000),to:new Date(+start+23*3600000),label:'Night'}]:[];
  const s=utils.buildSchedule(start,end,blocks,temperature,30,'hand',style,4);
  const fermentationEnd=s.poachStart||s.bakeStart;
  const elapsed=Math.max(0,(+fermentationEnd-+s.bulkFermStart)/3600000);
  assert.ok(Math.abs(s.totalRTHours+s.totalColdHours-elapsed)<1e-9,`${style}/${temperature}/${hours}/${blocked}`);
  assert.ok(+s.finalProofStart<=+fermentationEnd,`${style}: proof after bake`);
  cases++;
 }
 assert.equal(cases,600);
});
