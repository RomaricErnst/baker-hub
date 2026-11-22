const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
require('../load-production.cjs');
const py=require('../../app/utils/prefermentYeast.ts');

// A baker-entered poolish or biga yeast (20 Nov 2026 round 7): % of the preferment's own flour, "Auto"
// until typed; an amount re-times the preferment window (the yeast model read backwards), one that no
// window can take is said once, unapplied, with the calculated amount offered.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T09:00:00+08:00');
const BAKE=Date.parse('2026-10-06T19:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));

async function openFineTune(page,locale,type,extra={}){
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:20,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:type,prefermentFlourPct:type==='biga'?40:25,prefOffsetH:type==='biga'?30:13,prefGoesInFridge:type==='biga',poolishStorage:type==='poolish'?'room':undefined,flourInFridge:false,startTime:BAKE-24*3600000,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('pref-yeast-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('pref-yeast-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 await expect(page.getByRole('region',{name:locale==='fr'?'Vos moments clés':'Your key times',exact:true})).toBeVisible({timeout:20000});
 // A restored plan keeps its saved poolish/biga window (13 h / 30 h here) until something re-plans it.
 const automatic=(await stored(page)).prefOffsetH;
 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:locale==='fr'?'Étape précédente':'Previous step',exact:true}).tap();
 const fineTune=page.locator('#step-10:visible');
 await expect(fineTune.locator('[data-pref-yeast-override] input')).toBeVisible();
 return {fineTune,automatic};
}

const L=(fr,en,frText)=>fr?frText:en;
for(const locale of ['en','fr'])test(`${locale}: an entered poolish yeast re-times the poolish; both boxes read "· auto" until typed`,async({page})=>{
 const fr=locale==='fr';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {fineTune,automatic}=await openFineTune(page,locale,'poolish');
 const pref=fineTune.locator('[data-pref-yeast-override] input'),final=fineTune.locator('[data-yeast-override] input');
 await expect(fineTune.locator('[data-yeast-heading]')).toHaveText(L(fr,'Yeast · instant dry','Levure · instantanée'));
 await expect(fineTune.locator('[data-pref-yeast-override] [data-finetune-row] [data-finetune-label]')).toHaveText(L(fr,'In the poolish','Dans le poolish'));
 await expect(fineTune.locator('[data-yeast-override] [data-finetune-label]')).toHaveText(L(fr,'In the final dough','Dans la pâte finale'));
 for(const box of [pref,final]){await expect(box).toHaveValue('');await expect(box).toHaveAttribute('placeholder',fr?/^0,\d+ · auto$/:/^0\.\d+ · auto$/);}
 await expect(pref).toHaveAttribute('aria-label',L(fr,'Poolish yeast, % of the poolish flour, instant dry','Levure du poolish, % de la farine du poolish, levure sèche instantanée'));
 await expect(fineTune.getByText(L(fr,'We calculate both for your plan. Enter your own and the timing follows; the poolish amount is a % of its own flour.','Nous les calculons pour votre planning. Saisissez les vôtres, les horaires suivent ; celle du poolish est en % de sa propre farine.'),{exact:true})).toBeVisible();
 // 0.15 % (a 0.1 % poolish at 20 °C lands within a quarter hour of the planner's own window).
 await pref.fill('0.15');await pref.blur();
 await expect.poll(async()=>(await stored(page)).prefYeastOverride).toEqual({type:'poolish',pct:0.15});
 await expect(fineTune.locator('[data-pref-yeast-override] [data-unit-suffix]')).toHaveText('%');
 await fineTune.locator('[data-pref-yeast-override]').locator('..').screenshot({path:test.info().outputPath(`poolish-yeast-${locale}.png`)});
 // The window the model gives 0.15 % at 20 °C (about 7.5 h), not the planner's own.
 const expected=py.prefermentYeastTiming('poolish',0.15,false,{kitchenTemp:20,fridgeTemp:6,massG:py.prefermentMassG('poolish',1040,undefined,25)});
 await fineTune.locator('[data-bh-forward]').tap();
 await expect.poll(async()=>(await stored(page)).prefOffsetH,{timeout:20000}).toBeGreaterThanOrEqual(expected.min);
 const timed=(await stored(page)).prefOffsetH;
 expect(timed).toBeLessThanOrEqual(expected.max);
 expect(Math.abs(timed-expected.hours)).toBeLessThanOrEqual(0.5);
 expect(timed).not.toBe(automatic);
 expect((await stored(page)).eatTime).toBe(BAKE);
 // Back on Fine-tune the entered amount is kept; the calculated amount restores the planner's window.
 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:fr?'Étape précédente':'Previous step',exact:true}).tap();
 // Round 8 (bug 2): shown with the locale's separator.
 await expect(pref).toHaveValue(fr?'0,15':'0.15');
 await fineTune.locator('[data-pref-yeast-reset]').tap();
 await expect.poll(async()=>(await stored(page)).prefYeastOverride).toBeUndefined();
 await fineTune.locator('[data-bh-forward]').tap();
 // The planner's own window again (no longer the entered amount's).
 await expect.poll(async()=>Math.abs((await stored(page)).prefOffsetH-timed),{timeout:20000}).toBeGreaterThan(0.25);
 expect(errors).toEqual([]);
});

