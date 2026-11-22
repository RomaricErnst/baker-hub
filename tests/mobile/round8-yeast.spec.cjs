const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 8 (21 Nov 2026): the baker-entered yeast in Custom Fine-tune (FINDINGS "Baker-set yeast").
// Thomas: 4 baguettes, 20 °C, bake Sat 28 Nov 11:30, busy weekdays 9:00–18:00 and nights 23:00–7:00; the
// calculated plan kneads Fri 18:15 with a fridge night. B3: 4 Neapolitan pizzas, 22 °C, bake in 24 h.
// D2: an entered amount keeps the knead near the calculated plan's and the fridge absorbs the difference;
// an amount that leaves no plan clear of the busy times (or no time) is said on Fine-tune with the nearest
// amount that gives one (bugs 3, 6, 7; M2), never "choose a later start / change my busy times".
const Z=s=>Date.parse(s);
const H=3600000;
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({timezoneId:'Asia/Singapore',actionTimeout:20000});
test.setTimeout(120000);

const NOW=Z('2026-11-26T20:00:00+08:00');
const BAKE=Z('2026-11-28T11:30:00+08:00');
const CALC_MIX=Z('2026-11-27T18:15:00+08:00');
const thomasBlocks=()=>{
 const blocks=[];
 for(const day of ['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27'])
  blocks.push({label:'Work · '+day,from:Z(day+'T09:00:00+08:00'),to:Z(day+'T18:00:00+08:00')});
 for(const day of ['2026-11-25','2026-11-26','2026-11-27'])blocks.push({label:day+' night',from:Z(day+'T23:00:00+08:00'),to:Z(day+'T23:00:00+08:00')+8*H});
 return blocks;
};
const thomas=(extra={})=>({version:1,savedAt:NOW,tab:'custom',bakeType:'bread',bakeName:'',styleKey:'baguette',numItems:4,itemWeight:320,ovenType:'home_oven_standard',
 mixerType:'hand',yeastType:'instant',humidity:'normal',fridgeTemp:6,kitchenTemp:20,flourBlend:{flour1:'bread',flour2:null,ratio1:100},flourChosen:true,
 prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,prefermentChosen:true,
 customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=20','mixer=hand'],
 startTime:CALC_MIX,eatTime:BAKE,acceptedStartTime:CALC_MIX,acceptedPreparationAt:CALC_MIX,acceptedEatTime:BAKE,blocks:thomasBlocks(),
 activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra});

