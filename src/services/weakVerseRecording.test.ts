import { RetentionService } from './retentionService';
import { StorageService, STORAGE_KEYS } from './storageService';
import { recordWeakVerseFailure } from './weakVerseRecording';
import { getLocalDateString } from './unifiedPortionService';

export function runWeakVerseRecordingTests(): { passed: number; failed: number } {
  let passed = 0, failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Failed weak-verse counter write rolls back the canonical weak portion', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    let failWeakVerseWrites = false;
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (failWeakVerseWrites && key.endsWith(STORAGE_KEYS.WEAK_VERSES)) throw new Error('simulated weak verse quota failure');
          values.set(key, value);
        },
        removeItem: (key: string) => values.delete(key)
      }
    });
    try {
      StorageService.setStorageScope('user:weak-verse-rollback');
      const before = JSON.stringify(RetentionService.getPortions());
      failWeakVerseWrites = true;
      const result = recordWeakVerseFailure({
        surahNumber: 67, surahName: 'الملك', ayahNumber: 8,
        text: 'آية اختبار', notes: 'اختبار فشل الحفظ'
      });
      assert(!result.success, 'A failed mistake-counter write must not report success');
      assert(JSON.stringify(RetentionService.getPortions()) === before, 'The newly added weak portion must be rolled back');
      assert(RetentionService.getWeakVerses().length === 0, 'No weak-verse counter should be claimed as saved');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Weak-verse recording warns when a partially written counter cannot be removed during rollback', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    StorageService.__resetStorageForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (key.endsWith(STORAGE_KEYS.WEAK_VERSES)) {
            values.set(key, value);
            throw new Error('simulated post-write weak archive failure');
          }
          values.set(key, value);
        },
        removeItem: (key: string) => {
          if (key.endsWith(STORAGE_KEYS.WEAK_VERSES)) throw new Error('simulated weak archive rollback failure');
          values.delete(key);
        }
      }
    });
    try {
      StorageService.setStorageScope('user:weak-verse-rollback-unverified');
      const result = recordWeakVerseFailure({
        surahNumber: 67, surahName: 'الملك', ayahNumber: 8,
        text: 'نص آية اختبار', notes: 'فشل بعد الكتابة'
      });
      assert(!result.success, 'A weak-verse write with an unverified rollback must not report success');
      assert(result.messageAr.includes('لا تغلق الصفحة') && result.messageAr.includes('نسخة احتياطية'),
        'The user must receive an explicit recovery-required warning');
      assert(RetentionService.getPortions().length === 0,
        'The canonical portion archive should still be restored');
      assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) !== null,
        'The injected failed rollback should leave the weak archive visibly pending recovery');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
      StorageService.__resetStorageForTests();
    }
  });

  test('Corrupt weak-verse JSON is preserved and blocks a new mistake write', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-corrupt');
    const corrupt = '{broken weak verse data';
    StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, corrupt);
    const beforePortions = JSON.stringify(RetentionService.getPortions());
    const result = recordWeakVerseFailure({
      surahNumber: 67, surahName: 'الملك', ayahNumber: 8, text: 'نص اختبار'
    });
    assert(!result.success, 'A corrupt weak-verse archive must not report a successful write');
    assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === corrupt, 'Original corrupt bytes must remain unchanged');
    assert(JSON.stringify(RetentionService.getPortions()) === beforePortions, 'The portion mutation must roll back when weak-verse data is corrupt');
    StorageService.__resetStorageForTests();
  });

  test('Retention metrics remain available while a corrupt weak-verse archive is preserved', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-metrics-corrupt');
    const corrupt = '{damaged}';
    StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, corrupt);
    const metrics = RetentionService.getRetentionDashboardMetrics();
    assert(metrics.weakVersesCount === 0, 'Unavailable weak-verse count should not block unrelated metrics');
    assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === corrupt, 'Metrics must not normalize or overwrite the damaged archive');
    StorageService.__resetStorageForTests();
  });

  test('Malformed weak-verse records are rejected without being normalized to an empty list', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-malformed');
    const malformed = JSON.stringify([{ id: 'bad', surahNumber: 0, ayahNumber: 999, mistakeCount: -1 }]);
    StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, malformed);
    let rejected = false;
    try { RetentionService.getWeakVerses(); } catch { rejected = true; }
    assert(rejected, 'Invalid weak-verse records must raise a recoverable validation error');
    assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === malformed, 'Invalid source data must remain intact');
    StorageService.__resetStorageForTests();
  });

  test('Weak-verse archives reject duplicate IDs and duplicate Surah/Ayah coordinates', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-duplicates');
    const today = getLocalDateString();
    const duplicateCoordinates = [
      { id: 'weak-a', surahNumber: 67, surahName: 'الملك', ayahNumber: 8, text: 'نص', mistakeCount: 1, lastFailedDate: today },
      { id: 'weak-b', surahNumber: 67, surahName: 'الملك', ayahNumber: 8, text: 'نص آخر', mistakeCount: 2, lastFailedDate: today }
    ];
    const raw = JSON.stringify(duplicateCoordinates);
    StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, raw);
    let rejected = false;
    try { RetentionService.getWeakVerses(); } catch { rejected = true; }
    assert(rejected, 'Two records for the same Quran coordinate must be rejected');
    assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === raw,
      'Duplicate-coordinate source bytes must remain unchanged');
    assert(!RetentionService.saveWeakVerses(duplicateCoordinates as any),
      'saveWeakVerses must refuse duplicate coordinates');
    StorageService.__resetStorageForTests();
  });

  test('Direct weak-verse mutation validates coordinates and is idempotent when resolving twice', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-direct-boundary');
    let rejected = false;
    try {
      RetentionService.addOrIncrementWeakVerse(114, 7, 'الناس', 'نص غير صالح');
    } catch { rejected = true; }
    assert(rejected, 'The service boundary must reject invalid Quran coordinates even when bypassing the UI wrapper');
    const added = RetentionService.addOrIncrementWeakVerse(114, 6, 'wrong label', 'نص اختبار');
    assert(added[0].surahName === 'الناس', 'Stored Surah name must be canonical');
    const resolved = RetentionService.resolveWeakVerse(added[0].id);
    const repeatedResolve = RetentionService.resolveWeakVerse(added[0].id);
    assert(resolved.length === 0 && repeatedResolve.length === 0,
      'Repeated resolution must remain idempotent');
    StorageService.__resetStorageForTests();
  });

  test('Weak-verse recording rejects out-of-range Quran coordinates before changing data', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-coordinate');
    const before = JSON.stringify(RetentionService.getPortions());
    const result = recordWeakVerseFailure({
      surahNumber: 114, surahName: 'الناس', ayahNumber: 7, text: 'نص اختبار'
    });
    assert(!result.success, 'An ayah beyond the Surah verse count must be rejected');
    assert(JSON.stringify(RetentionService.getPortions()) === before, 'Invalid coordinates must not mutate memorization portions');
    assert(RetentionService.getWeakVerses().length === 0, 'Invalid coordinates must not create weak-verse records');
    StorageService.__resetStorageForTests();
  });

  test('Weak-verse recording uses canonical Surah metadata instead of caller-supplied labels', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-canonical-name');
    const result = recordWeakVerseFailure({
      surahNumber: 114, surahName: 'اسم غير صحيح', ayahNumber: 6, text: 'نص اختبار'
    });
    assert(result.success, 'A valid Quran coordinate should be accepted');
    assert(RetentionService.getWeakVerses()[0]?.surahName === 'الناس', 'Stored Surah name must come from canonical metadata');
    StorageService.__resetStorageForTests();
  });

  test('Successful weak-verse recording saves both the weak portion and counter', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-success');
    const today = getLocalDateString();
    RetentionService.addPortion({
      type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 8, endAyah: 8,
      status: 'stable', nextDueDate: today, intervalDays: 7, easeFactor: 2.6,
      repetitionCount: 3, mistakesCount: 2
    });
    const result = recordWeakVerseFailure({
      surahNumber: 67, surahName: 'الملك', ayahNumber: 8,
      text: 'آية اختبار', notes: 'اختبار نجاح'
    });
    assert(result.success, 'Both records should save');
    const updated = RetentionService.getPortions().find(portion => portion.surahNumber === 67 && portion.startAyah === 8 && portion.endAyah === 8);
    assert(updated?.status === 'weak', 'The canonical portion should be marked weak');
    assert(updated?.mistakesCount === 3 && updated?.repetitionCount === 4,
      'Recording a new mistake must increment existing portion counters instead of resetting them');
    assert(RetentionService.getWeakVerses().some(verse => verse.surahNumber === 67 && verse.ayahNumber === 8),
      'The weak-verse counter should exist');
    StorageService.__resetStorageForTests();
  });

  return { passed, failed };
}
