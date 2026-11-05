import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import COMPLETE_QURAN_DATA from '../data/completeQuranData.json';
import { Ayah } from '../types/quran';

export interface ComparisonReport {
  verificationTimestamp: string;
  status: 'VERIFIED_100_PERCENT' | 'NOT_VERIFIED';
  referenceSource: {
    provider: string;
    edition: string;
    narration: string;
    license: string;
    referenceFilePath: string;
    referenceFileChecksumSha256: string;
    referenceFileSizeBytes: number;
    encodingNote: string;
  };
  referenceValidation: {
    surahCountValid: boolean;
    totalAyahCountValid: boolean;
    sequentialSurahsValid: boolean;
    sequentialGlobalNumbersValid: boolean;
    sequentialLocalNumbersValid: boolean;
    noMissingOrExtraAyahs: boolean;
  };
  comparisonMetrics: {
    totalSurahsCompared: number;
    totalAyahsCompared: number;
    exactCharacterAndMetadataMatchesCount: number;
    characterOrTextMismatchesCount: number;
    localNumberMismatchesCount: number;
    globalNumberMismatchesCount: number;
    surahNumberMismatchesCount: number;
    pageMappingMismatchesCount: number;
    juzMappingMismatchesCount: number;
    hizbQuarterMismatchesCount: number;
    totalMismatchesFound: number;
  };
  discrepancies: Array<{
    surah: number;
    ayah: number;
    field: string;
    expected: any;
    actual: any;
  }>;
  sampleFirstAyah: Ayah;
  sampleLastAyah: Ayah;
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runIndependentTanzilComparison(overrideLocalData?: Record<string, Ayah[]>): {
  passed: number;
  failed: number;
  report: ComparisonReport;
} {
  let passed = 0;
  let failed = 0;

  const isTestingOverride = Boolean(overrideLocalData);
  if (!isTestingOverride) {
    console.log('🔍 Executing Independent Tanzil Quran Text & Metadata Character-by-Character Comparison...');
  }

  const refPath = path.resolve('./src/data/tanzilReferenceData.json');
  if (!fs.existsSync(refPath)) {
    console.error('❌ Reference file src/data/tanzilReferenceData.json missing!');
    const fallbackReport: ComparisonReport = {
      verificationTimestamp: new Date().toISOString(),
      status: 'NOT_VERIFIED',
      referenceSource: {
        provider: 'Tanzil Project (http://tanzil.net via AlQuran Cloud API)',
        edition: 'quran-uthmani',
        narration: 'حفص عن عاصم الكوفي',
        license: 'Creative Commons Attribution 3.0 Unported (CC BY 3.0)',
        referenceFilePath: './src/data/tanzilReferenceData.json',
        referenceFileChecksumSha256: 'NONE',
        referenceFileSizeBytes: 0,
        encodingNote: 'BOM byte \\uFEFF stripped narrowly from Ayah 1:1 text during comparison'
      },
      referenceValidation: {
        surahCountValid: false,
        totalAyahCountValid: false,
        sequentialSurahsValid: false,
        sequentialGlobalNumbersValid: false,
        sequentialLocalNumbersValid: false,
        noMissingOrExtraAyahs: false
      },
      comparisonMetrics: {
        totalSurahsCompared: 0,
        totalAyahsCompared: 0,
        exactCharacterAndMetadataMatchesCount: 0,
        characterOrTextMismatchesCount: 0,
        localNumberMismatchesCount: 0,
        globalNumberMismatchesCount: 0,
        surahNumberMismatchesCount: 0,
        pageMappingMismatchesCount: 0,
        juzMappingMismatchesCount: 0,
        hizbQuarterMismatchesCount: 0,
        totalMismatchesFound: 1
      },
      discrepancies: [{ surah: 0, ayah: 0, field: 'reference_file', expected: 'exists', actual: 'missing' }],
      sampleFirstAyah: (COMPLETE_QURAN_DATA as any)['1'][0],
      sampleLastAyah: (COMPLETE_QURAN_DATA as any)['114'][5]
    };

    if (!isTestingOverride) {
      const reportPath = path.resolve('./src/data/quranValidationReport.json');
      fs.writeFileSync(reportPath, JSON.stringify(fallbackReport, null, 2), 'utf8');
    }
    return { passed: 0, failed: 1, report: fallbackReport };
  }

  const rawRef = fs.readFileSync(refPath, 'utf8');
  const checksum = crypto.createHash('sha256').update(rawRef).digest('hex');
  const fileSize = fs.statSync(refPath).size;
  const refData = JSON.parse(rawRef);

  // 1. Strict Reference Dataset Self-Validation
  const refSurahs = refData.surahs || [];
  const surahCountValid = refSurahs.length === 114;
  
  let refTotalAyahs = 0;
  let sequentialSurahsValid = true;
  let sequentialGlobalNumbersValid = true;
  let sequentialLocalNumbersValid = true;
  let expectedGlobal = 1;

  for (let i = 0; i < refSurahs.length; i++) {
    const s = refSurahs[i];
    if (s.number !== i + 1) sequentialSurahsValid = false;
    
    for (let j = 0; j < s.ayahs.length; j++) {
      refTotalAyahs++;
      const a = s.ayahs[j];
      if (a.number !== expectedGlobal) sequentialGlobalNumbersValid = false;
      if (a.numberInSurah !== j + 1) sequentialLocalNumbersValid = false;
      expectedGlobal++;
    }
  }

  const totalAyahCountValid = refTotalAyahs === 6236 && expectedGlobal === 6237;
  const noMissingOrExtraAyahs = surahCountValid && totalAyahCountValid && sequentialGlobalNumbersValid && sequentialLocalNumbersValid;

  const refValidationPassed = surahCountValid && totalAyahCountValid && sequentialSurahsValid && sequentialGlobalNumbersValid && sequentialLocalNumbersValid;

  // 2. Character-by-Character and Full Metadata Comparison
  let exactMatches = 0;
  let textMismatches = 0;
  let localNumMismatches = 0;
  let globalNumMismatches = 0;
  let surahNumMismatches = 0;
  let pageMismatches = 0;
  let juzMismatches = 0;
  let hizbMismatches = 0;
  const discrepancies: Array<{ surah: number; ayah: number; field: string; expected: any; actual: any }> = [];

  const localData = overrideLocalData || (COMPLETE_QURAN_DATA as Record<string, Ayah[]>);
  let totalCompared = 0;

  // Check for extra local surahs
  const localSurahKeys = Object.keys(localData).map(Number).sort((a, b) => a - b);
  if (localSurahKeys.length !== 114) {
    discrepancies.push({
      surah: 0,
      ayah: 0,
      field: 'total_surah_keys_count',
      expected: 114,
      actual: localSurahKeys.length
    });
  }

  refSurahs.forEach((rSurah: any) => {
    const surahNum = rSurah.number;
    const lSurah = localData[String(surahNum)] || [];

    if (lSurah.length !== rSurah.ayahs.length) {
      discrepancies.push({
        surah: surahNum,
        ayah: 0,
        field: 'surah_verse_count',
        expected: rSurah.ayahs.length,
        actual: lSurah.length
      });
    }

    rSurah.ayahs.forEach((rAyah: any, idx: number) => {
      totalCompared++;
      const lAyah = lSurah[idx];

      if (!lAyah) {
        textMismatches++;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'ayah_existence',
          expected: 'present',
          actual: 'missing'
        });
        return;
      }

      let hasDiff = false;

      // Exact text comparison: narrow removal of \\uFEFF BOM byte without modifying diacritics or trailing characters
      const rText = rAyah.text.replace(/^\uFEFF/, '');
      const lText = lAyah.text.replace(/^\uFEFF/, '');

      if (rText !== lText) {
        textMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'text_exact_diacritics',
          expected: rText,
          actual: lText
        });
      }

      if (lAyah.numberInSurah !== rAyah.numberInSurah) {
        localNumMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'local_ayah_number',
          expected: rAyah.numberInSurah,
          actual: lAyah.numberInSurah
        });
      }

      if (lAyah.number !== rAyah.number) {
        globalNumMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'global_ayah_number',
          expected: rAyah.number,
          actual: lAyah.number
        });
      }

      if (lAyah.surahNumber !== surahNum) {
        surahNumMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'surah_number',
          expected: surahNum,
          actual: lAyah.surahNumber
        });
      }

      if (lAyah.page !== rAyah.page) {
        pageMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'page_mapping',
          expected: rAyah.page,
          actual: lAyah.page
        });
      }

      if (lAyah.juz !== rAyah.juz) {
        juzMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'juz_mapping',
          expected: rAyah.juz,
          actual: lAyah.juz
        });
      }

      if (lAyah.hizbQuarter !== rAyah.hizbQuarter) {
        hizbMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'hizb_quarter_mapping',
          expected: rAyah.hizbQuarter,
          actual: lAyah.hizbQuarter
        });
      }

      if (!hasDiff) {
        exactMatches++;
      }
    });
  });

  const totalMismatches = discrepancies.length;
  const isVerified = refValidationPassed && totalMismatches === 0 && exactMatches === 6236 && totalCompared === 6236;

  const report: ComparisonReport = {
    verificationTimestamp: new Date().toISOString(),
    status: isVerified ? 'VERIFIED_100_PERCENT' : 'NOT_VERIFIED',
    referenceSource: {
      provider: 'Tanzil Project (http://tanzil.net via AlQuran Cloud API)',
      edition: 'quran-uthmani',
      narration: 'حفص عن عاصم الكوفي',
      license: 'Creative Commons Attribution 3.0 Unported (CC BY 3.0)',
      referenceFilePath: './src/data/tanzilReferenceData.json',
      referenceFileChecksumSha256: checksum,
      referenceFileSizeBytes: fileSize,
      encodingNote: 'BOM byte \\uFEFF stripped narrowly from Ayah 1:1 text during comparison'
    },
    referenceValidation: {
      surahCountValid,
      totalAyahCountValid,
      sequentialSurahsValid,
      sequentialGlobalNumbersValid,
      sequentialLocalNumbersValid,
      noMissingOrExtraAyahs
    },
    comparisonMetrics: {
      totalSurahsCompared: 114,
      totalAyahsCompared: totalCompared,
      exactCharacterAndMetadataMatchesCount: exactMatches,
      characterOrTextMismatchesCount: textMismatches,
      localNumberMismatchesCount: localNumMismatches,
      globalNumberMismatchesCount: globalNumMismatches,
      surahNumberMismatchesCount: surahNumMismatches,
      pageMappingMismatchesCount: pageMismatches,
      juzMappingMismatchesCount: juzMismatches,
      hizbQuarterMismatchesCount: hizbMismatches,
      totalMismatchesFound: totalMismatches
    },
    discrepancies,
    sampleFirstAyah: localData['1'] ? localData['1'][0] : ({} as Ayah),
    sampleLastAyah: localData['114'] ? localData['114'][5] : ({} as Ayah)
  };

  if (!isTestingOverride) {
    const reportPath = path.resolve('./src/data/quranValidationReport.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  try {
    assert(isVerified, `Independent Tanzil verification failed with ${totalMismatches} discrepancies`);
    passed++;
    if (!isTestingOverride) {
      console.log(`  ✅ [PASS]: Independent Tanzil comparison verified all 6,236 verses and metadata fields 100% perfectly.`);
    }
  } catch (err: any) {
    failed++;
  }

  return { passed, failed, report };
}

