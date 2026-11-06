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
      let invalidPayload = false, invalidOperation = false, oversizedUtf8Id = false, emptyMutationId = false;
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'null-payload', payload: null as any }); } catch { invalidPayload = true; }
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'bad-operation', operation: 'delete' as any, payload: {} }); } catch { invalidOperation = true; }
      try { LocalSyncOutbox.enqueue({ collection: 'activityEvents', documentId: 'é'.repeat(800), payload: {} }); } catch { oversizedUtf8Id = true; }
      try { LocalSyncOutbox.enqueue({ mutationId: '', collection: 'activityEvents', documentId: 'empty-id', payload: {} }); } catch { emptyMutationId = true; }
      assert(invalidPayload && invalidOperation && oversizedUtf8Id && emptyMutationId, 'Malformed values must be rejected before changing persistent state');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 0, 'Rejected inputs must not corrupt or enqueue into the outbox');
    });

    test('Acknowledged mutation IDs cannot be re-enqueued', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-1', payload: { title: 'خطة' }, nowMs: 2000 });
      assert(LocalSyncOutbox.acknowledge(['mutation-ack-1']) === 1, 'Confirmed mutation must be removed from pending');
      const duplicate = LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-1', payload: { title: 'خطة' }, nowMs: 3000 });
      assert(duplicate.status === 'already_acknowledged', 'An acknowledged ID with identical content must be idempotent');
      let changedPayloadRejected = false;
      let changedDocumentRejected = false;
      let changedCollectionRejected = false;
      try {
        LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-1', payload: { title: 'خطة معدلة' }, nowMs: 4000 });
      } catch { changedPayloadRejected = true; }
      try {
        LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-2', payload: { title: 'خطة' }, nowMs: 4000 });
      } catch { changedDocumentRejected = true; }
      try {
        LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'tests', documentId: 'plan-1', payload: { title: 'خطة' }, nowMs: 4000 });
      } catch { changedCollectionRejected = true; }
      assert(changedPayloadRejected && changedDocumentRejected && changedCollectionRejected,
        'Reusing an acknowledged ID with changed payload, document, or collection must be rejected');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 0, 'Acknowledged mutation must remain out of pending');
    });

    test('Legacy acknowledged IDs without fingerprints remain reserved but cannot be assumed idempotent', () => {
      reset();
      StorageService.setStorageScope('user:legacy-ack');
      LocalSyncOutbox.enqueue({ mutationId: 'legacy-ack-id', collection: 'plans', documentId: 'plan-legacy', payload: { title: 'قديمة' }, nowMs: 4500 });
      LocalSyncOutbox.acknowledge(['legacy-ack-id']);
      const state = JSON.parse(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX)!);
      delete state.acknowledgedFingerprints; // Shape written by the original v1 outbox.
      const legacyRaw = JSON.stringify(state);
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, legacyRaw);

      let rejected = false;
      try {
        LocalSyncOutbox.enqueue({ mutationId: 'legacy-ack-id', collection: 'plans', documentId: 'plan-legacy', payload: { title: 'قديمة' }, nowMs: 4600 });
      } catch { rejected = true; }
      assert(rejected, 'An old acknowledged ID without a content fingerprint must not be silently treated as a matching retry');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === legacyRaw, 'Legacy outbox bytes must remain unchanged after rejected reuse');
    });

    test('Duplicate pending IDs, duplicate acknowledged IDs, and pending/acknowledged overlap are rejected', () => {
      reset();
      StorageService.setStorageScope('user:outbox-uniqueness');
      LocalSyncOutbox.enqueue({ mutationId: 'unique-pending', collection: 'activityEvents', documentId: 'event-1', payload: { n: 1 }, nowMs: 5000 });
      const original = JSON.parse(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX)!);

      const duplicatePending = { ...original, pending: [...original.pending, original.pending[0]] };
      const duplicatePendingRaw = JSON.stringify(duplicatePending);
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, duplicatePendingRaw);
      let pendingRejected = false;
      try { LocalSyncOutbox.listReady(6000); } catch { pendingRejected = true; }
      assert(pendingRejected, 'Duplicate pending mutation IDs must invalidate the state');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === duplicatePendingRaw, 'Duplicate pending state must be preserved');

      const duplicateAcknowledged = {
        ...original,
        acknowledgedIds: ['ack-duplicate', 'ack-duplicate'],
        acknowledgedFingerprints: []
      };
      const duplicateAcknowledgedRaw = JSON.stringify(duplicateAcknowledged);
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, duplicateAcknowledgedRaw);
      let acknowledgedRejected = false;
      try { LocalSyncOutbox.getSnapshot(); } catch { acknowledgedRejected = true; }
      assert(acknowledgedRejected, 'Duplicate acknowledged IDs must invalidate the state');

      const overlap = { ...original, acknowledgedIds: ['unique-pending'], acknowledgedFingerprints: [] };
      const overlapRaw = JSON.stringify(overlap);
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, overlapRaw);
      let overlapRejected = false;
      try { LocalSyncOutbox.listReady(6000); } catch { overlapRejected = true; }
      assert(overlapRejected, 'An ID cannot be pending and acknowledged at the same time');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === overlapRaw, 'Conflicting state must remain unchanged');
    });

    test('Acknowledged fingerprints are stable across object key order', () => {
      reset();
      StorageService.setStorageScope('user:outbox-stable-fingerprint');
      LocalSyncOutbox.enqueue({ mutationId: 'stable-fingerprint', collection: 'plans', documentId: 'plan-1', payload: { a: 1, b: 2 }, nowMs: 5100 });
      LocalSyncOutbox.acknowledge(['stable-fingerprint']);
      const duplicate = LocalSyncOutbox.enqueue({
        mutationId: 'stable-fingerprint', collection: 'plans', documentId: 'plan-1',
        payload: { b: 2, a: 1 }, nowMs: 5200
      });
      assert(duplicate.status === 'already_acknowledged', 'Equivalent JSON objects must produce the same content fingerprint');
    });

    test('Retry attempt and next-attempt timestamp overflow are rejected without changing the archive', () => {
      reset();
      StorageService.setStorageScope('user:outbox-retry-overflow');
      LocalSyncOutbox.enqueue({ mutationId: 'retry-overflow', collection: 'activityEvents', documentId: 'event-overflow', payload: { n: 1 }, nowMs: 5300 });
      const original = JSON.parse(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX)!);
      const maxAttemptsState = {
        ...original,
        pending: original.pending.map((item: any) => ({ ...item, attemptCount: Number.MAX_SAFE_INTEGER }))
      };
      const maxAttemptsRaw = JSON.stringify(maxAttemptsState);
      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, maxAttemptsRaw);
      let attemptsRejected = false;
      try { LocalSyncOutbox.markFailed('retry-overflow', 'NETWORK', 5400); } catch { attemptsRejected = true; }
      assert(attemptsRejected, 'Attempt count overflow must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === maxAttemptsRaw, 'Attempt overflow must not change the state');

      StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, JSON.stringify(original));
      const timestampBefore = StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX)!;
      let timestampRejected = false;
      try { LocalSyncOutbox.markFailed('retry-overflow', 'NETWORK', Number.MAX_SAFE_INTEGER - 1000); }
      catch { timestampRejected = true; }
      assert(timestampRejected, 'Next retry timestamp overflow must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === timestampBefore, 'Timestamp overflow must not change the state');
    });

    test('Ready batch limits reject negative, fractional, and oversized values', () => {
      reset();
      StorageService.setStorageScope('user:outbox-limit');
      LocalSyncOutbox.getSnapshot();
      const before = StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX);
      for (const limit of [-1, 1.5, 101]) {
        let rejected = false;
        try { LocalSyncOutbox.listReady(6000, limit); } catch { rejected = true; }
        assert(rejected, 'Invalid batch limit must be rejected: ' + limit);
      }
      assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) === before, 'Invalid read limits must not mutate the queue');
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

    test('Partially applied outbox write with failed restoration is never reported as a verified rollback', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      const values = new Map<string, string>();
      let allowOutboxWrites = true;
      let previousRaw: string | null = null;
      reset();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => {
            if (!allowOutboxWrites && key.endsWith(STORAGE_KEYS.SYNC_OUTBOX)) {
              if (value !== previousRaw) {
                values.set(key, value);
                throw new Error('simulated outbox write applied before failure');
              }
              return; // Refuse to restore the previous outbox bytes.
            }
            values.set(key, value);
          },
          removeItem: (key: string) => values.delete(key)
        }
      });
      try {
        StorageService.setStorageScope('user:alpha');
        LocalSyncOutbox.getSnapshot(); // Create and verify the empty outbox before injecting failure.
        previousRaw = StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX);
        allowOutboxWrites = false;
        let message = '';
        try {
          LocalSyncOutbox.enqueue({
            mutationId: 'partial-outbox-event',
            collection: 'activityEvents',
            documentId: 'partial-outbox-event',
            payload: { type: 'session' },
            nowMs: 16000
          });
        } catch (error: any) { message = error?.message || String(error); }
        assert(message.includes('تعذر التحقق من استعادة الحالة السابقة'),
          'A partially applied outbox write with failed restoration must surface a recovery-required error');
        assert(StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) !== previousRaw,
          'The injected durable mismatch must remain observable rather than being hidden by memory fallback');
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
