'use client';
import Image from 'next/image';
import {useLocale,useTranslations} from 'next-intl';
import {PIZZA_STYLES,BREAD_STYLES,type StyleKey,type BakeType} from '../data';
import {BREAD_GROUPS,BREAD_MEAL_EXAMPLES} from '../lib/breadNavigation';
import {sandwichFamilyForStyle} from '../lib/sandwich';
interface StylePickerProps{bakeType:BakeType;selected:StyleKey|null;onSelect:(key:StyleKey)=>void;disabledIds?:string[];disabledNote?:string;}
export default function StylePicker({bakeType,selected,onSelect,disabledIds=[],disabledNote}:StylePickerProps){
 const fr=useLocale()==='fr',t=useTranslations('style');
 const bread=bakeType==='bread';
 const styles:Record<string,{name:string;nameFr?:string;desc:string;descFr?:string;image:string}>=bread?BREAD_STYLES:PIZZA_STYLES;
 function card(key:string){
  const s=styles[key];if(!s)return null;
  const disabled=disabledIds.includes(key),active=selected===key;
  const title=key==='laffa'?(fr?'Pain à wrap · Laffa':'Wrap bread · Laffa'):key==='piadina'?(fr?'Galette à garnir · Piadina':'Flatbread · Piadina'):!bread?t(`${key}.title`):(fr&&'nameFr' in s?s.nameFr:s.name);
  const description=key==='laffa'?(fr?'Grand pain souple à rouler autour de votre garniture.':'Large, soft bread to roll around your filling.'):key==='piadina'?(fr?'Galette italienne à garnir et plier comme un wrap.':'Italian flatbread to fill and fold like a wrap.'):!bread?t(`${key}.tagline`):(fr&&'descFr' in s?s.descFr:s.desc);
  const family=sandwichFamilyForStyle(key);
  const meal=bread?BREAD_MEAL_EXAMPLES[key]:undefined;
  const use=bread?(family==='tartine'?(fr?'Pain seul · tartines':'Bread on its own · tartines'):family==='laffa'||family==='piadina'?(fr?'Pain seul · wraps':'Bread on its own · wraps'):family?(fr?'Pain seul · sandwichs':'Bread on its own · sandwiches'):(fr?'Pain seul':'Bread on its own')):null;
  return <div key={key}><button className={`dough-style-card${bread?' bh-bread-style-card':''}`} type="button" aria-label={title} disabled={disabled} aria-pressed={active} onClick={()=>onSelect(key as StyleKey)}
   style={{display:'grid',alignItems:'center',gap:12,width:'100%',height:'100%',textAlign:'left',padding:12,border:active?'2px solid var(--terra)':'1px solid var(--border)',borderRadius:12,background:active?'#f4ecdf':'var(--card)',color:'var(--char)',cursor:disabled?'not-allowed':'pointer',opacity:disabled?.55:1}}>
   {bread?<span className={`bh-bread-photos${meal?' bh-bread-photos-pair':''}`}>
    <span className="bh-bread-photo"><span className="bh-bread-photo-frame"><Image src={s.image} alt="" fill sizes="(max-width:700px) 50vw, 220px" style={{objectFit:'cover',objectPosition:'center'}}/></span><span className="bh-bread-photo-caption">{fr?'Le pain':'The bread'}</span></span>
    {meal&&<span className="bh-bread-photo"><span className="bh-bread-photo-frame"><Image src={meal.image??`/images/approved/sandwich/${meal.recipeId}.webp`} alt="" fill sizes="(max-width:700px) 50vw, 220px" style={{objectFit:'cover',objectPosition:'center'}}/></span><span className="bh-bread-photo-caption">{fr?(meal.kind==='tartine'?'Idée tartine':meal.kind==='wrap'?'Idée wrap':'Idée sandwich'):(meal.kind==='tartine'?'Tartine idea':meal.kind==='wrap'?'Wrap idea':'Sandwich idea')}</span></span>}
   </span>:<Image src={s.image} alt="" width={800} height={500} sizes="(max-width: 600px) 120px, 160px" style={{width:'100%',height:'auto',aspectRatio:'1',objectFit:'contain',background:'#f3ede3',borderRadius:8}}/>}
   <span className={bread?'bh-bread-card-copy':undefined} style={{minWidth:0}}><strong style={{display:'block',fontSize:16}}>{title}</strong>{active&&<span style={{display:'block',color:'var(--terra)',fontSize:12,fontWeight:600,marginTop:4}}><span aria-hidden="true">✓ </span>{fr?'Sélectionné':'Selected'}</span>}<span style={{display:'block',fontSize:13,lineHeight:1.5,color:'var(--ash)',marginTop:4}}>{description}</span>{!meal&&use&&<span style={{display:'block',fontSize:12,fontWeight:600,color:'var(--terra)',marginTop:6}}>{use}</span>}</span>
  </button>{disabled&&disabledNote&&<p style={{fontSize:12,color:'var(--smoke)',marginTop:4}}>{disabledNote}</p>}</div>;
 }
 if(!bread)return <div style={{display:'grid',gap:10}}>{Object.keys(styles).map(card)}</div>;
 return <div>
  <p style={{fontSize:15,color:'var(--smoke)',marginTop:0}}>{fr?'Les garnitures sont proposées ensuite, si vous en voulez.':'Optional fillings come next, if you want them.'}</p>
  <nav className="bh-bread-jumps" aria-label={fr?'Aller à un groupe de pains':'Jump to a bread group'}>{BREAD_GROUPS.map((item,index)=><a key={item.id} href={`#bread-group-${item.id}`}>{(fr?['À trancher','À garnir','Pitas & wraps','Moelleux & partage']:['Loaves','Sandwich breads','Pitas & wraps','Soft & sharing'])[index]}</a>)}</nav>
  {BREAD_GROUPS.map(item=><section className="bh-bread-group" key={item.id} aria-labelledby={`bread-group-${item.id}`} style={{marginBottom:24}}><h3 className="bh-bread-group" id={`bread-group-${item.id}`} style={{fontSize:18,margin:'0 0 10px'}}>{fr?item.fr:item.en}</h3><div className="bh-bread-group-grid">{item.keys.map(card)}</div></section>)}
 </div>;
}
