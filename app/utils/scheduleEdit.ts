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
  /** Explicit user constraints; automatic recommendations are not pins. */
  pins?: TimingPins;
}
export type TimingPins = {mix?: Date; preferment?: Date};
export type EditResult = {
  times: EditTimes; valid: boolean; issue: EditIssue|null;
  schedule: ReturnType<typeof assessScheduleDraft>['schedule'];
  conflict?: string; earliestMix?: Date; availableHours?: number;
};
/** Validate the exact complete candidate, without searching or moving an anchor.
 * Preview, commit and automatic search all use this result. */
export function validateScheduleCandidate(input: EditInput, times: EditTimes = {
  start:input.start, bake:input.bake, prefHours:input.prefHours,
}): EditResult {
  const {hasPreferment,now=Date.now()}=input;
  const {start,bake,prefHours}=times;
  let candidateSchedule: EditResult['schedule']=null;
  const fail=(issue:EditIssue,extra:Partial<EditResult>={}):EditResult=>({times,valid:false,issue,schedule:candidateSchedule,...extra});
  if(![+start,+bake,prefHours].every(Number.isFinite))return fail('date');
  if(!input.supported)return fail('unsupported');
  const pref=new Date(+start-prefHours*HOUR);
  const bounds=input.window(bake);
  const actions=hasPreferment?[{id:'preferment',at:pref},...(input.prefWarmupHours>0?[{id:'preferment-cold-out',at:new Date(+start-input.prefWarmupHours*HOUR)}]:[])]:[];
  // Always rebuild dependent actions, including for a buildable invalid preview.
  const built=assessScheduleDraft({...input,start,bake,...bounds,extraActions:[...actions,...(input.extraActions??[])],methodValid:true,now});
  candidateSchedule=built.schedule;
  if(+start<=now||(hasPreferment&&+pref<now))return fail('past');
  if(hasPreferment&&(prefHours<=0||(input.prefWindow&&(prefHours<input.prefWindow.min||prefHours>input.prefWindow.max))))return fail('preferment');
  if(input.pins?.mix&&+start!==+input.pins.mix)return fail('timing');
  if(hasPreferment&&input.pins?.preferment&&Math.abs(+pref-+input.pins.preferment)>1)return fail('preferment');
  const conflict=findAvailabilityConflicts([...actions,...(input.extraActions??[]),{id:'mix',at:start}],input.blocks,now)[0];
  if(conflict)return fail('busy',{conflict:conflict.action.id});
  if(!input.methodValid(times))return fail('preferment');
  return {times,schedule:built.schedule,valid:built.valid,
    issue:built.reason==='method'?'preferment':built.reason,conflict:built.conflict?.id};
}
function assessEdit(input: EditInput): EditResult {
  if(!['mix','pref','bake'].includes(input.id)||!Number.isFinite(+input.at))return {
    times:{start:input.start,bake:input.bake,prefHours:input.prefHours},schedule:null,valid:false,issue:Number.isFinite(+input.at)?'unsupported':'date',
  };
  const start=input.id==='mix'?input.at:input.id==='pref'?new Date(+input.at+input.prefHours*HOUR):input.start;
  const result=validateScheduleCandidate(input,{start,bake:input.id==='bake'?input.at:input.bake,prefHours:input.prefHours});
  return input.id==='pref'?{...result,earliestMix:start,availableHours:(+input.start-+input.at)/HOUR}:result;
}

export type FixedBakeSearchResult = {candidate:EditResult; found:boolean; searched:number; exhausted:boolean};
/** Bounded supported-window search, not a proof of biological impossibility.
 * Retains baking time and storage/method. Explicit preparation pins are absolute.
 * Quarter-hour candidates are supplemented with exact availability boundaries. */
