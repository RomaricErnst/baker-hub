const test = require('node:test');
const assert = require('node:assert/strict');
require('./load-production.cjs');
const {saveSession,loadSession,clearSession}=require('../app/lib/session.ts');
test('local save reports failure instead of false saved state',()=>{
 global.localStorage={setItem(){throw new Error('Storage unavailable')},getItem(){return null},removeItem(){}};
 assert.equal(saveSession({bakeType:'pizza',waterSource:'fridge'}),false);
});
test('local draft round trip retains water choice; clear removes draft',()=>{
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 assert.equal(saveSession({bakeType:'bread',waterSource:'fridge'}),true);
 assert.equal(loadSession().waterSource,'fridge');assert.equal(loadSession().bakeType,'bread');
 clearSession();assert.equal(loadSession(),null);
});
