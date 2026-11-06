import 'fake-indexeddb/auto';
import { LocalSyncOutbox } from './localSyncOutbox';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import { STORAGE_KEYS, StorageService } from './storageService';
import type { LegacyOutboxState } from './indexedDbSyncJournal';

export async function runLocalSyncOutboxTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let uidCounter = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const activate = () => {
    uidCounter++;
    StorageService.__resetStorageForTests();
    const uid = 'outbox-facade-' + uidCounter;
    StorageService.setStorageScope('user:' + uid);
    return uid;
  };

  try {
    await test('Guest scope cannot enqueue or read a cloud outbox', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('guest');
      let enqueueRejected = false;
      let readRejected = false;
      try {
        await LocalSyncOutbox.enqueue({ mutationId: 'guest-mutation', collection: 'activityEvents', documentId: 'guest', payload: { minutes: 1 } });
      } catch { enqueueRejected = true; }
      try { await LocalSyncOutbox.getSnapshot(); } catch { readRejected = true; }
      assert(enqueueRejected && readRejected, 'Guest mode must remain local-only');
    });

    await test('Enqueue is idempotent and rejects mutation ID reuse with changed content', async () => {
      activate();
      const input = { mutationId: 'same-mutation', collection: 'activityEvents' as const, documentId: 'session-1', payload: { minutes: 12 }, nowMs: 1000 };
      const first = await LocalSyncOutbox.enqueue(input);
      const duplicate = await LocalSyncOutbox.enqueue(input);
      let collisionRejected = false;
      try { await LocalSyncOutbox.enqueue({ ...input, payload: { minutes: 99 } }); }
      catch { collisionRejected = true; }
      const ready = await LocalSyncOutbox.listReady(1000);
      assert(first.status === 'queued' && duplicate.status === 'already_pending', 'Repeated identical enqueue must be idempotent');
      assert(collisionRejected, 'A mutation ID collision with different content must be rejected');
      assert(ready.length === 1 && ready[0].payload.minutes === 12, 'Only the original mutation may remain queued');
    });

    await test('Acknowledgement removes pending work and reserves the ID fingerprint', async () => {
      activate();
      const input = { mutationId: 'ack-mutation', collection: 'plans' as const, documentId: 'plan-1', payload: { pages: 4 }, nowMs: 2000 };
      await LocalSyncOutbox.enqueue(input);
      assert(await LocalSyncOutbox.acknowledge(['ack-mutation'], 2100) === 1, 'A confirmed mutation must be acknowledged');
      assert(await LocalSyncOutbox.acknowledge(['ack-mutation'], 2200) === 0, 'Repeated acknowledgement must be idempotent');
      const snapshot = await LocalSyncOutbox.getSnapshot();
      const duplicate = await LocalSyncOutbox.enqueue(input);
      assert(snapshot.pendingCount === 0 && snapshot.acknowledgedCount === 1, 'Acknowledgement must move the delivery state');
      assert(duplicate.status === 'already_acknowledged', 'The acknowledged mutation ID must remain reserved');
    });

    await test('Retry uses capped exponential backoff without deleting the mutation', async () => {
      activate();
      await LocalSyncOutbox.enqueue({ mutationId: 'retry-mutation', collection: 'plans', documentId: 'plan-retry', payload: { pages: 2 }, nowMs: 10000 });
      assert(await LocalSyncOutbox.markFailed('retry-mutation', 'NETWORK', 10000), 'A queued mutation must accept retry metadata');
      assert((await LocalSyncOutbox.listReady(11999)).length === 0, 'A mutation must remain hidden before its next retry time');
      const ready = await LocalSyncOutbox.listReady(12000);
      assert(ready.length === 1 && ready[0].attemptCount === 1 && ready[0].lastErrorCode === 'NETWORK',
        'The retry must be due with incremented attempts and an error code');
    });

    await test('Snapshot creates a stable device ID even before the first enqueue', async () => {
      activate();
      const first = await LocalSyncOutbox.getSnapshot();
      const second = await LocalSyncOutbox.getSnapshot();
      assert(Boolean(first.deviceId) && first.deviceId === second.deviceId, 'Device identity must remain stable');
    });

    await test('First outbox operation imports legacy state and retains the source as a recovery copy', async () => {
      const uid = activate();
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'legacy-facade-device',
        pending: [{
          mutationId: 'legacy-facade-pending',
          collection: 'activityEvents',
          documentId: 'legacy-session',
          operation: 'upsert',
          schemaVersion: 1,
          clientUpdatedAtMs: 3000,
          deviceId: 'legacy-facade-device',
          payload: { minutes: 17 },
          queuedAtMs: 3100,
          attemptCount: 1,
          nextAttemptAtMs: 4000
        }],
        acknowledgedIds: ['legacy-facade-ack'],
        acknowledgedFingerprints: []
      };
      const raw = JSON.stringify(legacy);
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy source fixture must persist');
      const snapshot = await LocalSyncOutbox.getSnapshot();
      const ready = await LocalSyncOutbox.listReady(4000);
      assert(snapshot.uid === uid && snapshot.deviceId === 'legacy-facade-device', 'UID and device identity must be preserved');
      assert(snapshot.pendingCount === 1 && snapshot.acknowledgedCount === 1, 'Legacy pending and acknowledged state must migrate');
      assert(ready.length === 1 && ready[0].attemptCount === 1, 'Legacy retry metadata must be retained');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy localStorage must remain available as a recovery copy');
    });

    await test('Changed legacy snapshot from an older tab is incrementally merged without duplicates', async () => {
      activate();
      const first: LegacyOutboxState = {
        schemaVersion: 1, deviceId: 'stale-tab-device',
        pending: [{
          mutationId: 'stale-tab-first', collection: 'activityEvents', documentId: 's1',
          operation: 'upsert', schemaVersion: 1, clientUpdatedAtMs: 5000,
          deviceId: 'stale-tab-device', payload: { minutes: 1 }, queuedAtMs: 5000,
          attemptCount: 0, nextAttemptAtMs: 0
        }],
        acknowledgedIds: [], acknowledgedFingerprints: []
      };
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, JSON.stringify(first)), 'Initial legacy source must persist');
      await LocalSyncOutbox.getSnapshot();
      const updated: LegacyOutboxState = {
        ...first,
        pending: [...first.pending, {
          mutationId: 'stale-tab-second', collection: 'activityEvents', documentId: 's2',
          operation: 'upsert', schemaVersion: 1, clientUpdatedAtMs: 5100,
          deviceId: 'stale-tab-device', payload: { minutes: 2 }, queuedAtMs: 5100,
          attemptCount: 0, nextAttemptAtMs: 0
        }]
      };
      const raw = JSON.stringify(updated);
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Updated legacy source must persist');
      const snapshot = await LocalSyncOutbox.getSnapshot();
      const ready = await LocalSyncOutbox.listReady(5200);
      assert(snapshot.pendingCount === 2 && ready.length === 2, 'New stale-tab mutations must merge without duplicating old ones');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Updated legacy source must remain intact');
    });

    await test('Conflicting legacy state is retained and cannot overwrite an IndexedDB mutation', async () => {
      activate();
      await LocalSyncOutbox.enqueue({ mutationId: 'legacy-conflict', collection: 'plans', documentId: 'plan-1', payload: { pages: 1 }, nowMs: 6000 });
      const legacy: LegacyOutboxState = {
        schemaVersion: 1, deviceId: 'conflicting-old-device',
        pending: [{
          mutationId: 'legacy-conflict', collection: 'plans', documentId: 'plan-1',
          operation: 'upsert', schemaVersion: 1, clientUpdatedAtMs: 6100,
          deviceId: 'conflicting-old-device', payload: { pages: 99 }, queuedAtMs: 6100,
          attemptCount: 0, nextAttemptAtMs: 0
        }],
        acknowledgedIds: [], acknowledgedFingerprints: []
      };
      const raw = JSON.stringify(legacy);
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Conflicting source must persist');
      let rejected = false;
      try { await LocalSyncOutbox.getSnapshot(); } catch { rejected = true; }
      assert(rejected, 'Different content for the same mutation ID must stop migration');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Conflicting legacy source must remain untouched');
      const journal = new IndexedDbSyncJournal();
      const snapshot = await journal.getSnapshot();
      const ready = await journal.listReady(7000);
      assert(snapshot.pendingCount === 1 && ready.length === 1 && ready[0].payload.pages === 1,
        'The original IndexedDB mutation must remain unchanged');
      journal.close();
    });

    await test('UID scoping isolates identical mutation IDs between accounts', async () => {
      const alpha = activate();
      await LocalSyncOutbox.enqueue({ mutationId: 'account-shared-id', collection: 'profile', documentId: 'profile', payload: { name: 'A' }, nowMs: 7000 });
      StorageService.setStorageScope('user:' + alpha + '-other');
      const other = await LocalSyncOutbox.getSnapshot();
      assert(other.pendingCount === 0, 'Another account must not see the first account outbox');
      await LocalSyncOutbox.enqueue({ mutationId: 'account-shared-id', collection: 'profile', documentId: 'profile', payload: { name: 'B' }, nowMs: 7100 });
      StorageService.setStorageScope('user:' + alpha);
      const original = await LocalSyncOutbox.getSnapshot();
      assert(original.pendingCount === 1, 'Switching back must restore the first account outbox only');
    });
  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
