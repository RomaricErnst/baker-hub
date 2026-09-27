'use client';
import { useState } from 'react';
import { NEXT_CTA, SECONDARY_CTA } from '../lib/navButtons';

export interface CompletionActions {
  onSave?: () => unknown | Promise<unknown>;
  onShare?: () => unknown | Promise<unknown>;
  sessionSaved?: boolean;
}

/** Shared end of a bake, after cooking/cooling or final assembly. */
export default function JourneyCompletion({isFr,complete=true,onSave,onShare,sessionSaved=false,note}:CompletionActions & {isFr:boolean;complete?:boolean;note?:string}) {
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
      {onSave&&<button type="button" disabled={busy||sessionSaved} style={{...(sessionSaved?SECONDARY_CTA:NEXT_CTA),flex:'1 1 130px',opacity:sessionSaved ? 0.6 : 1}} onClick={()=>void run(onSave)}>{sessionSaved?(isFr?'Sauvegardé':'Saved'):(isFr?'Sauvegarder':'Save')}</button>}
      {onShare&&<button type="button" disabled={busy} style={{...(sessionSaved||!onSave?NEXT_CTA:SECONDARY_CTA),flex:'1 1 130px'}} onClick={()=>void run(onShare)}>{isFr?'Partager':'Share'}</button>}
    </div>
    {error&&<p role="alert">{isFr?'L’action n’a pas abouti. Réessayez.':'The action could not be completed. Please try again.'}</p>}
  </section>;
}
