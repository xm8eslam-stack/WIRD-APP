import { cloudSyncCoordinator, CloudSyncCoordinator, CloudSyncState, getCloudSyncCompletionStatus, LEGACY_REMOTE_STATE_COLLECTIONS } from './cloudSyncCoordinator';
import { StorageService, buildDemoEnginePlan } from './storageService';
import { adjustRuqyahProgressCounter, createEmptyRuqyahProgressSnapshot, mergeRuqyahProgressSnapshots, resetRuqyahProgressCounter } from './ruqyahProgressSchema';
import type { SuiteResult } from '../tests/runAllTests';
import { decideRemoteProjection, projectRemoteInboxBatch, type RemoteProjectionDependencies } from './remoteInboxProjector';
import { IndexedDbSyncJournal, type RemoteInboxEvent, type RemoteRevisionSnapshot, type RemoteProjectionIntent } from './indexedDbSyncJournal';
import { IDBFactory } from 'fake-indexeddb';
import { persistEnginePlansSnapshot } from './journaledSnapshotService';

export async function runCloudSyncCoordinatorTests(): Promise<SuiteResult> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ ${message}`);
      failed++;
    }
  }


  // The real browser lifecycle listeners must automatically retry queued work on reconnect/foreground.
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const fakeWindow = new EventTarget();
  const fakeDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
  const fakeNavigator = { onLine: false };
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: fakeNavigator });
    const lifecycleCoordinator = new CloudSyncCoordinator();
    let automaticAttempts = 0;
    lifecycleCoordinator.triggerSync = async () => { automaticAttempts++; return true; };

    fakeWindow.dispatchEvent(new Event('offline'));
    assert(lifecycleCoordinator.getState().status === 'offline' &&
      lifecycleCoordinator.getState().isOnline === false,
      'Offline browser event updates coordinator state without discarding the durable outbox');

    fakeNavigator.onLine = true;
    fakeWindow.dispatchEvent(new Event('online'));
    assert(automaticAttempts === 1 && lifecycleCoordinator.getState().isOnline,
      'Browser reconnect automatically triggers a sync attempt without a manual action');

    fakeWindow.dispatchEvent(new Event('focus'));
    fakeWindow.dispatchEvent(new Event('pageshow'));
    assert(automaticAttempts === 3,
      'Returning to an open app or restoring its page automatically retries pending sync');

    fakeDocument.visibilityState = 'hidden';
    fakeDocument.dispatchEvent(new Event('visibilitychange'));
    assert(automaticAttempts === 3,
      'Hidden tabs do not start unnecessary foreground sync attempts');

    fakeDocument.visibilityState = 'visible';
    fakeDocument.dispatchEvent(new Event('visibilitychange'));
    assert(automaticAttempts === 4,
      'Making the app visible again automatically retries pending sync');

    lifecycleCoordinator.stopPeriodicSync();
  } catch (error: any) {
    assert(false, `Automatic network lifecycle retry test failed: ${error?.message || error}`);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }

  // A remote read is not a completed remote import/projection.
  assert(getCloudSyncCompletionStatus(0, false) === 'partial',
    'Zero pending uploads still reports partial when remote changes are not applied');
  assert(getCloudSyncCompletionStatus(0, true) === 'synced',
    'Full sync requires zero pending uploads and completed remote reconciliation');
  assert(getCloudSyncCompletionStatus(2, true) === 'error',
    'Pending local mutations prevent a synced status even if remote reconciliation passed');
  assert(getCloudSyncCompletionStatus(-1, false) === 'error',
    'Invalid pending counts cannot produce a successful sync status');

  // Every private revisioned collection must participate in legacy first-sync detection.
  // Ruqyah progress was added after the original collection scan and must not be skipped.
  assert(
    LEGACY_REMOTE_STATE_COLLECTIONS.includes('ruqyahProgress'),
    'Ruqyah progress participates in the legacy remote-state first-sync scan'
  );

  const remoteEvent = { baseRevision: 1, revision: 2, operation: 'upsert' as const };
  assert(decideRemoteProjection(remoteEvent, {
    cachedRevision: 1, hasPendingLocalMutation: false, localProjectionEmpty: false
  }) === 'apply', 'A remote event applies when its base matches the known local server revision');
  assert(decideRemoteProjection({ ...remoteEvent, baseRevision: 0, revision: 1 }, {
    cachedRevision: null, hasPendingLocalMutation: false, localProjectionEmpty: true
  }) === 'apply', 'A first remote snapshot applies to an empty local archive');
  assert(decideRemoteProjection({ ...remoteEvent, baseRevision: 0, revision: 1 }, {
    cachedRevision: null, hasPendingLocalMutation: false, localProjectionEmpty: false,
    remoteCollectionInitialized: true
  }) === 'apply', 'Later snapshot documents in an already imported collection preserve server order');

  assert(decideRemoteProjection(remoteEvent, {
    cachedRevision: 1, hasPendingLocalMutation: true, localProjectionEmpty: false
  }) === 'blocked_pending_local', 'Remote projection never overwrites a document with pending local mutations');
  assert(decideRemoteProjection({ ...remoteEvent, baseRevision: 0, revision: 1 }, {
    cachedRevision: null, hasPendingLocalMutation: false, localProjectionEmpty: false
  }) === 'blocked_base_revision', 'Unknown existing local data blocks first-sync replacement');
  assert(decideRemoteProjection(remoteEvent, {
    cachedRevision: 2, hasPendingLocalMutation: false, localProjectionEmpty: false
  }) === 'already_applied', 'An event already represented by a newer local revision is safely skipped');
  assert(decideRemoteProjection({ ...remoteEvent, operation: 'tombstone' }, {
    cachedRevision: 1, hasPendingLocalMutation: false, localProjectionEmpty: false
  }) === 'blocked_tombstone', 'Tombstones remain blocked until collection-specific delete semantics exist');



  function makeRemoteEvent(overrides: Partial<RemoteInboxEvent> = {}): RemoteInboxEvent {
    return {
      key: 'remote-user:event-1',
      uid: 'remote-user',
      eventId: 'event-1',
      mutationId: 'event-1',
      eventType: 'domain-mutation',
      collection: 'plans',
      documentId: 'snapshot',
      operation: 'upsert',
      schemaVersion: 2,
      deviceId: 'remote-device',
      occurredAtMs: 1000,
      payload: { records: [{ id: 'plan-1' }] },
      baseRevision: 0,
      revision: 1,
      serverSequence: 1,
      fingerprint: '0123456789abcdef',
      ...overrides
    };
  }

  function makeProjectionHarness(
    events: RemoteInboxEvent[],
    options: {
      pending?: string[];
      pendingDocuments?: string[];
      initialized?: string[];
      empty?: string[];
      revisions?: Array<[string, number]>;
      applySucceeds?: boolean;
    } = {}
  ): { dependencies: RemoteProjectionDependencies; state: {
    cursor: number;
    applied: number;
    revisions: Map<string, RemoteRevisionSnapshot>;
    initialized: Set<string>;
    conflicts: Array<{ eventId: string; reason: string; snapshot: Record<string, string | null>; status: 'open' | 'resolved' }>;
    pending: Set<string>;
  } } {
    const state = {
      cursor: 0,
      applied: 0,
      revisions: new Map<string, RemoteRevisionSnapshot>(
        (options.revisions || []).map(([key, revision]) => [key, { revision, localSequence: 0 }])
      ),
      initialized: new Set(options.initialized || []),
      conflicts: [] as Array<{ eventId: string; reason: string; snapshot: Record<string, string | null>; status: 'open' | 'resolved' }>,
      pending: new Set(options.pending || [])
    };
    const pending = state.pending;
    const pendingDocuments = new Set(options.pendingDocuments || []);
    const empty = new Set(options.empty || []);
    const keyOf = (collection: string, documentId: string) => collection + ':' + documentId;
    let projectionIntent: RemoteProjectionIntent | null = null;
    const sameIntent = (left: RemoteProjectionIntent | null, right: RemoteProjectionIntent) =>
      !!left && left.sequence === right.sequence && left.eventId === right.eventId &&
      left.collection === right.collection && left.documentId === right.documentId &&
      left.revision === right.revision &&
      left.initializedCollections.length === right.initializedCollections.length &&
      left.initializedCollections.every((collection, index) => collection === right.initializedCollections[index]);
    const dependencies: RemoteProjectionDependencies = {
      getRemoteProjectionCursor: async () => state.cursor,
      listRemoteInboxAfter: async (sequence, limit) =>
        events.filter(event => event.serverSequence > sequence).slice(0, limit),
      getRemoteRevision: async (collection, documentId) =>
        state.revisions.get(keyOf(collection, documentId)) || null,
      hasPendingForCollection: async collection => pending.has(collection),
      hasPendingForDocument: async (collection, documentId) =>
        pendingDocuments.has(keyOf(collection, documentId)) || pending.has(collection),
      isRemoteCollectionInitialized: async collection => state.initialized.has(collection),
      isLocalProjectionEmpty: collection => empty.has(collection),
      applyJournalEvent: () => {
        state.applied++;
        return options.applySucceeds !== false;
      },
      setRemoteRevisionFromRemote: async (collection, documentId, revision) => {
        state.revisions.set(keyOf(collection, documentId), { revision, localSequence: 0 });
        state.initialized.add(collection);
        return true;
      },
      markRemoteProjected: async sequence => {
        if (sequence !== state.cursor + 1) return false;
        state.cursor = sequence;
        const event = events.find(candidate => candidate.serverSequence === sequence);
        const conflict = event && state.conflicts.find(candidate => candidate.eventId === event.eventId);
        if (conflict) conflict.status = 'resolved';
        return true;
      },
      markRemoteCollectionInitialized: async collection => {
        state.initialized.add(collection);
        return true;
      },
      getLocalProjectionSnapshot: collection => ({ [collection]: 'local-snapshot' }),
      saveProjectionConflict: async (event, reason, snapshot) => {
        const existing = state.conflicts.find(conflict => conflict.eventId === event.eventId);
        if (existing) existing.reason = reason;
        else state.conflicts.push({ eventId: event.eventId, reason, snapshot, status: 'open' });
        return true;
      },
      getRemoteProjectionIntent: async () => projectionIntent,
      prepareRemoteProjection: async intent => {
        if (projectionIntent && !sameIntent(projectionIntent, intent)) return false;
        projectionIntent = intent;
        return true;
      },
      finalizeRemoteProjection: async (intent, applyProjection) => {
        if (!sameIntent(projectionIntent, intent) || intent.sequence !== state.cursor + 1) return false;
        const affected = new Set([intent.collection, ...intent.initializedCollections]);
        if ([...affected].some(collection => pending.has(collection))) return false;
        const key = keyOf(intent.collection, intent.documentId);
        const current = state.revisions.get(key);
        if (!current || current.revision < intent.revision) {
          if (!applyProjection()) return false;
        }
        state.revisions.set(key, {
          revision: Math.max(current?.revision ?? 0, intent.revision),
          localSequence: current?.localSequence ?? 0
        });
        for (const collection of intent.initializedCollections) state.initialized.add(collection);
        if (intent.collection !== 'syncMeta') state.initialized.add(intent.collection);
        state.cursor = intent.sequence;
        const conflict = state.conflicts.find(candidate => candidate.eventId === intent.eventId);
        if (conflict) conflict.status = 'resolved';
        projectionIntent = null;
        return true;
      }
    };
    return { dependencies, state };
  }

  try {
    const event = makeRemoteEvent();
    const harness = makeProjectionHarness([event], { empty: ['plans'] });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.projectedCount === 1 && harness.state.cursor === 1 &&
      harness.state.revisions.get('plans:snapshot')?.revision === 1 && harness.state.applied === 1,
      'Remote projection applies a matching first snapshot and advances revision/cursor only after success');
  } catch (err: any) {
    assert(false, `Remote first-snapshot projection failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent({ documentId: 'test-2', collection: 'tests' });
    const harness = makeProjectionHarness([event], {
      initialized: ['tests'],
      empty: []
    });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.projectedCount === 1 && harness.state.cursor === 1,
      'A later document in a remotely initialized collection can be projected without treating imported data as local legacy data');
  } catch (err: any) {
    assert(false, `Initialized collection projection failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent({ collection: 'tests', documentId: 'remote-test' });
    const harness = makeProjectionHarness([event], {
      pendingDocuments: ['tests:local-test'],
      empty: ['tests']
    });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.projectedCount === 1 && harness.state.cursor === 1 &&
      harness.state.applied === 1 && harness.state.conflicts.length === 0,
      'A pending test-result mutation for another test ID does not block an independent remote test document');
  } catch (err: any) {
    assert(false, `Independent document projection guard failed: ${err?.message}`);
  }

  try {
    const itemId = 'q-fatihah';
    const localSnapshot = adjustRuqyahProgressCounter(
      createEmptyRuqyahProgressSnapshot(5000), itemId, 'local-device', 2, 5001
    );
    const remoteSnapshot = adjustRuqyahProgressCounter(
      createEmptyRuqyahProgressSnapshot(5000), itemId, 'remote-device', 3, 5002
    );
    const event = makeRemoteEvent({
      eventId: 'ruqyah-per-device resettable counter-event',
      mutationId: 'ruqyah-per-device resettable counter-event',
      collection: 'ruqyahProgress',
      documentId: 'snapshot',
      payload: { snapshot: remoteSnapshot },
      baseRevision: 0,
      revision: 1,
      serverSequence: 1
    });
    const harness = makeProjectionHarness([event], { pending: ['ruqyahProgress'], empty: [] });
    const mergeResult: { snapshot?: ReturnType<typeof mergeRuqyahProgressSnapshots> } = {};
    harness.dependencies.getLocalRuqyahProgressSnapshot = () => localSnapshot;
    harness.dependencies.finalizeRuqyahProgressMerge = async (intent, applyMergedProjection) => {
      if (intent.sequence !== 1 || intent.eventId !== event.eventId) return false;
      mergeResult.snapshot = mergeRuqyahProgressSnapshots(localSnapshot, remoteSnapshot, 5003);
      const replacementEvent = {
        ...event,
        key: 'remote-user:merged-ruqyah-event',
        eventId: 'merged-ruqyah-event',
        mutationId: 'merged-ruqyah-event',
        deviceId: 'local-device',
        payload: { snapshot: mergeResult.snapshot },
        baseRevision: 1,
        revision: 2,
        serverSequence: 2,
        fingerprint: 'fedcba9876543210'
      } as unknown as import('./indexedDbSyncJournal').JournalEvent;
      if (!applyMergedProjection(replacementEvent)) return false;
      harness.state.cursor = intent.sequence;
      harness.state.revisions.set('ruqyahProgress:snapshot', { revision: 1, localSequence: 1 });
      harness.state.pending.delete('ruqyahProgress');
      const conflict = harness.state.conflicts.find(item => item.eventId === event.eventId);
      if (conflict) conflict.status = 'resolved';
      return true;
    };
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.projectedCount === 1 && harness.state.cursor === 1 &&
      harness.state.applied === 1 && !harness.state.pending.has('ruqyahProgress') &&
      mergeResult.snapshot?.counts[itemId] === 5 &&
      harness.state.conflicts[0]?.status === 'resolved',
      'Concurrent V2 Ruqyah counters are merged additively and atomically replace stale local pending state');
  } catch (err: any) {
    assert(false, `Ruqyah per-device resettable counter projection merge failed: ${err?.message}`);
  }

  try {
    const itemId = 'q-fatihah';
    const localV2 = adjustRuqyahProgressCounter(
      createEmptyRuqyahProgressSnapshot(5100), itemId, 'local-device', 2, 5101
    );
    const remoteLegacy = { schemaVersion: 1 as const, updatedAtMs: 5102, counts: { [itemId]: 3 } };
    const event = makeRemoteEvent({
      eventId: 'ruqyah-legacy-conflict',
      mutationId: 'ruqyah-legacy-conflict',
      collection: 'ruqyahProgress',
      documentId: 'snapshot',
      payload: { snapshot: remoteLegacy },
      baseRevision: 0,
      revision: 1,
      serverSequence: 1
    });
    const harness = makeProjectionHarness([event], { pending: ['ruqyahProgress'], empty: [] });
    harness.dependencies.getLocalRuqyahProgressSnapshot = () => localV2;
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.reason === 'blocked_pending_local' && harness.state.cursor === 0 &&
      harness.state.applied === 0 && harness.state.conflicts[0]?.status === 'open',
      'Legacy V1 remote snapshots remain archived against V2 local counters instead of being merged with guessed additive semantics');
  } catch (err: any) {
    assert(false, `Legacy Ruqyah migration conflict guard failed: ${err?.message}`);
  }

  try {
    const itemId = 'q-fatihah';
    const localLegacyV2 = {
      schemaVersion: 2 as const,
      updatedAtMs: 5200,
      counts: { [itemId]: 4 },
      components: { [itemId]: { increments: { legacy: 4 }, resetWatermarks: {} } }
    };
    const remoteLegacyV2 = {
      schemaVersion: 2 as const,
      updatedAtMs: 5201,
      counts: { [itemId]: 6 },
      components: { [itemId]: { increments: { legacy: 6 }, resetWatermarks: {} } }
    };
    const event = makeRemoteEvent({
      eventId: 'ruqyah-divergent-legacy-v2',
      mutationId: 'ruqyah-divergent-legacy-v2',
      collection: 'ruqyahProgress',
      documentId: 'snapshot',
      payload: { snapshot: remoteLegacyV2 },
      baseRevision: 0,
      revision: 1,
      serverSequence: 1
    });
    const harness = makeProjectionHarness([event], { pending: ['ruqyahProgress'], empty: [] });
    harness.dependencies.getLocalRuqyahProgressSnapshot = () => localLegacyV2;
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.reason === 'blocked_pending_local' && harness.state.cursor === 0 &&
      harness.state.applied === 0 && harness.state.conflicts[0]?.status === 'open',
      'Different migrated legacy baselines must stay archived without creating an unsafe automatic merge intent');
  } catch (err: any) {
    assert(false, `Divergent legacy counter baseline guard failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent();
    const harness = makeProjectionHarness([event], { pending: ['plans'], empty: ['plans'] });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.reason === 'blocked_pending_local' && result.blockedAtSequence === 1 &&
      harness.state.cursor === 0 && harness.state.applied === 0 &&
      harness.state.conflicts.length === 1 &&
      harness.state.conflicts[0].eventId === event.eventId &&
      harness.state.conflicts[0].snapshot.plans === 'local-snapshot' &&
      harness.state.conflicts[0].status === 'open',
      'A blocked remote projection archives the remote event and local snapshot without cursor movement');
    harness.state.pending.delete('plans');
    harness.state.revisions.set('plans:snapshot', { revision: 1, localSequence: 0 });
    const reconciled = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(reconciled.projectedCount === 1 && harness.state.cursor === 1 &&
      harness.state.conflicts[0].status === 'resolved',
      'A later acknowledged local revision resolves the archived conflict only when the cursor advances');
  } catch (err: any) {
    assert(false, `Pending mutation projection guard failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent();
    const harness = makeProjectionHarness([event]);
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.reason === 'blocked_base_revision' && harness.state.cursor === 0 &&
      harness.state.applied === 0,
      'Unknown non-empty local state is never replaced by an unbased remote snapshot');
  } catch (err: any) {
    assert(false, `Unknown local state guard failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent({ operation: 'tombstone', baseRevision: 1, revision: 2 });
    const harness = makeProjectionHarness([event], { revisions: [['plans:snapshot', 1]] });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.reason === 'blocked_tombstone' && harness.state.cursor === 0,
      'Tombstones remain durable and block projection until safe delete semantics are implemented');
  } catch (err: any) {
    assert(false, `Tombstone projection guard failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent({ baseRevision: 1, revision: 2 });
    const harness = makeProjectionHarness([event], { revisions: [['plans:snapshot', 2]] });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.projectedCount === 1 && harness.state.cursor === 1 && harness.state.applied === 0,
      'Already-applied remote revisions advance the cursor without replaying local projection');
  } catch (err: any) {
    assert(false, `Already-applied projection test failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent({
      collection: 'syncMeta',
      documentId: 'transaction-1',
      payload: { transaction: { operations: [
        { collection: 'plans' }, { collection: 'portions' }
      ] } }
    });
    const harness = makeProjectionHarness([event], {
      empty: ['plans', 'portions'],
      pending: []
    });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.projectedCount === 1 && harness.state.cursor === 1 &&
      harness.state.initialized.has('plans') && harness.state.initialized.has('portions'),
      'Grouped remote transactions initialize every affected collection after a successful atomic local projection');
  } catch (err: any) {
    assert(false, `Grouped transaction projection test failed: ${err?.message}`);
  }

  try {
    const event = makeRemoteEvent();
    const harness = makeProjectionHarness([event], { empty: ['plans'], applySucceeds: false });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.reason === 'projection_failed' && harness.state.cursor === 0,
      'Failed local projection retains the inbox event and leaves the projection cursor unchanged');
  } catch (err: any) {
    assert(false, `Projection failure retention test failed: ${err?.message}`);
  }

  try {
    const initialState = cloudSyncCoordinator.getState();
    assert(
      typeof initialState.status === 'string' &&
      typeof initialState.isOnline === 'boolean' &&
      typeof initialState.pendingCount === 'number' &&
      typeof initialState.remoteInboxPendingCount === 'number' &&
      typeof initialState.remoteCursor === 'number' &&
      typeof initialState.remoteProjectionCursor === 'number' &&
      initialState.remoteProjectionBlockReason === null &&
      initialState.remoteProjectionBlockedAtSequence === null &&
      initialState.projectionConflictCount === 0 &&
      initialState.latestProjectionConflict === null,
      'Initial cloud sync state has valid structure'
    );
  } catch (err: any) {
    assert(false, `Initial state test failed: ${err?.message}`);
  }

  try {
    StorageService.setStorageScope('guest');
    const result = await cloudSyncCoordinator.triggerSync();
    assert(result === false, 'Guest scope rejects cloud sync execution');
    const state = cloudSyncCoordinator.getState();
    assert(state.status === 'guest', 'Guest scope sets sync status to guest');
  } catch (err: any) {
    assert(false, `Guest sync test failed: ${err?.message}`);
  }

  try {
    let notifiedState: CloudSyncState | null = null;
    const unsub = cloudSyncCoordinator.subscribe((s) => {
      notifiedState = s;
    });
    assert(notifiedState !== null, 'Subscriber receives current state immediately');
    unsub();
  } catch (err: any) {
    assert(false, `Subscription test failed: ${err?.message}`);
  }

  try {
    StorageService.setStorageScope('guest');
    const count = await cloudSyncCoordinator.refreshPendingCount();
    assert(count === 0, 'Guest scope returns 0 pending cloud mutations');
  } catch (err: any) {
    assert(false, `Pending count test failed: ${err?.message}`);
  }

  // Atomic Transaction test for deleting engine plans & network instability handling
  try {
    StorageService.__resetStorageForTests();
    assert(StorageService.setStorageScope('user:atomic-deletion-test'), 'Scoped storage should initialize for atomic transaction test');
    const journal = new IndexedDbSyncJournal({ indexedDBFactory: new IDBFactory(), databaseName: 'wird-sync-atomic-test' });

    const plan1 = buildDemoEnginePlan();
    plan1.id = 'plan-delete-1';
    plan1.title = 'خطة سورة الملك للتجربة';
    const plan2 = buildDemoEnginePlan();
    plan2.id = 'plan-keep-2';
    plan2.title = 'خطة سورة البقرة للتجربة';

    const inlineLock = async (_name: string, task: () => Promise<any>) => task();

    // 1. Initial atomic persist of two plans
    const initialWrite = await persistEnginePlansSnapshot([plan1, plan2], { journal, runExclusive: inlineLock });
    assert(initialWrite.success, 'Initial engine plans snapshot write succeeds');
    assert(StorageService.getEnginePlans().length === 2, 'Local storage contains 2 active engine plans');

    // 2. Perform atomic deletion of plan1 (remaining: [plan2])
    const remainingPlans = [plan2];
    const deleteWrite = await persistEnginePlansSnapshot(remainingPlans, { journal, runExclusive: inlineLock });
    assert(deleteWrite.success, 'Atomic deletion of engine plan succeeds');

    // Verify local projection consistency after deletion
    const currentPlans = StorageService.getEnginePlans();
    assert(currentPlans.length === 1 && currentPlans[0].id === 'plan-keep-2',
      'Local storage accurately reflects remaining plans after atomic deletion');

    // 3. Verify Remote Transaction Payload & Inbox/Outbox Consistency
    const remoteDeleteEvent = makeRemoteEvent({
      collection: 'enginePlans',
      documentId: 'snapshot',
      operation: 'upsert',
      payload: { records: remainingPlans },
      baseRevision: 1,
      revision: 2
    });

    const projectionDecision = decideRemoteProjection(remoteDeleteEvent, {
      cachedRevision: 1,
      hasPendingLocalMutation: false,
      localProjectionEmpty: false
    });
    assert(projectionDecision === 'apply', 'Atomic delete event applies cleanly when base revision matches');

    // 4. Handle Network Instability & Retry Simulation
    // Simulate network error during cloud sync
    const unstableNetworkHarness = makeProjectionHarness([remoteDeleteEvent], {
      empty: [],
      pending: [],
      revisions: [['enginePlans:snapshot', 1]],
      applySucceeds: false // Simulates transient failure during network commit
    });

    const failedBatch = await projectRemoteInboxBatch(10, unstableNetworkHarness.dependencies);
    assert(
      failedBatch.reason === 'projection_failed' && unstableNetworkHarness.state.cursor === 0,
      'Network failure safely retains transaction without corrupting local projection or advancing cursor'
    );

    // Verify local storage is untouched after transient network failure
    assert(
      StorageService.getEnginePlans().length === 1,
      'Transient network failure leaves local persisted state intact and consistent'
    );

    // Network recovers: retry atomic sync transaction
    const recoveredNetworkHarness = makeProjectionHarness([remoteDeleteEvent], {
      empty: [],
      pending: [],
      revisions: [['enginePlans:snapshot', 1]],
      applySucceeds: true
    });

    const recoveredBatch = await projectRemoteInboxBatch(10, recoveredNetworkHarness.dependencies);
    assert(
      recoveredBatch.projectedCount === 1 && recoveredNetworkHarness.state.cursor === 1,
      'Network recovery successfully commits atomic deletion transaction and advances sync cursor'
    );

    assert(
      recoveredNetworkHarness.state.initialized.has('enginePlans'),
      'Atomic transaction reconciliation leaves zero orphaned or inconsistent remote documents'
    );
  } catch (err: any) {
    assert(false, `Engine plan atomic deletion and network resilience test failed: ${err?.message}`);
  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
