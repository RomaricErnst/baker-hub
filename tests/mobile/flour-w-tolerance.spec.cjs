const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Flour strength (21 Nov 2026, owner): a W typed from the bag sets how long a white wheat flour can
// ferment (ftmFromW: the cold retard scales with it) and never the hydration. Neapolitan, 22 °C, pizza
// oven, bake Mon 7:30pm, Nights busy: W 200 → Start Dough Sun 7:30pm (22 h cold), W 320 → 11:30am,
// W 380 → 9:30am; hydration 60 % every time.
test.use({timezoneId:'Asia/Singapore'});
test.setTimeout(240000);
const NOW=Date.parse('2026-10-03T09:00:00+08:00');
const BAKE=Date.parse('2026-10-05T19:15:00+08:00');
const seed={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,
 flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:false,prefermentChosen:true,customKitchenConfirmed:true,
 confirmedSettings:['yeast=instant','method=none','climate=22','oven=pizza_oven','mixer=hand'],activeStep:6,advancedStep:6,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};

for(const fr of [false,true])test(`${fr?'fr':'en'}: a typed W 200/320/380 moves the cold time, never the hydration`,async({page})=>{
 const L=(en,f)=>fr?f:en;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(data=>{if(sessionStorage.getItem('fw-seeded'))return;sessionStorage.setItem('fw-seeded','1');localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:6,advancedStep:6,setupOverview:false,activeTab:'setup'}));},seed);
 const seen=[];
 for(const W of ['200','320','380']){
  await page.goto(fr?'/fr':'/');
  await page.getByRole('button',{name:L('Enter my flour','Saisir ma farine'),exact:true}).tap();
  const form=page.locator('section.manual-flour-form:visible');
  await form.locator('select').selectOption('pizza00');
  await form.locator('summary').tap();
  await form.getByRole('spinbutton',{name:L('Strength W','Force W'),exact:true}).fill(W);
  await expect(form.locator('[data-flour-w-note]')).toHaveText(L(/^Hydration follows the flour type\. The bag’s W measures strength/,/^L’hydratation suit le type de farine\. Le W du sachet mesure la force/));
  if(W==='320'&&test.info().project.name.endsWith('320'))await page.screenshot({path:test.info().outputPath(`flour-w-form-${fr?'fr':'en'}.png`),fullPage:true});
  await form.getByRole('button',{name:L('Use this flour','Utiliser cette farine'),exact:true}).tap();
  // Flour → Preferment → Yeast → Fine-tune → Bake time.
  let hydration;
  for(let i=0;i<4;i++){
   if(i===3)hydration=await page.locator('#step-10:visible').getByRole('spinbutton',{name:L(/^Hydration/,/^Hydratation/)}).evaluate(n=>n.value||n.placeholder);
   await page.locator('[data-bh-forward]:visible').last().tap();
  }
  const step=page.locator('#step-9:visible');
  const bake=step.locator('input[type="datetime-local"]').first();
  await bake.fill('2026-10-05T19:30');await bake.blur();
  await expect(step).toContainText(L('Recommended plan','Planning recommandé'));
  const text=(await step.innerText()).replace(/\s+/g,' ');
  const start=text.match(new RegExp(L('Start Dough','Pétrir la pâte')+' ([0-9:h]+(?:am|pm)?)'))?.[1]; // time only: WebKit appends a ✓ to the row text
  seen.push({W,hydration,start});
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
 }
 // Same hydration whatever the W; a stronger flour starts earlier (longer cold retard).
 expect(new Set(seen.map(s=>s.hydration)).size,JSON.stringify(seen)).toBe(1);
 expect(seen[0].hydration).toBe('60');
 expect(seen.map(s=>s.start)).toEqual(fr?['19h30','11h30',expect.stringMatching(/^0?9h30$/)]:['7:30pm','11:30am','9:30am']);
 expect(errors).toEqual([]);
});

// Round 9 (J): a W changed after the recipe exists re-times the plan as a fresh choice would (W 200 → 380:
// Start Dough Sun 7:30pm → 9:30am, a smaller yeast amount); hydration stays 60 %.
test('a W changed after the recipe re-times the plan',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(data=>{if(sessionStorage.getItem('fw-seeded'))return;sessionStorage.setItem('fw-seeded','1');localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:6,advancedStep:6,setupOverview:false,activeTab:'setup'}));},seed);
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
 const enterW=async W=>{
  await page.getByRole('button',{name:'Enter my flour',exact:true}).filter({visible:true}).first().tap();
  const form=page.locator('section.manual-flour-form:visible');
  await form.locator('select').selectOption('pizza00');
  await form.locator('summary').tap();
  await form.getByRole('spinbutton',{name:'Strength W',exact:true}).fill(W);
  await form.getByRole('button',{name:'Use this flour',exact:true}).tap();
 };
 await page.goto('/');
 await enterW('200');
 for(let i=0;i<4;i++)await page.locator('[data-bh-forward]:visible').last().tap();
 const step=page.locator('#step-9:visible');
 const bake=step.locator('input[type="datetime-local"]').first();
 await bake.fill('2026-10-05T19:30');await bake.blur();
 await expect(step).toContainText('Recommended plan');
 await page.getByRole('button',{name:'Create my recipe',exact:true}).tap();
 await expect.poll(async()=>(await stored())?.recipeGenerated).toBe(true);
 const before=await stored();
 expect(new Date(before.startTime).toLocaleTimeString('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit'})).toBe('19:30');
 // My choices → Flour → a W 380 flour → Update recipe.
 await page.getByRole('button',{name:'My choices',exact:true}).first().tap();
 await page.getByRole('button',{name:/^Edit : Flour/}).first().tap();
 await page.getByRole('button',{name:'Change flour',exact:true}).filter({visible:true}).first().tap();
 await enterW('380');
 await page.getByRole('button',{name:'Update recipe',exact:true}).filter({visible:true}).last().tap();
 const moved=page.locator('[data-plan-moved]');
 await expect(moved).toBeVisible({timeout:20000});
 await expect(moved).toContainText(/Start Dough Sun 4 Oct · 9:30am/);
 await expect.poll(async()=>(await stored()).startTime-before.startTime,{timeout:15000}).toBe(-10*3600000);
 const after=await stored();
 expect(after.eatTime).toBe(BAKE+15*60000);
 expect(after.flourBlend.w1).toBe(380);
 expect(errors).toEqual([]);
});
