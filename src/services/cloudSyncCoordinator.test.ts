import { cloudSyncCoordinator, CloudSyncState, getCloudSyncCompletionStatus } from './cloudSyncCoordinator';
import { StorageService } from './storageService';
import type { SuiteResult } from '../tests/runAllTests';
import { decideRemoteProjection, projectRemoteInboxBatch, type RemoteProjectionDependencies } from './remoteInboxProjector';
import type { RemoteInboxEvent, RemoteRevisionSnapshot } from './indexedDbSyncJournal';

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

  // A remote read is not a completed remote import/projection.
  assert(getCloudSyncCompletionStatus(0, false) === 'partial',
    'Zero pending uploads still reports partial when remote changes are not applied');
  assert(getCloudSyncCompletionStatus(0, true) === 'synced',
    'Full sync requires zero pending uploads and completed remote reconciliation');
  assert(getCloudSyncCompletionStatus(2, true) === 'error',
    'Pending local mutations prevent a synced status even if remote reconciliation passed');
  assert(getCloudSyncCompletionStatus(-1, false) === 'error',
    'Invalid pending counts cannot produce a successful sync status');

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
  } } {
    const state = {
      cursor: 0,
      applied: 0,
      revisions: new Map<string, RemoteRevisionSnapshot>(
        (options.revisions || []).map(([key, revision]) => [key, { revision, localSequence: 0 }])
      ),
      initialized: new Set(options.initialized || [])
    };
    const pending = new Set(options.pending || []);
    const empty = new Set(options.empty || []);
    const keyOf = (collection: string, documentId: string) => collection + ':' + documentId;
    const dependencies: RemoteProjectionDependencies = {
      getRemoteProjectionCursor: async () => state.cursor,
      listRemoteInboxAfter: async (sequence, limit) =>
        events.filter(event => event.serverSequence > sequence).slice(0, limit),
      getRemoteRevision: async (collection, documentId) =>
        state.revisions.get(keyOf(collection, documentId)) || null,
      hasPendingForCollection: async collection => pending.has(collection),
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
        return true;
      },
      markRemoteCollectionInitialized: async collection => {
        state.initialized.add(collection);
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
    const event = makeRemoteEvent();
    const harness = makeProjectionHarness([event], { pending: ['plans'], empty: ['plans'] });
    const result = await projectRemoteInboxBatch(10, harness.dependencies);
    assert(result.reason === 'blocked_pending_local' && result.blockedAtSequence === 1 &&
      harness.state.cursor === 0 && harness.state.applied === 0,
      'Any pending local mutation in the snapshot collection blocks remote projection without cursor movement');
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
      typeof initialState.pendingCount === 'number',
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

  return { passed, failed };
}
