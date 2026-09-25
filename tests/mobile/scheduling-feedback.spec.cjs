const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Screenshot reproduction fixes the user's local clock. Recipe/temperature
// details were not visible: these explicit fixture assumptions are not a claim
// to reproduce the user's unknown recipe or a physical fermentation outcome.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-09-25T08:49:00+08:00');
const BAKE=Date.parse('2026-09-26T19:30:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const row=(plan,id)=>plan.locator(`[data-key-timing="${id}"]`);
async function expand(plan,id){const r=row(plan,id);if(!await r.getByRole('slider').isVisible())await r.locator('.bh-key-modify').tap();await expect(r.getByRole('slider')).toBeVisible();}
const reset=page=>page.getByRole('button',{name:/^(Revenir aux horaires recommandés|Return to recommended times)$/});
const confirm=plan=>plan.getByRole('button',{name:/^(Appliquer|Apply)$/});
async function seed(page,{locale='fr',mode='custom',preferment='poolish',extra={}}={}){
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:mode,bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'spiral',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:preferment,prefOffsetH:preferment==='none'?0:11,prefGoesInFridge:true,flourInFridge:false,startTime:Date.parse('2026-09-25T20:00:00+08:00'),eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup',...extra};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('feedback-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('feedback-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 const plan=page.getByRole('region',{name:locale==='fr'?'Vos moments clés':'Your key times',exact:true});
 await expect(plan).toBeVisible();
 return {plan,data};
}
async function enter(plan,id,value){
 const r=row(plan,id);
 if(!await r.locator('input[type="datetime-local"]').count())await r.locator('.bh-key-time').tap();
 await r.locator('input[type="datetime-local"]').fill(value);
}
async function fits(page,locator){
 await locator.scrollIntoViewIfNeeded();
 const r=await locator.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(page.viewportSize().width+1);
 expect(await locator.evaluate(el=>{const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top===el||el.contains(top);})).toBe(true);
}
for(const mode of ['simple','custom'])test(`${mode}: screenshot clock; adding work replans poolish at fixed bake, removing it clears constraints`,async({page},info)=>{
 const {plan}=await seed(page,{mode});
 const work=page.getByRole('button',{name:/^Jours ouvrés/});
 await work.tap();
 await expect.poll(async()=>(await stored(page)).blocks.length).toBeGreaterThan(0);
 await expect.poll(async()=>{
  const s=await stored(page),pref=s.startTime-s.prefOffsetH*3600000;
  return pref>=NOW&&!s.blocks.some(b=>pref>=b.from&&pref<b.to);
 }).toBe(true);
 expect((await stored(page)).eatTime).toBe(BAKE);
 await expect(page.getByText(/Le créneau ne permet pas de préparer/)).toHaveCount(0);
 await expect(row(plan,'pref')).toHaveAttribute('data-candidate-valid','true');
 await expect(row(plan,'pref').getByRole('img',{name:'Compatible avec le planning estimé'})).toBeVisible();
 await fits(page,row(plan,'pref').locator('.bh-key-time'));
 await info.attach('poolish-after-work-block',{body:await page.screenshot(),contentType:'image/png'});
 await work.tap();await expect.poll(async()=>(await stored(page)).blocks.length).toBe(0);
 expect((await stored(page)).eatTime).toBe(BAKE);
});

test('poolish live invalid-to-valid draft updates feedback, Cancel restores and Reset survives reload',async({page})=>{
 const {plan}=await seed(page);
 // Under these explicit assumptions the pre-block plan matures for 11 hours.
 const before=await stored(page);
 // Automatic mixing may now move with preparation. Fifteen minutes before
 // baking is outside every supported poolish maturation path.
 await enter(plan,'pref','2026-09-26T19:15');
 await expect(confirm(plan)).toBeDisabled();
 await expect(row(plan,'pref')).toHaveAttribute('data-candidate-valid','false');
 await expect(row(plan,'pref').locator('.bh-key-valid-selection')).toHaveCount(0);
 await enter(plan,'pref','2026-09-25T09:15');
 await expect(confirm(plan)).toBeEnabled();
 await expect(row(plan,'pref')).toHaveAttribute('data-candidate-valid','true');
 await expect(reset(page)).toBeVisible();
 await expect(page.getByText(/Le créneau ne permet pas de préparer/)).toHaveCount(0);
 expect((await stored(page)).prefOffsetH).toBe(before.prefOffsetH);
 await plan.getByRole('button',{name:'Annuler',exact:true}).tap();
 await expect(reset(page)).toHaveCount(0);
 await enter(plan,'pref','2026-09-25T09:15');await confirm(plan).tap();
 await expect.poll(async()=>(await stored(page)).prefOffsetH).toBe(10.75);
 await expect(reset(page)).toBeVisible();
 await page.reload();await expect(plan).toBeVisible();await expect(reset(page)).toBeVisible();
 await reset(page).tap();await expect(reset(page)).toHaveCount(0);
 expect((await stored(page)).eatTime).toBe(BAKE);
});

for(const locale of ['fr','en'])test(`${locale}: committed manual time is preserved on blocker change, reset uses current blockers`,async({page})=>{
 const {plan}=await seed(page,{locale,preferment:'none'});
 await enter(plan,'mix','2026-09-25T20:15');await expect(confirm(plan)).toBeEnabled();await confirm(plan).tap();
 const pinned=(await stored(page)).startTime;
 await page.getByRole('button',{name:locale==='fr'?/^Jours ouvrés/:/^Weekdays/}).tap();
 await expect.poll(async()=>(await stored(page)).blocks.length).toBeGreaterThan(0);
 expect((await stored(page)).startTime).toBe(pinned);
 await expect(reset(page)).toBeVisible();await page.reload();await expect(plan).toBeVisible();await expect(reset(page)).toBeVisible();
 const blocks=(await stored(page)).blocks;
 await fits(page,reset(page));await reset(page).tap();await expect(reset(page)).toHaveCount(0);
 expect((await stored(page)).blocks).toEqual(blocks);expect((await stored(page)).eatTime).toBe(BAKE);
 await expect.poll(async()=>(await stored(page)).startTime).not.toBe(pinned);
 expect((await stored(page)).timingOverrides??{}).toEqual({});
 await expect(plan.locator('.bh-key-note')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test('custom full blackout has no green slots; removing it preserves the preceding work preset',async({page})=>{
 const {plan}=await seed(page,{preferment:'none'});
 const availability=page.getByRole('group',{name:'Mes disponibilités',exact:true});
 await availability.getByRole('button',{name:/^Jours ouvrés/}).tap();
 const workBlocks=(await stored(page)).blocks;
 await availability.getByRole('button',{name:/Personnalisé/}).tap();
 await availability.getByPlaceholder('Libellé — ex. Week-end en déplacement').fill('Absence totale');
 const dates=availability.locator('input[type="datetime-local"]');
 await dates.nth(0).fill('2026-09-25T08:45');await dates.nth(1).fill('2026-09-26T20:00');
 await availability.getByRole('button',{name:'Ajouter',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).blocks.some(b=>b.label==='Absence totale')).toBe(true);
 await expect(plan.getByText('Vérification des créneaux…',{exact:true})).toHaveCount(0,{timeout:30000});
 await expand(plan,'mix');await expect(plan.locator('.bh-key-valid')).toHaveCount(0);
 await enter(plan,'mix','2026-09-25T20:15');await expect(confirm(plan)).toBeDisabled();
 await plan.getByRole('button',{name:'Annuler',exact:true}).tap();
 await availability.getByRole('button',{name:'Supprimer Absence totale',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).blocks).toEqual(workBlocks);
 expect((await stored(page)).eatTime).toBe(BAKE);
 await expand(plan,'mix');await expect.poll(()=>plan.locator('.bh-key-valid').count(),{timeout:30000}).toBeGreaterThan(0);
});

test('biga rapid overnight toggles keep the final blockers and fixed bake authoritative',async({page})=>{
 const {plan}=await seed(page,{preferment:'biga',extra:{startTime:Date.parse('2026-09-27T17:30:00+08:00'),eatTime:Date.parse('2026-09-28T19:30:00+08:00'),prefOffsetH:24}});
 const bake=(await stored(page)).eatTime;
 const nights=page.getByRole('button',{name:/^Nuits/});
 await nights.tap();await nights.tap();await nights.tap();
 await expect.poll(async()=>(await stored(page)).blocks.some(b=>b.label.endsWith(' night'))).toBe(true);
 await expect(plan.getByText('Vérification des créneaux…',{exact:true})).toHaveCount(0,{timeout:30000});
 expect((await stored(page)).eatTime).toBe(bake);
 await nights.tap();
 await expect.poll(async()=>(await stored(page)).blocks.some(b=>b.label.endsWith(' night'))).toBe(false);
 expect((await stored(page)).eatTime).toBe(bake);
 await page.reload();await expect(plan).toBeVisible();expect((await stored(page)).blocks).toEqual([]);
});

for(const storage of ['rt','fridge'])test(`levain ${storage}: blocker changes preserve confirmed mixing and Reset after reload retains blocks`,async({page})=>{
 const bake=Date.parse('2026-09-30T18:00:00+08:00');
 const {plan}=await seed(page,{preferment:'none',extra:{startTime:bake-26*3600000,eatTime:bake,yeastType:'sourdough',planningMode:'last_fed',lastFedTime:NOW-(storage==='rt'?3*3600000:8*86400000),lastFedAge:storage==='rt'?'today':'week',starterLocation:storage,lastFeedRatio:1,nextFeedRatio:1,ratioMode:'keep',starterTimingValid:true}});
 await expand(plan,'mix');const mix=row(plan,'mix').getByRole('slider');await mix.focus();await mix.press('ArrowRight');await expect(confirm(plan)).toBeEnabled();await confirm(plan).tap();
 const pinned=(await stored(page)).startTime;
 await page.getByRole('button',{name:/^Nuits/}).tap();
 await expect.poll(async()=>(await stored(page)).blocks.length).toBeGreaterThan(0);
 expect((await stored(page)).startTime).toBe(pinned);expect((await stored(page)).eatTime).toBe(bake);
 await expect(reset(page)).toBeVisible();await page.reload();await expect(plan).toBeVisible();await expect(reset(page)).toBeVisible();
 const blocks=(await stored(page)).blocks;
 await reset(page).tap();await expect(reset(page)).toHaveCount(0);
 expect((await stored(page)).blocks).toEqual(blocks);expect((await stored(page)).eatTime).toBe(bake);
});

test('rapid real pointer drag holds its axis and the last candidate controls feedback and commit',async({page})=>{
 const {plan}=await seed(page,{preferment:'none'});
 await expand(plan,'mix');const mixRow=row(plan,'mix'),slider=mixRow.getByRole('slider');
 await slider.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 const limits=[await slider.getAttribute('min'),await slider.getAttribute('max')];
 const before=await stored(page),box=await slider.boundingBox();
 const y=box.y+box.height/2;
 expect(box.width).toBeGreaterThan(box.height*3);
 await expect(slider).toHaveAttribute('aria-orientation','horizontal');
 // Real mouse/pointer input through WebKit's native range, not setting value
 // or dispatching synthetic input events. Physical touch remains a separate gate.
 await page.mouse.move(box.x+box.width*.45,y);await page.mouse.down();
 for(const fraction of [.82,.18,.73,.35,.60])await page.mouse.move(box.x+box.width*fraction,y,{steps:3});
 await page.mouse.up();
 await expect(confirm(plan)).toBeVisible();
 await expect(slider).toHaveAttribute('min',limits[0]);await expect(slider).toHaveAttribute('max',limits[1]);
 const finalTime=Number(await slider.inputValue());
 expect(finalTime).not.toBe(before.startTime);
 const valid=await mixRow.getAttribute('data-candidate-valid');
 await expect(plan.getByText('Vérification des créneaux…',{exact:true})).toHaveCount(0,{timeout:30000});
 await expect(slider).toHaveValue(String(finalTime));await expect(mixRow).toHaveAttribute('data-candidate-valid',valid);
 expect((await mixRow.locator('.bh-key-time').innerText()).startsWith(await slider.getAttribute('aria-valuetext'))).toBe(true);
 expect((await stored(page)).startTime).toBe(before.startTime);
 if(valid==='true'){
  await expect(confirm(plan)).toBeEnabled();await expect(mixRow.locator('.bh-key-valid-selection')).toHaveCount(1);
  await expect(plan.locator('.bh-key-note')).toHaveCount(0);await confirm(plan).tap();
  await expect.poll(async()=>(await stored(page)).startTime).toBe(finalTime);
 }else{
  await expect(confirm(plan)).toBeDisabled();await expect(mixRow.locator('.bh-key-valid-selection')).toHaveCount(0);
  await expect(plan.locator('.bh-key-note')).not.toHaveCount(0);
  await plan.getByRole('button',{name:'Annuler',exact:true}).tap();
 }
 expect((await stored(page)).eatTime).toBe(BAKE);
});

test('overlapping midnight blockers reject a free start whose mixing duration crosses a block; replace and exact end remain consistent',async({page})=>{
 const {plan}=await seed(page,{preferment:'none'});
 const availability=page.getByRole('group',{name:'Mes disponibilités',exact:true});
 const add=async(label,from,to)=>{
  await availability.getByRole('button',{name:/Personnalisé/}).tap();
  await availability.getByPlaceholder('Libellé — ex. Week-end en déplacement').fill(label);
  const dates=availability.locator('input[type="datetime-local"]');
  await dates.nth(0).fill(from);await dates.nth(1).fill(to);
  await availability.getByRole('button',{name:'Ajouter',exact:true}).tap();
  await expect.poll(async()=>(await stored(page)).blocks.some(b=>b.label===label)).toBe(true);
 };
 await enter(plan,'mix','2026-09-25T23:45');await expect(confirm(plan)).toBeEnabled();await confirm(plan).tap();
 const pinned=(await stored(page)).startTime;
 // Spiral mixing is a modeled active interval: 23:45 itself is free, but
 // its first three minutes overlap the block beginning at23:46.
 await add('Passage de minuit','2026-09-25T23:46','2026-09-26T00:15');
 expect((await stored(page)).startTime).toBe(pinned);
 await expect(row(plan,'mix')).toHaveAttribute('data-candidate-valid','false');
 await add('Chevauchement','2026-09-26T00:00','2026-09-26T00:30');
 await enter(plan,'mix','2026-09-26T00:15');await expect(confirm(plan)).toBeDisabled();
 await enter(plan,'mix','2026-09-26T00:30');await expect(confirm(plan)).toBeEnabled();
 await plan.getByRole('button',{name:'Annuler',exact:true}).tap();
 // The current UI edits custom blocks by removing/replacing, with no inline edit.
 await availability.getByRole('button',{name:'Supprimer Chevauchement',exact:true}).tap();
 await add('Chevauchement modifié','2026-09-26T00:00','2026-09-26T00:45');
 await enter(plan,'mix','2026-09-26T00:30');await expect(confirm(plan)).toBeDisabled();
 await enter(plan,'mix','2026-09-26T00:45');await expect(confirm(plan)).toBeEnabled();await confirm(plan).tap();
 expect((await stored(page)).blocks.map(b=>b.label)).toEqual(['Passage de minuit','Chevauchement modifié']);
 expect((await stored(page)).eatTime).toBe(BAKE);
});

test('previous/continue and browser back/forward reopen scheduling with confirmed overrides intact',async({page})=>{
 const {plan}=await seed(page,{preferment:'none'});
 await enter(plan,'mix','2026-09-25T20:15');await expect(confirm(plan)).toBeEnabled();await confirm(plan).tap();
 const before=await stored(page);
 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:'Précédent',exact:true}).tap();
 await expect(page.locator('#step-8')).toBeVisible();
 await page.locator('#step-8 .bh-step-actions').getByRole('button',{name:'Continuer',exact:true}).tap();
 // Continue skips already answered steps via nextUnanswered. The saved valid
 // schedule is answered, so the existing flow lands on Fine-tune (step10).
 await expect(page.locator('#step-10')).toBeVisible();
 await page.locator('#step-10 .bh-step-actions').getByRole('button',{name:'Précédent',exact:true}).tap();
 await expect(plan).toBeVisible();await expect(reset(page)).toBeVisible();
 await page.goBack();await expect(page.locator('#step-10')).toBeVisible();
 await page.goForward();await expect(plan).toBeVisible();await expect(reset(page)).toBeVisible();
 const after=await stored(page);
 expect(after.startTime).toBe(before.startTime);expect(after.eatTime).toBe(before.eatTime);
 expect(after.timingOverrides).toEqual(before.timingOverrides);expect(after.blocks).toEqual(before.blocks);
 await expand(plan,'mix');await expect(row(plan,'mix').getByRole('slider')).toHaveValue(String(before.startTime));
});

test('compact Organisation progress and folded horizontal timing editor stay usable on narrow screens',async({page},info)=>{
 const {plan}=await seed(page,{mode:'simple',preferment:'none'});
 const navigator=page.locator('.bh-bake-navigator');
 await expect(navigator).toContainText('Organisation');
 const progress=navigator.getByRole('button',{name:/Étape \d+\/\d+/});
 await expect(progress).toBeVisible();
 const navBox=await navigator.boundingBox(),stepBox=await progress.boundingBox();
 expect(stepBox.y).toBeGreaterThanOrEqual(navBox.y);expect(stepBox.y+stepBox.height).toBeLessThanOrEqual(navBox.y+navBox.height+1);
 expect(navBox.height).toBeLessThanOrEqual(66);
 await progress.tap();await expect(page.getByRole('dialog',{name:'Votre plan',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Votre plan',exact:true})).toBeHidden();
 const mix=row(plan,'mix');await expect(mix.getByRole('slider')).toHaveCount(0);
 await expect(mix.locator('.bh-key-window')).toBeVisible();
 const before=await stored(page);
 await expand(plan,'mix');const slider=mix.getByRole('slider');
 await expect(slider).toHaveAttribute('aria-orientation','horizontal');
 const box=await slider.boundingBox();expect(box.width).toBeGreaterThan(box.height*3);
 await fits(page,mix.locator('.bh-key-modify'));await fits(page,slider);
 await info.attach('horizontal-inline-editor',{body:await page.screenshot(),contentType:'image/png'});
 await mix.locator('.bh-key-modify').tap();await expect(slider).toHaveCount(0);
 expect((await stored(page)).startTime).toBe(before.startTime);expect((await stored(page)).eatTime).toBe(before.eatTime);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

for(const locale of ['fr','en'])test(`${locale}: explicit oven target and suggested times survive availability, back and reload`,async({page})=>{
 const {plan}=await seed(page,{locale,preferment:'none'});
 const time=page.getByLabel(locale==='fr'?'Heure d’enfournement':'Oven time',{exact:true});
 const date=page.getByLabel(locale==='fr'?'Date d’enfournement':'Baking date',{exact:true});
 await expect(time).toHaveValue('19:30');await expect(date).toHaveValue('2026-09-26');
 const suggestions=page.locator('details').filter({has:page.locator('summary').filter({hasText:locale==='fr'?'Autres horaires proposés':'Other suggested times'})});
 await expect(suggestions).toBeVisible();await suggestions.locator('summary').tap();
 const preset=suggestions.getByRole('button').first();await expect(preset).toBeVisible();await preset.tap();
 await expect.poll(async()=>(await stored(page)).eatTime).not.toBe(BAKE);
 const selected=await stored(page),selectedDate=await date.inputValue(),selectedTime=await time.inputValue();
 await page.getByRole('button',{name:locale==='fr'?/^Jours ouvrés/:/^Weekdays/}).tap();
 await expect.poll(async()=>(await stored(page)).blocks.length).toBeGreaterThan(0);
 expect((await stored(page)).eatTime).toBe(selected.eatTime);await expect(time).toHaveValue(selectedTime);await expect(date).toHaveValue(selectedDate);
 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:locale==='fr'?'Précédent':'Previous',exact:true}).tap();
 await expect(page.locator('#step-8')).toBeVisible();await page.goBack();await expect(plan).toBeVisible();
 await expect(time).toHaveValue(selectedTime);await expect(date).toHaveValue(selectedDate);
 await page.reload();await expect(plan).toBeVisible();await expect(time).toHaveValue(selectedTime);await expect(date).toHaveValue(selectedDate);
 expect((await stored(page)).eatTime).toBe(selected.eatTime);
});
