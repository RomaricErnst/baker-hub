'use client';
import { useEffect, useRef } from 'react';

// A tab left open across a deployment kept the old app (24 Nov 2026: a tab open since before 20 Nov showed round-6
// screens). When the page comes back to the foreground, it reads the page's current HTML once (at most once a
// minute) and, when that HTML loads scripts this page never loaded, reloads quietly: only when nothing is being
// edited (no dialog or sheet, no focused field) and the bake was saved (`canReload`). Round 18, H5.

/** The build's own script paths in an HTML page. */
export function scriptPaths(html: string): string[] {
  return [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s>?\\]+\.js/g)].map(match => match[0]))];
}

/** True when the fetched page loads a script this page does not have: another build. */
export function isNewDeployment(html: string, loaded: ReadonlySet<string>): boolean {
  const fresh = scriptPaths(html);
  return fresh.length > 0 && loaded.size > 0 && fresh.some(path => !loaded.has(path));
}

function quiet(): boolean {
  if (document.querySelector('dialog[open], [role="dialog"], [aria-modal="true"]')) return false;
  const active = document.activeElement as HTMLElement | null;
  return !(active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)));
}

export function useReloadOnNewDeployment(canReload: () => boolean): void {
  const can = useRef(canReload);
  can.current = canReload;
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    let checkedAt = 0, busy = false;
    const check = async () => {
      if (document.visibilityState !== 'visible' || busy || Date.now() - checkedAt < 60_000) return;
      busy = true; checkedAt = Date.now();
      try {
        const response = await fetch(location.pathname, { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) return;
        const loaded = new Set(Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
          .map(script => { try { return new URL(script.src, location.href).pathname; } catch { return ''; } })
          .filter(path => path.startsWith('/_next/static/')));
        if (isNewDeployment(await response.text(), loaded) && quiet() && can.current()) location.reload();
      } catch {
        // Offline or a stalled network: the page stays as it is.
      } finally { busy = false; }
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
}
