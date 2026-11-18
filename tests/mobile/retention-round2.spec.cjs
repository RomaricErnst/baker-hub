const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 17 Nov 2026 retention round 2: the bake-day guide follows the clock and the baker's ticks.
// Maya: 6 pizzas, Singapore 30 °C, dough Fri 6:00pm, bake Sat 7:30pm (short bulk straight to the fridge).
// Thomas: baguettes and a pain de campagne the same weekend, switching between them.
const H=3600000;
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')));
const bar=page=>page.locator('.bh-bake-navigator').first();
const RECIPE={flour:893,water:580,salt:25,totalDough:1498};

function pizzaSession(extra={}){
 const start=Date.parse('2026-11-20T10:00:00Z'),eat=Date.parse('2026-11-21T11:30:00Z');
 return {version:1,savedAt:start-24*H,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:6,itemWeight:250,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:30,humidity:'humid',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:start,eatTime:eat,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',
  execution:{method:'none',actualAt:start,recordedAt:start+60000,prefHours:0,inFridge:false,recipe:RECIPE},...extra};
}
const entryFor=(id,session,more={})=>({v:1,id,createdAt:session.savedAt,updatedAt:session.savedAt,bakeType:session.bakeType,styleKey:session.styleKey,bakeName:session.bakeName??'',numItems:session.numItems,itemWeight:session.itemWeight,kitchenTemp:session.kitchenTemp,eatTime:session.eatTime,session,rating:null,note:'',photoIds:[],accountEventId:null,...more});

async function open(page,{at,tz='Asia/Singapore',locale='en-SG',path='/',storage}){
 await page.clock.install({time:at});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r2-seeded'))return;sessionStorage.setItem('r2-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
 await page.goto(path);
}
const mayaStorage=(session=pizzaSession(),more={})=>({bh_session_v1:JSON.stringify(session),bh_journal_v1:JSON.stringify([entryFor('maya-1',session,more)]),bh_journal_current_v1:'maya-1'});

// One bake under way: home is the single-bake Resume card (18 Nov 2026 retention round 3: rows only with two).
const resumeOne=async page=>{await expect(page.locator('[data-live-bakes]')).toHaveCount(0);await page.getByRole('button',{name:/^(Resume|View ingredients) →$/}).tap();};
test.use({timezoneId:'Asia/Singapore',locale:'en-SG'});

