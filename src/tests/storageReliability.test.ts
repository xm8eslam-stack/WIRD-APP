import { CLEAN_INITIAL_PROFILE, StorageService, STORAGE_KEYS } from '../services/storageService';
import { getLocalDateString } from '../services/unifiedPortionService';

export function runStorageReliabilityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Session completion rolls back the daily log if the profile write fails', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    const today = getLocalDateString();
    const originalLogs = JSON.stringify([{
      date: today,
      memorizedAyahsCount: 4,
      reviewedPagesCount: 1,
      minutesSpent: 8,
      completedTasks: ['جلسة سابقة']
    }]);
    const originalProfile = JSON.stringify({
      ...CLEAN_INITIAL_PROFILE,
      streakDays: 3,
      lastActiveDate: today
    });
    values.set(STORAGE_KEYS.LOGS, originalLogs);
    values.set(STORAGE_KEYS.PROFILE, originalProfile);

    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (key === STORAGE_KEYS.PROFILE) throw new Error('simulated quota failure');
          values.set(key, value);
        },
        removeItem: (key: string) => values.delete(key)
      }
    });

    try {
      const saved = StorageService.recordSessionCompletion(5, 2, 12, 'جلسة اختبار');
      assert(saved === false, 'Failed profile persistence must return false');
      assert(values.get(STORAGE_KEYS.LOGS) === originalLogs, 'Daily log must be restored after profile write failure');
      assert(values.get(STORAGE_KEYS.PROFILE) === originalProfile, 'Profile must remain unchanged after failed write');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Corrupt daily activity archives are preserved and block session completion', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:corrupt-daily-log');
    const corrupt = '{broken daily activity';
    StorageService.setRawItem(STORAGE_KEYS.LOGS, corrupt);
    const saved = StorageService.recordSessionCompletion(3, 0, 5, 'جلسة اختبار');
    assert(saved === false, 'A corrupt activity archive must prevent a false successful completion');
    assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === corrupt, 'Original corrupt activity bytes must remain unchanged');
    StorageService.__resetStorageForTests();
  });

  test('Corrupt plan, revision, and test archives cannot be overwritten by normal writes', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:corrupt-arrays');
    const cases = [
      { key: STORAGE_KEYS.PLANS, read: () => StorageService.getPlans(), write: () => StorageService.savePlans([]) },
      { key: STORAGE_KEYS.ENGINE_PLANS, read: () => StorageService.getEnginePlans(), write: () => StorageService.saveEnginePlans([]) },
      { key: STORAGE_KEYS.REVISION, read: () => StorageService.getRevisionItems(), write: () => StorageService.saveRevisionItems([]) },
      { key: STORAGE_KEYS.TESTS, read: () => StorageService.getTests(), write: () => StorageService.saveTest({} as any) }
    ];
    for (const item of cases) {
      const corrupt = '{broken:' + item.key;
      StorageService.setRawItem(item.key, corrupt);
      assert(item.read().length === 0, 'Display read should remain safe for ' + item.key);
      assert(item.write() === false, 'Normal write must be blocked for ' + item.key);
      assert(StorageService.getRawItem(item.key) === corrupt, 'Original bytes must remain unchanged for ' + item.key);
    }
    StorageService.__resetStorageForTests();
  });

  test('Corrupt canonical portions cannot be replaced by a normal progress write', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:corrupt-canonical-portions');
    StorageService.setRawItem(STORAGE_KEYS.SCHEMA_VERSION, '2');
    const corrupt = '{broken canonical portions';
    StorageService.setRawItem(STORAGE_KEYS.UNIFIED_PORTIONS, corrupt);
    assert(StorageService.saveUnifiedPortions([]) === false, 'A normal canonical save must be blocked');
    assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === corrupt, 'Original canonical portion bytes must remain unchanged');
    StorageService.__resetStorageForTests();
  });

  test('Corrupt profile data is preserved and blocks ordinary profile writes', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:corrupt-profile');
    const corrupt = '{broken profile';
    StorageService.setRawItem(STORAGE_KEYS.PROFILE, corrupt);
    const displayProfile = StorageService.getProfile();
    assert(displayProfile.name === CLEAN_INITIAL_PROFILE.name, 'Profile display should fall back to safe defaults');
    assert(!StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, theme: 'dark' }), 'Normal profile writes must not replace corrupt source data');
    assert(StorageService.getRawItem(STORAGE_KEYS.PROFILE) === corrupt, 'Original profile bytes must remain unchanged');
    StorageService.__resetStorageForTests();
  });

  test('Display reads degrade safely while strict reads and writes preserve corrupt daily logs', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:daily-log-display');
    const corrupt = '{damaged daily log';
    StorageService.setRawItem(STORAGE_KEYS.LOGS, corrupt);
    assert(StorageService.getLogsForDisplay().length === 0, 'Display projection should remain renderable');
    let strictReadRejected = false;
    try { StorageService.getLogs(); } catch { strictReadRejected = true; }
    assert(strictReadRejected, 'Strict read must expose corruption to write/backup flows');
    assert(!StorageService.saveLogs([]), 'A normal save must not overwrite a corrupt archive');
    assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === corrupt, 'Original corrupt bytes must remain intact');
    StorageService.__resetStorageForTests();
  });

  test('Invalid session counters and labels are rejected before any activity write', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:invalid-session-metrics');
    assert(!StorageService.recordSessionCompletion(-1, 0, 5, 'جلسة'), 'Negative memorized ayah counts must be rejected');
    assert(!StorageService.recordSessionCompletion(1.5, 0, 5, 'جلسة'), 'Fractional ayah counts must be rejected');
    assert(!StorageService.recordSessionCompletion(0, 605, 5, 'جلسة'), 'Impossible page counts must be rejected');
    assert(!StorageService.recordSessionCompletion(0, 0, 5, '   '), 'Blank task labels must be rejected');
    assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === null, 'Invalid session metrics must not create an activity archive');
    StorageService.__resetStorageForTests();
  });

  test('Full data reset reports failure when one scoped key cannot be removed', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>([
      [STORAGE_KEYS.PROFILE, JSON.stringify(CLEAN_INITIAL_PROFILE)],
      [STORAGE_KEYS.PLANS, JSON.stringify([{ id: 'keep-me' }])]
    ]);
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => {
          if (key === STORAGE_KEYS.PLANS) throw new Error('simulated remove failure');
          values.delete(key);
        }
      }
    });
    try {
      const reset = StorageService.resetAllData();
      assert(reset === false, 'Reset must return false when any durable key cannot be removed');
      assert(values.has(STORAGE_KEYS.PLANS), 'The failed key should remain visible for recovery');
      assert(!values.has(STORAGE_KEYS.PROFILE), 'Other keys may be removed but reset must not claim full success');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('A failed durable write is not exposed through the in-memory fallback', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const key = 'wird_storage_reliability_failure_probe';
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => { throw new Error('simulated quota failure'); },
        removeItem: () => {}
      }
    });

    try {
      const saved = StorageService.setRawItem(key, 'must-not-appear-saved');
      assert(saved === false, 'The failed durable write must report false');
      assert(StorageService.getRawItem(key) === null, 'The failed value must not leak from memory fallback');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });


  test('Silent or mismatched durable writes are rejected and restore the previous raw value', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let ignoreNextWrite = false;
    let corruptNextWrite = false;
    const key = STORAGE_KEYS.WEAK_VERSES;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (storageKey: string) => values.get(storageKey) ?? null,
        setItem: (storageKey: string, value: string) => {
          if (storageKey.endsWith(key) && ignoreNextWrite) {
            ignoreNextWrite = false;
            return;
          }
          if (storageKey.endsWith(key) && corruptNextWrite) {
            corruptNextWrite = false;
            values.set(storageKey, 'silently-corrupted-value');
            return;
          }
          values.set(storageKey, value);
        },
        removeItem: (storageKey: string) => values.delete(storageKey)
      }
    });
    try {
      StorageService.setStorageScope('user:verified-durable-write');
      assert(StorageService.setRawItem(key, '[]'), 'Initial archive fixture should be saved');
      ignoreNextWrite = true;
      assert(!StorageService.setRawItem(key, '[{"id":"not-persisted"}]'),
        'A setItem call that silently leaves the old value must be rejected');
      assert(StorageService.getRawItem(key) === '[]',
        'A silent no-op write must preserve the previous archive bytes');

      corruptNextWrite = true;
      assert(!StorageService.setRawItem(key, '[{"id":"new-value"}]'),
        'A setItem call that stores mismatched bytes must be rejected');
      assert(StorageService.getRawItem(key) === '[]',
        'A mismatched write must attempt and verify restoration of the previous archive bytes');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  return { passed, failed };
}
