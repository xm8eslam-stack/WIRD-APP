import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import type { JournalEvent } from './indexedDbSyncJournal';
import { StorageService } from './storageService';

export interface JournalProjectionReplayResult {
  uid: string;
  applied: number;
  skippedAlreadyProjected: number;
  recoveredAlreadyProjected: number;
  cursor: number;
}

export type ProjectionLockRunner = <T>(name: string, task: () => Promise<T>) => Promise<T>;

let sharedJournal: IndexedDbSyncJournal | null = null;

function getSharedJournal(): IndexedDbSyncJournal {
  if (!sharedJournal) sharedJournal = new IndexedDbSyncJournal();
  return sharedJournal;
}

const browserProjectionLock: ProjectionLockRunner = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
  if (typeof navigator === 'undefined' || !('locks' in navigator) ||
      !(navigator as Navigator & { locks?: LockManager }).locks?.request) {
    throw new Error('هذا المتصفح لا يوفر قفلاً آمناً بين التبويبات لإعادة تشغيل سجل المزامنة؛ أبقينا البيانات دون تعديل.');
  }
  const lockManager = (navigator as Navigator & { locks: LockManager }).locks;
  return lockManager.request(name, { mode: 'exclusive' }, task);
};

/**
 * Replay write-ahead events into the scoped localStorage projection before the
 * application reads its initial state. Legacy-import events are already present
 * in localStorage, so they advance the cursor without rewriting the projection.
 */
export async function replayJournalProjection(
  journal: IndexedDbSyncJournal = getSharedJournal(),
  runExclusive: ProjectionLockRunner = browserProjectionLock
): Promise<JournalProjectionReplayResult> {
  const scope = StorageService.getStorageScope();
  const uid = scope.startsWith('user:') ? scope.slice('user:'.length) : '';
  if (!uid) {
    return { uid: '', applied: 0, skippedAlreadyProjected: 0, recoveredAlreadyProjected: 0, cursor: 0 };
  }

  let initialCursor: number;
  let initialEvents: JournalEvent[];
  try {
    initialCursor = await journal.getProjectionCursor();
    initialEvents = await journal.listEventsAfter(initialCursor, 1);
  } catch (error) {
    if (error instanceof Error && error.message.includes('IndexedDB غير متاح في هذا المتصفح')) {
      // No IndexedDB means this browser cannot have a journal to replay. Keep
      // the existing localStorage-only experience rather than blocking login.
      return { uid, applied: 0, skippedAlreadyProjected: 0, recoveredAlreadyProjected: 0, cursor: 0 };
    }
    throw error;
  }
  if (initialEvents.length === 0) {
    return { uid, applied: 0, skippedAlreadyProjected: 0, recoveredAlreadyProjected: 0, cursor: initialCursor };
  }

  return runExclusive('wird-journal-projection:' + uid, async () => {
    if (StorageService.getStorageScope() !== scope) {
      throw new Error('تغير الحساب النشط قبل بدء إعادة تشغيل سجل المزامنة؛ أُوقفت العملية لحماية بيانات الحسابات.');
    }

    let cursor = await journal.getProjectionCursor();
    let applied = 0;
    let skippedAlreadyProjected = 0;
    let recoveredAlreadyProjected = 0;
    let events = await journal.listEventsAfter(cursor, 100);

    while (events.length > 0) {
      for (const event of events) {
        if (StorageService.getStorageScope() !== scope || event.uid !== uid) {
          throw new Error('تغير نطاق الحساب أثناء إعادة تشغيل سجل المزامنة؛ لم يتم تحريك المؤشر.');
        }
        if (event.sequence !== cursor + 1) {
          throw new Error('توجد فجوة في تسلسل سجل المزامنة قبل الحدث رقم ' + event.sequence + '.');
        }

        if (event.projectionRequired === false) {
          skippedAlreadyProjected++;
        } else if (event.operation === 'upsert' &&
            StorageService.matchesJournalProjection(event.collection, event.payload)) {
          // A previous attempt may have durably written the projection and then
          // stopped before committing the IndexedDB cursor. Confirm the exact
          // snapshot (including every child of a grouped transaction) before
          // advancing; never treat a merely similar or invalid snapshot as done.
          skippedAlreadyProjected++;
          recoveredAlreadyProjected++;
        } else if (StorageService.applyJournalEvent(event)) {
          applied++;
        } else {
          throw new Error(
            'تعذر إسقاط الحدث رقم ' + event.sequence + ' محلياً (' +
            event.collection + '/' + event.operation + '). ' +
            'لم تتطابق البيانات المحلية مع الحدث المحفوظ؛ تم الحفاظ على الحدث ولم يتحرك مؤشر إعادة التشغيل.'
          );
        }

        const advanced = await journal.markProjected(event.sequence);
        if (!advanced && await journal.getProjectionCursor() < event.sequence) {
          throw new Error('تعذر تثبيت مؤشر الإسقاط بعد الحدث رقم ' + event.sequence + '.');
        }
        cursor = event.sequence;
      }
      events = await journal.listEventsAfter(cursor, 100);
    }

    return { uid, applied, skippedAlreadyProjected, recoveredAlreadyProjected, cursor };
  });
}
