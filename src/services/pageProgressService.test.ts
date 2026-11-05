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

  test('A partially tracked page is never reported as fully memorized', () => {
    const segment = getPageAyahSegments(1)[0];
    const partial = {
      id: 'partial-fatiha', type: 'passage' as const, surahNumber: 1, surahName: 'الفاتحة',
      startAyah: segment.startAyah, endAyah: segment.startAyah + 2, status: 'stable' as const,
      nextDueDate: '2026-11-06', intervalDays: 7, easeFactor: 2.5, repetitionCount: 3
    } as PortionStatusRecord;
    assert(getPageProgressStatus(1, [partial]).status === 'currently_memorizing', 'Partial coverage must remain visibly incomplete');
  });

  test('A weak tracked segment remains visibly weak when the rest of the page is untracked', () => {
    const segment = getPageAyahSegments(1)[0];
    const weakPartial = {
      id: 'weak-partial-page', type: 'passage' as const, surahNumber: segment.surahNumber,
      surahName: 'الفاتحة', startAyah: segment.startAyah, endAyah: segment.startAyah,
      status: 'weak' as const, nextDueDate: '2026-11-06', intervalDays: 1, easeFactor: 1.3, repetitionCount: 0
    } as PortionStatusRecord;
    const result = getPageProgressStatus(1, [weakPartial]);
    assert(result.status === 'weak', 'Partial coverage must not hide a weak tracked ayah');
    assert(!result.isFullyCovered, 'A weak partial page must not count as a fully memorized page');
  });

  test('Page-specific portions affect only their recorded page', () => {
    const segments = getPageAyahSegments(562);
    const portions = segments.map((segment, index) => ({
      id: 'page-562-' + index, type: 'page' as const, surahNumber: segment.surahNumber, surahName: 'صفحة 562',
      startAyah: segment.startAyah, endAyah: segment.endAyah, pageNumber: 562, pageStart: 562, pageEnd: 562,
      status: 'recently_memorized' as const, nextDueDate: '2026-11-06', intervalDays: 2, easeFactor: 2.5, repetitionCount: 1
    } as PortionStatusRecord));
    assert(getPageProgressStatus(562, portions).status === 'recently_memorized', 'A fully tracked page must show its status');
    assert(getPageProgressStatus(563, portions).status === 'not_memorized', 'Adjacent page must remain unmemorized');
  });

  test('A stable page record cannot hide a weaker overlapping passage record', () => {
    const segment = getPageAyahSegments(1)[0];
    const shared = {
      surahNumber: segment.surahNumber, surahName: 'الفاتحة',
      startAyah: segment.startAyah, endAyah: segment.endAyah,
      nextDueDate: '2026-11-06', intervalDays: 1, easeFactor: 2.5, repetitionCount: 1
    };
    const stablePage = { ...shared, id: 'stable-page', type: 'page' as const, pageNumber: 1, pageStart: 1, pageEnd: 1, status: 'stable' as const } as PortionStatusRecord;
    const weakPassage = { ...shared, id: 'weak-passage', type: 'passage' as const, status: 'weak' as const } as PortionStatusRecord;
    assert(getPageProgressStatus(1, [stablePage, weakPassage]).status === 'weak', 'The least secure overlapping record must determine page status');
    assert(!getPageProgressStatus(1, [stablePage]).isFullyCovered || getPageProgressStatus(1, [stablePage]).status === 'stable', 'Coverage state must remain explicit for page-level records');
  });

  test('Overlapping page records choose the least secure status and retain all IDs', () => {
    const segment = getPageAyahSegments(1)[0];
    const base = { surahNumber: segment.surahNumber, surahName: 'الفاتحة', startAyah: segment.startAyah, endAyah: segment.endAyah, pageNumber: 1, pageStart: 1, pageEnd: 1, type: 'page' as const, nextDueDate: '2026-11-06', intervalDays: 1, easeFactor: 2.5, repetitionCount: 1 };
    const stable = { ...base, id: 'stable-page', status: 'stable' as const } as PortionStatusRecord;
    const weak = { ...base, id: 'weak-page', status: 'weak' as const } as PortionStatusRecord;
    const result = getPageProgressStatus(1, [stable, weak]);
    assert(result.status === 'weak', 'Weak status must override a stronger overlapping status');
    assert(result.portionIds.length === 2, 'All overlapping page portions must be returned for coordinated updates');
  });

  return { passed, failed };
}