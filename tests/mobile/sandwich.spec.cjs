const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

async function seedBread(page,{style,locale,tab='guide'}){
 const bake=new Date();bake.setDate(bake.getDate()+4);bake.setHours(18,0,0,0);
 const piadina=style==='piadina';
 const session={version:1,savedAt:Date.now(),tab:'custom',bakeType:'bread',bakeName:'Bread and fillings audit',styleKey:style,numItems:6,itemWeight:piadina?140:110,pizzaDiameter:30,ovenType:piadina?'griddle':'standard_bread',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:+bake-(piadina?1:6)*3600000,eatTime:+bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:tab,sandwichParty:{familyId:style,qtys:{},completed:{},shopTicks:{},prepTicks:{},tab:'pick',ingredientOverrides:{}}};
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous UI test"}'}));
 await page.addInitScript(data=>{
  // Seed only the first load: reload must exercise actual saved progress.
  if(sessionStorage.getItem('sandwich-test-seeded'))return;
  sessionStorage.setItem('sandwich-test-seeded','1');
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:data.activeTab,reviewMode:true}));
 },session);
 await page.goto(locale==='fr'?'/fr':'/');
}
const savedParty=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'{}').sandwichParty);
async function noOverflow(page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}
async function inspectGuideAndOpenFillings(page,fr,style){
 const next=page.getByRole('button',{name:fr?'Étape suivante':'Next step',exact:true});
 await expect(next).toBeVisible({timeout:20000});
 let guideText='';
 for(let step=0;step<12;step++){
  const section=page.locator(`section[aria-label*=" · ${fr?'Étape':'Step'} "]:visible`);
  await expect(section).toHaveCount(1);
  guideText+='\n'+await section.innerText();
  await noOverflow(page);
  if(await next.isDisabled())break;
  await next.tap();
 }
 if(style==='piadina'){
  expect(guideText).toMatch(fr?/sans levure/:/unleavened/);
  expect(guideText).toMatch(fr?/Laisser reposer/:/Rest, covered/);
  expect(guideText).not.toMatch(fr?/Ajoutez la levure|Pointage|Apprêt/:/Add yeast|Bulk Fermentation|Final Proof/i);
 }else{
  expect(guideText).toMatch(/Poach the bagels/);
  expect(guideText).toMatch(/Bake the bagels/);
  expect(guideText).toMatch(/Poach a few bagels/);
 }
 await page.getByRole('button',{name:fr?'Sandwiches et garnitures →':'Sandwiches & fillings →',exact:true}).tap();
 await expect(page.getByRole('heading',{name:fr?'Vos piadinas':'Your bagels',exact:true})).toBeVisible();
}

