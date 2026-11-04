import { QuranMath } from './quranMath';
import { PlanningEngine, PlanGenerationInput } from './planningEngine';
import { PlanLifecycle } from './planLifecycle';
import { SpacedRevisionEngine } from './spacedRevisionEngine';
import { RevisionItem } from '../types/quran';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  } else {
    console.log(`✅ PASS: ${testName}`);
  }
}

export function runAllPlanningEngineTests(): { passed: number; failed: number; results: string[] } {
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

  // 1. Quran Math Tests
  runTest('QuranMath: Al-Fatiha has exactly 7 verses', () => {
    const verses = QuranMath.countVersesBetween({ surahNumber: 1, ayahNumber: 1 }, { surahNumber: 1, ayahNumber: 7 });
    assert(verses === 7, `Expected 7, got ${verses}`);
  });

  runTest('QuranMath: Al-Mulk has exactly 30 verses', () => {
    const verses = QuranMath.countVersesBetween({ surahNumber: 67, ayahNumber: 1 }, { surahNumber: 67, ayahNumber: 30 });
    assert(verses === 30, `Expected 30, got ${verses}`);
  });

  runTest('QuranMath: Coordinate advances across surahs correctly (113 to 114)', () => {
    // Surah 113 has 5 verses. From 113:1 to 114:6:
    // Surah 113 (5) + Surah 114 (6) = 11 verses total
    const verses = QuranMath.countVersesBetween({ surahNumber: 113, ayahNumber: 1 }, { surahNumber: 114, ayahNumber: 6 });
    assert(verses === 11, `Expected 11, got ${verses}`);

    // Adding 6 verses to 113:1 should reach 114:2
    const adv = QuranMath.addVerses({ surahNumber: 113, ayahNumber: 1 }, 6);
    assert(adv.surahNumber === 114 && adv.ayahNumber === 2, `Expected 114:2, got ${adv.surahNumber}:${adv.ayahNumber}`);
  });

  // 2. Date Calculations & Active Days
  runTest('PlanningEngine: Active days counting skips weekly rest days', () => {
    // 7 days total (Sunday to Saturday), with Friday (day 5) as rest day
    const activeDays = [0, 1, 2, 3, 4, 6]; // 6 study days
    const restDays = [5]; // Friday rest
    const count = PlanningEngine.countActiveDaysBetween('2026-11-01', '2026-11-07', activeDays, restDays);
    assert(count === 6, `Expected 6 study days, got ${count}`);
  });

  // 3. Task Distribution
  runTest('PlanningEngine: Accurately distributes 30 verses into 6 study days of 5 verses each', () => {
    const input: PlanGenerationInput = {
      title: 'خطة سورة الملك',
      startSurah: 67,
      startAyah: 1,
      endSurah: 67,
      endAyah: 30,
      startDate: '2026-11-01',
      level: 'intermediate',
      dailyAvailableMinutes: 30,
      dailyRevisionMinutes: 15,
      paceType: 'verses_per_day',
      paceQuantity: 5,
      activeDays: [0, 1, 2, 3, 4, 6], // Sun-Thu + Sat
      restDays: [5], // Friday off
      schedulePreference: 'single_session'
    };

    const plan = PlanningEngine.generatePlan(input);
    assert(plan.meta.totalVerses === 30, `Total verses should be 30, got ${plan.meta.totalVerses}`);
    assert(plan.meta.activeStudyDaysCount === 6, `Active study days should be 6, got ${plan.meta.activeStudyDaysCount}`);
    
    // Check first and last tasks
    const studyTasks = plan.schedule.filter(s => !s.isRestDay && s.memorizationTask);
    assert(studyTasks.length === 6, `Expected 6 study tasks, got ${studyTasks.length}`);
    assert(studyTasks[0].memorizationTask?.startAyah === 1 && studyTasks[0].memorizationTask?.endAyah === 5, 'Day 1 should be 1-5');
    assert(studyTasks[5].memorizationTask?.startAyah === 26 && studyTasks[5].memorizationTask?.endAyah === 30, 'Day 6 should be 26-30');
  });

  // 4. Workload Limits & Feasibility
  runTest('PlanningEngine: Detects impossible workload for beginners', () => {
    // 50 verses per day with only 15 minutes available for a beginner
    const feasibility = PlanningEngine.assessFeasibility(50, 'beginner', 15, 10);
    assert(!feasibility.isFeasible, 'Should mark 50 verses/day in 15 min as not feasible');
    assert(feasibility.cognitiveLoadScore === 'impossible', 'Should rate load as impossible');
  });

  runTest('PlanningEngine: Marks sensible workload as optimal', () => {
    // 5 verses per day with 30 minutes available
    const feasibility = PlanningEngine.assessFeasibility(5, 'intermediate', 30, 15);
    assert(feasibility.isFeasible, 'Sensible pace should be feasible');
    assert(feasibility.cognitiveLoadScore === 'optimal', 'Pace should be optimal');
  });

  // 5. Plan Recalculation & Preservation
  runTest('PlanLifecycle: Preserves completed tasks when plan is paused and resumed', () => {
    const input: PlanGenerationInput = {
      title: 'خطة تجريبية',
      startSurah: 67,
      startAyah: 1,
      endSurah: 67,
      endAyah: 30,
      startDate: '2026-11-01',
      level: 'intermediate',
      dailyAvailableMinutes: 30,
      dailyRevisionMinutes: 15,
      paceType: 'verses_per_day',
      paceQuantity: 10,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      restDays: [],
      schedulePreference: 'single_session'
    };

    let plan = PlanningEngine.generatePlan(input);
    const firstTaskId = plan.schedule[0].id;

    // Mark task 1 as completed
    plan = PlanLifecycle.updateTask(plan, firstTaskId, {
      memorizationTask: {
        ...plan.schedule[0].memorizationTask!,
        completed: true,
        completedAt: '2026-11-01T10:00:00Z'
      }
    });

    assert(plan.schedule[0].memorizationTask?.completed === true, 'Task 1 should be marked completed');

    // Pause plan
    plan = PlanLifecycle.pausePlan(plan, '2026-11-02');
    assert(plan.isPaused === true, 'Plan should be paused');

    // Resume plan 5 days later
    plan = PlanLifecycle.resumePlan(plan, '2026-11-07');
    assert(plan.isPaused === false, 'Plan should be active after resume');

    // Verify task 1 remains completed with original timestamp!
    const task1 = plan.schedule.find(s => s.memorizationTask?.startAyah === 1 && s.memorizationTask?.endAyah === 10);
    assert(task1?.memorizationTask?.completed === true, 'Completed task 1 must be preserved');
    assert(task1?.memorizationTask?.completedAt === '2026-11-01T10:00:00Z', 'Completed timestamp must never be overwritten');
  });

  // 6. Spaced Revision SM-2 Engine
  runTest('SpacedRevisionEngine: Grade 5 increases interval, Grade 1 resets to 1 day', () => {
    const testItem: RevisionItem = {
      id: 'rev-test',
      surahNumber: 67,
      surahName: 'الملك',
      startAyah: 1,
      endAyah: 10,
      type: 'minor',
      nextDueDate: '2026-11-01',
      intervalDays: 3,
      easeFactor: 2.5,
      repetitionCount: 2,
      strength: 'medium'
    };

    // Test Grade 5
    const successResult = SpacedRevisionEngine.scheduleNextReview(testItem, 5);
    assert(successResult.nextIntervalDays >= 7, `Expected interval >= 7, got ${successResult.nextIntervalDays}`);
    assert(successResult.newEaseFactor >= 2.5, `Ease factor should increase or stay high, got ${successResult.newEaseFactor}`);

    // Test Grade 1 (failure)
    const failResult = SpacedRevisionEngine.scheduleNextReview(testItem, 1);
    assert(failResult.nextIntervalDays === 1, `Failed retention must reset interval to 1 day, got ${failResult.nextIntervalDays}`);
    assert(failResult.updatedItem.strength === 'weak', 'Failed retention must set strength to weak');
  });

  return { passed, failed, results };
}

// If run directly via tsx:
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('planningEngine.test')) {
  console.log("=== تشغيل اختبارات محرك التخطيط القرآني (WIRD Planning Engine) ===");
  const { passed, failed } = runAllPlanningEngineTests();
  console.log(`\nالنتيجة النهائية: ${passed} نجح | ${failed} فشل`);
  if (failed > 0) process.exit(1);
}
