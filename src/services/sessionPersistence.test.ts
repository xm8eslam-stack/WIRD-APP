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

  test('Partially applied profile write that cannot be restored surfaces recovery-required state', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let blockProfileRollback = false;
    let originalProfileRaw: string | null = null;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (blockProfileRollback && key.endsWith(STORAGE_KEYS.PROFILE)) {
          if (value !== originalProfileRaw) {
            values.set(key, value);
            throw new Error('simulated write applied before quota error');
          }
          return; // Simulate a storage adapter that refuses the restoration write.
        }
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:session-rollback-unverified');
      const today = getLocalDateString();
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, lastActiveDate: today, streakDays: 0 });
      originalProfileRaw = StorageService.getRawItem(STORAGE_KEYS.PROFILE);
      const original = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'currently_memorizing', nextDueDate: today, intervalDays: 1, easeFactor: 2.5,
        repetitionCount: 0, mistakesCount: 0
      });
      const beforePortions = JSON.stringify(RetentionService.getPortions());
      blockProfileRollback = true;
      const result = persistSessionCompletion({
        mode: 'memorize', memorizedAyahs: 5, reviewedPages: 0, minutes: 6,
        taskName: 'جلسة فشل استعادة', surahNumber: 67, startAyah: 1, endAyah: 5
      });
      if (!('messageAr' in result)) throw new Error('Session must fail when the profile write cannot be restored');
      assert(result.messageAr.includes('لم ينجح التحقق'), 'The user must receive an explicit recovery-required warning');
      assert(JSON.stringify(RetentionService.getPortions()) === beforePortions,
        'The memorization portion must still be restored even when profile rollback fails');
      assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === null, 'The activity log must be restored to its original absence');
      assert(StorageService.getRawItem(STORAGE_KEYS.PROFILE) !== originalProfileRaw,
        'The injected durable mismatch must remain observable so rollback failure cannot be reported as success');
      assert(RetentionService.getPortions().some(item => item.id === original.id && item.status === 'currently_memorizing'),
        'The original portion state must be retained');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Repeated memorization completion preserves review history and does not upgrade weak status', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:repeat-memorization-history');
    try {
      const today = getLocalDateString();
      const existing = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'weak', strength: 'weak', nextDueDate: today, intervalDays: 1, easeFactor: 1.8,
        repetitionCount: 3, mistakesCount: 2
      });
      const firstLog = {
        id: 'existing-memorization-event', date: today, rating: 'successful' as const,
        intervalDaysBefore: 0, intervalDaysAfter: 1
      };
      RetentionService.savePortions([{ ...existing, history: [firstLog] }]);
      const result = persistSessionCompletion({
        mode: 'memorize', memorizedAyahs: 5, reviewedPages: 0, minutes: 5,
        taskName: 'إعادة حفظ', surahNumber: 67, startAyah: 1, endAyah: 5
      });
      assert(result.success, 'Repeat memorization should save');
      const updated = RetentionService.getPortions().find(item => item.id === existing.id)!;
      assert(updated.status === 'weak' && updated.strength === 'weak',
        'A memorization session must not silently upgrade an unresolved weak portion');
      assert(updated.history?.length === 1 && updated.history[0].id === firstLog.id,
        'Memorization sessions must not be misclassified as review-history events');
      assert(RetentionService.getRetentionDashboardMetrics().totalReviewsCompleted === 1,
        'Memorization sessions must not inflate completed-review statistics');
      assert(updated.repetitionCount === 4, 'Repeat memorization count must increment exactly once');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('First memorization completion does not create a review-history event', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:first-memorization-not-review');
    try {
      const result = persistSessionCompletion({
        mode: 'memorize', memorizedAyahs: 5, reviewedPages: 0, minutes: 4,
        taskName: 'حفظ أول مرة', surahNumber: 67, startAyah: 6, endAyah: 10
      });
      assert(result.success, 'First memorization session should save');
      const created = RetentionService.getPortions().find(item =>
        item.surahNumber === 67 && item.startAyah === 6 && item.endAyah === 10
      );
      assert(Boolean(created), 'The memorized portion should be created');
      assert(created?.history?.length === 0, 'Initial memorization must not be recorded as a review event');
      assert(RetentionService.getRetentionDashboardMetrics().totalReviewsCompleted === 0,
        'A first memorization session must not increase completed-review statistics');
    } finally {
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
  test('Invalid session counters, durations, task names, and Quran ranges are rejected before writes', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:invalid-session-inputs');
    try {
      const invalidInputs: any[] = [
        { mode: 'memorize', memorizedAyahs: -1, reviewedPages: 0, minutes: 5, taskName: 'حفظ', surahNumber: 67, startAyah: 1, endAyah: 3 },
        { mode: 'memorize', memorizedAyahs: 1.5, reviewedPages: 0, minutes: 5, taskName: 'حفظ', surahNumber: 67, startAyah: 1, endAyah: 3 },
        { mode: 'review', memorizedAyahs: 0, reviewedPages: -1, minutes: 5, taskName: 'مراجعة' },
        { mode: 'review', memorizedAyahs: 0, reviewedPages: 1.5, minutes: 5, taskName: 'مراجعة' },
        { mode: 'review', memorizedAyahs: 0, reviewedPages: 1, minutes: -1, taskName: 'مراجعة' },
        { mode: 'review', memorizedAyahs: 0, reviewedPages: 1, minutes: 1441, taskName: 'مراجعة' },
        { mode: 'review', memorizedAyahs: 0, reviewedPages: 1, minutes: 5, taskName: '   ' },
        { mode: 'memorize', memorizedAyahs: 3, reviewedPages: 0, minutes: 5, taskName: 'حفظ', surahNumber: 1, startAyah: 1, endAyah: 8 },
        { mode: 'unknown', memorizedAyahs: 0, reviewedPages: 0, minutes: 5, taskName: 'مهمة' }
      ];
      for (const input of invalidInputs) {
        const result = persistSessionCompletion(input);
        assert(!result.success, 'Invalid session input must be rejected');
        assert(RetentionService.getPortions().length === 0, 'Rejected input must not create or alter memorization portions');
        assert(StorageService.getLogs().length === 0, 'Rejected input must not create an activity log');
      }
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('Retention service rejects invalid Quran ranges before creating portions', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:invalid-quran-range');
    try {
      let rejected = false;
      try { RetentionService.recordMemorizationCompletion(1, 1, 8); } catch { rejected = true; }
      assert(rejected, 'An ayah beyond Al-Fatiha must be rejected');
      assert(RetentionService.getPortions().length === 0, 'Invalid Quran coordinates must not create a portion');

      let addRejected = false;
      try {
        RetentionService.addPortion({
          type: 'passage', surahNumber: 1, surahName: 'الفاتحة', startAyah: 1, endAyah: 8,
          status: 'stable', nextDueDate: getLocalDateString(), intervalDays: 7,
          easeFactor: 2.5, repetitionCount: 1, mistakesCount: 0
        });
      } catch { addRejected = true; }
      assert(addRejected, 'addPortion must enforce Quran verse bounds at the service boundary');
      assert(RetentionService.getPortions().length === 0, 'Invalid addPortion input must not change stored portions');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('Failed weak-verse write restores the revision portion before activity is recorded', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failWeakVerseWrites = false;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWeakVerseWrites && key.endsWith(STORAGE_KEYS.WEAK_VERSES)) {
          const quotaError = new Error('simulated weak-verse quota failure');
          quotaError.name = 'QuotaExceededError';
          throw quotaError;
        }
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:weak-verse-write-failure');
      const today = getLocalDateString();
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'stable', nextDueDate: today, intervalDays: 7, easeFactor: 2.5,
        repetitionCount: 4, mistakesCount: 0
      });
      assert(StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, '[]'), 'Initial weak-verse archive should be writable');
      const beforePortions = StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      const beforeWeak = StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES);
      const beforeLogs = StorageService.getRawItem(STORAGE_KEYS.LOGS);
      failWeakVerseWrites = true;
      let rejected = false;
      try {
        RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, {
          ayahNumber: 2, text: 'نص آية موثوق للاختبار'
        }, 3);
      } catch { rejected = true; }
      assert(rejected, 'Revision must fail when the weak-verse archive cannot be written');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === beforePortions,
        'The revision portion archive must be restored byte-for-byte');
      assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === beforeWeak,
        'The weak-verse archive must retain its original bytes');
      assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === beforeLogs,
        'Activity must not be written before the weak-verse write succeeds');
      assert(RetentionService.getPortions().find(item => item.id === portion.id)?.repetitionCount === 4,
        'The failed review must not advance the repetition count');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Failed rollback after weak-verse quota error surfaces recovery-required state', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failWeakVerseWrites = false;
    let portionWrites = 0;
    let failPortionRollback = false;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWeakVerseWrites && key.endsWith(STORAGE_KEYS.WEAK_VERSES)) {
          const quotaError = new Error('simulated weak-verse quota failure');
          quotaError.name = 'QuotaExceededError';
          throw quotaError;
        }
        if (key.endsWith(STORAGE_KEYS.UNIFIED_PORTIONS)) {
          portionWrites++;
          if (failPortionRollback && portionWrites >= 2) {
            const quotaError = new Error('simulated rollback quota failure');
            quotaError.name = 'QuotaExceededError';
            throw quotaError;
          }
        }
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:weak-verse-rollback-failure');
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'stable', nextDueDate: getLocalDateString(), intervalDays: 7, easeFactor: 2.5,
        repetitionCount: 4, mistakesCount: 0
      });
      assert(StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, '[]'), 'Initial weak-verse archive should be writable');
      portionWrites = 0;
      failWeakVerseWrites = true;
      failPortionRollback = true;
      let message = '';
      try {
        RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, {
          ayahNumber: 2, text: 'نص آية موثوق للاختبار'
        }, 3);
      } catch (error: any) { message = error?.message || String(error); }
      assert(message.includes('لا تغلق الصفحة') && message.includes('نسخة احتياطية'),
        'An unverified rollback must surface a recovery-required warning');
      assert(portionWrites >= 2, 'The test must exercise both the original portion write and failed rollback write');
      assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === null,
        'Activity must not be recorded after an earlier write and rollback both fail');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Profile quota failure after a weak-verse write rolls back portions, weak verses, and activity', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failProfileWrites = false;
    let successfulWeakVerseWrites = 0;
    let successfulActivityWrites = 0;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failProfileWrites && key.endsWith(STORAGE_KEYS.PROFILE)) {
          const quotaError = new Error('simulated profile quota failure after weak-verse write');
          quotaError.name = 'QuotaExceededError';
          throw quotaError;
        }
        if (key.endsWith(STORAGE_KEYS.WEAK_VERSES)) successfulWeakVerseWrites++;
        if (key.endsWith(STORAGE_KEYS.LOGS)) successfulActivityWrites++;
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:review-profile-quota-failure');
      const today = getLocalDateString();
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, lastActiveDate: today, streakDays: 0 });
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'stable', nextDueDate: today, intervalDays: 7, easeFactor: 2.5,
        repetitionCount: 4, mistakesCount: 0
      });
      assert(StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, '[]'), 'Initial weak-verse archive should be writable');
      const beforePortions = StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      const beforeWeak = StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES);
      const beforeProfile = StorageService.getRawItem(STORAGE_KEYS.PROFILE);
      const beforeLogs = StorageService.getRawItem(STORAGE_KEYS.LOGS);
      failProfileWrites = true;
      let rejected = false;
      try {
        RetentionService.recordRevisionPerformance(portion.id, 'failed', undefined, {
          ayahNumber: 2, text: 'نص آية موثوق للاختبار'
        }, 3);
      } catch { rejected = true; }
      assert(rejected, 'Review must fail when profile persistence fails after earlier writes');
      assert(successfulWeakVerseWrites > 0, 'The weak-verse write must succeed before the later profile failure is injected');
      assert(successfulActivityWrites > 0, 'The activity write must succeed before the later profile failure is injected');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === beforePortions,
        'Portion archive must be restored after profile failure');
      assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === beforeWeak,
        'Weak-verse archive must be restored after profile failure');
      assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === beforeLogs,
        'Activity archive must be restored after profile failure');
      assert(StorageService.getRawItem(STORAGE_KEYS.PROFILE) === beforeProfile,
        'Profile archive must retain its original bytes');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });


  test('Memorization completion surfaces an unverified canonical-portion rollback', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failPortionWrites = false;
    let previousRaw: string | null = null;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failPortionWrites && key.endsWith(STORAGE_KEYS.UNIFIED_PORTIONS)) {
          if (value !== previousRaw) {
            values.set(key, value);
            throw new Error('simulated portion write applied before failure');
          }
          return; // Refuse to restore the original portion archive.
        }
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:portion-memorization-rollback');
      const today = getLocalDateString();
      RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'currently_memorizing', nextDueDate: today, intervalDays: 1, easeFactor: 2.5,
        repetitionCount: 0, mistakesCount: 0
      });
      previousRaw = StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      failPortionWrites = true;
      let message = '';
      try { RetentionService.recordMemorizationCompletion(67, 6, 10); }
      catch (error: any) { message = error?.message || String(error); }
      assert(message.includes('لم ينجح التحقق'), 'An unverified portion rollback must surface a recovery-required warning');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) !== previousRaw,
        'The injected durable mismatch must remain observable instead of being hidden by memory fallback');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Revision rating surfaces an unverified canonical-portion rollback', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failPortionWrites = false;
    let previousRaw: string | null = null;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failPortionWrites && key.endsWith(STORAGE_KEYS.UNIFIED_PORTIONS)) {
          if (value !== previousRaw) {
            values.set(key, value);
            throw new Error('simulated revision write applied before failure');
          }
          return;
        }
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key)
    }});
    try {
      StorageService.setStorageScope('user:portion-revision-rollback');
      const today = getLocalDateString();
      const portion = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'recently_memorized', nextDueDate: today, intervalDays: 2, easeFactor: 2.5,
        repetitionCount: 2, mistakesCount: 0
      });
      previousRaw = StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      failPortionWrites = true;
      let message = '';
      try { RetentionService.recordRevisionPerformance(portion.id, 'successful'); }
      catch (error: any) { message = error?.message || String(error); }
      assert(message.includes('لم ينجح التحقق'), 'An unverified revision write rollback must surface a recovery-required warning');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) !== previousRaw,
        'The injected durable mismatch must remain observable instead of being hidden by memory fallback');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Daily activity snapshots carry a base identity and reject concurrent device changes', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:activity-snapshot-cas');
    const prepared = StorageService.buildSessionCompletionSnapshot(3, 0, 8, 'جلسة أساس');
    assert(prepared.success, 'A valid activity snapshot should be prepared');
    if (!prepared.success) return;
    assert(typeof prepared.baseLogsFingerprint === 'string', 'Activity snapshot must include its base identity');
    const today = getLocalDateString();
    const concurrent = [{
      date: today, memorizedAyahsCount: 7, reviewedPagesCount: 0,
      minutesSpent: 18, completedTasks: ['جلسة من جهاز آخر']
    }];
    assert(StorageService.saveLogs(concurrent), 'Concurrent activity from another device should save');
    const before = JSON.stringify(StorageService.getLogs());
    assert(!StorageService.applyJournalProjection('activityEvents', {
      records: prepared.logs,
      baseSnapshotFingerprint: prepared.baseLogsFingerprint
    }, 'snapshot'), 'A stale daily aggregate must not replace a divergent device snapshot');
    assert(JSON.stringify(StorageService.getLogs()) === before,
      'The concurrent daily activity aggregate must be preserved');
    assert(StorageService.applyJournalProjection('activityEvents', {
      records: prepared.logs,
      baseSnapshotFingerprint: prepared.baseLogsFingerprint
    }, 'snapshot', true), 'An explicit, user-confirmed use-remote decision may replace the local activity snapshot');
    assert(JSON.stringify(StorageService.getLogs()) === JSON.stringify(prepared.logs),
      'Explicit remote resolution must apply the selected activity snapshot');
    StorageService.__resetStorageForTests();
  });

  test('Legacy activity snapshots cannot replace non-empty divergent data but can bootstrap an empty device', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:activity-legacy-cas');
    const today = getLocalDateString();
    const local = [{
      date: today, memorizedAyahsCount: 4, reviewedPagesCount: 0,
      minutesSpent: 12, completedTasks: ['نشاط محلي']
    }];
    const remote = [{
      date: today, memorizedAyahsCount: 9, reviewedPagesCount: 0,
      minutesSpent: 25, completedTasks: ['نشاط بعيد']
    }];
    assert(StorageService.saveLogs(local), 'Local activity should save');
    assert(!StorageService.applyJournalProjection('activityEvents', { records: remote }, 'snapshot'),
      'A legacy event without a base identity must not overwrite non-empty divergent activity');
    assert(JSON.stringify(StorageService.getLogs()) === JSON.stringify(local),
      'The original daily aggregate must remain intact');
    assert(StorageService.saveLogs([]), 'Activity archive should be clearable for bootstrap test');
    assert(StorageService.applyJournalProjection('activityEvents', { records: remote }, 'snapshot'),
      'A legacy snapshot may bootstrap an empty device');
    assert(JSON.stringify(StorageService.getLogs()) === JSON.stringify(remote),
      'Bootstrap should project the remote activity');
    StorageService.__resetStorageForTests();
  });

  return { passed, failed };
}
