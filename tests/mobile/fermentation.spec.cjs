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
   await expect(card.getByText(/Horaire à ajuster/)).toBeVisible();
   await expect(card.getByText(/Dans le créneau/)).toHaveCount(0);
   await card.getByRole('button',{name:'Vérifier mes disponibilités',exact:true}).tap();
   await expect(page.getByRole('group',{name:'Mes disponibilités',exact:true})).toBeFocused();

  }
  expect(errors).toEqual([]);
 });
}

test.describe('verified availability repair',()=>{
 test.use({timezoneId:'UTC'});
 test('later bake preserves both cold phases through the parent remount',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-26T12:00:00Z'));
  await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous test"}'}));
  const start=Date.parse('2026-09-27T16:00:00Z'),bake=Date.parse('2026-09-28T18:00:00Z');
  const session={version:1,savedAt:Date.parse('2026-09-26T12:00:00Z'),tab:'custom',bakeType:'pizza',bakeName:'Workday repair',styleKey:'neapolitan',numItems:2,itemWeight:250,pizzaDiameter:30,ovenType:'home_oven_steel',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:5,flourBlend:null,prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:true,flourInFridge:false,startTime:start,eatTime:bake,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup'};
  await page.addInitScript(data=>{
   localStorage.setItem('bh_session_v1',JSON.stringify(data));
   sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));
  },session);
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')));
  const card=page.getByRole('region',{name:'Your mixing window'});
  // Let restoration/recommendation settle; the subsequent edit is the baker's
  // actual chosen start, rather than an assumption about the restore solver.
  const settle=async()=>{
   let previous='',since=Date.now();
   await expect.poll(async()=>{
    const text=await card.innerText();
    if(text!==previous){previous=text;since=Date.now();}
    return Date.now()-since;
   },{timeout:10000,intervals:[100]}).toBeGreaterThanOrEqual(1500);
  };
  await page.goto('/');
  await expect(card).toBeVisible({timeout:20000});await settle();
  await page.getByRole('tab',{name:'Actions',exact:true}).tap();
  await page.getByRole('tabpanel',{name:'Actions',exact:true}).getByRole('button').nth(1).tap();
  await page.locator('input[type="datetime-local"]:visible').fill('2026-09-27T16:00');
  await page.getByRole('button',{name:'Done',exact:true}).tap();
  await expect.poll(async()=>{const s=await stored();return [s.startTime,s.eatTime];}).toEqual([start,bake]);
  const inspectColdPhases=async()=>{
   await page.getByRole('tab',{name:'Visual schedule',exact:true}).tap();
   const details=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Dough: fridge times'})});
   if(await details.getAttribute('open')===null)await details.locator('summary').tap();
   await expect(details.getByText(/^Refrigerate ·/)).toHaveCount(2);
   await expect(details.getByText(/^Remove from fridge ·/)).toHaveCount(2);
   return details;
  };
  await inspectColdPhases();
  // Work intersects the second cold exit/preheat, but not mixing or baking.
  // Keeping today's bake is impossible; a proposal must require acceptance.
  await page.getByRole('button',{name:'＋ Custom',exact:true}).tap();
  await page.getByPlaceholder('Label — e.g. Weekend away').fill('Work');
  await page.locator('input[type="datetime-local"]:visible').nth(0).fill('2026-09-28T09:00');
  await page.locator('input[type="datetime-local"]:visible').nth(1).fill('2026-09-28T18:00');
  await page.getByRole('button',{name:'Add block',exact:true}).tap();
  const accept=card.getByRole('button',{name:/^Bake at /});
  await expect(accept).toBeVisible();
  await expect(card.getByText(/Proposal checked against your unavailable times/)).toBeVisible();
  const proposalBox=await accept.boundingBox();
  expect(proposalBox.height).toBeGreaterThanOrEqual(44);
  expect(proposalBox.x).toBeGreaterThanOrEqual(0);
  expect(proposalBox.x+proposalBox.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const conflictText=await card.locator('p').filter({hasText:/ · Work$/}).innerText();
  await expect.poll(async()=>{const s=await stored();return [s.startTime,s.eatTime,s.blocks.length];}).toEqual([start,bake,1]);
  const proposedLabel=await accept.innerText();
  await accept.tap();
  await expect(accept).toHaveCount(0);
  await expect(card.getByText(conflictText,{exact:true})).toHaveCount(0);
  await expect(card.getByRole('button',{name:'Review my availability',exact:true})).toHaveCount(0);
  await settle();
  const accepted=await stored();
  expect(accepted.startTime).toBe(start);
  expect(accepted.eatTime).toBeGreaterThan(bake);
  expect(accepted.blocks).toEqual([{label:'Work',from:Date.parse('2026-09-28T09:00:00Z'),to:bake}]);
  const acceptedBakeText=await card.getByText(/^Planned bake ·/).innerText();
  const expectedProposal=await page.evaluate(ms=>{
   const d=new Date(ms),h=d.getHours(),m=d.getMinutes(),hour=h%12||12;
   return `Bake at ${d.toLocaleDateString('en-US',{weekday:'short'})} ${d.getDate()} ${d.toLocaleDateString('en-US',{month:'short'})} · ${hour}${m?':'+String(m).padStart(2,'0'):''}${h<12?'am':'pm'}`;
  },accepted.eatTime);
  expect(proposedLabel).toBe(expectedProposal);
  // Changing bake time remounts SchedulePicker. Switch views after that render,
  // wait through autosave, and ensure its mount solver has not replaced the plan.
  const details=await inspectColdPhases();
  await expect(page.getByRole('tabpanel',{name:'Visual schedule',exact:true}).getByText('Busy time',{exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Actions',exact:true}).tap();
  await settle();
  expect((await stored()).eatTime).toBe(accepted.eatTime);
  expect((await stored()).startTime).toBe(start);
  await expect(card.getByText(/^Planned bake ·/)).toHaveText(acceptedBakeText);
  await inspectColdPhases();
  await testInfo.attach('accepted-two-cold-repair',{body:await details.screenshot(),contentType:'image/png'});
  expect(errors).toEqual([]);
 });
});
