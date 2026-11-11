const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Short notice: proposed starts sit on the quarter-hour grid, never earlier than
// now + 15 min, and a start within two hours says how soon.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-11-10T11:14:20+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');
async function toBakeTime(page,locale){
 const fr=locale==='fr';
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:fr?/^Continuer avec/:/^Continue with/}).tap();
 await forward(page).tap();
 await page.getByRole('slider',{name:fr?'Température là où la pâte repose':'Temperature where the dough rests'}).fill('24');
 await forward(page).tap();
 return page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
}
for(const locale of ['en','fr'])test(`${locale} simple: a bake tonight starts on the next quarter hour and says how soon`,async({page})=>{
 const fr=locale==='fr';
 const bakeDate=await toBakeTime(page,locale);
 await bakeDate.fill('2026-11-10T21:00');await bakeDate.blur();
 const soon=page.locator('[data-start-soon]');
 await expect(soon).toHaveText(fr?'Pétrir la pâte · aujourd’hui 11h30 · dans 15 min':'Start Dough · today 11:30am · in 15 min');
 await page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true}).tap();
 await expect(page.locator('[data-recipe-plan]')).toContainText(fr?'aujourd’hui 11h30 · dans 15 min':'today 11:30am · in 15 min');
 await expect.poll(async()=>(await stored(page))?.startTime).toBe(Date.parse('2026-11-10T11:30:00+08:00'));
 // Due within 30 minutes: Preparation opens on the summary with step 1's instructions open.
 await page.locator('[data-recipe-plan]').locator('[data-go-preparation]').tap();
 await expect(page.locator('#bake-step-1')).toBeVisible();
 await expect(page.locator('#bake-step-2')).toHaveCount(0);
});
test('en simple: with a later start that still fits, the plan does not ask to start within minutes',async({page})=>{
 const bakeDate=await toBakeTime(page,'en');
 await bakeDate.fill('2026-11-11T12:00');await bakeDate.blur();
 await expect(page.getByRole('button',{name:'Generate my recipe',exact:true})).toBeEnabled();
 await expect(page.locator('[data-start-soon]')).toHaveCount(0);
 await page.getByRole('button',{name:'Generate my recipe',exact:true}).tap();
 await expect(page.locator('[data-recipe-plan]')).toContainText('Start Dough · Tue 10 Nov · 1:15pm');
 await expect.poll(async()=>(await stored(page))?.startTime).toBe(Date.parse('2026-11-10T13:15:00+08:00'));
});
