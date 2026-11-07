import { LocalSyncOutbox } from './localSyncOutbox';
import { StorageService } from './storageService';
import type { JournalEvent, RemoteInboxEvent } from './indexedDbSyncJournal';

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
  remoteCollectionInitialized: boolean;
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
      (state.localProjectionEmpty || state.remoteCollectionInitialized)) {
    return 'apply';
  }
  return 'blocked_base_revision';
}

export interface RemoteProjectionBatchResult {
  projectedCount: number;
  blockedAtSequence: number | null;
  reason: RemoteProjectionDecision | 'projection_failed' | null;
}

/**
 * Apply remote events in server order. A conflict leaves the event in the
 * durable inbox and does not advance the projection cursor, preserving both
 * local and remote bytes until an explicit reconciliation path exists.
 */
export async function projectRemoteInboxBatch(limit: number = 100): Promise<RemoteProjectionBatchResult> {
  const cursor = await LocalSyncOutbox.getRemoteProjectionCursor();
  const events = await LocalSyncOutbox.listRemoteInboxAfter(cursor, limit);
  let projectedCount = 0;

  for (const remoteEvent of events) {
    const cached = await LocalSyncOutbox.getRemoteRevision(
      remoteEvent.collection,
      remoteEvent.documentId
    );
    let hasPendingLocalMutation = await LocalSyncOutbox.hasPendingForCollection(remoteEvent.collection);
    const remoteCollectionInitialized = await LocalSyncOutbox.isRemoteCollectionInitialized(remoteEvent.collection);
    let localProjectionEmpty = StorageService.isLocalProjectionEmpty(remoteEvent.collection);
    let transactionCollections: string[] = [];
    if (remoteEvent.collection === 'syncMeta' && remoteEvent.payload.transaction &&
        typeof remoteEvent.payload.transaction === 'object' &&
        Array.isArray((remoteEvent.payload.transaction as { operations?: unknown }).operations)) {
      const operations = (remoteEvent.payload.transaction as { operations: Array<{ collection?: unknown }> }).operations;
      transactionCollections = operations
        .map(operation => operation.collection)
        .filter((value): value is string => typeof value === 'string');
      localProjectionEmpty = true;
      for (const collectionName of transactionCollections) {
        const collection = collectionName as RemoteInboxEvent['collection'];
        const initialized = await LocalSyncOutbox.isRemoteCollectionInitialized(collection);
        if (await LocalSyncOutbox.hasPendingForCollection(collection)) {
          hasPendingLocalMutation = true;
        }
        if (!StorageService.isLocalProjectionEmpty(collection) && !initialized) {
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
      await LocalSyncOutbox.markRemoteProjected(remoteEvent.serverSequence);
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

    if (!StorageService.applyJournalEvent(localEvent)) {
      return {
        projectedCount,
        blockedAtSequence: remoteEvent.serverSequence,
        reason: 'projection_failed'
      };
    }

    const revisionSaved = await LocalSyncOutbox.setRemoteRevisionFromRemote(
      remoteEvent.collection,
      remoteEvent.documentId,
      remoteEvent.revision
    );
    if (!revisionSaved) {
      const latest = await LocalSyncOutbox.getRemoteRevision(
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
      for (const collectionName of transactionCollections) {
        await LocalSyncOutbox.markRemoteCollectionInitialized(collectionName as RemoteInboxEvent['collection']);
      }
    }
    await LocalSyncOutbox.markRemoteProjected(remoteEvent.serverSequence);
    projectedCount++;
  }

  return { projectedCount, blockedAtSequence: null, reason: null };
}
