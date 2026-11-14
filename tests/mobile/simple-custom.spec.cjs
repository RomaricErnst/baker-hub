const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T15:25:00+08:00');
const BAKE=Date.parse('2026-10-04T20:31:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const actions=page=>page.locator('.bh-step-actions:visible');
async function anonymous(page,now=NOW){
 await page.clock.setFixedTime(now);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
}
async function geometry(page){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(actions(page)).toHaveCount(1);
 await expect(actions(page)).toHaveCSS('position','fixed');
 const button=actions(page).getByRole('button').last();
 const rect=await button.boundingBox();
 expect(rect.height).toBeGreaterThanOrEqual(44);
 expect(rect.y+rect.height).toBeLessThanOrEqual(page.viewportSize().height);
}
async function nextToRecipe(page,fr){
 const plan=page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true});
 await expect(plan).toBeVisible();
 const create=actions(page).getByRole('button',{name:fr?'Créer ma recette':'Create my recipe',exact:true});
 await expect(create).toBeEnabled();
 await create.tap();
 await expect(page.locator('.bh-navigator-current')).toHaveText(fr?'Recette':'Recipe');
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
}

for(const locale of ['fr','en']){
 const fr=locale==='fr';
 test(`${locale}: fresh Custom confirms remembered kitchen and identifies each flour slot`,async({page})=>{
  await anonymous(page);
  await page.addInitScript(()=>{if(!localStorage.getItem('bh_profile_v1'))localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,ovenTypePizza:'home_oven_standard',mixerType:'hand',yeastType:'instant',fridgeTemp:5,preferredMode:'custom'}));});
  await page.goto(fr?'/fr':'/');
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
  await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
  await actions(page).locator('[data-bh-forward]:visible').tap();
  await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();
  const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
  await bakeDate.fill('2026-10-04T18:00');await bakeDate.blur();
  await expect(page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{const el=document.querySelector('[data-customize-link]');if(el){document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));el.scrollIntoView({block:'center'});}});
  await page.getByRole('button',{name:fr?/^Personnaliser ma fournée/:/^Customize my bake/}).tap();
  // Custom opens on equipment (oven, then mixing), preselected from the profile and said so;
  // leaving it settles the kitchen, then flour (Fridge & water is in Fine-tune since 14 Nov 2026).
  await expect(page.locator('#step-3')).toBeVisible();
  await expect(page.locator('#step-3 [data-equipment-profile]')).toBeVisible();
  await expect.poll(async()=>(await stored(page))?.customKitchenConfirmed).toBe(false);
  await actions(page).locator('[data-bh-forward]:visible').tap();
  await actions(page).locator('[data-bh-forward]:visible').tap();
  await expect.poll(async()=>(await stored(page))?.customKitchenConfirmed).toBe(true);
  const flour=page.locator('#step-6');
  await flour.getByRole('button',{name:/^Caputo Pizzeria W/}).tap();
  await flour.getByText(fr?'Ajouter une seconde farine':'Add a second flour',{exact:true}).tap();
  await expect(flour.getByRole('searchbox',{name:fr?'Rechercher une farine':'Search flours',exact:true})).toBeVisible();
  await expect(flour.getByText(/Flour 1 retained|Farine 1 conservée/)).toHaveCount(0);
  await expect(flour.getByRole('heading',{name:'Suggestions',exact:true})).toBeVisible();
  const filters=flour.locator('details').filter({has:page.locator('summary').filter({hasText:fr?/^Filtres/:/^Filters/})});
  const summary=filters.locator('summary');
  await expect.poll(()=>filters.evaluate(el=>el.getBoundingClientRect().bottom<=el.nextElementSibling.getBoundingClientRect().top)).toBe(true);
  await summary.tap();
  await filters.getByRole('combobox',{name:'Type',exact:true}).selectOption('bread_flour');
  await expect(flour.getByRole('heading',{name:/résultats|results/})).toBeVisible();
  await summary.tap();
  await expect(summary).toContainText(fr?'Farine de pain':'Bread flour');
  await summary.tap();
  await filters.getByRole('button',{name:fr?'Effacer la recherche et les filtres':'Clear search and filters'}).tap();
  await summary.tap();
  await expect(summary).toHaveText(fr?'Filtres':'Filters');
  await expect(flour.getByRole('button',{name:fr?'Scanner mon sac':'Scan my bag'})).toBeVisible();
  await geometry(page);
  await page.screenshot({path:test.info().outputPath('second-flour.png'),fullPage:true});
  await flour.getByRole('button',{name:/^Caputo Manitoba/}).tap();
  await expect.poll(async()=>(await stored(page))?.flourBlend?.customFlour2Name).toMatch(/Manitoba/);
  const before=(await stored(page)).flourBlend;
  await flour.getByRole('button',{name:fr?'Changer la farine 1':'Change flour 1',exact:true}).tap();
  await flour.getByRole('button',{name:fr?'Annuler':'Cancel',exact:true}).tap();
  expect((await stored(page)).flourBlend).toEqual(before);
  await flour.getByRole('button',{name:fr?'Changer la farine 2':'Change flour 2',exact:true}).tap();
  await flour.getByRole('button',{name:/^Caputo Semola/}).tap();
  await expect.poll(async()=>(await stored(page))?.flourBlend?.flour2).toBe('semolina');
  const after=(await stored(page)).flourBlend;
  expect(after.brandProduct).toBe(before.brandProduct);expect(after.ratio1).toBe(before.ratio1);
  const next = () => actions(page).locator('[data-bh-forward]:visible').tap();
  await next();
  await expect(page.locator('#step-8 [data-bh-forward]')).toBeDisabled();
  await page.locator('#step-8').getByRole('button',{name:/poolish/i}).first().tap();
  await next();
  await expect(page.locator('#step-7:visible')).toBeVisible();
  await next();
  await expect(page.locator('#step-10:visible')).toBeVisible();
  await geometry(page);
  // The bake time was answered before customizing: Fine-tune creates the recipe instead of asking it again.
  await expect(page.locator('#step-10 [data-finetune-generate]')).toHaveText(fr?'Créer ma recette':'Create my recipe');
  await expect.poll(async()=>(await stored(page))?.prefermentType).toBe('poolish');
 });
 test(`${locale}: fresh Simple pizza goes from quantity to timing before recipe generation and creates a recipe`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await anonymous(page);await page.goto(fr?'/fr':'/');
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
  await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
  const quantity=page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true});
  await quantity.fill('4');await quantity.blur();
  await actions(page).locator('[data-bh-forward]:visible').tap();
  await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();

  await expect.poll(async()=>({oven:(await stored(page))?.ovenType,mixer:(await stored(page))?.mixerType,yeast:(await stored(page))?.yeastType})).toEqual({oven:'home_oven_standard',mixer:'hand',yeast:'instant'});
  await geometry(page);
  const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
  await bakeDate.fill('2026-10-04T18:00');await bakeDate.blur();
  await expect(page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true}).tap();
  await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
  // The yeast row keeps a spoon measure and its own help toggle, which holds the fresh-yeast equivalent.
  const help=page.locator('[data-yeast-help]:visible').first();
  await expect(help.locator('summary')).toHaveText(fr?/^comment la peser ▾/:/^how to weigh it ▾/);
  await help.locator('summary').tap();
  await expect(help.locator('[data-yeast-alternatives]')).toContainText(fr?/^ou .* de levure fraîche$/:/^or .* fresh yeast$/);
  await page.locator('.bh-recipe-next:visible').getByRole('button',{name:fr?'Mes choix':'My choices'}).tap();await page.getByRole('button',{name:/^(Edit|Modifier) : (Quantity|Quantité)$/}).tap();
  await quantity.fill('3');await quantity.blur();
  await actions(page).locator('[data-bh-forward]:visible').tap();
  await expect(page.locator('.bh-navigator-current')).toContainText(fr?'Recette':'Recipe');
  // The recipe is only the recipe: timing lives in Preparation.
  await expect(page.getByRole('button',{name:fr?'Ajuster les horaires':'Adjust timing',exact:true})).toHaveCount(0);
  await expect.poll(async()=>(await stored(page))?.numItems).toBe(3);
  await page.locator('.bh-recipe-next:visible').getByRole('button',{name:fr?'Mes choix':'My choices'}).tap();await page.getByRole('button',{name:/^(Edit|Modifier) : (Quantity|Quantité)$/}).tap();
  await quantity.fill('4');await quantity.blur();
  await quantity.fill('3');await quantity.blur();
  await actions(page).locator('[data-bh-forward]:visible').tap();
  await expect(page.getByRole('heading',{name:fr?'Recette à mettre à jour':'Update your recipe',exact:true})).toHaveCount(0);

  await (async()=>{const t=page.locator('.bh-bake-navigator-trigger');if(await t.getAttribute('aria-expanded')!=='true')await t.tap();await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button',{name:fr?/^Préparation/:/^Preparation/}).first().tap();})();
  await page.locator('[data-preparation-timing]:visible').getByRole('button',{name:fr?'Ajuster les horaires':'Adjust timing',exact:true}).tap();
  await expect(page.locator('#step-7:visible')).toBeVisible();
  expect(errors).toEqual([]);
 });

 test(`${locale}: Custom poolish and formula survive Simple, reload and return to Custom`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  // This saved plan starts poolish at 12:40. Resume before that time;
  // resuming at 15:25 correctly blocks a not-yet-started preparation in the past.
  const resumeNow=Date.parse('2026-10-03T10:25:00+08:00');
  await anonymous(page,resumeNow);
  const data={version:1,savedAt:resumeNow,tab:'custom',bakeType:'pizza',bakeName:'Simple Custom regression',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'spiral',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},manualHydration:64,manualSalt:2.7,manualOil:0,manualSugar:0,prefermentType:'poolish',prefermentFlourPct:20,prefOffsetH:11,prefGoesInFridge:true,flourInFridge:false,startTime:Date.parse('2026-10-03T23:40:00+08:00'),eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:false,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:3,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup'};
  // Start from a real saved Custom review, then use its visible Mode action.
  data.modeChosen=true;data.setupOverview=true;
  await page.addInitScript(data=>{
   if(sessionStorage.getItem('simple-custom-seeded'))return;
   sessionStorage.setItem('simple-custom-seeded','1');
   localStorage.setItem('bh_session_v1',JSON.stringify(data));
   sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:3,advancedStep:9,setupOverview:true,activeTab:'setup',reviewMode:true}));
  },data);
  await page.goto(fr?'/fr':'/');
  // Before a recipe exists, the switch continues to the bake time.
  await page.locator('[data-mode-switch]').tap();
  const formula=async()=>{const s=await stored(page);return {tab:s?.tab,preferment:s?.prefermentType,hydration:s?.manualHydration,salt:s?.manualSalt,flour:s?.flourBlend};};
  await expect.poll(formula).toEqual({tab:'simple',preferment:'poolish',hydration:64,salt:2.7,flour:data.flourBlend});
  await page.reload();
  const resume=page.getByRole('button',{name:fr?'Reprendre →':'Resume →',exact:true});
  await expect(resume).toBeVisible();await resume.tap();
  await expect.poll(formula).toEqual({tab:'simple',preferment:'poolish',hydration:64,salt:2.7,flour:data.flourBlend});
  await nextToRecipe(page,fr);
  await expect(page.getByRole('region',{name:fr?'Quantités totales':'Total ingredients',exact:true})).toBeVisible();
  // The stages show directly, as they are made.
  const stages=page.locator('[data-recipe-stages]:visible');
  await expect(stages.getByText(/Poolish/).first()).toBeVisible();
  await page.getByRole('button',{name:fr?'Mes choix':'My choices',exact:true}).tap();
  await page.locator('[data-mode-switch]').tap();
  await expect(page.getByRole('heading',{level:1,name:fr?'Revoir mes choix':'Review my choices',exact:true})).toBeVisible();
  await expect.poll(formula).toEqual({tab:'custom',preferment:'poolish',hydration:64,salt:2.7,flour:data.flourBlend});
  expect(errors).toEqual([]);
 });
}

