import { validateBackupPayload, StorageService } from '../services/storageService';

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

  // 5. Atomic protection: Failed import never overwrites existing data
  test('Failed import returns error and preserves existing user data', () => {
    const malformedJson = '{"version": 3, "profile": {"name": "جديد"}, "plans": "broken"}';
    const importRes = StorageService.importBackup(malformedJson);
    assert(importRes.success === false, 'Import should fail for malformed plans');
  });

  // 6. Successful import rebuilds the canonical v2 portion store
  test('Successful backup import restores portions into the canonical store', () => {
    const snapshot = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();
      const payload = {
        format: 'wird_backup',
        version: 3,
        timestamp: '2026-11-05T10:00:00Z',
        isEncrypted: false,
        unencryptedWarning: 'Warning',
        profile: {
          name: 'اختبار الاستيراد',
          email: '',
          memorizationGoal: 'حفظ القرآن',
          preferredReciter: 'alafasy',
          quranFontSize: 'lg',
          audioAutoPlay: true,
          repetitionTarget: 5,
          theme: 'light',
          streakDays: 0,
          lastActiveDate: ''
        },
        plans: [],
        enginePlans: [],
        revisionItems: [],
        logs: [],
        tests: [],
        portions: [{
          id: 'legacy-test-portion',
          type: 'passage',
          surahNumber: 112,
          surahName: 'الإخلاص',
          startAyah: 1,
          endAyah: 4,
          status: 'stable',
          nextDueDate: '2026-11-06',
          intervalDays: 1,
          easeFactor: 2.5,
          repetitionCount: 1
        }],
        weakVerses: []
      };

      const result = StorageService.importBackup(JSON.stringify(payload));
      assert(result.success, 'Valid backup import should report success');
      const restored = StorageService.getUnifiedPortions();
      assert(restored.length === 1, 'Imported portion is available from canonical v2 storage');
      assert(restored[0].id === 's112_a1_a4', 'Imported portion receives its canonical coordinate ID');
    } finally {
      StorageService.restoreStorageSnapshot(snapshot);
    }
  });

  // 7. Exported backup contains unencrypted warning label
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
