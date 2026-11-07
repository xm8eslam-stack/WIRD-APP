import { QuranMath } from './quranMath';
import { PlanningEngine, PlanGenerationInput, ScheduledDayPlan } from './planningEngine';
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

  runTest('PlanLifecycle: preserves completed revision-only tasks and reschedules pending revisions on resume', () => {
    const input: PlanGenerationInput = {
      title: 'خطة اختبار المراجعة',
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
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      restDays: [],
      schedulePreference: 'single_session'
    };
    const plan = PlanningEngine.generatePlan(input);
    const completedRevisionDay: ScheduledDayPlan = {
      id: 'revision-completed',
      date: '2026-11-01',
      dayOfWeek: 0,
      dayNameAr: 'الأحد',
      isRestDay: false,
      minorRevisionTask: {
        description: 'مراجعة محفوظ سابق',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 5,
        versesCount: 5,
        estimatedMinutes: 10,
        completed: true,
        type: 'minor'
      },
      status: 'completed'
    };
    const pendingRevisionDay: ScheduledDayPlan = {
      id: 'revision-pending',
      date: '2026-11-02',
      dayOfWeek: 1,
      dayNameAr: 'الإثنين',
      isRestDay: false,
      majorRevisionTask: {
        description: 'مراجعة كبرى',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 10,
        versesCount: 10,
        estimatedMinutes: 20,
        completed: false,
        type: 'major'
      },
      status: 'pending'
    };
    const pausedPlan = {
      ...plan,
      isPaused: true,
      pausedAt: '2026-11-03',
      schedule: [completedRevisionDay, pendingRevisionDay]
    };

    const resumed = PlanLifecycle.resumePlan(pausedPlan, '2026-11-07');
    const completed = resumed.schedule.find(day => day.id === 'revision-completed');
    const pending = resumed.schedule.find(day => day.majorRevisionTask?.description === 'مراجعة كبرى');

    assert(completed?.date === '2026-11-01', 'Completed revision-only day must remain on its original date');
    assert(completed?.minorRevisionTask?.completed === true, 'Completed minor revision must remain completed');
    assert(Boolean(pending), 'Pending major revision must be rescheduled');
    assert((pending?.date || '') >= '2026-11-07', 'Pending revision must move to resume date or later');
    assert(pending?.majorRevisionTask?.completed === false, 'Rescheduled revision must remain incomplete');
  });

  runTest('PlanLifecycle: keeps completed work on a partial day and moves only unfinished tasks', () => {
    const input: PlanGenerationInput = {
      title: 'خطة يوم جزئي',
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
    const plan = PlanningEngine.generatePlan(input);
    const partialDay: ScheduledDayPlan = {
      id: 'partial-day',
      date: '2026-11-01',
      dayOfWeek: 0,
      dayNameAr: 'الأحد',
      isRestDay: false,
      memorizationTask: {
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 10,
        versesCount: 10,
        estimatedMinutes: 20,
        completed: true,
        completedAt: '2026-11-01T10:00:00Z'
      },
      minorRevisionTask: {
        description: 'مراجعة لم تكتمل',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 11,
        endAyah: 15,
        versesCount: 5,
        estimatedMinutes: 10,
        completed: false,
        type: 'minor'
      },
      status: 'partially_completed'
    };
    const resumed = PlanLifecycle.resumePlan({
      ...plan,
      isPaused: true,
      pausedAt: '2026-11-02',
      schedule: [partialDay]
    }, '2026-11-07');

    const history = resumed.schedule.find(day => day.id === 'partial-day');
    const movedRevision = resumed.schedule.find(day => day.minorRevisionTask?.description === 'مراجعة لم تكتمل');
    assert(history?.memorizationTask?.completed === true, 'Completed memorization must stay in history');
    assert(history?.minorRevisionTask === undefined, 'Unfinished revision must not remain on the old day');
    assert(Boolean(movedRevision), 'Unfinished revision must be rescheduled');
    assert(movedRevision?.minorRevisionTask?.completed === false, 'Moved revision must remain pending');
  });

  runTest('PlanLifecycle: preserves pending tasks when a legacy plan has no active study days', () => {
    const input: PlanGenerationInput = {
      title: 'خطة بلا أيام نشطة',
      startSurah: 67,
      startAyah: 1,
      endSurah: 67,
      endAyah: 10,
      startDate: '2026-11-01',
      level: 'intermediate',
      dailyAvailableMinutes: 30,
      dailyRevisionMinutes: 15,
      paceType: 'verses_per_day',
      paceQuantity: 5,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      restDays: [],
      schedulePreference: 'single_session'
    };
    const plan = PlanningEngine.generatePlan(input);
    const pendingDay = plan.schedule[0];
    const invalidPlan = {
      ...plan,
      isPaused: true,
      input: { ...plan.input, activeDays: [0], restDays: [0] },
      schedule: [pendingDay]
    };

    const resumed = PlanLifecycle.resumePlan(invalidPlan, '2026-11-07');
    assert(resumed.isPaused === true, 'Resume must remain paused when no valid active day exists');
    assert(resumed.schedule[0].id === pendingDay.id, 'Resume must preserve the original pending task');

    const recalculated = PlanLifecycle.recalculatePlan(invalidPlan, 5);
    assert(recalculated.schedule[0].id === pendingDay.id,
      'Recalculation must preserve pending tasks when no active day exists');
  });

  runTest('PlanLifecycle: recalculation preserves completed revision history and reschedules pending revision work', () => {
    const input: PlanGenerationInput = {
      title: 'خطة إعادة الحساب',
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
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      restDays: [],
      schedulePreference: 'single_session'
    };
    const plan = PlanningEngine.generatePlan(input);
    const completedMemorization: ScheduledDayPlan = {
      id: 'mem-completed',
      date: '2026-11-01',
      dayOfWeek: 0,
      dayNameAr: 'الأحد',
      isRestDay: false,
      memorizationTask: {
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 10,
        versesCount: 10,
        estimatedMinutes: 20,
        completed: true,
        completedAt: '2026-11-01T10:00:00Z'
      },
      status: 'completed'
    };
    const completedRevision: ScheduledDayPlan = {
      id: 'major-completed',
      date: '2026-11-02',
      dayOfWeek: 1,
      dayNameAr: 'الإثنين',
      isRestDay: false,
      majorRevisionTask: {
        description: 'مراجعة كبرى مكتملة',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 10,
        versesCount: 10,
        estimatedMinutes: 20,
        completed: true,
        type: 'major'
      },
      status: 'completed'
    };
    const pendingRevision: ScheduledDayPlan = {
      id: 'minor-pending',
      date: '2026-11-03',
      dayOfWeek: 2,
      dayNameAr: 'الثلاثاء',
      isRestDay: false,
      minorRevisionTask: {
        description: 'مراجعة صغرى معلقة',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 5,
        versesCount: 5,
        estimatedMinutes: 10,
        completed: false,
        type: 'minor'
      },
      status: 'pending'
    };
    const recalculated = PlanLifecycle.recalculatePlan({
      ...plan,
      schedule: [completedMemorization, completedRevision, pendingRevision]
    }, 5);

    const completedRevisionAfter = recalculated.schedule.find(day => day.id === 'major-completed');
    const pendingRevisionAfter = recalculated.schedule.find(day => day.minorRevisionTask?.description === 'مراجعة صغرى معلقة');
    const newMemorization = recalculated.schedule.find(day => day.memorizationTask && !day.memorizationTask.completed);

    assert(completedRevisionAfter?.majorRevisionTask?.completed === true,
      'Completed major revision must remain in history');
    assert(Boolean(pendingRevisionAfter), 'Pending minor revision must be rescheduled');
    assert(pendingRevisionAfter?.minorRevisionTask?.completed === false,
      'Rescheduled minor revision must remain incomplete');
    assert(newMemorization?.memorizationTask?.startAyah === 11,
      'Recalculated memorization must continue after the last completed ayah');
  });

  runTest('PlanLifecycle: recalculation preserves incomplete gaps when tasks were completed out of order', () => {
    const input: PlanGenerationInput = {
      title: 'خطة إكمال غير مرتبة',
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
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      restDays: [],
      schedulePreference: 'single_session'
    };
    const plan = PlanningEngine.generatePlan(input);
    const completedMiddleRange: ScheduledDayPlan = {
      id: 'middle-range-completed-first',
      date: '2026-11-01',
      dayOfWeek: 0,
      dayNameAr: 'الأحد',
      isRestDay: false,
      memorizationTask: {
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 11,
        endAyah: 20,
        versesCount: 10,
        estimatedMinutes: 20,
        completed: true,
        completedAt: '2026-11-01T10:00:00Z'
      },
      status: 'completed'
    };

    const recalculated = PlanLifecycle.recalculatePlan({
      ...plan,
      schedule: [completedMiddleRange]
    }, 5);
    const newTasks = recalculated.schedule
      .filter(day => day.memorizationTask && !day.memorizationTask.completed)
      .map(day => ({
        start: day.memorizationTask!.startAyah,
        end: day.memorizationTask!.endAyah
      }));

    assert(newTasks.some(task => task.start === 1 && task.end === 5),
      'Uncompleted verses before the furthest completed task must remain scheduled');
    assert(newTasks.some(task => task.start === 6 && task.end === 10),
      'The entire earlier gap must remain scheduled');
    assert(newTasks.some(task => task.start === 21 && task.end === 25),
      'Uncompleted verses after the completed range must remain scheduled');
    assert(newTasks.some(task => task.start === 26 && task.end === 30),
      'The final gap must remain scheduled');
    assert(!newTasks.some(task => task.start <= 20 && task.end >= 11),
      'Completed middle verses must not be scheduled again');
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
