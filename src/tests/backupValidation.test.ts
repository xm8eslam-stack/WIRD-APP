import { validateBackupPayload, StorageService, CLEAN_INITIAL_PROFILE } from '../services/storageService';
import { WirdPortion } from '../types/quran';

const SAMPLE_PORTION: WirdPortion = {
  id: 's67_a1_a3', type: 'passage', surahNumber: 67, surahName: 'الملك',
  startAyah: 1, endAyah: 3, status: 'stable', nextDueDate: '2026-11-06',
  intervalDays: 3, easeFactor: 2.5, repetitionCount: 2, history: []
};

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
}

export function runBackupTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
    } catch (e: any) {
      failed++;
      console.error('❌ FAIL: ' + name + ' - ' + (e?.message || e));
    }
  }

  // 1. Valid payload validation
  test('Valid backup payload passes validation', () => {
    const valid = {
      format: 'wird_backup',
      version: 3,
      timestamp: '2026-11-04T12:00:00Z',
      isEncrypted: false,
      unencryptedWarning: 'Warning',
      profile: {
        name: 'عبد الرحمن',
        email: '',
        memorizationGoal: 'حفظ القرآن',
        preferredReciter: 'alafasy',
        quranFontSize: 'lg',
        audioAutoPlay: true,
        repetitionTarget: 5,
        theme: 'light',
        streakDays: 2,
        lastActiveDate: '2026-11-04'
      },
      plans: [],
      revisionItems: [],
      logs: []
    };
    const res = validateBackupPayload(valid);
    assert(res.valid === true, 'Valid payload should pass');
  });

  // 2. Unsupported version
  test('Unsupported backup version (e.g. version 99) is rejected', () => {
    const invalidVersion = {
      version: 99,
      profile: { name: 'أحمد', streakDays: 0 }
    };
    const res = validateBackupPayload(invalidVersion);
    assert(Boolean(res.valid === false && res.error?.includes('إصدار')), 'Should reject unsupported version');
  });

  // 3. Invalid profile structure
  test('Malformed profile with empty name is rejected', () => {
    const invalidProfile = {
      version: 3,
      profile: { name: '   ', streakDays: 0 }
    };
    const res = validateBackupPayload(invalidProfile);
    assert(Boolean(res.valid === false && res.error?.includes('اسم الحافظ')), 'Should reject blank user name');
  });

  // 4. Corrupted field type (non-array for plans)
  test('Corrupted field (string instead of array for plans) is rejected', () => {
    const corruptedPlans = {
      version: 3,
      profile: { name: 'عمر', streakDays: 1 },
      plans: 'not-an-array'
    };
    const res = validateBackupPayload(corruptedPlans);
    assert(Boolean(res.valid === false && res.error?.includes('مصفوفة')), 'Should reject non-array plans');
  });

  // 5. Canonical portion validation and backup schema v4
  test('Version 4 accepts structurally valid canonical portions', () => {
    const res = validateBackupPayload({ version: 4, unifiedPortions: [SAMPLE_PORTION] });
    assert(res.valid, 'Valid canonical portion should pass v4 validation');
  });

  test('Version 4 rejects malformed canonical portion records', () => {
    const invalid = { ...SAMPLE_PORTION, status: 'invented-status' };
    const res = validateBackupPayload({ version: 4, unifiedPortions: [invalid] });
    assert(!res.valid && Boolean(res.error?.includes('المقطع الموحد')), 'Invalid portion status must be rejected');
  });

  // Canonical data must survive export, reset, and import.
  test('Backup v4 round-trip preserves canonical memorization portions', () => {
    const snapshot = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();
      assert(StorageService.saveUnifiedPortions([SAMPLE_PORTION]), 'Canonical sample should save');
      const exported = JSON.parse(StorageService.exportFullBackup());
      assert(exported.version === 4, 'New exports must use version 4');
      assert(JSON.stringify(exported.unifiedPortions) === JSON.stringify([SAMPLE_PORTION]), 'Export must include canonical portion payload');
      StorageService.resetAllData();
      const imported = StorageService.importBackup(JSON.stringify(exported));
      assert(imported.success, 'Version 4 backup should import successfully');
      assert(JSON.stringify(StorageService.getUnifiedPortions()) === JSON.stringify([SAMPLE_PORTION]), 'Imported canonical portions must exactly match exported data');
    } finally { StorageService.restoreStorageSnapshot(snapshot); }
  });

  test('Legacy version 3 portions migrate into the canonical schema', () => {
    const snapshot = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();
      const legacyPortion = { ...SAMPLE_PORTION, id: 'legacy-portion-67-1' };
      const imported = StorageService.importBackup(JSON.stringify({ version: 3, portions: [legacyPortion], revisionItems: [] }));
      assert(imported.success, 'Legacy v3 backup should import');
      const restored = StorageService.getUnifiedPortions();
      assert(restored.length === 1 && restored[0].surahNumber === 67 && restored[0].startAyah === 1, 'Legacy portion must be migrated into canonical storage');
    } finally { StorageService.restoreStorageSnapshot(snapshot); }
  });

  test('Failed import preserves the existing profile', () => {
    const snapshot = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'المستخدم الحالي' });
      const malformed = JSON.stringify({ version: 3, profile: { ...CLEAN_INITIAL_PROFILE, name: 'مستخدم جديد' }, plans: 'broken' });
      const result = StorageService.importBackup(malformed);
      assert(!result.success, 'Malformed backup must fail');
      assert(StorageService.getProfile().name === 'المستخدم الحالي', 'Failed import must not overwrite existing profile');
    } finally { StorageService.restoreStorageSnapshot(snapshot); }
  });

  // 5. Atomic protection: Failed import never overwrites existing data
  test('Failed import returns error and preserves existing user data', () => {
    const malformedJson = '{"version": 3, "profile": {"name": "جديد"}, "plans": "broken"}';
    const importRes = StorageService.importBackup(malformedJson);
    assert(importRes.success === false, 'Import should fail for malformed plans');
  });

  // 6. Exported backup contains unencrypted warning label
  test('Exported backup contains unencrypted warning label', () => {
    const exportedStr = StorageService.exportFullBackup();
    const parsed = JSON.parse(exportedStr);
    assert(parsed.isEncrypted === false, 'Exported backup must declare isEncrypted: false');
    assert(typeof parsed.unencryptedWarning === 'string' && parsed.unencryptedWarning.includes('غير مشفر'), 
      'Exported backup must include unencrypted warning');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('backupValidation.test')) {
  console.log('=== Running Backup Validation Tests ===');
  const res = runBackupTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
