const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');

// 20 Nov 2026 retention round 7 (starter track).
// B3: a counter starter's confirmed mix stays keepable when Nights is added (intermediate feeds placed back from
// the pre-mix feed; the rest stretch on counter starters too). Task 2: a pinned mix the busy times no longer allow
// keeps the time editor, with one statement and the ways on. B5: two live sourdough bakes, one jar, one feed.
// R7_SHOTS=<dir> saves the moments as screenshots for review.
const H=3600000;
const shot=async(page,name)=>{if(process.env.R7_SHOTS)await page.screenshot({path:`${process.env.R7_SHOTS}/${name}.png`,fullPage:true});};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));

test.describe('pinned mix (Singapore, counter starter)',()=>{
 test.use({timezoneId:'Asia/Singapore'});
 const NOW=Date.parse('2026-09-25T08:49:00+08:00'),BAKE=Date.parse('2026-09-30T18:00:00+08:00');
 async function seed(page){
  await page.clock.setFixedTime(NOW);
  const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'spiral',yeastType:'sourdough',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:true,flourInFridge:false,startTime:BAKE-26*H,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup',planningMode:'last_fed',lastFedTime:NOW-3*H,lastFedAge:'today',starterLocation:'rt',lastFeedRatio:1,nextFeedRatio:1,ratioMode:'keep',starterTimingValid:true};
  await page.addInitScript(data=>{
   if(!sessionStorage.getItem('r7-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('r7-seeded','1');}
   sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));
  },data);
  await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.goto('/');
  const plan=page.getByRole('region',{name:'Your key times',exact:true});
  await expect(plan).toBeVisible();
  return plan;
 }
 async function pinMix(page,plan,value){
  const row=plan.locator('[data-key-timing="mix"]');
  if(!await row.locator('input[type="datetime-local"]').count())await row.locator('.bh-key-time').tap();
  await row.locator('input[type="datetime-local"]').fill(value);
  const apply=plan.getByRole('button',{name:'Apply',exact:true});
  await expect(apply).toBeEnabled();await apply.tap();
  await expect.poll(async()=>(await stored(page)).startTime).toBe(Date.parse(value+':00+08:00'));
 }
 async function nights(page){
  const group=page.getByRole('group',{name:'My unavailable times'});
  if(await group.getAttribute('open')===null)await group.locator('summary').tap();
  await group.getByRole('button',{name:/^Nights/}).tap();
  await expect.poll(async()=>(await stored(page)).blocks.some(b=>b.label.endsWith(' night'))).toBe(true);
 }

 test('B3: a confirmed mix plus Nights is kept, the plan stays on screen and valid',async({page})=>{
  const plan=await seed(page);
  await pinMix(page,plan,'2026-09-29T16:30');
  await nights(page);
  await expect(plan).toBeVisible();
  await expect(plan.locator('[data-key-timing="mix"]')).toHaveAttribute('data-at',String(Date.parse('2026-09-29T16:30:00+08:00')));
  await expect(plan.locator('[data-unkept-pin]')).toHaveCount(0);
  const s=await stored(page);
  expect(s.startTime).toBe(Date.parse('2026-09-29T16:30:00+08:00'));
  // Every future starter step respects the nights; the pre-mix feed is part of the plan.
  const feeds=s.starterEvents.filter(e=>e.time>NOW&&['refresh','intermediate_refresh','pre_mix'].includes(e.kind));
  expect(feeds.some(e=>e.kind==='pre_mix')).toBe(true);
  for(const e of feeds)expect(s.blocks.some(b=>e.time>=b.from&&e.time<b.to),e.kind+' in the night').toBe(false);
  await shot(page,'b3-pinned-nights-kept');
 });

 test('Task 2: a pinned mix the nights no longer allow keeps the editor, one statement and the ways on',async({page})=>{
  const plan=await seed(page);
  const pinned=Date.parse('2026-09-29T09:00:00+08:00');
  await pinMix(page,plan,'2026-09-29T09:00');
  await nights(page);
  // The editor stays, at the pinned mix.
  await expect(plan).toBeVisible();
  await expect(plan.locator('[data-key-timing="mix"]')).toHaveAttribute('data-at',String(pinned));
  // One statement and its options, in the clash card: the step that no longer fits, the later bake, the nearest
  // mix that keeps this bake time, Keep. No second notice or step list in the editor, no warning glyph.
  const card=page.locator('[data-simple-decision]');
  await expect(card).toContainText('Pre-mix feed falls at');
  await expect(plan.locator('[data-unkept-pin]')).toHaveCount(0);
  await expect(plan.locator('[data-availability-conflicts]')).toHaveCount(0);
  expect(await card.innerText()).not.toMatch(/⚠|!/);
  const nearest=card.locator('[data-nearest-mix]');
  await expect(nearest).toContainText('The nearest time that fits · bake at 6:00pm');
  await expect(page.getByRole('button',{name:'Return to recommended times',exact:true})).toBeVisible();
  await shot(page,'task2-after-unkept');
  // The nearest time that fits: one tap, a valid plan at that mix.
  const label=await nearest.locator('strong').innerText();
  await nearest.tap();
  await expect(page.locator('[data-nearest-mix]')).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).startTime).not.toBe(pinned);
  const s=await stored(page);
  expect(Math.abs(s.startTime-pinned)).toBeLessThanOrEqual(8*H);
  expect(label).toMatch(/^Start Dough /);
  await expect(plan.locator('[data-key-timing="mix"]')).toHaveAttribute('data-candidate-valid','true');
  await shot(page,'task2-nearest-applied');
 });

 test('Task 2: Return to recommended times releases the pin',async({page})=>{
  const plan=await seed(page);
  await pinMix(page,plan,'2026-09-29T09:00');
  await nights(page);
  await expect(page.locator('[data-nearest-mix]')).toBeVisible();
  await page.getByRole('button',{name:'Return to recommended times',exact:true}).tap();
  await expect(page.locator('[data-nearest-mix]')).toHaveCount(0);
  await expect.poll(async()=>(await stored(page)).timingOverrides??{}).toEqual({});
  await expect(plan.locator('[data-key-timing="mix"]')).toHaveAttribute('data-candidate-valid','true');
 });
});

