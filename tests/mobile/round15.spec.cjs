const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 15 (23 Nov 2026, owner decision O2): an entered amount's plan is built from scratch from the current inputs, the same
// Use/Keep line wherever it can be saved or seen, Keep remembered as "keep the night steps for this amount".
// B3: 4 Neapolitan pizzas, 22 °C, Nights, clock Thu 7:30pm, 0.15 % entered. Hours are read in Asia/Singapore (the bake's
// zone), never in the runner's (the CI runner is UTC).
const Z=s=>Date.parse(s);
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({timezoneId:'Asia/Singapore',actionTimeout:20000});
test.setTimeout(150000);

const NOW=Z('2026-11-26T19:30:00+08:00'),DINNER=Z('2026-11-27T19:30:00+08:00'),MIX=Z('2026-11-26T20:30:00+08:00');
const nights=[{label:'Thursday night',from:Z('2026-11-26T23:00:00+08:00'),to:Z('2026-11-27T07:00:00+08:00')},
 {label:'Friday night',from:Z('2026-11-27T23:00:00+08:00'),to:Z('2026-11-28T07:00:00+08:00')}];
// 0.15 % entered for Fri 7:30pm: kneaded Thu 8:30pm, no night step.
const b3={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,
 yeastPctOverride:0.15,startTime:MIX,eatTime:DINNER,acceptedStartTime:MIX,acceptedPreparationAt:MIX,acceptedEatTime:DINNER,blocks:nights,recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand','method=none'],activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'plan'};

async function open(page,data,locale){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('r15-seeded')){localStorage.clear();localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('r15-seeded','1');}
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 return errors;
}
const hour=ms=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms));
const shot=(page,name)=>page.screenshot({path:test.info().outputPath(`${name}.png`)});

for(const locale of ['en','fr']){
 const fr=locale==='fr';

 test(`${locale}: the time editor and Preparation carry the same Use/Keep line; the bake moved back plans as if typed there`,async({page})=>{
  const errors=await open(page,b3,locale);
  await page.getByRole('button',{name:/ingrédients|ingredients/i}).first().tap();
  await expect(page.getByRole('button',{name:fr?'Ajuster les horaires':'Adjust timing',exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:fr?'Ajuster les horaires':'Adjust timing',exact:true}).tap();
  const bake=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time');
  await expect(bake).toBeVisible({timeout:30000});
  // Lunch: 0.15 % shapes at 3:00am. The editor names those steps with the choice before anything is kept (item 1).
  await bake.fill('2026-11-27T11:30');
  await expect.poll(async()=>hour((await stored(page)).startTime),{timeout:30000}).toBe('Thu 20:00');
  const editor=page.locator('[data-entry-night-where="editor"]:visible');
  await expect(editor).toHaveCount(1,{timeout:30000});
  await expect(editor).toContainText(fr?/Ce planning a/:/This plan has/);
  await expect(editor.locator('[data-entry-night-keep]')).toHaveText(fr?'Garder 0,15 %':'Keep 0.15%');
  // No filled button in the line: both ways are the baker's.
  await expect(editor.locator('.bh-apply-plan')).toHaveCount(0);
  await editor.scrollIntoViewIfNeeded();
  await shot(page,`editor-line-${locale}`);
  await editor.locator('[data-entry-night-keep]').tap();
  await expect.poll(async()=>(await stored(page)).entryNightKept).toEqual({yeast:0.15});
  // Kept: the steps are still named (the editor, then Preparation), the buttons go.
  await expect(page.locator('[data-entry-night-where="editor"][data-kept-night]:visible')).toHaveCount(1);
  await expect(page.locator('[data-entry-night-where="editor"] button')).toHaveCount(0);
  await page.getByRole('button',{name:fr?'Mettre à jour la recette':'Update recipe',exact:true}).last().tap();
  // Update recipe returns to Preparation, which names the kept steps.
  const prep=page.locator('[data-entry-night-where="preparation"][data-kept-night]:visible');
  await expect(prep).toHaveCount(1,{timeout:30000});
  await prep.scrollIntoViewIfNeeded();
  await shot(page,`prep-kept-${locale}`);
  // Back to 7:30pm: planned as typing 0.15 % there (Thu 8:30pm, no night step; round 14 read Start Dough Fri 4:00am).
  await page.getByRole('button',{name:fr?'Ajuster les horaires':'Adjust timing',exact:true}).tap();
  await expect(bake).toBeVisible({timeout:30000});
  await bake.fill('2026-11-27T19:30');
  await expect.poll(async()=>hour((await stored(page)).startTime),{timeout:30000}).toBe('Thu 20:30');
  await expect(page.locator('[data-entry-night]:visible')).toHaveCount(0);
  await shot(page,`editor-dinner-${locale}`);
  expect(errors).toEqual([]);
 });
}
