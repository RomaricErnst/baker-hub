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
const confirm=plan=>plan.getByRole('button',{name:'Valider ces horaires',exact:true});
const reset=page=>page.getByRole('button',{name:'Revenir à la recommandation',exact:true});
const row=(plan,id)=>plan.locator(`[data-key-timing="${id}"]`);
async function enter(plan,id,date){const r=row(plan,id);if(!await r.locator('input[type="datetime-local"]').count())await r.locator('.bh-key-time').click();await r.locator('input[type="datetime-local"]').fill(local(date));}
for(const mode of ['simple','custom'])test(`${mode}: inline draft, cancel, invalid edit and atomic commit`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const {plan,start,bake}=await openPlan(page,mode);
 await expect(reset(page)).toHaveCount(0);await expect(plan.getByText('Préchauffage',{exact:true})).toHaveCount(0);
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
 const mix=row(plan,'mix').getByRole('slider'),pref=row(plan,'pref').getByRole('slider');await expect(pref).toBeVisible();await expect(mix).toBeVisible();
 await mix.focus();await mix.press('ArrowDown');await expect(mix).toHaveValue(String(+start+900000));await expect(pref).toHaveValue(String(+start-12*3600000+900000));
 await pref.focus();await pref.press('ArrowDown');await expect(mix).toHaveValue(String(+start+900000));await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).prefOffsetH).toBe(11.75);expect((await stored(page)).startTime).toBe(+start+900000);expect((await stored(page)).eatTime).toBe(+bake);
 await page.reload();await expect(plan).toBeVisible();await expect(mix).toHaveValue(String(+start+900000));
 await enter(plan,'pref',new Date(+start-2*3600000));await expect(confirm(plan)).toBeDisabled();await expect(row(plan,'pref')).toContainText('Maturation du préferment');
});
test('blocked night permits passive preferment maturation, keeps morning mixing',async({page})=>{
 const {plan,start,bake}=await openPlan(page,'simple',[],true,true);await enter(plan,'pref',new Date(+start-16*3600000));await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).prefOffsetH).toBe(16);expect((await stored(page)).startTime).toBe(+start);expect((await stored(page)).eatTime).toBe(+bake);
});
test('levain known peak uses maturity window; observation never becomes a draggable feed',async({page})=>{
 const bake=new Date();bake.setDate(bake.getDate()+5);bake.setHours(18,0,0,0);const start=new Date(+bake-26*3600000);
 const {plan}=await openPlan(page,'custom',[],false,false,{yeastType:'sourdough',planningMode:'know_peak',knownPeakTime:+start,starterLocation:'rt',lastFeedRatio:1,ratioMode:'keep',starterTimingValid:true});
 await expect(row(plan,'mix').getByRole('slider')).toBeVisible();await expect(plan.locator('[data-key-timing^="starter:"] input[type="range"]')).toHaveCount(0);
 await enter(plan,'mix',new Date(+start+900000));await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();await expect.poll(async()=>(await stored(page)).startTime).toBe(+start+900000);expect((await stored(page)).eatTime).toBe(+bake);
 await enter(plan,'mix',new Date(+bake-3600000));await expect(confirm(plan)).toBeDisabled();await plan.getByRole('button',{name:'Annuler',exact:true}).click();expect((await stored(page)).startTime).toBe(+start+900000);
 await page.reload();await expect(plan).toBeVisible();await expect(row(plan,'mix').getByRole('slider')).toHaveValue(String(+start+900000));
});
for(const storage of ['rt','fridge'])test(`levain ${storage} future feeds use starter solver and cancel leaves saved plan intact`,async({page})=>{
 const {plan,bake}=await openPlan(page,'custom',[],false,false,{yeastType:'sourdough',planningMode:'last_fed',lastFedTime:Date.now()-(storage==='rt'?3*3600000:8*86400000),lastFedAge:storage==='rt'?'today':'week',starterLocation:storage,lastFeedRatio:1,nextFeedRatio:1,ratioMode:'keep',starterTimingValid:true});
 const mix=row(plan,'mix').getByRole('slider');await expect(mix).toBeVisible();const original=(await stored(page)).startTime;
 await mix.focus();await mix.press('ArrowDown');await expect(plan.locator('[data-key-timing^="starter:"]')).not.toHaveCount(0);
 await expect(confirm(plan)).toBeEnabled();await plan.getByRole('button',{name:'Annuler',exact:true}).click();expect((await stored(page)).startTime).toBe(original);
 await mix.focus();await mix.press('ArrowDown');await expect(confirm(plan)).toBeEnabled();await confirm(plan).click();
 await expect.poll(async()=>(await stored(page)).startTime).toBe(original+900000);expect((await stored(page)).eatTime).toBe(+bake);expect((await stored(page)).starterEvents.length).toBeGreaterThan(0);
 const events=(await stored(page)).starterEvents;await page.reload();await expect(plan).toBeVisible();expect((await stored(page)).starterEvents).toEqual(events);
 const feed=row(plan,'starter:pre_mix').getByRole('slider');await expect(feed).toBeVisible();const limits=[await feed.getAttribute('min'),await feed.getAttribute('max')];await feed.focus();await feed.press('ArrowDown');await expect(feed).toHaveAttribute('min',limits[0]);await expect(feed).toHaveAttribute('max',limits[1]);await expect(mix).toHaveValue(String(original+900000));await plan.getByRole('button',{name:'Annuler',exact:true}).click();
});
