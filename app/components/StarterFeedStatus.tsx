'use client';
import {STATUS_ANSWER,STATUS_BUTTON,statusTime} from './BakeStartStatus';
import {useState} from 'react';
export default function StarterFeedStatus({fr,plannedAt,onFed,onNotYet}:{fr:boolean;plannedAt:number;onFed:(at:number)=>void;onNotYet:()=>void}) {
 const [editing,setEditing]=useState(false),[time,setTime]=useState('');
 const actual=+new Date(time),valid=!!time&&Number.isFinite(actual)&&actual<=Date.now();
 const label=statusTime(plannedAt,Date.now(),fr);
 return <section className="bh-start-status" aria-label={fr?'Rafraîchi du levain':'Starter feeding'}>
  <p><strong>{fr?'Avez-vous rafraîchi le levain ?':'Have you fed the starter?'}</strong></p>
  <div className="bh-start-actions"><button type="button" style={STATUS_ANSWER} onClick={()=>onFed(plannedAt)}>{fr?'Oui, le':'Yes, at'} {label}</button><button type="button" style={STATUS_BUTTON} onClick={onNotYet}>{fr?'Pas encore · Actualiser le plan':'Not yet · Update plan'}</button></div>
  <button type="button" className="bh-start-link" onClick={()=>{
   // The field opens on now, to the minute: a feed done a little late is usually one edit away (18 Nov 2026 retention).
   if(!editing&&!time){const d=new Date(Date.now());d.setSeconds(0,0);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());setTime(d.toISOString().slice(0,16));}
   setEditing(!editing);}}>{fr?'À une autre heure ?':'Different time?'}</button>
  {editing&&<div className="bh-start-actions"><label>{fr?'Heure du rafraîchi':'Feeding time'}<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label><button type="button" style={STATUS_BUTTON} disabled={!valid} onClick={()=>onFed(actual)}>{fr?'Enregistrer':'Set time'}</button></div>}
 </section>;
}
