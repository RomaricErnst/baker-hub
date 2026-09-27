'use client';
import { useState } from 'react';
import { NEXT_CTA, SECONDARY_CTA } from '../lib/navButtons';

export interface CompletionActions {
  onSave?: () => unknown | Promise<unknown>;
  onShare?: () => unknown | Promise<unknown>;
  sessionSaved?: boolean;
  saveKind?: 'account' | 'download';
  onRepeat?: () => unknown | Promise<unknown>;
  resultNotes?: string;
  onResultNotesChange?: (value: string) => void;
}

/** Shared end of a bake, after cooking/cooling or final assembly. */
export default function JourneyCompletion({isFr,complete=true,onSave,onShare,sessionSaved=false,saveKind='account',onRepeat,resultNotes='',onResultNotesChange,note}:CompletionActions & {isFr:boolean;complete?:boolean;note?:string}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  async function run(action:()=>unknown | Promise<unknown>) {
    setBusy(true);setError(false);
    try { await action(); }
    catch(e) { if(!(e instanceof DOMException&&e.name==='AbortError'))setError(true); }
    finally { setBusy(false); }
  }
  return <section aria-label={isFr?'Fin de la fournée':'Finish your bake'} style={{marginTop:24,padding:'20px 0',borderTop:'1px solid var(--border)'}}>
    {complete&&<p role="status" style={{fontWeight:700}}>{isFr?'Tout est prêt. Bon appétit !':'Everything is ready. Enjoy!'}</p>}
    {note&&<p>{note}</p>}
    <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
      {onSave&&<button type="button" disabled={busy||sessionSaved} style={{...(sessionSaved?SECONDARY_CTA:NEXT_CTA),flex:'1 1 130px',opacity:sessionSaved ? 0.6 : 1}} onClick={()=>void run(onSave)}>{saveKind==='download' ? (sessionSaved?(isFr?'Téléchargée':'Downloaded'):(isFr?'Télécharger la recette':'Download recipe')) : (sessionSaved?(isFr?'Enregistré':'Saved'):(isFr?'Enregistrer':'Save'))}</button>}
      {onShare&&<button type="button" disabled={busy} style={{...(sessionSaved||!onSave?NEXT_CTA:SECONDARY_CTA),flex:'1 1 130px'}} onClick={()=>void run(onShare)}>{isFr?'Partager':'Share'}</button>}
    </div>
    {complete&&onResultNotesChange&&<details style={{marginTop:12}}><summary style={{minHeight:44,padding:'10px 0',cursor:'pointer'}}>{isFr?'Mes notes pour la prochaine fois':'Notes for next time'}</summary><textarea aria-label={isFr?'Mes notes pour la prochaine fois':'Notes for next time'} value={resultNotes} maxLength={2000} rows={3} onChange={event=>onResultNotesChange(event.target.value)} placeholder={isFr?'Ce qui a bien marché, ce que je changerais…':'What worked, what I would change…'} style={{width:'100%',boxSizing:'border-box',padding:12,border:'1px solid var(--border)',borderRadius:8,font:'inherit',background:'var(--cream)',color:'var(--char)'}}/></details>}
    {complete&&onRepeat&&<button type="button" disabled={busy} onClick={()=>void run(onRepeat)} style={{minHeight:44,padding:'8px 0',marginTop:8,border:0,background:'transparent',color:'var(--terra)',font:'inherit',textDecoration:'underline',cursor:'pointer'}}>{isFr?'Refaire cette recette':'Make this again'}</button>}
    {error&&<p role="alert">{isFr?'L’action n’a pas abouti. Réessayez.':'The action could not be completed. Please try again.'}</p>}
  </section>;
}
