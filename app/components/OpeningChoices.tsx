'use client';
import Image from 'next/image';
import type {BakeType} from '../data';
interface Props {fr:boolean;onSelect:(type:BakeType)=>void;}
/** Two actions. The food examples are illustrative, never extra menu items. */
export default function OpeningChoices({fr,onSelect}:Props){
 const choices=[
  {type:'pizza' as BakeType,title:'Pizza',description:fr?'Ronde ou en plaque, de la pâte aux garnitures.':'Round or tray-baked, from dough to toppings.',images:['/images/approved/opening-v2/pizza.webp','/images/approved/pizza-style/new-york-whole-v3.webp','/images/approved/pizza-style/roman-teglia-potato.webp']},
  {type:'bread' as BakeType,title:fr?'Pain & repas':'Bread & meals',description:fr?'Pain seul, sandwichs, tartines et wraps.':'Bread on its own, sandwiches, tartines and wraps.',images:['/images/approved/opening-v2/bread.webp','/images/approved/sandwich/pita-poulet-cru-citron.webp','/images/approved/sandwich/laffa-falafel-houmous.webp']},
 ];
 return <div className="bake-kind-grid" style={{display:'grid',gap:14,marginBottom:16}}>{choices.map(choice=><button key={choice.type} className="bh-opening-choice" type="button" onClick={()=>onSelect(choice.type)} aria-label={choice.type==='bread'?(fr?'Pain':'Bread'):'Pizza'} aria-describedby={`opening-description-${choice.type}`}>
  <div className="bh-opening-foods" aria-hidden="true">{choice.images.map((src,index)=><span key={src}><Image src={src} alt="" fill sizes="(max-width:600px) 60vw, 300px" priority={index===0}/></span>)}</div>
  <span style={{display:'block',padding:'14px 16px'}}><strong style={{display:'block',fontSize:22,marginBottom:6}}>{choice.title}<span style={{float:'right'}} aria-hidden="true">→</span></strong><span id={`opening-description-${choice.type}`} style={{display:'block',fontSize:15,lineHeight:1.45,color:'var(--ash)'}}>{choice.description}</span></span>
 </button>)}</div>;
}
