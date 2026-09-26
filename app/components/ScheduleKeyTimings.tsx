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
function TimingRow({anchor,blocks,isFr,onChange,check,cacheKey,open,onToggle,dragging,onInteractionChange}:{dragging:boolean;onInteractionChange:(value:boolean)=>void;anchor:KeyTimingAnchor;blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;open:boolean;onToggle:()=>void}){
 const [result,setResult]=useState<{key:string;slots:EditSlot[]}|null>(null);
 const checkRef=useRef(check);checkRef.current=check;
 const editorId=useId();
 const {id,at:committedAt,from,to,editable}=anchor;
 const [dragAt,setDragAt]=useState<number|null>(null);
 const activePointer=useRef(false);
 const latest=useRef<number|null>(null);
 const at=dragAt??committedAt;
 const finish=(commit:boolean)=>{
  if(!activePointer.current)return;
  activePointer.current=false;
  const value=latest.current;latest.current=null;
  setDragAt(null);onInteractionChange(false);
  if(commit&&value!==null)onChange(id,value);
 };

 const finishRef=useRef(finish);finishRef.current=finish;
 useEffect(()=>{
  const up=()=>finishRef.current(true),cancel=()=>finishRef.current(false);
  window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
  return()=>{window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);};
 },[]);
 const canEdit=editable&&to>from;
 const queryKey=JSON.stringify([id,from,to,editable,cacheKey]);
 const slots=result?.key===queryKey?result.slots:[];
 const checking=canEdit&&result?.key!==queryKey;
 useEffect(()=>{
  if(!canEdit||dragging)return;
  const checkCandidate=checkRef.current;
  let cancelled=false,timer:ReturnType<typeof setTimeout>;
  let point=Math.ceil(from/STEP)*STEP;
  const next:EditSlot[]=[];
  // Capture this calculation and yield between batches. Old results cannot
  // repaint windows after a new recipe, availability block or draft edit.
  const batch=()=>{
   if(cancelled)return;
   for(let i=0;i<1&&point<=to;i++,point+=STEP)next.push({at:point,valid:checkCandidate(id,point)});
   if(cancelled)return;
   if(point<=to)timer=setTimeout(batch,0);else setResult({key:queryKey,slots:next});
  };
  timer=setTimeout(batch,120);return()=>{cancelled=true;clearTimeout(timer);};
 },[id,from,to,canEdit,queryKey,dragging]);
 const fmt=(value:number)=>new Date(value).toLocaleString(isFr?'fr-FR':'en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
 const pos=(value:number)=>Math.max(0,Math.min(100,(value-from)/(to-from)*100));
 const windows=compatibleWindows(slots);
 const rangeLabel=(window:SlotWindow)=>window.from===window.to?fmt(window.from):`${fmt(window.from)} – ${fmt(window.to)}`;
 const nearest=slots.filter(s=>s.valid).reduce<EditSlot|undefined>((best,s)=>!best||Math.abs(s.at-at)<Math.abs(best.at-at)?s:best,undefined);
 const date=new Date(at),local=new Date(at-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 return <div data-key-timing={id} data-local-drag={dragAt!==null||undefined} data-candidate-valid={!dragging&&anchor.valid===true?'true':'false'} className="bh-key-timing">
  <div className="bh-key-content">
   <div className="bh-key-heading"><h3 className="bh-section-title">{anchor.name}</h3>
    {canEdit&&<button type="button" className="bh-key-modify" aria-label={(isFr?'Modifier ':'Edit ')+anchor.name} aria-expanded={open} aria-controls={editorId} onClick={onToggle}>{open?(isFr?'Fermer':'Close'):(isFr?'Modifier':'Edit')}</button>}
   </div>
   {canEdit?<button type="button" className="bh-key-time" aria-expanded={open} aria-controls={editorId} onClick={onToggle}>{fmt(at)}{!dragging&&anchor.valid===true&&<span className="bh-key-valid-selection" role="img" aria-label={isFr?'Compatible avec le planning estimé':'Compatible with the estimated schedule'}>✓</span>}</button>:<strong className="bh-key-fixed">{fmt(at)}</strong>}
   {(open||anchor.locked)&&anchor.control}
   {anchor.detail&&<div className="bh-key-detail">{anchor.detail}</div>}
   {canEdit&&<div className="bh-key-window" data-has-windows={windows.length>0} aria-busy={checking}>
    {dragging?(isFr?'Relâchez pour recalculer le planning.':'Release to recalculate the plan.'):checking?(isFr?'Vérification des créneaux…':'Checking available slots…'):windows.length>0?<><span aria-hidden="true" className="bh-key-window-dot"/>{isFr?'Ajustable : ':'Adjustable: '}{windows.slice(0,open?windows.length:2).map(rangeLabel).join(' · ')}{!open&&windows.length>2&&` · +${windows.length-2} ${isFr?'créneaux':'windows'}`}</>:(anchor.valid?(isFr?'Horaire actuel compatible.':'Current time is compatible.'):(isFr?'Le planning doit être corrigé.':'The plan needs a correction.'))}
   </div>}
   {anchor.note&&<div className="bh-key-note" aria-live="polite">{anchor.note}</div>}
   {anchor.note&&typeof anchor.note==='string'&&!checking&&nearest&&<button type="button" className="bh-back-action" onClick={()=>onChange(id,nearest.at)}>{isFr?'Utiliser ':'Use '}{fmt(nearest.at)}</button>}
   {open&&canEdit&&<div id={editorId} className="bh-key-editor">
    <div className="bh-key-axis">
     <div className="bh-key-track">
      {/* Bands connect adjacent validated 15-minute choices. A lone valid
          boundary stays a point; never expand it into unavailable minutes. */}
      {windows.map(window=><span key={window.from} className="bh-key-valid" style={{left:`${pos(window.from)}%`,width:`${pos(window.to)-pos(window.from)}%`,minWidth:window.from===window.to?3:undefined}}/>)}
      {blocks.filter(b=>+b.to>from&&+b.from<to).map((b,i)=><span key={i} className="bh-key-busy" style={{left:`${pos(+b.from)}%`,width:`${pos(+b.to)-pos(+b.from)}%`}}/>)}
      <input type="range" min={from} max={to} step={STEP} value={Math.max(from,Math.min(to,at))} aria-orientation="horizontal" aria-label={(isFr?'Ajuster ':'Adjust ')+anchor.name} aria-valuetext={fmt(at)} onPointerDown={()=>{activePointer.current=true;latest.current=committedAt;setDragAt(committedAt);onInteractionChange(true);}}
       onPointerUp={()=>finish(true)} onPointerCancel={()=>finish(false)}
       onChange={e=>{const value=+e.target.value;if(activePointer.current){latest.current=value;setDragAt(value);}else onChange(id,value);}} />
     </div>
     <div className="bh-key-axis-labels"><small>{fmt(from)}</small><small>{fmt(to)}</small></div>
    </div>
    
    <label className="bh-key-exact"><span>{isFr?'Date et heure':'Date and time'}</span><ScheduleClockInput isFr={isFr} type="datetime-local" step={900} value={local} onChange={e=>{const next=+new Date(e.target.value);if(Number.isFinite(next))onChange(id,next);}}/></label>
   </div>}
  </div>
 </div>;
}
export default function ScheduleKeyTimings({anchors,blocks,isFr,onChange,check,cacheKey,hasDraft,children,header,onInteractionChange,onCancel,onApply,canApply,onOpenChange,notice,ovenAt,personalized,adjustment}:{header?:ReactNode;notice?:ReactNode;adjustment?:ReactNode;onApply:()=>void;canApply:boolean;onOpenChange:(open:boolean)=>void;ovenAt:number;personalized:boolean;onCancel:()=>void;onInteractionChange:(value:boolean)=>void;anchors:KeyTimingAnchor[];blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;hasDraft?:boolean;children?:ReactNode}){
 const [dragging,setDragging]=useState(false);
 const [open,setOpen]=useState(false);
 useEffect(()=>{onOpenChange(open);return()=>onOpenChange(false);},[open,onOpenChange]);
 useEffect(()=>{if(!hasDraft)setOpen(false);},[hasDraft]);
 const interaction=(value:boolean)=>{setDragging(value);onInteractionChange(value);};
 const toggle=()=>{if(dragging)return;if(open)onCancel();setOpen(!open);};
 const valid=anchors.every(anchor=>anchor.valid);
 const fmt=(at:number)=>new Date(at).toLocaleString(isFr?'fr-FR':'en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
 return <section data-open={open||undefined} data-dragging={dragging||undefined} aria-label={isFr?'Vos moments clés':'Your key times'} id="schedule-anchor-panel">
  <div className="bh-plan-heading">
   <span className="bh-plan-state" data-valid={valid} role="status">{dragging?(isFr?'Ajustement en cours':'Adjusting'):!valid?(isFr?'À corriger':'Needs attention'):hasDraft?(isFr?'Modifications à appliquer':'Changes to apply'):personalized?(isFr?'Planning personnalisé':'Your adjusted plan'):(isFr?'Planning recommandé':'Recommended plan')}</span>
   {header}
  </div>
  {notice}
  <div className="bh-linked-editor">
   {open&&<div className="bh-linked-summary">
    <div className="bh-linked-title"><strong>{isFr?'Ajuster le planning':'Adjust your plan'}</strong><button type="button" className="bh-back-action" onClick={toggle}>{isFr?'Fermer':'Close'}</button></div>
    <div className="bh-linked-times">{anchors.filter(a=>a.editable).map(a=><span key={a.id}>{a.id==='pref'?(isFr?'Préferment':'Preferment'):a.id==='mix'?(isFr?'Pétrissage':'Mixing'):a.name}<b>{fmt(a.at)}{a.locked?' · 🔒':''}</b></span>)}</div>
    <p>{isFr?'Enfournement conservé : ':'Baking time kept: '}{fmt(ovenAt)}</p>
    {anchors.some(a=>a.id==='pref')&&<p>{isFr?'Le préferment suit le pétrissage, sauf si vous fixez son horaire.':'Preferment follows mixing unless you keep its time fixed.'}</p>}
    <p className="bh-key-legend">{isFr?'Vert : planning compatible · Hachures : indisponible':'Green: compatible plan · Hatching: unavailable'}</p>
   </div>}
   {anchors.map(anchor=><TimingRow key={anchor.id} {...{anchor,blocks,isFr,onChange,check,cacheKey,open,dragging}} onToggle={toggle} onInteractionChange={interaction}/>)}
   {open&&<div className="bh-linked-actions"><div className="bh-linked-feedback" role="status">{dragging?(isFr?'Relâchez pour recalculer les horaires liés.':'Release to update linked times.'):adjustment}</div><button type="button" className="bh-apply-plan" disabled={dragging||!canApply} onClick={()=>{onApply();setOpen(false);}}>{isFr?'Appliquer':'Apply'}</button><button type="button" className="bh-back-action" onClick={()=>{onCancel();setOpen(false);}}>{isFr?'Annuler':'Cancel'}</button></div>}
  </div>
  {children}
 </section>;
}
