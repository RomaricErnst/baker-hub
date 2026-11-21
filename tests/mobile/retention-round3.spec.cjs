const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 18 Nov 2026 retention round 3 (flow). Owner: "need to make sure the bake can proceed if baker don't care to tick
// some box. It should be helpful without blocking", and multi-bake must cost nothing for a baker with one bake.
// Maya: Singapore, 6 pizzas Sat 21 Nov 2026 7:30pm, kitchen 30 °C, dough Fri 6:00pm. She ticks NOTHING.
const H=3600000,M=60000;
const SHOTS='/tmp/claude-0/-home-claude/95a4be40-6056-5c1e-aeaf-75fb16280be2/scratchpad/r3-flow/';
const shot=async(page,name)=>{if(process.env.R3_SHOTS)await page.screenshot({path:SHOTS+(process.env.R3_SHOTS)+'-'+name+'.png'});};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')));
const bar=page=>page.locator('.bh-bake-navigator').first();
test.use({actionTimeout:20000});
function session(extra={}){
 const start=Date.parse('2026-11-20T10:00:00Z'),eat=Date.parse('2026-11-21T11:30:00Z');
 return {version:1,savedAt:start-48*H,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:6,itemWeight:250,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:30,humidity:'humid',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:start,eatTime:eat,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',...extra};
}
// A loaf in London: 2 baguettes, Start Dough Sat 7:00am, bake Sat 12:00pm (shape 9:15, final rise 9:30, preheat 11:15).
const loaf=()=>session({bakeType:'bread',styleKey:'baguette',numItems:2,itemWeight:320,ovenType:'home_oven_stone_bread',kitchenTemp:22,humidity:'normal',startTime:Date.parse('2026-11-21T07:00:00Z'),eatTime:Date.parse('2026-11-21T12:00:00Z')});
const entryFor=(id,s,more={})=>({v:1,id,createdAt:s.savedAt,updatedAt:s.savedAt,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,itemWeight:s.itemWeight,kitchenTemp:s.kitchenTemp,eatTime:s.eatTime,session:s,rating:null,note:'',photoIds:[],accountEventId:null,...more});
const storageFor=(id,s,others=[])=>({bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor(id,s),...others]),bh_journal_current_v1:id});

async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r3-seeded'))return;sessionStorage.setItem('r3-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
// Coming back to the app at a given moment, from home, as a baker does.
async function reopen(page,at,path='/'){
 await page.goto('about:blank');
 await page.clock.setFixedTime(new Date(at));
 await page.goto(path);
}
async function resumeFromHome(page){
 // One bake under way: the single-bake home, exactly as before multi-bake (owner's rule B).
 await expect(page.locator('[data-live-bakes]')).toHaveCount(0);
 await expect(page.locator('[data-live-bake]')).toHaveCount(0);
 await page.getByRole('button',{name:/^(Resume|View ingredients|Reprendre|Voir les ingrédients) →$/}).tap();
}
async function sectionsReachable(page,fr=false){
 await page.locator('.bh-bake-navigator-trigger').tap();
 const nav=page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true});
 for(const name of fr?['Recette','Liste de courses','Préparation','Cuisson & service']:['Recipe','Shopping list','Preparation','Baking & serving'])
  await expect(nav.getByRole('button').filter({has:page.getByText(name,{exact:true})}).first()).toBeEnabled();
 await page.locator('.bh-journey-done').tap();
}
async function noPrompts(page){
 // Nothing asks before letting her continue: no unanswered question, no held line, nothing ticked for her.
 await expect(page.getByText(/^(Have you mixed the dough\?|Have you made the|Avez-vous)/)).toHaveCount(0);
 await expect(page.locator('[data-held-step]')).toHaveCount(0);
 await expect(page.locator('section[data-guide-done="true"]')).toHaveCount(0);
}

