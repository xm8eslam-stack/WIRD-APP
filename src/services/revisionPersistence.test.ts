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

  test('Re-adding an existing canonical portion never resets its history or weaker progress', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:portion-duplicate-add');
    try {
      const today = getLocalDateString();
      const original = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 21, endAyah: 25,
        status: 'weak', strength: 'weak', nextDueDate: today, intervalDays: 1, easeFactor: 1.8,
        repetitionCount: 8, mistakesCount: 4
      });
      const historyEntry = {
        id: 'existing-review-event', date: today, rating: 'failed' as const,
        intervalDaysBefore: 3, intervalDaysAfter: 1, notes: 'existing failure'
      };
      RetentionService.savePortions([{
        ...original,
        history: [historyEntry],
        repetitionCount: 8,
        mistakesCount: 4,
        status: 'weak',
        strength: 'weak'
      }]);
      const readded = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'اسم غير صحيح', startAyah: 31, endAyah: 35,
        status: 'stable', strength: 'strong', nextDueDate: today, intervalDays: 7, easeFactor: 2.8,
        repetitionCount: 1, mistakesCount: 0
      });
      assert(readded.status === 'weak' && readded.strength === 'weak',
        'A duplicate stable add must not upgrade an existing weak portion');
      assert(readded.repetitionCount === 8 && readded.mistakesCount === 4,
        'Existing repetition and mistake counters must not be reset');
      assert(readded.history?.length === 1 && readded.history[0].id === 'existing-review-event',
        'Existing review history must survive duplicate add');
      assert(readded.surahName === 'الملك', 'Surah metadata must come from canonical Quran metadata');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('Manual status updates keep strength labels consistent', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:manual-status-strength');
    try {
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 26, endAyah: 28,
        status: 'weak', strength: 'weak', nextDueDate: getLocalDateString(), intervalDays: 1,
        easeFactor: 1.8, repetitionCount: 1, mistakesCount: 2
      });
      const updated = RetentionService.updatePortionStatus(portion.id, 'stable');
      assert(updated[0].status === 'stable' && updated[0].strength === 'strong',
        'Explicitly setting a portion to stable must also set its strength label to strong');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('Updating a missing portion ID is rejected without writing a no-op success', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:portion-missing-update');
    try {
      const before = JSON.stringify(RetentionService.getPortions());
      let rejected = false;
      try { RetentionService.updatePortionStatus('missing-canonical-id', 'stable'); } catch { rejected = true; }
      assert(rejected, 'Unknown portion IDs must be rejected');
      assert(JSON.stringify(RetentionService.getPortions()) === before, 'Unknown ID updates must not write or change progress');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

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

  test('Revision history IDs remain unique even when wall-clock timestamps collide', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:revision-unique-history');
    const today = getLocalDateString();
    const portion = RetentionService.addPortion({
      type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 26, endAyah: 30,
      status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
      repetitionCount: 1, mistakesCount: 0
    });
    const originalNow = Date.now;
    try {
      Date.now = () => 123456789;
      RetentionService.recordRevisionPerformance(portion.id, 'successful');
      RetentionService.recordRevisionPerformance(portion.id, 'difficult');
      const history = RetentionService.getPortions().find(item => item.id === portion.id)?.history || [];
      assert(history.length === 2, 'Both review attempts must be retained');
      assert(history[0].id !== history[1].id, 'Review event IDs must not collide when Date.now is identical');
    } finally {
      Date.now = originalNow;
      StorageService.__resetStorageForTests();
    }
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
  test('Invalid revision ratings and weak-ayah coordinates are rejected before mutation', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:revision-invalid-inputs');
    try {
      const today = getLocalDateString();
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 10,
        status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
        repetitionCount: 1, mistakesCount: 0
      });
      const before = JSON.stringify(RetentionService.getPortions());

      let invalidRatingRejected = false;
      try { RetentionService.recordRevisionPerformance(portion.id, 'excellent' as any); }
      catch { invalidRatingRejected = true; }
      assert(invalidRatingRejected, 'Unsupported revision rating must be rejected');

      let outsideRangeRejected = false;
      try {
        RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, {
          ayahNumber: 11, text: 'آية خارج المقطع'
        });
      } catch { outsideRangeRejected = true; }
      assert(outsideRangeRejected, 'Weak ayah outside the reviewed portion must be rejected');

      let notesRejected = false;
      try { RetentionService.recordRevisionPerformance(portion.id, 'successful', 'x'.repeat(2001)); }
      catch { notesRejected = true; }
      assert(notesRejected, 'Oversized revision notes must be rejected');

      assert(JSON.stringify(RetentionService.getPortions()) === before,
        'All invalid revision inputs must leave portion status, counters, and history unchanged');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('Fractional and overlong revision durations are rejected before mutation', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:revision-duration-bounds');
    try {
      const today = getLocalDateString();
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 1, surahName: 'الفاتحة', startAyah: 1, endAyah: 7,
        status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
        repetitionCount: 1, mistakesCount: 0
      });
      const before = JSON.stringify(RetentionService.getPortions());
      for (const invalidMinutes of [1.5, 1441, Number.MAX_SAFE_INTEGER + 1]) {
        let rejected = false;
        try { RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, undefined, invalidMinutes); }
        catch { rejected = true; }
        assert(rejected, 'Invalid revision duration must be rejected: ' + invalidMinutes);
        assert(JSON.stringify(RetentionService.getPortions()) === before,
          'Rejected duration must not alter revision history or scheduling');
      }
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  return { passed, failed };
}
