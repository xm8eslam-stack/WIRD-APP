import quranAudioHandler from '../../api/quran-audio';
import { buildQuranAyahAudioUrl } from './ruqyahAudioService';

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

export async function runRuqyahAudioServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error))); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const originalFetch = globalThis.fetch;

  try {
    await test('Audio catalog proxy rejects unsupported query and HTTP methods', async () => {
      const invalid = new MockResponse();
      await quranAudioHandler({ method: 'GET', query: { type: 'audio' }, headers: { 'x-forwarded-for': '198.51.100.71' } }, invalid);
      assert(invalid.statusCode === 400, 'Unsupported catalog type must be rejected');
      const post = new MockResponse();
      await quranAudioHandler({ method: 'POST', headers: {} }, post);
      assert(post.statusCode === 405, 'POST must be rejected');
    });

    await test('Audio catalog proxy returns validated reciters and caches the response', async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({
        count: 2,
        reciters: [
          { id: 'husary', name: 'Husary', arabicName: 'الحصري', r2Path: 'unused' },
          { id: 'minshawy-murattal', name: 'Minshawy', arabicName: 'المنشاوي' }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      const res = new MockResponse();
      await quranAudioHandler({ method: 'GET', query: { type: 'reciters' }, headers: { 'x-forwarded-for': '198.51.100.72' } }, res);
      assert(res.statusCode === 200 && res.body?.reciters?.length === 2, 'Valid reciter catalog must be returned');
      assert(res.body.reciters[0].id === 'husary', 'Reciter IDs must remain unchanged');
      assert(!('r2Path' in res.body.reciters[0]), 'Unneeded upstream internals must not be exposed');
      assert(res.headers['Cache-Control'].includes('s-maxage=86400'), 'Catalog should be cached');
    });

    await test('Audio catalog proxy rejects malformed and HTML source responses', async () => {
      globalThis.fetch = (async () => new Response('<html>fallback</html>', {
        status: 200, headers: { 'Content-Type': 'text/html' }
      })) as typeof fetch;
      const html = new MockResponse();
      await quranAudioHandler({ method: 'GET', query: { type: 'reciters' }, headers: { 'x-forwarded-for': '198.51.100.73' } }, html);
      assert(html.statusCode === 502, 'HTML fallback must be rejected');
      globalThis.fetch = (async () => new Response(JSON.stringify({
        reciters: [{ id: 'bad/id', name: 'Bad', arabicName: 'سيئ' }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      const malformed = new MockResponse();
      await quranAudioHandler({ method: 'GET', query: { type: 'reciters' }, headers: { 'x-forwarded-for': '198.51.100.74' } }, malformed);
      assert(malformed.statusCode === 502, 'Malformed reciter IDs must be rejected');
    });

    await test('Audio URL builder accepts only known reciter slug format and global Quran coordinates', () => {
      assert(buildQuranAyahAudioUrl('husary', 1) === 'https://alfurqan.online/api/v1/audio/husary/1', 'Audio URL format mismatch');
      assert(buildQuranAyahAudioUrl('minshawy-murattal', 6236).endsWith('/6236'), 'Last Quran ayah must be addressable');
      for (const [reciter, ayah] of [['bad/id', 1], ['husary', 0], ['husary', 6237], ['husary', 1.5]] as Array<[string, number]>) {
        let rejected = false;
        try { buildQuranAyahAudioUrl(reciter, ayah); } catch { rejected = true; }
        assert(rejected, 'Invalid audio URL input must be rejected');
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  return { passed, failed };
}
