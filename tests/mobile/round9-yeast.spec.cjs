const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 9 (22 Nov 2026): baker-set yeast and preferments (FINDINGS B, C, D, F, G, H, I, S2).
// B3: 4 Neapolitan pizzas, 22 °C, Thu 7:30pm, bake Fri 7:30pm; the calculated plan kneads Thu 8:30pm.
// Thomas: 4 baguettes, 20 °C, bake Sat 28 Nov 11:30.
const Z=s=>Date.parse(s);
const H=3600000;
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({timezoneId:'Asia/Singapore',actionTimeout:20000});
test.setTimeout(150000);
const L=(fr,en,frText)=>fr?frText:en;

const B3_NOW=Z('2026-11-26T19:30:00+08:00'),B3_BAKE=Z('2026-11-27T19:30:00+08:00'),B3_MIX=Z('2026-11-26T20:30:00+08:00');
const nights=days=>days.map(d=>({label:d+' night',from:Z(d+'T23:00:00+08:00'),to:Z(d+'T23:00:00+08:00')+8*H}));
const b3=(extra={})=>({version:1,savedAt:B3_NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,
 startTime:B3_MIX,eatTime:B3_BAKE,acceptedStartTime:B3_MIX,acceptedPreparationAt:B3_MIX,acceptedEatTime:B3_BAKE,blocks:[],recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand'],activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra});
const T_NOW=Z('2026-11-26T20:00:00+08:00'),T_BAKE=Z('2026-11-28T11:30:00+08:00'),T_MIX=Z('2026-11-28T07:30:00+08:00');
const thomasBiga=(extra={})=>({version:1,savedAt:T_NOW,tab:'custom',bakeType:'bread',bakeName:'',styleKey:'baguette',numItems:4,itemWeight:320,ovenType:'home_oven_standard',
 mixerType:'hand',yeastType:'fresh',humidity:'normal',fridgeTemp:6,kitchenTemp:20,flourBlend:{flour1:'bread',flour2:null,ratio1:100},flourChosen:true,
 prefermentType:'biga',bigaStorage:'cool',prefermentFlourPct:20,prefOffsetH:16,prefGoesInFridge:false,flourInFridge:false,recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,prefermentChosen:true,
 customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=fresh','climate=20','mixer=hand','method=biga'],
 startTime:T_MIX,eatTime:T_BAKE,acceptedStartTime:T_MIX,acceptedPreparationAt:T_MIX-16*H,acceptedEatTime:T_BAKE,blocks:[],
 activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra});

async function open(page,data,locale,now,step=10){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(now);
 await page.addInitScript(([data,step])=>{
  if(!sessionStorage.getItem('r9-seeded')){localStorage.clear();localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('r9-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:step,setupOverview:false,activeTab:'setup'}));
 },[data,step]);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 return errors;
}
async function fineTune(page){
 const ft=page.locator('#step-10:visible');
 await expect(ft.locator('[data-yeast-override] input')).toBeVisible({timeout:30000});
 return ft;
}
const num=text=>Number(String(text).match(/\d+(?:[.,]\d+)?/)[0].replace(',','.'));
const shot=async(page,name,target)=>{
 if(target){await page.evaluate(()=>window.dispatchEvent(new Event('touchmove')));await target.evaluate(el=>el.scrollIntoView({block:'center'}));}
 await page.screenshot({path:test.info().outputPath(`${name}.png`)});
};
const log=(...parts)=>console.log('[r9]',test.info().title.slice(0,40),...parts);
async function update(page,ft,fr){
 await ft.getByRole('button',{name:fr?'Mettre à jour la recette':'Update recipe',exact:true}).tap();
 await expect.poll(async()=>{const s=await stored(page);return s.recipeGenerated&&!s.protocolStale&&s.acceptedStartTime===s.startTime;},{timeout:30000}).toBe(true);
}

for(const locale of ['en','fr']){
 const fr=locale==='fr';

 test(`${locale}: I — B3, 0.1 % at 22 °C, bake in 24 h: the statement and the plan read one path (a room plan in the day)`,async({page})=>{
  const errors=await open(page,b3(),locale,B3_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,1':'0.1');await yeast.blur();
  // No statement: a plan at room temperature fits within the day.
  await expect(ft.locator('[data-yeast-entry-issue]')).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(0.1);
  expect((await stored(page)).yeastAnchorH).toBe(23);
  await update(page,ft,fr);
  const s=await stored(page);
  expect(s.startTime).toBeGreaterThan(B3_NOW);
  expect(s.eatTime).toBe(B3_BAKE);
  const hour=new Date(s.startTime).getHours();
  expect(hour>=7&&hour<22).toBe(true);
  // A room plan: no fridge step on the recipe's plan.
  await expect(page.locator('.bh-plan-sheet,[data-decision-sheet]').filter({visible:true})).toHaveCount(0);
  log('mix',new Date(s.startTime).toISOString());
  await shot(page,`i-plan-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: night steps (owner) — B3, 0.14 % is planned; its folds after 10pm are named once; Keep is remembered`,async({page})=>{
  const errors=await open(page,b3(),locale,B3_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,14':'0.14');await yeast.blur();
  // Never refused for night steps: applied, no statement.
  await expect(ft.locator('[data-yeast-entry-issue]')).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(0.14);
  const night=ft.locator('[data-entry-night]');
  await expect(night.locator('p')).toHaveText(fr?/^Ce planning a des rabats à 2[23]h\d\d et 2[23]h\d\d\.$/:/^This plan has folds at 1[01]:\d\dpm and 1[01]:\d\dpm\.$/);
  // Two choices, neither a primary button.
  await expect(night.getByRole('button')).toHaveText([fr?/^Utiliser 0,1\d % \(sans étape de nuit\)$/:/^Use 0\.1\d% \(no night steps\)$/,fr?'Garder 0,14 %':'Keep 0.14%']);
  await expect(night.locator('.bh-apply-plan')).toHaveCount(0);
  await expect(ft.locator('[data-yeast-helper]')).toHaveCount(0);
  await shot(page,`night-line-${locale}`,night);
  await night.locator('[data-entry-night-keep]').tap();
  await expect(night).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).entryNightKept).toEqual({yeast:0.14});
  // Remembered with the amount: not shown again on the next visit.
  await page.reload();
  const again=await fineTune(page);
  await expect(again.locator('[data-yeast-override] input')).toHaveValue(fr?'0,14':'0.14');
  await page.waitForTimeout(1500);
  await expect(again.locator('[data-entry-night]')).toHaveCount(0);
  expect((await stored(page)).yeastPctOverride).toBe(0.14);
  expect((await stored(page)).entryNightKept).toEqual({yeast:0.14});
  expect(errors).toEqual([]);
 });

 test(`${locale}: night steps (owner) — "Use … (no night steps)" takes the nearest amount and keeps the 8:30pm knead`,async({page})=>{
  const errors=await open(page,b3(),locale,B3_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,14':'0.14');await yeast.blur();
  const avoid=ft.locator('[data-entry-night] [data-entry-night-avoid]');
  const shown=num(await avoid.textContent());
  await avoid.tap();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(shown);
  await expect(ft.locator('[data-entry-night]')).toHaveCount(0);
  await update(page,ft,fr);
  const s=await stored(page);
  expect(Math.abs(s.startTime-B3_MIX)).toBeLessThanOrEqual(H);
  expect(errors).toEqual([]);
 });

 test(`${locale}: D — no busy times: 3 % fresh in the final dough is never "your busy times"`,async({page})=>{
  const errors=await open(page,thomasBiga(),locale,T_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill('3');await yeast.blur();
  const note=ft.locator('[data-yeast-entry-issue]');
  await expect(note).toHaveAttribute('data-reason','fast');
  await expect(note.locator('p')).toHaveText(fr?/^Avec 3 %, la pâte lève trop vite pour ses étapes\. \d,\d+ % convient\.$/:/^With 3%, the dough rises too fast for its steps\. \d\.\d+% fits\.$/);
  await expect(note).not.toContainText(fr?'occupés':'busy');
  await shot(page,`d-fast-${locale}`,note);
  expect(errors).toEqual([]);
 });

 test(`${locale}: F/G — biga at 22 °C, bake in 24 h, nights: the cool spot is offered (never chosen), and a later bake has no night step`,async({page})=>{
  const data={...b3({prefermentType:'biga',prefermentFlourPct:40,prefOffsetH:24,prefGoesInFridge:true,startTime:B3_BAKE-8*H,ovenType:'pizza_oven',recipeGenerated:false,confirmedSettings:['oven=pizza_oven','yeast=instant','climate=22'],blocks:nights(['2026-11-26','2026-11-27'])})};
  const errors=await open(page,data,locale,B3_NOW,8);
  const close=page.locator('[data-preferment-too-close]:visible');
  await expect(close).toBeVisible({timeout:30000});
  await expect(close.locator('p')).toHaveText(fr?/^Une biga au frigo demande environ/:/^A biga in the fridge needs about/);
  const options=close.locator('[data-preferment-fallback]');
  await expect(options).toHaveCount(4);
  await expect(close.locator('[data-preferment-fallback="cool"]')).toHaveText(L(fr,'Keep the biga, in a cool spot at 16–18 °C','Garder la biga, dans un endroit frais à 16–18 °C'));
  // Light: no primary button inside the sheet.
  await expect(close.locator('.bh-apply-plan')).toHaveCount(0);
  // Not chosen for the baker.
  expect((await stored(page)).bigaStorage??'auto').toBe('auto');
  const later=close.locator('[data-preferment-fallback="later"]');
  const laterText=await later.textContent();
  // Sat 7:00am put the take-out at 4:30 and the preheat at 6:15 (bug G): never offered.
  expect(laterText).not.toMatch(fr?/7h00/:/7:00am/);
  await shot(page,`f-sheet-${locale}`,close);
  await close.locator('[data-preferment-fallback="cool"]').tap();
  await expect.poll(async()=>(await stored(page)).bigaStorage).toBe('cool');
  await expect(close).toHaveCount(0);
  expect(errors).toEqual([]);
 });

 test(`${locale}: H — fridge biga, 3 % fresh in the final dough, bake Sat 7:00 with nights: said, never a biga in the past`,async({page})=>{
  const bake=Z('2026-11-28T07:00:00+08:00'),mix=Z('2026-11-27T20:00:00+08:00');
  const data=b3({yeastType:'fresh',prefermentType:'biga',prefermentFlourPct:40,prefOffsetH:24,prefGoesInFridge:true,bigaStorage:'fridge',ovenType:'pizza_oven',
   startTime:mix,eatTime:bake,acceptedStartTime:mix,acceptedPreparationAt:mix-24*H,acceptedEatTime:bake,blocks:nights(['2026-11-26','2026-11-27']),confirmedSettings:['oven=pizza_oven','yeast=fresh','climate=22','mixer=hand','method=biga']});
  const errors=await open(page,data,locale,B3_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill('3');await yeast.blur();
  const note=ft.locator('[data-yeast-entry-issue]');
  await expect(note).toBeVisible();
  expect(['night','fast','plan']).toContain(await note.getAttribute('data-reason'));
  await shot(page,`h-statement-${locale}`,note);log(await note.locator('p').textContent());
  expect((await stored(page)).yeastPctOverride).toBeUndefined();
  const s=await stored(page);
  expect(s.startTime-s.prefOffsetH*H).toBeGreaterThan(B3_NOW);
  expect(errors).toEqual([]);
 });

 test(`${locale}: B — a biga amount typed for one storage is cleared, visibly, when the storage changes; the recipe asks to update`,async({page})=>{
  const data=thomasBiga({bigaStorage:'auto',prefGoesInFridge:true,prefOffsetH:24,yeastType:'instant',startTime:T_MIX,acceptedPreparationAt:T_MIX-24*H,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=20','mixer=hand','method=biga'],prefYeastOverride:{type:'biga',pct:0.5}});
  const errors=await open(page,data,locale,T_NOW,8);
  const box=page.locator('[data-biga-storage]:visible');
  await expect(box).toBeVisible({timeout:30000});
  await box.locator('[data-biga-storage-option="cool"]').tap();
  await expect.poll(async()=>(await stored(page)).prefYeastOverride).toBeUndefined();
  await expect(box.locator('[data-pref-yeast-cleared]')).toHaveText(fr?'La biga reprend la quantité de levure calculée (vous aviez saisi 0,5 %).':'The biga is back to the calculated yeast (you had entered 0.5%).');
  await shot(page,`b-cleared-${locale}`,box);
  // The storage is a recipe input: the way back is Update recipe.
  await expect(page.getByRole('button',{name:fr?'Mettre à jour la recette':'Update recipe',exact:true}).filter({visible:true}).first()).toBeVisible();
  expect(errors).toEqual([]);
 });

 test(`${locale}: S2 — a biga amount no window holds names where its hours apply and offers one that fits`,async({page})=>{
  // An evening bake: a fridge biga started in the day fits.
  const bake=Z('2026-11-28T18:30:00+08:00'),mix=Z('2026-11-28T14:30:00+08:00');
  const data=thomasBiga({bigaStorage:'fridge',prefGoesInFridge:true,prefOffsetH:30,yeastType:'instant',eatTime:bake,acceptedEatTime:bake,startTime:mix,acceptedStartTime:mix,acceptedPreparationAt:mix-30*H,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=20','mixer=hand','method=biga']});
  const errors=await open(page,data,locale,T_NOW);const ft=await fineTune(page);
  const biga=ft.locator('[data-pref-yeast-override] input');
  await biga.fill('1');await biga.blur();
  const issue=ft.locator('[data-pref-yeast-issue]');
  await expect(issue).toBeVisible();
  await expect(issue.locator('p')).toContainText(fr?'au frigo':'in the fridge');
  await shot(page,`s2-${locale}`,issue);log(await issue.locator('p').textContent());
  const offer=issue.locator('[data-use-suggested-pref-yeast]');
  await expect(offer).toHaveText(fr?/^Utiliser 0,\d+ %$/:/^Use 0\.\d+%$/);
  await offer.tap();
  await expect.poll(async()=>(await stored(page)).prefYeastOverride?.type).toBe('biga');
  await expect(issue).toHaveCount(0);
  expect(errors).toEqual([]);
 });
 test(`${locale}: C — with a poolish, the change line names the total yeast`,async({page})=>{
  const mix=Z('2026-11-27T18:15:00+08:00');
  const data=thomasBiga({prefermentType:'poolish',bigaStorage:undefined,poolishStorage:'room',prefermentFlourPct:30,prefOffsetH:12,prefGoesInFridge:false,yeastType:'instant',
   startTime:mix,acceptedStartTime:mix,acceptedPreparationAt:mix-12*H,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=20','mixer=hand','method=poolish']});
  const errors=await open(page,data,locale,T_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  const calc=num(await yeast.getAttribute('placeholder'));
  const more=Math.round(calc*1.5*100)/100;
  await yeast.fill(fr?String(more).replace('.',','):String(more));await yeast.blur();
  const issue=ft.locator('[data-yeast-entry-issue]');
  if(await issue.count()){const offer=issue.locator('[data-use-minimum-yeast]');if(await offer.count())await offer.tap();}
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeGreaterThan(calc);
  await update(page,ft,fr);
  const note=page.locator('[data-plan-note]:visible,[data-plan-moved]:visible').first();
  if(await note.count()){
   await expect(note).not.toContainText(fr?'du préferment':'in the preferment');
   const text=await note.textContent();log(text);
   if(/yeast|levure/i.test(text))expect(text).toMatch(fr?/Levure au total : /:/Total yeast now /);
   await shot(page,`c-note-${locale}`,note);
  }
  expect(errors).toEqual([]);
 });

}
