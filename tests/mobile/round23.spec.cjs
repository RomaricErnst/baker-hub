const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 23 (26 Nov 2026), EN and FR, from the round-22 live pass:
// 1  the ask token survives a change of network (no 403 after the address changes); past 20 questions in 10 minutes from
//    one address the box says the calm "Lots of questions at once" (the instance's memory count; no rate store here).
// 2  Priya (sourdough pizza, 26 °C, fridge starter, Fri 7pm → Sat 7:30pm, Nights): after Keep, the plan's first row (the
//    starter's take-out at 11:15pm, inside the night) carries "during a busy time" like every other row.
// 3  A second sourdough bake on the same jar is not asked the starter question; its Levain build reads the shared ratio and
//    "shared with …", the jar line "After both bakes, N g stays in the jar".
// 4  The time editor's Update recipe sits above the page's bottom bar (a tap lands on it); "…in the past" is said once.
// 5  A scan with no catalogue match hands its protein and W estimate to the flour form.
// 8  "Different time?" after a late tap opens on now (to 5 minutes), not on the planned time.
// 10 The yeast line: the spoon, then the fresh-yeast equivalent.
// 11 Pizzas picked: the Recipe's row reads "Pizzas · 3 of 4 chosen", the navigator no longer says Optional, the Pizzas
//    button reads "Shopping & prep →". 12: the cooking screen has the bottom bar; the question box's example fits the step.
test.use({timezoneId:'Asia/Singapore'});
const SGT=s=>Date.parse(s+'+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');
async function open(page,fr,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
}
async function neapolitan(page,fr,bake){
 await page.getByRole('button',{name:/^Pizza/}).first().tap();
 await page.getByRole('button',{name:fr?/^Napolitaine/:/^Classic Neapolitan/}).first().tap();
 await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
 await forward(page).tap();
 await page.getByRole('slider').first().fill('22');
 await forward(page).tap();
 await bakeTime(page,fr,bake);
 const go=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
 await expect(go).toBeEnabled({timeout:20000});await go.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
}
async function bakeTime(page,fr,bake){
 const date=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await date.fill(bake);await date.blur();
}
async function section(page,fr,name){
 const t=page.locator('.bh-bake-navigator-trigger:visible').first();
 await t.scrollIntoViewIfNeeded();
 if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).first().tap();
}
// Priya's sourdough pizza, kept with its night steps, recipe created.
async function priya(page,fr){
 await page.getByRole('button',{name:/^Pizza/}).first().tap();
 await page.getByRole('button',{name:fr?/^Pizza au levain/:/^Sourdough pizza/}).first().tap();
 await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
 await forward(page).tap();
 await page.getByRole('slider').first().fill('26');
 await forward(page).tap();
 await page.getByRole('button',{name:fr?'Au réfrigérateur':'In the fridge',exact:true}).tap();
 await forward(page).tap();
 await bakeTime(page,fr,'2026-11-28T19:30');
 const go=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
 await expect(go).toBeEnabled({timeout:20000});await go.tap();
 const keep=page.locator('[data-decision-sheet] [data-simple-keep-all]:visible, [data-simple-keep-all]:visible').first();
 await expect(keep).toBeVisible({timeout:30000});await keep.tap();
 const create=page.getByRole('button',{name:fr?/^Créer ma recette/:/^Create my recipe/}).filter({visible:true});
 await page.waitForTimeout(800);
 if(!(await stored(page))?.recipeGenerated&&await create.count()&&await create.first().isEnabled())await create.first().tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
}
const shot=(page,name)=>page.screenshot({path:test.info().outputPath(`${name}.png`),fullPage:false});

