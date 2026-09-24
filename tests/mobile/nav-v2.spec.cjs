const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// These contracts cover the replacement journey. Legacy mobile specs remain
// intact as the reference for functionality outside this navigation change.
const destinations=['Ma fournée','Organisation','Recette','Courses','Préparation','Cuisson & service'];
// English labels match BAKE_DESTINATIONS in app/lib/bakeNavigation.ts.
const englishDestinations=['My bake','Setup','Recipe','Shopping','Preparation','Cooking & serving'];
const navigator=page=>page.locator('.bh-bake-navigator-trigger');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
async function anonymous(page){
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous journey test"}'}));
}
async function fits(page,locator){
 await expect(locator).toBeVisible();
 const b=await locator.boundingBox();
 expect(b.x).toBeGreaterThanOrEqual(-1);
 expect(b.x+b.width).toBeLessThanOrEqual(page.viewportSize().width+1);
}
async function unobscured(locator){
 await expect.poll(()=>locator.evaluate(el=>{
  const r=el.getBoundingClientRect();
  const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return !!top&&(top===el||el.contains(top));
 })).toBe(true);
}
async function noOverflow(page){
 const viewport=page.viewportSize().width;
 const geometry=await page.evaluate(expected=>({expected,innerWidth,visualWidth:visualViewport?.width,htmlWidth:document.documentElement.scrollWidth,htmlClientWidth:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth,bodyClientWidth:document.body.clientWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>expected+1;}).slice(-20).map(el=>({tag:el.tagName,className:String(el.className),text:el.textContent.slice(0,100),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}))}),viewport);
 if(geometry.htmlWidth>viewport)await test.info().attach('horizontal-overflow-geometry',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
 expect(geometry.htmlWidth,JSON.stringify(geometry)).toBeLessThanOrEqual(viewport);
}
async function navigate(page,label,locale='fr'){
 await navigator(page).scrollIntoViewIfNeeded();
 if(await navigator(page).getAttribute('aria-expanded')!=='true')await navigator(page).tap();
 const nav=page.getByRole('navigation',{name:locale==='fr'?'Votre fournée':'Your bake',exact:true});
 await expect(nav.getByRole('button').locator('strong')).toHaveText(locale==='fr'?destinations:englishDestinations);
 await fits(page,nav);
 for(const button of await nav.getByRole('button').all()){
  await fits(page,button);
  expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
 }
 await nav.getByRole('button').filter({has:page.getByText(label,{exact:true})}).tap();
 await expect(navigator(page)).toContainText(label);
 await expect(navigator(page)).toHaveAttribute('aria-expanded','false');
 await noOverflow(page);
}
async function seed(page,{mode='custom',bread=true,activeTab='plan',style,locale='fr'}={}){
 await anonymous(page);
 const bake=new Date();bake.setDate(bake.getDate()+4);bake.setHours(18,0,0,0);
 const data={version:1,savedAt:Date.now(),tab:mode,bakeType:bread?'bread':'pizza',bakeName:'Navigation audit',styleKey:style||(bread?'baguette':'neapolitan'),numItems:4,itemWeight:bread?250:260,pizzaDiameter:30,ovenType:bread?'standard_bread':'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:+bake-24*3600000,eatTime:+bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab,navigation:{batchView:'style',protocolView:'dough',serviceView:'dough',returnTo:null},sandwichParty:{familyId:style||'baguette',qtys:{},completed:{},shopTicks:{},prepTicks:{},tab:'pick',ingredientOverrides:{}}};
 await page.addInitScript(data=>{
  if(sessionStorage.getItem('nav-v2-seeded'))return;
  sessionStorage.setItem('nav-v2-seeded','1');
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:data.activeTab,reviewMode:true}));
 },data);
 await page.goto(locale==='fr'?'/fr':'/');
 await expect(navigator(page)).toBeVisible();
 return data;
}

for(const bread of [false,true])test(`English generated ${bread?'bread':'pizza'}: all destinations, shopping and preparation are usable`,async({page},testInfo)=>{
 await seed(page,{bread,locale:'en'});
 for(const label of ['My bake','Setup','Recipe','Cooking & serving','Shopping','Preparation']){
  await navigate(page,label,'en');
  if(label==='Shopping'){
   await expect(page.getByRole('checkbox').first()).toBeVisible();
   const checkbox=page.getByRole('checkbox').first();
   await checkbox.check();await expect(checkbox).toBeChecked();
  }
  if(label==='Preparation'){
   await expect(page.getByRole('button',{name:'Dough',exact:true})).toHaveAttribute('aria-pressed','true');
   const next=page.getByRole('button',{name:/^Next(?: step| :)/});
   await next.tap();
   await expect(page.locator('section[aria-label*=" · Step "]:visible')).toHaveCount(1);
  }
 }
 await noOverflow(page);
 await testInfo.attach('english-preparation',{body:await page.screenshot(),contentType:'image/png'});
});

