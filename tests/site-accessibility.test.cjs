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

test('busy-time chip hours and About diet chips are readable',()=>{
  const picker=fs.readFileSync(path.join(__dirname,'../app/components/SchedulePicker.tsx'),'utf8');
  // The hours under "Nights" / "Weekdays": 12px in --smoke, no opacity fade (was 11px at 0.65, 3.18:1).
  assert.equal((picker.match(/<span style=\{\{ fontFamily: 'var\(--font-ui\)', fontSize: '12px', color: 'var\(--smoke\)' \}\}>\s*\{fmtCardHM\(/g)||[]).length,2);
  assert.doesNotMatch(picker,/fontSize: '11px', opacity: \.65 \}\}>\s*\{fmtCardHM/);
  for(const ground of [token('warm'),token('cream')]) assert.ok(ratio(token('smoke'),ground)>=4.5);
  // Sage text on the 12% sage chip of the About page.
  const chip='#'+[0x6B,0x7A,0x5A].map((c,i)=>Math.round(0.12*c+0.88*parseInt(token('cream').slice(1+2*i,3+2*i),16)).toString(16).padStart(2,'0')).join('');
  assert.ok(ratio(token('sage-text'),chip)>=4.5,`sage-text on chip ${ratio(token('sage-text'),chip).toFixed(2)}`);
  const about=fs.readFileSync(path.join(__dirname,'../app/[locale]/about/AboutClient.tsx'),'utf8');
  assert.match(about,/bg="rgba\(107,122,90,0\.12\)" color="var\(--sage-text\)"/);
});

test('landing cards are named by their visible titles',()=>{
  const opening=fs.readFileSync(path.join(__dirname,'../app/components/OpeningChoices.tsx'),'utf8');
  assert.doesNotMatch(opening,/aria-label=/);
  assert.match(opening,/aria-labelledby=\{`opening-title-\$\{choice\.type\}`\}/);
  assert.match(opening,/<span id=\{`opening-title-\$\{choice\.type\}`\}>\{choice\.title\}<\/span>/);
  assert.match(opening,/title:fr\?'Pain & repas':'Bread & meals'/);
});
