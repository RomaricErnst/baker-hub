const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 8 (21 Nov 2026, owner: "simplify for hot kitchen on short plan, especially for the Simple protocol";
// tests/hot-kitchen-plan.test.cjs). Wei Ling (Singapore, 31 °C, 4 Neapolitan pizzas, same day: Start Dough
// 10:30am, bake 7:00pm) and Maya (30 °C, Start Dough Fri 6:00pm, bake Sat 7:30pm, weekdays 9–18 and nights
// 23–7 busy) had the dough in and out of the fridge twice (Wei Ling 11:45, 1:45, 2:00, 4:45; Maya into the
// fridge 7:15pm, out to shape 9:15pm, back in). Now the balls are shaped after the warm rise and go into the
// fridge once: Wei Ling 11:45 shape, 12:00 in, 4:45 out; Maya 7:15pm shape, 7:30pm in, Sat 5:15pm out.
const Z=s=>Date.parse(s+'Z');
const SHOTS=process.env.SHOTS;
test.use({actionTimeout:20000,timezoneId:'Asia/Singapore'});
test.slow();
async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r8h-seeded'))return;sessionStorage.setItem('r8h-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
const base={version:1,tab:'simple',bakeType:'pizza',bakeName:'',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,
 ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',humidity:'humid',fridgeTemp:6,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},
 prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,recipeGenerated:true,modeChosen:true,
 qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,
 advancedHighestStep:99,setupOverview:false,activeTab:'plan'};
// Singapore is UTC+8.
const bakers={
 weiling:{now:'2026-11-27T02:00',session:{...base,kitchenTemp:31,startTime:Z('2026-11-28T02:30'),eatTime:Z('2026-11-28T11:00'),savedAt:Z('2026-11-27T01:55'),blocks:[]},
  en:{shape:'11:45am',inFridge:'12:00pm',out:'4:45pm'},fr:{shape:'11h45',inFridge:'12h00',out:'16h45'}},
 maya:{now:'2026-11-26T04:00',session:{...base,kitchenTemp:30,startTime:Z('2026-11-27T10:00'),eatTime:Z('2026-11-28T11:30'),savedAt:Z('2026-11-26T03:55'),
  blocks:[{label:'Work · Weekdays',from:Z('2026-11-27T01:00'),to:Z('2026-11-27T10:00')},{label:'Sleep night',from:Z('2026-11-27T15:00'),to:Z('2026-11-27T23:00')}]},
  en:{shape:'7:15pm',inFridge:'7:30pm',out:'5:15pm'},fr:{shape:'19h15',inFridge:'19h30',out:'17h15'}},
};
const words={
 en:{resume:/^(Resume|View ingredients)/,into:/into the fridge/i,out:/out of the fridge/i,shape:/Divide and shape/,ice:/\d\s*g ice/},
 fr:{resume:/^(Reprendre|Voir les ingrédients)/,into:/au réfrigérateur$|au frigo$/i,out:/Sortir/i,shape:/Diviser et (façonner|bouler)/,ice:/\d\s*g de glace/},
};
for(const lang of ['en','fr'])for(const [name,b] of Object.entries(bakers)){
 test(`${lang}: ${name}'s hot-kitchen plan moves the dough into the fridge once`,async({page},info)=>{
  const w=words[lang],times=b[lang];
  await install(page,{bh_session_v1:JSON.stringify(b.session)},Z(b.now));
  await page.goto(lang==='fr'?'/fr':'/');
  await page.getByRole('button',{name:w.resume}).first().tap();
  const toggle=page.locator('[data-plan-all-steps]:visible').first();
  await expect(toggle).toBeVisible();
  if(await toggle.getAttribute('aria-expanded')==='false')await toggle.tap();
  const plan=toggle.locator('xpath=ancestor::*[.//li][1]');
  const rows=(await plan.locator('li').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').trim());
  const into=rows.filter(t=>w.into.test(t)),out=rows.filter(t=>w.out.test(t));
  expect(into,rows.join(' | ')).toHaveLength(1);
  expect(out,rows.join(' | ')).toHaveLength(1);
  // Shaped warm, then into the fridge; the take-out is the only other fridge step, and nothing is shaped after it.
  expect(rows.find(t=>w.shape.test(t)),rows.join(' | ')).toContain(times.shape);
  expect(into[0]).toContain(times.inFridge);
  expect(out[0]).toContain(times.out);
  expect(out[0]).not.toMatch(w.shape);
  // The water line still says how to reach a cool dough without a thermometer.
  await expect(page.getByText(w.ice).first()).toBeVisible();
  if(SHOTS)await page.screenshot({path:`${SHOTS}/${name}-${lang}-${info.project.name}.png`,fullPage:true});
 });
}

// Owner (21 Nov 2026): in Simple the one-trip plan holds in every kitchen. A 24 °C kitchen, Start Dough Fri
// 11:00pm for Sat 7:00pm (20 h): shaped at 1:15am after the warm rise, into the fridge at 1:30am, out at 3:00pm
// (was: into the fridge 1:15am, out to shape 5:15am, back in 5:30am).
test('en: Simple at 24 °C, a long plan moves the dough into the fridge once',async({page})=>{
 const s={...base,kitchenTemp:24,humidity:'normal',startTime:Z('2026-11-27T15:00'),eatTime:Z('2026-11-28T11:00'),savedAt:Z('2026-11-26T03:55'),blocks:[]};
 await install(page,{bh_session_v1:JSON.stringify(s)},Z('2026-11-26T04:00'));
 await page.goto('/');
 await page.getByRole('button',{name:words.en.resume}).first().tap();
 const toggle=page.locator('[data-plan-all-steps]:visible').first();
 await expect(toggle).toBeVisible();
 if(await toggle.getAttribute('aria-expanded')==='false')await toggle.tap();
 const rows=(await toggle.locator('xpath=ancestor::*[.//li][1]').locator('li').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').trim());
 expect(rows.filter(t=>words.en.into.test(t)),rows.join(' | ')).toHaveLength(1);
 expect(rows.filter(t=>words.en.out.test(t)),rows.join(' | ')).toHaveLength(1);
 expect(rows.find(t=>words.en.shape.test(t)),rows.join(' | ')).toContain('1:15am');
});
