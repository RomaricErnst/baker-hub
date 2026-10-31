'use client';
import {useState,useEffect} from 'react';
import type {BakeExecution} from '../utils/bakeExecution';
import {preparationStatus} from '../utils/bakeExecution';

export default function BakeStartStatus({fr,method,requestTime=0,plannedAt,now,execution,preparing,onMade,onNotYet,onRecipe,onNext,onUndo}:{
  requestTime?:number;fr:boolean;method:'none'|'poolish'|'biga';plannedAt:number;now:number;execution?:BakeExecution;preparing:boolean;
  onMade:(at:number)=>void;onNotYet:()=>void;onRecipe:()=>void;onNext:()=>void;onUndo:()=>void;
}) {
  const [different,setDifferent]=useState(false),[time,setTime]=useState('');
  useEffect(()=>{if(!requestTime)return;const date=new Date(Math.min(plannedAt,Date.now()));date.setMinutes(date.getMinutes()-date.getTimezoneOffset());setTime(date.toISOString().slice(0,16));setDifferent(true);},[requestTime]);
  const status=preparationStatus(plannedAt,execution,now);
  if(status==='planned'&&!preparing)return null;
  const fmt=(at:number)=>new Date(at).toLocaleString(fr?'fr-FR':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});
  const noun=method==='none'?(fr?'la pâte':'the dough'):method==='biga'?(fr?'la biga':'the biga'):(fr?'le poolish':'the poolish');
  const editTime=(at:number)=>{const date=new Date(at);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());setTime(date.toISOString().slice(0,16));setDifferent(true);};
  const parsed=+new Date(time), valid=!!time&&Number.isFinite(parsed)&&parsed<=now;
  return <section className="bh-start-status" aria-label={fr?'Préparation de la fournée':'Bake preparation'}>
    {execution?<>
      <p><strong>{method==='none'?(fr?'Pétrie':'Mixed'):(fr?'Préparé':'Made')} · {fmt(execution.actualAt)}</strong></p>
      <p>{fr?'Les ingrédients utilisés sont conservés. Seules les étapes restantes peuvent changer.':'Ingredients already used are kept. Only remaining steps can change.'}</p>
      <div className="bh-start-actions">{!preparing&&<button type="button" onClick={onNext}>{fr?'Aller à la préparation →':'Go to preparation →'}</button>}<button type="button" onClick={()=>editTime(execution.actualAt)}>{fr?'Modifier l’heure':'Change time'}</button><button type="button" className="bh-start-link" onClick={onUndo}>{fr?'Annuler la confirmation':'Undo completion'}</button></div>
    </>:<>
      <p><strong>{method==='none'?(status==='unconfirmed'?(fr?'Avez-vous pétri la pâte ?':'Have you mixed the dough?'):(fr?'Pétrir la pâte':'Mix the dough')):status==='unconfirmed'?(fr?`Avez-vous préparé ${noun} ?`:`Have you made ${noun}?`):(fr?`Préparer ${noun}`:`Make ${noun}`)}</strong></p>
      <div className="bh-start-actions">
        {status==='unconfirmed'&&<button type="button" className="bh-start-primary" onClick={()=>onMade(plannedAt)}>{fr?'Oui, le':'Yes, at'} {fmt(plannedAt)}</button>}
        {preparing&&status==='planned'&&<button type="button" className="bh-start-primary" onClick={()=>onMade(now)}>{method==='none'?(fr?'Pétrie maintenant':'Mixed now'):(fr?'Préparé maintenant':'Made now')}</button>}
        {status==='unconfirmed'&&<button type="button" onClick={onNotYet}>{fr?'Pas encore · Actualiser le plan':'Not yet · Update plan'}</button>}
      </div>
      <button type="button" className="bh-start-link" onClick={()=>setDifferent(!different)}>{fr?'À une autre heure ?':'Different time?'}</button>
      {!preparing&&<button type="button" className="bh-start-link" onClick={onRecipe}>{fr?'Voir la recette':'View recipe'}</button>}
    </>}
    {different&&<div className="bh-start-actions"><label>{method==='none'?(fr?'Heure du pétrissage':'Mixing time'):(fr?'Heure réelle':'Actual time')}<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label><button type="button" disabled={!valid} onClick={()=>{onMade(parsed);setDifferent(false);}}>{fr?'Enregistrer':'Set time'}</button>{!execution&&<button type="button" onClick={()=>{onMade(now);setDifferent(false);}}>{fr?'Maintenant':'Now'}</button>}</div>}
  </section>;
}
