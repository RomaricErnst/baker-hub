const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Romaric, 13 Nov 2026: the Recipe's top is one editable title and one line, and the plan's
// own times move in place (Start Dough; Make Poolish in Custom). "Update recipe" applies the
// new time and the recipe follows it; one short line under the row confirms it.
test.use({timezoneId:'Asia/Singapore'});
const unauth=page=>page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));

for(const fr of [false,true])test(`${fr?'fr':'en'}: Simple — title, summary, Start Dough moved from the plan`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await unauth(page);
 const L=(en,f)=>fr?f:en;
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:L('Classic Neapolitan','Napolitaine classique'),exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:L(/^Quantity →$/,/^Quantité →$/)}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 // An evening bake two days ahead, free all day.
 const target=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);d.setHours(19,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const time=page.getByLabel(L('Bake date and time','Date et heure de cuisson'),{exact:true});
 await time.fill(target);await time.blur();
 await page.locator('[data-generate-recipe]').tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Recipe','Recette'));

 // The title is the bake's name, editable in place; an evening bake is a pizza night.
 const title=page.getByRole('heading',{level:1});
 await expect(title).toHaveText(L(/^Pizza night · /,/^Soirée pizza · /));
 await expect(page.locator('[data-bake-summary]')).toContainText(L(/4 pizzas · Classic Neapolitan · \d+ g each$/,/4 pizzas · Napolitaine classique · \d+\s?g chacune$/));
 const rename=async name=>{await page.getByRole('button',{name:L('Rename this bake','Renommer la fournée')}).tap();const input=page.locator('[data-bake-title-input]');await expect(input).toBeFocused();await input.fill(name);await input.press('Enter');};
 await rename(L('Friday with friends','Vendredi entre amis'));
 await expect(title).toHaveText(L('Friday with friends','Vendredi entre amis'));
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'{}').bakeName)).toBe(L('Friday with friends','Vendredi entre amis'));
 // An empty name returns to the automatic one.
 await rename('');
 await expect(title).toHaveText(L(/^Pizza night · /,/^Soirée pizza · /));

 // Simple: only Start Dough is editable, and nothing sends the baker back to the timing screen.
 await expect(page.locator('[data-change-times]')).toHaveCount(0);
 const edit=page.locator('[data-plan-edit]');
 await expect(edit).toHaveCount(1);
 const before=await edit.innerText();
 await edit.scrollIntoViewIfNeeded();await edit.tap();
 const editor=page.locator('[data-plan-editor]');
 await expect(editor).toBeVisible();
 await editor.getByRole('button',{name:'+ 30 min'}).tap();
 await editor.getByRole('button',{name:L('Update recipe','Mettre à jour la recette'),exact:true}).tap();
 await expect(editor).toHaveCount(0);
 // One short line under the row; no "Plan updated" box, and no yeast for a change of a few hundredths
 // of a gram; no calendar line for a plan never sent to the calendar.
 const note=page.locator('[data-plan-note]');
 await expect(note).toHaveText(L('Recipe updated.','Recette mise à jour.'));
 await expect(page.locator('[data-plan-moved]')).toHaveCount(0);
 await expect(edit).not.toHaveText(before);
 // Close leaves the plan as it was.
 const after=await edit.innerText();
 await edit.tap();await editor.getByRole('button',{name:L('Close Start Dough','Fermer Pétrir la pâte'),exact:true}).tap();
 await expect(editor).toHaveCount(0);await expect(edit).toHaveText(after);
 // Two hours earlier changes the yeast by more than a tenth: the line names it.
 await edit.tap();
 for(let i=0;i<4;i++)await editor.getByRole('button',{name:'- 30 min'}).tap();
 await editor.getByRole('button',{name:L('Update recipe','Mettre à jour la recette'),exact:true}).tap();
 await expect(note).toContainText(L(/Yeast now \d/,/Levure : \d/));
 expect(errors).toEqual([]);
});

test('Custom poolish: Make Poolish and Start Dough both move from the plan',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const NOW=Date.parse('2026-10-03T15:25:00+08:00');
 await page.clock.setFixedTime(NOW);
 const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'spiral',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:'poolish',prefOffsetH:11,prefGoesInFridge:true,flourInFridge:false,startTime:Date.parse('2026-10-03T23:40:00+08:00'),eatTime:Date.parse('2026-10-04T20:31:00+08:00'),blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('seeded','1');}sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));},data);
 await unauth(page);
 await page.goto('/');
 // A suggested bake time that fits, then Fine-tune (still to visit) and back to the bake time.
 await page.getByRole('button',{name:'9:00pm',exact:true}).tap();
 await page.getByRole('button',{name:/^Fine-tune/}).tap();
 await page.getByRole('button',{name:/^Bake time →/}).tap();
 await page.getByRole('button',{name:'Create my recipe',exact:true}).filter({visible:true}).first().tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Recipe');
 const edit=page.locator('[data-plan-edit]');
 await expect(edit).toHaveCount(2);
 await expect(page.getByRole('button',{name:'More timing options'})).toBeVisible();
 const before=await edit.first().innerText();
 await edit.first().tap();
 const editor=page.locator('[data-plan-editor]');
 await expect(editor).toContainText('Make Poolish');
 await editor.getByRole('button',{name:'+ 30 min'}).tap();
 await editor.getByRole('button',{name:'Update recipe',exact:true}).tap();
 await expect(page.locator('[data-plan-note]')).toContainText('Recipe updated.');
 await expect(page.locator('[data-plan-moved]')).toHaveCount(0);
 await expect(edit.first()).not.toHaveText(before);
 expect(errors).toEqual([]);
});
