const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// A baker-entered yeast amount re-times the plan at the same bake time.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T09:00:00+08:00');
const BAKE=Date.parse('2026-10-04T19:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));

test('more yeast plans a later start, and the calculated amount restores the plan',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:BAKE-24*3600000,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('yeast-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('yeast-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 const plan=page.getByRole('region',{name:'Your key times',exact:true});
 await expect(plan).toBeVisible();
 await expect.poll(async()=>(await stored(page))?.startTime).toBeTruthy();
 const automatic=(await stored(page)).startTime;

 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:'Previous step',exact:true}).tap();
 const fineTune=page.locator('#step-10:visible');
 await expect(fineTune.getByRole('heading',{name:'Fine-tune your dough'})).toBeVisible();
 const yeast=fineTune.locator('[data-yeast-override] input');
 const recommended=Number(await yeast.inputValue());
 expect(recommended).toBeGreaterThan(0);
 await yeast.fill(String(Math.round(recommended*2*1000)/1000));await yeast.blur();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeGreaterThan(0);
 await expect(fineTune.getByText(/timing follows this amount/)).toBeVisible();
 await fineTune.locator('[data-yeast-override]').scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath('yeast-override.png')});

 await fineTune.locator('[data-bh-forward]').tap();
 await expect(plan).toBeVisible();
 await expect.poll(async()=>(await stored(page)).startTime-automatic,{timeout:15000}).toBeGreaterThan(3*3600000);
 expect((await stored(page)).eatTime).toBe(BAKE);
 const timed=(await stored(page)).startTime;

 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:'Previous step',exact:true}).tap();
 await fineTune.getByRole('button',{name:'Use the calculated amount'}).tap();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeUndefined();
 await fineTune.locator('[data-bh-forward]').tap();
 // The recommendation returns: an earlier start than the extra yeast allowed.
 await expect.poll(async()=>timed-(await stored(page)).startTime,{timeout:15000}).toBeGreaterThan(3*3600000);
 expect((await stored(page)).eatTime).toBe(BAKE);
 expect(errors).toEqual([]);
});
