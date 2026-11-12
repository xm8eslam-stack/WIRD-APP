import type { Firestore } from 'firebase/firestore';
import { getSyncMutationPayloadLimit, MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES, MAX_SYNC_MUTATION_PAYLOAD_BYTES } from './syncPayloadLimits';
import { writeRevisionedRemoteMutation } from './revisionedRemoteMutation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runSyncPayloadLimitTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const run = async (name: string, test: () => void | Promise<void>) => {
    try { await test(); passed++; }
    catch (error) { failed++; console.error('[Sync payload limits]', name, error); }
  };

  await run('Engine-plan payload budget is shared and remains below Firestore document ceiling', () => {
    assert(MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES === 800_000, 'Engine-plan budget must be the reviewed 800 KB cap');
    assert(MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES < 1_048_576, 'Engine-plan payload must leave headroom below the 1 MiB Firestore document limit');
    assert(getSyncMutationPayloadLimit('enginePlans') === MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES, 'Engine-plan collection must use the dedicated budget');
  });

  await run('Grouped session transactions inherit the engine-plan budget only when they contain an engine plan', () => {
    assert(getSyncMutationPayloadLimit('syncMeta', {
      transaction: { version: 1, operations: [{ collection: 'enginePlans', documentId: 'snapshot', payload: { records: [] } }] }
    }) === MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES, 'Grouped engine-plan transaction must use the plan budget');
    assert(getSyncMutationPayloadLimit('syncMeta', {
      transaction: { version: 1, operations: [{ collection: 'plans', documentId: 'snapshot', payload: { records: [] } }] }
    }) === MAX_SYNC_MUTATION_PAYLOAD_BYTES, 'Other grouped transactions must keep the ordinary budget');
    assert(getSyncMutationPayloadLimit('plans') === MAX_SYNC_MUTATION_PAYLOAD_BYTES, 'Ordinary collections must keep the 128 KB budget');
  });

  await run('Revisioned Firestore writer rejects an oversized engine plan before attempting network I/O', async () => {
    let errorMessage = '';
    try {
      await writeRevisionedRemoteMutation({} as Firestore, {
        uid: 'test-user',
        collection: 'enginePlans',
        documentId: 'snapshot',
        operation: 'upsert',
        schemaVersion: 1,
        mutationId: 'oversized-engine-plan',
        eventId: 'oversized-engine-plan',
        deviceId: 'test-device',
        clientUpdatedAtMs: 1,
        baseRevision: 0,
        payload: { records: [{ data: 'x'.repeat(MAX_ENGINE_PLAN_SYNC_PAYLOAD_BYTES + 1) }] }
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    assert(errorMessage === 'INVALID_REVISIONED_MUTATION', 'Remote writer must enforce the same payload budget before Firestore transaction creation');
  });

  return { passed, failed };
}
