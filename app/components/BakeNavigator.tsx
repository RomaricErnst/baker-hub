'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {BAKE_DESTINATIONS,type BakeDestination} from '../lib/bakeNavigation';
export default function BakeNavigator({active,fr,onChange}:{active:BakeDestination;fr:boolean;onChange:(destination:BakeDestination)=>void}){
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
  const descriptions:Record<BakeDestination,[string,string]>={batch:['Pains, pizzas et garnitures','Bread, pizzas and fillings'],organisation:['Matériel, pâte, horaires','Equipment, dough and timing'],recipe:['Ingrédients et quantités','Ingredients and quantities'],shopping:['Votre liste de courses','Your shopping list'],protocol:['Gestes et suivi','Instructions and progress'],service:['Cuire, assembler, servir','Cook, assemble and serve']};
  const current=BAKE_DESTINATIONS.find(item=>item.id===active)!;
  return <div ref={root} className="bh-bake-navigator">
    <button ref={trigger} type="button" className="bh-bake-navigator-trigger" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>
      <span>{fr?current.fr:current.en}</span><span style={{fontSize:13,fontWeight:500}}>{open?(fr?'Fermer':'Close'):(fr?'Tout voir':'View all')} <span aria-hidden="true">{open?'⌃':'⌄'}</span></span>
    </button>
    {open&&<nav id={id} className="bh-bake-navigator-grid" aria-label={fr?'Votre fournée':'Your bake'}>
      {BAKE_DESTINATIONS.map(item=><button key={item.id} type="button" aria-current={active===item.id?'page':undefined} className="bh-bake-navigator-card" onClick={()=>{setOpen(false);onChange(item.id);trigger.current?.focus({preventScroll:true});}}><strong>{fr?item.fr:item.en}</strong><span>{descriptions[item.id][fr?0:1]}</span></button>)}
    </nav>}
  </div>;
}