for(const mode of ['simple','custom'])for(const bread of [false,true]){
 test(`${mode} ${bread?'bread':'pizza'}: style and quantity precede mode, optional fillings preserve the batch`,async({page},testInfo)=>{
  await anonymous(page);await page.goto('/fr');
  await expect(navigator(page)).toHaveCount(0);
  await page.getByRole('button',{name:bread?'Pain':'Pizza',exact:true}).tap();
  await expect(page.getByRole('heading',{name:bread?'Choisissez votre pain':'Quel style de pizza ?',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Comment définir votre recette ?',exact:true})).toHaveCount(0);
  const style=page.locator('.bh-batch-content').getByRole('button',{name:bread?/^Baguette\b/:/Napolitaine/i});
  await style.tap();
  const quantity=page.getByLabel(bread?'Nombre de pains':'Nombre de pizzas',{exact:true});
  await quantity.fill('5');await quantity.blur();
  await expect.poll(async()=>({style:(await stored(page))?.styleKey,count:(await stored(page))?.numItems})).toEqual({style:bread?'baguette':'neapolitan',count:5});
  const chosenStyle=(await stored(page)).styleKey;
  const choose=page.getByRole('button',{name:'Choisir mes garnitures',exact:true});
  await choose.scrollIntoViewIfNeeded();
  await fits(page,choose);
  await unobscured(choose);
  expect((await choose.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button',{name:'Choisir mes garnitures',exact:true}).tap();
  await expect(bread?page.getByRole('article').first():page.getByRole('button',{name:'Margherita',exact:true})).toBeVisible();
  await page.locator('[data-companion-action]').getByRole('button',{name:'← Précédent',exact:true}).tap();
  await expect(quantity).toHaveValue('5');
  expect((await stored(page)).styleKey).toBe(chosenStyle);
  const organise=page.locator('.bh-batch-actions').getByRole('button',{name:'Définir ma recette',exact:true});
  await organise.scrollIntoViewIfNeeded();
  await fits(page,organise);
  await unobscured(organise);
  const action=await organise.boundingBox();
  expect(action.height).toBeGreaterThanOrEqual(44);
  expect(action.y+action.height).toBeLessThanOrEqual(page.viewportSize().height+1);
  await noOverflow(page);
  await testInfo.attach('quantity-single-action-no-bottom-tabs',{body:await page.screenshot(),contentType:'image/png'});
  await organise.tap();
  await expect(page.getByRole('heading',{name:'Comment définir votre recette ?',exact:true})).toBeVisible();
  const modeHeading = await page.getByRole('heading',{name:'Comment définir votre recette ?',exact:true}).boundingBox();
  const sectionBar = await page.locator('.bh-bake-navigator').boundingBox();
  expect(modeHeading.y).toBeGreaterThanOrEqual(sectionBar.y + sectionBar.height);
  await page.getByRole('button',{name:mode==='simple'?/^(Me laisser guider|Guide me)\b/:/^Personnaliser ma recette\b/}).tap();
  await expect(page.getByRole('heading',{name:'Votre équipement',exact:true})).toBeVisible();
  await expect.poll(async()=>(await stored(page)).tab).toBe(mode);
  expect((await stored(page)).numItems).toBe(5);
  await navigate(page,'Ma fournée');
  await expect(quantity).toHaveValue('5');
  expect((await stored(page)).styleKey).toBe(chosenStyle);
 });

 test(`${mode} ${bread?'bread':'pizza'}: generated bake exposes six consistent destinations`,async({page},testInfo)=>{
  await seed(page,{mode,bread});
  const before=await stored(page);
  for(const label of ['Courses','Préparation','Cuisson & service','Recette','Organisation','Ma fournée']){
   await navigate(page,label);
   await expect(page.locator('#bh-bottom-nav')).toHaveCount(0);
  }
  const after=await stored(page);
  for(const key of ['tab','bakeType','styleKey','numItems','itemWeight','recipeGenerated'])expect(after[key],key).toEqual(before[key]);
  await testInfo.attach('six-destinations-return-to-bake',{body:await page.screenshot(),contentType:'image/png'});
 });
}

test('plain bread has useful shopping without requiring any filling selection',async({page},testInfo)=>{
 await seed(page,{bread:true,style:'pain_campagne'});
 await navigate(page,'Courses');
 const flour=page.getByRole('checkbox',{name:/farine/i}).first();
 await expect(flour).toBeVisible();
 await flour.check();
 await expect(flour).toBeChecked();
 await navigate(page,'Recette');
 await navigate(page,'Courses');
 await expect(flour).toBeChecked();
 expect(Object.keys((await stored(page)).sandwichParty?.qtys||{})).toHaveLength(0);
 await noOverflow(page);
 await testInfo.attach('plain-bread-shopping',{body:await page.screenshot(),contentType:'image/png'});
});

test('country bread offers illustrated tartines and keeps loaf quantities when returning',async({page},testInfo)=>{
 await anonymous(page);await page.goto('/fr');
 await page.getByRole('button',{name:'Pain',exact:true}).tap();
 await page.locator('.bh-batch-content').getByRole('button',{name:/^Pain de campagne/}).tap();
 const count=page.getByLabel('Nombre de pains',{exact:true});
 await count.fill('2');await count.blur();
 await expect(page.getByRole('button',{name:'Choisir mes garnitures',exact:true})).toBeVisible();
 const images=page.locator('.bh-fillings-example img');
 await expect(images).toHaveCount(3);
 await images.first().scrollIntoViewIfNeeded();
 await expect.poll(()=>images.evaluateAll(items=>items.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
 await noOverflow(page);
 await testInfo.attach('tartine-invitation',{body:await page.screenshot(),contentType:'image/png'});
 await page.getByRole('button',{name:'Choisir mes garnitures',exact:true}).tap();
 await expect(page.getByRole('article').first()).toBeVisible();
 await page.locator('[data-companion-action]').getByRole('button',{name:'← Précédent',exact:true}).tap();
 await expect(count).toHaveValue('2');
 await page.getByRole('button',{name:'Changer de pain',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Choisissez votre pain',exact:true})).toBeVisible();
 await expect.poll(async()=>(await stored(page))?.styleKey).toBe('pain_campagne');
});

for(const bread of [true,false])test(`late ${bread?'bread fillings':'pizza toppings'} return to the exact dough step and keep completion and quantities`,async({page},testInfo)=>{
 await seed(page,{activeTab:'guide',bread});
 await navigate(page,'Préparation');
 const next=page.getByRole('button',{name:/^(?:Étape suivante|Suivante :)/});
 await expect(next).toBeVisible();
 const done=page.getByRole('checkbox',{name:'Étape faite',exact:true});
 await done.check();
 await next.tap();
 await next.tap();
 const current=page.locator('section[aria-label*=" · Étape "]:visible');
 const stepLabel=await current.getAttribute('aria-label');
 const progress=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('bh_guide_done_v2:'))));
 expect(Object.keys(progress).length).toBeGreaterThan(0);
 const before=await stored(page);
 await page.getByRole('button',{name:bread?'Ajouter des sandwichs':'Choisir des garnitures',exact:true}).tap();
 if(bread){
  const article=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Jambon-beurre',exact:true})});
  await article.getByRole('spinbutton').fill('2');
  await article.getByRole('spinbutton').blur();
 }else{
  const card=page.getByRole('button',{name:/^Margherita(?: · \d+)?$/});
  await card.getByRole('button',{name:'+',exact:true}).tap();
  await card.getByRole('button',{name:'+',exact:true}).tap();
 }
 await expect.poll(async()=>bread?(await stored(page))?.sandwichParty?.qtys?.['baguette-jambon-beurre']:Object.values((await stored(page))?.pizzaParty?.qtys||{}).reduce((sum,n)=>sum+n,0)).toBe(2);
 await page.getByRole('button',{name:bread?'Voir ma sélection · 2':'Voir ma sélection · 2 pizzas',exact:true}).tap();
 const back=page.getByRole('button',{name:/^Revenir à la préparation(?: →)?$/});
 await back.scrollIntoViewIfNeeded();
 await fits(page,back);
 await unobscured(back);
 const b=await back.boundingBox();
 expect(b.height).toBeGreaterThanOrEqual(44);
 expect(b.y+b.height).toBeLessThanOrEqual(page.viewportSize().height+1);
 await testInfo.attach('late-fillings-return-action',{body:await page.screenshot(),contentType:'image/png'});
 await back.tap();
 await expect(navigator(page)).toContainText('Préparation');
 await expect(current).toHaveAttribute('aria-label',stepLabel);
 const choices=page.getByRole('region',{name:'À préparer',exact:true});
 await expect(choices.getByRole('button')).toHaveText(['La pâte','Les garnitures']);
 await expect(choices.getByRole('button',{name:'La pâte',exact:true})).toHaveAttribute('aria-pressed','true');
 await choices.getByRole('button',{name:'Les garnitures',exact:true}).tap();
 await expect(choices.getByRole('button',{name:'Les garnitures',exact:true})).toHaveAttribute('aria-pressed','true');
 await choices.getByRole('button',{name:'La pâte',exact:true}).tap();
 await expect(current).toHaveAttribute('aria-label',stepLabel);
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('bh_guide_done_v2:'))))).toEqual(progress);
 await expect.poll(async()=>bread?(await stored(page))?.sandwichParty?.qtys?.['baguette-jambon-beurre']:Object.values((await stored(page))?.pizzaParty?.qtys||{}).reduce((sum,n)=>sum+n,0)).toBe(2);
 const after=await stored(page);
 for(const key of ['styleKey','numItems','itemWeight','eatTime','recipeGenerated'])expect(after[key],key).toEqual(before[key]);
 if(bread)expect(after.sandwichParty.qtys['baguette-jambon-beurre']).toBe(2);
 else expect(Object.values(after.pizzaParty?.qtys||{})).toContain(2);
 await navigate(page,'Cuisson & service');
 if(bread){await expect(choices.getByRole('button')).toHaveText(['Guide de cuisson','Assembler et servir']);await choices.getByRole('button',{name:'Assembler et servir',exact:true}).tap();}
 else{await expect(choices).toHaveCount(0);await page.locator('.bh-guide-next:visible').tap();await page.getByRole('button',{name:'Commencer la cuisson des pizzas →',exact:true}).tap();await expect(page.getByRole('button',{name:'← Four et conseils de cuisson',exact:true})).toBeVisible();}
 if(bread)await expect(page.getByRole('button',{name:'Un sandwich prêt',exact:true})).toBeVisible();
 await navigate(page,'Préparation');
 await expect(current).toHaveAttribute('aria-label',stepLabel);
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('bh_guide_done_v2:'))))).toEqual(progress);
 await noOverflow(page);
 // The recommended forward path must include dough and baking, not jump
 // directly from shopping through toppings to serving.
 await navigate(page,'Courses');
 await page.getByRole('button',{name:'Commencer la préparation →',exact:true}).tap();
 await expect(choices.getByRole('button',{name:'La pâte',exact:true})).toHaveAttribute('aria-pressed','true');
 for(let step=0;step<25;step++){
  if(await page.getByRole('button',{name:/^Préparer les garnitures(?: →)?$/}).isVisible())break;
  await page.getByRole('button',{name:/^(?:Étape suivante|Suivante :)/}).tap();
 }
 await page.getByRole('button',{name:/^Préparer les garnitures(?: →)?$/}).tap();
 await expect(choices.getByRole('button',{name:'Les garnitures',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:bread?'Passer à la cuisson du pain →':'Cuire les pizzas →',exact:true}).tap();
 await expect(navigator(page)).toContainText('Cuisson & service');
 if(bread)await expect(choices.getByRole('button',{name:'Guide de cuisson',exact:true})).toHaveAttribute('aria-pressed','true');else await expect(choices).toHaveCount(0);
 const serveLabel=bread?'Assembler mes sandwichs →':'Commencer la cuisson des pizzas →';
 for(let step=0;step<12;step++){
  if(await page.getByRole('button',{name:serveLabel,exact:true}).isVisible())break;
  await page.getByRole('button',{name:/^(?:Étape suivante|Suivante :)/}).tap();
 }
 await page.getByRole('button',{name:serveLabel,exact:true}).tap();
 if(bread)await expect(choices.getByRole('button',{name:'Assembler et servir',exact:true})).toHaveAttribute('aria-pressed','true');else await expect(page.getByRole('button',{name:'← Four et conseils de cuisson',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('bh_guide_done_v2:'))))).toEqual(progress);
 await noOverflow(page);

});

