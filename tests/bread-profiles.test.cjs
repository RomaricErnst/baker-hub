const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils,data}=require('./load-production.cjs');
const {BREAD_PROTOCOLS,BREAD_FERMENTATION_DEFAULTS,getBreadProtocol}=require('../app/utils/breadProfiles.ts');
const start=new Date('2026-10-01T08:00Z');
const schedule=(key,temp,hours,mixer='hand')=>utils.buildSchedule(start,new Date(+start+hours*3600000),[],temp,key==='piadina'?5:20,mixer,key);
const recipe=(key,s,temp,fridge=6,yeast='instant',pref='none',mixer='hand')=>utils.calculateRecipe(key,BREAD_PROTOCOLS[key].equipment[0],BREAD_PROTOCOLS[key].portions.count,BREAD_PROTOCOLS[key].portions.weight,temp,'normal',s,fridge,yeast,'simple',mixer,undefined,undefined,undefined,undefined,pref);

test('all eleven bread profiles have independent protocols, schedule defaults, equipment and source anchors',()=>{
 assert.equal(Object.keys(BREAD_PROTOCOLS).length,11);
 assert.equal(getBreadProtocol('constructor'),undefined);
 for(const [key,p] of Object.entries(BREAD_PROTOCOLS)){
  assert.ok(data.BREAD_STYLES[key]);assert.ok(BREAD_FERMENTATION_DEFAULTS[key]);
  assert.ok(p.sourceUrls.length&&p.sourceUrls.every(u=>u.startsWith('https://')));
  assert.ok(p.equipment.every(k=>data.BREAD_OVEN_TYPES[k]));
  for(const stage of ['shaping','proof','preheat','cookingSteps','cooling'])for(const lang of ['en','fr'])assert.ok(p[stage][lang].length,`${key}/${stage}/${lang}`);
 }
 assert.equal(BREAD_PROTOCOLS.bagel.cooking,'boil-bake');
 assert.equal(BREAD_PROTOCOLS.pita.cooking,'oven');assert.equal(BREAD_PROTOCOLS.greek_pita.cooking,'griddle');
 assert.match(BREAD_PROTOCOLS.ciabatta.shaping.en.join(' '),/not roll/);
 assert.match(data.BREAD_STYLES.batbout.flourNote,/semolina/);
});

test('new yeasted recipes remain finite across climate, fridge, duration and mixers without changing method',()=>{
 for(const key of Object.keys(BREAD_PROTOCOLS).filter(k=>k!=='piadina'))for(const temp of [16,22,30,35])for(const fridge of [3,8])for(const hours of [4,26])for(const mixer of ['hand','stand','spiral','no_knead']){
  const s=schedule(key,temp,hours,mixer),r=recipe(key,s,temp,fridge,'instant','none',mixer);
  const label=`${key}/${temp}/${fridge}/${hours}/${mixer}`;
  for(const n of ['flour','water','salt','oil','sugar','waterTemp','hydration','totalDough'])assert.ok(Number.isFinite(r[n]),`${label}/${n}`);
  assert.ok(r.yeast&&Number.isFinite(r.yeast.convertedGrams),label);
  assert.equal(r.sourdough,null);assert.equal(r.preferment,null);assert.equal(r.protocolIssue,key==='bagel'&&mixer==='no_knead'?'method':undefined);
  assert.ok(Math.abs(r.flour+r.water+r.salt+r.oil+r.sugar+r.yeast.convertedGrams-r.totalDough)<5,label);
 }
});

test('existing temperature, fridge and duration sensitivities reach new bread doses',()=>{
 const warm=recipe('focaccia',schedule('focaccia',30,26),30,6);
 const cool=recipe('focaccia',schedule('focaccia',16,26),16,6);
 assert.notEqual(warm.yeast.grams,cool.yeast.grams);
 const s=schedule('ciabatta',22,26);
 assert.ok(recipe('ciabatta',s,22,3).yeast.grams>recipe('ciabatta',s,22,8).yeast.grams);
 assert.notEqual(recipe('pita',schedule('pita',22,4),22).yeast.grams,recipe('pita',schedule('pita',22,8),22).yeast.grams);
});

test('piadina is rest-only and never gains yeast, sourdough or preferment from stale selections',()=>{
 for(const temp of [16,22,30,35])for(const yeast of ['instant','sourdough'])for(const pref of ['none','biga','poolish']){
  const s=schedule('piadina',temp,.75),r=recipe('piadina',s,temp,8,yeast,pref);
  assert.equal(s.doughMethod,'unleavened');assert.equal(s.totalRTHours,0);assert.equal(s.totalColdHours,0);
  assert.equal(s.finalProofHours,0);assert.equal(s.coldRetard1Start,null);assert.equal(s.preparationInvalid,false);
  assert.equal(r.yeast,null);assert.equal(r.sourdough,null);assert.equal(r.preferment,null);assert.equal(r.hydration,50);assert.equal(r.protocolIssue,undefined);
  assert.ok(Math.abs(r.oil-r.flour*.1)<=.5);
 }
 for(const h of [.1,24])assert.equal(recipe('piadina',schedule('piadina',22,h),22).protocolIssue,'timing');
});

