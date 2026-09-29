const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

const source=fs.readFileSync('app/components/BottomActions.tsx','utf8')
  .replace(/^import .*$/mg,'').replace('export default function','function');
const compiled=ts.transpileModule(source+';BottomActions',{
  compilerOptions:{jsx:ts.JsxEmit.React},
}).outputText;
const css=fs.readFileSync('app/globals.css','utf8');

test('all journey action classes retain the shared measured action shell',()=>{
  const BottomActions=vm.runInNewContext(compiled,{
    React,useRef:React.useRef,useLayoutEffect:React.useLayoutEffect,
  });
  for(const className of ['', 'bh-batch-actions bh-style-confirm', 'bh-batch-actions bh-batch-actions-navigation']) {
    const html=renderToStaticMarkup(React.createElement(BottomActions,{className},
      React.createElement('button',null,'Retour à mes choix'),
      React.createElement('button',null,'Mettre à jour la recette et revenir')));
    assert.match(html,/class="bh-step-action-slot"/);
    assert.ok(html.includes(`class="bh-step-actions${className?' '+className:''}"`));
  }
});

test('action spacer follows actual wrapping, keyboard hiding and resized safe-area height',()=>{
  let height=101.3, resized, observed, disconnected=false, effect;
  const properties=new Map();
  const space={style:{setProperty:(key,value)=>properties.set(key,value)}};
  const bar={getBoundingClientRect:()=>({height})};
  const refs=[space,bar];
  const BottomActions=vm.runInNewContext(compiled,{
    React,useRef:()=>({current:refs.shift()}),useLayoutEffect:fn=>{effect=fn;},
    ResizeObserver:class {
      constructor(fn){resized=fn;}
      observe(node){observed=node;}
      disconnect(){disconnected=true;}
    },
  });
  BottomActions({children:'Actions'});
  const cleanup=effect();
  assert.equal(observed,bar);
  assert.equal(properties.get('--bh-action-height'),'102px');
  for(const next of [156.2,0,135]) {
    height=next; resized();
    assert.equal(properties.get('--bh-action-height'),`${Math.ceil(next)}px`);
  }
  cleanup();
  assert.equal(disconnected,true);
});

test('mobile chrome reserves safe areas without reviving conflicting catalogue positioning',()=>{
  assert.match(css,/\.bh-header-stack\s*\{[^}]*padding-top:env\(safe-area-inset-top,0px\);[^}]*background:var\(--warm\)/);
  assert.match(css,/\.bh-step-action-slot\s*\{[^}]*height:var\(--bh-action-height,100px\)/);
  assert.match(css,/\.bh-step-actions\s*\{[^}]*position:fixed;[^}]*calc\(24px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css,/\[data-keyboard-open="true"\][\s\S]*?\.bh-step-actions,[\s\S]*?display:none !important/);
  assert.match(css,/\[data-navigation-page\^="organisation:"\] \.bh-header \{ position:static !important/);
  assert.doesNotMatch(css,/\.bh-batch-actions\s*\{[^}]*position:/);
  assert.doesNotMatch(css,/\.bh-batch-content:has\(\.bh-style-confirm\)/);
  assert.doesNotMatch(css,/\.bh-batch-actions\.bh-style-confirm\s*\{/);
});
