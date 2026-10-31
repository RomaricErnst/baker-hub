const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
test.use({timezoneId:'UTC'});
const NOW=Date.parse('2026-11-04T22:00Z'),H=3600000;
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')));
async function seed(page,{locale='en',method='biga',lead=36,bread=false,mode='custom',extra={},expectStatus=true}={}){
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 const data={version:1,savedAt:NOW-48*H,tab:mode,bakeType:bread?'bread':'pizza',bakeName:'Friday bake',styleKey:bread?'baguette':'neapolitan',numItems:4,itemWeight:260,ovenType:bread?'standard_bread':'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:method,prefermentFlourPct:20,prefOffsetH:method==='biga'?48:method==='poolish'?18:0,prefGoesInFridge:true,flourInFridge:false,startTime:method==='none'?NOW-H:NOW+10*H,eatTime:NOW+lead*H,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',...extra};
 await page.addInitScript(data=>{if(sessionStorage.getItem('execution-seeded'))return;sessionStorage.setItem('execution-seeded','1');localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:'plan',reviewMode:true}));},data);
 await page.goto(locale==='fr'?'/fr':'/');
 if(expectStatus)await expect(page.getByRole('region',{name:extra.yeastType==='sourdough'?(locale==='fr'?'Rafraîchi du levain':'Starter feeding'):(locale==='fr'?'Préparation de la fournée':'Bake preparation')})).toBeVisible();
 return data;
}
for(const locale of ['en','fr'])for(const bread of [false,true])test(`${locale} ${bread?'bread':'pizza'}: missed start, cancel, accept and reload`,async({page},testInfo)=>{
 const fr=locale==='fr',original=await seed(page,{locale,bread});
 const status=page.getByRole('region',{name:fr?'Préparation de la fournée':'Bake preparation'});
 await expect(status.getByRole('button',{name:fr?/^Oui, le/:/^Yes, at/})).toBeVisible();
 await expect.poll(async()=>(await stored(page)).execution).toBeUndefined();
 await status.getByRole('button',{name:fr?'Pas encore · Actualiser le plan':'Not yet · Update plan',exact:true}).tap();
 const proposal=page.getByRole('region',{name:fr?'Nouveau plan':'Updated plan'}).filter({visible:true});
 await expect(proposal).toBeVisible();
 await expect.poll(async()=>(await stored(page)).prefermentType).toBe(original.prefermentType);
 await proposal.getByRole('button',{name:fr?'Retour':'Back',exact:true}).tap();
 await expect(status).toBeVisible();
 await status.getByRole('button',{name:fr?'Pas encore · Actualiser le plan':'Not yet · Update plan',exact:true}).tap();
 await expect(proposal.locator('[data-replan-method]').first()).toBeVisible();
 const method=await proposal.locator('[data-replan-method]').first().getAttribute('data-replan-method');
 await testInfo.attach('updated-plan',{body:await page.screenshot({path:`/tmp/bake-plan-${locale}-${bread?'bread':'pizza'}.png`}),contentType:'image/png'});
 await proposal.locator('[data-replan-method]').first().tap();
 await expect.poll(async()=>(await stored(page)).prefermentType).toBe(method);
 await expect.poll(async()=>{const s=await stored(page);return s.startTime-s.prefOffsetH*H>NOW;}).toBe(true);
 expect((await stored(page)).eatTime).toBe(original.eatTime);
 await page.reload();
 const resume=page.getByRole('button',{name:/^Resume|^Reprendre/}).first();if(await resume.isVisible())await resume.tap();
 await expect.poll(async()=>(await stored(page)).prefermentType).toBe(method);
 expect((await stored(page)).execution).toBeUndefined();
});
test('made record persists actual time, recipe and dose; correction preserves ingredients',async({page})=>{
 const original=await seed(page,{method:'poolish'});
 const status=page.getByRole('region',{name:'Bake preparation'});
 await status.getByRole('button',{name:/^Yes, at/}).tap();
 await expect.poll(async()=>!!(await stored(page)).execution).toBe(true);
 const first=(await stored(page)).execution;
 expect(first.actualAt).toBe(original.startTime-original.prefOffsetH*H);
 await status.getByRole('button',{name:'Change time',exact:true}).tap();
 await status.getByLabel('Actual time',{exact:true}).fill('2026-11-04T13:30');
 await status.getByRole('button',{name:'Set time',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).execution.actualAt).toBe(Date.parse('2026-11-04T13:30Z'));
 expect((await stored(page)).execution.recipe).toEqual(first.recipe);
 await expect(status.getByText('Have you made the poolish?',{exact:true})).toHaveCount(0);
 await status.getByRole('button',{name:'Undo completion',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).execution).toBeUndefined();
});

