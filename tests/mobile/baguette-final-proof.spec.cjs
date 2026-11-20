const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 20 Nov 2026 round 7 (D4, Thomas, Lyon, 20 °C): baguettes kneaded Friday 21:00, asleep 23:30–7:00, baked
// Saturday noon. A shaped baguette proofs at most the equivalent of 1.5 h at 24 °C (2 h to the bake at
// 20 °C; tests/baguette-final-proof.test.cjs, docs/YEAST-MODEL.md §13). With this oven's 30 min preheat: out of
// the fridge at 9h30 (main 9h15), shaped after a 1 h rest, apprêt 1 h 30 (main 1 h 45), the recipe's instant yeast 1,8 g (main 1,7 g).
const Z=s=>Date.parse(s+'Z');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({actionTimeout:20000,timezoneId:'Europe/Paris',locale:'fr-FR'});
async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r7-seeded'))return;sessionStorage.setItem('r7-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
const planRow=(page,name)=>page.locator('li,div').filter({hasText:new RegExp('^\\s*\\S+\\s*'+name+'$')}).last();
const session={version:1,tab:'simple',bakeType:'bread',bakeName:'',styleKey:'baguette',numItems:4,itemWeight:320,ovenType:'home_oven_standard',
 mixerType:'hand',yeastType:'instant',humidity:'normal',fridgeTemp:6,kitchenTemp:20,flourBlend:{flour1:'bread',flour2:null,ratio1:100},flourChosen:true,
 prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,recipeGenerated:true,modeChosen:true,qtyChosen:true,
 customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',
 confirmedSettings:['oven=home_oven_standard','yeast=instant','climate=20'],
 startTime:Z('2026-11-27T20:00'),eatTime:Z('2026-11-28T11:00'),savedAt:Z('2026-11-26T18:00'),
 blocks:[{label:'Fri night',from:Z('2026-11-27T22:30'),to:Z('2026-11-28T06:00')}]};

test('Thomas, baguettes at 20 °C: out of the fridge at 9h30, a short apprêt, the yeast re-solved',async({page})=>{
 await install(page,{bh_session_v1:JSON.stringify(session)},'2026-11-26T19:30:00Z');
 await page.goto('/fr');
 await page.getByRole('button',{name:/^(Reprendre|Voir les ingrédients)/}).first().tap();
 await page.screenshot({path:process.env.SHOT??'test-results/baguette-final-proof.png',fullPage:true});
 // Your plan opens on the key stages (round 7); the take-out, fridge and preheat rows are under All steps.
 {const t=page.locator('[data-plan-all-steps]:visible').first();await expect(t).toBeVisible();if(await t.getAttribute('aria-expanded')==='false')await t.tap();}
 await expect(planRow(page,'Sortir la pâte du réfrigérateur · Diviser et façonner')).toContainText('9h30');
 await expect(planRow(page,'Mettre la pâte au réfrigérateur')).toContainText('23h15');
 await expect(planRow(page,'Préchauffer le four')).toContainText('11h30');
 // The yeast is re-solved for the shorter warm tail: 1,7 g → 1,8 g instant (5,2 → 5,3 g fresh) on main → here.
 await expect(page.getByText('ou 5,3 g de levure fraîche',{exact:false}).first()).toBeVisible();
});
