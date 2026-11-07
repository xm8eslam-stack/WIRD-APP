import { VERIFIED_AYAHS } from '../data/verifiedAyahs';
import type { Ayah } from '../types/quran';
import type { RuqyahItem } from '../data/ruqyahData';

export interface RuqyahVerseRange {
  start: number;
  end: number;
}

export interface RuqyahAudioAyah {
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
}

export function parseRuqyahVerseRange(value: string): RuqyahVerseRange {
  if (typeof value !== 'string') throw new Error('نطاق آيات الرقية غير صالح.');
  const match = value.trim().match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/);
  if (!match) throw new Error('نطاق آيات الرقية غير صالح.');
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    throw new Error('نطاق آيات الرقية خارج الحدود الصحيحة.');
  }
  return { start, end };
}

export function getRuqyahAyahs(item: RuqyahItem): Ayah[] {
  if (item.type !== 'quran' || !Number.isInteger(item.surahNumber) ||
      !item.surahNumber || item.surahNumber < 1 || item.surahNumber > 114 || !item.verseRange) {
    throw new Error('بيانات موضع الآيات في عنصر الرقية غير مكتملة.');
  }
  const range = parseRuqyahVerseRange(item.verseRange);
  const surah = VERIFIED_AYAHS[item.surahNumber];
  if (!surah || range.end > surah.length) {
    throw new Error('نطاق الآيات ' + item.surahNumber + ':' + item.verseRange + ' غير موجود في المصحف المعتمد.');
  }
  const ayahs = surah.slice(range.start - 1, range.end);
  if (ayahs.length !== range.end - range.start + 1 ||
      ayahs.some((ayah, index) => ayah.numberInSurah !== range.start + index ||
        typeof ayah.text !== 'string' || !ayah.text.trim())) {
    throw new Error('تعذر التحقق من اكتمال نص آيات الرقية في المصحف المعتمد.');
  }
  return ayahs;
}

export function getRuqyahDisplayText(item: RuqyahItem): string {
  if (item.type !== 'quran') return item.text;
  return getRuqyahAyahs(item).map(ayah => ayah.text).join(' ۞ ');
}

export function getRuqyahAudioQueue(item: RuqyahItem): RuqyahAudioAyah[] {
  const surahNumber = item.surahNumber;
  if (!surahNumber) throw new Error('رقم السورة غير صالح لتجهيز التلاوة.');
  return getRuqyahAyahs(item).map(ayah => ({
    surahNumber,
    ayahNumber: ayah.numberInSurah,
    globalAyahNumber: ayah.number
  }));
}
