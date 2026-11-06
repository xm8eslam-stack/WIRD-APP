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

  test('Successful weak-verse recording saves both the weak portion and counter', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:weak-verse-success');
    const result = recordWeakVerseFailure({
      surahNumber: 67, surahName: 'الملك', ayahNumber: 8,
      text: 'آية اختبار', notes: 'اختبار نجاح'
    });
    assert(result.success, 'Both records should save');
    assert(RetentionService.getPortions().some(portion => portion.surahNumber === 67 && portion.startAyah === 8 && portion.status === 'weak'),
      'The canonical weak portion should exist');
    assert(RetentionService.getWeakVerses().some(verse => verse.surahNumber === 67 && verse.ayahNumber === 8),
      'The weak-verse counter should exist');
    StorageService.__resetStorageForTests();
  });

  return { passed, failed };
}
