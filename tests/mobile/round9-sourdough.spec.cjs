const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');

// 22 Nov 2026 round 9 (sourdough and the shared jar), EN and FR.
// K: a new Simple sourdough loaf goes into the fridge once (shaped at the end of the bulk, cold overnight), and its
//    starter card dates no fridge spell from the assumed last feed (N). N/S7: two bakes of the same name on one jar
//    are told apart by bake time on home and in the shared feed line; a feed ticked in one bake moves both home rows
//    on. S4: the levain's % in Custom is the same whatever the flour. R9_SHOTS=<dir> saves screenshots for review.
const H=3600000;
const Z=s=>Date.parse(s+'Z');
const shot=async(page,name)=>{if(process.env.R9_SHOTS)await page.screenshot({path:`${process.env.R9_SHOTS}/${name}-${page.viewportSize().width}.png`,fullPage:true});};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/priya-levain-tue.json'),'utf8'));
const base=JSON.parse(fixture.bh_session_v1);
const baseEntry=JSON.parse(fixture.bh_journal_v1)[0];
const MINE=baseEntry.id,CAMP='camp-1';
const jar=(s,fridgeIn,feedAt,peakAt,mixAt,extra={})=>({...s,...extra,startTime:mixAt,acceptedStartTime:mixAt,feed2Time:feedAt,
 starterEvents:[{kind:'fridge_in',time:fridgeIn,isPast:true,isActive:false,historicalStorage:true,label:'Starter into the fridge',cardTimeFormat:'absolute',cardNote:'Straight to the fridge — slow cold rise',bellStyle:'none',bellSigmaScale:1},
  {kind:'fridge_out',time:Z('2026-11-19T19:00'),isPast:false,isActive:false,label:'Starter out of the fridge',cardTimeFormat:'absolute',cardNote:'~90 min to reach room temp',bellStyle:'none',bellSigmaScale:1},
  ...s.starterEvents.filter(e=>e.kind!=='last_fed').map(e=>e.kind==='pre_mix'?{...e,time:feedAt,bellPeakTime:peakAt}:e)]});
// Two loaves of one name ("Pain au levain"), one jar: the first bakes Sat 9:00am, Priya's (on screen) Sat 10:00am.
const camp=jar({...base,bakeName:'',levainNeed:{mid:120,max:130},eatTime:Z('2026-11-21T09:00')},Z('2026-11-12T16:00'),Z('2026-11-20T08:15'),Z('2026-11-20T17:27'),Z('2026-11-20T17:15'));
const mine=jar({...base,bakeName:'',savedAt:base.savedAt+H,levainNeed:{mid:142,max:150}},Z('2026-11-13T07:33'),Z('2026-11-20T08:30'),Z('2026-11-20T17:42'),Z('2026-11-20T17:30'));
const entryOf=(id,s)=>({...baseEntry,id,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,eatTime:s.eatTime,session:s});
// Each guide's saved steps (the follower's guide shows the shared feed at 8:15).
const snap=(lang,mix,feedDone=false)=>JSON.stringify({locale:lang,steps:[
 {step:1,at:Z('2026-11-19T19:00'),phase:'preparation',action:true,done:false,title:lang==='fr'?'Sortir le levain du réfrigérateur':'Take starter out of the fridge'},
 {step:3,at:Z('2026-11-20T08:15'),phase:'preparation',action:true,done:feedDone,title:lang==='fr'?'Rafraîchi final':'Pre-mix feed'},
 {step:4,at:mix,phase:'preparation',action:true,done:false,title:lang==='fr'?'Pétrir la pâte':'Start Dough'}]});
