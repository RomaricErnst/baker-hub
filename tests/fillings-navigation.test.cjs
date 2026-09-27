const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
require('./load-production.cjs');
const {normalizeNavigation,routeForDestination,destinationForRoute}=require('../app/lib/bakeNavigation.ts');
const source=ts.createSourceFile('page.tsx',fs.readFileSync('app/[locale]/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['openDestination','openCompanionPhase','prepareFillingsFromService','captureEditReturn','finishFillings'];
const declarations=[];
function visit(node){if(ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))declarations.push(node.getText(source));ts.forEachChild(node,visit);}
visit(source);
const compiled=ts.transpileModule(declarations.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
function journey(patch={}){
 const state={destination:'service',serviceView:'fillings',protocolView:'dough',prepReturnToService:null,shoppingReturnToFillings:false,fillingsReturn:null,hasFillings:true,recipeGenerated:true,bakeType:'pizza',styleKey:'neapolitan',activeStep:99,advancedStep:99,sandwichParty:{},...patch};
 const context=vm.createContext({...state,routeForDestination,scrollToStepTop(){}});
 for(const name of ['FillingsReturn','PrepReturnToService','ShoppingReturnToFillings','ProtocolView','ServiceView','BatchView','NavHidden','PizzaPartyTab','SandwichParty','ActiveStep','AdvancedStep']){
  const key=name[0].toLowerCase()+name.slice(1);
  context['set'+name]=value=>{context[key]=typeof value==='function'?value(context[key]):value;};
 }
 context.setActiveTab=route=>{context.activeTab=route;context.destination=destinationForRoute(route);};
 vm.runInContext(compiled,context);
 return context;
}
for(const bakeType of ['pizza','bread'])for(const view of ['dough','fillings'])test(`${bakeType}: cooking ${view} survives filling preparation, shopping and reload memory`,()=>{
 const c=journey({bakeType,serviceView:view});
 c.prepareFillingsFromService();
 assert.equal(c.destination,'protocol');assert.equal(c.protocolView,'fillings');
 c.openCompanionPhase('shop');
 assert.equal(c.destination,'shopping');assert.equal(c.shoppingReturnToFillings,true);
 const restored=normalizeNavigation({protocolView:c.protocolView,serviceView:c.serviceView,prepReturnToService:c.prepReturnToService,shoppingReturnToFillings:c.shoppingReturnToFillings});
 const resumed=journey({...restored,bakeType,destination:'shopping'});
 resumed.openCompanionPhase('prep');
 assert.equal(resumed.protocolView,'fillings');
 resumed.openCompanionPhase('bake');
 assert.equal(resumed.destination,'service');assert.equal(resumed.serviceView,view);assert.equal(resumed.prepReturnToService,null);
});
test('ordinary shopping still starts dough preparation and ordinary filling preparation starts the cooking guide',()=>{
 const c=journey({destination:'shopping',prepReturnToService:null});c.openCompanionPhase('prep');assert.equal(c.protocolView,'dough');
 c.protocolView='fillings';c.openCompanionPhase('bake');assert.equal(c.serviceView,'dough');
});
for(const destination of ['protocol','service'])test(`empty selection returns to visible ${destination} dough content`,()=>{
 const c=journey({hasFillings:false,fillingsReturn:{destination,view:'fillings'},prepReturnToService:'fillings'});c.finishFillings();
 assert.equal(c.destination,destination);assert.equal(c[destination==='protocol'?'protocolView':'serviceView'],'dough');assert.equal(c.prepReturnToService,null);
});
