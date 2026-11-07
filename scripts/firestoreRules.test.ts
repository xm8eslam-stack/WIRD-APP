import { readFileSync } from 'node:fs';
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
      writeRevisionedRemoteMutation(alice as unknown as Firestore, {
        ...base, mutationId: 'cas-race-b', eventId: 'cas-race-b', payload: { value: 'B' }
      })
    ]);
    const state = await getDoc(doc(alice, 'users/alice/plans/cas-plan-race'));
    if (results.filter(result => result.status === 'fulfilled').length !== 1 ||
        results.filter(result => result.status === 'rejected').length !== 1 ||
        state.data()?.revision !== 1) {
      throw new Error('Concurrent stale writers did not produce exactly one winner');
    }
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
