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

    test('Keep-as-guest choice preserves legacy data without importing it into the account', () => {
      StorageService.__resetStorageForTests();
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'بيانات ضيف محفوظة' });
      assert(StorageService.needsLegacyDataDecision('user:delta'), 'Legacy guest data should require a choice');
      assert(StorageService.setStorageScope('user:delta', 'keep-guest'), 'Keep-as-guest choice should activate the account');
      assert(StorageService.getProfile().name === CLEAN_INITIAL_PROFILE.name, 'Account should start clean');
      assert(StorageService.setStorageScope('guest'), 'Guest scope should remain accessible');
      assert(StorageService.getProfile().name === 'بيانات ضيف محفوظة', 'Legacy data should remain in guest scope');

      assert(StorageService.setStorageScope('user:gamma'), 'A later account should activate');
      assert(StorageService.getProfile().name === CLEAN_INITIAL_PROFILE.name, 'Gamma must not inherit guest data');
      assert(StorageService.setStorageScope('guest'), 'Guest scope should be recoverable');
      assert(StorageService.getProfile().name === 'بيانات ضيف محفوظة', 'Guest data should remain available to guest mode');
    });
    test('Failed legacy import restores copied destinations and all previously removed sources', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      const values = new Map<string, string>();
      let plansRemovalAttempted = false;
      StorageService.__resetStorageForTests();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => {
            if (key === 'wird_plans' && !plansRemovalAttempted) {
              plansRemovalAttempted = true;
              throw new Error('simulated removal failure after earlier source removal');
            }
            values.delete(key);
          }
        }
      });
      const originalProfile = JSON.stringify({ ...CLEAN_INITIAL_PROFILE, name: 'Legacy profile' });
      const originalPlans = JSON.stringify([]);
      values.set('wird_profile', originalProfile);
      values.set('wird_plans', originalPlans);
      try {
        assert(!StorageService.setStorageScope('user:rollback-import', 'import'),
          'A source removal failure must reject the account import');
        assert(StorageService.getStorageScope() === 'legacy', 'Failed import must not activate the account scope');
        assert(values.get('wird_profile') === originalProfile, 'An earlier removed legacy source must be restored');
        assert(values.get('wird_plans') === originalPlans, 'The source that failed removal must remain intact');
        assert(!Array.from(values.keys()).some(key => key.startsWith('wird_scope_v1:user:rollback-import:')),
          'Copied destination keys must be removed when the import rolls back');
        assert(!values.has('wird_storage_owner_v1'), 'Ownership marker must not be committed after failed import');
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete (globalThis as any).localStorage;
        StorageService.__resetStorageForTests();
      }
    });

    test('Legacy import aborts before mutation when durable snapshot reads are unavailable', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      const values = new Map<string, string>([['wird_profile', JSON.stringify({ ...CLEAN_INITIAL_PROFILE, name: 'Protected' })]]);
      let readsBlocked = false;
      let writes = 0;
      StorageService.__resetStorageForTests();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => {
            if (readsBlocked) throw new Error('simulated inaccessible storage');
            return values.get(key) ?? null;
          },
          setItem: (key: string, value: string) => { writes++; values.set(key, value); },
          removeItem: (key: string) => { writes++; values.delete(key); }
        }
      });
      try {
        readsBlocked = true;
        assert(!StorageService.setStorageScope('user:unreadable-import', 'import'),
          'Import must reject when a trustworthy snapshot cannot be read');
        assert(writes === 0, 'No writes or removals may occur before the complete snapshot is readable');
        assert(values.get('wird_profile')?.includes('Protected') === true, 'Legacy source data must remain untouched');
        assert(StorageService.getStorageScope() === 'legacy', 'Scope must remain unchanged');
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete (globalThis as any).localStorage;
        StorageService.__resetStorageForTests();
      }
    });

  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
