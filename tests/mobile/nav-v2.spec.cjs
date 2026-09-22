const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// These contracts cover the replacement journey. Legacy mobile specs remain
// intact as the reference for functionality outside this navigation change.
const destinations=['Ma fournée','Organisation','Recette','Courses','Protocole','Cuisson & service'];
// English labels match BAKE_DESTINATIONS in app/lib/bakeNavigation.ts.
const englishDestinations=['My bake','Organisation','Recipe','Shopping','Preparation','Cooking & serving'];
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
 for(const label of ['My bake','Organisation','Recipe','Cooking & serving','Shopping','Preparation']){
  await navigate(page,label,'en');
  if(label==='Shopping'){
   await expect(page.getByRole('checkbox').first()).toBeVisible();
   const checkbox=page.getByRole('checkbox').first();
   await checkbox.check();await expect(checkbox).toBeChecked();
  }
  if(label==='Preparation'){
   await expect(page.getByRole('button',{name:'Dough',exact:true})).toHaveAttribute('aria-pressed','true');
   const next=page.getByRole('button',{name:'Next step',exact:true});
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
  await expect(page.getByRole('heading',{name:'Choisissez votre pâte',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'À votre façon',exact:true})).toHaveCount(0);
  const style=page.locator('.bh-batch-content').getByRole('button',{name:bread?/^Baguette\b/:/Napolitaine/i});
  await style.tap();
  await page.locator('.bh-batch-actions').getByRole('button',{name:'Choisir la quantité',exact:true}).tap();
  const quantity=page.getByLabel(bread?'Nombre de pains':'Nombre de pizzas',{exact:true});
  await quantity.fill('5');await quantity.blur();
  await expect.poll(async()=>({style:(await stored(page))?.styleKey,count:(await stored(page))?.numItems})).toEqual({style:bread?'baguette':'neapolitan',count:5});
  const chosenStyle=(await stored(page)).styleKey;
  const choose=page.locator('.bh-batch-actions').getByRole('button',{name:bread?'Choisir mes sandwichs':'Choisir mes pizzas',exact:true});
  await fits(page,choose);
  await unobscured(choose);
  expect((await choose.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.locator('.bh-batch-actions').getByRole('button',{name:bread?'Choisir mes sandwichs':'Choisir mes pizzas',exact:true}).tap();
  await expect(bread?page.getByRole('article').first():page.getByRole('button',{name:'Margherita',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'← Ma pâte et mes quantités',exact:true}).tap();
  await expect(quantity).toHaveValue('5');
  expect((await stored(page)).styleKey).toBe(chosenStyle);
  const organise=page.locator('.bh-batch-actions').getByRole('button',{name:'Continuer sans garnitures',exact:true});
  await organise.scrollIntoViewIfNeeded();
  await fits(page,organise);
  await unobscured(organise);
  const action=await organise.boundingBox();
  expect(action.height).toBeGreaterThanOrEqual(44);
  expect(action.y+action.height).toBeLessThanOrEqual(page.viewportSize().height+1);
  await noOverflow(page);
  await testInfo.attach('quantity-single-action-no-bottom-tabs',{body:await page.screenshot(),contentType:'image/png'});
  await organise.tap();
  await expect(page.getByRole('heading',{name:'À votre façon',exact:true})).toBeVisible();
  await page.getByRole('button',{name:mode==='simple'?/^Simple\b/:/^Personnalisé(?:\s|$)/}).tap();
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
  for(const label of ['Courses','Protocole','Cuisson & service','Recette','Organisation','Ma fournée']){
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
 await page.locator('.bh-batch-actions').getByRole('button',{name:'Choisir la quantité',exact:true}).tap();
 const count=page.getByLabel('Nombre de pains',{exact:true});
 await count.fill('2');await count.blur();
 await expect(page.getByRole('heading',{name:'Votre pain devient une tartine',exact:true})).toBeVisible();
 const images=page.locator('.bh-fillings-example img');
 await expect(images).toHaveCount(3);
 await images.first().scrollIntoViewIfNeeded();
 await expect.poll(()=>images.evaluateAll(items=>items.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
 await noOverflow(page);
 await testInfo.attach('tartine-invitation',{body:await page.screenshot(),contentType:'image/png'});
 await page.locator('.bh-batch-actions').getByRole('button',{name:'Choisir mes tartines',exact:true}).tap();
 await expect(page.getByRole('article').first()).toBeVisible();
 await page.getByRole('button',{name:'← Ma pâte et mes quantités',exact:true}).tap();
 await expect(count).toHaveValue('2');
 await page.getByRole('button',{name:'Changer de pâte',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Choisissez votre pâte',exact:true})).toBeVisible();
 await expect.poll(async()=>(await stored(page))?.styleKey).toBe('pain_campagne');
});

for(const bread of [true,false])test(`late ${bread?'bread fillings':'pizza toppings'} return to the exact dough step and keep completion and quantities`,async({page},testInfo)=>{
 await seed(page,{activeTab:'guide',bread});
 await navigate(page,'Protocole');
 const next=page.getByRole('button',{name:'Étape suivante',exact:true});
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
 const back=page.getByRole('button',{name:/^Revenir au protocole(?: →)?$/});
 await back.scrollIntoViewIfNeeded();
 await fits(page,back);
 await unobscured(back);
 const b=await back.boundingBox();
 expect(b.height).toBeGreaterThanOrEqual(44);
 expect(b.y+b.height).toBeLessThanOrEqual(page.viewportSize().height+1);
 await testInfo.attach('late-fillings-return-action',{body:await page.screenshot(),contentType:'image/png'});
 await back.tap();
 await expect(navigator(page)).toContainText('Protocole');
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
 await expect(choices.getByRole('button')).toHaveText(['Guide de cuisson',bread?'Assembler et servir':'Cuire les pizzas']);
 await choices.getByRole('button',{name:bread?'Assembler et servir':'Cuire les pizzas',exact:true}).tap();
 if(bread)await expect(page.getByRole('button',{name:'Un sandwich prêt',exact:true})).toBeVisible();
 await navigate(page,'Protocole');
 await expect(current).toHaveAttribute('aria-label',stepLabel);
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('bh_guide_done_v2:'))))).toEqual(progress);
 await noOverflow(page);
 // The recommended forward path must include dough and baking, not jump
 // directly from shopping through toppings to serving.
 await navigate(page,'Courses');
 await page.getByRole('button',{name:'Commencer le protocole →',exact:true}).tap();
 await expect(choices.getByRole('button',{name:'La pâte',exact:true})).toHaveAttribute('aria-pressed','true');
 for(let step=0;step<25;step++){
  if(await page.getByRole('button',{name:'Préparer les garnitures',exact:true}).isVisible())break;
  await page.getByRole('button',{name:'Étape suivante',exact:true}).tap();
 }
 await page.getByRole('button',{name:'Préparer les garnitures',exact:true}).tap();
 await expect(choices.getByRole('button',{name:'Les garnitures',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:bread?'Passer à la cuisson du pain →':'Cuire les pizzas →',exact:true}).tap();
 await expect(navigator(page)).toContainText('Cuisson & service');
 await expect(choices.getByRole('button',{name:'Guide de cuisson',exact:true})).toHaveAttribute('aria-pressed','true');
 const serveLabel=bread?'Assembler mes sandwichs →':'Cuire mes pizzas →';
 for(let step=0;step<12;step++){
  if(await page.getByRole('button',{name:serveLabel,exact:true}).isVisible())break;
  await page.getByRole('button',{name:'Étape suivante',exact:true}).tap();
 }
 await page.getByRole('button',{name:serveLabel,exact:true}).tap();
 await expect(choices.getByRole('button',{name:bread?'Assembler et servir':'Cuire les pizzas',exact:true})).toHaveAttribute('aria-pressed','true');
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
