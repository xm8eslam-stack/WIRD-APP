const CACHE_NAME = 'wird-app-v3';
const AUDIO_CACHE_NAME = 'wird-app-audio-v1';
const CONTENT_CACHE_NAME = 'wird-app-content-v1';
const MUSHAF_PAGE_CACHE_NAME = 'wird-app-mushaf-v1';
const MAX_MUSHAF_PAGE_CACHE_ENTRIES = 24;
const MAX_OFFLINE_PACKAGE_ASSETS = 2000;
const OFFLINE_MANIFEST_REQUEST_TIMEOUT_MS = 15000;
const OFFLINE_NAVIGATION_REQUEST_TIMEOUT_MS = 6000;
const OFFLINE_ASSET_REQUEST_TIMEOUT_MS = 30000;
let offlinePackagePreparationInProgress = false;
const MAX_SESSION_AUDIO_PRELOAD = 20;
const MAX_AUDIO_CACHE_ENTRIES = 40;
const PRECACHE_MANIFEST_URL = '/wird-precache-manifest.json';
const QURAN_FONT_URL = 'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2';

const OFFLINE_ASSET_CONTENT_TYPES = {
  '.js': ['application/javascript', 'text/javascript', 'application/ecmascript', 'text/ecmascript'],
  '.css': ['text/css'],
  '.svg': ['image/svg+xml'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.avif': ['image/avif'],
  '.gif': ['image/gif'],
  '.ico': ['image/x-icon', 'image/vnd.microsoft.icon'],
  '.woff': ['font/woff', 'application/font-woff', 'application/octet-stream'],
  '.woff2': ['font/woff2', 'application/font-woff2', 'application/octet-stream'],
  '.ttf': ['font/ttf', 'application/x-font-ttf', 'application/octet-stream'],
  '.otf': ['font/otf', 'application/x-font-opentype', 'application/octet-stream'],
  '.json': ['application/json', 'text/json'],
  '.webmanifest': ['application/manifest+json', 'application/json']
};
function offlineAssetExtension(pathname) {
  const match = pathname.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : '';
}
function isSupportedOfflineAssetPath(pathname) {
  return Object.prototype.hasOwnProperty.call(OFFLINE_ASSET_CONTENT_TYPES, offlineAssetExtension(pathname));
}
function isValidOfflineAssetResponse(pathname, response) {
  const extension = offlineAssetExtension(pathname);
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const allowedTypes = OFFLINE_ASSET_CONTENT_TYPES[extension];
  return response.status === 200 && response.type === 'basic' &&
    Array.isArray(allowedTypes) && allowedTypes.includes(contentType);
}


/**
 * Adapt optional offline media caches to the storage currently available to this
 * origin. Keep a reserve for the app and user data; Cache Storage is opportunistic.
 * If the browser cannot report quota, retain the conservative static defaults.
 */
async function getAdaptiveOfflineCacheLimits() {
  try {
    const storage = self.navigator && self.navigator.storage;
    if (!storage || typeof storage.estimate !== 'function') {
      return {
        audioEntries: MAX_AUDIO_CACHE_ENTRIES,
        mushafEntries: MAX_MUSHAF_PAGE_CACHE_ENTRIES
      };
    }
    const estimate = await storage.estimate();
    const quota = Number(estimate && estimate.quota);
    const usage = Number(estimate && estimate.usage);
    if (!Number.isFinite(quota) || quota <= 0 || !Number.isFinite(usage) || usage < 0) {
      return {
        audioEntries: MAX_AUDIO_CACHE_ENTRIES,
        mushafEntries: MAX_MUSHAF_PAGE_CACHE_ENTRIES
      };
    }
    const available = Math.max(0, quota - usage);
    const reserve = Math.max(32 * 1024 * 1024, quota * 0.15);
    const cacheable = Math.max(0, available - reserve);
    // Approximate sizes are deliberately conservative; hard caps prevent runaway caches.
    const audioEntries = Math.min(MAX_AUDIO_CACHE_ENTRIES, Math.floor(cacheable * 0.20 / (5 * 1024 * 1024)));
    const mushafEntries = Math.min(96, Math.floor(cacheable * 0.08 / (256 * 1024)));
    return {
      audioEntries: Math.max(0, audioEntries),
      mushafEntries: Math.max(0, mushafEntries)
    };
  } catch {
    return {
      audioEntries: MAX_AUDIO_CACHE_ENTRIES,
      mushafEntries: MAX_MUSHAF_PAGE_CACHE_ENTRIES
    };
  }
}

async function trimAudioCache(cache) {
  const limits = await getAdaptiveOfflineCacheLimits();
  const keys = await cache.keys();
  const overflow = keys.length - limits.audioEntries;
  for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
}

async function trimMushafPageCache(cache) {
  const limits = await getAdaptiveOfflineCacheLimits();
  const keys = await cache.keys();
  const overflow = keys.length - limits.mushafEntries;
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

function isValidQuranFontResponse(response) {
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  return response.status === 200 && response.type === 'cors' &&
    ['font/woff2', 'application/font-woff2', 'application/octet-stream'].includes(contentType);
}

async function precacheQuranFont(cache) {
  const request = new Request(QURAN_FONT_URL, { mode: 'cors', credentials: 'omit' });
  try {
    const cached = await cache.match(request);
    if (cached && isValidQuranFontResponse(cached)) return;
    if (cached) await cache.delete(request);
    const response = await fetchWithTimeout(request, {}, 8000);
    if (isValidQuranFontResponse(response)) await cache.put(request, response.clone());
  } catch (error) {
    // The official Quran font is an enhancement; its failure must not block the app shell.
    console.warn('[WIRD SW] Official Uthmanic font could not be pre-cached:', error);
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
    return url.origin === self.location.origin && isSupportedOfflineAssetPath(url.pathname);
  });
  if (safeAssets.length !== assets.length) throw new Error('الفهرس يحتوي على ملفات غير مسموح بها.');
  const cache = await caches.open(CONTENT_CACHE_NAME);
  let completed = 0;
  for (const asset of safeAssets) {
    const request = new Request(new URL(asset, self.location.origin).href, { credentials: 'same-origin' });
    const cachedResponse = await cache.match(request);
    const validCachedResponse = cachedResponse &&
      isValidOfflineAssetResponse(new URL(asset, self.location.origin).pathname, cachedResponse);
    if (!validCachedResponse) {
      if (cachedResponse) await cache.delete(request);
      const response = await fetchWithTimeout(request, {}, OFFLINE_ASSET_REQUEST_TIMEOUT_MS);
      if (!isValidOfflineAssetResponse(new URL(asset, self.location.origin).pathname, response)) {
        throw new Error('تعذر التحقق من نوع أحد ملفات التطبيق قبل حفظه: ' + asset);
      }
      await cache.put(request, response.clone());
    }
    completed++;
    if (port) port.postMessage({ type: 'progress', completed, total: safeAssets.length, asset });
  }
  if (port) port.postMessage({ type: 'complete', completed, total: safeAssets.length });
}

async function inspectFullOfflinePackage() {
  // Prefer the already-cached manifest so this diagnostic also works offline.
  let manifestResponse = await caches.match(PRECACHE_MANIFEST_URL);
  if (!manifestResponse) {
    manifestResponse = await fetchWithTimeout(
      PRECACHE_MANIFEST_URL,
      { cache: 'no-store' },
      OFFLINE_MANIFEST_REQUEST_TIMEOUT_MS
    );
  }
  if (!manifestResponse || !manifestResponse.ok) throw new Error('تعذر قراءة فهرس ملفات التجهيز المحلي.');
  const manifest = await manifestResponse.json();
  const assets = manifest && Array.isArray(manifest.allAssets) ? manifest.allAssets : null;
  if (!assets || assets.length === 0 || assets.length > MAX_OFFLINE_PACKAGE_ASSETS) {
    throw new Error('فهرس التجهيز المحلي غير صالح أو يتجاوز الحد الآمن.');
  }
  const safeAssets = assets.filter((asset) => {
    if (typeof asset !== 'string' || !asset.startsWith('/') || asset.startsWith('//')) return false;
    const url = new URL(asset, self.location.origin);
    return url.origin === self.location.origin && isSupportedOfflineAssetPath(url.pathname);
  });
  if (safeAssets.length !== assets.length) throw new Error('الفهرس يحتوي على ملفات غير مسموح بها.');
  const cache = await caches.open(CONTENT_CACHE_NAME);
  let cached = 0;
  for (const asset of safeAssets) {
    const request = new Request(new URL(asset, self.location.origin).href, { credentials: 'same-origin' });
    const cachedResponse = await cache.match(request);
    if (cachedResponse && isValidOfflineAssetResponse(new URL(asset, self.location.origin).pathname, cachedResponse)) {
      cached++;
    } else if (cachedResponse) {
      await cache.delete(request);
    }
  }
  return { total: safeAssets.length, cached, missing: safeAssets.length - cached };
}

async function cacheSessionAudio(rawUrls) {
  if (!Array.isArray(rawUrls)) return;
  const cache = await caches.open(AUDIO_CACHE_NAME);
  const urls = rawUrls.slice(0, MAX_SESSION_AUDIO_PRELOAD);
  for (const rawUrl of urls) {
    try {
      const url = new URL(rawUrl);
      const isApprovedQuranCdn = url.protocol === 'https:' && !url.search && !url.hash &&
        url.hostname === 'cdn.islamic.network' &&
        /^\/quran\/audio\/(64|128|192)\/(ar\.husary|ar\.minshawi|ar\.abdulbasitmurattal|ar\.abdurrahmaansudais|ar\.saoodshuraym|ar\.ahmedajamy|ar\.alafasy)\/[1-6][0-9]{0,3}\.mp3$/.test(url.pathname);
      if (!isApprovedQuranCdn) continue;
      const request = new Request(url.href, { mode: 'cors', credentials: 'omit' });
      if (await cache.match(request)) continue;
      const response = await fetchWithTimeout(request, {}, 10000);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const validResponse = response.status === 200 && response.type === 'cors' && contentType.startsWith('audio/');
      if (validResponse) {
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
  '/apple-touch-icon.png',
  '/favicon.svg'
];

async function precacheApplicationShell(cache) {
  await cache.addAll(STATIC_ASSETS);
  await precacheQuranFont(cache);

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
async function pruneUnlicensedEveryAyahAudioCache() {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const requests = await cache.keys();
    await Promise.all(requests.filter(request => {
      try { return new URL(request.url).hostname === 'everyayah.com'; }
      catch { return false; }
    }).map(request => cache.delete(request)));
  } catch (error) {
    console.warn('[WIRD SW] Unlicensed-provider audio cache cleanup skipped:', error);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name.startsWith('wird-app-') && name !== CACHE_NAME && name !== AUDIO_CACHE_NAME && name !== CONTENT_CACHE_NAME && name !== MUSHAF_PAGE_CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => pruneUnlicensedEveryAyahAudioCache())
      .then(() => self.clients.claim())
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
      fetchWithTimeout(req, {}, OFFLINE_NAVIGATION_REQUEST_TIMEOUT_MS).then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy1 = networkResponse.clone();
          const copy2 = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            cache.put('/', copy1);
            cache.put('/index.html', copy2);
          });
          return networkResponse;
        }
        // A reachable server can still be unhealthy (502/503/504). Prefer the
        // last known-good app shell for server failures, but preserve real 4xx
        // responses so missing resources and intentional access denials remain visible.
        if (networkResponse && networkResponse.status >= 500) {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/index.html')) || (await cache.match('/')) || networkResponse;
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

  // EveryAyah remains stream-only until a provider-wide offline-storage license is documented.
  const isEveryAyahAudio = url.protocol === 'https:' && !url.search && !url.hash && url.hostname === 'everyayah.com' &&
    /^\/data\/(Alafasy_128kbps|Husary_128kbps|Minshawy_Murattal_128kbps|Abdul_Basit_Murattal_192kbps|Ghamadi_40kbps)\/[0-9]{6}\.mp3$/.test(url.pathname);
  if (isEveryAyahAudio) {
    event.respondWith(fetch(req).catch((error) => {
      console.warn('[WIRD SW] Stream-only EveryAyah audio unavailable:', req.url, error);
      return Response.error();
    }));
    return;
  }

  // Only the reviewed Al Quran Cloud CDN recitations are eligible for offline cache.
  const isApprovedQuranCdnAudio = url.protocol === 'https:' && !url.search && !url.hash && url.hostname === 'cdn.islamic.network' &&
    /^\/quran\/audio\/(64|128|192)\/(ar\.husary|ar\.minshawi|ar\.abdulbasitmurattal|ar\.abdurrahmaansudais|ar\.saoodshuraym|ar\.ahmedajamy|ar\.alafasy)\/[1-6][0-9]{0,3}\.mp3$/.test(url.pathname);
  if (isApprovedQuranCdnAudio) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try { return await fetch(req); }
      catch (error) {
        console.warn('[WIRD SW] Approved Quran CDN audio unavailable offline:', req.url, error);
        return Response.error();
      }
    })());
    return;
  }

  // Cache public Google Fonts only; never cache authenticated or application API responses.
  // Cache only the pinned Hafs/KFQC printed-page artwork and ayah geometry.
  // Pages are downloaded on demand; the cache is bounded to the most recent 12 pages.
  const mushafPagePrefix = '/quran-ws/quran-svg/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/';
  const mushafPageFile = url.pathname.startsWith(mushafPagePrefix)
    ? url.pathname.slice(mushafPagePrefix.length)
    : '';
  const isPinnedMushafPage = mushafPageFile.length === 7 &&
    /^[0-9]{3}\.svg$/.test(mushafPageFile) &&
    Number(mushafPageFile.slice(0, 3)) >= 1 &&
    Number(mushafPageFile.slice(0, 3)) <= 604;
  if (url.protocol === 'https:' && url.hostname === 'raw.githubusercontent.com' &&
      isPinnedMushafPage && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(MUSHAF_PAGE_CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) {
        // Refresh insertion order so the bounded cache behaves as LRU.
        await cache.delete(req);
        await cache.put(req, cached.clone());
        return cached;
      }
      try {
        const response = await fetch(req);
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const validType = contentType.includes('image/svg+xml');
        if (response.status === 200 && response.type === 'cors' && validType) {
          await cache.put(req, response.clone());
          await trimMushafPageCache(cache);
        }
        return response;
      } catch (error) {
        console.warn('[WIRD SW] Printed Mushaf page unavailable:', req.url, error);
        return Response.error();
      }
    })());
    return;
  }

  if (url.href === QURAN_FONT_URL) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached && isValidQuranFontResponse(cached)) return cached;
      if (cached) await cache.delete(req);
      try {
        const response = await fetchWithTimeout(req, {}, 8000);
        if (isValidQuranFontResponse(response)) await cache.put(req, response.clone());
        return response;
      } catch {
        const fallback = await cache.match(req);
        return fallback && isValidQuranFontResponse(fallback) ? fallback : Response.error();
      }
    })());
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
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
  if (event.data && event.data.type === 'WIRD_GET_OFFLINE_PACKAGE_STATUS') {
    const port = event.ports && event.ports[0];
    if (!port) return;
    event.waitUntil(
      inspectFullOfflinePackage()
        .then((status) => port.postMessage({ type: 'status', ...status }))
        .catch((error) => port.postMessage({
          type: 'error',
          message: error instanceof Error ? error.message : 'تعذر فحص ملفات وِرد المحفوظة.'
        }))
    );
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
