const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Simple sourdough asks one question on its own screen after the kitchen:
// where the starter is now. Every answer leads to an enabled Generate and a
// recipe; the bake-time screen asks nothing more about the starter.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-11-10T09:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');
const copy={
 en:{path:'/',bread:'Bread',cont:/^Continue with/,question:'Where is your starter now?',counter:'On the counter',fridge:'In the fridge',ready:'It’s bubbly and risen right now',toStarter:'Your starter →',toBake:'Bake time →',date:'Bake date and time',generate:'Generate my recipe',oldYes:'Yes, ready now',oldNo:'Not yet',review:'Review affected times →',lastFed:/Last fed|Last feed/},
 fr:{path:'/fr',bread:'Pain',cont:/^Continuer avec/,question:'Où est votre levain en ce moment ?',counter:'Sur le plan de travail',fridge:'Au réfrigérateur',ready:'Il est bien monté et bullé en ce moment',toStarter:'Votre levain →',toBake:'Heure de cuisson →',date:'Date et heure de cuisson',generate:'Générer ma recette',oldYes:'Oui, il est prêt maintenant',oldNo:'Pas encore',review:'Voir les horaires à ajuster →',lastFed:/Dernier rafraîchi/},
};
for(const locale of ['en','fr'])for(const answer of ['counter','fridge','ready'])test(`simple starter screen ${locale}: ${answer} generates a recipe`,async({page})=>{
 test.setTimeout(90000);
 const c=copy[locale];
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(c.path);
 await page.getByRole('button',{name:c.bread,exact:true}).tap();
 await page.getByRole('button',{name:'Pain au levain',exact:true}).tap();
 await page.getByRole('button',{name:c.cont}).tap();
 await forward(page).tap();
 await page.getByRole('slider').first().fill('22');
 await expect(forward(page)).toHaveText(c.toStarter);
 await forward(page).tap();
 await expect(page.getByRole('heading',{name:c.question})).toBeVisible();
 // Nothing pre-selected; the way forward waits for an answer.
 for(const name of [c.counter,c.fridge,c.ready])await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(forward(page)).toBeDisabled();
 await page.getByRole('button',{name:c[answer],exact:true}).tap();
 await expect(page.getByRole('button',{name:c[answer],exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(forward(page)).toHaveText(c.toBake);
 await expect(forward(page)).toBeEnabled();
 await forward(page).tap();
 const bakeDate=page.getByLabel(c.date,{exact:true});
 await bakeDate.fill('2026-11-11T18:00');await bakeDate.blur();
 // The bake-time screen no longer asks about the starter.
 for(const name of [c.oldYes,c.oldNo])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 const generate=page.getByRole('button',{name:c.generate,exact:true});
 await expect(generate).toBeEnabled({timeout:20000});
 await generate.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
 await expect(page.getByRole('button',{name:c.review})).toHaveCount(0);
 const session=await stored(page);
 expect(session.simpleStarterAnswer).toBe(answer);
 const feeds=(session.starterEvents||[]).filter(e=>['refresh','intermediate_refresh','pre_mix'].includes(e.kind));
 if(answer!=='ready')expect(feeds.length).toBeGreaterThan(0);
 for(const feed of feeds)expect(feed.time%(15*60000)).toBe(0);
 // An assumed last feed is never printed as a fact.
 await expect(page.getByText(c.lastFed)).toHaveCount(0);
 // Reload keeps the answer with this bake.
 await page.reload();
 await expect.poll(async()=>(await stored(page))?.simpleStarterAnswer).toBe(answer);
 expect(errors).toEqual([]);
});

test('simple starter screen: Previous goes back to the kitchen, and the review lists the answer with Edit',async({page})=>{
 test.setTimeout(90000);
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Bread',exact:true}).tap();
 await page.getByRole('button',{name:'Pain au levain',exact:true}).tap();
 await page.getByRole('button',{name:/^Continue with/}).tap();
 await forward(page).tap();
 await forward(page).tap();
 await page.getByRole('button',{name:'Previous step',exact:true}).tap();
 await expect(page.getByRole('slider',{name:'Temperature where the dough rests'})).toBeVisible();
 await forward(page).tap();
 await page.getByRole('button',{name:'In the fridge',exact:true}).tap();
 await forward(page).tap();
 const bakeDate=page.getByLabel('Bake date and time',{exact:true});
 await bakeDate.fill('2026-11-11T18:00');await bakeDate.blur();
 await page.getByRole('button',{name:'Generate my recipe',exact:true}).tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
 const trigger=page.locator('.bh-bake-navigator-trigger');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button',{name:/^My bake/}).first().tap();
 await expect(page.getByRole('heading',{name:'Review my choices',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit : Your starter',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Where is your starter now?'})).toBeVisible();
 await expect(page.getByRole('button',{name:'In the fridge',exact:true})).toHaveAttribute('aria-pressed','true');
});
