'use client';

import { useEffect, useState } from 'react';

/* Measured height of the app's fixed bottom nav (#bh-bottom-nav).
   The nav's real height varies by environment — safe-area inset,
   browser vs standalone Safari — so anything positioned "just above
   the nav" must measure it, never assume 69px. Re-measures on resize,
   orientation change and visual-viewport changes (browser chrome
   collapsing/expanding). */
export function useBottomNavHeight(fallback = 69): number {
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const measure = () => {
      const nav = document.getElementById('bh-bottom-nav');
      if (nav) setH(nav.offsetHeight);
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
