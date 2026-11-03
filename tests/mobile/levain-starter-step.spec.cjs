const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Custom levain: the starter is asked on its own step, before the bake time.
test.use({timezoneId:'Asia/Singapore'});
const H=3600000,NOW=Date.parse('2026-10-03T09:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test('starter questions sit on the Starter step and the bake-time step shows the plan only',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'bread',styleKey:'pain_levain',numItems:1,itemWeight:800,ovenType:'standard_bread',mixerType:'hand',yeastType:'sourdough',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'levain',prefermentChosen:true,eatTime:null,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,customKitchenConfirmed:true,
  planningMode:'last_fed',lastFedTime:null,lastFedAge:null,starterLocation:'rt',activeStep:7,advancedStep:8,highestStep:7,advancedHighestStep:8,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('levain-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('levain-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:8,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 const step=page.locator('#step-8:visible');
 await expect(step.locator('.bh-page-title')).toHaveText('Your starter');
 const card=step.locator('.bh-starter-controls');
 await expect(card).toBeVisible();
 await expect(step.locator('[data-bh-forward]')).toBeDisabled();
 await card.getByRole('button',{name:'Fridge',exact:true}).tap();
 await expect(card.getByText('WHEN WAS IT LAST FED BEFORE GOING IN THE FRIDGE?')).toBeVisible();
 await card.getByRole('button',{name:'2–3 days ago',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).lastFedAge).toBe('days23');
 await expect(step.locator('[data-bh-forward]')).toBeEnabled();
 await step.locator('[data-bh-forward]').tap();
 await expect(page.locator('#step-8:visible')).toHaveCount(0);
 expect((await stored(page)).starterLocation).toBe('fridge');
 expect(errors).toEqual([]);
});