const guideKey=id=>'bh_guide_done_v2:'+JSON.stringify({bake:id})+':plan';
function storage(lang,{campRecords,campDone=false}={}){
 const c=campRecords?{...camp,starterFeedRecords:campRecords}:camp;
 const cs=snap(lang,Z('2026-11-20T17:15'),campDone),ms=snap(lang,Z('2026-11-20T17:30'));
 return {...fixture,bh_session_v1:JSON.stringify(mine),bh_journal_v1:JSON.stringify([entryOf(CAMP,c),{...baseEntry,bakeName:'',session:mine}]),
  [guideKey(CAMP)]:cs,[guideKey(CAMP)+':'+lang]:cs,[guideKey(MINE)]:ms,[guideKey(MINE)+':'+lang]:ms};
}
async function open(page,store,at,lang){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([s])=>{if(sessionStorage.getItem('r9-seeded'))return;sessionStorage.setItem('r9-seeded','1');localStorage.clear();for(const k in s)localStorage.setItem(k,s[k]);},[store]);
 await page.goto(lang==='fr'?'/fr':'/');
}
async function section(page,lang,name){
 const t=page.locator('.bh-bake-navigator-trigger');
 if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
 await page.getByRole('navigation',{name:lang==='fr'?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).first().tap();
}

for(const lang of ['en','fr']){
 const fr=lang==='fr';
 test.describe(`one jar, two bakes of one name (${lang})`,()=>{
  test.use({timezoneId:'Europe/London',locale:fr?'fr-FR':'en-GB'});

  test('home: the jar row names the name once for both bakes; the other row carries its bake time',async({page})=>{
   await open(page,storage(lang),Z('2026-11-19T12:00'),lang);
   const jarRow=page.locator('[data-live-jar]');
   await expect(jarRow).toHaveCount(1);
   await expect(jarRow).toHaveAttribute('aria-label',fr?/^Pain au levain · les deux fournées · Sortir le levain/:/^Pain au levain · both bakes · Take starter out/);
   await expect(jarRow).not.toHaveAttribute('aria-label',/Pain au levain (&|et) Pain au levain/);
   // Same name, same day: the bake time tells them apart.
   await expect(page.locator(`[data-live-bake="${MINE}"]`)).toHaveAttribute('aria-label',fr?/^Sam\. 10h00 · Pain au levain · Pétrir la pâte/:/^Sat 10:00am · Pain au levain · Start Dough/);
   await shot(page,`r9-home-twins-${lang}`);
  });

  test('the shared feed line names each bake by its bake time',async({page})=>{
   await open(page,storage(lang),Z('2026-11-19T12:00'),lang);
   await page.locator(`[data-live-bake="${MINE}"]`).tap();
   await section(page,lang,fr?'Recette':'Recipe');
   const sum=page.getByText(fr?'Préparer le levain':'Prepare the starter',{exact:true});
   await sum.scrollIntoViewIfNeeded();await sum.tap();
   const card=page.locator('[data-starter-amount]').locator('xpath=..');
   const line=card.locator('[data-starter-feed-line]').filter({hasText:fr?/pour les deux fournées/:/for both bakes/});
   await expect(line).toHaveText(fr?/pour Pain au levain \(sam\. 9h00\), .* pour Pain au levain \(sam\. 10h00\)$/i:/for Pain au levain \(Sat 9:00am\), .* for Pain au levain \(Sat 10:00am\)$/);
   // One "keep the rest": the card's and the final dough's Levain row give the same amount.
   const cardKeep=(await page.locator('[data-starter-amount]').innerText()).match(/\((\d+)\s*g\)/)[1];
   const stages=await page.locator('[data-recipe-stages]').first().innerText();
   expect(stages.match(fr?/Gardez le reste \((\d+)\s*g\)/:/Keep the rest \((\d+)\s*g\)/)[1]).toBe(cardKeep);
   await card.scrollIntoViewIfNeeded();
   await shot(page,`r9-feed-line-${lang}`);
  });

  test('a feed ticked in one bake moves both home rows on, before the other bake is opened',async({page})=>{
   const rec=[{kind:'pre_mix',plannedAt:Z('2026-11-20T08:15'),actualAt:Z('2026-11-20T08:15'),recordedAt:Z('2026-11-20T08:16'),ratio:1,stated:false}];
   await open(page,storage(lang,{campRecords:rec,campDone:true}),Z('2026-11-20T09:00'),lang);
   await expect(page.locator('[data-live-bake]')).toHaveCount(2);
   await expect(page.locator('[data-live-bake]',{hasText:fr?'Rafraîchi final':'Pre-mix feed'})).toHaveCount(0);
   await expect(page.locator(`[data-live-bake="${MINE}"]`)).toContainText(fr?'Pétrir la pâte':'Start Dough');
   await shot(page,`r9-home-after-tick-${lang}`);
  });
 });

 test.describe(`levain % and a new Simple loaf (${lang})`,()=>{
  test.use({timezoneId:'Europe/London',locale:fr?'fr-FR':'en-GB'});

  test('S4: the levain % reads the same with a strong and an all-purpose flour',async({page,context})=>{
   const read=async(p,flour)=>{
    // No hydration of the baker's: the flour's own sets the water, so the flour weight differs (Thomas's B3 case).
    const s={...base,autoStarterPct:undefined,starterPctOverride:undefined,manualHydration:undefined,flourBlend:{flour1:flour,flour2:null,ratio1:100}};
    await open(p,{...fixture,bh_session_v1:JSON.stringify(s),bh_journal_v1:JSON.stringify([{...baseEntry,session:s}])},Z('2026-11-17T12:00'),lang);
    await p.getByRole('button',{name:fr?/^(Reprendre|Voir les ingrédients)/:/^(Resume|View ingredients)/}).first().tap();
    await section(p,lang,fr?'Recette':'Recipe');
    const finalStage=p.locator('[data-recipe-stages] [data-stage="final"]').first();
    await expect(finalStage).toBeVisible();
    const levain=(await finalStage.innerText()).match(/Levain[\s\S]*?(\d+(?:[.,]\d+)?)\s?%/)[1];
    const flourG=(await p.locator('[data-whole-dough]').first().innerText()).match(/(\d[\d,.\u202f\s]*)\s?g/)[1];
    await finalStage.scrollIntoViewIfNeeded();
    await shot(p,`r9-levain-pct-${flour}-${lang}`);
    return {levain,flourG};
   };
   const strong=await read(page,'manitoba');
   const weak=await read(await context.newPage(),'allpurpose');
   expect(strong.flourG).not.toBe(weak.flourG);
   expect(weak.levain).toBe(strong.levain);
  });

  test('K: a new Simple sourdough loaf goes into the fridge once, and no fridge date is invented',async({page})=>{
   test.setTimeout(90000);
   const NOW=Date.parse('2026-11-10T09:00:00Z');
   await page.clock.setFixedTime(NOW);
   await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
   await page.goto(fr?'/fr':'/');
   await page.getByRole('button',{name:fr?'Pain & repas':'Bread & meals',exact:true}).tap();
   await page.getByRole('button',{name:'Pain au levain',exact:true}).tap();
   await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
   await forward(page).tap();
   await page.getByRole('slider').first().fill('20');
   await forward(page).tap();
   await page.getByRole('button',{name:fr?'Au réfrigérateur':'In the fridge',exact:true}).tap();
   await forward(page).tap();
   const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
   await bakeDate.fill('2026-11-12T10:00');await bakeDate.blur();
   const generate=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
   await expect(generate).toBeEnabled({timeout:20000});
   await generate.tap();
   const keep=page.locator('[data-decision-sheet] [data-simple-keep-all]');
   if(await keep.count())await keep.first().tap();
   await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
   const session=await stored(page);
   expect(session.planRules).toBe(3);
   const steps=session.computedRecipe?.timelineSteps??[];
   expect(steps.length).toBeGreaterThan(0);
   // One fridge trip: the shaped loaf goes in, nothing comes out to be shaped.
   expect(steps.filter(s=>/^cold_?1$/.test(s.id)).length).toBe(0);
   const plan=page.getByRole('button',{name:fr?/^Toutes les étapes/:/^All steps/}).first();
   if(await plan.count()){await plan.scrollIntoViewIfNeeded();await plan.tap();}
   await expect(page.getByText(fr?/Pâte au réfrigérateur/:/Dough into the fridge/)).toHaveCount(0);
   // The starter card: no fridge spell dated from the assumed week-old feed.
   const sum=page.getByText(fr?'Préparer le levain':'Prepare the starter',{exact:true});
   if(await sum.count()){await sum.scrollIntoViewIfNeeded();await sum.tap();}
   await expect(page.getByText(fr?/Directement au frigo/:/Straight to the fridge/)).toHaveCount(0);
   await shot(page,`r9-simple-loaf-${lang}`);
  });
 });
}
