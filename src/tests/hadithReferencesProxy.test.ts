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
    await test('hadith HTML is converted to clean safe Arabic text', async () => {
      const clean = __testing.normalizeHadithBody('<p>قال النبي <strong>ﷺ</strong></p><p>خيرٌ &amp; بركة &#x627;</p><script>alert(1)</script><a href="javascript:alert(2)">نص</a>');
      assert(clean === 'قال النبي ﷺ\\nخيرٌ & بركة ا\\nنص', 'HTML structure, entities and unsafe blocks must be normalized without losing Arabic text');
      assert(!clean.includes('<') && !clean.includes('alert') && !clean.includes('javascript:'), 'HTML tags and executable content must never reach the UI');
    });
    await test('hadith extraction rejects malformed envelopes and excludes non-Sahih judgments', async () => {
      assert(__testing.extractSahihHadiths({ hadiths: [], has_more: false })?.length === 0, 'an empty valid page should remain an empty page');
      assert(__testing.extractSahihHadiths({ hadiths: [], has_more: 'false' }) === null, 'invalid pagination metadata must reject the envelope');
      const nonSahih = { hadiths: [{ name: 'مصدر', collection: 'sample', hadithNumber: '7', urn: 7, hadith: [{ lang: 'ar', body: 'متن', grades: [{ graded_by: 'ناقد', grade: 'حسن' }] }] }], has_more: false };
      assert(__testing.extractSahihHadiths(nonSahih)?.length === 0, 'a Hasan-only record must not be presented as Sahih');
      const bukhariWithoutIndividualGrade = { hadiths: [{ name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '8', urn: 8, hadith: [{ lang: 'ar', body: '<p>متن <strong>صحيح</strong></p><p>ﷺ</p>', grades: [] }] }], has_more: false };
      const acceptedCollection = __testing.extractSahihHadiths(bukhariWithoutIndividualGrade);
      assert(acceptedCollection?.length === 1 && acceptedCollection[0].authenticityBasis === 'sahih_collection' && acceptedCollection[0].grades.length === 0, 'Bukhari collection authenticity must be labelled without fabricating an individual grade');
      const englishGrade = { hadiths: [{ urn: 700, hadith: [{ lang: 'en', urn: 211, body: 'English', grades: [{ graded_by: 'Scholar', grade: 'Sahih' }] }] }], has_more: false };
      const arabicWithDifferentTextUrn = { hadiths: [{ name: 'مصدر', collection: 'sample', hadithNumber: '9', urn: 900, hadith: [{ lang: 'ar', urn: 111, body: 'متن عربي', grades: [] }] }], has_more: false };
      const officialPairs = { hadith_references: [{ arabic_urn: 111, english_urn: 211 }] };
      assert(__testing.extractSahihHadiths(arabicWithDifferentTextUrn, englishGrade)?.length === 0, 'different language-specific URNs must not be guessed or joined by hadith number');
      const joined = __testing.extractSahihHadiths(arabicWithDifferentTextUrn, englishGrade, officialPairs);
      assert(joined?.length === 1 && joined[0].grades.some(grade => grade.grade === 'Sahih'), 'the official Arabic-English URN pair must join the explicit Sahih judgment');
    });
    await test('hadith proxy joins language-specific text URNs through official references', async () => {
      process.env.QF_CLIENT_ID = 'test-client'; process.env.QF_CLIENT_SECRET = 'test-secret'; process.env.QF_CONTENT_SCOPE = 'content.hadith.read'; process.env.QF_ENV = 'prelive'; __testing.clearTokenCache();
      let apiCalls = 0; let authHeader = '';
      const fetcher: typeof fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith('/oauth2/token')) { authHeader = new Headers(init?.headers).get('authorization') || ''; return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 }); }
        apiCalls++;
        if (url.includes('/hadith_references/by_ayah/41:7?language=ar')) return new Response(JSON.stringify({ hadith_references: [
          { id: 1, collection: 'bukhari', hadith_number: '1', arabic_urn: 111, english_urn: 211 },
          { id: 2, collection: 'sample', hadith_number: '2', arabic_urn: 112, english_urn: 212 }
        ] }), { status: 200 });
        if (url.includes('language=en')) return new Response(JSON.stringify({ hadiths: [
          { urn: 922, name: 'Sahih al-Bukhari', collection: 'bukhari', hadithNumber: '1', hadith: [{ lang: 'en', urn: 211, body: 'English text', grades: [] }] },
          { urn: 933, name: 'Other source', collection: 'other', hadithNumber: '2', hadith: [{ lang: 'en', urn: 212, body: 'English text', grades: [{ graded_by: 'Verified scholar', grade: 'Sahih' }] }] }
        ], has_more: false }), { status: 200 });
        return new Response(JSON.stringify({ hadiths: [
          { name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1', urn: 222, bookNumber: '1', hadith: [{ lang: 'ar', chapterNumber: '1', chapterTitle: 'بدء الوحي', urn: 111, body: 'متن صحيح', grades: [] }] },
          { name: 'مصدر آخر', collection: 'other', hadithNumber: '2', urn: 333, hadith: [{ lang: 'ar', body: 'متن آخر', urn: 112, grades: [] }] }
        ], has_more: false }), { status: 200 });
      };
      const res = mockResponse(); await hadithReferencesHandler({ method: 'GET', query: { surah: '41', ayah: '7' }, headers: { 'x-forwarded-for': '198.51.100.203' } }, res, { fetch: fetcher });
      assert(res.statusCode === 200 && res.body.verseKey === '41:7' && res.body.page === 1 && res.body.hasMore === false, 'success response must preserve verse coordinates and pagination');
      assert(res.body.hadiths.length === 2 && res.body.hadiths[0].body === 'متن صحيح\\nﷺ' && res.body.hadiths[1].body === 'متن آخر', 'Arabic hadith text must be joined with its matching English grading record using the official URN pair');
      assert(res.body.hadiths[0].authenticityBasis === 'sahih_collection' && res.body.hadiths[1].authenticityBasis === 'explicit_grade', 'canonical collections and explicit Sahih judgments must retain distinct authenticity bases');
      assert(res.body.hadiths[0].bookNumber === '1' && res.body.hadiths[0].chapterTitle === 'بدء الوحي' && res.body.hadiths[0].chapterNumber === '1' && res.body.hadiths[0].referenceUrn === 222 && res.body.hadiths[0].urn === 111, 'top-level reference URN and Arabic hadith URN must remain distinct');
      assert(authHeader.startsWith('Basic ') && apiCalls === 3, 'backend must use client credentials and fetch references, Arabic text and English grading metadata');
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