for(const scenario of [
 {locale:'en',style:'bagel',recipe:'Smoked salmon & cream cheese',id:'bagel-saumon-cream-cheese',ingredient:'Cream cheese',ingredientId:'cream_cheese'},
 {locale:'fr',style:'piadina',recipe:'Jambon cru, squacquerone et roquette',id:'piadina-crudo-squacquerone',ingredient:'Squacquerone',ingredientId:'squacquerone'},
]){
 test(`${scenario.locale}: ${scenario.style} guide to customized sandwich, shopping, preparation, serving and resume`,async({page},testInfo)=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const fr=scenario.locale==='fr';
  await seedBread(page,scenario);
  await inspectGuideAndOpenFillings(page,fr,scenario.style);
  const article=page.getByRole('article').filter({has:page.getByRole('heading',{name:scenario.recipe,exact:true})});
  await article.getByRole('spinbutton',{name:`${fr?'Quantité':'Quantity'} ${scenario.recipe}`,exact:true}).fill('2');
  await article.getByRole('button',{name:fr?'Recette et garnitures':'Recipe and fillings',exact:true}).tap();
  const dialog=page.getByRole('dialog',{name:scenario.recipe,exact:true});
  await expect(dialog).toBeVisible();
  const input=dialog.getByRole('spinbutton',{name:scenario.ingredient,exact:true});
  await input.fill('20');
  await expect(input).toHaveValue('20');
  expect((await input.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(input).toHaveCSS('font-size','16px');
  await noOverflow(page);
  await testInfo.attach(`${scenario.style}-fillings`,{body:await dialog.screenshot(),contentType:'image/png'});
  await dialog.getByRole('button',{name:fr?'Terminé':'Done',exact:true}).tap();
  await expect(dialog).toBeHidden();
  await expect(article.getByText(fr?'Personnalisé':'Customized',{exact:true})).toBeVisible();
  // Closing the sheet must reveal the next action without an extra scroll.
  const review=page.getByRole('button',{name:fr?'Voir ma sélection · 2':'Review selection · 2',exact:true});
  await expect(review).toBeVisible();
  await expect(page.locator('#bh-bottom-nav')).not.toHaveAttribute('data-collapsed','true');
  await expect.poll(async()=>{
   const [button,nav]=await Promise.all([review.boundingBox(),page.locator('#bh-bottom-nav').boundingBox()]);
   return !!button&&!!nav&&nav.height>=60&&button.y>=0&&button.y+button.height<=nav.y+1;
  }).toBe(true);
  await testInfo.attach(`${scenario.style}-review-action-restored`,{body:await page.screenshot(),contentType:'image/png'});
  await review.tap();
  await page.getByRole('button',{name:fr?'Préparer mes courses →':'Build my shopping list →',exact:true}).tap();
  const cheese=page.getByRole('checkbox',{name:new RegExp(scenario.ingredient+'\\s+40 g')});
  await expect(cheese).toBeVisible();
  await cheese.check();
  await page.getByRole('button',{name:fr?'Passer aux préparations →':'Start preparation →',exact:true}).tap();
  const preparation=page.getByRole('checkbox').first();
  await expect(preparation).toBeVisible();await preparation.check();
  await page.getByRole('button',{name:fr?'Passer à l’assemblage →':'Start assembly →',exact:true}).tap();
  const ready=page.getByRole('button',{name:fr?'Un sandwich prêt':'One sandwich ready',exact:true});
  const undo=page.getByRole('button',{name:fr?'Annuler le dernier':'Undo last',exact:true});
  await expect(undo).toBeDisabled();
  await ready.tap();
  await expect.poll(async()=>(await savedParty(page))?.completed[scenario.id]).toBe(1);
  await undo.tap();
  await expect.poll(async()=>(await savedParty(page))?.completed[scenario.id]).toBe(0);
  await ready.tap();await ready.tap();
  await expect(page.getByRole('status').filter({hasText:fr?'Tout est prêt':'Everything is ready'})).toBeVisible();
  await expect.poll(async()=>(await savedParty(page))?.completed[scenario.id]).toBe(2);
  const beforeReload=await savedParty(page);
  expect(beforeReload.ingredientOverrides[scenario.id][scenario.ingredientId]).toBe(20);
  expect(Object.values(beforeReload.shopTicks)).toContain(true);
  expect(Object.values(beforeReload.prepTicks)).toContain(true);
  await noOverflow(page);
  await testInfo.attach(`${scenario.style}-served`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await page.reload();
  await page.getByRole('button',{name:fr?'Voir les ingrédients →':'View ingredients →',exact:true}).tap();
  await page.locator('.bh-header-menu').tap();
  await page.getByRole('dialog',{name:'Menu',exact:true}).getByRole('button',{name:fr?'Sandwiches et garnitures':'Sandwiches & fillings',exact:true}).tap();
  await expect(ready).toBeDisabled();
  await expect(undo).toBeEnabled();
  await expect.poll(()=>savedParty(page)).toEqual(beforeReload);
  await undo.tap();await expect.poll(async()=>(await savedParty(page))?.completed[scenario.id]).toBe(1);
  // A changed quantity invalidates completion and preparation for this recipe.
  await page.getByRole('navigation',{name:fr?'Étapes des sandwichs':'Sandwich steps',exact:true}).getByRole('button',{name:fr?'Choisir':'Choose',exact:true}).tap();
  await article.getByRole('spinbutton',{name:`${fr?'Quantité':'Quantity'} ${scenario.recipe}`,exact:true}).fill('3');
  await expect.poll(async()=>(await savedParty(page))?.completed[scenario.id]??0).toBe(0);
  await expect.poll(async()=>Object.values((await savedParty(page))?.prepTicks??{}).filter(Boolean).length).toBe(0);
  expect(errors).toEqual([]);
 });
}

test('French pocket pita: lighter filter, details dismissal and empty-stage recovery',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await seedBread(page,{style:'pita',locale:'fr',tab:'sandwiches'});
 await expect(page.getByRole('heading',{name:'Vos pitas',exact:true})).toBeVisible({timeout:20000});
 const nav=page.getByRole('navigation',{name:'Étapes des sandwichs',exact:true});
 await nav.getByRole('button',{name:'Courses',exact:true}).tap();
 await page.getByRole('button',{name:'Choisir mes sandwichs',exact:true}).tap();
 await page.getByRole('button',{name:'Plus légers',exact:true}).tap();
 await expect(page.getByText(/Au moins 20 % de calories/)).toBeVisible();
 const first=page.getByRole('article').first();
 await expect(first).toBeVisible();
 await first.getByRole('button',{name:'Recette et garnitures',exact:true}).tap();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect(dialog.getByText(/Calories estimées/)).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
 await noOverflow(page);
 await testInfo.attach('pita-lighter-options',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 expect(errors).toEqual([]);
});
