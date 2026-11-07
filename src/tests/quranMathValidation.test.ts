import { QuranMath } from '../services/quranMath';

export async function runQuranMathValidationTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✓ ' + name); }
    catch (error) { failed++; console.error('  ✗ ' + name + ': ' + (error instanceof Error ? error.message : error)); }
  };
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  test('Surah-specific coordinates require safe integers and valid verse bounds', () => {
    assert(QuranMath.isValidCoordinate(1, 7), 'Al-Fatihah ayah 7 must be valid');
    assert(!QuranMath.isValidCoordinate(1, 8), 'Al-Fatihah ayah 8 must be invalid');
    assert(!QuranMath.isValidCoordinate(1.5, 1), 'Fractional Surah numbers must be invalid');
    assert(!QuranMath.isValidCoordinate(1, 1.5), 'Fractional ayah numbers must be invalid');
    assert(!QuranMath.isValidCoordinate(0, 1), 'Surah zero must be invalid');
    assert(!QuranMath.isValidCoordinate(115, 1), 'Surah 115 must be invalid');
    assert(!QuranMath.isValidCoordinate(Number.NaN, 1), 'NaN must be invalid');
  });

  test('Absolute indexes reject invalid coordinates with the documented zero sentinel', () => {
    assert(QuranMath.getAbsoluteAyahIndex(1, 1) === 1, 'First Quran ayah index must be 1');
    assert(QuranMath.getAbsoluteAyahIndex(1, 8) === 0, 'Invalid Surah-specific ayah must return zero');
    assert(QuranMath.getAbsoluteAyahIndex(1.5, 1) === 0, 'Fractional Surah must return zero');
  });

  test('Range counts return zero for invalid or reversed coordinates', () => {
    assert(QuranMath.countVersesBetween({ surahNumber: 1, ayahNumber: 1 }, { surahNumber: 1, ayahNumber: 7 }) === 7,
      'Valid inclusive range must count seven verses');
    assert(QuranMath.countVersesBetween({ surahNumber: 1, ayahNumber: 1 }, { surahNumber: 1, ayahNumber: 8 }) === 0,
      'Invalid endpoint must not produce a plausible count');
    assert(QuranMath.countVersesBetween({ surahNumber: 2, ayahNumber: 1 }, { surahNumber: 1, ayahNumber: 7 }) === 0,
      'Reversed range must return zero');
  });

  test('Absolute coordinate conversion rejects non-integer indexes', () => {
    let threw = false;
    try { QuranMath.getCoordinateFromAbsoluteIndex(1.25); } catch { threw = true; }
    assert(threw, 'Fractional absolute index must throw');
    threw = false;
    try { QuranMath.getCoordinateFromAbsoluteIndex(Number.POSITIVE_INFINITY); } catch { threw = true; }
    assert(threw, 'Infinite absolute index must throw');
  });

  test('Verse addition rejects invalid offsets and crosses Surah boundaries accurately', () => {
    const next = QuranMath.addVerses({ surahNumber: 1, ayahNumber: 7 }, 1);
    assert(next.surahNumber === 2 && next.ayahNumber === 1, 'Al-Fatihah ayah 7 + 1 must be Al-Baqarah ayah 1');
    let threw = false;
    try { QuranMath.addVerses({ surahNumber: 1, ayahNumber: 1 }, -1); } catch { threw = true; }
    assert(threw, 'Negative verse offset must throw');
    threw = false;
    try { QuranMath.addVerses({ surahNumber: 1, ayahNumber: 8 }, 1); } catch { threw = true; }
    assert(threw, 'Invalid starting coordinate must throw');
  });

  test('Chunk generation rejects invalid ranges and fractional chunk sizes', () => {
    assert(QuranMath.sliceRangeIntoChunks(
      { surahNumber: 1, ayahNumber: 1 },
      { surahNumber: 1, ayahNumber: 7 },
      2
    ).length === 4, 'Seven verses at chunk size two must produce four chunks');
    assert(QuranMath.sliceRangeIntoChunks(
      { surahNumber: 1, ayahNumber: 1 },
      { surahNumber: 1, ayahNumber: 7 },
      2.5
    ).length === 0, 'Fractional chunk size must be rejected');
    assert(QuranMath.sliceRangeIntoChunks(
      { surahNumber: 1, ayahNumber: 8 },
      { surahNumber: 1, ayahNumber: 9 },
      2
    ).length === 0, 'Invalid coordinates must not produce chunks');
  });

  test('Time estimates return zero for invalid verse counts', () => {
    assert(QuranMath.estimateMemorizationMinutes(0, 'beginner') === 0, 'Zero memorization verses must take zero minutes');
    assert(QuranMath.estimateMemorizationMinutes(Number.NaN, 'beginner') === 0, 'NaN memorization count must be rejected');
    assert(QuranMath.estimateRevisionMinutes(-1, 'minor') === 0, 'Negative revision count must be rejected');
  });

  return { passed, failed };
}