test.describe('Maya, zero ticks',()=>{
 test.use({timezoneId:'Asia/Singapore',locale:'en-SG'});
 test('the clock drives the bar from Thursday to the oven; every section stays reachable; nothing asks',async({page})=>{
  test.setTimeout(240000);
  await install(page,storageFor('maya-1',session()),'2026-11-19T02:00:00Z');
  const moments=[
   // [UTC instant, section the bake opens on, bar text]
   ['2026-11-20T10:10:00Z','Preparation','Now: Start Dough'],
   ['2026-11-20T10:50:00Z','Preparation','Now: Let the dough rise'],
   // Round 8 (hot kitchen, one fridge spell): shaped at 7:15pm after the warm rise, into the fridge at 7:34pm.
   ['2026-11-20T11:20:00Z','Preparation','Now: Divide and shape dough balls'],
   ['2026-11-20T11:40:00Z','Preparation','Now: Refrigerate the dough balls'],
   ['2026-11-21T09:40:00Z','Preparation','Now: Take the dough out of the fridge'],// named by its action since round 6 (A5)
   ['2026-11-21T11:05:00Z','Baking & serving','Now: Preheat the oven'],
   ['2026-11-21T11:35:00Z','Baking & serving','Now: Bake the pizzas'],
  ];
  // Thursday: a day and a half early "Start preparation →" is not the screen's brown push.
  await reopen(page,'2026-11-19T02:00:00Z');
  await resumeFromHome(page);
  await page.locator('.bh-bake-navigator-trigger').tap();
  await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Preparation',{exact:true})}).tap();
  await expect(bar(page)).toContainText('Next: Start Dough');
  await expect(page.getByRole('button',{name:'Start preparation →',exact:true})).toHaveAttribute('data-early-start','true');
  await expect(page.getByRole('button',{name:'Back to Shopping list',exact:true})).toBeVisible();
  await shot(page,'maya-thu-preparation');
  for(const [at,section,text] of moments){
   await reopen(page,at);
   await resumeFromHome(page);
   await expect(page.locator('.bh-navigator-current')).toContainText(section);
   await expect(bar(page)).toContainText(text,{timeout:20000});
   await noPrompts(page);
   await sectionsReachable(page);
   await shot(page,'maya-'+at.slice(5,16).replace(/[:T]/g,''));
  }
  // At the bake: Baking & serving is open on the bake (not on the unticked preheat), with no after-bake block.
  await expect(page.locator('section[data-guide-title="Bake the pizzas"]').getByRole('heading',{name:'Bake the pizzas'})).toBeVisible();
  await expect(page.locator('[data-bake-closing]')).toHaveCount(0);
  await expect(page.getByText('How did it turn out?')).toHaveCount(0);
  // Preparation's forward action leads to the oven without a single tick.
  await page.locator('.bh-bake-navigator-trigger').tap();
  await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Preparation',{exact:true})}).tap();
  await expect(page.getByRole('button',{name:'Baking & serving →',exact:true})).toBeVisible();
  expect((await stored(page)).mixExecution).toBeUndefined();
  expect((await stored(page)).execution).toBeUndefined();
  // Hours after the bake, reopening asks how it went (the sheet), not a gate on the guide.
  await reopen(page,'2026-11-21T14:00:00Z');
  await expect(page.getByRole('dialog',{name:'Bake journal entry'}).getByText('How did it turn out?')).toBeVisible();
 });

 test('preheat says its duration once; 6 pizzas one at a time read 7:30–9:00pm on the plan',async({page})=>{
  await install(page,storageFor('maya-1',session()),'2026-11-21T11:05:00Z');
  await reopen(page,'2026-11-21T11:05:00Z');
  await resumeFromHome(page);
  const preheat=page.locator('section[data-guide-title="Preheat the oven"]');
  // 20 Nov 2026 round 5: a standard home oven preheats 45 min; the step's own time says it, so "Allow 45 min"
  // is not repeated (it was "Allow 30 min minimum" beside a planned 30 min before).
  await expect(preheat).toContainText('45 min');
  await expect(preheat.getByText('Allow 45 min')).toHaveCount(0);
  await expect(preheat.getByText(/Ready when: 30 min at full heat/)).toHaveCount(0);
  await page.locator('.bh-bake-navigator-trigger').tap();
  await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Recipe',{exact:true})}).tap();
  await expect(page.locator('[data-plan-bake]')).toContainText('7:30–9:00pm');
 });

 test('partial ticks: a later tick marks only its step; the earlier ones stay plain and the bar moves on',async({page})=>{
  // Saved before round 8 and opened under way: the plan keeps the shape it was made with (hotPlanRules.ts).
  await install(page,storageFor('maya-1',session()),'2026-11-20T13:20:00Z');
  await reopen(page,'2026-11-20T13:20:00Z');
  await resumeFromHome(page);
  await expect(bar(page)).toContainText('Now: Divide and shape dough balls');
  const divide=page.locator('section[data-guide-title="Divide and shape dough balls"]');
  await divide.getByRole('checkbox',{name:'Step done',exact:true}).click();
  // 20 Nov 2026 round 6 (owner's decision D2): ticking the shaping no longer ticks the mix, the rise and the
  // fridge ("says I folded when I didn't"); nothing is recorded for them.
  await expect(divide).toHaveAttribute('data-guide-done','true');
  for(const title of ['Start Dough','Let the dough rise','Refrigerate the dough'])
   await expect(page.locator(`section[data-guide-title="${title}"]`)).not.toHaveAttribute('data-guide-done','true');
  await expect(bar(page)).toContainText('Next: Refrigerate the dough balls');
  expect((await stored(page)).execution).toBeFalsy();
 });
});

