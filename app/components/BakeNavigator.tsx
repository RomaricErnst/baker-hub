'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {BAKE_DESTINATIONS,type BakeDestination} from '../lib/bakeNavigation';
const icons:Record<BakeDestination,string>={
  batch:'M4 9h16l-2 11H6L4 9Z M8 9l4-6 4 6 M9 13v3 M15 13v3',
  organisation:'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  recipe:'M5 3h14v18H5V3Z M8 7h8 M8 11h8 M8 15h5',
  shopping:'M5 7h14l2 14H3L5 7Z M8 7V5a4 4 0 0 1 8 0v2',
  protocol:'M3 5l2 2 3-4 M11 5h10 M3 12l2 2 3-4 M11 12h10 M3 19l2 2 3-4 M11 19h10',
  service:'M3 18h18 M5 15a7 7 0 0 1 14 0H5Z M12 6V4 M10 4h4 M2 21h20',
};
export function DestinationIcon({destination}:{destination:BakeDestination}){
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icons[destination]} /></svg>;
}

/** One answer in My bake, as listed in the sheet. `group` splits Custom into The basics and Customize. */
export type BakeStepLink = {label:string; value?:string|null; disabled?:boolean; current?:boolean; group?:'basics'|'custom'; onChoose:()=>void};

// What each part of the bake is for, in a few words under its name.
const SUBTITLES:Record<string,{en:string;fr:string}> = {
  batch:{en:'Your choices',fr:'Vos choix'},
  recipe:{en:'Dough and timings',fr:'Pâte et horaires'},
  meal:{en:'Optional · choose toppings',fr:'Facultatif · choisir les garnitures'},
  shopping:{en:'What to buy',fr:'Ce qu’il faut acheter'},
  protocol:{en:'Get the dough ready',fr:'Préparer la pâte'},
  service:{en:'On the day',fr:'Le jour J'},
};

/*
 * One control for moving around a bake (16 Nov 2026, owner-approved option A after a neutral review).
 * The bar names where you are ("My bake · Quantity", "Preparation · 4 pizzas") and the whole bar opens
 * "Your bake": the journey on one line from your choices to the table. A ring marks where you are,
 * what is behind you is ticked, and the parts that need a recipe wait, greyed, until it exists.
 * While My bake is the current part, its answers sit in a card under it; in Custom they are grouped
 * into The basics and Customize and only the group you are in is open. Replaces the step link
 * ("Where you are") and the Sections dropdown; Menu keeps the app.
 */
