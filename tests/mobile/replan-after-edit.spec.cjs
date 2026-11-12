const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// A yeast amount entered after the recipe exists re-times the plan before returning to the recipe.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T09:00:00+08:00');
const BAKE=Date.parse('2026-10-04T19:00:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));


test('editing the yeast after generation updates the plan and says what moved',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:BAKE-24*3600000,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('replan-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('replan-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await expect(page.getByRole('region',{name:'Your key times',exact:true})).toBeVisible();
 await expect.poll(async()=>(await stored(page))?.startTime).toBeTruthy();
 await page.getByRole('button',{name:'Fine-tune →',exact:true}).tap();
 await page.getByRole('button',{name:'Bake time →',exact:true}).tap();
 await page.getByRole('button',{name:'Create my recipe',exact:true}).tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
 const automatic=(await stored(page)).startTime;

 // Review my choices → Fine-tune → Edit.
 await page.getByRole('button',{name:'My choices',exact:true}).first().tap();
 await page.getByRole('button',{name:'Edit : Fine-tune',exact:true}).tap();
 const yeast=page.locator('[data-yeast-override] input:visible');
 const recommended=Number(await yeast.inputValue());
 await yeast.fill(String(Math.round(recommended*3*1000)/1000));await yeast.blur();
 await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Update and back to Recipe',exact:true}).tap();

 // Back on the recipe, with the plan already re-timed and a note saying so.
 const moved=page.locator('[data-plan-moved]');
 await expect(moved).toBeVisible({timeout:20000});
 await expect(moved).toContainText('Plan updated');
 await expect(moved).toContainText(/Start Dough \w{3} \d+ \w{3} · /);
 const after=await stored(page);
 expect(after.startTime-automatic).toBeGreaterThan(3*3600000);
 expect(after.eatTime).toBe(BAKE);
 expect(after.recipeGenerated).toBe(true);
 await moved.getByRole('button',{name:'OK',exact:true}).tap();
 await expect(page.locator('[data-plan-moved]')).toHaveCount(0);
 expect(errors).toEqual([]);
});
