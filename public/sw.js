const CACHE_NAME = 'wird-app-v3';
const AUDIO_CACHE_NAME = 'wird-app-audio-v1';
const CONTENT_CACHE_NAME = 'wird-app-content-v1';
const QURAN_PAGE_CACHE_NAME = 'wird-app-quran-pages-v1';
const MAX_CACHED_QURAN_PAGES = 12;
const MAX_OFFLINE_PACKAGE_ASSETS = 2000;
const OFFLINE_MANIFEST_REQUEST_TIMEOUT_MS = 15000;
const OFFLINE_ASSET_REQUEST_TIMEOUT_MS = 30000;
let offlinePackagePreparationInProgress = false;
const MAX_SESSION_AUDIO_PRELOAD = 20;
const MAX_AUDIO_CACHE_ENTRIES = 40;
const PRECACHE_MANIFEST_URL = '/wird-precache-manifest.json';

async function trimAudioCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_AUDIO_CACHE_ENTRIES;
  for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
}

async function trimQuranPageCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_CACHED_QURAN_PAGES;
  for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
}

async function fetchWithTimeout(input, init, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function prepareFullOfflinePackage(port) {
  const manifestResponse = await fetchWithTimeout(
    PRECACHE_MANIFEST_URL,
    { cache: 'no-store' },
    OFFLINE_MANIFEST_REQUEST_TIMEOUT_MS
  );
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
      const response = await fetchWithTimeout(request, {}, OFFLINE_ASSET_REQUEST_TIMEOUT_MS);
      const contentType = (response.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      const validContentType = asset.endsWith('.js')
        ? ['application/javascript', 'text/javascript', 'application/ecmascript', 'text/ecmascript'].includes(contentType)
        : contentType === 'text/css';
      if (response.status !== 200 || response.type !== 'basic' || !validContentType) {
        throw new Error('تعذر التحقق من نوع أحد ملفات التطبيق قبل حفظه: ' + asset);
      }
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
        .filter((name) => name.startsWith('wird-app-') && name !== CACHE_NAME && name !== AUDIO_CACHE_NAME && name !== CONTENT_CACHE_NAME && name !== QURAN_PAGE_CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;
  if (url.pathname.startsWith('/api/')) return;

  // Cache only the pinned, public KFGQPC Hafs page-artwork release. No API or user data is stored.
  const quranPagePrefix = '/svg/pages/v1.1.1/hafs-kfqc/';
  const quranPageName = url.pathname.startsWith(quranPagePrefix) ? url.pathname.slice(quranPagePrefix.length) : '';
  const isPinnedQuranPage = quranPageName.length === 7 && quranPageName.endsWith('.svg') &&
    quranPageName.slice(0, 3).split('').every(char => char >= '0' && char <= '9') &&
    Number(quranPageName.slice(0, 3)) >= 1 && Number(quranPageName.slice(0, 3)) <= 604;
  if (url.protocol === 'https:' && url.hostname === 'cdn.quran.ws' && isPinnedQuranPage && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(QURAN_PAGE_CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const response = await fetch(req);
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (response.ok && response.type === 'cors' && contentType.includes('svg')) {
          await cache.put(req, response.clone());
          await trimQuranPageCache(cache);
        }
        return response;
      } catch (error) {
        console.warn('[WIRD SW] Printed Mushaf page unavailable offline:', req.url, error);
        return Response.error();
      }
    })());
    return;
  }

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
    if (!port) return;
    if (offlinePackagePreparationInProgress) {
      port.postMessage({ type: 'error', message: 'يوجد تجهيز محلي جارٍ بالفعل؛ انتظر انتهاء العملية ثم أعد التحقق.' });
      return;
    }
    offlinePackagePreparationInProgress = true;
    event.waitUntil(
      prepareFullOfflinePackage(port)
        .catch((error) => {
          port.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : 'تعذر إكمال التجهيز المحلي.'
          });
        })
        .finally(() => {
          offlinePackagePreparationInProgress = false;
        })
    );
  }
});
