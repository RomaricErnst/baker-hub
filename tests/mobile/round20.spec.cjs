const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 20 (25 Nov 2026), EN and FR:
// 3: a recorded mix (15 min late through "Different time?", or "Done now" before the plan) keeps a plan: no clash line,
//    one Start Dough on the Recipe, and Adjust timing opens on the recorded mix with a valid plan.
// 4: one jar for two bakes tells one story: the follower's Preparation header is its first shown starter step, its
//    levain build is at the shared feed's ratio, and its shopping list counts the starter's flour once.
// 7: home shows the soonest plan not started; a bake still to come offers no rating and no Bake again; a removal
//    names the bake; "⋯" is "Options for <name>".
// 8: Preparation › Fillings lists every topping the shopping list has, with the standard bottom bar.
// 10: at most one note above the steps after a recorded mix.
// Owner (skip the pizzas): the Recipe goes on to shopping and preparation, pizzas are one optional row, and the
//    Pizzas screen has no top skip link; its button reads "Skip toppings →" until a pizza is picked.
const H=3600000;
const NOW=Date.parse('2026-11-25T02:00:00Z'); // Wed 10:00am in Singapore
test.use({timezoneId:'Asia/Singapore'});
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');

function session(extra={}){
 return {version:1,savedAt:NOW-H,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:24,humidity:'normal',fridgeTemp:6,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:NOW+30*H,eatTime:NOW+36*H,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',...extra};
}
const entryFor=(id,s,updatedAt)=>({v:1,id,createdAt:updatedAt,updatedAt,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,itemWeight:s.itemWeight,kitchenTemp:s.kitchenTemp,eatTime:s.eatTime,session:s,rating:null,note:'',photoIds:[],accountEventId:null});
async function seeded(page,storage,path,now=NOW){
 await page.clock.install({time:new Date(now)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r20-seeded'))return;sessionStorage.setItem('r20-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
 await page.goto(path);
}
async function visit(context,at,fr){
 const page=await context.newPage();
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 return page;
}
async function section(page,fr,name){
 const t=page.locator('.bh-bake-navigator-trigger:visible').first();
 await t.scrollIntoViewIfNeeded();
 if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).first().tap();
}
async function generateNeapolitan(page,fr,bake,temp='22'){
 await page.getByRole('button',{name:/^Pizza/}).first().tap();
 await page.getByRole('button',{name:fr?/^Napolitaine/:/^Classic Neapolitan/}).first().tap();
 await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
 await forward(page).tap();
 await page.getByRole('slider').first().fill(temp);
 await forward(page).tap();
 const date=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await date.fill(bake);await date.blur();
 const go=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
 await expect(go).toBeEnabled({timeout:20000});await go.tap();
 await page.waitForTimeout(800);
 const keep=page.locator('[data-decision-sheet] [data-simple-keep-all]');if(await keep.count())await keep.first().tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
}
// One line, whole: no ellipsis (a .bh-cta-text span narrower than its text) and one row of text.
const fitsOneLine=locator=>locator.evaluate(el=>{
 const span=el.querySelector('.bh-cta-text');if(span&&span.scrollWidth>span.clientWidth+1)return false;
 const range=document.createRange();range.selectNodeContents(span??el);
 const tops=new Set([...range.getClientRects()].filter(r=>r.width>1).map(r=>Math.round(r.top)));
 return tops.size===1&&el.scrollWidth<=el.clientWidth+1;
});
const resume=async(page,fr)=>{const r=page.getByRole('button',{name:fr?/Reprendre|Voir les ingrédients/:/Resume|View ingredients/}).first();await expect(r).toBeVisible({timeout:20000});await r.tap();};

for(const fr of [false,true]){
 const L=(en,f)=>fr?f:en, path=fr?'/fr':'/', lang=fr?'fr':'en';
 test.describe(`round 20 (${lang})`,()=>{
  test.use({locale:fr?'fr-FR':'en-GB'});

  test('3: a mix recorded 15 minutes late keeps a plan: no clash, one Start Dough, Adjust timing on the recorded mix',async({context})=>{
   test.setTimeout(150000);
   const plan=await visit(context,'2026-11-25T12:00:00+08:00',fr);
   await generateNeapolitan(plan,fr,'2026-11-26T19:30');
   const mixAt=(await stored(plan)).startTime;
   await plan.close();
   const page=await visit(context,mixAt+25*60000,fr);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await resume(page,fr);
   await section(page,fr,L('Preparation','Préparation'));
   // Preparation opens on the step the clock is on (Start Dough); from the overview, open it.
   const startStep=page.getByRole('button',{name:fr?/^Pétrir la pâte/:/^Start Dough/});
   if(!(await page.getByRole('checkbox',{name:L(/Step done/,/Étape faite/)}).count())&&await startStep.count())await startStep.first().tap();
   const done=page.getByRole('checkbox',{name:L(/Step done/,/Étape faite/)}).first();
   await done.scrollIntoViewIfNeeded();await done.check();
   await page.getByRole('button',{name:L('Different time?','À une autre heure ?')}).first().tap();
   const late=new Date(mixAt+15*60000);const local=new Date(+late-late.getTimezoneOffset()*60000).toISOString().slice(0,16);
   await page.getByLabel(L(/Actual time|Mixing time/,/Heure réelle|Heure du pétrissage/)).first().fill(local);
   await page.locator('[data-done-time]:visible, .bh-start-status:visible').getByRole('button',{name:L('Set time','Enregistrer'),exact:true}).first().tap();
   await expect.poll(async()=>(await stored(page))?.execution?.actualAt,{timeout:10000}).toBe(mixAt+15*60000);
   expect((await stored(page)).executionClash).toBe(false);
   await expect(page.locator('[data-plan-clash]:visible')).toHaveCount(0);
   // The Recipe lists Start Dough once.
   await section(page,fr,L('Recipe','Recette'));
   const all=page.getByRole('button',{name:L(/^All steps/,/^Toutes les étapes/)}).first();
   if(await all.count())await all.tap();
   const plan2=page.locator('[data-recipe-plan]:visible').first();
   await expect(plan2.getByText(L('Start Dough','Pétrir la pâte'),{exact:true})).toHaveCount(1);
   await expect(page.locator('[data-plan-clash]:visible')).toHaveCount(0);
   // Adjust timing: the recorded mix, a valid plan, no "No time fits".
   await section(page,fr,L('Preparation','Préparation'));
   const overview=page.getByRole('button',{name:L(/Overview/,/Vue d’ensemble/)});
   if(await overview.count())await overview.first().tap();
   await page.getByRole('button',{name:L('Adjust timing','Ajuster les horaires'),exact:true}).first().tap();
   await expect(page.getByText(L('No time fits all steps. Try a later bake time.','Aucun horaire ne convient à toutes les étapes. Essayez une cuisson plus tardive.'))).toHaveCount(0);
   await expect(page.getByText(L('The plan needs another available time','Le planning demande un autre horaire disponible'))).toHaveCount(0);
   expect(errors).toEqual([]);
  });

  test('3: "Done now" before the plan records the tap\'s minute and keeps the plan (no busy times)',async({context})=>{
   test.setTimeout(120000);
   const plan=await visit(context,'2026-11-28T08:00:00+08:00',fr);
   await generateNeapolitan(plan,fr,'2026-11-28T19:00','31');
   const mixAt=(await stored(plan)).startTime;
   await plan.close();
   const tapAt=mixAt-20*60000;
   const page=await visit(context,tapAt,fr);
   await resume(page,fr);
   await section(page,fr,L('Preparation','Préparation'));
   const doneNow=page.getByRole('button',{name:L('Done now','Terminé maintenant'),exact:true});
   const overview=page.getByRole('button',{name:L(/Overview/,/Vue d’ensemble/)});
   if(!(await doneNow.count())&&await overview.count())await overview.first().tap();
   await doneNow.first().tap();
   await expect.poll(async()=>(await stored(page))?.execution?.actualAt??0,{timeout:10000}).toBeGreaterThan(0);
   const s=await stored(page);
   expect(Math.abs(s.execution.actualAt-tapAt)).toBeLessThan(2*60000);
   expect(s.executionClash).toBe(false);
   await expect(page.locator('[data-plan-clash]:visible')).toHaveCount(0);
   // At most one note above the steps (item 10): no clash line, no "Plan updated" box in Preparation.
   await expect(page.locator('[data-plan-moved]:visible')).toHaveCount(0);
  });

  test('7: home shows the soonest plan; a bake to come has no rating or Bake again; removal names the bake',async({page})=>{
   const lunch=session({bakeName:'Lunch',startTime:NOW+2.25*H,eatTime:NOW+8*H});
   const dinner=session({bakeName:'Dinner',startTime:NOW+30*H,eatTime:NOW+36*H});
   await seeded(page,{bh_session_v1:JSON.stringify(dinner),bh_journal_v1:JSON.stringify([entryFor('dinner',dinner,NOW-H),entryFor('lunch',lunch,NOW-3*H)]),bh_journal_current_v1:'dinner'},path);
   const rows=page.locator('[data-live-bake]');
   await expect(rows).toHaveCount(1);
   await expect(rows.first()).toHaveAttribute('data-live-bake','lunch');
   const dots=page.getByRole('button',{name:L('Options for Lunch','Options pour Lunch'),exact:true});
   await dots.tap();
   const sheet=page.getByRole('dialog');
   await expect(sheet.locator('[data-rate-now]')).toHaveCount(0);
   await expect(sheet.getByRole('button',{name:L(/^Bake again/,/^Refaire/)})).toHaveCount(0);
   await sheet.getByRole('button',{name:L('Delete from this device','Supprimer de cet appareil'),exact:true}).tap();
   await expect(page.locator('[data-journal-removed="lunch"]')).toContainText(L('Lunch removed ·','Lunch supprimée ·'));
  });

  test('8: Preparation › Fillings lists every topping, with the standard bottom bar',async({page})=>{
   const s=session({startTime:NOW+2*H,eatTime:NOW+8*H,pizzaParty:{qtys:{diavola:2,marinara:2}}});
   await seeded(page,{bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor('one',s,NOW-H)]),bh_journal_current_v1:'one'},path);
   await resume(page,fr);
   await section(page,fr,L('Preparation','Préparation'));
   await page.getByRole('button',{name:L('Fillings','Garnitures'),exact:true}).tap();
   for(const name of L(['Spicy Calabrian salami','Garlic','Dried oregano','Fresh chilli'],['Salami calabrais épicé','Ail','Origan séché','Piment frais']))
    await expect(page.getByText(name,{exact:true}).filter({visible:true}).first()).toBeVisible();
   const bar=page.locator('.bh-step-actions:visible').last();
   await expect(bar.getByRole('button').first()).toHaveAccessibleName(L('Back to Shopping list','Retour aux courses'));
   await expect(bar.locator('[data-prep-to-oven]')).toHaveAccessibleName(L('Baking & serving →','Cuisson & service →'));
   await expect(page.getByRole('button',{name:L('Cook pizzas →','Cuire les pizzas →')})).toHaveCount(0);
  });

  test('owner: pizzas are optional — Recipe goes on to shopping, one "Add pizzas" row, "Skip toppings"',async({page})=>{
   const s=session();
   await seeded(page,{bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor('one',s,NOW-H)]),bh_journal_current_v1:'one'},path);
   await resume(page,fr);
   await section(page,fr,L('Recipe','Recette'));
   const bar=page.locator('.bh-recipe-next:visible').last();
   await expect(bar.locator('[data-recipe-next]')).toHaveAccessibleName(L('Shopping & prep →','Courses et prépa →'));
   expect(await fitsOneLine(bar.locator('[data-recipe-next]')),'Recipe button on one line').toBe(true);
   const add=page.locator('[data-add-fillings]:visible');
   await expect(add).toHaveText(L('Add pizzas (optional)','Ajouter des pizzas (facultatif)'));
   await add.tap();
   await expect(page.locator('[data-skip-fillings]')).toHaveCount(0);
   const companion=page.locator('[data-companion-action]:visible');
   await expect(companion.getByRole('button').last()).toHaveText(L('Skip toppings →','Sans garniture →'));
   expect(await fitsOneLine(companion.getByRole('button').last()),'Pizzas button on one line').toBe(true);
   // Owner (25 Nov 2026): the tally rides in the Your bake bar once a pizza is picked.
   const tally=page.locator('[data-navigator-bake]').filter({hasText:L(/of 4 chosen/,/sur 4 choisie/)});
   await expect(tally).toHaveCount(0);
   const card=page.getByRole('button',{name:/^Margherita(?: · \d+)?$/});
   await card.getByRole('button',{name:/^\+/}).tap();
   await expect(page.locator('[data-navigator-bake]')).toHaveText(L('· 1 of 4 chosen','· 1 sur 4 choisie'));
   for(let i=0;i<4;i++)await card.getByRole('button',{name:/^\+/}).tap();
   await expect(page.locator('[data-navigator-bake]')).toHaveText(L('· 5 of 4 chosen','· 5 sur 4 choisies'));
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await expect(page.locator('[data-navigator-bake]')).toBeInViewport();
   const search=page.getByRole('searchbox').first();
   if(await search.count()){await search.tap();await expect(page.locator('[data-navigator-bake]')).toBeInViewport();await search.blur();}
   for(let i=0;i<5;i++)await card.getByRole('button',{name:/^[−-]/}).first().tap();
   await expect(tally).toHaveCount(0);
   await expect(companion.getByRole('button').last()).toHaveText(L('Skip toppings →','Sans garniture →'));
   await companion.getByRole('button').last().tap();
   await expect(page.locator('.bh-navigator-current')).toContainText(L('Shopping list','Liste de courses'));
   await section(page,fr,L('Recipe','Recette'));
   await bar.locator('[data-recipe-next]').tap();
   await expect(page.locator('.bh-navigator-current')).toContainText(L('Shopping list','Liste de courses'));
  });

  test('4: one jar, two bakes: header, levain build and shopping tell the shared feed',async({context})=>{
   test.setTimeout(240000);
   const pizza=await visit(context,'2026-11-25T20:00:00+08:00',fr);
   await pizza.getByRole('button',{name:/^Pizza/}).first().tap();
   await pizza.getByRole('button',{name:fr?/^Pizza au levain/:/^Sourdough pizza/}).first().tap();
   await pizza.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
   await forward(pizza).tap();
   await pizza.getByRole('slider').first().fill('22');
   await forward(pizza).tap();
   await pizza.getByRole('button',{name:L('In the fridge','Au réfrigérateur'),exact:true}).tap();
   await forward(pizza).tap();
   const date=pizza.getByLabel(L('Bake date and time','Date et heure de cuisson'),{exact:true});
   await date.fill('2026-11-28T19:30');await date.blur();
   await pizza.getByRole('button',{name:L('Generate my recipe','Générer ma recette'),exact:true}).tap();
   await pizza.waitForTimeout(800);
   const keep=pizza.locator('[data-decision-sheet] [data-simple-keep-all]');if(await keep.count())await keep.first().tap();
   await expect.poll(async()=>(await stored(pizza))?.recipeGenerated,{timeout:20000}).toBe(true);
   await pizza.close();
   const loaf=await visit(context,'2026-11-25T20:05:00+08:00',fr);
   await loaf.getByRole('button',{name:L('Bread & meals','Pain & repas'),exact:true}).tap();
   await loaf.getByRole('button',{name:'Pain au levain',exact:true}).tap();
   await loaf.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
   await forward(loaf).tap();
   if(await loaf.getByRole('slider').count()){await loaf.getByRole('slider').first().fill('22');await forward(loaf).tap();}
   await loaf.getByRole('button',{name:L('In the fridge','Au réfrigérateur'),exact:true}).tap();
   await forward(loaf).tap();
   const d2=loaf.getByLabel(L('Bake date and time','Date et heure de cuisson'),{exact:true});
   await d2.fill('2026-11-27T11:30');await d2.blur();
   await loaf.getByRole('button',{name:L('Generate my recipe','Générer ma recette'),exact:true}).tap();
   await loaf.waitForTimeout(800);
   const keep2=loaf.locator('[data-decision-sheet] [data-simple-keep-all]');if(await keep2.count())await keep2.first().tap();
   await expect.poll(async()=>(await stored(loaf))?.recipeGenerated,{timeout:20000}).toBe(true);
   const shared=await loaf.locator('[data-starter-feed-line]').filter({hasText:L(/for both bakes/,/pour les deux fournées/)}).count();
   await loaf.close();
   test.skip(shared===0,'no shared feed for these two bakes at this clock');
   const page=await visit(context,'2026-11-25T20:07:00+08:00',fr);
   const pizzaRow=page.locator('[data-live-bake]').filter({hasText:/pizza/i}).first();
   await pizzaRow.tap();
   await section(page,fr,L('Recipe','Recette'));
   // The levain build at the shared feed's ratio (never the pizza's own 1:1:1 beside a shared 1:R:R).
   const sharedLine=await page.locator('[data-starter-feed-line]').filter({hasText:L(/for both bakes/,/pour les deux fournées/)}).first().textContent();
   const ratio=sharedLine.match(/1:(\d+(?:[.,]\d+)?):/)?.[1];
   expect(ratio).toBeTruthy();
   await expect(page.locator('[data-recipe-stages]').first()).toContainText(`1:${ratio}:${ratio}`);
   // Shopping: the starter's flour once, no "Active starter —".
   await section(page,fr,L('Shopping list','Liste de courses'));
   await expect(page.getByText(L(/includes \d+ g in the starter/,/dont \d+\s*g dans le levain/)).filter({visible:true})).toHaveCount(0);
   await expect(page.getByText(L('Active starter','Levain actif'),{exact:true}).filter({visible:true})).toHaveCount(0);
   // Preparation's header names the bake's first shown step: the jar's, not the pizza's own later one.
   const s=await stored(page);
   expect(s.recipeGenerated).toBe(true);
  });
 });
}
