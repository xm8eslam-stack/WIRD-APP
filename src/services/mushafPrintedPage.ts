export const MUSHAF_PAGE_ARTWORK_RELEASE = 'v1.1.1';
export const MUSHAF_PAGE_ARTWORK_BASE_URL = `https://cdn.quran.ws/svg/pages/${MUSHAF_PAGE_ARTWORK_RELEASE}/hafs-kfqc`;
export const MUSHAF_PAGE_MANIFEST_URL = `https://cdn.quran.ws/svg/pages/${MUSHAF_PAGE_ARTWORK_RELEASE}/manifest.json`;

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

export interface MushafManifestFile {
  sha256: string;
  size: number;
}

export function getMushafManifestFileEntry(manifest: unknown, relativePath: string): MushafManifestFile {
  if (!manifest || typeof manifest !== 'object') throw new Error('بيان سلامة ملفات المصحف غير صالح.');
  const sourceFiles = (manifest as { files?: unknown }).files;
  let files: unknown[] = [];
  if (Array.isArray(sourceFiles)) files = sourceFiles;
  else if (sourceFiles && typeof sourceFiles === 'object') {
    files = Object.entries(sourceFiles as Record<string, unknown>).map(([path, entry]) => ({ path, ...(entry as object) }));
  }
  const entry = files.find(item => {
    if (!item || typeof item !== 'object') return false;
    const path = String((item as { path?: unknown; file?: unknown; name?: unknown }).path ??
      (item as { file?: unknown }).file ?? (item as { name?: unknown }).name ?? '');
    return path === relativePath || path.endsWith(`/${relativePath}`);
  }) as { sha256?: unknown; digest?: unknown; size?: unknown } | undefined;
  if (!entry) throw new Error('لم نجد بصمة الصفحة المطبوعة في بيان الإصدار المثبّت.');
  const digest = String(entry.sha256 ?? entry.digest ?? '').replace('sha256:', '').toLowerCase();
  const isHex = [...digest].every(character => '0123456789abcdef'.includes(character));
  const size = Number(entry.size);
  if (digest.length !== 64 || !isHex || !Number.isInteger(size) || size < 1 || size > 5 * 1024 * 1024) {
    throw new Error('بيان سلامة الصفحة المطبوعة لا يحتوي على حجم أو بصمة SHA-256 صالحة.');
  }
  return { sha256: digest, size };
}

export function parseMushafViewBox(value: string | null): MushafViewBox {
  if (!value) throw new Error('Printed Mushaf page is missing its viewBox.');
  const whitespace = [String.fromCharCode(9), String.fromCharCode(10), String.fromCharCode(13)];
  const normalized = whitespace.reduce((text, character) => text.replaceAll(character, ' '), value.trim()).replaceAll(',', ' ');
  const values = normalized.split(' ').filter(Boolean).map(Number);
  if (values.length !== 4 || values.some(number => !Number.isFinite(number)) ||
      values[2] <= 0 || values[3] <= 0) {
    throw new Error('Printed Mushaf page has an invalid viewBox.');
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

const SAFE_SVG_PATH_CHARACTERS = new Set('MmLlHhVvCcSsQqTtAaZz0123456789., +-eE');

function isSafeSvgPath(path: string): boolean {
  return [...path].every(character => SAFE_SVG_PATH_CHARACTERS.has(character) || [9, 10, 13].includes(character.charCodeAt(0)));
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
    throw new Error('صفحة المصحف لا تحتوي على كل الآيات أو مناطق تحديدها المطلوبة.');
  }

  const expected = new Set<string>();
  for (const ayah of expectedAyahs) {
    if (!Number.isInteger(ayah.surahNumber) || ayah.surahNumber < 1 || ayah.surahNumber > 114 ||
        !Number.isInteger(ayah.numberInSurah) || ayah.numberInSurah < 1) {
      throw new Error('إحداثيات الآيات المحلية في وِرد غير صالحة لهذه الصفحة.');
    }
    const key = `${ayah.surahNumber}:${ayah.numberInSurah}`;
    if (expected.has(key)) throw new Error('بيانات وِرد المحلية تحتوي على إحداثيات آية مكررة.');
    expected.add(key);
  }

  const actual = new Set<string>();
  for (const polygon of polygons) {
    if (!Number.isInteger(polygon.surahNumber) || polygon.surahNumber < 1 || polygon.surahNumber > 114 ||
        !Number.isInteger(polygon.ayahNumber) || polygon.ayahNumber < 1 ||
        typeof polygon.path !== 'string' || !polygon.path.trim() ||
        polygon.path.length > 120_000 ||
        !isSafeSvgPath(polygon.path)) {
      throw new Error('ملف المصحف المطبوع يحتوي على منطقة تحديد آية غير صالحة.');
    }
    const key = `${polygon.surahNumber}:${polygon.ayahNumber}`;
    if (actual.has(key)) throw new Error('ملف المصحف المطبوع يحتوي على منطقة تحديد مكررة.');
    actual.add(key);
  }

  if (actual.size !== expected.size || [...expected].some(key => !actual.has(key))) {
    throw new Error('مواضع الآيات في الصفحة المطبوعة لا تطابق إحداثيات وِرد المحلية؛ لم نعرض الصفحة.');
  }
}
