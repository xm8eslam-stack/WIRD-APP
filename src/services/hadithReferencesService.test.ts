import { getRelatedSahihHadiths } from './hadithReferencesService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runHadithReferencesServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const originalFetch = globalThis.fetch;
  const test = async (name: string, callback: () => void | Promise<void>) => {
    try { await callback(); passed++; console.log(`  ✅ ${name}`); }
    catch (error) { failed++; console.error(`  ❌ ${name}:`, error); }
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

    await test('hadith client validates Quran coordinates before making a request', async () => {
      let called = false;
      globalThis.fetch = async () => { called = true; return new Response('{}'); };
      let rejected = false;
      try { await getRelatedSahihHadiths(115, 1); } catch (error) { rejected = error instanceof RangeError; }
      assert(rejected && !called, 'invalid coordinates must not trigger a network request');
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  return { passed, failed };
}
