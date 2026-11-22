const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');

// 18 Nov 2026 retention round 3, Priya: London 19 °C, fridge 5 °C, starter in the fridge fed 4–5 days ago 1:1:1,
// pain au levain customized (Dutch oven, no knead, 75 %), busy weekdays 9:00–17:30 and nights 23:00–7:00,
// planned Tue 17 Nov 7:30pm for Sat 21 Nov 10:00am (the planner raised the levain to 27.5 %). Fixture: that
// generated bake as the app stored it. The refresh planned Thu 8:30pm is recorded as done at 10:30pm.
const storage=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/priya-levain-tue.json'),'utf8'));
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')));
test.use({timezoneId:'Europe/London',locale:'en-GB'});

async function open(page,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([s])=>{if(sessionStorage.getItem('r3-seeded'))return;sessionStorage.setItem('r3-seeded','1');localStorage.clear();for(const k in s)localStorage.setItem(k,s[k]);},[storage]);
 await page.goto('/');
 // One bake under way: home keeps the single Resume card.
 await page.getByRole('button',{name:'Resume →',exact:true}).tap();
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Recipe',{exact:true})}).tap();
}
async function recordLateFeed(page){
 await open(page,'2026-11-19T22:30:00Z');
 const status=page.getByRole('region',{name:'Starter feeding'});
 await expect(status.getByText('Have you fed the starter?')).toBeVisible();
 await status.getByRole('button',{name:'Different time?'}).tap();
 // The field opens on now.
 await expect(status.locator('input[type=datetime-local]')).toHaveValue('2026-11-19T22:30');
 await status.getByRole('button',{name:'Set time'}).tap();
 await expect.poll(async()=>(await stored(page)).starterFeedRecords?.length).toBe(1);
}
const planText=page=>page.locator('[data-recipe-plan-steps]:visible').first().innerText();

test('a refresh fed 2 h late keeps the plan: the pre-mix feed before work, the mix at 5:30pm, nothing busy',async({page})=>{
 await recordLateFeed(page);
 const plan=await planText(page);
 expect(plan).toContain('8:30am\nPre-mix feed');
 expect(plan).toContain('5:30pm\nStart Dough');
 expect(plan).not.toContain('during a busy time');
 const s=await stored(page);
 expect(new Date(s.startTime).toISOString()).toBe('2026-11-20T17:30:00.000Z');
 expect(new Date(s.eatTime).toISOString()).toBe('2026-11-21T10:00:00.000Z');
 expect(s.autoStarterPct).toBe(27.5);
 expect(s.lastFedTime).toBe(Date.parse('2026-11-19T22:30:00Z'));
 // Preparation agrees: no clash line.
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Preparation',{exact:true})}).tap();
 await expect(page.locator('section[data-guide-title="Pre-mix feed"]')).toContainText('Fri 8:30am');
 await expect(page.locator('[data-plan-clash]')).toHaveCount(0);
});

test('after the late feed, a reload, Change times and a Fine-tune edit keep the recorded feed and the raised levain',async({page})=>{
 await recordLateFeed(page);
 await page.clock.setSystemTime(new Date('2026-11-20T07:30:00Z'));
 await page.reload();
 // Never asked again for a feed already recorded.
 await expect(page.getByText('Have you fed the starter?')).toHaveCount(0);
 await page.getByRole('button',{name:'Change times',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Edit Start Dough, Fri 5:30pm'})).toBeVisible();
 await expect(page.getByText('The plan needs another available time')).toHaveCount(0);
 await expect(page.getByText(/Starter into the fridge/)).toHaveCount(0);
 await page.getByRole('button',{name:'Back to my choices',exact:false}).first().tap();
 await page.getByRole('button',{name:'Edit : Dough'}).tap();
 await expect(page.locator('[data-starter-override] input')).toHaveValue('27.5');
 const hydration=page.locator('input[type=number]').first();
 await hydration.fill('74');await hydration.blur();
 await page.getByRole('button',{name:'Update recipe'}).tap();
 // The plan's first row (a feed before the levain build) is under All steps since round 7; Bake is always shown.
 await expect(page.locator('[data-plan-bake]:visible')).toBeVisible();
 expect(await planText(page)).toContain('5:30pm\nStart Dough');
 const s=await stored(page);
 expect(s.autoStarterPct).toBe(27.5);
 expect(s.starterFeedRecords.length).toBe(1);
});

test('a clash after an edit: one statement, one action, and Back to Recipe restores the last good plan',async({page})=>{
 await recordLateFeed(page);
 await page.clock.setSystemTime(new Date('2026-11-20T07:30:00Z'));
 await page.reload();
 await page.getByRole('button',{name:'Change times',exact:true}).tap();
 const bake=page.getByLabel('Bake date and time');
 await bake.fill('2026-11-21T07:15');await bake.blur();
 const card=page.locator('[data-simple-decision]');
 await expect(card).toBeVisible({timeout:30000});
 // One statement; the card's choices are a verified later bake (when one exists) or Keep, nothing else.
 await expect(card.locator('button:not([data-simple-accept]):not([data-simple-keep-all])')).toHaveCount(0);
 await expect(card.getByRole('button',{name:/^Keep 7:15am/})).toBeVisible();
 await expect(page.getByRole('button',{name:'I can cover this step'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Find compatible times'})).toHaveCount(0);
 await expect(page.getByText('Choose one of the options above.')).toHaveCount(0);
 const back=page.locator('[data-back-to-good-plan]');
 await expect(back).toBeEnabled();
 // Round 9 (bug G footnote): with the card open the way back is the bar's back control ("‹ Recipe"), and no
 // forward button reads "Back to Recipe".
 await expect(back).toHaveClass(/bh-back-action/);
 await expect(back).toHaveAccessibleName('Back to Recipe');
 await expect(page.locator('.bh-step-actions:visible [data-bh-forward]')).toHaveCount(0);
 await back.tap();
 // The plan's first row (a feed before the levain build) is under All steps since round 7; Bake is always shown.
 await expect(page.locator('[data-plan-bake]:visible')).toBeVisible();
 expect(await planText(page)).toContain('10:00am\nBake');
 const s=await stored(page);
 expect(new Date(s.eatTime).toISOString()).toBe('2026-11-21T10:00:00.000Z');
 expect(s.autoStarterPct).toBe(27.5);
});
