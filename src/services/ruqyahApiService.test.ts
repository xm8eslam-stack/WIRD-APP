import { readFileSync } from 'node:fs';
import { RUQYAH_ITEMS } from '../data/ruqyahData';
import { getRuqyahDisplayText } from './ruqyahContentService';
import {
  fetchRuqyahApiData,
  matchesApiQuranEntry,
  readRuqyahApiIndexCache,
  resolveApiQuranEntry,
  resolveApiQuranEntryText,
  writeRuqyahApiIndexCache
} from './ruqyahApiService';

export async function runRuqyahApiServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error))); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const originalFetch = globalThis.fetch;

  try {
    await test('External Quran locator is sanitized and resolves only canonical WIRD text and metadata', async () => {
      const local = RUQYAH_ITEMS.find(item => item.id === 'q-fatihah');
      assert(Boolean(local), 'Canonical Al-Fatiha item must exist');
      const untrustedArabic = 'نص تجريبي غير صحيح من المصدر';
      const hostileEntry = {
        id: 1,
        title: '1:1-7',
        arabic: untrustedArabic,
        reference: 'مرجع غير موثق',
        introduction: 'شرح غير موثق',
        translation: 'ترجمة غير موثقة'
      } as unknown as import('./ruqyahApiService').RuqyahApiEntry;
      const resolved = resolveApiQuranEntry(hostileEntry);
      const canonicalText = await resolveApiQuranEntryText(hostileEntry);
      assert(resolved.text === '', 'API metadata resolver must not retain provider verse text');
      assert(canonicalText === await getRuqyahDisplayText(local!), 'External Quran text must be replaced by canonical WIRD text');
      assert(canonicalText !== untrustedArabic, 'Unverified API Arabic must never override canonical Quran text');
      assert(resolved.surahName === 'الفاتحة' && resolved.surahNumber === 1 &&
        resolved.startAyah === 1 && resolved.endAyah === 7, 'Surah metadata must come from WIRD canonical metadata');
      const arabicDigits = await resolveApiQuranEntryText({ id: 2, title: '٢:١-٥' });
      const localBaqarah = RUQYAH_ITEMS.find(item => item.id === 'q-baqarah-1-5');
      assert(Boolean(localBaqarah) && arabicDigits === await getRuqyahDisplayText(localBaqarah!), 'Arabic-Indic Quran coordinates must resolve correctly');
    });

    await test('API library treats provider entries as coordinates only and renders WIRD-local Quran text', () => {
      const service = readFileSync(new URL('./ruqyahApiService.ts', import.meta.url), 'utf8');
      const library = readFileSync(new URL('../components/ruqyah/RuqyahApiLibrary.tsx', import.meta.url), 'utf8');
      assert(service.includes("return { ...locator, text: '' }"), 'API resolver must discard provider verse text');
      assert(!library.includes('entry.arabic') && !library.includes('entry.text') && !library.includes('entry.translation'), 'API library must never render provider-authored Quran text');
      assert(library.includes('<QuranText surahNumber={resolved.surahNumber}'), 'API library must render by canonical local Surah/ayah coordinates');
    });

    await test('External Quran entries without valid coordinates fail closed', async () => {
      for (const title of ['Al-Fatiha', '115:1', '2:287', '2:5-1', 'Al-Baqarah 2:255', '2:255, 3:33', '2:255 3:33']) {
        let rejected = false;
        try { await resolveApiQuranEntryText({ id: 2, title }); } catch { rejected = true; }
        assert(rejected, 'Invalid external Quran title must be rejected: ' + title);
      }
    });

    await test('External Quran entries with invalid provider IDs fail closed', async () => {
      for (const id of [0, -1, 1.5, 1_000_000_000, Number.MAX_SAFE_INTEGER, '0', 'abc', '1234567890']) {
        let rejected = false;
        try { await resolveApiQuranEntryText({ id, title: '2:255' }); } catch { rejected = true; }
        assert(rejected, 'Invalid external Quran item ID must be rejected: ' + String(id));
      }
    });


    await test('Canonical Quran locator search uses only verified surah metadata and supports Arabic numerals', () => {
      const entry = { id: 2, title: '2:1-5' };
      assert(matchesApiQuranEntry(entry, 'البقرة'), 'Canonical Arabic surah name should match');
      assert(matchesApiQuranEntry(entry, 'البقرة ٢:١-٥'), 'Full Arabic surah name and verse phrase should match');
      assert(matchesApiQuranEntry(entry, '2:1-5'), 'ASCII surah/ayah range should match');
      assert(matchesApiQuranEntry(entry, '٢:١-٥'), 'Arabic-Indic surah/ayah range should match');
      assert(matchesApiQuranEntry(entry, '5'), 'A verse number should match the canonical range');
      assert(!matchesApiQuranEntry(entry, 'الفاتحة'), 'A different canonical surah name must not match');
      assert(!matchesApiQuranEntry({ id: 2, title: '115:1' }, 'البقرة'), 'Invalid locators must never appear in search results');
      assert(matchesApiQuranEntry(entry, ''), 'An empty search must retain every valid entry');
    });

    await test('API client rejects HTML SPA fallbacks and malformed success envelopes', async () => {
      globalThis.fetch = (async () => new Response('<!doctype html><html></html>', {
        status: 200, headers: { 'Content-Type': 'text/html' }
      })) as typeof fetch;
      let htmlRejected = false;
      try { await fetchRuqyahApiData({ type: 'instant', program: 'brief-ruqya', source: 'from-quran' }); } catch { htmlRejected = true; }
      assert(htmlRejected, 'HTML fallback must be rejected');

      globalThis.fetch = (async () => new Response(JSON.stringify({ data: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let envelopeRejected = false;
      try { await fetchRuqyahApiData({ type: 'instant', program: 'brief-ruqya', source: 'from-quran' }); } catch { envelopeRejected = true; }
      assert(envelopeRejected, 'Invalid success envelope must be rejected');
    });

    await test('validated numeric Quran index cache survives a temporary provider outage and expires safely', () => {
      const data = new Map<string, string>();
      const storage = {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); }
      };
      const savedAt = new Date(2026, 0, 1, 10);
      const entries = [{ id: 1, title: '1:1-7' }, { id: 2, title: '2:1-5' }];
      assert(writeRuqyahApiIndexCache('brief-ruqya', entries, storage, savedAt), 'valid numeric locators should be cached');
      const cached = readRuqyahApiIndexCache('brief-ruqya', storage, new Date(2026, 0, 2, 10));
      assert(cached?.entries.length === 2 && cached.entries[0].title === '1:1-7', 'cache should return normalized verified coordinates');
      assert(!writeRuqyahApiIndexCache('brief-ruqya', [{ id: 3, title: '115:1' }], storage, savedAt), 'invalid coordinates must not enter the cache');
      assert(readRuqyahApiIndexCache('brief-ruqya', storage, new Date(2026, 4, 5)) === null, 'cache older than its TTL should expire');
      data.set('wird.ruqyah.index-cache.v1:a-long-ruqya', '{broken');
      assert(readRuqyahApiIndexCache('a-long-ruqya', storage, savedAt) === null, 'corrupt cache should fail closed');
    });

    await test('API client distinguishes rejected keys and temporary upstream outages', async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'RUQYAH_API_KEY_REJECTED' }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let rejectedKeyMessage = '';
      try { await fetchRuqyahApiData({ type: 'instant', program: 'brief-ruqya', source: 'from-quran' }); }
      catch (error) { rejectedKeyMessage = error instanceof Error ? error.message : String(error); }
      assert(rejectedKeyMessage.includes('ISLAMICAPI_API_KEY'), 'rejected key should be actionable and not appear as a generic HTTP 502');

      globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'RUQYAH_SOURCE_UNAVAILABLE' }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let unavailableMessage = '';
      try { await fetchRuqyahApiData({ type: 'instant', program: 'brief-ruqya', source: 'from-quran' }); }
      catch (error) { unavailableMessage = error instanceof Error ? error.message : String(error); }
      assert(unavailableMessage.includes('غير متاح مؤقتًا'), 'provider outage should be explained as temporary');

      globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'RUQYAH_INTERNAL_ERROR' }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      })) as typeof fetch;
      let internalMessage = '';
      try { await fetchRuqyahApiData({ type: 'instant', program: 'brief-ruqya', source: 'from-quran' }); }
      catch (error) { internalMessage = error instanceof Error ? error.message : String(error); }
      assert(internalMessage.includes('خطأ داخلي مؤقت'), 'unexpected proxy failures should have a safe retry-oriented message');
    });

    await test('API client reports missing server key without exposing any client-side key option', async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({
        error: 'RUQYAH_API_KEY_NOT_CONFIGURED'
      }), { status: 503, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      let message = '';
      try { await fetchRuqyahApiData({ type: 'instant', program: 'brief-ruqya', source: 'from-quran' }); }
      catch (error) { message = error instanceof Error ? error.message : String(error); }
      assert(message.includes('مفتاح API'), 'Missing key should have a clear setup message');
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  return { passed, failed };
}
