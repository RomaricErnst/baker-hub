import type {RecipeResult} from '../utils';
import {mixNearPeak, preMixPeakAfterMove, preMixRiseH} from './starterPeak';

/** A clock crossing a planned time is never evidence that ingredients were used. */
export interface BakeExecution {
  method: 'none' | 'poolish' | 'biga';
  actualAt: number;
  recordedAt: number;
  inFridge: boolean;
  prefHours: number;
  prefWindow?: {min:number;max:number};
  recipe: RecipeResult;
  /** The baker gave this time ("Different time?"); a tap is recorded as planned and shows no time. */
  stated?: boolean;
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
  /** The baker gave this time ("Different time?"); a tick is recorded as planned. */
  stated?:boolean;
}
export function normalizeStarterFeedRecords(value:unknown):StarterFeedRecord[] {
  if(!Array.isArray(value))return [];
  return value.filter((v):v is StarterFeedRecord=>!!v&&['refresh','intermediate_refresh','pre_mix'].includes(v.kind)
    &&[v.plannedAt,v.actualAt,v.recordedAt,v.ratio].every(Number.isFinite)&&v.actualAt<=v.recordedAt&&[1,2,4,5,10].includes(v.ratio));
}
export function overdueStarterFeed<T extends {kind:string;time:Date}>(events:T[],records:StarterFeedRecord[],now:number,mixAt?:number) {
  // A feed planned before the last recorded one is behind the baker: never asked again (18 Nov 2026 retention).
  // Like the mix question, a feed is asked only from its time until the plan's next step: unanswered by then,
  // the plan is assumed followed and the question goes (owner's rule A, 18 Nov 2026 retention round 3).
  const lastFed=Math.max(-Infinity,...records.map(record=>record.actualAt));
  const due=events.filter(event=>['refresh','intermediate_refresh','pre_mix'].includes(event.kind)&&+event.time<=now&&+event.time>lastFed
    &&!records.some(record=>record.kind===event.kind&&(record.plannedAt===+event.time||record.actualAt===+event.time))).sort((a,b)=>+b.time-+a.time)[0];
  if(!due)return undefined;
  // The mix is the plan's next step after a pre-mix feed: the starter events alone have none, so the question
  // stayed until the shaping (18 Nov 2026 retention round 4, 9–11 h).
  const next=Math.min(Infinity,...events.filter(event=>+event.time>+due.time).map(event=>+event.time),...(mixAt!==undefined&&mixAt>+due.time?[mixAt]:[]));
  return next<=now?undefined:due;
}

/**
 * A feed done at another time than planned moves only what depends on its rise: the steps after it,
 * up to and including the starter going into the fridge (which resets the chain), or, when no fridge
 * spell follows, every later feed and the mix (same feed-to-mix interval, so the same levain).
 * The fed event takes the actual time; the shift is rounded to the plan's quarter hour.
 * Earlier steps and the bake time never move (Priya's retention review, 17 Nov 2026).
 */
export interface FeedShiftOptions {
  /** Whether a hands-on starter step at this instant falls in a busy period. */
  busy?:(ms:number)=>boolean;
  /** Whether the dough, mixed at this instant, still fits before the fixed bake ('free': with its
   * hands-on steps out of the busy periods; 'busy': it fits but a step falls in one; false: it does not fit). */
  mixFits?:(mixMs:number)=>'free'|'busy'|false;
  now?:number;
}
const FEEDS=['refresh','intermediate_refresh','pre_mix'];
/**
 * A feed done at another time than planned re-times only what its rise affects (Priya's retention
 * reviews, 17–18 Nov 2026). Earlier steps and the bake time never move; the fed event takes the actual time.
 * In order of preference:
 *  1. keep: the next feed, or the mix, stays where it is when the starter is still near its peak at the
 *     planned mix (the pre-mix peak re-derived through the shared peak model, starterPeak.ts);
 *  2. the pre-mix feed alone moves, within free time, so the planned mix meets its peak;
 *  3. every later starter step and the mix move by the feed's own shift (rounded to the quarter hour),
 *     up to and including a starter going into the fridge (which resets the chain), when the dough
 *     still fits; a fridge_in that lands in a busy period takes the nearest free quarter near its peak.
 * `fits` is false only when the dough no longer fits before the bake; `busy` when a hands-on step of
 * the result falls in a busy period although no free option was found.
 */