export default function BakeNavigator({active,fr,onChange,top=0,recipeMeal,contextLabel,stepLabel,steps,recipeReady=true,summary,nextStep}:{
  contextLabel?:string;active:BakeDestination;fr:boolean;onChange:(destination:BakeDestination)=>void;top?:number;
  recipeMeal?:{label:string;recipeLabel?:string;active:boolean;selected:boolean;onChoose:()=>void};
  /** The setup step on screen, shown after the section name. */
  stepLabel?:string;
  /** My bake's answers, listed under it in the sheet while it is the current part. */
  steps?:BakeStepLink[];
  /** False until the recipe exists: Recipe, Shopping list, Preparation and Baking & serving wait. */
  recipeReady?:boolean;
  /** One line at the top of the sheet once there is a plan ("4 pizzas · Sat 7:30 pm"). */
  summary?:string;
  /** After the recipe: the plan's next step ("Next: Fold 1 · 4:00 pm"), shown in the bar instead of repeating the page title. */
  nextStep?:string;
}){
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const sheet=useRef<HTMLDivElement>(null);
  // After a choice the new page takes focus (its title); only a plain close returns it to the bar.
  const navigated=useRef(false);
  const [openGroup,setOpenGroup]=useState<'basics'|'custom'|null>(null);
  // My bake's answers fold into one line so the whole journey fits the sheet (16 Nov 2026 review).
  const [choicesOpen,setChoicesOpen]=useState(false);
  const dragFrom=useRef<number|null>(null);
  useEffect(()=>setOpen(false),[active]);
  useEffect(()=>{
    if(!open)return;
    navigated.current=false;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    sheet.current?.focus();
    const keydown=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setOpen(false);return;}
      if(e.key!=='Tab')return;
      const items=Array.from(sheet.current?.querySelectorAll<HTMLElement>('button:not(:disabled)')??[]);
      const first=items[0],last=items[items.length-1];
      if(!first)return;
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===sheet.current)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;if(!navigated.current&&previous?.isConnected)previous.focus({preventScroll:true});};
  },[open]);
  function choose(action:()=>void){navigated.current=true;setOpen(false);action();}

  const section = active === 'organisation' ? 'batch' : active;
  const name=(id:BakeDestination)=>{const d=BAKE_DESTINATIONS.find(item=>item.id===id)!;return fr?d.fr:d.en;};
  const currentName=active==='recipe'&&recipeMeal?.active?recipeMeal.label:name(section);
  const stepIndex=steps?steps.findIndex(step=>step.current):-1;
  // No "3 of 6": the total grew as answers added steps (Style 2 of 4, Quantity 3 of 6, Bake time 5 of 9
  // in Custom), so it read as unstable (17 Nov 2026 retention). The step's name is enough; the journey is in the sheet.
  const stepCount:string|null=null;
  // Setup says how far along the choices are; later parts say what comes next in the plan.
  // The Recipe's own summary card already says what comes next, so its bar names the section alone.
  const showsNext=!!nextStep&&(section==='protocol'||section==='service')&&!recipeMeal?.active;
  const barDetail=stepLabel?(stepCount?`${stepLabel} · ${stepCount}`:stepLabel):showsNext?nextStep:contextLabel;

  type Part={key:string;label:string;sub:string;current:boolean;locked:boolean;optional?:boolean;done?:boolean;go:()=>void};
  const parts:Part[]=[
    {key:'batch',label:name('batch'),sub:fr?SUBTITLES.batch.fr:SUBTITLES.batch.en,current:section==='batch'&&!recipeMeal?.active,locked:false,done:recipeReady,go:()=>onChange('batch')},
    {key:'recipe',label:recipeMeal?.recipeLabel??name('recipe'),sub:fr?SUBTITLES.recipe.fr:SUBTITLES.recipe.en,current:section==='recipe'&&!recipeMeal?.active,locked:!recipeReady,done:recipeReady,go:()=>onChange('recipe')},
    ...(recipeMeal?[{key:'meal',label:recipeMeal.label,sub:fr?SUBTITLES.meal.fr:SUBTITLES.meal.en,current:recipeMeal.active,locked:false,optional:true,done:recipeMeal.selected,go:recipeMeal.onChoose}]:[]),
    {key:'shopping',label:name('shopping'),sub:fr?SUBTITLES.shopping.fr:SUBTITLES.shopping.en,current:section==='shopping',locked:!recipeReady,go:()=>onChange('shopping')},
    {key:'protocol',label:name('protocol'),sub:fr?SUBTITLES.protocol.fr:SUBTITLES.protocol.en,current:section==='protocol',locked:!recipeReady,go:()=>onChange('protocol')},
    {key:'service',label:name('service'),sub:fr?SUBTITLES.service.fr:SUBTITLES.service.en,current:section==='service',locked:!recipeReady,go:()=>onChange('service')},
  ];
  const curIndex=parts.findIndex(p=>p.current);
  const lastDone=parts.reduce((last,part,index)=>!part.current&&part.done?index:last,-1);

  const stepRow=(step:BakeStepLink)=><button key={step.label} type="button" disabled={step.disabled} aria-current={step.current?'step':undefined}
    className={`bh-journey-step${step.current?' is-now':''}`} onClick={()=>choose(step.onChoose)}>
    <span className="bh-journey-step-text">
      <span className="bh-journey-step-label">{step.label}</span>
      <span className={`bh-journey-step-value${step.value?'':' is-todo'}`}>{step.current&&!step.value?(fr?'En cours':'Choosing now'):step.value||(fr?'À choisir':'To choose')}</span>
    </span>
    {!step.disabled&&<span aria-hidden="true" className="bh-journey-arrow">›</span>}
  </button>;
  const stepCard=()=>{
    if(!steps?.length)return null;
    if(!choicesOpen){
      const current=steps[stepIndex];
      const answered=steps.filter(step=>step.value).map(step=>step.value).join(', ');
      return <div className="bh-journey-steps"><button type="button" className="bh-journey-step bh-journey-choices" aria-expanded={false} onClick={()=>setChoicesOpen(true)}>
        <span className="bh-journey-step-text">
          <span className="bh-journey-step-label">{current?`${current.label}${stepCount?` · ${stepCount}`:''}`:(fr?'Vos choix':'Your choices')}</span>
          <span className={`bh-journey-step-value${answered?'':' is-todo'}`}>{answered||(fr?'À choisir':'To choose')}</span>
        </span>
        <span className="bh-journey-more">{fr?'Tout voir':'See all'} <span aria-hidden="true">▾</span></span>
      </button></div>;
    }
    if(!steps.some(step=>step.group==='custom'))return <div className="bh-journey-steps">{steps.map(stepRow)}</div>;
    const groups:[('basics'|'custom'),string][]=[['basics',fr?'Les bases':'The basics'],['custom',fr?'Personnaliser':'Customize']];
    const here=steps.find(step=>step.current)?.group??null;
    const shown=openGroup??here??'basics';
    return <div className="bh-journey-steps">{groups.map(([key,label])=>{
      const items=steps.filter(step=>(step.group??'basics')===key);
      if(!items.length)return null;
      const isOpen=shown===key;
      const answered=items.filter(step=>step.value).map(step=>step.value).join(', ');
      return <div key={key}>
        <button type="button" className={`bh-journey-group${isOpen?' is-open':''}`} aria-expanded={isOpen} onClick={()=>setOpenGroup(key)}>
          <span className="bh-journey-group-label">{label}</span>
          {!isOpen&&<span className={`bh-journey-group-value${answered?'':' is-todo'}`}>{answered||(fr?'À choisir':'To choose')}</span>}
          <span aria-hidden="true" className="bh-journey-arrow">{isOpen?'▴':'▾'}</span>
        </button>
        {isOpen&&items.map(stepRow)}
      </div>;
    })}</div>;
  };

  return <div className="bh-bake-navigator" style={{top,scrollMarginTop:top,'--bh-navigator-top':`${top}px`} as CSSProperties}>
    <button ref={trigger} type="button" className="bh-navigator-band bh-bake-navigator-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setOpenGroup(null);setChoicesOpen(false);setOpen(true);}}>
      <span className="bh-navigator-current">
        {/* One line, one run: the detail follows the name and ends in an ellipsis, never wrapping
            into a second column that leaves "6:00pm" on its own (16 Nov 2026 design review). */}
        <span className="bh-navigator-line"><span className="bh-navigator-name">{currentName}</span>{barDetail&&<> <span data-navigator-bake className="bh-navigator-bake">· {barDetail}</span></>}</span>
        <svg aria-hidden="true" className="bh-navigator-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
      <span className="bh-visually-hidden">{fr?' · voir toute la fournée':' · see your whole bake'}</span>
    </button>
    {open&&createPortal(<>
      <div className="bh-journey-scrim" onClick={()=>setOpen(false)}/>
      <div ref={sheet} role="dialog" aria-modal="true" aria-label={fr?'Votre fournée':'Your bake'} tabIndex={-1} className="bh-journey-sheet"
        onTouchStart={e=>{dragFrom.current=(sheet.current?.scrollTop??0)<=0?e.touches[0].clientY:null;}}
        onTouchEnd={e=>{const from=dragFrom.current;dragFrom.current=null;if(from!==null&&e.changedTouches[0].clientY-from>70)setOpen(false);}}>
        {/* Pull down to close, like the other sheets; the scrim closes it too. */}
        <span aria-hidden="true" className="bh-journey-handle"/>
        <div className="bh-journey-head">
          <h2>{fr?'Votre fournée':'Your bake'}</h2>
          <button type="button" className="bh-journey-done" onClick={()=>setOpen(false)}>{fr?'Terminé':'Done'}</button>
        </div>
        <p className="bh-journey-summary">{summary??(fr?'De vos choix jusqu’à la table':'From your choices to the table')}</p>
        <nav aria-label={fr?'Votre fournée':'Your bake'}>
          <ol className="bh-journey">
            {parts.map((part,index)=>{
              // A tick means done (choices made, recipe generated, pizzas chosen), not "earlier in the list".
              const done=!part.current&&!!part.done;
              const passed=!part.current&&curIndex>=0&&index<curIndex;
              return <li key={part.key} className={[part.current?'is-current':'',done?'is-done':'',passed?'is-passed':'',part.locked?'is-locked':'',part.optional?'is-optional':'',index<lastDone?'is-line-full':'',index===lastDone&&index>0?'is-line-top':''].filter(Boolean).join(' ')}>
                <span aria-hidden="true" className="bh-journey-node"/>
                <button type="button" disabled={part.locked} aria-current={part.current?'page':undefined} aria-describedby={part.locked?`bh-journey-sub-${part.key}`:undefined} onClick={()=>choose(part.go)} className="bh-journey-part">
                  <span className="bh-journey-name"><span {...(part.key==='meal'?{}:{'data-destination-label':''})}>{part.label}</span>{part.current&&<span aria-hidden="true" className="bh-journey-here">{fr?'Vous êtes ici':'You are here'}</span>}</span>
                  <span aria-hidden="true" id={`bh-journey-sub-${part.key}`} className="bh-journey-sub">{part.locked?(part.key==='recipe'?(fr?'Prête dès l’heure de cuisson choisie':'Ready once you set the bake time'):(fr?'S’ouvre avec votre recette':'Opens with your recipe')):part.sub}</span>
                </button>
                {part.key==='batch'&&part.current&&stepCard()}
              </li>;
            })}
          </ol>
        </nav>
      </div>
    </>,document.body)}
  </div>;
}
