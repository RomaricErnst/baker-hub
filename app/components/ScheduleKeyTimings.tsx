'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {AvailabilityBlock} from '../utils';
import type {EditSlot} from '../utils/scheduleEdit';
export type KeyTimingAnchor={id:string;name:string;at:number;from:number;to:number;editable:boolean;detail?:ReactNode;note?:ReactNode};
function TimingRow({anchor,blocks,isFr,onChange,check,cacheKey}:{anchor:KeyTimingAnchor;blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string}){
 const [exact,setExact]=useState(false),[slots,setSlots]=useState<EditSlot[]>([]),[checking,setChecking]=useState(false);
 const checkRef=useRef(check);checkRef.current=check;
 const {id,at,from,to,editable}=anchor;
 useEffect(()=>{
  setSlots([]);if(!editable||to<=from)return;setChecking(true);
  const checkCandidate=checkRef.current;
  let cancelled=false,timer:ReturnType<typeof setTimeout>;let at=Math.ceil(from/900000)*900000;const next:EditSlot[]=[];
  // Yield between small batches: starter probes must not block touch scrolling.
  const batch=()=>{if(cancelled)return;for(let i=0;i<4&&at<=to;i++,at+=900000)next.push({at,valid:checkCandidate(id,at)});if(cancelled)return;if(at<=to)timer=setTimeout(batch,0);else{setSlots(next);setChecking(false);}};
  timer=setTimeout(batch,0);return()=>{cancelled=true;clearTimeout(timer);};
 },[id,from,to,editable,cacheKey]);
 const fmt=(value:number)=>new Date(value).toLocaleString(isFr?'fr-FR':'en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
 const pos=(value:number)=>Math.max(0,Math.min(100,(value-from)/(to-from)*100));
 const nearest=slots.filter(s=>s.valid).sort((a,b)=>Math.abs(a.at-at)-Math.abs(b.at-at))[0];
 const date=new Date(at),local=new Date(at-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 return <div data-key-timing={id} className="bh-key-timing">
  {editable&&to>from?<div className="bh-key-axis"><small>{fmt(from)}</small><div className="bh-key-track">
   {slots.filter(s=>s.valid).map(s=><span key={s.at} className="bh-key-valid" style={{top:`${pos(s.at-450000)}%`,height:`${pos(s.at+450000)-pos(s.at-450000)}%`}}/>)}
   {blocks.filter(b=>+b.to>from&&+b.from<to).map((b,i)=><span key={i} className="bh-key-busy" style={{top:`${pos(+b.from)}%`,height:`${pos(+b.to)-pos(+b.from)}%`}}/>)}
   <input type="range" min={from} max={to} step={900000} value={Math.max(from,Math.min(to,at))} aria-label={(isFr?'Ajuster ':'Adjust ')+anchor.name} aria-valuetext={fmt(at)} onChange={e=>onChange(id,+e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();onChange(id,Math.max(from,Math.min(to,at+(e.key==='ArrowDown'?900000:-900000))));}}}/>
  </div><small>{fmt(to)}</small></div>:<div className="bh-key-fixed" aria-hidden="true">•</div>}
  <div className="bh-key-content"><h3 className="bh-section-title">{anchor.name}</h3>
   {editable?<button type="button" className="bh-key-time" aria-expanded={exact} onClick={()=>setExact(!exact)}>{fmt(at)}</button>:<strong>{fmt(at)}</strong>}
   {exact&&<label className="bh-key-exact"><span className="sr-only">{isFr?'Date et heure':'Date and time'}</span><input type="datetime-local" step={900} value={local} onChange={e=>{const next=+new Date(e.target.value);if(Number.isFinite(next))onChange(id,next);}}/></label>}
   {anchor.detail&&<div className="bh-key-detail">{anchor.detail}</div>}
   {checking&&editable&&<small className="bh-key-detail">{isFr?'Vérification des créneaux…':'Checking available slots…'}</small>}
   {anchor.note&&<div className="bh-key-note" aria-live="polite">{anchor.note}</div>}
   {anchor.note&&typeof anchor.note==='string'&&!checking&&nearest&&<button type="button" className="bh-back-action" onClick={()=>onChange(id,nearest.at)}>{isFr?'Essayer ':'Try '}{fmt(nearest.at)}</button>}
  </div>
 </div>;
}
export default function ScheduleKeyTimings({anchors,blocks,isFr,onChange,check,cacheKey,children}:{anchors:KeyTimingAnchor[];blocks:AvailabilityBlock[];isFr:boolean;onChange:(id:string,at:number)=>void;check:(id:string,at:number)=>boolean;cacheKey:string;children?:ReactNode}){
 return <section aria-label={isFr?'Vos moments clés':'Your key times'} id="schedule-anchor-panel">
  {anchors.map(anchor=><TimingRow key={anchor.id} {...{anchor,blocks,isFr,onChange,check,cacheKey}}/>)}
  <p className="bh-key-legend">{isFr?'Vert : compatible · Gris : hors créneau · Hachures : indisponible':'Green: compatible · Grey: outside window · Hatching: unavailable'}</p>
  {children}
 </section>;
}

