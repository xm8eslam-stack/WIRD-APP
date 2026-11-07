import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { PRESET_PLANS } from '../data/presetPlans';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import type { LegacyOutboxState } from './indexedDbSyncJournal';
import { replayJournalProjection } from './journalProjectionReplayer';
import { StorageService } from './storageService';

export async function runJournalProjectionReplayerTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let index = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const createJournal = () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:projection-test-' + (++index));
    return new IndexedDbSyncJournal({
      indexedDBFactory: new IDBFactory(),
      databaseName: 'wird-projection-replay-test-' + index
    });
  };
  const inlineLock = async <T>(_name: string, task: () => Promise<T>): Promise<T> => task();

  try {
    await test('Replay skips legacy events already projected and applies new full-snapshot events', async () => {
      const journal = createJournal();
      const legacy: LegacyOutboxState = {
        schemaVersion: 1,
        deviceId: 'projection-legacy-device',
        pending: [{
          mutationId: 'legacy-already-local',
          collection: 'plans',
          documentId: 'plans-snapshot',
          operation: 'upsert',
          schemaVersion: 1,
          clientUpdatedAtMs: 100,
          deviceId: 'projection-legacy-device',
          payload: { records: [] },
          queuedAtMs: 100,
          attemptCount: 0,
          nextAttemptAtMs: 0
        }],
        acknowledgedIds: [],
        acknowledgedFingerprints: []
      };
      await journal.importLegacyState(legacy);
      await journal.enqueue({
        mutationId: 'new-plans-snapshot',
        collection: 'plans',
        documentId: 'plans-snapshot',
        payload: { records: PRESET_PLANS },
        nowMs: 200
      });

      const result = await replayJournalProjection(journal, inlineLock);
      const snapshot = await journal.getSnapshot();
      const storedPlans = StorageService.getPlans();
      assert(result.applied === 1 && result.skippedAlreadyProjected === 1 && result.cursor === 2,
        'Replay must skip the legacy projection and apply the new event in sequence');
      assert(snapshot.projectionCursor === 2, 'Cursor must advance only after each event is handled');
      assert(storedPlans.length === PRESET_PLANS.length, 'The full plan snapshot must be durably projected');
      assert(JSON.stringify(storedPlans) === JSON.stringify(PRESET_PLANS), 'The projected snapshot must preserve the source data');

      const secondReplay = await replayJournalProjection(journal, inlineLock);
      assert(secondReplay.applied === 0 && secondReplay.skippedAlreadyProjected === 0 && secondReplay.cursor === 2,
        'A second replay must be idempotent and perform no additional projection');
      journal.close();
    });

    await test('A committed journal event is replayed after a simulated app restart before local projection', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:projection-restart-recovery');
      const factory = new IDBFactory();
      const databaseName = 'wird-projection-restart-recovery';
      const beforeRestart = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      await beforeRestart.enqueue({
        mutationId: 'restart-recovery-plans',
        collection: 'plans',
        documentId: 'plans-snapshot',
        payload: { records: PRESET_PLANS },
        nowMs: 250
      });
      const beforeSnapshot = await beforeRestart.getSnapshot();
      assert(beforeSnapshot.eventCount === 1 && beforeSnapshot.pendingCount === 1 && beforeSnapshot.projectionCursor === 0,
        'A simulated interruption after enqueue must leave one durable pending event and an unchanged cursor');
      beforeRestart.close();

      const afterRestart = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
      const replay = await replayJournalProjection(afterRestart, inlineLock);
      const afterSnapshot = await afterRestart.getSnapshot();
      assert(replay.applied === 1 && replay.cursor === 1,
        'The next application startup must replay the committed event exactly once');
      assert(afterSnapshot.pendingCount === 1 && afterSnapshot.projectionCursor === 1,
        'Local projection recovery must not acknowledge remote delivery');
      assert(JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS),
        'The recovered local projection must exactly match the committed snapshot');
      afterRestart.close();
    });

    await test('Invalid projection payload stops replay and leaves the cursor before the failed event', async () => {
      const journal = createJournal();
      await journal.enqueue({
        mutationId: 'invalid-plan-snapshot',
        collection: 'plans',
        documentId: 'plans-snapshot',
        payload: { records: [{ id: 'not-a-valid-plan' }] },
        nowMs: 300
      });
      let rejected = false;
      try { await replayJournalProjection(journal, inlineLock); } catch { rejected = true; }
      const snapshot = await journal.getSnapshot();
      assert(rejected, 'Invalid projection must stop bootstrap instead of silently skipping data');
      assert(snapshot.projectionCursor === 0, 'The cursor must not advance when local projection fails');
      assert(StorageService.getPlans().length === 0, 'Invalid data must not overwrite the local plan archive');
      journal.close();
    });

    await test('Replay recovers an exact projection written before a cursor-commit interruption', async () => {
      const journal = createJournal();
      await journal.enqueue({
        mutationId: 'projection-written-before-cursor',
        collection: 'plans',
        documentId: 'plans-snapshot',
        payload: { records: PRESET_PLANS },
        nowMs: 350
      });
      const event = (await journal.listEvents())[0];
      assert(StorageService.applyJournalEvent(event),
        'The simulated first attempt must write the complete local projection');
      const beforeRetry = await journal.getSnapshot();
      assert(beforeRetry.projectionCursor === 0,
        'The simulated interruption must happen before the durable cursor advances');

      const replay = await replayJournalProjection(journal, inlineLock);
      const afterRetry = await journal.getSnapshot();
      assert(replay.applied === 0 && replay.skippedAlreadyProjected === 1 &&
        replay.recoveredAlreadyProjected === 1 && replay.cursor === 1,
        'Retry must recognize the exact durable snapshot and safely commit its cursor');
      assert(afterRetry.projectionCursor === 1 &&
        JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS),
        'Recovery must preserve the exact projection without duplicating or losing records');
      journal.close();
    });

    await test('Guest scope does not open or replay a UID-scoped journal', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('guest');
      const result = await replayJournalProjection(new IndexedDbSyncJournal({
        indexedDBFactory: new IDBFactory(),
        databaseName: 'wird-projection-guest-test'
      }), inlineLock);
      assert(result.uid === '' && result.applied === 0 && result.cursor === 0,
        'Guest mode must remain local-only and skip cloud journal replay');
    });

    await test('Storage projection rejects an event belonging to another UID', async () => {
      const journal = createJournal();
      await journal.enqueue({
        mutationId: 'uid-bound-event',
        collection: 'plans',
        documentId: 'plans-snapshot',
        payload: { records: PRESET_PLANS },
        nowMs: 400
      });
      const event = (await journal.listEvents())[0];
      assert(!StorageService.applyJournalEvent({ ...event, uid: 'different-account' }),
        'A journal event from another account must never be applied to this storage scope');
      assert(StorageService.getPlans().length === 0, 'Cross-account projection must not mutate local data');
      journal.close();
    });
  } finally {
    StorageService.__resetStorageForTests();
  }

  return { passed, failed };
}
