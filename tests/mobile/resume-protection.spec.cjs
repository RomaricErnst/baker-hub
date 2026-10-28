const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const draft=()=>({version:1,savedAt:Date.now(),bakeName:'AUDIT resume protection',tab:'simple',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},prefermentType:'none',prefOffsetH:0,flourInFridge:false,eatTime:null,startTime:null,blocks:[],recipeGenerated:false,modeChosen:true,activeStep:3,highestStep:3,activeTab:'batch'});
for(const locale of ['fr','en']) {
 test(`${locale}: one resume choice after starting a new bake and returning`,async({page})=>{
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,body:'{}'}));
  await page.goto(locale==='fr'?'/fr':'/');
  const original=JSON.stringify(draft());
  await page.evaluate(value=>localStorage.setItem('bh_session_v1',value),original);
  await page.reload();
  await expect(page.getByRole('button',{name:locale==='fr'?'Masquer':'Dismiss',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:locale==='fr'?'Nouvelle fournée':'Start a new bake',exact:true}).tap();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button',{name:locale==='fr'?'Reprendre →':'Resume →',exact:true})).toHaveCount(0);
  const undo=page.getByRole('button',{name:locale==='fr'?'Annuler la nouvelle fournée':'Undo new bake',exact:true});
  await expect(undo).toBeVisible();
  await expect(undo).toHaveCount(0,{timeout:10000});
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  await expect(undo).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bh_previous_bake_v1')).session)).toBe(original);
  await page.locator('.bh-batch-content').getByRole('button',{name:locale==='fr'?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1'))?.bakeType)).toBe('pizza');
  await page.reload();
  await expect(page.getByRole('button',{name:locale==='fr'?'Reprendre →':'Resume →',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:locale==='fr'?'Annuler la nouvelle fournée':'Undo new bake',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Menu',exact:true}).tap();
  await page.getByRole('button',{name:locale==='fr'?'Mes fournées':'My bakes',exact:true}).tap();
  await page.getByRole('button',{name:/AUDIT resume protection/}).first().tap();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1'))?.bakeName)).toBe('AUDIT resume protection');
 });
 test(`${locale}: explicit new bake is immediate and recovery survives reload`,async({page})=>{
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,body:'{}'}));
  await page.goto(locale==='fr'?'/fr':'/');
  await page.evaluate(value=>{localStorage.setItem('bh_session_v1',JSON.stringify(value));localStorage.setItem('bh_shop_ticks_v1','{"flour":true}');},draft());
  await page.reload();
  await page.getByRole('button',{name:locale==='fr'?'Nouvelle fournée':'Start a new bake',exact:true}).tap();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('button',{name:locale==='fr'?'Reprendre →':'Resume →',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:locale==='fr'?'Annuler la nouvelle fournée':'Undo new bake',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Menu',exact:true}).tap();
  await page.getByRole('button',{name:locale==='fr'?'Mes fournées':'My bakes',exact:true}).tap();
  await page.getByRole('button',{name:/AUDIT resume protection/}).first().tap();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1'))?.numItems)).toBe(4);
  expect(await page.evaluate(()=>localStorage.getItem('bh_shop_ticks_v1'))).toBe('{"flour":true}');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bh_local_bakes_v1')).length)).toBeGreaterThan(0);
 });
 test(`${locale}: a newer draft is protected when starting a new bake`,async({page})=>{
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,body:'{}'}));
  await page.goto(locale==='fr'?'/fr':'/');
  await page.evaluate(value=>localStorage.setItem('bh_session_v1',JSON.stringify(value)),draft());
  await page.reload();
  await expect(page.getByRole('button',{name:locale==='fr'?'Nouvelle fournée':'Start a new bake',exact:true})).toBeVisible();
  const newer=JSON.stringify({...draft(),bakeName:'AUDIT newer draft',numItems:24});
  await page.evaluate(value=>localStorage.setItem('bh_session_v1',value),newer);
  await page.getByRole('button',{name:locale==='fr'?'Nouvelle fournée':'Start a new bake',exact:true}).tap();
  expect(await page.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBe(newer);
  await expect(page.getByRole('alert').filter({hasText:locale==='fr'?'Cette fournée a été modifiée':'This bake was updated'})).toBeVisible();
 });
 test(`${locale}: stale pagehide cannot overwrite a draft from another tab`,async({page,context})=>{
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,body:'{}'}));
  await page.goto(locale==='fr'?'/fr':'/');
  const original=draft();
  await page.evaluate(value=>localStorage.setItem('bh_session_v1',JSON.stringify(value)),original);
  await page.reload();
  await page.getByRole('button',{name:locale==='fr'?'Reprendre →':'Resume →',exact:true}).tap();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')).savedAt)).not.toBe(original.savedAt);
  // A second tab writes a distinct named fixture, after the first tab settled.
  const other=await context.newPage();await other.goto(locale==='fr'?'/fr':'/');
  const newer=JSON.stringify({...draft(),bakeName:'AUDIT newer tab',numItems:24});
  await other.evaluate(value=>localStorage.setItem('bh_session_v1',value),newer);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  expect(await other.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBe(newer);
  await expect(page.getByRole('alert').filter({hasText:locale==='fr'?'Cette fournée a été modifiée':'This bake was updated'})).toBeVisible();
 });
}
