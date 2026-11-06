import type { PortionStatusRecord } from '../types/quran';
import { RetentionService } from './retentionService';
import { getLocalDateString } from './unifiedPortionService';
import { ALL_SURAHS } from '../data/quranMeta';

export interface RecordWeakVerseFailureInput {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  text: string;
  notes?: string;
}

export type RecordWeakVerseFailureResult =
  | { success: true }
  | { success: false; messageAr: string };

/** Save the canonical weak portion and its mistake counter without leaving a half-written result. */
export function recordWeakVerseFailure(input: RecordWeakVerseFailureInput): RecordWeakVerseFailureResult {
  const surah = Number.isSafeInteger(input.surahNumber)
    ? ALL_SURAHS.find(item => item.number === input.surahNumber)
    : undefined;
  if (!surah || !Number.isSafeInteger(input.ayahNumber) || input.ayahNumber < 1 || input.ayahNumber > surah.versesCount) {
    return { success: false, messageAr: 'رقم السورة أو الآية غير صحيح؛ لم يتم تعديل سجل الحفظ أو المراجعة.' };
  }
  if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000 ||
      (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 2000))) {
    return { success: false, messageAr: 'نص الآية أو الملاحظة غير صالح؛ لم يتم حفظ التغيير.' };
  }
  const previousPortions = RetentionService.getPortions();
  const existingExactPortion = previousPortions.find(portion =>
    portion.surahNumber === input.surahNumber &&
    portion.startAyah === input.ayahNumber &&
    portion.endAyah === input.ayahNumber
  );
  const today = getLocalDateString();
  try {
    RetentionService.addPortion({
      type: 'passage',
      surahNumber: input.surahNumber,
      surahName: surah.name,
      startAyah: input.ayahNumber,
      endAyah: input.ayahNumber,
      status: 'weak',
      lastReviewedDate: today,
      nextDueDate: today,
      intervalDays: 1,
      easeFactor: existingExactPortion?.easeFactor ?? 2.0,
      repetitionCount: (existingExactPortion?.repetitionCount ?? 0) + 1,
      mistakesCount: (existingExactPortion?.mistakesCount ?? 0) + 1,
      strength: 'weak'
    } as Omit<PortionStatusRecord, 'id' | 'history'>);
    RetentionService.addOrIncrementWeakVerse(
      input.surahNumber,
      input.ayahNumber,
      surah.name,
      input.text,
      input.notes
    );
    return { success: true };
  } catch (error) {
    const rollbackSucceeded = RetentionService.savePortions(previousPortions);
    return {
      success: false,
      messageAr: rollbackSucceeded
        ? (error instanceof Error ? error.message : 'تعذر تسجيل الآية المتعثرة؛ أُعيد سجل المقاطع إلى حالته السابقة.')
        : 'تعذر تسجيل الآية المتعثرة، كما تعذر التحقق من استعادة سجل المقاطع السابق. لا تغلق الصفحة؛ صدّر نسخة احتياطية قبل المتابعة.'
    };
  }
}
