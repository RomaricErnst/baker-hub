const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const local=d=>new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
async function openPlan(page,mode='simple',blocks=[],preferment=false,night=false,extra={}){
 const bake=new Date();bake.setDate(bake.getDate()+5);bake.setHours(18,0,0,0);
 const start=new Date(+bake-26*3600000);
 if(night){start.setTime(+bake-11*3600000);blocks=[{from:+start-8*3600000,to:+start,label:'Night'}];}
 const data={version:1,savedAt:Date.now(),tab:mode,bakeType:'pizza',styleKey:'neapolitan',numItems:2,itemWeight:250,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:preferment?'poolish':'none',prefOffsetH:preferment?12:0,prefGoesInFridge:true,flourInFridge:false,startTime:+start,eatTime:+bake,blocks,recipeGenerated:!preferment,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup',...extra};
 await page.addInitScript(data=>{if(!sessionStorage.getItem('calendar-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('calendar-seeded','1');}sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));},data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/fr');const plan=page.getByRole('region',{name:'Vos moments clés',exact:true});await expect(plan).toBeVisible();return {plan,start,bake};
}
const confirm=plan=>plan.getByRole('button',{name:'Appliquer',exact:true});
const reset=page=>page.getByRole('button',{name:'Revenir aux horaires recommandés',exact:true});
const row=(plan,id)=>plan.locator(`[data-key-timing="${id}"]`);
async function expand(plan,id){const r=row(plan,id);if(!await r.locator('input[type="datetime-local"]').count())await r.locator('.bh-key-time').tap();await expect(r.locator('input[type="datetime-local"]')).toBeVisible();await expect(plan.locator('input[type="datetime-local"]')).toHaveCount(1);await expect(plan.locator('input[type="range"]')).toHaveCount(0);await expect(plan.locator('.bh-key-modify')).toHaveCount(1);await expect(r.locator('.bh-key-modify')).toHaveText('Fermer');}
async function enter(plan,id,date){await expand(plan,id);await row(plan,id).locator('input[type="datetime-local"]').fill(local(date));}
const expectAt=(plan,id,at)=>expect(row(plan,id)).toHaveAttribute('data-at',String(+at));
test('compact editor exposes one set of windows and accessible half-hour adjustments',async({page})=>{
 const {plan,start,bake}=await openPlan(page,'simple',[],true);
 await expect(plan.locator('input[type="datetime-local"]')).toHaveCount(0);
 await expect(plan.locator('.bh-key-window:visible')).toHaveCount(0);
 await expand(plan,'mix');await expect(plan.locator('.bh-key-window:visible')).toHaveCount(1);
 await row(plan,'mix').getByRole('button',{name:'+ 30 min',exact:true}).click();await expectAt(plan,'mix',+start+1800000);
 await expect(confirm(plan)).toBeEnabled();expect((await stored(page)).startTime).toBe(+start);
 await row(plan,'mix').getByRole('button',{name:'- 30 min',exact:true}).click();await expectAt(plan,'mix',+start);
 await expand(plan,'pref');await expect(plan.locator('.bh-key-window:visible')).toHaveCount(1);
 await expect(row(plan,'mix').locator('.bh-key-time')).toBeVisible();
 expect((await stored(page)).eatTime).toBe(+bake);
});
for(const mode of ['simple','custom'])test(`${mode}: inline draft, cancel, invalid edit and atomic commit`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const {plan,start,bake}=await openPlan(page,mode);
 await expect(reset(page)).toHaveCount(0);
 await expect(confirm(plan)).toHaveCount(0);await expect(plan.getByRole('button',{name:'Annuler',exact:true})).toHaveCount(0);
 await expand(plan,'mix');await expect(confirm(plan)).toHaveCount(0);await expect(row(plan,'mix').getByRole('button',{name:'- 30 min',exact:true})).toBeVisible();await expect(row(plan,'mix').getByRole('button',{name:'+ 30 min',exact:true})).toBeVisible();
 const interventions=plan.locator('details').filter({has:page.locator('summary').filter({hasText:'Voir toutes les interventions'})});
 await expect(interventions).not.toHaveAttribute('open','');
 await expect(plan.getByText('Préchauffage',{exact:true})).toBeHidden();
 await interventions.locator('summary').tap();
 await expect(plan.getByText('Préchauffage',{exact:true})).toBeVisible();
 const preheat=interventions.locator('li').filter({has:page.getByText('Préchauffage',{exact:true})});
 const preheatAt=Date.parse(await preheat.locator('time').getAttribute('datetime'));
 expect(preheatAt).toBeGreaterThan(+start);expect(preheatAt).toBeLessThan(+bake);
 await interventions.locator('summary').tap();
 const proposed=new Date(+start+900000);await enter(plan,'mix',proposed);await expect(confirm(plan)).toBeEnabled();
 expect((await stored(page)).startTime).toBe(+start);await plan.getByRole('button',{name:'Annuler',exact:true}).click();await expect(reset(page)).toHaveCount(0);
 await enter(plan,'mix',new Date(+bake-3600000));await expect(confirm(plan)).toBeDisabled();
 await enter(plan,'mix',proposed);await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).startTime).toBe(+proposed);expect((await stored(page)).eatTime).toBe(+bake);await expect(reset(page)).toBeVisible();
 await page.reload();await expect(plan).toBeVisible();expect((await stored(page)).startTime).toBe(+proposed);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);expect(errors).toEqual([]);
});
for(const mode of ['simple','custom'])test(`${mode}: preferment independent, mixing coupled, fixed bake`,async({page})=>{
 const {plan,start,bake}=await openPlan(page,mode,[],true);
 await expand(plan,'mix');await expand(plan,'pref');
 await expect(row(plan,'mix').locator('.bh-key-time')).toBeVisible();await expect(row(plan,'mix').locator('input[type="datetime-local"]')).toHaveCount(0);
 await enter(plan,'mix',new Date(+start+900000));await expectAt(plan,'mix',+start+900000);await expectAt(plan,'pref',+start-15*3600000+900000);
 await enter(plan,'pref',new Date(+start-15*3600000+1800000));await expectAt(plan,'mix',+start+900000);await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).prefOffsetH).toBe(14.75);expect((await stored(page)).startTime).toBe(+start+900000);expect((await stored(page)).eatTime).toBe(+bake);
 await page.reload();await expect(plan).toBeVisible();await expand(plan,'mix');await expectAt(plan,'mix',+start+900000);
 await enter(plan,'pref',new Date(+start-2*3600000));await expect(confirm(plan)).toBeDisabled();await expect(row(plan,'pref')).toContainText('Maturation du préferment');
});
test('blocked night permits passive preferment maturation, keeps morning mixing',async({page})=>{
 const {plan,start,bake}=await openPlan(page,'simple',[],true,true);await enter(plan,'pref',new Date(+start-16*3600000));await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).prefOffsetH).toBe(16);expect((await stored(page)).startTime).toBe(+start);expect((await stored(page)).eatTime).toBe(+bake);
});
test('levain known peak uses maturity window; observation never becomes a draggable feed',async({page})=>{
 const bake=new Date();bake.setDate(bake.getDate()+5);bake.setHours(18,0,0,0);const start=new Date(+bake-26*3600000);
 const {plan}=await openPlan(page,'custom',[],false,false,{yeastType:'sourdough',planningMode:'know_peak',knownPeakTime:+start,starterLocation:'rt',lastFeedRatio:1,ratioMode:'keep',starterTimingValid:true});
 await expand(plan,'mix');await expect(plan.locator('[data-key-timing^="starter:"] .bh-key-time')).toHaveCount(0);
 await enter(plan,'mix',new Date(+start+900000));await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();await expect.poll(async()=>(await stored(page)).startTime).toBe(+start+900000);expect((await stored(page)).eatTime).toBe(+bake);
 await enter(plan,'mix',new Date(+bake-3600000));await expect(confirm(plan)).toBeDisabled();await plan.getByRole('button',{name:'Annuler',exact:true}).click();expect((await stored(page)).startTime).toBe(+start+900000);
 await page.reload();await expect(plan).toBeVisible();await expand(plan,'mix');await expectAt(plan,'mix',+start+900000);
});
for(const storage of ['rt','fridge'])test(`levain ${storage} future feeds use starter solver and cancel leaves saved plan intact`,async({page})=>{
 const {plan,bake}=await openPlan(page,'custom',[],false,false,{yeastType:'sourdough',planningMode:'last_fed',lastFedTime:Date.now()-(storage==='rt'?3*3600000:8*86400000),lastFedAge:storage==='rt'?'today':'week',starterLocation:storage,lastFeedRatio:1,nextFeedRatio:1,ratioMode:'keep',starterTimingValid:true});
 await expand(plan,'mix');const original=(await stored(page)).startTime;
 await enter(plan,'mix',new Date(original+900000));await expect(plan.locator('[data-key-timing^="starter:"]')).not.toHaveCount(0);
 await expect(confirm(plan)).toBeEnabled();await plan.getByRole('button',{name:'Annuler',exact:true}).click();expect((await stored(page)).startTime).toBe(original);
 await enter(plan,'mix',new Date(original+900000));await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).startTime).toBe(original+900000);expect((await stored(page)).eatTime).toBe(+bake);expect((await stored(page)).starterEvents.length).toBeGreaterThan(0);
 const events=(await stored(page)).starterEvents;await page.reload();await expect(plan).toBeVisible();expect((await stored(page)).starterEvents).toEqual(events);
 await expand(plan,'mix');await expand(plan,'starter:pre_mix');const feedAt=Number(await row(plan,'starter:pre_mix').getAttribute('data-at'));await enter(plan,'starter:pre_mix',new Date(feedAt+900000));await expectAt(plan,'starter:pre_mix',+new Date(local(new Date(feedAt+900000))));await expectAt(plan,'mix',original+900000);await plan.getByRole('button',{name:'Annuler',exact:true}).click();
});

