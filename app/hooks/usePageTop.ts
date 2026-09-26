'use client';
import {useLayoutEffect} from 'react';

/** A page transition owns scroll until the reader starts a new interaction.
 * Safari can finish dismissing its keyboard/toolbar after React has painted.
 * Reconcile those viewport changes, never use delayed scroll timers that can
 * pull a reader back after they have started scrolling or editing. */
export function usePageTop(pageKey:string){
 useLayoutEffect(()=>{
  let interacted=false,settling=true,frame=0,secondFrame=0;
  const viewport=window.visualViewport;
  const reset=()=>{if(!interacted)window.scrollTo({top:0,left:0,behavior:'instant'});};
  const stop=()=>{interacted=true;};
  const scroll=()=>{
   if(window.scrollY<=0||interacted)return;
   // Safari can restore a small offset after paint without emitting resize.
   // Repair an obscured arrival heading, not intentional/programmatic travel
   // further down the document (e.g. focusing a control below the fold).
   const header=document.querySelector('.bh-header-stack')?.getBoundingClientRect();
   const bar=document.querySelector('.bh-bake-navigator')?.getBoundingClientRect();
   const edge=Math.max(header?.bottom??0,bar?.bottom??0);
   const heading=Array.from(document.querySelectorAll<HTMLElement>('.bh-page-title')).find(el=>el.getClientRects().length>0);
   const bounds=heading?.getBoundingClientRect();
   if(bounds&&window.scrollY<=edge&&bounds.top<edge&&bounds.bottom>0){reset();return;}
   settling=false;
  };
  const viewportChanged=()=>{if(!interacted){reset();cancelAnimationFrame(frame);frame=requestAnimationFrame(reset);}};
  const restore=()=>{interacted=false;if(document.activeElement instanceof HTMLElement)document.activeElement.blur();viewportChanged();};
  const previous=history.scrollRestoration;history.scrollRestoration='manual';
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  reset();
  frame=requestAnimationFrame(()=>{if(settling)reset();secondFrame=requestAnimationFrame(()=>{if(settling)reset();});});
  window.addEventListener('pointerdown',stop,{passive:true});
  window.addEventListener('touchmove',stop,{passive:true});
  window.addEventListener('wheel',stop,{passive:true});
  window.addEventListener('keydown',stop);
  window.addEventListener('scroll',scroll,{passive:true});
  window.addEventListener('resize',viewportChanged,{passive:true});
  window.addEventListener('pageshow',restore);
  viewport?.addEventListener('resize',viewportChanged,{passive:true});
  viewport?.addEventListener('scroll',scroll,{passive:true});
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(secondFrame);history.scrollRestoration=previous;
   window.removeEventListener('pointerdown',stop);window.removeEventListener('touchmove',stop);window.removeEventListener('wheel',stop);window.removeEventListener('keydown',stop);window.removeEventListener('scroll',scroll);window.removeEventListener('resize',viewportChanged);window.removeEventListener('pageshow',restore);viewport?.removeEventListener('resize',viewportChanged);viewport?.removeEventListener('scroll',scroll);
  };
 },[pageKey]);
}