test('late fillings opened from Recipe return to Recipe without changing the dough',async({page})=>{
 await seed(page,{bread:true});
 await navigate(page,'Recette');
 const before=await stored(page);
 await page.getByRole('button',{name:'Ajouter des sandwichs',exact:true}).tap();
 const article=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Jambon-beurre',exact:true})});
 await article.getByRole('spinbutton').fill('1');
 await article.getByRole('spinbutton').blur();
 await expect.poll(async()=>(await stored(page))?.sandwichParty?.qtys?.['baguette-jambon-beurre']).toBe(1);
 await page.getByRole('button',{name:'Voir ma sélection · 1',exact:true}).tap();
 await page.getByRole('button',{name:/^Revenir à la recette(?: →)?$/}).tap();
 await expect(navigator(page)).toContainText('Recette');
 await expect(page.getByRole('button',{name:'Modifier mes sandwichs',exact:true})).toBeVisible();
 const after=await stored(page);
 for(const key of ['styleKey','numItems','itemWeight','eatTime','recipeGenerated'])expect(after[key],key).toEqual(before[key]);
 await noOverflow(page);
});

test('bread family return preserves choices; wraps and meal examples are discoverable',async({page})=>{
 await anonymous(page);await page.goto('/fr');
 await page.getByRole('button',{name:'Pain',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Choisissez votre pain',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Pitas & wraps',exact:true})).toBeVisible();
 const wrap=page.getByRole('button',{name:/^Pain à wrap · Laffa/});
 await expect(wrap.locator('img')).toHaveCount(2);
 const brioche=page.getByRole('button',{name:/^Brioche\b/});await expect(brioche.locator('img')).toHaveCount(1);
 await page.getByRole('button',{name:/^Pita à poche/}).tap();
 const quantity=page.getByLabel('Nombre de pièces',{exact:true});await quantity.fill('5');await quantity.blur();
 await page.getByRole('button',{name:'Changer de pain',exact:true}).tap();
 await page.getByRole('button',{name:'← Pizza ou pain',exact:true}).tap();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Que souhaitez-vous préparer ?',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pain',exact:true}).tap();
 await page.getByRole('button',{name:/^Continuer avec/}).tap();
 await expect(quantity).toHaveValue('5');await noOverflow(page);
 await page.goBack();await expect(page.getByRole('heading',{name:'Choisissez votre pain',exact:true})).toBeVisible();
 await page.goForward();await expect(quantity).toHaveValue('5');
});

