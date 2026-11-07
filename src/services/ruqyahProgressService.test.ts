import { RUQYAH_ITEMS } from '../data/ruqyahData';
import { STORAGE_KEYS, StorageService } from './storageService';
import { loadRuqyahProgress, resetRuqyahProgress, saveRuqyahProgress } from './ruqyahProgressService';
import { adjustRuqyahProgressCounter, createEmptyRuqyahProgressSnapshot, isValidRuqyahProgressSnapshot, mergeRuqyahProgressSnapshots, migrateRuqyahProgressSnapshot, resetRuqyahProgressCounter } from './ruqyahProgressSchema';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runRuqyahProgressServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error))); }
  };

  StorageService.__resetStorageForTests();
  test('Empty progress starts without fabricated completion', () => {
    assert(loadRuqyahProgress().status === 'empty', 'New Ruqyah state must be empty');
  });

  test('Progress is durably saved and reloaded through scoped storage', () => {
    const itemId = RUQYAH_ITEMS[0].id;
    saveRuqyahProgress({ [itemId]: 2 }, 123456);
    const loaded = loadRuqyahProgress();
    assert(loaded.status === 'loaded', 'Saved progress must load');
    assert(loaded.counts[itemId] === 2, 'Saved count must be preserved');
    if (loaded.status === 'loaded') assert(loaded.updatedAtMs === 123456, 'Timestamp must be preserved');
  });

  test('Progress is isolated between authenticated user scopes', () => {
    StorageService.__resetStorageForTests();
    const itemId = RUQYAH_ITEMS[0].id;
    assert(StorageService.setStorageScope('user:ruqyah-account-a'), 'First account scope should initialize');
    saveRuqyahProgress({ [itemId]: 4 }, 123457);
    assert(StorageService.setStorageScope('user:ruqyah-account-b'), 'Second account scope should initialize');
    assert(loadRuqyahProgress().status === 'empty', 'Second account must not inherit first account progress');
    assert(StorageService.setStorageScope('user:ruqyah-account-a'), 'Returning account scope should initialize');
    const loaded = loadRuqyahProgress();
    assert(loaded.status === 'loaded' && loaded.counts[itemId] === 4, 'Original account progress must remain intact');
  });

  test('Malformed progress is reported and its original bytes are preserved', () => {
    StorageService.__resetStorageForTests();
    const key = STORAGE_KEYS.RUQYAH_PROGRESS;
    const malformed = '{"schemaVersion":1,"counts":{"q-fatihah":"many"}';
    assert(StorageService.setRawItem(key, malformed), 'Malformed fixture must be stored');
    assert(loadRuqyahProgress().status === 'corrupt', 'Malformed state must be reported');
    assert(StorageService.getRawItem(key) === malformed, 'Malformed bytes must not be overwritten');
  });

  test('Progress rejects malformed IDs, negative counts, and excessive values', () => {
    StorageService.__resetStorageForTests();
    for (const counts of [{ 'bad id!': 1 }, { [RUQYAH_ITEMS[0].id]: -1 }, { [RUQYAH_ITEMS[0].id]: 1001 }]) {
      let rejected = false;
      try { saveRuqyahProgress(counts, 123458); } catch { rejected = true; }
      assert(rejected, 'Invalid count payload must be rejected');
    }
  });

  test('Independent device increments merge additively and idempotently', () => {
    const itemId = RUQYAH_ITEMS[0].id;
    const base = createEmptyRuqyahProgressSnapshot(200000);
    const deviceA = adjustRuqyahProgressCounter(base, itemId, 'device-A', 2, 200001);
    const deviceB = adjustRuqyahProgressCounter(base, itemId, 'device-B', 3, 200002);
    const merged = mergeRuqyahProgressSnapshots(deviceA, deviceB, 200003);
    assert(merged.counts[itemId] === 5, 'Two independent increments from the same base must add, not overwrite');
    assert(isValidRuqyahProgressSnapshot(merged), 'Merged per-device resettable counter snapshot must validate');
    const repeated = mergeRuqyahProgressSnapshots(merged, merged, 200004);
    assert(repeated.counts[itemId] === 5, 'Replaying the same remote snapshot must not duplicate increments');
    const reversed = mergeRuqyahProgressSnapshots(deviceB, deviceA, 200005);
    assert(reversed.counts[itemId] === 5, 'Merge order must not affect the resulting total');
  });

  test('Concurrent reset preserves increments that were not observed by the resetting device', () => {
    const itemId = RUQYAH_ITEMS[0].id;
    const base = createEmptyRuqyahProgressSnapshot(210000);
    const local = adjustRuqyahProgressCounter(base, itemId, 'device-A', 4, 210001);
    const remoteConcurrent = adjustRuqyahProgressCounter(base, itemId, 'device-B', 2, 210002);
    const resetLocal = resetRuqyahProgressCounter(local, itemId, 'device-A', 210003);
    const merged = mergeRuqyahProgressSnapshots(resetLocal, remoteConcurrent, 210004);
    assert(merged.counts[itemId] === 2,
      'A reset subtracts the local known total but must preserve a concurrent unseen device increment');
  });

  test('Two devices resetting the same observed baseline converge to zero without double subtraction', () => {
    const itemId = RUQYAH_ITEMS[0].id;
    const base = adjustRuqyahProgressCounter(createEmptyRuqyahProgressSnapshot(215000), itemId, 'device-A', 4, 215001);
    const resetA = resetRuqyahProgressCounter(base, itemId, 'device-A', 215002);
    const resetB = resetRuqyahProgressCounter(base, itemId, 'device-B', 215003);
    const merged = mergeRuqyahProgressSnapshots(resetA, resetB, 215004);
    assert((merged.counts[itemId] ?? 0) === 0,
      'Concurrent resets of the same observed increments must merge idempotently without producing a negative count');
  });

  test('Legacy V1 migration shares a single baseline component without double counting', () => {
    const itemId = RUQYAH_ITEMS[0].id;
    const legacy = { schemaVersion: 1 as const, updatedAtMs: 220000, counts: { [itemId]: 7 } };
    const a = migrateRuqyahProgressSnapshot(legacy);
    const b = migrateRuqyahProgressSnapshot(legacy);
    const merged = mergeRuqyahProgressSnapshots(a, b, 220001);
    assert(merged.counts[itemId] === 7, 'The same legacy baseline must not be added twice during migration');
  });

  test('Divergent V1 migration baselines are rejected instead of guessed or silently undercounted', () => {
    const itemId = RUQYAH_ITEMS[0].id;
    const local = migrateRuqyahProgressSnapshot({
      schemaVersion: 1 as const, updatedAtMs: 225000, counts: { [itemId]: 4 }
    });
    const remote = migrateRuqyahProgressSnapshot({
      schemaVersion: 1 as const, updatedAtMs: 225001, counts: { [itemId]: 6 }
    });
    let rejected = false;
    try { mergeRuqyahProgressSnapshots(local, remote, 225002); } catch { rejected = true; }
    assert(rejected, 'Different legacy totals may contain overlapping offline increments and must not be merged by max or sum');
  });

  test('V2 validation rejects a derived total that disagrees with PN components', () => {
    const itemId = RUQYAH_ITEMS[0].id;
    const valid = adjustRuqyahProgressCounter(createEmptyRuqyahProgressSnapshot(230000), itemId, 'device-A', 1, 230001);
    const invalid = { ...valid, counts: { [itemId]: 2 } };
    assert(!isValidRuqyahProgressSnapshot(invalid), 'A forged or stale aggregate count must fail validation');
  });

  test('Reset removes only Ruqyah progress', () => {
    StorageService.__resetStorageForTests();
    const itemId = RUQYAH_ITEMS[0].id;
    StorageService.setRawItem('wird_unrelated_fixture', 'keep');
    saveRuqyahProgress({ [itemId]: 1 }, 123459);
    resetRuqyahProgress();
    assert(loadRuqyahProgress().status === 'empty', 'Ruqyah progress must be removed');
    assert(StorageService.getRawItem('wird_unrelated_fixture') === 'keep', 'Unrelated WIRD data must remain');
  });

  StorageService.__resetStorageForTests();
  return { passed, failed };
}
