import { RetentionService } from './retentionService';
import { StorageService } from './storageService';
import { getLocalDateString } from './unifiedPortionService';

export function runRevisionPersistenceTests(): { passed: number; failed: number } {
  let passed = 0, failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Revision rating does not invent 15 minutes when duration was not measured', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:revision-duration');
    const today = getLocalDateString();
    const portion = RetentionService.addPortion({
      type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 10,
      status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
      repetitionCount: 1, mistakesCount: 0
    });
    const before = StorageService.getLogs().find(log => log.date === today)?.minutesSpent || 0;
    RetentionService.recordRevisionPerformance(portion.id, 'successful');
    const after = StorageService.getLogs().find(log => log.date === today)?.minutesSpent || 0;
    assert(after === before, 'An unmeasured review rating must add zero minutes, not a fabricated duration');
    StorageService.__resetStorageForTests();
  });

  test('Revision rating records an explicitly measured duration exactly once', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:revision-measured');
    const today = getLocalDateString();
    const portion = RetentionService.addPortion({
      type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 11, endAyah: 20,
      status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
      repetitionCount: 1, mistakesCount: 0
    });
    RetentionService.recordRevisionPerformance(portion.id, 'difficult', undefined, undefined, 7);
    const log = StorageService.getLogs().find(item => item.date === today);
    assert(log?.minutesSpent === 7, 'The measured 7-minute duration must be stored exactly');
    StorageService.__resetStorageForTests();
  });

  test('Failed activity persistence rolls back the revision rating and activity projection', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failProfileWrites = false;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failProfileWrites && key.endsWith('wird_profile')) throw new Error('simulated profile quota failure');
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:revision-atomicity');
      const today = getLocalDateString();
      StorageService.saveProfile({ ...StorageService.getProfile(), lastActiveDate: today, streakDays: 0 });
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 21, endAyah: 25,
        status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
        repetitionCount: 1, mistakesCount: 0
      });
      const before = JSON.stringify(RetentionService.getPortions());
      failProfileWrites = true;
      let rejected = false;
      try { RetentionService.recordRevisionPerformance(portion.id, 'successful', undefined, undefined, 5); }
      catch { rejected = true; }
      assert(rejected, 'A failed activity/streak write must reject the rating');
      assert(JSON.stringify(RetentionService.getPortions()) === before, 'The revision rating must be rolled back');
      assert(StorageService.getLogs().length === 0, 'The failed activity projection must not remain');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Corrupt weak-verse archive blocks a failed rating and restores the prior portion', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:revision-corrupt-weak');
    const today = getLocalDateString();
    const portion = RetentionService.addPortion({
      type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 10,
      status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
      repetitionCount: 1, mistakesCount: 0
    });
    const before = JSON.stringify(RetentionService.getPortions());
    const corrupt = '{broken archive';
    StorageService.setRawItem('wird_weak_verses', corrupt);
    let rejected = false;
    try {
      RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, {
        ayahNumber: 3, text: 'نص اختبار'
      });
    } catch { rejected = true; }
    assert(rejected, 'A corrupt weak-verse archive must prevent a false successful rating');
    assert(JSON.stringify(RetentionService.getPortions()) === before, 'The portion rating must be restored');
    assert(StorageService.getRawItem('wird_weak_verses') === corrupt, 'The corrupt archive must remain byte-for-byte unchanged');
    StorageService.__resetStorageForTests();
  });

  test('Invalid measured duration is rejected before revision state changes', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:revision-invalid-duration');
    const today = getLocalDateString();
    const portion = RetentionService.addPortion({
      type: 'passage', surahNumber: 1, surahName: 'الفاتحة', startAyah: 1, endAyah: 7,
      status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
      repetitionCount: 1, mistakesCount: 0
    });
    const before = JSON.stringify(RetentionService.getPortions());
    let rejected = false;
    try { RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, undefined, -1); }
    catch { rejected = true; }
    assert(rejected, 'Negative duration must be rejected');
    assert(JSON.stringify(RetentionService.getPortions()) === before, 'Rejected duration must not alter the portion or history');
    StorageService.__resetStorageForTests();
  });
  return { passed, failed };
}
