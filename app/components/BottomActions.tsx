'use client';
import { withBackLabel } from './BackLabel';
import { useRef, useLayoutEffect, type ReactNode } from 'react';

// The height of the bottom bar on screen (a fixed bar on a phone), as `--bh-bottom-bar` on the page, so a sticky
// bar inside the content (the time editor's Apply / Update recipe) sits above it (round 23, item 4: at 320 px the
// editor's bar was under it and a tap on "Appliquer" landed on "Courses et prépa"). Hidden tabs' bars measure 0.
function syncBottomBar() {
  if (typeof document === 'undefined') return;
  let height = 0;
  for (const bar of document.querySelectorAll<HTMLElement>('.bh-step-actions')) {
    if (getComputedStyle(bar).position !== 'fixed') continue;
    height = Math.max(height, Math.ceil(bar.getBoundingClientRect().height));
  }
  document.documentElement.style.setProperty('--bh-bottom-bar', `${height}px`);
}

// The slot reserves the actual bar height, including wrapped labels and safe area.
export default function BottomActions({ children, className = '' }: { children: ReactNode; className?: string }) {
  const slot = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = bar.current;
    const space = slot.current;
    if (!element || !space) return;
    const sync = () => { space.style.setProperty('--bh-action-height', `${Math.ceil(element.getBoundingClientRect().height)}px`); syncBottomBar(); };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => { observer.disconnect(); if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncBottomBar); };
  }, []);
  return <div ref={slot} className="bh-step-action-slot">
    <div ref={bar} className={`bh-step-actions${className ? ` ${className}` : ''}`}>{withBackLabel(children)}</div>
  </div>;
}
