import fs from 'fs';
import path from 'path';
import { StorageService, CLEAN_INITIAL_PROFILE } from '../services/storageService';
import { RetentionService } from '../services/retentionService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
}

export function runCleanInitializationTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
    } catch (e: any) {
      failed++;
      console.error(`❌ FAIL: ${name} — ${e?.message || e}`);
    }
  }

  // 1. Initial clean profile
  test('Initial profile has 0 streak, no email, and neutral default name', () => {
    assert(CLEAN_INITIAL_PROFILE.streakDays === 0, 'Clean streak must be 0');
    assert(CLEAN_INITIAL_PROFILE.email === '', 'Clean email must be empty');
    assert(CLEAN_INITIAL_PROFILE.lastActiveDate === '', 'Clean lastActiveDate must be empty');
  });

  // 2. Initial state has no fake progress
  test('New user initialization has zero fake logs, plans, or revision items', () => {
    StorageService.resetAllData();
    RetentionService.resetAll();

    const plans = StorageService.getPlans();
    const logs = StorageService.getLogs();
    const revs = StorageService.getRevisionItems();
    const portions = RetentionService.getPortions();
    const weak = RetentionService.getWeakVerses();

    assert(plans.length === 0, `Plans should be empty, got ${plans.length}`);
    assert(logs.length === 0, `Logs should be empty, got ${logs.length}`);
    assert(revs.length === 0, `Revision items should be empty, got ${revs.length}`);
    assert(portions.length === 0, `Portions should be empty, got ${portions.length}`);
    assert(weak.length === 0, `Weak verses should be empty, got ${weak.length}`);
  });

  // 3. Production entry points must never seed demo progress.
  test('Normal app startup does not invoke demo data loaders', () => {
    const settingsSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SettingsView.tsx'), 'utf8');
    assert(settingsSource.includes('if (!import.meta.env.DEV || isLoadingDemoData) return;'), 'Demo loader must refuse to run outside development');
    assert(settingsSource.includes('{import.meta.env.DEV && ('), 'Demo data card must be hidden in production');
    assert(settingsSource.includes('import.meta.env.DEV && showDemoConfirm'), 'Demo confirmation must be hidden in production');

    const productionEntryFiles = [
      'src/main.tsx',
      'src/App.tsx',
      'src/context/AuthContext.tsx',
      'src/components/auth/AuthGate.tsx',
      'src/components/dashboard/DashboardView.tsx',
      'src/components/plans/MemorizationPlansView.tsx',
      'src/components/assistant/QuranAdvisorView.tsx'
    ];
    const demoLoaderCalls = /\b(?:StorageService\s*\.\s*)?loadDemoData\s*\(|\b(?:RetentionService\s*\.\s*)?loadDemoPortions\s*\(/;

    for (const file of productionEntryFiles) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      assert(!demoLoaderCalls.test(source), `${file} must not seed demo data during normal use`);
    }
  });

  // 4. True zero retention metrics
  test('Retention metrics for clean user report 0% retention and 0 memorized verses', () => {
    StorageService.resetAllData();
    RetentionService.resetAll();

    const metrics = RetentionService.getRetentionDashboardMetrics();
    assert(metrics.retentionScorePercentage === 0, `Retention score should be 0%, got ${metrics.retentionScorePercentage}%`);
    assert(metrics.totalMemorizedAyahs === 0, `Memorized ayahs should be 0, got ${metrics.totalMemorizedAyahs}`);
    assert(metrics.totalTrackedPortions === 0, `Tracked portions should be 0, got ${metrics.totalTrackedPortions}`);
  });

  // 5. Demo mode loads explicitly through the journaled persistence boundary.
  test('Demo mode exposes only the journaled loader and no direct archive writers', () => {
    const settingsSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SettingsView.tsx'), 'utf8');
    const storageSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/storageService.ts'), 'utf8');
    const retentionSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/retentionService.ts'), 'utf8');
    assert(settingsSource.includes('loadDemoDataJournaled()'), 'Demo action must call the journaled persistence service');
    assert(!/\\bloadDemoData\\s*\\(/.test(storageSource), 'StorageService must not expose a direct demo archive writer');
    assert(!/\\bloadDemoPortions\\s*\\(/.test(retentionSource), 'RetentionService must not expose a direct demo portions writer');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('cleanInitialization.test')) {
  console.log('=== Running Clean Initialization Tests ===');
  const res = runCleanInitializationTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
