const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// A baker-entered yeast amount re-times the plan at the same bake time.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T09:00:00+08:00');
const BAKE=Date.parse('2026-10-04T19:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));

test('more yeast plans a later start, and the calculated amount restores the plan',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:BAKE-24*3600000,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('yeast-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('yeast-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 const plan=page.getByRole('region',{name:'Your key times',exact:true});
 await expect(plan).toBeVisible();
 await expect.poll(async()=>(await stored(page))?.startTime).toBeTruthy();
 const automatic=(await stored(page)).startTime;

 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:'Previous step',exact:true}).tap();
 const fineTune=page.locator('#step-10:visible');
 await expect(fineTune.getByRole('heading',{name:'Fine-tune your dough'})).toBeVisible();
 const yeast=fineTune.locator('[data-yeast-override] input');
 const recommended=Number(await yeast.inputValue());
 expect(recommended).toBeGreaterThan(0);
 await yeast.fill(String(Math.round(recommended*2*1000)/1000));await yeast.blur();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeGreaterThan(0);
 await expect(fineTune.getByText(/timing follows this amount/)).toBeVisible();
 await fineTune.locator('[data-yeast-override]').scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath('yeast-override.png')});

 await fineTune.locator('[data-bh-forward]').tap();
 await expect(plan).toBeVisible();
 await expect.poll(async()=>(await stored(page)).startTime-automatic,{timeout:15000}).toBeGreaterThan(3*3600000);
 expect((await stored(page)).eatTime).toBe(BAKE);
 const timed=(await stored(page)).startTime;

 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:'Previous step',exact:true}).tap();
 await fineTune.getByRole('button',{name:'Use the calculated amount'}).tap();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeUndefined();
 await fineTune.locator('[data-bh-forward]').tap();
 // The recommendation returns: an earlier start than the extra yeast allowed.
 await expect.poll(async()=>timed-(await stored(page)).startTime,{timeout:15000}).toBeGreaterThan(3*3600000);
 expect((await stored(page)).eatTime).toBe(BAKE);
 expect(errors).toEqual([]);
});

