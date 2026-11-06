export interface QuranPageSegment {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

/**
 * Resolves the Mushaf page that actually contains the first ayah of a Surah.
 * The generated page index is the source of truth; Surah metadata is only display data.
 */
export function findSurahStartPage(
  surahNumber: number,
  pageIndex: Record<string, readonly QuranPageSegment[]>
): number | null {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return null;

  const pages = Object.keys(pageIndex)
    .map(Number)
    .filter(page => Number.isInteger(page) && page >= 1 && page <= 604)
    .sort((a, b) => a - b);

  for (const page of pages) {
    const segments = pageIndex[String(page)];
    if (segments.some(segment => segment.surahNumber === surahNumber && segment.startAyah === 1)) {
      return page;
    }
  }

  return null;
}
