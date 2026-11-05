import { ALL_SURAHS } from '../data/quranMeta';
import { QURAN_PAGE_INDEX } from '../data/quranPageIndex.generated';
import { PortionStatusRecord, PortionMemorizationStatus, SurahMeta } from '../types/quran';

export interface PageAyahSegment {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

export interface PageProgressStatus {
  status: PortionMemorizationStatus;
  surah: SurahMeta;
  portionId?: string;
  portionIds: string[];
}

const CONSERVATIVE_STATUS_PRIORITY: Record<PortionMemorizationStatus, number> = {
  not_memorized: 0,
  stable: 1,
  recently_memorized: 2,
  currently_memorizing: 3,
  needs_revision: 4,
  weak: 5
};

export function getPageAyahSegments(pageNumber: number): PageAyahSegment[] {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) return [];
  const index = QURAN_PAGE_INDEX as unknown as Record<number, PageAyahSegment[]>;
  return (index[pageNumber] || []).map(segment => ({ ...segment }));
}

export function getPageProgressStatus(pageNumber: number, portions: PortionStatusRecord[]): PageProgressStatus {
  const surah = ALL_SURAHS.find(item => pageNumber >= item.pageStart && pageNumber <= item.pageEnd) || ALL_SURAHS[0];
  const matching = portions.filter(portion => {
    const startPage = portion.pageStart ?? portion.pageNumber;
    const endPage = portion.pageEnd ?? portion.pageNumber ?? startPage;
    if (typeof startPage !== 'number' || typeof endPage !== 'number') return false;
    return pageNumber >= Math.min(startPage, endPage) && pageNumber <= Math.max(startPage, endPage);
  });

  if (matching.length === 0) return { status: 'not_memorized', surah, portionIds: [] };

  // When portions overlap a page, show the least secure status rather than overstating mastery.
  const selected = matching.reduce((worst, current) =>
    CONSERVATIVE_STATUS_PRIORITY[current.status] > CONSERVATIVE_STATUS_PRIORITY[worst.status] ? current : worst
  );

  return { status: selected.status, surah, portionId: selected.id, portionIds: matching.map(portion => portion.id) };
}