import { runAllPlanningEngineTests } from '../services/planningEngine.test';
import { runAllRetentionTests } from '../services/retentionService.test';
import { runAllAdvisorTests } from '../services/deterministicAdvisor.test';
import { runStreakTests } from './streakCalculations.test';
import { runBackupTests } from './backupValidation.test';
import { runBackupPersistenceTests } from '../services/backupPersistence.test';
import { runCleanInitializationTests } from './cleanInitialization.test';
import { runGeminiSecurityTests } from './geminiSecurity.test';
import { runQuranIntegrityTests } from './quranContentIntegrity.test';
import { runQuranMathValidationTests } from './quranMathValidation.test';
import { runDomainEventCoordinateTests } from './domainEventCoordinateValidation.test';
import { runIndependentTanzilComparison, runNegativeComparisonTests } from './independentTanzilComparison';
import { runPwaIntegrationTests } from './pwaIntegration.test';
import { runFirebaseAuthTests } from './firebaseAuth.test';
import { runPhase3CoreRemediationTests } from './phase3CoreRemediation.test';
import { runQuranLazyLoadingTests } from './quranLazyLoading.test';
import { runMobileErgonomicsTests } from './mobileErgonomics.test';
import { runTafsirServiceTests } from '../services/tafsirService.test';
import { runTafsirProxyTests } from './tafsirProxy.test';
import { runTafsirSanitizerTests } from '../utils/tafsirSanitizer.test';
import { runPageProgressServiceTests } from '../services/pageProgressService.test';
import { runStorageScopeTests } from '../services/storageScope.test';
import { runSessionCompletionTests } from './sessionCompletion.test';
import { runSessionPersistenceTests } from '../services/sessionPersistence.test';
import { runRevisionPersistenceTests } from '../services/revisionPersistence.test';
import { runWeakVerseRecordingTests } from '../services/weakVerseRecording.test';
import { runStorageReliabilityTests } from './storageReliability.test';
import { runLocalSyncOutboxTests } from '../services/localSyncOutbox.test';
import { runIndexedDbSyncJournalTests } from '../services/indexedDbSyncJournal.test';
import { runJournalProjectionReplayerTests } from '../services/journalProjectionReplayer.test';
import { runJournaledSnapshotServiceTests } from '../services/journaledSnapshotService.test';
import { runSecureIdTests } from '../services/secureId.test';
import { runUniqueRetentionScoreTests } from './uniqueRetentionScore.test';
import { runDailySessionSelectionTests } from '../services/dailySessionSelection.test';
import { runPlanRangeSelectionTests } from './planRangeSelection.test';
import { runAudioPreferencesTests } from '../services/audioPreferences.test';
import { runQuranMushafReaderTests } from './quranMushafReader.test';
import { runCloudSyncCoordinatorTests } from '../services/cloudSyncCoordinator.test';
import { runRuqyahIntegrityTests } from './ruqyahIntegrity.test';
import { runRuqyahContentServiceTests } from '../services/ruqyahContentService.test';
import { runRuqyahProxyTests } from './ruqyahProxy.test';
import { runRuqyahAudioServiceTests } from './ruqyahAudioService.test';
import { runRuqyahProgressServiceTests } from '../services/ruqyahProgressService.test';
import { runRuqyahApiServiceTests } from '../services/ruqyahApiService.test';

export interface SuiteResult {
  passed: number;
  failed: number;
}

export type SuiteRunner = () => SuiteResult | Promise<SuiteResult>;

export async function executeSuiteAggregation(
  suites: Array<{ name: string; runner: SuiteRunner }>
): Promise<SuiteResult> {
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`\n▶ [SUITE]: ${suite.name}`);
    try {
      const { passed, failed } = await suite.runner();
      totalPassed += passed;
      totalFailed += failed;
      console.log(`  Summary: ${passed} Passed, ${failed} Failed`);
    } catch (err: any) {
      // A rejected asynchronous suite is recorded as a failure and does not stop the run.
      totalFailed++;
      console.error(`  ❌ [CRITICAL SUITE FAILURE]: ${suite.name} rejected with error:`, err?.message || err);
    }
  }

  return { passed: totalPassed, failed: totalFailed };
}

export function evaluateTestResults(passed: number, failed: number): number {
  console.log('\n====================================================');
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');
  return failed > 0 ? 1 : 0;
}

