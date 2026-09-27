const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {data}=require('./load-production.cjs');
const m={exports:{}};
const code=ts.transpileModule(fs.readFileSync('app/components/FlourPicker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
vm.runInNewContext(code,{module:m,exports:m.exports,require:p=>p==='../data'?data:p==='@/lib/flourDatabase'?{FLOUR_DB:[]}:p.startsWith('.')?{}:require(p)});
const {manualFlourSelection}=m.exports;
const base={flour1:'pizza00',flour2:'semolina',ratio1:85,w2:180};
test('manual W preserves chosen rye/wholemeal type and other blend slots',()=>{
 for(const type of ['rye','wholemeal']){
  const value=manualFlourSelection(base,type,' My bag ','310','11.7','en');
  assert.equal(value.flour1,type);assert.equal(value.w1,310);assert.equal(value.w1Source,'manual');
  assert.equal(value.flour2,'semolina');assert.equal(value.ratio1,85);assert.equal(value.brandProduct,'My bag');
  assert.equal(value.manualFlour1.protein,11.7);assert.equal(value.manualFlour1.proteinSource,'manual');
  const restored=JSON.parse(JSON.stringify(value));assert.equal(restored.manualFlour1.protein,11.7);
 }
});
test('protein alone never fabricates W; omitted values remain unknown',()=>{
 const withProtein=manualFlourSelection(base,'rye','','','12','fr');
 assert.equal(withProtein.w1,data.FLOUR_DATA.rye.w);assert.equal(withProtein.w1Source,'typical');
 assert.equal(withProtein.brandProduct,data.FLOUR_DATA.rye.nameFr);
 const omitted=manualFlourSelection(base,'bread','','','','en');
 assert.equal(omitted.manualFlour1.protein,undefined);assert.equal(omitted.manualFlour1.proteinSource,undefined);
});
test('invalid manual values cannot replace the current selection',()=>{
 for(const [w,protein] of [['0',''],['501',''],['abc',''],['','0'],['','31'],['','NaN']])assert.equal(manualFlourSelection(base,'rye','',w,protein,'en'),null);
 assert.equal(base.flour1,'pizza00');
});

test('blend separators expose named keyboard sliders and adjacent-pair bounds',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const html=renderToStaticMarkup(React.createElement(m.exports.BlendBar,{parts:[{name:'Base',pct:70,w:270},{name:'Second',pct:20,w:280},{name:'Third',pct:10,w:310}],onChange:()=>{},locale:'en',approx:true}));
 assert.equal((html.match(/role="slider"/g)||[]).length,2);
 assert.match(html,/aria-label="Base · flour percentage" aria-valuemin="5" aria-valuemax="85" aria-valuenow="70"/);
 assert.match(html,/aria-label="Second · flour percentage" aria-valuemin="5" aria-valuemax="25" aria-valuenow="20"/);
 assert.equal((html.match(/tabindex="0"/g)||[]).length,2);
});
