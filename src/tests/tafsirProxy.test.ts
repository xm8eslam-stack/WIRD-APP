import tafsirHandler from '../../api/tafsir';

class MockResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body: any = null;
  ended = false;
  setHeader(name: string, value: string) { this.headers[name] = value; return this; }
  status(code: number) { this.statusCode = code; return this; }
  json(body: any) { this.body = body; return this; }
  end() { this.ended = true; return this; }
}

export async function runTafsirProxyTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  await test('Tafsir proxy rejects invalid coordinates without contacting upstream', async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => { called = true; throw new Error('Unexpected upstream call'); }) as typeof fetch;
    const res = new MockResponse();
    try {
      await tafsirHandler({ method: 'GET', query: { surah: '115', ayah: '1' }, headers: { 'x-forwarded-for': '198.51.100.1' } }, res);
      assert(res.statusCode === 400 && res.body?.error === 'INVALID_QURAN_COORDINATES', 'Invalid coordinates must return HTTP 400');
      assert(!called, 'Invalid coordinates must not reach upstream');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Tafsir proxy forwards only the fixed book and caches successful responses', async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ book: { id: 27809 }, content: [{ text: 'تفسير موثوق.' }, { text: 'تكملة المعنى.' }] }), { status: 200 });
    }) as typeof fetch;
    const res = new MockResponse();
    try {
      await tafsirHandler({ method: 'GET', query: { surah: '2', ayah: '255' }, headers: { 'x-forwarded-for': '198.51.100.2' } }, res);
      assert(res.statusCode === 200, 'Valid request must return HTTP 200');
      assert(requestedUrl.endsWith('/ayah/2/255/book/27809'), 'Proxy must use the fixed Tafsir Muyassar book ID');
      assert(res.body?.book?.id === 27809 && res.body?.content?.length === 2, 'Proxy must return validated tafsir content');
      assert(res.headers['Cache-Control'].includes('s-maxage=86400'), 'Successful content must be CDN-cacheable');
      assert(res.headers['Access-Control-Allow-Origin'] === '*', 'Read-only endpoint must provide explicit CORS response');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Tafsir proxy rejects unexpected upstream book responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ book: { id: 1 }, content: [{ text: 'wrong book' }] }), { status: 200 })) as typeof fetch;
    const res = new MockResponse();
    try {
      await tafsirHandler({ method: 'GET', query: { surah: '3', ayah: '7' }, headers: { 'x-forwarded-for': '198.51.100.3' } }, res);
      assert(res.statusCode === 502 && res.body?.error === 'INVALID_TAFSIR_SOURCE_RESPONSE', 'Unexpected upstream book must be rejected');
    } finally { globalThis.fetch = originalFetch; }
  });

  await test('Tafsir proxy enforces per-IP request limits', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ book: { id: 27809 }, content: [{ text: 'تفسير.' }] }), { status: 200 })) as typeof fetch;
    try {
      let lastResponse = new MockResponse();
      for (let index = 0; index < 31; index++) {
        lastResponse = new MockResponse();
        await tafsirHandler({ method: 'GET', query: { surah: '4', ayah: '1' }, headers: { 'x-forwarded-for': '198.51.100.4' } }, lastResponse);
      }
      assert(lastResponse.statusCode === 429 && lastResponse.body?.error === 'RATE_LIMITED', 'Request 31 must be rate limited');
    } finally { globalThis.fetch = originalFetch; }
  });

  return { passed, failed };
}