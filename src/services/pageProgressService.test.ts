import { buildPageStatusUpdate, getPageAyahSegments, getPageProgressStatus, getPagesForAyahRange } from './pageProgressService';
import { PortionStatusRecord } from '../types/quran';

export function runPageProgressServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Page status update is prepared as one exact canonical record and preserves history', () => {
    const segment = getPageAyahSegments(1)[0];
    const existing = {
      id: 'legacy-page-one', type: 'passage' as const,
      surahNumber: segment.surahNumber, surahName: 'الفاتحة',
      startAyah: segment.startAyah, endAyah: segment.endAyah,
      status: 'weak' as const, nextDueDate: '2026-11-05',
      intervalDays: 1, easeFactor: 2.1, repetitionCount: 2,
      history: [{ id: 'review-event-1', date: '2026-11-05', rating: 'failed' as const, intervalDaysBefore: 2, intervalDaysAfter: 1 }]
    } as PortionStatusRecord;
    const updated = buildPageStatusUpdate([existing], 1, 'stable', '2026-11-06');
    assert(updated?.length === 1, 'An exact existing segment must be updated, not duplicated');
    assert(updated?.[0].id === 's1_a1_a7' && updated[0].status === 'stable', 'The updated segment must use its canonical identity and selected status');
    assert(updated?.[0].history?.[0]?.id === 'review-event-1', 'Existing revision history must be preserved');
    assert(updated?.[0].mistakesCount === 0, 'Existing mistake count must remain unchanged');
  });

  test('Multi-Surah Mushaf pages produce all segment updates in one prepared result', () => {
    let multiSegmentPage = 0;
    for (let page = 1; page <= 604; page++) {
      if (getPageAyahSegments(page).length > 1) {
        multiSegmentPage = page;
        break;
      }
    }
    assert(multiSegmentPage > 0, 'The canonical Mushaf index must include a page crossing Surah boundaries');
    const segments = getPageAyahSegments(multiSegmentPage);
    const updated = buildPageStatusUpdate([], multiSegmentPage, 'weak', '2026-11-06');
    assert(updated?.length === segments.length, 'Every segment on a multi-Surah page must be represented');
    assert(updated?.every(portion => portion.status === 'weak'), 'All page segments must receive the same requested status');
  });

  test('Invalid page status updates are rejected without producing a partial list', () => {
    assert(buildPageStatusUpdate([], 0, 'stable', '2026-11-06') === null, 'Invalid page must return null');
    assert(buildPageStatusUpdate([], 605, 'stable', '2026-11-06') === null, 'Page beyond the Mushaf must return null');
  });

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
    assert(getPageProgressStatus(1, [stablePage]).isFullyCovered, 'A full page-level record must report complete coverage');
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

  test('Ayah ranges resolve to exact canonical pages, including cross-page ranges', () => {
    assert(JSON.stringify(getPagesForAyahRange(1, 1, 7)) === '[1]', 'Al-Fatihah 1-7 must map to page 1');
    const pages = getPagesForAyahRange(2, 1, 25);
    assert(pages.length > 1, 'A range spanning multiple Mushaf pages must return every intersecting page');
    assert(new Set(pages).size === pages.length, 'A range must not return duplicate pages');
    assert(pages.every((page, index) => index === 0 || pages[index - 1] < page), 'Pages must be sorted');
    for (const page of pages) {
      assert(getPageAyahSegments(page).some(segment =>
        segment.surahNumber === 2 && segment.startAyah <= 25 && segment.endAyah >= 1
      ), 'Every returned page must intersect the requested range');
    }
  });

  test('Invalid Surah and ayah ranges return no pages', () => {
    assert(getPagesForAyahRange(0, 1, 7).length === 0, 'Invalid Surah must be rejected');
    assert(getPagesForAyahRange(1, 0, 7).length === 0, 'Ayah zero must be rejected');
    assert(getPagesForAyahRange(1, 7, 1).length === 0, 'Reversed ranges must be rejected');
    assert(getPagesForAyahRange(1, 1, 8).length === 0, 'Ayah beyond the Surah boundary must be rejected');
  });

  return { passed, failed };
}