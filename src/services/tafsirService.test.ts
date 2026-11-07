import { buildTafsirCacheKey, getTafsir, getTafsirMuyassar } from './tafsirService';

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
      let invalidAyahRejected = false;
      try { await getTafsirMuyassar(1, 8); } catch { invalidAyahRejected = true; }
      assert(rejected && invalidAyahRejected && !called, 'Invalid Surah and out-of-range ayah must reject without network access');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Tafsir response is validated, parsed, and cached after the first request', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestCount++;
      assert(String(input).includes('/api/tafsir?surah=114&ayah=6'), 'Request must target the configured Tafsir Muyassar book');
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

  await test('HTML SPA fallback is rejected with a clear API routing error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(
      '<!doctype html><html><body>Application shell</body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )) as typeof fetch;
    try {
      let message = '';
      try { await getTafsir(109, 1, 90); }
      catch (error) { message = error instanceof Error ? error.message : String(error); }
      assert(message.includes('صفحة HTML') && message.includes('مسار API'),
        'HTML fallback must identify the missing API route');
      assert(!message.includes('Unexpected token'), 'Raw JSON parser errors must not reach the UI');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('HTTP 404 and 500 JSON errors are surfaced before content validation', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let notFound = '';
      try { await getTafsir(109, 2, 90); }
      catch (error) { notFound = error instanceof Error ? error.message : String(error); }
      globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'UPSTREAM_FAILURE' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let serverError = '';
      try { await getTafsir(109, 3, 90); }
      catch (error) { serverError = error instanceof Error ? error.message : String(error); }
      assert(notFound.includes('HTTP 404') && serverError.includes('HTTP 500'),
        'Non-success HTTP responses must not be parsed as Tafsir data');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Malformed JSON and empty Tafsir content are rejected without caching', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response('{not-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let malformed = '';
      try { await getTafsir(108, 1, 91); }
      catch (error) { malformed = error instanceof Error ? error.message : String(error); }
      globalThis.fetch = (async () => new Response(JSON.stringify({
        book: { id: 94, name: 'تفسير البغوي' },
        content: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let missing = '';
      try { await getTafsir(108, 2, 94); }
      catch (error) { missing = error instanceof Error ? error.message : String(error); }
      assert(malformed.includes('JSON غير صالح') && missing.includes('لا يتوفر نص تفسير'),
        'Malformed JSON and missing content must produce explicit localized errors');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Network failures produce an actionable Arabic connection message', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
    try {
      let message = '';
      try { await getTafsir(107, 1, 14); }
      catch (error) { message = error instanceof Error ? error.message : String(error); }
      assert(message.includes('تعذر الاتصال بخادم التفسير'),
        'Network errors must be translated instead of leaking browser fetch details');
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