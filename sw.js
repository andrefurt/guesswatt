/**
 * Service worker (ADR-023)
 *
 * Makes the site open offline after one visit, without ever hiding that the prices may be old:
 * - Everything of ours (pages, data/*, CSS, JS, icons, manifest): network first, so a deploy never
 *   mixes new HTML with old CSS or JS (audit P-1). Offline, or when a page or its data takes longer
 *   than NETWORK_TIMEOUT_MS, the saved copy is served with the OFFLINE_HEADER, so js/data-date.js can
 *   say the prices are the ones saved on this device. A page served from the saved copy gets all its
 *   files from it (savedPages); a page from the network waits for its CSS and JS.
 * - vendor/* (PDF.js, Inter): cache first. PDF.js is saved on first use in its own cache, named by
 *   its version, so the weekly VERSION bump keeps it (audit P-2); an upgrade renames PDFJS_CACHE.
 * Other origins (the AI links) are left alone. Nothing the person types or uploads is stored: the
 * cache holds only the site's own files, saved without the query string, so a result link's numbers
 * never become a cache key (audit P-5).
 *
 * VERSION is the date of the prices. The weekly refresh (.github/workflows/update-erse.yml) rewrites
 * it, so a new data set installs a fresh cache and drops the old one.
 */

const VERSION = '2026-10-19';
const CACHE = `guesswatts-${VERSION}`;
const PDFJS_CACHE = 'guesswatts-pdfjs-3.11.174'; // the version in vendor/pdfjs (selftest checks)
const OFFLINE_HEADER = 'X-GuessWatts-Offline';
const NETWORK_TIMEOUT_MS = 3000; // a hanging connection gets the saved copy after this (audit P-6)

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
  'js/sobre.js',
  'js/ui-components.js',
  'js/ui-handlers.js',
  'js/ui-renderer.js',
  'js/url-state.js',
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
    const keep = [CACHE, PDFJS_CACHE];
    await Promise.all(names.filter(name => name.startsWith('guesswatts-') && !keep.includes(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (path.startsWith('/vendor/pdfjs/')) {
    event.respondWith(cacheFirst(request, PDFJS_CACHE));
  } else if (path.startsWith('/vendor/')) {
    event.respondWith(cacheFirst(request, CACHE));
  } else if (savedPages.has(event.clientId)) {
    // A page served from the saved copy takes its CSS, JS and data from the same copy
    event.respondWith(savedCopy(request));
  } else {
    // The page and its data give up on a slow network; its code waits for it, so a page that came
    // from the network never runs with the saved CSS or JS
    const timeout = request.mode === 'navigate' || path.startsWith('/data/');
    event.respondWith(networkFirst(event, request, timeout));
  }
});

// Pages (client ids) served from the saved copy because the network failed or was slow. Decided per
// page, not per file: on a slow network a per-file timeout gave new HTML with saved CSS (audit P-1).
// Held in memory: if the browser stops the worker meanwhile, that page's files go to the network.
const savedPages = new Set();

async function rememberSavedPage(id) {
  if (!id) return;
  const open = new Set((await self.clients.matchAll({ includeUncontrolled: true })).map(client => client.id));
  for (const old of savedPages) if (!open.has(old)) savedPages.delete(old);
  savedPages.add(id);
}

async function savedCopy(request) {
  const url = new URL(request.url);
  const cached = await (await caches.open(CACHE)).match(url.origin + url.pathname);
  return cached ? markOffline(cached) : fetch(request);
}

async function networkFirst(event, request, timeout) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  const key = url.origin + url.pathname;
  const network = fetch(request).then(async response => {
    if (response.ok) await cache.put(key, response.clone());
    return response;
  });
  try {
    if (!timeout) return await network;
    return await Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error('network timeout')), NETWORK_TIMEOUT_MS))]);
  } catch (error) {
    const cached = await cache.match(key)
      ?? (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    // Nothing saved: wait for the network after all, or its error
    if (!cached) return network;
    // A late answer still refreshes the saved copy for the next visit
    event.waitUntil(network.catch(() => {}));
    if (request.mode === 'navigate') event.waitUntil(rememberSavedPage(event.resultingClientId));
    return markOffline(cached);
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// A cached copy served because the network failed, marked so the page can tell people
function markOffline(response) {
  const headers = new Headers(response.headers);
  headers.set(OFFLINE_HEADER, '1');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