test('short lead explicitly replaces biga with direct dough',async({page})=>{
 await seed(page,{lead:12});
 await page.getByRole('button',{name:'Not yet · Update plan',exact:true}).tap();
 const proposal=page.getByRole('region',{name:'Updated plan'}).filter({visible:true});
 await expect(proposal.locator('[data-replan-method]').first()).toHaveAttribute('data-replan-method','none');
 await proposal.locator('[data-replan-method]').first().tap();
 await expect.poll(async()=>(await stored(page)).prefermentType).toBe('none');
 await expect.poll(async()=>(await stored(page)).computedRecipe?.hasPreferment).toBe(false);
});

for(const locale of ['en','fr'])test(`${locale}: mixing is one completed action; reload preserves it and not-yet replans once`,async({page})=>{
 const fr=locale==='fr',original=await seed(page,{locale,method:'none'});
 const status=page.getByRole('region',{name:fr?'Préparation de la fournée':'Bake preparation'});
 const question=fr?'Avez-vous pétri la pâte ?':'Have you mixed the dough?';
 await expect(status.getByText(question,{exact:true})).toBeVisible();
 await status.getByRole('button',{name:fr?/^Oui, le/:/^Yes, at/}).tap();
 await expect.poll(async()=>(await stored(page)).execution?.actualAt).toBe(original.startTime);
 const mixed=(await stored(page)).execution;
 expect(mixed.method).toBe('none');
 await expect(status.getByText(question,{exact:true})).toHaveCount(0);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(status.getByRole('button',{name:/finish|finished|terminer|terminé/i})).toHaveCount(0);
 await page.reload();
 const resume=page.getByRole('button',{name:/^Resume|^Reprendre/}).first();if(await resume.isVisible())await resume.tap();
 await expect(status.getByRole('button',{name:fr?'Modifier l’heure':'Change time',exact:true})).toBeVisible();
 expect((await stored(page)).execution).toEqual(mixed);
 await expect(status.getByText(question,{exact:true})).toHaveCount(0);
 await status.getByRole('button',{name:fr?'Annuler la confirmation':'Undo completion',exact:true}).tap();
 await expect(status.getByText(question,{exact:true})).toBeVisible();
 await status.getByRole('button',{name:fr?'Pas encore · Actualiser le plan':'Not yet · Update plan',exact:true}).tap();
 const proposal=page.getByRole('region',{name:fr?'Nouveau plan':'Updated plan'}).filter({visible:true});
 await expect(proposal.locator('[data-replan-method]').first()).toBeVisible();
 await proposal.locator('[data-replan-method]').first().tap();
 await expect(proposal).toHaveCount(0);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect.poll(async()=>(await stored(page)).startTime).toBeGreaterThan(NOW);
 expect((await stored(page)).eatTime).toBe(original.eatTime);
 expect((await stored(page)).execution).toBeUndefined();
});


