const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 13 (22 Nov 2026): the time editor plans the requested bake first, D2 continuity, a method change replans, texts.
// B3: 4 Neapolitan pizzas, 22 °C, Nights, clock Thu 7:30pm, bake Fri 7:30pm; the calculated plan kneads Thu 8:30pm.
// Hours are read in Asia/Singapore (the bake's zone), never in the runner's (the CI runner is UTC).
const Z=s=>Date.parse(s);
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({timezoneId:'Asia/Singapore',actionTimeout:20000});
test.setTimeout(150000);

const NOW=Z('2026-11-26T19:30:00+08:00'),DINNER=Z('2026-11-27T19:30:00+08:00'),MIX=Z('2026-11-26T20:30:00+08:00');
const nights=[{label:'Thursday night',from:Z('2026-11-26T23:00:00+08:00'),to:Z('2026-11-27T07:00:00+08:00')},
 {label:'Friday night',from:Z('2026-11-27T23:00:00+08:00'),to:Z('2026-11-28T07:00:00+08:00')}];
const b3=(extra={})=>({version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,
 startTime:MIX,eatTime:DINNER,acceptedStartTime:MIX,acceptedPreparationAt:MIX,acceptedEatTime:DINNER,blocks:nights,recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand','method=none'],activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra});

async function open(page,data,locale,resume={activeStep:7,advancedStep:10,setupOverview:false,activeTab:'setup'}){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 await page.addInitScript(([data,resume])=>{
  if(!sessionStorage.getItem('r13-seeded')){localStorage.clear();localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('r13-seeded','1');
   if(resume)sessionStorage.setItem('bh_locale_resume',JSON.stringify(resume));}
 },[data,resume]);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 return errors;
}
async function fineTune(page){
 const ft=page.locator('#step-10:visible');
 await expect(ft.locator('[data-yeast-override] input')).toBeVisible({timeout:30000});
 await page.waitForTimeout(800);
 return ft;
}
async function update(page,fr){
 await page.getByRole('button',{name:fr?'Mettre à jour la recette':'Update recipe',exact:true}).last().tap();
 await expect(page.locator('[data-recipe-plan]:visible')).toHaveCount(1,{timeout:30000});
 await expect.poll(async()=>{const s=await stored(page);return s.recipeGenerated&&!s.protocolStale&&s.acceptedStartTime===s.startTime&&s.activeTab==='plan';},{timeout:30000}).toBe(true);
}
const hour=ms=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms));
// The plan once it has settled: the saved start unchanged for 1.5 s (a poll must never pass on a value the page holds
// for a moment; CI's slower WebKit read 'Thu 19:45' where a fast run had caught an earlier replan's 'Thu 20:00').
const settledHour=page=>{let last,since=0;return async()=>{const h=hour((await stored(page)).startTime);const t=Date.now();if(h!==last){last=h;since=t;}return t-since>=1500?h:null;};};
const shot=(page,name)=>page.screenshot({path:test.info().outputPath(`${name}.png`)});

for(const locale of ['en','fr']){
 const fr=locale==='fr';

 test(`${locale}: 3 — less yeast (0.12 %) has no night steps (round 17, O2: the room plan, Fri 7:30am)`,async({page})=>{
  const errors=await open(page,b3(),locale);const ft=await fineTune(page);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,12':'0.12');await yeast.blur();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(0.12);
  await expect(ft.locator('[data-entry-night]')).toHaveCount(0);
  // Less than the calculated amount: the helper says so.
  await expect(ft.getByText(fr?'Les horaires suivent cette quantité : moins de levure, pousse plus longue.':'Your timing follows this amount: less yeast, longer rise.',{exact:true})).toBeVisible();
  await update(page,fr);
  const s=await stored(page);
  // Round 17 (O2): fewer night steps first (Thu 8:30pm folded at 10:10pm and went into the fridge at 10:45pm).
  expect(hour(s.startTime)).toBe('Fri 07:30');
  await expect(page.locator('[data-kept-night]')).toHaveCount(0);
  await shot(page,`3-recipe-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 1 — the time editor plans the requested bake; a bake with no plan shows only the bakes that fit`,async({page})=>{
  // 0.5 % entered over the 7:30pm plan (its knead recorded 23 h before): Start Dough Fri 4:00pm.
  const fast=Z('2026-11-27T16:00:00+08:00');
  const errors=await open(page,b3({yeastPctOverride:0.5,startTime:fast,acceptedStartTime:fast,acceptedPreparationAt:fast,activeTab:'plan'}),locale,null);
  await page.getByRole('button',{name:/ingrédients|ingredients/i}).first().tap();
  await expect(page.locator('[data-recipe-plan]:visible')).toHaveCount(1,{timeout:30000});
  await page.locator('button:visible').filter({hasText:fr?/^Recette/:/^Recipe/}).first().tap();
  await page.getByRole('button',{name:fr?/^Préparation/:/^Preparation/}).first().tap();
  await page.getByRole('button',{name:fr?'Ajuster les horaires':'Adjust timing',exact:true}).tap();
  const bake=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time');
  await expect(bake).toBeVisible({timeout:30000});
  // Lunch the next day: 0.5 % fits with a 7:30am knead (round 17: entryPlan's plan; 8:00am was the search's, which
  // the page held for a moment before entryPlan's landed); the plan is shown, with no error card.
  await bake.fill('2026-11-27T11:30');
  await expect.poll(settledHour(page),{timeout:30000,intervals:[250]}).toBe('Fri 07:30');
  await expect(page.locator('.bh-plan-notice:visible')).toHaveCount(0);
  await shot(page,`1-lunch-${locale}`);
  // Tonight at 9:30pm: no plan; the bakes that fit alone (no plan drawn for it, no "past" line).
  await bake.fill('2026-11-26T21:30');
  await expect(page.locator('.bh-target-presets:visible button').first()).toBeVisible({timeout:30000});
  await expect(page.locator('#schedule-anchor-panel:visible')).toHaveCount(0);
  await expect(page.locator('.bh-plan-notice:visible')).toHaveCount(0);
  await expect(page.getByText(fr?/dans le passé/:/in the past/)).toHaveCount(0);
  await shot(page,`1-chips-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: 5 — a method change after the recipe lands on the Recipe`,async({page})=>{
  const errors=await open(page,b3({blocks:[]}),locale,{activeStep:7,advancedStep:8,setupOverview:false,activeTab:'setup'});
  // Let the restored session settle first, as fineTune() does: a tap while it restores is not a change (the last test of
  // a --repeat-each run, alone on the CPU, tapped inside that window and found no Update recipe).
  await expect(page.getByText('Poolish',{exact:true}).first()).toBeVisible({timeout:30000});
  await page.waitForTimeout(800);
  await page.getByText('Poolish',{exact:true}).first().tap();
  await update(page,fr);
  expect((await stored(page)).prefermentType).toBe('poolish');
  expect(errors).toEqual([]);
 });
}
