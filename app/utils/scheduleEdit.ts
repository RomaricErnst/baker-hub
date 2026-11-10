import {assessScheduleDraft, type ScheduleDraftInput} from './scheduleDraft';
import {findAvailabilityConflicts,isOvernightPreparation,type AvailabilityAction} from './scheduleAvailability';
import {earliestQuarterStart} from './startNotice';

const HOUR = 3600000;
export type EditTimes = {start: Date; bake: Date; prefHours: number};
export type EditIssue = 'date'|'past'|'preferment'|'range'|'busy'|'timing'|'unsupported'|'formula';
export interface EditInput extends Omit<ScheduleDraftInput,'from'|'to'|'methodValid'|'extraActions'> {
  id: string; at: Date; prefHours: number; hasPreferment: boolean;
  prefWarmupHours: number; prefCooldownHours?:number; supported: boolean;
  preferDaytime?: boolean;
  prefWindow?: {min: number; max: number};
  window: (bake: Date) => {from: Date|null; to: Date|null};
  methodValid: (times: EditTimes) => boolean;
  extraActions?: ScheduleDraftInput['extraActions'];
  /** Explicit user constraints; automatic recommendations are not pins. */
  pins?: TimingPins;
  /** Explicit recorded preparation, never inferred from the clock. */
  completedPrefermentAt?: number;
  formulaValid?: (schedule:NonNullable<EditResult['schedule']>,times:EditTimes)=>boolean;
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
  const completed=input.completedPrefermentAt;
  if(completed!==undefined&&(!Number.isFinite(completed)||Math.abs(+pref-completed)>1))return fail('preferment');
  const conditioning=prefermentConditioningAction(input,start);
  if(conditioning&&+conditioning.at<+pref)return fail('preferment');
  const actions=hasPreferment?[...(completed===undefined?[{id:'preferment',at:pref}]:[]),...(conditioning&&input.completedMixAt===undefined?[conditioning]:[])]:[];
  // Always rebuild dependent actions, including for a buildable invalid preview.
  const built=assessScheduleDraft({...input,start,bake,...bounds,extraActions:[...actions,...(input.extraActions??[])],methodValid:true,now});
  candidateSchedule=built.schedule;
  if(input.completedMixAt!==undefined&&+start!==input.completedMixAt)return fail('timing');
  if((input.completedMixAt===undefined&&+start<=now)||(hasPreferment&&completed===undefined&&+pref<now))return fail('past');
  if(hasPreferment&&(prefHours<=0||(input.prefWindow&&(prefHours<input.prefWindow.min||prefHours>input.prefWindow.max))))return fail('preferment');
  if(input.pins?.mix&&+start!==+input.pins.mix)return fail('timing');
  if(hasPreferment&&input.pins?.preferment&&Math.abs(+pref-+input.pins.preferment)>1)return fail('preferment');
  // Use the actual mixing span (and its exact baker acknowledgement).
  // A second, zero-duration event at the same start would discard that choice.
  const conflict=built.conflict ?? findAvailabilityConflicts([...actions,...(input.extraActions??[])],input.blocks,now)[0]?.action;
  if(conflict)return fail('busy',{conflict:conflict.id});
  if(!input.methodValid(times))return fail('preferment');
  if(candidateSchedule&&input.formulaValid&&!input.formulaValid(candidateSchedule,times))return fail('formula');
  // Every portion uses the same preferment, prepared at the original anchor.
  // Later mixer loads must also remain inside its existing maturity window.
  if (hasPreferment && built.schedule?.batchMixWindows?.some(batch => {
    const batchTimes = {...times, start:batch.start, prefHours:prefHours+(+batch.start-+start)/HOUR};
    return (input.prefWindow && batchTimes.prefHours>input.prefWindow.max) || !input.methodValid(batchTimes);
  })) return fail('preferment');
  if(built.valid&&built.schedule&&conditioning?.id==='preferment-cold-in'&&input.completedMixAt===undefined){
    built.schedule.prefermentCooldownHours=input.prefCooldownHours;
    built.schedule.availabilityActions=[...(built.schedule.availabilityActions??[]),conditioning];
  }
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

export type FixedBakeSearchResult = {candidate:EditResult; found:boolean; searched:number; exhausted:boolean; preparationRepaired?:boolean;
  /** Direct dough with no clash-free plan: the complete plan that needs the
   *  baker during the fewest busy moments (often only the fridge exit). It is
   *  never valid by itself; the baker decides whether to cover those steps. */
  leastConflict?:{candidate:EditResult; conflicts:number}};

/** Sleep is a preference for automatic recommendations. Explicit blocks and
 * all fermentation limits are still checked against the canonical plan. */
export function prefermentConditioningAction(input:{prefWarmupHours:number;prefCooldownHours?:number},mix:Date):AvailabilityAction|undefined {
  const hours=input.prefWarmupHours||input.prefCooldownHours;
  if(!hours)return undefined;
  return {id:input.prefWarmupHours?'preferment-cold-out':'preferment-cold-in',at:new Date(+mix-hours*HOUR)};
}
function overnightSteps(input:EditInput, candidate:EditResult):number {
  if(!input.preferDaytime)return 0;
  const {start,prefHours}=candidate.times;
  const actions=[...(candidate.schedule?.availabilityActions??[])];
  if(input.hasPreferment){
    actions.push({id:'preferment',at:new Date(+start-prefHours*HOUR)});
    const conditioning=prefermentConditioningAction(input,start);
    if(conditioning&&!actions.some(action=>action.id===conditioning.id&&+action.at===+conditioning.at))actions.push(conditioning);
  }
  return actions.filter(isOvernightPreparation).length;
}
/** Compare fully validated storage protocols using their existing maturity targets.
 * A target-duration plan takes precedence over retaining yesterday's repair.
 * Refrigeration only breaks otherwise equal ties; it is not a quality guarantee. */
export function recommendPreferment(options: {inFridge:boolean; input:EditInput}[], pins:TimingPins={}, preferences:{preferCold?:boolean;startThisEvening?:boolean}={}) {
  const results=options.map(option=>{
    const input=option.input;
    const target=findFixedBakeSchedule({...input,prefWindow:{min:input.prefHours,max:input.prefHours}},pins);
    let result=target;
    if(!target.found || overnightSteps(input,target.candidate)){
      const flexible=findFixedBakeSchedule(input,pins);
      if(!target.found || (flexible.found && overnightSteps(input,flexible.candidate)<overnightSteps(input,target.candidate)))result=flexible;
    }
    // Offer an actionable evening start when a refrigerated protocol supports
    // it. Preserve explicit pins and validate every downstream intervention.
    const now=input.now??Date.now(), hour=new Date(now).getHours();
    if(preferences.startThisEvening&&option.inFridge&&!pins.preferment&&hour>=18&&hour<23){
      const step=15*60000, first=earliestQuarterStart(now);
      for(let at=first;at<=now+3600000;at+=step){
        if(new Date(at).getDate()!==new Date(now).getDate())break;
        const early=findFixedBakeSchedule(input,{...pins,preferment:new Date(at)});
        if((early.found&&(!result.found||overnightSteps(input,early.candidate)<=overnightSteps(input,result.candidate)))||(early.preparationRepaired&&!result.found)){result=early;break;}
      }
    }
    return {...option,result};
  });
  results.sort((a,b)=>Number(b.result.found)-Number(a.result.found)
    || Number(!!b.result.preparationRepaired)-Number(!!a.result.preparationRepaired)
    || overnightSteps(a.input,a.result.candidate)-overnightSteps(b.input,b.result.candidate)
    || (preferences.preferCold ? Number(b.inFridge)-Number(a.inFridge) : 0)
    || Math.abs(a.result.candidate.times.prefHours-a.input.prefHours)/Math.max(1,a.input.prefHours)-Math.abs(b.result.candidate.times.prefHours-b.input.prefHours)/Math.max(1,b.input.prefHours)
    || Math.abs(+a.result.candidate.times.start-+a.input.start)-Math.abs(+b.result.candidate.times.start-+b.input.start)
    || Number(b.inFridge)-Number(a.inFridge));
  return results[0];
}
/** Bounded supported-window search, not a proof of biological impossibility.
 * Retains baking time and storage/method. Explicit preparation pins are absolute.
 * Quarter-hour candidates are supplemented with exact availability boundaries. */
export function findFixedBakeSchedule(input: EditInput, pins: TimingPins = input.pins??{}): FixedBakeSearchResult {
  const pinned={...input,pins};
  const retained=validateScheduleCandidate(pinned);
  let searched=1;
  // Proposed times speak in quarter hours, at least 15 minutes from now; an
  // automatic direct-dough start off that grid (e.g. "now + 30 min") is searched
  // again. A preferment's own start already follows its quarter-hour offsets.
  // A plan already on screen is kept from the next quarter hour on (re-proposing
  // it would only move it by minutes); new candidates start at earliestPreparation.
  const lead=(Math.floor((input.now??Date.now())/(15*60000))+1)*(15*60000);
  const onGrid=(at:number)=>at%(15*60000)===0;
  const retainedPrep=+input.start-(input.hasPreferment?input.prefHours*HOUR:0);
  // Short notice, direct dough: a recommendation never asks the baker to start
  // within the next two hours when a start two hours out still fits the bake
  // (the readiness window's latest start). An explicit mixing time is kept.
  const soonTarget=(()=>{
    if(pins.mix||input.hasPreferment||input.completedMixAt!==undefined||!input.supported)return null;
    const later=Math.ceil(((input.now??Date.now())+2*HOUR)/(15*60000))*(15*60000);
    const latest=input.window(input.bake).to;
    return +input.start<later&&latest&&Number.isFinite(+latest)&&later<=+latest?later:null;
  })();
  const target=soonTarget??+input.start;
  const keepInitial=soonTarget===null&&retained.valid&&(input.hasPreferment?pins.preferment||retainedPrep>=lead:pins.mix||(retainedPrep>=lead&&onGrid(+input.start)));
  let fallback:EditResult|undefined=keepInitial?retained:undefined;
  let bestNightCount=fallback?overnightSteps(input,fallback):Infinity;
  if(bestNightCount===0)return {candidate:retained,found:true,searched,exhausted:false};
  const bounds=input.window(input.bake), now=input.now??Date.now();
  if(!input.supported||!bounds.from||!bounds.to||!Number.isFinite(+bounds.from)||!Number.isFinite(+bounds.to))return {candidate:retained,found:false,searched,exhausted:false};
  const step=15*60000;
  // Automatic recommendations need an actionable future slot. This is a
  // planning margin, not a change to fermentation or manual-edit validation.
  // At least 15 minutes from now on the quarter-hour grid. With the baker's
  // own mixing time, keep the next quarter hour: that plan is theirs to keep.
  const earliestPreparation=pins.mix?(Math.floor(now/step)+1)*step:earliestQuarterStart(now);
  const low=Math.max(+bounds.from,pins.mix?now+1:earliestPreparation),high=+bounds.to;
  const starts=new Set<number>();
  const add=(at:number)=>{if(Number.isFinite(at)&&at>=low&&at<=high)starts.add(at);};
  if(pins.mix)add(+pins.mix);
  else {
    add(+input.start);add(target);add(low);add(high);
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
      const conditioning=input.prefWarmupHours||input.prefCooldownHours;
      if(conditioning)add(+block.to+conditioning*HOUR);
    }
  }
  // Quarter-hour starts first; exact availability edges off the grid only when
  // no quarter hour gives a plan (they are still searched, never dropped).
  const ordered=[...starts].sort((a,b)=>(pins.mix||input.hasPreferment?0:Number(!onGrid(a))-Number(!onGrid(b)))||Math.abs(a-target)-Math.abs(b-target)||a-b);
  let repaired:EditResult|undefined;
  let remainingConflicts=Infinity;
  let leastConflict:EditResult|undefined;
  let leastCount=Infinity;
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
      if(candidate.valid){
        const cost=overnightSteps(input,candidate);
        if(cost===0)return {candidate,found:true,searched,exhausted:false};
        if(cost<bestNightCount){fallback=candidate;bestNightCount=cost;}
        // Later offsets cannot change dough actions. Try another mix once the
        // preference cost for this mix comes entirely from the dough itself.
        if(!input.hasPreferment || cost===overnightSteps({...input,hasPreferment:false},candidate))break;
        continue;
      }
      // Direct dough: remember the complete plan that clashes least, so a
      // bake time that cannot avoid busy times still gets the best plan.
      if(!input.hasPreferment&&candidate.issue==='busy'&&candidate.schedule
        &&!candidate.schedule.preparationInvalid&&!candidate.schedule.bulkConflict){
        const count=findAvailabilityConflicts(candidate.schedule.availabilityActions??[],input.blocks,now).length;
        if(count>0&&count<leastCount){leastConflict=candidate;leastCount=count;}
      }
      // Keep an available preparation even if a later intervention prevents
      // the complete plan. Never turn a partial repair into a valid recipe.
      if(input.hasPreferment&&candidate.issue==='busy'&&candidate.schedule
        &&!candidate.schedule.preparationInvalid&&!candidate.schedule.bulkConflict){
        const conflicts=findAvailabilityConflicts(candidate.schedule.availabilityActions??[],input.blocks,now);
        const upstream=conflicts.some(c=>c.action.id==='mix'||c.action.id==='mix-finish'||c.action.id.startsWith('mix-batch')||c.action.id.startsWith('mix-finish-batch'));
        if(!upstream&&!candidate.conflict?.startsWith('preferment')&&conflicts.length<remainingConflicts){
          repaired=candidate;remainingConflicts=conflicts.length;
          // With a fixed bake/preheat deadline no upstream candidate can be
          // fully valid. Avoid rebuilding thousands of equivalent failures.
          if(!fallback && conflicts.some(c=>c.action.id==='preheat'))return {candidate,found:false,searched,exhausted:true,preparationRepaired:true};
        }
      }
    }
  }
  if(fallback)return {candidate:fallback,found:true,searched,exhausted:false};
  return {candidate:repaired??retained,found:false,searched,exhausted:true,preparationRepaired:!!repaired,
    ...(leastConflict?{leastConflict:{candidate:leastConflict,conflicts:leastCount}}:{})};
}

/** Keep automatic anchors where feasible; move them jointly when necessary.
 * Explicit user pins remain fixed except for the anchor currently being edited.
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
  // First try retaining mixing and changing only maturation length.
  const preferred=input.id==='mix'?input.prefHours:(+input.start-+input.at)/HOUR;
  const retained=evaluate(preferred);
  if(input.id==='pref') {
    if(retained.valid || input.pins?.mix || !Number.isFinite(+input.at) || +input.at < (input.now??Date.now())) return retained;
    // A recommendation is not a manual mixing pin. Search dependent mixing
    // times while holding the requested preparation and baking times fixed.
    const result=findFixedBakeSchedule({...input,start:retained.times.start,prefHours:preferred},
      {...input.pins,preferment:input.at});
    return result.found ? result.candidate : retained;
  }
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

