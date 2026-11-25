const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 18 (24 Nov 2026, owner): home shows the bakes under way and the newest plan, older plans behind
// "2 more planned · My bakes" (H1); no "Start a new bake" on home (H2); a quiet "⋯" opens the bake's sheet and
// Delete is immediate with "Removed · Undo" in place (H3); My choices reads "Fine-tune the dough" (H4); Maestro
// takes questions in words only: Tips → Ask has no camera (M1).
const H=3600000;
const NOW=Date.parse('2026-11-24T02:00:00Z'); // Tue 10:00am in Singapore
const SHOTS=process.env.R18_SHOTS;
const shot=async(page,name)=>{if(SHOTS&&test.info().project.name.endsWith('390'))await page.screenshot({path:`${SHOTS}/${name}.png`});};
test.use({timezoneId:'Asia/Singapore',locale:'en-SG'});

function session(extra={}){
 return {version:1,savedAt:NOW-H,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:28,humidity:'normal',fridgeTemp:6,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:NOW+30*H,eatTime:NOW+36*H,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',...extra};
}
const entryFor=(id,s,updatedAt)=>({v:1,id,createdAt:updatedAt,updatedAt,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,itemWeight:s.itemWeight,kitchenTemp:s.kitchenTemp,eatTime:s.eatTime,session:s,rating:null,note:'',photoIds:[],accountEventId:null});
// Three restarts: each left its plan in the journal; the newest is the draft on screen.
const restarted=(firstStarted=false)=>{
 const a=session(firstStarted?{bakeName:'Lunch loaf',bakeType:'bread',styleKey:'baguette',numItems:2,itemWeight:320,ovenType:'home_oven_stone_bread',startTime:NOW-H,eatTime:NOW+4*H}:{bakeName:'Pizza night'}),
  b=session({bakeName:'Pizza night',numItems:6}),c=session({bakeName:'Pizza night',numItems:8});
 return {bh_session_v1:JSON.stringify(c),bh_journal_v1:JSON.stringify([entryFor('c',c,NOW-H),entryFor('b',b,NOW-2*H),entryFor('a',a,NOW-3*H)]),bh_journal_current_v1:'c'};
};
const oneBake=()=>{const s=session({startTime:NOW-2*H,eatTime:NOW+6*H,kitchenTemp:30,execution:{method:'none',actualAt:NOW-2*H,recordedAt:NOW-2*H+60000,prefHours:0,inFridge:false,recipe:{flour:600,water:390,salt:17,totalDough:1040}}});
 return {bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor('one',s,NOW-3*H)]),bh_journal_current_v1:'one'};};

