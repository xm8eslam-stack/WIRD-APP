import { RetentionService, DEFAULT_PORTIONS } from './retentionService';
import { PortionMemorizationStatus, RevisionRating } from '../types/quran';

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
      surahNumber: 109,
      surahName: 'الكافرون',
      startAyah: 1,
      endAyah: 6,
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
      { ayahNumber: 3, text: 'وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ', notes: 'التباس التكرار' }
    );

    assert(result.nextIntervalDays === 1, `Expected reset to 1 day, got ${result.nextIntervalDays}`);
    assert(result.updatedPortion.status === 'weak', `Expected weak status, got ${result.updatedPortion.status}`);
    assert(result.updatedPortion.mistakesCount === 2, `Expected mistakesCount=2, got ${result.updatedPortion.mistakesCount}`);

    // Verify weak verse was logged in weak verses list
    const weakVerses = RetentionService.getWeakVerses();
    const foundWeak = weakVerses.find(w => w.surahNumber === 109 && w.ayahNumber === 3);
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
