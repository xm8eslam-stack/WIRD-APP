import { CLEAN_INITIAL_PROFILE, StorageService, STORAGE_KEYS } from './storageService';
import { RetentionService } from './retentionService';
import { persistSessionCompletion } from './sessionPersistence';
import { getLocalDateString } from './unifiedPortionService';

export function runSessionPersistenceTests(): { passed: number; failed: number } {
  let passed = 0, failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Failed activity write rolls back the newly saved memorization portion', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failProfileWrites = false;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failProfileWrites && key.endsWith(STORAGE_KEYS.PROFILE)) throw new Error('simulated profile quota failure');
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:session-rollback');
      const today = getLocalDateString();
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, lastActiveDate: today, streakDays: 0 });
      const original = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'currently_memorizing', nextDueDate: today, intervalDays: 1, easeFactor: 2.5,
        repetitionCount: 0, mistakesCount: 0
      });
      const before = JSON.stringify(RetentionService.getPortions());
      failProfileWrites = true;
      const result = persistSessionCompletion({
        mode: 'memorize', memorizedAyahs: 5, reviewedPages: 0, minutes: 6,
        taskName: 'جلسة اختبار', surahNumber: 67, startAyah: 1, endAyah: 5
      });
      assert(!result.success, 'Session must fail when activity persistence fails');
      assert(JSON.stringify(RetentionService.getPortions()) === before, 'Previous portion state must be restored');
      assert(RetentionService.getPortions().some(item => item.id === original.id && item.status === 'currently_memorizing'),
        'Portion must not remain marked as memorized');
      assert(StorageService.getLogs().length === 0, 'Failed activity log must not remain');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Successful review session never mutates memorization portions', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:review-only');
    const today = getLocalDateString();
    RetentionService.addPortion({
      type: 'passage', surahNumber: 1, surahName: 'الفاتحة', startAyah: 1, endAyah: 7,
      status: 'stable', nextDueDate: today, intervalDays: 7, easeFactor: 2.5, repetitionCount: 4, mistakesCount: 0
    });
    const before = JSON.stringify(RetentionService.getPortions());
    const result = persistSessionCompletion({ mode: 'review', memorizedAyahs: 0, reviewedPages: 1, minutes: 4, taskName: 'مراجعة اختبار' });
    assert(result.success, 'Review activity should be saved');
    assert(JSON.stringify(RetentionService.getPortions()) === before, 'Review must not change memorization portions');
    assert(StorageService.getLogs()[0]?.reviewedPagesCount === 1, 'Review page activity should be recorded');
    StorageService.__resetStorageForTests();
  });
  return { passed, failed };
}
