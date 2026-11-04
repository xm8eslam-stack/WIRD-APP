import { calculateActiveStreak, advanceStreakOnCompletion } from '../services/storageService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
}

export function runStreakTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
    } catch (e: any) {
      failed++;
    }
  }

  // 1. First ever session
  test('First ever session starts streak at 1', () => {
    const res = advanceStreakOnCompletion('', 0, '2026-11-04');
    assert(res.newStreak === 1 && res.newDate === '2026-11-04', 'Streak should be 1 on first session');
  });

  // 2. Consecutive day completion
  test('Consecutive day completion increments streak by 1', () => {
    const res = advanceStreakOnCompletion('2026-11-03', 5, '2026-11-04');
    assert(res.newStreak === 6 && res.newDate === '2026-11-04', 'Streak should increment from 5 to 6');
  });

  // 3. Same day repeated completion
  test('Same day completion preserves streak without duplicate increment', () => {
    const res = advanceStreakOnCompletion('2026-11-04', 6, '2026-11-04');
    assert(res.newStreak === 6 && res.newDate === '2026-11-04', 'Streak should remain 6 on same day');
  });

  // 4. Missed day reset upon completion
  test('Missed day (2+ days gap) resets streak to 1 upon completion', () => {
    const res = advanceStreakOnCompletion('2026-10-31', 12, '2026-11-04');
    assert(res.newStreak === 1 && res.newDate === '2026-11-04', 'Streak should reset to 1 after gap');
  });

  // 5. Active streak check: Yesterday was active
  test('Active streak check keeps streak intact when yesterday was active', () => {
    const active = calculateActiveStreak('2026-11-03', 4, '2026-11-04');
    assert(active === 4, 'Active streak should be 4 while waiting for today');
  });

  // 6. Active streak check: Gap of 2 days lapses streak to 0
  test('Active streak check reports 0 when more than 1 day was missed', () => {
    const active = calculateActiveStreak('2026-11-01', 10, '2026-11-04');
    assert(active === 0, 'Lapsed streak should report 0');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('streakCalculations.test')) {
  console.log('=== Running Streak Engine Tests ===');
  const res = runStreakTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
