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
  const originalTopicsFlag = process.env.RUQYAH_TOPICS_ENABLED;

  try {
    await test('Ruqyah proxy rejects non-GET requests and supports CORS preflight', async () => {
      const options = new MockResponse();
      await ruqyahHandler({ method: 'OPTIONS', headers: {} }, options);
      assert(options.statusCode === 204 && options.ended, 'OPTIONS must return 204');
      const post = new MockResponse();
      await ruqyahHandler({ method: 'POST', headers: {} }, post);
      assert(post.statusCode === 405 && post.body?.error === 'METHOD_NOT_ALLOWED', 'POST must be rejected');
    });

    await test('Ruqyah proxy rejects unreviewed category indexes before upstream access', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      let called = false;
      globalThis.fetch = (async () => { called = true; throw new Error('unexpected upstream call'); }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant-category' }, headers: { 'x-real-ip': '198.51.100.50' } }, res);
      assert(res.statusCode === 400 && res.body?.error === 'INVALID_RUQYAH_QUERY' && !called,
        'Provider-authored category names and descriptions must not be exposed');
    });

    await test('Ruqyah proxy validates query parameters before upstream access', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      let called = false;
      globalThis.fetch = (async () => { called = true; throw new Error('unexpected upstream call'); }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'bad', source: 'from-quran' }, headers: { 'x-real-ip': '198.51.100.51' } }, res);
      assert(res.statusCode === 400 && !called, 'Invalid query must be rejected before upstream access');
    });

    await test('Ruqyah proxy fails safely when the server-side API key is missing', async () => {
      delete process.env.ISLAMICAPI_API_KEY;
      let called = false;
      globalThis.fetch = (async () => { called = true; throw new Error('unexpected upstream call'); }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' }, headers: { 'x-real-ip': '198.51.100.52' } }, res);
      assert(res.statusCode === 503 && res.body?.error === 'RUQYAH_API_KEY_NOT_CONFIGURED', 'Missing key must be explicit');
      assert(!called, 'Missing key must not reach upstream');
    });

    await test('Ruqyah proxy returns only validated Quran coordinates and strips provider-authored content', async () => {
      process.env.ISLAMICAPI_API_KEY = 'private-test-key';
      let requestedUrl = '';
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({
          status: 'success',
          data: [{
            id: 1,
            title: 'Al-Fatiha 1:1-7',
            arabic: 'نص خارجي غير موثوق',
            reference: 'مرجع خارجي',
            introduction: 'شرح خارجي',
            translation: 'ترجمة خارجية'
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' }, headers: { 'x-real-ip': '198.51.100.53' } }, res);
      assert(res.statusCode === 200 && res.body?.status === 'success', 'Valid Quran locator must be returned');
      assert(JSON.stringify(res.body?.data) === JSON.stringify([{ id: 1, title: '1:1-7' }]),
        'Only normalized numeric Quran coordinates and the item ID may reach the browser');
      assert(!JSON.stringify(res.body).includes('نص خارجي') &&
        !JSON.stringify(res.body).includes('مرجع خارجي') &&
        !JSON.stringify(res.body).includes('شرح خارجي') &&
        !JSON.stringify(res.body).includes('ترجمة خارجية'),
        'Provider-authored Arabic, references, introductions, and translations must be stripped');
      assert(requestedUrl.includes('lang=ar') && requestedUrl.includes('api_key=private-test-key'), 'Proxy must call Arabic API using server key');
      assert(!JSON.stringify(res.body).includes('private-test-key'), 'API key must never be returned to browser');
      assert(res.headers['Cache-Control'].includes('s-maxage=3600'), 'Successful content must be CDN-cacheable');
    });

    await test('Ruqyah proxy rejects third-party Sunnah text even when the provider returns a valid response', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      let called = false;
      globalThis.fetch = (async () => {
        called = true;
        return new Response(JSON.stringify({
          status: 'success',
          data: { id: 3, title: 'Muslim : 2708', arabic: 'دعاء غير مراجع', reference: 'Muslim : 2708' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-sunnah', id: '3' }, headers: { 'x-real-ip': '198.51.100.56' } }, res);
      assert(res.statusCode === 400 && res.body?.error === 'INVALID_RUQYAH_QUERY', 'Third-party Sunnah source must be rejected');
      assert(!called, 'Unverified hadith/dua payload must never reach the browser');
    });

    await test('Ruqyah proxy rate limiting cannot be bypassed with a spoofed forwarded-for header', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      let upstreamCalls = 0;
      globalThis.fetch = (async () => {
        upstreamCalls++;
        return new Response(JSON.stringify({
          status: 'success',
          data: [{ title: 'Brief Ruqya', subcategories: [] }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;
      let finalResponse: MockResponse | null = null;
      for (let index = 0; index < 31; index++) {
        const response = new MockResponse();
        await ruqyahHandler({
          method: 'GET',
          query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' },
          headers: {
            'x-real-ip': '203.0.113.207',
            'x-forwarded-for': `198.51.100.${index + 1}`
          }
        }, response);
        if (index < 30) assert(response.statusCode === 200, 'The first 30 requests from one real IP should pass');
        finalResponse = response;
      }
      assert(finalResponse?.statusCode === 429 && finalResponse.headers['Retry-After'] === '60',
        'Changing the untrusted forwarded-for header must not bypass the real-IP rate limit');
      assert(upstreamCalls === 30, 'The rate-limited 31st request must not reach the provider');
    });

    await test('Ruqyah proxy rejects oversized upstream payloads before JSON parsing', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      let bodyRead = false;
      globalThis.fetch = (async () => {
        const response = new Response(JSON.stringify({ status: 'success', data: [] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(3 * 1024 * 1024)
          }
        });
        const body = response.body!;
        const originalGetReader = body.getReader.bind(body);
        (body as any).getReader = () => {
          bodyRead = true;
          return originalGetReader();
        };
        return response;
      }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' }, headers: { 'x-real-ip': '198.51.100.208' } }, res);
      assert(res.statusCode === 502 && res.body?.error === 'INVALID_RUQYAH_SOURCE_RESPONSE',
        'Oversized declared upstream response must be rejected');
      assert(!bodyRead, 'The proxy must reject an oversized declared response before reading its body');
    });

    await test('Ruqyah proxy streams chunked provider bodies with a hard byte cap', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      globalThis.fetch = (async () => new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
          controller.close();
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' }, headers: { 'x-real-ip': '198.51.100.210' } }, res);
      assert(res.statusCode === 502 && res.body?.error === 'INVALID_RUQYAH_SOURCE_RESPONSE',
        'Chunked provider response above the byte limit must be rejected');
    });

    await test('Ruqyah educational topics remain disabled until content review is explicitly enabled', async () => {
      delete process.env.RUQYAH_TOPICS_ENABLED;
      let called = false;
      globalThis.fetch = (async () => { called = true; throw new Error('unexpected upstream call'); }) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({
        method: 'GET',
        query: { type: 'topic', topic: 'introduction-to-ruqyah' },
        headers: { 'x-real-ip': '198.51.100.211' }
      }, res);
      assert(res.statusCode === 400 && res.body?.error === 'INVALID_RUQYAH_QUERY' && !called,
        'Topic endpoints must remain unavailable unless the server-side review flag is enabled');
    });

    await test('Ruqyah proxy rejects unknown topic content block types', async () => {
      process.env.RUQYAH_TOPICS_ENABLED = 'true';
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      globalThis.fetch = (async () => new Response(JSON.stringify({
        status: 'success',
        data: { title: 'مقالة', sub_id: 1, content: [{ type: 'script', content: '<script>alert(1)</script>' }] }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      const res = new MockResponse();
      await ruqyahHandler({
        method: 'GET',
        query: { type: 'topic', topic: 'introduction-to-ruqyah' },
        headers: { 'x-real-ip': '198.51.100.209' }
      }, res);
      assert(res.statusCode === 502 && res.body?.error === 'INVALID_RUQYAH_SOURCE_RESPONSE',
        'Unknown topic block types must be rejected before reaching the client');
    });

    await test('Ruqyah proxy rejects HTML fallbacks and malformed upstream payloads', async () => {
      process.env.ISLAMICAPI_API_KEY = 'test-secret';
      globalThis.fetch = (async () => new Response('<!doctype html><html></html>', {
        status: 200, headers: { 'Content-Type': 'text/html' }
      })) as typeof fetch;
      const html = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' }, headers: { 'x-real-ip': '198.51.100.54' } }, html);
      assert(html.statusCode === 502 && html.body?.error === 'INVALID_RUQYAH_SOURCE_RESPONSE', 'HTML fallback must be rejected');

      globalThis.fetch = (async () => new Response(JSON.stringify({ status: 'success', data: [{ id: 1, title: 'missing numeric Quran coordinates' }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      const malformed = new MockResponse();
      await ruqyahHandler({ method: 'GET', query: { type: 'instant', program: 'brief-ruqya', source: 'from-quran' }, headers: { 'x-real-ip': '198.51.100.55' } }, malformed);
      assert(malformed.statusCode === 502 && malformed.body?.error === 'INVALID_RUQYAH_SOURCE_RESPONSE', 'Malformed item data must be rejected');
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ISLAMICAPI_API_KEY;
    else process.env.ISLAMICAPI_API_KEY = originalKey;
    if (originalTopicsFlag === undefined) delete process.env.RUQYAH_TOPICS_ENABLED;
    else process.env.RUQYAH_TOPICS_ENABLED = originalTopicsFlag;
  }

  return { passed, failed };
}
