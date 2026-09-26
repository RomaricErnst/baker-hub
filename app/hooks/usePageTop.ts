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
  const scroll=()=>{if(window.scrollY>0)settling=false;};
  const viewportChanged=()=>{if(!interacted){reset();cancelAnimationFrame(frame);frame=requestAnimationFrame(reset);}};
  const restore=()=>{interacted=false;viewportChanged();};
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
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(secondFrame);history.scrollRestoration=previous;
   window.removeEventListener('pointerdown',stop);window.removeEventListener('touchmove',stop);window.removeEventListener('wheel',stop);window.removeEventListener('keydown',stop);window.removeEventListener('scroll',scroll);window.removeEventListener('resize',viewportChanged);window.removeEventListener('pageshow',restore);viewport?.removeEventListener('resize',viewportChanged);
  };
 },[pageKey]);
}
