'use client';

import { useEffect, useState } from 'react';

/* Measure the visible bottom navigation, or the device safe area when setup
   hides the navigation. Observe resize so transitions between setup and the
   generated recipe, orientation changes and browser chrome stay aligned. */
function safeAreaBottom(): number {
  try {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-bottom,0px)';
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  } catch {
    return 0;
  }
}

export function useBottomNavHeight(fallback = 0): number {
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const measure = () => {
      const nav = document.getElementById('bh-bottom-nav');
      setH(nav && nav.offsetHeight > 0 ? nav.offsetHeight : safeAreaBottom());
    };
    measure();
    const nav = document.getElementById('bh-bottom-nav');
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      vv?.removeEventListener('resize', measure);
    };
  }, []);
  return h;
}
