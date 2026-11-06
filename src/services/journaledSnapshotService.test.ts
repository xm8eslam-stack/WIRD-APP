import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { CLEAN_INITIAL_PROFILE, StorageService } from './storageService';
import { PRESET_PLANS } from '../data/presetPlans';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import {
  persistEnginePlansSnapshot,
  persistJournaledSnapshot,
  persistPlansSnapshot,
  persistProfileSnapshot
} from './journaledSnapshotService';

export async function runJournaledSnapshotServiceTests(): Promise<{ passed: number; failed: number }> {
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
    StorageService.setStorageScope('user:journaled-snapshot-' + (++index));
    return new IndexedDbSyncJournal({
      indexedDBFactory: new IDBFactory(),
      databaseName: 'wird-journaled-snapshot-test-' + index
    });
  };

  try {
    await test('Authenticated profile writes commit to the journal before local projection', async () => {
      const journal = createJournal();
      const profile = { ...CLEAN_INITIAL_PROFILE, name: 'حافظ القرآن' };
      const result = await persistProfileSnapshot(profile, { journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      assert(result.success && result.mode === 'journal' && result.queued, 'Profile snapshot must use the journal path');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1, 'Profile event and outbox record must both be durable');
      assert(snapshot.projectionCursor === 1, 'Projection cursor must advance after the local write');
      assert(StorageService.getProfile().name === profile.name, 'The local profile must match the committed snapshot');
      journal.close();
    });

    await test('Preset and engine-plan snapshots use validated journal replay', async () => {
      const journal = createJournal();
      const plansResult = await persistPlansSnapshot(PRESET_PLANS, { journal, runExclusive: inlineLock });
      assert(plansResult.success, 'Preset plans must persist through the journal');
      assert(JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS), 'Preset plan projection must preserve every record');

      const engineResult = await persistEnginePlansSnapshot([], { journal, runExclusive: inlineLock });
      assert(engineResult.success, 'An empty engine-plan snapshot must be a valid journal mutation');
      const snapshot = await journal.getSnapshot();
      assert(snapshot.eventCount === 2 && snapshot.pendingCount === 2 && snapshot.projectionCursor === 2,
        'Each plan snapshot must have a durable event/outbox pair and contiguous projection');
      journal.close();
    });

    await test('Invalid snapshots remain queued for recovery and never advance the projection cursor', async () => {
      const journal = createJournal();
      let fallbackCalled = false;
      const result = await persistJournaledSnapshot({
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: [{ id: 'invalid-plan' }] }
      }, () => { fallbackCalled = true; return true; }, { journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      assert(!result.success && result.queued, 'A failed projection must report the already-committed event');
      assert(!fallbackCalled, 'The local-only fallback must never run after a journal commit');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1, 'The event must remain available for a later recovery attempt');
      assert(snapshot.projectionCursor === 0, 'The cursor must remain before the invalid event');
      assert(StorageService.getPlans().length === 0, 'Invalid data must not overwrite the local archive');

      const laterWrite = await persistPlansSnapshot(PRESET_PLANS, { journal, runExclusive: inlineLock });
      const afterLaterWrite = await journal.getSnapshot();
      assert(!laterWrite.success && !laterWrite.queued,
        'A later snapshot must be blocked while an earlier committed event cannot be replayed');
      assert(afterLaterWrite.eventCount === 1 && afterLaterWrite.projectionCursor === 0,
        'Blocked later writes must not append an event behind an unrecovered snapshot');
      journal.close();
    });

    await test('Guest writes remain local-only and do not open a journal', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('guest');
      const result = await persistPlansSnapshot(PRESET_PLANS);
      assert(result.success && result.mode === 'local-only' && !result.queued, 'Guest persistence must remain local-only');
      assert(JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS), 'Guest plan data must still persist locally');
    });
  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
