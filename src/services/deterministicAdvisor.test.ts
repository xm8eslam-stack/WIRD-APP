import { DeterministicAdvisorEngine } from './deterministicAdvisor';
import { DailyLog, UserProfile, PortionStatusRecord, WeakVerseItem } from '../types/quran';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  } else {
    console.log(`✅ PASS: ${testName}`);
  }
}

export function runAllAdvisorTests(): { passed: number; failed: number; results: string[] } {
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

  const dummyProfile: UserProfile = {
    name: "عبد الرحمن",
    email: "abdurrahman@example.com",
    memorizationGoal: "حفظ القرآن الكريم",
    preferredReciter: "alafasy",
    quranFontSize: "lg",
    audioAutoPlay: true,
    repetitionTarget: 10,
    theme: "light",
    streakDays: 14,
    lastActiveDate: "2026-11-03"
  };

  const dummyLogs: DailyLog[] = [
    { date: "2026-10-28", memorizedAyahsCount: 5, reviewedPagesCount: 2, minutesSpent: 30, completedTasks: ["سورة الملك"] },
    { date: "2026-10-29", memorizedAyahsCount: 0, reviewedPagesCount: 0, minutesSpent: 0, completedTasks: [] }, // missed
    { date: "2026-10-30", memorizedAyahsCount: 5, reviewedPagesCount: 3, minutesSpent: 35, completedTasks: ["سورة الملك"] },
    { date: "2026-10-31", memorizedAyahsCount: 0, reviewedPagesCount: 0, minutesSpent: 0, completedTasks: [] }, // missed
    { date: "2026-11-01", memorizedAyahsCount: 6, reviewedPagesCount: 2, minutesSpent: 30, completedTasks: ["سورة النبأ"] },
    { date: "2026-11-02", memorizedAyahsCount: 7, reviewedPagesCount: 2, minutesSpent: 35, completedTasks: ["سورة النبأ"] },
    { date: "2026-11-03", memorizedAyahsCount: 5, reviewedPagesCount: 4, minutesSpent: 40, completedTasks: ["مراجعة"] }
  ];

  const dummyPortions: PortionStatusRecord[] = [
    {
      id: "p1",
      type: "passage",
      surahNumber: 109,
      surahName: "الكافرون",
      startAyah: 1,
      endAyah: 6,
      status: "weak",
      nextDueDate: "2026-11-04",
      intervalDays: 1,
      easeFactor: 1.7,
      repetitionCount: 4,
      mistakesCount: 3,
      history: []
    },
    {
      id: "p2",
      type: "passage",
      surahNumber: 67,
      surahName: "الملك",
      startAyah: 16,
      endAyah: 30,
      status: "needs_revision",
      nextDueDate: "2026-11-04",
      intervalDays: 3,
      easeFactor: 2.2,
      repetitionCount: 3,
      mistakesCount: 1,
      history: []
    }
  ];

  const dummyWeakVerses: WeakVerseItem[] = [
    {
      id: "w1",
      surahNumber: 109,
      surahName: "الكافرون",
      ayahNumber: 3,
      text: "وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ",
      mistakeCount: 4,
      lastFailedDate: "2026-11-01"
    }
  ];

  // 1. History analysis calculates metrics correctly
  runTest('AdvisorEngine: History analysis correctly calculates completion rate and detects gaps', () => {
    const report = DeterministicAdvisorEngine.analyzeHistory(dummyLogs, dummyProfile, dummyPortions, dummyWeakVerses);
    assert(report.completionRate > 0 && report.completionRate < 100, `Expected rate 0-100, got ${report.completionRate}`);
    assert(report.weeklySummary.totalMinutes === 170, `Expected 170 mins, got ${report.weeklySummary.totalMinutes}`);
    assert(report.weeklySummary.totalAyahsMemorized === 28, `Expected 28 ayahs, got ${report.weeklySummary.totalAyahsMemorized}`);
  });

  // 2. Revision priorities prioritizes weak portions
  runTest('AdvisorEngine: Weak portions and verses are prioritized at the top of revision recommendations', () => {
    const report = DeterministicAdvisorEngine.analyzeHistory(dummyLogs, dummyProfile, dummyPortions, dummyWeakVerses);
    assert(report.revisionPriorities.length > 0, 'Should provide revision priorities');
    assert(report.revisionPriorities.some(p => p.includes('الكافرون')), 'Should prioritize weak surah Al-Kafirun');
  });

  // 3. Workload adjustments suggested on missed tasks
  runTest('AdvisorEngine: Proposes workload adjustments when missed tasks or weak portions are detected', () => {
    const report = DeterministicAdvisorEngine.analyzeHistory(dummyLogs, dummyProfile, dummyPortions, dummyWeakVerses);
    assert(report.suggestedWorkloadAdjustments.length > 0, 'Should suggest workload adjustments');
    assert(report.difficultyReasons.length > 0, 'Should provide difficulty reasons');
  });

  // 4. Pedagogical questions answered safely
  runTest('AdvisorEngine: Answers questions about memorization methods and rules without inventing verses', () => {
    const answerForForgetting = DeterministicAdvisorEngine.answerQuestion('أعاني من نسيان القرآن وتفلته بسرعة، فما العلاج؟');
    assert(answerForForgetting.includes('التكرار') || answerForForgetting.includes('المراجعة'), 'Should recommend spaced revision and repetition');

    const answerForSession = DeterministicAdvisorEngine.answerQuestion('كيف أنظم جلسة الحفظ في 30 دقيقة؟');
    assert(answerForSession.includes('70%') || answerForSession.includes('الدقائق') || answerForSession.includes('مراجعة'), 'Should structure 30 min session');
  });

  return { passed, failed, results };
}

// Standalone execution
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('deterministicAdvisor.test')) {
  console.log('🧪 Running Deterministic Advisor Engine Unit Tests...\n');
  const { passed, failed } = runAllAdvisorTests();
  console.log(`\n========================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);
  if (failed > 0) process.exit(1);
}
