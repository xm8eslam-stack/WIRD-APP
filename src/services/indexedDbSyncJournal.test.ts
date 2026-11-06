import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import type { LegacyOutboxState } from './indexedDbSyncJournal';
import { StorageService } from './storageService';

export async function runIndexedDbSyncJournalTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let testIndex = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const createJournal = (uid = 'alpha') => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:' + uid);
    testIndex++;
    const factory = new IDBFactory();
    const databaseName = 'wird-sync-journal-test-' + testIndex;
    return {
      factory,
      databaseName,
      journal: new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName })
    };
  };

  try {
    await test('Guest scope cannot enqueue cloud mutations into IndexedDB', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('guest');
      const factory = new IDBFactory();
      const journal = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName: 'wird-sync-guest-test' });
      let rejected = false;
      try {
        await journal.enqueue({ collection: 'activityEvents', documentId: 'guest-event', payload: { minutes: 5 } });
      } catch { rejected = true; }
      assert(rejected, 'Guest mode must remain local-only');
      journal.close();
    });

    await test('Two tabs serialize duplicate enqueue and preserve exactly one event/outbox pair', async () => {
      const { factory, databaseName, journal } = createJournal();
      const secondTab = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      const input = {
        mutationId: 'shared-session-event',
        collection: 'activityEvents' as const,
        documentId: 'session-1',
        payload: { minutes: 12, pages: 3 },
        nowMs: 1000
      };
      const [first, second] = await Promise.all([journal.enqueue(input), secondTab.enqueue(input)]);
      assert([first.status, second.status].includes('queued'), 'One tab must perform the first enqueue');
      assert([first.status, second.status].includes('already_pending'), 'The other tab must observe the committed pending mutation');
      const snapshot = await journal.getSnapshot();
      const events = await secondTab.listEvents();
      assert(snapshot.pendingCount === 1 && snapshot.eventCount === 1, 'Only one pending item and one event may exist');
      assert(events.length === 1 && events[0].mutationId === input.mutationId, 'The append-only event must match the mutation');
      journal.close();
      secondTab.close();
    });

    await test('Mutation ID collisions with changed content are rejected without altering the journal', async () => {
      const { journal } = createJournal();
      await journal.enqueue({ mutationId: 'collision', collection: 'plans', documentId: 'plan-1', payload: { pages: 4 }, nowMs: 2000 });
      let rejected = false;
      try {
        await journal.enqueue({ mutationId: 'collision', collection: 'plans', documentId: 'plan-1', payload: { pages: 9 }, nowMs: 2100 });
      } catch { rejected = true; }
      const events = await journal.listEvents();
      assert(rejected, 'A reused ID with changed content must be rejected');
      assert(events.length === 1 && events[0].payload.pages === 4, 'The original immutable event must remain unchanged');
      journal.close();
    });

    await test('Aborted event/outbox transaction leaves neither half of the mutation', async () => {
      const { journal } = createJournal();
      const originalAdd = IDBObjectStore.prototype.add;
      let injected = false;
      (IDBObjectStore.prototype as any).add = function(value: unknown, key?: IDBValidKey) {
        if (this.name === 'outbox' && !injected) {
          injected = true;
          const request = key === undefined
            ? originalAdd.call(this, value)
            : originalAdd.call(this, value, key);
          this.transaction.abort();
          return request;
        }
        return originalAdd.call(this, value, key);
      };
      let rejected = false;
      try {
        await journal.enqueue({ mutationId: 'abort-together', collection: 'portions', documentId: 'portion-1', payload: { status: 'weak' }, nowMs: 3000 });
      } catch { rejected = true; }
      finally { IDBObjectStore.prototype.add = originalAdd; }
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      assert(injected && rejected, 'The injected transaction abort must reject enqueue');
      assert(snapshot.pendingCount === 0 && snapshot.eventCount === 0 && events.length === 0,
        'IndexedDB must roll back the event and outbox record together');
      journal.close();
    });

    await test('Acknowledgement removes delivery work but preserves the append-only event', async () => {
      const { journal } = createJournal();
      await journal.enqueue({ mutationId: 'ack-event', collection: 'activityEvents', documentId: 'session-ack', payload: { minutes: 7 }, nowMs: 4000 });
      assert(await journal.acknowledge(['ack-event'], 5000) === 1, 'A confirmed mutation must be acknowledged once');
      assert(await journal.acknowledge(['ack-event'], 5100) === 0, 'Repeated acknowledgement must be idempotent');
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      assert(snapshot.pendingCount === 0 && snapshot.acknowledgedCount === 1, 'Acknowledgement must move the delivery state');
      assert(snapshot.eventCount === 1 && events[0].mutationId === 'ack-event', 'Acknowledgement must not delete the event history');
      const duplicate = await journal.enqueue({ mutationId: 'ack-event', collection: 'activityEvents', documentId: 'session-ack', payload: { minutes: 7 }, nowMs: 5200 });
      assert(duplicate.status === 'already_acknowledged', 'An acknowledged identical event must remain idempotent');
      journal.close();
    });

    await test('Retry scheduling uses capped exponential backoff and retains the event', async () => {
      const { journal } = createJournal();
      await journal.enqueue({ mutationId: 'retry-event', collection: 'plans', documentId: 'plan-retry', payload: { pages: 2 }, nowMs: 10000 });
      assert(await journal.markFailed('retry-event', 'NETWORK', 10000), 'A queued mutation must accept retry metadata');
      assert((await journal.listReady(11999)).length === 0, 'A mutation must remain hidden before its next retry time');
      const ready = await journal.listReady(12000);
      assert(ready.length === 1 && ready[0].attemptCount === 1 && ready[0].lastErrorCode === 'NETWORK',
        'The retry must be due with an incremented attempt count and error code');
      assert((await journal.listEvents()).length === 1, 'Retry metadata must not mutate or remove the journal event');
      journal.close();
    });

    await test('Legacy localStorage outbox migrates pending, acknowledged, and device state atomically', async () => {
      const { journal } = createJournal();
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'legacy-device-1',
        pending: [{
          mutationId: 'legacy-pending',
          collection: 'activityEvents',
          documentId: 'legacy-session',
          operation: 'upsert',
          schemaVersion: 1,
          clientUpdatedAtMs: 8000,
          deviceId: 'legacy-device-1',
          payload: { minutes: 15 },
          queuedAtMs: 8100,
          attemptCount: 2,
          nextAttemptAtMs: 9000,
          lastErrorCode: 'NETWORK'
        }],
        acknowledgedIds: ['legacy-acknowledged'],
        acknowledgedFingerprints: [{ mutationId: 'legacy-acknowledged', fingerprint: '0123456789abcdef' }]
      };
      assert(await journal.importLegacyState(legacy) === 'migrated', 'First migration must commit');
      assert(await journal.importLegacyState(legacy) === 'already_migrated', 'Repeated migration must be idempotent');
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      const ready = await journal.listReady(9000);
      assert(snapshot.deviceId === 'legacy-device-1', 'Legacy device identity must be preserved');
      assert(snapshot.pendingCount === 1 && snapshot.acknowledgedCount === 1 && snapshot.eventCount === 1,
        'Pending, acknowledged, and event records must migrate as one logical state');
      assert(ready.length === 1 && ready[0].attemptCount === 2 && ready[0].lastErrorCode === 'NETWORK',
        'Retry metadata must be preserved during migration');
      assert(events[0].mutationId === 'legacy-pending', 'The legacy pending mutation must become an immutable event');
      journal.close();
    });

    await test('Conflicting legacy migration aborts earlier queued writes without partial import', async () => {
      const { journal } = createJournal();
      await journal.enqueue({ mutationId: 'existing-conflict', collection: 'plans', documentId: 'plan-1', payload: { pages: 1 }, nowMs: 8500 });
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'legacy-device-2',
        pending: [
          {
            mutationId: 'would-partially-import',
            collection: 'activityEvents',
            documentId: 'session-partial',
            operation: 'upsert',
            schemaVersion: 1,
            clientUpdatedAtMs: 8600,
            deviceId: 'legacy-device-2',
            payload: { minutes: 3 },
            queuedAtMs: 8600,
            attemptCount: 0,
            nextAttemptAtMs: 0
          },
          {
            mutationId: 'existing-conflict',
            collection: 'plans',
            documentId: 'plan-1',
            operation: 'upsert',
            schemaVersion: 1,
            clientUpdatedAtMs: 8601,
            deviceId: 'legacy-device-2',
            payload: { pages: 99 },
            queuedAtMs: 8601,
            attemptCount: 0,
            nextAttemptAtMs: 0
          }
        ],
        acknowledgedIds: [],
        acknowledgedFingerprints: []
      };
      let rejected = false;
      try { await journal.importLegacyState(legacy); } catch { rejected = true; }
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      assert(rejected, 'Different content for an existing event ID must reject migration');
      assert(snapshot.pendingCount === 1 && snapshot.eventCount === 1 && events.length === 1,
        'No earlier records from a failed migration may be committed');
      assert(events[0].mutationId === 'existing-conflict', 'The original journal event must remain unchanged');
      journal.close();
    });

    await test('UID scoping isolates the same mutation ID between accounts', async () => {
      const { journal } = createJournal('alpha');
      await journal.enqueue({ mutationId: 'same-id', collection: 'profile', documentId: 'profile', payload: { name: 'A' }, nowMs: 6000 });
      StorageService.setStorageScope('user:beta');
      const beta = await journal.getSnapshot();
      assert(beta.uid === 'beta' && beta.pendingCount === 0 && beta.eventCount === 0, 'Another account must not read the first account journal');
      const betaResult = await journal.enqueue({ mutationId: 'same-id', collection: 'profile', documentId: 'profile', payload: { name: 'B' }, nowMs: 6100 });
      assert(betaResult.status === 'queued', 'The same ID may be independently used in a different UID scope');
      StorageService.setStorageScope('user:alpha');
      const alpha = await journal.getSnapshot();
      assert(alpha.pendingCount === 1 && alpha.eventCount === 1, 'Switching back must reveal only the first account event');
      journal.close();
    });

    await test('Committed events and pending mutations survive closing and reopening the database', async () => {
      const { factory, databaseName, journal } = createJournal();
      await journal.enqueue({ mutationId: 'reopen-event', collection: 'tests', documentId: 'test-1', payload: { score: 8 }, nowMs: 7000 });
      journal.close();
      const reopened = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      const snapshot = await reopened.getSnapshot();
      const events = await reopened.listEvents();
      assert(snapshot.pendingCount === 1 && snapshot.eventCount === 1, 'Committed transaction must be available after reopening');
      assert(events[0].mutationId === 'reopen-event', 'The event log must survive database connection loss');
      reopened.close();
    });
  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
