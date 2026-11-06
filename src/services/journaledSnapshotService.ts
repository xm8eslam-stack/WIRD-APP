import type { UserProfile, MemorizationPlan, WirdPortion, TestResult } from '../types/quran';
import type { EngineGeneratedPlan } from './planningEngine';
import { isValidDomainEvent, type WirdDomainEvent } from './domainEvents';
import { createSecureId } from './secureId';
import { IndexedDbSyncJournal, type JournalMutationInput } from './indexedDbSyncJournal';
import { replayJournalProjection, type ProjectionLockRunner } from './journalProjectionReplayer';
import { StorageService, type JournalProjectionOperation } from './storageService';

export interface JournaledSnapshotWriteResult {
  success: boolean;
  mode: 'journal' | 'local-only';
  queued: boolean;
  recoveryBlocked: boolean;
  recoveredPriorEvents: boolean;
  error?: string;
}

const browserProjectionLock: ProjectionLockRunner = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
  if (typeof navigator === 'undefined' || !('locks' in navigator) ||
      !(navigator as Navigator & { locks?: LockManager }).locks?.request) {
    throw new Error('هذا المتصفح لا يوفر قفلاً آمناً بين التبويبات لحفظ التغييرات؛ لم نعدّل البيانات.');
  }
  const lockManager = (navigator as Navigator & { locks: LockManager }).locks;
  return lockManager.request(name, { mode: 'exclusive' }, task);
};

const inlineProjectionLock: ProjectionLockRunner = async <T>(_name: string, task: () => Promise<T>): Promise<T> => task();

export interface JournaledSnapshotOptions {
  /** Test seam; production callers should use the shared database default. */
  journal?: IndexedDbSyncJournal;
  /** Test seam for deterministic replay-lock behavior. */
  runExclusive?: ProjectionLockRunner;
  /** Abort a scoped migration if the active account changes while it waits for the journal lock. */
  expectedStorageScope?: string;
}

/**
 * Persist a full snapshot through the write-ahead journal for authenticated users.
 * The localStorage projection is changed only by the replay service, after the
 * event and its outbox record have committed atomically in IndexedDB.
 *
 * Guests and browsers without IndexedDB retain the existing local-only behavior.
 * An IndexedDB failure is never silently downgraded to a localStorage-only write.
 */
export async function persistJournaledSnapshot(
  input: JournalMutationInput,
  localOnlyWrite: () => boolean,
  options: JournaledSnapshotOptions = {}
): Promise<JournaledSnapshotWriteResult> {
  const suppliedDomainEvent = input.payload?.domainEvent;
  if (suppliedDomainEvent !== undefined &&
      (!input.mutationId || !isValidDomainEvent(suppliedDomainEvent, input.mutationId))) {
    return {
      success: false,
      mode: StorageService.getStorageScope().startsWith('user:') ? 'journal' : 'local-only',
      queued: false,
      recoveryBlocked: false,
      recoveredPriorEvents: false,
      error: 'بيانات الحدث غير صالحة أو لا تطابق معرّف العملية؛ لم يتم حفظ أي تغيير.'
    };
  }
  const scope = StorageService.getStorageScope();
  if (options.expectedStorageScope && options.expectedStorageScope !== scope) {
    return {
      success: false,
      mode: scope.startsWith('user:') ? 'journal' : 'local-only',
      queued: false,
      recoveryBlocked: false,
      recoveredPriorEvents: false,
      error: 'تغير نطاق الحساب أثناء تجهيز العملية؛ أوقفنا الحفظ لحماية بيانات الحسابات.'
    };
  }
  if (!scope.startsWith('user:') || typeof indexedDB === 'undefined') {
    const success = localOnlyWrite();
    return {
      success,
      mode: 'local-only',
      queued: false,
      recoveryBlocked: false,
      recoveredPriorEvents: false,
      ...(success ? {} : { error: 'تعذر حفظ البيانات محلياً.' })
    };
  }

  const journal = options.journal ?? new IndexedDbSyncJournal();
  const ownsJournal = !options.journal;
  let queued = false;
  let preflightPassed = false;
  let recoveredPriorEvents = false;
  const uid = scope.slice('user:'.length);
  const runExclusive = options.runExclusive ?? browserProjectionLock;

  try {
    const outcome = await runExclusive('wird-journal-projection:' + uid, async () => {
      const assertExpectedScope = () => {
        if (options.expectedStorageScope && StorageService.getStorageScope() !== options.expectedStorageScope) {
          throw new Error('تغير نطاق الحساب أثناء انتظار قفل سجل الحفظ؛ تُرك الحدث دون إسقاط على حساب آخر.');
        }
      };
      assertExpectedScope();
      // Replay older committed events while holding the same cross-tab lock
      // used for this new enqueue. Never append a stale snapshot behind an
      // event that changed the local projection during recovery.
      const previousReplay = await replayJournalProjection(journal, inlineProjectionLock);
      assertExpectedScope();
      preflightPassed = true;
      if (previousReplay.applied > 0) {
        recoveredPriorEvents = true;
        return 'recovered-prior-events' as const;
      }

      await journal.enqueue({ ...input, mutationId: input.mutationId ?? createSecureId() });
      queued = true;
      assertExpectedScope();
      await replayJournalProjection(journal, inlineProjectionLock);
      assertExpectedScope();
      return 'saved' as const;
    });

    if (outcome === 'recovered-prior-events') {
      return {
        success: false,
        mode: 'journal',
        queued: false,
        recoveryBlocked: true,
        recoveredPriorEvents: true,
        error: 'تمت استعادة تغيير سابق إلى التخزين المحلي. حدّث بيانات الشاشة ثم أعد المحاولة.'
      };
    }
    return { success: true, mode: 'journal', queued: true, recoveryBlocked: false, recoveredPriorEvents: false };
  } catch (error) {
    return {
      success: false,
      mode: 'journal',
      queued,
      recoveryBlocked: !preflightPassed || queued,
      recoveredPriorEvents,
      error: error instanceof Error ? error.message : 'تعذر حفظ سجل التغيير أو إسقاطه محلياً.'
    };
  } finally {
    if (ownsJournal) journal.close();
  }
}