test('landing photos stay above text and bread meal examples are readable',async({page})=>{
 await anonymous(page);await page.goto('/fr');
 for(const card of await page.locator('.bh-opening-choice').all()){
  await expect(card).toBeVisible();
  expect(await card.evaluate(el=>{
   const media=el.querySelector('.bh-opening-foods').getBoundingClientRect();
   const copy=el.querySelector(':scope > span').getBoundingClientRect();
   return copy.top>=media.bottom-1&&[...el.querySelectorAll('img')].every(img=>{const r=img.getBoundingClientRect();return r.top>=media.top-1&&r.bottom<=media.bottom+1&&r.right<=media.right+1;});
  })).toBe(true);
 }
 await page.getByRole('button',{name:'Pain',exact:true}).tap();
 const loaves=page.locator('#bread-group-loaves').locator('..').locator('.bh-bread-style-card');
 await expect(loaves).toHaveCount(5);
 const sources=[];
 for(const card of await loaves.all()){
  await card.scrollIntoViewIfNeeded();
  const photos=card.locator('.bh-bread-photo');await expect(photos).toHaveCount(2);
  await expect.poll(()=>photos.locator('img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  for(const photo of await photos.all()){
   const frame=await photo.locator('.bh-bread-photo-frame').boundingBox();
   expect((await photo.locator('.bh-bread-photo-caption').boundingBox()).y).toBeGreaterThanOrEqual(frame.y+frame.height);
  }
  const meal=photos.nth(1);const box=await meal.boundingBox();expect(box.width).toBeGreaterThanOrEqual(100);expect(box.height).toBeGreaterThanOrEqual(120);
  expect((await card.locator('.bh-bread-card-copy').boundingBox()).y).toBeGreaterThanOrEqual(box.y+box.height);
  sources.push(await meal.locator('img').getAttribute('src'));
 }
 expect(new Set(sources).size).toBe(5);await noOverflow(page);
 await page.getByRole('button',{name:'Pain à wrap · Laffa',exact:true}).tap();
 await expect(page.getByLabel('Nombre de pièces',{exact:true})).toBeVisible();
});

for(const mode of ['simple','custom'])test(`${mode}: editable weight and sequential equipment preserve choices when going back`,async({page},testInfo)=>{
 await anonymous(page);await page.goto('/fr');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.locator('.bh-batch-content').getByRole('button',{name:/Napolitaine/i}).tap();
 const weight=page.getByLabel('Pâte par pizza (g)',{exact:true});
 const diameter=page.getByLabel('Diamètre',{exact:false});
 await expect(weight).toBeVisible();
 await expect(page.getByText(/Pâte totale avant/)).toHaveCount(0);
 await weight.fill('280');await weight.blur();
 await diameter.fill('32');await diameter.blur();
 await page.getByRole('button',{name:'Généreuse',exact:true}).tap();
 await expect(weight).toHaveValue('280');
 const reset=page.getByRole('button',{name:/^Revenir au poids conseillé/});
 await expect(reset).toBeVisible();await reset.tap();
 await expect(reset).toHaveCount(0);
 await expect(weight).not.toHaveValue('280');
 const recommended=Number(await weight.inputValue());
 await expect.poll(async()=>(await stored(page))?.itemWeight).toBe(recommended);
 await page.locator('.bh-batch-actions').getByRole('button',{name:'Définir ma recette',exact:true}).tap();
 await page.getByRole('button',{name:mode==='simple'?/^(Me laisser guider|Guide me)\b/:/^Personnaliser ma recette\b/}).tap();
 const step=page.locator('#step-3');
 await expect(step.getByRole('heading',{name:'Four',exact:true})).toBeVisible();
 await step.getByRole('button',{name:/Four à pizza compact/}).tap();
 await step.locator('.bh-step-actions').getByRole('button',{name:'Continuer',exact:true}).tap();
 await expect(step.getByRole('heading',{name:'Pétrissage',exact:true})).toBeVisible();
 await step.getByRole('button',{name:mode==='simple'?/KitchenAid \/ robot pâtissier/:/Robot pâtissier/}).tap();
 await step.locator('.bh-step-actions').getByRole('button',{name:'Précédent',exact:true}).tap();
 await expect(step.getByRole('heading',{name:'Four',exact:true})).toBeVisible();
 await expect.poll(async()=>(await stored(page))?.mixerType).toBe('stand');
 await step.locator('.bh-step-actions').getByRole('button',{name:'Continuer',exact:true}).tap();
 await step.locator('.bh-step-actions').getByRole('button',{name:'Continuer',exact:true}).tap();
 const climate=page.locator('#step-4');await expect(climate).toBeVisible();
 const back=climate.getByRole('button',{name:'Précédent',exact:true});
 await back.scrollIntoViewIfNeeded();await fits(page,back);await unobscured(back);
 await noOverflow(page);
 await testInfo.attach('climate-back-and-continue',{body:await page.screenshot(),contentType:'image/png'});
 await back.tap();
 await expect(step.getByRole('heading',{name:'Pétrissage',exact:true})).toBeVisible();
 await expect.poll(async()=>(await stored(page))?.mixerType).toBe('stand');
 expect((await stored(page)).ovenType).toBe('pizza_oven');
 if(mode==='simple')await step.getByText('Autre méthode',{exact:true}).tap();
 await step.getByRole('button',{name:/Pétrin (?:à spirale|spiral)/}).tap();
 await expect.poll(async()=>(await stored(page))?.waterMethod).toBe('direct');
 if(mode==='custom'){
  await step.locator('.bh-step-actions').getByRole('button',{name:'Continuer',exact:true}).tap();
  await climate.getByText('Préparation de l’eau · facultatif',{exact:true}).tap();
  const cooling=climate.getByRole('combobox',{name:/Si un refroidissement est nécessaire/});
  await expect(cooling).toHaveValue('direct');
  await expect(climate.getByText('Vérifiez que votre pétrin accepte la glace.',{exact:true})).toBeVisible();
  await cooling.selectOption('premelt');
  await climate.getByRole('button',{name:'Précédent',exact:true}).tap();
  await step.getByRole('button',{name:/Pétrin (?:à spirale|spiral)/}).tap();
  await expect.poll(async()=>(await stored(page))?.waterMethod).toBe('premelt');
 }
 await step.getByRole('button',{name:mode==='simple'?/KitchenAid \/ robot pâtissier/:/Robot pâtissier/}).tap();
 await expect.poll(async()=>(await stored(page))?.waterMethod).toBe('premelt');
});
