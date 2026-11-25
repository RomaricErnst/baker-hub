// The ask token the model routes require (round 20, `app/lib/apiGuard.ts`): fetched from the route's GET
// and kept for 25 of its 30 minutes, then fetched again.
const cache = new Map<string, { token: string; until: number }>();

export async function askToken(route: 'bake-coach' | 'flour-scan', signal?: AbortSignal): Promise<string> {
  const hit = cache.get(route);
  if (hit && hit.until > Date.now()) return hit.token;
  const res = await fetch(`/api/${route}`, { method: 'GET', cache: 'no-store', signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.token !== 'string') throw new Error('service: token');
  cache.set(route, { token: data.token, until: Date.now() + 25 * 60_000 });
  return data.token;
}

/** Forget a token the route refused (403), so the next call fetches a fresh one. */
export function dropAskToken(route: 'bake-coach' | 'flour-scan'): void { cache.delete(route); }
