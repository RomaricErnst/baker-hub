const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Breakfast baguettes: the night holds the final fridge exit. Simple's card
// offers baking straight from the fridge as a third choice. Software fixture,
// not a bake trial.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-11-10T15:00:00+08:00');
const BAKE=Date.parse('2026-11-11T08:00:00+08:00');
const START=Date.parse('2026-11-10T16:00:00+08:00');
const night={label:'Tuesday night',from:Date.parse('2026-11-10T23:00:00+08:00'),to:Date.parse('2026-11-11T07:00:00+08:00')};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
async function seed(page,locale){
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'simple',bakeType:'bread',styleKey:'baguette',numItems:5,itemWeight:350,ovenType:'home_oven_stone_bread',mixerType:'hand',yeastType:'instant',kitchenTemp:19,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:START,eatTime:BAKE,blocks:[night],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('fridge-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('fridge-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
}
for(const locale of ['en','fr'])test(`${locale} simple: breakfast baguettes can bake straight from the fridge, survive reload and undo`,async({page})=>{
 const fr=locale==='fr';
 await seed(page,locale);
 const decision=page.locator('[data-simple-decision]');
 await expect(decision).toBeVisible({timeout:30000});
 await expect(decision).toContainText(fr?/La pâte doit sortir du réfrigérateur à .*pendant la nuit/:/Your dough needs to leave the fridge at .*during the night/);
 await expect(decision.locator('[data-simple-keep]')).toContainText(fr?/^Garder .* : vous, ou quelqu’un d’autre, sortez la pâte à /:/^Keep .*: you or someone else takes the dough out at /);
 const straight=decision.locator('[data-simple-from-fridge]');
 await expect(straight).toHaveText(fr?/^Cuire à la sortie du frigo — sortez les pâtons à \d+h\d\d, pendant que le four chauffe$/:/^Bake straight from the fridge — take the loaves out at \d+:\d\d(am|pm) while the oven heats$/);
 expect((await straight.boundingBox()).height).toBeGreaterThanOrEqual(44);
 const before=await stored(page);
 await straight.tap();
 await expect(decision).toHaveCount(0);
 const note=page.locator('[data-simple-from-fridge-note]');
 await expect(note).toContainText(fr?/^Cuisson à la sortie du frigo : sortez les pâtons à /:/^Baking straight from the fridge: take the loaves out at /);
 await expect.poll(async()=>(await stored(page)).blocks.some(block=>block.bakeFromFridge===BAKE)).toBe(true);
 const chosen=await stored(page);
 expect(chosen.eatTime).toBe(before.eatTime);expect(chosen.startTime).toBe(before.startTime);
 await page.reload();
 await expect(note).toBeVisible({timeout:30000});
 await expect(decision).toHaveCount(0);
 await note.locator('[data-simple-from-fridge-undo]').tap();
 await expect(decision).toBeVisible();
 await expect.poll(async()=>(await stored(page)).blocks.some(block=>block.bakeFromFridge!==undefined)).toBe(false);
});
