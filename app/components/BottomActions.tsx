'use client';
import { useRef, useLayoutEffect, type ReactNode } from 'react';

// The slot reserves the actual bar height, including wrapped labels and safe area.
export default function BottomActions({ children }: { children: ReactNode }) {
  const slot = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = bar.current;
    const space = slot.current;
    if (!element || !space) return;
    const sync = () => space.style.setProperty('--bh-action-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={slot} className="bh-step-action-slot">
    <div ref={bar} className="bh-step-actions">{children}</div>
  </div>;
}

