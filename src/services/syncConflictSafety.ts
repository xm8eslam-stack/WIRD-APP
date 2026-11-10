export interface ConflictProjectionDescriptor {
  collection: string;
  payload: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const UNSAFE_FULL_SNAPSHOT_COLLECTIONS = new Set(['weakVerses', 'activityEvents']);

/**
 * These collections still use full snapshots without collection-specific
 * merge/tombstone semantics. Choosing either whole remote or whole local for
 * a blocked conflict can silently discard independent device changes.
 */
export function containsUnsafeFullSnapshotProjection(
  event: ConflictProjectionDescriptor
): boolean {
  if (UNSAFE_FULL_SNAPSHOT_COLLECTIONS.has(event.collection)) return true;
  if (event.collection !== 'syncMeta' || !isRecord(event.payload) ||
      event.payload.transaction === undefined) return false;

  const transaction = event.payload.transaction;
  if (!isRecord(transaction) || transaction.version !== 1 ||
      !Array.isArray(transaction.operations) ||
      transaction.operations.length < 1 || transaction.operations.length > 8) {
    return true;
  }

  for (const operation of transaction.operations) {
    if (!isRecord(operation) || typeof operation.collection !== 'string' ||
        operation.collection === 'syncMeta') return true;
    if (UNSAFE_FULL_SNAPSHOT_COLLECTIONS.has(operation.collection)) return true;
  }
  return false;
}
