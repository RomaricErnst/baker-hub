'use client';
import {useCallback,useEffect,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import SandwichParty from './SandwichParty';
import PizzaParty from './PizzaParty';
import BakeNavigator from './BakeNavigator';
import Header from './Header';
import {BAKE_DESTINATIONS,type BakeDestination} from '../lib/bakeNavigation';
import {aggregateSandwichShopping,createSandwichSnapshot,normalizeSandwichSnapshot,sandwichFamilyForStyle,type SandwichSnapshot} from '../lib/sandwich';
import {getPizzaById} from '../lib/toppingDatabase';

const STORAGE='bh_existing_base_v1';
const bases=[['pizza','Pizza','Pizza'],['pain_campagne','Pain de campagne · tartines','Country bread · tartines'],['pain_mie','Pain de mie · clubs & croques','Sandwich loaf · clubs & croques'],['pita','Pitas','Pitas'],['laffa','Wraps souples','Soft wraps'],['baguette','Baguette','Baguette'],['focaccia','Focaccia','Focaccia'],['ciabatta','Ciabatta','Ciabatta'],['bagel','Bagels','Bagels']];
type Phase='pick'|'shop'|'prep'|'bake';
type BaseDetails={kind:'dough'|'baked';origin:'purchased'|'homemade';stage:'bulk'|'shaped'|'ready';baked:boolean;notes:string};
type Draft={base:string;portions:number;pizza:Record<string,number>;done:Record<string,number>;section:BakeDestination;sandwiches:Record<string,SandwichSnapshot>;details:Record<string,BaseDetails>};
const fresh=():Draft=>({base:'',portions:4,pizza:{},done:{},section:'batch',sandwiches:{},details:{}});
const defaultDetails=(base:string):BaseDetails=>({kind:base==='pizza'?'dough':'baked',origin:'purchased',stage:'ready',baked:false,notes:''});
const quantities=(value:unknown)=>Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).filter(([id,n])=>!!getPizzaById(id)&&typeof n==='number'&&Number.isFinite(n)).map(([id,n])=>[id,Math.min(99,Math.max(0,Math.floor(Number(n))))]));
const sectionForPhase=(phase:string):BakeDestination=>phase==='shop'?'shopping':phase==='prep'?'protocol':phase==='bake'||phase==='serve'?'service':'batch';
export default function ExistingBaseJourney(){
 const locale=useLocale(),t=useTranslations(),fr=locale==='fr';
 const tr=(a:string,b:string)=>fr?a:b;
 const [draft,setDraft]=useState<Draft>(fresh),[loaded,setLoaded]=useState(false),[editing,setEditing]=useState(false);
 useEffect(()=>{
   try{
     const d=JSON.parse(localStorage.getItem(STORAGE)||'null');
     if(d&&bases.some(b=>b[0]===d.base)){
       const sandwiches=Object.fromEntries(bases.filter(b=>b[0]!=='pizza').map(b=>[b[0],normalizeSandwichSnapshot(d.sandwiches?.[b[0]])]));
       const details=Object.fromEntries(bases.map(([base])=>{const value=d.details?.[base];return [base,{kind:value?.kind==='dough'?'dough':value?.kind==='baked'?'baked':defaultDetails(base).kind,origin:value?.origin==='homemade'?'homemade' as const:'purchased' as const,stage:['bulk','shaped','ready'].includes(value?.stage)?value.stage:'ready',baked:value?.baked===true,notes:typeof value?.notes==='string'?value.notes.slice(0,2000):''}];}));
       setDraft({base:d.base,portions:Math.min(99,Math.max(1,Number(d.portions)||4)),pizza:quantities(d.pizza),done:quantities(d.done),section:BAKE_DESTINATIONS.some(s=>s.id===d.section)?d.section:sectionForPhase(d.base==='pizza'?d.phase:sandwiches[d.base]?.tab),sandwiches,details});
     }
   }catch{}
   const pop=()=>{const section=new URLSearchParams(location.search).get('section');if(BAKE_DESTINATIONS.some(s=>s.id===section))setDraft(d=>({...d,section:section as BakeDestination}));};
   pop();window.addEventListener('popstate',pop);setLoaded(true);
   return()=>window.removeEventListener('popstate',pop);
 },[]);
 useEffect(()=>{if(loaded)try{localStorage.setItem(STORAGE,JSON.stringify(draft));}catch{}},[draft,loaded]);
 const go=(section:BakeDestination)=>{
   const url=new URL(location.href);
   if(url.searchParams.get('section')!==draft.section){url.searchParams.set('section',draft.section);history.replaceState(history.state,'',url);}
   url.searchParams.set('section',section);history.pushState(history.state,'',url);
   setDraft(d=>({...d,section}));window.scrollTo({top:0,behavior:'smooth'});
 };
 const setPizza=useCallback((pizza:Record<string,number>)=>setDraft(d=>JSON.stringify(d.pizza)===JSON.stringify(pizza)?d:{...d,pizza}),[]);
 const setPhase=(phase:Phase|string)=>go(sectionForPhase(phase));
 const current=draft.sandwiches[draft.base];
 const snapshot=current?.familyId===sandwichFamilyForStyle(draft.base)?current:createSandwichSnapshot(sandwichFamilyForStyle(draft.base));
 const detail=draft.details[draft.base]??defaultDetails(draft.base);
 const updateDetail=(patch:Partial<BaseDetails>)=>setDraft(d=>({...d,details:{...d.details,[d.base]:{...(d.details[d.base]??defaultDetails(d.base)),...patch}}}));
 const raw=detail.kind==='dough',needsBake=raw&&!detail.baked;
 const phase:Phase=draft.section==='shopping'?'shop':draft.section==='protocol'?'prep':draft.section==='service'?'bake':'pick';
 const control={maxWidth:'100%',minHeight:44,padding:'12px 16px',border:'1px solid var(--border)',borderRadius:12,background:'var(--card)',color:'var(--char)',fontSize:16};
 const instructions=detail.origin==='purchased'?tr('Suivez l’emballage pour le repos, le préchauffage, la température et la durée.','Follow the package for resting, preheating, temperature and baking time.'):tr('Suivez votre recette d’origine pour le repos, la fermentation, la température et la durée de cuisson.','Follow your original recipe for resting, fermentation, baking temperature and duration.');
 const prep=<section><h2>{tr('Votre pâte existante','Your existing dough')}</h2><p>{instructions}</p><p>{tr('Son historique de fermentation est inconnu : Bakerhub ne calcule pas de nouveaux temps de levée pour cette pâte.','Its fermentation history is unknown: Bakerhub does not calculate new rising times for this dough.')}</p>
   {detail.stage==='bulk'&&<p>{tr('Terminez la fermentation prévue, puis divisez et façonnez selon votre recette.','Finish the planned fermentation, then divide and shape according to your recipe.')}</p>}
   {detail.stage!=='ready'&&<p>{tr('Attendez la fin de l’apprêt prévu avant de cuire.','Wait until the final proof in your recipe is complete before baking.')}</p>}
   {draft.base==='bagel'&&<p>{tr('Avant la cuisson au four, pochez les bagels selon votre recette, sauf si cette étape a déjà été faite.','Before oven baking, poach the bagels according to your recipe, unless already done.')}</p>}
   {detail.notes&&<p style={{whiteSpace:'pre-wrap'}}>{detail.notes}</p>}
 </section>;
 if(!loaded)return <main style={{padding:24}}>{tr('Chargement…','Loading…')}</main>;
 return <><Header hideActionBar onBack={()=>draft.section==='batch'?location.assign('/'+locale):go('batch')}/>
 <main style={{maxWidth:850,margin:'0 auto',padding:'16px 16px 120px',fontFamily:'var(--font-ui)',color:'var(--char)'}}>
  <BakeNavigator active={draft.section} fr={fr} onChange={go}/>
  {(!draft.base||editing)?<section aria-label={tr('Votre base','Your base')}>
   <h1>{tr('Qu’avez-vous ?','What do you have?')}</h1>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10}}>{bases.map(([id,frName,enName])=><button key={id} style={control} onClick={()=>{setDraft(d=>({...d,base:id,section:'batch'}));setEditing(false);}}>{fr?frName:enName}</button>)}</div>
   {editing&&<button style={{...control,marginTop:12}} onClick={()=>setEditing(false)}>{tr('Revenir à ma préparation','Return to my preparation')}</button>}
  </section>:<>
   <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',margin:'20px 0'}}><strong>{bases.find(b=>b[0]===draft.base)?.[fr?1:2]} · {raw?tr('Pâte existante','Existing dough'):tr('Déjà cuit','Already baked')}</strong><button style={control} onClick={()=>setEditing(true)}>{tr('Changer de base','Change base')}</button></div>
   {(draft.section==='batch'||draft.section==='organisation')&&<section>
     <h2>{tr('Votre point de départ','Your starting point')}</h2>
     <label>{tr('État de la base','Base state')} <select style={control} value={detail.kind} onChange={e=>updateDetail({kind:e.target.value as BaseDetails['kind'],baked:false})}><option value="dough">{tr('Pâte à préparer et cuire','Dough to prepare and bake')}</option><option value="baked">{tr('Pain / base déjà cuit','Already baked bread / base')}</option></select></label>
     <label style={{display:'block',marginTop:12}}>{tr('Origine','Source')} <select style={control} value={detail.origin} onChange={e=>updateDetail({origin:e.target.value as BaseDetails['origin']})}><option value="purchased">{tr('Achetée','Purchased')}</option><option value="homemade">{tr('Faite maison','Homemade')}</option></select></label>
     {raw&&<><label style={{display:'block',marginTop:12}}>{tr('Avancement','Progress')} <select style={control} value={detail.stage} onChange={e=>updateDetail({stage:e.target.value as BaseDetails['stage'],baked:false})}><option value="bulk">{tr('À diviser / façonner','Needs dividing / shaping')}</option><option value="shaped">{tr('Façonnée, apprêt à terminer','Shaped, final proof remaining')}</option><option value="ready">{tr('Prête à cuire','Ready to bake')}</option></select></label><p>{instructions}</p></>}
     {draft.section==='organisation'&&<><p>{raw?tr('Gardez les consignes de votre pâte. Aucune fabrication de pâte à recommencer.','Keep your dough’s instructions. No need to make dough again.'):tr('Aucune fermentation ni cuisson du pain à planifier. Passez directement aux garnitures et à l’assemblage.','No bread fermentation or baking to plan. Go straight to fillings and assembly.')}</p><label>{tr('Mes consignes (facultatif)','My instructions (optional)')}<textarea maxLength={2000} value={detail.notes} onChange={e=>updateDetail({notes:e.target.value})} style={{...control,width:'100%',boxSizing:'border-box'}}/></label><button style={control} onClick={()=>go('protocol')}>{tr('Préparer','Prepare')}</button></>}
   </section>}
   {draft.section==='recipe'&&<section><h2>{tr('Ingrédients de mes garnitures','My filling ingredients')}</h2><p>{tr('La pâte ou le pain est déjà disponible : seuls les ingrédients sélectionnés ci-dessous restent à prévoir.','The dough or bread is already available: only the selected filling ingredients below are needed.')}</p>
     {draft.base==='pizza'?Object.entries(draft.pizza).filter(([,n])=>n>0).map(([id,n])=><div key={id}><h3>{n} × {getPizzaById(id)?.name[fr?'fr':'en']}</h3><p>{getPizzaById(id)?.ingredients.map(i=>i.name[fr?'fr':'en']).join(', ')}</p></div>):<ul>{aggregateSandwichShopping(snapshot.qtys,snapshot.ingredientOverrides,snapshot.familyId).map(i=><li key={i.key}>{i.name[fr?'fr':'en']} · {i.grams.toLocaleString(fr?'fr-FR':'en-GB')} g</li>)}</ul>}
     <button style={control} onClick={()=>go('shopping')}>{tr('Voir les quantités et les courses','View quantities and shopping')}</button>
   </section>}
   {draft.section==='protocol'&&raw&&prep}
   {draft.section==='service'&&needsBake&&<>{prep}<h2>{draft.base==='pizza'?tr('Préparer et cuire','Prepare and bake'):tr('Cuire avant de garnir','Bake before filling')}</h2><p>{tr('Vérifiez la cuisson du centre et du dessous. Pour du pain à garnir, laissez-le refroidir avant l’assemblage.','Check the centre and underside are baked. Let sandwich bread cool before assembly.')}</p>{draft.base!=='pizza'&&<button style={control} onClick={()=>updateDetail({baked:true})}>{tr('Mon pain est cuit et refroidi','My bread is baked and cooled')}</button>}</>}
   {draft.section==='service'&&raw&&detail.baked&&draft.base!=='pizza'&&<button style={control} onClick={()=>updateDetail({baked:false})}>{tr('Annuler « pain cuit »','Undo “bread baked”')}</button>}
   {!['organisation','recipe'].includes(draft.section)&&(draft.base==='pizza'?<>
    {draft.section==='batch'&&<label style={{display:'flex',gap:12,alignItems:'center',margin:'16px 0'}}>{tr('Pizzas à garnir','Pizzas to top')}<input aria-label={tr('Pizzas à garnir','Pizzas to top')} style={{...control,width:85}} type="number" min={1} max={99} value={draft.portions} onChange={e=>setDraft(d=>({...d,portions:Math.min(99,Math.max(1,Math.floor(Number(e.target.value)||1)))}))}/></label>}
    {phase!=='bake'?<PizzaParty locale={locale} t={t} numItems={draft.portions} bakeTime={new Date()} activeTab={phase} onTabChange={setPhase} initialQtys={draft.pizza} onQtysSnapshot={setPizza} doughConfigured baseReady storagePrefix="bh_existing_base" onGoToMyDough={()=>go('batch')} onSelectionDone={()=>go('shopping')} selectionDoneLabel={tr('Voir les courses','View shopping')}/>:<section>
     <h2>{raw?tr('Cuire et servir vos pizzas','Bake and serve your pizzas'):tr('Garnir et réchauffer vos bases cuites','Top and reheat your baked bases')}</h2>
     <p>{instructions} {tr('Ajoutez les finitions fraîches après cuisson ou réchauffage.','Add fresh finishes after baking or reheating.')}</p>
     {Object.entries(draft.pizza).filter(([,n])=>n>0).map(([id,n])=><div key={id} style={{...control,marginTop:12}}><strong>{getPizzaById(id)?.name[fr?'fr':'en']||id}</strong>{getPizzaById(id)?.preparationSequence&&<p>{getPizzaById(id)?.preparationSequence?.[fr?'fr':'en']}</p>}{(['before','after'] as const).map(order=><p key={order}><strong>{order==='before'?tr('Avant cuisson : ','Before baking: '):tr('Après cuisson : ','After baking: ')}</strong>{getPizzaById(id)?.ingredients.filter(i=>i.bakeOrder===order).map(i=>i.name[fr?'fr':'en']).join(', ')||'—'}</p>)}<p>{Math.min(draft.done[id]||0,n)} / {n} {tr('servies','served')}</p><button style={control} disabled={(draft.done[id]||0)>=n} onClick={()=>setDraft(d=>({...d,done:{...d.done,[id]:Math.min(n,(d.done[id]||0)+1)}}))}>{tr('Une pizza cuite et servie','One pizza baked and served')}</button>{!!draft.done[id]&&<button style={{...control,marginLeft:8}} onClick={()=>setDraft(d=>({...d,done:{...d.done,[id]:Math.max(0,(d.done[id]||0)-1)}}))}>{tr('Annuler','Undo')}</button>}</div>)}
    </section>}
   </>:draft.section==='service'&&needsBake?null:<SandwichParty key={draft.base} isFr={fr} styleKey={draft.base} snapshot={snapshot} onChange={s=>setDraft(d=>({...d,sandwiches:{...d.sandwiches,[d.base]:s}}))} hideNavigation baseReady deferBreadSteps={raw} doughConfigured phase={phase==='bake'?'serve':phase} onPhaseChange={setPhase} onSelectionDone={()=>go('shopping')} selectionDoneLabel={tr('Voir les courses','View shopping')}/> )}
   {draft.section==='protocol'&&<button style={{...control,marginTop:16}} onClick={()=>go('service')}>{tr('Cuisson & service','Cooking & serving')} →</button>}
  </>}
 </main></>;
}
