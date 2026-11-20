const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {isKeyStageKey,isKeyPlanRow}=require('../app/utils/planKeySteps.ts');

// Round 7 (owner): Your plan shows the key stages only — the preferment or the levain build, the mix, the bake.
test('key stages: Make Poolish/Biga, the pre-mix levain feed, Start Dough, Bake',()=>{
 for(const key of ['preferment','mix','bake','starter-pre_mix-1'])a.equal(isKeyStageKey(key),true,key);
 for(const key of ['folds','preheat','preferment-cold-in','preferment-cold-out','starter-refresh-1','starter-intermediate_refresh-1','starter-fridge_out-1','shape','start'])a.equal(isKeyStageKey(key),false,key);
});

test('the short plan keeps key stages, the first action when it is one, busy rows and rows the baker edits',()=>{
 const opts={startIsKey:true,editable:[],pinned:[]};
 a.equal(isKeyPlanRow({keys:['folds'],own:false},opts),false);
 a.equal(isKeyPlanRow({keys:['folds','mix'],own:false},opts),true,'a merged row carrying the mix');
 // An autolyse before the mix is the plan's start: kept. A starter refresh days before the build is not.
 a.equal(isKeyPlanRow({keys:['start'],own:true},opts),true);
 a.equal(isKeyPlanRow({keys:['start'],own:true},{...opts,startIsKey:false}),false);
 // A step during a busy time is something to act on.
 a.equal(isKeyPlanRow({keys:['dough-cold-out'],own:false,busy:true},opts),true);
 // A tappable Preheat (after "Last time: preheat longer") and a row with its editor or note open.
 a.equal(isKeyPlanRow({keys:['preheat'],own:false},{...opts,editable:['preheat']}),true);
 a.equal(isKeyPlanRow({keys:['preheat'],own:false},{...opts,pinned:[null,'preheat']}),true);
 a.equal(isKeyPlanRow({keys:['preheat'],own:false},opts),false);
});
