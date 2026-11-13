import fs from 'node:fs';
import path from 'node:path';
import { RUQYAH_ITEMS, getRuqyahItemsByCategory } from '../data/ruqyahData';
import { ALL_SURAHS } from '../data/quranMeta';
import {
  getRuqyahAudioQueue,
  getRuqyahAudioQueueForItems,
  getRuqyahAyahs,
  getRuqyahDisplayText,
  loadRuqyahSurah,
  parseRuqyahVerseRange,
  validateRuqyahSurahChunk
} from './ruqyahContentService';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export async function runRuqyahContentServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error))); }
  };

  await test('Verse range parser accepts single verses and common dash variants', () => {
    assert(JSON.stringify(parseRuqyahVerseRange('255')) === JSON.stringify({ start: 255, end: 255 }), 'Single verse parsing failed');
    assert(JSON.stringify(parseRuqyahVerseRange(' 1 - 5 ')) === JSON.stringify({ start: 1, end: 5 }), 'Hyphen range parsing failed');
    assert(JSON.stringify(parseRuqyahVerseRange('1–5')) === JSON.stringify({ start: 1, end: 5 }), 'En dash range parsing failed');
    assert(JSON.stringify(parseRuqyahVerseRange('1—5')) === JSON.stringify({ start: 1, end: 5 }), 'Em dash range parsing failed');
  });

  await test('Verse range parser rejects malformed, reversed, zero, and unsafe coordinates', () => {
    for (const value of ['', '1-', '-5', '0', '5-1', '1-2-3', '1.5', '9007199254740992']) {
      let rejected = false;
      try { parseRuqyahVerseRange(value); } catch { rejected = true; }
      assert(rejected, 'Expected invalid range to be rejected: ' + value);
    }
  });

  await test('Every Quran item resolves the exact verified local range and endpoints', async () => {
    const items = RUQYAH_ITEMS.filter(item => item.type === 'quran');
    assert(items.length > 0, 'Quran Ruqyah items must exist');
    for (const item of items) {
      const range = parseRuqyahVerseRange(item.verseRange || '');
      const ayahs = await getRuqyahAyahs(item);
      assert(ayahs.length === range.end - range.start + 1, item.id + ' has an incomplete canonical range');
      assert(ayahs[0].numberInSurah === range.start, item.id + ' starts at the wrong ayah');
      assert(ayahs[ayahs.length - 1].numberInSurah === range.end, item.id + ' ends at the wrong ayah');
      assert(ayahs.every((ayah, index) => ayah.numberInSurah === range.start + index), item.id + ' is not sequential');
      const display = await getRuqyahDisplayText(item);
      assert(display === ayahs.map(ayah => ayah.text).join(' ۞ '), item.id + ' is not rendered from canonical Quran data');
    }
  });

  await test('Audio queue contains every ayah in canonical order with exact global numbers', async () => {
    const items = RUQYAH_ITEMS.filter(item => item.type === 'quran');
    for (const item of items) {
      const queue = await getRuqyahAudioQueue(item);
      const ayahs = await getRuqyahAyahs(item);
      assert(queue.length === ayahs.length, item.id + ' audio queue omitted verses');
      assert(queue.every((entry, index) =>
        entry.surahNumber === item.surahNumber &&
        entry.ayahNumber === ayahs[index].numberInSurah &&
        entry.globalAyahNumber === ayahs[index].number
      ), item.id + ' audio queue is not in canonical verse order');
    }
  });

  await test('All brief, medium, full, eye/envy, and illness Quran categories resolve completely', async () => {
    for (const category of ['brief', 'medium', 'full', 'eye_envy', 'illness'] as const) {
      const items = getRuqyahItemsByCategory(category).filter(item => item.type === 'quran');
      assert(items.length > 0, category + ' must contain Quran items');
      for (const item of items) {
        const ayahs = await getRuqyahAyahs(item);
        assert(ayahs.length > 0, category + '/' + item.id + ' resolved no verses');
      }
    }
  });

  await test('Combined category queues preserve item order and deduplicate repeated global ayahs', async () => {
    for (const category of ['brief', 'medium', 'full', 'eye_envy', 'illness'] as const) {
      const items = getRuqyahItemsByCategory(category).filter(item => item.type === 'quran');
      const rawQueues = await Promise.all(items.map(async item => ({
        item,
        ayahs: await getRuqyahAudioQueue(item)
      })));
      const expected = rawQueues.flatMap(({ item, ayahs }) => ayahs.map(ayah => ({
        ...ayah,
        itemId: item.id,
        title: item.title
      })));
      const seen = new Set<number>();
      const expectedDeduplicated = expected.filter(entry => {
        if (seen.has(entry.globalAyahNumber)) return false;
        seen.add(entry.globalAyahNumber);
        return true;
      });
      const actual = await getRuqyahAudioQueueForItems(items);
      assert(JSON.stringify(actual) === JSON.stringify(expectedDeduplicated), category + ' queue did not preserve ordered first occurrence while deduplicating');
      assert(new Set(actual.map(entry => entry.globalAyahNumber)).size === actual.length, category + ' queue contains duplicate global ayahs');
    }
  });

  await test('Non-Quran dua and guideline text remain synchronously available and unchanged', () => {
    const dua = RUQYAH_ITEMS.find(item => item.type === 'dua');
    const guideline = getRuqyahItemsByCategory('guidelines')[0];
    assert(Boolean(dua), 'A dua item must exist');
    assert(typeof getRuqyahDisplayText(dua!) === 'string' && getRuqyahDisplayText(dua!) === dua!.text, 'Dua text must remain synchronous and unchanged');
    assert(typeof getRuqyahDisplayText(guideline!) === 'string' && getRuqyahDisplayText(guideline!) === guideline!.text, 'Guideline text must remain synchronous and unchanged');
  });

  await test('Invalid Quran coordinates fail closed rather than using stored item text', async () => {
    const valid = RUQYAH_ITEMS.find(item => item.type === 'quran');
    assert(Boolean(valid), 'A Quran item must exist');
    for (const invalid of [
      { ...valid!, surahNumber: 115 },
      { ...valid!, surahNumber: 0 },
      { ...valid!, verseRange: '9999' },
      { ...valid!, verseRange: '8-2' },
      { ...valid!, surahNumber: undefined }
    ]) {
      let rejected = false;
      try { await getRuqyahAyahs(invalid); } catch { rejected = true; }
      assert(rejected, 'Invalid Quran coordinates were accepted');
    }
  });

  await test('Missing and corrupted Surah chunks fail closed', async () => {
    let missingRejected = false;
    try { await loadRuqyahSurah(0); } catch { missingRejected = true; }
    assert(missingRejected, 'Invalid/missing Surah coordinate must be rejected');
    const validSurah = await loadRuqyahSurah(1);
    const corruptions = [
      validSurah.slice(0, -1),
      validSurah.map((ayah, index) => index === 0 ? { ...ayah, numberInSurah: 2 } : ayah),
      validSurah.map((ayah, index) => index === 0 ? { ...ayah, number: 999 } : ayah),
      validSurah.map((ayah, index) => index === 0 ? { ...ayah, text: ' ' } : ayah),
      validSurah.map((ayah, index) => index === 0 ? { ...ayah, surahNumber: 2 } : ayah)
    ];
    for (const corrupted of corruptions) {
      let rejected = false;
      try { validateRuqyahSurahChunk(1, corrupted); } catch { rejected = true; }
      assert(rejected, 'A malformed Surah chunk was accepted');
    }
  });

  await test('Quran resolution has no manual-text fallback and no eager verified corpus dependency', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/ruqyahContentService.ts'), 'utf8');
    assert(!source.includes('verifiedAyahs'), 'Service must not statically import verifiedAyahs');
    assert(!source.includes('completeQuranData.json'), 'Service must not statically import completeQuranData.json');
    assert(source.includes('loadSurahVerses') && source.includes('await loadSurahVerses'), 'Service must use the existing lazy local loader');
    assert(!source.includes('item.text') || source.includes("if (item.type !== 'quran') return item.text"), 'Manual text may only be returned for non-Quran material');
  });

  await test('Repeated Surah resolution delegates caching to the existing loader', async () => {
    const repeatedSurahItems = RUQYAH_ITEMS.filter(item => item.type === 'quran' && item.surahNumber === 2);
    assert(repeatedSurahItems.length > 1, 'Expected repeated Surah 2 references');
    await Promise.all(repeatedSurahItems.map(item => getRuqyahAyahs(item)));
    const loaderSource = fs.readFileSync(path.resolve(process.cwd(), 'src/data/quranDataLoader.ts'), 'utf8');
    assert(loaderSource.includes('surahCache') && loaderSource.includes('surahCache.set(surahNumber, pending)'), 'Existing per-Surah cache must deduplicate concurrent requests');
    assert(ALL_SURAHS.length === 114, 'Surah metadata must cover the complete Quran');
  });

  return { passed, failed };
}
