import type { UserProfile, MemorizationPlan } from '../types/quran';
import type { EngineGeneratedPlan } from './planningEngine';
import { createSecureId } from './secureId';
import { IndexedDbSyncJournal, type JournalMutationInput } from './indexedDbSyncJournal';
import { replayJournalProjection, type ProjectionLockRunner } from './journalProjectionReplayer';
import { StorageService } from './storageService';

export interface JournaledSnapshotWriteResult {
  success: boolean;
  mode: 'journal' | 'local-only';
  queued: boolean;
  recoveryBlocked: boolean;
  error?: string;
}

export interface JournaledSnapshotOptions {
  /** Test seam; production callers should use the shared database default. */
  journal?: IndexedDbSyncJournal;
  /** Test seam for deterministic replay-lock behavior. */
  runExclusive?: ProjectionLockRunner;
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
  input: Omit<JournalMutationInput, 'mutationId'>,
  localOnlyWrite: () => boolean,
  options: JournaledSnapshotOptions = {}
): Promise<JournaledSnapshotWriteResult> {
  const scope = StorageService.getStorageScope();
  if (!scope.startsWith('user:') || typeof indexedDB === 'undefined') {
    const success = localOnlyWrite();
    return {
      success,
      mode: 'local-only',
      queued: false,
      recoveryBlocked: false,
      ...(success ? {} : { error: 'تعذر حفظ البيانات محلياً.' })
    };
  }

  const journal = options.journal ?? new IndexedDbSyncJournal();
  const ownsJournal = !options.journal;
  let queued = false;
  let preflightPassed = false;
  try {
    // Drain older committed events first. If recovery is blocked, do not append
    // a newer full snapshot that may have been derived from stale local state.
    if (options.runExclusive) await replayJournalProjection(journal, options.runExclusive);
    else await replayJournalProjection(journal);
    preflightPassed = true;

    await journal.enqueue({ ...input, mutationId: createSecureId() });
    queued = true;
    if (options.runExclusive) await replayJournalProjection(journal, options.runExclusive);
    else await replayJournalProjection(journal);
    return { success: true, mode: 'journal', queued: true, recoveryBlocked: false };
  } catch (error) {
    return {
      success: false,
      mode: 'journal',
      queued,
      recoveryBlocked: !preflightPassed || queued,
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
