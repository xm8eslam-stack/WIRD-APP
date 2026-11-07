import { cloudSyncCoordinator, CloudSyncState, getCloudSyncCompletionStatus } from './cloudSyncCoordinator';
import { StorageService } from './storageService';
import type { SuiteResult } from '../tests/runAllTests';
import { decideRemoteProjection } from './remoteInboxProjector';

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
