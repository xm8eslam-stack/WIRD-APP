import { RUQYAH_ITEMS } from '../data/ruqyahData';
import { StorageService } from './storageService';
import { loadRuqyahProgress, resetRuqyahProgress, saveRuqyahProgress } from './ruqyahProgressService';

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
    const key = 'wird_ruqyah_progress_v1';
    const malformed = '{"schemaVersion":1,"counts":{"q-fatihah":"many"}';
    assert(StorageService.setRawItem(key, malformed), 'Malformed fixture must be stored');
    assert(loadRuqyahProgress().status === 'corrupt', 'Malformed state must be reported');
    assert(StorageService.getRawItem(key) === malformed, 'Malformed bytes must not be overwritten');
  });

  test('Progress rejects unknown IDs, negative counts, and excessive values', () => {
    StorageService.__resetStorageForTests();
    for (const counts of [{ unknown: 1 }, { [RUQYAH_ITEMS[0].id]: -1 }, { [RUQYAH_ITEMS[0].id]: 1001 }]) {
      let rejected = false;
      try { saveRuqyahProgress(counts, 123458); } catch { rejected = true; }
      assert(rejected, 'Invalid count payload must be rejected');
    }
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
