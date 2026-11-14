'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import type {AvailabilityBlock} from '../utils';
import {formatPlanClock,formatLongDay} from '../utils/units';
import ScheduleClockInput from './ScheduleClockInput';
import type {EditSlot} from '../utils/scheduleEdit';
export type KeyTimingAnchor={id:string;name:string;at:number;from:number;to:number;editable:boolean;valid?:boolean;summary?:ReactNode;detail?:ReactNode;note?:ReactNode;control?:ReactNode;locked?:boolean;dayOnly?:boolean};
const STEP=900000;
type SlotWindow={from:number;to:number};
export function compatibleWindows(slots:EditSlot[]):SlotWindow[]{
 const windows:SlotWindow[]=[];
 for(const slot of slots){
  if(!slot.valid)continue;
  const last=windows[windows.length-1];
  if(last&&slot.at-last.to===STEP)last.to=slot.at;
  else windows.push({from:slot.at,to:slot.at});
 }
 return windows;
}
export function TimingWindows({slots,at,isFr,onSelect}:{slots:EditSlot[];at:number;isFr:boolean;onSelect:(at:number)=>void}){
 const days=new Map<string,EditSlot[]>();
 for(const slot of slots){const d=new Date(slot.at),key=[d.getFullYear(),d.getMonth(),d.getDate()].join('-');days.set(key,[...(days.get(key)??[]),slot]);}
 const hm=(value:number)=>formatPlanClock(new Date(value),isFr?'fr':'en');
 return <div className="bh-window-days">
  {[...days.entries()].map(([key,points])=>{
   const ranges=compatibleWindows(points);
   if(!ranges.length)return null;
   const choose=(range:SlotWindow)=>onSelect(points.filter(p=>p.valid&&p.at>=range.from&&p.at<=range.to).reduce((best,p)=>Math.abs(p.at-at)<Math.abs(best.at-at)?p:best).at);
   return <div className="bh-window-day" key={key}>
    <div className="bh-window-day-label">{new Date(points[0].at).toLocaleDateString(isFr?'fr-FR':'en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>
    <div className="bh-window-options">{ranges.map(range=><button type="button" key={range.from} aria-pressed={at>=range.from&&at<=range.to} onClick={()=>choose(range)}>{hm(range.from)}{range.to!==range.from?'–'+hm(range.to):''}</button>)}</div>
   </div>;
  })}
 </div>;
}

function TimingRow({anchor,isFr,onChange,check,cacheKey,open,onToggle}:{anchor:KeyTimingAnchor;isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;open:boolean;onToggle:()=>void}){
 const [result,setResult]=useState<{key:string;slots:EditSlot[]}|null>(null);
 const checkRef=useRef(check);checkRef.current=check;
 const editorId=useId();
 const {id,at,from,to,editable}=anchor;
 const canEdit=editable&&to>from;
 const queryKey=JSON.stringify([id,from,to,editable,cacheKey]);
 const slots=result?.key===queryKey?result.slots:[];
 const checking=canEdit&&result?.key!==queryKey;
 useEffect(()=>{
  if(!canEdit||!open||result?.key===queryKey)return;
  const checkCandidate=checkRef.current;
  let cancelled=false,timer:ReturnType<typeof setTimeout>;
  let point=Math.ceil(from/STEP)*STEP;
  const next:EditSlot[]=[];
  const batch=()=>{
   if(cancelled)return;
   next.push({at:point,valid:checkCandidate(id,point)});point+=STEP;
   if(cancelled)return;
   if(point<=to)timer=setTimeout(batch,0);else setResult({key:queryKey,slots:next});
  };
  timer=setTimeout(batch,120);return()=>{cancelled=true;clearTimeout(timer);};
 },[id,from,to,canEdit,queryKey,open,result?.key]);
 const fmt=(value:number)=>`${new Date(value).toLocaleDateString(isFr?'fr-FR':'en-GB',{weekday:'short'})} ${formatPlanClock(new Date(value),isFr?'fr':'en')}`;
 const clock=formatPlanClock(new Date(at),isFr?'fr':'en');
 const windows=compatibleWindows(slots);
 const nearest=slots.filter(s=>s.valid).reduce<EditSlot|undefined>((best,s)=>!best||Math.abs(s.at-at)<Math.abs(best.at-at)?s:best,undefined);
 const date=new Date(at),local=new Date(at-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 return <li data-key-timing={id} data-at={at} data-selected={open||undefined} data-candidate-valid={anchor.valid===true?'true':'false'} className="bh-key-timing">
  <span className="bh-timeline-node" aria-hidden="true"/>
  <div className="bh-key-content">
   <div className="bh-key-heading"><h3 className="bh-section-title">{anchor.name} {open&&anchor.valid===true&&<span className="bh-key-valid-selection" role="img" aria-label={isFr?'Compatible avec le planning estimé':'Compatible with the estimated schedule'}>✓</span>}</h3>
    {open&&<button type="button" className="bh-key-modify" aria-label={(isFr?'Fermer ':'Close ')+anchor.name} aria-expanded={open} aria-controls={editorId} onClick={onToggle}>{isFr?'Fermer':'Close'}</button>}
   </div>
   {open&&canEdit?<label className="bh-key-exact"><span className="bh-visually-hidden">{isFr?'Date et heure de ':'Date and time for '}{anchor.name}</span><ScheduleClockInput isFr={isFr} type="datetime-local" step={900} value={local} onChange={e=>{const next=+new Date(e.target.value);if(Number.isFinite(next))onChange(id,next);}}/></label>:canEdit?<button type="button" className="bh-key-time" aria-label={`${isFr?'Modifier':'Edit'} ${anchor.name}, ${fmt(at)}`} aria-expanded={false} aria-controls={editorId} onClick={onToggle}>{clock}{anchor.valid===true&&<span className="bh-key-valid-selection" role="img" aria-label={isFr?'Compatible avec le planning estimé':'Compatible with the estimated schedule'}>✓</span>}<span className="bh-time-edit" aria-hidden="true">{isFr?'Modifier':'Edit'}</span></button>:!anchor.dayOnly?<strong className="bh-key-fixed">{clock}</strong>:null}
   {anchor.summary&&<div className="bh-key-detail">{anchor.summary}</div>}
   {anchor.locked&&<span className="bh-kept-time">{isFr?'Heure conservée':'Time kept'}</span>}
   {open&&canEdit&&<div id={editorId} className="bh-key-editor">
    <div className="bh-time-steps"><button type="button" aria-label="- 30 min" disabled={at-2*STEP<from} onClick={()=>onChange(id,at-2*STEP)}>− 30 min</button><button type="button" aria-label="+ 30 min" disabled={at+2*STEP>to} onClick={()=>onChange(id,at+2*STEP)}>+ 30 min</button></div>
    <div className="bh-key-window" data-has-windows={windows.length>0} aria-busy={checking}>{checking?(isFr?'Vérification des créneaux…':'Checking available slots…'):windows.length>0?<><span>{isFr?'Horaires possibles':'Available times'}</span><TimingWindows slots={slots} at={at} isFr={isFr} onSelect={value=>onChange(id,value)}/></>:(anchor.valid?(isFr?'Horaire actuel compatible.':'Current time is compatible.'):(isFr?'Aucun créneau compatible avec ces contraintes.':'No compatible window with these constraints.'))}</div>
    {anchor.control}
    {anchor.detail&&<div className="bh-key-detail">{anchor.detail}</div>}
   </div>}
   {!canEdit&&anchor.detail&&<div className="bh-key-detail">{anchor.detail}</div>}
   {anchor.note&&<div className="bh-key-note" aria-live="polite">{anchor.note}</div>}
   {open&&anchor.note&&typeof anchor.note==='string'&&!checking&&nearest&&<button type="button" className="bh-back-action" onClick={()=>onChange(id,nearest.at)}>{isFr?'Utiliser ':'Use '}{fmt(nearest.at)}</button>}
  </div>
 </li>;
}
export default function ScheduleKeyTimings({conflictRows,anchors,blocks,isFr,onChange,check,cacheKey,hasDraft,children,header,onCancel,onApply,canApply,onOpenChange,notice,ovenAt,personalized,adjustment,focusId,inline=false,applyLabel,onClose}:{focusId?:string;inline?:boolean;applyLabel?:string;onClose?:()=>void;conflictRows?:{id:string;at:number;name:string;cover:()=>void}[];header?:ReactNode;notice?:ReactNode;adjustment?:ReactNode;onApply:()=>void;canApply:boolean;onOpenChange:(open:boolean)=>void;ovenAt:number;personalized:boolean;onCancel:()=>void;onInteractionChange:(value:boolean)=>void;anchors:KeyTimingAnchor[];blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;hasDraft?:boolean;children?:ReactNode}){
 const [selectedId,setSelectedId]=useState<string|null>(focusId??null);
 const open=selectedId!==null;
 // Inline, closing the one editor closes the panel: reported on the baker's action, never from
 // an effect (a remount or a development double-run must not close it).
 const select=(id:string|null)=>{setSelectedId(id);if(inline&&id===null)onClose?.();};
 useEffect(()=>{onOpenChange(open);return()=>onOpenChange(false);},[open,onOpenChange]);
 const gaps=anchors.filter(anchor=>!anchor.valid);
 const valid=gaps.length===0&&!conflictRows?.length;
 const blocked=conflictRows??[];
 const gapTitle=blocked.length
   ? (isFr ? `${blocked.length} ${blocked.length===1?'étape pendant une indisponibilité':'étapes pendant vos indisponibilités'}` : `${blocked.length} ${blocked.length===1?'step falls':'steps fall'} during your unavailable hours`)
   : (isFr ? 'Le planning nécessite un autre créneau' : 'The plan needs another available time');
 const day=(at:number)=>formatLongDay(new Date(at),isFr?'fr':'en');
 // Inline (on the Recipe's plan) the editor shows only the step being moved.
 const events=inline?anchors.filter(anchor=>anchor.id===focusId):[...anchors,{id:'oven',name:isFr?'Enfournement':'Bake',at:ovenAt,from:ovenAt,to:ovenAt,editable:false,valid:true}].sort((a,b)=>a.at-b.at);
 return <section data-open={open||undefined} aria-label={isFr?'Vos moments clés':'Your key times'} id="schedule-anchor-panel" tabIndex={-1}>
  {!inline&&<div className="bh-plan-heading"><span className="bh-plan-state" data-valid={valid} role="status">{!valid?gapTitle:hasDraft?(isFr?'Modifications à appliquer':'Changes to apply'):personalized?(isFr?'Planning personnalisé':'Your adjusted plan'):(isFr?'Planning recommandé':'Recommended plan')}</span>{header}</div>}
  {notice}
  {!inline&&blocked.length>0&&<ul data-availability-conflicts>{blocked.map(anchor=><li key={anchor.id+anchor.at} data-conflict-action={anchor.id} data-conflict-at={anchor.at}>{anchor.name} · {formatPlanClock(new Date(anchor.at),isFr?'fr':'en')} <button type="button" className="bh-back-action" onClick={anchor.cover}>{isFr?'Je peux assurer cette étape':'I can cover this step'}</button></li>)}</ul>}
  <div className="bh-linked-editor">
   <ol className={inline?'bh-schedule-timeline bh-timeline-inline':'bh-schedule-timeline'}>{events.map((anchor,index)=><TimelineEvent key={anchor.id} heading={inline?null:index===0||day(events[index-1].at)!==day(anchor.at)?day(anchor.at):null}><TimingRow {...{anchor,isFr,onChange,check,cacheKey}} open={selectedId===anchor.id} onToggle={()=>select(selectedId===anchor.id?null:anchor.id)}/></TimelineEvent>)}</ol>
   {open&&!hasDraft&&!inline&&<div className="bh-editor-exit"><button type="button" className="bh-apply-plan" onClick={()=>select(null)}>{isFr?'Terminé':'Done'}</button></div>}
   {hasDraft&&<div className="bh-linked-actions"><div className="bh-linked-feedback" role="status">{adjustment}</div><button type="button" className="bh-apply-plan" disabled={!canApply} onClick={()=>{onApply();select(null);}}>{applyLabel??(isFr?'Appliquer':'Apply')}</button><button type="button" className="bh-back-action" onClick={()=>{onCancel();select(null);}}>{isFr?'Annuler':'Cancel'}</button></div>}
  </div>
  {!inline&&children}
 </section>;
}
function TimelineEvent({heading,children}:{heading:string|null;children:ReactNode}){
 return <>{heading&&<li className="bh-timeline-day">{heading}</li>}{children}</>;
}
