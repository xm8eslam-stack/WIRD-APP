import { getPageAyahSegments, getPageProgressStatus } from './pageProgressService';
import { PortionStatusRecord } from '../types/quran';

export function runPageProgressServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Generated Mushaf page index maps Al-Fatihah page to its exact ayah range', () => {
    const segments = getPageAyahSegments(1);
    assert(segments.length === 1, 'Page 1 must have one contiguous Surah segment');
    assert(segments[0].surahNumber === 1 && segments[0].startAyah === 1 && segments[0].endAyah === 7, 'Page 1 must map to Al-Fatihah 1-7');
  });

  test('Generated page index covers every page and every ayah exactly once', () => {
    const coordinates = new Set<string>();
    for (let page = 1; page <= 604; page++) {
      const segments = getPageAyahSegments(page);
      assert(segments.length > 0, 'Page ' + page + ' must have an ayah segment');
      for (const segment of segments) {
        for (let ayah = segment.startAyah; ayah <= segment.endAyah; ayah++) {
          const key = segment.surahNumber + ':' + ayah;
          assert(!coordinates.has(key), 'Ayah ' + key + ' must not be assigned to multiple pages');
          coordinates.add(key);
        }
      }
    }
    assert(coordinates.size === 6236, 'Page index must account for all 6,236 ayahs');
  });

  test('Untracked pages remain not_memorized; no sample progress is fabricated', () => {
    assert(getPageProgressStatus(562, []).status === 'not_memorized', 'An untracked page must not appear memorized');
    assert(getPageProgressStatus(1, []).status === 'not_memorized', 'Al-Fatihah must not be pre-marked as memorized');
  });

  test('Page-specific portions affect only their recorded page', () => {
    const portion = {
      id: 's67_a1_a10', type: 'page' as const, surahNumber: 67, surahName: 'الملك',
      startAyah: 1, endAyah: 10, pageNumber: 562, pageStart: 562, pageEnd: 562,
      status: 'recently_memorized' as const, nextDueDate: '2026-11-06', intervalDays: 2, easeFactor: 2.5, repetitionCount: 1
    } as PortionStatusRecord;
    assert(getPageProgressStatus(562, [portion]).status === 'recently_memorized', 'Recorded page must show its status');
    assert(getPageProgressStatus(563, [portion]).status === 'not_memorized', 'Adjacent page must remain unmemorized');
  });

  test('Overlapping page records choose the least secure status and retain all IDs', () => {
    const base = { surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5, pageNumber: 562, pageStart: 562, pageEnd: 562, nextDueDate: '2026-11-06', intervalDays: 1, easeFactor: 2.5, repetitionCount: 1 };
    const stable = { ...base, id: 'stable-page', status: 'stable' as const } as PortionStatusRecord;
    const weak = { ...base, id: 'weak-page', status: 'weak' as const } as PortionStatusRecord;
    const result = getPageProgressStatus(562, [stable, weak]);
    assert(result.status === 'weak', 'Weak status must override a stronger overlapping status');
    assert(result.portionIds.length === 2, 'All overlapping page portions must be returned for coordinated updates');
  });

  return { passed, failed };
}