/**
 * Service worker (ADR-023)
 *
 * Makes the site open offline after one visit, without ever hiding that the prices may be old:
 * - Pages and data/*: network first. Offline, the cached copy is served, and a data response gets
 *   the OFFLINE_HEADER so js/data-date.js can say the prices are the ones saved on this device.
 * - vendor/* (PDF.js, Inter): cache first. These change only in a deliberate upgrade, which bumps
 *   VERSION by hand.
 * - Everything else of ours (CSS, JS, icons, manifest): served from the cache and refreshed in the
 *   background, so a deploy shows on the next visit.
 * Other origins (supplier logos, AI links) are left alone. Nothing the person types or uploads is
 * stored: the cache holds only the site's own files.
 *
 * VERSION is the date of the prices. The weekly refresh (.github/workflows/update-erse.yml) rewrites
 * it, so a new data set installs a fresh cache and drops the old one.
 */

const VERSION = '2026-10-19';
const CACHE = `guesswatts-${VERSION}`;
const OFFLINE_HEADER = 'X-GuessWatts-Offline';

// The app shell and data for the first offline visit. scripts/selftest.js checks that every file in
// css/ and js/ is listed, so a new file cannot be forgotten here.
const PRECACHE = [
  './',
  'index.html',
  'sobre.html',
  'index.md',
  'sobre.md',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/reset.css',
  'css/base.css',
  'css/animations.css',
  'css/components-header.css',
  'css/components-buttons.css',
  'css/components-tabs.css',
  'css/components-input-views.css',
  'css/components-highlights.css',
  'css/components-results.css',
  'css/components-layout.css',
  'css/components-about.css',
  'css/utilities.css',
  'css/main.css',
  'js/calculator.js',
  'js/config.js',
  'js/data-date.js',
  'js/main.js',
  'js/page-actions.js',
  'js/pdf-service.js',
  'js/ui-components.js',
  'js/ui-handlers.js',
  'js/ui-renderer.js',
  'js/utils.js',
  'vendor/fonts/inter-latin.woff2',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'data/offers.json',
  'data/meta.json',
  'data/tar.json',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' skips the HTTP cache, so the new version never starts from stale copies
    await cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('guesswatts-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (request.mode === 'navigate' || path.startsWith('/data/')) {
    event.respondWith(networkFirst(request));
  } else if (path.startsWith('/vendor/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true })
      ?? (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (!cached) throw error;
    return markOffline(cached);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request).then(async response => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}

// A cached copy served because the network failed, marked so the page can tell people
function markOffline(response) {
  const headers = new Headers(response.headers);
  headers.set(OFFLINE_HEADER, '1');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
