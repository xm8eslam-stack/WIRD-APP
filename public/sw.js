const CACHE_NAME = 'wird-app-v2';
const AUDIO_CACHE_NAME = 'wird-app-audio-v1';
const MAX_SESSION_AUDIO_PRELOAD = 20;
const MAX_AUDIO_CACHE_ENTRIES = 40;

async function trimAudioCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_AUDIO_CACHE_ENTRIES;
  for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
}

async function cacheSessionAudio(rawUrls) {
  if (!Array.isArray(rawUrls)) return;
  const cache = await caches.open(AUDIO_CACHE_NAME);
  const urls = rawUrls.slice(0, MAX_SESSION_AUDIO_PRELOAD);
  for (const rawUrl of urls) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'everyayah.com' || !url.pathname.startsWith('/data/') || !url.pathname.endsWith('.mp3')) continue;
      const request = new Request(url.href, { mode: 'no-cors', credentials: 'omit' });
      if (await cache.match(request)) continue;
      const response = await fetch(request);
      if (response && (response.type === 'opaque' || response.status === 200)) {
        await cache.put(request, response.clone());
        await trimAudioCache(cache);
      }
    } catch (error) {
      console.warn('[WIRD SW] Session audio pre-cache skipped:', error);
    }
  }
}
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Service Worker Install: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[WIRD SW] Pre-caching core application shell');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Activate: Clean up old caches safely
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('wird-app-') && name !== CACHE_NAME && name !== AUDIO_CACHE_NAME)
          .map((name) => {
            console.log('[WIRD SW] Removing stale cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Service Worker Fetch: Network-First for SPA navigation, Cache-First for versioned assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or requests to non-http(s) schemas
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Do NOT cache Gemini or advisor API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Strategy 1: SPA Navigation Requests (Network-First with cached /index.html fallback)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy1 = networkResponse.clone();
            const copy2 = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/', copy1);
              cache.put('/index.html', copy2);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[WIRD SW] Navigation offline fallback served');
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match('/index.html') || await cache.match('/');
          return cachedIndex || Response.error();
        })
    );
    return;
  }

  // Strategy 2: Same-origin bundled assets & static files (Cache-First, fall back to network)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(req).then((networkResponse) => {
          // Validate before caching: must be valid 200 response
          if (
            networkResponse && 
            networkResponse.status === 200 && 
            networkResponse.type === 'basic' &&
            !req.url.includes('/api/')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        }).catch((err) => {
          console.warn('[WIRD SW] Asset fetch failed offline:', req.url, err);
          return Response.error();
        });
      })
    );
    return;
  }

  // Strategy 3: Session audio cache (EveryAyah). Only URLs explicitly pre-cached
  // by the active memorization session are stored; other audio remains stream-only.
  if (url.hostname === 'everyayah.com' && url.pathname.startsWith('/data/') && url.pathname.endsWith('.mp3')) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try { return await fetch(req); }
      catch (error) {
        console.warn('[WIRD SW] Session audio unavailable offline:', req.url, error);
        return Response.error();
      }
    })());
    return;
  }

  // Strategy 4: Third-party static assets (Google Fonts)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        }).catch(() => Response.error());
      })
    );
    return;
  }
});

// Handle update messages from application client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'WIRD_CACHE_SESSION_AUDIO') {
    event.waitUntil(cacheSessionAudio(event.data.urls));
  }
});
