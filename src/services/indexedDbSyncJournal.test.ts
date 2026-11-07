import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import type { LegacyOutboxState } from './indexedDbSyncJournal';
import { STORAGE_KEYS, StorageService } from './storageService';
import { LocalSyncOutbox } from './localSyncOutbox';

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

    await test('Remote revision acknowledgement is durable and becomes the next mutation base', async () => {
      const { journal } = createJournal();
      const first = await journal.enqueue({
        mutationId: 'revision-first',
        collection: 'plans',
        documentId: 'revision-plan',
        payload: { title: 'First' },
        nowMs: 6000
      });
      assert(first.status === 'queued' && first.mutation.baseRevision === 0 && first.mutation.sequence === 1,
        'The first mutation must start at base revision zero');
      assert(await journal.acknowledgeRemoteMutation('revision-first', 1, 6100),
        'A confirmed server write must atomically acknowledge the outbox mutation');
      const cached = await journal.getRemoteRevision('plans', 'revision-plan');
      assert(cached?.revision === 1 && cached.localSequence === 1,
        'The server revision and last locally applied sequence must persist together');
      const second = await journal.enqueue({
        mutationId: 'revision-second',
        collection: 'plans',
        documentId: 'revision-plan',
        payload: { title: 'Second' },
        nowMs: 6200
      });
      assert(second.status === 'queued' && second.mutation.baseRevision === 1 && second.mutation.sequence === 2,
        'A later local mutation must capture the acknowledged server revision');
      journal.close();
    });

    await test('Only later local pending mutations can be rebased after an earlier acknowledgement', async () => {
      const { journal } = createJournal();
      await journal.enqueue({
        mutationId: 'revision-chain-first',
        collection: 'plans',
        documentId: 'revision-chain-plan',
        payload: { title: 'First' },
        nowMs: 7000
      });
      await journal.enqueue({
        mutationId: 'revision-chain-second',
        collection: 'plans',
        documentId: 'revision-chain-plan',
        payload: { title: 'Second' },
        nowMs: 7001
      });
      await journal.acknowledgeRemoteMutation('revision-chain-first', 1, 7100);
      assert(await journal.rebasePendingMutation('revision-chain-second', 0, 1),
        'A later same-device event may advance to the immediately prior local acknowledgement');
      const ready = await journal.listReady(7200);
      assert(ready.length === 1 && ready[0].baseRevision === 1 && ready[0].sequence === 2,
        'The later pending mutation must durably retain its rebased base revision');
      let olderRejected = false;
      try { await journal.rebasePendingMutation('revision-chain-second', 1, 2); }
      catch { olderRejected = true; }
      assert(olderRejected, 'A mutation cannot be rebased without a newer acknowledged local sequence');
      journal.close();
    });

    await test('Remote inbox import persists events and advances the durable cursor atomically', async () => {
      const { journal } = createJournal('remote-alpha');
      const event = {
        uid: 'remote-alpha',
        eventId: 'remote-event-1',
        mutationId: 'remote-mutation-1',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-remote-1',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-1',
        occurredAtMs: 8000,
        payload: { records: [{ id: 'plan-remote-1' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      const cursor = await journal.importRemotePage([event]);
      const retryCursor = await journal.importRemotePage([event]);
      const inbox = await journal.listRemoteInboxAfter(0, 10);
      assert(cursor === 1 && retryCursor === 1,
        'The cursor must advance once and identical page retries must be idempotent');
      assert(inbox.length === 1 && inbox[0].eventId === event.eventId && inbox[0].serverSequence === 1,
        'The complete remote event must be durably available in the inbox');
      assert(await journal.markRemoteProjected(1), 'Projection cursor must advance after a successful local projection');
      assert(await journal.getRemoteProjectionCursor() === 1,
        'The projection cursor must be persisted independently from the import cursor');
      journal.close();
    });

    await test('Remote inbox rejects sequence gaps without moving its cursor', async () => {
      const { journal } = createJournal('remote-gap');
      const event = {
        uid: 'remote-gap',
        eventId: 'remote-gap-event-2',
        mutationId: 'remote-gap-mutation-2',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-gap',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-2',
        occurredAtMs: 8100,
        payload: { records: [] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 2
      };
      let rejected = false;
      try { await journal.importRemotePage([event]); } catch { rejected = true; }
      assert(rejected && await journal.getRemoteCursor() === 0,
        'A missing server sequence must stop import before cursor advancement');
      assert((await journal.listRemoteInboxAfter(0, 10)).length === 0,
        'A rejected page must not leave a partial inbox record');
      journal.close();
    });

    await test('Remote inbox is isolated by UID and refuses foreign events', async () => {
      const { journal } = createJournal('remote-owner');
      const event = {
        uid: 'remote-other',
        eventId: 'foreign-event',
        mutationId: 'foreign-mutation',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'foreign-plan',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'foreign-device',
        occurredAtMs: 8200,
        payload: { records: [] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      let rejected = false;
      try { await journal.importRemotePage([event]); } catch { rejected = true; }
      assert(rejected && await journal.getRemoteCursor() === 0,
        'An event for another UID must not be imported into this account');
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

    await test('Version 1 journal upgrade backfills ordered sequences and enforces a contiguous projection cursor', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:sequence-upgrade');
      const factory = new IDBFactory();
      const databaseName = 'wird-sync-journal-v1-upgrade-test';
      const legacyDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(databaseName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          const events = database.createObjectStore('events', { keyPath: 'key' });
          events.createIndex('uid', 'uid', { unique: false });
          events.createIndex('uidCreatedAt', ['uid', 'createdAtMs'], { unique: false });
          const outbox = database.createObjectStore('outbox', { keyPath: 'key' });
          outbox.createIndex('uid', 'uid', { unique: false });
          outbox.createIndex('uidNextAttempt', ['uid', 'nextAttemptAtMs'], { unique: false });
          const acknowledgements = database.createObjectStore('acknowledgements', { keyPath: 'key' });
          acknowledgements.createIndex('uid', 'uid', { unique: false });
          acknowledgements.createIndex('uidAcknowledgedAt', ['uid', 'acknowledgedAtMs'], { unique: false });
          database.createObjectStore('metadata', { keyPath: 'uid' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const legacyTransaction = legacyDatabase.transaction(['events', 'metadata'], 'readwrite');
      const legacyEvents = legacyTransaction.objectStore('events');
      const base = {
        uid: 'sequence-upgrade',
        eventType: 'domain-mutation',
        collection: 'activityEvents',
        documentId: 'legacy-session',
        operation: 'upsert',
        schemaVersion: 1,
        clientUpdatedAtMs: 100,
        deviceId: 'v1-device',
        payload: { minutes: 1 },
        fingerprint: '0123456789abcdef'
      };
      legacyEvents.add({ ...base, key: 'sequence-upgrade:old-later', eventId: 'old-later', mutationId: 'old-later', createdAtMs: 200 });
      legacyEvents.add({ ...base, key: 'sequence-upgrade:old-earlier', eventId: 'old-earlier', mutationId: 'old-earlier', createdAtMs: 100 });
      legacyTransaction.objectStore('metadata').put({ uid: 'sequence-upgrade', deviceId: 'v1-device', schemaVersion: 1 });
      await new Promise<void>((resolve, reject) => {
        legacyTransaction.oncomplete = () => resolve();
        legacyTransaction.onabort = () => reject(legacyTransaction.error);
      });
      legacyDatabase.close();

      const journal = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      const events = await journal.listEvents();
      assert(events.length === 2 && events[0].eventId === 'old-earlier' && events[0].sequence === 1 &&
        events[1].eventId === 'old-later' && events[1].sequence === 2 && events[0].projectionRequired === false,
        'Version 1 events must receive deterministic per-UID sequences');
      let skippedSequenceRejected = false;
      try { await journal.markProjected(2); } catch { skippedSequenceRejected = true; }
      assert(skippedSequenceRejected, 'Projection cursor must not skip an unprojected event');
      assert(await journal.markProjected(1), 'First projection sequence must advance');
      assert(!(await journal.markProjected(1)), 'Repeated projection acknowledgement must be idempotent');
      assert(await journal.markProjected(2), 'Second contiguous projection sequence must advance');
      await journal.enqueue({ mutationId: 'after-upgrade', collection: 'activityEvents', documentId: 'new-session', payload: { minutes: 2 }, nowMs: 300 });
      const afterCursor = await journal.listEventsAfter(2);
      const snapshot = await journal.getSnapshot();
      assert(afterCursor.length === 1 && afterCursor[0].sequence === 3 && afterCursor[0].eventId === 'after-upgrade' && afterCursor[0].projectionRequired === true,
        'New events must continue the sequence and replay after the cursor');
      assert(snapshot.projectionCursor === 2 && snapshot.eventCount === 3,
        'The durable projection cursor must survive and report the contiguous progress');
      journal.close();
    });

    await test('Concurrent cross-tab mutations receive unique monotonic event sequences', async () => {
      const { factory, databaseName, journal } = createJournal();
      const secondTab = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      await Promise.all([
        journal.enqueue({ mutationId: 'sequence-tab-a', collection: 'activityEvents', documentId: 's-a', payload: { minutes: 1 }, nowMs: 500 }),
        secondTab.enqueue({ mutationId: 'sequence-tab-b', collection: 'activityEvents', documentId: 's-b', payload: { minutes: 2 }, nowMs: 500 })
      ]);
      const events = await journal.listEvents();
      assert(events.length === 2 && events[0].sequence === 1 && events[1].sequence === 2,
        'Overlapping read/write transactions must allocate unique contiguous sequences');
      journal.close();
      secondTab.close();
    });

    await test('Journal snapshot creates and preserves a stable device identity', async () => {
      const { journal } = createJournal();
      const first = await journal.getSnapshot();
      const second = await journal.getSnapshot();
      assert(Boolean(first.deviceId) && first.deviceId === second.deviceId,
        'The device identity must be created once and remain stable before any enqueue');
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
      assert(await journal.importLegacyState(legacy) === 'already_migrated', 'Repeated identical migration must be idempotent');
      const extended: LegacyOutboxState = {
        ...legacy,
        pending: [...legacy.pending, {
          mutationId: 'legacy-pending-2',
          collection: 'plans',
          documentId: 'legacy-plan',
          operation: 'upsert',
          schemaVersion: 1,
          clientUpdatedAtMs: 9300,
          deviceId: 'legacy-device-1',
          payload: { pages: 5 },
          queuedAtMs: 9300,
          attemptCount: 0,
          nextAttemptAtMs: 0
        }]
      };
      assert(await journal.importLegacyState(extended) === 'migrated',
        'A changed legacy snapshot must safely merge newly queued operations');
      assert(await journal.importLegacyState(extended) === 'already_migrated',
        'The updated legacy snapshot must also become idempotent');
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      const ready = await journal.listReady(9300);
      assert(snapshot.deviceId === 'legacy-device-1', 'Legacy device identity must be preserved');
      assert(snapshot.pendingCount === 2 && snapshot.acknowledgedCount === 1 && snapshot.eventCount === 2,
        'Pending, acknowledged, and event records must migrate as one logical state');
      assert(ready.length === 2 && ready[0].attemptCount === 2 && ready[0].lastErrorCode === 'NETWORK',
        'Retry metadata must be preserved during migration');
      assert(events.some(event => event.mutationId === 'legacy-pending'), 'The legacy pending mutation must become an immutable event');
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

    await test('Legacy localStorage outbox migrates while retaining a recovery copy', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:legacy-migration-success');
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'legacy-device-migration',
        pending: [{
          mutationId: 'migration-pending',
          collection: 'activityEvents',
          documentId: 'legacy-session-2',
          operation: 'upsert',
          schemaVersion: 1,
          clientUpdatedAtMs: 9100,
          deviceId: 'legacy-device-migration',
          payload: { minutes: 21 },
          queuedAtMs: 9200,
          attemptCount: 1,
          nextAttemptAtMs: 9500
        }],
        acknowledgedIds: ['migration-ack'],
        acknowledgedFingerprints: []
      };
      const raw = JSON.stringify(legacy);
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy outbox fixture must be stored');
      assert(await LocalSyncOutbox.migrateLegacyToIndexedDb() === 'migrated', 'Legacy state must migrate to IndexedDB');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy localStorage source must remain as a recovery copy after migration');
      const journal = new IndexedDbSyncJournal();
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      assert(snapshot.pendingCount === 1 && snapshot.acknowledgedCount === 1 && snapshot.eventCount === 1,
        'Migrated state must be present in IndexedDB');
      assert(events[0].mutationId === 'migration-pending', 'The migrated event must retain its mutation ID');
      journal.close();
    });

    await test('Conflicting legacy migration preserves the localStorage source and commits no partial records', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:legacy-migration-conflict');
      const journal = new IndexedDbSyncJournal();
      await journal.enqueue({ mutationId: 'migration-collision', collection: 'plans', documentId: 'plan-1', payload: { pages: 1 }, nowMs: 9300 });
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'legacy-device-conflict',
        pending: [
          {
            mutationId: 'migration-first',
            collection: 'activityEvents',
            documentId: 'session-first',
            operation: 'upsert',
            schemaVersion: 1,
            clientUpdatedAtMs: 9400,
            deviceId: 'legacy-device-conflict',
            payload: { minutes: 2 },
            queuedAtMs: 9400,
            attemptCount: 0,
            nextAttemptAtMs: 0
          },
          {
            mutationId: 'migration-collision',
            collection: 'plans',
            documentId: 'plan-1',
            operation: 'upsert',
            schemaVersion: 1,
            clientUpdatedAtMs: 9401,
            deviceId: 'legacy-device-conflict',
            payload: { pages: 88 },
            queuedAtMs: 9401,
            attemptCount: 0,
            nextAttemptAtMs: 0
          }
        ],
        acknowledgedIds: [],
        acknowledgedFingerprints: []
      };
      const raw = JSON.stringify(legacy);
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy conflict fixture must be stored');
      let rejected = false;
      try { await LocalSyncOutbox.migrateLegacyToIndexedDb(); } catch { rejected = true; }
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      assert(rejected, 'Conflicting content must stop migration');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy source must remain untouched after conflict');
      assert(snapshot.pendingCount === 1 && snapshot.eventCount === 1 && events.length === 1,
        'No partial migration writes may commit');
      assert(events[0].mutationId === 'migration-collision', 'The pre-existing event must remain intact');
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
