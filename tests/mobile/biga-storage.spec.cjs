const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Biga storage (21 Nov 2026 round 8, owner decision D1) and round 7 bugs 4 and 5: a biga ripens in the
// fridge (24–58 h) or in a cool spot at about 18 °C (12–20 h, Giorilli's classic biga). 'auto' keeps the
// fridge and takes the cool spot only when no fridge plan fits, in a kitchen at 20 °C or cooler.
test.use({timezoneId:'Asia/Singapore'});
const H=3600000;
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const L=(fr,en,frText)=>fr?frText:en;

async function seed(page,{locale,now,step,extra}){
 await page.clock.setFixedTime(now);
 const data={version:1,savedAt:now,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:19,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'biga',prefermentFlourPct:40,prefOffsetH:30,prefGoesInFridge:true,flourInFridge:false,startTime:now+24*H,eatTime:now+56*H,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:step,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',confirmedSettings:[`oven=${extra.ovenType??'pizza_oven'}`,`yeast=${extra.yeastType??'instant'}`,`climate=${extra.kitchenTemp??19}`],...extra};
 await page.addInitScript(([data,step])=>{
  if(!sessionStorage.getItem('biga-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('biga-seeded','1');
   sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:step,setupOverview:false,activeTab:'setup'}));}
 },[data,step]);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
}
const keyTimes=(page,fr)=>page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true});
async function forwardToPlan(page,fr){
 for(let i=0;i<6&&!(await keyTimes(page,fr).isVisible());i++){
  const fwd=page.locator('[data-bh-forward]:visible').first();
  await fwd.tap();
  await page.waitForTimeout(300);
 }
 await expect(keyTimes(page,fr)).toBeVisible({timeout:20000});
}

for(const locale of ['en','fr'])test(`${locale}: the biga storage choice — a cool spot at 19 °C plans a 12–20 h biga, said on the plan`,async({page})=>{
 const fr=locale==='fr';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const now=Date.parse('2026-11-23T09:00:00+08:00');
 await seed(page,{locale,now,step:8,extra:{}});
 const box=page.locator('[data-biga-storage]:visible');
 await expect(box).toBeVisible({timeout:20000});
 await expect(box.locator('legend')).toHaveText(L(fr,'Where the biga ferments','Où la biga fermente'));
 await expect(box.locator('[data-biga-storage-option]')).toHaveText([
  L(fr,'Best for my timing','Au mieux pour mon planning'),
  L(fr,'In the fridgeLonger, 24 to 58 h.','Au réfrigérateurPlus longue, 24 à 58 h.'),
  L(fr,'In a cool spot, 16–18 °CThe classic Italian biga, 12 to 20 h.','Dans un endroit frais, 16–18 °CLa biga italienne classique, 12 à 20 h.'),
 ]);
 await expect(box.locator('[data-biga-storage-option="auto"]')).toHaveAttribute('aria-pressed','true');
 await box.locator('[data-biga-storage-option="cool"]').tap();
 await expect(box.locator('[data-biga-storage-option="cool"]')).toHaveAttribute('aria-pressed','true');
 await box.screenshot({path:test.info().outputPath(`biga-storage-${locale}.png`)});
 await expect.poll(async()=>(await stored(page)).bigaStorage).toBe('cool');
 await forwardToPlan(page,fr);
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge,{timeout:20000}).toBe(false);
 const s=await stored(page);
 expect(s.prefOffsetH).toBeGreaterThanOrEqual(12);expect(s.prefOffsetH).toBeLessThanOrEqual(20);
 await expect(keyTimes(page,fr).getByText(fr?/^Endroit frais ·/:/^Cool spot ·/)).toBeVisible();
 await keyTimes(page,fr).screenshot({path:test.info().outputPath(`biga-cool-plan-${locale}.png`)});
 // Kept on reload.
 await page.reload();await page.waitForTimeout(1500);
 expect((await stored(page)).bigaStorage).toBe('cool');expect((await stored(page)).prefGoesInFridge).toBe(false);
 expect(errors).toEqual([]);
});

for(const locale of ['en','fr'])test(`${locale}: Giorilli's classic biga — 1 % fresh yeast in a cool spot fits, about 16 h`,async({page})=>{
 const fr=locale==='fr';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const now=Date.parse('2026-11-23T09:00:00+08:00');
 await seed(page,{locale,now,step:10,extra:{yeastType:'fresh',bigaStorage:'cool',prefGoesInFridge:false,prefOffsetH:16}});
 const fineTune=page.locator('#step-10:visible');
 const pref=fineTune.locator('[data-pref-yeast-override] input');
 await expect(pref).toBeVisible({timeout:20000});
 await pref.fill(fr?'1':'1');await pref.blur();
 await expect(fineTune.locator('[data-pref-yeast-issue]')).toHaveCount(0);
 await expect.poll(async()=>(await stored(page)).prefYeastOverride?.type).toBe('biga');
 expect(Math.abs((await stored(page)).prefYeastOverride.pct-1/3)).toBeLessThan(0.001);
 await fineTune.locator('[data-pref-yeast-override]').locator('..').screenshot({path:test.info().outputPath(`giorilli-${locale}.png`)});
 await forwardToPlan(page,fr);
 await expect.poll(async()=>(await stored(page)).prefOffsetH,{timeout:20000}).toBe(16);
 expect((await stored(page)).prefGoesInFridge).toBe(false);
 expect(errors).toEqual([]);
});

