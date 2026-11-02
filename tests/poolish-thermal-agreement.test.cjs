const test = require('node:test');
const assert = require('node:assert/strict');
const {utils} = require('./load-production.cjs');

test('timeline poolish removal predicts the same mixing water as the recipe', () => {
  const start = new Date('2030-01-01T12:00:00Z');
  const bake = new Date(+start + 24 * 3600000);
  for (const mixerType of ['hand', 'stand', 'spiral']) {
    for (let kitchenTemp = 18; kitchenTemp <= 33; kitchenTemp++) {
      const schedule = utils.buildSchedule(start, bake, [], kitchenTemp, 45, mixerType, 'neapolitan', 4);
      for (const prefermentFlourPct of [20, 30, 40, 50]) {
        for (const targetDoughTemp of [21, 24, 27]) {
          const args = {mixerType, kitchenTemp, prefermentFlourPct, targetDoughTemp, styleKey:'neapolitan',
            prefermentType:'poolish', prefInFridge:true, fridgeTemp:6, doughMassG:1040, hydrationPct:62};
          const hours = utils.requiredPrefWarmupH(args);
          const recipe = utils.calculateRecipe('neapolitan','home_oven_standard',4,260,kitchenTemp,'normal',
            schedule,6,'instant','custom',mixerType,62,undefined,undefined,undefined,'poolish',null,
            prefermentFlourPct,undefined,targetDoughTemp,false,0,true);
          const {prefFlour, prefWater} = recipe.preferment;
          const poolishTemp = utils.prefTempAfterWarmup(prefFlour + prefWater,100,6,kitchenTemp,hours);
          const predicted = utils.solveWaterTempEnthalpy({targetFDT:targetDoughTemp,kitchenTemp,flourTemp:kitchenTemp,
            friction:utils.mixerFrictionRiseC(mixerType), flourG:recipe.flour, waterG:recipe.water, saltG:recipe.salt,
            prefFlourG:prefFlour, prefWaterG:prefWater, prefTempC:poolishTemp});
          assert.equal(predicted.idealWaterTemp,recipe.thermal.idealWaterTemp);
          assert.ok(Math.abs(recipe.thermal.doughTempResidualC)<=1 || recipe.thermal.waterWasClamped);
        }
      }
    }
  }
});
