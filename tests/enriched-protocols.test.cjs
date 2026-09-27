const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {getBreadProtocol}=require('../app/utils/breadProfiles.ts');

test('enriched breads select moderate, family-specific cooking rather than lean-bread fallback',()=>{
  for(const [style,temp] of [['brioche',190],['pain_mie',180],['pain_viennois',220]]){
    const p=getBreadProtocol(style);
    assert.ok(p,style+' has its own cooking route');
    assert.equal(p.ovenTempC,temp);
    assert.equal(p.cooking,'oven');
    assert.ok(!p.supportedMixers.includes('no_knead'));
    for(const locale of ['en','fr']){
      assert.ok(p.preheat[locale].join(' ').includes(String(temp)));
      const bake=p.cookingSteps[locale].join(' ');
      assert.match(bake,/\d+–\d+ min/);
      assert.doesNotMatch(bake,/95–98|20–25|au maximum|as hot as/);
    }
  }
});

test('enriched protocol routing preserves weighed ingredients and rejects unsupported no-knead method',()=>{
  const start=new Date('2030-06-01T08:00Z'),end=new Date('2030-06-02T12:00Z');
  for(const style of ['brioche','pain_mie','pain_viennois']){
    const s=utils.buildSchedule(start,end,[],22,20,'stand',style);
    const r=utils.calculateRecipe(style,'standard_bread',2,500,22,'normal',s,4,'instant','simple','stand');
    const e=r.enrichment;
    const sum=r.flour+r.water+r.salt+r.oil+r.sugar+(r.yeast?.convertedGrams??0)+(e?.milk??0)+(e?.eggs??0)+(e?.butter??0);
    assert.ok(Math.abs(sum-1000)<4,style+' retains whole dough mass');
    assert.equal(r.protocolIssue,undefined);
    const invalid=utils.calculateRecipe(style,'standard_bread',2,500,22,'normal',s,4,'instant','simple','no_knead');
    assert.equal(invalid.protocolIssue,'method');
    if(style==='brioche')assert.ok(Math.abs(e.eggs/r.flour-.5)<.01 && Math.abs(e.butter/r.flour-.5)<.01);
    if(style==='pain_viennois')assert.ok(Math.abs(e.milk/r.flour-.65)<.01);
  }
});
