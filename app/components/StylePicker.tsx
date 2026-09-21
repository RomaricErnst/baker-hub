'use client';
import Image from 'next/image';
import {useLocale,useTranslations} from 'next-intl';
import {PIZZA_STYLES,BREAD_STYLES,type StyleKey,type BakeType} from '../data';
interface StylePickerProps{bakeType:BakeType;selected:StyleKey|null;onSelect:(key:StyleKey)=>void;disabledIds?:string[];disabledNote?:string;}
export default function StylePicker({bakeType,selected,onSelect,disabledIds=[],disabledNote}:StylePickerProps){
 const fr=useLocale()==='fr',t=useTranslations('style');
 const styles=bakeType==='bread'?BREAD_STYLES:PIZZA_STYLES;
 return <div style={{display:'grid',gap:10}}>{Object.entries(styles).map(([key,s])=>{
  const disabled=disabledIds.includes(key),active=selected===key;
  const title=bakeType==='pizza'?t(`${key}.title`):(fr&&'nameFr' in s?s.nameFr:s.name);
  const description=bakeType==='pizza'?t(`${key}.tagline`):(fr&&'descFr' in s?s.descFr:s.desc);
  return <div key={key}><button className="dough-style-card" type="button" disabled={disabled} aria-pressed={active} onClick={()=>onSelect(key as StyleKey)}
   style={{display:'grid',alignItems:'center',gap:12,width:'100%',textAlign:'left',padding:12,border:active?'2px solid var(--terra)':'1px solid var(--border)',borderRadius:12,background:active?'#f4ecdf':'var(--card)',color:'var(--char)',cursor:disabled?'not-allowed':'pointer',opacity:disabled?.55:1}}>
   <Image src={s.image} alt="" width={800} height={500} sizes="(max-width: 600px) 120px, 160px" style={{width:'100%',height:'auto',aspectRatio:'1',objectFit:'contain',background:'#f3ede3',borderRadius:8}}/>
   <span><strong style={{display:'block',fontSize:16}}>{title}</strong>{active&&<span style={{display:'block',color:'var(--terra)',fontSize:12,fontWeight:600,marginTop:4}}><span aria-hidden="true">✓ </span>{fr?'Sélectionné':'Selected'}</span>}<span style={{display:'block',fontSize:13,lineHeight:1.5,color:'var(--ash)',marginTop:4}}>{description}</span></span>
  </button>{disabled&&disabledNote&&<p style={{fontSize:12,color:'var(--smoke)',marginTop:4}}>{disabledNote}</p>}</div>;
 })}</div>;
}
