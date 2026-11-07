import { readFileSync } from 'node:fs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { writeImmutableRemoteEvent } from '../src/services/immutableRemoteEvent';
import { writeRevisionedRemoteMutation } from '../src/services/revisionedRemoteMutation';
import { IndexedDbSyncJournal, type JournalEvent, type JournalOutboxEntry, type RemoteInboxEventInput } from '../src/services/indexedDbSyncJournal';
import { StorageService, STORAGE_KEYS } from '../src/services/storageService';
import { projectRemoteInboxBatch, type RemoteProjectionDependencies } from '../src/services/remoteInboxProjector';

class IsolatedMemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(String(key)) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(String(key)); }
  setItem(key: string, value: string): void { this.values.set(String(key), String(value)); }
}

function setTestLocalStorage(storage: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage
  });
}

function activateIsolatedDevice(storage: Storage, uid: string): void {
  // StorageService has a process-wide in-memory fallback. Reset it while a
  // throwaway adapter is active, never while either device's durable store is.
  setTestLocalStorage(new IsolatedMemoryStorage());
  StorageService.__resetStorageForTests();
  setTestLocalStorage(storage);
  if (!StorageService.setStorageScope('user:' + uid)) {
    throw new Error('Could not activate isolated storage scope for ' + uid);
  }
}

function makeDeviceProjectorDependencies(journal: IndexedDbSyncJournal): RemoteProjectionDependencies {
  return {
    getRemoteProjectionCursor: () => journal.getRemoteProjectionCursor(),
    listRemoteInboxAfter: (sequence, limit) => journal.listRemoteInboxAfter(sequence, limit),
    getRemoteRevision: (collection, documentId) => journal.getRemoteRevision(collection, documentId),
    hasPendingForCollection: collection => journal.hasPendingForCollection(collection),
    isRemoteCollectionInitialized: collection => journal.isRemoteCollectionInitialized(collection),
    isLocalProjectionEmpty: collection => StorageService.isLocalProjectionEmpty(collection),
    applyJournalEvent: event => StorageService.applyJournalEvent(event),
    setRemoteRevisionFromRemote: (collection, documentId, revision) =>
      journal.setRemoteRevisionFromRemote(collection, documentId, revision),
    markRemoteProjected: sequence => journal.markRemoteProjected(sequence),
    markRemoteCollectionInitialized: collection => journal.markRemoteCollectionInitialized(collection),
    getRemoteProjectionIntent: () => journal.getRemoteProjectionIntent(),
    prepareRemoteProjection: intent => journal.prepareRemoteProjection(intent),
    finalizeRemoteProjection: (intent, applyProjection) =>
      journal.finalizeRemoteProjection(intent, applyProjection)
  };
}

function makeLocalJournalEvent(mutation: JournalOutboxEntry): JournalEvent {
  return {
    key: mutation.uid + ':' + mutation.mutationId,
    uid: mutation.uid,
    eventId: mutation.eventId,
    mutationId: mutation.mutationId,
    eventType: 'domain-mutation',
    collection: mutation.collection,
    documentId: mutation.documentId,
    operation: mutation.operation,
    schemaVersion: 1,
    clientUpdatedAtMs: mutation.clientUpdatedAtMs,
    createdAtMs: mutation.queuedAtMs,
    deviceId: mutation.deviceId,
    payload: mutation.payload,
    fingerprint: mutation.fingerprint,
    sequence: mutation.sequence,
    baseRevision: mutation.baseRevision,
    projectionRequired: true
  };
}

function readRemoteEvent(snapshot: Awaited<ReturnType<typeof getDoc>>): RemoteInboxEventInput {
  if (!snapshot.exists()) throw new Error('The accepted server event is missing.');
  return snapshot.data() as unknown as RemoteInboxEventInput;
}

const projectId = 'demo-wird-rules';
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules }
});

let passed = 0;
let failed = 0;

