import type { PortionStatusRecord, WeakVerseItem } from '../types/quran';
import { RetentionService } from './retentionService';
import { StorageService, STORAGE_KEYS } from './storageService';
import { getLocalDateString } from './unifiedPortionService';
import { ALL_SURAHS } from '../data/quranMeta';
import type { JournaledTransactionOperation } from './journaledSnapshotService';

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

export type BuildWeakVerseFailureTransactionResult =
  | { success: true; operations: JournaledTransactionOperation[] }
  | { success: false; messageAr: string };

/**
 * Build the two full-snapshot projections for one weak-verse action without
 * mutating storage. The caller supplies and retains a stable mutation ID so a
 * retry can reuse the same journal identity.
 */
export function buildWeakVerseFailureTransaction(
  input: RecordWeakVerseFailureInput,
  mutationId: string,
  basePortions?: PortionStatusRecord[]
): BuildWeakVerseFailureTransactionResult {
  const surah = Number.isSafeInteger(input?.surahNumber)
    ? ALL_SURAHS.find(item => item.number === input.surahNumber)
    : undefined;
  if (!surah || !Number.isSafeInteger(input.ayahNumber) || input.ayahNumber < 1 ||
      input.ayahNumber > surah.versesCount) {
    return { success: false, messageAr: 'رقم السورة أو الآية غير صحيح؛ لم يتم تعديل سجل الحفظ أو المراجعة.' };
  }
  if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000 ||
      (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 2000)) ||
      typeof mutationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(mutationId)) {
    return { success: false, messageAr: 'نص الآية أو الملاحظة أو معرّف العملية غير صالح؛ لم يتم حفظ التغيير.' };
  }

  try {
    const previousPortions = RetentionService.getPortions();
    const schemaVersion = StorageService.getRawItem(STORAGE_KEYS.SCHEMA_VERSION);
    const canonicalRaw = StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS);
    const portionStorageKeys = [
      STORAGE_KEYS.SCHEMA_VERSION,
      STORAGE_KEYS.UNIFIED_PORTIONS,
      STORAGE_KEYS.PORTIONS,
      STORAGE_KEYS.REVISION
    ];
    if (portionStorageKeys.some(key =>
      !StorageService.verifyRawItem(key, StorageService.getRawItem(key))
    ) || !StorageService.verifyRawItem(
      STORAGE_KEYS.WEAK_VERSES,
      StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES)
    )) {
      return { success: false, messageAr: 'تعذر التحقق من القراءة الدائمة لجميع سجلات الآية والمقاطع؛ لم يتم إنشاء عملية استعادة.' };
    }
    if ((schemaVersion === '2' && canonicalRaw === null) ||
        (schemaVersion !== '2' && canonicalRaw !== null)) {
      return { success: false, messageAr: 'سجل المقاطع الموحد غير متسق؛ تم إيقاف التسجيل لحماية البيانات الأصلية.' };
    }
    if (schemaVersion === '2' && canonicalRaw !== null) {
      let canonicalParsed: unknown;
      try { canonicalParsed = JSON.parse(canonicalRaw); }
      catch {
        return { success: false, messageAr: 'سجل المقاطع الموحد تالف؛ تم الحفاظ عليه دون إنشاء عملية استعادة جديدة.' };
      }
      if (!Array.isArray(canonicalParsed) || JSON.stringify(canonicalParsed) !== JSON.stringify(previousPortions)) {
        return { success: false, messageAr: 'تعذر التحقق من سجل المقاطع الحالي؛ لم يتم إنشاء عملية استعادة جديدة.' };
      }
    }
    const portionBase = basePortions ?? previousPortions;
    const existingExactPortion = portionBase.find(portion =>
      portion.surahNumber === input.surahNumber &&
      portion.startAyah === input.ayahNumber &&
      portion.endAyah === input.ayahNumber
    );
    const today = getLocalDateString();
    const portionSnapshot = RetentionService.buildAddPortionSnapshot({
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
    } as Omit<PortionStatusRecord, 'id' | 'history'>, portionBase);

    const weakVerses = RetentionService.getWeakVerses().map(item => ({ ...item }));
    const existingIndex = weakVerses.findIndex(item =>
      item.surahNumber === input.surahNumber && item.ayahNumber === input.ayahNumber
    );
    if (existingIndex >= 0) {
      if (weakVerses[existingIndex].mistakeCount >= 1000000) {
        return { success: false, messageAr: 'وصل عداد تعثر الآية إلى الحد الآمن؛ لم يتم تغيير السجل.' };
      }
      weakVerses[existingIndex] = {
        ...weakVerses[existingIndex],
        mistakeCount: weakVerses[existingIndex].mistakeCount + 1,
        lastFailedDate: today,
        surahName: surah.name,
        ...(input.notes ? { notes: input.notes } : {})
      };
    } else {
      weakVerses.unshift({
        id: `weak-${input.surahNumber}-${input.ayahNumber}-${mutationId}`,
        surahNumber: input.surahNumber,
        surahName: surah.name,
        ayahNumber: input.ayahNumber,
        text: input.text,
        mistakeCount: 1,
        lastFailedDate: today,
        notes: input.notes
      });
    }

    return {
      success: true,
      operations: [
        { collection: 'portions', documentId: 'snapshot', operation: 'upsert', payload: { records: portionSnapshot.portions } },
        { collection: 'weakVerses', documentId: 'snapshot', operation: 'upsert', payload: { records: weakVerses } }
      ]
    };
  } catch (error) {
    return {
      success: false,
      messageAr: error instanceof Error ? error.message : 'تعذر تجهيز سجل الآية المتعثرة؛ لم يتم تعديل أي بيانات.'
    };
  }
}

