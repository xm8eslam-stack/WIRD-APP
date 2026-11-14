import { ALL_SURAHS } from '../data/quranMeta';
import { QURAN_JUZ_STARTS } from '../data/quranNavigationIndex.generated';
import { QuranMath } from './quranMath';

export interface MemorizedRange {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

type JuzStart = { surahNumber: number; ayahNumber: number };

const LAST_QURAN_COORDINATE = { surahNumber: 114, ayahNumber: 6 } as const;

/** Return a complete Surah as one validated memorized range. */
export function getFullSurahMemorizedRange(surahNumber: number): MemorizedRange {
  const surah = QuranMath.getSurah(surahNumber);
  if (!surah) throw new RangeError('رقم السورة غير صالح.');
  return { surahNumber, startAyah: 1, endAyah: surah.versesCount };
}

/**
 * Expand a complete Juz into per-Surah ranges because Engine Plans model each
 * revision unit as one Surah interval. Boundaries come from the generated
 * canonical Quran dataset, not the approximate juzStart/juzEnd metadata.
 */
export function getJuzMemorizedRanges(juzNumber: number): MemorizedRange[] {
  if (!Number.isSafeInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
    throw new RangeError('رقم الجزء يجب أن يكون بين 1 و30.');
  }

  const starts = QURAN_JUZ_STARTS as unknown as Record<number, JuzStart>;
  const start = starts[juzNumber];
  const next = juzNumber < 30 ? starts[juzNumber + 1] : LAST_QURAN_COORDINATE;
  if (!start || !next || !QuranMath.isValidCoordinate(start.surahNumber, start.ayahNumber) ||
      !QuranMath.isValidCoordinate(next.surahNumber, next.ayahNumber)) {
    throw new Error('تعذر قراءة حدود الجزء من فهرس القرآن المعتمد.');
  }

  const firstAbsolute = QuranMath.getAbsoluteAyahIndex(start.surahNumber, start.ayahNumber);
  const nextAbsolute = QuranMath.getAbsoluteAyahIndex(next.surahNumber, next.ayahNumber);
  if (firstAbsolute <= 0 || nextAbsolute <= firstAbsolute) {
    throw new Error('حدود الجزء غير متسقة؛ لم تتم إضافة أي نطاق.');
  }

  const end = juzNumber === 30
    ? LAST_QURAN_COORDINATE
    : QuranMath.getCoordinateFromAbsoluteIndex(nextAbsolute - 1);
  const ranges: MemorizedRange[] = [];
  for (let surahNumber = start.surahNumber; surahNumber <= end.surahNumber; surahNumber++) {
    const surah = QuranMath.getSurah(surahNumber);
    if (!surah) throw new Error('تعذر التحقق من سورة ضمن حدود الجزء.');
    ranges.push({
      surahNumber,
      startAyah: surahNumber === start.surahNumber ? start.ayahNumber : 1,
      endAyah: surahNumber === end.surahNumber ? end.ayahNumber : surah.versesCount
    });
  }
  return normalizeMemorizedRanges(ranges);
}

/** Validate, sort and merge overlapping/adjacent intervals within each Surah. */
export function normalizeMemorizedRanges(ranges: readonly MemorizedRange[]): MemorizedRange[] {
  const sorted = ranges.map(range => {
    if (!range || !QuranMath.isValidCoordinate(range.surahNumber, range.startAyah) ||
        !QuranMath.isValidCoordinate(range.surahNumber, range.endAyah) ||
        range.startAyah > range.endAyah) {
      throw new RangeError('نطاق محفوظ غير صالح؛ تحقق من السورة ورقمَي الآيتين.');
    }
    return { ...range };
  }).sort((a, b) =>
    a.surahNumber - b.surahNumber || a.startAyah - b.startAyah || a.endAyah - b.endAyah
  );

  const normalized: MemorizedRange[] = [];
  for (const range of sorted) {
    const previous = normalized[normalized.length - 1];
    if (previous && previous.surahNumber === range.surahNumber &&
        range.startAyah <= previous.endAyah + 1) {
      previous.endAyah = Math.max(previous.endAyah, range.endAyah);
    } else {
      normalized.push(range);
    }
  }
  return normalized;
}
