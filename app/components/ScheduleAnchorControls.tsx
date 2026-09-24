'use client';
import type {AvailabilityBlock} from '../utils';
import type {EditSlot} from '../utils/scheduleEdit';

type Anchor={id:string;name:string;at:number;slots:EditSlot[]};
/** Both anchors share one linear time scale; green means the full plan validates. */
export default function ScheduleAnchorControls({anchors,from,to,blocks,isFr,onChange,onEdit}:{
  anchors:Anchor[];from:number;to:number;blocks:AvailabilityBlock[];isFr:boolean;
  onChange:(id:string,at:number)=>void;onEdit:(id:string)=>void;
}){
  const fmt=(at:number)=>new Date(at).toLocaleString(isFr?'fr-FR':'en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
  const pos=(at:number)=>Math.max(0,Math.min(100,(at-from)/(to-from)*100));
  return <section aria-label={isFr?'Ajuster les horaires':'Adjust times'} style={{margin:'16px 0',padding:14,border:'1px solid var(--border)',borderRadius:14}}>
    <div style={{display:'grid',gridTemplateColumns:`repeat(${anchors.length},minmax(0,1fr))`,gap:12}}>
      {anchors.map(anchor=><div key={anchor.id} style={{minWidth:0,textAlign:'center'}}>
        <strong style={{fontSize:15,display:'block',minHeight:40}}>{anchor.name}</strong>
        <button type="button" onClick={()=>onEdit(anchor.id)} style={{display:'block',width:'100%',minHeight:44,border:0,background:'none',color:'var(--terra)',fontSize:14,textDecoration:'underline'}}>{fmt(anchor.at)}</button>
      </div>)}
      <span style={{gridColumn:'1 / -1',fontSize:12,textAlign:'center'}}>{fmt(from)}</span>
      {anchors.map(anchor=><div key={anchor.id} style={{minWidth:0}}>
        <div style={{height:180,width:48,margin:'auto',position:'relative',background:'#e4e1db',borderRadius:18,overflow:'hidden'}}>
          {anchor.slots.filter(slot=>slot.valid).map(slot=><div key={slot.at} style={{position:'absolute',insetInline:0,top:`${pos(slot.at-450000)}%`,height:`${Math.max(.2,pos(slot.at+450000)-pos(slot.at-450000))}%`,background:'#c4d7b6'}}/>)}
          {blocks.filter(b=>+b.to>from&&+b.from<to).map((block,i)=><div key={i} title={block.label} style={{position:'absolute',insetInline:0,top:`${pos(+block.from)}%`,height:`${pos(+block.to)-pos(+block.from)}%`,background:'repeating-linear-gradient(135deg,#bdb8af,#bdb8af 4px,#eeeae4 4px,#eeeae4 8px)'}}/>)}
          <input type="range" aria-label={(isFr?'Ajuster ':'Adjust ')+anchor.name} aria-valuetext={fmt(anchor.at)} min={from} max={to} step={900000} value={Math.max(from,Math.min(to,anchor.at))} onChange={event=>onChange(anchor.id,Number(event.target.value))} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();onChange(anchor.id,Math.max(from,Math.min(to,anchor.at+(event.key==='ArrowDown'?900000:-900000))));}}} style={{position:'absolute',inset:0,margin:0,width:48,height:180,writingMode:'vertical-lr',direction:'ltr',accentColor:'var(--terra)',touchAction:'none',cursor:'ns-resize'}}/>
        </div>
      </div>)}
    </div>
    <div style={{fontSize:12,marginTop:8,textAlign:'center'}}>{fmt(to)}</div>
    <p style={{fontSize:12,margin:'10px 0 0',color:'var(--smoke)'}}>{isFr?'Vert : planning compatible · Gris : incompatible · Hachures : indisponible':'Green: plan fits · Grey: incompatible · Hatching: unavailable'}</p>
  </section>;
}
