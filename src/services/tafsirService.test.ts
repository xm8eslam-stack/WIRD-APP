import { buildTafsirCacheKey, getTafsirMuyassar } from './tafsirService';

export async function runTafsirServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  await test('Tafsir cache keys are deterministic and verse-specific', () => {
    assert(buildTafsirCacheKey(2, 255) === 'wird_tafsir_muyassar_v1_s2_a255', 'Cache key must include exact Surah and ayah coordinates');
    assert(buildTafsirCacheKey(2, 255) !== buildTafsirCacheKey(2, 256), 'Different ayahs must never collide');
  });

  await test('Invalid Quran coordinates are rejected before making a network request', async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => { called = true; throw new Error('Fetch must not run'); }) as typeof fetch;
    try {
      let rejected = false;
      try { await getTafsirMuyassar(115, 1); } catch { rejected = true; }
      assert(rejected && !called, 'Invalid Surah must reject without network access');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Tafsir response is validated, parsed, and cached after the first request', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestCount++;
      assert(String(input).includes('/ayah/114/6/book/27809'), 'Request must target the configured Tafsir Muyassar book');
      return new Response(JSON.stringify({
        book: { id: 27809, name: 'التفسير الميسر' },
        content: [{ text: 'المعنى الأول.' }, { text: 'المعنى الثاني.' }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    try {
      const first = await getTafsirMuyassar(114, 6);
      assert(first.source === 'network', 'First result must be marked as network');
      assert(first.text === 'المعنى الأول.\n\nالمعنى الثاني.', 'Content blocks must be joined without losing text');
      const second = await getTafsirMuyassar(114, 6);
      assert(second.source === 'cache', 'Second result must come from local memory cache');
      assert(requestCount === 1, 'Cached request must not call the API again');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Unexpected book IDs are rejected instead of showing unrelated tafsir', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ book: { id: 1 }, content: [{ text: 'wrong book' }] }), { status: 200 })) as typeof fetch;
    try {
      let rejected = false;
      try { await getTafsirMuyassar(114, 5); } catch { rejected = true; }
      assert(rejected, 'Unexpected book identifier must be rejected');
    } finally { globalThis.fetch = originalFetch; }
  });

  return { passed, failed };
}