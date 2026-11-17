'use client';
import {formatBakeDateTime,formatClock} from '../utils/units';
import {SECONDARY_CTA} from '../lib/navButtons';
import type {CSSProperties} from 'react';

// The card's buttons are the shared secondary style: the screen's one primary stays in the bottom bar
// (16 Nov 2026 design review). The expected answer reads a little stronger, never filled brown.
export const STATUS_BUTTON:CSSProperties={...SECONDARY_CTA,width:'auto',padding:'10px 16px',fontSize:15,color:'var(--char)'};
export const STATUS_ANSWER:CSSProperties={...STATUS_BUTTON,fontWeight:600,borderColor:'var(--terra)'};
/** "6:00pm" today, "Fri 20 Nov · 6:00pm" on any other day. */
export function statusTime(at:number,now:number,fr:boolean){
  const date=new Date(at);
  return date.toDateString()===new Date(now).toDateString()?formatClock(date,fr?'fr':'en'):formatBakeDateTime(date,fr?'fr':'en');
}
import {useState} from 'react';
import type {BakeExecution} from '../utils/bakeExecution';
import {preparationStatus} from '../utils/bakeExecution';

export default function BakeStartStatus({fr,method,plannedAt,now,execution,preparing,superseded=false,onMade,onNotYet,onRecipe,onNext,onUndo}:{
  fr:boolean;method:'none'|'poolish'|'biga';plannedAt:number;now:number;execution?:BakeExecution;preparing:boolean;
  /** A later step of the plan is now current: the confirmation note has done its job. */
  superseded?:boolean;
  onMade:(at:number)=>void;onNotYet:()=>void;onRecipe:()=>void;onNext:()=>void;onUndo:()=>void;
}) {
  const [different,setDifferent]=useState(false),[time,setTime]=useState('');
  const status=preparationStatus(plannedAt,execution,now);
  // A "Made now" button hours ahead invites a mistaken tap: offer it from 30 minutes before.
  if(status==='planned'&&(!preparing||plannedAt-now>30*60_000))return null;
  // At the planned minute the honest answer is "starting now": for the first 45 minutes it is a start,
  // not a question; in Preparation the step itself (marked Now) takes over (16 Nov retention review).
  const starting=!execution&&status==='unconfirmed'&&now-plannedAt<45*60_000;
  if(starting&&preparing)return null;
  // Once confirmed, the note stays for half an hour, not for the rest of the bake (retention review).
  if(execution&&now-(execution.recordedAt??execution.actualAt)>30*60_000)return null;
  // Once a later step is the one to do, the note goes (17 Nov 2026 retention round 2); right after the tap it
  // stays a few minutes, for Change time and Undo.
  if(execution&&superseded&&now-(execution.recordedAt??execution.actualAt)>5*60_000)return null;
  const fmt=(at:number)=>statusTime(at,now,fr);
  const noun=method==='none'?(fr?'la pâte':'the dough'):method==='biga'?(fr?'la biga':'the biga'):(fr?'le poolish':'the poolish');
  const editTime=(at:number)=>{const date=new Date(at);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());setTime(date.toISOString().slice(0,16));setDifferent(true);};
  const parsed=+new Date(time), valid=!!time&&Number.isFinite(parsed)&&parsed<=now;
  return <section className="bh-start-status" aria-label={fr?'Préparation de la fournée':'Bake preparation'}>
    {execution?(preparing?<>
      <p><strong>{method==='none'?(fr?'Pétrie':'Mixed'):(fr?'Préparé':'Made')} · {fmt(execution.actualAt)}</strong></p>
      <div className="bh-start-actions"><button type="button" style={STATUS_BUTTON} onClick={()=>editTime(execution.actualAt)}>{fr?'Modifier l’heure':'Change time'}</button><button type="button" className="bh-start-link" onClick={onUndo}>{fr?'Annuler la confirmation':'Undo completion'}</button></div>
    </>:
      // Outside Preparation the fact is one compact line; the bar above leads to the step (16 Nov 2026 design review).
      <p className="bh-start-compact"><strong>{method==='none'?(fr?'Pétrie':'Mixed'):(fr?'Préparé':'Made')} · {fmt(execution.actualAt)}</strong><button type="button" className="bh-start-link" onClick={()=>editTime(execution.actualAt)}>{fr?'Modifier l’heure':'Change time'}</button><button type="button" className="bh-start-link" aria-label={fr?'Annuler la confirmation':'Undo completion'} onClick={onUndo}>{fr?'Annuler':'Undo'}</button></p>
    ):<>
      {starting?<>
        <p><strong>{method==='none'?(fr?'C’est l’heure de pétrir':'Time to mix the dough'):(fr?`C’est l’heure de préparer ${noun}`:`Time to make ${noun}`)}</strong></p>
        <div className="bh-start-actions"><button type="button" style={STATUS_ANSWER} onClick={onNext}>{fr?'Je commence →':'Start now →'}</button><button type="button" style={STATUS_BUTTON} onClick={()=>onMade(plannedAt)}>{fr?'Déjà fait':'Already done'}</button></div>
      </>:<>
      <p><strong>{method==='none'?(status==='unconfirmed'?(fr?'Avez-vous pétri la pâte ?':'Have you mixed the dough?'):(fr?'Pétrir la pâte':'Mix the dough')):status==='unconfirmed'?(fr?`Avez-vous préparé ${noun} ?`:`Have you made ${noun}?`):(fr?`Préparer ${noun}`:`Make ${noun}`)}</strong></p>
      <div className="bh-start-actions">
        {status==='unconfirmed'&&<button type="button" style={STATUS_ANSWER} onClick={()=>onMade(plannedAt)}>{fr?'Oui, le':'Yes, at'} {fmt(plannedAt)}</button>}
        {preparing&&status==='planned'&&<button type="button" style={STATUS_ANSWER} onClick={()=>onMade(now)}>{method==='none'?(fr?'Pétrie maintenant':'Mixed now'):(fr?'Préparé maintenant':'Made now')}</button>}
        {status==='unconfirmed'&&<button type="button" style={STATUS_BUTTON} onClick={onNotYet}>{fr?'Pas encore · Actualiser le plan':'Not yet · Update plan'}</button>}
      </div>
      <button type="button" className="bh-start-link" onClick={()=>setDifferent(!different)}>{fr?'À une autre heure ?':'Different time?'}</button>
      {!preparing&&<button type="button" className="bh-start-link" onClick={onRecipe}>{fr?'Voir la recette':'View recipe'}</button>}
      </>}
    </>}
    {different&&<div className="bh-start-actions"><label>{method==='none'?(fr?'Heure du pétrissage':'Mixing time'):(fr?'Heure réelle':'Actual time')}<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label><button type="button" style={STATUS_BUTTON} disabled={!valid} onClick={()=>{onMade(parsed);setDifferent(false);}}>{fr?'Enregistrer':'Set time'}</button>{!execution&&<button type="button" style={STATUS_BUTTON} onClick={()=>{onMade(now);setDifferent(false);}}>{fr?'Maintenant':'Now'}</button>}</div>}
  </section>;
}
