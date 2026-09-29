const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const Invitation=require('../app/components/FillingsInvitation.tsx').default;
const Coverage=require('../app/components/pizzaParty/SelectionCoverage.tsx').default;
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));

test('empty invitation is one accessible optional button without introductory reading',()=>{
  for(const fr of [true,false])for(const pizza of [true,false]){
    const html=render(Invitation,{fr,pizza,styleKey:pizza?'neapolitan':'baguette',count:4,selectedCount:0,onChoose:()=>{},compact:true});
    assert.equal((html.match(/<button/g)||[]).length,1);
    assert.doesNotMatch(html,/<h2|<p>/);
    assert.match(html,fr?/Ajouter des garnitures — facultatif/:pizza?/Add toppings — optional/:/Add fillings — optional/);
    assert.match(html,/min-height:44px/);
  }
});

test('bread serving count never becomes a fraction of loaf count',()=>{
  for(const fr of [true,false]){
    const html=render(Invitation,{fr,pizza:false,styleKey:'baguette',count:4,selectedCount:6,onChoose:()=>{},compact:true});
    assert.match(html,fr?/6 portions/:/6 servings/);
    assert.doesNotMatch(html,/sur 4|out of 4|of 4|exceeds|dépasse/);
  }
});

test('pizza partial and excess selections remain explicit; no toppings is not a warning',()=>{
  for(const locale of ['fr','en']){
    const empty=render(Coverage,{locale,selected:0,planned:4});
    assert.match(empty,locale==='fr'?/Pâte uniquement/:/Dough ingredients only/);
    assert.doesNotMatch(empty,/séparément|separately/);
    const partial=render(Coverage,{locale,selected:2,planned:4});
    assert.match(partial,locale==='fr'?/2 pizzas sur 4/:/2 of 4 pizzas/);
    assert.match(partial,/séparément|separately/);
    const excess=render(Coverage,{locale,selected:6,planned:4});
    assert.match(excess,/dépasse|exceeds/);
  }
});

test('shopping has exactly one toppings action in its header, never its footer',()=>{
  const source=fs.readFileSync('app/components/ToppingSelector.tsx','utf8');
  const shopping=source.slice(source.indexOf('function ShoppingList('),source.indexOf('// ───',source.indexOf('function ShoppingList(')+30));
  assert.equal((shopping.match(/onClick=\{onGoPizzas\}/g)||[]).length,1);
  assert.doesNotMatch(shopping,/onClick=\{\(\) => onGoPizzas\?\.\(\)\}/);
  const bread=fs.readFileSync('app/components/SandwichParty.tsx','utf8');
  assert.match(bread,/tab==='shop' \? <button[^\n]+onClick=\{\(\)=>go\('pick'\)\}/);
});

test('generated shopping uses active-only shared actions while existing bases retain their route',()=>{
  const pizza=fs.readFileSync('app/components/ToppingSelector.tsx','utf8');
  assert.match(pizza,/active && onBackToRecipe && <BottomActions>/);
  assert.match(pizza,/!onBackToRecipe && <button/);
  assert.match(pizza,/onBackToRecipe=\{onBackToRecipe\}/);
  const bread=fs.readFileSync('app/components/SandwichParty.tsx','utf8');
  assert.match(bread,/onBackToRecipe \? active&&<BottomActions>/);
  for(const source of [pizza,bread]){
    assert.match(source,/Retour à la recette/);
    assert.match(source,/Back to recipe/);
    assert.match(source,/Go to preparation/);
  }
  const existing=fs.readFileSync('app/components/ExistingBaseJourney.tsx','utf8');
  const label=existing.split('\n').find(line=>line.includes('const selectionDoneLabel='));
  assert.match(label,/Retour à /);
  assert.match(label,/Return to /);
  assert.doesNotMatch(label,/Valider et|Confirm and/);
});