test.describe('one jar, two bakes (London)',()=>{
 test.use({timezoneId:'Europe/London',locale:'en-GB'});
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/priya-levain-tue.json'),'utf8'));
 const base=JSON.parse(fixture.bh_session_v1);
 const baseEntry=JSON.parse(fixture.bh_journal_v1)[0];
 const Z=s=>Date.parse(s+'Z');
 // Shift the bake's pre-mix feed (and its peak) and its mix.
 const shifted=(s,feedAt,peakAt,mixAt,extra={})=>({...s,...extra,startTime:mixAt,acceptedStartTime:mixAt,feed2Time:feedAt,
  starterEvents:s.starterEvents.map(e=>e.kind==='pre_mix'?{...e,time:feedAt,bellPeakTime:peakAt}:e)});
 const entryOf=(id,s,more={})=>({...baseEntry,id,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,eatTime:s.eatTime,session:s,...more});
 async function open(page,storage){
  await page.clock.install({time:new Date(Z('2026-11-19T12:00'))});
  await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.addInitScript(([s])=>{if(sessionStorage.getItem('r7-seeded'))return;sessionStorage.setItem('r7-seeded','1');localStorage.clear();for(const k in s)localStorage.setItem(k,s[k]);},[storage]);
  await page.goto('/');
 }
 async function preparation(page){
  const t=page.locator('.bh-bake-navigator-trigger');
  if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
  await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Preparation',{exact:true})}).tap();
 }

 test('rule B: one sourdough bake keeps its own feed, said as before',async({page})=>{
  await open(page,{...fixture});
  await page.getByRole('button',{name:'Resume →',exact:true}).tap();
  await preparation(page);
  const feed=page.getByRole('button',{name:/^Pre-mix feed (Next )?Fri 8:30am/});
  await expect(feed).toBeVisible();await feed.tap();
  await expect(page.getByText(/^Mix \d+ g starter/).first()).toBeVisible();
  await expect(page.getByText(/for both bakes/)).toHaveCount(0);
  const s=await stored(page);
  expect(s.starterEvents.find(e=>e.kind==='pre_mix').time).toBe(Z('2026-11-20T08:30'));
 });

 test('B5: the bake whose feed comes first sizes it for both, said once with both amounts',async({page})=>{
  // The baguettes, planned after: pre-mix feed Fri 8:45, mix 6:00pm, in the campagne feed's ready window.
  const bag=shifted({...base,styleKey:'baguette',numItems:2,eatTime:Z('2026-11-21T11:00'),levainNeed:{mid:90,max:100}},Z('2026-11-20T08:45'),Z('2026-11-20T17:57'),Z('2026-11-20T18:00'));
  await open(page,{...fixture,bh_journal_v1:JSON.stringify([baseEntry,entryOf('bag-1',bag)])});
  // Two bakes under way: home lists one row each.
  await page.locator('[data-live-bake]').first().waitFor().catch(()=>{});
  await page.getByRole('button',{name:/^(Resume|Pain au levain|Sourdough)/}).first().tap();
  await preparation(page);
  await page.getByRole('button',{name:/^Pre-mix feed (Next )?Fri 8:30am/}).tap();
  const line=page.getByText(/^Feed 1:1:1 for both bakes · \d+ g: \d+ g for .+, \d+ g for the baguettes$/).filter({visible:true}); // the Recipe's starter card (round 8, S6) carries the line too, hidden here
  await expect(line).toHaveCount(1);
  await line.scrollIntoViewIfNeeded();
  await shot(page,'b5-leader-shared-feed');
  const s=await stored(page);
  // The plan's own feed time is unchanged: the campagne leads.
  expect(s.starterEvents.find(e=>e.kind==='pre_mix').time).toBe(Z('2026-11-20T08:30'));
 });

 test('B5: the bake that follows uses the earlier feed and plans no feeds of its own before it',async({page})=>{
  // The campagne, planned first by another bake entry: its pre-mix feed Fri 8:15 peaks 5:27pm, near this mix (5:30pm).
  const camp=shifted({...base,bakeName:'Campagne',levainNeed:{mid:120,max:130}},Z('2026-11-20T08:15'),Z('2026-11-20T17:27'),Z('2026-11-20T17:15'));
  const mine={...base,savedAt:base.savedAt+H};
  await open(page,{...fixture,bh_session_v1:JSON.stringify(mine),bh_journal_v1:JSON.stringify([entryOf('camp-1',camp),{...baseEntry,session:mine}])});
  await page.getByRole('button',{name:/^(Resume|Pain au levain|Sourdough)/}).first().tap();
  await preparation(page);
  // Its own Thursday 8:30pm feed is the campagne's to do: planned once, the jar's (round 8, S6: the bake that follows
  // shows the jar's own steps, so one Thursday feed, the campagne's, at its time); its pre-mix feed is the campagne's.
  await expect(page.getByRole('button',{name:/^(Refresh feed|Intermediate feed)/})).toHaveCount(1);
  await page.getByRole('button',{name:/^Pre-mix feed (Next )?Fri 8:15am/}).tap();
  const line=page.getByText(/^Feed 1:1:1 for both bakes · \d+ g: \d+ g for Campagne, \d+ g for .+$/).filter({visible:true}); // the Recipe's starter card (round 8, S6) carries the line too, hidden here
  await expect(line).toHaveCount(1);
  await line.scrollIntoViewIfNeeded();
  await shot(page,'b5-follower-shared-feed');
 });
});

