/**
 * Keep payload limits consistent from the durable local journal through the
 * revisioned Firestore writer. Firestore documents are limited to 1 MiB; the
 * engine-plan budget deliberately leaves headroom for the event/state envelope.
 */
export const MAX_SYNC_MUTATION_PAYLOAD_BYTES = 128_000;
export const MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES = 800_000;

export function getSyncMutationPayloadLimit(
  collection: string,
  payload?: Record<string, unknown>
): number {
  if (collection === 'enginePlans') return MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES;
  if (collection === 'syncMeta') {
    const transaction = payload?.transaction;
    if (transaction && typeof transaction === 'object' && !Array.isArray(transaction)) {
      const operations = (transaction as Record<string, unknown>).operations;
      if (Array.isArray(operations) && operations.some(operation =>
        operation && typeof operation === 'object' && !Array.isArray(operation) &&
        (operation as Record<string, unknown>).collection === 'enginePlans'
      )) return MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES;
    }
  }
  return MAX_SYNC_MUTATION_PAYLOAD_BYTES;
}
