const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Fine-tune rows (20 Nov 2026 round 7): every label fits one line from 320 to 430 px in EN and FR,
// the unit sits inside the box as a suffix that is neither typed nor selectable, and the input keeps
// the full phrase with its unit as its accessible name.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T09:00:00+08:00');
const BAKE=Date.parse('2026-10-04T19:00:00+08:00');

async function openFineTune(page,locale,width,extra={}){
 await page.setViewportSize({width,height:844});
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,flourBlend:null,prefermentType:'none',prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:BAKE-24*3600000,eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:10,setupOverview:false,activeTab:'setup',...extra};
 await page.addInitScript(data=>{
  if(!sessionStorage.getItem('ft-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('ft-seeded','1');}
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup'}));
 },data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(locale==='fr'?'/fr':'/');
 await page.locator('#step-9 .bh-step-actions').getByRole('button',{name:locale==='fr'?'Étape précédente':'Previous step',exact:true}).tap();
 const fineTune=page.locator('#step-10:visible');
 await expect(fineTune.locator('[data-finetune-group="ingredients"]')).toBeVisible();
 // The optional measured temperatures are rows too.
 await fineTune.locator('summary',{hasText:locale==='fr'?'Températures mesurées':'Measured temperatures'}).click();
 return fineTune;
}

async function labelLines(fineTune){
 return fineTune.locator('[data-finetune-label]').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{
  const r=n.getBoundingClientRect(),cs=getComputedStyle(n);
  const line=cs.lineHeight==='normal'?parseFloat(cs.fontSize)*1.25:parseFloat(cs.lineHeight);
  return {text:n.textContent,height:r.height,line,right:r.right,rows:Math.round(r.height/line)};
 }));
}

for(const locale of ['en','fr'])for(const width of [320,390,430])test(`${locale} ${width}px: every Fine-tune label is one line`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fineTune=await openFineTune(page,locale,width);
 const labels=await labelLines(fineTune);
 // Hydration, salt, oil, sugar, yeast, dough after mixing, bowl loss, fridge, flour.
 expect(labels.length).toBeGreaterThanOrEqual(9);
 for(const l of labels)expect(l,`${l.text} wraps at ${width}px`).toMatchObject({rows:1});
 expect(labels.map(l=>l.text)).toEqual(expect.arrayContaining(locale==='fr'
  ?['Hydratation','Sel','Levure · instantanée','Pâte après pétrissage','Marge pour les pertes','Dans le frigo','Farine']
  :['Hydration','Salt','Yeast · instant dry','Dough after mixing','Extra for bowl loss','Inside the fridge','Flour']));
 // The yeast box is empty until typed: here the plan exists, so it reads the plan's amount greyed; no unit painted.
 const yeast=fineTune.locator('[data-yeast-override] input');
 await expect(yeast).toHaveValue('');
 await expect(yeast).toHaveAttribute('placeholder',locale==='fr'?/^0,\d+ · auto$/:/^0\.\d+ · auto$/);
 await expect(fineTune.locator('[data-yeast-override] [data-unit-suffix]')).toHaveCount(0);
 if(width===320)await page.screenshot({path:test.info().outputPath(`finetune-${locale}-${width}.png`),fullPage:true});
 expect(errors).toEqual([]);
});

test('the unit is a painted suffix: full accessible names, 44 px boxes, nothing to select, no helper lines',async({page})=>{
 const fineTune=await openFineTune(page,'en',390);
 // Round 9 S3: the Fine-tune boxes are decimal text boxes (role textbox, was spinbutton).
 const doughTemp=fineTune.getByRole('textbox',{name:'Dough temperature after mixing, °C',exact:true});
 await expect(doughTemp).toHaveValue('23');
 await expect(fineTune.getByRole('textbox',{name:'Salt, % of flour',exact:true})).toBeVisible();
 await expect(fineTune.getByRole('textbox',{name:'Temperature inside the fridge, near the dough, °C',exact:true})).toHaveValue('6');
 const loss=fineTune.getByRole('textbox',{name:'Extra dough for bowl loss, % of the dough',exact:true});
 // 1.5 % for every bake (was 0).
 await expect(loss).toHaveValue('1.5');
 for(const box of await fineTune.locator('[data-unit-input] input:visible').all()){
  expect((await box.boundingBox()).height).toBeGreaterThanOrEqual(44);
  // Round 8 (bug 2): the yeast boxes are decimal text boxes (« 0,1 » in French). Round 9 S3: every Fine-tune
  // ingredient and process box too (« 2,2 % »); the starter % box (sourdough track) is still a number box.
  if(await box.getAttribute('inputmode')==='decimal')await expect(box).toHaveAttribute('type','text');
  else await expect(box).toHaveAttribute('type','number');
 }
 await expect(fineTune.getByRole('textbox',{name:'Salt, % of flour',exact:true})).toHaveAttribute('inputmode','decimal');
 const suffix=doughTemp.locator('xpath=..').locator('[data-unit-suffix]');
 await expect(suffix).toHaveText('°C');
 await expect(suffix).toHaveAttribute('aria-hidden','true');
 expect(await suffix.evaluate(n=>[getComputedStyle(n).userSelect||getComputedStyle(n).webkitUserSelect,getComputedStyle(n).pointerEvents])).toEqual(['none','none']);
 // The suffix sits inside the box, right of the number.
 const [box,mark]=[await doughTemp.boundingBox(),await suffix.boundingBox()];
 expect(mark.x).toBeGreaterThan(box.x);expect(mark.x+mark.width).toBeLessThanOrEqual(box.x+box.width);
 await expect(fineTune.getByText('Covers dough left in the bowl',{exact:false})).toHaveCount(0);
 await expect(fineTune.getByText('Measured inside the fridge, near the dough.',{exact:true})).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('finetune-en-390-suffix.png')});
});

test('imperial: temperatures read °F and are stored in °C',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('bh_units','imperial'));
 const fineTune=await openFineTune(page,'en',390);
 const doughTemp=fineTune.getByRole('textbox',{name:'Dough temperature after mixing, °F',exact:true});
 await expect(doughTemp).toHaveValue('73');
 await doughTemp.fill('77');await doughTemp.blur();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')).targetDoughTemp)).toBe(25);
});

// Round 7 part 2: a poolish dough has "Yeast · instant dry" over "In the poolish" / "In the final dough"; still one line each.
for(const locale of ['en','fr'])for(const width of [320,430])test(`${locale} ${width}px poolish: the yeast rows are one line`,async({page})=>{
 const fineTune=await openFineTune(page,locale,width,{prefermentType:'poolish',prefermentFlourPct:25,prefOffsetH:13,poolishStorage:'room'});
 const labels=await labelLines(fineTune);
 for(const l of labels)expect(l,`${l.text} wraps at ${width}px`).toMatchObject({rows:1});
 expect(labels.map(l=>l.text)).toEqual(expect.arrayContaining(locale==='fr'?['Levure · instantanée','Dans le poolish','Dans la pâte finale']:['Yeast · instant dry','In the poolish','In the final dough']));
});
