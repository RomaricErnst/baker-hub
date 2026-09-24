import {assessScheduleDraft, type ScheduleDraftInput} from './scheduleDraft';
import {findAvailabilityConflicts} from './scheduleAvailability';

const HOUR = 3600000;
export type EditTimes = {start: Date; bake: Date; prefHours: number};
export type EditIssue = 'date'|'past'|'preferment'|'range'|'busy'|'timing'|'unsupported';
export interface EditInput extends Omit<ScheduleDraftInput,'from'|'to'|'methodValid'|'extraActions'> {
  id: string; at: Date; prefHours: number; hasPreferment: boolean;
  prefWarmupHours: number; supported: boolean;
  prefWindow?: {min: number; max: number};
  window: (bake: Date) => {from: Date|null; to: Date|null};
  methodValid: (times: EditTimes) => boolean;
  extraActions?: ScheduleDraftInput['extraActions'];
}
export type EditResult = {
  times: EditTimes; valid: boolean; issue: EditIssue|null;
  schedule: ReturnType<typeof assessScheduleDraft>['schedule'];
  conflict?: string; earliestMix?: Date; availableHours?: number;
};
/** Validate one candidate with the actual builder and the chosen storage method. */
function assessEdit(input: EditInput): EditResult {
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
  const conflict=findAvailabilityConflicts([...actions,{id:'mix',at:start}],input.blocks,now)[0];
  if(conflict)return fail('busy',{conflict:conflict.action.id});
  if(hasPreferment&&input.prefWindow&&(prefHours<input.prefWindow.min||prefHours>input.prefWindow.max))return fail('preferment');
  if(!input.methodValid(times))return fail('preferment');
  const result=assessScheduleDraft({...input,start,bake,...bounds,extraActions:actions,methodValid:true,now});
  return {times,schedule:result.schedule,valid:result.valid,
    issue:result.reason==='method'?'preferment':result.reason,
    conflict:result.conflict?.id,
    ...(id==='pref'?{earliestMix:start,availableHours:(+input.start-+at)/HOUR}:{})};
}

/** Keep unaffected anchors where possible. Search the existing method's maturity
 * window, never a fixed recommended duration. Baking is always pinned. */
export function proposeScheduleEdit(input: EditInput): EditResult {
  if(input.id==='bake'){
    const retained=assessEdit(input);
    if(retained.valid||['past','date','unsupported'].includes(retained.issue??''))return retained;
    const bounds=input.window(input.at);
    if(!bounds.from||!bounds.to)return retained;
    const step=15*60000;
    const starts:number[]=[];
    for(let at=Math.ceil(Math.max(+bounds.from,(input.now??Date.now())+1)/step)*step;at<=+bounds.to;at+=step)starts.push(at);
    starts.sort((a,b)=>Math.abs(a-+input.start)-Math.abs(b-+input.start));
    for(const at of starts){
      const candidate=proposeScheduleEdit({...input,id:'mix',at:new Date(at),bake:input.at});
      if(candidate.valid)return candidate;
    }
    return retained;
  }
  const window=input.prefWindow;
  if(!window||!input.hasPreferment||!['pref','mix'].includes(input.id))return assessEdit(input);
  const pref=input.id==='pref'?+input.at:+input.start-input.prefHours*HOUR;
  const mix=input.id==='mix'?+input.at:+input.start;
  const evaluate=(offset:number)=>assessEdit({...input,prefHours:offset});
  const retained=evaluate((mix-pref)/HOUR);
  if(retained.valid||+input.at<=(input.now??Date.now())||['date','unsupported'].includes(retained.issue??''))return retained;
  const offsets=new Set<number>([window.min,window.max]);
  for(let h=Math.ceil(window.min*4)/4;h<=window.max;h+=.25)offsets.add(h);
  const ordered=[...offsets].sort((a,b)=>Math.abs(a-(mix-pref)/HOUR)-Math.abs(b-(mix-pref)/HOUR));
  for(const offset of ordered){const candidate=evaluate(offset);if(candidate.valid)return candidate;}
  return retained;
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
