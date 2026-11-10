import { PRESET_PLANS } from '../data/presetPlans';
import {
  DEMO_LOGS,
  DEMO_PROFILE,
  StorageService,
  createJournalSnapshotFingerprint,
  buildDemoEnginePlan,
  type JournalProjectionOperation
} from './storageService';
import { DEFAULT_PORTIONS, DEFAULT_WEAK_VERSES } from './retentionService';
import { createCanonicalPortionId } from './unifiedPortionService';
import { createSecureId } from './secureId';
import { persistJournaledTransaction, type JournaledSnapshotOptions } from './journaledSnapshotService';

/**
 * Development-only demo fixture. All affected archives are committed as one
 * recoverable journal transaction for authenticated users and one rollback-safe
 * local transaction for guests. This helper intentionally does not write any
 * archive directly.
 */
export function loadDemoDataJournaled(
  options: JournaledSnapshotOptions = {}
) {
  const baseWeakVersesFingerprint = createJournalSnapshotFingerprint(StorageService.getWeakVerses());
  const baseLogsFingerprint = createJournalSnapshotFingerprint(StorageService.getLogs());
  const canonicalPortions = DEFAULT_PORTIONS.map(portion => ({
    ...portion,
    id: createCanonicalPortionId(portion.surahNumber, portion.startAyah, portion.endAyah)
  }));

  const operations: JournalProjectionOperation[] = [
    { collection: 'profile', documentId: 'demo-profile', operation: 'upsert', payload: { profile: { ...DEMO_PROFILE } } },
    { collection: 'plans', documentId: 'demo-plans', operation: 'upsert', payload: { records: PRESET_PLANS.map(plan => ({ ...plan })) } },
    { collection: 'enginePlans', documentId: 'demo-engine-plans', operation: 'upsert', payload: { records: [buildDemoEnginePlan()] } },
    { collection: 'portions', documentId: 'demo-portions', operation: 'upsert', payload: { records: canonicalPortions } },
    { collection: 'weakVerses', documentId: 'demo-weak-verses', operation: 'upsert', payload: { records: DEFAULT_WEAK_VERSES.map(item => ({ ...item })), baseSnapshotFingerprint: baseWeakVersesFingerprint } },
    { collection: 'activityEvents', documentId: 'demo-activity', operation: 'upsert', payload: { records: DEMO_LOGS.map(log => ({ ...log, completedTasks: [...log.completedTasks] })), baseSnapshotFingerprint: baseLogsFingerprint } }
  ];

  return persistJournaledTransaction(
    operations,
    options,
    'demo-load-' + createSecureId()
  );
}
