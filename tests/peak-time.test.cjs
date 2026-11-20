// One peak format and the starter strip's ready window (20 Nov 2026 chart review, owner's decision).
// The card, the strip and any feed row write the starter's peak through app/utils/peakTime.ts on the
// plan's 15-minute grid ("around 5:45pm" / « vers 17h45 »), so a card at 5:42pm can never sit beside
// a chart at 5:45pm again; the ready window is the solver's green band (mixNearPeak), rounded inward
// to whole hours.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {peakClock,peakAround,peakNote,readyBand,readyHours,readyLabel}=require('../app/utils/peakTime.ts');
const {mixNearPeak}=require('../app/utils/starterPeak.ts');
const {starterStripModel}=require(path.join(__dirname,'../app/components/StarterStrip.tsx'));
const H=3600000;
const at=(h,m=0,d=20)=>new Date(2026,10,d,h,m);

test('the peak is written on the 15-minute grid, the same in every place',()=>{
 assert.equal(peakClock(at(17,42),false),'5:45pm');
 assert.equal(peakClock(at(17,42),true),'17h45');
 assert.equal(peakAround(at(17,42),false),'around 5:45pm');
 assert.equal(peakAround(at(17,42),true),'vers 17h45');
 assert.equal(peakAround(at(17,37),false),'around 5:30pm'); // 7 min past the half hour rounds down
 assert.equal(peakAround(at(23,53),true),'vers 0h00'); // the next day's midnight quarter
 assert.match(peakAround(at(17,42),false,{day:true}),/^around Fri 20 Nov · 5:45pm$/);
 assert.match(peakAround(at(17,42),true,{day:true}),/^vers ven\.? 20 nov\.? · 17h45$/);
});

test('the ready band is exactly the solver green band (mixNearPeak)',()=>{
 const peak=+at(17,42);
 for(const adj of [3,6.5,8,12,20,26]){
  const band=readyBand(peak,adj);
  assert.equal(mixNearPeak(band.from+1000,peak,adj),true,`rising edge in band, adj ${adj}`);
  assert.equal(mixNearPeak(band.to-1000,peak,adj),true,`falling edge in band, adj ${adj}`);
  assert.equal(mixNearPeak(band.from-60000,peak,adj),false,`a minute before the band, adj ${adj}`);
  assert.equal(mixNearPeak(band.to+60000,peak,adj),false,`a minute after the band, adj ${adj}`);
 }
 // adjPeakH 8 h: tolerance clamps to 1.2 h, so 4:00pm–6:54pm around a 5:42pm peak.
 const band=readyBand(peak,8);
 assert.ok(Math.abs((peak-band.from)/H-1.7)<1e-9);assert.ok(Math.abs((band.to-peak)/H-1.2)<1e-9);
});

test('the window is rounded inward to whole hours',()=>{
 const hours=readyHours({from:+at(16,0),to:+at(18,54)});
 assert.deepEqual([hours.from.getHours(),hours.to.getHours()],[16,18]); // 4:00pm is kept, 6:54pm drops to 6pm
 const inner=readyHours({from:+at(16,1),to:+at(19,0)});
 assert.deepEqual([inner.from.getHours(),inner.to.getHours()],[17,19]); // 4:01pm moves up to 5pm
 assert.equal(readyHours({from:+at(16,10),to:+at(16,50)}),null); // no whole hour inside
 assert.equal(readyLabel(readyHours({from:+at(15,30),to:+at(19,20)}),false),'ready 4–7pm');
 assert.equal(readyLabel(readyHours({from:+at(15,30),to:+at(19,20)}),true),'prêt 16h–19h');
 assert.equal(readyLabel(readyHours({from:+at(10,30),to:+at(13,20)}),false),'ready 11am–1pm');
 assert.equal(readyLabel(readyHours({from:+at(23,30,19),to:+at(1,20)}),true),'prêt 0h–1h');
});

test('the strip reads the pre-mix peak and band the picker validates with; a fridge spell is one line',()=>{
 const ev=(kind,time,peak,extra={})=>({kind,time,bellPeakTime:peak,...extra});
 const events=[
  ev('last_fed',at(8,0,14),undefined,{historicalStorage:true}),
  ev('refresh',at(20,30,19),at(4,30)),
  ev('pre_mix',at(8,30),at(17,42)),
 ];
 const model=starterStripModel(events,at(17,30));
 assert.equal(model.peakMs,+at(17,42)); // the card's peak, unchanged
 assert.deepEqual(model.feeds.map(f=>f.kind),['refresh','pre_mix']); // the run-up day's feeds only
 assert.ok(model.band.from<=model.mixMs&&model.mixMs<=model.band.to,'Start Dough sits inside the ready window');
 assert.equal(model.fridge,null);
 // Refresh, into the fridge, out, pre-mix feed: the spell is reported, not drawn.
 const held=starterStripModel([...events.slice(0,2),ev('fridge_in',at(4,30)),ev('fridge_out',at(7,30)),events[2]],at(17,30));
 assert.deepEqual(held.fridge,{from:+at(4,30),to:+at(7,30)});
 // No pre-mix feed (a known peak): no strip.
 assert.equal(starterStripModel([ev('known_peak',at(17,0))],at(17,30)),null);
});

test('a note saved before the shared format reads from the event peak',()=>{
 assert.equal(peakNote({cardNote:'Peak around 5:42pm',bellPeakTime:at(17,42)},false),'Peak around 5:45pm');
 assert.equal(peakNote({cardNote:'Pic vers 17h42 — puis au frigo',bellPeakTime:at(17,42)},true),'Pic vers 17h45 — puis au frigo');
 assert.equal(peakNote({cardNote:'Warm up ~45 min before pre-mix feed'},false),'Warm up ~45 min before pre-mix feed');
});