export type BuildWeakVerseResolutionSnapshotResult =
  | { success: true; records: WeakVerseItem[]; changed: boolean }
  | { success: false; messageAr: string };

/** Prepare an idempotent weak-verse resolution without writing to local storage. */
export function buildWeakVerseResolutionSnapshot(
  id: string
): BuildWeakVerseResolutionSnapshotResult {
  if (typeof id !== 'string' || !id.trim() || id.length > 180) {
    return { success: false, messageAr: 'معرّف الآية المتعثرة غير صالح؛ لم يتم تعديل السجل.' };
  }
  try {
    const weakArchiveRaw = StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES);
    if (!StorageService.verifyRawItem(STORAGE_KEYS.WEAK_VERSES, weakArchiveRaw)) {
      return { success: false, messageAr: 'تعذر التحقق من القراءة الدائمة لقائمة الآيات المتعثرة؛ لم يتم إنشاء عملية استعادة.' };
    }
    const current = RetentionService.getWeakVerses();
    const records = current.filter(item => item.id !== id);
    return { success: true, records, changed: records.length !== current.length };
  } catch (error) {
    return {
      success: false,
      messageAr: error instanceof Error ? error.message : 'تعذر قراءة قائمة الآيات المتعثرة؛ لم يتم تعديل السجل.'
    };
  }
}

/** Save the canonical weak portion and its mistake counter without leaving a half-written result. */
/** @deprecated Legacy synchronous local-only path. Authenticated UI must use buildWeakVerseFailureTransaction and persistJournaledTransaction. */
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
  const previousWeakArchive = StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES);
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
    const portionWriteRestored = RetentionService.savePortions(previousPortions);
    const portionReadbackRestored = JSON.stringify(RetentionService.getPortions()) === JSON.stringify(previousPortions);
    try {
      if (previousWeakArchive === null) StorageService.removeRawItem(STORAGE_KEYS.WEAK_VERSES);
      else StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, previousWeakArchive);
    } catch {
      // The exact read-back below determines whether the archive was restored.
    }
    const weakArchiveRestored = StorageService.verifyRawItem(STORAGE_KEYS.WEAK_VERSES, previousWeakArchive);
    const rollbackSucceeded = portionWriteRestored && portionReadbackRestored && weakArchiveRestored;
    return {
      success: false,
      messageAr: rollbackSucceeded
        ? (error instanceof Error ? error.message : 'تعذر تسجيل الآية المتعثرة؛ تم التحقق من استعادة سجل المقاطع وأرشيف الآيات إلى حالتهما السابقة.')
        : 'تعذر تسجيل الآية المتعثرة، ولم ينجح التحقق من استعادة سجل المقاطع وأرشيف الآيات معًا. لا تغلق الصفحة ولا تكرر العملية؛ صدّر نسخة احتياطية واطلب مراجعة حالة البيانات.'
    };
  }
}
