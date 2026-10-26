const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(fr=false){
 const states=[];let i=0,changes=[];const props={total:3240,capacity:5000,count:1,recommended:1,manual:false,knownCapacity:true,override:false,fr,onChange:n=>{changes.push(n);props.override=n!==undefined;props.count=n??props.recommended;}};
 const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/components/MixingBatchControl.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:mod.exports,require:id=>id==='react'?{useState:v=>{const slot=i++;if(!(slot in states))states[slot]=v;return[states[slot],x=>states[slot]=x];}}:require(id)});
 const render=()=>{i=0;return mod.exports.default(props);};
 const all=(tree)=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(all)];
 const find=pred=>all(render()).find(pred);return{props,changes,find,render};
}
for(const fr of [false,true])test(`batch controls preserve automatic mode on open, accept clearing and reset (${fr})`,()=>{
 const h=harness(fr);const button=text=>h.find(n=>n.type==='button'&&n.props.children===text);
 a.equal(h.find(n=>n.type==='input'),undefined);button(fr?'Modifier':'Adjust').props.onClick();a.equal(h.changes.length,0);
 let input=h.find(n=>n.type==='input');a.equal(input.props.value,'1');
 button('+').props.onClick();a.equal(h.props.count,2);
 h.find(n=>n.type==='input').props.onChange({target:{value:''}});a.equal(h.find(n=>n.type==='input').props.value,'');
 h.find(n=>n.type==='input').props.onChange({target:{value:'1'}});h.find(n=>n.type==='input').props.onBlur();a.equal(h.props.count,1);
 h.find(n=>n.type==='input').props.onChange({target:{value:'0'}});h.find(n=>n.type==='input').props.onBlur();a.equal(h.props.count,1);
 h.find(n=>n.type==='button'&&Array.isArray(n.props.children)).props.onClick();a.equal(h.props.override,false);
 h.props.total=6240;h.props.recommended=2;h.props.count=2;a.equal(h.find(n=>n.type==='input').props.value,'2');
});
test('multiple batches expand without an edit and manual overcapacity is visible',()=>{
 const h=harness();h.props.recommended=3;h.props.count=3;a.ok(h.find(n=>n.type==='input'));a.equal(h.changes.length,0);
 h.props.count=1;h.props.total=11000;a.ok(h.find(n=>n.props?.role==='alert'));
});
