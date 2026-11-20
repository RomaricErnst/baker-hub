const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 20 Nov 2026 retention round 6 (flow). Maya: Singapore, 6 Neapolitan pizzas Sat 21 Nov 7:30pm, kitchen 30 °C,
// dough Fri 6:00pm, standard home oven. The home card says what is due (D1), a tick marks only its step (D2,
// retention-round3.spec), steps named by their action (A5), one name per bake (A6), a row to rate (A7), the fold's
// clock time (A2), one readiness cue (A3), baking paper (A1), the alarm line (A10), Bake again of a Customized bake (A13).
const H=3600000;
const bar=page=>page.locator('.bh-bake-navigator').first();
// R6_SHOTS=<dir> saves the moments as screenshots for review.
const shot=async(page,name)=>{if(process.env.R6_SHOTS)await page.screenshot({path:`${process.env.R6_SHOTS}/${name}.png`,fullPage:true});};
test.use({actionTimeout:20000,timezoneId:'Asia/Singapore',locale:'en-SG'});
function session(extra={}){
 const start=Date.parse('2026-11-20T10:00:00Z'),eat=Date.parse('2026-11-21T11:30:00Z');
 return {version:1,savedAt:start-48*H,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:6,itemWeight:250,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:30,humidity:'humid',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:start,eatTime:eat,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',...extra};
}
const entryFor=(id,s,more={})=>({v:1,id,createdAt:s.savedAt,updatedAt:s.savedAt,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,itemWeight:s.itemWeight,kitchenTemp:s.kitchenTemp,eatTime:s.eatTime,session:s,rating:null,note:'',photoIds:[],accountEventId:null,...more});
const storageFor=(id,s,others=[])=>({bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor(id,s),...others]),bh_journal_current_v1:id});
async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r6-seeded'))return;sessionStorage.setItem('r6-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
async function reopen(page,at){await page.goto('about:blank');await page.clock.setFixedTime(new Date(at));await page.goto('/');}
const resume=page=>page.getByRole('button',{name:/^(Resume|View ingredients) →$/}).tap();

test('D1: under way, the home card says what is due, as the bar does; before the first step it is dated',async({page})=>{
 await install(page,storageFor('maya-6',session()),'2026-11-20T04:00:00Z');
 // Friday noon: before the first step, the dated line, and the bake's name.
 await reopen(page,'2026-11-20T04:00:00Z');
 await expect(page.getByText('Pizza night',{exact:true})).toBeVisible();
 await expect(page.getByText(/bake\sSat\s21\sNov\s·\s7:30pm/)).toBeVisible();
 await resume(page);
 await expect(bar(page)).toContainText('Next: Start Dough');
 // The card reads the guide's own snapshot, as the home rows do: wait until the guide has saved it.
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(k=>k.endsWith(':plan')))).toBe(true);
 // 6:20pm: twenty minutes after Start Dough.
 await reopen(page,'2026-11-20T10:20:00Z');
 await expect(page.locator('[data-home-due]')).toContainText('Now: Start Dough · since 6:00pm');
 await shot(page,'d1-home-now');
 await resume(page);
 await expect(bar(page)).toContainText('Now: Start Dough');
 // Saturday 10:00am, the balls in the fridge: the take-out is next, named by its action, on the card and the bar.
 await reopen(page,'2026-11-21T02:00:00Z');
 await expect(page.locator('[data-home-due]')).toContainText(/Next: Take the dough out of the fridge · 5:15pm/);
 await shot(page,'d1-home-next');
 await resume(page);
 await expect(bar(page)).toContainText('Next: Take the dough out of the fridge');
 // The fridge step's alarm says when and what for.
 const balls=page.locator('section[data-guide-title="Refrigerate the dough balls"]');
 await balls.locator('button').first().tap();
 await expect(balls).toContainText(/Alarm: .*5:15pm — take the dough out of the fridge/);
 await shot(page,'a10-alarm');
});

test('A2/A3/A1: the fold at its clock time with how to do it, one readiness cue, baking paper on a tray',async({page})=>{
 await install(page,storageFor('maya-6',session()),'2026-11-20T10:50:00Z');
 await reopen(page,'2026-11-20T10:50:00Z');
 await resume(page);
 const rise=page.locator('section[data-guide-title="Let the dough rise"]');
 await expect(rise).toContainText(/\d{1,2}:\d{2}[ap]m — one set of stretch & folds/);
 await expect(rise).toContainText('with a wet hand');
 await expect(rise).not.toContainText('After 15 min');
 await expect(rise).not.toContainText('half to three quarters');
 await expect(rise).not.toContainText('Do I really need the stretch');
 await shot(page,'a2-fold');
 const bake=page.locator('section[data-guide-title="Bake the pizzas"]');
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Baking & serving',{exact:true})}).tap();
 await bake.locator('button').first().tap();
 await expect(bake).toContainText('baking paper');
 await shot(page,'a1-bake');
});

test('A6/A7: a baked, unrated bake stays on home as a row to rate, named as its Recipe',async({page})=>{
 // Maya's bake is over (Sat), unrated; her next bake (Tue) is the one on screen.
 const next=session({startTime:Date.parse('2026-11-24T10:00:00Z'),eatTime:Date.parse('2026-11-25T11:30:00Z'),numItems:4});
 const done=session();
 await install(page,storageFor('maya-next',next,[entryFor('maya-sat',done)]),'2026-11-22T05:00:00Z');
 await reopen(page,'2026-11-22T05:00:00Z');
 const rate=page.locator('[data-live-rate]');
 await expect(rate).toHaveCount(1);
 await expect(rate).toContainText('Pizza night · Rate');
 await shot(page,'a7-rate-row');
 await rate.tap();
 const sheet=page.getByRole('dialog').first();
 await expect(sheet.locator('strong').first()).toHaveText('Pizza night');
 await expect(sheet).toContainText('Neapolitan');
 await shot(page,'a6-sheet');
 await sheet.locator('fieldset button[aria-pressed]').nth(3).tap();
 await reopen(page,'2026-11-22T05:10:00Z');
 await expect(page.locator('[data-live-rate]')).toHaveCount(0);
});

test('A13: Bake again of a Customized bake opens on its bake time, then the recipe',async({page})=>{
 const custom=session({tab:'custom'});
 await install(page,storageFor('maya-custom',custom),'2026-11-25T04:00:00Z');
 await reopen(page,'2026-11-25T04:00:00Z');
 await page.getByRole('button',{name:'Bake again →',exact:true}).tap();
 await expect(page.getByText('How much dough?',{exact:true})).toHaveCount(0);
 const create=page.locator('[data-rebake-generate]');
 await expect(create).toBeVisible();
 await shot(page,'a13-bake-time');
 await create.tap();
 await expect(page.locator('[data-bake-title]')).toBeVisible({timeout:20000});
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')).tab)).toBe('custom');
});
