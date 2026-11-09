const CACHE_NAME = 'wird-app-v3';
const AUDIO_CACHE_NAME = 'wird-app-audio-v1';
const CONTENT_CACHE_NAME = 'wird-app-content-v1';
const MAX_OFFLINE_PACKAGE_ASSETS = 2000;
const MAX_SESSION_AUDIO_PRELOAD = 20;
const MAX_AUDIO_CACHE_ENTRIES = 40;
const PRECACHE_MANIFEST_URL = '/wird-precache-manifest.json';

async function trimAudioCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_AUDIO_CACHE_ENTRIES;
  for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
}

async function prepareFullOfflinePackage(port) {
  const manifestResponse = await fetch(PRECACHE_MANIFEST_URL, { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('تعذر تحميل فهرس ملفات وِرد.');
  const manifest = await manifestResponse.json();
  const assets = manifest && Array.isArray(manifest.allAssets) ? manifest.allAssets : null;
  if (!assets || assets.length === 0 || assets.length > MAX_OFFLINE_PACKAGE_ASSETS) {
    throw new Error('فهرس التجهيز المحلي غير صالح أو يتجاوز الحد الآمن.');
  }
  const safeAssets = assets.filter((asset) => {
    if (typeof asset !== 'string' || !asset.startsWith('/') || asset.startsWith('//')) return false;
    const url = new URL(asset, self.location.origin);
    return url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'));
  });
  if (safeAssets.length !== assets.length) throw new Error('الفهرس يحتوي على ملفات غير مسموح بها.');
  const cache = await caches.open(CONTENT_CACHE_NAME);
  let completed = 0;
  for (const asset of safeAssets) {
    const request = new Request(new URL(asset, self.location.origin).href, { credentials: 'same-origin' });
    if (!(await cache.match(request))) {
      const response = await fetch(request);
      if (!response.ok || response.type !== 'basic') throw new Error('فشل تنزيل أحد ملفات التطبيق: ' + asset);
      await cache.put(request, response.clone());
    }
    completed++;
    if (port) port.postMessage({ type: 'progress', completed, total: safeAssets.length, asset });
  }
  if (port) port.postMessage({ type: 'complete', completed, total: safeAssets.length });
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

async function precacheApplicationShell(cache) {
  await cache.addAll(STATIC_ASSETS);

  const response = await fetch(PRECACHE_MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('WIRD offline shell manifest is unavailable: ' + response.status);
  }
  const manifestForCache = response.clone();
  const manifest = await response.json();
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) ||
      manifest.assets.length === 0 || manifest.assets.length > 100) {
    throw new Error('WIRD offline shell manifest has an invalid shape.');
  }

  const safeAssets = manifest.assets.filter((asset) => {
    if (typeof asset !== 'string' || !asset.startsWith('/') || asset.startsWith('//')) return false;
    const url = new URL(asset, self.location.origin);
    return url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'));
  });
  if (safeAssets.length !== manifest.assets.length) {
    throw new Error('WIRD offline shell manifest contains an unsupported asset URL.');
  }

  // addAll is atomic: the new worker is not activated with a partially cached app shell.
  await cache.addAll(safeAssets);
  await cache.put(PRECACHE_MANIFEST_URL, manifestForCache);
  console.log('[WIRD SW] Cached application shell assets:', safeAssets.length);
}

// Service Worker Install: cache the HTML shell and its generated static JS/CSS dependency graph.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => precacheApplicationShell(cache))
      .then(() => self.skipWaiting())
  );
});

// Service Worker Activate: clean old shell versions while preserving session audio.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name.startsWith('wird-app-') && name !== CACHE_NAME && name !== AUDIO_CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;
  if (url.pathname.startsWith('/api/')) return;

  // SPA navigations remain network-first, with a complete cached HTML fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy1 = networkResponse.clone();
          const copy2 = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            cache.put('/', copy1);
            cache.put('/index.html', copy2);
          });
        }
        return networkResponse;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
      })
    );
    return;
  }

  // Explicitly downloaded full offline package takes precedence over shell cache.
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith((async () => {
      const fullCache = await caches.open(CONTENT_CACHE_NAME);
      const cached = await fullCache.match(req);
      if (cached) return cached;
      const shellCached = await caches.match(req);
      if (shellCached) return shellCached;
      try { return await fetch(req); } catch { return Response.error(); }
    })());
    return;
  }

  // Same-origin assets are cache-first; first-visit JS/CSS is already precached at install.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 &&
              networkResponse.type === 'basic' && !url.pathname.startsWith('/api/')) {
            const responseToCache = networkResponse.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
          }
          return networkResponse;
        }).catch((error) => {
          console.warn('[WIRD SW] Asset fetch failed offline:', req.url, error);
          return Response.error();
        });
      })
    );
    return;
  }

  // Session audio cache: only explicitly selected EveryAyah recitations are stored.
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

  // Cache public Google Fonts only; never cache authenticated or application API responses.
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        }).catch(() => Response.error());
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'WIRD_CACHE_SESSION_AUDIO') {
    event.waitUntil(cacheSessionAudio(event.data.urls));
    return;
  }
  if (event.data && event.data.type === 'WIRD_PREPARE_OFFLINE_PACKAGE') {
    const port = event.ports && event.ports[0];
    event.waitUntil(prepareFullOfflinePackage(port).catch((error) => {
      if (port) port.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'تعذر إكمال التجهيز المحلي.' });
    }));
  }
});
