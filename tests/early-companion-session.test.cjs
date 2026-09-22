const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {hasSessionWork}=require('../app/hooks/useSessionSave.ts');
const {saveSession,loadSession}=require('../app/lib/session.ts');
const {createSandwichSnapshot}=require('../app/lib/sandwich.ts');

test('autosave distinguishes early companion decisions from an untouched landing page',()=>{
  const empty={bakeType:null,styleKey:null,recipeGenerated:false,pizzaParty:null,sandwichParty:null};
  assert.equal(hasSessionWork(empty),false);
  assert.equal(hasSessionWork({...empty,bakeType:'pizza'}),false);
  assert.equal(hasSessionWork({...empty,bakeType:'bread',sandwichParty:createSandwichSnapshot()}),false);
  assert.equal(hasSessionWork({...empty,bakeType:'pizza',pizzaParty:{qtys:{margherita:0}}}),false);
  assert.equal(hasSessionWork({...empty,bakeType:'pizza',pizzaParty:{qtys:{margherita:2}}}),true);
  assert.equal(hasSessionWork({...empty,bakeType:'bread',sandwichParty:createSandwichSnapshot('baguette')}),true);
  assert.equal(hasSessionWork({...empty,bakeType:'bread',styleKey:'baguette'}),true);
});

test('a pre-setup sandwich session round-trips its family, customized fillings and destination',()=>{
  const storage=new Map();
  const previous=global.localStorage;
  global.localStorage={setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)??null,removeItem:key=>storage.delete(key)};
  try {
    const sandwichParty={...createSandwichSnapshot('baguette'),qtys:{'baguette-jambon-beurre':2},ingredientOverrides:{'baguette-jambon-beurre':{ham:50}},tab:'shop'};
    const session={bakeType:'bread',styleKey:null,recipeGenerated:false,modeChosen:false,activeTab:'sandwiches',sandwichParty};
    assert.equal(hasSessionWork(session),true);
    assert.equal(saveSession(session),true);
    const restored=loadSession();
    assert.equal(restored.activeTab,'sandwiches');
    assert.equal(restored.styleKey,null);
    assert.equal(restored.modeChosen,false);
    assert.equal(restored.sandwichParty.tab,'shop');
    assert.equal(restored.sandwichParty.qtys['baguette-jambon-beurre'],2);
    assert.equal(restored.sandwichParty.ingredientOverrides['baguette-jambon-beurre'].ham,50);
  } finally { global.localStorage=previous; }
});