test('unsupported restored bread methods and equipment are explicit',()=>{
 const s=schedule('bagel',22,4);
 assert.equal(recipe('bagel',s,22,6,'sourdough','levain').protocolIssue,'method');
 assert.equal(recipe('bagel',s,22,6,'instant','biga').protocolIssue,'method');
 const r=utils.calculateRecipe('piadina','dutch_oven',4,140,22,'normal',schedule('piadina',22,.75),6,'instant','simple');
 assert.equal(r.protocolIssue,'equipment');assert.equal(r.yeast,null);
});

test('batbout weighs semolina as part of the flour, and custom blends remain explicit',()=>{
 const s=schedule('batbout',22,3),simple=recipe('batbout',s,22);
 assert.deepEqual(simple.flourParts.map(p=>[p.key,p.pct]),[['bread',67],['semolina',33]]);
 assert.equal(simple.flourParts.reduce((sum,p)=>sum+p.grams,0),simple.flour);
 assert.equal(simple.flourParts[0].grams,Math.round(simple.flour*.67));
 assert.ok(simple.blendProfile);
 const custom=utils.calculateRecipe('batbout','griddle',6,100,22,'normal',s,6,'instant','custom','hand',undefined,undefined,undefined,
  {flour1:'bread',flour2:'semolina',flour3:'wholemeal',ratio1:50,ratio2:30});
 assert.deepEqual(custom.flourParts.map(p=>[p.key,p.pct]),[['bread',50],['semolina',30],['wholemeal',20]]);
 assert.equal(custom.flourParts.reduce((sum,p)=>sum+p.grams,0),custom.flour);
 assert.ok(Math.abs(custom.flour+custom.water+custom.salt+custom.oil+custom.sugar+custom.yeast.convertedGrams-custom.totalDough)<5);
});

test('griddle cooking checks the full batch, including a block after cooking begins',()=>{
 const cook=new Date('2026-10-01T12:45Z');
 for(const key of ['piadina','greek_pita','batbout']){
  const mix=new Date(+cook-(key==='piadina'?.75:3)*3600000);
  const blocks=[{label:'Away',from:new Date('2026-10-01T12:46Z'),to:new Date('2026-10-01T13:15Z')}];
  const s=utils.buildSchedule(mix,cook,blocks,22,5,'hand',key,4);
  const expected=BREAD_PROTOCOLS[key].cookMinutes[1]*4;
  assert.equal(s.activeCookMinutes,expected);
  const action=s.availabilityActions.find(a=>a.id==='bake');
  assert.equal(+action.end-+action.at,expected*60000);
  assert.ok(s.availabilityConflicts.some(c=>c.action.id==='bake'));
  const edge=[{label:'After',from:action.end,to:new Date(+action.end+3600000)}];
  const clear=utils.buildSchedule(mix,cook,edge,22,5,'hand',key,4);
  assert.equal(clear.availabilityConflicts.length,0);
 }
 const old=utils.buildSchedule(start,new Date(+start+26*3600000),[],22,60,'hand','neapolitan',4);
 assert.equal(old.activeCookMinutes,undefined);assert.equal(old.availabilityActions.find(a=>a.id==='bake').end,undefined);
});

test('bagel poaching has a count-aware active budget after proof and before the unchanged bake',()=>{
 const bake=new Date('2026-10-01T12:00Z');
 const busy=[{label:'Away',from:new Date('2026-10-01T11:55Z'),to:new Date('2026-10-01T11:56Z')}];
 const s=utils.buildSchedule(start,bake,busy,22,20,'hand','bagel',6);
 assert.equal(s.poachMinutes,12);assert.equal(s.poachStart.toISOString(),'2026-10-01T11:48:00.000Z');
 assert.equal(+s.bakeStart,+bake);assert.ok(s.divideBallTime<s.poachStart);
 assert.ok(s.finalProofStart<s.poachStart);
 assert.equal(s.finalProofHours,(+s.poachStart-+s.finalProofStart)/3600000);
 assert.ok(s.availabilityConflicts.some(c=>c.action.id==='poach'));
 const repair=utils.findScheduleRepair({startTime:start,eatTime:bake,availabilityBlocks:busy,kitchenTemp:22,preheatMin:20,mixerType:'hand',styleKey:'bagel',numItems:6,now:new Date('2026-09-30T00:00Z')});
 assert.ok(repair);assert.equal(repair.kind,'bake');assert.equal(repair.schedule.poachMinutes,12);
 assert.equal(+repair.schedule.bakeStart,+repair.eatTime);assert.equal(repair.schedule.availabilityConflicts.length,0);
 assert.equal(+repair.startTime,+start);
});
