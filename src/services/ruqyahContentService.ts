import type { Ayah } from '../types/quran';
import type { RuqyahItem } from '../data/ruqyahData';
import { loadSurahVerses } from '../data/quranDataLoader';

export interface RuqyahVerseRange {
  start: number;
  end: number;
}

export interface RuqyahAudioAyah {
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
}

const SURAH_VERSE_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,
  89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,
  30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,
  15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
] as const;

const SURAH_GLOBAL_STARTS: readonly number[] = SURAH_VERSE_COUNTS.reduce<number[]>(
  (starts, count, index) => {
    starts[index] = (starts[index - 1] ?? 0) + (index === 0 ? 1 : SURAH_VERSE_COUNTS[index - 1]);
    return starts;
  },
  []
);

export function parseRuqyahVerseRange(value: string): RuqyahVerseRange {
  if (typeof value !== 'string') throw new Error('نطاق آيات الرقية غير صالح.');
  const match = value.trim().match(/^(\\d+)\\s*(?:[-–—]\\s*(\\d+))?$/);
  if (!match) throw new Error('نطاق آيات الرقية غير صالح.');
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    throw new Error('نطاق آيات الرقية خارج الحدود الصحيحة.');
  }
  return { start, end };
}

function validateQuranItem(item: RuqyahItem): { surahNumber: number; range: RuqyahVerseRange } {
  const surahNumber = item.surahNumber;
  if (item.type !== 'quran' || !Number.isInteger(surahNumber) ||
      surahNumber === undefined || surahNumber < 1 || surahNumber > 114 || !item.verseRange) {
    throw new Error('بيانات موضع الآيات في عنصر الرقية غير مكتملة.');
  }
  const range = parseRuqyahVerseRange(item.verseRange);
  const expectedCount = SURAH_VERSE_COUNTS[surahNumber - 1];
  if (!expectedCount || range.end > expectedCount) {
    throw new Error('نطاق الآيات ' + surahNumber + ':' + item.verseRange + ' خارج حدود السورة في المصحف المعتمد.');
  }
  return { surahNumber, range };
}

export async function loadRuqyahSurah(surahNumber: number): Promise<Ayah[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new Error('رقم السورة غير صالح لتحميل المصحف المعتمد.');
  }
  const verses = await loadSurahVerses(surahNumber);
  const expectedCount = SURAH_VERSE_COUNTS[surahNumber - 1];
  if (!Array.isArray(verses) || verses.length !== expectedCount) {
    throw new Error('بيانات سورة ' + surahNumber + ' ناقصة أو غير مكتملة في المصحف المحلي المعتمد.');
  }
  const globalStart = SURAH_GLOBAL_STARTS[surahNumber - 1];
  for (let index = 0; index < verses.length; index++) {
    const ayah = verses[index];
    if (!ayah || ayah.surahNumber !== surahNumber ||
        ayah.numberInSurah !== index + 1 ||
        ayah.number !== globalStart + index ||
        typeof ayah.text !== 'string' || !ayah.text.trim()) {
      throw new Error('تعذر التحقق من سلامة تسلسل آيات سورة ' + surahNumber + ' في المصحف المحلي المعتمد.');
    }
  }
  return verses;
}

export async function getRuqyahAyahs(item: RuqyahItem): Promise<Ayah[]> {
  const { surahNumber, range } = validateQuranItem(item);
  const surah = await loadRuqyahSurah(surahNumber);
  const ayahs = surah.slice(range.start - 1, range.end);
  if (ayahs.length !== range.end - range.start + 1 ||
      ayahs.some((ayah, index) => ayah.numberInSurah !== range.start + index)) {
    throw new Error('تعذر التحقق من اكتمال نص آيات الرقية في المصحف المعتمد.');
  }
  return ayahs;
}

/** Non-Quran material remains synchronous; Quran text always resolves from verified local Surah chunks. */
export function getRuqyahDisplayText(item: RuqyahItem): string | Promise<string> {
  if (item.type !== 'quran') return item.text;
  return getRuqyahAyahs(item).then(ayahs => ayahs.map(ayah => ayah.text).join(' ۞ '));
}

export async function getRuqyahAudioQueue(item: RuqyahItem): Promise<RuqyahAudioAyah[]> {
  const ayahs = await getRuqyahAyahs(item);
  const surahNumber = item.surahNumber!;
  return ayahs.map(ayah => ({
    surahNumber,
    ayahNumber: ayah.numberInSurah,
    globalAyahNumber: ayah.number
  }));
}