async function test(name: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const validEnvelope = {
  schemaVersion: 1,
  payload: { displayName: 'WIRD test profile' },
  updatedAtMs: 1_799_000_000_000,
  deviceId: 'test-device-01',
  mutationId: 'mutation-test-0001',
  baseRevision: 0,
  revision: 1
};

try {
  await testEnv.clearFirestore();

  const alice = testEnv.authenticatedContext('alice', {
    email: 'alice@example.com',
    email_verified: true
  }).firestore();
  const aliceDeviceTwo = testEnv.authenticatedContext('alice', {
    email: 'alice@example.com',
    email_verified: true,
    device: 'second-client'
  }).firestore();
  const bob = testEnv.authenticatedContext('bob', {
    email: 'bob@example.com',
    email_verified: true
  }).firestore();
  const unverified = testEnv.authenticatedContext('unverified', {
    email: 'unverified@example.com',
    email_verified: false
  }).firestore();
  const anonymous = testEnv.unauthenticatedContext().firestore();

  const aliceProfile = doc(alice, 'users/alice/profile/main');
  const alicePlan = doc(alice, 'users/alice/plans/plan-1');

  await test('Verified owner can create and read a valid profile envelope', async () => {
    await writeRevisionedRemoteMutation(alice as unknown as Firestore, {
      uid: 'alice',
      collection: 'profile',
      documentId: 'main',
      operation: 'upsert',
      schemaVersion: 1,
      mutationId: 'mutation-test-0001',
      eventId: 'mutation-test-0001',
      deviceId: 'test-device-01',
      clientUpdatedAtMs: validEnvelope.updatedAtMs,
      baseRevision: 0,
      payload: validEnvelope.payload
    });
    await assertSucceeds(getDoc(aliceProfile));
  });

  await test('Verified owner can write allowlisted plan documents', async () => {
    await writeRevisionedRemoteMutation(alice as unknown as Firestore, {
      uid: 'alice',
      collection: 'plans',
      documentId: 'plan-1',
      operation: 'upsert',
      schemaVersion: 1,
      mutationId: 'mutation-plan-0001',
      eventId: 'mutation-plan-0001',
      deviceId: 'test-device-01',
      clientUpdatedAtMs: validEnvelope.updatedAtMs,
      baseRevision: 0,
      payload: { title: 'Test plan', dailyTarget: 5 }
    });
  });

  await test('Verified owner can update a state document only with its exact base revision', async () => {
    await writeRevisionedRemoteMutation(alice as unknown as Firestore, {
      uid: 'alice',
      collection: 'profile',
      documentId: 'main',
      operation: 'upsert',
      schemaVersion: 1,
      mutationId: 'mutation-test-0002',
      eventId: 'mutation-test-0002',
      deviceId: 'test-device-01',
      clientUpdatedAtMs: 1_799_000_000_001,
      baseRevision: 1,
      payload: { displayName: 'WIRD revision 2' }
    });
  });

  await test('Stale revision and legacy unversioned writes are denied', async () => {
    await assertFails(setDoc(aliceProfile, {
      ...validEnvelope,
      payload: { displayName: 'stale overwrite' },
      mutationId: 'stale-mutation',
      baseRevision: 1,
      revision: 2
    }));
    const { baseRevision: _baseRevision, revision: _revision, ...legacyEnvelope } = validEnvelope;
    await assertFails(setDoc(doc(alice, 'users/alice/plans/legacy-write'), legacyEnvelope));
  });


  await test('Unauthenticated users cannot read or write user documents', async () => {
    await assertFails(getDoc(doc(anonymous, 'users/alice/profile/main')));
    await assertFails(setDoc(doc(anonymous, 'users/anonymous/profile/main'), validEnvelope));
  });

  await test('Unverified users cannot read or write user documents', async () => {
    await assertFails(getDoc(doc(unverified, 'users/unverified/profile/main')));
    await assertFails(setDoc(doc(unverified, 'users/unverified/profile/main'), validEnvelope));
  });

  await test('A verified user cannot read or write another UID path', async () => {
    await assertFails(getDoc(doc(bob, 'users/alice/profile/main')));
    await assertFails(setDoc(doc(bob, 'users/alice/plans/foreign-plan'), validEnvelope));
  });

  await test('Unknown collections and nested subcollections are denied', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice/admin/secret'), validEnvelope));
    await assertFails(setDoc(doc(alice, 'users/alice/plans/plan-1/private/nested'), validEnvelope));
  });

  await test('Malformed envelopes and unexpected top-level fields are denied', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice/plans/missing-mutation'), {
      schemaVersion: 1,
      payload: {},
      updatedAtMs: 1_799_000_000_000,
      deviceId: 'device-1'
    }));
    await assertFails(setDoc(doc(alice, 'users/alice/plans/extra-field'), {
      ...validEnvelope,
      admin: true
    }));
    await assertFails(setDoc(doc(alice, 'users/alice/plans/wrong-payload'), {
      ...validEnvelope,
      payload: 'not-a-map'
    }));
    await assertFails(setDoc(doc(alice, 'users/alice/plans/wrong-version'), {
      ...validEnvelope,
      schemaVersion: 2
    }));
  });

  await test('Oversized device and mutation identifiers are denied', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice/plans/long-device'), {
      ...validEnvelope,
      deviceId: 'd'.repeat(129)
    }));
    await assertFails(setDoc(doc(alice, 'users/alice/plans/long-mutation'), {
      ...validEnvelope,
      mutationId: 'm'.repeat(129)
    }));
  });

  await test('Valid tombstones are accepted but physical deletes are denied', async () => {
    await writeRevisionedRemoteMutation(alice as unknown as Firestore, {
      uid: 'alice',
      collection: 'plans',
      documentId: 'deleted-plan',
      operation: 'tombstone',
      schemaVersion: 1,
      mutationId: 'mutation-tombstone-0001',
      eventId: 'mutation-tombstone-0001',
      deviceId: 'test-device-01',
      clientUpdatedAtMs: validEnvelope.updatedAtMs,
      baseRevision: 0,
      payload: { deleted: true }
    });
    await assertFails(deleteDoc(alicePlan));
  });

  await test('Invalid tombstone timestamps are denied', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice/plans/bad-tombstone'), {
      ...validEnvelope,
      mutationId: 'mutation-bad-tombstone',
      deletedAt: 'not-a-timestamp'
    }));
  });

  const validEvent = {
    schemaVersion: 1 as const,
    eventId: 'event-alice-001',
    mutationId: 'mutation-test-0001',
    uid: 'alice',
    deviceId: 'test-device-01',
    occurredAtMs: 1_799_000_000_000,
    eventType: 'session.completed',
    payload: { memorizedAyahs: 5 }
  };

  await test('Verified owner can append a valid domain event to the ledger', async () => {
    const eventRef = doc(alice, 'users/alice/events/event-alice-001');
    await assertSucceeds(setDoc(eventRef, validEvent));
    await assertSucceeds(getDoc(eventRef));
  });

  await test('Revisioned remote mutation creates once and retries idempotently', async () => {
    const input = {
      uid: 'alice',
      collection: 'plans' as const,
      documentId: 'cas-plan-1',
      operation: 'upsert' as const,
      schemaVersion: 1 as const,
      mutationId: 'cas-mutation-1',
      eventId: 'cas-mutation-1',
      deviceId: 'test-device-01',
      clientUpdatedAtMs: 1_799_000_000_100,
      baseRevision: 0,
      payload: { records: [{ id: 'plan-1', title: 'First' }] }
    };
    const first = await writeRevisionedRemoteMutation(alice as unknown as Firestore, input);
    const retry = await writeRevisionedRemoteMutation(alice as unknown as Firestore, input);
    const state = await getDoc(doc(alice, 'users/alice/plans/cas-plan-1'));
    if (first.status !== 'written' || first.revision !== 1 || first.serverSequence < 1 ||
        retry.status !== 'already_applied' || retry.revision !== 1 ||
        retry.serverSequence !== first.serverSequence || state.data()?.revision !== 1) {
      throw new Error('CAS create/retry did not converge on one revision and server sequence');
    }
  });

  await test('A client with the current base revision can advance the same document', async () => {
    const base = {
      uid: 'alice',
      collection: 'plans' as const,
      documentId: 'cas-plan-update',
      operation: 'upsert' as const,
      schemaVersion: 1 as const,
      deviceId: 'test-device-01',
      clientUpdatedAtMs: 1_799_000_000_150
    };
    const first = await writeRevisionedRemoteMutation(alice as unknown as Firestore, {
      ...base, mutationId: 'cas-update-first', eventId: 'cas-update-first',
      baseRevision: 0, payload: { title: 'Revision one' }
    });
    const second = await writeRevisionedRemoteMutation(alice as unknown as Firestore, {
      ...base, mutationId: 'cas-update-second', eventId: 'cas-update-second',
      clientUpdatedAtMs: 1_799_000_000_151,
      baseRevision: first.revision, payload: { title: 'Revision two' }
    });
    const state = await getDoc(doc(alice, 'users/alice/plans/cas-plan-update'));
    if (first.revision !== 1 || second.revision !== 2 ||
        second.serverSequence !== first.serverSequence + 1 ||
        state.data()?.payload?.title !== 'Revision two') {
      throw new Error('A valid CAS update did not advance its revision and global server sequence');
    }
  });

  await test('Stale base revision cannot overwrite a newer remote snapshot', async () => {
    const first = {
      uid: 'alice',
      collection: 'plans' as const,
      documentId: 'cas-plan-stale',
      operation: 'upsert' as const,
      schemaVersion: 1 as const,
      mutationId: 'cas-stale-first',
      eventId: 'cas-stale-first',
      deviceId: 'test-device-01',
      clientUpdatedAtMs: 1_799_000_000_200,
      baseRevision: 0,
      payload: { records: [{ id: 'plan-1', title: 'Remote wins first' }] }
    };
    await writeRevisionedRemoteMutation(alice as unknown as Firestore, first);
    let rejected = false;
    try {
      await writeRevisionedRemoteMutation(alice as unknown as Firestore, {
        ...first,
        mutationId: 'cas-stale-second',
        eventId: 'cas-stale-second',
        payload: { records: [{ id: 'plan-1', title: 'Stale overwrite' }] }
      });
    } catch (error) {
      rejected = error instanceof Error && error.message === 'REMOTE_REVISION_CONFLICT';
    }
    const state = await getDoc(doc(alice, 'users/alice/plans/cas-plan-stale'));
    if (!rejected || state.data()?.payload?.records?.[0]?.title !== 'Remote wins first' ||
        state.data()?.revision !== 1) {
      throw new Error('Stale write changed a newer remote snapshot');
    }
  });

  await test('Concurrent writers from the same base revision produce one winner', async () => {
    const base = {
      uid: 'alice',
      collection: 'plans' as const,
      documentId: 'cas-plan-race',
      operation: 'upsert' as const,
      schemaVersion: 1 as const,
      deviceId: 'test-device-01',
      clientUpdatedAtMs: 1_799_000_000_300,
      baseRevision: 0
    };
    const results = await Promise.allSettled([
      writeRevisionedRemoteMutation(alice as unknown as Firestore, {
        ...base, mutationId: 'cas-race-a', eventId: 'cas-race-a', payload: { value: 'A' }
      }),
      writeRevisionedRemoteMutation(aliceDeviceTwo as unknown as Firestore, {
        ...base, deviceId: 'test-device-02',
        mutationId: 'cas-race-b', eventId: 'cas-race-b', payload: { value: 'B' }
      })
    ]);
    const state = await getDoc(doc(alice, 'users/alice/plans/cas-plan-race'));
    if (results.filter(result => result.status === 'fulfilled').length !== 1 ||
        results.filter(result => result.status === 'rejected').length !== 1 ||
        state.data()?.revision !== 1) {
      throw new Error('Concurrent stale writers did not produce exactly one winner');
    }
  });

  await test('Two devices can update independent documents with one contiguous server sequence', async () => {
    const sequenceRef = doc(alice, 'users/alice/syncSystem/remoteReplication');
    const before = await getDoc(sequenceRef);
    const baseSequence = before.exists() ? before.data().sequence : 0;
    const firstInput = {
      uid: 'alice',
      collection: 'plans' as const,
      operation: 'upsert' as const,
      schemaVersion: 1 as const,
      clientUpdatedAtMs: 1_799_000_000_350,
      baseRevision: 0
    };
    const results = await Promise.all([
      writeRevisionedRemoteMutation(alice as unknown as Firestore, {
        ...firstInput,
        documentId: 'cas-independent-a',
        mutationId: 'cas-independent-a',
        eventId: 'cas-independent-a',
        deviceId: 'test-device-01',
        payload: { records: [{ id: 'a' }] }
      }),
      writeRevisionedRemoteMutation(aliceDeviceTwo as unknown as Firestore, {
        ...firstInput,
        documentId: 'cas-independent-b',
        mutationId: 'cas-independent-b',
        eventId: 'cas-independent-b',
        deviceId: 'test-device-02',
        payload: { records: [{ id: 'b' }] }
      })
    ]);
    const sequences = results.map(result => result.serverSequence).sort((a, b) => a - b);
    const [stateA, stateB, after] = await Promise.all([
      getDoc(doc(alice, 'users/alice/plans/cas-independent-a')),
      getDoc(doc(alice, 'users/alice/plans/cas-independent-b')),
      getDoc(sequenceRef)
    ]);
    if (sequences[0] !== baseSequence + 1 || sequences[1] !== baseSequence + 2 ||
        stateA.data()?.revision !== 1 || stateB.data()?.revision !== 1 ||
        after.data()?.sequence !== baseSequence + 2) {
      throw new Error('Independent device writes did not receive a contiguous global server sequence');
    }
  });

  await test('Firestore rules reject a routed event without its atomic state and sequence writes', async () => {
    const eventRef = doc(alice, 'users/alice/events/forged-routed-event');
    await assertFails(setDoc(eventRef, {
      schemaVersion: 2,
      eventId: 'forged-routed-event',
      mutationId: 'forged-routed-event',
      uid: 'alice',
      deviceId: 'test-device-01',
      occurredAtMs: 1_799_000_000_400,
      eventType: 'domain-mutation',
      payload: { records: [] },
      collection: 'plans',
      documentId: 'forged-plan',
      operation: 'upsert',
      baseRevision: 0,
      revision: 1,
      serverSequence: 999
    }));
  });

  await test('Firestore rules reject a server sequence gap without a matching immutable event', async () => {
    const sequenceRef = doc(alice, 'users/alice/syncSystem/remoteReplication');
    const current = await getDoc(sequenceRef);
    const baseSequence = current.exists() ? current.data().sequence : 0;
    await assertFails(setDoc(sequenceRef, {
      schemaVersion: 1,
      sequence: baseSequence + 1,
      baseSequence,
      lastEventId: 'missing-sequence-event',
      updatedAtMs: 1_799_000_000_401,
      deviceId: 'test-device-01',
      mutationId: 'missing-sequence-event'
    }));
  });

  await test('Immutable event helper treats an identical retry as a successful no-op', async () => {
    const event = { ...validEvent, eventId: 'event-idempotent-001', mutationId: 'mutation-idempotent-001' };
    const first = await writeImmutableRemoteEvent(alice as unknown as Firestore, 'alice', event);
    const retry = await writeImmutableRemoteEvent(alice as unknown as Firestore, 'alice', { ...event, payload: { memorizedAyahs: 5 } });
    const stored = await getDoc(doc(alice, 'users/alice/events/event-idempotent-001'));
    if (first !== 'created' || retry !== 'already_exists' || !stored.exists() ||
        stored.data().payload.memorizedAyahs !== 5) {
      throw new Error('Identical retry did not preserve one immutable event');
    }
  });

  await test('Immutable event helper rejects event-ID reuse with different content', async () => {
    const event = { ...validEvent, eventId: 'event-collision-001', mutationId: 'mutation-collision-001' };
    await writeImmutableRemoteEvent(alice as unknown as Firestore, 'alice', event);
    let rejected = false;
    try {
      await writeImmutableRemoteEvent(alice as unknown as Firestore, 'alice', {
        ...event,
        payload: { memorizedAyahs: 99 }
      });
    } catch (error) {
      rejected = error instanceof Error && error.message === 'REMOTE_EVENT_ID_COLLISION';
    }
    const stored = await getDoc(doc(alice, 'users/alice/events/event-collision-001'));
    if (!rejected || stored.data()?.payload?.memorizedAyahs !== 5) {
      throw new Error('Event collision changed or failed to protect the original event');
    }
  });

  await test('Concurrent identical event deliveries converge on one immutable event', async () => {
    const event = { ...validEvent, eventId: 'event-race-001', mutationId: 'mutation-race-001' };
    const results = await Promise.all([
      writeImmutableRemoteEvent(alice as unknown as Firestore, 'alice', event),
      writeImmutableRemoteEvent(alice as unknown as Firestore, 'alice', { ...event, payload: { memorizedAyahs: 5 } })
    ]);
    const stored = await getDoc(doc(alice, 'users/alice/events/event-race-001'));
    if (results.filter(result => result === 'created').length !== 1 ||
        results.filter(result => result === 'already_exists').length !== 1 ||
        !stored.exists()) {
      throw new Error('Concurrent event retries did not converge to one event');
    }
  });


  await test('Two isolated devices exchange profile changes through Firestore and independent IndexedDB/localStorage', async () => {
    const uid = 'device-pair';
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const originalIDBKeyRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange');
    Object.defineProperty(globalThis, 'IDBKeyRange', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: IDBKeyRange
    });
    const localStorageA = new IsolatedMemoryStorage();
    const localStorageB = new IsolatedMemoryStorage();
    const factoryA = new IDBFactory();
    const factoryB = new IDBFactory();
    const journalA = new IndexedDbSyncJournal({
      indexedDBFactory: factoryA,
      databaseName: 'wird-device-pair-a'
    });
    const journalB = new IndexedDbSyncJournal({
      indexedDBFactory: factoryB,
      databaseName: 'wird-device-pair-b'
    });
    try {
      const devicePairA = testEnv.authenticatedContext(uid, {
        email: 'device-pair@example.com',
        email_verified: true,
        device: 'device-a'
      }).firestore();
      const devicePairB = testEnv.authenticatedContext(uid, {
        email: 'device-pair@example.com',
        email_verified: true,
        device: 'device-b'
      }).firestore();

      activateIsolatedDevice(localStorageA, uid);
      const profileA = { ...StorageService.getProfile(), name: 'حافظ الجهاز الأول' };
      const queuedA = await journalA.enqueue({
        mutationId: 'device-pair-a-001',
        collection: 'profile',
        documentId: 'main',
        payload: { profile: profileA },
        nowMs: 1_799_000_000_500
      });
      if (queuedA.status !== 'queued' || !StorageService.applyJournalEvent(makeLocalJournalEvent(queuedA.mutation))) {
        throw new Error('Device A could not durably queue and locally apply its profile mutation.');
      }
      const serverA = await writeRevisionedRemoteMutation(devicePairA as unknown as Firestore, {
        uid,
        collection: 'profile',
        documentId: 'main',
        operation: 'upsert',
        schemaVersion: 1,
        mutationId: queuedA.mutation.mutationId,
        eventId: queuedA.mutation.eventId,
        deviceId: queuedA.mutation.deviceId,
        clientUpdatedAtMs: queuedA.mutation.clientUpdatedAtMs,
        baseRevision: queuedA.mutation.baseRevision,
        payload: queuedA.mutation.payload
      });
      await journalA.acknowledgeRemoteMutation(queuedA.mutation.mutationId, serverA.revision, 1_799_000_000_501);
      const eventA = readRemoteEvent(await getDoc(doc(
        devicePairA,
        'users', uid, 'events', queuedA.mutation.eventId
      )));
      if (eventA.serverSequence !== 1 || serverA.revision !== 1) {
        throw new Error('Device A did not receive the first server revision and sequence.');
      }

      await journalA.importRemotePage([eventA]);
      activateIsolatedDevice(localStorageA, uid);
      const ownEventProjection = await projectRemoteInboxBatch(10, makeDeviceProjectorDependencies(journalA));
      if (ownEventProjection.projectedCount !== 1 || ownEventProjection.reason) {
        throw new Error('Device A could not reconcile its own acknowledged event.');
      }

      await journalB.importRemotePage([eventA]);
      activateIsolatedDevice(localStorageB, uid);
      const firstProjection = await projectRemoteInboxBatch(10, makeDeviceProjectorDependencies(journalB));
      const receivedProfile = StorageService.getProfile();
      if (firstProjection.projectedCount !== 1 || firstProjection.reason ||
          receivedProfile.name !== profileA.name) {
        throw new Error('Device B did not project Device A’s server-accepted profile.');
      }

      const profileB = {
        ...receivedProfile,
        memorizationGoal: 'تثبيت الحفظ بالمراجعة المتدرجة'
      };
      const queuedB = await journalB.enqueue({
        mutationId: 'device-pair-b-001',
        collection: 'profile',
        documentId: 'main',
        payload: { profile: profileB },
        nowMs: 1_799_000_000_600
      });
      if (queuedB.status !== 'queued' || queuedB.mutation.baseRevision !== 1 ||
          !StorageService.applyJournalEvent(makeLocalJournalEvent(queuedB.mutation))) {
        throw new Error('Device B did not build its next mutation on the received server revision.');
      }
      const serverB = await writeRevisionedRemoteMutation(devicePairB as unknown as Firestore, {
        uid,
        collection: 'profile',
        documentId: 'main',
        operation: 'upsert',
        schemaVersion: 1,
        mutationId: queuedB.mutation.mutationId,
        eventId: queuedB.mutation.eventId,
        deviceId: queuedB.mutation.deviceId,
        clientUpdatedAtMs: queuedB.mutation.clientUpdatedAtMs,
        baseRevision: queuedB.mutation.baseRevision,
        payload: queuedB.mutation.payload
      });
      await journalB.acknowledgeRemoteMutation(queuedB.mutation.mutationId, serverB.revision, 1_799_000_000_601);
      const eventB = readRemoteEvent(await getDoc(doc(
        devicePairB,
        'users', uid, 'events', queuedB.mutation.eventId
      )));
      if (eventB.serverSequence !== 2 || serverB.revision !== 2) {
        throw new Error('Device B did not receive the next contiguous server revision and sequence.');
      }

      activateIsolatedDevice(localStorageA, uid);
      const profileBeforeBEvent = StorageService.getProfile();
      if (profileBeforeBEvent.memorizationGoal === profileB.memorizationGoal) {
        throw new Error('Device A observed Device B’s local-only change before receiving its remote event.');
      }
      await journalA.importRemotePage([eventB]);
      const secondProjectionA = await projectRemoteInboxBatch(10, makeDeviceProjectorDependencies(journalA));
      if (secondProjectionA.projectedCount !== 1 || secondProjectionA.reason) {
        throw new Error('Device A did not project Device B’s acknowledged update.');
      }

      await journalB.importRemotePage([eventB]);
      activateIsolatedDevice(localStorageB, uid);
      const ownEventB = await projectRemoteInboxBatch(10, makeDeviceProjectorDependencies(journalB));
      if (ownEventB.projectedCount !== 1 || ownEventB.reason) {
        throw new Error('Device B could not reconcile its own acknowledged event.');
      }

      activateIsolatedDevice(localStorageA, uid);
      const finalProfileA = StorageService.getProfile();
      const snapshotA = await journalA.getSnapshot();
      const cursorA = await journalA.getRemoteProjectionCursor();
      const revisionA = await journalA.getRemoteRevision('profile', 'main');
      activateIsolatedDevice(localStorageB, uid);
      const finalProfileB = StorageService.getProfile();
      const snapshotB = await journalB.getSnapshot();
      const cursorB = await journalB.getRemoteProjectionCursor();
      const revisionB = await journalB.getRemoteRevision('profile', 'main');

      if (localStorageA === localStorageB ||
          snapshotA.deviceId === snapshotB.deviceId ||
          snapshotA.pendingCount !== 0 || snapshotB.pendingCount !== 0 ||
          cursorA !== 2 || cursorB !== 2 ||
          revisionA?.revision !== 2 || revisionB?.revision !== 2 ||
          finalProfileA.name !== finalProfileB.name ||
          finalProfileA.memorizationGoal !== profileB.memorizationGoal ||
          finalProfileB.memorizationGoal !== profileB.memorizationGoal) {
        throw new Error('Two independent devices did not converge on the same profile, revision, and projection cursor.');
      }
    } finally {
      journalA.close();
      journalB.close();
      setTestLocalStorage(new IsolatedMemoryStorage());
      StorageService.__resetStorageForTests();
      if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
      else Reflect.deleteProperty(globalThis, 'localStorage');
      if (originalIDBKeyRange) Object.defineProperty(globalThis, 'IDBKeyRange', originalIDBKeyRange);
      else Reflect.deleteProperty(globalThis, 'IDBKeyRange');
    }
  });

  await test('Offline competing devices retain the losing local mutation and block stale remote projection', async () => {
    const uid = 'offline-conflict-pair';
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const originalIDBKeyRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange');
    Object.defineProperty(globalThis, 'IDBKeyRange', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: IDBKeyRange
    });
    const localStorageA = new IsolatedMemoryStorage();
    const localStorageB = new IsolatedMemoryStorage();
    const journalA = new IndexedDbSyncJournal({
      indexedDBFactory: new IDBFactory(),
      databaseName: 'wird-offline-conflict-a'
    });
    const journalB = new IndexedDbSyncJournal({
      indexedDBFactory: new IDBFactory(),
      databaseName: 'wird-offline-conflict-b'
    });
    try {
      const firestoreA = testEnv.authenticatedContext(uid, {
        email: 'offline-conflict@example.com',
        email_verified: true,
        device: 'offline-a'
      }).firestore();
      const firestoreB = testEnv.authenticatedContext(uid, {
        email: 'offline-conflict@example.com',
        email_verified: true,
        device: 'offline-b'
      }).firestore();

      activateIsolatedDevice(localStorageA, uid);
      const localProfileA = { ...StorageService.getProfile(), name: 'نسخة الجهاز A' };
      const mutationA = await journalA.enqueue({
        mutationId: 'offline-conflict-a-001',
        collection: 'profile',
        documentId: 'main',
        payload: { profile: localProfileA },
        nowMs: 1_799_000_100_001
      });
      if (mutationA.status !== 'queued' || !StorageService.applyJournalEvent(makeLocalJournalEvent(mutationA.mutation))) {
        throw new Error('Device A could not persist its offline profile edit.');
      }

      activateIsolatedDevice(localStorageB, uid);
      const localProfileB = { ...StorageService.getProfile(), name: 'نسخة الجهاز B' };
      const mutationB = await journalB.enqueue({
        mutationId: 'offline-conflict-b-001',
        collection: 'profile',
        documentId: 'main',
        payload: { profile: localProfileB },
        nowMs: 1_799_000_100_002
      });
      if (mutationB.status !== 'queued' || !StorageService.applyJournalEvent(makeLocalJournalEvent(mutationB.mutation))) {
        throw new Error('Device B could not persist its competing offline profile edit.');
      }

      const accepted = await writeRevisionedRemoteMutation(firestoreA as unknown as Firestore, {
        uid,
        collection: 'profile',
        documentId: 'main',
        operation: 'upsert',
        schemaVersion: 1,
        mutationId: mutationA.mutation.mutationId,
        eventId: mutationA.mutation.eventId,
        deviceId: mutationA.mutation.deviceId,
        clientUpdatedAtMs: mutationA.mutation.clientUpdatedAtMs,
        baseRevision: mutationA.mutation.baseRevision,
        payload: mutationA.mutation.payload
      });
      await journalA.acknowledgeRemoteMutation(mutationA.mutation.mutationId, accepted.revision, 1_799_000_100_003);
      let conflictCode = '';
      try {
        await writeRevisionedRemoteMutation(firestoreB as unknown as Firestore, {
          uid,
          collection: 'profile',
          documentId: 'main',
          operation: 'upsert',
          schemaVersion: 1,
          mutationId: mutationB.mutation.mutationId,
          eventId: mutationB.mutation.eventId,
          deviceId: mutationB.mutation.deviceId,
          clientUpdatedAtMs: mutationB.mutation.clientUpdatedAtMs,
          baseRevision: mutationB.mutation.baseRevision,
          payload: mutationB.mutation.payload
        });
      } catch (error) {
        conflictCode = error instanceof Error ? error.message : String(error);
      }
      if (conflictCode !== 'REMOTE_REVISION_CONFLICT') {
        throw new Error('The stale offline write was not rejected as an explicit revision conflict: ' + conflictCode);
      }

      const acceptedEvent = readRemoteEvent(await getDoc(doc(
        firestoreA, 'users', uid, 'events', mutationA.mutation.eventId
      )));
      await journalB.importRemotePage([acceptedEvent]);
      activateIsolatedDevice(localStorageB, uid);
      const blocked = await projectRemoteInboxBatch(10, makeDeviceProjectorDependencies(journalB));
      const retainedOutbox = await journalB.listPending();
      const retainedInbox = await journalB.listRemoteInboxAfter(0, 10);
      const serverSnapshot = await getDoc(doc(firestoreA, 'users', uid, 'profile', 'main'));
      if (blocked.reason !== 'blocked_pending_local' || blocked.blockedAtSequence !== 1 ||
          await journalB.getRemoteProjectionCursor() !== 0 ||
          retainedOutbox.length !== 1 || retainedOutbox[0].mutationId !== mutationB.mutation.mutationId ||
          retainedInbox.length !== 1 || !serverSnapshot.exists() ||
          serverSnapshot.data().payload.profile.name !== localProfileA.name ||
          StorageService.getProfile().name !== localProfileB.name) {
        throw new Error('The offline conflict did not preserve both local intent and remote event without advancing the cursor.');
      }
    } finally {
      journalA.close();
      journalB.close();
      setTestLocalStorage(new IsolatedMemoryStorage());
      StorageService.__resetStorageForTests();
      if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
      else Reflect.deleteProperty(globalThis, 'localStorage');
      if (originalIDBKeyRange) Object.defineProperty(globalThis, 'IDBKeyRange', originalIDBKeyRange);
      else Reflect.deleteProperty(globalThis, 'IDBKeyRange');
    }
  });

  await test('Domain events are immutable: update and delete are strictly denied', async () => {
    const eventRef = doc(alice, 'users/alice/events/event-alice-001');
    await assertFails(setDoc(eventRef, { ...validEvent, eventType: 'tampered' }));
    await assertFails(deleteDoc(eventRef));
  });

  await test('Domain events with mismatched UID or eventId are denied', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice/events/mismatched-id'), validEvent));
    await assertFails(setDoc(doc(alice, 'users/alice/events/event-alice-002'), {
      ...validEvent,
      eventId: 'event-alice-002',
      uid: 'bob'
    }));
  });
} finally {
  await testEnv.cleanup();
}

console.log(`\nFirestore rules: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
