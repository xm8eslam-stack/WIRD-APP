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
  };
  comparisonMetrics: {
    totalSurahsCompared: number;
    totalAyahsCompared: number;
    exactCharacterMatchesCount: number;
    characterOrTextMismatchesCount: number;
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

export function runIndependentTanzilComparison(): { passed: number; failed: number; report: ComparisonReport } {
  let passed = 0;
  let failed = 0;

  console.log('🔍 Executing Independent Tanzil Quran Text & Metadata Character-by-Character Comparison...');

  const refPath = path.resolve('./src/data/tanzilReferenceData.json');
  if (!fs.existsSync(refPath)) {
    console.error('❌ Reference file src/data/tanzilReferenceData.json missing!');
    const fallbackReport: ComparisonReport = {
      verificationTimestamp: new Date().toISOString(),
      status: 'NOT_VERIFIED',
      referenceSource: {
        provider: 'Tanzil Project (http://tanzil.net via AlQuran Cloud)',
        edition: 'quran-uthmani',
        narration: "حفص عن عاصم الكوفي",
        license: 'Creative Commons Attribution 3.0 Unported (CC BY 3.0)',
        referenceFilePath: './src/data/tanzilReferenceData.json',
        referenceFileChecksumSha256: 'NONE',
        referenceFileSizeBytes: 0
      },
      comparisonMetrics: {
        totalSurahsCompared: 0,
        totalAyahsCompared: 0,
        exactCharacterMatchesCount: 0,
        characterOrTextMismatchesCount: 0,
        pageMappingMismatchesCount: 0,
        juzMappingMismatchesCount: 0,
        hizbQuarterMappingMismatchesCount: 0,
        totalMismatchesFound: 1
      } as any,
      discrepancies: [{ surah: 0, ayah: 0, field: 'reference_file', expected: 'exists', actual: 'missing' }],
      sampleFirstAyah: (COMPLETE_QURAN_DATA as any)['1'][0],
      sampleLastAyah: (COMPLETE_QURAN_DATA as any)['114'][5]
    };

    const reportPath = path.resolve('./src/data/quranValidationReport.json');
    fs.writeFileSync(reportPath, JSON.stringify(fallbackReport, null, 2), 'utf8');
    return { passed: 0, failed: 1, report: fallbackReport };
  }

  const rawRef = fs.readFileSync(refPath, 'utf8');
  const checksum = crypto.createHash('sha256').update(rawRef).digest('hex');
  const fileSize = fs.statSync(refPath).size;
  const refData = JSON.parse(rawRef);

  let exactMatches = 0;
  let textMismatches = 0;
  let pageMismatches = 0;
  let juzMismatches = 0;
  let hizbMismatches = 0;
  const discrepancies: Array<{ surah: number; ayah: number; field: string; expected: any; actual: any }> = [];

  const localData = COMPLETE_QURAN_DATA as Record<string, Ayah[]>;
  let totalCompared = 0;

  // Compare all 114 surahs and 6236 ayahs
  refData.surahs.forEach((rSurah: any) => {
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

      // Preserve diacritics, Uthmani characters, and pause symbols
      const rText = rAyah.text.replace(/^\uFEFF/, '').trim();
      const lText = lAyah.text.replace(/^\uFEFF/, '').trim();

      let hasDiff = false;

      if (rText !== lText) {
        textMismatches++;
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'text_character_exact',
          expected: rText,
          actual: lText
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

      if (lAyah.numberInSurah !== rAyah.numberInSurah) {
        hasDiff = true;
        discrepancies.push({
          surah: surahNum,
          ayah: rAyah.numberInSurah,
          field: 'local_ayah_number',
          expected: rAyah.numberInSurah,
          actual: lAyah.numberInSurah
        });
      }

      if (!hasDiff) {
        exactMatches++;
      }
    });
  });

  const totalMismatches = textMismatches + pageMismatches + juzMismatches + hizbMismatches + discrepancies.length - (textMismatches + pageMismatches + juzMismatches);
  const isVerified = totalMismatches === 0 && exactMatches === 6236 && totalCompared === 6236;

  const report: ComparisonReport = {
    verificationTimestamp: new Date().toISOString(),
    status: isVerified ? 'VERIFIED_100_PERCENT' : 'NOT_VERIFIED',
    referenceSource: {
      provider: 'Tanzil Project (http://tanzil.net via AlQuran Cloud)',
      edition: 'quran-uthmani',
      narration: 'حفص عن عاصم الكوفي',
      license: 'Creative Commons Attribution 3.0 Unported (CC BY 3.0)',
      referenceFilePath: './src/data/tanzilReferenceData.json',
      referenceFileChecksumSha256: checksum,
      referenceFileSizeBytes: fileSize
    },
    comparisonMetrics: {
      totalSurahsCompared: 114,
      totalAyahsCompared: totalCompared,
      exactCharacterMatchesCount: exactMatches,
      characterOrTextMismatchesCount: textMismatches,
      pageMappingMismatchesCount: pageMismatches,
      juzMappingMismatchesCount: juzMismatches,
      hizbQuarterMismatchesCount: hizbMismatches,
      totalMismatchesFound: discrepancies.length
    },
    discrepancies,
    sampleFirstAyah: localData['1'][0],
    sampleLastAyah: localData['114'][5]
  };

  const reportPath = path.resolve('./src/data/quranValidationReport.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  try {
    assert(isVerified, `Independent verification failed with ${discrepancies.length} discrepancies`);
    passed++;
    console.log(`  ✅ [PASS]: Independent Tanzil comparison verified 6,236 / 6,236 verses perfectly.`);
  } catch (err: any) {
    failed++;
  }

  return { passed, failed, report };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('independentTanzilComparison')) {
  const result = runIndependentTanzilComparison();
  if (result.failed > 0) process.exit(1);
}
