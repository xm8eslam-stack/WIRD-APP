import { LocalSyncOutbox, type SyncCollection } from './localSyncOutbox';
import { StorageService } from './storageService';
import type {
  JournalEvent,
  RemoteInboxEvent,
  RemoteRevisionSnapshot,
  RemoteProjectionIntent
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
  reason: Exclude<RemoteProjectionDecision, 'apply' | 'already_applied'> | 'projection_failed' | null;
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
  getLocalProjectionSnapshot(collection: SyncCollection): Record<string, string | null>;
  saveProjectionConflict(
    event: RemoteInboxEvent,
    reason: string,
    localSnapshot: Record<string, string | null>
  ): Promise<boolean>;
  getRemoteProjectionIntent(): Promise<RemoteProjectionIntent | null>;
  prepareRemoteProjection(intent: RemoteProjectionIntent): Promise<boolean>;
  finalizeRemoteProjection(intent: RemoteProjectionIntent, applyProjection: () => boolean): Promise<boolean>;
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
  markRemoteCollectionInitialized: collection => LocalSyncOutbox.markRemoteCollectionInitialized(collection),
  getLocalProjectionSnapshot: collection => StorageService.getLocalProjectionSnapshot(collection),
  saveProjectionConflict: (event, reason, localSnapshot) =>
    LocalSyncOutbox.saveProjectionConflict(event, reason, localSnapshot),
  getRemoteProjectionIntent: () => LocalSyncOutbox.getRemoteProjectionIntent(),
  prepareRemoteProjection: intent => LocalSyncOutbox.prepareRemoteProjection(intent),
  finalizeRemoteProjection: (intent, applyProjection) =>
    LocalSyncOutbox.finalizeRemoteProjection(intent, applyProjection)
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function captureLocalProjectionSnapshot(
  event: RemoteInboxEvent,
  transactionCollections: SyncCollection[],
  dependencies: RemoteProjectionDependencies
): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {};
  for (const collection of new Set<SyncCollection>([event.collection, ...transactionCollections])) {
    Object.assign(snapshot, dependencies.getLocalProjectionSnapshot(collection));
  }
  return snapshot;
}

async function archiveBlockedProjection(
  event: RemoteInboxEvent,
  reason: string,
  transactionCollections: SyncCollection[],
  dependencies: RemoteProjectionDependencies,
  snapshot?: Record<string, string | null>
): Promise<boolean> {
  return dependencies.saveProjectionConflict(
    event,
    reason,
    snapshot || captureLocalProjectionSnapshot(event, transactionCollections, dependencies)
  );
}

