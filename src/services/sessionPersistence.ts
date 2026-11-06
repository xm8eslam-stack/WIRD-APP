import { RetentionService } from './retentionService';
import { StorageService, type JournalProjectionOperation } from './storageService';
import { getSessionCompletionMetrics, SessionMode, SessionCompletionMetrics } from './sessionCompletion';
import { ALL_SURAHS } from '../data/quranMeta';
import { createSecureId } from './secureId';
import { persistJournaledTransaction, type JournaledSnapshotOptions } from './journaledSnapshotService';

export interface PersistSessionCompletionInput {
  mode: SessionMode; memorizedAyahs: number; reviewedPages: number;
  minutes: number; taskName: string; surahNumber?: number; startAyah?: number; endAyah?: number;
}
export type PersistSessionCompletionResult =
  | { success: true; memorizedAyahs: number; reviewedPages: number; shouldRecordMemorization: boolean }
  | { success: false; messageAr: string; recoveredPriorEvents?: boolean };

/**
 * Journal-first session completion. Progress, daily activity, and streak/profile
 * are committed as one recoverable IndexedDB event and projected locally only
 * after the journal/outbox transaction is durable. Guest mode uses the same
 * grouped projection with rollback verification but remains local-only.
 */
export async function persistJournaledSessionCompletion(
  input: PersistSessionCompletionInput,
  options: JournaledSnapshotOptions = {}
): Promise<PersistSessionCompletionResult> {
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
    return { success: false, messageAr: error instanceof Error ? error.message : 'عدادات الجلسة غير صالحة؛ لم يتم حفظ أي تغيير.' };
  }

  const activity = StorageService.buildSessionCompletionSnapshot(
    metrics.memorizedAyahs, metrics.reviewedPages, input.minutes, input.taskName
  );
  if (!activity.success) return { success: false, messageAr: activity.error };

  const operations: JournalProjectionOperation[] = [];
  if (metrics.shouldRecordMemorization) {
    const surah = ALL_SURAHS.find(item => item.number === input.surahNumber);
    if (!surah || !Number.isSafeInteger(input.startAyah) || !Number.isSafeInteger(input.endAyah) ||
        Number(input.startAyah) < 1 || Number(input.endAyah) < Number(input.startAyah) ||
        Number(input.endAyah) > surah.versesCount) {
      return { success: false, messageAr: 'تعذر تحديد سورة وآيات جلسة الحفظ بدقة؛ لم يتم تسجيل إنجاز دون نطاق قرآني صالح.' };
    }
    try {
      const prepared = RetentionService.buildMemorizationCompletionSnapshot(
        input.surahNumber!, input.startAyah!, input.endAyah!
      );
      operations.push({
        collection: 'portions', documentId: 'snapshot', operation: 'upsert',
        payload: { records: prepared.portions }
      });
    } catch (error) {
      return { success: false, messageAr: error instanceof Error ? error.message : 'تعذر إعداد تقدم الحفظ دون تعديل البيانات.' };
    }
  }

  operations.push(
    { collection: 'activityEvents', documentId: 'snapshot', operation: 'upsert', payload: { records: activity.logs } },
    { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: activity.profile } }
  );

  try {
    const result = await persistJournaledTransaction(operations, options, 'session-' + createSecureId());
    if (!result.success) {
      return {
        success: false,
        messageAr: result.error || (result.queued
          ? 'تم حفظ الجلسة في سجل الاستعادة، لكن تعذر تطبيقها محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
          : 'تعذر تأمين حفظ الجلسة؛ لم يتم تأكيد الإنجاز.'),
        recoveredPriorEvents: result.recoveredPriorEvents
      };
    }
    return {
      success: true,
      memorizedAyahs: metrics.memorizedAyahs,
      reviewedPages: metrics.reviewedPages,
      shouldRecordMemorization: metrics.shouldRecordMemorization
    };
  } catch (error) {
    return { success: false, messageAr: error instanceof Error ? error.message : 'تعذر حفظ الجلسة في سجل الاستعادة؛ لم يتم تأكيد الإنجاز.' };
  }
}

/**
 * Legacy synchronous local-only API retained for existing tests and explicit
 * local-only callers. Authenticated application flows must use the journaled API.
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
  try { metrics = getSessionCompletionMetrics(input.mode, input.memorizedAyahs, input.reviewedPages); }
  catch (error) {
    return { success: false, messageAr: error instanceof Error ? error.message : 'عدادات الجلسة غير صالحة؛ لم يتم حفظ أي تغيير.' };
  }
  if (metrics.shouldRecordMemorization) {
    const surah = ALL_SURAHS.find(item => item.number === input.surahNumber);
    if (!surah || !Number.isSafeInteger(input.startAyah) || !Number.isSafeInteger(input.endAyah) ||
        Number(input.startAyah) < 1 || Number(input.endAyah) < Number(input.startAyah) ||
        Number(input.endAyah) > surah.versesCount) {
      return { success: false, messageAr: 'تعذر تحديد سورة وآيات جلسة الحفظ بدقة؛ لم يتم تسجيل إنجاز دون نطاق قرآني صالح.' };
    }
  }
  const previousPortions = metrics.shouldRecordMemorization ? RetentionService.getPortions() : null;
  if (metrics.shouldRecordMemorization) {
    try { RetentionService.recordMemorizationCompletion(input.surahNumber!, input.startAyah!, input.endAyah!); }
    catch (error) { return { success: false, messageAr: error instanceof Error ? error.message : 'تعذر حفظ تقدم الحفظ؛ لم يتم تأكيد إتمام الجلسة.' }; }
  }
  const activityResult = StorageService.recordSessionCompletionDetailed(
    metrics.memorizedAyahs, metrics.reviewedPages, input.minutes, input.taskName
  );
  if (!activityResult.success) {
    const portionWriteRestored = previousPortions ? RetentionService.savePortions(previousPortions) : true;
    const portionReadbackRestored = previousPortions === null ||
      JSON.stringify(RetentionService.getPortions()) === JSON.stringify(previousPortions);
    const rollbackSucceeded = portionWriteRestored && portionReadbackRestored && activityResult.rollbackVerified;
    return {
      success: false,
      messageAr: rollbackSucceeded
        ? 'تعذر حفظ سجل النشاط أو سلسلة المواظبة؛ تم التحقق من استعادة تقدم المقطع وسجل النشاط إلى ما قبل المحاولة. لم يتم تأكيد الجلسة، ويمكنك المحاولة مجددًا.'
        : 'تعذر حفظ سجل النشاط، ولم ينجح التحقق من استعادة جميع البيانات السابقة. لا تغلق الصفحة ولا تكرر العملية؛ صدّر نسخة احتياطية واطلب مراجعة حالة البيانات.'
    };
  }
  return { success: true, memorizedAyahs: metrics.memorizedAyahs, reviewedPages: metrics.reviewedPages, shouldRecordMemorization: metrics.shouldRecordMemorization };
}
