'use client';

import { useEffect, useState } from 'react';

/* Clearance a fixed bottom bar needs (in px).

   Historically this measured the app's fixed bottom nav (#bh-bottom-nav).
   That nav moved to the top of the page (#bh-top-stepper), so the element
   no longer exists — and the old constant fallback of 69px left every
   fixed bar floating 69px above nothing.

   Now: measure the nav when it exists, otherwise fall back to the iOS
   safe-area inset, which is the only thing a bottom-anchored bar still
   has to clear. Re-measures on resize, orientation change and visual-
   viewport changes (browser chrome collapsing/expanding). */
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
      setH(nav ? nav.offsetHeight : safeAreaBottom());
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      vv?.removeEventListener('resize', measure);
    };
  }, []);
  return h;
}
