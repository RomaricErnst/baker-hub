'use client';
import {useState} from 'react';
export default function StarterFeedStatus({fr,plannedAt,onFed,onNotYet}:{fr:boolean;plannedAt:number;onFed:(at:number)=>void;onNotYet:()=>void}) {
 const [editing,setEditing]=useState(false),[time,setTime]=useState('');
 const actual=+new Date(time),valid=!!time&&Number.isFinite(actual)&&actual<=Date.now();
 const label=new Date(plannedAt).toLocaleString(fr?'fr-FR':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});
 return <section className="bh-start-status" aria-label={fr?'Rafraîchi du levain':'Starter feeding'}>
  <p><strong>{fr?'Avez-vous rafraîchi le levain ?':'Have you fed the starter?'}</strong></p>
  <div className="bh-start-actions"><button type="button" className="bh-start-primary" onClick={()=>onFed(plannedAt)}>{fr?'Oui, le':'Yes, at'} {label}</button><button type="button" onClick={onNotYet}>{fr?'Pas encore · Actualiser le plan':'Not yet · Update plan'}</button></div>
  <button type="button" className="bh-start-link" onClick={()=>setEditing(!editing)}>{fr?'À une autre heure ?':'Different time?'}</button>
  {editing&&<div className="bh-start-actions"><label>{fr?'Heure du rafraîchi':'Feeding time'}<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label><button type="button" disabled={!valid} onClick={()=>onFed(actual)}>{fr?'Enregistrer':'Set time'}</button></div>}
 </section>;
}
