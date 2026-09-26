'use client';
import {useEffect,useRef,useState} from 'react';
import {useLocale} from 'next-intl';
import {FLOUR_DB,FLOUR_PHOTO_PROVENANCE,type FlourEntry} from '@/lib/flourDatabase';
import {FLOUR_DATA,ALL_STYLES,type FlourKey} from '../data';

export function flourTypeLabel(type:string,fr:boolean){
 const labels:Record<string,[string,string]>={all_purpose:['All-purpose','Tout usage'],bread:['Bread flour','Farine de pain'],bread_flour:['Bread flour','Farine de pain'],french:['French wheat flour','Farine de blé française'],french_wheat_flour:['French wheat flour','Farine de blé française'],wheat:['Wheat','Blé'],whole_spelt:['Whole spelt','Épeautre complet'],whole_wheat:['Whole wheat','Blé complet'],wholemeal:['Whole wheat','Blé complet'],high_gluten:['High-gluten','Farine de force'],pastry:['Pastry','Pâtisserie'],rye:['Rye','Seigle'],semolina:['Semolina','Semoule'],spelt:['Spelt','Épeautre'],'t45_blend':['T45 blend','Mélange T45']};
 const label=labels[type.toLowerCase().replace(/\s+/g,'_')];return label?label[fr?1:0]:/^t\d+$/i.test(type)?type.toUpperCase():type;
}
export function flourBehaviour(entry:FlourEntry):FlourKey {
 const key=entry.type.toLowerCase().replace(/\s+/g,'_');
 const types:Record<string,FlourKey>={bread:'bread',t65:'bread',t55:'allpurpose',t45:'allpurpose',t45_blend:'allpurpose',t80:'bread',t110:'wholemeal',t150:'wholemeal',high_gluten:'manitoba',all_purpose:'allpurpose',allpurpose:'allpurpose',wholemeal:'wholemeal',whole_wheat:'wholemeal',whole_spelt:'wholemeal',rye:'rye',semolina:'semolina',manitoba:'manitoba',pastry:'allpurpose'};
 return types[key]||((entry.w??0)>=270?'strong00':'pizza00');
}
export function flourEngineW(entry:FlourEntry){return entry.w??FLOUR_DATA[flourBehaviour(entry)].w;}
const normal=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]/g,' ').replace(/[’‘]/g,"'");
const brandOption=(brand:string)=>brand.replace(/[’‘]/g,"'");
export const flourTypeOption=(type:string)=>normal(flourTypeLabel(type,false)).replace(/\s+/g,'_');
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
 return <><div style={{border:selected?'2px solid var(--terra)':'1px solid var(--border)',borderRadius:12,background:selected?'#f4ecdf':'var(--warm)',marginBottom:10,overflow:'hidden',display:'flex',alignItems:'center'}}>
 <button type="button" aria-pressed={selected} onClick={onChoose} style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:12,textAlign:'left',padding:12,minHeight:96,border:0,background:'transparent',color:'var(--char)',cursor:'pointer'}}>
 {entry.bagImage&&<img src={entry.bagImage} alt="" loading="lazy" width={56} height={76} style={{objectFit:'contain'}}/>}<span style={{flex:1,minWidth:0}}><strong style={{display:'block'}}>{entry.brand} {entry.name}</strong><small style={{display:'block',marginTop:6,color:'var(--smoke)'}}>{flourNumbers(entry,fr)}</small>{selected&&<span style={{display:'block',marginTop:6,fontSize:14,color:'var(--terra)'}}>{fr?'✓ Farine sélectionnée':'✓ Selected flour'}</span>}</span></button>
 <button ref={trigger} type="button" aria-haspopup="dialog" onClick={()=>setOpen(true)} style={{minHeight:44,minWidth:64,padding:'8px 10px',marginRight:4,border:0,background:'transparent',color:'var(--terra)',fontSize:14,cursor:'pointer',textDecoration:'underline'}} aria-label={`${fr?'Photo et détails':'Photo and details'} · ${entry.brand} ${entry.name}`}>{fr?'Détails':'Details'}</button>
 </div>
 <dialog ref={dialog} onClose={()=>{setOpen(false);trigger.current?.focus({preventScroll:true});}} style={{margin:'auto',width:'min(92vw,460px)',maxHeight:'85dvh',padding:24,border:'1px solid var(--border)',borderRadius:18,background:'var(--warm)',color:'var(--char)'}} aria-label={`${entry.brand} ${entry.name}`}>
 <button type="button" onClick={()=>setOpen(false)} style={{float:'right',minHeight:44}}>{fr?'Fermer':'Close'}</button><h2>{entry.brand} {entry.name}</h2>
 {entry.bagImage&&<img src={entry.bagImage} alt={`${entry.brand} ${entry.name}`} width={240} height={280} loading="lazy" decoding="async" style={{objectFit:'contain',display:'block',margin:'12px auto',maxWidth:'100%'}}/>}
 <p>{flourNumbers(entry,fr)}</p><p>{entry.manufacturerType||flourTypeLabel(entry.type,fr)} · {new Intl.DisplayNames([fr?'fr':'en'],{type:'region'}).of(entry.country.toUpperCase())}</p>{entry.specificationNote&&<p>{fr?entry.specificationNote.fr:entry.specificationNote.en}</p>}
 {entry.hydration&&<p>{fr?'Hydratation indicative':'Indicative hydration'} · {entry.hydration[0]}–{entry.hydration[1]}%</p>}
 {entry.w==null&&<p>{fr?`Le calcul utilisera une estimation de type W ~${flourEngineW(entry)}, pas une mesure de cette farine.`:`The calculation will use a type estimate W ~${flourEngineW(entry)}, not a measurement of this flour.`}</p>}
 <button type="button" onClick={()=>{setOpen(false);onChoose();}} style={{width:'100%',minHeight:48,background:'var(--terra)',color:'white',border:0,borderRadius:10}}>{entry.w==null?(fr?'Utiliser avec l’estimation':'Use with type estimate'):(fr?'Utiliser cette farine':'Use this flour')}</button>
 {provenance?.credit&&<p style={{fontSize:11,marginTop:12,color:'var(--smoke)'}}><a href={provenance.credit.sourceUrl} target="_blank" rel="noreferrer">{provenance.credit.author}</a> · <a href={provenance.credit.licenseUrl} target="_blank" rel="noreferrer">{provenance.credit.license}</a><br/>{fr?'Image redimensionnée et convertie en WebP.':'Image resized and converted to WebP.'}</p>}
 </dialog></>;
}
export default function FlourCatalogueBrowser({onChoose,recommendedIds,onGeneric,onScan,styleKey}:{onChoose:(f:FlourEntry)=>void;recommendedIds:string[];onGeneric:()=>void;onScan:()=>void;styleKey?:string}){
 const fr=useLocale()==='fr',[query,setQuery]=useState(''),[brand,setBrand]=useState(''),[type,setType]=useState(''),[country,setCountry]=useState(''),[limit,setLimit]=useState(()=>Math.min(4,recommendedIds.filter(id=>FLOUR_DB.some(f=>f.id===id&&f.brand!=='Generic'&&f.bagImage)).length)||4);
 const catalog=FLOUR_DB.filter(f=>f.brand!=='Generic'&&!!f.bagImage),active=!!(query||brand||type||country);
 const ordered=orderFlourCatalogue(catalog,recommendedIds);
 const filtered=ordered.filter(f=>matchesFlour(f,query)&&(!brand||brandOption(f.brand)===brand)&&(!type||flourTypeOption(f.type)===type)&&(!country||f.country===country));
 const list=filtered.slice(0,limit),style=ALL_STYLES[styleKey as keyof typeof ALL_STYLES],styleLabel=style?(fr?style.nameFr:style.name):'';
 const field={width:'100%',fontSize:16,minHeight:44,height:44,border:'1px solid var(--border)',borderRadius:8,background:'white',padding:8,color:'var(--char)'};
 return <div>
 <label style={{display:'block',marginBottom:12}}>{fr?'Rechercher une marque, un produit ou un type':'Search a brand, product or flour type'}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(15);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} placeholder={fr?'Ex. Caputo, T65, complète':'e.g. Caputo, T65, wholemeal'} style={{...field,marginTop:6}}/></label>
 <div aria-label={fr?'Filtres':'Filters'} style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>{[{label:fr?'Marque':'Brand',value:brand,set:setBrand,values:catalog.map(f=>brandOption(f.brand))},{label:'Type',value:type,set:setType,values:catalog.map(f=>flourTypeOption(f.type))},{label:fr?'Pays':'Country',value:country,set:setCountry,values:catalog.map(f=>f.country)}].map(d=><label key={d.label} style={{fontSize:14,fontWeight:d.value?600:400}}>{d.label}<select value={d.value} style={{...field,marginTop:4,borderColor:d.value?'var(--terra)':'var(--border)',background:d.value?'#f4ecdf':'white'}} onChange={e=>{d.set(e.target.value);setLimit(15);}}><option value="">{fr?'Tous':'All'}</option>{[...new Set(d.values)].sort().map(v=><option key={v} value={v}>{d.label===(fr?'Pays':'Country')?new Intl.DisplayNames([fr?'fr':'en'],{type:'region'}).of(v.toUpperCase())||v:d.label==='Type'?flourTypeLabel(v,fr):v}</option>)}</select></label>)}</div>
 {active&&<button type="button" onClick={()=>{setQuery('');setBrand('');setType('');setCountry('');setLimit(4);}} style={{minHeight:44}}>{fr?'Effacer la recherche et les filtres':'Clear search and filters'}</button>}
 <div style={{display:'flex',flexWrap:'wrap',gap:10,margin:'12px 0'}}><button type="button" onClick={onScan} style={{minHeight:44,padding:'10px 12px',border:'1px solid var(--border)',borderRadius:9,fontSize:14}}>{fr?'Scanner mon sac':'Scan my bag'}</button><button type="button" onClick={onGeneric} style={{minHeight:44,padding:'10px 12px',border:'1px solid var(--border)',borderRadius:9,fontSize:14}}>{fr?'Saisir ma farine':'Enter my flour'}</button></div>
 <h3 style={{fontSize:16,fontWeight:600,margin:'20px 0 10px'}}>{active?`${filtered.length} ${fr?'résultats':'results'}`:(limit>4?(fr?'Catalogue':'Catalogue'):(fr?`Choix courants${styleLabel?' · '+styleLabel:' pour ce style'}`:`Common choices${styleLabel?' · '+styleLabel:' for this style'}`))}</h3>
 {list.map(f=><FlourProductButton key={f.id} entry={f} onChoose={()=>onChoose(f)}/>)}{!list.length&&<p>{fr?'Aucune farine trouvée. Essayez moins de mots ou retirez un filtre.':'No matching flour. Try fewer words or clear a filter.'}</p>}
 {list.length<filtered.length&&<button type="button" onClick={()=>setLimit(limit+15)} style={{minHeight:44,width:'100%',border:'1px solid var(--border)',borderRadius:9}}>{fr?'Afficher plus de farines':'Show more flours'}</button>}
 </div>;
}
export function orderFlourCatalogue(catalog:FlourEntry[],recommendedIds:string[]){
 const rank=new Map(recommendedIds.map((id,index)=>[id,index]));
 return [...catalog].sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
}
