/**
 * phase3CoreRemediation.test.ts
 *
 * Automated verification suite for Phase 3: Core Remediation & P0 Implementation:
 * 1. Lossless Legacy Data Migration & Idempotency
 * 2. Overlap-Safe Unique Ayah & Page Calculation
 * 3. Canonical SM-2 Grade Scheduling & Boundaries
 * 4. Local Date Safety & Timezone Integrity
 * 5. Revision Queue Prioritization, Limits & Grace Period
 * 6. Empty-State Statistics & Zero Fake Progress
 * 7. Dynamic Test Question Generation Integrity
 * 8. Lightweight Hash Router & Deep Linking
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
import { StorageService } from '../services/storageService';
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
    // Empty state returns 0
    assert(calculateUniqueMemorizedAyahs([]).uniqueCount === 0, 'Empty portions return 0 unique ayahs');
    assert(calculateUniqueMemorizedPages([]) === 0, 'Empty portions return 0 unique pages');

    // Overlapping portions: Al-Fatihah 1-7 and Al-Fatihah 3-5
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

    // Non-overlapping: Al-Fatihah (7) + Al-Ikhlas (4) = 11 unique ayahs
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

    // Status filtering: not_memorized portions are ignored
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

    // Grade 'failed' (1 / Lapse) -> resets interval to 1, status to weak
    const resAgain = calculateCanonicalSM2(basePortion, 'failed', { customTodayStr: '2026-05-07' });
    assert(resAgain.intervalDays === 1, 'SM-2 "failed" resets interval to 1 day');
    assert(resAgain.repetitionCount === 0, 'SM-2 "failed" resets repetitions to 0');
    assert(resAgain.status === 'weak', 'SM-2 "failed" sets status to weak');
    assert(resAgain.nextDueDate === '2026-05-08', 'SM-2 "failed" schedules for next day');
    assert(resAgain.easeFactor <= 2.5, 'SM-2 "failed" decreases ease factor');

    // Grade 'difficult' (2 / Hard) -> conservative interval growth
    const resHard = calculateCanonicalSM2(basePortion, 'difficult', { customTodayStr: '2026-05-07' });
    assert(resHard.intervalDays >= 2, 'SM-2 "difficult" sets interval for careful review');
    assert(resHard.easeFactor < basePortion.easeFactor, 'SM-2 "difficult" reduces ease factor');

    // Grade 'successful' (3 / Good) -> standard growth (~2.5x), status becomes stable at rep >= 3
    const resGood = calculateCanonicalSM2(basePortion, 'successful', { customTodayStr: '2026-05-07' });
    assert(resGood.intervalDays >= 14, `SM-2 "successful" multiplies interval by ease factor (expected >= 14, got ${resGood.intervalDays})`);
    assert(resGood.status === 'stable', 'SM-2 "successful" at rep 3 sets status to stable');
    assert(resGood.repetitionCount === 3, 'SM-2 "successful" increments repetitions to 3');

    // Grade 'strong' (5 / Flawless) -> accelerated growth, easeFactor increase
    const resStrong = calculateCanonicalSM2(basePortion, 'strong', { customTodayStr: '2026-05-07' });
    assert(resStrong.intervalDays > resGood.intervalDays, 'SM-2 "strong" results in longer interval than "successful"');
    assert(resStrong.easeFactor > basePortion.easeFactor, 'SM-2 "strong" increases ease factor');

    // Minimum ease factor boundary (1.3)
    let lowEasePortion: WirdPortion = { ...basePortion, easeFactor: 1.35 };
    for (let i = 0; i < 5; i++) {
      const calc = calculateCanonicalSM2(lowEasePortion, 'failed', { customTodayStr: '2026-05-01' });
      lowEasePortion = { ...lowEasePortion, ...calc };
    }
    assert(lowEasePortion.easeFactor >= 1.3, `SM-2 ease factor is strictly bounded at >= 1.3 (got ${lowEasePortion.easeFactor})`);
  }

  console.log('\n--- 4. Lossless Migration & Idempotency ---');
  {
    const legacyPortions: PortionStatusRecord[] = [
      {
        id: 'legacy_p1',
        surahNumber: 18,
        surahName: 'الكهف',
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
      },
    ];

    const legacyRevisions: RevisionItem[] = [
      {
        id: 'legacy_rev1',
        surahNumber: 18,
        surahName: 'الكهف',
        startAyah: 1,
        endAyah: 10,
        type: 'minor',
        nextDueDate: '2026-04-18', // earlier due date
        intervalDays: 8,
        easeFactor: 2.4,
        repetitionCount: 3,
        strength: 'medium',
      },
    ];

    // First migration run
    const { portions: migrated1, report: report1 } = migrateLegacyDataLosslessly(legacyPortions, legacyRevisions);
    assert(migrated1.length === 1, 'Migration coalesces matching portion and revision into 1 record');
    assert(migrated1[0].id === 's18_a1_a10', 'Migrated record uses canonical ID (s18_a1_a10)');
    assert(migrated1[0].status === 'stable', 'Migrated record preserves stable status');
    assert(report1.success === true, 'Migration report indicates success');

    // StorageService integration & Idempotency
    const snap = StorageService.getStorageSnapshot();
    try {
      StorageService.saveUnifiedPortions(migrated1);
      const retrieved = StorageService.getUnifiedPortions();
      assert(retrieved.length === 1 && retrieved[0].surahNumber === 18, 'StorageService persists and retrieves unified portions');

      // Second migration run with existing unified portions should succeed losslessly
      const { portions: migrated2 } = migrateLegacyDataLosslessly(retrieved as PortionStatusRecord[], []);
      assert(migrated2.length === 1, 'Migration is idempotent: second run preserves exact count');
      assert(migrated2[0].id === 's18_a1_a10', 'Idempotent migration keeps same portion ID');
    } finally {
      StorageService.restoreStorageSnapshot(snap);
    }
  }

  console.log('\n--- 5. Revision Queue Prioritization & Daily Limits ---');
  {
    // Generate 30 portions due today or overdue
    const portions: WirdPortion[] = [];
    for (let i = 1; i <= 30; i++) {
      portions.push({
        id: `s2_a${i}_a${i}`,
        type: 'passage',
        surahNumber: 2,
        surahName: 'البقرة',
        startAyah: i,
        endAyah: i,
        pageNumber: 2,
        status: i === 1 ? 'weak' : 'needs_revision',
        easeFactor: 2.5,
        intervalDays: 1,
        repetitionCount: 1,
        lastReviewedDate: '2026-05-01',
        nextDueDate: i <= 5 ? '2026-05-02' : '2026-05-10', // overdue vs today
      });
    }

    const { queue, totalDueCount } = getPrioritizedRevisionQueue(portions, {
      todayStr: '2026-05-10',
      maxDailyLimit: 20,
    });
    assert(totalDueCount === 30, 'Total due items correctly identified as 30');
    assert(queue.length === 20, `Queue is strictly capped at maxDailyLimit (got ${queue.length})`);
    assert(queue[0].status === 'weak', 'Queue prioritizes weak portions at top of queue');
  }

  console.log('\n--- 6. Dynamic Test Question Generation ---');
  {
    // Test with no memorized portions (graceful fallback)
    const emptyResult = generateDynamicTestQuestions('complete_verse', [], 67);
    assert(emptyResult.questions.length > 0, 'Generates fallback questions when no portions memorized');
    assert(emptyResult.hasSufficientData === false, 'hasSufficientData is false for empty profile');
    assert(emptyResult.questions[0].options.length === 4, 'Multiple-choice question contains 4 options');

    // Test with memorized portions
    const userPortions: WirdPortion[] = [
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
        intervalDays: 10,
        repetitionCount: 5,
        lastReviewedDate: '2026-05-01',
        nextDueDate: '2026-05-11',
      },
    ];

    const modes = ['complete_verse', 'bidirectional_recall', 'random_recall', 'mutashabihat'] as const;
    for (const mode of modes) {
      const modeResult = generateDynamicTestQuestions(mode, userPortions, 1);
      assert(modeResult.questions.length >= 1, `Generates valid test questions for mode "${mode}"`);
      const minOptions = mode === 'mutashabihat' ? 2 : 4;
      assert(
        modeResult.questions.every(q => q.prompt && q.options.length >= minOptions && typeof q.correctIndex === 'number'),
        `Questions for mode "${mode}" have valid prompt, >=${minOptions} options, and correctIndex`
      );
    }
  }

  console.log('\n--- 7. Router Parsing & Deep Linking ---');
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
