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
    assert(swContent.includes("const mushafPagePrefix = '/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/'"), 'Mushaf cache path must match the actual raw.githubusercontent.com URL pathname');
    assert(swContent.includes("url.hostname === 'raw.githubusercontent.com' &&\\n      isPinnedMushafPage"), 'Only exact pinned raw Mushaf pages may enter the cache');
    assert(swContent.includes('MAX_MUSHAF_PAGE_CACHE_ENTRIES = 24'), 'Printed page cache must remain bounded');
    assert(swContent.includes('name !== MUSHAF_PAGE_CACHE_NAME'), 'Printed page cache must survive service-worker upgrades');
    assert(swContent.includes('WIRD_CACHE_SESSION_AUDIO'), 'SW must accept active-session audio cache messages');
    assert(swContent.includes('MAX_SESSION_AUDIO_PRELOAD = 20'), 'Audio preloading must be capped per session');
    assert(swContent.includes('MAX_AUDIO_CACHE_ENTRIES = 40'), 'Audio cache must have a bounded entry count');
    assert(swContent.includes("url.hostname !== 'everyayah.com'"), 'Only the approved recitation host may be pre-cached');
    assert(swContent.includes("mode: 'no-cors'"), 'Cross-origin audio must support opaque CDN responses');
    assert(swContent.includes('name !== AUDIO_CACHE_NAME'), 'Audio cache must survive shell cache upgrades');
    assert(swContent.includes("event.waitUntil("), 'SW must handle install/activate wait');
    assert(swContent.includes("caches.delete"), 'SW must clean up old versioned caches on activate');
    assert(swContent.includes("req.mode === 'navigate'"), 'SW must implement SPA navigation fallback');
    assert(swContent.includes("cache.match('/index.html')"), 'SW must fall back to /index.html offline');
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
    assert(viteConfig.includes('allAssets'), 'Build must emit all lazy JS/CSS assets for explicit offline setup');
    assert(viteConfig.includes('item.type === \'chunk\''), 'Offline manifest must include lazy chunks');
    assert(worker.includes('wird-app-content-v1'), 'Full offline package must use a separate persistent cache');
    assert(worker.includes('name !== CONTENT_CACHE_NAME'), 'Downloaded offline package must survive service-worker upgrades');
    assert(worker.includes('WIRD_PREPARE_OFFLINE_PACKAGE'), 'Worker must support explicit offline preparation');
    assert(worker.includes('cache.match(request)'), 'Retry must skip assets already cached');
    assert(worker.includes('MAX_OFFLINE_PACKAGE_ASSETS = 2000'), 'Offline manifest must have a defensive asset-count limit');
    assert(worker.includes('OFFLINE_ASSET_REQUEST_TIMEOUT_MS = 30000'), 'Each offline asset request must have a bounded timeout');
    assert(worker.includes('validContentType'), 'Only valid JavaScript/CSS responses may enter the offline package cache');
    assert(worker.includes('offlinePackagePreparationInProgress'), 'Concurrent full-package downloads must be rejected safely');
    assert(worker.includes("url.pathname.startsWith('/api/')"), 'API routes must remain excluded from static offline caching');
    assert(client.includes('prepareWirdForOffline'), 'Client must expose an explicit offline preparation action');
    assert(client.includes('onProgress'), 'Client must report download progress');
    assert(client.includes('DEFAULT_OFFLINE_PREPARATION_TIMEOUT_MS'), 'The UI must not remain stuck indefinitely if the worker stops responding');
    assert(client.includes('onmessageerror'), 'MessageChannel transport errors must be surfaced to the UI');
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

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('pwaIntegration.test')) {
  const res = runPwaIntegrationTests();
  if (res.failed > 0) process.exit(1);
}