for(const locale of ['en','fr'])test(`${locale}: bug 5 — Thomas, 20 °C, Sat 11:30 baguettes, nights + work: the plan avoids busy times with a cool-spot biga`,async({page})=>{
 const fr=locale==='fr';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Thursday 10pm: a fridge biga (≥ 24 h) would put Start Dough after 10:15pm Friday and the dough's steps in the night.
 const now=Date.parse('2026-11-26T22:00:00+08:00'),bake=Date.parse('2026-11-28T11:30:00+08:00');
 await seed(page,{locale,now,step:9,extra:{bakeType:'bread',styleKey:'baguette',numItems:2,itemWeight:350,ovenType:'home_oven_standard',kitchenTemp:20,eatTime:bake,startTime:Date.parse('2026-11-27T18:15:00+08:00'),prefOffsetH:30}});
 const plan=keyTimes(page,fr);await expect(plan).toBeVisible({timeout:20000});
 const summary=page.locator('summary:visible').filter({hasText:fr?/^Quand êtes-vous occupé/:/^When are you busy/});
 if(await summary.count()&&await summary.locator('..').getAttribute('open')===null)await summary.tap();
 await page.getByRole('button',{name:fr?/^Jours ouvrés/:/^Weekdays/}).tap();
 await page.getByRole('button',{name:fr?/^Nuits/:/^Nights/}).tap();
 await expect.poll(async()=>(await stored(page)).blocks.length,{timeout:20000}).toBeGreaterThan(2);
 await expect.poll(async()=>(await stored(page)).prefGoesInFridge,{timeout:20000}).toBe(false);
 const s=await stored(page);
 expect(s.eatTime).toBe(bake);
 expect(s.prefOffsetH).toBeGreaterThanOrEqual(12);expect(s.prefOffsetH).toBeLessThanOrEqual(20);
 const inBusy=t=>s.blocks.some(b=>t>b.from&&t<b.to);
 expect(inBusy(s.startTime)).toBe(false);expect(inBusy(s.startTime-s.prefOffsetH*H)).toBe(false);
 await expect(plan.locator('[data-key-timing="pref"]')).toHaveAttribute('data-candidate-valid','true');
 // No clash statement, no "Keep 11:30" as the only way.
 await expect(page.getByText(fr?/tombent pendant la nuit/:/fall during the night/)).toHaveCount(0);
 await plan.screenshot({path:test.info().outputPath(`thomas-biga-${locale}.png`)});
 expect(errors).toEqual([]);
});

for(const locale of ['en','fr'])test(`${locale}: bug 4 — "Keep the biga and bake …" leads to a plan at that bake`,async({page})=>{
 const fr=locale==='fr';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // B3: Neapolitan, 22 °C (no automatic cool spot), Thu 7:30pm, bake Fri 7:30pm.
 const now=Date.parse('2026-11-26T19:30:00+08:00'),bake=Date.parse('2026-11-27T19:30:00+08:00');
 await seed(page,{locale,now,step:8,extra:{kitchenTemp:22,eatTime:bake,startTime:bake-8*H,prefOffsetH:24}});
 const close=page.locator('[data-preferment-too-close]:visible');
 await expect(close).toBeVisible({timeout:20000});
 const keep=close.locator('[data-preferment-fallback="later"]');
 await expect(keep).toHaveText(fr?/^Garder la biga et cuire /:/^Keep the biga and bake /);
 await close.screenshot({path:test.info().outputPath(`bug4-statement-${locale}.png`)});
 await keep.tap();
 await expect(close).toHaveCount(0);
 await expect.poll(async()=>(await stored(page)).eatTime).not.toBe(bake);
 const later=(await stored(page)).eatTime;
 expect(later).toBeGreaterThan(bake);
 expect(new Date(later).getHours()).toBeGreaterThanOrEqual(7);
 await forwardToPlan(page,fr);
 // The plan exists at exactly that bake, with the biga (no dead end, nothing dropped).
 await expect(keyTimes(page,fr).locator('[data-key-timing="pref"]')).toHaveAttribute('data-candidate-valid','true',{timeout:20000});
 const s=await stored(page);
 expect(s.eatTime).toBe(later);expect(s.prefermentType).toBe('biga');
 expect(s.prefOffsetH).toBeGreaterThanOrEqual(24);expect(s.startTime-s.prefOffsetH*H).toBeGreaterThanOrEqual(now);
 await keyTimes(page,fr).screenshot({path:test.info().outputPath(`bug4-plan-${locale}.png`)});
 expect(errors).toEqual([]);
});
