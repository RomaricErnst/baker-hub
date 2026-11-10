const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Simple never refuses a quantity over a mixer the baker did not choose; a ready
// sourdough starter with a far-off bake gets a plan with one more refresh.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-11-10T09:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');
const section=async(page,name)=>{
 const trigger=page.locator('.bh-bake-navigator-trigger');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button',{name}).first().tap();
};
for(const count of [6,12])test(`simple: ${count} Neapolitan pizzas generate a recipe as one dough`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Continue with/}).tap();
 const quantity=page.getByLabel('Number of pizzas',{exact:true});
 await quantity.fill(String(count));await quantity.blur();
 await forward(page).tap();
 await page.getByRole('slider',{name:'Temperature where the dough rests'}).fill('24');
 await forward(page).tap();
 const bakeDate=page.getByLabel('Bake date and time',{exact:true});
 await bakeDate.fill('2026-11-11T19:00');await bakeDate.blur();
 await expect(page.getByText(/mixer|capacity/i)).toHaveCount(0);
 await page.getByRole('button',{name:'Generate my recipe',exact:true}).tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
 await expect(page.getByText(/Split into|mixer capacity/i)).toHaveCount(0);
 await section(page,/^Preparation/);
 await page.getByRole('button',{name:/Start Dough/}).first().tap();
 const note=page.locator('[data-large-dough-note]:visible');
 await expect(note).toContainText('is a large dough. If it is too much for your bowl or mixer');
 expect(errors).toEqual([]);
});

test('sourdough: a starter ready now with a bake tomorrow evening gets one more refresh',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Bread & meals',exact:true}).tap();
 await page.getByRole('button',{name:'Pain au levain',exact:true}).tap();
 await page.getByRole('button',{name:/^Continue with/}).tap();
 await forward(page).tap();
 await page.getByRole('slider').first().fill('22');
 await forward(page).tap();
 // "Your starter": bubbly and risen right now.
 await page.getByRole('button',{name:'It’s bubbly and risen right now',exact:true}).tap();
 await forward(page).tap();
 const bakeDate=page.getByLabel('Bake date and time',{exact:true});
 await bakeDate.fill('2026-11-11T18:00');await bakeDate.blur();
 await expect(page.getByText('the plan refreshes it once more so it peaks when you mix')).toBeVisible({timeout:20000});
 await expect(page.getByText(/cannot keep your chosen times/)).toHaveCount(0);
 await expect(page.getByText('Last fed')).toHaveCount(0);
 const generate=page.getByRole('button',{name:'Generate my recipe',exact:true});
 await expect(generate).toBeEnabled({timeout:20000});
 await generate.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
 expect(errors).toEqual([]);
});