for(const locale of ['en','fr'])test(`${locale}: biga yeast — 1 % ripens too fast for a fridge biga and is not applied; 0.5 % re-times it`,async({page})=>{
 const fr=locale==='fr';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {fineTune,automatic}=await openFineTune(page,locale,'biga');
 const pref=fineTune.locator('[data-pref-yeast-override] input');
 await expect(fineTune.locator('[data-pref-yeast-override] [data-finetune-row] [data-finetune-label]')).toHaveText(L(fr,'In the biga','Dans la biga'));
 await pref.fill('1');await pref.blur();
 const note=fineTune.locator('[data-pref-yeast-issue]');
 await expect(note).toHaveText(fr
  // One biga window per storage (S5); at 20 °C 'auto' may also use the cool spot (D1, round 8).
  // Round 9 (S2): the hours name where they apply, and an amount that fits is offered.
  ?/^1 % dans la biga mûrit en environ [\d,]+ h au frigo ; une biga demande 24 à 58 h au frigo ou 12 à 20 h dans un endroit frais\.( 0,\d+ % convient\.Utiliser 0,\d+ %)?Utiliser la quantité calculée$/
  :/^1% in the biga ripens in about [\d.]+ h in the fridge; a biga takes 24–58 h in the fridge or 12–20 h in a cool spot\.( 0\.\d+% fits\.Use 0\.\d+%)?Use the calculated amount$/);
 await expect(pref).toHaveValue('1');
 expect((await stored(page)).prefYeastOverride).toBeUndefined();
 await expect(fineTune.locator('[data-bh-forward]')).toBeDisabled();
 await fineTune.locator('[data-pref-yeast-override]').locator('..').screenshot({path:test.info().outputPath(`biga-yeast-issue-${locale}.png`)});
 await note.locator('[data-use-calculated-pref-yeast]').tap();
 await expect(note).toHaveCount(0);
 await expect(pref).toHaveValue('');
 await expect(fineTune.locator('[data-bh-forward]')).toBeEnabled();
 // 0.5 %: about 23 h in a 6 °C fridge (the engine itself gives a 24 h biga about that dose).
 await pref.fill('0.5');await pref.blur();
 await expect.poll(async()=>(await stored(page)).prefYeastOverride).toEqual({type:'biga',pct:0.5});
 const expected=py.prefermentYeastTiming('biga',0.5,true,{kitchenTemp:20,fridgeTemp:6,massG:py.prefermentMassG('biga',1040,undefined,40)});
 await fineTune.locator('[data-bh-forward]').tap();
 await expect.poll(async()=>Math.abs((await stored(page)).prefOffsetH-expected.hours),{timeout:20000}).toBeLessThanOrEqual(0.5);
 expect((await stored(page)).prefOffsetH).not.toBe(automatic);
 await page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true}).screenshot({path:test.info().outputPath(`biga-yeast-plan-${locale}.png`)});
 expect(errors).toEqual([]);
});

test('the final dough of a poolish takes an entered amount and the mix moves with it',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {fineTune}=await openFineTune(page,'en','poolish');
 const before=(await stored(page)).startTime;
 const final=fineTune.locator('[data-yeast-override] input');
 const auto=Number((await final.getAttribute('placeholder')).match(/^([\d.]+) · auto$/)[1]);
 // Round 11 (D2): up to the readiness band the fridge absorbs an amount at the calculated knead; four times the yeast cannot be absorbed.
 await final.fill(String(Math.round(auto*4*1000)/1000));await final.blur();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeGreaterThan(0);
 await expect(fineTune.getByText('The final dough follows its amount: less yeast, longer rise.',{exact:false})).toBeVisible();
 await fineTune.locator('[data-bh-forward]').tap();
 // Four times the yeast: a shorter dough, so a later mix for the same bake.
 await expect.poll(async()=>(await stored(page)).startTime-before,{timeout:20000}).toBeGreaterThan(2*3600000);
 expect((await stored(page)).eatTime).toBe(BAKE);
 expect(errors).toEqual([]);
});
