const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Romaric, 13 Nov 2026: the Pizzas page opens on one question and one line, then search, filters
// and pizzas. The style is the first filter chip, the pool size sits in the search field, the
// results count shows only while filtering, "Create my own pizza" sits above the first pizza, and
// the tally under the title opens the selection sheet however many pizzas are chosen.
test.use({timezoneId:'Asia/Singapore'});

for(const fr of [false,true])test(`${fr?'fr':'en'}: Pizzas page, first visit to a chosen pizza`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 const L=(en,f)=>fr?f:en;
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:L('Classic Neapolitan','Napolitaine classique'),exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:L(/^Quantity →$/,/^Quantité →$/)}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 const time=page.getByLabel(L('Bake date and time','Date et heure de cuisson'),{exact:true});
 await time.focus();await time.blur();
 await page.locator('[data-generate-recipe]').tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Recipe','Recette'));

 // The section is named for what the baker picks.
 await page.locator('.bh-recipe-next:visible [data-toppings-step]').tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Pizzas');
 await expect(page.getByRole('heading',{level:1})).toHaveText(L('Which pizzas?','Quelles pizzas ?'));
 // No bake summary block, no "suited to" bar, no "Showing N".
 await expect(page.locator('.bh-bake-context')).toHaveCount(0);
 await expect(page.getByText(L(/^Pizzas suited to/,/^Pizzas adaptées à/))).toHaveCount(0);
 await expect(page.locator('[data-results-count]')).toHaveCount(0);
 await expect(page.locator('[data-pizza-count]')).toHaveText(L('Pick one for each of your 4 dough balls.','Choisissez une pizza pour chacun de vos 4 pâtons.'));
 await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder',L(/^Search \d+ pizzas or an ingredient…$/,/^Rechercher parmi \d+ pizzas ou un ingrédient…$/));
 await expect(page.locator('[data-style-chip]')).toHaveText(L('Neapolitan ▾',/^Napolitaine ▾$/));
 await expect(page.locator('[data-create-pizza]')).toContainText(L('+ Create my own pizza','+ Créer ma pizza'));

 // Choosing one turns the line into a tally; its link opens the selection sheet.
 const card=page.getByRole('button',{name:/^Margherita(?: · \d+)?$/});
 await card.getByRole('button',{name:/^\+/}).tap();
 await expect(page.locator('[data-pizza-count]')).toContainText(L('1 of 4 chosen','1 sur 4 choisie'));
 await page.locator('[data-see-selection]').tap();
 await expect(page.getByRole('dialog').filter({hasText:'Margherita'})).toBeVisible();

 // A search shows the results count with a way to clear it.
 await page.keyboard.press('Escape');
 expect(errors).toEqual([]);
});
