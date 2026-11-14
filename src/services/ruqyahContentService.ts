import type { Ayah } from '../types/quran';
import type { RuqyahItem } from '../data/ruqyahData';
import { loadSurahVerses } from '../data/quranDataLoader';
import { ALL_SURAHS } from '../data/quranMeta';

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

export function validateRuqyahSurahChunk(surahNumber: number, verses: Ayah[]): void {
  const metadata = ALL_SURAHS[surahNumber - 1];
  if (!metadata || metadata.number !== surahNumber || !Array.isArray(verses) ||
      verses.length !== metadata.versesCount) {
    throw new Error('بيانات سورة ' + surahNumber + ' ناقصة أو غير مكتملة في المصحف المحلي المعتمد.');
  }
  const globalStart = ALL_SURAHS.slice(0, surahNumber - 1)
    .reduce((total, surah) => total + surah.versesCount, 1);
  for (let index = 0; index < verses.length; index++) {
    const ayah = verses[index];
    if (!ayah || ayah.surahNumber !== surahNumber ||
        ayah.numberInSurah !== index + 1 ||
        ayah.number !== globalStart + index ||
        typeof ayah.text !== 'string' || !ayah.text.trim()) {
      throw new Error('تعذر التحقق من سلامة تسلسل آيات سورة ' + surahNumber + ' في المصحف المحلي المعتمد.');
    }
  }
}

function validateQuranItem(item: RuqyahItem): { surahNumber: number; range: RuqyahVerseRange } {
  const surahNumber = item.surahNumber;
  if (item.type !== 'quran' || !Number.isInteger(surahNumber) ||
      surahNumber === undefined || surahNumber < 1 || surahNumber > 114 || !item.verseRange) {
    throw new Error('بيانات موضع الآيات في عنصر الرقية غير مكتملة.');
  }
  const range = parseRuqyahVerseRange(item.verseRange);
  const metadata = ALL_SURAHS[surahNumber - 1];
  if (!metadata || range.end > metadata.versesCount) {
    throw new Error('نطاق الآيات ' + surahNumber + ':' + item.verseRange + ' خارج حدود السورة في المصحف المعتمد.');
  }
  return { surahNumber, range };
}

export async function loadRuqyahSurah(surahNumber: number): Promise<Ayah[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new Error('رقم السورة غير صالح لتحميل المصحف المعتمد.');
  }
  const verses = await loadSurahVerses(surahNumber);
  validateRuqyahSurahChunk(surahNumber, verses);
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

export interface RuqyahAudioQueueEntry extends RuqyahAudioAyah {
  itemId: string;
  title: string;
}

/** Preserve category item/ayah order while removing duplicate global ayahs. */
export async function getRuqyahAudioQueueForItems(items: RuqyahItem[]): Promise<RuqyahAudioQueueEntry[]> {
  const itemQueues = await Promise.all(items
    .filter(item => item.type === 'quran')
    .map(async item => ({ item, ayahs: await getRuqyahAudioQueue(item) })));
  const seenAyahs = new Set<number>();
  return itemQueues.flatMap(({ item, ayahs }) => ayahs.map(ayah => ({
    ...ayah,
    itemId: item.id,
    title: item.title
  }))).filter(entry => {
    if (seenAyahs.has(entry.globalAyahNumber)) return false;
    seenAyahs.add(entry.globalAyahNumber);
    return true;
  });
}
