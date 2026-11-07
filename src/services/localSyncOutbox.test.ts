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

    await test('Invalid payloads, operations, document IDs, and oversized payloads are rejected', async () => {
      activate();
      const base = { mutationId: 'invalid-input', collection: 'plans' as const, documentId: 'plan-1', payload: { pages: 1 } };
      const invalidInputs: any[] = [
        { ...base, operation: 'delete' },
        { ...base, documentId: 'folder/plan' },
        { ...base, documentId: 'x'.repeat(1501) },
        { ...base, payload: [] },
        { ...base, payload: { text: 'x'.repeat(128_100) } }
      ];
      let rejected = 0;
      for (const input of invalidInputs) {
        try { await LocalSyncOutbox.enqueue(input); } catch { rejected++; }
      }
      assert(rejected === invalidInputs.length, 'Every malformed or oversized mutation must be rejected');
      assert((await LocalSyncOutbox.getSnapshot()).pendingCount === 0, 'Invalid mutations must not create outbox records');
    });

    await test('Acknowledged legacy IDs without fingerprints stay reserved', async () => {
      activate();
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'legacy-no-fingerprint',
        pending: [],
        acknowledgedIds: ['old-ack-without-fingerprint'],
        acknowledgedFingerprints: []
      };
      const raw = JSON.stringify(legacy);
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy acknowledged fixture must persist');
      await LocalSyncOutbox.getSnapshot();
      let rejected = false;
      try {
        await LocalSyncOutbox.enqueue({
          mutationId: 'old-ack-without-fingerprint',
          collection: 'plans',
          documentId: 'plan-old',
          payload: { pages: 1 }
        });
      } catch { rejected = true; }
      assert(rejected, 'Unknown historical content must never be treated as an identical retry');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy acknowledgement source must remain preserved');
    });

    await test('Malformed legacy outbox is preserved and never silently reset', async () => {
      activate();
      const corrupt = '{"schemaVersion":1,"pending":';
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, corrupt), 'Corrupt source fixture must persist');
      let rejected = false;
      try { await LocalSyncOutbox.getSnapshot(); } catch { rejected = true; }
      assert(rejected, 'Corrupt legacy source must stop the adapter');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, corrupt), 'Corrupt source bytes must remain unchanged');
    });

    await test('Stable payload fingerprints ignore object key order', async () => {
      activate();
      const first = await LocalSyncOutbox.enqueue({
        mutationId: 'stable-fingerprint',
        collection: 'profile',
        documentId: 'profile',
        payload: { displayName: 'Reader', timezone: 'Africa/Cairo' }
      });
      const second = await LocalSyncOutbox.enqueue({
        mutationId: 'stable-fingerprint',
        collection: 'profile',
        documentId: 'profile',
        payload: { timezone: 'Africa/Cairo', displayName: 'Reader' }
      });
      assert(first.status === 'queued' && second.status === 'already_pending',
        'Equivalent JSON objects with different key order must share one fingerprint');
    });

    await test('Invalid batch limits, acknowledgement IDs, and retry timestamp overflow are rejected', async () => {
      activate();
      await LocalSyncOutbox.enqueue({ mutationId: 'limits-mutation', collection: 'plans', documentId: 'plan-limits', payload: { pages: 1 }, nowMs: 8000 });
      let rejected = 0;
      for (const limit of [0, 1.5, 101]) {
        try { await LocalSyncOutbox.listReady(8000, limit); } catch { rejected++; }
      }
      try { await LocalSyncOutbox.acknowledge(['bad/id']); } catch { rejected++; }
      try { await LocalSyncOutbox.markFailed('limits-mutation', 'NETWORK'.repeat(20), 8000); } catch { rejected++; }
      try { await LocalSyncOutbox.markFailed('limits-mutation', 'NETWORK', Number.MAX_SAFE_INTEGER); } catch { rejected++; }
      assert(rejected === 6, 'All invalid batch, ID, error-code, and overflow inputs must reject');
      assert((await LocalSyncOutbox.getSnapshot()).pendingCount === 1, 'Rejected operations must not remove the queued mutation');
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

    await test('Captured sync UID prevents in-flight account switches from reading or mutating the new outbox', async () => {
      const accountA = activate();
      const mutationId = 'same-pending-id-across-accounts';
      await LocalSyncOutbox.enqueue({
        mutationId, collection: 'profile', documentId: 'profile',
        payload: { displayName: 'Account A' }, nowMs: 7200
      });

      StorageService.setStorageScope('user:' + accountA + '-other');
      await LocalSyncOutbox.enqueue({
        mutationId, collection: 'profile', documentId: 'profile',
        payload: { displayName: 'Account B' }, nowMs: 7300
      });

      const staleAccountOperations: Array<() => Promise<unknown>> = [
        () => LocalSyncOutbox.listReadyEntries(7300, 25, accountA),
        () => LocalSyncOutbox.getRemoteRevision('profile', 'profile', accountA),
        () => LocalSyncOutbox.rebasePendingMutation(mutationId, 0, 1, accountA),
        () => LocalSyncOutbox.markFailed(mutationId, 'STALE_ACCOUNT_SYNC', 7400, accountA),
        () => LocalSyncOutbox.acknowledgeRemoteMutation(mutationId, 1, 7500, accountA)
      ];
      let rejected = 0;
      for (const operation of staleAccountOperations) {
        try { await operation(); } catch (error: any) {
          if (error?.message === 'SYNC_SCOPE_CHANGED') rejected++;
        }
      }

      const accountB = await LocalSyncOutbox.getSnapshot();
      const accountBEntries = await LocalSyncOutbox.listReadyEntries(7500, 25);
      assert(rejected === staleAccountOperations.length,
        'Every stale operation bound to account A must abort after the active scope changes');
      assert(accountB.uid === accountA + '-other' && accountB.pendingCount === 1,
        'Account B pending mutation must remain present after stale A sync attempts');
      assert(accountBEntries[0]?.payload.displayName === 'Account B' &&
        accountBEntries[0]?.baseRevision === 0 &&
        accountBEntries[0]?.attemptCount === 0,
        'Account B mutation payload, base revision, and retry state must remain untouched');
    });
  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
