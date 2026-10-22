/// <reference lib="webworker" />
import {
  cacheName,
  missingUrls,
  staleCaches,
  type WorkerRequest,
  type WorkerStatus,
} from './precache';

// F:PWA-01, T:PWA-T01–T04: service worker gry. Lista zasobów i wersja są wstrzykiwane przy
// buildzie (vite.config.ts). Nowa wersja instaluje się w tle, ale nie przejmuje aktywnej gry
// sama — dopiero na prośbę aplikacji po udanym zapisie (SH-041).

declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE_URLS__: string[];
declare const __PRECACHE_VERSION__: string;

const URLS = __PRECACHE_URLS__;
const VERSION = __PRECACHE_VERSION__;
const CACHE = cacheName(VERSION);

const absolute = (url: string) => new URL(url, self.registration.scope).href;

self.addEventListener('install', (event) => {
  // PWA-T01: `addAll` jest atomowe — przerwane pobranie nie zostawia „gotowego” cache.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const stale = staleCaches(await caches.keys(), CACHE);
      await Promise.all(stale.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Nawigacja → strona startowa tej samej wersji (spójność kodu i zasobów — PWA-T04).
      const key = request.mode === 'navigate' ? absolute('./') : request.url;
      const cached = await cache.match(key, { ignoreSearch: request.mode === 'navigate' });
      return cached ?? fetch(request);
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data as WorkerRequest;
  if (data.type === 'skipWaiting') {
    void self.skipWaiting();
    return;
  }
  if (data.type === 'status') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = (await cache.keys()).map((r) => r.url);
        const missing = missingUrls(URLS.map(absolute), cached);
        const status: WorkerStatus = {
          type: 'status',
          version: VERSION,
          ready: missing.length === 0,
          missing: missing.length,
        };
        event.source?.postMessage(status);
      })(),
    );
  }
});
