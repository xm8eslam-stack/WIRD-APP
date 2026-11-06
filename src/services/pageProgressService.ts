import { ALL_SURAHS } from '../data/quranMeta';
import { QURAN_PAGE_INDEX } from '../data/quranPageIndex.generated';
import { PortionStatusRecord, PortionMemorizationStatus, SurahMeta } from '../types/quran';
import { createCanonicalPortionId } from './unifiedPortionService';

export interface PageAyahSegment {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

export interface PageProgressStatus {
  status: PortionMemorizationStatus;
  isFullyCovered: boolean;
  surah: SurahMeta;
  surahs: SurahMeta[];
  portionId?: string;
  portionIds: string[];
}

const CONSERVATIVE_STATUS_PRIORITY: Record<PortionMemorizationStatus, number> = {
  not_memorized: 0, stable: 1, recently_memorized: 2,
  currently_memorizing: 3, needs_revision: 4, weak: 5
};

export function getPageAyahSegments(pageNumber: number): PageAyahSegment[] {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) return [];
  const index = QURAN_PAGE_INDEX as unknown as Record<number, PageAyahSegment[]>;
  return (index[pageNumber] || []).map(segment => ({ ...segment }));
}

/**
 * Return the canonical Mushaf pages touched by a Surah ayah range.
 * A range can cross page boundaries; every intersecting page is counted once.
 */
export function getPagesForAyahRange(surahNumber: number, startAyah: number, endAyah: number): number[] {
  if (
    !Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 ||
    !Number.isInteger(startAyah) || !Number.isInteger(endAyah) ||
    startAyah < 1 || endAyah < startAyah
  ) return [];

  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  if (!surah || endAyah > surah.versesCount) return [];

  const index = QURAN_PAGE_INDEX as unknown as Record<number, PageAyahSegment[]>;
  const pages: number[] = [];
  for (let pageNumber = 1; pageNumber <= 604; pageNumber++) {
    const intersects = (index[pageNumber] || []).some(segment =>
      segment.surahNumber === surahNumber &&
      segment.startAyah <= endAyah &&
      segment.endAyah >= startAyah
    );
    if (intersects) pages.push(pageNumber);
  }
  return pages;
}

/**
 * Build a complete page-status update in memory so the caller can persist it
 * with one canonical storage write. This avoids partial page updates when a
 * page spans multiple Surah segments or storage quota is exhausted mid-loop.
 */
export function buildPageStatusUpdate(
  portions: PortionStatusRecord[],
  pageNumber: number,
  status: PortionMemorizationStatus,
  todayStr: string
): PortionStatusRecord[] | null {
  const segments = getPageAyahSegments(pageNumber);
  if (segments.length === 0) return null;

  const updated = [...portions];
  const timestamp = new Date().toISOString();

  for (const segment of segments) {
    const surah = ALL_SURAHS.find(item => item.number === segment.surahNumber);
    if (!surah) return null;

    const canonicalId = createCanonicalPortionId(
      segment.surahNumber,
      segment.startAyah,
      segment.endAyah
    );
    const existingIndex = updated.findIndex(portion =>
      portion.id === canonicalId ||
      (portion.surahNumber === segment.surahNumber &&
        portion.startAyah === segment.startAyah &&
        portion.endAyah === segment.endAyah)
    );
    const existing = existingIndex >= 0 ? updated[existingIndex] : undefined;

    const record: PortionStatusRecord = {
      ...(existing || {}),
      id: canonicalId,
      type: existing?.type || 'page',
      surahNumber: segment.surahNumber,
      surahName: surah.name,
      startAyah: segment.startAyah,
      endAyah: segment.endAyah,
      pageNumber,
      pageStart: pageNumber,
      pageEnd: pageNumber,
      status,
      lastReviewedDate: todayStr,
      nextDueDate: todayStr,
      intervalDays: status === 'stable' ? 7 : 1,
      easeFactor: existing?.easeFactor || 2.5,
      repetitionCount: status === 'stable' ? 3 : 1,
      mistakesCount: existing?.mistakesCount ?? 0,
      history: existing?.history || [],
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp
    };

    if (existingIndex >= 0) updated[existingIndex] = record;
    else updated.unshift(record);
  }

  return updated;
}

export function getPageProgressStatus(pageNumber: number, portions: PortionStatusRecord[]): PageProgressStatus {
  const segments = getPageAyahSegments(pageNumber);
  const surahNumbers = Array.from(new Set(segments.map(segment => segment.surahNumber)));
  const surahs = surahNumbers.map(number => ALL_SURAHS.find(item => item.number === number)).filter((item): item is SurahMeta => Boolean(item));
  const surah = surahs[0] || ALL_SURAHS[0];
  if (segments.length === 0) return { status: 'not_memorized', isFullyCovered: false, surah, surahs: [], portionIds: [] };

  const bySurah = new Map<number, PortionStatusRecord[]>();
  portions.forEach(portion => {
    const group = bySurah.get(portion.surahNumber) || [];
    group.push(portion);
    bySurah.set(portion.surahNumber, group);
  });

  const exactPagePortions = portions.filter(portion =>
    portion.type === 'page' && portion.pageStart === pageNumber && portion.pageEnd === pageNumber
  );
  let anyCovered = false;
  let fullyCovered = true;
  let worstStatus: PortionMemorizationStatus = 'not_memorized';

  for (const segment of segments) {
    const allForSurah = bySurah.get(segment.surahNumber) || [];
    for (let ayahNumber = segment.startAyah; ayahNumber <= segment.endAyah; ayahNumber++) {
      // A page-level record must never hide a weaker passage-level record for the same ayah.
      const matches = allForSurah.filter(portion => portion.startAyah <= ayahNumber && portion.endAyah >= ayahNumber);
      if (matches.length === 0) {
        fullyCovered = false;
        continue;
      }
      anyCovered = true;
      for (const match of matches) {
        if (CONSERVATIVE_STATUS_PRIORITY[match.status] > CONSERVATIVE_STATUS_PRIORITY[worstStatus]) {
          worstStatus = match.status;
        }
      }
    }
  }

  const status: PortionMemorizationStatus = !anyCovered
    ? 'not_memorized'
    : !fullyCovered
      ? (worstStatus === 'weak' || worstStatus === 'needs_revision' ? worstStatus : 'currently_memorizing')
      : worstStatus;

  return {
    status,
    isFullyCovered: anyCovered && fullyCovered,
    surah,
    surahs,
    portionId: exactPagePortions[0]?.id,
    portionIds: exactPagePortions.map(portion => portion.id)
  };
}