test.describe('Maya, not mixed after all',()=>{
 test.use({timezoneId:'Asia/Singapore',locale:'en-SG'});
 test('nothing recorded past the start: Adjust timing offers the updated plan (Not yet), never setup questions',async({page})=>{
  await install(page,storageFor('maya-1',session()),'2026-11-20T11:20:00Z');
  await reopen(page,'2026-11-20T11:20:00Z');
  await resumeFromHome(page);
  await page.getByRole('button',{name:'Adjust timing',exact:true}).filter({visible:true}).first().tap();
  await expect(page.getByRole('region',{name:'Updated plan'}).filter({visible:true}).locator('[data-replan-method]').first()).toBeVisible({timeout:20000});
 });
});

test.describe('a loaf, zero ticks and one tick',()=>{
 test.use({timezoneId:'Europe/London',locale:'en-GB'});
 test('zero ticks: the bar follows the clock to the oven',async({page})=>{
  test.setTimeout(180000);
  await install(page,storageFor('loaf-1',loaf()),'2026-11-21T06:00:00Z');
  for(const [at,section,text] of [
   ['2026-11-21T07:10:00Z','Preparation','Now: Start Dough'],
   ['2026-11-21T08:00:00Z','Preparation','Now: Let the dough rise'],
   // Round 7 (D4, 20 Nov 2026): a baguette's apprêt is at most 1 h 45 to the bake at 22 °C (was 2 h 45), so the
   // first rise runs longer and the shaping moves 9:15 → 10:15.
   ['2026-11-21T10:20:00Z','Preparation','Now: Divide and shape'],
   ['2026-11-21T10:50:00Z','Preparation','Now: Let the shaped dough rise'],
   ['2026-11-21T11:20:00Z','Baking & serving','Now: Preheat the oven'],
   ['2026-11-21T12:05:00Z','Baking & serving','Now: Bake'],
  ]){
   await reopen(page,at);
   await resumeFromHome(page);
   await expect(page.locator('.bh-navigator-current')).toContainText(section);
   await expect(bar(page)).toContainText(text,{timeout:20000});
   await noPrompts(page);
   await sectionsReachable(page);
   await shot(page,'loaf-'+at.slice(11,16).replace(':',''));
  }
 });
 test('after one tick, an unticked action step holds Now through the wait that follows it, with one quiet line',async({page})=>{
  await install(page,storageFor('loaf-1',loaf()),'2026-11-21T07:10:00Z');
  await reopen(page,'2026-11-21T07:10:00Z');
  await resumeFromHome(page);
  await page.locator('section[data-guide-title="Start Dough"]').getByRole('checkbox',{name:'Step done',exact:true}).click();
  await expect.poll(async()=>(await stored(page)).execution?.actualAt??null).not.toBeNull();
  // 10:50: the shaping (10:15 since round 7's baguette apprêt bound) is unticked and the final rise (a wait) is
  // the clock's step: Now stays on the shaping.
  await reopen(page,'2026-11-21T10:50:00Z');
  await resumeFromHome(page);
  await expect(bar(page)).toContainText('Now: Divide and shape');
  const held=page.locator('[data-held-step]:visible');
  await expect(held).toHaveText('Done? · Step done');
  await shot(page,'loaf-held');
  // Nothing waits for it: Baking & serving is one tap away.
  await sectionsReachable(page);
  await held.getByRole('button',{name:'Step done',exact:true}).tap();
  await expect(bar(page)).toContainText('Now: Let the shaped dough rise');
  // 11:20, after the preheat time: the grace is over without any answer; the clock's step is Now.
  await reopen(page,'2026-11-21T11:20:00Z');
  await resumeFromHome(page);
  await expect(bar(page)).toContainText('Now: Preheat the oven');
 });
});

