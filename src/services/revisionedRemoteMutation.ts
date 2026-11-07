import {
  doc,
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

/**
 * Atomically appends the immutable event and advances one document snapshot
 * with optimistic concurrency. A retry of the exact same mutation is safe;
 * a stale base revision or reused event ID with different content is rejected.
 */
export async function writeRevisionedRemoteMutation(
  firestore: Firestore,
  input: RevisionedRemoteMutation
): Promise<RevisionedRemoteMutationResult> {
  const payloadBytes = new TextEncoder().encode(stableStringify(input.payload)).byteLength;
  if (!validId(input.uid) || !validId(input.documentId, 1500) ||
      !validId(input.mutationId) || !validId(input.eventId) ||
      !validId(input.deviceId) || input.schemaVersion !== 1 ||
      !['profile', 'plans', 'enginePlans', 'portions', 'weakVerses', 'tests', 'activityEvents', 'syncMeta'].includes(input.collection) ||
      (input.operation !== 'upsert' && input.operation !== 'tombstone') ||
      !Number.isSafeInteger(input.clientUpdatedAtMs) || input.clientUpdatedAtMs < 0 ||
      !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0 ||
      !isRecord(input.payload) || payloadBytes > 128_000) {
    throw new Error('INVALID_REVISIONED_MUTATION');
  }

  const stateRef = doc(firestore, 'users', input.uid, input.collection, input.documentId);
  const eventRef = doc(firestore, 'users', input.uid, 'events', input.eventId);
  const eventRecord = {
    schemaVersion: 1,
    eventId: input.eventId,
    mutationId: input.mutationId,
    uid: input.uid,
    deviceId: input.deviceId,
    occurredAtMs: input.clientUpdatedAtMs,
    eventType: 'domain-mutation',
    payload: input.payload
  };
  const expectedEvent = stableStringify(eventRecord);
  const nextRevision = input.baseRevision + 1;

  return runTransaction(firestore, async transaction => {
    const [stateSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(stateRef),
      transaction.get(eventRef)
    ]);

    if (eventSnapshot.exists() && stableStringify(eventSnapshot.data()) !== expectedEvent) {
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
        if (!eventSnapshot.exists()) transaction.set(eventRef, eventRecord);
        return { status: 'already_applied', revision: nextRevision };
      }
      if (!Number.isSafeInteger(current.revision) || current.revision !== input.baseRevision) {
        throw new Error('REMOTE_REVISION_CONFLICT');
      }
    } else if (input.baseRevision !== 0) {
      throw new Error('REMOTE_REVISION_CONFLICT');
    }

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

    if (!eventSnapshot.exists()) transaction.set(eventRef, eventRecord);
    transaction.set(stateRef, stateRecord);
    return { status: 'written', revision: nextRevision };
  });
}
