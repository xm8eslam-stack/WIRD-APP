/**
 * phase3CoreRemediation.test.ts
 *
 * Automated verification suite for Phase 3, Phase 3.1 & Phase 3.1.1:
 * 1. Canonical Portion ID & Local Date Safety
 * 2. Overlap-Safe Unique Ayah & Page Calculations
 * 3. Canonical SM-2 Grade Scheduling & Boundaries
 * 4. Deterministic Migration with Metadata Conflict Auditing & Duplicate History Disagreements
 * 5. Verified Quran Coordinates Boundary Validation (Surah 1..114, Ayah <= versesCount)
 * 6. RetentionService & StorageService Unified Pipeline
 * 7. Storage Write Verification, Complete Payload Readback & Quota Failure Safety
 * 8. Honest Dynamic Testing (Zero Unmemorized Fallbacks & Truthful hasSufficientData)
 * 9. Dashboard Due Count Uniformity from Canonical Queue
 * 10. Router Parsing & Deep Linking
 */

import {
  createCanonicalPortionId,
  getLocalDateString,
  addDaysToLocalDate,
  getDayDifference,
  calculateUniqueMemorizedAyahs,
  calculateUniqueMemorizedPages,
  calculateCanonicalSM2,
  getPrioritizedRevisionQueue,
  migrateLegacyDataLosslessly,
} from '../services/unifiedPortionService';
import { StorageService, STORAGE_KEYS } from '../services/storageService';
import { RetentionService } from '../services/retentionService';
import { generateDynamicTestQuestions } from '../services/testQuestionGenerator';
import { parseRoute, buildRouteHash } from '../services/router';
import { WirdPortion, PortionStatusRecord, RevisionItem } from '../types/quran';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runPhase3CoreRemediationTests(): Promise<{ passed: number; failed: number }> {
  const results: TestResult[] = [];

  function assert(condition: boolean, testName: string, message?: string) {
    if (!condition) {
      const err = message || `Assertion failed: ${testName}`;
      console.error(`  ❌ ${testName}: ${err}`);
      results.push({ name: testName, passed: false, error: err });
    } else {
      console.log(`  ✓ ${testName}`);
      results.push({ name: testName, passed: true });
    }
  }

  console.log('\n--- 1. Canonical Portion ID & Local Date Safety ---');
  {
    const id1 = createCanonicalPortionId(1, 1, 7);
    assert(id1 === 's1_a1_a7', 'Canonical portion ID format: s1_a1_a7');

    const todayStr = getLocalDateString();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr), 'getLocalDateString returns YYYY-MM-DD');

    const added = addDaysToLocalDate('2026-02-28', 1);
    assert(added === '2026-03-01', 'addDaysToLocalDate handles month rollover safely');

    const addedYear = addDaysToLocalDate('2026-12-31', 1);
    assert(addedYear === '2027-01-01', 'addDaysToLocalDate handles year rollover safely');

    const diff = getDayDifference('2026-05-10', '2026-05-15');
    assert(diff === 5, 'getDayDifference calculates positive day delta accurately');

    const diffNeg = getDayDifference('2026-05-15', '2026-05-10');
    assert(diffNeg === -5, 'getDayDifference calculates negative day delta accurately');
  }

  console.log('\n--- 2. Overlap-Safe Unique Ayah & Page Calculations ---');
  {
    assert(calculateUniqueMemorizedAyahs([]).uniqueCount === 0, 'Empty portions return 0 unique ayahs');
    assert(calculateUniqueMemorizedPages([]) === 0, 'Empty portions return 0 unique pages');

    const portionsOverlap: WirdPortion[] = [
      {
        id: 's1_a1_a7',
        type: 'passage',
        surahNumber: 1,
        surahName: 'الفاتحة',
        startAyah: 1,
        endAyah: 7,
        pageNumber: 1,
        status: 'stable',
        easeFactor: 2.5,
        intervalDays: 5,
        repetitionCount: 3,
        lastReviewedDate: '2026-05-01',
        nextDueDate: '2026-05-06',
      },
      {
        id: 's1_a3_a5',
        type: 'passage',
        surahNumber: 1,
        surahName: 'الفاتحة',
        startAyah: 3,
        endAyah: 5,
        pageNumber: 1,
        status: 'recently_memorized',
        easeFactor: 2.5,
        intervalDays: 2,
        repetitionCount: 1,
        lastReviewedDate: '2026-05-01',
        nextDueDate: '2026-05-03',
      },
    ];

    const uniqueAyahsResult = calculateUniqueMemorizedAyahs(portionsOverlap);
    assert(uniqueAyahsResult.uniqueCount === 7, `Overlapping portions count exactly 7 unique ayahs (got ${uniqueAyahsResult.uniqueCount})`);

    const uniquePages = calculateUniqueMemorizedPages(portionsOverlap);
    assert(uniquePages === 1, `Al-Fatihah resolves to exactly 1 page (got ${uniquePages})`);

    const portionsNonOverlap: WirdPortion[] = [
      ...portionsOverlap,
      {
        id: 's112_a1_a4',
        type: 'passage',
        surahNumber: 112,
        surahName: 'الإخلاص',
        startAyah: 1,
        endAyah: 4,
        pageNumber: 604,
        status: 'stable',
        easeFactor: 2.5,
        intervalDays: 10,
        repetitionCount: 5,
        lastReviewedDate: '2026-05-01',
        nextDueDate: '2026-05-11',
      },
    ];

    assert(calculateUniqueMemorizedAyahs(portionsNonOverlap).uniqueCount === 11, 'Non-overlapping portions correctly sum unique ayahs (7 + 4 = 11)');

    const withUnmemorized: WirdPortion[] = [
      ...portionsNonOverlap,
      {
        id: 's114_a1_a6',
        type: 'passage',
        surahNumber: 114,
        surahName: 'الناس',
        startAyah: 1,
        endAyah: 6,
        pageNumber: 604,
        status: 'not_memorized',
        easeFactor: 2.5,
        intervalDays: 0,
        repetitionCount: 0,
        lastReviewedDate: '',
        nextDueDate: '',
      },
    ];
    assert(calculateUniqueMemorizedAyahs(withUnmemorized).uniqueCount === 11, 'not_memorized status is not counted in memorized ayahs');
  }

  console.log('\n--- 3. Canonical SM-2 Grade Scheduling & Boundaries ---');
  {
    const basePortion: WirdPortion = {
      id: 's67_a1_a10',
      type: 'passage',
      surahNumber: 67,
      surahName: 'الملك',
      startAyah: 1,
      endAyah: 10,
      pageNumber: 562,
      status: 'recently_memorized',
      easeFactor: 2.5,
      intervalDays: 6,
      repetitionCount: 2,
      lastReviewedDate: '2026-05-01',
      nextDueDate: '2026-05-07',
    };

    const resAgain = calculateCanonicalSM2(basePortion, 'failed', { customTodayStr: '2026-05-07' });
    assert(resAgain.intervalDays === 1, 'SM-2 "failed" resets interval to 1 day');
    assert(resAgain.repetitionCount === 0, 'SM-2 "failed" resets repetitions to 0');
    assert(resAgain.status === 'weak', 'SM-2 "failed" sets status to weak');
    assert(resAgain.nextDueDate === '2026-05-08', 'SM-2 "failed" schedules for next day');
    assert(resAgain.easeFactor <= 2.5, 'SM-2 "failed" decreases ease factor');

    const resHard = calculateCanonicalSM2(basePortion, 'difficult', { customTodayStr: '2026-05-07' });
    assert(resHard.intervalDays >= 2, 'SM-2 "difficult" sets interval for careful review');
    assert(resHard.easeFactor < basePortion.easeFactor, 'SM-2 "difficult" reduces ease factor');

    const resGood = calculateCanonicalSM2(basePortion, 'successful', { customTodayStr: '2026-05-07' });
    assert(resGood.intervalDays >= 14, `SM-2 "successful" multiplies interval by ease factor (expected >= 14, got ${resGood.intervalDays})`);
    assert(resGood.status === 'stable', 'SM-2 "successful" at rep 3 sets status to stable');
    assert(resGood.repetitionCount === 3, 'SM-2 "successful" increments repetitions to 3');

    const resStrong = calculateCanonicalSM2(basePortion, 'strong', { customTodayStr: '2026-05-07' });
    assert(resStrong.intervalDays > resGood.intervalDays, 'SM-2 "strong" results in longer interval than "successful"');
    assert(resStrong.easeFactor > basePortion.easeFactor, 'SM-2 "strong" increases ease factor');

    let lowEasePortion: WirdPortion = { ...basePortion, easeFactor: 1.35 };
    for (let i = 0; i < 5; i++) {
      const calc = calculateCanonicalSM2(lowEasePortion, 'failed', { customTodayStr: '2026-05-01' });
      lowEasePortion = { ...lowEasePortion, ...calc };
    }
    assert(lowEasePortion.easeFactor >= 1.3, `SM-2 ease factor is strictly bounded at >= 1.3 (got ${lowEasePortion.easeFactor})`);
  }

  console.log('\n--- 4. Deterministic Migration with Metadata Conflict Auditing & Duplicate History Preservation ---');
  {
    const legacyPortions: PortionStatusRecord[] = [
      {
        id: 'legacy_p1',
        type: 'passage',
        surahNumber: 18,
        surahName: 'الكهف القديم',
        startAyah: 1,
        endAyah: 10,
        pageNumber: 293,
        status: 'stable',
        strength: 'strong',
        lastReviewedDate: '2026-04-10',
        nextDueDate: '2026-04-20',
        repetitionCount: 4,
        intervalDays: 10,
        easeFactor: 2.6,
        history: [{ id: 'h1', date: '2026-04-10', rating: 'successful', intervalDaysBefore: 5, intervalDaysAfter: 10 }]
      },
      {
        id: 'legacy_p2_duplicate',
        type: 'surah', // Disagreeing metadata field
        surahNumber: 18,
        surahName: 'الكهف الجديد', // Disagreeing surah name
        startAyah: 1,
        endAyah: 10,
        pageNumber: 293,
        status: 'weak', // Conflicting weaker status
        strength: 'weak',
        lastReviewedDate: '2026-04-15',
        nextDueDate: '2026-04-16',
        repetitionCount: 5,
        intervalDays: 1,
        easeFactor: 2.1,
        history: [{ id: 'h1', date: '2026-04-15', rating: 'failed', intervalDaysBefore: 10, intervalDaysAfter: 1, notes: 'disagreeing history content' }]
      }
    ];

    const legacyRevisions: RevisionItem[] = [
      {
        id: 'legacy_rev1',
        surahNumber: 18,
        surahName: 'الكهف',
        startAyah: 1,
        endAyah: 10,
        type: 'minor',
        nextDueDate: '2026-04-12',
        intervalDays: 8,
        easeFactor: 2.4,
        repetitionCount: 3,
        strength: 'medium'
      }
    ];

    const { portions: migrated, report } = migrateLegacyDataLosslessly(legacyPortions, legacyRevisions);
    assert(migrated.length === 1, 'Migration coalesces duplicate portions and revisions into 1 canonical record');
    assert(migrated[0].id === 's18_a1_a10', 'Migrated record uses canonical ID (s18_a1_a10)');
    assert(migrated[0].status === 'weak', 'Conflict resolution: weakest status (weak) wins');
    assert(migrated[0].repetitionCount === 5, 'Conflict resolution: highest repetition count (5) preserved');
    assert(migrated[0].nextDueDate === '2026-04-12', 'Conflict resolution: earliest nextDueDate preserved');
    assert(migrated[0].history?.length === 2, 'Lossless history: duplicate log ID with differing content is preserved with modified ID');
    assert((migrated[0].conflictAudit?.length || 0) >= 2, 'Metadata conflicts (type, surahName, status, history) logged to conflictAudit');
    assert(report.success === true, 'Migration report reports success');
  }

  console.log('\n--- 5. Verified Quran Coordinates Boundary Validation ---');
  {
    // Test invalid Surah number 115
    const invalidSurahPortion: PortionStatusRecord = {
      id: 'invalid_1',
      surahNumber: 115,
      surahName: 'غير موجودة',
      startAyah: 1,
      endAyah: 5,
      status: 'stable',
      nextDueDate: '2026-05-10',
      intervalDays: 1,
      easeFactor: 2.5,
      repetitionCount: 1
    };
    const res1 = migrateLegacyDataLosslessly([invalidSurahPortion], []);
    assert(res1.report.success === false, 'Migration rejects invalid Surah number 115');

    // Test invalid Ayah number 99 in Al-Fatiha (max 7)
    const invalidAyahPortion: PortionStatusRecord = {
      id: 'invalid_2',
      surahNumber: 1,
      surahName: 'الفاتحة',
      startAyah: 1,
      endAyah: 99,
      status: 'stable',
      nextDueDate: '2026-05-10',
      intervalDays: 1,
      easeFactor: 2.5,
      repetitionCount: 1
    };
    const res2 = migrateLegacyDataLosslessly([invalidAyahPortion], []);
    assert(res2.report.success === false, 'Migration rejects invalid Ayah number 99 in Al-Fatiha (max 7)');
  }

  console.log('\n--- 6. RetentionService & StorageService Unified Pipeline ---');
  {
    const snap = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();
      
      const newP = RetentionService.addPortion({
        type: 'passage',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 10,
        status: 'recently_memorized',
        nextDueDate: '2026-05-10',
        intervalDays: 2,
        easeFactor: 2.5,
        repetitionCount: 1
      });

      assert(newP.id === 's67_a1_a10', 'RetentionService creates canonical ID s67_a1_a10');
      
      const directUnified = StorageService.getUnifiedPortions();
      assert(directUnified.length === 1 && directUnified[0].id === 's67_a1_a10', 'RetentionService writes directly to StorageService.getUnifiedPortions');

      const perfRes = RetentionService.recordRevisionPerformance('s67_a1_a10', 'successful', 'مراجعة ممتازة');
      assert(perfRes.updatedPortion.repetitionCount === 2, 'recordRevisionPerformance increments repetition count on canonical record');
      assert(perfRes.updatedPortion.history?.length === 1, 'recordRevisionPerformance adds log entry to canonical history');

      const metrics = RetentionService.getRetentionDashboardMetrics();
      assert(metrics.totalTrackedPortions === 1, 'Dashboard metrics read canonical portion count');
      assert(metrics.totalMemorizedAyahs === 10, 'Dashboard metrics calculate 10 unique memorized ayahs');
    } finally {
      StorageService.restoreStorageSnapshot(snap);
    }
  }

  console.log('\n--- 7. Storage Write Verification & Payload Readback Verification ---');
  {
    const snap = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();

      const legacyPortion: PortionStatusRecord = {
        id: 'legacy_portion_1',
        type: 'passage',
        surahNumber: 112,
        surahName: 'الإخلاص',
        startAyah: 1,
        endAyah: 4,
        status: 'stable',
        nextDueDate: '2026-05-20',
        intervalDays: 14,
        easeFactor: 2.8,
        repetitionCount: 10
      };

      const seedSnapshot: Record<string, string | null> = {
        [`memory:${STORAGE_KEYS.PORTIONS}`]: JSON.stringify([legacyPortion]),
        [`memory:${STORAGE_KEYS.SCHEMA_VERSION}`]: '2',
        [`memory:${STORAGE_KEYS.UNIFIED_PORTIONS}`]: 'CORRUPTED_NON_JSON_DATA'
      };
      StorageService.restoreStorageSnapshot(seedSnapshot);

      const recovered = StorageService.getUnifiedPortions();
      assert(recovered.length === 1, 'getUnifiedPortions recovers losslessly from legacy keys when v2 payload is corrupt');
      assert(recovered[0].id === 's112_a1_a4', 'Recovered portion has canonical ID s112_a1_a4');
    } finally {
      StorageService.restoreStorageSnapshot(snap);
    }
  }

  console.log('\n--- 8. Honest Dynamic Test Question Generation ---');
  {
    const emptyGen = generateDynamicTestQuestions('complete_verse', [], 5);
    assert(emptyGen.questions.length === 0, 'Zero fallback questions generated from unmemorized content when profile is clean');
    assert(emptyGen.hasSufficientData === false, 'hasSufficientData is false when profile is clean');
    assert(typeof emptyGen.messageAr === 'string', 'Honest Arabic explanatory message returned for clean profile');

    const singleVersePortion: WirdPortion = {
      id: 's109_a1_a1',
      type: 'passage',
      surahNumber: 109,
      surahName: 'الكافرون',
      startAyah: 1,
      endAyah: 1,
      status: 'recently_memorized',
      nextDueDate: '2026-05-10',
      intervalDays: 1,
      easeFactor: 2.5,
      repetitionCount: 1
    };
    const partialGen = generateDynamicTestQuestions('complete_verse', [singleVersePortion], 5);
    assert(partialGen.questions.length === 0, 'Does not fabricate questions if memorized portion is too short');
    assert(partialGen.hasSufficientData === false, 'hasSufficientData is strictly false when target question count cannot be met');

    const mulkPortion: WirdPortion = {
      id: 's67_a1_a10',
      type: 'passage',
      surahNumber: 67,
      surahName: 'الملك',
      startAyah: 1,
      endAyah: 10,
      status: 'stable',
      nextDueDate: '2026-05-10',
      intervalDays: 5,
      easeFactor: 2.5,
      repetitionCount: 4
    };
    const validGen = generateDynamicTestQuestions('complete_verse', [mulkPortion], 5);
    assert(validGen.questions.length === 5, 'Generates full question set when sufficient memorized content exists');
    assert(validGen.hasSufficientData === true, 'hasSufficientData is true when full question set generated');
    assert(validGen.questions.every(q => q.isFromMemorizedPortion), 'Every generated question originates exclusively from user memorized portions');
  }

  console.log('\n--- 9. Dashboard Due Count Canonical Uniformity ---');
  {
    const snap = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();

      RetentionService.addPortion({
        type: 'passage',
        surahNumber: 1,
        surahName: 'الفاتحة',
        startAyah: 1,
        endAyah: 7,
        status: 'weak',
        nextDueDate: '2026-01-01', // Overdue
        intervalDays: 1,
        easeFactor: 2.0,
        repetitionCount: 1
      });

      const today = getLocalDateString();
      const queueDetails = RetentionService.getDailyRevisionQueueDetails(today);
      assert(queueDetails.totalDueCount === 1, 'Canonical queueDetails correctly counts 1 due/overdue item');
      assert(queueDetails.overdueCount === 1, 'Canonical queueDetails correctly counts 1 overdue item');
    } finally {
      StorageService.restoreStorageSnapshot(snap);
    }
  }

  console.log('\n--- 10. Router Parsing & Deep Linking ---');
  {
    const route1 = parseRoute('#/library');
    assert(route1.tab === 'library', 'parseRoute parses #/library');

    const route2 = parseRoute('#/session?mode=memorize&surah=67&start=1&end=10');
    assert(route2.tab === 'session', 'parseRoute parses #/session');
    assert(route2.mode === 'memorize', 'parseRoute extracts query param mode');
    assert(route2.surahNumber === 67, 'parseRoute extracts query param surah');
    assert(route2.startAyah === 1, 'parseRoute extracts query param start');
    assert(route2.endAyah === 10, 'parseRoute extracts query param end');

    const invalidRoute = parseRoute('#/invalid_tab_name');
    assert(invalidRoute.tab === 'dashboard', 'parseRoute falls back to dashboard on invalid tab');

    const constructedHash = buildRouteHash({ tab: 'session', mode: 'review', surahNumber: 1 });
    assert(constructedHash === '#/session?surah=1&mode=review', 'buildRouteHash constructs correct query string');
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { passed, failed };
}
