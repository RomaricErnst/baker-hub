const {test}=require('node:test');
const a=require('node:assert/strict');
require('./load-production.cjs');
const {getServingTimeEstimate:estimate,breadCoolingUpperMinutes:cool}=require('../app/utils/servingTime.ts');
const bread={bakeType:'bread',styleKey:'focaccia',numItems:1,itemWeight:700,ovenType:'standard_bread'};

test('existing cook and cooling intervals offset bread readiness without a second preheat or poach',()=>{
  a.equal(estimate(bread).minutes,40);
  a.equal(estimate({...bread,styleKey:'bagel',itemWeight:110}).minutes,45);
  a.equal(estimate({...bread,styleKey:'ciabatta',itemWeight:250}).minutes,55);
  a.match(estimate({...bread,hasFillings:true}).labelEn,/ready to fill/);
  a.match(estimate({...bread,hasFillings:true}).noteEn,/not the meal time/);
});
test('griddle timing follows all portions, without pretending to know untimed cooling',()=>{
  const griddle={...bread,styleKey:'piadina',ovenType:'griddle',itemWeight:140,numItems:4};
  a.equal(estimate(griddle).minutes,24);
  a.equal(estimate({...griddle,styleKey:'greek_pita'}).minutes,28);
  a.equal(estimate({...griddle,styleKey:'batbout',itemWeight:100}),null);
});
test('unknown capacity, untimed steam settling, changed profile weight and invalid inputs fall back',()=>{
  for(const change of [{numItems:2},{numItems:0},{numItems:1.5},{numItems:Infinity},{itemWeight:NaN},{itemWeight:800},{ovenType:'unknown'},{styleKey:'pita',itemWeight:100},{styleKey:'brioche'}])a.equal(estimate({...bread,...change}),null,JSON.stringify(change));
});
test('legacy cooling boundaries remain consistent with guide and include next-day rye',()=>{
  a.equal(cool('baguette',400),60);a.equal(cool('baguette',401),180);
  a.equal(cool('pain_campagne',400),120);a.equal(cool('pain_campagne',401),180);
  a.equal(cool('pain_campagne',1000),180);a.equal(cool('pain_campagne',1001),240);
  a.equal(cool('pain_seigle',750),1440);
  a.equal(estimate({...bread,styleKey:'pain_seigle',itemWeight:750}).minutes,1485);
  const ready=new Date('2026-09-23T01:00:00Z');
  const start=new Date(+ready-estimate({...bread,styleKey:'pain_campagne',itemWeight:750}).minutes*60000);
  a.equal(start.toISOString(),'2026-09-22T21:15:00.000Z');
});
test('pizza readiness is first pizza only and requires known topping heat band',()=>{
  const pizza={...bread,bakeType:'pizza',styleKey:'neapolitan',ovenType:'pizza_oven',itemWeight:270,numItems:6,pizzaOvenTemp:'high'};
  a.equal(estimate(pizza).minutes,1.5);
  a.match(estimate(pizza).labelEn,/First pizza/);
  a.equal(estimate({...pizza,ovenType:'home_oven_steel',pizzaOvenTemp:'low'}).minutes,9);
  a.equal(estimate({...pizza,pizzaOvenTemp:undefined}),null);
  a.equal(estimate({...pizza,styleKey:'pan'}),null);
});
