'use client';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {BAKE_DESTINATIONS,type BakeDestination} from '../lib/bakeNavigation';
const icons:Record<BakeDestination,string>={
  batch:'M4 9h16l-2 11H6L4 9Z M8 9l4-6 4 6 M9 13v3 M15 13v3',
  organisation:'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  recipe:'M5 3h14v18H5V3Z M8 7h8 M8 11h8 M8 15h5',
  shopping:'M5 7h14l2 14H3L5 7Z M8 7V5a4 4 0 0 1 8 0v2',
  protocol:'M3 5l2 2 3-4 M11 5h10 M3 12l2 2 3-4 M11 12h10 M3 19l2 2 3-4 M11 19h10',
  service:'M3 18h18 M5 15a7 7 0 0 1 14 0H5Z M12 6V4 M10 4h4 M2 21h20',
};
export function DestinationIcon({destination}:{destination:BakeDestination}){
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icons[destination]} /></svg>;
}
export default function BakeNavigator({active,fr,onChange,top=0}:{active:BakeDestination;fr:boolean;onChange:(destination:BakeDestination)=>void;top?:number}){
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const root=useRef<HTMLDivElement>(null);
  const id=useId();
  useEffect(()=>setOpen(false),[active]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const descriptions:Record<BakeDestination,[string,string]>={batch:['Pains, pizzas, sandwichs','Bread, pizzas, sandwiches'],organisation:['Matériel, pâte, horaires','Equipment, dough and timing'],recipe:['Ingrédients et quantités','Ingredients and quantities'],shopping:['Votre liste de courses','Your shopping list'],protocol:['Gestes et suivi','Instructions and progress'],service:['Cuire, assembler, servir','Cook, assemble and serve']};
  const current=BAKE_DESTINATIONS.find(item=>item.id===active)!;
  return <div ref={root} className="bh-bake-navigator" style={{top,scrollMarginTop:top,'--bh-navigator-top':`${top}px`} as CSSProperties}>
    <button ref={trigger} type="button" className="bh-bake-navigator-trigger" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>
      <span className="bh-navigator-current"><DestinationIcon destination={active}/><span>{fr?current.fr:current.en}</span></span><span className="bh-navigator-disclosure">{open?(fr?'Fermer les rubriques':'Close sections'):(fr?'Voir les 6 rubriques':'View all 6 sections')} <span aria-hidden="true">{open?'⌃':'⌄'}</span></span>
    </button>
    {open&&<nav id={id} className="bh-bake-navigator-grid" aria-label={fr?'Votre fournée':'Your bake'}>
      {BAKE_DESTINATIONS.map(item=><button key={item.id} type="button" aria-current={active===item.id?'page':undefined} className="bh-bake-navigator-card" onClick={()=>{setOpen(false);onChange(item.id);trigger.current?.focus({preventScroll:true});}}><DestinationIcon destination={item.id}/><strong>{fr?item.fr:item.en}</strong><small>{descriptions[item.id][fr?0:1]}</small></button>)}
    </nav>}
  </div>;
}
