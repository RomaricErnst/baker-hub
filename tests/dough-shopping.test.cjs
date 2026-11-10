const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
require('./load-production.cjs');
const {doughShoppingItems,yeastShoppingName,shoppingAmount}=require('../app/lib/doughShopping.ts');
const base={flour:616,salt:15,oil:0,sugar:0,yeast:{convertedGrams:2.88,yeastType:'instant'},sourdough:null,preferment:null};
const list=(recipe,extra={})=>doughShoppingItems({recipe,yeastType:'instant',locale:'en',flourName:'Bread flour',...extra});

test('the list names the yeast the amount was computed for',()=>{
 const yeast=list(base).find(item=>item.tickKey==='dough_2');
 a.deepEqual(yeast,{tickKey:'dough_2',name:'Instant dry yeast',amount:'2.88 g',hint:'one 7 g sachet is plenty'});
 a.equal(list(base,{locale:'fr'}).find(item=>item.tickKey==='dough_2').name,'Levure de boulanger sèche instantanée');
 const fresh=list({...base,yeast:{convertedGrams:8.64,yeastType:'fresh'}},{yeastType:'fresh',locale:'fr'}).find(item=>item.tickKey==='dough_2');
 a.equal(fresh.name,'Levure de boulanger fraîche');a.equal(fresh.amount,'8,64 g');
 a.equal(yeastShoppingName('active_dry','en'),'Active dry yeast');
 // A preferment carries the yeast: its dose and its type are the ones to buy.
 const pref=list({...base,yeast:null,preferment:{prefYeastGrams:0.4,prefYeastType:'active_dry'}}).find(item=>item.tickKey==='dough_2');
 a.deepEqual(pref,{tickKey:'dough_2',name:'Active dry yeast',amount:'0.4 g',hint:'one 7 g sachet is plenty'});
 a.equal(list({...base,yeast:null,sourdough:{}},{yeastType:'sourdough'}).find(item=>item.tickKey==='dough_2').name,'Active starter');
 for(const item of list(base))a.doesNotMatch(item.name,/^Yeast$|^Levure$|IDY/);
});

test('sugar and oil are on the list whenever the recipe has them',()=>{
 a.equal(list(base).some(item=>/Sugar|oil/.test(item.name)),false);
 const items=list({...base,oil:18,sugar:3.4});
 a.deepEqual(items.find(item=>item.name==='Sugar'),{tickKey:'dough_sugar',name:'Sugar',amount:'3.4 g'});
 a.deepEqual(items.find(item=>item.name==='Olive oil'),{tickKey:'dough_3',name:'Olive oil',amount:'18 g'});
 a.equal(list({...base,sugar:74},{locale:'fr'}).find(item=>item.name==='Sucre').amount,'74 g');
});

test('quantities follow the selected units, with one format',()=>{
 const metric=list({...base,oil:18});
 a.deepEqual(metric.map(item=>item.amount),['616 g','15 g','2.88 g','18 g']);
 const imperial=list({...base,oil:18},{units:'imperial'});
 a.deepEqual(imperial.map(item=>item.amount),['21.7 oz','0.5 oz','2.88 g','0.6 oz']);
 for(const item of [...metric,...imperial])a.match(item.amount,/^[\d.,]+ (g|oz)$/);
 const parts=list({...base,flourParts:[{key:'bread',name:'Bread flour',nameFr:'Farine T65',grams:554.4},{key:'rye',name:'Rye flour',nameFr:'Farine de seigle',grams:61.6}]},{locale:'fr'});
 a.deepEqual(parts.slice(0,2),[{tickKey:'dough_flour_bread',name:'Farine T65',amount:'554 g'},{tickKey:'dough_flour_rye',name:'Farine de seigle',amount:'62 g'}]);
});

test('amounts typed without a space and single pieces are normalised where the list is shown',()=>{
 a.equal(shoppingAmount('616g'),'616 g');a.equal(shoppingAmount('300 g'),'300 g');a.equal(shoppingAmount('2.88 g'),'2.88 g');
 a.equal(shoppingAmount('250ml'),'250 ml');a.equal(shoppingAmount('1 pcs'),'1 pc');a.equal(shoppingAmount('2 pcs'),'2 pcs');a.equal(shoppingAmount('—'),'—');
 const source=fs.readFileSync('app/components/ToppingSelector.tsx','utf8');
 a.match(source,/pcs: \{en:'pc',fr:'pièce'\}/);
 a.match(source,/\{shoppingAmount\(ing\.amount\)\}/);
 a.doesNotMatch(source,/>\{ing\.amount\}</);
});
