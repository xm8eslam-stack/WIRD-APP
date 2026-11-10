import { requestOfflineAudioCache } from './audioService';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runAudioServiceOfflineCacheTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log(`  ✅ [PASS]: ${name}`); }
    catch (error) { failed++; console.error(`  ❌ [FAIL]: ${name} - ${error instanceof Error ? error.message : error}`); }
  };

  await test('sends only allowlisted EveryAyah and curated Quran CDN audio URLs to the worker', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let sent: unknown;
    const worker = { postMessage: (message: unknown) => { sent = message; } };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { serviceWorker: { ready: Promise.resolve({ active: worker }), controller: worker } }
    });
    try {
      requestOfflineAudioCache([
        'https://everyayah.com/data/Alafasy_128kbps/001001.mp3',
        'https://cdn.islamic.network/quran/audio/128/ar.husary/1.mp3',
        'https://evil.example/data/Alafasy_128kbps/001001.mp3',
        'http://everyayah.com/data/Alafasy_128kbps/001001.mp3',
        'https://cdn.islamic.network/quran/audio/128/unreviewed-reciter/1.mp3'
      ]);
      await Promise.resolve();
      await Promise.resolve();
      const payload = sent as { type?: string; urls?: string[] } | undefined;
      assert(payload?.type === 'WIRD_CACHE_SESSION_AUDIO', 'The helper must use the existing worker message contract.');
      assert(payload.urls?.length === 2, 'Only the two reviewed HTTPS audio providers should be forwarded.');
      assert(payload.urls?.[0].startsWith('https://everyayah.com/'), 'EveryAyah audio should remain supported.');
      assert(payload.urls?.[1].startsWith('https://cdn.islamic.network/'), 'The curated Quran CDN should be supported.');
    } finally {
      if (previous) Object.defineProperty(globalThis, 'navigator', previous);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  await test('caps each audio cache request at twenty URLs', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let sent: unknown;
    const worker = { postMessage: (message: unknown) => { sent = message; } };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { serviceWorker: { ready: Promise.resolve({ active: worker }), controller: worker } }
    });
    try {
      const urls = Array.from({ length: 25 }, (_, index) =>
        `https://everyayah.com/data/Alafasy_128kbps/${String(index + 1).padStart(6, '0')}.mp3`
      );
      requestOfflineAudioCache(urls);
      await Promise.resolve();
      await Promise.resolve();
      const payload = sent as { urls?: string[] } | undefined;
      assert(payload?.urls?.length === 20, 'Audio pre-caching must never exceed the twenty-file request cap.');
    } finally {
      if (previous) Object.defineProperty(globalThis, 'navigator', previous);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  return { passed, failed };
}
