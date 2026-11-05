import { ALL_SURAHS } from '../data/quranMeta';
import { PortionStatusRecord, PortionMemorizationStatus, SurahMeta } from '../types/quran';

type PageAwarePortion = PortionStatusRecord & {
  pageStart?: number;
  pageEnd?: number;
  lastReviewedDate?: string;
};

export interface PageProgressStatus {
  status: PortionMemorizationStatus;
  surah: SurahMeta;
  portionId?: string;
}

const CONSERVATIVE_STATUS_PRIORITY: Record<PortionMemorizationStatus, number> = {
  not_memorized: 0,
  stable: 1,
  recently_memorized: 2,
  currently_memorizing: 3,
  needs_revision: 4,
  weak: 5
};

export function getPageProgressStatus(
  pageNumber: number,
  portions: PageAwarePortion[]
): PageProgressStatus {
  const surah = ALL_SURAHS.find(item => pageNumber >= item.pageStart && pageNumber <= item.pageEnd) || ALL_SURAHS[0];

  const matching = portions.filter(portion => {
    const startPage = portion.pageStart ?? portion.pageNumber ?? portion.pageEnd;
    const endPage = portion.pageEnd ?? portion.pageNumber ?? portion.pageStart;
    if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) return false;
    return pageNumber >= Math.min(startPage as number, endPage as number) && pageNumber <= Math.max(startPage as number, endPage as number);
  });

  if (matching.length === 0) return { status: 'not_memorized', surah };

  // When portions overlap a page, show the least secure status rather than overstating mastery.
  const selected = matching.reduce((worst, current) =>
    CONSERVATIVE_STATUS_PRIORITY[current.status] > CONSERVATIVE_STATUS_PRIORITY[worst.status] ? current : worst
  );

  return { status: selected.status, surah, portionId: selected.id };
}