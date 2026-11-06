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

    test('Acknowledged mutation IDs cannot be re-enqueued', () => {
      reset();
      StorageService.setStorageScope('user:alpha');
      LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-1', payload: { title: 'خطة' }, nowMs: 2000 });
      assert(LocalSyncOutbox.acknowledge(['mutation-ack-1']) === 1, 'Confirmed mutation must be removed from pending');
      const duplicate = LocalSyncOutbox.enqueue({ mutationId: 'mutation-ack-1', collection: 'plans', documentId: 'plan-1', payload: { title: 'خطة' }, nowMs: 3000 });
      assert(duplicate.status === 'already_acknowledged', 'An acknowledged ID must never become a new queue item');
      assert(LocalSyncOutbox.getSnapshot().pendingCount === 0, 'Acknowledged mutation must remain out of pending');
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