for(const locale of ['fr','en'])test(`${locale}: mixer batches open without changing the recipe and allow replacing 2 with 1`,async({page})=>{
 const fr=locale==='fr';await anonymous(page);
 await page.addInitScript(()=>localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,ovenTypePizza:'home_oven_standard',mixerType:'spiral',yeastType:'instant',fridgeTemp:5,preferredMode:'custom'})));
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
 await page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true}).fill('30'); // 7,800 g: more than the spiral holds, so the batch card shows (it shows only when splitting, 14 Nov 2026)
 await page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true}).blur();
 await actions(page).locator('[data-bh-forward]:visible').tap();
  await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();
  const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
  await bakeDate.fill('2026-10-04T18:00');await bakeDate.blur();
  await expect(page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{const el=document.querySelector('[data-customize-link]');if(el){document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));el.scrollIntoView({block:'center'});}});
  await page.getByRole('button',{name:fr?/^Personnaliser ma fournée/:/^Customize my bake/}).tap();
 await actions(page).locator('[data-bh-forward]:visible').tap();
 const section=page.getByRole('region',{name:fr?'Nombre de pétrissées':'Mixing batches',exact:true});
 // The card shows only when the dough needs splitting, already open on the recommended count.
 const input=section.getByRole('textbox');await expect(input).toHaveValue('2');
 await expect.poll(async()=>(await stored(page))?.mixingBatches).toBe(undefined);
 await section.getByRole('button',{name:fr?'Une pétrissée de plus':'One more batch'}).tap();await expect(input).toHaveValue('3');
 await input.fill('');await expect(input).toHaveValue('');await input.fill('1');await input.blur();await expect(input).toHaveValue('1');
 await expect.poll(async()=>(await stored(page))?.mixingBatches).toBe(1);
 await section.getByRole('button',{name:fr?'Utiliser la recommandation: 2':'Use recommended: 2',exact:true}).tap();
 // The mixer capacity is set inside Adjust.
 const capacity=page.getByLabel(fr?'Poids de pâte maximal (g)':'Maximum dough weight (g)',{exact:true});await capacity.fill('1000');await capacity.blur();
 await expect(input).toHaveValue('7');await geometry(page);
 await page.screenshot({path:test.info().outputPath('mixing-batches.png'),fullPage:true});
});

