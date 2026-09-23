import {buildSchedule,type AvailabilityBlock,type ScheduleResult} from '../utils';
import type {MixerType} from '../data';
import {findAvailabilityConflicts,type AvailabilityAction} from './scheduleAvailability';
export interface ScheduleDraftInput {
  start:Date; bake:Date; blocks:AvailabilityBlock[]; kitchenTemp:number; preheatMin:number;
  mixerType:MixerType; styleKey:string; numItems?:number; from:Date|null; to:Date|null;
  extraActions?:AvailabilityAction[]; methodValid:boolean; now?:number;
}
/** Read-only preview using the production schedule builder and action-duration checks. */
export function assessScheduleDraft(input:ScheduleDraftInput):{schedule:ScheduleResult|null; valid:boolean; reason:'date'|'range'|'method'|'busy'|'timing'|null; conflict?:AvailabilityAction} {
  const {start,bake,from,to,extraActions=[],now=Date.now()}=input;
  if(![+start,+bake].every(Number.isFinite)||+start<=now||+bake<=+start)return {schedule:null,valid:false,reason:'date'};
  const schedule=buildSchedule(start,bake,input.blocks,input.kitchenTemp,input.preheatMin,input.mixerType,input.styleKey,input.numItems);
  if(!input.methodValid)return {schedule,valid:false,reason:'method'};
  if(!from||!to||+from>=+to||+start<+from||+start>+to)return {schedule,valid:false,reason:'range'};
  const actions=[...(schedule.availabilityActions??[]),...extraActions];
  const conflict=findAvailabilityConflicts(actions,input.blocks,now)[0]?.action;
  if(conflict)return {schedule,valid:false,reason:'busy',conflict};
  if(schedule.preparationInvalid||schedule.bulkConflict||schedule.coldExitConflict||actions.some(a=>+a.at<now))return {schedule,valid:false,reason:'timing'};
  return {schedule,valid:true,reason:null};
}
