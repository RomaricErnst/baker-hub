const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 20 Nov 2026 retention round 5 (Maya: Singapore, 6 Neapolitan pizzas Sat 21 Nov 7:30pm, kitchen 30 °C, dough Fri
// 6:00pm, standard home oven). Her five changes: a 45 min home-oven preheat, the next step named during a long
// fridge rest, no missed clock time on a late mix, the date on the home row, and a next-day reopen landing on the
// step that is due. Plus the rating sheet titled with the bake.
const H=3600000;
const bar=page=>page.locator('.bh-bake-navigator').first();
test.use({actionTimeout:20000,timezoneId:'Asia/Singapore',locale:'en-SG'});
function session(extra={}){
 const start=Date.parse('2026-11-20T10:00:00Z'),eat=Date.parse('2026-11-21T11:30:00Z');
 return {version:1,savedAt:start-48*H,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:6,itemWeight:250,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:30,humidity:'humid',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:start,eatTime:eat,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',...extra};
}
const entryFor=(id,s,more={})=>({v:1,id,createdAt:s.savedAt,updatedAt:s.savedAt,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,itemWeight:s.itemWeight,kitchenTemp:s.kitchenTemp,eatTime:s.eatTime,session:s,rating:null,note:'',photoIds:[],accountEventId:null,...more});
const storageFor=(id,s)=>({bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor(id,s)]),bh_journal_current_v1:id});
async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r5-seeded'))return;sessionStorage.setItem('r5-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
async function reopen(page,at){await page.goto('about:blank');await page.clock.setFixedTime(new Date(at));await page.goto('/');}
const resume=page=>page.getByRole('button',{name:/^(Resume|View ingredients) →$/}).tap();

test('the home row says the date; the next-day reopen at mix time lands on Start Dough, with no clock time already missed',async({page})=>{
 await install(page,storageFor('maya-5',session()),'2026-11-19T04:30:00Z');
 // Thursday lunchtime: the row names the bake with its date.
 await reopen(page,'2026-11-19T04:30:00Z');
 await expect(page.getByText(/bake\sSat\s21\sNov\s·\s7:30pm/)).toBeVisible();
 await resume(page);
 // She leaves the app on the Shopping list.
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Shopping list',{exact:true})}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Shopping list');
 // She leaves on Thursday (the page saves as it goes) and reopens the same tab on Friday at 6:20pm, twenty
 // minutes after Start Dough: the history entry, and its Shopping list, come back with it.
 await page.goto('about:blank');
 await page.clock.setFixedTime(new Date('2026-11-20T10:20:00Z'));
 await page.goBack();
 await expect(page.locator('.bh-navigator-current')).toContainText('Preparation');
 await expect(bar(page)).toContainText('Now: Start Dough');
 await expect(page.getByText('Time to mix the dough',{exact:true})).toHaveCount(0);
 const step=page.locator('section[data-guide-step]:visible').filter({hasText:'Cover and rest'}).first();
 await expect(step).toBeVisible();
 await expect(step).not.toContainText(/until \d/);
 await expect(step).toContainText('Cover and rest 30 min.');
});

test('a long fridge rest names the step after it; the rest step is not opened with an empty Step done',async({page})=>{
 await install(page,storageFor('maya-5',session()),'2026-11-21T02:00:00Z');
 // Saturday 10:00am: the dough balls went into the fridge on Friday night.
 await reopen(page,'2026-11-21T02:00:00Z');
 await resume(page);
 // Named by its action since round 6 (A5): "Let the shaped dough rise" hid the take-out.
 await expect(bar(page)).toContainText('Next: Take the dough out of the fridge');
 await expect(page.locator('[data-held-step]')).toHaveCount(0);
 await expect(page.locator('section[data-guide-mark="now"]')).toHaveCount(0);
 // Nothing was ticked for her.
 await expect(page.locator('section[data-guide-done="true"]')).toHaveCount(0);
});

test('the first bake preheats a standard home oven for 45 minutes, without "Allow 30 min minimum"',async({page})=>{
 await install(page,storageFor('maya-5',session()),'2026-11-21T10:50:00Z');
 await reopen(page,'2026-11-21T10:50:00Z');
 await resume(page);
 await expect(bar(page)).toContainText('Now: Preheat the oven');
 await expect(page.getByText('Allow 30 min minimum')).toHaveCount(0);
 const preheat=page.locator('section[data-guide-title="Preheat the oven"]');
 await expect(preheat).toContainText('6:45pm');
 await expect(preheat).toContainText('45 min');
});

test('the rating sheet is titled with the bake, not "My bakes"; the row says when it was baked',async({page})=>{
 await install(page,storageFor('maya-5',session()),'2026-11-21T14:30:00Z');
 await reopen(page,'2026-11-21T14:30:00Z');
 const sheet=page.getByRole('dialog').first();
 await expect(sheet).toBeVisible();
 await expect(sheet.locator('strong').first()).not.toHaveText('My bakes');
 // One name per bake since round 6 (A6): the Recipe's title, the style beneath it.
 await expect(sheet.locator('strong').first()).toHaveText('Pizza night');
 await expect(sheet).toContainText('Neapolitan');
 // A week later, home says when it was baked.
 await reopen(page,'2026-11-25T12:00:00Z');
 await expect(page.getByText(/baked\sSat\s21\sNov\s·\s7:30pm/)).toBeVisible();
});
