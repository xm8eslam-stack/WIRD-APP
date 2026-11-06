import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { CLEAN_INITIAL_PROFILE, STORAGE_KEYS, StorageService } from './storageService';
import type { WirdPortion, TestResult } from '../types/quran';
import { PRESET_PLANS } from '../data/presetPlans';
import { RetentionService } from './retentionService';
import { buildWeakVerseFailureTransaction } from './weakVerseRecording';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import {
  persistEnginePlansSnapshot,
  persistJournaledSnapshot,
  persistJournaledTransaction,
  persistPlansSnapshot,
  persistPortionsSnapshot,
  persistProfileSnapshot,
  persistTestResultSnapshot
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

    await test('Canonical portion snapshots replay through the transactional compatibility projection', async () => {
      const journal = createJournal();
      const portion: WirdPortion = {
        id: 's1_a1_a7',
        type: 'passage',
        surahNumber: 1,
        surahName: 'الفاتحة',
        startAyah: 1,
        endAyah: 7,
        pageNumber: 1,
        status: 'recently_memorized',
        lastReviewedDate: '2026-11-06',
        nextDueDate: '2026-11-07',
        intervalDays: 1,
        easeFactor: 2.5,
        repetitionCount: 1,
        mistakesCount: 0,
        history: [],
        createdAt: '2026-11-06T12:00:00.000Z'
      };
      const result = await persistPortionsSnapshot([portion], { journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      assert(result.success && result.mode === 'journal', 'Portion snapshot must commit and replay');
      assert(JSON.stringify(StorageService.getUnifiedPortions()) === JSON.stringify([portion]),
        'The canonical portion archive must match the journal payload');
      assert(StorageService.getRawItem(STORAGE_KEYS.SCHEMA_VERSION) === '2',
        'The canonical schema version must be committed with the portion projection');
      assert(StorageService.getRawItem(STORAGE_KEYS.PORTIONS) !== null &&
        StorageService.getRawItem(STORAGE_KEYS.REVISION) !== null,
        'Both legacy compatibility projections must be preserved in the same local transaction');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'The portion event/outbox pair must be durable before the projection cursor advances');
      journal.close();
    });

    await test('Test results use stable mutation IDs and idempotent journal snapshots', async () => {
      const journal = createJournal();
      const testResult: TestResult = {
        id: 'test-journal-result-001',
        date: '2026-11-06',
        type: 'complete_verse',
        surahName: 'الفاتحة',
        score: 4,
        totalQuestions: 5,
        weakVerses: []
      };
      const first = await persistTestResultSnapshot(testResult, { journal, runExclusive: inlineLock });
      const firstSnapshot = await journal.getSnapshot();
      assert(first.success && first.mode === 'journal', 'A new test result must use the journal');
      assert(firstSnapshot.eventCount === 1 && firstSnapshot.pendingCount === 1 && firstSnapshot.projectionCursor === 1,
        'The test result must commit one durable event/outbox pair before projection');

      const retry = await persistTestResultSnapshot(testResult, { journal, runExclusive: inlineLock });
      const retrySnapshot = await journal.getSnapshot();
      assert(retry.success, 'Retrying the same test result must succeed idempotently');
      assert(retrySnapshot.eventCount === 1 && retrySnapshot.pendingCount === 1,
        'A stable test ID must not create duplicate journal events');
      assert(JSON.stringify(StorageService.getTests()) === JSON.stringify([testResult]),
        'The local test archive must contain exactly one copy of the result');

      const collision = await persistTestResultSnapshot({ ...testResult, score: 1 }, { journal, runExclusive: inlineLock });
      const afterCollision = await journal.getSnapshot();
      assert(!collision.success, 'A reused test ID with different content must be rejected');
      assert(afterCollision.eventCount === 1 && JSON.stringify(StorageService.getTests()) === JSON.stringify([testResult]),
        'A conflicting retry must not overwrite the stored result or append another event');
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
      assert(!result.success && result.queued && result.recoveryBlocked && !result.recoveredPriorEvents, 'A failed projection must report the committed event and blocked recovery');
      assert(!fallbackCalled, 'The local-only fallback must never run after a journal commit');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1, 'The event must remain available for a later recovery attempt');
      assert(snapshot.projectionCursor === 0, 'The cursor must remain before the invalid event');
      assert(StorageService.getPlans().length === 0, 'Invalid data must not overwrite the local archive');

      const laterWrite = await persistPlansSnapshot(PRESET_PLANS, { journal, runExclusive: inlineLock });
      const afterLaterWrite = await journal.getSnapshot();
      assert(!laterWrite.success && !laterWrite.queued && laterWrite.recoveryBlocked && !laterWrite.recoveredPriorEvents,
        'A later snapshot must be blocked while an earlier committed event cannot be replayed');
      assert(afterLaterWrite.eventCount === 1 && afterLaterWrite.projectionCursor === 0,
        'Blocked later writes must not append an event behind an unrecovered snapshot');
      journal.close();
    });

    await test('Recovered prior snapshots block stale writes until the caller refreshes its state', async () => {
      const journal = createJournal();
      await journal.enqueue({
        mutationId: 'crash-before-projection',
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: [] },
        nowMs: 500
      });

      const firstAttempt = await persistPlansSnapshot(PRESET_PLANS, { journal, runExclusive: inlineLock });
      const recovered = await journal.getSnapshot();
      assert(!firstAttempt.success && !firstAttempt.queued && firstAttempt.recoveredPriorEvents && firstAttempt.recoveryBlocked,
        'A write must stop after replay changes the local projection behind the caller');
      assert(recovered.eventCount === 1 && recovered.projectionCursor === 1,
        'Recovery must advance the old event cursor without appending the stale new snapshot');
      assert(StorageService.getPlans().length === 0, 'The recovered prior snapshot must be visible locally');

      const retryAfterRefresh = await persistPlansSnapshot(PRESET_PLANS, { journal, runExclusive: inlineLock });
      assert(retryAfterRefresh.success, 'A fresh caller snapshot may be committed after prior recovery');
      assert(JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS),
        'The fresh snapshot must replace the recovered projection after retry');
      journal.close();
    });

    await test('Authenticated browsers without IndexedDB retain local-only persistence', async () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
      try {
        Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
        StorageService.__resetStorageForTests();
        StorageService.setStorageScope('user:local-only-browser');
        const result = await persistPlansSnapshot(PRESET_PLANS);
        assert(result.success && result.mode === 'local-only' && !result.queued,
          'A browser without IndexedDB must retain the local-only storage path');
        assert(JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS),
          'The local-only fallback must preserve the plan snapshot');
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'indexedDB', originalDescriptor);
        else delete (globalThis as any).indexedDB;
      }
    });

    await test('An IndexedDB enqueue failure never falls back to a local-only write', async () => {
      const journal = {
        getProjectionCursor: async () => 0,
        listEventsAfter: async () => [],
        enqueue: async () => { throw new Error('simulated IndexedDB quota failure'); },
        close: () => undefined
      } as unknown as IndexedDbSyncJournal;
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:enqueue-failure');
      let fallbackCalled = false;
      const result = await persistJournaledSnapshot({
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: PRESET_PLANS }
      }, () => { fallbackCalled = true; return StorageService.savePlans(PRESET_PLANS); },
      { journal, runExclusive: inlineLock });
      assert(!result.success && !result.queued && !result.recoveryBlocked,
        'An enqueue failure must be reported without claiming a queued event');
      assert(!fallbackCalled && StorageService.getPlans().length === 0,
        'The local archive must remain untouched when IndexedDB cannot commit the event');
    });

    await test('Grouped transaction retries reuse one stable journal identity', async () => {
      const journal = createJournal();
      const operations = [
        { collection: 'profile' as const, documentId: 'main', operation: 'upsert' as const,
          payload: { profile: { ...CLEAN_INITIAL_PROFILE, name: 'إعادة محاولة ذرية' } } },
        { collection: 'plans' as const, documentId: 'snapshot', operation: 'upsert' as const,
          payload: { records: PRESET_PLANS } }
      ];
      const first = await persistJournaledTransaction(
        operations, { journal, runExclusive: inlineLock }, 'grouped-stable-retry-001'
      );
      const retry = await persistJournaledTransaction(
        operations, { journal, runExclusive: inlineLock }, 'grouped-stable-retry-001'
      );
      const snapshot = await journal.getSnapshot();
      assert(first.success && retry.success, 'The original grouped write and its retry must both succeed');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'Reusing one mutation ID must not create a second event or outbox record');
      journal.close();
    });

    await test('Weak-verse preparation rejects an inconsistent canonical archive before enqueue', async () => {
      const journal = createJournal();
      const corrupt = '{broken canonical portions';
      StorageService.setRawItem(STORAGE_KEYS.SCHEMA_VERSION, '2');
      StorageService.setRawItem(STORAGE_KEYS.UNIFIED_PORTIONS, corrupt);
      const prepared = buildWeakVerseFailureTransaction({
        surahNumber: 67, surahName: 'الملك', ayahNumber: 8, text: 'نص اختبار'
      }, 'weak-corrupt-preflight-001');
      const snapshot = await journal.getSnapshot();
      assert(!prepared.success, 'An inconsistent canonical archive must block preparation');
      assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
        'A corrupt source archive must not create a permanently blocked journal event');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === corrupt,
        'The original corrupt canonical bytes must remain unchanged');
      journal.close();
    });

    await test('Weak-verse preparation refuses enqueue when durable storage reads are unavailable', async () => {
      const journal = createJournal();
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: () => { throw new Error('simulated durable read failure'); },
          setItem: () => { throw new Error('simulated durable write failure'); },
          removeItem: () => { throw new Error('simulated durable remove failure'); }
        }
      });
      try {
        const prepared = buildWeakVerseFailureTransaction({
          surahNumber: 67, surahName: 'الملك', ayahNumber: 8, text: 'نص اختبار'
        }, 'weak-storage-unavailable-001');
        const snapshot = await journal.getSnapshot();
        assert(!prepared.success, 'Unavailable durable reads must block weak-verse preparation');
        assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
          'A storage-read failure must not queue an event that cannot be projected');
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete (globalThis as any).localStorage;
        journal.close();
      }
    });

    await test('Weak-verse failure commits its canonical portion and counter in one journal event', async () => {
      const journal = createJournal();
      const mutationId = 'weak-failure-journal-001';
      const prepared = buildWeakVerseFailureTransaction({
        surahNumber: 67,
        surahName: 'اسم غير معتمد',
        ayahNumber: 8,
        text: 'نص آية للاختبار',
        notes: 'اختبار تسجيل متعثر'
      }, mutationId);
      if (!prepared.success) throw new Error(prepared.messageAr);
      assert(RetentionService.getPortions().length === 0 && RetentionService.getWeakVerses().length === 0,
        'Preparing the action must not mutate either local archive');

      const result = await persistJournaledTransaction(
        prepared.operations, { journal, runExclusive: inlineLock }, mutationId
      );
      const retry = await persistJournaledTransaction(
        prepared.operations, { journal, runExclusive: inlineLock }, mutationId
      );
      const snapshot = await journal.getSnapshot();
      const portion = RetentionService.getPortions().find(item =>
        item.surahNumber === 67 && item.startAyah === 8 && item.endAyah === 8
      );
      const weakVerse = RetentionService.getWeakVerses().find(item =>
        item.surahNumber === 67 && item.ayahNumber === 8
      );
      assert(result.success && retry.success && result.mode === 'journal', 'The weak-verse action and its retry must persist through the journal');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'Both archives must share one event/outbox pair and one cursor step');
      assert(portion?.status === 'weak' && portion.mistakesCount === 1,
        'The canonical portion must record the weak status and mistake count');
      assert(weakVerse?.surahName === 'الملك' && weakVerse.mistakeCount === 1 &&
        weakVerse.text === 'نص آية للاختبار',
        'The weak-verse counter must use canonical Surah metadata and preserve the supplied verse text');
      journal.close();
    });

    await test('Grouped profile and plan projections commit as one journal event', async () => {
      const journal = createJournal();
      const profile = { ...CLEAN_INITIAL_PROFILE, name: 'مجموعة ذرية' };
      const result = await persistJournaledTransaction([
        { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile } },
        { collection: 'plans', documentId: 'snapshot', operation: 'upsert', payload: { records: PRESET_PLANS } }
      ], { journal, runExclusive: inlineLock }, 'grouped-profile-plans-001');
      const snapshot = await journal.getSnapshot();
      assert(result.success && result.mode === 'journal', 'Grouped transaction must commit and project');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'All child projections must share one durable event/outbox pair and one cursor step');
      assert(StorageService.getProfile().name === profile.name, 'The profile projection must be applied');
      assert(JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS),
        'The plans projection must be applied in the same transaction');
      journal.close();
    });

    await test('A failed child projection rolls back every earlier child projection', async () => {
      const journal = createJournal();
      const originalProfile = { ...CLEAN_INITIAL_PROFILE, name: 'قبل المعاملة' };
      assert(StorageService.saveProfile(originalProfile), 'Test setup must persist the original profile');
      assert(StorageService.savePlans(PRESET_PLANS), 'Test setup must persist the original plans');
      const result = await persistJournaledTransaction([
        { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: { ...originalProfile, name: 'بعد المعاملة' } } },
        { collection: 'plans', documentId: 'snapshot', operation: 'upsert', payload: { records: [{ id: 'invalid-plan' }] } }
      ], { journal, runExclusive: inlineLock }, 'grouped-rollback-001');
      const snapshot = await journal.getSnapshot();
      assert(!result.success && result.queued && result.recoveryBlocked,
        'A failed grouped projection must leave its event pending for recovery');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 0,
        'The journal cursor must not advance after a child projection failure');
      assert(StorageService.getProfile().name === originalProfile.name,
        'The first child profile write must be rolled back');
      assert(JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS),
        'The original plan archive must remain unchanged');
      journal.close();
    });

    await test('Grouped guest writes remain local-only but retain rollback-safe projection', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('guest');
      const profile = { ...CLEAN_INITIAL_PROFILE, name: 'زائر' };
      const result = await persistJournaledTransaction([
        { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile } },
        { collection: 'plans', documentId: 'snapshot', operation: 'upsert', payload: { records: PRESET_PLANS } }
      ]);
      assert(result.success && result.mode === 'local-only' && !result.queued,
        'Guest grouped writes must not require IndexedDB');
      assert(StorageService.getProfile().name === profile.name &&
        JSON.stringify(StorageService.getPlans()) === JSON.stringify(PRESET_PLANS),
        'Guest grouped projections must apply together');
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
