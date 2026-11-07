import type { BackupPayload, JournalProjectionOperation } from './storageService';
import { CLEAN_INITIAL_PROFILE, STORAGE_KEYS, StorageService, validateBackupPayload } from './storageService';
import { migrateLegacyDataLosslessly, type MigrationReport } from './unifiedPortionService';
import { createSecureId } from './secureId';
import { persistJournaledTransaction, type JournaledSnapshotOptions, type JournaledSnapshotWriteResult } from './journaledSnapshotService';

export type BackupPersistenceResult = {
  success: boolean;
  message: string;
  recoveredPriorEvents?: boolean;
  queued?: boolean;
};

function stableBackupMutationId(json: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < json.length; index++) {
    const code = json.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
  }
  return 'backup-import-' + (first >>> 0).toString(36) + '-' + (second >>> 0).toString(36);
}

function toWriteResult(result: JournaledSnapshotWriteResult, successMessage: string): BackupPersistenceResult {
  if (result.success) return { success: true, message: successMessage };
  if (result.recoveredPriorEvents) {
    return {
      success: false,
      recoveredPriorEvents: true,
      message: 'استعدنا تغييرات أقدم من سجل الحفظ أولاً. لم نطبّق النسخة الاحتياطية بعد؛ راجع البيانات ثم أعد الاستيراد.'
    };
  }
  return {
    success: false,
    queued: result.queued,
    message: result.error || (result.queued
      ? 'حُفظت العملية في سجل الاستعادة، لكن تعذر تطبيقها محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
      : 'تعذر تأمين العملية؛ لم يتم تأكيد أي استيراد أو إعادة ضبط.')
  };
}

export type LegacyPortionMigrationResult = {
  success: boolean;
  migrated: boolean;
  message: string;
  report?: MigrationReport;
  queued?: boolean;
};

/**
 * Prepare legacy portion migration without writing from a getter, then commit
 * the canonical archive and compatibility projections through the journal.
 * For a corrupt v2 canonical snapshot, recovery is allowed only when the
 * preserved legacy source has passed the full lossless migration validator.
 */
export async function migrateLegacyPortionsJournaled(
  options: JournaledSnapshotOptions = {}
): Promise<LegacyPortionMigrationResult> {
  const expectedStorageScope = StorageService.getStorageScope();
  const prepared = StorageService.prepareDataMigration();
  if (StorageService.getStorageScope() !== expectedStorageScope) {
    return { success: false, migrated: false, message: 'تغير نطاق الحساب أثناء قراءة البيانات القديمة؛ أوقفنا الترحيل لحماية البيانات.' };
  }
  if (!prepared.report.success || !prepared.portions) {
    return { success: false, migrated: false, report: prepared.report, message: prepared.report.error || 'تعذر تجهيز ترحيل البيانات القديمة.' };
  }
  if (!prepared.needsMigration) {
    return { success: true, migrated: false, report: prepared.report, message: 'البيانات الموحدة محدثة بالفعل؛ لا توجد عملية ترحيل مطلوبة.' };
  }

  try {
    const result = await persistJournaledTransaction([{
      collection: 'portions',
      documentId: 'legacy-migration',
      operation: 'upsert',
      payload: {
        records: prepared.portions,
        recoveryFromLegacy: prepared.allowRecoveryOverwrite,
        migration: true
      }
    }], { ...options, expectedStorageScope }, 'legacy-portions-migration-' + createSecureId());

    if (!result.success) {
      return {
        success: false,
        migrated: false,
        report: prepared.report,
        queued: result.queued,
        message: result.error || 'تعذر حفظ ترحيل المقاطع في سجل الاستعادة.'
      };
    }
    return {
      success: true,
      migrated: true,
      report: prepared.report,
      message: 'تم ترحيل المقاطع القديمة إلى السجل الموحد عبر عملية قابلة للاستعادة.'
    };
  } catch (error) {
    return {
      success: false,
      migrated: false,
      report: prepared.report,
      message: error instanceof Error ? error.message : 'تعذر إكمال ترحيل المقاطع القديمة.'
    };
  }
}

export function buildBackupImportOperations(
  jsonString: string
): { success: true; operations: JournalProjectionOperation[]; mutationId: string } |
   { success: false; message: string } {
  let parsed: BackupPayload;
  try {
    const value: unknown = JSON.parse(jsonString);
    const validation = validateBackupPayload(value);
    if (!validation.valid) return { success: false, message: validation.error || 'فشل التحقق من النسخة الاحتياطية.' };
    parsed = value as BackupPayload;
  } catch {
    return { success: false, message: 'صيغة ملف النسخة الاحتياطية غير صالحة.' };
  }

  const operations: JournalProjectionOperation[] = [];
  if (parsed.profile !== undefined) {
    operations.push({ collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: parsed.profile } });
  }
  if (parsed.plans !== undefined) {
    operations.push({ collection: 'plans', documentId: 'snapshot', operation: 'upsert', payload: { records: parsed.plans } });
  }
  if (parsed.enginePlans !== undefined) {
    operations.push({ collection: 'enginePlans', documentId: 'snapshot', operation: 'upsert', payload: { records: parsed.enginePlans } });
  }
  if (parsed.logs !== undefined) {
    operations.push({ collection: 'activityEvents', documentId: 'snapshot', operation: 'upsert', payload: { records: parsed.logs } });
  }
  if (parsed.tests !== undefined) {
    operations.push({ collection: 'tests', documentId: 'snapshot', operation: 'upsert', payload: { records: parsed.tests } });
  }
  if (parsed.weakVerses !== undefined) {
    operations.push({ collection: 'weakVerses', documentId: 'snapshot', operation: 'upsert', payload: { records: parsed.weakVerses } });
  }

  let canonicalPortions = parsed.unifiedPortions;
  if (canonicalPortions === undefined && (parsed.portions !== undefined || parsed.revisionItems !== undefined)) {
    const migration = migrateLegacyDataLosslessly(parsed.portions || [], parsed.revisionItems || []);
    if (!migration.report.success) {
      return { success: false, message: migration.report.error || 'تعذر ترحيل المقاطع القديمة دون فقد بيانات.' };
    }
    canonicalPortions = migration.portions;
  }
  if (canonicalPortions !== undefined) {
    operations.push({
      collection: 'portions', documentId: 'snapshot', operation: 'upsert',
      payload: { records: canonicalPortions, validatedImport: true }
    });
  }

  if (operations.length === 0) {
    return { success: false, message: 'النسخة الاحتياطية لا تحتوي على أي بيانات قابلة للاستيراد.' };
  }
  if (operations.length > 8) {
    return { success: false, message: 'تحتوي النسخة الاحتياطية على عدد مجموعات يتجاوز حد الاستيراد الآمن.' };
  }

  return { success: true, operations, mutationId: stableBackupMutationId(jsonString) };
}

