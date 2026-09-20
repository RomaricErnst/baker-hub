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