// 3. Negative Tests Suite
export function runNegativeComparisonTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function testNegative(description: string, mutator: (data: Record<string, Ayah[]>) => void) {
    try {
      // Clone production data
      const cloned: Record<string, Ayah[]> = JSON.parse(JSON.stringify(COMPLETE_QURAN_DATA));
      mutator(cloned);
      const res = runIndependentTanzilComparison(cloned);
      assert(res.failed > 0, `${description} should have caused comparison failure`);
      assert(res.report.status === 'NOT_VERIFIED', `${description} should result in NOT_VERIFIED status`);
      assert(res.report.comparisonMetrics.totalMismatchesFound > 0, `${description} should report discrepancies`);
      passed++;
      console.log(`  ✅ [PASS Negative Test]: ${description} correctly caught discrepancy.`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL Negative Test]: ${description} - ${e.message}`);
    }
  }

  console.log('🧪 Executing Tanzil Comparison Negative Tests (Verifying Detector Sensitivity)...');

  testNegative('Text Alteration (diacritic change on 1:1)', (data) => {
    data['1'][0].text = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'; // Missing dagger alifs
  });

  testNegative('Global Ayah Number Mutation (1:2 global number changed)', (data) => {
    data['1'][1].number = 9999;
  });

  testNegative('Page Mapping Alteration (1:3 page changed to 99)', (data) => {
    data['1'][2].page = 99;
  });

  testNegative('Juz Mapping Alteration (18:1 juz changed to 1)', (data) => {
    data['18'][0].juz = 1;
  });

  testNegative('Hizb Quarter Alteration (67:1 hizbQuarter changed to 200)', (data) => {
    data['67'][0].hizbQuarter = 200;
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('independentTanzilComparison')) {
  const result = runIndependentTanzilComparison();
  const negResult = runNegativeComparisonTests();
  if (result.failed > 0 || negResult.failed > 0) process.exit(1);
}
