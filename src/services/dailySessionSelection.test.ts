import {
  getNextDueEngineTask,
  getNextPresetMemorizationRange,
  isPresetAutoStartSupported
} from './dailySessionSelection';
import { EngineGeneratedPlan, ScheduledDayPlan, ScheduledTaskUnit } from './planningEngine';
import { MemorizationPlan, WirdPortion } from '../types/quran';
import { ALL_SURAHS } from '../data/quranMeta';

export function runDailySessionSelectionTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  const makeTask = (surahNumber: number, completed = false): ScheduledTaskUnit => ({
    surahNumber,
    surahName: ALL_SURAHS.find(surah => surah.number === surahNumber)?.name || '',
    startAyah: 1,
    endAyah: 5,
    versesCount: 5,
    estimatedMinutes: 10,
    completed
  });

  const makeDay = (date: string, task?: ScheduledTaskUnit): ScheduledDayPlan => ({
    id: date,
    date,
    dayOfWeek: 0,
    dayNameAr: 'الأحد',
    isRestDay: !task,
    memorizationTask: task,
    status: task?.completed ? 'completed' : 'pending'
  });

  const makeEnginePlan = (
    schedule: ScheduledDayPlan[],
    overrides: Partial<EngineGeneratedPlan> = {}
  ): EngineGeneratedPlan => ({
    id: 'engine-plan-test',
    title: 'اختبار',
    input: {} as EngineGeneratedPlan['input'],
    meta: {} as EngineGeneratedPlan['meta'],
    feasibility: {} as EngineGeneratedPlan['feasibility'],
    rationale: '',
    schedule,
    actualVsPlanned: {} as EngineGeneratedPlan['actualVsPlanned'],
    isActive: true,
    isPaused: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides
  });

  const makePreset = (overrides: Partial<MemorizationPlan> = {}): MemorizationPlan => ({
    id: 'preset-test',
    title: 'اختبار',
    description: '',
    type: 'whole_quran',
    totalUnits: 0,
    completedUnits: 0,
    unitType: 'ayah',
    dailyTarget: 5,
    memorizationDaysPerWeek: 5,
    revisionDaysPerWeek: 2,
    startDate: '2026-11-01',
    targetEndDate: '2027-01-01',
    isActive: true,
    ...overrides
  });

  const emptyPortions: WirdPortion[] = [];

  test('Engine quick-start chooses the oldest overdue task before today', () => {
    const plan = makeEnginePlan([
      makeDay('2026-11-04', makeTask(2)),
      makeDay('2026-11-05', makeTask(3)),
      makeDay('2026-11-06', makeTask(4))
    ]);
    const task = getNextDueEngineTask(plan, '2026-11-05');
    assert(task?.surahNumber === 2, 'The oldest due task should be selected first');
  });

  test('Engine quick-start never starts a future task early', () => {
    const plan = makeEnginePlan([makeDay('2026-11-06', makeTask(4))]);
    assert(getNextDueEngineTask(plan, '2026-11-05') === null, 'Future tasks must remain pending');
  });

  test('Engine quick-start ignores paused, inactive, and completed tasks', () => {
    const task = makeTask(4);
    const paused = makeEnginePlan([makeDay('2026-11-05', task)], { isPaused: true });
    const inactive = makeEnginePlan([makeDay('2026-11-05', task)], { isActive: false });
    const completed = makeEnginePlan([makeDay('2026-11-05', makeTask(4, true))]);
    assert(getNextDueEngineTask(paused, '2026-11-05') === null, 'Paused plan must be ignored');
    assert(getNextDueEngineTask(inactive, '2026-11-05') === null, 'Inactive plan must be ignored');
    assert(getNextDueEngineTask(completed, '2026-11-05') === null, 'Completed task must be ignored');
  });

  test('Whole-Quran ayah preset resolves from the beginning of the canonical Surah order', () => {
    const range = getNextPresetMemorizationRange(makePreset(), emptyPortions, 5);
    assert(range?.surahNumber === 1 && range.startAyah === 1 && range.endAyah === 5, 'Whole-Quran plan should begin at Al-Fatihah');
  });

  test('Surah/custom ayah presets stay inside their explicit Surah scope', () => {
    const plan = makePreset({ type: 'surahs', targetSurahs: [67] });
    const range = getNextPresetMemorizationRange(plan, emptyPortions, 4);
    assert(range?.surahNumber === 67 && range.startAyah === 1 && range.endAyah === 4, 'Selected-Surah plan must not jump outside its scope');
  });

  test('Juz and page presets are not silently widened to whole Surahs', () => {
    const juzPlan = makePreset({ type: 'juz', targetJuz: [29] });
    const pagePlan = makePreset({ unitType: 'page', startPage: 562, endPage: 563 });
    assert(!isPresetAutoStartSupported(juzPlan), 'Juz scope needs an exact coordinate resolver');
    assert(!isPresetAutoStartSupported(pagePlan), 'Page scope needs an exact coordinate resolver');
    assert(getNextPresetMemorizationRange(juzPlan, emptyPortions) === null, 'Juz scope must not start a broad Surah range');
    assert(getNextPresetMemorizationRange(pagePlan, emptyPortions) === null, 'Page scope must not start a broad Surah range');
  });

  test('Invalid or missing Surah scopes are rejected', () => {
    const invalid = makePreset({ type: 'custom', targetSurahs: [0, 115] });
    const missing = makePreset({ type: 'custom' });
    assert(!isPresetAutoStartSupported(invalid), 'Invalid Surah numbers must be rejected');
    assert(!isPresetAutoStartSupported(missing), 'Custom plan without an explicit scope must be rejected');
  });

  return { passed, failed };
}
