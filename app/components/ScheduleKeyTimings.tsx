'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import type {AvailabilityBlock} from '../utils';
import type {EditSlot} from '../utils/scheduleEdit';
export type KeyTimingAnchor={id:string;name:string;at:number;from:number;to:number;editable:boolean;valid?:boolean;detail?:ReactNode;note?:ReactNode};
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
function TimingRow({anchor,blocks,isFr,onChange,check,cacheKey,hasDraft}:{anchor:KeyTimingAnchor;blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;hasDraft?:boolean}){
 const [open,setOpen]=useState(false);
 const [result,setResult]=useState<{key:string;slots:EditSlot[]}|null>(null);
 const checkRef=useRef(check);checkRef.current=check;
 const editorId=useId();
 const {id,at,from,to,editable}=anchor;
 const canEdit=editable&&to>from;
 const queryKey=JSON.stringify([id,from,to,editable,cacheKey]);
 const slots=result?.key===queryKey?result.slots:[];
 const checking=canEdit&&result?.key!==queryKey;
 useEffect(()=>{if(!hasDraft)setOpen(false);},[hasDraft]);
 useEffect(()=>{
  if(!canEdit)return;
  const checkCandidate=checkRef.current;
  let cancelled=false,timer:ReturnType<typeof setTimeout>;
  let point=Math.ceil(from/STEP)*STEP;
  const next:EditSlot[]=[];
  // Capture this calculation and yield between batches. Old results cannot
  // repaint windows after a new recipe, availability block or draft edit.
  const batch=()=>{
   if(cancelled)return;
   for(let i=0;i<4&&point<=to;i++,point+=STEP)next.push({at:point,valid:checkCandidate(id,point)});
   if(cancelled)return;
   if(point<=to)timer=setTimeout(batch,0);else setResult({key:queryKey,slots:next});
  };
  timer=setTimeout(batch,0);return()=>{cancelled=true;clearTimeout(timer);};
 },[id,from,to,canEdit,queryKey]);
 const fmt=(value:number)=>new Date(value).toLocaleString(isFr?'fr-FR':'en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
 const pos=(value:number)=>Math.max(0,Math.min(100,(value-from)/(to-from)*100));
 const windows=compatibleWindows(slots);
 const rangeLabel=(window:SlotWindow)=>window.from===window.to?fmt(window.from):`${fmt(window.from)} – ${fmt(window.to)}`;
 const nearest=slots.filter(s=>s.valid).reduce<EditSlot|undefined>((best,s)=>!best||Math.abs(s.at-at)<Math.abs(best.at-at)?s:best,undefined);
 const date=new Date(at),local=new Date(at-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 return <div data-key-timing={id} data-candidate-valid={anchor.valid===true?'true':'false'} className="bh-key-timing">
  <div className="bh-key-content">
   <div className="bh-key-heading"><h3 className="bh-section-title">{anchor.name}</h3>
    {canEdit&&<button type="button" className="bh-key-modify" aria-label={(isFr?'Modifier ':'Edit ')+anchor.name} aria-expanded={open} aria-controls={editorId} onClick={()=>setOpen(value=>!value)}>{open?(isFr?'Fermer':'Close'):(isFr?'Modifier':'Edit')}</button>}
   </div>
   {canEdit?<button type="button" className="bh-key-time" aria-expanded={open} aria-controls={editorId} onClick={()=>setOpen(value=>!value)}>{fmt(at)}{anchor.valid===true&&<span className="bh-key-valid-selection" role="img" aria-label={isFr?'Compatible avec le planning estimé':'Compatible with the estimated schedule'}>✓</span>}</button>:<strong className="bh-key-fixed">{fmt(at)}</strong>}
   {anchor.detail&&<div className="bh-key-detail">{anchor.detail}</div>}
   {canEdit&&<div className="bh-key-window" data-has-windows={windows.length>0} aria-busy={checking}>
    {checking?(isFr?'Vérification des créneaux…':'Checking available slots…'):windows.length>0?<><span aria-hidden="true" className="bh-key-window-dot"/>{isFr?'Ajustable : ':'Adjustable: '}{windows.slice(0,open?windows.length:2).map(rangeLabel).join(' · ')}{!open&&windows.length>2&&` · +${windows.length-2} ${isFr?'créneaux':'windows'}`}</>:(isFr?'Aucun autre horaire compatible trouvé.':'No alternative compatible time found.')}
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
      <input type="range" min={from} max={to} step={STEP} value={Math.max(from,Math.min(to,at))} aria-orientation="horizontal" aria-label={(isFr?'Ajuster ':'Adjust ')+anchor.name} aria-valuetext={fmt(at)} onChange={e=>onChange(id,+e.target.value)} />
     </div>
     <div className="bh-key-axis-labels"><small>{fmt(from)}</small><small>{fmt(to)}</small></div>
    </div>
    <p className="bh-key-legend">{isFr?'Vert : compatible · Hachures : indisponible':'Green: compatible · Hatching: unavailable'}</p>
    <label className="bh-key-exact"><span>{isFr?'Date et heure':'Date and time'}</span><input type="datetime-local" step={900} value={local} onChange={e=>{const next=+new Date(e.target.value);if(Number.isFinite(next))onChange(id,next);}}/></label>
   </div>}
  </div>
 </div>;
}
export default function ScheduleKeyTimings({anchors,blocks,isFr,onChange,check,cacheKey,hasDraft,children}:{anchors:KeyTimingAnchor[];blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;hasDraft?:boolean;children?:ReactNode}){
 return <section aria-label={isFr?'Vos moments clés':'Your key times'} id="schedule-anchor-panel">
  {anchors.map(anchor=><TimingRow key={anchor.id} {...{anchor,blocks,isFr,onChange,check,cacheKey,hasDraft}}/>)}
  {children}
 </section>;
}
