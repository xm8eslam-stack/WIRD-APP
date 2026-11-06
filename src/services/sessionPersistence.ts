import { RetentionService } from './retentionService';
import { StorageService } from './storageService';
import { getSessionCompletionMetrics, SessionMode } from './sessionCompletion';

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
  const metrics = getSessionCompletionMetrics(input.mode, input.memorizedAyahs, input.reviewedPages);
  const shouldSavePortion = metrics.shouldRecordMemorization &&
    Number.isInteger(input.surahNumber) && Number.isInteger(input.startAyah) && Number.isInteger(input.endAyah);
  if (metrics.shouldRecordMemorization && !shouldSavePortion) {
    return { success: false, messageAr: 'تعذر تحديد سورة وآيات جلسة الحفظ بدقة؛ لم يتم تسجيل إنجاز دون نطاق قرآني محدد.' };
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
