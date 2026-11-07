import {
  doc,
  runTransaction,
  type Firestore
} from 'firebase/firestore';

export interface ImmutableRemoteDomainEvent {
  schemaVersion: 1;
  eventId: string;
  mutationId: string;
  uid: string;
  deviceId: string;
  occurredAtMs: number;
  eventType: string;
  payload: Record<string, unknown>;
}

export type ImmutableEventWriteResult = 'created' | 'already_exists';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Canonical JSON representation for comparing immutable Firestore event payloads. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (isRecord(value)) {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + stableStringify(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Creates an immutable per-user event exactly once.
 *
 * A retry with byte-for-byte equivalent semantic content is accepted as an
 * idempotent success. Reusing an event ID for different content is rejected.
 * The transaction reads before writing, so concurrent identical retries
 * converge on one create; Firestore retries a transaction that loses the race.
 */
export async function writeImmutableRemoteEvent(
  firestore: Firestore,
  uid: string,
  event: ImmutableRemoteDomainEvent
): Promise<ImmutableEventWriteResult> {
  const validPathId = (value: string): boolean =>
    value.length > 0 && value.length <= 128 && !/[\u0000-\u001f/]/.test(value);
  const payloadBytes = new TextEncoder().encode(stableStringify(event.payload)).byteLength;
  if (!validPathId(uid) || event.uid !== uid || !validPathId(event.eventId) ||
      !validPathId(event.mutationId) || event.schemaVersion !== 1 ||
      !validPathId(event.deviceId) || !Number.isSafeInteger(event.occurredAtMs) ||
      event.occurredAtMs < 0 || typeof event.eventType !== 'string' ||
      event.eventType.length === 0 || event.eventType.length > 64 ||
      !isRecord(event.payload) || payloadBytes > 128_000) {
    throw new Error('INVALID_REMOTE_EVENT');
  }

  const eventRef = doc(firestore, 'users', uid, 'events', event.eventId);
  const expected = stableStringify(event);

  return runTransaction(firestore, async transaction => {
    const existing = await transaction.get(eventRef);
    if (existing.exists()) {
      if (stableStringify(existing.data()) !== expected) {
        throw new Error('REMOTE_EVENT_ID_COLLISION');
      }
      return 'already_exists';
    }

    transaction.set(eventRef, event);
    return 'created';
  });
}
