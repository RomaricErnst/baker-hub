'use client';
import { type MixerType } from '../data';
import { getBreadProtocol } from '../utils/breadProfiles';
import DecisionList from './DecisionList';

/** A compact household choice; saved specialist methods remain available. */
export default function SimpleMixerPicker({selected,onSelect,styleKey,locale}:{selected:MixerType|null;onSelect:(value:MixerType)=>void;styleKey?:string;locale:string}) {
  const fr=locale==='fr';
  const profile=styleKey?getBreadProtocol(styleKey):undefined;
  const options=[
    {id:'hand',image:'/images/approved/equipment-v2/hand-kneading.webp',title:fr?'À la main':'By hand',tagline:fr?'Un saladier et vos mains':'A bowl and your hands'},
    {id:'stand',image:'/images/approved/equipment-v2/stand-mixer.webp',title:fr?'KitchenAid / robot pâtissier':'KitchenAid / stand mixer',tagline:fr?'Avec le crochet pétrisseur':'Use the dough hook'},
    {id:'no_knead',image:'/images/approved/equipment-v2/no-knead.webp',title:fr?'Sans pétrissage':'No knead',tagline:fr?'Repos et rabats':'Rest and fold'},
    {id:'spiral',image:'/images/approved/equipment-v2/spiral-mixer-v3.webp',title:fr?'Pétrin à spirale':'Spiral mixer',tagline:fr?'Équipement spécialisé':'Specialist equipment'},
  ].filter(option=>!profile||profile.supportedMixers.includes(option.id as MixerType));
  const picker=(other:boolean)=><DecisionList layout="illustrated" options={options.filter(option=>(option.id==='spiral'||option.id==='no_knead')===other)} selectedId={selected??''} onSelect={id=>onSelect(id as MixerType)}/>;
  return <>{picker(false)}<details open={selected==='spiral'||selected==='no_knead'?true:undefined} style={{marginTop:12}}><summary style={{minHeight:44,cursor:'pointer',fontSize:16}}>{fr?'Autre méthode':'Other method'}</summary>{picker(true)}</details></>;
}
