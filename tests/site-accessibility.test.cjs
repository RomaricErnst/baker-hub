const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../app/globals.css'),'utf8');

const token=name=>{const m=css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));assert.ok(m,name);return m[1];};
const luminance=hex=>{
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);
  return 0.2126*r+0.7152*g+0.0722*b;
};
const ratio=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};

test('text tokens reach 4.5:1 on warm, cream and white',()=>{
  const grounds=[token('warm'),token('cream'),'#FFFFFF'];
  for(const name of ['smoke','gold-text','ash','char','terra']) {
    for(const ground of grounds) {
      const r=ratio(token(name),ground);
      assert.ok(r>=4.5,`--${name} on ${ground}: ${r.toFixed(2)}`);
    }
  }
  // White on the primary button, at rest and hovered.
  for(const name of ['terra','terra-l']) assert.ok(ratio('#FFFFFF',token(name))>=4.5,name);
});

test('globals.css defines no text below 12px',()=>{
  const small=[...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m=>+m[1]).filter(px=>px<12);
  assert.deepEqual(small,[]);
  const scale=[...css.matchAll(/--text-[a-z0-9]+:\s*(\d+)px/g)].map(m=>+m[1]);
  assert.ok(scale.length>0 && Math.min(...scale)>=12);
});

test('keyboard focus is visible on controls and on the hidden date field wrapper',()=>{
  assert.match(css,/:where\(a, button, \[role="button"\], summary, select, input, textarea[^)]*\)[^{]*:focus-visible\s*\{\s*outline: 2px solid var\(--terra\)/);
  assert.match(css,/:has\(> input\[style\*="opacity: 0"\]:focus-visible\)/);
  assert.match(css,/\.bh-clock-input:focus-within \{ outline:2px solid var\(--terra\)/);
});

test('primary buttons have a hover state limited to fine pointers',()=>{
  const block=css.slice(css.indexOf('@media (hover: hover) and (pointer: fine)'));
  assert.match(block,/\.bh-primary:hover/);
  assert.match(block,/background-color: var\(--terra-l\)/);
});
