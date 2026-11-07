import ruqyahHandler from '../../api/ruqyah';

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

export async function runRuqyahProxyTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error))); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ISLAMICAPI_API_KEY;

  try {
    await test('Ruqyah proxy rejects non-GET requests and supports CORS preflight', async () => {
      const options = new MockResponse();
      await ruqyahHandler({ method: 'OPTIONS', headers: {} }, options);
      assert(options.statusCode === 204 && options.ended, 'OPTIONS must return 204');
      const post = new MockResponse();
      await ruqyahHandler({ method: 'POST', headers: {} }, post);
      assert(post.statusCode === 405 && post.body?.error === 'METHOD_NOT_ALLOWED', 'POST must be rejected');
    });

    await test('Ruqyah proxy validates query parameters before upstream access', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      let called = false;
      globalThis.fetch = (async () => { called = true; throw new Error('unexpected upstream call'); }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'bad', source: 'from-quran' }, headers: { 'x-forwarded-for': '198.51.100.51' } }, res);
      assert(res.statusCode === 400 && !called, 'Invalid query must be rejected before upstream access');
    });

    await test('Ruqyah proxy fails safely when the server-side API key is missing', async () => {
      delete process.env.ISLAMICAPI_API_KEY;
      let called = false;
      globalThis.fetch = (async () => { called = true; throw new Error('unexpected upstream call'); }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant-category' }, headers: { 'x-forwarded-for': '198.51.100.52' } }, res);
      assert(res.statusCode === 503 && res.body?.error === 'RUQYAH_API_KEY_NOT_CONFIGURED', 'Missing key must be explicit');
      assert(!called, 'Missing key must not reach upstream');
    });

    await test('Ruqyah proxy returns validated Arabic data without exposing the API key', async () => {
      process.env.ISLAMICAPI_API_KEY = 'private-test-key';
      let requestedUrl = '';
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({
          status: 'success',
          data: [{ title: 'Brief Ruqya', subcategories: [] }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant-category' }, headers: { 'x-forwarded-for': '198.51.100.53' } }, res);
      assert(res.statusCode === 200 && res.body?.status === 'success', 'Valid payload must be returned');
      assert(requestedUrl.includes('lang=ar') && requestedUrl.includes('api_key=private-test-key'), 'Proxy must call Arabic API using server key');
      assert(!JSON.stringify(res.body).includes('private-test-key'), 'API key must never be returned to browser');
      assert(res.headers['Cache-Control'].includes('s-maxage=3600'), 'Successful content must be CDN-cacheable');
    });

    await test('Ruqyah proxy accepts a documented single-entry object response', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      globalThis.fetch = (async () => new Response(JSON.stringify({
        status: 'success',
        data: { id: 3, title: 'Muslim : 2708', arabic: 'أعوذ بكلمات الله التامات', reference: 'Muslim : 2708' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-sunnah', id: '3' }, headers: { 'x-forwarded-for': '198.51.100.56' } }, res);
      assert(res.statusCode === 200 && res.body?.data?.id === 3, 'Single-entry object payload must be accepted');
    });

    await test('Ruqyah proxy rejects HTML fallbacks and malformed upstream payloads', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      globalThis.fetch = (async () => new Response('<!doctype html><html></html>', {
        status: 200, headers: { 'Content-Type': 'text/html' }
      })) as typeof fetch;
      const html = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant-category' }, headers: { 'x-forwarded-for': '198.51.100.54' } }, html);
      assert(html.statusCode === 502 && html.body?.error === 'INVALID_RUQYAH_SOURCE_RESPONSE', 'HTML fallback must be rejected');

      globalThis.fetch = (async () => new Response(JSON.stringify({ status: 'success', data: [{ id: 1, title: 'missing Arabic' }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      const malformed = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' }, headers: { 'x-forwarded-for': '198.51.100.55' } }, malformed);
      assert(malformed.statusCode === 502 && malformed.body?.error === 'INVALID_RUQYAH_SOURCE_RESPONSE', 'Malformed item data must be rejected');
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ISLAMICAPI_API_KEY;
    else process.env.ISLAMICAPI_API_KEY = originalKey;
  }

  return { passed, failed };
}
