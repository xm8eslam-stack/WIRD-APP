import {
  doc,
  getDoc,
  runTransaction,
  type Firestore
} from 'firebase/firestore';
import type { SyncCollection, SyncOperation } from './localSyncOutbox';

export interface RevisionedRemoteMutation {
  uid: string;
  collection: SyncCollection;
  documentId: string;
  operation: SyncOperation;
  schemaVersion: 1;
  mutationId: string;
  eventId: string;
  deviceId: string;
  clientUpdatedAtMs: number;
  baseRevision: number;
  payload: Record<string, unknown>;
}

export interface RevisionedRemoteMutationResult {
  status: 'written' | 'already_applied';
  revision: number;
  serverSequence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (isRecord(value)) {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + stableStringify(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function validId(value: string, max = 128): boolean {
  return value.length > 0 && value.length <= max && !/[\u0000-\u001f/]/.test(value);
}
function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 'permission-denied' ||
    (typeof candidate.message === 'string' && /PERMISSION_DENIED|permission-denied/i.test(candidate.message));
}

/**
 * Atomically appends a routed immutable event, advances the user's global
 * server sequence, and updates one state document using optimistic concurrency.
 * Retries are idempotent; stale revisions never overwrite newer state.
 */
export async function writeRevisionedRemoteMutation(
  firestore: Firestore,
  input: RevisionedRemoteMutation
): Promise<RevisionedRemoteMutationResult> {
  const payloadBytes = new TextEncoder().encode(stableStringify(input.payload)).byteLength;
  if (!validId(input.uid) || !validId(input.documentId, 1500) ||
      !validId(input.mutationId) || !validId(input.eventId) || input.eventId !== input.mutationId ||
      !validId(input.deviceId) || input.schemaVersion !== 1 ||
      !['profile', 'plans', 'enginePlans', 'portions', 'weakVerses', 'tests', 'activityEvents', 'ruqyahProgress', 'syncMeta'].includes(input.collection) ||
      (input.collection === 'syncMeta' && input.documentId === 'remoteReplication') ||
      (input.operation !== 'upsert' && input.operation !== 'tombstone') ||
      !Number.isSafeInteger(input.clientUpdatedAtMs) || input.clientUpdatedAtMs < 0 ||
      !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0 || input.baseRevision >= Number.MAX_SAFE_INTEGER ||
      !isRecord(input.payload) || payloadBytes > 128_000) {
    throw new Error('INVALID_REVISIONED_MUTATION');
  }

  const stateRef = doc(firestore, 'users', input.uid, input.collection, input.documentId);
  const eventRef = doc(firestore, 'users', input.uid, 'events', input.eventId);
  const sequenceRef = doc(firestore, 'users', input.uid, 'syncSystem', 'remoteReplication');
  const nextRevision = input.baseRevision + 1;
  const eventBaseRecord = {
    schemaVersion: 2,
    eventId: input.eventId,
    mutationId: input.mutationId,
    uid: input.uid,
    deviceId: input.deviceId,
    occurredAtMs: input.clientUpdatedAtMs,
    eventType: 'domain-mutation',
    payload: input.payload,
    collection: input.collection,
    documentId: input.documentId,
    operation: input.operation,
    baseRevision: input.baseRevision,
    revision: nextRevision
  };

  let lastObservedServerSequence: number | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await runTransaction(firestore, async transaction => {
    const [stateSnapshot, eventSnapshot, sequenceSnapshot] = await Promise.all([
      transaction.get(stateRef),
      transaction.get(eventRef),
      transaction.get(sequenceRef)
    ]);

    if (eventSnapshot.exists()) {
      const existingEvent = eventSnapshot.data();
      const { serverSequence: _serverSequence, ...existingEventBase } = existingEvent;
      if (stableStringify(existingEventBase) !== stableStringify(eventBaseRecord) ||
          !Number.isSafeInteger(existingEvent.serverSequence) || existingEvent.serverSequence < 1) {
        throw new Error('REMOTE_EVENT_ID_COLLISION');
      }
      if (stateSnapshot.exists()) {
        const current = stateSnapshot.data();
        if (current.mutationId === input.mutationId &&
            current.revision === nextRevision &&
            current.baseRevision === input.baseRevision &&
            stableStringify(current.payload) === stableStringify(input.payload) &&
            current.deviceId === input.deviceId &&
            current.updatedAtMs === input.clientUpdatedAtMs) {
          return {
            status: 'already_applied',
            revision: nextRevision,
            serverSequence: existingEvent.serverSequence
          };
        }
      }
      throw new Error('REMOTE_REVISION_CONFLICT');
    }

    if (stateSnapshot.exists()) {
      const current = stateSnapshot.data();
      if (!Number.isSafeInteger(current.revision) || current.revision !== input.baseRevision) {
        throw new Error('REMOTE_REVISION_CONFLICT');
      }
    } else if (input.baseRevision !== 0) {
      throw new Error('REMOTE_REVISION_CONFLICT');
    }

    const currentServerSequence = sequenceSnapshot.exists()
      ? sequenceSnapshot.data().sequence
      : 0;
    if (!Number.isSafeInteger(currentServerSequence) || currentServerSequence < 0 ||
        currentServerSequence >= Number.MAX_SAFE_INTEGER) {
      throw new Error('REMOTE_SEQUENCE_CONFLICT');
    }
    lastObservedServerSequence = currentServerSequence;
    const serverSequence = currentServerSequence + 1;

    const stateRecord: Record<string, unknown> = {
      schemaVersion: input.schemaVersion,
      payload: input.payload,
      updatedAtMs: input.clientUpdatedAtMs,
      deviceId: input.deviceId,
      mutationId: input.mutationId,
      baseRevision: input.baseRevision,
      revision: nextRevision
    };
    if (input.operation === 'tombstone') {
      stateRecord.deletedAt = new Date(input.clientUpdatedAtMs);
    }

    const eventRecord = { ...eventBaseRecord, serverSequence };
    const sequenceRecord = {
      schemaVersion: 1,
      sequence: serverSequence,
      baseSequence: currentServerSequence,
      lastEventId: input.eventId,
      updatedAtMs: input.clientUpdatedAtMs,
      deviceId: input.deviceId,
      mutationId: input.mutationId
    };

    transaction.set(eventRef, eventRecord);
    transaction.set(stateRef, stateRecord);
    transaction.set(sequenceRef, sequenceRecord);
    return { status: 'written', revision: nextRevision, serverSequence };
      });
    } catch (error) {
      if (!isPermissionDenied(error) || lastObservedServerSequence === null || attempt === 2) {
        throw error;
      }
      // Concurrent writes to different documents contend on the per-user
      // sequence allocator. Retry only when another committed transaction
      // demonstrably advanced that allocator; never retry a static rules denial.
      const latestSequenceSnapshot = await getDoc(sequenceRef);
      const latestSequence = latestSequenceSnapshot.exists()
        ? latestSequenceSnapshot.data().sequence
        : 0;
      if (!Number.isSafeInteger(latestSequence) || latestSequence <= lastObservedServerSequence) {
        throw error;
      }
    }
  }
  throw new Error('REMOTE_SEQUENCE_CONTENTION_RETRY_EXHAUSTED');
}
