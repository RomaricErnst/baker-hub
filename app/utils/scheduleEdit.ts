import {assessScheduleDraft, type ScheduleDraftInput} from './scheduleDraft';
import {findAvailabilityConflicts} from './scheduleAvailability';

const HOUR = 3600000;
export type EditTimes = {start: Date; bake: Date; prefHours: number};
export type EditIssue = 'date'|'past'|'preferment'|'range'|'busy'|'timing'|'unsupported';
export interface EditInput extends Omit<ScheduleDraftInput,'from'|'to'|'methodValid'|'extraActions'> {
  id: string; at: Date; prefHours: number; hasPreferment: boolean;
  prefWarmupHours: number; supported: boolean;
  window: (bake: Date) => {from: Date|null; to: Date|null};
  methodValid: (times: EditTimes) => boolean;
  extraActions?: ScheduleDraftInput['extraActions'];
}
export type EditResult = {
  times: EditTimes; valid: boolean; issue: EditIssue|null;
  schedule: ReturnType<typeof assessScheduleDraft>['schedule'];
  conflict?: string; earliestMix?: Date; availableHours?: number;
};
/** A time edit is an intent, not an independent timestamp. Preserve the chosen
 * preferment duration and storage method. Never move the baking target here.
 * Durations come from the current protocol, not a new maturity calibration. */
export function proposeScheduleEdit(input: EditInput): EditResult {
  const {id,at,prefHours,hasPreferment,now=Date.now()}=input;
  const start=id==='mix'?at:id==='pref'?new Date(+at+prefHours*HOUR):input.start;
  const bake=id==='bake'?at:input.bake;
  const times={start,bake,prefHours};
  const fail=(issue:EditIssue,extra:Partial<EditResult>={}):EditResult=>({times,valid:false,issue,schedule:null,...extra});
  if(![+at,+start,+bake,prefHours].every(Number.isFinite))return fail('date');
  if(!input.supported||!['mix','pref','bake'].includes(id))return fail('unsupported');
  const pref=new Date(+start-prefHours*HOUR);
  if(+at<=now||+start<=now||(hasPreferment&&+pref<now))return fail('past');
  if(hasPreferment&&prefHours<=0)return fail('preferment');
  const bounds=input.window(bake);
  const methodActions=hasPreferment?[{id:'preferment',at:pref},...(input.prefWarmupHours>0?[{id:'preferment-cold-out',at:new Date(+start-input.prefWarmupHours*HOUR)}]:[])]:[];
  const actions=[...methodActions,...(input.extraActions??[])];
  const conflict=findAvailabilityConflicts(actions,input.blocks,now)[0];
  if(conflict)return fail('busy',{conflict:conflict.action.id});
  if(!input.methodValid(times))return fail('preferment');
  const result=assessScheduleDraft({...input,start,bake,...bounds,extraActions:actions,methodValid:true,now});
  return {times,schedule:result.schedule,valid:result.valid,
    issue:result.reason==='method'?'preferment':result.reason,
    conflict:result.conflict?.id,
    ...(id==='pref'?{earliestMix:start,availableHours:(+input.start-+at)/HOUR}:{})};
}

/** Alternatives are proposals only. Every candidate is revalidated against the
 * same bounds, method and active-action constraints as Apply. */
export function laterBakeAlternative(input: EditInput): EditResult|null {
  if(input.id!=='pref'||!input.supported)return null;
  for(let minutes=15;minutes<=48*60;minutes+=15){
    const candidate=proposeScheduleEdit({...input,bake:new Date(+input.bake+minutes*60000)});
    if(candidate.valid)return candidate;
  }
  return null;
}