async function open(page,storage,path){
 await page.clock.install({time:new Date(NOW)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r18-seeded'))return;sessionStorage.setItem('r18-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
 await page.goto(path);
}
const journalIds=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_journal_v1')).map(e=>e.id).sort());

for(const fr of [false,true]){
 const L=(en,f)=>fr?f:en, path=fr?'/fr':'/', lang=fr?'fr':'en';
 test.describe(`round 18 (${lang})`,()=>{
  test('three restarted bakes: home shows the newest and "2 more planned"; no Start a new bake',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,restarted(),path);
   const rows=page.locator('[data-live-bake]');
   await expect(rows).toHaveCount(1);
   await expect(rows.first()).toHaveAttribute('data-live-bake','c');
   const more=page.locator('[data-home-more]');
   await expect(more).toHaveText(L('2 more planned · My bakes','2 autres prévues · Mes fournées'));
   await expect(page.getByRole('button',{name:L('Start a new bake','Nouvelle fournée'),exact:true})).toHaveCount(0);
   // The brown first row reads at the other rows' size and weight.
   const font=await rows.first().evaluate(n=>[getComputedStyle(n).fontSize,getComputedStyle(n).fontWeight]);
   expect(font).toEqual(['14px','500']);
   await shot(page,`home-3-bakes-${lang}`);
   await more.tap();
   await expect(page.getByRole('heading',{name:L('On this device','Sur cet appareil')}).or(page.getByText(L('My bakes','Mes fournées'),{exact:true})).first()).toBeVisible();
   expect(errors).toEqual([]);
  });

  test('a started bake stays on home beside the newest plan',async({page})=>{
   await open(page,restarted(true),path);
   await expect(page.locator('[data-live-bake]')).toHaveCount(2);
   await expect(page.locator('[data-live-bake="a"]')).toBeVisible();
   await expect(page.locator('[data-live-bake="c"]')).toBeVisible();
   await expect(page.locator('[data-home-more]')).toHaveText(L('1 more planned · My bakes','1 autre prévue · Mes fournées'));
  });

  test('"⋯" → Delete → "Removed · Undo" → Undo restores it',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,restarted(true),path);
   const dots=page.getByRole('button',{name:L('Options for Lunch loaf','Options pour Lunch loaf'),exact:true});
   await expect(dots).toBeVisible();
   const box=await dots.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
   await dots.tap();
   const sheet=page.getByRole('dialog');
   await expect(sheet).toContainText('Lunch loaf');
   await sheet.getByRole('button',{name:L('Delete from this device','Supprimer de cet appareil'),exact:true}).tap();
   await expect(sheet).toHaveCount(0);
   const removed=page.locator('[data-journal-removed="a"]');
   await expect(removed).toContainText(L('Lunch loaf removed ·','Lunch loaf supprimée ·'));
   await expect(page.locator('[data-live-bake="a"]')).toHaveCount(0);
   expect(await journalIds(page)).toEqual(['b','c']);
   await removed.getByRole('button',{name:L('Undo: put back Lunch loaf','Annuler : remettre Lunch loaf'),exact:true}).tap();
   await expect(page.locator('[data-live-bake="a"]')).toBeVisible();
   await expect(page.locator('[data-journal-removed]')).toHaveCount(0);
   expect(await journalIds(page)).toEqual(['a','b','c']);
   // Deleting again and leaving home ends Undo.
   await dots.tap();
   await page.getByRole('dialog').getByRole('button',{name:L('Delete from this device','Supprimer de cet appareil'),exact:true}).tap();
   await expect(page.locator('[data-journal-removed="a"]')).toBeVisible();
   await page.locator('[data-live-bake="c"]').tap();
   await expect(page.locator('[data-live-bakes]')).toHaveCount(0);
   expect(await journalIds(page)).toEqual(['b','c']);
   expect(errors).toEqual([]);
  });

  test('one bake: the single card, unchanged but for Start a new bake',async({page})=>{
   await open(page,oneBake(),path);
   await expect(page.locator('[data-live-bakes]')).toHaveCount(0);
   await expect(page.getByRole('button',{name:L(/^(Resume|View ingredients) →$/,/^(Reprendre|Voir les ingrédients) →$/)})).toBeVisible();
   await expect(page.getByRole('button',{name:L('Start a new bake','Nouvelle fournée'),exact:true})).toHaveCount(0);
   await shot(page,`home-1-bake-${lang}`);
  });

  test('My choices reads "Fine-tune the dough"',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const s=session({tab:'custom'});
   await open(page,{bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor('one',s,NOW-3*H)]),bh_journal_current_v1:'one'},path);
   await page.getByRole('button',{name:L(/^(Resume|View ingredients) →$/,/^(Reprendre|Voir les ingrédients) →$/)}).tap();
   const trigger=page.locator('.bh-bake-navigator-trigger:visible').first();
   if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
   await page.getByRole('navigation',{name:L('Your bake','Votre fournée'),exact:true}).getByRole('button',{name:L(/^My bake/,/^Ma fournée/)}).first().tap();
   await expect(page.getByRole('heading',{level:1,name:L('Review my choices','Revoir mes choix'),exact:true})).toBeVisible();
   await expect(page.getByText(L('Fine-tune the dough','Peaufiner la pâte'),{exact:true})).toBeVisible();
   await expect(page.getByText(L('Dough','Pâte'),{exact:true})).toHaveCount(0);
   expect(errors).toEqual([]);
  });

  test('Tips → Ask shows no camera',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const s=session({tab:'custom',startTime:NOW-2*H,eatTime:NOW+6*H,kitchenTemp:30,execution:{method:'none',actualAt:NOW-2*H,recordedAt:NOW-2*H+60000,prefHours:0,inFridge:false,recipe:{flour:600,water:390,salt:17,totalDough:1040}}});
   await open(page,{bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([entryFor('one',s,NOW-3*H)]),bh_journal_current_v1:'one'},path);
   await page.getByRole('button',{name:L(/^(Resume|View ingredients) →$/,/^(Reprendre|Voir les ingrédients) →$/)}).tap();
   // Preparation: a step's tips hold the question box, words only.
   const tips=page.locator('details:visible').filter({has:page.locator('[data-ask-maestro]')}).first();
   await tips.locator('summary').tap();
   const ask=tips.locator('[data-ask-maestro]');
   await expect(ask).toBeVisible();
   await expect(ask.getByRole('textbox',{name:L('A question about this step?','Une question sur cette étape ?'),exact:true})).toBeVisible();
   await expect(ask.locator('input[type="file"]')).toHaveCount(0);
   await expect(ask.locator('svg')).toHaveCount(0);
   await expect(page.getByRole('button',{name:L('Attach a photo','Joindre une photo')})).toHaveCount(0);
   await ask.scrollIntoViewIfNeeded();
   await shot(page,`ask-${lang}`);
   expect(errors).toEqual([]);
  });
 });
}
