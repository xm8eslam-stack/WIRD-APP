import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { CLEAN_INITIAL_PROFILE, STORAGE_KEYS, StorageService } from './storageService';
import type { PortionStatusRecord, WirdPortion, TestResult } from '../types/quran';
import { PRESET_PLANS } from '../data/presetPlans';
import { RetentionService } from './retentionService';
import { persistJournaledSessionCompletion } from './sessionPersistence';
import { loadDemoDataJournaled } from './demoDataPersistence';
import { migrateLegacyPortionsJournaled } from './backupPersistence';
import type { WirdDomainEvent } from './domainEvents';
import { buildWeakVerseFailureTransaction, buildWeakVerseResolutionSnapshot } from './weakVerseRecording';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import {
  persistEnginePlansSnapshot,
  persistJournaledSnapshot,
  persistJournaledTransaction,
  persistPlansSnapshot,
  persistPortionsSnapshot,
  persistProfileSnapshot,
  persistRuqyahProgressSnapshot,
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
    await test('Ruqyah progress commits to the journal and projects into the active account', async () => {
      const journal = createJournal();
      const snapshot = { schemaVersion: 1 as const, updatedAtMs: 1_800_000_000_000, counts: { 'q-fatiha': 7, 'dua-pain': 3 } };
      const result = await persistRuqyahProgressSnapshot(snapshot, { journal, runExclusive: inlineLock });
      const journalState = await journal.getSnapshot();
      const events = await journal.listEvents();
      const stored = StorageService.getRuqyahProgressSnapshot();
      assert(result.success && result.mode === 'journal' && result.queued,
        'Authenticated Ruqyah progress must be persisted through the durable journal');
      assert(journalState.eventCount === 1 && journalState.pendingCount === 1 && journalState.projectionCursor === 1,
        'Progress must have one recoverable journal event and outbox mutation');
      assert(events[0]?.collection === 'ruqyahProgress' && events[0]?.documentId === 'snapshot',
        'The event must use the dedicated Ruqyah progress collection and stable snapshot document');
      assert(JSON.stringify(stored?.counts) === JSON.stringify(snapshot.counts),
        'The validated local projection must match the committed progress snapshot');
      journal.close();
    });

    await test('Remote Ruqyah progress projection validates payloads and participates in first-sync protection', () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:ruqyah-remote-projection-test');
      const valid = { schemaVersion: 1 as const, updatedAtMs: 1_800_000_000_000, counts: { 'q-fatiha': 4 } };
      assert(StorageService.isLocalProjectionEmpty('ruqyahProgress'), 'An absent progress archive must be empty');
      assert(StorageService.applyJournalProjection('ruqyahProgress', { snapshot: valid }),
        'A valid remote progress snapshot must project into local storage');
      assert(!StorageService.isLocalProjectionEmpty('ruqyahProgress'),
        'A non-empty progress archive must block an unknown first-sync overwrite');
      const before = StorageService.getRawItem(STORAGE_KEYS.RUQYAH_PROGRESS);
      assert(!StorageService.applyJournalProjection('ruqyahProgress', { snapshot: { schemaVersion: 1, updatedAtMs: -1, counts: { 'q-fatiha': 4 } } }),
        'Malformed remote progress must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.RUQYAH_PROGRESS) === before,
        'Rejecting malformed remote progress must preserve existing local bytes');
    });

    await test('Demo data loads as one journaled grouped projection and is not partially applied', async () => {
      const journal = createJournal();
      const result = await loadDemoDataJournaled({ journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      const event = events[0];
      assert(result.success && result.mode === 'journal' && result.queued,
        'Authenticated demo data must commit through the IndexedDB journal');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'All demo projections must share one atomic journal/outbox event');
      assert(StorageService.getPlans().length > 0 && StorageService.getEnginePlans().length === 1,
        'Demo plans and the engine plan must be projected');
      assert(RetentionService.getPortions().length > 0 && RetentionService.getWeakVerses().length > 0,
        'Canonical demo portions and weak verses must be projected');
      assert(StorageService.getLogs().length > 0 && StorageService.getProfile().name.includes('تجريبي'),
        'Demo activity and profile must be projected');
      assert(event?.collection === 'syncMeta' && event.projectionRequired !== false,
        'Demo data must be recoverable from the append-only journal event');
      journal.close();
    });

    await test('Demo fixture quota failure restores every prior archive and leaves one recoverable event', async () => {
      const journal = createJournal();
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      const values = new Map<string, string>();
      let quotaThrown = false;
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => {
            if (!quotaThrown && key.endsWith(STORAGE_KEYS.WEAK_VERSES)) {
              quotaThrown = true;
              const error = new Error('simulated browser storage quota exceeded');
              error.name = 'QuotaExceededError';
              throw error;
            }
            values.set(key, value);
          },
          removeItem: (key: string) => values.delete(key)
        }
      });
      try {
        const result = await loadDemoDataJournaled({ journal, runExclusive: inlineLock });
        const snapshot = await journal.getSnapshot();
        assert(!result.success && result.queued && result.recoveryBlocked,
          'A quota failure after earlier demo projections must leave the journal event pending');
        assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 0,
          'A failed demo projection must not advance the journal cursor');
        assert(values.size === 0,
          'The profile, plans, engine plans, canonical portions, and weak-verse archives must all roll back');
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete (globalThis as any).localStorage;
        journal.close();
      }
    });

    await test('Demo fixture remains available to guests through one local rollback-safe transaction', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('guest');
      const result = await loadDemoDataJournaled();
      assert(result.success && result.mode === 'local-only' && !result.queued,
        'Guest demo data must not require IndexedDB or enqueue cloud mutations');
      assert(StorageService.getPlans().length > 0 && StorageService.getEnginePlans().length === 1 &&
        RetentionService.getPortions().length > 0 && RetentionService.getWeakVerses().length > 0 &&
        StorageService.getLogs().length > 0,
        'Guest demo data must apply all local projections together');
    });

    await test('Profile reads compute streak display state without bypassing the journal', async () => {
      const journal = createJournal();
      const staleProfile = { ...CLEAN_INITIAL_PROFILE, name: 'قارئ قديم', streakDays: 99, lastActiveDate: '2000-01-01' };
      const originalBytes = JSON.stringify(staleProfile);
      assert(StorageService.setRawItem(STORAGE_KEYS.PROFILE, originalBytes), 'Stale profile fixture must persist');
      const readProfile = StorageService.getProfile();
      const snapshot = await journal.getSnapshot();
      assert(readProfile.streakDays !== 99, 'The displayed streak must be calculated from its last active date');
      assert(StorageService.getRawItem(STORAGE_KEYS.PROFILE) === originalBytes,
        'Reading the profile must not directly rewrite its durable archive');
      assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
        'A profile getter must never create a mutation outside the journal');
      journal.close();
    });

    await test('Legacy portion migration is read-only during access and commits through one journal event', async () => {
      const journal = createJournal();
      const legacyPortion: PortionStatusRecord = {
        id: 'legacy-portion-before-journal',
        type: 'passage',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 3,
        status: 'stable',
        nextDueDate: '2026-11-06',
        intervalDays: 3,
        easeFactor: 2.5,
        repetitionCount: 2
      };
      const legacyRaw = JSON.stringify([legacyPortion]);
      assert(StorageService.setRawItem(STORAGE_KEYS.SCHEMA_VERSION, '1'), 'Legacy schema version must seed');
      assert(StorageService.setRawItem(STORAGE_KEYS.PORTIONS, legacyRaw), 'Legacy portions must seed');
      assert(StorageService.setRawItem(STORAGE_KEYS.REVISION, '[]'), 'Legacy revisions must seed');

      const readOnlySnapshot = StorageService.getUnifiedPortions();
      assert(readOnlySnapshot.length === 1 && readOnlySnapshot[0].id === 's67_a1_a3',
        'A read-only getter may return a validated migration view');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === null &&
        StorageService.getRawItem(STORAGE_KEYS.SCHEMA_VERSION) === '1',
        'Reading legacy portions must not write canonical data or advance the schema version');

      const migration = await migrateLegacyPortionsJournaled({ journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      const events = await journal.listEvents();
      assert(migration.success && migration.migrated && migration.queued !== false,
        'Legacy migration must commit through the authenticated journal boundary');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'Legacy migration must create one recoverable journal/outbox transaction');
      assert(StorageService.getRawItem(STORAGE_KEYS.SCHEMA_VERSION) === '2' &&
        StorageService.getUnifiedPortions()[0]?.id === 's67_a1_a3',
        'Canonical schema and migrated portions must be projected after journal commit');
      assert(events.length === 1 && events[0].collection === 'syncMeta',
        'The migration must be represented by one append-only grouped journal event');
      journal.close();
    });

    await test('Corrupt canonical portions recover from validated legacy data only through journal replay', async () => {
      const journal = createJournal();
      const legacyPortion: PortionStatusRecord = {
        id: 'legacy-portion-recovery',
        type: 'passage',
        surahNumber: 112,
        surahName: 'الإخلاص',
        startAyah: 1,
        endAyah: 4,
        status: 'stable',
        nextDueDate: '2026-11-06',
        intervalDays: 14,
        easeFactor: 2.8,
        repetitionCount: 10
      };
      const invalidCanonical = JSON.stringify([{ ...legacyPortion, id: 's112_a1_a99', endAyah: 99 }]);
      assert(StorageService.setRawItem(STORAGE_KEYS.SCHEMA_VERSION, '2'), 'Corrupt canonical schema version must seed');
      assert(StorageService.setRawItem(STORAGE_KEYS.UNIFIED_PORTIONS, invalidCanonical), 'Corrupt canonical bytes must seed');
      assert(StorageService.setRawItem(STORAGE_KEYS.PORTIONS, JSON.stringify([legacyPortion])), 'Validated recovery source must seed');
      assert(StorageService.setRawItem(STORAGE_KEYS.REVISION, '[]'), 'Empty legacy revision archive must seed');

      const readOnly = StorageService.getUnifiedPortions();
      assert(readOnly.length === 1 && readOnly[0].id === 's112_a1_a4',
        'Read-only access must prepare a lossless view from the valid legacy recovery source');
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === invalidCanonical,
        'The invalid canonical archive must remain byte-for-byte unchanged until journal commit');

      const migration = await migrateLegacyPortionsJournaled({ journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      assert(migration.success && migration.migrated && snapshot.projectionCursor === 1,
        'A validated legacy recovery must replace the corrupt canonical archive only after journal commit');
      assert(StorageService.getUnifiedPortions()[0]?.id === 's112_a1_a4',
        'The canonical archive must contain the recovered Quran coordinates');
      journal.close();
    });

    await test('Guest legacy portion migration remains local-only and does not require IndexedDB', async () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('guest');
      const legacyPortion: PortionStatusRecord = {
        id: 'legacy-guest-migration',
        type: 'passage',
        surahNumber: 109,
        surahName: 'الكافرون',
        startAyah: 1,
        endAyah: 6,
        status: 'stable',
        nextDueDate: '2026-11-06',
        intervalDays: 7,
        easeFactor: 2.6,
        repetitionCount: 3
      };
      StorageService.setRawItem(STORAGE_KEYS.SCHEMA_VERSION, '1');
      StorageService.setRawItem(STORAGE_KEYS.PORTIONS, JSON.stringify([legacyPortion]));
      StorageService.setRawItem(STORAGE_KEYS.REVISION, '[]');
      const result = await migrateLegacyPortionsJournaled();
      assert(result.success && result.migrated && !result.queued,
        'Guest migration must commit locally without an IndexedDB/cloud outbox');
      assert(StorageService.getUnifiedPortions()[0]?.id === 's109_a1_a6',
        'Guest migration must expose the canonical Quran range after the local commit');
    });

    await test('Legacy migration refuses to enqueue when durable storage reads are unavailable', async () => {
      const journal = createJournal();
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: () => { throw new Error('simulated legacy migration read failure'); },
          setItem: () => { throw new Error('simulated legacy migration write failure'); },
          removeItem: () => { throw new Error('simulated legacy migration remove failure'); }
        }
      });
      try {
        const result = await migrateLegacyPortionsJournaled({ journal, runExclusive: inlineLock });
        const snapshot = await journal.getSnapshot();
        assert(!result.success, 'A failed durable source read must stop migration');
        assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
          'Migration must not enqueue an event when the source archive could not be read reliably');
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete (globalThis as any).localStorage;
        journal.close();
      }
    });

    await test('Legacy migration aborts if the active account scope changes while waiting for the journal lock', async () => {
      const journal = createJournal();
      const originalScope = StorageService.getStorageScope();
      const legacyPortion: PortionStatusRecord = {
        id: 'legacy-scope-switch',
        type: 'passage',
        surahNumber: 110,
        surahName: 'النصر',
        startAyah: 1,
        endAyah: 3,
        status: 'stable',
        nextDueDate: '2026-11-06',
        intervalDays: 7,
        easeFactor: 2.5,
        repetitionCount: 1
      };
      StorageService.setRawItem(STORAGE_KEYS.SCHEMA_VERSION, '1');
      StorageService.setRawItem(STORAGE_KEYS.PORTIONS, JSON.stringify([legacyPortion]));
      StorageService.setRawItem(STORAGE_KEYS.REVISION, '[]');
      try {
        const result = await migrateLegacyPortionsJournaled({
          journal,
          runExclusive: async <T>(_name: string, task: () => Promise<T>) => {
            StorageService.setStorageScope('user:another-account');
            return task();
          }
        });
        const snapshot = await journal.getSnapshot();
        assert(!result.success, 'A migration must stop when its captured account scope is no longer active');
        assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
          'A scope change before enqueue must not create a journal event for the wrong account');
      } finally {
        StorageService.setStorageScope(originalScope);
        journal.close();
      }
    });

    await test('Memorization session completion commits progress, activity, and streak in one journal event', async () => {
      const journal = createJournal();
      const today = new Date().toISOString().slice(0, 10);
      StorageService.saveProfile({ ...CLEAN_INITIAL_PROFILE, lastActiveDate: today, streakDays: 0 });
      const initial = RetentionService.addPortion({
        type: 'passage', surahNumber: 67, surahName: 'الملك', startAyah: 1, endAyah: 5,
        status: 'currently_memorizing', nextDueDate: today, intervalDays: 1, easeFactor: 2.5,
        repetitionCount: 0, mistakesCount: 0
      });
      const result = await persistJournaledSessionCompletion({
        mode: 'memorize', memorizedAyahs: 5, reviewedPages: 0, minutes: 6,
        taskName: 'جلسة حفظ اختبار', surahNumber: 67, startAyah: 1, endAyah: 5
      }, { journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      const journalEvents = await journal.listEvents();
      const storedDomainEvent = (journalEvents[0]?.payload as Record<string, unknown> | undefined)?.domainEvent as WirdDomainEvent | undefined;
      const updated = RetentionService.getPortions().find(item => item.id === initial.id);
      assert(result.success, 'A valid memorization session must complete through the journal');
      assert(updated?.status === 'recently_memorized' && updated.repetitionCount === 1,
        'The memorization progress projection must be applied');
      assert(StorageService.getLogs().length === 1 && StorageService.getLogs()[0].memorizedAyahsCount === 5,
        'The activity log must be committed with the progress');
      assert(StorageService.getProfile().streakDays === 1,
        'The profile streak must be committed with the activity');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'Progress, activity, and profile must share one durable event/outbox pair');
      assert(storedDomainEvent !== undefined && storedDomainEvent.type === 'session.completed' && storedDomainEvent.id.startsWith('session-'),
        'The journal envelope must retain a typed, immutable session-completed domain event');
      const storedOccurredAt = storedDomainEvent?.occurredAt;
      assert(typeof storedOccurredAt === 'string' && storedOccurredAt === new Date(storedOccurredAt).toISOString(),
        'Session domain-event timestamps must be stable ISO timestamps');
      journal.close();
    });

    await test('Session completion includes the matching smart-plan snapshot in the same journal event', async () => {
      const journal = createJournal();
      const result = await persistJournaledSessionCompletion({
        mode: 'review', memorizedAyahs: 0, reviewedPages: 1, minutes: 4,
        taskName: 'مراجعة اختبار مع الخطة', enginePlansSnapshot: []
      }, { journal, runExclusive: inlineLock });
      const snapshot = await journal.getSnapshot();
      assert(result.success, 'A review session with a smart-plan projection must persist');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'The activity/profile and smart-plan projections must share one event/outbox transaction');
      assert(StorageService.getEnginePlans().length === 0,
        'The empty smart-plan snapshot must be projected without creating a second journal event');
      journal.close();
    });

    await test('Grouped journal transactions reject mismatched domain-event identities before enqueue', async () => {
      const journal = createJournal();
      const mutationId = 'transaction-event-identity';
      const domainEvent: WirdDomainEvent = {
        schemaVersion: 1,
        id: 'different-mutation-id',
        type: 'session.completed',
        occurredAt: new Date().toISOString(),
        payload: { mode: 'review', memorizedAyahs: 0, reviewedPages: 1, minutes: 2, taskName: 'اختبار', includesSmartPlanProjection: false }
      };
      const result = await persistJournaledTransaction([
        { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: { ...CLEAN_INITIAL_PROFILE } } }
      ], { journal, runExclusive: inlineLock }, mutationId, domainEvent);
      const snapshot = await journal.getSnapshot();
      assert(!result.success, 'Mismatched event identity must be rejected');
      assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
        'Invalid domain event must not enter the journal or outbox');
      journal.close();
    });

    await test('Domain event payload validation rejects malformed semantic fields before enqueue', async () => {
      const journal = createJournal();
      const mutationId = 'invalid-domain-event-payload';
      const domainEvent: WirdDomainEvent = {
        schemaVersion: 1,
        id: mutationId,
        type: 'session.completed',
        occurredAt: new Date().toISOString(),
        payload: { mode: 'review', memorizedAyahs: -1, reviewedPages: 1, minutes: 2, taskName: 'اختبار', includesSmartPlanProjection: false }
      };
      const result = await persistJournaledTransaction([
        { collection: 'profile', documentId: 'main', operation: 'upsert', payload: { profile: { ...CLEAN_INITIAL_PROFILE } } }
      ], { journal, runExclusive: inlineLock }, mutationId, domainEvent);
      const snapshot = await journal.getSnapshot();
      assert(!result.success, 'Negative activity counters must fail semantic validation');
      assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
        'Malformed domain event payloads must never enter the durable journal');
      journal.close();
    });

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
      const testJournalEvents = await journal.listEvents();
      const testDomainEvent = (testJournalEvents[0]?.payload as Record<string, unknown> | undefined)?.domainEvent as WirdDomainEvent | undefined;
      assert(first.success && first.mode === 'journal', 'A new test result must use the journal');
      assert(testDomainEvent?.type === 'test.completed' && testDomainEvent.id === 'test-' + testResult.id,
        'Test result journal entries must include a stable typed completion event');
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

    await test('Independent test-result snapshots merge without losing either device result', () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:test-results-two-device-merge');
      const deviceA: TestResult = {
        id: 'device-a-result', date: '2026-11-08', type: 'complete_verse',
        surahName: 'الفاتحة', score: 4, totalQuestions: 5, weakVerses: []
      };
      const deviceB: TestResult = {
        id: 'device-b-result', date: '2026-11-09', type: 'order_words',
        surahName: 'البقرة', score: 3, totalQuestions: 4, weakVerses: []
      };
      assert(StorageService.applyJournalProjection('tests', { records: [deviceA] }),
        'The first device result must project');
      assert(StorageService.applyJournalProjection('tests', { records: [deviceB] }),
        'A second device snapshot must merge instead of replacing the first device result');
      const merged = StorageService.getTests();
      assert(merged.length === 2 && merged.some(item => item.id === deviceA.id) &&
        merged.some(item => item.id === deviceB.id),
        'Both independent test results must remain in the local archive');
      assert(StorageService.matchesJournalProjection('tests', { records: [deviceA] }),
        'Recovery matching must recognize a snapshot already applied through a safe merge');
    });

    await test('Conflicting content for an existing test-result ID fails closed', () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:test-results-id-collision');
      const original: TestResult = {
        id: 'same-result-id', date: '2026-11-08', type: 'complete_verse',
        surahName: 'الفاتحة', score: 4, totalQuestions: 5, weakVerses: []
      };
      assert(StorageService.applyJournalProjection('tests', { records: [original] }),
        'The original result must project');
      const before = StorageService.getRawItem(STORAGE_KEYS.TESTS);
      assert(!StorageService.applyJournalProjection('tests', {
        records: [{ ...original, score: 1 }]
      }), 'A duplicate ID with different content must be rejected');
      assert(StorageService.getRawItem(STORAGE_KEYS.TESTS) === before,
        'A conflicting duplicate must preserve the original archive byte-for-byte');
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

    await test('Grouped per-result test projection preserves document scope during apply and recovery', () => {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:grouped-test-document-scope');
      const existing: TestResult = {
        id: 'existing-device-result', date: '2026-11-08', type: 'complete_verse',
        surahName: 'الفاتحة', score: 4, totalQuestions: 5, weakVerses: []
      };
      const incoming: TestResult = {
        id: 'grouped-device-result', date: '2026-11-09', type: 'order_words',
        surahName: 'البقرة', score: 3, totalQuestions: 4, weakVerses: []
      };
      assert(StorageService.saveTests([existing]), 'The pre-existing device result must seed the local archive');
      const operation = {
        collection: 'tests' as const,
        documentId: incoming.id,
        operation: 'upsert' as const,
        payload: { records: [incoming] }
      };
      assert(StorageService.applyJournalTransaction([operation]),
        'A grouped per-result operation must use its document ID and merge the new immutable result');
      const merged = StorageService.getTests();
      assert(merged.length === 2 && merged.some(item => item.id === existing.id) &&
        merged.some(item => item.id === incoming.id),
        'Grouped per-result projection must preserve the existing result from the other device');
      assert(StorageService.matchesJournalProjection('syncMeta', {
        transaction: { version: 1, operations: [operation] }
      }), 'Recovery must recognize the grouped per-result merge as already applied');

      const authoritativeSnapshot = {
        transaction: {
          version: 1,
          operations: [{
            ...operation,
            documentId: 'snapshot',
            payload: { records: [incoming] }
          }]
        }
      };
      assert(!StorageService.matchesJournalProjection('syncMeta', authoritativeSnapshot),
        'Recovery must not mistake a merged per-result archive for an applied authoritative snapshot');
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

      const weakEvent: WirdDomainEvent = {
        schemaVersion: 1,
        id: mutationId,
        type: 'weak_verse.failed',
        occurredAt: '2026-11-06T12:00:00.000Z',
        payload: { surahNumber: 67, ayahNumber: 8, notes: 'اختبار تسجيل متعثر' }
      };
      const result = await persistJournaledTransaction(
        prepared.operations, { journal, runExclusive: inlineLock }, mutationId, weakEvent
      );
      const retry = await persistJournaledTransaction(
        prepared.operations, { journal, runExclusive: inlineLock }, mutationId, weakEvent
      );
      const snapshot = await journal.getSnapshot();
      const weakJournalEvents = await journal.listEvents();
      const weakDomainEvent = (weakJournalEvents[0]?.payload as Record<string, unknown> | undefined)?.domainEvent as WirdDomainEvent | undefined;
      const portion = RetentionService.getPortions().find(item =>
        item.surahNumber === 67 && item.startAyah === 8 && item.endAyah === 8
      );
      const weakVerse = RetentionService.getWeakVerses().find(item =>
        item.surahNumber === 67 && item.ayahNumber === 8
      );
      assert(result.success && retry.success && result.mode === 'journal', 'The weak-verse action and its retry must persist through the journal');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'Both archives must share one event/outbox pair and one cursor step');
      assert(weakDomainEvent?.type === 'weak_verse.failed' && weakDomainEvent.id === mutationId,
        'Weak-verse failure must be represented by an immutable typed domain event');
      assert(portion?.status === 'weak' && portion.mistakesCount === 1,
        'The canonical portion must record the weak status and mistake count');
      assert(weakVerse?.surahName === 'الملك' && weakVerse.mistakeCount === 1 &&
        weakVerse.text === 'نص آية للاختبار',
        'The weak-verse counter must use canonical Surah metadata and preserve the supplied verse text');
      journal.close();
    });

    await test('Weak-verse resolution preserves a corrupt archive and refuses to prepare a mutation', async () => {
      const journal = createJournal();
      const corrupt = '{broken weak-verse archive';
      StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, corrupt);
      const prepared = buildWeakVerseResolutionSnapshot('weak-67-8-existing');
      const snapshot = await journal.getSnapshot();
      assert(!prepared.success, 'A corrupt weak-verse archive must block resolution');
      assert(StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === corrupt,
        'The original corrupt weak-verse bytes must remain unchanged');
      assert(snapshot.eventCount === 0 && snapshot.pendingCount === 0,
        'A corrupt source archive must not create a journal event');
      journal.close();
    });

    await test('Weak-verse resolution is journal-first, idempotent, and leaves portions unchanged', async () => {
      const journal = createJournal();
      const weakVerse = {
        id: 'weak-67-8-existing',
        surahNumber: 67,
        surahName: 'الملك',
        ayahNumber: 8,
        text: 'نص آية للاختبار',
        mistakeCount: 2,
        lastFailedDate: '2026-11-06',
        notes: 'اختبار'
      };
      const beforePortions = JSON.stringify(RetentionService.getPortions());
      assert(RetentionService.saveWeakVerses([weakVerse]), 'The fixture weak-verse record must be valid');
      const prepared = buildWeakVerseResolutionSnapshot(weakVerse.id);
      if (!prepared.success) throw new Error(prepared.messageAr);
      assert(prepared.changed && prepared.records.length === 0, 'Resolving an existing ID must prepare an empty archive');
      assert(RetentionService.getWeakVerses().length === 1,
        'Preparing a resolution must not mutate the weak-verse archive');

      const input = {
        mutationId: 'weak-resolve-journal-001',
        collection: 'weakVerses' as const,
        documentId: 'snapshot',
        operation: 'upsert' as const,
        payload: { records: prepared.records }
      };
      const first = await persistJournaledSnapshot(
        input, () => RetentionService.saveWeakVerses(prepared.records),
        { journal, runExclusive: inlineLock }
      );
      const retry = await persistJournaledSnapshot(
        input, () => RetentionService.saveWeakVerses(prepared.records),
        { journal, runExclusive: inlineLock }
      );
      const snapshot = await journal.getSnapshot();
      assert(first.success && retry.success, 'The resolution and its retry must both succeed');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'The same resolution retry must not create a duplicate journal event');
      assert(RetentionService.getWeakVerses().length === 0, 'The weak-verse record must be removed');
      assert(JSON.stringify(RetentionService.getPortions()) === beforePortions,
        'Resolving a weak verse must not change the canonical portion rating or schedule');
      const repeated = buildWeakVerseResolutionSnapshot(weakVerse.id);
      assert(repeated.success && !repeated.changed,
        'Resolving the same missing ID again must be a no-op');
      journal.close();
    });

    await test('Revision rating prepares pure portion/activity/profile snapshots and persists them as one journal event', async () => {
      const journal = createJournal();
      const today = '2026-11-06';
      const seeded = RetentionService.buildAddPortionSnapshot({
        type: 'passage',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 5,
        pageNumber: 562,
        juzNumber: 29,
        status: 'recently_memorized',
        lastReviewedDate: today,
        nextDueDate: today,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitionCount: 1,
        mistakesCount: 0,
        strength: 'medium'
      });
      assert(StorageService.saveUnifiedPortions(seeded.portions), 'The revision fixture portion must be saved');
      const beforePortions = StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      const beforeLogs = StorageService.getRawItem(STORAGE_KEYS.LOGS);
      const beforeProfile = StorageService.getRawItem(STORAGE_KEYS.PROFILE);
      const mutationId = 'revision-success-journal-001';
      const prepared = RetentionService.buildRevisionPerformanceSnapshot(
        seeded.record.id, 'successful', 'اختبار المراجعة', 3, mutationId
      );
      if (!prepared.success) throw new Error(prepared.messageAr);
      assert(StorageService.getRawItem(STORAGE_KEYS.UNIFIED_PORTIONS) === beforePortions &&
        StorageService.getRawItem(STORAGE_KEYS.LOGS) === beforeLogs &&
        StorageService.getRawItem(STORAGE_KEYS.PROFILE) === beforeProfile,
        'Preparing a revision rating must not write portions, activity, or profile data');

      const revisionEvent: WirdDomainEvent = {
        schemaVersion: 1,
        id: mutationId,
        type: 'revision.rated',
        occurredAt: '2026-11-06T12:00:00.000Z',
        payload: { portionId: seeded.record.id, surahNumber: 67, startAyah: 1, endAyah: 5, rating: 'successful', notes: 'اختبار المراجعة' }
      };
      const first = await persistJournaledTransaction(
        prepared.operations, { journal, runExclusive: inlineLock }, mutationId, revisionEvent
      );
      const retry = await persistJournaledTransaction(
        prepared.operations, { journal, runExclusive: inlineLock }, mutationId, revisionEvent
      );
      const snapshot = await journal.getSnapshot();
      const revisionJournalEvents = await journal.listEvents();
      const revisionDomainEvent = (revisionJournalEvents[0]?.payload as Record<string, unknown> | undefined)?.domainEvent as WirdDomainEvent | undefined;
      const updated = RetentionService.getPortions().find(item => item.id === seeded.record.id);
      const logs = StorageService.getLogs();
      const profile = StorageService.getProfile();
      assert(first.success && retry.success, 'The revision rating and its retry must both succeed');
      assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
        'The revision, activity, and profile projections must share one event and one cursor step');
      assert(revisionDomainEvent?.type === 'revision.rated' && revisionDomainEvent.id === mutationId,
        'Revision ratings must be represented by an immutable typed domain event');
      assert(updated?.history?.[0]?.id === 'log-' + mutationId,
        'The revision history must use a stable ID derived from the mutation ID');
      assert(logs.length === 1 && logs[0].reviewedPagesCount === prepared.reviewedPagesCount &&
        logs[0].minutesSpent === 3,
        'The activity projection must include the reviewed page count and measured minutes');
      assert(profile.streakDays === 1 && profile.lastActiveDate === logs[0].date,
        'The profile streak must advance in the same grouped transaction');
      journal.close();
    });

    await test('Failed revision with a weak ayah groups the range and single-ayah portion without double counting', async () => {
      const journal = createJournal();
      const today = '2026-11-06';
      const seeded = RetentionService.buildAddPortionSnapshot({
        type: 'passage',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 5,
        pageNumber: 562,
        juzNumber: 29,
        status: 'recently_memorized',
        lastReviewedDate: today,
        nextDueDate: today,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitionCount: 1,
        mistakesCount: 0,
        strength: 'medium'
      });
      assert(StorageService.saveUnifiedPortions(seeded.portions), 'The range fixture must be saved');
      const mutationId = 'revision-failed-weak-journal-001';
      const prepared = RetentionService.buildRevisionPerformanceSnapshot(
        seeded.record.id, 'failed', 'اختبار تعثر', 2, mutationId
      );
      if (!prepared.success) throw new Error(prepared.messageAr);
      const weakPrepared = buildWeakVerseFailureTransaction({
        surahNumber: 67,
        surahName: 'الملك',
        ayahNumber: 3,
        text: 'نص آية للاختبار',
        notes: 'اختبار تعثر'
      }, mutationId, prepared.operations[0].payload.records as PortionStatusRecord[]);
      if (!weakPrepared.success) throw new Error(weakPrepared.messageAr);
      const operations = [
        weakPrepared.operations[0],
        weakPrepared.operations[1],
        ...prepared.operations.slice(1)
      ];
      const result = await persistJournaledTransaction(
        operations, { journal, runExclusive: inlineLock }, mutationId
      );
      const snapshot = await journal.getSnapshot();
      const portions = RetentionService.getPortions();
      const rangePortion = portions.find(item => item.id === seeded.record.id);
      const weakPortion = portions.find(item =>
        item.surahNumber === 67 && item.startAyah === 3 && item.endAyah === 3
      );
      const weakVerse = RetentionService.getWeakVerses().find(item => item.surahNumber === 67 && item.ayahNumber === 3);
      assert(result.success && snapshot.eventCount === 1 && snapshot.projectionCursor === 1,
        'A failed review, weak verse, activity, and profile must commit as one journal event');
      assert(rangePortion?.status === 'weak' && rangePortion.mistakesCount === 1,
        'The reviewed range must receive one SM-2 failure increment');
      assert(weakPortion?.status === 'weak' && weakPortion.mistakesCount === 1,
        'A distinct single-ayah weak portion must be created from the updated range snapshot');
      assert(weakVerse?.mistakeCount === 1, 'The weak-verse archive must increment once');
      journal.close();
    });

    await test('Failed review of a single-ayah portion does not double-increment its canonical mistake count', async () => {
      const journal = createJournal();
      const today = '2026-11-06';
      const seeded = RetentionService.buildAddPortionSnapshot({
        type: 'passage',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 3,
        endAyah: 3,
        pageNumber: 562,
        juzNumber: 29,
        status: 'recently_memorized',
        lastReviewedDate: today,
        nextDueDate: today,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitionCount: 1,
        mistakesCount: 0,
        strength: 'medium'
      });
      assert(StorageService.saveUnifiedPortions(seeded.portions), 'The single-ayah fixture must be saved');
      const mutationId = 'revision-single-weak-journal-001';
      const prepared = RetentionService.buildRevisionPerformanceSnapshot(
        seeded.record.id, 'failed', 'اختبار تعثر', 1, mutationId
      );
      if (!prepared.success) throw new Error(prepared.messageAr);
      const weakPrepared = buildWeakVerseFailureTransaction({
        surahNumber: 67,
        surahName: 'الملك',
        ayahNumber: 3,
        text: 'نص آية للاختبار',
        notes: 'اختبار تعثر'
      }, mutationId, prepared.operations[0].payload.records as PortionStatusRecord[]);
      if (!weakPrepared.success) throw new Error(weakPrepared.messageAr);
      const operations = [
        prepared.operations[0],
        weakPrepared.operations[1],
        ...prepared.operations.slice(1)
      ];
      const result = await persistJournaledTransaction(
        operations, { journal, runExclusive: inlineLock }, mutationId
      );
      const updated = RetentionService.getPortions().find(item => item.id === seeded.record.id);
      assert(result.success && updated?.mistakesCount === 1,
        'A failed review of the same single-ayah portion must increment the canonical count only once');
      assert(RetentionService.getWeakVerses().find(item => item.ayahNumber === 3)?.mistakeCount === 1,
        'The separate weak-verse counter must still increment once');
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
