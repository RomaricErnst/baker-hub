// Abuse guard for the two routes that call the model.
//
// Round 18 kept a per-IP count in the server instance's memory. The round-19 live test sent 24 calls in
// 2 minutes from one address and every one was answered: on Vercel each request can land on another
// instance, so a count in memory does not hold. Round 20 (no new paid service):
//   1. Same origin: a browser call must come from the app's own pages (Origin, else Referer).
//   2. A short-lived ask token the page fetches first (GET on the route), signed on the server and bound
//      to the caller's address, so a bare script must make two calls and cannot reuse a token elsewhere.
//   3. A durable count in Supabase (`bh_rate_hit`, migration 20261125_api_rate_hits.sql): one row per
//      call, keyed by a salted hash of the address (never the address itself), counted atomically in a
//      SECURITY DEFINER function the anon key may only execute; the table itself has RLS on and no policy.
//      Plus a daily cap for the whole route. If the database cannot be reached the in-memory count
//      below still applies (the previous behaviour), so the route never fails open to unlimited calls
//      within an instance.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const WINDOW_MS = 10 * 60_000;
export const RATE_LIMIT = 20;
/** Calls per route per day for every caller together: a ceiling on the bill. */
export const DAILY_LIMIT = 1500;

const hits = new Map<string, number[]>();

/** The caller's address as the platform forwards it; one shared bucket when there is none. */
export function clientIp(headers: Pick<Headers, 'get'> | undefined): string {
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers?.get('x-real-ip')?.trim() || 'unknown';
}

/** True when the call may go ahead (and counts it); false once `limit` calls were made in the last 10 minutes.
 *  In this instance's memory only: the fallback when the durable count is unavailable. */
export function allowRequest(route: string, ip: string, now = Date.now(), limit = RATE_LIMIT): boolean {
  const key = `${route}:${ip}`;
  const recent = (hits.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, times] of hits) if (!times.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return true;
}

/** Test hook: start from no calls. */
export function resetRateLimit(): void { hits.clear(); }

// ── Secrets ─────────────────────────────────────────────
// No new environment variable is required: the signing key derives from a server-only secret already
// configured (ANTHROPIC_API_KEY), hashed with a purpose label, so the key itself never leaves the server.
function serverSecret(purpose: string): Buffer {
  const base = process.env.BH_GUARD_SECRET || process.env.ANTHROPIC_API_KEY || 'bh-dev-only';
  return createHash('sha256').update(`baker-hub:${purpose}:${base}`).digest();
}

/** A salted hash of the address: what the durable store keys on. */
export function hashedIp(ip: string): string {
  return createHmac('sha256', serverSecret('ip')).update(ip).digest('base64url').slice(0, 32);
}

// ── Same origin ─────────────────────────────────────────
const ALLOWED_HOSTS = ['bakerhub.app', 'www.bakerhub.app'];

/** The host a browser call came from (Origin, else Referer); null when neither is sent. */
function callerHost(headers: Pick<Headers, 'get'> | undefined): string | null {
  const raw = headers?.get('origin') || headers?.get('referer');
  if (!raw) return null;
  try { return new URL(raw).host.toLowerCase(); } catch { return ''; }
}

/** A call from the app's own pages: bakerhub.app, this deployment's own host (Vercel previews, a local
 *  server), or an extra host in BH_ALLOWED_ORIGINS. Origin and Referer missing → refused. */
export function sameOrigin(headers: Pick<Headers, 'get'> | undefined): boolean {
  const host = callerHost(headers);
  if (!host) return false;
  const own = headers?.get('host')?.toLowerCase();
  const extra = (process.env.BH_ALLOWED_ORIGINS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  return ALLOWED_HOSTS.includes(host) || (!!own && host === own) || extra.includes(host);
}

// ── Ask token ───────────────────────────────────────────
const TOKEN_TTL_MS = 30 * 60_000;

/** A token for this address, valid 30 minutes: `<expiry>.<nonce>.<signature>`. */
export function issueAskToken(route: string, ip: string, now = Date.now()): string {
  const exp = String(now + TOKEN_TTL_MS);
  const nonce = randomBytes(9).toString('base64url');
  const sig = createHmac('sha256', serverSecret('token')).update(`${route}|${hashedIp(ip)}|${exp}|${nonce}`).digest('base64url');
  return `${exp}.${nonce}.${sig}`;
}

export function validAskToken(route: string, ip: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [exp, nonce, sig] = token.split('.');
  if (!exp || !nonce || !sig || !/^\d+$/.test(exp) || +exp < now || +exp > now + TOKEN_TTL_MS) return false;
  const want = createHmac('sha256', serverSecret('token')).update(`${route}|${hashedIp(ip)}|${exp}|${nonce}`).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, 'base64url'); } catch { return false; }
  return got.length === want.length && timingSafeEqual(got, want);
}

// ── Durable count ───────────────────────────────────────
type Fetch = typeof fetch;

/** One counted call against Supabase's `bh_rate_hit`. true/false = the store's answer; null = store
 *  unavailable (not configured, function missing, network), so the caller falls back to memory. */
async function durableHit(bucket: string, limit: number, windowSeconds: number, doFetch: Fetch): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await doFetch(`${url}/rest/v1/rpc/bh_rate_hit`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body === true ? true : body === false ? false : null;
  } catch { return null; }
}

export type GuardResult = { ok: true } | { ok: false; status: 403 | 429; error: string };

/** Every check before a model call: same origin, a valid ask token, the per-address limit and the
 *  route's daily cap (durable, else this instance's memory). */
export async function guardModelCall(route: string, headers: Pick<Headers, 'get'> | undefined, doFetch: Fetch = fetch, now = Date.now()): Promise<GuardResult> {
  if (!sameOrigin(headers)) return { ok: false, status: 403, error: 'Forbidden' };
  const ip = clientIp(headers);
  if (!validAskToken(route, ip, headers?.get('x-bh-ask'), now)) return { ok: false, status: 403, error: 'Forbidden' };
  const own = await durableHit(`${route}:${hashedIp(ip)}`, RATE_LIMIT, WINDOW_MS / 1000, doFetch);
  const allowed = own ?? allowRequest(route, ip, now);
  if (!allowed) return { ok: false, status: 429, error: 'Too many requests' };
  const day = await durableHit(`${route}:all:${new Date(now).toISOString().slice(0, 10)}`, DAILY_LIMIT, 86_400, doFetch);
  if (day === false) return { ok: false, status: 429, error: 'Too many requests' };
  return { ok: true };
}

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