test('levain final-feed lock is a persistent edit, constrains mixing, releases and resets',async({page})=>{
 const {plan,bake}=await openPlan(page,'custom',[],false,false,{yeastType:'sourdough',planningMode:'last_fed',lastFedTime:Date.now()-3*3600000,lastFedAge:'today',starterLocation:'rt',lastFeedRatio:1,nextFeedRatio:1,ratioMode:'keep',starterTimingValid:true});
 const feed=row(plan,'starter:pre_mix');await expect(feed).toBeVisible();
 const feedAt=Number(await feed.getAttribute('data-at'));
 const mixAt=Number(await row(plan,'mix').getAttribute('data-at'));
 const history=plan.locator('[data-key-timing^="starter:last_fed"]');
 await expect(history).not.toHaveCount(0);await expect(history.locator('.bh-key-time, input, .bh-key-modify')).toHaveCount(0);
 await expect(history).toContainText('Déjà effectué');
 await expand(plan,'mix');
 const keep=row(plan,'mix').getByRole('checkbox',{name:'Conserver l’heure du rafraîchi pour la pâte',exact:true});
 await expect(keep).not.toBeChecked();await expect(confirm(plan)).toHaveCount(0);
 await keep.check();await expectAt(plan,'mix',mixAt);await expectAt(plan,'starter:pre_mix',feedAt);
 // A policy-only edit must be applicable even before any event time changes.
 await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).timingOverrides?.feedLocked).toBe(true);
 expect((await stored(page)).timingOverrides.feed).toBe(feedAt);
 await page.reload();await expect(plan).toBeVisible();await expand(plan,'mix');await expect(keep).toBeChecked();await expectAt(plan,'starter:pre_mix',feedAt);
 await enter(plan,'mix',new Date(mixAt+900000));await expectAt(plan,'mix',mixAt+900000);await expectAt(plan,'starter:pre_mix',feedAt);
 await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).startTime).toBe(mixAt+900000);expect((await stored(page)).eatTime).toBe(+bake);
 await expand(plan,'mix');await keep.uncheck();await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>Boolean((await stored(page)).timingOverrides?.feedLocked)).toBe(false);
 await enter(plan,'mix',new Date(mixAt+1800000));await expectAt(plan,'mix',mixAt+1800000);
 await expect(feed).not.toHaveAttribute('data-at',String(feedAt));await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expand(plan,'mix');await expect(keep).not.toBeChecked();await keep.check();await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).timingOverrides?.feedLocked).toBe(true);
 await reset(page).click();await expect.poll(async()=>Boolean((await stored(page)).timingOverrides?.feedLocked)).toBe(false);
 expect((await stored(page)).timingOverrides?.feed).toBeUndefined();expect((await stored(page)).eatTime).toBe(+bake);
 await page.reload();await expect(plan).toBeVisible();await expand(plan,'mix');await expect(keep).not.toBeChecked();expect((await stored(page)).eatTime).toBe(+bake);
});
