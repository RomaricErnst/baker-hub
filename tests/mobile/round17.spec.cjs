const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 17 (23 Nov 2026): an entered amount gets ONE plan, built from scratch from the current inputs (yeastEntry
// entryPlan, owner O2), whatever the route; the night line is built from the plan shown, with one night definition
// (hands-on steps after 22:00 and before 07:00, the same with and without the Nights chip).
// B3: 4 Neapolitan pizzas, 22 °C, Nights 23:00–07:00, clock Thu 7:30pm. Hours read in Asia/Singapore.
const Z=s=>Date.parse(s);
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({timezoneId:'Asia/Singapore',actionTimeout:20000});
test.setTimeout(180000);

const NOW=Z('2026-11-26T19:30:00+08:00'),DINNER=Z('2026-11-27T19:30:00+08:00'),LUNCH=Z('2026-11-27T11:30:00+08:00'),MIX=Z('2026-11-26T20:30:00+08:00');
const nights=[{label:'Thursday night',from:Z('2026-11-26T23:00:00+08:00'),to:Z('2026-11-27T07:00:00+08:00')},
 {label:'Friday night',from:Z('2026-11-27T23:00:00+08:00'),to:Z('2026-11-28T07:00:00+08:00')}];
const b3=(extra={})=>({version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,
 yeastPctOverride:0.14,startTime:MIX,eatTime:DINNER,acceptedStartTime:MIX,acceptedPreparationAt:MIX,acceptedEatTime:DINNER,blocks:nights,recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand','method=none'],activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'plan',...extra});

async function open(page,data,locale,resume=null){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 await page.addInitScript(([data,resume])=>{
  if(!sessionStorage.getItem('r17-seeded')){localStorage.clear();localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('r17-seeded','1');
   if(resume)sessionStorage.setItem('bh_locale_resume',JSON.stringify(resume));}
 },[data,resume]);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 return errors;
}
const hour=ms=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms));
const shot=(page,name)=>page.screenshot({path:test.info().outputPath(`${name}.png`)});
async function update(page,fr){
 await page.getByRole('button',{name:fr?'Mettre à jour la recette':'Update recipe',exact:true}).last().tap();
 await expect.poll(async()=>{const s=await stored(page);return s.recipeGenerated&&!s.protocolStale&&s.acceptedStartTime===s.startTime;},{timeout:30000}).toBe(true);
}
// Every planned step of the saved plan between 22:00 and 07:00 (exclusive edges), as the line must name them.
const nightClocks=(s,fr)=>(s.computedRecipe?.timelineSteps??[]).filter(t=>t.time&&t.id!=='bake').map(t=>new Date(t.time)).filter(d=>{const m=+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',hour12:false}).format(d)*60+d.getMinutes();return m>22*60||m<7*60;});

for(const locale of ['en','fr']){
 const fr=locale==='fr';

 test(`${locale}: finding 1 — Preparation › Adjust timing plans an entered amount as Fine-tune does (one plan, one line)`,async({page,browser})=>{
  // Route A: 0.14 % kneaded for dinner; Preparation › Adjust timing; bake Fri 11:30; Update recipe.
  const errors=await open(page,b3(),locale);
  await page.getByRole('button',{name:/ingrédients|ingredients/i}).first().tap();
  await page.getByRole('button',{name:fr?'Ajuster les horaires':'Adjust timing',exact:true}).first().tap();
  const bake=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time');
  await expect(bake).toBeVisible({timeout:30000});
  await bake.fill('2026-11-27T11:30');
  await expect.poll(async()=>(await stored(page)).eatTime,{timeout:30000}).toBe(LUNCH);
  await page.waitForTimeout(1500);
  const editorLine=page.locator('[data-entry-night-where="editor"]:visible p');
  const editorText=(await editorLine.count())?await editorLine.first().textContent():null;
  await shot(page,`f1-editor-${locale}`);
  await update(page,fr);
  const a=await stored(page);
  await shot(page,`f1-route-a-${locale}`);
  // The editor's line is the saved plan's: what it named is what Preparation names.
  const prepLine=page.locator('[data-entry-night]:visible p');
  if(editorText!==null)await expect(prepLine.first()).toHaveText(editorText);
  // No step of the saved plan sits in a busy time without being named or covered: no "during a busy time" row.
  await page.getByRole('button',{name:/ingrédients|ingredients/i}).first().tap().catch(()=>{});
  await expect(page.locator('[data-plan-busy]:visible')).toHaveCount(0);
  // Route B: the same inputs reached from Fine-tune (the bake already at lunch, 0.14 % typed there).
  const other=await browser.newContext({...test.info().project.use,timezoneId:'Asia/Singapore'});
  const page2=await other.newPage();
  const errors2=await open(page2,b3({yeastPctOverride:undefined,eatTime:LUNCH,acceptedEatTime:LUNCH,startTime:Z('2026-11-26T20:00:00+08:00'),acceptedStartTime:Z('2026-11-26T20:00:00+08:00'),acceptedPreparationAt:Z('2026-11-26T20:00:00+08:00'),activeTab:'setup'}),locale,{activeStep:7,advancedStep:10,setupOverview:false,activeTab:'setup'});
  const ft=page2.locator('#step-10:visible');
  await expect(ft.locator('[data-yeast-override] input')).toBeVisible({timeout:30000});
  await page2.waitForTimeout(800);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,14':'0.14');await yeast.blur();
  await update(page2,fr);
  const b=await stored(page2);
  await shot(page2,`f1-route-b-${locale}`);
  expect(hour(a.startTime)).toBe(hour(b.startTime));
  expect(a.eatTime).toBe(b.eatTime);
  // The line names every night step of that plan (none when it has none).
  const steps=nightClocks(a,fr);
  if(steps.length){
   const line=await page2.locator('[data-entry-night]:visible p').first().textContent();
   expect(line).toMatch(fr?/^Ce planning a /:/^This plan has /);
   // One plan, one line: route A's Preparation names the same steps as route B.
   await expect(page.locator('[data-entry-night]:visible p').first()).toHaveText(line);
  }else await expect(page2.locator('[data-entry-night]:visible')).toHaveCount(0);
  // Keep names the amount as the recipe rounds it.
  const keep=page2.locator('[data-entry-night-keep]:visible');
  if(await keep.count())await expect(keep.first()).toHaveText(fr?'Garder 0,14 %':'Keep 0.14%');
  expect([...errors,...errors2]).toEqual([]);
  await other.close();
 });

 test(`${locale}: finding 2 — Nights on: a kept 0.151 % at lunch takes the plan with no step between 23:00 and 06:00`,async({page})=>{
  const errors=await open(page,b3({yeastPctOverride:0.15,eatTime:LUNCH,acceptedEatTime:LUNCH,startTime:Z('2026-11-26T20:00:00+08:00'),acceptedStartTime:Z('2026-11-26T20:00:00+08:00'),acceptedPreparationAt:Z('2026-11-26T20:00:00+08:00'),activeTab:'setup'}),locale,{activeStep:7,advancedStep:10,setupOverview:false,activeTab:'setup'});
  const ft=page.locator('#step-10:visible');
  await expect(ft.locator('[data-yeast-override] input')).toBeVisible({timeout:30000});
  await page.waitForTimeout(800);
  const yeast=ft.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,151':'0.151');await yeast.blur();
  const keepNow=ft.locator('[data-entry-night-keep]');
  if(await keepNow.count()){await expect(keepNow).toHaveText(fr?'Garder 0,15 %':'Keep 0.15%');await keepNow.tap();}
  await update(page,fr);
  const s=await stored(page);
  const deep=(s.computedRecipe?.timelineSteps??[]).filter(t=>t.time&&t.id!=='bake').filter(t=>{const d=new Date(t.time);const m=+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',hour12:false}).format(d)*60+d.getMinutes();return m>23*60||m<6*60;});
  expect(deep.map(t=>t.id+'@'+hour(t.time))).toEqual([]);
  // Kept: one quiet line, no buttons, and it says the amount as the recipe rounds it.
  const kept=page.locator('[data-kept-night]:visible');
  if(await kept.count())await expect(kept.locator('button')).toHaveCount(0);
  await shot(page,`f2-nights-on-${locale}`);
  expect(errors).toEqual([]);
 });
}
