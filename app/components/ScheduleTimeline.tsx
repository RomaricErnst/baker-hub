'use client';
import type {ReactNode} from 'react';
import type {AvailabilityBlock} from '../utils';
import type {PlanRow} from './SchedulePicker';

export function timelineDuration(milliseconds:number):string {
  const minutes=Math.max(0,Math.round(milliseconds/60000));
  return minutes>=60?`${Math.floor(minutes/60)}h${minutes%60?String(minutes%60).padStart(2,'0'):''}`:`${minutes} min`;
}
export function timelineDayKey(at:number):string {
  const d=new Date(at);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
/** A chronological reading view. Space between rows is deliberately not a time scale. */
export default function ScheduleTimeline({rows,blocks,isFr,editingEnabled,editingId,onEdit,editor,onToggleEditing}: {
  rows:PlanRow[]; blocks:AvailabilityBlock[]; isFr:boolean; editingEnabled:boolean; editingId:string|null;
  onEdit:(id:string)=>void; editor:ReactNode; onToggleEditing:()=>void;
}) {
  const fmt=(at:number)=>new Date(at).toLocaleTimeString(isFr?'fr-FR':'en-GB',{hour:'2-digit',minute:'2-digit'});
  const first=rows[0]?.at??0,last=rows.at(-1)?.at??0;
  const items=[...rows.map(row=>({at:row.at,row})),...blocks.filter(b=>+b.to>first&&+b.from<last).map((block,i)=>({at:Math.max(first,+block.from),block,key:`busy-${i}`}))].sort((a,b)=>a.at-b.at);
  const button={minHeight:44,padding:'8px 12px',fontSize:16,border:'1px solid var(--border)',borderRadius:10,background:'var(--paper)',color:'var(--char)',cursor:'pointer'};
  return <section aria-label={isFr?'Votre planning':'Your schedule'} style={{marginTop:20}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:12}}>
      <h3 style={{fontSize:19,margin:0}}>{isFr?'Mon planning':'My schedule'}</h3>

    </div>
    {items.map((item,index)=>{
      const dayChanged=index===0||timelineDayKey(item.at)!==timelineDayKey(items[index-1].at);
      const day=dayChanged?<h4 style={{fontSize:15,margin:'20px 0 10px'}}>{new Date(item.at).toLocaleDateString(isFr?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'long'})}</h4>:null;
      if('block' in item){const b=item.block;const name=b.label.startsWith('Work · ')?(isFr?'Travail':'Work'):b.label.endsWith(' night')?(isFr?'Nuit':'Night'):b.label;return <div key={item.key}>{day}<div style={{margin:'8px 0 8px 66px',padding:'10px 12px',borderRadius:8,background:'repeating-linear-gradient(135deg,#ece9e3,#ece9e3 6px,#f4f1ec 6px,#f4f1ec 12px)',fontSize:14,lineHeight:1.5}}>{isFr?'Indisponible':'Unavailable'} · {name}<br/>{new Date(+b.from).toLocaleDateString(isFr?'fr-FR':'en-GB',{weekday:'short'})} {fmt(+b.from)} → {new Date(+b.to).toLocaleDateString(isFr?'fr-FR':'en-GB',{weekday:'short'})} {fmt(+b.to)}</div></div>}
      const r=item.row,next=rows[rows.indexOf(r)+1];const end=r.endAt??r.at;const wait=next?next.at-end:0;
      return <div key={r.id}>{day}<div style={{display:'grid',gridTemplateColumns:'54px minmax(0,1fr)',gap:12,padding:'10px 0',alignItems:'start'}}>
        <time dateTime={new Date(r.at).toISOString()} style={{fontSize:15,fontVariantNumeric:'tabular-nums',paddingTop:10}}>{r.originalAt!==undefined&&<span style={{display:'block',textDecoration:'line-through',opacity:.5,fontSize:12}}>{timelineDayKey(r.originalAt)!==timelineDayKey(r.at)?new Date(r.originalAt).toLocaleDateString(isFr?'fr-FR':'en-GB',{day:'numeric',month:'short'})+' ':''}{fmt(r.originalAt)}</span>}{r.editable?<button type="button" aria-label={`${isFr?'Modifier':'Edit'} ${r.name}`} onClick={()=>onEdit(r.id)} style={{border:0,background:'transparent',color:'inherit',font:'inherit',padding:'4px 0',minHeight:44,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:4}}>{fmt(r.at)}</button>:r.timeText.startsWith('≈')?'≈':fmt(r.at)}</time>
        <div style={{borderLeft:`3px solid ${r.color}`,padding:'10px 12px',borderRadius:5,background:'var(--warm)',minWidth:0,opacity:r.isHistory?.7:1}}>
          <div style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}><strong style={{fontSize:16}}>{r.name}</strong>{r.editable&&editingId!==r.id&&<button type="button" onClick={()=>onEdit(r.id)} style={button}>{isFr?'Modifier':'Edit'}</button>}</div>
          {r.endAt&&r.endAt>r.at&&<div style={{fontSize:13,color:'var(--smoke)',marginTop:4}}>{timelineDuration(r.endAt-r.at)}</div>}
          {r.isHistory&&<div style={{fontSize:13}}>{isFr?'Déjà passé':'Past event'}</div>}
          {editingId===r.id&&<div style={{marginTop:10}}>{editor}</div>}
          {r.note&&<div style={{marginTop:8,fontSize:14,lineHeight:1.5}}>{r.note}</div>}
        </div>
      </div>{wait>=15*60000&&<div style={{margin:'0 0 8px 66px',minHeight:Math.min(100,20+Math.sqrt(wait/3600000)*14),display:'flex',alignItems:'center',flexWrap:'wrap',gap:4,padding:'8px 12px',borderLeft:'2px dotted var(--border)',fontSize:14,color:'var(--smoke)'}}>{r.waitLabel??(isFr?'Attente':'Wait')} · {timelineDuration(wait)}</div>}</div>;
    })}
  </section>;
}
