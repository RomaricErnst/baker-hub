import type {RecipeResult} from '../utils';
import {preMixPeakAfterMovedFeed} from './starterPeak';

/** A clock crossing a planned time is never evidence that ingredients were used. */
export interface BakeExecution {
  method: 'none' | 'poolish' | 'biga';
  actualAt: number;
  recordedAt: number;
  inFridge: boolean;
  prefHours: number;
  prefWindow?: {min:number;max:number};
  recipe: RecipeResult;
}
export function normalizeBakeExecution(value: unknown): BakeExecution | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v=value as BakeExecution;
  if (!['none','poolish','biga'].includes(v.method) || !Number.isFinite(v.actualAt)
    || !Number.isFinite(v.recordedAt) || v.actualAt>v.recordedAt || !Number.isFinite(v.prefHours)
    || v.prefHours<0 || typeof v.inFridge!=='boolean' || !v.recipe
    || !['flour','water','salt','totalDough'].every(key=>Number.isFinite(v.recipe[key as keyof RecipeResult]))) return undefined;
  return v;
}
/** The plan in the last generated recipe, as the baker accepted it. */
export interface AcceptedPlan { startTime:number; preparationAt:number; bakeAt?:number }
export function normalizeAcceptedPlan(startTime:unknown, preparationAt:unknown, bakeAt?:unknown): AcceptedPlan | undefined {
  if (typeof startTime!=='number' || !Number.isFinite(startTime)) return undefined;
  const prep=typeof preparationAt==='number'&&Number.isFinite(preparationAt)&&preparationAt<=startTime?preparationAt:startTime;
  return {startTime,preparationAt:prep,...(typeof bakeAt==='number'&&Number.isFinite(bakeAt)&&bakeAt>startTime?{bakeAt}:{})};
}
/** "Plan updated" after a regenerated recipe: what moved since the accepted plan. */
export function acceptedPlanMove(accepted:AcceptedPlan|undefined, startTime:number, bakeAt:number|undefined): {from:number;to:number;bakeFrom?:number} | null {
  if (!accepted || accepted.startTime===startTime) return null;
  return {from:accepted.startTime,to:startTime,...(accepted.bakeAt!==undefined&&bakeAt!==undefined&&accepted.bakeAt!==bakeAt?{bakeFrom:accepted.bakeAt}:{})};
}
/** The time "Have you mixed / made …?" asks about. While the recipe matches the
 * current plan, that plan is the accepted one. While an edit is waiting for the
 * recipe to update, ask about the plan the baker last accepted, so an edit that
 * merely moves the pending start into the past never asks about a plan they did
 * not see. Sessions saved before acceptance was recorded keep the current plan. */
export function promptedPreparationAt(current:number, accepted:number|undefined, recipeStale:boolean): number {
  return recipeStale && accepted!==undefined ? accepted : current;
}
export function preparationStatus(plannedAt:number, execution:BakeExecution|undefined, now:number) {
  return execution ? 'made' : plannedAt<=now ? 'unconfirmed' : 'planned';
}

export interface StarterFeedRecord {
  kind:'refresh'|'intermediate_refresh'|'pre_mix';
  plannedAt:number;
  actualAt:number;
  recordedAt:number;
  ratio:number;
  previousFedAt?:number;
  previousPeakAt?:number;
}
export function normalizeStarterFeedRecords(value:unknown):StarterFeedRecord[] {
  if(!Array.isArray(value))return [];
  return value.filter((v):v is StarterFeedRecord=>!!v&&['refresh','intermediate_refresh','pre_mix'].includes(v.kind)
    &&[v.plannedAt,v.actualAt,v.recordedAt,v.ratio].every(Number.isFinite)&&v.actualAt<=v.recordedAt&&[1,2,4,5,10].includes(v.ratio));
}
export function overdueStarterFeed<T extends {kind:string;time:Date}>(events:T[],records:StarterFeedRecord[],now:number) {
  return events.filter(event=>['refresh','intermediate_refresh','pre_mix'].includes(event.kind)&&+event.time<=now
    &&!records.some(record=>record.kind===event.kind&&(record.plannedAt===+event.time||record.actualAt===+event.time))).sort((a,b)=>+a.time-+b.time)[0];
}

/**
 * A feed done at another time than planned moves only what depends on its rise: the steps after it,
 * up to and including the starter going into the fridge (which resets the chain), or, when no fridge
 * spell follows, every later feed and the mix (same feed-to-mix interval, so the same levain).
 * The fed event takes the actual time; the shift is rounded to the plan's quarter hour.
 * Earlier steps and the bake time never move (Priya's retention review, 17 Nov 2026).
 */
export function shiftStarterPlanAfterFeed<T extends {kind:string;time:Date;bellPeakTime?:Date;bellStartTime?:Date;cardNote?:string}>(events:T[],fed:{kind:string;time:Date},actualAt:number,mixAt:number,formatPeak?:(d:Date)=>string) {
  const plannedAt=+fed.time,quarter=15*60000;
  const shiftMs=Math.round((actualAt-plannedAt)/quarter)*quarter;
  const moved=new Map<number,number>();
  let chainOpen=true;
  const sorted=[...events].sort((a,b)=>+a.time-+b.time);
  // A moved feed's peak moves with it ("Peak around…" on the card and the bell): a pre-mix
  // feed through the shared peak model against the feed before it (preMixPeakAfterMovedFeed),
  // any other step by its own move. The card's note names the new peak time.
  const withTime=(event:T,at:number):T=>{
    const delta=at-+event.time;
    if(!delta)return event;
    const out:T={...event,time:new Date(at)};
    if(event.bellStartTime)out.bellStartTime=new Date(+event.bellStartTime+delta);
    if(event.bellPeakTime){
      const previous=sorted.filter(e=>+e.time<+event.time&&['last_fed','refresh','intermediate_refresh','pre_mix'].includes(e.kind)).at(-1);
      const peak=event.kind==='pre_mix'?preMixPeakAfterMovedFeed(+event.time,+event.bellPeakTime,at,previous?+previous.time:null):+event.bellPeakTime+delta;
      out.bellPeakTime=new Date(peak);
      if(formatPeak&&event.cardNote)out.cardNote=event.cardNote.split(formatPeak(event.bellPeakTime)).join(formatPeak(out.bellPeakTime));
    }
    return out;
  };
  const next=sorted.map(event=>{
    if(event.kind===fed.kind&&+event.time===plannedAt){if(actualAt!==plannedAt)moved.set(plannedAt,actualAt);return withTime(event,actualAt);}
    if(+event.time<=plannedAt||!chainOpen||!shiftMs||event.kind==='last_fed'||event.kind==='known_peak')return event;
    if(event.kind==='fridge_in'&&+event.time<mixAt)chainOpen=false;
    moved.set(+event.time,+event.time+shiftMs);
    return withTime(event,+event.time+shiftMs);
  });
  // The mix follows only an unbroken chain of rises from this feed.
  return {events:next,moved,mixShiftMs:chainOpen?shiftMs:0};
}

/** Mixing is one confirmed action, including for sourdough and a made preferment. */
export interface MixExecution {actualAt:number;recordedAt:number;recipe:RecipeResult}
export function normalizeMixExecution(value:unknown):MixExecution|undefined {
 if(!value||typeof value!=='object')return undefined;
 const v=value as MixExecution;
 return Number.isFinite(v.actualAt)&&Number.isFinite(v.recordedAt)&&v.actualAt<=v.recordedAt&&v.recipe
  &&['flour','water','salt','totalDough'].every(key=>Number.isFinite(v.recipe[key as keyof RecipeResult]))?v:undefined;
}
