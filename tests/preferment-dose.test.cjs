const test = require('node:test');
const assert = require('node:assert/strict');
const { data } = require('./load-production.cjs');
const { formatPrefermentDose, prefermentDilution } = require('../app/utils/prefermentDose.ts');

test('small preferment doses remain nonzero and convert from unrounded IDY', () => {
  for (const type of ['poolish', 'biga']) {
    const args = [type, 100, 70, 32, 6, false, 10];
    const idy = data.computePrefermentRecipe(...args, 'instant', 14);
    assert.ok(idy.prefYeastGramsIDY > 0 && idy.prefYeastGramsIDY < 0.05);
    for (const [yeast, factor] of [['instant', 1], ['active_dry', 1.33], ['fresh', 3]]) {
      const result = data.computePrefermentRecipe(...args, yeast, 14);
      assert.ok(Math.abs(result.prefYeastGrams - idy.prefYeastGramsIDY * factor) < 1e-12);
      assert.notEqual(formatPrefermentDose(result.prefYeastGrams), '0 g');
    }
  }
});

test('dilution conserves selected yeast dose and preferment water', () => {
  for (const dose of [0.004, 0.04, 0.04 * 1.33, 0.04 * 3, 0.49]) {
    const plan = prefermentDilution(dose, 100);
    assert.ok(plan);
    assert.ok(Math.abs(plan.solutionGrams / 100 - dose) < 1e-12);
    assert.ok(Math.abs(plan.waterInSolutionGrams + plan.remainingWaterGrams - 100) < 1e-12);
  }
  assert.equal(prefermentDilution(0.4, 10), null);
  assert.equal(prefermentDilution(0, 100), null);
  assert.equal(prefermentDilution(0.5, 100), null);
  assert.equal(prefermentDilution(NaN, 100), null);
});

test('poolish and biga doses follow actual duration, storage temperature and yeast conversion',()=>{
 for(const type of ['poolish','biga']){
  const make=(hours,cold,temp=27,fridge=6)=>data.computePrefermentRecipe(type,1000,650,temp,fridge,cold,20,'instant',hours);
  const short=make(12,true),long=make(24,true);
  assert.ok(short.prefYeastGrams>long.prefYeastGrams);
  assert.ok(make(18,true,27,4).prefYeastGrams>make(18,true,27,6).prefYeastGrams);
  assert.equal(long.cold,true);assert.equal(long.fermentHoursMax,24);
 }
 const cold=data.computePrefermentRecipe('poolish',1000,650,27,6,true,20,'instant',19.5);
 const room=data.computePrefermentRecipe('poolish',1000,650,27,6,false,20,'instant',7);
 assert.notEqual(cold.prefYeastGrams,room.prefYeastGrams);
 assert.equal(cold.cold,true);assert.equal(cold.fermentHoursMin,19.5);
 assert.equal(room.cold,false);assert.equal(room.fermentHoursMin,7);
});

test('direct yeast responds to both warm and cold fermentation exposure',()=>{
 const {utils}=require('./load-production.cjs');
 const dose=(rt,cold,temp=27,fridge=6)=>utils.recommendYeast(rt,temp,cold,fridge,'instant',1000,null,'neapolitan').grams;
 assert.ok(dose(4,18)<dose(4,8));
 assert.ok(dose(6,8)<dose(4,8));
 assert.ok(dose(6,18)<=dose(4,18));
 assert.ok(dose(8,8,27)<dose(8,8,22));
 assert.ok(dose(4,18,27,6)<dose(4,18,27,4));
});
