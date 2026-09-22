const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

const cases=[
 {name:'simple-direct',locale:'fr',mode:'simple',style:'neapolitan',method:'none',temp:22,mixH:40},
 {name:'custom-poolish-hot',locale:'en',mode:'custom',style:'neapolitan',method:'poolish',temp:30,mixH:20},
 {name:'custom-biga-cool',locale:'fr',mode:'custom',style:'roman',method:'biga',temp:16,mixH:5},
 {name:'custom-starter-hot',locale:'en',mode:'custom',style:'pain_levain',method:'levain',temp:30,mixH:24},
];
for(const scenario of cases){
 test(`${scenario.name}: window, views, checks and time editor`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous test"}'}));
  const bake=new Date();bake.setDate(bake.getDate()+5);bake.setHours(18,0,0,0);
  const starter=scenario.method==='levain';
  const session={version:1,savedAt:Date.now(),tab:scenario.mode,bakeType:starter?'bread':'pizza',bakeName:'Window audit',styleKey:scenario.style,numItems:2,itemWeight:starter?800:250,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:starter?'sourdough':'instant',kitchenTemp:scenario.temp,humidity:'medium',fridgeTemp:5,flourBlend:null,prefermentType:scenario.method,prefermentFlourPct:20,prefOffsetH:scenario.method==='none'?0:16,prefGoesInFridge:true,flourInFridge:false,startTime:+bake-scenario.mixH*3600000,eatTime:+bake,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup',starterLocation:'rt',planningMode:'last_fed',lastFedAge:'today',lastFedTime:Date.now()-4*3600000,lastFeedRatio:2,nextFeedRatio:2,starterEvents:[],starterMature:true};
  await page.addInitScript(data=>{
   localStorage.setItem('bh_session_v1',JSON.stringify(data));
   sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));
  },session);
  const fr=scenario.locale==='fr';
  await page.goto(fr?'/fr':'/');
  const card=page.getByRole('region',{name:fr?'Votre créneau de pétrissage':'Your mixing window'});
  await expect(card).toBeVisible({timeout:20000});
  // Restored drafts are re-solved asynchronously after their first render.
  // Compare views only after the visible planning result has settled.
  let previous='',unchangedSince=Date.now();
  await expect.poll(async()=>{
   const current=await card.innerText();
   if(current!==previous){previous=current;unchangedSince=Date.now();}
   return Date.now()-unchangedSince;
  },{timeout:10000,intervals:[100]}).toBeGreaterThanOrEqual(1000);
  const text=await card.innerText();
  const box=await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('tab',{name:fr?'Planning visuel':'Visual schedule',exact:true}).tap();
  await expect(card).toBeVisible();
  expect(await card.innerText()).toEqual(text);
  await card.scrollIntoViewIfNeeded();
  await testInfo.attach(`${scenario.name}-window`,{body:await card.screenshot(),contentType:'image/png'});
  await card.locator('summary').tap();
  await expect(card.getByText(fr?'Températures du plan':'Plan temperatures',{exact:false})).toBeVisible();
  await card.locator('summary').tap();
  if(scenario.name==='simple-direct'){
   // Restoration can legitimately re-solve an uncommitted direct plan.
   // Make a real user edit to exercise outside-window feedback.
   await page.getByRole('tab',{name:'Actions',exact:true}).tap();
   await page.getByRole('tabpanel',{name:'Actions',exact:true}).getByRole('button').nth(1).tap();
   const early=new Date(+bake-40*3600000);
   await page.locator('input[type="datetime-local"]:visible').fill(new Date(+early-early.getTimezoneOffset()*60000).toISOString().slice(0,16));
   await page.getByRole('button',{name:'Valider',exact:true}).tap();
   await expect(card.getByText(/Avant le créneau conseillé/)).toBeVisible();
   await testInfo.attach('outside-window',{body:await card.screenshot(),contentType:'image/png'});
   await card.getByRole('button',{name:'Ajuster le pétrissage'}).tap();
   const editor=page.locator('input[type="datetime-local"]:visible');
   await expect(editor).toHaveCount(1);await expect(editor).toBeFocused();
   await expect(editor).toHaveCSS('font-size','16px');
   const next=new Date(+bake-20*3600000);
   const value=new Date(+next-next.getTimezoneOffset()*60000).toISOString().slice(0,16);
   await editor.fill(value);await page.getByRole('button',{name:'Valider',exact:true}).tap();
   await expect(card.getByText(/Dans le créneau/)).toBeVisible();
   await expect(page.getByRole('tab',{name:'Actions',exact:true})).toHaveAttribute('aria-selected','true');
   // Baking exactly when a block starts is a conflict, even with a good mix window.
   await page.getByRole('button',{name:'＋ Personnalisé',exact:true}).tap();
   await page.getByPlaceholder('Libellé — ex. Week-end en déplacement').fill('Indisponible cuisson');
   const local=d=>new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
   await page.locator('input[type="datetime-local"]:visible').nth(0).fill(local(bake));
   await page.locator('input[type="datetime-local"]:visible').nth(1).fill(local(new Date(+bake+3600000)));
   await page.getByRole('button',{name:'Ajouter',exact:true}).tap();
   await expect(card.getByText('Horaire à ajuster',{exact:true})).toBeVisible();
   await expect(card.getByText('Dans le créneau',{exact:true})).toHaveCount(0);
   await card.getByRole('button',{name:'Vérifier mes disponibilités',exact:true}).tap();
   await expect(page.getByRole('group',{name:'Mes disponibilités',exact:true})).toBeFocused();

  }
  expect(errors).toEqual([]);
 });
}
