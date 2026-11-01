import {buildSchedule,type AvailabilityBlock,type ScheduleResult} from '../utils';
import type {MixerType} from '../data';
import {findAvailabilityConflicts,type AvailabilityAction} from './scheduleAvailability';
export interface ScheduleDraftInput {
  isSourdough?: boolean;
  start:Date; bake:Date; blocks:AvailabilityBlock[]; kitchenTemp:number; preheatMin:number;
  mixerType:MixerType; styleKey:string; numItems?:number; mixingBatches?:number; from:Date|null; to:Date|null;
  completedMixAt?:number;
  extraActions?:AvailabilityAction[]; methodValid:boolean; now?:number;
}
/** Read-only preview using the production schedule builder and action-duration checks. */
export function assessScheduleDraft(input:ScheduleDraftInput):{schedule:ScheduleResult|null; valid:boolean; reason:'date'|'range'|'method'|'busy'|'timing'|null; conflict?:AvailabilityAction} {
  const {start,bake,from,to,extraActions=[],now=Date.now()}=input;
  if(![+start,+bake].every(Number.isFinite)||(input.completedMixAt===undefined&&+start<=now)||+bake<=+start)return {schedule:null,valid:false,reason:'date'};
  const schedule=buildSchedule(start,bake,input.blocks,input.kitchenTemp,input.preheatMin,input.mixerType,input.styleKey,input.numItems,input.mixingBatches,input.isSourdough);
  // The builder historically rounds bake anchors. Never approve a candidate
  // whose rendered agenda silently differs from the requested fixed time.
  if(+schedule.bakeStart!==+bake)return {schedule,valid:false,reason:'timing'};
  const chronological=[start,schedule.bulkFermStart,schedule.divideBallTime,schedule.finalProofStart,bake];
  const badOrder=chronological.some((at,index)=>!Number.isFinite(+at)||(index>0&&+at<+chronological[index-1]));
  const coldStages=[[schedule.coldRetard1Start,schedule.coldRetard1End],[schedule.coldRetard2Start,schedule.coldRetard2End]];
  const badCold=coldStages.some(([from,to])=>from&&to&&(+to-+from<3600000||+from<+start||+to>+bake));
  if(badOrder||badCold||(schedule.availabilityActions??[]).some(action=>+action.at>+bake)||extraActions.some(action=>!Number.isFinite(+action.at)||+action.at>+start||(action.end!==undefined&&+action.end>+start)))return {schedule,valid:false,reason:'timing'};
  if(!input.methodValid)return {schedule,valid:false,reason:'method'};
  if(!from||!to||+from>=+to||+start<+from||+start>+to||(schedule.batchMixWindows?.some(batch=>+batch.start>+to)??false))return {schedule,valid:false,reason:'range'};
  const actions=[...(schedule.availabilityActions??[]),...extraActions].filter(a=>input.completedMixAt===undefined||!(a.id==='autolyse'||/^mix(?:-finish)?(?:-batch-\d+)?$/.test(a.id)||a.id==='preferment-cold-out'&&+a.at<=input.completedMixAt));
  const conflict=findAvailabilityConflicts(actions,input.blocks,now)[0]?.action;
  if(conflict)return {schedule,valid:false,reason:'busy',conflict};
  if(schedule.preparationInvalid||schedule.bulkConflict||schedule.coldExitConflict||(input.completedMixAt===undefined&&actions.some(a=>+a.at<now)))return {schedule,valid:false,reason:'timing'};
  return {schedule,valid:true,reason:null};
}
