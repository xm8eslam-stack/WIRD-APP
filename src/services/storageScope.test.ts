import { CLEAN_INITIAL_PROFILE, StorageService } from './storageService';
import { RetentionService } from './retentionService';
import type { WeakVerseItem } from '../types/quran';

export function runStorageScopeTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  StorageService.__resetStorageForTests();
  try {
    test('Legacy data requires an explicit first-account ownership choice', () => {
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'بيانات الجهاز القديمة' });
      assert(StorageService.needsLegacyDataDecision('user:alpha'), 'Existing legacy data should trigger the one-time choice');
      assert(!StorageService.setStorageScope('user:alpha'), 'Account scope must not claim legacy data without a choice');
      assert(StorageService.getStorageScope() === 'legacy', 'Scope must remain unchanged until the user chooses');
    });

    test('Import choice migrates and verifies legacy data into the first account', () => {
      assert(StorageService.setStorageScope('user:alpha', 'import'), 'Legacy import should succeed');
      assert(StorageService.getStorageScope() === 'user:alpha', 'Authenticated account scope should become active');
      assert(StorageService.getProfile().name === 'بيانات الجهاز القديمة', 'Legacy profile should be preserved in the account');
      assert(!StorageService.needsLegacyDataDecision('user:beta'), 'A second account must not be offered the first account legacy data');
    });

    test('Different accounts receive isolated profile and weak-verse records', () => {
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'ملف ألفا' });
      const weakVerse: WeakVerseItem = {
        id: 's1_a1',
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 1,
        text: 'بِسْمِ اللَّهِ',
        mistakeCount: 2,
        lastFailedDate: '2026-11-05'
      };
      RetentionService.saveWeakVerses([weakVerse]);

      assert(StorageService.setStorageScope('user:beta'), 'Second account scope should activate');
      assert(StorageService.getProfile().name === CLEAN_INITIAL_PROFILE.name, 'Beta must start with a clean profile');
      assert(RetentionService.getWeakVerses().length === 0, 'Beta must not see Alpha weak verses');

      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'ملف بيتا' });
      RetentionService.saveWeakVerses([{ ...weakVerse, id: 's2_a1', surahNumber: 2, surahName: 'البقرة', ayahNumber: 1 }]);

      assert(StorageService.setStorageScope('user:alpha'), 'Switching back to Alpha should succeed');
      assert(StorageService.getProfile().name === 'ملف ألفا', 'Alpha profile should be restored');
      assert(RetentionService.getWeakVerses().length === 1 && RetentionService.getWeakVerses()[0].surahNumber === 1, 'Alpha weak verses should remain isolated');
    });

    test('Resetting one account does not clear another account in-memory or durable data', () => {
      assert(StorageService.setStorageScope('user:beta'), 'Switching to Beta should succeed');
      StorageService.resetAllData();
      assert(StorageService.setStorageScope('user:alpha'), 'Switching to Alpha should succeed');
      assert(StorageService.getProfile().name === 'ملف ألفا', 'Resetting Beta must not erase Alpha profile');
      assert(RetentionService.getWeakVerses().length === 1, 'Resetting Beta must not erase Alpha weak verses');
    });

    test('Guest data stays separate and is not silently claimed by a later account', () => {
      assert(StorageService.setStorageScope('guest'), 'Guest scope should activate');
      assert(StorageService.getProfile().name === CLEAN_INITIAL_PROFILE.name, 'Imported legacy data should no longer remain in the guest store');
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'بيانات ضيف مستقلة' });

      assert(StorageService.setStorageScope('user:gamma'), 'A later account should activate');
      assert(StorageService.getProfile().name === CLEAN_INITIAL_PROFILE.name, 'Gamma must not inherit guest data');
      assert(StorageService.setStorageScope('guest'), 'Guest scope should be recoverable');
      assert(StorageService.getProfile().name === 'بيانات ضيف مستقلة', 'Guest data should remain available to guest mode');
    });
  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