test('EN: Step done moves the bar and Go to at once; the overview opens on the step the bar names; no step numbers; no under-bulk scare',async({page})=>{
 await open(page,{at:new Date('2026-11-20T11:20:00Z'),storage:mayaStorage()});
 // Home: one row per bake under way, opening it at its due step.
 await resumeOne(page);
 await expect(page.locator('.bh-navigator-current')).toContainText('Preparation');
 await expect(bar(page)).toContainText('Now: Refrigerate the dough');
 const fridge=page.locator('section[data-guide-title="Refrigerate the dough"]');
 // The step the bar names is the one open in the overview, not an older unticked one.
 await expect(fridge.getByRole('checkbox',{name:'Step done',exact:true})).toBeVisible();
 await expect(page.locator('section[data-guide-title="Let the dough rise"]').getByRole('checkbox')).toBeHidden();
 await fridge.getByRole('checkbox',{name:'Step done',exact:true}).click();
 await expect(fridge).toHaveAttribute('data-guide-done','true');
 // No reload, no minute tick: the bar and the overview's button follow the tick.
 await expect(bar(page)).toContainText('Next: Divide and shape dough balls');
 await expect(page.getByRole('button',{name:'Go to: Divide and shape dough balls →',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Go to: Divide and shape dough balls →',exact:true}).tap();
 await expect(page.locator('section[data-guide-title="Divide and shape dough balls"]').getByRole('heading')).toBeVisible();
 await expect(page.getByText(/\bStep \d+ \/ \d+/)).toHaveCount(0);
 // A short bulk that goes straight to the fridge: no "less than 30% rise … dense".
 await page.locator('.bh-local-progress').getByRole('button',{name:'Overview',exact:true}).tap();
 await page.locator('section[data-guide-title="Let the dough rise"]').getByRole('button').first().tap();
 await page.getByText('Rising tips').tap();
 await expect(page.getByText(/Under-bulk/)).toHaveCount(0);
 await expect(page.getByText(/Over-bulk/)).toBeVisible();
});

test('EN: preheat is its own Now moment and Preparation leads to Baking & serving',async({page},testInfo)=>{
 await open(page,{at:new Date('2026-11-21T11:00:00Z'),storage:mayaStorage()});
 await resumeOne(page);
 // Within the hour and a half before the bake, the bake opens on Baking & serving.
 await expect(page.locator('.bh-navigator-current')).toContainText('Baking & serving');
 await expect(bar(page)).toContainText('Now: Preheat the oven');
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Preparation',{exact:true})}).tap();
 await expect(bar(page)).toContainText('Now: Preheat the oven');
 const forward=page.getByRole('button',{name:'Baking & serving →',exact:true});
 await expect(forward).toBeVisible();
 await expect(page.getByRole('button',{name:/^Go to: /})).toHaveCount(0);
 await testInfo.attach('preparation-at-preheat',{body:await page.screenshot(),contentType:'image/png'});
 await forward.tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Baking & serving');
 await expect(page.locator('section[data-guide-title="Preheat the oven"]').getByRole('heading',{name:'Preheat the oven'})).toBeVisible();
});

test('EN: after the bake the app opens on the rating; its Bake again carries the note',async({page})=>{
 const note='Bases a bit pale — preheat longer.';
 await open(page,{at:new Date('2026-11-21T14:30:00Z'),storage:mayaStorage(pizzaSession(),{note})});
 const sheet=page.getByRole('dialog',{name:'Bake journal entry'});
 await expect(sheet.getByText('How did it turn out?')).toBeVisible();
 const box=await sheet.getByText('How did it turn out?').boundingBox();
 expect(box.y).toBeLessThan(page.viewportSize().height);
 await expect(page.getByText('Time to mix the dough')).toHaveCount(0);
  // The rating sheet's Bake again: last time's note comes along (no end-of-bake block on the bake step since round 3).
 await expect(page.locator('[data-bake-closing]')).toHaveCount(0);
 await sheet.getByRole('button',{name:/^Bake again next week/}).tap();
 await expect.poll(async()=>(await stored(page)).previousNote).toBe(note);
});

test('EN: days after the bake, home offers it again instead of reopening its last screen',async({page})=>{
 await open(page,{at:new Date('2026-11-25T02:00:00Z'),storage:mayaStorage()});
 await expect(page.getByRole('button',{name:'Bake again →',exact:true})).toBeVisible();
 await expect(page.locator('[data-live-bake]')).toHaveCount(0);
 await expect(page.locator('.bh-navigator-current')).toHaveCount(0);
});

test('EN: mixing early with Step done records it and stays in Preparation (no setup, no stale card)',async({page})=>{
 const session=pizzaSession({execution:undefined,startTime:Date.parse('2026-11-20T12:00:00Z')});
 await open(page,{at:new Date('2026-11-20T10:30:00Z'),storage:mayaStorage(session)});
 await resumeOne(page);
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Preparation',{exact:true})}).tap();
 await page.locator('section[data-guide-title="Start Dough"]').getByRole('button').first().tap();
 await page.locator('section[data-guide-title="Start Dough"]').getByRole('checkbox',{name:'Step done',exact:true}).click();
 // A tick is the plan's time, never the minute of the tap (18 Nov 2026 retention round 4, owner's design).
 await expect.poll(async()=>(await stored(page)).execution?.actualAt??0).toBe(Date.parse('2026-11-20T12:00:00Z'));
 expect((await stored(page)).execution.stated).toBe(false);
 await expect(page.locator('.bh-navigator-current')).toContainText('Preparation');
 await expect(page.locator('[data-stale-card]')).toHaveCount(0);
 expect((await stored(page)).protocolStale??false).toBe(false);
 await expect(bar(page)).not.toContainText('Start Dough');
});

test.describe('two bakes',()=>{
 test.use({timezoneId:'Europe/Paris',locale:'fr-FR'});
 const P=s=>Date.parse(s);
 const baguette={version:1,savedAt:P('2026-11-19T10:00:00Z'),tab:'simple',bakeType:'bread',bakeName:'',styleKey:'baguette',numItems:2,itemWeight:320,pizzaDiameter:30,ovenType:'home_oven_stone_bread',mixerType:'hand',yeastType:'fresh',kitchenTemp:20,humidity:'normal',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'poolish',prefermentFlourPct:20,prefOffsetH:11.25,prefGoesInFridge:false,poolishStorage:'auto',flourInFridge:false,
  startTime:P('2026-11-21T17:15:00Z'),eatTime:P('2026-11-22T09:00:00Z'),blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',
  // The poolish was confirmed late (a few seconds after the planned mix): "Oui" on the mixing question must still record.
  execution:{method:'poolish',actualAt:P('2026-11-21T17:15:04Z'),recordedAt:P('2026-11-21T17:15:04Z'),prefHours:11.25,inFridge:false,recipe:{flour:294,water:191,salt:8,totalDough:640}},
  computedRecipe:{flour:368,water:265,salt:8,oil:0,sugar:0,hydration:72,yeastGrams:0.1,coldH:10,rtH:4,timelineSteps:[{id:'mixing',time:P('2026-11-21T17:15:00Z'),label:'Pétrissage'},{id:'bulk_ferm',time:P('2026-11-21T18:00:00Z'),label:'Pointage'},{id:'cold_2',time:P('2026-11-21T21:45:00Z'),label:'Apprêt froid'},{id:'final_proof',time:P('2026-11-22T06:00:00Z'),label:'Sortir du frigo'},{id:'eat',time:P('2026-11-22T09:00:00Z'),label:'Cuisson'}]}};
 const campagne={...baguette,styleKey:'pain_campagne',numItems:1,itemWeight:800,ovenType:'dutch_oven',prefOffsetH:13.75,startTime:P('2026-11-21T11:30:00Z'),eatTime:P('2026-11-22T08:30:00Z'),
  execution:{method:'poolish',actualAt:P('2026-11-20T21:45:00Z'),recordedAt:P('2026-11-20T21:46:00Z'),prefHours:13.75,inFridge:false,recipe:{flour:400,water:280,salt:9,totalDough:800}},
  computedRecipe:{...baguette.computedRecipe,timelineSteps:[{id:'mixing',time:P('2026-11-21T11:30:00Z'),label:'Pétrissage'},{id:'cold_1',time:P('2026-11-21T15:00:00Z'),label:'Pointage au froid'},{id:'divide_ball',time:P('2026-11-21T17:45:00Z'),label:'Façonnage'},{id:'final_proof',time:P('2026-11-22T06:00:00Z'),label:'Apprêt'},{id:'eat',time:P('2026-11-22T08:30:00Z'),label:'Cuisson'}]}};
 const storage={bh_session_v1:JSON.stringify(baguette),bh_journal_v1:JSON.stringify([entryFor('baguettes',baguette),entryFor('campagne',campagne)]),bh_journal_current_v1:'baguettes'};

 test('FR: one row per bake by due step; confirmations and ticks belong to their bake across switches',async({page})=>{
  await open(page,{at:new Date('2026-11-21T17:30:00Z'),tz:'Europe/Paris',locale:'fr-FR',path:'/fr',storage});
  const rows=page.locator('[data-live-bake]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('data-live-bake','baguettes');
  await expect(rows.nth(0)).toContainText('Pétrissage');
  await expect(rows.nth(1)).toContainText('Façonnage 18h45');
  await rows.nth(0).tap();
  // "Oui, le …" / "Déjà fait" on the mixing question records the mix even with the poolish noted a few seconds later.
  await page.locator('.bh-bake-navigator-trigger').tap();
  await page.getByRole('navigation',{name:'Votre fournée',exact:true}).getByRole('button').filter({has:page.getByText('Recette',{exact:true})}).tap();
  const status=page.getByRole('region',{name:'Préparation de la fournée'});
  // Within the first minutes the question reads "C'est l'heure de pétrir · Déjà fait"; both record the planned mix.
  await status.getByRole('button',{name:/^(Oui, le|Déjà fait)/}).tap();
  await expect.poll(async()=>(await stored(page)).mixExecution?.actualAt).toBe(P('2026-11-21T17:15:04Z'));
  await expect(page.locator('[data-stale-card]')).toHaveCount(0);
  // Tick bulk in Preparation, then switch to the other bake and back.
  await page.locator('.bh-bake-navigator-trigger').tap();
  await page.getByRole('navigation',{name:'Votre fournée',exact:true}).getByRole('button').filter({has:page.getByText('Préparation',{exact:true})}).tap();
  const bulk=page.locator('section[data-guide-title="Pointage"]');
  await bulk.getByRole('button').first().tap();
  await bulk.getByRole('checkbox',{name:'Étape faite',exact:true}).click();
  await expect(bulk).toHaveAttribute('data-guide-done','true');
  const openBake=async name=>{
   await page.getByRole('button',{name:'Menu',exact:true}).tap();
   await page.getByRole('button',{name:'Mes fournées',exact:true}).tap();
   await page.locator(`#bakerhub-menu [data-journal-entry="${name}"]`).tap();
   await page.getByRole('dialog').getByRole('button',{name:'Ouvrir ma fournée',exact:true}).tap();
  };
  await openBake('campagne');
  await expect.poll(async()=>(await stored(page)).styleKey).toBe('pain_campagne');
  expect((await stored(page)).mixExecution).toBeUndefined();
  await expect(page.locator('.bh-navigator-current')).toContainText('Préparation');
  await openBake('baguettes');
  await expect.poll(async()=>(await stored(page)).styleKey).toBe('baguette');
  expect((await stored(page)).mixExecution?.actualAt).toBe(P('2026-11-21T17:15:04Z'));
  await expect(page.locator('section[data-guide-title="Pointage"]')).toHaveAttribute('data-guide-done','true');
  await expect(page.locator('section[data-guide-title="Pétrir la pâte"]')).toHaveAttribute('data-guide-done','true');
 });
});
