// Flour strength (21 Nov 2026, owner): a STATED W sets the fermentation tolerance of a white
// wheat flour (ftmFromW, replacing the type's value); hydration follows the flour type only;
// the yeast reaches the flour only through the plan's hours (no ÷ tolerance at a fixed schedule).
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
const {utils,data}=require('./load-production.cjs');
const path=require('node:path'),resolve=Module._resolveFilename,original=Module._load;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
Module._load=function(id,parent,main){if(id==='next-intl')return {useLocale:()=>'en',useTranslations:()=>()=>''};return original.call(this,id,parent,main);};
const compile=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true},fileName:f}).outputText,f);
require.extensions['.tsx']=compile;require.extensions['.ts']=compile;
const {flourBehaviour,flourEngineW}=require('../app/components/FlourCatalogueBrowser.tsx');
const {manualFlourSelection}=require('../app/components/FlourPicker.tsx');
Module._load=original;
const DB=require('../lib/flourCatalogue.json');
const {ftmFromW,flourTolerance,computeBlendProfile,FLOUR_DATA,W_TOLERANCE_FLOURS}=data;
const close=(x,y,msg)=>a.ok(Math.abs(x-y)<1e-9,`${msg}: ${x} vs ${y}`);
const single=(flour1,w1,w1Source,extra={})=>({flour1,flour2:null,ratio1:100,w1,w1Source,...extra});
const tol=b=>computeBlendProfile(b).fermToleranceMultiplier;

test('ftmFromW passes through its anchors, rises monotonically and is flat outside 130–360',()=>{
  for(const [w,t] of [[130,0.75],[200,0.90],[250,1.00],[300,1.20],[360,1.35]])close(ftmFromW(w),t,`W${w}`);
  close(ftmFromW(165),0.825,'midpoint 130–200');close(ftmFromW(330),1.275,'midpoint 300–360');
  for(const w of [1,50,100,129])close(ftmFromW(w),0.75,`W${w}`);
  for(const w of [361,400,500])close(ftmFromW(w),1.35,`W${w}`);
  let last=-Infinity;for(let w=100;w<=420;w+=1){const t=ftmFromW(w);a.ok(t>=last-1e-12,`monotone at ${w}`);last=t;}
});

test('each white-wheat type at its typical W gets exactly its type tolerance',()=>{
  for(const k of W_TOLERANCE_FLOURS)close(ftmFromW(FLOUR_DATA[k].w),FLOUR_DATA[k].fermTolerance,k);
});

test('only a stated W counts: typical, missing source and a legacy wOverride keep the type',()=>{
  for(const k of Object.keys(FLOUR_DATA)){
    const typ=FLOUR_DATA[k].fermTolerance;
    a.equal(tol({flour1:k,flour2:null,ratio1:100}),typ,`${k} bare`);
    a.equal(tol(single(k,380,'typical')),typ,`${k} typical`);
    a.equal(tol(single(k,380,undefined)),typ,`${k} no source`);
    // Legacy: the blended W lived in wOverride; it is never flour 1's stated W.
    a.equal(tol({flour1:k,flour2:null,ratio1:100,wOverride:380,w1Source:'manual'}),typ,`${k} legacy wOverride`);
  }
});

test('a stated W replaces the type tolerance for white wheat, from every stated source',()=>{
  for(const src of ['manual','photo','exact'])for(const k of W_TOLERANCE_FLOURS){
    a.equal(tol(single(k,320,src)),1.25,`${k} ${src} W320`);
    a.equal(tol(single(k,200,src)),0.9,`${k} ${src} W200`);
    a.equal(tol(single(k,380,src)),1.35,`${k} ${src} W380`);
  }
});

test('rye, wholemeal and semolina ignore a stated W',()=>{
  for(const k of ['rye','wholemeal','semolina'])for(const w of [120,250,400])a.equal(tol(single(k,w,'manual')),FLOUR_DATA[k].fermTolerance,`${k} W${w}`);
});

test('blends weigh each component by its own tolerance',()=>{
  const b={flour1:'pizza00',flour2:'rye',ratio1:80,w1:360,w1Source:'manual',w2:120,w2Source:'manual'};
  a.equal(tol(b),Math.round((1.35*0.8+0.7*0.2)*100)/100);
  const three={flour1:'bread',flour2:'pizza00',ratio1:50,ratio2:30,flour3:'wholemeal',w1:300,w1Source:'exact',w2:200,w2Source:'typical',w3:400,w3Source:'manual'};
  a.equal(tol(three),Math.round((1.2*0.5+1.0*0.3+0.8*0.2)*100)/100);
  a.equal(flourTolerance('pizza00',200,'typical'),1);
});

