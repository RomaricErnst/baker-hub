'use client';
import { useEffect } from 'react';

// Registers /sw.js in production builds only (never in `next dev`, where a
// cached shell would hide code changes). Once the worker is in control, the
// page hands it the list of files it has already loaded, so a single visit
// with signal is enough to reopen the bake without it.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    const start = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const registration = await navigator.serviceWorker.ready;
        if (cancelled || !registration.active) return;
        const loaded = performance.getEntriesByType('resource').map((entry) => entry.name);
        registration.active.postMessage({ type: 'bh-warm', urls: [location.pathname, ...loaded] });
      } catch {
        // Offline support is a comfort, never a requirement: stay silent.
      }
    };
    if (document.readyState === 'complete') void start();
    else window.addEventListener('load', start, { once: true });
    return () => { cancelled = true; window.removeEventListener('load', start); };
  }, []);
  return null;
}
