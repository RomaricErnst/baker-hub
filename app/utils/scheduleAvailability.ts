/** Availability concerns hands-on actions, never passive fermentation. */
export interface AvailabilityAction {
  id: string;
  at: Date;
  /** Present only for a known active duration; the end is exclusive. */
  end?: Date;
  /** Set by the canonical builder only for the final, standalone dough removal. */
  fridgeRemovalBake?: number;
}
export interface FridgeRemovalArrangement { at: number; bake: number }
export interface CoveredAction { id:string; at:number; end?:number }
export function normalizeCoveredActions(value:unknown):CoveredAction[]|undefined {
  if (!Array.isArray(value)) return undefined;
  const entries=value.filter((action):action is CoveredAction=>action && typeof action.id==='string' && action.id.length>0
    && Number.isFinite(action.at) && (action.end===undefined || Number.isFinite(action.end) && action.end>=action.at));
  return entries.length?entries.map(({id,at,end})=>end===undefined?{id,at}:{id,at,end}):undefined;
}
export interface AvailabilityPeriod { coveredActions?:CoveredAction[]; from: Date; to: Date; label?: string; fridgeRemoval?: FridgeRemovalArrangement }
export interface AvailabilityConflict { action: AvailabilityAction; block: AvailabilityPeriod }

/** Saved arrangements are a commitment to one exact action, never general availability. */
export function normalizeFridgeRemoval(value: unknown): FridgeRemovalArrangement | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const {at, bake} = value as Record<string, unknown>;
  if (typeof at !== 'number' || typeof bake !== 'number' || !Number.isFinite(at) || !Number.isFinite(bake)
    || Math.abs(at) > 8.64e15 || Math.abs(bake) > 8.64e15 || at >= bake) return undefined;
  return {at, bake};
}

export function getFinalFridgeRemoval(actions: AvailabilityAction[]): AvailabilityAction | undefined {
  return actions.find(action => action.id === 'cold-out-2' && action.end === undefined
    && Number.isFinite(action.fridgeRemovalBake) && +action.at < action.fridgeRemovalBake!);
}

export function isFridgeRemovalCovered(action: AvailabilityAction, block: AvailabilityPeriod): boolean {
  const arrangement = normalizeFridgeRemoval(block.fridgeRemoval);
  return !!arrangement && getFinalFridgeRemoval([action]) === action
    && arrangement.at === +action.at && arrangement.bake === action.fridgeRemovalBake;
}

/** Owner rule E1 (25 Nov 2026), the one busy-time edge rule. A busy time is when the baker cannot touch the dough;
 * times sit on the quarter-hour grid. QUICK hands-on steps (a few minutes: a fold, into or out of the fridge, the
 * take-out, the preheat switched on, the starter into or out of the fridge) may sit exactly on a busy time's edge, at
 * its start ("before bed") or at its end ("on waking"). LONG hands-on steps (Start Dough, Make Poolish/Biga, a feed with
 * mixing, divide & shape, the bake) must END by its start (a step with a span: its end is exclusive) and may start at
 * its end; a long step known only by its start counts as inside when it starts at the busy time's start. Everything
 * inside stays forbidden. Every checker reads this: conflicts and clash sheets, the night rules (the 22:00–07:00
 * night is a busy time to them), the sourdough solver, assessScheduleDraft, the entry-plan ranking and the night line. */
const QUICK_ACTION = /^(?:folds?$|fold-\d|cold-(?:in|out)(?:-2)?$|preheat$|preferment-cold-(?:in|out)$|pref-(?:in|out)$|starter-(?:cold|fridge)|take-out)/;
export const isQuickAction = (id: string): boolean => QUICK_ACTION.test(id);
/** Does a hands-on step fall in the busy interval [from, to) under rule E1? */
export function busyHit(action: Pick<AvailabilityAction,'id'|'at'|'end'>, from: number, to: number): boolean {
  if (!(from < to)) return false;
  const at = +action.at;
  if (!Number.isFinite(at)) return false;
  const end = action.end != null && Number.isFinite(+action.end) && +action.end > at ? +action.end : undefined;
  if (end !== undefined) return at < to && from < end;
  return isQuickAction(action.id) ? from < at && at < to : from <= at && at < to;
}

/** A moment in busy time. `quick`: the moment is a quick step (rule E1: its start edge is free too); else a long step's
 * start (or the bake), which a busy time starting then holds. */
export function isTimeBlocked(time: Date | number, blocks: AvailabilityPeriod[], quick = false): boolean {
  const at = +time;
  return Number.isFinite(at) && blocks.some(b => busyHit({ id: quick ? 'cold-in' : 'mix', at: new Date(at) }, +b.from, +b.to));
}

export function actionConflicts(action: AvailabilityAction, blocks: AvailabilityPeriod[]): boolean {
  return findAvailabilityConflicts([action], blocks).length > 0;
}

/** The local-clock windows [fromH:00, toH:00) that can hold a step (the one before its day and its day's own), for
 * the night rules: 22:00–07:00 is read as a busy time under rule E1. */