export function findFixedBakeSchedule(input: EditInput, pins: TimingPins = input.pins??{}): FixedBakeSearchResult {
  const pinned={...input,pins};
  const retained=validateScheduleCandidate(pinned);
  let searched=1;
  const lead=(Math.floor((input.now??Date.now())/(15*60000))+1)*(15*60000);
  const retainedPrep=+input.start-(input.hasPreferment?input.prefHours*HOUR:0);
  if(retained.valid&&(input.hasPreferment?pins.preferment||retainedPrep>=lead:pins.mix||retainedPrep>=lead))return {candidate:retained,found:true,searched,exhausted:false};
  const bounds=input.window(input.bake), now=input.now??Date.now();
  if(!input.supported||!bounds.from||!bounds.to||!Number.isFinite(+bounds.from)||!Number.isFinite(+bounds.to))return {candidate:retained,found:false,searched,exhausted:false};
  const step=15*60000;
  // Automatic recommendations need an actionable future slot. This is a
  // planning margin, not a change to fermentation or manual-edit validation.
  const earliestPreparation=(Math.floor(now/step)+1)*step;
  const low=Math.max(+bounds.from,pins.mix?now+1:earliestPreparation),high=+bounds.to;
  const starts=new Set<number>();
  const add=(at:number)=>{if(Number.isFinite(at)&&at>=low&&at<=high)starts.add(at);};
  if(pins.mix)add(+pins.mix);
  else {
    add(+input.start);add(low);add(high);
    for(let at=Math.ceil(low/step)*step;at<=high;at+=step)add(at);
    // Include boundaries of modeled active durations. Each candidate is rebuilt:
    // these translations only generate possibilities, never declare validity.
    const sample=retained.schedule?.availabilityActions??[];
    for(const block of input.blocks){
      add(+block.to);
      for(const action of sample){
        add(+block.to-(+action.at-+input.start));
        if(action.end)add(+block.from-(+action.end-+input.start));
      }
      if(input.prefWarmupHours>0)add(+block.to+input.prefWarmupHours*HOUR);
    }
  }
  const ordered=[...starts].sort((a,b)=>Math.abs(a-+input.start)-Math.abs(b-+input.start)||a-b);
  for(const startAt of ordered){
    const offsets=new Set<number>();
    const win=input.prefWindow;
    const addOffset=(h:number)=>{if(Number.isFinite(h)&&(!win||(h>=win.min&&h<=win.max)))offsets.add(h);};
    if(!input.hasPreferment)addOffset(input.prefHours);
    else if(pins.preferment)addOffset((startAt-+pins.preferment)/HOUR);
    else {
      addOffset(input.prefHours);
      if(win){
        addOffset(win.min);addOffset(win.max);
        for(let h=Math.ceil(win.min*4)/4;h<=win.max;h+=.25)addOffset(h);
        for(const block of input.blocks)addOffset((startAt-+block.to)/HOUR);
        addOffset((startAt-earliestPreparation)/HOUR);
      }
    }
    for(const prefHours of [...offsets].sort((a,b)=>Math.abs(a-input.prefHours)-Math.abs(b-input.prefHours))){
      const times={start:new Date(startAt),bake:input.bake,prefHours};
      // Cheap rejection before the production builder; no alternative biology.
      if(input.hasPreferment&&(startAt-prefHours*HOUR<(pins.preferment?now:earliestPreparation)||findAvailabilityConflicts([{id:'preferment',at:new Date(startAt-prefHours*HOUR)}],input.blocks,now).length))continue;
      if(!input.methodValid(times))continue;
      const candidate=validateScheduleCandidate(pinned,times);searched++;
      if(candidate.valid)return {candidate,found:true,searched,exhausted:false};
    }
  }
  return {candidate:retained,found:false,searched,exhausted:true};
}

/** Mixing leads the coupled anchors; preferment-only edits keep mixing pinned.
 * Search the existing maturity window when the linked preferment is unavailable.
 * Baking stays pinned unless explicitly edited. */
export function proposeScheduleEdit(input: EditInput): EditResult {
  // The anchor being edited replaces that anchor's old pin; other explicit
  // choices remain absolute constraints. Automatic coupled anchors may move.
  if(input.pins){
    input={...input,pins:{...input.pins,...(input.id==='mix'?{mix:input.at}:input.id==='pref'?{preferment:input.at}:{})}};
    if(input.id==='mix'&&input.hasPreferment&&input.pins?.preferment){
      return assessEdit({...input,prefHours:(+input.at-+input.pins.preferment)/HOUR});
    }
  }
  if(input.id==='bake'){
    // A bake edit is not an explicit replacement of a mixing/preferment pin.
    // Search using those existing constraints rather than recursively treating
    // a solver-generated mix candidate as the user's edited anchor.
    return findFixedBakeSchedule({...input,bake:input.at}).candidate;
  }
  const window=input.prefWindow;
  if(!window||!input.hasPreferment||!['pref','mix'].includes(input.id))return assessEdit(input);
  const evaluate=(offset:number)=>assessEdit({...input,prefHours:offset});
  // Mixing is the primary anchor: its preferment follows by the same delta.
  // Editing preferment alone keeps mixing pinned and changes maturation length.
  const preferred=input.id==='mix'?input.prefHours:(+input.start-+input.at)/HOUR;
  const retained=evaluate(preferred);
  if(input.id==='pref')return retained;
  if(['range','timing','date','unsupported'].includes(retained.issue??'') || (retained.issue==='busy'&&retained.conflict!=='preferment'))return retained;
  if(retained.valid||+input.at<=(input.now??Date.now())||['date','unsupported'].includes(retained.issue??''))return retained;
  const offsets=new Set<number>([window.min,window.max]);
  for(let h=Math.ceil(window.min*4)/4;h<=window.max;h+=.25)offsets.add(h);
  const ordered=[...offsets].sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
  for(const offset of ordered){const candidate=evaluate(offset);if(candidate.valid)return candidate;}
  return retained;
}

/** Alternatives are proposals only. Every candidate is revalidated against the
 * same bounds, method and active-action constraints as Apply. */
export function laterBakeAlternative(input: EditInput): EditResult|null {
  if(!['pref','mix'].includes(input.id)||!input.supported)return null;
  for(let minutes=15;minutes<=48*60;minutes+=15){
    const candidate=proposeScheduleEdit({...input,bake:new Date(+input.bake+minutes*60000)});
    if(candidate.valid)return candidate;
  }
  return null;
}

export type EditSlot={at:number;valid:boolean};
/** The colour scale uses exactly the same validation as the Apply action. */
export function scheduleEditSlots(input:EditInput,id:string,from:number,to:number):EditSlot[]{
  const slots:EditSlot[]=[];
  for(let at=Math.ceil(from/900000)*900000;at<=to;at+=900000){
    slots.push({at,valid:proposeScheduleEdit({...input,id,at:new Date(at)}).valid});
  }
  return slots;
}

