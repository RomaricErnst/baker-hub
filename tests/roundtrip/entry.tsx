// Mounts the REAL SchedulePicker with parent-like state, one scenario per mount.
// Every solver output the parent would receive is recorded on window.__h so the
// runner can compare plans on data (times, feeds, validity), not only card text.
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import SchedulePicker from '../../app/components/SchedulePicker';
import {buildSchedule} from '../../app/utils';

type Ratio = 1 | 2 | 4 | 5 | 10;
const w = window as any;

function Harness({ sc }: { sc: any }) {
  const [startTime, setStartTime] = useState<Date>(sc.start);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [starterLocation, setStarterLocation] = useState<'rt' | 'fridge'>(sc.loc);
  const [lastFedAge, setLastFedAge] = useState<any>(sc.age);
  const [lastFedTime, setLastFedTime] = useState<Date | null>(sc.lastFed);
  const [lastFeedRatio, setLastFeedRatio] = useState<Ratio>(1);
  const [nextFeedRatio, setNextFeedRatio] = useState<Ratio>(1);
  const [nextFeedRatioOverride, setNextFeedRatioOverride] = useState<Ratio | null>(null);
  const [ratioMode, setRatioMode] = useState<'recommend' | 'keep'>(sc.ratioMode);
  const [tang, setTang] = useState<'mild' | 'balanced' | 'tangy'>('balanced');

  const rec = w.__h.rec;
  // Compare effective parent state, including the initial ratio. A callback
  // emitting the unchanged initial value is not a state divergence.
  rec.nextRatio = nextFeedRatio;
  // PAGE mode mirrors app/[locale]/page.tsx on the branch: the parent feeds
  // starter events, timing overrides, validity and the confirmed-plan key back
  // into the picker. The 29 Aug harness (component-only) did not.
  const PAGE = !!sc.page;
  const [timingOverrides, setTimingOverrides] = useState<any>({});
  const [accepted, setAccepted] = useState<string | null>(null);
  const [starterEvents, setStarterEvents] = useState<any[]>([]);
  const [starterTimingValid, setStarterTimingValid] = useState(true);
  const key = (st: Date, bl: any[]) => JSON.stringify([+st, +sc.eat, bl.map((x: any) => [+x.from, +x.to, x.label])]);
  const onChange = useCallback((s: Date, _e: Date, b: any[], opts?: any) => {
    setAccepted(opts?.preservePlan ? key(s, b) : null);
    if (opts?.timingOverrides !== undefined) setTimingOverrides(opts.timingOverrides);
    if (opts?.starterPlan) setStarterEvents(opts.starterPlan.events);
    setStartTime(s); setBlocks(b);
    rec.start = s?.toISOString(); rec.blocks = b.map((x: any) => `${x.label}|${+x.from}|${+x.to}`);
    if (opts?.timingOverrides) rec.overrides = JSON.stringify(opts.timingOverrides);
  }, [rec]);

  return (
    <SchedulePicker
      startTime={startTime} eatTime={sc.eat} blocks={blocks} preheatMin={45}
      styleKey={sc.style} kitchenTemp={sc.temp} bakeType={sc.full&&sc.style==='sourdough'?'pizza':'bread'} isSourdough mode="custom"
      {...(sc.full?{schedule:buildSchedule(startTime,sc.eat,blocks,sc.temp,45,'hand',sc.style),mixerType:'hand' as const,numItems:4}:{})}
      onChange={onChange}
      starterLocation={starterLocation} onStarterLocationChange={(l) => { setStarterLocation(l); rec.loc = l; }}
      planningMode="last_fed"
      lastFedTime={lastFedTime} onLastFedTimeChange={setLastFedTime}
      lastFedAge={lastFedAge} onLastFedAgeChange={(a) => { setLastFedAge(a); rec.age = a; }}
      lastFeedRatio={lastFeedRatio} onLastFeedRatioChange={setLastFeedRatio}
      nextFeedRatio={nextFeedRatio} onNextFeedRatioChange={(r) => { setNextFeedRatio(r); rec.nextRatio = r; }}
      nextFeedRatioOverride={nextFeedRatioOverride} onNextFeedRatioOverrideChange={setNextFeedRatioOverride}
      ratioMode={ratioMode} onRatioModeChange={setRatioMode}
      tang={tang} onTangChange={setTang}
      fridgeTemp={6} flourStrength={1.0}
      {...(PAGE ? { timingOverrides, confirmedPlan: accepted === key(startTime, blocks), savedStarterEvents: starterEvents,
                    starterTimingValid } : {})}
      onStarterEventsChange={(ev) => { if (PAGE) setStarterEvents(ev || []); rec.events = (ev || []).map((e: any) => `${e.kind ?? e.type}@${e.time ? +new Date(e.time) : ''}`).join(','); }}
      onFeedTimeChange={(t) => { rec.feed = t ? +t : null; }}
      onFridgeOutTimeChange={(t) => { rec.fridgeOut = t ? +t : null; }}
      onScheduleValidityChange={(v) => { rec.scheduleValid = v; }}
      onStarterTimingValidityChange={(v) => { if (PAGE) setStarterTimingValid(v); rec.starterValid = v; }}
    />
  );
}

w.__mount = (el: HTMLElement, sc: any) => {
  w.__h = { rec: {} };
  const root = createRoot(el);
  root.render(<Harness sc={sc} />);
  return root;
};