test('hydration follows the flour type only: identical for every style × type × W × protein × source',()=>{
  const start=new Date('2026-11-23T08:00Z'),plan=utils.buildSchedule(start,new Date(+start+30*3600000),[],22,45,'stand','neapolitan',4,1,false);
  const styles=Object.keys({...data.PIZZA_STYLES,...data.BREAD_STYLES});
  let n=0;
  for(const style of styles)for(const k of Object.keys(FLOUR_DATA)){
    const base=b=>{try{return utils.calculateRecipe(style,'home_oven_standard',4,260,22,'normal',plan,6,'instant','custom','stand',undefined,undefined,undefined,b,'none').hydration;}catch{return 'err';}};
    const ref=base({flour1:k,flour2:null,ratio1:100});
    for(const w of [130,250,320,390])for(const src of ['manual','exact','photo','typical'])for(const protein of [undefined,10,14.5]){
      const b=single(k,w,src,protein===undefined?{}:{manualFlour1:{type:k,protein,proteinSource:'manual'}});
      a.equal(base(b),ref,`${style}/${k}/W${w}/${src}/${protein}`);n++;
      a.equal(computeBlendProfile(b).hydrationDelta,FLOUR_DATA[k].hydrationDelta);
    }
  }
  a.ok(n>1000);
});

test('at a fixed schedule the yeast does not depend on the flour tolerance',()=>{
  const start=new Date('2026-11-23T08:00Z');
  for(const style of ['neapolitan','newyork','baguette','roman'])for(const hours of [8,24,48])for(const pref of ['none','poolish']){
    const plan=utils.buildSchedule(start,new Date(+start+hours*3600000),[],22,45,'stand',style,4,1,false);
    const r=b=>utils.calculateRecipe(style,'home_oven_standard',4,260,22,'normal',plan,6,'instant','custom','stand',60,undefined,undefined,b,pref);
    const weak=r({flour1:'pizza00',flour2:null,ratio1:100,w1:130,w1Source:'manual'}),strong=r({flour1:'pizza00',flour2:null,ratio1:100,w1:390,w1Source:'manual'});
    a.ok(weak.blendProfile.fermToleranceMultiplier<strong.blendProfile.fermToleranceMultiplier);
    a.equal(weak.yeast.pct,strong.yeast.pct,`${style}/${hours}/${pref}`);
  }
});

test('an entered yeast amount is shown exactly as typed, whatever the flour',()=>{
  const start=new Date('2026-11-23T08:00Z'),plan=utils.buildSchedule(start,new Date(+start+24*3600000),[],22,45,'stand','neapolitan',4,1,false);
  for(const k of ['allpurpose','pizza00','manitoba']){
    const r=utils.calculateRecipe('neapolitan','home_oven_standard',4,260,22,'normal',plan,6,'instant','custom','stand',undefined,undefined,undefined,{flour1:k,flour2:null,ratio1:100},'none',null,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,0.12);
    a.equal(r.yeast.pct,0.12,k);
  }
});

test('reference flours: tolerance and hydration correction by source',()=>{
  const fromDb=id=>{const f=DB.find(x=>x.id===id);a.ok(f,id);return {flour1:flourBehaviour(f),flour2:null,ratio1:100,w1:flourEngineW(f),wOverride:flourEngineW(f),w1Source:f.wPublished?'exact':'typical'};};
  const rows=[
    // id, type tile, tolerance, hydration delta
    ['caputo_pizzeria','pizza00',1.0,0],   // W ~270 estimated: the type, no cliff
    ['caputo_nuvola','pizza00',1.0,0],     // W ~280 estimated
    ['stagioni_gold','strong00',1.35,2],   // 5 Stagioni Oro, W 390 published
    ['polselli_manitoba','manitoba',1.35,3],
    ['francine_t65','bread',0.9,1],
    ['ka_bread','bread',0.9,1],            // US bread flour, W estimated
    ['ka_ap','allpurpose',0.75,-2],
  ];
  for(const [id,tile,t,h] of rows){const b=fromDb(id),p=computeBlendProfile(b);a.equal(b.flour1,tile,id);a.equal(p.fermToleranceMultiplier,t,id);a.equal(p.hydrationDelta,h,id);}
  // Manual entry: the typed W sets tolerance only.
  const manual=manualFlourSelection({flour1:'pizza00',flour2:null,ratio1:100},'pizza00','My 00','320','13','en');
  a.equal(manual.w1Source,'manual');a.equal(tol(manual),1.25);a.equal(computeBlendProfile(manual).hydrationDelta,0);
  const noW=manualFlourSelection({flour1:'pizza00',flour2:null,ratio1:100},'bread','','','','en');
  a.equal(noW.w1Source,'typical');a.equal(tol(noW),0.9);
});

test('catalogue: an estimated W never picks the strong 00 tile; a published W of 270+ keeps it',()=>{
  for(const f of DB){
    const tile=flourBehaviour(f);
    if(tile==='strong00')a.ok(f.wPublished&&f.w>=270,f.id);
  }
});
