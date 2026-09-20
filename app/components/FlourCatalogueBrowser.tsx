'use client';
import {useEffect,useRef,useState} from 'react';
import {useLocale} from 'next-intl';
import {FLOUR_DB,FLOUR_PHOTO_PROVENANCE,type FlourEntry} from '@/lib/flourDatabase';
import {FLOUR_DATA,type FlourKey} from '../data';

export function flourBehaviour(entry:FlourEntry):FlourKey {
 const types:Record<string,FlourKey>={bread:'bread',T65:'bread',T55:'allpurpose',T45:'allpurpose',T80:'bread',T110:'wholemeal',T150:'wholemeal',high_gluten:'manitoba',all_purpose:'allpurpose',allpurpose:'allpurpose',wholemeal:'wholemeal',whole_wheat:'wholemeal',rye:'rye',semolina:'semolina',manitoba:'manitoba'};
 return types[entry.type]||((entry.w??0)>=270?'strong00':'pizza00');
}
export function flourEngineW(entry:FlourEntry){return entry.w??FLOUR_DATA[flourBehaviour(entry)].w;}
const normal=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]/g,' ');
export function matchesFlour(entry:FlourEntry,query:string){const aliases:Record<string,string>={rye:'seigle',wholemeal:'whole wheat complete integrale',bread:'pain bread flour',all_purpose:'all purpose tout usage',spelt:'epeautre',semolina:'semoule semola'};const text=normal([entry.brand,entry.name,entry.type,aliases[entry.type]||''].join(' '));return normal(query).split(/\s+/).filter(Boolean).every(token=>text.includes(token));}
export function flourNumbers(f:FlourEntry,fr:boolean){
 const p=f.proteinSpec;let protein:string;
 if(p?.operator==='range'&&p.min!=null&&p.max!=null)protein=`${p.min}–${p.max}%`;
 else if(p?.value!=null)protein=`${p.operator==='min'?'≥ ':p.operator==='max'?'≤ ':''}${p.value}%`;
 else if(f.proteinRange)protein=`${f.proteinRange[0]}–${f.proteinRange[1]}%`;
 else protein=f.protein==null?(fr?'non publiées':'not published'):`${f.proteinPublished?'':'~'}${f.protein}%`;
 const strength=f.wRange?`W ${f.wRangePublished?'':'~'}${f.wRange[0]}–${f.wRange[1]}`:f.w==null?(fr?'Force non publiée':'Strength not published'):`W ${f.wPublished?'':'~'}${f.w}`;
 return `${strength} · ${fr?'Protéines':'Protein'} ${protein}`;
}
export function FlourProductButton({entry,onChoose,selected=false}:{entry:FlourEntry;onChoose:()=>void;selected?:boolean}){
 const provenance=(FLOUR_PHOTO_PROVENANCE as Record<string,{source?:string;credit?:{author:string;license:string;licenseUrl:string;sourceUrl:string};modifications?:string}>)[entry.id];
 const fr=useLocale()==='fr',dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),[open,setOpen]=useState(false);
 useEffect(()=>{if(open)dialog.current?.showModal();else if(dialog.current?.open)dialog.current.close();},[open]);
 return <><button ref={trigger} type="button" aria-haspopup="dialog" onClick={()=>setOpen(true)} style={{width:'100%',display:'flex',alignItems:'center',gap:14,textAlign:'left',padding:12,minHeight:96,border:'1px solid var(--border)',borderRadius:12,background:selected?'#f4ecdf':'var(--warm)',color:'var(--char)',marginBottom:8}}>
 {entry.bagImage&&<img src={entry.bagImage} alt="" loading="lazy" width={56} height={76} style={{objectFit:'contain'}}/>}<span style={{flex:1,minWidth:0}}><strong style={{display:'block'}}>{entry.brand} {entry.name}</strong><small style={{display:'block',marginTop:6,color:'var(--smoke)'}}>{flourNumbers(entry,fr)}</small></span><span aria-hidden>›</span></button>
 <dialog ref={dialog} onClose={()=>{setOpen(false);trigger.current?.focus();}} style={{margin:'auto',width:'min(92vw,460px)',maxHeight:'85dvh',padding:24,border:'1px solid var(--border)',borderRadius:18,background:'var(--warm)',color:'var(--char)'}} aria-label={`${entry.brand} ${entry.name}`}>
 <button type="button" onClick={()=>setOpen(false)} style={{float:'right',minHeight:44}}>{fr?'Fermer':'Close'}</button><h2>{entry.brand} {entry.name}</h2>
 {entry.bagImage&&<img src={entry.bagImage} alt={`${entry.brand} ${entry.name}`} width={240} height={280} style={{objectFit:'contain',display:'block',margin:'12px auto',maxWidth:'100%'}}/>}
 <p>{flourNumbers(entry,fr)}</p><p>{entry.manufacturerType||entry.type} · {new Intl.DisplayNames([fr?'fr':'en'],{type:'region'}).of(entry.country.toUpperCase())}</p>{entry.specificationNote&&<p>{fr?entry.specificationNote.fr:entry.specificationNote.en}</p>}
 {entry.hydration&&<p>{fr?'Hydratation indicative':'Indicative hydration'} · {entry.hydration[0]}–{entry.hydration[1]}%</p>}
 {entry.w==null&&<p>{fr?`Le calcul utilisera une estimation de type W ~${flourEngineW(entry)}, pas une mesure de cette farine.`:`The calculation will use a type estimate W ~${flourEngineW(entry)}, not a measurement of this flour.`}</p>}
 <button type="button" onClick={()=>{setOpen(false);onChoose();}} style={{width:'100%',minHeight:48,background:'var(--terra)',color:'white',border:0,borderRadius:10}}>{entry.w==null?(fr?'Utiliser avec l’estimation':'Use with type estimate'):(fr?'Choisir cette farine':'Use this flour')}</button>
 {provenance?.credit&&<p style={{fontSize:11,marginTop:12,color:'var(--smoke)'}}><a href={provenance.credit.sourceUrl} target="_blank" rel="noreferrer">{provenance.credit.author}</a> · <a href={provenance.credit.licenseUrl} target="_blank" rel="noreferrer">{provenance.credit.license}</a><br/>{fr?'Image redimensionnée et convertie en WebP.':'Image resized and converted to WebP.'}</p>}
 </dialog></>;
}
export default function FlourCatalogueBrowser({onChoose,recommendedIds,onGeneric,onScan}:{onChoose:(f:FlourEntry)=>void;recommendedIds:string[];onGeneric:()=>void;onScan:()=>void}){
 const fr=useLocale()==='fr',[query,setQuery]=useState(''),[brand,setBrand]=useState(''),[type,setType]=useState(''),[country,setCountry]=useState(''),[all,setAll]=useState(false),[page,setPage]=useState(0),top=useRef<HTMLDivElement>(null);
 const catalog=FLOUR_DB.filter(f=>f.brand!=='Generic'&&!!f.bagImage),active=!!(query||brand||type||country),filtered=catalog.filter(f=>matchesFlour(f,query)&&(!brand||f.brand===brand)&&(!type||f.type===type)&&(!country||f.country===country));
 const picks=recommendedIds.map(id=>catalog.find(f=>f.id===id)).filter((f):f is FlourEntry=>!!f),initial=!active&&!all,list=initial?(picks.length?picks:catalog).slice(0,4):filtered.slice(page*15,page*15+15);
 const field={width:'100%',minHeight:44,border:'1px solid var(--border)',borderRadius:8,background:'white',padding:8,color:'var(--char)'};
 return <div ref={top}>
 <label style={{display:'block',marginBottom:8}}>{fr?'Marque, farine ou type':'Brand, flour or type'}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} placeholder={fr?'Ex. Caputo, T65, complète':'e.g. Caputo, T65, wholemeal'} style={{...field,marginTop:6}}/></label>
 <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:6}}>{[{label:fr?'Marque':'Brand',value:brand,set:setBrand,values:catalog.map(f=>f.brand)},{label:'Type',value:type,set:setType,values:catalog.map(f=>f.type)},{label:fr?'Origine':'Origin',value:country,set:setCountry,values:catalog.map(f=>f.country)}].map(d=><label key={d.label} style={{fontSize:12}}>{d.label}<select value={d.value} style={field} onChange={e=>{d.set(e.target.value);setPage(0);}}><option value="">{fr?'Tous':'All'}</option>{[...new Set(d.values)].sort().map(v=><option key={v} value={v}>{d.label===(fr?'Origine':'Origin')?new Intl.DisplayNames([fr?'fr':'en'],{type:'region'}).of(v.toUpperCase())||v:v}</option>)}</select></label>)}</div>
 {active&&<button type="button" onClick={()=>{setQuery('');setBrand('');setType('');setCountry('');setPage(0);setAll(false);}} style={{minHeight:44}}>{fr?'Tout effacer':'Clear all'}</button>}
 <div style={{display:'flex',gap:10,margin:'12px 0'}}><button type="button" onClick={onGeneric} style={{minHeight:44}}>{fr?'Utiliser un type de farine':'Use a flour type'}</button><button type="button" onClick={onScan} style={{minHeight:44}}>{fr?'Scanner le sac':'Scan bag'}</button></div>
 <h3>{initial?(fr?'Pour votre style':'For your style'):`${filtered.length} ${fr?'résultat(s)':'results'}`}</h3>
 {list.map(f=><FlourProductButton key={f.id} entry={f} onChoose={()=>onChoose(f)}/>)}{!list.length&&<p>{fr?'Aucune farine trouvée. Essayez moins de mots ou retirez un filtre.':'No matching flour. Try fewer words or clear a filter.'}</p>}
 {initial?<button type="button" onClick={()=>setAll(true)} style={{minHeight:44}}>{fr?`Voir les ${catalog.length} farines`:`Browse all ${catalog.length} flours`}</button>:<div style={{display:'flex',gap:10}}>{page>0&&<button type="button" onClick={()=>{setPage(page-1);top.current?.scrollIntoView({block:'start'});}}>{fr?'Précédent':'Previous'}</button>}{(page+1)*15<filtered.length&&<button type="button" onClick={()=>{setPage(page+1);top.current?.scrollIntoView({block:'start'});}}>{fr?'Suivant':'Next'}</button>}</div>}
 </div>;
}
