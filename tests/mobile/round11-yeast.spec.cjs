const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 11 (22 Nov 2026): entered yeast and nights, biga in edit mode, the time editor's ways on, Update recipe, smalls.
// B3: 4 Neapolitan pizzas, 22 °C, Thu 7:30pm, bake Fri 11:30am; the calculated plan kneads Thu 8:00pm.
// Thomas: 4 baguettes, 20 °C, Fri 7:00pm, bake Sat 11:30, direct dough, Nights.
const Z=s=>Date.parse(s);
const H=3600000;
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({timezoneId:'Asia/Singapore',actionTimeout:20000});
test.setTimeout(150000);

const B3_NOW=Z('2026-11-26T19:30:00+08:00'),B3_LUNCH=Z('2026-11-27T11:30:00+08:00'),B3_MIX=Z('2026-11-26T20:00:00+08:00');
const B3_DINNER=Z('2026-11-27T19:30:00+08:00'),B3_DINNER_MIX=Z('2026-11-26T20:30:00+08:00');
const thuNight=[{label:'Thursday night',from:Z('2026-11-26T23:00:00+08:00'),to:Z('2026-11-27T07:00:00+08:00')}];
const b3=(extra={})=>({version:1,savedAt:B3_NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,
 startTime:B3_MIX,eatTime:B3_LUNCH,acceptedStartTime:B3_MIX,acceptedPreparationAt:B3_MIX,acceptedEatTime:B3_LUNCH,blocks:[],recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand'],activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra});
const T_NOW=Z('2026-11-27T19:00:00+08:00'),T_BAKE=Z('2026-11-28T11:30:00+08:00'),T_MIX=Z('2026-11-28T07:15:00+08:00');
const friNight=[{label:'Friday night',from:Z('2026-11-27T23:00:00+08:00'),to:Z('2026-11-28T07:00:00+08:00')}];
const thomas=(extra={})=>({version:1,savedAt:T_NOW,tab:'custom',bakeType:'bread',bakeName:'',styleKey:'baguette',numItems:4,itemWeight:320,ovenType:'home_oven_standard',
 mixerType:'hand',yeastType:'instant',humidity:'normal',fridgeTemp:6,kitchenTemp:20,flourBlend:{flour1:'bread',flour2:null,ratio1:100},flourChosen:true,
 prefermentType:'none',bigaStorage:'auto',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,prefermentChosen:true,
 customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=20','mixer=hand','method=none'],
 startTime:T_MIX,eatTime:T_BAKE,acceptedStartTime:T_MIX,acceptedPreparationAt:T_MIX,acceptedEatTime:T_BAKE,blocks:friNight,
 activeStep:7,advancedStep:8,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra});

async function open(page,data,locale,now,resume={activeStep:7,advancedStep:10,setupOverview:false,activeTab:'setup'}){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(now);
 await page.addInitScript(([data,resume])=>{
  if(!sessionStorage.getItem('r11-seeded')){localStorage.clear();localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('r11-seeded','1');
   if(resume)sessionStorage.setItem('bh_locale_resume',JSON.stringify(resume));}
 },[data,resume]);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 return errors;
}
async function fineTune(page){
 const ft=page.locator('#step-10:visible');
 await expect(ft.locator('[data-yeast-override] input')).toBeVisible({timeout:30000});
 return ft;
}
const shot=async(page,name,target)=>{
 if(target){await page.evaluate(()=>window.dispatchEvent(new Event('touchmove')));await target.evaluate(el=>el.scrollIntoView({block:'center'}));}
 await page.screenshot({path:test.info().outputPath(`${name}.png`)});
};
const log=(...parts)=>console.log('[r11]',test.info().title.slice(0,40),...parts);
const num=text=>Number(String(text).match(/\d+(?:[.,]\d+)?/)[0].replace(',','.'));
async function update(page,fr){
 await page.getByRole('button',{name:fr?'Mettre à jour la recette':'Update recipe',exact:true}).last().tap();
 await expect(page.locator('[data-recipe-plan]:visible')).toHaveCount(1,{timeout:30000});
 await expect.poll(async()=>{const s=await stored(page);return s.recipeGenerated&&!s.protocolStale&&s.acceptedStartTime===s.startTime&&s.activeTab==='plan';},{timeout:30000}).toBe(true);
}
// A clock time on the plan's quarter-hour grid in either language.
const QUARTER=/(?:\d{1,2}:(?:00|15|30|45)(?:am|pm)|\d{1,2}h(?:00|15|30|45))/g;
const OFF_GRID=/\d{1,2}(?::|h)(?!00|15|30|45)\d\d/;
async function openPreparation(page,fr){
 await page.locator('button:visible').filter({hasText:fr?/^Recette/:/^Recipe/}).first().tap();
 await page.getByRole('button',{name:fr?/^Préparation/:/^Preparation/}).first().tap();
}

for(const locale of ['en','fr']){
 const fr=locale==='fr';

 test(`${locale}: 1 — the night line is the plan that is saved; after Keep the Recipe and Preparation name it once`,async({page})=>{
  const errors=await open(page,b3(),locale,B3_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,1':'0.1');await yeast.blur();
  const night=ft.locator('[data-entry-night]');
  const line=night.locator('p');
  await expect(line).toHaveText(fr?/^Ce planning a /:/^This plan has /);
  const text=await line.textContent();
  log('line',text);
  // Quarter hours, one knead.
  expect(text).not.toMatch(OFF_GRID);
  expect((text.match(fr?/le pétrissage/g:/Start Dough/g)??[]).length).toBeLessThanOrEqual(1);
  await shot(page,`1-line-${locale}`,night);
  await night.locator('[data-entry-night-keep]').tap();
  await update(page,fr);
  const s=await stored(page);
  expect(s.entryNightKept).toEqual({yeast:0.1});
  // The Recipe names the kept steps once, with the same words: the plan the line described is the plan saved.
  const kept=page.locator('[data-kept-night]:visible');
  await expect(kept).toHaveCount(1);
  await expect(kept).toHaveText(text);
  // Every time the line names is one of the saved plan's step times (Preparation shows them).
  await expect(page.getByText(fr?/de la pousse/:/% risen/)).toHaveCount(0);
  await shot(page,`1-recipe-${locale}`,kept);
  await openPreparation(page,fr);
  const prep=page.locator('[data-preparation-timing] [data-kept-night]');
  await expect(prep).toHaveText(text,{timeout:30000});
  await expect(page.getByText(fr?'Vous avez modifié vos choix.':'You changed your choices.')).toHaveCount(0);
  const prepText=await page.locator('body').innerText();
  for(const t of text.match(QUARTER)??[])expect(prepText).toContain(t);
  await shot(page,`1-preparation-${locale}`,prep);
  expect(errors).toEqual([]);
 });

 test(`${locale}: O1 — steps in the nights the baker marked busy: the same line and pair, never a refusal; Keep saves a complete plan`,async({page})=>{
  const errors=await open(page,b3({blocks:thuNight}),locale,B3_NOW);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,14':'0.14');await yeast.blur();
  await expect(ft.locator('[data-yeast-entry-issue]')).toHaveCount(0);
  const night=ft.locator('[data-entry-night]');
  await expect(night.locator('p')).toHaveText(fr?/^Ce planning a .*\d{1,2}h\d\d/:/^This plan has .*\d(am|pm)/);
  await expect(night.locator('[data-entry-night-avoid]')).toHaveText(fr?/^Utiliser 0,\d+ % \(sans étape de nuit\)$/:/^Use 0\.\d+% \(no night steps\)$/);
  await expect(night.locator('[data-entry-night-keep]')).toHaveText(fr?'Garder 0,14 %':'Keep 0.14%');
  await expect(night.locator('.bh-apply-plan')).toHaveCount(0);
  const text=await night.locator('p').textContent();
  await shot(page,`o1-line-${locale}`,night);
  await night.locator('[data-entry-night-keep]').tap();
  await update(page,fr);
  const s=await stored(page);
  expect(s.yeastPctOverride).toBe(0.14);
  // The steps in the baker's night are covered in the saved blocks: the plan is complete as saved.
  expect(s.blocks.filter(b=>b.label.endsWith(' night')).flatMap(b=>b.coveredActions??[]).length).toBeGreaterThan(0);
  await expect(page.locator('[data-kept-night]:visible')).toHaveText(text);
  await expect(page.locator('[data-plan-clash]')).toHaveCount(0);
  await shot(page,`o1-recipe-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: O1 — other busy times stay hard (the amount that fits is offered)`,async({page})=>{
  // A busy evening Thu 8pm–Fri 10am: no plan for 0.3 %; the refusal names the busy times.
  const evening=[{label:'Dinner',from:Z('2026-11-26T19:45:00+08:00'),to:Z('2026-11-27T10:00:00+08:00')}];
  const errors=await open(page,b3({blocks:evening,startTime:Z('2026-11-27T10:00:00+08:00'),acceptedStartTime:Z('2026-11-27T10:00:00+08:00'),acceptedPreparationAt:Z('2026-11-27T10:00:00+08:00'),eatTime:Z('2026-11-27T13:00:00+08:00'),acceptedEatTime:Z('2026-11-27T13:00:00+08:00')}),locale,B3_NOW);
  const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,05':'0.05');await yeast.blur();
  await expect(ft.locator('[data-yeast-entry-issue]')).toBeVisible();
  await expect(ft.locator('[data-entry-night]')).toHaveCount(0);
  expect((await stored(page)).yeastPctOverride).toBeUndefined();
  expect(errors).toEqual([]);
 });

 test(`${locale}: picker — Nights turned on after Keep: Update recipe lands on the Recipe with the plan kept, never "No slot found"`,async({page})=>{
  const now=B3_NOW+2.25*H;
  const errors=await open(page,b3({savedAt:now,startTime:now+H/2,acceptedStartTime:now+H/2,acceptedPreparationAt:now+H/2}),locale,now);
  const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,14':'0.14');await yeast.blur();
  await ft.locator('[data-entry-night] [data-entry-night-keep]').tap();
  await update(page,fr);
  await page.getByRole('button',{name:fr?/Mes choix/:/My choices/}).last().tap();
  await page.getByRole('button',{name:fr?'Modifier : Heure de cuisson':'Edit : Bake time'}).tap();
  await page.getByRole('button',{name:fr?/^Nuits/:/^Nights/}).first().tap();
  await expect(page.locator('[data-simple-decision]')).toHaveCount(0);
  await shot(page,`picker-nights-${locale}`);
  await update(page,fr);
  const s=await stored(page);
  expect(s.protocolStale).toBe(false);
  expect(s.entryNightKept).toEqual({yeast:0.14});
  await expect(page.getByText(fr?/Aucun créneau/:/No slot found/)).toHaveCount(0);
  await expect(page.getByText(fr?'Vous avez modifié vos choix.':'You changed your choices.')).toHaveCount(0);
  await shot(page,`picker-recipe-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 2 — a biga chosen from My choices runs the doesn't-fit check: the sheet, never a biga in the past`,async({page})=>{
  const errors=await open(page,thomas(),locale,T_NOW,{activeStep:7,advancedStep:8,setupOverview:false,activeTab:'setup'});
  await page.getByText('Biga',{exact:true}).first().tap();
  const sheet=page.locator('[data-preferment-too-close]');
  await expect(sheet).toBeVisible({timeout:20000});
  await expect(sheet.locator('[data-preferment-fallback="none"]')).toBeVisible();
  await expect(page.locator('[data-bh-forward]:visible')).toBeDisabled();
  await shot(page,`2-biga-sheet-${locale}`,sheet);
  // No plan was saved with a preferment before now.
  const s=await stored(page);
  expect(s.startTime-(s.prefOffsetH??0)*H).toBeGreaterThan(T_NOW);
  await sheet.locator('[data-preferment-fallback="none"]').tap();
  await expect(sheet).toHaveCount(0);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 4 — the time editor offers the nearest bake that fits; "Change my busy times" only for busy times`,async({page})=>{
  // Wei Ling: 31 °C, no busy times, Sat 10:00; the bake moved to 3:30pm leaves 5 h for an 8 h dough.
  const now=Z('2026-11-28T10:00:00+08:00'),bake=Z('2026-11-28T15:30:00+08:00'),mix=Z('2026-11-28T10:30:00+08:00');
  const errors=await open(page,{...b3({kitchenTemp:31,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=31','mixer=hand']}),savedAt:now,startTime:mix,acceptedStartTime:mix,acceptedPreparationAt:mix,eatTime:Z('2026-11-28T19:30:00+08:00'),acceptedEatTime:Z('2026-11-28T19:30:00+08:00'),advancedStep:9},locale,now,{activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>window.dispatchEvent(new Event('touchmove')));
  // Set the bake to 3:30pm through the session (the picker re-reads it) and open the plan.
  const s0=await stored(page);
  await page.evaluate(([d,bake])=>{localStorage.setItem('bh_session_v1',JSON.stringify({...d,eatTime:bake}));},[s0,bake]);
  await page.reload();
  await page.waitForTimeout(2500);
  const ways=page.locator('[data-simple-accept], .bh-target-choices button');
  await expect(ways.first()).toBeVisible({timeout:30000});
  await expect(page.locator('[data-decision-availability]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:fr?'Modifier mes moments occupés':'Change my busy times'})).toHaveCount(0);
  await shot(page,`4-time-editor-${locale}`,ways.first());
  expect(errors).toEqual([]);
 });

 test(`${locale}: 7 — Update recipe after a yeast-type change lands on the Recipe`,async({page})=>{
  const errors=await open(page,b3({advancedStep:7}),locale,B3_NOW,{activeStep:7,advancedStep:7,setupOverview:false,activeTab:'setup'});
  await page.getByText(fr?/^Levure fraîche$/:/^Fresh yeast$/).first().tap();
  await update(page,fr);
  expect((await stored(page)).yeastType).toBe('fresh');
  await expect(page.locator('[data-recipe-plan]:visible')).toHaveCount(1);
  await shot(page,`7-recipe-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: I/D2 — B3, 0.1 % at 22 °C, bake in 24 h keeps the calculated 8:30pm knead (the fridge absorbs it)`,async({page})=>{
  const errors=await open(page,b3({eatTime:B3_DINNER,acceptedEatTime:B3_DINNER,startTime:B3_DINNER_MIX,acceptedStartTime:B3_DINNER_MIX,acceptedPreparationAt:B3_DINNER_MIX}),locale,B3_NOW);
  const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,1':'0.1');await yeast.blur();
  await expect(ft.locator('[data-yeast-entry-issue]')).toHaveCount(0);
  const keep=ft.locator('[data-entry-night-keep]');
  if(await keep.count())await keep.tap();
  await update(page,fr);
  const s=await stored(page);
  log('mix',new Date(s.startTime).toISOString());
  expect(Math.abs(s.startTime-B3_DINNER_MIX)).toBeLessThanOrEqual(H);
  await expect(page.getByText(fr?/de la pousse/:/% risen/)).toHaveCount(0);
  await shot(page,`d2-recipe-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 8 — a poolish amount within its readiness band is accepted; no "Use X%" equal to the calculated amount`,async({page})=>{
  const poolish=b3({prefermentType:'poolish',poolishStorage:'room',prefOffsetH:8,eatTime:B3_DINNER,acceptedEatTime:B3_DINNER,startTime:Z('2026-11-27T12:00:00+08:00'),acceptedStartTime:Z('2026-11-27T12:00:00+08:00'),acceptedPreparationAt:Z('2026-11-27T04:00:00+08:00'),yeastType:'fresh',confirmedSettings:['oven=home_oven_standard','yeast=fresh','climate=22','mixer=hand','method=poolish']});
  const errors=await open(page,poolish,locale,B3_NOW);
  const ft=page.locator('#step-10:visible');
  const pref=ft.locator('[data-pref-yeast-override] input');
  await expect(pref).toBeVisible({timeout:30000});
  await pref.fill(fr?'0,5':'0.5');await pref.blur();
  await expect(ft.locator('[data-pref-yeast-issue]')).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).prefYeastOverride?.pct).toBeGreaterThan(0);
  await shot(page,`8-poolish-${locale}`,pref);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 8 — a biga amount with no window: the calculated amount is offered once`,async({page})=>{
  const biga=b3({prefermentType:'biga',bigaStorage:'fridge',prefOffsetH:24,prefGoesInFridge:true,eatTime:Z('2026-11-28T09:45:00+08:00'),acceptedEatTime:Z('2026-11-28T09:45:00+08:00'),startTime:Z('2026-11-27T20:00:00+08:00'),acceptedStartTime:Z('2026-11-27T20:00:00+08:00'),acceptedPreparationAt:Z('2026-11-26T20:00:00+08:00'),confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand','method=biga']});
  const errors=await open(page,biga,locale,B3_NOW);
  const ft=page.locator('#step-10:visible');
  const pref=ft.locator('[data-pref-yeast-override] input');
  await expect(pref).toBeVisible({timeout:30000});
  const auto=num(await pref.getAttribute('placeholder'));
  await pref.fill('1');await pref.blur();
  const issue=ft.locator('[data-pref-yeast-issue]');
  await expect(issue).toBeVisible();
  const suggested=issue.locator('[data-use-suggested-pref-yeast]');
  if(await suggested.count())expect(Math.abs(num(await suggested.textContent())-auto)).toBeGreaterThan(0.004);
  await expect(issue.locator('[data-use-calculated-pref-yeast]')).toHaveCount(1);
  log('auto',auto,'suggested',await suggested.count()?await suggested.textContent():null);
  await shot(page,`8-biga-${locale}`,issue);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 8 — after "Use the calculated amount" the box shows the amount the recipe uses`,async({page})=>{
  const errors=await open(page,b3({eatTime:B3_DINNER,acceptedEatTime:B3_DINNER,startTime:B3_DINNER_MIX,acceptedStartTime:B3_DINNER_MIX,acceptedPreparationAt:B3_DINNER_MIX}),locale,B3_NOW);
  const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  const before=num(await yeast.getAttribute('placeholder'));
  await yeast.fill(fr?'0,3':'0.3');await yeast.blur();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(0.3);
  await update(page,fr);
  await page.getByRole('button',{name:fr?/Mes choix/:/My choices/}).last().tap();
  await page.getByRole('button',{name:fr?'Modifier : Pâte':'Edit : Dough'}).tap();
  const again=await fineTune(page);
  await again.locator('[data-ft-use-calculated-yeast]').first().tap();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeUndefined();
  const shown=num(await again.locator('[data-yeast-override] input').getAttribute('placeholder'));
  expect(shown).toBe(before);
  await update(page,fr);
  // The recipe uses the amount the box showed.
  const body=await page.locator('body').innerText();
  const pct=num(body.match(fr?/Levure sèche instantanée[^%]*?(\d+[.,]\d+)\s?%/:/Instant dry yeast[^%]*?(\d+[.,]\d+)\s?%/)[1]);
  // Back on Fine-tune, the box shows the amount this recipe uses.
  await page.getByRole('button',{name:fr?/Mes choix/:/My choices/}).last().tap();
  await page.getByRole('button',{name:fr?'Modifier : Pâte':'Edit : Dough'}).tap();
  const third=await fineTune(page);
  expect(Math.abs(num(await third.locator('[data-yeast-override] input').getAttribute('placeholder'))-pct)).toBeLessThan(0.006);
  log('placeholder',shown,'before',before,'recipe',pct);
  expect(errors).toEqual([]);
 });
 test(`${locale}: 8 — a cool-spot biga's suggestion ripens in its window, as the calculated amount does`,async({page})=>{
  const biga=b3({prefermentType:'biga',bigaStorage:'cool',prefOffsetH:16,prefGoesInFridge:false,eatTime:Z('2026-11-28T09:45:00+08:00'),acceptedEatTime:Z('2026-11-28T09:45:00+08:00'),startTime:Z('2026-11-27T12:00:00+08:00'),acceptedStartTime:Z('2026-11-27T12:00:00+08:00'),acceptedPreparationAt:Z('2026-11-26T20:00:00+08:00'),confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand','method=biga']});
  const errors=await open(page,biga,locale,B3_NOW);
  const ft=page.locator('#step-10:visible');
  const pref=ft.locator('[data-pref-yeast-override] input');
  await expect(pref).toBeVisible({timeout:30000});
  await pref.fill('1');await pref.blur();
  const issue=ft.locator('[data-pref-yeast-issue]');
  await expect(issue).toBeVisible();
  const suggested=issue.locator('[data-use-suggested-pref-yeast]');
  // 0.48 % (held 12 h) was offered beside an automatic 0.17 %; the offer now ripens within 12–20 h (≤ 0.25 %).
  if(await suggested.count())expect(num(await suggested.textContent())).toBeLessThanOrEqual(0.25);
  log('suggested',await suggested.count()?await suggested.textContent():null);
  await shot(page,`8-cool-${locale}`,issue);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 8 — the "back to the calculated yeast" line ends with the recipe it reported; a biga recipe names the chosen flour`,async({page})=>{
  const biga=b3({prefermentType:'biga',bigaStorage:'fridge',prefOffsetH:24,prefGoesInFridge:true,prefYeastOverride:{type:'biga',pct:0.5},flourBlend:{flour1:'pizza00',flour2:null,ratio1:100,brandProduct:'Le 5 Stagioni Oro'},eatTime:Z('2026-11-28T19:30:00+08:00'),acceptedEatTime:Z('2026-11-28T19:30:00+08:00'),startTime:Z('2026-11-27T19:30:00+08:00'),acceptedStartTime:Z('2026-11-27T19:30:00+08:00'),acceptedPreparationAt:Z('2026-11-26T19:45:00+08:00'),confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand','method=biga'],advancedStep:8});
  const errors=await open(page,biga,locale,B3_NOW,{activeStep:7,advancedStep:8,setupOverview:false,activeTab:'setup'});
  await page.locator('[data-biga-storage-option="auto"]').tap();
  await expect(page.locator('[data-pref-yeast-cleared]:visible')).toHaveCount(1);
  await update(page,fr);
  await expect(page.locator('[data-recipe-stages]:visible')).toContainText('Le 5 Stagioni Oro');
  await shot(page,`8-flour-${locale}`,page.locator('[data-recipe-stages]:visible'));
  await page.getByRole('button',{name:fr?/Mes choix/:/My choices/}).last().tap();
  await page.getByRole('button',{name:fr?'Modifier : Pâte':'Edit : Dough'}).tap();
  await fineTune(page).catch(()=>{});
  await expect(page.locator('[data-pref-yeast-override]:visible')).toHaveCount(1,{timeout:30000});
  await expect(page.locator('[data-pref-yeast-cleared]:visible')).toHaveCount(0);
  expect(errors).toEqual([]);
 });
}
