const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// The last step of Baking & serving closes the bake: "How did it turn out?" opens
// this bake's journal entry, and "Start your next bake" bakes it again (a new entry) while
// this bake stays in My bakes.
const journal=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_journal_v1')||'[]'));
async function generate(page,fr){
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
 const quantity=page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true});
 await quantity.fill('4');await quantity.blur();
 await page.locator('.bh-step-actions:visible').locator('[data-bh-forward]:visible').tap();
 await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();
 const value=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);d.setHours(19,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await bakeDate.fill(value);await bakeDate.blur();
 await page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true}).tap();
 await expect.poll(async()=>(await journal(page)).length).toBe(1);
}
async function go(page,name){
 const trigger=page.locator('.bh-bake-navigator-trigger');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
 await page.getByRole('navigation',{name:/^(Your bake|Votre fournée)$/}).getByRole('button',{name:new RegExp('^'+name)}).first().tap();
}

// 18 Nov 2026 retention round 3: the last step carries no end-of-bake block (it showed "Buon appetito … How did
// it turn out?" at the bake time, before any pizza was in). After the bake, reopening opens this bake's journal
// entry, whose Bake again starts the next bake; the finished one stays in the journal.
for(const locale of ['en','fr'])test(`${locale}: the bake ends with the journal and the next bake`,async({page})=>{
 const fr=locale==='fr';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await generate(page,fr);
 const [entry]=await journal(page);
 await go(page,fr?'Cuisson & service':'Baking & serving');
 const overview=page.locator('button.bh-step-trigger:visible',{hasText:fr?'Vue d’ensemble':'Overview'});
 if(await overview.count())await overview.first().tap();
 await page.locator('[data-guide-step]:visible').last().locator(':scope > button').first().tap();
 await expect(page.locator('[data-guide-step]:visible').last().getByRole('checkbox')).toBeVisible();
 await expect(page.locator('[data-bake-closing]')).toHaveCount(0);
 await expect(page.getByText(fr?'Cette fournée reste dans Mes fournées.':'This bake stays in My bakes.',{exact:true})).toHaveCount(0);
 // Three hours after the bake time, reopening asks how it went; Bake again from there starts the next bake.
 const eat=(await page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')))).eatTime;
 await page.clock.install({time:new Date(eat+3*3600000)});
 await page.goto('about:blank');await page.goto(fr?'/fr':'/');
 const sheet=page.getByRole('dialog',{name:fr?'Fournée du journal':'Bake journal entry'});
 await expect(sheet).toBeVisible();
 await sheet.getByRole('button',{name:fr?/^Refaire la semaine suivante/:/^Bake again next week/}).tap();
 // Bake again opens on how much (18 Nov 2026 retention round 3); the finished bake is still in the journal.
 await expect(page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true})).toBeVisible();
 expect((await journal(page)).some(row=>row.id===entry.id)).toBe(true);
 expect(errors).toEqual([]);
});
