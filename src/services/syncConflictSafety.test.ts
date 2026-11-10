import { containsUnsafeFullSnapshotProjection } from './syncConflictSafety';

export function runSyncConflictSafetyTests(): { passed: number; failed: number } {
  let passed = 0, failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('direct weak-verse and daily activity snapshot conflicts cannot be resolved by whole-snapshot choice', () => {
    assert(containsUnsafeFullSnapshotProjection({ collection: 'weakVerses', payload: { records: [] } }),
      'Weak-verse snapshots must stay blocked until merge and tombstone semantics exist');
    assert(containsUnsafeFullSnapshotProjection({ collection: 'activityEvents', payload: { records: [] } }),
      'Daily activity snapshots must stay blocked until event-based aggregation exists');
  });

  test('grouped syncMeta conflicts are blocked when any child is a weak-verse or activity snapshot', () => {
    for (const collection of ['weakVerses', 'activityEvents']) {
      assert(containsUnsafeFullSnapshotProjection({
        collection: 'syncMeta',
        payload: { transaction: { version: 1, operations: [
          { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: {} } },
          { collection, documentId: 'snapshot', operation: 'upsert', payload: { records: [] } }
        ] } }
      }), 'Grouped transaction containing ' + collection + ' must remain unresolved atomically');
    }
  });

  test('safe grouped profile and portion snapshots retain explicit conflict choices', () => {
    assert(!containsUnsafeFullSnapshotProjection({
      collection: 'syncMeta',
      payload: { transaction: { version: 1, operations: [
        { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: {} } },
        { collection: 'portions', documentId: 'snapshot', operation: 'upsert', payload: { records: [] } }
      ] } }
    }), 'Unrelated supported collections must not be blocked by the weak/activity gate');
  });

  test('malformed grouped transaction payloads fail closed', () => {
    assert(containsUnsafeFullSnapshotProjection({
      collection: 'syncMeta',
      payload: { transaction: { version: 2, operations: [] } }
    }), 'Unknown grouped transaction schemas must not permit destructive conflict choices');
  });

  test('non-grouped syncMeta metadata is not classified as a weak/activity snapshot', () => {
    assert(!containsUnsafeFullSnapshotProjection({ collection: 'syncMeta', payload: { marker: 'metadata' } }),
      'Non-projection sync metadata should not be blocked by this collection-specific guard');
  });

  return { passed, failed };
}
