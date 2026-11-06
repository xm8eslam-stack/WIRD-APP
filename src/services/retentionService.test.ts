import { RetentionService, DEFAULT_PORTIONS } from './retentionService';
import { StorageService } from './storageService';
import { PortionMemorizationStatus, RevisionRating } from '../types/quran';
import { addDaysToLocalDate, createCanonicalPortionId, getLocalDateString } from './unifiedPortionService';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  } else {
    console.log(`✅ PASS: ${testName}`);
  }
}

export function runAllRetentionTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      results.push(`✅ ${name}`);
    } catch (e: any) {
      failed++;
      results.push(`❌ ${name}: ${e.message}`);
    }
  }

  // 1. Initial Portion Status Verification
  runTest('RetentionService: Seed portions contain verified portions and valid statuses', () => {
    RetentionService.loadDemoPortions();
    const portions = RetentionService.getPortions();
    assert(portions.length >= 5, `Expected at least 5 portions, got ${portions.length}`);
    const validStatuses: PortionMemorizationStatus[] = [
      'not_memorized', 'currently_memorizing', 'recently_memorized', 'stable', 'needs_revision', 'weak'
    ];
    portions.forEach(p => {
      assert(validStatuses.includes(p.status), `Invalid status ${p.status} on portion ${p.id}`);
    });
  });

  runTest('RetentionService: demo seed uses canonical coordinate IDs', () => {
    RetentionService.loadDemoPortions();
    const portions = RetentionService.getPortions();
    assert(portions.every(portion => portion.id === createCanonicalPortionId(portion.surahNumber, portion.startAyah, portion.endAyah)),
      'Every demo portion ID must match its exact Quran coordinates');
  });

  // 2. Performance Rating: Successful
  runTest('RetentionService: "successful" rating extends interval and reinforces ease factor', () => {
    // Add temporary portion
    const newPortion = RetentionService.addPortion({
      type: 'passage',
      surahNumber: 67,
      surahName: 'الملك',
      startAyah: 1,
      endAyah: 10,
      status: 'recently_memorized',
      nextDueDate: new Date().toISOString().split('T')[0],
      intervalDays: 2,
      easeFactor: 2.5,
      repetitionCount: 2,
      mistakesCount: 0
    });

    const result = RetentionService.recordRevisionPerformance(newPortion.id, 'successful');
    assert(result.nextIntervalDays >= 4, `Expected interval >= 4, got ${result.nextIntervalDays}`);
    assert(result.updatedPortion.status === 'stable', `Expected stable status, got ${result.updatedPortion.status}`);
    assert(result.updatedPortion.easeFactor > 2.5, `Expected easeFactor > 2.5, got ${result.updatedPortion.easeFactor}`);
  });

  // 3. Performance Rating: Difficult
  runTest('RetentionService: "difficult" rating sets status to needs_revision with moderate interval', () => {
    const newPortion = RetentionService.addPortion({
      type: 'passage',
      surahNumber: 78,
      surahName: 'النبأ',
      startAyah: 1,
      endAyah: 15,
      status: 'recently_memorized',
      nextDueDate: new Date().toISOString().split('T')[0],
      intervalDays: 5,
      easeFactor: 2.5,
      repetitionCount: 3,
      mistakesCount: 0
    });

    const result = RetentionService.recordRevisionPerformance(newPortion.id, 'difficult', 'تردد طفيف');
    assert(result.updatedPortion.status === 'needs_revision', `Expected needs_revision, got ${result.updatedPortion.status}`);
    assert(result.nextIntervalDays <= 4, `Expected moderate interval <= 4, got ${result.nextIntervalDays}`);
  });

  // 4. Performance Rating: Failed (Resets interval to 1 day and status to weak)
  runTest('RetentionService: "failed" rating resets interval to 1 day and marks status as weak', () => {
    const newPortion = RetentionService.addPortion({
      type: 'passage',
      surahNumber: 110,
      surahName: 'النصر',
      startAyah: 1,
      endAyah: 3,
      status: 'needs_revision',
      nextDueDate: new Date().toISOString().split('T')[0],
      intervalDays: 4,
      easeFactor: 2.2,
      repetitionCount: 4,
      mistakesCount: 1
    });

    const result = RetentionService.recordRevisionPerformance(
      newPortion.id, 
      'failed', 
      'نسيان الآية 3',
      { ayahNumber: 2, text: 'نص آية اختبار من سورة النصر', notes: 'التباس التكرار' }
    );

    assert(result.nextIntervalDays === 1, `Expected reset to 1 day, got ${result.nextIntervalDays}`);
    assert(result.updatedPortion.status === 'weak', `Expected weak status, got ${result.updatedPortion.status}`);
    assert(result.updatedPortion.mistakesCount === 2, `Expected mistakesCount=2, got ${result.updatedPortion.mistakesCount}`);

    // Verify weak verse was logged in weak verses list
    const weakVerses = RetentionService.getWeakVerses();
    const foundWeak = weakVerses.find(w => w.surahNumber === 110 && w.ayahNumber === 2);
    assert(Boolean(foundWeak), 'Weak verse should be added to weak verses tracker');
  });

  // 5. Daily Queue Priority
  runTest('RetentionService: Daily revision queue prioritizes weak and overdue items', () => {
    const queue = RetentionService.getDailyRevisionQueue();
    // In our seed data, weak portion (Al-Kafirun) or needs_revision portions should be at the front
    if (queue.length > 1) {
      const first = queue[0];
      assert(first.status === 'weak' || first.status === 'needs_revision' || first.status === 'currently_memorizing', 
        `First item should be weak or needing attention, got ${first.status}`);
    }
  });

  // 6. Weekly Overview contains 7 days
  runTest('RetentionService: Weekly revision overview provides exactly 7 upcoming days', () => {
    const week = RetentionService.getWeeklyRevisionOverview();
    assert(week.length === 7, `Expected 7 days, got ${week.length}`);
    assert(week[0].isToday === true, 'First day should be marked as today');
  });

  // 7. Local-calendar weekly overview must not shift dates through UTC parsing.
  runTest('RetentionService: weekly overview preserves local date strings across year boundaries', () => {
    const week = RetentionService.getWeeklyRevisionOverview('2026-12-29');
    assert(week[0].date === '2026-12-29', 'Week must begin on the requested local date');
    assert(week[3].date === '2027-01-01', 'Week must cross into the next year without date drift');
    assert(week[6].date === '2027-01-04', 'Seven-day range must retain exact local calendar arithmetic');
  });

  // 8. Retention Dashboard Metrics
  runTest('RetentionService: Dashboard metrics calculate retention score between 0% and 100%', () => {
    const metrics = RetentionService.getRetentionDashboardMetrics();
    assert(metrics.retentionScorePercentage >= 0 && metrics.retentionScorePercentage <= 100,
      `Expected score 0-100%, got ${metrics.retentionScorePercentage}%`);
    assert(metrics.statusBreakdown.stable >= 0, 'Stable count should be non-negative');
    assert(metrics.totalTrackedPortions > 0, 'Should have tracked portions');
  });

  runTest('RetentionService: legacy first-memorization logs stay archived but are excluded from review history and totals', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:legacy-memorization-history');
    try {
      const today = getLocalDateString();
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 3,
        status: 'stable', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
        repetitionCount: 1, mistakesCount: 0
      });
      const legacyMemorization = {
        id: 'init-legacy-1', date: today, rating: 'successful' as const,
        intervalDaysBefore: 0, intervalDaysAfter: 1,
        notes: 'إتمام جلسة الحفظ الأولى للمقطع'
      };
      const realReview = {
        id: 'review-real-1', date: today, rating: 'successful' as const,
        intervalDaysBefore: 1, intervalDaysAfter: 2
      };
      RetentionService.savePortions([{ ...portion, history: [legacyMemorization, realReview] }]);
      const history = RetentionService.getRevisionHistory();
      assert(history.length === 1 && history[0].id === realReview.id,
        'Legacy first-memorization event must not appear as a review');
      assert(RetentionService.getPortions()[0].history?.length === 2,
        'Filtering legacy memorization from review views must not delete archived data');
      assert(RetentionService.getRetentionDashboardMetrics().totalReviewsCompleted === 1,
        'Legacy memorization must not inflate completed-review totals');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  runTest('RetentionService: duplicate review event IDs are counted only once across portions', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:duplicate-review-event-id');
    try {
      const today = getLocalDateString();
      const first = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 2,
        status: 'stable', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
        repetitionCount: 1, mistakesCount: 0
      });
      const second = RetentionService.addPortion({
        type: 'passage', surahNumber: 78, surahName: 'النبأ', startAyah: 1, endAyah: 2,
        status: 'stable', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
        repetitionCount: 1, mistakesCount: 0
      });
      const sharedEvent = {
        id: 'same-review-event-id', date: today, rating: 'difficult' as const,
        intervalDaysBefore: 2, intervalDaysAfter: 1
      };
      RetentionService.savePortions([
        { ...first, history: [sharedEvent] },
        { ...second, history: [{ ...sharedEvent }] }
      ]);
      assert(RetentionService.getRevisionHistory().length === 1,
        'A stable review event ID must not be counted twice across overlapping projections');
      assert(RetentionService.getRetentionDashboardMetrics().totalReviewsCompleted === 1,
        'Dashboard review totals must use unique event identities');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  runTest('RetentionService: average ease factor excludes portions not yet memorized', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:average-active-ease');
    try {
      const today = getLocalDateString();
      RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 2,
        status: 'not_memorized', nextDueDate: today, intervalDays: 1, easeFactor: 3,
        repetitionCount: 0, mistakesCount: 0
      });
      RetentionService.addPortion({
        type: 'passage', surahNumber: 78, surahName: 'النبأ', startAyah: 1, endAyah: 2,
        status: 'stable', nextDueDate: today, intervalDays: 5, easeFactor: 2,
        repetitionCount: 3, mistakesCount: 0
      });
      assert(RetentionService.getRetentionDashboardMetrics().averageEaseFactor === 2,
        'Average ease must reflect only memorized/reviewable portions');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  runTest('RetentionService: weekly overview uses the same status priority as the daily queue', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weekly-priority-order');
    try {
      const today = getLocalDateString();
      const base = { nextDueDate: today, intervalDays: 1, repetitionCount: 1, mistakesCount: 0 };
      RetentionService.addPortion({
        ...base, type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 2,
        status: 'stable', easeFactor: 2.5
      });
      RetentionService.addPortion({
        ...base, type: 'passage', surahNumber: 78, surahName: 'النبأ', startAyah: 1, endAyah: 2,
        status: 'needs_revision', easeFactor: 2.5
      });
      RetentionService.addPortion({
        ...base, type: 'passage', surahNumber: 93, surahName: 'الضحى', startAyah: 1, endAyah: 2,
        status: 'weak', easeFactor: 1.5
      });
      const statuses = RetentionService.getWeeklyRevisionOverview(today)[0].portions.map(item => item.status);
      assert(statuses.join(',') === 'weak,needs_revision,stable',
        'Weekly overview must put weak and needs-revision portions before stable portions');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  runTest('RetentionService: daily queue reports the full backlog while enforcing its 20-item cap', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:daily-queue-cap');
    try {
      const overdueDate = addDaysToLocalDate(getLocalDateString(), -1);
      for (let surahNumber = 1; surahNumber <= 21; surahNumber++) {
        RetentionService.addPortion({
          type: 'passage',
          surahNumber,
          surahName: 'اختبار',
          startAyah: 1,
          endAyah: 1,
          status: surahNumber === 21 ? 'weak' : 'stable',
          nextDueDate: overdueDate,
          intervalDays: 1,
          easeFactor: surahNumber === 21 ? 1.5 : 2.5,
          repetitionCount: 1,
          mistakesCount: 0
        });
      }
      const result = RetentionService.getDailyRevisionQueueDetails();
      assert(result.queue.length === 20, 'Daily queue must never exceed 20 items');
      assert(result.totalDueCount === 21 && result.overdueCount === 21,
        'Queue details must retain accurate total-due and overdue counts beyond the visible cap');
      assert(result.catchUpSuggested, 'A backlog greater than 15 must suggest catch-up');
      assert(result.queue[0].status === 'weak', 'Weak portions must remain first when the queue is capped');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  runTest('RetentionService: daily and weekly queues reject impossible calendar dates', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:invalid-queue-dates');
    try {
      let dailyRejected = false;
      let weeklyRejected = false;
      try { RetentionService.getDailyRevisionQueue('2026-02-30'); } catch { dailyRejected = true; }
      try { RetentionService.getWeeklyRevisionOverview('2026-02-30'); } catch { weeklyRejected = true; }
      assert(dailyRejected && weeklyRejected, 'Both queue views must reject impossible calendar dates');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  runTest('RetentionService: failed review cannot store a placeholder when weak-ayah text is missing', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-text-required');
    try {
      const today = getLocalDateString();
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 3,
        status: 'needs_revision', nextDueDate: today, intervalDays: 2, easeFactor: 2.2,
        repetitionCount: 2, mistakesCount: 0
      });
      const beforePortions = JSON.stringify(RetentionService.getPortions());
      const beforeWeak = JSON.stringify(RetentionService.getWeakVerses());
      let rejected = false;
      try {
        RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, { ayahNumber: 2 });
      } catch { rejected = true; }
      assert(rejected, 'A failed review with weak-ayah details must include verified verse text');
      assert(JSON.stringify(RetentionService.getPortions()) === beforePortions,
        'Missing Quran text must be rejected before revision state changes');
      assert(JSON.stringify(RetentionService.getWeakVerses()) === beforeWeak,
        'Missing Quran text must not create a placeholder weak-verse record');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  return { passed, failed, results };
}

// Execute standalone if run directly via tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('retentionService.test')) {
  console.log('🧪 Running Quran Retention System Unit Tests...\n');
  const { passed, failed } = runAllRetentionTests();
  console.log(`\n========================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);
  if (failed > 0) process.exit(1);
}
