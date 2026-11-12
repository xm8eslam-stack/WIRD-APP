import { listOfflinePublicAssets } from '../../scripts/offlinePublicAssets';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runPwaIntegrationTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    }
  }

  // 1. Manifest structure and icon paths
  test('public/manifest.json exists and has valid PWA schema and icon paths', () => {
    const manifestPath = path.resolve('./public/manifest.json');
    assert(fs.existsSync(manifestPath), 'manifest.json must exist in /public');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifest.name.includes('وِرد'), 'Manifest name must contain Arabic name');
    assert(manifest.short_name === 'وِرد', 'Short name must be Arabic');
    assert(manifest.lang === 'ar', 'Language must be Arabic');
    assert(manifest.dir === 'rtl', 'Direction must be RTL');
    assert(manifest.display === 'standalone', 'Display mode must be standalone');
    assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Manifest must declare icons');

    manifest.icons.forEach((icon: any) => {
      const iconFilePath = path.resolve('./public', icon.src.replace(/^\//, ''));
      assert(fs.existsSync(iconFilePath), `Icon file ${icon.src} declared in manifest must exist on disk`);
    });
  });

  // 2. Service Worker file and cache versioning
  test('public/sw.js exists with versioned caching and offline navigation fallback', () => {
    const swPath = path.resolve('./public/sw.js');
    assert(fs.existsSync(swPath), 'sw.js must exist in /public');

    const swContent = fs.readFileSync(swPath, 'utf8');
    assert(swContent.includes("CACHE_NAME = 'wird-app-v3'"), 'SW must declare the upgraded shell cache version');
    assert(swContent.includes("AUDIO_CACHE_NAME = 'wird-app-audio-v1'"), 'Session audio must use a separate persistent cache');
    assert(swContent.includes("MUSHAF_PAGE_CACHE_NAME = 'wird-app-mushaf-v1'"), 'Printed Mushaf pages must use a dedicated cache');
    assert(swContent.includes("url.hostname === 'raw.githubusercontent.com'"), 'Only the pinned Quran.ws Mushaf asset host may enter the page cache');
    assert(swContent.includes("url.protocol === 'https:'"), 'Mushaf page cache must reject insecure HTTP');
    assert(swContent.includes('await cache.delete(req);') && swContent.includes('await cache.put(req, cached.clone());'), 'Mushaf page cache must refresh recency on cache hits');
    assert(swContent.includes("/quran-ws/quran-svg/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/"), 'Mushaf caching must be pinned to a reviewed release and edition');
    assert(swContent.includes('MAX_MUSHAF_PAGE_CACHE_ENTRIES = 24'), 'Printed page cache must remain bounded');
    assert(swContent.includes('name !== MUSHAF_PAGE_CACHE_NAME'), 'Printed page cache must survive service-worker upgrades');
    assert(swContent.includes('WIRD_CACHE_SESSION_AUDIO'), 'SW must accept active-session audio cache messages');
    assert(swContent.includes('MAX_SESSION_AUDIO_PRELOAD = 20'), 'Audio preloading must be capped per session');
    assert(swContent.includes('MAX_AUDIO_CACHE_ENTRIES = 40'), 'Audio cache must have a bounded entry count');
    assert(swContent.includes('fetchWithTimeout(request, {}, 10000)'), 'Audio pre-caching must time out rather than hold the service-worker event indefinitely');
    const audioService = fs.readFileSync(path.resolve('./src/services/audioService.ts'), 'utf8');
    assert(audioService.includes('requestOfflineAudioCache'), 'Quran audio service must expose opportunistic offline pre-caching');
    const audioCacheHelper = audioService.split('export function requestOfflineAudioCache')[1] || '';
    assert(audioCacheHelper.includes("url.hostname === 'cdn.islamic.network'"), 'Only the reviewed Quran CDN may be requested for offline caching');
    assert(!audioCacheHelper.includes("url.hostname === 'everyayah.com'"), 'EveryAyah must remain stream-only until offline-storage rights are documented');
    const quranLibrary = fs.readFileSync(path.resolve('./src/components/library/QuranLibraryView.tsx'), 'utf8');
    const mushafReader = fs.readFileSync(path.resolve('./src/components/library/QuranMushafReader.tsx'), 'utf8');
    const ruqyahView = fs.readFileSync(path.resolve('./src/components/ruqyah/RuqyahView.tsx'), 'utf8');
    assert(quranLibrary.includes('requestOfflineAudioCache('), 'Quran library playback must pre-cache its upcoming audio segment');
    assert(mushafReader.includes('requestOfflineAudioCache('), 'Printed Mushaf playback must pre-cache its upcoming audio segment');
    assert(ruqyahView.includes('requestOfflineAudioCache('), 'Ruqyah playback must pre-cache its upcoming audio segment');

    assert(swContent.includes("url.hostname === 'everyayah.com'"), 'EveryAyah must remain a separately recognized stream-only source');
    assert(swContent.includes('if (isEveryAyahAudio)') && swContent.includes('event.respondWith(fetch(req)'), 'EveryAyah audio must stream from network without entering Cache Storage');
    assert(swContent.includes('pruneUnlicensedEveryAyahAudioCache'), 'Previously cached EveryAyah audio must be removed from the offline cache');
    assert(swContent.includes("url.hostname === 'cdn.islamic.network'"), 'Only the reviewed Quran CDN may use the offline audio cache');
    assert(swContent.includes("mode: 'cors'"), 'Approved Quran CDN audio caching must use CORS mode');
    assert(!swContent.includes("mode: 'no-cors'"), 'Opaque cross-origin EveryAyah responses must not be stored offline');
    assert(swContent.includes('name !== AUDIO_CACHE_NAME'), 'Audio cache must survive shell cache upgrades');
    assert(swContent.includes("event.waitUntil("), 'SW must handle install/activate wait');
    assert(swContent.includes("caches.delete"), 'SW must clean up old versioned caches on activate');
    assert(swContent.includes("req.mode === 'navigate'"), 'SW must implement SPA navigation fallback');
    assert(swContent.includes('OFFLINE_NAVIGATION_REQUEST_TIMEOUT_MS = 6000'), 'Navigation must fall back to the cached shell after a bounded network wait');
    assert(swContent.includes('fetchWithTimeout(req, {}, OFFLINE_NAVIGATION_REQUEST_TIMEOUT_MS)'), 'Navigation requests must use the bounded timeout before offline fallback');
    assert(swContent.includes("cache.match('/index.html')"), 'SW must fall back to /index.html offline');
    assert(swContent.includes('networkResponse.status >= 500'), 'SPA navigation must use the cached app shell when the server responds with 5xx');
    assert(swContent.includes('Preserve real 4xx'), 'SPA navigation must not hide intentional client errors behind the cached shell');
    assert(swContent.includes("PRECACHE_MANIFEST_URL = '/wird-precache-manifest.json'"), 'SW must load the build-generated app-shell manifest');
    assert(swContent.includes('precacheApplicationShell'), 'SW must precache the generated static dependency graph');
    assert(swContent.includes('cache.addAll(safeAssets)'), 'SW must cache entry JS/CSS atomically before activation');
    assert(swContent.includes('const manifestForCache = response.clone()'), 'SW must preserve the manifest response before consuming its JSON body');
    assert(!swContent.includes("tanzilReferenceData.json"), 'SW must NOT cache 2.9MB reference test dataset');
  });

  test('Memorization sessions request caching only for their active verse range', () => {
    const sessionContent = fs.readFileSync(path.resolve('./src/components/session/MemorizationSessionView.tsx'), 'utf8');
    assert(sessionContent.includes("type: 'WIRD_CACHE_SESSION_AUDIO'"), 'Session must request its audio cache');
    assert(sessionContent.includes('sessionAyahs.slice(currentAyahIndex, currentAyahIndex + 20)'), 'Session must bound the number of audio URLs sent');
  });

  test('Vite emits a bounded dependency manifest for the first-visit app shell', () => {
    const viteConfig = fs.readFileSync(path.resolve('./vite.config.ts'), 'utf8');
    assert(viteConfig.includes('offlineShellManifestPlugin'), 'Vite must install the offline shell manifest plugin');
    assert(viteConfig.includes('wird-precache-manifest.json'), 'Vite must emit a generated precache manifest');
    assert(viteConfig.includes('item.imports'), 'Static chunk dependencies must be traversed recursively');
    assert(viteConfig.includes('importedCss'), 'Imported CSS dependencies must be included');
    assert(!viteConfig.includes('dynamicImports'), 'Lazy routes and large Quran datasets must not be force-preloaded');
  });

  test('offline package is opt-in, resumable, and isolated from account/API data', () => {
    const viteConfig = fs.readFileSync(path.resolve('./vite.config.ts'), 'utf8');
    const worker = fs.readFileSync(path.resolve('./public/sw.js'), 'utf8');
    const client = fs.readFileSync(path.resolve('./src/services/offlinePreparationService.ts'), 'utf8');
    assert(viteConfig.includes('allAssets'), 'Build must emit all lazy code and static assets for explicit offline setup');
    assert(viteConfig.includes('item.type === \'chunk\''), 'Offline manifest must include lazy chunks');
    assert(worker.includes('wird-app-content-v1'), 'Full offline package must use a separate persistent cache');
    assert(worker.includes('name !== CONTENT_CACHE_NAME'), 'Downloaded offline package must survive service-worker upgrades');
    assert(worker.includes('WIRD_PREPARE_OFFLINE_PACKAGE'), 'Worker must support explicit offline preparation');
    assert(worker.includes('cache.match(request)'), 'Retry must skip assets already cached');
    assert(worker.includes('MAX_OFFLINE_PACKAGE_ASSETS = 2000'), 'Offline manifest must have a defensive asset-count limit');
    assert(worker.includes('OFFLINE_ASSET_REQUEST_TIMEOUT_MS = 30000'), 'Each offline asset request must have a bounded timeout');
    assert(worker.includes('isValidOfflineAssetResponse'), 'Only allowlisted code, image, font, and metadata responses may enter the offline package cache');
    assert(worker.includes('validCachedResponse'), 'Offline preparation must validate cached assets before skipping a download');
    assert(worker.includes('await cache.delete(request)'), 'Invalid cached assets must be discarded before retrying a verified download');

    assert(worker.includes('isSupportedOfflineAssetPath'), 'Worker must restrict offline assets to supported static file extensions');
    assert(worker.includes('image/svg+xml'), 'Worker must validate SVG content types before caching');
    assert(worker.includes('font/woff2'), 'Worker must validate font content types before caching');
    assert(viteConfig.includes('woff2?'), 'Build manifest must include local font assets');

    assert(worker.includes('offlinePackagePreparationInProgress'), 'Concurrent full-package downloads must be rejected safely');
    assert(worker.includes("url.pathname.startsWith('/api/')"), 'API routes must remain excluded from static offline caching');
    assert(client.includes('prepareWirdForOffline'), 'Client must expose an explicit offline preparation action');
    assert(client.includes('onProgress'), 'Client must report download progress');
    assert(client.includes('DEFAULT_OFFLINE_PREPARATION_TIMEOUT_MS'), 'The UI must not remain stuck indefinitely if the worker stops responding');
    assert(client.includes('onmessageerror'), 'MessageChannel transport errors must be surfaced to the UI');
    assert(worker.includes('WIRD_GET_OFFLINE_PACKAGE_STATUS'), 'Worker must expose a read-only offline package status check');
    assert(worker.includes('inspectFullOfflinePackage'), 'Worker status must count cached and missing package assets');
    assert(worker.includes('caches.match(PRECACHE_MANIFEST_URL)'), 'Offline status must use the cached manifest when available');
    assert(client.includes('getWirdOfflinePackageStatus'), 'Client must expose offline package status inspection');
    assert(client.includes('OfflinePackageStatus'), 'Offline status must report cached, total, and missing asset counts');

  });

  test('offline shell includes the favicon and official Uthmanic Quran font', () => {
    const worker = fs.readFileSync(path.resolve('./public/sw.js'), 'utf8');
    assert(worker.includes("'/favicon.svg'"), 'The linked favicon must be part of the app shell cache');
    assert(worker.includes('QURAN_FONT_URL'), 'Service worker must identify the official Uthmanic Quran font');
    assert(worker.includes('precacheQuranFont'), 'The official Quran font must be cached opportunistically during shell installation');
    assert(worker.includes('url.href === QURAN_FONT_URL'), 'Only the exact official Quran font URL may use the special font cache path');
    assert(worker.includes("url.hostname === 'fonts.googleapis.com'"), 'Google Fonts caching must use an exact host allowlist');
    assert(worker.includes("url.hostname === 'fonts.gstatic.com'"), 'Google font file caching must use an exact host allowlist');
  });

  // 3. HTML integration
  test('index.html links manifest.json and specifies theme-color and mobile web app tags', () => {
    const htmlPath = path.resolve('./index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert(html.includes('<link rel="manifest" href="/manifest.json"'), 'index.html must link /manifest.json');
    assert(html.includes('<meta name="theme-color" content="#064e3b"'), 'index.html must set theme-color');
    assert(html.includes('<meta name="apple-mobile-web-app-capable" content="yes"'), 'index.html must set apple web app capable');
  });

  // 4. Service Worker Registration in main.tsx
  test('src/main.tsx handles service worker registration with update detection', () => {
    const mainPath = path.resolve('./src/main.tsx');
    const mainContent = fs.readFileSync(mainPath, 'utf8');

    assert(mainContent.includes("navigator.serviceWorker.register('/sw.js')"), 'main.tsx must register /sw.js');
    assert(mainContent.includes("wird-pwa-update-available"), 'main.tsx must dispatch update event on new worker');
  });


  test('explicit offline package includes supported public assets but excludes the service worker script', () => {
    const assets = listOfflinePublicAssets(path.resolve('./public'));
    assert(assets.includes('/manifest.json'), 'Public web manifest must be included in the explicit offline package');
    assert(assets.includes('/icon-192.png'), 'Public PWA icons must be included in the explicit offline package');
    assert(assets.includes('/assets/aistudio/IMG_0140_900ee5d2.jpeg'), 'Nested public images must be included in the explicit offline package');
    assert(!assets.includes('/sw.js'), 'The service worker script must be updated through its own lifecycle, not the content package');
    const viteConfig = fs.readFileSync(path.resolve('./vite.config.ts'), 'utf8');
    assert(viteConfig.includes('listOfflinePublicAssets'), 'Vite must merge public static assets into the offline package manifest');
    assert(viteConfig.includes('allAssets: [...allAssets].sort()'), 'The generated offline manifest must contain deduplicated public and bundled assets');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('pwaIntegration.test')) {
  const res = runPwaIntegrationTests();
  if (res.failed > 0) process.exit(1);
}
