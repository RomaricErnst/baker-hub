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

// Pizza with a levain preferment gets the same Starter step, before Bake time;
// Bake time never shows the starter questions behind a button that does nothing.
for(const locale of ['en','fr'])test(`pizza levain preferment: Starter step before the bake time (${locale})`,async({page})=>{
 const fr=locale==='fr';
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:8,itemWeight:270,ovenType:'pizza_oven',mixerType:'hand',yeastType:'sourdough',kitchenTemp:24,humidity:'normal',fridgeTemp:6,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},prefermentType:'levain',prefermentChosen:true,eatTime:NOW+58*H,startTime:NOW+8*H,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,customKitchenConfirmed:true,
  planningMode:'last_fed',lastFedTime:null,lastFedAge:null,starterLocation:'rt',activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('levain-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('levain-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 // Bake time without a described starter: no starter card, one way to the Starter step.
 const bake=page.locator('#step-9:visible');
 await expect(bake.locator('.bh-starter-controls')).toHaveCount(0);
 await expect(bake.getByText(fr?'Indiquez quand votre levain a été rafraîchi pour la dernière fois.':'Tell us when your starter was last fed.')).toBeVisible();
 await bake.getByRole('button',{name:fr?'Votre levain →':'Your starter →',exact:true}).tap();
 const step=page.locator('#step-11:visible');
 await expect(step.locator('.bh-page-title')).toHaveText(fr?'Votre levain':'Your starter');
 await expect(step.locator('[data-bh-forward]')).toBeDisabled();
 const card=step.locator('.bh-starter-controls');
 await card.getByRole('button',{name:fr?'Température ambiante':'Room temp',exact:true}).tap();
 await card.getByRole('button',{name:fr?'Hier':'Yesterday',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).lastFedAge).toBe('yesterday');
 await expect(step.locator('[data-bh-forward]')).toBeEnabled();
 await step.locator('[data-bh-forward]').tap();
 await expect(page.locator('#step-9:visible')).toHaveCount(1);
 await expect(page.locator('#step-9:visible .bh-starter-controls')).toHaveCount(0);
 const feeds=async()=>((await stored(page)).starterEvents||[]).filter(e=>['refresh','intermediate_refresh','pre_mix'].includes(e.kind));
 // The planner runs after the step mounts; on a slow CI WebKit it can take longer than 20 s.
 await expect.poll(async()=>(await feeds()).length,{timeout:45000}).toBeGreaterThan(0);
 for(const feed of await feeds())expect(feed.time%(15*60000)).toBe(0);
 expect(errors).toEqual([]);
});