function clockWindows(action:Pick<AvailabilityAction,'at'|'end'>,fromH:number,toH:number):Array<[number,number]> {
  const out:Array<[number,number]>=[];
  const last=action.end!=null&&+action.end>+action.at?new Date(+action.end):action.at;
  for(let d=new Date(action.at.getFullYear(),action.at.getMonth(),action.at.getDate()-1);+d<=+last;d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)){
    const from=new Date(d.getFullYear(),d.getMonth(),d.getDate(),fromH);
    const to=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(toH<=fromH?1:0),toH);
    out.push([+from,+to]);
  }
  return out;
}
/** A step in the local-clock window fromH–toH (rule E1 edges). */
export function inClockWindow(action:Pick<AvailabilityAction,'id'|'at'|'end'>,fromH:number,toH:number):boolean {
  return Number.isFinite(+action.at)&&clockWindows(action,fromH,toH).some(([from,to])=>busyHit(action,from,to));
}
export function isOvernightPreparation(action:AvailabilityAction):boolean {
  if(action.id==='bake')return false;
  return inClockWindow(action,23,7);
}

/** Hands-on steps that fall in the night (22:00–07:00 local, rule E1 edges) and that the baker did not declare free for
 * (round 7 owner rule D4, as utils.ts nightActionIds): free means they entered their own night (a ' night'
 * block) and the step is outside every busy time (rule E1). Used to keep a planner-chosen cool-spot biga (round 8 D1)
 * from adding night steps. */
export function newNightHandsOn(actions:AvailabilityAction[],blocks:AvailabilityPeriod[]):AvailabilityAction[] {
  const ownNight=blocks.some(block=>block.label?.endsWith(' night'));
  const free=(action:AvailabilityAction)=>ownNight&&!blocks.some(block=>busyHit(action,+block.from,+block.to));
  return actions.filter(action=>action.id!=='bake'&&inClockWindow(action,22,7)&&!free(action));
}

/** How heavy a plan's night steps are for an entered amount's ranking (round 13): each step between 23:00 and 06:00
 * (a wake-up) outweighs any number of steps in the 22:00–23:00 and 06:00–07:00 shoulders; `newNightHandsOn` decides
 * which steps count (the preferment's start included when the caller passes it). */
/** Round 17 (findings 5, 6): THE night of an entered amount's plan, its ranking and its line, the same with and
 * without the Nights chip: a hands-on step (never the bake) after 22:00 and before 07:00 local time, or inside the
 * baker's own night (a ' night' block). Edges follow rule E1 (busyHit): a quick step at 22:00 or 07:00 is not one, a
 * long step must end by 22:00 (or by the own night's start). */
export function nightHandsOn(actions:AvailabilityAction[],blocks:AvailabilityPeriod[]):AvailabilityAction[] {
  const nights=blocks.filter(block=>block.label?.endsWith(' night'));
  return actions.filter(action=>action.id!=='bake'&&(inClockWindow(action,22,7)||nights.some(block=>busyHit(action,+block.from,+block.to))));
}
/** A wake-up: a step in 23:00–06:00 (rule E1 edges: a quick step at 23:00 or 06:00 is not one; a long one at 23:00 is). */
export const isDeepNight=(at:Date|AvailabilityAction)=>{
  const action=at instanceof Date?{id:'cold-in',at}:at;
  return inClockWindow(action,23,6);
};
/** The ranking's night weight (owner O2): a step between 23:00 and 06:00 outweighs any number of shoulder steps. */
export function nightScore(actions:AvailabilityAction[],blocks:AvailabilityPeriod[]):number {
  const steps=nightHandsOn(actions,blocks);
  return steps.length+100*steps.filter(action=>isDeepNight(action)).length;
}

