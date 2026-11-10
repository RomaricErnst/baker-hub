/* Baker Hub service worker — deliberately small and conservative.
 *
 * What it does
 *   - App shell (navigations to "/" and "/fr"): network first, so a new
 *     deployment is always picked up when there is signal; the last good copy
 *     is served only when the network fails or stalls.
 *   - Build assets under /_next/static/ (hashed, immutable): cache first.
 *   - Other same-origin fonts and images: served from cache, refreshed in the
 *     background.
 *
 * What it never touches
 *   - Anything that is not a same-origin GET (so Supabase and every other
 *     third party pass straight through).
 *   - /api/* and /auth/*.
 *   - React Server Component payloads and any other request not listed above.
 *
 * The bake itself lives in localStorage (bh_session_v1), so a cached shell is
 * enough to reopen it without signal.
 *
 * To retire the worker: bump VERSION and replace the fetch handler with
 * nothing; or ship a worker that calls self.registration.unregister().
 */
const VERSION = 'v1';
const SHELL_CACHE = 'bh-shell-' + VERSION;
const STATIC_CACHE = 'bh-static-' + VERSION;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];
const SHELL_PATHS = ['/', '/fr'];
const NEVER_CACHE_PREFIXES = ['/api/', '/auth/'];
const STATIC_EXTENSION = /\.(?:woff2?|ttf|otf|webp|png|jpe?g|gif|avif|svg|ico)$/i;
const STATIC_LIMIT = 400;      // entries kept in the asset cache
const SHELL_TIMEOUT_MS = 5000; // a stalled network falls back to the saved shell

function shellPath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return SHELL_PATHS.includes(path) ? path : null;
}

// 'shell' | 'immutable' | 'asset' | null (null = leave the request alone).
function classify(request) {
  if (request.method !== 'GET') return null;
  let url;
  try { url = new URL(request.url); } catch (error) { return null; }
  if (url.origin !== self.location.origin) return null;
  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
      url.pathname === '/api' || url.pathname === '/auth') return null;
  if (request.headers && request.headers.has && request.headers.has('range')) return null;
  if (request.mode === 'navigate') return shellPath(url.pathname) ? 'shell' : null;
  if (url.pathname.startsWith('/_next/static/')) return 'immutable';
  if (url.pathname === '/_next/image') return 'asset';
  if (url.pathname.startsWith('/_next/')) return null;
  if (STATIC_EXTENSION.test(url.pathname)) return 'asset';
  return null;
}

function storable(response) {
  return Boolean(response) && response.ok && response.status === 200 &&
    response.type === 'basic' && !response.redirected;
}

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}

async function saveShell(path, response) {
  if (!storable(response)) return;
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(path, response);
}

async function savedShell(path) {
  const cache = await caches.open(SHELL_CACHE);
  const exact = await cache.match(path);
  if (exact) return exact;
  // "/" answers with a redirect to "/fr" for a French-speaking baker, so it
  // may never have been stored. Send them to the shell that was.
  for (const other of SHELL_PATHS) {
    if (other !== path && await cache.match(other)) return Response.redirect(other, 302);
  }
  return null;
}

async function shellResponse(event) {
  const url = new URL(event.request.url);
  const path = shellPath(url.pathname);
  const network = fetch(event.request).then((response) => {
    // Only the plain address is stored; query strings are served, not kept.
    if (url.search === '') event.waitUntil(saveShell(path, response.clone()).catch(() => {}));
    return response;
  });
  const fallback = async (error) => {
    const saved = await savedShell(path);
    if (saved) return saved;
    if (error) throw error;
    return network;
  };
  let timer;
  const stalled = new Promise((resolve) => { timer = setTimeout(() => resolve('stalled'), SHELL_TIMEOUT_MS); });
  try {
    const first = await Promise.race([network, stalled]);
    if (first !== 'stalled') return first;
    network.catch(() => {});
    return await fallback(null);
  } catch (error) {
    return await fallback(error);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAndStore(request) {
  const response = await fetch(request);
  if (storable(response)) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    await trim(STATIC_CACHE, STATIC_LIMIT);
  }
  return response;
}

async function assetResponse(event, kind) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (cached) {
    // Hashed build files never change; other assets are refreshed quietly.
    if (kind === 'asset') event.waitUntil(fetchAndStore(event.request).catch(() => {}));
    return cached;
  }
  return fetchAndStore(event.request);
}

self.addEventListener('install', (event) => {
  // No precache: the page tells the worker what it has just loaded (see
  // 'bh-warm' below). Take over as soon as possible; HTML is network first,
  // so there is no old shell to protect.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('bh-') && !CURRENT_CACHES.includes(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const kind = classify(event.request);
  if (!kind) return; // the browser handles it as if no worker existed
  event.respondWith(kind === 'shell' ? shellResponse(event) : assetResponse(event, kind));
});

// On a first visit the page and its files load before the worker is in
// control, so the page hands over the list of what it has loaded. Each address
// goes through the same rules as a live request.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'bh-warm' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    for (const raw of data.urls.slice(0, 300)) {
      try {
        const url = new URL(raw, self.location.origin);
        const path = url.origin === self.location.origin && url.search === '' ? shellPath(url.pathname) : null;
        if (path) {
          await saveShell(path, await fetch(path, { credentials: 'same-origin' }));
          continue;
        }
        const request = new Request(url.href, { method: 'GET' });
        const kind = classify(request);
        if (kind !== 'immutable' && kind !== 'asset') continue;
        if (await cache.match(request)) continue;
        const response = await fetch(request);
        if (storable(response)) await cache.put(request, response);
      } catch (error) { /* one missing file must not stop the rest */ }
    }
    await trim(STATIC_CACHE, STATIC_LIMIT);
  })());
});
