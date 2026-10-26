'use client';
import {useState} from 'react';

export default function MixingBatchControl({total,capacity,count,recommended,manual,knownCapacity,override,fr,onChange}:{total:number;capacity:number;count:number;recommended:number;manual:boolean;knownCapacity:boolean;override:boolean;fr:boolean;onChange:(value:number|undefined)=>void}) {
 const [expanded,setExpanded]=useState(false);
 const [draft,setDraft]=useState<string|null>(null);
 const open=expanded||recommended>1||override;
 const label=fr?(manual?'Nombre de lots':'Nombre de pétrissées'):'Mixing batches';
 const commit=()=>{
  if(draft===null)return;
  const n=Number(draft);
  if(draft.trim()!==''&&Number.isInteger(n)&&n>=1&&n<=100)onChange(n);
  setDraft(null);
 };
 const button={minWidth:44,minHeight:44,border:'1px solid var(--border)',borderRadius:8,background:'var(--cream)',color:'var(--terra)',cursor:'pointer'};
 return <section aria-label={label} style={{marginTop:16,padding:14,border:'1px solid var(--border)',borderRadius:12,background:'var(--warm)'}}>
 <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12}}>
 <strong>{open?label:`1 ${fr?(manual?'lot':'pétrissée'):'batch'}`}</strong>
 {open?<div style={{display:'flex',alignItems:'center',gap:6}}>
 <button type="button" aria-label={fr?'Une pétrissée de moins':'One fewer batch'} disabled={count<=1} style={button} onClick={()=>{setDraft(null);onChange(Math.max(1,count-1));}}>−</button>
 <input aria-label={label} type="text" inputMode="numeric" value={draft??String(count)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} style={{width:58,minHeight:44,textAlign:'center',border:'1px solid var(--border)',borderRadius:8,background:'var(--cream)',font:'inherit'}}/>
 <button type="button" aria-label={fr?'Une pétrissée de plus':'One more batch'} disabled={count>=100} style={button} onClick={()=>{setDraft(null);onChange(Math.min(100,count+1));}}>+</button>
 </div>:<button type="button" style={{...button,padding:'8px 12px'}} onClick={()=>setExpanded(true)}>{fr?'Modifier':'Adjust'}</button>}
 <p style={{margin:'8px 0 0',fontSize:14,width:'100%'}}>{Math.round(total/count)} g {fr?'par lot':'per batch'} · {fr?(manual?'Quantité indicative':knownCapacity?'Capacité indiquée':'Capacité estimée'):(manual?'Suggested batch size':knownCapacity?'Entered capacity':'Estimated capacity')}: {capacity} g</p>
 </div>
 {total/count>capacity&&<p role="alert">{fr?'La pâte par lot dépasse la capacité. Augmentez le nombre de lots.':'Dough per batch exceeds capacity. Increase the batch count.'}</p>}
 {override&&<button type="button" style={{...button,marginTop:8,padding:'8px 12px'}} onClick={()=>{setDraft(null);onChange(undefined);}}>{fr?'Utiliser la recommandation':'Use recommended'}: {recommended}</button>}
 </section>;
}
