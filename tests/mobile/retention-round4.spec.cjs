const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');

// 18 Nov 2026 retention round 4 (flow). Owner: live bakes never leave home; home rows name the next thing to do in
// the page's language with a time that is never cut; an unanswered pre-mix feed question fades at the mix and the
// unticked mix holds Now; a tick never states a time the baker did not give (only "Different time?" does).
const H=3600000;
const SHOTS='/tmp/claude-0/-home-claude/95a4be40-6056-5c1e-aeaf-75fb16280be2/scratchpad/r4-flow/';
const shot=async(page,name)=>{if(process.env.R4_SHOTS)await page.screenshot({path:SHOTS+process.env.R4_SHOTS+'-'+name+'.png'});};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')));
const bar=page=>page.locator('.bh-bake-navigator').first();
test.use({actionTimeout:20000});

function session(extra={}){
 const start=Date.parse('2026-11-20T10:00:00Z'),eat=Date.parse('2026-11-21T11:30:00Z');
 return {version:1,savedAt:start-48*H,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:6,itemWeight:250,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:30,humidity:'humid',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:start,eatTime:eat,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',...extra};
}
// Two baguettes, Start Dough Sat 7:00am, bake Sat 12:00pm (London).
const loaf=(extra={})=>session({bakeType:'bread',styleKey:'baguette',numItems:2,itemWeight:320,ovenType:'home_oven_stone_bread',kitchenTemp:22,humidity:'normal',startTime:Date.parse('2026-11-21T07:00:00Z'),eatTime:Date.parse('2026-11-21T12:00:00Z'),...extra});
const entryFor=(id,s,more={})=>({v:1,id,createdAt:s.savedAt,updatedAt:s.savedAt,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,itemWeight:s.itemWeight,kitchenTemp:s.kitchenTemp,eatTime:s.eatTime,session:s,rating:null,note:'',photoIds:[],accountEventId:null,...more});
const planKey=id=>'bh_guide_done_v2:'+JSON.stringify({bake:id})+':plan';
// The guide's own steps for a bake, as it saves them (here in English, as if last shown on /).
const loafPlan=(day='2026-11-21')=>JSON.stringify({locale:'en',steps:[
 {step:1,at:Date.parse(day+'T07:00:00Z'),phase:'preparation',action:true,done:false,title:'Start Dough'},
 {step:2,at:Date.parse(day+'T07:30:00Z'),phase:'preparation',action:false,done:false,title:'Let the dough rise'},
 {step:3,at:Date.parse(day+'T09:15:00Z'),phase:'preparation',action:true,done:false,title:'Divide and shape'},
 {step:4,at:Date.parse(day+'T09:30:00Z'),phase:'preparation',action:false,done:false,title:'Let the shaped dough rise'},
 {step:5,at:Date.parse(day+'T11:15:00Z'),phase:'cooking',action:true,done:false,title:'Preheat the oven'},
 {step:6,at:Date.parse(day+'T12:00:00Z'),phase:'cooking',action:true,done:false,title:'Bake the baguettes'},
]});

async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r4-seeded'))return;sessionStorage.setItem('r4-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
async function reopen(page,at,url='/'){
 await page.goto('about:blank');
 await page.clock.setFixedTime(new Date(at));
 await page.goto(url);
}

test.describe('item 1 · live bakes never leave home',()=>{
 test.use({timezoneId:'Europe/London',locale:'en-GB'});
 // Round 18 (H1): home keeps every bake under way and the newest plan; the pizza has started (its dough at 4pm).
 const pizza=session({startTime:Date.parse('2026-11-20T16:00:00Z'),eatTime:Date.parse('2026-11-22T19:00:00Z')});
 const storage={bh_session_v1:JSON.stringify(loaf()),bh_journal_v1:JSON.stringify([entryFor('loaf',loaf()),entryFor('pizza',pizza)]),bh_journal_current_v1:'loaf',[planKey('loaf')]:loafPlan()};
 test('a tap on a family card, then a reload, keeps both rows',async({page})=>{
  await install(page,storage,'2026-11-20T18:00:00Z');
  await reopen(page,'2026-11-20T18:00:00Z');
  await expect(page.locator('[data-live-bake]')).toHaveCount(2);
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  await expect(page.getByRole('button',{name:'Classic Neapolitan',exact:true})).toBeVisible();
  await reopen(page,'2026-11-20T18:05:00Z');
  await shot(page,'home-after-family-tap');
  await expect(page.locator('[data-live-bake]')).toHaveCount(2);
  await expect(page.locator('[data-live-bake="loaf"]')).toBeVisible();
  await expect(page.locator('[data-live-bake="pizza"]')).toBeVisible();
 });
 test('rating one bake keeps the other on home',async({page})=>{
  // The loaf was baked and rated; the pizza is still under way.
  const baked=loaf({bakedDone:true});
  await install(page,{bh_session_v1:JSON.stringify(baked),bh_journal_v1:JSON.stringify([entryFor('loaf',baked,{rating:4}),entryFor('pizza',pizza)]),bh_journal_current_v1:'loaf'},'2026-11-21T15:00:00Z');
  await reopen(page,'2026-11-21T15:00:00Z');
  await shot(page,'home-after-rating');
  await expect(page.locator('[data-live-bake="pizza"]')).toBeVisible();
  await expect(page.locator('[data-live-again]')).toBeVisible();
 });
});

test.describe('item 3 · home rows',()=>{
 test.use({timezoneId:'Europe/London',locale:'fr-FR'});
 test('the guide’s step in the page’s language, the next action, the time never cut, the bake day for twins',async({page})=>{
  // Two baguette bakes (Sat and Sun); the guide was last shown in English; home on /fr at 320 px.
  await page.setViewportSize({width:320,height:700});
  const sun=loaf({startTime:Date.parse('2026-11-22T07:00:00Z'),eatTime:Date.parse('2026-11-22T12:00:00Z')});
  await install(page,{bh_journal_v1:JSON.stringify([entryFor('sat',loaf()),entryFor('sun',sun)]),[planKey('sat')]:loafPlan(),[planKey('sun')]:loafPlan('2026-11-22')},'2026-11-21T09:45:00Z');
  await reopen(page,'2026-11-21T09:45:00Z','/fr');
  await shot(page,'rows-fr-320');
  const sat=page.locator('[data-live-bake="sat"]');
  // Saturday 9:45: the final rise (a wait) is under way; the next thing to do is the oven at 11:15.
  await expect(sat).toHaveAttribute('aria-label','Sam. · Baguettes · Préchauffer le four 11h15 →');
  await expect(page.locator('[data-live-bake="sun"]')).toHaveAttribute('aria-label','Dim. · Baguettes · Pétrir la pâte dim. 7h00 →');
  // Ordered by that time, and the time fully on screen.
  await expect(page.locator('[data-live-bake]').first()).toHaveAttribute('data-live-bake','sat');
  for(const id of ['sat','sun']){
   const time=page.locator(`[data-live-bake="${id}"] [data-live-time]`);
   const box=await time.boundingBox(),button=await page.locator(`[data-live-bake="${id}"]`).boundingBox();
   expect(box.x+box.width).toBeLessThanOrEqual(button.x+button.width);
   expect(await time.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
 });
 test('a poolish made hours ago gives way to the knead due soon',async({page})=>{
  const plan=JSON.stringify({locale:'en',steps:[
   {step:1,at:Date.parse('2026-11-21T07:00:00Z'),phase:'preparation',action:true,done:false,title:'Make your Poolish'},
   {step:2,at:Date.parse('2026-11-21T12:30:00Z'),phase:'preparation',action:true,done:false,title:'Start Dough'},
   {step:3,at:Date.parse('2026-11-21T13:00:00Z'),phase:'preparation',action:false,done:false,title:'Let the dough rise'},
  ]});
  const pizza=session({startTime:Date.parse('2026-11-22T16:00:00Z'),eatTime:Date.parse('2026-11-22T19:00:00Z')});
  await install(page,{bh_journal_v1:JSON.stringify([entryFor('bag',loaf({prefermentType:'poolish',prefOffsetH:5.5,startTime:Date.parse('2026-11-21T12:30:00Z'),eatTime:Date.parse('2026-11-22T10:00:00Z')})),entryFor('pizza',pizza)]),[planKey('bag')]:plan},'2026-11-21T12:10:00Z');
  await reopen(page,'2026-11-21T12:10:00Z');
  await expect(page.locator('[data-live-bake="bag"]')).toHaveAttribute('aria-label','Baguettes · Pétrir la pâte 12h30 →');
 });
});

// Priya's levain loaf (fixture of round 3): intermediate feed Thu 8:30pm, pre-mix feed Fri 8:30am, mix Fri 5:30pm.
const priya=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/priya-levain-tue.json'),'utf8'));
async function openPriya(page,at,url='/'){
 await install(page,priya,at);
 await reopen(page,at,url);
 await page.getByRole('button',{name:/^(Resume|Reprendre) →$/}).tap();
}
const preparation=async(page,fr=false)=>{
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(fr?'Préparation':'Preparation',{exact:true})}).tap();
};

test.describe('items 2 and 5 · a levain bake',()=>{
 test.use({timezoneId:'Europe/London',locale:'en-GB'});
 test('item 2: the unanswered pre-mix feed question fades at the mix; the unticked mix is Now, not the rise',async({page})=>{
  await openPriya(page,'2026-11-20T12:00:00Z');
  await expect(page.getByRole('region',{name:'Starter feeding'})).toBeVisible();
  await page.goto('about:blank');await page.clock.setFixedTime(new Date('2026-11-20T17:35:00Z'));await page.goto('/');
  await page.getByRole('button',{name:'Resume →',exact:true}).tap();
  await preparation(page);
  await shot(page,'mix-1735');
  await expect(page.getByRole('region',{name:'Starter feeding'})).toHaveCount(0);
  await expect(bar(page)).toContainText('Now: Start Dough');
 });
 test('item 2 FR: the feed prompt reads "Oui, à 8h30" the same day',async({page})=>{
  await openPriya(page,'2026-11-20T12:00:00Z','/fr');
  const status=page.getByRole('region',{name:'Rafraîchi du levain'});
  await shot(page,'fr-feed-prompt');
  await expect(status.getByRole('button',{name:'Oui, à 8h30',exact:true})).toBeVisible();
 });
 test('item 5: a tap is Done with no time, the plan unchanged; one Step done on a held step',async({page})=>{
  await openPriya(page,'2026-11-20T09:10:00Z');
  await preparation(page);
  const feed=page.locator('section[data-guide-title="Pre-mix feed"]');
  await feed.getByRole('checkbox',{name:'Step done',exact:true}).first().click({force:true}).catch(async()=>{
   await page.locator('section[data-guide-title="Pre-mix feed"]').tap();
   await feed.getByRole('checkbox',{name:'Step done',exact:true}).click();
  });
  await expect.poll(async()=>(await stored(page)).starterFeedRecords?.length??0).toBe(1);
  let s=await stored(page);
  expect(s.starterFeedRecords[0].actualAt).toBe(Date.parse('2026-11-20T08:30:00Z'));
  expect(s.starterFeedRecords[0].stated).toBe(false);
  expect(s.startTime).toBe(Date.parse('2026-11-20T17:30:00Z'));
  // 5:50pm: the mix, unticked after a tick, holds Now with the one quiet line, and no second "Step done" below.
  await reopen(page,'2026-11-20T17:50:00Z');
  await page.getByRole('button',{name:'Resume →',exact:true}).tap();
  await expect(bar(page)).toContainText('Now: Start Dough');
  const mix=page.locator('section[data-guide-title="Start Dough"]');
  if(!(await mix.locator('[data-held-step]').isVisible()))await mix.locator('button').first().tap();
  await shot(page,'held-mix');
  await expect(mix.locator('[data-held-step]')).toHaveText('Done? · Step done');
  await expect(mix.getByRole('checkbox',{name:'Step done',exact:true})).toHaveCount(0);
  await mix.locator('[data-held-step]').getByRole('button',{name:'Step done',exact:true}).tap();
  await expect.poll(async()=>(await stored(page)).mixExecution?.actualAt??null).toBe(Date.parse('2026-11-20T17:30:00Z'));
  s=await stored(page);
  expect(s.mixExecution.stated).toBe(false);
  await expect(mix).toContainText('Done');
  await expect(mix).not.toContainText('Done ·');
  await expect(mix).not.toContainText('Completed');
  await shot(page,'mix-done');
 });
 test('item 5 (round 6, D2): a later tick marks only its step; the mix stays plain, nothing invented',async({page})=>{
  await openPriya(page,'2026-11-20T22:40:00Z');
  await preparation(page);
  const shape=page.locator('section[data-guide-title="Shape the loaf"]');
  if(!(await shape.getByRole('checkbox',{name:'Step done',exact:true}).isVisible()))await shape.locator('button').first().tap();
  await shape.getByRole('checkbox',{name:'Step done',exact:true}).click();
  await expect(shape).toHaveAttribute('data-guide-done','true');
  const overview=page.locator('.bh-step-trigger');if(await overview.isVisible())await overview.tap();
  const mix=page.locator('section[data-guide-title="Start Dough"]');
  await shot(page,'closed-by-later-tick');
  await expect(mix).not.toHaveAttribute('data-guide-done','true');
  await expect(mix).not.toContainText(/Done ·|Completed/);
  expect((await stored(page)).mixExecution?.actualAt??null).toBe(null);
 });
});

test.describe('item 6 and the reopen · a cold-proofed loaf',()=>{
 test.use({timezoneId:'Europe/London',locale:'en-GB'});
 test('the take-out step says the plan’s own line; reopening at it lands where the bar points',async({page})=>{
  await openPriya(page,'2026-11-21T09:20:00Z');
  await expect(bar(page)).toContainText('Take the shaped loaf out of the fridge');
  await expect(page.locator('.bh-navigator-current')).toContainText('Preparation');
  const step=page.locator('section[data-guide-title="Take the shaped loaf out of the fridge"]');
  if(!(await step.getByText(/preheat the oven · bake at/).isVisible()))await step.locator('button').first().tap();
  await shot(page,'take-out-line');
  await expect(step).toContainText('9:15am — take the loaf out of the fridge · preheat the oven · bake at 10:00am');
  await expect(step).not.toContainText('floured fingertip');
 });
});

test.describe('the bake step says until when',()=>{
 test.use({timezoneId:'Asia/Singapore',locale:'en-SG'});
 test('six pizzas one at a time: Sat 7:30–9:00pm on the bake step, as on the plan',async({page})=>{
  await install(page,{bh_session_v1:JSON.stringify(session()),bh_journal_v1:JSON.stringify([entryFor('maya',session())]),bh_journal_current_v1:'maya'},'2026-11-21T11:35:00Z');
  await reopen(page,'2026-11-21T11:35:00Z');
  await page.getByRole('button',{name:/^(Resume|View ingredients) →$/}).tap();
  const bake=page.locator('section[data-guide-title="Bake the pizzas"]');
  await shot(page,'bake-range');
  await expect(bake).toContainText('Sat 7:30–9:00pm');
 });
});
