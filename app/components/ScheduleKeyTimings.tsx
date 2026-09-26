'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import type {AvailabilityBlock} from '../utils';
import ScheduleClockInput from './ScheduleClockInput';
import type {EditSlot} from '../utils/scheduleEdit';
export type KeyTimingAnchor={id:string;name:string;at:number;from:number;to:number;editable:boolean;valid?:boolean;detail?:ReactNode;note?:ReactNode;control?:ReactNode;locked?:boolean};
const STEP=900000;
type SlotWindow={from:number;to:number};
function compatibleWindows(slots:EditSlot[]):SlotWindow[]{
 const windows:SlotWindow[]=[];
 for(const slot of slots){
  if(!slot.valid)continue;
  const last=windows[windows.length-1];
  if(last&&slot.at-last.to===STEP)last.to=slot.at;
  else windows.push({from:slot.at,to:slot.at});
 }
 return windows;
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
 const fmt=(value:number)=>new Date(value).toLocaleString(isFr?'fr-FR':'en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
 const clock=new Date(at).toLocaleTimeString(isFr?'fr-FR':'en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});
 const windows=compatibleWindows(slots);
 const rangeLabel=(window:SlotWindow)=>window.from===window.to?fmt(window.from):`${fmt(window.from)} – ${fmt(window.to)}`;
 const nearest=slots.filter(s=>s.valid).reduce<EditSlot|undefined>((best,s)=>!best||Math.abs(s.at-at)<Math.abs(best.at-at)?s:best,undefined);
 const date=new Date(at),local=new Date(at-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 return <li data-key-timing={id} data-at={at} data-selected={open||undefined} data-candidate-valid={anchor.valid===true?'true':'false'} className="bh-key-timing">
  <span className="bh-timeline-node" aria-hidden="true"/>
  <div className="bh-key-content">
   <div className="bh-key-heading"><h3 className="bh-section-title">{anchor.name} {open&&anchor.valid===true&&<span className="bh-key-valid-selection" role="img" aria-label={isFr?'Compatible avec le planning estimé':'Compatible with the estimated schedule'}>✓</span>}</h3>
    {open&&<button type="button" className="bh-key-modify" aria-label={(isFr?'Fermer ':'Close ')+anchor.name} aria-expanded={open} aria-controls={editorId} onClick={onToggle}>{isFr?'Fermer':'Close'}</button>}
   </div>
   {open&&canEdit?<label className="bh-key-exact"><span className="bh-visually-hidden">{isFr?'Date et heure de ':'Date and time for '}{anchor.name}</span><ScheduleClockInput isFr={isFr} type="datetime-local" step={900} value={local} onChange={e=>{const next=+new Date(e.target.value);if(Number.isFinite(next))onChange(id,next);}}/></label>:canEdit?<button type="button" className="bh-key-time" aria-label={`${isFr?'Modifier':'Edit'} ${anchor.name}, ${fmt(at)}`} aria-expanded={false} aria-controls={editorId} onClick={onToggle}>{clock}<span className="bh-time-edit" aria-hidden="true">↗</span>{anchor.valid===true&&<span className="bh-key-valid-selection" role="img" aria-label={isFr?'Compatible avec le planning estimé':'Compatible with the estimated schedule'}>✓</span>}</button>:<strong className="bh-key-fixed">{clock}</strong>}
   {anchor.locked&&<span className="bh-kept-time">{isFr?'Heure conservée':'Time kept'}</span>}
   {open&&canEdit&&<div id={editorId} className="bh-key-editor">
    <div className="bh-time-steps"><button type="button" aria-label="- 30 min" disabled={at-2*STEP<from} onClick={()=>onChange(id,at-2*STEP)}>− 30 min</button><button type="button" aria-label="+ 30 min" disabled={at+2*STEP>to} onClick={()=>onChange(id,at+2*STEP)}>+ 30 min</button></div>
    <div className="bh-key-window" data-has-windows={windows.length>0} aria-busy={checking}>{checking?(isFr?'Vérification des créneaux…':'Checking available slots…'):windows.length>0?<><span aria-hidden="true" className="bh-key-window-dot"/>{isFr?'Créneaux compatibles : ':'Compatible windows: '}{windows.map(rangeLabel).join(' · ')}</>:(anchor.valid?(isFr?'Horaire actuel compatible.':'Current time is compatible.'):(isFr?'Aucun créneau compatible avec ces contraintes.':'No compatible window with these constraints.'))}</div>
    {anchor.control}
    {anchor.detail&&<div className="bh-key-detail">{anchor.detail}</div>}
   </div>}
   {!canEdit&&anchor.detail&&<div className="bh-key-detail">{anchor.detail}</div>}
   {anchor.note&&<div className="bh-key-note" aria-live="polite">{anchor.note}</div>}
   {open&&anchor.note&&typeof anchor.note==='string'&&!checking&&nearest&&<button type="button" className="bh-back-action" onClick={()=>onChange(id,nearest.at)}>{isFr?'Utiliser ':'Use '}{fmt(nearest.at)}</button>}
  </div>
 </li>;
}
export default function ScheduleKeyTimings({anchors,isFr,onChange,check,cacheKey,hasDraft,children,header,onCancel,onApply,canApply,onOpenChange,notice,ovenAt,personalized,adjustment}:{header?:ReactNode;notice?:ReactNode;adjustment?:ReactNode;onApply:()=>void;canApply:boolean;onOpenChange:(open:boolean)=>void;ovenAt:number;personalized:boolean;onCancel:()=>void;onInteractionChange:(value:boolean)=>void;anchors:KeyTimingAnchor[];blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;hasDraft?:boolean;children?:ReactNode}){
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const open=selectedId!==null;
 useEffect(()=>{onOpenChange(open);return()=>onOpenChange(false);},[open,onOpenChange]);
 const valid=anchors.every(anchor=>anchor.valid);
 const day=(at:number)=>new Date(at).toLocaleDateString(isFr?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'long'});
 const events=[...anchors,{id:'oven',name:isFr?'Enfournement':'Into the oven',at:ovenAt,from:ovenAt,to:ovenAt,editable:false,valid:true}].sort((a,b)=>a.at-b.at);
 return <section data-open={open||undefined} aria-label={isFr?'Vos moments clés':'Your key times'} id="schedule-anchor-panel">
  <div className="bh-plan-heading"><span className="bh-plan-state" data-valid={valid} role="status">{!valid?(isFr?'À corriger':'Needs attention'):hasDraft?(isFr?'Modifications à appliquer':'Changes to apply'):personalized?(isFr?'Planning personnalisé':'Your adjusted plan'):(isFr?'Planning recommandé':'Recommended plan')}</span>{header}</div>
  {notice}
  <p className="bh-timeline-hint">{isFr?'Touchez une heure pour l’ajuster.':'Tap a time to adjust it.'}</p>
  <div className="bh-linked-editor">
   <ol className="bh-schedule-timeline">{events.map((anchor,index)=><TimelineEvent key={anchor.id} heading={index===0||day(events[index-1].at)!==day(anchor.at)?day(anchor.at):null}><TimingRow {...{anchor,isFr,onChange,check,cacheKey}} open={selectedId===anchor.id} onToggle={()=>setSelectedId(selectedId===anchor.id?null:anchor.id)}/></TimelineEvent>)}</ol>
   {hasDraft&&<div className="bh-linked-actions"><div className="bh-linked-feedback" role="status">{adjustment}</div><button type="button" className="bh-apply-plan" disabled={!canApply} onClick={()=>{onApply();setSelectedId(null);}}>{isFr?'Appliquer':'Apply'}</button><button type="button" className="bh-back-action" onClick={()=>{onCancel();setSelectedId(null);}}>{isFr?'Annuler':'Cancel'}</button></div>}
  </div>
  {children}
 </section>;
}
function TimelineEvent({heading,children}:{heading:string|null;children:ReactNode}){
 return <>{heading&&<li className="bh-timeline-day">{heading}</li>}{children}</>;
}
