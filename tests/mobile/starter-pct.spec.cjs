const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// A baker-chosen starter % re-times the levain room-temperature bulk; the
// fridge-kept starter is refreshed before mixing, so the dough side follows
// the starter amount at kitchen temperature.
test.use({timezoneId:'Asia/Singapore'});
const H=3600000,NOW=Date.parse('2026-10-03T09:00:00+08:00'),BAKE=Date.parse('2026-10-05T10:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
for(const location of ['fridge','rt'])test(`${location} starter: a chosen starter % reaches the plan and keeps the bake time`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'bread',styleKey:'pain_levain',numItems:1,itemWeight:800,ovenType:'standard_bread',mixerType:'hand',yeastType:'sourdough',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'levain',prefermentChosen:true,startTime:NOW+8*H,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,customKitchenConfirmed:true,
  planningMode:'last_fed',lastFedTime:NOW-(location==='fridge'?72:20)*H,lastFedAge:location==='fridge'?'days23':'yesterday',starterLocation:location,lastFeedRatio:2,nextFeedRatio:2,ratioMode:'keep',
  activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('starter-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('starter-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 const plan=page.getByRole('region',{name:'Your key times',exact:true});
 // Accept the planner's nearest fitting bake time when the seeded one clashes.
 const preset=page.locator('#step-9 .bh-target-presets button').first();
 await expect(plan.or(preset)).toBeVisible();
 if(!await plan.isVisible())await preset.tap();
 await expect(plan).toBeVisible();
 const bake=(await stored(page)).eatTime;
 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:'Previous step',exact:true}).tap();
 const fineTune=page.locator('#step-10:visible');
 const starter=fineTune.locator('[data-starter-override] input');
 await expect(starter).toBeVisible();
 expect(Number(await starter.inputValue())).toBeGreaterThanOrEqual(15);
 await starter.fill('10');await starter.blur();
 await expect.poll(async()=>(await stored(page)).starterPctOverride).toBe(10);
 await fineTune.locator('[data-bh-forward]').tap();
 await expect(plan).toBeVisible();
 // The bulk arithmetic is covered by tests/starter-pct.test.cjs; here the
 // edit must reach the scheduler and leave a valid, unchanged-bake plan.
 await expect.poll(async()=>await plan.locator('[data-key-timing="mix"]').getAttribute('data-candidate-valid'),{timeout:15000}).toBe('true');
 expect((await stored(page)).eatTime).toBe(bake);
 expect(errors).toEqual([]);
});
