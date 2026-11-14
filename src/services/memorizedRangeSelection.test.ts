import {
  getFullSurahMemorizedRange,
  getJuzMemorizedRanges,
  normalizeMemorizedRanges
} from './memorizedRangeSelection';

export function runMemorizedRangeSelectionTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name, error); }
  };
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  test('full Surah selection returns its exact complete range', () => {
    const range = getFullSurahMemorizedRange(2);
    assert(range.surahNumber === 2 && range.startAyah === 1 && range.endAyah === 286,
      'Al-Baqarah must cover ayahs 1–286');
  });
  test('Juz 1 ends immediately before the verified Juz 2 boundary', () => {
    const ranges = getJuzMemorizedRanges(1);
    assert(ranges.length === 2, 'Juz 1 spans Al-Fatihah and Al-Baqarah');
    assert(ranges[0].surahNumber === 1 && ranges[0].startAyah === 1 && ranges[0].endAyah === 7,
      'Juz 1 must include all of Al-Fatihah');
    assert(ranges[1].surahNumber === 2 && ranges[1].startAyah === 1 && ranges[1].endAyah === 141,
      'Juz 1 must end at Al-Baqarah 2:141');
  });
  test('Juz 3 correctly crosses the Al-Baqarah / Aal-Imran boundary', () => {
    const ranges = getJuzMemorizedRanges(3);
    assert(ranges.length === 2, 'Juz 3 spans two Surahs');
    assert(ranges[0].surahNumber === 2 && ranges[0].startAyah === 253 && ranges[0].endAyah === 286,
      'Juz 3 must include the end of Al-Baqarah');
    assert(ranges[1].surahNumber === 3 && ranges[1].startAyah === 1 && ranges[1].endAyah === 92,
      'Juz 3 must continue through Aal-Imran 3:92');
  });
  test('Juz 30 uses the complete final Quran boundary', () => {
    const ranges = getJuzMemorizedRanges(30);
    const last = ranges[ranges.length - 1];
    assert(ranges[0].surahNumber === 78 && ranges[0].startAyah === 1,
      'Juz 30 begins at An-Naba 78:1');
    assert(last.surahNumber === 114 && last.endAyah === 6,
      'Juz 30 ends at An-Nas 114:6');
  });
  test('multiple and overlapping Surah intervals merge without duplicate coverage', () => {
    const ranges = normalizeMemorizedRanges([
      { surahNumber: 67, startAyah: 10, endAyah: 20 },
      { surahNumber: 67, startAyah: 1, endAyah: 12 },
      { surahNumber: 67, startAyah: 21, endAyah: 25 },
      { surahNumber: 1, startAyah: 1, endAyah: 7 }
    ]);
    assert(ranges.length === 2, 'Adjacent and overlapping intervals should merge');
    assert(ranges[0].surahNumber === 1 && ranges[1].startAyah === 1 && ranges[1].endAyah === 25,
      'Coverage should be sorted and merged exactly');
  });
  test('invalid endpoints and reversed intervals are rejected', () => {
    let rejected = 0;
    for (const range of [
      { surahNumber: 1, startAyah: 8, endAyah: 8 },
      { surahNumber: 67, startAyah: 12, endAyah: 11 },
      { surahNumber: 115, startAyah: 1, endAyah: 1 }
    ]) {
      try { normalizeMemorizedRanges([range]); } catch { rejected++; }
    }
    assert(rejected === 3, 'Every invalid interval must fail closed');
  });
  test('invalid Juz identifiers are rejected', () => {
    let rejected = 0;
    for (const juz of [0, 31, 1.5]) {
      try { getJuzMemorizedRanges(juz); } catch { rejected++; }
    }
    assert(rejected === 3, 'Juz numbers outside 1–30 must fail');
  });

  return { passed, failed };
}