async function open(page,data,locale='en',now=NOW){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(now);
 await page.addInitScript(([data])=>{
  if(!sessionStorage.getItem('r8-seeded')){localStorage.clear();localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('r8-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:data.activeStep,advancedStep:data.advancedStep,setupOverview:false,activeTab:'setup'}));
 },[data]);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 const fineTune=page.locator('#step-10:visible');
 await expect(fineTune.locator('[data-yeast-override] input')).toBeVisible({timeout:20000});
 return {fineTune,errors};
}
const num=text=>Number(String(text).match(/\d+(?:[.,]\d+)?/)[0].replace(',','.'));
// Mobile WebKit has no wheel: mark the reader's scroll so usePageTop leaves the page where the test puts it.
const shot=async(page,name,target)=>{
 if(target){await page.evaluate(()=>window.dispatchEvent(new Event('touchmove')));await target.evaluate(el=>el.scrollIntoView({block:'center'}));}
 await page.screenshot({path:test.info().outputPath(`${name}.png`)});
};
const log=(...parts)=>console.log('[r8]',test.info().title.slice(0,40),...parts);
/** Update recipe from Fine-tune and wait until the regenerated plan is saved. */
async function update(page,fineTune,fr){
 await fineTune.getByRole('button',{name:fr?'Mettre à jour la recette':'Update recipe',exact:true}).tap();
 await expect.poll(async()=>{const s=await stored(page);return s.recipeGenerated&&!s.protocolStale&&s.acceptedStartTime===s.startTime;},{timeout:30000}).toBe(true);
}

for(const locale of ['en','fr']){
 const fr=locale==='fr';
 test(`${locale}: Thomas, a little more or less yeast keeps the Friday-evening knead (D2)`,async({page})=>{
  const {fineTune,errors}=await open(page,thomas(),locale);
  const yeast=fineTune.locator('[data-yeast-override] input');
  const calc=num(await yeast.getAttribute('placeholder'));
  // About a tenth more: the fridge absorbs it, the knead stays near 18:15.
  const more=Math.round(calc*1.1*100)/100;
  await yeast.fill(fr?String(more).replace('.',','):String(more));await yeast.blur();
  await expect(fineTune.locator('[data-yeast-entry-issue]')).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(more);
  expect((await stored(page)).yeastAnchorH).toBe((BAKE-CALC_MIX)/H);
  await update(page,fineTune,fr);
  const s=await stored(page);
  expect(Math.abs(s.startTime-CALC_MIX)).toBeLessThanOrEqual(H);
  expect(s.eatTime).toBe(BAKE);
  log('entered',more,'calc',calc,'mix',new Date(s.startTime).toISOString());
  await shot(page,`thomas-more-${locale}`);
  expect(errors).toEqual([]);
 });

 test(`${locale}: Thomas, 0.3 % rises too fast for his busy times: the nearest amount that fits, then a Friday plan (bugs 3, 7)`,async({page})=>{
  const {fineTune,errors}=await open(page,thomas(),locale);
  const yeast=fineTune.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,3':'0.3');await yeast.blur();
  // Round 11 (decision O1): the steps it puts in Thomas's nights are named, never refused; the nearest amount
  // without night steps is the offer (it was "every plan runs into your busy times. 0.25% fits.").
  await expect(fineTune.locator('[data-yeast-entry-issue]')).toHaveCount(0);
  const note=fineTune.locator('[data-entry-night]');
  await expect(note.locator('p')).toHaveText(fr?/^Ce planning a /:/^This plan has /);
  await expect(note.getByRole('button')).toHaveText([fr?/^Utiliser 0,\d+ % \(sans étape de nuit\)$/:/^Use 0\.\d+% \(no night steps\)$/,fr?'Garder 0,3 %':'Keep 0.3%']);
  await expect(fineTune.locator('[data-yeast-helper]')).toHaveCount(0);
  await shot(page,`thomas-03-${locale}`,note);
  const offer=note.locator('[data-entry-night-avoid]');
  const suggested=num(await offer.textContent());
  expect(suggested).toBeLessThan(0.3);
  await offer.tap();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(suggested);
  await update(page,fineTune,fr);
  const s=await stored(page);
  // Kneaded Friday evening after work, before the night: no clash sheet.
  expect(s.startTime).toBeGreaterThanOrEqual(Z('2026-11-27T18:00:00+08:00'));
  expect(s.startTime).toBeLessThanOrEqual(Z('2026-11-27T20:00:00+08:00'));
  await expect(page.locator('.bh-plan-sheet,[data-decision-sheet]').filter({visible:true})).toHaveCount(0);
  log('0.3 → use',suggested,'mix',new Date(s.startTime).toISOString());
  expect(errors).toEqual([]);
 });

 test(`${locale}: Thomas, 0.03 % is too slow for the time left: said in baker time, with the amount that fits`,async({page})=>{
  const {fineTune,errors}=await open(page,thomas(),locale);
  const yeast=fineTune.locator('[data-yeast-override] input');
  // Round 9 (bug I): 0.1 % now plans at room temperature within the time left; 0.03 % is too slow even so.
  await yeast.fill(fr?'0,03':'0.03');await yeast.blur();
  const note=fineTune.locator('[data-yeast-entry-issue]');
  await expect(note).toHaveAttribute('data-reason','time');
  // Baker time and the locale's separator (S2): "needs about 59 h; your bake is in 39 h" / « 59 h ».
  await expect(note.locator('p')).toHaveText(fr?/^0,03 % demande (environ \d+ h|plus de 96 h) ; votre cuisson est dans \d+ h\. 0,\d+ % convient\.$/:/^0\.03% needs (about \d+ h|more than 96 h); your bake is in \d+ h\. 0\.\d+% fits\.$/);
  await expect(note.locator('[data-yeast-change-bake]')).toBeVisible();
  await shot(page,`thomas-01-${locale}`,note);log(await note.locator('p').textContent());
  expect(errors).toEqual([]);
 });

 test(`${locale}: Thomas, fresh yeast 0.5 %: checked in fresh yeast before the plan moves (bug 6)`,async({page})=>{
  const {fineTune,errors}=await open(page,thomas({yeastType:'fresh',confirmedSettings:['oven=home_oven_standard','yeast=fresh','climate=20','mixer=hand']}),locale);
  const yeast=fineTune.locator('[data-yeast-override] input');
  await yeast.fill(fr?'0,5':'0.5');await yeast.blur();
  const note=fineTune.locator('[data-yeast-entry-issue]');
  if(await note.count()){
   // An amount problem gets the amount's answers, in fresh yeast (0.5 %, not its instant equivalent).
   await expect(note.locator('p')).toContainText(fr?'0,5 %':'0.5%');
   await expect(note.getByText(/busy times|later start|moments occupés|départ plus tardif/).filter({has:page.locator('button')})).toHaveCount(0);
   await shot(page,`thomas-fresh05-${locale}`,note);log(await note.locator('p').textContent());
   const offer=note.locator('[data-use-minimum-yeast]');
   await expect(offer).toBeVisible();
   await offer.tap();
  }
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeGreaterThan(0);
  await update(page,fineTune,fr);
  const s=await stored(page);
  // The applied amount gives a plan clear of Thomas's busy times: no clash sheet, a future knead.
  expect(s.startTime).toBeGreaterThan(NOW);
  await expect(page.locator('.bh-plan-sheet,[data-decision-sheet]').filter({visible:true})).toHaveCount(0);
  log('fresh: override IDY',s.yeastPctOverride,'mix',new Date(s.startTime).toISOString());
  expect(errors).toEqual([]);
 });

 test(`${locale}: clearing the box restores the calculated amount (bug 1)`,async({page})=>{
  const {fineTune,errors}=await open(page,thomas(),locale);
  const yeast=fineTune.locator('[data-yeast-override] input');
  // The bar's way on: "Update recipe" while a typed amount waits, else "Back to Recipe".
  const forward=fineTune.getByRole('button',{name:fr?/^(Mettre à jour la recette|Retour à la recette)$/:/^(Update recipe|Back to Recipe)$/});
  // A statement, then an empty box: the statement goes and the way on is open again (round 11: 0.03 %, too slow;
  // 0.3 % is planned since decision O1, its night steps named).
  await yeast.fill(fr?'0,03':'0.03');await yeast.blur();
  await expect(fineTune.locator('[data-yeast-entry-issue]')).toBeVisible();
  await expect(forward).toBeDisabled();
  await yeast.fill('');await yeast.blur();
  await expect(fineTune.locator('[data-yeast-entry-issue]')).toHaveCount(0);
  await expect(forward).toBeEnabled();
  // An applied amount, then an empty box: the calculated amount is back.
  const calc=num(await yeast.getAttribute('placeholder'));
  const more=Math.round(calc*1.1*100)/100;
  await yeast.fill(String(more));await yeast.blur();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(more);
  await fineTune.locator('[data-yeast-override] input').fill('');await fineTune.locator('[data-yeast-override] input').blur();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeUndefined();
  expect((await stored(page)).yeastAnchorH).toBeUndefined();
  await expect(fineTune.locator('[data-yeast-override] input')).toHaveValue('');
  await expect(fineTune.locator('[data-yeast-override] input')).toHaveAttribute('placeholder',new RegExp(`^${String(calc).replace('.',fr?',':'\\.')} · auto$`));
  expect(errors).toEqual([]);
 });

 test(`${locale}: Thomas with a poolish: 0.1 % of the poolish flour, shown as typed (S1)`,async({page})=>{
  const {fineTune,errors}=await open(page,thomas({prefermentType:'poolish',prefOffsetH:12,prefGoesInFridge:false,prefermentFlourPct:30,startTime:CALC_MIX,acceptedStartTime:CALC_MIX,acceptedPreparationAt:CALC_MIX-12*H}),locale);
  const poolish=fineTune.locator('[data-pref-yeast-override] input');
  await poolish.fill(fr?'0,1':'0.1');await poolish.blur();
  const issue=fineTune.locator('[data-pref-yeast-issue]');
  if(await issue.count()){
   // Said with the amount's own answers.
   await expect(issue.getByRole('button',{name:fr?'Utiliser la quantité calculée':'Use the calculated amount'})).toBeVisible();
   await shot(page,`poolish-01-issue-${locale}`,issue);log(await issue.locator('p').textContent());
   const offer=issue.locator('[data-use-suggested-pref-yeast]');
   if(await offer.count())await offer.tap();else await issue.getByRole('button',{name:fr?'Utiliser la quantité calculée':'Use the calculated amount'}).tap();
  }else{
   await expect.poll(async()=>(await stored(page)).prefYeastOverride?.pct).toBe(0.1);
  }
  await expect(poolish).toHaveValue(/^(0[.,]\d+)?$/);
  // The final dough's own amount runs the same checks (bug 6): applied, or said with the amount's answers.
  const final=fineTune.locator('[data-yeast-override] input');
  await final.fill(fr?'0,3':'0.3');await final.blur();
  const finalIssue=fineTune.locator('[data-yeast-entry-issue]');
  if(await finalIssue.count()){
   await expect(finalIssue.locator('[data-yeast-change-bake]')).toHaveCount((await finalIssue.getAttribute('data-reason'))==='time'?1:0);
   await shot(page,`poolish-final-issue-${locale}`,finalIssue);log(await finalIssue.locator('p').textContent());
   const offer=finalIssue.locator('[data-use-minimum-yeast]');
   if(await offer.count())await offer.tap();else await final.fill('');
   await final.blur();
  }
  await expect(finalIssue).toHaveCount(0);
  await update(page,fineTune,fr);
  const s=await stored(page);
  expect(s.startTime).toBeGreaterThan(NOW);
  // The recipe shows the poolish yeast as a share of the poolish flour, as typed (S1).
  if(s.prefYeastOverride){
   const share=page.locator('[data-pref-own-share]:visible').first();
   await expect(share).toHaveText(fr?/^0,1 % de la farine du poolish/:/^0\.1% of the poolish flour/);
   await shot(page,`poolish-recipe-${locale}`,share);
  }
  log('poolish',JSON.stringify(s.prefYeastOverride),'final',s.yeastPctOverride,'mix',new Date(s.startTime).toISOString());
  expect(errors).toEqual([]);
 });
}

for(const locale of ['en','fr'])test(`${locale}: B3, 0.03 % at 22 °C, bake in 24 h: the statement and the plan read the same paths (M2)`,async({page})=>{
 const fr=locale==='fr';
 const now=Z('2026-11-26T19:30:00+08:00'),bake=Z('2026-11-27T19:30:00+08:00'),mix=Z('2026-11-27T07:00:00+08:00');
 const data={version:1,savedAt:now,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,
  startTime:mix,eatTime:bake,acceptedStartTime:mix,acceptedPreparationAt:mix,acceptedEatTime:bake,blocks:[],recipeGenerated:true,protocolStale:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand'],activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 const {fineTune,errors}=await open(page,data,locale,now);
 const yeast=fineTune.locator('[data-yeast-override] input');
 // Round 9 (bug I): 0.1 % plans at room temperature within the day (round9-yeast.spec); 0.03 % needs longer.
 await yeast.fill(fr?'0,03':'0.03');await yeast.blur();
 const note=fineTune.locator('[data-yeast-entry-issue]');
 await expect(note).toHaveAttribute('data-reason','time');
 await expect(note.locator('p')).toHaveText(fr?/^0,03 % demande (environ \d+ h|plus de 96 h) ; votre cuisson est dans \d+ h\. 0,\d+ % convient\.$/:/^0\.03% needs (about \d+ h|more than 96 h); your bake is in \d+ h\. 0\.\d+% fits\.$/);
 await shot(page,`b3-01-${locale}`,note);log(await note.locator('p').textContent());
 const offer=note.locator('[data-use-minimum-yeast]');
 const suggested=num(await offer.textContent());
 await offer.tap();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(suggested);
 await update(page,fineTune,fr);
 // The suggestion gives a plan in the time left, without a clash sheet.
 const s=await stored(page);
 expect(s.startTime).toBeGreaterThan(now);
 expect(s.eatTime).toBe(bake);
 await expect(page.locator('.bh-plan-sheet,[data-decision-sheet]').filter({visible:true})).toHaveCount(0);
 log('0.03 → use',suggested,'mix',new Date(s.startTime).toISOString());
 expect(errors).toEqual([]);
});
