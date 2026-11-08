import hadithReferencesHandler, { __testing } from '../../api/hadith-references';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function mockResponse() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: null, setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this; }, status(code: number) { this.statusCode = code; return this; }, json(value: unknown) { this.body = value; return this; } };
  return res;
}

export async function runHadithReferencesProxyTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0; let failed = 0;
  const test = async (name: string, callback: () => void | Promise<void>) => { try { await callback(); passed++; console.log(`  ✅ ${name}`); } catch (error) { failed++; console.error(`  ❌ ${name}:`, error); } };
  const beforeId = process.env.QF_CLIENT_ID; const beforeSecret = process.env.QF_CLIENT_SECRET; const beforeScope = process.env.QF_CONTENT_SCOPE; const beforeEnv = process.env.QF_ENV;
  try {
    await test('hadith proxy rejects invalid coordinates before upstream access', async () => { let called = false; const res = mockResponse(); await hadithReferencesHandler({ method: 'GET', query: { surah: '41', ayah: '55' }, headers: { 'x-forwarded-for': '198.51.100.201' } }, res, { fetch: async () => { called = true; return new Response('{}'); } }); assert(res.statusCode === 400 && !called, 'invalid coordinates should stop before upstream'); });
    await test('hadith proxy stays fail-closed when server credentials are absent', async () => { delete process.env.QF_CLIENT_ID; delete process.env.QF_CLIENT_SECRET; const res = mockResponse(); await hadithReferencesHandler({ method: 'GET', query: { surah: '41', ayah: '7' }, headers: { 'x-forwarded-for': '198.51.100.202' } }, res, { fetch: async () => new Response('{}') }); assert(res.statusCode === 503 && res.body.error === 'HADITH_REFERENCES_NOT_CONFIGURED', 'missing secrets should not expose a fallback source'); });
    await test('hadith rate limiting ignores spoofed forwarded-for headers', async () => { for (let index = 0; index < 21; index++) { const res = mockResponse(); await hadithReferencesHandler({ method: 'GET', query: { surah: '41', ayah: '7' }, headers: { 'x-forwarded-for': `198.51.100.${index}` }, socket: { remoteAddress: '192.0.2.254' } }, res, { fetch: async () => new Response('{}') }); if (index < 20) assert(res.statusCode === 503, 'first twenty requests should reach fail-closed configuration check'); else assert(res.statusCode === 429, 'spoofed values must not evade throttling'); } });
    await test('hadith extraction rejects malformed envelopes and excludes non-Sahih judgments', async () => {
      assert(__testing.extractSahihHadiths({ hadiths: [], has_more: false })?.length === 0, 'an empty valid page should remain an empty page');
      assert(__testing.extractSahihHadiths({ hadiths: [], has_more: 'false' }) === null, 'invalid pagination metadata must reject the envelope');
      const nonSahih = { hadiths: [{ name: 'مصدر', collection: 'sample', hadithNumber: '7', hadith: [{ lang: 'ar', body: 'متن', grades: [{ graded_by: 'ناقد', grade: 'حسن' }] }] }], has_more: false };
      assert(__testing.extractSahihHadiths(nonSahih)?.length === 0, 'a Hasan-only record must not be presented as Sahih');
    });
    await test('only explicit sahih grades are returned and credentials remain on the server', async () => {
      process.env.QF_CLIENT_ID = 'test-client'; process.env.QF_CLIENT_SECRET = 'test-secret'; process.env.QF_CONTENT_SCOPE = 'content.hadith.read'; process.env.QF_ENV = 'prelive'; __testing.clearTokenCache();
      let apiCalls = 0; let authHeader = '';
      const fetcher: typeof fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith('/oauth2/token')) { authHeader = new Headers(init?.headers).get('authorization') || ''; return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 }); }
        apiCalls++;
        const hadiths = [
          { name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1', bookNumber: '1', hadith: [{ lang: 'ar', chapterNumber: '1', chapterTitle: 'بدء الوحي', urn: 111, body: 'متن صحيح', grades: [{ graded_by: 'ناقد', grade: 'صحيح' }] }] },
          { name: 'كتاب آخر', collection: 'other', hadithNumber: '2', hadith: [{ lang: 'ar', body: 'متن غير مصنف صحيحًا', grades: [{ graded_by: 'ناقد', grade: 'حسن' }] }] }
        ];
        return new Response(JSON.stringify({ hadiths, has_more: false }), { status: 200 });
      };
      const res = mockResponse(); await hadithReferencesHandler({ method: 'GET', query: { surah: '41', ayah: '7' }, headers: { 'x-forwarded-for': '198.51.100.203' } }, res, { fetch: fetcher });
      assert(res.statusCode === 200 && res.body.verseKey === '41:7' && res.body.page === 1 && res.body.hasMore === false, 'success response must preserve verse coordinates and pagination');
      assert(res.body.hadiths.length === 1 && res.body.hadiths[0].body === 'متن صحيح', 'only explicit Sahih grades must be returned');
      assert(res.body.hadiths[0].bookNumber === '1' && res.body.hadiths[0].chapterTitle === 'بدء الوحي' && res.body.hadiths[0].chapterNumber === '1' && res.body.hadiths[0].urn === 111, 'source book, chapter, and urn metadata must be preserved');
      assert(authHeader.startsWith('Basic ') && apiCalls === 1, 'backend must use client credentials and make one content request');
      assert(!JSON.stringify(res.body).includes('test-secret') && !JSON.stringify(res.body).includes('test-token'), 'secrets and tokens must never reach the client');
    });
  } finally {
    __testing.clearTokenCache();
    if (beforeId === undefined) delete process.env.QF_CLIENT_ID; else process.env.QF_CLIENT_ID = beforeId;
    if (beforeSecret === undefined) delete process.env.QF_CLIENT_SECRET; else process.env.QF_CLIENT_SECRET = beforeSecret;
    if (beforeScope === undefined) delete process.env.QF_CONTENT_SCOPE; else process.env.QF_CONTENT_SCOPE = beforeScope;
    if (beforeEnv === undefined) delete process.env.QF_ENV; else process.env.QF_ENV = beforeEnv;
  }
  return { passed, failed };
}
