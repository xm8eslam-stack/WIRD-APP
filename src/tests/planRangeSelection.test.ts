import { findNextUnmemorizedRange, getPlanTargetSurahNumbers } from '../services/unifiedPortionService';
import { ALL_SURAHS } from '../data/quranMeta';
import { MemorizationPlan, WirdPortion } from '../types/quran';

export function runPlanRangeSelectionTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  const makePlan = (overrides: Partial<MemorizationPlan>): MemorizationPlan => ({
    id: 'scope-test', title: 'Scope', description: '', type: 'whole_quran',
    totalUnits: 0, completedUnits: 0, unitType: 'ayah', dailyTarget: 5,
    memorizationDaysPerWeek: 5, revisionDaysPerWeek: 2,
    startDate: '2026-11-05', targetEndDate: '2027-01-01', isActive: true,
    ...overrides
  });

  const makePortion = (surahNumber: number, startAyah: number, endAyah: number, status: WirdPortion['status']): WirdPortion => ({
    id: `s${surahNumber}_a${startAyah}_a${endAyah}`, type: 'passage',
    surahNumber, surahName: ALL_SURAHS.find(s => s.number === surahNumber)?.name || '',
    startAyah, endAyah, status, nextDueDate: '2026-11-05',
    intervalDays: 1, easeFactor: 2.5, repetitionCount: 0
  });

  test('Preset Surah scope is deduplicated and validated', () => {
    const result = getPlanTargetSurahNumbers(makePlan({ targetSurahs: [2, 2, 0, 115] }));
    assert(result.length === 1 && result[0] === 2, 'Only unique valid Surah numbers should remain');
  });

  test('Preset page scope resolves from canonical Mushaf metadata', () => {
    const result = getPlanTargetSurahNumbers(makePlan({ startPage: 1, endPage: 1 }));
    assert(result.length === 1 && result[0] === 1, 'Page one should resolve to Al-Fatihah only');
  });

  test('An in-progress passage is resumed before a new gap', () => {
    const result = findNextUnmemorizedRange([makePortion(2, 10, 20, 'currently_memorizing')], [2], 5);
    assert(result?.surahNumber === 2 && result.startAyah === 10 && result.endAyah === 14, 'Resume must stay inside the in-progress passage and daily limit');
  });

  test('Next range stops before an already covered memorized passage', () => {
    const portions = [
      makePortion(1, 1, 2, 'stable'),
      makePortion(1, 4, 6, 'recently_memorized')
    ];
    const result = findNextUnmemorizedRange(portions, [1], 5);
    assert(result?.surahNumber === 1 && result.startAyah === 3 && result.endAyah === 3, 'Next range must not overlap memorized ayahs');
  });

  test('No plan scope defaults to all Surahs', () => {
    const result = getPlanTargetSurahNumbers(makePlan({}));
    assert(result.length === 114 && result[0] === 1 && result[113] === 114, 'Unscoped plans should include the canonical 114 Surahs');
  });

  return { passed, failed };
}
