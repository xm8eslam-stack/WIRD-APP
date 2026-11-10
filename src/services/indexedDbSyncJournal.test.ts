import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { fingerprintConflictSnapshot, IndexedDbSyncJournal } from './indexedDbSyncJournal';
import type { LegacyOutboxState } from './indexedDbSyncJournal';
import { STORAGE_KEYS, StorageService } from './storageService';
import { LocalSyncOutbox, type SyncCollection } from './localSyncOutbox';
import { adjustRuqyahProgressCounter, createEmptyRuqyahProgressSnapshot } from './ruqyahProgressSchema';

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

    await test('Unsupported local tombstones are rejected before creating an unreplayable journal event', async () => {
      const { journal } = createJournal('unsupported-tombstone');
      let rejected = false;
      try {
        await journal.enqueue({
          mutationId: 'unsupported-local-delete',
          collection: 'plans',
          documentId: 'snapshot',
          operation: 'tombstone',
          payload: {},
          nowMs: 1500
        });
      } catch { rejected = true; }
      const snapshot = await journal.getSnapshot();
      assert(rejected, 'A tombstone without collection-specific local delete semantics must fail closed');
      assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0 && snapshot.projectionCursor === 0,
        'Rejecting an unsupported tombstone must not leave a permanently blocking event');
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

    await test('V2 Ruqyah migration supersedes pending V1 uploads but preserves their immutable journal events', async () => {
      const { journal } = createJournal('ruqyah-v1-outbox-migration');
      const legacySnapshot = {
        schemaVersion: 1 as const,
        updatedAtMs: 400000,
        counts: { 'q-fatiha': 6 }
      };
      await journal.enqueue({
        mutationId: 'ruqyah-v1-pending-mutation',
        collection: 'ruqyahProgress',
        documentId: 'snapshot',
        payload: { snapshot: legacySnapshot },
        nowMs: 400001
      });
      const v2Snapshot = adjustRuqyahProgressCounter(
        createEmptyRuqyahProgressSnapshot(400002),
        'q-fatiha',
        'current-device',
        6,
        400003
      );
      const migrated = await journal.enqueue({
        mutationId: 'ruqyah-v2-migrated-mutation',
        collection: 'ruqyahProgress',
        documentId: 'snapshot',
        payload: { snapshot: v2Snapshot },
        nowMs: 400003
      });
      const pending = await journal.listReady(400100, 10);
      const events = await journal.listEvents();
      assert(migrated.status === 'queued' && pending.length === 1 &&
        pending[0].mutationId === 'ruqyah-v2-migrated-mutation' &&
        pending[0].sequence === 2,
        'A V2 full snapshot must replace only pending V1 Ruqyah uploads so an old client payload cannot overwrite PN components');
      assert(events.length === 2 &&
        events.some(event => event.mutationId === 'ruqyah-v1-pending-mutation' &&
          (event.payload.snapshot as { schemaVersion: number }).schemaVersion === 1) &&
        events.some(event => event.mutationId === 'ruqyah-v2-migrated-mutation'),
        'Superseding the old Outbox entry must not mutate or delete its append-only journal event');
      journal.close();
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

    await test('Collection-wide pending guards and remote initialization metadata are durable', async () => {
      const { journal } = createJournal('remote-projection-guards');
      await journal.enqueue({
        mutationId: 'pending-plan-snapshot',
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: [{ id: 'p1' }] },
        nowMs: 7500
      });
      assert(await journal.hasPendingForCollection('plans'),
        'A pending snapshot blocks remote projection for the entire collection');
      assert(await journal.hasPendingForDocument('plans', 'snapshot'),
        'Document-level pending lookup remains available');
      assert(!(await journal.hasPendingForCollection('tests')),
        'An unrelated collection remains independently projectable');
      assert(await journal.setRemoteRevisionFromRemote('plans', 'snapshot', 1),
        'A successfully applied remote event must persist its server revision');
      const revision = await journal.getRemoteRevision('plans', 'snapshot');
      assert(revision?.revision === 1 && revision.localSequence === 1,
        'Remote revision metadata records the local sequence high-water mark');
      assert(await journal.isRemoteCollectionInitialized('plans'),
        'Applying the first remote snapshot marks its collection initialized');
      assert(await journal.markRemoteCollectionInitialized('tests') &&
        await journal.isRemoteCollectionInitialized('tests'),
        'Collections touched by a remote transaction can be marked initialized');
      journal.close();
    });

    await test('Conflict resolution decision intent is UID-bound, immutable, restart-safe, and non-destructive', async () => {
      const uid = 'resolution-intent-owner';
      const { factory, databaseName, journal } = createJournal(uid);
      const event = {
        uid,
        eventId: 'resolution-intent-event',
        mutationId: 'resolution-intent-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'resolution-intent-plan',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9250,
        payload: { records: [{ id: 'remote-plan' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'resolution-intent-local-mutation',
        collection: 'plans',
        documentId: event.documentId,
        payload: { records: [{ id: 'local-plan' }] },
        nowMs: 9251
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      assert(await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', {
        wird_plans: '[{"id":"local-plan"}]'
      }, 9252), 'The source conflict must be archived before a decision can be prepared');
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const archived = (conflict.localMutations || []).map(item => ({
        mutationId: item.mutationId,
        fingerprint: item.fingerprint
      }));
      const input = {
        decisionId: 'resolution-decision-1',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(conflict.localSnapshot),
        decision: 'keep-local' as const,
        baseRevision: 1,
        payload: { records: [{ id: 'chosen-local' }] },
        localMutationFingerprints: archived,
        nowMs: 9253
      };
      let staleSnapshotRejected = false;
      try {
        await journal.prepareConflictResolutionIntent({
          ...input,
          decisionId: 'resolution-decision-stale-snapshot',
          localSnapshotFingerprint: '0000000000000000'
        });
      } catch { staleSnapshotRejected = true; }
      assert(staleSnapshotRejected,
        'A decision must be rejected if the raw local snapshot changed after the user inspected the conflict');
      assert(await journal.prepareConflictResolutionIntent(input),
        'A decision must persist only when bound to the open event, latest supplied base revision, and archived local evidence');
      assert(await journal.prepareConflictResolutionIntent(input),
        'Retrying the exact same decision intent must be idempotent');
      let automaticCursorAdvanceRejected = false;
      try { await journal.markRemoteProjected(1); } catch { automaticCursorAdvanceRejected = true; }
      const projectionIntent = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: [] as SyncCollection[]
      };
      await journal.prepareRemoteProjection(projectionIntent);
      let automaticProjectionRejected = false;
      try { await journal.finalizeRemoteProjection(projectionIntent, () => true); }
      catch { automaticProjectionRejected = true; }
      assert(automaticCursorAdvanceRejected && automaticProjectionRejected &&
        await journal.getRemoteProjectionCursor() === 0 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 1,
        'A prepared user decision must block automatic projection/cursor reconciliation until an explicit executor consumes it');
      const saved = await journal.getConflictResolutionIntent(event.eventId);
      assert(!!saved && saved.uid === uid && saved.decisionId === input.decisionId &&
        saved.decision === 'keep-local' && saved.baseRevision === 1 &&
        saved.eventFingerprint === storedEvent.fingerprint &&
        saved.localMutationFingerprints.length === 1 &&
        saved.localMutationFingerprints[0].mutationId === 'resolution-intent-local-mutation' &&
        saved.status === 'prepared',
        'The persisted decision must retain exact UID, event, revision, decision, and mutation evidence');
      let changedDecisionRejected = false;
      try {
        await journal.prepareConflictResolutionIntent({
          ...input,
          payload: { records: [{ id: 'different-choice' }] }
        });
      } catch { changedDecisionRejected = true; }
      assert(changedDecisionRejected,
        'A second different decision cannot overwrite an already prepared immutable decision');
      let staleRevisionRejected = false;
      try {
        await journal.prepareConflictResolutionIntent({
          ...input,
          decisionId: 'resolution-decision-stale',
          baseRevision: 0
        });
      } catch { staleRevisionRejected = true; }
      assert(staleRevisionRejected, 'A decision cannot be prepared against a revision older than the conflicting event');
      assert(await journal.getRemoteProjectionCursor() === 0 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 1 &&
        (await journal.listReady(9300, 10)).some(item => item.mutationId === 'resolution-intent-local-mutation') &&
        (await journal.listProjectionConflicts(10)).length === 1,
        'Preparing a decision must not delete local writes, alter the inbox, resolve the conflict, or advance either cursor');

      journal.close();
      const restarted = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      const recovered = await restarted.getConflictResolutionIntent(event.eventId);
      assert(!!recovered && recovered.fingerprint === saved?.fingerprint &&
        recovered.decisionId === input.decisionId,
        'A prepared decision must survive closing and reopening the IndexedDB database');
      StorageService.setStorageScope('user:another-account');
      assert(await restarted.getConflictResolutionIntent(event.eventId) === null,
        'A different UID cannot read another account\'s prepared decision');
      StorageService.setStorageScope('user:' + uid);
      assert((await restarted.getConflictResolutionIntent(event.eventId))?.uid === uid,
        'Restoring the owning UID recovers only its own prepared decision');
      restarted.close();
    });

    await test('Conflict decision intent rejects newly queued local writes absent from the archived evidence', async () => {
      const uid = 'resolution-intent-stale-local';
      const { journal } = createJournal(uid);
      const event = {
        uid,
        eventId: 'resolution-intent-stale-event',
        mutationId: 'resolution-intent-stale-event',
        eventType: 'domain-mutation' as const,
        collection: 'tests' as const,
        documentId: 'resolution-intent-test',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9350,
        payload: { id: 'resolution-intent-test', score: 1 },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'resolution-intent-archived-local',
        collection: 'tests',
        documentId: event.documentId,
        payload: { id: event.documentId, score: 2 },
        nowMs: 9351
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', { tests: 'local' }, 9352);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const archived = (conflict.localMutations || []).map(item => ({
        mutationId: item.mutationId,
        fingerprint: item.fingerprint
      }));
      await journal.enqueue({
        mutationId: 'resolution-intent-new-local',
        collection: 'tests',
        documentId: event.documentId,
        payload: { id: event.documentId, score: 3 },
        nowMs: 9353
      });
      let rejected = false;
      try {
        await journal.prepareConflictResolutionIntent({
          decisionId: 'resolution-decision-stale-local',
          eventId: event.eventId,
          eventFingerprint: storedEvent.fingerprint,
          localSnapshotFingerprint: fingerprintConflictSnapshot(conflict.localSnapshot),
          decision: 'merge',
          baseRevision: 1,
          payload: { id: event.documentId, score: 4 },
          localMutationFingerprints: archived,
          nowMs: 9354
        });
      } catch { rejected = true; }
      assert(rejected && await journal.getConflictResolutionIntent(event.eventId) === null,
        'A new pending write that was not shown in the archived conflict must block stale decision preparation');
      assert((await journal.listReady(9400, 10)).length === 2 &&
        await journal.getRemoteProjectionCursor() === 0,
        'Rejecting a stale decision must preserve every local mutation and the blocked projection cursor');
      journal.close();
    });

    await test('Prepared conflict decisions can be canceled without deleting evidence or pending writes', async () => {
      const uid = 'cancel-resolution-intent-owner';
      const { journal } = createJournal(uid);
      const event = {
        uid,
        eventId: 'cancel-resolution-intent-event',
        mutationId: 'cancel-resolution-intent-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'cancel-plan',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9450,
        payload: { records: [] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'cancel-resolution-local-pending',
        collection: 'plans',
        documentId: event.documentId,
        payload: { records: [] },
        nowMs: 9451
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const snapshot = StorageService.getLocalProjectionSnapshot('plans');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', snapshot, 9452);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      await journal.prepareConflictResolutionIntent({
        decisionId: 'cancel-resolution-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(snapshot),
        decision: 'use-remote',
        baseRevision: 1,
        payload: { records: [] },
        localMutationFingerprints: (conflict.localMutations || []).map(item => ({
          mutationId: item.mutationId,
          fingerprint: item.fingerprint
        })),
        nowMs: 9453
      });
      let wrongDecisionRejected = false;
      try { await journal.cancelPreparedConflictResolutionIntent(event.eventId, 'wrong-decision-id'); }
      catch { wrongDecisionRejected = true; }
      assert(wrongDecisionRejected, 'A different decision ID cannot cancel the saved user intent');
      assert(await journal.cancelPreparedConflictResolutionIntent(event.eventId, 'cancel-resolution-decision'),
        'The exact prepared decision can be canceled explicitly');
      assert(await journal.getConflictResolutionIntent(event.eventId) === null &&
        await journal.getProjectionConflictCount() === 1 &&
        (await journal.listReady(9500, 10)).some(item => item.mutationId === 'cancel-resolution-local-pending') &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 1 &&
        await journal.getRemoteProjectionCursor() === 0,
        'Cancellation must remove only the uncommitted intent and preserve the conflict archive, inbox, local write, and cursors');
      journal.close();
    });

    await test('Keep-local resolution preserves the current snapshot and queues one replacement on the latest remote revision', async () => {
      const uid = 'keep-local-resolution-owner';
      const { journal } = createJournal(uid);
      const localProfile = { ...StorageService.getProfile(), name: 'local-choice' };
      assert(StorageService.saveProfile(localProfile), 'The local profile fixture must be valid');
      const event = {
        uid,
        eventId: 'keep-local-resolution-event',
        mutationId: 'keep-local-resolution-event',
        eventType: 'domain-mutation' as const,
        collection: 'profile' as const,
        documentId: 'snapshot',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9480,
        payload: { profile: { ...localProfile, name: 'remote-version' } },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'keep-local-original-pending',
        collection: 'profile',
        documentId: event.documentId,
        payload: { profile: localProfile },
        nowMs: 9481
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = StorageService.getLocalProjectionSnapshot('profile');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9482);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const archived = (conflict.localMutations || []).map(item => ({
        mutationId: item.mutationId,
        fingerprint: item.fingerprint
      }));
      const localPayload = { profile: localProfile };
      await journal.prepareConflictResolutionIntent({
        decisionId: 'keep-local-resolution-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(localSnapshot),
        decision: 'keep-local',
        baseRevision: 2,
        payload: localPayload,
        localMutationFingerprints: archived,
        nowMs: 9483
      });
      const result = await journal.commitKeepLocalConflictResolution(event.eventId, 2, localPayload, 9484);
      const pending = await journal.listReady(9600, 10);
      const revision = await journal.getRemoteRevision('profile', event.documentId);
      const conflicts = await journal.listProjectionConflicts(10);
      assert(StorageService.getProfile().name === 'local-choice',
        'Keep-local must never overwrite the current local projection');
      assert(pending.length === 1 && pending[0].mutationId === result.mutationId &&
        pending[0].baseRevision === 2 && pending[0].sequence === result.sequence &&
        JSON.stringify(pending[0].payload) === JSON.stringify(localPayload),
        'Archived stale writes must be replaced by one full-snapshot mutation based on the latest remote revision');
      assert(revision?.revision === 2 && revision.localSequence < result.sequence,
        'The local revision baseline must be the verified remote revision and the replacement must be newer in local sequence');
      assert(await journal.getRemoteProjectionCursor() === 1 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 0 &&
        conflicts.length === 0 &&
        await journal.getConflictResolutionIntent(event.eventId) === null,
        'The conflict, blocked inbox event, prepared intent, and projection cursor must commit together');
      const storedConflicts = await journal.listProjectionConflicts(10);
      assert(storedConflicts.length === 0,
        'Resolved keep-local conflict must no longer appear in the open conflict list');
      journal.close();
    });

    await test('Keep-local resolution rejects a changed local snapshot without deleting archived writes', async () => {
      const uid = 'keep-local-stale-snapshot-owner';
      const { journal } = createJournal(uid);
      const localProfile = { ...StorageService.getProfile(), name: 'local-before-choice' };
      assert(StorageService.saveProfile(localProfile), 'The local profile fixture must be valid');
      const event = {
        uid,
        eventId: 'keep-local-stale-snapshot-event',
        mutationId: 'keep-local-stale-snapshot-event',
        eventType: 'domain-mutation' as const,
        collection: 'profile' as const,
        documentId: 'snapshot',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9490,
        payload: { profile: { ...localProfile, name: 'remote-version' } },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'keep-local-stale-original',
        collection: 'profile',
        documentId: event.documentId,
        payload: { profile: localProfile },
        nowMs: 9491
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = StorageService.getLocalProjectionSnapshot('profile');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9492);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const archived = (conflict.localMutations || []).map(item => ({
        mutationId: item.mutationId,
        fingerprint: item.fingerprint
      }));
      await journal.prepareConflictResolutionIntent({
        decisionId: 'keep-local-stale-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(localSnapshot),
        decision: 'keep-local',
        baseRevision: 2,
        payload: { profile: localProfile },
        localMutationFingerprints: archived,
        nowMs: 9493
      });
      const changedProfile = { ...localProfile, name: 'changed-after-confirmation' };
      assert(StorageService.saveProfile(changedProfile), 'The later local change fixture must be saved');
      let rejected = false;
      try {
        await journal.commitKeepLocalConflictResolution(event.eventId, 2, { profile: localProfile }, 9494);
      } catch { rejected = true; }
      assert(rejected && (await journal.listReady(9600, 10)).length === 1 &&
        await journal.getRemoteProjectionCursor() === 0 &&
        await journal.getProjectionConflictCount() === 1 &&
        !!await journal.getConflictResolutionIntent(event.eventId),
        'A stale keep-local decision must preserve the local mutation, conflict archive, inbox event, and cursor');
      assert(StorageService.getProfile().name === 'changed-after-confirmation',
        'A stale keep-local decision must not overwrite the newer local data');
      journal.close();
    });

    await test('Ruqyah per-device resettable counter merge atomically preserves independent increments and recovers after interrupted projection', async () => {
      const uid = 'ruqyah-per-device resettable counter-merge-owner';
      const { journal } = createJournal(uid);
      const itemId = 'q-fatihah';
      const localSnapshot = adjustRuqyahProgressCounter(
        createEmptyRuqyahProgressSnapshot(300000), itemId, 'local-device', 2, 300001
      );
      const remoteSnapshot = adjustRuqyahProgressCounter(
        createEmptyRuqyahProgressSnapshot(300000), itemId, 'remote-device', 3, 300002
      );
      assert(StorageService.saveRuqyahProgressSnapshot(localSnapshot),
        'The local per-device resettable counter fixture must be stored before the remote event arrives');
      const event = {
        uid,
        eventId: 'ruqyah-per-device resettable counter-remote-event',
        mutationId: 'ruqyah-per-device resettable counter-remote-event',
        eventType: 'domain-mutation' as const,
        collection: 'ruqyahProgress' as const,
        documentId: 'snapshot',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 300003,
        payload: { snapshot: remoteSnapshot },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'ruqyah-per-device resettable counter-local-pending',
        collection: 'ruqyahProgress',
        documentId: 'snapshot',
        payload: { snapshot: localSnapshot },
        nowMs: 300004
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localRawSnapshot = StorageService.getLocalProjectionSnapshot('ruqyahProgress');
      assert(await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localRawSnapshot, 300005),
        'The original local projection and pending mutation must be archived before merging');
      const intent = {
        sequence: 1,
        eventId: event.eventId,
        collection: 'ruqyahProgress' as const,
        documentId: 'snapshot',
        revision: 1,
        initializedCollections: []
      };
      assert(await journal.prepareRemoteProjection(intent),
        'The blocked remote event must have a durable projection intent before merge');

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
      let interrupted = false;
      try {
        await journal.finalizeRuqyahProgressMerge(intent, mergedEvent => StorageService.applyJournalEvent(mergedEvent));
      } catch { interrupted = true; }
      finally { IDBObjectStore.prototype.add = originalAdd; }

      const afterInterruption = StorageService.getRuqyahProgressSnapshot();
      assert(injected && interrupted && afterInterruption?.schemaVersion === 2 &&
        afterInterruption.counts[itemId] === 5 &&
        (await journal.listReady(Date.now() + 1000, 10)).length === 1 &&
        await journal.getRemoteProjectionCursor() === 0 &&
        (await journal.listProjectionConflicts(10)).length === 1,
        'An interrupted transaction may apply the merged projection, but must keep the old Outbox, inbox, intent, and archive recoverable');

      assert(await journal.finalizeRuqyahProgressMerge(intent, mergedEvent => StorageService.applyJournalEvent(mergedEvent)),
        'Retry must recognize the exact already-applied merged projection and finish the atomic journal transition');
      const mergedSnapshot = StorageService.getRuqyahProgressSnapshot();
      const pending = await journal.listReady(Date.now() + 1000, 10);
      const revision = await journal.getRemoteRevision('ruqyahProgress', 'snapshot');
      assert(mergedSnapshot?.schemaVersion === 2 && mergedSnapshot.counts[itemId] === 5,
        'The local projection must contain both devices’ increments exactly once');
      assert(pending.length === 1 && pending[0].mutationId !== 'ruqyah-per-device resettable counter-local-pending' &&
        pending[0].baseRevision === 1 &&
        (pending[0].payload.snapshot as { counts: Record<string, number> }).counts[itemId] === 5,
        'Old pending writes must be replaced by one merged full-snapshot mutation based on the remote revision');
      assert(revision?.revision === 1 && revision.localSequence < pending[0].sequence &&
        await journal.getRemoteProjectionCursor() === 1 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 0 &&
        (await journal.listProjectionConflicts(10)).length === 0,
        'Remote revision, local sequence, resolved archive, inbox deletion, and projection cursor must commit together');
      journal.close();
    });

    await test('Use-remote resolution atomically applies the latest snapshot and supersedes only archived local mutations', async () => {
      const uid = 'use-remote-resolution-owner';
      const { journal } = createJournal(uid);
      const localProfile = { ...StorageService.getProfile(), name: 'local-choice' };
      assert(StorageService.saveProfile(localProfile), 'The local profile fixture must be valid');
      const latestRemoteProfile = { ...localProfile, name: 'remote-latest' };
      const event = {
        uid,
        eventId: 'use-remote-resolution-event',
        mutationId: 'use-remote-resolution-event',
        eventType: 'domain-mutation' as const,
        collection: 'profile' as const,
        documentId: 'snapshot',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9500,
        payload: { profile: { ...localProfile, name: 'remote-old' } },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'use-remote-local-pending',
        collection: 'profile',
        documentId: event.documentId,
        payload: { profile: localProfile },
        nowMs: 9501
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = StorageService.getLocalProjectionSnapshot('profile');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9502);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const archived = (conflict.localMutations || []).map(item => ({
        mutationId: item.mutationId,
        fingerprint: item.fingerprint
      }));
      const latestRemotePayload = { profile: latestRemoteProfile };
      await journal.prepareConflictResolutionIntent({
        decisionId: 'use-remote-decision-1',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(localSnapshot),
        decision: 'use-remote',
        baseRevision: 2,
        payload: latestRemotePayload,
        localMutationFingerprints: archived,
        nowMs: 9503
      });
      let staleRemotePayloadRejected = false;
      try {
        await journal.commitUseRemoteConflictResolution(
          event.eventId, 2, { profile: { ...localProfile, name: 'stale-remote-choice' } }, 9504
        );
      } catch { staleRemotePayloadRejected = true; }
      assert(staleRemotePayloadRejected && await journal.getRemoteProjectionCursor() === 0 &&
        await journal.getProjectionConflictCount() === 1,
        'A remote snapshot that differs from the immutable prepared choice must not be applied');
      assert(await journal.commitUseRemoteConflictResolution(
        event.eventId, 2, latestRemotePayload, 9505
      ), 'The explicit remote choice must commit against the latest confirmed server revision');
      assert(StorageService.getProfile().name === 'remote-latest',
        'The latest remote snapshot must replace the local projection');
      assert((await journal.listReady(9600, 10)).length === 0 &&
        await journal.getRemoteProjectionCursor() === 1 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 0 &&
        await journal.getProjectionConflictCount() === 0 &&
        await journal.getConflictResolutionIntent(event.eventId) === null,
        'The same transaction must remove only superseded Outbox writes, close the conflict, clear the intent, and advance the cursor');
      const revision = await journal.getRemoteRevision('profile', event.documentId);
      assert(revision?.revision === 2,
        'The latest authoritative server revision must become the local revision baseline');
      journal.close();
    });

    await test('Use-remote resolution recovers if local projection was applied before the journal commit completed', async () => {
      const uid = 'use-remote-crash-recovery-owner';
      const { journal } = createJournal(uid);
      const localProfile = { ...StorageService.getProfile(), name: 'before-resolution' };
      assert(StorageService.saveProfile(localProfile), 'The local profile fixture must be valid');
      const remoteProfile = { ...localProfile, name: 'chosen-remote-after-crash' };
      const event = {
        uid,
        eventId: 'use-remote-crash-event',
        mutationId: 'use-remote-crash-event',
        eventType: 'domain-mutation' as const,
        collection: 'profile' as const,
        documentId: 'crash-profile',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9550,
        payload: { profile: { ...localProfile, name: 'remote-event-payload' } },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'use-remote-crash-local',
        collection: 'profile',
        documentId: event.documentId,
        payload: { profile: localProfile },
        nowMs: 9551
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = StorageService.getLocalProjectionSnapshot('profile');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9552);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const chosenPayload = { profile: remoteProfile };
      await journal.prepareConflictResolutionIntent({
        decisionId: 'use-remote-crash-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(localSnapshot),
        decision: 'use-remote',
        baseRevision: 2,
        payload: chosenPayload,
        localMutationFingerprints: (conflict.localMutations || []).map(item => ({
          mutationId: item.mutationId,
          fingerprint: item.fingerprint
        })),
        nowMs: 9553
      });
      assert(StorageService.applyJournalProjection('profile', chosenPayload),
        'Simulate the durable local projection succeeding immediately before an IndexedDB interruption');
      assert(await journal.commitUseRemoteConflictResolution(event.eventId, 2, chosenPayload, 9554),
        'Recovery must recognize the exact chosen snapshot and finish the journal commit idempotently');
      assert(StorageService.getProfile().name === 'chosen-remote-after-crash' &&
        await journal.getRemoteProjectionCursor() === 1 &&
        await journal.getProjectionConflictCount() === 0 &&
        await journal.getConflictResolutionIntent(event.eventId) === null &&
        (await journal.listReady(9600, 10)).length === 0,
        'Crash recovery must finish without restoring stale local data or resending superseded mutations');
      journal.close();
    });

    await test('Grouped use-remote resolution applies all transaction collections atomically', async () => {
      const uid = 'use-remote-grouped-owner';
      const { journal } = createJournal(uid);
      StorageService.savePlans([]);
      StorageService.saveTests([]);
      const event = {
        uid,
        eventId: 'use-remote-grouped-event',
        mutationId: 'use-remote-grouped-event',
        eventType: 'domain-mutation' as const,
        collection: 'syncMeta' as const,
        documentId: 'remote-transaction',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9600,
        payload: {
          transaction: {
            version: 1,
            operations: [
              { collection: 'plans', documentId: 'plans-snapshot', operation: 'upsert', payload: { records: [] } },
              { collection: 'tests', documentId: 'tests-snapshot', operation: 'upsert', payload: { records: [] } }
            ]
          }
        },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'use-remote-grouped-plan-pending',
        collection: 'plans',
        documentId: 'local-plan',
        payload: { records: [{ id: 'local-plan' }] },
        nowMs: 9601
      });
      await journal.enqueue({
        mutationId: 'use-remote-grouped-test-pending',
        collection: 'tests',
        documentId: 'local-test',
        payload: { records: [{ id: 'local-test' }] },
        nowMs: 9602
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = StorageService.getLocalProjectionSnapshot('syncMeta');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9603);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      await journal.prepareConflictResolutionIntent({
        decisionId: 'use-remote-grouped-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(localSnapshot),
        decision: 'use-remote',
        baseRevision: 1,
        payload: event.payload,
        localMutationFingerprints: (conflict.localMutations || []).map(item => ({
          mutationId: item.mutationId,
          fingerprint: item.fingerprint
        })),
        nowMs: 9604
      });
      assert(await journal.commitUseRemoteConflictResolution(event.eventId, 1, event.payload, 9605),
        'A grouped remote transaction must resolve as one atomic projection');
      assert(StorageService.getPlans().length === 0 && StorageService.getTests().length === 0 &&
        (await journal.listReady(9700, 10)).length === 0 &&
        await journal.getProjectionConflictCount() === 0 &&
        await journal.getRemoteProjectionCursor() === 1,
        'All grouped projections and affected local Outbox mutations must commit together');
      assert(await journal.isRemoteCollectionInitialized('plans') &&
        await journal.isRemoteCollectionInitialized('tests') &&
        await journal.isRemoteCollectionInitialized('syncMeta'),
        'The grouped resolution must mark every affected collection as initialized');
      journal.close();
    });

    await test('Grouped keep-local syncMeta conflict atomically replaces every affected pending write with one grouped mutation', async () => {
      const uid = 'keep-local-grouped-syncmeta-owner';
      const { journal } = createJournal(uid);
      StorageService.savePlans([]);
      StorageService.saveTests([]);
      const event = {
        uid,
        eventId: 'keep-local-grouped-syncmeta-event',
        mutationId: 'keep-local-grouped-syncmeta-event',
        eventType: 'domain-mutation' as const,
        collection: 'syncMeta' as const,
        documentId: 'remote-grouped-transaction',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9610,
        payload: {
          transaction: {
            version: 1,
            operations: [
              { collection: 'plans', documentId: 'plans-snapshot', operation: 'upsert', payload: { records: [] } },
              { collection: 'tests', documentId: 'tests-snapshot', operation: 'upsert', payload: { records: [] } }
            ]
          }
        },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'keep-local-grouped-plan-pending',
        collection: 'plans',
        documentId: 'local-plan',
        payload: { records: [] },
        nowMs: 9611
      });
      await journal.enqueue({
        mutationId: 'keep-local-grouped-test-pending',
        collection: 'tests',
        documentId: 'local-test',
        payload: { records: [] },
        nowMs: 9612
      });
      const localPayload = {
        transaction: {
          version: 1,
          operations: [
            { collection: 'plans', documentId: 'local-plan', operation: 'upsert', payload: { records: [] } },
            { collection: 'tests', documentId: 'local-test', operation: 'upsert', payload: { records: [] } }
          ]
        }
      };
      await journal.enqueue({
        mutationId: 'keep-local-grouped-local-transaction',
        collection: 'syncMeta',
        documentId: event.documentId,
        payload: localPayload,
        nowMs: 9613
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = StorageService.getLocalProjectionSnapshot('syncMeta');
      assert(await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9613),
        'The grouped conflict must be archived before a user decision');
      const conflict = (await journal.listProjectionConflicts(10))[0];
      await journal.prepareConflictResolutionIntent({
        decisionId: 'keep-local-grouped-syncmeta-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(localSnapshot),
        decision: 'keep-local',
        baseRevision: 1,
        payload: localPayload,
        localMutationFingerprints: (conflict.localMutations || []).map(item => ({
          mutationId: item.mutationId,
          fingerprint: item.fingerprint
        })),
        nowMs: 9614
      });

      const committed = await journal.commitKeepLocalConflictResolution(event.eventId, 1, localPayload, 9615);
      const after = await journal.getSnapshot();
      const remainingConflict = (await journal.listProjectionConflicts(10))[0];
      const inboxAfter = await journal.listRemoteInboxAfter(0, 10);
      const ready = await journal.listReady(9700, 10);
      assert(after.pendingCount === 1 && after.projectionCursor === 1 && ready.length === 1,
        'The grouped decision must replace both local writes with one pending mutation and advance the cursor exactly once');
      assert(ready[0].collection === 'syncMeta' && ready[0].documentId === event.documentId &&
        ready[0].mutationId === committed.mutationId &&
        JSON.stringify(ready[0].payload) === JSON.stringify(localPayload),
        'The replacement must be one syncMeta event carrying the exact grouped local snapshots');
      assert(inboxAfter.length === 0 && remainingConflict?.status === 'resolved' &&
        !(await journal.getConflictResolutionIntent(event.eventId)),
        'The grouped commit must close the conflict and consume the inbox event and prepared intent atomically');
      assert(await journal.isRemoteCollectionInitialized('plans') &&
        await journal.isRemoteCollectionInitialized('tests') &&
        await journal.isRemoteCollectionInitialized('syncMeta'),
        'The grouped commit must mark syncMeta and every affected collection as initialized');
      journal.close();
    });

    await test('Grouped keep-local syncMeta rejects a post-decision local write without consuming evidence', async () => {
      const uid = 'keep-local-grouped-syncmeta-stale-owner';
      const { journal } = createJournal(uid);
      StorageService.savePlans([]);
      StorageService.saveTests([]);
      const event = {
        uid,
        eventId: 'keep-local-grouped-stale-event',
        mutationId: 'keep-local-grouped-stale-event',
        eventType: 'domain-mutation' as const,
        collection: 'syncMeta' as const,
        documentId: 'remote-grouped-stale-transaction',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9620,
        payload: { transaction: { version: 1, operations: [
          { collection: 'plans', documentId: 'plans-snapshot', operation: 'upsert', payload: { records: [] } },
          { collection: 'tests', documentId: 'tests-snapshot', operation: 'upsert', payload: { records: [] } }
        ] } },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({ mutationId: 'keep-local-grouped-stale-plan', collection: 'plans', documentId: 'local-plan', payload: { records: [] }, nowMs: 9621 });
      await journal.enqueue({ mutationId: 'keep-local-grouped-stale-test', collection: 'tests', documentId: 'local-test', payload: { records: [] }, nowMs: 9622 });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const snapshot = StorageService.getLocalProjectionSnapshot('syncMeta');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', snapshot, 9623);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const localPayload = { transaction: { version: 1, operations: [
        { collection: 'plans', documentId: 'local-plan', operation: 'upsert', payload: { records: [] } },
        { collection: 'tests', documentId: 'local-test', operation: 'upsert', payload: { records: [] } }
      ] } };
      await journal.prepareConflictResolutionIntent({
        decisionId: 'keep-local-grouped-stale-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(snapshot),
        decision: 'keep-local',
        baseRevision: 1,
        payload: localPayload,
        localMutationFingerprints: (conflict.localMutations || []).map(item => ({ mutationId: item.mutationId, fingerprint: item.fingerprint })),
        nowMs: 9624
      });
      await journal.enqueue({ mutationId: 'keep-local-grouped-new-write', collection: 'plans', documentId: 'local-plan', payload: { records: [] }, nowMs: 9625 });
      let rejected = false;
      try { await journal.commitKeepLocalConflictResolution(event.eventId, 1, localPayload, 9626); }
      catch { rejected = true; }
      const after = await journal.getSnapshot();
      assert(rejected && after.pendingCount === 3 && after.projectionCursor === 0 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 1 &&
        (await journal.listProjectionConflicts(10))[0]?.status === 'open' &&
        !!await journal.getConflictResolutionIntent(event.eventId),
        'A post-decision local write must block the whole grouped rebase without deleting evidence or advancing the cursor');
      journal.close();
    });

    await test('Use-remote commit rejects a new local mutation created after the decision was prepared', async () => {
      const uid = 'use-remote-stale-owner';
      const { journal } = createJournal(uid);
      StorageService.savePlans([]);
      const event = {
        uid,
        eventId: 'use-remote-stale-event',
        mutationId: 'use-remote-stale-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'stale-plan',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9700,
        payload: { records: [] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'use-remote-stale-first',
        collection: 'plans',
        documentId: event.documentId,
        payload: { records: [{ id: 'first' }] },
        nowMs: 9701
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = StorageService.getLocalProjectionSnapshot('plans');
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9702);
      const conflict = (await journal.listProjectionConflicts(10))[0];
      await journal.prepareConflictResolutionIntent({
        decisionId: 'use-remote-stale-decision',
        eventId: event.eventId,
        eventFingerprint: storedEvent.fingerprint,
        localSnapshotFingerprint: fingerprintConflictSnapshot(localSnapshot),
        decision: 'use-remote',
        baseRevision: 1,
        payload: { records: [] },
        localMutationFingerprints: (conflict.localMutations || []).map(item => ({
          mutationId: item.mutationId,
          fingerprint: item.fingerprint
        })),
        nowMs: 9703
      });
      await journal.enqueue({
        mutationId: 'use-remote-stale-new-write',
        collection: 'plans',
        documentId: event.documentId,
        payload: { records: [{ id: 'newer-local' }] },
        nowMs: 9704
      });
      let rejected = false;
      try { await journal.commitUseRemoteConflictResolution(event.eventId, 1, { records: [] }, 9705); }
      catch { rejected = true; }
      assert(rejected && (await journal.listReady(9800, 10)).length === 2 &&
        await journal.getRemoteProjectionCursor() === 0 &&
        await journal.getProjectionConflictCount() === 1 &&
        !!await journal.getConflictResolutionIntent(event.eventId),
        'A stale prepared decision must not erase a local write created after the user confirmed it');
      journal.close();
    });

    await test('Projection conflicts preserve the first local snapshot and resolve with the cursor commit', async () => {
      const { journal } = createJournal('remote-conflict-owner');
      const event = {
        uid: 'remote-conflict-owner',
        eventId: 'conflict-event-1',
        mutationId: 'conflict-event-1',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'snapshot',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9000,
        payload: { records: [{ id: 'remote-plan' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      const localSnapshot = { wird_plans: JSON.stringify([{ id: 'local-plan' }]) };
      await journal.enqueue({
        mutationId: 'local-conflict-mutation-1',
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: [{ id: 'local-plan', title: 'local pending intent' }] },
        nowMs: 9050
      });
      assert(await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', localSnapshot, 9100),
        'A blocked remote event and its local snapshot must be archived');
      const first = await journal.listProjectionConflicts(10);
      assert(first.length === 1 && first[0].event.payload.records !== undefined &&
        first[0].localSnapshot.wird_plans === localSnapshot.wird_plans &&
        first[0].localMutations?.length === 1 &&
        first[0].localMutations[0].mutationId === 'local-conflict-mutation-1' &&
        (first[0].localMutations[0].payload.records as Array<{ title: string }>)[0].title === 'local pending intent' &&
        await journal.getProjectionConflictCount() === 1,
        'The archive must preserve remote payload, raw local bytes, and the exact pending local mutation');
      await journal.enqueue({
        mutationId: 'local-conflict-mutation-2',
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: [{ id: 'local-plan', title: 'second local intent' }] },
        nowMs: 9150
      });
      await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', { wird_plans: 'changed-later' }, 9200);
      const repeated = await journal.listProjectionConflicts(10);
      assert(repeated.length === 1 && repeated[0].localSnapshot.wird_plans === localSnapshot.wird_plans &&
        repeated[0].localMutations?.length === 2 &&
        repeated[0].localMutations[1].mutationId === 'local-conflict-mutation-2',
        'Repeated observations preserve the first raw snapshot and append new pending mutation evidence without duplicates');
      let identityRejected = false;
      try {
        await journal.saveProjectionConflict({
          ...storedEvent,
          fingerprint: 'different-event-fingerprint'
        }, 'blocked_pending_local', localSnapshot, 9250);
      } catch { identityRejected = true; }
      assert(identityRejected,
        'An event ID reused with a different fingerprint must not replace archived recovery evidence');

      assert(await journal.acknowledge(['local-conflict-mutation-1', 'local-conflict-mutation-2'], 9255) === 2,
        'After a later successful local resolution write, pending entries may be acknowledged while archived evidence remains');
      const intent = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: [] as SyncCollection[]
      };
      await journal.prepareRemoteProjection(intent);
      assert(await journal.finalizeRemoteProjection(intent, () => true),
        'A reconciled event must finalize successfully');
      assert(await journal.getProjectionConflictCount() === 0 &&
        (await journal.listProjectionConflicts(10)).length === 0,
        'The conflict must resolve atomically with the cursor and inbox event');
      assert(await journal.saveProjectionConflict(storedEvent, 'projection_failed', {
        wird_plans: 'stale-tab-snapshot'
      }, 9300), 'A stale tab must treat the already committed event as reconciled');
      assert(await journal.getProjectionConflictCount() === 0,
        'A late archive attempt must not create an orphan conflict after cursor advancement');
      journal.close();
    });

    await test('Already-applied remote events resolve their archived conflict with the cursor', async () => {
      const { journal } = createJournal('projection-conflict-already-applied');
      const event = {
        uid: 'projection-conflict-already-applied',
        eventId: 'projection-conflict-already-applied-event',
        mutationId: 'projection-conflict-already-applied-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-already-applied',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-already-applied-device',
        occurredAtMs: 8950,
        payload: { records: [{ id: 'plan-already-applied' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      await journal.saveProjectionConflict(storedEvent, 'blocked_base_revision', {
        plans: '{"id":"local-state"}'
      }, 8951);
      await journal.setRemoteRevisionFromRemote('plans', event.documentId, 1);
      assert(await journal.markRemoteProjected(1),
        'An event already represented by the acknowledged revision may advance without reapplying its snapshot');
      assert(await journal.getProjectionConflictCount() === 0,
        'Advancing an already-applied event must resolve its conflict record atomically');
      journal.close();
    });

    await test('Remote finalization blocks pending writes for the same document', async () => {
      const { journal } = createJournal('projection-same-document-pending');
      const event = {
        uid: 'projection-same-document-pending',
        eventId: 'projection-same-document-event',
        mutationId: 'projection-same-document-event',
        eventType: 'domain-mutation' as const,
        collection: 'tests' as const,
        documentId: 'remote-test',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-test-device',
        occurredAtMs: 9000,
        payload: { id: 'remote-test', score: 4 },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'same-document-local-pending',
        collection: 'tests',
        documentId: 'remote-test',
        payload: { id: 'remote-test', score: 5 },
        nowMs: 9001
      });
      const intent = {
        sequence: 1, eventId: event.eventId, collection: event.collection,
        documentId: event.documentId, revision: 1, initializedCollections: [] as SyncCollection[]
      };
      await journal.prepareRemoteProjection(intent);
      let rejected = false;
      try { await journal.finalizeRemoteProjection(intent, () => true); } catch { rejected = true; }
      assert(rejected && await journal.getRemoteProjectionCursor() === 0 &&
        (await journal.listReady(9002, 10)).some(item => item.mutationId === 'same-document-local-pending'),
        'A same-document pending mutation must block finalization and remain in the outbox');
      journal.close();
    });

    await test('Remote finalization permits an independent document while another record in the collection is pending', async () => {
      const { journal } = createJournal('projection-independent-document-pending');
      const event = {
        uid: 'projection-independent-document-pending',
        eventId: 'projection-independent-document-event',
        mutationId: 'projection-independent-document-event',
        eventType: 'domain-mutation' as const,
        collection: 'tests' as const,
        documentId: 'remote-test',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-test-device',
        occurredAtMs: 9100,
        payload: { id: 'remote-test', score: 4 },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'other-document-local-pending',
        collection: 'tests',
        documentId: 'local-test',
        payload: { id: 'local-test', score: 2 },
        nowMs: 9101
      });
      const intent = {
        sequence: 1, eventId: event.eventId, collection: event.collection,
        documentId: event.documentId, revision: 1, initializedCollections: [] as SyncCollection[]
      };
      await journal.prepareRemoteProjection(intent);
      let applied = false;
      assert(await journal.finalizeRemoteProjection(intent, () => { applied = true; return true; }) && applied,
        'A pending mutation for another document must not block an independent remote projection');
      assert(await journal.getRemoteProjectionCursor() === 1 &&
        (await journal.getRemoteRevision('tests', 'remote-test'))?.revision === 1 &&
        (await journal.listReady(9102, 10)).some(item => item.mutationId === 'other-document-local-pending'),
        'The remote document advances while the unrelated local mutation remains queued and intact');
      journal.close();
    });

    await test('Grouped syncMeta conflict archives pending mutations from every affected collection', async () => {
      const uid = 'projection-syncmeta-conflict';
      const { journal } = createJournal(uid);
      const event = {
        uid,
        eventId: 'remote-syncmeta-transaction',
        mutationId: 'remote-syncmeta-transaction',
        eventType: 'domain-mutation' as const,
        collection: 'syncMeta' as const,
        documentId: 'remote-transaction-1',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device',
        occurredAtMs: 9300,
        payload: {
          transaction: {
            operations: [{ collection: 'plans' }, { collection: 'tests' }]
          }
        },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      await journal.enqueue({
        mutationId: 'pending-plan-snapshot',
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: [{ id: 'local-plan' }] },
        nowMs: 9301
      });
      await journal.enqueue({
        mutationId: 'pending-test-record',
        collection: 'tests',
        documentId: 'local-test',
        payload: { id: 'local-test', score: 2 },
        nowMs: 9302
      });
      await journal.enqueue({
        mutationId: 'unrelated-weak-verse',
        collection: 'weakVerses',
        documentId: 'snapshot',
        payload: { records: [{ id: 'unrelated' }] },
        nowMs: 9303
      });
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      assert(await journal.saveProjectionConflict(storedEvent, 'blocked_pending_local', {
        plans: '[{"id":"local-plan"}]', tests: '[{"id":"local-test"}]'
      }, 9304), 'A blocked grouped transaction must be archived');
      const conflict = (await journal.listProjectionConflicts(10))[0];
      const ids = new Set((conflict.localMutations || []).map(mutation => mutation.mutationId));
      assert(ids.has('pending-plan-snapshot') && ids.has('pending-test-record') &&
        !ids.has('unrelated-weak-verse'),
        'The archive must include all pending mutations in transaction collections and exclude unrelated collections');
      assert(await journal.getRemoteProjectionCursor() === 0 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 1,
        'Archiving a grouped conflict must not advance or delete the remote inbox event');
      journal.close();
    });

    await test('Oversized projection conflict snapshots are rejected without touching the inbox event', async () => {
      const { journal } = createJournal('projection-conflict-size-limit');
      const event = {
        uid: 'projection-conflict-size-limit',
        eventId: 'projection-conflict-size-event',
        mutationId: 'projection-conflict-size-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-large-snapshot',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-large-snapshot-device',
        occurredAtMs: 8990,
        payload: { records: [{ id: 'plan-large-snapshot' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const storedEvent = (await journal.listRemoteInboxAfter(0, 10))[0];
      await journal.enqueue({
        mutationId: 'large-conflict-pending-mutation',
        collection: 'plans',
        documentId: 'plan-large-snapshot',
        payload: { content: 'y'.repeat(30_000) },
        nowMs: 8990
      });
      let rejected = false;
      try {
        await journal.saveProjectionConflict(storedEvent, 'blocked_base_revision', {
          plans: 'x'.repeat(480_000)
        }, 8991);
      } catch { rejected = true; }
      assert(rejected, 'Oversized local snapshots must be rejected');
      assert(await journal.getRemoteProjectionCursor() === 0 &&
        (await journal.listRemoteInboxAfter(0, 10)).length === 1 &&
        (await journal.listReady(9000, 10)).some(item => item.mutationId === 'large-conflict-pending-mutation'),
        'Rejecting an oversized archive must preserve the original inbox event, cursor, and pending local mutation');
      journal.close();
    });

    await test('Remote inbox import persists events and advances the durable cursor atomically', async () => {
      const { journal } = createJournal('remote-alpha');
      const event = {
        uid: 'remote-alpha',
        eventId: 'remote-mutation-1',
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
      assert((await journal.listRemoteInboxAfter(0, 10)).length === 0,
        'A successfully projected event must be pruned atomically to free inbox capacity');
      journal.close();
    });

    await test('Remote projection intent survives restart and finalizes cursor, revision, and inbox atomically', async () => {
      const { factory, databaseName, journal } = createJournal('remote-crash');
      const event = {
        uid: 'remote-crash',
        eventId: 'remote-crash-mutation',
        mutationId: 'remote-crash-mutation',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-crash',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-crash',
        occurredAtMs: 8300,
        payload: { records: [{ id: 'plan-crash' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const intent = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: ['plans' as const]
      };
      assert(await journal.prepareRemoteProjection(intent), 'The first projection attempt must persist its intent');
      journal.close();

      const restarted = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      const recoveredIntent = await restarted.getRemoteProjectionIntent();
      assert(!!recoveredIntent && recoveredIntent.eventId === event.eventId,
        'A restart must recover the exact in-flight projection intent');
      assert(await restarted.prepareRemoteProjection(intent),
        'Retrying the same projection intent must be idempotent');
      assert(await restarted.finalizeRemoteProjection(intent, () => true),
        'The recovered projection must atomically finalize');
      assert(await restarted.getRemoteProjectionCursor() === 1,
        'The projection cursor must advance in the finalization transaction');
      assert((await restarted.listRemoteInboxAfter(0, 10)).length === 0,
        'The finalized inbox event must be removed in the same transaction');
      const revision = await restarted.getRemoteRevision('plans', 'plan-crash');
      assert(revision?.revision === 1, 'The remote revision baseline must commit with the projection cursor');
      assert(await restarted.isRemoteCollectionInitialized('plans'),
        'The remote collection baseline must commit with the projection cursor');
      assert(await restarted.getRemoteProjectionIntent() === null,
        'A finalized projection must clear its durable intent');
      restarted.close();
    });

    await test('Remote projection intent cannot be replaced by a different event', async () => {
      const { journal } = createJournal('remote-intent-owner');
      const event = {
        uid: 'remote-intent-owner',
        eventId: 'intent-owner-mutation',
        mutationId: 'intent-owner-mutation',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-intent',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-intent',
        occurredAtMs: 8400,
        payload: { records: [] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const first = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: []
      };
      const conflicting = { ...first, eventId: 'different-mutation-id' };
      assert(await journal.prepareRemoteProjection(first), 'The original intent must be accepted');
      let rejected = false;
      try { await journal.prepareRemoteProjection(conflicting); } catch { rejected = true; }
      assert(rejected, 'A different event must not overwrite the durable in-flight intent');
      assert((await journal.getRemoteProjectionIntent())?.eventId === event.eventId,
        'The original intent must remain intact after a conflicting attempt');
      journal.close();
    });

    await test('Failed remote projection finalization preserves intent, inbox, cursor, and revision for retry', async () => {
      const { factory, databaseName, journal } = createJournal('remote-finalize-failure');
      const event = {
        uid: 'remote-finalize-failure',
        eventId: 'remote-finalize-event',
        mutationId: 'remote-finalize-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-finalize',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-finalize',
        occurredAtMs: 8500,
        payload: { records: [{ id: 'plan-finalize' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const intent = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: [] as ('profile' | 'plans' | 'enginePlans' | 'portions' | 'weakVerses' | 'tests' | 'activityEvents' | 'syncMeta')[]
      };
      await journal.prepareRemoteProjection(intent);
      let rejected = false;
      let projectionAttempts = 0;
      let injected = false;
      const originalPut = IDBObjectStore.prototype.put;
      (IDBObjectStore.prototype as any).put = function(value: unknown, key?: IDBValidKey) {
        const request = key === undefined
          ? originalPut.call(this, value)
          : originalPut.call(this, value, key);
        if (this.name === 'metadata' && !injected) {
          injected = true;
          this.transaction.abort();
        }
        return request;
      };
      try {
        await journal.finalizeRemoteProjection(intent, () => {
          projectionAttempts++;
          return true;
        });
      } catch { rejected = true; }
      finally { IDBObjectStore.prototype.put = originalPut; }
      assert(rejected && injected && projectionAttempts === 1,
        'Injected metadata finalization abort must occur after the local projection callback');
      assert(await journal.getRemoteProjectionCursor() === 0, 'A failed projection must not advance its cursor');
      assert((await journal.listRemoteInboxAfter(0, 10)).length === 1, 'A failed projection must retain its inbox event');
      assert((await journal.getRemoteProjectionIntent())?.eventId === event.eventId, 'A failed projection must retain its durable intent');
      assert(await journal.getRemoteRevision('plans', 'plan-finalize') === null, 'A failed projection must not commit a revision');
      assert(await journal.finalizeRemoteProjection(intent, () => {
        projectionAttempts++;
        return true;
      }), 'The same event must finalize successfully on retry');
      assert(projectionAttempts === 2 && await journal.getRemoteProjectionCursor() === 1,
        'Retry must apply once more and atomically advance the cursor');
      assert((await journal.listRemoteInboxAfter(0, 10)).length === 0, 'Successful retry must remove the inbox event');
      journal.close();
      const reopened = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      assert(await reopened.getRemoteProjectionIntent() === null, 'Successful retry must clear the intent after restart');
      reopened.close();
    });

    await test('A newer acknowledged revision supersedes an interrupted older projection without replaying its snapshot', async () => {
      const { journal } = createJournal('remote-superseded-revision');
      const event = {
        uid: 'remote-superseded-revision',
        eventId: 'remote-old-event',
        mutationId: 'remote-old-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-superseded',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-old',
        occurredAtMs: 8550,
        payload: { records: [{ id: 'stale-remote' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const intent = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: [] as ('profile' | 'plans' | 'enginePlans' | 'portions' | 'weakVerses' | 'tests' | 'activityEvents' | 'syncMeta')[]
      };
      await journal.prepareRemoteProjection(intent);
      await journal.setRemoteRevisionFromRemote('plans', 'plan-superseded', 2);
      let applied = false;
      assert(await journal.finalizeRemoteProjection(intent, () => { applied = true; return true; }),
        'A superseded event can be retired without replacing the newer snapshot');
      assert(!applied, 'The older remote snapshot must not be replayed over a newer acknowledged revision');
      assert(await journal.getRemoteProjectionCursor() === 1, 'The superseded event cursor must still advance safely');
      journal.close();
    });

    await test('Remote projection finalization serializes competing tabs and invokes only one projection', async () => {
      const { factory, databaseName, journal } = createJournal('remote-two-projectors');
      const secondTab = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      const event = {
        uid: 'remote-two-projectors',
        eventId: 'remote-two-projectors-event',
        mutationId: 'remote-two-projectors-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-two-projectors',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-two-projectors',
        occurredAtMs: 8600,
        payload: { records: [{ id: 'plan-two-projectors' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const intent = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: [] as ('profile' | 'plans' | 'enginePlans' | 'portions' | 'weakVerses' | 'tests' | 'activityEvents' | 'syncMeta')[]
      };
      await journal.prepareRemoteProjection(intent);
      const applied = { first: 0, second: 0 };
      const results = await Promise.allSettled([
        journal.finalizeRemoteProjection(intent, () => { applied.first++; return true; }),
        secondTab.finalizeRemoteProjection(intent, () => { applied.second++; return true; })
      ]);
      const successful = results.filter(result => result.status === 'fulfilled' && result.value === true).length;
      assert(successful === 1, 'Exactly one competing tab may finalize the event');
      assert(applied.first + applied.second === 1, 'Exactly one tab may apply the remote projection');
      assert(await journal.getRemoteProjectionCursor() === 1, 'The shared cursor must advance exactly once');
      assert((await journal.listRemoteInboxAfter(0, 10)).length === 0, 'The event must be removed only after the winning projection');
      journal.close();
      secondTab.close();
    });

    await test('Remote projection finalization refuses to overwrite a local mutation queued after intent preparation', async () => {
      const { journal } = createJournal('remote-local-race');
      const event = {
        uid: 'remote-local-race',
        eventId: 'remote-local-race-event',
        mutationId: 'remote-local-race-event',
        eventType: 'domain-mutation' as const,
        collection: 'plans' as const,
        documentId: 'plan-race',
        operation: 'upsert' as const,
        schemaVersion: 2 as const,
        deviceId: 'remote-device-race',
        occurredAtMs: 8700,
        payload: { records: [{ id: 'plan-race' }] },
        baseRevision: 0,
        revision: 1,
        serverSequence: 1
      };
      await journal.importRemotePage([event]);
      const intent = {
        sequence: 1,
        eventId: event.eventId,
        collection: event.collection,
        documentId: event.documentId,
        revision: 1,
        initializedCollections: [] as ('profile' | 'plans' | 'enginePlans' | 'portions' | 'weakVerses' | 'tests' | 'activityEvents' | 'syncMeta')[]
      };
      await journal.prepareRemoteProjection(intent);
      await journal.enqueue({
        mutationId: 'local-race-mutation',
        collection: 'plans',
        documentId: 'plan-race',
        payload: { records: [{ id: 'local-version' }] },
        nowMs: 8800
      });
      let applied = false;
      let rejected = false;
      try {
        await journal.finalizeRemoteProjection(intent, () => { applied = true; return true; });
      } catch { rejected = true; }
      assert(rejected && !applied, 'A pending local mutation must block projection before local storage is touched');
      assert(await journal.getRemoteProjectionCursor() === 0, 'A local conflict must leave the cursor unchanged');
      assert((await journal.getRemoteProjectionIntent())?.eventId === event.eventId, 'A local conflict must retain the recovery intent');
      journal.close();
    });

    await test('Remote inbox rejects sequence gaps without moving its cursor', async () => {
      const { journal } = createJournal('remote-gap');
      const event = {
        uid: 'remote-gap',
        eventId: 'remote-gap-mutation-2',
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
        eventId: 'foreign-mutation',
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

    await test('Legacy tombstone outbox is rejected before migration and its source is preserved', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:legacy-tombstone-migration');
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'legacy-tombstone-device',
        pending: [{
          mutationId: 'legacy-delete-1',
          collection: 'plans',
          documentId: 'legacy-plan',
          operation: 'tombstone',
          schemaVersion: 1,
          clientUpdatedAtMs: 9700,
          deviceId: 'legacy-tombstone-device',
          payload: { deleted: true },
          queuedAtMs: 9701,
          attemptCount: 0,
          nextAttemptAtMs: 0
        }],
        acknowledgedIds: [],
        acknowledgedFingerprints: []
      };
      const raw = JSON.stringify(legacy);
      assert(StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw), 'Legacy tombstone source must be stored');
      let rejected = false;
      try { await LocalSyncOutbox.migrateLegacyToIndexedDb(); } catch { rejected = true; }
      assert(rejected, 'A legacy tombstone must not be imported into an upsert-only remote protocol');
      assert(StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, raw),
        'The original legacy outbox bytes must remain available for recovery');
      const journal = new IndexedDbSyncJournal();
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      assert(snapshot.pendingCount === 0 && snapshot.eventCount === 0 && events.length === 0,
        'Rejecting the legacy tombstone must commit no partial IndexedDB events or pending writes');
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