function readTransactionCollections(event: RemoteInboxEvent): SyncCollection[] {
  if (event.collection !== 'syncMeta' || !isRecord(event.payload.transaction) ||
      !Array.isArray(event.payload.transaction.operations)) return [];
  const allowed = new Set<SyncCollection>([
    'profile', 'plans', 'enginePlans', 'portions',
    'weakVerses', 'tests', 'activityEvents', 'ruqyahProgress', 'syncMeta'
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

    const intent = await dependencies.getRemoteProjectionIntent();
    const isResumingThisProjection = !!intent &&
      intent.sequence === remoteEvent.serverSequence &&
      intent.eventId === remoteEvent.eventId &&
      intent.collection === remoteEvent.collection &&
      intent.documentId === remoteEvent.documentId &&
      intent.revision === remoteEvent.revision;
    if (intent && !isResumingThisProjection) {
      await archiveBlockedProjection(remoteEvent, 'projection_failed', transactionCollections, dependencies);
      if (await dependencies.getRemoteProjectionCursor() >= remoteEvent.serverSequence) {
        projectedCount++;
        continue;
      }
      return {
        projectedCount,
        blockedAtSequence: remoteEvent.serverSequence,
        reason: 'projection_failed'
      };
    }

    const decision = isResumingThisProjection
      ? (hasPendingLocalMutation
          ? 'blocked_pending_local'
          : remoteEvent.operation === 'tombstone'
            ? 'blocked_tombstone'
            : cached?.revision !== undefined && cached.revision !== null && cached.revision >= remoteEvent.revision
              ? 'already_applied'
              : 'apply')
      : decideRemoteProjection(remoteEvent, {
          cachedRevision: cached?.revision ?? null,
          hasPendingLocalMutation,
          localProjectionEmpty,
          remoteCollectionInitialized
        });

    if (decision === 'already_applied') {
      if (isResumingThisProjection && intent) {
        const finalized = await dependencies.finalizeRemoteProjection(intent, () => true);
        if (!finalized) {
          await archiveBlockedProjection(remoteEvent, 'projection_failed', transactionCollections, dependencies);
          if (await dependencies.getRemoteProjectionCursor() >= remoteEvent.serverSequence) {
            projectedCount++;
            continue;
          }
          return {
            projectedCount,
            blockedAtSequence: remoteEvent.serverSequence,
            reason: 'projection_failed'
          };
        }
      } else {
        const marked = await dependencies.markRemoteProjected(remoteEvent.serverSequence);
        if (!marked) {
          await archiveBlockedProjection(remoteEvent, 'projection_failed', transactionCollections, dependencies);
          if (await dependencies.getRemoteProjectionCursor() >= remoteEvent.serverSequence) {
            projectedCount++;
            continue;
          }
          return {
            projectedCount,
            blockedAtSequence: remoteEvent.serverSequence,
            reason: 'projection_failed'
          };
        }
      }
      projectedCount++;
      continue;
    }
    if (decision !== 'apply') {
      const archived = await archiveBlockedProjection(
        remoteEvent,
        decision,
        transactionCollections,
        dependencies
      );
      if (await dependencies.getRemoteProjectionCursor() >= remoteEvent.serverSequence) {
        projectedCount++;
        continue;
      }
      return {
        projectedCount,
        blockedAtSequence: remoteEvent.serverSequence,
        reason: archived ? decision : 'projection_failed'
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

    const projectionIntent: RemoteProjectionIntent = {
      sequence: remoteEvent.serverSequence,
      eventId: remoteEvent.eventId,
      collection: remoteEvent.collection,
      documentId: remoteEvent.documentId,
      revision: remoteEvent.revision,
      initializedCollections: transactionCollections
    };
    const preProjectionSnapshot = captureLocalProjectionSnapshot(
      remoteEvent,
      transactionCollections,
      dependencies
    );
    const prepared = await dependencies.prepareRemoteProjection(projectionIntent);
    if (!prepared) {
      await archiveBlockedProjection(
        remoteEvent,
        'projection_failed',
        transactionCollections,
        dependencies,
        preProjectionSnapshot
      );
      if (await dependencies.getRemoteProjectionCursor() >= remoteEvent.serverSequence) {
        projectedCount++;
        continue;
      }
      return {
        projectedCount,
        blockedAtSequence: remoteEvent.serverSequence,
        reason: 'projection_failed'
      };
    }

    // The actual storage write runs synchronously inside the journal's
    // finalization transaction. This serializes it against competing tabs
    // and local outbox writes; a crash leaves the durable intent recoverable.
    const finalized = await dependencies.finalizeRemoteProjection(
      projectionIntent,
      () => dependencies.applyJournalEvent(localEvent)
    );
    if (!finalized) {
      await archiveBlockedProjection(
        remoteEvent,
        'projection_failed',
        transactionCollections,
        dependencies,
        preProjectionSnapshot
      );
      if (await dependencies.getRemoteProjectionCursor() >= remoteEvent.serverSequence) {
        projectedCount++;
        continue;
      }
      return {
        projectedCount,
        blockedAtSequence: remoteEvent.serverSequence,
        reason: 'projection_failed'
      };
    }

    projectedCount++;
  }

  return { projectedCount, blockedAtSequence: null, reason: null };
}