async function main() {
  console.log('====================================================');
  console.log('   WIRD | وِرد — Automated Quality & Integrity Suite');
  console.log('====================================================\n');

  const suites = [
    { name: 'Planning Engine Math & Task Distribution', runner: () => runAllPlanningEngineTests() },
    { name: 'Retention & Spaced Revision Engine', runner: () => runAllRetentionTests() },
    { name: 'Deterministic Advisor Engine (Offline AI Fallback)', runner: () => runAllAdvisorTests() },
    { name: 'Truthful Daily Streak Engine (Phase 3)', runner: runStreakTests },
    { name: 'Backup Schema Validation & Atomic Imports (Phase 3)', runner: runBackupTests },
    { name: 'Journal-Ordered Backup Import and Reset', runner: runBackupPersistenceTests },
    { name: 'Clean User Initialization & Zero Fake Progress (Phase 1)', runner: runCleanInitializationTests },
    { name: 'Gemini Free Tier Security & Isolation (Phase 2)', runner: runGeminiSecurityTests },
    { name: 'Quran Data Structural Integrity & Coverage', runner: runQuranIntegrityTests },
    { name: 'Quran Coordinate and Range Validation', runner: runQuranMathValidationTests },
    { name: 'Domain Event Quran Coordinate Validation', runner: runDomainEventCoordinateTests },
    { name: 'Independent Tanzil Character-by-Character Verification', runner: () => runIndependentTanzilComparison() },
    { name: 'Tanzil Comparison Detector Sensitivity (Negative Tests)', runner: () => runNegativeComparisonTests() },
    { name: 'PWA Compliance & Service Worker Infrastructure', runner: runPwaIntegrationTests },
    { name: 'Firebase Authentication Foundation & Data Preservation', runner: runFirebaseAuthTests },
    { name: 'Phase 3 Core Remediation (Unified Portions, SM-2, Tests & Router)', runner: runPhase3CoreRemediationTests },
    { name: 'Quran Lazy Loading & Chunk Integrity', runner: runQuranLazyLoadingTests },
    { name: 'Mobile Mushaf Touch Ergonomics', runner: runMobileErgonomicsTests },
    { name: 'Tafsir Muyassar API Validation & Cache', runner: runTafsirServiceTests },
    { name: 'Tafsir Serverless Proxy Security & Cache', runner: runTafsirProxyTests },
    { name: 'Tafsir Text Sanitization and Quranic Formatting', runner: runTafsirSanitizerTests },
    { name: 'Truthful 604-Page Progress Mapping', runner: runPageProgressServiceTests },
    { name: 'UID-Scoped Local Storage & Legacy Data Ownership', runner: runStorageScopeTests },
    { name: 'Memorization vs Review Session Completion Isolation', runner: runSessionCompletionTests },
    { name: 'Atomic User-Visible Session Persistence and Rollback', runner: runSessionPersistenceTests },
    { name: 'Revision Duration Accuracy and Prevalidated Page Mapping', runner: runRevisionPersistenceTests },
    { name: 'Atomic Weak-Verse Recording and Portion Rollback', runner: runWeakVerseRecordingTests },
    { name: 'Durable Session Completion Rollback', runner: runStorageReliabilityTests },
    { name: 'UID-Scoped Durable Local Sync Outbox', runner: runLocalSyncOutboxTests },
    { name: 'Atomic IndexedDB Event Journal & Cross-Tab Outbox', runner: runIndexedDbSyncJournalTests },
    { name: 'Deterministic Local Journal Projection Replay', runner: runJournalProjectionReplayerTests },
    { name: 'Journal-First Profile and Plan Snapshot Persistence', runner: runJournaledSnapshotServiceTests },
    { name: 'Collision-Resistant Local Event IDs', runner: runSecureIdTests },
    { name: 'Unique Ayah Retention Quality Score', runner: runUniqueRetentionScoreTests },
    { name: 'Due-Date and Explicit Scope Daily Session Selection', runner: runDailySessionSelectionTests },
    { name: 'Preset Scope & Next Uncovered Memorization Range', runner: runPlanRangeSelectionTests },
    { name: 'Shared Audio Playback Speed Preferences', runner: runAudioPreferencesTests },
    { name: 'Complete Mushaf Page & Navigation Index', runner: runQuranMushafReaderTests },
    { name: 'Cloud Sync Coordinator & Remote Reconciliation', runner: runCloudSyncCoordinatorTests },
    { name: 'Ruqyah API Client & Canonical External Quran Validation', runner: runRuqyahApiServiceTests },
    { name: 'Ruqyah UID-Scoped Progress Persistence & Recovery', runner: runRuqyahProgressServiceTests },
    { name: 'Ruqyah Quran Reciter Catalog & Verse Audio URLs', runner: runRuqyahAudioServiceTests },
    { name: 'Ruqyah API Proxy Security, Validation & Key Isolation', runner: runRuqyahProxyTests },
    { name: 'Ruqyah Canonical Quran Text & Complete Ayah Resolution', runner: runRuqyahContentServiceTests },
    { name: 'Ruqyah Shariah Data & Audio Integrity', runner: runRuqyahIntegrityTests },
  ];

  const { passed, failed } = await executeSuiteAggregation(suites);
  const exitCode = evaluateTestResults(passed, failed);
  process.exit(exitCode);
}

if (typeof process !== 'undefined' && process.argv && (process.argv[1]?.includes('runAllTests') || process.argv[1]?.endsWith('tsx'))) {
  main().catch((err) => {
    console.error('❌ Fatal error in test runner:', err);
    process.exit(1);
  });
}
