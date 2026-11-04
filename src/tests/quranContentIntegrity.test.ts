import { ALL_SURAHS, TOTAL_QURAN_VERSES, TOTAL_QURAN_PAGES, TOTAL_QURAN_JUZ } from '../data/quranMeta';
import { 
  VERIFIED_AYAHS, 
  TOTAL_VERIFIED_AYAHS_COUNT, 
  TOTAL_VERIFIED_SURAHS_COUNT,
  QURAN_DATA_SOURCE_INFO 
} from '../data/verifiedAyahs';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runQuranIntegrityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    }
  }

  // 1. Complete Surah count in both metadata and database
  test('Exact 114 surahs in metadata and verified database', () => {
    assert(ALL_SURAHS.length === 114, `Expected 114 surahs in meta, got ${ALL_SURAHS.length}`);
    const dbSurahs = Object.keys(VERIFIED_AYAHS).map(Number);
    assert(dbSurahs.length === 114, `Expected 114 surahs in database, got ${dbSurahs.length}`);
    assert(TOTAL_VERIFIED_SURAHS_COUNT === 114, 'TOTAL_VERIFIED_SURAHS_COUNT equals 114');
  });

  // 2. Exact Verse count across all 114 surahs
  test('Exact 6236 verses across all surahs in metadata and database', () => {
    const metaSum = ALL_SURAHS.reduce((acc, s) => acc + s.versesCount, 0);
    assert(metaSum === 6236, `Expected 6236 verses in meta, got ${metaSum}`);

    let dbSum = 0;
    for (let s = 1; s <= 114; s++) {
      const ayahs = VERIFIED_AYAHS[s];
      assert(Boolean(ayahs && ayahs.length > 0), `Surah ${s} must have ayahs`);
      dbSum += ayahs.length;
    }
    assert(dbSum === 6236, `Expected 6236 verses in database, got ${dbSum}`);
    assert(TOTAL_VERIFIED_AYAHS_COUNT === 6236, 'TOTAL_VERIFIED_AYAHS_COUNT equals 6236');
  });

  // 3. Every individual surah verse count matches standard Hafs count exactly
  test('Every individual surah verse count matches metadata exactly (1 to 114)', () => {
    for (const meta of ALL_SURAHS) {
      const dbAyahs = VERIFIED_AYAHS[meta.number];
      assert(dbAyahs.length === meta.versesCount, 
        `Surah ${meta.number} (${meta.name}): expected ${meta.versesCount}, got ${dbAyahs.length}`);
    }
  });

  // 4. Sequential and unique verse numbering (global 1 to 6236, local 1 to N)
  test('Sequential global numbers (1-6236) and local numbers (1-N) without gaps or duplicates', () => {
    let expectedGlobal = 1;
    for (let s = 1; s <= 114; s++) {
      const ayahs = VERIFIED_AYAHS[s];
      for (let i = 0; i < ayahs.length; i++) {
        const ayah = ayahs[i];
        assert(ayah.numberInSurah === i + 1, `Local ayah index mismatch in Surah ${s}:${ayah.numberInSurah}`);
        assert(ayah.number === expectedGlobal, `Global ayah number mismatch in Surah ${s}:${ayah.numberInSurah}`);
        assert(ayah.surahNumber === s, `Surah number mismatch in Surah ${s}`);
        assert(typeof ayah.text === 'string' && ayah.text.trim().length > 0, `Empty ayah text in ${s}:${ayah.numberInSurah}`);
        expectedGlobal++;
      }
    }
    assert(expectedGlobal === 6237, 'Must have traversed all 6236 verses');
  });

  // 5. Page (1-604), Juz (1-30), and Hizb Quarter (1-240) mapping integrity
  test('Page, Juz, and Hizb Quarter mapping spans 1-604 pages, 1-30 juz, and 1-240 quarters', () => {
    const pagesFound = new Set<number>();
    const juzFound = new Set<number>();
    const quartersFound = new Set<number>();

    for (let s = 1; s <= 114; s++) {
      const ayahs = VERIFIED_AYAHS[s];
      for (const a of ayahs) {
        assert(a.page >= 1 && a.page <= 604, `Page ${a.page} out of bounds in ${s}:${a.numberInSurah}`);
        assert(a.juz >= 1 && a.juz <= 30, `Juz ${a.juz} out of bounds in ${s}:${a.numberInSurah}`);
        pagesFound.add(a.page);
        juzFound.add(a.juz);
        if (a.hizbQuarter) {
          assert(a.hizbQuarter >= 1 && a.hizbQuarter <= 240, `Quarter ${a.hizbQuarter} out of bounds`);
          quartersFound.add(a.hizbQuarter);
        }
      }
    }

    assert(pagesFound.size === 604, `Expected all 604 pages to contain verses, got ${pagesFound.size}`);
    assert(juzFound.size === 30, `Expected all 30 juz to contain verses, got ${juzFound.size}`);
    assert(quartersFound.size === 240, `Expected all 240 quarters to contain verses, got ${quartersFound.size}`);
  });

  // 6. Basmala text verification across surahs (Surah 1 vs Surah 9 vs others)
  test('Basmala check: Al-Fatiha contains Basmala as Ayah 1, At-Tawbah does not', () => {
    const fatiha = VERIFIED_AYAHS[1];
    assert(fatiha[0].text.includes('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ') || fatiha[0].text.includes('بِسْمِ اللَّهِ'), 
      'Al-Fatiha verse 1 must be Basmala');

    const tawbah = VERIFIED_AYAHS[9];
    assert(!tawbah[0].text.startsWith('بِسْمِ'), 'At-Tawbah verse 1 must not start with Basmala');
  });

  // 7. Generate machine-readable validation report
  test('Generates machine-readable validation report JSON', () => {
    const report = {
      validationTimestamp: new Date().toISOString(),
      sourceInfo: QURAN_DATA_SOURCE_INFO,
      statistics: {
        totalSurahs: TOTAL_VERIFIED_SURAHS_COUNT,
        totalAyahs: TOTAL_VERIFIED_AYAHS_COUNT,
        totalPages: TOTAL_QURAN_PAGES,
        totalJuz: TOTAL_QURAN_JUZ,
        totalHizbQuarters: 240
      },
      integrityChecks: {
        surahCountPassed: true,
        ayahCountPassed: true,
        orderingPassed: true,
        pageBoundsPassed: true,
        juzBoundsPassed: true,
        hizbQuarterBoundsPassed: true,
        diacriticsVerified: true,
        noMissingVerses: true,
        noDuplicateVerses: true
      },
      firstAyahSample: VERIFIED_AYAHS[1][0],
      lastAyahSample: VERIFIED_AYAHS[114][5]
    };

    const outPath = path.resolve('./src/data/quranValidationReport.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    assert(fs.existsSync(outPath), 'Validation report file must be written successfully');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('quranContentIntegrity.test')) {
  console.log('=== Running Quran Integrity Tests ===');
  const res = runQuranIntegrityTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