test.describe('two bakes on one device',()=>{
 test.use({timezoneId:'Europe/Paris',locale:'fr-FR'});
 // A campagne already planned for Fri 20 Nov 19:00 in the home oven (preheat 18:15, out 19:45).
 const campagne={...session({bakeType:'bread',styleKey:'pain_campagne',numItems:1,itemWeight:800,ovenType:'dutch_oven',kitchenTemp:20,humidity:'normal',startTime:Date.parse('2026-11-20T08:00:00Z'),eatTime:Date.parse('2026-11-20T18:00:00Z')}),ovenFrom:Date.parse('2026-11-20T17:15:00Z'),ovenTo:Date.parse('2026-11-20T18:45:00Z')};
 async function generatePizzas(page){
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  await page.getByRole('button',{name:'Napolitaine classique',exact:true}).tap();
  await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantité →$/}).tap();
  const quantity=page.getByLabel('Nombre de pizzas',{exact:true});
  await quantity.fill('4');await quantity.blur();
  await page.locator('.bh-step-actions:visible').locator('[data-bh-forward]:visible').tap();
  const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
  const bakeDate=page.getByLabel('Date et heure de cuisson',{exact:true});
  await bakeDate.fill('2026-11-20T19:00');await bakeDate.blur();
  await page.getByRole('button',{name:'Générer ma recette',exact:true}).tap();
 }
 test('their oven times overlap: the next free slot is offered once, in Before your recipe',async({page})=>{
  await install(page,{bh_journal_v1:JSON.stringify([entryFor('campagne',campagne)])},'2026-11-18T09:00:00Z');
  await reopen(page,'2026-11-18T09:00:00Z','/fr');
  await generatePizzas(page);
  const sheet=page.getByRole('dialog',{name:'Avant votre recette'});
  await expect(sheet).toContainText('Pain de campagne occupe le four de 18h15 à 19h45.');
  await shot(page,'oven-sheet');
  // The oven's 45 min preheat (round 5, 20 Nov 2026) starts after the campagne leaves the oven at 19h45.
  await sheet.getByRole('button',{name:/^Enfourner à 20h30/}).tap();
  await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:20000}).toBe(true);
  expect((await stored(page)).eatTime).toBe(Date.parse('2026-11-20T19:30:00Z'));
  await expect(page.locator('[data-oven-sheet]')).toHaveCount(0);
 });
 test('one bake: generating never shows anything of multi-bake',async({page})=>{
  await install(page,{},'2026-11-18T09:00:00Z');
  await reopen(page,'2026-11-18T09:00:00Z','/fr');
  await generatePizzas(page);
  await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:20000}).toBe(true);
  await expect(page.locator('[data-oven-sheet]')).toHaveCount(0);
  expect((await stored(page)).eatTime).toBe(Date.parse('2026-11-20T18:00:00Z'));
  // Home with this one bake: the single Resume card, no rows.
  await reopen(page,'2026-11-19T09:00:00Z','/fr');
  await expect(page.locator('[data-live-bakes]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^(Reprendre|Voir les ingrédients) →$/})).toBeVisible();
  await shot(page,'one-bake-home');
 });
});