/**
 * Import only after older committed journal events have been replayed. The
 * import itself is one grouped event, so local projections cannot be partially
 * replaced and a reload can recover the complete import.
 */
export async function importBackupJournaled(
  jsonString: string,
  options: JournaledSnapshotOptions = {}
): Promise<BackupPersistenceResult> {
  const prepared = buildBackupImportOperations(jsonString);
  if (!prepared.success) return { success: false, message: prepared.message };
  try {
    const result = await persistJournaledTransaction(prepared.operations, options, prepared.mutationId);
    return toWriteResult(result, 'تم استيراد النسخة الاحتياطية والتحقق من حفظ جميع مجموعاتها بنجاح.');
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'تعذر استيراد النسخة الاحتياطية؛ لم يتم تأكيد التغيير.' };
  }
}

export type BackupFileLike = {
  name?: string;
  text: () => Promise<string>;
};

/**
 * Shared file-import boundary for every UI entrypoint. Reading the file and
 * applying it both go through one journal-first path, so a screen cannot
 * accidentally bypass the write-ahead event/outbox.
 */
export async function importBackupFile(
  file: BackupFileLike | null | undefined,
  options: JournaledSnapshotOptions = {}
): Promise<BackupPersistenceResult> {
  if (!file || typeof file.text !== 'function') {
    return { success: false, message: 'لم يتم اختيار ملف نسخة احتياطية صالح.' };
  }
  if (file.name && !file.name.toLowerCase().endsWith('.json')) {
    return { success: false, message: 'يجب اختيار ملف نسخة احتياطية بصيغة JSON.' };
  }
  try {
    const content = await file.text();
    if (!content.trim()) {
      return { success: false, message: 'ملف النسخة الاحتياطية فارغ؛ لم يتم تغيير بياناتك.' };
    }
    return await importBackupJournaled(content, options);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error
        ? error.message
        : 'تعذر قراءة ملف النسخة الاحتياطية؛ لم يتم تغيير بياناتك.'
    };
  }
}

/**
 * Reset is an ordered snapshot mutation rather than a direct localStorage
 * wipe. Older journal events are replayed first, then this reset event becomes
 * the latest local projection and remains in the journal for crash recovery.
 */
export async function resetAllDataJournaled(
  options: JournaledSnapshotOptions = {}
): Promise<BackupPersistenceResult> {
  const operations: JournalProjectionOperation[] = [
    { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: { ...CLEAN_INITIAL_PROFILE } } },
    { collection: 'plans', documentId: 'snapshot', operation: 'upsert', payload: { records: [] } },
    { collection: 'enginePlans', documentId: 'snapshot', operation: 'upsert', payload: { records: [] } },
    { collection: 'portions', documentId: 'snapshot', operation: 'upsert', payload: { records: [] } },
    { collection: 'weakVerses', documentId: 'snapshot', operation: 'upsert', payload: { records: [] } },
    { collection: 'tests', documentId: 'snapshot', operation: 'upsert', payload: { records: [] } },
    { collection: 'activityEvents', documentId: 'snapshot', operation: 'upsert', payload: { records: [] } }
  ];
  try {
    const result = await persistJournaledTransaction(
      operations, options, 'reset-' + Math.floor(Date.now()).toString(36)
    );
    const persisted = toWriteResult(result, 'تمت إعادة ضبط البيانات عبر سجل الحفظ القابل للاستعادة.');
    if (persisted.success) {
      // This key is a retired legacy projection and is not part of the journal schema.
      if (!StorageService.removeRawItem(STORAGE_KEYS.PROGRESS) ||
          !StorageService.verifyRawItem(STORAGE_KEYS.PROGRESS, null) ||
          !StorageService.removeRawItem(STORAGE_KEYS.RUQYAH_PROGRESS) ||
          !StorageService.verifyRawItem(STORAGE_KEYS.RUQYAH_PROGRESS, null)) {
        return {
          success: false,
          message: 'تم حفظ إعادة الضبط، لكن تعذر حذف أحد مفاتيح التقدم المحلية. لا تكرر العملية؛ أعد فتح التطبيق وراجع البيانات.'
        };
      }
    }
    return persisted;
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'تعذر إعادة ضبط البيانات؛ لم يتم تأكيد العملية.' };
  }
}
