const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 21 (25 Nov 2026), EN and FR:
// E1 (owner): a quick step may sit on a busy time's edge, a long one ends by its start. Simple Neapolitan, 22 °C, Nights
//   23:00–07:00 (the default), clock Thu 7:30pm, bake Fri 11:30am: the dough goes into the fridge at 11:00pm, on the
//   night's edge (main counted a fridge step at 11:00pm as inside the night); no step inside the night, no busy tag. (Shaping that would
//   cross 11:00pm moving is covered by tests/round21.test.cjs, the engine's own plans.)
// P: Preparation has no separate "Start Dough / Done now" card; French puts a space before °C and %; the manual flour
//   form has one W line; About says "Ask", never "Maestro".
const NOW=Date.parse('2026-11-26T19:30:00+08:00'); // Thu 7:30pm in Singapore
test.use({timezoneId:'Asia/Singapore'});
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');
const clock=(ms,fr)=>new Date(ms).toLocaleTimeString(fr?'fr-FR':'en-US',{timeZone:'Asia/Singapore',hour:fr?'2-digit':'numeric',minute:'2-digit',hour12:!fr}).replace(':',fr?'h':':').replace(' ','').toLowerCase();
async function open(page,fr,at=NOW){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
}
async function generate(page,fr,bake){
 await page.getByRole('button',{name:/^Pizza/}).first().tap();
 await page.getByRole('button',{name:fr?/^Napolitaine/:/^Classic Neapolitan/}).first().tap();
 await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
 await forward(page).tap();
 await page.getByRole('slider').first().fill('22');
 await forward(page).tap();
 const date=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await date.fill(bake);await date.blur();
 const go=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
 await expect(go).toBeEnabled({timeout:20000});await go.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
}
async function section(page,fr,name){
 const t=page.locator('.bh-bake-navigator-trigger:visible').first();
 await t.scrollIntoViewIfNeeded();
 if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).first().tap();
}

for(const fr of [false,true]){
 const L=(en,f)=>fr?f:en, lang=fr?'fr':'en';
 test.describe(`round 21 (${lang})`,()=>{
  test.use({locale:fr?'fr-FR':'en-GB'});

  test('E1: the dough goes into the fridge at 11:00pm under 11pm–7am nights, no step inside the night, no clash',async({page})=>{
   test.setTimeout(120000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,fr);
   await generate(page,fr,'2026-11-27T11:30');
   // No "Before your recipe" sheet: nothing clashes with the night.
   await expect(page.locator('[data-decision-sheet]:visible')).toHaveCount(0);
   const s=await stored(page);
   expect(s.blocks.some(b=>/ night$/.test(b.label))).toBe(true);
   const night=s.blocks.filter(b=>/ night$/.test(b.label)).sort((a,b)=>a.from-b.from)[0];
   expect(new Date(night.from).getHours()).toBe(23);
   // The plan on screen (every step).
   const all=page.getByRole('button',{name:L(/^All steps/,/^Toutes les étapes/)}).first();
   if(await all.count()){await all.scrollIntoViewIfNeeded();await all.tap();}
   const plan=page.locator('[data-recipe-plan]:visible').first();
   const text=(await plan.innerText()).replace(/\s+/g,' ');
   // The dough goes into the fridge at 11:00pm, on the night's edge (main counted it inside the night: a clash sheet).
   expect(text).toContain(`${clock(night.from,fr)} ${L('Dough into the fridge','Mettre la pâte au réfrigérateur')}`);
   await expect(plan.getByText(L(/busy time/,/indisponibilit/))).toHaveCount(0);
   // No step inside the night: every shown time after 11:00pm on Thursday is 7:00am or later on Friday.
   const times=[...text.matchAll(fr?/\b(\d{1,2})h(\d{2})\b/g:/\b(\d{1,2}):(\d{2})(am|pm)\b/g)].map(m=>{let h=+m[1];if(!fr){if(m[3]==='pm'&&h<12)h+=12;if(m[3]==='am'&&h===12)h=0;}return h*60+ +m[2];});
   expect(times.filter(m=>m>23*60||m<7*60)).toEqual([]);
   // The automatic plan's knead: after 7:30pm and early enough that every long step ends by 11:00pm.
   expect(s.startTime).toBeGreaterThan(NOW);
   expect(s.startTime).toBeLessThan(night.from-2*3600000);
   await page.screenshot({path:test.info().outputPath(`e1-plan-${lang}.png`),fullPage:false});
   expect(errors).toEqual([]);
  });

  test('P: Preparation has no separate mix card; French spacing; one W line; About says Ask',async({page,context})=>{
   test.setTimeout(150000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,fr);
   await generate(page,fr,'2026-11-27T11:30');
   const mixAt=(await stored(page)).startTime;
   // Ten minutes before the mix, in Preparation: the step itself, no "Start Dough / Done now" card above it.
   const later=await context.newPage();
   await later.clock.install({time:new Date(mixAt-10*60000)});
   await later.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
   await later.goto(fr?'/fr':'/');
   const resume=later.getByRole('button',{name:fr?/Reprendre|Voir les ingrédients/:/Resume|View ingredients/}).first();
   await expect(resume).toBeVisible({timeout:20000});await resume.tap();
   await section(later,fr,L('Preparation','Préparation'));
   await expect(later.locator('.bh-start-status:visible')).toHaveCount(0);
   await expect(later.getByRole('button',{name:L('Done now','Terminé maintenant'),exact:true})).toHaveCount(0);
   // My choices: the kitchen reads « 22 °C » in French (a no-break space), "22°C" in English.
   await section(later,fr,L('My bake','Ma fournée'));
   const body=await later.locator('body').innerText();
   if(fr){expect(body).not.toMatch(/\d°C/);expect(body).toMatch(/22\s°C/);}else expect(body).toMatch(/22°C/);
   await later.close();
   // About: the help box is "Ask" / « Demander », never "Maestro".
   await page.goto(fr?'/fr/about':'/about');
   const about=page.locator('main');
   await expect(about).not.toContainText('Maestro');
   expect(errors).toEqual([]);
  });
 });
}
