// Abuse guard for the two routes that call the model (round 18, M4): a per-IP rate limit kept in this
// server instance's memory, and a cap on the request body. No login needed. On Vercel each instance keeps
// its own count, which is enough to stop a script from running up the bill; it is not a quota.
const WINDOW_MS = 10 * 60_000;
export const RATE_LIMIT = 20;

const hits = new Map<string, number[]>();

/** The caller's address as the platform forwards it; one shared bucket when there is none. */
export function clientIp(headers: Pick<Headers, 'get'> | undefined): string {
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers?.get('x-real-ip')?.trim() || 'unknown';
}

/** True when the call may go ahead (and counts it); false once `limit` calls were made in the last 10 minutes. */
export function allowRequest(route: string, ip: string, now = Date.now(), limit = RATE_LIMIT): boolean {
  const key = `${route}:${ip}`;
  const recent = (hits.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  // Forget idle callers now and then, so the map cannot grow without bound.
  if (hits.size > 5000) for (const [k, times] of hits) if (!times.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return true;
}

/** Test hook: start from no calls. */
export function resetRateLimit(): void { hits.clear(); }

/** Reads a JSON body no larger than `maxBytes`. Null when it is larger or not JSON. */
export async function readJsonCapped(request: { headers?: Pick<Headers, 'get'>; text?: () => Promise<string>; json?: () => Promise<unknown> }, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  const declared = Number(request.headers?.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };
  try {
    if (request.text) {
      const raw = await request.text();
      if (raw.length > maxBytes) return { ok: false, status: 413 };
      return { ok: true, body: JSON.parse(raw) };
    }
    const body = await request.json?.();
    if (JSON.stringify(body ?? null).length > maxBytes) return { ok: false, status: 413 };
    return { ok: true, body };
  } catch { return { ok: false, status: 400 }; }
}
