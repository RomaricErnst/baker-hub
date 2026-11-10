const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const H=3600000,bake=new Date('2026-11-11T11:15:00Z');
const plan=(style,temp,hours,blocks=[])=>utils.buildSchedule(new Date(+bake-hours*H),bake,blocks,temp,60,'hand',style,4,1);

test('a near-minimum window ferments at room temperature, without a 2–4 h fridge spell',()=>{
 // Neapolitan, 4 pizzas, 24 °C: the shortest suggested bake (about 8 h) used to plan "Refrigerate · 2h".
 for(const [style,temp,hours] of [['neapolitan',24,8],['neapolitan',24,10],['newyork',26,9],['baguette',22,8],['pain_campagne',22,10],['neapolitan',18,9]]){
  const s=plan(style,temp,hours);
  assert.equal(s.totalColdHours,0,`${style} ${temp}°C ${hours}h`);
  assert.equal(s.coldRetardStart,null);
  assert.ok(s.bulkFermHours>0&&s.finalProofHours>0);
  assert.ok(+s.divideBallTime<=+s.finalProofStart&&+s.finalProofStart<=+s.bakeStart);
 }
});

test('long windows, hot kitchens, required cold and busy times keep their fridge time',()=>{
 assert.ok(plan('neapolitan',24,12).totalColdHours>4.25);
 assert.ok(plan('neapolitan',24,26).totalColdHours>=19);
 // 30 °C: the engine needs cold to keep the dough within its limits.
 assert.ok(plan('neapolitan',30,8).totalColdHours>0);
 assert.ok(plan('brioche',22,10).totalColdHours>=4);
 const away=[{from:new Date(+bake-7*H),to:new Date(+bake-5*H),label:'Away'}];
 assert.ok(plan('neapolitan',24,10,away).totalColdHours>0);
});
