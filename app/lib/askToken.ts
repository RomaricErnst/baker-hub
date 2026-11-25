// The ask token the model routes require (round 20, `app/lib/apiGuard.ts`): fetched from the route's GET
// and kept for 25 of its 30 minutes, then fetched again.
// Round 23: the token is bound to this page's random id (sent as `x-bh-page` on the GET and the POST),
// not to the caller's address, so a phone that changes network keeps it. A token the route refuses
// (403: past its time, from before a deployment) is fetched again once, silently.
type AskRoute = 'bake-coach' | 'flour-scan';
const cache = new Map<string, { token: string; until: number }>();
let pageId: string | null = null;

function randomId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** This page's id: made once per page load, never stored. */
export function askPageId(): string {
  if (!pageId) pageId = randomId();
  return pageId;
}

export async function askToken(route: AskRoute, signal?: AbortSignal): Promise<string> {
  const hit = cache.get(route);
  if (hit && hit.until > Date.now()) return hit.token;
  const res = await fetch(`/api/${route}`, { method: 'GET', cache: 'no-store', signal, headers: { 'x-bh-page': askPageId() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.token !== 'string') throw new Error('service: token');
  cache.set(route, { token: data.token, until: Date.now() + 25 * 60_000 });
  return data.token;
}

/** Forget a token the route refused (403), so the next call fetches a fresh one. */
export function dropAskToken(route: AskRoute): void { cache.delete(route); }

/** POSTs a JSON body to a model route with this page's token; on a refused token, one fresh try. */
export async function askPost(route: AskRoute, body: string, signal?: AbortSignal): Promise<Response> {
  const send = async () => fetch(`/api/${route}`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-bh-ask': await askToken(route, signal), 'x-bh-page': askPageId() },
    body,
  });
  const res = await send();
  if (res.status !== 403) return res;
  dropAskToken(route);
  return send();
}
