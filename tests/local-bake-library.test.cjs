const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {archiveLocalBake,localBakes,loadSession}=require('../app/lib/session.ts');
const {createDraftStorage}=require('../app/lib/draftStorage.ts');
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('guest library preserves distinct bakes and ignores timestamp-only duplicates',()=>{
 global.localStorage=storage();
 const a={version:1,savedAt:1,bakeType:'pizza',styleKey:'neapolitan',bakeName:'Party'};
 assert.equal(archiveLocalBake(a),true);assert.equal(archiveLocalBake({...a,savedAt:2}),true);
 assert.equal(archiveLocalBake({...a,bakeName:'Sunday'}),true);
 assert.equal(localBakes().length,2);
 localStorage.setItem('bh_session_v1',JSON.stringify(a));assert.equal(loadSession().bakeName,'Party');
});
test('storage failure is reported rather than losing a bake during switching',()=>{
 global.localStorage={getItem:()=>null,setItem(){throw Error('Quota');}};
 assert.equal(archiveLocalBake({version:1,bakeType:'pizza',styleKey:'neapolitan'}),false);
});
test('timestamp-only updates do not pause saving, genuine changed recipes do',()=>{
 const s=storage();s.setItem('draft',JSON.stringify({savedAt:1,numItems:4}));let conflicts=0;
 const draft=createDraftStorage(s,'draft',()=>conflicts++);
 s.setItem('draft',JSON.stringify({savedAt:2,numItems:4}));assert.equal(draft.write(JSON.stringify({savedAt:3,numItems:5})),true);
 s.setItem('draft',JSON.stringify({savedAt:4,numItems:12}));assert.equal(draft.write('{}'),false);assert.equal(conflicts,1);
});
