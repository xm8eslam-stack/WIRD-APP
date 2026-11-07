import quranAudioHandler from '../../api/quran-audio';
import { buildQuranAyahAudioUrl, FALLBACK_QURAN_RECITERS } from '../services/ruqyahAudioService';

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
    await test('Audio catalogue proxy rejects unsupported query and HTTP methods', async () => {
      const invalid = new MockResponse();
      await quranAudioHandler({ method: 'GET', query: { type: 'audio' }, headers: {} }, invalid);
      assert(invalid.statusCode === 400, 'Unsupported catalog type must be rejected');
      const post = new MockResponse();
      await quranAudioHandler({ method: 'POST', headers: {} }, post);
      assert(post.statusCode === 405, 'POST must be rejected');
    });

    await test('Unverified reciter catalogue is blocked before any upstream network request', async () => {
      let called = false;
      globalThis.fetch = (async () => { called = true; throw new Error('unverified provider must not be contacted'); }) as typeof fetch;
      const res = new MockResponse();
      await quranAudioHandler({ method: 'GET', query: { type: 'reciters' }, headers: {} }, res);
      assert(res.statusCode === 503 && res.body?.error === 'QURAN_AUDIO_SOURCE_NOT_VERIFIED',
        'Unverified audio catalogue must fail closed');
      assert(!called, 'No request may be sent to the unverified provider');
      assert(res.headers['Cache-Control'] === 'no-store', 'Disabled provider response must not be cached');
    });

    await test('Only named fallback reciters remain listed while playback is disabled', () => {
      assert(FALLBACK_QURAN_RECITERS.length >= 1, 'The known reciter list should remain available for future vetted audio');
      let rejected = false;
      try { buildQuranAyahAudioUrl('husary', 1); } catch { rejected = true; }
      assert(rejected, 'Audio URL builder must fail closed until a verified provider is approved');
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  return { passed, failed };
}
