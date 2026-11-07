import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { CLEAN_INITIAL_PROFILE, StorageService } from './storageService';
import { PRESET_PLANS } from '../data/presetPlans';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import { importBackupFile, importBackupJournaled, resetAllDataJournaled } from './backupPersistence';
import { RetentionService } from './retentionService';
import { getLocalDateString } from './unifiedPortionService';

export async function runBackupPersistenceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let index = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const inlineLock = async <T>(_name: string, task: () => Promise<T>): Promise<T> => task();
  const createJournal = () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:backup-persistence-' + (++index));
    return new IndexedDbSyncJournal({
      indexedDBFactory: new IDBFactory(),
      databaseName: 'wird-backup-persistence-test-' + index
    });
  };

  await test('Backup import replays older pending journal events before applying the import', async () => {
    const journal = createJournal();
    const olderProfile = { ...CLEAN_INITIAL_PROFILE, name: 'تغيير سابق' };
    const importedProfile = { ...CLEAN_INITIAL_PROFILE, name: 'نسخة احتياطية مستوردة' };
    await journal.enqueue({
      mutationId: 'pending-before-backup-import',
      collection: 'profile', documentId: 'main', payload: { profile: olderProfile }
    });
    const backup = JSON.stringify({ version: 4, profile: importedProfile, plans: [], logs: [] });

    const firstAttempt = await importBackupJournaled(backup, { journal, runExclusive: inlineLock });
    assert(!firstAttempt.success && firstAttempt.recoveredPriorEvents === true,
      'Import must stop after recovering an older pending event instead of overwriting it in the same attempt');
    assert(StorageService.getProfile().name === olderProfile.name,
      'The older event must be replayed and visible before the import is retried');

    const retry = await importBackupJournaled(backup, { journal, runExclusive: inlineLock });
    assert(retry.success, 'Retrying the same backup after recovery must import successfully');
    assert(StorageService.getProfile().name === importedProfile.name,
      'The imported profile must become the latest projection');
    assert(StorageService.getPlans().length === 0 && StorageService.getLogs().length === 0,
      'All included backup collections must be projected');
    const snapshot = await journal.getSnapshot();
    assert(snapshot.eventCount === 2 && snapshot.projectionCursor === 2,
      'The old mutation and the import must remain ordered as two durable events');
    journal.close();
  });

  await test('Version-five backup import restores Ruqyah progress through the grouped journal transaction', async () => {
    const journal = createJournal();
    const progress = { schemaVersion: 1 as const, updatedAtMs: 1_800_000_000_000, counts: { 'q-fatiha': 6 } };
    const backup = JSON.stringify({
      format: 'wird_backup', version: 5, timestamp: new Date().toISOString(),
      isEncrypted: false, unencryptedWarning: 'test',
      profile: CLEAN_INITIAL_PROFILE, plans: [], logs: [], ruqyahProgress: progress
    });
    const result = await importBackupJournaled(backup, { journal, runExclusive: inlineLock });
    const events = await journal.listEvents();
    const importedTransaction = events[0]?.payload.transaction as { operations?: Array<{ collection?: string }> } | undefined;
    assert(result.success, 'A valid version-five backup must import successfully');
    assert(JSON.stringify(StorageService.getRuqyahProgressSnapshot()?.counts) === JSON.stringify(progress.counts),
      'The Ruqyah progress snapshot must be restored exactly');
    assert(events.length === 1 && events[0].collection === 'syncMeta' &&
      Array.isArray(importedTransaction?.operations) &&
      importedTransaction.operations.some(operation => operation.collection === 'ruqyahProgress'),
      'The imported progress must be part of the same durable grouped transaction');
    journal.close();
  });

  await test('Reset appends an ordered reset snapshot and clears every active local collection', async () => {
    const journal = createJournal();
    const today = getLocalDateString();
    StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'بيانات قبل إعادة الضبط' });
    StorageService.savePlans(PRESET_PLANS);
    StorageService.saveEnginePlans([]);
    StorageService.saveRuqyahProgressSnapshot({ schemaVersion: 1, updatedAtMs: 1_800_000_000_000, counts: { 'q-fatiha': 8 } });
    RetentionService.addPortion({
      type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
      status: 'recently_memorized', nextDueDate: today, intervalDays: 1, easeFactor: 2.5,
      repetitionCount: 1, mistakesCount: 0
    });
    StorageService.saveLogs([{
      date: today, memorizedAyahsCount: 5, reviewedPagesCount: 0, minutesSpent: 5, completedTasks: ['حفظ']
    }]);

    await journal.enqueue({
      mutationId: 'pending-before-reset',
      collection: 'profile', documentId: 'main',
      payload: { profile: { ...CLEAN_INITIAL_PROFILE, name: 'تغيير سابق قبل إعادة الضبط' } }
    });
    const firstAttempt = await resetAllDataJournaled({ journal, runExclusive: inlineLock });
    assert(!firstAttempt.success && firstAttempt.recoveredPriorEvents === true,
      'Reset must replay older pending events first and require a fresh confirmation attempt');
    const result = await resetAllDataJournaled({ journal, runExclusive: inlineLock });
    assert(result.success, 'Reset snapshot must commit after older events are recovered');
    assert(StorageService.getProfile().name === CLEAN_INITIAL_PROFILE.name, 'Profile must return to clean initial state');
    assert(StorageService.getPlans().length === 0 && StorageService.getEnginePlans().length === 0,
      'Preset and engine plans must be cleared');
    assert(StorageService.getUnifiedPortions().length === 0 && StorageService.getLogs().length === 0,
      'Canonical portions and activity logs must be cleared');
    assert(Object.keys(StorageService.getRuqyahProgressSnapshot()?.counts || {}).length === 0,
      'Ruqyah progress must be reset as part of the ordered cloud transaction');
    const snapshot = await journal.getSnapshot();
    assert(snapshot.eventCount === 2 && snapshot.projectionCursor === 2,
      'The prior event and reset must remain ordered with a completed local projection');
    journal.close();
  });

  await test('Invalid backup import does not enqueue an event or change existing data', async () => {
    const journal = createJournal();
    StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, name: 'الحالة الأصلية' });
    const result = await importBackupJournaled('{ invalid json', { journal, runExclusive: inlineLock });
    const snapshot = await journal.getSnapshot();
    assert(!result.success, 'Invalid JSON must be rejected');
    assert(StorageService.getProfile().name === 'الحالة الأصلية', 'Invalid import must preserve existing profile');
    assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
      'Invalid import must not enqueue any journal event');
    journal.close();
  });

  await test('File-based backup import uses the shared journal-first transaction', async () => {
    const journal = createJournal();
    const importedProfile = { ...CLEAN_INITIAL_PROFILE, name: 'استيراد من ملف' };
    const file = {
      name: 'wird-backup.json',
      text: async () => JSON.stringify({ version: 4, profile: importedProfile, plans: [], logs: [] })
    };
    const result = await importBackupFile(file, { journal, runExclusive: inlineLock });
    assert(result.success, 'Valid JSON backup file must import through the journal');
    assert(StorageService.getProfile().name === importedProfile.name, 'Imported profile must be projected');
    const snapshot = await journal.getSnapshot();
    assert(snapshot.eventCount === 1 && snapshot.projectionCursor === 1,
      'File import must append and project one durable event');
    journal.close();
  });

  await test('File-based backup import rejects non-JSON and empty files without writes', async () => {
    const journal = createJournal();
    const wrongExtension = await importBackupFile({
      name: 'backup.txt',
      text: async () => JSON.stringify({ version: 4, profile: CLEAN_INITIAL_PROFILE })
    }, { journal, runExclusive: inlineLock });
    const empty = await importBackupFile({
      name: 'backup.json',
      text: async () => '   '
    }, { journal, runExclusive: inlineLock });
    const snapshot = await journal.getSnapshot();
    assert(!wrongExtension.success && !empty.success, 'Invalid file inputs must be rejected');
    assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
      'Rejected files must not create journal events');
    journal.close();
  });

  StorageService.__resetStorageForTests();
  return { passed, failed };
}
