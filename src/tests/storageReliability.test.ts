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

  return { passed, failed };
}
