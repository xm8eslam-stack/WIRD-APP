export const MUSHAF_PAGE_ARTWORK_RELEASE = 'v1.1.1';
export const MUSHAF_PAGE_ARTWORK_BASE_URL = `https://cdn.quran.ws/svg/pages/${MUSHAF_PAGE_ARTWORK_RELEASE}/hafs-kfqc`;

export interface MushafAyahCoordinate {
  surahNumber: number;
  numberInSurah: number;
}

export interface MushafAyahPolygon {
  surahNumber: number;
  ayahNumber: number;
  path: string;
}

export interface MushafViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getMushafPageArtworkUrl(page: number): string {
  if (!Number.isInteger(page) || page < 1 || page > 604) {
    throw new RangeError('Mushaf page must be an integer from 1 to 604.');
  }
  return `${MUSHAF_PAGE_ARTWORK_BASE_URL}/${String(page).padStart(3, '0')}.svg`;
}

export function parseMushafViewBox(value: string | null): MushafViewBox {
  if (!value) throw new Error('Printed Mushaf page is missing its viewBox.');
  const values = value.trim().split(/[ ,]+/).map(Number);
  if (values.length !== 4 || values.some(number => !Number.isFinite(number)) ||
      values[2] <= 0 || values[3] <= 0) {
    throw new Error('Printed Mushaf page has an invalid viewBox.');
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

/**
 * Treat the page geometry as a visual layer only. Every displayed ayah must
 * resolve to exactly one coordinate already present in WIRD's local corpus.
 */
export function assertMushafPageAyahCoverage(
  expectedAyahs: readonly MushafAyahCoordinate[],
  polygons: readonly MushafAyahPolygon[]
): void {
  if (!expectedAyahs.length || !polygons.length) {
    throw new Error('Printed page is missing expected local ayahs or ayah hit regions.');
  }

  const expected = new Set<string>();
  for (const ayah of expectedAyahs) {
    if (!Number.isInteger(ayah.surahNumber) || ayah.surahNumber < 1 || ayah.surahNumber > 114 ||
        !Number.isInteger(ayah.numberInSurah) || ayah.numberInSurah < 1) {
      throw new Error('WIRD local Quran coordinates are invalid for this printed page.');
    }
    const key = `${ayah.surahNumber}:${ayah.numberInSurah}`;
    if (expected.has(key)) throw new Error('WIRD local Quran coordinates contain a duplicate ayah.');
    expected.add(key);
  }

  const actual = new Set<string>();
  for (const polygon of polygons) {
    if (!Number.isInteger(polygon.surahNumber) || polygon.surahNumber < 1 || polygon.surahNumber > 114 ||
        !Number.isInteger(polygon.ayahNumber) || polygon.ayahNumber < 1 ||
        typeof polygon.path !== 'string' || !polygon.path.trim() ||
        polygon.path.length > 120_000 ||
        !/^[MmLlHhVvCcSsQqTtAaZz0-9., +eE-]+$.test(polygon.path)) {
      throw new Error('Printed Mushaf page contains an invalid ayah hit region.');
    }
    const key = `${polygon.surahNumber}:${polygon.ayahNumber}`;
    if (actual.has(key)) throw new Error('Printed Mushaf page contains a duplicate ayah hit region.');
    actual.add(key);
  }

  if (actual.size !== expected.size || [...expected].some(key => !actual.has(key))) {
    throw new Error('Printed Mushaf page ayah coordinates do not match WIRD local Quran data; the flexible text view remains available.');
  }
}
