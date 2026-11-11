import { ALL_SURAHS } from '../data/quranMeta';
import { buildQuranAyahAudioUrl } from './ruqyahAudioService';

export interface QuranAudioDownloadRange {
  reciterId: string;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

export interface QuranAudioDownloadItem {
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  url: string;
}

export interface QuranAudioDownloadPlan {
  reciterId: string;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  totalAyahs: number;
  items: QuranAudioDownloadItem[];
}

/** Build a bounded, device-local plan from canonical Quran metadata. No network or storage is touched. */
export function buildQuranAudioDownloadPlan(input: QuranAudioDownloadRange): QuranAudioDownloadPlan {
  if (!input || typeof input !== 'object') throw new Error('بيانات تنزيل التلاوة غير صالحة.');
  const { reciterId, surahNumber, startAyah, endAyah } = input;
  if (!Number.isSafeInteger(surahNumber) || surahNumber < 1 || surahNumber > ALL_SURAHS.length) {
    throw new Error('رقم السورة المطلوب تنزيلها غير صالح.');
  }
  const surah = ALL_SURAHS[surahNumber - 1];
  if (!surah || surah.number !== surahNumber ||
      !Number.isSafeInteger(startAyah) || !Number.isSafeInteger(endAyah) ||
      startAyah < 1 || endAyah < startAyah || endAyah > surah.versesCount) {
    throw new Error('نطاق الآيات المطلوب تنزيله خارج حدود السورة.');
  }
  const precedingAyahs = ALL_SURAHS.slice(0, surahNumber - 1)
    .reduce((total, item) => total + item.versesCount, 0);
  const totalAyahs = endAyah - startAyah + 1;
  if (!Number.isSafeInteger(precedingAyahs) || precedingAyahs < 0 ||
      !Number.isSafeInteger(totalAyahs) || totalAyahs < 1 || totalAyahs > surah.versesCount) {
    throw new Error('تعذر إنشاء نطاق تنزيل آمن للتلاوة.');
  }
  const items = Array.from({ length: totalAyahs }, (_, index) => {
    const ayahNumber = startAyah + index;
    const globalAyahNumber = precedingAyahs + ayahNumber;
    return {
      surahNumber,
      ayahNumber,
      globalAyahNumber,
      url: buildQuranAyahAudioUrl(reciterId, globalAyahNumber)
    };
  });
  return { reciterId, surahNumber, startAyah, endAyah, totalAyahs, items };
}
