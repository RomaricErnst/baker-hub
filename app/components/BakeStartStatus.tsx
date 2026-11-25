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
  /** A later step of the plan is now current: the confirmation note, or the unanswered question, has done its job. */
  superseded?:boolean;
  onMade:(at:number)=>void;onNotYet:()=>void;onRecipe:()=>void;onNext:()=>void;onUndo:()=>void;
}) {
  const [different,setDifferent]=useState(false),[time,setTime]=useState('');
  const status=preparationStatus(plannedAt,execution,now);
  // In Preparation the step itself says it all (round 21, owner): "Step done", then "Different time?" on the step
  // (prefilled with the tap's own clock); the separate "Start Dough / Done now" card above the steps is gone.
  if(preparing)return null;
  // Outside Preparation nothing is asked before the planned time.
  if(status==='planned')return null;
  // At the planned minute the honest answer is "starting now": for the first 45 minutes it is a start,
  // not a question; in Preparation the step itself (marked Now) takes over (16 Nov retention review).
  const starting=!execution&&status==='unconfirmed'&&now-plannedAt<45*60_000;
  // Once confirmed, the note stays for half an hour, not for the rest of the bake (retention review).
  if(execution&&now-(execution.recordedAt??execution.actualAt)>30*60_000)return null;
  // Once a later step is the one to do, the note goes (17 Nov 2026 retention round 2); right after the tap it
  // stays a few minutes, for Change time and Undo.
  if(execution&&superseded&&now-(execution.recordedAt??execution.actualAt)>5*60_000)return null;
  // A question is an optional shortcut, never a gate: once the clock has moved on to a later step the bake
  // simply follows it, and the question goes (18 Nov 2026 retention round 3).
  if(!execution&&superseded)return null;
    const fmt=(at:number)=>statusTime(at,now,fr);
  const noun=method==='none'?(fr?'la pâte':'the dough'):method==='biga'?(fr?'la biga':'the biga'):(fr?'le poolish':'the poolish');
  const editTime=(at:number)=>{const date=new Date(at);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());setTime(date.toISOString().slice(0,16));setDifferent(true);};
  // The tap's own clock (round 20): `now` is the page's 30-second clock, which a phone's throttled timers
  // can leave minutes behind; "Mixed now" at 9:50 recorded an earlier minute.
  const parsed=+new Date(time), valid=!!time&&Number.isFinite(parsed);
  return <section className="bh-start-status" aria-label={fr?'Préparation de la fournée':'Bake preparation'}>
    {execution?(
      // The fact is one compact line; the bar above leads to the step (16 Nov 2026 design review).
      <p className="bh-start-compact"><strong>{method==='none'?(fr?'Pâte commencée':'Dough started'):(fr?'Préparé':'Made')}{execution.stated?` · ${fmt(execution.actualAt)}`:''}</strong><button type="button" className="bh-start-link" onClick={()=>editTime(execution.stated||execution.actualAt>=Date.now()-5*60000?execution.actualAt:Math.floor(Date.now()/300000)*300000)}>{execution.stated?(fr?'Modifier l’heure':'Change time'):(fr?'À une autre heure ?':'Different time?')}</button><button type="button" className="bh-start-link" aria-label={fr?'Annuler la confirmation':'Undo completion'} onClick={onUndo}>{fr?'Annuler':'Undo'}</button></p>
    ):<>
      {starting?<>
        <p><strong>{method==='none'?(fr?'C’est l’heure de pétrir':'Time to mix the dough'):(fr?`C’est l’heure de préparer ${noun}`:`Time to make ${noun}`)}</strong></p>
        <div className="bh-start-actions"><button type="button" style={STATUS_ANSWER} onClick={onNext}>{fr?'Je commence →':'Start now →'}</button><button type="button" style={STATUS_BUTTON} onClick={()=>onMade(plannedAt)}>{fr?'Déjà fait':'Already done'}</button></div>
      </>:<>
      <p><strong>{method==='none'?(status==='unconfirmed'?(fr?'Avez-vous pétri la pâte ?':'Have you mixed the dough?'):(fr?'Pétrir la pâte':'Start Dough')):status==='unconfirmed'?(fr?`Avez-vous préparé ${noun} ?`:`Have you made ${noun}?`):(fr?`Préparer ${noun}`:`Make ${noun}`)}</strong></p>
      <div className="bh-start-actions">
        {/* FR: "Oui, à 19h00" the same day, "Oui, le ven. 20 nov. · 19h00" another day (18 Nov 2026 retention round 3). */}
        {status==='unconfirmed'&&<button type="button" style={STATUS_ANSWER} onClick={()=>onMade(plannedAt)}>{fr?(new Date(plannedAt).toDateString()===new Date(now).toDateString()?'Oui, à':'Oui, le'):'Yes, at'} {fmt(plannedAt)}</button>}
        {status==='unconfirmed'&&<button type="button" style={STATUS_BUTTON} onClick={onNotYet}>{fr?'Pas encore · Actualiser le plan':'Not yet · Update plan'}</button>}
      </div>
      <button type="button" className="bh-start-link" onClick={()=>{if(!different&&!time){const d=new Date(Math.floor(Date.now()/300000)*300000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());setTime(d.toISOString().slice(0,16));}setDifferent(!different);}}>{fr?'À une autre heure ?':'Different time?'}</button>
      <button type="button" className="bh-start-link" onClick={onRecipe}>{fr?'Voir la recette':'View recipe'}</button>
      </>}
    </>}
    {different&&<div className="bh-start-actions"><label>{method==='none'?(fr?'Heure du pétrissage':'Mixing time'):(fr?'Heure réelle':'Actual time')}<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label><button type="button" style={STATUS_BUTTON} disabled={!valid} onClick={()=>{if(parsed>Date.now())return;onMade(parsed);setDifferent(false);}}>{fr?'Enregistrer':'Set time'}</button>{!execution&&<button type="button" style={STATUS_BUTTON} onClick={()=>{onMade(Date.now());setDifferent(false);}}>{fr?'Maintenant':'Now'}</button>}</div>}
  </section>;
}
