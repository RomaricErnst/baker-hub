const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require('./load-production.cjs');
const {needsScaleHelp,yeastSpoonMeasure,setPercent,DILUTION_BASE_YEAST_G}=require('../app/utils/yeastMeasure.ts');
const {prefermentDilution}=require('../app/utils/prefermentDose.ts');
const {mixingBatchPlan}=require('../app/utils/mixingBatches.ts');
const {utils}=require('./load-production.cjs');
function load(file){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{module:m,exports:m.exports,require:p=>p==='../utils/units'?load('app/utils/units.ts'):require(p)});return m.exports;}
const WaterModule=load('app/components/WaterPreparation.tsx'),Water=WaterModule.default;
const water=(props)=>renderToStaticMarkup(React.createElement(Water,{fridgeTemp:4,readOnly:true,...props})).replace(/ /g,' ');

test('a small cooling correction is one line of cool water; the ice method starts at 50 g',()=>{
 a.equal(WaterModule.ICE_METHOD_MIN_G,50);
 const en=water({waterGrams:405,targetTemp:21,kitchenTemp:22,locale:'en'});
 a.match(en,/405 g of cool water, about 21°C/);
 a.doesNotMatch(en,/ice|After melting/i);
 const fr=water({waterGrams:405,targetTemp:21,kitchenTemp:22,locale:'fr'});
 a.match(fr,/405 g d’eau fraîche, à environ 21 °C/);
 a.doesNotMatch(fr,/glace|Après fonte/);
 // The split other instructions read agrees: no ice, all the water liquid.
 a.deepEqual({...WaterModule.waterSplit({waterGrams:405,targetTemp:21,kitchenTemp:22,fridgeTemp:4})},{water:405,ice:0,cool:true});
 // Just below and at the threshold.
 const at=grams=>WaterModule.waterSplit({waterGrams:grams,targetTemp:8,kitchenTemp:30,fridgeTemp:4});
 a.equal(at(245).ice,0);a.equal(at(245).cool,true);a.equal(at(245).water,245);
 a.equal(at(250).ice,50);a.equal(at(250).cool,false);
 const ice=water({waterGrams:300,targetTemp:8,kitchenTemp:30,locale:'fr'});
 a.match(ice,/60 g de glace/);a.match(ice,/Après fonte complète/);a.doesNotMatch(ice,/g glace/);
 a.match(water({waterGrams:300,targetTemp:8,kitchenTemp:30,locale:'en'}),/60 g ice/);
});

test('one rule for small yeast doses: weighing help under 1 g, a spoon measure across the spoon range',()=>{
 for(const grams of [0.2,0.5,0.79,0.92,0.99])a.equal(needsScaleHelp(grams),true,String(grams));
 for(const grams of [1,1.61,1.95,2.88,0,NaN])a.equal(needsScaleHelp(grams),false,String(grams));
 a.equal(yeastSpoonMeasure(0.79,'instant','en'),'≈ ¼ tsp');
 a.equal(yeastSpoonMeasure(1.61,'instant','en'),'≈ ½ tsp');
 a.equal(yeastSpoonMeasure(2.88,'instant','en'),'≈ 1 tsp');
 a.equal(yeastSpoonMeasure(0.92,'instant','en'),'≈ between ¼ and ½ tsp');
 a.equal(yeastSpoonMeasure(1.95,'instant','en'),'≈ between ½ and ¾ tsp');
 a.equal(yeastSpoonMeasure(1.95,'active_dry','fr'),'≈ entre ½ et ¾ c. à café');
 for(let grams=0.4;grams<=6;grams+=0.07)a.ok(yeastSpoonMeasure(grams,'instant','en'),'spoon for '+grams.toFixed(2));
 a.equal(yeastSpoonMeasure(1.95,'fresh','en'),'');a.equal(yeastSpoonMeasure(0.2,'instant','en'),'');a.equal(yeastSpoonMeasure(8,'instant','en'),'');
});

test('the dilution starts from a weighable 5 g and keeps the same strength',()=>{
 a.equal(DILUTION_BASE_YEAST_G,5);
 for(const lang of ['en','fr']){
  const body=require('../messages/'+lang+'.json').recipeOutput.dilutionBody;
  a.match(body,/\{yeastG\} g/);a.doesNotMatch(body,/\b1 g\b/);
  a.ok(require('../messages/'+lang+'.json').recipeOutput.dilutionInGrams);
 }
 // 1 g in 100 g and 5 g in 500 g are the same solution: the portion is unchanged.
 const tip=utils.commercialDilution(0.4,400,1);
 a.equal(tip.waterG*DILUTION_BASE_YEAST_G,500);
 a.ok(Math.abs(tip.solutionG-0.4*(500+5)/5)<1e-9);
 const pref=prefermentDilution(0.3,200,1);
 a.ok(Math.abs(pref.solutionGrams*DILUTION_BASE_YEAST_G/(DILUTION_BASE_YEAST_G*100)-0.3)<1e-9);
 const source=fs.readFileSync('app/components/RecipeOutput.tsx','utf8');
 a.doesNotMatch(source,/1 g of \$\{yeastName\}|1 g de \$\{yeastName\}| IDY`/);
 a.match(source,/dilutionInGrams/);
});

test('percentages show the setting and the step shows the recipe’s sugar',()=>{
 a.equal(setPercent(20,650,0),3);       // 3 % of 650 g is 19.5 g → 20 g, not "3.1 %"
 a.equal(setPercent(26,650,0),4);
 a.equal(setPercent(3.4,170,1),2);
 a.equal(setPercent(23,650,0),3.5);
 a.equal(setPercent(0,650,0),0);
 for(const flour of [333,500,650,1210])for(const pct of [1,2,3,4,5,8,12])a.equal(setPercent(Math.round(flour*pct/100),flour,0),pct,flour+' '+pct);
 const recipe={totalDough:300,flour:170,water:110,salt:3,oil:5,sugar:3.4,yeast:null,sourdough:null,preferment:null};
 a.equal(mixingBatchPlan(recipe,'hand',1).portion.sugar,3.4);
 const two=[0,1].map(index=>mixingBatchPlan(recipe,'hand',2,index).portion.sugar);
 a.ok(Math.abs(two[0]+two[1]-3.4)<1e-9);
});
