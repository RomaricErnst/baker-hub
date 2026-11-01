const test=require('node:test'),a=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
test('dilution aliquot contains final selected yeast dose and conserves stock water',()=>{
 for(const dose of [.004,.07,.448,.499]){const p=utils.commercialDilution(dose,100);a.ok(p);a.ok(Math.abs(p.solutionG/101-dose)<1e-12);a.ok(Math.abs(p.solutionG-dose-dose*100)<1e-12);}
 a.equal(utils.commercialDilution(.5),null);a.equal(utils.commercialDilution(.4,20),null);
});
test('added warm exposure cannot raise dose across the former four-hour boundary',()=>{
 for(const temp of [18,24,32,35,38])for(const fridge of [4,6])for(const cold of [12,24,48]){
  let previous=Infinity;
  for(const hours of [0,.5,1,2,3,3.9,3.99,4,4.01,4.1,5,8,12]){
   const r=utils.recommendYeast(hours,temp,cold,fridge,'instant',1000,null,'neapolitan');
   a.ok(r.pct<=previous+1e-8,`${temp}/${fridge}/${cold}/${hours}: ${r.pct}>${previous}`);previous=r.pct;
  }
  const left=utils.recommendYeast(3.999,temp,cold,fridge,'instant',1000,null).pct;
  const right=utils.recommendYeast(4.001,temp,cold,fridge,'instant',1000,null).pct;
  a.ok(Math.abs(left-right)<=.0002);
 }
});
test('recipe dilution follows the final dose after sugar and flour corrections',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-12T10:00:00Z'),new Date('2026-09-13T18:00:00Z'),[],32,60,'hand','brioche');
 for(const yeast of ['instant','active_dry','fresh']){
 const r=utils.calculateRecipe('brioche','standard_bread',1,250,32,'humid',schedule,6,yeast,'custom','hand');
 a.deepEqual(r.yeast.dilutionTip,utils.commercialDilution(r.yeast.convertedGrams,r.water));
 }
});
test('both languages state aliquot-only water subtraction and UI supplies the final values',()=>{
 const fs=require('node:fs');
 for(const lang of ['en','fr']){const text=JSON.parse(fs.readFileSync(`messages/${lang}.json`)).recipeOutput.dilutionBody;for(const key of ['waterG','solutionG','waterInSolutionG','remainingWaterG'])a.ok(text.includes(`{${key}}`));a.ok(lang==='en'?text.includes('Discard the unused mixture'):text.includes('Jetez le mélange inutilisé'));}
 const p=utils.commercialDilution(.07,150);a.ok(Math.abs(p.waterInSolutionGrams-7)<1e-10);a.ok(Math.abs(p.remainingWaterGrams+ p.waterInSolutionGrams-150)<1e-10);
});
test('a sweet dough notice never adds an uncalibrated yeast jump',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-21T08:00Z'),new Date('2026-09-21T15:00Z'),[],24,60,'hand','pan');
 const make=sugar=>utils.calculateRecipe('pan','home_oven_standard',1,1000,24,'normal',schedule,4,'instant','custom','hand',70,0,sugar,undefined,'none',null);
 a.equal(make(2.01).yeast.pct,make(2).yeast.pct);
 a.equal(make(5.01).yeast.pct,make(5).yeast.pct);
 a.equal(make(5).yeast.osmoticStress,false);
 a.equal(make(5.01).yeast.osmoticStress,true);
});
test('adding refrigerated exposure lowers the mixed dose across the climate grid',()=>{
 for(const temp of [16,22,27,32,35])for(const fridge of [4,6,8])for(const warm of [2,4,6,8,12]){
  let previous=Infinity;
  for(const cold of [0,.25,1,2,3,6,12,18,24,36,48,72]){
   const p=utils.recommendYeast(warm,temp,cold,fridge,'instant',600,null).pct;
   a.ok(p<=previous,`${temp}/${fridge}/${warm}/${cold}`); previous=p;
   if(p>.05&&p<1.5){
    const warmRate=(2.5**((temp-25)/10))*(temp>=33?1.25:temp>=30?1.15:1)/9.5;
    const used=warm*(p*warmRate)**(1/1.65)+cold*(p*2**((fridge-4)/10)/7.5)**(1/1.313);
    a.ok(Math.abs(used-1)<.002);
   }
  }
 }
});
test('automatic speed/flavour labels do not introduce dose cliffs into the recipe',()=>{
 const start=new Date('2026-09-21T08:00Z');
 const dose=hours=>{
  const plan=utils.buildSchedule(start,new Date(+start+hours*3600000),[],22,45,'stand','neapolitan',4);
  return utils.calculateRecipe('neapolitan','home_oven_standard',4,260,22,'normal',plan,6,'instant','simple','stand').yeast.pct;
 };
 a.ok(dose(8)<.5);a.ok(dose(25)/dose(24)>.92);
 a.ok(dose(7)/dose(6.5)>.80);
});
test('cold poolish with explicit large flour share and small free water gets a real warm-up',()=>{
 const p={prefermentType:'poolish',prefInFridge:true,styleKey:'neapolitan',kitchenTemp:22,fridgeTemp:6,doughMassG:1040,hydrationPct:62};
 a.equal(utils.requiredPrefWarmupH({...p,prefermentFlourPct:20}),0);
 a.ok(utils.requiredPrefWarmupH({...p,prefermentFlourPct:50})>=1.5);
});
test('native lean sourdough plans protect the style bulk before refrigerating',()=>{
 for(const style of ['sourdough','pain_levain']){
  const s=utils.buildSchedule(new Date('2026-09-21T08:00Z'),new Date('2026-09-22T16:00Z'),[],22,45,'stand',style,1);
  a.ok(s.bulkFermHours>=4.75 && s.bulkFermHours<=5.25);
 }
});
