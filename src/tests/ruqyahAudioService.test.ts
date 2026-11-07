import quranAudioHandler from '../../api/quran-audio';
import {
  buildQuranAyahAudioUrl,
  FALLBACK_QURAN_RECITERS,
  fetchQuranReciters,
  QURAN_AUDIO_PROVIDER
} from '../services/ruqyahAudioService';

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
      quranAudioHandler({ method: 'GET', query: { type: 'audio' }, headers: {} }, invalid);
      assert(invalid.statusCode === 400, 'Unsupported catalog type must be rejected');
      const post = new MockResponse();
      quranAudioHandler({ method: 'POST', headers: {} }, post);
      assert(post.statusCode === 405, 'POST must be rejected');
      assert(post.headers.Allow === 'GET, OPTIONS', 'Allowed methods must be explicit');
      const ambiguous = new MockResponse();
      quranAudioHandler({ method: 'GET', query: { type: ['reciters', 'audio'] }, headers: {} }, ambiguous);
      assert(ambiguous.statusCode === 400, 'Repeated query values must be rejected');
    });

    await test('Audio catalogue exposes only the curated Al Quran Cloud reciters', () => {
      const res = new MockResponse();
      quranAudioHandler({ method: 'GET', query: { type: 'reciters' }, headers: {} }, res);
      assert(res.statusCode === 200, 'Approved catalogue must be available');
      assert(res.body?.provider === QURAN_AUDIO_PROVIDER.name, 'Provider identity must be explicit');
      assert(res.body?.reciters?.length === FALLBACK_QURAN_RECITERS.length, 'Only the curated set may be returned');
      assert(res.body.reciters.every((reciter: any) => FALLBACK_QURAN_RECITERS.some(approved => approved.id === reciter.id)),
        'No dynamic or unapproved reciter IDs may be returned');
      assert(res.headers['X-Content-Type-Options'] === 'nosniff', 'MIME sniffing must be disabled');
      assert(res.headers['Cache-Control'].includes('max-age=86400'), 'Curated catalogue should be cacheable');
    });

    await test('Audio CDN URLs use a fixed HTTPS host and approved edition identifiers', () => {
      assert(
        buildQuranAyahAudioUrl('ar.husary', 1) ===
          'https://cdn.islamic.network/quran/audio/128/ar.husary/1.mp3',
        'Al-Husary must use the documented 128 kbps edition path'
      );
      assert(
        buildQuranAyahAudioUrl('ar.sudais', 1) ===
          'https://cdn.islamic.network/quran/audio/192/ar.sudais/1.mp3',
        'Al-Sudais must use the provider-documented 192 kbps edition path'
      );
      assert(buildQuranAyahAudioUrl('ar.alafasy', 6236).endsWith('/ar.alafasy/6236.mp3'),
        'Last canonical ayah should produce a bounded URL');
      assert(FALLBACK_QURAN_RECITERS.length === 7, 'Expected seven curated reciters');
    });

    await test('Audio URL builder rejects path injection and invalid Quran coordinates', () => {
      for (const [reciter, ayah] of [
        ['https://evil.example', 1],
        ['ar.husary/../../evil', 1],
        ['unknown.reciter', 1],
        ['ar.husary', 0],
        ['ar.husary', 6237],
        ['ar.husary', -1],
        ['ar.husary', 1.5]
      ] as Array<[string, number]>) {
        let rejected = false;
        try { buildQuranAyahAudioUrl(reciter, ayah); } catch { rejected = true; }
        assert(rejected, 'Invalid audio input must be rejected: ' + reciter + '/' + ayah);
      }
    });

    await test('Reciter catalogue client validates provider identity and every approved ID', async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({
        provider: QURAN_AUDIO_PROVIDER.name,
        reciters: FALLBACK_QURAN_RECITERS
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      const reciters = await fetchQuranReciters();
      assert(reciters.length === 7, 'All approved reciters should be returned');
    });

    await test('Reciter catalogue client rejects HTML, wrong provider, and unknown reciters', async () => {
      globalThis.fetch = (async () => new Response('<!doctype html>', {
        status: 200, headers: { 'Content-Type': 'text/html' }
      })) as typeof fetch;
      let rejectedHtml = false;
      try { await fetchQuranReciters(); } catch { rejectedHtml = true; }
      assert(rejectedHtml, 'HTML must not be accepted as JSON');

      globalThis.fetch = (async () => new Response(JSON.stringify({
        provider: 'Unknown provider',
        reciters: FALLBACK_QURAN_RECITERS
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      let rejectedProvider = false;
      try { await fetchQuranReciters(); } catch { rejectedProvider = true; }
      assert(rejectedProvider, 'Unexpected provider must be rejected');

      globalThis.fetch = (async () => new Response(JSON.stringify({
        provider: QURAN_AUDIO_PROVIDER.name,
        reciters: [{ id: 'unreviewed', name: 'Unknown', arabicName: 'مجهول' }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      let rejectedReciter = false;
      try { await fetchQuranReciters(); } catch { rejectedReciter = true; }
      assert(rejectedReciter, 'Unknown reciter must be rejected');

      globalThis.fetch = (async () => new Response(JSON.stringify({
        provider: QURAN_AUDIO_PROVIDER.name,
        reciters: FALLBACK_QURAN_RECITERS.map((reciter, index) =>
          index === 0 ? { ...reciter, arabicName: 'قارئ آخر' } : reciter
        )
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      let rejectedAttribution = false;
      try { await fetchQuranReciters(); } catch { rejectedAttribution = true; }
      assert(rejectedAttribution, 'Reciter display attribution must match the reviewed allowlist exactly');
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  return { passed, failed };
}
