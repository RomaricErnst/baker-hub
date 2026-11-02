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

test('room-temperature poolish can be chilled to reach the mixing target in a hot kitchen',()=>{
  const start=new Date('2030-01-01T12:00Z'),bake=new Date(+start+24*3600000);
  const {validateScheduleCandidate}=require('../app/utils/scheduleEdit.ts');
  const {poolishCoolingAt}=require('../app/utils/poolishCoolingAt.ts');
  let checked=0,cooled=0,atTarget=0,limited=0;
  for(const mixerType of ['hand','stand','spiral'])for(let kitchenTemp=28;kitchenTemp<=34;kitchenTemp++){
    for(const prefermentFlourPct of [20,30,40,50])for(const targetDoughTemp of [21,24,27]){
      const options={mixerType,kitchenTemp,prefermentFlourPct,targetDoughTemp,styleKey:'neapolitan',prefermentType:'poolish',
        prefInFridge:false,fridgeTemp:6,doughMassG:1040,hydrationPct:62};
      const hours=utils.requiredPrefCooldownH(options);
      const input={id:'mix',at:start,start,bake,styleKey:'neapolitan',kitchenTemp,preheatMin:45,mixerType,numItems:4,
        blocks:[],prefHours:8,prefWarmupHours:0,prefCooldownHours:hours,hasPreferment:true,supported:true,
        window:()=>({from:new Date(+bake-32*3600000),to:new Date(+bake-8*3600000)}),methodValid:()=>true,now:+start-24*3600000};
      const candidate=validateScheduleCandidate(input);
      assert.ok(candidate.valid,JSON.stringify({options,hours,issue:candidate.issue}));
      const recipe=utils.calculateRecipe('neapolitan','home_oven_standard',4,260,kitchenTemp,'normal',candidate.schedule,6,
        'instant','custom',mixerType,62,undefined,undefined,undefined,'poolish',null,prefermentFlourPct,undefined,targetDoughTemp,false,0,false);
      const {prefFlour,prefWater}=recipe.preferment;
      const temp=utils.prefTempAfterWarmup(prefFlour+prefWater,100,kitchenTemp,6,hours);
      const predict=prefTempC=>utils.solveWaterTempEnthalpy({targetFDT:targetDoughTemp,kitchenTemp,flourTemp:kitchenTemp,
        friction:utils.mixerFrictionRiseC(mixerType),flourG:recipe.flour,waterG:recipe.water,saltG:recipe.salt,
        prefFlourG:prefFlour,prefWaterG:prefWater,prefTempC});
      const predicted=predict(temp);
      assert.equal(predicted.idealWaterTemp,recipe.thermal.idealWaterTemp);
      assert.equal(predicted.doughTempC,recipe.thermal.doughTempC);
      assert.equal(recipe.thermal.prefermentCooldownHours,hours);
      assert.ok(hours>=0 && Number.isFinite(hours));
      if(hours>0){
        cooled++;assert.ok(predicted.doughTempC<=predict(kitchenTemp).doughTempC);
        const action=candidate.schedule.availabilityActions.find(a=>a.id==='preferment-cold-in');
        assert.equal(+action.at,+start-hours*3600000);
        assert.equal(+poolishCoolingAt(candidate.schedule,recipe),+action.at);
        const blocked=validateScheduleCandidate({...input,blocks:[{from:action.at,to:new Date(+action.at+60000),label:'Unavailable'}]});
        assert.equal(blocked.valid,false);assert.equal(blocked.conflict,'preferment-cold-in');
      }
      if(Math.abs(predicted.doughTempC-targetDoughTemp)<=1)atTarget++;
      else {
        limited++;
        assert.ok(recipe.thermal.waterWasClamped,JSON.stringify(options));
        assert.ok(Math.abs(predict(6).doughTempC-targetDoughTemp)>1,'A reachable target should not be reported as a physical limit');
      }
      checked++;
    }
  }
  const legacySchedule=utils.buildSchedule(start,bake,[],33,45,'stand','neapolitan',4);
  const legacy=utils.calculateRecipe('neapolitan','home_oven_standard',4,260,33,'normal',legacySchedule,6,
    'instant','custom','stand',62,undefined,undefined,undefined,'poolish',null,50,undefined,21,false,0,false);
  assert.equal(legacy.thermal.prefermentCooldownHours,0);
  assert.ok(legacy.thermal.waterWasClamped && legacy.thermal.doughTempResidualC>1);
  assert.equal(checked,252);assert.ok(cooled>0);console.log({checked,cooled,atTarget,limited});
});
