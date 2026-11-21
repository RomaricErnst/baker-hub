const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');

// 21 Nov 2026 round 8 (small track), EN and FR.
// S6: two live sourdough bakes on one jar (Priya): home shows one row for the jar's step naming both bakes, the bake
// that follows keeps a row for its own next step; its Recipe's "Prepare the starter" shows the jar's fridge dates and
// the shared feed with both amounts; its shopping list buys only its share of the shared feed; a feed recorded in
// the leading bake is done in the other. S8: the fridge times on the quarter hour (7:02pm → 7:00pm, 7:33am → 7:30am).
// Rule B: one bake keeps its own card. S4: a long direct dough has no poolish sentence. M3: About's baguette sentence
// says the apprêt and the fridge exit as the plan does. R8_SHOTS=<dir> saves screenshots for review.
const H=3600000;
const Z=s=>Date.parse(s+'Z');
const shot=async(page,name)=>{if(process.env.R8_SHOTS)await page.screenshot({path:`${process.env.R8_SHOTS}/${name}-${page.viewportSize().width}.png`,fullPage:true});};
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/priya-levain-tue.json'),'utf8'));
const base=JSON.parse(fixture.bh_session_v1);
const baseEntry=JSON.parse(fixture.bh_journal_v1)[0];
const MINE=baseEntry.id,CAMP='camp-1';
// A fridge-kept jar: into the fridge after its last feed, out on Thursday evening before the Thursday feed.
const jar=(s,fridgeIn,feedAt,peakAt,mixAt,extra={})=>({...s,...extra,startTime:mixAt,acceptedStartTime:mixAt,feed2Time:feedAt,
 starterEvents:[{kind:'fridge_in',time:fridgeIn,isPast:true,isActive:false,historicalStorage:true,label:'Starter into the fridge',cardTimeFormat:'absolute',cardNote:'Straight to the fridge — slow cold rise',bellStyle:'none',bellSigmaScale:1},
  {kind:'fridge_out',time:Z('2026-11-19T19:02'),isPast:false,isActive:false,label:'Starter out of the fridge',cardTimeFormat:'absolute',cardNote:'~90 min to reach room temp',bellStyle:'none',bellSigmaScale:1},
  ...s.starterEvents.filter(e=>e.kind!=='last_fed').map(e=>e.kind==='pre_mix'?{...e,time:feedAt,bellPeakTime:peakAt}:e)]});
// The campagne, planned first: its jar went into the fridge Thu 12 Nov 4:00pm; pre-mix feed Fri 8:15, peak 5:27pm.
const camp=jar({...base,bakeName:'Campagne',levainNeed:{mid:120,max:130}},Z('2026-11-12T16:00'),Z('2026-11-20T08:15'),Z('2026-11-20T17:27'),Z('2026-11-20T17:15'));
// Priya's pain au levain (on screen): its own answers put the jar in Fri 13 Nov 7:33am; its feed 8:30, mix 5:30pm.
const mine=jar({...base,savedAt:base.savedAt+H,levainNeed:{mid:142,max:150}},Z('2026-11-13T07:33'),Z('2026-11-20T08:30'),Z('2026-11-20T17:42'),Z('2026-11-20T17:30'));
const entryOf=(id,s)=>({...baseEntry,id,bakeType:s.bakeType,styleKey:s.styleKey,bakeName:s.bakeName??'',numItems:s.numItems,eatTime:s.eatTime,session:s});
// Each guide's saved steps, as home reads them (both still name their own fridge step: two identical rows on main).
const snap=(lang,mix)=>JSON.stringify({locale:lang,steps:[
 {step:1,at:Z('2026-11-19T19:02'),phase:'preparation',action:true,done:false,title:lang==='fr'?'Sortir le levain du réfrigérateur':'Take starter out of the fridge'},
 {step:2,at:Z('2026-11-19T20:30'),phase:'preparation',action:true,done:false,title:lang==='fr'?'Rafraîchi intermédiaire':'Intermediate feed'},
 {step:3,at:Z('2026-11-20T08:30'),phase:'preparation',action:true,done:false,title:lang==='fr'?'Rafraîchi final':'Pre-mix feed'},
 {step:4,at:mix,phase:'preparation',action:true,done:false,title:lang==='fr'?'Pétrir la pâte':'Start Dough'}]});
