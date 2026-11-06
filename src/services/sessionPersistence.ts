import { RetentionService } from './retentionService';
import { StorageService } from './storageService';
import { getSessionCompletionMetrics, SessionMode, SessionCompletionMetrics } from './sessionCompletion';
import { ALL_SURAHS } from '../data/quranMeta';

export interface PersistSessionCompletionInput {
  mode: SessionMode; memorizedAyahs: number; reviewedPages: number;
  minutes: number; taskName: string; surahNumber?: number; startAyah?: number; endAyah?: number;
}
export type PersistSessionCompletionResult =
  | { success: true; memorizedAyahs: number; reviewedPages: number; shouldRecordMemorization: boolean }
  | { success: false; messageAr: string };

/**
 * Persist portion progress and activity as one user-visible operation.
 * localStorage cannot guarantee crash-atomic multi-key writes; this rollback
 * handles ordinary write failures until the IndexedDB journal replaces it.
 */
export function persistSessionCompletion(input: PersistSessionCompletionInput): PersistSessionCompletionResult {
  if (!input || typeof input !== 'object') {
    return { success: false, messageAr: 'بيانات الجلسة غير صالحة؛ لم يتم حفظ أي تغيير.' };
  }
  if (!Number.isSafeInteger(input.minutes) || input.minutes < 0 || input.minutes > 1440) {
    return { success: false, messageAr: 'مدة الجلسة يجب أن تكون عدد دقائق صحيحاً من 0 إلى 1440؛ لم يتم حفظ أي تغيير.' };
  }
  if (typeof input.taskName !== 'string' || !input.taskName.trim() || input.taskName.length > 200) {
    return { success: false, messageAr: 'اسم مهمة الجلسة غير صالح؛ لم يتم حفظ أي تغيير.' };
  }

  let metrics: SessionCompletionMetrics;
  try {
    metrics = getSessionCompletionMetrics(input.mode, input.memorizedAyahs, input.reviewedPages);
  } catch (error) {
    return {
      success: false,
      messageAr: error instanceof Error ? error.message : 'عدادات الجلسة غير صالحة؛ لم يتم حفظ أي تغيير.'
    };
  }

  const shouldSavePortion = metrics.shouldRecordMemorization;
  if (shouldSavePortion) {
    const surah = ALL_SURAHS.find(item => item.number === input.surahNumber);
    if (!surah || !Number.isSafeInteger(input.startAyah) || !Number.isSafeInteger(input.endAyah) ||
        Number(input.startAyah) < 1 || Number(input.endAyah) < Number(input.startAyah) ||
        Number(input.endAyah) > surah.versesCount) {
      return { success: false, messageAr: 'تعذر تحديد سورة وآيات جلسة الحفظ بدقة؛ لم يتم تسجيل إنجاز دون نطاق قرآني صالح.' };
    }
  }

  const previousPortions = shouldSavePortion ? RetentionService.getPortions() : null;

  if (shouldSavePortion) {
    try {
      RetentionService.recordMemorizationCompletion(input.surahNumber!, input.startAyah!, input.endAyah!);
    } catch (error) {
      return { success: false, messageAr: error instanceof Error ? error.message : 'تعذر حفظ تقدم الحفظ؛ لم يتم تأكيد إتمام الجلسة.' };
    }
  }

  const activitySaved = StorageService.recordSessionCompletion(metrics.memorizedAyahs, metrics.reviewedPages, input.minutes, input.taskName);
  if (!activitySaved) {
    const rollbackSucceeded = previousPortions ? RetentionService.savePortions(previousPortions) : true;
    return {
      success: false,
      messageAr: rollbackSucceeded
        ? 'تعذر حفظ سجل النشاط أو سلسلة المواظبة؛ أُعيد تقدم المقطع إلى حالته السابقة. لم يتم تأكيد الجلسة، ويمكنك المحاولة مجددًا.'
        : 'تعذر حفظ سجل النشاط، كما تعذر التحقق من استعادة حالة المقطع السابقة. لا تغلق الصفحة؛ صدّر نسخة احتياطية قبل أي محاولة أخرى.'
    };
  }
  return { success: true, memorizedAyahs: metrics.memorizedAyahs, reviewedPages: metrics.reviewedPages, shouldRecordMemorization: metrics.shouldRecordMemorization };
}