// Task 4 (Priya's levain fixture, planned Tuesday by an earlier model): opened Thursday at noon, nothing fed yet,
// Change times re-derived the plan, found none and read "This change would move a past preparation" with
// "No compatible window". A saved plan the current model does not re-derive is judged as shown.
test.describe('Task 4: a saved levain plan opened before its first feed',()=>{
 test.use({timezoneId:'Europe/London',locale:'en-GB'});
 // Round 17 (O3): planned with today's levain bulk; 30 % gives the bulk the fixture was planned with (27.5 % on the old reference).
 const priya=(()=>{const f=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/priya-levain-tue.json'),'utf8'));
  const s=JSON.parse(f.bh_session_v1);s.autoStarterPct=30;f.bh_session_v1=JSON.stringify(s);
  f.bh_journal_v1=JSON.stringify(JSON.parse(f.bh_journal_v1).map(e=>e.session?{...e,session:{...e.session,autoStarterPct:30}}:e));return f;})();
 test('Change times on Thursday noon keeps the plan, compatible, with no past-preparation note',async({page})=>{
  await page.clock.install({time:new Date('2026-11-19T12:00:00Z')});
  await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.addInitScript(([s])=>{if(sessionStorage.getItem('r7-t4'))return;sessionStorage.setItem('r7-t4','1');localStorage.clear();for(const k in s)localStorage.setItem(k,s[k]);},[priya]);
  await page.goto('/');
  await page.getByRole('button',{name:'Resume →',exact:true}).tap();
  await page.locator('.bh-bake-navigator-trigger').tap();
  await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Recipe',{exact:true})}).tap();
  await page.getByRole('button',{name:'Change times',exact:true}).tap();
  await expect(page.getByText('Recommended plan',{exact:true})).toBeVisible();
  await expect(page.getByText(/would move a past preparation/)).toHaveCount(0);
  await expect(page.getByText('The plan needs another available time')).toHaveCount(0);
  await page.getByRole('button',{name:'Edit Start Dough, Fri 5:30pm'}).tap();
  await expect(page.getByText('Current time is compatible.')).toBeVisible();
  await expect(page.getByText(/No compatible window/)).toHaveCount(0);
  await shot(page,'task4-thursday-change-times');
  const s=await stored(page);
  expect(new Date(s.startTime).toISOString()).toBe('2026-11-20T17:30:00.000Z');
  expect(s.starterEvents.find(e=>e.kind==='pre_mix').time).toBe(Date.parse('2026-11-20T08:30:00Z'));
 });
});