export function persistProfileSnapshot(
  profile: UserProfile,
  options: JournaledSnapshotOptions = {}
): Promise<JournaledSnapshotWriteResult> {
  return persistJournaledSnapshot(
    { collection: 'profile', documentId: 'main', payload: { profile } },
    () => StorageService.saveProfile(profile),
    options
  );
}

export function persistPlansSnapshot(
  plans: MemorizationPlan[],
  options: JournaledSnapshotOptions = {}
): Promise<JournaledSnapshotWriteResult> {
  return persistJournaledSnapshot(
    { collection: 'plans', documentId: 'snapshot', payload: { records: plans } },
    () => StorageService.savePlans(plans),
    options
  );
}

export function persistEnginePlansSnapshot(
  plans: EngineGeneratedPlan[],
  options: JournaledSnapshotOptions = {}
): Promise<JournaledSnapshotWriteResult> {
  return persistJournaledSnapshot(
    { collection: 'enginePlans', documentId: 'snapshot', payload: { records: plans } },
    () => StorageService.saveEnginePlans(plans),
    options
  );
}

export function persistPortionsSnapshot(
  portions: WirdPortion[],
  options: JournaledSnapshotOptions = {}
): Promise<JournaledSnapshotWriteResult> {
  return persistJournaledSnapshot(
    { collection: 'portions', documentId: 'snapshot', payload: { records: portions } },
    () => StorageService.saveUnifiedPortions(portions),
    options
  );
}

export function persistTestResultSnapshot(
  test: TestResult,
  options: JournaledSnapshotOptions = {}
): Promise<JournaledSnapshotWriteResult> {
  if (!test || typeof test.id !== 'string' || !test.id.trim() ||
      typeof test.date !== 'string' || !Number.isFinite(Date.parse(test.date))) {
    return Promise.resolve({
      success: false,
      mode: StorageService.getStorageScope().startsWith('user:') ? 'journal' : 'local-only',
      queued: false,
      recoveryBlocked: false,
      recoveredPriorEvents: false,
      error: 'تاريخ أو معرّف نتيجة الاختبار غير صالح؛ لم يتم حفظ أي حدث.'
    });
  }
  const existing = StorageService.getTests();
  const existingMatch = existing.find(item => item.id === test.id);
  const sameResult = (left: TestResult, right: TestResult) =>
    left.id === right.id &&
    left.date === right.date &&
    left.type === right.type &&
    left.surahName === right.surahName &&
    left.score === right.score &&
    left.totalQuestions === right.totalQuestions &&
    JSON.stringify(left.weakVerses) === JSON.stringify(right.weakVerses);
  if (existingMatch && !sameResult(existingMatch, test)) {
    return Promise.resolve({
      success: false,
      mode: StorageService.getStorageScope().startsWith('user:') ? 'journal' : 'local-only',
      queued: false,
      recoveryBlocked: false,
      recoveredPriorEvents: false,
      error: 'معرّف نتيجة الاختبار مستخدم بالفعل بمحتوى مختلف؛ لم يتم استبدال النتيجة السابقة.'
    });
  }

  const records = existingMatch ? existing : [test, ...existing].slice(0, 50);
  return persistJournaledSnapshot(
    {
      mutationId: 'test-' + test.id,
      collection: 'tests',
      documentId: test.id,
      payload: {
        records,
        domainEvent: {
          schemaVersion: 1,
          id: 'test-' + test.id,
          type: 'test.completed',
          occurredAt: new Date(test.date).toISOString(),
          payload: {
            testResultId: test.id,
            testType: test.type,
            score: test.score,
            totalQuestions: test.totalQuestions,
            surahName: test.surahName
          }
        }
      }
    },
    () => StorageService.saveTests(records),
    options
  );
}

export type JournaledTransactionOperation = JournalProjectionOperation;

/**
 * Commit one journal event whose payload contains several domain projections.
 * The event/outbox pair is atomic in IndexedDB and StorageService applies all
 * child projections as one rollback-safe local transaction.
 */
export function persistJournaledTransaction(
  operations: JournaledTransactionOperation[],
  options: JournaledSnapshotOptions = {},
  mutationId?: string,
  domainEvent?: WirdDomainEvent
): Promise<JournaledSnapshotWriteResult> {
  // Keep the journal document ID stable with the mutation ID. IndexedDB
  // fingerprints include documentId, so reusing a mutation ID with a fresh
  // random document ID would turn a legitimate retry into a collision.
  const transactionId = mutationId ?? 'transaction-' + createSecureId();
  return persistJournaledSnapshot(
    {
      mutationId: transactionId,
      collection: 'syncMeta',
      documentId: transactionId,
      payload: {
        transaction: { version: 1, operations },
        ...(domainEvent ? { domainEvent } : {})
      }
    },
    () => StorageService.applyJournalTransaction(operations),
    options
  );
}
