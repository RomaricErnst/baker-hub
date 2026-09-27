// Real mounted guide: first entry, direct browsing, overview, phase return and reload.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'.ci-tools/package.json'));
const {build}=require('esbuild'),{JSDOM}=require('jsdom');
const bundle=await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import Guide from './app/components/BakeGuide';import {buildSchedule} from './app/utils';
window.mountGuide=(style='neapolitan')=>{
 const schedule=buildSchedule(new Date('2030-04-01T07:00Z'),new Date('2030-04-02T19:30Z'),[],22,45,'hand',style);
 const r=createRoot(document.getElementById('root'));
 const render=(phase='preparation',active=true)=>r.render(<Guide schedule={schedule} styleKey={style} mixerType="hand" kitchenTemp={22} numItems={4} oil={0} hydration={65} locale="en" phase={phase} active={active} progressTarget={document.getElementById('progress')}/>);
 render();return {render,unmount:()=>r.unmount()};
};`,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',alias:{'next-intl':path.join(root,'tests/roundtrip/stub-next-intl.js')},define:{'process.env.NODE_ENV':'"development"'},nodePaths:[path.join(root,'node_modules')]});
const dom=new JSDOM('<div id="progress"></div><div id="root"></div>',{url:'https://bakerhub.app',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.eval(bundle.outputFiles[0].text);
const settle=()=>new Promise(r=>setTimeout(r,200));
// Concurrent suites can delay React commits; wait for observable state, never weaken it.
async function expectEventually(assertion){
 const deadline=Date.now()+5000;
 while(true){try{assertion();return;}catch(error){if(Date.now()>=deadline)throw error;await new Promise(r=>setTimeout(r,25));}}
}
const click=async(label)=>{const b=[...w.document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent).includes(label));assert.ok(b,label);b.click();await settle();};
const visible=()=>[...w.document.querySelectorAll('[data-guide-step]')].filter(e=>!e.hidden&&e.style.display!=='none');
for(const style of ['neapolitan','pain_campagne','piadina']){
 w.localStorage.clear();let app=w.mountGuide(style);await settle();
 await expectEventually(()=>assert.ok(visible().length>1,'first visit is overview'));
 assert.match(w.document.body.textContent,/Start preparation/);
 if(style==='neapolitan')assert.match(w.document.body.textContent,/Fold 1/);
 await click('Start preparation');await expectEventually(()=>assert.equal(visible().length,1));
 await click('Overview');await expectEventually(()=>assert.ok(visible().length>1));const target=visible()[1];const title=target.dataset.guideTitle;
 target.querySelector('button').click();await settle();await expectEventually(()=>assert.equal(visible()[0]?.dataset.guideTitle,title));
 assert.equal(w.document.querySelector('input[type=checkbox]')?.checked,false,'browsing does not complete');
 await click('Overview');await click('Resume preparation');await expectEventually(()=>assert.equal(visible()[0]?.dataset.guideTitle,title));
 app.render('preparation',false);await settle();app.render();await settle();await expectEventually(()=>assert.equal(visible()[0]?.dataset.guideTitle,title));
 app.render('cooking');await settle();app.render('preparation');await settle();await expectEventually(()=>assert.equal(visible()[0]?.dataset.guideTitle,title));
 app.unmount();await settle();app=w.mountGuide(style);await settle();await expectEventually(()=>assert.equal(visible().length,1));assert.equal(visible()[0].dataset.guideTitle,title,'reload resumes browsed step');
 app.unmount();await settle();console.log('PASS overview and resume:',style);
}
w.close();
