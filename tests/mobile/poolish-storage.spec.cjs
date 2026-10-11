const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Screenshot reproduction fixes the user's local clock. Recipe/temperature
// details were not visible: these explicit fixture assumptions are not a claim
// to reproduce the user's unknown recipe or a physical fermentation outcome.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T15:25:00+08:00');
const BAKE=Date.parse('2026-10-04T20:31:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const row=(plan,id)=>plan.locator(`[data-key-timing="${id}"]`);
async function expand(plan,id){const r=row(plan,id);if(!await r.locator('.bh-key-exact').isVisible())await r.locator('.bh-key-time').tap();await expect(r.locator('.bh-key-exact')).toBeVisible();}
const reset=page=>page.getByRole('button',{name:/^(Revenir aux horaires recommandés|Return to recommended times)$/});
const confirm=plan=>plan.getByRole('button',{name:/^(Appliquer|Apply)$/});
async function seed(page,{locale='fr',mode='custom',preferment='poolish',extra={}}={}){
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:mode,bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'spiral',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:preferment,prefOffsetH:preferment==='none'?0:11,prefGoesInFridge:true,flourInFridge:false,startTime:Date.parse('2026-10-03T23:40:00+08:00'),eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup',...extra};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('feedback-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('feedback-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 const plan=page.getByRole('region',{name:locale==='fr'?'Vos moments clés':'Your key times',exact:true});
 await expect(plan).toBeVisible();
 return {plan,data};
}
for(const locale of ['fr','en'])for(const kitchenTemp of [22,32])test(`${locale} ${kitchenTemp}C: automatic poolish storage, Nights round trip and reload`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const {plan}=await seed(page,{locale,extra:{kitchenTemp,prefOffsetH:8,prefGoesInFridge:false,timingOverrides:{mix:Date.parse('2026-10-03T23:40:00+08:00')}}});
 await reset(page).tap();
 await expect.poll(async()=>Object.keys((await stored(page)).timingOverrides||{}).length).toBe(0);
 const baseline=await stored(page);
 const nights=page.getByRole('button',{name:locale==='fr'?/^Nuits/:/^Nights/});
 await nights.tap();
 await expect.poll(async()=>(await stored(page)).blocks.length).toBeGreaterThan(0);
 await expect(row(plan,'pref')).toHaveAttribute('data-candidate-valid','true');
 const expectedCold=kitchenTemp===22;
 // At 32C the model can mix at 18:31 before the night starts. Do not force
 // a cold protocol when a fully compatible room-temperature plan wins.
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge).toBe(expectedCold);
 const cold=await stored(page);
 expect(cold.eatTime).toBe(BAKE);
 expect(cold.startTime-cold.prefOffsetH*3600000).toBeLessThan(Date.parse('2026-10-03T22:45:00+08:00'));
 const storageLabel=expectedCold?(locale==='fr'?/^Au réfrigérateur ·/:/^Refrigerated ·/):(locale==='fr'?/^À température ambiante ·/:/^Room temperature ·/);
 await expect(row(plan,'pref').getByText(storageLabel)).toBeVisible();
 if(!expectedCold)expect(cold.startTime).toBeLessThan(Date.parse('2026-10-03T23:00:00+08:00'));
 await page.reload();await expect(plan).toBeVisible();
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge).toBe(expectedCold);
 expect((await stored(page)).startTime).toBe(cold.startTime);
 await nights.tap();await expect.poll(async()=>(await stored(page)).blocks.length).toBe(0);
 await expect.poll(async()=>(await stored(page)).startTime).toBe(baseline.startTime);
 expect((await stored(page)).prefGoesInFridge).toBe(baseline.prefGoesInFridge);
 expect((await stored(page)).prefOffsetH).toBe(baseline.prefOffsetH);
 expect(errors).toEqual([]);
});