export function planActions(dough:AvailabilityAction[],method:AvailabilityAction[],completedMixAt?:number):AvailabilityAction[] {
  const seen=new Set<string>();
  return [...dough,...method].filter(action=>{
    if(completedMixAt!==undefined&&(action.id==='autolyse'||/^mix(?:-finish)?(?:-batch-\d+)?$/.test(action.id)
      ||action.id==='preferment-cold-out'&&+action.at<=completedMixAt))return false;
    const key=action.id+'@'+(+action.at);
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).sort((a,b)=>+a.at-+b.at);
}

export function findAvailabilityConflicts(
  actions: AvailabilityAction[], blocks: AvailabilityPeriod[], now = -Infinity,
): AvailabilityConflict[] {
  const result: AvailabilityConflict[] = [];
  for (const action of actions) {
    if (!Number.isFinite(+action.at)) continue;
    const hasSpan = action.end != null && Number.isFinite(+action.end) && +action.end > +action.at;
    if (hasSpan ? +action.end! <= now : +action.at < now) continue;
    for (const block of blocks) {
      if (!(+block.from < +block.to)) continue;
      if (isFridgeRemovalCovered(action, block)) continue;
      if (block.coveredActions?.some(item=>item.id===action.id&&item.at===+action.at&&item.end===(action.end?+action.end:undefined))) continue;
      // Rule E1 (busyHit): a span overlaps (its end exclusive, the part already past ignored); a quick point step may
      // sit on either edge; a long point step at the start is inside.
      const hit = hasSpan
        ? busyHit({ id: action.id, at: new Date(Math.max(+action.at, now)), end: action.end }, +block.from, +block.to)
        : busyHit(action, +block.from, +block.to);
      if (hit) result.push({ action, block });
    }
  }
  return result;
}

/** Explicit lot identity for shared event lists and conflict diagnostics. */
export function foldActionLabel(id: string, locale: string, mixingBatches = 1): string | null {
  const match = /^fold-(\d+)(?:-batch-(\d+))?$/.exec(id);
  if (!match) return null;
  const fr = locale === 'fr';
  const fold = `${fr ? 'Rabat' : 'Fold'} ${match[1]}`;
  return mixingBatches > 1 ? `${fr ? 'Lot' : 'Batch'} ${match[2] ?? '1'} · ${fold}` : fold;
}


/** Recurring work and sleep count once each, regardless of the bake's horizon. */
export function selectedAvailabilityCount(blocks:readonly {label?:string}[]):number {
  const sleep = blocks.some(block=>block.label?.endsWith(' night'));
  const work = blocks.some(block=>block.label?.startsWith('Work · '));
  return Number(sleep) + Number(work) + blocks.filter(block=>!block.label?.endsWith(' night')&&!block.label?.startsWith('Work · ')).length;
}

type RecurringPreset = { enabled:boolean; from:string; to:string };
type PresetName = 'sleep'|'work';

export function blockClock(day: Date, time: string): Date {
  const value=new Date(day);
  const [hour,minute]=time.split(':').map(Number);
  value.setHours(hour,minute,0,0);
  return value;
}

export function chronologicalBlocks<T extends AvailabilityPeriod>(blocks:T[]):T[] {
  return [...blocks].sort((a,b)=>+a.from-+b.from || +a.to-+b.to || (a.label??'').localeCompare(b.label??''));
}

/** Expand recurring local-clock rules over the same six-day scheduling window
 * for the initial bake, toggles and later-bake searches. The target is a
 * hands-on instant, so a block beginning exactly then must be included. */
export function recurringBlockEntries(kind:PresetName,preset:RecurringPreset,now:Date,target:Date) {
  const entries:Array<{key:string;label:string;blockStart:Date;blockEnd:Date}>=[];
  if(!Number.isFinite(+now)||!Number.isFinite(+target)||+target<+now)return entries;
  const start=new Date(Math.max(+now,+target-6*86400000));
  const cursor=new Date(start);cursor.setHours(0,0,0,0);
  cursor.setDate(cursor.getDate()-1);
  while(cursor<=target){
    const weekday=cursor.getDay();
    if(kind==='sleep'||(weekday>=1&&weekday<=5)){
      const blockStart=blockClock(cursor,preset.from),blockEnd=blockClock(cursor,preset.to);
      if(blockEnd<=blockStart)blockEnd.setDate(blockEnd.getDate()+1);
      if(blockStart<=target&&blockEnd>start){
        // Labels are persisted IDs; UI labels use the baker's locale.
        const label=kind==='sleep'
          ?blockStart.toLocaleDateString('en-US',{weekday:'long'})+' night'
          :'Work · '+blockStart.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
        const key=[cursor.getFullYear(),cursor.getMonth()+1,cursor.getDate()].join('-');
        entries.push({key,label,blockStart,blockEnd});
      }
    }
    cursor.setDate(cursor.getDate()+1);
  }
  return entries;
}

export function profileBlocksForBake(now:Date,target:Date,presets:Record<PresetName,RecurringPreset>) {
  return chronologicalBlocks((['sleep','work'] as const).flatMap(kind=>presets[kind].enabled?
    recurringBlockEntries(kind,presets[kind],now,target).map(entry=>({from:entry.blockStart,to:entry.blockEnd,label:entry.label})):[]));
}

/** The baker's busy times for a later bake (round 9, bug G): the blocks they have, with the recurring nights and
 * work days they use (by label) carried up to that bake from their saved hours. */
export function blocksForLaterBake<T extends AvailabilityPeriod>(blocks:T[],now:Date,bake:Date,presets:Record<PresetName,RecurringPreset>):Array<T|{from:Date;to:Date;label:string}> {
  const sleep=blocks.some(block=>block.label?.endsWith(' night')), work=blocks.some(block=>block.label?.startsWith('Work · '));
  if(!sleep&&!work)return blocks;
  const carried=profileBlocksForBake(now,bake,{sleep:{...presets.sleep,enabled:sleep},work:{...presets.work,enabled:work}});
  return [...blocks,...carried.filter(extra=>!blocks.some(block=>+block.from===+extra.from&&+block.to===+extra.to))];
}