// Too little yeast for the time left: the cause in words, and a way back to
// the calculated amount.
test('a yeast amount too slow for the bake names the cause and offers the calculated amount',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const bake=NOW+58*3600000;
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:8,itemWeight:270,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:24,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:bake-24*3600000,eatTime:bake,blocks:[],recipeGenerated:true,protocolStale:true,yeastPctOverride:0.02,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('yeast-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('yeast-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await expect(page.getByText(/^0\.02% yeast needs about .*: bake later or use more yeast\.$/)).toBeVisible({timeout:20000});
 await page.locator('[data-use-calculated-yeast]').tap();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeUndefined();
 await expect(page.locator('[data-use-calculated-yeast]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

// Fine-tune checks a typed amount before applying it: an amount that cannot
// ferment before the bake stays in the field, unapplied, with the smallest
// amount that fits and a way to change the bake time.
for(const locale of ['en','fr'])test(`${locale}: a yeast amount too slow for the bake is caught on Fine-tune`,async({page})=>{
 const fr=locale==='fr';
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const bake=NOW+34*3600000;
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:8,itemWeight:270,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:24,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:bake-24*3600000,eatTime:bake,blocks:[],recipeGenerated:true,acceptedStartTime:bake-24*3600000,acceptedPreparationAt:bake-24*3600000,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('yeast-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('yeast-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:10,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 const fineTune=page.locator('#step-10:visible');
 await expect(fineTune.locator('[data-yeast-override] input')).toBeVisible({timeout:20000});
 const yeast=fineTune.locator('[data-yeast-override] input');
 await yeast.fill('0.02');await yeast.blur();
 const note=fineTune.locator('[data-yeast-entry-issue]');
 await expect(note).toHaveText(fr
  ?/^0,02 % demande environ \d+ h ; votre cuisson est dans \d+ h\. Mettez au moins 0,\d+ %, ou enfournez plus tard\.Utiliser 0,\d+ %Changer l’heure de cuisson$/
  :/^0\.02% needs about \d+ h; your bake is in \d+ h\. Use at least 0\.\d+%, or bake later\.Use 0\.\d+%Change bake time$/);
 // Not applied: the typed text stays, the plan does not move, and nobody is asked whether the dough is mixed.
 await expect(yeast).toHaveValue('0.02');
 expect((await stored(page)).yeastPctOverride).toBeUndefined();
 await expect(page.getByText(fr?'Avez-vous pétri la pâte ?':'Have you mixed the dough?',{exact:true})).toHaveCount(0);
 await expect(fineTune.locator('[data-bh-forward]')).toBeDisabled();
 await note.scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath(`yeast-entry-${locale}.png`)});

 const offer=note.locator('[data-use-minimum-yeast]');
 const minimum=Number((await offer.textContent()).match(/[\d.,]+/)[0].replace(',','.'));
 expect(minimum).toBeGreaterThan(0.02);
 await offer.tap();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBe(minimum);
 await expect(note).toHaveCount(0);
 await fineTune.getByRole('button',{name:fr?'Retour à la recette':'Back to recipe',exact:true}).tap();
 // The plan regenerates around the fitting amount, starting in the future.
 await expect.poll(async()=>{const s=await stored(page);return s.recipeGenerated&&!s.protocolStale&&s.startTime>NOW&&s.acceptedStartTime===s.startTime;},{timeout:20000}).toBe(true);
 expect((await stored(page)).eatTime).toBe(bake);
 await expect(page.getByText(fr?'Avez-vous pétri la pâte ?':'Have you mixed the dough?',{exact:true})).toHaveCount(0);
 expect(errors).toEqual([]);
});

// A missed start on a dough with the baker's own yeast amount: a preferment
// plan brings its own yeast, and the offer says so before the switch.
test('a preferment offer says it replaces the entered yeast amount',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const bake=NOW+40*3600000;
 const data={version:1,savedAt:NOW-24*3600000,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:true,flourInFridge:false,startTime:NOW-3600000,eatTime:bake,blocks:[],recipeGenerated:true,yeastPctOverride:0.05,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan'};
 await page.addInitScript(data=>{if(sessionStorage.getItem('yeast-seeded'))return;sessionStorage.setItem('yeast-seeded','1');localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:'plan',reviewMode:true}));},data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 const status=page.getByRole('region',{name:'Bake preparation'});
 await status.getByRole('button',{name:'Not yet · Update plan',exact:true}).tap();
 const proposal=page.getByRole('region',{name:'Updated plan'}).filter({visible:true});
 await expect(proposal.locator('[data-replan-method]').first()).toBeVisible({timeout:20000});
 const preferment=proposal.locator('[data-replan-method="biga"],[data-replan-method="poolish"]').first();
 await expect(preferment).toHaveCount(1);
 const option=preferment.locator('xpath=..');
 if(await option.evaluate(el=>el.tagName==='DETAILS'))await option.locator('summary').tap();
 await expect(option.locator('[data-replaces-yeast]')).toHaveText('This replaces your 0.05% yeast.');
 await expect(proposal.locator('[data-replan-method="none"]').locator('xpath=..').locator('[data-replaces-yeast]')).toHaveCount(0);
 await preferment.tap();
 await expect.poll(async()=>(await stored(page)).prefermentType).not.toBe('none');
 expect((await stored(page)).yeastPctOverride).toBeUndefined();
 expect(errors).toEqual([]);
});

// Fine-tune comes before Custom's bake-time step: until that step has planned
// the dough, the yeast field says so instead of showing another plan's amount.
for(const locale of ['en','fr'])test(`${locale}: the yeast amount is "Set after timing" until the Custom plan exists`,async({page})=>{
 const fr=locale==='fr';
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:BAKE-24*3600000,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:10,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('yeast-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('yeast-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:10,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 const fineTune=page.locator('#step-10:visible');
 const yeast=fineTune.locator('[data-yeast-override] input');
 await expect(yeast).toBeVisible({timeout:20000});
 await expect(yeast).toHaveValue('');
 await expect(yeast).toHaveAttribute('placeholder',fr?'Fixée après le planning':'Set after timing');
 await expect(fineTune.locator('[data-yeast-override]')).toContainText(fr?'Fixée après le planning. Vous pouvez aussi saisir votre quantité':'Set after timing. You can also enter your own amount');
 // After the bake-time step has planned the dough, the field shows that plan's amount.
 await fineTune.locator('[data-bh-forward]').tap();
 await expect(page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true})).toBeVisible();
 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:fr?'Étape précédente':'Previous step',exact:true}).tap();
 await expect(yeast).toBeVisible();
 expect(Number((await yeast.inputValue()).replace(',','.'))).toBeGreaterThan(0);
});

// An entered amount whose re-timed plan falls in busy time: the clash card offers
// the calculated amount, which plans around the busy time.
test('a clash caused by the entered yeast amount offers the calculated amount',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const night=[{label:'Saturday night',from:Date.parse('2026-10-03T23:00:00+08:00'),to:Date.parse('2026-10-04T07:00:00+08:00')}];
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:8,itemWeight:270,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'stand',yeastType:'instant',kitchenTemp:24,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:BAKE-18.25*3600000,eatTime:BAKE,blocks:night,yeastPctOverride:0.1,recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('yeast-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('yeast-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 const use=page.locator('[data-clash-use-calculated]:visible');
 await expect(use).toHaveText('Use the calculated yeast amount — the plan fits around your free time');
 await use.tap();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeUndefined();
 await expect(page.locator('[data-clash-use-calculated]:visible')).toHaveCount(0);
 expect(errors).toEqual([]);
});
