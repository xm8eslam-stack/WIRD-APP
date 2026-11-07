import { RUQYAH_ITEMS } from '../data/ruqyahData';
import { getRuqyahDisplayText } from './ruqyahContentService';
import { fetchRuqyahApiData, resolveApiQuranEntry, resolveApiQuranEntryText } from './ruqyahApiService';

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
    await test('External Quran locator is sanitized and resolves only canonical WIRD text and metadata', () => {
      const local = RUQYAH_ITEMS.find(item => item.id === 'q-fatihah');
      assert(Boolean(local), 'Canonical Al-Fatiha item must exist');
      const hostileEntry = {
        id: 1,
        title: '1:1-7',
        arabic: 'نص تجريبي غير صحيح من المصدر',
        reference: 'مرجع غير موثق',
        introduction: 'شرح غير موثق',
        translation: 'ترجمة غير موثقة'
      } as unknown as import('./ruqyahApiService').RuqyahApiEntry;
      const resolved = resolveApiQuranEntry(hostileEntry);
      assert(resolved.text === getRuqyahDisplayText(local!), 'External Quran text must be replaced by canonical WIRD text');
      assert(resolved.text !== hostileEntry.arabic, 'Unverified API Arabic must never override canonical Quran text');
      assert(resolved.surahName === 'الفاتحة' && resolved.surahNumber === 1 &&
        resolved.startAyah === 1 && resolved.endAyah === 7, 'Surah metadata must come from WIRD canonical metadata');
      const arabicDigits = resolveApiQuranEntryText({ id: 2, title: '٢:١-٥' });
      const localBaqarah = RUQYAH_ITEMS.find(item => item.id === 'q-baqarah-1-5');
      assert(Boolean(localBaqarah) && arabicDigits === getRuqyahDisplayText(localBaqarah!), 'Arabic-Indic Quran coordinates must resolve correctly');
    });

    await test('External Quran entries without valid coordinates fail closed', () => {
      for (const title of ['Al-Fatiha', '115:1', '2:287', '2:5-1', 'Al-Baqarah 2:255']) {
        let rejected = false;
        try { resolveApiQuranEntryText({ id: 2, title }); } catch { rejected = true; }
        assert(rejected, 'Invalid external Quran title must be rejected: ' + title);
      }
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
