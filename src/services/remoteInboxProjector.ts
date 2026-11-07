import { LocalSyncOutbox, type SyncCollection } from './localSyncOutbox';
import { StorageService } from './storageService';
import type {
  JournalEvent,
  RemoteInboxEvent,
  RemoteRevisionSnapshot
} from './indexedDbSyncJournal';

export type RemoteProjectionDecision =
  | 'apply'
  | 'already_applied'
  | 'blocked_pending_local'
  | 'blocked_base_revision'
  | 'blocked_tombstone';

export interface RemoteProjectionState {
  cachedRevision: number | null;
  hasPendingLocalMutation: boolean;
  localProjectionEmpty: boolean;
  remoteCollectionInitialized?: boolean;
}

/** Pure conflict gate: never replace unknown local state or a pending local mutation. */
export function decideRemoteProjection(
  event: Pick<RemoteInboxEvent, 'baseRevision' | 'revision' | 'operation'>,
  state: RemoteProjectionState
): RemoteProjectionDecision {
  if (state.cachedRevision !== null && state.cachedRevision >= event.revision) {
    return 'already_applied';
  }
  if (state.hasPendingLocalMutation) return 'blocked_pending_local';
  if (event.operation === 'tombstone') return 'blocked_tombstone';
  if (state.cachedRevision !== null && state.cachedRevision === event.baseRevision) {
    return 'apply';
  }
  if (state.cachedRevision === null && event.baseRevision === 0 &&
      (state.localProjectionEmpty || state.remoteCollectionInitialized === true)) {
    return 'apply';
  }
  return 'blocked_base_revision';
}

export interface RemoteProjectionBatchResult {
  projectedCount: number;
  blockedAtSequence: number | null;
  reason: RemoteProjectionDecision | 'projection_failed' | null;
}

export interface RemoteProjectionDependencies {
  getRemoteProjectionCursor(): Promise<number>;
  listRemoteInboxAfter(sequence: number, limit: number): Promise<RemoteInboxEvent[]>;
  getRemoteRevision(collection: SyncCollection, documentId: string): Promise<RemoteRevisionSnapshot | null>;
  hasPendingForCollection(collection: SyncCollection): Promise<boolean>;
  isRemoteCollectionInitialized(collection: SyncCollection): Promise<boolean>;
  isLocalProjectionEmpty(collection: SyncCollection): boolean;
  applyJournalEvent(event: JournalEvent): boolean;
  setRemoteRevisionFromRemote(collection: SyncCollection, documentId: string, revision: number): Promise<boolean>;
  markRemoteProjected(sequence: number): Promise<boolean>;
  markRemoteCollectionInitialized(collection: SyncCollection): Promise<boolean>;
}