for(const fr of [false,true]){
 const L=(en,f)=>fr?f:en, lang=fr?'fr':'en';
 test.describe(`round 23 (${lang})`,()=>{
  test.use({locale:fr?'fr-FR':'en-GB'});

  test('1: a token survives a change of network; 21 questions in 10 minutes get the calm busy line',async({page,context})=>{
   test.setTimeout(120000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const ip=`198.51.100.${(fr?100:50)+Math.floor(Math.random()*40)}`;
   await context.setExtraHTTPHeaders({'x-forwarded-for':ip});
   const statuses=[];page.on('response',r=>{if(r.url().includes('/api/bake-coach')&&r.request().method()==='POST')statuses.push(r.status());});
   await open(page,fr,SGT('2026-11-25T19:00'));
   await neapolitan(page,fr,'2026-11-26T19:30');
   await section(page,fr,L('Preparation','Préparation'));
   const step=page.getByRole('button',{name:fr?/^Pétrir la pâte/:/^Start Dough/}).filter({visible:true}).first();
   if(await step.count())await step.tap();
   const box=page.getByLabel(L('A question about this step?','Une question sur cette étape ?')).filter({visible:true}).first();
   if(!(await box.count())){const tips=page.locator('summary.bh-chevron:visible').filter({hasText:L(/tips/i,/Conseils/)}).first();await tips.scrollIntoViewIfNeeded();await tips.tap();}
   await expect(box).toBeVisible();
   await expect(box).toHaveAttribute('placeholder',L('My dough is sticky…','Ma pâte colle…'));
   const ask=page.getByRole('button',{name:L('Ask','Demander'),exact:true}).filter({visible:true}).first();
   // A first question fetches the page's token on this address…
   await box.fill(L('Is it sticky?','Elle colle ?'));await ask.tap();
   await expect(page.locator('[data-ask-maestro] [role="status"]:visible').first()).toBeVisible({timeout:20000});
   // …the phone changes network: the same token is still accepted (no 403; the model is not configured here: 500).
   await context.setExtraHTTPHeaders({'x-forwarded-for':ip.replace(/\.\d+$/,'.250')});
   await box.fill(L('And now?','Et maintenant ?'));await ask.tap();
   await expect.poll(()=>statuses.length,{timeout:20000}).toBeGreaterThanOrEqual(2);
   expect(statuses.filter(s=>s===403)).toEqual([]);
   // Back on the first address: 20 calls in 10 minutes, then the calm line.
   await context.setExtraHTTPHeaders({'x-forwarded-for':ip});
   await page.evaluate(async()=>{
    const id='specPage'+Math.random().toString(36).slice(2,12)+'xxxxxx';
    const {token}=await (await fetch('/api/bake-coach',{headers:{'x-bh-page':id}})).json();
    for(let i=0;i<20;i++)await fetch('/api/bake-coach',{method:'POST',headers:{'content-type':'application/json','x-bh-page':id,'x-bh-ask':token},body:JSON.stringify({stepId:'mix',question:'q'+i})});
   });
   await box.fill(L('One more?','Encore une ?'));await ask.tap();
   await expect(page.getByText(L('Lots of questions at once. Try again in a few minutes.','Beaucoup de questions d’un coup. Réessayez dans quelques minutes.'))).toBeVisible({timeout:20000});
   await shot(page,`r23-busy-${lang}`);
   expect(errors).toEqual([]);
  });

  test('2, 3: the take-out row inside the night is tagged; a second bake on the jar skips the starter question and says the shared feed',async({page})=>{
   test.setTimeout(180000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,fr,SGT('2026-11-27T19:00'));
   await priya(page,fr);
   const all=page.locator('[data-plan-all-steps]:visible').first();
   // The plan's first row (the starter's take-out at 11:15pm, inside the 11pm–7am night) shows among the key steps, tagged.
   const first=page.locator('[data-recipe-plan] li[data-plan-start]').first();
   await expect(first).toContainText(L('Take starter out of the fridge','Sortir le levain du réfrigérateur'));
   await expect(first.locator('[data-plan-busy]')).toHaveCount(1);
   await shot(page,`r23-priya-first-row-${lang}`);
   if(await all.count()&&await all.getAttribute('aria-expanded')==='false')await all.tap();
   // A second sourdough bake: Pain au levain on Sunday, the same jar.
   await page.getByRole('button',{name:'Menu',exact:true}).tap();
   await page.getByRole('button',{name:L(/^Start a new bake/,/^Commencer une nouvelle fournée/)}).first().tap();
   await page.getByRole('button',{name:L(/^Bread/,/^Pain/)}).first().tap().catch(()=>{});
   await page.getByRole('button',{name:/^Pain au levain/}).first().tap();
   const qty=page.getByRole('button',{name:L(/^Quantity →$/,/^Quantité →$/)});
   if(await qty.count())await qty.tap();
   // The jar's state is known: no "Where is your starter now?", straight to the bake time.
   await expect(forward(page)).toHaveText(L('Bake time →','Heure de cuisson →'));
   await forward(page).tap();
   await expect(page.getByRole('heading',{name:L('Where is your starter now?','Où est votre levain en ce moment ?')})).toHaveCount(0);
   await bakeTime(page,fr,'2026-11-29T12:30');
   const go=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
   await expect(go).toBeEnabled({timeout:20000});await go.tap();
   await expect.poll(async()=>(await stored(page))?.recipeGenerated&&(await stored(page))?.styleKey,{timeout:30000}).toBe('pain_levain');
   expect((await stored(page)).simpleStarterAnswer).toBe('fridge');
   const stages=page.locator('[data-recipe-stages]:visible').first();
   await expect(stages).toContainText(L(/shared with the pizzas/,/en commun avec les pizzas/));
   const text=await stages.innerText();
   // The ratio said is the ratio the grams are built at: flour ÷ seed.
   const m=text.match(fr?/rafraîchi 1:(\d+):\1[^\n]*\n\s*(\d+)\s*g[\s\S]*?Farine[^\n]*\n\s*(\d+)\s*g/:/feed 1:(\d+):\1[^\n]*\n\s*(\d+)\s*g[\s\S]*?Flour[^\n]*\n\s*(\d+)\s*g/);
   expect(m,text).toBeTruthy();
   expect(Math.round(+m[3]/+m[2])).toBe(+m[1]);
   await expect(stages).toContainText(L(/After both bakes, \d+\s?g stays in the jar/,/Après les deux fournées, il reste \d+\s?g dans le bocal/));
   await stages.scrollIntoViewIfNeeded();
   await shot(page,`r23-jar-levain-build-${lang}`);
   expect(errors).toEqual([]);
  });

  test('4: Update recipe in the time editor sits above the bottom bar; "in the past" is said once',async({page})=>{
   test.setTimeout(120000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,fr,SGT('2026-11-25T19:00'));
   await neapolitan(page,fr,'2026-11-26T19:30');
   const edit=page.locator('[data-plan-edit]:visible').first();
   await edit.scrollIntoViewIfNeeded();await edit.tap();
   const minus=page.getByRole('button',{name:'- 30 min'}).filter({visible:true}).first();
   await minus.scrollIntoViewIfNeeded();
   for(let i=0;i<3;i++)if(await minus.isEnabled())await minus.tap();
   const apply=page.locator('.bh-linked-actions .bh-apply-plan:visible').first();
   await expect(apply).toHaveText(L('Update recipe','Mettre à jour la recette'));
   const geo=await apply.evaluate(btn=>{const r=btn.getBoundingClientRect();const bar=[...document.querySelectorAll('.bh-step-actions')].find(x=>x.getClientRects().length&&getComputedStyle(x).position==='fixed');const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {bottom:r.bottom,barTop:bar?bar.getBoundingClientRect().top:innerHeight,hit:btn===hit||btn.contains(hit)};});
   expect(geo.hit,'a tap on Update recipe lands on it').toBe(true);
   expect(geo.bottom).toBeLessThanOrEqual(geo.barTop+0.5);
   const panel=page.locator('#schedule-anchor-panel:visible').first();
   const said=((await panel.innerText()).match(L(/in the past/g,/dans le passé/g))??[]).length;
   expect(said).toBeLessThanOrEqual(1);
   await shot(page,`r23-editor-${lang}`);
   expect(errors).toEqual([]);
  });

  test('5: a scanned flour with no catalogue match keeps its protein and W estimate',async({page})=>{
   test.setTimeout(150000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/flour-scan',r=>r.request().method()==='GET'
    ?r.fulfill({status:200,contentType:'application/json',body:'{"token":"t"}'})
    :r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:{name:'Moulin du Val T65 Tradition',w:220,protein:11.5,wOnBag:false,proteinOnBag:true,confidence:'medium',readability:'clear',source:'estimated',note:''}})}));
   await open(page,fr,SGT('2026-11-27T19:00'));
   await page.getByRole('button',{name:/^(Bread|Pain)/}).first().tap();
   await page.getByRole('button',{name:'Baguette',exact:true}).first().tap();
   await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
   await forward(page).tap();
   await page.getByRole('slider').first().fill('20');
   await forward(page).tap();
   await bakeTime(page,fr,'2026-11-28T11:30');
   // A scripted tap lands on Generate in Chromium (the page re-scrolls to its top); a click on the link itself.
   await page.locator('[data-customize-link]').evaluate(el=>el.click());
   await page.getByText(L('Home oven + stone or steel','Four + pierre ou acier')).first().tap();
   const flourNext=page.getByRole('button',{name:L('Flour →','Farine →'),exact:true});
   if(!(await flourNext.isVisible().catch(()=>false)))await forward(page).tap();
   await page.getByRole('button',{name:L(/^Hand knead/,/^Pétrissage à la main/)}).first().tap();
   await flourNext.tap();
   await page.getByRole('button',{name:L('Scan my bag','Scanner mon sac')}).tap();
   await page.locator('input[type=file]').first().setInputFiles({name:'bag.png',mimeType:'image/png',buffer:require('node:fs').readFileSync(require('node:path').join(__dirname,'../../public/logo.png'))});
   const choose=page.getByRole('button',{name:L(/^Choose flour type/,/^Choisir le type de farine/)});
   await expect(choose).toBeVisible({timeout:20000});await choose.tap();
   await expect(page.getByLabel(L('Protein, %','Protéines, %'))).toHaveValue(L('11.5','11,5'));
   await expect(page.getByPlaceholder(L('≈ 220 (estimated)','≈ 220 (estimé)'))).toBeVisible();
   await shot(page,`r23-scan-form-${lang}`);
   await page.getByRole('button',{name:L('Use this flour','Utiliser cette farine'),exact:true}).tap();
   await expect(page.getByText(L('estimated from the photo','estimée d’après la photo'))).toBeVisible();
   await expect(page.locator('body')).toContainText(/W ~220/);
   expect(errors).toEqual([]);
  });

  test('8, 10, 11, 12: late tap opens on now; yeast line order; picked pizzas said where offered; the cooking screen bar',async({page,context})=>{
   test.setTimeout(180000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,fr,SGT('2026-11-25T19:00'));
   await neapolitan(page,fr,'2026-11-26T19:30');
   // 10: the spoon, then the fresh yeast, on the yeast's own line.
   await expect(page.locator('body')).toContainText(L(/≈ [^\n]*tsp · or [\d.]+\s?g fresh yeast/,/≈ [^\n]*c\. à café · ou [\d,]+\s?g de levure fraîche/));
   // 11: three pizzas picked.
   await page.locator('[data-add-fillings]:visible').tap();
   const card=page.getByRole('button',{name:/^Margherita(?: · \d+)?$/});
   for(let i=0;i<3;i++)await card.getByRole('button',{name:/^\+/}).tap();
   const companion=page.locator('[data-companion-action]:visible');
   await expect(companion.getByRole('button').last()).toHaveText(L('Shopping & prep →','Courses et prépa →'));
   await section(page,fr,L('Recipe','Recette'));
   await expect(page.locator('[data-add-fillings]:visible')).toHaveText(L('Pizzas · 3 of 4 chosen','Pizzas · 3 sur 4 choisies'));
   const t=page.locator('.bh-bake-navigator-trigger:visible').first();await t.tap();
   const nav=page.getByRole('navigation',{name:L('Your bake','Votre fournée'),exact:true});
   await expect(nav).toContainText(L('3 of 4 chosen','3 sur 4 choisies'));
   await expect(nav).not.toContainText(L('Optional · choose toppings','Facultatif · choisir les garnitures'));
   await page.locator('.bh-journey-scrim').first().tap({position:{x:10,y:10}});
   // 12: the cooking screen has the standard bar, its way back named.
   await section(page,fr,L('Baking & serving','Cuisson & service'));
   await page.getByRole('button',{name:L(/^Bake the pizzas/,/^Cuire les pizzas/)}).filter({visible:true}).first().tap();
   const startCook=page.getByRole('button',{name:L(/^Start cooking the pizzas/,/^Commencer la cuisson des pizzas/)}).filter({visible:true}).first();
   await startCook.scrollIntoViewIfNeeded();await startCook.tap();
   await expect(page.getByRole('heading',{name:L(/Which pizza|Pizza/,/pizza/i)}).first()).toBeVisible();
   await expect(page.locator('[data-cook-back]:visible')).toHaveAccessibleName(L('Back to Preparation','Retour à la préparation'));
   await shot(page,`r23-cook-bar-${lang}`);
   // 8: 25 minutes after the planned mix, Step done then "Different time?" opens on now (to 5 minutes).
   const mixAt=(await stored(page)).startTime;
   const later=await context.newPage();
   const lateAt=mixAt+27*60000;
   await later.clock.install({time:new Date(lateAt)});
   await later.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
   await later.goto(fr?'/fr':'/');
   const resume=later.getByRole('button',{name:fr?/Reprendre|Voir les ingrédients/:/Resume|View ingredients/}).first();
   await expect(resume).toBeVisible({timeout:20000});await resume.tap();
   await section(later,fr,L('Preparation','Préparation'));
   const startStep=later.getByRole('button',{name:fr?/^Pétrir la pâte/:/^Start Dough/});
   if(!(await later.getByRole('checkbox',{name:L(/Step done/,/Étape faite/)}).filter({visible:true}).count())&&await startStep.count())await startStep.filter({visible:true}).first().tap();
   const done=later.getByRole('checkbox',{name:L(/Step done/,/Étape faite/)}).filter({visible:true}).first();
   await done.scrollIntoViewIfNeeded();await done.tap();
   const different=later.getByRole('button',{name:L('Different time?','À une autre heure ?')}).filter({visible:true});
   if(!(await different.count()))await startStep.filter({visible:true}).first().tap();
   await different.first().tap();
   const field=later.locator('[data-done-time]:visible input[type="datetime-local"]').first();
   const value=await field.inputValue();
   const now=await later.evaluate(()=>Date.now());
   const want=new Date(Math.floor(now/300000)*300000);
   const local=new Date(+want-want.getTimezoneOffset()*60000).toISOString().slice(0,16);
   expect(value).toBe(await later.evaluate(ms=>{const d=new Date(Math.floor(ms/300000)*300000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);},now));
   expect(value).not.toBe(await later.evaluate(ms=>{const d=new Date(ms);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);},mixAt));
   void local;
   await later.close();
   expect(errors).toEqual([]);
  });
 });
}