const guideKey=id=>'bh_guide_done_v2:'+JSON.stringify({bake:id})+':plan';
function storage(lang,{campRecords}={}){
 const c=campRecords?{...camp,starterFeedRecords:campRecords}:camp;
 return {...fixture,bh_session_v1:JSON.stringify(mine),bh_journal_v1:JSON.stringify([entryOf(CAMP,c),{...baseEntry,session:mine}]),
  [guideKey(CAMP)]:snap(lang,Z('2026-11-20T17:15')),[guideKey(CAMP)+':'+lang]:snap(lang,Z('2026-11-20T17:15')),
  [guideKey(MINE)]:snap(lang,Z('2026-11-20T17:30')),[guideKey(MINE)+':'+lang]:snap(lang,Z('2026-11-20T17:30'))};
}
async function open(page,store,at,lang){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([s])=>{if(sessionStorage.getItem('r8-seeded'))return;sessionStorage.setItem('r8-seeded','1');localStorage.clear();for(const k in s)localStorage.setItem(k,s[k]);},[store]);
 await page.goto(lang==='fr'?'/fr':'/');
}
async function section(page,lang,name){
 const t=page.locator('.bh-bake-navigator-trigger');
 if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
 await page.getByRole('navigation',{name:lang==='fr'?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).first().tap();
}

for(const lang of ['en','fr']){
 const fr=lang==='fr';
 test.describe(`one jar, two bakes (${lang})`,()=>{
  test.use({timezoneId:'Europe/London',locale:fr?'fr-FR':'en-GB'});

  test('home: one row for the jar\'s step, naming both bakes; the other bake keeps a row for its mix',async({page})=>{
   await open(page,storage(lang),Z('2026-11-19T12:00'),lang);
   const rows=page.locator('[data-live-bake]');
   await expect(rows).toHaveCount(2);
   const jarRow=page.locator('[data-live-jar]');
   await expect(jarRow).toHaveCount(1);
   await expect(jarRow).toHaveAttribute('data-live-bake',CAMP);
   const out=fr?'Sortir le levain du réfrigérateur':'Take starter out of the fridge';
   await expect(page.locator('[data-live-bake]',{hasText:out})).toHaveCount(1);
   await expect(jarRow).toHaveAttribute('aria-label',new RegExp(`^Campagne ${fr?'et':'&'} .+ · ${out} `));
   // The fridge step on the quarter hour: 7:02pm → 7:00pm.
   await expect(jarRow.locator('[data-live-time]')).toHaveText(fr?'19h00':'7:00pm');
   const other=page.locator(`[data-live-bake="${MINE}"]`);
   await expect(other).toContainText(fr?'Pétrir la pâte':'Start Dough');
   await expect(other.locator('[data-live-time]')).toContainText(fr?'17h30':'5:30pm');
   await shot(page,`r8-home-jar-${lang}`);
  });

  test('the bake that follows: the jar\'s fridge dates, the shared feed with both amounts, its share in the shopping list',async({page})=>{
   await open(page,storage(lang),Z('2026-11-19T12:00'),lang);
   await page.locator(`[data-live-bake="${MINE}"]`).tap();
   await section(page,lang,fr?'Recette':'Recipe');
   const sum=page.getByText(fr?'Préparer le levain':'Prepare the starter',{exact:true});
   await sum.scrollIntoViewIfNeeded();await sum.tap();
   const card=page.locator('[data-starter-amount]').locator('xpath=..');
   // The jar went into the fridge for the campagne (Thu 12 Nov 4:00pm), not at this bake's own answer (13 Nov 7:33am).
   await expect(card).toContainText(fr?'jeu. 12 nov. · 16h00':'Thu 12 Nov · 4:00pm');
   await expect(card).not.toContainText(fr?'13 nov.':'13 Nov');
   // Out of the fridge on the quarter hour (7:02pm → 7:00pm).
   await expect(card).toContainText(fr?'jeu. 19 nov. · 19h00':'Thu 19 Nov · 7:00pm');
   await expect(card).not.toContainText(fr?'19h02':'7:02pm');
   // One feed, both amounts, at the campagne's time.
   await expect(card.locator('[data-starter-feed-line]').filter({hasText:fr?/^Rafraîchir 1:1:1 pour les deux fournées · \d+\s*g\s*:\s*\d+\s*g pour Campagne, \d+\s*g pour .+$/:/^Feed 1:1:1 for both bakes · \d+ g: \d+ g for Campagne, \d+ g for .+$/})).toHaveCount(1);
   await expect(card).toContainText(fr?'ven. 20 nov. · 8h15':'Fri 20 Nov · 8:15am');
   // Your plan's starter strip shows the same shared feed (8:15), not the bake's own (8:30).
   const strip=page.locator('[data-plan-strip] svg[role="img"]').first();
   await expect(strip).toHaveAttribute('aria-label',fr?/8h15/:/8:15am/);
   await expect(strip).not.toHaveAttribute('aria-label',fr?/8h30/:/8:30am/);
   await card.scrollIntoViewIfNeeded();
   await shot(page,`r8-follower-starter-card-${lang}`);
   // The levain build's flour (this dough's share of the shared feed) is what the list buys for the feeds:
   // the jar's Thursday feed is the campagne's (bought on its list).
   const buildFlour=await page.locator('[data-recipe-stages]').first().evaluate(el=>{const rows=[...el.querySelectorAll('*')].filter(n=>n.children.length===0&&/g$/.test(n.textContent.trim()));return rows.map(n=>n.textContent.trim());});
   await section(page,lang,fr?'Liste de courses':'Shopping list');
   const feedRow=page.getByText(fr?'Farine pour les rafraîchis du levain':'Flour for the starter feeds',{exact:true}).first();
   await expect(feedRow).toBeVisible();
   const listed=await feedRow.locator('xpath=ancestor::*[self::li or self::label or self::div][1]').innerText();
   const grams=Number((listed.match(/(\d+)\s*g/)||[])[1]);
   // 63 g: this dough's share; the bake's own Thursday feed and pre-mix feed would have bought twice that.
   expect(buildFlour.map(t=>Number(t.replace(/\D+/g,'')))).toContain(grams);
   await feedRow.scrollIntoViewIfNeeded();
   await shot(page,`r8-follower-shopping-${lang}`);
  });

  test('a feed recorded in the campagne is done in this bake (no feed question)',async({page})=>{
   const rec=[{kind:'pre_mix',plannedAt:Z('2026-11-20T08:15'),actualAt:Z('2026-11-20T08:15'),recordedAt:Z('2026-11-20T08:16'),ratio:1,stated:false}];
   await open(page,storage(lang,{campRecords:rec}),Z('2026-11-20T09:00'),lang);
   await page.locator(`[data-live-bake="${MINE}"]`).tap();
   await expect(page.getByText(fr?/Avez-vous rafraîchi/:/Have you fed/)).toHaveCount(0);
   await section(page,lang,fr?'Préparation':'Preparation');
   const feed=page.getByRole('button',{name:fr?/^Rafraîchi avant pétrissage.*8h15/:/^Pre-mix feed.*8:15am/}).first();
   await feed.tap();
   const done=page.getByRole('checkbox',{name:fr?'Étape faite':'Step done'}).first();
   await expect(done).toBeChecked();
   await shot(page,`r8-follower-feed-carried-${lang}`);
  });

  test('rule B: one sourdough bake keeps its own starter card and row',async({page})=>{
   const solo=jar({...base},Z('2026-11-13T07:33'),Z('2026-11-20T08:30'),Z('2026-11-20T17:42'),Z('2026-11-20T17:30'));
   await open(page,{...fixture,bh_session_v1:JSON.stringify(solo),bh_journal_v1:JSON.stringify([{...baseEntry,session:solo}])},Z('2026-11-19T12:00'),lang);
   await expect(page.locator('[data-live-jar]')).toHaveCount(0);
   await page.getByRole('button',{name:fr?/^(Reprendre|Voir les ingrédients)/:/^(Resume|View ingredients)/}).first().tap();
   await section(page,lang,fr?'Recette':'Recipe');
   const sum=page.getByText(fr?'Préparer le levain':'Prepare the starter',{exact:true});
   await sum.scrollIntoViewIfNeeded();await sum.tap();
   const card=page.locator('[data-starter-amount]').locator('xpath=..');
   await expect(card).toContainText(fr?'ven. 13 nov. · 7h30':'Fri 13 Nov · 7:30am');
   await expect(card).not.toContainText(/both bakes|deux fournées/);
   await expect(card.locator('[data-starter-feed-line]').first()).toHaveText(/^1:1:1 · \d+ g /);
  });
 });

 test.describe(`direct dough and baguette text (${lang})`,()=>{
  test.use({timezoneId:'Europe/Paris',locale:fr?'fr-FR':'en-GB'});
  test('S4: a long room-temperature direct dough has no poolish sentence',async({page})=>{
   // B3: Custom, 22 °C, Start Dough 9:45am, bake 7:30pm, no busy time: a 9 h room-temperature plan (> 8 h).
   const s={version:1,tab:'custom',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',
    mixerType:'hand',yeastType:'instant',humidity:'normal',fridgeTemp:6,kitchenTemp:22,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},flourChosen:true,
    prefermentType:'none',prefermentChosen:true,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,recipeGenerated:true,modeChosen:true,qtyChosen:true,
    customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',
    confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=22','mixer=hand'],
    startTime:Z('2026-11-27T08:45'),eatTime:Z('2026-11-27T18:30'),savedAt:Z('2026-11-26T18:00'),blocks:[]};
   await open(page,{bh_session_v1:JSON.stringify(s)},Z('2026-11-26T19:30'),lang);
   await page.getByRole('button',{name:fr?/^(Reprendre|Voir les ingrédients)/:/^(Resume|View ingredients)/}).first().tap();
   await expect(page.getByText(fr?/Au-delà de 8\s*h à température ambiante, surveillez régulièrement la pâte\./:/Beyond 8h at room temperature, check the dough regularly\./).first()).toBeVisible();
   await expect(page.getByText(/own preparation schedule|propre planning de préparation/)).toHaveCount(0);
   await page.getByText(fr?/Au-delà de 8/:/Beyond 8h/).first().scrollIntoViewIfNeeded();
   await shot(page,`r8-direct-no-poolish-${lang}`);
  });

  test('M3: About says the apprêt and the fridge exit, as the baguette plan does',async({page})=>{
   // The plan (tests/about-science.test.cjs): shaped pieces out 45 min before a 2 h apprêt at 20 °C, 2 h 45 to the bake.
   await page.goto(fr?'/fr/about':'/about');
   const acc=page.getByRole('button',{name:fr?'Le moteur de planning':'Schedule engine',exact:true});
   await acc.scrollIntoViewIfNeeded();
   if(await acc.getAttribute('aria-expanded')!=='true')await acc.tap();
   const text=fr?'perdent d’abord leur froid pendant 45 minutes : ils sortent environ 2 h 45 avant la cuisson à 20 °C':'first take 45 minutes to lose its chill, so they come out about 2¾ hours before the bake at 20 °C';
   const sentence=page.getByText(text,{exact:false});
   await expect(sentence.first()).toBeVisible();
   await expect(page.getByText(fr?'environ 2 heures à 20 °C, 2 h 30 à 18 °C, 3 heures à 16 °C':'about 2 hours at 20 °C, 2½ at 18 °C, 3 at 16 °C',{exact:false}).first()).toBeVisible();
   await expect(page.getByText(fr?'jusqu’à la cuisson à 20 °C, 2 h 30':'to the bake at 20 °C, 2½')).toHaveCount(0);
   await sentence.first().scrollIntoViewIfNeeded();
   await shot(page,`r8-about-baguette-${lang}`);
  });
 });
}