test('an obsolete yeast step in a levain draft recovers to a visible Custom page',async({page})=>{
 await anonymous(page);
 await page.addInitScript(({now,bake})=>{
  if(sessionStorage.getItem('recover-levain-once'))return;
  sessionStorage.setItem('recover-levain-once','1');
  const draft={version:1,savedAt:now,tab:'custom',bakeType:'bread',styleKey:'pain_levain',
   numItems:1,itemWeight:800,ovenType:'standard_bread',mixerType:'hand',yeastType:'sourdough',
   kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},
   prefermentType:'levain',startTime:bake-18*3600000,eatTime:bake,blocks:[],recipeGenerated:false,
   qtyChosen:true,flourChosen:true,prefermentChosen:false,modeChosen:true,advancedStep:7,
   advancedHighestStep:8,activeStep:7,highestStep:7,setupOverview:false,activeTab:'setup'};
  localStorage.setItem('bh_session_v1',JSON.stringify(draft));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:7,setupOverview:false,activeTab:'setup'}));
 },{now:NOW,bake:BAKE});
 await page.goto('/');
 // Levain styles have one leavening: levain is adopted and the draft lands on a visible page.
 const fineTune=page.locator('#step-10:visible');
 await expect(fineTune.locator('.bh-page-title')).toBeVisible();
 await expect.poll(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('bh_session_v1'))||'{}').prefermentType).toBe('levain');
 await expect(fineTune.locator('[data-bh-forward]')).toBeEnabled();
});