const defaultDependencies: RemoteProjectionDependencies = {
  getRemoteProjectionCursor: () => LocalSyncOutbox.getRemoteProjectionCursor(),
  listRemoteInboxAfter: (sequence, limit) => LocalSyncOutbox.listRemoteInboxAfter(sequence, limit),
  getRemoteRevision: (collection, documentId) => LocalSyncOutbox.getRemoteRevision(collection, documentId),
  hasPendingForCollection: collection => LocalSyncOutbox.hasPendingForCollection(collection),
  isRemoteCollectionInitialized: collection => LocalSyncOutbox.isRemoteCollectionInitialized(collection),
  isLocalProjectionEmpty: collection => StorageService.isLocalProjectionEmpty(collection),
  applyJournalEvent: event => StorageService.applyJournalEvent(event),
  setRemoteRevisionFromRemote: (collection, documentId, revision) =>
    LocalSyncOutbox.setRemoteRevisionFromRemote(collection, documentId, revision),
  markRemoteProjected: sequence => LocalSyncOutbox.markRemoteProjected(sequence),
  markRemoteCollectionInitialized: collection => LocalSyncOutbox.markRemoteCollectionInitialized(collection)
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTransactionCollections(event: RemoteInboxEvent): SyncCollection[] {
  if (event.collection !== 'syncMeta' || !isRecord(event.payload.transaction) ||
      !Array.isArray(event.payload.transaction.operations)) return [];
  const allowed = new Set<SyncCollection>([
    'profile', 'plans', 'enginePlans', 'portions',
    'weakVerses', 'tests', 'activityEvents', 'syncMeta'
  ]);
  const collections = new Set<SyncCollection>();
  for (const operation of event.payload.transaction.operations) {
    if (!isRecord(operation) || typeof operation.collection !== 'string' ||
        !allowed.has(operation.collection as SyncCollection)) {
      throw new Error('REMOTE_TRANSACTION_COLLECTION_INVALID');
    }
    collections.add(operation.collection as SyncCollection);
  }
  return [...collections];
}

/**
 * Apply remote events in server order. A conflict leaves the event in the
 * durable inbox and does not advance the projection cursor, preserving both
 * local and remote bytes until an explicit reconciliation path exists.
 *
 * Dependencies are injectable so the conflict policy and cursor behavior can
 * be tested without a live Firebase account.
 */
export async function projectRemoteInboxBatch(
  limit: number = 100,
  dependencies: RemoteProjectionDependencies = defaultDependencies
): Promise<RemoteProjectionBatchResult> {
  const cursor = await dependencies.getRemoteProjectionCursor();
  const events = await dependencies.listRemoteInboxAfter(cursor, limit);
  let projectedCount = 0;

  for (const remoteEvent of events) {
    const cached = await dependencies.getRemoteRevision(
      remoteEvent.collection,
      remoteEvent.documentId
    );
    let hasPendingLocalMutation = await dependencies.hasPendingForCollection(remoteEvent.collection);
    const remoteCollectionInitialized = await dependencies.isRemoteCollectionInitialized(remoteEvent.collection);
    let localProjectionEmpty = dependencies.isLocalProjectionEmpty(remoteEvent.collection);
    const transactionCollections = readTransactionCollections(remoteEvent);

    if (remoteEvent.collection === 'syncMeta' && transactionCollections.length > 0) {
      localProjectionEmpty = true;
      for (const collection of transactionCollections) {
        const initialized = await dependencies.isRemoteCollectionInitialized(collection);
        if (await dependencies.hasPendingForCollection(collection)) {
          hasPendingLocalMutation = true;
        }
        if (!dependencies.isLocalProjectionEmpty(collection) && !initialized) {
          localProjectionEmpty = false;
        }
      }
    }

    const decision = decideRemoteProjection(remoteEvent, {
      cachedRevision: cached?.revision ?? null,
      hasPendingLocalMutation,
      localProjectionEmpty,
      remoteCollectionInitialized
    });

    if (decision === 'already_applied') {
      await dependencies.markRemoteProjected(remoteEvent.serverSequence);
      projectedCount++;
      continue;
    }
    if (decision !== 'apply') {
      return {
        projectedCount,
        blockedAtSequence: remoteEvent.serverSequence,
        reason: decision
      };
    }

    const localEvent: JournalEvent = {
      key: remoteEvent.uid + ':' + remoteEvent.eventId,
      uid: remoteEvent.uid,
      eventId: remoteEvent.eventId,
      mutationId: remoteEvent.mutationId,
      eventType: 'domain-mutation',
      collection: remoteEvent.collection,
      documentId: remoteEvent.documentId,
      operation: 'upsert',
      schemaVersion: 1,
      clientUpdatedAtMs: remoteEvent.occurredAtMs,
      createdAtMs: remoteEvent.occurredAtMs,
      deviceId: remoteEvent.deviceId,
      payload: remoteEvent.payload,
      fingerprint: remoteEvent.fingerprint,
      sequence: remoteEvent.serverSequence,
      baseRevision: remoteEvent.baseRevision,
      projectionRequired: true
    };

    if (!dependencies.applyJournalEvent(localEvent)) {
      return {
        projectedCount,
        blockedAtSequence: remoteEvent.serverSequence,
        reason: 'projection_failed'
      };
    }

    const revisionSaved = await dependencies.setRemoteRevisionFromRemote(
      remoteEvent.collection,
      remoteEvent.documentId,
      remoteEvent.revision
    );
    if (!revisionSaved) {
      const latest = await dependencies.getRemoteRevision(
        remoteEvent.collection,
        remoteEvent.documentId
      );
      if (!latest || latest.revision < remoteEvent.revision) {
        return {
          projectedCount,
          blockedAtSequence: remoteEvent.serverSequence,
          reason: 'projection_failed'
        };
      }
    }

    if (remoteEvent.collection === 'syncMeta') {
      for (const collection of transactionCollections) {
        await dependencies.markRemoteCollectionInitialized(collection);
      }
    }
    await dependencies.markRemoteProjected(remoteEvent.serverSequence);
    projectedCount++;
  }

  return { projectedCount, blockedAtSequence: null, reason: null };
}
