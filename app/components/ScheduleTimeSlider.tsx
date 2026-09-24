'use client';
import type {AvailabilityBlock} from '../utils';

/** Expanded editor only: the vertical axis is linear, unlike the compact agenda. */
export default function ScheduleTimeSlider({from,to,value,onChange,blocks,isFr,label}: {
  from:number;to:number;value:number;onChange:(at:number)=>void;
  blocks:AvailabilityBlock[];isFr:boolean;label:string;
}) {
  if(![from,to,value].every(Number.isFinite)||to<=from)return null;
  const fmt=(at:number)=>new Date(at).toLocaleString(isFr?'fr-FR':'en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
  const position=(at:number)=>Math.max(0,Math.min(100,(at-from)/(to-from)*100));
  return <div style={{display:'grid',gridTemplateColumns:'48px minmax(0,1fr)',gap:12,minHeight:220}}>
    <div style={{position:'relative',height:220,background:'#e8eddf',borderRadius:24}}>
      {blocks.filter(b=>+b.to>from&&+b.from<to).map((b,i)=><div key={i} title={b.label} style={{position:'absolute',left:0,right:0,top:`${position(+b.from)}%`,height:`${position(+b.to)-position(+b.from)}%`,background:'repeating-linear-gradient(135deg,#c9c4bc,#c9c4bc 4px,#eeeae4 4px,#eeeae4 8px)',borderRadius:8}}/>)}
      <input type="range" aria-label={label} aria-valuetext={fmt(value)} min={from} max={to} step={15*60000} value={Math.max(from,Math.min(to,value))} onChange={e=>onChange(Number(e.target.value))}
        style={{position:'absolute',inset:0,margin:0,width:48,height:220,writingMode:'vertical-lr',direction:'ltr',accentColor:'var(--terra)',cursor:'ns-resize',touchAction:'none'}}/>
    </div>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',fontSize:14}}>
      <span>{fmt(from)}</span>
      <div><strong style={{fontSize:17}}>{fmt(value)}</strong><p style={{margin:'6px 0',color:'var(--smoke)'}}>{isFr?'Glissez le point pour ajuster':'Slide the point to adjust'}</p><small>{isFr?'Hachures : indisponible':'Hatching: unavailable'}</small></div>
      <span>{fmt(to)}</span>
    </div>
  </div>;
}
