import { runAllPlanningEngineTests } from '../services/planningEngine.test';
import { runAllRetentionTests } from '../services/retentionService.test';
import { runAllAdvisorTests } from '../services/deterministicAdvisor.test';
import { runStreakTests } from './streakCalculations.test';
import { runBackupTests } from './backupValidation.test';
import { runCleanInitializationTests } from './cleanInitialization.test';
import { runGeminiSecurityTests } from './geminiSecurity.test';
import { runQuranIntegrityTests } from './quranContentIntegrity.test';
import { runIndependentTanzilComparison, runNegativeComparisonTests } from './independentTanzilComparison';
import { runPwaIntegrationTests } from './pwaIntegration.test';
import { runFirebaseAuthTests } from './firebaseAuth.test';
import { runPhase3CoreRemediationTests } from './phase3CoreRemediation.test';
import { runQuranLazyLoadingTests } from './quranLazyLoading.test';
import { runMobileErgonomicsTests } from './mobileErgonomics.test';

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
    { name: 'Clean User Initialization & Zero Fake Progress (Phase 1)', runner: runCleanInitializationTests },
    { name: 'Gemini Free Tier Security & Isolation (Phase 2)', runner: runGeminiSecurityTests },
    { name: 'Quran Data Structural Integrity & Coverage', runner: runQuranIntegrityTests },
    { name: 'Independent Tanzil Character-by-Character Verification', runner: () => runIndependentTanzilComparison() },
    { name: 'Tanzil Comparison Detector Sensitivity (Negative Tests)', runner: () => runNegativeComparisonTests() },
    { name: 'PWA Compliance & Service Worker Infrastructure', runner: runPwaIntegrationTests },
    { name: 'Firebase Authentication Foundation & Data Preservation', runner: runFirebaseAuthTests },
    { name: 'Phase 3 Core Remediation (Unified Portions, SM-2, Tests & Router)', runner: runPhase3CoreRemediationTests },
    { name: 'Quran Lazy Loading & Chunk Integrity', runner: runQuranLazyLoadingTests },
    { name: 'Mobile Mushaf Touch Ergonomics', runner: runMobileErgonomicsTests },
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
