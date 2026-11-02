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

export function isTimeBlocked(time: Date | number, blocks: AvailabilityPeriod[]): boolean {
  const at = +time;
  return Number.isFinite(at) && blocks.some(b => +b.from < +b.to && +b.from <= at && at < +b.to);
}

export function actionConflicts(action: AvailabilityAction, blocks: AvailabilityPeriod[]): boolean {
  return findAvailabilityConflicts([action], blocks).length > 0;
}

export function isOvernightPreparation(action:AvailabilityAction):boolean {
  if(action.id==='bake')return false;
  const atNight=(stamp:Date)=>stamp.getHours()<7||stamp.getHours()>=23;
  return atNight(action.at)||Boolean(action.end&&atNight(new Date(+action.end-1)));
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
      const hit = hasSpan
        ? Math.max(+action.at, now) < +block.to && +block.from < +action.end!
        : +block.from <= +action.at && +action.at < +block.to;
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
