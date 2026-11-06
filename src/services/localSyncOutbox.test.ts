import { LocalSyncOutbox } from './localSyncOutbox';
import { StorageService, STORAGE_KEYS } from './storageService';

export function runLocalSyncOutboxTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const reset = () => StorageService.__resetStorageForTests();

  try {
    test('Guests cannot create cloud-sync mutations', () => {
      reset();
      StorageService.setStorageScope('guest');
      let rejected = false;
      try {
        LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'event-1', payload: { type: 'session' } });
      } catch { rejected = true; }
      assert(rejected, 'Guest mode must remain local-only');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === null, 'Guest mode must not create an outbox');
    });

    test('Enqueue is idempotent for the same mutation ID', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      const input = { mutationId: 'mutation-session-1', collection: 'activityEvents' as const, documentId: 'event-1', payload: { type: 'session', ayahs: 7 }, nowMs: 1000 };
      const first = LocalSyncOutbox.enqueue(input);
      const second = LocalSyncOutbox.enqueue(input);
      assert(first.status === 'queued', 'First mutation must be queued');
      assert(second.status === 'already_pending', 'Repeated ID must reuse the pending mutation');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 1, 'Duplicate enqueue must not duplicate the queue');
    });

    test('A mutation ID collision with different data is rejected, never silently ignored', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      LocalSyncOutbox.enqueue({ mutationId: 'collision-id', collection: 'activityEvents', documentId: 'event-1', payload: { ayahs: 5 }, nowMs: 1100 });
      let rejected = false;
      try {
        LocalSyncOutbox.enqueue({ mutationId: 'collision-id', collection: 'activityEvents', documentId: 'event-1', payload: { ayahs: 8 }, nowMs: 1200 });
      } catch { rejected = true; }
      assert(rejected, 'Same ID with changed payload must be rejected');
      assert(LocalSyncOutbox.listReady(1300)[0].payload.ayahs === 5, 'Original queued payload must remain unchanged');
    });

    test('Outbox device identity is stable even before the first mutation', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      const first = LocalSyncOutbox.getSnapshot();
      const second = LocalSyncOutbox.getSnapshot();
      assert(first.deviceId === second.deviceId, 'Reading an empty outbox must persist its device identity');
    });

    test('Invalid payloads, operations, and oversized UTF-8 document IDs are rejected', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      let invalidPayload = false, invalidOperation = false, oversizedUtf8Id = false;
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'null-payload', payload: null as any }); } catch { invalidPayload = true; }
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'bad-operation', operation: 'delete' as any, payload: {} }); } catch { invalidOperation = true; }
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'é'.repeat(800), payload: {} }); } catch { oversizedUtf8Id = true; }
      assert(invalidPayload && invalidOperation && oversizedUtf8Id, 'Malformed values must be rejected before changing persistent state');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 0, 'Rejected inputs must not corrupt or enqueue into the outbox');
    });

    test('Acknowledged mutation IDs cannot be re-enqueued', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-1', payload: { title: 'خطة' }, nowMs: 2000 });
      assert(LocalSyncOutbox.acknowledge(['mutation-ack-1']) === 1, 'Confirmed mutation must be removed from pending');
      const duplicate = LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-1', payload: { title: 'خطة' }, nowMs: 3000 });
      assert(duplicate.status === 'already_acknowledged', 'An acknowledged ID must never become a new queue item');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 0, 'Acknowledged mutation must remain out of pending');
    });

    test('Acknowledged IDs reject changed payloads but accept an exact retry', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      const original = { mutationId: 'ack-fingerprint-1', collection: 'plans' as const, documentId: 'plan-1', payload: { title: 'خطة', count: 3 }, nowMs: 2500 };
      LocalSyncOutbox.enqueue(original);
      assert(LocalSyncOutbox.acknowledge(['ack-fingerprint-1']) === 1, 'Mutation should be acknowledged');
      const exactRetry = LocalSyncOutbox.enqueue({ ...original, payload: { count: 3, title: 'خطة' } });
      assert(exactRetry.status === 'already_acknowledged', 'Semantically identical payloads must remain idempotent regardless of object key order');
      let changedPayloadRejected = false;
      let changedDocumentRejected = false;
      try { LocalSyncOutbox.enqueue({ ...original, payload: { title: 'خطة', count: 4 } }); } catch { changedPayloadRejected = true; }
      try { LocalSyncOutbox.enqueue({ ...original, documentId: 'plan-2' }); } catch { changedDocumentRejected = true; }
      assert(changedPayloadRejected && changedDocumentRejected, 'Acknowledged ID reuse with changed business data must be rejected');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 0, 'Rejected reuse must not enqueue a second operation');
    });

    test('Legacy acknowledged IDs without fingerprints fail closed', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      const legacy = { schemaVersion: 1, deviceId: 'legacy-device', pending: [], acknowledgedIds: ['legacy-ack-id'] };
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, JSON.stringify(legacy));
      let rejected = false;
      try {
        LocalSyncOutbox.enqueue({ mutationId: 'legacy-ack-id', collection: 'plans', documentId: 'plan-1', payload: { title: 'new' } });
      } catch { rejected = true; }
      assert(rejected, 'Legacy acknowledgements without payload fingerprints must fail closed');
      assert(LocalSyncOutbox.getSnapshot().acknowledgedCount === 1, 'Legacy acknowledgement must remain preserved');
    });

    test('Duplicate pending IDs and pending/acknowledged overlap are rejected without rewriting storage', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      const mutation = {
        mutationId: 'duplicate-id', collection: 'plans', documentId: 'plan-1', operation: 'upsert',
        schemaVersion: 1, clientUpdatedAtMs: 100, deviceId: 'device-a', payload: { title: 'A' },
        queuedAtMs: 100, attemptCount: 0, nextAttemptAtMs: 0
      };
      const duplicatePending = { schemaVersion: 1, deviceId: 'device-a', pending: [mutation, mutation], acknowledgedIds: [] };
      const rawDuplicate = JSON.stringify(duplicatePending);
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, rawDuplicate);
      let duplicateRejected = false;
      try { LocalSyncOutbox.listReady(200); } catch { duplicateRejected = true; }
      assert(duplicateRejected, 'Duplicate pending IDs must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === rawDuplicate, 'Duplicate pending archive must remain unchanged');

      const overlap = { schemaVersion: 1, deviceId: 'device-a', pending: [mutation], acknowledgedIds: ['duplicate-id'] };
      const rawOverlap = JSON.stringify(overlap);
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, rawOverlap);
      let overlapRejected = false;
      try { LocalSyncOutbox.listReady(200); } catch { overlapRejected = true; }
      assert(overlapRejected, 'Pending and acknowledged IDs must be disjoint');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === rawOverlap, 'Overlapping archive must remain unchanged');
    });

    test('Retry counter and timestamp overflow are rejected without changing the queued mutation', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      const base = {
        mutationId: 'retry-overflow', collection: 'plans', documentId: 'plan-1', operation: 'upsert',
        schemaVersion: 1, clientUpdatedAtMs: 100, deviceId: 'device-a', payload: { title: 'A' },
        queuedAtMs: 100, attemptCount: Number.MAX_SAFE_INTEGER, nextAttemptAtMs: 0
      };
      const rawCounter = JSON.stringify({ schemaVersion: 1, deviceId: 'device-a', pending: [base], acknowledgedIds: [] });
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, rawCounter);
      let counterRejected = false;
      try { LocalSyncOutbox.markFailed('retry-overflow', 'NETWORK', 200); } catch { counterRejected = true; }
      assert(counterRejected, 'Unsafe retry counter increment must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === rawCounter, 'Retry counter overflow must not mutate the archive');

      const safeAttempt = { ...base, mutationId: 'retry-time-overflow', attemptCount: 0 };
      const rawTime = JSON.stringify({ schemaVersion: 1, deviceId: 'device-a', pending: [safeAttempt], acknowledgedIds: [] });
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, rawTime);
      let timeRejected = false;
      try { LocalSyncOutbox.markFailed('retry-time-overflow', 'NETWORK', Number.MAX_SAFE_INTEGER); } catch { timeRejected = true; }
      assert(timeRejected, 'Unsafe next retry timestamp must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === rawTime, 'Retry timestamp overflow must not mutate the archive');
    });

    test('Pending mutations must match the outbox device identity', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      const mutation = {
        mutationId: 'wrong-device', collection: 'plans', documentId: 'plan-1', operation: 'upsert',
        schemaVersion: 1, clientUpdatedAtMs: 100, deviceId: 'device-b', payload: { title: 'A' },
        queuedAtMs: 100, attemptCount: 0, nextAttemptAtMs: 0
      };
      const raw = JSON.stringify({ schemaVersion: 1, deviceId: 'device-a', pending: [mutation], acknowledgedIds: [] });
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw);
      let rejected = false;
      try { LocalSyncOutbox.listReady(200); } catch { rejected = true; }
      assert(rejected, 'Mutation from a different device identity must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === raw, 'Mismatched device archive must remain unchanged');
    });

    test('Outbox data is isolated between Firebase UIDs', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      LocalSyncOutbox.enqueue({ mutationId: 'alpha-event', collection: 'activityEvents', documentId: 'alpha-event', payload: { type: 'session' }, nowMs: 4000 });
      StorageService.setStorageScope('user:beta');
      assert(LocalSyncOutbox.listReady(5000).length === 0, 'Beta must not see Alpha pending events');
      StorageService.setStorageScope('user:alpha');
      assert(LocalSyncOutbox.listReady(5000).length === 1, 'Alpha queue must remain available after account switch');
    });

    test('Failed mutations remain queued and use capped exponential retry delay', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      LocalSyncOutbox.enqueue({ mutationId: 'retry-event', collection: 'activityEvents', documentId: 'retry-event', payload: { type: 'review' }, nowMs: 10000 });
      assert(LocalSyncOutbox.markFailed('retry-event', 'NETWORK', 10000), 'Failure should update an existing mutation');
      assert(LocalSyncOutbox.listReady(10000).length === 0, 'Mutation must wait for its retry window');
      const later = LocalSyncOutbox.listReady(12000);
      assert(later.length === 1 && later[0].attemptCount === 1, 'Mutation must become ready after its retry delay');
      assert(later[0].lastErrorCode === 'NETWORK', 'Failure code must remain available for diagnostics');
    });

    test('Corrupt outbox data is preserved and never silently reset', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, '{broken');
      let rejected = false;
      try { LocalSyncOutbox.listReady(); } catch { rejected = true; }
      assert(rejected, 'Corrupt state must stop sync operations');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === '{broken', 'Corrupt state must remain available for recovery');
    });

    test('Failed durable outbox write is not reported as queued', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      const values = new Map<string, string>();
      reset();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => {
            if (key.endsWith(STORAGE_KEYS.SYNC_OUTBOX)) throw new Error('simulated quota failure');
            values.set(key, value);
          },
          removeItem: (key: string) => values.delete(key)
        }
      });
      try {
        StorageService.setStorageScope('user:alpha');
        let rejected = false;
        try {
          LocalSyncOutbox.enqueue({ mutationId: 'quota-event', collection: 'activityEvents', documentId: 'quota-event', payload: { type: 'session' }, nowMs: 15000 });
        } catch { rejected = true; }
        assert(rejected, 'A failed persistent write must reject the enqueue');
        assert(!Array.from(values.keys()).some(key => key.endsWith(STORAGE_KEYS.SYNC_OUTBOX)), 'A failed persistent write must not leave a phantom queue item');
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete (globalThis as any).localStorage;
        reset();
      }
    });

    test('Mutation payload and Firestore document IDs are bounded', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      let oversizedRejected = false;
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'large', payload: { text: 'x'.repeat(130_000) } }); }
      catch { oversizedRejected = true; }
      let invalidIdRejected = false;
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'bad/id', payload: {} }); }
      catch { invalidIdRejected = true; }
      assert(oversizedRejected && invalidIdRejected, 'Oversized payloads and slash-containing document IDs must be rejected');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 0, 'Rejected inputs must not change the queue');
    });
  } finally {
    reset();
  }

  return { passed, failed };
}
