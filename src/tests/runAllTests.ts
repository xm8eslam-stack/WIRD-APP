import { runAllPlanningEngineTests } from '../services/planningEngine.test';
import { runAllRetentionTests } from '../services/retentionService.test';
import { runAllAdvisorTests } from '../services/deterministicAdvisor.test';
import { runStreakTests } from './streakCalculations.test';
import { runBackupTests } from './backupValidation.test';
import { runCleanInitializationTests } from './cleanInitialization.test';
import { runGeminiSecurityTests } from './geminiSecurity.test';
import { runQuranIntegrityTests } from './quranContentIntegrity.test';
import { runIndependentTanzilComparison, runNegativeComparisonTests } from './independentTanzilComparison';

console.log('====================================================');
console.log('   WIRD | وِرد — Automated Quality & Integrity Suite');
console.log('====================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function runSuite(name: string, runner: () => { passed: number; failed: number }) {
  console.log(`\n▶ [SUITE]: ${name}`);
  const { passed, failed } = runner();
  totalPassed += passed;
  totalFailed += failed;
  console.log(`  Summary: ${passed} Passed, ${failed} Failed`);
}

// 1. Planning Engine
runSuite('Planning Engine Math & Task Distribution', () => {
  const res = runAllPlanningEngineTests();
  return { passed: res.passed, failed: res.failed };
});

// 2. Retention & SM-2 Engine
runSuite('Retention & Spaced Revision Engine', () => {
  const res = runAllRetentionTests();
  return { passed: res.passed, failed: res.failed };
});

// 3. Deterministic Advisor Engine
runSuite('Deterministic Advisor Engine (Offline AI Fallback)', () => {
  const res = runAllAdvisorTests();
  return { passed: res.passed, failed: res.failed };
});

// 4. Streak Calculations
runSuite('Truthful Daily Streak Engine (Phase 3)', runStreakTests);

// 5. Backup Validation & Version Compatibility
runSuite('Backup Schema Validation & Atomic Imports (Phase 3)', runBackupTests);

// 6. Clean User Initialization
runSuite('Clean User Initialization & Zero Fake Progress (Phase 1)', runCleanInitializationTests);

// 7. Gemini Free Tier Security & Isolation
runSuite('Gemini Free Tier Security, Rate Limits & Bundle Isolation (Phase 2)', runGeminiSecurityTests);

// 8. Quran Data Structural Integrity
runSuite('Quran Data Structural Integrity & Coverage', runQuranIntegrityTests);

// 9. Independent Character-by-Character Tanzil Comparison
runSuite('Independent Tanzil Character-by-Character Text & Metadata Verification', () => {
  const res = runIndependentTanzilComparison();
  return { passed: res.passed, failed: res.failed };
});

// 10. Negative Comparison Sensitivity Tests
runSuite('Tanzil Comparison Detector Sensitivity (Negative Tests)', () => {
  const res = runNegativeComparisonTests();
  return { passed: res.passed, failed: res.failed };
});

console.log('\n====================================================');
console.log(`FINAL RESULT: ${totalPassed} PASSED | ${totalFailed} FAILED`);
console.log('====================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
