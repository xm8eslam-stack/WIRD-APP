import { cloudSyncCoordinator, CloudSyncState, getCloudSyncCompletionStatus } from './cloudSyncCoordinator';
import { StorageService } from './storageService';
import type { SuiteResult } from '../tests/runAllTests';

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

  // Test 1: Initial state has valid structure and offline/online status
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

  // Test 2: Guest scope refuses cloud sync and reports 'guest'
  try {
    StorageService.setStorageScope('guest');
    const result = await cloudSyncCoordinator.triggerSync();
    assert(result === false, 'Guest scope rejects cloud sync execution');
    const state = cloudSyncCoordinator.getState();
    assert(state.status === 'guest', 'Guest scope sets sync status to guest');
  } catch (err: any) {
    assert(false, `Guest sync test failed: ${err?.message}`);
  }

  // Test 3: State subscription correctly notifies registered listeners
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

  // Test 4: Refresh pending count handles guest scope without throwing
  try {
    StorageService.setStorageScope('guest');
    const count = await cloudSyncCoordinator.refreshPendingCount();
    assert(count === 0, 'Guest scope returns 0 pending cloud mutations');
  } catch (err: any) {
    assert(false, `Pending count test failed: ${err?.message}`);
  }

  return { passed, failed };
}
