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

export function getPageProgressStatus(pageNumber: number, portions: PortionStatusRecord[]): PageProgressStatus {
  const segments = getPageAyahSegments(pageNumber);
  const surahNumbers = Array.from(new Set(segments.map(segment => segment.surahNumber)));
  const surahs = surahNumbers.map(number => ALL_SURAHS.find(item => item.number === number)).filter((item): item is SurahMeta => Boolean(item));
  const surah = surahs[0] || ALL_SURAHS[0];
  if (segments.length === 0) return { status: 'not_memorized', surah, surahs: [], portionIds: [] };

  const bySurah = new Map<number, PortionStatusRecord[]>();
  portions.forEach(portion => {
    const group = bySurah.get(portion.surahNumber) || [];
    group.push(portion);
    bySurah.set(portion.surahNumber, group);
  });

  const exactPagePortions = portions.filter(portion =>
    portion.type === 'page' && portion.pageStart === pageNumber && portion.pageEnd === pageNumber
  );
  const exactPageBySurah = new Map<number, PortionStatusRecord[]>();
  exactPagePortions.forEach(portion => {
    const group = exactPageBySurah.get(portion.surahNumber) || [];
    group.push(portion);
    exactPageBySurah.set(portion.surahNumber, group);
  });

  let anyCovered = false;
  let fullyCovered = true;
  let worstStatus: PortionMemorizationStatus = 'not_memorized';

  for (const segment of segments) {
    const exactForSurah = exactPageBySurah.get(segment.surahNumber) || [];
    const allForSurah = bySurah.get(segment.surahNumber) || [];
    for (let ayahNumber = segment.startAyah; ayahNumber <= segment.endAyah; ayahNumber++) {
      const exactMatches = exactForSurah.filter(portion => portion.startAyah <= ayahNumber && portion.endAyah >= ayahNumber);
      const matches = exactMatches.length > 0
        ? exactMatches
        : allForSurah.filter(portion => portion.startAyah <= ayahNumber && portion.endAyah >= ayahNumber);
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
      ? 'currently_memorizing'
      : worstStatus;

  return {
    status,
    surah,
    surahs,
    portionId: exactPagePortions[0]?.id,
    portionIds: exactPagePortions.map(portion => portion.id)
  };
}