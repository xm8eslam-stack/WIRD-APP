import { validateBackupPayload, StorageService, CLEAN_INITIAL_PROFILE, STORAGE_KEYS, buildDemoEnginePlan } from '../services/storageService';
import { WirdPortion, RevisionItem, TestResult, WeakVerseItem, DailyLog } from '../types/quran';
import { PRESET_PLANS } from '../data/presetPlans';

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

  test('Deep validation accepts representative valid records across every backup collection', () => {
    const revisionItem: RevisionItem = {
      id: 'revision-valid-1', surahNumber: 67, surahName: 'الملك',
      startAyah: 1, endAyah: 5, type: 'minor',
      lastReviewedDate: '2026-11-05', nextDueDate: '2026-11-06',
      intervalDays: 1, easeFactor: 2.5, repetitionCount: 1, strength: 'weak'
    };
    const projectedRevision: RevisionItem = {
      id: SAMPLE_PORTION.id, surahNumber: SAMPLE_PORTION.surahNumber, surahName: SAMPLE_PORTION.surahName,
      startAyah: SAMPLE_PORTION.startAyah, endAyah: SAMPLE_PORTION.endAyah, type: 'minor',
      nextDueDate: SAMPLE_PORTION.nextDueDate, intervalDays: SAMPLE_PORTION.intervalDays,
      easeFactor: SAMPLE_PORTION.easeFactor, repetitionCount: SAMPLE_PORTION.repetitionCount, strength: 'strong'
    };
    const testResult: TestResult = {
      id: 'test-valid-1', date: '2026-11-06', type: 'complete_verse',
      surahName: 'الملك', score: 8, totalQuestions: 10, weakVerses: ['67:3']
    };
    const weakVerse: WeakVerseItem = {
      id: 'weak-valid-1', surahNumber: 67, surahName: 'الملك', ayahNumber: 3,
      text: 'نص تجريبي صالح', mistakeCount: 1, lastFailedDate: '2026-11-06'
    };
    const log: DailyLog = {
      date: '2026-11-06', memorizedAyahsCount: 3, reviewedPagesCount: 1,
      minutesSpent: 15, completedTasks: ['جلسة حفظ']
    };
    const payload = {
      version: 4,
      profile: { ...CLEAN_INITIAL_PROFILE },
      plans: [PRESET_PLANS[0]],
      enginePlans: [buildDemoEnginePlan()],
      revisionItems: [projectedRevision],
      logs: [log],
      tests: [testResult],
      portions: [SAMPLE_PORTION],
      unifiedPortions: [SAMPLE_PORTION],
      weakVerses: [weakVerse]
    };
    const result = validateBackupPayload(payload);
    assert(result.valid, 'All valid nested records should pass strict backup validation: ' + (result.error || ''));
    assert(validateBackupPayload({ version: 3, revisionItems: [revisionItem] }).valid,
      'Complete legacy revision item should pass its migration-compatible schema');
  });

  test('Backup rejects malformed records inside arrays, not only malformed array roots', () => {
    const badPlan = { ...PRESET_PLANS[0], dailyTarget: -1 };
    const badRevision = {
      id: 'revision-bad', surahNumber: 67, surahName: 'الملك', startAyah: 0, endAyah: 5,
      type: 'minor', nextDueDate: '2026-11-06', intervalDays: 1, easeFactor: 2.5,
      repetitionCount: 1, strength: 'weak'
    };
    const badTest = {
      id: 'test-bad', date: '2026-11-06', type: 'complete_verse', surahName: 'الملك',
      score: 101, totalQuestions: 10, weakVerses: []
    };
    const badWeakVerse = {
      id: 'weak-bad', surahNumber: 1, surahName: 'الفاتحة', ayahNumber: 8,
      text: 'آية خارج حدود السورة', mistakeCount: 1, lastFailedDate: '2026-11-06'
    };
    const cases = [
      { plans: [badPlan] },
      { revisionItems: [badRevision] },
      { tests: [badTest] },
      { weakVerses: [badWeakVerse] },
      { logs: [{ date: '2026-11-06', memorizedAyahsCount: -1, reviewedPagesCount: 0, minutesSpent: 1, completedTasks: [] }] },
      { portions: [{ ...SAMPLE_PORTION, id: 'legacy-bad', endAyah: 999 }] },
      { unifiedPortions: [{ ...SAMPLE_PORTION, id: 'not-canonical' }] }
    ];
    for (const invalidCollection of cases) {
      const result = validateBackupPayload({ version: 4, ...invalidCollection });
      assert(!result.valid, 'Malformed nested records must be rejected');
    }
    const badEnginePlan = buildDemoEnginePlan();
    badEnginePlan.schedule[0].dayOfWeek = 7;
    assert(!validateBackupPayload({ version: 4, enginePlans: [badEnginePlan] }).valid,
      'Malformed nested engine schedule days must be rejected');
  });

  test('Duplicate daily activity dates are rejected without overwriting the original archive', () => {
    const snapshot = StorageService.getStorageSnapshot();
    const duplicateLogs = [
      { date: '2026-11-06', memorizedAyahsCount: 1, reviewedPagesCount: 0, minutesSpent: 5, completedTasks: ['حفظ'] },
      { date: '2026-11-06', memorizedAyahsCount: 2, reviewedPagesCount: 0, minutesSpent: 7, completedTasks: ['مراجعة'] }
    ];
    const raw = JSON.stringify(duplicateLogs);
    try {
      StorageService.resetAllData();
      assert(StorageService.setRawItem(STORAGE_KEYS.LOGS, raw), 'Duplicate log fixture should be stored');
      assert(StorageService.getLogs().length === 0, 'Safe read must not expose duplicate daily log records');
      assert(!StorageService.recordSessionCompletion(1, 0, 1, 'محاولة جديدة'),
        'Session completion must refuse to overwrite a duplicate-date archive');
      assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === raw, 'Duplicate-date archive bytes must remain unchanged');
      assert(!validateBackupPayload({ version: 3, logs: duplicateLogs }).valid,
        'Backup import must reject duplicate daily activity dates');
    } finally {
      StorageService.restoreStorageSnapshot(snapshot);
    }
  });

  test('Version 4 rejects divergent legacy and canonical backup projections', () => {
    const mismatchedPortions = validateBackupPayload({
      version: 4,
      portions: [{ ...SAMPLE_PORTION, status: 'weak' }],
      unifiedPortions: [SAMPLE_PORTION]
    });
    assert(!mismatchedPortions.valid, 'Legacy portion projection must match canonical portions');

    const mismatchedRevision = validateBackupPayload({
      version: 4,
      unifiedPortions: [SAMPLE_PORTION],
      revisionItems: [{
        id: 'revision-different', surahNumber: 67, surahName: 'الملك',
        startAyah: 1, endAyah: 5, type: 'minor', nextDueDate: '2026-11-06',
        intervalDays: 1, easeFactor: 2.5, repetitionCount: 1, strength: 'weak'
      }]
    });
    assert(!mismatchedRevision.valid, 'Revision projection must match canonical portion metadata');
  });

  test('Backup export rejects malformed daily logs and divergent legacy projections', () => {
    const snapshot = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();
      const malformedLog = JSON.stringify([{
        date: '2026-11-06', memorizedAyahsCount: -1, reviewedPagesCount: 0,
        minutesSpent: 1, completedTasks: []
      }]);
      assert(StorageService.setRawItem(STORAGE_KEYS.LOGS, malformedLog), 'Malformed log fixture should be stored');
      let logExportRejected = false;
      try { StorageService.exportFullBackup(); } catch { logExportRejected = true; }
      assert(logExportRejected, 'Malformed log archive must block backup export');
      assert(StorageService.getRawItem(STORAGE_KEYS.LOGS) === malformedLog, 'Malformed log bytes must remain unchanged');

      StorageService.resetAllData();
      assert(StorageService.saveUnifiedPortions([SAMPLE_PORTION]), 'Canonical fixture should save');
      const divergentLegacy = JSON.stringify([{ ...SAMPLE_PORTION, status: 'weak' }]);
      assert(StorageService.setRawItem(STORAGE_KEYS.PORTIONS, divergentLegacy), 'Divergent projection fixture should be stored');
      let projectionExportRejected = false;
      try { StorageService.exportFullBackup(); } catch { projectionExportRejected = true; }
      assert(projectionExportRejected, 'Divergent legacy projection must block backup export');
      assert(StorageService.getRawItem(STORAGE_KEYS.PORTIONS) === divergentLegacy, 'Divergent legacy projection must be preserved');
    } finally {
      StorageService.restoreStorageSnapshot(snapshot);
    }
  });

  test('Malformed backup metadata is rejected when supplied', () => {
    assert(!validateBackupPayload({ version: 3, timestamp: 'not-a-date' }).valid,
      'Invalid backup timestamp must be rejected');
    assert(!validateBackupPayload({ version: 3, format: 'other-format' }).valid,
      'Unknown backup format must be rejected');
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
      profile: { ...CLEAN_INITIAL_PROFILE, name: 'عمر' },
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

  test('Version 4 rejects ayah coordinates beyond the selected Surah', () => {
    const invalid = { ...SAMPLE_PORTION, id: 's1_a1_a8', surahNumber: 1, surahName: 'الفاتحة', startAyah: 1, endAyah: 8 };
    const res = validateBackupPayload({ version: 4, unifiedPortions: [invalid] });
    assert(!res.valid, 'Al-Fatihah ayah 8 must be rejected');
  });

  test('Storage preserves an invalid canonical payload when no legacy recovery data exists', () => {
    const snapshot = StorageService.getStorageSnapshot();
    const invalidPayload = JSON.stringify([{
      ...SAMPLE_PORTION, id: 's1_a1_a8', surahNumber: 1, surahName: 'الفاتحة', startAyah: 1, endAyah: 8
    }]);
    try {
      StorageService.restoreStorageSnapshot({
        [`memory:${STORAGE_KEYS.SCHEMA_VERSION}`]: '2',
        [`memory:${STORAGE_KEYS.UNIFIED_PORTIONS}`]: invalidPayload,
        [`memory:${STORAGE_KEYS.PORTIONS}`]: '[]',
        [`memory:${STORAGE_KEYS.REVISION}`]: '[]'
      });
      const report = StorageService.ensureDataMigrated();
      assert(!report.success, 'Invalid canonical data without legacy recovery must not be reported as migrated');
      const after = StorageService.getStorageSnapshot();
      assert(after[`memory:${STORAGE_KEYS.UNIFIED_PORTIONS}`] === invalidPayload, 'Invalid payload must remain available for manual recovery');
    } finally { StorageService.restoreStorageSnapshot(snapshot); }
  });

  test('Storage refuses to persist invalid Quran coordinates', () => {
    const snapshot = StorageService.getStorageSnapshot();
    try {
      StorageService.resetAllData();
      assert(StorageService.saveUnifiedPortions([SAMPLE_PORTION]), 'Valid canonical data should save before the negative check');
      const invalid = { ...SAMPLE_PORTION, id: 's1_a1_a8', surahNumber: 1, surahName: 'الفاتحة', startAyah: 1, endAyah: 8 };
      assert(!StorageService.saveUnifiedPortions([invalid]), 'Invalid Al-Fatihah ayah boundary must not be persisted');
      assert(JSON.stringify(StorageService.getUnifiedPortions()) === JSON.stringify([SAMPLE_PORTION]), 'Rejected write must leave the previous valid data unchanged');
    } finally { StorageService.restoreStorageSnapshot(snapshot); }
  });

  test('Version 4 rejects IDs that do not match their Quran coordinates', () => {
    const invalid = { ...SAMPLE_PORTION, id: 's67_a2_a3' };
    const res = validateBackupPayload({ version: 4, unifiedPortions: [invalid] });
    assert(!res.valid, 'Canonical portion ID must match the Surah and ayah range');
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

  test('A storage write failure rolls back earlier backup import writes', () => {
    const snapshot = StorageService.getStorageSnapshot();
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const fakeStore = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => fakeStore.has(key) ? fakeStore.get(key)! : null,
      setItem: (key: string, value: string) => {
        if (key === 'wird_plans') throw new Error('Simulated quota failure');
        fakeStore.set(key, String(value));
      },
      removeItem: (key: string) => { fakeStore.delete(key); },
      clear: () => { fakeStore.clear(); }
    };
    try {
      Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage, configurable: true, writable: true });
      StorageService.resetAllData();
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'الحساب الأصلي' });
      const payload = { version: 3, profile: { ...CLEAN_INITIAL_PROFILE, name: 'الحساب البديل' }, plans: [] };
      const result = StorageService.importBackup(JSON.stringify(payload));
      assert(!result.success, 'Import must fail when a durable storage write fails');
      assert(result.message.includes('تم التحقق من استعادة البيانات السابقة'), 'Import must report that rollback was verified');
      assert(StorageService.getProfile().name === 'الحساب الأصلي', 'Rollback must restore the profile written before the failing key');
    } finally {
      StorageService.restoreStorageSnapshot(snapshot);
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
    }
  });

  test('Snapshot restoration reports a failed durable readback instead of silently succeeding', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (key === STORAGE_KEYS.PROFILE) throw new Error('simulated restore quota failure');
          values.set(key, value);
        },
        removeItem: (key: string) => values.delete(key)
      }
    });
    try {
      const restored = StorageService.restoreStorageSnapshot({
        [`local:${STORAGE_KEYS.PROFILE}`]: JSON.stringify({ ...CLEAN_INITIAL_PROFILE, name: 'نسخة سابقة' })
      });
      assert(!restored, 'A failed localStorage restoration must return false');
      assert(!values.has(STORAGE_KEYS.PROFILE), 'The durable profile must remain absent after the simulated failure');
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      else delete (globalThis as any).localStorage;
    }
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

  test('Storage write APIs reject malformed records and preserve existing archives', () => {
    StorageService.__resetStorageForTests();
    try {
      assert(StorageService.setStorageScope('user:record-validation-test'), 'Test storage scope should initialize');
      const validPlan = PRESET_PLANS[0];
      assert(StorageService.savePlans([validPlan]), 'Valid plan should save');
      const originalPlans = StorageService.getRawItem(STORAGE_KEYS.PLANS);
      assert(!StorageService.savePlans([{ ...validPlan, dailyTarget: -1 } as any]), 'Invalid plan record should be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.PLANS) === originalPlans, 'Invalid plan write must not overwrite the valid archive');

      const malformedArchive = JSON.stringify([{ ...validPlan, dailyTarget: -1 }]);
      assert(StorageService.setRawItem(STORAGE_KEYS.PLANS, malformedArchive), 'Test corruption fixture should be stored');
      assert(!StorageService.savePlans([validPlan]), 'A valid replacement must not overwrite an archive containing malformed records');
      assert(StorageService.getRawItem(STORAGE_KEYS.PLANS) === malformedArchive, 'Malformed archive bytes must be preserved');
      assert(StorageService.getPlans().length === 0, 'Safe read should not expose malformed records');
      let exportRejected = false;
      try { StorageService.exportFullBackup(); } catch { exportRejected = true; }
      assert(exportRejected, 'Backup export must refuse to silently omit malformed archived records');

      const badEnginePlan = buildDemoEnginePlan();
      badEnginePlan.schedule[0].dayOfWeek = 7;
      assert(!StorageService.saveEnginePlans([badEnginePlan]), 'Malformed nested engine plan must not be saved');

      const badRevision: any = {
        id: 'revision-bad', surahNumber: 67, surahName: 'الملك', startAyah: 0, endAyah: 3,
        type: 'minor', nextDueDate: '2026-11-06', intervalDays: 1, easeFactor: 2.5,
        repetitionCount: 0, strength: 'weak'
      };
      assert(!StorageService.saveRevisionItems([badRevision]), 'Invalid revision coordinate must be rejected');

      const badTest: any = {
        id: 'test-bad', date: '2026-11-06', type: 'complete_verse', surahName: 'الملك',
        score: 101, totalQuestions: 10, weakVerses: []
      };
      assert(!StorageService.saveTest(badTest), 'Invalid test score must be rejected');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('Malformed nested backup records are rejected before any user data is written', () => {
    StorageService.__resetStorageForTests();
    try {
      assert(StorageService.setStorageScope('user:backup-record-validation-test'), 'Test storage scope should initialize');
      assert(StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'الحساب الأصلي' }), 'Original profile should save');
      const originalRawProfile = StorageService.getRawItem(STORAGE_KEYS.PROFILE);
      const invalidBackup = {
        version: 3,
        profile: { ...CLEAN_INITIAL_PROFILE, name: 'الحساب المستورد' },
        plans: [{ ...PRESET_PLANS[0], completedUnits: 999999 }]
      };
      const result = StorageService.importBackup(JSON.stringify(invalidBackup));
      assert(!result.success, 'Backup with malformed nested plan must fail validation');
      assert(StorageService.getRawItem(STORAGE_KEYS.PROFILE) === originalRawProfile, 'Profile bytes must remain unchanged when any nested backup record is invalid');
      assert(StorageService.getProfile().name === 'الحساب الأصلي', 'Existing profile must remain unchanged');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('Malformed legacy archives are rejected before migration and their original bytes are preserved', () => {
    const snapshot = StorageService.getStorageSnapshot();
    const malformedLegacyPortions = JSON.stringify([{
      id: 'legacy-invalid', surahNumber: 1, surahName: 'الفاتحة',
      startAyah: 1, endAyah: 8, status: 'stable'
    }]);
    try {
      StorageService.restoreStorageSnapshot({
        ['memory:' + STORAGE_KEYS.SCHEMA_VERSION]: '1',
        ['memory:' + STORAGE_KEYS.PORTIONS]: malformedLegacyPortions,
        ['memory:' + STORAGE_KEYS.REVISION]: '[]'
      });
      const report = StorageService.ensureDataMigrated();
      assert(!report.success, 'Malformed legacy coordinate must block migration');
      assert(StorageService.getRawItem(STORAGE_KEYS.PORTIONS) === malformedLegacyPortions,
        'Malformed legacy bytes must remain available for recovery');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === null,
        'No canonical archive may be written after a malformed legacy record');
    } finally {
      StorageService.restoreStorageSnapshot(snapshot);
    }
  });

  test('Backup export refuses incomplete legacy migration instead of producing an empty Quran archive', () => {
    const snapshot = StorageService.getStorageSnapshot();
    const malformedLegacy = JSON.stringify([{
      id: 'legacy-invalid-export', surahNumber: 1, surahName: 'الفاتحة',
      startAyah: 1, endAyah: 8, status: 'stable'
    }]);
    try {
      StorageService.restoreStorageSnapshot({
        ['memory:' + STORAGE_KEYS.PORTIONS]: malformedLegacy,
        ['memory:' + STORAGE_KEYS.REVISION]: '[]'
      });
      let rejected = false;
      try { StorageService.exportFullBackup(); } catch { rejected = true; }
      assert(rejected, 'Export must stop when legacy migration cannot produce canonical data');
      assert(StorageService.getRawItem(STORAGE_KEYS.PORTIONS) === malformedLegacy,
        'Malformed legacy bytes must remain unchanged after rejected export');
    } finally {
      StorageService.restoreStorageSnapshot(snapshot);
    }
  });

  test('Legacy revision items with migration-supported missing fields remain importable', () => {
    const legacyRevision = { surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5, nextDueDate: '', intervalDays: 0, easeFactor: 0, repetitionCount: 0 };
    const result = validateBackupPayload({ version: 3, revisionItems: [legacyRevision] });
    assert(result.valid, 'Legacy revision records with fields normalized by migration must remain supported');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('backupValidation.test')) {
  console.log('=== Running Backup Validation Tests ===');
  const res = runBackupTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
