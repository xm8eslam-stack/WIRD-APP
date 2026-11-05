import { Ayah } from '../types/quran';
import COMPLETE_QURAN_DATA from './completeQuranData.json';
export { QURAN_DATA_SOURCE_INFO } from './quranDataInfo';

/**
 * ====================================================================
 * WIRD — Complete Verified Quran Database (المصحف الشريف برواية حفص عن عاصم)
 * ====================================================================
 * 
 * المصدر المعتمد:
 * - مشروع تنزيل القرآني (Tanzil Project - http://tanzil.net)
 * - النص: المصحف العثماني بالتشكيل التام وعلامات الوقف المعتمدة (Uthmani Text)
 * - الرواية: حفص عن عاصم الكوفي من طريق الشاطبية
 * - الترخيص: Creative Commons Attribution 3.0 Unported License (CC BY 3.0)
 * - الشروط: الاحتفاظ بنسب المصدر لمشروع تنزيل وعدم تحريف أي حرف أو تشكيل.
 * 
 * الإحصائيات الكاملة المعتمدة:
 * - عدد السور: 114 سورة
 * - عدد الآيات: 6,236 آية (عد كوفي معتمد)
 * - عدد الصفحات: 604 صفحات (وفق مصحف المدينة المنورة للنشر الحاسوبي)
 * - عدد الأجزاء: 30 جزءاً
 * - عدد الأحزاب: 60 حزباً (240 ربع حزب)
 */

// Complete 114 Surahs dataset
export const VERIFIED_AYAHS: Record<number, Ayah[]> = COMPLETE_QURAN_DATA as unknown as Record<number, Ayah[]>;

export const TOTAL_VERIFIED_AYAHS_COUNT = 6236;
export const TOTAL_VERIFIED_SURAHS_COUNT = 114;

/**
 * Retrieve all verses for any surah (1 to 114)
 */
export function getSurahVerses(surahNumber: number): Ayah[] {
  return VERIFIED_AYAHS[surahNumber] || [];
}

/**
 * Retrieve a specific ayah by surah number and ayah number in surah
 */
export function getAyahByCoordinate(surahNumber: number, ayahNumber: number): Ayah | undefined {
  const surah = VERIFIED_AYAHS[surahNumber];
  if (!surah) return undefined;
  return surah.find(a => a.numberInSurah === ayahNumber);
}

/**
 * Retrieve all verses belonging to a specific Mushaf page (1 to 604)
 */
export function getAyahsByPage(pageNumber: number): Ayah[] {
  const result: Ayah[] = [];
  for (let s = 1; s <= 114; s++) {
    const surah = VERIFIED_AYAHS[s];
    if (surah) {
      for (const a of surah) {
        if (a.page === pageNumber) {
          result.push(a);
        }
      }
    }
  }
  return result;
}

/**
 * Retrieve all verses belonging to a specific Juz (1 to 30)
 */
export function getAyahsByJuz(juzNumber: number): Ayah[] {
  const result: Ayah[] = [];
  for (let s = 1; s <= 114; s++) {
    const surah = VERIFIED_AYAHS[s];
    if (surah) {
      for (const a of surah) {
        if (a.juz === juzNumber) {
          result.push(a);
        }
      }
    }
  }
  return result;
}

/**
 * Split ayah text into words safely, preserving meaning and isolating pause symbols
 */
export function getAyahWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.trim().length > 0 && w !== 'ۚ' && w !== 'ۖ' && w !== 'ۗ' && w !== 'ۛ');
}