export function shiftStarterPlanAfterFeed<T extends {kind:string;time:Date;bellPeakTime?:Date;bellStartTime?:Date;cardNote?:string}>(events:T[],fed:{kind:string;time:Date},actualAt:number,mixAt:number,formatPeak?:(d:Date)=>string,options:FeedShiftOptions={}) {
  const plannedAt=+fed.time,quarter=15*60000,hour=3600000;
  const shiftMs=Math.round((actualAt-plannedAt)/quarter)*quarter;
  const busy=options.busy??(()=>false),now=options.now??-Infinity;
  const sorted=[...events].sort((a,b)=>+a.time-+b.time);
  const feedBefore=(at:number)=>sorted.filter(e=>+e.time<at&&['last_fed',...FEEDS].includes(e.kind)).at(-1);
  const notePeak=(event:T,out:T)=>{if(formatPeak&&event.cardNote&&event.bellPeakTime&&out.bellPeakTime)out.cardNote=event.cardNote.split(formatPeak(event.bellPeakTime)).join(formatPeak(out.bellPeakTime));};
  // A moved feed's peak moves with it ("Peak around…" on the card and the bell): a pre-mix
  // feed through the shared peak model against the feed before it (refAt: where that feed now is),
  // any other step by its own move. The card's note names the new peak time.
  const withTime=(event:T,at:number,refAt?:number|null):T=>{
    const delta=at-+event.time;
    const previous=feedBefore(+event.time);
    const oldRef=previous?+previous.time:null,newRef=refAt===undefined?oldRef:refAt;
    if(!delta&&newRef===oldRef)return event;
    const out:T={...event,time:new Date(at)};
    if(event.bellStartTime)out.bellStartTime=new Date(+event.bellStartTime+delta);
    if(event.bellPeakTime){
      const peak=event.kind==='pre_mix'?preMixPeakAfterMove(+event.time,+event.bellPeakTime,oldRef,at,newRef):+event.bellPeakTime+delta;
      out.bellPeakTime=new Date(peak);
      notePeak(event,out);
    }
    return out;
  };
  const fedEvent=sorted.find(e=>e.kind===fed.kind&&+e.time===plannedAt);
  const fedOut=fedEvent?withTime(fedEvent,actualAt):undefined;
  const result=(next:T[],moved:Map<number,number>,mixShiftMs:number,isBusy=false)=>({events:next,moved,mixShiftMs,fits:true,busy:isBusy});
  const baseMoved=()=>{const m=new Map<number,number>();if(actualAt!==plannedAt)m.set(plannedAt,actualAt);return m;};
  const swap=(replacements:Map<T,T>)=>sorted.map(e=>e===fedEvent?fedOut!:replacements.get(e)??e);
  // The steps after the feed, up to the mix.
  const after=sorted.filter(e=>+e.time>plannedAt&&+e.time<mixAt&&e!==fedEvent&&e.kind!=='last_fed'&&e.kind!=='known_peak');
  const nextStep=after[0];
  if(fedEvent&&shiftMs){
    // 1 · keep: the next feed stays (a pre-mix through the peak model against the moved feed), or,
    // when the moved feed is the pre-mix itself, the mix stays near its new peak.
    if(nextStep?.kind==='pre_mix'&&nextStep.bellPeakTime){
      const kept=withTime(nextStep,+nextStep.time,actualAt);
      const riseH=preMixRiseH(+nextStep.time,+nextStep.bellPeakTime,feedBefore(+nextStep.time)?+feedBefore(+nextStep.time)!.time:null);
      if(+nextStep.time>actualAt&&mixNearPeak(mixAt,+kept.bellPeakTime!,riseH))return result(swap(new Map([[nextStep,kept]])),baseMoved(),0);
      // 2 · the pre-mix feed alone moves into free time so the planned mix meets its peak, nearest first.
      if(!after.slice(1).some(e=>e.kind!=='pre_mix')){
        const span=Math.max(Math.abs(shiftMs),3*hour);
        for(let step=quarter;step<=span;step+=quarter)for(const sign of [1,-1]){
          const at=+nextStep.time+sign*step;
          if(at<=actualAt+hour||at<=now||at>=mixAt-hour||busy(at))continue;
          const moved=withTime(nextStep,at,actualAt);
          if(!mixNearPeak(mixAt,+moved.bellPeakTime!,riseH))continue;
          const m=baseMoved();m.set(+nextStep.time,at);
          return result(swap(new Map([[nextStep,moved]])),m,0);
        }
      }
    }else if(fed.kind==='pre_mix'&&fedOut?.bellPeakTime&&fedEvent.bellPeakTime&&!after.length){
      const previous=feedBefore(plannedAt);
      if(mixNearPeak(mixAt,+fedOut.bellPeakTime,preMixRiseH(plannedAt,+fedEvent.bellPeakTime,previous?+previous.time:null)))return result(swap(new Map()),baseMoved(),0);
    }else if(nextStep&&nextStep.kind==='intermediate_refresh'&&fedEvent.bellPeakTime&&+nextStep.time>=+fedEvent.bellPeakTime+shiftMs-2*hour){
      // An intermediate refresh still fed near the moved peak keeps its time and everything after it.
      return result(swap(new Map()),baseMoved(),0);
    }
  }
  // 3 · the chain follows the feed's own shift.
  const moved=baseMoved();
  let chainOpen=true;
  const replacements=new Map<T,T>();
  for(const event of sorted){
    if(event===fedEvent||+event.time<=plannedAt||!chainOpen||!shiftMs||event.kind==='last_fed'||event.kind==='known_peak')continue;
    let at=+event.time+shiftMs;
    if(event.kind==='fridge_in'&&+event.time<mixAt){
      chainOpen=false;
      // At the peak, within the solver's hold band: the nearest free quarter when the peak falls in a busy period.
      if(busy(at))for(let step=quarter;step<=2*hour;step+=quarter){const free=[at-step,at+step].find(t=>t>now&&!busy(t));if(free!==undefined){at=free;break;}}
    }
    moved.set(+event.time,at);
    const previous=feedBefore(+event.time);
    replacements.set(event,withTime(event,at,!previous?null:previous===fedEvent?actualAt:moved.get(+previous.time)??+previous.time));
  }
  const mixShiftMs=chainOpen?shiftMs:0;
  const next=swap(replacements);
  const fit=mixShiftMs&&options.mixFits?options.mixFits(mixAt+mixShiftMs):'free';
  const starterBusy=[...replacements.values()].some(e=>[...FEEDS,'fridge_in','fridge_out'].includes(e.kind)&&busy(+e.time));
  // The mix follows only an unbroken chain of rises from this feed.
  return {events:next,moved,mixShiftMs,fits:fit!==false,busy:fit==='busy'||starterBusy};
}

/** Mixing is one confirmed action, including for sourdough and a made preferment. */
export interface MixExecution {actualAt:number;recordedAt:number;recipe:RecipeResult;
 /** The baker gave this time; a tap ("Step done", "Yes, at …") is the plan's time and shows none (18 Nov 2026 retention round 4). */
 stated?:boolean}
export function normalizeMixExecution(value:unknown):MixExecution|undefined {
 if(!value||typeof value!=='object')return undefined;
 const v=value as MixExecution;
 return Number.isFinite(v.actualAt)&&Number.isFinite(v.recordedAt)&&v.actualAt<=v.recordedAt&&v.recipe
  &&['flour','water','salt','totalDough'].every(key=>Number.isFinite(v.recipe[key as keyof RecipeResult]))?v:undefined;
}
