import { calculateUniqueRetentionScore } from '../services/unifiedPortionService';
import { WirdPortion } from '../types/quran';

export function runUniqueRetentionScoreTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const portion = (id: string, startAyah: number, endAyah: number, status: WirdPortion['status']): WirdPortion => ({
    id, type: 'passage', surahNumber: 1, surahName: 'الفاتحة', startAyah, endAyah, status,
    nextDueDate: '2026-11-06', intervalDays: 1, easeFactor: 2.5, repetitionCount: 1
  });

  test('Empty progress has a zero retention score', () => {
    assert(calculateUniqueRetentionScore([]) === 0, 'No tracked ayahs must yield 0%');
  });

  test('Stable ayahs score 100 percent', () => {
    assert(calculateUniqueRetentionScore([portion('stable', 1, 7, 'stable')]) === 100, 'All stable ayahs must yield 100%');
  });

  test('Overlapping portions count each ayah once and choose the weakest status', () => {
    const result = calculateUniqueRetentionScore([
      portion('stable-overlap', 1, 3, 'stable'),
      portion('weak-overlap', 2, 4, 'weak')
    ]);
    assert(result === 40, 'Four unique ayahs (one stable, three weak) must yield 40%, not a duplicated weighted score');
  });

  test('Unmemorized records do not inflate the retention denominator', () => {
    const result = calculateUniqueRetentionScore([
      portion('stable', 1, 2, 'stable'),
      portion('empty', 3, 7, 'not_memorized')
    ]);
    assert(result === 100, 'Not-memorized ranges must not lower retention quality');
  });

  return { passed, failed };
}
