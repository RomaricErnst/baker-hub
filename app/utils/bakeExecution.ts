import type {RecipeResult} from '../utils';

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
    &&!records.some(record=>record.kind===event.kind&&record.plannedAt===+event.time)).sort((a,b)=>+a.time-+b.time)[0];
}

/** Mixing is one confirmed action, including for sourdough and a made preferment. */
export interface MixExecution {actualAt:number;recordedAt:number;recipe:RecipeResult}
export function normalizeMixExecution(value:unknown):MixExecution|undefined {
 if(!value||typeof value!=='object')return undefined;
 const v=value as MixExecution;
 return Number.isFinite(v.actualAt)&&Number.isFinite(v.recordedAt)&&v.actualAt<=v.recordedAt&&v.recipe
  &&['flour','water','salt','totalDough'].every(key=>Number.isFinite(v.recipe[key as keyof RecipeResult]))?v:undefined;
}
