'use client';
import {useCallback,useEffect,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import SandwichParty from './SandwichParty';
import PizzaParty from './PizzaParty';
import CompanionSteps from './CompanionSteps';
import {createSandwichSnapshot,normalizeSandwichSnapshot,sandwichFamilyForStyle,type SandwichSnapshot} from '../lib/sandwich';
import {getPizzaById} from '../lib/toppingDatabase';

const STORAGE='bh_existing_base_v1';
const bases=[['pizza','Pâte à pizza','Pizza dough'],['pain_campagne','Pain en tranches · tartines','Sliced bread · tartines'],['pain_mie','Pain de mie · clubs & croques','Sandwich loaf · clubs & croques'],['pita','Pitas','Pitas'],['laffa','Wraps souples','Soft wraps'],['baguette','Baguette','Baguette'],['focaccia','Focaccia','Focaccia'],['ciabatta','Ciabatta','Ciabatta'],['bagel','Bagels','Bagels']];
type Phase='pick'|'shop'|'prep'|'bake';
type Draft={base:string;portions:number;pizza:Record<string,number>;done:Record<string,number>;phase:Phase;sandwiches:Record<string,SandwichSnapshot>};
const fresh=():Draft=>({base:'',portions:4,pizza:{},done:{},phase:'pick',sandwiches:{}});
const quantities=(value:unknown)=>Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).filter(([id,n])=>!!getPizzaById(id)&&typeof n==='number'&&Number.isFinite(n)).map(([id,n])=>[id,Math.min(99,Math.max(0,Math.floor(Number(n))))]));
export default function ExistingBaseJourney(){
 const locale=useLocale(),t=useTranslations(),fr=locale==='fr';
 const tr=(a:string,b:string)=>fr?a:b;
 const [draft,setDraft]=useState<Draft>(fresh),[loaded,setLoaded]=useState(false),[editing,setEditing]=useState(false);
 useEffect(()=>{try{const d=JSON.parse(localStorage.getItem(STORAGE)||'null');if(d&&bases.some(b=>b[0]===d.base)){setDraft({base:d.base,portions:Math.min(99,Math.max(1,Number(d.portions)||4)),pizza:quantities(d.pizza),done:quantities(d.done),phase:['pick','shop','prep','bake'].includes(d.phase)?d.phase:'pick',sandwiches:Object.fromEntries(bases.filter(b=>b[0]!=='pizza').map(b=>[b[0],normalizeSandwichSnapshot(d.sandwiches?.[b[0]])]))});}}catch{}setLoaded(true);},[]);
 useEffect(()=>{if(loaded)try{localStorage.setItem(STORAGE,JSON.stringify(draft));}catch{}},[draft,loaded]);
 const setPizza=useCallback((pizza:Record<string,number>)=>setDraft(d=>JSON.stringify(d.pizza)===JSON.stringify(pizza)?d:{...d,pizza}),[]);
 const setPhase=(phase:Phase)=>setDraft(d=>({...d,phase}));
 const current=draft.sandwiches[draft.base];
 const snapshot=current?.familyId===sandwichFamilyForStyle(draft.base)?current:createSandwichSnapshot(sandwichFamilyForStyle(draft.base));
 const selected=Object.values(draft.pizza).reduce((a,b)=>a+b,0);
 const control={minHeight:44,padding:'12px 16px',border:'1px solid var(--border)',borderRadius:12,background:'var(--card)',color:'var(--char)',fontSize:16};
 if(!loaded)return <main style={{padding:24}}>{tr('Chargement…','Loading…')}</main>;
 return <main style={{maxWidth:850,margin:'0 auto',padding:'24px 16px 120px',fontFamily:'var(--font-ui)',color:'var(--char)'}}>
  <a href={`/${locale}`} style={{color:'var(--terra)',display:'inline-block',padding:'12px 0'}}>← {tr('Bakerhub · préparer ma pâte','Bakerhub · make my dough')}</a>
  <h1 style={{fontSize:'clamp(26px,6vw,36px)'}}>{tr('Avec ma pâte ou mon pain','With my dough or bread')}</h1>
  <p>{tr('Votre base est déjà prête ou achetée. Choisissez les garnitures, puis suivez la préparation.','Your base is ready or purchased. Choose toppings, then follow the preparation.')}</p>
  {(!draft.base||editing)?<section aria-label={tr('Votre base','Your base')}>
   <h2>{tr('Qu’avez-vous ?','What do you have?')}</h2>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10}}>{bases.map(([id,frName,enName])=><button key={id} style={control} onClick={()=>{setDraft(d=>({...d,base:id}));setEditing(false);}}>{fr?frName:enName}</button>)}</div>
   {editing&&<button style={{...control,marginTop:12}} onClick={()=>setEditing(false)}>{tr('Revenir à ma préparation','Return to my preparation')}</button>}
  </section>:<>
   <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',margin:'20px 0'}}><strong>{bases.find(b=>b[0]===draft.base)?.[fr?1:2]}</strong><button style={control} onClick={()=>setEditing(true)}>{tr('Changer','Change')}</button></div>
   {draft.base==='pizza'?<>
    <label style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>{tr('Pizzas à garnir','Pizzas to top')}<input aria-label={tr('Pizzas à garnir','Pizzas to top')} style={{...control,width:85}} type="number" min={1} max={99} value={draft.portions} onChange={e=>setDraft(d=>({...d,portions:Math.min(99,Math.max(1,Math.floor(Number(e.target.value)||1)))}))}/></label>
    <CompanionSteps label={tr('Ma préparation','My preparation')} active={draft.phase} onChange={setPhase} steps={[{key:'pick',label:tr('Garnitures','Toppings')},{key:'shop',label:tr('Courses','Shopping'),locked:!selected},{key:'prep',label:tr('Préparer','Prepare'),locked:!selected},{key:'bake',label:tr('Cuire et servir','Bake and serve'),locked:!selected}]}/>
    {draft.phase!=='bake'?<PizzaParty locale={locale} t={t} numItems={draft.portions} bakeTime={new Date()} activeTab={draft.phase} onTabChange={setPhase} initialQtys={draft.pizza} onQtysSnapshot={setPizza} doughConfigured baseReady storagePrefix="bh_existing_base" onGoToMyDough={()=>{setPhase('pick');window.scrollTo({top:0,behavior:'smooth'});}} onSelectionDone={()=>setPhase('shop')} selectionDoneLabel={tr('Voir les courses','View shopping')}/>:<section>
     <h2>{tr('Cuire votre pâte achetée','Bake your purchased dough')}</h2>
     <p>{tr('Suivez l’emballage pour le repos, le préchauffage, la température et la durée. Préparez les garnitures avant de commencer. Vérifiez que le dessous et le centre sont cuits ; ajoutez les finitions fraîches après cuisson.','Follow the package for resting, preheating, temperature and baking time. Prepare the toppings first. Check that the base and centre are cooked; add fresh finishes after baking.')}</p>
     {Object.entries(draft.pizza).filter(([,n])=>n>0).map(([id,n])=><div key={id} style={{...control,marginTop:12}}><strong>{getPizzaById(id)?.name[fr?'fr':'en']||id}</strong>{getPizzaById(id)?.preparationSequence&&<p>{getPizzaById(id)?.preparationSequence?.[fr?'fr':'en']}</p>}{(['before','after'] as const).map(order=><p key={order}><strong>{order==='before'?tr('Avant cuisson : ','Before baking: '):tr('Après cuisson : ','After baking: ')}</strong>{getPizzaById(id)?.ingredients.filter(i=>i.bakeOrder===order).map(i=>i.name[fr?'fr':'en']).join(', ')||'—'}</p>)}<p>{Math.min(draft.done[id]||0,n)} / {n} {tr('servies','served')}</p><button style={control} disabled={(draft.done[id]||0)>=n} onClick={()=>setDraft(d=>({...d,done:{...d.done,[id]:Math.min(n,(d.done[id]||0)+1)}}))}>{tr('Une pizza servie','One pizza served')}</button>{!!draft.done[id]&&<button style={{...control,marginLeft:8}} onClick={()=>setDraft(d=>({...d,done:{...d.done,[id]:Math.max(0,(d.done[id]||0)-1)}}))}>{tr('Annuler','Undo')}</button>}</div>)}
    </section>}
   </>:<SandwichParty key={draft.base} isFr={fr} styleKey={draft.base} snapshot={snapshot} onChange={s=>setDraft(d=>({...d,sandwiches:{...d.sandwiches,[d.base]:s}}))} baseReady doughConfigured onSelectionDone={()=>setDraft(d=>({...d,sandwiches:{...d.sandwiches,[d.base]:{...snapshot,tab:'shop'}}}))} selectionDoneLabel={tr('Voir les courses','View shopping')}/>}
  </>}
 </main>;
}