test('post-preferment overdue mixing is confirmed once without changing the made preferment',async({page})=>{
 await seed(page,{method:'poolish'});
 const status=page.getByRole('region',{name:'Bake preparation'});
 await status.getByRole('button',{name:/^Yes, at/}).tap();
 await expect.poll(async()=>!!(await stored(page)).execution).toBe(true);
 const prepared=(await stored(page)).execution;
 // Reopen the same bake after its mixing time, leaving the made preferment intact.
 const before=await stored(page),later=before.startTime+H;
 await page.clock.setFixedTime(later);
 await page.reload();
 const resume=page.getByRole('button',{name:/^Resume/}).first();if(await resume.isVisible())await resume.tap();
 await expect(status.getByText('Have you mixed the dough?',{exact:true})).toBeVisible();
 await status.getByRole('button',{name:/^Yes, at/}).tap();
 await expect.poll(async()=>(await stored(page)).mixExecution?.actualAt).toBe(before.startTime);
 const mixed=(await stored(page)).mixExecution;
 expect((await stored(page)).execution).toEqual(prepared);
 expect((await stored(page)).eatTime).toBe(before.eatTime);
 await expect(status.getByText('Have you mixed the dough?',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();
 const resumed=page.getByRole('button',{name:/^Resume/}).first();if(await resumed.isVisible())await resumed.tap();
 await expect(status.getByRole('button',{name:'Change time',exact:true})).toBeVisible();
 expect((await stored(page)).mixExecution).toEqual(mixed);
 expect((await stored(page)).execution).toEqual(prepared);
 await expect(status.getByText('Have you mixed the dough?',{exact:true})).toHaveCount(0);
});

for(const confirm of [true,false])test(`sourdough missed feed ${confirm?'confirmed':'not yet'} persists through reload without repeated questions`,async({page})=>{
 const plannedAt=NOW-H;
 const original=await seed(page,{method:'none',extra:{yeastType:'sourdough',prefermentType:'levain',startTime:NOW+10*H,planningMode:'last_fed',lastFedTime:NOW-48*H,lastFedAge:'days23',starterLocation:'rt',starterState:'rt_fed',lastFeedRatio:2,nextFeedRatio:2,ratioMode:'keep',starterTimingValid:true,starterEvents:[{kind:'last_fed',time:NOW-48*H},{kind:'refresh',time:plannedAt,feedingRatio:2}]}});
 const feed=page.getByRole('region',{name:'Starter feeding'});
 await expect(feed.getByText('Have you fed the starter?',{exact:true})).toBeVisible();
 await feed.getByRole('button',{name:confirm?/^Yes, at/:'Not yet · Update plan'}).tap();
 await expect(feed).toHaveCount(0);
 const saved=await stored(page);
 expect(saved.eatTime).toBe(original.eatTime);
 if(confirm){expect(saved.starterFeedRecords).toHaveLength(1);expect(saved.starterFeedRecords[0].actualAt).toBe(plannedAt);expect(saved.lastFedTime).toBe(plannedAt);}
 else {expect(saved.starterFeedRecords??[]).toHaveLength(0);expect(saved.lastFedTime).toBe(original.lastFedTime);}
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();
 const resume=page.getByRole('button',{name:/^Resume/}).first();if(await resume.isVisible())await resume.tap();
 await expect(feed).toHaveCount(0);
 expect((await stored(page)).starterFeedRecords??[]).toEqual(saved.starterFeedRecords??[]);
 expect((await stored(page)).eatTime).toBe(original.eatTime);
 if(confirm){
  await expect.poll(async()=>(await stored(page)).starterTimingValid).toBe(true);
  expect((await stored(page)).startTime).toBeGreaterThan(NOW);
 }
});


test('reopening during starter recovery preserves history and never revives the missed feed',async({page})=>{
 const lastFed=NOW-48*H;
 const original=await seed(page,{method:'none',expectStatus:false,extra:{yeastType:'sourdough',prefermentType:'levain',startTime:NOW+10*H,planningMode:'last_fed',lastFedTime:lastFed,lastFedAge:'days23',starterLocation:'rt',starterState:'rt_fed',lastFeedRatio:2,nextFeedRatio:2,ratioMode:'keep',starterTimingValid:false,starterRecoveryPending:true,protocolStale:true,starterEvents:[{kind:'last_fed',time:lastFed}]}});
 const feed=page.getByRole('region',{name:'Starter feeding'});
 await expect(page.getByRole('button',{name:'Review timing',exact:true})).toBeVisible();
 await expect(feed).toHaveCount(0);
 const validRecovery=async()=>{
  const s=await stored(page);
  const futureFeeds=(s.starterEvents??[]).filter(e=>['refresh','intermediate_refresh','pre_mix'].includes(e.kind));
  return s.starterRecoveryPending===true||(s.starterTimingValid===true&&s.startTime>NOW&&futureFeeds.every(e=>e.time>NOW));
 };
 await expect.poll(validRecovery).toBe(true);
 await page.reload();
 const resume=page.getByRole('button',{name:/^Resume/}).first();if(await resume.isVisible())await resume.tap();
 await expect(feed).toHaveCount(0);
 await expect.poll(validRecovery).toBe(true);
 expect((await stored(page)).lastFedTime).toBe(lastFed);
 expect((await stored(page)).eatTime).toBe(original.eatTime);
 expect((await stored(page)).starterFeedRecords??[]).toHaveLength(0);
 const review=page.getByRole('button',{name:'Review timing',exact:true});
 if(await review.isVisible())await review.tap();
 await expect(page.getByText('Your baking plan',{exact:true}).filter({visible:true})).toBeVisible();
 await expect(feed).toHaveCount(0);
 await expect.poll(validRecovery).toBe(true);
});
