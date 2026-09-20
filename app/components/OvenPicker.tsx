'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type AnyOvenType } from '../data';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

const BREAD_OVEN_EXCLUDES: Record<string, string[]> = {
  baguette:      ['dutch_oven'],
  fougasse:      ['dutch_oven'],
  brioche:       ['dutch_oven', 'home_oven_stone_bread'],
  pain_mie:      ['dutch_oven', 'home_oven_stone_bread'],
  pain_viennois: ['dutch_oven', 'home_oven_stone_bread'],
  pain_seigle:   ['dutch_oven', 'home_oven_stone_bread'],
};

interface OvenPickerProps {
  bakeType: 'pizza' | 'bread';
  styleKey?: string | null;
  selected: AnyOvenType | null;
  onSelect: (oven: AnyOvenType) => void;
  /** Pre-fill a sensible default WITHOUT advancing the step.
   *  onSelect advances the flow, so it must only run on a real user tap —
   *  calling it from the mount effect made the oven step skip itself. */
  onPreselect?: (oven: AnyOvenType) => void;
}

export default function OvenPicker({ bakeType, styleKey, selected, onSelect, onPreselect }: OvenPickerProps) {
  const t = useTranslations('oven');
  const locale = useLocale();
  // Collapsing on select made sense when picking an oven advanced to the next
  // card: the finished card folded away and you never looked at it again. On
  // the merged Equipment page the baker stays put, so two things changed.
  //
  // 1. Start collapsed when a choice already exists. Revisiting the page to
  //    change something now shows both halves as summaries at once, instead of
  //    two long image lists stacked.
  // 2. Collapse after a beat, not instantly — otherwise the tile vanishes
  //    before the baker sees their own tap register.
  const [expanded, setExpanded] = useState(selected == null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); }, []);

  // This switches advice only; both designs retain the same pizza-oven calculation profile.
  const [construction, setConstruction] = useState<'tabletop' | 'masonry'>('tabletop');
  const ovenAdvice = selected === 'pizza_oven' ? <div style={{marginTop:12,padding:12,border:'1px solid var(--border)',borderRadius:12}}>
    <p style={{margin:'0 0 8px',fontSize:13}}>{locale==='fr'?'Votre four ressemble à…':'Which oven looks like yours?'}</p>
    <div role="group" aria-label={locale==='fr'?'Conseils par construction':'Advice by oven construction'} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
      {(['tabletop','masonry'] as const).map(kind=><button key={kind} type="button" aria-pressed={construction===kind} onClick={()=>setConstruction(kind)} style={{padding:5,border:construction===kind?'2px solid var(--terra)':'1px solid var(--border)',borderRadius:9,background:'transparent',color:'inherit'}}>
        <img src={`/images/approved/equipment-v2/${kind==='tabletop'?'portable-gas-oven':'masonry-oven'}.webp`} alt="" style={{width:'100%',height:85,objectFit:'cover',borderRadius:5}} />
        {kind==='tabletop'?(locale==='fr'?'Four de table':'Tabletop'):(locale==='fr'?'Four maçonné':'Brick / masonry')}
      </button>)}
    </div>
    <p style={{fontSize:12,margin:'8px 0 0'}}>{construction==='tabletop'?(locale==='fr'?'Suivez le préchauffage du fabricant ; contrôlez la sole avant chaque pizza.':'Follow the maker’s preheat guidance; check the floor before each pizza.'):(locale==='fr'?'Laissez la maçonnerie accumuler la chaleur ; une flamme chaude ne suffit pas à chauffer la sole.':'Allow the masonry to store heat; a hot flame alone does not mean the floor is ready.')}</p>
    <p style={{fontSize:11,color:'var(--smoke)',margin:'6px 0 0'}}>{locale==='fr'?'Conseil uniquement — même profil de cuisson.':'Advice only — same baking profile.'}</p>
  </div> : null;

  const pizzaOptions = [
    { id: 'pizza_oven',         image: '/images/approved/equipment-v2/portable-gas-oven.webp',           title: t('pizzaOven.title'),     tagline: t('pizzaOven.tagline') },
    { id: 'home_oven_steel',    image: '/images/approved/equipment-v2/home-oven-steel.webp',          title: t('homeSteel.title'),     tagline: t('homeSteel.tagline') },
    { id: 'home_oven_standard', image: '/images/approved/equipment-v2/home-oven-standard.webp',       title: t('homeStandard.title'),  tagline: t('homeStandard.tagline') },
    { id: 'electric_pizza',     image: '/images/approved/equipment-v2/electric-pizza-oven-v3.webp',       title: t('electricPizza.title'), tagline: t('electricPizza.tagline') },
  ];

  const allBreadOptions = [
    { id: 'dutch_oven',            image: '/images/approved/equipment-v2/dutch-oven.webp',          title: t('dutchOven.title'),  tagline: t('dutchOven.tagline') },
    { id: 'home_oven_stone_bread', image: '/images/approved/equipment-v2/home-oven-stone.webp',    title: t('homeStoneB.title'), tagline: t('homeStoneB.tagline') },
    { id: 'standard_bread',        image: '/images/approved/equipment-v2/home-oven-standard.webp', title: t('standardB.title'),  tagline: t('standardB.tagline') },
    { id: 'wood_fired',            image: '/images/approved/equipment-v2/masonry-oven.webp',     title: t('woodFired.title'),  tagline: t('woodFired.tagline') },
    { id: 'steam_oven',            image: '/images/approved/equipment-v2/steam-oven.webp',          title: t('steamOven.title'),  tagline: t('steamOven.tagline') },
  ];

  const options = bakeType === 'pizza'
    ? pizzaOptions
    : allBreadOptions.filter(o => {
        const excluded = styleKey ? (BREAD_OVEN_EXCLUDES[styleKey] ?? []) : [];
        return !excluded.includes(o.id);
      });

  const selectedId = selected ?? '';
  const selectedOpt = options.find(o => o.id === selectedId);

  if (!expanded && selectedOpt) {
    return (
      <div><DecisionSummary
        thumbnail={selectedOpt.image}
        title={selectedOpt.title}
        tagline={selectedOpt.tagline}
        onExpand={() => setExpanded(true)}
      />{ovenAdvice}</div>
    );
  }

  return (
    <div><DecisionList
      options={options}
      selectedId={selectedId}
      onSelect={(id) => {
        onSelect(id as AnyOvenType);
        if (collapseTimer.current) clearTimeout(collapseTimer.current);
        collapseTimer.current = setTimeout(() => setExpanded(false), 420);
      }}
    />{ovenAdvice}</div>
  );
}
