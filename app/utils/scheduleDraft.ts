import {buildSchedule,hasCoherentScheduleShape,withLongerPreheat,type AvailabilityBlock,type PlanLadder,type PlanShape,type ScheduleResult} from '../utils';
import type {MixerType} from '../data';
import {planActions,findAvailabilityConflicts,type AvailabilityAction} from './scheduleAvailability';
export interface ScheduleDraftInput {
  isSourdough?: boolean;
  start:Date; bake:Date; blocks:AvailabilityBlock[]; kitchenTemp:number; preheatMin:number;
  mixerType:MixerType; styleKey:string; numItems?:number; mixingBatches?:number; from:Date|null; to:Date|null;
  completedMixAt?:number;
  /** Levain bulk multiplier for a baker-chosen starter % (starterBulkFactor). */
  starterFactor?:number;
  /** The previous plan's fridge-exit lead in minutes (Bake again), or an entered yeast's fit (buildSchedule exitLeadMin, PlanShape). */
  exitLeadMin?:PlanShape;
  /** One-trip ladder scope (buildSchedule planLadder): 'all' for a Simple bake, 'off' for a bake kept as made. */
  planLadder?:PlanLadder;
  /** Minutes of preheat the baker added on the plan: the Preheat step alone moves (withLongerPreheat). */
  preheatExtraMin?:number;
  extraActions?:AvailabilityAction[]; methodValid:boolean; now?:number;
}
/** Read-only preview using the production schedule builder and action-duration checks. */
export function assessScheduleDraft(input:ScheduleDraftInput):{schedule:ScheduleResult|null; valid:boolean; reason:'date'|'range'|'method'|'busy'|'timing'|null; conflict?:AvailabilityAction} {
  const {start,bake,from,to,extraActions=[],now=Date.now()}=input;
  if(![+start,+bake].every(Number.isFinite)||(input.completedMixAt===undefined&&+start<=now)||+bake<=+start)return {schedule:null,valid:false,reason:'date'};
  const schedule=withLongerPreheat(buildSchedule(start,bake,input.blocks,input.kitchenTemp,input.preheatMin,input.mixerType,input.styleKey,input.numItems,input.mixingBatches,input.isSourdough,input.starterFactor??1,input.exitLeadMin,input.planLadder),bake,input.preheatExtraMin??0,input.blocks);
  // The builder historically rounds bake anchors. Never approve a candidate
  // whose rendered agenda silently differs from the requested fixed time.
  if(+schedule.bakeStart!==+bake)return {schedule,valid:false,reason:'timing'};
  if(!hasCoherentScheduleShape(schedule,start)||extraActions.some(action=>!Number.isFinite(+action.at)||+action.at>+start||(action.end!==undefined&&+action.end>+start)))return {schedule,valid:false,reason:'timing'};
  if(!input.methodValid)return {schedule,valid:false,reason:'method'};
  if(!from||!to||+from>=+to||+start<+from||+start>+to||(schedule.batchMixWindows?.some(batch=>+batch.start>+to)??false))return {schedule,valid:false,reason:'range'};
  const actions=planActions(schedule.availabilityActions??[],extraActions,input.completedMixAt);
  const conflict=findAvailabilityConflicts(actions,input.blocks,now)[0]?.action;
  if(conflict)return {schedule,valid:false,reason:'busy',conflict};
  if(schedule.preparationInvalid||schedule.bulkConflict||schedule.coldExitConflict||(input.completedMixAt===undefined&&actions.some(a=>+a.at<now)))return {schedule,valid:false,reason:'timing'};
  return {schedule,valid:true,reason:null};
}
