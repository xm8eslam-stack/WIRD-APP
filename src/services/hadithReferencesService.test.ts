import { getRelatedSahihHadiths } from './hadithReferencesService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runHadithReferencesServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const test = async (name: string, callback: () => void | Promise<void>) => {
    try {
      if (typeof localStorage !== 'undefined') {
        const staleKeys: string[] = [];
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key?.startsWith('wird_related_hadiths_v1:')) staleKeys.push(key);
        }
        staleKeys.forEach(key => localStorage.removeItem(key));
      }
      await callback();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      failed++;
      console.error(`  ❌ ${name}:`, error);
    }
  };

  try {
    await test('hadith client preserves source metadata and the exact Arabic matn', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({
        verseKey: '2:255',
        hadiths: [{
          name: 'صحيح البخاري',
          collection: 'bukhari',
          hadithNumber: '1',
          body: 'نص الحديث بالتشكيلِ كما وردَ',
          grades: [{ graded_by: 'ناقد موثق', grade: 'صحيح' }],
          authenticityBasis: 'explicit_grade',
          bookNumber: '1',
          chapterId: '2',
          chapterNumber: '3',
          chapterTitle: 'باب فضل العلم',
          referenceUrn: 654,
          urn: 321,
        }],
        hasMore: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const result = await getRelatedSahihHadiths(2, 255);
      assert(result.hadiths.length === 1, 'one verified hadith should be returned');
      assert(result.hadiths[0].body === 'نص الحديث بالتشكيلِ كما وردَ', 'Arabic matn must remain byte-for-byte unchanged');
      assert(result.hadiths[0].chapterTitle === 'باب فضل العلم' && result.hadiths[0].bookNumber === '1' && result.hadiths[0].referenceUrn === 654 && result.hadiths[0].urn === 321, 'both source identifiers and chapter metadata must be preserved');
    });

    await test('hadith client rejects a non-Sahih grade instead of silently displaying it', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({
        verseKey: '2:255',
        hadiths: [{ name: 'مصدر', collection: 'sample', hadithNumber: '7', body: 'متن', grades: [{ graded_by: 'ناقد', grade: 'حسن' }], authenticityBasis: 'explicit_grade' }],
        hasMore: false,
      }), { status: 200 });
      let rejected = false;
      try { await getRelatedSahihHadiths(2, 255); } catch { rejected = true; }
      assert(rejected, 'non-Sahih data must fail closed');
    });

    await test('hadith client accepts canonical Sahih collections without inventing an individual grade', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({
        verseKey: '12:12',
        hadiths: [{
          name: 'Sahih Muslim',
          collection: 'muslim',
          hadithNumber: '3',
          body: 'النص العربي كما ورد في المصدر',
          grades: [],
          authenticityBasis: 'sahih_collection',
        }],
        hasMore: false,
      }), { status: 200 });
      const result = await getRelatedSahihHadiths(12, 12);
      assert(result.hadiths.length === 1 && result.hadiths[0].authenticityBasis === 'sahih_collection', 'canonical Sahih collection classification should be preserved');
      assert(result.hadiths[0].grades.length === 0, 'no individual narrator grade may be fabricated');
    });

    await test('hadith client rejects malformed source records', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({
        verseKey: '2:255',
        hadiths: [{ name: 'مصدر', collection: 'sample', hadithNumber: '7', body: ' ', grades: [{ graded_by: 'ناقد', grade: 'صحيح' }], authenticityBasis: 'explicit_grade' }],
        hasMore: false,
      }), { status: 200 });
      let rejected = false;
      try { await getRelatedSahihHadiths(2, 255); } catch { rejected = true; }
      assert(rejected, 'empty hadith matn must be rejected');
    });

    await test('hadith client rejects a response for a different ayah', async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({ verseKey: '2:256', hadiths: [], hasMore: false }), { status: 200 });
      let rejected = false;
      try { await getRelatedSahihHadiths(2, 255); } catch { rejected = true; }
      assert(rejected, 'verse key mismatch must be rejected');
    });


    await test('returns previously verified hadith pages while offline', async () => {
      const values = new Map<string, string>();
      const storage = {
        get length() { return values.size; },
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      };
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
      let networkCalls = 0;
      globalThis.fetch = async () => {
        networkCalls++;
        return new Response(JSON.stringify({
          verseKey: '2:255',
          hadiths: [{
            name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1',
            body: 'متن صحيح محفوظ محلياً', grades: [], authenticityBasis: 'sahih_collection'
          }],
          hasMore: false,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      const online = await getRelatedSahihHadiths(2, 255, 1);
      globalThis.fetch = async () => { throw new TypeError('offline'); };
      const offline = await getRelatedSahihHadiths(2, 255, 1);
      assert(networkCalls === 1, 'The offline read must not make a second network request.');
      assert(online.hadiths[0].body === offline.hadiths[0].body, 'The exact validated Arabic matn must be preserved in the local cache.');
    });


    await test('expires hadith pages older than thirty days before offline display', async () => {
      const values = new Map<string, string>();
      const storage = {
        get length() { return values.size; },
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      };
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
      values.set('wird_related_hadiths_v1:2:255:page:1', JSON.stringify({
        verseKey: '2:255', cachedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        hadiths: [{ name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1', body: 'متن محفوظ قديم', grades: [], authenticityBasis: 'sahih_collection' }],
        hasMore: false,
      }));
      globalThis.fetch = async () => { throw new TypeError('offline'); };
      let rejected = false;
      try { await getRelatedSahihHadiths(2, 255, 1); }
      catch (error) { rejected = error instanceof Error && error.message.includes('لا توجد نسخة محفوظة'); }
      assert(rejected && values.size === 0, 'Expired content must be removed instead of silently displayed.');
    });

    await test('keeps the local hadith cache within its thirty-page bound', async () => {
      const values = new Map<string, string>();
      const storage = {
        get length() { return values.size; },
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      };
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
      for (let index = 0; index < 30; index++) {
        values.set(`wird_related_hadiths_v1:1:${index + 1}:page:1`, 'old');
      }
      globalThis.fetch = async () => new Response(JSON.stringify({
        verseKey: '2:255',
        hadiths: [{ name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1', body: 'متن صحيح جديد', grades: [], authenticityBasis: 'sahih_collection' }],
        hasMore: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      await getRelatedSahihHadiths(2, 255, 1);
      assert(values.size === 30, 'The cache must not exceed thirty pages.');
      assert(!values.has('wird_related_hadiths_v1:1:1:page:1'), 'The oldest page should be evicted first.');
      assert(values.has('wird_related_hadiths_v1:2:255:page:1'), 'The new validated page should be retained.');
    });

    await test('rejects a malformed local hadith cache instead of displaying unverified content', async () => {
      const values = new Map<string, string>();
      const storage = {
        get length() { return values.size; },
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      };
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
      values.set('wird_related_hadiths_v1:2:255:page:1', JSON.stringify({
        verseKey: '2:255',
        hadiths: [{ name: 'مصدر مزيف', collection: 'unknown', hadithNumber: '1', body: 'نص غير موثق', grades: [], authenticityBasis: 'sahih_collection' }],
        hasMore: false,
      }));
      globalThis.fetch = async () => { throw new TypeError('offline'); };
      let rejected = false;
      try { await getRelatedSahihHadiths(2, 255, 1); }
      catch (error) { rejected = error instanceof Error && error.message.includes('لا توجد نسخة محفوظة'); }
      assert(rejected, 'Malformed cached content must be removed and never shown as an authenticated hadith.');
      assert(values.size === 0, 'Invalid cached content must be deleted.');
    });

    await test('hadith client validates Quran coordinates before making a request', async () => {
      let called = false;
      globalThis.fetch = async () => { called = true; return new Response('{}'); };
      let rejected = false;
      try { await getRelatedSahihHadiths(115, 1); } catch (error) { rejected = error instanceof RangeError; }
      assert(rejected && !called, 'invalid coordinates must not trigger a network request');
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }

  return { passed, failed };
}
