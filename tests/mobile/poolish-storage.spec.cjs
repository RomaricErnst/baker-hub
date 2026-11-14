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
async function openAvailability(page,locale){
 const summary=page.locator('summary:visible').filter({hasText:locale==='fr'?/^Quand êtes-vous occupé/:/^When are you busy/});
 if(await summary.locator('..').getAttribute('open')===null)await summary.tap();
}
async function seed(page,{locale='fr',mode='custom',preferment='poolish',extra={},now=NOW}={}){
 await page.clock.setFixedTime(now);
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
 await openAvailability(page,locale);
 await nights.tap();
 await expect.poll(async()=>(await stored(page)).blocks.length).toBeGreaterThan(0);
 await expect(row(plan,'pref')).toHaveAttribute('data-candidate-valid','true');
 const expectedCold=true;
 // Prefer a feasible refrigerated protocol in a hot kitchen.
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
 await openAvailability(page,locale);
 await nights.tap();await expect.poll(async()=>(await stored(page)).blocks.length).toBe(0);
 await expect.poll(async()=>(await stored(page)).startTime).toBe(baseline.startTime);
 expect((await stored(page)).prefGoesInFridge).toBe(baseline.prefGoesInFridge);
 expect((await stored(page)).prefOffsetH).toBe(baseline.prefOffsetH);
 expect(errors).toEqual([]);
});

for(const locale of ['fr','en'])test(`${locale} 27C: Wednesday evening poolish for Friday, editable cold storage and visible reset`,async({page},info)=>{
 const now=Date.parse('2026-10-28T22:05:00+08:00'),bake=Date.parse('2026-10-30T19:30:00+08:00');
 const {plan}=await seed(page,{locale,now,extra:{kitchenTemp:27,fridgeTemp:6,startTime:Date.parse('2026-10-29T17:30:00+08:00'),eatTime:bake,prefOffsetH:7,prefGoesInFridge:false}});
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge).toBe(false);
 await page.reload();await expect(plan).toBeVisible();
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge).toBe(false);
 await expand(plan,'pref');
 await row(plan,'pref').locator('input[type="datetime-local"]').fill('2026-10-28T22:45');
 await expect(reset(page)).toBeVisible();
 await expect(row(plan,'pref').getByText(locale==='fr'?/^Au réfrigérateur ·/:/^Refrigerated ·/)).toBeVisible();
 await expect(confirm(plan)).toBeEnabled();await confirm(plan).tap();
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge).toBe(true);
 const selected=await stored(page);expect(selected.startTime-selected.prefOffsetH*3600000).toBe(Date.parse('2026-10-28T22:45:00+08:00'));
 await reset(page).tap();
 // The recommendation: the first quarter hour at least 15 minutes from 22:05.
 await expect.poll(async()=>{const s=await stored(page);return s.startTime-s.prefOffsetH*3600000;}).toBe(Date.parse('2026-10-28T22:30:00+08:00'));
 expect((await stored(page)).eatTime).toBe(bake);
 await openAvailability(page,locale);
 await page.getByRole('button',{name:locale==='fr'?/^Nuits/:/^Nights/}).tap();
 await page.getByRole('button',{name:locale==='fr'?/^Jours ouvrés/:/^Weekdays/}).tap();
 const covered=page.getByRole('button',{name:locale==='fr'?/Oui, quelqu’un s’en charge/:/Yes, someone will/});
 if(await covered.isVisible())await covered.tap();
 await expect(row(plan,'pref')).toHaveAttribute('data-candidate-valid','true');
 await expect.poll(async()=>{const s=await stored(page);return s.startTime-s.prefOffsetH*3600000;}).toBe(Date.parse('2026-10-28T22:30:00+08:00'));
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge).toBe(true);
 await expand(plan,'pref');
 await expect(row(plan,'pref').locator('.bh-window-options button').first()).toBeVisible({timeout:30000});
 await expect(row(plan,'pref').locator('.bh-window-rail')).toHaveCount(0);
 await expect(row(plan,'pref').getByText(/No available window|Aucun créneau$/)).toHaveCount(0);
 await info.attach('evening-poolish',{body:await page.screenshot({path:info.outputPath('evening-poolish.png')}),contentType:'image/png'});
 await page.reload();await expect(plan).toBeVisible();expect((await stored(page)).prefGoesInFridge).toBe(true);
});

// Nights on, off, on, off: each state returns to the same automatic poolish plan.
for(const kitchenTemp of [22,28])test(`en ${kitchenTemp}C: Nights on-off-on-off returns to the same poolish plan`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const bake=NOW+46*3600000-25*60000;
 await seed(page,{locale:'en',extra:{kitchenTemp,eatTime:bake,startTime:bake-20*3600000,prefOffsetH:8,prefGoesInFridge:false,recipeGenerated:true}});
 if(await reset(page).count())await reset(page).tap();
 const snap=s=>({start:s.startTime,offset:s.prefOffsetH,fridge:s.prefGoesInFridge,blocks:(s.blocks||[]).length});
 const settle=async()=>{let last='';for(let i=0;i<25;i++){await page.waitForTimeout(400);const s=JSON.stringify(snap(await stored(page)));if(s===last)return JSON.parse(s);last=s;}return JSON.parse(last);};
 const nights=page.getByRole('button',{name:/^Nights/});
 await openAvailability(page,'en');
 if((await nights.getAttribute('aria-pressed'))!=='true')await nights.tap();
 const on1=await settle();await nights.tap();const off1=await settle();
 await nights.tap();const on2=await settle();await nights.tap();const off2=await settle();
 expect(on1.blocks).toBeGreaterThan(0);expect(off1.blocks).toBe(0);
 expect(on2).toEqual(on1);expect(off2).toEqual(off1);
 expect(errors).toEqual([]);
});
